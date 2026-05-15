# Gmail CC/To Recipient Warning — Browser Extension Design

**Date**: 2026-05-15
**Status**: Approved for planning

## Summary

A browser extension (Chrome, Firefox, Safari) that warns the user inside Gmail's web compose UI when recipient choices may leak addresses. Two rules:

1. **Multi-recipient with external** — more than one recipient in To/CC and at least one external. Suggest BCC.
2. **Sensitive address mixed with external** — a user-flagged sensitive internal address is on the same thread as any external recipient. Blocks Send until acknowledged.

BCC is excluded from rule 1 (already hidden) but included in rule 2 (sensitive leaks regardless).

## Goals / Non-Goals

**Goals**
- Catch the common "reply-all leaks the customer list" mistake.
- Cross-browser via a single WebExtension Manifest V3 codebase.
- Pure, testable rule engine decoupled from DOM.
- User-configurable: internal domains, sensitive addresses, rule toggles, threshold.

**Non-Goals**
- Server-side scanning, DLP, or content inspection of email body.
- Reading or storing message content.
- Outlook, Yahoo, or other mail clients.
- Mobile.

## Architecture

WebExtension Manifest V3. Single shared codebase. Per-browser packaging.

```
gmail-cc-warn/
├── manifest.json              # shared; Firefox may need browser_specific_settings
├── content/
│   ├── observer.js            # MutationObserver, finds compose dialogs
│   ├── parser.js              # extracts recipient chips from To/CC/BCC
│   ├── rules.js               # pure rule engine (testable)
│   └── ui.js                  # banner inject + Send intercept
├── options/
│   ├── options.html
│   └── options.js             # config UI
├── background/sw.js           # minimal service worker
├── shared/storage.js          # storage.sync wrapper + defaults
├── test/
│   ├── rules.test.js          # unit tests for rules.js
│   ├── parser.test.js         # JSDOM + fixtures
│   └── fixtures/              # captured Gmail compose HTML
└── safari/                    # generated Xcode wrapper
```

**Permissions**: `storage`, host permission `https://mail.google.com/*`. No broad host perms, no `tabs`, no `webRequest`.

**Browsers**:
- Chrome/Edge: native MV3.
- Firefox 115+: native MV3.
- Safari: same extension wrapped via `xcrun safari-web-extension-converter`. Xcode project committed under `safari/`.

## Detection

Gmail compose UI = `div[role="dialog"]` containing recipient chip regions.

**Observer flow**:
1. `MutationObserver` on `document.body` watches for added nodes that are or contain `[role="dialog"]`.
2. For each compose dialog, locate To/CC/BCC regions. Selector strategy (try in order):
   - `[aria-label="To recipients"]`, `[aria-label="Cc recipients"]`, `[aria-label="Bcc recipients"]` (English).
   - `input[name="to"]`, `input[name="cc"]`, `input[name="bcc"]` — hidden inputs Gmail keeps as language-invariant fallback.
   - A versioned selector map in `parser.js` to make Gmail-update fixes a one-file change.
3. Per region, nested observer on its chip container.
4. Chip → address extraction: prefer `[email]` attribute, fall back to `[data-hovercard-id]`, fall back to text content with email regex.
5. Debounce re-evaluation 50ms.

**Resilience**: If no compose dialog elements match, log a single warning per page and exit quietly. Never throw into Gmail's runtime.

## Rule Engine

`rules.js` exports `evaluate(parsed, config) → Warning[]`. Pure function, no DOM, no globals.

**Input**:
```js
{
  to: ["a@x.com", "b@y.com"],
  cc: ["c@x.com"],
  bcc: [],
  senderDomain: "x.com"
}
```

**Config** (from `storage.sync`, with defaults applied):
```js
{
  internalDomains: ["mycompany.com"],
  sensitiveAddresses: ["exec@mycompany.com", "all-hands@mycompany.com"],
  rules: {
    multiRecipientWithExternal: { enabled: true, threshold: 2 },
    sensitiveMixedWithExternal: { enabled: true }
  }
}
```

**Rule 1 — `multiRecipientWithExternal`**:
- `count = to.length + cc.length` (BCC excluded).
- `externals = to ∪ cc filtered by domain ∉ internalDomains`.
- Fire when `count >= threshold && externals.length > 0`.
- Severity: `warn`.

**Rule 2 — `sensitiveMixedWithExternal`**:
- `sensitivePresent = (to ∪ cc ∪ bcc) ∩ sensitiveAddresses`.
- `externalPresent = (to ∪ cc ∪ bcc) has any addr with domain ∉ internalDomains`.
- Fire when `sensitivePresent.length > 0 && externalPresent`.
- Severity: `block`.

**Domain match**: case-insensitive. Sub-domain match is NOT implicit; `mycompany.com` does not match `eu.mycompany.com`. Users add each domain explicitly.

**Sensitive match**: case-insensitive. Glob support for `*@list.mycompany.com` style entries (translate to anchored regex internally).

**Output**:
```js
[
  {
    id: "multi-external",
    severity: "warn",
    message: "3 recipients in To/CC, 1 external (foo@bar.com). Consider BCC.",
    externals: ["foo@bar.com"]
  },
  {
    id: "sensitive-mixed",
    severity: "block",
    message: "exec@mycompany.com on thread with external recipient foo@bar.com.",
    offenders: { sensitive: ["exec@mycompany.com"], external: ["foo@bar.com"] }
  }
]
```

## UI

**Banner**: Injected into compose dialog header. Shadow DOM root to isolate styles from Gmail. Yellow background for `warn`, red for `block`. Lists each warning's message and offending addresses. Dismiss-this-compose button hides for current dialog instance only.

**Send intercept** (only when any `block` warning is currently active):
- Locate Send button by `[role="button"][data-tooltip*="Send"]` or `[aria-label*="Send"]`. Fallback list for non-English.
- Capture-phase `click` listener on dialog root. If a `block` warning is active and the per-compose ack flag is not set, call `stopImmediatePropagation()` + `preventDefault()` and show the confirm modal.
- Capture-phase `keydown` listener for `(meta|ctrl)+Enter` (Gmail send shortcut).
- Confirm modal: title, list of offenders, `[Cancel]` `[Send anyway]`. `Send anyway` sets `ackedDialogs.add(dialogId)` and synthesizes a real click on the Send button.
- Modal in own Shadow DOM. Focus trap. `Esc` = cancel.

**No ack persistence across composes**: each compose is evaluated fresh; ack is per-dialog instance.

## Options Page

`options.html` opened from `chrome://extensions` → Options or the browser action.

Sections:
1. **Internal domains** — textarea, one domain per line.
2. **Sensitive addresses** — textarea, one entry per line. Plain emails or `*@list.example.com` globs.
3. **Rules** — checkbox per rule. Number input for `multiRecipientWithExternal.threshold` (default 2, min 2).
4. **Save** writes via `storage.sync.set`. Live validation on blur: domain regex / email regex; invalid lines highlighted.

`shared/storage.js`:
- `getConfig()` — reads and merges with defaults.
- `setConfig(partial)` — merges + saves.
- `onChange(cb)` — wraps `storage.onChanged`, fires content scripts to re-evaluate live.

Content scripts call `getConfig()` once on load and subscribe to changes; re-evaluate all open compose dialogs on change.

## Testing

**Unit — `rules.js`** (Vitest or `node --test`):
- No recipients.
- One internal recipient.
- One external recipient.
- Multiple internal only (rule 1 should NOT fire — no external).
- Multiple, mixed (rule 1 fires).
- Threshold edge (`count === threshold`, `count === threshold - 1`).
- BCC-only with external (rule 1 should NOT fire).
- Sensitive + only internal (rule 2 should NOT fire).
- Sensitive + external in BCC (rule 2 fires).
- Glob match: `*@list.example.com` matches `team@list.example.com`.
- Case insensitivity.

**Unit — `parser.js`** (JSDOM + captured fixtures):
- Chip with `email` attribute.
- Chip with `data-hovercard-id` only.
- Hidden input fallback.
- Empty compose (no chips).
- Non-English `aria-label` (e.g., Spanish "Para destinatarios") falling back to hidden input.

**Integration**: manual QA checklist in real Gmail. Not automated — login + Gmail brittleness make it not worth it. Checklist lives in `README.md`.

## Packaging

- **Chrome/Edge**: zip extension root → upload to Chrome Web Store ($5 one-time) or load unpacked for dev.
- **Firefox**: same zip → submit to AMO (free). Add `browser_specific_settings.gecko.id` to manifest.
- **Safari**: `xcrun safari-web-extension-converter ./ --project-location ./safari --bundle-identifier dev.adamyonk.gmailccwarn --no-open`. Commit generated Xcode project. Build in Xcode, sign with Apple Dev cert. Local install works without paid cert; App Store distribution requires $99/yr Apple Developer.

README documents load-unpacked steps for each browser plus the manual QA checklist.

## Open Risks

1. **Gmail DOM changes** — selectors are the load-bearing fragility. Mitigation: versioned selector map, hidden-input fallback, single log on failure, easy single-file fix.
2. **Send intercept missed** — Gmail may use additional send paths (Send + Schedule menu). Mitigation: monitor any element with send-related `aria-label`. Schedule Send out of scope for v1.
3. **Sensitive list secrecy** — `storage.sync` is synced via the browser account. Acceptable: user's own Chrome/Firefox account; not shared. Document this in options page.
4. **i18n** — only English `aria-label` covered initially. Hidden-input fallback should handle most locales. Add language packs if users report misses.

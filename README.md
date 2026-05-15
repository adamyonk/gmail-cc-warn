# gmail-cc-warn

Browser extension that warns inside Gmail compose when:

1. **Multi-recipient with external** — More than one recipient in To/CC and at least one external. Shows a yellow banner suggesting BCC.
2. **Sensitive address with external** — A user-flagged sensitive internal address (e.g., `exec@`, `all-hands@`, distribution lists) appears alongside any external recipient. Shows a red banner and blocks Send until acknowledged.

Configuration is in the extension's options page. Settings sync via the browser's account-level storage.

## Install (development)

### Chrome / Edge
1. `chrome://extensions` → enable Developer mode → "Load unpacked" → select this directory.

### Firefox
1. `about:debugging` → "This Firefox" → "Load Temporary Add-on" → select `manifest.firefox.json`.

### Safari
1. `cd safari/Gmail\ CC-To\ Recipient\ Warning && open *.xcodeproj`
2. Build and run the container app (⌘R).
3. Safari → Settings → Extensions → enable the extension and grant access to `mail.google.com`.

## Tests

```bash
npm install
npm test
```

## Manual QA checklist

For each browser:

- [ ] Two recipients (one internal, one external) → yellow banner appears.
- [ ] Move external recipient to BCC → banner disappears.
- [ ] Sensitive address + external recipient → red banner.
- [ ] Click Send → confirm modal blocks until "Send anyway".
- [ ] Press ⌘↵ / Ctrl↵ → same modal triggers.
- [ ] Close and reopen compose → state resets (no lingering banners).
- [ ] Change options while compose is open → banner updates live.

## Architecture

See `docs/superpowers/specs/2026-05-15-gmail-cc-warn-design.md`.

## Before release

- Replace `icons/icon-{16,48,128}.png` (currently 1×1 transparent placeholders).
- Register a Chrome Web Store developer account ($5 one-time) and AMO account (free) for Firefox.
- Apple Developer Program ($99/yr) is required to distribute the Safari version outside local development.

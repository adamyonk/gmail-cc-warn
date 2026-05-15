(async () => {
  console.log('[gmail-cc-warn] bootstrap start');
  const url = (path) => chrome.runtime.getURL(path);
  const [storage, rules, parser, observer, ui] = await Promise.all([
    import(url('shared/storage.js')),
    import(url('content/rules.js')),
    import(url('content/parser.js')),
    import(url('content/observer.js')),
    import(url('content/ui.js'))
  ]);
  console.log('[gmail-cc-warn] imports loaded');

  let config = await storage.getConfig();
  console.log('[gmail-cc-warn] config loaded', JSON.stringify(config));
  const composeHandles = new Map();

  function currentSenderDomain() {
    const meta = document.querySelector('meta[name="user-email"]');
    if (meta?.content) {
      const at = meta.content.lastIndexOf('@');
      return at >= 0 ? meta.content.slice(at + 1).toLowerCase() : null;
    }
    return null;
  }

  function isComposeDialog(dialog) {
    const result = Boolean(
      dialog.querySelector('[aria-label="To recipients"]')
        || dialog.querySelector('input[type="hidden"][name="to"]')
    );
    console.log('[gmail-cc-warn] isComposeDialog', result, dialog.className?.slice(0, 40));
    return result;
  }

  function onCompose(dialog) {
    console.log('[gmail-cc-warn] onCompose called');
    const handle = ui.attachUi(dialog);
    function evaluate() {
      const parsed = parser.parseCompose(dialog);
      parsed.senderDomain = currentSenderDomain();
      const warnings = rules.evaluate(parsed, config);
      console.log('[gmail-cc-warn] onChange parsed', JSON.stringify(parsed));
      console.log('[gmail-cc-warn] onChange warnings', JSON.stringify(warnings));
      handle.render(warnings);
    }
    const detach = observer.startObserver(dialog, evaluate);
    evaluate();
    composeHandles.set(dialog, { detach, ui: handle });
  }

  function onComposeRemoved(dialog) {
    const entry = composeHandles.get(dialog);
    if (entry) {
      entry.detach();
      entry.ui.destroy();
      composeHandles.delete(dialog);
    }
  }

  const globalObserver = new MutationObserver(mutations => {
    for (const m of mutations) {
      for (const node of m.addedNodes) {
        if (node.nodeType !== 1) continue;
        const dialogs = node.matches?.('[role="dialog"]')
          ? [node]
          : Array.from(node.querySelectorAll?.('[role="dialog"]') ?? []);
        for (const d of dialogs) {
          if (!composeHandles.has(d) && isComposeDialog(d)) onCompose(d);
        }
      }
      for (const node of m.removedNodes) {
        if (node.nodeType !== 1) continue;
        if (composeHandles.has(node)) {
          onComposeRemoved(node);
          continue;
        }
        const dialogs = Array.from(node.querySelectorAll?.('[role="dialog"]') ?? []);
        for (const d of dialogs) {
          if (composeHandles.has(d)) onComposeRemoved(d);
        }
      }
    }
  });

  console.log('[gmail-cc-warn] observer attached');
  globalObserver.observe(document.body, { childList: true, subtree: true });

  storage.onConfigChange(newConfig => {
    config = newConfig;
    for (const [dialog, entry] of composeHandles) {
      const parsed = parser.parseCompose(dialog);
      parsed.senderDomain = currentSenderDomain();
      entry.ui.render(rules.evaluate(parsed, config));
    }
  });
})().catch(err => console.error('[gmail-cc-warn] bootstrap failed:', err));

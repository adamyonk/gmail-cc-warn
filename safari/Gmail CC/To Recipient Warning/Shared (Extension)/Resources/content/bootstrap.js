(async () => {
  const url = (path) => chrome.runtime.getURL(path);
  const [storage, rules, parser, observer, ui] = await Promise.all([
    import(url('shared/storage.js')),
    import(url('content/rules.js')),
    import(url('content/parser.js')),
    import(url('content/observer.js')),
    import(url('content/ui.js'))
  ]);

  let config = await storage.getConfig();
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
    return Boolean(
      dialog.querySelector('[aria-label="To recipients"]')
        || dialog.querySelector('input[type="hidden"][name="to"]')
    );
  }

  function onCompose(dialog) {
    const handle = ui.attachUi(dialog);
    const detach = observer.startObserver(dialog, () => {
      const parsed = parser.parseCompose(dialog);
      parsed.senderDomain = currentSenderDomain();
      handle.render(rules.evaluate(parsed, config));
    });
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

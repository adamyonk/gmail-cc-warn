export function startObserver(dialog, onChange) {
  let timer = null;
  const fire = () => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      timer = null;
      try {
        onChange();
      } catch (err) {
        console.error('[gmail-cc-warn] onChange threw:', err);
      }
    }, 50);
  };

  fire();

  const observer = new MutationObserver(fire);
  observer.observe(dialog, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ['email', 'data-hovercard-id', 'value']
  });

  return () => {
    if (timer) clearTimeout(timer);
    observer.disconnect();
  };
}

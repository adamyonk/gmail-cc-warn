const STYLES = `
  :host { all: initial; }
  .banner { font: 13px/1.4 -apple-system, system-ui, sans-serif; padding: 8px 12px; border-radius: 4px; margin: 4px 8px; }
  .banner.warn  { background: #fff3cd; color: #664d03; border: 1px solid #ffe69c; }
  .banner.block { background: #f8d7da; color: #58151c; border: 1px solid #f1aeb5; }
  .modal-backdrop { position: fixed; inset: 0; background: rgba(0,0,0,.4); z-index: 2147483647; display: flex; align-items: center; justify-content: center; }
  .modal { background: #fff; padding: 16px 20px; border-radius: 6px; max-width: 480px; font: 13px/1.4 -apple-system, system-ui, sans-serif; }
  .modal h2 { margin: 0 0 8px; font-size: 15px; }
  .modal .actions { margin-top: 12px; text-align: right; }
  .modal button { margin-left: 8px; padding: 6px 12px; cursor: pointer; }
`;

function makeStyleNode(doc) {
  const style = doc.createElement('style');
  style.textContent = STYLES;
  return style;
}

function makeBannerNode(doc, warning) {
  const div = doc.createElement('div');
  div.className = `banner ${warning.severity}`;
  div.textContent = warning.message;
  return div;
}

export function attachUi(dialog) {
  const doc = dialog.ownerDocument;
  const host = doc.createElement('div');
  host.setAttribute('data-gmail-cc-warn', 'host');
  host.style.cssText = 'all:initial; display:block;';
  const shadow = host.attachShadow({ mode: 'closed' });
  shadow.appendChild(makeStyleNode(doc));

  const container = doc.createElement('div');
  shadow.appendChild(container);

  dialog.prepend(host);

  let currentWarnings = [];
  let acked = false;

  function render(warnings) {
    currentWarnings = warnings;
    while (container.firstChild) container.removeChild(container.firstChild);
    // don't render when compose is minimized (title bar only)
    if (dialog.offsetHeight < 80) return;
    for (const w of warnings) {
      container.appendChild(makeBannerNode(doc, w));
    }
    if (warnings.some(w => w.severity === 'block')) {
      acked = false;
    }
  }

  function hasBlockingWarning() {
    return currentWarnings.some(w => w.severity === 'block');
  }

  function buildModal() {
    const modalHost = doc.createElement('div');
    const modalShadow = modalHost.attachShadow({ mode: 'closed' });
    modalShadow.appendChild(makeStyleNode(doc));

    const backdrop = doc.createElement('div');
    backdrop.className = 'modal-backdrop';

    const modal = doc.createElement('div');
    modal.className = 'modal';
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-modal', 'true');

    const h2 = doc.createElement('h2');
    h2.textContent = 'Send anyway?';
    modal.appendChild(h2);

    const body = doc.createElement('div');
    for (const w of currentWarnings.filter(x => x.severity === 'block')) {
      const p = doc.createElement('p');
      p.textContent = w.message;
      body.appendChild(p);
    }
    modal.appendChild(body);

    const actions = doc.createElement('div');
    actions.className = 'actions';
    const cancelBtn = doc.createElement('button');
    cancelBtn.textContent = 'Cancel';
    cancelBtn.dataset.action = 'cancel';
    const sendBtn = doc.createElement('button');
    sendBtn.textContent = 'Send anyway';
    sendBtn.dataset.action = 'send';
    actions.appendChild(cancelBtn);
    actions.appendChild(sendBtn);
    modal.appendChild(actions);

    backdrop.appendChild(modal);
    modalShadow.appendChild(backdrop);

    return { modalHost, cancelBtn, sendBtn };
  }

  function showConfirmModal() {
    return new Promise(resolve => {
      const { modalHost, cancelBtn, sendBtn } = buildModal();
      doc.body.appendChild(modalHost);

      const cleanup = (result) => {
        modalHost.remove();
        doc.removeEventListener('keydown', onKey, true);
        resolve(result);
      };
      const onKey = (e) => {
        if (e.key === 'Escape') { e.stopPropagation(); cleanup(false); }
      };
      doc.addEventListener('keydown', onKey, true);
      cancelBtn.addEventListener('click', () => cleanup(false));
      sendBtn.addEventListener('click', () => cleanup(true));
      sendBtn.focus();
    });
  }

  async function interceptSend(originalEvent, sendButton) {
    if (!hasBlockingWarning() || acked) return;
    originalEvent.preventDefault();
    originalEvent.stopImmediatePropagation();
    const ok = await showConfirmModal();
    if (ok) {
      acked = true;
      sendButton.click();
    }
  }

  function findSendButton() {
    return dialog.querySelector('[role="button"][data-tooltip*="Send"]')
      || dialog.querySelector('[role="button"][aria-label*="Send"]');
  }

  const clickHandler = (e) => {
    const btn = e.target.closest?.('[role="button"]');
    if (!btn) return;
    if (btn !== findSendButton()) return;
    interceptSend(e, btn);
  };
  const keyHandler = (e) => {
    const isSend = (e.metaKey || e.ctrlKey) && e.key === 'Enter';
    if (!isSend) return;
    const btn = findSendButton();
    if (!btn) return;
    interceptSend(e, btn);
  };

  dialog.addEventListener('click', clickHandler, true);
  dialog.addEventListener('keydown', keyHandler, true);

  return {
    render,
    destroy() {
      dialog.removeEventListener('click', clickHandler, true);
      dialog.removeEventListener('keydown', keyHandler, true);
      host.remove();
    }
  };
}

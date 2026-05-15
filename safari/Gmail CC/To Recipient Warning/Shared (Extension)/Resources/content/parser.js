const FIELD_ARIA_LABELS = {
  to: ['To recipients'],
  cc: ['CC recipients', 'Cc recipients'],
  bcc: ['BCC recipients', 'Bcc recipients']
};

function extractEmailFromText(text) {
  const match = text.match(/[^\s<>"']+@[^\s<>"']+\.[^\s<>"']+/);
  return match ? match[0] : null;
}

function extractFromChips(region) {
  let chips = [...region.querySelectorAll('[role="option"]')];
  if (chips.length === 0) chips = [...region.querySelectorAll('[data-hovercard-id]')];
  const seen = new Set();
  const addresses = [];
  for (const chip of chips) {
    const email = chip.getAttribute('email')
      || chip.getAttribute('data-hovercard-id')
      || extractEmailFromText(chip.textContent || '');
    if (email && !seen.has(email.trim())) {
      seen.add(email.trim());
      addresses.push(email.trim());
    }
  }
  return addresses;
}

function parseHiddenInputList(input) {
  if (!input || !input.value) return [];
  return input.value.split(',').map(s => s.trim()).filter(Boolean);
}

function findFieldRegion(dialog, field) {
  for (const label of FIELD_ARIA_LABELS[field]) {
    const input = dialog.querySelector(`[aria-label="${label}"]`);
    if (!input) continue;
    const otherInputs = Object.entries(FIELD_ARIA_LABELS)
      .filter(([f]) => f !== field)
      .flatMap(([, labels]) => labels.map(l => dialog.querySelector(`[aria-label="${l}"]`)))
      .filter(Boolean);
    let el = input.parentElement;
    while (el && el !== dialog) {
      if (otherInputs.some(other => el.contains(other))) break;
      if (el.querySelectorAll('[role="option"]').length > 0 ||
          el.querySelectorAll('[data-hovercard-id]').length > 0) {
        return el;
      }
      el = el.parentElement;
    }
    return input.parentElement;
  }
  return null;
}

function parseField(dialog, field) {
  const region = findFieldRegion(dialog, field);
  if (region) {
    const chipAddresses = extractFromChips(region);
    if (chipAddresses.length > 0) return chipAddresses;
  }
  const hidden = dialog.querySelector(`input[type="hidden"][name="${field}"]`);
  return parseHiddenInputList(hidden);
}

export function parseCompose(dialog) {
  if (!dialog) {
    return { to: [], cc: [], bcc: [], senderDomain: null };
  }
  return {
    to: parseField(dialog, 'to'),
    cc: parseField(dialog, 'cc'),
    bcc: parseField(dialog, 'bcc'),
    senderDomain: null
  };
}

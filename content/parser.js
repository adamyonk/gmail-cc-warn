const FIELD_ARIA_LABELS = {
  to: ['To recipients'],
  cc: ['Cc recipients'],
  bcc: ['Bcc recipients']
};

function extractEmailFromText(text) {
  const match = text.match(/[^\s<>"']+@[^\s<>"']+\.[^\s<>"']+/);
  return match ? match[0] : null;
}

function extractFromChips(region) {
  const chips = region.querySelectorAll('[role="option"]');
  const addresses = [];
  for (const chip of chips) {
    const email = chip.getAttribute('email')
      || chip.getAttribute('data-hovercard-id')
      || extractEmailFromText(chip.textContent || '');
    if (email) addresses.push(email.trim());
  }
  return addresses;
}

function parseHiddenInputList(input) {
  if (!input || !input.value) return [];
  return input.value.split(',').map(s => s.trim()).filter(Boolean);
}

function findFieldRegion(dialog, field) {
  for (const label of FIELD_ARIA_LABELS[field]) {
    const node = dialog.querySelector(`[aria-label="${label}"]`);
    if (node) return node;
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

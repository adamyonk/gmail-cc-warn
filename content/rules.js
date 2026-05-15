function domainOf(address) {
  const at = address.lastIndexOf('@');
  return at < 0 ? '' : address.slice(at + 1).toLowerCase();
}

function isExternal(address, internalDomains) {
  const d = domainOf(address);
  return !internalDomains.some(id => id.toLowerCase() === d);
}

function evaluateMultiRecipientWithExternal(parsed, config) {
  const rule = config.rules.multiRecipientWithExternal;
  if (!rule.enabled) return null;

  const toCc = [...parsed.to, ...parsed.cc];
  if (toCc.length < rule.threshold) return null;

  const externals = toCc.filter(a => isExternal(a, config.internalDomains));
  if (externals.length === 0) return null;

  return {
    id: 'multi-external',
    severity: 'warn',
    message: `${toCc.length} recipients in To/CC, ${externals.length} external (${externals.join(', ')}). Consider BCC.`,
    externals
  };
}

export function evaluate(parsed, config) {
  const warnings = [];
  const w1 = evaluateMultiRecipientWithExternal(parsed, config);
  if (w1) warnings.push(w1);
  return warnings;
}

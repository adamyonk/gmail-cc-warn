function domainOf(address) {
  const at = address.lastIndexOf('@');
  return at < 0 ? '' : address.slice(at + 1).toLowerCase();
}

function isExternal(address, internalDomains) {
  const d = domainOf(address);
  return !internalDomains.some(id => id.toLowerCase() === d);
}

function patternToRegex(pattern) {
  const escaped = pattern.toLowerCase().replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*');
  return new RegExp(`^${escaped}$`);
}

function isSensitive(address, sensitiveAddresses) {
  const a = address.toLowerCase();
  return sensitiveAddresses.some(entry => {
    if (entry.includes('*')) return patternToRegex(entry).test(a);
    return entry.toLowerCase() === a;
  });
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

function evaluateSensitiveMixedWithExternal(parsed, config) {
  const rule = config.rules.sensitiveMixedWithExternal;
  if (!rule.enabled) return null;

  const all = [...parsed.to, ...parsed.cc, ...parsed.bcc];
  const sensitive = all.filter(a => isSensitive(a, config.sensitiveAddresses));
  if (sensitive.length === 0) return null;

  const external = all.filter(a => isExternal(a, config.internalDomains));
  if (external.length === 0) return null;

  return {
    id: 'sensitive-mixed',
    severity: 'block',
    message: `Sensitive address ${sensitive.join(', ')} on thread with external recipient ${external.join(', ')}.`,
    offenders: { sensitive, external }
  };
}

export function evaluate(parsed, config) {
  const warnings = [];
  const w1 = evaluateMultiRecipientWithExternal(parsed, config);
  if (w1) warnings.push(w1);
  const w2 = evaluateSensitiveMixedWithExternal(parsed, config);
  if (w2) warnings.push(w2);
  return warnings;
}

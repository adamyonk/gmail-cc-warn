export const DEFAULTS = Object.freeze({
  internalDomains: [],
  sensitiveAddresses: [],
  rules: {
    multiRecipientWithExternal: { enabled: true, threshold: 2 },
    sensitiveMixedWithExternal: { enabled: true }
  }
});

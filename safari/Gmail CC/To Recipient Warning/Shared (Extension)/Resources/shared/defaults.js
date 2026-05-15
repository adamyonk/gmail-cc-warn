export const DEFAULTS = Object.freeze({
  internalDomains: [],
  sensitiveAddresses: [],
  rules: Object.freeze({
    multiRecipientWithExternal: Object.freeze({ enabled: true, threshold: 2 }),
    sensitiveMixedWithExternal: Object.freeze({ enabled: true })
  })
});

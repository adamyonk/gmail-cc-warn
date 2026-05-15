import { DEFAULTS } from './defaults.js';

export function mergeWithDefaults(partial) {
  const merged = {
    internalDomains: Array.isArray(partial.internalDomains)
      ? [...partial.internalDomains]
      : [...DEFAULTS.internalDomains],
    sensitiveAddresses: Array.isArray(partial.sensitiveAddresses)
      ? [...partial.sensitiveAddresses]
      : [...DEFAULTS.sensitiveAddresses],
    rules: {
      multiRecipientWithExternal: {
        ...DEFAULTS.rules.multiRecipientWithExternal,
        ...(partial.rules?.multiRecipientWithExternal ?? {})
      },
      sensitiveMixedWithExternal: {
        ...DEFAULTS.rules.sensitiveMixedWithExternal,
        ...(partial.rules?.sensitiveMixedWithExternal ?? {})
      }
    }
  };
  return merged;
}

const STORAGE_KEY = 'config';

function getStorageArea() {
  const api = globalThis.chrome ?? globalThis.browser;
  if (!api?.storage?.sync) {
    throw new Error('storage.sync API not available');
  }
  return api.storage.sync;
}

export async function getConfig() {
  const area = getStorageArea();
  const result = await area.get(STORAGE_KEY);
  return mergeWithDefaults(result[STORAGE_KEY] ?? {});
}

export async function setConfig(partial) {
  const area = getStorageArea();
  const current = await getConfig();
  const next = mergeWithDefaults({ ...current, ...partial });
  await area.set({ [STORAGE_KEY]: next });
  return next;
}

export function onConfigChange(callback) {
  const api = globalThis.chrome ?? globalThis.browser;
  const handler = (changes, areaName) => {
    if (areaName === 'sync' && changes[STORAGE_KEY]) {
      callback(mergeWithDefaults(changes[STORAGE_KEY].newValue ?? {}));
    }
  };
  api.storage.onChanged.addListener(handler);
  return () => api.storage.onChanged.removeListener(handler);
}

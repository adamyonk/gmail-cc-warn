import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mergeWithDefaults } from '../shared/storage.js';
import { DEFAULTS } from '../shared/defaults.js';

test('mergeWithDefaults returns DEFAULTS when given empty object', () => {
  assert.deepEqual(mergeWithDefaults({}), DEFAULTS);
});

test('mergeWithDefaults overrides scalar values', () => {
  const result = mergeWithDefaults({
    rules: { multiRecipientWithExternal: { threshold: 5 } }
  });
  assert.equal(result.rules.multiRecipientWithExternal.threshold, 5);
  assert.equal(result.rules.multiRecipientWithExternal.enabled, true);
});

test('mergeWithDefaults preserves user-supplied arrays', () => {
  const result = mergeWithDefaults({
    internalDomains: ['example.com'],
    sensitiveAddresses: ['exec@example.com']
  });
  assert.deepEqual(result.internalDomains, ['example.com']);
  assert.deepEqual(result.sensitiveAddresses, ['exec@example.com']);
});

test('mergeWithDefaults keeps default empty arrays when not supplied', () => {
  const result = mergeWithDefaults({});
  assert.deepEqual(result.internalDomains, []);
  assert.deepEqual(result.sensitiveAddresses, []);
});

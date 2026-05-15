import { test } from 'node:test';
import assert from 'node:assert/strict';
import { evaluate } from '../content/rules.js';
import { DEFAULTS } from '../shared/defaults.js';

const baseConfig = {
  ...DEFAULTS,
  internalDomains: ['mycompany.com']
};

test('rule1: no warning when there are no recipients', () => {
  const result = evaluate({ to: [], cc: [], bcc: [], senderDomain: 'mycompany.com' }, baseConfig);
  assert.deepEqual(result, []);
});

test('rule1: no warning for single internal recipient', () => {
  const result = evaluate(
    { to: ['a@mycompany.com'], cc: [], bcc: [], senderDomain: 'mycompany.com' },
    baseConfig
  );
  assert.deepEqual(result, []);
});

test('rule1: no warning for multiple internal recipients (no external)', () => {
  const result = evaluate(
    { to: ['a@mycompany.com', 'b@mycompany.com'], cc: ['c@mycompany.com'], bcc: [], senderDomain: 'mycompany.com' },
    baseConfig
  );
  assert.deepEqual(result, []);
});

test('rule1: fires when threshold met and external present', () => {
  const result = evaluate(
    { to: ['a@mycompany.com', 'foo@bar.com'], cc: [], bcc: [], senderDomain: 'mycompany.com' },
    baseConfig
  );
  assert.equal(result.length, 1);
  assert.equal(result[0].id, 'multi-external');
  assert.equal(result[0].severity, 'warn');
  assert.deepEqual(result[0].externals, ['foo@bar.com']);
});

test('rule1: does not fire when BCC contains external (BCC is excluded from the count)', () => {
  const result = evaluate(
    { to: ['a@mycompany.com'], cc: [], bcc: ['foo@bar.com'], senderDomain: 'mycompany.com' },
    baseConfig
  );
  assert.equal(result.find(w => w.id === 'multi-external'), undefined);
});

test('rule1: respects custom threshold', () => {
  const config = {
    ...baseConfig,
    rules: {
      ...baseConfig.rules,
      multiRecipientWithExternal: { enabled: true, threshold: 3 }
    }
  };
  const twoRecipients = evaluate(
    { to: ['a@mycompany.com', 'foo@bar.com'], cc: [], bcc: [], senderDomain: 'mycompany.com' },
    config
  );
  assert.equal(twoRecipients.find(w => w.id === 'multi-external'), undefined);

  const threeRecipients = evaluate(
    { to: ['a@mycompany.com', 'foo@bar.com', 'b@mycompany.com'], cc: [], bcc: [], senderDomain: 'mycompany.com' },
    config
  );
  assert.equal(threeRecipients.find(w => w.id === 'multi-external').severity, 'warn');
});

test('rule1: domain match is case-insensitive', () => {
  const result = evaluate(
    { to: ['a@MyCompany.com', 'foo@BAR.com'], cc: [], bcc: [], senderDomain: 'mycompany.com' },
    baseConfig
  );
  assert.equal(result[0].externals.length, 1);
  assert.equal(result[0].externals[0].toLowerCase(), 'foo@bar.com');
});

test('rule1: subdomain is NOT implicitly internal', () => {
  const result = evaluate(
    { to: ['a@mycompany.com', 'b@eu.mycompany.com'], cc: [], bcc: [], senderDomain: 'mycompany.com' },
    baseConfig
  );
  assert.equal(result[0].externals[0], 'b@eu.mycompany.com');
});

test('rule1: disabled rule does not fire', () => {
  const config = {
    ...baseConfig,
    rules: {
      ...baseConfig.rules,
      multiRecipientWithExternal: { enabled: false, threshold: 2 }
    }
  };
  const result = evaluate(
    { to: ['a@mycompany.com', 'foo@bar.com'], cc: [], bcc: [], senderDomain: 'mycompany.com' },
    config
  );
  assert.equal(result.find(w => w.id === 'multi-external'), undefined);
});

const sensitiveConfig = {
  ...DEFAULTS,
  internalDomains: ['mycompany.com'],
  sensitiveAddresses: ['exec@mycompany.com', '*@list.mycompany.com']
};

test('rule2: no warning when sensitive present but no external', () => {
  const result = evaluate(
    { to: ['exec@mycompany.com', 'b@mycompany.com'], cc: [], bcc: [], senderDomain: 'mycompany.com' },
    sensitiveConfig
  );
  assert.equal(result.find(w => w.id === 'sensitive-mixed'), undefined);
});

test('rule2: no warning when external present but no sensitive', () => {
  const result = evaluate(
    { to: ['a@mycompany.com', 'foo@bar.com'], cc: [], bcc: [], senderDomain: 'mycompany.com' },
    sensitiveConfig
  );
  assert.equal(result.find(w => w.id === 'sensitive-mixed'), undefined);
});

test('rule2: fires when sensitive in To and external in CC', () => {
  const result = evaluate(
    { to: ['exec@mycompany.com'], cc: ['foo@bar.com'], bcc: [], senderDomain: 'mycompany.com' },
    sensitiveConfig
  );
  const w = result.find(x => x.id === 'sensitive-mixed');
  assert.ok(w);
  assert.equal(w.severity, 'block');
  assert.deepEqual(w.offenders.sensitive, ['exec@mycompany.com']);
  assert.deepEqual(w.offenders.external, ['foo@bar.com']);
});

test('rule2: fires when external is in BCC (BCC counted for rule 2)', () => {
  const result = evaluate(
    { to: ['exec@mycompany.com'], cc: [], bcc: ['foo@bar.com'], senderDomain: 'mycompany.com' },
    sensitiveConfig
  );
  assert.ok(result.find(w => w.id === 'sensitive-mixed'));
});

test('rule2: glob *@list.mycompany.com matches team@list.mycompany.com', () => {
  const result = evaluate(
    { to: ['team@list.mycompany.com', 'foo@bar.com'], cc: [], bcc: [], senderDomain: 'mycompany.com' },
    sensitiveConfig
  );
  const w = result.find(x => x.id === 'sensitive-mixed');
  assert.ok(w);
  assert.deepEqual(w.offenders.sensitive, ['team@list.mycompany.com']);
});

test('rule2: sensitive match is case-insensitive', () => {
  const result = evaluate(
    { to: ['Exec@MyCompany.com'], cc: ['foo@bar.com'], bcc: [], senderDomain: 'mycompany.com' },
    sensitiveConfig
  );
  assert.ok(result.find(w => w.id === 'sensitive-mixed'));
});

test('rule2: disabled rule does not fire', () => {
  const config = {
    ...sensitiveConfig,
    rules: {
      ...sensitiveConfig.rules,
      sensitiveMixedWithExternal: { enabled: false }
    }
  };
  const result = evaluate(
    { to: ['exec@mycompany.com'], cc: ['foo@bar.com'], bcc: [], senderDomain: 'mycompany.com' },
    config
  );
  assert.equal(result.find(w => w.id === 'sensitive-mixed'), undefined);
});

test('rules: both rules can fire simultaneously', () => {
  const result = evaluate(
    { to: ['exec@mycompany.com', 'foo@bar.com'], cc: [], bcc: [], senderDomain: 'mycompany.com' },
    sensitiveConfig
  );
  assert.ok(result.find(w => w.id === 'multi-external'));
  assert.ok(result.find(w => w.id === 'sensitive-mixed'));
});

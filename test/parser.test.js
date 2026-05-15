import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { JSDOM } from 'jsdom';
import { parseCompose } from '../content/parser.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

function loadFixture(name) {
  const html = readFileSync(join(__dirname, 'fixtures', name), 'utf8');
  return new JSDOM(`<!DOCTYPE html><html><body>${html}</body></html>`).window.document;
}

function dialog(doc) {
  return doc.querySelector('[role="dialog"]');
}

test('parser: extracts To/CC from email attributes (basic)', () => {
  const doc = loadFixture('compose-basic.html');
  const parsed = parseCompose(dialog(doc));
  assert.deepEqual(parsed.to, ['alice@mycompany.com', 'bob@bar.com']);
  assert.deepEqual(parsed.cc, ['carol@mycompany.com']);
  assert.deepEqual(parsed.bcc, []);
});

test('parser: falls back to data-hovercard-id when email attribute missing', () => {
  const doc = loadFixture('compose-hovercard.html');
  const parsed = parseCompose(dialog(doc));
  assert.deepEqual(parsed.to, ['alice@mycompany.com']);
});

test('parser: falls back to hidden inputs when aria-labels absent', () => {
  const doc = loadFixture('compose-hidden-input.html');
  const parsed = parseCompose(dialog(doc));
  assert.deepEqual(parsed.to, ['alice@mycompany.com', 'bob@bar.com']);
  assert.deepEqual(parsed.cc, []);
  assert.deepEqual(parsed.bcc, ['dave@mycompany.com']);
});

test('parser: non-English aria-label still works via hidden input fallback', () => {
  const doc = loadFixture('compose-non-english.html');
  const parsed = parseCompose(dialog(doc));
  assert.deepEqual(parsed.to, ['alice@mycompany.com', 'bob@bar.com']);
});

test('parser: returns empty arrays when dialog has no recipients', () => {
  const dom = new JSDOM('<!DOCTYPE html><html><body><div role="dialog"></div></body></html>');
  const parsed = parseCompose(dialog(dom.window.document));
  assert.deepEqual(parsed, { to: [], cc: [], bcc: [], senderDomain: null });
});

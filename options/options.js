import { getConfig, setConfig } from '../shared/storage.js';

const $ = id => document.getElementById(id);

function linesFromTextarea(el) {
  return el.value.split('\n').map(s => s.trim()).filter(Boolean);
}

function textareaFromLines(arr) {
  return arr.join('\n');
}

async function load() {
  const config = await getConfig();
  $('internalDomains').value = textareaFromLines(config.internalDomains);
  $('sensitiveAddresses').value = textareaFromLines(config.sensitiveAddresses);
  $('rule1Enabled').checked = config.rules.multiRecipientWithExternal.enabled;
  $('rule1Threshold').value = config.rules.multiRecipientWithExternal.threshold;
  $('rule2Enabled').checked = config.rules.sensitiveMixedWithExternal.enabled;
}

async function save() {
  const next = {
    internalDomains: linesFromTextarea($('internalDomains')),
    sensitiveAddresses: linesFromTextarea($('sensitiveAddresses')),
    rules: {
      multiRecipientWithExternal: {
        enabled: $('rule1Enabled').checked,
        threshold: Math.max(2, Number($('rule1Threshold').value) || 2)
      },
      sensitiveMixedWithExternal: {
        enabled: $('rule2Enabled').checked
      }
    }
  };
  await setConfig(next);
  $('status').textContent = 'Saved';
  setTimeout(() => { $('status').textContent = ''; }, 1500);
}

$('save').addEventListener('click', save);
load();

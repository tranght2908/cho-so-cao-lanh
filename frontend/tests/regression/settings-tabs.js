const assert = require('assert');
const path = require('path');
const { createApp } = require('./harness');

const h = createApp(path.resolve(__dirname, '../..'));
const A = h.A;
const rulesBefore = JSON.stringify(A.SERVICE_CFG.rules());

// A stale local UI state must not render the retired tab or mutate its legacy config.
A.ui.settingsTab = 'quytac';
let html = A.VIEWS['cai-dat']();
assert.equal(A.ui.settingsTab, 'kythu', 'legacy quytac state falls back to Kỳ thu');
assert(html.includes('Kỳ thu'), 'Kỳ thu remains available');
assert(!html.includes('Quy tắc thu phí'), 'retired tab label is absent');
assert(!html.includes('Cho phép điều chỉnh khoản phải thu'), 'retired fee-rule panel is absent');
assert.equal(JSON.stringify(A.SERVICE_CFG.rules()), rulesBefore, 'legacy fee-rule data is not changed');

['kythu', 'vaitro', 'tichhop', 'nhatky'].forEach(tab => {
  h.act('settings-tab', { id: tab });
  assert.equal(A.ui.settingsTab, tab, 'active tab switches to ' + tab);
  html = A.VIEWS['cai-dat']();
  assert(!html.includes('Quy tắc thu phí'), 'retired tab stays absent after switching to ' + tab);
});
h.act('settings-tab', { id: 'quytac' });
assert.equal(A.ui.settingsTab, 'kythu', 'delegated legacy tab action safely falls back');
console.log('settings-tabs: OK');

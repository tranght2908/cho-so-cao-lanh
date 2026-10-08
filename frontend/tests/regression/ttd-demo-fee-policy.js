/* Regression: loading the prototype must not seed default fee policies for a market. */
const assert = require('assert');
const path = require('path');
const { createApp } = require('./harness');

const ROOT = path.resolve(__dirname, '../..');
const h = createApp(ROOT), A = h.A, C = A.SERVICE_CFG;
const demo = () => ['stallPrices', 'utilities', 'extraServices'].flatMap(cat => C.list(cat).filter(x => x.source === 'prototype-demo'));

assert.strictEqual(demo().length, 0, 'fresh load does not create demo/default price records');

const saved = JSON.stringify(C.data());
const h2 = createApp(ROOT, { storage: { 'choso-caolanh-state': h.localStorage.getItem('choso-caolanh-state'), [C.KEY]: saved } });
assert.strictEqual(['stallPrices', 'utilities', 'extraServices'].flatMap(cat => h2.A.SERVICE_CFG.list(cat).filter(x => x.source === 'prototype-demo')).length, 0, 'reload does not seed demo/default price records');
assert.strictEqual(h2.A.features.lifecycle.service.marketFeeStatus('TTD').key, A.features.lifecycle.service.marketFeeStatus('TTD').key, 'reload only derives status from persisted own records');

console.log('ttd-demo-fee-policy regression PASS');

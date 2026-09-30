/* P1: no runtime demo contamination; trader notifications come from A.db.notifications. */
const assert = require('assert');
const path = require('path');
const { createApp } = require('./harness');
const ROOT = path.resolve(__dirname, '../..');
const TRADER_ROOT = path.join(ROOT, 'tieu-thuong');
let passed = 0;
const ok = (name, fn) => { try { fn(); passed++; } catch (e) { e.message = name + ': ' + e.message; throw e; } };

const management = createApp(ROOT);
const A = management.A, phone = '0987123456';
ok('management runtime does not load or execute trader demo seed/link', () => {
  assert(!management.scripts.some(src => src.endsWith('trader-web/demo-seed.js')));
  assert.strictEqual(typeof A.traderWebDemoSeed, 'undefined');
  assert.strictEqual(typeof A.ensureMiniAppDemoLink, 'undefined');
  assert(!A.ACCOUNTS.list().some(a => a.demoSeed === 'trader-web-demo'));
});
ok('management sidebar has no legacy trader section or portal menu', () => {
  assert(!A.MENU.some(g => g.group === 'Dành cho tiểu thương'));
  assert.strictEqual(A.menuItem('mini-app'), null);
});

const TS = A.features.traders.service;
const tCL = TS.create({ id: 'TT-P1-CL', name: 'P1 CL', phone, idNo: 'P1-CL', idType: 'CCCD', market: 'CL', stalls: [], source: 'STAFF', since: A.U.today(), app: false });
const tTTD = TS.create({ id: 'TT-P1-TTD', name: 'P1 TTD', phone, idNo: 'P1-TTD', idType: 'CCCD', market: 'TTD', stalls: [], source: 'STAFF', since: A.U.today(), app: false });
const tOther = TS.create({ id: 'TT-P1-OTHER', name: 'P1 Other', phone: '0987999999', idNo: 'P1-OTHER', idType: 'CCCD', market: 'CL', stalls: [], source: 'STAFF', since: A.U.today(), app: false });
A.ACCOUNTS.add({ id: 'AC-P1', code: 'P1', fullName: tCL.name, phone, roleIds: ['trader'], marketScopes: [], status: 'ACTIVE', traderIds: [tCL.id], traderId: tCL.id });
A.ACCOUNTS.linkTraderProfile('AC-P1', tTTD.id);
A.addTraderNotification({ kind: 'RECEIVABLE_CREATED', traderId: tCL.id, market: 'CL', referenceId: 'PT-P1-CL', title: 'P1 only CL', body: 'CL only', eventKey: 'p1-cl' });
A.addTraderNotification({ kind: 'RECEIVABLE_CREATED', traderId: tTTD.id, market: 'TTD', referenceId: 'PT-P1-TTD', title: 'P1 only TTD', body: 'TTD only', eventKey: 'p1-ttd' });
A.addTraderNotification({ kind: 'RECEIVABLE_CREATED', traderId: tOther.id, market: 'CL', referenceId: 'PT-P1-OTHER', title: 'P1 other trader', body: 'must stay private', eventKey: 'p1-other' });
A.addTraderNotification({ kind: 'INCIDENT_STATUS', traderId: tCL.id, market: 'CL', referenceId: 'SC-P1', title: 'P1 incident complete', body: 'done', eventKey: 'p1-incident' });
A.save();

const trader = createApp(TRADER_ROOT, { localStorage: management.localStorage });
const T = trader.A;
const html = () => trader.el('#tw-root').innerHTML || '';
T.IN['tw-phone']({ value: phone }); trader.act('tw-lookup'); T.IN['tw-otp']({ value: '123456' }); trader.act('tw-verify');
trader.act('merchant-nav', { id: 'notice' });
ok('active CL profile sees only its targeted finance/incident notifications', () => {
  assert(html().includes('P1 only CL'));
  assert(html().includes('P1 incident complete'));
  assert(!html().includes('P1 only TTD'));
  assert(!html().includes('P1 other trader'));
});
T.CH['mini-profile']({ value: tTTD.id }); trader.act('merchant-nav', { id: 'notice' });
ok('multi-profile switch scopes notifications by active trader profile', () => {
  assert(html().includes('P1 only TTD'));
  assert(!html().includes('P1 only CL'));
  assert(!html().includes('P1 other trader'));
});
ok('trader web stays independent of demo seed and renders canonical sidebar', () => {
  assert(!trader.scripts.some(src => src.endsWith('trader-web/demo-seed.js')));
  assert(/merchant-sidebar/.test(html()));
});
console.log(`shared-notifications-p1 regression PASS (${passed} checks)`);

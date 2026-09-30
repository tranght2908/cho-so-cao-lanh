const assert = require('assert');
const path = require('path');
const { createApp } = require('./harness');

const root = path.resolve(__dirname, '../..');
const h = createApp(root), A = h.A;
const BP = A.features.businessPoints.service, TS = A.features.traders.service, CS = A.features.contracts.service;
const manager = A.ACCOUNTS.get('AC-NV01');
const collector = A.ACCOUNTS.list().find(a => A.ACCOUNTS.primaryRole(a) === 'collector' && A.allowedMarkets(a).includes('CL'));
let passed = 0;
const ok = (label, fn) => { try { fn(); passed++; } catch (error) { error.message = label + ': ' + error.message; throw error; } };
const login = (account, market) => { A.ui.sessionAccountId = account.id; A.ui.market = market; A.syncAccountContext(); };
const addDays = (day, days) => new Date(Date.parse(day) + days * 86400000).toISOString().slice(0, 10);
const syncPointFields = point => { const row = BP.row(point), building = BP.building(point), floor = BP.floor(point); h.input('#wf-ct-building', building.id); if (floor) h.input('#wf-ct-floor', floor.id); h.input('#wf-ct-row', row.id); h.input('#wf-ct-areaType', point.areaTypeId); h.input('#wf-ct-point', point.id); };

assert(manager && collector, 'seed has canonical manager and collector');
// Isolated HA hierarchy/point with a matching policy lets this regression exercise selected-market behavior.
A.db.buildings.push({ id: 'T5-HA-B', market: 'HA', code: 'T5B', name: 'Nhà test HA', status: 'active' });
A.db.rows.push({ id: 'T5-HA-R', market: 'HA', buildingId: 'T5-HA-B', floorId: null, code: 'T5', name: 'Dãy test', industry: 'Khác', allocatedArea: 10, status: 'active' });
A.db.stalls.push({ id: 'T5-HA-P', code: 'T5-HA-01', market: 'HA', rowId: 'T5-HA-R', area: 5, areaTypeId: 'covered', status: 'active' });
const policy = A.SERVICE_CFG.list('stallPrices').find(x => x.marketId === 'CL' && x.status === 'active');
A.SERVICE_CFG.add('stallPrices', Object.assign({}, policy, { marketId: 'HA', stallType: 'Khác', effectiveFrom: '2020-01-01', effectiveTo: null, status: 'active' }), 'test');
A.reindex();

login(manager, 'HA');
let createdTrader;
ok('A02 selected HA creates a HA trader with no point/collector fields', () => {
  h.act('tt-new');
  A.IN['wf-p-name']({ value: 'Tiểu thương Task 5' });
  A.IN['wf-p-phone']({ value: '0977000005' });
  A.IN['wf-p-idno']({ value: '087700000005' });
  A.IN['wf-p-address']({ value: 'Hòa An' });
  h.act('wf-profile-save');
  createdTrader = A.db.traders.at(-1);
  assert.strictEqual(createdTrader.market, 'HA');
  assert(!('collectorId' in createdTrader) && !('rowId' in createdTrader) && !('industry' in createdTrader));
  assert.strictEqual(TS.deriveBusinessStatus(createdTrader), TS.BUSINESS_STATUS.WAITING_ALLOCATION);
});
ok('pending worklist is manager-owned, derived, and opens the locked canonical form', () => {
  h.act('wf-contract-worklist');
  assert(h.view().includes(createdTrader.id) && /data-act="wf-contract-open"/.test(h.view()));
  h.act('wf-contract-open', { id: createdTrader.id });
  assert(h.modal().includes(createdTrader.id) && !/id="wf-ct-trader"/.test(h.modal()));
  assert(!/NV thu phí phụ trách|NV phụ trách Dãy|collectorId/.test(h.modal()));
});
ok('contract selector is constrained to the trader market and does not use row collector assignment', () => {
  h.input('#wf-ct-start', A.U.today()); h.input('#wf-ct-end', addDays(A.U.today(), 30));
  A.features.contracts.form.pickPoint('T5-HA-P');
  syncPointFields(A.idx.stall.get('T5-HA-P'));
  assert(h.modal().includes('T5-HA-01'));
  assert(!h.modal().includes('CL-HS-A01'));
});
ok('save rejects a cross-market point even if a stale selection bypasses the UI', () => {
  const point = A.idx.stall.get('T5-HA-P'), before = A.db.contracts.length;
  point.market = 'CL';
  h.act('wf-contract-save');
  assert.strictEqual(A.db.contracts.length, before);
  assert(h.trace.toasts.at(-1).includes('cùng một chợ'), h.trace.toasts.at(-1));
  point.market = 'HA'; A.reindex();
});
ok('same-market available point creates a contract without creating receivables', () => {
  const invoices = A.db.invoices.length;
  h.act('wf-contract-save');
  const contract = A.db.contracts.at(-1);
  assert.strictEqual(contract.traderId, createdTrader.id);
  assert.strictEqual(contract.businessPointId, 'T5-HA-P');
  assert.strictEqual(contract.market, 'HA');
  assert.strictEqual(A.db.invoices.length, invoices);
  assert.strictEqual(TS.deriveBusinessStatus(createdTrader), TS.BUSINESS_STATUS.ACTIVE);
  assert.strictEqual(A.pointDisplayStatus(A.idx.stall.get('T5-HA-P')), 'thue');
});
ok('trader with only ended history is inactive, not a persisted artificial status', () => {
  const ended = { id: 'T5-ENDED', name: 'Đã ngừng', phone: '0977000006', idNo: '087700000006', market: 'HA', stalls: [] };
  A.db.traders.push(ended);
  A.db.contracts.push({ id: 'HD-T5-ENDED', traderId: ended.id, businessPointId: 'T5-HA-P', stallId: 'T5-HA-P', market: 'HA', start: '2020-01-01', end: '2020-02-01', status: 'hieuluc' });
  A.reindex();
  assert.strictEqual(TS.deriveBusinessStatus(ended), TS.BUSINESS_STATUS.INACTIVE);
  assert(!('businessStatus' in ended));
});
ok('A03 has no create CTAs and direct create actions are denied by RBAC', () => {
  login(collector, 'CL'); h.go('tieu-thuong');
  assert(!/data-act="tt-new"/.test(h.view()));
  const tradersBefore = A.db.traders.length, contractsBefore = A.db.contracts.length;
  A.closeModal(); h.act('tt-new'); h.act('wf-profile-save'); h.act('ct-new'); h.act('wf-contract-open', { id: createdTrader.id }); h.act('wf-contract-save');
  assert.strictEqual(A.db.traders.length, tradersBefore);
  assert.strictEqual(A.db.contracts.length, contractsBefore);
  assert(!/data-act="wf-contract-save"/.test(h.modal()));
});
ok('trader account provisioning/login data remains untouched', () => {
  assert.strictEqual(A.ACCOUNTS.byPhone('0900000001').id, 'AC-NV01');
  assert(!A.ACCOUNTS.list().some(a => a.traderId === createdTrader.id));
});

console.log(`trader-contract-market-workflow regression PASS (${passed} checks)`);

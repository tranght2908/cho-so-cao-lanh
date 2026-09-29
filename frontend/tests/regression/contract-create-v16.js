/* Contract-create v16: hierarchy IDs, multiple contracts per Trader and manager-only creation. */
const assert = require('assert');
const path = require('path');
const { createApp } = require('./harness');
const root = path.resolve(__dirname, '../..');
const addDays = (d, n) => new Date(Date.parse(d) + n * 86400000).toISOString().slice(0, 10);
let passed = 0;
const ok = (label, fn) => { try { fn(); passed++; } catch (e) { e.message = label + ': ' + e.message; throw e; } };
const login = (A, id, market) => { A.ui.sessionAccountId = id; A.ui.market = market; A.syncAccountContext(); };

const h = createApp(root), A = h.A;
const BP = A.features.businessPoints.service, CS = A.features.contracts.service;
const manager = A.ACCOUNTS.list().find(a => A.ACCOUNTS.primaryRole(a) === 'market_manager' && A.allowedMarkets(a).includes('CL'));
const collector = A.ACCOUNTS.list().find(a => A.ACCOUNTS.primaryRole(a) === 'collector' && a.status === 'active' && A.allowedMarkets(a).includes('CL'));
const point = A.db.stalls.find(p => p.market === 'CL' && BP.isAvailable(p.id, A.U.today(), addDays(A.U.today(), 30)));
const row = BP.row(point), floor = BP.floor(point), building = BP.building(point);
const trader = A.db.traders.find(t => t.market === 'CL');
assert(manager && collector && point && row && building && trader, 'seed has manager, collector and v16 graph fixture');

function mirrorPointSelection(p) {
  const r = BP.row(p), f = BP.floor(p), b = BP.building(p);
  A.features.contracts.form.pickPoint(p.id);
  h.input('#wf-ct-building', b.id);
  if (f) h.input('#wf-ct-floor', f.id);
  h.input('#wf-ct-row', r.id);
  h.input('#wf-ct-point', p.id);
}

login(A, manager.id, 'CL');
ok('fixed-trader entry renders v16 selectors using IDs', () => {
  h.act('wf-contract-open', { id: trader.id });
  const modal = h.modal();
  assert(!/id="wf-ct-trader"/.test(modal));
  assert(/id="wf-ct-building"/.test(modal) && /id="wf-ct-row"/.test(modal) && /id="wf-ct-point"/.test(modal));
  assert(!/Khu \*/.test(modal) && /Khối\/Nhà/.test(modal));
});

ok('menu entry uses the same form with an editable Trader selector', () => {
  h.go('hop-dong'); h.act('ct-new');
  assert(/id="wf-ct-trader"/.test(h.modal()));
  assert(/id="wf-ct-building"/.test(h.modal()) && /data-act="wf-contract-save"/.test(h.modal()));
  h.act('wf-contract-open', { id: trader.id });
});

ok('form selection stores Building/Floor/Row/Point IDs and supports a floorless building', () => {
  const p = point;
  h.input('#wf-ct-start', A.U.today()); h.input('#wf-ct-end', addDays(A.U.today(), 30));
  mirrorPointSelection(p);
  assert(h.modal().includes(`option value="${p.id}" selected`));
  assert(h.modal().includes(`option value="${building.id}" selected`));
  if (floor) assert(h.modal().includes(`option value="${floor.id}" selected`));
  const floorless = A.db.stalls.find(x => x.market === 'CL' && BP.building(x) && !BP.floor(x));
  if (floorless) {
    A.features.contracts.form.pickPoint(floorless.id);
    assert(!/id="wf-ct-floor"/.test(h.modal()), 'no fake Floor control for a floorless building');
  }
});

ok('trader candidates include traders that already have a current contract', () => {
  const active = A.db.contracts.find(c => c.market === 'CL' && CS.presentationStatus(c) === 'current');
  assert(active && CS.tradersForCreate('CL').some(t => t.id === active.traderId));
});

ok('derived presentation lifecycle is date-aware without persisting expired status', () => {
  const today = A.U.today();
  assert.strictEqual(CS.presentationStatus({ status: 'hieuluc', start: addDays(today, 1), end: addDays(today, 5) }), 'upcoming');
  assert.strictEqual(CS.presentationStatus({ status: 'hieuluc', start: addDays(today, -5), end: addDays(today, -1) }), 'expired');
  assert.strictEqual(CS.presentationStatus({ status: 'chamdut', start: today, end: today }), 'terminated');
});

ok('collector cannot open or save a contract, regardless of legacy Row assignment', () => {
  login(A, collector.id, 'CL');
  const before = A.db.contracts.length;
  h.act('wf-contract-open', { id: trader.id });
  h.act('wf-contract-save');
  assert.strictEqual(A.db.contracts.length, before);
});

console.log(`contract-create-v16 regression PASS (${passed} checks)`);

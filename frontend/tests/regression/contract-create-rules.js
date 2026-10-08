/* Focused regression: business rules of contract creation that the retired legacy-form tests used to cover
 * (contract-create-popup, contract-create-v16, trader-contract-market-workflow, trader-contract-point, pending-worklist),
 * re-expressed on the ONLY current flow: Hồ sơ tiểu thương (rentalDraft) → màn Hợp đồng (contracts/workspace).
 *  R1 save-time revalidation: an overlap created after the form was opened blocks the whole batch (atomic).
 *  R2 RBAC: the collector has no create CTA and every entry/handler refuses, even when called directly.
 *  R3 market scope: a manager scoped to CL cannot create in another market.
 *  R4 one trader may hold several contracts (an existing current contract does not block a new point).
 *  R5 creating a contract creates no receivable / invoice / billing draft and never touches the trader account.
 *  R6 no persisted work items / pending keys; no trader.collectorId; no Row-collector dependency in the contract flow.
 *  R7 idempotent: submitting again (double click) never creates a second contract. */
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { createApp } = require('./harness');

const ROOT = path.resolve(__dirname, '../..');
let passed = 0;
const ok = (label, fn) => { try { fn(); passed++; } catch (e) { e.message = label + ': ' + e.message; throw e; } };
const login = (A, id, market) => { A.ui.sessionAccountId = id; A.ui.currentDemoAccountId = id; A.ui.market = market; A.syncAccountContext(); };

const h = createApp(ROOT), A = h.A;
const TS = A.features.traders.service, BP = A.features.businessPoints.service, CS = A.features.contracts.service;
const today = A.U.today(), add = n => { const d = new Date(today + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
const free = () => BP.availablePoints('CL', today, add(400)).filter(p => { const x = CS.rentalPriceTerms({ charges: { land: true } }, p, today); return x && x.land; });
const ws = () => A.ui.contractWs;
const mk = (id, phone) => { assert(TS.create({ id, name: 'Hồ sơ ' + id, phone, idType: 'CCCD', idNo: 'RULE-' + id, address: 'Khóm 1', market: 'CL', stalls: [], status: 'WAITING_ALLOCATION', source: 'STAFF', since: today })); return TS.getProfile(id); };
const register = (t, pts) => assert(TS.setRentalDraft(t.id, pts.map(p => ({ pointId: p.id, charges: { land: true }, feeRefs: {} })).concat(TS.rentalItems(t).filter(x => x.status === 'contracted'))));
const openForm = t => { h.go('hop-dong'); A.closeModal(); h.act('ct-new', { trader: t.id }); assert(ws().create && ws().create.traderId === t.id, 'form open'); };
const dates = (pointId, s, e) => { A.CH['ctw-row']({ dataset: { id: pointId, k: 'start' }, value: s }); A.CH['ctw-row']({ dataset: { id: pointId, k: 'end' }, value: e }); };
login(A, 'AC-NV01', 'CL');

ok('R1 overlap created after the form was opened → blocked at save, nothing written', () => {
  const t = mk('RULE-R1', '0977400001'), [p1, p2] = free();
  register(t, [p1, p2]); openForm(t);
  dates(p1.id, today, add(200)); dates(p2.id, today, add(200));
  // Another profile gets p2 contracted meanwhile (same canonical use case).
  const other = mk('RULE-R1B', '0977400002'); register(other, [p2]);
  assert(CS.createFromRentalDraft(other.id, [{ pointId: p2.id, start: add(100), end: add(300) }]).ok, 'competing contract');
  const before = JSON.stringify([A.db.contracts.length, BP.get(p1.id).usageStatus, TS.rentalItems(t.id)]);
  h.act('ctw-submit');
  assert.strictEqual(JSON.stringify([A.db.contracts.length, BP.get(p1.id).usageStatus, TS.rentalItems(t.id)]), before, 'whole batch refused (p1 not created either)');
  assert(/trùng thời gian|không còn khả dụng/.test(ws().create.errors[p2.id].message), 'error bound to the overlapping row');
  h.act('ctw-cancel');
});
ok('R2 collector: no create CTA, entries and direct handler calls refused', () => {
  const t = mk('RULE-R2', '0977400003'), [p] = free(); register(t, [p]);
  login(A, 'AC-NV02', 'CL');
  assert(!A.canDo('hop-dong.tao', 'CL'), 'fixture: collector has no hop-dong.tao');
  h.go('hop-dong');
  assert(!/data-act="ct-new"/.test(h.view()), 'no + Tạo hợp đồng');
  A.ui.contractWs.create = null; A.closeModal();
  h.act('ct-new'); h.act('ct-new', { trader: t.id }); h.act('ctw-open-create', { id: t.id });
  assert(!ws().create && !/ctw-pick-trader/.test(h.modal()), 'no form / selector');
  // A stale draft (e.g. left by another session) cannot be submitted by the collector.
  A.ui.contractWs.create = { traderId: t.id, market: 'CL', rows: [{ pointId: p.id, selected: true, start: today, end: add(30) }], errors: {}, tried: false };
  const n = A.db.contracts.length;
  h.act('ctw-submit');
  assert.strictEqual(A.db.contracts.length, n, 'handler refuses');
  A.ui.contractWs.create = null; login(A, 'AC-NV01', 'CL');
});
ok('R3 market scope: a manager scoped to CL cannot create in TTD', () => {
  const h3 = createApp(ROOT), A3 = h3.A;
  A3.ACCOUNTS.get('AC-NV01').marketScopes = ['CL'];
  login(A3, 'AC-NV01', 'CL');
  assert(!A3.allowedMarkets(A3.currentAccount()).includes('TTD'));
  // Trying to switch to TTD (stale state / URL): the account context keeps ui.market inside the scope, so every
  // market-bound action (A.canDo with targetMarket) is evaluated against CL, never TTD.
  A3.ui.market = 'TTD'; A3.syncAccountContext();
  assert.notStrictEqual(A3.ui.market, 'TTD', 'selected market falls back into the account scope');
  assert(!A3.canDo('hop-dong.tao', 'TTD'), 'no create right on a TTD record');
  // A TTD profile with a pending point is never offered / opened from the CL context.
  const tTTD = A3.features.traders.service.list().find(t => t.market === 'TTD');
  const pTTD = A3.features.businessPoints.service.availablePoints('TTD', today, add(30))[0];
  assert(tTTD && pTTD, 'fixture: TTD profile + free TTD point');
  assert(A3.features.traders.service.setRentalDraft(tTTD.id, [{ pointId: pTTD.id, charges: { land: true }, feeRefs: {} }]));
  h3.go('hop-dong'); A3.closeModal(); h3.act('ct-new');
  assert(!h3.modal().includes(tTTD.id), 'TTD profile not offered');
  h3.act('ct-new', { trader: tTTD.id });
  assert(!(A3.ui.contractWs && A3.ui.contractWs.create), 'TTD profile cannot be opened');
});
ok('R4 a trader with a current contract can get another point / contract', () => {
  const t = mk('RULE-R4', '0977400004'), [p1, p2] = free();
  register(t, [p1]);
  assert(CS.createFromRentalDraft(t.id, [{ pointId: p1.id, start: today, end: add(300) }]).ok);
  assert(CS.isActive(CS.listByTrader(t.id)[0]), 'fixture: current contract');
  register(t, [p2]);
  openForm(t); dates(p2.id, today, add(300)); h.act('ctw-submit');
  const cs = CS.listByTrader(t.id);
  assert.strictEqual(cs.length, 2); assert.strictEqual(new Set(cs.map(c => c.businessPointId)).size, 2, 'one point per contract');
  [p1, p2].forEach(p => assert.strictEqual(BP.get(p.id).traderId, t.id));
});
let created;
ok('R5 profile with an ACTIVE trader account: contract created, no receivable/invoice/draft, account + scopes untouched', () => {
  const t = TS.getProfile('TT0003'), acc = A.ACCOUNTS.byTraderId ? A.ACCOUNTS.byTraderId(t.id) : null;
  assert(acc && acc.status === 'ACTIVE', 'fixture: TT0003 has an ACTIVE account');
  const accBefore = JSON.stringify(acc), scopesBefore = JSON.stringify(A.ACCOUNTS.list().map(a => [a.id, a.marketScopes]));
  const money = () => JSON.stringify([(A.db.invoices || []).length, (A.db.billingDrafts || []).length, (A.db.receivables || []).length, (A.db.payments || []).length]);
  const moneyBefore = money(), [p] = free();
  register(t, [p]); openForm(t); dates(p.id, today, add(365)); h.act('ctw-submit');
  created = A.db.contracts.find(c => c.traderId === t.id && c.businessPointId === p.id);
  assert(created, 'contract created');
  assert.strictEqual(money(), moneyBefore, 'no financial record created by contract creation');
  assert.strictEqual(JSON.stringify(A.ACCOUNTS.byTraderId(t.id)), accBefore, 'trader account untouched');
  assert.strictEqual(JSON.stringify(A.ACCOUNTS.list().map(a => [a.id, a.marketScopes])), scopesBefore, 'marketScopes unchanged');
});
ok('R6 no persisted work items / pending keys, no trader.collectorId, no Row-collector dependency', () => {
  assert(!['pendingTraders', 'pendingContracts', 'workItems'].some(k => k in A.db), 'no persisted work items');
  assert(!Array.from(h.localStorage._m.keys()).some(k => /pending|workitem/i.test(k)), 'no pending-worklist storage key');
  assert(!A.db.traders.some(t => 'collectorId' in t), 'no trader.collectorId');
  ['src/features/contracts/service.js', 'src/features/contracts/workspace.js'].forEach(f => {
    assert(!/collectorCanUse|pointCollector|collectorId/.test(fs.readFileSync(path.join(ROOT, f), 'utf8')), f + ' has no Row collector dependency');
  });
});
ok('R7 idempotent: a second submit (double click) never creates another contract', () => {
  const t = mk('RULE-R7', '0977400007'), [p] = free(); register(t, [p]);
  openForm(t); dates(p.id, today, add(90));
  const n = A.db.contracts.length;
  h.act('ctw-submit'); h.act('ctw-submit');
  assert.strictEqual(A.db.contracts.length, n + 1);
  assert.strictEqual(CS.createFromRentalDraft(t.id, [{ pointId: p.id, start: today, end: add(90) }]).ok, false, 'service: item no longer pending');
  assert.strictEqual(A.db.contracts.length, n + 1);
});
console.log(`contract-create-rules regression PASS (${passed} checks)`);

/* Focused regression: effective market list (A.effectiveMarkets = D.MARKETS + custom catalog markets),
 * market scope decoding (A.allowedMarkets), topbar selector, layout readiness for a custom market. */
const assert = require('assert');
const path = require('path');
const { createApp } = require('./harness');
const root = path.resolve(__dirname, '../..');
let passed = 0;
const ok = (label, fn) => { try { fn(); passed++; } catch (e) { e.message = label + ': ' + e.message; throw e; } };
const IDS = ['CL', 'TTD', 'HA', 'TVH', 'TTT', 'TL', 'TT', 'TTH', 'MN', 'LH', 'XB', 'SQ'];
const use = (A, id, market) => { A.ui.sessionAccountId = id; if (market) A.ui.market = market; A.syncAccountContext(); };

// Stored state from before this change: persisted selectedMarket 'TTD', and a catalog that (defensively)
// contains a duplicate builtin id — must not produce duplicates.
const catalog = JSON.stringify([{ id: 'CL', code: 'CL', rank: 'HANG_1', status: 'active' }, { id: 'CL', code: 'CL', rank: 'HANG_1', status: 'active' }]);
const h = createApp(root, { storage: { 'choso-caolanh-marketcatalog': catalog } }), A = h.A;
const MC = A.features.markets.service, S = A.features.marketLayout.store;
const accountsBefore = h.localStorage.getItem('choso-caolanh-accounts');
const permsBefore = h.localStorage.getItem('choso-caolanh-permissions');
const layoutBefore = h.localStorage.getItem('choso-caolanh-layout');
const admin = 'AC-QT01', leader = 'AC-LD01';
const manager = A.ACCOUNTS.list().find(a => A.ACCOUNTS.primaryRole(a) === 'market_manager' && (a.marketScopes || []).includes('CL'));
const ids = () => A.effectiveMarkets().map(m => m.id);

ok('1 twelve base markets, same ids, no duplicate', () => {
  assert.strictEqual(JSON.stringify(ids().slice().sort()), JSON.stringify(IDS.slice().sort()));
  assert.strictEqual(new Set(ids()).size, ids().length);
  assert.strictEqual(A.effectiveMarkets(), A.D.MARKETS, 'no custom → base array itself');
  assert.strictEqual(JSON.stringify(MC.effectiveMarkets().map(m => m.id)), JSON.stringify(ids()));
});
ok('2 old selectedMarket keeps working', () => {
  use(A, manager.id, 'CL');
  assert.strictEqual(A.ui.market, 'CL');
  h.go('mat-bang'); assert(/Mặt bằng/.test(h.view()));
  use(A, admin, 'TTD'); assert.strictEqual(A.ui.market, 'TTD');
});
let cid;
ok('3 custom market joins the effective list, once', () => {
  const r = MC.add({ name: 'Chợ Kiểm thử', address: 'Khóm 9', rank: 'HANG_3', priceConfigId: 'QD480_NHOM_CON_LAI', status: 'active', totalArea: 1000, businessArea: 600, capacityByAreaType: [] }, 'test');
  cid = r.id;
  assert(ids().includes(cid) && ids().length === 13 && new Set(ids()).size === 13);
  IDS.forEach(id => assert(ids().includes(id)));
  const m = A.U.market(cid);
  assert(m && m.isCustom && m.name === 'Chợ Kiểm thử' && S.rowsOf(cid).length === 0);
  assert.strictEqual(A.U.mShort(cid), 'Chợ Kiểm thử');
  assert.strictEqual(A.U.market(cid), A.U.market(cid), 'stable object');
  MC.update(cid, { name: 'Chợ Kiểm thử 2' }, 'test');
  assert.strictEqual(A.U.mShort(cid), 'Chợ Kiểm thử 2');
});
ok('4 admin and ward leader (scope ALL) see the custom market; no scope written', () => {
  [admin, leader].forEach(id => {
    use(A, id);
    assert(A.allowedMarkets(A.currentAccount()).includes(cid), id);
    assert(A.marketSelectOptionsHtml().includes(`value="${cid}"`), id + ' selector');
    assert.strictEqual(JSON.stringify(A.currentAccount().marketScopes), '["ALL"]');
  });
});
ok('5 restricted account does not see it and cannot switch to it', () => {
  use(A, manager.id, 'CL');
  assert(!A.allowedMarkets(manager).includes(cid));
  assert(!A.marketSelectOptionsHtml().includes(`value="${cid}"`));
  h.act('market', { id: cid }); assert.strictEqual(A.ui.market, 'CL');
  A.ui.market = cid; A.syncAccountContext(); assert.notStrictEqual(A.ui.market, cid, 'clamped back into scope');
  const restricted = A.ACCOUNTS.list().filter(a => !(a.marketScopes || []).includes('ALL'));
  assert(restricted.length && restricted.every(a => !(a.marketScopes || []).includes(cid)), 'no account got the new scope');
});
ok('6 custom market is a valid layout parent (empty, not persisted until a save)', () => {
  assert.strictEqual(S.blocksOf(cid).length, 0);
  assert(S.of(cid) && Array.isArray(S.of(cid).blocks));
  assert(!MC.layoutReady(cid));
  assert.strictEqual(S.blocksOf('NOPE').length, 0, 'unknown id tolerated');
  assert.strictEqual(S.rowsOf('NOPE').length, 0, 'unknown id has no layout');
  assert.strictEqual(h.localStorage.getItem('choso-caolanh-layout'), layoutBefore, 'legacy layout key untouched');
  // A manager given scope in memory only (not saved) can open Mặt bằng for it.
  const scoped = Object.assign({}, manager, { marketScopes: manager.marketScopes.concat([cid]) });
  assert(A.allowedMarkets(scoped).includes(cid));
});
// Every route renders for a custom market exactly as well as for an existing empty market (HA).
const routeErrors = (acc, market) => {
  const out = {};
  Object.keys(A.VIEWS).forEach(r => {
    use(A, acc, market);
    try { h.go(r); } catch (e) { out[r] = e.message; }
  });
  return out;
};
ok('7 all routes: custom market behaves like an existing empty market', () => {
  [admin, leader].forEach(acc => {
    const base = routeErrors(acc, 'HA'), custom = routeErrors(acc, cid);
    const extra = Object.keys(custom).filter(r => !base[r]);
    assert.deepStrictEqual(extra, [], acc + ' new route errors: ' + JSON.stringify(custom));
  });
  const orig = manager.marketScopes;
  manager.marketScopes = orig.concat(['HA', cid]); // in memory only, never saved
  try {
    const base = routeErrors(manager.id, 'HA'), custom = routeErrors(manager.id, cid);
    const extra = Object.keys(custom).filter(r => !base[r]);
    assert.deepStrictEqual(extra, [], 'manager new route errors: ' + JSON.stringify(custom));
    use(A, manager.id, cid); assert.strictEqual(A.ui.market, cid);
    h.go('mat-bang'); assert(h.view().includes('Chợ Kiểm thử 2'), 'Mặt bằng opens for custom market');
  } finally { manager.marketScopes = orig; }
});
ok('8 CL / TTD Mặt bằng unchanged', () => {
  use(A, manager.id, 'CL'); h.go('mat-bang'); assert(h.view().includes('Chợ Cao Lãnh'));
  assert(S.blocksOf('CL').length > 0 && S.blocksOf('TTD').length > 0);
});
ok('9 reload keeps the custom market; accounts, permissions, layout untouched', () => {
  const h2 = createApp(root, { storage: { 'choso-caolanh-marketcatalog': h.localStorage.getItem('choso-caolanh-marketcatalog') } });
  const ids2 = h2.A.effectiveMarkets().map(m => m.id);
  assert(ids2.includes(cid) && ids2.length === 13);
  assert.strictEqual(h.localStorage.getItem('choso-caolanh-accounts'), accountsBefore);
  assert.strictEqual(h.localStorage.getItem('choso-caolanh-permissions'), permsBefore);
  assert.strictEqual(h.localStorage.getItem('choso-caolanh-layout'), layoutBefore);
});
console.log(`effective-markets regression PASS (${passed} checks)`);

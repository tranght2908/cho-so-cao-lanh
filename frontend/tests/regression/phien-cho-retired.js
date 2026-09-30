/* Focused regression: module "Phiên chợ quê" đã bỏ khỏi Management Web (quyết định 30/09/2026).
 * Không còn menu/route/view/permission hiện hành; dữ liệu phiên cũ và quyền đã lưu KHÔNG bị xoá;
 * Chợ quê Cù lao Tân Thuận Đông (TTD) vẫn là 1 chợ bình thường. */
const assert = require('assert');
const path = require('path');
const { createApp } = require('./harness');

const ROOT = path.resolve(__dirname, '../..');
let passed = 0;
const ok = (label, fn) => { try { fn(); passed++; } catch (e) { e.message = label + ': ' + e.message; throw e; } };
const isSessionKey = k => k === 'screen:phien-cho' || k.indexOf('action:phien-cho.') === 0;

const h = createApp(ROOT);
const A = h.A;
const login = (id, market) => { A.ui.currentDemoAccountId = id; A.ui.sessionAccountId = id; if (market) A.ui.market = market; A.syncAccountContext(); };
const sessionData = () => JSON.stringify(['marketSessions', 'sessionRegistrations', 'sessionPayments', 'sessionReceipts', 'sessionReconExceptions'].map(k => A.db[k] || null));
const dataBefore = sessionData();

ok('8: sidebar has no "Phiên chợ quê"; Hạ tầng chợ = Mặt bằng chợ + Tài sản chợ', () => {
  assert(!A.menuItem('phien-cho'));
  const g = A.MENU.find(x => x.group === 'Điều hành');
  const i = g.items.findIndex(x => x.sub === 'Hạ tầng chợ');
  assert.strictEqual(JSON.stringify(g.items.slice(i + 1).filter(x => !x.hidden).map(x => x.id)), JSON.stringify(['mat-bang', 'tai-san']));
  ['AC-NV01', 'AC-NV07', 'AC-LD01'].forEach(id => {
    login(id, 'TTD'); h.go('mat-bang');
    const nav = h.el('#nav').innerHTML;
    assert(!nav.includes('phien-cho') && !nav.includes('Phiên chợ quê'), id);
  });
});

ok('9: current RBAC catalog has no Phiên chợ quê screen/actions; fresh seed grants none', () => {
  assert(!A.PERM.catalog().some(p => isSessionKey(p.key) || p.screenId === 'phien-cho'));
  assert(A.PERM.isRetiredPermission('screen:phien-cho'));
  const fresh = createApp(ROOT);
  const stored = JSON.parse(fresh.localStorage.getItem('choso-caolanh-permissions'));
  assert(!stored.rolePerms.some(r => isSessionKey(r.permKey)));
  login('AC-QT01'); h.go('cai-dat'); A.render();
  assert(!h.view().includes('Phiên chợ quê'));
});

ok('9b: persisted legacy grants are kept (no reset/overwrite), only hidden', () => {
  const base = createApp(ROOT);
  const stored = JSON.parse(base.localStorage.getItem('choso-caolanh-permissions'));
  stored.rolePerms.push({ roleId: 'market_manager', permKey: 'screen:phien-cho', grantedAt: 'seed', grantedBy: 'legacy' },
    { roleId: 'collector', permKey: 'action:phien-cho.diem-danh', grantedAt: 'seed', grantedBy: 'legacy' },
    { roleId: 'collector', permKey: 'screen:bao-cao', grantedAt: 'custom', grantedBy: 'test' });
  const before = stored.rolePerms.length;
  const again = createApp(ROOT, { storage: { 'choso-caolanh-permissions': JSON.stringify(stored) } });
  const P = again.A.PERM;
  assert(P.hasPerm('market_manager', 'screen:phien-cho') && P.hasPerm('collector', 'action:phien-cho.diem-danh'), 'legacy rows kept');
  assert(P.hasPerm('collector', 'screen:bao-cao'), 'custom grant kept');
  assert.strictEqual(JSON.parse(again.localStorage.getItem('choso-caolanh-permissions')).rolePerms.length, before);
  assert(!P.catalog().some(p => isSessionKey(p.key)));
  again.A.ui.currentDemoAccountId = 'AC-NV01'; again.A.ui.sessionAccountId = 'AC-NV01'; again.A.ui.market = 'TTD'; again.A.syncAccountContext();
  assert(!again.A.U.can('phien-cho'), 'a legacy grant cannot open the removed screen');
});

ok('10: legacy URL #/phien-cho never reopens the feature', () => {
  assert(!A.VIEWS['phien-cho'], 'market-sessions view is not loaded');
  assert(!h.scripts.some(s => s.indexOf('market-sessions') !== -1), 'market-sessions not loaded by index.html');
  [['AC-NV01', 'mat-bang'], ['AC-NV07', 'mat-bang']].forEach(([id, expected]) => {
    login(id, 'TTD'); h.go('phien-cho');
    assert.strictEqual(A.current, expected, id);
    assert(!h.view().includes('Phiên chợ quê được quản lý'), id);
  });
  login('AC-NV05'); h.go('phien-cho');
  assert.notStrictEqual(A.current, 'phien-cho');
  assert(!A.ACT['session-create'] && !A.ACT['reg-add-open'], 'session handlers not registered');
});

ok('11: Chợ quê Cù lao Tân Thuận Đông is still a normal Market', () => {
  const ttd = A.effectiveMarkets().find(m => m.id === 'TTD');
  assert(ttd && /Tân Thuận Đông/.test(ttd.name));
  assert.strictEqual(A.allowedMarkets({ marketScopes: ['ALL'] }).length, 12);
  assert(A.allowedMarkets({ marketScopes: ['ALL'] }).includes('TTD'));
  login('AC-NV01', 'TTD');
  assert.strictEqual(A.ui.market, 'TTD');
  assert(A.marketSelectOptionsHtml().includes('value="TTD"'));
});

ok('12: TTD keeps layout/trader/contract/finance/assignment', () => {
  login('AC-NV01', 'TTD');
  ['mat-bang', 'tieu-thuong', 'hop-dong', 'phai-thu', 'thu-tien', 'cong-no'].forEach(r => {
    h.go(r);
    assert.strictEqual(A.current, r, r);
    assert(h.view().length > 100 && !/Vui lòng chọn một chợ/.test(h.view()), r);
  });
  assert(A.db.stalls.some(s => s.market === 'TTD'));
  assert(A.db.traders.some(t => t.market === 'TTD'));
  assert(A.db.contracts.some(c => c.market === 'TTD'));
  const st = A.ACCOUNTS.marketCollectorState('TTD');
  assert.strictEqual(st.status, 'ASSIGNED');
  h.go('nhan-su-phan-cong');
  assert.strictEqual(A.current, 'nhan-su-phan-cong');
});

ok('13: legacy market-session data is not deleted', () => {
  assert((A.db.marketSessions || []).length > 0, 'seed still has sessions');
  assert.strictEqual(sessionData(), dataBefore);
  if (A.save) A.save();
  const persisted = JSON.parse(h.localStorage.getItem('choso-caolanh-state') || '{}');
  if (persisted && persisted.marketSessions) assert.strictEqual(JSON.stringify(persisted.marketSessions), JSON.stringify(A.db.marketSessions));
});

console.log(`phien-cho-retired regression PASS (${passed} checks)`);

/* Focused regression: màn "Nhân sự & phân công" (route nhan-su-phan-cong, features/staff-assignment).
 * MỘT bảng nhân sự + lọc Vai trò/Chợ/Phân công; KPI "Chợ chưa phân công" + popover chỉ đọc.
 * Nhân sự derive từ Account; phân công NV thu phí = Account.marketScopes qua A.ACCOUNTS.saveCollectorAccount. */
const assert = require('assert');
const path = require('path');
const { createApp } = require('./harness');

const ROOT = path.resolve(__dirname, '../..');
const SCREEN = 'nhan-su-phan-cong';
const PERM_KEYS = ['screen:' + SCREEN, 'action:' + SCREEN + '.xem-phan-cong', 'action:' + SCREEN + '.phan-cong', 'action:' + SCREEN + '.dieu-chuyen'];
let passed = 0;
const ok = (label, fn) => { try { fn(); passed++; } catch (e) { e.message = label + ': ' + e.message; throw e; } };
const eq = (actual, expected, msg) => assert.deepStrictEqual(JSON.parse(JSON.stringify(actual)), JSON.parse(JSON.stringify(expected)), msg);
const text = html => String(html || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');

const h = createApp(ROOT);
const A = h.A, S = A.features.staffAssignment.service;
const ch = (name, dataset, props) => { A.CH[name](Object.assign({ dataset: dataset || {} }, props || {})); h.flush(); };
const login = id => { A.ui.currentDemoAccountId = id; A.ui.sessionAccountId = id; A.syncAccountContext(); };
const scopes = id => Array.from(A.ACCOUNTS.get(id).marketScopes);
const persistedAccounts = () => JSON.parse(h.localStorage.getItem('choso-caolanh-accounts') || 'null') || A.ACCOUNTS.list();
// Bất biến: trong kho ĐÃ LƯU, không chợ nào có > 1 NV thu phí ACTIVE hiện hành (trừ xung đột cố ý dựng ở CASE 15).
function assertNoPersistedDuplicate() {
  const list = persistedAccounts().filter(a => (a.roleIds || [])[0] === 'collector' && A.ACCOUNTS.isActive(a));
  A.allowedMarkets({ marketScopes: ['ALL'] }).forEach(mid => assert(list.filter(a => (a.marketScopes || []).indexOf(mid) !== -1).length <= 1, 'duplicate current collector for ' + mid));
}
// Lọc bảng (giống thao tác người dùng) rồi trả về tbody; codes() = mã NV đang hiển thị.
function filter(f) {
  A.ACT['sa-clear']();
  if (f.search) A.IN['sa-search']({ value: f.search, dataset: {} });
  if (f.role) ch('sa-role', {}, { value: f.role });
  if (f.market) ch('sa-market', {}, { value: f.market });
  if (f.assign) ch('sa-assign', {}, { value: f.assign });
  const v = h.view(), start = v.indexOf('<tbody>');
  return v.slice(start, v.indexOf('</tbody>', start));
}
const codes = body => Array.from(body.matchAll(/<tr><td class="nowrap">([^<]+)<\/td>/g)).map(m => m[1]);
const staffRowHtml = code => filter({ search: code });
const kpiHtml = () => { const v = h.view(); return v.slice(v.indexOf('sa-kpis'), v.indexOf('sa-filters')); };
const history = () => JSON.stringify({ payments: A.db.payments, cash: A.db.cashHandovers || [], sp: A.db.sessionPayments || [], sr: A.db.sessionReceipts || [], bank: A.db.bank || [] });
const dbKeys = Object.keys(A.db).sort();

login('AC-NV01');
h.go(SCREEN);
const historyBefore = history();

ok('menu/RBAC: A02 has the screen in ĐIỀU HÀNH; no account-admin actions on this screen', () => {
  PERM_KEYS.forEach(k => assert(A.PERM.hasPerm('market_manager', k), k));
  assert.strictEqual(A.current, SCREEN);
  const g = A.MENU.find(x => x.group === 'Điều hành');
  eq(g.items.map(i => i.id || ('sub:' + i.sub)).slice(0, 4), ['tong-quan', 'danh-muc-cho', SCREEN, 'sub:Hạ tầng chợ']);
  assert(h.el('#nav').innerHTML.includes('href="#/' + SCREEN + '"'));
  assert(!/Thêm tài khoản/.test(h.view()));
});

ok('CASE 1 + 2: no tab switcher, no "Phân công theo chợ" table, no market-view handlers', () => {
  const v = h.view();
  assert(!v.includes('Theo nhân viên') && !v.includes('Theo chợ') && !v.includes('"sa-tab"') && !v.includes('sa-tabs'));
  assert(!v.includes('Phân công theo chợ') && !v.includes('Điều chuyển') && !v.includes('Trạng thái phân công'));
  ['sa-tab', 'sa-market-open', 'sa-market-save', 'sa-market-clear', 'sa-more', 'sa-view'].forEach(k => assert(!A.ACT[k], k));
  ['sa-market-search'].forEach(k => assert(!A.IN[k], k));
  ['sa-market-status', 'sa-market-target'].forEach(k => assert(!A.CH[k], k));
  // KPI → bộ lọc → bảng, liền nhau.
  assert(v.indexOf('sa-kpis') < v.indexOf('sa-filters') && v.indexOf('sa-filters') < v.indexOf('sa-table-card'));
  eq(Object.keys(A.ui.staffAssign).sort(), ['assign', 'market', 'role', 'search']);
});

ok('CASE 3: filter bar Search → Vai trò → Chợ → Phân công → Đặt lại; Chợ options = current markets', () => {
  const v = h.view(), bar = v.slice(v.indexOf('sa-filters'), v.indexOf('sa-table-card'));
  const order = ['data-in="sa-search"', 'data-ch="sa-role"', 'data-ch="sa-market"', 'data-ch="sa-assign"', 'data-act="sa-clear"'].map(x => bar.indexOf(x));
  assert(order.every(i => i > 0) && order.every((x, i) => !i || x > order[i - 1]), order.join(','));
  assert(bar.includes('Chợ: Tất cả'));
  const ids = A.allowedMarkets(A.currentAccount());
  assert.strictEqual(ids.length, 12);
  ids.forEach(id => assert(bar.includes('value="' + id + '"') && bar.includes(A.U.market(id).name), id));
});

ok('personnel: only current A02/A03/A04; KPIs derived from data', () => {
  A.ACCOUNTS.add({ id: 'TEST-SA-LEGACY-ACC', code: 'TEST-LEGACY-ACC', fullName: 'Legacy accountant', roleIds: ['market_accountant'], status: 'active', marketScopes: ['CL'] });
  const staff = S.staff();
  assert(staff.every(a => ['market_manager', 'collector', 'technician'].indexOf(A.ACCOUNTS.primaryRole(a)) !== -1 && A.ACCOUNTS.isCurrentOrganization(a)));
  ['AC-QT01', 'AC-KTTT01', 'AC-LD01', 'TEST-SA-LEGACY-ACC'].forEach(id => assert(!staff.some(a => a.id === id), id));
  const byRole = r => A.ACCOUNTS.currentList().filter(a => A.ACCOUNTS.primaryRole(a) === r).length;
  const sum = S.summary();
  assert.strictEqual(sum.staff, byRole('market_manager') + byRole('collector') + byRole('technician'));
  assert.strictEqual(sum.collectors, byRole('collector'));
  assert.strictEqual(sum.technicians, byRole('technician'));
  A.render();
  assert(text(h.view()).includes('Tổng nhân sự ' + sum.staff) && text(h.view()).includes('Tổ trưởng: Trần Minh Khoa'));
});

ok('CASE 11: 0 unassigned markets → KPI 0 / 12, not clickable', () => {
  A.render();
  const kpi = kpiHtml();
  assert.strictEqual(S.summary().unassigned, 0);
  assert(text(kpi).includes('Chợ chưa phân công 0 trên tổng 12 chợ'));
  assert(!kpi.includes('sa-coverage'));
});

ok('CASE 4 + 5 + 6: Chợ = Cao Lãnh → the current A03 covering CL; first market +N; popover lists all', () => {
  const owner = A.ACCOUNTS.getMarketCollector('CL');
  const body = filter({ market: 'CL' });
  eq(codes(body), [owner.code]);
  const markets = S.collectorMarkets(owner);
  assert(markets.length > 1 && body.includes(A.U.market(markets[0]).name) && body.includes('+' + (markets.length - 1)));
  eq(codes(filter({ role: 'collector', market: 'CL' })), [owner.code]);
  eq(codes(filter({ search: owner.fullName.split(' ').pop(), market: 'CL' })), [owner.code]);
  eq(codes(filter({ search: owner.fullName.split(' ').pop(), market: 'SQ' })), A.ACCOUNTS.getMarketCollector('SQ').id === owner.id ? [owner.code] : []);
  h.act('sa-scope', { id: owner.id });
  const pop = text(h.modal());
  assert(pop.includes('Các chợ đang phụ trách') && pop.includes(markets.length + ' chợ'));
  markets.forEach(id => assert(pop.includes(A.U.market(id).name), id));
  assert(!h.modal().includes('sa-assign'), 'popover is read-only');
  A.closeModal();
});

ok('CASE 13 + 14: A04 "Theo sự cố được giao", no action; a Market filter never makes A04 an owner', () => {
  const tech = S.staff().find(a => A.ACCOUNTS.primaryRole(a) === 'technician');
  eq(Array.from(tech.marketScopes), ['ALL']);
  const row = staffRowHtml(tech.code);
  assert(row.includes('Theo sự cố được giao') && !row.includes('Toàn bộ') && !row.includes('data-act=') && row.includes('<span class="muted">—</span>'));
  A.allowedMarkets(A.currentAccount()).forEach(mid => {
    assert(!codes(filter({ market: mid })).includes(tech.code), mid);
    assert.strictEqual(codes(filter({ role: 'technician', market: mid })).length, 0, mid);
    assert(!codes(filter({ market: mid })).includes('NV01'), 'A02 not matched by a market: ' + mid);
  });
  ['assigned', 'unassigned'].forEach(x => assert(!codes(filter({ assign: x })).includes(tech.code), 'A04 not in Phân công=' + x));
  eq(codes(filter({ role: 'technician' })).length, S.summary().technicians);
  assert.strictEqual(S.saveCollectorMarkets(tech.id, ['CL']).reason, 'NOT_COLLECTOR');
});

ok('CASE 7: ACTIVE A03 with [] → "Chưa được phân công" + one "Phân công" button; Phân công filter finds it', () => {
  const saved = A.ACCOUNTS.saveCollectorAccount({ id: 'AC-TEST-SA-NEW', code: 'NVT1', fullName: 'Phan Thị Lan Anh', phone: '0911111111', roleIds: ['collector'], status: 'active', marketScopes: [] });
  assert(saved.ok);
  const row = staffRowHtml('NVT1');
  assert(row.includes('Chưa được phân công') && !row.includes('Chợ Cao Lãnh'));
  assert.strictEqual((row.match(/data-act="sa-assign-open"/g) || []).length, 1);
  eq(codes(filter({ role: 'collector', assign: 'unassigned' })), ['NVT1']);
  assert(!codes(filter({ assign: 'assigned' })).includes('NVT1'));
  // KPI chợ chưa phân công vẫn 0 dù có NV chưa được phân công — hai chỉ số khác nghĩa.
  assert.strictEqual(S.summary().unassigned, 0);
  const nv01 = staffRowHtml('NV01');
  assert(nv01.includes('Quản lý Tổ · 12 chợ') && !nv01.includes('data-act='));
});

ok('CASE 12: 2 unassigned markets → KPI 2 / 12, click shows exactly those 2 (read-only popover)', () => {
  const nv02 = A.ACCOUNTS.get('AC-NV02');
  const drop = S.collectorMarkets(nv02).filter(id => id !== 'CL').slice(-2);
  h.act('sa-assign-open', { id: 'AC-NV02' });
  drop.forEach(id => ch('sa-assign-toggle', { id }, { checked: false }));
  h.act('sa-assign-save');
  assert(text(h.modal()).includes('không còn nhân viên thu phí phụ trách'), 'removal asks confirmation');
  h.act('sa-assign-confirm');
  drop.forEach(id => assert.strictEqual(S.marketState(id).status, 'UNASSIGNED', id));
  A.render();
  const kpi = kpiHtml();
  assert(text(kpi).includes('Chợ chưa phân công 2 trên tổng 12 chợ') && kpi.includes('data-act="sa-coverage"'));
  h.act('sa-coverage', {});
  const m = h.modal(), pop = text(m);
  assert(m.includes('acc-scope-popover') && !m.includes('class="modal'), 'popover, not a modal');
  assert(pop.includes('Chợ chưa có NV thu phí phụ trách') && pop.includes('2 / 12 chợ chưa được phân công'));
  drop.forEach(id => assert(pop.includes(A.U.market(id).name), id));
  assert.strictEqual((m.match(/<b>/g) || []).length, 2, 'exactly 2 markets listed');
  assert(!m.includes('sa-assign') && !m.includes('data-act="sa-conflict-open"'), 'read-only');
  A.closeModal();
});

ok('CASE 8: "Phân công" NVT1 → takes an unassigned market, persisted in Account.marketScopes', () => {
  const target = S.marketStates().find(st => st.status === 'UNASSIGNED').marketId;
  h.act('sa-assign-open', { id: 'AC-TEST-SA-NEW' });
  const m = text(h.modal());
  assert(m.includes('Phân công chợ') && m.includes('Chưa có nhân viên phụ trách') && m.includes('Hiện do'));
  ch('sa-assign-toggle', { id: target }, { checked: true });
  h.act('sa-assign-save');
  eq(scopes('AC-TEST-SA-NEW'), [target]);
  assert(persistedAccounts().find(a => a.id === 'AC-TEST-SA-NEW').marketScopes.includes(target));
  eq(codes(filter({ market: target })), ['NVT1']);
  assertNoPersistedDuplicate();
});

ok('CASE 9: reassign from the Phân công popup NV02 → NV03 (confirm text, atomic, idempotent)', () => {
  assert(scopes('AC-NV02').includes('CL'));
  h.act('sa-assign-open', { id: 'AC-NV03' });
  ch('sa-assign-toggle', { id: 'CL' }, { checked: true });
  h.act('sa-assign-save');
  const m = text(h.modal());
  assert(m.includes('Chợ Cao Lãnh hiện đang được phân công cho:') && m.includes('Lê Thị Ngọc Hân (NV02)'));
  assert(m.includes('Nếu tiếp tục, chợ sẽ được điều chuyển sang:') && m.includes('Phạm Văn Lợi (NV03)') && m.includes('Xác nhận điều chuyển'));
  assert(scopes('AC-NV02').includes('CL'), 'nothing persisted before confirmation');
  let writes = 0;
  const set = h.localStorage.setItem;
  h.localStorage.setItem = (k, v) => { if (k === 'choso-caolanh-accounts') writes++; return set(k, v); };
  h.act('sa-assign-confirm');
  h.act('sa-assign-confirm');
  h.localStorage.setItem = set;
  assert.strictEqual(writes, 1, 'one persisted account write');
  assert(!scopes('AC-NV02').includes('CL') && scopes('AC-NV03').filter(x => x === 'CL').length === 1);
  eq(codes(filter({ market: 'CL' })), ['NV03']);
  assert.strictEqual(S.assignMarket('TTD', 'AC-NV02', { confirmTransfer: false }).reason, 'TRANSFER_REQUIRED', 'no silent overwrite');
  assertNoPersistedDuplicate();
});

ok('CASE 10: historical payments/receipts/handovers unchanged', () => assert.strictEqual(history(), historyBefore));

ok('CASE 15: legacy duplicate ACTIVE collectors → detected, not auto-resolved, assignment blocked until resolved', () => {
  const M = S.collectorMarkets(A.ACCOUNTS.get('AC-NV02'))[0];
  A.ACCOUNTS.update('AC-NV03', { marketScopes: scopes('AC-NV03').concat([M]) });
  const snapshot = h.localStorage.getItem('choso-caolanh-accounts');
  A.ACT['sa-clear']();
  assert.strictEqual(A.ACCOUNTS.getMarketCollector(M), null);
  assert(text(kpiHtml()).includes('1 xung đột') && kpiHtml().includes('sa-coverage'));
  const rows = filter({ market: M });
  eq(codes(rows).sort(), ['NV02', 'NV03']);
  assert(rows.includes('Xung đột'));
  assert.strictEqual(h.localStorage.getItem('choso-caolanh-accounts'), snapshot, 'rendering never persists a correction');
  assert.strictEqual(S.saveCollectorMarkets('AC-NV02', S.collectorMarkets(A.ACCOUNTS.get('AC-NV02')).concat(['LH']), { confirmTransfer: true }).reason, 'TARGET_CONFLICT');
  h.act('sa-assign-open', { id: 'AC-TEST-SA-NEW' });
  assert(new RegExp('data-id="' + M + '"[^>]*disabled').test(h.modal()), 'conflicted market cannot be picked');
  h.act('sa-assign-open', { id: 'AC-NV02' });
  assert(h.modal().includes('data-act="sa-assign-save" disabled'));
  A.closeModal();
  h.act('sa-coverage', {});
  assert(text(h.modal()).includes('Xung đột phân công') && h.modal().includes('data-act="sa-conflict-open" data-id="' + M + '"'));
  h.act('sa-conflict-open', { id: M });
  h.act('sa-conflict-save');
  assert(scopes('AC-NV02').includes(M) && scopes('AC-NV03').includes(M), 'no keeper chosen → nothing written');
  ch('sa-conflict-keeper', {}, { value: 'AC-NV03' });
  h.act('sa-conflict-save');
  assert(!scopes('AC-NV02').includes(M) && scopes('AC-NV03').includes(M));
  assert.strictEqual(S.marketState(M).status, 'ASSIGNED');
  assertNoPersistedDuplicate();
});

ok('PENDING/LOCKED A03: disabled "Phân công", cannot receive assignments', () => {
  A.ACCOUNTS.add({ id: 'AC-TEST-SA-PEND', code: 'NVT2', fullName: 'Trần Chờ Kích Hoạt', phone: '0911111112', roleIds: ['collector'], status: 'PENDING_ACTIVATION', marketScopes: [] });
  A.ACCOUNTS.add({ id: 'AC-TEST-SA-LOCK', code: 'NVT3', fullName: 'Lê Tạm Khóa', phone: '0911111113', roleIds: ['collector'], status: 'LOCKED', marketScopes: ['CL'] });
  ['AC-TEST-SA-PEND', 'AC-TEST-SA-LOCK'].forEach(id => {
    assert.strictEqual(S.saveCollectorMarkets(id, ['SQ'], { confirmTransfer: true }).reason, 'NOT_ACTIVE', id);
    assert(!S.eligibleCollectors().some(a => a.id === id), id);
  });
  const pend = staffRowHtml('NVT2');
  assert(pend.includes('Chưa kích hoạt') && pend.includes('disabled') && !pend.includes('data-act="sa-assign-open"'));
  assert(staffRowHtml('NVT3').includes('Tạm khóa'));
  assert(!codes(filter({ market: 'CL' })).includes('NVT3'), 'LOCKED persisted scope is not a current owner');
  h.act('sa-assign-open', { id: 'AC-TEST-SA-PEND' });
  assert(!h.modal().includes('sa-assign-save'));
});

ok('no Market.collectorId / staff store / assignment store created', () => {
  eq(Object.keys(A.db).sort(), dbKeys);
  assert(A.effectiveMarkets().every(m => !('collectorId' in m)) && A.D.MARKETS.every(m => !('collectorId' in m)));
  const keys = Array.from(h.localStorage._m.keys());
  assert(!keys.some(k => /staff|assign|personnel|nhan-su/i.test(k)), keys.join(','));
  assert(persistedAccounts().every(a => !('collectorId' in a)));
});

ok('RBAC: denied roles do not see the menu/route; handlers guarded; dynamic revoke works', () => {
  ['AC-NV02', 'AC-NV05', 'AC-QT01', 'AC-LD01', 'AC-KTTT01'].forEach(id => {
    login(id); h.go(SCREEN);
    assert(!A.U.can(SCREEN) && A.current !== SCREEN && !h.el('#nav').innerHTML.includes('#/' + SCREEN), id);
  });
  login('AC-NV02');
  const before = scopes('AC-TEST-SA-NEW');
  assert.strictEqual(S.saveCollectorMarkets('AC-TEST-SA-NEW', ['CL'], { confirmTransfer: true }).reason, 'FORBIDDEN');
  assert.strictEqual(S.resolveConflict('CL', 'AC-NV03').reason, 'FORBIDDEN');
  h.act('sa-assign-open', { id: 'AC-TEST-SA-NEW' });
  assert(!h.modal().includes('sa-assign-save'));
  eq(scopes('AC-TEST-SA-NEW'), before);
  login('AC-NV01');
  A.PERM.revoke('market_manager', 'action:' + SCREEN + '.dieu-chuyen');
  h.go(SCREEN);
  assert.strictEqual(A.current, SCREEN);
  assert.strictEqual(S.assignMarket('CL', 'AC-NV02', { confirmTransfer: true }).reason, 'FORBIDDEN');
  A.PERM.revoke('market_manager', 'screen:' + SCREEN);
  h.go(SCREEN);
  assert.notStrictEqual(A.current, SCREEN);
  assert.strictEqual(S.saveCollectorMarkets('AC-TEST-SA-NEW', [], {}).reason, 'FORBIDDEN');
});

ok('RBAC migration for stored permission state (additive, idempotent, respects revokes)', () => {
  const base = createApp(ROOT);
  const stored = JSON.parse(base.localStorage.getItem('choso-caolanh-permissions'));
  stored.rolePerms = stored.rolePerms.filter(r => PERM_KEYS.indexOf(r.permKey) === -1);
  delete stored.staffAssignmentPermVersion;
  stored.rolePerms.push({ roleId: 'collector', permKey: 'screen:bao-cao', grantedAt: 'custom', grantedBy: 'test' });
  stored.rolePerms = stored.rolePerms.filter(r => !(r.roleId === 'market_manager' && r.permKey === 'screen:mat-bang'));
  const migrated = createApp(ROOT, { storage: { 'choso-caolanh-permissions': JSON.stringify(stored) } });
  const P = migrated.A.PERM;
  PERM_KEYS.forEach(k => {
    assert(P.hasPerm('market_manager', k), k);
    ['system_admin', 'ward_leader', 'collector', 'technician', 'central_accountant', 'trader'].forEach(r => assert(!P.hasPerm(r, k), r + ' ' + k));
  });
  assert(P.hasPerm('collector', 'screen:bao-cao') && !P.hasPerm('market_manager', 'screen:mat-bang'));
  P.revoke('market_manager', 'screen:' + SCREEN);
  const again = createApp(ROOT, { storage: { 'choso-caolanh-permissions': migrated.localStorage.getItem('choso-caolanh-permissions') } });
  assert(!again.A.PERM.hasPerm('market_manager', 'screen:' + SCREEN), 'revoked grant is not re-seeded');
  assert(again.A.PERM.hasPerm('market_manager', 'action:' + SCREEN + '.dieu-chuyen'));
});

console.log(`staff-assignment regression PASS (${passed} checks)`);

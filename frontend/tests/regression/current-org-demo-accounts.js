/* Focused regression: current-organization demo account set (1 Tổ Quản lý chợ chung, 12 chợ).
 * A01 Admin · A02 Tổ trưởng · 3×A03 NV thu phí · 3×A04 NV kỹ thuật · A05 Kế toán Trung tâm · A08 Lãnh đạo
 * + Tiểu thương demo. Không còn A06 Kế toán phường / market_accountant trong mô hình hiện hành.
 * Legacy/retired records persisted in localStorage are kept but excluded from the current organization. */
const assert = require('assert');
const path = require('path');
const { createApp } = require('./harness');

const ROOT = path.resolve(__dirname, '../..');
let passed = 0;
const ok = (label, fn) => { try { fn(); passed++; } catch (e) { e.message = label + ': ' + e.message; throw e; } };
const eq = (actual, expected, msg) => assert.deepStrictEqual(JSON.parse(JSON.stringify(actual)), expected, msg);
const role = (A, a) => A.ACCOUNTS.primaryRole(a);
const currentBy = (A, roleId) => A.ACCOUNTS.currentList().filter(a => role(A, a) === roleId && A.ACCOUNTS.isActive(a));
const LEGACY_MANAGERS = ['AC-NV06', 'AC-HA-QL', 'AC-TVH-QL', 'AC-TTT-QL', 'AC-TL-QL', 'AC-TT-QL', 'AC-TTH-QL', 'AC-MN-QL', 'AC-LH-QL', 'AC-XB-QL', 'AC-SQ-QL'];

function checkFinalModel(A, tag) {
  const allIds = A.allowedMarkets({ marketScopes: ['ALL'] });
  const t = label => tag + ' · ' + label;
  ok(t('exactly one canonical manager with ALL scope'), () => {
    const m = currentBy(A, 'market_manager');
    eq(m.map(a => a.id), ['AC-NV01']);
    eq(Array.from(m[0].marketScopes), ['ALL']);
  });
  ok(t('exactly 3 active collectors, every Market has at most one, one collector has several Markets'), () => {
    const c = currentBy(A, 'collector');
    eq(c.map(a => a.code).sort(), ['NV02', 'NV03', 'NV07']);
    allIds.forEach(mid => {
      const st = A.ACCOUNTS.marketCollectorState(mid);
      assert.notStrictEqual(st.status, 'CONFLICT', mid);
      assert.strictEqual(A.ACCOUNTS.getMarketCollectors(mid).length <= 1, true, mid);
    });
    assert(c.every(a => A.allowedMarkets(a).length > 1));
    // 12 Markets thực tế trong D.MARKETS, mỗi Market đúng 1 NV hiện hành.
    A.D.MARKETS.forEach(m => assert(A.ACCOUNTS.getMarketCollector(m.id), m.id));
  });
  ok(t('exactly 3 active technicians, assignment not by Market'), () => {
    const tech = currentBy(A, 'technician');
    eq(tech.map(a => a.code).sort(), ['HA-KT', 'NV05', 'NV09']);
    eq(A.ACCOUNTS.currentTechnicians().map(a => a.code).sort(), ['HA-KT', 'NV05', 'NV09']);
  });
  ok(t('exactly one central accountant with ALL scope; no ward accountant / market accountant current'), () => {
    const kt = currentBy(A, 'central_accountant');
    eq(kt.map(a => a.id), ['AC-KTTT01']);
    eq(Array.from(kt[0].marketScopes), ['ALL']);
    assert.strictEqual(A.ACCOUNTS.currentList().filter(a => ['ward_accountant', 'market_accountant'].includes(role(A, a))).length, 0);
  });
  ok(t('exactly one ward leader and one admin, both ALL'), () => {
    eq(currentBy(A, 'ward_leader').map(a => a.id), ['AC-LD01']);
    eq(currentBy(A, 'system_admin').map(a => a.id), ['AC-QT01']);
    ['AC-LD01', 'AC-QT01'].forEach(id => eq(Array.from(A.ACCOUNTS.get(id).marketScopes), ['ALL']));
  });
  ok(t('trader availability derives only from linked profiles; unlinked provisioning accounts have no market'), () => {
    const tr = A.ACCOUNTS.currentList().filter(a => role(A, a) === 'trader');
    assert(tr.length >= 2);
    tr.forEach(a => eq(A.allowedMarkets(a), A.ACCOUNTS.traderMarketsOf(a), a.id));
    const unlinked = A.ACCOUNTS.get('AC-TT-TTD');
    assert(unlinked, 'seed keeps the unlinked provisioning account');
    eq(A.ACCOUNTS.traderIdsOf(unlinked), []);
    eq(A.allowedMarkets(unlinked), []);
  });
  ok(t('no duplicate account ids'), () => {
    const ids = A.ACCOUNTS.list().map(a => a.id);
    assert.strictEqual(new Set(ids).size, ids.length);
  });
}

// ---------- 1) Fresh seed ----------
const fresh = createApp(ROOT);
checkFinalModel(fresh.A, 'fresh');

ok('A06/market_accountant are not current roles or actors', () => {
  const A = fresh.A;
  const current = A.PERM.currentRoles().map(r => r.id);
  assert(!current.includes('ward_accountant') && !current.includes('market_accountant'));
  assert(!(A.D.ACTORS || []).some(a => a.id === 'A06' || a.roleId === 'ward_accountant'));
});
ok('A05 has reconciliation permissions through RBAC', () => {
  const A = fresh.A;
  ['screen:doi-soat', 'action:doi-soat.xem-tien-mat', 'action:doi-soat.xac-nhan-phieu-nop', 'screen:theo-doi-ky-doi-soat', 'action:theo-doi-ky-doi-soat.xac-nhan-hoan-tat']
    .forEach(k => assert(A.PERM.hasPerm('central_accountant', k), k));
  assert(!A.PERM.hasPerm('market_accountant', 'action:doi-soat.xac-nhan-phieu-nop'), 'fresh seed grants nothing to legacy role');
});
const A05_VIEW_EXPORT = ['screen:phai-thu', 'action:phai-thu.xem-toan-cho', 'screen:thu-tien', 'screen:cong-no', 'screen:bao-cao',
  'action:doi-soat.xem-ngan-hang', 'action:doi-soat.xem-truy-vet', 'action:doi-soat.xuat-excel', 'action:cong-no.xuat-excel', 'action:bao-cao.xuat-excel', 'action:bao-cao.xuat-pdf-in'];
const A05_DENIED = ['action:thu-tien.thu', 'action:thu-tien.chot-buoi', 'action:phai-thu.phat-hanh', 'action:phai-thu.mien-giam', 'action:phai-thu.yeu-cau-dieu-chinh',
  'action:doi-soat.gan-thu-cong', 'action:doi-soat.xac-nhan-nop-quy', 'action:cong-no.nhac-no', 'action:cong-no.nhac-no-hang-loat', 'action:cong-no.thu-no',
  'action:bao-cao.luu-mau', 'screen:tai-khoan', 'screen:cai-dat'];
// SCREEN_ACCESS_BY_ACTOR (30/09/2026): A05 được VÀO màn 'Chính sách thu và biểu phí' (không kèm quyền thao tác nào).
ok('A05 can view/export accounting data but has no write/admin permission', () => {
  const A = fresh.A;
  A05_VIEW_EXPORT.forEach(k => assert(A.PERM.hasPerm('central_accountant', k), k));
  A05_DENIED.forEach(k => assert(!A.PERM.hasPerm('central_accountant', k), k));
  A.ui.sessionAccountId = 'AC-KTTT01'; A.ui.currentDemoAccountId = 'AC-KTTT01'; A.ui.market = 'CL'; A.syncAccountContext();
  ['phai-thu', 'thu-tien', 'cong-no', 'bao-cao', 'doi-soat', 'theo-doi-ky-doi-soat'].forEach(v => {
    assert(A.U.can(v), v);
    assert.strictEqual(typeof A.VIEWS[v](), 'string', v + ' renders');
  });
  assert(!A.canDo('thu-tien.thu', 'CL') && !A.canDo('cong-no.nhac-no', 'CL') && !A.canDo('phai-thu.phat-hanh', 'CL'));
});
// SCREEN_ACCESS_BY_ACTOR (30/09/2026): A04 được VÀO 'Tài sản chợ' (màn này chỉ áp dụng Chợ Cao Lãnh), vẫn KHÔNG có Mặt bằng.
ok('technician has no Mặt bằng screen despite compatibility scope ALL; Tài sản chợ granted', () => {
  const A = fresh.A;
  assert(!A.PERM.hasPerm('technician', 'screen:mat-bang'));
  assert(A.PERM.hasPerm('technician', 'screen:tai-san'));
  A.ui.sessionAccountId = 'AC-NV05'; A.ui.currentDemoAccountId = 'AC-NV05'; A.ui.market = 'TTT'; A.syncAccountContext();
  assert(!A.U.can('mat-bang') && !A.U.can('tai-san'), 'tai-san only applicable at CL');
  A.ui.market = 'CL'; A.syncAccountContext();
  assert(!A.U.can('mat-bang') && A.U.can('tai-san'));
  A.ui.market = 'TTT'; A.syncAccountContext();
  assert(A.U.can('su-co'));
});
ok('collector route screen (Thu tiền) renders — meId regression', () => {
  const A = fresh.A;
  A.ui.sessionAccountId = 'AC-NV02'; A.ui.currentDemoAccountId = 'AC-NV02'; A.ui.market = 'CL'; A.syncAccountContext();
  assert.strictEqual(typeof A.VIEWS['thu-tien'](), 'string');
  assert.strictEqual(typeof A.VIEWS['phai-thu'](), 'string');
});

// ---------- 2) Screen: role/scope presentation, KPI, form ----------
ok('accounts screen presents scopes and KPI from current list', () => {
  const h = fresh, A = h.A;
  A.ui.sessionAccountId = 'AC-QT01'; A.ui.currentDemoAccountId = 'AC-QT01'; A.syncAccountContext();
  A.ui.acc = { search: '', type: 'all', role: '', market: '', status: '', viewMode: 'ACCOUNTS' };
  const cur = A.ACCOUNTS.currentList();
  const html = A.VIEWS['tai-khoan']();
  const kpi = label => { const m = html.match(new RegExp(label + '</div><div class="k-value">(\\d+)')); return m && Number(m[1]); };
  assert.strictEqual(kpi('Tổng tài khoản'), cur.length);
  assert.strictEqual(kpi('Đang hoạt động'), cur.filter(a => A.ACCOUNTS.authStatus(a) === 'ACTIVE').length);
  assert.strictEqual(kpi('Tạm khóa'), cur.filter(a => A.ACCOUNTS.authStatus(a) === 'LOCKED').length);
  assert(!/Kế toán phường|Kế toán Ban Quản lý chợ/.test(html), 'legacy accountant roles not offered');
  assert(html.includes('Theo sự cố được giao'));
  assert(!html.includes('class="tag warn" title="Có'), 'no conflict warning for valid data');
  A.ACT['acc-edit']({ dataset: { id: 'AC-NV05' } });
  assert(h.modal().includes('Theo sự cố được giao'));
  A.closeModal();
  A.ACT['acc-edit']({ dataset: { id: 'AC-KTTT01' } });
  assert(h.modal().includes('Toàn bộ ' + A.allowedMarkets({ marketScopes: ['ALL'] }).length + ' chợ'));
  A.closeModal();
});

// ---------- 3) A05 performs the reconciliation workflow via RBAC ----------
ok('A05 logs in and reconciles a cash handover in any Market', () => {
  const h = fresh, A = h.A;
  const kt = A.ACCOUNTS.get('AC-KTTT01');
  assert.strictEqual(A.ACCOUNTS.authStatus(kt), 'ACTIVE');
  A.ui.sessionAccountId = kt.id; A.ui.currentDemoAccountId = kt.id; A.ui.market = 'HA'; A.syncAccountContext();
  assert.strictEqual(A.currentAccount().id, 'AC-KTTT01');
  assert(A.U.can('doi-soat') && A.canDo('doi-soat.xac-nhan-phieu-nop', 'HA'));
  const today = A.U.today();
  A.db.cashHandovers = A.db.cashHandovers || [];
  A.db.cashHandovers.push({ id: 'PN-TEST-A05', kind: 'FEE', market: 'HA', marketId: 'HA', collectorId: 'AC-NV02', collectorCode: 'NV02', collectorName: 'Lê Thị Ngọc Hân', date: today, paymentIds: [], amount: 300000, status: 'SUBMITTED', submittedAt: A.U.dmy(today) + ' 08:00' });
  A.ui.dsTab = 'tien-mat';
  A.ACT['ho-view']({ dataset: { id: 'PN-TEST-A05' } });
  A.$('#ho-received').value = '300000';
  A.ACT['ho-reconcile']({ dataset: { id: 'PN-TEST-A05', mode: 'match' } });
  const ho = A.db.cashHandovers.find(x => x.id === 'PN-TEST-A05');
  assert.strictEqual(ho.status, 'MATCHED');
  assert.strictEqual(ho.confirmedByCode, 'KTTT01');
  assert.strictEqual(ho.collectorCode, 'NV02', 'historical actor untouched');
  assert(A.U.can('theo-doi-ky-doi-soat') && A.canDo('theo-doi-ky-doi-soat.xac-nhan-hoan-tat', 'HA'), 'A05 period reconciliation');
});

ok('collector (denied role) cannot confirm a cash handover', () => {
  const A = fresh.A;
  A.ui.sessionAccountId = 'AC-NV02'; A.ui.currentDemoAccountId = 'AC-NV02'; A.ui.market = 'HA'; A.syncAccountContext();
  assert.strictEqual(A.canDo('doi-soat.xac-nhan-phieu-nop', 'HA'), false);
  assert.strictEqual(A.canDo('theo-doi-ky-doi-soat.xac-nhan-hoan-tat', 'HA'), false);
});

// ---------- 4) Incident assignment by Incident.assignee, any Market ----------
ok('manager can assign any current technician to an incident of any Market', () => {
  const h = fresh, A = h.A;
  A.ui.sessionAccountId = 'AC-NV01'; A.ui.currentDemoAccountId = 'AC-NV01'; A.ui.market = 'HA'; A.syncAccountContext();
  const st = A.db.stalls.find(s => s.market === 'CL');
  const inc = { id: 'SC-TEST-HA', market: 'HA', stallId: st.id, traderId: st.traderId, cat: 'Điện', title: 'Test', desc: '', photo: false, state: 'tiepnhan', created: A.U.today(), deadline: A.U.today(), source: 'Test', log: [], history: [] };
  A.db.incidents.push(inc);
  A.ACT['inc-assign-open']({ dataset: { id: inc.id } });
  const modal = h.modal();
  ['NV05', 'NV09', 'HA-KT'].forEach(code => assert(modal.includes('value="' + code + '"'), code));
  assert(!modal.includes('value="NV06"'), 'legacy manager is not a candidate');
  A.$('#ia-assignee').value = 'NV05'; A.$('#ia-cat').value = 'Điện'; A.$('#ia-asset').value = ''; A.$('#ia-note').value = '';
  A.$('#ia-due').value = A.U.today() + 'T16:00';
  A.ACT['inc-assign-save']({ dataset: { id: inc.id } });
  assert.strictEqual(inc.assignee, 'NV05');
  A.ui.sessionAccountId = 'AC-NV05'; A.ui.currentDemoAccountId = 'AC-NV05'; A.ui.market = 'HA'; A.syncAccountContext();
  assert.strictEqual(A.ui.market, 'HA');
  assert(A.features.complaints.canView(inc), 'assigned technician can open the incident in HA');
  assert.strictEqual(A.U.staffName('HA-KT'), 'Lê Văn Bình');
});

// ---------- 5) Legacy persisted state: migration + reload ----------
function legacyStorage() {
  const src = createApp(ROOT);
  const ls = src.localStorage;
  const accounts = JSON.parse(ls.getItem('choso-caolanh-accounts') || JSON.stringify(src.A.ACCOUNTS.list()));
  const byId = new Map(accounts.map(a => [a.id, a]));
  const put = a => { byId.set(a.id, a); };
  const staffOrg = 'Ban Quản lý Chợ Cao Lãnh';
  ['AC-NV02', 'AC-NV03', 'AC-NV05'].forEach(id => Object.assign(byId.get(id), { marketScopes: ['CL'], organization: staffOrg }));
  Object.assign(byId.get('AC-NV07'), { marketScopes: ['TTD'], organization: 'Ban Quản lý Chợ quê Tân Thuận Đông' });
  Object.assign(byId.get('AC-NV09'), { marketScopes: ['TTD'], organization: 'Ban Quản lý Chợ quê Tân Thuận Đông' });
  Object.assign(byId.get('AC-HA-KT'), { marketScopes: ['HA'], organization: 'Ban Quản lý Chợ Hòa An' });
  byId.forEach(a => { delete a.currentOrgDemoVersion; });
  put({ id: 'AC-NV04', code: 'NV04', fullName: 'Nguyễn Thị Diễm', phone: '0900000004', accountType: 'Nhân viên thu phí', title: 'Nhân viên thu phí', roleIds: ['collector'], organization: staffOrg, marketScopes: ['CL'], status: 'active', traderId: null });
  put({ id: 'AC-HA-TP', code: 'HA-TP', fullName: 'Trần Thị Ngọc An', phone: '0911000002', accountType: 'Nhân viên thu phí', title: 'Nhân viên thu phí', roleIds: ['collector'], organization: 'Ban Quản lý Chợ Hòa An', marketScopes: ['HA'], status: 'active', traderId: null });
  put({ id: 'AC-TVH-KT', code: 'TVH-KT', fullName: 'Bùi Văn Toàn', phone: '', accountType: 'Nhân viên kỹ thuật', title: 'Nhân viên kỹ thuật', roleIds: ['technician'], organization: 'Ban Quản lý Chợ Tân Việt Hòa', marketScopes: ['TVH'], status: 'active', traderId: null });
  put({ id: 'AC-KT01', code: 'KT01', fullName: 'Lê Thị Thu Trang', phone: '', accountType: 'Kế toán Ban Quản lý chợ', title: 'Kế toán Ban Quản lý chợ', roleIds: ['market_accountant'], organization: 'Ban Quản lý Chợ Cao Lãnh', marketScopes: ['CL'], status: 'active', traderId: null });
  put({ id: 'AC-KTP01', code: 'KTP01', fullName: 'Lê Thị Bảo Trâm', phone: '0900000007', accountType: 'Kế toán phường', title: 'Kế toán phường', roleIds: ['ward_accountant'], organization: 'UBND phường Cao Lãnh', marketScopes: ['ALL'], status: 'active', traderId: null });
  put({ id: 'AC-KTTT01', code: 'KTTT01', fullName: 'Nguyễn Thị Minh Anh', phone: '0900000006', accountType: 'Kế toán Trung tâm', title: 'Kế toán Trung tâm', roleIds: ['central_accountant'], organization: 'Tổ Văn phòng – Trung tâm Cung ứng dịch vụ công', marketScopes: ['ALL'], status: 'active', traderId: null });
  LEGACY_MANAGERS.forEach((id, i) => put({ id, code: id.slice(3), fullName: 'Legacy manager ' + i, phone: '', accountType: 'Tổ trưởng', title: 'Trưởng Ban Quản lý chợ', roleIds: ['market_manager'], organization: 'Ban Quản lý legacy', marketScopes: [i ? 'HA' : 'TTD'], status: 'active', traderId: null }));
  const perms = JSON.parse(ls.getItem('choso-caolanh-permissions'));
  perms.rolePerms = perms.rolePerms.filter(r => r.roleId !== 'central_accountant');
  ['screen:doi-soat', 'action:doi-soat.xem-tien-mat', 'action:doi-soat.xac-nhan-phieu-nop'].forEach(permKey => perms.rolePerms.push({ roleId: 'market_accountant', permKey, grantedAt: 'seed', grantedBy: 'test' }));
  perms.roles.push({ id: 'ward_accountant', name: 'Kế toán phường', desc: 'UBND phường Cao Lãnh', scope: 'all', market: null, selfService: false, builtin: true, active: true });
  ['screen:mat-bang', 'screen:tai-san'].forEach(permKey => perms.rolePerms.push({ roleId: 'technician', permKey, grantedAt: 'seed', grantedBy: 'test' }));
  perms.seedVersion = 19; delete perms.centralAccountantPermVersion; delete perms.technicianScreenPermVersion; delete perms.screenAccessByActorVersion;
  const out = {};
  ls._m.forEach((v, k) => { out[k] = v; });
  out['choso-caolanh-accounts'] = JSON.stringify(Array.from(byId.values()));
  out['choso-caolanh-permissions'] = JSON.stringify(perms);
  return out;
}
const legacy = legacyStorage();
const migrated = createApp(ROOT, { storage: legacy });
checkFinalModel(migrated.A, 'migrated');
ok('legacy/retired records are kept, hidden, not active, and still resolve names', () => {
  const A = migrated.A;
  ['AC-NV04', 'AC-HA-TP', 'AC-TVH-KT', 'AC-KT01', 'AC-KTP01'].concat(LEGACY_MANAGERS).forEach(id => {
    const a = A.ACCOUNTS.get(id);
    assert(a, id + ' persisted');
    assert.strictEqual(a.status, 'active', id + ' stored status untouched');
    assert(!A.ACCOUNTS.currentList().includes(a), id + ' hidden');
    assert.strictEqual(A.ACCOUNTS.isActive(a), false, id);
    assert.strictEqual(A.ACCOUNTS.authStatus(a), 'LOCKED', id + ' cannot log in');
  });
  assert.strictEqual(A.ACCOUNTS.get('AC-HA-TP').marketScopes[0], 'HA', 'retired scope untouched');
  assert.strictEqual(A.ACCOUNTS.byPhone('0911000002').id, 'AC-HA-TP');
  assert.strictEqual(A.U.staffName('HA-TP'), 'Trần Thị Ngọc An');
  assert.strictEqual(A.U.staffName('NV04'), 'Nguyễn Thị Diễm');
});
ok('legacy KTTT01 is upgraded to current metadata', () => {
  const kt = migrated.A.ACCOUNTS.get('AC-KTTT01');
  assert.strictEqual(kt.phone, '0909000505');
  assert.strictEqual(kt.organization, 'Trung tâm Cung ứng dịch vụ công');
  eq(Array.from(kt.marketScopes), ['ALL']);
});
ok('legacy permission state: A05 gains reconciliation, legacy roles hidden but not deleted', () => {
  const A = migrated.A;
  assert(A.PERM.hasPerm('central_accountant', 'action:doi-soat.xac-nhan-phieu-nop'));
  assert(A.PERM.hasPerm('central_accountant', 'screen:theo-doi-ky-doi-soat'));
  A05_VIEW_EXPORT.forEach(k => assert(A.PERM.hasPerm('central_accountant', k), k));
  A05_DENIED.forEach(k => assert(!A.PERM.hasPerm('central_accountant', k), k));
  assert(!A.PERM.hasPerm('technician', 'screen:mat-bang'), 'technician screen:mat-bang revoked');
  assert(A.PERM.hasPerm('technician', 'screen:tai-san'), 'technician screen:tai-san per actor screen matrix');
  assert(A.PERM.role('ward_accountant') && A.PERM.role('market_accountant'), 'compat roles kept');
  assert(!A.PERM.currentRoles().some(r => ['ward_accountant', 'market_accountant'].includes(r.id)));
});
ok('legacy managers do not raise KPI', () => {
  const A = migrated.A;
  A.ui.sessionAccountId = 'AC-QT01'; A.ui.currentDemoAccountId = 'AC-QT01'; A.syncAccountContext();
  A.ui.acc = { search: '', type: 'all', role: '', market: '', status: '', viewMode: 'ACCOUNTS' };
  const html = A.VIEWS['tai-khoan']();
  const total = Number(html.match(/Tổng tài khoản<\/div><div class="k-value">(\d+)/)[1]);
  assert.strictEqual(total, A.ACCOUNTS.currentList().length);
  assert(total < A.ACCOUNTS.list().length);
});

// ---------- 6) Reload is idempotent ----------
ok('reload keeps the same accounts/permissions (no duplicates, no re-migration)', () => {
  const snap = {};
  migrated.localStorage._m.forEach((v, k) => { snap[k] = v; });
  const again = createApp(ROOT, { storage: snap });
  checkFinalModel(again.A, 'reloaded');
  assert.strictEqual(again.localStorage.getItem('choso-caolanh-accounts'), snap['choso-caolanh-accounts']);
  const p1 = JSON.parse(snap['choso-caolanh-permissions']), p2 = JSON.parse(again.localStorage.getItem('choso-caolanh-permissions'));
  assert.strictEqual(p2.rolePerms.length, p1.rolePerms.length);
});

console.log(`current-org-demo-accounts regression PASS (${passed} checks)`);

/* Focused regression: quyền VÀO MÀN theo actor (sidebar + route). Chỉ screen:*; action:* và data scope không đổi. */
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { createApp } = require('./harness');

const ROOT = path.resolve(__dirname, '../..');
let passed = 0;
const ok = (label, fn) => { try { fn(); passed++; } catch (e) { e.message = label + ': ' + e.message; throw e; } };
const same = (a, b, msg) => assert.strictEqual(JSON.stringify(a), JSON.stringify(b), msg);

// PHAM_VI_THU_KY: 'doi-soat' (Đối soát buổi thu) và 'cong-no' (Công nợ & nhắc nợ) không còn cấp cho actor nào.
const COMMON_FIN = ['tieu-thuong', 'hop-dong', 'cau-hinh-gia', 'tai-khoan-ngan-hang', 'dien-nuoc', 'phai-thu', 'thu-tien'];
// Thứ tự theo sidebar. A05: màn nghiệp vụ "Đối soát thu tiền" = 'theo-doi-ky-doi-soat'; từ DOI_SOAT_THU_TIEN v1 A05 không
// còn vào 'doi-soat' (Đối soát buổi thu cũ) — thu hồi 1 lần qua migrateAccountantReconScreen.
const EXPECTED = {
  'AC-QT01': ['tong-quan', 'danh-muc-cho', 'mat-bang', 'tai-san'].concat(COMMON_FIN, ['su-co', 'thong-bao', 'bao-cao', 'tai-khoan', 'cai-dat']),
  'AC-NV01': ['tong-quan', 'danh-muc-cho', 'nhan-su-phan-cong', 'mat-bang', 'tai-san'].concat(COMMON_FIN, ['su-co', 'thong-bao', 'bao-cao']),
  'AC-NV02': ['mat-bang'].concat(COMMON_FIN, ['thong-bao', 'bao-cao']),
  'AC-NV05': ['tai-san', 'su-co', 'thong-bao', 'bao-cao'],
  'AC-KTTT01': ['tong-quan'].concat(['tieu-thuong', 'hop-dong', 'cau-hinh-gia', 'tai-khoan-ngan-hang', 'dien-nuoc', 'phai-thu', 'thu-tien', 'theo-doi-ky-doi-soat'], ['thong-bao', 'bao-cao']),
  'AC-LD01': ['tong-quan', 'danh-muc-cho', 'mat-bang', 'tieu-thuong', 'hop-dong', 'cau-hinh-gia', 'phai-thu', 'su-co', 'bao-cao']
};
// Ma trận screen mặc định TRƯỚC task (dựng state "đã lưu" cũ để kiểm tra migration).
const OLD_SCREENS = {
  'tong-quan': ['system_admin', 'ward_leader'], 'danh-muc-cho': ['system_admin', 'ward_leader'], 'nhan-su-phan-cong': ['market_manager'],
  'mat-bang': ['system_admin', 'ward_leader', 'market_manager', 'collector'], 'tai-san': ['ward_leader', 'market_manager'],
  'diem-kd': ['system_admin', 'ward_leader', 'market_manager', 'collector'], 'tieu-thuong': ['system_admin', 'ward_leader', 'market_manager', 'collector'],
  'hop-dong': ['system_admin', 'ward_leader', 'market_manager', 'collector'], 'cau-hinh-gia': ['system_admin', 'market_manager', 'ward_leader'],
  'tai-khoan-ngan-hang': ['system_admin', 'market_manager', 'ward_leader'], 'dien-nuoc': ['market_manager', 'collector'],
  'phai-thu': ['ward_leader', 'market_manager', 'collector', 'central_accountant'], 'thu-tien': ['market_manager', 'collector', 'central_accountant'],
  'doi-soat': ['ward_leader', 'market_manager', 'central_accountant'], 'theo-doi-ky-doi-soat': ['central_accountant'],
  'cong-no': ['ward_leader', 'market_manager', 'collector', 'central_accountant'], 'su-co': ['ward_leader', 'market_manager', 'technician'],
  'thong-bao': ['market_manager'], 'bao-cao': ['system_admin', 'ward_leader', 'market_manager', 'central_accountant'],
  'tai-khoan': ['system_admin'], 'cai-dat': ['system_admin'], 'mini-app': ['trader', 'collector']
};

function navIds(h) {
  const ids = Array.from(h.el('#nav').innerHTML.matchAll(/href="#\/([a-z-]+)"/g)).map(m => m[1]);
  return ids.filter((x, i) => ids.indexOf(x) === i); // NV kỹ thuật: "Phản ánh & sự cố" vẽ thành nhiều mục con cùng #/su-co
}
function checkMenus(h, tag) {
  const A = h.A;
  Object.keys(EXPECTED).forEach(id => {
    A.ui.currentDemoAccountId = id; A.ui.sessionAccountId = id; A.ui.market = 'CL'; A.syncAccountContext();
    assert.strictEqual(A.ui.market, 'CL', id);
    h.go('bao-cao');
    same(navIds(h), EXPECTED[id], tag + ' ' + id);
    const nav = h.el('#nav').innerHTML;
    assert(!nav.includes('Phiên chợ quê') && !nav.includes('#/phien-cho'), id);
    // Nhóm menu không còn màn nào thì không có heading.
    A.MENU.forEach(g => { const has = g.items.some(it => !it.sub && EXPECTED[id].indexOf(it.id) !== -1); assert.strictEqual(nav.includes('<div class="nav-group">' + g.group + '</div>'), has, id + ' heading ' + g.group); });
  });
}

// Fresh state (seed mặc định).
const h = createApp(ROOT), A = h.A;
const scopesBefore = JSON.stringify(A.ACCOUNTS.list().map(a => [a.id, a.marketScopes, A.allowedMarkets(a)]));
const actionsFresh = JSON.stringify(A.PERM.roles().map(r => [r.id, A.PERM.rolePermKeys(r.id).filter(k => k.indexOf('action:') === 0).sort()]));

ok('1–6 + 12: sidebar per actor (fresh state), empty groups hidden, no Phiên chợ quê', () => checkMenus(h, 'fresh'));

ok('7: A07 Tiểu thương stays on the separate Trader Web; its screen grants are unchanged', () => {
  assert(fs.existsSync(path.join(ROOT, 'tieu-thuong', 'index.html')));
  same(A.PERM.rolePermKeys('trader').filter(k => k.indexOf('screen:') === 0), ['screen:mini-app']);
});

ok('8: routes of non-granted screens are not reachable', () => {
  [['AC-NV05', ['phai-thu', 'mat-bang', 'tieu-thuong', 'tong-quan']], ['AC-NV01', ['tai-khoan', 'cai-dat']], ['AC-QT01', ['nhan-su-phan-cong']],
    ['AC-NV02', ['tong-quan', 'su-co', 'tai-san', 'nhan-su-phan-cong']], ['AC-KTTT01', ['mat-bang', 'su-co', 'danh-muc-cho']],
    ['AC-LD01', ['thu-tien', 'doi-soat', 'dien-nuoc', 'thong-bao', 'tai-san']]].forEach(([id, routes]) => {
    A.ui.currentDemoAccountId = id; A.ui.sessionAccountId = id; A.ui.market = 'CL'; A.syncAccountContext();
    routes.forEach(r => { h.go(r); assert.notStrictEqual(A.current, r, id + ' ' + r); assert(!A.U.can(r), id + ' ' + r); });
  });
});

ok('9: data scopes untouched', () => same(JSON.stringify(A.ACCOUNTS.list().map(a => [a.id, a.marketScopes, A.allowedMarkets(a)])), scopesBefore));

// State đã lưu từ TRƯỚC task: ma trận screen cũ + tuỳ biến của quản trị viên.
const base = createApp(ROOT);
const stored = JSON.parse(base.localStorage.getItem('choso-caolanh-permissions'));
delete stored.screenAccessByActorVersion;
const actorRoles = ['system_admin', 'market_manager', 'collector', 'technician', 'central_accountant', 'ward_leader'];
stored.rolePerms = stored.rolePerms.filter(r => !(r.permKey.indexOf('screen:') === 0 && OLD_SCREENS[r.permKey.slice(7)]));
Object.keys(OLD_SCREENS).forEach(id => OLD_SCREENS[id].forEach(roleId => stored.rolePerms.push({ roleId, permKey: 'screen:' + id, grantedAt: 'seed', grantedBy: 'old seed' })));
// Tuỳ biến: thu hồi 1 action, cấp thêm 1 action, role tuỳ biến có màn, role legacy có màn, màn đã bỏ.
stored.rolePerms = stored.rolePerms.filter(r => !(r.roleId === 'collector' && r.permKey === 'action:cong-no.nhac-no'));
stored.rolePerms.push({ roleId: 'ward_leader', permKey: 'action:danh-muc-cho.sua', grantedAt: 'custom', grantedBy: 'admin' });
stored.roles.push({ id: 'custom_role', name: 'Vai trò tuỳ biến', desc: '', scope: 'all', market: null, selfService: false, builtin: false, active: true });
stored.rolePerms.push({ roleId: 'custom_role', permKey: 'screen:tai-khoan', grantedAt: 'custom', grantedBy: 'admin' },
  { roleId: 'market_accountant', permKey: 'screen:doi-soat', grantedAt: 'custom', grantedBy: 'admin' },
  { roleId: 'collector', permKey: 'screen:phien-cho', grantedAt: 'seed', grantedBy: 'old seed' });
const actionRows = x => JSON.stringify(x.rolePerms.filter(r => r.permKey.indexOf('action:') === 0).map(r => r.roleId + '|' + r.permKey).sort());
const actionsStored = actionRows(stored);
const migrated = createApp(ROOT, { storage: { 'choso-caolanh-permissions': JSON.stringify(stored) } });
const after = JSON.parse(migrated.localStorage.getItem('choso-caolanh-permissions'));

ok('1–6 on previously stored state: one-time migration yields the same sidebars', () => checkMenus(migrated, 'migrated'));

ok('10 + 11: action permissions untouched (fresh defaults and stored customisations)', () => {
  assert.strictEqual(actionRows(after), actionsStored, 'every stored action row kept, none added/removed');
  const P = migrated.A.PERM;
  assert(!P.hasPerm('collector', 'action:cong-no.nhac-no'), 'admin revoke kept');
  assert(P.hasPerm('ward_leader', 'action:danh-muc-cho.sua'), 'admin grant kept');
  assert(P.hasPerm('custom_role', 'screen:tai-khoan') && P.hasPerm('market_accountant', 'screen:doi-soat'), 'custom/legacy roles untouched');
  assert(P.hasPerm('collector', 'screen:phien-cho'), 'retired key rows kept (hidden)');
  assert(P.hasPerm('collector', 'screen:mini-app') && P.hasPerm('central_accountant', 'screen:theo-doi-ky-doi-soat'), 'screens outside the matrix untouched');
  same(JSON.stringify(A.PERM.roles().map(r => [r.id, A.PERM.rolePermKeys(r.id).filter(k => k.indexOf('action:') === 0).sort()])), actionsFresh);
  assert.strictEqual(after.screenAccessByActorVersion, 1);
});

ok('11: migration runs once — later admin changes to screens are not overwritten', () => {
  migrated.A.PERM.grant('technician', 'screen:mat-bang', 'admin');
  migrated.A.PERM.revoke('ward_leader', 'screen:danh-muc-cho');
  const again = createApp(ROOT, { storage: { 'choso-caolanh-permissions': migrated.localStorage.getItem('choso-caolanh-permissions') } });
  assert(again.A.PERM.hasPerm('technician', 'screen:mat-bang'));
  assert(!again.A.PERM.hasPerm('ward_leader', 'screen:danh-muc-cho'));
});

console.log(`screen-access-by-actor regression PASS (${passed} checks)`);

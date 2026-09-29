/* Focused regression: "Tài khoản người dùng" information architecture — 4 status KPIs, 8 columns,
 * derived "Loại người dùng", role from the RBAC registry, market scope, masked phone, filters,
 * Xem + "⋯" menu reusing the existing handlers, RBAC, trader accounts only from "Cần xử lý". */
const assert = require('assert');
const path = require('path');
const { createApp } = require('./harness');

const h = createApp(path.resolve(__dirname, '../..')), A = h.A;
const login = id => { A.ui.sessionAccountId = id; A.ui.market = 'CL'; A.syncAccountContext(); };
login('AC-QT01'); h.go('tai-khoan');
const view = () => h.view();
// setStatus (existing) normalizes 'active' → 'ACTIVE'; compare the effective auth status instead.
const snapshot = () => JSON.stringify(A.ACCOUNTS.list().map(a => Object.assign({}, a, { status: A.ACCOUNTS.authStatus(a) })));
const before = snapshot();
let passed = 0;
const ok = (label, fn) => { fn(); passed++; };

ok('Cần xử lý uses calculated compact counts, not a long worklist', () => {
  const n = A.features.accounts.service.tradersNeedingAccount().length;
  if (n) assert(view().includes('Tiểu thương chưa có tài khoản') && view().includes(`<span class="acc-work-count">${n}</span>`) && !view().includes('pending-summary-count'));
});
ok('Cần xử lý switches the table work queue in place without opening a list modal', () => {
  A.closeModal();
  h.act('acc-queue', { mode: 'PHONE_CHANGE_REQUESTS' });
  assert.strictEqual(A.ui.acc.viewMode, 'PHONE_CHANGE_REQUESTS');
  assert(/Yêu cầu đổi số điện thoại/.test(view()) && /SĐT đề nghị/.test(view()) && !h.modal());
  h.act('acc-queue', { mode: 'PENDING_ACTIVATION' });
  assert.strictEqual(A.ui.acc.viewMode, 'PENDING_ACTIVATION');
  assert(/Tài khoản chờ kích hoạt/.test(view()) && /Mã tài khoản/.test(view()) && !h.modal());
  h.act('acc-queue', { mode: 'TRADERS_WITHOUT_ACCOUNT' });
  assert.strictEqual(A.ui.acc.viewMode, 'TRADERS_WITHOUT_ACCOUNT');
  assert(/Tiểu thương chưa có tài khoản/.test(view()) && /Mã tiểu thương/.test(view()) && /Điểm kinh doanh/.test(view()) && !h.modal());
  h.act('acc-queue-back');
  assert.strictEqual(A.ui.acc.viewMode, 'ACCOUNTS');
});
ok('exactly four status KPIs, no "Tiểu thương" KPI', () => {
  const labels = Array.from(view().matchAll(/<div class="k-label">([^<]+)<\/div>/g)).map(m => m[1]);
  assert.deepStrictEqual(labels, ['Tổng tài khoản', 'Đang hoạt động', 'Chờ kích hoạt', 'Tạm khóa']);
  const all = A.ACCOUNTS.list();
  assert(view().includes(`<div class="k-value">${all.length}</div>`));
});
ok('table columns', () => {
  const heads = Array.from(view().matchAll(/<th class="">(.*?)<\/th>/g)).map(m => m[1].replace(/<[^>]+>/g, ''));
  assert.deepStrictEqual(heads, ['Mã tài khoản', 'Người dùng', 'Số điện thoại', 'Loại người dùng', 'Vai trò', 'Phạm vi chợ', 'Trạng thái', 'Thao tác']);
  assert(/\+ Thêm tài khoản nội bộ/.test(view()));
});
ok('staff row: category ≠ role, phone masked or "Chưa cấu hình", scope from marketScopes', () => {
  const row = view().split('<tr').find(r => r.includes('data-id="AC-NV01"'));
  assert(row.includes('Cán bộ/Nhân viên') && row.includes('Tổ trưởng Tổ Quản lý chợ'));
  assert.strictEqual((row.match(/Tổ trưởng Tổ Quản lý chợ/g) || []).length, 1, 'role shown once');
  assert(row.includes(A.U.maskPhone('0900000001')) && !row.includes('0900000001'));
  assert(row.includes('Toàn bộ 12 chợ'));
  const nophone = view().split('<tr').find(r => r.includes('data-id="AC-NV02"'));
  assert(nophone.includes('Chưa cấu hình') || nophone.includes(A.U.maskPhone(A.ACCOUNTS.get('AC-NV02').phone)));
  const admin = view().split('<tr').find(r => r.includes('data-id="AC-QT01"'));
  assert(admin.includes('Toàn bộ 12 chợ'));
});
ok('phone column eye toggle shows / hides the full number (UI only)', () => {
  assert(/data-act="acc-toggle-phone"/.test(view()) && !view().includes('0900000001'));
  h.act('acc-toggle-phone');
  assert(view().includes('0900000001'));
  h.act('acc-toggle-phone');
  assert(!view().includes('0900000001'));
});
ok('filters: default all, trader filter, combined role + market + status', () => {
  assert(/Tiểu thương<\/td>/.test(view()) && /Cán bộ\/Nhân viên<\/td>/.test(view()), 'all account types appear by default');
  A.CH['acc-type']({ value: 'trader' });
  assert(/<td>Tiểu thương<\/td>/.test(view()) && !/Cán bộ\/Nhân viên<\/td>/.test(view()));
  A.CH['acc-type']({ value: 'all' });
  assert(/<td>Tiểu thương<\/td>/.test(view()) && /<td>Cán bộ\/Nhân viên<\/td>/.test(view()));
  A.CH['acc-role']({ value: 'collector' }); A.CH['acc-market']({ value: 'CL' }); A.CH['acc-status']({ value: 'ACTIVE' });
  const ids = Array.from(view().matchAll(/<tr class="click" data-act="acc-open" data-id="([^"]+)"/g)).map(m => m[1]);
  assert(ids.length && ids.every(id => { const a = A.ACCOUNTS.get(id); return A.ACCOUNTS.primaryRole(a) === 'collector' && A.allowedMarkets(a).includes('CL') && A.ACCOUNTS.authStatus(a) === 'ACTIVE'; }));
  h.act('acc-clear');
  assert.strictEqual(A.ui.acc.type, 'all');
});
ok('Xem opens the reusable selected-account profile, not the signed-in account', () => {
  h.act('acc-open', { id: 'AC-NV01' });
  assert.strictEqual(A.current, 'thong-tin-ca-nhan');
  assert(h.view().includes(A.ACCOUNTS.get('AC-NV01').fullName) && !h.view().includes('<h2 class="profile-name">' + A.ACCOUNTS.get('AC-QT01').fullName + '</h2>'));
  assert(/← Tài khoản người dùng/.test(h.view()) && /Thông tin tài khoản/.test(h.view()));
  assert(!/Ngày tạo|Cập nhật gần nhất/.test(h.view()));
  h.act('profile-back-accounts');
  assert.strictEqual(A.current, 'tai-khoan');
});
ok('"⋯" menu reuses acc-edit / acc-toggle and shows unlock for locked accounts', () => {
  h.act('acc-more', { id: 'AC-NV03' });
  assert(/data-act="acc-edit" data-id="AC-NV03"/.test(h.modal()) && /Tạm khóa tài khoản/.test(h.modal()));
  h.act('acc-menu-toggle', { id: 'AC-NV03' });
  // Tạm khóa cần xác nhận có chủ đích (lý do + mã thao tác) — xem account-lock-confirm.js.
  assert.strictEqual(A.ACCOUNTS.authStatus(A.ACCOUNTS.get('AC-NV03')), 'ACTIVE');
  const lockCode = h.modal().match(/id="acc-lock-code">(\d{3}) (\d{3})</);
  A.IN['acc-lock-reason']({ value: 'Kiểm thử' }); A.IN['acc-lock-code']({ value: lockCode[1] + lockCode[2] });
  h.act('acc-lock-confirm');
  assert.strictEqual(A.ACCOUNTS.authStatus(A.ACCOUNTS.get('AC-NV03')), 'LOCKED');
  h.act('acc-more', { id: 'AC-NV03' });
  assert(/Mở khóa tài khoản/.test(h.modal()));
  h.act('acc-menu-toggle', { id: 'AC-NV03' });
  assert.strictEqual(A.ACCOUNTS.authStatus(A.ACCOUNTS.get('AC-NV03')), 'ACTIVE');
});
ok('internal-account form has no trader role and no duplicated "Loại tài khoản" field', () => {
  h.act('acc-new');
  assert(/Thêm tài khoản nội bộ/.test(h.modal()) && !/value="trader"/.test(h.modal()) && !/data-ch="af-type"/.test(h.modal()));
  A.closeModal();
});
ok('no account data changed by viewing/filtering (toggle round-trip restores status)', () => assert.strictEqual(snapshot(), before));
ok('RBAC: user without account permissions gets no menu and handlers refuse', () => {
  login('AC-NV01'); h.go('tai-khoan');
  if (!A.canDo('tai-khoan.sua') && !A.canDo('tai-khoan.khoa-mo-khoa')) assert(!/data-act="acc-more"/.test(view()));
  if (!A.canDo('tai-khoan.khoa-mo-khoa')) { h.act('acc-toggle', { id: 'AC-NV03' }); assert.strictEqual(A.ACCOUNTS.authStatus(A.ACCOUNTS.get('AC-NV03')), 'ACTIVE'); }
});
console.log(`accounts screen regression PASS (${passed} checks)`);

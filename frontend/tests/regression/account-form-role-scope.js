/* Focused regression: popup "Thêm/Sửa tài khoản nội bộ" — chỉ quản lý danh tính tài khoản; phạm vi hiển thị
 * theo vai trò, chỉ đọc. A03 không phân công Chợ ở đây (Tổ trưởng phân công sau); A04 "Theo sự cố được giao";
 * A01/A02/A05/A08 "Toàn bộ N chợ" (['ALL']). */
const assert = require('assert');
const path = require('path');
const { createApp } = require('./harness');

const h = createApp(path.resolve(__dirname, '../..'));
const A = h.A;
let passed = 0;
const ok = (label, fn) => { try { fn(); passed++; } catch (e) { e.message = label + ': ' + e.message; throw e; } };
const eq = (actual, expected, msg) => assert.deepStrictEqual(JSON.parse(JSON.stringify(actual)), expected, msg);
const N = A.allowedMarkets({ marketScopes: ['ALL'] }).length;
const ALL_LABEL = 'Toàn bộ ' + N + ' chợ';
const marketBoxes = html => (html.match(/data-ch="af-scope"/g) || []).length;
const ch = (name, value, dataset) => A.CH[name](Object.assign({ value, checked: !!(dataset && dataset.checked), dataset: dataset || {} }));
const lastToast = () => h.trace.toasts[h.trace.toasts.length - 1] || '';
const open = () => { h.act('acc-new'); return h.modal(); };
const pickRole = roleId => { ch('af-role', roleId); return h.modal(); };
// Mã do hệ thống sinh → tra account vừa tạo theo SĐT đăng nhập (duy nhất).
const PHONES = {};
const fill = (label, phone) => { PHONES[label] = phone; Object.assign(A.ui.accForm, { fullName: 'Test ' + label, phone }); };
const created = label => A.ACCOUNTS.byPhone(PHONES[label]);

A.ui.sessionAccountId = 'AC-QT01'; A.ui.currentDemoAccountId = 'AC-QT01'; A.syncAccountContext();
h.go('tai-khoan');

ok('no role selected → no Market checkbox, prompt shown', () => {
  const html = open();
  assert(/Thêm tài khoản nội bộ/.test(html));
  assert.strictEqual(marketBoxes(html), 0);
  assert(html.includes('Chọn vai trò để xác định phạm vi làm việc.'));
});
ok('role dropdown: exactly the 6 current internal roles (no A06, market_accountant, trader)', () => {
  const html = h.modal();
  const opts = Array.from(html.matchAll(/data-ch="af-role"[^>]*>([\s\S]*?)<\/select>/g))[0][1];
  const ids = Array.from(opts.matchAll(/value="([^"]*)"/g)).map(m => m[1]).filter(Boolean).sort();
  eq(ids, ['central_accountant', 'collector', 'market_manager', 'system_admin', 'technician', 'ward_leader']);
  assert(!/Kế toán phường|Kế toán Ban Quản lý chợ|Tiểu thương/.test(opts));
});
[
  ['system_admin', 'Phạm vi dữ liệu', ALL_LABEL],
  ['market_manager', 'Phạm vi quản lý', ALL_LABEL, 'Quản lý hoạt động của Tổ Quản lý chợ trên toàn bộ hệ thống.'],
  ['central_accountant', 'Phạm vi dữ liệu', ALL_LABEL, 'Thực hiện nghiệp vụ kế toán và đối soát theo quyền được phân.'],
  ['ward_leader', 'Phạm vi theo dõi', ALL_LABEL, 'Xem và giám sát số liệu tổng hợp theo quyền được phân.'],
  ['technician', 'Phạm vi công việc', 'Theo sự cố được giao', 'Nhân viên kỹ thuật được Tổ trưởng phân công theo từng phản ánh/sự cố.']
].forEach(([roleId, title, value, help]) => ok(roleId + ' → readonly info box, no Market checkbox', () => {
  const html = pickRole(roleId);
  assert.strictEqual(marketBoxes(html), 0);
  assert(html.includes(title) && html.includes(value), title + ' / ' + value);
  if (help) assert(html.includes(help));
  if (roleId === 'technician') assert(!html.includes(ALL_LABEL) && !html.includes('Chợ Cao Lãnh'));
}));
ok('unit is derived per role and not free-text', () => {
  let html = pickRole('market_manager');
  assert(/value="Tổ Quản lý chợ"[^>]*readonly/.test(html));
  assert(!html.includes('data-ch="af-org"'));
  html = pickRole('ward_leader');
  assert(/value="UBND phường Cao Lãnh"[^>]*readonly/.test(html));
  eq(A.ACCOUNTS.organizationForRole('collector'), 'Tổ Quản lý chợ');
  eq(A.ACCOUNTS.organizationForRole('technician'), 'Tổ Quản lý chợ');
});
ok('collector (add) → no Market checkbox, read-only "Chưa được phân công chợ"', () => {
  const html = pickRole('collector');
  assert.strictEqual(marketBoxes(html), 0);
  assert(!html.includes('Chợ được phân công *') && !/Chuyển phân công/.test(html));
  assert(html.includes('Phân công công việc') && html.includes('Chưa được phân công chợ'));
  assert(html.includes('Tổ trưởng Tổ Quản lý chợ sẽ phân công chợ sau khi tài khoản được tạo.'));
});
ok('validation: phone required/valid/unique, role required; collector needs no Market', () => {
  open(); fill('FORM-V1', '');
  h.act('acc-form-save'); assert(/số điện thoại/.test(lastToast()));
  fill('FORM-V1', '0900000002'); h.act('acc-form-save'); assert(/đã được dùng/.test(lastToast()));
  fill('FORM-V1', '0987111001'); h.act('acc-form-save'); assert(/chọn vai trò/.test(lastToast()));
  assert(!created('FORM-V1'));
});
const assignmentSnapshot = () => JSON.stringify(A.ACCOUNTS.list().filter(a => A.ACCOUNTS.primaryRole(a) === 'collector').map(a => [a.id, a.marketScopes]).filter(x => x[0] !== (created('FORM-NV') || {}).id));
ok('new collector saved PENDING with marketScopes=[]; add never changes existing assignment', () => {
  const before = assignmentSnapshot(), haBefore = A.ACCOUNTS.getMarketCollector('HA').id;
  open(); fill('FORM-NV', '0987111002'); pickRole('collector');
  A.ui.accForm.marketScopes = ['HA']; // kể cả state form bị chèn Chợ, Lưu vẫn không phân công
  h.act('acc-form-save');
  const nv = created('FORM-NV');
  assert(nv, lastToast());
  eq(nv.marketScopes, []); eq(nv.status, 'PENDING_ACTIVATION');
  eq(assignmentSnapshot(), before, 'other collectors untouched');
  eq(A.ACCOUNTS.getMarketCollector('HA').id, haBefore);
  A.D.MARKETS.forEach(m => assert(A.ACCOUNTS.getMarketCollectors(m.id).length <= 1, m.id));
});
ok('edit existing assigned collector: read-only Markets, no checkbox, scopes retained', () => {
  const nv02 = A.ACCOUNTS.get('AC-NV02'), scopes = JSON.stringify(nv02.marketScopes);
  h.act('acc-edit', { id: 'AC-NV02' });
  const html = h.modal();
  assert.strictEqual(marketBoxes(html), 0);
  assert(html.includes('Đang phụ trách: ' + A.allowedMarkets(nv02).map(id => A.U.mShort(id)).join(', ')));
  A.ui.accForm.fullName = 'Lê Thị Ngọc Hân'; A.ui.accForm.marketScopes = [];
  h.act('acc-form-save');
  eq(JSON.stringify(A.ACCOUNTS.get('AC-NV02').marketScopes), scopes);
});
ok('assignment API (Tổ trưởng workflow) still prevents duplicate ACTIVE collector and supports transfer', () => {
  const nv02 = A.ACCOUNTS.get('AC-NV02'), nv03 = A.ACCOUNTS.get('AC-NV03');
  const refused = A.ACCOUNTS.saveCollectorAccount(Object.assign({}, nv03, { marketScopes: nv03.marketScopes.concat(['CL']) }));
  eq(refused.reason, 'TRANSFER_REQUIRED');
  const moved = A.ACCOUNTS.saveCollectorAccount(Object.assign({}, nv03, { marketScopes: nv03.marketScopes.concat(['CL']) }), { transferMarkets: ['CL'] });
  assert(moved.ok);
  eq(A.ACCOUNTS.getMarketCollector('CL').id, 'AC-NV03');
  assert(!A.ACCOUNTS.get('AC-NV02').marketScopes.includes('CL'));
  A.D.MARKETS.forEach(m => assert(A.ACCOUNTS.getMarketCollectors(m.id).length <= 1, m.id));
  // khôi phục phân công ban đầu cho các check sau
  assert(A.ACCOUNTS.saveCollectorAccount(Object.assign({}, A.ACCOUNTS.get('AC-NV02'), { marketScopes: ['CL'].concat(A.ACCOUNTS.get('AC-NV02').marketScopes) }), { transferMarkets: ['CL'] }).ok);
  eq(A.ACCOUNTS.getMarketCollector('CL').id, nv02.id);
});
ok('fixed-scope roles save ALL; technician saves compatibility ALL without Market UI', () => {
  [['FORM-KT', 'central_accountant', '0987111004'], ['FORM-LD', 'ward_leader', '0987111005'], ['FORM-QT', 'system_admin', '0987111006'], ['FORM-TECH', 'technician', '0987111007']].forEach(([code, roleId, phone]) => {
    open(); fill(code, phone); pickRole(roleId);
    A.ui.accForm.marketScopes = ['HA'];
    h.act('acc-form-save');
    const a = created(code);
    assert(a, code + ' ' + lastToast());
    eq(a.marketScopes, ['ALL'], code);
    eq(a.organization, A.ACCOUNTS.organizationForRole(roleId), code);
  });
});
ok('edit uses the same form; role change recomputes scope without assigning Markets', () => {
  const nvId = created('FORM-NV').id;
  // collector → technician: compatibility ALL, no Market UI
  h.act('acc-edit', { id: nvId });
  assert(/Sửa tài khoản/.test(h.modal()) && h.modal().includes('Chưa được phân công chợ'));
  let html = pickRole('technician');
  assert.strictEqual(marketBoxes(html), 0);
  h.act('acc-form-save');
  eq(A.ACCOUNTS.get(nvId).marketScopes, ['ALL']);
  // technician → collector: old ALL is not reused; collector becomes unassigned []
  h.act('acc-edit', { id: nvId });
  html = pickRole('collector');
  assert(html.includes('Chưa được phân công chợ') && marketBoxes(html) === 0);
  h.act('acc-form-save');
  eq(A.ACCOUNTS.get(nvId).marketScopes, []);
  // collector → fixed-scope role: ALL
  h.act('acc-edit', { id: nvId }); pickRole('central_accountant'); h.act('acc-form-save');
  eq(A.ACCOUNTS.get(nvId).marketScopes, ['ALL']);
});
ok('current list / KPI unaffected by the form (legacy hidden, new accounts counted)', () => {
  const cur = A.ACCOUNTS.currentList();
  assert(cur.some(a => a.id === created('FORM-TECH').id));
  assert(!cur.some(a => ['ward_accountant', 'market_accountant'].includes(A.ACCOUNTS.primaryRole(a))));
  A.ui.acc = { search: '', type: 'all', role: '', market: '', status: '', viewMode: 'ACCOUNTS' };
  const html = A.VIEWS['tai-khoan']();
  assert.strictEqual(Number(html.match(/Tổng tài khoản<\/div><div class="k-value">(\d+)/)[1]), cur.length);
});

console.log(`account-form-role-scope regression PASS (${passed} checks)`);

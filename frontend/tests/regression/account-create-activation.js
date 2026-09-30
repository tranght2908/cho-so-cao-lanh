/* Focused regression: tạo tài khoản nội bộ (mã do hệ thống sinh, luôn "Chờ kích hoạt") và kích hoạt lần đầu
 * qua OTP dùng một lần (PENDING_ACTIVATION → ACTIVE chỉ sau khi OTP xác thực thành công). */
const assert = require('assert');
const path = require('path');
const { createApp } = require('./harness');

const ROOT = path.resolve(__dirname, '../..');
const h = createApp(ROOT);
const A = h.A;
let passed = 0;
const ok = (label, fn) => { try { fn(); passed++; } catch (e) { e.message = label + ': ' + e.message; throw e; } };
const eq = (actual, expected, msg) => assert.deepStrictEqual(JSON.parse(JSON.stringify(actual)), expected, msg);
const lastToast = () => h.trace.toasts[h.trace.toasts.length - 1] || '';
const ch = (name, value, dataset) => A.CH[name](Object.assign({ value, checked: !!(dataset && dataset.checked), dataset: dataset || {} }));
const adminLogin = () => { A.ui.sessionAccountId = 'AC-QT01'; A.ui.currentDemoAccountId = 'AC-QT01'; A.syncAccountContext(); h.go('tai-khoan'); };
const kpi = label => { A.ui.acc = { search: '', type: 'all', role: '', market: '', status: '', viewMode: 'ACCOUNTS' }; const m = A.VIEWS['tai-khoan']().match(new RegExp(label + '</div><div class="k-value">(\\d+)')); return Number(m[1]); };
function create(roleId, phone, name, markets) {
  h.act('acc-new');
  Object.assign(A.ui.accForm, { fullName: name, phone });
  ch('af-role', roleId);
  if (markets) A.ui.accForm.marketScopes = markets;
  h.act('acc-form-save');
  return A.ACCOUNTS.byPhone(phone);
}
const otp = (phone, code) => {
  A.ui.sessionAccountId = null; A.ui.currentDemoAccountId = null;
  A.ui.auth = { step: 'phone', phone, otp: '', error: '' };
  h.act('auth-continue');
  if (code !== undefined) A.ui.auth.otp = code;
};

adminLogin();

ok('add form: no editable code, no status choice, system-generated/pending shown, "Tạo tài khoản"', () => {
  h.act('acc-new');
  const html = h.modal();
  assert(!html.includes('data-ch="af-code"'), 'no editable code');
  assert(!html.includes('data-ch="af-status"'), 'no status select');
  assert(html.includes('Hệ thống tự động tạo'));
  assert(html.includes('Chờ kích hoạt') && html.includes('Tài khoản sẽ được kích hoạt sau lần xác thực OTP đầu tiên.'));
  assert(/data-act="acc-form-save">Tạo tài khoản</.test(html));
  A.closeModal();
});

let pendingBefore, activeBefore, created;
ok('code generated per role, unique, never reusing legacy/D.STAFF codes', () => {
  pendingBefore = kpi('Chờ kích hoạt'); activeBefore = kpi('Đang hoạt động');
  // Legacy/locked record with a higher NV number must not be reused or undercut.
  A.ACCOUNTS.add({ id: 'AC-NV15', code: 'NV15', fullName: 'Legacy locked', phone: '', roleIds: ['collector'], organization: '', marketScopes: [], status: 'LOCKED' });
  const svc = A.features.accounts.service;
  eq(svc.nextInternalAccountCode('collector', A.U.pad), 'NV16');
  eq(svc.nextInternalAccountCode('technician', A.U.pad), 'NV16', 'shared NV sequence for Tổ Quản lý chợ staff');
  eq(svc.nextInternalAccountCode('system_admin', A.U.pad), 'QT02');
  eq(svc.nextInternalAccountCode('ward_leader', A.U.pad), 'LD02');
  eq(svc.nextInternalAccountCode('central_accountant', A.U.pad), 'KTTT02');
  eq(svc.nextInternalAccountCode('market_manager', A.U.pad), 'NV16');
  created = create('technician', '0987222001', 'Kỹ thuật mới');
  assert(created, lastToast());
  eq(created.code, 'NV16'); eq(created.id, 'AC-NV16');
  const second = create('central_accountant', '0987222002', 'Kế toán mới');
  eq(second.code, 'KTTT02');
  const codes = A.ACCOUNTS.list().map(a => a.code);
  assert.strictEqual(new Set(codes).size, codes.length, 'codes unique');
  // D.STAFF NV04/NV06/NV08 (historical actors) never reissued even without persisted accounts
  assert(!['NV04', 'NV06', 'NV08'].includes(created.code));
});
ok('new account is always PENDING; KPI pending +N, active unchanged; activation notice is simulated', () => {
  eq(created.status, 'PENDING_ACTIVATION');
  eq(A.ACCOUNTS.authStatus(created), 'PENDING_ACTIVATION');
  eq(kpi('Chờ kích hoạt'), pendingBefore + 2);
  eq(kpi('Đang hoạt động'), activeBefore);
  assert(/Hướng dẫn kích hoạt đã được tạo/.test(lastToast()) && !lastToast().includes('0987222002'), 'masked phone, no delivery claim');
});
let collector, assignSnapshot;
ok('new collector: no Market UI, saved PENDING with marketScopes=[], assignment untouched', () => {
  assignSnapshot = JSON.stringify(A.D.MARKETS.map(m => [m.id, (A.ACCOUNTS.getMarketCollector(m.id) || {}).id]));
  h.act('acc-new'); Object.assign(A.ui.accForm, { fullName: 'Thu phí mới', phone: '0987222003' }); ch('af-role', 'collector');
  assert(!h.modal().includes('data-ch="af-scope"') && h.modal().includes('Chưa được phân công chợ'));
  h.act('acc-form-save');
  collector = A.ACCOUNTS.byPhone('0987222003');
  assert(collector, lastToast());
  eq(collector.status, 'PENDING_ACTIVATION'); eq(collector.marketScopes, []);
  eq(JSON.stringify(A.D.MARKETS.map(m => [m.id, (A.ACCOUNTS.getMarketCollector(m.id) || {}).id])), assignSnapshot);
});
ok('pending account can request OTP; OTP input auto-filled 123456; request alone does not activate', () => {
  otp('0987222001');
  eq(A.ui.auth.step, 'otp');
  eq(A.ui.auth.otp, '123456', 'demo OTP auto-filled, not auto-submitted');
  assert(!A.ui.sessionAccountId);
  assert(A.ui.auth.otpChallenge && A.ui.auth.otpChallenge.accountId === created.id);
  eq(A.ACCOUNTS.get(created.id).status, 'PENDING_ACTIVATION');
});
ok('wrong OTP does not activate', () => {
  A.ui.auth.otp = '000000'; h.act('auth-verify');
  eq(A.ACCOUNTS.get(created.id).status, 'PENDING_ACTIVATION');
  assert(!A.ui.sessionAccountId);
});
ok('expired OTP does not activate', () => {
  A.ui.auth.otpChallenge.expiresAt = h.ctx.Date.now() - 1; A.ui.auth.otp = '123456'; h.act('auth-verify');
  eq(A.ACCOUNTS.get(created.id).status, 'PENDING_ACTIVATION');
  assert(/hết hạn/.test(A.ui.auth.error));
});
ok('correct OTP activates PENDING → ACTIVE, KPI moves, OTP consumed (not reusable)', () => {
  h.act('auth-resend');
  A.ui.auth.otp = '123456';
  const challenge = A.ui.auth.otpChallenge;
  h.act('auth-verify');
  eq(A.ui.sessionAccountId, created.id);
  eq(A.ACCOUNTS.get(created.id).status, 'ACTIVE');
  assert(A.ACCOUNTS.get(created.id).activatedAt);
  // replay the consumed code: no challenge left → rejected
  A.ui.sessionAccountId = null;
  A.ui.auth = { step: 'otp', phone: '0987222001', otp: '123456', error: '', otpChallenge: null };
  h.act('auth-verify');
  assert(!A.ui.sessionAccountId, 'consumed OTP cannot log in again');
  assert(challenge && challenge.accountId === created.id);
  adminLogin();
  eq(kpi('Chờ kích hoạt'), pendingBefore + 2, 'pending: +3 created (tech, KTTT, collector) −1 activated');
  eq(kpi('Đang hoạt động'), activeBefore + 1);
});
ok('active account logs in normally with OTP', () => {
  otp('0900000001', '123456'); h.act('auth-verify');
  eq(A.ui.sessionAccountId, 'AC-NV01');
  eq(A.ACCOUNTS.get('AC-NV01').status, 'active', 'active seed status untouched');
});
ok('pending collector activates via OTP and stays unassigned (activation ≠ assignment); header safe', () => {
  otp('0987222003'); eq(A.ui.auth.otp, '123456'); h.act('auth-verify');
  eq(A.ui.sessionAccountId, collector.id);
  const c = A.ACCOUNTS.get(collector.id);
  eq(c.status, 'ACTIVE'); eq(c.marketScopes, []);
  eq(JSON.stringify(A.D.MARKETS.map(m => [m.id, (A.ACCOUNTS.getMarketCollector(m.id) || {}).id])), assignSnapshot, 'no Market assigned/transferred on activation');
  A.syncAccountContext();
  eq(A.ui.market, '', 'no fallback to CL');
  assert(A.marketSelectOptionsHtml().includes('Chưa được phân công chợ'));
  eq(A.allowedMarkets(c), []);
});
ok('locked account cannot request OTP / activate', () => {
  adminLogin();
  const locked = create('ward_leader', '0987222005', 'Lãnh đạo khoá');
  A.ACCOUNTS.setStatus(locked.id, 'LOCKED');
  otp('0987222005');
  eq(A.ui.auth.step, 'phone');
  assert(/khóa/.test(A.ui.auth.error));
  A.ui.auth = { step: 'otp', phone: '0987222005', otp: '123456', error: '', otpChallenge: { id: 'x', accountId: locked.id, phone: '0987222005', expiresAt: h.ctx.Date.now() + 1000 } };
  h.act('auth-verify');
  eq(A.ACCOUNTS.get(locked.id).status, 'LOCKED');
  assert(A.ui.sessionAccountId !== locked.id);
});
ok('activation persists after reload', () => {
  const snap = {}; h.localStorage._m.forEach((v, k) => { snap[k] = v; });
  const again = createApp(ROOT, { storage: snap }).A;
  eq(again.ACCOUNTS.get(created.id).status, 'ACTIVE');
  eq(again.ACCOUNTS.byPhone('0987222002').status, 'PENDING_ACTIVATION');
});
ok('edit: code immutable, "Lưu thay đổi"', () => {
  adminLogin();
  h.act('acc-edit', { id: created.id });
  const html = h.modal();
  assert(!html.includes('data-ch="af-code"') && /value="NV16"[^>]*readonly/.test(html));
  assert(/Lưu thay đổi/.test(html));
  A.ui.accForm.code = 'HACKED'; A.ui.accForm.fullName = 'Kỹ thuật đổi tên';
  h.act('acc-form-save');
  eq(A.ACCOUNTS.get(created.id).code, 'NV16');
  eq(A.ACCOUNTS.get(created.id).fullName, 'Kỹ thuật đổi tên');
});
ok('unit presentation = actor metadata everywhere (A01/A05), not legacy stored string', () => {
  eq(A.ACCOUNTS.organizationOf(A.ACCOUNTS.get('AC-QT01')), 'Cán bộ CNTT/Trung tâm');
  eq(A.ACCOUNTS.organizationOf(A.ACCOUNTS.get('AC-KTTT01')), 'Tổ Văn phòng – Trung tâm Cung ứng dịch vụ công');
  h.act('acc-edit', { id: 'AC-KTTT01' });
  assert(h.modal().includes('Tổ Văn phòng – Trung tâm Cung ứng dịch vụ công') && !h.modal().includes('value="Trung tâm Cung ứng dịch vụ công"'));
  A.closeModal();
});
ok('custom role: not offered on add; existing custom-role account edits safely', () => {
  A.PERM.addRole({ id: 'custom_audit', name: 'Kiểm tra nội bộ', desc: '', scope: 'all', market: null, selfService: false, builtin: false, active: true });
  h.act('acc-new');
  assert(!h.modal().includes('value="custom_audit"'));
  A.closeModal();
  A.ACCOUNTS.add({ id: 'AC-CUS01', code: 'CUS01', fullName: 'Custom', phone: '0987222006', roleIds: ['custom_audit'], organization: 'Đơn vị cũ', marketScopes: ['HA'], status: 'ACTIVE' });
  h.act('acc-edit', { id: 'AC-CUS01' });
  assert(h.modal().includes('value="custom_audit" selected'));
  assert(!h.modal().includes('data-ch="af-scope"'), 'no Market selection for custom role');
  A.ui.accForm.fullName = 'Custom 2'; h.act('acc-form-save');
  const c = A.ACCOUNTS.get('AC-CUS01');
  eq(c.roleIds, ['custom_audit']); eq(c.marketScopes, ['HA'], 'scope untouched, not ALL');
});
ok('locked collector with no Market: edit + reactivate allowed without assigning Markets', () => {
  A.ACCOUNTS.add({ id: 'AC-NV90', code: 'NV90', fullName: 'NV cũ', phone: '0987222007', roleIds: ['collector'], organization: '', marketScopes: [], status: 'LOCKED' });
  h.act('acc-edit', { id: 'AC-NV90' });
  A.ui.accForm.fullName = 'NV cũ (đổi tên)'; h.act('acc-form-save');
  eq(A.ACCOUNTS.get('AC-NV90').fullName, 'NV cũ (đổi tên)');
  h.act('acc-edit', { id: 'AC-NV90' });
  A.ui.accForm.status = 'ACTIVE'; h.act('acc-form-save');
  eq(A.ACCOUNTS.get('AC-NV90').status, 'ACTIVE'); eq(A.ACCOUNTS.get('AC-NV90').marketScopes, []);
});
ok('reactivating a locked collector whose Market now belongs to another is refused (no duplicate)', () => {
  A.ACCOUNTS.add({ id: 'AC-NV91', code: 'NV91', fullName: 'NV khoá có chợ', phone: '0987222008', roleIds: ['collector'], organization: '', marketScopes: ['HA'], status: 'LOCKED' });
  h.act('acc-edit', { id: 'AC-NV91' });
  A.ui.accForm.status = 'ACTIVE'; h.act('acc-form-save');
  assert(/Tổ trưởng cần phân công lại/.test(lastToast()));
  eq(A.ACCOUNTS.get('AC-NV91').status, 'LOCKED');
  assert.strictEqual(A.ACCOUNTS.getMarketCollectors('HA').length, 1);
  A.closeModal();
});

console.log(`account-create-activation regression PASS (${passed} checks)`);

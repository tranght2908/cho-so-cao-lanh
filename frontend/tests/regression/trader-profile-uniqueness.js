/* Focused regression — Task 2: hồ sơ Tiểu thương duy nhất theo CHỢ.
 * (market, phone) và (market, CCCD) duy nhất; khác chợ được trùng (cùng người, nhiều hồ sơ). Áp dụng ở handler
 * tạo/sửa VÀ ở tầng service (save path). SĐT tài khoản đăng nhập vẫn duy nhất toàn hệ thống. */
const assert = require('assert');
const path = require('path');
const { createApp } = require('./harness');

const h = createApp(path.resolve(__dirname, '../..'));
const A = h.A;
const TS = A.features.traders.service;
let passed = 0;
const ok = (label, fn) => { try { fn(); passed++; } catch (e) { e.message = label + ': ' + e.message; throw e; } };
const lastToast = () => h.trace.toasts[h.trace.toasts.length - 1] || '';
const login = (id, market) => { A.ui.sessionAccountId = id; A.ui.currentDemoAccountId = id; A.ui.market = market; A.syncAccountContext(); };
const count = () => A.db.traders.length;
// Tạo hồ sơ qua đúng handler UI (tt-new → nhập → wf-profile-save) tại chợ đang chọn.
function createViaUi(market, name, phone, idNo) {
  login('AC-NV01', market);
  h.act('tt-new');
  A.IN['wf-p-name']({ value: name }); A.IN['wf-p-phone']({ value: phone }); A.IN['wf-p-idno']({ value: idNo }); A.IN['wf-p-address']({ value: 'Địa chỉ test' });
  const before = count();
  h.act('wf-profile-save');
  A.closeModal();
  return count() > before ? A.db.traders[A.db.traders.length - 1] : null;
}
function editViaUi(t, fields) {
  login('AC-NV01', t.market);
  A.$('#tte-name').value = fields.name || t.name;
  A.$('#tte-idno').value = fields.idNo != null ? fields.idNo : t.idNo;
  A.$('#tte-phone').value = fields.phone != null ? fields.phone : t.phone;
  A.$('#tte-idtype').value = t.idType || 'CCCD';
  h.act('tt-edit-save', { id: t.id });
}

let base;
ok('baseline profile created in CL', () => {
  base = createViaUi('CL', 'Gốc CL', '0971000001', '079100000001');
  assert(base && base.market === 'CL', lastToast());
});
ok('1. same Market + same phone → block (UI and service)', () => {
  assert(!createViaUi('CL', 'Trùng SĐT', '0971 000 001', '079100000002'));
  assert(/Số điện thoại đã được dùng/.test(lastToast()));
  const before = count();
  assert.strictEqual(TS.create({ id: 'TX-SVC-1', name: 'x', phone: '0971000001', idNo: '079100000099', market: 'CL', stalls: [] }), null);
  assert.strictEqual(count(), before);
});
ok('2. different Market + same phone → allow', () => {
  const ttd = createViaUi('TTD', 'Cùng người TTD', '0971000001', '079100000003');
  assert(ttd && ttd.market === 'TTD', lastToast());
});
ok('3. same Market + same CCCD → block (UI and service)', () => {
  assert(!createViaUi('CL', 'Trùng CCCD', '0971000004', '079100000001'));
  assert(/CCCD\/giấy tờ đã được dùng/.test(lastToast()));
  assert.strictEqual(TS.create({ id: 'TX-SVC-2', name: 'x', phone: '0971000098', idNo: ' 0791 0000 0001 ', market: 'CL', stalls: [] }), null);
});
ok('4. different Market + same CCCD → allow', () => {
  const ha = createViaUi('HA', 'Cùng người HA', '0971000005', '079100000001');
  assert(ha && ha.market === 'HA', lastToast());
});
ok('5. edit cannot change to a phone/CCCD used by another profile in the same Market (UI and service)', () => {
  const other = createViaUi('CL', 'Khác CL', '0971000006', '079100000006');
  assert(other, lastToast());
  editViaUi(other, { phone: base.phone });
  assert(/Số điện thoại đã được dùng/.test(lastToast()));
  assert.strictEqual(A.idx.trader.get(other.id).phone, '0971000006');
  editViaUi(other, { idNo: base.idNo });
  assert(/CCCD\/giấy tờ đã được dùng/.test(lastToast()));
  assert.strictEqual(A.idx.trader.get(other.id).idNo, '079100000006');
  assert.strictEqual(TS.updateProfile(other.id, { name: other.name, idNo: other.idNo, phone: base.phone, idType: 'CCCD' }), null);
  assert.strictEqual(A.idx.trader.get(other.id).phone, '0971000006');
  // CCCD trùng hồ sơ ở CHỢ KHÁC khi sửa → được phép (trước đây bị chặn toàn hệ thống)
  const ttdTwin = A.db.traders.find(t => t.market === 'TTD' && t.name === 'Cùng người TTD');
  editViaUi(other, { idNo: ttdTwin.idNo });
  assert.strictEqual(A.idx.trader.get(other.id).idNo, ttdTwin.idNo, lastToast());
});
ok('6. edit keeping its own phone/CCCD → allow', () => {
  editViaUi(base, { name: 'Gốc CL (đổi tên)' });
  const t = A.idx.trader.get(base.id);
  assert.strictEqual(t.name, 'Gốc CL (đổi tên)', lastToast());
  assert.strictEqual(t.phone, '0971000001');
});
ok('7. account phone uniqueness unchanged (system-wide)', () => {
  // SĐT đã có account (AC-NV01) → tạo account nội bộ khác cùng SĐT vẫn bị chặn
  login('AC-QT01', 'CL'); h.go('tai-khoan'); h.act('acc-new');
  Object.assign(A.ui.accForm, { fullName: 'Trùng SĐT account', phone: '0900000001' });
  A.CH['af-role']({ value: 'technician', dataset: {} });
  const before = A.ACCOUNTS.list().length;
  h.act('acc-form-save');
  assert(/đã được dùng cho tài khoản khác/.test(lastToast()));
  assert.strictEqual(A.ACCOUNTS.list().length, before);
  // Hai hồ sơ khác chợ cùng SĐT 0971000001 vẫn chỉ tương ứng tối đa 1 account đăng nhập
  assert(A.ACCOUNTS.list().filter(a => A.ACCOUNTS.normalizePhone(a.phone) === '0971000001').length <= 1);
});

console.log(`trader-profile-uniqueness regression PASS (${passed} checks)`);

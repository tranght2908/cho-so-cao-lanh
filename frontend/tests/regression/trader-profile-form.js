/* Focused regression: "Tạo / Chỉnh sửa hồ sơ tiểu thương" is ONE continuous form (no wizard/stepper):
 * A. personal info → B. documents (+ optional OCR) → C. business points & charges → D. summary → [Hủy][Lưu hồ sơ].
 * Domain unchanged: saving writes the profile + trader.rentalDraft only (no contract, no allocation, no billing);
 * "Chờ tạo hợp đồng" is derived from rentalDraft; contracted rental items cannot be removed or re-charged. */
const assert = require('assert');
const path = require('path');
const { createApp } = require('./harness');

const h = createApp(path.resolve(__dirname, '../..')), A = h.A, doc = h.ctx.document, TS = A.features.traders.service, BP = A.features.businessPoints.service, CS = A.features.contracts.service;
let passed = 0;
const ok = (label, fn) => { try { fn(); passed++; } catch (e) { e.message = label + ': ' + e.message; throw e; } };
A.ui.sessionAccountId = 'AC-NV01'; A.ui.currentDemoAccountId = 'AC-NV01'; A.ui.market = 'CL'; A.syncAccountContext();
const view = () => h.view();
const type = (k, v) => A.IN['tp-field']({ dataset: { k }, value: v });
const upload = (key, name) => { h.setFiles([{ name, type: 'image/png', size: 1000 }]); h.act('tp-file', { key }); };
const free = BP.list().filter(p => p.market === 'CL' && BP.isAllocatable(p) && !CS.hasActiveForPoint(p.id)).slice(0, 2);
// Multi-select through the real picker handler: the stub DOM returns the ticked checkboxes of the modal.
const pick = ids => {
  h.act('tp-select-points');
  ids.forEach(id => assert(h.modal().includes(`data-tp-point="${id}"`), 'picker lists free point ' + id));
  const original = doc.querySelectorAll;
  doc.querySelectorAll = sel => sel === '[data-tp-point]:checked' ? ids.map(id => ({ dataset: { tpPoint: id } })) : original(sel);
  try { h.act('tp-points-confirm'); } finally { doc.querySelectorAll = original; }
};
const fill = () => { type('name', 'Phạm Thị Thu'); type('phone', '0977111222'); type('idType', 'CCCD'); type('idNo', 'SAMPLE-ID-501'); type('address', 'Khóm 2, phường Cao Lãnh'); };

ok('one continuous form: sections A–D, no stepper / Tiếp theo / Quay lại, footer Hủy + Lưu hồ sơ', () => {
  h.go('tieu-thuong'); h.act('tp-new');
  const v = view();
  ['A. Thông tin cá nhân', 'B. Hồ sơ giấy tờ', 'C. Điểm kinh doanh & khoản thu', 'D. Tổng hợp'].forEach(t => assert(v.includes(t), t));
  assert(v.indexOf('A. Thông tin cá nhân') < v.indexOf('B. Hồ sơ giấy tờ') && v.indexOf('B. Hồ sơ giấy tờ') < v.indexOf('C. Điểm kinh doanh'), 'section order');
  assert(!/tp-next|tp-prev|Tiếp theo|Quay lại|1\. Hồ sơ giấy tờ/.test(v), 'no wizard controls');
  assert(/data-act="tp-wizard-cancel">Hủy</.test(v) && /data-act="tp-save">Lưu hồ sơ</.test(v));
  ['CCCD - Mặt trước', 'CCCD - Mặt sau', 'Giấy chứng nhận đăng ký kinh doanh', 'Ảnh chân dung'].forEach(t => assert(v.includes(t), t));
  assert(/Chưa chọn điểm kinh doanh\. Có thể lưu hồ sơ trước/.test(v), 'empty points state');
});
ok('manual entry without any image; typed values survive uploads and re-renders', () => {
  const d = A.ui.traderWorkspace.wizard;
  fill();
  upload('cccdFront', 'cccd_front.png');
  assert.strictEqual(d.name, 'Phạm Thị Thu', 'typed name kept after upload');
  assert.strictEqual(d.files.cccdFront.name, 'cccd_front.png');
  assert(/id="tp-name" data-in="tp-field" data-k="name" value="Phạm Thị Thu"/.test(view()));
  h.act('tp-file-remove', { key: 'cccdFront' });
  assert(!d.files.cccdFront && d.name === 'Phạm Thị Thu');
});
let saved;
ok('points & charges in the same form, per point; summary counts; no money per month', () => {
  const d = A.ui.traderWorkspace.wizard;
  pick(free.map(p => p.id));
  assert.strictEqual(d.items.length, 2, 'several points selected at once');
  assert.strictEqual(d.name, 'Phạm Thị Thu', 'typed data kept after picking points');
  A.CH['tp-charge']({ dataset: { id: free[0].id, key: 'electricity' }, checked: true });
  const v = view();
  free.forEach(p => assert(v.includes(p.code), p.code));
  ['Mã điểm', 'Vị trí', 'Diện tích', 'Loại diện tích', 'Ngành hàng', 'Mặt bằng', 'Điện', 'Nước', 'Dịch vụ', 'Thao tác'].forEach(t => assert(v.includes('<th>' + t) || v.includes('>' + t + '</th>'), 'column ' + t));
  assert(/Tổng số điểm<\/span><b>2</.test(v) && /Điện<\/span><b>1 điểm</.test(v) && /Mặt bằng<\/span><b>2 điểm</.test(v));
  assert(/Chưa tính tiền theo tháng/.test(v));
  assert.strictEqual(d.items[0].charges.electricity, true);
});
ok('charge declared "không áp dụng" by the market cannot be selected', () => {
  const prev = A.SERVICE_CFG.chargeApplicability('CL');
  A.SERVICE_CFG.setChargeApplicability('CL', { electricity: prev.electricity, water: false, service: prev.service }, 'test');
  try {
    const d = A.ui.traderWorkspace.wizard; h.go('tieu-thuong');
    assert(new RegExp(`data-id="${free[0].id}" data-key="water"[^>]*disabled`).test(view()));
    A.CH['tp-charge']({ dataset: { id: free[0].id, key: 'water' }, checked: true });
    assert.strictEqual(d.items[0].charges.water, false);
  } finally { A.SERVICE_CFG.setChargeApplicability('CL', prev, 'test'); }
});
ok('one save at the bottom: profile + rentalDraft only — no contract, no allocation, no billing; "Chờ tạo hợp đồng" + Tạo hợp đồng action', () => {
  const contracts = A.db.contracts.length, invoices = A.db.invoices.length, drafts = (A.db.billingDrafts || []).length;
  const usage = free.map(p => p.usageStatus).join();
  h.act('tp-save');
  saved = TS.list().find(t => t.idNo === 'SAMPLE-ID-501');
  assert(saved, 'saved');
  assert.strictEqual(A.db.contracts.length, contracts); assert.strictEqual(A.db.invoices.length, invoices); assert.strictEqual((A.db.billingDrafts || []).length, drafts);
  assert.strictEqual(free.map(p => p.usageStatus).join(), usage, 'points not allocated');
  assert.strictEqual(TS.rentalItems(saved).length, 2);
  assert.strictEqual(TS.deriveBusinessStatus(saved), 'PENDING_CONTRACT');
  assert.strictEqual(A.ui.traderWorkspace.wizard, null);
  assert(/data-act="tp-contracts"/.test(view()), 'Tạo hợp đồng action shown');
  assert(/Còn thiếu giấy tờ/.test(h.trace.toasts.at(-1)), 'missing documents reported, not blocking');
});
ok('saving requires Section A; duplicates still blocked', () => {
  h.act('tp-new'); const n = TS.list().length;
  h.act('tp-save');
  assert.strictEqual(TS.list().length, n); assert(/mục A/.test(h.trace.toasts.at(-1)));
  type('name', 'Người khác'); type('phone', '0977111222'); type('idNo', 'SAMPLE-ID-999'); type('address', 'x');
  h.act('tp-save');
  assert.strictEqual(TS.list().length, n); assert(/Số điện thoại đã được dùng/.test(h.trace.toasts.at(-1)));
  h.act('tp-wizard-cancel');
});
ok('edit uses the same form: add documents later, contracted point locked (cannot remove / re-charge)', () => {
  TS.markRentalItemsContracted(saved.id, { [free[0].id]: 'HD-TEST-001' });
  h.act('tp-edit', { id: saved.id });
  const d = A.ui.traderWorkspace.wizard, v = view();
  assert(/Chỉnh sửa hồ sơ tiểu thương/.test(v) && /A\. Thông tin cá nhân/.test(v) && !/tp-next/.test(v));
  assert(/HĐ HD-TEST-001/.test(v) && /Đã ký/.test(v));
  h.act('tp-remove-point', { id: free[0].id });
  assert(d.items.some(x => x.pointId === free[0].id), 'contracted point kept');
  A.CH['tp-charge']({ dataset: { id: free[0].id, key: 'water' }, checked: true });
  assert.strictEqual(d.items.find(x => x.pointId === free[0].id).charges.water, false, 'contracted charges unchanged');
  h.act('tp-remove-point', { id: free[1].id });
  assert(!d.items.some(x => x.pointId === free[1].id), 'uncontracted point removable');
  upload('cccdBack', 'cccd_back_later.png'); upload('avatar', 'chan_dung.png');
  h.act('tp-save');
  const t = TS.getProfile(saved.id);
  assert.strictEqual(t.docFiles.cccdBack.name, 'cccd_back_later.png');
  assert.strictEqual(TS.rentalItems(t).length, 1);
  assert.strictEqual(TS.rentalItems(t)[0].contractId, 'HD-TEST-001', 'contract link preserved');
});
console.log(`trader-profile-form regression PASS (${passed} checks)`);

/* Lịch nghiệp vụ (template) → kỳ thu tự động. Lịch chỉnh ở Thông báo đa kênh › Thiết lập tự động › Lịch nghiệp vụ
 * (action:thong-bao.lich-nghiep-vu — Quản trị hệ thống + Tổ trưởng), lưu ở SERVICE_CFG.billingCycle (key serviceconfig hiện có).
 * Kỳ đã tạo giữ snapshot ngày; sửa lịch chỉ áp dụng cho kỳ tạo sau. Màn tạo kỳ thủ công / Lịch & kỳ thu cũ đã retire. */
const assert = require('assert');
const path = require('path');
const { createApp } = require('./harness');

const h = createApp(path.resolve(__dirname, '../..'));
const A = h.A, S = A.features.finance.marketPeriod;
const login = id => { A.ui.currentDemoAccountId = id; A.ui.sessionAccountId = id; A.ui.market = 'CL'; A.syncAccountContext(); };
const lastToast = () => h.trace.toasts[h.trace.toasts.length - 1] || '';
const before = new Map(A.db.billingPeriods.map(p => [p.id, JSON.stringify(p)]));

// Màn cũ không còn: không có handler tạo kỳ thủ công / thiết lập lịch trong Cài đặt.
['cfg-create-period-open', 'cfg-manual-create', 'cfg-schedule-open', 'cfg-schedule-save', 'cfg-period-create'].forEach(k => assert(!A.ACT[k], 'retired ' + k));

// NV thu phí không chỉnh lịch.
login('AC-NV02');
assert(!A.canDo('thong-bao.lich-nghiep-vu'));
h.act('notification-schedule-save');
assert(/chưa được cấp quyền/.test(lastToast()), lastToast());

// Quản trị hệ thống mở và lưu lịch; thứ tự mốc sai bị từ chối.
login('AC-QT01');
A.ui.notificationTab = 'auto'; h.go('thong-bao');
assert(h.view().includes('LỊCH NGHIỆP VỤ') && h.view().includes('Lịch kỳ thu hàng tháng'));
assert(h.view().includes('data-act="notification-schedule-edit"'), 'admin sees edit');
h.act('notification-schedule-edit');
assert(h.modal().includes('CHỈNH SỬA LỊCH NGHIỆP VỤ'));
// Giả lập các ô chọn ngày của popup (DOM stub của harness không dựng phần tử từ HTML modal).
const doc = h.ctx.document, origQSA = doc.querySelectorAll;
const fields = (days, months) => sel => sel === '[data-schedule-day]' ? Object.keys(days).map(k => ({ dataset: { scheduleDay: k }, value: String(days[k]) }))
  : sel === '[data-schedule-month]' ? Object.keys(months).map(k => ({ dataset: { scheduleMonth: k }, value: months[k] })) : origQSA.call(doc, sel);
const cyc = A.SERVICE_CFG.cycle();
doc.querySelectorAll = fields({ collectionStartDay: cyc.collectionStartDay, reminder1Day: 1 }, { collectionStartMonth: 'current', reminder1Month: 'current' });
h.act('notification-schedule-save');
assert(/Nhắc thanh toán lần 1 phải sau ngày bắt đầu thu/.test(lastToast()), 'invalid order rejected: ' + lastToast());
assert.notEqual(A.SERVICE_CFG.cycle().reminder1Day, 1, 'invalid schedule not saved');
doc.querySelectorAll = fields({ dueDay: 18 }, {});
h.act('notification-schedule-save');
doc.querySelectorAll = origQSA;
assert.equal(A.SERVICE_CFG.cycle().dueDay, 18, 'valid schedule saved: ' + lastToast());
// Kỳ đã tạo giữ nguyên ngày snapshot.
assert(h.localStorage.getItem(A.SERVICE_CFG.KEY).includes('"dueDay":18'), 'schedule persists to existing config storage');
before.forEach((snap, id) => assert.equal(JSON.stringify(A.db.billingPeriods.find(p => p.id === id)), snap, 'existing period unchanged ' + id));

// Kỳ tạo SAU khi sửa lịch dùng lịch mới (snapshot).
const next = '2026-12';
A.db.today = S.scheduleDates(next).preparationDate;
const out = S.ensurePeriodsForCurrentCycle();
assert.equal(out.month, next);
assert.equal(S.get('CL', next).dueDate, '2026-12-18', 'new period uses the updated template');
assert.equal(S.get('CL', next).source, 'auto');
// Tổ trưởng cũng có quyền chỉnh lịch.
login('AC-NV01');
assert(A.canDo('thong-bao.lich-nghiep-vu'));
console.log('schedule-periods: OK');

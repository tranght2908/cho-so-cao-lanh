/* Cổng tiểu thương: bấm Thanh toán → mở thẳng mã QR + tổng tiền. Không còn bước chọn phương thức, không có tiền mặt;
 * QR luôn cho TOÀN BỘ số tiền còn phải nộp của khoản thu. Dữ liệu: kỳ 11/2026 đã phát hành (opts.seedIssue). */
const assert = require('assert');
const path = require('path');
const { createApp } = require('./harness');

const h = createApp(path.resolve(__dirname, '../..'), { seedIssue: true });
const A = h.A, U = A.U;
const inv = A.db.invoices.find(i => i.traderId === 'TT0001' && i.period === '2026-11');
assert(inv && inv.status === 'unpaid');

A.ui.sessionAccountId = 'AC-TT01'; A.ui.currentDemoAccountId = 'AC-TT01'; A.ui.market = 'CL'; A.syncAccountContext();
Object.assign(A.ui.mini, { traderId: 'TT0001', step: 'app', tab: 'pay' });
h.go('mini-app');

h.act('tp-pay-method', { id: inv.id });
const m = h.modal();
assert(m.includes('Thanh toán bằng mã QR'), 'mở thẳng màn QR');
assert(m.includes('Tổng cần thanh toán') && m.includes(U.money(U.due(inv))), 'có tổng tiền');
assert(/<svg|<img|tp-pay-qr/.test(m) && m.includes('tp-pay-qr'), 'có mã QR');
assert(m.includes('0071001234567'), 'có số tài khoản thu của chợ');
assert(!/Chọn phương thức|Tiền mặt|tp-pay-choose/.test(m), 'không còn chọn phương thức / tiền mặt');
assert(!A.ACT['tp-pay-choose'] && !A.ACT['tp-pay-continue'], 'handler cũ đã gỡ');

// Bước tiếp theo vẫn hoạt động: ghi nhận ý định chuyển khoản đúng TOÀN BỘ số tiền, chưa tạo payment.
const before = A.db.payments.length;
h.act('tp-pay-transfer-start', { id: inv.id });
const intent = A.db.bank.find(x => x.intentType === 'TRADER_TRANSFER' && x.invoiceId === inv.id);
assert(intent && intent.amount === U.due(inv));
assert.strictEqual(A.db.payments.length, before);

console.log('trader pay QR direct regression PASS');

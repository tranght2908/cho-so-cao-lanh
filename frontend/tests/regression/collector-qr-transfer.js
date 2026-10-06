/* THU_CK_QUA_MA_QR: NV thu phí chọn Chuyển khoản → hiện mã QR của chính khoản (giống app tiểu thương) → tiểu thương quét →
 * chờ ghi nhận → ngân hàng báo có (mô phỏng) → thành công + biên lai; app tiểu thương tự thấy Đã thanh toán + biên lai.
 * NV thu phí không tự xác nhận tiền chuyển khoản; quyền thu-tien.thu + marketScopes được kiểm tra lại ở handler. */
const assert = require('assert');
const path = require('path');
const { createApp } = require('./harness');

const h = createApp(path.resolve(__dirname, '../..'), { seedIssue: true });
const A = h.A, U = A.U, R = A.features.finance.receipt;
const login = (id, market) => { A.ui.sessionAccountId = id; A.ui.currentDemoAccountId = id; A.ui.market = market; A.syncAccountContext(); };
const inv = A.db.invoices.find(i => i.traderId === 'TT0001' && i.period === '2026-11');
const other = A.db.invoices.find(i => i.traderId === 'TT0009' && i.period === '2026-11');
const intentOf = id => A.db.bank.find(x => x.intentType === 'TRADER_TRANSFER' && x.invoiceId === id);
assert(inv.status === 'unpaid' && other.status === 'unpaid');

// Tài khoản không có quyền thu tiền gọi thẳng handler → không tạo ý định chuyển khoản, không thu.
login('AC-LD01', 'CL');
A.ui.ttPay = { invId: other.id, method: 'transfer', amount: null, note: '' };
h.act('tt-pay-transfer-start', {});
h.act('tt-pay-demo-bank', {});
assert(!intentOf(other.id) && other.status === 'unpaid', 'không quyền → không đổi dữ liệu');

// NV thu phí phụ trách chợ: Thu tiền → Chuyển khoản → mã QR của chính khoản.
login('AC-NV02', 'CL');
h.go('thu-tien');
h.act('tt-pay-open', { id: inv.id });
A.CH['tt-pay-method']({ value: 'transfer' });
let m = h.modal();
assert(m.includes('tp-pay-qr') && m.includes('Đưa tiểu thương quét mã QR'), 'có mã QR');
assert(m.includes('CHOSO ' + inv.id) && m.includes('0071001234567') && m.includes(U.money(U.due(inv))), 'đúng nội dung, tài khoản, số tiền');
assert(m.includes('data-act="tt-pay-transfer-start"'));

// Tiểu thương quét → chờ ghi nhận (chưa có payment).
const payBefore = A.db.payments.length;
h.act('tt-pay-transfer-start', {});
const intent = intentOf(inv.id);
assert(intent && intent.status === 'PENDING' && intent.source === 'COLLECTOR_QR' && intent.amount === U.due(inv));
assert.strictEqual(A.db.payments.length, payBefore, 'NV không tự xác nhận tiền chuyển khoản');
assert(h.modal().includes('Đang chờ ghi nhận giao dịch') && h.modal().includes('tt-pay-demo-bank'));
h.act('tt-pay-refresh', {});
assert(inv.status === 'unpaid' && h.trace.toasts.some(x => /Chưa có giao dịch được ghi nhận/.test(x)));

// Ngân hàng báo có (mô phỏng) → thu đủ, người thu = Hệ thống, ý định đã khớp → màn thành công.
h.act('tt-pay-demo-bank', {});
const pay = A.db.payments.filter(x => x.invoiceId === inv.id).pop();
assert(inv.status === 'paid' && pay && pay.method === 'ck' && pay.amount === inv.amount);
assert.strictEqual(intent.status, 'MATCHED');
m = h.modal();
assert(m.includes('ĐÃ GHI NHẬN CHUYỂN KHOẢN') && m.includes(pay.receipt) && m.includes('data-act="tt-receipt"'));
h.act('tt-receipt', { id: pay.receipt });
assert(h.modal().includes(R.html(pay)), 'NV xem biên lai mẫu chung');

// App tiểu thương: khoản đã thanh toán + biên lai điện tử cùng mẫu + thông báo thanh toán.
A.closeModal();
login('AC-TT01', 'CL');
Object.assign(A.ui.mini, { traderId: 'TT0001', step: 'app', tab: 'pay' });
h.go('mini-app');
h.act('tp-pay-receipt', { id: pay.id });
assert(h.modal().includes(R.html(pay)), 'tiểu thương có cùng biên lai');
assert(A.db.notifications.some(n => n.traderId === 'TT0001' && /PAYMENT_SUCCESS/.test(String(n.eventKey || n.kind))), 'tiểu thương nhận thông báo thanh toán');

console.log('collector QR transfer regression PASS');

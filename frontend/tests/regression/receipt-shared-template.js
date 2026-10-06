/* Biên lai: cổng Tiểu thương và màn Thu tiền & biên lai (NV thu phí) dùng CÙNG mẫu (features/finance/receipt.js)
 * cho cùng một giao dịch. Dữ liệu: kỳ 11/2026 đã phát hành (opts.seedIssue), bà Hoa chuyển khoản đủ. */
const assert = require('assert');
const path = require('path');
const { createApp } = require('./harness');

const h = createApp(path.resolve(__dirname, '../..'), { seedIssue: true });
const A = h.A, U = A.U, R = A.features.finance.receipt;
assert(R && typeof R.html === 'function', 'mẫu biên lai dùng chung');
const inv = A.db.invoices.find(i => i.traderId === 'TT0001' && i.period === '2026-11');
const pays = A.applyPayment([inv.id], U.due(inv), 'ck', 'Hệ thống');
const pay = pays[pays.length - 1];
assert(pay && inv.status === 'paid' && A.receiptBusinessStateOk(pay));
const expected = R.html(pay);
['BIÊN LAI THU TIỀN', pay.receipt, pay.id, pay.lookup, inv.id, 'Mã khoản phải thu', 'NV thu phí', 'Ngày thu', 'Mặt bằng 12/2026', 'Điện 11/2026', 'Nước 11/2026'].forEach(x => assert(expected.includes(x), 'mẫu có ' + x));

// Tiểu thương xem biên lai của chính mình.
A.ui.sessionAccountId = 'AC-TT01'; A.ui.currentDemoAccountId = 'AC-TT01'; A.ui.market = 'CL'; A.syncAccountContext();
Object.assign(A.ui.mini, { traderId: 'TT0001', step: 'app', tab: 'pay' });
h.go('mini-app');
h.act('tp-pay-receipt', { id: pay.id });
const trader = h.modal();
assert(trader.includes(expected), 'tiểu thương thấy đúng mẫu biên lai chung');
assert(trader.includes('data-act="print"') && !trader.includes('tt-receipt-send'), 'tiểu thương: In / Đóng, không gửi lại');

// NV thu phí phụ trách chợ xem cùng biên lai.
A.closeModal();
A.ui.sessionAccountId = 'AC-NV02'; A.ui.currentDemoAccountId = 'AC-NV02'; A.ui.market = 'CL'; A.syncAccountContext();
h.go('thu-tien');
h.act('tt-receipt', { id: pay.receipt });
assert(h.modal().includes(expected), 'NV thu phí thấy cùng biên lai');

console.log('receipt shared template regression PASS');

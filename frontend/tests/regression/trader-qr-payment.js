/* Nguyễn Thị Thanh Trúc: QR nằm trong chi tiết khoản, báo có tạo payment/biên lai dùng chung cho phía thu phí. */
const assert = require('assert');
const path = require('path');
const { createApp } = require('./harness');

const h = createApp(path.resolve(__dirname, '../..'));
const A = h.A;
const trader = A.idx.trader.get('TT0048');
assert(trader, 'missing TT0048 fixture');
const account = A.createLinkedTraderAccount(trader, trader.phone);
A.ui.sessionAccountId = account.id;
A.ui.market = 'CL';
A.syncAccountContext();
Object.assign(A.ui.mini, { traderId: trader.id, portalNav: 'finance', step: 'app' });

const invoice = A.db.invoices.find(i => i.traderId === trader.id && i.period === '2026-09');
assert(invoice, 'missing current invoice for TT0048');
assert.strictEqual(A.U.due(invoice) > 0, true, 'fixture invoice must be unpaid');
const before = A.db.payments.length;

const financeHtml = A.VIEWS['mini-app']();
assert(!financeHtml.includes('Mã QR thanh toán'), 'finance landing must not show the former large QR panel');
h.act('portal-inv-detail', { id: invoice.id });
assert(h.modal().includes('HÓA ĐƠN / KHOẢN PHẢI NỘP'));
assert(h.modal().includes('Giả lập thanh toán QR thành công'));

// Direct mutation with the wrong selected market is denied even if a caller invokes the handler manually.
A.ui.market = 'TTD';
h.act('mini-paid', { id: invoice.id });
assert.strictEqual(A.db.payments.length, before, 'wrong SelectedMarket must be denied');

const deniedCollector = A.ACCOUNTS.list().find(a => A.ACCOUNTS.primaryRole(a) === 'collector' && A.allowedMarkets(a).includes('CL'));
assert(deniedCollector, 'missing denied-role fixture');
A.ui.sessionAccountId = deniedCollector.id;
A.ui.market = 'CL';
A.syncAccountContext();
h.act('mini-paid', { id: invoice.id });
assert.strictEqual(A.db.payments.length, before, 'collector must not invoke trader QR payment');

A.ui.sessionAccountId = account.id;
A.ui.market = 'CL';
A.syncAccountContext();
Object.assign(A.ui.mini, { traderId: trader.id, portalNav: 'finance', step: 'app' });

h.act('mini-paid', { id: invoice.id });
const payment = A.db.payments[A.db.payments.length - 1];
assert.strictEqual(A.db.payments.length, before + 1);
assert.strictEqual(invoice.status, 'paid');
assert.strictEqual(payment.method, 'qr');
assert.strictEqual(payment.paymentStatus, 'SUCCESS');
assert(payment.receipt && payment.bankAccountId, 'QR payment must snapshot receipt and receiving account');
assert(h.modal().includes('BIÊN LAI THU TIỀN ĐIỆN TỬ'));
assert(h.modal().includes('Quét mã QR'));
assert(h.modal().includes('Thanh toán thành công'));

// The collector responsible for one part sees the same successful QR receipt and can open its detail.
const part = A.invParts(invoice)[0];
const collector = A.ACCOUNTS.get(part.collectorId);
assert(collector, 'missing assigned collector');
A.ui.sessionAccountId = collector.id;
A.ui.market = 'CL';
A.syncAccountContext();
A.ui.period = invoice.period;
const collectHtml = A.VIEWS['thu-tien']();
assert(collectHtml.includes('Đã thu · QR thành công'));
assert(collectHtml.includes(payment.receipt));
h.act('inv-open', { id: invoice.id });
assert(h.modal().includes(payment.receipt));
assert(h.modal().includes('Quét mã QR'));
assert(h.modal().includes('Thành công'));

console.log('trader QR payment regression PASS');

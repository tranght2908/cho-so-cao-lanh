/* KY_11_DA_PHAT_HANH: dữ liệu mẫu nạp như trình duyệt (opts.seedIssue) → kỳ 11/2026 đã phát hành qua đúng luồng thật,
 * tiểu thương có khoản chưa thu + thông báo phát hành để dùng màn thanh toán QR. Chạy lại không phát hành trùng. */
const assert = require('assert');
const path = require('path');
const { createApp } = require('./harness');

const ROOT = path.resolve(__dirname, '../..'), M = '2026-11';
const h = createApp(ROOT, { seedIssue: true });
const A = h.A, S = A.features.finance.marketPeriod;
assert.strictEqual(A.db.seedIssue.status, 'DONE');
['CL', 'TTD'].forEach(m => assert.strictEqual(S.stateOf(m, M).id, 'COLLECTING', m + ' đang thu'));

const issued = A.db.invoices.filter(i => i.period === M);
assert(issued.length > 0 && issued.every(i => i.status === 'unpaid' && !(Number(i.paid) > 0)), 'chỉ khoản chưa thu');
['TT0001', 'TT0003', 'TT0009', 'TTD-CQ'].forEach(tid => {
  const inv = issued.find(i => i.traderId === tid);
  assert(inv, tid + ' có khoản kỳ 11');
  assert(inv.due >= A.db.today, tid + ' còn trong hạn');
  const n = A.db.notifications.find(x => x.kind === 'RECEIVABLE_ISSUED' && x.traderId === tid && x.receivableId === inv.id);
  assert(n && /11\/2026/.test(n.title), tid + ' nhận thông báo phát hành');
});
assert(A.db.notifications.some(x => x.kind === 'RECEIVABLE_ISSUED' && x.recipientType === 'FEE_COLLECTOR'), 'NV thu phí nhận thông báo');

// Nạp lại từ localStorage: không phát hành / gửi thông báo trùng.
const again = createApp(ROOT, { seedIssue: true, storage: { 'choso-caolanh-state': h.localStorage.getItem('choso-caolanh-state') } });
assert.strictEqual(again.A.db.invoices.filter(i => i.period === M).length, issued.length);
assert.strictEqual(again.A.db.notifications.filter(x => x.kind === 'RECEIVABLE_ISSUED').length, A.db.notifications.filter(x => x.kind === 'RECEIVABLE_ISSUED').length);

// Mặc định của harness: kỳ 11 vẫn ở bước ghi chỉ số cho các test luồng thu phí.
const plain = createApp(ROOT).A;
assert.strictEqual(plain.features.finance.marketPeriod.stateOf('CL', M).id, 'METER_RECORDING');

console.log('seed issued period regression PASS');

/* Focused regression: luồng thu phí chuẩn hóa theo KỲ CỦA CHỢ (MarketPeriod = marketId + YYYY-MM).
 * Tự tạo kỳ theo Lịch nghiệp vụ → NOT_APPLICABLE → ghi/hoàn tất chỉ số (NV) → tự tính nháp → phát hành KỲ THU đồng loạt →
 * thu tiền mặt / chuyển khoản → chốt buổi → Hoàn tất thu & chuyển đối soát → đối soát (NEEDS_RESOLUTION → RECONCILED)
 * → chốt kỳ tháng → khóa. Kiểm tra cả: không còn Công nợ, permission/menu, thông báo, mã biên lai, migration kỳ legacy. */
const assert = require('assert');
const path = require('path');
const { createApp } = require('./harness');

const ROOT = path.resolve(__dirname, '../..');
let passed = 0;
const ok = (label, fn) => { try { fn(); passed++; } catch (e) { e.message = label + ': ' + e.message; throw e; } };

const h = createApp(ROOT), A = h.A, S = A.features.finance.marketPeriod, B = A.features.finance.billing;
const login = (id, market) => { A.ui.currentDemoAccountId = id; A.ui.sessionAccountId = id; if (market) A.ui.market = market; A.syncAccountContext(); };
const M = '2026-11', cl = () => S.get('CL', M), ttd = () => S.get('TTD', M), state = (m, month) => S.stateOf(m, month || M).id;
const lastToast = () => h.trace.toasts[h.trace.toasts.length - 1] || '';

ok('migration: legacy month periods split per market, legacy kept read-only', () => {
  const legacy = A.db.billingPeriods.filter(p => !p.marketId);
  assert(legacy.length && legacy.every(p => p.superseded && p.legacyPeriod), 'legacy records kept + superseded');
  assert.strictEqual(A.db.billingPeriods.filter(p => p.marketId && p.period === M).length, S.activeMarkets().length, 'one period per active market');
  assert.strictEqual(A.periods.resolve('CL', M).id, 'CL_' + M);
  assert(A.db.invoices.every(i => /_/.test(i.billingPeriodId || '')), 'invoices re-pointed to market periods');
  assert.strictEqual(state('CL', '2026-08'), 'COMPLETED'); assert.strictEqual(state('HA', '2026-08'), 'NOT_APPLICABLE');
  assert(S.isClosed(S.get('CL', '2026-08')), 'past legacy month is read-only');
});

ok('CASE 1: periods auto-created from Lịch nghiệp vụ, idempotent, with schedule snapshot', () => {
  const today = A.db.today, next = '2026-12', prep = S.scheduleDates(next).preparationDate;
  A.db.today = prep;
  const out = S.ensurePeriodsForCurrentCycle();
  assert.strictEqual(out.month, next);
  assert.strictEqual(out.created.length, S.activeMarkets().length, 'one period per active market');
  const mp = S.get('CL', next);
  ['preparationDate', 'meterReadDate', 'startDate', 'reminder1Date', 'reminder2Date', 'dueDate', 'endDate'].forEach(k => assert(mp[k] && mp.scheduleSnapshot[k] === mp[k], 'snapshot ' + k));
  assert.strictEqual(S.ensurePeriodsForCurrentCycle().created.length, 0, 'no duplicates on re-run');
  assert(!S.get('CL', '2026-10'), 'missing past month 10/2026 is not back-filled');
  // Lịch sửa sau đó không đổi ngày đã snapshot.
  const before = mp.dueDate; A.SERVICE_CFG.updateCycle({ dueDay: 20 }, 'test'); assert.strictEqual(S.get('CL', next).dueDate, before);
  A.SERVICE_CFG.updateCycle({ dueDay: 15 }, 'test');
  A.db.today = today;
});

ok('CASE 2: market without business objects is NOT_APPLICABLE and does not block closing', () => {
  assert.strictEqual(state('HA'), 'NOT_APPLICABLE');
  const sum = S.monthSummary(M);
  assert(!sum.pending.some(r => r.market.id === 'HA'), 'HA not pending');
  assert.strictEqual(sum.notApplicable, S.activeMarkets().length - 2, '10 markets not applicable');
});

ok('CASE 6: a NEEDS_REVIEW reading blocks meter completion', () => {
  login('AC-NV02', 'CL');
  const r = S.readingOf(cl(), S.meterPoints(cl())[0].id);
  r.reviewRequired = true; r.reviewReason = 'Chỉ số cần xác minh.';
  assert.strictEqual(S.readingState(r), 'NEEDS_REVIEW');
  assert(!S.canCompleteMeter(cl()));
  h.act('mr-complete-confirm', { period: M });
  assert(!cl().meter, 'not completed');
  // NV kiểm tra và xác nhận chỉ số đúng → hết chặn.
  h.go('dien-nuoc');
  h.act('mr-review-open', { id: r.stallId, period: M });
  h.el('#mr-review-elec').value = String(r.elecCur); h.el('#mr-review-water').value = String(r.waterCur);
  const radio = { value: 'CONFIRMED' }, orig = A.$; A.$ = sel => sel === 'input[name="mr-review-result"]:checked' ? radio : orig(sel);
  h.act('mr-review-confirm', { id: r.stallId, period: M });
  A.$ = orig;
  assert.strictEqual(S.readingState(r), 'RECORDED', lastToast());
  assert(S.readingConfirmed(r));
});

ok('CASE 5: only the fee collector completes meter readings → METER_COMPLETED → auto-calculated draft', () => {
  login('AC-NV01', 'CL');
  assert(!A.canDo('dien-nuoc.chot-ky', 'CL'), 'Tổ trưởng cannot complete meter (BR-03)');
  login('AC-NV02', 'CL');
  assert(S.canCompleteMeter(cl()));
  h.act('mr-complete-confirm', { period: M });
  assert.strictEqual(cl().meter.status, 'COMPLETED');
  assert(cl().calculatedAt, 'system calculated drafts right after completion');
  assert.strictEqual(state('CL'), 'READY_TO_ISSUE');
  // BR-05: mặt bằng tháng kế tiếp, điện/nước tháng của kỳ.
  const d = B.drafts('CL', cl().id);
  assert(d.some(x => x.items[0].chargeType === 'LAND' && x.items[0].feePeriod === '2026-12'));
  assert(d.some(x => x.items[0].chargeType === 'ELECTRICITY' && x.items[0].feePeriod === M));
});

ok('service level: issuing one market period never touches another market (separate instance)', () => {
  const x = createApp(ROOT), XA = x.A, XS = XA.features.finance.marketPeriod, XB = XA.features.finance.billing;
  XA.ui.currentDemoAccountId = 'AC-NV02'; XA.ui.sessionAccountId = 'AC-NV02'; XA.ui.market = 'CL'; XA.syncAccountContext();
  assert(XS.completeMeter('CL', M, XA.currentAccount()).ok);
  XA.ui.currentDemoAccountId = 'AC-NV07'; XA.ui.sessionAccountId = 'AC-NV07'; XA.ui.market = 'TTD'; XA.syncAccountContext();
  assert(XS.completeMeter('TTD', M, XA.currentAccount()).ok);
  assert(XB.issue('CL', XS.get('CL', M).id, 'svc').issued.length > 0);
  assert.strictEqual(XS.stateOf('CL', M).id, 'COLLECTING');
  assert.strictEqual(XS.stateOf('TTD', M).id, 'READY_TO_ISSUE', 'TTD unchanged (not COLLECTING)'); assert(!XS.isIssued(XS.get('TTD', M)));
  assert(!XB.calculatePeriod('TTD', XS.get('TTD', M).id, 'x').warnings.some(w => w.code === 'PERIOD_ALREADY_ISSUED'), 'TTD not blocked');
});

ok('ISSUE CASE 2 + 7 + 8: not every market ready → "Phát hành kỳ thu" disabled; no market issued on its own', () => {
  // Dựng tình huống thiếu biểu phí: tạm ngừng giá mặt bằng demo của TTD qua đúng store cấu hình (không sửa khoản phải thu).
  assert(A.SERVICE_CFG.get('stallPrices', 'sp-ttd-demo-covered'), 'TTD demo land price present');
  A.SERVICE_CFG.update('stallPrices', 'sp-ttd-demo-covered', { status: 'inactive' }, 'test', 'Tạm ngừng (test)');
  login('AC-NV07', 'TTD');
  h.act('mr-complete-confirm', { period: M });
  assert.strictEqual(ttd().meter.status, 'COMPLETED');
  assert.strictEqual(state('TTD'), 'NEEDS_ACTION', 'TTD has a missing land price');
  assert.strictEqual(state('CL'), 'READY_TO_ISSUE');
  const sum = S.issueSummary(M);
  assert(!sum.canIssue && sum.blocking.length === 1 && sum.blocking[0].market.id === 'TTD');
  login('AC-NV01', 'CL'); A.ui.periodMonitorPeriod = M; h.go('theo-doi-ky-thu');
  const v = h.view();
  assert(/data-act="period-monitor-issue-open" disabled/.test(v), 'button disabled');
  assert(v.includes('Còn 1 chợ chưa đủ điều kiện phát hành.'), 'short blocking alert (names are in the market table)');
  assert(!v.includes('period-monitor-batch') && !v.includes('Phát hành tất cả chợ đã sẵn sàng'), 'old batch button gone');
  h.act('period-monitor-issue-confirm', { period: M });
  assert(!S.isIssued(cl()) && !S.isIssued(ttd()), 'nothing issued while one market blocks');
  ['pt-publish-open', 'pt-publish-confirm', 'pt-issue', 'period-monitor-batch'].forEach(k => assert(!A.ACT[k], 'retired handler ' + k));
});

ok('ISSUE CASE 3 + 4: clicking a market opens its Khoản phải thu — "Sẵn sàng phát hành", no issue button', () => {
  login('AC-NV01', 'CL'); A.ui.periodMonitorPeriod = M; h.go('theo-doi-ky-thu');
  h.act('period-monitor-open', { market: 'CL', period: M });
  assert.strictEqual(A.current, 'phai-thu');
  const v = h.view();
  assert(v.includes('Kỳ 11/2026 · Chợ Cao Lãnh'), 'context header');
  assert(v.includes('Sẵn sàng phát hành'), 'ready status');
  assert(v.includes('Khoản phải thu hợp lệ'), 'validity check row');
  assert(!/Phát hành \d+ khoản phải thu/.test(v) && !v.includes('pt-publish'), 'no issue button on Khoản phải thu');
  assert(v.includes('data-act="pt-back-monitor"'), 'back link to Theo dõi kỳ thu');
});

ok('ISSUE CASE 1 + 5 + 6 (+ atomic rollback): all READY/NOT_APPLICABLE → issue whole period; NOT_APPLICABLE untouched', () => {
  // Người dùng kích hoạt lại đơn giá mặt bằng của TTD tại Chính sách thu và biểu phí (SERVICE_CFG)
  // → hệ thống TỰ tính lại nháp → TTD sang Sẵn sàng phát hành, không sửa khoản phải thu.
  assert.strictEqual(state('TTD'), 'NEEDS_ACTION', 'still NEEDS_ACTION before the price is configured');
  A.SERVICE_CFG.update('stallPrices', 'sp-ttd-demo-covered', { status: 'active' }, 'Quản trị', 'Áp dụng lại');
  assert.strictEqual(state('TTD'), 'READY_TO_ISSUE', 'auto-recalculated after fee configuration changed');
  login('AC-NV01', 'TTD'); h.go('phai-thu'); A.ui.f.ptPeriod = ttd().id;
  h.act('pt-calc');
  assert.strictEqual(state('TTD'), 'READY_TO_ISSUE', 'manual Tính lại keeps READY: ' + lastToast());
  const sum = S.issueSummary(M);
  assert(sum.canIssue && sum.ready.length === 2 && sum.notApplicable.length === S.activeMarkets().length - 2);
  login('AC-NV02', 'CL');
  assert(!A.canDo('theo-doi-ky-thu.phat-hanh-ky'), 'collector cannot issue');
  login('AC-NV01', 'CL'); A.ui.periodMonitorPeriod = M; h.go('theo-doi-ky-thu');
  assert(/data-act="period-monitor-issue-open" >/.test(h.view()) || /data-act="period-monitor-issue-open"\s*>/.test(h.view()), 'button enabled');
  h.act('period-monitor-issue-open');
  const modal = h.modal();
  assert(modal.includes('PHÁT HÀNH KỲ THU 11/2026') && modal.includes('Chợ có khoản phải thu') && modal.includes('Tổng dự kiến thu') && modal.includes('Xác nhận phát hành'), 'confirmation popup');
  // Lỗi giữa chừng khi ghi chợ thứ 2 → khôi phục toàn bộ, không chợ nào ở trạng thái nửa phát hành.
  const invoicesBefore = A.db.invoices.length, realIssue = B.issue;
  let calls = 0;
  B.issue = function () { calls++; if (calls === 2) throw new Error('mô phỏng lỗi ghi'); return realIssue.apply(this, arguments); };
  h.act('period-monitor-issue-confirm', { period: M });
  B.issue = realIssue;
  assert.strictEqual(A.db.invoices.length, invoicesBefore, 'rollback: no invoice kept');
  assert(!S.isIssued(cl()) && !S.isIssued(ttd()), 'rollback: no market issued');
  assert.strictEqual(state('CL'), 'READY_TO_ISSUE'); assert.strictEqual(state('TTD'), 'READY_TO_ISSUE');
  assert(/đã khôi phục/.test(lastToast()), lastToast());
  // Phát hành thật.
  h.act('period-monitor-issue-open');
  h.act('period-monitor-issue-confirm', { period: M });
  assert.strictEqual(state('CL'), 'COLLECTING', lastToast()); assert.strictEqual(state('TTD'), 'COLLECTING');
  assert.strictEqual(state('HA'), 'NOT_APPLICABLE');
  assert.strictEqual(S.invoices(S.get('HA', M)).length, 0, 'no empty invoice for NOT_APPLICABLE');
  assert(!S.issueSummary(M).ready.length, 'no market left READY_TO_ISSUE');
  assert(A.db.notifications.some(n => n.kind === 'RECEIVABLE_ISSUED' && n.market === 'CL') && A.db.notifications.some(n => n.kind === 'RECEIVABLE_ISSUED' && n.market === 'TTD'), 'RECEIVABLE_ISSUED sent');
  assert(A.db.extraLog.some(x => /Phát hành kỳ thu 11\/2026/.test(x.what)), 'period-level audit');
  h.go('theo-doi-ky-thu');
  const v = h.view();
  assert(!v.includes('data-act="period-monitor-issue-open"'), 'issue action gone after issuance');
  assert(v.includes('0/' + S.invoices(cl()).length), 'collection progress 0/N');
});

ok('ISSUE CASE 9: phai-thu.phat-hanh retired; issue/recalculate have their own permissions', () => {
  const keys = A.PERM.CATALOG.map(p => p.key);
  assert(!keys.includes('action:phai-thu.phat-hanh'));
  assert(!A.PERM.roles().some(r => A.PERM.hasPerm(r.id, 'action:phai-thu.phat-hanh')));
  assert(A.PERM.hasPerm('market_manager', 'action:theo-doi-ky-thu.phat-hanh-ky') && A.PERM.hasPerm('market_manager', 'action:phai-thu.tinh-lai'));
  assert(A.PERM.hasPerm('collector', 'screen:phai-thu'), 'collectors keep viewing Khoản phải thu');
});

function payAllCash(market, collector) {
  login(collector, market); h.go('thu-tien');
  S.invoices(S.get(market, M)).filter(i => i.status !== 'paid').forEach(i => {
    h.act('tt-pay-open', { id: i.id });
    A.ui.ttPay.amount = A.U.due(i);
    h.act('tt-pay-commit');
  });
}

ok('CASE 7: unpaid invoices block Hoàn tất thu', () => {
  login('AC-NV02', 'CL'); h.go('thu-tien');
  assert.strictEqual(state('CL'), 'COLLECTING');
  h.act('tt-finish-confirm');
  assert(!cl().collection, 'no handoff while unpaid');
  assert(/Chưa đủ điều kiện hoàn tất thu/.test(lastToast()), lastToast());
  assert(!/PROTOTYPE|mô phỏng chốt kỳ/.test(h.view()), 'no demo bypass');
});

ok('transfer E2E: trader intent persists, matched bank payment updates every canonical reader once', () => {
  const inv = S.invoices(cl()).find(i => i.status !== 'paid' && A.ACCOUNTS.byTraderId(i.traderId));
  const account = A.ACCOUNTS.byTraderId(inv.traderId), due = A.U.due(inv), payBefore = A.db.payments.length;
  login(account.id, 'CL');
  Object.assign(A.ui.mini, { traderId: inv.traderId, step: 'app', tab: 'pay' }); h.go('mini-app');
  h.act('tp-pay-method', { id: inv.id });
  h.act('tp-pay-choose', { id: inv.id, method: 'transfer' });
  h.act('tp-pay-continue', { id: inv.id });
  h.act('tp-pay-transfer-start', { id: inv.id });
  const intent = A.db.bank.find(x => x.intentType === 'TRADER_TRANSFER' && x.invoiceId === inv.id);
  assert(intent && intent.status === 'PENDING' && intent.amount === due && intent.traderId === inv.traderId && intent.marketId === 'CL');
  assert.strictEqual(A.db.payments.length, payBefore, 'intent is not a payment');
  assert.strictEqual(inv.status, 'unpaid');
  const refreshed = createApp(ROOT, { storage: { 'choso-caolanh-state': h.localStorage.getItem('choso-caolanh-state') } }).A;
  assert(refreshed.db.bank.some(x => x.id === intent.id && x.status === 'PENDING'), 'pending intent survives reload');

  h.act('tp-pay-demo-bank', { id: inv.id });
  const pays = A.db.payments.filter(p => p.invoiceId === inv.id);
  assert.strictEqual(pays.length, 1);
  const pay = pays[0];
  assert.strictEqual(A.db.payments.length, payBefore + 1);
  assert.strictEqual(pay.method, 'ck');
  assert.strictEqual(pay.amount, due);
  assert(new RegExp('^BL' + A.db.today.slice(2, 7).replace('-', '') + '-\\d{6}$').test(pay.receipt), pay.receipt);
  assert.strictEqual(intent.status, 'MATCHED');
  assert.strictEqual(inv.status, 'paid'); assert.strictEqual(A.U.due(inv), 0);
  // PAYMENT_SUCCESS is emitted through the canonical dispatcher. The payment
  // id is part of its idempotency key; legacy PAYMENT_RECEIPT is retired.
  assert(A.db.notifications.some(n => n.eventKey === 'PAYMENT_SUCCESS'
    && n.traderId === inv.traderId && String(n.notificationKey || '').includes(pay.id)), 'PAYMENT_SUCCESS notification');
  assert.strictEqual(A.NOTIFICATIONS.dispatchEvent('PAYMENT_SUCCESS', { period: cl(), paymentId: pay.id, invoiceId: inv.id, traderId: inv.traderId, marketId: 'CL', amount: due, receiptCode: pay.receipt, paidAt: pay.paidAt }), 0, 'notification is idempotent');
  assert.strictEqual(A.applyPayment([inv.id], due, 'tm', 'NV02').length, 0, 'cash service blocks duplicate collection');
  assert(!(A.db.cashHandovers || []).some(x => (x.paymentIds || []).includes(pay.id)), 'bank payment excluded from cash handover');
  login('AC-NV02', 'CL'); h.go('thu-tien');
  // Danh sách xếp "Chưa thu" trước và phân trang 20 dòng → lọc "Đã thu" qua đúng bộ lọc của màn.
  h.act('tt-status', { id: 'PAID' });
  const row = h.view().split('<tr>').find(r => r.includes(inv.id)) || '';
  assert(row.includes(pay.receipt) && row.includes('Chuyển khoản') && row.includes('Đã thu đủ'), 'collector reads same paid transfer and receipt');
  assert(!row.includes('data-act="tt-pay-open"'), 'no Thu tiền button on a transfer-paid receivable');
  h.act('tt-tab', { id: 'tx' });
  assert(h.view().includes(pay.receipt) && h.view().includes('Chuyển khoản'), 'transaction tab lists the transfer');
  h.act('tt-tab', { id: 'list' }); h.act('tt-status', { id: 'all' });
});

ok('BANK: transaction needing review blocks Hoàn tất thu; Kế toán matches it manually (MATCHED_MANUAL + audit)', () => {
  const inv = S.invoices(cl()).find(i => i.status !== 'paid'), due = A.U.due(inv);
  const line = { id: 'SK-REVIEW-1', date: A.db.today, time: '09:00', amount: due, ref: 'CK tien cho ' + inv.id, market: 'CL', bankName: 'Vietcombank', status: 'NEEDS_REVIEW', matched: false, log: [] };
  A.db.bank.push(line);
  assert(!S.collectionChecklist(cl()).items.find(x => x.key === 'BANK').ok, 'review line blocks completion');
  login('AC-NV02', 'CL');
  assert(!A.canDo('theo-doi-ky-doi-soat.xu-ly-ngan-hang'), 'collector cannot resolve bank transactions');
  login('AC-KTTT01'); h.go('theo-doi-ky-doi-soat');
  assert(h.view().includes('Giao dịch ngân hàng cần tra soát') && h.view().includes('data-act="rc-bank-open" data-id="SK-REVIEW-1"'));
  h.act('rc-bank-open', { id: line.id });
  assert(h.modal().includes('Xử lý giao dịch ngân hàng cần tra soát'));
  const bankBefore = A.db.bank.length, paysBefore = A.db.payments.length;
  Object.assign(A.ui.rcBankDraft, { invoiceId: inv.id, amount: String(due - 1000), note: 'Đối chiếu sao kê' });
  h.act('rc-bank-match', { id: line.id });
  assert.strictEqual(line.status, 'NEEDS_REVIEW', 'wrong confirmed amount refused: ' + lastToast());
  Object.assign(A.ui.rcBankDraft, { amount: String(due), note: '' });
  h.act('rc-bank-match', { id: line.id });
  assert.strictEqual(line.status, 'NEEDS_REVIEW', 'note required');
  Object.assign(A.ui.rcBankDraft, { note: 'Tiểu thương ghi sai nội dung CK — đối chiếu sao kê ngày ' + A.db.today });
  h.act('rc-bank-match', { id: line.id });
  assert.strictEqual(line.status, 'MATCHED_MANUAL', lastToast());
  assert(line.matchedBy && line.receivableId === inv.id && line.paymentId && line.log.length === 1, 'history kept on the line');
  assert.strictEqual(inv.status, 'paid', 'receivable settled by the matched transfer');
  assert.strictEqual(A.db.bank.length, bankBefore, 'no duplicate statement line');
  assert.strictEqual(A.db.payments.length, paysBefore + 1);
  assert.strictEqual(A.db.payments.find(x => x.id === line.paymentId).method, 'ck');
  assert(A.db.extraLog.some(x => /Tra soát giao dịch ngân hàng SK-REVIEW-1/.test(x.what)), 'audit log');
  assert(S.collectionChecklist(cl()).items.find(x => x.key === 'BANK').ok, 'no more blocking bank transactions');
});

ok('COLLECTION: cash payments on different dates do not require a cash session before completion', () => {
  login('AC-NV02', 'CL'); h.go('thu-tien');
  const open = S.invoices(cl()).filter(i => i.status !== 'paid');
  open.forEach((i, index) => {
    A.db.today = '2026-11-' + String(10 + index).padStart(2, '0');
    h.act('tt-pay-open', { id: i.id }); A.ui.ttPay.amount = A.U.due(i); h.act('tt-pay-commit');
  });
  assert(S.invoices(cl()).every(i => i.status === 'paid'), 'all invoices paid');
  assert(!A.ACT['tt-session-close-confirm'], 'session-close handler retired');
  assert(!h.view().includes('Tổng hợp theo buổi thu') && !h.view().includes('Chốt buổi thu hôm nay'), 'session UI retired');
  h.act('tt-finish-confirm');
  assert(cl().collection && cl().collection.reconciliationStatus === 'WAITING', 'completion does not depend on cash sessions');
});

ok('CASE 8 + 9: completion creates one period-level cash handover and excludes transfers', () => {
  const ho = A.db.cashHandovers.find(x => x.handoverScope === 'MARKET_PERIOD' && x.periodId === cl().id && x.market === 'CL');
  assert(ho && ho.status === 'PENDING_RECONCILIATION', 'one period cash handover created');
  assert.strictEqual(ho.amount, cl().collection.summary.cash, 'cash handover matches period cash total');
  assert(!ho.paymentIds.some(id => A.db.payments.find(p => p.id === id).method === 'ck'), 'bank payments excluded from cash handover');
  h.go('thu-tien');
  assert(h.view().includes('Chờ đối soát'), 'collection is handed to reconciliation');
  assert.strictEqual(state('CL'), 'WAITING_RECONCILIATION');
  assert.strictEqual(state('TTD'), 'COLLECTING', 'ISSUE CASE 11: only CL moved to reconciliation');
  // Không nhận thanh toán sau Hoàn tất thu — kể cả chuyển khoản.
  assert(!S.canCollect(cl()));
});

function reconcile(market, actualDelta, note) {
  login('AC-KTTT01');
  const mp = S.get(market, M), cash = mp.collection.summary.cash;
  A.ui.rcDraft = { key: mp.id + '|' + market, actual: String(cash + actualDelta), note: note || '' };
  h.act('rc-commit', { period: mp.id, market });
}

ok('CASE 10: SHORTAGE → NEEDS_RESOLUTION, not complete', () => {
  reconcile('CL', -10000, 'Thiếu 10.000 đ khi kiểm đếm');
  assert.strictEqual(cl().collection.reconciliationStatus, 'NEEDS_RESOLUTION', lastToast());
  assert.strictEqual(state('CL'), 'NEEDS_RESOLUTION');
  assert.notStrictEqual(state('CL'), 'COMPLETED');
  assert.strictEqual(cl().collection.reconciliationHistory.length, 1);
});

ok('CASE 11: resolved to MATCHED → RECONCILED (history kept)', () => {
  reconcile('CL', 0, 'NV đã nộp bổ sung 10.000 đ');
  assert.strictEqual(cl().collection.reconciliationStatus, 'RECONCILED', lastToast());
  assert.strictEqual(cl().collection.result, 'MATCHED');
  assert.strictEqual(cl().collection.reconciliationHistory.length, 2);
  assert.strictEqual(state('CL'), 'COMPLETED');
  assert(A.db.notifications.some(n => /RECONCILIATION_COMPLETED/.test(n.notificationKey || '') && n.market === 'CL'));
});

ok('CASE 13: one market WAITING_RECONCILIATION → month cannot be closed', () => {
  payAllCash('TTD', 'AC-NV07');
  h.act('tt-finish-confirm');
  assert.strictEqual(state('TTD'), 'WAITING_RECONCILIATION');
  const sum = S.monthSummary(M);
  assert(!sum.canClose && sum.pending.length === 1);
  login('AC-NV01', 'CL'); A.ui.periodMonitorPeriod = M; h.go('theo-doi-ky-thu');
  h.act('period-monitor-close');
  assert(!S.isClosed(cl()), 'not closed');
});

ok('CASE 12: COMPLETED + NOT_APPLICABLE for every active market → month can be closed', () => {
  reconcile('TTD', 0, '');
  assert.strictEqual(state('TTD'), 'COMPLETED');
  const sum = S.monthSummary(M);
  assert(sum.canClose && sum.completed === 2 && sum.notApplicable === S.activeMarkets().length - 2);
  login('AC-NV02', 'CL');
  assert(!A.canDo('theo-doi-ky-thu.chot-ky'), 'collector has no close permission');
  login('AC-NV01', 'CL'); A.ui.periodMonitorPeriod = M; h.go('theo-doi-ky-thu');
  assert(h.view().includes('Hoàn tất: 2 · Không áp dụng: 10'), 'close summary');
  h.act('period-monitor-close');
  assert(S.monthSummary(M).closed, lastToast());
  assert(cl().monthClose.closedBy && cl().monthClose.finalState === 'COMPLETED' && S.get('HA', M).monthClose.finalState === 'NOT_APPLICABLE');
  assert(A.db.extraLog.some(x => /Chốt kỳ thu 11\/2026/.test(x.what)), 'audit log');
});

ok('CASE 14: after closing — cash, demo transfer, issuing, recalculation, meter, reconciliation all blocked', () => {
  const inv = S.invoices(cl())[0];
  Object.assign(inv, { status: 'unpaid', paid: 0 }); // dữ liệu giả lập để chắc chắn mọi kênh đều bị chặn theo trạng thái kỳ
  assert(!S.canCollectInvoice(inv));
  assert.strictEqual(A.applyPayment([inv.id], inv.amount, 'ck', 'Hệ thống').length, 0, 'transfer/demo bank blocked');
  assert.strictEqual(A.applyPayment([inv.id], inv.amount, 'tm', 'NV02').length, 0, 'cash blocked');
  login('AC-NV02', 'CL'); h.go('thu-tien');
  h.act('tt-pay-open', { id: inv.id });
  assert(!A.ui.ttPay, 'cash modal refused');
  assert(B.calculatePeriod('CL', cl().id, 'x').warnings.some(w => w.code === 'PERIOD_CLOSED'));
  assert.strictEqual(B.issue('CL', cl().id, 'x').issued.length, 0);
  assert(!S.canRecordMeter(cl()) && !S.canReconcile(cl()) && !S.canIssue(cl()));
  Object.assign(inv, { status: 'paid', paid: inv.amount });
});

ok('legacy unpaid invoices of closed months are not collectable (no debt flow)', () => {
  const old = A.db.invoices.find(i => i.period <= '2026-08' && i.status !== 'paid');
  if (old) { assert(!S.canCollectInvoice(old)); assert.strictEqual(A.applyPayment([old.id], A.U.due(old), 'qr', 'Mini app').length, 0); }
});

ok('CASE 15: syncDebts no longer runs; reload creates no debt', () => {
  assert.strictEqual(typeof A.syncDebts, 'undefined');
  assert.strictEqual(typeof A.payDebtByQr, 'undefined');
  const before = (A.db.debts || []).length;
  const again = createApp(ROOT, { storage: { 'choso-caolanh-state': h.localStorage.getItem('choso-caolanh-state') } });
  assert.strictEqual((again.A.db.debts || []).length, before);
  assert.strictEqual(again.A.NOTIFICATIONS.dispatchDueMilestones(), 0, 'milestone notifications are idempotent');
});

ok('CASE 16: no Công nợ / Đối soát buổi thu menu, permission or route', () => {
  const keys = A.PERM.CATALOG.map(p => p.key);
  assert(!keys.some(k => /cong-no|^action:doi-soat\.|^screen:doi-soat$|mien-giam|yeu-cau-dieu-chinh|cai-dat\.ky-thu|quy-tac-thu-phi|tra-no-qr|ban-do-thu/.test(k)), 'retired keys');
  ['action:thu-tien.hoan-tat-thu', 'action:theo-doi-ky-thu.chot-ky', 'action:thong-bao.lich-nghiep-vu'].forEach(k => assert(keys.includes(k), k));
  assert(!A.MENU.some(g => g.items.some(it => it.id === 'cong-no' || it.id === 'doi-soat')));
  login('AC-NV02', 'CL'); h.go('cong-no'); assert.notStrictEqual(A.current, 'cong-no');
  login('AC-KTTT01'); h.go('doi-soat'); assert.strictEqual(A.current, 'theo-doi-ky-doi-soat');
  assert(!A.VIEWS['cong-no'] && !A.VIEWS['doi-soat']);
});

ok('retired permissions (ban-do-thu, tra-no-qr, yeu-cau-dieu-chinh) are gone from catalog and every role', () => {
  ['action:phai-thu.ban-do-thu', 'action:mini-app.tra-no-qr', 'action:dien-nuoc.yeu-cau-dieu-chinh'].forEach(k => {
    assert(!A.PERM.CATALOG.some(p => p.key === k), 'catalog ' + k);
    assert(!A.PERM.roles().some(r => A.PERM.hasPerm(r.id, k)), 'role matrix ' + k);
  });
  const stored = JSON.parse(h.localStorage.getItem('choso-caolanh-permissions'));
  assert(!stored.rolePerms.some(r => /ban-do-thu|tra-no-qr|yeu-cau-dieu-chinh/.test(r.permKey)), 'stored state');
});

ok('BR-06: Lịch nghiệp vụ edited by admin and Tổ trưởng via its own permission', () => {
  assert(A.PERM.hasPerm('system_admin', 'action:thong-bao.lich-nghiep-vu') && A.PERM.hasPerm('market_manager', 'action:thong-bao.lich-nghiep-vu'));
  assert(!A.PERM.hasPerm('collector', 'action:thong-bao.lich-nghiep-vu'));
});

ok('notifications: milestone scheduler dispatches canonical recipient policy idempotently', () => {
  const dispatched = A.NOTIFICATIONS.dispatchDueMilestones();
  assert(dispatched > 0, 'due milestones dispatched through scheduler');
  const ms = A.db.notifications.filter(n => /^MILESTONE\|/.test(n.notificationKey || ''));
  assert(ms.length > 0);
  assert(!ms.some(n => /^MILESTONE\|METER_READ\|/.test(n.notificationKey) && n.recipientType === 'TRADER'), 'meter read is internal');
  assert(!ms.some(n => /^MILESTONE\|PREPARATION\|/.test(n.notificationKey) && n.recipientType === 'TRADER'), 'preparation is internal');
  assert(ms.some(n => /^MILESTONE\|COLLECTION_START\|/.test(n.notificationKey) && n.recipientType === 'TRADER'), 'traders get collection start');
  assert.strictEqual(A.NOTIFICATIONS.dispatchDueMilestones(), 0, 'scheduler is idempotent');
});

console.log('fee-collection-flow regression PASS (' + passed + ' checks)');

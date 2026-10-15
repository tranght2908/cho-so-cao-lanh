/* Regression (Giai đoạn B, 10/2026): hợp đồng hết hạn / sắp hết hạn trong tháng mặt bằng N+1 trong tính phí & phát hành.
 * Bao phủ theo NGÀY LỊCH (30/12 ≠ 31/12), số ngày tiền theo quy ước 30 ngày (LAND_MONTH_DAYS không đổi); xác nhận DỰ KIẾN
 * (CONTINUING basis PLANNED / PLANNED_STOP) có căn cứ, dấu vết căn cứ + đơn giá trên dòng thu; xác nhận đã dùng để phát hành
 * không hủy được; thực tế khác dự kiến → thay thế + dấu vết chênh lệch (UNDER/OVER), không sửa khoản đã phát hành.
 * Fixture độc lập: nạp seed như trình duyệt; TRƯỚC khi phát hành kỳ seed, Tổ trưởng xác nhận cho các HĐ fixture + HĐ seed
 * sắp hết hạn (đúng luồng nghiệp vụ, không sửa seed). Không chạm localStorage thật. */
const assert = require('assert');
const path = require('path');
const { createApp, confirmEndingForSeed } = require('./harness');

let passed = 0;
const ok = (label, fn) => { try { fn(); passed++; } catch (e) { console.error('FAILED: ' + label); e.message = label + ': ' + e.message; throw e; } };
const json = x => JSON.stringify(x);
const K = {};
function login(A, id, market) { A.ui.sessionAccountId = id; A.ui.currentDemoAccountId = id; A.ui.market = market; A.syncAccountContext(); }
function setup(A) {
  const CS = A.features.contracts.service, BP = A.features.businessPoints.service, TS = A.features.traders.service, B = A.features.finance.billing, L = A.features.lifecycle.service;
  const today = A.U.today();
  const free = BP.availablePoints('CL', '2026-01-01', '2027-12-31').filter(p => { const x = B.buildPriceTerms('CL', p, p.area, today, {}, 'X'); return x && x.land; });
  let n = 0;
  const mk = (label, end) => {
    const p = free[n++], tid = 'TT-BEC-' + label;
    assert(p, 'fixture point ' + label);
    assert(TS.create({ id: tid, name: 'BEC ' + label, phone: '09775' + String(10000 + n), idType: 'CCCD', idNo: 'BEC-' + n, address: 'x', market: 'CL', stalls: [], status: 'WAITING_ALLOCATION', source: 'STAFF', since: today }));
    const contract = { id: 'HĐ-BEC-' + label, traderId: tid, stallId: p.id, businessPointId: p.id, market: 'CL', start: '2026-01-01', end: '2027-12-31', status: 'ACTIVE', history: [], serviceApplicability: {}, priceTerms: B.buildPriceTerms('CL', p, p.area, today, {}, 'CONTRACT') };
    const c = CS.createWithPointAllocation({ contract, traderId: tid, pointId: p.id, pointHistoryEntry: 'fixture' });
    assert(c, 'fixture contract ' + label);
    c.end = end; L.migrate();
    return { c, p, tid };
  };
  login(A, 'AC-NV01', 'CL');
  K.under = mk('UNDER', '2026-11-05'); K.over = mk('OVER', '2026-11-10'); K.dec = mk('DEC', '2026-11-20'); K.verify = mk('VERIFY', '2026-11-03'); K.none = mk('NONE', '2026-11-12');
  const conf = (k, input) => { const r = CS.confirmContinuation(K[k].c.id, Object.assign({ note: 'Fixture ' + k }, input)); if (r.error) throw new Error(k + ': ' + r.message); K[k].rec = r.record; return r; };
  // Trước ngày hết hạn (29/10): chế độ ENDING → chỉ DỰ KIẾN, bắt buộc căn cứ.
  assert.strictEqual(CS.continuationMode(K.under.c), 'ENDING');
  assert.strictEqual(CS.usageState(K.under.c), 'ENDING_UNCOVERED');
  assert.strictEqual(CS.confirmContinuation(K.under.c.id, { kind: 'PLANNED_STOP', plannedStopOn: '2026-11-06', note: 'x' }).field, 'evidence', 'evidence required');
  assert.strictEqual(CS.confirmContinuation(K.under.c.id, { kind: 'STOPPED', stoppedOn: '2026-11-06', note: 'x' }).field, 'kind', 'no actual stop before expiry');
  conf('under', { kind: 'PLANNED_STOP', plannedStopOn: '2026-11-06', evidence: 'MINUTES' });
  conf('over', { kind: 'CONTINUING', from: '2026-11-11', until: '2026-11-30', evidence: 'APPLICATION' });
  conf('dec', { kind: 'CONTINUING', from: '2026-11-21', until: '2026-12-30', evidence: 'COMMITMENT' });
  conf('verify', { kind: 'CONTINUING', from: '2026-11-04', until: '2026-11-30', evidence: 'COMMITMENT' });
  K.beforeSeed = { usageUnder: CS.usageState(K.under.c), usageDec: CS.usageState(K.dec.c), statusDec: CS.displayStatus(K.dec.c) };
  // K.none: xác nhận thực tế được ghi trước khi phát hành để kỳ seed đủ căn cứ (ca chặn phát hành: issue-per-market.js).
  conf('none', { kind: 'CONTINUING', from: '2026-11-13', until: '2026-11-30', evidence: 'OTHER' });
  confirmEndingForSeed(A);
}
const h = createApp(path.resolve(__dirname, '../..'), { seedIssue: true, beforeSeedIssue: setup }), A = h.A;
const CS = A.features.contracts.service, BP = A.features.businessPoints.service, B = A.features.finance.billing, MP = A.features.finance.marketPeriod, PN = A.personalNotifications;
const landItem = k => { for (const inv of A.db.invoices) for (const it of inv.items || []) if (it.contractId === K[k].c.id && it.chargeType === 'LAND' && it.chargeMonth === '2026-11') return { inv, it }; return null; };

ok('xác nhận dự kiến trước hạn: HĐ vẫn "Còn hiệu lực", trạng thái dự kiến, điểm không đổi', () => {
  assert.strictEqual(K.beforeSeed.statusDec, 'ACTIVE');
  assert.strictEqual(K.beforeSeed.usageUnder, 'ENDING_PLANNED_STOP');
  assert.strictEqual(K.beforeSeed.usageDec, 'ENDING_PLANNED');
  assert.strictEqual(K.under.rec.kind, 'PLANNED_STOP'); assert.strictEqual(K.under.rec.evidence, 'MINUTES');
  assert.strictEqual(K.over.rec.basis, 'PLANNED');
  ['under', 'over', 'dec'].forEach(k => { assert.strictEqual(K[k].c.status, 'ACTIVE'); assert.strictEqual(BP.get(K[k].p.id).usageStatus, 'RENTED'); });
});
ok('kỳ seed 11/2026 phát hành sau khi đủ căn cứ (không sửa seed); dòng mặt bằng lưu căn cứ + đơn giá', () => {
  assert.strictEqual(A.db.seedIssue.status, 'DONE');
  assert(MP.isIssued(MP.get('CL', '2026-11')));
  const u = landItem('under').it, o = landItem('over').it;
  assert.strictEqual(u.billableDays, 5, 'PLANNED_STOP 06/11 → bill 01..05/11');
  assert.strictEqual(u.coverage.closedBy, 'PLANNED_STOP'); assert.strictEqual(u.coverage.planned, true);
  assert.strictEqual(u.coverage.records[0].evidence, 'MINUTES'); assert(u.coverage.records[0].confirmedBy && u.coverage.records[0].confirmedAt);
  assert.strictEqual(o.billableDays, 30); assert.strictEqual(o.coverage.billTo, '2026-11-30'); assert.deepStrictEqual(Array.from(o.coverage.recordIds), [K.over.rec.id]);
  assert(o.priceSource && o.priceSource.source === 'CONTRACT_TERMS' && o.priceSource.unitPrice === Number(K.over.c.priceTerms.land.amount));
});
ok('không hủy được xác nhận đã dùng để phát hành', () => {
  login(A, 'AC-NV01', 'CL');
  assert(CS.usedForIssuance(K.under.rec.id) && CS.usedForIssuance(K.over.rec.id));
  assert(!CS.canVoidContinuation(K.under.c, K.under.rec.id));
  assert.strictEqual(CS.voidContinuation(K.under.c.id, K.under.rec.id, { reason: 'x' }).error, 'USED_FOR_ISSUANCE');
});
K.invoicesBefore = json(A.db.invoices); K.paymentsBefore = json(A.db.payments);
A.db.today = '2026-11-15';
ok('PLANNED_STOP đã dùng để phát hành, thực tế vẫn kinh doanh → thay thế (không hủy) + chênh lệch THU THIẾU', () => {
  login(A, 'AC-NV01', 'CL');
  const c = K.under.c;
  assert.strictEqual(CS.usageState(c), 'PLANNED_STOP');
  assert(CS.plannedToVerify(c).some(r => r.id === K.under.rec.id), 'reminder to verify reality');
  const r = CS.confirmContinuation(c.id, { kind: 'CONTINUING', from: '2026-11-06', until: '2026-12-31', evidence: 'SITE_CHECK', note: 'Thực tế vẫn kinh doanh' });
  assert(!r.error, r.message);
  assert.strictEqual(r.replaced.id, K.under.rec.id); assert(K.under.rec.supersededAt && K.under.rec.supersededById === r.record.id && !K.under.rec.voidedAt);
  assert.strictEqual(r.settlementFlags.length, 1);
  const f = r.settlementFlags[0], it = landItem('under').it;
  assert.strictEqual(f.direction, 'UNDER'); assert.strictEqual(f.billedDays, 5); assert.strictEqual(f.actualDays, 30); assert.strictEqual(f.diffDays, 25);
  assert.strictEqual(f.amountEstimate, B.landAmount({ unit: it.unit, amount: it.unitPrice }, it.quantity, 25));
  assert(f.id && f.invoiceId === landItem('under').inv.id && f.causeRecordId === r.record.id && f.status === 'OPEN' && f.resolution === null);
  assert.strictEqual(CS.detectSettlementDiffs(c, r.record).length, 0, 'no duplicate flag on re-detection');
  assert.strictEqual(CS.settlementFlags(c).length, 1);
  assert(!CS.isValidContinuation(K.under.rec), 'superseded record never a basis again');
  assert.strictEqual(CS.usageState(c), 'CONFIRMED');
});
ok('CONTINUING dự kiến đã phát hành, thực tế ngừng sớm → STOPPED + chênh lệch THU THỪA', () => {
  const r = CS.confirmContinuation(K.over.c.id, { kind: 'STOPPED', stoppedOn: '2026-11-12', evidence: 'SITE_CHECK', note: 'Đã dọn đi' });
  assert(!r.error, r.message);
  const f = r.settlementFlags[0];
  assert.strictEqual(f.direction, 'OVER'); assert.strictEqual(f.billedDays, 30); assert.strictEqual(f.actualDays, 11); assert.strictEqual(f.diffDays, -19);
  assert.strictEqual(BP.get(K.over.p.id).usageStatus, 'RENTED', 'stop never releases the point');
});
ok('khoản phải thu, biên lai đã phát hành không đổi', () => {
  assert.strictEqual(json(A.db.invoices), K.invoicesBefore);
  assert.strictEqual(json(A.db.payments), K.paymentsBefore);
});
ok('sau ngày hết hạn: nhắc kiểm tra thực tế bản dự kiến (chống trùng) → "Đúng thực tế"', () => {
  const c = K.verify.c, key = 'PLANNED_VERIFY|' + c.id + '|' + K.verify.rec.id + '|AC-NV01';
  PN.ensureContractExpiryAlerts(); PN.ensureContractExpiryAlerts();
  assert.strictEqual(A.db.personalNotifications.filter(x => x.notificationKey === key).length, 1);
  // G3: xác minh thực tế bắt buộc căn cứ + ghi chú.
  assert.strictEqual(CS.verifyPlanned(c.id, K.verify.rec.id).field, 'evidence');
  assert.strictEqual(CS.verifyPlanned(c.id, K.verify.rec.id, { evidence: 'SITE_CHECK', note: ' ' }).field, 'note');
  const r = CS.verifyPlanned(c.id, K.verify.rec.id, { evidence: 'SITE_CHECK', note: 'Kiểm tra tại điểm: vẫn kinh doanh' });
  assert(!r.error, r.message);
  assert(K.verify.rec.verifiedAt && K.verify.rec.verifiedBy && K.verify.rec.basis === 'PLANNED', 'stays planned, marked verified');
  assert.strictEqual(CS.plannedToVerify(c).length, 0);
  assert.strictEqual(K.verify.rec.from, '2026-11-04', 'effective dates unchanged');
});
ok('30/12 chưa phủ hết tháng 12; 31/12 thì đủ; số ngày tiền vẫn theo quy ước 30', () => {
  assert.strictEqual(B.LAND_MONTH_DAYS, 30);
  const dec = Object.assign({ id: A.periods.makeId('CL', '2026-12'), marketId: 'CL', period: '2026-12', label: '12/2026', source: 'test' }, MP.scheduleDates('2026-12'));
  A.db.billingPeriods.push(dec); dec.meter = { status: 'COMPLETED', mode: 'RECORDED' };
  const c = K.dec.c;
  // Điều chỉnh đơn giá (amendment) có hiệu lực sau ngày hết hạn → dùng cho mặt bằng 12 (không lấy bảng giá hiện hành).
  const terms = JSON.parse(json(c.priceTerms)); terms.land.amount = Number(terms.land.amount) + 500;
  c.amendments = [{ id: 'PL-DEC-01', effectiveFrom: '2026-12-01', priceTerms: terms }];
  let o = B.calculatePeriod('CL', dec.id, 'test');
  const w = o.warnings.find(x => x.contractId === c.id && x.code === 'LAND_NOT_COVERED');
  assert(w && w.gapFrom === '2026-12-31' && w.gapTo === '2026-12-31' && w.severity === 'BLOCKING', '30/12 leaves 31/12 uncovered');
  assert(w.action && w.action.act === 'ct-view' && w.action.id === c.id, 'link for the manager');
  const d0 = o.drafts.find(x => x.contractId === c.id && x.items[0].chargeType === 'LAND');
  assert.strictEqual(d0.items[0].billableDays, 30, 'money days still 30-day convention');
  assert.strictEqual(MP.stateOf('CL', '2026-12').id, 'NEEDS_ACTION');
  login(A, 'AC-NV01', 'CL');
  assert.strictEqual(CS.voidContinuation(c.id, K.dec.rec.id, { reason: 'x' }).error, 'USED_FOR_ISSUANCE', 'used by issued land 11');
  const r = CS.confirmContinuation(c.id, { kind: 'CONTINUING', from: '2026-12-31', until: '2026-12-31', evidence: 'COMMITMENT', note: 'Bổ sung đến 31/12' });
  assert(!r.error, r.message);
  o = { drafts: B.drafts('CL', dec.id), warnings: B.warnings('CL', dec.id) };
  assert(!o.warnings.some(x => x.contractId === c.id && x.code === 'LAND_NOT_COVERED'), 'auto-recalculated after confirmation: 31/12 covers December');
  const d1 = o.drafts.find(x => x.contractId === c.id && x.items[0].chargeType === 'LAND').items[0];
  assert.strictEqual(d1.billableDays, 30);
  assert.strictEqual(d1.unitPrice, terms.land.amount); assert.strictEqual(d1.priceSource.source, 'AMENDMENT'); assert.strictEqual(d1.priceSource.amendmentId, 'PL-DEC-01');
  assert.strictEqual(d1.coverage.basis, 'PLANNED'); assert.strictEqual(d1.coverage.recordIds.length, 2);
});
ok('HĐ hết hạn chưa xác nhận vẫn là ứng viên của kỳ; số ứng viên = có dòng + có cảnh báo + loại có lý do', () => {
  const mp = MP.get('CL', '2026-12'), cands = MP.contracts(mp), drafts = B.drafts('CL', mp.id), warns = B.warnings('CL', mp.id);
  // OVER ngừng 12/11: còn trong khoảng đo (28/10 → 28/11) và tháng dịch vụ 11 → vẫn ứng viên; khép trước tháng mặt bằng 12 → không.
  assert(cands.some(c => c.id === K.over.c.id), 'stop inside the meter window → still a usage candidate');
  assert(!MP.landContracts(mp).some(c => c.id === K.over.c.id), 'closed before land month 12 → no land candidate');
  assert(!drafts.some(d => d.contractId === K.over.c.id && d.items[0].chargeType === 'LAND'));
  const explained = new Set(drafts.map(d => d.contractId).concat(warns.map(w => w.contractId)));
  // Ứng viên không có dòng / cảnh báo chỉ hợp lệ khi không có khoản nào áp dụng trong kỳ (vd HĐ chỉ thu mặt bằng đã khép trước tháng 12).
  const silent = cands.filter(c => !explained.has(c.id));
  silent.forEach(c => { const sa = c.serviceApplicability || {}; assert(!MP.landContracts(mp).some(x => x.id === c.id) && !sa.electricity && !sa.water && !sa.marketService, 'silently dropped candidate ' + c.id); });
  assert(silent.some(c => c.id === K.over.c.id));
});
ok('Thu tiền & biên lai: khoản của HĐ quá hạn vẫn thu bình thường, kèm cảnh báo', () => {
  const inv = landItem('over').inv;
  assert(MP.canCollectInvoice(inv), 'collectable as usual');
  login(A, 'AC-NV02', 'CL'); A.ui.thuTien = null; h.go('thu-tien');
  assert(/HĐ hết hạn \d{2}\/\d{2}\/\d{4} – /.test(h.view()), 'warning tag in the collection list');
});
console.log('billing-expired-continuation regression PASS (' + passed + ' checks)');

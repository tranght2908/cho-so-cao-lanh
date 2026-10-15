/* Regression (Giai đoạn B, 10/2026): ghi BỔ SUNG chỉ số trước phát hành.
 * HĐ hết hạn chưa xác nhận vẫn là ứng viên ghi chỉ số; kỳ đã Hoàn tất ghi chỉ số mà điểm còn thiếu chỉ số → chỉ NV thu phí
 * (dien-nuoc.ghi-chi-so, đúng phạm vi chợ) ghi bổ sung, bắt buộc lý do, lưu lịch sử, tự tính lại; không mở lại cả kỳ;
 * kỳ đã phát hành không được ghi. Fixture độc lập trong harness, không chạm localStorage thật. */
const assert = require('assert');
const path = require('path');
const { createApp } = require('./harness');

const h = createApp(path.resolve(__dirname, '../..')), A = h.A;
const CS = A.features.contracts.service, BP = A.features.businessPoints.service, TS = A.features.traders.service, B = A.features.finance.billing, MP = A.features.finance.marketPeriod, L = A.features.lifecycle.service, PN = A.personalNotifications;
let passed = 0;
const ok = (label, fn) => { try { fn(); passed++; } catch (e) { console.error('FAILED: ' + label); e.message = label + ': ' + e.message; throw e; } };
const login = (id, market) => { A.ui.sessionAccountId = id; A.ui.currentDemoAccountId = id; A.ui.market = market; A.syncAccountContext(); };
const today = A.U.today(), SA = { electricity: true, water: true, marketService: false };
login('AC-NV01', 'CL');
const mp = MP.get('CL', '2026-11');
assert(mp && !MP.isIssued(mp), 'fixture: open CL period 11/2026');
const st = BP.availablePoints('CL', '2026-01-01', '2027-12-31').find(p => p.hasMeter && (B.buildPriceTerms('CL', p, p.area, today, SA, 'X') || {}).land);
assert(st, 'fixture: free CL point with meter');
assert(TS.create({ id: 'TT-MSUP', name: 'Ghi bổ sung', phone: '0977600001', idType: 'CCCD', idNo: 'MSUP-1', address: 'x', market: 'CL', stalls: [], status: 'WAITING_ALLOCATION', source: 'STAFF', since: today }));
const c = CS.createWithPointAllocation({ contract: { id: 'HĐ-MSUP', traderId: 'TT-MSUP', stallId: st.id, businessPointId: st.id, market: 'CL', start: '2026-01-01', end: '2027-12-31', status: 'ACTIVE', history: [], serviceApplicability: SA, priceTerms: B.buildPriceTerms('CL', st, st.area, today, SA, 'CONTRACT') }, traderId: 'TT-MSUP', pointId: st.id, pointHistoryEntry: 'fixture' });
assert(c, 'fixture contract');
c.end = '2026-10-20'; L.migrate(); // hết hạn trước ngày ghi chỉ số, chưa xác nhận
A.db.readings = A.db.readings.filter(r => !(r.stallId === st.id && (r.billingPeriodId === mp.id || r.period === mp.period)));

ok('HĐ hết hạn chưa xác nhận vẫn nằm trong danh sách ghi chỉ số của kỳ', () => {
  assert.strictEqual(CS.usageState(c), 'UNCONFIRMED');
  assert(MP.contracts(mp).some(x => x.id === c.id));
  assert(MP.meterPoints(mp).some(p => p.id === st.id));
});
mp.meter = { status: 'COMPLETED', mode: 'RECORDED', completedAt: '28/10/2026 17:00', completedBy: 'NV02' }; // đã hoàn tất, bỏ sót điểm
ok('chưa có căn cứ → chặn khoảng đo; điểm thuộc danh sách ghi bổ sung', () => {
  const o = B.calculatePeriod('CL', mp.id, 'test');
  assert(o.warnings.some(w => w.contractId === c.id && w.code === 'USAGE_NOT_COVERED' && w.gapFrom === '2026-10-21'));
  assert(MP.supplementPoints(mp).some(p => p.id === st.id));
  assert.strictEqual(MP.stateOf('CL', '2026-11').id, 'NEEDS_ACTION');
});
ok('Tổ trưởng xác nhận tiếp tục sử dụng → tự tính lại; còn thiếu chỉ số → MISSING_METER_READING (ghi bổ sung)', () => {
  const r = CS.confirmContinuation(c.id, { kind: 'CONTINUING', from: '2026-10-21', until: '2026-12-31', evidence: 'SITE_CHECK', note: 'Vẫn kinh doanh' });
  assert(!r.error, r.message);
  const w = B.warnings('CL', mp.id).filter(x => x.contractId === c.id);
  assert(!w.some(x => x.code === 'USAGE_NOT_COVERED'), 'meter window now covered');
  assert(w.some(x => x.code === 'MISSING_METER_READING' && x.supplementRequired), 'needs a supplemental reading');
});
ok('nhắc NV thu phí phụ trách chợ ghi bổ sung (chống trùng)', () => {
  PN.ensureMeterSupplementAlerts(); PN.ensureMeterSupplementAlerts();
  const n = A.db.personalNotifications.filter(x => x.notificationKey === ['METER_SUPPLEMENT_REQUIRED', mp.id, st.id, 'AC-NV02'].join('|'));
  assert.strictEqual(n.length, 1);
  assert(!A.db.personalNotifications.some(x => /^METER_SUPPLEMENT_REQUIRED\|/.test(x.notificationKey || '') && x.recipientAccountId === 'AC-NV01'), 'manager is not the recorder');
});
ok('Tổ trưởng / NV ngoài phạm vi không được ghi bổ sung', () => {
  login('AC-NV01', 'CL');
  assert.strictEqual(MP.recordSupplementalReading(mp, st.id, { elecCur: 9999, waterCur: 999, reason: 'x' }).error, 'FORBIDDEN');
  login('AC-NV03', 'CL');
  assert.strictEqual(MP.recordSupplementalReading(mp, st.id, { elecCur: 9999, waterCur: 999, reason: 'x' }).error, 'FORBIDDEN');
});
ok('NV thu phí ghi bổ sung qua màn Chỉ số: bắt buộc lý do; lưu lịch sử; không mở lại kỳ; tự tính lại', () => {
  login('AC-NV02', 'CL'); A.ui.filters = A.ui.filters || {};
  h.go('dien-nuoc');
  assert(/Điểm cần ghi bổ sung/.test(h.view()) && h.view().includes('data-act="mr-supp-open" data-id="' + st.id + '"'));
  assert.strictEqual(MP.recordSupplementalReading(mp, st.id, { elecCur: 9999, waterCur: 999, reason: ' ' }).error, 'REQUIRED');
  h.act('mr-supp-open', { id: st.id, period: mp.period });
  assert(/Ghi bổ sung chỉ số điện, nước/.test(h.modal()));
  const r = MP.readingOf(mp, st.id), noPrev = r.elecPrev == null, e = (r.elecPrev || 100) + 40, w = (r.waterPrev || 10) + 4;
  if (noPrev) {
    assert.strictEqual(MP.recordSupplementalReading(mp, st.id, { elecCur: e, waterCur: w, reason: 'x' }).field, 'prev', 'opening reading required when no previous reading');
    assert(h.modal().includes('id="mr-supp-elec-prev"'));
    h.input('#mr-supp-elec-prev', '100'); h.input('#mr-supp-water-prev', '10');
  }
  h.input('#mr-supp-elec', String(e)); h.input('#mr-supp-water', String(w)); h.input('#mr-supp-reason', 'HĐ hết hạn chưa có trong danh sách ghi ban đầu');
  h.act('mr-supp-save', { id: st.id, period: mp.period });
  const x = MP.readingOf(mp, st.id);
  assert.strictEqual(x.elecCur, e); assert.strictEqual(x.waterCur, w); assert(x.elecPrev != null && x.waterPrev != null);
  assert(x.supplemental && x.supplemental.reason && x.supplemental.byId === 'AC-NV02' && x.supplemental.at);
  assert.strictEqual(mp.meter.status, 'COMPLETED', 'period not reopened');
  assert.strictEqual(mp.meter.supplements.length, 1); assert.strictEqual(mp.meter.supplements[0].stallId, st.id);
  assert(!B.warnings('CL', mp.id).some(w2 => w2.contractId === c.id && w2.code === 'MISSING_METER_READING'), 'recalculated');
  assert(B.drafts('CL', mp.id).some(d => d.contractId === c.id && d.items[0].chargeType === 'ELECTRICITY'), 'electricity line now drafted');
  assert(!MP.supplementPoints(mp).some(p => p.id === st.id));
  assert.strictEqual(MP.recordSupplementalReading(mp, st.id, { elecCur: e, waterCur: w, reason: 'lại' }).error, 'NOT_ALLOWED', 'only missing points');
});
ok('kỳ đã phát hành: không ghi bổ sung', () => {
  const other = MP.supplementPoints(mp)[0];
  mp.issuance = { issuedAt: 'test', count: 0, amount: 0 };
  try {
    assert.strictEqual(MP.supplementPoints(mp).length, 0);
    if (other) assert.strictEqual(MP.recordSupplementalReading(mp, other.id, { elecCur: 1e6, waterCur: 1e6, reason: 'x' }).error, 'LOCKED');
  } finally { delete mp.issuance; }
});
console.log('meter-supplement regression PASS (' + passed + ' checks)');

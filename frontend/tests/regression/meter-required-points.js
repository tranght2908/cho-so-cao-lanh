/* Regression (10/2026): màn Chỉ số điện, nước và tính phí dùng CÙNG helper marketPeriod.meterChargesFor để xác định khoản
 * điện / nước cần ghi chỉ số. Chợ mới dựng từ màn Mặt bằng (điểm KD luôn hasMeter=false) có hợp đồng đăng ký điện / nước
 * → điểm phải xuất hiện trong danh sách ghi chỉ số (trước đây: "Không cần ghi chỉ số" nhưng Khoản phải thu báo
 * MISSING_METER_READING, không có đường ghi). Chỉ bắt ghi loại hợp đồng đăng ký; điểm chưa có chỉ số kỳ trước → NV nhập
 * chỉ số đầu kỳ (không tự tạo). Chưa ghi đủ → không hoàn tất, không tính, không phát hành. Điện nước thu như dịch vụ và
 * hợp đồng không đăng ký giữ nguyên. Fixture độc lập trong harness (ngày nghiệp vụ 29/10/2026), không chạm localStorage thật. */
const assert = require('assert');
const path = require('path');
const { createApp } = require('./harness');

const h = createApp(path.resolve(__dirname, '../..')), A = h.A;
const MS = A.features.markets.service, ML = A.features.marketLayout.store, TS = A.features.traders.service, CS = A.features.contracts.service;
const MP = A.features.finance.marketPeriod, B = A.features.finance.billing, today = A.U.today();
let passed = 0;
const ok = (label, fn) => { try { fn(); passed++; } catch (e) { console.error('FAILED: ' + label); e.message = label + ': ' + e.message; throw e; } };
const login = (id, market) => { A.ui.sessionAccountId = id; A.ui.currentDemoAccountId = id; A.ui.market = market; A.syncAccountContext(); };
const json = x => JSON.stringify(x);
assert.strictEqual(today, '2026-10-29', 'fixture business date');

// ---- Chợ mới dựng từ màn Mặt bằng + biểu phí riêng (điện, nước, dịch vụ) ----
const MID = 'KT-DN';
login(A.ACCOUNTS.currentList().find(a => A.ACCOUNTS.primaryRole(a) === 'system_admin').id, 'CL');
assert(A.MARKET_CATALOG.add({ code: MID, name: 'Chợ KT Điện nước', address: 'x', rank: 'HANG_3', priceConfigId: 'QD480_NHOM_CON_LAI', totalArea: 200, businessArea: 150, allowedAreaTypeIds: ['covered'] }, 'test'));
login('AC-NV01', MID);
const building = ML.addBuilding(MID, { name: 'Nhà chợ', businessArea: 150 }).building;
const row = ML.addRow(MID, { blockId: building.id, floorId: null }, 'R-1', 'Dãy 1', 'Thực phẩm', 100).row;
const made = ML.pointGroups.commit(MID, row.id, [{ id: 'g1', quantity: 8, areaPerPoint: 12.5, areaTypeId: 'covered' }]);
assert(made.ok && A.features.lifecycle.service.completeMarketLayout(MID, 'test'));
const base = { marketId: MID, status: 'active', effectiveFrom: '2026-01-01', effectiveTo: null, legalBasis: {}, attachments: [] };
A.SERVICE_CFG.setChargeApplicability(MID, { electricity: true, water: true, service: true }, 'test');
A.SERVICE_CFG.add('utilities', Object.assign({ name: 'Điện', kind: 'ELECTRICITY', elecPrice: 3000, elecUnit: 'đ/kWh' }, base), 'test');
A.SERVICE_CFG.add('utilities', Object.assign({ name: 'Nước', kind: 'WATER', waterPrice: 11000, waterUnit: 'đ/m³' }, base), 'test');
A.SERVICE_CFG.add('extraServices', Object.assign({ name: 'Vệ sinh', category: 'SANITATION', calcMethod: 'fixed', amount: 20000, unit: 'đ/điểm/tháng' }, base), 'test');
A.SERVICE_CFG.add('stallPrices', Object.assign({ name: 'Mức thu', scope: 'MARKET', areaTypeId: 'covered', stallType: '', amount: 1000, unit: 'đ/m²/ngày' }, base), 'test');
assert.strictEqual(MS.get(MID).status, 'ACTIVE');
assert(made.stalls.every(s => s.hasMeter === false), 'points created from Mặt bằng have hasMeter=false');
// 4 hợp đồng: chỉ điện / chỉ nước / cả hai / không đăng ký.
const KINDS = { E: { electricity: true, water: false }, W: { electricity: false, water: true }, EW: { electricity: true, water: true }, N: { electricity: false, water: false } };
const K = {};
Object.keys(KINDS).forEach((k, i) => {
  const p = made.stalls[i], t = TS.create({ id: 'TT-DN-' + k, name: 'TT ' + k, phone: '0977550' + (100 + i), idNo: 'DN-' + i, idType: 'CCCD', address: 'x', market: MID, stalls: [], source: 'STAFF', since: today, status: 'WAITING_ALLOCATION' });
  const c = CS.createWithPointAllocation({ contract: { id: 'HĐ-DN-' + k, traderId: t.id, stallId: p.id, businessPointId: p.id, market: MID, start: '2026-10-01', end: '2027-09-30', status: 'ACTIVE', history: [],
    priceTerms: B.buildPriceTerms(MID, p, p.area, '2026-10-01', {}, 'CONTRACT'), serviceApplicability: Object.assign({ marketService: true }, KINDS[k]) }, traderId: t.id, pointId: p.id, pointHistoryEntry: 'test' });
  assert(c, 'contract ' + k);
  K[k] = { c, p };
});
// NV thu phí phụ trách chợ (phân công = phạm vi chợ của tài khoản NV thu phí đang hoạt động).
const NV = A.ACCOUNTS.get('AC-NV02');
NV.marketScopes = (NV.marketScopes || []).concat(MID);
MP.ensurePeriodsForCurrentCycle();
const mp = MP.get(MID, '2026-11');
assert(mp, 'period created');
const kinds = k => { const x = MP.meterKinds(mp, K[k].p.id); return { electricity: x.electricity, water: x.water }; };
const lines = (k, type) => B.drafts(MID, mp.id).filter(d => d.contractId === K[k].c.id).flatMap(d => d.items).filter(it => it.chargeType === type);

ok('một helper: điểm của HĐ đăng ký điện / nước được đưa vào danh sách ghi, đúng loại; HĐ không đăng ký không có', () => {
  assert.strictEqual(json(kinds('E')), json(KINDS.E)); assert.strictEqual(json(kinds('W')), json(KINDS.W)); assert.strictEqual(json(kinds('EW')), json(KINDS.EW));
  assert(!MP.meterRequirements(mp).has(K.N.p.id), 'no utility → not listed');
  assert.strictEqual(MP.meterPoints(mp).length, 3);
  ['E', 'W', 'EW', 'N'].forEach(k => assert.strictEqual(json(MP.meterChargesFor(mp, K[k].c)), json(KINDS[k]), 'shared helper ' + k));
  assert.strictEqual(MP.meterStatus(mp), 'WAITING', 'no longer "Không cần ghi chỉ số"');
  assert.strictEqual(MP.meterDone(mp), false); assert.strictEqual(MP.canCalculate(mp), false);
  const out = B.calculatePeriod(MID, mp.id, 'test');
  assert(out.warnings.some(w => w.code === 'METER_PERIOD_NOT_CLOSED') && !B.drafts(MID, mp.id).length, 'not calculated before readings');
  assert(!MP.canIssue(mp));
});
ok('màn Chỉ số (NV thu phí): chỉ hỏi loại đã đăng ký, có ô chỉ số đầu kỳ; loại còn lại hiện "Không đăng ký"', () => {
  login('AC-NV02', MID);
  h.go('dien-nuoc');
  const v = h.view();
  assert(!/Không cần ghi chỉ số/.test(v), 'not "Không cần ghi chỉ số"');
  [K.E, K.W, K.EW].forEach(x => assert(v.includes('>' + x.p.code + '<'), 'listed ' + x.p.code));
  assert(!v.includes('>' + K.N.p.code + '<'), 'no-utility point not listed');
  assert(v.includes('Không đăng ký'), 'unregistered kind marked');
  h.act('mr-open', { id: K.E.p.id, period: mp.period });
  const m = h.modal();
  assert(/ĐIỆN/.test(m) && !/NƯỚC/.test(m) && /id="mr-elec-prev"/.test(m) && /không cần ghi chỉ số nước/.test(m), 'electricity only + opening reading');
  A.closeModal();
});
const record = (k, values) => {
  h.act('mr-open', { id: K[k].p.id, period: mp.period });
  ['elec-prev', 'elec', 'water-prev', 'water'].forEach(id => h.input('#mr-' + id, values[id] == null ? '' : String(values[id])));
  h.act('mr-save', { id: K[k].p.id, period: mp.period });
  return MP.readingOf(mp, K[k].p.id);
};
ok('ghi chỉ số: thiếu chỉ số đầu kỳ / nhỏ hơn đầu kỳ → chưa đủ; không bắt ghi loại không đăng ký; không tự tạo chỉ số', () => {
  let r = record('E', { elec: 150 });
  assert.strictEqual(MP.readingState(r, MP.meterKinds(mp, K.E.p.id)), 'NOT_RECORDED', 'missing opening reading');
  const toasts = h.trace.toasts.length; record('E', { 'elec-prev': 200, elec: 150 });
  assert(/không được nhỏ hơn/.test(h.trace.toasts.slice(toasts).join(' ')), 'cur < opening rejected');
  r = record('E', { 'elec-prev': 100, elec: 150 });
  assert.strictEqual(MP.pointReadingState(mp, K.E.p), 'RECORDED');
  assert(r.waterCur == null && r.waterPrev == null, 'no fake water reading');
  assert(!MP.canCompleteMeter(mp), 'W / EW still missing → cannot complete');
  r = record('W', { 'water-prev': 10, water: 14 });
  assert(MP.pointReadingState(mp, K.W.p) === 'RECORDED' && r.elecCur == null);
  record('EW', { 'elec-prev': 500, elec: 520, 'water-prev': 30, water: 33 });
  assert.strictEqual(MP.pointReadingState(mp, K.EW.p), 'RECORDED');
  assert(MP.canCompleteMeter(mp));
});
ok('hoàn tất ghi chỉ số → tự tính: điện / nước đúng loại đăng ký, công thức cũ, không còn MISSING_METER_READING; sẵn sàng phát hành', () => {
  const out = MP.completeMeter(MID, mp.period, NV);
  assert(out.ok && out.calc, 'completed + auto-calculated');
  assert.strictEqual(json(lines('E', 'ELECTRICITY').map(x => [x.quantity, x.amount])), json([[50, 150000]]));
  assert.strictEqual(lines('E', 'WATER').length, 0);
  assert.strictEqual(json(lines('W', 'WATER').map(x => [x.quantity, x.amount])), json([[4, 44000]]));
  assert.strictEqual(lines('W', 'ELECTRICITY').length, 0);
  assert.strictEqual(json(lines('EW', 'ELECTRICITY').concat(lines('EW', 'WATER')).map(x => [x.chargeType, x.amount])), json([['ELECTRICITY', 60000], ['WATER', 33000]]));
  assert.strictEqual(lines('N', 'ELECTRICITY').length + lines('N', 'WATER').length, 0, 'no utility contract → no utility lines');
  ['E', 'W', 'EW', 'N'].forEach(k => { assert.strictEqual(lines(k, 'LAND').length, 1, 'land ' + k); assert.strictEqual(lines(k, 'MARKET_SERVICE').length, 1, 'service ' + k); });
  assert(!B.warnings(MID, mp.id).some(w => w.code === 'MISSING_METER_READING'), JSON.stringify(B.warnings(MID, mp.id)));
  assert.strictEqual(MP.stateOf(MID, '2026-11').id, 'READY_TO_ISSUE', MP.blockReasons(mp).text);
  assert.strictEqual(MP.invoices(mp).length, 0, 'nothing issued automatically');
});
ok('điện, nước thu như dịch vụ: không bắt ghi chỉ số, không tạo dòng theo công tơ (giữ nguyên)', () => {
  login('AC-NV01', MID);
  A.SERVICE_CFG.setUtilityMode(MID, 'SERVICE', 'test', 'test');
  assert.strictEqual(A.SERVICE_CFG.utilityMode(MID), 'SERVICE');
  assert.strictEqual(MP.meterPoints(mp).length, 0);
  ['E', 'W', 'EW'].forEach(k => assert.strictEqual(json(MP.meterChargesFor(mp, K[k].c)), json({ electricity: false, water: false })));
  A.SERVICE_CFG.setUtilityMode(MID, 'METER', 'test', 'test');
  assert.strictEqual(MP.meterPoints(mp).length, 3);
});
ok('hợp đồng cũ thiếu serviceApplicability: hai màn cùng coi là không đăng ký (dữ liệu seed được bổ sung khi tải)', () => {
  const sa = K.EW.c.serviceApplicability;
  delete K.EW.c.serviceApplicability;
  assert.strictEqual(json(MP.meterChargesFor(mp, K.EW.c)), json({ electricity: false, water: false }));
  assert(!MP.meterRequirements(mp).has(K.EW.p.id), 'meter list agrees with billing');
  K.EW.c.serviceApplicability = sa;
  // Seed: mọi hợp đồng đã có serviceApplicability sau khi tải (shared/data/store.js) → không có hợp đồng "lửng".
  assert(!A.db.contracts.some(c => !c.serviceApplicability), 'load-time backfill');
});
console.log('meter-required-points regression PASS (' + passed + ' checks)');

/* Regression (billing months & contract dates — chốt 10/2026), born from the billing audit.
 * One collection round (kỳ của chợ) mixes months:
 *   meter read date (vd 25–28/10)  → Điện / Nước / Dịch vụ of the USAGE month (10), meter window = previous read → this read;
 *   Mặt bằng is billed in advance for the NEXT month (11) with the 30-day convention (full month = 30 days, partial = days
 *   in force counted on a 30-day month, cap 30);
 *   startDate/dueDate (vd 29/10 → 03/11) are only the collection window and never decide which month a contract belongs to.
 * Contracts are selected by their OWN dates; the contract ↔ trader ↔ point ↔ market relation is canonical (never "who
 * occupies the point today"). Fixtures live only in this in-memory harness (no real data, no localStorage reset). */
const assert = require('assert');
const path = require('path');
const { createApp } = require('./harness');

const h = createApp(path.resolve(__dirname, '../..')), A = h.A;
const CS = A.features.contracts.service, BP = A.features.businessPoints.service, TS = A.features.traders.service;
const B = A.features.finance.billing, MP = A.features.finance.marketPeriod;
let passed = 0;
const ok = (label, fn) => { try { fn(); passed++; } catch (e) { e.message = label + ': ' + e.message; throw e; } };

MP.ensurePeriodsForCurrentCycle();
const mp = MP.get('CL', '2026-11');
assert(mp && !MP.isIssued(mp), 'fixture: open CL period 11/2026');
// A later round (meter read 28/11 → usage 11, land 12), built in memory exactly like an auto-created period.
const dec = Object.assign({ id: A.periods.makeId('CL', '2026-12'), marketId: 'CL', period: '2026-12', label: '12/2026', source: 'audit' }, MP.scheduleDates('2026-12'));
A.db.billingPeriods.push(dec);
const USAGE = MP.usageMonth(mp), LAND = MP.landMonth(mp), WIN = MP.usageWindow(mp);

const APPLY = { electricity: true, water: true, marketService: true };
const priced = p => { const x = B.buildPriceTerms('CL', p, p.area, A.U.today(), APPLY, 'X'); return x && x.land; };
const freeAll = BP.availablePoints('CL', '2025-01-01', '2028-12-31').filter(priced);
const freeNow = BP.availablePoints('CL', A.U.today(), '2028-12-31').filter(priced).filter(p => !freeAll.includes(p));
const used = new Set();
const pickPoint = past => { const p = (past ? freeAll : freeNow.concat(freeAll)).find(x => !used.has(x.id)); assert(p, 'fixture: free priced CL point'); used.add(p.id); return p; };
let n = 0;
const reading = (p, period) => A.db.readings.push({ stallId: p.id, billingPeriodId: period.id, period: period.period, elecPrev: 100, elecCur: 150, waterPrev: 10, waterCur: 13, reviewedAt: '2026-10-28' });
const mk = (label, start, end, opts) => {
  const o = opts || {}, p = o.point || pickPoint(start < A.U.today()), tid = 'TT-BLD-' + label, sa = o.applies || APPLY;
  n++;
  TS.create({ id: tid, name: 'Billing ' + label, phone: '09773' + String(10000 + n), idType: 'CCCD', idNo: 'BLD-' + n, address: 'x', market: 'CL', stalls: [], status: 'WAITING_ALLOCATION', source: 'STAFF', since: A.U.today() });
  const contract = { id: 'HĐ-BLD-' + label, traderId: tid, stallId: p.id, businessPointId: p.id, market: 'CL', start, end: o.expireLater ? '2027-12-31' : end, status: 'ACTIVE', history: [], serviceApplicability: sa, priceTerms: B.buildPriceTerms('CL', p, p.area, A.U.today(), sa, 'CONTRACT') };
  let c;
  if (o.raw) { A.db.contracts.push(contract); A.reindex(); c = contract; } else { c = CS.createWithPointAllocation({ contract, traderId: tid, pointId: p.id, pointHistoryEntry: 'audit' }); assert(c, 'fixture contract ' + label); }
  if (o.expireLater) c.end = end; // time passes (scope 10/2026: expiry has no side effect, the point stays RENTED)
  if (!o.noReading) reading(p, mp);
  return { c, p, tid };
};
const endMid = mk('E1115', '2026-01-01', '2026-11-15');
const K = {
  full: mk('FULL', '2026-01-01', '2026-12-31'),
  endMid,
  startMid: mk('S1115', '2026-11-15', '2027-11-14'),
  end1030: mk('E1030', '2026-01-01', '2026-10-30', { expireLater: true }),
  start1101: mk('S1101', '2026-11-01', '2027-10-31'),
  start1201: mk('S1201', '2026-12-01', '2027-11-30'),
  // Same point as the contract ending 15/11 (no date overlap) — keeps the fixture within the free CL points.
  start1215: mk('S1215', '2026-12-15', '2027-12-14', { point: endMid.p, raw: true, noReading: true }),
  expiredHeld: mk('EXPH', '2026-01-01', '2026-09-20', { expireLater: true }),
  noElec: mk('NOEL', '2026-01-01', '2026-12-31', { applies: { electricity: false, water: true, marketService: false } })
};
// ISSUE-07 fixture: two contracts of ONE point inside the same meter window (old one ended 10/10, new one from 15/10).
const shared = pickPoint(true);
const sharedOld = mk('SHO', '2026-01-01', '2026-10-10', { point: shared, raw: true, noReading: true });
const sharedNew = mk('SHN', '2026-10-15', '2027-10-14', { point: shared, raw: true });
mp.meter = { status: 'COMPLETED', mode: 'RECORDED' }; dec.meter = { status: 'COMPLETED', mode: 'RECORDED' };
A.reindex();
const out = B.calculatePeriod('CL', mp.id, 'audit');
const rows = (k, o) => (o || out).drafts.filter(d => d.contractId === K[k].c.id);
const line = (k, type, o) => rows(k, o).find(d => d.items[0].chargeType === type);
const warns = (k, o) => (o || out).warnings.filter(w => w.contractId === K[k].c.id).map(w => w.code);
const landOf = (k, days) => Math.round(Number(K[k].p.area) * K[k].c.priceTerms.land.amount * days);

ok('round months: usage = month of the meter read date, land = the following month', () => {
  assert.strictEqual(USAGE, MP.dateOf(mp, 'meterReadDate').slice(0, 7));
  assert.strictEqual(USAGE, '2026-10'); assert.strictEqual(LAND, '2026-11');
  assert(WIN.to === MP.dateOf(mp, 'meterReadDate') && WIN.from < WIN.to, 'usage window = previous read → this read');
  assert.strictEqual(B.landBillableDays({ start: '2026-01-01', end: '2026-12-31' }, '2026-02'), 30, 'full February = 30');
  assert.strictEqual(B.landBillableDays({ start: '2026-12-15', end: '2027-06-01' }, '2026-12'), 16, '15/12 → 30/12 = 16 (30-day month)');
});
ok('CASE 1: contract covering the whole land month → area × rate × 30', () => {
  const l = line('full', 'LAND').items[0];
  assert.strictEqual(l.targetMonth, LAND); assert.strictEqual(l.days, 30); assert.strictEqual(l.fullMonth, true);
  assert.strictEqual(line('full', 'LAND').amount, landOf('full', 30));
  assert.strictEqual(l.name, 'Mặt bằng 11/2026');
  assert.strictEqual(B.landBillableDays({ start: '2026-01-01', end: '2026-12-31' }, '2026-11') * 10 * 2000, 600000, 'spec example 10 m² × 2.000 × 30');
});
ok('CASE 2 (ISSUE-01): contract ending 15/11 → land 11/2026 = 15 days, never the following month', () => {
  const l = line('endMid', 'LAND');
  assert.strictEqual(l.items[0].days, 15); assert.strictEqual(l.amount, landOf('endMid', 15)); assert.strictEqual(l.items[0].fullMonth, false);
  assert.strictEqual(B.landBillableDays({ start: '2026-01-01', end: '2026-11-15' }, '2026-11') * 10 * 2000, 300000, 'spec example');
  const o12 = B.calculatePeriod('CL', dec.id, 'audit');
  assert(!line('endMid', 'LAND', o12), 'no land 12/2026 for a contract that ends in 11');
});
ok('CASE 3: contract starting 15/11 → land 15..30 = 16 days (not 30)', () => {
  const l = line('startMid', 'LAND');
  assert.strictEqual(l.items[0].days, 16); assert.strictEqual(l.amount, landOf('startMid', 16));
});
ok('CASE 4 + CASE 11 (ISSUE-04): contract ending 30/10 with collection start 29/10 → no land 11; only its October usage', () => {
  assert.strictEqual(MP.dateOf(mp, 'startDate'), '2026-10-29', 'fixture: collection window starts 29/10');
  assert(!line('end1030', 'LAND'), 'no land 11/2026');
  assert.strictEqual(line('end1030', 'ELECTRICITY').items[0].name, 'Điện 10/2026', 'its October consumption is still billed');
  assert(rows('end1030').every(d => d.items[0].chargeMonth === '2026-10'), 'nothing attributed to 11/2026');
});
ok('CASE 5: contract starting 01/11 → land 11 = 30 days; no October usage', () => {
  assert.strictEqual(line('start1101', 'LAND').items[0].days, 30);
  assert(!line('start1101', 'ELECTRICITY') && !line('start1101', 'MARKET_SERVICE'), 'not in force during the usage month');
});
ok('CASE 6 (ISSUE-02): contract starting 01/12 → the round before (read 28/11) bills land 12/2026 = 30 days; 15/12 → 16 days', () => {
  assert.strictEqual(rows('start1201').length, 0, 'nothing in the 11/2026 round');
  const o12 = B.calculatePeriod('CL', dec.id, 'audit');
  assert.strictEqual(MP.usageMonth(dec), '2026-11'); assert.strictEqual(MP.landMonth(dec), '2026-12');
  const l = line('start1201', 'LAND', o12);
  assert(l, 'land 12/2026 generated'); assert.strictEqual(l.items[0].name, 'Mặt bằng 12/2026'); assert.strictEqual(l.items[0].days, 30); assert.strictEqual(l.amount, landOf('start1201', 30));
  assert.strictEqual(line('start1215', 'LAND', o12).items[0].days, 16);
  B.calculatePeriod('CL', mp.id, 'audit');
});
ok('CASE 7 + CASE 8: meter read 25–28/10 → "Điện 10/2026" / "Nước 10/2026"; the 29/10 → 03/11 window does not move them to 11', () => {
  ['ELECTRICITY', 'WATER'].forEach(t => {
    const i = line('full', t).items[0];
    assert.strictEqual(i.usageMonth, '2026-10'); assert.strictEqual(i.chargeMonth, '2026-10'); assert(/ 10\/2026$/.test(i.name), i.name);
    assert.strictEqual(i.usageWindow.to, MP.dateOf(mp, 'meterReadDate'));
    assert.strictEqual(i.amount, i.quantity * i.unitPrice, 'consumption × locked price');
  });
  assert(!out.drafts.some(d => /^(Điện|Nước) 11\/2026/.test(d.items[0].name)), 'no utility labelled 11/2026');
});
ok('CASE 9: point still RENTED but contract expired before the usage window → no electricity / water / service', () => {
  assert.strictEqual(BP.get(K.expiredHeld.p.id).usageStatus, 'RENTED');
  assert.strictEqual(rows('expiredHeld').length, 0);
});
ok('CASE 10 (ISSUE-03): today 29/10, contract from 15/11 → no INVALID_CONTRACT_SOURCE; deterministic', () => {
  assert.strictEqual(A.U.today(), '2026-10-29');
  assert(!BP.get(K.startMid.p.id).traderId, 'fixture: point has no occupant today');
  assert(!warns('startMid').includes('INVALID_CONTRACT_SOURCE') && !warns('start1101').includes('INVALID_CONTRACT_SOURCE'));
  const first = JSON.stringify(out.drafts.map(d => [d.sourceKey, d.amount]));
  assert.strictEqual(JSON.stringify(B.calculatePeriod('CL', mp.id, 'audit').drafts.map(d => [d.sourceKey, d.amount])), first, 'same data + same round → same result');
});
ok('CASE 12: service = usage month, monthly fee (no day proration)', () => {
  const s = rows('full').filter(d => d.items[0].chargeType === 'MARKET_SERVICE');
  assert(s.length && s.every(d => d.items[0].name.startsWith('Dịch vụ 10/2026') && d.items[0].chargeMonth === '2026-10'));
  // A contract that ends 30/10 still pays the full monthly service fee of October (no day proration in this scope).
  const e = rows('end1030').filter(d => d.items[0].chargeType === 'MARKET_SERVICE');
  assert(e.length && e.every(d => d.amount === Math.round(d.items[0].quantity * d.items[0].unitPrice)));
});
ok('CASE 13: fee config changed after the contract → the old contract keeps its priceTerms', () => {
  const pol = A.SERVICE_CFG.list('stallPrices').find(x => x.id === K.full.c.priceTerms.land.policyId), old = pol.amount;
  pol.amount = Number(old) + 1000;
  try { const o2 = B.calculatePeriod('CL', mp.id, 'audit'); assert.strictEqual(line('full', 'LAND', o2).items[0].unitPrice, K.full.c.priceTerms.land.amount); }
  finally { pol.amount = old; B.calculatePeriod('CL', mp.id, 'audit'); }
});
ok('land proration for monthly / fixed units: full month = 100%, partial = monthly × billableDays / 30 (rounded to đồng)', () => {
  const perM2Month = { amount: 60000, unit: 'đ/m²/tháng' }, fixed = { amount: 900000, unit: 'đ/tháng' }, perDay = { amount: 2000, unit: 'đ/m²/ngày' };
  assert.strictEqual(B.landAmount(perM2Month, 10, 30), 600000); assert.strictEqual(B.landAmount(perM2Month, 10, 15), 300000);
  assert.strictEqual(B.landAmount(fixed, 10, 30), 900000); assert.strictEqual(B.landAmount(fixed, 10, 16), 480000);
  assert.strictEqual(B.landAmount(perDay, 10, 16), 320000, 'per-day unit unchanged');
  assert.strictEqual(B.landAmount({ amount: 2000, unit: 'đ/m²/tháng' }, 5.5, 7), 2567, '5,5 × 2.000 × 7/30 = 2.566,67 → 2.567');
  // Same partial month 15/11 → 30/11 (16 days): every unit type charges the same 16/30 share.
  const days = B.landBillableDays({ start: '2026-11-15', end: '2027-11-14' }, '2026-11');
  assert.strictEqual(days, 16);
  assert.strictEqual(B.landAmount(perM2Month, 10, days) / B.landAmount(perM2Month, 10, 30), B.landAmount(perDay, 10, days) / B.landAmount(perDay, 10, 30));
  // End-to-end: a contract whose locked land term is đ/m²/tháng, starting 15/11 → prorated in the 11/2026 land line.
  const c = K.startMid.c, saved = JSON.stringify(c.priceTerms.land);
  Object.assign(c.priceTerms.land, { amount: 60000, unit: 'đ/m²/tháng' });
  try {
    const l = line('startMid', 'LAND', B.calculatePeriod('CL', mp.id, 'audit'));
    assert.strictEqual(l.items[0].days, 16); assert.strictEqual(l.amount, Math.round(Number(K.startMid.p.area) * 60000 * 16 / 30));
    assert(/ × 16\/30 ngày/.test(l.items[0].explanation), l.items[0].explanation);
  } finally { c.priceTerms.land = JSON.parse(saved); B.calculatePeriod('CL', mp.id, 'audit'); }
});
ok('charge not applicable → no line (contract without electricity)', () => {
  assert(!line('noElec', 'ELECTRICITY') && line('noElec', 'WATER'));
});
ok('ISSUE-07: two contracts sharing one meter window → blocking warning, the reading is never billed twice', () => {
  const o = B.calculatePeriod('CL', mp.id, 'audit');
  [sharedOld, sharedNew].forEach(x => {
    assert(o.warnings.some(w => w.contractId === x.c.id && w.code === 'SHARED_METER_READING'), x.c.id);
    assert(!o.drafts.some(d => d.contractId === x.c.id && ['ELECTRICITY', 'WATER'].includes(d.items[0].chargeType)), 'no utility line for ' + x.c.id);
  });
});
ok('ISSUE-08: consumption shown in its own unit (kWh / m³), not the price unit', () => {
  const e = line('full', 'ELECTRICITY').items[0], w = line('full', 'WATER').items[0];
  assert(/= 50 kWh$/.test(e.explanation), e.explanation); assert(/= 3 m³$/.test(w.explanation), w.explanation);
  assert.strictEqual(e.quantityUnit, 'kWh'); assert.strictEqual(e.unit, 'đ/kWh', 'price unit unchanged');
});
ok('no duplicate generation: recalculation replaces drafts; sourceKey unique per round', () => {
  const count = () => A.db.billingDrafts.filter(d => d.billingPeriodId === mp.id).length, c1 = count();
  B.calculatePeriod('CL', mp.id, 'audit'); B.calculatePeriod('CL', mp.id, 'audit');
  assert.strictEqual(count(), c1);
  const keys = A.db.billingDrafts.filter(d => d.billingPeriodId === mp.id).map(d => d.sourceKey);
  assert.strictEqual(new Set(keys).size, keys.length);
});
ok('pending rental (no contract) → no receivable', () => {
  const p = K.start1201.p; // still vacant (future contract) — registering a point allocates nothing
  TS.create({ id: 'TT-BLD-PEND', name: 'Billing pending', phone: '0977399999', idType: 'CCCD', idNo: 'BLD-P', address: 'x', market: 'CL', stalls: [], status: 'WAITING_ALLOCATION', source: 'STAFF', since: A.U.today() });
  TS.setRentalDraft('TT-BLD-PEND', [{ pointId: p.id, charges: { land: true, electricity: true }, feeRefs: {} }]);
  assert.strictEqual(B.calculatePeriod('CL', mp.id, 'audit').drafts.filter(d => d.traderId === 'TT-BLD-PEND').length, 0);
});
console.log(`billing-contract-dates-audit PASS (${passed} checks)`);

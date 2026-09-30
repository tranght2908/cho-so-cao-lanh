const assert = require('assert');
const path = require('path');
const { createApp } = require('./harness');

const h = createApp(path.resolve(__dirname, '../..'));
const A = h.A, db = A.db, P = '2026-10';
const eligible = db.stalls.filter(stall => stall.market === 'CL' && stall.hasMeter && db.contracts.some(contract =>
  (contract.businessPointId || contract.stallId) === stall.id && contract.status === 'hieuluc'))
  .sort((a, b) => String(a.code).localeCompare(String(b.code)));
assert.equal(eligible.length, 24, 'fixture must expose 24 eligible CL meter points');
const ttd = db.stalls.find(stall => stall.market === 'TTD' && stall.hasMeter);
const prior = { stallId: eligible[0].id, period: '2026-09', elecPrev: 100, elecCur: 220, elecAvg: 110, waterPrev: 10, waterCur: 20, waterAvg: 9, status: 'RECORDED' };
const ttdReading = { stallId: ttd.id, period: P, elecPrev: 30, elecCur: 50, elecAvg: 12, waterPrev: 5, waterCur: 8, waterAvg: 3, status: 'RECORDED' };
db.meterPeriods = db.meterPeriods.filter(x => x.id !== P).concat([{ id: P, month: 10, year: 2026, status: 'PENDING', completionByMarket: { CL: { status: 'PENDING' }, TTD: { status: 'CLOSED', completedBy: 'TTD closer' } } }]);
db.readings = db.readings.filter(reading => reading.period !== P || !eligible.some(stall => stall.id === reading.stallId));
db.readings.push(prior, ttdReading);
eligible.forEach((stall, index) => db.readings.push({
  stallId: stall.id, period: P,
  elecPrev: 1000 + index * 17, elecCur: null, elecAvg: 80 + (index % 5) * 20,
  waterPrev: 100 + index * 3, waterCur: null, waterAvg: 5 + (index % 4), status: 'PENDING'
}));
db.invoices = [{ id: 'PT-TTD-202610', market: 'TTD', period: P, amount: 100 }];
db.payments = [{ id: 'GD-TTD-202610', invoiceId: 'PT-TTD-202610', amount: 100 }];
A.reindex();

const previousSnapshot = JSON.stringify(prior);
const ttdSnapshot = JSON.stringify(ttdReading);
const financeSnapshot = JSON.stringify({ invoices: db.invoices, payments: db.payments });
const meter = db.meterPeriods.find(x => x.id === P);
const completionSnapshot = JSON.stringify(meter.completionByMarket);
const input = { marketId: 'CL', period: P, reviewCases: 3 };
const result = A.DEV.prepareMeterDemo(input);
assert.equal(result.ok, true, 'preflight and prepare succeed');
assert.equal(result.after.valid, 21, '21 readings are valid');
assert.equal(result.after.review, 3, '3 readings require review');
assert.equal(result.after.unrecorded, 0, 'no reading remains empty');
assert.equal(result.after.completionStatus, 'PENDING', 'prepare never closes CL meter period');
const target = db.readings.filter(reading => reading.period === P && eligible.some(stall => stall.id === reading.stallId));
assert.equal(target.length, 24, 'prepare does not duplicate readings');
const abnormal = reading => (reading.elecCur - reading.elecPrev > reading.elecAvg * 1.5) || (reading.waterCur - reading.waterPrev > reading.waterAvg * 1.5);
assert.equal(target.filter(abnormal).length, 3, 'three reviews come from the real >150% average validation');
assert.equal(target.filter(reading => !abnormal(reading)).length, 21, 'remaining readings are not abnormal');
assert(target.every(reading => reading.elecCur >= reading.elecPrev && reading.waterCur >= reading.waterPrev), 'normal and review readings preserve non-negative consumption');
assert(target.filter(abnormal).every(reading => !reading.reviewedAt && !reading.reviewRequired), 'review cases are neither fake nor pre-resolved');
assert.equal(JSON.stringify(prior), previousSnapshot, 'CL 09/2026 baseline stays unchanged');
assert.equal(JSON.stringify(ttdReading), ttdSnapshot, 'TTD reading stays unchanged');
assert.equal(JSON.stringify({ invoices: db.invoices, payments: db.payments }), financeSnapshot, 'receivables and payments stay unchanged');
assert.equal(JSON.stringify(meter.completionByMarket), completionSnapshot, 'completion states are untouched');

A.ui.market = 'CL'; A.ui.f.mrPeriod = P;
const html = A.VIEWS['dien-nuoc']();
assert(html.includes('Đang ghi'), 'header remains recording');
assert(html.includes('Cần kiểm tra'), 'review filter is present');
const targetSnapshot = JSON.stringify(target);
const rerun = A.DEV.prepareMeterDemo(input);
assert.equal(rerun.ok, true, 'second run is accepted');
assert.equal(JSON.stringify(target), targetSnapshot, 'second run is deterministic and does not duplicate or drift readings');
const collector = A.ACCOUNTS.getMarketCollector('CL');
assert(collector, 'fixture has a CL collector for the review workflow');
A.ui.currentDemoAccountId = collector.id; A.ui.sessionAccountId = collector.id; A.ui.market = 'CL';
target.filter(abnormal).forEach(reading => {
  h.act('mr-v5-review-open', { id: reading.stallId, period: P });
  h.input('#mrv5-elec', String(reading.elecCur));
  h.input('#mrv5-water', String(reading.waterCur));
  h.el('input[name="mrv5-result"]:checked').value = 'CONFIRMED';
  h.input('#mrv5-note', 'Đã kiểm tra, chỉ số hợp lệ.');
  h.act('mr-v5-review-confirm', { id: reading.stallId, period: P });
});
const resolvedHtml = A.VIEWS['dien-nuoc']();
assert(!/data-act="mr-v4-complete-open" disabled/.test(resolvedHtml), 'after real review confirmations, completion becomes eligible');
assert.equal(A.DEV.prepareMeterDemo({ marketId: 'CL', period: P }).code, 'EXPLICIT_TARGET_REQUIRED', 'missing reviewCases is refused');
console.log('prepare-meter-demo: OK');

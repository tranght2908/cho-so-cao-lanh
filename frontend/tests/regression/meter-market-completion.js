const assert = require('assert');
const path = require('path');
const { createApp } = require('./harness');
const h = createApp(path.resolve(__dirname, '../..'));
const A = h.A, db = A.db, P = '2026-09';
const cl = db.stalls.find(x => x.market === 'CL' && x.hasMeter);
const ttd = db.stalls.find(x => x.market === 'TTD' && x.hasMeter);
const meter = { id: P, month: 9, year: 2026, status: 'CLOSED', completedBy: 'Legacy global', completedAt: 'old', completionByMarket: {
  CL: { status: 'PENDING' }, TTD: { status: 'CLOSED', completedBy: 'TTD closer', completedAt: '2026-09-29 17:44' }
} };
db.meterPeriods = [meter];
db.billingPeriods = [{ id: P, label: '09/2026', marketId: 'CL', status: 'PREPARING', startDate: '2026-09-01', endDate: '2026-09-30', dueDate: '2026-10-15' }];
db.issuedPeriods = [];
db.readings = [
  { stallId: cl.id, period: '2026-08', elecPrev: 1, elecCur: 10, waterPrev: 1, waterCur: 5, status: 'RECORDED' },
  { stallId: cl.id, period: P, elecPrev: 10, elecCur: null, waterPrev: 5, waterCur: null, status: 'PENDING' },
  { stallId: ttd.id, period: P, elecPrev: 20, elecCur: 30, waterPrev: 10, waterCur: 15, status: 'RECORDED' }
];
db.invoices = [{ id: 'PT-TTD-09', market: 'TTD', period: P, stallId: ttd.id, traderId: ttd.traderId, amount: 1, paid: 0, status: 'unpaid' }];
A.reindex();

assert.equal(A.meterPeriodIsClosed(meter, 'CL'), false, 'CL override opens a legacy globally-closed period');
assert.equal(A.meterPeriodIsClosed(meter, 'TTD'), true, 'TTD remains closed');
A.ui.market = 'CL'; A.ui.f.mrPeriod = P;
let html = A.VIEWS['dien-nuoc']();
assert(html.includes('Đang ghi'), 'CL header resolves its own PENDING state');
assert(!html.includes('Chỉ số đã được khóa'), 'CL is not rendered locked');
assert(html.includes('Ghi chỉ số'), 'CL can enter readings while TTD is closed');
A.ui.market = 'TTD';
html = A.VIEWS['dien-nuoc']();
assert(html.includes('Đã hoàn tất') && html.includes('TTD closer'), 'TTD header retains its own completion metadata');

let out = A.features.finance.billing.calculatePeriod('CL', P);
assert(out.warnings.some(x => x.code === 'METER_PERIOD_NOT_CLOSED'), 'billing CL is blocked until CL closes');
out = A.features.finance.billing.calculatePeriod('TTD', P);
assert(!out.warnings.some(x => x.code === 'METER_PERIOD_NOT_CLOSED'), 'TTD completion does not depend on CL');

console.log('meter-market-completion: OK');

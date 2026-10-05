const assert = require('assert');
const path = require('path');
const { createApp } = require('./harness');

const { A } = createApp(path.resolve(__dirname, '../..'));
const add = (marketId, period, source) => {
  const id = A.periods.makeId(marketId, period);
  if (!A.periods.exists(marketId, period)) A.db.billingPeriods.push({ id, marketId, period, label: period.slice(5) + '/' + period.slice(0, 4), source, preparationDate: period + '-01', meterReadDate: period + '-01', startDate: period + '-02', reminder1Date: period + '-05', reminder2Date: period + '-10', dueDate: period + '-15', status: 'OPEN' });
  return A.periods.getByMarketMonth(marketId, period);
};
const cl = add('CL', '2026-10', 'default');
const ttd = add('TTD', '2026-10', 'default');
assert.equal(cl.id, 'CL_2026-10');
assert.equal(ttd.id, 'TTD_2026-10');
assert.notEqual(cl.id, ttd.id);
assert(A.periods.getByMarketMonth('CL', '2026-10'));
assert(A.periods.getByMarketMonth('TTD', '2026-10'));
A.periods.markIssued(cl);
assert(A.periods.isIssued(cl));
assert(!A.periods.isIssued(ttd));
const manual = add('CL', '2026-11', 'manual');
assert(A.periods.exists('CL', '2026-11'));
assert.equal(manual.source, 'manual');
assert.equal(A.periods.listForMarket('TTD').some(p => p.id === manual.id), false);
const legacy = (A.db.billingPeriods || []).find(p => !p.marketId && p.period === '2026-09');
assert(legacy && A.periods.resolve('CL', '2026-09') === legacy, 'unowned legacy row remains readable');
console.log('period-identity: OK');

/* Kỳ thu = 1 chợ + 1 tháng (MarketPeriod `{marketId}_{YYYY-MM}`). Kỳ legacy dùng chung theo tháng được tách theo chợ
 * và giữ lại read-only (superseded); phát hành đánh dấu theo id kỳ của chợ, không theo tháng. */
const assert = require('assert');
const path = require('path');
const { createApp } = require('./harness');

const { A } = createApp(path.resolve(__dirname, '../..'));
const add = (marketId, period, source) => {
  const id = A.periods.makeId(marketId, period);
  if (!A.periods.exists(marketId, period)) A.db.billingPeriods.push({ id, marketId, period, label: period.slice(5) + '/' + period.slice(0, 4), source, preparationDate: period + '-01', meterReadDate: period + '-01', startDate: period + '-02', reminder1Date: period + '-05', reminder2Date: period + '-10', dueDate: period + '-15' });
  return A.periods.getByMarketMonth(marketId, period);
};
const cl = add('CL', '2027-01', 'auto');
const ttd = add('TTD', '2027-01', 'auto');
assert.equal(cl.id, 'CL_2027-01');
assert.equal(ttd.id, 'TTD_2027-01');
assert.notEqual(cl.id, ttd.id);
A.periods.markIssued(cl);
assert(A.periods.isIssued(cl));
assert(!A.periods.isIssued(ttd), 'issuing one market does not mark another market (or the whole month)');
assert(!(A.db.issuedPeriods || []).includes('2027-01'), 'no month-level issued marker');
assert.equal(A.periods.listForMarket('TTD').some(p => p.id === cl.id), false);
// Kỳ legacy 09/2026 (không marketId) được tách theo chợ; bản ghi cũ giữ lại read-only để tra cứu.
const legacy = (A.db.billingPeriods || []).find(p => !p.marketId && p.period === '2026-09');
assert(legacy && legacy.superseded && legacy.legacyPeriod, 'legacy month record kept, marked superseded');
assert.equal(A.periods.resolve('CL', '2026-09').id, 'CL_2026-09', 'resolver returns the market period');
assert.equal(A.periods.resolve('CL', legacy.id).id, 'CL_2026-09', 'legacy id reference resolves to the market period');
assert.equal(A.periods.resolve('TTD', '2026-09').id, 'TTD_2026-09');
assert(A.periods.months().includes('2026-09') && A.periods.months().includes('2027-01'));
// Migration chạy lại không tạo trùng.
const n = A.db.billingPeriods.length;
A.periods.migrate();
assert.equal(A.db.billingPeriods.length, n, 'migration is idempotent');
console.log('period-identity: OK');

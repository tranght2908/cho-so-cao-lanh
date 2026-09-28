/* Focused check for the shared-land-policy / market-configuration split.
 * It remains outside approved baseline replay because this is a new UI contract. */
const assert = require('assert');
const path = require('path');
const { createApp } = require('./harness');

const h = createApp(path.resolve(__dirname, '../..'));
const A = h.A;

// System administrator manages a single shared land-price record, not a market copy.
A.ui.sessionAccountId = 'AC-QT01'; A.ui.market = 'CL'; A.syncAccountContext();
h.go('cau-hinh-gia');
assert(/CHÍNH SÁCH CHUNG/.test(h.view()));
assert(/tất cả 12 chợ/i.test(h.view()));
assert(/cfg-price-new/.test(h.view()));
h.act('cfg-price-new', {});
assert.strictEqual(A.ui.cfgForm.marketId, 'ALL');
A.CH['cf-area']({ value: 'Phân loại dùng chung' });
A.CH['cf-stalltype']({ value: 'Ki-ốt' });
A.CH['cf-amount']({ value: '2100' });
A.CH['cf-unit']({ value: 'đ/m²/ngày' });
A.CH['cf-eff']({ value: '2026-05-01' });
h.act('cfg-form-save', {});
const common = A.SERVICE_CFG.list('stallPrices').find(x => x.marketId === 'ALL' && x.stallType === 'Ki-ốt');
assert(common);
h.act('cfg-fee-apply', { cat: 'stallPrices', id: common.id });
assert.strictEqual(common.status, 'active');
const point = A.db.stalls.find(x => x.market === 'CL' && x.type === 'kiot');
assert.strictEqual(A.U.appliedStallPrice(point).id, common.id);

// Market manager only sees shared policy read-only, but can set a rate for its selected market.
A.ui.sessionAccountId = 'AC-NV01'; A.ui.market = 'CL'; A.syncAccountContext();
h.go('cau-hinh-gia');
assert(/Biểu phí chung do Quản trị hệ thống quản lý/.test(h.view()));
assert(!/data-act="cfg-price-new"/.test(h.view()));
h.act('cfg-util-new', {});
assert.strictEqual(A.ui.cfgForm.marketId, 'CL');
h.act('cfg-vehicle-new', {});
assert.strictEqual(A.ui.cfgForm.marketId, 'CL');
assert.strictEqual(A.ui.cfgForm.category, 'VEHICLE');

// Handler-level guard rejects an out-of-scope market even if form state is forged.
A.ui.cfgForm.marketId = 'TTD';
A.ui.cfgForm.vehicleType = 'MOTORBIKE';
A.ui.cfgForm.amount = 70000;
A.ui.cfgForm.effectiveFrom = '2026-05-01';
h.act('cfg-form-save', {});
assert.strictEqual(A.SERVICE_CFG.list('extraServices').some(x => x.category === 'VEHICLE' && x.marketId === 'TTD'), false);

// Ward leadership has the same read-only screen without configuration controls.
A.ui.sessionAccountId = 'AC-LD01'; A.ui.market = 'CL'; A.syncAccountContext();
h.go('cau-hinh-gia');
assert(!/data-act="cfg-price-new"/.test(h.view()));
assert(!/data-act="cfg-util-new"/.test(h.view()));
assert(!/data-act="cfg-svc-new"/.test(h.view()));
assert(!/data-act="cfg-vehicle-new"/.test(h.view()));

console.log('fee policy hierarchy regression PASS');

/* Focused vehicle registration/policy input check. This is intentionally separate
 * from approved baseline replay because it verifies new behaviour introduced after it. */
const assert = require('assert');
const { createApp } = require('./harness');

const h = createApp(require('path').resolve(__dirname, '../..'));
const A = h.A;
A.ui.sessionAccountId = 'AC-NV01'; A.ui.market = 'CL'; A.syncAccountContext();

// Create and activate a vehicle-type policy through the existing fee-config UI.
h.act('cfg-svc-new', {});
A.CH['cf-category']({ value: 'VEHICLE' });
A.CH['cf-vehicle-type']({ value: 'MOTORBIKE' });
A.CH['cf-amount']({ value: '70000' }); A.CH['cf-unit']({ value: 'đ/tháng' }); A.CH['cf-eff']({ value: '2026-05-01' });
h.act('cfg-form-save', {});
const policy = A.SERVICE_CFG.list('extraServices').find(x => x.category === 'VEHICLE' && x.vehicleType === 'MOTORBIKE');
assert(policy);
h.act('cfg-fee-apply', { cat: 'extraServices', id: policy.id });

assert.strictEqual(A.VEHICLES.price('CL', 'MOTORBIKE', '2026-05-15').id, policy.id);
assert.strictEqual(A.VEHICLES.price('CL', 'CAR', '2026-05-15'), null);

h.act('tt-new', {});
[['name', 'Xe Test'], ['phone', '0900000001'], ['idno', '087000111223'], ['address', 'Cao Lãnh'], ['cat', 'Rau']].forEach(([key, value]) => A.IN['wf-p-' + key]({ value }));
h.act('wf-profile-vehicle-add', {});
h.input('#wf-pv-type', 'MOTORBIKE'); h.input('#wf-pv-plate', '66H1-12345'); h.input('#wf-pv-start', '2026-05-15'); h.input('#wf-pv-end', '');
h.input('#wf-pv-description', 'Xe demo'); h.input('#wf-pv-note', ''); h.act('wf-profile-vehicle-save', { index: '' });
assert(/Mức phí đang áp dụng/.test(h.modal()));
h.act('wf-profile-save', {});

const trader = A.db.traders.at(-1), vehicle = A.db.traderVehicles.at(-1);
assert.strictEqual(vehicle.traderId, trader.id);
assert.strictEqual(vehicle.type, 'MOTORBIKE');
assert.strictEqual(vehicle.plateNumber, '66H1-12345');
assert.strictEqual(vehicle.startDate, '2026-05-15');
assert.strictEqual(vehicle.status, 'ACTIVE');
assert.strictEqual(Object.hasOwn(trader, 'vehicles'), false);
assert.strictEqual(Object.hasOwn(vehicle, 'amount'), false);

h.act('vehicle-deactivate', { id: vehicle.id });
assert.strictEqual(vehicle.status, 'INACTIVE');
assert(vehicle.endDate);
console.log('vehicle input/policy regression PASS');

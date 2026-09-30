/* Trader profiles no longer expose vehicle registration UI; legacy records remain readable. */
const assert = require('assert');
const path = require('path');
const { createApp } = require('./harness');
const h = createApp(path.resolve(__dirname, '../..')), A = h.A;
let passed = 0;
const ok = (label, fn) => { try { fn(); passed++; } catch (e) { e.message = label + ': ' + e.message; throw e; } };
const login = () => { A.ui.sessionAccountId = 'AC-NV01'; A.ui.currentDemoAccountId = 'AC-NV01'; A.ui.market = 'CL'; A.syncAccountContext(); };
const vehicleUi = /PHƯƠNG TIỆN|Phương tiện|phương tiện|vehicle-add|vehicle-edit|vehicle-save|vehicle-deactivate|wf-profile-vehicle/i;
login();
ok('create form has no Vehicle section or draft handlers', () => {
  h.act('tt-new');
  assert(!vehicleUi.test(h.modal()));
  assert.strictEqual(A.ACT['wf-profile-vehicle-add'], undefined);
  assert.strictEqual(A.ACT['wf-profile-vehicle-save'], undefined);
});
ok('create succeeds without vehicle data', () => {
  A.IN['wf-p-name']({ value: 'Không Xe' }); A.IN['wf-p-phone']({ value: '0988111122' }); A.IN['wf-p-idno']({ value: 'NO-VEHICLE-001' });
  h.act('wf-profile-save');
  const t = A.db.traders.find(x => x.idNo === 'NO-VEHICLE-001');
  assert(t && !Object.hasOwn(t, 'vehicles'));
});
ok('detail and edit do not render legacy vehicle registrations', () => {
  const t = A.db.traders.find(x => x.market === 'CL');
  A.db.traderVehicles = [{ id: 'VEH-LEGACY', traderId: t.id, market: 'CL', type: 'MOTORBIKE', plateNumber: '66H1-12345', status: 'ACTIVE' }];
  h.act('trader', { id: t.id });
  assert(!vehicleUi.test(h.modal()));
  h.act('tt-edit-open', { id: t.id });
  assert(!vehicleUi.test(h.modal()));
});
console.log(`trader no-vehicle UI regression PASS (${passed} checks)`);

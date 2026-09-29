const assert = require('assert');
const path = require('path');
const { createApp } = require('./harness');

const root = path.resolve(__dirname, '../..');
const { A } = createApp(root);
const BP = A.features.businessPoints.service;
let passed = 0;
const ok = (label, fn) => { try { fn(); passed++; } catch (error) { error.message = label + ': ' + error.message; throw error; } };

const addCollector = (id, scopes) => { A.ACCOUNTS.add({ id, code: id, fullName: id, phone: '0900000000', roleIds: ['collector'], status: 'active', marketScopes: scopes }); return A.ACCOUNTS.get(id); };
const ha = addCollector('TEST-COL-HA', ['HA']);
const haTvh = addCollector('TEST-COL-HA-TVH', ['HA', 'TVH']);
const clOne = addCollector('TEST-COL-CL-1', ['CL']);
const clTwo = addCollector('TEST-COL-CL-2', ['CL']);

// Legacy collectorId values deliberately disagree with scopes: access must ignore them.
A.db.rows.push(
  { id: 'TEST-R-HA', market: 'HA', code: 'HA-T', name: 'HA', industry: 'Khác', allocatedArea: 10, collectorId: clOne.id },
  { id: 'TEST-R-TVH', market: 'TVH', code: 'TVH-T', name: 'TVH', industry: 'Khác', allocatedArea: 10, collectorId: clOne.id },
  { id: 'TEST-R-CL', market: 'CL', code: 'CL-T', name: 'CL', industry: 'Khác', allocatedArea: 10, collectorId: ha.id }
);
A.db.stalls.push(
  { id: 'TEST-P-HA', code: 'HA-T-01', market: 'HA', rowId: 'TEST-R-HA', area: 1, areaTypeId: 'covered', status: 'active' },
  { id: 'TEST-P-TVH', code: 'TVH-T-01', market: 'TVH', rowId: 'TEST-R-TVH', area: 1, areaTypeId: 'covered', status: 'active' },
  { id: 'TEST-P-CL', code: 'CL-T-01', market: 'CL', rowId: 'TEST-R-CL', area: 1, areaTypeId: 'covered', status: 'active' }
);
A.db.traders.push({ id: 'TEST-T-HA', name: 'Trader HA', market: 'HA' }, { id: 'TEST-T-CL', name: 'Trader CL', market: 'CL' });
A.db.contracts.push({ id: 'TEST-C-HA', traderId: 'TEST-T-HA', businessPointId: 'TEST-P-HA', start: '2026-01-01', status: 'active' });
A.reindex();

ok('HA collector can access HA point and not CL point, regardless of row.collectorId', () => {
  assert(BP.collectorCanAccessPoint(ha.id, 'TEST-P-HA'));
  assert(!BP.collectorCanAccessPoint(ha.id, 'TEST-P-CL'));
});
ok('multi-market collector can access HA and TVH but not CL', () => {
  assert(BP.collectorCanAccessPoint(haTvh.id, 'TEST-P-HA'));
  assert(BP.collectorCanAccessPoint(haTvh.id, 'TEST-P-TVH'));
  assert(!BP.collectorCanAccessPoint(haTvh.id, 'TEST-P-CL'));
});
ok('legacy duplicate collector scopes are detected; access remains market-scope based', () => {
  assert(BP.collectorCanAccessPoint(clOne.id, 'TEST-P-CL'));
  assert(BP.collectorCanAccessPoint(clTwo.id, 'TEST-P-CL'));
  assert.strictEqual(A.ACCOUNTS.getMarketCollector('CL'), null);
  assert.strictEqual(A.ACCOUNTS.marketCollectorState('CL').status, 'CONFLICT');
});
ok('trader access uses trader.market', () => {
  assert(BP.collectorCanAccessTrader(ha.id, 'TEST-T-HA'));
  assert(!BP.collectorCanAccessTrader(ha.id, 'TEST-T-CL'));
});
ok('contract access derives market from its business point', () => assert(BP.collectorCanAccessContract(ha.id, 'TEST-C-HA')));
ok('scope lists do not need row collector assignments', () => {
  assert(BP.collectorPoints(ha.id).some(point => point.id === 'TEST-P-HA'));
  assert(BP.collectorRows(ha.id).some(row => row.id === 'TEST-R-HA'));
});
ok('new rows omit collectorId while legacy values stay readable', () => {
  const place = A.features.marketLayout.store.firstZonePlace('CL');
  const created = A.features.marketLayout.store.addRow('CL', place, 'TEST-SCOPE', 'Dãy test', 'Khác', 0).row;
  assert(created && !Object.prototype.hasOwnProperty.call(created, 'collectorId'));
  assert.strictEqual(A.idx.row.get('TEST-R-HA').collectorId, clOne.id);
});

console.log(`collector-market-scope regression PASS (${passed} checks)`);

/* Regression: expand points in an existing Row through the shared PointGroup engine. */
const assert = require('assert');
const path = require('path');
const { createApp } = require('./harness');
const root = path.resolve(__dirname, '../..');
let passed = 0;
const ok = (label, fn) => { try { fn(); passed++; } catch (e) { e.message = label + ': ' + e.message; throw e; } };
const h = createApp(root), A = h.A, S = A.features.marketLayout.store, BP = A.features.businessPoints.service, MC = A.features.markets.service;
const row = A.db.rows.find(r => r.id === 'CL-R-HS-A');
const points = () => A.db.stalls.filter(s => s.rowId === row.id);
const used = () => points().reduce((s, x) => s + x.area, 0);
const make = groups => S.pointGroups.validate('CL', row.id, groups);

ok('row point groups validate against the row and preview continues after highest existing code', () => {
  const g = [{ id: 'g1', areaTypeId: 'covered', quantity: 1, areaPerPoint: 1 }, { id: 'g2', areaTypeId: 'uncovered', quantity: 1, areaPerPoint: 1 }];
  const out = make(g); assert(out.ok, out.errors.join('\n'));
  const existingMax = Math.max(...points().map(x => Number((x.code.match(/(\d+)$/) || [0, 0])[1])));
  assert.strictEqual(Number(out.pointCodes.g1[0].slice(-2)), existingMax + 1);
  assert.strictEqual(Number(out.pointCodes.g2[0].slice(-2)), existingMax + 2);
});
ok('rejects invalid quantity, invalid area and area beyond the remaining Row capacity without writes', () => {
  const before = points().length;
  assert(!make([{ id: 'g', areaTypeId: 'covered', quantity: 1.5, areaPerPoint: 1 }]).ok);
  assert(!make([{ id: 'g', areaTypeId: 'covered', quantity: 1, areaPerPoint: 0 }]).ok);
  assert(!make([{ id: 'g', areaTypeId: 'covered', quantity: 1, areaPerPoint: row.allocatedArea - used() + 1 }]).ok);
  assert.strictEqual(points().length, before);
});
ok('checks count and area capacities independently', () => {
  const original = MC.get('CL').capacityByAreaType;
  const usage = MC.usage('CL');
  MC.update('CL', { totalArea: 9999, businessArea: 9999, capacityByAreaType: [{ areaTypeId: 'covered', maxPointCount: usage.covered.count, maxArea: 9999 }] }, 'test');
  assert(!make([{ id: 'g', areaTypeId: 'covered', quantity: 1, areaPerPoint: 1 }]).ok, 'count limit');
  MC.update('CL', { totalArea: 9999, businessArea: 9999, capacityByAreaType: [{ areaTypeId: 'covered', maxPointCount: 999, maxArea: usage.covered.area }] }, 'test');
  assert(!make([{ id: 'g', areaTypeId: 'covered', quantity: 1, areaPerPoint: 1 }]).ok, 'area limit');
  MC.update('CL', { totalArea: 9999, businessArea: 9999, capacityByAreaType: original }, 'test');
});
ok('atomic create adds all points as vacant operational points only', () => {
  const before = { points: points().length, contracts: A.db.contracts.length, traders: A.db.traders.length, invoices: A.db.invoices.length };
  const out = S.pointGroups.commit('CL', row.id, [{ id: 'g1', areaTypeId: 'covered', quantity: 1, areaPerPoint: 1 }, { id: 'g2', areaTypeId: 'uncovered', quantity: 1, areaPerPoint: 1 }]);
  assert(out.ok, out.errors && out.errors.join('\n'));
  assert.strictEqual(points().length, before.points + 2);
  assert(out.stalls.every(s => s.status === 'active' && BP.usageStatus(s) === 'vacant'));
  assert.strictEqual(A.db.contracts.length, before.contracts); assert.strictEqual(A.db.traders.length, before.traders); assert.strictEqual(A.db.invoices.length, before.invoices);
  assert(points().every(s => s.area <= row.allocatedArea));
});
console.log(`row-point-expansion regression PASS (${passed} checks)`);

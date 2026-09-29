/* Regression: draft-only initial layout setup wizard (v16 graph). */
const assert = require('assert');
const path = require('path');
const { createApp } = require('./harness');
const root = path.resolve(__dirname, '../..');
let passed = 0;
const ok = (label, fn) => { try { fn(); passed++; } catch (e) { e.message = label + ': ' + e.message; throw e; } };
const h = createApp(root), A = h.A, S = A.features.marketLayout.store;
const before = k => A.db[k].filter(x => x.market === 'HA').length;
const d = S.initialSetup.createDraft('HA');

ok('draft starts without mutating the v16 graph', () => {
  assert(!S.initialSetup.graphExists('HA'));
  ['buildings', 'floors', 'rows', 'stalls'].forEach(k => assert.strictEqual(before(k), 0, k));
  assert(!S.initialSetup.validate(d).ok, 'empty building name must be blocked');
});
ok('supports a floored building and a floorless building in one draft', () => {
  d.buildings[0].name = 'Nhà chợ A';
  d.floors.push({ id: 'tmp-floor-1', buildingDraftId: d.buildings[0].id, name: 'Tầng 1', businessArea: 100 });
  d.buildings.push({ id: 'tmp-building-2', name: 'Khu ngoài trời', hasFloors: false });
  d.rows.push({ id: 'tmp-row-1', buildingDraftId: d.buildings[0].id, floorDraftId: 'tmp-floor-1', name: 'Dãy hải sản', industry: A.D.INDUSTRIES[0], allocatedArea: 60 });
  d.rows.push({ id: 'tmp-row-2', buildingDraftId: 'tmp-building-2', floorDraftId: null, name: 'Dãy rau củ', industry: A.D.INDUSTRIES[1], allocatedArea: 40 });
  d.pointGroups.push({ id: 'tmp-group-1', rowDraftId: 'tmp-row-1', areaTypeId: 'covered', quantity: 4, areaPerPoint: 10 });
  d.pointGroups.push({ id: 'tmp-group-2', rowDraftId: 'tmp-row-1', areaTypeId: 'uncovered', quantity: 2, areaPerPoint: 8 });
  d.pointGroups.push({ id: 'tmp-group-3', rowDraftId: 'tmp-row-2', areaTypeId: 'uncovered', quantity: 4, areaPerPoint: 10 });
  const c = S.initialSetup.validate(d);
  assert(c.ok, c.errors.join('\n'));
  assert.strictEqual(c.preview.pointCodes['tmp-group-1'].length, 4);
  assert.strictEqual(c.preview.pointCodes['tmp-group-2'][0].slice(-2), '05', 'numbering continues across area groups');
  ['buildings', 'floors', 'rows', 'stalls'].forEach(k => assert.strictEqual(before(k), 0, 'still draft: ' + k));
});
ok('blocks row/floor and point-area violations before save', () => {
  const bad = JSON.parse(JSON.stringify(d)); bad.rows[0].allocatedArea = 20;
  assert(!S.initialSetup.validate(bad).ok);
  bad.rows[0].allocatedArea = 60; bad.floors[0].businessArea = 50;
  assert(!S.initialSetup.validate(bad).ok);
  ['buildings', 'floors', 'rows', 'stalls'].forEach(k => assert.strictEqual(before(k), 0, 'no partial record: ' + k));
});
ok('legacy per-type quota no longer applies; area types must be applied by the market', () => {
  const MC = A.features.markets.service;
  MC.update('HA', { totalArea: 1000, businessArea: 500, capacityByAreaType: [{ areaTypeId: 'covered', maxPointCount: 3, maxArea: 30 }, { areaTypeId: 'uncovered', maxPointCount: 1, maxArea: 1 }] }, 'test');
  assert(S.initialSetup.validate(d).ok, 'old quota (count/area per type) is ignored');
  MC.update('HA', { allowedAreaTypeIds: ['covered'] }, 'test');
  assert(S.initialSetup.validate(d).errors.some(e => /không được áp dụng tại chợ này/.test(e)), 'uncovered not applied');
  MC.update('HA', { allowedAreaTypeIds: ['covered', 'uncovered'] }, 'test');
  assert(S.initialSetup.validate(d).ok);
});
ok('atomic commit creates graph only after final validation, and persists', () => {
  const out = S.initialSetup.commit(d);
  assert(out.ok, (out.errors || []).join('\n'));
  assert.strictEqual(before('buildings'), 2); assert.strictEqual(before('floors'), 1); assert.strictEqual(before('rows'), 2); assert.strictEqual(before('stalls'), 10);
  const rows = A.db.rows.filter(x => x.market === 'HA');
  assert(rows.every(r => A.D.INDUSTRIES.includes(r.industry)));
  assert(A.db.stalls.filter(x => x.market === 'HA').every(x => x.status === 'active' && A.features.businessPoints.service.usageStatus(x) === 'vacant'));
  assert(!h.localStorage.getItem('choso-caolanh-layout'), 'legacy layout key is not written');
  const h2 = createApp(root, { storage: { 'choso-caolanh-state': h.localStorage.getItem('choso-caolanh-state') } });
  assert.strictEqual(h2.A.db.stalls.filter(x => x.market === 'HA').length, 10, 'new graph reloads from canonical state');
});
console.log(`initial-layout-setup regression PASS (${passed} checks)`);

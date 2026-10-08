/* Focused regression for the unified market-layout workspace redesign. */
const assert = require('assert');
const path = require('path');
const { createApp } = require('./harness');
const h = createApp(path.resolve(__dirname, '../..'));
const A = h.A, S = A.features.marketLayout.store, L = A.features.lifecycle.service, MC = A.features.markets.service;
const use = (id, market) => { A.ui.sessionAccountId = id; A.ui.currentDemoAccountId = id; A.ui.market = market; A.syncAccountContext(); };
use('AC-QT01', 'HA');
h.go('mat-bang');
assert(/Sơ đồ mặt bằng/.test(h.view()));
assert(/Chợ chưa có cấu trúc mặt bằng/.test(h.view()));

// Build a small, independent graph through the canonical store.
MC.update('HA', { totalArea: 600, businessArea: 420 }, 'test');
const b = S.addBuilding('HA', { name: 'Khối A', code: 'A', businessArea: 420 }).building;
assert(b);
const f = S.addFloor(b.id, 'Tầng 1', 210, { code: 'T1' }).floor;
assert(f);
assert(S.addFloor(b.id, 'Tầng vượt', 211, { code: 'T2' }).errors.length, 'child floor cannot exceed building area');
const r = S.addRow('HA', { blockId: b.id, floorId: f.id }, 'A1', 'Dãy A1', 'Khác', 72).row;
assert(r);
const add = S.pointGroups.commit('HA', r.id, [{ id: 'G1', areaTypeId: 'covered', quantity: 6, areaPerPoint: 5 }]);
assert(add.ok && add.stalls.length === 6);
assert(add.stalls.every(x => x.areaTypeId === 'covered' && x.status === 'active'));
assert.strictEqual(S.budget.row(r).remaining, 42);
A.save();

// Completion is explicit and must not activate the market.
assert.strictEqual(MC.get('HA').status, 'NOT_ACTIVE');
assert(L.completeMarketLayout('HA', 'test'));
assert.strictEqual(MC.get('HA').layoutStatus, 'SETUP_COMPLETED');
assert.strictEqual(MC.get('HA').status, 'NOT_ACTIVE');
assert.strictEqual(L.marketLifecycle('HA').stage, 'PENDING_FEE');

A.ui.mb.sel = { k: 'floor', id: f.id }; A.ui.mb.inspectorOpen = true; A.render();
assert(/Khối A/.test(h.view()) && /Tầng 1/.test(h.view()) && /Dãy A1/.test(h.view()));
h.act('stall', { id: add.stalls[0].id });
const fromMap = h.modal();
assert(/Điểm kinh doanh/.test(fromMap) && fromMap.includes(add.stalls[0].code), 'map opens the shared point-detail drawer');
h.act('close');
h.act('mb-view', { id: 'table' });
h.act('dk-open', { id: add.stalls[0].id });
const fromList = h.modal();
assert.strictEqual(fromList, fromMap, 'map and list render exactly the same point-detail drawer');
console.log('mat-bang-redesign: PASS');

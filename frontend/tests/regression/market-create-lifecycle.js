/* UC regression: creating and completing a market must follow the market/layout lifecycle. */
const assert = require('assert');
const path = require('path');
const { createApp } = require('./harness');

const { A } = createApp(path.resolve(__dirname, '../..'));
const MC = A.features.markets.service;
const S = A.features.marketLayout.store;

const graphCount = id => ['buildings', 'floors', 'rows', 'stalls'].map(k => A.db[k].filter(x => x.market === id).length);
const market = MC.add({
  name: 'Chợ kiểm thử vòng đời', address: 'Khóm kiểm thử', rank: 'HANG_3',
  phone: '0901234567', priceConfigId: 'QD480_NHOM_CON_LAI', totalArea: 1000,
  businessArea: 600, allowedAreaTypeIds: ['covered']
}, 'test');

assert.deepStrictEqual(graphCount(market.id), [0, 0, 0, 0], 'create market must not create layout records');
assert.strictEqual(market.status, 'NOT_ACTIVE');
assert.strictEqual(market.layoutStatus, 'PENDING_SETUP');
assert.strictEqual(market.nonBusinessArea, 400);
assert(!MC.layoutReady(market.id), 'declaring area alone must not make a market active');

MC.update(market.id, { address: 'Khóm kiểm thử mới', phone: '0901234567' }, 'test');
assert.strictEqual(MC.get(market.id).status, 'NOT_ACTIVE', 'basic edits before setup do not change lifecycle state');
assert.strictEqual(MC.get(market.id).layoutStatus, 'PENDING_SETUP');

const draft = S.initialSetup.createDraft(market.id);
draft.buildings[0].name = 'Nhà lồng A';
draft.floors.push({ id: 'floor-1', buildingDraftId: draft.buildings[0].id, name: 'Tầng 1', businessArea: 500 });
draft.rows.push({ id: 'row-1', buildingDraftId: draft.buildings[0].id, floorDraftId: 'floor-1', name: 'Dãy rau', industry: A.D.INDUSTRIES[0], allocatedArea: 500 });
draft.pointGroups.push({ id: 'group-1', rowDraftId: 'row-1', areaTypeId: 'covered', quantity: 10, areaPerPoint: 10 });
const result = S.initialSetup.commit(draft);
assert(result.ok, (result.errors || []).join('\n'));
assert(MC.layoutReady(market.id));
assert.strictEqual(MC.get(market.id).status, 'ACTIVE');
assert.strictEqual(MC.get(market.id).layoutStatus, 'SETUP_COMPLETED');

const reduced = MC.validateScale({ totalArea: 1000, businessArea: 400 }, { required: true, marketId: market.id });
assert(!reduced.ok && /mặt bằng\/điểm kinh doanh/.test(reduced.errors.businessArea));
const types = MC.validateAreaTypes(['uncovered'], ['covered'], MC.usage(market.id));
assert(!types.ok && /đang sử dụng/.test(types.error));

console.log('market-create-lifecycle: PASS');

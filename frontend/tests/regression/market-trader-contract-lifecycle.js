const assert = require('assert');
const path = require('path');
const { createApp } = require('./harness');

const { A } = createApp(path.resolve(__dirname, '../..'));
const MC = A.features.markets.service;
const ML = A.features.marketLayout.store;
const BP = A.features.businessPoints.service;
const TS = A.features.traders.service;
const CS = A.features.contracts.service;
const L = A.features.lifecycle.service;
const today = A.U.today();
const plus = n => new Date(Date.parse(today) + n * 86400000).toISOString().slice(0, 10);

// 1-3: creation is empty/pending; partial graph stays pending; first valid
// point through the incremental workspace completes the market lifecycle.
const m = A.MARKET_CATALOG.add({ name: 'Chợ lifecycle liên module', address: 'Test', rank: 'HANG_3', priceConfigId: 'QD480_NHOM_CON_LAI', totalArea: 100, businessArea: 80, allowedAreaTypeIds: ['covered'] }, 'test');
assert.equal(m.layoutStatus, 'PENDING_SETUP');
assert.equal(m.status, 'NOT_ACTIVE');
assert.equal(A.db.buildings.filter(x => x.market === m.id).length, 0);
assert.equal(A.db.stalls.filter(x => x.market === m.id).length, 0);
const b = ML.addBuilding(m.id, { name: 'Nhà test', businessArea: 80 }).building;
assert.equal(MC.get(m.id).status, 'NOT_ACTIVE');
const r = ML.addRow(m.id, { blockId: b.id, floorId: null }, 'R-TEST', 'Dãy test', 'Thực phẩm', 20).row;
const built = ML.pointGroups.commit(m.id, r.id, [{ id: 'G1', quantity: 1, areaPerPoint: 10, areaTypeId: 'covered' }]);
assert(built.ok);
const p = built.stalls[0];
assert.equal(p.usageStatus, 'VACANT');
assert.equal(MC.get(m.id).layoutStatus, 'SETUP_COMPLETED');
assert.equal(MC.get(m.id).status, 'ACTIVE');

// 4-7: profile starts waiting; service prevents a duplicate/overlapping
// allocation; a committed effective contract updates all three aggregates.
const t = TS.create({ id: 'T-LC-01', name: 'Tiểu thương lifecycle', phone: '0987000001', idNo: '079000000001', market: m.id, stalls: [] });
assert(t);
assert.equal(t.status, 'WAITING_ALLOCATION');
assert.equal(A.db.contracts.filter(c => c.traderId === t.id).length, 0);
const c = { id: 'HD-LC-01', traderId: t.id, market: m.id, stallId: p.id, businessPointId: p.id, start: today, end: plus(30), status: 'ACTIVE', history: [] };
assert(CS.createWithPointAllocation({ contract: c, traderId: t.id, pointId: p.id, pointHistoryEntry: 'test' }));
assert.equal(BP.get(p.id).usageStatus, 'RENTED');
assert.equal(TS.getProfile(t.id).status, 'ACTIVE');
assert.equal(BP.contractOn(p.id, today).id, c.id);
BP.get(p.id).usageStatus = 'VACANT'; // legacy cache must not hide a current contract in views
assert.equal(BP.displayStatus(BP.get(p.id), today), 'thue');
BP.get(p.id).usageStatus = 'RENTED';
const overlap = { id: 'HD-LC-02', traderId: t.id, market: m.id, stallId: p.id, businessPointId: p.id, start: plus(1), end: plus(10), status: 'ACTIVE', history: [] };
assert.equal(CS.createWithPointAllocation({ contract: overlap, traderId: t.id, pointId: p.id }), null);
assert.equal(A.db.contracts.some(x => x.id === overlap.id), false);

// A future contract reserves its date interval but does not mutate today's
// usage or merchant business status. It becomes effective on its start day.
const p2 = Object.assign({}, p, { id: m.id + '-P2', code: 'R-TEST-02', usageStatus: 'VACANT', history: [] });
A.db.stalls.push(p2); A.reindex();
const future = { id: 'HD-LC-03', traderId: t.id, market: m.id, stallId: p2.id, businessPointId: p2.id, start: plus(40), end: plus(70), status: 'ACTIVE', history: [] };
assert(CS.createWithPointAllocation({ contract: future, traderId: t.id, pointId: p2.id }));
assert.equal(BP.get(p2.id).usageStatus, 'VACANT');
assert.equal(CS.presentationStatus(future), 'upcoming');
L.syncExpiry(plus(40));
assert.equal(BP.get(p2.id).usageStatus, 'RENTED');

// 8-10: a trader account is linked by stable traderId and activation does not
// alter merchant business status. The account store forces pending activation.
const acc = { id: 'AC-LC-01', code: 'LC01', fullName: t.name, phone: t.phone, roleIds: ['trader'], marketScopes: [m.id], status: 'ACTIVE', traderId: t.id };
assert(A.features.accounts.service.createTraderAccount(acc));
assert.equal(A.ACCOUNTS.get(acc.id).status, 'PENDING_ACTIVATION');
assert.equal(A.ACCOUNTS.byTraderId(t.id).id, acc.id);
assert.equal(A.features.accounts.service.createTraderAccount(Object.assign({}, acc, { id: 'AC-LC-02' })), null);
A.ACCOUNTS.activateAfterOtp(A.ACCOUNTS.get(acc.id));
assert.equal(A.ACCOUNTS.get(acc.id).status, 'ACTIVE');
assert.equal(TS.getProfile(t.id).status, 'ACTIVE');

console.log('market-trader-contract-lifecycle: PASS');

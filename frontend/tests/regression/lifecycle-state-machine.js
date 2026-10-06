const assert = require('assert');
const { createApp } = require('./harness');

const { A } = createApp(require('path').resolve(__dirname, '../..'));
const L = A.features.lifecycle.service;
const BP = A.features.businessPoints.service;
const CS = A.features.contracts.service;

const market = A.MARKET_CATALOG.add({ name: 'Chợ lifecycle', address: 'Test', rank: 'HANG_3', priceConfigId: 'QD480_NHOM_CON_LAI' }, 'test');
assert.strictEqual(market.status, 'NOT_ACTIVE');
assert.strictEqual(market.layoutStatus, 'PENDING_SETUP');
assert.strictEqual(L.completeMarketLayout(market.id, 'test'), null, 'a market cannot activate before its layout graph is complete');
assert.strictEqual(A.MARKET_CATALOG.get(market.id).status, 'NOT_ACTIVE');

const building = { id: 'LIFE-BUILDING', market: market.id, name: 'Nhà lồng', businessArea: 10 };
const row = { id: 'LIFE-ROW', market: market.id, buildingId: building.id, allocatedArea: 10 };
const point = { id: 'LIFE-POINT', code: 'L-01', market: market.id, rowId: row.id, area: 1, status: 'active', operationalStatus: 'active', usageStatus: 'VACANT', usageReason: null };
const trader = { id: 'LIFE-TRADER', name: 'Lifecycle trader', market: market.id, stalls: [], status: 'WAITING_ALLOCATION' };
A.db.buildings.push(building); A.db.rows.push(row); A.db.stalls.push(point); A.db.traders.push(trader); A.reindex();
L.completeMarketLayout(market.id, 'test');
assert.strictEqual(A.MARKET_CATALOG.get(market.id).status, 'ACTIVE');
assert.strictEqual(A.MARKET_CATALOG.get(market.id).layoutStatus, 'SETUP_COMPLETED');
assert.strictEqual(BP.get(point.id).usageStatus, 'VACANT');
assert.strictEqual(A.features.traders.service.getProfile(trader.id).status, 'WAITING_ALLOCATION');

const makeContract = (id, end) => ({ id, market: market.id, traderId: trader.id, stallId: point.id, businessPointId: point.id, start: '2026-01-01', end, status: 'ACTIVE', history: [] });
const first = makeContract('LIFE-C1', '2026-12-31');
assert(CS.createWithPointAllocation({ contract: first, traderId: trader.id, pointId: point.id, pointHistoryEntry: 'test' }));
assert.strictEqual(first.status, 'ACTIVE');
assert.strictEqual(BP.get(point.id).usageStatus, 'RENTED');
assert.strictEqual(A.features.traders.service.getProfile(trader.id).status, 'ACTIVE');

L.expireContract(first);
assert.strictEqual(first.status, 'PENDING_LIQUIDATION');
assert.strictEqual(first.endReason, 'EXPIRED');
assert.strictEqual(BP.get(point.id).usageStatus, 'SUSPENDED');
assert.strictEqual(BP.get(point.id).usageReason, 'CONTRACT_EXPIRED');
L.liquidateContract(first);
assert.strictEqual(first.status, 'LIQUIDATED');
assert.strictEqual(BP.get(point.id).usageStatus, 'VACANT');

const active = makeContract('LIFE-C2', '2026-12-31');
A.db.contracts.push(active); A.reindex(); L.activateContract(active);
const ending = makeContract('LIFE-C3', '2026-12-31');
const secondPoint = { id: 'LIFE-POINT-2', code: 'L-02', market: market.id, rowId: null, area: 1, status: 'active', operationalStatus: 'active', usageStatus: 'RENTED', usageReason: null };
A.db.stalls.push(secondPoint); ending.stallId = ending.businessPointId = secondPoint.id;
A.db.contracts.push(ending); A.reindex(); L.terminateContract(ending);
assert.strictEqual(ending.status, 'PENDING_LIQUIDATION');
assert.strictEqual(ending.endReason, 'EARLY_TERMINATION');
assert.strictEqual(BP.get(secondPoint.id).usageReason, 'CONTRACT_TERMINATED');
assert.strictEqual(A.features.traders.service.getProfile(trader.id).status, 'ACTIVE');

const expiryPoint = { id: 'LIFE-POINT-3', code: 'L-03', market: market.id, rowId: null, area: 1, status: 'active', operationalStatus: 'active', usageStatus: 'RENTED', usageReason: null };
const expiring = makeContract('LIFE-C4', '2026-05-14');
expiring.stallId = expiring.businessPointId = expiryPoint.id;
A.db.stalls.push(expiryPoint); A.db.contracts.push(expiring); A.reindex();
assert(L.syncExpiry('2026-05-15'));
assert.strictEqual(expiring.status, 'PENDING_LIQUIDATION');
assert.strictEqual(expiring.endReason, 'EXPIRED');
assert.strictEqual(BP.get(expiryPoint.id).usageReason, 'CONTRACT_EXPIRED');

const account = { id: 'LIFE-ACCOUNT', code: 'LIFE-ACCOUNT', roleIds: ['trader'], marketScopes: [market.id], status: 'PENDING_ACTIVATION', traderId: trader.id };
A.ACCOUNTS.add(account);
assert.strictEqual(A.ACCOUNTS.get(account.id).status, 'PENDING_ACTIVATION');
A.ACCOUNTS.activateAfterOtp(A.ACCOUNTS.get(account.id));
assert.strictEqual(A.ACCOUNTS.get(account.id).status, 'ACTIVE');
L.liquidateContract(active);
assert.strictEqual(A.ACCOUNTS.get(account.id).status, 'ACTIVE', 'contract lifecycle never locks the trader account');
console.log('lifecycle-state-machine: PASS');

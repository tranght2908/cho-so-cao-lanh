const assert = require('assert');
const { createApp } = require('./harness');

const { A } = createApp(require('path').resolve(__dirname, '../..'));
const L = A.features.lifecycle.service;
const BP = A.features.businessPoints.service;
const CS = A.features.contracts.service;

// Vòng đời 10/2026: hoàn tất mặt bằng KHÔNG kích hoạt chợ; cần cấu hình mức thu RIÊNG của chợ (mặt bằng cho
// loại diện tích đang dùng + điện + nước + dịch vụ). Bản ghi cuối cùng được lưu là bước làm chợ ACTIVE.
const addFeePolicy = (marketId, areaTypeId) => {
  A.SERVICE_CFG.setChargeApplicability(marketId, { electricity: true, water: true, service: true }, 'test');
  const base = { marketId, status: 'active', effectiveFrom: '2026-01-01', effectiveTo: null, legalBasis: {}, attachments: [] };
  A.SERVICE_CFG.add('utilities', Object.assign({ name: 'Điện', kind: 'ELECTRICITY', elecPrice: 3000, elecUnit: 'đ/kWh' }, base), 'test');
  A.SERVICE_CFG.add('utilities', Object.assign({ name: 'Nước', kind: 'WATER', waterPrice: 11000, waterUnit: 'đ/m³' }, base), 'test');
  A.SERVICE_CFG.add('extraServices', Object.assign({ name: 'Vệ sinh', category: 'SANITATION', calcMethod: 'fixed', amount: 20000, unit: 'đ/điểm/tháng' }, base), 'test');
  return A.SERVICE_CFG.add('stallPrices', Object.assign({ name: 'Mức thu test', scope: 'MARKET', areaTypeId, stallType: '', amount: 1000, unit: 'đ/m²/ngày' }, base), 'test');
};
const market = A.MARKET_CATALOG.add({ name: 'Chợ lifecycle', address: 'Test', rank: 'HANG_3', priceConfigId: 'QD480_NHOM_CON_LAI' }, 'test');
assert.strictEqual(market.status, 'NOT_ACTIVE');
assert.strictEqual(market.layoutStatus, 'PENDING_SETUP');
assert.strictEqual(L.completeMarketLayout(market.id, 'test'), null, 'a market cannot activate before its layout graph is complete');
assert.strictEqual(A.MARKET_CATALOG.get(market.id).status, 'NOT_ACTIVE');

const building = { id: 'LIFE-BUILDING', market: market.id, name: 'Nhà lồng', businessArea: 10 };
const row = { id: 'LIFE-ROW', market: market.id, buildingId: building.id, allocatedArea: 10 };
const point = { id: 'LIFE-POINT', code: 'L-01', market: market.id, rowId: row.id, area: 1, areaTypeId: 'covered', status: 'active', operationalStatus: 'active', usageStatus: 'VACANT', usageReason: null };
const trader = { id: 'LIFE-TRADER', name: 'Lifecycle trader', market: market.id, stalls: [], status: 'WAITING_ALLOCATION' };
A.db.buildings.push(building); A.db.rows.push(row); A.db.stalls.push(point); A.db.traders.push(trader); A.reindex();
L.completeMarketLayout(market.id, 'test');
assert.strictEqual(A.MARKET_CATALOG.get(market.id).layoutStatus, 'SETUP_COMPLETED');
assert.strictEqual(A.MARKET_CATALOG.get(market.id).status, 'NOT_ACTIVE', 'layout completion alone does not activate');
addFeePolicy(market.id, 'covered');
assert.strictEqual(A.MARKET_CATALOG.get(market.id).status, 'ACTIVE', 'fee coverage for the used area type activates');
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
// Scope 10/2026: hết hạn chỉ là trạng thái/cảnh báo của hợp đồng — syncExpiry KHÔNG chuyển chờ thanh lý,
// KHÔNG tạm ngừng điểm, KHÔNG đổi hồ sơ (expireContract chỉ còn là use case legacy, kiểm tra trực tiếp ở trên).
assert.strictEqual(L.syncExpiry('2026-05-15'), false);
assert.strictEqual(expiring.status, 'ACTIVE');
assert(!expiring.endReason);
assert.strictEqual(BP.get(expiryPoint.id).usageStatus, 'RENTED');
assert.strictEqual(BP.get(expiryPoint.id).usageReason, null);
assert.strictEqual(CS.displayStatus(expiring, '2026-05-15'), 'EXPIRED');

const account = { id: 'LIFE-ACCOUNT', code: 'LIFE-ACCOUNT', roleIds: ['trader'], marketScopes: [market.id], status: 'PENDING_ACTIVATION', traderId: trader.id };
A.ACCOUNTS.add(account);
assert.strictEqual(A.ACCOUNTS.get(account.id).status, 'PENDING_ACTIVATION');
A.ACCOUNTS.activateAfterOtp(A.ACCOUNTS.get(account.id));
assert.strictEqual(A.ACCOUNTS.get(account.id).status, 'ACTIVE');
L.liquidateContract(active);
assert.strictEqual(A.ACCOUNTS.get(account.id).status, 'ACTIVE', 'contract lifecycle never locks the trader account');
console.log('lifecycle-state-machine: PASS');

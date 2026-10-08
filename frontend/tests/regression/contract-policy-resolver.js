/* Regression: land-fee resolution uses ONLY the market's own fee configuration (decision 10/2026) + point
 * area type + contract start. A SHARED rank policy (QĐ 480 style) is reference data and must never be used
 * as the applied price by contracts or billing. Fixtures are self-contained. */
const assert = require('assert');
const path = require('path');
const { createApp } = require('./harness');

const h = createApp(path.resolve(__dirname, '../..'));
const A = h.A;
const MC = A.features.markets.service;
const layout = A.features.marketLayout.store;
const contracts = A.features.contracts.service;
const billing = A.features.finance.billing;
const date = '2026-10-01';

function marketWithCoveredPoint(name) {
  const m = MC.add({ name, address: 'Regression', rank: 'HANG_1', phone: '0901234567', priceConfigId: 'QD480_CHO_CAO_LANH', totalArea: 200, businessArea: 100, allowedAreaTypeIds: ['covered'] }, 'test');
  const d = layout.initialSetup.createDraft(m.id);
  d.buildings[0].name = 'Nhà A';
  d.floors.push({ id: 'f', buildingDraftId: d.buildings[0].id, name: 'Tầng 1', businessArea: 100 });
  d.rows.push({ id: 'r', buildingDraftId: d.buildings[0].id, floorDraftId: 'f', name: 'Dãy A', industry: A.D.INDUSTRIES[0], allocatedArea: 100 });
  d.pointGroups.push({ id: 'p', rowDraftId: 'r', areaTypeId: 'covered', quantity: 1, areaPerPoint: 10 });
  const committed = layout.initialSetup.commit(d);
  assert(committed.ok, 'layout setup: ' + JSON.stringify(committed.errors || committed));
  // Test này kiểm tra bộ giải đơn giá (loại diện tích + ngày hiệu lực + chỉ cấu hình riêng của chợ) nên dựng
  // chợ như dữ liệu cũ đã ACTIVE (vòng đời kích hoạt được kiểm tra riêng ở market-create-lifecycle.js).
  MC.update(m.id, { status: 'ACTIVE' }, 'test');
  return { market: MC.get(m.id), point: A.db.stalls.find(p => p.market === m.id) };
}

const a = marketWithCoveredPoint('Chợ test policy resolver A');
// QĐ 480 style shared rank policy: reference only — never the applied price.
A.SERVICE_CFG.add('stallPrices', {
  id: 'ignored', scope: 'SHARED', marketId: null, marketIds: [a.market.id], marketGrades: [1], areaTypeId: 'covered',
  amount: 1500, unit: 'đ/m²/ngày', effectiveFrom: date, effectiveTo: null, status: 'active', legalBasis: { docNo: 'QD480-REF', summary: 'Shared reference' }
}, 'test');
assert.strictEqual(A.SERVICE_CFG.resolveApplicableMarketFeePolicy({ market: a.market, point: a.point, startDate: date }), null, 'shared rank policy is not an applied price');
assert.strictEqual(billing.buildPriceTerms(a.market.id, a.point, 10, date, {}, 'TEST').land, null, 'billing does not silently fall back to the shared policy');
const policy = A.SERVICE_CFG.add('stallPrices', {
  id: 'ignored', scope: 'MARKET', marketId: a.market.id, areaTypeId: 'covered',
  amount: 2000, unit: 'đ/m²/ngày', effectiveFrom: date, effectiveTo: null, status: 'active', legalBasis: { docNo: 'TEST-2000', summary: 'Regression policy' }
}, 'test');

assert.strictEqual(A.SERVICE_CFG.resolveApplicableMarketFeePolicy({ market: a.market, point: a.point, startDate: '2026-09-30' }), null, 'policy must not match before effective date');
assert.strictEqual(A.SERVICE_CFG.resolveApplicableMarketFeePolicy({ market: a.market, point: a.point, startDate: date }).id, policy.id, 'own market policy + covered must match from effective date');
assert.strictEqual(billing.buildPriceTerms(a.market.id, a.point, 10, date, {}, 'TEST').land.amount, 2000, 'billing uses the same resolver');

const trader = { id: 'POLICY-T1', name: 'Tiểu thương test policy', phone: '0977000001', idNo: 'POLICY-ID-1', market: a.market.id, stalls: [], source: 'STAFF' };
A.db.traders.push(trader); A.reindex();
// The actual contract-creation UI (màn Hợp đồng → form tạo từ hồ sơ đăng ký thuê) must use the same resolver,
// not a value copied from the policy screen. The point's row preview ("Xem cấu hình") renders it live.
A.ACCOUNTS.get('AC-NV01').marketScopes.push(a.market.id);
A.ui.currentDemoAccountId = 'AC-NV01'; A.ui.sessionAccountId = 'AC-NV01'; A.ui.market = a.market.id; A.syncAccountContext();
assert(A.features.traders.service.setRentalDraft(trader.id, [{ pointId: a.point.id, charges: { land: true }, feeRefs: {} }]), 'point registered in the profile');
h.go('hop-dong'); h.act('ct-new', { trader: trader.id });
A.CH['ctw-row']({ dataset: { id: a.point.id, k: 'start' }, value: date });
A.CH['ctw-row']({ dataset: { id: a.point.id, k: 'end' }, value: '2027-10-01' });
h.act('ctw-config', { id: a.point.id });
assert(h.view().includes('2.000') && h.view().includes('TEST-2000') && !h.view().includes('QD480-REF'), 'form preview renders the market own unit price and policy');
// Creation goes through the canonical use case; the snapshot is the market's own policy, never the shared one.
h.act('ctw-submit');
const created = A.db.contracts.find(c => c.traderId === trader.id && c.businessPointId === a.point.id);
assert(created, 'contract is allowed when resolver finds the policy');
assert.strictEqual(created.priceTerms.land.policyId, policy.id);
assert.strictEqual(created.priceTerms.land.amount, 2000);

// Simulate another tab saving a policy after this tab initially found none.
const b = marketWithCoveredPoint('Chợ test policy resolver B');
assert.strictEqual(A.SERVICE_CFG.resolveApplicableMarketFeePolicy({ market: b.market, point: b.point, startDate: date }), null, 'initially no policy');
const remote = JSON.parse(h.localStorage.getItem(A.SERVICE_CFG.KEY));
remote.stallPrices.push({ id: 'POLICY-STALE', scope: 'MARKET', marketId: b.market.id, areaTypeId: 'covered', amount: 2000, unit: 'đ/m²/ngày', effectiveFrom: date, effectiveTo: null, status: 'active', legalBasis: {} });
h.localStorage.setItem(A.SERVICE_CFG.KEY, JSON.stringify(remote));
const refreshed = A.refreshSharedState();
assert(refreshed.serviceConfig.changed, 'service configuration is rehydrated with shared state');
assert.strictEqual(A.SERVICE_CFG.resolveApplicableMarketFeePolicy({ market: b.market, point: b.point, startDate: date }).id, 'POLICY-STALE', 'reopened/re-resolved form sees newly saved policy');

console.log('contract-policy-resolver: PASS');

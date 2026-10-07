/* Regression: land-fee policy uses market rank + point area type + contract start.
 * Fixtures are self-contained; do not depend on catalog or fee seed values. */
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
  return { market: MC.get(m.id), point: A.db.stalls.find(p => p.market === m.id) };
}

const a = marketWithCoveredPoint('Chợ test policy resolver A');
const policy = A.SERVICE_CFG.add('stallPrices', {
  id: 'ignored', scope: 'SHARED', marketId: null, marketIds: [a.market.id], marketGrades: [1], areaTypeId: 'covered',
  amount: 2000, unit: 'đ/m²/ngày', effectiveFrom: date, effectiveTo: null, status: 'active', legalBasis: { docNo: 'TEST-2000', summary: 'Regression policy' }
}, 'test');

assert.strictEqual(A.SERVICE_CFG.resolveApplicableMarketFeePolicy({ market: a.market, point: a.point, startDate: '2026-09-30' }), null, 'policy must not match before effective date');
assert.strictEqual(A.SERVICE_CFG.resolveApplicableMarketFeePolicy({ market: a.market, point: a.point, startDate: date }).id, policy.id, 'rank-1 + covered must match from effective date');
assert.strictEqual(billing.buildPriceTerms(a.market.id, a.point, 10, date, {}, 'TEST').land.amount, 2000, 'billing uses the same resolver');

const trader = { id: 'POLICY-T1', name: 'Tiểu thương test policy', phone: '0977000001', idNo: 'POLICY-ID-1', market: a.market.id, stalls: [], source: 'STAFF' };
A.db.traders.push(trader); A.reindex();
// The actual contract popup must use the same resolver, not a value copied
// from the policy screen.  Selecting the point re-renders the live preview.
A.ACCOUNTS.get('AC-NV01').marketScopes.push(a.market.id);
A.ui.currentDemoAccountId = 'AC-NV01'; A.ui.sessionAccountId = 'AC-NV01'; A.ui.market = a.market.id; A.syncAccountContext();
A.features.contracts.form.open(trader.id);
A.features.contracts.form.resume(); h.input('#wf-ct-start', date); h.input('#wf-ct-end', '2027-10-01');
A.features.contracts.form.pickPoint(a.point.id);
assert(h.modal().includes('2.000') && h.modal().includes('TEST-2000'), 'popup preview renders the matching unit price and policy');
A.closeModal();
const terms = billing.buildPriceTerms(a.market.id, a.point, a.point.area, date, {}, 'CONTRACT');
const created = contracts.createWithPointAllocation({
  contract: { id: 'POLICY-C1', traderId: trader.id, stallId: a.point.id, businessPointId: a.point.id, market: a.market.id, start: date, end: '2027-10-01', status: 'ACTIVE', priceTerms: terms, feePolicy: { id: policy.id } },
  traderId: trader.id, pointId: a.point.id, pointHistoryEntry: 'test'
});
assert(created, 'contract is allowed when resolver finds the policy');

// Simulate another tab saving a policy after this tab initially found none.
const b = marketWithCoveredPoint('Chợ test policy resolver B');
assert.strictEqual(A.SERVICE_CFG.resolveApplicableMarketFeePolicy({ market: b.market, point: b.point, startDate: date }), null, 'initially no policy');
const remote = JSON.parse(h.localStorage.getItem(A.SERVICE_CFG.KEY));
remote.stallPrices.push({ id: 'POLICY-STALE', scope: 'SHARED', marketId: null, marketIds: [b.market.id], marketGrades: [1], areaTypeId: 'covered', amount: 2000, unit: 'đ/m²/ngày', effectiveFrom: date, effectiveTo: null, status: 'active', legalBasis: {} });
h.localStorage.setItem(A.SERVICE_CFG.KEY, JSON.stringify(remote));
const refreshed = A.refreshSharedState();
assert(refreshed.serviceConfig.changed, 'service configuration is rehydrated with shared state');
assert.strictEqual(A.SERVICE_CFG.resolveApplicableMarketFeePolicy({ market: b.market, point: b.point, startDate: date }).id, 'POLICY-STALE', 'reopened/re-resolved form sees newly saved policy');

console.log('contract-policy-resolver: PASS');

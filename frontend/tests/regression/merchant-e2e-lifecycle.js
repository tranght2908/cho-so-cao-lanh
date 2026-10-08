/* End-to-end merchant lifecycle. Fixtures are isolated and all dates are
 * relative to A.U.today(); no seed market/profile/point is asserted. */
const assert = require('assert');
const path = require('path');
const { createApp } = require('./harness');

const ROOT = path.resolve(__dirname, '../..');
const TW_ROOT = path.join(ROOT, 'tieu-thuong');
const h = createApp(ROOT), A = h.A;
const MS = A.features.markets.service;
const ML = A.features.marketLayout.store;
const TS = A.features.traders.service;
const CS = A.features.contracts.service;
const AS = A.features.accounts.service;
const BP = A.features.businessPoints.service;
const today = A.U.today();
const plusDays = n => new Date(Date.parse(today + 'T00:00:00Z') + n * 86400000).toISOString().slice(0, 10);
const oneYear = () => { const d = new Date(today + 'T00:00:00Z'); d.setUTCFullYear(d.getUTCFullYear() + 1); return d.toISOString().slice(0, 10); };
const snapshots = () => { const out = {}; h.localStorage._m.forEach((v, k) => { out[k] = v; }); return out; };
const result = [];
const step = (name, fn) => { try { fn(); result.push([name, 'PASS']); } catch (e) { result.push([name, 'FAIL: ' + e.message]); throw e; } };

function createMarket(id, name) {
  return A.MARKET_CATALOG.add({ code: id, name, address: 'Địa chỉ test', rank: 'HANG_3', priceConfigId: 'QD480_NHOM_CON_LAI', totalArea: 100, businessArea: 80, allowedAreaTypeIds: ['covered'] }, 'E2E');
}
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
function completeMarket(market, suffix) {
  const building = ML.addBuilding(market.id, { name: 'Nhà ' + suffix, businessArea: 80 }).building;
  const row = ML.addRow(market.id, { blockId: building.id, floorId: null }, 'R-' + suffix, 'Dãy ' + suffix, 'Thực phẩm', 40).row;
  const made = ML.pointGroups.commit(market.id, row.id, [
    { id: 'G-' + suffix + '-1', quantity: 1, areaPerPoint: 10, areaTypeId: 'covered' },
    { id: 'G-' + suffix + '-2', quantity: 1, areaPerPoint: 10, areaTypeId: 'covered' }
  ]);
  assert(made.ok, (made.errors || []).join('; '));
  // "Hoàn tất mặt bằng" là lệnh tường minh (nút mb-complete-layout), không suy từ việc thêm điểm.
  assert(A.features.lifecycle.service.completeMarketLayout(market.id, 'E2E'), 'Hoàn tất mặt bằng');
  assert.equal(MS.get(market.id).layoutStatus, 'SETUP_COMPLETED');
  assert.equal(MS.get(market.id).status, 'NOT_ACTIVE', 'layout completion alone does not activate');
  addFeePolicy(market.id, 'covered');
  return { building, row, points: made.stalls };
}
function profile(id, market, phone, idNo, name) {
  return TS.create({ id, name: name || id, phone, idNo, idType: 'CCCD', market, stalls: [], source: 'E2E', since: today, app: false });
}
function contract(id, trader, point, start, end) {
  return CS.createWithPointAllocation({ contract: { id, traderId: trader.id, market: trader.market, stallId: point.id, businessPointId: point.id, kind: 'Hợp đồng E2E', signedDate: today, start, end, monthly: 100000, status: 'ACTIVE', history: [] }, traderId: trader.id, pointId: point.id, pointHistoryEntry: 'E2E' });
}

let m1, p1, r1, t1, c1, a1, m2, p2, r2, t2, c2, other;
const phone = '0988123001', idNo = '079123456789';

step('1-5 Market M1 pending → completed; P1 vacant', () => {
  m1 = createMarket('E2E-M1', 'Chợ E2E M1');
  assert.equal(MS.get(m1.id).layoutStatus, 'PENDING_SETUP');
  assert.equal(MS.get(m1.id).status, 'NOT_ACTIVE');
  const layout = completeMarket(m1, 'M1'); r1 = layout.row; p1 = layout.points[0];
  assert.equal(MS.get(m1.id).layoutStatus, 'SETUP_COMPLETED');
  assert.equal(MS.get(m1.id).status, 'ACTIVE');
  assert.equal(BP.get(p1.id).usageStatus, 'VACANT');
});
step('6-9 Profile T1 and effective C1 atomically activate T1/P1', () => {
  t1 = profile('E2E-T1', m1.id, phone, idNo, 'Người E2E');
  assert.equal(t1.status, 'WAITING_ALLOCATION');
  c1 = contract('E2E-C1', t1, p1, today, oneYear());
  assert(c1);
  assert.equal(c1.status, 'ACTIVE');
  assert.equal(BP.get(p1.id).usageStatus, 'RENTED');
  assert.equal(TS.getProfile(t1.id).status, 'ACTIVE');
});
step('10 Cross-screen source relations resolve T1 ↔ C1 ↔ P1', () => {
  assert.equal(BP.contractOn(p1.id, today).id, c1.id);
  assert.equal(BP.occupantId(p1, today), t1.id);
  assert.equal(CS.listByTrader(t1.id)[0].businessPointId, p1.id);
  assert.equal(BP.row(p1).id, r1.id);
  assert.equal(BP.industry(p1), 'Thực phẩm');
});
step('11-14 Create A1 and activate through OTP without changing business state', () => {
  a1 = AS.createTraderAccount({ id: 'E2E-A1', code: 'E2EA1', fullName: t1.name, phone, roleIds: ['trader'], marketScopes: [m1.id], traderId: t1.id });
  assert(a1);
  assert.deepEqual(a1.roleIds, ['trader']);
  assert.equal(a1.status, 'PENDING_ACTIVATION');
  assert(A.ACCOUNTS.traderIdsOf(a1).includes(t1.id) && a1.marketScopes.includes(m1.id));
});

step('Negative: no contract before layout completion / cross-market / overlap / duplicate account', () => {
  const pending = createMarket('E2E-PENDING', 'Chợ E2E Pending');
  const pendingTrader = profile('E2E-TP', pending.id, '0988123099', '079123456799', 'Pending');
  const fakePoint = { id: 'E2E-PENDING-P', code: 'P', market: pending.id, rowId: 'missing', area: 1, operationalStatus: 'active', usageStatus: 'VACANT', history: [] };
  A.db.stalls.push(fakePoint); A.reindex();
  assert.equal(contract('E2E-BLOCKED', pendingTrader, fakePoint, today, oneYear()), null);
  assert.equal(contract('E2E-CROSS', t1, fakePoint, today, oneYear()), null);
  other = profile('E2E-OTHER', m1.id, '0988123002', '079123456788', 'Người khác');
  assert.equal(contract('E2E-OVERLAP', other, p1, today, plusDays(30)), null);
  assert.equal(AS.createTraderAccount({ id: 'E2E-A1-DUP', code: 'DUP', fullName: t1.name, phone, roleIds: ['trader'], marketScopes: [m1.id], traderId: t1.id }), null);
});

step('15 Merchant web shows only C1/P1 with Market/Row/commodity/area/type', () => {
  const ht = createApp(TW_ROOT, { storage: snapshots() }), T = ht.A;
  ht.act('tw-back'); T.IN['tw-phone']({ value: phone }); ht.act('tw-lookup'); T.IN['tw-otp']({ value: '123456' }); ht.act('tw-verify');
  assert.equal(T.ACCOUNTS.get(a1.id).status, 'ACTIVE');
  assert.equal(T.idx.trader.get(t1.id).status, 'ACTIVE');
  ht.act('merchant-nav', { id: 'contracts' });
  const html = ht.el('#tw-root').innerHTML;
  [c1.id, p1.code, 'Chợ E2E M1', r1.name, 'Thực phẩm', '10 m²', 'Có mái che'].forEach(x => assert(html.includes(x), x));
  assert(!html.includes('E2E-OVERLAP'));
  // Separate merchant-web tab persisted OTP activation; consume it through
  // the same public cross-tab refresh used by a browser storage event.
  h.localStorage.setItem('choso-caolanh-accounts', ht.localStorage.getItem('choso-caolanh-accounts'));
  A.refreshSharedState();
  a1 = A.ACCOUNTS.get(a1.id);
  assert.equal(a1.status, 'ACTIVE');
});

step('16-20 M2/T2/C2 and waiting T3 share A1 but retain independent profile statuses', () => {
  m2 = createMarket('E2E-M2', 'Chợ E2E M2');
  const layout2 = completeMarket(m2, 'M2'); r2 = layout2.row; p2 = layout2.points[0];
  const accountCount = A.ACCOUNTS.list().length;
  t2 = profile('E2E-T2', m2.id, phone, idNo, 'Người E2E');
  assert(t2 && A.ACCOUNTS.list().length === accountCount);
  assert(A.ACCOUNTS.traderIdsOf(a1).includes(t1.id) && A.ACCOUNTS.traderIdsOf(a1).includes(t2.id));
  assert(a1.marketScopes.includes(m1.id) && a1.marketScopes.includes(m2.id));
  c2 = contract('E2E-C2', t2, p2, today, oneYear());
  assert(c2 && t2.status === 'ACTIVE' && t1.status === 'ACTIVE' && a1.status === 'ACTIVE');
  const m3 = createMarket('E2E-M3', 'Chợ E2E M3');
  const t3 = profile('E2E-T3', m3.id, phone, idNo, 'Người E2E');
  assert.equal(t3.status, 'WAITING_ALLOCATION');
  assert.equal(a1.status, 'ACTIVE');
  assert.equal(t1.status, 'ACTIVE'); assert.equal(t2.status, 'ACTIVE');
});

step('19 Merchant web profile switch sees only its own C1/P1 or C2/P2, never another merchant', () => {
  const ht = createApp(TW_ROOT, { storage: snapshots() }), T = ht.A;
  ht.act('tw-back'); T.IN['tw-phone']({ value: phone }); ht.act('tw-lookup'); T.IN['tw-otp']({ value: '123456' }); ht.act('tw-verify');
  ht.act('merchant-nav', { id: 'contracts' });
  let html = ht.el('#tw-root').innerHTML;
  assert(html.includes(c1.id) && !html.includes(c2.id));
  T.CH['mini-profile']({ value: t2.id }); ht.act('merchant-nav', { id: 'contracts' });
  html = ht.el('#tw-root').innerHTML;
  assert(html.includes(c2.id) && html.includes(p2.code) && html.includes(r2.name) && !html.includes(c1.id));
  assert(!html.includes(other.name));
});

step('Negative: future contract reserves interval but leaves point/profile inactive until start', () => {
  const futurePoint = ML.pointGroups.commit(m2.id, r2.id, [{ id: 'G-M2-FUTURE', quantity: 1, areaPerPoint: 5, areaTypeId: 'covered' }]).stalls[0];
  const future = profile('E2E-TF', m2.id, '0988123003', '079123456777', 'Tương lai');
  const futureContract = contract('E2E-CF', future, futurePoint, plusDays(30), plusDays(60));
  assert(futureContract);
  assert.equal(BP.get(futurePoint.id).usageStatus, 'VACANT');
  assert.equal(future.status, 'WAITING_ALLOCATION');
  assert.equal(CS.presentationStatus(futureContract), 'upcoming');
});

step('21 Reload preserves relations/statuses', () => {
  const reload = createApp(ROOT, { localStorage: h.localStorage }).A;
  const account = reload.ACCOUNTS.get(a1.id);
  assert(account && account.status === 'ACTIVE');
  assert.deepEqual(Array.from(reload.ACCOUNTS.traderIdsOf(account)).sort(), [t1.id, t2.id, 'E2E-T3'].sort());
  assert.equal(reload.features.contracts.service.get(c1.id).businessPointId, p1.id);
  assert.equal(reload.features.contracts.service.get(c2.id).businessPointId, p2.id);
  assert.equal(reload.features.traders.service.getProfile(t1.id).status, 'ACTIVE');
  assert.equal(reload.features.traders.service.getProfile(t2.id).status, 'ACTIVE');
});

step('22 Storage refresh normalizes legacy lifecycle from another tab', () => {
  const legacy = A.MARKET_CATALOG.rows().map(x => Object.assign({}, x));
  const m3 = legacy.find(x => x.id === 'E2E-M3');
  m3.layoutStatus = 'PENDING_SETUP'; m3.status = 'ACTIVE';
  h.localStorage.setItem(A.MARKET_CATALOG.KEY, JSON.stringify(legacy));
  const out = A.refreshSharedState();
  assert(out.changed);
  assert.equal(A.MARKET_CATALOG.get('E2E-M3').layoutStatus, 'PENDING_SETUP');
  assert.equal(A.MARKET_CATALOG.get('E2E-M3').status, 'NOT_ACTIVE');
});

console.table(result.map(([scenario, actual]) => ({ scenario, expected: 'PASS', actual, status: actual === 'PASS' ? 'PASS' : 'FAIL' })));
console.log('END-TO-END LIFECYCLE: PASS');

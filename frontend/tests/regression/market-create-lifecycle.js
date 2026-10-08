/* UC regression: market lifecycle (decision 10/2026, revised). Layout completion never activates a market.
 * ACTIVE requires layout SETUP_COMPLETED + the market's OWN fee configuration (records with marketId = the
 * market — never SHARED/QĐ 480 references) and a declaration of which charges apply (SERVICE_CFG
 * chargeApplicability): land price for every standard area type in use (always), electricity / water /
 * service only when declared applicable. Legacy "Theo phiên" points never block activation.
 * An ACTIVE market that later loses coverage stays ACTIVE with a fee warning. Danh mục chợ and Tổng quan
 * liên chợ read the same lifecycle helper. */
const assert = require('assert');
const path = require('path');
const { createApp } = require('./harness');

const root = path.resolve(__dirname, '../..');
const h = createApp(root), A = h.A;
const MC = A.features.markets.service;
const L = A.features.lifecycle.service;
const S = A.features.marketLayout.store;
const C = A.SERVICE_CFG;
let passed = 0;
const ok = (label, fn) => { try { fn(); passed++; } catch (e) { e.message = label + ': ' + e.message; throw e; } };
const json = x => JSON.stringify(x);
const login = (id, market) => { A.ui.sessionAccountId = id; A.ui.currentDemoAccountId = id; A.ui.market = market || 'ALL'; A.syncAccountContext(); };
const graphCount = id => ['buildings', 'floors', 'rows', 'stalls'].map(k => A.db[k].filter(x => x.market === id).length);
const base = { status: 'active', effectiveFrom: '2026-01-01', effectiveTo: null, legalBasis: {}, attachments: [] };
const land = (marketId, areaTypeId) => C.add('stallPrices', Object.assign({ name: 'Mặt bằng ' + areaTypeId, marketId, scope: 'MARKET', areaTypeId, stallType: '', amount: 1000, unit: 'đ/m²/ngày' }, base), 'test');
const utility = (marketId, kind) => C.add('utilities', Object.assign({ name: kind, marketId, kind }, kind === 'ELECTRICITY' ? { elecPrice: 3000, elecUnit: 'đ/kWh' } : { waterPrice: 11000, waterUnit: 'đ/m³' }, base), 'test');
const service = marketId => C.add('extraServices', Object.assign({ name: 'Vệ sinh', marketId, category: 'SANITATION', calcMethod: 'fixed', amount: 20000, unit: 'đ/điểm/tháng' }, base), 'test');
const declare = (marketId, charges) => C.setChargeApplicability(marketId, charges, 'test');
const stage = id => L.marketLifecycle(id).stage;
const dashTags = id => { login('AC-QT01'); h.go('tong-quan'); const v = h.view(), i = v.indexOf(`data-id="${id}" title=`); return v.slice(i, v.indexOf('</dl>', i)); };
const catalogStatus = id => { login('AC-QT01'); h.go('danh-muc-cho'); const v = h.view(), i = v.indexOf(`<span>${id}</span>`); return v.slice(i, v.indexOf('</tr>', i)); };
const setupLayout = (marketId, types) => {
  const draft = S.initialSetup.createDraft(marketId);
  draft.buildings[0].name = 'Nhà lồng A';
  draft.floors.push({ id: 'floor-1', buildingDraftId: draft.buildings[0].id, name: 'Tầng 1', businessArea: 300 });
  draft.rows.push({ id: 'row-1', buildingDraftId: draft.buildings[0].id, floorDraftId: 'floor-1', name: 'Dãy rau', industry: A.D.INDUSTRIES[0], allocatedArea: 300 });
  types.forEach((t, i) => draft.pointGroups.push({ id: 'group-' + i, rowDraftId: 'row-1', areaTypeId: t, quantity: 5, areaPerPoint: 10 }));
  const result = S.initialSetup.commit(draft);
  assert(result.ok, (result.errors || []).join('\n'));
};

let market;
ok('CASE 1 create → PENDING_LAYOUT + NOT_ACTIVE, nothing generated', () => {
  market = MC.add({ name: 'Chợ kiểm thử vòng đời', address: 'Khóm kiểm thử', rank: 'HANG_3', totalArea: 1000, businessArea: 600 }, 'test');
  assert.strictEqual(json(graphCount(market.id)), '[0,0,0,0]');
  assert.strictEqual(market.status, 'NOT_ACTIVE');
  assert.strictEqual(market.layoutStatus, 'PENDING_SETUP');
  assert.strictEqual(stage(market.id), 'PENDING_LAYOUT');
});
ok('CASE 2 complete layout → Đã thiết lập, PENDING_FEE, NOT_ACTIVE', () => {
  setupLayout(market.id, ['covered', 'uncovered']);
  assert.strictEqual(MC.get(market.id).layoutStatus, 'SETUP_COMPLETED');
  assert.strictEqual(MC.get(market.id).status, 'NOT_ACTIVE');
  assert.strictEqual(stage(market.id), 'PENDING_FEE');
  assert.strictEqual(L.canActivateMarket(market.id), false);
  assert(/Chờ cấu hình mức thu/.test(catalogStatus(market.id)) && /Chờ cấu hình mức thu/.test(dashTags(market.id)));
  login('AC-QT01', market.id); h.go('mat-bang');
  assert(/Tình trạng mặt bằng: <b>Đã thiết lập/.test(h.view()) && /Bước hiện tại: <b>Chờ cấu hình mức thu/.test(h.view()));
  login('AC-QT01');
});
ok('CASE 3 QĐ 480 exists for Chợ Hòa An but HA has no own config → PENDING_FEE, not ACTIVE', () => {
  setupLayout('HA', ['covered', 'uncovered']);
  const pt = A.db.stalls.find(st => st.market === 'HA');
  const shared = C.list('stallPrices').filter(p => p.scope === 'SHARED' && (p.marketIds || []).includes('HA') && C.policyActiveAt(p, A.U.today()));
  assert(shared.some(p => p.areaTypeId === 'covered'), 'fixture: QĐ 480 shared policy exists for HA');
  assert.strictEqual(C.resolveApplicableMarketFeePolicy({ point: pt, date: A.U.today() }), null, 'shared policy is never the applied price');
  assert.strictEqual(A.features.finance.billing.buildPriceTerms('HA', pt, pt.area, A.U.today(), {}, 'TEST').land, null, 'billing has no silent QĐ 480 fallback');
  assert.strictEqual(MC.get('HA').status, 'NOT_ACTIVE');
  assert.strictEqual(stage('HA'), 'PENDING_FEE');
  assert(L.marketFeeCoverage('HA').missingCharges.includes('CONFIG'));
});
ok('own records without a declaration of applicable charges → still PENDING_FEE', () => {
  land(market.id, 'covered'); land(market.id, 'uncovered');
  assert(L.marketFeeCoverage(market.id).missingCharges.includes('DECLARATION'));
  assert.strictEqual(MC.get(market.id).status, 'NOT_ACTIVE');
  assert(/Chưa khai báo khoản thu áp dụng/.test(L.marketLifecycle(market.id).feeGap));
  // Undo the second land record so CASE 4 can exercise a missing area type.
  C.setStatus('stallPrices', C.list('stallPrices').find(p => p.marketId === market.id && p.areaTypeId === 'uncovered').id, 'inactive', 'test');
});
ok('CASE 4 own config missing one land area type in use → PENDING_FEE', () => {
  declare(market.id, { electricity: true, water: true, service: true });
  utility(market.id, 'ELECTRICITY'); utility(market.id, 'WATER'); service(market.id);
  assert.strictEqual(json(L.marketFeeCoverage(market.id).missingAreaTypes), '["uncovered"]');
  assert.strictEqual(MC.get(market.id).status, 'NOT_ACTIVE');
  assert.strictEqual(stage(market.id), 'PENDING_FEE');
});
ok('CASE 5 land complete but missing a required charge (water) → PENDING_FEE; CASE 6 complete → ACTIVE', () => {
  const m2 = MC.add({ name: 'Chợ kiểm thử điện nước', address: 'Khóm 2', rank: 'HANG_3', totalArea: 1000, businessArea: 600 }, 'test');
  setupLayout(m2.id, ['covered']);
  declare(m2.id, { electricity: true, water: true, service: true });
  land(m2.id, 'covered'); utility(m2.id, 'ELECTRICITY'); service(m2.id);
  assert.strictEqual(json(L.marketFeeCoverage(m2.id).missingCharges), '["WATER"]');
  assert.strictEqual(MC.get(m2.id).status, 'NOT_ACTIVE');
  utility(m2.id, 'WATER'); // saving the market's fee config completes it → ACTIVE (no separate activate button)
  assert.strictEqual(MC.get(m2.id).status, 'ACTIVE');
  assert.strictEqual(stage(m2.id), 'ACTIVE');
});
ok('charges declared "không áp dụng" are not required (land only market activates)', () => {
  const m3 = MC.add({ name: 'Chợ chỉ thu mặt bằng', address: 'Khóm 3', rank: 'HANG_3', totalArea: 1000, businessArea: 600 }, 'test');
  setupLayout(m3.id, ['self_produced']);
  declare(m3.id, { electricity: false, water: false, service: false });
  assert.strictEqual(MC.get(m3.id).status, 'NOT_ACTIVE', 'still needs its own land price');
  land(m3.id, 'self_produced');
  assert.strictEqual(json(L.marketFeeCoverage(m3.id).missingCharges), '[]');
  assert.strictEqual(MC.get(m3.id).status, 'ACTIVE');
});
ok('CASE 6 market with full own config → ACTIVE; self-produced not required when unused', () => {
  land(market.id, 'uncovered');
  assert.strictEqual(L.canActivateMarket(market.id), true);
  assert.strictEqual(MC.get(market.id).status, 'ACTIVE');
  assert(!L.marketFeeCoverage(market.id).usedAreaTypes.includes('self_produced'));
  assert(/Đang hoạt động/.test(catalogStatus(market.id)) && !/Chờ cấu hình mức thu/.test(catalogStatus(market.id)));
  assert(/Đang hoạt động/.test(dashTags(market.id)) && !/Cần cập nhật/.test(dashTags(market.id)));
});
ok('CASE 7 ACTIVE market later loses fee coverage → stays ACTIVE with warning; price-dependent action blocked', () => {
  const pol = C.list('stallPrices').find(p => p.marketId === market.id && p.areaTypeId === 'uncovered' && p.status === 'active');
  C.setStatus('stallPrices', pol.id, 'inactive', 'test');
  assert.strictEqual(MC.get(market.id).status, 'ACTIVE', 'never auto-demoted');
  const lc = L.marketLifecycle(market.id);
  assert.strictEqual(lc.stage, 'ACTIVE_FEE_WARNING');
  assert(lc.feeConfigWarning && /Đang hoạt động/.test(lc.hint) && /Cần cập nhật mức thu/.test(lc.warning));
  assert(/Cần cập nhật mức thu/.test(catalogStatus(market.id)) && /Cần cập nhật mức thu/.test(dashTags(market.id)));
  const pt = A.db.stalls.find(st => st.market === market.id && st.areaTypeId === 'uncovered');
  assert.strictEqual(C.resolveApplicableMarketFeePolicy({ point: pt, date: A.U.today() }), null, 'no price → contract/billing blocked at the action');
  C.setStatus('stallPrices', pol.id, 'active', 'test');
  assert.strictEqual(stage(market.id), 'ACTIVE');
});
ok('CASE 8 legacy "Theo phiên" points never block activation', () => {
  const ttd = L.marketLifecycle('TTD');
  assert(ttd.fee.legacyPoints > 0 && !ttd.fee.usedAreaTypes.includes('session'));
  assert.strictEqual(ttd.stage, 'ACTIVE');
  assert(A.db.stalls.some(st => st.market === 'TTD' && st.areaTypeId === 'session'), 'legacy data untouched');
});
ok('CASE 9 Danh mục chợ and Dashboard show the same lifecycle for every market', () => {
  MC.rows().forEach(m => {
    const lc = L.marketLifecycle(m.id), cat = catalogStatus(m.id), dash = dashTags(m.id);
    if (lc.stage === 'PENDING_FEE') assert(/Chờ cấu hình mức thu/.test(cat) && /Chờ cấu hình mức thu/.test(dash), m.id);
    if (lc.stage === 'ACTIVE') assert(/Đang hoạt động/.test(cat) && /Đang hoạt động/.test(dash) && !/Cần cập nhật/.test(cat + dash), m.id);
    if (lc.stage === 'PENDING_LAYOUT') assert(/Chưa hoạt động/.test(cat) && /Chưa thiết lập mặt bằng/.test(dash), m.id);
  });
});
ok('CASE 10 reload from the same storage: lifecycle stays correct', () => {
  const h2 = createApp(root, { localStorage: h.localStorage });
  const L2 = h2.A.features.lifecycle.service;
  [market.id, 'HA', 'CL', 'TTD'].forEach(id => assert.strictEqual(L2.marketLifecycle(id).stage, L.marketLifecycle(id).stage, id));
  assert.strictEqual(h2.A.features.markets.service.get(market.id).status, 'ACTIVE');
});
ok('PENDING_FEE market: contract creation refused with the lifecycle reason; period monitor explains it', () => {
  login('AC-NV01', 'HA');
  assert(A.canDo('hop-dong.tao', 'HA'), 'fixture: manager may create contracts in HA');
  A.closeModal();
  h.go('hop-dong'); h.act('ct-new');
  assert.strictEqual(h.trace.toasts.at(-1), 'Chợ chưa hoàn tất cấu hình mức thu.');
  assert.strictEqual(h.modal(), '', 'no contract form opened');
  h.go('theo-doi-ky-thu');
  assert.strictEqual(A.current, 'theo-doi-ky-thu');
  assert(/Chợ chưa hoàn tất cấu hình mức thu\./.test(h.view()) && h.view().includes(A.U.mShort('HA')), 'period note lists HA');
  login('AC-QT01');
});
ok('no manual ACTIVE control on the market form', () => {
  login('AC-QT01'); h.go('danh-muc-cho');
  h.act('dmc-edit', { id: market.id });
  assert(!/id="dmc-status"/.test(h.modal()));
  A.closeModal();
});
console.log(`market-create-lifecycle: PASS (${passed} checks)`);

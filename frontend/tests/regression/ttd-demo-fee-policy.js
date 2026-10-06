/* Dữ liệu biểu phí DEMO cho Chợ quê Cù lao Tân Thuận Đông (DEMO_TTD_FEE_POLICY v1, features/fee-config/store.js).
 * Không bypass validation: chỉ bổ sung cấu hình đúng schema SERVICE_CFG, khoản phải thu do calculatePeriod tự tính. */
const assert = require('assert');
const path = require('path');
const { createApp } = require('./harness');

const ROOT = path.resolve(__dirname, '../..'), M = '2026-11';
let passed = 0;
const ok = (label, fn) => { try { fn(); passed++; } catch (e) { e.message = label + ': ' + e.message; throw e; } };
const demoIds = A => ['stallPrices', 'utilities', 'extraServices'].flatMap(c => A.SERVICE_CFG.list(c).filter(x => x.source === 'prototype-demo').map(x => x.id)).sort();
const login = (A, id, market) => { A.ui.currentDemoAccountId = id; A.ui.sessionAccountId = id; if (market) A.ui.market = market; A.syncAccountContext(); };
const blockingFee = w => /MISSING_(LAND|UTILITY|SERVICE)_POLICY/.test(w.code);

ok('seed: demo land price for TTD "covered" points, cloned from an existing price (no new number)', () => {
  const { A } = createApp(ROOT);
  const rec = A.SERVICE_CFG.get('stallPrices', 'sp-ttd-demo-covered'), src = A.SERVICE_CFG.get('stallPrices', rec.clonedFromId);
  assert(rec && src, 'demo record + source');
  assert.strictEqual(rec.marketId, 'TTD'); assert.strictEqual(rec.areaTypeId, 'covered'); assert.strictEqual(rec.status, 'active');
  assert.strictEqual(rec.amount, src.amount); assert.strictEqual(rec.unit, src.unit);
  assert(rec.effectiveFrom <= '2026-12-01' && rec.effectiveTo === null, 'effective for the 11/2026 period (land month 12/2026)');
  assert.strictEqual(rec.source, 'prototype-demo');
  // Điểm TTD dùng areaTypeId 'covered' — dữ liệu điểm không bị sửa.
  A.db.contracts.filter(c => c.market === 'TTD' && c.status === 'hieuluc' && /HĐ-TTD-2026-004[0-3]|0039/.test(c.id)).forEach(c => assert.strictEqual(A.idx.stall.get(c.businessPointId || c.stallId).areaTypeId, 'covered'));
});

ok('E2E TTD (1–6): meter 5/5 → calculate → no fee warnings → READY; monitor counts move; CL unaffected', () => {
  const h = createApp(ROOT), A = h.A, S = A.features.finance.marketPeriod, B = A.features.finance.billing;
  const clDrafts = JSON.stringify(B.drafts('CL', S.get('CL', M).id).map(d => [d.id, d.amount])), clState = S.stateOf('CL', M).id;
  login(A, 'AC-NV01', 'CL'); A.ui.periodMonitorPeriod = M; h.go('theo-doi-ky-thu');
  const kpi = v => Array.from(v.matchAll(/k-label">([^<]+)<\/div><div class="k-value[^"]*">(\d+)/g)).reduce((o, m) => (o[m[1]] = Number(m[2]), o), {});
  const before = kpi(h.view());
  login(A, 'AC-NV07', 'TTD');
  const mp = S.get('TTD', M), st = S.meterStats(mp);
  assert.strictEqual(st.required, 5); assert.strictEqual(st.recorded, 5);
  assert(S.completeMeter('TTD', M, A.currentAccount()).ok, 'meter completed → auto-calculated');
  const groups = B.traderGroups('TTD', mp.id), warns = B.warnings('TTD', mp.id);
  assert(!warns.some(blockingFee), 'no missing fee policy: ' + warns.map(w => w.code).join(','));
  assert(!warns.some(w => String(w.severity || 'BLOCKING') === 'BLOCKING'), 'no blocking warning');
  assert.strictEqual(groups.length, 5); assert(groups.every(g => g.validationStatus === 'VALID'), '5/5 valid');
  assert(groups.reduce((a, g) => a + g.amount, 0) > 0, 'expected total > 0');
  ['LAND', 'ELECTRICITY', 'WATER', 'MARKET_SERVICE'].forEach(t => assert(groups.every(g => g.rows.some(r => r.items[0].chargeType === t)), 'every trader has ' + t));
  assert.strictEqual(S.stateOf('TTD', M).id, 'READY_TO_ISSUE');
  login(A, 'AC-NV01', 'CL'); h.go('theo-doi-ky-thu');
  const after = kpi(h.view());
  assert.strictEqual(after['Sẵn sàng phát hành'], before['Sẵn sàng phát hành'] + 1);
  assert.strictEqual(after['Chưa đủ điều kiện'], before['Chưa đủ điều kiện'] - 1);
  assert.strictEqual(S.stateOf('CL', M).id, clState, 'CL state unchanged');
  assert.strictEqual(JSON.stringify(B.drafts('CL', S.get('CL', M).id).map(d => [d.id, d.amount])), clDrafts, 'CL drafts unchanged');
});

ok('stored config missing all 4 TTD fee types (user state) → reload migrates + recalculates → READY', () => {
  const base = createApp(ROOT), BA = base.A, S0 = BA.features.finance.marketPeriod;
  ['utilities', 'extraServices', 'stallPrices'].forEach(c => BA.SERVICE_CFG.list(c).forEach(x => { if (x.marketId === 'TTD') x.status = 'inactive'; }));
  // KHOA_GIA_THEO_HOP_DONG: HĐ TTD dữ liệu cũ chưa từng khóa bảng giá (chụp lại khi tính → không có giá nào).
  BA.db.contracts.forEach(c => { if (c.market === 'TTD') delete c.priceTerms; });
  login(BA, 'AC-NV07', 'TTD'); S0.completeMeter('TTD', M, BA.currentAccount());
  const w0 = BA.features.finance.billing.warnings('TTD', S0.get('TTD', M).id).map(w => w.code);
  ['MISSING_LAND_POLICY', 'MISSING_UTILITY_POLICY', 'MISSING_SERVICE_POLICY'].forEach(c => assert(w0.includes(c), 'before: ' + c));
  assert.strictEqual(S0.stateOf('TTD', M).id, 'NEEDS_ACTION');
  const cfg = JSON.parse(JSON.stringify(BA.SERVICE_CFG.data()));
  ['stallPrices', 'utilities', 'extraServices'].forEach(c => { cfg[c] = cfg[c].filter(x => x.source !== 'prototype-demo'); });
  delete cfg.demoTtdFeePolicyV1;
  const h = createApp(ROOT, { storage: { 'choso-caolanh-state': base.localStorage.getItem('choso-caolanh-state'), 'choso-caolanh-serviceconfig': JSON.stringify(cfg) } });
  const A = h.A, S = A.features.finance.marketPeriod, B = A.features.finance.billing, mp = S.get('TTD', M);
  assert.deepStrictEqual(demoIds(A), ['es-ttd-demo-dich-vu', 'sp-ttd-demo-covered', 'ut-ttd-demo-dien', 'ut-ttd-demo-nuoc']);
  assert(!B.warnings('TTD', mp.id).some(blockingFee), 'after: no missing fee policy');
  assert.strictEqual(S.stateOf('TTD', M).id, 'READY_TO_ISSUE');
  assert(JSON.parse(h.localStorage.getItem('choso-caolanh-serviceconfig')).demoTtdFeePolicyV1 === 1, 'persisted in the existing config key');
  // 7: không trùng sau reload.
  const again = createApp(ROOT, { storage: { 'choso-caolanh-state': h.localStorage.getItem('choso-caolanh-state'), 'choso-caolanh-serviceconfig': h.localStorage.getItem('choso-caolanh-serviceconfig') } });
  assert.deepStrictEqual(demoIds(again.A), demoIds(A), 'no duplicate demo policy after reload');
  assert.strictEqual(again.A.features.finance.marketPeriod.stateOf('TTD', M).id, 'READY_TO_ISSUE');
});

console.log('ttd-demo-fee-policy regression PASS (' + passed + ' checks)');

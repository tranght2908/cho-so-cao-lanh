/* Regression: QĐ 480/shared records are historical only; the fee screen and resolver use per-market prices. */
const assert = require('assert');
const path = require('path');
const { createApp } = require('./harness');

const h = createApp(path.resolve(__dirname, '../..'));
const A = h.A, C = A.SERVICE_CFG;
const login = (id, market) => { A.ui.sessionAccountId = id; A.ui.currentDemoAccountId = id; A.ui.market = market; A.syncAccountContext(); };

login('AC-QT01', 'CL');
h.go('cau-hinh-gia');
assert(!/CHÍNH SÁCH CHUNG|QĐ 480|Giá tham chiếu/.test(h.view()), 'no shared-policy administration UI');
assert(/Danh sách cấu hình/.test(h.view()), 'normal per-market configuration remains available');

const before = C.resolveApplicableMarketFeePolicy({ marketId: 'CL', point: { market: 'CL', areaTypeId: 'covered' }, date: A.U.today() });
const legacy = C.add('stallPrices', { scope: 'SHARED', marketId: null, marketIds: ['CL'], areaTypeId: 'covered', amount: 9999, unit: 'đ/m²/ngày', effectiveFrom: '2026-01-01', effectiveTo: null, status: 'active', legalBasis: {}, attachments: [] }, 'test');
const after = C.resolveApplicableMarketFeePolicy({ marketId: 'CL', point: { market: 'CL', areaTypeId: 'covered' }, date: A.U.today() });
assert.strictEqual(after && after.id, before && before.id, 'shared history never overrides a market-owned price');
assert(legacy && legacy.scope === 'SHARED', 'legacy record is retained in the canonical store');

login('AC-NV01', 'CL');
h.go('cau-hinh-gia');
assert(!/QĐ 480|Giá tham chiếu|Dùng giá tham chiếu/.test(h.view()), 'market manager sees only direct market configuration');
h.act('fcm-open', { id: 'CL' });
assert(/data-act="fcm-edit" data-card="land"/.test(h.view()), 'market manager can configure its scoped market');

console.log('fee policy hierarchy regression PASS');

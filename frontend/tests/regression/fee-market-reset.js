/* Focused regression: "Chính sách thu và biểu phí" one-page market configuration (4 cards) + "Đặt lại cấu hình mức thu"
 * of ONE market (special admin action, permission cau-hinh-gia.dat-lai-cau-hinh-cho). Tổ trưởng keeps setting prices;
 * a normal price change creates a new version. Reset: only own records never used (contracts / receivables / drafts),
 * full backup inside choso-caolanh-serviceconfig (survives other writers), explicit confirmation + reason, audit log,
 * never on page load; QĐ 480, other markets, layout, points, periods untouched. Fixtures are in-memory only. */
const assert = require('assert');
const path = require('path');
const { createApp } = require('./harness');

const ROOT = path.resolve(__dirname, '../..');
let passed = 0;
const ok = (label, fn) => { try { fn(); passed++; } catch (e) { e.message = label + ': ' + e.message; throw e; } };
const json = x => JSON.stringify(x);
const FILE = { name: 'qd-muc-thu-ha.pdf', type: 'application/pdf', size: 13, mock: true };

const h = createApp(ROOT), A = h.A, C = A.SERVICE_CFG, L = A.features.lifecycle.service, MC = A.features.markets.service, fc = A.features.feeConfig;
const login = (id, market) => { A.ui.sessionAccountId = id; A.ui.currentDemoAccountId = id; A.ui.market = market || 'ALL'; A.syncAccountContext(); };
const today = A.U.today(), thisMonth = today.slice(0, 8) + '01', nextMonth = fc.nextMonthStart();
const screen = () => h.view() + h.modal();
const open = mid => { h.go('cau-hinh-gia'); h.act('fcm-open', { id: mid }); };
const owned = mid => ['stallPrices', 'utilities', 'extraServices'].flatMap(cat => C.list(cat).filter(r => C.isMarketOwnedPolicy(r, mid)));
const draft = (mid, patch) => Object.assign({ mid, land: { covered: '', uncovered: '', self_produced: '' }, preset: {}, charges: { electricity: null, water: null, service: null },
  electricity: { price: '', note: '' }, water: { price: '', note: '' }, services: {}, newServices: [], seq: 1, file: FILE, effectiveFrom: thisMonth }, patch || {});
const stored = () => JSON.parse(h.localStorage.getItem(C.KEY));

// ---- Fixture = the browser's HA: 3 own land prices from day 01, charges Mặt bằng + Dịch vụ, no service price, 0 points ----
login('AC-NV01', 'HA');
const HA = MC.get('HA');
assert(HA && HA.layoutStatus === 'PENDING_SETUP' && A.db.stalls.filter(s => s.market === 'HA').length === 0, 'fixture: HA has no layout / points');
let out = fc.saveMarketFeeConfig('HA', draft('HA', { land: { covered: '2000', uncovered: '1500', self_produced: '1000' }, charges: { electricity: false, water: false, service: true } }), 'Trần Minh Khoa');
assert(out.ok, json(out));
const others = () => json(MC.rows().filter(m => m.id !== 'HA').map(m => [m.id, owned(m.id), C.utilityModeInfo(m.id)]));
const shared = () => json(C.list('stallPrices').filter(r => r.scope === 'SHARED'));
const vehicle = () => json(C.list('extraServices').filter(r => r.category === 'VEHICLE'));
const haLayout = () => json([MC.get('HA').layoutStatus, MC.get('HA').allowedAreaTypeIds, A.db.stalls.filter(s => s.market === 'HA'), (A.db.billingPeriods || []).filter(p => p.marketId === 'HA'), A.db.contracts.filter(c => c.market === 'HA')]);
const before = { others: others(), shared: shared(), vehicle: vehicle(), layout: haLayout(), periods: json(A.db.billingPeriods), invoices: json(A.db.invoices) };

ok('one page: market info (name, code, rank, configuration status) + 4 cards, no tabs', () => {
  open('HA');
  const v = h.view();
  assert(/Cấu hình mức thu – Chợ Hòa An/.test(v) && /Mã chợ <b>HA<\/b>/.test(v) && /Hạng <b>Hạng 2<\/b>/.test(v));
  ['Tiền mặt bằng', 'Tiền điện', 'Tiền nước', 'Phí dịch vụ', 'Lịch sử đơn giá'].forEach(t => assert(v.includes(t), t));
  assert(!/data-act="fcm-dtab"/.test(v), 'no tab bar');
  assert(/Trạng thái cấu hình <span class="tag warn">Chưa hoàn tất/.test(v), 'service applies but no service price');
});
ok('consistency: no points / no layout → land scope = allowed area types, layout shown separately (never "đã thiết lập")', () => {
  const st = fc.marketConfigState('HA'), v = h.view();
  assert.strictEqual(L.marketLifecycle('HA').layoutReady, false);
  assert(/Sơ đồ mặt bằng của chợ chưa thiết lập/.test(v), 'layout status shown as not set up');
  assert(!/Mặt bằng đã thiết lập/.test(v));
  const allowedTypes = Array.isArray(HA.allowedAreaTypeIds) ? HA.allowedAreaTypeIds : [];
  assert.strictEqual(json(st.scope.types), json(allowedTypes.length ? allowedTypes : ['covered', 'uncovered', 'self_produced']));
  assert(/Chợ chưa có điểm kinh doanh — áp dụng \d loại diện tích được phép của chợ/.test(v));
  assert.strictEqual(st.land, 'SET', 'land PRICES are set (different from layout)');
  assert.strictEqual(st.service, 'MISSING'); assert.strictEqual(st.electricity, 'NA'); assert.strictEqual(st.water, 'NA');
});
ok('reset entry: "Thao tác khác" only for the system admin; Tổ trưởng has none and the service refuses', () => {
  login('AC-NV01', 'HA'); open('HA');
  assert(!/Thao tác khác/.test(h.view()) && !/fcm-mreset-open/.test(h.view()));
  const n = owned('HA').length;
  const r = fc.resetMarketFeeConfig('HA', { reason: 'x', confirmed: true });
  assert(r.denied && owned('HA').length === n, 'Tổ trưởng refused');
  assert.strictEqual(A.PERM.canAction('market_manager', 'cau-hinh-gia.dat-lai-cau-hinh-cho'), false);
  assert.strictEqual(A.PERM.canAction('system_admin', 'cau-hinh-gia.dat-lai-cau-hinh-cho'), true);
  assert.strictEqual(A.PERM.canAction('system_admin', 'cau-hinh-gia.them-phi'), false, 'admin still does not set prices');
  login('AC-QT01', 'HA'); open('HA');
  assert(/Thao tác khác/.test(h.view()) && /data-act="fcm-mreset-open"/.test(h.view()));
});
ok('CASE 12: opening / cancelling / confirming without the checkbox or a reason changes nothing', () => {
  const snap = h.localStorage.getItem(C.KEY);
  h.act('fcm-mreset-open');
  assert(/Đặt lại cấu hình mức thu – Chợ Hòa An/.test(h.modal()) && /Chưa sử dụng/.test(h.modal()) && (h.modal().match(/Mặt bằng · /g) || []).length === 3);
  h.act('fcm-mreset-confirm');
  assert(/Vui lòng xác nhận/.test(h.modal()));
  A.CH['fcm-mreset-ack']({ checked: true }); h.act('fcm-mreset-confirm');
  assert(/Vui lòng nhập lý do/.test(h.modal()));
  h.act('fcm-mreset-close');
  assert.strictEqual(h.localStorage.getItem(C.KEY), snap, 'nothing written');
});
ok('reference check runs AT CONFIRM time: a contract using an HA price appears after opening the popup → refused', () => {
  h.act('fcm-mreset-open');
  const land = owned('HA').find(r => r.areaTypeId === 'covered');
  const fake = { id: 'HĐ-RESET-PROBE', market: 'HA', traderId: 'x', status: 'ACTIVE', start: today, end: today, priceTerms: { land: { policyId: land.id } } };
  A.db.contracts.push(fake);
  try {
    A.IN['fcm-mreset-reason']({ value: 'thử' }); A.CH['fcm-mreset-ack']({ checked: true }); h.act('fcm-mreset-confirm');
    assert(/đã được sử dụng: Hợp đồng HĐ-RESET-PROBE/.test(h.modal()), 'refused with the reference');
    assert.strictEqual(owned('HA').length, 3, 'nothing removed');
  } finally { A.db.contracts.splice(A.db.contracts.indexOf(fake), 1); h.act('fcm-mreset-close'); }
});
ok('no reset on page load: reloading keeps the HA configuration', () => {
  const h2 = createApp(ROOT, { localStorage: h.localStorage });
  assert.strictEqual(h2.A.SERVICE_CFG.list('stallPrices').filter(r => h2.A.SERVICE_CFG.isMarketOwnedPolicy(r, 'HA')).length, 3);
  assert.strictEqual(json(h2.A.SERVICE_CFG.chargeApplicability('HA')), json(C.chargeApplicability('HA')));
});
let entry;
ok('confirmed reset (admin): HA → "Chưa cấu hình", 3 prices + declaration removed, backup + audit log written', () => {
  const ids = owned('HA').map(r => r.id).sort();
  h.act('fcm-mreset-open');
  A.IN['fcm-mreset-reason']({ value: 'Cấu hình thử nghiệm, khai báo lại từ đầu' }); A.CH['fcm-mreset-ack']({ checked: true });
  h.act('fcm-mreset-confirm');
  assert.strictEqual(owned('HA').length, 0); assert.strictEqual(C.chargeApplicability('HA'), null);
  assert.strictEqual(fc.marketConfigState('HA').market, 'NONE');
  assert(/Chưa cấu hình/.test(h.view()) && /Đã đặt lại cấu hình mức thu/.test(h.view()) && h.modal() === '');
  entry = C.marketConfigResets('HA').slice(-1)[0];
  assert(entry && entry.reason === 'Cấu hình thử nghiệm, khai báo lại từ đầu' && entry.user);
  assert.strictEqual(json(entry.records.stallPrices.map(r => r.id).sort()), json(ids), 'backup holds the full records');
  assert(entry.records.stallPrices.every(r => r.amount && r.effectiveFrom && r.history && r.attachments), 'restorable by hand');
  assert(entry.utilityMode && entry.utilityMode.charges && entry.utilityMode.charges.service === true, 'previous declaration backed up');
  assert(stored().marketConfigResets.some(x => x.id === entry.id), 'persisted in the same localStorage key');
  assert((C.utilityModeInfo('HA').history || []).some(x => x.action === 'Đặt lại cấu hình mức thu'), 'config history');
  assert((A.db.extraLog || []).some(x => /Đặt lại cấu hình mức thu chợ Chợ Hòa An/.test(x.what)), 'audit log');
});
ok('CASE 1 + CASE 2: other 11 markets, QĐ 480, parking fees, HA layout / points / periods / receivables unchanged', () => {
  assert.strictEqual(others(), before.others); assert.strictEqual(shared(), before.shared); assert.strictEqual(vehicle(), before.vehicle);
  assert.strictEqual(haLayout(), before.layout);
  assert.strictEqual(json(A.db.billingPeriods), before.periods); assert.strictEqual(json(A.db.invoices), before.invoices);
});
ok('backup survives other writers: an app instance with an older SERVICE_CFG saving later does not drop it', () => {
  // h0 loaded BEFORE the reset? Simulate a stale writer by restoring an older CFG copy in a second instance.
  const stale = JSON.parse(h.localStorage.getItem(C.KEY)); stale.marketConfigResets = [];
  const h3 = createApp(ROOT, { storage: { [C.KEY]: JSON.stringify(stale) } });
  h3.localStorage.setItem(C.KEY, h.localStorage.getItem(C.KEY)); // shared storage now has the backup; h3's memory does not
  h3.A.SERVICE_CFG.setUtilityMode('TVH', 'METER', 'test'); // any normal save from the stale instance
  assert(JSON.parse(h3.localStorage.getItem(C.KEY)).marketConfigResets.some(x => x.id === entry.id), 'backup kept');
});
ok('CASE 3 + CASE 4 + CASE 5: configure again from scratch — water not applied needs no price; electricity applied without price is missing', () => {
  login('AC-NV01', 'HA'); open('HA');
  h.act('fcm-apply', { k: 'electricity', v: '1' });
  assert(/Khoản thu áp dụng – Chợ Hòa An/.test(h.modal()));
  h.act('fcm-charge', { k: 'water', v: '0' }); h.act('fcm-charge', { k: 'service', v: '0' });
  h.act('fcm-save');
  assert.strictEqual(json(C.chargeApplicability('HA')), '{"land":true,"electricity":true,"water":false,"service":false}');
  const st = fc.marketConfigState('HA'), fee = L.marketLifecycle('HA').fee;
  assert.strictEqual(st.water, 'NA'); assert(!fee.missingCharges.includes('WATER'), 'water not required');
  assert.strictEqual(st.electricity, 'MISSING'); assert(fee.missingCharges.includes('ELECTRICITY'), 'electricity required');
  assert(/data-row=\"electricity\"[\s\S]*?Chưa thiết lập đơn giá/.test(h.view()));
});
ok('CASE 9: a future-dated price is not the current price', () => {
  h.act('fcm-edit', { card: 'electricity' });
  assert(/Chưa có đơn giá điện đang hiệu lực\./.test(h.modal()), 'popup states there is no current price');
  A.IN['fcm-field']({ dataset: { path: 'electricity.price' }, value: '3200' });
  A.IN['fcm-field']({ dataset: { path: 'effectiveFrom' }, value: nextMonth });
  A.ui.feeCfg.draft.file = FILE; h.act('fcm-save');
  assert.strictEqual(fc.marketConfigState('HA').electricity, 'MISSING', 'future price is not applied today');
  assert(L.marketLifecycle('HA').fee.missingCharges.includes('ELECTRICITY'));
  assert(/Mức mới 3\.200 đ\/kWh từ/.test(h.view()) && /Có mức thu mới sắp hiệu lực/.test(h.view()));
});
ok('CASE 6 + CASE 11: a current electricity price → no false "missing"; pressing Save twice creates one version', () => {
  h.act('fcm-edit', { card: 'electricity' });
  A.IN['fcm-field']({ dataset: { path: 'electricity.price' }, value: '3000' });
  A.IN['fcm-field']({ dataset: { path: 'effectiveFrom' }, value: thisMonth });
  A.ui.feeCfg.draft.file = FILE;
  const n = C.list('utilities').length;
  h.act('fcm-save'); h.act('fcm-save');
  assert.strictEqual(C.list('utilities').length, n + 1, 'one record');
  assert.strictEqual(fc.marketConfigState('HA').electricity, 'SET');
  assert(!L.marketLifecycle('HA').fee.missingCharges.includes('ELECTRICITY'));
  assert(/<b>3\.000<\/b> <span>đ\/kWh<\/span>/.test(h.view()));
});
ok('CASE 8 + popup: changing a price shows the current price (no empty field), keeps the old version in the history', () => {
  h.act('fcm-edit', { card: 'electricity' });
  assert(/Đơn giá hiện hành<\/span><b>3\.000 đ\/kWh<\/b>/.test(h.modal()) && /Đơn giá mới điện/.test(h.modal()));
  h.act('fcm-popup-close');
  const v = h.view();
  assert(/Lịch sử đơn giá/.test(v) && /3\.000 đ\/kWh/.test(v) && /3\.200 đ\/kWh/.test(v), 'versions listed');
});
ok('CASE 10: reload keeps the saved configuration', () => {
  const h2 = createApp(ROOT, { localStorage: h.localStorage });
  assert.strictEqual(json(h2.A.SERVICE_CFG.chargeApplicability('HA')), json(C.chargeApplicability('HA')));
  assert.strictEqual(h2.A.SERVICE_CFG.list('utilities').filter(r => h2.A.SERVICE_CFG.isMarketOwnedPolicy(r, 'HA')).length, 2);
});
// ---- CASE 7: a new electricity price never changes an issued round ----
ok('CASE 7: new electricity price for CL → issued receivables of CL_2026-11 unchanged', () => {
  const hi = createApp(ROOT, { seedIssue: true }), B = hi.A, inv = () => json(B.db.invoices.filter(i => i.billingPeriodId === 'CL_2026-11'));
  B.ui.sessionAccountId = 'AC-NV01'; B.ui.currentDemoAccountId = 'AC-NV01'; B.ui.market = 'CL'; B.syncAccountContext();
  const snap = inv();
  assert(JSON.parse(snap).length > 0, 'fixture: issued round');
  const r = B.features.feeConfig.saveMarketFeeConfig('CL', Object.assign(draft('CL', { effectiveFrom: B.features.feeConfig.nextMonthStart() }), { charges: B.SERVICE_CFG.chargeApplicability('CL'), electricity: { price: '3900', note: '' } }), 'test');
  assert(r.ok, json(r));
  assert.strictEqual(inv(), snap);
});
console.log(`fee-market-reset regression PASS (${passed} checks)`);

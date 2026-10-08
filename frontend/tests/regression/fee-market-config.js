/* Focused regression: "Chính sách thu và biểu phí" = per-market fee configuration (decision 10/2026).
 * List of markets in scope with config status; detail tabs (applicable charges, land, electricity, water,
 * services); saving the market's OWN records (shared
 * versioning rule: day-01 effective date + evidence file) drives the lifecycle to ACTIVE; ACTIVE markets
 * whose prices lapse stay ACTIVE with a warning; non-applicable charges cannot be chosen for a rental point (Hồ sơ
 * tiểu thương — nơi chọn khoản thu cho hợp đồng) and contract creation (màn Hợp đồng) is blocked when an applied
 * charge has no live price; RBAC; reload and cross-tab sync. */
const assert = require('assert');
const path = require('path');
const { createApp } = require('./harness');

const root = path.resolve(__dirname, '../..');
const h = createApp(root), A = h.A;
const MC = A.features.markets.service, L = A.features.lifecycle.service, C = A.SERVICE_CFG, S = A.features.marketLayout.store;
let passed = 0;
const ok = (label, fn) => { try { fn(); passed++; } catch (e) { e.message = label + ': ' + e.message; throw e; } };
const json = x => JSON.stringify(x);
const login = (id, market) => { A.ui.sessionAccountId = id; A.ui.currentDemoAccountId = id; A.ui.market = market || 'ALL'; A.syncAccountContext(); };
const FILE = { name: 'quyet-dinh-muc-thu.pdf', type: 'application/pdf', size: 10, mock: true };
const setupLayout = (marketId, types) => {
  const draft = S.initialSetup.createDraft(marketId);
  draft.buildings[0].name = 'Nhà lồng A';
  draft.floors.push({ id: 'f1', buildingDraftId: draft.buildings[0].id, name: 'Tầng 1', businessArea: 300 });
  draft.rows.push({ id: 'r1', buildingDraftId: draft.buildings[0].id, floorDraftId: 'f1', name: 'Dãy A', industry: A.D.INDUSTRIES[0], allocatedArea: 300 });
  types.forEach((t, i) => draft.pointGroups.push({ id: 'g' + i, rowDraftId: 'r1', areaTypeId: t, quantity: 4, areaPerPoint: 10 }));
  assert(S.initialSetup.commit(draft).ok);
};
const newMarket = (name, types) => { const m = MC.add({ name, address: 'Khóm test', rank: 'HANG_3', totalArea: 1000, businessArea: 600 }, 'test'); setupLayout(m.id, types); return m.id; };
const listRow = id => { h.go('cau-hinh-gia'); h.act('fcm-back'); const v = h.view(), i = v.indexOf(`data-act="fcm-open" data-id="${id}"`); assert(i !== -1, 'row ' + id); return v.slice(v.lastIndexOf('<tr>', i), i); };
// One-page detail (10/2026): cards on the page, setting / changing prices in a popup (modal) → read both.
const screen = () => h.view() + h.modal();
const open = (id, tab) => { h.go('cau-hinh-gia'); h.act('fcm-open', { id }); if (tab) h.act('fcm-dtab', { id: tab }); };
const field = (path, value) => A.IN['fcm-field']({ dataset: { path }, value: String(value) });
const charge = (k, on) => h.act('fcm-charge', { k, v: on ? '1' : '0' });
const save = () => { A.ui.feeCfg.draft.file = FILE; h.act('fcm-save'); return A.ui.feeCfg.result; };
const thisMonth = A.U.today().slice(0, 8) + '01';

login('AC-NV01'); // Tổ trưởng: quyền cau-hinh-gia.them-phi, phạm vi 12 chợ

ok('screen: list of markets in scope, two tabs, only market-owned records count as configured', () => {
  h.go('cau-hinh-gia');
  assert.strictEqual(A.current, 'cau-hinh-gia');
  const v = h.view();
  assert(/Chính sách thu và biểu phí/.test(v) && /Quản lý khoản thu và mức giá áp dụng cho từng chợ\./.test(v));
  assert(/Danh sách cấu hình/.test(v) && /Lịch sử thay đổi/.test(v));
  assert.strictEqual((v.match(/data-act="fcm-open"/g) || []).length, A.allowedMarkets(A.currentAccount()).length);
  assert(/Đã cấu hình/.test(listRow('CL')) && /Đã cấu hình/.test(listRow('TTD')));
  assert(/Chưa cấu hình/.test(listRow('TVH')), 'TVH has no market-owned configuration');
});
ok('CASE 1 HA: no own configuration → list "Chưa cấu hình", lifecycle PENDING_FEE', () => {
  setupLayout('HA', ['covered', 'uncovered']);
  assert(/Chưa cấu hình/.test(listRow('HA')));
  assert.strictEqual(L.marketLifecycle('HA').stage, 'PENDING_FEE');
  open('HA');
  const v = screen();
  assert(/Cấu hình mức thu – Chợ Hòa An/.test(v) && /Trạng thái cấu hình <span class="tag ">Chưa cấu hình/.test(v), v.slice(0, 600));
  ['Tiền mặt bằng', 'Tiền điện', 'Tiền nước', 'Phí dịch vụ', 'Lịch sử đơn giá'].forEach(t => assert(v.includes(t), t));
  assert(!/QĐ 480|Giá tham chiếu/.test(v), 'no shared reference UI');
  assert(/Chưa chọn Áp dụng \/ Không áp dụng/.test(v), 'charges not declared yet');
});
let m1;
ok('CASE 7 opening direct land pricing creates no default price or version', () => {
  m1 = newMarket('Chợ cấu hình M1', ['covered']);
  const before = json(C.list('stallPrices'));
  open(m1, 'land');
  assert.strictEqual(A.ui.feeCfg.draft.land.covered, '');
  assert(!/QĐ 480|Giá tham chiếu|Dùng giá tham chiếu/.test(screen()));
  assert.strictEqual(json(C.list('stallPrices')), before, 'nothing written');
  assert.strictEqual(MC.get(m1).status, 'NOT_ACTIVE');
});
ok('CASE 3 electricity applicable without a price → saved, still PENDING_FEE, missing "đơn giá điện"', () => {
  h.act('fcm-dtab', { id: 'charges' });
  charge('electricity', true); charge('water', false); charge('service', false);
  field('land.covered', 2000);
  field('effectiveFrom', thisMonth);
  const r = save();
  assert(/Chợ vẫn chưa đủ điều kiện hoạt động/.test(r.title), r.title);
  assert(r.items.some(x => /đơn giá điện/.test(x)));
  assert.strictEqual(MC.get(m1).status, 'NOT_ACTIVE');
  assert.strictEqual(json(C.chargeApplicability(m1)), '{"land":true,"electricity":true,"water":false,"service":false}');
  assert(C.list('stallPrices').some(p => p.marketId === m1 && p.areaTypeId === 'covered' && p.amount === 2000 && p.scope === 'MARKET'), 'own land record from direct entry');
  assert(/data-row="electricity"[\s\S]*?Chưa thiết lập đơn giá[\s\S]*?Chưa thiết lập mức thu/.test(screen()), 'electricity row shows the missing price');
});
ok('CASE 4 + 8 electricity price saved → coverage passes → ACTIVE (CASE 6: service=false not required)', () => {
  open(m1, 'electricity');
  field('electricity.price', 3100); field('effectiveFrom', thisMonth);
  const r = save();
  assert.strictEqual(r.title, 'Đã lưu cấu hình. Chợ đã đủ điều kiện và chuyển sang Đang hoạt động.');
  assert.strictEqual(MC.get(m1).status, 'ACTIVE');
  assert(!L.marketFeeCoverage(m1).missingCharges.length);
  assert(/Đã cấu hình/.test(listRow(m1)));
});
ok('saving requires day-01 effective date and an evidence file (shared versioning rule)', () => {
  open(m1, 'electricity');
  field('electricity.price', 3300); field('effectiveFrom', A.U.today());
  A.ui.feeCfg.draft.file = FILE; h.act('fcm-save');
  assert(A.ui.feeCfg.result.items.some(x => /ngày 01 của tháng/.test(x)));
  field('effectiveFrom', A.features.feeConfig.nextMonthStart()); A.ui.feeCfg.draft.file = null; h.act('fcm-save');
  assert(A.ui.feeCfg.result.items.some(x => /tệp căn cứ/.test(x)));
  h.act('fcm-reset');
});
ok('CASE 2 HA: land only (electricity/water/service = không áp dụng) with prices for areas in use → ACTIVE', () => {
  open('HA', 'charges');
  charge('electricity', false); charge('water', false); charge('service', false);
  field('land.covered', 2000); field('land.uncovered', 1500); field('effectiveFrom', thisMonth);
  const r = save();
  assert(/Đang hoạt động/.test(r.title), r.title);
  assert.strictEqual(MC.get('HA').status, 'ACTIVE');
});
let m2;
ok('CASE 5 service applicable but no service → PENDING_FEE; adding one → ACTIVE', () => {
  m2 = newMarket('Chợ cấu hình M2', ['uncovered']);
  open(m2, 'charges');
  charge('electricity', false); charge('water', false); charge('service', true);
  field('land.uncovered', 1500); field('effectiveFrom', thisMonth);
  save();
  assert.strictEqual(MC.get(m2).status, 'NOT_ACTIVE');
  assert(L.marketFeeCoverage(m2).missingCharges.includes('SERVICE'));
  h.act('fcm-dtab', { id: 'service' });
  h.act('fcm-svc-add');
  const key = A.ui.feeCfg.draft.newServices[0].key;
  field(`new.${key}.name`, 'Phí vệ sinh'); field(`new.${key}.amount`, 100000); field('effectiveFrom', thisMonth);
  save();
  assert.strictEqual(MC.get(m2).status, 'ACTIVE');
  assert(C.list('extraServices').some(x => x.marketId === m2 && x.name === 'Phí vệ sinh' && x.amount === 100000 && x.collectionCycle === 'MONTH'));
});
ok('CASE 9 ACTIVE market whose own price lapses → stays ACTIVE, ACTIVE_FEE_WARNING, "Cần cập nhật"', () => {
  const p = C.list('stallPrices').find(x => x.marketId === m1 && x.areaTypeId === 'covered' && x.status === 'active');
  const prevTo = p.effectiveTo;
  C.update('stallPrices', p.id, { effectiveTo: '2026-05-01' }, 'test', 'Test hết hạn');
  try {
    assert.strictEqual(MC.get(m1).status, 'ACTIVE', 'never auto-demoted');
    assert.strictEqual(L.marketLifecycle(m1).stage, 'ACTIVE_FEE_WARNING');
    assert(/Chưa hoàn tất/.test(listRow(m1)), 'lapsed price → configuration not complete');
    open(m1);
    assert(/Còn cần xử lý: Tiền mặt bằng: chưa thiết lập mức thu \(Có mái che\)/.test(screen()) && /Chưa có giá: Có mái che/.test(screen()) && /Chưa hoàn tất/.test(screen()));
  } finally { C.update('stallPrices', p.id, { effectiveTo: prevTo }, 'test', 'Khôi phục'); }
});
const traderIn = (market, id) => { const t = { id, name: 'Tiểu thương ' + id, phone: '0977' + String(100000 + A.db.traders.length).slice(-6), idNo: 'ID-' + id, market, stalls: [], source: 'STAFF' }; A.db.traders.push(t); A.reindex(); return t; };
// Khoản thu áp dụng cho từng điểm (và vào hợp đồng) được chọn ở Hồ sơ tiểu thương; màn Hợp đồng chỉ đọc lại.
// Mở form hồ sơ với một điểm của chợ và trả về HTML ô chọn khoản thu của điểm đó.
const profileCharges = (t, pt) => {
  h.go('tieu-thuong'); h.act('tp-edit', { id: t.id });
  const d = A.ui.traderWorkspace.wizard;
  assert(d, 'profile form opened');
  d.items = [{ pointId: pt.id, charges: { land: true, electricity: false, water: false, marketService: false }, feeRefs: {} }];
  A.render();
  return { d, html: h.view() };
};
const chargeBox = (html, pt, k) => (html.match(new RegExp(`<input type="checkbox" data-ch="tp-charge" data-id="${pt.id}" data-key="${k}"[^>]*>`)) || [''])[0];
ok('CASE 10 electricity "không áp dụng" → cannot be selected for the point / contract (disabled with explanation)', () => {
  const t = traderIn('HA', 'FCM-T1'), pt = A.db.stalls.find(st => st.market === 'HA');
  login('AC-NV01', 'HA');
  const { d, html } = profileCharges(t, pt);
  ['electricity', 'water', 'marketService'].forEach(k => { const box = chargeBox(html, pt, k); assert(/disabled/.test(box) && /Không áp dụng tại chợ này/.test(box), k + ' locked: ' + box); });
  A.CH['tp-charge']({ dataset: { id: pt.id, key: 'electricity' }, checked: true });
  assert.strictEqual(d.items[0].charges.electricity, false, 'handler refuses too');
  h.act('tp-wizard-cancel');
});
ok('CASE 11 contract at a market with electricity applicable but no live price → blocked with clear message', () => {
  const t = traderIn(m1, 'FCM-T2'), pt = A.db.stalls.find(st => st.market === m1 && A.features.businessPoints.service.isAvailable(st.id, A.U.today(), '2027-05-14'));
  login('AC-NV01', m1);
  assert(A.features.traders.service.setRentalDraft(t.id, [{ pointId: pt.id, charges: { land: true, electricity: true }, feeRefs: {} }]), 'electricity registered for the point');
  const elec = C.list('utilities').filter(u => u.marketId === m1 && u.status === 'active');
  elec.forEach(u => { u.status = 'inactive'; });
  try {
    h.go('hop-dong'); h.act('ct-new', { trader: t.id });
    A.CH['ctw-row']({ dataset: { id: pt.id, k: 'start' }, value: A.U.today() });
    A.CH['ctw-row']({ dataset: { id: pt.id, k: 'end' }, value: '2027-05-14' });
    h.act('ctw-submit');
    assert(/Chợ chưa có đơn giá điện đang áp dụng tại ngày bắt đầu\. Cần cập nhật cấu hình mức thu\./.test(h.view()), 'row error shown');
    assert(/Chưa tạo hợp đồng nào/.test(h.trace.toasts.at(-1)), h.trace.toasts.at(-1));
    assert(!A.db.contracts.some(c => c.traderId === t.id), 'no contract created');
  } finally { elec.forEach(u => { u.status = 'active'; }); h.act('ctw-cancel'); login('AC-NV01'); }
});
ok('CASE 12 TTD legacy "Theo phiên": every market-config view renders, legacy note shown, still ACTIVE', () => {
  ['charges', 'land', 'electricity', 'water', 'service'].forEach(t => { open('TTD', t); assert(h.view().length > 500, t); });
  open('TTD', 'land');
  assert(/điểm "Theo phiên" \(dữ liệu cũ\) không yêu cầu mức thu/.test(screen()));
  assert.strictEqual(L.marketLifecycle('TTD').stage, 'ACTIVE');
});
ok('RBAC: ward leader can view but not edit; handlers refuse writes', () => {
  login('AC-LD01');
  open('CL', 'electricity');
  const v = screen();
  assert(!/data-act="fcm-save"/.test(v) && /chỉ có quyền xem/.test(v) && /data-path="electricity.price"[^>]*disabled/.test(v));
  const n = C.list('utilities').length;
  A.IN['fcm-field']({ dataset: { path: 'electricity.price' }, value: '9999' });
  A.ui.feeCfg.draft.electricity.price = '9999'; A.ui.feeCfg.draft.file = FILE; h.act('fcm-save');
  assert.strictEqual(C.list('utilities').length, n);
  login('AC-NV01');
});
ok('filters: search, status, rank; history tab lists own-config changes', () => {
  h.go('cau-hinh-gia'); h.act('fcm-back');
  A.IN['fcm-q']({ value: 'Hòa An' }); assert.strictEqual((h.view().match(/data-act="fcm-open"/g) || []).length, 1);
  A.IN['fcm-q']({ value: '' });
  A.CH['fcm-status']({ value: 'NONE' }); assert(!/data-id="CL"/.test(h.view()) && /data-id="TVH"/.test(h.view()));
  A.CH['fcm-status']({ value: '' });
  A.CH['fcm-rank']({ value: 'HANG_1' }); assert(/data-id="CL"/.test(h.view()) && !/data-id="HA"/.test(h.view()));
  A.CH['fcm-rank']({ value: '' });
  h.act('fcm-tab', { id: 'history' });
  const hv = h.view();
  assert(/Khai báo khoản thu áp dụng/.test(hv), 'charge declarations are in the history');
  assert(/Tạo cấu hình/.test(hv) && hv.includes(A.U.mShort('HA')), 'own price records of HA are in the history');
  h.act('fcm-tab', { id: 'list' });
});
ok('evidence: every new or changed market land price requires its own file', () => {
  const m4 = newMarket('Chợ căn cứ M4', ['covered', 'uncovered']);
  open(m4, 'charges'); charge('electricity', false); charge('water', false); charge('service', false);
  field('land.covered', 2000); field('land.uncovered', 1800); field('effectiveFrom', thisMonth);
  h.act('fcm-save');
  assert(A.ui.feeCfg.result.items.some(x => /tệp căn cứ/.test(x)), 'new direct prices require a file');
  const n = C.list('stallPrices').length;
  const out = save();
  assert(/Đã lưu cấu hình/.test(out.title), json(out));
  assert.strictEqual(C.list('stallPrices').length, n + 2, 'one own version per used area type');
  assert(!C.list('stallPrices').some(p => p.marketId === m4 && p.areaTypeId === 'self_produced'), 'no price for an unused area type');
  C.list('stallPrices').filter(p => p.marketId === m4).forEach(p => {
    assert.strictEqual(p.scope, 'MARKET');
    assert.strictEqual((p.attachments || []).length, 1);
    assert(!p.referencePolicyId, 'not linked to a shared reference policy');
  });
  assert.strictEqual(MC.get(m4).status, 'ACTIVE');
  open(m4, 'land'); field('land.covered', 2200); field('effectiveFrom', A.features.feeConfig.nextMonthStart()); A.ui.feeCfg.draft.file = null;
  h.act('fcm-save');
  assert(A.ui.feeCfg.result.items.some(x => /tệp căn cứ/.test(x)), 'a later change also requires evidence');
  h.act('fcm-reset');
});
ok('charge switched to "Không áp dụng": prices ended (not deleted), history "Khoản Điện ngừng áp dụng từ …", new periods/contracts exclude it', () => {
  const nextMonth = A.features.feeConfig.nextMonthStart(), monthEnd = A.features.feeConfig.prevDay(nextMonth);
  const elecBefore = C.list('utilities').filter(u => u.marketId === m1 && u.kind === 'ELECTRICITY').map(u => u.id);
  assert(elecBefore.length && C.chargeApplicability(m1).electricity === true, 'fixture: m1 bills electricity');
  open(m1, 'charges'); charge('electricity', false); field('effectiveFrom', nextMonth);
  h.act('fcm-save');
  assert(/Đã lưu/.test(A.ui.feeCfg.result.title), json(A.ui.feeCfg.result));
  const elec = C.list('utilities').filter(u => u.marketId === m1 && u.kind === 'ELECTRICITY');
  assert.strictEqual(json(elec.map(u => u.id)), json(elecBefore), 'no record deleted');
  elec.filter(u => u.status === 'active').forEach(u => assert.strictEqual(u.effectiveTo, monthEnd, 'ends the day before'));
  assert(elec.some(u => (u.history || []).some(x => x.detail === 'Khoản Điện ngừng áp dụng từ ' + A.U.dmy(nextMonth))), 'price history');
  assert((C.utilityModeInfo(m1).history || []).some(x => /Khoản Điện ngừng áp dụng từ/.test(x.detail)), 'charge history');
  assert.strictEqual(C.chargeActiveAt(m1, 'electricity', A.U.today()), true, 'current period still bills electricity');
  assert.strictEqual(C.chargeActiveAt(m1, 'electricity', nextMonth), false, 'new periods do not');
  assert.strictEqual(MC.get(m1).status, 'ACTIVE', 'electricity no longer required');
  const t = traderIn(m1, 'FCM-T3');
  login('AC-NV01', m1);
  const pt = A.db.stalls.find(st => st.market === m1), { html } = profileCharges(t, pt);
  assert(/disabled/.test(chargeBox(html, pt, 'electricity')), 'new contracts cannot select electricity');
  h.act('tp-wizard-cancel'); login('AC-NV01');
});
ok('billing: a contract that registered electricity gets no electricity line once the charge stopped', () => {
  const c = A.db.contracts.find(x => x.market === 'CL' && x.status === 'ACTIVE' && x.serviceApplicability && x.serviceApplicability.electricity);
  assert(c, 'fixture: CL contract with electricity');
  const prev = C.chargeApplicability('CL');
  const bp = A.db.billingPeriods.find(p => p.marketId === 'CL' && p.period === '2026-11');
  assert(bp, 'fixture: CL period 2026-11');
  const elecLines = () => { bp.meter = Object.assign({}, bp.meter, { status: 'COMPLETED' }); return A.features.finance.billing.calculatePeriod('CL', bp.id).drafts.filter(d => d.contractId === c.id && d.items[0].chargeType === 'ELECTRICITY').length + A.db.billingWarnings.filter(w => w.contractId === c.id && w.chargeType === 'ELECTRICITY' && w.billingPeriodId === bp.id).length; };
  const utils = C.list('utilities').filter(u => u.marketId === 'CL' && u.kind === 'ELECTRICITY' && u.status === 'active'), saved = utils.map(u => u.effectiveTo);
  assert(elecLines() > 0, 'electricity considered while the charge applies');
  C.setChargeApplicability('CL', { electricity: false, water: prev.water, service: prev.service }, 'test');
  // Kỳ 11/2026 bills the USAGE month (October, meter read in late October): the charge must have stopped before
  // that usage month for the round to carry no electricity line.
  utils.forEach(u => { u.effectiveTo = '2026-09-30'; });
  try {
    assert.strictEqual(elecLines(), 0, 'no electricity line / warning after the stop date');
  } finally { utils.forEach((u, i) => { u.effectiveTo = saved[i]; }); C.setChargeApplicability('CL', prev, 'test'); }
});
ok('RBAC: only the market manager (permission + market scope) may save — enforced by the service, not just the UI', () => {
  const draft = mid => Object.assign({}, { mid, land: { covered: '2500', uncovered: '', self_produced: '' }, preset: {}, charges: { electricity: false, water: false, service: false },
    electricity: { price: '', note: '' }, water: { price: '', note: '' }, services: {}, newServices: [], file: FILE, effectiveFrom: thisMonth });
  const fc = A.features.feeConfig, count = () => C.list('stallPrices').length;
  [['AC-QT01', 'Quản trị hệ thống'], ['AC-LD01', 'Lãnh đạo phường']].forEach(([id]) => {
    login(id); const n = count();
    const out = fc.saveMarketFeeConfig('TVH', draft('TVH'), 'x');
    assert(out.denied, id + ' denied'); assert.strictEqual(count(), n);
    h.go('cau-hinh-gia'); h.act('fcm-open', { id: 'TVH' });
    assert(!/data-act="fcm-save"/.test(h.view()) && /chỉ có quyền xem/.test(h.view()), id + ' view only');
  });
  // Market manager outside its market scope is refused too.
  const mgr = A.ACCOUNTS.currentList().find(a => a.id === 'AC-NV01'), scopes = mgr.marketScopes;
  mgr.marketScopes = ['CL']; login('AC-NV01', 'CL');
  try {
    const n = count();
    assert(fc.saveMarketFeeConfig('TVH', draft('TVH'), 'x').denied, 'out of scope');
    assert.strictEqual(count(), n);
    h.go('cau-hinh-gia'); h.act('fcm-back');
    assert(!/data-id="TVH"/.test(h.view()), 'list respects marketScopes');
  } finally { mgr.marketScopes = scopes; login('AC-NV01'); }
  assert.strictEqual(A.PERM.canAction('system_admin', 'cau-hinh-gia.them-phi'), false, 'admin has no per-market fee edit permission');
  assert.strictEqual(A.PERM.canAction('market_manager', 'cau-hinh-gia.them-phi'), true);
});
ok('legacy shared QĐ 480 data remains persisted but is absent from UI and never used as a market price', () => {
  const legacy = C.add('stallPrices', { id: 'legacy-shared-qd480', scope: 'SHARED', marketId: null, marketIds: ['TVH'], areaTypeId: 'covered', amount: 9999, unit: 'đ/m²/ngày', effectiveFrom: '2026-01-01', effectiveTo: null, status: 'active', legalBasis: {}, attachments: [] }, 'test');
  h.localStorage.setItem(C.KEY, JSON.stringify(C.data()));
  const own = C.resolveApplicableMarketFeePolicy({ marketId: 'TVH', point: { market: 'TVH', areaTypeId: 'covered' }, date: A.U.today() });
  assert(!own || own.scope !== 'SHARED', 'shared record is never resolved as a market price');
  h.go('cau-hinh-gia'); h.act('fcm-back');
  assert(!/QĐ 480|Giá tham chiếu/.test(h.view()), 'legacy data is not rendered in the policy UI');
  const h2 = createApp(root, { localStorage: h.localStorage });
  assert(h2.A.SERVICE_CFG.get('stallPrices', legacy.id), 'legacy shared data survives reload');
  login('AC-NV01');
});
ok('CASE 13 reload: configuration and statuses persist', () => {
  const h2 = createApp(root, { localStorage: h.localStorage });
  const L2 = h2.A.features.lifecycle.service, C2 = h2.A.SERVICE_CFG;
  [m1, m2, 'HA', 'CL', 'TTD'].forEach(id => assert.strictEqual(L2.marketFeeStatus(id).key, L.marketFeeStatus(id).key, id));
  assert.strictEqual(json(C2.chargeApplicability('HA')), json(C.chargeApplicability('HA')));
  assert.strictEqual(h2.A.features.markets.service.get('HA').status, 'ACTIVE');
});
ok('CASE 14 multi-tab: config saved in another tab is picked up by refreshSharedState', () => {
  const m3 = newMarket('Chợ cấu hình M3', ['covered']);
  const other = createApp(root, { localStorage: h.localStorage }); // second tab on the same storage
  const C3 = other.A.SERVICE_CFG;
  C3.setChargeApplicability(m3, { electricity: false, water: false, service: false }, 'tab-2');
  C3.add('stallPrices', { marketId: m3, scope: 'MARKET', areaTypeId: 'covered', amount: 2000, unit: 'đ/m²/ngày', effectiveFrom: thisMonth, effectiveTo: null, status: 'active', legalBasis: {}, attachments: [] }, 'tab-2');
  assert.strictEqual(MC.get(m3).status, 'NOT_ACTIVE', 'this tab not refreshed yet');
  const out = A.refreshSharedState();
  assert(out.changed && out.serviceConfig.changed);
  assert.strictEqual(MC.get(m3).status, 'ACTIVE');
  assert.strictEqual(L.marketFeeStatus(m3).key, 'COMPLETE');
});
console.log(`fee-market-config regression PASS (${passed} checks)`);

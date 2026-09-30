/* Focused regression: "Danh mục chợ" — KPI, filters, scale (add/edit/validation), business area types
 * applied to the market (allowedAreaTypeIds — no quota per type), derived layout status and usage,
 * backward compatibility of the catalog store (legacy capacityByAreaType). */
const assert = require('assert');
const path = require('path');
const { createApp } = require('./harness');
const root = path.resolve(__dirname, '../..');
const login = (A, id) => { A.ui.sessionAccountId = id; A.ui.market = 'ALL'; A.syncAccountContext(); };
let passed = 0;
const ok = (label, fn) => { try { fn(); passed++; } catch (e) { e.message = label + ': ' + e.message; throw e; } };
// Arrays from the vm realm have a different prototype: compare by value.
const eq = (a, b, msg) => assert.strictEqual(JSON.stringify(a), JSON.stringify(b), msg);

// Legacy catalog record saved before this change (no scale fields) must still load.
const legacy = JSON.stringify([{ id: 'CL', code: 'CL', rank: 'HANG_1', unit: 'BQL CL', manager: 'X', phone: '0909', priceConfigId: 'QD480_CHO_CAO_LANH', status: 'active', createdBy: 'seed', createdAt: 'seed' }]);
const h = createApp(root, { storage: { 'choso-caolanh-marketcatalog': legacy } }), A = h.A;
login(A, 'AC-QT01');
const MC = A.features.markets.service;
const IDS = ['CL', 'HA', 'TVH', 'TTT', 'TL', 'TT', 'TTH', 'MN', 'TTD', 'LH', 'XB', 'SQ'];
const accountsBefore = h.localStorage.getItem('choso-caolanh-accounts');
const permsBefore = h.localStorage.getItem('choso-caolanh-permissions');
const view = () => { h.go('danh-muc-cho'); return h.view(); };
const rowsInView = () => (view().match(/data-act="dmc-open"/g) || []).length;
const fill = (vals) => Object.keys(vals).forEach(k => h.input('#' + k, vals[k] === null ? '' : String(vals[k])));
const typeIds = MC.areaTypes().map(t => t.id);
// Checkbox state of section C (stub DOM: set explicitly, the stub does not parse the modal HTML).
const pick = list => typeIds.forEach(id => { h.el('#dmc-at-' + id).checked = list.indexOf(id) !== -1; });
const checkedInHtml = html => typeIds.filter(id => new RegExp(`id="dmc-at-${id}" checked`).test(html));
const QUOTA_UI = /Số điểm tối đa|Diện tích tối đa|Hiện có trên mặt bằng|Tổng cộng|điểm tối đa|dmc-cap-|CHỈ TIÊU ĐIỂM KINH DOANH|Còn lại/;
const layoutSnap = () => JSON.stringify(['buildings', 'floors', 'rows', 'stalls'].map(k => A.db[k] || null));

ok('1 twelve markets kept, ids unchanged, legacy meta preserved', () => {
  const ids = MC.rows().map(r => r.id);
  IDS.forEach(id => assert(ids.includes(id), id));
  assert.strictEqual(MC.get('CL').code, 'CL');
  assert.strictEqual(MC.get('CL').phone, '0909');
  assert.strictEqual(MC.get('CL').totalArea, null);
  assert.strictEqual(MC.get('CL').capacityByAreaType, null);
  assert.strictEqual(MC.get('CL').allowedAreaTypeIds, null);
  assert.strictEqual(rowsInView(), 12);
  assert(/Tổng số chợ/.test(view()) && /Chưa thiết lập mặt bằng/.test(view()));
  assert(/dmc-management-head/.test(view()) && /Tổ Quản lý chợ/.test(view()), 'shared management context is rendered');
  assert(/Phạm vi quản lý/.test(view()) && /12 chợ/.test(view()), 'management scope derives from the market catalog');
  assert(/Tổ trưởng/.test(view()) && /Trần Minh Khoa/.test(view()), 'active current manager is rendered from Accounts');
  const activeManager = A.ACCOUNTS.currentList().find(a => A.ACCOUNTS.primaryRole(a) === 'market_manager' && A.ACCOUNTS.isActive(a));
  assert(view().includes(A.U.maskPhone(activeManager.phone)), 'manager phone uses the canonical masking helper');
  assert(/data-act="dmc-toggle-manager-phone"/.test(view()), 'masked manager phone has a view control');
  assert(!/<h2>Danh mục chợ<\/h2>|Quản lý thông tin, quy mô/.test(view()), 'duplicate content title and description are removed');
  assert(/dmc-market-name/.test(view()) && /dmc-address/.test(view()) && /dmc-col-actions/.test(view()), 'balanced table presentation is rendered');
  assert(!/Tổ trưởng phụ trách/.test(view()), 'manager column is not rendered');
  h.act('dmc-open', { id: 'CL' });
  assert(/Đơn vị quản lý<\/dt><dd>Tổ Quản lý chợ/.test(h.modal()), 'legacy unit is displayed as the shared unit');
  assert(!/Tổ trưởng phụ trách/.test(h.modal()), 'legacy manager is not rendered');
  A.closeModal();
});
ok('1b management context does not use a pending or locked manager', () => {
  const manager = A.ACCOUNTS.currentList().find(a => A.ACCOUNTS.primaryRole(a) === 'market_manager');
  const previousStatus = manager.status;
  manager.status = 'PENDING_ACTIVATION';
  assert(/Chưa có người đảm nhiệm/.test(view()), 'no active manager has a clear empty-state label');
  manager.status = previousStatus;
});
ok('1c management context handles a missing manager phone without changing the account', () => {
  const manager = A.ACCOUNTS.currentList().find(a => A.ACCOUNTS.primaryRole(a) === 'market_manager');
  const previousPhone = manager.phone;
  manager.phone = '';
  assert(/Số điện thoại<\/span><b[^>]*>Chưa cập nhật/.test(view()));
  assert(!/data-act="dmc-toggle-manager-phone"/.test(view()), 'missing phone has no view control');
  manager.phone = previousPhone;
});
ok('1d manager phone toggle is presentation-only and defaults to masked', () => {
  const manager = A.ACCOUNTS.currentList().find(a => A.ACCOUNTS.primaryRole(a) === 'market_manager');
  const before = manager.phone;
  assert(view().includes(A.U.maskPhone(before)) && !view().includes(before));
  h.act('dmc-toggle-manager-phone');
  assert(view().includes(before) && /title="Ẩn số điện thoại"/.test(view()), 'full phone is shown after toggling');
  h.act('dmc-toggle-manager-phone');
  assert(view().includes(A.U.maskPhone(before)) && !view().includes(before));
  assert.strictEqual(manager.phone, before, 'Account phone is not changed');
});
ok('2 layout status derived from layout store', () => {
  assert(MC.layoutReady('CL') && MC.layoutReady('TTD'));
  assert(!MC.layoutReady('HA'));
});
ok('3 search / rank / status / layout filters compose', () => {
  A.IN['dmc-search']({ value: 'Tân' }); const nSearch = rowsInView();
  assert(nSearch > 0 && nSearch < 12);
  A.CH['dmc-layout']({ value: 'set' }); const nBoth = rowsInView();
  assert.strictEqual(nBoth, MC.rows().filter(r => /tân/i.test(r.name + r.address + r.code) && MC.layoutReady(r.id)).length);
  A.CH['dmc-rank']({ value: 'HANG_1' }); assert.strictEqual(rowsInView(), 0, 'no hạng 1 market matches Tân + set');
  h.act('dmc-reset'); assert.strictEqual(rowsInView(), 12);
  A.CH['dmc-rank']({ value: 'HANG_3' }); const n3 = rowsInView(); assert(n3 > 0 && n3 < 12);
  A.CH['dmc-layout']({ value: 'unset' }); assert.strictEqual(rowsInView(), MC.rows().filter(r => r.rank === 'HANG_3' && !MC.layoutReady(r.id)).length);
  h.act('dmc-reset');
  MC.update('SQ', { status: 'inactive' }, 't');
  A.CH['dmc-status']({ value: 'inactive' }); assert.strictEqual(rowsInView(), 1);
  MC.update('SQ', { status: 'active' }, 't'); h.act('dmc-reset');
});
ok('4 (B/C) create: section C is a checklist of area types, no quota inputs/totals; nothing pre-selected', () => {
  h.act('dmc-new');
  const m = h.modal();
  assert(/A\. THÔNG TIN CHUNG/.test(m) && /B\. QUY MÔ CHỢ/.test(m) && /C\. LOẠI DIỆN TÍCH KINH DOANH ÁP DỤNG/.test(m));
  assert(/Chọn các loại diện tích được sử dụng khi bố trí điểm kinh doanh tại chợ này\./.test(m));
  typeIds.forEach(id => assert(m.includes(`type="checkbox" id="dmc-at-${id}"`), id));
  ['Có mái che', 'Không mái che', 'Tự sản tự tiêu', 'Theo phiên'].forEach(l => assert(m.includes(l), l));
  assert(!QUOTA_UI.test(m), 'no quota UI: ' + (m.match(QUOTA_UI) || [])[0]);
  eq(checkedInHtml(m), [], 'nothing pre-selected');
});
ok('4b create: scale validation kept; saves only the selected area types', () => {
  const n = MC.rows().length;
  fill({ 'dmc-name': 'Chợ Thử', 'dmc-address': 'Khóm 1', 'dmc-total-area': 1000, 'dmc-business-area': 1200 }); pick(['covered', 'uncovered']);
  h.act('dmc-save', { id: '' });
  assert(/không được lớn hơn tổng diện tích/.test(h.el('#dmc-err-businessArea').innerHTML), 'businessArea > totalArea blocked');
  assert.strictEqual(MC.rows().length, n, 'nothing saved while invalid');
  fill({ 'dmc-business-area': 800 });
  h.act('dmc-save', { id: '' });
  assert.strictEqual(MC.rows().length, n + 1);
  const r = MC.rows()[n];
  assert(/^CHO\d+$/.test(r.code) && !IDS.includes(r.code));
  assert.strictEqual(r.totalArea, 1000); assert.strictEqual(r.businessArea, 800);
  assert.strictEqual(r.unit, 'Tổ Quản lý chợ');
  assert.strictEqual(r.manager, '');
  eq(r.allowedAreaTypeIds, ['covered', 'uncovered']);
  assert.strictEqual(r.capacityByAreaType, null, 'no quota stored');
  const stored = JSON.parse(h.localStorage.getItem('choso-caolanh-marketcatalog')).find(x => x.id === r.id);
  assert(!/maxPointCount|maxArea/.test(JSON.stringify(stored)));
  assert(!MC.layoutReady(r.id));
  assert(/Thêm chợ thành công/.test(h.trace.toasts.at(-1)));
});
ok('5 (I) detail modal: section C lists area types only, no quota numbers', () => {
  h.act('dmc-open', { id: MC.rows().at(-1).id });
  let m = h.modal();
  ['A. THÔNG TIN CHUNG', 'B. QUY MÔ CHỢ', 'C. LOẠI DIỆN TÍCH KINH DOANH ÁP DỤNG', 'D. TÌNH TRẠNG MẶT BẰNG'].forEach(s => assert(m.includes(s), s));
  assert(!/Bảng giá áp dụng|Hạng mục|Đơn giá|QĐ 480/.test(m), 'market detail does not render price configuration');
  assert(m.includes('<span class="tag">Có mái che</span>') && m.includes('<span class="tag">Không mái che</span>') && !m.includes('<span class="tag">Theo phiên</span>'));
  assert(!QUOTA_UI.test(m), (m.match(QUOTA_UI) || [])[0]);
  h.act('dmc-open', { id: 'CL' });
  m = h.modal();
  assert(m.includes('Đã thiết lập mặt bằng') && m.includes('0909') && /Chưa chọn loại diện tích kinh doanh/.test(m));
  assert(!/data-act="(mb-|qh-)/.test(m), 'no layout setup action for admin');
  A.closeModal();
});
ok('6 existing market without scale: edit general info keeps "Chưa cập nhật" and new wording', () => {
  h.act('dmc-edit', { id: 'HA' });
  assert(/Có thể để trống thông tin quy mô nếu chưa có số liệu chính thức\. Loại diện tích kinh doanh được cấu hình theo thực tế áp dụng tại chợ\./.test(h.modal()));
  assert(!/mục B và C/.test(h.modal()));
  fill({ 'dmc-address': MC.get('HA').address, 'dmc-phone': '0277 000 111', 'dmc-total-area': '', 'dmc-business-area': '' }); pick([]);
  h.act('dmc-save', { id: 'HA' });
  assert.strictEqual(MC.get('HA').phone, '0277 000 111');
  assert.strictEqual(MC.get('HA').businessArea, null);
  assert.strictEqual(MC.get('HA').allowedAreaTypeIds, null);
});
const usageCL = MC.usage('CL');
ok('7 usage derived from business points', () => {
  assert(usageCL.covered && usageCL.covered.count > 0);
  const live = A.db.stalls.filter(s => s.market === 'CL' && s.areaType === 'covered' && s.structuralStatus !== 'MERGED' && s.structuralStatus !== 'SPLIT').length;
  assert.strictEqual(usageCL.covered.count, live);
});
const unusedCL = typeIds.filter(id => !(usageCL[id] && usageCL[id].count));
const usedCL = typeIds.filter(id => usageCL[id] && usageCL[id].count);
ok('8 (D/G) enable area types on a market with layout → saved; layout untouched', () => {
  assert(unusedCL.length, 'fixture: CL has an unused area type');
  const before = layoutSnap();
  h.act('dmc-edit', { id: 'CL' });
  assert(h.modal().includes(`${usageCL.covered.count.toLocaleString('vi-VN')} điểm đang sử dụng`), 'usage hint');
  fill({ 'dmc-address': MC.get('CL').address, 'dmc-total-area': 20000, 'dmc-business-area': 9000 });
  pick(typeIds);
  h.act('dmc-save', { id: 'CL' });
  eq(MC.get('CL').allowedAreaTypeIds, typeIds);
  assert.strictEqual(layoutSnap(), before, 'buildings/floors/rows/points unchanged');
});
ok('9 (E) removing an unused area type → saved', () => {
  h.act('dmc-edit', { id: 'CL' });
  eq(checkedInHtml(h.modal()), typeIds, 'form shows stored selection');
  const keep = typeIds.filter(id => id !== unusedCL[0]);
  pick(keep);
  h.act('dmc-save', { id: 'CL' });
  eq(MC.get('CL').allowedAreaTypeIds, keep);
});
ok('10 (F/G) removing an area type used by points is blocked; nothing changed', () => {
  const before = layoutSnap(), stored = JSON.stringify(MC.get('CL').allowedAreaTypeIds);
  h.act('dmc-edit', { id: 'CL' });
  pick(MC.get('CL').allowedAreaTypeIds.filter(id => id !== 'covered'));
  h.act('dmc-save', { id: 'CL' });
  assert.strictEqual(h.el('#dmc-err-areaTypes').innerHTML, U_esc("Không thể bỏ loại 'Có mái che' vì hiện có điểm kinh doanh đang sử dụng loại diện tích này."));
  assert.strictEqual(JSON.stringify(MC.get('CL').allowedAreaTypeIds), stored, 'not saved');
  assert.strictEqual(layoutSnap(), before, 'points not deleted / re-typed');
  usedCL.forEach(id => assert(MC.get('CL').allowedAreaTypeIds.includes(id)));
  A.closeModal();
});
function U_esc(s) { return A.U.esc(s); }
ok('11 editing general info keeps legacy manager and area types; cannot blank existing scale', () => {
  const before = JSON.stringify(MC.get('CL').allowedAreaTypeIds);
  const legacyManager = MC.get('CL').manager;
  h.act('dmc-edit', { id: 'CL' });
  pick(MC.get('CL').allowedAreaTypeIds);
  assert(!/dmc-manager|Tổ trưởng phụ trách/.test(h.modal()));
  h.act('dmc-save', { id: 'CL' });
  assert.strictEqual(MC.get('CL').manager, legacyManager);
  assert.strictEqual(JSON.stringify(MC.get('CL').allowedAreaTypeIds), before);
  h.act('dmc-edit', { id: 'CL' }); fill({ 'dmc-total-area': '', 'dmc-business-area': '' });
  h.act('dmc-save', { id: 'CL' });
  assert(/Vui lòng nhập tổng diện tích chợ/.test(h.el('#dmc-err-totalArea').innerHTML));
  fill({ 'dmc-total-area': 20000, 'dmc-business-area': 9000 });
  A.closeModal();
});
ok('12 (C) list / KPI / CSV: no "điểm tối đa" quota figures', () => {
  const v = view();
  assert(!/điểm tối đa|Chưa khai báo chỉ tiêu/.test(v));
  assert(/loại diện tích áp dụng/.test(v) && /chợ đã khai báo/.test(v));
});
ok('13 persistence: reload keeps area types and ids; accounts/permissions untouched (H)', () => {
  const saved = h.localStorage.getItem('choso-caolanh-marketcatalog');
  const h2 = createApp(root, { storage: { 'choso-caolanh-marketcatalog': saved } });
  const MC2 = h2.A.features.markets.service;
  eq(MC2.get('CL').allowedAreaTypeIds, MC.get('CL').allowedAreaTypeIds);
  assert.strictEqual(MC2.rows().length, 13);
  assert.strictEqual(h.localStorage.getItem('choso-caolanh-accounts'), accountsBefore);
  assert.strictEqual(h.localStorage.getItem('choso-caolanh-permissions'), permsBefore);
});
ok('14 (A) legacy capacityByAreaType → only area types with a declared quota are shown as applied', () => {
  const old = JSON.stringify([{ id: 'TTT', code: 'TTT', rank: 'HANG_3', unit: 'BQL', manager: '', phone: '', priceConfigId: 'QD480_NHOM_CON_LAI', status: 'active', totalArea: 2000, businessArea: 1200,
    capacityByAreaType: [{ areaTypeId: 'covered', maxPointCount: 10, maxArea: 100 }, { areaTypeId: 'uncovered', maxPointCount: 20, maxArea: 200 }, { areaTypeId: 'self_produced', maxPointCount: 0, maxArea: 0 }, { areaTypeId: 'session', maxPointCount: 0, maxArea: 0 }] }]);
  const h3 = createApp(root, { storage: { 'choso-caolanh-marketcatalog': old } }), A3 = h3.A, MC3 = A3.features.markets.service;
  login(A3, 'AC-QT01');
  eq(MC3.get('TTT').allowedAreaTypeIds, ['covered', 'uncovered']);
  h3.act('dmc-edit', { id: 'TTT' });
  eq(checkedInHtml(h3.modal()), ['covered', 'uncovered']);
  assert(!QUOTA_UI.test(h3.modal()) && !/>10<|>100<|>20<|>200</.test(h3.modal()));
  h3.act('dmc-open', { id: 'TTT' });
  assert(!QUOTA_UI.test(h3.modal()) && !/[^.\d](10|20) điểm|[^.\d](100|200) m²/.test(h3.modal()));
  // Legacy quota stays stored untouched (Mặt bằng still reads it — next task); save writes the new field only.
  h3.act('dmc-edit', { id: 'TTT' });
  h3.input('#dmc-address', MC3.get('TTT').address); h3.input('#dmc-total-area', '2000'); h3.input('#dmc-business-area', '1200');
  ['covered', 'uncovered', 'self_produced', 'session'].forEach(id => { h3.el('#dmc-at-' + id).checked = id !== 'uncovered'; });
  h3.act('dmc-save', { id: 'TTT' });
  const rec = JSON.parse(h3.localStorage.getItem('choso-caolanh-marketcatalog')).find(x => x.id === 'TTT');
  eq(rec.allowedAreaTypeIds, ['covered', 'self_produced', 'session']);
  eq(rec.capacityByAreaType, JSON.parse(old)[0].capacityByAreaType, 'legacy record not rewritten');
});
ok('15 RBAC: ward leader reads only, handlers refuse', () => {
  login(A, 'AC-LD01');
  const v = view();
  assert(!/dmc-new|dmc-edit/.test(v) && /dmc-open/.test(v));
  const n = MC.rows().length;
  A.$('#modal-root').innerHTML = '';
  h.act('dmc-new'); assert.strictEqual(h.modal(), '');
  h.act('dmc-save', { id: '' }); assert.strictEqual(MC.rows().length, n);
  h.act('dmc-open', { id: 'CL' }); assert(!/dmc-edit/.test(h.modal()));
  login(A, 'AC-QT01');
});
ok('16 (J) neighbouring screens still render', () => {
  login(A, 'AC-QT01');
  const mgr = A.ACCOUNTS.list().find(a => A.ACCOUNTS.primaryRole(a) === 'market_manager' && (a.marketScopes || []).includes('CL'));
  A.ui.sessionAccountId = mgr.id; A.ui.market = 'CL'; A.syncAccountContext();
  ['mat-bang', 'hop-dong', 'tieu-thuong', 'tai-chinh'].forEach(r => { if (!A.VIEWS[r]) return; h.go(r); assert(h.view().length > 100, r); });
});
console.log(`market-catalog regression PASS (${passed} checks)`);

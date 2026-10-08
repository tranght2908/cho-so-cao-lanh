/* Focused regression: "Danh mục chợ" — KPI, filters, create/edit form limited to step 1 (basic info,
 * image, scale; no phone/unit/price/area-type/status inputs), derived layout status and usage, area-type
 * catalog normalized to 3 types, backward compatibility of the catalog store (legacy capacityByAreaType,
 * priceConfigId, unit, phone, missing/corrupt image). */
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
const QUOTA_UI = /Số điểm tối đa|Diện tích tối đa|Hiện có trên mặt bằng|Tổng cộng|điểm tối đa|dmc-cap-|CHỈ TIÊU ĐIỂM KINH DOANH|Còn lại/;
const layoutSnap = () => JSON.stringify(['buildings', 'floors', 'rows', 'stalls'].map(k => A.db[k] || null));

ok('1 twelve markets kept, ids unchanged, legacy meta preserved', () => {
  const ids = MC.rows().map(r => r.id);
  IDS.forEach(id => assert(ids.includes(id), id));
  assert.strictEqual(MC.get('CL').code, 'CL');
  assert.strictEqual(MC.get('CL').phone, '0909', 'legacy market phone readable (not displayed)');
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
  const sqStatus = MC.get('SQ').status;
  MC.update('SQ', { status: 'NOT_ACTIVE' }, 't');
  A.CH['dmc-status']({ value: 'NOT_ACTIVE' }); assert.strictEqual(rowsInView(), MC.rows().filter(r => r.status === 'NOT_ACTIVE').length);
  MC.update('SQ', { status: sqStatus }, 't'); h.act('dmc-reset');
});
const PNG = 'data:image/png;base64,iVBORw0KGgo=';
const REMOVED_UI = /dmc-phone"|id="dmc-phone|Số điện thoại|dmc-at-|dmc-price|Bảng giá áp dụng|LOẠI DIỆN TÍCH KINH DOANH ÁP DỤNG|Theo phiên|Có mái che|Không mái che|Tự sản tự tiêu|id="dmc-status"|Đơn vị quản lý/;
ok('4 create form: basic info + scale only; no phone/unit/price/area-type/status inputs', () => {
  h.act('dmc-new');
  const m = h.modal();
  assert(/Thêm chợ mới/.test(m) && /A\. THÔNG TIN CHỢ/.test(m) && /B\. QUY MÔ CHỢ/.test(m));
  assert(!REMOVED_UI.test(m), 'removed field still rendered: ' + (m.match(REMOVED_UI) || [])[0]);
  assert(!QUOTA_UI.test(m), 'no quota UI');
  assert(/id="dmc-code" value="CHO\d+" readonly disabled/.test(m), 'code is system generated and read-only');
  ['dmc-name', 'dmc-address', 'dmc-rank', 'dmc-total-area', 'dmc-business-area'].forEach(id => assert(m.includes(`id="${id}"`), id));
  assert(/Tên chợ \*/.test(m) && /Địa điểm \*/.test(m) && /Tổng diện tích chợ \*/.test(m) && /Diện tích phục vụ kinh doanh \*/.test(m));
  assert(/Hạng 1/.test(m) && /Hạng 2/.test(m) && /Hạng 3/.test(m));
  assert(/Diện tích ngoài kinh doanh/.test(m) && /id="dmc-nonbiz"/.test(m) && !/id="dmc-nonbiz-input"|data-in="dmc-nonbiz"/.test(m), 'non-business area is derived only');
  assert(m.includes('Phần diện tích còn lại dành cho lối đi, khu quản lý, kỹ thuật và khu vực dùng chung.'));
  assert(/Ảnh đại diện chợ/.test(m) && /Chưa có ảnh đại diện/.test(m) && /data-ch="dmc-image"/.test(m) && /accept="\.jpg,\.jpeg,\.png/.test(m), 'image upload with placeholder');
  assert(/Trạng thái<\/span><span class="tag warn">Chưa hoạt động<\/span>/.test(m), 'status read-only Chưa hoạt động');
  assert(m.includes('Chợ chỉ chuyển sang hoạt động sau khi hoàn tất thiết lập mặt bằng'));
  assert(/data-act="dmc-save"[^>]*>Lưu chợ</.test(m) && /data-act="close">Hủy</.test(m));
});
ok('4b create: validation, then saves only basic info; nothing auto-assigned', () => {
  const n = MC.rows().length, graphBefore = layoutSnap(), cfgBefore = h.localStorage.getItem('choso-caolanh-serviceconfig');
  fill({ 'dmc-name': 'Chợ Thử', 'dmc-address': 'Khóm 1', 'dmc-total-area': 1000, 'dmc-business-area': 1200 });
  h.act('dmc-save', { id: '' });
  assert(/không được lớn hơn tổng diện tích/.test(h.el('#dmc-err-businessArea').innerHTML), 'businessArea > totalArea blocked');
  assert.strictEqual(MC.rows().length, n, 'nothing saved while invalid');
  fill({ 'dmc-business-area': 800 });
  A.ui.dmcImageDraft = { name: 'cho.png', type: 'image/png', dataUrl: PNG };
  h.act('dmc-save', { id: '' });
  assert.strictEqual(MC.rows().length, n + 1);
  const r = MC.rows()[n];
  assert(/^CHO\d+$/.test(r.code) && !IDS.includes(r.code));
  assert.strictEqual(r.totalArea, 1000); assert.strictEqual(r.businessArea, 800); assert.strictEqual(r.nonBusinessArea, 200);
  assert.strictEqual(r.status, 'NOT_ACTIVE'); assert.strictEqual(r.layoutStatus, 'PENDING_SETUP'); assert(!MC.layoutReady(r.id));
  assert.strictEqual(r.priceConfigId, null, 'no price table assigned');
  assert.strictEqual(r.allowedAreaTypeIds, null, 'no area types created');
  assert.strictEqual(r.capacityByAreaType, null, 'no quota stored');
  assert.strictEqual(r.manager, '');
  assert.strictEqual(MC.managementUnit(r), 'Tổ Quản lý chợ', 'shared unit is derived, not stored');
  assert.strictEqual(r.image.dataUrl, PNG);
  const stored = JSON.parse(h.localStorage.getItem('choso-caolanh-marketcatalog')).find(x => x.id === r.id);
  assert(!('unit' in stored) && !('phone' in stored) && stored.image.dataUrl === PNG && !/maxPointCount|maxArea/.test(JSON.stringify(stored)));
  assert.strictEqual(layoutSnap(), graphBefore, 'no business points/layout created');
  assert.strictEqual(h.localStorage.getItem('choso-caolanh-serviceconfig'), cfgBefore, 'no fee configuration created');
  assert(/Thêm chợ thành công/.test(h.trace.toasts.at(-1)));
  const uiMarket = A.ui.market, route = A.current;
  assert(!/data-act="dmc-goto-layout"|Thiết lập mặt bằng/.test(h.modal()), 'success toast only, no layout CTA');
  assert.strictEqual(A.ui.market, uiMarket, 'selectedMarket unchanged'); assert.strictEqual(A.current, route, 'no navigation');
  A.closeModal();
  assert(view().includes('Chợ Thử') && /Chưa thiết lập/.test(view()));
});
ok('4c image: only JPG/JPEG/PNG accepted; change/remove before saving', () => {
  h.act('dmc-new');
  A.CH['dmc-image']({ files: [{ name: 'a.gif', type: 'image/gif', size: 100 }], value: 'a.gif' });
  assert(/Chỉ chấp nhận ảnh JPG, JPEG hoặc PNG/.test(h.el('#dmc-err-image').innerHTML));
  A.CH['dmc-image']({ files: [{ name: 'a.png', type: 'image/png', size: 11 * 1024 * 1024 }], value: 'a.png' });
  assert(/vượt quá 10 MB/.test(h.el('#dmc-err-image').innerHTML));
  assert.strictEqual(A.ui.dmcImageDraft, null);
  A.ui.dmcImageDraft = { name: 'cho.png', type: 'image/png', dataUrl: PNG };
  h.act('dmc-image-remove');
  assert.strictEqual(A.ui.dmcImageDraft, null);
  assert(/Chưa có ảnh đại diện/.test(h.el('#dmc-image-box').innerHTML), 'placeholder after removing');
  A.closeModal();
});
ok('5 detail modal: image/placeholder, no area-type or price sections', () => {
  h.act('dmc-open', { id: MC.rows().at(-1).id });
  let m = h.modal();
  ['A. THÔNG TIN CHỢ', 'B. QUY MÔ CHỢ', 'C. TÌNH TRẠNG MẶT BẰNG'].forEach(s => assert(m.includes(s), s));
  assert(m.includes(`src="${PNG}"`), 'saved image displayed');
  assert(!/LOẠI DIỆN TÍCH KINH DOANH ÁP DỤNG|Bảng giá áp dụng|Hạng mục|Đơn giá|QĐ 480/.test(m));
  assert(!QUOTA_UI.test(m), (m.match(QUOTA_UI) || [])[0]);
  h.act('dmc-open', { id: 'CL' });
  m = h.modal();
  assert(m.includes('<span class="tag ok">Đã thiết lập</span>') && /Chưa có ảnh đại diện/.test(m), 'legacy market uses placeholder');
  assert(!m.includes('0909') && !/Số điện thoại/.test(m), 'legacy market phone is not displayed');
  assert(!/data-act="(mb-|qh-)/.test(m), 'no layout setup action for admin');
  A.closeModal();
});
ok('6 existing market without scale: update requires valid scale; legacy phone kept, not editable', () => {
  const haPhone = MC.get('HA').phone;
  h.act('dmc-edit', { id: 'HA' });
  assert(!REMOVED_UI.test(h.modal()), 'edit form has no phone input');
  fill({ 'dmc-name': MC.get('HA').name, 'dmc-address': MC.get('HA').address, 'dmc-total-area': '', 'dmc-business-area': '' });
  h.act('dmc-save', { id: 'HA' });
  assert(/Vui lòng nhập tổng diện tích chợ/.test(h.el('#dmc-err-totalArea').innerHTML));
  assert.strictEqual(MC.get('HA').businessArea, null);
  fill({ 'dmc-total-area': 1000, 'dmc-business-area': 600 });
  h.act('dmc-save', { id: 'HA' });
  assert.strictEqual(MC.get('HA').phone, haPhone, 'legacy phone value untouched');
  assert.strictEqual(MC.get('HA').businessArea, 600);
  assert.strictEqual(MC.get('HA').allowedAreaTypeIds, null, 'area types not touched');
  assert.strictEqual(MC.get('HA').image, null);
});
const usageCL = MC.usage('CL');
ok('7 usage derived from business points', () => {
  assert(usageCL.covered && usageCL.covered.count > 0);
  const live = A.db.stalls.filter(s => s.market === 'CL' && s.areaType === 'covered' && s.structuralStatus !== 'MERGED' && s.structuralStatus !== 'SPLIT').length;
  assert.strictEqual(usageCL.covered.count, live);
});
ok('8 edit market with layout: status read-only, legacy price/area-type fields and layout untouched', () => {
  MC.update('CL', { allowedAreaTypeIds: ['covered', 'uncovered'] }, 'seed-test');
  const before = layoutSnap(), cl = MC.get('CL');
  h.act('dmc-edit', { id: 'CL' });
  const m = h.modal();
  assert(/Chỉnh sửa chợ/.test(m) && !REMOVED_UI.test(m), (m.match(REMOVED_UI) || [])[0]);
  assert(m.includes(`<span>Trạng thái</span><span class="tag ${MC.STATUS[cl.status][1]}">${MC.STATUS[cl.status][0]}</span>`), 'current status shown read-only');
  fill({ 'dmc-name': cl.name, 'dmc-address': cl.address, 'dmc-total-area': 20000, 'dmc-business-area': 9000 });
  A.ui.dmcImageDraft = { name: 'cl.jpg', type: 'image/jpeg', dataUrl: 'data:image/jpeg;base64,/9j/4AAQ' };
  h.act('dmc-save', { id: 'CL' });
  const after = MC.get('CL');
  assert.strictEqual(after.status, cl.status); assert.strictEqual(after.layoutStatus, cl.layoutStatus);
  assert.strictEqual(after.priceConfigId, cl.priceConfigId);
  eq(after.allowedAreaTypeIds, ['covered', 'uncovered']);
  assert.strictEqual(after.code, 'CL');
  assert.strictEqual(after.image.name, 'cl.jpg');
  assert.strictEqual(layoutSnap(), before, 'buildings/floors/rows/points unchanged');
});
ok('9 edit: image can be removed', () => {
  h.act('dmc-edit', { id: 'CL' });
  assert.strictEqual(A.ui.dmcImageDraft.name, 'cl.jpg', 'form starts from stored image');
  h.act('dmc-image-remove');
  h.act('dmc-save', { id: 'CL' });
  assert.strictEqual(MC.get('CL').image, null);
});
ok('10 area-type catalog normalized to 3 types; legacy Theo phiên kept for reading only', () => {
  eq(A.U.AREA_TYPE_CODES, ['covered', 'uncovered', 'self_produced']);
  eq(MC.areaTypes().map(t => t.label), ['Có mái che', 'Không mái che', 'Tự sản tự tiêu']);
  assert.strictEqual(A.U.areaTypeLabel('session'), 'Theo phiên', 'legacy points still have a label');
  assert(!A.features.marketLayout.store.allowedAreaTypes('HA').includes('session'));
  assert(A.U.KNOWN_AREA_TYPE_CODES.includes('session'));
});
function U_esc(s) { return A.U.esc(s); }
ok('11 editing general info keeps legacy manager; cannot blank existing scale', () => {
  const legacyManager = MC.get('CL').manager;
  h.act('dmc-edit', { id: 'CL' });
  h.input('#dmc-name', MC.get('CL').name);
  assert(!/dmc-manager|Tổ trưởng phụ trách/.test(h.modal()));
  h.act('dmc-save', { id: 'CL' });
  assert.strictEqual(MC.get('CL').manager, legacyManager);
  h.act('dmc-edit', { id: 'CL' }); fill({ 'dmc-name': MC.get('CL').name, 'dmc-total-area': '', 'dmc-business-area': '' });
  h.act('dmc-save', { id: 'CL' });
  assert(/Vui lòng nhập tổng diện tích chợ/.test(h.el('#dmc-err-totalArea').innerHTML));
  fill({ 'dmc-total-area': 20000, 'dmc-business-area': 9000 });
  A.closeModal();
});
ok('11b a market name may be updated while its immutable code remains unchanged', () => {
  const beforeCode = MC.get('CL').code;
  h.act('dmc-edit', { id: 'CL' });
  fill({ 'dmc-name': 'Chợ Cao Lãnh cập nhật', 'dmc-address': MC.get('CL').address, 'dmc-total-area': 20000, 'dmc-business-area': 9000 });
  h.act('dmc-save', { id: 'CL' });
  assert.strictEqual(MC.get('CL').name, 'Chợ Cao Lãnh cập nhật');
  assert.strictEqual(MC.get('CL').code, beforeCode);
});
ok('12 list / KPI: no area-type or quota figures', () => {
  const v = view();
  assert(!/điểm tối đa|Chưa khai báo chỉ tiêu|loại diện tích áp dụng|Chưa chọn loại diện tích/.test(v));
  assert(/chợ đã khai báo/.test(v));
});
ok('13 persistence: reload keeps new market + image and ids; accounts/permissions untouched (H)', () => {
  const saved = h.localStorage.getItem('choso-caolanh-marketcatalog');
  const h2 = createApp(root, { storage: { 'choso-caolanh-marketcatalog': saved } });
  const MC2 = h2.A.features.markets.service;
  eq(MC2.get('CL').allowedAreaTypeIds, MC.get('CL').allowedAreaTypeIds);
  assert.strictEqual(MC2.rows().length, 13);
  const created = MC2.rows().at(-1);
  assert.strictEqual(created.image.dataUrl, PNG);
  assert.strictEqual(created.status, 'NOT_ACTIVE');
  assert.strictEqual(h.localStorage.getItem('choso-caolanh-accounts'), accountsBefore);
  assert.strictEqual(h.localStorage.getItem('choso-caolanh-permissions'), permsBefore);
});
ok('14 (A) legacy record (capacityByAreaType with session, corrupt image) loads and is preserved on save', () => {
  const old = JSON.stringify([{ id: 'TTT', code: 'TTT', rank: 'HANG_3', unit: 'BQL', manager: '', phone: '', priceConfigId: 'QD480_NHOM_CON_LAI', status: 'active', totalArea: 2000, businessArea: 1200, image: 'not-a-data-url',
    capacityByAreaType: [{ areaTypeId: 'covered', maxPointCount: 10, maxArea: 100 }, { areaTypeId: 'uncovered', maxPointCount: 20, maxArea: 200 }, { areaTypeId: 'self_produced', maxPointCount: 0, maxArea: 0 }, { areaTypeId: 'session', maxPointCount: 5, maxArea: 50 }] }]);
  const h3 = createApp(root, { storage: { 'choso-caolanh-marketcatalog': old } }), A3 = h3.A, MC3 = A3.features.markets.service;
  login(A3, 'AC-QT01');
  eq(MC3.get('TTT').allowedAreaTypeIds, ['covered', 'uncovered'], 'retired session type ignored on read');
  assert.strictEqual(MC3.get('TTT').image, null, 'corrupt image → placeholder');
  h3.go('danh-muc-cho'); assert(h3.view().length > 100);
  h3.act('dmc-open', { id: 'TTT' });
  assert(/Chưa có ảnh đại diện/.test(h3.modal()) && !QUOTA_UI.test(h3.modal()));
  h3.act('dmc-edit', { id: 'TTT' });
  assert(!REMOVED_UI.test(h3.modal()) && !QUOTA_UI.test(h3.modal()));
  h3.input('#dmc-name', MC3.get('TTT').name); h3.input('#dmc-address', MC3.get('TTT').address); h3.input('#dmc-total-area', '2000'); h3.input('#dmc-business-area', '1200');
  h3.act('dmc-save', { id: 'TTT' });
  const rec = JSON.parse(h3.localStorage.getItem('choso-caolanh-marketcatalog')).find(x => x.id === 'TTT');
  eq(rec.capacityByAreaType, JSON.parse(old)[0].capacityByAreaType, 'legacy quota not rewritten');
  assert.strictEqual(rec.priceConfigId, 'QD480_NHOM_CON_LAI', 'legacy price table kept');
  assert.strictEqual(rec.unit, 'BQL', 'legacy unit value kept (display uses the shared unit)');
  assert(!('allowedAreaTypeIds' in rec), 'no area types written');
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
  const mgr = A.ACCOUNTS.currentList().find(a => A.ACCOUNTS.primaryRole(a) === 'market_manager' && (a.marketScopes || []).some(scope => scope === 'ALL' || scope === 'CL'));
  A.ui.sessionAccountId = mgr.id; A.ui.market = 'CL'; A.syncAccountContext();
  ['mat-bang', 'hop-dong', 'tieu-thuong', 'tai-chinh'].forEach(r => { if (!A.VIEWS[r]) return; h.go(r); assert(h.view().length > 100, r); });
});
console.log(`market-catalog regression PASS (${passed} checks)`);

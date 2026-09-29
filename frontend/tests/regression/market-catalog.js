/* Focused regression: "Danh mục chợ" — KPI, filters, scale & capacity by area type (add/edit/validation),
 * derived layout status and derived usage, backward compatibility of the catalog store. */
const assert = require('assert');
const path = require('path');
const { createApp } = require('./harness');
const root = path.resolve(__dirname, '../..');
const login = (A, id) => { A.ui.sessionAccountId = id; A.ui.market = 'ALL'; A.syncAccountContext(); };
let passed = 0;
const ok = (label, fn) => { try { fn(); passed++; } catch (e) { e.message = label + ': ' + e.message; throw e; } };

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
const capIds = MC.areaTypes().map(t => t.id);
const clearCap = () => capIds.forEach(id => fill({ ['dmc-cap-count-' + id]: '', ['dmc-cap-area-' + id]: '' }));

ok('1 twelve markets kept, ids unchanged, legacy meta preserved', () => {
  const ids = MC.rows().map(r => r.id);
  IDS.forEach(id => assert(ids.includes(id), id));
  assert.strictEqual(MC.get('CL').code, 'CL');
  assert.strictEqual(MC.get('CL').phone, '0909');
  assert.strictEqual(MC.get('CL').totalArea, null);
  assert.strictEqual(MC.get('CL').capacityByAreaType, null);
  assert.strictEqual(rowsInView(), 12);
  assert(/Tổng số chợ/.test(view()) && /Chưa thiết lập mặt bằng/.test(view()));
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
ok('4 create: validation then valid save with generated code', () => {
  h.act('dmc-new');
  assert(/A\. THÔNG TIN CHUNG/.test(h.modal()) && /B\. QUY MÔ CHỢ/.test(h.modal()) && /C\. CHỈ TIÊU ĐIỂM KINH DOANH/.test(h.modal()));
  capIds.forEach(id => assert(h.modal().includes('dmc-cap-count-' + id)));
  const n = MC.rows().length;
  fill({ 'dmc-name': 'Chợ Thử', 'dmc-address': 'Khóm 1', 'dmc-total-area': 1000, 'dmc-business-area': 1200 }); clearCap();
  h.act('dmc-save', { id: '' });
  assert(/không được lớn hơn tổng diện tích/.test(h.el('#dmc-err-businessArea').innerHTML), 'businessArea > totalArea blocked');
  fill({ 'dmc-business-area': 800, 'dmc-cap-count-covered': 50, 'dmc-cap-area-covered': 700, 'dmc-cap-area-uncovered': 400 });
  h.act('dmc-save', { id: '' });
  assert(/Tổng diện tích chỉ tiêu đang vượt 300 m² so với diện tích phục vụ kinh doanh/.test(h.el('#dmc-err-table').innerHTML), h.el('#dmc-err-table').innerHTML);
  fill({ 'dmc-cap-area-uncovered': 100, 'dmc-cap-count-uncovered': -1 });
  h.act('dmc-save', { id: '' });
  assert(/số nguyên không âm/.test(h.el('#dmc-err-cap-uncovered').innerHTML));
  fill({ 'dmc-cap-count-uncovered': 10, 'dmc-cap-area-uncovered': -5 });
  h.act('dmc-save', { id: '' });
  assert(/không âm/.test(h.el('#dmc-err-cap-uncovered').innerHTML));
  assert.strictEqual(MC.rows().length, n, 'nothing saved while invalid');
  fill({ 'dmc-cap-area-uncovered': 100 });
  h.act('dmc-save', { id: '' });
  assert.strictEqual(MC.rows().length, n + 1);
  const r = MC.rows()[n];
  assert(/^CHO\d+$/.test(r.code) && !IDS.includes(r.code));
  assert.strictEqual(r.totalArea, 1000); assert.strictEqual(r.businessArea, 800);
  assert.strictEqual(JSON.stringify(MC.capacityTotals(r)), JSON.stringify({ maxPointCount: 60, maxArea: 800 }));
  assert(!MC.layoutReady(r.id));
  assert(/Thêm chợ thành công/.test(h.trace.toasts.at(-1)));
});
ok('5 detail modal sections', () => {
  h.act('dmc-open', { id: 'CL' });
  const m = h.modal();
  ['A. THÔNG TIN CHUNG', 'B. QUY MÔ CHỢ', 'C. CHỈ TIÊU ĐIỂM KINH DOANH', 'D. TÌNH TRẠNG MẶT BẰNG', 'Đã thiết lập mặt bằng', 'Đã số hóa', 'Còn lại', '0909'].forEach(s => assert(m.includes(s), s));
  assert(!/data-act="(mb-|qh-)/.test(m), 'no layout setup action for admin');
});
const usageCL = MC.usage('CL');
const capFor = (over) => { const c = {}; capIds.forEach(id => { const u = usageCL[id] || { count: 0, area: 0 }; c[id] = { count: u.count + 10, area: Math.ceil(u.area) + 50 }; }); return Object.assign(c, over || {}); };
const fillCap = c => capIds.forEach(id => fill({ ['dmc-cap-count-' + id]: c[id].count, ['dmc-cap-area-' + id]: c[id].area }));
ok('6 existing market without scale: edit general info keeps "Chưa cập nhật"', () => {
  h.act('dmc-edit', { id: 'HA' }); fill({ 'dmc-address': MC.get('HA').address });
  fill({ 'dmc-phone': '0277 000 111', 'dmc-total-area': '', 'dmc-business-area': '' }); clearCap();
  h.act('dmc-save', { id: 'HA' });
  assert.strictEqual(MC.get('HA').phone, '0277 000 111');
  assert.strictEqual(MC.get('HA').businessArea, null);
});
ok('7 usage derived from business points', () => {
  assert(usageCL.covered && usageCL.covered.count > 0);
  const live = A.db.stalls.filter(s => s.market === 'CL' && s.areaType === 'covered' && s.structuralStatus !== 'MERGED' && s.structuralStatus !== 'SPLIT').length;
  assert.strictEqual(usageCL.covered.count, live);
});
ok('8 capacity below existing layout is blocked, equal allowed, increase allowed', () => {
  h.act('dmc-edit', { id: 'CL' }); fill({ 'dmc-address': MC.get('CL').address });
  const c = capFor();
  const sum = capIds.reduce((s, id) => s + c[id].area, 0);
  fill({ 'dmc-total-area': sum + 2000, 'dmc-business-area': sum + 500 }); fillCap(c);
  c.covered = { count: usageCL.covered.count - 5, area: c.covered.area }; fillCap(c);
  h.act('dmc-save', { id: 'CL' });
  assert(h.el('#dmc-err-cap-covered').innerHTML.includes(`Không thể giảm xuống ${(usageCL.covered.count - 5).toLocaleString('vi-VN')} điểm vì mặt bằng hiện có ${usageCL.covered.count.toLocaleString('vi-VN')} điểm thuộc loại diện tích này.`), h.el('#dmc-err-cap-covered').innerHTML);
  c.covered = { count: usageCL.covered.count, area: Math.floor(usageCL.covered.area) - 1 }; fillCap(c);
  h.act('dmc-save', { id: 'CL' });
  assert(/Không thể giảm xuống .* m² vì mặt bằng hiện có/.test(h.el('#dmc-err-cap-covered').innerHTML));
  assert.strictEqual(MC.get('CL').capacityByAreaType, null, 'not saved');
  c.covered = { count: usageCL.covered.count, area: Math.ceil(usageCL.covered.area) }; fillCap(c);
  h.act('dmc-save', { id: 'CL' });
  assert.strictEqual(MC.get('CL').capacityByAreaType.find(x => x.areaTypeId === 'covered').maxPointCount, usageCL.covered.count, 'equal to existing allowed');
  h.act('dmc-edit', { id: 'CL' }); fill({ 'dmc-address': MC.get('CL').address });
  c.covered = { count: usageCL.covered.count + 20, area: Math.ceil(usageCL.covered.area) + 30 }; fillCap(c);
  fill({ 'dmc-total-area': sum + 2000, 'dmc-business-area': sum + 500 });
  h.act('dmc-save', { id: 'CL' });
  assert.strictEqual(MC.get('CL').capacityByAreaType.find(x => x.areaTypeId === 'covered').maxPointCount, usageCL.covered.count + 20, 'increase allowed');
});
ok('9 editing general info keeps capacity; cannot blank existing scale', () => {
  const before = JSON.stringify(MC.get('CL').capacityByAreaType);
  h.act('dmc-edit', { id: 'CL' }); // form is prefilled from the stored record (harness keeps values set earlier)
  fill({ 'dmc-manager': 'Tổ trưởng mới' });
  h.act('dmc-save', { id: 'CL' });
  assert.strictEqual(MC.get('CL').manager, 'Tổ trưởng mới');
  assert.strictEqual(JSON.stringify(MC.get('CL').capacityByAreaType), before);
  h.act('dmc-edit', { id: 'CL' }); fill({ 'dmc-address': MC.get('CL').address });
  fill({ 'dmc-total-area': '', 'dmc-business-area': '' });
  h.act('dmc-save', { id: 'CL' });
  assert(/Vui lòng nhập tổng diện tích chợ/.test(h.el('#dmc-err-totalArea').innerHTML));
  assert.strictEqual(JSON.stringify(MC.get('CL').capacityByAreaType), before);
  A.closeModal();
});
ok('10 persistence: reload keeps scale and ids; accounts/permissions untouched', () => {
  const saved = h.localStorage.getItem('choso-caolanh-marketcatalog');
  const h2 = createApp(root, { storage: { 'choso-caolanh-marketcatalog': saved } });
  const MC2 = h2.A.features.markets.service;
  assert.strictEqual(JSON.stringify(MC2.get('CL').capacityByAreaType), JSON.stringify(MC.get('CL').capacityByAreaType));
  assert.strictEqual(MC2.rows().length, 13);
  assert.strictEqual(h.localStorage.getItem('choso-caolanh-accounts'), accountsBefore);
  assert.strictEqual(h.localStorage.getItem('choso-caolanh-permissions'), permsBefore);
});
ok('11 RBAC: ward leader reads only, handlers refuse', () => {
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
ok('12 neighbouring screens still render', () => {
  login(A, 'AC-QT01');
  const mgr = A.ACCOUNTS.list().find(a => A.ACCOUNTS.primaryRole(a) === 'market_manager' && (a.marketScopes || []).includes('CL'));
  A.ui.sessionAccountId = mgr.id; A.ui.market = 'CL'; A.syncAccountContext();
  ['mat-bang', 'hop-dong', 'tieu-thuong'].forEach(r => { h.go(r); assert(h.view().length > 100, r); });
});
console.log(`market-catalog regression PASS (${passed} checks)`);

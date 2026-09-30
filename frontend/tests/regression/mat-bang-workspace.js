/* Focused regression: "Mặt bằng & điểm kinh doanh" workspace on data model v16 — navigation tree
 * (Chợ → Khối/Nhà → Tầng? → Dãy, no points, ⋮ menus by hierarchy), logic diagram per selection + inspector,
 * Sơ đồ | Danh sách scoped by selection, area budget (no per-type quota), buildings without floors, empty
 * market (no wizard), data safety. Build-as-you-go scenario: mat-bang-builder.js. */
const assert = require('assert');
const path = require('path');
const { createApp } = require('./harness');
const root = path.resolve(__dirname, '../..');
let passed = 0;
const ok = (label, fn) => { try { fn(); passed++; } catch (e) { e.message = label + ': ' + e.message; throw e; } };

const h = createApp(root), A = h.A, db = A.db, S = A.features.marketLayout.store, MC = A.features.markets.service;
const mgr = mid => A.ACCOUNTS.list().find(a => A.ACCOUNTS.primaryRole(a) === 'market_manager' && (a.marketScopes || []).includes(mid));
const use = (acc, mid) => { A.ui.sessionAccountId = acc.id || acc; A.ui.market = mid; A.syncAccountContext(); };
// Re-render in place: re-entering #/mat-bang resets Sơ đồ/Bảng to the route default (Sơ đồ).
const go = () => { if (A.current !== 'mat-bang') h.go('mat-bang'); else { A.render(); h.flush(); } return h.view(); };
const tree = () => { const v = go(); const a = v.indexOf('role="tree"'); return v.slice(a, v.indexOf('<div class="mb-ws">')); };
const ws = () => { const v = go(); return v.slice(v.indexOf('<div class="mb-ws">')); };
const insp = () => { const v = go(); return v.slice(v.indexOf('<aside class="card mb-insp"')); };
const text = html => html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
const count = (html, re) => (html.match(re) || []).length;
const sel = (k, id) => h.act(k === 'overview' ? 'mb-sel-overview' : 'mb-sel-' + k, { id });
const layoutBefore = h.localStorage.getItem('choso-caolanh-layout');

use(mgr('CL'), 'CL'); A.ui.mb.view = 'grid'; A.ui.mb.sel = null;

ok('1–5 CL tree: Khối/Nhà → Tầng → Dãy, Khu ngoài nhà lồng without floor node, no points, no legacy wording', () => {
  const t = tree(), tt = text(t);
  assert.strictEqual(count(t, /mb-tnode-building/g), 2);
  assert.strictEqual(count(t, /mb-tnode-floor/g), 2, 'only the 2 real floors of Nhà chợ chính');
  assert.strictEqual(count(t, /mb-tnode-row/g), db.rows.filter(r => r.market === 'CL').length);
  assert(tt.includes('Dãy thủy hải sản A') && tt.includes('HS-A · Thủy hải sản'));
  const nnlRows = db.rows.filter(r => r.market === 'CL' && !r.floorId);
  nnlRows.forEach(r => assert(new RegExp(`mb-tnode-row[^"]*" style="--d:1">[\\s\\S]*?data-id="${r.id}"`).test(t), r.id + ' directly under its building'));
  assert(!/HS-A0\d|KA-A0\d/.test(t), 'points are not rendered in the tree');
  assert(!/\+ Khu|>Sửa<|>Xóa<|✎|🗑|Không chia tầng|zone|section/i.test(t), 'no legacy labels / inline edit-delete / fake floor');
  assert(/data-act="qh-add-block">\+ Khối\/Nhà</.test(go()) && !/qh-add-block"[^>]*>\+ Khu/.test(go()));
});
ok('6 Chợ: building blocks with floors/areas, inspector counts, no faked budget', () => {
  sel('overview'); const w = text(ws());
  assert(w.includes('Sơ đồ mặt bằng') && w.includes('Nhà chợ chính') && w.includes('Tầng 1 420 m²') && w.includes('Khu ngoài nhà lồng'));
  ['Khối/Nhà 2', 'Tầng 2', 'Dãy 10', 'Điểm kinh doanh 49'].forEach(s => assert(text(insp()).includes(s), s));
  const v = text(go());
  assert(v.includes('Chợ chưa khai báo diện tích phục vụ kinh doanh trong Danh mục chợ') && v.includes('2 Khối/Nhà chưa khai báo diện tích phân bổ.'));
  assert(!/data-act="stall"/.test(ws()), 'market level shows blocks, not every point');
});
ok('20 market area budget from Danh mục chợ; the legacy per-type quota is not shown any more', () => {
  MC.update('CL', { totalArea: 20435, businessArea: 1000, capacityByAreaType: [{ areaTypeId: 'covered', maxPointCount: 100, maxArea: 600 }, { areaTypeId: 'uncovered', maxPointCount: 5, maxArea: 20 }, { areaTypeId: 'self_produced', maxPointCount: 0, maxArea: 0 }, { areaTypeId: 'session', maxPointCount: 0, maxArea: 0 }] }, 'test');
  const v = text(go());
  assert(v.includes('Diện tích phục vụ kinh doanh 1.000 m²') && v.includes('Đã phân bổ 0 m²') && v.includes('Còn lại 1.000 m²'));
  assert(!/Vượt chỉ tiêu|Chỉ tiêu|điểm tối đa/.test(v), 'no quota per area type');
  assert(!/data-act="dmc-edit"|capacityByAreaType/.test(ws()), 'no catalog editing on this screen');
});
const ncc = db.buildings.find(b => b.code === 'NCC'), nnl = db.buildings.find(b => b.code === 'NNL');
const t1 = db.floors.find(f => f.code === 'T1');
ok('7 Khối/Nhà: breadcrumb, floor blocks listing their Dãy with areas; floor-less building shows its Dãy', () => {
  sel('building', ncc.id); let w = ws(), wt = text(w);
  assert(/Chợ Cao Lãnh \/ Nhà chợ chính/.test(wt) && wt.includes('Tầng 1 420 m²') && wt.includes('Dãy thủy hải sản A 36 m²'));
  assert(text(insp()).includes('Mô hình 2 tầng') && text(insp()).includes('Số Dãy 8'));
  sel('building', nnl.id); w = ws(); wt = text(w);
  assert(wt.includes('Không chia tầng') && count(w, /class="mb-rowtile"/g) === 2 && !wt.includes('Tầng 1'));
});
ok('8 Tầng: area budget, + Thêm Dãy, row tiles with code/industry/area/points', () => {
  sel('floor', t1.id); const w = ws(), wt = text(w);
  assert(/Chợ Cao Lãnh \/ Nhà chợ chính \/ Tầng 1/.test(wt));
  ['Diện tích tầng 420 m²', 'Đã phân bổ cho Dãy 224 m²', 'Còn lại 196 m²', 'Số Dãy 5'].forEach(s => assert(wt.includes(s), s));
  assert(/\+ Thêm Dãy/.test(w) && count(w, /class="mb-rowtile"/g) === 5);
  assert(wt.includes('Dãy thủy hải sản A') && wt.includes('HS-A · Thủy hải sản') && wt.includes('36 m² 6 điểm'));
});
ok('9–10 Dãy: header, inspector area/points, actions in place, diagram limited to the row', () => {
  sel('row', 'CL-R-HS-A'); const w = ws(), wt = text(w);
  assert(/Chợ Cao Lãnh \/ Nhà chợ chính \/ Tầng 1 \/ Dãy HS-A/.test(wt));
  assert(wt.includes('Dãy thủy hải sản A') && wt.includes('HS-A · Thủy hải sản'));
  ['Diện tích phân bổ 36 m²', 'Đã sử dụng 29 m²', 'Còn lại 7 m²', '6 điểm'].forEach(s => assert(text(insp()).includes(s), s));
  assert(/data-act="mb-add-point"/.test(w) && /data-act="qh-zone-edit-open"/.test(w) && !/mb-assign-collector|NV thu phí/.test(w));
  const cells = (w.match(/data-act="stall" data-id="([^"]+)"/g) || []).map(x => x.split('"')[3]);
  assert.strictEqual(cells.sort().join(), db.stalls.filter(s => s.rowId === 'CL-R-HS-A').map(s => s.id).sort().join());
});
ok('11–12 Danh sách scoped by selection; standard columns; search/filter still work', () => {
  h.act('mb-view', { id: 'table' });
  sel('floor', t1.id);
  // Bảng nằm ở vùng giữa; inspector bên phải có nhãn riêng (vd Ngành hàng) nên không tính vào.
  const center = () => { const v = ws(); return v.slice(0, v.indexOf('<aside class="card mb-insp"')); };
  let w = center();
  ['Mã điểm', 'Vị trí', 'Diện tích (m²)', 'Loại diện tích', 'Ngành hàng', 'Tình trạng'].forEach(c => assert(w.includes(c), c));
  assert(!w.includes('NV thu phí phụ trách'));
  assert(!/TS-A0\d/.test(w) && /HS-A01/.test(w) && text(w).includes('Dãy HS-A'), 'floor scope, location without repeating the floor');
  sel('row', 'CL-R-HS-A'); w = center();
  assert(!/mb-col-location">Vị trí/.test(w) && !/>Ngành hàng</.test(w), 'row scope hides repeated location / industry');
  assert.strictEqual(A.mbCurrentPoints('CL').length, 6);
  A.IN['mb-filter-search']({ value: 'HS-A03' }); assert.strictEqual(A.mbCurrentPoints('CL').length, 1);
  h.act('dkcl-clear'); A.CH['mb-filter-area-type']({ value: 'uncovered' }); assert.strictEqual(A.mbCurrentPoints('CL').length, 2);
  h.act('dkcl-clear'); h.act('mb-view', { id: 'grid' });
});
ok('13–19 point detail opens; display status / area type / location / industry all derived', () => {
  const st = A.idx.stall.get('CL-HS-A03');
  h.act('stall', { id: st.id }); assert(h.modal().includes('HS-A03')); A.closeModal();
  assert.strictEqual(A.pointDisplayStatus(st), 'no', 'debt from finance');
  assert.strictEqual(A.pointDisplayStatus(A.idx.stall.get('CL-HS-A06')), 'trong');
  assert.strictEqual(A.pointDisplayStatus(A.idx.stall.get('CL-TG-A05')), 'tranhchap');
  const w = go(), chips = A.mbMarketStats('CL').byStatus;
  assert(new RegExp(`<b>${chips.thue}</b>Đang thuê`).test(w) && new RegExp(`<b>${chips.no}</b>Nợ phí`).test(w));
  sel('row', 'CL-R-HS-A'); assert(!text(ws()).includes('NV thu phí'));
});
ok('menus follow hierarchy (⋮ open/close; building with floors vs without)', () => {
  h.act('mb-menu', { id: 'building:' + ncc.id });
  let t = tree(); assert(/role="menu"/.test(t) && /Thêm tầng/.test(t) && !/>Thêm Dãy</.test(t) && /Chỉnh sửa Khối\/Nhà/.test(t) && /Ngừng khai thác/.test(t));
  h.act('mb-menu', { id: 'building:' + nnl.id });
  t = tree(); assert(/>Thêm Dãy</.test(t) && !/Thêm tầng/.test(t));
  h.act('mb-menu', { id: 'floor:' + t1.id }); t = tree();
  assert(/>Thêm Dãy</.test(t) && /Chỉnh sửa Tầng/.test(t) && /Ngừng sử dụng/.test(t));
  h.act('mb-menu', { id: 'row:CL-R-HS-A' }); t = tree();
  ['Thêm điểm kinh doanh', 'Phân công NV thu phí', 'Chỉnh sửa Dãy', 'Ngừng khai thác'].forEach(x => assert(t.includes(x), x));
  h.act('mb-menu-run', { run: 'mb-add-point', id: 'CL-R-HS-A' });
  assert(!/role="menu"/.test(tree()), 'running an item closes the menu');
  assert(/Thêm nhóm điểm kinh doanh/.test(h.modal()) && text(h.modal()).includes('còn có thể bố trí 7 m²') && /Preview:/.test(h.modal())); A.closeModal();
});
ok('hierarchy guards: no floor in a floor-less building, no floor-less Dãy in a floored building, no delete with children', () => {
  h.act('qh-add-floor', { block: nnl.id }); assert(/Không thể thêm tầng/.test(h.modal())); A.closeModal();
  assert(S.addRow('CL', { blockId: ncc.id, floorId: S.NO_FLOOR + ncc.id }, 'ZZ-X', 'Dãy thử', 'Khác').errors);
  h.act('qh-del-zone', { id: 'CL-R-HS-A' }); assert(/Chưa thể ngừng khai thác/.test(h.modal())); A.closeModal();
  h.act('qh-del-floor', { id: t1.id }); assert(/Chưa thể ngừng sử dụng tầng/.test(h.modal())); A.closeModal();
  h.act('qh-del-block', { id: ncc.id }); assert(/Chưa thể ngừng khai thác/.test(h.modal())); A.closeModal();
  assert(db.rows.some(r => r.id === 'CL-R-HS-A') && db.floors.some(f => f.id === t1.id));
});
ok('22–23 floor business area ≥ Σ allocated; row allocated ≥ Σ point area', () => {
  h.act('qh-edit-floor', { id: t1.id }); h.input('#qhf-name', 'Tầng 1'); h.input('#qhf-code', 'T1'); h.input('#qhf-area', '100');
  h.act('qh-edit-floor-save', { id: t1.id });
  assert(/Không thể giảm xuống 100 m² vì các Dãy hiện đang được phân bổ tổng cộng 224 m²/.test(h.trace.toasts.at(-1)), h.trace.toasts.at(-1)); assert.strictEqual(t1.businessArea, 420);
  h.input('#qhf-area', '450'); h.act('qh-edit-floor-save', { id: t1.id }); assert.strictEqual(t1.businessArea, 450); A.closeModal();
  A.CH['qh-zone-field']({ dataset: { zone: 'CL-R-HS-A', k: 'area' }, value: '10' });
  assert(/Không thể giảm xuống 10 m² vì các điểm kinh doanh trong Dãy/.test(h.trace.toasts.at(-1))); assert.strictEqual(A.idx.row.get('CL-R-HS-A').allocatedArea, 36);
  A.closeModal();
});
ok('3 / XIV TTD: Khu chợ quê → Dãy, no fake floor; breadcrumb without floor segment', () => {
  use(mgr('TTD'), 'TTD'); A.ui.mb.sel = null;
  const t = tree();
  assert.strictEqual(count(t, /mb-tnode-floor/g), 0); assert(/Khu chợ quê/.test(t) && /CD-A · Quầy cố định/.test(t));
  sel('row', 'TTD-R-CD-A');
  assert(/Chợ quê Cù lao Tân Thuận Đông \/ Khu chợ quê \/ Dãy CD-A/.test(text(ws())));
  sel('building', db.buildings.find(b => b.market === 'TTD').id);
  assert(text(ws()).includes('Mô hình Không chia tầng') && text(ws()).includes('Số Dãy 5'));
});
ok('24 empty market: workspace (no wizard) with business area and "+ Thêm Khối/Nhà đầu tiên"', () => {
  const lead = A.ACCOUNTS.list().find(a => A.ACCOUNTS.primaryRole(a) === 'market_manager' && (a.marketScopes || []).includes('HA'));
  use(lead || 'AC-QT01', 'HA');
  let w = text(ws());
  assert(w.includes('Chợ chưa có cấu trúc mặt bằng.') && w.includes('Diện tích phục vụ kinh doanh: Chưa khai báo'));
  assert(/Chưa có cấu trúc mặt bằng/.test(tree()));
  MC.update('HA', { totalArea: 3000, businessArea: 2000 }, 'test');
  w = text(ws()); assert(w.includes('Diện tích phục vụ kinh doanh: 2.000 m²'));
  if (lead) {
    assert(/data-act="qh-add-block"/.test(ws()) && !/mb-setup/.test(go()));
    h.act('qh-add-block'); assert(/Thêm Khối\/Nhà chợ/.test(h.modal())); A.closeModal();
  }
  assert.strictEqual(db.buildings.filter(b => b.market === 'HA').length, 0, 'opening/closing the form leaves no record');
});
ok('15 / XVIII data safety: no stored derived fields, operational statuses only, legacy key untouched, persistence', () => {
  const derived = ['cat', 'section', 'sectionName', 'floor', 'row', 'traderId', 'contractId', 'sellerId', 'collectorId', 'areaType'];
  db.stalls.forEach(s => derived.forEach(k => assert(!Object.prototype.hasOwnProperty.call(s, k), s.id + '.' + k)));
  db.stalls.forEach(s => assert(['active', 'suspended', 'disputed'].includes(s.status), s.id));
  assert.strictEqual(h.localStorage.getItem('choso-caolanh-layout'), layoutBefore);
  assert(!A.D.MARKETS.some(m => 'floors' in m));
  A.save();
  const h2 = createApp(root, { storage: { 'choso-caolanh-state': h.localStorage.getItem('choso-caolanh-state') } });
  assert.strictEqual(h2.A.idx.row.get('CL-R-HS-A').collectorId, A.idx.row.get('CL-R-HS-A').collectorId);
  assert.strictEqual(h2.A.db.floors.find(f => f.id === t1.id).businessArea, 450);
});
ok('25–26 neighbouring routes render; CL/TTD market switch works', () => {
  use(mgr('CL'), 'CL');
  ['hop-dong', 'tieu-thuong', 'phai-thu', 'thu-tien', 'cong-no', 'dien-nuoc', 'mat-bang'].forEach(r => { h.go(r); assert.strictEqual(A.current, r); assert(h.view().length > 200, r); });
  const acc = A.currentAccount();
  if ((acc.marketScopes || []).includes('TTD')) { h.act('market', { id: 'TTD' }); assert.strictEqual(A.ui.market, 'TTD'); assert(/Khu chợ quê/.test(tree())); h.act('market', { id: 'CL' }); }
  assert(/Nhà chợ chính/.test(tree()));
});
console.log(`mat-bang-workspace regression PASS (${passed} checks)`);

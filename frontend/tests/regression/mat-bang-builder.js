/* Focused regression: "Thiết lập mặt bằng" as a build-as-you-go workspace (no multi-step wizard).
 * Scenario (task): market businessArea 500 m² → Nhà A 300 / Nhà B 200 → Nhà A: Tầng 1 100 / Tầng 2 200 →
 * Tầng 1: 3 Dãy 30/40/30 → HS-A: 2×5 có mái che + 4×5 không mái che = 6 điểm / 30 m²; every level blocks
 * over-allocation and shrinking below its children; area types come from allowedAreaTypeIds.
 * Run: node frontend/tests/regression/mat-bang-builder.js */
const assert = require('assert');
const path = require('path');
const { createApp } = require('./harness');
const root = path.resolve(__dirname, '../..');
let passed = 0;
const ok = (label, fn) => { try { fn(); passed++; console.log('PASS ' + label); } catch (e) { console.log('FAIL ' + label); throw e; } };
const eq = (a, b, msg) => assert.strictEqual(JSON.stringify(a), JSON.stringify(b), msg);

const h = createApp(root), A = h.A, db = A.db, S = A.features.marketLayout.store, MC = A.features.markets.service;
const MID = 'TTT';
const mgr = A.ACCOUNTS.list().find(a => A.ACCOUNTS.primaryRole(a) === 'market_manager' && (a.marketScopes || []).includes(MID));
const use = (id, mid) => { A.ui.sessionAccountId = id; A.ui.market = mid; A.syncAccountContext(); };
use(mgr.id, MID);
MC.update(MID, { totalArea: 800, businessArea: 500, allowedAreaTypeIds: ['covered', 'uncovered'] }, 'test');
const go = () => { if (A.current !== 'mat-bang') h.go('mat-bang'); else { A.render(); h.flush(); } return h.view(); };
const text = html => html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
const tree = () => { const v = go(); return v.slice(v.indexOf('role="tree"'), v.indexOf('<div class="mb-ws">')); };
const center = () => { const v = go(); return v.slice(v.indexOf('<div class="mb-ws">'), v.indexOf('<aside class="card mb-insp"')); };
const insp = () => { const v = go(); return v.slice(v.indexOf('<aside class="card mb-insp"')); };
const lastToast = () => h.trace.toasts.at(-1);
const formErr = () => h.el('#mb-form-err').innerHTML.replace(/&quot;/g, '"').replace(/&amp;/g, '&');
const fill = vals => Object.keys(vals).forEach(k => h.input('#' + k, String(vals[k])));
const byName = (kind, name) => db[kind].find(x => x.market === MID && x.name === name);
const otherMarkets = () => JSON.stringify(['buildings', 'floors', 'rows', 'stalls'].map(k => db[k].filter(x => x.market !== MID)));
const othersBefore = otherMarkets();

// Stub DOM does not parse the modal HTML: set the prefilled suggestion explicitly (UI shows S.nextBuildingCode).
function addBuilding(name, area) { h.act('qh-add-block'); fill({ 'qhb-name': name, 'qhb-code': S.nextBuildingCode(MID), 'qhb-area': area }); h.act('qh-add-block-save'); }
function addFloor(b, name, area) { h.act('qh-add-floor', { block: b.id }); fill({ 'qhf-name': name, 'qhf-code': '', 'qhf-area': area }); h.act('qh-add-floor-save', { block: b.id }); }
function addRow(place, industry, area) {
  h.act('qh-add-zone', place);
  A.CH['qhz-industry']({ value: industry });
  const d = A.ui.mb.zoneDraft;
  h.input('#qhz-name', d.name); h.input('#qhz-area', String(area));
  h.act('qh-add-zone-save');
  return d;
}

ok('empty market: no wizard, workspace shows business area and "+ Thêm Khối/Nhà đầu tiên"', () => {
  const v = go(), t = text(v);
  assert(t.includes('Chợ chưa có cấu trúc mặt bằng.') && t.includes('Diện tích phục vụ kinh doanh: 500 m²'));
  assert(/data-act="qh-add-block"[^>]*>\+ Thêm Khối\/Nhà đầu tiên/.test(v));
  assert(!/mb-setup|Thiết lập mặt bằng ban đầu|Tiếp tục/.test(v), 'no wizard entry');
  assert(!A.ACT['mb-setup'] && !A.ACT['mb-setup-next'], 'wizard handlers removed');
  assert(/Thiết lập mặt bằng: <b>Chợ Tân Thuận Tây<\/b>/.test(v) && t.includes('Còn lại 500 m²'));
});
ok('Market → Building: 300 + 200 = 500 passes; 250 for Nhà B is blocked (Vượt 50 m²)', () => {
  addBuilding('Nhà A', 300);
  const a = byName('buildings', 'Nhà A');
  assert(a && a.businessArea === 300 && a.code === 'B1', 'saved with generated code');
  eq(A.ui.mb.sel, { k: 'building', id: a.id });
  assert(text(tree()).includes('Nhà A 300 m²'), 'appears in the tree immediately');
  addBuilding('Nhà B', 250);
  assert(!byName('buildings', 'Nhà B'));
  assert(formErr().includes('Vượt 50 m² so với diện tích phục vụ kinh doanh còn lại của chợ.'), formErr());
  h.input('#qhb-area', '200'); h.act('qh-add-block-save');
  const b = byName('buildings', 'Nhà B');
  assert(b && b.businessArea === 200);
  eq(S.budget.market(MID), { total: 500, allocated: 500, remaining: 0, unsetChildren: 0 });
  A.ui.mb.sel = null; const t = text(go());
  assert(t.includes('Đã phân bổ 500 m²') && t.includes('Còn lại 0 m²'));
});
ok('Nhà A 350 + Nhà B 200 = 550 > 500 → blocked on edit', () => {
  const a = byName('buildings', 'Nhà A');
  h.act('qh-edit-block', { id: a.id }); fill({ 'qhb-name': 'Nhà A', 'qhb-code': a.code, 'qhb-area': 350 }); h.act('qh-edit-block-save', { id: a.id });
  assert(formErr().includes('Vượt 50 m²'));
  assert.strictEqual(a.businessArea, 300);
  A.closeModal();
});
ok('Building → Floor: Tầng 1 100 + Tầng 2 200 = 300; 150 + 200 > 300 blocked', () => {
  const a = byName('buildings', 'Nhà A');
  addFloor(a, 'Tầng 1', 150);
  addFloor(a, 'Tầng 2', 200);
  assert(formErr().includes('Vượt 50 m² so với diện tích còn lại của Khối/Nhà "Nhà A".'), formErr());
  assert(!byName('floors', 'Tầng 2'));
  A.closeModal();
  const t1 = byName('floors', 'Tầng 1');
  h.act('qh-edit-floor', { id: t1.id }); fill({ 'qhf-name': 'Tầng 1', 'qhf-code': t1.code, 'qhf-area': 100 }); h.act('qh-edit-floor-save', { id: t1.id });
  assert.strictEqual(t1.businessArea, 100);
  addFloor(a, 'Tầng 2', 200);
  const t2 = byName('floors', 'Tầng 2');
  assert(t2 && t2.businessArea === 200 && t1.code === 'T1' && t2.code === 'T2');
  eq(S.budget.building(a), { total: 300, allocated: 300, remaining: 0, childKind: 'floor' });
});
ok('Floor → Row: industry → suggested name → generated code (read-only) → area; 30 + 40 + 40 > 100 blocked', () => {
  const t1 = byName('floors', 'Tầng 1'), place = { block: t1.buildingId, floor: t1.id };
  h.act('qh-add-zone', place);
  const m = h.modal();
  const order = ['1. Ngành hàng', '2. Tên Dãy', '3. Mã Dãy', '4. Diện tích phân bổ cho Dãy'].map(x => m.indexOf(x));
  assert(order.every((x, i) => x > 0 && (i === 0 || x > order[i - 1])), 'field order ' + order);
  assert(/id="qhz-code"[^>]*readonly/.test(m));
  A.CH['qhz-industry']({ value: 'Thủy hải sản' });
  let d = A.ui.mb.zoneDraft;
  assert.strictEqual(d.code, 'HS-A'); assert.strictEqual(d.name, 'Dãy thủy hải sản A');
  h.input('#qhz-name', 'Dãy Thủy hải sản A'); A.IN['qhz-name']({ value: 'Dãy Thủy hải sản A' });
  A.CH['qhz-industry']({ value: 'Rau củ, trái cây' });
  assert.strictEqual(d.name, 'Dãy Thủy hải sản A', 'custom name not overwritten'); assert.strictEqual(d.code, 'RC-A');
  A.CH['qhz-industry']({ value: 'Thủy hải sản' });
  h.input('#qhz-name', d.name); h.input('#qhz-area', '30'); h.act('qh-add-zone-save');
  const hs = db.rows.find(r => r.market === MID && r.code === 'HS-A');
  assert(hs && hs.allocatedArea === 30 && hs.floorId === t1.id && hs.name === 'Dãy Thủy hải sản A');
  eq(A.ui.mb.sel, { k: 'row', id: hs.id });
  d = addRow(place, 'Rau củ, trái cây', 40);
  addRow(place, 'Lương thực, thực phẩm khô', 40);
  assert(formErr().includes('Vượt 10 m² so với diện tích còn lại của Tầng 1.'), formErr());
  h.input('#qhz-area', '30'); h.act('qh-add-zone-save');
  eq(db.rows.filter(r => r.floorId === t1.id).map(r => [r.code, r.allocatedArea]), [['HS-A', 30], ['RC-A', 40], ['LT-A', 30]]);
  eq(S.budget.floor(t1), { total: 100, allocated: 100, remaining: 0 });
});
ok('row code: gaps are never reused (HS-A, HS-C → HS-D) and codes stay unique per market', () => {
  const t2 = byName('floors', 'Tầng 2');
  const hsc = S.addRow(MID, { blockId: t2.buildingId, floorId: t2.id }, 'HS-C', 'Dãy HS-C', 'Thủy hải sản', 10).row;
  assert.strictEqual(S.nextRowCode(MID, 'Thủy hải sản'), 'HS-D');
  S.removeRow(hsc.id);
});
ok('Row → Point groups: only allowed area types; 2×5 covered + 4×5 uncovered = 6 points / 30 m²', () => {
  const hs = db.rows.find(r => r.market === MID && r.code === 'HS-A');
  h.act('mb-add-point', { id: hs.id });
  const m = h.modal();
  assert(m.includes('>Có mái che<') && m.includes('>Không mái che<') && !m.includes('>Tự sản tự tiêu<') && !m.includes('>Theo phiên<'), 'dropdown filtered by allowedAreaTypeIds');
  const d = A.ui.mb.pointDraft;
  Object.assign(d.groups[0], { areaTypeId: 'covered', quantity: '2', areaPerPoint: '5' });
  h.act('mb-point-group-add');
  Object.assign(d.groups[1], { areaTypeId: 'uncovered', quantity: '4', areaPerPoint: '5' });
  A.IN['mb-point-field']({ dataset: { id: d.groups[1].id, key: 'quantity' }, value: '4' });
  assert.strictEqual(h.el('#mb-pg-total-' + d.groups[1].id).textContent, '20 m²', 'realtime quantity × areaPerPoint');
  assert(h.el('#mb-pg-sum').textContent.includes('Tổng: 6 điểm · 30 m²'));
  h.act('mb-point-commit');
  const pts = db.stalls.filter(s => s.rowId === hs.id);
  eq(pts.map(s => [s.code, s.areaTypeId, s.area]), [['HS-A01', 'covered', 5], ['HS-A02', 'covered', 5], ['HS-A03', 'uncovered', 5], ['HS-A04', 'uncovered', 5], ['HS-A05', 'uncovered', 5], ['HS-A06', 'uncovered', 5]]);
  eq(S.budget.row(hs), { total: 30, allocated: 30, remaining: 0 });
  // Không double count: tầng vẫn 100 m² (không cộng thêm 30 m² điểm).
  eq(S.budget.floor(byName('floors', 'Tầng 1')), { total: 100, allocated: 100, remaining: 0 });
  const derived = ['cat', 'industry', 'collectorId', 'traderId', 'contractId'];
  pts.forEach(s => derived.forEach(k => assert(!Object.prototype.hasOwnProperty.call(s, k), s.id + '.' + k)));
});
ok('points 10 + 25 > row 30 blocked; not-allowed area type blocked', () => {
  const lt = db.rows.find(r => r.market === MID && r.code === 'LT-A');
  const groups = [{ id: 'g1', areaTypeId: 'covered', quantity: 2, areaPerPoint: 5 }, { id: 'g2', areaTypeId: 'uncovered', quantity: 5, areaPerPoint: 5 }];
  const check = S.pointGroups.validate(MID, lt.id, groups);
  assert(!check.ok && check.errors.includes('Vượt 5 m² so với diện tích được phân bổ cho Dãy.'), check.errors.join('|'));
  assert(!S.pointGroups.commit(MID, lt.id, groups).ok);
  const bad = S.pointGroups.validate(MID, lt.id, [{ id: 'g3', areaTypeId: 'session', quantity: 1, areaPerPoint: 5 }]);
  assert(!bad.ok && bad.errors[0].includes('không được áp dụng tại chợ này'));
  assert.strictEqual(db.stalls.filter(s => s.rowId === lt.id).length, 0);
});
ok('shrink guards: floor 80 < 100 rows, building 250 < 300 floors, row 20 < 30 points', () => {
  const t1 = byName('floors', 'Tầng 1'), a = byName('buildings', 'Nhà A'), hs = db.rows.find(r => r.market === MID && r.code === 'HS-A');
  h.act('qh-edit-floor', { id: t1.id }); fill({ 'qhf-name': 'Tầng 1', 'qhf-code': 'T1', 'qhf-area': 80 }); h.act('qh-edit-floor-save', { id: t1.id });
  assert(formErr().includes('Không thể giảm xuống 80 m² vì các Dãy hiện đang được phân bổ tổng cộng 100 m².'), formErr());
  assert.strictEqual(t1.businessArea, 100); A.closeModal();
  h.act('qh-edit-block', { id: a.id }); fill({ 'qhb-name': 'Nhà A', 'qhb-code': a.code, 'qhb-area': 250 }); h.act('qh-edit-block-save', { id: a.id });
  assert(formErr().includes('Không thể giảm xuống 250 m² vì các Tầng hiện đang được phân bổ tổng cộng 300 m².'), formErr());
  assert.strictEqual(a.businessArea, 300); A.closeModal();
  const errs = S.updateRow(hs.id, { allocatedArea: 20 });
  assert(errs[0].includes('Không thể giảm xuống 20 m²') && hs.allocatedArea === 30);
});
ok('hierarchy guard reused: a building with direct Dãy cannot get floors; Σ direct Dãy <= building area', () => {
  const b = byName('buildings', 'Nhà B');
  addRow({ block: b.id, floor: S.NO_FLOOR + b.id }, 'Ăn uống', 250);
  assert(formErr().includes('Vượt 50 m² so với diện tích còn lại của Khối/Nhà "Nhà B".'), formErr());
  h.input('#qhz-area', '120'); h.act('qh-add-zone-save');
  const au = db.rows.find(r => r.market === MID && r.code === 'AU-A');
  assert(au && !au.floorId && au.buildingId === b.id);
  h.act('qh-add-floor', { block: b.id }); assert(/Không thể thêm tầng/.test(h.modal())); A.closeModal();
  eq(S.budget.building(b), { total: 200, allocated: 120, remaining: 80, childKind: 'row' });
});
ok('tree / center / inspector follow ui.mb.sel', () => {
  const a = byName('buildings', 'Nhà A'), t1 = byName('floors', 'Tầng 1'), hs = db.rows.find(r => r.market === MID && r.code === 'HS-A');
  h.act('mb-sel-overview');
  let t = text(tree());
  ['Chợ Tân Thuận Tây 500 m²', 'Nhà A 300 m²', 'Tầng 1 100 m²', 'Tầng 2 200 m²', 'Nhà B 200 m²', 'HS-A · Thủy hải sản · 30 m²'].forEach(s => assert(t.includes(s), s));
  assert(!/HS-A0\d/.test(tree()), 'points are not in the tree');
  let c = center();
  assert(/data-act="mb-sel-building" data-id="[^"]+"/.test(c) && text(c).includes('Nhà A') && /\+ Thêm Khối\/Nhà/.test(c));
  assert(/<h3>Chợ<\/h3>/.test(insp()) && text(insp()).includes('Có mái che') && !text(insp()).includes('Theo phiên'));
  h.act('mb-sel-building', { id: a.id }); c = text(center());
  assert(c.includes('Tầng 1 100 m²') && c.includes('Dãy Thủy hải sản A 30 m²') && c.includes('+ Thêm tầng'));
  assert(text(insp()).includes('Đã phân bổ cho Tầng 300 m²'));
  h.act('mb-sel-floor', { id: t1.id }); c = text(center());
  assert(c.includes('Diện tích tầng 100 m²') && c.includes('Đã phân bổ cho Dãy 100 m²') && c.includes('Còn lại 0 m²') && c.includes('HS-A · Thủy hải sản') && c.includes('6 điểm'));
  h.act('mb-sel-row', { id: hs.id }); c = center();
  assert(/HS-A01/.test(c) && text(c).includes('5 m²'), 'point tiles with code + area');
  const i = text(insp());
  ['Nhà Nhà A', 'Tầng Tầng 1', 'Ngành hàng Thủy hải sản', 'Mã Dãy HS-A', 'Diện tích phân bổ 30 m²', 'Đã sử dụng 30 m²', 'Còn lại 0 m²', 'Có mái che 2 × 5 m² = 10 m²', 'Không mái che 4 × 5 m² = 20 m²'].forEach(s => assert(i.includes(s), s));
  assert(/data-act="mb-add-point"/.test(insp()) && !h.modal(), 'viewing does not open a modal');
  h.act('mb-view', { id: 'table' });
  assert(/Danh sách/.test(go()) && /Mã điểm/.test(center()));
  h.act('mb-view', { id: 'grid' });
});
ok('incremental save: every step persisted; reload keeps the structure; other markets untouched', () => {
  const saved = h.localStorage.getItem('choso-caolanh-state');
  const h2 = createApp(root, { storage: { 'choso-caolanh-state': saved, 'choso-caolanh-marketcatalog': h.localStorage.getItem('choso-caolanh-marketcatalog') } });
  const d2 = h2.A.db;
  eq(d2.buildings.filter(b => b.market === MID).map(b => [b.name, b.businessArea]), [['Nhà A', 300], ['Nhà B', 200]]);
  eq(d2.floors.filter(f => f.market === MID).map(f => [f.name, f.businessArea]), [['Tầng 1', 100], ['Tầng 2', 200]]);
  assert.strictEqual(d2.stalls.filter(s => s.market === MID).length, 6);
  assert.strictEqual(otherMarkets(), othersBefore);
});
ok('RBAC: ward leader cannot add/edit structure (handlers refuse)', () => {
  const lead = A.ACCOUNTS.list().find(a => A.ACCOUNTS.primaryRole(a) === 'ward_leader');
  use(lead.id, MID);
  if (!A.canDo('cau-truc.edit', MID)) {
    const n = db.buildings.length;
    A.closeModal(); h.act('qh-add-block'); assert.strictEqual(h.modal(), '');
    h.input('#qhb-name', 'X'); h.input('#qhb-code', 'X'); h.input('#qhb-area', '1'); h.act('qh-add-block-save');
    assert.strictEqual(db.buildings.length, n);
  }
  use(mgr.id, MID);
});
ok('existing CL layout still renders (legacy buildings without area)', () => {
  const cl = A.ACCOUNTS.list().find(a => A.ACCOUNTS.primaryRole(a) === 'market_manager' && (a.marketScopes || []).includes('CL'));
  use(cl.id, 'CL'); A.ui.mb.sel = null;
  const t = text(go());
  assert(t.includes('Nhà chợ chính') && t.includes('Chưa khai báo') && t.includes('Khối/Nhà chưa khai báo diện tích phân bổ'));
  const hsA = A.idx.row.get('CL-R-HS-A'); h.act('mb-sel-row', { id: hsA.id });
  assert(text(insp()).includes('Mã Dãy HS-A'));
});
console.log(`mat-bang-builder regression PASS (${passed} checks)`);

/* Focused regression: layout data model v16 (MAT_BANG_DATA_MODEL_V16).
 * One layout graph in A.db (buildings → floors optional → rows → stalls); row = 1 industry + allocated
 * area; points own only their fields (occupancy/debt/industry/location derived); synchronized reseed
 * without orphans; demo trader accounts still linked; neighbouring screens render; storage/version. */
const assert = require('assert');
const path = require('path');
const { createApp } = require('./harness');
const root = path.resolve(__dirname, '../..');
let passed = 0;
const ok = (label, fn) => { try { fn(); passed++; } catch (e) { e.message = label + ': ' + e.message; throw e; } };
const use = (A, id, market) => { A.ui.sessionAccountId = id; A.ui.market = market || 'CL'; A.syncAccountContext(); };
const J = x => JSON.stringify(x);

// Browser state from before v16: a v15 A.db and the legacy layout key must not be used as sources.
const legacyLayout = J({ CL: { blocks: [{ key: 'b_legacy', name: 'KHÔNG ĐƯỢC ĐỌC', floors: [] }] } });
const h = createApp(root, { storage: { 'choso-caolanh-state': J({ version: 15, stalls: [{ id: 'OLD' }] }), 'choso-caolanh-layout': legacyLayout } });
const A = h.A, D = A.D, db = A.db, BP = A.features.businessPoints.service, S = A.features.marketLayout.store;
const byId = list => new Map(list.map(x => [x.id, x]));
const B = byId(db.buildings), F = byId(db.floors), R = byId(db.rows);
const sum = (xs, f) => xs.reduce((a, x) => a + f(x), 0);

ok('1 version bump reseeds; old v15 state backed up once; legacy layout key ignored and untouched', () => {
  assert(D.VERSION >= 16); assert.strictEqual(db.version, D.VERSION); // v28: gộp nhánh Tài chính trên mô hình v16
  assert(!db.stalls.some(s => s.id === 'OLD'));
  const bk = JSON.parse(h.localStorage.getItem('choso-caolanh-state-backup'));
  assert.strictEqual(bk.version, 15); assert.strictEqual(bk.state, J({ version: 15, stalls: [{ id: 'OLD' }] }));
  assert.strictEqual(h.localStorage.getItem('choso-caolanh-layout'), legacyLayout);
  assert(!S.blocksOf('CL').some(b => b.name === 'KHÔNG ĐƯỢC ĐỌC'));
  assert(!D.MARKETS.some(m => 'floors' in m), 'D.MARKETS carries no layout');
});
ok('2 CL hierarchy: Nhà chợ chính → Tầng 1/Tầng 2 → dãy; Khu ngoài nhà lồng → dãy (no floor)', () => {
  const cl = db.buildings.filter(b => b.market === 'CL').map(b => b.name);
  assert.strictEqual(J(cl), J(['Nhà chợ chính', 'Khu ngoài nhà lồng']));
  const ncc = db.buildings.find(b => b.market === 'CL' && b.code === 'NCC'), nnl = db.buildings.find(b => b.market === 'CL' && b.code === 'NNL');
  assert.strictEqual(J(db.floors.filter(f => f.buildingId === ncc.id).map(f => f.name)), J(['Tầng 1', 'Tầng 2']));
  assert(db.rows.filter(r => r.buildingId === ncc.id).length >= 4 && db.rows.filter(r => r.buildingId === ncc.id).every(r => r.floorId));
  assert.strictEqual(db.floors.filter(f => f.buildingId === nnl.id).length, 0);
  assert(db.rows.filter(r => r.buildingId === nnl.id).length >= 2 && db.rows.filter(r => r.buildingId === nnl.id).every(r => r.floorId === null));
});
ok('3 TTD: Khu chợ quê → dãy directly, no fake floor', () => {
  assert.strictEqual(db.floors.filter(f => f.market === 'TTD').length, 0);
  const rows = db.rows.filter(r => r.market === 'TTD');
  assert(rows.length >= 3 && rows.every(r => r.floorId === null && B.get(r.buildingId).name === 'Khu chợ quê'));
});
ok('4 every row has exactly one industry from the single catalog; rows may share one', () => {
  db.rows.forEach(r => assert(typeof r.industry === 'string' && D.INDUSTRIES.includes(r.industry), r.id));
  assert.strictEqual(R.get('CL-R-HS-A').industry, R.get('CL-R-HS-B').industry);
  assert.strictEqual(S.CATS, D.INDUSTRIES);
});
ok('5 one row can hold several area types; area type lives on the point', () => {
  const types = new Set(db.stalls.filter(s => s.rowId === 'CL-R-HS-A').map(s => s.areaTypeId));
  assert(types.size >= 2);
  db.stalls.forEach(s => assert(A.U.AREA_TYPE_CODES.includes(s.areaTypeId), s.id));
});
ok('6 referential integrity of the layout graph (floorId null allowed)', () => {
  db.stalls.forEach(s => { const r = R.get(s.rowId); assert(r && r.market === s.market, s.id); });
  db.rows.forEach(r => { const b = B.get(r.buildingId); assert(b && b.market === r.market, r.id); if (r.floorId !== null) { const f = F.get(r.floorId); assert(f && f.buildingId === r.buildingId, r.id); } });
  db.floors.forEach(f => assert(B.get(f.buildingId), f.id));
  assert.strictEqual(new Set(db.stalls.map(s => s.id)).size, db.stalls.length);
  assert(db.stalls.filter(s => s.market === 'CL').length >= 30 && db.stalls.filter(s => s.market === 'CL').length <= 55);
  assert(db.stalls.filter(s => s.market === 'TTD').length >= 15 && db.stalls.filter(s => s.market === 'TTD').length <= 25);
});
ok('7 area rules: Σ point.area ≤ row.allocatedArea; Σ row.allocatedArea ≤ floor.businessArea', () => {
  db.rows.forEach(r => assert(sum(db.stalls.filter(s => s.rowId === r.id), s => s.area) <= r.allocatedArea + 1e-9, r.id));
  db.floors.forEach(f => assert(sum(db.rows.filter(r => r.floorId === f.id), r => r.allocatedArea) <= f.businessArea + 1e-9, f.id));
  assert(S.rowErrors(Object.assign({}, R.get('CL-R-KA-A'), { allocatedArea: 10 })).some(e => /Không thể giảm xuống 10 m² vì các điểm kinh doanh trong Dãy/.test(e)));
  assert(S.rowErrors(Object.assign({}, R.get('CL-R-KA-A'), { allocatedArea: 1000 })).some(e => /^Vượt .* m² so với diện tích còn lại của Tầng/.test(e)));
});
ok('8 points store no derived duplicates; compat getters are read-only', () => {
  const derived = ['cat', 'section', 'sectionName', 'floor', 'traderId', 'contractId', 'sellerId', 'collectorId', 'areaType', 'pointType'];
  db.stalls.forEach(s => derived.forEach(k => assert(!Object.prototype.hasOwnProperty.call(s, k), s.id + '.' + k)));
  db.stalls.forEach(s => assert(Object.keys(D.POINT_STATUS).includes(s.status), s.id + ' status ' + s.status));
  const st = A.idx.stall.get('CL-HS-A01');
  assert.strictEqual(st.cat, 'Thủy hải sản'); assert.strictEqual(st.section, 'HS-A');
  assert.throws(() => { 'use strict'; st.cat = 'Khác'; }, e => e && e.name === 'TypeError', 'writing a derived field fails loudly');
  assert.strictEqual(st.cat, 'Thủy hải sản');
  assert(!J(db).includes('"sectionName"'), 'nothing derived is serialized');
});
ok('9 occupancy / debt / display status are derived', () => {
  const c = db.contracts.find(x => x.status === 'hieuluc' && x.market === 'CL');
  const st = A.idx.stall.get(c.stallId);
  assert.strictEqual(BP.usageStatus(st), 'occupied'); assert.strictEqual(st.traderId, c.traderId); assert.strictEqual(st.contractId, c.id);
  const vacant = A.idx.stall.get('CL-KA-A06');
  assert.strictEqual(BP.usageStatus(vacant), 'vacant'); assert.strictEqual(A.pointDisplayStatus(vacant), 'trong');
  const debt = db.stalls.filter(s => A.pointDisplayStatus(s) === 'no');
  assert(debt.length >= 2 && debt.every(s => BP.debtStatus(s) === 'overdue' && s.status === 'active'));
  assert.strictEqual(A.pointDisplayStatus(A.idx.stall.get('CL-RC-A05')), 'ngung');
  assert.strictEqual(A.pointDisplayStatus(A.idx.stall.get('CL-TG-A05')), 'tranhchap');
  assert.strictEqual(A.refreshStall, undefined, 'no helper writes debt into stall.status');
  const loc = BP.location(A.idx.stall.get('CL-TS-A01'));
  assert.strictEqual(loc.khu, 'Khu ngoài nhà lồng'); assert.strictEqual(loc.tang, '—'); assert.strictEqual(loc.floor, null);
});
ok('10 no orphan trader/contract/invoice/payment/reading/incident/seller/request references', () => {
  const P = byId(db.stalls), T = byId(db.traders), C = byId(db.contracts), I = byId(db.invoices);
  db.contracts.forEach(x => assert(P.get(x.stallId) && T.get(x.traderId), x.id));
  db.invoices.forEach(x => assert(P.get(x.stallId) && T.get(x.traderId) && C.get(x.contractId), x.id));
  db.payments.forEach(x => { assert(T.get(x.traderId), x.id); if (x.invoiceId) assert(I.get(x.invoiceId), x.id); });
  db.readings.forEach(x => assert(P.get(x.stallId)));
  db.incidents.forEach(x => assert(P.get(x.stallId) && T.get(x.traderId), x.id));
  db.directSellerAssignments.forEach(x => assert(P.get(x.pointId) && T.get(x.traderId), x.id));
  db.pointRequests.forEach(x => assert(P.get(x.pointId), x.id));
  db.traders.forEach(t => (t.stalls || []).forEach(id => assert(P.get(id), t.id + ' → ' + id)));
  db.sessionRegistrations.forEach(x => assert(T.get(x.traderId), x.id));
  db.bank.forEach(x => { if (x.paymentId) assert(db.payments.some(p => p.id === x.paymentId), x.id); });
});
ok('11 demo coverage: contracts active/expiring/ended, unpaid/partial/paid, cash/transfer/QR, meters, incidents', () => {
  const t = new Set(db.contracts.map(c => c.status));
  assert(t.has('hieuluc') && t.has('chamdut') && t.has('thanhly'));
  assert(db.contracts.some(c => c.status === 'hieuluc' && A.U.days(A.U.today(), c.end) <= 30));
  const s = new Set(db.invoices.map(i => i.status)); assert(s.has('paid') && s.has('unpaid')); // nhánh Tài chính: không thu một phần (P chốt) → seed không còn khoản 'partial'
  const m = new Set(db.payments.map(p => p.method)); assert(m.has('tm') && m.has('ck') && m.has('qr'));
  assert(db.readings.length > 0 && db.incidents.length > 0);
  assert(db.traders.some(x => x.market === 'CL' && !db.contracts.some(c => c.traderId === x.id)), 'trader without contract');
  assert(db.traders.some(x => x.stalls.length >= 2), 'trader with several points');
});
ok('12 TT0001 / TTD-CQ exist with valid business data; demo accounts stay linked and render', () => {
  ['TT0001', 'TTD-CQ'].forEach(id => {
    assert(A.idx.trader.get(id), id);
    assert(db.contracts.some(c => c.traderId === id && c.status === 'hieuluc'), id + ' has an active contract');
  });
  assert.strictEqual(A.ACCOUNTS.get('AC-TT01').traderId, 'TT0001');
  assert.strictEqual(A.ACCOUNTS.get('AC-CHI-QUYET').traderId, 'TTD-CQ');
  // A07 dùng web Tiểu thương (tieu-thuong/); back-office chỉ hiện màn hướng sang cổng đó. Dữ liệu hồ sơ liên kết
  // vẫn render đúng qua view Mini App (gọi trực tiếp, không qua router back-office).
  use(A, 'AC-TT01', 'CL'); assert(A.VIEWS['mini-app']().includes('KA-A01'), 'AC-TT01 sees KA-A01');
  use(A, 'AC-CHI-QUYET', 'TTD'); assert(A.VIEWS['mini-app']().includes('CD-A01'), 'AC-CHI-QUYET sees CD-A01');
});
ok('13 operational screens render for CL and TTD', () => {
  const mgr = mid => A.ACCOUNTS.list().find(a => A.ACCOUNTS.primaryRole(a) === 'market_manager' && (a.marketScopes || []).includes(mid));
  ['CL', 'TTD'].forEach(mid => {
    use(A, mgr(mid).id, mid);
    ['mat-bang', 'hop-dong', 'tieu-thuong', 'phai-thu', 'thu-tien', 'cong-no', 'dien-nuoc'].forEach(r => {
      h.go(r); assert(h.view().length > 200, mid + ' ' + r);
    });
  });
});
ok('14 area types: point edits only accept the market allowedAreaTypeIds; legacy per-type quota is no longer enforced', () => {
  const mgr = A.ACCOUNTS.list().find(a => A.ACCOUNTS.primaryRole(a) === 'market_manager' && (a.marketScopes || []).includes('CL'));
  const MC = A.features.markets.service, u = MC.usage('CL');
  // Legacy quota at the current usage would have blocked the change below; it must not any more.
  const cap = A.U.AREA_TYPE_CODES.map(k => ({ areaTypeId: k, maxPointCount: (u[k] || { count: 0 }).count, maxArea: Math.ceil((u[k] || { area: 0 }).area) }));
  MC.update('CL', { totalArea: 20435, businessArea: 5000, capacityByAreaType: cap, allowedAreaTypeIds: ['covered', 'uncovered'] }, 'test');
  const st = db.stalls.find(s => s.market === 'CL' && s.areaTypeId === 'uncovered' && !BP.contractOn(s.id, A.U.today()));
  use(A, mgr.id, 'CL'); h.act('dk-open', { id: st.id }); h.act('dkcl-edit-open', { id: st.id });
  assert(!/value="session"/.test(h.modal()), 'not-allowed area type is not offered');
  A.CH['dke-field']({ dataset: { k: 'areaType' }, value: 'session' });
  h.act('dkcl-edit-save', { id: st.id });
  assert(/không được áp dụng tại chợ này/.test(h.trace.toasts.at(-1)), h.trace.toasts.at(-1));
  assert.strictEqual(st.areaTypeId, 'uncovered');
  A.CH['dke-field']({ dataset: { k: 'areaType' }, value: 'covered' });
  h.act('dkcl-edit-save', { id: st.id });
  assert.strictEqual(st.areaTypeId, 'covered', 'allowed type saved without any per-type quota');
});
ok('15 new rows do not create collector assignments', () => {
  const place = S.firstZonePlace('CL');
  const row = S.addRow('CL', place, 'NO-COLLECTOR', 'Dãy không phân công', 'Khác').row;
  assert(row && !Object.prototype.hasOwnProperty.call(row, 'collectorId'));
  assert(S.removeRow(row.id));
});
ok('16 row commands keep the rules (industry required, no delete with points) and persist in A.db only', () => {
  const place = S.firstZonePlace('CL');
  assert(S.addRow('CL', place, 'ZZ-A', 'Dãy thử', '').errors[0].includes('ngành hàng'));
  const res = S.addRow('CL', place, 'ZZ-A', 'Dãy thử', 'Khác'); assert(res.row && res.row.floorId);
  assert(!S.removeRow('CL-R-KA-A'), 'row with points cannot be deleted');
  assert(S.removeRow(res.row.id));
  const nnl = db.buildings.find(b => b.code === 'NNL');
  const r2 = S.addRow('CL', { blockId: nnl.id, floorId: S.NO_FLOOR + nnl.id }, 'ZZ-B', 'Dãy ngoài trời', 'Khác').row;
  assert.strictEqual(r2.floorId, null);
  A.save();
  assert.strictEqual(h.localStorage.getItem('choso-caolanh-layout'), legacyLayout, 'legacy key never written');
  const h2 = createApp(root, { storage: { 'choso-caolanh-state': h.localStorage.getItem('choso-caolanh-state') } });
  const st2 = h2.A.idx.stall.get('CL-HS-A01');
  assert(h2.A.idx.row.get(r2.id), 'row persisted in choso-caolanh-state');
  assert.strictEqual(st2.cat, 'Thủy hải sản', 'prototype re-attached after reload');
  assert.strictEqual(h2.localStorage.getItem('choso-caolanh-state-backup'), null, 'no backup when versions match');
});
console.log(`layout-model-v16 regression PASS (${passed} checks)`);

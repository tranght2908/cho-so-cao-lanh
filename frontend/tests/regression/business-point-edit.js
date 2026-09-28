/* Focused regression: "Chỉnh sửa điểm kinh doanh" edits only point-owned data (location through the
 * existing Khu → Tầng → Dãy structure, area, area type, category, operational condition, note).
 * Occupancy, debt, collector, contract, price, meter and vehicle stay read-only / untouched. */
const assert = require('assert');
const path = require('path');
const { createApp } = require('./harness');
const root = path.resolve(__dirname, '../..');
const login = (A, id) => { A.ui.sessionAccountId = id; A.ui.market = 'CL'; A.syncAccountContext(); };
let passed = 0;
const ok = (label, fn) => { fn(); passed++; };

const h = createApp(root), A = h.A;
login(A, 'AC-NV01');
const BP = A.features.businessPoints.service, S = A.features.marketLayout.store, today = A.U.today();
const zones = S.flatZones('CL').filter(z => A.mbResolveZoneContext('CL', z).matched);
const zoneOf = st => zones.find(z => z.code === st.section);
const zKA = zones.find(z => z.code === 'KA'), zKB = zones.find(z => z.code === 'KB');
assert(zKA && zKB, 'layout has dãy KA and KB');
const floorOf = z => S.findFloorOfZone('CL', z.key);
const blockOf = z => S.findBlock('CL', z.blockId);
const collectors = BP.collectorAccounts('CL');
assert(collectors.length >= 2, 'at least two collector accounts in CL');
BP.assignCollector(A.mbBusinessPointsForZone('CL', zKA), collectors[0].id);
BP.assignCollector(A.mbBusinessPointsForZone('CL', zKB), collectors[1].id);
const occupied = A.db.stalls.find(s => s.market === 'CL' && s.section === 'KA' && BP.contractOn(s.id, today));
const free = A.db.stalls.find(s => s.market === 'CL' && s.status === 'trong' && !BP.contractOn(s.id, today));
assert(occupied && free);
const modal = () => h.modal();
const fld = (k, value) => A.CH['dke-field']({ dataset: { k }, value });
const open = st => { h.act('dk-open', { id: st.id }); h.act('dkcl-edit-open', { id: st.id }); };
const snapshot = () => JSON.stringify({ c: A.db.contracts, i: A.db.invoices, b: A.db.billingDrafts || null, r: A.db.readings, v: A.db.traderVehicles || null, sc: A.SERVICE_CFG ? A.SERVICE_CFG.list('stallPrices') : null });

ok('1 code and market are read-only', () => {
  open(occupied);
  assert(/Chỉnh sửa điểm kinh doanh/.test(modal()));
  assert(!/id="dke-code"|id="dke-market"/.test(modal()) && modal().includes('<b>' + occupied.code + '</b>') && modal().includes('Chợ Cao Lãnh'));
  assert(!/dke-type|Đơn giá|Mức thu|dkds-|Phương tiện|chỉ số/i.test(modal()), 'no price / meter / vehicle / seller fields');
});
ok('2 changing Khu resets Tầng and Dãy', () => {
  const other = S.blocksOf('CL').find(b => b.key !== blockOf(zKA).key);
  if (other) {
    A.CH['dke-block']({ value: other.key });
    assert(/— Chọn tầng —/.test(modal()) && /— Chọn dãy —/.test(modal()));
    A.CH['dke-block']({ value: blockOf(zKA).key });
  } else {
    A.CH['dke-block']({ value: '' });
    assert(/— Chọn khu —/.test(modal()) && /id="dke-floor" data-ch="dke-floor" disabled/.test(modal()));
    A.CH['dke-block']({ value: blockOf(zKA).key });
  }
  assert(/— Chọn tầng —/.test(modal()));
});
ok('3 changing Tầng resets Dãy and offers only that floor\'s dãy', () => {
  A.CH['dke-floor']({ value: floorOf(zKA).key });
  assert(/— Chọn dãy —/.test(modal()));
  assert(modal().includes(`value="${zKA.key}"`));
  const otherFloorZone = zones.find(z => floorOf(z).key !== floorOf(zKA).key);
  if (otherFloorZone) assert(!modal().includes(`value="${otherFloorZone.key}"`));
  const n = A.db.contracts.length; h.act('dkcl-edit-save', { id: occupied.id });
  assert(h.trace.toasts.at(-1).includes('Khu, Tầng và Dãy'), 'impossible hierarchy is not saved');
  A.CH['dke-zone']({ value: zKA.key });
  assert.strictEqual(A.db.contracts.length, n);
});
ok('4 area <= 0 rejected', () => {
  fld('area', '0'); h.act('dkcl-edit-save', { id: occupied.id });
  assert(h.trace.toasts.at(-1).includes('Diện tích'));
  fld('area', 'abc'); h.act('dkcl-edit-save', { id: occupied.id });
  assert(h.trace.toasts.at(-1).includes('Diện tích'));
});
const before = snapshot();
ok('5–7 decimal area, area type, category saved on the point; warning for active contract', () => {
  fld('area', '14,5');
  assert(/Điểm đang có hợp đồng hiệu lực/.test(A.$('#dke-warn-slot').innerHTML), 'warning appears after a significant change');
  const nextType = A.U.AREA_TYPE_CODES.find(k => k !== occupied.areaType);
  const nextCat = A.mbCatOptions('CL').find(x => x !== occupied.cat);
  fld('areaType', nextType); fld('cat', nextCat); fld('note', 'Gần lối đi chính');
  h.act('dkcl-edit-save', { id: occupied.id });
  assert.strictEqual(occupied.area, 14.5); assert.strictEqual(typeof occupied.area, 'number');
  assert.strictEqual(occupied.areaType, nextType); assert.strictEqual(occupied.cat, nextCat); assert.strictEqual(occupied.note, 'Gần lối đi chính');
  assert(/Điểm kinh doanh/.test(modal()) && !/Chỉnh sửa điểm kinh doanh/.test(modal()), 'back to view mode');
});
ok('13 save does not modify contract / invoice / billing / meter / vehicle / fee policy', () => assert.strictEqual(snapshot(), before));
ok('8 active-contract point shows Đang thuê read-only', () => {
  open(occupied);
  const c = BP.contractOn(occupied.id, today);
  assert(/● Đang thuê/.test(modal()) && modal().includes('Theo ' + c.id));
  assert(!/<select[^>]*(usage|occupancy|trader|contract)/i.test(modal()));
  assert(modal().includes('<div id="dke-warn-slot"></div>'), 'no warning merely because the popup opened');
  h.act('dkcl-edit-cancel', { id: occupied.id });
});
ok('9 free point shows Còn trống read-only', () => { open(free); assert(/○ Còn trống/.test(modal()) && /Không có hợp đồng hiệu lực hiện tại/.test(modal())); h.act('dkcl-edit-cancel', { id: free.id }); });
ok('10 collector resolved from the dãy KA assignment', () => {
  open(occupied);
  assert(modal().includes(collectors[0].fullName) && /Theo phân công dãy KA/.test(modal()));
  assert(!/<select[^>]*collector/i.test(modal()), 'collector is not an editable field');
});
ok('11 moving to dãy KB previews and applies the KB assignment', () => {
  A.CH['dke-block']({ value: blockOf(zKB).key }); A.CH['dke-floor']({ value: floorOf(zKB).key }); A.CH['dke-zone']({ value: zKB.key });
  assert(modal().includes(collectors[1].fullName) && /theo dãy mới KB/.test(modal()));
  h.act('dkcl-edit-save', { id: occupied.id });
  assert.strictEqual(occupied.section, 'KB'); assert.strictEqual(occupied.collectorId, collectors[1].id);
  assert.strictEqual(BP.zoneCollectorId('CL', zKB), collectors[1].id, 'dãy KB assignment stays uniform');
  assert.strictEqual(snapshot(), before, 'moving the point still leaves contracts/invoices untouched');
});
ok('12 Nợ phí cannot be cleared from the popup', () => {
  const debt = A.db.stalls.find(s => s.market === 'CL' && s.status === 'no');
  open(debt);
  assert(/Nợ phí/.test(modal()) && !/<option value="no"/.test(modal()) && !/<option value="trong"/.test(modal()));
  fld('area', String(debt.area).replace('.', ','));
  h.act('dkcl-edit-save', { id: debt.id });
  assert.strictEqual(debt.status, 'no');
});
ok('operational condition uses existing statuses and restores occupancy on "Hoạt động"', () => {
  open(free); fld('op', 'ngung'); h.act('dkcl-edit-save', { id: free.id });
  assert.strictEqual(free.status, 'ngung');
  open(free); fld('op', 'active'); h.act('dkcl-edit-save', { id: free.id });
  assert.strictEqual(free.status, 'trong');
});
ok('14 out-of-scope / no-permission user cannot save', () => {
  open(free); const area = free.area;
  login(A, 'AC-LD01'); fld('area', '99');
  h.act('dkcl-edit-save', { id: free.id });
  assert.strictEqual(free.area, area);
  h.act('dkcl-edit-open', { id: free.id });
  login(A, 'AC-NV01');
});
ok('15 no create-point form is affected (layout planning still renders)', () => {
  assert(!A.ACT['dk-new'] && !A.ACT['dkcl-new']);
  h.go('mat-bang'); assert(/Cấu trúc chợ/.test(h.view()));
});
console.log(`business-point edit regression PASS (${passed} checks)`);

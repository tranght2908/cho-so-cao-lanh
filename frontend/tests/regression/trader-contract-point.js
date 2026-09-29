/* Focused regression: one availability rule shared by Mặt bằng, Hồ sơ tiểu thương and Hợp đồng;
 * compact "Cần xử lý"; contract creation from trader and from an available point converging on the
 * same form; save-time overlap protection; date-aware relationship views; RBAC/market scope.
 * Separate from the approved baseline replay because it verifies behaviour introduced after it. */
const assert = require('assert');
const path = require('path');
const { createApp } = require('./harness');
const root = path.resolve(__dirname, '../..');

const addDays = (d, n) => new Date(Date.parse(d) + n * 86400000).toISOString().slice(0, 10);
const login = (A, id, market) => { A.ui.sessionAccountId = id; A.ui.market = market || 'CL'; A.syncAccountContext(); };
const rowsIn = html => (html.match(/class="pending-work-row"/g) || []).length;
let passed = 0;
const ok = (label, fn) => { fn(); passed++; };

function setup() {
  const h = createApp(root), A = h.A;
  login(A, 'AC-NV01', 'CL');
  const BP = A.features.businessPoints.service, today = A.U.today();
  // Fixture points taken from real CL seed points (they carry real fee policies); contracts are
  // added on top so every case is explicit.
  // v16: occupancy/debt are derived (A.pointDisplayStatus); stall.status is operational only.
  const free = A.db.stalls.filter(s => s.market === 'CL' && A.pointDisplayStatus(s) === 'trong' && !A.db.contracts.some(c => c.stallId === s.id));
  const occupied = A.db.stalls.find(s => s.market === 'CL' && A.pointDisplayStatus(s) === 'thue' && s.contractId);
  const ttd = A.db.stalls.find(s => s.market === 'TTD');
  assert(free.length >= 8 && occupied && ttd, 'seed provides free, occupied and TTD points');
  const add = c => { A.db.contracts.push(Object.assign({ market: 'CL', traderId: 'TT0002', history: [] }, c, { businessPointId: c.stallId })); A.reindex(); };
  return { h, A, BP, today, free, occupied, ttd, add };
}

// ---------------- AVAILABILITY (1–9) ----------------
{
  const { A, BP, today, free, occupied, ttd, add } = setup();
  const [p1, p3, p4, p6, p7, p8, pNgung] = free;
  const yesterday = addDays(today, -1);
  ok('1 no contract → available', () => { assert(BP.isAvailable(p1.id, today)); assert.strictEqual(BP.freeSince(p1.id, today), null); });
  ok('2 active contract today → unavailable', () => { assert(!BP.isAvailable(occupied.id, today)); assert(BP.contractOn(occupied.id, today)); });
  add({ id: 'T-ENDED', stallId: p3.id, start: addDays(today, -400), end: yesterday, status: 'hieuluc' });
  ok('3 contract ended yesterday → available today, "trống từ" = today', () => { assert(BP.isAvailable(p3.id, today)); assert.strictEqual(BP.freeSince(p3.id, today), today); });
  const fStart = addDays(today, 30), fEnd = addDays(today, 395);
  add({ id: 'T-FUTURE', stallId: p4.id, start: fStart, end: fEnd, status: 'hieuluc' });
  ok('4 future contract does not block an earlier single date', () => assert(BP.isAvailable(p4.id, today)));
  ok('5 future contract blocks an overlapping range', () => { assert(!BP.isAvailable(p4.id, today, addDays(today, 60))); assert(!BP.availablePoints('CL', today, addDays(today, 60)).some(p => p.id === p4.id)); });
  ok('6 range ending before the future contract → available', () => assert(BP.isAvailable(p4.id, today, addDays(fStart, -1))));
  ok('7 wrong market excluded', () => { assert(!BP.availablePoints('CL', today).some(p => p.id === ttd.id)); assert(!BP.isAvailable(ttd.id, today, today, { market: 'CL' })); });
  add({ id: 'T-TERM', stallId: p6.id, start: addDays(today, -200), end: addDays(today, 500), status: 'chamdut', termination: { date: addDays(today, -3) } });
  add({ id: 'T-LIQ', stallId: p7.id, start: addDays(today, -500), end: addDays(today, -10), status: 'thanhly' });
  add({ id: 'T-DRAFT', stallId: p8.id, start: addDays(today, -10), end: addDays(today, 300), status: 'nhap' });
  ok('8 lifecycle: terminated/liquidated/non-effective handled by real status', () => {
    assert(BP.isAvailable(p6.id, today), 'released from termination date');
    assert(!BP.isAvailable(p6.id, addDays(today, -5), today), 'occupied before termination date');
    assert.strictEqual(BP.freeSince(p6.id, today), addDays(today, -3));
    assert(BP.isAvailable(p7.id, today) && !BP.isAvailable(p7.id, addDays(today, -20)), 'liquidated contract occupied its full term');
    assert(BP.isAvailable(p8.id, today), 'unknown/draft status never occupies');
    pNgung.status = 'suspended';
    assert(!BP.isAvailable(pNgung.id, today), 'Tạm ngừng point is not allocatable');
    pNgung.status = 'active';
  });
  ok('9 inclusive boundaries never double-book', () => {
    assert(!BP.isAvailable(p3.id, yesterday, today), 'start on previous end date overlaps');
    assert(BP.isAvailable(p3.id, today, addDays(today, 10)), 'start the day after previous end');
    assert(BP.isAvailable(p4.id, today, addDays(fStart, -1)) && !BP.isAvailable(p4.id, today, fStart), 'end the day before a future start');
    assert(!BP.isAvailable(p4.id, fEnd, addDays(fEnd, 10)) && BP.isAvailable(p4.id, addDays(fEnd, 1), addDays(fEnd, 10)));
  });
  ok('mat-bang status at date uses the same rule (today = persisted status, other dates = contracts)', () => {
    A.ui.mb.view = 'table'; A.ui.mb.sel = null; A.ui.mb.filter = { search: '', status: '', cat: '', areaType: '' };
    A.mbSetStatusDate(null);
    assert.strictEqual(A.mbStatusAt(occupied), 'thue'); assert.strictEqual(A.mbStatusAt(p1), 'trong');
    assert.strictEqual(A.mbStatusAt(p4), 'trong', 'future contract does not occupy today');
    A.mbSetStatusDate(addDays(fStart, 5));
    assert.strictEqual(A.mbStatusAt(p4), 'thue', 'occupied on a date inside the future contract');
    const occEnd = BP.occupyingInterval(BP.contractOn(occupied.id, today)).end;
    A.mbSetStatusDate(addDays(occEnd, 1));
    assert.strictEqual(A.mbStatusAt(occupied), 'trong', 'free the day after its contract ends');
    A.ui.mb.filter.status = 'trong';
    assert(A.mbCurrentPoints('CL').some(p => p.id === occupied.id), 'chip filter follows the selected date');
    const stats = A.mbMarketStats('CL');
    assert.strictEqual(Object.values(stats.byStatus).reduce((a, b) => a + b, 0), stats.total, 'badges partition all points');
    A.ui.mb.filter.status = ''; A.mbSetStatusDate(null);
    pNgung.status = 'suspended'; assert.strictEqual(A.mbStatusAt(pNgung), 'ngung'); pNgung.status = 'active';
  });
}

// ---------------- TRADER + CONTRACT + CROSS-SCREEN (10–24) ----------------
{
  const { h, A, BP, today, free, occupied, add } = setup();
  // 20 CL traders without contract; one of them currently linked to a point code for search.
  // v16 seed already has CL profiles without contract (demo case) — count on top of them.
  const seedPending = A.WORKFLOW.needsContract('CL').length;
  for (let n = 1; n <= 20; n++) A.db.traders.push({ id: `PX-${String(n).padStart(3, '0')}`, name: `Tiểu thương chờ ${n}`, phone: `091${String(n).padStart(7, '0')}`, idNo: `0870000${String(n).padStart(5, '0')}`, market: 'CL', stalls: [] });
  A.idx && A.reindex();
  const pending = A.WORKFLOW.needsContract('CL');
  assert.strictEqual(pending.length, seedPending + 20);

  h.go('tieu-thuong');
  ok('10 trader page shows the pending summary count', () => { assert(/pending-summary/.test(h.view())); assert(/Tiểu thương chưa có hợp đồng/.test(h.view())); assert(h.view().includes('>' + (seedPending + 20) + '<')); });
  ok('11 pending records are not rendered inline', () => assert.strictEqual(rowsIn(h.view()), 0));
  h.act('wf-contract-worklist');
  ok('12 Cần xử lý opens the canonical contract-owned worklist', () => {
    assert.strictEqual(A.current, 'hop-dong');
    assert(/TIỂU THƯƠNG CHƯA CÓ HỢP ĐỒNG/.test(h.view()));
    assert(/data-act="trader"/.test(h.view()) && /data-act="wf-contract-open"/.test(h.view()));
  });
  ok('13 worklist search composes with the same pending helper', () => {
    A.IN['wf-contract-pending-search']({ value: 'PX-007' });
    assert(h.view().includes('PX-007') && !h.view().includes('PX-008'));
    A.IN['wf-contract-pending-search']({ value: '' });
  });
  ok('14 "Tạo hợp đồng" opens the existing contract form', () => {
    h.act('wf-contract-open', { id: 'PX-001' });
    assert(/data-act="wf-contract-save"/.test(h.modal()) && /id="wf-ct-building"/.test(h.modal()) && /id="wf-ct-row"/.test(h.modal()) && /id="wf-ct-point"/.test(h.modal()));
    assert(!/id="wf-ct-trader"/.test(h.modal()), 'trader opened from its dossier is fixed');
    assert(!/data-act="wf-ct-pick-point"/.test(h.modal()), 'point selection is now hierarchical in the contract form');
    assert(h.modal().includes('PX-001') && /Chờ bố trí/.test(h.modal()), 'trader prefilled as read-only');
  });

  A.closeModal(); h.act('wf-contract-worklist-close');
  h.go('hop-dong');
  ok('15 contract page pending work is summary only', () => { assert(/Tiểu thương chưa có hợp đồng/.test(h.view())); assert(/Xem &amp; tạo hợp đồng|Xem & tạo hợp đồng/.test(h.view())); assert.strictEqual(rowsIn(h.view()), 0); });
  ok('contract screen has a shared menu entry for creating a contract without a fixed trader', () => {
    assert(/data-act="ct-new"/.test(h.view()) && /\+ Tạo hợp đồng/.test(h.view()));
    h.act('ct-new');
    assert(/id="wf-ct-trader"/.test(h.modal()) && /data-act="wf-contract-save"/.test(h.modal()));
  });
  ok('trader detail offers the same fixed-trader form even when the trader already has a contract', () => {
    h.act('trader', { id: 'PX-010' });
    assert(/data-act="wf-contract-open" data-id="PX-010"/.test(h.modal()));
    h.act('wf-contract-open', { id: 'PX-010' });
    assert(h.modal().includes('PX-010') && !/id="wf-ct-trader"/.test(h.modal()) && /data-act="wf-contract-save"/.test(h.modal()));
    const withContract = A.db.contracts.find(c => c.market === 'CL' && c.status === 'hieuluc');
    h.act('trader', { id: withContract.traderId });
    assert(/data-act="wf-contract-open"/.test(h.modal()));
  });
  ok('expiring KPIs: ≤30 and ≤15 are separate cards while retaining the subset logic', () => {
    const cs = A.db.contracts.filter(c => c.market === 'CL' && c.status === 'hieuluc'), left = c => A.U.days(today, c.end);
    const n30 = cs.filter(c => left(c) <= 30).length;
    assert(h.view().includes('Sắp hết hạn ≤ 30 ngày') && h.view().includes('Sắp hết hạn ≤ 15 ngày'));
    h.act('hd-tab', { id: '30' });
    assert.strictEqual((h.view().match(/data-act="ct-view"/g) || []).length, Math.min(25, n30), 'tab ≤30 lists the ≤15 ones too');
    h.act('hd-tab', { id: 'all' });
  });

  // Flow A: trader → form → dates → choose the available point in the hierarchical selector → save.
  const [pA, pBlocked, pB] = free;
  // The headless DOM does not parse selected <option>s, so mirror the four v16
  // selector values after the real form helper has populated its draft.
  const syncPointFields = p => {
    const BPx = A.features.businessPoints.service, row = BPx.row(p), floor = BPx.floor(p), building = BPx.building(p);
    A.features.contracts.form.pickPoint(p.id);
    h.input('#wf-ct-building', building.id);
    if (floor) h.input('#wf-ct-floor', floor.id);
    h.input('#wf-ct-row', row.id);
    h.input('#wf-ct-point', p.id);
  };
  const s1 = addDays(today, 10), e1 = addDays(today, 375);
  add({ id: 'T-BLOCK', stallId: pBlocked.id, start: addDays(today, 100), end: addDays(today, 200), status: 'hieuluc' });
  h.act('wf-contract-open', { id: 'PX-001' });
  h.input('#wf-ct-trader', 'PX-001'); h.input('#wf-ct-start', s1); h.input('#wf-ct-end', e1);
  ok('16 hierarchical point selector respects the whole contract range', () => {
    assert(!BP.isAvailable(pBlocked.id, s1, e1), 'overlapping future contract is unavailable');
    assert(BP.isAvailable(pA.id, s1, e1), 'available point remains selectable');
    A.features.contracts.form.pickPoint(pA.id);
    syncPointFields(pA);
    assert(new RegExp('id="wf-ct-point"[^>]*value="' + pA.id + '"|option value="' + pA.id + '" selected').test(h.modal()));
    assert(/Ngành hàng/.test(h.modal()) && /Còn trống/.test(h.modal()));
  });
  ok('17 save-time revalidation blocks an overlap created after the search', () => {
    add({ id: 'T-RACE', stallId: pA.id, start: addDays(today, 200), end: addDays(today, 260), status: 'hieuluc' });
    const n = A.db.contracts.length;
    h.act('wf-contract-save');
    assert.strictEqual(A.db.contracts.length, n, 'no contract saved');
    assert(h.trace.toasts.at(-1).includes('Điểm ' + pA.code + ' đã có hợp đồng hiệu lực trong một phần thời gian đã chọn'));
    A.db.contracts.splice(A.db.contracts.findIndex(c => c.id === 'T-RACE'), 1); A.reindex();
  });
  let cA;
  ok('18 valid contract saves', () => {
    h.act('wf-contract-save');
    cA = A.db.contracts.at(-1);
    assert.strictEqual(cA.traderId, 'PX-001'); assert.strictEqual(cA.stallId, pA.id); assert.strictEqual(cA.start, s1); assert.strictEqual(cA.end, e1); assert.strictEqual(cA.status, 'hieuluc');
    assert.strictEqual(A.pointDisplayStatus(A.idx.stall.get(pA.id)), 'trong', 'a future-start contract does not displace today\'s occupancy');
  });
  ok('idempotent: saving again does not create a second contract', () => { const n = A.db.contracts.length; h.act('wf-contract-save'); assert.strictEqual(A.db.contracts.length, n); });
  ok('19 availability reflects the saved contract', () => { assert(!BP.isAvailable(pA.id, s1, e1)); assert(!BP.isAvailable(pA.id, addDays(e1, -1), addDays(e1, 30))); assert(BP.isAvailable(pA.id, today, addDays(s1, -1))); });
  ok('20 trader detail resolves contract and point', () => { h.act('trader', { id: 'PX-001' }); assert(h.modal().includes(cA.id) && h.modal().includes(pA.code) && /Sắp hiệu lực/.test(h.modal())); });
  ok('21 point detail resolves the scheduled contract; occupied point resolves trader + contract', () => {
    h.act('dk-open', { id: pA.id });
    assert(/Đang trống/.test(h.modal()) && /Đã có lịch bố trí từ/.test(h.modal()) && h.modal().includes(cA.id));
    h.act('dk-open', { id: occupied.id });
    const c = BP.contractOn(occupied.id, today), t = A.idx.trader.get(c.traderId);
    assert(/Đang sử dụng/.test(h.modal()) && h.modal().includes(c.id) && h.modal().includes(t.name));
  });
  ok('22 trader → create → pick → save completed (16–19)', () => assert(cA));

  // Second contract through the same form on a point that is free today (current contract).
  h.go('mat-bang');
  let cB;
  ok('mat-bang shows badges + date context only (no contract KPI row, no availability modal)', () => {
    assert(/data-ch="mb-status-date"/.test(h.view()) && /Tình trạng tại ngày/.test(h.view()));
    assert(!/avail-overview|mb-avail-open|Sắp hết HĐ|Xem điểm trống/.test(h.view()));
    assert(!A.ACT['mb-avail-open'] && !A.ACT['avail-create']);
  });
  ok('23 contract starting today occupies the point as before', () => {
    const s2 = today, e2 = addDays(today, 364);
    h.act('wf-contract-open', { id: 'PX-002' });
    h.input('#wf-ct-trader', 'PX-002'); h.input('#wf-ct-start', s2); h.input('#wf-ct-end', e2);
    A.features.contracts.form.pickPoint(pB.id); syncPointFields(pB);
    h.act('wf-contract-save');
    cB = A.db.contracts.at(-1);
    assert.strictEqual(cB.traderId, 'PX-002'); assert.strictEqual(cB.stallId, pB.id);
    const st = A.idx.stall.get(pB.id);
    assert.strictEqual(A.pointDisplayStatus(st), 'thue'); assert.strictEqual(st.contractId, cB.id); assert(A.idx.trader.get('PX-002').stalls.includes(pB.id));
    assert.strictEqual(A.mbStatusAt(st), 'thue');
  });
  ok('24 both contracts have the same data shape', () => assert.deepStrictEqual(Object.keys(cA).sort(), Object.keys(cB).sort()));
  ok('Flow C: overlapping contract on the same point is blocked', () => {
    h.act('wf-contract-open', { id: 'PX-003' });
    h.input('#wf-ct-trader', 'PX-003'); h.input('#wf-ct-start', addDays(today, 30)); h.input('#wf-ct-end', addDays(today, 90)); A.features.contracts.form.pickPoint(pB.id);
    const n = A.db.contracts.length; h.act('wf-contract-save');
    assert.strictEqual(A.db.contracts.length, n); assert(h.trace.toasts.at(-1).includes(pB.code));
  });
  ok('terminating the current contract keeps a future contract from vacating/overwriting wrongly', () => {
    const f = A.features.contracts.service;
    f.terminate(cB.id, { date: today, reason: 'test', detail: 'test' }, { at: '', action: 't' });
    const st = A.idx.stall.get(pB.id);
    assert.strictEqual(A.pointDisplayStatus(st), 'trong'); assert(BP.isAvailable(pB.id, today));
  });
}

// ---------------- DERIVED TRADER BUSINESS STATUS ----------------
{
  const { h, A, today, free, add } = setup();
  const TS = A.features.traders.service, status = TS.BUSINESS_STATUS;
  const addTrader = (id, name) => { const t = { id, name, phone: '091' + id.slice(-7), idNo: '087' + id.slice(-9), market: 'CL', stalls: [] }; A.db.traders.push(t); A.reindex(); return t; };
  const waiting = addTrader('PX-WAIT', 'Chờ bố trí test');
  const active = addTrader('PX-ACTIVE', 'Đang hoạt động test');
  const inactive = addTrader('PX-INACTIVE', 'Ngừng hoạt động test');
  const multiple = addTrader('PX-MULTI', 'Nhiều hợp đồng test');
  const reactivated = addTrader('PX-RETURN', 'Tái hoạt động test');
  const future = addTrader('PX-FUTURE', 'Hợp đồng tương lai test');
  add({ id: 'TS-ACTIVE', traderId: active.id, stallId: free[0].id, start: addDays(today, -5), end: addDays(today, 30), status: 'hieuluc' });
  add({ id: 'TS-INACTIVE', traderId: inactive.id, stallId: free[1].id, start: addDays(today, -50), end: addDays(today, -2), status: 'hieuluc' });
  add({ id: 'TS-MULTI-OLD', traderId: multiple.id, stallId: free[2].id, start: addDays(today, -50), end: addDays(today, -2), status: 'hieuluc' });
  add({ id: 'TS-MULTI-CURRENT', traderId: multiple.id, stallId: free[3].id, start: addDays(today, -5), end: addDays(today, 30), status: 'hieuluc' });
  add({ id: 'TS-RETURN-OLD', traderId: reactivated.id, stallId: free[4].id, start: addDays(today, -50), end: addDays(today, -2), status: 'chamdut', termination: { date: addDays(today, -2) } });
  add({ id: 'TS-RETURN-CURRENT', traderId: reactivated.id, stallId: free[5].id, start: addDays(today, -1), end: addDays(today, 30), status: 'hieuluc' });
  add({ id: 'TS-FUTURE', traderId: future.id, stallId: free[6].id, start: addDays(today, 2), end: addDays(today, 30), status: 'hieuluc' });
  ok('30 newly created/no-contract trader is Chờ bố trí', () => assert.strictEqual(TS.deriveBusinessStatus(waiting), status.WAITING_ALLOCATION));
  ok('31 current valid contract makes trader Đang hoạt động', () => assert.strictEqual(TS.deriveBusinessStatus(active), status.ACTIVE));
  ok('32 ended sole contract makes trader Ngừng hoạt động', () => assert.strictEqual(TS.deriveBusinessStatus(inactive), status.INACTIVE));
  ok('33 one ended contract cannot override another current contract', () => assert.strictEqual(TS.deriveBusinessStatus(multiple), status.ACTIVE));
  ok('34 a new current contract reactivates an inactive trader', () => assert.strictEqual(TS.deriveBusinessStatus(reactivated), status.ACTIVE));
  ok('35 future-only contract remains Chờ bố trí until its effective date', () => assert.strictEqual(TS.deriveBusinessStatus(future), status.WAITING_ALLOCATION));
  login(A, 'AC-NV01', 'CL'); h.go('tieu-thuong');
  ok('36 status filter selects only Chờ bố trí traders', () => {
    A.CH['ttcl-status']({ value: status.WAITING_ALLOCATION });
    A.IN['ttcl-search']({ value: waiting.name });
    assert(h.view().includes(waiting.name) && !h.view().includes(active.name) && !h.view().includes(inactive.name));
  });
  ok('37 status filter selects only Đang hoạt động traders', () => {
    A.CH['ttcl-status']({ value: status.ACTIVE });
    A.IN['ttcl-search']({ value: active.name });
    assert(h.view().includes(active.name) && !h.view().includes(inactive.name));
  });
  ok('38 status filter selects only Ngừng hoạt động traders', () => {
    A.CH['ttcl-status']({ value: status.INACTIVE });
    A.IN['ttcl-search']({ value: inactive.name });
    assert(h.view().includes(inactive.name) && !h.view().includes(active.name));
  });
  ok('39 search, floor and status filters compose', () => {
    const p = free[0];
    A.CH['ttcl-status']({ value: status.ACTIVE });
    A.CH['ttcl-floor']({ value: p.floor });
    A.IN['ttcl-search']({ value: active.name });
    assert(h.view().includes(active.name) && !h.view().includes(multiple.name));
  });
}

// ---------------- RBAC + MARKET SCOPE (29) ----------------
{
  const { h, A, free } = setup();
  A.db.traders.push({ id: 'PX-RBAC', name: 'RBAC test', phone: '0919999999', idNo: '087999999999', market: 'CL', stalls: [] }); A.reindex();
  login(A, 'AC-LD01', 'CL');
  h.go('mat-bang');
  ok('29a view-only role cannot open the contract form', () => {
    A.closeModal(); h.act('ct-new', { point: free[0].id });
    assert(!/data-act="wf-contract-save"/.test(h.modal()));
  });
  ok('29b handler-side checks hold when called directly', () => {
    const n = A.db.contracts.length;
    h.input('#wf-ct-trader', 'PX-RBAC'); h.input('#wf-ct-start', A.U.today()); h.input('#wf-ct-end', addDays(A.U.today(), 30)); A.features.contracts.form.pickPoint(free[0].id);
    h.act('wf-contract-save');
    assert.strictEqual(A.db.contracts.length, n);
  });
  ok('29c market scope: CL-scoped manager cannot open another market', () => {
    login(A, 'AC-NV01', 'CL');
    if (!A.allowedMarkets(A.currentAccount()).includes('TTD')) {
      A.features.businessPoints.availability.open({ market: 'TTD', from: A.U.today(), to: A.U.today() });
      assert(h.trace.toasts.at(-1).includes('phạm vi'));
    }
    A.features.businessPoints.availability.open({ from: A.U.today(), to: addDays(A.U.today(), 30) });
    assert(/Chọn điểm khả dụng/.test(h.modal()) && !/TTD-/.test(h.modal()));
  });
}

console.log(`trader-contract-point regression PASS (${passed} checks)`);

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
  const free = A.db.stalls.filter(s => s.market === 'CL' && s.status === 'trong' && !A.db.contracts.some(c => c.stallId === s.id));
  const occupied = A.db.stalls.find(s => s.market === 'CL' && s.status === 'thue' && s.contractId);
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
    pNgung.status = 'ngung';
    assert(!BP.isAvailable(pNgung.id, today), 'Tạm ngừng point is not allocatable');
    pNgung.status = 'trong';
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
    pNgung.status = 'ngung'; assert.strictEqual(A.mbStatusAt(pNgung), 'ngung'); pNgung.status = 'trong';
  });
}

// ---------------- TRADER + CONTRACT + CROSS-SCREEN (10–24) ----------------
{
  const { h, A, BP, today, free, occupied, add } = setup();
  // 20 CL traders without contract; one of them currently linked to a point code for search.
  for (let n = 1; n <= 20; n++) A.db.traders.push({ id: `PX-${String(n).padStart(3, '0')}`, name: `Tiểu thương chờ ${n}`, phone: `091${String(n).padStart(7, '0')}`, idNo: `0870000${String(n).padStart(5, '0')}`, market: 'CL', stalls: [] });
  A.idx && A.reindex();
  const pending = A.WORKFLOW.needsContract('CL');
  assert.strictEqual(pending.length, 20);

  h.go('tieu-thuong');
  ok('10 trader page shows the pending summary count', () => { assert(/pending-summary/.test(h.view())); assert(/Tiểu thương chưa có hợp đồng/.test(h.view())); assert(/>20</.test(h.view())); });
  ok('11 pending records are not rendered inline', () => assert.strictEqual(rowsIn(h.view()), 0));
  h.act('wf-contract-worklist');
  ok('12 worklist opens', () => assert(/20 trường hợp/.test(h.modal())));
  ok('13 search + pagination', () => {
    assert.strictEqual(rowsIn(h.modal()), 15);
    h.act('wf-contract-worklist-page', { k: 'pendingContracts', d: '1' });
    assert.strictEqual(rowsIn(h.modal()), 5);
    A.IN['wf-contract-search']({ value: 'PX-007' });
    assert.strictEqual(rowsIn(h.modal()), 1);
    A.IN['wf-contract-search']({ value: '' });
  });
  ok('14 "Tạo hợp đồng" opens the existing contract form', () => {
    h.act('wf-contract-open', { id: 'PX-001' });
    assert(/data-act="wf-contract-save"/.test(h.modal()) && /data-act="wf-ct-pick-point"/.test(h.modal()) && /id="wf-ct-trader"/.test(h.modal()));
    assert(/<option value="PX-001" selected>/.test(h.modal()), 'trader prefilled');
  });

  h.go('hop-dong');
  ok('15 contract page pending work is summary only', () => { assert(/Tiểu thương đủ điều kiện nhưng chưa có hợp đồng/.test(h.view())); assert(/Xem &amp; tạo hợp đồng|Xem & tạo hợp đồng/.test(h.view())); assert.strictEqual(rowsIn(h.view()), 0); });
  ok('contract screen has no generic create CTA; creation starts from "Cần xử lý"', () => {
    assert(!/data-act="ct-new"/.test(h.view()) && !/Khởi tạo hợp đồng/.test(h.view()));
    assert(/data-act="wf-contract-worklist"/.test(h.view()));
  });
  ok('trader detail offers "Tạo hợp đồng" (same form, trader prefilled) only without active contract', () => {
    h.act('trader', { id: 'PX-010' });
    assert(/data-act="wf-contract-open" data-id="PX-010"/.test(h.modal()));
    h.act('wf-contract-open', { id: 'PX-010' });
    assert(/<option value="PX-010" selected>/.test(h.modal()) && /data-act="wf-contract-save"/.test(h.modal()));
    const withContract = A.db.contracts.find(c => c.market === 'CL' && c.status === 'hieuluc');
    h.act('trader', { id: withContract.traderId });
    assert(!/data-act="wf-contract-open"/.test(h.modal()));
  });
  ok('expiring KPI: ≤30 with "trong đó ≤15" (subset, not a separate group)', () => {
    const cs = A.db.contracts.filter(c => c.market === 'CL' && c.status === 'hieuluc'), left = c => A.U.days(today, c.end);
    const n30 = cs.filter(c => left(c) <= 30).length, n15 = cs.filter(c => left(c) <= 15).length;
    assert(h.view().includes('Sắp hết hạn ≤ 30 ngày') && h.view().includes('Trong đó ≤ 15 ngày: ' + n15));
    h.act('hd-tab', { id: '30' });
    assert.strictEqual((h.view().match(/data-act="ct-view"/g) || []).length, Math.min(25, n30), 'tab ≤30 lists the ≤15 ones too');
    h.act('hd-tab', { id: 'all' });
  });

  // Flow A: trader → form → dates → pick available point → save.
  const [pA, pBlocked, pB] = free;
  const s1 = addDays(today, 10), e1 = addDays(today, 375);
  add({ id: 'T-BLOCK', stallId: pBlocked.id, start: addDays(today, 100), end: addDays(today, 200), status: 'hieuluc' });
  h.act('wf-contract-open', { id: 'PX-001' });
  h.input('#wf-ct-trader', 'PX-001'); h.input('#wf-ct-start', s1); h.input('#wf-ct-end', e1);
  h.act('wf-ct-pick-point');
  ok('16 point picker respects the whole contract range', () => {
    assert(/Chọn điểm khả dụng/.test(h.modal()) && /data-act="avail-pick"/.test(h.modal()));
    A.IN['avail-search']({ value: pBlocked.code });
    assert(!new RegExp('data-act="avail-pick" data-id="' + pBlocked.id + '"').test(h.modal()), 'overlapping future contract hides the point');
    A.IN['avail-search']({ value: pA.code });
    assert(new RegExp('data-act="avail-pick" data-id="' + pA.id + '"').test(h.modal()));
    assert(!/data-act="avail-create"/.test(h.modal()), 'selection mode has no create action');
  });
  h.act('avail-pick', { id: pA.id });
  ok('picked point returns to the same form', () => { assert(new RegExp('id="wf-ct-stall" value="' + pA.id + '"').test(h.modal())); assert(/data-act="wf-contract-save"/.test(h.modal())); });
  h.input('#wf-ct-stall', pA.id);
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
    assert.strictEqual(A.idx.stall.get(pA.id).status, 'trong', 'a future-start contract does not displace today\'s occupancy fields');
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
    h.act('wf-ct-pick-point'); A.IN['avail-search']({ value: pB.code });
    h.act('avail-pick', { id: pB.id }); h.input('#wf-ct-stall', pB.id);
    h.act('wf-contract-save');
    cB = A.db.contracts.at(-1);
    assert.strictEqual(cB.traderId, 'PX-002'); assert.strictEqual(cB.stallId, pB.id);
    const st = A.idx.stall.get(pB.id);
    assert.strictEqual(st.status, 'thue'); assert.strictEqual(st.contractId, cB.id); assert(A.idx.trader.get('PX-002').stalls.includes(pB.id));
    assert.strictEqual(A.mbStatusAt(st), 'thue');
  });
  ok('24 both contracts have the same data shape', () => assert.deepStrictEqual(Object.keys(cA).sort(), Object.keys(cB).sort()));
  ok('Flow C: overlapping contract on the same point is blocked', () => {
    h.act('wf-contract-open', { id: 'PX-003' });
    h.input('#wf-ct-trader', 'PX-003'); h.input('#wf-ct-stall', pB.id); h.input('#wf-ct-start', addDays(today, 30)); h.input('#wf-ct-end', addDays(today, 90));
    const n = A.db.contracts.length; h.act('wf-contract-save');
    assert.strictEqual(A.db.contracts.length, n); assert(h.trace.toasts.at(-1).includes(pB.code));
  });
  ok('terminating the current contract keeps a future contract from vacating/overwriting wrongly', () => {
    const f = A.features.contracts.service;
    f.terminate(cB.id, { date: today, reason: 'test', detail: 'test' }, { at: '', action: 't' });
    const st = A.idx.stall.get(pB.id);
    assert.strictEqual(st.status, 'trong'); assert(BP.isAvailable(pB.id, today));
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
    h.input('#wf-ct-trader', 'PX-RBAC'); h.input('#wf-ct-stall', free[0].id); h.input('#wf-ct-start', A.U.today()); h.input('#wf-ct-end', addDays(A.U.today(), 30));
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

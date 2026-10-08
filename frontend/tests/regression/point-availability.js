/* Focused regression: ONE availability rule shared by Mặt bằng, Hồ sơ tiểu thương and Hợp đồng
 * (business-points service: isAvailable / availablePoints / contractOn / freeSince) + Mặt bằng status at a date.
 * Migrated from the retired trader-contract-point.js (cases 1–9, which never depended on the old create form). */
const assert = require('assert');
const path = require('path');
const { createApp } = require('./harness');
const root = path.resolve(__dirname, '../..');

const addDays = (d, n) => new Date(Date.parse(d) + n * 86400000).toISOString().slice(0, 10);
const login = (A, id, market) => { A.ui.sessionAccountId = id; A.ui.market = market || 'CL'; A.syncAccountContext(); };
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
  // Fixture contracts use the canonical persisted statuses (ACTIVE / PENDING_LIQUIDATION / LIQUIDATED) — the raw
  // legacy names (hieuluc/chamdut/thanhly) are only normalised at load time, not for records pushed afterwards.
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
  add({ id: 'T-ENDED', stallId: p3.id, start: addDays(today, -400), end: yesterday, status: 'ACTIVE' });
  ok('3 contract ended yesterday → available today, "trống từ" = today', () => { assert(BP.isAvailable(p3.id, today)); assert.strictEqual(BP.freeSince(p3.id, today), today); });
  const fStart = addDays(today, 30), fEnd = addDays(today, 395);
  add({ id: 'T-FUTURE', stallId: p4.id, start: fStart, end: fEnd, status: 'ACTIVE' });
  ok('4 future contract does not block an earlier single date', () => assert(BP.isAvailable(p4.id, today)));
  ok('5 future contract blocks an overlapping range', () => { assert(!BP.isAvailable(p4.id, today, addDays(today, 60))); assert(!BP.availablePoints('CL', today, addDays(today, 60)).some(p => p.id === p4.id)); });
  ok('6 range ending before the future contract → available', () => assert(BP.isAvailable(p4.id, today, addDays(fStart, -1))));
  ok('7 wrong market excluded', () => { assert(!BP.availablePoints('CL', today).some(p => p.id === ttd.id)); assert(!BP.isAvailable(ttd.id, today, today, { market: 'CL' })); });
  add({ id: 'T-TERM', stallId: p6.id, start: addDays(today, -200), end: addDays(today, 500), status: 'PENDING_LIQUIDATION', endReason: 'EARLY_TERMINATION', termination: { date: addDays(today, -3) } });
  add({ id: 'T-LIQ', stallId: p7.id, start: addDays(today, -500), end: addDays(today, -10), status: 'LIQUIDATED' });
  add({ id: 'T-DRAFT', stallId: p8.id, start: addDays(today, -10), end: addDays(today, 300), status: 'nhap' });
  ok('8 lifecycle: terminated/liquidated/non-effective handled by real status', () => {
    // Dữ liệu cũ "đã chấm dứt – chờ thanh lý": khoảng chiếm dụng kết thúc trước ngày chấm dứt (freeSince), nhưng điểm
    // vẫn bị khoá bàn giao (BP.pendingHandover) — giữ nguyên dữ liệu legacy, không có luồng thanh lý mới.
    assert(!BP.isAvailable(p6.id, today), 'legacy pending-liquidation keeps the point locked');
    assert(BP.pendingHandover(p6.id, today), 'locked by the legacy pending-liquidation contract');
    assert(!BP.isAvailable(p6.id, addDays(today, -5), today), 'occupied before termination date');
    assert.strictEqual(BP.freeSince(p6.id, today), addDays(today, -3));
    assert(BP.isAvailable(p7.id, today) && !BP.isAvailable(p7.id, addDays(today, -20)), 'liquidated contract occupied its full term');
    assert(BP.isAvailable(p8.id, today), 'unknown/draft status never occupies');
    pNgung.operationalStatus = 'suspended';
    assert(!BP.isAvailable(pNgung.id, today), 'Tạm ngừng point is not allocatable');
    pNgung.operationalStatus = 'active';
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
    // Scope 10/2026: hết hạn KHÔNG giải phóng điểm — sau ngày kết thúc điểm vẫn "Đang thuê" bởi hợp đồng đã hết hạn
    // (thay cho quy tắc cũ "trống từ ngày sau khi hết hạn").
    const occContract = BP.contractOn(occupied.id, today), occEnd = BP.occupyingInterval(occContract).end;
    A.mbSetStatusDate(addDays(occEnd, 1));
    assert.strictEqual(A.mbStatusAt(occupied), 'thue', 'still Đang thuê the day after its contract ends');
    assert.strictEqual(BP.contractOn(occupied.id, addDays(occEnd, 1)).id, occContract.id, 'held by the expired contract');
    A.ui.mb.filter.status = 'thue';
    assert(A.mbCurrentPoints('CL').some(p => p.id === occupied.id), 'chip filter follows the selected date');
    A.mbSetStatusDate(addDays(fStart, 5)); A.ui.mb.filter.status = 'thue';
    assert(A.mbCurrentPoints('CL').some(p => p.id === p4.id), 'chip filter: future contract occupies on a date inside it');
    const stats = A.mbMarketStats('CL');
    assert.strictEqual(Object.values(stats.byStatus).reduce((a, b) => a + b, 0), stats.total, 'badges partition all points');
    A.ui.mb.filter.status = ''; A.mbSetStatusDate(null);
    pNgung.operationalStatus = 'suspended'; assert.strictEqual(A.mbStatusAt(pNgung), 'ngung'); pNgung.operationalStatus = 'active';
  });
}

console.log(`point-availability regression PASS (${passed} checks)`);

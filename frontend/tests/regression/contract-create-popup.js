/* Focused regression: popup "Tạo hợp đồng" cho tiểu thương ĐÃ CÓ hồ sơ tại chợ hiện tại.
 * A. tìm hồ sơ theo (chợ hiện tại, SĐT) — không qua tài khoản, không lấy chợ khác, không tạo hồ sơ/tài khoản;
 * C. Khối/Nhà → Tầng? → Dãy → Loại diện tích → Điểm còn trống trong thời hạn; D. phí từ điểm + biểu phí;
 * không còn mục Phương tiện; save kiểm tra lại toàn bộ; sau khi tạo, điểm suy trạng thái/người thuê từ hợp đồng. */
const assert = require('assert');
const path = require('path');
const { createApp } = require('./harness');

const ROOT = path.resolve(__dirname, '../..');
const h = createApp(ROOT);
const A = h.A;
const BP = A.features.businessPoints.service;
let passed = 0;
const ok = (label, fn) => { try { fn(); passed++; } catch (e) { e.message = label + ': ' + e.message; throw e; } };
const lastToast = () => h.trace.toasts[h.trace.toasts.length - 1] || '';
const addDays = (d, n) => { const x = new Date(d + 'T00:00:00Z'); x.setUTCDate(x.getUTCDate() + n); return x.toISOString().slice(0, 10); };
const today = A.U.today(), start = today, end = addDays(today, 365);
const login = (id, market) => { A.ui.sessionAccountId = id; A.ui.currentDemoAccountId = id; A.ui.market = market; A.syncAccountContext(); };
const accountsSnapshot = () => JSON.stringify(A.ACCOUNTS.list());

// ---- Fixtures (bộ nhớ harness) ----
const mkTrader = (id, market, phone) => { const t = { id, name: 'Hồ sơ ' + id, phone, market, idNo: 'ID' + id, idType: 'CCCD', stalls: [], source: 'STAFF', since: today, app: false }; A.db.traders.push(t); return t; };
const tCL = mkTrader('TX-CL-01', 'CL', '0962000001');
const tTTD = mkTrader('TX-TTD-05', 'TTD', '0962000001');   // cùng SĐT, chợ khác (Task 2 cho phép)
mkTrader('TX-TTD-ONLY', 'TTD', '0962000002');                // SĐT chỉ có ở chợ khác
A.reindex();
const withAccount = A.idx.trader.get('TT0003'); // có account ACTIVE (AC-TT03)
const noAccount = mkTrader('TX-CL-NOACC', 'CL', '0962000003'); A.reindex();

function open(phone) {
  login('AC-NV01', 'CL'); h.go('hop-dong'); h.act('ct-new');
  if (phone != null) { h.input('#wf-ct-phone', phone); h.act('wf-ct-find-trader'); }
  return h.modal();
}
function place(p, s, e) {
  const b = BP.building(p), f = BP.floor(p), r = BP.row(p);
  h.input('#wf-ct-start', s || start); h.input('#wf-ct-end', e || end);
  h.input('#wf-ct-building', b.id); h.input('#wf-ct-floor', f ? f.id : ''); h.input('#wf-ct-row', r.id); h.input('#wf-ct-areaType', p.areaTypeId); h.input('#wf-ct-point', p.id);
  pick('point', p.id);
}
const free = (pred, s, e) => A.db.stalls.filter(p => p.market === 'CL' && BP.row(p) && BP.isAvailable(p.id, s || start, e || end) && A.U.appliedStallPrice(p) && pred(p));
const pick = (k, v) => { h.input('#wf-ct-' + k, v); A.CH['wf-ct-location']({ value: v, dataset: { k } }); };
const saveNew = () => { const n = A.db.contracts.length; h.act('wf-contract-save'); return A.db.contracts.length > n ? A.db.contracts[A.db.contracts.length - 1] : null; };

ok('A/B. (CL, phone) resolves the CL profile only, even if the same phone exists in TTD', () => {
  const html = open('0962 000 001');
  assert(html.includes('Đã tìm thấy hồ sơ') && html.includes(tCL.id) && !html.includes(tTTD.id));
  assert(html.includes('Tên tiểu thương') && html.includes('Mã hồ sơ') && html.includes('Số điểm đang thuê'));
  assert(!/id="wf-ct-trader"/.test(html), 'no long trader dropdown');
});
ok('C. phone only in another Market → not found, no contract', () => {
  const html = open('0962000002');
  assert(html.includes('Không tìm thấy hồ sơ tiểu thương tại chợ này.'));
  const p = free(() => true)[0]; place(p);
  assert.strictEqual(saveNew(), null);
  assert(/tìm hồ sơ tiểu thương/.test(lastToast()));
});
ok('D. unknown phone → no Trader/Account created', () => {
  const nT = A.db.traders.length, acc = accountsSnapshot();
  const html = open('0962999999');
  assert(html.includes('Không tìm thấy hồ sơ tiểu thương tại chợ này.'));
  assert.strictEqual(A.db.traders.length, nT); assert.strictEqual(accountsSnapshot(), acc);
});
ok('P. popup has no "Phương tiện" section', () => {
  const html = open(null);
  assert(!/Phương tiện/.test(html) && !/phí gửi xe/.test(html));
  ['A. TIỂU THƯƠNG', 'B. THỜI HẠN', 'C. BỐ TRÍ ĐIỂM KINH DOANH', 'D. CHÍNH SÁCH THU', 'E. HỒ SƠ HỢP ĐỒNG', 'Loại diện tích'].forEach(x => assert(html.includes(x), x));
});
ok('G. building with Floor: Building → Floor → Row → AreaType → Point', () => {
  open(tCL.phone);
  const p = free(x => BP.floor(x))[0]; assert(p, 'fixture');
  h.input('#wf-ct-start', start); h.input('#wf-ct-end', end);
  pick('building', BP.building(p).id);
  assert(/id="wf-ct-floor"/.test(h.modal()));
  pick('floor', BP.floor(p).id);
  pick('row', BP.row(p).id);
  pick('areaType', p.areaTypeId);
  assert(new RegExp('option value="' + p.id + '"').test(h.modal()));
});
ok('H. building without Floor does not require Floor', () => {
  open(tCL.phone);
  const p = free(x => !BP.floor(x))[0]; assert(p, 'fixture');
  h.input('#wf-ct-start', start); h.input('#wf-ct-end', end); h.input('#wf-ct-floor', '');
  pick('building', BP.building(p).id);
  assert(!/id="wf-ct-floor"/.test(h.modal()));
  pick('row', BP.row(p).id);
  pick('areaType', p.areaTypeId);
  assert(new RegExp('option value="' + p.id + '"').test(h.modal()));
});
ok('I/J. changing AreaType re-filters points; other AreaType not listed and blocked at save', () => {
  open(tCL.phone);
  // Dãy có ≥2 điểm trống; nếu chưa có 2 loại diện tích thì đổi loại của 1 điểm trống (chỉ trong bộ nhớ test).
  const freeOf = r => BP.pointsOfRow(r.id).filter(p => BP.isAvailable(p.id, start, end) && A.U.appliedStallPrice(p));
  const row = A.db.rows.filter(r => r.market === 'CL' && BP.floor(BP.pointsOfRow(r.id)[0] || {})).find(r => freeOf(r).length >= 2);
  const pts = freeOf(row);
  const cov = pts[0];
  let unc = pts.find(p => p.areaTypeId !== cov.areaTypeId);
  if (!unc) { unc = pts[1]; unc.areaTypeId = cov.areaTypeId === 'covered' ? 'uncovered' : 'covered'; }
  assert(cov && unc && cov.areaTypeId !== unc.areaTypeId, 'fixture row has two area types free');
  h.input('#wf-ct-start', start); h.input('#wf-ct-end', end);
  pick('building', BP.building(cov).id);
  pick('floor', BP.floor(cov).id);
  pick('row', row.id);
  pick('areaType', cov.areaTypeId);
  assert(h.modal().includes('option value="' + cov.id + '"') && !h.modal().includes('option value="' + unc.id + '"'));
  pick('areaType', unc.areaTypeId);
  assert(h.modal().includes('option value="' + unc.id + '"') && !h.modal().includes('option value="' + cov.id + '"'));
  // cố tình ghép điểm sai loại diện tích vào form → save chặn
  h.input('#wf-ct-areaType', unc.areaTypeId); h.input('#wf-ct-point', cov.id);
  assert.strictEqual(saveNew(), null);
});
ok('K. point with an overlapping contract is not offered and save is blocked', () => {
  const busy = A.db.contracts.find(c => c.status === 'hieuluc' && c.market === 'CL' && BP.contractPhase(c, today) === 'current');
  const p = A.idx.stall.get(busy.businessPointId || busy.stallId);
  open(tCL.phone); place(p);
  assert(!h.modal().includes('option value="' + p.id + '"'));
  h.input('#wf-ct-point', p.id);
  assert.strictEqual(saveNew(), null);
});
ok('M. Trader.market !== Point.market → blocked', () => {
  open(tCL.phone);
  const ttdPoint = A.db.stalls.find(p => p.market === 'TTD' && BP.row(p) && BP.isAvailable(p.id, start, end));
  place(ttdPoint);
  assert.strictEqual(saveNew(), null);
});
ok('N. A03 collector cannot open or save a contract', () => {
  login('AC-NV02', 'CL'); A.closeModal(); h.act('ct-new');
  assert(!/wf-contract-save/.test(h.modal()));
  open(tCL.phone); place(free(() => true)[0]);
  login('AC-NV02', 'CL');
  assert.strictEqual(saveNew(), null);
});
let created, createdPoint, accBefore;
ok('L/F/O/Q. vacant point + profile without account → contract created; no account change; data from source', () => {
  accBefore = accountsSnapshot();
  const html = open(noAccount.phone);
  assert(html.includes(noAccount.id));
  createdPoint = free(x => x.areaTypeId === 'covered')[0];
  place(createdPoint);
  const d = h.modal();
  assert(d.includes(A.U.areaTypeLabel(createdPoint.areaTypeId)) && d.includes(createdPoint.area + ' m²'), 'fee panel from point');
  created = saveNew();
  assert(created, lastToast());
  assert.strictEqual(created.traderId, noAccount.id); assert.strictEqual(created.businessPointId, createdPoint.id); assert.strictEqual(created.market, 'CL');
  assert.strictEqual(accountsSnapshot(), accBefore, 'no account created/linked/changed');
  ['industry', 'area', 'areaTypeId'].forEach(k => assert(!(k in created), 'contract does not duplicate ' + k));
  const pol = A.U.appliedStallPrice(createdPoint);
  if (/m²\/ngày/.test(pol.unit)) assert.strictEqual(created.monthly, Math.round(createdPoint.area * pol.amount * 30 / 1000) * 1000);
});
ok('E. profile with an ACTIVE account can still get a contract (account untouched)', () => {
  accBefore = accountsSnapshot();
  open(withAccount.phone);
  const p = free(x => x.id !== createdPoint.id)[0]; place(p);
  const c = saveNew();
  assert(c && c.traderId === withAccount.id, lastToast());
  assert.strictEqual(accountsSnapshot(), accBefore);
});
ok('after save: point resolves "thue" + trader name from the contract; detail shows trader + contract', () => {
  assert.strictEqual(A.pointDisplayStatus(createdPoint), 'thue');
  assert.strictEqual(A.D.STATUS.thue.label, 'Đang kinh doanh');
  assert.strictEqual(BP.occupantId(createdPoint), noAccount.id);
  assert.strictEqual(BP.contractOn(createdPoint.id, today).id, created.id);
  A.openDkDrawer(createdPoint);
  const html = Array.from(h.registry.values()).map(e => e.innerHTML || '').join(' ');
  assert(html.includes(noAccount.name) && html.includes(created.id), 'point detail shows trader + contract');
  A.closeModal();
});
ok('one trader, several points: each point resolves the same trader via its own contract', () => {
  open(noAccount.phone);
  const p2 = free(x => x.id !== createdPoint.id)[0]; place(p2);
  const c2 = saveNew(); assert(c2, lastToast());
  assert.strictEqual(BP.occupantId(createdPoint), noAccount.id);
  assert.strictEqual(BP.occupantId(p2), noAccount.id);
  assert.notStrictEqual(c2.id, created.id);
});
ok('future contract is not "thue" today; ended contract leaves the point vacant', () => {
  const fs = addDays(today, 20), fe = addDays(today, 200);
  open(tCL.phone);
  const pf = free(() => true, fs, fe).find(p => BP.isAvailable(p.id, today, fe));
  place(pf, fs, fe);
  const cf = saveNew(); assert(cf, lastToast());
  assert.strictEqual(A.pointDisplayStatus(pf), 'trong', 'today still vacant');
  assert.strictEqual(BP.nextOccupancy(pf.id, today).contract.id, cf.id);
  assert.strictEqual(A.pointDisplayStatus(pf, fs), 'thue', 'rented from start date');
  assert.strictEqual(A.pointDisplayStatus(pf, addDays(fe, 1)), 'trong', 'vacant after the term ends');
});
ok('reload keeps contract-derived status and trader', () => {
  const snap = {}; h.localStorage._m.forEach((v, k) => { snap[k] = v; });
  const B = createApp(ROOT, { storage: snap }).A;
  const p = B.idx.stall.get(createdPoint.id);
  assert.strictEqual(B.pointDisplayStatus(p), 'thue');
  assert.strictEqual(B.features.businessPoints.service.occupantId(p), noAccount.id);
});

console.log(`contract-create-popup regression PASS (${passed} checks)`);

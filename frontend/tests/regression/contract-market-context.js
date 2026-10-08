/* Focused regression: MARKET CONTEXT của luồng tạo hợp đồng (màn Hợp đồng — tạo từ hồ sơ đăng ký thuê).
 * selectedMarket (ui.market) === Trader.market === Contract.market === Point.market — kiểm tra ở handler VÀ service;
 * đổi chợ đang chọn khi form còn mở → huỷ bản nháp, không lưu sang chợ mới. */
const assert = require('assert');
const path = require('path');
const { createApp } = require('./harness');

const h = createApp(path.resolve(__dirname, '../..'));
const A = h.A;
const BP = A.features.businessPoints.service, CS = A.features.contracts.service, TS = A.features.traders.service;
let passed = 0;
const ok = (label, fn) => { try { fn(); passed++; } catch (e) { e.message = label + ': ' + e.message; throw e; } };
const lastToast = () => h.trace.toasts[h.trace.toasts.length - 1] || '';
const addDays = (d, n) => { const x = new Date(d + 'T00:00:00Z'); x.setUTCDate(x.getUTCDate() + n); return x.toISOString().slice(0, 10); };
const today = A.U.today(), end = addDays(today, 180);
const setMarket = m => { A.ui.sessionAccountId = 'AC-NV01'; A.ui.currentDemoAccountId = 'AC-NV01'; A.ui.market = m; A.syncAccountContext(); };
const mk = (id, market, phone) => { const t = { id, name: 'Hồ sơ ' + id, phone, market, idNo: 'ID' + id, idType: 'CCCD', stalls: [], source: 'STAFF', since: today, app: false }; A.db.traders.push(t); return t; };
const tCL = mk('MC-CL', 'CL', '0944000001'), tTTD = mk('MC-TTD', 'TTD', '0944000001'); A.reindex();
const free = m => A.db.stalls.filter(p => p.market === m && BP.row(p) && BP.isAvailable(p.id, today, end) && A.U.appliedStallPrice(p));
const pCL = free('CL')[0], pTTD = free('TTD')[0];
assert(pCL && pTTD, 'fixture: free points in CL and TTD');
// Hồ sơ cùng SĐT ở hai chợ, mỗi hồ sơ đăng ký một điểm của CHỢ MÌNH (rentalDraft chỉ nhận điểm cùng chợ).
assert(TS.setRentalDraft(tCL.id, [{ pointId: pCL.id, charges: { land: true }, feeRefs: {} }]));
assert(TS.setRentalDraft(tTTD.id, [{ pointId: pTTD.id, charges: { land: true }, feeRefs: {} }]));
const ws = () => A.ui.contractWs;
const openFor = (market, traderId) => { setMarket(market); h.go('hop-dong'); A.closeModal(); h.act('ct-new', traderId ? { trader: traderId } : {}); return traderId ? h.view() : h.modal(); };
const fillDates = pointId => { A.CH['ctw-row']({ dataset: { id: pointId, k: 'start' }, value: today }); A.CH['ctw-row']({ dataset: { id: pointId, k: 'end' }, value: end }); };
const save = () => { const n = A.db.contracts.length; h.act('ctw-submit'); return A.db.contracts.length > n ? A.db.contracts[A.db.contracts.length - 1] : null; };
const snapshot = () => JSON.stringify([A.db.contracts.length, A.db.traders.map(t => [t.id, t.stalls, t.rentalDraft || null]), A.db.stalls.map(p => [p.id, p.status, p.usageStatus, p.traderId || null])]);

ok('same phone in CL/TTD: selectedMarket decides the profile', () => {
  let html = openFor('CL');
  assert(html.includes(tCL.id) && !html.includes(tTTD.id), 'CL selector lists only the CL profile');
  html = openFor('TTD');
  assert(html.includes(tTTD.id) && !html.includes(tCL.id), 'TTD selector lists only the TTD profile');
  A.closeModal();
});
ok('selectedMarket=CL + Trader CL + Point CL → allowed, Contract.market = selectedMarket', () => {
  openFor('CL', tCL.id); fillDates(pCL.id);
  const c = save();
  assert(c, lastToast());
  assert.strictEqual(c.market, 'CL'); assert.strictEqual(c.traderId, tCL.id);
  assert.strictEqual(A.idx.stall.get(c.businessPointId).market, 'CL');
});
ok('selectedMarket=CL + Trader TTD → blocked (no form for a profile of another market)', () => {
  setMarket('CL'); A.closeModal(); A.ui.contractWs.create = null;
  h.act('ct-new', { trader: tTTD.id });
  assert(!ws().create && /chợ khác chợ đang chọn/.test(lastToast()));
  h.act('ctw-open-create', { id: tTTD.id });
  assert(!ws().create, 'any entry (profile button, legacy action) refuses it');
});
ok('selectedMarket=CL + Point TTD → blocked, nothing mutated', () => {
  const t2 = mk('MC-CL-2', 'CL', '0944000002'); A.reindex();
  const before = snapshot();
  assert.strictEqual(TS.setRentalDraft(t2.id, [{ pointId: free('TTD')[0].id, charges: { land: true }, feeRefs: {} }]), null, 'a TTD point cannot be registered for a CL profile');
  const res = CS.createFromRentalDraft(t2.id, [{ pointId: free('TTD')[0].id, start: today, end }]);
  assert(!res.ok, 'service refuses a point outside the profile/market');
  assert.strictEqual(snapshot(), before);
});
ok('Trader CL + Point TTD at service level → rejected without partial writes', () => {
  const p = free('TTD')[0], before = snapshot();
  const res = CS.createWithPointAllocation({ contract: { id: 'HĐ-X', traderId: tCL.id, stallId: p.id, businessPointId: p.id, market: 'CL', start: today, end, status: 'hieuluc', history: [] }, traderId: tCL.id, pointId: p.id, pointHistoryEntry: 'x' });
  assert.strictEqual(res, null);
  assert.strictEqual(snapshot(), before);
  const res2 = CS.createWithPointAllocation({ contract: { id: 'HĐ-Y', traderId: tCL.id, stallId: p.id, businessPointId: p.id, market: 'TTD', start: today, end, status: 'hieuluc', history: [] }, traderId: tCL.id, pointId: p.id, pointHistoryEntry: 'x' });
  assert.strictEqual(res2, null, 'contract.market must equal trader.market');
});
ok('changing selectedMarket while the draft is open never saves the old draft into the new Market', () => {
  openFor('TTD', tTTD.id); fillDates(pTTD.id);
  assert(ws().create, 'draft open');
  const before = snapshot();
  A.ui.market = 'CL';
  assert.strictEqual(save(), null);
  assert(/Chợ đang chọn đã thay đổi/.test(lastToast()));
  assert(!ws().create, 'draft dropped');
  assert.strictEqual(snapshot(), before);
  h.act('ctw-submit'); // bản nháp đã huỷ → không làm gì
  assert.strictEqual(snapshot(), before);
});
ok('no specific Market selected (ALL) → cannot open the contract form', () => {
  A.ui.sessionAccountId = 'AC-NV01'; A.ui.market = 'ALL'; A.closeModal(); A.ui.contractWs.create = null;
  h.act('ct-new');
  assert(!/ctw-pick-trader/.test(h.modal()) && !ws().create);
});

console.log(`contract-market-context regression PASS (${passed} checks)`);

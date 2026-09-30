/* Focused regression: MARKET CONTEXT của luồng tạo hợp đồng.
 * selectedMarket (ui.market) === Trader.market === Contract.market === Point.market — kiểm tra ở handler VÀ service;
 * đổi chợ đang chọn khi form còn mở → huỷ bản nháp, không lưu sang chợ mới. */
const assert = require('assert');
const path = require('path');
const { createApp } = require('./harness');

const h = createApp(path.resolve(__dirname, '../..'));
const A = h.A;
const BP = A.features.businessPoints.service, CS = A.features.contracts.service;
let passed = 0;
const ok = (label, fn) => { try { fn(); passed++; } catch (e) { e.message = label + ': ' + e.message; throw e; } };
const lastToast = () => h.trace.toasts[h.trace.toasts.length - 1] || '';
const addDays = (d, n) => { const x = new Date(d + 'T00:00:00Z'); x.setUTCDate(x.getUTCDate() + n); return x.toISOString().slice(0, 10); };
const today = A.U.today(), end = addDays(today, 180);
const setMarket = m => { A.ui.sessionAccountId = 'AC-NV01'; A.ui.currentDemoAccountId = 'AC-NV01'; A.ui.market = m; A.syncAccountContext(); };
const mk = (id, market, phone) => { const t = { id, name: 'Hồ sơ ' + id, phone, market, idNo: 'ID' + id, idType: 'CCCD', stalls: [], source: 'STAFF', since: today, app: false }; A.db.traders.push(t); return t; };
const tCL = mk('MC-CL', 'CL', '0944000001'), tTTD = mk('MC-TTD', 'TTD', '0944000001'); A.reindex();
const free = m => A.db.stalls.filter(p => p.market === m && BP.row(p) && BP.isAvailable(p.id, today, end) && A.U.appliedStallPrice(p));
const place = p => {
  const b = BP.building(p), f = BP.floor(p), r = BP.row(p);
  h.input('#wf-ct-start', today); h.input('#wf-ct-end', end);
  h.input('#wf-ct-building', b.id); h.input('#wf-ct-floor', f ? f.id : ''); h.input('#wf-ct-row', r.id); h.input('#wf-ct-areaType', p.areaTypeId); h.input('#wf-ct-point', p.id);
};
const openFor = (market, phone) => { setMarket(market); h.go('hop-dong'); h.act('ct-new'); if (phone) { h.input('#wf-ct-phone', phone); h.act('wf-ct-find-trader'); } return h.modal(); };
const save = () => { const n = A.db.contracts.length; h.act('wf-contract-save'); return A.db.contracts.length > n ? A.db.contracts[A.db.contracts.length - 1] : null; };
const snapshot = () => JSON.stringify([A.db.contracts.length, A.db.traders.map(t => [t.id, t.stalls]), A.db.stalls.map(p => [p.id, p.status, p.traderId || null])]);

ok('same phone in CL/TTD: selectedMarket decides the profile', () => {
  let html = openFor('CL', '0944000001');
  assert(html.includes(tCL.id) && !html.includes(tTTD.id) && /Chợ: <b>Chợ Cao Lãnh<\/b>/.test(html));
  html = openFor('TTD', '0944000001');
  assert(html.includes(tTTD.id) && !html.includes(tCL.id));
  A.closeModal();
});
ok('selectedMarket=CL + Trader CL + Point CL → allowed, Contract.market = selectedMarket', () => {
  openFor('CL', tCL.phone); place(free('CL')[0]);
  const c = save();
  assert(c, lastToast());
  assert.strictEqual(c.market, 'CL'); assert.strictEqual(c.traderId, tCL.id);
  assert.strictEqual(A.idx.stall.get(c.businessPointId).market, 'CL');
});
ok('selectedMarket=CL + Trader TTD → blocked (locked open and phone lookup)', () => {
  setMarket('CL'); A.closeModal();
  h.act('wf-contract-open', { id: tTTD.id });
  assert(!/wf-contract-save/.test(h.modal()) && /chợ khác chợ đang chọn/.test(lastToast()));
  const html = openFor('CL', '0944000009');
  assert(html.includes('Không tìm thấy hồ sơ tiểu thương tại chợ này.'));
});
ok('selectedMarket=CL + Point TTD → blocked, nothing mutated', () => {
  openFor('CL', tCL.phone);
  const before = snapshot();
  place(free('TTD')[0]);
  assert.strictEqual(save(), null);
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
  openFor('CL', tCL.phone); place(free('CL')[0]);
  const before = snapshot();
  A.ui.market = 'TTD';
  assert.strictEqual(save(), null);
  assert(/Chợ đang chọn đã thay đổi/.test(lastToast()));
  assert.strictEqual(h.modal(), '', 'draft dropped');
  assert.strictEqual(snapshot(), before);
  h.act('wf-contract-save'); // bản nháp đã huỷ → không làm gì
  assert.strictEqual(snapshot(), before);
});
ok('no specific Market selected (ALL) → cannot open the contract form', () => {
  A.ui.sessionAccountId = 'AC-NV01'; A.ui.market = 'ALL'; A.closeModal();
  h.act('ct-new');
  assert(!/wf-contract-save/.test(h.modal()));
});

console.log(`contract-market-context regression PASS (${passed} checks)`);

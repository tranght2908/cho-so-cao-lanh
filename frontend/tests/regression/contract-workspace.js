/* Focused regression: màn "Hợp đồng" — scope 10/2026.
 * Tạo hợp đồng từ hồ sơ đăng ký thuê (trader.rentalDraft): 1 điểm = 1 hợp đồng, ngày riêng từng điểm, chọn một phần,
 * rollback toàn batch. Trạng thái chỉ Chưa hiệu lực / Còn hiệu lực / Đã hết hạn; hết hạn CHỈ cảnh báo, không side effect.
 * Gia hạn / Chấm dứt / Thanh lý đã retire khỏi UI. Chi tiết đọc bản chụp priceTerms. CASE n = mục 27 của yêu cầu. */
const assert = require('assert');
const path = require('path');
const { createApp } = require('./harness');

const ROOT = path.resolve(__dirname, '../..');
const h = createApp(ROOT), A = h.A;
const TS = A.features.traders.service, BP = A.features.businessPoints.service, CS = A.features.contracts.service, L = A.features.lifecycle.service;
let passed = 0;
const ok = (label, fn) => { try { fn(); passed++; } catch (e) { console.error("FAILED: " + label); e.message = label + ': ' + e.message; throw e; } };
const login = (id, market) => { A.ui.sessionAccountId = id; A.ui.currentDemoAccountId = id; A.ui.market = market; A.syncAccountContext(); };
const today = A.U.today(), add = n => { const d = new Date(today + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
const M = 'CL';
login('AC-NV01', M);
const priced = BP.availablePoints(M, today, add(400)).filter(p => { const x = CS.rentalPriceTerms({ charges: { land: true } }, p, today); return x && x.land; });
assert(priced.length >= 6, 'need 6 free priced points in ' + M + ', got ' + priced.length);
const PA = priced.slice(0, 3), PB = priced.slice(3, 6);
const mkTrader = (id, phone, idNo, pts) => {
  assert(TS.create({ id, name: 'Hồ sơ ' + id, phone, idType: 'CCCD', idNo, address: 'Khóm 1', market: M, stalls: [], status: 'WAITING_ALLOCATION', source: 'STAFF', since: today }), 'create ' + id);
  assert(TS.setRentalDraft(id, pts.map(p => ({ pointId: p.id, charges: { land: true, electricity: false, water: false, marketService: false }, feeRefs: {} }))));
  return TS.getProfile(id);
};
const tA = mkTrader('TT-CTW-A', '0977300001', 'CTW-ID-001', PA), tB = mkTrader('TT-CTW-B', '0977300002', 'CTW-ID-002', PB);
const ws = () => A.ui.contractWs, d = () => ws().create;
const row = id => d().rows.find(r => r.pointId === id);
const setRow = (id, k, value) => A.CH['ctw-row']({ dataset: { id, k }, value });
const view = () => h.view();
const RETIRED_ACTS = /data-act="ct-(renew|extend|terminate|liquidate|end)"|>Gia hạn<|>Chấm dứt<|>Thanh lý</;

ok('list: header, subtitle, + Tạo hợp đồng, KPI Tổng / Còn hiệu lực / Sắp hết hạn / Đã hết hạn, Khoảng hiệu lực', () => {
  h.go('hop-dong');
  const v = view();
  assert(/<h2>Hợp đồng<\/h2>/.test(v) && v.includes('Quản lý hợp đồng thuê điểm kinh doanh của tiểu thương.'));
  assert(/data-act="ct-new">\+ Tạo hợp đồng</.test(v));
  ['Tổng hợp đồng', 'Còn hiệu lực', 'Sắp hết hạn', 'Đã hết hạn'].forEach(k => assert(v.includes('<div class="k-label">' + k + '</div>'), k));
  assert(!/Chờ thanh lý<\/div>/.test(v), 'no "Chờ thanh lý" KPI');
  ['Mã HĐ', 'Tiểu thương', 'Điểm KD', 'Loại diện tích', 'Ngày bắt đầu', 'Ngày kết thúc', 'Thời hạn', 'Trạng thái', 'Thao tác'].forEach(k => assert(v.includes('<th class="">' + k + '</th>'), 'col ' + k));
  assert(/<legend>Khoảng hiệu lực<\/legend>/.test(v) && v.includes('data-ch="ctw-from"') && v.includes('data-ch="ctw-to"'));
  assert(!/data-ch="[^"]*market/i.test(v), 'no own market selector');
  assert(!RETIRED_ACTS.test(v));
});
ok('RBAC: ward leader cannot open the create flow', () => {
  login('AC-LD01', M);
  assert(!A.canDo('hop-dong.tao', M));
  A.closeModal(); h.act('ct-new');
  assert(!/ctw-pick-trader/.test(h.modal()) && !(ws().create));
  login('AC-NV01', M);
});
ok('selector + profile button open the SAME new form (3 pending points)', () => {
  h.go('hop-dong'); h.act('ct-new');
  assert(h.modal().includes('data-id="TT-CTW-A"') && /3 điểm chờ tạo hợp đồng/.test(h.modal()));
  h.act('ctw-pick-trader', { id: tA.id });
  assert.strictEqual(ws().mode, 'create'); assert.strictEqual(d().rows.length, 3);
  ['A. Tiểu thương', 'B. Thời hạn mặc định', 'C. Điểm kinh doanh chờ tạo hợp đồng', 'Áp dụng cho tất cả'].forEach(k => assert(view().includes(k), k));
  A.ui.contractWs.create = null;
  h.act('tp-contracts', { id: tA.id });
  assert.strictEqual(ws().mode, 'create'); assert.strictEqual(d().traderId, tA.id); assert.strictEqual(d().rows.length, 3);
});
ok('saving a profile / rentalDraft alone keeps the points "Còn trống"', () => {
  PA.forEach(p => { assert.strictEqual(BP.displayStatus(BP.get(p.id)), 'trong'); assert.strictEqual(BP.get(p.id).usageStatus, 'VACANT'); assert(!BP.get(p.id).traderId); });
  assert.strictEqual(TS.deriveBusinessStatus(tA.id), 'PENDING_CONTRACT');
});
ok('CASE 16: "Áp dụng cho tất cả" copies to the rows; a row can still be edited on its own', () => {
  A.CH['ctw-def']({ dataset: { k: 'defStart' }, value: today });
  A.CH['ctw-def']({ dataset: { k: 'defEnd' }, value: add(364) });
  h.act('ctw-apply-all');
  PA.forEach(p => { assert.strictEqual(row(p.id).start, today); assert.strictEqual(row(p.id).end, add(364)); });
  setRow(PA[1].id, 'end', add(180));
  assert.strictEqual(row(PA[1].id).end, add(180));
  assert.strictEqual(row(PA[0].id).end, add(364)); assert.strictEqual(row(PA[2].id).end, add(364));
});
ok('end < start is blocked on that row only', () => {
  setRow(PA[2].id, 'end', add(-3));
  assert(view().includes('Ngày kết thúc phải từ ngày bắt đầu trở về sau.'));
  const n = A.db.contracts.length;
  h.act('ctw-submit');
  assert.strictEqual(A.db.contracts.length, n, 'nothing created');
  assert(d().errors[PA[2].id] && !d().errors[PA[0].id], 'error bound to row 3');
  setRow(PA[2].id, 'end', add(90));
});
ok('CASE 13: 2nd contract fails → whole batch rolled back (contracts, points, traders, rentalDraft, localStorage)', () => {
  const before = JSON.stringify({ c: A.db.contracts, s: A.db.stalls, t: A.db.traders });
  const orig = CS.createWithPointAllocation; let calls = 0;
  CS.createWithPointAllocation = function () { calls++; return calls === 2 ? null : orig.apply(this, arguments); };
  try { h.act('ctw-submit'); } finally { CS.createWithPointAllocation = orig; }
  assert(calls >= 2, 'second creation attempted');
  assert.strictEqual(JSON.stringify({ c: A.db.contracts, s: A.db.stalls, t: A.db.traders }), before, 'aggregates restored');
  assert(TS.rentalItems(TS.getProfile(tA.id)).every(x => x.status === 'pending_contract' && !x.contractId), 'rentalDraft pending');
  const stored = Array.from(h.localStorage._m.values()).join('');
  assert(stored.includes('TT-CTW-A'), 'profile is persisted (storage readable)');
  assert(!stored.includes('"traderId":"TT-CTW-A"'), 'no persisted contract / occupancy for the trader after rollback');
  PA.forEach(p => assert.strictEqual(BP.displayStatus(BP.get(p.id)), 'trong'));
});
let createdA;
ok('CASE 17: select 2 of 3 → only the selected rows get contracts; the third stays pending_contract', () => {
  A.CH['ctw-sel']({ dataset: { id: PA[2].id }, checked: false });
  assert(/Tạo 2 hợp đồng/.test(view()));
  const n = A.db.contracts.length;
  h.act('ctw-submit');
  assert.strictEqual(A.db.contracts.length, n + 2);
  createdA = ws().success.ids.map(id => CS.get(id));
  assert.strictEqual(JSON.stringify(createdA.map(c => c.businessPointId).sort()), JSON.stringify([PA[0].id, PA[1].id].sort()));
  const it3 = TS.rentalItems(TS.getProfile(tA.id)).find(x => x.pointId === PA[2].id);
  assert.strictEqual(it3.status, 'pending_contract'); assert(!it3.contractId);
  assert.strictEqual(BP.displayStatus(BP.get(PA[2].id)), 'trong');
  // D: có hợp đồng hiệu lực + còn điểm chờ → vẫn "Đang hoạt động" + chỉ báo.
  assert.strictEqual(TS.deriveBusinessStatus(tA.id), 'ACTIVE');
  h.act('ctw-open-trader', { id: tA.id });
  assert(/Còn 1 điểm chờ tạo hợp đồng/.test(view()));
});
let createdB;
ok('CASE 15 + CASE 14: own dates per point; every selected point linked to the right trader', () => {
  h.go('hop-dong'); h.act('ctw-list'); h.act('ct-new'); h.act('ctw-pick-trader', { id: tB.id });
  const dates = [[today, add(364)], [add(14), add(195)], [add(30), add(394)]];
  PB.forEach((p, i) => { setRow(p.id, 'start', dates[i][0]); setRow(p.id, 'end', dates[i][1]); });
  const n = A.db.contracts.length;
  h.act('ctw-submit');
  assert.strictEqual(A.db.contracts.length, n + 3);
  createdB = PB.map(p => A.db.contracts.find(c => c.businessPointId === p.id && c.traderId === tB.id));
  assert.strictEqual(new Set(createdB.map(c => c.id)).size, 3, 'unique sequential ids');
  createdB.forEach((c, i) => { assert.strictEqual(c.start, dates[i][0]); assert.strictEqual(c.end, dates[i][1]); assert(c.priceTerms && c.priceTerms.land); });
  // Hợp đồng bắt đầu hôm nay → điểm Đang thuê ngay; hợp đồng bắt đầu sau → giữ lịch, đổi khi tới ngày bắt đầu.
  assert.strictEqual(BP.get(PB[0].id).traderId, tB.id);
  createdA.forEach(c => assert.strictEqual(BP.get(c.businessPointId).traderId, tA.id));
  assert.strictEqual(CS.displayStatus(createdB[1]), 'UPCOMING');
  L.syncExpiry(add(30));
  PB.forEach(p => { assert.strictEqual(BP.occupantId(BP.get(p.id), add(30)), tB.id); assert.strictEqual(BP.displayStatus(BP.get(p.id), add(30)), 'thue'); });
});
ok('CASE 1 + CASE 3: success → point Còn trống → Đang thuê; rental items contracted with their contractId', () => {
  const p = BP.get(PA[0].id), c = createdA.find(x => x.businessPointId === PA[0].id);
  assert.strictEqual(p.usageStatus, 'RENTED'); assert.strictEqual(BP.displayStatus(p), 'thue'); assert.strictEqual(A.mbStatusLabel('thue'), 'Đang thuê');
  const items = TS.rentalItems(TS.getProfile(tA.id));
  createdA.forEach(x => { const it = items.find(i => i.pointId === x.businessPointId); assert.strictEqual(it.status, 'contracted'); assert.strictEqual(it.contractId, x.id); });
  assert.strictEqual(p.contractId, c.id);
  assert(TS.getProfile(tA.id).stalls.includes(PA[0].id), 'trader → point link');
});
ok('CASE 2: point resolves the trader name on point list / layout / point detail / profile', () => {
  const p = BP.get(PA[0].id), c = createdA.find(x => x.businessPointId === PA[0].id);
  assert.strictEqual(A.idx.trader.get(p.traderId).name, tA.name);
  h.go('mat-bang');
  if (A.ui.mb) { A.ui.mb.pointId = p.id; A.ui.mb.inspectorOpen = true; A.render(); }
  h.act('stall', { id: p.id });
  const html = view() + h.modal() + (h.el('#drawer-root') ? h.el('#drawer-root').innerHTML : '');
  assert(html.includes(tA.name), 'trader name shown for ' + p.code + ' on the layout');
  h.act('ctw-open-trader', { id: tA.id }); h.act('tp-tab', { tab: 'contracts' });
  assert(view().includes(c.id) && view().includes('Còn hiệu lực'), 'profile → contract with shared status');
});
ok('CASE 4: reload (same localStorage) → contracts, point links and rental items are still there', () => {
  const h2 = createApp(ROOT, { localStorage: h.localStorage }), A2 = h2.A, BP2 = A2.features.businessPoints.service, TS2 = A2.features.traders.service;
  createdA.forEach(c => {
    assert(A2.features.contracts.service.get(c.id), 'contract persisted ' + c.id);
    const p = BP2.get(c.businessPointId);
    assert.strictEqual(p.usageStatus, 'RENTED'); assert.strictEqual(p.traderId, tA.id); assert.strictEqual(BP2.displayStatus(p), 'thue');
  });
  assert(TS2.rentalItems(TS2.getProfile(tA.id)).filter(x => x.status === 'contracted').length === 2);
});
const c1 = () => createdB[0];
ok('detail: 4 blocks, priceTerms snapshot, only [In] — CASE 10/11/12: no Gia hạn / Chấm dứt / Thanh lý', () => {
  h.go('hop-dong'); h.act('ct-view', { id: c1().id });
  const v = view(), land = c1().priceTerms.land;
  ['Thông tin hợp đồng', 'Tiểu thương', 'Điểm kinh doanh', 'Khoản thu áp dụng'].forEach(k => assert(v.includes('<h3>' + k + '</h3>'), k));
  assert(v.includes('Áp dụng theo cấu hình tại thời điểm tạo hợp đồng.') && v.includes(A.U.money(land.amount)));
  assert(!RETIRED_ACTS.test(v), 'no retired action on detail');
  assert(/data-act="ct-print"/.test(v));
  // Handler UI cũ (gia hạn / chấm dứt / thanh lý / popup cũ / form tạo cũ) đã bị gỡ hẳn — không còn đăng ký.
  ['ct-renew', 'ct-renew-save', 'ct-extend', 'ct-end', 'ct-terminate', 'ct-terminate-save', 'ct-liquidate', 'ct-liquidate-save', 'ct-copy-add', 'hd-tab', 'wf-contract-open', 'wf-contract-save', 'wf-contract-worklist', 'wf-ct-find-trader', 'avail-pick'].forEach(k => assert.strictEqual(A.ACT[k], undefined, k + ' removed'));
  assert.strictEqual(A.contractDetailLayoutV2, undefined, 'old detail popup removed');
});
ok('price snapshot: changing fee config later does not change the old contract detail', () => {
  const land = c1().priceTerms.land, pol = A.SERVICE_CFG.list('stallPrices').find(x => x.id === land.policyId);
  const old = pol.amount; pol.amount = Number(old) * 3 + 1000;
  try { h.act('ct-view', { id: c1().id }); assert(view().includes(A.U.money(land.amount)) && !view().includes(A.U.money(pol.amount))); }
  finally { pol.amount = old; }
});
// ---- Hết hạn: mô phỏng thời gian trôi qua bằng cách đưa khoảng hiệu lực về quá khứ (cùng hiệu ứng như tới ngày sau end).
const expired = () => createdA.find(c => c.businessPointId === PA[0].id);
ok('expiry: lifecycle sync + reload normalisation produce NO side effect', () => {
  const c = expired();
  c.start = add(-400); c.end = add(-10); A.save();
  const snap = () => JSON.stringify({ c, p: BP.get(PA[0].id) && { u: BP.get(PA[0].id).usageStatus, r: BP.get(PA[0].id).usageReason }, t: TS.getProfile(tA.id), rd: TS.rentalItems(tA.id) });
  const before = snap();
  L.syncExpiry(); L.syncExpiry(add(5));
  if (L.normalizeAllMarkets) L.normalizeAllMarkets();
  TS.deriveBusinessStatus(tA.id);
  assert.strictEqual(snap(), before, 'nothing mutated by expiry');
});
ok('CASE 5 + CASE 6: badge "Đã hết hạn" + warning on the detail', () => {
  h.go('hop-dong'); h.act('ctw-list');
  A.IN['ctw-q']({ value: expired().id });
  assert(/<span class="tag danger">Đã hết hạn<\/span>/.test(view()));
  h.act('ctw-clear');
  h.act('ct-view', { id: expired().id });
  assert(view().includes(`Hợp đồng này đã hết hạn từ ngày ${A.U.dmy(expired().end)}.`));
  assert(!RETIRED_ACTS.test(view()));
});
ok('CASE 7 + CASE 8 + CASE 9: expired → point still Đang thuê, trader-point relation kept, not Chờ thanh lý', () => {
  const p = BP.get(PA[0].id), c = expired();
  assert.strictEqual(p.usageStatus, 'RENTED'); assert.strictEqual(BP.displayStatus(p), 'thue'); assert.strictEqual(p.traderId, tA.id); assert.strictEqual(p.contractId, c.id);
  assert(TS.getProfile(tA.id).stalls.includes(PA[0].id));
  assert.strictEqual(c.status, 'ACTIVE'); assert.notStrictEqual(c.status, 'PENDING_LIQUIDATION'); assert(!c.endReason);
  assert.strictEqual(TS.rentalItems(tA.id).find(x => x.pointId === PA[0].id).contractId, c.id);
  assert.strictEqual(TS.getProfile(tA.id).status, 'ACTIVE', 'trader not changed by expiry');
  assert(!BP.isAvailable(PA[0].id, add(1), add(30)), 'expired point is not handed to someone else automatically');
  // Reload: normalisation on load must not expire it either.
  const h2 = createApp(ROOT, { localStorage: h.localStorage }), c2 = h2.A.features.contracts.service.get(c.id);
  assert.strictEqual(c2.status, 'ACTIVE'); assert.strictEqual(h2.A.features.businessPoints.service.get(PA[0].id).usageStatus, 'RENTED');
});
ok('A: expired contract → trader stays "Đang hoạt động" (even with a point still pending) + indicator', () => {
  assert.strictEqual(CS.displayStatus(expired()), 'EXPIRED');
  assert(TS.rentalItems(tA.id).some(x => x.status === 'pending_contract'), 'fixture: tA still has a pending point');
  assert.strictEqual(TS.deriveBusinessStatus(tA.id), 'ACTIVE', 'Đang hoạt động, not Chờ tạo hợp đồng');
  h.go('tieu-thuong'); h.act('tp-detail-close');
  A.IN['tp-q']({ value: tA.id });
  assert(/Đang hoạt động/.test(view()) && /Còn 1 điểm chờ tạo hợp đồng/.test(view()));
  A.IN['tp-q']({ value: '' });
});
ok('D: expiry writes nothing about trader / point / rentalDraft into localStorage (sync + reload)', () => {
  const KEY = Array.from(h.localStorage._m.keys()).find(k => { try { const v = JSON.parse(h.localStorage.getItem(k)); return v && Array.isArray(v.contracts) && Array.isArray(v.stalls); } catch (e) { return false; } });
  assert(KEY, 'main data key');
  const pick = () => { const v = JSON.parse(h.localStorage.getItem(KEY)); return JSON.stringify({ t: v.traders.find(x => x.id === tA.id), p: v.stalls.find(x => x.id === PA[0].id), c: v.contracts.find(x => x.id === expired().id) }); };
  A.save();
  const before = pick();
  L.syncExpiry(); L.syncExpiry(add(60)); A.render();
  assert.strictEqual(pick(), before, 'after expiry sync');
  createApp(ROOT, { localStorage: h.localStorage }); // reload runs load-time normalisation and may save
  assert.strictEqual(pick(), before, 'after reload');
});
ok('E: ACTIVE-by-date and expired contracts — neither produces a side effect', () => {
  const live = createdB[0], snap = () => JSON.stringify([live, expired(), BP.get(PB[0].id).usageStatus, BP.get(PA[0].id).usageStatus, TS.getProfile(tA.id).status, TS.getProfile(tB.id).status, TS.rentalItems(tA.id), TS.rentalItems(tB.id)]);
  assert.strictEqual(CS.displayStatus(live), 'ACTIVE'); assert.strictEqual(CS.displayStatus(expired()), 'EXPIRED');
  const before = snap();
  assert.strictEqual(L.syncExpiry(), false, 'nothing changed');
  TS.deriveBusinessStatus(tA.id); TS.deriveBusinessStatus(tB.id);
  assert.strictEqual(snap(), before);
});
ok('KPI: Đã hết hạn counts the expired contract; Sắp hết hạn = còn hiệu lực ≤ 30 ngày', () => {
  h.go('hop-dong'); h.act('ctw-list');
  const all = CS.list().filter(c => c.market === M), v = view();
  const k = label => +(v.match(new RegExp(`k-label">${label}</div><div class="k-value">(\\d+)<`)) || [0, -1])[1];
  assert.strictEqual(k('Đã hết hạn'), all.filter(c => CS.displayStatus(c) === 'EXPIRED').length);
  assert(k('Đã hết hạn') >= 1);
  assert.strictEqual(k('Sắp hết hạn'), all.filter(c => CS.displayStatus(c) === 'ACTIVE' && A.U.days(today, c.end) <= 30).length);
});
ok('CASE 18: Khoảng hiệu lực uses overlap semantics (start <= Đến AND end >= Từ)', () => {
  const c = createdB[1]; // add(14) → add(195)
  const shown = (from, to) => { A.CH['ctw-from']({ value: from }); A.CH['ctw-to']({ value: to }); A.IN['ctw-q']({ value: c.id }); const r = view().includes('data-id="' + c.id + '"'); h.act('ctw-clear'); return r; };
  assert(shown(add(0), add(20)), 'starts inside the range');
  assert(shown(add(100), add(120)), 'range fully inside the contract (start not in range)');
  assert(shown(add(190), add(400)), 'ends inside the range');
  assert(!shown(add(0), add(13)), 'ends before contract start');
  assert(!shown(add(196), add(300)), 'starts after contract end');
});
ok('CASE 19: legacy statuses still readable — no crash, read-only, no actions', () => {
  const base = createdB[2];
  const legacy = [Object.assign({}, base, { id: 'HĐ-LEGACY-T', status: 'PENDING_LIQUIDATION', endReason: 'EARLY_TERMINATION', termination: { date: today, reason: 'Cũ' } }),
    Object.assign({}, base, { id: 'HĐ-LEGACY-L', status: 'LIQUIDATED', endReason: 'EXPIRED', liquidatedAt: today })];
  legacy.forEach(x => { x.businessPointId = x.stallId = 'LEGACY-NO-POINT'; A.db.contracts.push(x); });
  A.reindex();
  try {
    assert.strictEqual(CS.displayStatusLabel(legacy[0]), 'Đã chấm dứt (dữ liệu cũ)');
    assert.strictEqual(CS.displayStatusLabel(legacy[1]), 'Đã thanh lý (dữ liệu cũ)');
    h.act('ctw-list'); A.CH['ctw-status']({ value: 'LEGACY' });
    assert(view().includes('HĐ-LEGACY-T') && view().includes('HĐ-LEGACY-L'));
    h.act('ctw-clear');
    legacy.forEach(x => { h.act('ct-view', { id: x.id }); const v = view(); assert(v.includes('chỉ đọc') && !RETIRED_ACTS.test(v), x.id); });
  } finally { legacy.forEach(x => A.db.contracts.splice(A.db.contracts.indexOf(x), 1)); A.reindex(); }
});
ok('CASE 20: legacy create.js form is gone — workspace is the only create flow', () => {
  assert.strictEqual(A.features.contracts.form, undefined, 'old form facade removed');
  ['hop-dong', 'tieu-thuong'].forEach(r => { h.go(r); assert(!/wf-contract-|wf-ct-/.test(view()), r); });
  h.go('hop-dong'); h.act('ctw-list'); A.closeModal();
  h.act('ct-new'); assert(/ctw-pick-trader/.test(h.modal()) && !/wf-ct-/.test(h.modal()), 'ct-new opens the new selector');
  A.closeModal();
  // Trader drawer (Mặt bằng → Hồ sơ) "Tạo hợp đồng" now opens the same workspace form.
  h.act('trader', { id: tA.id });
  assert(new RegExp(`data-act="ctw-open-create" data-id="${tA.id}"`).test(h.modal()), 'drawer CTA → workspace');
  h.act('ctw-open-create', { id: tA.id });
  assert.strictEqual(ws().mode, 'create'); assert.strictEqual(d().traderId, tA.id);
  h.act('ctw-cancel');
});
ok('Mặt bằng → point not registered in any profile: no direct contract, guidance message', () => {
  const free = BP.availablePoints(M, today, add(30)).find(p => !CS.tradersWithPendingRental(M).some(t => CS.pendingRentalItems(t).some(x => x.pointId === p.id)));
  assert(free);
  A.closeModal(); h.act('ct-new', { point: free.id });
  assert.strictEqual(h.modal(), '');
  assert.strictEqual(h.trace.toasts.at(-1), 'Điểm kinh doanh này chưa được đăng ký trong hồ sơ tiểu thương. Vui lòng tạo hoặc cập nhật hồ sơ tiểu thương trước.');
  h.act('ct-new', { point: PA[2].id }); // registered (pending) in tA → form preselected
  assert.strictEqual(ws().mode, 'create'); assert.strictEqual(d().traderId, tA.id);
  assert.strictEqual(JSON.stringify(d().rows.filter(r => r.selected).map(r => r.pointId)), JSON.stringify([PA[2].id]));
  h.act('ctw-cancel');
});
console.log(`contract-workspace regression PASS (${passed} checks)`);

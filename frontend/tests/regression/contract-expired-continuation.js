/* Regression (Giai đoạn A, 10/2026): hợp đồng "Hết hạn – chờ xử lý" + xác nhận tình trạng sử dụng.
 * Hết hạn không đổi điểm KD / hồ sơ tiểu thương; Tổ trưởng xác nhận liên tục, bổ sung bất cứ lúc nào (lần đầu từ ngày sau ngày hết hạn, tối đa
 * 3 tháng / lần), hủy bản ghi mới nhất (đánh dấu, không xóa), ngừng sử dụng chặn xác nhận tiếp; NV thu phí bị chặn ở UI +
 * service; ghi chú hết hạn tách riêng; thông báo nội bộ chống trùng theo phạm vi chợ. Không đụng tính phí / phát hành.
 * Fixture chỉ tồn tại trong harness (ngày nghiệp vụ = A.db.today của seed), không chạm localStorage thật. */
const assert = require('assert');
const path = require('path');
const { createApp } = require('./harness');

const h = createApp(path.resolve(__dirname, '../..')), A = h.A;
const CS = A.features.contracts.service, BP = A.features.businessPoints.service, TS = A.features.traders.service, L = A.features.lifecycle.service;
const B = A.features.finance.billing, PN = A.personalNotifications;
let passed = 0;
const ok = (label, fn) => { try { fn(); passed++; } catch (e) { console.error('FAILED: ' + label); e.message = label + ': ' + e.message; throw e; } };
const login = (id, market) => { A.ui.sessionAccountId = id; A.ui.currentDemoAccountId = id; A.ui.market = market; A.syncAccountContext(); };
const TODAY = A.U.today();
const D = n => { const d = new Date(TODAY + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
const dmy = A.U.dmy;
const same = (a, b, m) => assert.strictEqual(JSON.stringify(a), JSON.stringify(b), m); // objects come from the vm realm
login('AC-NV01', 'CL');

// ---- Fixture: hợp đồng đã bắt đầu, đang thuê, rồi hết hạn (thời gian trôi qua) ----
const priced = p => { const x = B.buildPriceTerms('CL', p, p.area, TODAY, {}, 'X'); return x && x.land; };
const free = BP.availablePoints('CL', D(-400), D(900)).filter(priced);
let n = 0;
const mk = (label, end, opts) => {
  const o = opts || {}, p = free[n], tid = 'TT-XNSD-' + label;
  assert(p, 'fixture: free priced CL point #' + n);
  n++;
  assert(TS.create({ id: tid, name: 'Tiểu thương ' + label, phone: '09774' + String(10000 + n), idType: 'CCCD', idNo: 'XNSD-' + n, address: 'x', market: 'CL', stalls: [], status: 'WAITING_ALLOCATION', source: 'STAFF', since: TODAY }));
  const contract = { id: 'HĐ-XNSD-' + label, traderId: tid, stallId: p.id, businessPointId: p.id, market: 'CL', start: D(-400), end: D(900), status: 'ACTIVE', history: [], serviceApplicability: {}, priceTerms: B.buildPriceTerms('CL', p, p.area, TODAY, {}, 'CONTRACT') };
  const c = CS.createWithPointAllocation({ contract, traderId: tid, pointId: p.id, pointHistoryEntry: 'fixture' });
  assert(c, 'fixture contract ' + label);
  if (!o.keepEnd) c.end = end; // hết hạn sau khi ký — không side effect
  L.migrate();
  return { c, p, tid };
};
const K = { main: mk('MAIN', D(-5)), stop: mk('STOP', D(-14)), scope: mk('SCOPE', D(-3)), next: mk('NEXT', D(-1)), live: mk('LIVE', D(900), { keepEnd: true }) };
const add = (iso, k) => { const d = new Date(iso + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() + k); return d.toISOString().slice(0, 10); };
const U1 = D(60);
const confirm = (c, input, date) => CS.confirmContinuation(c.id, Object.assign({ kind: 'CONTINUING', note: 'Kiểm tra thực tế' }, input), date);

ok('CASE 1: hết hạn → "Hết hạn – chờ xử lý", quá hạn N ngày, điểm vẫn Đang thuê', () => {
  const c = K.main.c;
  assert.strictEqual(CS.displayStatus(c), 'EXPIRED');
  assert.strictEqual(CS.displayStatusLabel(c), 'Hết hạn – chờ xử lý');
  assert.strictEqual(CS.overdueDays(c), 5);
  assert.strictEqual(CS.usageState(c), 'UNCONFIRMED');
  assert.strictEqual(BP.get(K.main.p.id).usageStatus, 'RENTED');
  assert.strictEqual(BP.contractOn(K.main.p.id, TODAY).id, c.id);
  assert.strictEqual(CS.overdueDays(K.live.c), 0); assert.strictEqual(CS.usageState(K.live.c), null);
});
ok('CASE 2: hồ sơ tiểu thương vẫn Đang hoạt động; hợp đồng vẫn ACTIVE', () => {
  assert.strictEqual(TS.getProfile(K.main.tid).status, 'ACTIVE');
  assert.strictEqual(K.main.c.status, 'ACTIVE');
});
ok('CASE 3: Tổ trưởng xác nhận tiếp tục sử dụng (ngày hiệu lực tách thời điểm thao tác), trạng thái HĐ giữ nguyên', () => {
  const c = K.main.c, from = D(-4), max = CS.continuationMaxUntil(from);
  assert.strictEqual(CS.nextContinuationFrom(c), from);
  assert.strictEqual(CS.continuationMaxUntil('2026-05-11'), '2026-08-10');
  assert.strictEqual(CS.continuationMaxUntil('2026-10-31'), '2027-01-30', 'end-of-month clamp');
  assert.strictEqual(confirm(c, { from, until: add(max, 1) }).field, 'until', 'max 3 months');
  assert.strictEqual(confirm(c, { from, until: U1, note: ' ' }).field, 'note');
  const r = confirm(c, { from, until: U1 });
  assert(!r.error, r.message);
  ['id', 'from', 'until', 'note', 'confirmedBy', 'confirmedAt'].forEach(k => assert(r.record[k], 'record.' + k));
  assert.strictEqual(r.record.confirmedByAccountId, 'AC-NV01');
  assert(/T\d{2}:\d{2}/.test(r.record.confirmedAt) && r.record.from === from, 'operation timestamp stored apart from effective dates');
  assert.strictEqual(c.history[0].action, 'Xác nhận tiếp tục sử dụng');
  assert.strictEqual(CS.displayStatus(c), 'EXPIRED', 'still Hết hạn – chờ xử lý');
  assert.strictEqual(c.status, 'ACTIVE');
  assert.strictEqual(CS.usageState(c), 'CONFIRMED');
  assert.strictEqual(CS.confirmedThrough(c), U1);
  assert.strictEqual(BP.get(K.main.p.id).usageStatus, 'RENTED'); assert.strictEqual(TS.getProfile(K.main.tid).status, 'ACTIVE');
  // Điểm tích hợp Giai đoạn B: khoảng phủ / khoảng thiếu (chưa được tính phí gọi).
  same(CS.coveredRange(c, D(10), U1), { covered: true, coveredTo: U1, gapFrom: null, gapTo: null });
  same(CS.coveredRange(c, D(50), D(70)), { covered: false, coveredTo: U1, gapFrom: D(61), gapTo: D(70) });
});
ok('CASE 4: xác nhận bổ sung bất cứ lúc nào (còn > 7 ngày vẫn được), nối tiếp bản trước, không ghi đè bản cũ', () => {
  const c = K.main.c, first = CS.latestContinuation(c), from2 = add(U1, 1), U2 = add(U1, 60);
  assert(A.U.days(TODAY, CS.confirmedThrough(c)) > CS.CONTINUATION_WARN_DAYS, 'current confirmation still has > 7 days');
  assert.strictEqual(CS.usageState(c), 'CONFIRMED');
  // 7 ngày chỉ là ngưỡng nhắc nhở (EXPIRING), không khóa chức năng.
  assert.strictEqual(CS.usageState(c, add(U1, -3)), 'EXPIRING');
  assert.strictEqual(CS.usageState(c, add(U1, 1)), 'LAPSED');
  assert.strictEqual(confirm(c, { from: from2, until: add(CS.continuationMaxUntil(from2), 1) }).field, 'until', 'still max 3 months per record');
  const r = confirm(c, { from: from2, until: U2 });
  assert(!r.error, r.message);
  assert.strictEqual(c.continuations.length, 2);
  same([first.from, first.until], [D(-4), U1], 'old record unchanged');
  assert.strictEqual(CS.confirmedThrough(c), U2);
});
ok('CASE 5: chặn khoảng chồng chéo, khoảng hở, đến ngày < từ ngày, gửi lặp', () => {
  const c = K.main.c, U2 = CS.confirmedThrough(c), at = add(U2, -3);
  assert.strictEqual(confirm(c, { from: add(U2, -10), until: add(U2, 20) }, at).field, 'from', 'overlap');
  assert.strictEqual(confirm(c, { from: add(U2, 5), until: add(U2, 20) }, at).field, 'from', 'gap');
  assert.strictEqual(confirm(c, { from: add(U2, 1), until: U2 }, at).field, 'until', 'until < from');
  assert.strictEqual(confirm(c, { from: add(U1, 1), until: U2 }, add(U1, 1)).field, 'from', 'double submit rejected');
  assert.strictEqual(c.continuations.length, 2);
});
ok('CASE 6: NV thu phí / Lãnh đạo không có quyền (UI + service + handler)', () => {
  [['AC-NV02', 'CL'], ['AC-LD01', 'CL']].forEach(([id, m]) => {
    login(id, m);
    assert(!A.canDo('hop-dong.xac-nhan-su-dung', 'CL'), id + ' action');
    assert(!CS.canConfirmContinuation(K.scope.c));
    assert.strictEqual(confirm(K.scope.c, { from: D(-2), until: D(30) }).error, 'FORBIDDEN');
    assert.strictEqual(CS.voidContinuation(K.main.c.id, CS.latestContinuation(K.main.c).id, { reason: 'x' }).error, 'FORBIDDEN');
    A.closeModal(); h.act('ct-continue-open', { id: K.scope.c.id });
    assert(!/Tình trạng thực tế/.test(h.modal()));
  });
  assert(!(K.scope.c.continuations || []).length);
  login('AC-NV01', 'CL');
  assert(A.PERM.canAction('market_manager', 'hop-dong.xac-nhan-su-dung'));
  assert(!A.PERM.canAction('collector', 'hop-dong.xac-nhan-su-dung'));
});
ok('CASE N+1: bổ sung trước để bao phủ trọn tháng mặt bằng N+1 của kỳ thu tháng N', () => {
  const c = K.next.c, monthStart = iso => iso.slice(0, 8) + '01';
  const monthEnd = iso => { const [y, m] = iso.split('-').map(Number); return new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10); };
  const landFrom = add(monthEnd(TODAY), 1), landTo = monthEnd(landFrom), from1 = add(c.end, 1);
  // Lần 1: chỉ đến cuối tháng hiện tại → tháng N+1 chưa được phủ, khoảng thiếu là cả tháng.
  assert(!confirm(c, { from: from1, until: monthEnd(TODAY) }).error);
  same(CS.coveredRange(c, landFrom, landTo), { covered: false, coveredTo: null, gapFrom: landFrom, gapTo: landTo });
  // Lần 2 (một phần): đến giữa tháng N+1 → cảnh báo khoảng chưa xác nhận, chưa coi cả tháng là đủ.
  const mid = add(landFrom, 14);
  const r2 = confirm(c, { from: landFrom, until: mid });
  assert(!r2.error, r2.message);
  same(CS.coveredRange(c, landFrom, landTo), { covered: false, coveredTo: mid, gapFrom: add(mid, 1), gapTo: landTo });
  // Lần 3: Tổ trưởng bổ sung ngay (xác nhận hiện tại còn > 7 ngày) đến hết tháng N+1 → phủ trọn.
  assert(A.U.days(TODAY, CS.confirmedThrough(c)) > CS.CONTINUATION_WARN_DAYS);
  const r3 = confirm(c, { from: add(mid, 1), until: landTo });
  assert(!r3.error, r3.message);
  same(CS.coveredRange(c, landFrom, landTo), { covered: true, coveredTo: landTo, gapFrom: null, gapTo: null });
  assert.strictEqual(CS.validContinuations(c).length, 3);
  assert.strictEqual(CS.displayStatus(c), 'EXPIRED', 'still Hết hạn – chờ xử lý');
  assert.strictEqual(BP.get(K.next.p.id).usageStatus, 'RENTED');
});
ok('CASE 4b (yêu cầu bổ sung 4/5): hủy bản mới nhất rồi tạo lại vẫn liên tục; bản hủy không tính', () => {
  const c = K.main.c, [r1, r2] = CS.validContinuations(c);
  assert.strictEqual(CS.voidContinuation(c.id, r1.id, { reason: 'x' }).error, 'NOT_LATEST');
  assert.strictEqual(CS.voidContinuation(c.id, r2.id, { reason: ' ' }).error, 'REQUIRED');
  const v = CS.voidContinuation(c.id, r2.id, { reason: 'Nhập sai ngày' });
  assert(!v.error, v.message);
  assert.strictEqual(c.continuations.length, 2, 'not physically deleted');
  assert(r2.voidedAt && r2.voidedBy && r2.voidReason === 'Nhập sai ngày' && r2.voidedByAccountId === 'AC-NV01');
  assert.strictEqual(CS.voidContinuation(c.id, r2.id, { reason: 'x' }).error, 'ALREADY_VOIDED');
  assert.strictEqual(c.history[0].action, 'Hủy xác nhận sử dụng');
  assert.strictEqual(CS.confirmedThrough(c), U1);
  assert.strictEqual(CS.nextContinuationFrom(c), add(U1, 1));
  assert.strictEqual(CS.coveredRange(c, add(U1, 1), add(U1, 10)).covered, false, 'voided range not covered');
  const again = confirm(c, { from: add(U1, 1), until: add(U1, 30) }, add(U1, -1));
  assert(!again.error, again.message);
  assert.strictEqual(c.continuations.length, 3);
  same(CS.validContinuations(c).map(x => x.until), [U1, add(U1, 30)]);
});
ok('Q5: đã ngừng sử dụng → không cho xác nhận tiếp; điểm không tự giải phóng', () => {
  const c = K.stop.c, stopped = input => CS.confirmContinuation(c.id, Object.assign({ kind: 'STOPPED', note: 'Đã dọn hàng' }, input));
  assert.strictEqual(stopped({ stoppedOn: D(1) }).field, 'stoppedOn', 'future');
  assert.strictEqual(stopped({ stoppedOn: c.end }).field, 'stoppedOn', 'on end date');
  assert.strictEqual(stopped({ stoppedOn: add(c.end, 5) }).field, 'stoppedOn', 'after unconfirmed gap');
  const r = stopped({ stoppedOn: add(c.end, 1) });
  assert(!r.error, r.message);
  assert.strictEqual(CS.usageState(c), 'STOPPED');
  assert.strictEqual(confirm(c, { from: add(c.end, 1), until: D(30) }).field, 'form');
  assert.strictEqual(BP.get(K.stop.p.id).usageStatus, 'RENTED');
  assert.strictEqual(TS.getProfile(K.stop.tid).status, 'ACTIVE');
  assert.strictEqual(CS.displayStatus(c), 'EXPIRED');
  assert.strictEqual(CS.coveredRange(c, add(c.end, -5), D(0)).coveredTo, c.end, 'coverage stops the day before stoppedOn');
});
ok('CASE 7: ghi chú hết hạn và lịch sử xác nhận lưu riêng, đầy đủ', () => {
  const c = K.main.c, before = c.continuations.length;
  const note = CS.addExpiryNote(c.id, { content: 'Đã gọi tiểu thương', createdBy: 'Tổ trưởng' });
  assert(!note.error, note.message);
  assert.strictEqual(CS.expiryNotes(c).length, 1);
  assert.strictEqual(c.continuations.length, before, 'note does not create a confirmation');
  assert(!c.expiryNotes.some(x => x.kind), 'confirmations not stored in notes');
  assert.strictEqual(c.history.filter(x => /xác nhận/i.test(x.action)).length, 4);
});
ok('CASE 8: thông báo nội bộ chống trùng, chỉ Tổ trưởng trong phạm vi chợ', () => {
  const acc = A.ACCOUNTS.get('AC-NV01'), scopes = acc.marketScopes;
  const forScope = () => A.db.personalNotifications.filter(x => x.targetId === K.scope.c.id);
  acc.marketScopes = ['HA'];
  PN.ensureContractExpiryAlerts();
  assert.strictEqual(forScope().length, 0, 'out of scope');
  acc.marketScopes = scopes;
  assert(PN.ensureContractExpiryAlerts() >= 1);
  assert.strictEqual(PN.ensureContractExpiryAlerts(), 0, 'second run adds nothing');
  assert.strictEqual(forScope().length, 1);
  assert.strictEqual(forScope()[0].recipientAccountId, 'AC-NV01');
  assert.strictEqual(forScope()[0].notificationKey, 'CONTRACT_EXPIRED_PENDING|' + K.scope.c.id + '|AC-NV01');
  assert(!A.db.personalNotifications.some(x => x.targetId === K.scope.c.id && x.recipientAccountId !== 'AC-NV01'), 'collector/leader not notified');
  assert(!A.db.personalNotifications.some(x => x.targetId === K.stop.c.id), 'stopped contract not reminded');
  // Nhắc khi xác nhận còn ≤ 7 ngày và khi hết hiệu lực: theo bản ghi xác nhận, không trùng.
  const end = CS.confirmedThrough(K.main.c);
  [add(end, -3), add(end, -3), add(end, 2), add(end, 2)].forEach(d => PN.ensureContractExpiryAlerts(d));
  const main = A.db.personalNotifications.filter(x => x.targetId === K.main.c.id).map(x => x.notificationKey.split('|')[0]).sort();
  same(main, ['CONTINUATION_EXPIRING', 'CONTINUATION_LAPSED']);
  assert.strictEqual(new Set(A.db.personalNotifications.map(x => x.id)).size, A.db.personalNotifications.length, 'unique ids');
  assert.strictEqual(PN.add({ recipientAccountId: 'AC-NV01', notificationKey: forScope()[0].notificationKey }), null, 'add() dedupes too');
});
ok('CASE 9 + 10: hợp đồng cũ hiển thị đúng; hết hạn không bao giờ thành Đã thanh lý', () => {
  const legacy = A.db.contracts.filter(c => c.status === 'PENDING_LIQUIDATION' || c.status === 'LIQUIDATED');
  legacy.forEach(c => { assert(CS.DISPLAY_STATUS[CS.displayStatus(c)].legacy); assert.strictEqual(CS.usageState(c), null); assert(!CS.isExpiredPending(c)); });
  A.db.contracts.filter(c => c.status === 'ACTIVE' && c.end < TODAY && !c.continuations).forEach(c => { assert.strictEqual(CS.usageState(c), 'UNCONFIRMED'); assert.strictEqual(CS.confirmedThrough(c), c.end); });
  L.migrate(); L.syncExpiry();
  [K.main, K.stop, K.scope].forEach(k => { assert.strictEqual(k.c.status, 'ACTIVE'); assert(!CS.DISPLAY_STATUS[CS.displayStatus(k.c)].legacy); });
});
ok('UI: danh sách (KPI, lọc tình trạng sử dụng, quá hạn) + chi tiết + popup xác nhận/hủy qua handler', () => {
  login('AC-NV01', 'CL');
  A.ui.contractWs = null; h.go('hop-dong');
  let v = h.view();
  assert(v.includes('<div class="k-label">Hết hạn – chờ xử lý</div>'));
  assert(v.includes('data-ch="ctw-usage"'));
  A.CH['ctw-usage']({ value: 'UNCONFIRMED' }); h.flush();
  v = h.view();
  assert(v.includes(K.scope.c.id) && !v.includes(K.main.c.id) && v.includes('Quá hạn 3 ngày'));
  A.ACT['ctw-clear'](); h.flush();
  h.act('ct-view', { id: K.scope.c.id });
  v = h.view();
  assert(v.includes('Hết hạn – chờ xử lý') && v.includes('Quá hạn 3 ngày') && v.includes('Chưa xác nhận tình trạng sử dụng'));
  assert(v.includes('data-act="ct-continue-open"') && v.includes('Ghi chú hợp đồng hết hạn'));
  h.act('ct-continue-open', { id: K.scope.c.id });
  assert(/Tình trạng thực tế/.test(h.modal()) && h.modal().includes('value="' + D(-2) + '"'));
  h.input('#ct-continue-until', D(30)); h.input('#ct-continue-note', 'Vẫn bán hàng'); h.input('#ct-continue-stopped', '');
  h.act('ct-continue-save', { id: K.scope.c.id });
  assert.strictEqual(CS.confirmedThrough(K.scope.c), D(30));
  v = h.view();
  assert(v.includes('Xác nhận tình trạng sử dụng') && v.includes(dmy(D(-2)) + ' → ' + dmy(D(30))) && v.includes('data-act="ct-continue-void-open"'));
  h.act('ct-continue-void-open', { id: K.scope.c.id, rec: CS.latestContinuation(K.scope.c).id });
  h.input('#ct-continue-void-reason', 'Nhập nhầm');
  h.act('ct-continue-void-save', { id: K.scope.c.id, rec: CS.latestContinuation(K.scope.c).id });
  assert.strictEqual(CS.usageState(K.scope.c), 'UNCONFIRMED');
  assert(h.view().includes('Đã hủy'));
  login('AC-NV02', 'CL'); h.act('ct-view', { id: K.scope.c.id });
  v = h.view();
  assert(!v.includes('data-act="ct-continue-open"') && !v.includes('data-act="ct-continue-void-open"'), 'collector sees no action');
  login('AC-NV01', 'CL');
});

console.log('contract-expired-continuation regression PASS (' + passed + ' checks)');

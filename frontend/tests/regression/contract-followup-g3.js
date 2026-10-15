/* Regression G3 (10/2026): giao diện Hợp đồng chỉ còn 3 kết quả xác minh (Chưa xác minh / Tiếp tục thuê / Không tiếp tục
 * thuê) + nhãn cần xử lý; một mục "Theo dõi xử lý hợp đồng" (xác minh + ghi chú) và một popup "Cập nhật xử lý".
 * Xác minh / ghi chú được từ khi HĐ còn ≤ 30 ngày. Mọi xác minh mới bắt buộc căn cứ + ghi chú; bản ghi cũ thiếu căn cứ vẫn
 * hợp lệ. "Không tiếp tục thuê" nhập ngày cuối sử dụng: tương lai → dự kiến ngừng, đã tới → đã ngừng thực tế; khoảng chưa có
 * căn cứ → báo lỗi, KHÔNG tự tạo bản tiếp tục thuê. Đã ngừng thực tế → "Chờ thủ tục kết thúc", điểm KD không đổi.
 * Không đổi dữ liệu lưu / tính phí. Fixture độc lập trong harness (ngày nghiệp vụ 29/10/2026), không chạm localStorage thật. */
const assert = require('assert');
const path = require('path');
const { createApp } = require('./harness');

const h = createApp(path.resolve(__dirname, '../..')), A = h.A;
const CS = A.features.contracts.service, BP = A.features.businessPoints.service, TS = A.features.traders.service, B = A.features.finance.billing, L = A.features.lifecycle.service;
let passed = 0;
const ok = (label, fn) => { try { fn(); passed++; } catch (e) { console.error('FAILED: ' + label); e.message = label + ': ' + e.message; throw e; } };
const login = (id, market) => { A.ui.sessionAccountId = id; A.ui.currentDemoAccountId = id; A.ui.market = market; A.syncAccountContext(); };
const TODAY = A.U.today(), dmy = A.U.dmy;
const add = (iso, k) => { const d = new Date(iso + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() + k); return d.toISOString().slice(0, 10); };
const D = n => add(TODAY, n);
assert.strictEqual(TODAY, '2026-10-29', 'fixture business date');
login('AC-NV01', 'CL');

const free = BP.availablePoints('CL', D(-400), D(900)).filter(p => (B.buildPriceTerms('CL', p, p.area, TODAY, {}, 'X') || {}).land);
let n = 0;
const mk = (label, end) => {
  const p = free[n++], tid = 'TT-G3-' + label;
  assert(p, 'fixture point ' + label);
  assert(TS.create({ id: tid, name: 'G3 ' + label, phone: '09778' + String(10000 + n), idType: 'CCCD', idNo: 'G3-' + n, address: 'x', market: 'CL', stalls: [], status: 'WAITING_ALLOCATION', source: 'STAFF', since: TODAY }));
  const c = CS.createWithPointAllocation({ contract: { id: 'HĐ-G3-' + label, traderId: tid, stallId: p.id, businessPointId: p.id, market: 'CL', start: D(-400), end: D(900), status: 'ACTIVE', history: [], serviceApplicability: {}, priceTerms: B.buildPriceTerms('CL', p, p.area, TODAY, {}, 'CONTRACT') }, traderId: tid, pointId: p.id, pointHistoryEntry: 'g3' });
  assert(c, 'fixture contract ' + label);
  c.end = end; L.migrate();
  return { c, p, tid };
};
// FAR: còn xa ngày hết hạn (ngoài mọi tháng mặt bằng đang mở) → kiểm tra cửa sổ 30 ngày bằng ngày đánh giá.
const K = { far: mk('FAR', D(200)), plan: mk('PLAN', D(210)), gap: mk('GAP', D(-10)), mile: mk('MILE', D(-100)), verify: mk('VER', D(-3)), none: mk('NONE', D(-6)), legacy: mk('OLD', D(-8)) };
const cont = (k, input, date) => CS.confirmContinuation(K[k].c.id, Object.assign({ kind: 'CONTINUING' }, input), date);

ok('cửa sổ xác minh / ghi chú mở từ khi HĐ còn ≤ 30 ngày; trước hạn chỉ lưu DỰ KIẾN; một lần xác minh phủ tới mốc hồ sơ', () => {
  const c = K.far.c, at30 = add(c.end, -30), at31 = add(c.end, -31);
  assert.strictEqual(CS.continuationMode(c, at31), null);
  assert.strictEqual(CS.continuationMode(c, at30), 'ENDING');
  assert.strictEqual(CS.canAddFollowUpNote(c, at31), false); assert.strictEqual(CS.canAddFollowUpNote(c, at30), true);
  const from = add(c.end, 1), until = CS.continuationMaxUntil(from);
  assert.strictEqual(cont('far', { from, until, note: 'x' }, at31).field, 'form', 'outside the window');
  assert.strictEqual(cont('far', { from, until, note: 'x' }, at30).field, 'evidence', 'evidence required');
  const r = cont('far', { from, until, evidence: 'TRADER_CONTACT', note: 'Tiểu thương xin tiếp tục thuê' }, at30);
  assert(!r.error, r.message);
  assert.strictEqual(r.record.basis, 'PLANNED'); assert.strictEqual(r.record.evidence, 'TRADER_CONTACT');
  assert.strictEqual(until, CS.dossierMilestone(c), 'default "đến ngày" = mốc hồ sơ 3 tháng → một bản ghi');
  const o = CS.verificationOutcome(c);
  assert(o.key === 'CONTINUING' && o.planned && o.through === until, JSON.stringify(o));
  assert.strictEqual(c.status, 'ACTIVE'); assert.strictEqual(CS.displayStatus(c), 'ACTIVE');
});
ok('Không tiếp tục thuê, ngày cuối sử dụng ở tương lai → dự kiến ngừng (ngày ngừng = ngày cuối + 1); không trước ngày hết hạn', () => {
  const c = K.plan.c, at = add(c.end, -10), nc = input => CS.recordNotContinuing(c.id, Object.assign({ evidence: 'COMMITMENT', note: 'Không thuê tiếp' }, input), at);
  assert.strictEqual(nc({ lastUseDate: add(c.end, -1) }).field, 'lastUseDate', 'before contract end = early termination (not supported)');
  assert.strictEqual(nc({ lastUseDate: c.end, evidence: '' }).field, 'evidence');
  const r = nc({ lastUseDate: c.end });
  assert(!r.error, r.message);
  assert(r.record.kind === 'PLANNED_STOP' && r.record.plannedStopOn === add(c.end, 1));
  const o = CS.verificationOutcome(c);
  assert(o.key === 'NOT_CONTINUING' && o.planned && o.lastUseDate === c.end);
  assert.strictEqual(CS.isPendingClosure(c), false, 'planned only — not waiting for closure yet');
});
ok('Không tiếp tục thuê sau khoảng chưa có căn cứ → báo khoảng thiếu, KHÔNG tự tạo bản tiếp tục thuê', () => {
  const c = K.gap.c, r = CS.recordNotContinuing(c.id, { lastUseDate: D(-5), evidence: 'SITE_CHECK', note: 'Đã dọn đi' });
  assert.strictEqual(r.field, 'lastUseDate');
  assert(r.gap && r.gap.from === add(c.end, 1) && r.gap.to === D(-5), JSON.stringify(r.gap));
  assert(/chưa có căn cứ sử dụng/.test(r.message) && /Tiếp tục thuê/.test(r.message));
  assert.strictEqual((c.continuations || []).length, 0, 'no auto-created record');
});
ok('Không tiếp tục thuê, đã ngừng thực tế → "Chờ thủ tục kết thúc"; điểm KD và hồ sơ không đổi; chỉ còn ghi chú', () => {
  const c = K.gap.c, r = CS.recordNotContinuing(c.id, { lastUseDate: c.end, evidence: 'SITE_CHECK', note: 'Đã dọn hàng sau hết hạn' });
  assert(!r.error, r.message);
  assert(r.record.kind === 'STOPPED' && r.record.stoppedOn === add(c.end, 1) && r.record.evidence === 'SITE_CHECK');
  const o = CS.verificationOutcome(c);
  assert(o.key === 'NOT_CONTINUING' && !o.planned);
  assert(CS.isPendingClosure(c) && CS.attentionFlags(c).some(x => x.code === 'PENDING_CLOSURE' && x.label === 'Chờ thủ tục kết thúc'));
  assert.strictEqual(BP.get(K.gap.p.id).usageStatus, 'RENTED'); assert.strictEqual(c.status, 'ACTIVE'); assert.strictEqual(TS.getProfile(K.gap.tid).status, 'ACTIVE');
  A.ui.contractWs = null; h.go('hop-dong'); h.act('ct-view', { id: c.id });
  assert(h.view().includes('Chờ thủ tục kết thúc'));
  // Ba màn liên quan chỉ thêm nhãn; không đổi trạng thái điểm/hồ sơ.
  A.openDkDrawer(BP.get(K.gap.p.id));
  assert(h.modal().includes('Chờ thủ tục kết thúc'), 'chi tiết điểm kinh doanh');
  h.go('tieu-thuong'); h.act('tp-view', { id: K.gap.tid });
  assert(h.view().includes('Chờ thủ tục kết thúc'), 'hồ sơ tiểu thương');
  A.ui.contractWs = null; h.go('hop-dong'); h.act('ct-view', { id: c.id });
  A.closeModal(); h.act('ct-continue-open', { id: c.id });
  assert(/Chỉ ghi chú tiến độ/.test(h.modal()) && !/value="CONTINUING"/.test(h.modal()) && !/value="NOT_CONTINUING"/.test(h.modal()), 'stopped → note only');
  A.closeModal();
});
ok('xác minh thực tế bắt buộc căn cứ + ghi chú; bản ghi cũ thiếu căn cứ vẫn hợp lệ và vẫn tính căn cứ', () => {
  const c = K.none.c, from = add(c.end, 1);
  assert.strictEqual(cont('none', { from, until: D(30), note: 'x' }).field, 'evidence');
  assert.strictEqual(cont('none', { from, until: D(30), evidence: 'SITE_CHECK', note: ' ' }).field, 'note');
  // Dữ liệu cũ (Giai đoạn A): bản ghi thực tế không có căn cứ, không có basis.
  const old = K.legacy.c;
  old.continuations = [{ id: 'XNSD-' + old.id + '-001', contractId: old.id, kind: 'CONTINUING', from: add(old.end, 1), until: D(40), note: 'Dữ liệu cũ', confirmedBy: 'Tổ trưởng', confirmedAt: '2026-10-25T08:00:00.000Z' }];
  const o = CS.verificationOutcome(old);
  assert(o.key === 'CONTINUING' && !o.planned && o.through === D(40));
  assert.strictEqual(CS.chargeCoverage(old, '2026-11-01', '2026-11-30').covered, true, 'old record still covers billing');
  A.ui.contractWs = null; h.go('hop-dong'); h.act('ct-view', { id: old.id });
  assert(h.view().includes('Dữ liệu cũ') && h.view().includes('Thực tế'), 'old record rendered');
});
ok('chưa xác minh chỉ hiển thị một lần; ghi chú được; quá mốc hồ sơ để G4 quản lý', () => {
  const c = K.none.c;
  assert.strictEqual(CS.verificationOutcome(c).key, 'NONE');
  assert(CS.attentionFlags(c).some(x => x.code === 'MISSING_BASIS'));
  const note = CS.addExpiryNote(c.id, { content: 'Đã gọi tiểu thương, hẹn kiểm tra', createdBy: 'Tổ trưởng' });
  assert(!note.error, note.message);
  assert.strictEqual(CS.verificationOutcome(c).key, 'NONE', 'a note does not change the outcome');
  assert.strictEqual(CS.addExpiryNote(K.far.c.id, { content: 'x' }).error, 'NOT_IN_WINDOW', 'no note far before expiry');
  // Mốc hồ sơ: HĐ hết hạn 100 ngày trước, tiếp tục thuê có căn cứ liên tục → quá mốc, vẫn tính, điểm không đổi.
  const m = K.mile.c, f1 = add(m.end, 1), u1 = CS.continuationMaxUntil(f1);
  assert(!cont('mile', { from: f1, until: u1, evidence: 'SITE_CHECK', note: 'Đợt 1' }).error);
  assert(!cont('mile', { from: add(u1, 1), until: D(40), evidence: 'SITE_CHECK', note: 'Đợt 2' }).error);
  const flags = CS.attentionFlags(m).map(x => x.code);
  assert(flags.includes('DOSSIER_OVERDUE') && !flags.includes('MISSING_BASIS'), flags.join());
  assert.strictEqual(CS.chargeCoverage(m, '2026-11-01', '2026-11-30').covered, true);
  assert.strictEqual(BP.get(K.mile.p.id).usageStatus, 'RENTED');
  A.ui.contractWs = null; h.go('hop-dong'); h.act('ct-view', { id: c.id });
  assert.strictEqual((h.view().match(/Chưa xác minh/g) || []).length, 1, 'không lặp nhãn kết quả');
  A.ACT['ctw-list'](); A.IN['ctw-q']({ value: K.mile.c.id }); A.CH['ctw-attention']({ checked: true }); h.flush();
  assert(!h.view().includes('data-id="' + K.mile.c.id + '"'), 'mốc hồ sơ không còn là cờ xử lý G3');
  assert(!h.view().includes('Quá mốc hồ sơ'), 'không đưa mốc hồ sơ vào kết quả xác minh G3');
  A.ACT['ctw-clear']();
});
ok('UI: "Xác nhận kết quả thực tế" (thay "Đúng thực tế" / "Thực tế khác") mở popup điền sẵn; thiếu căn cứ bị từ chối', () => {
  const c = K.verify.c, from = add(c.end, 1);
  const r = cont('verify', { from, until: D(60), evidence: 'COMMITMENT', note: 'Cam kết trước hạn' }, D(-5));
  assert(!r.error && r.record.basis === 'PLANNED', r.message);
  A.ui.contractWs = null; h.go('hop-dong'); h.act('ct-view', { id: c.id });
  const v = h.view();
  assert(v.includes('data-rec="' + r.record.id + '"') && v.includes('Xác nhận kết quả thực tế') && !v.includes('Đúng thực tế') && !v.includes('Thực tế khác'));
  h.act('ct-continue-open', { id: c.id, rec: r.record.id });
  assert(/Xác nhận kết quả thực tế/.test(h.modal()) && /Giữ nguyên khoảng/.test(h.modal()) && !/Chỉ ghi chú tiến độ/.test(h.modal()));
  h.input('#ct-continue-evidence', ''); h.input('#ct-continue-note', 'Đúng như dự kiến');
  h.act('ct-continue-save', { id: c.id });
  assert(!r.record.verifiedAt && /Vui lòng chọn căn cứ/.test(h.modal()), 'rejected without evidence');
  h.input('#ct-continue-evidence', 'SITE_CHECK');
  h.act('ct-continue-save', { id: c.id });
  assert(r.record.verifiedAt && r.record.verifyEvidence === 'SITE_CHECK' && r.record.verifyNote === 'Đúng như dự kiến');
  assert.strictEqual(CS.plannedToVerify(c).length, 0);
  assert.strictEqual(r.record.from, from, 'effective dates unchanged');
});
ok('UI: lọc 3 kết quả + "Chỉ HĐ cần xử lý"; Sắp hết hạn gộp vào bộ lọc trạng thái', () => {
  A.ui.contractWs = null; h.go('hop-dong'); h.act('ctw-list');
  const v0 = h.view();
  assert(v0.includes('value="EXPIRING"') && !v0.includes('data-ch="ctw-expiring"') && !v0.includes('data-ch="ctw-usage"'));
  const shown = () => Object.keys(K).filter(k => h.view().includes('data-id="' + K[k].c.id + '"'));
  const pick = value => { A.CH['ctw-outcome']({ value }); h.flush(); return shown().sort().join(); };
  A.IN['ctw-q']({ value: 'HĐ-G3-' }); h.flush();
  assert.strictEqual(pick('NONE'), 'none');
  assert.strictEqual(pick('CONTINUING'), ['far', 'legacy', 'mile', 'verify'].sort().join(), 'far: already has a planned record');
  assert.strictEqual(pick('NOT_CONTINUING'), ['gap', 'plan'].sort().join());
  A.CH['ctw-outcome']({ value: '' }); A.CH['ctw-attention']({ checked: true }); h.flush();
  assert(shown().includes('none') && shown().includes('gap') && !shown().includes('mile') && !shown().includes('far'), shown().join());
  h.act('ctw-clear');
  assert.strictEqual(A.ui.contractWs.attention, false);
});
ok('RBAC: NV thu phí / Lãnh đạo không xác minh, không ghi chú (UI + service)', () => {
  [['AC-NV02', 'CL'], ['AC-LD01', 'CL']].forEach(([id, m]) => {
    login(id, m);
    assert.strictEqual(CS.recordNotContinuing(K.none.c.id, { lastUseDate: K.none.c.end, evidence: 'SITE_CHECK', note: 'x' }).error, 'FORBIDDEN');
    assert.strictEqual(CS.verifyPlanned(K.verify.c.id, 'x', { evidence: 'SITE_CHECK', note: 'x' }).error, 'FORBIDDEN');
    A.closeModal(); h.act('ct-continue-open', { id: K.none.c.id });
    assert(!/Kết quả xác minh/.test(h.modal()), id + ' gets no popup');
  });
  login('AC-NV01', 'CL');
  assert.strictEqual(CS.verificationOutcome(K.none.c).key, 'NONE');
});
console.log('contract-followup-g3 regression PASS (' + passed + ' checks)');

/* Regression (Giai đoạn B, 10/2026): phát hành ĐỘC LẬP từng chợ.
 * Phần 1 (dữ liệu seed thật, không sửa seed): kỳ 11/2026 nạp như trình duyệt mà KHÔNG xác nhận HĐ sắp hết hạn → CL bị chặn
 * (LAND_NOT_COVERED), TTD vẫn phát hành; Tổ trưởng xác nhận dự kiến → CL tự tính lại → phát hành riêng CL qua màn Theo dõi
 * kỳ thu; phát hành lại không tạo trùng; NV thu phí không có quyền phát hành.
 * Phần 2 (12 chợ, điều phối): 11 chợ đủ điều kiện được phát hành, 1 chợ bị giữ lại kèm nguyên nhân; lỗi giả lập của một chợ
 * chỉ khôi phục chợ đó, không làm mất kết quả của chợ khác. */
const assert = require('assert');
const path = require('path');
const { createApp, confirmEndingForSeed } = require('./harness');

let passed = 0;
const ok = (label, fn) => { try { fn(); passed++; } catch (e) { console.error('FAILED: ' + label); e.message = label + ': ' + e.message; throw e; } };
const json = x => JSON.stringify(x);
const h = createApp(path.resolve(__dirname, '../..'), { seedIssue: true, beforeSeedIssue: () => {} }), A = h.A;
const MP = A.features.finance.marketPeriod, B = A.features.finance.billing;
const login = (id, market) => { A.ui.sessionAccountId = id; A.ui.currentDemoAccountId = id; A.ui.market = market; A.syncAccountContext(); };
const inv = m => A.db.invoices.filter(i => (i.marketId || i.market) === m && i.billingPeriodId === m + '_2026-11');

ok('kỳ seed: CL bị chặn (HĐ sắp hết hạn chưa có căn cứ), TTD vẫn phát hành; seed PARTIAL, không sửa dữ liệu seed', () => {
  assert.strictEqual(A.db.seedIssue.status, 'PARTIAL');
  assert.deepStrictEqual(Array.from(A.db.seedIssue.skipped), ['CL']);
  assert.strictEqual(MP.stateOf('TTD', '2026-11').id, 'COLLECTING');
  assert.strictEqual(MP.stateOf('CL', '2026-11').id, 'NEEDS_ACTION');
  const reason = MP.blockReasons(MP.get('CL', '2026-11'));
  assert(reason.codes.LAND_NOT_COVERED >= 1 && /LAND_NOT_COVERED/.test(reason.text), reason.text);
  assert.strictEqual(inv('CL').length, 0, 'nothing partially issued inside CL');
  assert(inv('TTD').length > 0);
});
ok('Theo dõi kỳ thu: chợ bị chặn hiện nguyên nhân, không có nút phát hành riêng', () => {
  login('AC-NV01', 'CL'); A.ui.periodMonitorPeriod = '2026-11'; h.go('theo-doi-ky-thu');
  const v = h.view();
  assert(/HĐ hết hạn thiếu căn cứ/.test(v));
  assert(!v.includes('data-act="period-monitor-issue-market" data-market="CL"'));
  assert(!MP.issueMarket('CL', '2026-11', A.currentAccount()).ok, 'service refuses a blocked market');
});
const ttdBefore = json(inv('TTD'));
ok('Tổ trưởng xác nhận dự kiến → CL tự tính lại → Sẵn sàng phát hành', () => {
  confirmEndingForSeed(A);
  assert.strictEqual(MP.stateOf('CL', '2026-11').id, 'READY_TO_ISSUE');
  login('AC-NV01', 'CL'); A.ui.periodMonitorPeriod = '2026-11'; h.go('theo-doi-ky-thu');
  assert(h.view().includes('data-act="period-monitor-issue-market" data-market="CL"'));
});
ok('NV thu phí không có quyền phát hành riêng', () => {
  login('AC-NV02', 'CL'); A.closeModal();
  h.act('period-monitor-issue-market-confirm', { market: 'CL', period: '2026-11' });
  assert.strictEqual(inv('CL').length, 0);
});
ok('phát hành riêng CL qua màn Theo dõi kỳ thu; TTD không đổi; phát hành lại không tạo trùng', () => {
  login('AC-NV01', 'CL'); A.ui.periodMonitorPeriod = '2026-11';
  h.act('period-monitor-issue-market', { market: 'CL', period: '2026-11' });
  assert(/PHÁT HÀNH RIÊNG/.test(h.modal()));
  h.act('period-monitor-issue-market-confirm', { market: 'CL', period: '2026-11' });
  const n = inv('CL').length;
  assert(n > 0 && MP.isIssued(MP.get('CL', '2026-11')));
  assert(inv('CL').some(i => (i.items || []).some(it => it.coverage && it.coverage.planned)), 'CL receivables carry the planned basis');
  assert.strictEqual(json(inv('TTD')), ttdBefore, 'other market untouched');
  assert.strictEqual(MP.issueMarket('CL', '2026-11', A.currentAccount()).reason, 'NOT_READY');
  assert.strictEqual(MP.issueMonth('2026-11', A.currentAccount()).reason, 'NOTHING_TO_ISSUE');
  assert.strictEqual(inv('CL').length, n, 'no duplicate receivables');
  assert(inv('CL').every(i => MP.canCollectInvoice(i) || i.status === 'paid'), 'collection flow unchanged');
});

// ---- Phần 2: điều phối 12 chợ (stub service, tháng giả lập; khôi phục sau test) ----
ok('12 chợ: 11 phát hành, 1 bị giữ lại kèm nguyên nhân; lỗi của một chợ chỉ khôi phục chợ đó', () => {
  const M = '2027-03', ids = Array.from({ length: 12 }, (_, i) => 'M' + String(i + 1).padStart(2, '0'));
  const saved = { activeMarkets: MP.activeMarkets, get: MP.get, stateOf: MP.stateOf, canIssue: MP.canIssue, blockingWarnings: MP.blockingWarnings, traderGroups: B.traderGroups, issue: B.issue };
  const issuedSet = new Set(); let failOn = null;
  const mp = id => ({ id: id + '_' + M, marketId: id, period: M });
  try {
    MP.activeMarkets = () => ids.map(id => ({ id, name: 'Chợ ' + id }));
    MP.get = (id, m) => m === M ? mp(id) : saved.get(id, m);
    MP.stateOf = (id, m) => m !== M ? saved.stateOf(id, m) : { id: issuedSet.has(id) ? 'COLLECTING' : id === 'M12' ? 'NEEDS_ACTION' : 'READY_TO_ISSUE', label: id === 'M12' ? 'Cần xử lý' : 'Sẵn sàng phát hành', mp: mp(id), closed: false };
    MP.canIssue = p => p && p.period === M ? MP.stateOf(p.marketId, M).id === 'READY_TO_ISSUE' : saved.canIssue(p);
    MP.blockingWarnings = p => p && p.period === M ? (p.marketId === 'M12' ? [{ code: 'LAND_NOT_COVERED' }, { code: 'LAND_NOT_COVERED' }] : []) : saved.blockingWarnings(p);
    B.traderGroups = (id, pid) => /_2027-03$/.test(pid) ? [{ traderId: 'T-' + id, amount: 1000, validationStatus: 'VALID' }] : saved.traderGroups(id, pid);
    B.issue = (id, pid) => {
      if (!/_2027-03$/.test(pid)) return saved.issue(id, pid);
      const x = { id: 'PT-SIM-' + id, marketId: id, billingPeriodId: pid, amount: 1000, items: [] };
      A.db.invoices.push(x);
      if (id === failOn) throw new Error('lỗi giả lập ' + id);
      issuedSet.add(id); return { issued: [x] };
    };
    failOn = 'M05';
    let out = MP.issueMonth(M, { fullName: 'Test' });
    assert.strictEqual(out.results.length, 10); assert.strictEqual(out.failed.length, 1); assert.strictEqual(out.failed[0].market.id, 'M05');
    assert.strictEqual(out.skipped.length, 1); assert.strictEqual(out.skipped[0].market.id, 'M12'); assert(/LAND_NOT_COVERED × 2/.test(out.skipped[0].reason.text));
    const sim = () => A.db.invoices.filter(i => /^PT-SIM-/.test(i.id)).map(i => i.marketId).sort();
    assert.deepStrictEqual(sim(), ids.filter(id => id !== 'M05' && id !== 'M12'), 'M05 rolled back alone; other 10 kept');
    failOn = null;
    out = MP.issueMarket('M05', M, { fullName: 'Test' });
    assert(out.ok, 'retry the failed market alone');
    assert.strictEqual(sim().length, 11, '11 markets issued, M12 held back');
    out = MP.issueMonth(M, { fullName: 'Test' });
    assert.strictEqual(out.reason, 'NOTHING_TO_ISSUE'); assert.strictEqual(sim().length, 11, 'no duplicates on re-run');
  } finally {
    Object.assign(MP, { activeMarkets: saved.activeMarkets, get: saved.get, stateOf: saved.stateOf, canIssue: saved.canIssue, blockingWarnings: saved.blockingWarnings });
    Object.assign(B, { traderGroups: saved.traderGroups, issue: saved.issue });
    A.db.invoices = A.db.invoices.filter(i => !/^PT-SIM-/.test(i.id));
  }
});
console.log('issue-per-market regression PASS (' + passed + ' checks)');

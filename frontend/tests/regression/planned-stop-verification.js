/* Regression G1 (10/2026): "Dự kiến ngừng sử dụng" chưa xác minh không được làm mất tiền mặt bằng.
 * Bản dự kiến ngừng chỉ là căn cứ kết thúc khi ngày dự kiến còn SAU ngày đánh giá (ngày tính dự kiến / ngày phát hành).
 * Tới/qua ngày mà chưa ghi nhận thực tế → thiếu căn cứ (PLANNED_STOP_UNVERIFIED), không suy luận đã ngừng hay còn thuê;
 * kỳ đã tính trước đó bị giữ lại khi phát hành (STALE_PLANNED_BASIS). Tiếp tục thuê vẫn tính phí; đã ngừng thực tế thì
 * không tính mặt bằng sau ngày kết thúc; điểm KD không bị giải phóng; kỳ đã phát hành không bị sửa.
 * Fixture độc lập trong harness (ngày nghiệp vụ 29/10/2026), không chạm localStorage thật. */
const assert = require('assert');
const path = require('path');
const { createApp, confirmEndingForSeed } = require('./harness');

const h = createApp(path.resolve(__dirname, '../..')), A = h.A;
const CS = A.features.contracts.service, BP = A.features.businessPoints.service, TS = A.features.traders.service, B = A.features.finance.billing, MP = A.features.finance.marketPeriod, L = A.features.lifecycle.service;
let passed = 0;
const ok = (label, fn) => { try { fn(); passed++; } catch (e) { console.error('FAILED: ' + label); e.message = label + ': ' + e.message; throw e; } };
const login = (id, market) => { A.ui.sessionAccountId = id; A.ui.currentDemoAccountId = id; A.ui.market = market; A.syncAccountContext(); };
const today = A.U.today();
assert.strictEqual(today, '2026-10-29', 'fixture business date');
login('AC-NV01', 'CL');
confirmEndingForSeed(A); // HĐ seed sắp hết hạn trong tháng mặt bằng 11 có căn cứ dự kiến → không lẫn vào ca kiểm thử
login('AC-NV01', 'CL');
const mp = MP.get('CL', '2026-11');
mp.meter = { status: 'COMPLETED', mode: 'RECORDED' };
const free = BP.availablePoints('CL', '2025-01-01', '2028-12-31').filter(p => (B.buildPriceTerms('CL', p, p.area, today, {}, 'X') || {}).land);
let n = 0;
const mk = (label, end) => {
  const p = free[n++], tid = 'TT-G1-' + label;
  assert(p, 'fixture point ' + label);
  assert(TS.create({ id: tid, name: 'G1 ' + label, phone: '09779' + String(10000 + n), idType: 'CCCD', idNo: 'G1-' + n, address: 'x', market: 'CL', stalls: [], status: 'WAITING_ALLOCATION', source: 'STAFF', since: today }));
  const c = CS.createWithPointAllocation({ contract: { id: 'HĐ-G1-' + label, traderId: tid, stallId: p.id, businessPointId: p.id, market: 'CL', start: '2025-06-01', end: '2027-12-31', status: 'ACTIVE', history: [], serviceApplicability: {}, priceTerms: B.buildPriceTerms('CL', p, p.area, today, {}, 'CONTRACT') }, traderId: tid, pointId: p.id, pointHistoryEntry: 'g1' });
  assert(c, 'fixture contract ' + label);
  c.end = end; L.migrate();
  return { c, p };
};
const conf = (k, input, date) => { const r = CS.confirmContinuation(K[k].c.id, Object.assign({ evidence: 'SITE_CHECK', note: 'G1 ' + k }, input), date); if (r.error) throw new Error(k + ': ' + r.message); return r.record; };
const K = { stop: mk('STOP', '2026-10-15'), reality: mk('REAL', '2026-10-15'), cont: mk('CONT', '2026-10-15'), stopped: mk('DONE', '2026-10-10') };
const land = (k, o) => (o || B.drafts('CL', mp.id)).filter(d => d.contractId === K[k].c.id && d.items[0].chargeType === 'LAND');
const warns = (k, o) => (o || B.warnings('CL', mp.id)).filter(w => w.contractId === K[k].c.id);
const COUNTER = 'Thiếu căn cứ sử dụng (chặn phát hành chợ): ';
const ids2 = () => JSON.stringify([K.reality.c.id, K.stop.c.id].sort()), sorted = list => JSON.stringify(list.slice().sort());
const screen = r => { A.ui.market = 'CL'; A.ui.periodMonitorPeriod = '2026-11'; h.go(r); return h.view(); };

ok('nhập dự kiến ngừng: chỉ nhận ngày TƯƠNG LAI; ngày hôm nay / đã qua phải ghi nhận thực tế', () => {
  conf('stop', { kind: 'CONTINUING', from: '2026-10-16', until: '2026-10-31' });
  conf('reality', { kind: 'CONTINUING', from: '2026-10-16', until: '2026-10-31' });
  [today, '2026-10-28'].forEach(d => {
    const r = CS.confirmContinuation(K.stop.c.id, { kind: 'PLANNED_STOP', plannedStopOn: d, evidence: 'COMMITMENT', note: 'x' });
    assert.strictEqual(r.field, 'plannedStopOn', d + ': ' + r.message);
  });
  K.stop.plan = conf('stop', { kind: 'PLANNED_STOP', plannedStopOn: '2026-11-01', evidence: 'COMMITMENT' });
  K.reality.plan = conf('reality', { kind: 'PLANNED_STOP', plannedStopOn: '2026-11-01', evidence: 'COMMITMENT' });
  conf('cont', { kind: 'CONTINUING', from: '2026-10-16', until: '2026-12-31' });
  conf('stopped', { kind: 'STOPPED', stoppedOn: '2026-10-11' });
});
ok('29/10 (trước ngày dự kiến 01/11): dự kiến ngừng là căn cứ hợp lệ; tiếp tục thuê tính đủ; đã ngừng không tính mặt bằng sau ngày kết thúc', () => {
  B.calculatePeriod('CL', mp.id, 'g1');
  assert.strictEqual(mp.evaluatedAt, '2026-10-29');
  assert.strictEqual(land('stop').length, 0, 'planned stop 01/11 → land 11 not billed (still a valid future plan)');
  assert(!warns('stop').some(w => w.severity === 'BLOCKING'));
  assert.strictEqual(land('cont')[0].items[0].billableDays, 30, 'continuing rent keeps billing after expiry');
  assert.strictEqual(land('cont')[0].items[0].coverage.evaluatedAt, '2026-10-29', 'evaluation date snapshotted on the line');
  assert.strictEqual(land('stopped').length, 0, 'actual stop 11/10 → no land 11');
  assert.strictEqual(MP.stateOf('CL', '2026-11').id, 'READY_TO_ISSUE', MP.blockReasons(mp).text);
});
const ttdBefore = MP.stateOf('TTD', '2026-11').id;
ok('02/11 (đã qua ngày dự kiến, chưa xác minh): kỳ tính từ trước bị giữ lại khi phát hành; chợ khác không ảnh hưởng', () => {
  A.db.today = '2026-11-02';
  const stale = MP.staleBasis(mp).map(x => x.contract.id).sort();
  assert.strictEqual(JSON.stringify(stale), JSON.stringify([K.reality.c.id, K.stop.c.id].sort()));
  assert.strictEqual(MP.stateOf('CL', '2026-11').id, 'NEEDS_ACTION');
  assert(MP.blockReasons(mp).codes.STALE_PLANNED_BASIS === 2, MP.blockReasons(mp).text);
  const before = A.db.invoices.length, out = MP.issueMarket('CL', '2026-11', A.currentAccount());
  assert(!out.ok && out.reason === 'NOT_READY' && A.db.invoices.length === before, 'refused, nothing issued');
  assert.strictEqual(MP.staleBasis(MP.get('TTD', '2026-11')).length, 0);
  assert.strictEqual(MP.stateOf('TTD', '2026-11').id, ttdBefore, 'other market unaffected');
});
ok('UI 02/11 (nháp lỗi thời): lý do hiển thị rõ, có liên kết mở đúng HĐ, bộ đếm gộp theo HĐ, không hiện "sẵn sàng"', () => {
  const basis = MP.missingBasis(mp);
  assert.strictEqual(sorted(basis.ids), ids2()); assert.strictEqual(sorted(basis.stale), ids2()); assert.strictEqual(sorted(basis.unverified), ids2());
  const pt = screen('phai-thu');
  [K.stop, K.reality].forEach(k => assert(pt.includes('data-act="pt-contract-open" data-id="' + k.c.id + '"'), 'link to ' + k.c.id));
  assert(pt.includes('STALE_PLANNED_BASIS') && pt.includes('Số liệu nháp tính ngày 29/10/2026 đã lỗi thời'), 'stale draft is explicit');
  assert(pt.includes(COUNTER + '<b>2</b> (trong đó dự kiến ngừng chưa xác minh: 2)'), 'counter = 2 contracts');
  assert(!/Sẵn sàng phát hành/.test(pt) && !/✓ Khoản phải thu hợp lệ/.test(pt), 'never looks ready');
  assert(!pt.includes('PLANNED_BASIS</code> Mặt bằng 11/2026 của hợp đồng ' + K.stop.c.id), 'outdated planned-basis note hidden');
  const pm = screen('theo-doi-ky-thu');
  assert(/2 HĐ hết hạn thiếu căn cứ · 2 dự kiến ngừng chưa xác minh/.test(pm) && /Số liệu nháp đã lỗi thời/.test(pm), 'monitor row explains the reason');
  assert(!/data-act="period-monitor-issue-market" data-market="CL"/.test(pm), 'no per-market issue button');
});
ok('tính lại ngày 02/11: thiếu căn cứ PLANNED_STOP_UNVERIFIED (chặn), không âm thầm bỏ mặt bằng, không suy luận đã ngừng / còn thuê', () => {
  B.calculatePeriod('CL', mp.id, 'g1');
  assert.strictEqual(mp.evaluatedAt, '2026-11-02');
  const w = warns('stop').find(x => x.code === 'PLANNED_STOP_UNVERIFIED');
  assert(w && w.severity === 'BLOCKING' && w.gapFrom === '2026-11-01' && w.gapTo === '2026-11-30' && w.plannedStopOn === '2026-11-01', JSON.stringify(warns('stop')));
  assert(w.action && w.action.act === 'ct-view' && w.action.id === K.stop.c.id, 'link for the manager');
  assert.strictEqual(MP.landContracts(mp).some(c => c.id === K.stop.c.id), true, 'back in the land candidate list');
  assert.strictEqual(CS.usageState(K.stop.c), 'PLANNED_STOP', 'still a plan — not converted to an actual stop');
  assert.strictEqual(MP.staleBasis(mp).length, 0, 'fresh evaluation is no longer stale');
  assert.strictEqual(MP.stateOf('CL', '2026-11').id, 'NEEDS_ACTION');
  [K.stop, K.reality].forEach(k => { assert.strictEqual(BP.get(k.p.id).usageStatus, 'RENTED'); assert.strictEqual(k.c.status, 'ACTIVE'); });
  const basis = MP.missingBasis(mp);
  assert(warns('stop').filter(w => w.severity === 'BLOCKING').length >= 1);
  assert.strictEqual(sorted(basis.ids), ids2(), 'one count per contract, no duplicates'); assert.strictEqual(basis.stale.length, 0); assert.strictEqual(sorted(basis.unverified), ids2());
  const pt = screen('phai-thu');
  assert(/PLANNED_STOP_UNVERIFIED/.test(pt) && !/STALE_PLANNED_BASIS/.test(pt) && pt.includes(COUNTER + '<b>2</b>'), 'counter includes PLANNED_STOP_UNVERIFIED');
  assert(/2 dự kiến ngừng chưa xác minh/.test(screen('theo-doi-ky-thu')) && !/Số liệu nháp đã lỗi thời/.test(h.view()));
});
ok('xác minh thực tế: đã ngừng → không tính mặt bằng sau ngày kết thúc; vẫn kinh doanh → tính đủ; hết chặn', () => {
  const r1 = CS.verifyPlanned(K.stop.c.id, K.stop.plan.id, { evidence: 'SITE_CHECK', note: 'Kiểm tra tại điểm: đã ngừng' });
  assert(!r1.error && r1.record.kind === 'STOPPED' && r1.record.stoppedOn === '2026-11-01', r1.message);
  conf('reality', { kind: 'CONTINUING', from: '2026-11-01', until: '2026-12-31' });
  assert(K.reality.plan.supersededAt && !K.reality.plan.voidedAt, 'plan superseded, kept in history');
  assert.strictEqual(land('stop').length, 0, 'actually stopped from 01/11 → no land 11');
  assert(!warns('stop').some(w => w.severity === 'BLOCKING') && !warns('reality').some(w => w.severity === 'BLOCKING'));
  assert.strictEqual(land('reality')[0].items[0].billableDays, 30, 'reality: still trading → land 11 billed');
  assert.strictEqual(BP.get(K.stop.p.id).usageStatus, 'RENTED', 'stop never releases the point');
  assert.strictEqual(MP.stateOf('CL', '2026-11').id, 'READY_TO_ISSUE', MP.blockReasons(mp).text);
  assert.strictEqual(MP.missingBasis(mp).ids.length, 0);
  const pt = screen('phai-thu');
  assert(!/STALE_PLANNED_BASIS|PLANNED_STOP_UNVERIFIED|thiếu căn cứ/i.test(pt.split(COUNTER + '<b>0</b>').join('')),'warnings disappear after verification');
  assert(/HĐ hết hạn thiếu căn cứ/.test(screen('theo-doi-ky-thu')) === false);
});
ok('phát hành rồi: kỳ đã phát hành không bị tính lại / sửa khi thời gian trôi qua', () => {
  const out = MP.issueMarket('CL', '2026-11', A.currentAccount());
  assert(out.ok, JSON.stringify(out));
  const issued = JSON.stringify(A.db.invoices.filter(i => i.billingPeriodId === 'CL_2026-11'));
  A.db.today = '2026-11-25';
  assert.strictEqual(MP.canCalculate(mp), false);
  assert.strictEqual(B.calculatePeriod('CL', mp.id, 'g1').warnings[0].code, 'PERIOD_ALREADY_ISSUED');
  assert.strictEqual(MP.staleBasis(mp).length, 0, 'issued period is never stale-checked');
  assert.strictEqual(JSON.stringify(A.db.invoices.filter(i => i.billingPeriodId === 'CL_2026-11')), issued);
  assert(!A.db.invoices.some(i => i.billingPeriodId === 'CL_2026-11' && (i.items || []).some(it => it.contractId === K.stop.c.id && it.chargeType === 'LAND')));
});
console.log('planned-stop-verification regression PASS (' + passed + ' checks)');

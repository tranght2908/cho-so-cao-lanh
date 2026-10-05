/* Focused UI regression: bố cục gọn của Theo dõi kỳ thu (header · 4 KPI · Tiến độ kỳ thu + hành động chính · bảng theo chợ).
 * Chỉ kiểm tra render/điều hướng; logic kỳ thu dùng nguyên market-period.js. */
const assert = require('assert');
const path = require('path');
const { createApp } = require('./harness');

let passed = 0;
const ok = (label, fn) => { try { fn(); passed++; } catch (e) { e.message = label + ': ' + e.message; throw e; } };
const h = createApp(path.resolve(__dirname, '../..')), A = h.A, S = A.features.finance.marketPeriod, M = '2026-11';
const login = (id, market) => { A.ui.currentDemoAccountId = id; A.ui.sessionAccountId = id; if (market) A.ui.market = market; A.syncAccountContext(); };
const kpis = v => Array.from(v.matchAll(/<div class="k-label">([^<]+)<\/div><div class="k-value[^"]*">(\d+)<\/div>/g)).map(m => m[1] + '=' + m[2]);
const rowsOf = v => (v.match(/data-act="period-monitor-open"/g) || []).length;
const open = () => { login('AC-NV01', 'CL'); A.ui.periodMonitorPeriod = M; h.go('theo-doi-ky-thu'); return h.view(); };

ok('layout: one KPI row, one progress card with stepper + actions, no separate issue card', () => {
  const v = open();
  assert.deepStrictEqual(kpis(v), ['Tổng số chợ=12', 'Sẵn sàng phát hành=0', 'Chưa đủ điều kiện=2', 'Không áp dụng=10']);
  assert(!v.includes('card period-monitor-issue"') && !v.includes('k-label">Đã phát hành<'), 'no separate issue card / second KPI set');
  assert.strictEqual((v.match(/class="kpis/g) || []).length, 1, 'single KPI row');
  assert(v.includes('Tiến độ kỳ thu') && (v.match(/class="period-monitor-step /g) || []).length === 6, '6-step stepper');
  ['Ghi chỉ số', 'Tính khoản thu', 'Phát hành', 'Thu tiền', 'Đối soát', 'Chốt kỳ'].forEach(s => assert(v.includes('<b>' + s + '</b>'), s));
  assert(v.includes('0/2 chợ'), 'denominator = applicable markets only');
  assert(v.includes('Hoàn tất: 0 · Không áp dụng: 10 · Còn 2/12 chợ chưa hoàn tất'), 'summary line');
});

ok('CASE 1: 0 READY + 2 recording + 10 N/A → alert + "Phát hành kỳ thu" disabled primary, "Chốt kỳ thu" secondary', () => {
  const v = open();
  assert(v.includes('Còn 2 chợ chưa đủ điều kiện phát hành.'));
  assert(/class="btn primary" data-act="period-monitor-issue-open" disabled/.test(v), 'issue disabled');
  assert(/class="btn " data-act="period-monitor-close" disabled/.test(v), 'close secondary + disabled');
});

ok('CASE 5: filters (5 main + "Trạng thái khác") and search still work', () => {
  let v = open();
  ['Tất cả (12)', 'Cần xử lý', 'Sẵn sàng phát hành', 'Đang thu', 'Hoàn tất'].forEach(x => assert(v.includes(x), x));
  assert(v.includes('data-ch="period-monitor-filter-more"') && v.includes('Trạng thái khác'), 'more dropdown');
  ['Chưa phân công', 'Chờ ghi chỉ số', 'Đang ghi chỉ số (2)', 'Hoàn tất thu', 'Chờ/Xử lý đối soát', 'Không áp dụng (10)'].forEach(x => assert(v.includes(x), x));
  A.CH['period-monitor-filter-more']({ value: 'NOT_APPLICABLE', dataset: {} }); h.flush();
  assert.strictEqual(rowsOf(h.view()), 10, 'N/A filter');
  A.CH['period-monitor-filter-more']({ value: 'METER_RECORDING', dataset: {} }); h.flush();
  assert.strictEqual(rowsOf(h.view()), 2);
  h.act('period-monitor-filter', { id: 'all' });
  A.IN['period-monitor-search']({ value: 'Cao Lãnh', dataset: {} }); h.flush();
  assert.strictEqual(rowsOf(h.view()), 1, 'search');
  A.IN['period-monitor-search']({ value: '', dataset: {} }); h.flush();
  assert(/<span class="pm-dot pm-dot-muted">Chưa phát hành<\/span>/.test(h.view()), 'light dot status in secondary columns');
});

ok('CASE 6: clicking a market navigates by its state', () => {
  open();
  h.act('period-monitor-open', { market: 'CL', period: M });
  assert.strictEqual(A.current, 'dien-nuoc', 'recording → Chỉ số điện, nước');
});

ok('CASE 2: 2 READY + 10 N/A → "12/12 chợ đủ điều kiện phát hành." and issue enabled', () => {
  login('AC-NV02', 'CL'); assert(S.completeMeter('CL', M, A.currentAccount()).ok);
  const tpl = A.SERVICE_CFG.list('stallPrices').find(x => x.marketId === 'CL' && x.stallType === 'Trong nhà lồng chợ');
  const rec = Object.assign({}, tpl, { marketId: 'TTD' }); delete rec.id; delete rec.history;
  A.SERVICE_CFG.add('stallPrices', rec, 'test');
  login('AC-NV07', 'TTD'); assert(S.completeMeter('TTD', M, A.currentAccount()).ok);
  const v = open();
  assert.deepStrictEqual(kpis(v), ['Tổng số chợ=12', 'Sẵn sàng phát hành=2', 'Chưa đủ điều kiện=0', 'Không áp dụng=10']);
  assert(v.includes('12/12 chợ đủ điều kiện phát hành.'));
  assert(/class="btn primary" data-act="period-monitor-issue-open" >/.test(v), 'issue enabled primary');
  assert(/class="btn " data-act="period-monitor-close" disabled/.test(v), 'close not emphasised');
  h.act('period-monitor-open', { market: 'CL', period: M });
  assert.strictEqual(A.current, 'phai-thu', 'ready → Khoản phải thu');
});

ok('CASE 3: after issuance (2 COLLECTING) → issue button gone; close stays secondary', () => {
  open();
  h.act('period-monitor-issue-confirm', { period: M });
  const v = open();
  assert(!v.includes('data-act="period-monitor-issue-open"'), 'issue no longer shown');
  assert(/class="btn " data-act="period-monitor-close" disabled/.test(v), 'close secondary until ready');
  assert(v.includes('Còn 2 chợ chưa hoàn tất thu hoặc đối soát.'));
  assert(/pm-dot-ok">Đã phát hành/.test(v) && /pm-dot-info">0\/\d+/.test(v), 'issued + 0/N collection');
  h.act('period-monitor-open', { market: 'CL', period: M });
  assert.strictEqual(A.current, 'thu-tien', 'collecting → Thu tiền');
});

ok('CASE 4: 2 COMPLETED + 10 N/A → "Chốt kỳ thu" enabled and primary', () => {
  // Dữ liệu giả lập trong bộ nhớ: đánh dấu 2 chợ đã hoàn tất thu + đối soát khớp (chỉ để kiểm tra render).
  ['CL', 'TTD'].forEach(m => { const mp = S.get(m, M); S.invoices(mp).forEach(i => Object.assign(i, { status: 'paid', paid: i.amount })); mp.collection = { reconciliationStatus: 'RECONCILED', result: 'MATCHED', summary: {} }; });
  const v = open();
  assert(/class="btn primary" data-act="period-monitor-close" >/.test(v), 'close primary + enabled');
  assert(v.includes('đủ điều kiện chốt kỳ'));
  assert(v.includes('Hoàn tất: 2 · Không áp dụng: 10 · Còn 0/12 chợ chưa hoàn tất'));
});

console.log('period-monitoring-ui regression PASS (' + passed + ' checks)');

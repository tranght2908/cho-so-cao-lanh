/* Hoàn tất chỉ số theo KỲ CỦA CHỢ: mốc meter lưu trên MarketPeriod; chợ này hoàn tất không khóa chợ khác.
 * Migration: completionByMarket của kỳ chỉ số legacy được chuyển lên kỳ của từng chợ. */
const assert = require('assert');
const path = require('path');
const { createApp } = require('./harness');

const ROOT = path.resolve(__dirname, '../..');
// State đã lưu kiểu cũ: kỳ chỉ số 09/2026 dùng chung, TTD đã khóa riêng qua completionByMarket, CL chưa.
const base = createApp(ROOT);
const old = JSON.parse(base.localStorage.getItem('choso-caolanh-state'));
old.billingPeriods = old.billingPeriods.filter(p => !(p.marketId && p.period === '2026-09'));
old.billingPeriods.filter(p => !p.marketId && p.period === '2026-09').forEach(p => { delete p.superseded; });
old.meterPeriods.filter(m => m.id === '2026-09').forEach(m => { m.completionByMarket = { CL: { status: 'PENDING' }, TTD: { status: 'CLOSED', completedBy: 'TTD closer', completedAt: '29/09/2026 17:44' } }; });
delete old.periodModelVersion;
const h = createApp(ROOT, { storage: { 'choso-caolanh-state': JSON.stringify(old) } }), A = h.A, S = A.features.finance.marketPeriod;

assert.equal(S.get('TTD', '2026-09').meter.status, 'COMPLETED', 'TTD per-market completion migrated');
assert.equal(S.get('TTD', '2026-09').meter.completedBy, 'TTD closer');
assert(!S.get('CL', '2026-09').meter, 'CL stays open');
assert.equal(A.meterPeriodIsClosed({ id: '2026-09' }, 'TTD'), true);
assert.equal(A.meterPeriodIsClosed({ id: '2026-09' }, 'CL'), false);

const login = (id, market) => { A.ui.currentDemoAccountId = id; A.ui.sessionAccountId = id; A.ui.market = market; A.syncAccountContext(); };
login('AC-NV02', 'CL'); A.ui.f.mrPeriod = '2026-09';
let html = A.VIEWS['dien-nuoc']();
assert(html.includes('Đang ghi') || html.includes('Chờ ghi chỉ số'), 'CL header resolves its own state');
assert(html.includes('Ghi chỉ số') || html.includes('Cập nhật') || html.includes('Kiểm tra'), 'CL can still record while TTD is completed');
login('AC-NV07', 'TTD'); A.ui.f.mrPeriod = '2026-09';
html = A.VIEWS['dien-nuoc']();
assert(html.includes('Đã hoàn tất'), 'TTD shows completed');
assert(!html.includes('data-act="mr-complete-open"'), 'completed market has no complete action');

// Hoàn tất CL không đổi TTD và ngược lại; Tổ trưởng không có quyền hoàn tất.
login('AC-NV01', 'CL');
assert(!A.canDo('dien-nuoc.chot-ky', 'CL'));
const clPeriod = S.get('CL', '2026-09');
S.meterPoints(clPeriod).forEach(st => { const r = S.readingOf(clPeriod, st.id); if (r) Object.assign(r, { elecCur: r.elecCur != null ? r.elecCur : (r.elecPrev || 0) + 10, waterCur: r.waterCur != null ? r.waterCur : (r.waterPrev || 0) + 1, reviewRequired: false, reviewedAt: '01/10/2026 08:00' }); });
login('AC-NV02', 'CL');
const out = S.completeMeter('CL', '2026-09', A.currentAccount());
assert(out.ok, 'CL completed by its fee collector');
assert.equal(S.get('TTD', '2026-09').meter.completedBy, 'TTD closer', 'TTD unchanged');
console.log('meter-market-completion: OK');

/* Focused regression: "Tổng quan liên chợ" (route tong-quan) — KPI/charts/cards derived from the market
 * catalog, business points and trader profiles within marketScopes; card image/placeholder; filters;
 * card → selectedMarket → #/mat-bang; no "Nợ phí" KPI/status; legacy data (Theo phiên, no image). */
const assert = require('assert');
const path = require('path');
const { createApp } = require('./harness');
const root = path.resolve(__dirname, '../..');
let passed = 0;
const ok = (label, fn) => { try { fn(); passed++; } catch (e) { e.message = label + ': ' + e.message; throw e; } };
const login = (A, id, market) => { A.ui.sessionAccountId = id; A.ui.currentDemoAccountId = id; A.ui.market = market || 'ALL'; A.syncAccountContext(); };
const PNG = 'data:image/png;base64,iVBORw0KGgo=';
const eq0 = (o, exp) => Object.keys(exp).forEach(k => assert.strictEqual(o[k], exp[k], k));

const h = createApp(root), A = h.A;
const MC = A.features.markets.service, BP = A.features.businessPoints.service;
const view = () => { h.go('tong-quan'); return h.view(); };
const cardIds = v => (v.match(/<article class="card tq-market[^"]*"(?: data-act="tq-open-market" data-id="([^"]+)")?/g) || []).length;
const cardBlock = (v, id) => { const i = v.indexOf(`data-act="tq-open-market" data-id="${id}" title=`); assert(i !== -1, 'card ' + id); return v.slice(i, v.indexOf('</article>', i)); };
const live = id => BP.list().filter(st => st.market === id && st.structuralStatus !== 'MERGED' && st.structuralStatus !== 'SPLIT');

login(A, 'AC-QT01');
const ALL = A.allowedMarkets(A.currentAccount());

ok('1 multi-market account: KPI/cards cover every market in scope; no CRUD, no debt KPI', () => {
  const v = view();
  assert.strictEqual(A.current, 'tong-quan');
  assert(/Tổng quan liên chợ/.test(v) && /Tình hình hoạt động và khai thác các chợ trên địa bàn phường Cao Lãnh/.test(v));
  assert.strictEqual(cardIds(v), ALL.length, 'one card per market in scope');
  assert(v.includes(`Phạm vi: <b>${ALL.length} chợ</b>`));
  assert(!/dmc-new|dmc-edit|Thêm chợ mới/.test(v), 'no catalog CRUD');
  assert(!/Nợ phí|Nợ quá hạn|nợ phí quá hạn|Công nợ/i.test(v), 'no debt KPI/row/status');
  assert(!/So sánh giữa các chợ/.test(v), 'wide comparison table replaced by cards');
  ['Tỷ lệ lấp đầy các chợ', 'Số điểm kinh doanh theo hạng chợ', 'Tình trạng hoạt động của các chợ', 'Danh sách các chợ', 'Cảnh báo cần xử lý'].forEach(t => assert(v.includes(t), t));
  const totalPts = ALL.reduce((n, id) => n + live(id).length, 0);
  assert(v.includes(`<div class="k-label">Điểm kinh doanh</div><div class="k-value">${totalPts.toLocaleString('vi-VN')}</div>`), 'total points KPI');
  const active = MC.rows().filter(m => ALL.includes(m.id) && m.status === 'ACTIVE').length;
  assert(v.includes(`<div class="k-label">Chợ đang hoạt động</div><div class="k-value">${active}</div>`));
  assert(v.includes(`<div class="k-label">Chợ chưa hoạt động</div><div class="k-value">${ALL.length - active}</div>`));
});
ok('2 Chợ Cao Lãnh: points and occupancy follow displayStatus (Nợ phí counted as Đang thuê)', () => {
  const pts = live('CL');
  assert(pts.length > 0, 'fixture: CL has points');
  const occ = pts.filter(st => ['thue', 'no'].includes(A.pointDisplayStatus(st))).length;
  const c = cardBlock(view(), 'CL');
  assert(c.includes(`<dt>Điểm KD</dt><dd>${pts.length.toLocaleString('vi-VN')}</dd>`), 'CL points');
  assert(c.includes(`<dt>Lấp đầy</dt><dd>${A.U.pctTxt(A.U.pct(occ, pts.length))}</dd>`), 'CL occupancy');
  const traders = A.db.traders.filter(t => t.market === 'CL' && A.features.traders.service.deriveBusinessStatus(t) === 'ACTIVE').length;
  assert(c.includes(`<dt>Tiểu thương</dt><dd>${traders.toLocaleString('vi-VN')}</dd>`), 'CL active traders');
});
ok('3 market without layout: zeros + "Chưa thiết lập mặt bằng", no invented points', () => {
  assert(!MC.layoutReady('HA') && live('HA').length === 0, 'fixture: HA not set up');
  const before = A.db.stalls.length;
  const c = cardBlock(view(), 'HA');
  assert(/Chưa thiết lập mặt bằng/.test(c));
  assert(c.includes('<dt>Điểm KD</dt><dd>0</dd>') && c.includes('<dt>Tiểu thương</dt><dd>0</dd>') && c.includes('<dt>Lấp đầy</dt><dd>0%</dd>'));
  assert.strictEqual(A.db.stalls.length, before, 'no business point generated');
});
ok('4/5 card image from market.image; legacy market without image → placeholder', () => {
  MC.update('HA', { image: { name: 'ha.png', type: 'image/png', dataUrl: PNG } }, 'test');
  const v = view();
  assert(cardBlock(v, 'HA').includes(`<img src="${PNG}"`), 'image rendered');
  assert(/onerror="this.remove\(\)"/.test(cardBlock(v, 'HA')), 'broken image falls back to placeholder');
  assert(!/<img /.test(cardBlock(v, 'CL')) && /Chưa có ảnh/.test(cardBlock(v, 'CL')), 'placeholder');
});
ok('search / status / rank / sort', () => {
  A.IN['tq-search']({ value: 'cao lãnh' }); let v = h.view();
  assert(cardIds(v) >= 1 && cardIds(v) < ALL.length && cardBlock(v, 'CL'));
  A.IN['tq-search']({ value: 'CL' }); assert(cardIds(h.view()) >= 1, 'search by code');
  A.IN['tq-search']({ value: '' });
  A.CH['tq-status']({ value: 'ACTIVE' }); v = h.view();
  assert.strictEqual(cardIds(v), MC.rows().filter(m => ALL.includes(m.id) && m.status === 'ACTIVE').length);
  A.CH['tq-status']({ value: '' });
  A.CH['tq-rank']({ value: 'HANG_1' }); assert.strictEqual(cardIds(h.view()), MC.rows().filter(m => ALL.includes(m.id) && m.rank === 'HANG_1').length);
  A.CH['tq-rank']({ value: '' });
  A.CH['tq-sort']({ value: 'occ-desc' }); v = h.view();
  const first = (v.match(/data-act="tq-open-market" data-id="([^"]+)" title=/) || [])[1];
  const best = Math.max.apply(null, ALL.map(id => { const p = live(id); return A.U.pct(p.filter(st => ['thue', 'no'].includes(A.pointDisplayStatus(st))).length, p.length); }));
  const p = live(first);
  assert.strictEqual(A.U.pct(p.filter(st => ['thue', 'no'].includes(A.pointDisplayStatus(st))).length, p.length), best, 'highest occupancy first');
  A.CH['tq-sort']({ value: 'bogus' }); assert.strictEqual(A.ui.tqFilter.sort, 'name-asc');
  A.CH['tq-status']({ value: 'NOT_ACTIVE' }); assert(h.view().includes(`Phạm vi: <b>${ALL.length} chợ</b>`), 'filters only affect the card list');
  A.ui.tqFilter = null;
});
ok('6 "Xem mặt bằng" on Chợ Cao Lãnh → selectedMarket CL → #/mat-bang', () => {
  view();
  h.act('tq-open-market', { id: 'CL' });
  assert.strictEqual(A.ui.market, 'CL');
  assert.strictEqual(A.current, 'mat-bang');
  assert(/Chợ Cao Lãnh/.test(h.view()), 'layout of CL rendered');
  // Back to the dashboard: still cross-market, not narrowed to CL.
  assert.strictEqual(cardIds(view()), ALL.length);
});
ok('11 scoped account: aggregation only over its markets; cannot open a market outside scope', () => {
  const ld = A.ACCOUNTS.currentList().find(a => a.id === 'AC-LD01');
  const prev = ld.marketScopes;
  ld.marketScopes = ['CL', 'HA'];
  login(A, 'AC-LD01', 'CL');
  const allowed = A.allowedMarkets(ld);
  const v = view();
  assert.strictEqual(cardIds(v), allowed.length);
  assert(!v.includes('data-id="TTD" title='), 'TTD not in scope');
  assert(v.includes(`Phạm vi: <b>${allowed.length} chợ</b>`));
  const pts = allowed.reduce((n, id) => n + live(id).length, 0);
  assert(v.includes(`<div class="k-label">Điểm kinh doanh</div><div class="k-value">${pts.toLocaleString('vi-VN')}</div>`), 'KPI aggregated over scope only');
  h.act('tq-open-market', { id: 'TTD' });
  assert.notStrictEqual(A.ui.market, 'TTD', 'out-of-scope market rejected');
  ld.marketScopes = prev;
  login(A, 'AC-QT01');
});
ok('7 reload: dashboard derives the same numbers from persisted data', () => {
  const v1 = view();
  const saved = {};
  ['choso-caolanh-marketcatalog', 'choso-caolanh-state', 'choso-caolanh-accounts', 'choso-caolanh-permissions'].forEach(k => { const x = h.localStorage.getItem(k); if (x != null) saved[k] = x; });
  const h2 = createApp(root, { storage: saved });
  login(h2.A, 'AC-QT01');
  h2.go('tong-quan');
  const v2 = h2.view();
  assert.strictEqual(cardIds(v2), cardIds(v1));
  assert(cardBlock(v2, 'HA').includes(`<img src="${PNG}"`), 'image persisted');
  assert.strictEqual(cardBlock(v2, 'CL').match(/<dl class="tq-metrics">[\s\S]*?<\/dl>/)[0], cardBlock(v1, 'CL').match(/<dl class="tq-metrics">[\s\S]*?<\/dl>/)[0]);
});
ok('8 legacy "Theo phiên" points and legacy catalog render without changes', () => {
  const session = A.db.stalls.filter(st => st.areaTypeId === 'session');
  assert(session.length > 0, 'fixture: legacy session points exist');
  const snap = JSON.stringify(session);
  const legacy = JSON.stringify([{ id: 'TTD', code: 'TTD', rank: 'HANG_3', unit: 'BQL', manager: '', phone: '0909', priceConfigId: 'QD480_NHOM_CON_LAI', status: 'active', image: 'broken' }]);
  const h3 = createApp(root, { storage: { 'choso-caolanh-marketcatalog': legacy } });
  login(h3.A, 'AC-QT01');
  h3.go('tong-quan');
  assert.strictEqual(h3.A.current, 'tong-quan');
  assert(cardBlock(h3.view(), 'TTD') && /Chưa có ảnh/.test(cardBlock(h3.view(), 'TTD')));
  assert.strictEqual(JSON.stringify(A.db.stalls.filter(st => st.areaTypeId === 'session')), snap, 'legacy points untouched');
});
ok('"Nợ phí" is not a point display status: overdue debt still shows Đang thuê; no chip on Mặt bằng', () => {
  const S = A.features.businessPoints.service;
  assert(!S.DISPLAY_STATUSES.includes('no'));
  const debt = S.debtStatus;
  S.debtStatus = () => 'overdue';
  try {
    const occupied = live('CL').filter(st => S.contractOn(st.id, A.U.today()));
    assert(occupied.length > 0);
    occupied.forEach(st => { if (!['ngung', 'tranhchap'].includes(A.pointDisplayStatus(st))) assert.strictEqual(A.pointDisplayStatus(st), 'thue', st.id); });
    login(A, 'AC-QT01', 'CL'); h.go('mat-bang');
    assert.strictEqual(A.current, 'mat-bang');
    assert(!/mb-chip-no|data-id="no"/.test(h.view()), 'no Nợ phí chip/filter');
    assert(/mb-map-legend/.test(h.view()) && /Đang thuê/.test(h.view()));
    A.ACT['mb-filter-status']({ dataset: { id: 'no' } });
    assert.strictEqual(A.ui.mb.filter.status, '', 'legacy "no" filter ignored');
  } finally { S.debtStatus = debt; login(A, 'AC-QT01'); }
});
ok('shared occupancy helper: one formula for Dashboard, Báo cáo and Mặt bằng; MERGED/SPLIT excluded; 0 → 0%', () => {
  const S = A.features.businessPoints.service;
  eq0(S.occupancy([]), { total: 0, occupied: 0, pct: 0 });
  const cl = A.db.stalls.filter(st => st.market === 'CL');
  const fake = Object.assign({}, cl[0], { id: 'X-MERGED', structuralStatus: 'MERGED' });
  assert.strictEqual(S.occupancy(cl.concat([fake])).total, S.occupancy(cl).total, 'retired record not in denominator');
  const o = S.occupancy(cl);
  assert.strictEqual(o.pct, A.U.pct(o.occupied, o.total));
  assert.strictEqual(o.occupied, cl.filter(st => S.isCountable(st) && A.pointDisplayStatus(st) === 'thue').length);
  // Dashboard and Báo cáo (lapday, phạm vi Tất cả) report the same system-wide rate.
  login(A, 'AC-QT01');
  const dash = (view().match(/<div class="k-label">Tỷ lệ lấp đầy<\/div><div class="k-value">([^<]+)</) || [])[1];
  A.ui.report = 'lapday'; h.go('bao-cao');
  const rep = (h.view().match(/Lấp đầy<\/[^>]+>\s*<[^>]+>([^<]+)</) || [])[1];
  const all = S.occupancy(S.list().filter(st => ALL.includes(st.market)));
  assert.strictEqual(dash, A.U.pctTxt(all.pct), 'dashboard uses the helper');
  assert(h.view().includes(A.U.pctTxt(all.pct)), 'report summary shows the same rate: ' + rep);
  // Mặt bằng chip totals follow the same helper.
  login(A, 'AC-QT01', 'CL'); h.go('mat-bang');
  assert.strictEqual(A.mbMarketStats('CL').total, S.occupancy(A.mbBusinessPointsForMarket('CL')).total);
  login(A, 'AC-QT01');
});
ok('point detail panels show no "Nợ phí"/"Công nợ" (unpaid info lives in Thu phí)', () => {
  const S = A.features.businessPoints.service;
  const debt = S.debtStatus;
  S.debtStatus = () => 'overdue';
  try {
    const ttd = A.db.stalls.find(st => st.market === 'TTD' && S.contractOn(st.id, A.U.today()));
    assert(ttd, 'fixture: occupied TTD point');
    const html = A.stallPanel(ttd);
    assert(!/Nợ phí|Công nợ|Không nợ|data-act="pay-open"/.test(html), 'stallPanel has no debt row/shortcut');
    assert(/Hợp đồng/.test(html));
  } finally { S.debtStatus = debt; }
});
ok('no aggregate is persisted by rendering the dashboard', () => {
  const before = h.localStorage.getItem('choso-caolanh-marketcatalog');
  view(); view();
  assert.strictEqual(h.localStorage.getItem('choso-caolanh-marketcatalog'), before);
  assert(!Object.keys(A.ui).some(k => /^tq/.test(k) && k !== 'tqFilter'));
});
console.log(`tong-quan-dashboard regression PASS (${passed} checks)`);

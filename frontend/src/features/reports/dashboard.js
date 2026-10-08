/* Cross-market dashboard (route tong-quan) — "Tổng quan liên chợ": KPI, biểu đồ tổng hợp, danh sách chợ dạng
 * card và cảnh báo cần xử lý. Chỉ đọc (không CRUD — thêm/sửa chợ thuộc "Danh mục chợ").
 *
 * Phạm vi: LUÔN là toàn bộ chợ thuộc marketScopes của tài khoản (A.allowedMarkets) ∩ danh mục chợ — lọc
 * TRƯỚC khi tổng hợp, không phụ thuộc chợ đang chọn (ui.market). Card "Xem mặt bằng" đặt ui.market =
 * chợ đó rồi mở #/mat-bang (router kiểm tra lại quyền qua U.can).
 *
 * Nguồn dữ liệu (tính động khi render, không lưu aggregate):
 *   - Chợ           : features.markets.service (tên, mã, hạng, trạng thái, ảnh, layoutReady) + vòng đời dùng
 *                     chung markets.service.lifecycle (= lifecycle.service.marketLifecycle).
 *   - Điểm KD       : features.businessPoints.service.list() + occupancy() — helper DÙNG CHUNG (cùng Báo cáo,
 *                     thống kê Mặt bằng): bỏ MERGED/SPLIT, tình trạng theo displayStatus, lấp đầy = Đang thuê /
 *                     tổng. Đổi quy tắc thì sửa ở businessPoints.service, không sửa riêng dashboard.
 *   - Tiểu thương   : hồ sơ theo chợ (db.traders) có trạng thái kinh doanh ACTIVE (traders.service).
 */
(function (A) {
  'use strict';
  const D = A.D, U = A.U, ui = A.ui;
  const MC = () => A.features.markets.service;
  const BP = () => A.features.businessPoints.service;
  const TS = () => A.features.traders && A.features.traders.service;
  const fmtNum = n => Number(n || 0).toLocaleString('vi-VN');

  // Chợ thuộc phạm vi tài khoản đang dùng (thứ tự theo danh mục chợ).
  function scopedMarkets() {
    const allowed = new Set(A.allowedMarkets(A.currentAccount()));
    return MC().rows().filter(m => allowed.has(m.id));
  }
  // Lấp đầy theo chợ — helper dùng chung businessPoints.service.occupancy (cùng công thức với Báo cáo).
  function pointStats(ids) {
    const byMarket = {};
    ids.forEach(id => { byMarket[id] = []; });
    BP().list().forEach(st => { if (byMarket[st.market]) byMarket[st.market].push(st); });
    const out = {};
    ids.forEach(id => { out[id] = BP().occupancy(byMarket[id]); });
    return out;
  }
  const isActiveTrader = t => (TS() && TS().deriveBusinessStatus ? TS().deriveBusinessStatus(t) : t.status) === 'ACTIVE';
  // Hồ sơ tiểu thương đang kinh doanh theo chợ. Tổng toàn phạm vi đếm theo NGƯỜI: hồ sơ ở nhiều chợ của
  // cùng 1 người (cùng số CCCD) chỉ tính 1 lần; hồ sơ thiếu CCCD tính theo mã hồ sơ.
  function traderStats(ids) {
    const scope = new Set(ids), byMarket = {}, people = new Set();
    ids.forEach(id => { byMarket[id] = 0; });
    let profiles = 0;
    (A.db.traders || []).forEach(t => {
      if (!scope.has(t.market) || !isActiveTrader(t)) return;
      byMarket[t.market]++; profiles++;
      people.add(t.idNo ? 'cccd:' + String(t.idNo).trim() : 'id:' + t.id);
    });
    return { byMarket, profiles, people: people.size };
  }
  function buildStats() {
    const markets = scopedMarkets(), ids = markets.map(m => m.id);
    const pts = pointStats(ids), trs = traderStats(ids);
    const cards = markets.map(m => {
      const p = pts[m.id];
      return { market: m, points: p, traders: trs.byMarket[m.id] || 0, occPct: p.pct, layoutReady: MC().layoutReady(m.id), lifecycle: MC().lifecycle(m.id) };
    });
    const all = BP().occupancy(BP().list().filter(st => ids.indexOf(st.market) !== -1));
    return {
      ids, cards, total: all.total, occupied: all.occupied, vacant: all.vacant, blocked: all.blocked, occPct: all.pct,
      active: markets.filter(m => m.status === 'ACTIVE').length, layoutSet: cards.filter(c => c.layoutReady).length,
      pendingFee: cards.filter(c => c.lifecycle && c.lifecycle.stage === 'PENDING_FEE').length,
      feeWarning: cards.filter(c => c.lifecycle && c.lifecycle.feeConfigWarning).length,
      traders: trs.people, traderProfiles: trs.profiles,
      byRank: Object.keys(MC().RANKS).map(k => ({ rank: k, label: MC().RANKS[k], points: U.sum(cards.filter(c => c.market.rank === k), c => c.points.total) }))
    };
  }

  // ---------- Header & KPI ----------
  function headerHtml(s) {
    return `<section class="card tq-head"><div>
      <h2>Tổng quan liên chợ</h2>
      <p>Tình hình hoạt động và khai thác các chợ trên địa bàn phường Cao Lãnh</p></div>
      <div class="tq-head-meta"><span>Phạm vi: <b>${fmtNum(s.ids.length)} chợ</b></span><span>Cập nhật ${U.dmy(U.today())}</span></div>
    </section>`;
  }
  function kpisHtml(s) {
    const kpi = (label, value, sub, bar) => `<div class="card kpi"><div class="k-label">${label}</div><div class="k-value">${value}</div>${sub ? `<div class="k-sub">${sub}</div>` : ''}${bar != null ? `<div class="bar-mini"><i style="width:${Math.min(100, bar)}%"></i></div>` : ''}</div>`;
    return `<div class="tq-kpis">
      ${kpi('Tổng số chợ', fmtNum(s.ids.length), 'Trong phạm vi quản lý')}
      ${kpi('Chợ đang hoạt động', fmtNum(s.active), s.feeWarning ? fmtNum(s.feeWarning) + ' chợ cần cập nhật mức thu' : U.pctTxt(U.pct(s.active, s.ids.length)) + ' tổng số chợ', U.pct(s.active, s.ids.length))}
      ${kpi('Chợ chưa hoạt động', fmtNum(s.ids.length - s.active), s.pendingFee ? fmtNum(s.pendingFee) + ' chợ chờ cấu hình mức thu' : 'Chưa thiết lập mặt bằng')}
      ${kpi('Đã thiết lập mặt bằng', fmtNum(s.layoutSet), fmtNum(s.ids.length - s.layoutSet) + ' chợ chưa thiết lập')}
      ${kpi('Điểm kinh doanh', fmtNum(s.total), `${fmtNum(s.occupied)} đang thuê · ${fmtNum(s.vacant)} còn trống`)}
      ${kpi('Tỷ lệ lấp đầy', U.pctTxt(s.occPct), 'Đang thuê / tổng điểm kinh doanh', s.occPct)}
      ${kpi('Tiểu thương đang hoạt động', fmtNum(s.traders), s.traderProfiles !== s.traders ? fmtNum(s.traderProfiles) + ' hồ sơ tại các chợ' : 'Có hợp đồng đang hiệu lực')}
    </div>`;
  }

  // ---------- Biểu đồ ----------
  function chartsHtml(s) {
    const occ = [
      { label: 'Đang thuê', value: s.occupied, color: D.STATUS.thue.color },
      { label: 'Còn trống', value: s.vacant, color: D.STATUS.trong.color }
    ].concat(s.blocked ? [{ label: 'Tạm ngừng / tranh chấp', value: s.blocked, color: D.STATUS.ngung.color }] : []);
    const maxRank = Math.max.apply(null, s.byRank.map(r => r.points).concat([0]));
    const bars = U.bars(s.byRank.map(r => r.label), [{ name: 'Điểm kinh doanh', values: s.byRank.map(r => r.points), color: '#1f6fd0' }],
      { stacked: false, h: 200, fmt: v => fmtNum(Math.round(v)), max: maxRank < 4 ? 4 : null });
    const status = [
      { label: 'Đang hoạt động', value: s.active, color: D.STATUS.thue.color },
      { label: 'Chưa hoạt động', value: s.ids.length - s.active, color: D.STATUS.ngung.color }
    ];
    const card = (title, body, note) => `<div class="card tq-chart"><div class="card-h"><h3>${title}</h3></div><div class="card-b">${body}${note ? `<div class="small muted tq-chart-note">${note}</div>` : ''}</div></div>`;
    return `<div class="tq-charts">
      ${card('Tỷ lệ lấp đầy các chợ', U.donut(occ, [U.pctTxt(s.occPct), 'lấp đầy']), s.total ? '' : 'Chưa có điểm kinh doanh nào được khai báo.')}
      ${card('Số điểm kinh doanh theo hạng chợ', bars)}
      ${card('Tình trạng hoạt động của các chợ', U.donut(status, [fmtNum(s.ids.length), 'chợ']))}
    </div>`;
  }

  // ---------- Danh sách chợ (card) ----------
  function filterState() { return ui.tqFilter || (ui.tqFilter = { search: '', status: '', rank: '', sort: 'name-asc' }); }
  const SORTS = {
    'name-asc': ['Tên A → Z', (a, b) => a.market.name.localeCompare(b.market.name, 'vi')],
    'name-desc': ['Tên Z → A', (a, b) => b.market.name.localeCompare(a.market.name, 'vi')],
    'occ-desc': ['Tỷ lệ lấp đầy cao → thấp', (a, b) => b.occPct - a.occPct || a.market.name.localeCompare(b.market.name, 'vi')],
    'occ-asc': ['Tỷ lệ lấp đầy thấp → cao', (a, b) => a.occPct - b.occPct || a.market.name.localeCompare(b.market.name, 'vi')]
  };
  function visibleCards(cards) {
    const f = filterState(), q = String(f.search || '').trim().toLowerCase();
    const sort = SORTS[f.sort] || SORTS['name-asc'];
    return cards.filter(c => (!q || [c.market.name, c.market.code, c.market.id].join(' ').toLowerCase().includes(q)) &&
      (!f.status || c.market.status === f.status) && (!f.rank || c.market.rank === f.rank)).sort(sort[1]);
  }
  // Mặt bằng được mở khi tài khoản có quyền màn mat-bang (cùng điều kiện U.can) và chợ thuộc phạm vi.
  function canOpenLayout(id) {
    if (A.allowedMarkets(A.currentAccount()).indexOf(id) === -1) return false;
    return A.PERM.canScreen(ui.role, 'mat-bang') || (id === 'CL' && A.PERM.canScreen(ui.role, 'diem-kd'));
  }
  // Ảnh từ market.image (Danh mục chợ); placeholder luôn nằm dưới, ảnh lỗi tự gỡ để lộ placeholder.
  function thumbHtml(m) {
    const img = m.image && m.image.dataUrl ? `<img src="${U.esc(m.image.dataUrl)}" alt="Ảnh ${U.esc(m.name)}" loading="lazy" onerror="this.remove()">` : '';
    return `<div class="tq-thumb"><div class="tq-thumb-empty">${U.icon('store')}<span>Chưa có ảnh</span></div>${img}</div>`;
  }
  // Vòng đời dùng chung (lifecycle.service.marketLifecycle) — cùng kết quả với Danh mục chợ.
  function lifecycleHint(c) {
    const lc = c.lifecycle;
    if (!lc || !lc.hint) return '';
    const warning = lc.feeConfigWarning ? '<div class="small dmc-warn">Cần cập nhật mức thu/biểu phí</div>' : '';
    return `<div class="small muted">Bước hiện tại: ${U.esc(lc.hint)}</div>${warning}`;
  }
  function cardHtml(c) {
    const m = c.market, st = MC().STATUS[m.status] || MC().STATUS.NOT_ACTIVE, open = canOpenLayout(m.id);
    const attrs = open ? ` data-act="tq-open-market" data-id="${U.esc(m.id)}" title="Xem mặt bằng ${U.esc(m.name)}"` : '';
    return `<article class="card tq-market${open ? ' is-link' : ''}"${attrs}>
      ${thumbHtml(m)}
      <div class="tq-market-b">
        <div class="tq-market-title"><b>${U.esc(m.name)}</b><span>${U.esc(m.code)}${MC().RANKS[m.rank] ? ' · ' + MC().RANKS[m.rank] : ''}</span></div>
        <div class="tq-market-tags"><span class="tag ${st[1]}">${st[0]}</span></div>${lifecycleHint(c)}
        <dl class="tq-metrics">
          <div><dt>Điểm KD</dt><dd>${fmtNum(c.points.total)}</dd></div>
          <div><dt>Tiểu thương</dt><dd>${fmtNum(c.traders)}</dd></div>
          <div><dt>Lấp đầy</dt><dd>${U.pctTxt(c.occPct)}</dd></div>
        </dl>
        <div class="bar-mini" title="${fmtNum(c.points.occupied)} đang thuê / ${fmtNum(c.points.total)} điểm"><i style="width:${Math.min(100, c.occPct)}%"></i></div>
        ${open ? `<button class="btn sm tq-open" data-act="tq-open-market" data-id="${U.esc(m.id)}">${U.icon('map')}Xem mặt bằng</button>` : ''}
      </div>
    </article>`;
  }
  function marketsHtml(s) {
    const f = filterState(), list = visibleCards(s.cards);
    return `<section class="card tq-markets"><div class="card-h"><h3>Danh sách các chợ</h3><span class="small muted">${fmtNum(list.length)}/${fmtNum(s.cards.length)} chợ</span></div>
      <div class="card-b">
        <div class="filters tq-filters">
          <input class="input tq-search" data-in="tq-search" value="${U.esc(f.search)}" placeholder="Tìm theo tên chợ, mã chợ..." aria-label="Tìm chợ">
          <select class="input" data-ch="tq-status" aria-label="Trạng thái chợ"><option value="">Trạng thái: Tất cả</option>${Object.keys(MC().STATUS).map(k => `<option value="${k}" ${f.status === k ? 'selected' : ''}>${MC().STATUS[k][0]}</option>`).join('')}</select>
          <select class="input" data-ch="tq-rank" aria-label="Hạng chợ"><option value="">Hạng chợ: Tất cả</option>${Object.keys(MC().RANKS).map(k => `<option value="${k}" ${f.rank === k ? 'selected' : ''}>${MC().RANKS[k]}</option>`).join('')}</select>
          <select class="input" data-ch="tq-sort" aria-label="Sắp xếp">${Object.keys(SORTS).map(k => `<option value="${k}" ${f.sort === k ? 'selected' : ''}>${SORTS[k][0]}</option>`).join('')}</select>
        </div>
        ${list.length ? `<div class="tq-grid">${list.map(cardHtml).join('')}</div>` : '<div class="empty">Không tìm thấy chợ phù hợp.</div>'}
      </div></section>`;
  }

  // ---------- Cảnh báo (trong phạm vi, không có Nợ phí/Công nợ) ----------
  function alertsHtml(s) {
    const db = A.db, scope = new Set(s.ids), inScope = x => !!x && scope.has(x.market), today = U.today();
    const alerts = [];
    const exp = (db.contracts || []).filter(c => inScope(c) && c.status === 'ACTIVE' && c.end && U.days(today, c.end) >= 0 && U.days(today, c.end) <= 30).length;
    const incLate = (db.incidents || []).filter(i => inScope(i) && i.state !== 'hoanthanh' && i.state !== 'dong' && i.deadline && i.deadline < today).length;
    // Kỳ chỉ số mới nhất có trong dữ liệu (không cố định 1 kỳ).
    const period = (db.readings || []).reduce((p, r) => r.period > p ? r.period : p, '');
    const abn = (db.readings || []).filter(r => r.period === period && inScope(A.idx.stall.get(r.stallId)) && r.elecCur != null && (r.elecCur - r.elecPrev) > r.elecAvg * 1.5).length;
    const unmatched = (db.bank || []).filter(b => inScope(b) && !b.matched).length;
    if (exp) alerts.push(['warn', `${fmtNum(exp)} hợp đồng hết hạn trong 30 ngày tới`, 'hop-dong']);
    if (incLate) alerts.push(['danger', `${fmtNum(incLate)} phản ánh, sự cố quá thời hạn xử lý`, 'su-co']);
    if (abn) alerts.push(['warn', `${fmtNum(abn)} chỉ số điện tăng bất thường so với trung bình`, 'dien-nuoc']);
    if (unmatched) alerts.push(['warn', `${fmtNum(unmatched)} giao dịch chuyển khoản chưa khớp khoản thu`, 'theo-doi-ky-doi-soat']);
    const escal = (db.incidents || []).filter(i => inScope(i) && i.escalated && i.state !== 'dong');
    return `<section class="card tq-alerts"><div class="card-h"><h3>Cảnh báo cần xử lý</h3></div><div class="card-b">
      ${alerts.length ? alerts.map(a => `<div class="tq-alert"><span class="tag ${a[0]}">${a[0] === 'danger' ? 'Khẩn' : 'Lưu ý'}</span><span>${a[1]}</span>${U.can(a[2]) ? `<button class="btn sm" data-act="go" data-to="${a[2]}">Xem</button>` : ''}</div>`).join('') : '<div class="empty">Không có cảnh báo</div>'}
      ${escal.length ? `<h4 class="tq-sub">Phản ánh chuyển vượt cấp lên UBND phường</h4>${escal.map(i => `<div class="tq-alert small"><span class="tag purple">${U.esc(i.id)}</span><span>${U.esc(i.title)} · ${U.esc(U.mShort(i.market))}</span><button class="btn sm" data-act="inc-open" data-id="${U.esc(i.id)}">Mở</button></div>`).join('')}` : ''}
    </div></section>`;
  }

  A.VIEWS['tong-quan'] = function () {
    const s = buildStats();
    return `<div class="tq-page">${headerHtml(s)}${kpisHtml(s)}${chartsHtml(s)}${marketsHtml(s)}${alertsHtml(s)}</div>`;
  };

  A.IN['tq-search'] = el => { filterState().search = el.value; A.render(); };
  A.CH['tq-status'] = el => { filterState().status = el.value; A.render(); };
  A.CH['tq-rank'] = el => { filterState().rank = el.value; A.render(); };
  A.CH['tq-sort'] = el => { filterState().sort = SORTS[el.value] ? el.value : 'name-asc'; A.render(); };
  // Chọn chợ → selectedMarket (ui.market) theo cơ chế hiện có → #/mat-bang. U.can kiểm tra lại quyền màn +
  // phạm vi chợ với ui.market mới; không hợp lệ thì khôi phục chợ đang chọn trước đó.
  A.ACT['tq-open-market'] = el => {
    const id = el.dataset.id;
    if (!id || !MC().get(id) || !canOpenLayout(id)) return;
    const prev = ui.market;
    ui.market = id;
    if (!U.can('mat-bang')) { ui.market = prev; U.toast('Bạn không có quyền xem mặt bằng của chợ này.'); return; }
    if (ui.mb) { ui.mb.sel = null; ui.mb.mode = 'overview'; ui.mb.pointId = null; ui.mb.inspectorOpen = false; }
    ui.page = {}; ui.sel = null; A.saveUi();
    A.go('mat-bang');
  };
})(window.APP);

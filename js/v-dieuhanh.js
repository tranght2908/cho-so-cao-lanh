

/* Màn hình điều hành: Tổng quan liên chợ, Sơ đồ mặt bằng, Phiên chợ quê. */
(function (A) {
  'use strict';
  const D = A.D, U = A.U, ui = A.ui;
  const TTD_SESSION_MARKET = 'TTD';
  const TTD_DEMO_SESSION_DATE = '2026-09-12';
  const SESSION_STATUS = {
    draft: 'Nháp',
    open: 'Mở đăng ký',
    registration_closed: 'Đã chốt danh sách',
    preparing: 'Đang chuẩn bị',
    live: 'Đang diễn ra',
    pending_close: 'Chờ chốt',
    closed: 'Đã chốt',
    postponed: 'Tạm hoãn',
    cancelled: 'Đã hủy'
  };
  const SESSION_TRANSITIONS = {
    draft: { open: 'phien-cho.mo-dang-ky', cancelled: 'phien-cho.huy-phien' },
    open: { registration_closed: 'phien-cho.chot-danh-sach', postponed: 'phien-cho.hoan-phien', cancelled: 'phien-cho.huy-phien' },
    registration_closed: { preparing: 'phien-cho.bat-dau-chuan-bi', postponed: 'phien-cho.hoan-phien', cancelled: 'phien-cho.huy-phien' },
    preparing: { live: 'phien-cho.bat-dau-phien', postponed: 'phien-cho.hoan-phien', cancelled: 'phien-cho.huy-phien' },
    live: { pending_close: 'phien-cho.cho-chot' },
    pending_close: { closed: 'phien-cho.chot-phien' },
    postponed: { open: 'phien-cho.mo-dang-ky', cancelled: 'phien-cho.huy-phien' }
  };
  const SESSION_ACTION_LABEL = {
    open: 'Mở đăng ký',
    registration_closed: 'Chốt danh sách',
    preparing: 'Bắt đầu chuẩn bị',
    live: 'Bắt đầu phiên',
    pending_close: 'Chuyển chờ chốt',
    postponed: 'Tạm hoãn',
    cancelled: 'Hủy phiên'
  };

  function nowIso() { return new Date().toISOString(); }
  function currentAccountId() { const a = A.currentAccount && A.currentAccount(); return a ? a.id : null; }
  function currentAccountName() { const a = A.currentAccount && A.currentAccount(); return a ? a.fullName : 'Không rõ'; }
  function sessionIdForDate(date) { return 'PC-TTD-' + String(date || '').replace(/-/g, ''); }
  function sessionLabel(s) { return U.dmy(s && s.date); }
  function sessionShortLabel(s) { return sessionLabel(s).slice(0, 5); }
  function hasClosingMetrics(s) {
    return !!(s && (s.booths != null || s.fee != null || s.visitors != null || s.revenue != null || s.noncash != null));
  }
  function sessionReadModel(s) {
    if (!s || !s.date) return null;
    const status = s.status || (hasClosingMetrics(s) ? 'closed' : 'draft');
    return Object.assign({}, s, {
      id: s.id || sessionIdForDate(s.date),
      market: s.market || TTD_SESSION_MARKET,
      status
    });
  }
  function ttdSessionReadModels() {
    return A.db.sessions.map(sessionReadModel).filter(s => s && s.market === TTD_SESSION_MARKET);
  }
  function formatNumber(value) {
    const n = Number(value);
    return Number.isFinite(n) ? n.toLocaleString('vi-VN') : '—';
  }
  function formatMoney(value) {
    const n = Number(value);
    return Number.isFinite(n) ? U.money(n) : '—';
  }
  function formatMoneyShort(value) {
    const n = Number(value);
    return Number.isFinite(n) ? U.moneyShort(n) : '—';
  }
  function formatPct(value) {
    const n = Number(value);
    return Number.isFinite(n) ? U.pctTxt(n * 100) : '—';
  }
  function formatTimeRange(s) {
    return s && s.startTime && s.endTime ? U.esc(s.startTime) + '–' + U.esc(s.endTime) : '—';
  }
  function formatDeadline(s) {
    if (!s || !s.registrationDeadline) return '—';
    const raw = String(s.registrationDeadline);
    return U.dmy(raw.slice(0, 10)) + (raw.length >= 16 ? ' ' + raw.slice(11, 16) : '');
  }
  function normalizeSession(s) {
    if (!s || !s.date) return s;
    if (!s.id) s.id = sessionIdForDate(s.date);
    if (!s.market) s.market = TTD_SESSION_MARKET;
    if (!s.status) s.status = (s.booths != null || s.fee != null || s.visitors != null || s.revenue != null || s.noncash != null) ? 'closed' : 'draft';
    if (!s.startTime) s.startTime = '14:00';
    if (!s.endTime) s.endTime = '20:00';
    if (!s.registrationDeadline) s.registrationDeadline = registrationDeadlineForDate(s.date);
    return s;
  }
  function ensureTtdSessions() { A.db.sessions.forEach(normalizeSession); }
  function sessionById(id) {
    return A.db.sessions.find(s => s && (s.id === id || (!s.id && s.date && sessionIdForDate(s.date) === id)));
  }
  function activeTtdSession() {
    const live = ttdSessionReadModels().filter(s => s.status !== 'closed' && s.status !== 'cancelled')
      .sort((a, b) => a.date.localeCompare(b.date));
    return live[0] || null;
  }
  function hasSessionDate(date, excludeId) {
    return A.db.sessions.some(s => s && s.date === date && s.id !== excludeId);
  }
  function registrationDeadlineForDate(date) {
    const d = parseIsoDate(date);
    if (!d) return '';
    d.setDate(d.getDate() - 2);
    return dateOnly(d) + 'T17:00';
  }
  function dateOnly(d) {
    return d.getFullYear() + '-' + U.pad(d.getMonth() + 1) + '-' + U.pad(d.getDate());
  }
  function parseIsoDate(s) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(s || ''))) return null;
    const d = new Date(s + 'T00:00:00');
    return Number.isNaN(d.getTime()) || dateOnly(d) !== s ? null : d;
  }
  function parseLocalDateTime(s) {
    const d = new Date(String(s || ''));
    return Number.isNaN(d.getTime()) ? null : d;
  }
  function sessionStartDateTime(date, time) {
    const d = parseLocalDateTime(date + 'T' + time);
    return d;
  }
  function canTransition(from, to) {
    return !!(SESSION_TRANSITIONS[from] && SESSION_TRANSITIONS[from][to]);
  }
  function actionForTransition(from, to) {
    return canTransition(from, to) ? SESSION_TRANSITIONS[from][to] : null;
  }
  function canDoSessionAction(actionKey, session) {
    if (!session || session.market !== TTD_SESSION_MARKET || ui.market !== TTD_SESSION_MARKET) return false;
    return A.canDo(actionKey, session.market);
  }
  function ttdBusinessPoints() {
    if (typeof A.mbBusinessPointsForMarket !== 'function') return null;
    const points = A.mbBusinessPointsForMarket(TTD_SESSION_MARKET);
    if (!Array.isArray(points) || points.some(st => !st || st.market !== TTD_SESSION_MARKET)) return null;
    return points;
  }
  function ttdSessionEligiblePoints() {
    const points = ttdBusinessPoints();
    return points ? points.filter(st => st.traderId) : null;
  }
  function ttdSessionCanMutate(actionKey, session, showToast) {
    if (ui.market !== TTD_SESSION_MARKET) { if (showToast) U.toast('Phiên chợ quê chỉ áp dụng cho Chợ quê Tân Thuận Đông'); return false; }
    if (!U.can('phien-cho')) { if (showToast) U.toast('Màn Phiên chợ quê không hợp lệ trong ngữ cảnh hiện tại'); return false; }
    if (!session || session.market !== TTD_SESSION_MARKET) { if (showToast) U.toast('Không tìm thấy phiên TTD hợp lệ'); return false; }
    if (!A.canDo(actionKey, session.market)) { if (showToast) U.toast('Bạn không có quyền thao tác phiên này'); return false; }
    return true;
  }
  function applySessionMutation(session, mutate, successLog) {
    const before = JSON.stringify(session);
    const logLen = Array.isArray(A.db.extraLog) ? A.db.extraLog.length : null;
    mutate();
    try {
      if (successLog) U.log(successLog);
      A.save();
    } catch (e) {
      Object.keys(session).forEach(k => delete session[k]);
      Object.assign(session, JSON.parse(before));
      if (logLen != null) A.db.extraLog.length = logLen;
      U.toast('Không lưu được phiên chợ quê, dữ liệu đã được hoàn tác');
      return false;
    }
    return true;
  }
  function readNonNegativeNumber(selector, scale) {
    const v = Number(A.$(selector).value);
    if (!Number.isFinite(v) || v < 0) return null;
    return v * (scale || 1);
  }

  function marketStats(mid) {
    const db = A.db, f = x => mid === 'ALL' || x.market === mid;
    const stalls = db.stalls.filter(f);
    const occ = stalls.filter(s => s.status !== 'trong').length;
    const traders = db.traders.filter(f);
    const inv = db.invoices.filter(i => f(i) && i.period === '2026-09');
    const pays = db.payments.filter(p => f(p) && p.date.startsWith('2026-09'));
    const payAug = db.payments.filter(p => f(p) && p.date.startsWith('2026-08'));
    const over = db.invoices.filter(i => f(i) && U.isOver(i));
    const inc = db.incidents.filter(i => f(i) && i.state !== 'hoanthanh' && i.state !== 'dong');
    return {
      stalls: stalls.length, occ, occPct: U.pct(occ, stalls.length), traders: traders.length,
      due: U.sum(inv, i => i.amount), paid: U.sum(inv, i => i.paid),
      noncash: U.pct(U.sum(pays.filter(p => p.method !== 'tm'), p => p.amount), U.sum(pays, p => p.amount)),
      noncashAug: U.pct(U.sum(payAug.filter(p => p.method !== 'tm'), p => p.amount), U.sum(payAug, p => p.amount)),
      over: U.sum(over, U.due), overTraders: new Set(over.map(i => i.traderId)).size,
      inc: inc.length, incLate: inc.filter(i => i.deadline < U.today()).length,
      expiring: db.contracts.filter(c => f(c) && c.status === 'hieuluc' && U.days(U.today(), c.end) <= 30).length,
      app: U.pct(traders.filter(t => t.app).length, traders.length)
    };
  }
  A.marketStats = marketStats;

  // xmMkt: kết quả A.xmMarket() — 'CL'/'TTD' cụ thể HOẶC 'ALL' (gộp trong phạm vi account,
  // xem core.js). Đây là màn cross-market nên dùng xmMkt thay vì selectedMarket (ui.market) toàn
  // cục cho mọi phép lọc theo chợ trong hàm này.
  function revenueSeries(xmMkt) {
    const db = A.db, incCL = xmMkt !== 'TTD', incT = xmMkt !== 'CL';
    const labels = [], cash = [], non = [];
    const ttdBase = 33 * D.SESSION_FEE * 4.3;
    db.months.forEach(m => {
      const share = m.noncash / (m.cash + m.noncash);
      labels.push(m.period.slice(5) + '/' + m.period.slice(2, 4));
      cash.push((incCL ? m.cash : 0) + (incT ? ttdBase * (1 - share) : 0));
      non.push((incCL ? m.noncash : 0) + (incT ? ttdBase * share : 0));
    });
    db.issuedPeriods.filter(p => p <= '2026-09').forEach(p => {
      const ps = db.payments.filter(x => U.inScope(x, xmMkt) && A.idx.invoice.get(x.invoiceId).period === p);
      labels.push(p.slice(5) + '/' + p.slice(2, 4) + (p === '2026-09' ? '*' : ''));
      cash.push(U.sum(ps.filter(x => x.method === 'tm'), x => x.amount));
      non.push(U.sum(ps.filter(x => x.method !== 'tm'), x => x.amount));
    });
    return { labels, cash, non };
  }

  A.VIEWS['tong-quan'] = function () {
    // Tổng quan liên chợ = màn cross-market (A.SCREEN_MARKET['tong-quan'] === 'CROSS') — không bị
    // chặn bởi selectedMarket, dùng bộ lọc nội bộ riêng A.xmMarket()/A.xmScopeBar() (mục 9 Phase 2).
    const xmMkt = A.xmMarket();
    const s = marketStats(xmMkt), db = A.db;
    const kpi = (label, value, sub, cls, bar) => `<div class="card kpi"><div class="k-label">${label}</div><div class="k-value">${value}</div>
      ${sub ? `<div class="k-sub ${cls || ''}">${sub}</div>` : ''}${bar != null ? `<div class="bar-mini"><i style="width:${Math.min(100, bar)}%"></i></div>` : ''}</div>`;
    const rs = revenueSeries(xmMkt);
    const counts = Object.keys(D.STATUS).map(k => ({ label: D.STATUS[k].label, value: db.stalls.filter(x => U.inScope(x, xmMkt) && x.status === k).length, color: D.STATUS[k].color }));
    const alerts = [];
    const exp = db.contracts.filter(c => U.inScope(c, xmMkt) && c.status === 'hieuluc' && U.days(U.today(), c.end) <= 30).length;
    const over60 = new Set(db.invoices.filter(i => U.inScope(i, xmMkt) && U.isOver(i) && U.overDays(i) > 60).map(i => i.traderId)).size;
    const abn = db.readings.filter(r => r.period === '2026-09' && U.inScope(A.idx.stall.get(r.stallId), xmMkt) && r.elecCur != null && (r.elecCur - r.elecPrev) > r.elecAvg * 1.5).length;
    const unmatched = db.bank.filter(b => !b.matched).length;
    if (exp) alerts.push(['warn', `${exp} hợp đồng hết hạn trong 30 ngày tới`, 'hop-dong']);
    if (over60) alerts.push(['danger', `${over60} tiểu thương nợ phí quá hạn trên 60 ngày`, 'cong-no']);
    if (s.incLate) alerts.push(['danger', `${s.incLate} phản ánh, sự cố quá thời hạn xử lý`, 'su-co']);
    if (abn) alerts.push(['warn', `${abn} chỉ số điện tăng bất thường so với trung bình`, 'dien-nuoc']);
    if (unmatched) alerts.push(['warn', `${unmatched} giao dịch chuyển khoản chưa khớp khoản thu`, 'doi-soat']);
    const escal = db.incidents.filter(i => U.inScope(i, xmMkt) && i.escalated && i.state !== 'dong');

    const cmp = ['CL', 'TTD'].map(id => [id, marketStats(id)]);
    const cmpRow = (label, f) => `<tr><td>${label}</td>${cmp.map(c => `<td class="num">${f(c[1])}</td>`).join('')}</tr>`;
    const xmBar = A.xmScopeBar();

    return `
    ${xmBar ? `<div class="card"><div class="card-b row" style="padding-top:14px"><span class="label-sm">Phạm vi xem</span>${xmBar}</div></div>` : ''}
    <div class="kpis">
      ${kpi('Điểm kinh doanh', s.stalls, `Lấp đầy ${U.pctTxt(s.occPct)}`, '', s.occPct)}
      ${kpi('Tiểu thương đang kinh doanh', s.traders, `${U.pctTxt(s.app)} đã dùng mini app`, '', s.app)}
      ${kpi('Đã thu kỳ 09/2026', U.moneyShort(s.paid), `/ ${U.moneyShort(s.due)} phải thu (${U.pctTxt(U.pct(s.paid, s.due))})`, '', U.pct(s.paid, s.due))}
      ${kpi('Thanh toán không tiền mặt', U.pctTxt(s.noncash), `Kỳ 08/2026: ${U.pctTxt(s.noncashAug)}`, s.noncash >= s.noncashAug ? 'up' : 'down', s.noncash)}
      ${kpi('Nợ phí quá hạn', U.moneyShort(s.over), `${s.overTraders} tiểu thương`, 'down')}
      ${kpi('Phản ánh đang xử lý', s.inc, `${s.incLate} quá hạn xử lý`, s.incLate ? 'down' : 'up')}
      ${kpi('Hợp đồng sắp hết hạn', s.expiring, 'Trong 30 ngày tới', s.expiring ? 'down' : '')}
      ${kpi('Cập nhật', U.dmy(U.today()), 'Số liệu theo thời gian thực')}
    </div>
    <div class="grid g-main">
      <div class="card"><div class="card-h"><h3>Số thu theo tháng</h3><span class="small muted">* kỳ 09/2026 tính đến ngày ${U.dmy(U.today())} · trước 05/2026 là số mô phỏng</span></div>
        <div class="card-b">${U.bars(rs.labels, [{ name: 'Tiền mặt', values: rs.cash, color: '#c9a45c' }, { name: 'QR / chuyển khoản', values: rs.non, color: '#13806b' }])}</div></div>
      <div class="card"><div class="card-h"><h3>Trạng thái điểm kinh doanh</h3></div>
        <div class="card-b">${U.donut(counts, [U.pctTxt(s.occPct), 'lấp đầy'])}</div></div>
    </div>
    <div class="grid g2">
      <div class="card"><div class="card-h"><h3>So sánh giữa các chợ</h3></div><div class="card-b">
        <div class="tbl-wrap"><table class="tbl"><thead><tr><th>Chỉ tiêu</th><th class="num">Chợ Cao Lãnh</th><th class="num">Chợ quê TTĐ</th></tr></thead><tbody>
        ${cmpRow('Điểm kinh doanh / quầy', x => x.stalls)}
        ${cmpRow('Tỷ lệ lấp đầy', x => U.pctTxt(x.occPct))}
        ${cmpRow('Tiểu thương', x => x.traders)}
        ${cmpRow('Phải thu kỳ 09/2026', x => U.money(x.due))}
        ${cmpRow('Đã thu', x => U.money(x.paid))}
        ${cmpRow('Tỷ lệ thu', x => U.pctTxt(U.pct(x.paid, x.due)))}
        ${cmpRow('Không tiền mặt (kỳ 09)', x => U.pctTxt(x.noncash))}
        ${cmpRow('Nợ quá hạn', x => U.money(x.over))}
        ${cmpRow('Phản ánh đang xử lý', x => x.inc)}
        ${cmpRow('Cài đặt mini app', x => U.pctTxt(x.app))}
        </tbody></table></div></div></div>
      <div class="card"><div class="card-h"><h3>Cảnh báo cần xử lý</h3></div><div class="card-b">
        ${alerts.length ? alerts.map(a => `<div class="row" style="padding:8px 0;border-bottom:1px solid #eef2f0"><span class="tag ${a[0]}">${a[0] === 'danger' ? 'Khẩn' : 'Lưu ý'}</span><span style="flex:1">${a[1]}</span>${U.can(a[2]) ? `<button class="btn sm" data-act="go" data-to="${a[2]}">Xem</button>` : ''}</div>`).join('') : '<div class="empty">Không có cảnh báo</div>'}
        <h4 style="margin:16px 0 6px;font-size:var(--font-size-sm)">Phản ánh chuyển vượt cấp lên UBND phường</h4>
        ${escal.length ? escal.map(i => `<div class="row small" style="padding:6px 0"><span class="tag purple">${i.id}</span><span style="flex:1">${U.esc(i.title)} · ${U.mShort(i.market)}</span><button class="btn sm" data-act="inc-open" data-id="${i.id}">Mở</button></div>`).join('') : '<div class="small muted">Không có</div>'}
      </div></div>
    </div>`;
  };

  // ---------- Mặt bằng chợ (gộp UI "Thiết lập mặt bằng chợ" + "Sơ đồ mặt bằng") ----------
  // Sau hotfix UX (xem MARKET_LAYOUT_UX_HOTFIX_REPORT.md): KHÔNG còn "edit mode" như 1 route/trang
  // riêng nữa — action thêm/sửa/xóa cấu trúc hiện NGAY trên cây, permission cho phép tới đâu thì
  // action tự hiện tới đó (không cần bấm "Thiết lập mặt bằng" trước). Toàn bộ cây + action cấu
  // trúc chuyển hẳn sang js/v-cautruc.js (nơi giữ model LAYOUT + 26 handler qh-* — KHÔNG đổi logic
  // 1 dòng nào). File này chỉ còn giữ đúng phần liên quan tới điểm kinh doanh THẬT
  // (D.MARKETS/A.db.stalls): A.stallPanel (drawer điểm KD, không đổi) + 2 hàm dùng chung
  // A.mbOverviewHtml/A.mbZoneDiagramHtml render vùng sơ đồ bên phải — js/v-cautruc.js gọi 2 hàm
  // này, truyền vào (các) khu LAYOUT hiện có; 2 hàm tự đối chiếu với dữ liệu thật qua
  // `zone.code === section.id` (đúng cách defaultLayout() đã seed — xem js/v-cautruc.js) để hiển
  // thị đúng trạng thái thực tế cho khu đã triển khai, hoặc thông tin quy hoạch cho khu chưa khớp
  // dữ liệu thật. Không tạo model/permission mặt bằng thứ hai, không đổi
  // 'screen:mat-bang' (Phase 7 — screen permission duy nhất, thay 'screen:so-do'/'screen:cau-truc'
  // cũ)/so-do.*/cau-truc.* (6 action permKey GIỮ NGUYÊN, không đổi ở Phase 7).
  function mbMatchRealSection(mid, code) {
    const m = U.market(mid);
    for (const f of m.floors) { const s = f.sections.find(x => x.id === code); if (s) return { floor: f, section: s }; }
    return null;
  }
  A.mbResolveZoneContext = function (mid, zone) {
    const market = U.market(mid);
    if (!market) return { market: mid, floor: null, section: null, matched: false, reason: 'market-not-found' };
    if (!zone) return { market: mid, floor: null, section: null, matched: false, reason: 'zone-not-found' };
    if (!zone.code) return { market: mid, floor: null, section: null, matched: false, reason: 'zone-code-empty' };
    const matched = mbMatchRealSection(mid, zone.code);
    if (!matched) return { market: mid, floor: null, section: null, matched: false, reason: 'section-not-found' };
    return { market: mid, floor: matched.floor, section: matched.section, matched: true, reason: 'matched-zone-code' };
  };
  A.mbBusinessPointsForZone = function (mid, zone) {
    const resolved = A.mbResolveZoneContext(mid, zone);
    if (!resolved.matched) return [];
    return A.db.stalls.filter(st => st.market === mid && st.floor === resolved.floor.id && st.section === resolved.section.id);
  };
  A.mbBusinessPointById = function (mid, pointId) {
    const st = A.idx && A.idx.stall ? A.idx.stall.get(pointId) : null;
    return st && st.market === mid ? st : null;
  };
  A.mbBusinessPointsForMarket = function (mid) {
    if (!U.market(mid)) return [];
    return A.db.stalls.filter(st => st.market === mid);
  };
  A.mbMarketStats = function (mid) {
    const points = A.mbBusinessPointsForMarket(mid);
    const byStatus = {};
    Object.keys(D.STATUS).forEach(k => { byStatus[k] = points.filter(st => st.status === k).length; });
    return { total: points.length, byStatus: byStatus, points: points };
  };
  A.mbZoneStats = function (mid, zone) {
    const points = A.mbBusinessPointsForZone(mid, zone);
    const byStatus = {};
    Object.keys(D.STATUS).forEach(k => { byStatus[k] = points.filter(st => st.status === k).length; });
    return { total: points.length, byStatus: byStatus, points: points };
  };
  A.mbOverviewHtml = function (mid, zones) {
    const cards = zones.map(z => {
      const resolved = A.mbResolveZoneContext(mid, z);
      let body;
      if (resolved.matched) {
        const stats = A.mbZoneStats(mid, z);
        const c = k => stats.byStatus[k] || 0;
        const parts = Object.keys(D.STATUS).filter(k => c(k)).map(k => `${c(k)} ${D.STATUS[k].label.toLowerCase()}`).join(' · ');
        body = `<div style="margin-top:8px">${stats.total} điểm</div><div class="small muted">${parts || 'Chưa có điểm kinh doanh'}</div>`;
      } else {
        const planned = U.sum(z.planned, p => Number(p.qty) || 0);
        body = `<div style="margin-top:8px">${planned} điểm dự kiến</div><div class="small muted">Khu đang quy hoạch — chưa có dữ liệu thực tế</div>`;
      }
      return `<div class="card mb-ov-card" data-act="mb-sel-zone" data-id="${z.key}"><div class="card-b" style="padding-top:14px">
        <b>${U.esc(z.name || '(chưa đặt tên)')}</b><div class="small muted" style="margin-top:2px">${U.esc(z.code || '')}${z.status === 'nhap' ? ' · <span class="tag warn">Nháp</span>' : ''}</div>
        ${body}</div></div>`;
    });
    return `<div class="grid" style="grid-template-columns:repeat(auto-fill,minmax(200px,1fr))">${cards.join('') || '<div class="empty">Chưa có khu vực nào.</div>'}</div>`;
  };
  A.mbZoneDiagramHtml = function (mid, z, canEditZone) {
    const resolved = A.mbResolveZoneContext(mid, z);
    const editBtn = canEditZone ? `<button class="btn sm" data-act="qh-zone-edit-open" data-id="${z.key}">✎ Sửa thông tin khu</button>` : '';
    if (!resolved.matched) {
      const totalQty = U.sum(z.planned, p => Number(p.qty) || 0), totalArea = U.sum(z.planned, p => (Number(p.std) || 0) * (Number(p.qty) || 0));
      return `<div class="card"><div class="card-h"><h3>${U.esc(z.name || '(chưa đặt tên)')}</h3><span class="small muted">${U.esc(z.code || '')} · quy hoạch</span><span class="spacer"></span>${editBtn}</div>
        <div class="card-b"><div class="note info">Khu này đang ở giai đoạn quy hoạch, chưa có điểm kinh doanh thực tế tương ứng (mã "${U.esc(z.code || '')}" chưa khớp khu vực nào trong sơ đồ thật).</div>
        <div class="row" style="margin-top:10px"><span>Số điểm dự kiến</span><span class="spacer"></span><b>${totalQty.toLocaleString('vi-VN')}</b></div>
        <div class="row"><span>Diện tích dự kiến</span><span class="spacer"></span><b>${totalArea.toLocaleString('vi-VN')} m²</b></div></div></div>`;
    }
    const f = resolved.floor, sec = resolved.section;
    const stalls = A.mbBusinessPointsForZone(mid, z);
    const legend = Object.keys(D.STATUS).map(k => `<button class="${ui.hidden[k] ? 'off' : ''}" data-act="legend" data-s="${k}"><span class="sw" style="background:${D.STATUS[k].color}"></span>${D.STATUS[k].label} <b>${stalls.filter(st => st.status === k).length}</b></button>`).join('');
    const rows = sec.rows.map(r => {
      const cells = stalls.filter(st => st.row === r);
      return `<div class="plan-row"><span class="rl">${r}</span><div class="cells" style="--n:${sec.per}">${cells.map(st => {
        const t = st.traderId ? A.idx.trader.get(st.traderId) : null;
        return `<button class="cell s-${st.status} ${sec.type === 'kiot' ? 'kiot' : ''} ${stallMatch(st) ? '' : 'dim'} ${ui.sel === st.id ? 'sel' : ''}" data-act="stall" data-id="${st.id}" title="${st.code} · ${D.STATUS[st.status].label}${t ? ' · ' + U.esc(t.name) : ''}">${st.num}</button>`;
      }).join('')}</div></div>`;
    }).join('<div class="aisle"></div>');
    return `<div class="card"><div class="card-h">
        <h3>${U.esc(sec.name)}</h3><span class="small muted">${stalls.length} điểm · ${U.esc(sec.cat)} · ${f.name}</span>
        <span class="spacer"></span>${editBtn}<input class="input" style="width:220px" placeholder="Tìm mã điểm hoặc tên tiểu thương" data-in="plan-search" value="${U.esc(ui.planSearch)}"></div>
      <div class="card-b"><div class="legend" style="margin-bottom:10px">${legend}</div><div class="plan">${rows}</div></div></div>`;
  };
  function stallMatch(st) {
    const q = ui.planSearch.trim().toLowerCase();
    if (ui.hidden[st.status]) return false;
    if (!q) return true;
    const t = st.traderId ? A.idx.trader.get(st.traderId) : null;
    return st.code.toLowerCase().includes(q) || (t && t.name.toLowerCase().includes(q));
  }
  A.stallPanel = function (st) {
    const t = st.traderId ? A.idx.trader.get(st.traderId) : null;
    const c = st.contractId ? A.idx.contract.get(st.contractId) : null;
    const unpaid = A.db.invoices.filter(i => i.stallId === st.id && i.status !== 'paid');
    const canThuTien = A.canDo('thu-tien.thu', st.market);
    const canXemHoSo = A.canDo('so-do.xem-ho-so', st.market);
    const canTaoHopDong = A.canDo('so-do.tao-hop-dong', st.market) || A.canDo('hop-dong.tao', st.market);
    const canDoiTrangThai = A.canDo('so-do.doi-trang-thai', st.market);
    const left = c ? U.days(U.today(), c.end) : null;
    return `<div class="row"><h3>${st.code}</h3>${U.statusTag(st.status)}</div>
      <div class="muted small" style="margin:2px 0 12px">${U.esc(st.sectionName)} · ${U.market(st.market).floors.find(f => f.id === st.floor).name} · ${U.mShort(st.market)}</div>
      <dl class="kv"><dt>Ngành hàng</dt><dd>${U.esc(st.cat)}</dd><dt>Loại</dt><dd>${U.typeLabel(st.type)}</dd>
        <dt>Diện tích</dt><dd>${st.area.toLocaleString('vi-VN')} m²</dd><dt>Đơn giá</dt><dd>${U.unitLabel(st)}</dd>
        ${c && c.monthly ? `<dt>Giá dịch vụ/tháng</dt><dd>${U.money(c.monthly)}</dd>` : ''}</dl>
      <div class="divider"></div>
      ${t ? `<dl class="kv"><dt>Tiểu thương</dt><dd><a href="#" data-act="trader" data-id="${t.id}">${U.esc(t.name)}</a> (${t.id})</dd>
        <dt>Điện thoại</dt><dd>${U.maskPhone(t.phone)}</dd><dt>Mini app</dt><dd>${t.app ? '<span class="tag ok">Đã cài</span>' : '<span class="tag">Chưa cài</span>'}</dd>
        ${c ? `<dt>Hợp đồng</dt><dd>${c.id}<br><span class="small muted">${U.dmy(c.start)} – ${U.dmy(c.end)} · ${left <= 30 ? `<b style="color:#d6453b">còn ${left} ngày</b>` : 'còn ' + left + ' ngày'}</span></dd>` : ''}
        <dt>Công nợ</dt><dd>${unpaid.length ? `<b style="color:#d6453b">${U.money(U.sum(unpaid, U.due))}</b> <span class="small muted">(${unpaid.length} kỳ)</span>` : '<span class="tag ok">Không nợ</span>'}</dd></dl>`
        : '<div class="note info">Điểm kinh doanh đang trống, có thể cho thuê.</div>'}
      ${(canThuTien || canXemHoSo || canTaoHopDong || canDoiTrangThai) ? `<div class="row" style="margin-top:14px">
        ${canThuTien && t && unpaid.length ? `<button class="btn primary" data-act="pay-open" data-id="${t.id}">💳 Thu tiền</button>` : ''}
        ${t ? (canXemHoSo ? `<button class="btn" data-act="trader" data-id="${t.id}">Hồ sơ</button>` : '') : (canTaoHopDong ? `<button class="btn primary" data-act="ct-new" data-id="${st.id}">Tạo hợp đồng</button>` : '')}
        ${canDoiTrangThai ? `<button class="btn" data-act="stall-status" data-id="${st.id}">Đổi trạng thái</button>` : ''}</div>` : ''}
      ${st.history && st.history.length ? `<div class="divider"></div><div class="small"><b>Lịch sử thay đổi</b>${st.history.map(h => `<div class="muted">${h}</div>`).join('')}</div>` : ''}`;
  };

  // A.VIEWS['mat-bang'] giờ định nghĩa ở js/v-cautruc.js (mbWorkspaceHtml) — nơi giữ cây cấu trúc +
  // model LAYOUT. File này chỉ còn giữ đúng phần thao tác điểm kinh doanh thật (drawer khi click 1
  // điểm trên sơ đồ) dùng chung cho cả route 'mat-bang' lẫn màn "Điểm kinh doanh" (screen:diem-kd,
  // độc lập, không đổi).
  Object.assign(A.ACT, {
    legend: el => { ui.hidden[el.dataset.s] = !ui.hidden[el.dataset.s]; A.render(); },
    stall: el => {
      ui.sel = el.dataset.id;
      const st = A.mbBusinessPointById(ui.market, ui.sel);
      if (!st) { U.toast('Không tìm thấy điểm kinh doanh trong chợ hiện tại'); return; }
      A.$('#modal-root').innerHTML = `<div class="drawer-overlay" data-act="close"></div><div class="drawer">
        <div class="drawer-h"><div><h3>${st.code}</h3><div class="small muted" style="margin-top:2px">${U.statusTag(st.status)}</div></div><span class="spacer"></span><button class="x" data-act="close" aria-label="Đóng">×</button></div>
        <div class="drawer-b">${A.stallPanel(st)}</div></div>`;
      A.render();
    },
    'stall-status': el => {
      const st = A.mbBusinessPointById(ui.market, el.dataset.id);
      if (!st) { U.toast('Không tìm thấy điểm kinh doanh trong chợ hiện tại'); return; }
      if (!A.canDo('so-do.doi-trang-thai', st.market)) return;
      const opts = ['thue', 'ngung', 'tranhchap'].concat(st.traderId ? [] : ['trong']);
      A.modal(A.mHead('Đổi trạng thái điểm ' + st.code) + `<div class="modal-b"><div class="form-grid">
        <div class="field"><label>Trạng thái mới</label><select class="input" id="ss-status">${opts.map(k => `<option value="${k}" ${st.status === k ? 'selected' : ''}>${D.STATUS[k].label}</option>`).join('')}</select></div>
        <div class="field"><label>Lý do</label><input class="input" id="ss-reason" placeholder="VD: tiểu thương xin tạm nghỉ 1 tháng"></div></div>
        <div class="small muted" style="margin-top:10px">Trạng thái "Nợ phí" do hệ thống tự xác định theo công nợ quá hạn.</div></div>
        <div class="modal-f"><button class="btn" data-act="close">Hủy</button><button class="btn primary" data-act="stall-status-save" data-id="${st.id}">Lưu</button></div>`);
    },
    'stall-status-save': el => {
      const st = A.mbBusinessPointById(ui.market, el.dataset.id);
      if (!st) { U.toast('Không tìm thấy điểm kinh doanh trong chợ hiện tại'); return; }
      if (!A.canDo('so-do.doi-trang-thai', st.market)) return;
      const ns = A.$('#ss-status').value, reason = A.$('#ss-reason').value.trim();
      st.history = st.history || [];
      st.history.unshift(`${U.dmy(U.today())}: ${D.STATUS[st.status].label} → ${D.STATUS[ns].label}${reason ? ' (' + reason + ')' : ''}`);
      st.status = ns; A.refreshStall(st);
      U.log(`Đổi trạng thái điểm ${st.code} sang ${D.STATUS[st.status].label}`);
      A.save(); A.closeModal(); A.render(); U.toast('Đã cập nhật trạng thái ' + st.code);
    }
  });
  A.IN['plan-search'] = el => { ui.planSearch = el.value; A.render(); };

  // ---------- Phiên chợ quê ----------
  function sessionStatusTag(s) {
    const cls = s.status === 'closed' ? 'ok' : s.status === 'cancelled' ? 'danger' : s.status === 'postponed' ? 'warn' : 'info';
    return `<span class="tag ${cls}">${SESSION_STATUS[s.status] || s.status}</span>`;
  }
  function sessionActionButtons(s) {
    if (!s || s.market !== TTD_SESSION_MARKET) return '';
    const outs = [];
    Object.keys(SESSION_TRANSITIONS[s.status] || {}).forEach(to => {
      const action = actionForTransition(s.status, to);
      if (action === 'phien-cho.chot-phien') return;
      if (canDoSessionAction(action, s)) outs.push(`<button class="btn sm" data-act="session-transition" data-id="${s.id}" data-to="${to}">${SESSION_ACTION_LABEL[to] || SESSION_STATUS[to]}</button>`);
    });
    if (s.status === 'pending_close' && canDoSessionAction('phien-cho.chot-phien', s)) {
      outs.push(`<button class="btn sm primary" data-act="session-open" data-id="${s.id}">Điểm danh & chốt phiên</button>`);
    }
    return outs.join('');
  }
  function sessionOpsHtml(s) {
    if (!s) return '<div class="card"><div class="card-h"><h3>Phiên sắp tới/đang vận hành</h3></div><div class="card-b"><div class="muted">Chưa có phiên chợ sắp tới.</div></div></div>';
    return `<div class="card"><div class="card-h"><h3>Phiên sắp tới/đang vận hành</h3><span class="spacer"></span>${sessionStatusTag(s)}</div>
      <div class="card-b">
        <div class="grid g3">
          <div><div class="small muted">Ngày phiên</div><b>${sessionLabel(s)}</b></div>
          <div><div class="small muted">Khung giờ</div><b>${formatTimeRange(s)}</b></div>
          <div><div class="small muted">Hạn đăng ký</div><b>${formatDeadline(s)}</b></div>
          <div><div class="small muted">Người tạo</div><b>${U.esc(s.createdBy || 'Dữ liệu lịch sử')}</b></div>
          <div><div class="small muted">Người phụ trách</div><b>${U.esc(s.assignedTo || 'Chưa phân công')}</b></div>
          <div><div class="small muted">Người chốt</div><b>${U.esc(s.closedBy || '—')}</b></div>
        </div>
        ${s.note ? `<div class="note info" style="margin-top:12px">${U.esc(s.note)}</div>` : ''}
        ${s.status === 'closed' ? `<div class="small muted" style="margin-top:12px">Đã chốt${s.closedAt ? ' lúc ' + U.esc(s.closedAt) : ''}. Phiên đã chốt chỉ đọc trong PC3A.</div>` : ''}
        <div class="row" style="margin-top:12px">${sessionActionButtons(s)}</div>
      </div></div>`;
  }
  A.VIEWS['phien-cho'] = function () {
    const ss = ttdSessionReadModels();
    const historical = ss.filter(s => s.status === 'closed').sort((a, b) => a.date.localeCompare(b.date));
    const chartHistory = historical.filter(s => Number.isFinite(Number(s.visitors)));
    const last = historical[historical.length - 1] || null;
    const booths = ttdBusinessPoints() || [];
    const active = activeTtdSession();
    const k = (l, v, s) => `<div class="card kpi"><div class="k-label">${l}</div><div class="k-value">${v}</div><div class="k-sub">${s}</div></div>`;
    return `
    <div class="note">Chợ quê Cù lao Tân Thuận Đông là <b>phiên chợ du lịch cộng đồng</b>, họp chiều thứ Bảy 14h–20h, không có trong phụ lục QĐ 480/QĐ-UBND. Vì vậy hệ thống quản lý theo <b>phiên</b>: đăng ký quầy theo năm, điểm danh quầy mỗi phiên, thu phí quầy theo phiên (mức 20.000 đ/quầy/phiên là giả định), thanh toán QR tại quầy. Không quản lý nội dung du lịch.</div>
    <div class="row">${A.canDo('phien-cho.tao-phien', TTD_SESSION_MARKET) ? '<button class="btn primary" data-act="session-create">Tạo phiên mới</button>' : ''}</div>
    <div class="kpis">
      ${k('Phiên gần nhất', last ? U.dmy(last.date) : '—', 'phiên đã chốt')}
      ${k('Quầy tham gia', last ? formatNumber(last.booths) + '/' + booths.length : '—/' + booths.length, 'quầy đăng ký')}
      ${k('Lượt khách (ước)', last ? formatNumber(last.visitors) : '—', 'do tổ quản lý ghi nhận')}
      ${k('Doanh thu tiểu thương (ước)', last ? formatMoneyShort(last.revenue) : '—', 'tổng hợp tự khai')}
    </div>
    ${sessionOpsHtml(active)}
    <div class="grid g2">
      <div class="card"><div class="card-h"><h3>Lượt khách theo phiên</h3></div><div class="card-b">
        ${chartHistory.length ? U.bars(chartHistory.map(s => s.date.slice(8) + '/' + s.date.slice(5, 7)), [{ name: 'Lượt khách (ước)', values: chartHistory.map(s => Number(s.visitors)), color: '#c93d6e' }], { fmt: v => Math.round(v).toLocaleString('vi-VN'), stacked: false }) : '<div class="muted">Chưa có dữ liệu phiên đã chốt.</div>'}</div></div>
      <div class="card"><div class="card-h"><h3>Lịch sử các phiên</h3></div><div class="card-b">
        ${U.table([{ t: 'Ngày' }, { t: 'Trạng thái' }, { t: 'Quầy', num: true }, { t: 'Phí phiên', num: true }, { t: 'Khách (ước)', num: true }, { t: 'Không tiền mặt', num: true }],
          historical.slice().reverse().map(s => `<tr><td>${U.dmy(s.date)}</td><td>${sessionStatusTag(s)}</td><td class="num">${formatNumber(s.booths)}</td><td class="num">${formatMoney(s.fee)}</td><td class="num">${formatNumber(s.visitors)}</td><td class="num">${formatPct(s.noncash)}</td></tr>`))}
      </div></div>
    </div>`;
  };
  Object.assign(A.ACT, {
    'session-create': () => {
      const fake = { id: 'new', market: TTD_SESSION_MARKET };
      if (!ttdSessionCanMutate('phien-cho.tao-phien', fake, true)) return;
      const date = TTD_DEMO_SESSION_DATE, deadline = registrationDeadlineForDate(date);
      A.modal(A.mHead('Tạo phiên chợ quê') + `<div class="modal-b"><div class="form-grid">
        <div class="field"><label>Ngày phiên *</label><input class="input" id="ses-date" type="date" value="${date}"></div>
        <div class="field"><label>Hạn đăng ký *</label><input class="input" id="ses-deadline" type="datetime-local" value="${deadline}"></div>
        <div class="field"><label>Giờ bắt đầu *</label><input class="input" id="ses-start" type="time" value="14:00"></div>
        <div class="field"><label>Giờ kết thúc *</label><input class="input" id="ses-end" type="time" value="20:00"></div>
      </div><div class="field" style="margin-top:10px"><label>Ghi chú</label><textarea class="input" id="ses-note" rows="2"></textarea></div></div>
      <div class="modal-f"><button class="btn" data-act="close">Hủy</button><button class="btn primary" data-act="session-create-save">Tạo phiên</button></div>`);
    },
    'session-create-save': () => {
      const fake = { id: 'new', market: TTD_SESSION_MARKET };
      if (!ttdSessionCanMutate('phien-cho.tao-phien', fake, true)) return;
      const date = A.$('#ses-date').value, startTime = A.$('#ses-start').value, endTime = A.$('#ses-end').value;
      const registrationDeadline = A.$('#ses-deadline').value, note = A.$('#ses-note').value.trim();
      const day = parseIsoDate(date);
      if (!day) { U.toast('Ngày phiên không hợp lệ'); return; }
      if (day.getDay() !== 6) { U.toast('Ngày phiên phải là thứ Bảy'); return; }
      if (!/^\d{2}:\d{2}$/.test(startTime) || !/^\d{2}:\d{2}$/.test(endTime) || startTime >= endTime) { U.toast('Giờ bắt đầu phải nhỏ hơn giờ kết thúc'); return; }
      const startAt = sessionStartDateTime(date, startTime), deadlineAt = parseLocalDateTime(registrationDeadline);
      if (!startAt || !deadlineAt || deadlineAt >= startAt) { U.toast('Hạn đăng ký phải trước giờ bắt đầu phiên'); return; }
      if (hasSessionDate(date, null)) { U.toast('Đã có phiên trong ngày này'); return; }
      const session = {
        id: sessionIdForDate(date), market: TTD_SESSION_MARKET, date, startTime, endTime, registrationDeadline,
        status: 'draft', note, createdBy: currentAccountName(), createdAt: nowIso(), updatedBy: currentAccountName(), updatedAt: nowIso()
      };
      A.db.sessions.push(session);
      const logLen = Array.isArray(A.db.extraLog) ? A.db.extraLog.length : null;
      try {
        U.log('Tạo phiên chợ quê ' + U.dmy(date));
        A.save();
      } catch (e) {
        A.db.sessions = A.db.sessions.filter(s => s !== session);
        if (logLen != null) A.db.extraLog.length = logLen;
        U.toast('Không lưu được phiên chợ quê, dữ liệu đã được hoàn tác');
        return;
      }
      A.closeModal(); A.render(); U.toast('Đã tạo phiên chợ quê ' + U.dmy(date));
    },
    'session-transition': el => {
      const s = sessionById(el.dataset.id), to = el.dataset.to;
      if (!s || s.market !== TTD_SESSION_MARKET) { U.toast('Không tìm thấy phiên TTD hợp lệ'); return; }
      const action = actionForTransition(s.status, to);
      if (!action || !ttdSessionCanMutate(action, s, true)) return;
      if (!canTransition(s.status, to)) { U.toast('Không thể chuyển trạng thái phiên theo yêu cầu'); return; }
      const from = s.status;
      const ok = applySessionMutation(s, () => {
        s.status = to;
        s.updatedBy = currentAccountName();
        s.updatedAt = nowIso();
        if (to === 'preparing' && !s.assignedTo) s.assignedTo = currentAccountName();
      }, `Chuyển phiên chợ quê ${sessionLabel(s)}: ${SESSION_STATUS[from]} → ${SESSION_STATUS[to]}`);
      if (ok) { A.render(); U.toast('Đã cập nhật trạng thái phiên'); }
    },
    'session-open': el => {
      const s = sessionById(el.dataset.id);
      if (!ttdSessionCanMutate('phien-cho.chot-phien', s, true)) return;
      if (s.status !== 'pending_close') { U.toast('Chỉ chốt phiên ở trạng thái Chờ chốt'); return; }
      const booths = ttdSessionEligiblePoints();
      if (!booths) { U.toast('Không đọc được danh sách điểm kinh doanh TTD'); return; }
      A.modal(A.mHead('Điểm danh quầy – phiên ' + sessionLabel(s)) + `<div class="modal-b">
        <div class="form-grid"><div class="field"><label>Lượt khách ước tính</label><input class="input" id="ses-visitors" type="number" value="2750"></div>
        <div class="field"><label>Doanh thu tiểu thương tự khai (triệu đồng)</label><input class="input" id="ses-rev" type="number" value="236"></div></div>
        <div class="divider"></div><div class="small muted" style="margin-bottom:8px">Bỏ chọn quầy vắng mặt:</div>
        <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(190px,1fr));gap:6px">${booths.map(s => `<label class="small"><input type="checkbox" class="ses-b" value="${s.id}" ${s.status === 'thue' ? 'checked' : ''}> ${s.code} · ${U.esc(A.idx.trader.get(s.traderId).name)}</label>`).join('')}</div></div>
        <div class="modal-f"><button class="btn" data-act="close">Hủy</button><button class="btn primary" data-act="session-save" data-id="${s.id}">Chốt phiên</button></div>`, true);
    },
    'session-save': el => {
      const s = sessionById(el.dataset.id);
      if (!ttdSessionCanMutate('phien-cho.chot-phien', s, true)) return;
      if (s.status !== 'pending_close') { U.toast('Chỉ chốt phiên ở trạng thái Chờ chốt'); return; }
      const booths = ttdSessionEligiblePoints();
      if (!booths) { U.toast('Không đọc được danh sách điểm kinh doanh TTD'); return; }
      const validIds = new Set(booths.map(st => st.id));
      const checked = Array.from(document.querySelectorAll('.ses-b:checked'));
      const selectedIds = new Set();
      let forged = false;
      checked.forEach(el => {
        const id = el && el.value;
        if (!validIds.has(id)) forged = true;
        else selectedIds.add(id);
      });
      if (forged) { U.toast('Dữ liệu điểm danh không hợp lệ, vui lòng mở lại phiên'); return; }
      const visitors = readNonNegativeNumber('#ses-visitors');
      const revenue = readNonNegativeNumber('#ses-rev', 1e6);
      if (visitors == null) { U.toast('Lượt khách ước tính phải là số không âm'); return; }
      if (revenue == null) { U.toast('Doanh thu tự khai phải là số không âm'); return; }
      const n = selectedIds.size;
      if (n > booths.length) { U.toast('Số quầy tham gia không hợp lệ'); return; }
      const ok = applySessionMutation(s, () => {
        s.booths = n;
        s.fee = n * D.SESSION_FEE;
        s.visitors = visitors;
        s.revenue = revenue;
        s.noncash = 0.41;
        s.status = 'closed';
        s.closedBy = currentAccountName();
        s.closedAt = nowIso();
        s.updatedBy = currentAccountName();
        s.updatedAt = nowIso();
      }, `Chốt phiên chợ quê ${sessionLabel(s)}: ${n} quầy`);
      if (ok) { A.closeModal(); A.render(); U.toast(`Đã chốt phiên ${sessionShortLabel(s)}: ${n} quầy, phí phiên ${U.money(n * D.SESSION_FEE)}`); }
    }
  });
})(window.APP);

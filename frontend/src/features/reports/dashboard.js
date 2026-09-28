/* Cross-market dashboard (Phase 15.11, from js/v-dieuhanh.js): route tong-quan — market KPIs,
 * monthly collection series, point status, market comparison and alerts. Read-only. */
(function (A) {
  'use strict';
  const D = A.D, U = A.U;
  function marketStats(mid) {
    const db = A.db, f = x => mid === 'ALL' || x.market === mid;
    const stalls = db.stalls.filter(f);
    const occ = stalls.filter(s => A.pointDisplayStatus(s) !== 'trong').length;
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
      // TONG_QUAN_LIEN_CHO_REGRESSION_FIX: payment không phải lúc nào cũng có invoiceId hợp lệ —
      // thu tại phiên chợ quê qua Mini App (js/mini.js, luồng QR/tiền mặt phiên) cố ý ghi
      // `invoiceId: null` (không gắn với 1 khoản phải thu/kỳ thu chính thức nào). A.idx.invoice.get()
      // trả về undefined cho các payment này — trước đây gọi thẳng `.period` trên kết quả đó làm
      // TypeError, khiến A.VIEWS['tong-quan'] throw giữa chừng và A.render() không kịp gán lại
      // #view.innerHTML (màn "Tổng quan liên chợ" coi như "biến mất", dù menu/permission/route vẫn
      // đúng). Payment không có invoice hợp lệ chỉ đơn giản KHÔNG khớp kỳ p nào ở đây (đã có trong
      // db.months ước tính riêng cho phiên chợ quê phía trên) — không phải lỗi dữ liệu cần sửa ở
      // nguồn, chỉ cần chặn an toàn tại điểm đọc.
      const ps = db.payments.filter(x => U.inScope(x, xmMkt) && x.invoiceId && A.idx.invoice.get(x.invoiceId) && A.idx.invoice.get(x.invoiceId).period === p);
      labels.push(p.slice(5) + '/' + p.slice(2, 4) + (p === '2026-09' ? '*' : ''));
      cash.push(U.sum(ps.filter(x => x.method === 'tm'), x => x.amount));
      non.push(U.sum(ps.filter(x => x.method !== 'tm'), x => x.amount));
    });
    return { labels, cash, non };
  }

  A.VIEWS['tong-quan'] = function () {
    // Tổng quan liên chợ = màn cross-market (A.SCREEN_MARKET['tong-quan'] === 'CROSS') — không bị
    // chặn bởi selectedMarket. TONG_QUAN_MARKET_DROPDOWN_DEDUP: dropdown "Chợ" trên topbar bị ẨN
    // riêng cho màn này (chrome(), xem js/core.js) để khỏi trùng với "Phạm vi xem" vẽ ngay dưới đây —
    // cả 2 cùng đọc/ghi CHUNG 1 state (ui.market) qua CHUNG 1 handler (data-ch="market-select" →
    // A.ACT.market), không phải 2 cơ chế khác nhau. A.xmMarket() đọc thẳng ui.market.
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
    if (exp) alerts.push(['warn', `${exp} hợp đồng hết hạn trong 30 ngày tới`, 'tieu-thuong']);
    if (over60) alerts.push(['danger', `${over60} tiểu thương nợ phí quá hạn trên 60 ngày`, 'cong-no']);
    if (s.incLate) alerts.push(['danger', `${s.incLate} phản ánh, sự cố quá thời hạn xử lý`, 'su-co']);
    if (abn) alerts.push(['warn', `${abn} chỉ số điện tăng bất thường so với trung bình`, 'dien-nuoc']);
    if (unmatched) alerts.push(['warn', `${unmatched} giao dịch chuyển khoản chưa khớp khoản thu`, 'doi-soat']);
    const escal = db.incidents.filter(i => U.inScope(i, xmMkt) && i.escalated && i.state !== 'dong');

    // RBAC_MARKET_SCOPE_MIGRATION mục 3.B/24: Lãnh đạo/Quản trị (GLOBAL) "xem dữ liệu tổng hợp
    // 12 chợ" — cột so sánh lấy ĐỘNG theo A.allowedMarkets(account đang dùng), không còn hard-code
    // đúng 2 cột CL/TTD. account MARKET (hiếm khi vào được màn CROSS này) vẫn chỉ thấy (các) chợ
    // trong scope của mình. 10 chợ mới (floors:[], chưa khảo sát) hiện cột 0 ở mọi chỉ tiêu — không
    // crash (marketStats() vẫn trả object hợp lệ với mảng rỗng).
    const cmp = A.allowedMarkets(A.currentAccount()).map(id => [id, marketStats(id)]);
    const cmpRow = (label, f) => `<tr><td>${label}</td>${cmp.map(c => `<td class="num">${f(c[1])}</td>`).join('')}</tr>`;

    return `
    <div class="card"><div class="card-b row" style="padding-top:14px"><span class="label-sm">Phạm vi xem</span><select class="input" style="min-width:200px" data-ch="market-select">${A.marketSelectOptionsHtml()}</select></div></div>
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
        <div class="card-b">${U.bars(rs.labels, [{ name: 'Tiền mặt', values: rs.cash, color: '#c9a45c' }, { name: 'QR / chuyển khoản', values: rs.non, color: '#1f6fd0' }])}</div></div>
      <div class="card"><div class="card-h"><h3>Trạng thái điểm kinh doanh</h3></div>
        <div class="card-b">${U.donut(counts, [U.pctTxt(s.occPct), 'lấp đầy'])}</div></div>
    </div>
    <div class="grid g2">
      <div class="card"><div class="card-h"><h3>So sánh giữa các chợ</h3></div><div class="card-b">
        <div class="tbl-wrap"><table class="tbl"><thead><tr><th>Chỉ tiêu</th>${cmp.map(c => `<th class="num">${U.esc(U.mShort(c[0]))}</th>`).join('')}</tr></thead><tbody>
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
        ${alerts.length ? alerts.map(a => `<div class="row" style="padding:8px 0;border-bottom:1px solid #eef2f7"><span class="tag ${a[0]}">${a[0] === 'danger' ? 'Khẩn' : 'Lưu ý'}</span><span style="flex:1">${a[1]}</span>${U.can(a[2]) ? `<button class="btn sm" data-act="go" data-to="${a[2]}">Xem</button>` : ''}</div>`).join('') : '<div class="empty">Không có cảnh báo</div>'}
        <h4 style="margin:16px 0 6px;font-size:var(--font-size-sm)">Phản ánh chuyển vượt cấp lên UBND phường</h4>
        ${escal.length ? escal.map(i => `<div class="row small" style="padding:6px 0"><span class="tag purple">${i.id}</span><span style="flex:1">${U.esc(i.title)} · ${U.mShort(i.market)}</span><button class="btn sm" data-act="inc-open" data-id="${i.id}">Mở</button></div>`).join('') : '<div class="small muted">Không có</div>'}
      </div></div>
    </div>`;
  };
})(window.APP);

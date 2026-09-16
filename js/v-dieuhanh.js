

/* Màn hình điều hành: Tổng quan liên chợ, Sơ đồ mặt bằng, Phiên chợ quê. */
(function (A) {
  'use strict';
  const D = A.D, U = A.U, ui = A.ui;

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

  // ---------- Mặt bằng chợ (gộp UI "Thiết lập mặt bằng chợ" + "Sơ đồ mặt bằng", nay là workspace
  // drill-down nhiều cấp — MARKET_LAYOUT_DRILLDOWN_UX_REPORT.md) ----------
  // KHÔNG còn "edit mode" như 1 route/trang riêng nữa — action thêm/sửa/xóa cấu trúc hiện NGAY trên
  // cây, permission cho phép tới đâu thì action tự hiện tới đó. Toàn bộ cây + action cấu trúc + điều
  // hướng chọn node (Tổng quan/Khối/Tầng/Khu) nằm ở js/v-cautruc.js (nơi giữ model LAYOUT). File
  // này chỉ còn giữ đúng phần liên quan tới điểm kinh doanh THẬT (D.MARKETS/A.db.stalls):
  // A.stallPanel (drawer điểm KD, không đổi) + các hàm dùng chung A.mbOverviewHtml/A.mbBlockHtml/
  // A.mbFloorHtml/A.mbZoneDiagramHtml render vùng nội dung bên phải theo đúng cấp đang chọn —
  // js/v-cautruc.js gọi các hàm này, truyền vào (các) khối/tầng/khu LAYOUT hiện có; các hàm tự đối
  // chiếu với dữ liệu thật qua `zone.code === section.id` (đúng cách defaultLayout() đã seed — xem
  // js/v-cautruc.js) để hiển thị đúng trạng thái thực tế cho khu đã triển khai, hoặc thông tin quy
  // hoạch cho khu chưa khớp dữ liệu thật. Mọi số liệu tổng hợp (tổng điểm, số theo trạng thái) đều
  // TÍNH TỪ A.db.stalls/LAYOUT ngay tại thời điểm render — không persist thêm field nào. Không tạo
  // model/permission mặt bằng thứ hai, không đổi 'screen:mat-bang'/so-do.*/cau-truc.* (6 action
  // permKey GIỮ NGUYÊN).
  function mbMatchRealSection(mid, code) {
    const m = U.market(mid);
    for (const f of m.floors) { const s = f.sections.find(x => x.id === code); if (s) return { floor: f, section: s }; }
    return null;
  }
  // Điểm KD thật của 1 khu LAYOUT (mảng rỗng nếu khu còn ở giai đoạn quy hoạch, chưa khớp dữ liệu
  // thật — KHÔNG lẫn với "chưa có điểm nào dù đã khớp", 2 trường hợp này phân biệt bằng
  // mbMatchRealSection, không dựa vào độ dài mảng ở đây).
  function mbZoneStalls(mid, z) {
    const matched = mbMatchRealSection(mid, z.code);
    return matched ? A.db.stalls.filter(st => st.market === mid && st.floor === matched.floor.id && st.section === matched.section.id) : [];
  }
  function mbStatusLine(stalls) {
    const c = k => stalls.filter(st => st.status === k).length;
    const parts = Object.keys(D.STATUS).filter(k => c(k)).map(k => `${c(k)} ${D.STATUS[k].label.toLowerCase()}`);
    return parts.length ? parts.join(' · ') : 'Chưa có điểm kinh doanh';
  }
  // Danh sách khu của 1 tầng, MỖI khu render bằng ĐÚNG 1 renderer dùng chung (mbZoneSectionHtml —
  // tên khu + thống kê ngắn + point grid) — dùng lại nguyên vẹn ở cả Tầng/Khối/Tổng quan (hotfix
  // "cùng 1 visual language": không tạo renderer khác nhau cho từng cấp).
  function mbFloorZonesHtml(mid, floor) {
    return floor.zones.length ? floor.zones.map(z => mbZoneSectionHtml(mid, z)).join('') : '<div class="empty small">Chưa có khu nào.</div>';
  }
  // 1 tầng lồng bên trong Khối/Tổng quan (nơi 1 card có thể chứa NHIỀU tầng): thêm 1 heading nhỏ,
  // click được (→ view Tầng), phía trên danh sách khu của tầng đó — chỉ hiện khi phạm vi đang xem có
  // hơn 1 tầng (`showHeading`); khối chỉ có đúng 1 tầng thì heading thừa (trùng ý khối/tầng, giống
  // logic gộp `mbFlatMode` ở cây cấu trúc — xem js/v-cautruc.js), hiển thị thẳng danh sách khu.
  function mbFloorGroupHtml(mid, floor, showHeading) {
    const zonesHtml = mbFloorZonesHtml(mid, floor);
    if (!showHeading) return zonesHtml;
    const stalls = [];
    floor.zones.forEach(z => stalls.push.apply(stalls, mbZoneStalls(mid, z)));
    return `<div class="mb-floor-heading">
        <button class="mb-floor-heading-btn" data-act="mb-sel-floor" data-id="${floor.key}">${U.esc(floor.name)}</button>
        <span class="spacer"></span><span class="mb-floor-heading-meta">${stalls.length} điểm KD · ${mbStatusLine(stalls)}</span>
      </div>${zonesHtml}`;
  }
  // ---- Tổng quan toàn chợ (mục 1/2/3 hotfix — cùng visual language mọi cấp): mỗi khối 1 card,
  // trong đó liệt kê ĐỦ các tầng (nếu >1 tầng, có heading tầng) và ĐỦ các khu + point grid của từng
  // tầng — KHÔNG còn rút gọn thành danh sách/chip như trước. Thống kê tối thiểu toàn chợ đã có sẵn ở
  // thanh tổng hợp phía trên workspace (không lặp lại ở đây — xem mbWorkspaceHtml ở v-cautruc.js).
  A.mbOverviewHtml = function (mid, blocks) {
    if (!blocks.length) return '<div class="empty">Chưa có khối/nhà chợ nào.</div>';
    return `<div class="mb-ov">${blocks.map(b => {
      const stalls = [];
      b.floors.forEach(f => f.zones.forEach(z => stalls.push.apply(stalls, mbZoneStalls(mid, z))));
      const multi = b.floors.length > 1;
      const body = b.floors.length ? b.floors.map(f => mbFloorGroupHtml(mid, f, multi)).join('') : '<div class="empty small">Chưa có tầng</div>';
      return `<div class="card"><div class="card-h mb-ov-clickable" data-act="mb-sel-block" data-id="${b.key}"><h3>${U.esc(b.name)}</h3><span class="small muted">${stalls.length} điểm KD</span></div>
        <div class="card-b"><div class="plan">${body}</div></div></div>`;
    }).join('')}</div>`;
  };
  // ---- Khối/Nhà chợ (mục 2 hotfix): TOÀN BỘ tầng thuộc khối, mỗi tầng TOÀN BỘ khu + point grid —
  // cùng cấu trúc với Tổng quan, chỉ khác phạm vi (đúng 1 khối thay vì mọi khối).
  A.mbBlockHtml = function (mid, block) {
    const stalls = [];
    block.floors.forEach(f => f.zones.forEach(z => stalls.push.apply(stalls, mbZoneStalls(mid, z))));
    const multi = block.floors.length > 1;
    const body = block.floors.length ? block.floors.map(f => mbFloorGroupHtml(mid, f, multi)).join('') : '<div class="empty small">Chưa có tầng</div>';
    return `<div class="card"><div class="card-h"><h3>${U.esc(block.name)}</h3><span class="small muted">${stalls.length} điểm KD</span></div>
      <div class="card-b"><div class="plan">${body}</div></div></div>`;
  };
  // ---- Tầng: sơ đồ TOÀN BỘ điểm KD của TẤT CẢ khu thuộc tầng, mỗi khu tách thành 1 .plan-section
  // riêng (KHÔNG trộn chung 1 grid), giữ màu trạng thái hiện tại — không có heading tầng thừa vì
  // card-h h3 ở đây đã chính là tên tầng.
  A.mbFloorHtml = function (mid, floor) {
    const stalls = [];
    floor.zones.forEach(z => stalls.push.apply(stalls, mbZoneStalls(mid, z)));
    return `<div class="card"><div class="card-h"><h3>${U.esc(floor.name)}</h3><span class="small muted">${stalls.length} điểm KD · ${mbStatusLine(stalls)}</span></div>
      <div class="card-b"><div class="plan">${mbFloorZonesHtml(mid, floor)}</div></div></div>`;
  };
  // 1 khu, dạng compact (không bọc .card riêng) để nhúng nhiều khu liên tiếp trong view Tầng —
  // click tên khu → drill-down tiếp sang view Khu (mục 7: "Click tên Khu → chuyển sang view Khu").
  function mbZoneSectionHtml(mid, z) {
    const matched = mbMatchRealSection(mid, z.code);
    const head = `<h4><button class="mb-zone-jump" data-act="mb-sel-zone" data-id="${z.key}">${U.esc(z.name || '(chưa đặt tên)')}</button><span>${U.esc(z.code || '')}${z.status === 'nhap' ? ' · <span class="tag warn">Nháp</span>' : ''}</span></h4>`;
    if (!matched) {
      const planned = U.sum(z.planned, p => Number(p.qty) || 0);
      return `<div class="plan-section">${head}<div class="small muted">${planned} điểm dự kiến · khu đang quy hoạch, chưa có dữ liệu thực tế</div></div>`;
    }
    const sec = matched.section, stalls = A.db.stalls.filter(st => st.market === mid && st.floor === matched.floor.id && st.section === sec.id);
    const rows = sec.rows.map(r => {
      const cells = stalls.filter(st => st.row === r);
      return `<div class="plan-row"><span class="rl">${r}</span><div class="cells" style="--n:${sec.per}">${cells.map(st => {
        const t = st.traderId ? A.idx.trader.get(st.traderId) : null;
        return `<button class="cell s-${st.status} ${sec.type === 'kiot' ? 'kiot' : ''}" data-act="stall" data-id="${st.id}" title="${st.code} · ${D.STATUS[st.status].label}${t ? ' · ' + U.esc(t.name) : ''}">${st.num}</button>`;
      }).join('')}</div></div>`;
    }).join('<div class="aisle"></div>');
    return `<div class="plan-section">${head}<div class="small muted" style="margin:-4px 0 8px">${stalls.length} điểm · ${mbStatusLine(stalls)}</div>${rows}</div>`;
  }
  // ---- Khu (mục 8): giữ đúng hành vi cũ (legend lọc trạng thái + tìm kiếm + sơ đồ đầy đủ). ----
  A.mbZoneDiagramHtml = function (mid, z, canEditZone) {
    const matched = mbMatchRealSection(mid, z.code);
    const editBtn = canEditZone ? `<button class="btn sm" data-act="qh-zone-edit-open" data-id="${z.key}">✎ Sửa thông tin khu</button>` : '';
    if (!matched) {
      const totalQty = U.sum(z.planned, p => Number(p.qty) || 0), totalArea = U.sum(z.planned, p => (Number(p.std) || 0) * (Number(p.qty) || 0));
      return `<div class="card"><div class="card-h"><h3>${U.esc(z.name || '(chưa đặt tên)')}</h3><span class="small muted">${U.esc(z.code || '')} · quy hoạch</span><span class="spacer"></span>${editBtn}</div>
        <div class="card-b"><div class="note info">Khu này đang ở giai đoạn quy hoạch, chưa có điểm kinh doanh thực tế tương ứng (mã "${U.esc(z.code || '')}" chưa khớp khu vực nào trong sơ đồ thật).</div>
        <div class="row" style="margin-top:10px"><span>Số điểm dự kiến</span><span class="spacer"></span><b>${totalQty.toLocaleString('vi-VN')}</b></div>
        <div class="row"><span>Diện tích dự kiến</span><span class="spacer"></span><b>${totalArea.toLocaleString('vi-VN')} m²</b></div></div></div>`;
    }
    const f = matched.floor, sec = matched.section;
    const stalls = A.db.stalls.filter(st => st.market === mid && st.floor === f.id && st.section === sec.id);
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

  // ---- Mặt bằng chợ — Chợ Cao Lãnh: drawer "xem nhanh" khi click 1 điểm trên sơ đồ (KHÁC
  // A.stallPanel ở trên — A.stallPanel GIỮ NGUYÊN, vẫn dùng cho Mặt bằng chợ quê TTĐ + màn "Điểm
  // kinh doanh" TTD, không đổi gì ở đó). Theo yêu cầu BUSINESS_POINT_MAP_DRAWER_REFACTOR: chỉ XEM
  // NHANH (4 nhóm A/B/C/D), KHÔNG có nút "Đổi trạng thái"/"Thu tiền"/"Tạo hợp đồng", KHÔNG mở modal
  // hồ sơ lớn tại chỗ — thay bằng 2 nút điều hướng dùng lại router/state hiện có (A.go + A.ACT có
  // sẵn của chính 2 màn đích), không tạo màn/modal chi tiết thứ hai.
  function mbStallPointTypeLabel(st) {
    return st.pointType && D.POINT_TYPE[st.pointType] ? D.POINT_TYPE[st.pointType].label : 'Chưa có thông tin';
  }
  // Người bán thực tế: tham chiếu ĐÚNG model sellerId đã chốt — KHÔNG suy đoán "giống người thuê"
  // khi sellerId rỗng (khác dkSeller() ở màn Điểm kinh doanh — nơi đó null = mặc định giống người
  // thuê); ở đây null hiển thị đúng nghĩa "chưa ghi nhận" theo yêu cầu, không tự bịa dữ liệu.
  function mbStallSeller(st, t) {
    if (!t || !st.sellerId) return null;
    const seller = A.idx.trader.get(st.sellerId);
    return seller ? { trader: seller, same: seller.id === t.id } : null;
  }
  function mbStallPanelCL(st) {
    const t = st.traderId ? A.idx.trader.get(st.traderId) : null;
    const c = st.contractId ? A.idx.contract.get(st.contractId) : null;
    const seller = mbStallSeller(st, t);
    // Điều hướng chỉ theo screen permission của MÀN ĐÍCH (U.can — đã gồm account active + role +
    // screenMarketOk/marketScopes) — không action permission riêng, không hard-code role/market.
    const canXemHoSo = U.can('tieu-thuong');
    const canXemDiemKD = U.can('diem-kd');
    const unpaid = t ? A.db.invoices.filter(i => i.stallId === st.id && i.status !== 'paid') : [];
    const owe = U.sum(unpaid, U.due);
    const left = c ? U.days(U.today(), c.end) : null;
    const sec = (label, body) => `<div class="row"><b style="font-size:var(--font-size-sm)">${label}</b></div><div style="margin:6px 0 14px">${body}</div>`;
    const actions = [];
    if (t && canXemHoSo) actions.push(`<button class="btn" data-act="mb-open-trader" data-id="${t.id}">Xem hồ sơ tiểu thương</button>`);
    if (canXemDiemKD) actions.push(`<button class="btn" data-act="mb-open-diemkd" data-id="${st.id}">Xem điểm kinh doanh</button>`);
    return `<div class="muted small" style="margin:2px 0 12px">${U.esc(st.sectionName)} · ${U.market(st.market).floors.find(f => f.id === st.floor).name} · ${U.esc(U.market(st.market).name)}</div>
      ${sec('A. Thông tin điểm', `<dl class="kv">
        <dt>Loại điểm</dt><dd>${U.esc(mbStallPointTypeLabel(st))}</dd>
        <dt>Diện tích</dt><dd>${st.area.toLocaleString('vi-VN')} m²</dd>
        <dt>Ngành hàng</dt><dd>${U.esc(st.cat)}</dd>
        <dt>Đơn giá áp dụng</dt><dd>${U.unitLabel(st)}</dd></dl>`)}
      <div class="divider"></div>
      ${sec('B. Thông tin sử dụng', `<dl class="kv">
        <dt>Người thuê</dt><dd>${t ? `${U.esc(t.name)} (${t.id})` : 'Chưa có'}</dd>
        <dt>Người bán thực tế</dt><dd>${!t ? 'Chưa ghi nhận' : !seller ? 'Chưa ghi nhận' : seller.same ? `${U.esc(seller.trader.name)} <span class="small muted">(người thuê trực tiếp kinh doanh)</span>` : U.esc(seller.trader.name)}</dd>
        ${t ? `<dt>Điện thoại</dt><dd>${U.maskPhone(t.phone)}</dd>` : ''}</dl>`)}
      <div class="divider"></div>
      ${sec('C. Hợp đồng hiện hành', c
        ? `<dl class="kv"><dt>Số hợp đồng</dt><dd>${c.id}</dd>
        <dt>Thời hạn</dt><dd>${U.dmy(c.start)} – ${U.dmy(c.end)}<br><span class="small muted">${left <= 30 ? `<b style="color:#d6453b">còn ${left} ngày</b>` : 'còn ' + left + ' ngày'}</span></dd>
        <dt>Trạng thái</dt><dd>${c.status === 'hieuluc' ? '<span class="tag ok">Đang hiệu lực</span>' : '<span class="tag">Đã thanh lý</span>'}</dd></dl>`
        : '<div class="note info">Chưa có hợp đồng hiệu lực.</div>')}
      <div class="divider"></div>
      ${sec('D. Công nợ', !t ? '<span class="tag">Không có nghĩa vụ hiện tại</span>'
        : owe ? `<span class="tag danger">Nợ phí</span> <b style="color:#d6453b;margin-left:6px">${U.money(owe)}</b>`
        : '<span class="tag ok">Không nợ</span>')}
      ${actions.length ? `<div class="row" style="gap:8px;flex-wrap:wrap">${actions.join('')}</div>` : ''}`;
  }

  // A.VIEWS['mat-bang'] giờ định nghĩa ở js/v-cautruc.js (mbWorkspaceHtml) — nơi giữ cây cấu trúc +
  // model LAYOUT. File này chỉ còn giữ đúng phần thao tác điểm kinh doanh thật (drawer khi click 1
  // điểm trên sơ đồ) dùng chung cho cả route 'mat-bang' lẫn màn "Điểm kinh doanh" (screen:diem-kd,
  // độc lập, không đổi).
  Object.assign(A.ACT, {
    legend: el => { ui.hidden[el.dataset.s] = !ui.hidden[el.dataset.s]; A.render(); },
    stall: el => {
      ui.sel = el.dataset.id;
      const st = A.idx.stall.get(ui.sel);
      A.$('#modal-root').innerHTML = `<div class="drawer-overlay" data-act="close"></div><div class="drawer">
        <div class="drawer-h"><div><h3>${st.code}</h3><div class="small muted" style="margin-top:2px">${U.statusTag(st.status)}</div></div><span class="spacer"></span><button class="x" data-act="close" aria-label="Đóng">×</button></div>
        <div class="drawer-b">${st.market === 'CL' ? mbStallPanelCL(st) : A.stallPanel(st)}</div></div>`;
      A.render();
    },
    // 2 nút điều hướng "xem sâu" của drawer Mặt bằng CL — tái dùng NGUYÊN A.go() (router hiện có)
    // + đúng handler đã có sẵn của chính màn đích (A.ACT.trader mở hồ sơ, A.ACT['dk-open'] mở drawer
    // điểm KD ở màn Điểm kinh doanh) — không tạo màn/modal mới, không duplicate logic.
    'mb-open-trader': el => {
      if (!U.can('tieu-thuong')) return;
      const t = A.idx.trader.get(el.dataset.id);
      if (!t) return;
      A.go('tieu-thuong');
      A.ACT.trader({ dataset: { id: t.id } });
    },
    'mb-open-diemkd': el => {
      if (!U.can('diem-kd')) return;
      const st = A.idx.stall.get(el.dataset.id);
      if (!st) return;
      A.go('diem-kd');
      A.ACT['dk-open']({ dataset: { id: st.id } });
    },
    'stall-status': el => {
      const st = A.idx.stall.get(el.dataset.id);
      if (!A.canDo('so-do.doi-trang-thai', st.market)) return;
      const opts = ['thue', 'ngung', 'tranhchap'].concat(st.traderId ? [] : ['trong']);
      A.modal(A.mHead('Đổi trạng thái điểm ' + st.code) + `<div class="modal-b"><div class="form-grid">
        <div class="field"><label>Trạng thái mới</label><select class="input" id="ss-status">${opts.map(k => `<option value="${k}" ${st.status === k ? 'selected' : ''}>${D.STATUS[k].label}</option>`).join('')}</select></div>
        <div class="field"><label>Lý do</label><input class="input" id="ss-reason" placeholder="VD: tiểu thương xin tạm nghỉ 1 tháng"></div></div>
        <div class="small muted" style="margin-top:10px">Trạng thái "Nợ phí" do hệ thống tự xác định theo công nợ quá hạn.</div></div>
        <div class="modal-f"><button class="btn" data-act="close">Hủy</button><button class="btn primary" data-act="stall-status-save" data-id="${st.id}">Lưu</button></div>`);
    },
    'stall-status-save': el => {
      const st = A.idx.stall.get(el.dataset.id);
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
  A.VIEWS['phien-cho'] = function () {
    const ss = A.db.sessions, last = ss[ss.length - 1];
    const pending = !ss.some(s => s.date === '2026-09-12');
    const booths = A.db.stalls.filter(s => s.market === 'TTD');
    const k = (l, v, s) => `<div class="card kpi"><div class="k-label">${l}</div><div class="k-value">${v}</div><div class="k-sub">${s}</div></div>`;
    return `
    <div class="note">Chợ quê Cù lao Tân Thuận Đông là <b>phiên chợ du lịch cộng đồng</b>, họp chiều thứ Bảy 14h–20h, không có trong phụ lục QĐ 480/QĐ-UBND. Vì vậy hệ thống quản lý theo <b>phiên</b>: đăng ký quầy theo năm, điểm danh quầy mỗi phiên, thu phí quầy theo phiên (mức 20.000 đ/quầy/phiên là giả định), thanh toán QR tại quầy. Không quản lý nội dung du lịch.</div>
    <div class="kpis">
      ${k('Phiên gần nhất', U.dmy(last.date), 'Thứ Bảy · 14h–20h')}
      ${k('Quầy tham gia', last.booths + '/' + booths.length, 'quầy đăng ký')}
      ${k('Lượt khách (ước)', last.visitors.toLocaleString('vi-VN'), 'do tổ quản lý ghi nhận')}
      ${k('Doanh thu tiểu thương (ước)', U.moneyShort(last.revenue), 'tổng hợp tự khai')}
    </div>
    ${pending ? `<div class="card"><div class="card-b row" style="padding-top:16px"><div style="flex:1"><b>Phiên thứ Bảy 12/09/2026 chưa chốt số liệu</b><div class="small muted">Điểm danh quầy tham gia, ghi lượt khách ước tính, hệ thống tự tính phí phiên.</div></div>
      ${A.canDo('phien-cho.chot-phien', ui.market) ? '<button class="btn primary" data-act="session-open">Điểm danh & chốt phiên 12/09</button>' : ''}</div></div>` : ''}
    <div class="grid g2">
      <div class="card"><div class="card-h"><h3>Lượt khách theo phiên</h3></div><div class="card-b">
        ${U.bars(ss.map(s => s.date.slice(8) + '/' + s.date.slice(5, 7)), [{ name: 'Lượt khách (ước)', values: ss.map(s => s.visitors), color: '#c93d6e' }], { fmt: v => Math.round(v).toLocaleString('vi-VN'), stacked: false })}</div></div>
      <div class="card"><div class="card-h"><h3>Lịch sử các phiên</h3></div><div class="card-b">
        ${U.table([{ t: 'Ngày' }, { t: 'Quầy', num: true }, { t: 'Phí phiên', num: true }, { t: 'Khách (ước)', num: true }, { t: 'Không tiền mặt', num: true }],
          ss.slice().reverse().map(s => `<tr><td>${U.dmy(s.date)}</td><td class="num">${s.booths}</td><td class="num">${U.money(s.fee)}</td><td class="num">${s.visitors.toLocaleString('vi-VN')}</td><td class="num">${U.pctTxt(s.noncash * 100)}</td></tr>`))}
      </div></div>
    </div>`;
  };
  Object.assign(A.ACT, {
    'session-open': () => {
      if (!A.canDo('phien-cho.chot-phien', ui.market)) return;
      const booths = A.db.stalls.filter(s => s.market === 'TTD' && s.traderId);
      A.modal(A.mHead('Điểm danh quầy – phiên 12/09/2026') + `<div class="modal-b">
        <div class="form-grid"><div class="field"><label>Lượt khách ước tính</label><input class="input" id="ses-visitors" type="number" value="2750"></div>
        <div class="field"><label>Doanh thu tiểu thương tự khai (triệu đồng)</label><input class="input" id="ses-rev" type="number" value="236"></div></div>
        <div class="divider"></div><div class="small muted" style="margin-bottom:8px">Bỏ chọn quầy vắng mặt:</div>
        <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(190px,1fr));gap:6px">${booths.map(s => `<label class="small"><input type="checkbox" class="ses-b" value="${s.id}" ${s.status === 'thue' ? 'checked' : ''}> ${s.code} · ${U.esc(A.idx.trader.get(s.traderId).name)}</label>`).join('')}</div></div>
        <div class="modal-f"><button class="btn" data-act="close">Hủy</button><button class="btn primary" data-act="session-save">Chốt phiên</button></div>`, true);
    },
    'session-save': () => {
      if (!A.canDo('phien-cho.chot-phien', ui.market)) return;
      const n = document.querySelectorAll('.ses-b:checked').length;
      A.db.sessions.push({ date: '2026-09-12', booths: n, fee: n * D.SESSION_FEE, visitors: Number(A.$('#ses-visitors').value) || 0, revenue: (Number(A.$('#ses-rev').value) || 0) * 1e6, noncash: 0.41 });
      U.log(`Chốt phiên chợ quê 12/09/2026: ${n} quầy`);
      A.save(); A.closeModal(); A.render(); U.toast(`Đã chốt phiên 12/09: ${n} quầy, phí phiên ${U.money(n * D.SESSION_FEE)}`);
    }
  });
})(window.APP);

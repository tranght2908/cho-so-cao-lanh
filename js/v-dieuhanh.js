

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

  function revenueSeries() {
    const db = A.db, incCL = ui.market !== 'TTD', incT = ui.market !== 'CL';
    const labels = [], cash = [], non = [];
    const ttdBase = 33 * D.SESSION_FEE * 4.3;
    db.months.forEach(m => {
      const share = m.noncash / (m.cash + m.noncash);
      labels.push(m.period.slice(5) + '/' + m.period.slice(2, 4));
      cash.push((incCL ? m.cash : 0) + (incT ? ttdBase * (1 - share) : 0));
      non.push((incCL ? m.noncash : 0) + (incT ? ttdBase * share : 0));
    });
    db.issuedPeriods.filter(p => p <= '2026-09').forEach(p => {
      const ps = db.payments.filter(x => U.inM(x) && A.idx.invoice.get(x.invoiceId).period === p);
      labels.push(p.slice(5) + '/' + p.slice(2, 4) + (p === '2026-09' ? '*' : ''));
      cash.push(U.sum(ps.filter(x => x.method === 'tm'), x => x.amount));
      non.push(U.sum(ps.filter(x => x.method !== 'tm'), x => x.amount));
    });
    return { labels, cash, non };
  }

  A.VIEWS['tong-quan'] = function () {
    const s = marketStats(ui.market), db = A.db;
    const kpi = (label, value, sub, cls, bar) => `<div class="card kpi"><div class="k-label">${label}</div><div class="k-value">${value}</div>
      ${sub ? `<div class="k-sub ${cls || ''}">${sub}</div>` : ''}${bar != null ? `<div class="bar-mini"><i style="width:${Math.min(100, bar)}%"></i></div>` : ''}</div>`;
    const rs = revenueSeries();
    const counts = Object.keys(D.STATUS).map(k => ({ label: D.STATUS[k].label, value: db.stalls.filter(x => U.inM(x) && x.status === k).length, color: D.STATUS[k].color }));
    const alerts = [];
    const exp = db.contracts.filter(c => U.inM(c) && c.status === 'hieuluc' && U.days(U.today(), c.end) <= 30).length;
    const over60 = new Set(db.invoices.filter(i => U.inM(i) && U.isOver(i) && U.overDays(i) > 60).map(i => i.traderId)).size;
    const abn = db.readings.filter(r => U.inM(A.idx.stall.get(r.stallId)) && r.elecCur != null && (r.elecCur - r.elecPrev) > r.elecAvg * 1.5).length;
    const unmatched = db.bank.filter(b => !b.matched).length;
    if (exp) alerts.push(['warn', `${exp} hợp đồng hết hạn trong 30 ngày tới`, 'hop-dong']);
    if (over60) alerts.push(['danger', `${over60} tiểu thương nợ phí quá hạn trên 60 ngày`, 'cong-no']);
    if (s.incLate) alerts.push(['danger', `${s.incLate} phản ánh, sự cố quá thời hạn xử lý`, 'su-co']);
    if (abn) alerts.push(['warn', `${abn} chỉ số điện tăng bất thường so với trung bình`, 'dien-nuoc']);
    if (unmatched) alerts.push(['warn', `${unmatched} giao dịch chuyển khoản chưa khớp khoản thu`, 'doi-soat']);
    const escal = db.incidents.filter(i => U.inM(i) && i.escalated && i.state !== 'dong');

    const cmp = ['CL', 'TTD'].map(id => [id, marketStats(id)]);
    const cmpRow = (label, f) => `<tr><td>${label}</td>${cmp.map(c => `<td class="num">${f(c[1])}</td>`).join('')}</tr>`;

    return `
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
        <h4 style="margin:16px 0 6px;font-size:13.5px">Phản ánh chuyển vượt cấp lên UBND phường</h4>
        ${escal.length ? escal.map(i => `<div class="row small" style="padding:6px 0"><span class="tag purple">${i.id}</span><span style="flex:1">${U.esc(i.title)} · ${U.mShort(i.market)}</span><button class="btn sm" data-act="inc-open" data-id="${i.id}">Mở</button></div>`).join('') : '<div class="small muted">Không có</div>'}
      </div></div>
    </div>`;
  };

  // ---------- Sơ đồ mặt bằng ----------
  function planMarket() { return ui.market === 'ALL' ? ui.planMarket : ui.market; }
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
    const canThuTien = A.PERM.canAction(ui.role, 'thu-tien.thu');
    const canXemHoSo = A.PERM.canAction(ui.role, 'so-do.xem-ho-so');
    const canTaoHopDong = A.PERM.canAction(ui.role, 'so-do.tao-hop-dong');
    const canDoiTrangThai = A.PERM.canAction(ui.role, 'so-do.doi-trang-thai');
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

  A.VIEWS['so-do'] = function () {
    const mid = planMarket(), m = U.market(mid);
    if (!m.floors.find(f => f.id === ui.floor[mid])) ui.floor[mid] = m.floors[0].id;
    const f = m.floors.find(x => x.id === ui.floor[mid]);
    const mStalls = A.db.stalls.filter(s => s.market === mid);
    const legend = Object.keys(D.STATUS).map(k => `<button class="${ui.hidden[k] ? 'off' : ''}" data-act="legend" data-s="${k}"><span class="sw" style="background:${D.STATUS[k].color}"></span>${D.STATUS[k].label} <b>${mStalls.filter(s => s.status === k).length}</b></button>`).join('');
    let plan;
    if (f.parking) {
      plan = `<div class="parking"><div style="font-size:30px">🅿️</div><b>${f.name}</b><div>${f.desc}</div><div class="small" style="margin-top:6px">Công năng theo dự án chợ mới: bãi xe và khu kỹ thuật (số chỗ để xe sẽ cập nhật khi bàn giao).</div></div>`;
    } else {
      plan = f.sections.map(sec => {
        const rows = sec.rows.map(r => {
          const cells = mStalls.filter(s => s.section === sec.id && s.row === r);
          return `<div class="plan-row"><span class="rl">${r}</span><div class="cells" style="--n:${sec.per}">${cells.map(st => {
            const t = st.traderId ? A.idx.trader.get(st.traderId) : null;
            return `<button class="cell s-${st.status} ${st.type === 'kiot' ? 'kiot' : ''} ${stallMatch(st) ? '' : 'dim'} ${ui.sel === st.id ? 'sel' : ''}" data-act="stall" data-id="${st.id}" title="${st.code} · ${D.STATUS[st.status].label}${t ? ' · ' + U.esc(t.name) : ''}">${st.num}</button>`;
          }).join('')}</div></div>`;
        }).join('<div class="aisle"></div>');
        return `<div class="plan-section"><h4>${sec.name}<span>${sec.cat} · ${U.typeLabel(sec.type)} · ${sec.rows.length * sec.per} điểm</span></h4>${rows}</div>`;
      }).join('');
    }
    const st = ui.sel ? A.idx.stall.get(ui.sel) : null;
    return `
    <div class="card"><div class="card-b" style="padding-top:14px">
      <div class="row">
        ${ui.market === 'ALL' ? `<div class="seg">${['CL', 'TTD'].map(id => `<button class="${mid === id ? 'on' : ''}" data-act="plan-market" data-id="${id}">${U.mShort(id)}</button>`).join('')}</div>` : ''}
        <div class="seg">${m.floors.map(x => `<button class="${x.id === f.id ? 'on' : ''}" data-act="plan-floor" data-id="${x.id}">${x.name}</button>`).join('')}</div>
        <span class="spacer"></span>
        <input class="input" style="width:230px" placeholder="Tìm mã điểm hoặc tên tiểu thương" data-in="plan-search" value="${U.esc(ui.planSearch)}">
      </div>
      <div class="small muted" style="margin:10px 0">${U.esc(m.name)} · ${m.hang} · ${U.esc(m.address)} · ${U.esc(m.note)}</div>
      <div class="legend">${legend}</div>
    </div></div>
    <div class="grid g-main" style="align-items:start">
      <div class="card"><div class="card-h"><h3>${f.name} – ${U.esc(f.desc)}</h3><span class="small muted">Bấm vào một ô để xem chi tiết</span></div><div class="card-b"><div class="plan">${plan}</div></div></div>
      <div class="card detail" style="position:sticky;top:70px"><div class="card-b" style="padding-top:16px">${st ? A.stallPanel(st) : '<div class="empty">Chọn một điểm kinh doanh trên sơ đồ để xem tiểu thương, hợp đồng và công nợ.</div>'}</div></div>
    </div>
    <div class="note info">${U.esc(m.priceNote)}.</div>`;
  };

  Object.assign(A.ACT, {
    'plan-market': el => { ui.planMarket = el.dataset.id; ui.sel = null; A.render(); },
    'plan-floor': el => { ui.floor[planMarket()] = el.dataset.id; ui.sel = null; A.render(); },
    legend: el => { ui.hidden[el.dataset.s] = !ui.hidden[el.dataset.s]; A.render(); },
    stall: el => { ui.sel = el.dataset.id; A.render(); },
    'stall-status': el => {
      const st = A.idx.stall.get(el.dataset.id);
      const opts = ['thue', 'ngung', 'tranhchap'].concat(st.traderId ? [] : ['trong']);
      A.modal(A.mHead('Đổi trạng thái điểm ' + st.code) + `<div class="modal-b"><div class="form-grid">
        <div class="field"><label>Trạng thái mới</label><select class="input" id="ss-status">${opts.map(k => `<option value="${k}" ${st.status === k ? 'selected' : ''}>${D.STATUS[k].label}</option>`).join('')}</select></div>
        <div class="field"><label>Lý do</label><input class="input" id="ss-reason" placeholder="VD: tiểu thương xin tạm nghỉ 1 tháng"></div></div>
        <div class="small muted" style="margin-top:10px">Trạng thái "Nợ phí" do hệ thống tự xác định theo công nợ quá hạn.</div></div>
        <div class="modal-f"><button class="btn" data-act="close">Hủy</button><button class="btn primary" data-act="stall-status-save" data-id="${st.id}">Lưu</button></div>`);
    },
    'stall-status-save': el => {
      const st = A.idx.stall.get(el.dataset.id);
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
      ${A.PERM.canAction(ui.role, 'phien-cho.chot-phien') ? '<button class="btn primary" data-act="session-open">Điểm danh & chốt phiên 12/09</button>' : ''}</div></div>` : ''}
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
      const booths = A.db.stalls.filter(s => s.market === 'TTD' && s.traderId);
      A.modal(A.mHead('Điểm danh quầy – phiên 12/09/2026') + `<div class="modal-b">
        <div class="form-grid"><div class="field"><label>Lượt khách ước tính</label><input class="input" id="ses-visitors" type="number" value="2750"></div>
        <div class="field"><label>Doanh thu tiểu thương tự khai (triệu đồng)</label><input class="input" id="ses-rev" type="number" value="236"></div></div>
        <div class="divider"></div><div class="small muted" style="margin-bottom:8px">Bỏ chọn quầy vắng mặt:</div>
        <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(190px,1fr));gap:6px">${booths.map(s => `<label class="small"><input type="checkbox" class="ses-b" value="${s.id}" ${s.status === 'thue' ? 'checked' : ''}> ${s.code} · ${U.esc(A.idx.trader.get(s.traderId).name)}</label>`).join('')}</div></div>
        <div class="modal-f"><button class="btn" data-act="close">Hủy</button><button class="btn primary" data-act="session-save">Chốt phiên</button></div>`, true);
    },
    'session-save': () => {
      const n = document.querySelectorAll('.ses-b:checked').length;
      A.db.sessions.push({ date: '2026-09-12', booths: n, fee: n * D.SESSION_FEE, visitors: Number(A.$('#ses-visitors').value) || 0, revenue: (Number(A.$('#ses-rev').value) || 0) * 1e6, noncash: 0.41 });
      U.log(`Chốt phiên chợ quê 12/09/2026: ${n} quầy`);
      A.save(); A.closeModal(); A.render(); U.toast(`Đã chốt phiên 12/09: ${n} quầy, phí phiên ${U.money(n * D.SESSION_FEE)}`);
    }
  });
})(window.APP);

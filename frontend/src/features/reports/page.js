/* Statistical reports (Phase 15.11, from js/v-vanhanh.js): route bao-cao — cross-market report
 * tables, KPIs, charts, CSV export, plus the state report forms of state-forms.js. Read-only. */
(function (A) {
  'use strict';
  const U = A.U, ui = A.ui;
  const isOpen = i => A.features.complaints.isOpen(i);
  const late = i => A.features.complaints.late(i);
  // ---------- Báo cáo ----------
  // xmMkt: A.xmMarket() — 'CL'/'TTD' cụ thể hoặc 'ALL' (gộp trong phạm vi account, xem core.js).
  // Báo cáo thống kê là màn cross-market nên dùng xmMkt thay vì selectedMarket (ui.market) toàn
  // cục để lọc dữ liệu theo chợ.
  function reports(xmMkt) {
    const db = A.db, stalls = db.stalls.filter(x => U.inScope(x, xmMkt)), inv = db.invoices.filter(x => U.inScope(x, xmMkt)), pays = db.payments.filter(x => U.inScope(x, xmMkt));
    const secs = [];
    // Nhóm theo Dãy (graph mặt bằng v16); tình trạng lấy từ trạng thái hiển thị suy ra (hợp đồng/khoản thu).
    stalls.forEach(s => { if (!secs.find(x => x.key === s.rowId)) secs.push({ key: s.rowId, name: s.sectionName, m: s.market }); });
    const periods = db.issuedPeriods.filter(p => p <= '2026-09');
    return {
      lapday: { t: 'Tình trạng lấp đầy điểm kinh doanh', cols: ['Chợ', 'Dãy', 'Tổng', 'Đang thuê', 'Nợ phí', 'Tạm ngừng', 'Tranh chấp', 'Còn trống', 'Lấp đầy %'],
        rows: secs.map(sc => { const xs = stalls.filter(s => s.rowId === sc.key), st = xs.map(s => A.pointDisplayStatus(s)), c = k => st.filter(x => x === k).length; return [U.mShort(sc.m), sc.name, xs.length, c('thue'), c('no'), c('ngung'), c('tranhchap'), c('trong'), U.pct(xs.length - c('trong'), xs.length)]; }) },
      biendong: { t: 'Biến động tiểu thương', cols: ['Tháng', 'Đăng ký mới', 'Chấm dứt', 'Cuối kỳ'],
        rows: (() => { let total = db.traders.filter(x => U.inScope(x, xmMkt)).length; const out = []; for (let k = 0; k < 6; k++) { const nw = 2 + (k * 7) % 5, lv = 1 + (k * 3) % 3; out.unshift(['0' + (9 - k) + '/2026', nw, lv, total]); total = total - nw + lv; } return out; })() },
      hethan: { t: 'Hợp đồng sắp hết hạn (60 ngày)', cols: ['Số hợp đồng', 'Tiểu thương', 'Điểm KD', 'Ngày hết hạn', 'Còn lại (ngày)'],
        rows: db.contracts.filter(c => U.inScope(c, xmMkt) && c.status === 'hieuluc' && U.days(U.today(), c.end) <= 60).sort((a, b) => a.end.localeCompare(b.end)).map(c => [c.id, A.idx.trader.get(c.traderId).name, A.idx.stall.get(c.stallId).code, U.dmy(c.end), U.days(U.today(), c.end)]) },
      doanhthu: { t: 'Doanh thu theo kỳ', cols: ['Kỳ', 'Số khoản', 'Phải thu (đ)', 'Đã thu (đ)', 'Tỷ lệ thu %'],
        rows: periods.map(p => { const xs = inv.filter(i => i.period === p), a = U.sum(xs, i => i.amount), b = U.sum(xs, i => i.paid); return [U.per(p), xs.length, a, b, U.pct(b, a)]; }), chart: 'doanhthu' },
      congno: { t: 'Công nợ theo dãy', cols: ['Chợ', 'Dãy', 'Số tiểu thương nợ', 'Nợ quá hạn (đ)', 'Nợ chưa đến hạn (đ)'],
        rows: secs.map(sc => { const xs = inv.filter(i => i.status !== 'paid' && A.idx.stall.get(i.stallId).rowId === sc.key); return [U.mShort(sc.m), sc.name, new Set(xs.filter(U.isOver).map(i => i.traderId)).size, U.sum(xs.filter(U.isOver), U.due), U.sum(xs.filter(i => !U.isOver(i)), U.due)]; }) },
      khongtienmat: { t: 'Tỷ lệ thanh toán không dùng tiền mặt', cols: ['Kỳ', 'Tiền mặt (đ)', 'Quét QR (đ)', 'Chuyển khoản (đ)', 'Không tiền mặt %'],
        // BAO_CAO_THONG_KE_RECOVERY: thanh toán từ Mini App (phiên chợ quê) có invoiceId: null (không
        // gắn kỳ phải thu chính thức) — cùng nguyên nhân đã sửa ở revenueSeries() trong v-dieuhanh.js,
        // ở đây cần guard riêng vì reports() là hàm khác. Payment không có kỳ hợp lệ bị loại khỏi bảng theo kỳ.
        rows: periods.map(p => { const xs = pays.filter(x => x.invoiceId && A.idx.invoice.get(x.invoiceId) && A.idx.invoice.get(x.invoiceId).period === p), s = m => U.sum(xs.filter(x => x.method === m), x => x.amount), tot = U.sum(xs, x => x.amount); return [U.per(p), s('tm'), s('qr'), s('ck'), U.pct(s('qr') + s('ck'), tot)]; }), chart: 'khongtienmat' },
      doisoat: { t: 'Đối soát ngày ' + U.dmy(U.today()), cols: ['Giờ', 'Mã sao kê', 'Nội dung', 'Số tiền (đ)', 'Trạng thái'],
        rows: db.bank.map(b => [b.time, b.id, b.ref, b.amount, b.matched ? 'Đã khớp' : 'Chưa khớp']) },
      suco: { t: 'Tình hình xử lý phản ánh, sự cố', cols: ['Nhóm', 'Tổng', 'Đã xong', 'Đang xử lý', 'Quá hạn', 'Đánh giá TB'],
        rows: Array.from(new Set(db.incidents.map(i => i.cat))).map(c => { const xs = db.incidents.filter(i => U.inScope(i, xmMkt) && i.cat === c), r = xs.filter(i => i.rating); return [c, xs.length, xs.filter(i => !isOpen(i)).length, xs.filter(isOpen).length, xs.filter(late).length, r.length ? (U.sum(r, i => i.rating) / r.length).toFixed(1) : '–']; }) },
      nhanvien: { t: 'Số thu theo nhân viên (kỳ 09/2026)', cols: ['Người thu', 'Số biên lai', 'Số tiền (đ)'],
        rows: (() => { const m = {}; pays.filter(p => p.date.startsWith('2026-09')).forEach(p => { const k = p.by === 'Hệ thống' || p.by === 'Mini app' ? 'Thanh toán trực tuyến (tự động)' : U.staffName(p.by); m[k] = m[k] || [0, 0]; m[k][0]++; m[k][1] += p.amount; }); return Object.keys(m).map(k => [k, m[k][0], m[k][1]]); })() },
      miengiam: { t: 'Miễn giảm, điều chỉnh', cols: ['Khoản', 'Tiểu thương', 'Kỳ', 'Mức %', 'Số tiền giảm (đ)', 'Lý do'],
        rows: [['PT-202609-00412', 'Lê Thị Kim Hoa', '09/2026', 50, 180000, 'Sửa chữa mái che khu thủy hải sản']].concat(inv.filter(i => i.adjust).map(i => [i.id, A.idx.trader.get(i.traderId).name, U.per(i.period), i.adjust.pct, i.adjust.value, i.adjust.reason])) },
      miniapp: { t: 'Mức độ sử dụng mini app', cols: ['Chợ', 'Ngành hàng', 'Tiểu thương', 'Đã cài', 'Tỷ lệ %'],
        rows: (() => { const m = {}; db.traders.filter(x => U.inScope(x, xmMkt)).forEach(t => { const k = t.market + '|' + t.cat; m[k] = m[k] || [0, 0]; m[k][0]++; if (t.app) m[k][1]++; }); return Object.keys(m).map(k => [U.mShort(k.split('|')[0]), k.split('|')[1], m[k][0], m[k][1], U.pct(m[k][1], m[k][0])]); })() }
    };
  }
  const fmtCell = (v, col) => typeof v === 'number' ? (/%/.test(col) ? U.pctTxt(v) : /\(đ\)/.test(col) ? U.money(v) : v.toLocaleString('vi-VN')) : U.esc(v);
  // Trình bày báo cáo theo bố cục của hệ thống điều hành phường (IOC): danh sách mẫu báo cáo → cấu
  // hình → khung xem trước (cơ quan, tiêu đề, kỳ; 4 ô chỉ số; biểu đồ tổng hợp; bảng dữ liệu tổng hợp).
  // Chỉ là lớp hiển thị — số liệu vẫn lấy nguyên từ reports().
  const RP_SUB = { lapday: 'Tình trạng từng khu vực, tỷ lệ lấp đầy', biendong: 'Đăng ký mới, chấm dứt theo tháng', hethan: 'Hợp đồng cần gia hạn trong 60 ngày', doanhthu: 'Phải thu, đã thu, tỷ lệ thu theo kỳ', congno: 'Nợ quá hạn, chưa đến hạn theo khu vực', khongtienmat: 'Tiền mặt, QR, chuyển khoản theo kỳ', doisoat: 'Sao kê ngân hàng và kết quả khớp', suco: 'Phản ánh, sự cố và kết quả xử lý', nhanvien: 'Biên lai và số tiền theo người thu', miengiam: 'Các khoản được miễn giảm, điều chỉnh', miniapp: 'Tiểu thương đã cài mini app theo ngành hàng' };
  const RP_NOTOTAL = /Cuối kỳ|Còn lại|Đánh giá|Mức|Giờ|Ngày|Tháng|Kỳ/i;
  const RP_PCT = {
    lapday: rows => { const t = U.sum(rows, r => r[2]), e = U.sum(rows, r => r[7]); return U.pct(t - e, t); },
    doanhthu: rows => U.pct(U.sum(rows, r => r[3]), U.sum(rows, r => r[2])),
    khongtienmat: rows => { const tm = U.sum(rows, r => r[1]), qr = U.sum(rows, r => r[2]), ck = U.sum(rows, r => r[3]); return U.pct(qr + ck, tm + qr + ck); },
    miniapp: rows => U.pct(U.sum(rows, r => r[3]), U.sum(rows, r => r[2]))
  };
  function rpTotals(key, r) {
    if (!r.rows.length) return null;
    const cells = r.cols.map((c, k) => {
      if (k === 0) return 'Tổng cộng';
      if (!r.rows.every(row => typeof row[k] === 'number')) return '';
      if (/%/.test(c)) return RP_PCT[key] ? RP_PCT[key](r.rows) : '';
      if (RP_NOTOTAL.test(c)) return '';
      return U.sum(r.rows, row => row[k]);
    });
    return cells.slice(1).every(v => v === '') ? null : cells;
  }
  // 4 ô chỉ số của từng báo cáo, tính từ rows
  const num = v => Math.round(v || 0).toLocaleString('vi-VN');
  function rpKpis(key, rows) {
    const S = k => U.sum(rows, r => r[k]), n = rows.length, last = rows[n - 1] || [];
    switch (key) {
      case 'lapday': return [['Tổng điểm KD', num(S(2))], ['Đang thuê', num(S(3))], ['Còn trống', num(S(7))], ['Lấp đầy', U.pctTxt(RP_PCT.lapday(rows))]];
      case 'biendong': return [['Đăng ký mới', num(S(1))], ['Chấm dứt', num(S(2))], ['Tiểu thương cuối kỳ', num(last[3] || 0)], ['Biến động ròng', (S(1) - S(2) >= 0 ? '+' : '') + num(S(1) - S(2))]];
      case 'hethan': return [['Hợp đồng sắp hết hạn', num(n)], ['Trong 30 ngày', num(rows.filter(r => r[4] <= 30).length)], ['Từ 31–60 ngày', num(rows.filter(r => r[4] > 30).length)], ['Gần nhất', n ? rows[0][4] + ' ngày' : '—']];
      case 'doanhthu': return [['Phải thu', U.moneyShort(S(2))], ['Đã thu', U.moneyShort(S(3))], ['Tỷ lệ thu', U.pctTxt(RP_PCT.doanhthu(rows))], ['Còn phải thu', U.moneyShort(S(2) - S(3))]];
      case 'congno': return [['Tiểu thương nợ', num(S(2))], ['Nợ quá hạn', U.moneyShort(S(3))], ['Nợ chưa đến hạn', U.moneyShort(S(4))], ['Tổng công nợ', U.moneyShort(S(3) + S(4))]];
      case 'khongtienmat': return [['Tiền mặt', U.moneyShort(S(1))], ['Quét QR', U.moneyShort(S(2))], ['Chuyển khoản', U.moneyShort(S(3))], ['Không tiền mặt', U.pctTxt(RP_PCT.khongtienmat(rows))]];
      case 'doisoat': return [['Giao dịch sao kê', num(n)], ['Đã khớp', num(rows.filter(r => r[4] === 'Đã khớp').length)], ['Chưa khớp', num(rows.filter(r => r[4] !== 'Đã khớp').length)], ['Tổng tiền', U.moneyShort(S(3))]];
      case 'suco': return [['Tổng phản ánh', num(S(1))], ['Đã xử lý xong', num(S(2))], ['Đang xử lý', num(S(3))], ['Quá hạn', num(S(4))]];
      case 'nhanvien': return [['Người thu', num(n)], ['Số biên lai', num(S(1))], ['Số tiền', U.moneyShort(S(2))], ['Bình quân / biên lai', U.moneyShort(S(1) ? S(2) / S(1) : 0)]];
      case 'miengiam': return [['Khoản miễn giảm', num(n)], ['Tổng tiền giảm', U.moneyShort(S(4))], ['Mức giảm bình quân', n ? U.pctTxt(S(3) / n) : '—'], ['Tiểu thương', num(new Set(rows.map(r => r[1])).size)]];
      case 'miniapp': return [['Tiểu thương', num(S(2))], ['Đã cài mini app', num(S(3))], ['Tỷ lệ', U.pctTxt(RP_PCT.miniapp(rows))], ['Chưa cài', num(S(2) - S(3))]];
    }
    return [];
  }
  // Biểu đồ tổng hợp: [cột nhãn, cột giá trị, kiểu] cho các báo cáo chưa có biểu đồ riêng
  const RP_CHART = { lapday: [1, 8, '%'], biendong: [0, 3, 'n'], congno: [1, 3, 'đ'], suco: [0, 1, 'n'], nhanvien: [0, 2, 'đ'], miniapp: [1, 4, '%'], hethan: null, doisoat: null, miengiam: null };
  // Biểu đồ cột ngang: nhãn dài đặt bên trái, không chồng chữ khi có nhiều dòng
  function hbars(labels, values, o) {
    const W = 660, L = 230, R = 70, rowH = 26, H = labels.length * rowH + 16;
    const max = o.max || (Math.max.apply(null, values.concat([1])) * 1.05);
    const pw = W - L - R;
    let g = '';
    labels.forEach((lb, i) => {
      const y = 8 + i * rowH, w = Math.max(0, pw * (values[i] || 0) / max);
      const txt = lb.length > 34 ? lb.slice(0, 33) + '…' : lb;
      g += `<text x="${L - 8}" y="${y + 17}" text-anchor="end" font-size="11.5" fill="#2a3a52"><title>${U.esc(lb)}</title>${U.esc(txt)}</text><rect x="${L}" y="${y + 5}" width="${w}" height="16" rx="3" fill="#0961bb"><title>${U.esc(lb)}: ${o.fmt(values[i])}</title></rect><text x="${L + w + 6}" y="${y + 17}" font-size="11.5" fill="#0f1e32" font-weight="600">${o.fmt(values[i])}</text>`;
    });
    return `<div class="chart"><svg viewBox="0 0 ${W} ${H}" style="max-height:${H}px">${g}</svg><div class="chart-legend"><span><i style="background:#0961bb"></i>${U.esc(o.name)}</span></div></div>`;
  }
  A.VIEWS['bao-cao'] = function () {
    // Báo cáo thống kê = màn cross-market (A.SCREEN_MARKET['bao-cao'] === 'CROSS') — không bị chặn
    // bởi selectedMarket. MARKET_SELECTOR_ALL_UNIFICATION: A.xmMarket() giờ đọc thẳng ui.market —
    // dropdown "Chợ" trên thanh top (có "Tất cả" cho account GLOBAL) là nơi DUY NHẤT chọn phạm vi
    // báo cáo, không còn field "Chợ" riêng trong Cấu hình báo cáo (tránh 2 điều khiển cùng 1 state).
    const xmMkt = A.xmMarket();
    const R = reports(xmMkt), SF = A.STATE_FORMS || {}, stateKey = SF[ui.report] ? ui.report : null, key = stateKey ? 'lapday' : (R[ui.report] ? ui.report : 'lapday'), r = R[key];
    const rp = ui.rp || (ui.rp = { from: '2026-09-01', to: U.today() });
    let chart = '';
    if (r.chart === 'doanhthu') chart = U.bars(r.rows.map(x => x[0]), [{ name: 'Phải thu', values: r.rows.map(x => x[2]), color: '#bcd6f5' }, { name: 'Đã thu', values: r.rows.map(x => x[3]), color: '#0961bb' }], { stacked: false });
    else if (r.chart === 'khongtienmat') chart = U.bars(r.rows.map(x => x[0]), [{ name: 'Không tiền mặt %', values: r.rows.map(x => x[4]), color: '#0961bb' }], { stacked: false, max: 100, fmt: v => Math.round(v) + '%' });
    else if (RP_CHART[key] && r.rows.length) { const [lc, vc, kind] = RP_CHART[key]; const fmt = kind === '%' ? v => Math.round(v) + '%' : kind === 'đ' ? U.moneyShort : v => num(v); const labels = r.rows.map(x => (key === 'lapday' || key === 'congno' ? x[0].replace('Chợ quê Tân Thuận Đông', 'Chợ quê').replace('Chợ Cao Lãnh', 'CL') + ' · ' : '') + String(x[lc]).replace(/^Khu /, '')); chart = key === 'biendong' ? U.bars(labels, [{ name: r.cols[vc], values: r.rows.map(x => x[vc]), color: '#0961bb' }], { stacked: false, fmt }) : hbars(labels, r.rows.map(x => x[vc]), { name: r.cols[vc].replace(/ (đ)/, ''), max: kind === '%' ? 100 : null, fmt }); }
    const hasMoney = r.cols.some(c => /\(đ\)/.test(c));
    const cols = r.cols.map(c => c.replace(/ \(đ\)/, ''));
    const numCol = k => k > 0 && typeof (r.rows[0] || [])[k] === 'number';
    const tot = rpTotals(key, r);
    const kpis = rpKpis(key, r.rows);
    const scopeName = xmMkt === 'ALL' ? A.allowedMarkets(A.currentAccount()).map(U.mShort).join(', ') : U.market(xmMkt).name;
    const who = A.currentAccount ? A.currentAccount() : null;
    return `<div class="rp-page-h"><h2>Báo cáo thống kê</h2><div class="muted">Tạo, xem trước và xuất các báo cáo quản lý chợ</div></div>
    <div class="grid g-report rp-grid">
      <div class="card no-print"><div class="card-h"><h3>Mẫu báo cáo</h3></div><div class="card-b rp-list"><div class="rp-group">Báo cáo theo mẫu Nhà nước</div>${(A.STATE_FORM_ORDER || []).map(k => `<button class="rp-item ${stateKey === k ? 'on' : ''}" data-act="rp" data-id="${k}"><span class="rp-ico">🏛️</span><span><b>${SF[k].mau} – ${SF[k].t}</b><small>${SF[k].vb} · ${SF[k].ky}</small></span></button>`).join('')}<div class="rp-group">Báo cáo điều hành</div>${Object.keys(R).map(k => `<button class="rp-item ${!stateKey && key === k ? 'on' : ''}" data-act="rp" data-id="${k}"><span class="rp-ico">📄</span><span><b>${R[k].t}</b><small>${RP_SUB[k] || ''}</small></span></button>`).join('')}</div></div>
      <div class="rp-right">
        <div class="card no-print"><div class="card-h"><h3>Cấu hình báo cáo</h3></div><div class="card-b rp-cfg">
          <div class="field"><label>Từ ngày</label><input type="date" class="input" data-ch="rp-cfg" data-k="from" value="${rp.from}"></div>
          <div class="field"><label>Đến ngày</label><input type="date" class="input" data-ch="rp-cfg" data-k="to" value="${rp.to}"></div>
          <div class="field"><label>Chợ</label><input class="input" value="${U.esc(scopeName)}" disabled title="Đổi phạm vi ở dropdown &quot;Chợ&quot; trên thanh top"></div>
          <div class="field"><label>Đơn vị lập</label><select class="input"><option>Ban Quản lý chợ</option><option>UBND phường Cao Lãnh</option></select></div>
        </div></div>
        <div class="card rp-card"><div class="card-h no-print"><h3>👁 Xem trước: ${U.esc(stateKey ? SF[stateKey].mau + ' – ' + SF[stateKey].t : r.t)}</h3><span class="spacer"></span><button class="btn" data-act="print">⬇ Xuất PDF</button><button class="btn" data-act="rp-csv">📊 Excel</button><button class="btn" data-act="print">🖨 In</button><button class="btn" data-act="rp-save">💾 Lưu mẫu</button></div>
          <div class="card-b">${stateKey ? A.stateFormHtml(stateKey, xmMkt) : `<div class="rp-preview">
            <div class="rp-org">UBND PHƯỜNG CAO LÃNH · BAN QUẢN LÝ CHỢ</div>
            <h2 class="rp-title">${U.esc(r.t.toUpperCase())}</h2>
            <div class="rp-period">Kỳ báo cáo: ${U.dmy(rp.from)} – ${U.dmy(rp.to)} · Phạm vi: ${U.esc(scopeName)}${hasMoney ? ' · Đơn vị tính: đồng' : ''}</div>
            <div class="rp-kpis">${kpis.map(k => `<div class="rp-kpi"><div class="l">${k[0]}</div><div class="v">${k[1]}</div></div>`).join('')}</div>
            ${chart ? `<div class="rp-block"><div class="rp-block-h">📊 Biểu đồ tổng hợp</div>${chart}</div>` : ''}
            <div class="rp-block"><div class="rp-block-h">📋 Bảng dữ liệu tổng hợp</div>
              <div class="tbl-wrap"><table class="tbl rp-tbl"><thead><tr><th class="num rp-stt">STT</th>${cols.map((c, k) => `<th class="${numCol(k) ? 'num' : ''}">${U.esc(c)}</th>`).join('')}</tr></thead>
              <tbody>${r.rows.length ? r.rows.map((row, i) => `<tr><td class="num rp-stt">${i + 1}</td>${row.map((v, k) => `<td class="${typeof v === 'number' ? 'num' : ''} ${k === 0 ? 'rp-first' : ''}">${fmtCell(v, r.cols[k])}</td>`).join('')}</tr>`).join('') : `<tr><td colspan="${cols.length + 1}" class="empty">Không có dữ liệu trong phạm vi đã chọn</td></tr>`}</tbody>
              ${tot ? `<tfoot><tr class="rp-total"><td></td>${tot.map((v, k) => `<td class="${typeof v === 'number' ? 'num' : ''}">${v === '' ? '' : fmtCell(v, r.cols[k])}</td>`).join('')}</tr></tfoot>` : ''}</table></div></div>
            <div class="rp-sign print-only"><div><div class="rp-sign-t">NGƯỜI LẬP BIỂU</div><div class="rp-sign-s">(Ký, ghi rõ họ tên)</div><div class="rp-sign-n">${U.esc(who && ['market_manager', 'collector'].indexOf(A.ACCOUNTS.primaryRole(who)) !== -1 ? who.fullName : 'Lê Thị Ngọc Hân')}</div></div><div><div class="rp-sign-t">TRƯỞNG BAN QUẢN LÝ CHỢ</div><div class="rp-sign-s">(Ký, đóng dấu)</div><div class="rp-sign-n">Trần Minh Khoa</div></div></div>
            <div class="small muted rp-note">Số liệu sinh tự động từ dữ liệu nghiệp vụ của hệ thống lúc ${U.nowTime()} ngày ${U.dmy(U.today())}.</div>
          </div>`}</div></div>
      </div></div>`;
  };
  A.CH['rp-cfg'] = el => { ui.rp[el.dataset.k] = el.value; A.render(); };
  A.ACT['rp-save'] = () => U.toast('Đã lưu mẫu báo cáo (mô phỏng)');
  A.ACT.rp = el => { ui.report = el.dataset.id; A.render(); };
  A.ACT['rp-csv'] = () => { if (A.STATE_FORMS && A.STATE_FORMS[ui.report]) { A.stateFormCsv(ui.report, A.xmMarket()); return; } const R = reports(A.xmMarket()), r = R[ui.report] || R.lapday; U.csv('bao-cao-' + (R[ui.report] ? ui.report : 'lapday'), r.cols, r.rows); };
})(window.APP);

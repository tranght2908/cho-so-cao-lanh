/* Màn hình vận hành: Phản ánh & sự cố, Thông báo, Báo cáo, Cài đặt. */
(function (A) {
  'use strict';
  const D = A.D, U = A.U, ui = A.ui;
  const ST = D.INCIDENT_STATES;
  const stLabel = id => ST.find(s => s.id === id).label;
  const isOpen = i => i.state !== 'hoanthanh' && i.state !== 'dong';
  const late = i => isOpen(i) && i.deadline < U.today();
  if (!ui.permRole) ui.permRole = 'market_manager'; // RBAC V1: 'bql' cũ đã bị thay bằng 8 role mới
  if (!ui.settingsTab) ui.settingsTab = 'vaitro';
  if (!ui.cfgTab) ui.cfgTab = 'gia';
  if (!ui.acc) ui.acc = { search: '', type: '', role: '', market: '', status: '' };

  // ---------- Phản ánh & sự cố ----------
  A.VIEWS['su-co'] = function () {
    const all = A.db.incidents.filter(i => U.inM(i) && (!ui.incCat || i.cat === ui.incCat));
    const cats = Array.from(new Set(A.db.incidents.map(i => i.cat)));
    const done = A.db.incidents.filter(i => U.inM(i) && i.rating);
    return `<div class="kpis">
      <div class="card kpi"><div class="k-label">Đang xử lý</div><div class="k-value">${all.filter(isOpen).length}</div><div class="k-sub">trên tổng ${all.length} phản ánh</div></div>
      <div class="card kpi"><div class="k-label">Quá hạn</div><div class="k-value" style="color:#d6453b">${all.filter(late).length}</div><div class="k-sub">Điện, PCCC: 24 giờ · khác: 3 ngày</div></div>
      <div class="card kpi"><div class="k-label">Vượt cấp lên phường</div><div class="k-value">${all.filter(i => i.escalated).length}</div><div class="k-sub">Lãnh đạo phường theo dõi</div></div>
      <div class="card kpi"><div class="k-label">Hài lòng của tiểu thương</div><div class="k-value">${done.length ? (U.sum(done, i => i.rating) / done.length).toFixed(1) : '–'}/5</div><div class="k-sub">${done.length} lượt đánh giá</div></div></div>
    <div class="card"><div class="card-h"><h3>Bảng theo dõi xử lý (6 trạng thái)</h3>
      <select class="input" data-ch="inc-cat"><option value="">Mọi nhóm</option>${cats.map(c => `<option ${ui.incCat === c ? 'selected' : ''}>${c}</option>`).join('')}</select>
      ${A.canDo('su-co.tao-phan-anh', ui.market) ? '<button class="btn primary" data-act="inc-new">+ Tạo phản ánh</button>' : ''}</div>
      <div class="card-b"><div class="kanban">${ST.map(s => {
        const xs = all.filter(i => i.state === s.id);
        return `<div class="kcol"><h4>${s.label}<span class="muted">${xs.length}</span></h4>${xs.map(i => `<div class="kcard ${late(i) ? 'late' : ''}" data-act="inc-open" data-id="${i.id}">
          <div class="row small"><span class="muted">${i.id}</span>${i.escalated ? '<span class="tag purple">Vượt cấp</span>' : ''}${late(i) ? '<span class="tag danger">Quá hạn</span>' : ''}</div>
          <div class="t">${U.esc(i.title)}</div><div class="small muted">${i.cat} · ${A.idx.stall.get(i.stallId).code} · ${U.mShort(i.market)}</div>
          <div class="small muted">${i.source === 'Mini app tiểu thương' ? '📱' : '🖥'} ${U.dmy(i.created)}${i.assignee ? ' · ' + U.esc(U.staffName(i.assignee)) : ''}</div></div>`).join('')}</div>`;
      }).join('')}</div></div></div>`;
  };
  A.CH['inc-cat'] = el => { ui.incCat = el.value; A.render(); };
  A.ACT['inc-open'] = el => {
    const i = A.db.incidents.find(x => x.id === el.dataset.id), t = A.idx.trader.get(i.traderId);
    const idx = ST.findIndex(s => s.id === i.state), next = ST[idx + 1];
    const canPhanCong = A.canDo('su-co.phan-cong', i.market);
    const canVuotCap = A.canDo('su-co.vuot-cap', i.market);
    const canChiDao = A.canDo('su-co.chi-dao', i.market);
    const canChuyenTT = A.canDo('su-co.chuyen-trang-thai', i.market);
    A.modal(A.mHead(i.id + ' · ' + U.esc(i.title)) + `<div class="modal-b">
      <dl class="kv"><dt>Trạng thái</dt><dd><span class="tag info">${stLabel(i.state)}</span> ${late(i) ? '<span class="tag danger">Quá hạn</span>' : ''} ${i.escalated ? '<span class="tag purple">Vượt cấp</span>' : ''}</dd>
        <dt>Nhóm</dt><dd>${i.cat}</dd><dt>Nguồn</dt><dd>${i.source}</dd>
        <dt>Tiểu thương</dt><dd>${U.esc(t ? t.name : '')} · ${A.idx.stall.get(i.stallId).code} · ${U.mShort(i.market)}</dd>
        <dt>Tiếp nhận / hạn</dt><dd>${U.dmy(i.created)} · hạn ${U.dmy(i.deadline)}</dd>
        ${i.desc ? `<dt>Nội dung</dt><dd>${U.esc(i.desc)}</dd>` : ''}${i.photo ? '<dt>Ảnh</dt><dd><span class="tag info">📷 1 ảnh đính kèm</span></dd>' : ''}
        <dt>Người xử lý</dt><dd>${canPhanCong ? `<select class="input" data-ch="inc-assign" data-id="${i.id}"><option value="">– Chưa phân công –</option>${D.STAFF.filter(s => s.market === i.market).map(s => `<option value="${s.id}" ${i.assignee === s.id ? 'selected' : ''}>${s.name} (${s.role})</option>`).join('')}</select>` : U.esc(U.staffName(i.assignee) || 'Chưa phân công')}</dd>
        ${i.rating ? `<dt>Đánh giá</dt><dd>${'★'.repeat(i.rating)}${'☆'.repeat(5 - i.rating)}</dd>` : ''}</dl>
      <div class="divider"></div><b class="small">Nhật ký xử lý</b>${i.log.map(l => `<div class="small"><span class="muted">${U.dmy(l.at)}</span> · ${U.esc(l.text)}</div>`).join('')}
      ${canChiDao && i.escalated ? '<div class="field" style="margin-top:12px"><label>Ý kiến chỉ đạo của lãnh đạo phường</label><textarea class="input" id="inc-cmt" rows="2" placeholder="VD: Giao BQL phối hợp Công an phường xử lý trong 2 ngày"></textarea></div>' : ''}
      </div><div class="modal-f">
      ${canVuotCap && !i.escalated && isOpen(i) ? `<button class="btn" data-act="inc-escalate" data-id="${i.id}">Chuyển vượt cấp lên phường</button>` : ''}
      ${canChiDao && i.escalated ? `<button class="btn primary" data-act="inc-comment" data-id="${i.id}">Gửi ý kiến chỉ đạo</button>` : ''}
      ${canChuyenTT && next ? `<button class="btn primary" data-act="inc-next" data-id="${i.id}">Chuyển sang: ${next.label} →</button>` : ''}
      <button class="btn" data-act="close">Đóng</button></div>`, true);
  };
  function incLog(i, text) { i.log.push({ at: U.today(), text }); A.save(); }
  A.CH['inc-assign'] = el => {
    const i = A.db.incidents.find(x => x.id === el.dataset.id);
    if (!i || !A.canDo('su-co.phan-cong', i.market)) { A.render(); return; }
    i.assignee = el.value || null;
    if (i.assignee && i.state === 'tiepnhan') i.state = 'phancong';
    incLog(i, 'Phân công ' + U.staffName(i.assignee));
    A.render(); A.ACT['inc-open']({ dataset: { id: i.id } });
    U.toast('Đã phân công, thông báo gửi tới ' + U.staffName(i.assignee));
  };
  A.ACT['inc-next'] = el => {
    const i = A.db.incidents.find(x => x.id === el.dataset.id);
    if (!i || !A.canDo('su-co.chuyen-trang-thai', i.market)) return;
    const n = ST[ST.findIndex(s => s.id === i.state) + 1];
    if (!n) return;
    if (n.id === 'phancong' && !i.assignee) i.assignee = i.market === 'TTD' ? 'NV06' : 'NV05';
    i.state = n.id; incLog(i, 'Chuyển trạng thái: ' + n.label);
    A.render(); A.ACT['inc-open']({ dataset: { id: i.id } });
    if (n.id === 'hoanthanh') U.toast('Đã hoàn thành – tiểu thương nhận thông báo và được mời đánh giá');
  };
  A.ACT['inc-escalate'] = el => {
    const i = A.db.incidents.find(x => x.id === el.dataset.id);
    if (!i || !A.canDo('su-co.vuot-cap', i.market) || i.escalated || !isOpen(i)) return;
    i.escalated = true; incLog(i, 'Chuyển vượt cấp lên UBND phường');
    A.render(); A.closeModal(); U.toast('Đã chuyển ' + i.id + ' lên cổng giám sát cấp phường');
  };
  A.ACT['inc-comment'] = el => {
    const i = A.db.incidents.find(x => x.id === el.dataset.id);
    if (!i || !A.canDo('su-co.chi-dao', i.market) || !i.escalated) return;
    const txt = (A.$('#inc-cmt').value || '').trim();
    if (!txt) { U.toast('Vui lòng nhập ý kiến chỉ đạo'); return; }
    incLog(i, 'Lãnh đạo phường chỉ đạo: ' + txt);
    A.closeModal(); U.toast('Đã gửi ý kiến chỉ đạo tới Ban Quản lý chợ');
  };
  A.ACT['inc-new'] = () => {
    if (!A.canDo('su-co.tao-phan-anh', ui.market)) return;
    const stalls = A.db.stalls.filter(s => s.traderId && U.inM(s)).slice(0, 200);
    A.modal(A.mHead('Tạo phản ánh / sự cố') + `<div class="modal-b"><div class="form-grid">
      <div class="field"><label>Điểm kinh doanh</label><select class="input" id="in-stall">${stalls.map(s => `<option value="${s.id}">${s.code} · ${U.esc(A.idx.trader.get(s.traderId).name)}</option>`).join('')}</select></div>
      <div class="field"><label>Nhóm</label><select class="input" id="in-cat">${['Điện', 'Cấp thoát nước', 'Vệ sinh', 'An ninh trật tự', 'PCCC', 'Hạ tầng', 'Khác'].map(c => `<option>${c}</option>`).join('')}</select></div></div>
      <div class="field" style="margin-top:12px"><label>Tiêu đề</label><input class="input" id="in-title" placeholder="VD: Đèn lối đi dãy B bị hỏng"></div></div>
      <div class="modal-f"><button class="btn" data-act="close">Hủy</button><button class="btn primary" data-act="inc-new-save">Tạo</button></div>`);
  };
  A.addIncident = function (stallId, cat, title, desc, source, photo) {
    const st = A.idx.stall.get(stallId);
    const created = U.today(), dl = new Date(created); dl.setDate(dl.getDate() + (cat === 'Điện' || cat === 'PCCC' ? 1 : 3));
    const i = { id: 'SC-' + U.pad(101 + A.db.incidents.length, 4), market: st.market, stallId, traderId: st.traderId, cat, title, desc: desc || '', photo: !!photo, state: 'tiepnhan', source, escalated: false, created, deadline: dl.toISOString().slice(0, 10), assignee: null, rating: null, log: [{ at: created, text: 'Tiếp nhận phản ánh từ ' + source }] };
    A.db.incidents.push(i); A.save();
    return i;
  };
  A.ACT['inc-new-save'] = () => {
    if (!A.canDo('su-co.tao-phan-anh', ui.market)) return;
    const title = A.$('#in-title').value.trim();
    if (!title) { U.toast('Vui lòng nhập tiêu đề'); return; }
    const st = A.idx.stall.get(A.$('#in-stall').value);
    if (!st || st.market !== ui.market) { U.toast('Điểm kinh doanh không thuộc chợ đang chọn'); return; }
    const i = A.addIncident(st.id, A.$('#in-cat').value, title, '', 'Nhập tại Ban Quản lý', false);
    A.closeModal(); A.render(); U.toast('Đã tạo ' + i.id);
  };

  // ---------- Thông báo đa kênh ----------
  const cats = () => Array.from(new Set(A.db.stalls.map(s => s.cat)));
  function groupInfo(v) {
    const db = A.db;
    if (v === 'all') return ['Toàn bộ tiểu thương', db.traders.length];
    if (v === 'CL' || v === 'TTD') return [U.market(v).short, db.traders.filter(t => t.market === v).length];
    if (v === 'debt') return ['Danh sách nợ phí', new Set(db.invoices.filter(U.isOver).map(i => i.traderId)).size];
    const c = v.slice(4);
    return ['Ngành hàng: ' + c, db.traders.filter(t => t.cat === c).length];
  }
  A.VIEWS['thong-bao'] = function () {
    const g = ui.tbGroup || 'all', gi = groupInfo(g);
    return `<div class="grid g2" style="align-items:start">
      <div class="card"><div class="card-h"><h3>Soạn thông báo</h3></div><div class="card-b">
        <div class="field"><label>Gửi tới</label><select class="input" data-ch="tb-group">
          <option value="all" ${g === 'all' ? 'selected' : ''}>Toàn bộ tiểu thương</option><option value="CL" ${g === 'CL' ? 'selected' : ''}>Chợ Cao Lãnh</option><option value="TTD" ${g === 'TTD' ? 'selected' : ''}>Chợ quê Tân Thuận Đông</option>
          <option value="debt" ${g === 'debt' ? 'selected' : ''}>Danh sách nợ phí quá hạn</option>${cats().map(c => `<option value="cat:${c}" ${g === 'cat:' + c ? 'selected' : ''}>Ngành hàng: ${c}</option>`).join('')}</select>
          <span class="small muted">${gi[1]} người nhận</span></div>
        <div class="row" style="margin:12px 0">${['Mini app', 'Zalo OA', 'SMS', 'Email'].map((c, k) => `<label class="small"><input type="checkbox" class="tb-ch" value="${c}" ${k < 2 ? 'checked' : ''}> ${c}</label>`).join('')}</div>
        <div class="field"><label>Tiêu đề</label><input class="input" id="tb-title" value="Lịch vệ sinh, khử khuẩn toàn chợ Chủ nhật 20/9"></div>
        <div class="field" style="margin-top:10px"><label>Nội dung</label><textarea class="input" id="tb-content" rows="4">Ban Quản lý chợ thông báo: sáng Chủ nhật 20/9/2026 tổ chức tổng vệ sinh, khử khuẩn. Đề nghị tiểu thương thu dọn hàng hóa trước 6h00.</textarea></div>
        <div class="row" style="margin-top:12px"><span class="spacer"></span>${A.canDo('thong-bao.gui', ui.market) ? '<button class="btn primary" data-act="tb-send">📣 Gửi ngay</button>' : ''}</div></div></div>
      <div class="card"><div class="card-h"><h3>Thông báo tự động theo sự kiện</h3></div><div class="card-b small">
        ${[['Phát hành khoản phải thu', 'Mini app, Zalo OA'], ['Trước hạn nộp 3 ngày', 'Mini app, Zalo OA'], ['Khoản phải thu quá hạn', 'Mini app, Zalo OA, SMS'], ['Hợp đồng còn 30 ngày hết hạn', 'Mini app, Zalo OA'], ['Phản ánh được xử lý xong', 'Mini app'], ['Biên lai điện tử sau khi thanh toán', 'Mini app, Zalo OA']].map(r => `<div class="row" style="padding:7px 0;border-bottom:1px solid #eef2f0"><span class="tag ok">Bật</span><span style="flex:1">${r[0]}</span><span class="muted">${r[1]}</span></div>`).join('')}</div></div></div>
    <div class="card"><div class="card-h"><h3>Lịch sử thông báo</h3></div><div class="card-b">
      ${U.table([{ t: 'Mã' }, { t: 'Ngày' }, { t: 'Tiêu đề' }, { t: 'Đối tượng' }, { t: 'Kênh' }, { t: 'Người nhận', num: true }, { t: 'Đã nhận', num: true }, { t: 'Đã đọc', num: true }, { t: 'Loại' }],
        A.db.notifications.map(n => `<tr><td>${n.id}</td><td>${U.dmy(n.at)}</td><td>${U.esc(n.title)}</td><td>${U.esc(n.group)}</td><td class="small">${n.channels.join(', ')}</td><td class="num">${n.sent}</td><td class="num">${U.pctTxt(n.delivered * 100)}</td><td class="num">${n.read ? U.pctTxt(n.read * 100) : '<span class="muted">đang cập nhật</span>'}</td><td>${n.auto ? '<span class="tag info">Tự động</span>' : '<span class="tag">Thủ công</span>'}</td></tr>`))}</div></div>`;
  };
  A.CH['tb-group'] = el => { ui.tbGroup = el.value; A.render(); };
  A.ACT['tb-send'] = () => {
    if (!A.canDo('thong-bao.gui', ui.market)) return;
    const title = A.$('#tb-title').value.trim(), ch = Array.from(document.querySelectorAll('.tb-ch:checked')).map(x => x.value);
    if (!title || !ch.length) { U.toast('Cần tiêu đề và ít nhất một kênh gửi'); return; }
    const gi = groupInfo(ui.tbGroup || 'all');
    A.db.notifications.unshift({ id: 'TB-' + U.pad(32 + A.db.notifications.length, 3), at: U.today(), title, group: gi[0], channels: ch, sent: gi[1], delivered: 0.96, read: 0, auto: false, body: A.$('#tb-content').value });
    U.log('Gửi thông báo "' + title + '" tới ' + gi[0]);
    A.save(); A.render(); U.toast(`Đã gửi tới ${gi[1]} tiểu thương qua ${ch.join(', ')}`);
  };

  // ---------- Báo cáo ----------
  // xmMkt: A.xmMarket() — 'CL'/'TTD' cụ thể hoặc 'ALL' (gộp trong phạm vi account, xem core.js).
  // Báo cáo thống kê là màn cross-market nên dùng xmMkt thay vì selectedMarket (ui.market) toàn
  // cục để lọc dữ liệu theo chợ.
  function reports(xmMkt) {
    const db = A.db, stalls = db.stalls.filter(x => U.inScope(x, xmMkt)), inv = db.invoices.filter(x => U.inScope(x, xmMkt)), pays = db.payments.filter(x => U.inScope(x, xmMkt));
    const secs = [];
    stalls.forEach(s => { if (!secs.find(x => x.key === s.market + s.section)) secs.push({ key: s.market + s.section, name: s.sectionName, m: s.market }); });
    const periods = db.issuedPeriods.filter(p => p <= '2026-09');
    return {
      lapday: { t: 'Tình trạng lấp đầy điểm kinh doanh', cols: ['Chợ', 'Khu vực', 'Tổng', 'Đang thuê', 'Nợ phí', 'Tạm ngừng', 'Tranh chấp', 'Còn trống', 'Lấp đầy %'],
        rows: secs.map(sc => { const xs = stalls.filter(s => s.market + s.section === sc.key), c = k => xs.filter(s => s.status === k).length; return [U.mShort(sc.m), sc.name, xs.length, c('thue'), c('no'), c('ngung'), c('tranhchap'), c('trong'), U.pct(xs.length - c('trong'), xs.length)]; }) },
      biendong: { t: 'Biến động tiểu thương', cols: ['Tháng', 'Đăng ký mới', 'Chấm dứt', 'Cuối kỳ'],
        rows: (() => { let total = db.traders.filter(x => U.inScope(x, xmMkt)).length; const out = []; for (let k = 0; k < 6; k++) { const nw = 2 + (k * 7) % 5, lv = 1 + (k * 3) % 3; out.unshift(['0' + (9 - k) + '/2026', nw, lv, total]); total = total - nw + lv; } return out; })() },
      hethan: { t: 'Hợp đồng sắp hết hạn (60 ngày)', cols: ['Số hợp đồng', 'Tiểu thương', 'Điểm KD', 'Ngày hết hạn', 'Còn lại (ngày)'],
        rows: db.contracts.filter(c => U.inScope(c, xmMkt) && c.status === 'hieuluc' && U.days(U.today(), c.end) <= 60).sort((a, b) => a.end.localeCompare(b.end)).map(c => [c.id, A.idx.trader.get(c.traderId).name, A.idx.stall.get(c.stallId).code, U.dmy(c.end), U.days(U.today(), c.end)]) },
      doanhthu: { t: 'Doanh thu theo kỳ', cols: ['Kỳ', 'Số khoản', 'Phải thu (đ)', 'Đã thu (đ)', 'Tỷ lệ thu %'],
        rows: periods.map(p => { const xs = inv.filter(i => i.period === p), a = U.sum(xs, i => i.amount), b = U.sum(xs, i => i.paid); return [U.per(p), xs.length, a, b, U.pct(b, a)]; }), chart: 'doanhthu' },
      congno: { t: 'Công nợ theo khu vực', cols: ['Chợ', 'Khu vực', 'Số tiểu thương nợ', 'Nợ quá hạn (đ)', 'Nợ chưa đến hạn (đ)'],
        rows: secs.map(sc => { const xs = inv.filter(i => i.status !== 'paid' && (i.market + A.idx.stall.get(i.stallId).section) === sc.key); return [U.mShort(sc.m), sc.name, new Set(xs.filter(U.isOver).map(i => i.traderId)).size, U.sum(xs.filter(U.isOver), U.due), U.sum(xs.filter(i => !U.isOver(i)), U.due)]; }) },
      khongtienmat: { t: 'Tỷ lệ thanh toán không dùng tiền mặt', cols: ['Kỳ', 'Tiền mặt (đ)', 'Quét QR (đ)', 'Chuyển khoản (đ)', 'Không tiền mặt %'],
        rows: periods.map(p => { const xs = pays.filter(x => A.idx.invoice.get(x.invoiceId).period === p), s = m => U.sum(xs.filter(x => x.method === m), x => x.amount), tot = U.sum(xs, x => x.amount); return [U.per(p), s('tm'), s('qr'), s('ck'), U.pct(s('qr') + s('ck'), tot)]; }), chart: 'khongtienmat' },
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
  A.VIEWS['bao-cao'] = function () {
    // Báo cáo thống kê = màn cross-market (A.SCREEN_MARKET['bao-cao'] === 'CROSS') — dùng bộ lọc
    // nội bộ A.xmMarket()/A.xmScopeBar() thay vì bị chặn/giới hạn theo selectedMarket (mục 9 Phase 2).
    const xmMkt = A.xmMarket();
    const R = reports(xmMkt), r = R[ui.report] || R.lapday;
    let chart = '';
    if (r.chart === 'doanhthu') chart = U.bars(r.rows.map(x => x[0]), [{ name: 'Phải thu', values: r.rows.map(x => x[2]), color: '#b9d8cf' }, { name: 'Đã thu', values: r.rows.map(x => x[3]), color: '#13806b' }], { stacked: false });
    if (r.chart === 'khongtienmat') chart = U.bars(r.rows.map(x => x[0]), [{ name: 'Không tiền mặt %', values: r.rows.map(x => x[4]), color: '#c93d6e' }], { stacked: false, max: 100, fmt: v => Math.round(v) + '%' });
    return `<div class="grid g-report">
      <div class="card no-print"><div class="card-b report-list" style="padding-top:10px">${A.xmScopeBar()}${Object.keys(R).map((k, n) => `<button class="${(R[ui.report] ? ui.report : 'lapday') === k ? 'on' : ''}" data-act="rp" data-id="${k}">${n + 1}. ${R[k].t}</button>`).join('')}</div></div>
      <div class="card"><div class="card-h"><h3>${r.t}</h3><span class="small muted">${xmMkt === 'ALL' ? 'Tất cả chợ' : U.mShort(xmMkt)} · lập ngày ${U.dmy(U.today())}</span>
        <button class="btn no-print" data-act="rp-csv">⬇ Xuất Excel</button><button class="btn no-print" data-act="print">🖨 In / PDF</button></div>
        <div class="card-b">${chart}${U.table(r.cols.map((c, k) => ({ t: c, num: k > 0 && typeof (r.rows[0] || [])[k] === 'number' })), r.rows.map(row => `<tr>${row.map((v, k) => `<td class="${typeof v === 'number' ? 'num' : ''}">${fmtCell(v, r.cols[k])}</td>`).join('')}</tr>`))}
        <div class="small muted" style="margin-top:10px">Báo cáo được sinh tự động từ dữ liệu nghiệp vụ, không tổng hợp thủ công.</div></div></div></div>`;
  };
  A.ACT.rp = el => { ui.report = el.dataset.id; A.render(); };
  A.ACT['rp-csv'] = () => { const R = reports(A.xmMarket()), r = R[ui.report] || R.lapday; U.csv('bao-cao-' + (R[ui.report] ? ui.report : 'lapday'), r.cols, r.rows); };

  // ---------- Tài khoản người dùng ----------
  function accInitials(name) {
    const parts = (name || '').trim().split(/\s+/).filter(Boolean);
    return ((parts[0] || '')[0] || '') + ((parts[parts.length - 1] || '')[0] || '');
  }
  function accScopeLabel(scopes) {
    if (!scopes || !scopes.length) return '—';
    if (scopes.includes('ALL')) return 'Toàn hệ thống';
    return scopes.map(m => U.mShort(m)).join(', ');
  }
  function accRoleBadges(roleIds) {
    return (roleIds || []).map(rid => { const r = A.PERM.role(rid); return `<span class="tag info">${U.esc(r ? r.name : rid)}</span>`; }).join(' ') || '<span class="muted small">Chưa gán</span>';
  }
  function accRows() {
    const f = ui.acc, q = (f.search || '').toLowerCase();
    // Lọc theo A.allowedMarkets() (không phải marketScopes thô) — chỉ có vậy mới lọc đúng cho cả
    // account cũ còn ['ALL'] LẪN account mới ['CL','TTD']/['CL']/['TTD'] (mục 8 yêu cầu Phase 5B).
    return A.ACCOUNTS.list().filter(a =>
      (!f.type || a.accountType === f.type) &&
      (!f.role || (a.roleIds || []).includes(f.role)) &&
      (!f.market || A.allowedMarkets(a).includes(f.market)) &&
      (!f.status || a.status === f.status) &&
      (!q || a.fullName.toLowerCase().includes(q) || a.code.toLowerCase().includes(q) || (a.phone || '').includes(q)));
  }
  function accStats() {
    const all = A.ACCOUNTS.list();
    return {
      total: all.length, active: all.filter(a => a.status === 'active').length,
      disabled: all.filter(a => a.status === 'disabled').length,
      traders: all.filter(a => a.accountType === 'Tiểu thương').length
    };
  }
  function accDrawerHtml(a) {
    const canEdit = A.canDo('tai-khoan.sua');
    return `<div class="drawer-h"><span class="avatar lg">${U.esc(accInitials(a.fullName))}</span>
        <div><h3 style="margin:0;font-size:16px">${U.esc(a.fullName)}</h3><div class="small muted">${U.esc(a.code)} · ${a.status === 'active' ? '<span class="tag ok">Hoạt động</span>' : '<span class="tag danger">Tạm khoá</span>'}</div></div>
        <span class="spacer"></span><button class="x" data-act="close" aria-label="Đóng">×</button></div>
      <div class="drawer-b">
        <dl class="kv">
          <dt>Họ tên</dt><dd>${U.esc(a.fullName)}</dd>
          <dt>Số điện thoại</dt><dd>${a.phone ? U.esc(a.phone) : '<span class="muted">Chưa có</span>'}</dd>
          <dt>Loại tài khoản</dt><dd>${U.esc(a.accountType)}</dd>
          ${a.title ? `<dt>Chức danh</dt><dd>${U.esc(a.title)}</dd>` : ''}
          <dt>Đơn vị</dt><dd>${U.esc(a.organization || '')}</dd>
          <dt>Chợ</dt><dd>${accScopeLabel(a.marketScopes)}</dd>
        </dl>
        <div class="divider"></div>
        <b class="small">Phân quyền</b>
        <dl class="kv" style="margin-top:8px">
          <dt>Vai trò</dt><dd>${accRoleBadges(a.roleIds)}</dd>
          <dt>Phạm vi</dt><dd>${accScopeLabel(a.marketScopes)}</dd>
        </dl>
      </div>
      <div class="drawer-f">${canEdit ? `<button class="btn primary" data-act="acc-edit" data-id="${a.id}">Chỉnh sửa</button>` : ''}<button class="btn" data-act="close">Đóng</button></div>`;
  }
  function renderAccForm() {
    const d = ui.accForm, isNew = !d.id;
    const canAssign = isNew || A.canDo('tai-khoan.gan-quyen');
    const dis = canAssign ? '' : 'disabled';
    // Legacy ['ALL'] (account cũ trước Phase 5B) diễn giải qua đúng A.allowedMarkets() hiện có —
    // không tự viết lại logic 'ALL' ở đây — để checkbox hiển thị đã tick sẵn cả 2 chợ; account
    // KHÔNG bị ghi lại cho tới khi admin thật sự bấm Lưu (xem mục 3 yêu cầu Phase 5B).
    const dm = A.allowedMarkets({ marketScopes: d.marketScopes || [] });
    A.modal(A.mHead(isNew ? 'Thêm tài khoản mới' : 'Sửa tài khoản') + `<div class="modal-b"><div class="form-grid">
      <div class="field"><label>Mã tài khoản *</label><input class="input" data-ch="af-code" value="${U.esc(d.code || '')}" ${isNew ? '' : 'disabled'}></div>
      <div class="field"><label>Họ tên *</label><input class="input" data-ch="af-name" value="${U.esc(d.fullName || '')}"></div>
      <div class="field"><label>Số điện thoại</label><input class="input" data-ch="af-phone" value="${U.esc(d.phone || '')}"></div>
      <div class="field"><label>Loại tài khoản</label><select class="input" data-ch="af-type">${A.ACCOUNTS.ACCOUNT_TYPES.map(t => `<option ${d.accountType === t ? 'selected' : ''}>${t}</option>`).join('')}</select></div>
      <div class="field"><label>Vai trò (Role)</label><select class="input" data-ch="af-role" ${dis}><option value="">— Chưa gán —</option>${A.PERM.roles().map(r => `<option value="${r.id}" ${(d.roleIds && d.roleIds[0]) === r.id ? 'selected' : ''}>${U.esc(r.name)}</option>`).join('')}</select></div>
      <div class="field"><label>Đơn vị</label><input class="input" data-ch="af-org" value="${U.esc(d.organization || '')}"></div>
      <div class="field"><label>Trạng thái</label><select class="input" data-ch="af-status"><option value="active" ${d.status === 'active' ? 'selected' : ''}>Hoạt động</option><option value="disabled" ${d.status === 'disabled' ? 'selected' : ''}>Tạm khoá</option></select></div>
    </div>
    <div class="field" style="margin-top:12px"><label>Phạm vi chợ được phân công</label>
      <div class="row" style="gap:16px;flex-wrap:wrap;margin-top:4px">
        <label class="small" style="display:flex;align-items:center;gap:6px;cursor:pointer"><input type="checkbox" data-ch="af-scope-cl" ${dm.includes('CL') ? 'checked' : ''} ${dis}> Chợ Cao Lãnh</label>
        <label class="small" style="display:flex;align-items:center;gap:6px;cursor:pointer"><input type="checkbox" data-ch="af-scope-ttd" ${dm.includes('TTD') ? 'checked' : ''} ${dis}> Chợ quê Tân Thuận Đông</label>
      </div>
    </div>
    ${!canAssign ? '<div class="note" style="margin-top:12px">Bạn không có quyền gán vai trò / phạm vi chợ nên các trường này đang bị khoá.</div>' : ''}
    </div>
    <div class="modal-f"><button class="btn" data-act="close">Hủy</button><button class="btn primary" data-act="acc-form-save">Lưu</button></div>`);
  }

  A.VIEWS['tai-khoan'] = function () {
    const canCreate = A.canDo('tai-khoan.tao-moi');
    const canEdit = A.canDo('tai-khoan.sua');
    const canToggle = A.canDo('tai-khoan.khoa-mo-khoa');
    const rows = accRows(), st = accStats(), f = ui.acc;
    const pg = U.pager('acc', rows.length, 15);
    const k = (l, v) => `<div class="card kpi"><div class="k-label">${l}</div><div class="k-value">${v}</div></div>`;
    return `
    <div class="card"><div class="card-b row" style="padding-top:14px">
      <div><h3 style="margin:0">Tài khoản người dùng</h3><div class="small muted">Quản lý và tra cứu các tài khoản được phép sử dụng hệ thống.</div></div>
      <span class="spacer"></span>
      ${canCreate ? '<button class="btn primary" data-act="acc-new">+ Thêm tài khoản</button>' : ''}</div></div>
    <div class="kpis">
      ${k('Tổng tài khoản', st.total)}
      ${k('Đang hoạt động', st.active)}
      ${k('Tạm khoá', st.disabled)}
      ${k('Tiểu thương', st.traders)}
    </div>
    <div class="card"><div class="card-b row" style="padding-top:14px;flex-wrap:wrap">
      <input class="input" style="min-width:220px;flex:1" placeholder="Tìm theo họ tên, mã, số điện thoại..." data-in="acc-search" value="${U.esc(f.search || '')}">
      <select class="input" data-ch="acc-type"><option value="">Loại tài khoản: Tất cả</option>${A.ACCOUNTS.ACCOUNT_TYPES.map(t => `<option ${f.type === t ? 'selected' : ''}>${t}</option>`).join('')}</select>
      <select class="input" data-ch="acc-role"><option value="">Vai trò: Tất cả</option>${A.PERM.roles().map(r => `<option value="${r.id}" ${f.role === r.id ? 'selected' : ''}>${U.esc(r.name)}</option>`).join('')}</select>
      <select class="input" data-ch="acc-market"><option value="">Chợ / phạm vi: Tất cả</option>${D.MARKETS.map(m => `<option value="${m.id}" ${f.market === m.id ? 'selected' : ''}>${m.short}</option>`).join('')}</select>
      <select class="input" data-ch="acc-status"><option value="">Trạng thái: Tất cả</option><option value="active" ${f.status === 'active' ? 'selected' : ''}>Hoạt động</option><option value="disabled" ${f.status === 'disabled' ? 'selected' : ''}>Tạm khoá</option></select>
      <button class="btn" data-act="acc-clear">Đặt lại</button></div></div>
    <div class="card"><div class="card-b">
      ${U.table([{ t: 'Mã' }, { t: 'Người dùng' }, { t: 'Loại tài khoản' }, { t: 'Vai trò' }, { t: 'Đơn vị / Chợ' }, { t: 'Trạng thái' }, { t: '' }],
        rows.slice(pg.start, pg.end).map(a => `<tr class="click" data-act="acc-open" data-id="${a.id}">
          <td>${U.esc(a.code)}</td>
          <td><div class="row" style="gap:8px;flex-wrap:nowrap"><span class="avatar">${U.esc(accInitials(a.fullName))}</span><div><b>${U.esc(a.fullName)}</b>${a.phone ? `<div class="small muted">${U.esc(a.phone)}</div>` : ''}</div></div></td>
          <td class="small">${U.esc(a.accountType)}</td>
          <td>${accRoleBadges(a.roleIds)}</td>
          <td class="small">${U.esc(a.organization || '')}<div class="muted">${accScopeLabel(a.marketScopes)}</div></td>
          <td>${a.status === 'active' ? '<span class="tag ok">Hoạt động</span>' : '<span class="tag danger">Tạm khoá</span>'}</td>
          <td class="nowrap">
            ${canEdit ? `<button class="btn sm" data-act="acc-edit" data-id="${a.id}">Sửa</button>` : ''}
            ${canToggle ? `<button class="btn sm ${a.status === 'active' ? 'danger' : ''}" data-act="acc-toggle" data-id="${a.id}">${a.status === 'active' ? 'Khoá' : 'Mở khoá'}</button>` : ''}
          </td></tr>`), { empty: 'Không tìm thấy tài khoản phù hợp' })}${pg.html}</div></div>`;
  };
  A.IN['acc-search'] = el => { ui.acc.search = el.value; ui.page.acc = 0; A.render(); };
  A.CH['acc-type'] = el => { ui.acc.type = el.value; ui.page.acc = 0; A.render(); };
  A.CH['acc-role'] = el => { ui.acc.role = el.value; ui.page.acc = 0; A.render(); };
  A.CH['acc-market'] = el => { ui.acc.market = el.value; ui.page.acc = 0; A.render(); };
  A.CH['acc-status'] = el => { ui.acc.status = el.value; ui.page.acc = 0; A.render(); };
  A.ACT['acc-clear'] = () => { ui.acc = { search: '', type: '', role: '', market: '', status: '' }; ui.page.acc = 0; A.render(); };
  A.ACT['acc-open'] = el => {
    const a = A.ACCOUNTS.get(el.dataset.id);
    if (!a) return;
    A.$('#modal-root').innerHTML = `<div class="drawer-overlay" data-act="close"></div><div class="drawer">${accDrawerHtml(a)}</div>`;
  };
  A.ACT['acc-new'] = () => {
    if (!A.canDo('tai-khoan.tao-moi')) return;
    ui.accForm = { id: null, code: '', fullName: '', phone: '', accountType: A.ACCOUNTS.ACCOUNT_TYPES[3], roleIds: [], organization: '', marketScopes: ['CL', 'TTD'], status: 'active' };
    renderAccForm();
  };
  A.ACT['acc-edit'] = el => {
    if (!A.canDo('tai-khoan.sua')) return;
    const a = A.ACCOUNTS.get(el.dataset.id);
    if (!a) return;
    // Diễn giải marketScopes cũ (kể cả legacy ['ALL']) qua A.allowedMarkets() NGAY khi mở form —
    // không chỉ lúc render checkbox — để checkbox hiển thị ĐÚNG state form đang giữ, và Lưu ngay
    // (không cần đụng checkbox) cũng ghi lại đúng ['CL','TTD'] tường minh thay vì giữ nguyên 'ALL'
    // (mục 3 yêu cầu Phase 5B: "làm sạch dữ liệu dần khi account thực sự được sửa").
    ui.accForm = { id: a.id, code: a.code, fullName: a.fullName, phone: a.phone, accountType: a.accountType, roleIds: (a.roleIds || []).slice(), organization: a.organization, marketScopes: A.allowedMarkets(a), status: a.status };
    renderAccForm();
  };
  A.CH['af-code'] = el => { ui.accForm.code = el.value; };
  A.CH['af-name'] = el => { ui.accForm.fullName = el.value; };
  A.CH['af-phone'] = el => { ui.accForm.phone = el.value; };
  A.CH['af-type'] = el => { ui.accForm.accountType = el.value; };
  A.CH['af-role'] = el => { ui.accForm.roleIds = el.value ? [el.value] : []; };
  A.CH['af-org'] = el => { ui.accForm.organization = el.value; };
  // Rebuild ui.accForm.marketScopes CHỈ từ CL/TTD mỗi lần tick/bỏ tick — không bao giờ ghi 'ALL'.
  // Chuẩn hoá state hiện có qua A.allowedMarkets() trước khi add/remove để 1 account cũ ['ALL']
  // (hoặc vừa mở form) được diễn giải đúng thành 2 chợ trước khi người dùng bỏ tick 1 trong 2.
  function afSetScope(mid, checked) {
    const cur = new Set(A.allowedMarkets({ marketScopes: ui.accForm.marketScopes || [] }));
    if (checked) cur.add(mid); else cur.delete(mid);
    ui.accForm.marketScopes = ['CL', 'TTD'].filter(m => cur.has(m));
  }
  A.CH['af-scope-cl'] = el => { afSetScope('CL', el.checked); };
  A.CH['af-scope-ttd'] = el => { afSetScope('TTD', el.checked); };
  A.CH['af-status'] = el => { ui.accForm.status = el.value; };
  A.ACT['acc-form-save'] = () => {
    const d = ui.accForm, isNew = !d.id;
    if (!A.canDo(isNew ? 'tai-khoan.tao-moi' : 'tai-khoan.sua')) return;
    const canAssign = isNew || A.canDo('tai-khoan.gan-quyen');
    if (!d.code || !d.code.trim()) { U.toast('Vui lòng nhập mã tài khoản'); return; }
    if (!d.fullName || !d.fullName.trim()) { U.toast('Vui lòng nhập họ tên'); return; }
    if (A.ACCOUNTS.codeTaken(d.code, d.id)) { U.toast('Mã tài khoản "' + d.code + '" đã tồn tại'); return; }
    const existing = d.id ? A.ACCOUNTS.get(d.id) : null;
    const marketScopes = canAssign ? (d.marketScopes || []) : (existing ? existing.marketScopes : []);
    if (canAssign && !marketScopes.length) { U.toast('Vui lòng chọn ít nhất một chợ được phân công.'); return; }
    const patch = { code: d.code.trim(), fullName: d.fullName.trim(), phone: (d.phone || '').trim(), accountType: d.accountType, roleIds: canAssign ? d.roleIds : (existing ? existing.roleIds : []), organization: (d.organization || '').trim(), marketScopes, status: d.status };
    if (d.id) {
      A.ACCOUNTS.update(d.id, patch);
      U.log('Cập nhật tài khoản "' + patch.fullName + '" (' + patch.code + ')');
      U.toast('Đã cập nhật tài khoản ' + patch.code);
    } else {
      A.ACCOUNTS.add(Object.assign({ id: 'AC-' + patch.code.trim().toUpperCase() }, patch));
      U.log('Thêm tài khoản mới "' + patch.fullName + '" (' + patch.code + ')');
      U.toast('Đã thêm tài khoản ' + patch.code);
    }
    ui.accForm = null;
    A.closeModal(); A.render();
  };
  A.ACT['acc-toggle'] = el => {
    if (!A.canDo('tai-khoan.khoa-mo-khoa')) return;
    const a = A.ACCOUNTS.get(el.dataset.id);
    if (!a) return;
    const was = a.status;
    A.ACCOUNTS.setStatus(a.id, was === 'active' ? 'disabled' : 'active');
    U.log((was === 'active' ? 'Tạm khoá' : 'Mở khoá') + ' tài khoản "' + a.fullName + '" (' + a.code + ')');
    A.render();
    U.toast(was === 'active' ? 'Đã tạm khoá tài khoản ' + a.code : 'Đã mở khoá tài khoản ' + a.code);
  };

  // ---------- Cài đặt ----------
  // "Số quyền" ở bảng Role (Phase 5B, thay cột "Phạm vi dữ liệu" cũ) — đếm từ permission STATE
  // thực tế của role (A.PERM.rolePermKeys), không phải từ default matrix hard-code, để phản ánh
  // đúng sau khi admin grant/revoke qua "Phân quyền chi tiết".
  function roleGrantCountLabel(roleId) {
    const keys = A.PERM.rolePermKeys(roleId);
    const nScreen = keys.filter(k => k.indexOf('screen:') === 0).length;
    const nAction = keys.filter(k => k.indexOf('action:') === 0).length;
    return nScreen + ' màn hình · ' + nAction + ' thao tác';
  }
  function slugify(s) {
    return (s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/gi, 'd')
      .toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'vaitro';
  }
  // Phase 5B: tách rõ QUYỀN MÀN HÌNH (kind:'screen', "được vào màn nào") khỏi QUYỀN THAO TÁC
  // (kind:'action', "được làm gì bên trong 1 màn") — trước đây gộp chung 1 danh sách theo group
  // lớn (Điều hành/Tài chính/...) khiến khó phân biệt 2 loại quyền khác bản chất (audit Phase 5A
  // mục 7/8). KHÔNG đổi permKey, KHÔNG đổi CATALOG, chỉ đổi cách render.
  function permsMatrixHtml(role) {
    const granted = new Set(A.PERM.rolePermKeys(role.id));
    const canManage = A.canDo('cai-dat.phan-quyen');
    const cb = p => `<label class="small" style="display:flex;gap:6px;align-items:center;padding:3px 0">
        <input type="checkbox" data-ch="perm-toggle" data-role="${role.id}" data-key="${p.key}" ${granted.has(p.key) ? 'checked' : ''} ${canManage ? '' : 'disabled'}>
        ${U.esc(p.label)}</label>`;
    const grid = items => `<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:4px 14px">${items.map(cb).join('')}</div>`;
    const screens = A.PERM.catalog().filter(p => p.kind === 'screen');
    const actions = A.PERM.catalog().filter(p => p.kind === 'action');
    // Nhóm action theo TỪNG MÀN (A.menuItem(p.screenId).label) — nếu screenId thiếu/không hợp lệ,
    // fallback về p.group thay vì crash renderer (yêu cầu Phase 5B mục 14).
    const actionGroups = [];
    actions.forEach(p => {
      const item = p.screenId && A.menuItem(p.screenId);
      const gname = item ? item.label : p.group;
      let g = actionGroups.find(x => x.name === gname);
      if (!g) { g = { name: gname, items: [] }; actionGroups.push(g); }
      g.items.push(p);
    });
    return `<div style="margin-bottom:20px">
        <div class="small" style="font-weight:700;text-transform:uppercase;letter-spacing:.04em;margin-bottom:8px">Quyền màn hình</div>
        ${grid(screens)}
      </div>
      <div class="divider" style="margin:0 0 16px"></div>
      <div>
        <div class="small" style="font-weight:700;text-transform:uppercase;letter-spacing:.04em;margin-bottom:8px">Quyền thao tác</div>
        ${actionGroups.map(g => `<div style="margin-bottom:14px"><div class="small" style="font-weight:600;margin-bottom:6px">${U.esc(g.name)}</div>${grid(g.items)}</div>`).join('')}
      </div>`;
  }
  // Phase 5B: bỏ dropdown "Phạm vi dữ liệu" (all/market/self) + field "Chợ" của Role khỏi form —
  // audit Phase 5A xác nhận field này KHÔNG phải authorization source (Account.marketScopes mới
  // là nguồn enforce chợ), chỉ còn đúng 1 nhánh có tác dụng runtime thật (scope==='self' →
  // selfService, dùng để auto-route Mini app — core.js A.route()/A.ACT['demo-account']). Thay
  // bằng 1 checkbox đúng bản chất, ghi thẳng `selfService`; `scope`/`market` vẫn giữ trong schema
  // (không bump RBAC_SCHEMA) để tương thích ngược, suy ra lại từ selfService khi lưu.
  function renderRoleForm() {
    const d = ui.roleForm;
    A.modal(A.mHead(d.id ? 'Sửa vai trò' : 'Thêm vai trò mới') + `<div class="modal-b"><div class="form-grid">
      <div class="field"><label>Tên vai trò *</label><input class="input" data-ch="rf-name" value="${U.esc(d.name || '')}"></div>
    </div>
    <div class="field" style="margin-top:10px"><label>Mô tả</label><textarea class="input" data-ch="rf-desc" rows="2">${U.esc(d.desc || '')}</textarea></div>
    <label class="small" style="display:flex;align-items:center;gap:6px;margin-top:12px;cursor:pointer"><input type="checkbox" data-ch="rf-self" ${d.selfService ? 'checked' : ''}> Vai trò tự phục vụ</label>
    <div class="note info" style="margin-top:8px">Tài khoản có vai trò tự phục vụ sẽ được điều hướng vào Mini app phù hợp với luồng hiện tại.</div>
    </div>
    <div class="modal-f"><button class="btn" data-act="close">Hủy</button><button class="btn primary" data-act="role-form-save">Lưu</button></div>`);
  }

  const SETTINGS_TABS = [['dongia', 'Cấu hình dịch vụ'], ['vaitro', 'Vai trò & phân quyền'], ['tichhop', 'Tích hợp'], ['nhatky', 'Nhật ký kiểm toán']];
  function settingsTabBar(tab) {
    return `<div class="seg">${SETTINGS_TABS.map(t => `<button class="${tab === t[0] ? 'on' : ''}" data-act="settings-tab" data-id="${t[0]}">${t[1]}</button>`).join('')}</div>`;
  }
  // ---- Cấu hình dịch vụ: tiện ích dùng chung ----
  const CFG_CALC_LABELS = { fixed: 'Cố định / kỳ', area: 'Theo diện tích', qty: 'Theo số lượng', session: 'Theo phiên' };
  function cfgCan(action) { return A.PERM.canAction(ui.role, 'cai-dat.' + action); }
  function cfgActor() { return ui.role === 'lanhdao' ? 'Lãnh đạo UBND phường' : 'Trần Minh Khoa'; }
  function cfgStatusTag(s) { return s === 'active' ? '<span class="tag ok">Đang áp dụng</span>' : '<span class="tag">Đã vô hiệu hoá</span>'; }
  function cfgRecord(cat, id) {
    if (cat === 'billingCycle') return A.SERVICE_CFG.cycle();
    if (cat === 'billingRules') return A.SERVICE_CFG.rules();
    return A.SERVICE_CFG.get(cat, id);
  }
  function cfgLegalHtml(lb) {
    if (!lb || (!lb.docNo && !lb.summary)) return '<div class="small muted">Chưa có căn cứ</div>';
    return `<dl class="kv"><dt>Số văn bản</dt><dd>${lb.docNo ? U.esc(lb.docNo) : '<span class="muted">—</span>'}</dd>
      <dt>Ngày ban hành</dt><dd>${lb.docDate ? U.dmy(lb.docDate) : '<span class="muted">—</span>'}</dd>
      <dt>Cơ quan ban hành</dt><dd>${U.esc(lb.issuer || '—')}</dd><dt>Trích yếu</dt><dd>${U.esc(lb.summary || '—')}</dd>
      <dt>Ngày hiệu lực</dt><dd>${lb.effectiveDate ? U.dmy(lb.effectiveDate) : '<span class="muted">—</span>'}</dd>
      ${lb.note ? `<dt>Ghi chú</dt><dd>${U.esc(lb.note)}</dd>` : ''}</dl>`;
  }
  function cfgAttachIcon(type) { return (type || '').indexOf('image/') === 0 ? '🖼' : '📄'; }
  function cfgAttachHtml(rec, cat, id, canManage) {
    const list = rec.attachments || [];
    return `<div class="small muted" style="margin-bottom:6px">Tài liệu / hình ảnh / chứng từ đính kèm</div>
      ${list.length ? list.map(a => `<div class="row" style="padding:5px 0;border-bottom:1px solid #eef2f0">
        <span>${cfgAttachIcon(a.type)}</span><span style="flex:1">${U.esc(a.name)}${a.note ? `<div class="small muted">${U.esc(a.note)}</div>` : ''}</span>
        <button class="btn sm" data-act="cfg-att-view" data-cat="${cat}" data-id="${id}" data-att="${a.id}">Xem</button>
        ${canManage ? `<button class="btn sm danger" data-act="cfg-att-del" data-cat="${cat}" data-id="${id}" data-att="${a.id}">Xoá</button>` : ''}
      </div>`).join('') : '<div class="small muted">Chưa có tài liệu đính kèm</div>'}
      ${canManage ? `<label class="btn sm" style="cursor:pointer;margin-top:8px;display:inline-flex">+ Thêm tài liệu<input type="file" style="display:none" data-ch="cfg-att-add" data-cat="${cat}" data-id="${id}"></label>` : ''}`;
  }
  function cfgHistoryHtml(rec) {
    return U.table([{ t: 'Thời điểm' }, { t: 'Người thực hiện' }, { t: 'Thao tác' }, { t: 'Nội dung' }],
      (rec.history || []).map(h => `<tr><td class="nowrap">${h.time}</td><td>${U.esc(h.user)}</td><td>${U.esc(h.action)}</td><td class="small">${U.esc(h.detail || '')}</td></tr>`),
      { empty: 'Chưa có lịch sử thay đổi' });
  }
  function reopenCfgDrawer(cat, id) {
    const html = cat === 'stallPrices' ? cfgPriceDrawerHtml(cfgRecord(cat, id))
      : cat === 'utilities' ? cfgUtilDrawerHtml(cfgRecord(cat, id))
      : cat === 'extraServices' ? cfgSvcDrawerHtml(cfgRecord(cat, id))
      : null;
    if (html) A.$('#modal-root').innerHTML = `<div class="drawer-overlay" data-act="close"></div><div class="drawer">${html}</div>`;
    else A.render();
  }

  // ---- sub-tab: Đơn giá mặt bằng ----
  function settingsGiaHtml() {
    const canManage = cfgCan('gia-mat-bang'), rows = A.SERVICE_CFG.list('stallPrices');
    return `<div class="card"><div class="card-h"><h3>Đơn giá mặt bằng</h3>${canManage ? '<button class="btn sm primary" data-act="cfg-price-new">+ Thêm đơn giá</button>' : ''}</div>
      <div class="card-b">${U.table([{ t: 'Chợ' }, { t: 'Khu vực / tầng' }, { t: 'Loại điểm KD' }, { t: 'Đơn giá', num: true }, { t: 'Đơn vị tính' }, { t: 'Ngày hiệu lực' }, { t: 'Căn cứ' }, { t: 'Trạng thái' }, { t: '' }],
        rows.map(r => `<tr>
          <td>${U.mShort(r.marketId)}</td><td class="small">${U.esc(r.area)}</td><td class="small">${U.esc(r.stallType)}</td>
          <td class="num">${r.amount.toLocaleString('vi-VN')}</td><td class="small nowrap">${U.esc(r.unit)}</td>
          <td class="nowrap">${U.dmy(r.effectiveFrom)}</td><td class="small">${r.legalBasis && r.legalBasis.docNo ? U.esc(r.legalBasis.docNo) : '<span class="muted">—</span>'}</td>
          <td>${cfgStatusTag(r.status)}</td>
          <td class="nowrap"><button class="btn sm" data-act="cfg-price-view" data-id="${r.id}">Xem</button>
            ${canManage ? `<button class="btn sm" data-act="cfg-price-edit" data-id="${r.id}">Sửa</button><button class="btn sm ${r.status === 'active' ? 'danger' : ''}" data-act="cfg-price-toggle" data-id="${r.id}">${r.status === 'active' ? 'Vô hiệu hoá' : 'Kích hoạt'}</button>` : ''}
          </td></tr>`), { empty: 'Chưa có đơn giá nào' })}</div></div>`;
  }
  function cfgPriceDrawerHtml(r) {
    const canManage = cfgCan('gia-mat-bang');
    return `<div class="drawer-h"><div><h3 style="margin:0;font-size:16px">Đơn giá mặt bằng</h3><div class="small muted">${U.mShort(r.marketId)} · ${cfgStatusTag(r.status)}</div></div><span class="spacer"></span><button class="x" data-act="close" aria-label="Đóng">×</button></div>
      <div class="drawer-b">
        <dl class="kv"><dt>Chợ</dt><dd>${U.esc(U.market(r.marketId).name)}</dd><dt>Khu vực</dt><dd>${U.esc(r.area)}</dd>
          <dt>Loại điểm</dt><dd>${U.esc(r.stallType)}</dd><dt>Đơn giá</dt><dd><b>${r.amount.toLocaleString('vi-VN')} ${U.esc(r.unit)}</b></dd>
          <dt>Hiệu lực từ</dt><dd>${U.dmy(r.effectiveFrom)}</dd>${r.effectiveTo ? `<dt>Hết hiệu lực</dt><dd>${U.dmy(r.effectiveTo)}</dd>` : ''}</dl>
        <div class="divider"></div><b class="small">CĂN CỨ</b><div style="margin-top:6px">${cfgLegalHtml(r.legalBasis)}</div>
        <div class="divider"></div><b class="small">TÀI LIỆU</b><div style="margin-top:6px">${cfgAttachHtml(r, 'stallPrices', r.id, canManage)}</div>
        <div class="divider"></div><b class="small">LỊCH SỬ</b><div style="margin-top:6px">${cfgHistoryHtml(r)}</div>
      </div>
      <div class="drawer-f">${canManage ? `<button class="btn primary" data-act="cfg-price-edit" data-id="${r.id}">Chỉnh sửa</button>` : ''}<button class="btn" data-act="close">Đóng</button></div>`;
  }
  A.ACT['cfg-price-view'] = el => { const r = A.SERVICE_CFG.get('stallPrices', el.dataset.id); if (!r) return; A.$('#modal-root').innerHTML = `<div class="drawer-overlay" data-act="close"></div><div class="drawer">${cfgPriceDrawerHtml(r)}</div>`; };
  A.ACT['cfg-price-new'] = () => { ui.cfgForm = { cat: 'stallPrices', id: null, marketId: 'CL', area: '', stallType: '', amount: 0, unit: 'đ/m²/ngày', effectiveFrom: A.db.today, status: 'active', legalBasis: { docNo: '', docDate: '', issuer: '', summary: '', effectiveDate: '', note: '' } }; renderCfgForm(); };
  A.ACT['cfg-price-edit'] = el => {
    const r = A.SERVICE_CFG.get('stallPrices', el.dataset.id); if (!r) return;
    ui.cfgForm = { cat: 'stallPrices', id: r.id, marketId: r.marketId, area: r.area, stallType: r.stallType, amount: r.amount, unit: r.unit, effectiveFrom: r.effectiveFrom, status: r.status, legalBasis: Object.assign({ docNo: '', docDate: '', issuer: '', summary: '', effectiveDate: '', note: '' }, r.legalBasis) };
    renderCfgForm();
  };
  A.ACT['cfg-price-toggle'] = el => {
    const r = A.SERVICE_CFG.get('stallPrices', el.dataset.id); if (!r) return;
    const was = r.status;
    A.SERVICE_CFG.setStatus('stallPrices', r.id, was === 'active' ? 'inactive' : 'active', cfgActor());
    A.render(); U.toast(was === 'active' ? 'Đã vô hiệu hoá đơn giá' : 'Đã kích hoạt lại đơn giá');
  };

  // ---- sub-tab: Điện & nước ----
  function settingsDienNuocHtml() {
    const canManage = cfgCan('gia-dien-nuoc'), rows = A.SERVICE_CFG.list('utilities');
    return `<div class="card"><div class="card-h"><h3>Điện & nước</h3>${canManage ? '<button class="btn sm primary" data-act="cfg-util-new">+ Thêm cấu hình</button>' : ''}</div>
      <div class="card-b">${U.table([{ t: 'Chợ áp dụng' }, { t: 'Giá điện (đ/kWh)', num: true }, { t: 'Giá nước (đ/m³)', num: true }, { t: 'Ngày hiệu lực' }, { t: 'Căn cứ' }, { t: 'Trạng thái' }, { t: '' }],
        rows.map(r => `<tr>
          <td>${U.mShort(r.marketId)}</td><td class="num">${r.elecPrice.toLocaleString('vi-VN')}</td><td class="num">${r.waterPrice.toLocaleString('vi-VN')}</td>
          <td class="nowrap">${U.dmy(r.effectiveFrom)}</td><td class="small">${r.legalBasis && r.legalBasis.docNo ? U.esc(r.legalBasis.docNo) : '<span class="muted">—</span>'}</td>
          <td>${cfgStatusTag(r.status)}</td>
          <td class="nowrap"><button class="btn sm" data-act="cfg-util-view" data-id="${r.id}">Xem</button>
            ${canManage ? `<button class="btn sm" data-act="cfg-util-edit" data-id="${r.id}">Sửa</button><button class="btn sm ${r.status === 'active' ? 'danger' : ''}" data-act="cfg-util-toggle" data-id="${r.id}">${r.status === 'active' ? 'Vô hiệu hoá' : 'Kích hoạt'}</button>` : ''}
          </td></tr>`), { empty: 'Chưa có cấu hình điện nước' })}</div></div>`;
  }
  function cfgUtilDrawerHtml(r) {
    const canManage = cfgCan('gia-dien-nuoc');
    return `<div class="drawer-h"><div><h3 style="margin:0;font-size:16px">Điện & nước</h3><div class="small muted">${U.mShort(r.marketId)} · ${cfgStatusTag(r.status)}</div></div><span class="spacer"></span><button class="x" data-act="close" aria-label="Đóng">×</button></div>
      <div class="drawer-b">
        <dl class="kv"><dt>Chợ</dt><dd>${U.esc(U.market(r.marketId).name)}</dd><dt>Giá điện</dt><dd><b>${r.elecPrice.toLocaleString('vi-VN')} đ/kWh</b></dd>
          <dt>Giá nước</dt><dd><b>${r.waterPrice.toLocaleString('vi-VN')} đ/m³</b></dd><dt>Hiệu lực từ</dt><dd>${U.dmy(r.effectiveFrom)}</dd></dl>
        <div class="divider"></div><b class="small">CĂN CỨ</b><div style="margin-top:6px">${cfgLegalHtml(r.legalBasis)}</div>
        <div class="divider"></div><b class="small">TÀI LIỆU</b><div style="margin-top:6px">${cfgAttachHtml(r, 'utilities', r.id, canManage)}</div>
        <div class="divider"></div><b class="small">LỊCH SỬ</b><div style="margin-top:6px">${cfgHistoryHtml(r)}</div>
      </div>
      <div class="drawer-f">${canManage ? `<button class="btn primary" data-act="cfg-util-edit" data-id="${r.id}">Chỉnh sửa</button>` : ''}<button class="btn" data-act="close">Đóng</button></div>`;
  }
  A.ACT['cfg-util-view'] = el => { const r = A.SERVICE_CFG.get('utilities', el.dataset.id); if (!r) return; A.$('#modal-root').innerHTML = `<div class="drawer-overlay" data-act="close"></div><div class="drawer">${cfgUtilDrawerHtml(r)}</div>`; };
  A.ACT['cfg-util-new'] = () => { ui.cfgForm = { cat: 'utilities', id: null, marketId: 'CL', elecPrice: D.ELEC, waterPrice: D.WATER, effectiveFrom: A.db.today, status: 'active', legalBasis: { docNo: '', docDate: '', issuer: '', summary: '', effectiveDate: '', note: '' } }; renderCfgForm(); };
  A.ACT['cfg-util-edit'] = el => {
    const r = A.SERVICE_CFG.get('utilities', el.dataset.id); if (!r) return;
    ui.cfgForm = { cat: 'utilities', id: r.id, marketId: r.marketId, elecPrice: r.elecPrice, waterPrice: r.waterPrice, effectiveFrom: r.effectiveFrom, status: r.status, legalBasis: Object.assign({ docNo: '', docDate: '', issuer: '', summary: '', effectiveDate: '', note: '' }, r.legalBasis) };
    renderCfgForm();
  };
  A.ACT['cfg-util-toggle'] = el => {
    const r = A.SERVICE_CFG.get('utilities', el.dataset.id); if (!r) return;
    const was = r.status;
    A.SERVICE_CFG.setStatus('utilities', r.id, was === 'active' ? 'inactive' : 'active', cfgActor());
    A.render(); U.toast(was === 'active' ? 'Đã vô hiệu hoá cấu hình điện nước' : 'Đã kích hoạt lại');
  };

  // ---- sub-tab: Dịch vụ khác ----
  function settingsDichVuHtml() {
    const canManage = cfgCan('dich-vu-khac'), rows = A.SERVICE_CFG.list('extraServices');
    return `<div class="card"><div class="card-h"><h3>Dịch vụ khác</h3>${canManage ? '<button class="btn sm primary" data-act="cfg-svc-new">+ Thêm dịch vụ</button>' : ''}</div>
      <div class="card-b">${U.table([{ t: 'Tên dịch vụ' }, { t: 'Chợ áp dụng' }, { t: 'Cách tính' }, { t: 'Đơn giá', num: true }, { t: 'Đơn vị tính' }, { t: 'Ngày hiệu lực' }, { t: 'Trạng thái' }, { t: '' }],
        rows.map(r => `<tr>
          <td><b>${U.esc(r.name)}</b></td><td>${r.marketId === 'ALL' ? 'Tất cả chợ' : U.mShort(r.marketId)}</td><td class="small">${CFG_CALC_LABELS[r.calcMethod] || r.calcMethod}</td>
          <td class="num">${r.amount.toLocaleString('vi-VN')}</td><td class="small nowrap">${U.esc(r.unit)}</td><td class="nowrap">${U.dmy(r.effectiveFrom)}</td>
          <td>${cfgStatusTag(r.status)}</td>
          <td class="nowrap"><button class="btn sm" data-act="cfg-svc-view" data-id="${r.id}">Xem</button>
            ${canManage ? `<button class="btn sm" data-act="cfg-svc-edit" data-id="${r.id}">Sửa</button><button class="btn sm ${r.status === 'active' ? 'danger' : ''}" data-act="cfg-svc-toggle" data-id="${r.id}">${r.status === 'active' ? 'Vô hiệu hoá' : 'Kích hoạt'}</button>` : ''}
          </td></tr>`), { empty: 'Chưa có dịch vụ nào' })}</div></div>`;
  }
  function cfgSvcDrawerHtml(r) {
    const canManage = cfgCan('dich-vu-khac');
    return `<div class="drawer-h"><div><h3 style="margin:0;font-size:16px">${U.esc(r.name)}</h3><div class="small muted">${r.marketId === 'ALL' ? 'Tất cả chợ' : U.mShort(r.marketId)} · ${cfgStatusTag(r.status)}</div></div><span class="spacer"></span><button class="x" data-act="close" aria-label="Đóng">×</button></div>
      <div class="drawer-b">
        <dl class="kv"><dt>Tên dịch vụ</dt><dd>${U.esc(r.name)}</dd><dt>Cách tính</dt><dd>${CFG_CALC_LABELS[r.calcMethod] || r.calcMethod}</dd>
          <dt>Đơn giá</dt><dd><b>${r.amount.toLocaleString('vi-VN')} ${U.esc(r.unit)}</b></dd><dt>Hiệu lực từ</dt><dd>${U.dmy(r.effectiveFrom)}</dd></dl>
        <div class="divider"></div><b class="small">CĂN CỨ</b><div style="margin-top:6px">${cfgLegalHtml(r.legalBasis)}</div>
        <div class="divider"></div><b class="small">TÀI LIỆU</b><div style="margin-top:6px">${cfgAttachHtml(r, 'extraServices', r.id, canManage)}</div>
        <div class="divider"></div><b class="small">LỊCH SỬ</b><div style="margin-top:6px">${cfgHistoryHtml(r)}</div>
      </div>
      <div class="drawer-f">${canManage ? `<button class="btn primary" data-act="cfg-svc-edit" data-id="${r.id}">Chỉnh sửa</button>` : ''}<button class="btn" data-act="close">Đóng</button></div>`;
  }
  A.ACT['cfg-svc-view'] = el => { const r = A.SERVICE_CFG.get('extraServices', el.dataset.id); if (!r) return; A.$('#modal-root').innerHTML = `<div class="drawer-overlay" data-act="close"></div><div class="drawer">${cfgSvcDrawerHtml(r)}</div>`; };
  A.ACT['cfg-svc-new'] = () => { ui.cfgForm = { cat: 'extraServices', id: null, name: '', marketId: 'ALL', calcMethod: 'fixed', amount: 0, unit: '', effectiveFrom: A.db.today, status: 'active', legalBasis: { docNo: '', docDate: '', issuer: '', summary: '', effectiveDate: '', note: '' } }; renderCfgForm(); };
  A.ACT['cfg-svc-edit'] = el => {
    const r = A.SERVICE_CFG.get('extraServices', el.dataset.id); if (!r) return;
    ui.cfgForm = { cat: 'extraServices', id: r.id, name: r.name, marketId: r.marketId, calcMethod: r.calcMethod, amount: r.amount, unit: r.unit, effectiveFrom: r.effectiveFrom, status: r.status, legalBasis: Object.assign({ docNo: '', docDate: '', issuer: '', summary: '', effectiveDate: '', note: '' }, r.legalBasis) };
    renderCfgForm();
  };
  A.ACT['cfg-svc-toggle'] = el => {
    const r = A.SERVICE_CFG.get('extraServices', el.dataset.id); if (!r) return;
    const was = r.status;
    A.SERVICE_CFG.setStatus('extraServices', r.id, was === 'active' ? 'inactive' : 'active', cfgActor());
    A.render(); U.toast(was === 'active' ? 'Đã vô hiệu hoá dịch vụ' : 'Đã kích hoạt lại dịch vụ');
  };

  // ---- form thêm/sửa dùng chung cho 3 sub-tab dạng bảng ----
  function cfgCategoryLabel(cat) { return cat === 'stallPrices' ? 'đơn giá mặt bằng' : cat === 'utilities' ? 'cấu hình điện nước' : 'dịch vụ khác'; }
  function renderCfgForm() {
    const d = ui.cfgForm, isNew = !d.id, lb = d.legalBasis;
    let fields = '';
    if (d.cat === 'stallPrices') {
      fields = `<div class="field"><label>Chợ</label><select class="input" data-ch="cf-market">${D.MARKETS.map(m => `<option value="${m.id}" ${d.marketId === m.id ? 'selected' : ''}>${m.short}</option>`).join('')}</select></div>
        <div class="field"><label>Khu vực / tầng</label><input class="input" data-ch="cf-area" value="${U.esc(d.area || '')}"></div>
        <div class="field"><label>Loại điểm kinh doanh</label><input class="input" data-ch="cf-stalltype" value="${U.esc(d.stallType || '')}"></div>
        <div class="field"><label>Đơn giá</label><input class="input" type="number" min="0" data-ch="cf-amount" value="${d.amount || 0}"></div>
        <div class="field"><label>Đơn vị tính</label><input class="input" data-ch="cf-unit" value="${U.esc(d.unit || '')}" placeholder="VD: đ/m²/ngày"></div>
        <div class="field"><label>Ngày hiệu lực</label><input class="input" type="date" data-ch="cf-eff" value="${d.effectiveFrom || ''}"></div>`;
    } else if (d.cat === 'utilities') {
      fields = `<div class="field"><label>Chợ áp dụng</label><select class="input" data-ch="cf-market">${D.MARKETS.map(m => `<option value="${m.id}" ${d.marketId === m.id ? 'selected' : ''}>${m.short}</option>`).join('')}</select></div>
        <div class="field"><label>Giá điện (đ/kWh)</label><input class="input" type="number" min="0" data-ch="cf-elec" value="${d.elecPrice || 0}"></div>
        <div class="field"><label>Giá nước (đ/m³)</label><input class="input" type="number" min="0" data-ch="cf-water" value="${d.waterPrice || 0}"></div>
        <div class="field"><label>Ngày hiệu lực</label><input class="input" type="date" data-ch="cf-eff" value="${d.effectiveFrom || ''}"></div>`;
    } else {
      fields = `<div class="field"><label>Tên dịch vụ</label><input class="input" data-ch="cf-name" value="${U.esc(d.name || '')}"></div>
        <div class="field"><label>Chợ áp dụng</label><select class="input" data-ch="cf-market"><option value="ALL" ${d.marketId === 'ALL' ? 'selected' : ''}>Tất cả chợ</option>${D.MARKETS.map(m => `<option value="${m.id}" ${d.marketId === m.id ? 'selected' : ''}>${m.short}</option>`).join('')}</select></div>
        <div class="field"><label>Cách tính</label><select class="input" data-ch="cf-calc">${Object.keys(CFG_CALC_LABELS).map(k => `<option value="${k}" ${d.calcMethod === k ? 'selected' : ''}>${CFG_CALC_LABELS[k]}</option>`).join('')}</select></div>
        <div class="field"><label>Đơn giá</label><input class="input" type="number" min="0" data-ch="cf-amount" value="${d.amount || 0}"></div>
        <div class="field"><label>Đơn vị tính</label><input class="input" data-ch="cf-unit" value="${U.esc(d.unit || '')}"></div>
        <div class="field"><label>Ngày hiệu lực</label><input class="input" type="date" data-ch="cf-eff" value="${d.effectiveFrom || ''}"></div>`;
    }
    A.modal(A.mHead((isNew ? 'Thêm ' : 'Sửa ') + cfgCategoryLabel(d.cat)) + `<div class="modal-b">
      <div class="form-grid">${fields}${!isNew ? `<div class="field"><label>Trạng thái</label><select class="input" data-ch="cf-status"><option value="active" ${d.status === 'active' ? 'selected' : ''}>Đang áp dụng</option><option value="inactive" ${d.status === 'inactive' ? 'selected' : ''}>Vô hiệu hoá</option></select></div>` : ''}</div>
      <div class="divider"></div><b class="small">Căn cứ</b>
      <div class="form-grid" style="margin-top:8px">
        <div class="field"><label>Số văn bản</label><input class="input" data-ch="cf-lb-docno" value="${U.esc(lb.docNo || '')}"></div>
        <div class="field"><label>Ngày ban hành</label><input class="input" type="date" data-ch="cf-lb-docdate" value="${lb.docDate || ''}"></div>
        <div class="field"><label>Cơ quan ban hành</label><input class="input" data-ch="cf-lb-issuer" value="${U.esc(lb.issuer || '')}"></div>
        <div class="field"><label>Ngày hiệu lực căn cứ</label><input class="input" type="date" data-ch="cf-lb-effdate" value="${lb.effectiveDate || ''}"></div>
      </div>
      <div class="field" style="margin-top:8px"><label>Trích yếu</label><input class="input" data-ch="cf-lb-summary" value="${U.esc(lb.summary || '')}"></div>
      <div class="field" style="margin-top:8px"><label>Ghi chú</label><input class="input" data-ch="cf-lb-note" value="${U.esc(lb.note || '')}"></div>
      </div>
      <div class="modal-f"><button class="btn" data-act="close">Hủy</button><button class="btn primary" data-act="cfg-form-save">Lưu</button></div>`);
  }
  A.CH['cf-market'] = el => { ui.cfgForm.marketId = el.value; };
  A.CH['cf-area'] = el => { ui.cfgForm.area = el.value; };
  A.CH['cf-stalltype'] = el => { ui.cfgForm.stallType = el.value; };
  A.CH['cf-amount'] = el => { ui.cfgForm.amount = Math.max(0, Number(el.value) || 0); };
  A.CH['cf-unit'] = el => { ui.cfgForm.unit = el.value; };
  A.CH['cf-eff'] = el => { ui.cfgForm.effectiveFrom = el.value; };
  A.CH['cf-status'] = el => { ui.cfgForm.status = el.value; };
  A.CH['cf-name'] = el => { ui.cfgForm.name = el.value; };
  A.CH['cf-calc'] = el => { ui.cfgForm.calcMethod = el.value; };
  A.CH['cf-elec'] = el => { ui.cfgForm.elecPrice = Math.max(0, Number(el.value) || 0); };
  A.CH['cf-water'] = el => { ui.cfgForm.waterPrice = Math.max(0, Number(el.value) || 0); };
  A.CH['cf-lb-docno'] = el => { ui.cfgForm.legalBasis.docNo = el.value; };
  A.CH['cf-lb-docdate'] = el => { ui.cfgForm.legalBasis.docDate = el.value; };
  A.CH['cf-lb-issuer'] = el => { ui.cfgForm.legalBasis.issuer = el.value; };
  A.CH['cf-lb-effdate'] = el => { ui.cfgForm.legalBasis.effectiveDate = el.value; };
  A.CH['cf-lb-summary'] = el => { ui.cfgForm.legalBasis.summary = el.value; };
  A.CH['cf-lb-note'] = el => { ui.cfgForm.legalBasis.note = el.value; };
  A.ACT['cfg-form-save'] = () => {
    const d = ui.cfgForm, lb = d.legalBasis;
    let patch, detail;
    if (d.cat === 'stallPrices') {
      if (!d.area.trim() || !d.stallType.trim()) { U.toast('Vui lòng nhập đủ khu vực và loại điểm kinh doanh'); return; }
      patch = { marketId: d.marketId, area: d.area.trim(), stallType: d.stallType.trim(), amount: d.amount, unit: d.unit.trim(), effectiveFrom: d.effectiveFrom, status: d.status, legalBasis: lb };
      detail = patch.amount.toLocaleString('vi-VN') + ' ' + patch.unit;
    } else if (d.cat === 'utilities') {
      patch = { marketId: d.marketId, elecPrice: d.elecPrice, waterPrice: d.waterPrice, effectiveFrom: d.effectiveFrom, status: d.status, legalBasis: lb };
      detail = 'Điện ' + patch.elecPrice.toLocaleString('vi-VN') + ' đ/kWh · Nước ' + patch.waterPrice.toLocaleString('vi-VN') + ' đ/m³';
    } else {
      if (!d.name.trim()) { U.toast('Vui lòng nhập tên dịch vụ'); return; }
      patch = { name: d.name.trim(), marketId: d.marketId, calcMethod: d.calcMethod, amount: d.amount, unit: d.unit.trim(), effectiveFrom: d.effectiveFrom, status: d.status, legalBasis: lb };
      detail = patch.amount.toLocaleString('vi-VN') + ' ' + patch.unit;
    }
    const actor = cfgActor();
    if (d.id) { A.SERVICE_CFG.update(d.cat, d.id, patch, actor, 'Cập nhật cấu hình', detail); U.toast('Đã cập nhật'); }
    else { patch.__detail = detail; A.SERVICE_CFG.add(d.cat, patch, actor); U.toast('Đã thêm cấu hình mới'); }
    ui.cfgForm = null;
    A.closeModal(); A.render();
  };

  // ---- attachment (dùng chung cho mọi hạng mục) ----
  A.CH['cfg-att-add'] = el => {
    const file = el.files && el.files[0];
    if (!file) return;
    const rec = cfgRecord(el.dataset.cat, el.dataset.id);
    if (!rec) return;
    const att = { name: file.name, type: file.type || 'application/octet-stream', note: '', mock: false, url: URL.createObjectURL(file) };
    A.SERVICE_CFG.addAttachment(rec, att, cfgActor());
    reopenCfgDrawer(el.dataset.cat, el.dataset.id);
    U.toast('Đã đính kèm "' + file.name + '" (chỉ xem được trong phiên hiện tại, không upload lên máy chủ)');
  };
  A.ACT['cfg-att-view'] = el => {
    const rec = cfgRecord(el.dataset.cat, el.dataset.id);
    const a = rec && (rec.attachments || []).find(x => x.id === el.dataset.att);
    if (!a) return;
    if (a.url) {
      if ((a.type || '').indexOf('image/') === 0) A.modal(A.mHead(a.name) + `<div class="modal-b" style="text-align:center"><img src="${a.url}" style="max-width:100%;border-radius:8px"></div><div class="modal-f"><button class="btn" data-act="close">Đóng</button></div>`);
      else window.open(a.url, '_blank');
    } else {
      A.modal(A.mHead(a.name) + `<div class="modal-b"><div class="note info">Đây là tài liệu mẫu minh hoạ (giả lập) — prototype không lưu file thật nên không có nội dung để xem trước.</div>
        <dl class="kv" style="margin-top:10px"><dt>Loại</dt><dd>${U.esc(a.type || '')}</dd><dt>Ghi chú</dt><dd>${U.esc(a.note || '—')}</dd></dl></div>
        <div class="modal-f"><button class="btn" data-act="close">Đóng</button></div>`);
    }
  };
  A.ACT['cfg-att-del'] = el => {
    const rec = cfgRecord(el.dataset.cat, el.dataset.id);
    if (!rec) return;
    A.SERVICE_CFG.removeAttachment(rec, el.dataset.att, cfgActor());
    reopenCfgDrawer(el.dataset.cat, el.dataset.id);
    U.toast('Đã xoá tài liệu đính kèm');
  };

  // ---- sửa căn cứ (dùng cho Kỳ thu / Quy tắc thu phí - không có form lớn riêng) ----
  function renderLegalForm() {
    const d = ui.legalForm, lb = d.legalBasis;
    A.modal(A.mHead('Sửa căn cứ') + `<div class="modal-b"><div class="form-grid">
      <div class="field"><label>Số văn bản</label><input class="input" data-ch="lf-docno" value="${U.esc(lb.docNo || '')}"></div>
      <div class="field"><label>Ngày ban hành</label><input class="input" type="date" data-ch="lf-docdate" value="${lb.docDate || ''}"></div>
      <div class="field"><label>Cơ quan ban hành</label><input class="input" data-ch="lf-issuer" value="${U.esc(lb.issuer || '')}"></div>
      <div class="field"><label>Ngày hiệu lực</label><input class="input" type="date" data-ch="lf-effdate" value="${lb.effectiveDate || ''}"></div>
      </div>
      <div class="field" style="margin-top:8px"><label>Trích yếu</label><input class="input" data-ch="lf-summary" value="${U.esc(lb.summary || '')}"></div>
      <div class="field" style="margin-top:8px"><label>Ghi chú</label><input class="input" data-ch="lf-note" value="${U.esc(lb.note || '')}"></div>
      </div>
      <div class="modal-f"><button class="btn" data-act="close">Hủy</button><button class="btn primary" data-act="cfg-legal-save">Lưu</button></div>`);
  }
  A.ACT['cfg-editlegal'] = el => {
    const rec = cfgRecord(el.dataset.cat, el.dataset.id); if (!rec) return;
    ui.legalForm = { cat: el.dataset.cat, id: el.dataset.id, legalBasis: Object.assign({ docNo: '', docDate: '', issuer: '', summary: '', effectiveDate: '', note: '' }, rec.legalBasis) };
    renderLegalForm();
  };
  A.CH['lf-docno'] = el => { ui.legalForm.legalBasis.docNo = el.value; };
  A.CH['lf-docdate'] = el => { ui.legalForm.legalBasis.docDate = el.value; };
  A.CH['lf-issuer'] = el => { ui.legalForm.legalBasis.issuer = el.value; };
  A.CH['lf-effdate'] = el => { ui.legalForm.legalBasis.effectiveDate = el.value; };
  A.CH['lf-summary'] = el => { ui.legalForm.legalBasis.summary = el.value; };
  A.CH['lf-note'] = el => { ui.legalForm.legalBasis.note = el.value; };
  A.ACT['cfg-legal-save'] = () => {
    const d = ui.legalForm, rec = cfgRecord(d.cat, d.id);
    if (!rec) return;
    rec.legalBasis = d.legalBasis;
    A.SERVICE_CFG.log(rec, cfgActor(), 'Cập nhật căn cứ', d.legalBasis.docNo || '');
    ui.legalForm = null;
    A.closeModal(); A.render(); U.toast('Đã cập nhật căn cứ');
  };

  // ---- sub-tab: Kỳ thu ----
  function settingsKyThuHtml() {
    const c = A.SERVICE_CFG.cycle(), canManage = cfgCan('ky-thu'), dis = canManage ? '' : 'disabled';
    return `<div class="card"><div class="card-h"><h3>Kỳ thu</h3></div><div class="card-b">
      <div class="form-grid">
        <div class="field"><label>Chu kỳ thu</label><select class="input" data-ch="bc-cycle" ${dis}><option value="monthly" ${c.cycle === 'monthly' ? 'selected' : ''}>Hàng tháng</option></select></div>
        <div class="field"><label>Ngày chốt chỉ số điện nước</label><input class="input" type="number" min="1" max="31" data-ch="bc-cutoff" value="${c.meterCutoffDay}" ${dis}></div>
        <div class="field"><label>Ngày phát hành khoản phải thu</label><input class="input" type="number" min="1" max="31" data-ch="bc-issue" value="${c.issueDay}" ${dis}></div>
        <div class="field"><label>Hạn nộp</label><input class="input" type="number" min="1" max="31" data-ch="bc-due" value="${c.dueDay}" ${dis}></div>
        <div class="field"><label>Nhắc nợ lần 1 (sau X ngày quá hạn)</label><input class="input" type="number" min="0" data-ch="bc-r1" value="${c.reminder1Days}" ${dis}></div>
        <div class="field"><label>Nhắc nợ lần 2 (sau X ngày quá hạn)</label><input class="input" type="number" min="0" data-ch="bc-r2" value="${c.reminder2Days}" ${dis}></div>
      </div>
      <div class="row" style="margin-top:12px;gap:20px;flex-wrap:wrap">
        <label class="row" style="gap:8px"><input type="checkbox" data-ch="bc-autoissue" ${c.autoIssue ? 'checked' : ''} ${dis}> Tự động phát hành khoản phải thu</label>
        <label class="row" style="gap:8px"><input type="checkbox" data-ch="bc-autoremind" ${c.autoRemind ? 'checked' : ''} ${dis}> Tự động nhắc nợ</label>
      </div>
      <div class="divider"></div><b class="small">CĂN CỨ</b><div style="margin-top:6px">${cfgLegalHtml(c.legalBasis)}</div>
      ${canManage ? `<button class="btn sm" style="margin-top:8px" data-act="cfg-editlegal" data-cat="billingCycle" data-id="cycle">Sửa căn cứ</button>` : ''}
      <div class="divider"></div><b class="small">TÀI LIỆU</b><div style="margin-top:6px">${cfgAttachHtml(c, 'billingCycle', 'cycle', canManage)}</div>
      <div class="divider"></div><b class="small">LỊCH SỬ</b><div style="margin-top:6px">${cfgHistoryHtml(c)}</div>
    </div></div>`;
  }
  A.CH['bc-cycle'] = el => { A.SERVICE_CFG.updateCycle({ cycle: el.value }, cfgActor(), 'Đổi chu kỳ thu'); A.render(); };
  A.CH['bc-cutoff'] = el => { A.SERVICE_CFG.updateCycle({ meterCutoffDay: Number(el.value) || 1 }, cfgActor(), 'Đổi ngày chốt chỉ số'); A.render(); };
  A.CH['bc-issue'] = el => { A.SERVICE_CFG.updateCycle({ issueDay: Number(el.value) || 1 }, cfgActor(), 'Đổi ngày phát hành'); A.render(); };
  A.CH['bc-due'] = el => { A.SERVICE_CFG.updateCycle({ dueDay: Number(el.value) || 1 }, cfgActor(), 'Đổi hạn nộp'); A.render(); };
  A.CH['bc-r1'] = el => { A.SERVICE_CFG.updateCycle({ reminder1Days: Number(el.value) || 0 }, cfgActor(), 'Đổi mốc nhắc nợ lần 1'); A.render(); };
  A.CH['bc-r2'] = el => { A.SERVICE_CFG.updateCycle({ reminder2Days: Number(el.value) || 0 }, cfgActor(), 'Đổi mốc nhắc nợ lần 2'); A.render(); };
  A.CH['bc-autoissue'] = el => { A.SERVICE_CFG.updateCycle({ autoIssue: el.checked }, cfgActor(), el.checked ? 'Bật tự động phát hành' : 'Tắt tự động phát hành'); A.render(); };
  A.CH['bc-autoremind'] = el => { A.SERVICE_CFG.updateCycle({ autoRemind: el.checked }, cfgActor(), el.checked ? 'Bật tự động nhắc nợ' : 'Tắt tự động nhắc nợ'); A.render(); };

  // ---- sub-tab: Quy tắc thu phí ----
  function settingsQuyTacHtml() {
    const r = A.SERVICE_CFG.rules(), canManage = cfgCan('quy-tac-thu-phi'), dis = canManage ? '' : 'disabled';
    return `<div class="card"><div class="card-h"><h3>Quy tắc thu phí</h3></div><div class="card-b">
      <div class="row" style="flex-direction:column;align-items:flex-start;gap:10px">
        <label class="row" style="gap:8px"><input type="checkbox" data-ch="br-adjust" ${r.allowAdjust ? 'checked' : ''} ${dis}> Cho phép điều chỉnh khoản phải thu</label>
        <label class="row" style="gap:8px"><input type="checkbox" data-ch="br-waiver" ${r.allowWaiver ? 'checked' : ''} ${dis}> Cho phép miễn giảm</label>
        <label class="row" style="gap:8px"><input type="checkbox" data-ch="br-reason" ${r.requireReason ? 'checked' : ''} ${dis}> Bắt buộc nhập lý do</label>
        <label class="row" style="gap:8px"><input type="checkbox" data-ch="br-partial" ${r.allowPartialPay ? 'checked' : ''} ${dis}> Cho phép thu một phần</label>
        <label class="row" style="gap:8px"><input type="checkbox" data-ch="br-void" ${r.allowVoidReceipt ? 'checked' : ''} ${dis}> Cho phép huỷ biên lai</label>
        <label class="row" style="gap:8px"><input type="checkbox" data-ch="br-noteadjust" ${r.requireNoteOnAdjust ? 'checked' : ''} ${dis}> Bắt buộc ghi chú khi điều chỉnh</label>
      </div>
      <div class="form-grid" style="margin-top:14px">
        <div class="field"><label>Ngưỡng miễn giảm cần phê duyệt (%)</label><input class="input" type="number" min="0" max="100" data-ch="br-threshold" value="${r.waiverApprovalThreshold}" ${dis}></div>
        <div class="field"><label>Vai trò phê duyệt</label><select class="input" data-ch="br-approver" ${dis}>${A.PERM.roles().map(x => `<option value="${x.id}" ${r.approverRoleId === x.id ? 'selected' : ''}>${U.esc(x.name)}</option>`).join('')}</select></div>
      </div>
      <div class="divider"></div><b class="small">CĂN CỨ</b><div style="margin-top:6px">${cfgLegalHtml(r.legalBasis)}</div>
      ${canManage ? `<button class="btn sm" style="margin-top:8px" data-act="cfg-editlegal" data-cat="billingRules" data-id="rules">Sửa căn cứ</button>` : ''}
      <div class="divider"></div><b class="small">TÀI LIỆU</b><div style="margin-top:6px">${cfgAttachHtml(r, 'billingRules', 'rules', canManage)}</div>
      <div class="divider"></div><b class="small">LỊCH SỬ</b><div style="margin-top:6px">${cfgHistoryHtml(r)}</div>
    </div></div>`;
  }
  A.CH['br-adjust'] = el => { A.SERVICE_CFG.updateRules({ allowAdjust: el.checked }, cfgActor(), el.checked ? 'Bật điều chỉnh khoản phải thu' : 'Tắt điều chỉnh khoản phải thu'); A.render(); };
  A.CH['br-waiver'] = el => { A.SERVICE_CFG.updateRules({ allowWaiver: el.checked }, cfgActor(), el.checked ? 'Bật miễn giảm' : 'Tắt miễn giảm'); A.render(); };
  A.CH['br-reason'] = el => { A.SERVICE_CFG.updateRules({ requireReason: el.checked }, cfgActor(), el.checked ? 'Bật bắt buộc lý do' : 'Tắt bắt buộc lý do'); A.render(); };
  A.CH['br-partial'] = el => { A.SERVICE_CFG.updateRules({ allowPartialPay: el.checked }, cfgActor(), el.checked ? 'Bật thu một phần' : 'Tắt thu một phần'); A.render(); };
  A.CH['br-void'] = el => { A.SERVICE_CFG.updateRules({ allowVoidReceipt: el.checked }, cfgActor(), el.checked ? 'Bật huỷ biên lai' : 'Tắt huỷ biên lai'); A.render(); };
  A.CH['br-noteadjust'] = el => { A.SERVICE_CFG.updateRules({ requireNoteOnAdjust: el.checked }, cfgActor(), el.checked ? 'Bật bắt buộc ghi chú điều chỉnh' : 'Tắt bắt buộc ghi chú điều chỉnh'); A.render(); };
  A.CH['br-threshold'] = el => { A.SERVICE_CFG.updateRules({ waiverApprovalThreshold: Math.max(0, Math.min(100, Number(el.value) || 0)) }, cfgActor(), 'Đổi ngưỡng miễn giảm cần phê duyệt'); A.render(); };
  A.CH['br-approver'] = el => { A.SERVICE_CFG.updateRules({ approverRoleId: el.value }, cfgActor(), 'Đổi vai trò phê duyệt'); A.render(); };

  // ---- router "Cấu hình dịch vụ" ----
  const CFG_TABS = [['gia', 'Đơn giá mặt bằng'], ['dien-nuoc', 'Điện & nước'], ['dich-vu', 'Dịch vụ khác'], ['ky-thu', 'Kỳ thu'], ['quy-tac', 'Quy tắc thu phí']];
  function settingsDongiaHtml() {
    const tab = ui.cfgTab;
    const bar = `<div class="seg" style="margin-bottom:14px">${CFG_TABS.map(t => `<button class="${tab === t[0] ? 'on' : ''}" data-act="cfg-tab" data-id="${t[0]}">${t[1]}</button>`).join('')}</div>`;
    const body = tab === 'dien-nuoc' ? settingsDienNuocHtml()
      : tab === 'dich-vu' ? settingsDichVuHtml()
      : tab === 'ky-thu' ? settingsKyThuHtml()
      : tab === 'quy-tac' ? settingsQuyTacHtml()
      : settingsGiaHtml();
    return bar + body;
  }
  A.ACT['cfg-tab'] = el => { ui.cfgTab = el.dataset.id; A.render(); };
  function settingsTichhopHtml() {
    return `<div class="card"><div class="card-h"><h3>Tích hợp</h3></div><div class="card-b small">
      ${[['Ngân hàng – mã QR động (VietQR), nhận báo có', 'Mô phỏng'], ['Zalo OA – gửi thông báo, biên lai', 'Mô phỏng'], ['SMS brandname', 'Mô phỏng'], ['Biên lai điện tử', 'Mô phỏng'], ['Nền tảng tích hợp, chia sẻ dữ liệu của tỉnh (LGSP)', 'Khi triển khai'], ['Trung tâm điều hành thông minh (IOC)', 'Khi triển khai'], ['Đăng nhập một lần (SSO) dùng chung với các hệ thống của phường', 'Khi triển khai']].map(r => `<div class="row" style="padding:7px 0;border-bottom:1px solid #eef2f0"><span style="flex:1">${r[0]}</span><span class="tag ${r[1] === 'Mô phỏng' ? 'ok' : ''}">${r[1]}</span></div>`).join('')}</div></div>`;
  }
  function settingsVaitroHtml() {
    const selRole = A.PERM.role(ui.permRole) || A.PERM.role('market_manager') || A.PERM.roles()[0];
    const canNew = A.canDo('cai-dat.vai-tro.tao'), canEdit = A.canDo('cai-dat.vai-tro.sua'),
      canToggleRole = A.canDo('cai-dat.vai-tro.khoa'), canDelRole = A.canDo('cai-dat.vai-tro.xoa');
    return `<div class="card"><div class="card-h"><h3>Vai trò và phân quyền</h3><span class="small muted">Nguyên tắc tối thiểu quyền hạn</span>${canNew ? '<button class="btn sm primary" data-act="role-new">+ Thêm vai trò</button>' : ''}</div><div class="card-b">
      ${U.table([{ t: 'Vai trò' }, { t: 'Mô tả' }, { t: 'Số quyền' }, { t: 'Trạng thái' }, { t: '' }], A.PERM.roles().map(r => `<tr>
        <td><b>${U.esc(r.name)}</b>${r.builtin ? ' <span class="tag info">Gốc</span>' : ''}${r.id === ui.role ? ' <span class="tag ok">Đang chọn</span>' : ''}</td>
        <td class="small">${U.esc(r.desc || '')}</td>
        <td class="small">${roleGrantCountLabel(r.id)}</td>
        <td>${r.active ? '<span class="tag ok">Đang dùng</span>' : '<span class="tag">Đã vô hiệu hoá</span>'}</td>
        <td class="nowrap">
          <button class="btn sm ${ui.permRole === r.id ? 'primary' : ''}" data-act="role-perm" data-id="${r.id}">Phân quyền</button>
          ${canEdit ? `<button class="btn sm" data-act="role-edit" data-id="${r.id}">Sửa</button>` : ''}
          ${canToggleRole ? `<button class="btn sm ${r.active ? 'danger' : ''}" data-act="role-toggle" data-id="${r.id}">${r.active ? 'Vô hiệu hoá' : 'Kích hoạt'}</button>` : ''}
          ${!r.builtin && canDelRole ? `<button class="btn sm danger" data-act="role-del" data-id="${r.id}">Xoá</button>` : ''}
        </td></tr>`))}</div></div>
    <div class="card"><div class="card-h"><h3>Phân quyền chi tiết — ${U.esc(selRole.name)}</h3>
      <select class="input" data-ch="perm-role-select">${A.PERM.roles().map(r => `<option value="${r.id}" ${r.id === selRole.id ? 'selected' : ''}>${U.esc(r.name)}</option>`).join('')}</select></div>
      <div class="card-b">${permsMatrixHtml(selRole)}</div></div>`;
  }
  function settingsNhatkyHtml() {
    const log = A.db.extraLog.concat(A.db.audit);
    return `<div class="card"><div class="card-h"><h3>Nhật ký kiểm toán</h3>${A.canDo('cai-dat.reset-demo') ? '<button class="btn danger" data-act="reset">↺ Đặt lại dữ liệu nghiệp vụ mẫu</button>' : ''}</div><div class="card-b">
      ${U.table([{ t: 'Thời điểm' }, { t: 'Người thực hiện' }, { t: 'Thao tác' }], log.slice(0, 25).map(l => `<tr><td class="nowrap">${l.at}</td><td>${U.esc(l.who)}</td><td>${U.esc(l.what)}</td></tr>`))}</div></div>`;
  }
  A.VIEWS['cai-dat'] = function () {
    const tab = ui.settingsTab;
    const body = tab === 'dongia' ? settingsDongiaHtml()
      : tab === 'tichhop' ? settingsTichhopHtml()
      : tab === 'nhatky' ? settingsNhatkyHtml()
      : settingsVaitroHtml();
    return `${settingsTabBar(tab)}${body}`;
  };
  A.ACT['settings-tab'] = el => { ui.settingsTab = el.dataset.id; A.render(); };
  A.CH['perm-role-select'] = el => { ui.permRole = el.value; A.render(); };
  A.CH['perm-toggle'] = el => {
    if (!A.canDo('cai-dat.phan-quyen')) { A.render(); return; }
    const actor = ui.role === 'lanhdao' ? 'Lãnh đạo UBND phường' : 'Trần Minh Khoa';
    const role = A.PERM.role(el.dataset.role), perm = A.PERM.permission(el.dataset.key);
    const roleName = role ? role.name : el.dataset.role, permLabel = perm ? perm.label : el.dataset.key;
    if (el.checked) {
      A.PERM.grant(el.dataset.role, el.dataset.key, actor);
      U.log('Cấp quyền "' + permLabel + '" cho vai trò "' + roleName + '"');
    } else {
      A.PERM.revoke(el.dataset.role, el.dataset.key);
      U.log('Thu hồi quyền "' + permLabel + '" của vai trò "' + roleName + '"');
    }
    A.render();
  };
  A.ACT['role-new'] = () => { if (!A.canDo('cai-dat.vai-tro.tao')) return; ui.roleForm = { id: null, name: '', desc: '', selfService: false }; renderRoleForm(); };
  A.ACT['role-edit'] = el => {
    if (!A.canDo('cai-dat.vai-tro.sua')) return;
    const r = A.PERM.role(el.dataset.id);
    if (!r) return;
    ui.roleForm = { id: r.id, name: r.name, desc: r.desc, selfService: !!r.selfService };
    renderRoleForm();
  };
  A.CH['rf-name'] = el => { ui.roleForm.name = el.value; };
  A.CH['rf-desc'] = el => { ui.roleForm.desc = el.value; };
  A.CH['rf-self'] = el => { ui.roleForm.selfService = el.checked; };
  A.ACT['role-form-save'] = () => {
    const d = ui.roleForm;
    if (!A.canDo(d.id ? 'cai-dat.vai-tro.sua' : 'cai-dat.vai-tro.tao')) return;
    if (!d.name || !d.name.trim()) { U.toast('Vui lòng nhập tên vai trò'); return; }
    // Role.scope/Role.market KHÔNG còn field nào trong form ghi trực tiếp (Phase 5B) — suy ra lại
    // từ selfService để tương thích ngược với các chỗ đọc field này (không bump RBAC_SCHEMA vì
    // đây không phải đổi shape dữ liệu, chỉ đổi UI/nguồn ghi — xem PHASE5A_ACCOUNT_ROLE_SCOPE_AUDIT.md
    // mục 9.4/10). Không còn nhánh scope==='market': field Role.market không có tác dụng
    // authorization runtime nào (đã xác nhận ở audit), luôn ghi null từ đây trở đi.
    const patch = { name: d.name.trim(), desc: (d.desc || '').trim(), scope: d.selfService ? 'self' : 'all', market: null, selfService: !!d.selfService };
    if (d.id) {
      A.PERM.updateRole(d.id, patch);
      U.log('Cập nhật thông tin vai trò "' + patch.name + '"');
      U.toast('Đã cập nhật vai trò "' + patch.name + '"');
    } else {
      let id = slugify(d.name), n = 1;
      while (A.PERM.role(id)) { id = slugify(d.name) + '-' + (++n); }
      A.PERM.addRole(Object.assign({ id: id, builtin: false, active: true }, patch));
      ui.permRole = id;
      U.log('Thêm vai trò mới "' + patch.name + '"');
      U.toast('Đã thêm vai trò "' + patch.name + '"');
    }
    ui.roleForm = null;
    A.closeModal(); A.render();
  };
  A.ACT['role-toggle'] = el => {
    if (!A.canDo('cai-dat.vai-tro.khoa')) return;
    const r = A.PERM.role(el.dataset.id);
    if (!r) return;
    if (r.active && r.id === ui.role) { U.toast('Không thể vô hiệu hoá vai trò đang được sử dụng. Hãy chuyển sang vai trò khác trước.'); return; }
    const wasActive = r.active;
    A.PERM.setRoleActive(r.id, !wasActive);
    U.log((wasActive ? 'Vô hiệu hoá' : 'Kích hoạt lại') + ' vai trò "' + r.name + '"');
    A.render();
    U.toast(wasActive ? 'Đã vô hiệu hoá vai trò "' + r.name + '"' : 'Đã kích hoạt lại vai trò "' + r.name + '"');
  };
  A.ACT['role-perm'] = el => { ui.permRole = el.dataset.id; A.render(); };
  A.ACT['role-del'] = el => {
    if (!A.canDo('cai-dat.vai-tro.xoa')) return;
    const r = A.PERM.role(el.dataset.id);
    if (!r) return;
    if (r.builtin) { U.toast('Không thể xoá vai trò gốc của hệ thống.'); return; }
    if (r.id === ui.role) { U.toast('Không thể xoá vai trò đang được sử dụng. Hãy chuyển sang vai trò khác trước.'); return; }
    A.modal(A.mHead('Xoá vai trò') + `<div class="modal-b">Xoá vai trò <b>${U.esc(r.name)}</b> và toàn bộ quyền đã gán cho vai trò này? Thao tác này không thể hoàn tác.</div>
      <div class="modal-f"><button class="btn" data-act="close">Hủy</button><button class="btn danger" data-act="role-del-ok" data-id="${r.id}">Xoá vai trò</button></div>`);
  };
  A.ACT['role-del-ok'] = el => {
    if (!A.canDo('cai-dat.vai-tro.xoa')) return;
    const r = A.PERM.role(el.dataset.id);
    if (!r || r.builtin || r.id === ui.role) { A.closeModal(); A.render(); return; }
    const name = r.name;
    A.PERM.removeRole(el.dataset.id);
    if (ui.permRole === el.dataset.id) ui.permRole = 'market_manager'; // RBAC V1: 'bql' cũ đã bị thay bằng 8 role mới
    U.log('Xoá vai trò "' + name + '"');
    A.closeModal(); A.render(); U.toast('Đã xoá vai trò "' + name + '"');
  };
  A.ACT.reset = () => {
    if (!A.canDo('cai-dat.reset-demo')) return;
    // Phase 5B: chỉ làm rõ label/helper text — hành vi A.resetAll() KHÔNG đổi (chỉ reset business
    // mock data, KHÔNG đụng Account/Role/Permission — xem core.js). KHÔNG gọi thêm
    // A.ACCOUNTS.resetDefault()/A.PERM.resetDefault() ở đây (quyết định đã chốt Phase 5B mục 17).
    A.modal(A.mHead('Đặt lại dữ liệu nghiệp vụ mẫu') + `<div class="modal-b">Mọi thao tác đã làm trong lúc xem (thu tiền, phản ánh, hợp đồng…) sẽ bị xóa và quay về dữ liệu mẫu ban đầu.
      <div class="note info" style="margin-top:10px">Không ảnh hưởng tài khoản, vai trò và phân quyền.</div></div>
    <div class="modal-f"><button class="btn" data-act="close">Hủy</button><button class="btn danger" data-act="reset-ok">Đặt lại</button></div>`);
  };
  A.ACT['reset-ok'] = () => { if (!A.canDo('cai-dat.reset-demo')) return; A.resetAll(); A.closeModal(); A.render(); U.toast('Đã đặt lại dữ liệu nghiệp vụ mẫu'); };
})(window.APP);

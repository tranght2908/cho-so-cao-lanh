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
  if (!ui.bankAcc) ui.bankAcc = { search: '', status: '', sortKey: null, sortDir: 'asc' };
  if (!ui.baSel) ui.baSel = [];

  // ---------- Phản ánh & sự cố ----------
  A.VIEWS['su-co'] = function () {
    const all = A.db.incidents.filter(i => U.inM(i) && (!ui.incCat || i.cat === ui.incCat));
    const cats = Array.from(new Set(A.db.incidents.map(i => i.cat)));
    const done = A.db.incidents.filter(i => U.inM(i) && i.rating);
    return `<div class="kpis">
      <div class="card kpi"><div class="k-label">Đang xử lý</div><div class="k-value">${all.filter(isOpen).length}</div><div class="k-sub">trên tổng ${all.length} phản ánh</div></div>
      <div class="card kpi"><div class="k-label">Quá hạn</div><div class="k-value" style="color:#df2225">${all.filter(late).length}</div><div class="k-sub">Điện, PCCC: 24 giờ · khác: 3 ngày</div></div>
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
        ${[['Phát hành khoản phải thu', 'Mini app, Zalo OA'], ['Trước hạn nộp 3 ngày', 'Mini app, Zalo OA'], ['Khoản phải thu quá hạn', 'Mini app, Zalo OA, SMS'], ['Hợp đồng còn 30 ngày hết hạn', 'Mini app, Zalo OA'], ['Phản ánh được xử lý xong', 'Mini app'], ['Biên lai điện tử sau khi thanh toán', 'Mini app, Zalo OA']].map(r => `<div class="row" style="padding:7px 0;border-bottom:1px solid #eef2f7"><span class="tag ok">Bật</span><span style="flex:1">${r[0]}</span><span class="muted">${r[1]}</span></div>`).join('')}</div></div></div>
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
  A.VIEWS['bao-cao'] = function () {
    // Báo cáo thống kê = màn cross-market (A.SCREEN_MARKET['bao-cao'] === 'CROSS') — dùng bộ lọc
    // nội bộ A.xmMarket()/A.xmScopeBar() thay vì bị chặn/giới hạn theo selectedMarket (mục 9 Phase 2).
    const xmMkt = A.xmMarket();
    const R = reports(xmMkt), key = R[ui.report] ? ui.report : 'lapday', r = R[key];
    const rp = ui.rp || (ui.rp = { from: '2026-09-01', to: U.today() });
    let chart = '';
    if (r.chart === 'doanhthu') chart = U.bars(r.rows.map(x => x[0]), [{ name: 'Phải thu', values: r.rows.map(x => x[2]), color: '#bcd6f5' }, { name: 'Đã thu', values: r.rows.map(x => x[3]), color: '#0961bb' }], { stacked: false });
    else if (r.chart === 'khongtienmat') chart = U.bars(r.rows.map(x => x[0]), [{ name: 'Không tiền mặt %', values: r.rows.map(x => x[4]), color: '#0961bb' }], { stacked: false, max: 100, fmt: v => Math.round(v) + '%' });
    else if (RP_CHART[key] && r.rows.length) { const [lc, vc, kind] = RP_CHART[key]; chart = U.bars(r.rows.map(x => String(x[lc]).replace(/^Khu /, '')), [{ name: r.cols[vc].replace(/ \(đ\)/, ''), values: r.rows.map(x => x[vc]), color: '#0961bb' }], { stacked: false, max: kind === '%' ? 100 : null, fmt: kind === '%' ? v => Math.round(v) + '%' : kind === 'đ' ? U.moneyShort : v => num(v) }); }
    const hasMoney = r.cols.some(c => /\(đ\)/.test(c));
    const cols = r.cols.map(c => c.replace(/ \(đ\)/, ''));
    const numCol = k => k > 0 && typeof (r.rows[0] || [])[k] === 'number';
    const tot = rpTotals(key, r);
    const kpis = rpKpis(key, r.rows);
    const scopeName = xmMkt === 'ALL' ? 'Chợ Cao Lãnh và Chợ quê Cù lao Tân Thuận Đông' : U.market(xmMkt).name;
    const allowed = A.allowedMarkets(A.currentAccount());
    const who = A.currentAccount ? A.currentAccount() : null;
    return `<div class="rp-page-h"><h2>Báo cáo thống kê</h2><div class="muted">Tạo, xem trước và xuất các báo cáo quản lý chợ</div></div>
    <div class="grid g-report rp-grid">
      <div class="card no-print"><div class="card-h"><h3>Mẫu báo cáo</h3></div><div class="card-b rp-list">${Object.keys(R).map(k => `<button class="rp-item ${key === k ? 'on' : ''}" data-act="rp" data-id="${k}"><span class="rp-ico">📄</span><span><b>${R[k].t}</b><small>${RP_SUB[k] || ''}</small></span></button>`).join('')}</div></div>
      <div class="rp-right">
        <div class="card no-print"><div class="card-h"><h3>Cấu hình báo cáo</h3></div><div class="card-b rp-cfg">
          <div class="field"><label>Từ ngày</label><input type="date" class="input" data-ch="rp-cfg" data-k="from" value="${rp.from}"></div>
          <div class="field"><label>Đến ngày</label><input type="date" class="input" data-ch="rp-cfg" data-k="to" value="${rp.to}"></div>
          <div class="field"><label>Chợ</label><select class="input" data-ch="rp-scope" ${allowed.length <= 1 ? 'disabled' : ''}>${allowed.length > 1 ? `<option value="ALL" ${xmMkt === 'ALL' ? 'selected' : ''}>Tất cả chợ</option>` : ''}${allowed.map(id => `<option value="${id}" ${xmMkt === id ? 'selected' : ''}>${U.esc(U.market(id).name)}</option>`).join('')}</select></div>
          <div class="field"><label>Đơn vị lập</label><select class="input"><option>Ban Quản lý chợ</option><option>UBND phường Cao Lãnh</option></select></div>
        </div></div>
        <div class="card rp-card"><div class="card-h no-print"><h3>👁 Xem trước: ${U.esc(r.t)}</h3><span class="spacer"></span><button class="btn" data-act="print">⬇ Xuất PDF</button><button class="btn" data-act="rp-csv">📊 Excel</button><button class="btn" data-act="print">🖨 In</button><button class="btn" data-act="rp-save">💾 Lưu mẫu</button></div>
          <div class="card-b"><div class="rp-preview">
            <div class="rp-org">UBND PHƯỜNG CAO LÃNH · BAN QUẢN LÝ CHỢ</div>
            <h2 class="rp-title">${U.esc(r.t.toUpperCase())}</h2>
            <div class="rp-period">Kỳ báo cáo: ${U.dmy(rp.from)} – ${U.dmy(rp.to)} · Phạm vi: ${U.esc(scopeName)}${hasMoney ? ' · Đơn vị tính: đồng' : ''}</div>
            <div class="rp-kpis">${kpis.map(k => `<div class="rp-kpi"><div class="l">${k[0]}</div><div class="v">${k[1]}</div></div>`).join('')}</div>
            ${chart ? `<div class="rp-block"><div class="rp-block-h">📊 Biểu đồ tổng hợp</div>${chart}</div>` : ''}
            <div class="rp-block"><div class="rp-block-h">📋 Bảng dữ liệu tổng hợp</div>
              <div class="tbl-wrap"><table class="tbl rp-tbl"><thead><tr><th class="num rp-stt">STT</th>${cols.map((c, k) => `<th class="${numCol(k) ? 'num' : ''}">${U.esc(c)}</th>`).join('')}</tr></thead>
              <tbody>${r.rows.length ? r.rows.map((row, i) => `<tr><td class="num rp-stt">${i + 1}</td>${row.map((v, k) => `<td class="${typeof v === 'number' ? 'num' : ''} ${k === 0 ? 'rp-first' : ''}">${fmtCell(v, r.cols[k])}</td>`).join('')}</tr>`).join('') : `<tr><td colspan="${cols.length + 1}" class="empty">Không có dữ liệu trong phạm vi đã chọn</td></tr>`}</tbody>
              ${tot ? `<tfoot><tr class="rp-total"><td></td>${tot.map((v, k) => `<td class="${typeof v === 'number' ? 'num' : ''}">${v === '' ? '' : fmtCell(v, r.cols[k])}</td>`).join('')}</tr></tfoot>` : ''}</table></div></div>
            <div class="rp-sign print-only"><div><div class="rp-sign-t">NGƯỜI LẬP BIỂU</div><div class="rp-sign-s">(Ký, ghi rõ họ tên)</div><div class="rp-sign-n">${U.esc(who && (who.accountType === 'Ban Quản lý chợ' || who.accountType === 'Nhân viên Ban Quản lý chợ') ? who.fullName : 'Lê Thị Ngọc Hân')}</div></div><div><div class="rp-sign-t">TRƯỞNG BAN QUẢN LÝ CHỢ</div><div class="rp-sign-s">(Ký, đóng dấu)</div><div class="rp-sign-n">Trần Minh Khoa</div></div></div>
            <div class="small muted rp-note">Số liệu sinh tự động từ dữ liệu nghiệp vụ của hệ thống lúc ${U.nowTime()} ngày ${U.dmy(U.today())}.</div>
          </div></div></div>
      </div></div>`;
  };
  A.CH['rp-cfg'] = el => { ui.rp[el.dataset.k] = el.value; A.render(); };
  A.CH['rp-scope'] = el => { A.ACT['xm-scope']({ dataset: { id: el.value } }); };
  A.ACT['rp-save'] = () => U.toast('Đã lưu mẫu báo cáo (mô phỏng)');
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
        <div><h3>${U.esc(a.fullName)}</h3><div class="small muted">${U.esc(a.code)} · ${a.status === 'active' ? '<span class="tag ok">Hoạt động</span>' : '<span class="tag danger">Tạm khoá</span>'}</div></div>
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
      <div><h3 style="margin:0;font-size:var(--font-size-md)">Tài khoản người dùng</h3><div class="small muted">Quản lý và tra cứu các tài khoản được phép sử dụng hệ thống.</div></div>
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

  // Phase 6 STEP A: 3 tab giá (Đơn giá mặt bằng/Điện & nước/Dịch vụ khác) đã chuyển sang màn
  // "Chính sách thu và biểu phí" độc lập trong nhóm Tài chính (A.VIEWS['cau-hinh-gia']) — xem
  // SERVICE_PRICING_SCREEN_AUDIT.md mục 9/10. Kỳ thu/Quy tắc thu phí GIỮ NGUYÊN trong Cài đặt,
  // nay lên thẳng tab cấp 1 (trước đây nằm sau 2 cấp: Cài đặt → Cấu hình dịch vụ → Kỳ thu).
  const SETTINGS_TABS = [['kythu', 'Kỳ thu'], ['quytac', 'Quy tắc thu phí'], ['vaitro', 'Vai trò & phân quyền'], ['tichhop', 'Tích hợp'], ['nhatky', 'Nhật ký kiểm toán']];
  function settingsTabBar(tab) {
    return `<div class="seg">${SETTINGS_TABS.map(t => `<button class="${tab === t[0] ? 'on' : ''}" data-act="settings-tab" data-id="${t[0]}">${t[1]}</button>`).join('')}</div>`;
  }
  // ---- Chính sách thu và biểu phí: tiện ích dùng chung ----
  const CFG_CALC_LABELS = { fixed: 'Cố định / kỳ', area: 'Theo diện tích', qty: 'Theo số lượng', session: 'Theo phiên' };
  const CFG_MARKET_MODEL_LABELS = { FIXED_MONTHLY: 'Chợ cố định · thu theo tháng', MARKET_SESSION: 'Chợ phiên · thu theo phiên họp chợ' };
  const CFG_CYCLE_LABELS = { MONTH: 'Tháng', SESSION: 'Phiên', DAY: 'Ngày' };
  const CFG_TAX_LABELS = { TAXABLE_REVENUE: 'Doanh thu chịu thuế', PASS_THROUGH_NON_TAX: 'Thu hộ, không chịu thuế' };
  // Kỳ thu / Quy tắc thu phí GIỮ NGUYÊN permission cũ (cai-dat.ky-thu/cai-dat.quy-tac-thu-phi) —
  // không đổi ở Phase 6 STEP A (xem SERVICE_PRICING_SCREEN_AUDIT.md mục 11).
  function cfgCan(action) { return A.PERM.canAction(ui.role, 'cai-dat.' + action); }
  function cfgActor() { const acc = A.currentAccount(); return acc ? acc.fullName : 'Không rõ'; }
  function cfgDefaultMarketModel(marketId) { return marketId === 'TTD' ? 'MARKET_SESSION' : 'FIXED_MONTHLY'; }
  function cfgDefaultCycle(marketId) { return marketId === 'TTD' ? 'SESSION' : 'MONTH'; }
  function cfgWaiverName(id) {
    if (!id) return 'Không áp dụng';
    const item = A.SERVICE_CFG.waiverTypes().find(x => x.id === id);
    return item ? item.name : 'Tham chiếu không còn tồn tại';
  }
  // 3 nhóm giá (stallPrices/utilities/extraServices) dùng action key MỚI cau-hinh-gia.* + market
  // scope thật (Phase 6 STEP A) — khác hẳn cfgCan() ở trên (không có market, dùng cho ky-thu/quy-tac).
  function cfgGiaActionKey(cat) {
    return { stallPrices: 'cau-hinh-gia.mat-bang', utilities: 'cau-hinh-gia.dien-nuoc', extraServices: 'cau-hinh-gia.dich-vu-khac' }[cat] || null;
  }
  // rec=null nghĩa là đang TẠO MỚI (chưa có bản ghi) — kiểm theo ui.market hiện tại. rec có sẵn
  // (đang Sửa/Vô hiệu hoá/đính kèm tài liệu) — kiểm theo đúng market của CHÍNH bản ghi đó (không
  // phải ui.market), để 1 forge handler đổi ui.market không thể lách qua bản ghi thuộc chợ khác.
  // Bản ghi legacy marketId:'ALL' (chỉ extraServices) LUÔN read-only — không tự suy đoán bản ghi đó
  // thuộc chợ nào (mục 8 SERVICE_PRICING_SCREEN_AUDIT.md) — admin phải tạo bản ghi mới rõ ràng
  // theo từng chợ nếu cần tách.
  function cfgPriceMutateAllowed(cat, rec) {
    const key = cfgGiaActionKey(cat);
    if (!key) return false;
    if (rec && (rec.marketId === 'ALL' || rec.status === 'expired')) return false;
    return A.canDo(key, rec ? rec.marketId : ui.market);
  }
  function cfgStatusTag(s) {
    if (s === 'active') return '<span class="tag ok">Đang áp dụng</span>';
    if (s === 'expired') return '<span class="tag info">Đã hết hiệu lực</span>';
    return '<span class="tag">Đã vô hiệu hoá</span>';
  }
  function cfgPolicyDetailHtml(r) {
    return `<dt>Mô hình áp dụng</dt><dd>${U.esc(CFG_MARKET_MODEL_LABELS[r.marketModel] || r.marketModel || '—')}</dd>
      <dt>Chu kỳ thu</dt><dd>${U.esc(CFG_CYCLE_LABELS[r.collectionCycle] || r.collectionCycle || '—')}</dd>
      <dt>Phân loại thuế</dt><dd>${U.esc(CFG_TAX_LABELS[r.taxClass] || r.taxClass || '—')}</dd>
      <dt>Loại miễn giảm</dt><dd>${U.esc(cfgWaiverName(r.waiverTypeId))}</dd>`;
  }
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
      ${list.length ? list.map(a => `<div class="row" style="padding:5px 0;border-bottom:1px solid #eef2f7">
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
    const canNew = cfgPriceMutateAllowed('stallPrices', null);
    const rows = A.SERVICE_CFG.list('stallPrices').filter(r => r.marketId === ui.market);
    return `<div class="card"><div class="card-h"><h3>Đơn giá mặt bằng · ${U.esc(U.market(ui.market).name)}</h3>${canNew ? '<button class="btn sm primary" data-act="cfg-price-new">+ Thêm đơn giá</button>' : ''}</div>
      <div class="card-b">${U.table([{ t: 'Chợ / mô hình' }, { t: 'Khu vực / loại điểm' }, { t: 'Mức giá', num: true }, { t: 'Đơn vị / chu kỳ' }, { t: 'Phân loại thuế' }, { t: 'Hiệu lực / căn cứ' }, { t: 'Miễn giảm' }, { t: 'Trạng thái' }, { t: '' }],
        rows.map(r => { const canManage = cfgPriceMutateAllowed('stallPrices', r); return `<tr>
          <td>${U.mShort(r.marketId)}<div class="small muted">${U.esc(CFG_MARKET_MODEL_LABELS[r.marketModel] || '—')}</div></td>
          <td class="small">${U.esc(r.area)}<div class="muted">${U.esc(r.stallType)}</div></td>
          <td class="num">${r.amount.toLocaleString('vi-VN')}</td><td class="small nowrap">${U.esc(r.unit)}<div class="muted">Chu kỳ: ${U.esc(CFG_CYCLE_LABELS[r.collectionCycle] || '—')}</div></td>
          <td class="small">${U.esc(CFG_TAX_LABELS[r.taxClass] || '—')}</td>
          <td class="nowrap">${U.dmy(r.effectiveFrom)}${r.effectiveTo ? `<div class="small muted">đến ${U.dmy(r.effectiveTo)}</div>` : ''}<div class="small">${r.legalBasis && r.legalBasis.docNo ? U.esc(r.legalBasis.docNo) : '<span class="muted">—</span>'}</div></td>
          <td class="small">${U.esc(cfgWaiverName(r.waiverTypeId))}</td>
          <td>${cfgStatusTag(r.status)}</td>
          <td class="nowrap"><button class="btn sm" data-act="cfg-price-view" data-id="${r.id}">Xem</button>
            ${canManage ? `<button class="btn sm" data-act="cfg-price-edit" data-id="${r.id}">Sửa</button><button class="btn sm ${r.status === 'active' ? 'danger' : ''}" data-act="cfg-price-toggle" data-id="${r.id}">${r.status === 'active' ? 'Vô hiệu hoá' : 'Kích hoạt'}</button>` : ''}
          </td></tr>`; }), { empty: 'Chưa có đơn giá nào cho ' + U.market(ui.market).short })}</div></div>`;
  }
  function cfgPriceDrawerHtml(r) {
    const canManage = cfgPriceMutateAllowed('stallPrices', r);
    return `<div class="drawer-h"><div><h3>Đơn giá mặt bằng</h3><div class="small muted">${U.mShort(r.marketId)} · ${cfgStatusTag(r.status)}</div></div><span class="spacer"></span><button class="x" data-act="close" aria-label="Đóng">×</button></div>
      <div class="drawer-b">
        <dl class="kv"><dt>Chợ</dt><dd>${U.esc(U.market(r.marketId).name)}</dd><dt>Khu vực</dt><dd>${U.esc(r.area)}</dd>
          <dt>Loại điểm</dt><dd>${U.esc(r.stallType)}</dd>${cfgPolicyDetailHtml(r)}<dt>Mức giá</dt><dd><b>${r.amount.toLocaleString('vi-VN')} ${U.esc(r.unit)}</b></dd>
          <dt>Hiệu lực từ</dt><dd>${U.dmy(r.effectiveFrom)}</dd>${r.effectiveTo ? `<dt>Hết hiệu lực</dt><dd>${U.dmy(r.effectiveTo)}</dd>` : ''}</dl>
        <div class="divider"></div><b class="small">CĂN CỨ</b><div style="margin-top:6px">${cfgLegalHtml(r.legalBasis)}</div>
        <div class="divider"></div><b class="small">TÀI LIỆU</b><div style="margin-top:6px">${cfgAttachHtml(r, 'stallPrices', r.id, canManage)}</div>
        <div class="divider"></div><b class="small">LỊCH SỬ</b><div style="margin-top:6px">${cfgHistoryHtml(r)}</div>
      </div>
      <div class="drawer-f">${canManage ? `<button class="btn primary" data-act="cfg-price-edit" data-id="${r.id}">Chỉnh sửa</button>` : ''}<button class="btn" data-act="close">Đóng</button></div>`;
  }
  A.ACT['cfg-price-view'] = el => { const r = A.SERVICE_CFG.get('stallPrices', el.dataset.id); if (!r) return; A.$('#modal-root').innerHTML = `<div class="drawer-overlay" data-act="close"></div><div class="drawer">${cfgPriceDrawerHtml(r)}</div>`; };
  A.ACT['cfg-price-new'] = () => {
    if (!cfgPriceMutateAllowed('stallPrices', null)) return;
    ui.cfgForm = { cat: 'stallPrices', id: null, marketId: ui.market, area: '', stallType: '', marketModel: cfgDefaultMarketModel(ui.market), collectionCycle: cfgDefaultCycle(ui.market), amount: 0, unit: ui.market === 'TTD' ? 'đ/phiên' : 'đ/m²/tháng', taxClass: 'TAXABLE_REVENUE', waiverTypeId: null, effectiveFrom: A.db.today, status: 'active', legalBasis: { docNo: '', docDate: '', issuer: '', summary: '', effectiveDate: '', note: '' } };
    renderCfgForm();
  };
  A.ACT['cfg-price-edit'] = el => {
    const r = A.SERVICE_CFG.get('stallPrices', el.dataset.id); if (!r) return;
    if (!cfgPriceMutateAllowed('stallPrices', r)) return;
    ui.cfgForm = { cat: 'stallPrices', id: r.id, marketId: r.marketId, area: r.area, stallType: r.stallType, marketModel: r.marketModel, collectionCycle: r.collectionCycle, amount: r.amount, unit: r.unit, taxClass: r.taxClass, waiverTypeId: r.waiverTypeId || null, effectiveFrom: r.effectiveFrom, status: r.status, legalBasis: Object.assign({ docNo: '', docDate: '', issuer: '', summary: '', effectiveDate: '', note: '' }, r.legalBasis) };
    renderCfgForm();
  };
  A.ACT['cfg-price-toggle'] = el => {
    const r = A.SERVICE_CFG.get('stallPrices', el.dataset.id); if (!r) return;
    if (!cfgPriceMutateAllowed('stallPrices', r)) return;
    const was = r.status;
    A.SERVICE_CFG.setStatus('stallPrices', r.id, was === 'active' ? 'inactive' : 'active', cfgActor());
    A.render(); U.toast(was === 'active' ? 'Đã vô hiệu hoá đơn giá' : 'Đã kích hoạt lại đơn giá');
  };

  // ---- sub-tab: Điện & nước ----
  function settingsDienNuocHtml() {
    const canNew = cfgPriceMutateAllowed('utilities', null);
    const rows = A.SERVICE_CFG.list('utilities').filter(r => r.marketId === ui.market);
    return `<div class="card"><div class="card-h"><h3>Điện & nước · ${U.esc(U.market(ui.market).name)}</h3>${canNew ? '<button class="btn sm primary" data-act="cfg-util-new">+ Thêm cấu hình</button>' : ''}</div>
      <div class="card-b">${U.table([{ t: 'Chợ / mô hình' }, { t: 'Mức giá điện', num: true }, { t: 'Mức giá nước', num: true }, { t: 'Chu kỳ thu' }, { t: 'Phân loại thuế' }, { t: 'Hiệu lực / căn cứ' }, { t: 'Miễn giảm' }, { t: 'Trạng thái' }, { t: '' }],
        rows.map(r => { const canManage = cfgPriceMutateAllowed('utilities', r); return `<tr>
          <td>${U.mShort(r.marketId)}<div class="small muted">${U.esc(CFG_MARKET_MODEL_LABELS[r.marketModel] || '—')}</div></td><td class="num">${r.elecPrice.toLocaleString('vi-VN')}<div class="small muted">${U.esc(r.elecUnit || 'đ/kWh')}</div></td><td class="num">${r.waterPrice.toLocaleString('vi-VN')}<div class="small muted">${U.esc(r.waterUnit || 'đ/m³')}</div></td>
          <td class="small">${U.esc(CFG_CYCLE_LABELS[r.collectionCycle] || '—')}</td><td class="small">${U.esc(CFG_TAX_LABELS[r.taxClass] || '—')}</td><td class="nowrap">${U.dmy(r.effectiveFrom)}${r.effectiveTo ? `<div class="small muted">đến ${U.dmy(r.effectiveTo)}</div>` : ''}<div class="small">${r.legalBasis && r.legalBasis.docNo ? U.esc(r.legalBasis.docNo) : '<span class="muted">—</span>'}</div></td><td class="small">${U.esc(cfgWaiverName(r.waiverTypeId))}</td>
          <td>${cfgStatusTag(r.status)}</td>
          <td class="nowrap"><button class="btn sm" data-act="cfg-util-view" data-id="${r.id}">Xem</button>
            ${canManage ? `<button class="btn sm" data-act="cfg-util-edit" data-id="${r.id}">Sửa</button><button class="btn sm ${r.status === 'active' ? 'danger' : ''}" data-act="cfg-util-toggle" data-id="${r.id}">${r.status === 'active' ? 'Vô hiệu hoá' : 'Kích hoạt'}</button>` : ''}
          </td></tr>`; }), { empty: 'Chưa có cấu hình điện nước cho ' + U.market(ui.market).short })}</div></div>`;
  }
  function cfgUtilDrawerHtml(r) {
    const canManage = cfgPriceMutateAllowed('utilities', r);
    return `<div class="drawer-h"><div><h3>Điện & nước</h3><div class="small muted">${U.mShort(r.marketId)} · ${cfgStatusTag(r.status)}</div></div><span class="spacer"></span><button class="x" data-act="close" aria-label="Đóng">×</button></div>
      <div class="drawer-b">
        <dl class="kv"><dt>Chợ</dt><dd>${U.esc(U.market(r.marketId).name)}</dd>${cfgPolicyDetailHtml(r)}<dt>Giá điện</dt><dd><b>${r.elecPrice.toLocaleString('vi-VN')} ${U.esc(r.elecUnit || 'đ/kWh')}</b></dd>
          <dt>Giá nước</dt><dd><b>${r.waterPrice.toLocaleString('vi-VN')} ${U.esc(r.waterUnit || 'đ/m³')}</b></dd><dt>Hiệu lực từ</dt><dd>${U.dmy(r.effectiveFrom)}</dd>${r.effectiveTo ? `<dt>Hết hiệu lực</dt><dd>${U.dmy(r.effectiveTo)}</dd>` : ''}</dl>
        <div class="divider"></div><b class="small">CĂN CỨ</b><div style="margin-top:6px">${cfgLegalHtml(r.legalBasis)}</div>
        <div class="divider"></div><b class="small">TÀI LIỆU</b><div style="margin-top:6px">${cfgAttachHtml(r, 'utilities', r.id, canManage)}</div>
        <div class="divider"></div><b class="small">LỊCH SỬ</b><div style="margin-top:6px">${cfgHistoryHtml(r)}</div>
      </div>
      <div class="drawer-f">${canManage ? `<button class="btn primary" data-act="cfg-util-edit" data-id="${r.id}">Chỉnh sửa</button>` : ''}<button class="btn" data-act="close">Đóng</button></div>`;
  }
  A.ACT['cfg-util-view'] = el => { const r = A.SERVICE_CFG.get('utilities', el.dataset.id); if (!r) return; A.$('#modal-root').innerHTML = `<div class="drawer-overlay" data-act="close"></div><div class="drawer">${cfgUtilDrawerHtml(r)}</div>`; };
  A.ACT['cfg-util-new'] = () => {
    if (!cfgPriceMutateAllowed('utilities', null)) return;
    ui.cfgForm = { cat: 'utilities', id: null, marketId: ui.market, marketModel: cfgDefaultMarketModel(ui.market), collectionCycle: cfgDefaultCycle(ui.market), elecPrice: D.ELEC, elecUnit: 'đ/kWh', waterPrice: D.WATER, waterUnit: 'đ/m³', taxClass: 'PASS_THROUGH_NON_TAX', waiverTypeId: null, effectiveFrom: A.db.today, status: 'active', legalBasis: { docNo: '', docDate: '', issuer: '', summary: '', effectiveDate: '', note: '' } };
    renderCfgForm();
  };
  A.ACT['cfg-util-edit'] = el => {
    const r = A.SERVICE_CFG.get('utilities', el.dataset.id); if (!r) return;
    if (!cfgPriceMutateAllowed('utilities', r)) return;
    ui.cfgForm = { cat: 'utilities', id: r.id, marketId: r.marketId, marketModel: r.marketModel, collectionCycle: r.collectionCycle, elecPrice: r.elecPrice, elecUnit: r.elecUnit || 'đ/kWh', waterPrice: r.waterPrice, waterUnit: r.waterUnit || 'đ/m³', taxClass: r.taxClass, waiverTypeId: r.waiverTypeId || null, effectiveFrom: r.effectiveFrom, status: r.status, legalBasis: Object.assign({ docNo: '', docDate: '', issuer: '', summary: '', effectiveDate: '', note: '' }, r.legalBasis) };
    renderCfgForm();
  };
  A.ACT['cfg-util-toggle'] = el => {
    const r = A.SERVICE_CFG.get('utilities', el.dataset.id); if (!r) return;
    if (!cfgPriceMutateAllowed('utilities', r)) return;
    const was = r.status;
    A.SERVICE_CFG.setStatus('utilities', r.id, was === 'active' ? 'inactive' : 'active', cfgActor());
    A.render(); U.toast(was === 'active' ? 'Đã vô hiệu hoá cấu hình điện nước' : 'Đã kích hoạt lại');
  };

  // ---- sub-tab: Dịch vụ khác ----
  // Legacy marketId:'ALL' (mục 8 SERVICE_PRICING_SCREEN_AUDIT.md): vẫn hiển thị ở MỌI selectedMarket
  // (không lọc mất — "không mất dữ liệu"), nhưng LUÔN read-only (cfgPriceMutateAllowed trả false
  // cho rec.marketId==='ALL') kèm nhãn rõ ràng, không tự suy đoán quy về CL/TTD.
  function cfgAllBadge(r) { return r.marketId === 'ALL' ? ' <span class="tag warn" title="Bản ghi cũ trước Phase 6, áp dụng nhiều chợ — chỉ xem, tạo bản ghi mới theo từng chợ nếu cần tách">Dữ liệu cũ · nhiều chợ</span>' : ''; }
  function settingsDichVuHtml() {
    const canNew = cfgPriceMutateAllowed('extraServices', null);
    const rows = A.SERVICE_CFG.list('extraServices').filter(r => r.marketId === ui.market || r.marketId === 'ALL');
    return `<div class="card"><div class="card-h"><h3>Dịch vụ khác · ${U.esc(U.market(ui.market).name)}</h3>${canNew ? '<button class="btn sm primary" data-act="cfg-svc-new">+ Thêm dịch vụ</button>' : ''}</div>
      <div class="card-b">${U.table([{ t: 'Tên dịch vụ' }, { t: 'Chợ / mô hình' }, { t: 'Cách tính' }, { t: 'Mức giá', num: true }, { t: 'Đơn vị / chu kỳ' }, { t: 'Phân loại thuế' }, { t: 'Hiệu lực / căn cứ' }, { t: 'Miễn giảm' }, { t: 'Trạng thái' }, { t: '' }],
        rows.map(r => { const canManage = cfgPriceMutateAllowed('extraServices', r); return `<tr>
          <td><b>${U.esc(r.name)}</b>${cfgAllBadge(r)}</td><td>${r.marketId === 'ALL' ? 'Tất cả chợ (cũ)' : U.mShort(r.marketId)}<div class="small muted">${U.esc(CFG_MARKET_MODEL_LABELS[r.marketModel] || '—')}</div></td><td class="small">${CFG_CALC_LABELS[r.calcMethod] || r.calcMethod}</td>
          <td class="num">${r.amount.toLocaleString('vi-VN')}</td><td class="small nowrap">${U.esc(r.unit)}<div class="muted">Chu kỳ: ${U.esc(CFG_CYCLE_LABELS[r.collectionCycle] || '—')}</div></td><td class="small">${U.esc(CFG_TAX_LABELS[r.taxClass] || '—')}</td><td class="nowrap">${U.dmy(r.effectiveFrom)}${r.effectiveTo ? `<div class="small muted">đến ${U.dmy(r.effectiveTo)}</div>` : ''}<div class="small">${r.legalBasis && r.legalBasis.docNo ? U.esc(r.legalBasis.docNo) : '<span class="muted">—</span>'}</div></td><td class="small">${U.esc(cfgWaiverName(r.waiverTypeId))}</td>
          <td>${cfgStatusTag(r.status)}</td>
          <td class="nowrap"><button class="btn sm" data-act="cfg-svc-view" data-id="${r.id}">Xem</button>
            ${canManage ? `<button class="btn sm" data-act="cfg-svc-edit" data-id="${r.id}">Sửa</button><button class="btn sm ${r.status === 'active' ? 'danger' : ''}" data-act="cfg-svc-toggle" data-id="${r.id}">${r.status === 'active' ? 'Vô hiệu hoá' : 'Kích hoạt'}</button>` : ''}
          </td></tr>`; }), { empty: 'Chưa có dịch vụ nào cho ' + U.market(ui.market).short })}</div></div>`;
  }
  function cfgSvcDrawerHtml(r) {
    const canManage = cfgPriceMutateAllowed('extraServices', r);
    return `<div class="drawer-h"><div><h3>${U.esc(r.name)}${cfgAllBadge(r)}</h3><div class="small muted">${r.marketId === 'ALL' ? 'Tất cả chợ (cũ)' : U.mShort(r.marketId)} · ${cfgStatusTag(r.status)}</div></div><span class="spacer"></span><button class="x" data-act="close" aria-label="Đóng">×</button></div>
      <div class="drawer-b">
        <dl class="kv"><dt>Tên dịch vụ</dt><dd>${U.esc(r.name)}</dd><dt>Cách tính</dt><dd>${CFG_CALC_LABELS[r.calcMethod] || r.calcMethod}</dd>${cfgPolicyDetailHtml(r)}
          <dt>Mức giá</dt><dd><b>${r.amount.toLocaleString('vi-VN')} ${U.esc(r.unit)}</b></dd><dt>Hiệu lực từ</dt><dd>${U.dmy(r.effectiveFrom)}</dd>${r.effectiveTo ? `<dt>Hết hiệu lực</dt><dd>${U.dmy(r.effectiveTo)}</dd>` : ''}</dl>
        <div class="divider"></div><b class="small">CĂN CỨ</b><div style="margin-top:6px">${cfgLegalHtml(r.legalBasis)}</div>
        <div class="divider"></div><b class="small">TÀI LIỆU</b><div style="margin-top:6px">${cfgAttachHtml(r, 'extraServices', r.id, canManage)}</div>
        <div class="divider"></div><b class="small">LỊCH SỬ</b><div style="margin-top:6px">${cfgHistoryHtml(r)}</div>
      </div>
      <div class="drawer-f">${canManage ? `<button class="btn primary" data-act="cfg-svc-edit" data-id="${r.id}">Chỉnh sửa</button>` : ''}<button class="btn" data-act="close">Đóng</button></div>`;
  }
  A.ACT['cfg-svc-view'] = el => { const r = A.SERVICE_CFG.get('extraServices', el.dataset.id); if (!r) return; A.$('#modal-root').innerHTML = `<div class="drawer-overlay" data-act="close"></div><div class="drawer">${cfgSvcDrawerHtml(r)}</div>`; };
  A.ACT['cfg-svc-new'] = () => {
    if (!cfgPriceMutateAllowed('extraServices', null)) return;
    // Phase 6 STEP A mục 8 — quyết định đã chốt: bản ghi MỚI không được phép marketId:'ALL' nữa,
    // luôn pin đúng 1 chợ (ui.market). Nếu 1 dịch vụ áp dụng cả 2 chợ, admin tạo 2 bản ghi riêng.
    ui.cfgForm = { cat: 'extraServices', id: null, name: '', marketId: ui.market, marketModel: cfgDefaultMarketModel(ui.market), collectionCycle: cfgDefaultCycle(ui.market), calcMethod: 'fixed', amount: 0, unit: ui.market === 'TTD' ? 'đ/phiên' : 'đ/tháng', taxClass: 'TAXABLE_REVENUE', waiverTypeId: null, effectiveFrom: A.db.today, status: 'active', legalBasis: { docNo: '', docDate: '', issuer: '', summary: '', effectiveDate: '', note: '' } };
    renderCfgForm();
  };
  A.ACT['cfg-svc-edit'] = el => {
    const r = A.SERVICE_CFG.get('extraServices', el.dataset.id); if (!r) return;
    if (!cfgPriceMutateAllowed('extraServices', r)) return;
    ui.cfgForm = { cat: 'extraServices', id: r.id, name: r.name, marketId: r.marketId, marketModel: r.marketModel, collectionCycle: r.collectionCycle, calcMethod: r.calcMethod, amount: r.amount, unit: r.unit, taxClass: r.taxClass, waiverTypeId: r.waiverTypeId || null, effectiveFrom: r.effectiveFrom, status: r.status, legalBasis: Object.assign({ docNo: '', docDate: '', issuer: '', summary: '', effectiveDate: '', note: '' }, r.legalBasis) };
    renderCfgForm();
  };
  A.ACT['cfg-svc-toggle'] = el => {
    const r = A.SERVICE_CFG.get('extraServices', el.dataset.id); if (!r) return;
    if (!cfgPriceMutateAllowed('extraServices', r)) return;
    const was = r.status;
    A.SERVICE_CFG.setStatus('extraServices', r.id, was === 'active' ? 'inactive' : 'active', cfgActor());
    A.render(); U.toast(was === 'active' ? 'Đã vô hiệu hoá dịch vụ' : 'Đã kích hoạt lại dịch vụ');
  };

  // ---- form thêm/sửa dùng chung cho 3 sub-tab dạng bảng ----
  function cfgCategoryLabel(cat) { return cat === 'stallPrices' ? 'đơn giá mặt bằng' : cat === 'utilities' ? 'cấu hình điện nước' : 'dịch vụ khác'; }
  function renderCfgForm() {
    const d = ui.cfgForm, isNew = !d.id, lb = d.legalBasis;
    let fields = '';
    // Phase 6 STEP A mục 9 — chợ áp dụng LUÔN = selectedMarket tại thời điểm thao tác, hiển thị
    // read-only, KHÔNG cho chọn tự do trong form (kể cả khi Sửa — bản ghi giữ nguyên chợ gốc, xem
    // cfg-*-edit ở trên: ui.cfgForm.marketId luôn lấy từ ui.market khi tạo mới hoặc từ chính bản
    // ghi khi sửa, chưa từng đổi qua form). Không còn field select 'Chợ' nào trong form.
    const marketField = `<div class="field"><label>Chợ áp dụng</label><input class="input" value="${U.esc(U.market(d.marketId).name)}" disabled></div>`;
    const policyFields = `<div class="field"><label>Loại chợ / mô hình thu phí</label><select class="input" data-ch="cf-market-model">${Object.keys(CFG_MARKET_MODEL_LABELS).map(k => `<option value="${k}" ${d.marketModel === k ? 'selected' : ''}>${CFG_MARKET_MODEL_LABELS[k]}</option>`).join('')}</select></div>
      <div class="field"><label>Chu kỳ thu</label><select class="input" data-ch="cf-cycle">${Object.keys(CFG_CYCLE_LABELS).map(k => `<option value="${k}" ${d.collectionCycle === k ? 'selected' : ''}>${CFG_CYCLE_LABELS[k]}</option>`).join('')}</select></div>
      <div class="field"><label>Phân loại thuế</label><select class="input" data-ch="cf-tax">${Object.keys(CFG_TAX_LABELS).map(k => `<option value="${k}" ${d.taxClass === k ? 'selected' : ''}>${CFG_TAX_LABELS[k]}</option>`).join('')}</select></div>
      <div class="field"><label>Loại miễn giảm áp dụng</label><select class="input" data-ch="cf-waiver"><option value="">Không áp dụng</option>${A.SERVICE_CFG.waiverTypes().filter(x => x.active).map(x => `<option value="${x.id}" ${d.waiverTypeId === x.id ? 'selected' : ''}>${U.esc(x.name)}</option>`).join('')}</select></div>`;
    if (d.cat === 'stallPrices') {
      fields = `${marketField}${policyFields}
        <div class="field"><label>Khu vực / tầng</label><input class="input" data-ch="cf-area" value="${U.esc(d.area || '')}"></div>
        <div class="field"><label>Loại điểm kinh doanh</label><input class="input" data-ch="cf-stalltype" value="${U.esc(d.stallType || '')}"></div>
        <div class="field"><label>Đơn giá</label><input class="input" type="number" min="0" data-ch="cf-amount" value="${d.amount || 0}"></div>
        <div class="field"><label>Đơn vị tính</label><input class="input" data-ch="cf-unit" value="${U.esc(d.unit || '')}" placeholder="VD: đ/m²/ngày"></div>
        <div class="field"><label>Ngày hiệu lực</label><input class="input" type="date" data-ch="cf-eff" value="${d.effectiveFrom || ''}"></div>`;
    } else if (d.cat === 'utilities') {
      fields = `${marketField}${policyFields}
        <div class="field"><label>Mức giá điện</label><input class="input" type="number" min="0" data-ch="cf-elec" value="${d.elecPrice || 0}"></div>
        <div class="field"><label>Đơn vị điện</label><input class="input" data-ch="cf-elec-unit" value="${U.esc(d.elecUnit || 'đ/kWh')}"></div>
        <div class="field"><label>Mức giá nước</label><input class="input" type="number" min="0" data-ch="cf-water" value="${d.waterPrice || 0}"></div>
        <div class="field"><label>Đơn vị nước</label><input class="input" data-ch="cf-water-unit" value="${U.esc(d.waterUnit || 'đ/m³')}"></div>
        <div class="field"><label>Ngày hiệu lực</label><input class="input" type="date" data-ch="cf-eff" value="${d.effectiveFrom || ''}"></div>`;
    } else {
      fields = `<div class="field"><label>Tên dịch vụ</label><input class="input" data-ch="cf-name" value="${U.esc(d.name || '')}"></div>
        ${marketField}${policyFields}
        <div class="field"><label>Cách tính</label><select class="input" data-ch="cf-calc">${Object.keys(CFG_CALC_LABELS).map(k => `<option value="${k}" ${d.calcMethod === k ? 'selected' : ''}>${CFG_CALC_LABELS[k]}</option>`).join('')}</select></div>
        <div class="field"><label>Đơn giá</label><input class="input" type="number" min="0" data-ch="cf-amount" value="${d.amount || 0}"></div>
        <div class="field"><label>Đơn vị tính</label><input class="input" data-ch="cf-unit" value="${U.esc(d.unit || '')}"></div>
        <div class="field"><label>Ngày hiệu lực</label><input class="input" type="date" data-ch="cf-eff" value="${d.effectiveFrom || ''}"></div>`;
    }
    A.modal(A.mHead((isNew ? 'Thêm ' : 'Sửa ') + cfgCategoryLabel(d.cat)) + `<div class="modal-b">
      ${!isNew && d.status === 'active' ? '<div class="note info" style="margin-bottom:10px">Bản ghi đang áp dụng sẽ không bị ghi đè. Khi lưu, hệ thống kết thúc hiệu lực bản cũ và tạo một phiên bản mới.</div>' : ''}
      <div class="form-grid">${fields}</div>
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
  A.CH['cf-area'] = el => { ui.cfgForm.area = el.value; };
  A.CH['cf-stalltype'] = el => { ui.cfgForm.stallType = el.value; };
  A.CH['cf-amount'] = el => { ui.cfgForm.amount = Math.max(0, Number(el.value) || 0); };
  A.CH['cf-unit'] = el => { ui.cfgForm.unit = el.value; };
  A.CH['cf-eff'] = el => { ui.cfgForm.effectiveFrom = el.value; };
  A.CH['cf-market-model'] = el => { ui.cfgForm.marketModel = el.value; };
  A.CH['cf-cycle'] = el => { ui.cfgForm.collectionCycle = el.value; };
  A.CH['cf-tax'] = el => { ui.cfgForm.taxClass = el.value; };
  A.CH['cf-waiver'] = el => { ui.cfgForm.waiverTypeId = el.value || null; };
  A.CH['cf-name'] = el => { ui.cfgForm.name = el.value; };
  A.CH['cf-calc'] = el => { ui.cfgForm.calcMethod = el.value; };
  A.CH['cf-elec'] = el => { ui.cfgForm.elecPrice = Math.max(0, Number(el.value) || 0); };
  A.CH['cf-elec-unit'] = el => { ui.cfgForm.elecUnit = el.value; };
  A.CH['cf-water'] = el => { ui.cfgForm.waterPrice = Math.max(0, Number(el.value) || 0); };
  A.CH['cf-water-unit'] = el => { ui.cfgForm.waterUnit = el.value; };
  A.CH['cf-lb-docno'] = el => { ui.cfgForm.legalBasis.docNo = el.value; };
  A.CH['cf-lb-docdate'] = el => { ui.cfgForm.legalBasis.docDate = el.value; };
  A.CH['cf-lb-issuer'] = el => { ui.cfgForm.legalBasis.issuer = el.value; };
  A.CH['cf-lb-effdate'] = el => { ui.cfgForm.legalBasis.effectiveDate = el.value; };
  A.CH['cf-lb-summary'] = el => { ui.cfgForm.legalBasis.summary = el.value; };
  A.CH['cf-lb-note'] = el => { ui.cfgForm.legalBasis.note = el.value; };
  A.ACT['cfg-form-save'] = () => {
    const d = ui.cfgForm, lb = d.legalBasis;
    // Handler-level gate (mục 6 yêu cầu Phase 6 STEP A) — re-check NGAY TRƯỚC khi ghi, không chỉ
    // dựa vào nút Lưu có hiển thị hay không. Khi Sửa, kiểm theo market của bản ghi ĐÃ LƯU
    // (`existing`, đọc lại từ storage) chứ không phải `d.marketId` phía client — miễn nhiễm với
    // mọi forge state phía client.
    const existing = d.id ? A.SERVICE_CFG.get(d.cat, d.id) : null;
    if (d.id && !existing) return;
    if (!cfgPriceMutateAllowed(d.cat, existing)) return;
    const targetMarket = existing ? existing.marketId : ui.market;
    if (d.marketId !== targetMarket || (targetMarket !== 'CL' && targetMarket !== 'TTD')) return;
    if (!Object.prototype.hasOwnProperty.call(CFG_MARKET_MODEL_LABELS, d.marketModel)
      || !Object.prototype.hasOwnProperty.call(CFG_CYCLE_LABELS, d.collectionCycle)
      || !Object.prototype.hasOwnProperty.call(CFG_TAX_LABELS, d.taxClass)) return;
    if (d.waiverTypeId && !A.SERVICE_CFG.waiverTypes().some(x => x.id === d.waiverTypeId && x.active)) return;
    if (!d.effectiveFrom) { U.toast('Vui lòng nhập ngày hiệu lực'); return; }
    if (existing && existing.status === 'active' && d.effectiveFrom <= existing.effectiveFrom) {
      U.toast('Phiên bản mới phải có ngày hiệu lực sau phiên bản đang áp dụng'); return;
    }
    const common = { marketId: targetMarket, marketModel: d.marketModel, collectionCycle: d.collectionCycle, taxClass: d.taxClass, waiverTypeId: d.waiverTypeId || null, effectiveFrom: d.effectiveFrom, effectiveTo: null, status: d.status, legalBasis: lb };
    let patch, detail;
    if (d.cat === 'stallPrices') {
      if (!d.area.trim() || !d.stallType.trim()) { U.toast('Vui lòng nhập đủ khu vực và loại điểm kinh doanh'); return; }
      patch = Object.assign({}, common, { area: d.area.trim(), stallType: d.stallType.trim(), amount: d.amount, unit: d.unit.trim() });
      detail = patch.amount.toLocaleString('vi-VN') + ' ' + patch.unit;
    } else if (d.cat === 'utilities') {
      patch = Object.assign({}, common, { elecPrice: d.elecPrice, elecUnit: d.elecUnit.trim(), waterPrice: d.waterPrice, waterUnit: d.waterUnit.trim() });
      detail = 'Điện ' + patch.elecPrice.toLocaleString('vi-VN') + ' ' + patch.elecUnit + ' · Nước ' + patch.waterPrice.toLocaleString('vi-VN') + ' ' + patch.waterUnit;
    } else {
      if (!d.name.trim()) { U.toast('Vui lòng nhập tên dịch vụ'); return; }
      patch = Object.assign({}, common, { name: d.name.trim(), calcMethod: d.calcMethod, amount: d.amount, unit: d.unit.trim() });
      detail = patch.amount.toLocaleString('vi-VN') + ' ' + patch.unit;
    }
    const actor = cfgActor();
    if (d.id && existing.status === 'active') {
      A.SERVICE_CFG.createVersion(d.cat, d.id, patch, actor, detail);
      U.toast('Đã tạo phiên bản biểu phí mới; phiên bản cũ được lưu ở trạng thái hết hiệu lực');
    } else if (d.id) { A.SERVICE_CFG.update(d.cat, d.id, patch, actor, 'Cập nhật cấu hình', detail); U.toast('Đã cập nhật'); }
    else { patch.__detail = detail; A.SERVICE_CFG.add(d.cat, patch, actor); U.toast('Đã thêm cấu hình mới'); }
    ui.cfgForm = null;
    A.closeModal(); A.render();
  };

  // ---- attachment (dùng chung cho mọi hạng mục) ----
  // Handler dùng chung 5 loại config (stallPrices/utilities/extraServices/billingCycle/billingRules)
  // qua `cat` — derive đúng actionKey theo TỪNG loại (mục 6 yêu cầu Phase 6 STEP A). 3 nhóm giá
  // dùng cau-hinh-gia.* + market re-check; billingCycle/billingRules GIỮ NGUYÊN hành vi cũ (không
  // đổi ở task này — mục 11).
  function cfgAttachMutateAllowed(cat, rec) { return cfgGiaActionKey(cat) ? cfgPriceMutateAllowed(cat, rec) : true; }
  A.CH['cfg-att-add'] = el => {
    const file = el.files && el.files[0];
    if (!file) return;
    const rec = cfgRecord(el.dataset.cat, el.dataset.id);
    if (!rec) return;
    if (!cfgAttachMutateAllowed(el.dataset.cat, rec)) return;
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
    if (!cfgAttachMutateAllowed(el.dataset.cat, rec)) return;
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
    if (cfgGiaActionKey(el.dataset.cat) && !cfgPriceMutateAllowed(el.dataset.cat, rec)) return;
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
    if (cfgGiaActionKey(d.cat) && !cfgPriceMutateAllowed(d.cat, rec)) return;
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

  // ---- router "Chính sách thu và biểu phí" (Tài chính > Quản lý khai báo) ----
  const PRICE_TABS = [['gia', 'Đơn giá mặt bằng'], ['dien-nuoc', 'Điện & nước'], ['dich-vu', 'Dịch vụ khác']];
  A.VIEWS['cau-hinh-gia'] = function () {
    const tab = PRICE_TABS.some(t => t[0] === ui.cfgTab) ? ui.cfgTab : 'gia';
    const bar = `<div class="seg" style="margin-bottom:14px">${PRICE_TABS.map(t => `<button class="${tab === t[0] ? 'on' : ''}" data-act="cfg-tab" data-id="${t[0]}">${t[1]}</button>`).join('')}</div>`;
    const note = `<div class="note info" style="margin-bottom:14px"><b>${U.esc(U.market(ui.market).name)}</b> · Mỗi chợ có mô hình thu phí riêng. Khi sửa một biểu phí đang áp dụng, hệ thống tạo phiên bản mới theo ngày hiệu lực và giữ nguyên phiên bản cũ. Prototype chưa nối biểu phí này vào thuật toán lập khoản phải thu.</div>`;
    const body = tab === 'dien-nuoc' ? settingsDienNuocHtml() : tab === 'dich-vu' ? settingsDichVuHtml() : settingsGiaHtml();
    return note + bar + body;
  };
  A.ACT['cfg-tab'] = el => { ui.cfgTab = el.dataset.id; A.render(); };

  // ---- Danh sách tài khoản ngân hàng (Tài chính > Quản lý khai báo, ngang hàng cau-hinh-gia) ----
  // Tách theo từng chợ (marketId) như các màn Tài chính khác — lọc theo ui.market topbar (U.inM),
  // KHÔNG có bộ lọc chợ riêng của màn (đã xác nhận với người yêu cầu trước khi implement). Quyền:
  // screen:tai-khoan-ngan-hang cho xem; action:tai-khoan-ngan-hang.quan-ly cho MỌI thao tác ghi
  // (Thêm/Sửa/Xoá/đổi trạng thái) — kiểm tra ở nơi build nút (ẩn nút) VÀ lại một lần nữa ngay trong
  // từng handler ghi dữ liệu, không chỉ ẩn nút. rec (khi có) dùng đúng marketId của CHÍNH bản ghi đó
  // (không phải ui.market) để 1 handler bị ép đổi ui.market không thể lách qua bản ghi chợ khác —
  // cùng nguyên tắc với cfgPriceMutateAllowed().
  function baCan(rec) { return A.canDo('tai-khoan-ngan-hang.quan-ly', rec ? rec.marketId : ui.market); }
  function baRows() {
    // Bản ghi dùng field `marketId` (giống stallPrices/utilities/extraServices ở serviceconfig.js),
    // KHÔNG phải `market` — U.inM() kiểm tra đúng field `market` (dùng cho stalls/contracts/
    // invoices...) nên không áp dụng được ở đây; so sánh trực tiếp marketId với ui.market.
    const f = ui.bankAcc, q = (f.search || '').toLowerCase();
    const rows = A.BANK_ACCOUNTS.list().filter(a => a.marketId === ui.market &&
      (!f.status || a.status === f.status) &&
      (!q || a.accountHolderName.toLowerCase().includes(q)));
    const key = f.sortKey, dir = f.sortDir === 'desc' ? -1 : 1;
    if (!key) return rows;
    return rows.slice().sort((x, y) => (x[key] > y[key] ? 1 : x[key] < y[key] ? -1 : 0) * dir);
  }
  function baStatusTag(s) { return s === 'active' ? '<span class="tag ok">Hoạt động</span>' : '<span class="tag">Ngừng hoạt động</span>'; }
  // Tự UPPERCASE + bỏ dấu tiếng Việt cho Tên chủ tài khoản (đúng chuẩn ghi trên thẻ/sao kê ngân hàng).
  function baUpperNoAccent(s) {
    return (s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').toUpperCase();
  }
  function baActor() { const acc = A.currentAccount(); return acc ? acc.fullName : 'Không rõ'; }
  function baSortHead(label, key) {
    const f = ui.bankAcc, on = f.sortKey === key;
    return `<button class="btn sm ${on ? 'primary' : ''}" data-act="ba-sort" data-key="${key}" style="padding:2px 8px">${label}${on ? (f.sortDir === 'desc' ? ' ▼' : ' ▲') : ''}</button>`;
  }
  function renderBankAcctForm() {
    const d = ui.baForm, isNew = !d.id;
    const banks = A.BANK_ACCOUNTS.BANKS;
    A.modal(A.mHead(isNew ? 'Thêm tài khoản ngân hàng' : 'Sửa tài khoản ngân hàng') + `<div class="modal-b"><div class="form-grid">
      <div class="field"><label>Ngân hàng *</label><select class="input" data-ch="baf-bank">
        <option value="">— Chọn ngân hàng —</option>
        ${banks.map(b => `<option value="${b.code}" ${d.bankCode === b.code ? 'selected' : ''}>${U.esc(b.name)}</option>`).join('')}
      </select></div>
      <div class="field"><label>Tên chủ tài khoản *</label><input class="input" data-ch="baf-holder" value="${U.esc(d.accountHolderName || '')}" placeholder="Tự in hoa, không dấu"></div>
      <div class="field"><label>Số tài khoản *</label><input class="input" data-ch="baf-number" value="${U.esc(d.accountNumber || '')}" placeholder="Chỉ gồm số"></div>
      <div class="field"><label>Trạng thái</label><select class="input" data-ch="baf-status">
        <option value="active" ${d.status === 'active' ? 'selected' : ''}>Hoạt động</option>
        <option value="inactive" ${d.status === 'inactive' ? 'selected' : ''}>Ngừng hoạt động</option>
      </select></div>
    </div>
    <div class="field" style="margin-top:10px"><label>Ghi chú</label><textarea class="input" data-ch="baf-note" rows="2">${U.esc(d.note || '')}</textarea></div>
    <label class="small" style="display:flex;align-items:center;gap:6px;margin-top:12px;cursor:${d.status === 'inactive' ? 'not-allowed' : 'pointer'}">
      <input type="checkbox" data-ch="baf-collect" ${d.isCollectionAccount ? 'checked' : ''} ${d.status === 'inactive' ? 'disabled' : ''}> Là tài khoản thu tiền
    </label>
    ${d.status === 'inactive' ? '<div class="note" style="margin-top:8px">Tài khoản "Ngừng hoạt động" không thể chọn làm tài khoản thu tiền.</div>' : ''}
    ${isNew ? `<label class="small" style="display:flex;align-items:center;gap:6px;margin-top:12px;cursor:pointer"><input type="checkbox" data-ch="baf-continue" ${d.saveAndContinue ? 'checked' : ''}> Lưu và thêm tiếp</label>` : ''}
    </div>
    <div class="modal-f"><button class="btn" data-act="close">Hủy bỏ</button><button class="btn primary" data-act="ba-form-save">Lưu</button></div>`);
  }
  A.VIEWS['tai-khoan-ngan-hang'] = function () {
    const canManage = baCan();
    const rows = baRows(), f = ui.bankAcc;
    const pg = U.pager('bankAcc', rows.length, 15);
    return `
    <div class="card"><div class="card-b row" style="padding-top:14px">
      <div><h3 style="margin:0;font-size:var(--font-size-md)">Danh sách tài khoản ngân hàng</h3><div class="small muted">Tài khoản ngân hàng của Ban Quản lý chợ dùng nhận tiền qua QR/chuyển khoản từ tiểu thương, phục vụ đối soát giao dịch — ${U.esc(U.market(ui.market).name)}.</div></div>
      <span class="spacer"></span>
      <button class="btn" data-act="ba-csv">⬇ Xuất excel</button>
      ${canManage ? '<button class="btn primary" data-act="ba-new">+ Thêm mới</button>' : ''}
    </div></div>
    <div class="card"><div class="card-b row" style="padding-top:14px;flex-wrap:wrap">
      <input class="input" style="min-width:220px;flex:1" placeholder="Tìm theo tên chủ tài khoản..." data-in="ba-search" value="${U.esc(f.search || '')}">
      <select class="input" data-ch="ba-status"><option value="">Chọn trạng thái: Tất cả</option>
        <option value="active" ${f.status === 'active' ? 'selected' : ''}>Hoạt động</option>
        <option value="inactive" ${f.status === 'inactive' ? 'selected' : ''}>Ngừng hoạt động</option>
      </select>
      <button class="btn" data-act="ba-clear">Đặt lại</button>
    </div></div>
    <div class="card"><div class="card-b">
      ${U.table([{ t: '<input type="checkbox" data-ch="ba-select-all">' }, { t: 'STT' }, { t: baSortHead('Số tài khoản', 'accountNumber') }, { t: baSortHead('Tên chủ tài khoản', 'accountHolderName') }, { t: 'Ngân hàng' }, { t: 'Ghi chú' }, { t: 'Tài khoản thu tiền' }, { t: 'Trạng thái' }, { t: '' }],
        rows.slice(pg.start, pg.end).map((a, i) => `<tr>
          <td><input type="checkbox" data-ch="ba-select" data-id="${a.id}" ${(ui.baSel || []).includes(a.id) ? 'checked' : ''}></td>
          <td>${pg.start + i + 1}</td>
          <td>${U.esc(a.accountNumber)}</td>
          <td>${U.esc(a.accountHolderName)}</td>
          <td><span class="tag info">${U.esc(A.BANK_ACCOUNTS.bankName(a.bankCode))}</span></td>
          <td class="small">${U.esc(a.note || '')}</td>
          <td>${a.isCollectionAccount ? '<span class="tag ok">✓</span>' : ''}</td>
          <td>${baStatusTag(a.status)}</td>
          <td class="nowrap">
            ${baCan(a) ? `<button class="btn sm" data-act="ba-edit" data-id="${a.id}">Sửa</button>` : ''}
            ${baCan(a) ? `<button class="btn sm danger" data-act="ba-del" data-id="${a.id}">Xoá</button>` : ''}
          </td></tr>`), { empty: 'Không tìm thấy tài khoản ngân hàng phù hợp' })}${pg.html}</div></div>`;
  };
  A.IN['ba-search'] = el => { ui.bankAcc.search = el.value; ui.page.bankAcc = 0; A.render(); };
  A.CH['ba-status'] = el => { ui.bankAcc.status = el.value; ui.page.bankAcc = 0; A.render(); };
  A.ACT['ba-clear'] = () => { ui.bankAcc = { search: '', status: '', sortKey: null, sortDir: 'asc' }; ui.page.bankAcc = 0; A.render(); };
  A.ACT['ba-sort'] = el => {
    const k = el.dataset.key, f = ui.bankAcc;
    f.sortDir = f.sortKey === k && f.sortDir === 'asc' ? 'desc' : 'asc';
    f.sortKey = k;
    A.render();
  };
  A.CH['ba-select-all'] = el => { ui.baSel = el.checked ? baRows().map(a => a.id) : []; A.render(); };
  A.CH['ba-select'] = el => {
    const id = el.dataset.id, sel = new Set(ui.baSel || []);
    if (el.checked) sel.add(id); else sel.delete(id);
    ui.baSel = Array.from(sel);
    A.render();
  };
  A.ACT['ba-csv'] = () => {
    const sel = new Set(ui.baSel || []);
    const rows = baRows().filter(a => !sel.size || sel.has(a.id));
    U.csv('tai-khoan-ngan-hang', ['Số tài khoản', 'Tên chủ tài khoản', 'Ngân hàng', 'Ghi chú', 'Tài khoản thu tiền', 'Trạng thái'],
      rows.map(a => [a.accountNumber, a.accountHolderName, A.BANK_ACCOUNTS.bankName(a.bankCode), a.note || '', a.isCollectionAccount ? 'Có' : '', a.status === 'active' ? 'Hoạt động' : 'Ngừng hoạt động']));
  };
  A.ACT['ba-new'] = () => {
    if (!baCan()) return;
    ui.baForm = { id: null, bankCode: '', accountHolderName: '', accountNumber: '', isCollectionAccount: false, note: '', status: 'active', saveAndContinue: false };
    renderBankAcctForm();
  };
  A.ACT['ba-edit'] = el => {
    const a = A.BANK_ACCOUNTS.get(el.dataset.id);
    if (!a || !baCan(a)) return;
    ui.baForm = { id: a.id, bankCode: a.bankCode, accountHolderName: a.accountHolderName, accountNumber: a.accountNumber, isCollectionAccount: a.isCollectionAccount, note: a.note, status: a.status, saveAndContinue: false };
    renderBankAcctForm();
  };
  // A.render() KHÔNG vẽ lại modal (chỉ vẽ lại #nav/#view, xem A.render() ở core.js), và gọi lại
  // renderBankAcctForm() (thay hẳn innerHTML #modal-root) NGAY trong handler 'change'/'input' của
  // 1 phần tử CON của modal đó có thể ném lỗi DOM ("node to be removed is no longer a child") do
  // gỡ phần tử đang dispatch sự kiện giữa lúc sự kiện chưa kết thúc. Vì vậy 3 handler dưới đây chỉ
  // sửa trực tiếp DOM phần tử liên quan (giữ nguyên phần tử đang có), không vẽ lại toàn modal.
  A.CH['baf-bank'] = el => { ui.baForm.bankCode = el.value; };
  A.CH['baf-holder'] = el => { const v = baUpperNoAccent(el.value); ui.baForm.accountHolderName = v; el.value = v; };
  A.CH['baf-number'] = el => { const v = el.value.replace(/\D/g, ''); ui.baForm.accountNumber = v; el.value = v; };
  A.CH['baf-note'] = el => { ui.baForm.note = el.value; };
  A.CH['baf-status'] = el => {
    ui.baForm.status = el.value;
    if (el.value === 'inactive') ui.baForm.isCollectionAccount = false;
    const cb = A.$('input[data-ch="baf-collect"]');
    if (cb) { cb.checked = ui.baForm.isCollectionAccount; cb.disabled = el.value === 'inactive'; }
  };
  A.CH['baf-collect'] = el => { if (ui.baForm.status !== 'inactive') ui.baForm.isCollectionAccount = el.checked; };
  A.CH['baf-continue'] = el => { ui.baForm.saveAndContinue = el.checked; };
  A.ACT['ba-form-save'] = () => {
    const d = ui.baForm, isNew = !d.id;
    const existing = d.id ? A.BANK_ACCOUNTS.get(d.id) : null;
    if (!baCan(existing)) return;
    const bank = A.BANK_ACCOUNTS.BANKS.find(b => b.code === d.bankCode);
    if (!bank) { U.toast('Vui lòng chọn ngân hàng'); return; }
    const holder = baUpperNoAccent((d.accountHolderName || '').trim());
    if (!holder) { U.toast('Vui lòng nhập tên chủ tài khoản'); return; }
    const number = (d.accountNumber || '').replace(/\D/g, '');
    if (!number) { U.toast('Vui lòng nhập số tài khoản (chỉ gồm số)'); return; }
    if (A.BANK_ACCOUNTS.numberTaken(number, d.id)) { U.toast('Số tài khoản "' + number + '" đã tồn tại trong hệ thống'); return; }
    const status = d.status === 'inactive' ? 'inactive' : 'active';
    const patch = {
      marketId: existing ? existing.marketId : ui.market, bankCode: bank.code, bankName: bank.name,
      accountHolderName: holder, accountNumber: number,
      isCollectionAccount: status === 'inactive' ? false : !!d.isCollectionAccount,
      note: (d.note || '').trim(), status: status
    };
    if (isNew) {
      A.BANK_ACCOUNTS.add(patch, baActor());
      U.log('Thêm tài khoản ngân hàng mới "' + patch.accountHolderName + '" (' + patch.accountNumber + ')');
      U.toast('Đã thêm tài khoản ' + patch.accountNumber);
      if (d.saveAndContinue) {
        ui.baForm = { id: null, bankCode: '', accountHolderName: '', accountNumber: '', isCollectionAccount: false, note: '', status: 'active', saveAndContinue: true };
        renderBankAcctForm();
        return;
      }
    } else {
      A.BANK_ACCOUNTS.update(d.id, patch, baActor());
      U.log('Cập nhật tài khoản ngân hàng "' + patch.accountHolderName + '" (' + patch.accountNumber + ')');
      U.toast('Đã cập nhật tài khoản ' + patch.accountNumber);
    }
    A.closeModal(); A.render();
  };
  A.ACT['ba-del'] = el => {
    const a = A.BANK_ACCOUNTS.get(el.dataset.id);
    if (!a || !baCan(a)) return;
    if (a.hasTransactions) {
      A.modal(A.mHead('Không thể xoá tài khoản') + `<div class="modal-b">Tài khoản <b>${U.esc(a.accountNumber)}</b> (${U.esc(a.accountHolderName)}) đã có giao dịch tham chiếu (đối soát) — không thể xoá cứng. Chỉ có thể chuyển sang "Ngừng hoạt động".</div>
        <div class="modal-f"><button class="btn" data-act="close">Đóng</button>${a.status === 'active' ? `<button class="btn danger" data-act="ba-deactivate-ok" data-id="${a.id}">Chuyển Ngừng hoạt động</button>` : ''}</div>`);
      return;
    }
    A.modal(A.mHead('Xoá tài khoản ngân hàng') + `<div class="modal-b">Xoá tài khoản <b>${U.esc(a.accountNumber)}</b> (${U.esc(a.accountHolderName)})? Thao tác này không thể hoàn tác.</div>
      <div class="modal-f"><button class="btn" data-act="close">Hủy</button><button class="btn danger" data-act="ba-del-ok" data-id="${a.id}">Xoá</button></div>`);
  };
  A.ACT['ba-del-ok'] = el => {
    const a = A.BANK_ACCOUNTS.get(el.dataset.id);
    if (!a || !baCan(a)) return;
    if (!A.BANK_ACCOUNTS.remove(a.id)) { U.toast('Không thể xoá — tài khoản đã có giao dịch tham chiếu.'); A.closeModal(); A.render(); return; }
    U.log('Xoá tài khoản ngân hàng "' + a.accountHolderName + '" (' + a.accountNumber + ')');
    U.toast('Đã xoá tài khoản ' + a.accountNumber);
    A.closeModal(); A.render();
  };
  A.ACT['ba-deactivate-ok'] = el => {
    const a = A.BANK_ACCOUNTS.get(el.dataset.id);
    if (!a || !baCan(a)) return;
    A.BANK_ACCOUNTS.setStatus(a.id, 'inactive', baActor());
    U.log('Chuyển "Ngừng hoạt động" tài khoản ngân hàng "' + a.accountHolderName + '" (' + a.accountNumber + ')');
    U.toast('Đã chuyển tài khoản ' + a.accountNumber + ' sang Ngừng hoạt động');
    A.closeModal(); A.render();
  };

  function settingsTichhopHtml() {
    return `<div class="card"><div class="card-h"><h3>Tích hợp</h3></div><div class="card-b small">
      ${[['Ngân hàng – mã QR động (VietQR), nhận báo có', 'Mô phỏng'], ['Zalo OA – gửi thông báo, biên lai', 'Mô phỏng'], ['SMS brandname', 'Mô phỏng'], ['Biên lai điện tử', 'Mô phỏng'], ['Nền tảng tích hợp, chia sẻ dữ liệu của tỉnh (LGSP)', 'Khi triển khai'], ['Trung tâm điều hành thông minh (IOC)', 'Khi triển khai'], ['Đăng nhập một lần (SSO) dùng chung với các hệ thống của phường', 'Khi triển khai']].map(r => `<div class="row" style="padding:7px 0;border-bottom:1px solid #eef2f7"><span style="flex:1">${r[0]}</span><span class="tag ${r[1] === 'Mô phỏng' ? 'ok' : ''}">${r[1]}</span></div>`).join('')}</div></div>`;
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
    const body = tab === 'kythu' ? settingsKyThuHtml()
      : tab === 'quytac' ? settingsQuyTacHtml()
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

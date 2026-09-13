/* Màn hình vận hành: Phản ánh & sự cố, Thông báo, Báo cáo, Cài đặt. */
(function (A) {
  'use strict';
  const D = A.D, U = A.U, ui = A.ui;
  const ST = D.INCIDENT_STATES;
  const stLabel = id => ST.find(s => s.id === id).label;
  const isOpen = i => i.state !== 'hoanthanh' && i.state !== 'dong';
  const late = i => isOpen(i) && i.deadline < U.today();

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
      ${ui.role === 'bql' ? '<button class="btn primary" data-act="inc-new">+ Tạo phản ánh</button>' : ''}</div>
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
    const bql = ui.role === 'bql';
    A.modal(A.mHead(i.id + ' · ' + U.esc(i.title)) + `<div class="modal-b">
      <dl class="kv"><dt>Trạng thái</dt><dd><span class="tag info">${stLabel(i.state)}</span> ${late(i) ? '<span class="tag danger">Quá hạn</span>' : ''} ${i.escalated ? '<span class="tag purple">Vượt cấp</span>' : ''}</dd>
        <dt>Nhóm</dt><dd>${i.cat}</dd><dt>Nguồn</dt><dd>${i.source}</dd>
        <dt>Tiểu thương</dt><dd>${U.esc(t ? t.name : '')} · ${A.idx.stall.get(i.stallId).code} · ${U.mShort(i.market)}</dd>
        <dt>Tiếp nhận / hạn</dt><dd>${U.dmy(i.created)} · hạn ${U.dmy(i.deadline)}</dd>
        ${i.desc ? `<dt>Nội dung</dt><dd>${U.esc(i.desc)}</dd>` : ''}${i.photo ? '<dt>Ảnh</dt><dd><span class="tag info">📷 1 ảnh đính kèm</span></dd>' : ''}
        <dt>Người xử lý</dt><dd>${bql ? `<select class="input" data-ch="inc-assign" data-id="${i.id}"><option value="">– Chưa phân công –</option>${D.STAFF.filter(s => s.market === i.market).map(s => `<option value="${s.id}" ${i.assignee === s.id ? 'selected' : ''}>${s.name} (${s.role})</option>`).join('')}</select>` : U.esc(U.staffName(i.assignee) || 'Chưa phân công')}</dd>
        ${i.rating ? `<dt>Đánh giá</dt><dd>${'★'.repeat(i.rating)}${'☆'.repeat(5 - i.rating)}</dd>` : ''}</dl>
      <div class="divider"></div><b class="small">Nhật ký xử lý</b>${i.log.map(l => `<div class="small"><span class="muted">${U.dmy(l.at)}</span> · ${U.esc(l.text)}</div>`).join('')}
      ${!bql && i.escalated ? '<div class="field" style="margin-top:12px"><label>Ý kiến chỉ đạo của lãnh đạo phường</label><textarea class="input" id="inc-cmt" rows="2" placeholder="VD: Giao BQL phối hợp Công an phường xử lý trong 2 ngày"></textarea></div>' : ''}
      </div><div class="modal-f">
      ${bql && !i.escalated && isOpen(i) ? `<button class="btn" data-act="inc-escalate" data-id="${i.id}">Chuyển vượt cấp lên phường</button>` : ''}
      ${!bql && i.escalated ? `<button class="btn primary" data-act="inc-comment" data-id="${i.id}">Gửi ý kiến chỉ đạo</button>` : ''}
      ${bql && next ? `<button class="btn primary" data-act="inc-next" data-id="${i.id}">Chuyển sang: ${next.label} →</button>` : ''}
      <button class="btn" data-act="close">Đóng</button></div>`, true);
  };
  function incLog(i, text) { i.log.push({ at: U.today(), text }); A.save(); }
  A.CH['inc-assign'] = el => {
    const i = A.db.incidents.find(x => x.id === el.dataset.id);
    i.assignee = el.value || null;
    if (i.assignee && i.state === 'tiepnhan') i.state = 'phancong';
    incLog(i, 'Phân công ' + U.staffName(i.assignee));
    A.render(); A.ACT['inc-open']({ dataset: { id: i.id } });
    U.toast('Đã phân công, thông báo gửi tới ' + U.staffName(i.assignee));
  };
  A.ACT['inc-next'] = el => {
    const i = A.db.incidents.find(x => x.id === el.dataset.id);
    const n = ST[ST.findIndex(s => s.id === i.state) + 1];
    if (n.id === 'phancong' && !i.assignee) i.assignee = i.market === 'TTD' ? 'NV06' : 'NV05';
    i.state = n.id; incLog(i, 'Chuyển trạng thái: ' + n.label);
    A.render(); A.ACT['inc-open']({ dataset: { id: i.id } });
    if (n.id === 'hoanthanh') U.toast('Đã hoàn thành – tiểu thương nhận thông báo và được mời đánh giá');
  };
  A.ACT['inc-escalate'] = el => {
    const i = A.db.incidents.find(x => x.id === el.dataset.id);
    i.escalated = true; incLog(i, 'Chuyển vượt cấp lên UBND phường');
    A.render(); A.closeModal(); U.toast('Đã chuyển ' + i.id + ' lên cổng giám sát cấp phường');
  };
  A.ACT['inc-comment'] = el => {
    const i = A.db.incidents.find(x => x.id === el.dataset.id), txt = (A.$('#inc-cmt').value || '').trim();
    if (!txt) { U.toast('Vui lòng nhập ý kiến chỉ đạo'); return; }
    incLog(i, 'Lãnh đạo phường chỉ đạo: ' + txt);
    A.closeModal(); U.toast('Đã gửi ý kiến chỉ đạo tới Ban Quản lý chợ');
  };
  A.ACT['inc-new'] = () => {
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
    const title = A.$('#in-title').value.trim();
    if (!title) { U.toast('Vui lòng nhập tiêu đề'); return; }
    const i = A.addIncident(A.$('#in-stall').value, A.$('#in-cat').value, title, '', 'Nhập tại Ban Quản lý', false);
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
        <div class="row" style="margin-top:12px"><span class="spacer"></span><button class="btn primary" data-act="tb-send">📣 Gửi ngay</button></div></div></div>
      <div class="card"><div class="card-h"><h3>Thông báo tự động theo sự kiện</h3></div><div class="card-b small">
        ${[['Phát hành khoản phải thu', 'Mini app, Zalo OA'], ['Trước hạn nộp 3 ngày', 'Mini app, Zalo OA'], ['Khoản phải thu quá hạn', 'Mini app, Zalo OA, SMS'], ['Hợp đồng còn 30 ngày hết hạn', 'Mini app, Zalo OA'], ['Phản ánh được xử lý xong', 'Mini app'], ['Biên lai điện tử sau khi thanh toán', 'Mini app, Zalo OA']].map(r => `<div class="row" style="padding:7px 0;border-bottom:1px solid #eef2f0"><span class="tag ok">Bật</span><span style="flex:1">${r[0]}</span><span class="muted">${r[1]}</span></div>`).join('')}</div></div></div>
    <div class="card"><div class="card-h"><h3>Lịch sử thông báo</h3></div><div class="card-b">
      ${U.table([{ t: 'Mã' }, { t: 'Ngày' }, { t: 'Tiêu đề' }, { t: 'Đối tượng' }, { t: 'Kênh' }, { t: 'Người nhận', num: true }, { t: 'Đã nhận', num: true }, { t: 'Đã đọc', num: true }, { t: 'Loại' }],
        A.db.notifications.map(n => `<tr><td>${n.id}</td><td>${U.dmy(n.at)}</td><td>${U.esc(n.title)}</td><td>${U.esc(n.group)}</td><td class="small">${n.channels.join(', ')}</td><td class="num">${n.sent}</td><td class="num">${U.pctTxt(n.delivered * 100)}</td><td class="num">${n.read ? U.pctTxt(n.read * 100) : '<span class="muted">đang cập nhật</span>'}</td><td>${n.auto ? '<span class="tag info">Tự động</span>' : '<span class="tag">Thủ công</span>'}</td></tr>`))}</div></div>`;
  };
  A.CH['tb-group'] = el => { ui.tbGroup = el.value; A.render(); };
  A.ACT['tb-send'] = () => {
    const title = A.$('#tb-title').value.trim(), ch = Array.from(document.querySelectorAll('.tb-ch:checked')).map(x => x.value);
    if (!title || !ch.length) { U.toast('Cần tiêu đề và ít nhất một kênh gửi'); return; }
    const gi = groupInfo(ui.tbGroup || 'all');
    A.db.notifications.unshift({ id: 'TB-' + U.pad(32 + A.db.notifications.length, 3), at: U.today(), title, group: gi[0], channels: ch, sent: gi[1], delivered: 0.96, read: 0, auto: false, body: A.$('#tb-content').value });
    U.log('Gửi thông báo "' + title + '" tới ' + gi[0]);
    A.save(); A.render(); U.toast(`Đã gửi tới ${gi[1]} tiểu thương qua ${ch.join(', ')}`);
  };

  // ---------- Báo cáo ----------
  function reports() {
    const db = A.db, stalls = db.stalls.filter(U.inM), inv = db.invoices.filter(U.inM), pays = db.payments.filter(U.inM);
    const secs = [];
    stalls.forEach(s => { if (!secs.find(x => x.key === s.market + s.section)) secs.push({ key: s.market + s.section, name: s.sectionName, m: s.market }); });
    const periods = db.issuedPeriods.filter(p => p <= '2026-09');
    return {
      lapday: { t: 'Tình trạng lấp đầy điểm kinh doanh', cols: ['Chợ', 'Khu vực', 'Tổng', 'Đang thuê', 'Nợ phí', 'Tạm ngừng', 'Tranh chấp', 'Còn trống', 'Lấp đầy %'],
        rows: secs.map(sc => { const xs = stalls.filter(s => s.market + s.section === sc.key), c = k => xs.filter(s => s.status === k).length; return [U.mShort(sc.m), sc.name, xs.length, c('thue'), c('no'), c('ngung'), c('tranhchap'), c('trong'), U.pct(xs.length - c('trong'), xs.length)]; }) },
      biendong: { t: 'Biến động tiểu thương', cols: ['Tháng', 'Đăng ký mới', 'Chấm dứt', 'Cuối kỳ'],
        rows: (() => { let total = db.traders.filter(U.inM).length; const out = []; for (let k = 0; k < 6; k++) { const nw = 2 + (k * 7) % 5, lv = 1 + (k * 3) % 3; out.unshift(['0' + (9 - k) + '/2026', nw, lv, total]); total = total - nw + lv; } return out; })() },
      hethan: { t: 'Hợp đồng sắp hết hạn (60 ngày)', cols: ['Số hợp đồng', 'Tiểu thương', 'Điểm KD', 'Ngày hết hạn', 'Còn lại (ngày)'],
        rows: db.contracts.filter(c => U.inM(c) && c.status === 'hieuluc' && U.days(U.today(), c.end) <= 60).sort((a, b) => a.end.localeCompare(b.end)).map(c => [c.id, A.idx.trader.get(c.traderId).name, A.idx.stall.get(c.stallId).code, U.dmy(c.end), U.days(U.today(), c.end)]) },
      doanhthu: { t: 'Doanh thu theo kỳ', cols: ['Kỳ', 'Số khoản', 'Phải thu (đ)', 'Đã thu (đ)', 'Tỷ lệ thu %'],
        rows: periods.map(p => { const xs = inv.filter(i => i.period === p), a = U.sum(xs, i => i.amount), b = U.sum(xs, i => i.paid); return [U.per(p), xs.length, a, b, U.pct(b, a)]; }), chart: 'doanhthu' },
      congno: { t: 'Công nợ theo khu vực', cols: ['Chợ', 'Khu vực', 'Số tiểu thương nợ', 'Nợ quá hạn (đ)', 'Nợ chưa đến hạn (đ)'],
        rows: secs.map(sc => { const xs = inv.filter(i => i.status !== 'paid' && (i.market + A.idx.stall.get(i.stallId).section) === sc.key); return [U.mShort(sc.m), sc.name, new Set(xs.filter(U.isOver).map(i => i.traderId)).size, U.sum(xs.filter(U.isOver), U.due), U.sum(xs.filter(i => !U.isOver(i)), U.due)]; }) },
      khongtienmat: { t: 'Tỷ lệ thanh toán không dùng tiền mặt', cols: ['Kỳ', 'Tiền mặt (đ)', 'Quét QR (đ)', 'Chuyển khoản (đ)', 'Không tiền mặt %'],
        rows: periods.map(p => { const xs = pays.filter(x => A.idx.invoice.get(x.invoiceId).period === p), s = m => U.sum(xs.filter(x => x.method === m), x => x.amount), tot = U.sum(xs, x => x.amount); return [U.per(p), s('tm'), s('qr'), s('ck'), U.pct(s('qr') + s('ck'), tot)]; }), chart: 'khongtienmat' },
      doisoat: { t: 'Đối soát ngày ' + U.dmy(U.today()), cols: ['Giờ', 'Mã sao kê', 'Nội dung', 'Số tiền (đ)', 'Trạng thái'],
        rows: db.bank.map(b => [b.time, b.id, b.ref, b.amount, b.matched ? 'Đã khớp' : 'Chưa khớp']) },
      suco: { t: 'Tình hình xử lý phản ánh, sự cố', cols: ['Nhóm', 'Tổng', 'Đã xong', 'Đang xử lý', 'Quá hạn', 'Đánh giá TB'],
        rows: Array.from(new Set(db.incidents.map(i => i.cat))).map(c => { const xs = db.incidents.filter(i => U.inM(i) && i.cat === c), r = xs.filter(i => i.rating); return [c, xs.length, xs.filter(i => !isOpen(i)).length, xs.filter(isOpen).length, xs.filter(late).length, r.length ? (U.sum(r, i => i.rating) / r.length).toFixed(1) : '–']; }) },
      nhanvien: { t: 'Số thu theo nhân viên (kỳ 09/2026)', cols: ['Người thu', 'Số biên lai', 'Số tiền (đ)'],
        rows: (() => { const m = {}; pays.filter(p => p.date.startsWith('2026-09')).forEach(p => { const k = p.by === 'Hệ thống' || p.by === 'Mini app' ? 'Thanh toán trực tuyến (tự động)' : U.staffName(p.by); m[k] = m[k] || [0, 0]; m[k][0]++; m[k][1] += p.amount; }); return Object.keys(m).map(k => [k, m[k][0], m[k][1]]); })() },
      miengiam: { t: 'Miễn giảm, điều chỉnh', cols: ['Khoản', 'Tiểu thương', 'Kỳ', 'Mức %', 'Số tiền giảm (đ)', 'Lý do'],
        rows: [['PT-202609-00412', 'Lê Thị Kim Hoa', '09/2026', 50, 180000, 'Sửa chữa mái che khu thủy hải sản']].concat(inv.filter(i => i.adjust).map(i => [i.id, A.idx.trader.get(i.traderId).name, U.per(i.period), i.adjust.pct, i.adjust.value, i.adjust.reason])) },
      miniapp: { t: 'Mức độ sử dụng mini app', cols: ['Chợ', 'Ngành hàng', 'Tiểu thương', 'Đã cài', 'Tỷ lệ %'],
        rows: (() => { const m = {}; db.traders.filter(U.inM).forEach(t => { const k = t.market + '|' + t.cat; m[k] = m[k] || [0, 0]; m[k][0]++; if (t.app) m[k][1]++; }); return Object.keys(m).map(k => [U.mShort(k.split('|')[0]), k.split('|')[1], m[k][0], m[k][1], U.pct(m[k][1], m[k][0])]); })() }
    };
  }
  const fmtCell = (v, col) => typeof v === 'number' ? (/%/.test(col) ? U.pctTxt(v) : /\(đ\)/.test(col) ? U.money(v) : v.toLocaleString('vi-VN')) : U.esc(v);
  A.VIEWS['bao-cao'] = function () {
    const R = reports(), r = R[ui.report] || R.lapday;
    let chart = '';
    if (r.chart === 'doanhthu') chart = U.bars(r.rows.map(x => x[0]), [{ name: 'Phải thu', values: r.rows.map(x => x[2]), color: '#b9d8cf' }, { name: 'Đã thu', values: r.rows.map(x => x[3]), color: '#13806b' }], { stacked: false });
    if (r.chart === 'khongtienmat') chart = U.bars(r.rows.map(x => x[0]), [{ name: 'Không tiền mặt %', values: r.rows.map(x => x[4]), color: '#c93d6e' }], { stacked: false, max: 100, fmt: v => Math.round(v) + '%' });
    return `<div class="grid" style="grid-template-columns:minmax(200px,260px) minmax(0,1fr);align-items:start">
      <div class="card no-print"><div class="card-b report-list" style="padding-top:10px">${Object.keys(R).map((k, n) => `<button class="${(R[ui.report] ? ui.report : 'lapday') === k ? 'on' : ''}" data-act="rp" data-id="${k}">${n + 1}. ${R[k].t}</button>`).join('')}</div></div>
      <div class="card"><div class="card-h"><h3>${r.t}</h3><span class="small muted">${ui.market === 'ALL' ? 'Tất cả chợ' : U.mShort(ui.market)} · lập ngày ${U.dmy(U.today())}</span>
        <button class="btn no-print" data-act="rp-csv">⬇ Xuất Excel</button><button class="btn no-print" data-act="print">🖨 In / PDF</button></div>
        <div class="card-b">${chart}${U.table(r.cols.map((c, k) => ({ t: c, num: k > 0 && typeof (r.rows[0] || [])[k] === 'number' })), r.rows.map(row => `<tr>${row.map((v, k) => `<td class="${typeof v === 'number' ? 'num' : ''}">${fmtCell(v, r.cols[k])}</td>`).join('')}</tr>`))}
        <div class="small muted" style="margin-top:10px">Báo cáo được sinh tự động từ dữ liệu nghiệp vụ, không tổng hợp thủ công.</div></div></div></div>`;
  };
  A.ACT.rp = el => { ui.report = el.dataset.id; A.render(); };
  A.ACT['rp-csv'] = () => { const R = reports(), r = R[ui.report] || R.lapday; U.csv('bao-cao-' + (R[ui.report] ? ui.report : 'lapday'), r.cols, r.rows); };

  // ---------- Cài đặt ----------
  A.VIEWS['cai-dat'] = function () {
    const log = A.db.extraLog.concat(A.db.audit);
    return `<div class="grid g2" style="align-items:start">
      <div class="card"><div class="card-h"><h3>Đơn giá dịch vụ</h3></div><div class="card-b">
        ${U.table([{ t: 'Chợ' }, { t: 'Loại diện tích' }, { t: 'Đơn giá', num: true }, { t: 'Căn cứ' }], [
          `<tr><td>Chợ Cao Lãnh (hạng 1)</td><td>Ki-ốt</td><td class="num">2.000 đ/m²/ngày</td><td class="small">QĐ 480/QĐ-UBND ngày 14/02/2026</td></tr>`,
          `<tr><td>Chợ Cao Lãnh (hạng 1)</td><td>Trong nhà lồng chợ</td><td class="num">2.000 đ/m²/ngày</td><td class="small">QĐ 480/QĐ-UBND ngày 14/02/2026</td></tr>`,
          `<tr><td>Chợ Cao Lãnh (hạng 1)</td><td>Ngoài nhà lồng (tự sản tự tiêu)</td><td class="num">800 đ/m²/ngày</td><td class="small">QĐ 480/QĐ-UBND ngày 14/02/2026</td></tr>`,
          `<tr><td>Chợ quê Tân Thuận Đông</td><td>Quầy theo phiên</td><td class="num">20.000 đ/quầy/phiên</td><td class="small"><span class="tag warn">Giả định</span> chờ phường quyết định</td></tr>`,
          `<tr><td>Chợ Cao Lãnh</td><td>Điện / nước (mẫu)</td><td class="num">${U.money(D.ELEC)}/kWh · ${U.money(D.WATER)}/m³</td><td class="small">Theo giá bán lẻ hiện hành</td></tr>`])}
        <div class="row small" style="margin-top:10px"><span class="tag info">Kỳ thu: hằng tháng</span><span class="tag info">Phát hành: ngày 01</span><span class="tag info">Hạn nộp: ngày 15</span></div></div></div>
      <div class="card"><div class="card-h"><h3>Tích hợp</h3></div><div class="card-b small">
        ${[['Ngân hàng – mã QR động (VietQR), nhận báo có', 'Mô phỏng'], ['Zalo OA – gửi thông báo, biên lai', 'Mô phỏng'], ['SMS brandname', 'Mô phỏng'], ['Biên lai điện tử', 'Mô phỏng'], ['Nền tảng tích hợp, chia sẻ dữ liệu của tỉnh (LGSP)', 'Khi triển khai'], ['Trung tâm điều hành thông minh (IOC)', 'Khi triển khai'], ['Đăng nhập một lần (SSO) dùng chung với Phân hệ 1', 'Khi triển khai']].map(r => `<div class="row" style="padding:7px 0;border-bottom:1px solid #eef2f0"><span style="flex:1">${r[0]}</span><span class="tag ${r[1] === 'Mô phỏng' ? 'ok' : ''}">${r[1]}</span></div>`).join('')}</div></div></div>
    <div class="card"><div class="card-h"><h3>Vai trò và phân quyền</h3><span class="small muted">Nguyên tắc tối thiểu quyền hạn</span></div><div class="card-b">
      ${U.table([{ t: 'Vai trò' }, { t: 'Phạm vi dữ liệu' }, { t: 'Quyền' }], D.ROLES.map(r => `<tr><td><b>${r.role}</b></td><td>${r.scope}</td><td class="small">${r.rights}</td></tr>`))}
      <div class="divider"></div><b class="small">Tài khoản cán bộ (mẫu)</b>
      ${U.table([{ t: 'Mã' }, { t: 'Họ tên' }, { t: 'Chức danh' }, { t: 'Chợ' }], D.STAFF.map(s => `<tr><td>${s.id}</td><td>${s.name}</td><td>${s.role}</td><td>${U.mShort(s.market)}</td></tr>`))}</div></div>
    <div class="card"><div class="card-h"><h3>Nhật ký kiểm toán</h3><button class="btn danger" data-act="reset">↺ Đặt lại dữ liệu mẫu</button></div><div class="card-b">
      ${U.table([{ t: 'Thời điểm' }, { t: 'Người thực hiện' }, { t: 'Thao tác' }], log.slice(0, 25).map(l => `<tr><td class="nowrap">${l.at}</td><td>${U.esc(l.who)}</td><td>${U.esc(l.what)}</td></tr>`))}</div></div>`;
  };
  A.ACT.reset = () => A.modal(A.mHead('Đặt lại dữ liệu mẫu') + `<div class="modal-b">Mọi thao tác đã làm trong lúc xem (thu tiền, phản ánh, hợp đồng…) sẽ bị xóa và quay về dữ liệu mẫu ban đầu.</div>
    <div class="modal-f"><button class="btn" data-act="close">Hủy</button><button class="btn danger" data-act="reset-ok">Đặt lại</button></div>`);
  A.ACT['reset-ok'] = () => { A.resetAll(); A.closeModal(); A.render(); U.toast('Đã đặt lại dữ liệu mẫu'); };
})(window.APP);

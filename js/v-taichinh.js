/* Màn hình tài chính: Chỉ số điện nước, Khoản phải thu, Thu tiền, Đối soát, Công nợ. */
(function (A) {
  'use strict';
  const D = A.D, U = A.U, ui = A.ui;
  const f = ui.f;

  // ---------- Kỳ tài chính dùng chung cho 5 màn Tài chính ----------
  // ui.period là "kỳ nghiệp vụ" (billing period) chung, giữ nguyên khi chuyển giữa Chỉ số điện nước,
  // Khoản phải thu, Thu tiền, Đối soát. Ngày phát sinh giao dịch thực tế (ngày ghi chỉ số, ngày thu,
  // ngày giao dịch ngân hàng...) là filter RIÊNG của từng màn, không đồng nhất với kỳ này.
  function financePeriod() {
    const list = A.db.billingPeriods, idx = list.findIndex(p => p.id === ui.period);
    return idx >= 0 ? list[idx] : list[list.length - 1];
  }
  function financeStatusBadge(p) { return p.status === 'COLLECTING' ? '<span class="tag info">● Đang thu</span>' : '<span class="tag">◻ Kỳ trước</span>'; }
  function financeTimeBarRow(label) {
    const p = financePeriod(), list = A.db.billingPeriods, idx = list.findIndex(x => x.id === p.id);
    return `<div class="row" style="flex-wrap:wrap">
      <span class="label-sm">${label}</span>
      <div class="row" style="gap:4px">
        <button class="btn sm" data-act="fp-nav" data-d="-1" ${idx <= 0 ? 'disabled' : ''}>‹</button>
        <select class="input" style="width:120px" data-ch="fp-select">${list.map(x => `<option value="${x.id}" ${x.id === p.id ? 'selected' : ''}>${x.label}</option>`).join('')}</select>
        <button class="btn sm" data-act="fp-nav" data-d="1" ${idx >= list.length - 1 ? 'disabled' : ''}>›</button>
      </div>
      ${financeStatusBadge(p)}<span class="small muted">${U.dmy(p.startDate)} – ${U.dmy(p.endDate)}</span></div>`;
  }
  A.CH['fp-select'] = el => { ui.period = el.value; A.render(); };
  A.ACT['fp-nav'] = el => {
    const list = A.db.billingPeriods, idx = list.findIndex(x => x.id === ui.period), ni = idx + Number(el.dataset.d);
    if (ni >= 0 && ni < list.length) { ui.period = list[ni].id; A.render(); }
  };

  // ---------- Chỉ số điện, nước (quản lý theo từng kỳ/tháng) ----------
  const abnormal = r => r.elecCur != null && (r.elecCur - r.elecPrev) > r.elecAvg * 1.5;
  const nowStamp = () => U.dmy(U.today()) + ' ' + U.nowTime();
  const PHOTO_URLS = {}; // cache URL.createObjectURL trong phiên xem, không lưu localStorage
  const photoKey = (r, kind) => r.period + '|' + r.stallId + '|' + kind;
  const findReading = (id, period) => A.db.readings.find(x => x.stallId === id && x.period === period);
  const currentPeriod = () => {
    const list = A.db.meterPeriods, idx = list.findIndex(p => p.id === ui.period);
    return idx >= 0 ? list[idx] : list[list.length - 1];
  };
  function periodStatusBadge(p) {
    if (p.status === 'RECORDING') return '<span class="tag info">● Đang ghi</span>';
    if (p.status === 'CLOSED') return '<span class="tag ok">🔒 Đã chốt</span>';
    return '<span class="tag">● Chưa bắt đầu</span>';
  }
  function periodHeaderHtml(p) {
    const list = A.db.meterPeriods, idx = list.findIndex(x => x.id === p.id);
    return `<div class="card"><div class="card-b row" style="padding-top:14px;flex-wrap:wrap">
      <span class="label-sm">Kỳ ghi chỉ số</span>
      <div class="row" style="gap:4px">
        <button class="btn sm" data-act="mp-nav" data-d="-1" ${idx <= 0 ? 'disabled' : ''}>‹</button>
        <select class="input" style="width:150px" data-ch="mp-select">${list.map(x => `<option value="${x.id}" ${x.id === p.id ? 'selected' : ''}>Tháng ${U.per(x.id)}</option>`).join('')}</select>
        <button class="btn sm" data-act="mp-nav" data-d="1" ${idx >= list.length - 1 ? 'disabled' : ''}>›</button>
      </div>
      ${periodStatusBadge(p)}<span class="spacer"></span>
      ${p.status === 'CLOSED' ? `<span class="small muted">Người chốt: <b>${U.esc(p.closedBy)}</b> · ${U.esc(p.closedAt)}</span>` : `<span class="small muted">Ngày chốt dự kiến: <b>${U.dmy(p.closeDate)}</b></span>`}
    </div></div>`;
  }
  function photoBadge(r, kind, editable) {
    const att = kind === 'elec' ? r.elecPhoto : r.waterPhoto;
    const ico = kind === 'elec' ? '⚡' : '💧';
    if (att) return `<span class="tag ok" style="cursor:pointer" data-act="dn-photo-view" data-id="${r.stallId}" data-period="${r.period}" data-k="${kind}">${ico}📷 Đã chụp</span>`;
    if (!editable) return `<span class="tag">${ico}📷 Chưa có</span>`;
    return `<label class="btn sm" style="cursor:pointer;display:inline-flex"><input type="file" accept="image/*" style="display:none" data-ch="dn-photo-add" data-id="${r.stallId}" data-period="${r.period}" data-k="${kind}">${ico}📷 Chụp</label>`;
  }
  function rowHtml(r, editable) {
    const st = A.idx.stall.get(r.stallId), t = A.idx.trader.get(st.traderId);
    const ec = r.elecCur != null ? r.elecCur - r.elecPrev : null, wc = r.waterCur != null ? r.waterCur - r.waterPrev : null;
    const elecCell = editable ? `<input class="input" style="width:88px" type="number" data-ch="reading" data-id="${r.stallId}" data-period="${r.period}" data-k="elecCur" value="${r.elecCur == null ? '' : r.elecCur}" placeholder="Nhập">` : (r.elecCur == null ? '<span class="muted">–</span>' : r.elecCur);
    const waterCell = editable ? `<input class="input" style="width:78px" type="number" data-ch="reading" data-id="${r.stallId}" data-period="${r.period}" data-k="waterCur" value="${r.waterCur == null ? '' : r.waterCur}" placeholder="Nhập">` : (r.waterCur == null ? '<span class="muted">–</span>' : r.waterCur);
    return `<tr><td><b>${st.code}</b></td><td>${U.esc(t ? t.name : '')}</td><td class="num">${r.elecPrev}</td>
      <td>${elecCell}</td><td class="num">${ec == null ? '–' : ec}</td><td class="num">${r.waterPrev}</td>
      <td>${waterCell}</td><td class="num">${wc == null ? '–' : wc}</td>
      <td>${photoBadge(r, 'elec', editable)}<br>${photoBadge(r, 'water', editable)}</td>
      <td>${r.status === 'RECORDED' ? '<span class="tag ok">Đã ghi</span>' : '<span class="tag">Chưa ghi</span>'}${abnormal(r) ? `<br><span class="tag danger" title="TB 3 kỳ: ${r.elecAvg} kWh">⚠ Gấp ${(ec / r.elecAvg).toFixed(1)} lần TB</span>` : ''}</td>
      <td class="nowrap">${r.status === 'RECORDED' ? `<button class="btn sm" data-act="dn-detail" data-id="${r.stallId}" data-period="${r.period}">Chi tiết</button>` : ''}</td></tr>`;
  }
  A.VIEWS['dien-nuoc'] = function () {
    const p = currentPeriod();
    const canEdit = A.canDo('dien-nuoc.ghi-chi-so', ui.market);
    const canClose = A.canDo('dien-nuoc.chot-ky', ui.market);
    const header = periodHeaderHtml(p);
    const all = A.db.readings.filter(r => r.period === p.id && U.inM(A.idx.stall.get(r.stallId)));
    if (!all.length) return header + '<div class="card"><div class="empty">Chợ quê không có đồng hồ điện, nước riêng cho quầy.</div></div>';
    const done = all.filter(r => r.status === 'RECORDED').length, todo = all.length - done, abn = all.filter(abnormal).length;
    const rows = all.filter(r => ui.readingsFilter === 'all' || (ui.readingsFilter === 'todo' ? r.status !== 'RECORDED' : abnormal(r)));
    const pg = U.pager('dn' + p.id + ui.readingsFilter, rows.length, 20);
    const editable = canEdit && p.status === 'RECORDING';
    return header + `<div class="kpis">
      <div class="card kpi"><div class="k-label">Kỳ ghi chỉ số</div><div class="k-value">${U.per(p.id)}</div><div class="k-sub">${periodStatusBadge(p)}</div></div>
      <div class="card kpi"><div class="k-label">Đã ghi</div><div class="k-value">${done}/${all.length}</div><div class="bar-mini"><i style="width:${U.pct(done, all.length)}%"></i></div></div>
      <div class="card kpi"><div class="k-label">Chưa ghi</div><div class="k-value" style="${todo ? 'color:#df2225' : ''}">${todo}</div><div class="k-sub">điểm kinh doanh</div></div>
      <div class="card kpi"><div class="k-label">Tăng bất thường</div><div class="k-value" style="color:#df2225">${abn}</div><div class="k-sub">> 150% trung bình 3 kỳ</div></div></div>
    <div class="card"><div class="card-h"><h3>Ghi chỉ số điện, nước</h3>
      <div class="seg">${[['all', 'Tất cả'], ['todo', 'Chưa ghi'], ['abn', 'Bất thường']].map(x => `<button class="${ui.readingsFilter === x[0] ? 'on' : ''}" data-act="dn-filter" data-id="${x[0]}">${x[1]}</button>`).join('')}</div>
      <span class="spacer"></span>
      ${p.status === 'RECORDING' && canClose ? '<button class="btn" data-act="dn-close-period">🔒 Chốt kỳ</button>' : ''}
      ${editable ? '<button class="btn primary" data-act="dn-save-draft">💾 Lưu nháp</button>' : ''}</div>
      <div class="card-b">${U.table([{ t: 'Điểm KD' }, { t: 'Tiểu thương' }, { t: 'Điện: cũ', num: true }, { t: 'Điện: mới' }, { t: 'kWh', num: true }, { t: 'Nước: cũ', num: true }, { t: 'Nước: mới' }, { t: 'm³', num: true }, { t: 'Ảnh đồng hồ' }, { t: 'Trạng thái' }, { t: '' }],
        rows.slice(pg.start, pg.end).map(r => rowHtml(r, editable)))}${pg.html}
        <div class="small muted" style="margin-top:8px">Đơn giá mẫu ${U.money(D.ELEC)}/kWh · ${U.money(D.WATER)}/m³ chỉ để tham khảo trên màn này, không dùng để tính khoản phải thu. Dữ liệu đã sẵn sàng cho kỳ tính phí khi kỳ được chốt.</div></div></div>`;
  };
  A.CH['mp-select'] = el => { ui.period = el.value; ui.page = ui.page || {}; A.render(); };
  A.ACT['mp-nav'] = el => {
    const list = A.db.meterPeriods, idx = list.findIndex(x => x.id === ui.period), ni = idx + Number(el.dataset.d);
    if (ni >= 0 && ni < list.length) { ui.period = list[ni].id; A.render(); }
  };
  A.ACT['dn-filter'] = el => { ui.readingsFilter = el.dataset.id; A.render(); };
  A.CH.reading = el => {
    if (!A.canDo('dien-nuoc.ghi-chi-so', ui.market)) { A.render(); return; }
    const period = el.dataset.period, id = el.dataset.id, k = el.dataset.k;
    const p = A.db.meterPeriods.find(x => x.id === period), r = findReading(id, period);
    if (!r || !p || p.status !== 'RECORDING') { A.render(); return; }
    const v = el.value === '' ? null : Number(el.value);
    const prev = k === 'elecCur' ? r.elecPrev : r.waterPrev;
    if (v != null && v < prev) { U.toast('Chỉ số mới không được nhỏ hơn chỉ số cũ (' + prev + ')'); A.render(); return; }
    r[k] = v;
    if (r.elecCur != null && r.waterCur != null) { r.status = 'RECORDED'; r.recordedBy = 'NV05'; r.recordedAt = nowStamp(); }
    else { r.status = 'PENDING'; r.recordedBy = null; r.recordedAt = null; }
    A.save(); A.render();
    if (k === 'elecCur' && abnormal(r)) U.toast('⚠ Chỉ số điện ' + A.idx.stall.get(r.stallId).code + ' tăng bất thường – đề nghị kiểm tra đồng hồ');
  };
  A.CH['dn-photo-add'] = el => {
    if (!A.canDo('dien-nuoc.ghi-chi-so', ui.market)) return;
    const file = el.files && el.files[0];
    if (!file) return;
    const period = el.dataset.period, id = el.dataset.id, kind = el.dataset.k;
    const p = A.db.meterPeriods.find(x => x.id === period), r = findReading(id, period);
    if (!r || !p || p.status !== 'RECORDING') return;
    r[kind === 'elec' ? 'elecPhoto' : 'waterPhoto'] = { name: file.name, type: file.type, size: file.size, mock: false };
    PHOTO_URLS[photoKey(r, kind)] = URL.createObjectURL(file);
    A.save(); A.render();
    U.toast('Đã đính kèm ảnh ' + (kind === 'elec' ? 'điện' : 'nước') + ' (giả lập, không tải lên máy chủ)');
  };
  A.ACT['dn-photo-view'] = el => {
    const period = el.dataset.period, id = el.dataset.id, kind = el.dataset.k;
    const r = findReading(id, period), st = A.idx.stall.get(id);
    const att = kind === 'elec' ? r.elecPhoto : r.waterPhoto;
    const url = PHOTO_URLS[photoKey(r, kind)];
    A.modal(A.mHead('Ảnh đồng hồ ' + (kind === 'elec' ? 'điện' : 'nước') + ' · ' + st.code) + `<div class="modal-b" style="text-align:center">
      ${url ? `<img src="${url}" style="max-width:100%;border-radius:8px">` : `<div class="empty" style="padding:40px 16px">📷<br>${U.esc(att.name)}<div class="small muted" style="margin-top:6px">Ảnh minh họa (dữ liệu mẫu) · ${Math.round(att.size / 1024)} KB</div></div>`}
      </div><div class="modal-f"><button class="btn primary" data-act="close">Đóng</button></div>`);
  };
  A.ACT['dn-save-draft'] = () => {
    if (!A.canDo('dien-nuoc.ghi-chi-so', ui.market)) return;
    const p = currentPeriod();
    const rows = A.db.readings.filter(r => r.period === p.id && U.inM(A.idx.stall.get(r.stallId)));
    const done = rows.filter(r => r.status === 'RECORDED').length;
    A.save();
    U.toast('Đã lưu dữ liệu kỳ ' + U.per(p.id) + ' (' + done + '/' + rows.length + ' đã ghi)');
  };
  A.ACT['dn-close-period'] = () => {
    if (!A.canDo('dien-nuoc.chot-ky', ui.market)) return;
    const p = currentPeriod();
    const rows = A.db.readings.filter(r => r.period === p.id && U.inM(A.idx.stall.get(r.stallId)));
    const done = rows.filter(r => r.status === 'RECORDED').length, todo = rows.length - done, abn = rows.filter(abnormal).length;
    A.modal(A.mHead('Chốt kỳ ghi chỉ số ' + U.per(p.id) + '?') + `<div class="modal-b">
      <dl class="kv"><dt>Đã ghi</dt><dd>${done}/${rows.length}</dd><dt>Chưa ghi</dt><dd style="${todo ? 'color:#df2225;font-weight:600' : ''}">${todo}</dd><dt>Tăng bất thường</dt><dd>${abn}</dd></dl>
      ${todo ? `<div class="note" style="margin-top:12px">Còn ${todo} điểm kinh doanh chưa ghi chỉ số. Vui lòng ghi đủ trước khi chốt kỳ.</div>` : '<div class="note info" style="margin-top:12px">Sau khi chốt, dữ liệu kỳ này sẽ chuyển sang chế độ chỉ xem.</div>'}
      </div><div class="modal-f"><button class="btn" data-act="close">Hủy</button>
      <button class="btn primary" data-act="dn-close-confirm" data-id="${p.id}" ${todo ? 'disabled' : ''}>Xác nhận chốt kỳ</button></div>`);
  };
  A.ACT['dn-close-confirm'] = el => {
    if (!A.canDo('dien-nuoc.chot-ky', ui.market)) return;
    const p = A.db.meterPeriods.find(x => x.id === el.dataset.id);
    if (!p || p.status !== 'RECORDING') { A.closeModal(); A.render(); return; }
    const rows = A.db.readings.filter(r => r.period === p.id && U.inM(A.idx.stall.get(r.stallId)));
    if (rows.some(r => r.status !== 'RECORDED')) { U.toast('Còn điểm kinh doanh chưa ghi chỉ số, chưa thể chốt kỳ'); return; }
    p.status = 'CLOSED'; p.closedBy = 'Trần Minh Khoa'; p.closedAt = nowStamp();
    U.log('Chốt kỳ ghi chỉ số điện, nước ' + U.per(p.id));
    A.save(); A.closeModal(); A.render();
    U.toast('Đã chốt kỳ ' + U.per(p.id));
  };
  A.ACT['dn-detail'] = el => {
    const period = el.dataset.period, id = el.dataset.id;
    const r = findReading(id, period), st = A.idx.stall.get(id), t = A.idx.trader.get(st.traderId);
    const p = A.db.meterPeriods.find(x => x.id === period);
    const canAdjust = p.status === 'CLOSED' && A.canDo('dien-nuoc.yeu-cau-dieu-chinh', ui.market);
    A.modal(A.mHead('Chi tiết ghi chỉ số · ' + st.code) + `<div class="modal-b">
      <dl class="kv"><dt>Điểm KD</dt><dd>${st.code} · ${U.esc(t ? t.name : '')}</dd><dt>Kỳ</dt><dd>${U.per(period)}</dd>
        <dt>Người ghi</dt><dd>${U.esc(U.staffName(r.recordedBy))}</dd><dt>Thời gian ghi</dt><dd>${U.esc(r.recordedAt || '')}</dd>
        <dt>Điện</dt><dd>${r.elecPrev} → ${r.elecCur} (tiêu thụ ${r.elecCur - r.elecPrev} kWh)</dd>
        <dt>Nước</dt><dd>${r.waterPrev} → ${r.waterCur} (tiêu thụ ${r.waterCur - r.waterPrev} m³)</dd></dl>
      </div><div class="modal-f">${canAdjust ? `<button class="btn" data-act="dn-adjust-req" data-id="${id}" data-period="${period}">Yêu cầu điều chỉnh</button>` : ''}
      <button class="btn primary" data-act="close">Đóng</button></div>`);
  };
  A.ACT['dn-adjust-req'] = el => {
    const period = el.dataset.period, id = el.dataset.id;
    const p = A.db.meterPeriods.find(x => x.id === period);
    if (!A.canDo('dien-nuoc.yeu-cau-dieu-chinh', ui.market) || !p || p.status !== 'CLOSED') return;
    const r = findReading(id, period), st = A.idx.stall.get(id), t = A.idx.trader.get(st.traderId);
    A.modal(A.mHead('Yêu cầu điều chỉnh chỉ số · ' + st.code) + `<div class="modal-b">
      <dl class="kv"><dt>Điểm KD</dt><dd>${st.code} · ${U.esc(t ? t.name : '')}</dd><dt>Kỳ</dt><dd>${U.per(period)}</dd>
        <dt>Chỉ số hiện tại</dt><dd>Điện: ${r.elecPrev} → ${r.elecCur} kWh · Nước: ${r.waterPrev} → ${r.waterCur} m³</dd></dl>
      <div class="form-grid" style="margin-top:12px">
        <div class="field"><label>Điện mới đề nghị sửa</label><input class="input" type="number" id="adjr-elec" value="${r.elecCur}"></div>
        <div class="field"><label>Nước mới đề nghị sửa</label><input class="input" type="number" id="adjr-water" value="${r.waterCur}"></div></div>
      <div class="field" style="margin-top:10px"><label>Lý do</label><textarea class="input" id="adjr-reason" rows="2" placeholder="VD: Đọc nhầm chỉ số đồng hồ điện"></textarea></div>
      <div class="field" style="margin-top:10px"><label>Tài liệu / ảnh minh chứng</label><input type="file" class="input" id="adjr-file" accept="image/*"></div>
      </div><div class="modal-f"><button class="btn" data-act="close">Hủy</button>
      <button class="btn primary" data-act="dn-adjust-send" data-id="${id}" data-period="${period}">Gửi yêu cầu</button></div>`);
  };
  A.ACT['dn-adjust-send'] = el => {
    const period = el.dataset.period, id = el.dataset.id;
    const p = A.db.meterPeriods.find(x => x.id === period);
    if (!A.canDo('dien-nuoc.yeu-cau-dieu-chinh', ui.market) || !p || p.status !== 'CLOSED') return;
    const r = findReading(id, period), st = A.idx.stall.get(id);
    const reason = A.$('#adjr-reason').value.trim();
    if (!reason) { U.toast('Vui lòng nhập lý do điều chỉnh'); return; }
    const file = A.$('#adjr-file').files[0];
    A.db.meterAdjustRequests.unshift({
      id: 'YCDC-' + U.pad(A.db.meterAdjustRequests.length + 1, 4), stallId: id, period,
      elecCur: r.elecCur, elecProposed: Number(A.$('#adjr-elec').value),
      waterCur: r.waterCur, waterProposed: Number(A.$('#adjr-water').value),
      reason, attachment: file ? { name: file.name, type: file.type, size: file.size } : null,
      status: 'PENDING', requestedBy: 'NV05', requestedAt: nowStamp()
    });
    U.log('Gửi yêu cầu điều chỉnh chỉ số ' + st.code + ' kỳ ' + U.per(period));
    A.save(); A.closeModal();
    U.toast('Đã gửi yêu cầu điều chỉnh (giả lập, chờ phê duyệt) – chưa có quy trình phê duyệt backend');
  };

  // ---------- Khoản phải thu ----------
  A.VIEWS['phai-thu'] = function () {
    const fp = financePeriod(), p = fp.id;
    const periods = A.db.issuedPeriods;
    const q = (f.ptSearch || '').toLowerCase();
    const inv = A.db.invoices.filter(i => U.inM(i) && i.period === p);
    const rows = inv.filter(i => (!f.ptStatus || (f.ptStatus === 'over' ? U.isOver(i) : i.status === f.ptStatus))
      && (!q || i.id.toLowerCase().includes(q) || A.idx.trader.get(i.traderId).name.toLowerCase().includes(q) || A.idx.stall.get(i.stallId).code.toLowerCase().includes(q)));
    const pg = U.pager('pt' + p, rows.length, 25);
    const amt = U.sum(inv, i => i.amount), paid = U.sum(inv, i => i.paid);
    const next = periods.includes('2026-10') ? null : '2026-10';
    const canIssue = A.canDo('phai-thu.phat-hanh');
    return `<div class="card"><div class="card-b" style="padding-top:14px">${financeTimeBarRow('Kỳ thu')}
      <div class="row small" style="margin-top:8px;flex-wrap:wrap"><span class="muted">Hạn nộp: <b>${U.dmy(fp.dueDate)}</b></span><span class="spacer"></span>
        ${next && canIssue ? `<button class="btn primary" data-act="pt-issue">⚙ Phát hành tự động kỳ 10/2026</button>` : (next ? '' : '<span class="tag ok">Đã phát hành kỳ 10/2026</span>')}</div></div></div>
    <div class="kpis">
      <div class="card kpi"><div class="k-label">Số khoản phải thu</div><div class="k-value">${inv.length}</div><div class="k-sub">Tạo tự động từ hợp đồng, đơn giá, chỉ số điện nước</div></div>
      <div class="card kpi"><div class="k-label">Tổng phải thu</div><div class="k-value">${U.moneyShort(amt)}</div><div class="k-sub">${U.money(amt)}</div></div>
      <div class="card kpi"><div class="k-label">Đã thu</div><div class="k-value">${U.moneyShort(paid)}</div><div class="bar-mini"><i style="width:${U.pct(paid, amt)}%"></i></div></div>
      <div class="card kpi"><div class="k-label">Còn phải thu</div><div class="k-value" style="color:#df2225">${U.moneyShort(amt - paid)}</div><div class="k-sub">Tỷ lệ thu ${U.pctTxt(U.pct(paid, amt))}</div></div></div>
    <div class="card"><div class="card-h"><h3>Danh sách khoản phải thu kỳ ${fp.label}</h3>
      <select class="input" data-ch="pt-status"><option value="">Mọi trạng thái</option><option value="paid" ${f.ptStatus === 'paid' ? 'selected' : ''}>Đã thu</option><option value="unpaid" ${f.ptStatus === 'unpaid' ? 'selected' : ''}>Chưa thu</option><option value="partial" ${f.ptStatus === 'partial' ? 'selected' : ''}>Thu một phần</option><option value="over" ${f.ptStatus === 'over' ? 'selected' : ''}>Quá hạn</option></select>
      <input class="input" placeholder="Mã khoản, tiểu thương, mã điểm" data-in="pt-search" value="${U.esc(f.ptSearch || '')}"></div>
      <div class="card-b">${U.table([{ t: 'Mã khoản' }, { t: 'Tiểu thương' }, { t: 'Điểm KD' }, { t: 'Số tiền', num: true }, { t: 'Đã thu', num: true }, { t: 'Hạn nộp' }, { t: 'Trạng thái' }],
        rows.slice(pg.start, pg.end).map(i => `<tr class="click" data-act="inv-open" data-id="${i.id}"><td>${i.id}${i.adjust ? ' <span class="tag purple">Miễn giảm</span>' : ''}</td><td>${U.esc(A.idx.trader.get(i.traderId).name)}</td><td>${A.idx.stall.get(i.stallId).code}</td>
          <td class="num">${U.money(i.amount)}</td><td class="num">${U.money(i.paid)}</td><td>${U.dmy(i.due)}</td><td>${U.invTag(i)}</td></tr>`))}${pg.html}</div></div>`;
  };
  A.CH['pt-status'] = el => { f.ptStatus = el.value; A.render(); };
  A.IN['pt-search'] = el => { f.ptSearch = el.value; A.render(); };
  A.ACT['pt-issue'] = () => {
    if (!A.canDo('phai-thu.phat-hanh')) return;
    const db = A.db;
    if (db.issuedPeriods.includes('2026-10')) { U.toast('Kỳ 10/2026 đã được phát hành'); A.render(); return; }
    const out = [];
    db.contracts.filter(c => c.status === 'hieuluc').forEach(c => {
      const st = A.idx.stall.get(c.stallId);
      if (st.status === 'ngung' || st.status === 'trong') return;
      const items = [];
      if (st.market === 'TTD') items.push({ name: 'Phí quầy theo phiên (5 phiên × ' + D.SESSION_FEE.toLocaleString('vi-VN') + ' đ)', amount: 5 * D.SESSION_FEE });
      else {
        items.push({ name: 'Giá dịch vụ sử dụng diện tích bán hàng (' + st.area + ' m² × ' + c.unit.toLocaleString('vi-VN') + ' đ × 30 ngày)', amount: c.monthly });
        const latestPeriod = db.meterPeriods[db.meterPeriods.length - 1].id;
        const r = db.readings.find(x => x.stallId === st.id && x.period === latestPeriod);
        if (r) {
          const kwh = r.elecCur != null ? r.elecCur - r.elecPrev : r.elecAvg, m3 = r.waterCur != null ? r.waterCur - r.waterPrev : r.waterAvg;
          items.push({ name: 'Tiền điện (' + kwh + ' kWh × ' + D.ELEC.toLocaleString('vi-VN') + ' đ)' + (r.elecCur == null ? ' – tạm tính theo TB' : ''), amount: kwh * D.ELEC });
          items.push({ name: 'Tiền nước (' + m3 + ' m³ × ' + D.WATER.toLocaleString('vi-VN') + ' đ)' + (r.waterCur == null ? ' – tạm tính theo TB' : ''), amount: m3 * D.WATER });
        }
      }
      const inv = { id: 'PT-202610-' + U.pad(db.invoices.length + 1, 5), period: '2026-10', market: c.market, stallId: st.id, traderId: c.traderId, contractId: c.id, items, amount: U.sum(items, x => x.amount), paid: 0, issued: '2026-10-01', due: '2026-10-15', status: 'unpaid', adjust: null, reminders: 0 };
      db.invoices.push(inv); A.idx.invoice.set(inv.id, inv); out.push(inv);
    });
    db.issuedPeriods.push('2026-10');
    const prevBp = db.billingPeriods.find(x => x.id === '2026-09');
    if (prevBp) prevBp.status = 'PAST';
    db.billingPeriods.push({ id: '2026-10', label: '10/2026', startDate: '2026-10-01', endDate: '2026-10-31', dueDate: '2026-10-15', status: 'COLLECTING' });
    db.notifications.unshift({ id: 'TB-' + U.pad(32 + db.notifications.length, 3), at: U.today(), title: 'Phát hành khoản phải thu kỳ 10/2026', group: 'Toàn bộ tiểu thương', channels: ['Mini app', 'Zalo OA'], sent: out.length, delivered: 0.97, read: 0, auto: true });
    U.log('Phát hành tự động ' + out.length + ' khoản phải thu kỳ 10/2026');
    ui.period = '2026-10'; A.save(); A.render();
    U.toast(`Đã phát hành ${out.length} khoản phải thu kỳ 10/2026 (${U.moneyShort(U.sum(out, x => x.amount))}) và gửi thông báo cho tiểu thương`);
  };
  A.ACT['inv-open'] = el => {
    const i = A.idx.invoice.get(el.dataset.id), t = A.idx.trader.get(i.traderId);
    const pays = A.db.payments.filter(p => p.invoiceId === i.id);
    A.modal(A.mHead('Khoản phải thu ' + i.id) + `<div class="modal-b">
      <dl class="kv"><dt>Tiểu thương</dt><dd>${U.esc(t.name)} (${t.id})</dd><dt>Điểm KD</dt><dd>${A.idx.stall.get(i.stallId).code} · ${U.mShort(i.market)}</dd>
        <dt>Kỳ / hạn nộp</dt><dd>${U.per(i.period)} · hạn ${U.dmy(i.due)}</dd><dt>Trạng thái</dt><dd>${U.invTag(i)}</dd></dl><div class="divider"></div>
      ${U.table([{ t: 'Nội dung' }, { t: 'Số tiền', num: true }], i.items.map(x => `<tr><td>${x.name}</td><td class="num">${U.money(x.amount)}</td></tr>`)
        .concat(i.adjust ? [`<tr><td>Miễn giảm ${i.adjust.pct}% (${U.esc(i.adjust.reason)}) – đã phê duyệt</td><td class="num">−${U.money(i.adjust.value)}</td></tr>`] : [])
        .concat([`<tr><td><b>Tổng cộng</b></td><td class="num"><b>${U.money(i.amount)}</b></td></tr>`]))}
      ${pays.length ? '<div class="divider"></div><b>Thanh toán</b>' + U.table([{ t: 'Biên lai' }, { t: 'Ngày' }, { t: 'Hình thức' }, { t: 'Số tiền', num: true }], pays.map(p => `<tr class="click" data-act="receipt" data-id="${p.receipt}"><td>${p.receipt}</td><td>${U.dmy(p.date)} ${p.time}</td><td>${D.METHOD[p.method]}</td><td class="num">${U.money(p.amount)}</td></tr>`)) : ''}
      </div><div class="modal-f">
      ${i.status !== 'paid' && !i.adjust && A.canDo('phai-thu.mien-giam', i.market) ? `<button class="btn" data-act="inv-adjust" data-id="${i.id}">Miễn giảm / điều chỉnh</button>` : ''}
      ${i.status !== 'paid' && A.canDo('thu-tien.thu', i.market) ? `<button class="btn primary" data-act="pay-open" data-id="${i.traderId}" data-inv="${i.id}">💳 Thu tiền</button>` : ''}
      <button class="btn" data-act="close">Đóng</button></div>`, true);
  };
  A.ACT['inv-adjust'] = el => {
    const i = A.idx.invoice.get(el.dataset.id);
    if (!A.canDo('phai-thu.mien-giam', i.market) || i.status === 'paid' || i.adjust) return;
    A.modal(A.mHead('Miễn giảm ' + i.id) + `<div class="modal-b"><div class="form-grid">
      <div class="field"><label>Mức miễn giảm</label><select class="input" id="adj-pct"><option>10</option><option>30</option><option selected>50</option><option>100</option></select></div>
      <div class="field"><label>Lý do</label><input class="input" id="adj-reason" value="Sửa chữa hạ tầng khu vực, tạm ngừng kinh doanh"></div></div>
      <div class="note" style="margin-top:12px">Quy trình: nhân viên đề xuất → Trưởng Ban Quản lý phê duyệt → hệ thống điều chỉnh khoản phải thu và ghi nhật ký. (Prototype: phê duyệt ngay)</div></div>
      <div class="modal-f"><button class="btn" data-act="close">Hủy</button><button class="btn primary" data-act="inv-adjust-save" data-id="${i.id}">Gửi & phê duyệt</button></div>`);
  };
  A.ACT['inv-adjust-save'] = el => {
    const i = A.idx.invoice.get(el.dataset.id);
    if (!A.canDo('phai-thu.mien-giam', i.market) || i.status === 'paid' || i.adjust) return;
    const pctv = Number(A.$('#adj-pct').value), reason = A.$('#adj-reason').value.trim() || 'Không ghi';
    const base = i.items[0].amount, value = Math.round(base * pctv / 100 / 1000) * 1000;
    i.adjust = { pct: pctv, reason, value }; i.amount = Math.max(i.paid, i.amount - value);
    if (i.paid >= i.amount) i.status = 'paid';
    A.refreshStall(A.idx.stall.get(i.stallId));
    U.log(`Phê duyệt miễn giảm ${pctv}% khoản ${i.id} (${reason})`);
    A.save(); A.closeModal(); A.render(); U.toast('Đã phê duyệt miễn giảm ' + U.money(value));
  };

  // ---------- Thu tiền ----------
  function renderPay() {
    const ps = ui.pay, t = A.idx.trader.get(ps.traderId);
    const invs = A.db.invoices.filter(i => i.traderId === t.id && i.status !== 'paid' && i.market === t.market).sort((a, b) => a.due.localeCompare(b.due));
    const total = U.sum(invs.filter(i => ps.sel.includes(i.id)), U.due);
    const amount = ps.amount == null ? total : Math.min(ps.amount, total);
    const content = 'CHOSO ' + t.id + ' ' + (invs.find(i => ps.sel.includes(i.id)) || { id: '' }).id;
    A.modal(A.mHead('Thu tiền · ' + U.esc(t.name)) + `<div class="modal-b">
      ${U.table([{ t: '' }, { t: 'Khoản' }, { t: 'Kỳ' }, { t: 'Điểm KD' }, { t: 'Hạn' }, { t: 'Còn phải thu', num: true }],
        invs.map(i => `<tr><td><input type="checkbox" data-ch="pay-sel" data-id="${i.id}" ${ps.sel.includes(i.id) ? 'checked' : ''}></td><td>${i.id}</td><td>${U.per(i.period)}</td><td>${A.idx.stall.get(i.stallId).code}</td><td>${U.isOver(i) ? `<span class="tag danger">${U.dmy(i.due)}</span>` : U.dmy(i.due)}</td><td class="num">${U.money(U.due(i))}</td></tr>`), { empty: 'Không còn khoản nào phải thu' })}
      <div class="form-grid" style="margin-top:14px">
        <div class="field"><label>Số tiền thu (có thể thu một phần)</label><input class="input" type="number" data-ch="pay-amount" value="${amount}"></div>
        <div class="field"><label>Tổng các khoản đã chọn</label><input class="input" value="${U.money(total)}" disabled></div></div>
      <div class="pay-methods" style="margin-top:14px">${['qr', 'ck', 'tm'].map(m => `<label><input type="radio" name="pm" data-ch="pay-method" value="${m}" ${ps.method === m ? 'checked' : ''}><span>${{ qr: '📱 ', ck: '🏦 ', tm: '💵 ' }[m]}${D.METHOD[m]}</span></label>`).join('')}</div>
      ${ps.method === 'qr' ? `<div class="qr-box">${U.qr(content + amount)}<div class="small"><b>Mã QR thanh toán (minh họa)</b><br>Ngân hàng: (kết nối khi triển khai)<br>Tài khoản: BQL ${U.esc(U.market(t.market).name)}<br>Số tiền: <b>${U.money(amount)}</b><br>Nội dung: <b>${content}</b><br><span class="muted">Hệ thống tự ghi nhận khi ngân hàng báo có.</span></div></div>` : ''}
      ${ps.method === 'ck' ? '<div class="note info" style="margin-top:12px">Ghi nhận khoản chuyển khoản đã nhận; hệ thống sẽ đối chiếu với sao kê ngân hàng.</div>' : ''}
      </div><div class="modal-f"><button class="btn" data-act="close">Hủy</button>
      <button class="btn primary" data-act="pay-confirm" ${amount > 0 ? '' : 'disabled'}>${ps.method === 'qr' ? 'Giả lập: tiểu thương đã quét mã và chuyển tiền' : 'Xác nhận thu & phát hành biên lai'}</button></div>`, true);
  }
  A.ACT['pay-open'] = el => {
    const tid = el.dataset.id, t = A.idx.trader.get(tid);
    if (!t || !A.canDo('thu-tien.thu', t.market)) { U.toast('Bạn không có quyền thu tiền cho tiểu thương này'); return; }
    const invs = A.db.invoices.filter(i => i.traderId === tid && i.status !== 'paid' && i.market === t.market);
    if (!invs.length) { U.toast('Tiểu thương không còn khoản nào phải thu'); return; }
    ui.pay = { traderId: tid, sel: el.dataset.inv ? [el.dataset.inv] : invs.map(i => i.id), method: 'qr', amount: null };
    renderPay();
  };
  A.CH['pay-sel'] = el => { const s = ui.pay.sel, id = el.dataset.id; ui.pay.sel = el.checked ? s.concat([id]) : s.filter(x => x !== id); ui.pay.amount = null; renderPay(); };
  A.CH['pay-amount'] = el => { ui.pay.amount = Math.max(0, Number(el.value) || 0); renderPay(); };
  A.CH['pay-method'] = el => { ui.pay.method = el.value; renderPay(); };
  A.ACT['pay-confirm'] = () => {
    const ps = ui.pay;
    const t = ps && A.idx.trader.get(ps.traderId);
    if (!t || !A.canDo('thu-tien.thu', t.market)) { U.toast('Bạn không có quyền thu tiền cho tiểu thương này'); A.closeModal(); return; }
    const sel = A.db.invoices.filter(i => ps.sel.includes(i.id) && i.traderId === t.id && i.market === t.market && i.status !== 'paid');
    if (!sel.length) { U.toast('Khoản phải thu không còn hợp lệ (đã thu hoặc không thuộc phạm vi)'); A.closeModal(); A.render(); return; }
    const total = U.sum(sel, U.due);
    const amount = ps.amount == null ? total : Math.min(ps.amount, total);
    if (amount <= 0) { U.toast('Số tiền thu không hợp lệ'); return; }
    const pays = A.applyPayment(sel.map(i => i.id), amount, ps.method, ps.method === 'tm' ? 'NV03' : 'Hệ thống');
    A.render(); A.showReceipt(pays);
    U.toast('Đã thu ' + U.money(amount) + ' · biên lai điện tử đã gửi tới tiểu thương');
  };

  A.VIEWS['thu-tien'] = function () {
    const q = (f.thuSearch || '').toLowerCase();
    const payDate = f.thuDate || U.today();
    const debtors = new Map();
    A.db.invoices.filter(i => U.inM(i) && i.status !== 'paid').forEach(i => {
      const d = debtors.get(i.traderId) || { n: 0, amt: 0, over: 0 };
      d.n++; d.amt += U.due(i); if (U.isOver(i)) d.over += U.due(i);
      debtors.set(i.traderId, d);
    });
    let list = Array.from(debtors.entries()).map(([id, d]) => Object.assign({ t: A.idx.trader.get(id) }, d))
      .filter(x => !q || x.t.name.toLowerCase().includes(q) || x.t.phone.includes(q) || x.t.stalls.some(id => A.idx.stall.get(id).code.toLowerCase().includes(q)))
      .sort((a, b) => b.over - a.over || b.amt - a.amt);
    const pg = U.pager('thu', list.length, 12);
    const today = A.db.payments.filter(p => U.inM(p) && p.date === payDate).slice().reverse();
    const cash = U.sum(today.filter(p => p.method === 'tm'), p => p.amount), non = U.sum(today.filter(p => p.method !== 'tm'), p => p.amount);
    const timeBar = `<div class="card"><div class="card-b" style="padding-top:14px">${financeTimeBarRow('Kỳ khoản thu')}
      <div class="row small" style="margin-top:8px"><span class="label-sm">Ngày thu</span><input type="date" class="input" style="width:160px" data-ch="thu-date" value="${payDate}"></div></div></div>`;
    return timeBar + `<div class="grid g-main" style="align-items:start">
      <div class="card"><div class="card-h"><h3>Tìm tiểu thương cần thu</h3><input class="input" style="width:260px" placeholder="Tên, SĐT hoặc mã điểm (VD: HS-A05)" data-in="thu-search" value="${U.esc(f.thuSearch || '')}"></div>
        <div class="card-b">${U.table([{ t: 'Tiểu thương' }, { t: 'Điểm KD' }, { t: 'Số khoản', num: true }, { t: 'Còn phải thu', num: true }, { t: 'Quá hạn', num: true }, { t: '' }],
          list.slice(pg.start, pg.end).map(x => `<tr><td><b>${U.esc(x.t.name)}</b><div class="small muted">${x.t.id} · ${U.maskPhone(x.t.phone)}</div></td><td>${x.t.stalls.map(id => A.idx.stall.get(id).code).join(', ')}</td><td class="num">${x.n}</td><td class="num">${U.money(x.amt)}</td><td class="num" style="${x.over ? 'color:#df2225;font-weight:600' : ''}">${x.over ? U.money(x.over) : '–'}</td><td>${A.canDo('thu-tien.thu', x.t.market) ? `<button class="btn sm primary" data-act="pay-open" data-id="${x.t.id}">Thu tiền</button>` : ''}</td></tr>`))}${pg.html}</div></div>
      <div class="card"><div class="card-h"><h3>Giao dịch ngày ${U.dmy(payDate)}</h3></div><div class="card-b">
        <div class="row small" style="margin-bottom:8px"><span class="tag">💵 Tiền mặt ${U.moneyShort(cash)}</span><span class="tag info">📱 QR/CK ${U.moneyShort(non)}</span></div>
        ${today.length ? today.slice(0, 14).map(p => `<div class="row small click" style="padding:7px 0;border-bottom:1px solid #eef2f7;cursor:pointer" data-act="receipt" data-id="${p.receipt}"><span class="muted">${p.time}</span><span style="flex:1">${U.esc(A.idx.trader.get(p.traderId).name)}<div class="muted">${p.receipt} · ${D.METHOD[p.method]}</div></span><b>${U.money(p.amount)}</b></div>`).join('') : '<div class="empty">Chưa có giao dịch</div>'}
      </div></div></div>`;
  };
  A.IN['thu-search'] = el => { f.thuSearch = el.value; ui.page.thu = 0; A.render(); };
  A.CH['thu-date'] = el => { f.thuDate = el.value || U.today(); A.render(); };

  // ---------- Đối soát ----------
  const DS_BANK_LABEL = {
    MATCHED_AUTO: { t: '✓ Khớp tự động', cls: 'ok' },
    MATCHED_MANUAL: { t: '✓ Khớp thủ công', cls: 'ok' },
    UNMATCHED: { t: '● Chưa khớp', cls: '' },
    AMOUNT_MISMATCH: { t: '⚠ Lệch số tiền', cls: 'danger' },
    NEEDS_REVIEW: { t: '⚠ Cần xử lý', cls: 'warn' }
  };
  function dsBankTag(b) { const s = DS_BANK_LABEL[b.status] || DS_BANK_LABEL.UNMATCHED; return `<span class="tag ${s.cls}">${s.t}</span>`; }
  function dsActor() { return ui.role === 'lanhdao' ? 'Lãnh đạo UBND phường' : 'Trần Minh Khoa'; }
  function dsNowStamp() { return U.dmy(U.today()) + ' ' + U.nowTime(); }
  function dsCanBank() { return A.PERM.canAction(ui.role, 'doi-soat.xem-ngan-hang'); }
  function dsCanBankMatch() { return A.PERM.canAction(ui.role, 'doi-soat.gan-thu-cong'); }
  function dsCanCash() { return A.PERM.canAction(ui.role, 'doi-soat.xem-tien-mat'); }
  function dsCanCashConfirm() { return A.PERM.canAction(ui.role, 'doi-soat.xac-nhan-nop-quy'); }
  function dsCanAudit() { return A.PERM.canAction(ui.role, 'doi-soat.xem-truy-vet'); }
  function dsBankOf(id) { return A.db.bank.find(x => x.id === id); }
  function dsInvoiceInfo(receivableId) {
    if (!receivableId) return null;
    const inv = A.idx.invoice.get(receivableId);
    if (!inv) return null;
    return { inv, trader: A.idx.trader.get(inv.traderId), stall: A.idx.stall.get(inv.stallId) };
  }
  function dsTxFrom() { return ui.dsFrom || financePeriod().startDate; }
  function dsTxTo() { return ui.dsTo || U.today(); }
  function dsBankRows() {
    const from = dsTxFrom(), to = dsTxTo();
    return A.db.bank.filter(b => U.inM(b) && (b.date || U.today()) >= from && (b.date || U.today()) <= to);
  }
  function dsBankFiltered() {
    const q = (ui.dsBankSearch || '').toLowerCase();
    const grp = { all: null, matched: ['MATCHED_AUTO', 'MATCHED_MANUAL'], unmatched: ['UNMATCHED'], mismatch: ['AMOUNT_MISMATCH'], review: ['NEEDS_REVIEW'] }[ui.dsBankFilter];
    return dsBankRows().filter(b => {
      if (grp && !grp.includes(b.status)) return false;
      if (!q) return true;
      const info = dsInvoiceInfo(b.receivableId);
      const hay = [b.id, b.ref, b.receivableId || '', b.receiptId || '', info ? info.trader.name : '', info ? info.stall.code : ''].join(' ').toLowerCase();
      return hay.includes(q);
    }).slice().reverse();
  }

  A.VIEWS['doi-soat'] = function () {
    const canBank = dsCanBank(), canCash = dsCanCash();
    const tabs = [];
    if (canBank) tabs.push(['ngan-hang', 'Ngân hàng / QR']);
    if (canCash) tabs.push(['tien-mat', 'Tiền mặt']);
    if (!tabs.length) return '<div class="card"><div class="empty">Bạn chưa được cấp quyền xem nghiệp vụ đối soát.</div></div>';
    const tab = tabs.some(t => t[0] === ui.dsTab) ? ui.dsTab : tabs[0][0];
    const tabBar = tabs.length > 1
      ? `<div class="seg">${tabs.map(t => `<button class="${tab === t[0] ? 'on' : ''}" data-act="ds-tab" data-id="${t[0]}">${t[1]}</button>`).join('')}</div>`
      : `<h3 style="margin:0;font-size:var(--font-size-md)">${tabs[0][1]}</h3>`;
    const timeBar = `<div class="card"><div class="card-b" style="padding-top:14px">${financeTimeBarRow('Kỳ khoản thu')}
      <div class="row small" style="margin-top:8px;flex-wrap:wrap"><span class="label-sm">Ngày giao dịch</span>
        <input type="date" class="input" style="width:150px" data-ch="ds-from" value="${dsTxFrom()}"><span class="muted">→</span>
        <input type="date" class="input" style="width:150px" data-ch="ds-to" value="${dsTxTo()}"></div></div></div>`;
    return timeBar + `<div class="card"><div class="card-b" style="padding-top:14px">${tabBar}</div></div>` + (tab === 'ngan-hang' ? dsBankView() : dsCashView());
  };
  A.ACT['ds-tab'] = el => { ui.dsTab = el.dataset.id; A.render(); };
  A.CH['ds-from'] = el => { ui.dsFrom = el.value || null; A.render(); };
  A.CH['ds-to'] = el => { ui.dsTo = el.value || null; A.render(); };

  // ---- Ngân hàng / QR ----
  function dsBankView() {
    const canMatch = dsCanBankMatch();
    const all = dsBankRows();
    const total = all.length, totalAmt = U.sum(all, b => b.amount);
    const autoMatched = all.filter(b => b.status === 'MATCHED_AUTO').length;
    const needsWork = all.filter(b => b.status !== 'MATCHED_AUTO' && b.status !== 'MATCHED_MANUAL');
    const mismatch = all.filter(b => b.status === 'AMOUNT_MISMATCH');
    const rows = dsBankFiltered();
    const pg = U.pager('ds-bank' + ui.dsBankFilter, rows.length, 20);
    return `<div class="kpis">
      <div class="card kpi"><div class="k-label">Tổng giao dịch ngân hàng</div><div class="k-value">${total}</div><div class="k-sub">${U.money(totalAmt)}</div></div>
      <div class="card kpi"><div class="k-label">Khớp tự động</div><div class="k-value">${autoMatched}/${total}</div><div class="k-sub">${U.pctTxt(U.pct(autoMatched, total))}</div></div>
      <div class="card kpi"><div class="k-label">Cần xử lý</div><div class="k-value" style="color:${needsWork.length ? '#df2225' : '#20a04e'}">${needsWork.length}</div><div class="k-sub">${U.money(U.sum(needsWork, b => b.amount))}</div></div>
      <div class="card kpi"><div class="k-label">Lệch số tiền</div><div class="k-value" style="color:${mismatch.length ? '#df2225' : '#20a04e'}">${mismatch.length}</div><div class="k-sub">Cần Kế toán kiểm tra</div></div></div>
    <div class="card"><div class="card-h"><h3>Sao kê ngân hàng / QR</h3>
      <div class="seg">${[['all', 'Tất cả'], ['matched', 'Đã khớp'], ['unmatched', 'Chưa khớp'], ['mismatch', 'Lệch số tiền'], ['review', 'Cần xử lý']].map(x => `<button class="${ui.dsBankFilter === x[0] ? 'on' : ''}" data-act="ds-bank-filter" data-id="${x[0]}">${x[1]}</button>`).join('')}</div>
      <span class="spacer"></span>
      <input class="input" style="width:260px" placeholder="Tìm mã sao kê, khoản phải thu, tiểu thương..." data-in="ds-bank-search" value="${U.esc(ui.dsBankSearch || '')}">
      <button class="btn" data-act="ds-csv">⬇ Xuất Excel</button></div>
      <div class="card-b">${U.table([{ t: 'Ngày giờ' }, { t: 'Mã sao kê' }, { t: 'Nội dung chuyển khoản' }, { t: 'Số tiền', num: true }, { t: 'Khoản phải thu' }, { t: 'Biên lai' }, { t: 'Tiểu thương' }, { t: 'Kết quả' }, { t: '' }],
        rows.slice(pg.start, pg.end).map(b => {
          const info = dsInvoiceInfo(b.receivableId);
          const canBtnMatch = canMatch && b.status !== 'MATCHED_AUTO' && b.status !== 'MATCHED_MANUAL';
          return `<tr class="click" data-act="ds-bank-view" data-id="${b.id}">
            <td class="nowrap">${U.dmy(b.date || U.today())} ${b.time}</td><td>${b.id}</td><td class="small">${U.esc(b.ref)}</td>
            <td class="num">${U.money(b.amount)}</td>
            <td class="small">${info ? info.inv.id : '<span class="muted">–</span>'}</td>
            <td class="small">${b.receiptId ? b.receiptId : '<span class="muted">–</span>'}</td>
            <td class="small">${info ? U.esc(info.trader.name) : '<span class="muted">–</span>'}</td>
            <td>${dsBankTag(b)}</td>
            <td class="nowrap"><button class="btn sm" data-act="ds-bank-view" data-id="${b.id}">Xem</button>
              ${canBtnMatch ? `<button class="btn sm accent" data-act="ds-bank-match" data-id="${b.id}">Gắn thủ công</button>` : ''}</td></tr>`;
        }), { empty: 'Không có giao dịch phù hợp' })}${pg.html}</div></div>`;
  }
  A.IN['ds-bank-search'] = el => { ui.dsBankSearch = el.value; ui.page['ds-bank' + ui.dsBankFilter] = 0; A.render(); };
  A.ACT['ds-bank-filter'] = el => { ui.dsBankFilter = el.dataset.id; A.render(); };
  A.ACT['ds-csv'] = () => {
    const rows = dsBankRows();
    U.csv('doi-soat-ngan-hang-' + U.today(), ['Giờ', 'Mã sao kê', 'Nội dung', 'Số tiền', 'Khoản phải thu', 'Biên lai', 'Trạng thái'],
      rows.map(b => [b.time, b.id, b.ref, b.amount, b.receivableId || '', b.receiptId || '', (DS_BANK_LABEL[b.status] || {}).t || b.status]));
  };

  function dsBankDrawerHtml(b) {
    const canMatch = dsCanBankMatch() && b.status !== 'MATCHED_AUTO' && b.status !== 'MATCHED_MANUAL';
    const canAudit = dsCanAudit();
    const info = dsInvoiceInfo(b.receivableId);
    const pay = b.paymentId ? A.db.payments.find(x => x.id === b.paymentId) : null;
    const reasons = {
      MATCHED_AUTO: ['Mã tham chiếu trùng', 'Số tiền trùng', 'Nằm trong cửa sổ thời gian hợp lệ'],
      MATCHED_MANUAL: ['Được nhân viên gắn thủ công với khoản phải thu'],
      UNMATCHED: ['Không tìm thấy khoản phải thu phù hợp với nội dung chuyển khoản'],
      AMOUNT_MISMATCH: ['Tìm thấy khoản phải thu qua mã tham chiếu', 'Số tiền chuyển khoản không khớp số tiền phải thu'],
      NEEDS_REVIEW: ['Nội dung chuyển khoản chưa đủ rõ để xác định khoản phải thu']
    }[b.status] || [];
    return `<div class="drawer-h"><div><h3>Truy vết giao dịch ${b.id}</h3><div class="small muted">${U.mShort(b.market)}</div></div><span class="spacer"></span><button class="x" data-act="close" aria-label="Đóng">×</button></div>
      <div class="drawer-b">
        <b class="small">1. Sao kê ngân hàng</b>
        <dl class="kv" style="margin-top:6px"><dt>Mã</dt><dd>${b.id}</dd><dt>Thời gian</dt><dd>${U.dmy(b.date || U.today())} ${b.time}</dd>
          <dt>Số tiền</dt><dd>${U.money(b.amount)}</dd><dt>Nội dung</dt><dd>${U.esc(b.ref)}</dd>
          <dt>Ngân hàng</dt><dd>${U.esc(b.bankName)}</dd><dt>Tài khoản nhận</dt><dd>BQL ${U.esc(U.market(b.market).name)}</dd></dl>
        <div class="divider"></div><b class="small">2. Payment</b>
        ${pay ? `<dl class="kv" style="margin-top:6px"><dt>Mã</dt><dd>${pay.id}</dd><dt>Phương thức</dt><dd>${D.METHOD[pay.method]}</dd><dt>Số tiền</dt><dd>${U.money(pay.amount)}</dd></dl>` : '<div class="small muted" style="margin-top:6px">Chưa ghi nhận payment tương ứng</div>'}
        <div class="divider"></div><b class="small">3. Khoản phải thu</b>
        ${info ? `<dl class="kv" style="margin-top:6px"><dt>Mã</dt><dd>${info.inv.id}</dd><dt>Kỳ</dt><dd>${U.per(info.inv.period)}</dd><dt>Tiểu thương</dt><dd>${U.esc(info.trader.name)}</dd><dt>Điểm KD</dt><dd>${info.stall.code}</dd></dl>` : '<div class="small muted" style="margin-top:6px">Chưa xác định khoản phải thu</div>'}
        <div class="divider"></div><b class="small">4. Biên lai</b>
        <div class="small" style="margin-top:6px">${b.receiptId ? `<a href="#" data-act="receipt" data-id="${b.receiptId}">${b.receiptId}</a>` : '<span class="muted">Chưa có biên lai</span>'}</div>
        <div class="divider"></div><b class="small">5. Kết quả</b>
        <div style="margin-top:6px">${dsBankTag(b)}</div>
        <ul class="small muted" style="margin:6px 0 0 18px;padding:0">${reasons.map(r => `<li>${U.esc(r)}</li>`).join('')}</ul>
        ${b.status === 'MATCHED_MANUAL' && b.matchedBy ? `<div class="small muted" style="margin-top:6px">Gắn bởi ${U.esc(b.matchedBy)} · ${U.esc(b.matchedAt)}</div>` : ''}
        ${canAudit ? `<div class="divider"></div><b class="small">Lịch sử xử lý</b>${(b.log || []).map(l => `<div class="small" style="padding:4px 0;border-bottom:1px solid #eef2f7"><span class="muted">${U.dmy(b.date || U.today())} ${l.at}</span> · ${U.esc(l.actor)}: ${U.esc(l.text)}</div>`).join('')}` : ''}
      </div>
      <div class="drawer-f">${canMatch ? `<button class="btn primary" data-act="ds-bank-match" data-id="${b.id}">Gắn khoản thu thủ công</button>` : ''}<button class="btn" data-act="close">Đóng</button></div>`;
  }
  A.ACT['ds-bank-view'] = el => {
    const b = dsBankOf(el.dataset.id);
    if (!b) return;
    A.$('#modal-root').innerHTML = `<div class="drawer-overlay" data-act="close"></div><div class="drawer">${dsBankDrawerHtml(b)}</div>`;
  };

  function dsMatchCandidates() {
    const b = dsBankOf(ui.dsMatch.bankId);
    const q = (ui.dsMatch.q || '').toLowerCase();
    let cands = A.db.invoices.filter(i => U.inM(i) && i.status !== 'paid');
    if (q) cands = cands.filter(i => i.id.toLowerCase().includes(q) || A.idx.trader.get(i.traderId).name.toLowerCase().includes(q) || A.idx.stall.get(i.stallId).code.toLowerCase().includes(q));
    else cands = cands.slice().sort((x, y) => Math.abs(U.due(x) - b.amount) - Math.abs(U.due(y) - b.amount));
    return cands.slice(0, 8);
  }
  function renderDsMatchModal() {
    const b = dsBankOf(ui.dsMatch.bankId);
    const cands = dsMatchCandidates();
    A.modal(A.mHead('Gắn khoản thu thủ công · ' + b.id) + `<div class="modal-b">
      <p class="small">Nội dung: <b>${U.esc(b.ref)}</b> · Số tiền <b>${U.money(b.amount)}</b></p>
      <input class="input" style="margin-bottom:10px" placeholder="Tìm mã khoản phải thu, tiểu thương, điểm KD..." data-in="ds-match-search" value="${U.esc(ui.dsMatch.q || '')}">
      ${U.table([{ t: 'Khoản' }, { t: 'Tiểu thương' }, { t: 'Điểm KD' }, { t: 'Kỳ' }, { t: 'Còn phải thu', num: true }, { t: '' }],
        cands.map(i => `<tr><td>${i.id}</td><td>${U.esc(A.idx.trader.get(i.traderId).name)}</td><td>${A.idx.stall.get(i.stallId).code}</td><td>${U.per(i.period)}</td><td class="num">${U.money(U.due(i))}</td><td><button class="btn sm primary" data-act="ds-bank-match-pick" data-inv="${i.id}">Chọn</button></td></tr>`),
        { empty: 'Không tìm thấy khoản phải thu phù hợp' })}
      </div><div class="modal-f"><button class="btn" data-act="close">Hủy</button></div>`, true);
  }
  A.ACT['ds-bank-match'] = el => {
    if (!dsCanBankMatch()) return;
    ui.dsMatch = { bankId: el.dataset.id, q: '' };
    renderDsMatchModal();
  };
  A.IN['ds-match-search'] = el => { ui.dsMatch.q = el.value; renderDsMatchModal(); };
  A.ACT['ds-bank-match-pick'] = el => {
    const b = dsBankOf(ui.dsMatch.bankId), inv = A.idx.invoice.get(el.dataset.inv);
    A.modal(A.mHead('Xác nhận gắn giao dịch') + `<div class="modal-b">
      <p>Gắn giao dịch <b>${b.id}</b> với khoản phải thu <b>${inv.id}</b> (${U.esc(A.idx.trader.get(inv.traderId).name)})?</p>
      <div class="note info">Thao tác này chỉ cập nhật trạng thái đối soát trên màn này, không thay đổi khoản phải thu hay tạo thanh toán mới.</div>
      </div><div class="modal-f"><button class="btn" data-act="ds-bank-match-back">Hủy</button><button class="btn primary" data-act="ds-bank-match-confirm" data-inv="${inv.id}">Xác nhận</button></div>`);
  };
  A.ACT['ds-bank-match-back'] = () => renderDsMatchModal();
  A.ACT['ds-bank-match-confirm'] = el => {
    if (!dsCanBankMatch() || !ui.dsMatch) { A.closeModal(); return; }
    const b = dsBankOf(ui.dsMatch.bankId), inv = A.idx.invoice.get(el.dataset.inv);
    const actor = dsActor(), at = dsNowStamp();
    b.status = 'MATCHED_MANUAL'; b.matched = true; b.receivableId = inv.id;
    b.matchedBy = actor; b.matchedAt = at; b.matchMethod = 'MANUAL';
    b.log = b.log || [];
    b.log.push({ at: U.nowTime(), actor, text: 'Gắn thủ công với khoản phải thu ' + inv.id });
    ui.dsMatch = null;
    U.log(`Gắn thủ công giao dịch đối soát ${b.id} với khoản ${inv.id}`);
    A.save(); A.closeModal(); A.render();
    U.toast('Đã gắn ' + b.id + ' với ' + inv.id);
  };

  // ---- Tiền mặt ----
  function dsCashRows() {
    const today = U.today();
    const cash = A.db.payments.filter(p => U.inM(p) && p.date === today && p.method === 'tm');
    const byEmp = {};
    cash.forEach(p => { (byEmp[p.by] = byEmp[p.by] || []).push(p); });
    return Object.keys(byEmp).map(employeeId => {
      const list = byEmp[employeeId];
      const collected = U.sum(list, p => p.amount);
      const deposits = A.db.cashDeposits.filter(d => d.employeeId === employeeId && d.date === today);
      const deposited = U.sum(deposits, d => d.amount);
      const confirm = A.db.cashConfirms.find(c => c.employeeId === employeeId && c.date === today);
      return { employeeId, market: list[0].market, payments: list, collected, deposits, deposited, remaining: collected - deposited, confirm };
    }).sort((a, b) => b.collected - a.collected);
  }
  function dsCashStatusOf(e) {
    if (e.remaining === 0) return { id: 'RECONCILED', label: 'Đã đối soát', cls: 'ok', ico: '✓' };
    if (e.deposited === 0 && e.collected > 0) return { id: 'WAITING_DEPOSIT', label: 'Chờ nộp', cls: '', ico: '●' };
    if (e.deposited > 0 && e.deposited < e.collected) return { id: 'PARTIAL_DEPOSIT', label: 'Chưa nộp đủ', cls: 'warn', ico: '●' };
    return { id: 'OVER_DEPOSIT', label: 'Có chênh lệch', cls: 'danger', ico: '⚠' };
  }
  function dsCashView() {
    const rows = dsCashRows();
    const totalReceipts = U.sum(rows, e => e.payments.length);
    const totalCollected = U.sum(rows, e => e.collected);
    const totalDeposited = U.sum(rows, e => e.deposited);
    const totalRemaining = totalCollected - totalDeposited;
    const notDone = rows.filter(e => dsCashStatusOf(e).id !== 'RECONCILED').length;
    return `<div class="kpis">
      <div class="card kpi"><div class="k-label">Tổng biên lai tiền mặt</div><div class="k-value">${totalReceipts}</div><div class="k-sub">${U.money(totalCollected)}</div></div>
      <div class="card kpi"><div class="k-label">Đã nộp quỹ</div><div class="k-value">${U.money(totalDeposited)}</div></div>
      <div class="card kpi"><div class="k-label">Còn phải nộp</div><div class="k-value" style="color:${totalRemaining ? '#df2225' : '#20a04e'}">${U.money(totalRemaining)}</div></div>
      <div class="card kpi"><div class="k-label">Nhân viên chưa hoàn tất</div><div class="k-value" style="color:${notDone ? '#df2225' : '#20a04e'}">${notDone}</div></div></div>
    <div class="card"><div class="card-h"><h3>Đối soát tiền mặt theo nhân viên thu · ${U.dmy(U.today())}</h3><button class="btn" data-act="ds-cash-csv">⬇ Xuất Excel</button></div>
      <div class="card-b">${U.table([{ t: 'Nhân viên thu' }, { t: 'Số biên lai', num: true }, { t: 'Tổng tiền đã thu', num: true }, { t: 'Đã nộp quỹ', num: true }, { t: 'Còn phải nộp / Chênh lệch', num: true }, { t: 'Trạng thái' }, { t: '' }],
        rows.map(e => {
          const s = dsCashStatusOf(e);
          return `<tr><td>${U.esc(U.staffName(e.employeeId))}</td><td class="num">${e.payments.length}</td><td class="num">${U.money(e.collected)}</td><td class="num">${U.money(e.deposited)}</td>
            <td class="num" style="${e.remaining ? 'color:#df2225;font-weight:600' : ''}">${U.money(Math.abs(e.remaining))}</td><td><span class="tag ${s.cls}">${s.ico} ${s.label}</span></td>
            <td><button class="btn sm" data-act="ds-cash-view" data-id="${e.employeeId}">Xem chi tiết</button></td></tr>`;
        }), { empty: 'Hôm nay chưa thu tiền mặt' })}</div></div>`;
  }
  A.ACT['ds-cash-csv'] = () => {
    const rows = dsCashRows();
    U.csv('doi-soat-tien-mat-' + U.today(), ['Nhân viên', 'Số biên lai', 'Đã thu', 'Đã nộp quỹ', 'Còn phải nộp', 'Trạng thái'],
      rows.map(e => [U.staffName(e.employeeId), e.payments.length, e.collected, e.deposited, e.remaining, dsCashStatusOf(e).label]));
  };

  function dsCashAuditHtml(e) {
    const items = [];
    e.payments.forEach(p => items.push({ at: p.time, text: 'Ghi nhận biên lai ' + p.receipt + ' (' + U.money(p.amount) + ')' }));
    e.deposits.forEach(d => items.push({ at: d.depositedAt.slice(-5), text: U.esc(U.staffName(d.employeeId)) + ' nộp quỹ ' + d.id + ' (' + U.money(d.amount) + ') cho ' + U.esc(U.staffName(d.receivedBy)) }));
    if (e.confirm) items.push({ at: e.confirm.confirmedAt.slice(-5), text: U.esc(e.confirm.confirmedBy) + ' xác nhận đối soát hoàn tất' });
    items.sort((a, b) => a.at.localeCompare(b.at));
    return items.length ? items.map(i => `<div class="small" style="padding:4px 0;border-bottom:1px solid #eef2f7"><span class="muted">${U.dmy(U.today())} ${i.at}</span> · ${i.text}</div>`).join('') : '<div class="small muted">Chưa có lịch sử</div>';
  }
  function dsCashDrawerHtml(employeeId) {
    const e = dsCashRows().find(x => x.employeeId === employeeId);
    if (!e) return '';
    const s = dsCashStatusOf(e);
    const canConfirm = dsCanCashConfirm() && s.id === 'RECONCILED' && !e.confirm;
    const canAudit = dsCanAudit();
    const receiptRows = e.payments.map(p => {
      const inv = A.idx.invoice.get(p.invoiceId);
      return `<div class="row small" style="padding:5px 0;border-bottom:1px solid #eef2f7"><span>${p.receipt}</span><span>${inv ? A.idx.stall.get(inv.stallId).code : ''}</span><span class="spacer"></span><b>${U.money(p.amount)}</b></div>`;
    }).join('');
    const depositRows = e.deposits.length ? e.deposits.map(d => `<div style="padding:8px 0;border-bottom:1px solid #eef2f7">
        <div class="row small"><b>${d.id}</b><span class="spacer"></span><b>${U.money(d.amount)}</b></div>
        <div class="small muted">${d.depositedAt}</div>
        <div class="small">Người nộp: ${U.esc(U.staffName(d.employeeId))} · Người nhận: ${U.esc(U.staffName(d.receivedBy))}</div>
        ${d.attachment ? `<button class="btn sm" style="margin-top:4px" data-act="ds-cash-att" data-id="${d.id}">📎 Xem chứng từ</button>` : ''}
      </div>`).join('') : '<div class="small muted">Chưa có lần nộp quỹ nào</div>';
    return `<div class="drawer-h"><div><h3>Đối soát tiền mặt · ${U.esc(U.staffName(e.employeeId))}</h3><div class="small muted">${U.mShort(e.market)} · ${U.dmy(U.today())}</div></div><span class="spacer"></span><button class="x" data-act="close" aria-label="Đóng">×</button></div>
      <div class="drawer-b">
        <b class="small">Biên lai tiền mặt</b><div style="margin-top:6px">${receiptRows}</div>
        <div class="row" style="margin-top:6px"><b>Tổng theo biên lai</b><span class="spacer"></span><b>${U.money(e.collected)}</b></div>
        <div class="divider"></div><b class="small">Lịch sử nộp quỹ</b><div style="margin-top:6px">${depositRows}</div>
        <div class="divider"></div><b class="small">Kết quả</b>
        <dl class="kv" style="margin-top:6px"><dt>Phải nộp</dt><dd>${U.money(e.collected)}</dd><dt>Đã nộp</dt><dd>${U.money(e.deposited)}</dd>
          <dt>${e.remaining >= 0 ? 'Còn phải nộp' : 'Nộp dư'}</dt><dd>${U.money(Math.abs(e.remaining))}</dd></dl>
        <div style="margin-top:4px"><span class="tag ${s.cls}">${s.ico} ${s.label}</span></div>
        ${e.confirm ? `<div class="small muted" style="margin-top:6px">Đã xác nhận bởi ${U.esc(e.confirm.confirmedBy)} · ${U.esc(e.confirm.confirmedAt)}</div>` : ''}
        ${canAudit ? `<div class="divider"></div><b class="small">Lịch sử xử lý</b>${dsCashAuditHtml(e)}` : ''}
      </div>
      <div class="drawer-f">${canConfirm ? `<button class="btn primary" data-act="ds-cash-confirm" data-id="${e.employeeId}">Xác nhận đối soát</button>` : ''}<button class="btn" data-act="close">Đóng</button></div>`;
  }
  A.ACT['ds-cash-view'] = el => {
    A.$('#modal-root').innerHTML = `<div class="drawer-overlay" data-act="close"></div><div class="drawer">${dsCashDrawerHtml(el.dataset.id)}</div>`;
  };
  A.ACT['ds-cash-att'] = el => {
    const d = A.db.cashDeposits.find(x => x.id === el.dataset.id);
    if (!d || !d.attachment) return;
    A.modal(A.mHead('Chứng từ nộp quỹ ' + d.id) + `<div class="modal-b" style="text-align:center">
      <div class="empty" style="padding:40px 16px">📄<br>${U.esc(d.attachment.name)}<div class="small muted" style="margin-top:6px">Chứng từ minh họa (dữ liệu mẫu) · ${U.esc(d.attachment.type)}</div></div>
      </div><div class="modal-f"><button class="btn primary" data-act="close">Đóng</button></div>`);
  };
  A.ACT['ds-cash-confirm'] = el => {
    if (!dsCanCashConfirm()) return;
    const employeeId = el.dataset.id;
    const e0 = dsCashRows().find(x => x.employeeId === employeeId);
    if (!e0 || dsCashStatusOf(e0).id !== 'RECONCILED' || e0.confirm) return;
    A.db.cashConfirms.push({ employeeId, market: e0.market, date: U.today(), confirmedBy: dsActor(), confirmedAt: dsNowStamp() });
    U.log('Xác nhận đối soát tiền mặt cho ' + U.staffName(employeeId) + ' ngày ' + U.dmy(U.today()));
    A.save(); A.render();
    A.$('#modal-root').innerHTML = `<div class="drawer-overlay" data-act="close"></div><div class="drawer">${dsCashDrawerHtml(employeeId)}</div>`;
    U.toast('Đã xác nhận đối soát tiền mặt cho ' + U.staffName(employeeId));
  };

  // ---------- Công nợ ----------
  A.VIEWS['cong-no'] = function () {
    const asOf = f.cnAsOf || U.today();
    const origin = f.cnOrigin || 'all';
    const cnIsOver = i => i.status !== 'paid' && i.due < asOf;
    const cnOverDays = i => Math.max(0, U.days(i.due, asOf));
    const over = A.db.invoices.filter(i => U.inM(i) && (origin === 'all' || i.period === origin) && cnIsOver(i));
    const buckets = [['1–30 ngày', 1, 30], ['31–60 ngày', 31, 60], ['61–90 ngày', 61, 90], ['Trên 90 ngày', 91, 9999]].map(b => {
      const xs = over.filter(i => cnOverDays(i) >= b[1] && cnOverDays(i) <= b[2]);
      return { label: b[0], amt: U.sum(xs, U.due), n: new Set(xs.map(i => i.traderId)).size };
    });
    const maxAmt = Math.max.apply(null, buckets.map(b => b.amt).concat([1]));
    const map = new Map();
    over.forEach(i => { const d = map.get(i.traderId) || { n: 0, amt: 0, days: 0, rem: 0 }; d.n++; d.amt += U.due(i); d.days = Math.max(d.days, cnOverDays(i)); d.rem += i.reminders || 0; map.set(i.traderId, d); });
    const list = Array.from(map.entries()).map(([id, d]) => Object.assign({ t: A.idx.trader.get(id) }, d)).sort((a, b) => b.days - a.days || b.amt - a.amt);
    const pg = U.pager('cn', list.length, 20);
    const timeBar = `<div class="card"><div class="card-b row" style="padding-top:14px;flex-wrap:wrap">
      <span class="label-sm">Công nợ tính đến</span><input type="date" class="input" style="width:150px" data-ch="cn-asof" value="${asOf}">
      <span class="label-sm" style="margin-left:10px">Kỳ phát sinh</span>
      <select class="input" style="width:130px" data-ch="cn-origin">
        <option value="all" ${origin === 'all' ? 'selected' : ''}>Tất cả</option>
        ${A.db.issuedPeriods.slice().reverse().map(p => `<option value="${p}" ${origin === p ? 'selected' : ''}>${U.per(p)}</option>`).join('')}
      </select></div></div>`;
    const canRemindAll = A.canDo('cong-no.nhac-no-hang-loat', ui.market);
    return timeBar + `<div class="grid g2">
      <div class="card"><div class="card-h"><h3>Phân loại nợ theo số ngày quá hạn</h3></div><div class="card-b">
        ${buckets.map(b => `<div style="margin:10px 0"><div class="row small"><b style="width:100px">${b.label}</b><span class="muted">${b.n} tiểu thương</span><span class="spacer"></span><b>${U.money(b.amt)}</b></div><div class="bar-mini" style="height:10px"><i style="width:${b.amt * 100 / maxAmt}%;background:#df2225"></i></div></div>`).join('')}
        <div class="divider"></div><div class="row"><b>Tổng nợ quá hạn</b><span class="spacer"></span><b style="color:#df2225;font-size:var(--font-size-lg)">${U.money(U.sum(over, U.due))}</b></div></div></div>
      <div class="card"><div class="card-h"><h3>Lịch nhắc nợ tự động</h3></div><div class="card-b small">
        <div class="row" style="padding:6px 0"><span class="tag info">Ngày 12</span>Nhắc trước hạn 3 ngày qua Mini app, Zalo OA</div>
        <div class="row" style="padding:6px 0"><span class="tag warn">Ngày 16</span>Thông báo quá hạn lần 1</div>
        <div class="row" style="padding:6px 0"><span class="tag warn">Ngày 25</span>Nhắc lần 2 kèm mã QR thanh toán</div>
        <div class="row" style="padding:6px 0"><span class="tag danger">Quá 60 ngày</span>Chuyển danh sách cho Trưởng Ban Quản lý xử lý theo hợp đồng</div>
        <div class="muted" style="margin-top:8px">Không gửi lặp trong cùng mốc, cùng kênh. Lưu nhật ký gửi, nhận, đọc.</div></div></div></div>
    <div class="card"><div class="card-h"><h3>Danh sách tiểu thương nợ quá hạn (${list.length})</h3>${canRemindAll ? `<button class="btn accent" data-act="cn-remind-all">📣 Gửi nhắc nợ tất cả</button>` : ''}
      <button class="btn" data-act="cn-csv">⬇ Xuất Excel</button></div>
      <div class="card-b">${U.table([{ t: 'Tiểu thương' }, { t: 'Điểm KD' }, { t: 'Số kỳ nợ', num: true }, { t: 'Tổng nợ', num: true }, { t: 'Quá hạn lâu nhất', num: true }, { t: 'Đã nhắc', num: true }, { t: '' }],
        list.slice(pg.start, pg.end).map(x => `<tr><td><b>${U.esc(x.t.name)}</b> <span class="small muted">${x.t.app ? '· có mini app' : '· chưa cài app'}</span></td><td>${x.t.stalls.map(id => A.idx.stall.get(id).code).join(', ')}</td><td class="num">${x.n}</td><td class="num">${U.money(x.amt)}</td>
          <td class="num"><span class="tag ${x.days > 60 ? 'danger' : 'warn'}">${x.days} ngày</span></td><td class="num">${x.rem}</td>
          <td class="nowrap">${A.canDo('cong-no.nhac-no', x.t.market) ? `<button class="btn sm" data-act="cn-remind" data-id="${x.t.id}">Nhắc nợ</button>` : ''} ${A.canDo('thu-tien.thu', x.t.market) ? `<button class="btn sm primary" data-act="pay-open" data-id="${x.t.id}">Thu</button>` : ''}</td></tr>`), { empty: 'Không có nợ quá hạn 🎉' })}${pg.html}</div></div>`;
  };
  A.CH['cn-asof'] = el => { f.cnAsOf = el.value || U.today(); A.render(); };
  A.CH['cn-origin'] = el => { f.cnOrigin = el.value; A.render(); };
  function remind(ids) {
    let n = 0;
    A.db.invoices.filter(i => U.isOver(i) && ids.includes(i.traderId)).forEach(i => { i.reminders = (i.reminders || 0) + 1; n++; });
    return n;
  }
  A.ACT['cn-remind'] = el => {
    const t = A.idx.trader.get(el.dataset.id);
    if (!t || !A.canDo('cong-no.nhac-no', t.market)) return;
    remind([el.dataset.id]); A.save(); A.render(); U.toast('Đã gửi nhắc nợ qua Mini app, Zalo OA tới ' + t.name);
  };
  A.ACT['cn-remind-all'] = () => {
    if (!A.canDo('cong-no.nhac-no-hang-loat', ui.market)) return;
    const ids = Array.from(new Set(A.db.invoices.filter(i => U.inM(i) && U.isOver(i)).map(i => i.traderId)));
    remind(ids);
    A.db.notifications.unshift({ id: 'TB-' + U.pad(32 + A.db.notifications.length, 3), at: U.today(), title: 'Nhắc nộp phí quá hạn', group: 'Danh sách nợ phí', channels: ['Mini app', 'Zalo OA', 'SMS'], sent: ids.length, delivered: 0.95, read: 0, auto: false });
    U.log('Gửi nhắc nợ hàng loạt cho ' + ids.length + ' tiểu thương');
    A.save(); A.render(); U.toast('Đã gửi nhắc nợ tới ' + ids.length + ' tiểu thương');
  };
  A.ACT['cn-csv'] = () => {
    const rows = [];
    A.db.invoices.filter(i => U.inM(i) && U.isOver(i)).forEach(i => rows.push([A.idx.trader.get(i.traderId).name, A.idx.stall.get(i.stallId).code, i.id, U.per(i.period), U.due(i), U.overDays(i)]));
    U.csv('cong-no-qua-han', ['Tiểu thương', 'Điểm KD', 'Khoản', 'Kỳ', 'Còn nợ', 'Số ngày quá hạn'], rows);
  };
})(window.APP);

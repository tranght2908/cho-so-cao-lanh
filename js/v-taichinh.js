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
    const ico = kind === 'elec' ? U.icon('bolt') : U.icon('receipt');
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

  function receivableItemsForContract(st, c, readingPeriod) {
    const items = [];
    items.push({ name: 'Phí quầy cố định tháng/quý (' + st.area + ' m² × ' + c.unit.toLocaleString('vi-VN') + ' đ × 30 ngày)', amount: c.monthly });
    const r = A.db.readings.find(x => x.stallId === st.id && x.period === readingPeriod);
    if (r) {
      const kwh = r.elecCur != null ? r.elecCur - r.elecPrev : r.elecAvg;
      const m3 = r.waterCur != null ? r.waterCur - r.waterPrev : r.waterAvg;
      items.push({ name: 'Tiền điện (' + kwh + ' kWh × ' + D.ELEC.toLocaleString('vi-VN') + ' đ)' + (r.elecCur == null ? ' – tạm tính theo TB' : ''), amount: kwh * D.ELEC });
      items.push({ name: 'Tiền nước (' + m3 + ' m³ × ' + D.WATER.toLocaleString('vi-VN') + ' đ)' + (r.waterCur == null ? ' – tạm tính theo TB' : ''), amount: m3 * D.WATER });
    }
    if (st.market === 'TTD') {
      D.RATE_POLICY_SEED.extraServices
        .filter(x => x.status === 'active' && x.marketModel === D.RATE_MARKET_MODEL.FIXED_MONTHLY && x.marketId === st.market)
        .forEach(x => {
          const amount = x.calcMethod === 'area' ? Math.round(st.area * x.amount / 1000) * 1000 : x.amount;
          items.push({ name: x.name + ' (' + x.unit + ')', amount });
        });
    }
    return items;
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
      ${p.status === 'RECORDING' && canClose ? `<button class="btn" data-act="dn-close-period">${U.icon('file')}Chốt kỳ</button>` : ''}
      ${editable ? `<button class="btn primary" data-act="dn-save-draft">${U.icon('file')}Lưu nháp</button>` : ''}</div>
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

  // ---------- Meter Reading UI V1 -------------------------------------------------
  // Backward-compatible adapter: the stored reading remains one record per
  // `stallId + period`; this UI exposes its independent electricity/water meters.
  // PROTOTYPE_ONLY: abnormal when consumption > 150% of the seeded 3-period average.
  const MR_ABNORMAL_MULTIPLIER = 1.5;
  let mrDraft = null;
  const mrCfg = kind => kind === 'elec' ? { label: 'Điện', unit: 'kWh', prev: 'elecPrev', cur: 'elecCur', avg: 'elecAvg', photo: 'elecPhoto', code: 'CT', price: D.ELEC } : { label: 'Nước', unit: 'm³', prev: 'waterPrev', cur: 'waterCur', avg: 'waterAvg', photo: 'waterPhoto', code: 'DN', price: D.WATER };
  const mrCode = (st, kind) => mrCfg(kind).code + '-' + st.code.replace(/[^A-Za-z0-9]/g, '') + '-01';
  const mrItem = (r, kind) => { const st = A.idx.stall.get(r.stallId), cfg = mrCfg(kind); return { r, kind, cfg, st, trader: st && st.traderId ? A.idx.trader.get(st.traderId) : null, meterId: st ? mrCode(st, kind) : '', previous: r[cfg.prev], current: r[cfg.cur] }; };
  const mrConsumption = item => item.current == null || item.previous == null ? null : item.current - item.previous;
  const mrAbnormal = item => { const v = mrConsumption(item), avg = item.r[item.cfg.avg]; return v != null && avg > 0 && v > avg * MR_ABNORMAL_MULTIPLIER; };
  const mrStatus = item => item.current == null ? 'PENDING' : mrAbnormal(item) ? 'ABNORMAL' : 'RECORDED';
  const mrItems = period => A.db.readings.filter(r => r.period === period && U.inM(A.idx.stall.get(r.stallId))).flatMap(r => ['elec', 'water'].map(k => mrItem(r, k)));
  const mrPhoto = item => item.r[item.cfg.photo];
  const mrPreviousHistory = item => A.db.readings.filter(r => r.stallId === item.r.stallId && r.period < item.r.period && r[item.cfg.cur] != null).sort((a, b) => b.period.localeCompare(a.period))[0] || null;
  function mrOpen(item) {
    const prior = mrPreviousHistory(item), evidence = mrDraft && mrDraft.meterId === item.meterId && mrDraft.period === item.r.period ? mrDraft.evidence : mrPhoto(item);
    mrDraft = { meterId: item.meterId, period: item.r.period, stallId: item.r.stallId, kind: item.kind, current: item.current, evidence: evidence || null };
    const p = A.db.meterPeriods.find(x => x.id === item.r.period), prevRead = prior ? prior[item.cfg.cur] : item.previous, prevDate = prior ? prior.recordedAt : null, diff = mrDraft.current == null || prevRead == null ? null : Number(mrDraft.current) - Number(prevRead), invalid = diff != null && diff < 0;
    A.modal(A.mHead((item.current == null ? 'Ghi chỉ số ' : 'Chi tiết chỉ số ') + item.cfg.label + ' · ' + item.st.code) + `<div class="modal-b meter-modal"><section class="meter-section"><h4>A. THÔNG TIN ĐIỂM KINH DOANH</h4><dl class="kv"><dt>Điểm KD</dt><dd><b>${item.st.code}</b></dd><dt>Tiểu thương</dt><dd>${item.trader ? U.esc(item.trader.name) + ' · ' + item.trader.id : 'Chưa có'}</dd><dt>Khu vực</dt><dd>${U.esc(item.st.sectionName)}</dd><dt>Kỳ ghi số</dt><dd>Tháng ${U.per(item.r.period)}</dd></dl></section><section class="meter-section"><h4>B. THÔNG TIN ĐỒNG HỒ</h4><dl class="kv"><dt>Loại</dt><dd>${item.cfg.label}</dd><dt>Mã đồng hồ</dt><dd><b>${item.meterId}</b></dd><dt>Đơn vị</dt><dd>${item.cfg.unit}</dd></dl></section><section class="meter-section"><h4>C. CHỈ SỐ KỲ TRƯỚC</h4><dl class="kv"><dt>Kỳ</dt><dd>${prior ? 'Tháng ' + U.per(prior.period) : 'Chưa có kỳ trước'}</dd><dt>Ngày ghi</dt><dd>${prevDate || '—'}</dd><dt>Chỉ số cũ</dt><dd><b>${prevRead == null ? 'Chưa có chỉ số kỳ trước' : Number(prevRead).toLocaleString('vi-VN') + ' ' + item.cfg.unit}</b></dd><dt>Ảnh kỳ trước</dt><dd>${prior && prior[item.cfg.photo] ? '<span class="tag ok">Có ảnh</span>' : '—'}</dd></dl></section><section class="meter-section"><h4>D. CHỈ SỐ KỲ NÀY</h4><div class="form-grid"><div class="field"><label>Ngày ghi</label><input class="input" value="${U.today()}" disabled></div><div class="field"><label>Chỉ số mới *</label><input class="input" id="mr-current" type="number" min="0" value="${mrDraft.current == null ? '' : mrDraft.current}" ${p.status !== 'RECORDING' || !A.canDo('dien-nuoc.ghi-chi-so', item.st.market) ? 'disabled' : ''}></div></div><div class="meter-consumption ${invalid ? 'danger' : ''}">${invalid ? 'Chỉ số mới nhỏ hơn chỉ số kỳ trước. Vui lòng kiểm tra lại số ghi hoặc đồng hồ.' : diff == null ? 'Nhập chỉ số mới để hệ thống tính sản lượng tiêu thụ.' : `${Number(mrDraft.current).toLocaleString('vi-VN')} − ${Number(prevRead).toLocaleString('vi-VN')} = <b>${diff.toLocaleString('vi-VN')} ${item.cfg.unit}</b>`}</div></section><section class="meter-section"><h4>E. ẢNH ĐỒNG HỒ</h4>${mrDraft.evidence ? `<div class="meter-evidence">${U.icon('file')}<span><b>${U.esc(mrDraft.evidence.name)}</b><small>${mrDraft.evidence.addedAt || nowStamp()} · metadata mock</small></span><button class="btn sm" data-act="mr-evidence-view">Xem</button><button class="btn sm danger" data-act="mr-evidence-remove">Xóa</button></div>` : '<div class="note">Chưa có ảnh minh chứng. Ảnh không bắt buộc trong Prototype V1.</div>'}${p.status === 'RECORDING' && A.canDo('dien-nuoc.ghi-chi-so', item.st.market) ? '<button class="btn sm" style="margin-top:8px" data-act="mr-evidence-add">+ Chụp / thêm ảnh</button>' : ''}</section><section class="meter-section"><h4>F. GHI CHÚ</h4><textarea class="input" id="mr-note" rows="2" placeholder="Đồng hồ khó đọc, tiểu thương vắng mặt..."></textarea></section></div><div class="modal-f"><button class="btn" data-act="close">Hủy</button>${p.status === 'RECORDING' && A.canDo('dien-nuoc.ghi-chi-so', item.st.market) ? `<button class="btn primary" data-act="mr-save" data-id="${item.st.id}" data-period="${item.r.period}" data-kind="${item.kind}">Lưu chỉ số</button>` : ''}</div>`, true);
  }
  A.VIEWS['dien-nuoc'] = function () {
    const p = currentPeriod(), all = mrItems(p.id), type = f.mrType || 'all', state = f.mrStatus || 'all', q = (f.mrSearch || '').toLowerCase();
    const filtered = all.filter(x => (type === 'all' || x.kind === type) && (state === 'all' || mrStatus(x) === state) && (!q || [x.st.code, x.trader && x.trader.name, x.trader && x.trader.id, x.meterId].join(' ').toLowerCase().includes(q)));
    const total = all.length, done = all.filter(x => x.current != null).length, todo = total - done, bad = all.filter(mrAbnormal).length, pg = U.pager('mr' + p.id + type + state, filtered.length, 20);
    const card = (label, value, filter, danger) => `<button class="card kpi" data-act="mr-status" data-id="${filter}" style="text-align:left"><div class="k-label">${label}</div><div class="k-value" ${danger ? 'style="color:#df2225"' : ''}>${value}</div></button>`;
    return `<div class="card meter-title"><div class="card-b"><h2>GHI CHỈ SỐ ĐIỆN, NƯỚC</h2><p>Theo dõi và ghi nhận chỉ số điện, nước theo từng kỳ, kèm ảnh đồng hồ và cảnh báo tiêu thụ bất thường.</p></div></div>${periodHeaderHtml(p)}<div class="kpis">${card('Tổng cần ghi', total, 'all')}${card('Đã ghi', done, 'RECORDED')}${card('Chưa ghi', todo, 'PENDING', true)}${card('Bất thường', bad, 'ABNORMAL', true)}</div><div class="card"><div class="card-h"><div class="seg">${[['all','Tất cả'],['PENDING','Chưa ghi'],['RECORDED','Đã ghi'],['ABNORMAL','Bất thường']].map(x=>`<button class="${state===x[0]?'on':''}" data-act="mr-status" data-id="${x[0]}">${x[1]}</button>`).join('')}</div><select class="input meter-type-filter" data-ch="mr-type"><option value="all" ${type==='all'?'selected':''}>Tất cả loại</option><option value="elec" ${type==='elec'?'selected':''}>Điện</option><option value="water" ${type==='water'?'selected':''}>Nước</option></select><input class="input meter-search" data-in="mr-search" placeholder="Tìm mã điểm, tiểu thương, mã đồng hồ..." value="${U.esc(f.mrSearch||'')}"><span class="spacer"></span>${p.status==='RECORDING'&&A.canDo('dien-nuoc.chot-ky',ui.market)?'<button class="btn" data-act="dn-close-period">Chốt kỳ</button>':''}</div><div class="card-b">${U.table([{t:'Điểm KD'},{t:'Tiểu thương'},{t:'Loại'},{t:'Mã đồng hồ'},{t:'Chỉ số kỳ trước',num:true},{t:'Chỉ số kỳ này',num:true},{t:'Tiêu thụ',num:true},{t:'Ảnh'},{t:'Cảnh báo'},{t:'Trạng thái'},{t:'Thao tác'}],filtered.slice(pg.start,pg.end).map(x=>{const c=mrConsumption(x),s=mrStatus(x),photo=mrPhoto(x);return `<tr><td><b>${x.st.code}</b></td><td>${x.trader?U.esc(x.trader.name)+'<div class="small muted">'+x.trader.id+'</div>':'—'}</td><td>${x.cfg.label}</td><td class="small">${x.meterId}</td><td class="num">${x.previous==null?'—':Number(x.previous).toLocaleString('vi-VN')}</td><td class="num">${x.current==null?'—':Number(x.current).toLocaleString('vi-VN')}</td><td class="num">${c==null?'—':c.toLocaleString('vi-VN')+' '+x.cfg.unit}</td><td>${photo?'<span class="tag ok">Có ảnh</span>':'<span class="muted">—</span>'}</td><td>${mrAbnormal(x)?'<span class="tag warn">⚠ Bất thường</span>':'<span class="muted">—</span>'}</td><td>${s==='PENDING'?'<span class="tag">Chưa ghi</span>':s==='ABNORMAL'?'<span class="tag warn">Cần kiểm tra</span>':'<span class="tag ok">Đã ghi</span>'}</td><td><button class="btn sm ${s==='PENDING'?'primary':''}" data-act="mr-open" data-id="${x.st.id}" data-period="${x.r.period}" data-kind="${x.kind}">${s==='PENDING'?'Ghi số':'Xem'}</button></td></tr>`;}))}${pg.html}<div class="small muted" style="margin-top:8px">Sản lượng = chỉ số mới − chỉ số cũ. Màn này không tạo khoản phải thu.</div></div></div>`;
  };
  A.CH['mr-type'] = el => { f.mrType = el.value; ui.page = ui.page || {}; A.render(); };
  A.IN['mr-search'] = el => { f.mrSearch = el.value; A.render(); };
  A.ACT['mr-status'] = el => { f.mrStatus = el.dataset.id; A.render(); };
  A.ACT['mr-open'] = el => { const r = findReading(el.dataset.id, el.dataset.period); if (r) mrOpen(mrItem(r, el.dataset.kind)); };
  A.ACT['mr-evidence-add'] = () => { const input = document.createElement('input'); input.type = 'file'; input.accept = 'image/*,.pdf'; input.style.display = 'none'; document.body.appendChild(input); input.onchange = () => { if (input.files[0] && mrDraft) mrDraft.evidence = { name: input.files[0].name, type: input.files[0].type, size: input.files[0].size, addedAt: nowStamp(), mock: true }; input.remove(); const r=findReading(mrDraft.stallId,mrDraft.period); mrOpen(mrItem(r,mrDraft.kind)); }; input.click(); };
  A.ACT['mr-evidence-remove'] = () => { if (!mrDraft) return; mrDraft.evidence = null; const r=findReading(mrDraft.stallId,mrDraft.period); mrOpen(mrItem(r,mrDraft.kind)); };
  A.ACT['mr-evidence-view'] = () => { if (mrDraft && mrDraft.evidence) A.modal(A.mHead('Ảnh đồng hồ') + `<div class="modal-b"><div class="empty">${U.icon('file')}<br>${U.esc(mrDraft.evidence.name)}<div class="small muted">Ảnh/file metadata mock — không có storage thật.</div></div></div><div class="modal-f"><button class="btn" data-act="close">Đóng</button></div>`); };
  A.ACT['mr-save'] = el => { const r=findReading(el.dataset.id,el.dataset.period), p=A.db.meterPeriods.find(x=>x.id===el.dataset.period), item=r&&mrItem(r,el.dataset.kind), input=A.$('#mr-current'); if(!r||!p||!item||!input||p.status!=='RECORDING'||!A.canDo('dien-nuoc.ghi-chi-so',item.st.market))return; const current=input.value===''?null:Number(input.value); if(current==null||!Number.isFinite(current))return U.toast('Vui lòng nhập chỉ số mới.'); if(item.previous!=null&&current<item.previous)return U.toast('Chỉ số mới nhỏ hơn chỉ số kỳ trước. Cần xác nhận quy trình reset/thay đồng hồ.'); r[item.cfg.cur]=current; r[item.cfg.photo]=mrDraft&&mrDraft.evidence?mrDraft.evidence:r[item.cfg.photo]; r.note=A.$('#mr-note').value.trim(); r.recordedBy='NV05'; r.recordedAt=nowStamp(); r.status=r.elecCur!=null&&r.waterCur!=null?'RECORDED':'PENDING'; A.save(); A.closeModal(); A.render(); if(mrAbnormal(mrItem(r,item.kind)))U.toast('⚠ Tiêu thụ bất thường — vui lòng kiểm tra chỉ số và ảnh đồng hồ.'); else U.toast('Đã lưu chỉ số '+item.cfg.label+' cho '+item.st.code); };
  // Meter Reading UI V2 — group the two independent meters by business point
  // only at render time. Persisted records and downstream finance fields stay unchanged.
  const mrPreviewKey = item => 'mr-preview|' + item.meterId + '|' + item.r.period;
  const mrPointState = group => {
    const e = group.elec, w = group.water;
    if (mrAbnormal(e) || mrAbnormal(w)) return 'ABNORMAL';
    if (e.current == null && w.current == null) return 'PENDING';
    if (e.current == null) return 'MISSING_ELEC';
    if (w.current == null) return 'MISSING_WATER';
    return 'RECORDED';
  };
  const mrPointLabel = state => state === 'ABNORMAL' ? '<span class="tag warn">Cần kiểm tra</span>' : state === 'PENDING' ? '<span class="tag">Chưa ghi</span>' : state === 'MISSING_ELEC' ? '<span class="tag warn">Thiếu điện</span>' : state === 'MISSING_WATER' ? '<span class="tag warn">Thiếu nước</span>' : '<span class="tag ok">Đã ghi đủ</span>';
  const mrValueCell = item => item.current == null ? '<span class="muted">—</span><div class="small muted">Chưa ghi</div>' : `<b>${Number(item.current).toLocaleString('vi-VN')} ${item.cfg.unit}</b><div class="small ${mrPhoto(item) ? 'ok' : 'muted'}">${mrPhoto(item) ? '📷 Có ảnh' : 'Chưa có ảnh'}</div>`;
  function mrOpenV2(item) {
    const prior = mrPreviousHistory(item), previous = prior ? prior[item.cfg.cur] : item.previous, key = mrPreviewKey(item), old = mrDraft && mrDraft.meterId === item.meterId && mrDraft.period === item.r.period ? mrDraft : null;
    mrDraft = { meterId: item.meterId, period: item.r.period, stallId: item.st.id, kind: item.kind, current: old ? old.current : item.current, evidence: old ? old.evidence : mrPhoto(item), preview: old ? old.preview : PHOTO_URLS[key] || null };
    const p=A.db.meterPeriods.find(x=>x.id===item.r.period), diff=mrDraft.current==null||previous==null?null:Number(mrDraft.current)-Number(previous), invalid=diff!=null&&diff<0, abnormalNow=diff!=null&&item.r[item.cfg.avg]>0&&diff>item.r[item.cfg.avg]*MR_ABNORMAL_MULTIPLIER;
    const preview = mrDraft.preview ? `<img class="mr-image-preview" src="${mrDraft.preview}" alt="Xem trước ảnh đồng hồ">` : mrDraft.evidence ? `<div class="mr-image-placeholder">${U.icon('file')}<b>${U.esc(mrDraft.evidence.name)}</b><small>Metadata mock · preview chỉ có trong phiên Web</small></div>` : '<div class="mr-image-placeholder">Chưa chọn ảnh đồng hồ</div>';
    A.modal(A.mHead('GHI CHỈ SỐ ' + item.cfg.label.toUpperCase() + ' · ' + item.st.code) + `<div class="modal-b mr-v2-modal"><div class="small muted" style="margin-top:-5px">${item.trader?U.esc(item.trader.name)+' · '+item.trader.id:'Chưa có tiểu thương'} · Kỳ ${U.per(item.r.period)}</div><section class="meter-section"><h4>A. THÔNG TIN</h4><dl class="kv"><dt>Điểm KD</dt><dd><b>${item.st.code}</b></dd><dt>Tiểu thương</dt><dd>${item.trader?U.esc(item.trader.name)+' · '+item.trader.id:'—'}</dd><dt>Mã ${item.kind==='elec'?'công tơ':'đồng hồ'}</dt><dd><b>${item.meterId}</b></dd><dt>Kỳ ghi số</dt><dd>Tháng ${U.per(item.r.period)}</dd></dl></section><section class="meter-section"><h4>B. CHỈ SỐ KỲ TRƯỚC</h4><dl class="kv"><dt>Chỉ số kỳ trước</dt><dd><b>${previous==null?'Chưa có chỉ số kỳ trước':Number(previous).toLocaleString('vi-VN')+' '+item.cfg.unit}</b></dd><dt>Ngày ghi</dt><dd>${prior?prior.recordedAt||'—':'—'}</dd><dt>Ảnh kỳ trước</dt><dd>${prior&&prior[item.cfg.photo]?'<span class="tag ok">Có ảnh</span>':'—'}</dd></dl></section><section class="meter-section"><h4>C. CHỈ SỐ KỲ NÀY</h4><div class="form-grid"><div class="field"><label>Chỉ số mới *</label><input id="mr-current" class="input" type="number" min="0" value="${mrDraft.current==null?'':mrDraft.current}" ${p.status!=='RECORDING'||!A.canDo('dien-nuoc.ghi-chi-so',item.st.market)?'disabled':''}></div><div class="field"><label>Sản lượng tiêu thụ</label><input class="input" disabled value="${diff==null?'Tự tính sau khi nhập':diff+' '+item.cfg.unit}"></div></div><div class="meter-consumption ${invalid?'danger':''}">${invalid?'Chỉ số mới nhỏ hơn chỉ số kỳ trước. Vui lòng kiểm tra lại chỉ số hoặc đồng hồ.':diff===0?'Không phát sinh tiêu thụ trong kỳ.':diff==null?'Sản lượng = chỉ số mới − chỉ số kỳ trước.':`${Number(mrDraft.current).toLocaleString('vi-VN')} − ${Number(previous).toLocaleString('vi-VN')} = <b>${diff.toLocaleString('vi-VN')} ${item.cfg.unit}</b>`}</div>${abnormalNow?'<div class="note" style="margin-top:8px">⚠ Mức tiêu thụ kỳ này có dấu hiệu bất thường so với mức trung bình. Vui lòng kiểm tra chỉ số và ảnh đồng hồ.</div>':''}</section><section class="meter-section"><h4>D. ẢNH ĐỒNG HỒ</h4>${preview}<div class="row" style="margin-top:8px">${p.status==='RECORDING'&&A.canDo('dien-nuoc.ghi-chi-so',item.st.market)?`<button class="btn sm" data-act="mr-evidence-add">${mrDraft.evidence?'Thay ảnh':'Chọn ảnh từ thiết bị'}</button>`:''}${mrDraft.evidence?'<button class="btn sm danger" data-act="mr-evidence-remove">Xóa ảnh</button>':''}</div></section><section class="meter-section"><h4>E. GHI CHÚ</h4><textarea id="mr-note" class="input" rows="2" placeholder="Đồng hồ khó đọc, tiểu thương vắng mặt..."></textarea></section></div><div class="modal-f"><button class="btn" data-act="close">Hủy</button>${p.status==='RECORDING'&&A.canDo('dien-nuoc.ghi-chi-so',item.st.market)?`<button class="btn primary" data-act="mr-save" data-id="${item.st.id}" data-period="${item.r.period}" data-kind="${item.kind}">Lưu chỉ số</button>`:''}</div>`,true);
  }
  mrOpen = mrOpenV2;
  document.addEventListener('input', e => {
    if (!e.target || e.target.id !== 'mr-current' || !mrDraft) return;
    const r=findReading(mrDraft.stallId,mrDraft.period), item=r&&mrItem(r,mrDraft.kind), out=document.querySelector('.mr-v2-modal .meter-consumption');
    if (!item || !out) return;
    const prior=mrPreviousHistory(item), previous=prior?prior[item.cfg.cur]:item.previous, current=e.target.value===''?null:Number(e.target.value), diff=current==null||previous==null?null:current-Number(previous);
    mrDraft.current=current;
    out.classList.toggle('danger',diff!=null&&diff<0);
    out.innerHTML=diff!=null&&diff<0?'Chỉ số mới nhỏ hơn chỉ số kỳ trước. Vui lòng kiểm tra lại chỉ số hoặc đồng hồ.':diff===0?'Không phát sinh tiêu thụ trong kỳ.':diff==null?'Sản lượng = chỉ số mới − chỉ số kỳ trước.':`${current.toLocaleString('vi-VN')} − ${Number(previous).toLocaleString('vi-VN')} = <b>${diff.toLocaleString('vi-VN')} ${item.cfg.unit}</b>`;
  });
  A.VIEWS['dien-nuoc'] = function () {
    const p=currentPeriod(), q=(f.mrSearch||'').toLowerCase(), filter=f.mrStatus||'all';
    const groups=A.db.readings.filter(r=>r.period===p.id&&U.inM(A.idx.stall.get(r.stallId))).map(r=>({r,st:A.idx.stall.get(r.stallId),elec:mrItem(r,'elec'),water:mrItem(r,'water')}));
    const match=g=>!q||[g.st.code,g.st.traderId&&A.idx.trader.get(g.st.traderId)&&A.idx.trader.get(g.st.traderId).name,g.st.traderId,mrCode(g.st,'elec'),mrCode(g.st,'water')].join(' ').toLowerCase().includes(q);
    const rows=groups.filter(g=>match(g)&&(filter==='all'||(filter==='PENDING'?(g.elec.current==null||g.water.current==null):filter==='RECORDED'?(g.elec.current!=null&&g.water.current!=null):mrPointState(g)===filter)));
    const total=groups.length, done=groups.filter(g=>g.elec.current!=null&&g.water.current!=null).length, incomplete=total-done, abnormalCount=groups.filter(g=>mrPointState(g)==='ABNORMAL').length, pg=U.pager('mrpoint'+p.id+filter,rows.length,20);
    const kpi=(title,val,status,danger)=>`<button class="card kpi" data-act="mr-status" data-id="${status}" style="text-align:left"><div class="k-label">${title}</div><div class="k-value" ${danger?'style="color:#df2225"':''}>${val}</div>${title==='Tổng điểm cần ghi'?`<div class="k-sub">${total} điểm · ${total*2} đồng hồ</div>`:''}</button>`;
    return `<div class="card meter-title"><div class="card-b"><h2>GHI CHỈ SỐ ĐIỆN, NƯỚC</h2><p>Theo dõi và ghi nhận chỉ số điện, nước theo từng kỳ, kèm ảnh đồng hồ và cảnh báo tiêu thụ bất thường.</p></div></div>${periodHeaderHtml(p)}<div class="kpis">${kpi('Tổng điểm cần ghi',total,'all')}${kpi('Đã ghi đủ',done,'RECORDED')}${kpi('Chưa ghi đủ',incomplete,'PENDING',true)}${kpi('Bất thường',abnormalCount,'ABNORMAL',true)}</div><div class="card"><div class="card-h"><div class="seg">${[['all','Tất cả'],['PENDING','Chưa ghi đủ'],['RECORDED','Đã ghi đủ'],['ABNORMAL','Bất thường']].map(x=>`<button class="${filter===x[0]?'on':''}" data-act="mr-status" data-id="${x[0]}">${x[1]}</button>`).join('')}</div><span class="spacer"></span><input class="input meter-search" data-in="mr-search" placeholder="Tìm mã điểm, tiểu thương, mã đồng hồ..." value="${U.esc(f.mrSearch||'')}">${p.status==='RECORDING'&&A.canDo('dien-nuoc.chot-ky',ui.market)?'<button class="btn" data-act="dn-close-period">Chốt kỳ</button>':''}</div><div class="card-b">${U.table([{t:'Điểm KD / Tiểu thương'},{t:'Chỉ số điện kỳ này'},{t:'Chỉ số nước kỳ này'},{t:'Cảnh báo'},{t:'Trạng thái'},{t:'Thao tác'}],rows.slice(pg.start,pg.end).map(g=>{const state=mrPointState(g),t=g.st.traderId?A.idx.trader.get(g.st.traderId):null,warning=mrAbnormal(g.elec)&&mrAbnormal(g.water)?'⚠ Điện & nước cần kiểm tra':mrAbnormal(g.elec)?'⚠ Điện bất thường':mrAbnormal(g.water)?'⚠ Nước bất thường':'—',action=state==='PENDING'?'<button class="btn sm primary" data-act="mr-point-open" data-id="'+g.st.id+'" data-period="'+p.id+'">Ghi chỉ số</button>':state==='MISSING_ELEC'?'<button class="btn sm primary" data-act="mr-open" data-id="'+g.st.id+'" data-period="'+p.id+'" data-kind="elec">Ghi điện</button>':state==='MISSING_WATER'?'<button class="btn sm primary" data-act="mr-open" data-id="'+g.st.id+'" data-period="'+p.id+'" data-kind="water">Ghi nước</button>':'<button class="btn sm" data-act="mr-point-detail" data-id="'+g.st.id+'" data-period="'+p.id+'">'+(state==='ABNORMAL'?'Kiểm tra':'Xem')+'</button>';return `<tr><td><b>${g.st.code}</b><div class="small muted">${t?U.esc(t.name)+' · '+t.id:'Chưa có tiểu thương'}</div></td><td>⚡ ${mrValueCell(g.elec)}</td><td>💧 ${mrValueCell(g.water)}</td><td>${warning==='—'?'<span class="muted">—</span>':'<span class="tag warn">'+warning+'</span>'}</td><td>${mrPointLabel(state)}</td><td>${action}</td></tr>`;}))}${pg.html}<div class="small muted" style="margin-top:8px">Một điểm kinh doanh hiển thị một dòng; điện và nước vẫn là hai reading độc lập.</div></div></div>`;
  };
  A.ACT['mr-point-open']=el=>{const r=findReading(el.dataset.id,el.dataset.period);if(!r)return;const e=mrItem(r,'elec'),w=mrItem(r,'water');A.modal(A.mHead('Ghi chỉ số · '+e.st.code)+`<div class="modal-b"><p>Chọn loại đồng hồ cần ghi cho <b>${e.st.code}</b>.</p><div class="row"><button class="btn primary" data-act="mr-open" data-id="${e.st.id}" data-period="${r.period}" data-kind="elec">⚡ Ghi điện</button><button class="btn primary" data-act="mr-open" data-id="${e.st.id}" data-period="${r.period}" data-kind="water">💧 Ghi nước</button></div></div><div class="modal-f"><button class="btn" data-act="close">Đóng</button></div>`);};
  A.ACT['mr-point-detail']=el=>{const r=findReading(el.dataset.id,el.dataset.period);if(!r)return;const e=mrItem(r,'elec'),w=mrItem(r,'water'),card=x=>{const c=mrConsumption(x),his=A.db.readings.filter(y=>y.stallId===x.st.id).sort((a,b)=>b.period.localeCompare(a.period));return `<section class="meter-section"><h4>${x.kind==='elec'?'⚡ ĐIỆN':'💧 NƯỚC'}</h4><dl class="kv"><dt>Mã đồng hồ</dt><dd>${x.meterId}</dd><dt>Chỉ số kỳ trước</dt><dd>${x.previous} ${x.cfg.unit}</dd><dt>Chỉ số kỳ này</dt><dd><b>${x.current==null?'—':x.current+' '+x.cfg.unit}</b></dd><dt>Sản lượng</dt><dd>${c==null?'—':x.current+' − '+x.previous+' = '+c+' '+x.cfg.unit}</dd><dt>Cảnh báo</dt><dd>${mrAbnormal(x)?'<span class="tag warn">Bất thường</span>':'Bình thường'}</dd></dl><div class="mr-detail-preview">${PHOTO_URLS[mrPreviewKey(x)]?`<img src="${PHOTO_URLS[mrPreviewKey(x)]}">`:(mrPhoto(x)?'📷 '+U.esc(mrPhoto(x).name):'Chưa có ảnh')}</div><h4 style="margin-top:12px">LỊCH SỬ ${x.cfg.label.toUpperCase()}</h4>${U.table([{t:'Kỳ'},{t:'Chỉ số cũ'},{t:'Chỉ số mới'},{t:'Tiêu thụ'},{t:'Ảnh'}],his.map(y=>{const z=mrItem(y,x.kind),v=mrConsumption(z);return `<tr><td>${U.per(y.period)}</td><td>${z.previous}</td><td>${z.current==null?'—':z.current}</td><td>${v==null?'—':v+' '+x.cfg.unit}</td><td>${mrPhoto(z)?'📷':'—'}</td></tr>`}))}</section>`;};A.modal(A.mHead('CHI TIẾT GHI CHỈ SỐ · '+e.st.code+' · Kỳ '+U.per(r.period))+`<div class="modal-b meter-modal">${card(e)}${card(w)}</div><div class="modal-f"><button class="btn" data-act="close">Đóng</button></div>`,true);};
  A.ACT['mr-evidence-add']=()=>{if(!mrDraft)return;const item=mrItem(findReading(mrDraft.stallId,mrDraft.period),mrDraft.kind);if(!A.canDo('dien-nuoc.ghi-chi-so',item.st.market))return;const input=document.createElement('input');input.type='file';input.accept='image/*';input.style.display='none';document.body.appendChild(input);input.onchange=()=>{const file=input.files&&input.files[0];if(file){mrDraft.evidence={name:file.name,type:file.type,size:file.size,addedAt:nowStamp(),mock:true};mrDraft.preview=URL.createObjectURL(file);PHOTO_URLS[mrPreviewKey(item)]=mrDraft.preview;}input.remove();mrOpenV2(item);};input.click();};
  A.ACT['mr-evidence-remove']=()=>{if(!mrDraft)return;const item=mrItem(findReading(mrDraft.stallId,mrDraft.period),mrDraft.kind);delete PHOTO_URLS[mrPreviewKey(item)];mrDraft.evidence=null;mrDraft.preview=null;mrOpenV2(item);};
  // ---------- Khoản phải thu ----------
  function ptReqs() {
    A.db.receivableAdjustRequests = A.db.receivableAdjustRequests || [];
    return A.db.receivableAdjustRequests;
  }
  function ptCan(action, market) { return U.can('phai-thu') && A.canDo(action, market); }
  function ptPendingReq(invoiceId) { return ptReqs().find(r => r.invoiceId === invoiceId && r.status === 'PENDING'); }
  function ptReqStatusTag(s) {
    if (s === 'APPROVED') return '<span class="tag ok">Đã duyệt</span>';
    if (s === 'REJECTED') return '<span class="tag danger">Từ chối</span>';
    return '<span class="tag warn">Chờ duyệt</span>';
  }
  function ptMoneySigned(n) {
    return (n >= 0 ? '+' : '−') + U.money(Math.abs(n));
  }
  function ptReqDelta(r) {
    if (!r) return 0;
    if (typeof r.delta === 'number') return r.delta;
    return -(r.value || 0);
  }
  function ptItemKind(name) {
    const s = (name || '').toLowerCase();
    if (s.indexOf('điện') !== -1) return 'Tiền điện';
    if (s.indexOf('nước') !== -1) return 'Tiền nước';
    if (s.indexOf('phí quầy') !== -1 || s.indexOf('mặt bằng') !== -1) return 'Tiền quầy / mặt bằng';
    return 'Dịch vụ khác / khoản khác';
  }
  function ptCanRequestAdjust(i) {
    return !!i && ptCan('phai-thu.yeu-cau-dieu-chinh', i.market) && i.status !== 'paid' && !i.adjust && !ptPendingReq(i.id);
  }
  function ptCanViewAdjustReq(req) {
    return !!req && U.can('phai-thu') && req.market === ui.market;
  }
  function ptCanApproveAdjustReq(req) {
    const i = req && A.idx.invoice.get(req.invoiceId);
    return !!req && !!i && ptCan('phai-thu.mien-giam', i.market) && req.status === 'PENDING' && i.status !== 'paid' && !i.adjust && i.amount + ptReqDelta(req) >= i.paid;
  }
  function ptRequestRows(invoiceId) {
    return ptReqs().filter(r => r.market === ui.market && (!invoiceId || r.invoiceId === invoiceId)).map(r => {
      const i = A.idx.invoice.get(r.invoiceId), canApprove = ptCanApproveAdjustReq(r);
      return `<tr><td>${r.id}<div class="small muted">${r.requestedAt}</div></td><td>${r.invoiceId}<div class="small muted">${U.esc(r.itemKind || '')}</div></td><td>${U.esc(r.itemName || 'Điều chỉnh khoản phải thu')}</td><td class="num">${U.money(r.currentAmount || 0)}</td><td class="num">${U.money(r.proposedAmount || 0)}</td><td class="num">${ptMoneySigned(ptReqDelta(r))}</td><td>${U.esc(r.reason)}</td><td>${ptReqStatusTag(r.status)}</td><td class="nowrap">
        <button class="btn sm" data-act="inv-adjust-detail" data-id="${r.id}">Chi tiết</button>
        ${canApprove ? `<button class="btn sm primary" data-act="inv-adjust-approve" data-id="${r.id}">Phê duyệt</button><button class="btn sm" data-act="inv-adjust-reject" data-id="${r.id}">Từ chối</button>` : ''}
        ${i && i.adjust && r.status === 'APPROVED' ? '<span class="small muted">Đã cập nhật khoản</span>' : ''}
      </td></tr>`;
    });
  }
  function ptAdjustDetailModal(req) {
    if (!ptCanViewAdjustReq(req)) return;
    const i = A.idx.invoice.get(req.invoiceId);
    if (!i || i.market !== req.market) return;
    const t = A.idx.trader.get(i.traderId), st = A.idx.stall.get(i.stallId), delta = ptReqDelta(req);
    const canApprove = ptCanApproveAdjustReq(req);
    A.modal(A.mHead('Chi tiết yêu cầu ' + req.id) + `<div class="modal-b">
      <dl class="kv">
        <dt>Mã yêu cầu</dt><dd>${req.id}</dd>
        <dt>Trạng thái</dt><dd>${ptReqStatusTag(req.status)}</dd>
        <dt>Khoản phải thu</dt><dd>${req.invoiceId} · ${U.per(i.period)}</dd>
        <dt>Chợ / điểm KD</dt><dd>${U.mShort(req.market)} · ${st ? U.esc(st.code) : '-'}</dd>
        <dt>Tiểu thương</dt><dd>${t ? U.esc(t.name) + ' (' + t.id + ')' : '-'}</dd>
        <dt>Người gửi</dt><dd>${U.esc(req.requestedBy || '-')} · ${U.esc(req.requestedAt || '-')}</dd>
        <dt>Người xử lý</dt><dd>${req.decidedBy ? U.esc(req.decidedBy) + ' · ' + U.esc(req.decidedAt || '-') : 'Chưa xử lý'}</dd>
      </dl>
      <div class="divider"></div>
      ${U.table([{ t: 'Nội dung' }, { t: 'Giá trị' }], [
        `<tr><td>Dòng điều chỉnh</td><td>${U.esc(req.itemName || 'Điều chỉnh khoản phải thu')}</td></tr>`,
        `<tr><td>Nhóm khoản</td><td>${U.esc(req.itemKind || '-')}</td></tr>`,
        `<tr><td>Loại sai số</td><td>${U.esc(req.adjustmentType || '-')}</td></tr>`,
        `<tr><td>Số tiền hiện tại</td><td>${U.money(req.currentAmount || 0)}</td></tr>`,
        `<tr><td>Số tiền đề nghị</td><td>${U.money(req.proposedAmount || 0)}</td></tr>`,
        `<tr><td>Chênh lệch</td><td>${ptMoneySigned(delta)}</td></tr>`,
        `<tr><td>Lý do nghiệp vụ</td><td>${U.esc(req.reason || '-')}</td></tr>`,
        `<tr><td>Ghi chú minh chứng</td><td>${U.esc(req.evidenceNote || '-')}</td></tr>`,
        `<tr><td>Tệp minh chứng</td><td>${req.attachment ? U.esc(req.attachment.name) : '-'}</td></tr>`
      ])}
    </div><div class="modal-f">
      ${canApprove ? `<button class="btn primary" data-act="inv-adjust-approve" data-id="${req.id}">Phê duyệt</button><button class="btn" data-act="inv-adjust-reject" data-id="${req.id}">Từ chối</button>` : ''}
      <button class="btn" data-act="close">Đóng</button></div>`, true);
  }
  function renderPtAdjustForm() {
    const d = ui.ptAdjForm, i = d && A.idx.invoice.get(d.invoiceId);
    if (!i || !ptCanRequestAdjust(i)) { A.closeModal(); A.render(); return; }
    const idx = Math.max(0, Math.min(i.items.length - 1, Number(d.lineIndex) || 0));
    const item = i.items[idx];
    const proposed = Math.max(0, Number(d.proposedAmount != null ? d.proposedAmount : item.amount) || 0);
    const delta = proposed - item.amount;
    ui.ptAdjForm.lineIndex = String(idx);
    ui.ptAdjForm.proposedAmount = proposed;
    A.modal(A.mHead('Yêu cầu điều chỉnh ' + i.id) + `<div class="modal-b">
      <div class="form-grid">
        <div class="field"><label>Dòng phát sinh cần điều chỉnh</label><select class="input" data-ch="adj-line">${i.items.map((x, n) => `<option value="${n}" ${idx === n ? 'selected' : ''}>${U.esc(ptItemKind(x.name) + ' · ' + x.name)}</option>`).join('')}</select></div>
        <div class="field"><label>Loại sai số</label><select class="input" data-ch="adj-kind">
          ${['Nhầm tiền quầy / mặt bằng', 'Nhầm tiền điện', 'Nhầm tiền nước', 'Nhầm dịch vụ khác', 'Miễn giảm theo chính sách', 'Khác'].map(x => `<option value="${U.esc(x)}" ${d.adjustmentType === x ? 'selected' : ''}>${U.esc(x)}</option>`).join('')}
        </select></div>
        <div class="field"><label>Số tiền hiện tại</label><input class="input" value="${U.money(item.amount)}" disabled></div>
        <div class="field"><label>Số tiền đề nghị đúng</label><input class="input" type="number" min="0" data-ch="adj-proposed" value="${proposed}"></div>
        <div class="field"><label>Chênh lệch sau điều chỉnh</label><input class="input" value="${ptMoneySigned(delta)}" disabled></div>
        <div class="field"><label>Trạng thái xử lý</label><input class="input" value="Chờ Trưởng Ban Quản lý phê duyệt" disabled></div>
      </div>
      <div class="field" style="margin-top:10px"><label>Lý do nghiệp vụ</label><textarea class="input" id="adj-reason" data-in="adj-reason" rows="2" placeholder="VD: nhập nhầm số quầy, sai chỉ số điện/nước, tính thừa dịch vụ khác...">${U.esc(d.reason || '')}</textarea></div>
      <div class="form-grid" style="margin-top:10px">
        <div class="field"><label>Ghi chú minh chứng</label><input class="input" id="adj-evidence" data-in="adj-evidence" value="${U.esc(d.evidenceNote || '')}" placeholder="VD: biên bản kiểm tra, ảnh đồng hồ, phiếu rà soát"></div>
        <div class="field"><label>Tệp minh chứng</label><input class="input" id="adj-file" type="file" accept="image/*,.pdf"></div>
      </div>
      <div class="note" style="margin-top:12px">Yêu cầu chỉ lưu trạng thái PENDING. Khoản phải thu chỉ thay đổi sau khi Trưởng Ban Quản lý phê duyệt.</div></div>
      <div class="modal-f"><button class="btn" data-act="close">Hủy</button><button class="btn primary" data-act="inv-adjust-save" data-id="${i.id}" ${delta === 0 ? 'disabled' : ''}>Gửi yêu cầu</button></div>`, true);
  }
  A.VIEWS['phai-thu'] = function () {
    const fp = financePeriod(), p = fp.id;
    const periods = A.db.issuedPeriods;
    const q = (f.ptSearch || '').toLowerCase();
    const inv = A.db.invoices.filter(i => U.inM(i) && i.period === p);
    const sessionReceivables = sessionCashReceivables(true);
    const rows = inv.filter(i => (!f.ptStatus || (f.ptStatus === 'over' ? U.isOver(i) : i.status === f.ptStatus))
      && (!q || i.id.toLowerCase().includes(q) || A.idx.trader.get(i.traderId).name.toLowerCase().includes(q) || A.idx.stall.get(i.stallId).code.toLowerCase().includes(q)));
    const sessionRows = sessionReceivables.filter(x => (!f.ptStatus || x.status === f.ptStatus) && sessionCashMatchesSearch(x, q));
    const pg = U.pager('pt' + p, rows.length, 25);
    const spg = U.pager('ptSession' + p, sessionRows.length, 12);
    const amt = U.sum(inv, i => i.amount), paid = U.sum(inv, i => i.paid);
    const allAmt = amt + U.sum(sessionReceivables, x => x.amount), allPaid = paid + U.sum(sessionReceivables, x => x.paid);
    const next = periods.includes('2026-10') ? null : '2026-10';
    const canIssue = A.canDo('phai-thu.phat-hanh', ui.market);
    return `<div class="card"><div class="card-b" style="padding-top:14px">${financeTimeBarRow('Kỳ thu')}
      <div class="row small" style="margin-top:8px;flex-wrap:wrap"><span class="muted">Hạn nộp: <b>${U.dmy(fp.dueDate)}</b></span><span class="spacer"></span>
      ${next && canIssue ? `<button class="btn primary" data-act="pt-issue">${U.icon('settings')}Phát hành tự động kỳ 10/2026</button>` : (next ? '' : '<span class="tag ok">Đã phát hành kỳ 10/2026</span>')}</div></div></div>
    <div class="kpis">
      <div class="card kpi"><div class="k-label">Số khoản phải thu</div><div class="k-value">${inv.length + sessionReceivables.length}</div><div class="k-sub">Gồm khoản cố định và khoản đăng ký phiên</div></div>
      <div class="card kpi"><div class="k-label">Tổng phải thu</div><div class="k-value">${U.moneyShort(allAmt)}</div><div class="k-sub">${U.money(allAmt)}</div></div>
      <div class="card kpi"><div class="k-label">Đã thu</div><div class="k-value">${U.moneyShort(allPaid)}</div><div class="bar-mini"><i style="width:${U.pct(allPaid, allAmt)}%"></i></div></div>
      <div class="card kpi"><div class="k-label">Còn phải thu</div><div class="k-value" style="color:#df2225">${U.moneyShort(allAmt - allPaid)}</div><div class="k-sub">Tỷ lệ thu ${U.pctTxt(U.pct(allPaid, allAmt))}</div></div></div>
    <div class="card"><div class="card-h"><h3>Danh sách khoản phải thu kỳ ${fp.label}</h3>
      <select class="input" data-ch="pt-status"><option value="">Mọi trạng thái</option><option value="paid" ${f.ptStatus === 'paid' ? 'selected' : ''}>Đã thu</option><option value="unpaid" ${f.ptStatus === 'unpaid' ? 'selected' : ''}>Chưa thu</option><option value="partial" ${f.ptStatus === 'partial' ? 'selected' : ''}>Thu một phần</option><option value="over" ${f.ptStatus === 'over' ? 'selected' : ''}>Quá hạn</option></select>
      <input class="input" placeholder="Mã khoản, tiểu thương, mã điểm" data-in="pt-search" value="${U.esc(f.ptSearch || '')}"></div>
      <div class="card-b">${U.table([{ t: 'Mã khoản' }, { t: 'Tiểu thương' }, { t: 'Điểm KD' }, { t: 'Số tiền', num: true }, { t: 'Đã thu', num: true }, { t: 'Hạn nộp' }, { t: 'Trạng thái' }],
        rows.slice(pg.start, pg.end).map(i => `<tr class="click" data-act="inv-open" data-id="${i.id}"><td>${i.id}${i.adjust ? ' <span class="tag purple">Miễn giảm</span>' : ''}</td><td>${U.esc(A.idx.trader.get(i.traderId).name)}</td><td>${A.idx.stall.get(i.stallId).code}</td>
          <td class="num">${U.money(i.amount)}</td><td class="num">${U.money(i.paid)}</td><td>${U.dmy(i.due)}</td><td>${U.invTag(i)}${ptPendingReq(i.id) ? ' <span class="tag warn">Chờ điều chỉnh</span>' : ''}</td></tr>`))}${pg.html}</div></div>
    <div class="card"><div class="card-h"><h3>Khoản thu tiền mặt đăng ký phiên chợ</h3></div>
      <div class="card-b">${U.table([{ t: 'Mã đăng ký' }, { t: 'Tiểu thương' }, { t: 'Phiên' }, { t: 'Số tiền', num: true }, { t: 'Đã thu', num: true }, { t: 'Hạn thu' }, { t: 'Trạng thái' }],
        sessionRows.slice(spg.start, spg.end).map(x => `<tr><td>${U.esc(x.id)}<div class="small muted">${U.esc(x.payment.id)}</div></td><td>${U.esc(x.trader.name)}<div class="small muted">${x.trader.id}</div></td>
          <td>${U.dmy(x.session.sessionDate || x.session.date)}<div class="small muted">${U.esc(x.session.name || x.session.id)}</div></td>
          <td class="num">${U.money(x.amount)}</td><td class="num">${U.money(x.paid)}</td><td>${U.esc(x.dueAt || '')}</td><td>${sessionCashStatusTag(x)}</td></tr>`),
        { empty: 'Chưa có khoản thu tiền mặt từ đăng ký phiên chợ' })}${spg.html}</div></div>
    <div class="card"><div class="card-h"><h3>Yêu cầu miễn giảm / điều chỉnh</h3></div>
      <div class="card-b">${U.table([{ t: 'Mã yêu cầu' }, { t: 'Khoản' }, { t: 'Dòng điều chỉnh' }, { t: 'Hiện tại', num: true }, { t: 'Đề nghị', num: true }, { t: 'Chênh lệch', num: true }, { t: 'Lý do' }, { t: 'Trạng thái' }, { t: '' }],
        ptRequestRows(), { empty: 'Chưa có yêu cầu điều chỉnh' })}</div></div>`;
  };
  A.CH['pt-status'] = el => { f.ptStatus = el.value; A.render(); };
  A.IN['pt-search'] = el => { f.ptSearch = el.value; A.render(); };
  A.ACT['pt-issue'] = () => {
    if (!A.canDo('phai-thu.phat-hanh', ui.market)) return;
    const db = A.db;
    if (db.issuedPeriods.includes('2026-10')) { U.toast('Kỳ 10/2026 đã được phát hành'); A.render(); return; }
    const out = [];
    const latestPeriod = db.meterPeriods[db.meterPeriods.length - 1].id;
    db.contracts.filter(c => c.status === 'hieuluc' && U.inM(c)).forEach(c => {
      const st = A.idx.stall.get(c.stallId);
      if (st.status === 'ngung' || st.status === 'trong') return;
      if (U.rentalKind(st) !== 'fixed') return;
      const items = receivableItemsForContract(st, c, latestPeriod);
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
    const pays = A.db.payments.filter(p => p.invoiceId === i.id), reqRows = ptRequestRows(i.id);
    A.modal(A.mHead('Khoản phải thu ' + i.id) + `<div class="modal-b">
      <dl class="kv"><dt>Tiểu thương</dt><dd>${U.esc(t.name)} (${t.id})</dd><dt>Điểm KD</dt><dd>${A.idx.stall.get(i.stallId).code} · ${U.mShort(i.market)}</dd>
        <dt>Kỳ / hạn nộp</dt><dd>${U.per(i.period)} · hạn ${U.dmy(i.due)}</dd><dt>Trạng thái</dt><dd>${U.invTag(i)}</dd></dl><div class="divider"></div>
      ${U.table([{ t: 'Nội dung' }, { t: 'Số tiền', num: true }], i.items.map(x => `<tr><td>${x.name}</td><td class="num">${U.money(x.amount)}</td></tr>`)
        .concat(i.adjust ? [`<tr><td>${U.esc(i.adjust.itemName || 'Điều chỉnh khoản phải thu')} (${U.esc(i.adjust.reason)}) – đã phê duyệt</td><td class="num">${ptMoneySigned(i.adjust.delta != null ? i.adjust.delta : -(i.adjust.value || 0))}</td></tr>`] : [])
        .concat([`<tr><td><b>Tổng cộng</b></td><td class="num"><b>${U.money(i.amount)}</b></td></tr>`]))}
      ${pays.length ? '<div class="divider"></div><b>Thanh toán</b>' + U.table([{ t: 'Biên lai' }, { t: 'Ngày' }, { t: 'Hình thức' }, { t: 'Số tiền', num: true }], pays.map(p => `<tr class="click" data-act="receipt" data-id="${p.receipt}"><td>${p.receipt}</td><td>${U.dmy(p.date)} ${p.time}</td><td>${D.METHOD[p.method]}</td><td class="num">${U.money(p.amount)}</td></tr>`)) : ''}
      ${reqRows.length ? '<div class="divider"></div><b>Yêu cầu điều chỉnh</b>' + U.table([{ t: 'Mã yêu cầu' }, { t: 'Khoản' }, { t: 'Dòng điều chỉnh' }, { t: 'Hiện tại', num: true }, { t: 'Đề nghị', num: true }, { t: 'Chênh lệch', num: true }, { t: 'Lý do' }, { t: 'Trạng thái' }, { t: '' }], reqRows) : ''}
      </div><div class="modal-f">
      ${ptCanRequestAdjust(i) ? `<button class="btn" data-act="inv-adjust" data-id="${i.id}">Gửi yêu cầu miễn giảm / điều chỉnh</button>` : ''}
      ${i.status !== 'paid' && A.canDo('thu-tien.thu', i.market) ? `<button class="btn primary" data-act="pay-open" data-id="${i.traderId}" data-inv="${i.id}">${U.icon('card')}Thu tiền</button>` : ''}
      <button class="btn" data-act="close">Đóng</button></div>`, true);
  };
  A.ACT['inv-adjust-detail'] = el => {
    const req = ptReqs().find(r => r.id === el.dataset.id);
    ptAdjustDetailModal(req);
  };
  A.ACT['inv-adjust'] = el => {
    const i = A.idx.invoice.get(el.dataset.id);
    if (!ptCanRequestAdjust(i)) return;
    const first = i.items[0];
    ui.ptAdjForm = { invoiceId: i.id, lineIndex: '0', adjustmentType: 'Nhầm tiền quầy / mặt bằng', proposedAmount: first ? first.amount : 0, reason: '', evidenceNote: '' };
    renderPtAdjustForm();
  };
  A.CH['adj-line'] = el => {
    const d = ui.ptAdjForm, i = d && A.idx.invoice.get(d.invoiceId);
    if (!i) return;
    const item = i.items[Number(el.value) || 0];
    d.lineIndex = el.value;
    d.proposedAmount = item ? item.amount : 0;
    renderPtAdjustForm();
  };
  A.CH['adj-kind'] = el => { if (ui.ptAdjForm) ui.ptAdjForm.adjustmentType = el.value; };
  A.CH['adj-proposed'] = el => { if (ui.ptAdjForm) { ui.ptAdjForm.proposedAmount = Math.max(0, Number(el.value) || 0); renderPtAdjustForm(); } };
  A.IN['adj-reason'] = el => { if (ui.ptAdjForm) ui.ptAdjForm.reason = el.value; };
  A.IN['adj-evidence'] = el => { if (ui.ptAdjForm) ui.ptAdjForm.evidenceNote = el.value; };
  A.ACT['inv-adjust-save'] = el => {
    const i = A.idx.invoice.get(el.dataset.id);
    if (!ptCanRequestAdjust(i)) return;
    const d = ui.ptAdjForm || {}, lineIndex = Number(d.lineIndex) || 0, item = i.items[lineIndex];
    if (!item) return;
    const reason = A.$('#adj-reason').value.trim(), evidenceNote = A.$('#adj-evidence').value.trim();
    if (!reason) { U.toast('Vui lòng nhập lý do nghiệp vụ'); return; }
    const file = A.$('#adj-file').files[0] || null;
    const proposedAmount = Math.max(0, Number(d.proposedAmount) || 0), delta = proposedAmount - item.amount;
    if (delta === 0) { U.toast('Số tiền đề nghị chưa thay đổi'); return; }
    if (i.amount + delta < i.paid) { U.toast('Điều chỉnh làm tổng phải thu nhỏ hơn số đã thu, không hợp lệ'); return; }
    ptReqs().unshift({
      id: 'YCDT-' + U.pad(ptReqs().length + 1, 4), invoiceId: i.id, market: i.market, lineIndex,
      itemName: item.name, itemKind: ptItemKind(item.name), adjustmentType: d.adjustmentType || ptItemKind(item.name),
      currentAmount: item.amount, proposedAmount, delta, reason, evidenceNote,
      attachment: file ? { name: file.name, type: file.type || 'application/octet-stream', size: file.size } : null,
      status: 'PENDING', requestedBy: (A.currentAccount() || {}).fullName || 'Không rõ', requestedAt: nowStamp(), decidedBy: null, decidedAt: null
    });
    ui.ptAdjForm = null;
    U.log(`Gửi yêu cầu điều chỉnh khoản ${i.id}: ${item.name} ${ptMoneySigned(delta)} (${reason})`);
    A.save(); A.closeModal(); A.render(); U.toast('Đã gửi yêu cầu, chờ Trưởng Ban Quản lý phê duyệt');
  };
  A.ACT['inv-adjust-approve'] = el => {
    const req = ptReqs().find(r => r.id === el.dataset.id), i = req && A.idx.invoice.get(req.invoiceId);
    if (!ptCanApproveAdjustReq(req)) return;
    const delta = ptReqDelta(req);
    i.adjust = { itemName: req.itemName, itemKind: req.itemKind, adjustmentType: req.adjustmentType, reason: req.reason, currentAmount: req.currentAmount, proposedAmount: req.proposedAmount, delta, requestId: req.id };
    i.amount = i.amount + delta;
    if (i.paid >= i.amount) i.status = 'paid';
    req.status = 'APPROVED'; req.decidedBy = (A.currentAccount() || {}).fullName || 'Không rõ'; req.decidedAt = nowStamp();
    A.refreshStall(A.idx.stall.get(i.stallId));
    U.log(`Phê duyệt yêu cầu điều chỉnh khoản ${i.id}: ${U.esc(req.itemName || '')} ${ptMoneySigned(delta)} (${req.reason})`);
    A.save(); A.closeModal(); A.render(); U.toast('Đã phê duyệt và cập nhật khoản phải thu ' + ptMoneySigned(delta));
  };
  A.ACT['inv-adjust-reject'] = el => {
    const req = ptReqs().find(r => r.id === el.dataset.id);
    if (!ptCanApproveAdjustReq(req)) return;
    req.status = 'REJECTED'; req.decidedBy = (A.currentAccount() || {}).fullName || 'Không rõ'; req.decidedAt = nowStamp();
    U.log(`Từ chối yêu cầu miễn giảm khoản ${req.invoiceId} (${req.reason})`);
    A.save(); A.closeModal(); A.render(); U.toast('Đã từ chối yêu cầu');
  };

  // ---------- Thu tiền ----------
  function directCollectAllowedForMarket(market) {
    return A.canDirectCollect(market);
  }
  function collectingBusinessStateOk(invoices) {
    const p = financePeriod();
    return invoices.length && p && p.status === 'COLLECTING';
  }
  function sessionCashReceivables(includePaid) {
    const regs = A.db.sessionRegistrations || [], pays = A.db.sessionPayments || [], sessions = A.db.marketSessions || [];
    const now = A.db.today + ' ' + U.nowTime();
    return pays.filter(p => p && p.method === 'CASH' && p.marketId === ui.market && (includePaid || p.status === 'WAITING_COLLECTION')).map(p => {
      const reg = regs.find(r => r.id === p.registrationId);
      const t = reg && A.idx.trader.get(reg.traderId || reg.merchantId);
      const s = reg && sessions.find(x => x.id === reg.sessionId);
      if (!reg || !t || !s || t.market !== ui.market) return null;
      const dueAt = p.dueAt || ((s.sessionDate || s.date || U.today()) + ' ' + (s.attendanceStartTime || s.startTime || '00:00'));
      const paid = p.status === 'SUCCESS' ? p.amount : 0;
      return {
        id: reg.code || reg.id, reg, payment: p, session: s, trader: t,
        amount: p.amount || reg.totalAmount || 0, paid, dueAt,
        status: p.status === 'SUCCESS' ? 'paid' : (dueAt && now > dueAt ? 'over' : 'unpaid')
      };
    }).filter(Boolean);
  }
  function sessionCashStatusTag(x) {
    if (x.status === 'paid') return '<span class="tag ok">Đã thu</span>';
    if (x.status === 'over') return '<span class="tag danger">Quá hạn trước điểm danh</span>';
    return '<span class="tag warn">Chờ thu tiền mặt</span>';
  }
  function sessionCashMatchesSearch(x, q) {
    if (!q) return true;
    return [x.id, x.payment.id, x.trader.name, x.trader.id, x.trader.phone, x.session.name || '', x.session.code || x.session.id].join(' ').toLowerCase().includes(q);
  }
  function sessionCashCollectAllowed(x) {
    return !!(x && x.status !== 'paid' && directCollectAllowedForMarket(x.payment.marketId));
  }
  function sessionCashSnapshot() {
    return {
      registrations: JSON.stringify(A.db.sessionRegistrations || []),
      sessionPayments: JSON.stringify(A.db.sessionPayments || []),
      sessionReceipts: JSON.stringify(A.db.sessionReceipts || []),
      payments: JSON.stringify(A.db.payments || []),
      log: JSON.stringify(A.db.extraLog || [])
    };
  }
  function restoreSessionCashSnapshot(snap) {
    A.db.sessionRegistrations = JSON.parse(snap.registrations);
    A.db.sessionPayments = JSON.parse(snap.sessionPayments);
    A.db.sessionReceipts = JSON.parse(snap.sessionReceipts);
    A.db.payments = JSON.parse(snap.payments);
    A.db.extraLog = JSON.parse(snap.log);
    A.reindex();
  }
  function openSessionCashPay(x) {
    if (!sessionCashCollectAllowed(x)) { U.toast('Không thể thu khoản này trong ngữ cảnh hiện tại'); return; }
    A.modal(A.mHead('Thu tiền mặt đăng ký phiên') + `<div class="modal-b">
      <dl class="kv"><dt>Tiểu thương</dt><dd>${U.esc(x.trader.name)} (${x.trader.id})</dd><dt>Đăng ký</dt><dd>${U.esc(x.id)}</dd>
        <dt>Phiên</dt><dd>${U.dmy(x.session.sessionDate || x.session.date)} · ${U.esc(x.session.name || x.session.id)}</dd>
        <dt>Hạn thu</dt><dd>Trước điểm danh · ${U.esc(x.dueAt || '')}</dd><dt>Số tiền</dt><dd><b>${U.money(x.amount)}</b></dd></dl>
      <div class="note info" style="margin-top:12px">Khoản này phát sinh từ đăng ký quầy chợ quê theo phiên, không phải phí cố định tháng/quý.</div>
      </div><div class="modal-f"><button class="btn" data-act="close">Hủy</button><button class="btn primary" data-act="pay-session-confirm" data-id="${x.payment.id}">Xác nhận thu tiền mặt & in biên lai</button></div>`, true);
  }
  function renderPay() {
    const ps = ui.pay, t = A.idx.trader.get(ps.traderId);
    const invs = A.db.invoices.filter(i => i.traderId === t.id && i.status !== 'paid' && i.market === t.market).sort((a, b) => a.due.localeCompare(b.due));
    const total = U.sum(invs.filter(i => ps.sel.includes(i.id)), U.due);
    const amount = ps.amount == null ? total : Math.min(ps.amount, total);
    const currentDebt = U.traderDebt(t.id), willComplete = amount >= currentDebt;
    A.modal(A.mHead('Thu tiền · ' + U.esc(t.name)) + `<div class="modal-b">
      <div class="note ${willComplete ? 'info' : ''}" style="margin-bottom:12px">${willComplete ? 'Sau khi xác nhận, tiểu thương này sẽ hoàn thành toàn bộ khoản phải thu hiện tại.' : 'Sau khi xác nhận, tiểu thương vẫn còn khoản phải thu chưa hoàn thành.'}</div>
      ${U.table([{ t: '' }, { t: 'Khoản' }, { t: 'Kỳ' }, { t: 'Điểm KD' }, { t: 'Hạn' }, { t: 'Còn phải thu', num: true }],
        invs.map(i => `<tr><td><input type="checkbox" data-ch="pay-sel" data-id="${i.id}" ${ps.sel.includes(i.id) ? 'checked' : ''}></td><td>${i.id}</td><td>${U.per(i.period)}</td><td>${A.idx.stall.get(i.stallId).code}</td><td>${U.isOver(i) ? `<span class="tag danger">${U.dmy(i.due)}</span>` : U.dmy(i.due)}</td><td class="num">${U.money(U.due(i))}</td></tr>`), { empty: 'Không còn khoản nào phải thu' })}
      <div class="form-grid" style="margin-top:14px">
        <div class="field"><label>Số tiền thu (có thể thu một phần)</label><input class="input" type="number" data-ch="pay-amount" value="${amount}"></div>
        <div class="field"><label>Tổng các khoản đã chọn</label><input class="input" value="${U.money(total)}" disabled></div></div>
      <div class="note info" style="margin-top:12px">Luồng này chỉ ghi nhận thu trực tiếp bằng tiền mặt tại Chợ quê TTĐ. Tiểu thương thanh toán QR/chuyển khoản qua Mini app riêng.</div>
      </div><div class="modal-f"><button class="btn" data-act="close">Hủy</button>
      <button class="btn primary" data-act="pay-confirm" ${amount > 0 ? '' : 'disabled'}>Xác nhận thu tiền mặt & in biên lai</button></div>`, true);
  }
  A.ACT['pay-open'] = el => {
    if (A.current === 'phai-thu') { U.toast('Màn Khoản phải thu chỉ dùng để kiểm tra và gửi yêu cầu điều chỉnh, không thu tiền trực tiếp.'); return; }
    const tid = el.dataset.id, t = A.idx.trader.get(tid);
    if (!t || !directCollectAllowedForMarket(t.market)) { U.toast('Chỉ được thu trực tiếp tiền mặt cho Chợ quê TTĐ trong phạm vi tài khoản'); return; }
    const invs = A.db.invoices.filter(i => i.traderId === tid && i.status !== 'paid' && i.market === t.market);
    if (!invs.length) { U.toast('Tiểu thương không còn khoản nào phải thu'); return; }
    if (!collectingBusinessStateOk(invs)) { U.toast('Chỉ thu trực tiếp cho kỳ đang ở trạng thái Đang thu'); return; }
    ui.pay = { traderId: tid, sel: el.dataset.inv ? [el.dataset.inv] : invs.map(i => i.id), method: 'tm', amount: null };
    renderPay();
  };
  A.ACT['pay-session-open'] = el => {
    const x = sessionCashReceivables(false).find(r => r.payment.id === el.dataset.id);
    openSessionCashPay(x);
  };
  A.ACT['pay-session-confirm'] = el => {
    const x = sessionCashReceivables(false).find(r => r.payment.id === el.dataset.id);
    if (!sessionCashCollectAllowed(x)) { U.toast('Khoản thu phiên không còn hợp lệ hoặc ngoài phạm vi'); A.closeModal(); A.render(); return; }
    if (!A.completeSessionCashPayment) { U.toast('Luồng thu phiên chưa sẵn sàng'); return; }
    const actor = (A.currentAccount() && A.currentAccount().code) || 'NV07';
    const snap = sessionCashSnapshot();
    const done = A.completeSessionCashPayment(x.reg, x.session, x.payment, actor);
    if (!done) { U.toast('Không thể ghi nhận thu: sai trạng thái đăng ký hoặc đã quá hạn trước điểm danh'); return; }
    try { A.save(); }
    catch (err) { restoreSessionCashSnapshot(snap); U.toast('Không lưu được khoản thu, chưa in biên lai'); A.closeModal(); A.render(); return; }
    A.render(); A.showReceipt([done.ledgerPayment], { autoPrint: true });
    U.toast('Đã thu ' + U.money(done.ledgerPayment.amount) + ' · biên lai đã gửi Mini app');
  };
  A.CH['pay-sel'] = el => { const s = ui.pay.sel, id = el.dataset.id; ui.pay.sel = el.checked ? s.concat([id]) : s.filter(x => x !== id); ui.pay.amount = null; renderPay(); };
  A.CH['pay-amount'] = el => { ui.pay.amount = Math.max(0, Number(el.value) || 0); renderPay(); };
  A.ACT['pay-confirm'] = () => {
    if (A.current === 'phai-thu') { U.toast('Màn Khoản phải thu không thực hiện thu tiền trực tiếp.'); A.closeModal(); return; }
    const ps = ui.pay;
    const t = ps && A.idx.trader.get(ps.traderId);
    if (!t || !directCollectAllowedForMarket(t.market)) { U.toast('Chỉ được thu trực tiếp tiền mặt cho Chợ quê TTĐ trong phạm vi tài khoản'); A.closeModal(); return; }
    const sel = A.db.invoices.filter(i => ps.sel.includes(i.id) && i.traderId === t.id && i.market === t.market && i.status !== 'paid');
    if (!sel.length) { U.toast('Khoản phải thu không còn hợp lệ (đã thu hoặc không thuộc phạm vi)'); A.closeModal(); A.render(); return; }
    if (!collectingBusinessStateOk(sel)) { U.toast('Chỉ thu trực tiếp cho kỳ đang ở trạng thái Đang thu'); return; }
    const total = U.sum(sel, U.due);
    const amount = ps.amount == null ? total : Math.min(ps.amount, total);
    if (amount <= 0) { U.toast('Số tiền thu không hợp lệ'); return; }
    const actor = (A.currentAccount() && A.currentAccount().code) || 'NV07';
    const pays = A.applyPayment(sel.map(i => i.id), amount, 'tm', actor);
    const completed = U.traderDebt(t.id) === 0;
    A.render(); A.showReceipt(pays, { autoPrint: true });
    U.toast('Đã thu ' + U.money(amount) + (completed ? ' · tiểu thương đã hoàn thành' : ' · còn khoản phải thu') + ' · biên lai đã gửi Mini app');
  };

  function receiptRows(payDate) {
    const q = (f.receiptSearch || '').toLowerCase();
    const method = f.receiptMethod || 'all';
    const status = f.receiptStatus || 'all';
    return A.db.payments.filter(p => U.inM(p) && (!payDate || p.date === payDate))
      .map(p => {
        const i = A.idx.invoice.get(p.invoiceId), t = A.idx.trader.get(p.traderId), st = i && A.idx.stall.get(i.stallId);
        const reg = p.registrationId && (A.db.sessionRegistrations || []).find(r => r.id === p.registrationId);
        const session = reg && (A.db.marketSessions || []).find(s => s.id === reg.sessionId);
        return { p, i, t, st, reg, session, complete: p.sourceType === 'SESSION_REGISTRATION' ? true : (t ? U.traderDebt(t.id) === 0 : false) };
      })
      .filter(x => {
        if (method !== 'all' && x.p.method !== method) return false;
        if (status === 'complete' && !x.complete) return false;
        if (status === 'debt' && x.complete) return false;
        if (!q) return true;
        return [x.p.receipt, x.p.lookup, x.p.id, x.i ? x.i.id : '', x.reg ? (x.reg.code || x.reg.id) : '', x.t ? x.t.name : '', x.t ? x.t.id : '', x.t ? x.t.phone : '', x.st ? x.st.code : '', x.session ? (x.session.name || x.session.id) : ''].join(' ').toLowerCase().includes(q);
      })
      .sort((a, b) => (b.p.date + b.p.time).localeCompare(a.p.date + a.p.time));
  }

  A.VIEWS['thu-tien'] = function () {
    const q = (f.thuSearch || '').toLowerCase();
    const payDate = f.thuDate || U.today();
    const p = financePeriod();
    const debtors = new Map();
    A.db.invoices.filter(i => U.inM(i) && i.status !== 'paid').forEach(i => {
      const d = debtors.get(i.traderId) || { n: 0, amt: 0, over: 0 };
      d.n++; d.amt += U.due(i); if (U.isOver(i)) d.over += U.due(i);
      debtors.set(i.traderId, d);
    });
    let list = Array.from(debtors.entries()).map(([id, d]) => Object.assign({ t: A.idx.trader.get(id) }, d))
      .filter(x => !q || x.t.name.toLowerCase().includes(q) || x.t.phone.includes(q) || x.t.stalls.some(id => A.idx.stall.get(id).code.toLowerCase().includes(q)))
      .sort((a, b) => b.over - a.over || b.amt - a.amt);
    const sessionList = sessionCashReceivables(false).filter(x => sessionCashMatchesSearch(x, q));
    const pg = U.pager('thu', list.length, 12);
    const spg = U.pager('thuSession', sessionList.length, 12);
    const today = A.db.payments.filter(p => U.inM(p) && p.date === payDate).slice().reverse();
    const cash = U.sum(today.filter(p => p.method === 'tm'), p => p.amount), non = U.sum(today.filter(p => p.method !== 'tm'), p => p.amount);
    const receipts = receiptRows(payDate), rpg = U.pager('thuReceipt', receipts.length, 12);
    const done = receipts.filter(x => x.complete).length;
    const sessionAmt = U.sum(sessionList, x => x.amount), fixedAmt = U.sum(list, x => x.amt);
    const timeBar = `<div class="card"><div class="card-b" style="padding-top:14px">${financeTimeBarRow('Kỳ khoản thu')}
      <div class="row small" style="margin-top:10px;gap:8px;flex-wrap:wrap">
        <input class="input" style="min-width:260px;flex:1" placeholder="Tìm tiểu thương, SĐT, mã đăng ký, biên lai, mã điểm" data-in="thu-search" value="${U.esc(f.thuSearch || '')}">
        <span class="label-sm">Ngày thu / biên lai</span><input type="date" class="input" style="width:160px" data-ch="thu-date" value="${payDate}">
        <span class="tag ${p.status === 'COLLECTING' ? 'ok' : ''}">${p.status === 'COLLECTING' ? 'Đang thu' : 'Kỳ trước'}</span>
      </div></div></div>`;
    return timeBar + `<div class="kpis">
      <div class="card kpi"><div class="k-label">Đăng ký phiên chờ thu</div><div class="k-value">${sessionList.length}</div><div class="k-sub">${U.money(sessionAmt)}</div></div>
      <div class="card kpi"><div class="k-label">Phí cố định chờ thu</div><div class="k-value">${list.length}</div><div class="k-sub">${U.money(fixedAmt)}</div></div>
      <div class="card kpi"><div class="k-label">Tiền mặt đã thu ngày chọn</div><div class="k-value">${U.moneyShort(cash)}</div><div class="k-sub">${receipts.filter(x => x.p.method === 'tm').length} biên lai</div></div>
      <div class="card kpi"><div class="k-label">Qua app / chuyển khoản</div><div class="k-value">${U.moneyShort(non)}</div><div class="k-sub">${receipts.filter(x => x.p.method !== 'tm').length} biên lai</div></div></div>
      <div class="card"><div class="card-h"><div><h3>Việc cần thu hôm nay</h3><div class="small muted">Ưu tiên khoản đăng ký phiên vì phải hoàn thành trước điểm danh.</div></div><span class="spacer"></span><span class="tag warn">${sessionList.length} chờ thu</span></div>
        <div class="card-b">${U.table([{ t: 'Tiểu thương' }, { t: 'Đăng ký / phiên' }, { t: 'Hạn thu' }, { t: 'Số tiền', num: true }, { t: 'Trạng thái' }, { t: '' }],
          sessionList.slice(spg.start, spg.end).map(x => `<tr><td><b>${U.esc(x.trader.name)}</b><div class="small muted">${x.trader.id} · ${U.maskPhone(x.trader.phone)}</div></td>
            <td>${U.esc(x.id)}<div class="small muted">${U.dmy(x.session.sessionDate || x.session.date)} · ${U.esc(x.session.name || x.session.id)}</div></td>
            <td>${U.esc(x.dueAt || '')}</td><td class="num">${U.money(x.amount)}</td><td>${sessionCashStatusTag(x)}</td>
            <td>${sessionCashCollectAllowed(x) ? `<button class="btn sm primary" data-act="pay-session-open" data-id="${x.payment.id}">Thu tiền mặt</button>` : ''}</td></tr>`),
          { empty: 'Không có đăng ký phiên chờ thu tiền mặt' })}${spg.html}</div></div>
      <div class="card"><div class="card-h"><div><h3>Thu phí cố định tại quầy</h3><div class="small muted">Các khoản phí tháng/quý còn phải thu của tiểu thương.</div></div><span class="spacer"></span><span class="tag">${list.length} hồ sơ</span></div>
        <div class="card-b">
          ${U.table([{ t: 'Tiểu thương' }, { t: 'Điểm KD' }, { t: 'Còn phải thu', num: true }, { t: 'Trạng thái' }, { t: '' }],
          list.slice(pg.start, pg.end).map(x => `<tr><td><b>${U.esc(x.t.name)}</b><div class="small muted">${x.t.id} · ${U.maskPhone(x.t.phone)}</div></td><td>${x.t.stalls.map(id => A.idx.stall.get(id).code).join(', ')}</td><td class="num">${U.money(x.amt)}<div class="small muted">${x.n} khoản</div></td><td>${x.over ? `<span class="tag danger">Quá hạn ${U.moneyShort(x.over)}</span>` : '<span class="tag warn">Chờ thu</span>'}</td><td>${directCollectAllowedForMarket(x.t.market) ? `<button class="btn sm primary" data-act="pay-open" data-id="${x.t.id}">Thu tiền mặt</button>` : ''}</td></tr>`), { empty: 'Không còn tiểu thương cần thu' })}${pg.html}
        </div></div>
      <div class="card"><div class="card-h"><div><h3>Biên lai & truy vết</h3><div class="small muted">Biên lai chỉ xuất hiện sau khi ghi nhận thu thành công.</div></div><span class="spacer"></span><span class="tag ok">${done} hoàn thành</span><span class="tag">${receipts.length} biên lai</span></div><div class="card-b">
        <div class="row" style="gap:8px;flex-wrap:wrap;margin-bottom:10px">
          <input class="input" style="min-width:240px;flex:1" placeholder="Tìm biên lai / tiểu thương / mã điểm" data-in="receipt-search" value="${U.esc(f.receiptSearch || '')}">
          <select class="input" style="width:150px" data-ch="receipt-method"><option value="all">Mọi hình thức</option>${Object.keys(D.METHOD).map(m => `<option value="${m}" ${(f.receiptMethod || 'all') === m ? 'selected' : ''}>${D.METHOD[m]}</option>`).join('')}</select>
          <select class="input" style="width:160px" data-ch="receipt-status"><option value="all">Mọi trạng thái</option><option value="complete" ${(f.receiptStatus || 'all') === 'complete' ? 'selected' : ''}>Đã hoàn thành</option><option value="debt" ${(f.receiptStatus || 'all') === 'debt' ? 'selected' : ''}>Còn phải thu</option></select>
        </div>
        ${U.table([{ t: 'Biên lai' }, { t: 'Tiểu thương' }, { t: 'Điểm / khoản' }, { t: 'Hình thức' }, { t: 'Số tiền', num: true }, { t: 'Hoàn thành' }],
          receipts.slice(rpg.start, rpg.end).map(x => `<tr class="click" data-act="receipt" data-id="${x.p.receipt}"><td><b>${x.p.receipt}</b><div class="small muted">${U.dmy(x.p.date)} ${x.p.time} · ${x.p.lookup}</div></td><td>${x.t ? U.esc(x.t.name) : ''}<div class="small muted">${x.t ? x.t.id : ''}</div></td><td>${x.st ? x.st.code : (x.reg ? U.esc(x.reg.code || x.reg.id) : '')}<div class="small muted">${x.i ? x.i.id + ' · kỳ ' + U.per(x.i.period) : (x.session ? 'Phiên chợ quê · ' + U.dmy(x.session.sessionDate || x.session.date) : '')}</div></td><td>${D.METHOD[x.p.method]}</td><td class="num">${U.money(x.p.amount)}</td><td>${x.complete ? '<span class="tag ok">Đã hoàn thành</span>' : '<span class="tag warn">Còn phải thu</span>'}</td></tr>`), { empty: 'Không tìm thấy biên lai phù hợp' })}${rpg.html}
      </div></div>`;
  };
  A.IN['thu-search'] = el => { f.thuSearch = el.value; ui.page.thu = 0; A.render(); };
  A.CH['thu-date'] = el => { f.thuDate = el.value || U.today(); A.render(); };
  A.IN['receipt-search'] = el => { f.receiptSearch = el.value; ui.page.thuReceipt = 0; A.render(); };
  A.CH['receipt-method'] = el => { f.receiptMethod = el.value; ui.page.thuReceipt = 0; A.render(); };
  A.CH['receipt-status'] = el => { f.receiptStatus = el.value; ui.page.thuReceipt = 0; A.render(); };

  // ---------- Đối soát ----------
  const DS_BANK_LABEL = {
    MATCHED_AUTO: { t: '✓ Khớp tự động', cls: 'ok' },
    MATCHED_MANUAL: { t: '✓ Khớp thủ công', cls: 'ok' },
    UNMATCHED: { t: '● Chưa khớp', cls: '' },
    AMOUNT_MISMATCH: { t: '⚠ Lệch số tiền', cls: 'danger' },
    NEEDS_REVIEW: { t: '⚠ Cần xử lý', cls: 'warn' }
  };
  function dsBankTag(b) { const s = DS_BANK_LABEL[b.status] || DS_BANK_LABEL.UNMATCHED; return `<span class="tag ${s.cls}">${s.t}</span>`; }
  function dsActor() { const acc = A.currentAccount(); return acc ? acc.fullName : 'Không rõ'; }
  function dsNowStamp() { return U.dmy(U.today()) + ' ' + U.nowTime(); }
  function dsCanAction(actionKey, targetMarket) { return U.can('doi-soat') && A.canDo(actionKey, targetMarket || ui.market); }
  function dsCanBank(targetMarket) { return dsCanAction('doi-soat.xem-ngan-hang', targetMarket); }
  function dsCanBankMatch(targetMarket) { return dsCanAction('doi-soat.gan-thu-cong', targetMarket); }
  function dsCanCash(targetMarket) { return dsCanAction('doi-soat.xem-tien-mat', targetMarket); }
  function dsCanCashConfirm(targetMarket) { return dsCanAction('doi-soat.xac-nhan-nop-quy', targetMarket); }
  function dsCanAudit(targetMarket) { return dsCanAction('doi-soat.xem-truy-vet', targetMarket); }
  function dsIsSessionMarket() { const m = U.market(ui.market); return !!m && m.kind === 'session'; }
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
  function dsSessions() { return (A.db.marketSessions || []).filter(s => s.marketId === ui.market).slice().sort((a, b) => (b.sessionDate || '').localeCompare(a.sessionDate || '')); }
  function dsSessionRegs(sessionId) { return (A.db.sessionRegistrations || []).filter(r => r.sessionId === sessionId); }
  function dsSessionPays(sessionId) { return (A.db.sessionPayments || []).filter(p => p.sessionId === sessionId); }
  function dsSessionReceipts(sessionId) { return (A.db.sessionReceipts || []).filter(r => r.sessionId === sessionId); }
  function dsSessionExceptions(sessionId) { return (A.db.sessionReconExceptions || []).filter(e => e.sessionId === sessionId); }
  function dsSessionOpenExceptions(sessionId) { return dsSessionExceptions(sessionId).filter(e => e.status === 'OPEN' || e.status === 'IN_REVIEW'); }
  function dsSessionCashConfirm(sessionId) { return (A.db.cashConfirms || []).find(c => c.sessionId === sessionId && c.market === ui.market); }
  function dsSessionTotals(s) {
    const regs = dsSessionRegs(s.id), pays = dsSessionPays(s.id), receipts = dsSessionReceipts(s.id), openEx = dsSessionOpenExceptions(s.id);
    const onlineSuccess = U.sum(pays.filter(p => p.method === 'ONLINE' && p.status === 'SUCCESS'), p => p.amount);
    const onlineRecon = U.sum(pays.filter(p => p.method === 'ONLINE' && p.status === 'RECONCILED'), p => p.amount);
    const onlineWaiting = U.sum(pays.filter(p => p.method === 'ONLINE' && p.status === 'WAITING_PAYMENT'), p => p.amount);
    const cashSystem = U.sum(pays.filter(p => p.method === 'CASH' && p.status === 'SUCCESS'), p => p.amount);
    const cashReceipts = U.sum(receipts.filter(r => r.method === 'CASH'), r => r.amount);
    const expected = U.sum(regs.filter(r => r.status !== 'CANCELLED' && r.status !== 'REJECTED'), r => r.totalAmount || 0);
    return { regs, pays, receipts, openEx, onlineSuccess, onlineRecon, onlineWaiting, cashSystem, cashReceipts, expected, confirm: dsSessionCashConfirm(s.id) };
  }
  function dsSessionState(s) {
    const t = dsSessionTotals(s);
    const hasCashEx = t.openEx.some(e => e.type === 'CASH_SUBMITTED_MISMATCH');
    if (s.status !== 'WAITING_RECONCILIATION' && s.status !== 'CLOSED') return { id: 'NOT_DUE', label: 'Chưa tới bước đối soát', cls: 'info' };
    if (hasCashEx) return { id: 'CASH_EXCEPTION', label: 'Lệch tiền mặt', cls: 'danger' };
    if (t.openEx.length) return { id: 'EXCEPTION', label: 'Có ngoại lệ', cls: 'danger' };
    if (t.cashSystem !== t.cashReceipts) return { id: 'CASH_MISMATCH', label: 'Lệch biên lai tiền mặt', cls: 'danger' };
    if (t.onlineSuccess > 0) return { id: 'ONLINE_WAITING', label: 'Online chờ đối soát', cls: 'warn' };
    if (s.status === 'CLOSED') return { id: 'CLOSED', label: 'Đã đóng phiên', cls: 'ok' };
    if (t.cashSystem > 0 && !t.confirm) return { id: 'CASH_READY', label: 'Sẵn sàng xác nhận tiền mặt', cls: 'warn' };
    return { id: 'RECONCILED', label: 'Đã đối soát', cls: 'ok' };
  }
  function dsCanSessionCashConfirm(s) {
    if (!s || !dsCanCashConfirm(s.marketId) || s.status !== 'WAITING_RECONCILIATION' || dsSessionCashConfirm(s.id)) return false;
    const t = dsSessionTotals(s);
    return t.cashSystem > 0 && t.cashSystem === t.cashReceipts && !t.openEx.some(e => e.type === 'CASH_SUBMITTED_MISMATCH');
  }
  function dsSessionReconPanel() {
    if (!dsIsSessionMarket()) return '';
    const rows = dsSessions();
    if (!rows.length) return `<div class="card"><div class="card-b"><div class="empty">Chợ quê chưa có phiên nào trong local state. Mở màn Phiên chợ quê để seed dữ liệu mẫu phiên chợ.</div></div></div>`;
    return `<div class="card"><div class="card-h"><h3>Đối soát phiên chợ quê</h3><span class="small muted">Nguồn: đăng ký, thanh toán, biên lai và exception của workflow Phiên chợ quê</span></div>
      <div class="card-b">${U.table([{ t: 'Phiên' }, { t: 'Trạng thái phiên' }, { t: 'Online đã khớp', num: true }, { t: 'Online chờ khớp', num: true }, { t: 'Tiền mặt theo biên lai', num: true }, { t: 'Ngoại lệ' }, { t: 'Kết quả' }],
        rows.map(s => {
          const t = dsSessionTotals(s), st = dsSessionState(s);
          return `<tr><td><b>${U.esc(s.code)}</b><div class="small muted">${U.dmy(s.sessionDate)} · ${U.esc(s.name || '')}</div></td>
            <td><span class="tag">${U.esc(s.status)}</span></td>
            <td class="num">${U.money(t.onlineRecon)}</td><td class="num">${U.money(t.onlineSuccess + t.onlineWaiting)}</td>
            <td class="num">${U.money(t.cashReceipts)}</td><td>${t.openEx.length ? `<span class="tag danger">${t.openEx.length} mở</span>` : '<span class="tag ok">Không</span>'}</td>
            <td><span class="tag ${st.cls}">${st.label}</span></td></tr>`;
        }), { empty: 'Chưa có dữ liệu phiên chợ để đối soát' })}</div></div>`;
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
    ${dsSessionReconPanel()}
    <div class="card"><div class="card-h"><h3>Sao kê ngân hàng / QR</h3>
      <div class="seg">${[['all', 'Tất cả'], ['matched', 'Đã khớp'], ['unmatched', 'Chưa khớp'], ['mismatch', 'Lệch số tiền'], ['review', 'Cần xử lý']].map(x => `<button class="${ui.dsBankFilter === x[0] ? 'on' : ''}" data-act="ds-bank-filter" data-id="${x[0]}">${x[1]}</button>`).join('')}</div>
      <span class="spacer"></span>
      <input class="input" style="width:260px" placeholder="Tìm mã sao kê, khoản phải thu, tiểu thương..." data-in="ds-bank-search" value="${U.esc(ui.dsBankSearch || '')}">
      <button class="btn" data-act="ds-csv">⬇ Xuất Excel</button></div>
      <div class="card-b">${U.table([{ t: 'Ngày giờ' }, { t: 'Mã sao kê' }, { t: 'Nội dung chuyển khoản' }, { t: 'Số tiền', num: true }, { t: 'Khoản phải thu' }, { t: 'Biên lai' }, { t: 'Tiểu thương' }, { t: 'Kết quả' }, { t: '' }],
        rows.slice(pg.start, pg.end).map(b => {
          const info = dsInvoiceInfo(b.receivableId);
          const canBtnMatch = canMatch && dsCanBankMatch(b.market) && b.status !== 'MATCHED_AUTO' && b.status !== 'MATCHED_MANUAL';
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
    if (!dsCanBank()) return;
    const rows = dsBankRows();
    U.csv('doi-soat-ngan-hang-' + U.today(), ['Giờ', 'Mã sao kê', 'Nội dung', 'Số tiền', 'Khoản phải thu', 'Biên lai', 'Trạng thái'],
      rows.map(b => [b.time, b.id, b.ref, b.amount, b.receivableId || '', b.receiptId || '', (DS_BANK_LABEL[b.status] || {}).t || b.status]));
  };

  function dsBankDrawerHtml(b) {
    const canMatch = dsCanBankMatch(b.market) && b.status !== 'MATCHED_AUTO' && b.status !== 'MATCHED_MANUAL';
    const canAudit = dsCanAudit(b.market);
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
    if (!b || !dsCanBank(b.market)) return;
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
    const b = dsBankOf(el.dataset.id);
    if (!b || !dsCanBankMatch(b.market) || b.status === 'MATCHED_AUTO' || b.status === 'MATCHED_MANUAL') return;
    ui.dsMatch = { bankId: b.id, q: '' };
    renderDsMatchModal();
  };
  A.IN['ds-match-search'] = el => { ui.dsMatch.q = el.value; renderDsMatchModal(); };
  A.ACT['ds-bank-match-pick'] = el => {
    const b = dsBankOf(ui.dsMatch.bankId), inv = A.idx.invoice.get(el.dataset.inv);
    if (!b || !inv || !dsCanBankMatch(b.market) || inv.market !== b.market || b.market !== ui.market || inv.status === 'paid') { A.closeModal(); return; }
    A.modal(A.mHead('Xác nhận gắn giao dịch') + `<div class="modal-b">
      <p>Gắn giao dịch <b>${b.id}</b> với khoản phải thu <b>${inv.id}</b> (${U.esc(A.idx.trader.get(inv.traderId).name)})?</p>
      <div class="note info">Thao tác này chỉ cập nhật trạng thái đối soát trên màn này, không thay đổi khoản phải thu hay tạo thanh toán mới.</div>
      </div><div class="modal-f"><button class="btn" data-act="ds-bank-match-back">Hủy</button><button class="btn primary" data-act="ds-bank-match-confirm" data-inv="${inv.id}">Xác nhận</button></div>`);
  };
  A.ACT['ds-bank-match-back'] = () => renderDsMatchModal();
  A.ACT['ds-bank-match-confirm'] = el => {
    if (!ui.dsMatch) { A.closeModal(); return; }
    const b = dsBankOf(ui.dsMatch.bankId), inv = A.idx.invoice.get(el.dataset.inv);
    if (!b || !inv || !dsCanBankMatch(b.market) || inv.market !== b.market || b.market !== ui.market || inv.status === 'paid' || b.status === 'MATCHED_AUTO' || b.status === 'MATCHED_MANUAL') { A.closeModal(); return; }
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
    if (e.remaining === 0 && e.confirm) return { id: 'RECONCILED', label: 'Đã đối soát', cls: 'ok', ico: '✓' };
    if (e.remaining === 0) return { id: 'DEPOSITED', label: 'Đã nộp', cls: 'ok', ico: '✓' };
    if (e.deposited === 0 && e.collected > 0) return { id: 'WAITING_DEPOSIT', label: 'Chờ nộp', cls: '', ico: '●' };
    if (e.deposited > 0 && e.deposited < e.collected) return { id: 'PARTIAL_DEPOSIT', label: 'Chưa nộp đủ', cls: 'warn', ico: '●' };
    return { id: 'OVER_DEPOSIT', label: 'Có chênh lệch', cls: 'danger', ico: '⚠' };
  }
  function dsSessionCashPanel() {
    if (!dsIsSessionMarket()) return '';
    const rows = dsSessions();
    if (!rows.length) return `<div class="card"><div class="card-b"><div class="empty">Chưa có phiên chợ quê trong local state để đối soát tiền mặt.</div></div></div>`;
    return `<div class="card"><div class="card-h"><h3>Tiền mặt phiên chợ quê</h3><span class="small muted">Xác nhận theo phiên, không gộp với thu phí cố định hằng tháng</span></div>
      <div class="card-b">${U.table([{ t: 'Phiên' }, { t: 'Thu tiền mặt trên hệ thống', num: true }, { t: 'Biên lai tiền mặt', num: true }, { t: 'Trạng thái' }, { t: 'Xác nhận' }, { t: '' }],
        rows.map(s => {
          const t = dsSessionTotals(s), st = dsSessionState(s), canConfirm = dsCanSessionCashConfirm(s);
          return `<tr><td><b>${U.esc(s.code)}</b><div class="small muted">${U.dmy(s.sessionDate)} · ${U.esc(s.name || '')}</div></td>
            <td class="num">${U.money(t.cashSystem)}</td><td class="num">${U.money(t.cashReceipts)}</td>
            <td><span class="tag ${st.cls}">${st.label}</span></td>
            <td>${t.confirm ? `<span class="tag ok">Đã xác nhận</span><div class="small muted">${U.esc(t.confirm.confirmedBy)} · ${U.esc(t.confirm.confirmedAt)}</div>` : '<span class="muted">Chưa xác nhận</span>'}</td>
            <td>${canConfirm ? `<button class="btn sm primary" data-act="ds-session-cash-confirm" data-id="${s.id}">Xác nhận tiền mặt</button>` : ''}</td></tr>`;
        }), { empty: 'Chưa có dữ liệu tiền mặt phiên chợ quê' })}</div></div>`;
  }
  function dsCashView() {
    const rows = dsCashRows();
    const totalReceipts = U.sum(rows, e => e.payments.length);
    const totalCollected = U.sum(rows, e => e.collected);
    const totalDeposited = U.sum(rows, e => e.deposited);
    const totalRemaining = totalCollected - totalDeposited;
    const notDone = rows.filter(e => dsCashStatusOf(e).id !== 'RECONCILED').length;
    return `${dsSessionCashPanel()}<div class="kpis">
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
    if (!dsCanCash()) return;
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
    const canDeposit = dsCanCashConfirm(e.market) && e.remaining > 0;
    const canConfirm = dsCanCashConfirm(e.market) && s.id === 'DEPOSITED' && !e.confirm;
    const canAudit = dsCanAudit(e.market);
    const receiptRows = e.payments.map(p => {
      const inv = A.idx.invoice.get(p.invoiceId);
      const reg = p.registrationId && (A.db.sessionRegistrations || []).find(r => r.id === p.registrationId);
      const s = reg && (A.db.marketSessions || []).find(x => x.id === reg.sessionId);
      const label = inv ? A.idx.stall.get(inv.stallId).code : (reg ? (reg.code || reg.id) + (s ? ' · ' + U.dmy(s.sessionDate || s.date) : '') : '');
      return `<div class="row small" style="padding:5px 0;border-bottom:1px solid #eef2f7"><span>${p.receipt}<div class="muted">${U.esc(p.sourceType === 'SESSION_REGISTRATION' ? 'Đăng ký phiên chợ' : 'Khoản phí cố định')}</div></span><span>${U.esc(label)}</span><span class="spacer"></span><b>${U.money(p.amount)}</b></div>`;
    }).join('');
    const depositRows = e.deposits.length ? e.deposits.map(d => `<div style="padding:8px 0;border-bottom:1px solid #eef2f7">
        <div class="row small"><b>${d.id}</b><span class="spacer"></span><b>${U.money(d.amount)}</b></div>
        <div class="small muted">${d.depositedAt}</div>
        <div class="small">Người nộp: ${U.esc(U.staffName(d.employeeId))} · Người nhận: ${U.esc(U.staffName(d.receivedBy))}</div>
        ${d.attachment ? `<button class="btn sm" style="margin-top:4px" data-act="ds-cash-att" data-id="${d.id}">${U.icon('attachment')}Xem chứng từ</button>` : ''}
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
      <div class="drawer-f">${canDeposit ? `<button class="btn primary" data-act="ds-cash-deposit" data-id="${e.employeeId}">Ghi nhận nộp quỹ ${U.money(e.remaining)}</button>` : ''}${canConfirm ? `<button class="btn primary" data-act="ds-cash-confirm" data-id="${e.employeeId}">Xác nhận đối soát</button>` : ''}<button class="btn" data-act="close">Đóng</button></div>`;
  }
  A.ACT['ds-cash-view'] = el => {
    const e = dsCashRows().find(x => x.employeeId === el.dataset.id);
    if (!e || !dsCanCash(e.market)) return;
    A.$('#modal-root').innerHTML = `<div class="drawer-overlay" data-act="close"></div><div class="drawer">${dsCashDrawerHtml(el.dataset.id)}</div>`;
  };
  A.ACT['ds-cash-att'] = el => {
    const d = A.db.cashDeposits.find(x => x.id === el.dataset.id);
    if (!d || !d.attachment) return;
    A.modal(A.mHead('Chứng từ nộp quỹ ' + d.id) + `<div class="modal-b" style="text-align:center">
      <div class="empty" style="padding:40px 16px">📄<br>${U.esc(d.attachment.name)}<div class="small muted" style="margin-top:6px">Chứng từ minh họa (dữ liệu mẫu) · ${U.esc(d.attachment.type)}</div></div>
      </div><div class="modal-f"><button class="btn primary" data-act="close">Đóng</button></div>`);
  };
  A.ACT['ds-cash-deposit'] = el => {
    const employeeId = el.dataset.id;
    const e0 = dsCashRows().find(x => x.employeeId === employeeId);
    if (!e0 || !dsCanCashConfirm(e0.market) || e0.remaining <= 0) return;
    const acc = A.currentAccount();
    A.db.cashDeposits = A.db.cashDeposits || [];
    const id = 'NQ-' + U.pad(A.db.cashDeposits.length + 1, 5);
    A.db.cashDeposits.push({
      id, employeeId, market: e0.market, date: U.today(), amount: e0.remaining,
      depositedAt: dsNowStamp(), receivedBy: acc && acc.code ? acc.code : dsActor(),
      attachment: { name: 'phieu_nop_quy_' + id.toLowerCase() + '.pdf', type: 'application/pdf' }
    });
    U.log('Ghi nhận nộp quỹ tiền mặt ' + id + ' cho ' + U.staffName(employeeId) + ': ' + U.money(e0.remaining));
    A.save(); A.render();
    A.$('#modal-root').innerHTML = `<div class="drawer-overlay" data-act="close"></div><div class="drawer">${dsCashDrawerHtml(employeeId)}</div>`;
    U.toast('Đã ghi nhận nộp quỹ ' + U.money(e0.remaining));
  };
  A.ACT['ds-cash-confirm'] = el => {
    const employeeId = el.dataset.id;
    const e0 = dsCashRows().find(x => x.employeeId === employeeId);
    if (!e0 || !dsCanCashConfirm(e0.market)) return;
    if (!e0 || dsCashStatusOf(e0).id !== 'DEPOSITED' || e0.confirm) return;
    A.db.cashConfirms.push({ employeeId, market: e0.market, date: U.today(), confirmedBy: dsActor(), confirmedAt: dsNowStamp() });
    U.log('Xác nhận đối soát tiền mặt cho ' + U.staffName(employeeId) + ' ngày ' + U.dmy(U.today()));
    A.save(); A.render();
    A.$('#modal-root').innerHTML = `<div class="drawer-overlay" data-act="close"></div><div class="drawer">${dsCashDrawerHtml(employeeId)}</div>`;
    U.toast('Đã xác nhận đối soát tiền mặt cho ' + U.staffName(employeeId));
  };
  A.ACT['ds-session-cash-confirm'] = el => {
    const s = dsSessions().find(x => x.id === el.dataset.id);
    if (!dsCanSessionCashConfirm(s)) return;
    A.db.cashConfirms = A.db.cashConfirms || [];
    A.db.cashConfirms.push({ sessionId: s.id, market: s.marketId, date: U.today(), confirmedBy: dsActor(), confirmedAt: dsNowStamp(), kind: 'SESSION_CASH' });
    U.log('Xác nhận đối soát tiền mặt phiên chợ quê ' + s.code + ' ngày ' + U.dmy(s.sessionDate));
    A.save(); A.render();
    U.toast('Đã xác nhận tiền mặt phiên ' + s.code);
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
        <div class="row" style="padding:6px 0"><span class="tag warn">Ngày 25</span>Nhắc lần 2 kèm hướng dẫn thanh toán trên Mini app</div>
        <div class="row" style="padding:6px 0"><span class="tag danger">Quá 60 ngày</span>Chuyển danh sách cho Trưởng Ban Quản lý xử lý theo hợp đồng</div>
        <div class="muted" style="margin-top:8px">Không gửi lặp trong cùng mốc, cùng kênh. Lưu nhật ký gửi, nhận, đọc.</div></div></div></div>
    <div class="card"><div class="card-h"><h3>Danh sách tiểu thương nợ quá hạn (${list.length})</h3>${canRemindAll ? `<button class="btn accent" data-act="cn-remind-all">${U.icon('bell')}Gửi nhắc nợ tất cả</button>` : ''}
      <button class="btn" data-act="cn-csv">⬇ Xuất Excel</button></div>
      <div class="card-b">${U.table([{ t: 'Tiểu thương' }, { t: 'Điểm KD' }, { t: 'Số kỳ nợ', num: true }, { t: 'Tổng nợ', num: true }, { t: 'Quá hạn lâu nhất', num: true }, { t: 'Đã nhắc', num: true }, { t: '' }],
        list.slice(pg.start, pg.end).map(x => `<tr><td><b>${U.esc(x.t.name)}</b> <span class="small muted">${x.t.app ? '· có mini app' : '· chưa cài app'}</span></td><td>${x.t.stalls.map(id => A.idx.stall.get(id).code).join(', ')}</td><td class="num">${x.n}</td><td class="num">${U.money(x.amt)}</td>
          <td class="num"><span class="tag ${x.days > 60 ? 'danger' : 'warn'}">${x.days} ngày</span></td><td class="num">${x.rem}</td>
          <td class="nowrap">${A.canDo('cong-no.nhac-no', x.t.market) ? `<button class="btn sm" data-act="cn-remind" data-id="${x.t.id}">Nhắc nợ</button>` : ''} ${directCollectAllowedForMarket(x.t.market) ? `<button class="btn sm primary" data-act="pay-open" data-id="${x.t.id}">Thu tiền mặt</button>` : ''}</td></tr>`), { empty: 'Không có nợ quá hạn 🎉' })}${pg.html}</div></div>`;
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

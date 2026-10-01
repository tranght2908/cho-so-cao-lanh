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
    const market = ui.market;
    const p = A.periods && A.periods.resolve ? A.periods.resolve(market, ui.periodId || ui.period) : null;
    const list = A.periods ? A.periods.listForMarket(market) : A.db.billingPeriods;
    const selected = p && (p.marketId === market || !p.marketId) ? p : list[list.length - 1];
    if (selected) { ui.periodId = selected.id; ui.period = A.periods ? A.periods.periodKey(selected) : selected.id; }
    return selected;
  }
  function financeStatusBadge(p) { return p.status === 'COLLECTING' ? '<span class="tag info">● Đang thu</span>' : p.status === 'OPEN' || p.status === 'PREPARING' ? '<span class="tag warn">◌ Đã mở · chưa phát hành</span>' : '<span class="tag">◻ Kỳ trước</span>'; }
  function financeTimeBarRow(label) {
    const p = financePeriod(), list = A.periods ? A.periods.listForMarket(ui.market) : A.db.billingPeriods, idx = list.findIndex(x => x.id === p.id);
    return `<div class="row" style="flex-wrap:wrap">
      <span class="label-sm">${label}</span>
      <div class="row" style="gap:4px">
        <button class="btn sm" data-act="fp-nav" data-d="-1" ${idx <= 0 ? 'disabled' : ''}>‹</button>
        <select class="input" style="width:120px" data-ch="fp-select">${list.map(x => `<option value="${x.id}" ${x.id === p.id ? 'selected' : ''}>${x.label}</option>`).join('')}</select>
        <button class="btn sm" data-act="fp-nav" data-d="1" ${idx >= list.length - 1 ? 'disabled' : ''}>›</button>
      </div>
      ${financeStatusBadge(p)}<span class="small muted">${U.dmy(p.startDate)} – ${U.dmy(p.endDate)}</span></div>`;
  }
  A.CH['fp-select'] = el => { const p = A.periods && A.periods.getById(el.value); ui.periodId = el.value; ui.period = p ? A.periods.periodKey(p) : el.value; A.render(); };
  A.ACT['fp-nav'] = el => {
    const list = A.periods ? A.periods.listForMarket(ui.market) : A.db.billingPeriods, idx = list.findIndex(x => x.id === financePeriod().id), ni = idx + Number(el.dataset.d);
    if (ni >= 0 && ni < list.length) { ui.periodId = list[ni].id; ui.period = A.periods ? A.periods.periodKey(list[ni]) : list[ni].id; A.render(); }
  };

  // ---------- Chỉ số điện, nước (quản lý theo từng kỳ/tháng) ----------
  const abnormal = r => r.elecCur != null && (r.elecCur - r.elecPrev) > r.elecAvg * 1.5;
  const nowStamp = () => U.dmy(U.today()) + ' ' + U.nowTime();
  const PHOTO_URLS = {}; // cache URL.createObjectURL trong phiên xem, không lưu localStorage
  const photoKey = (r, kind) => r.period + '|' + r.stallId + '|' + kind;
  const findReading = (id, period) => A.db.readings.find(x => x.stallId === id && x.period === period);
  const currentPeriod = () => {
    const billing = financePeriod(), list = (A.db.meterPeriods || []).filter(p => p.marketId === ui.market || (!p.marketId && p.id === (billing && billing.period)));
    const idx = list.findIndex(p => p.billingPeriodId === (billing && billing.id) || p.id === (billing && billing.id));
    return idx >= 0 ? list[idx] : list[list.length - 1];
  };
  function periodStatusBadge(p) {
    const state = A.meterPeriodMarketState ? A.meterPeriodMarketState(p, ui.market) : p;
    if (state.status === 'RECORDING') return '<span class="tag info">● Đang ghi</span>';
    if (state.status === 'CLOSED') return '<span class="tag ok">🔒 Đã chốt</span>';
    return '<span class="tag">● Chưa bắt đầu</span>';
  }
  function periodHeaderHtml(p) {
    const list = A.db.meterPeriods, idx = list.findIndex(x => x.id === p.id);
    const state = A.meterPeriodMarketState ? A.meterPeriodMarketState(p, ui.market) : p;
    return `<div class="card"><div class="card-b row" style="padding-top:14px;flex-wrap:wrap">
      <span class="label-sm">Kỳ ghi chỉ số</span>
      <div class="row" style="gap:4px">
        <button class="btn sm" data-act="mp-nav" data-d="-1" ${idx <= 0 ? 'disabled' : ''}>‹</button>
        <select class="input" style="width:150px" data-ch="mp-select">${list.map(x => `<option value="${x.id}" ${x.id === p.id ? 'selected' : ''}>Tháng ${U.per(x.id)}</option>`).join('')}</select>
        <button class="btn sm" data-act="mp-nav" data-d="1" ${idx >= list.length - 1 ? 'disabled' : ''}>›</button>
      </div>
      ${periodStatusBadge(p)}<span class="spacer"></span>
      ${state.status === 'CLOSED' ? `<span class="small muted">Người chốt: <b>${U.esc(state.closedBy || state.completedBy)}</b> · ${U.esc(state.closedAt || state.completedAt)}</span>` : `<span class="small muted">Ngày chốt dự kiến: <b>${U.dmy(p.closeDate)}</b></span>`}
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
    const editable = canEdit && A.meterPeriodMarketState(p, ui.market).status === 'RECORDING';
    return header + `<div class="kpis">
      <div class="card kpi"><div class="k-label">Kỳ ghi chỉ số</div><div class="k-value">${U.per(p.id)}</div><div class="k-sub">${periodStatusBadge(p)}</div></div>
      <div class="card kpi"><div class="k-label">Đã ghi</div><div class="k-value">${done}/${all.length}</div><div class="bar-mini"><i style="width:${U.pct(done, all.length)}%"></i></div></div>
      <div class="card kpi"><div class="k-label">Chưa ghi</div><div class="k-value" style="${todo ? 'color:#df2225' : ''}">${todo}</div><div class="k-sub">điểm kinh doanh</div></div>
      <div class="card kpi"><div class="k-label">Tăng bất thường</div><div class="k-value" style="color:#df2225">${abn}</div><div class="k-sub">> 150% trung bình 3 kỳ</div></div></div>
    <div class="card"><div class="card-h"><h3>Ghi chỉ số điện, nước</h3>
      <div class="seg">${[['all', 'Tất cả'], ['todo', 'Chưa ghi'], ['abn', 'Bất thường']].map(x => `<button class="${ui.readingsFilter === x[0] ? 'on' : ''}" data-act="dn-filter" data-id="${x[0]}">${x[1]}</button>`).join('')}</div>
      <span class="spacer"></span>
      ${A.meterPeriodMarketState(p, ui.market).status === 'RECORDING' && canClose ? `<button class="btn" data-act="dn-close-period">${U.icon('file')}Chốt kỳ</button>` : ''}
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
    if (!mrCanRecord(A.idx.stall.get(el.dataset.id))) { U.toast('Chỉ NV thu phí được phân công điểm này mới ghi chỉ số'); A.render(); return; }
    const period = el.dataset.period, id = el.dataset.id, k = el.dataset.k;
    const p = A.db.meterPeriods.find(x => x.id === period), r = findReading(id, period);
    if (!r || !p || A.meterPeriodMarketState(p, ui.market).status !== 'RECORDING') { A.render(); return; }
    const v = el.value === '' ? null : Number(el.value);
    const prev = k === 'elecCur' ? r.elecPrev : r.waterPrev;
    if (v != null && v < prev) { U.toast('Chỉ số mới không được nhỏ hơn chỉ số cũ (' + prev + ')'); A.render(); return; }
    r[k] = v;
    if (r.elecCur != null && r.waterCur != null) { r.status = 'RECORDED'; r.recordedBy = mrRecorder(); r.recordedAt = nowStamp(); }
    else { r.status = 'PENDING'; r.recordedBy = null; r.recordedAt = null; }
    A.save(); A.render();
    if (k === 'elecCur' && abnormal(r)) U.toast('⚠ Chỉ số điện ' + A.idx.stall.get(r.stallId).code + ' tăng bất thường – đề nghị kiểm tra đồng hồ');
  };
  A.CH['dn-photo-add'] = el => {
    if (!mrCanRecord(A.idx.stall.get(el.dataset.id))) return;
    const file = el.files && el.files[0];
    if (!file) return;
    const period = el.dataset.period, id = el.dataset.id, kind = el.dataset.k;
    const p = A.db.meterPeriods.find(x => x.id === period), r = findReading(id, period);
    if (!r || !p || A.meterPeriodMarketState(p, ui.market).status !== 'RECORDING') return;
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
    if (!p || A.meterPeriodMarketState(p, ui.market).status !== 'RECORDING') { A.closeModal(); A.render(); return; }
    const rows = A.db.readings.filter(r => r.period === p.id && U.inM(A.idx.stall.get(r.stallId)));
    if (rows.some(r => r.status !== 'RECORDED')) { U.toast('Còn điểm kinh doanh chưa ghi chỉ số, chưa thể chốt kỳ'); return; }
    const at = nowStamp();
    p.completionByMarket = Object.assign({}, p.completionByMarket || {}, { [ui.market]: { status: 'CLOSED', completedBy: 'Trần Minh Khoa', completedAt: at, closedBy: 'Trần Minh Khoa', closedAt: at } });
    U.log('Chốt kỳ ghi chỉ số điện, nước ' + U.per(p.id));
    A.save(); A.closeModal(); A.render();
    U.toast('Đã chốt kỳ ' + U.per(p.id));
  };
  A.ACT['dn-detail'] = el => {
    const period = el.dataset.period, id = el.dataset.id;
    const r = findReading(id, period), st = A.idx.stall.get(id), t = A.idx.trader.get(st.traderId);
    const p = A.db.meterPeriods.find(x => x.id === period);
    const canAdjust = A.meterPeriodIsClosed(p, ui.market) && A.canDo('dien-nuoc.yeu-cau-dieu-chinh', ui.market);
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
    if (!A.canDo('dien-nuoc.yeu-cau-dieu-chinh', ui.market) || !p || !A.meterPeriodIsClosed(p, ui.market)) return;
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
    if (!A.canDo('dien-nuoc.yeu-cau-dieu-chinh', ui.market) || !p || !A.meterPeriodIsClosed(p, ui.market)) return;
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

  // ---------- GHI_CHI_SO_THEO_MARKET_SCOPE ----------
  // NV thu phí ghi chỉ số cho Point thuộc Market đang chọn khi RBAC và marketScopes cho phép.
  const mrMe = () => A.currentAccount() || null;
  const mrCanRecord = st => { const acc = mrMe(); return !!(st && acc && st.market === ui.market && A.allowedMarkets(acc).indexOf(st.market) !== -1 && A.canDo('dien-nuoc.ghi-chi-so', st.market)); };
  const mrRecorder = () => { const acc = mrMe(); return acc ? (acc.code || acc.id) : null; };
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
    A.modal(A.mHead((item.current == null ? 'Ghi chỉ số ' : 'Chi tiết chỉ số ') + item.cfg.label + ' · ' + item.st.code) + `<div class="modal-b meter-modal"><section class="meter-section"><h4>A. THÔNG TIN ĐIỂM KINH DOANH</h4><dl class="kv"><dt>Điểm KD</dt><dd><b>${item.st.code}</b></dd><dt>Tiểu thương</dt><dd>${item.trader ? U.esc(item.trader.name) + ' · ' + item.trader.id : 'Chưa có'}</dd><dt>Khu vực</dt><dd>${U.esc(item.st.sectionName)}</dd><dt>Kỳ ghi số</dt><dd>Tháng ${U.per(item.r.period)}</dd></dl></section><section class="meter-section"><h4>B. THÔNG TIN ĐỒNG HỒ</h4><dl class="kv"><dt>Loại</dt><dd>${item.cfg.label}</dd><dt>Mã đồng hồ</dt><dd><b>${item.meterId}</b></dd><dt>Đơn vị</dt><dd>${item.cfg.unit}</dd></dl></section><section class="meter-section"><h4>C. CHỈ SỐ KỲ TRƯỚC</h4><dl class="kv"><dt>Kỳ</dt><dd>${prior ? 'Tháng ' + U.per(prior.period) : 'Chưa có kỳ trước'}</dd><dt>Ngày ghi</dt><dd>${prevDate || '—'}</dd><dt>Chỉ số cũ</dt><dd><b>${prevRead == null ? 'Chưa có chỉ số kỳ trước' : Number(prevRead).toLocaleString('vi-VN') + ' ' + item.cfg.unit}</b></dd><dt>Ảnh kỳ trước</dt><dd>${prior && prior[item.cfg.photo] ? '<span class="tag ok">Có ảnh</span>' : '—'}</dd></dl></section><section class="meter-section"><h4>D. CHỈ SỐ KỲ NÀY</h4><div class="form-grid"><div class="field"><label>Ngày ghi</label><input class="input" value="${U.today()}" disabled></div><div class="field"><label>Chỉ số mới *</label><input class="input" id="mr-current" type="number" min="0" value="${mrDraft.current == null ? '' : mrDraft.current}" ${p.status !== 'RECORDING' || !mrCanRecord(item.st) ? 'disabled' : ''}></div></div><div class="meter-consumption ${invalid ? 'danger' : ''}">${invalid ? 'Chỉ số mới nhỏ hơn chỉ số kỳ trước. Vui lòng kiểm tra lại số ghi hoặc đồng hồ.' : diff == null ? 'Nhập chỉ số mới để hệ thống tính sản lượng tiêu thụ.' : `${Number(mrDraft.current).toLocaleString('vi-VN')} − ${Number(prevRead).toLocaleString('vi-VN')} = <b>${diff.toLocaleString('vi-VN')} ${item.cfg.unit}</b>`}</div></section><section class="meter-section"><h4>E. ẢNH ĐỒNG HỒ</h4>${mrDraft.evidence ? `<div class="meter-evidence">${U.icon('file')}<span><b>${U.esc(mrDraft.evidence.name)}</b><small>${mrDraft.evidence.addedAt || nowStamp()} · metadata mock</small></span><button class="btn sm" data-act="mr-evidence-view">Xem</button><button class="btn sm danger" data-act="mr-evidence-remove">Xóa</button></div>` : '<div class="note">Chưa có ảnh minh chứng. Ảnh không bắt buộc trong Prototype V1.</div>'}${p.status === 'RECORDING' && mrCanRecord(item.st) ? '<button class="btn sm" style="margin-top:8px" data-act="mr-evidence-add">+ Chụp / thêm ảnh</button>' : ''}</section><section class="meter-section"><h4>F. GHI CHÚ</h4><textarea class="input" id="mr-note" rows="2" placeholder="Đồng hồ khó đọc, tiểu thương vắng mặt..."></textarea></section></div><div class="modal-f"><button class="btn" data-act="close">Hủy</button>${p.status === 'RECORDING' && mrCanRecord(item.st) ? `<button class="btn primary" data-act="mr-save" data-id="${item.st.id}" data-period="${item.r.period}" data-kind="${item.kind}">Lưu chỉ số</button>` : ''}</div>`, true);
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
  A.CH['mr-collector'] = el => { if (!U.can('dien-nuoc')) return; f.mrCollector = el.value; A.render(); };
  A.ACT['mr-status'] = el => { f.mrStatus = el.dataset.id; A.render(); };
  A.ACT['mr-open'] = el => { const r = findReading(el.dataset.id, el.dataset.period); if (r) mrOpen(mrItem(r, el.dataset.kind)); };
  A.ACT['mr-evidence-add'] = () => { const input = document.createElement('input'); input.type = 'file'; input.accept = 'image/*,.pdf'; input.style.display = 'none'; document.body.appendChild(input); input.onchange = () => { if (input.files[0] && mrDraft) mrDraft.evidence = { name: input.files[0].name, type: input.files[0].type, size: input.files[0].size, addedAt: nowStamp(), mock: true }; input.remove(); const r=findReading(mrDraft.stallId,mrDraft.period); mrOpen(mrItem(r,mrDraft.kind)); }; input.click(); };
  A.ACT['mr-evidence-remove'] = () => { if (!mrDraft) return; mrDraft.evidence = null; const r=findReading(mrDraft.stallId,mrDraft.period); mrOpen(mrItem(r,mrDraft.kind)); };
  A.ACT['mr-evidence-view'] = () => { if (mrDraft && mrDraft.evidence) A.modal(A.mHead('Ảnh đồng hồ') + `<div class="modal-b"><div class="empty">${U.icon('file')}<br>${U.esc(mrDraft.evidence.name)}<div class="small muted">Ảnh/file metadata mock — không có storage thật.</div></div></div><div class="modal-f"><button class="btn" data-act="close">Đóng</button></div>`); };
  A.ACT['mr-save'] = el => { const r=findReading(el.dataset.id,el.dataset.period), p=A.db.meterPeriods.find(x=>x.id===el.dataset.period), item=r&&mrItem(r,el.dataset.kind), input=A.$('#mr-current'); if(!r||!p||!item||!input||p.status!=='RECORDING'||!mrCanRecord(item.st))return; const current=input.value===''?null:Number(input.value); if(current==null||!Number.isFinite(current))return U.toast('Vui lòng nhập chỉ số mới.'); if(item.previous!=null&&current<item.previous)return U.toast('Chỉ số mới nhỏ hơn chỉ số kỳ trước. Cần xác nhận quy trình reset/thay đồng hồ.'); r[item.cfg.cur]=current; r[item.cfg.photo]=mrDraft&&mrDraft.evidence?mrDraft.evidence:r[item.cfg.photo]; r.note=A.$('#mr-note').value.trim(); r.recordedBy=mrRecorder(); r.recordedAt=nowStamp(); r.status=r.elecCur!=null&&r.waterCur!=null?'RECORDED':'PENDING'; A.save(); A.closeModal(); A.render(); if(mrAbnormal(mrItem(r,item.kind)))U.toast('⚠ Tiêu thụ bất thường — vui lòng kiểm tra chỉ số và ảnh đồng hồ.'); else U.toast('Đã lưu chỉ số '+item.cfg.label+' cho '+item.st.code); };
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
    A.modal(A.mHead('GHI CHỈ SỐ ' + item.cfg.label.toUpperCase() + ' · ' + item.st.code) + `<div class="modal-b mr-v2-modal"><div class="small muted" style="margin-top:-5px">${item.trader?U.esc(item.trader.name)+' · '+item.trader.id:'Chưa có tiểu thương'} · Kỳ ${U.per(item.r.period)}</div><section class="meter-section"><h4>A. THÔNG TIN</h4><dl class="kv"><dt>Điểm KD</dt><dd><b>${item.st.code}</b></dd><dt>Tiểu thương</dt><dd>${item.trader?U.esc(item.trader.name)+' · '+item.trader.id:'—'}</dd><dt>Mã ${item.kind==='elec'?'công tơ':'đồng hồ'}</dt><dd><b>${item.meterId}</b></dd><dt>Kỳ ghi số</dt><dd>Tháng ${U.per(item.r.period)}</dd></dl></section><section class="meter-section"><h4>B. CHỈ SỐ KỲ TRƯỚC</h4><dl class="kv"><dt>Chỉ số kỳ trước</dt><dd><b>${previous==null?'Chưa có chỉ số kỳ trước':Number(previous).toLocaleString('vi-VN')+' '+item.cfg.unit}</b></dd><dt>Ngày ghi</dt><dd>${prior?prior.recordedAt||'—':'—'}</dd><dt>Ảnh kỳ trước</dt><dd>${prior&&prior[item.cfg.photo]?'<span class="tag ok">Có ảnh</span>':'—'}</dd></dl></section><section class="meter-section"><h4>C. CHỈ SỐ KỲ NÀY</h4><div class="form-grid"><div class="field"><label>Chỉ số mới *</label><input id="mr-current" class="input" type="number" min="0" value="${mrDraft.current==null?'':mrDraft.current}" ${p.status!=='RECORDING'||!mrCanRecord(item.st)?'disabled':''}></div><div class="field"><label>Sản lượng tiêu thụ</label><input class="input" disabled value="${diff==null?'Tự tính sau khi nhập':diff+' '+item.cfg.unit}"></div></div><div class="meter-consumption ${invalid?'danger':''}">${invalid?'Chỉ số mới nhỏ hơn chỉ số kỳ trước. Vui lòng kiểm tra lại chỉ số hoặc đồng hồ.':diff===0?'Không phát sinh tiêu thụ trong kỳ.':diff==null?'Sản lượng = chỉ số mới − chỉ số kỳ trước.':`${Number(mrDraft.current).toLocaleString('vi-VN')} − ${Number(previous).toLocaleString('vi-VN')} = <b>${diff.toLocaleString('vi-VN')} ${item.cfg.unit}</b>`}</div>${abnormalNow?'<div class="note" style="margin-top:8px">⚠ Mức tiêu thụ kỳ này có dấu hiệu bất thường so với mức trung bình. Vui lòng kiểm tra chỉ số và ảnh đồng hồ.</div>':''}</section><section class="meter-section"><h4>D. ẢNH ĐỒNG HỒ</h4>${preview}<div class="row" style="margin-top:8px">${p.status==='RECORDING'&&mrCanRecord(item.st)?`<button class="btn sm" data-act="mr-evidence-add">${mrDraft.evidence?'Thay ảnh':'Chọn ảnh từ thiết bị'}</button>`:''}${mrDraft.evidence?'<button class="btn sm danger" data-act="mr-evidence-remove">Xóa ảnh</button>':''}</div></section><section class="meter-section"><h4>E. GHI CHÚ</h4><textarea id="mr-note" class="input" rows="2" placeholder="Đồng hồ khó đọc, tiểu thương vắng mặt..."></textarea></section></div><div class="modal-f"><button class="btn" data-act="close">Hủy</button>${p.status==='RECORDING'&&mrCanRecord(item.st)?`<button class="btn primary" data-act="mr-save" data-id="${item.st.id}" data-period="${item.r.period}" data-kind="${item.kind}">Lưu chỉ số</button>`:''}</div>`,true);
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
  // HINH_THUC_THU_DIEN_NUOC: chợ thu điện, nước chia đều như dịch vụ → không ghi chỉ số.
  const mrServiceMode = () => A.SERVICE_CFG && A.SERVICE_CFG.utilityMode(ui.market) === 'SERVICE';
  A.VIEWS['dien-nuoc'] = function () {
    if (mrServiceMode()) return `<div class="card meter-title"><div class="card-b"><h2>GHI CHỈ SỐ ĐIỆN, NƯỚC</h2><p>${U.esc(U.market(ui.market).name)} đang thu điện, nước theo hình thức <b>chia đều – thu như dịch vụ chợ</b>, nên không ghi chỉ số công tơ.</p>
      <div class="note info">Tiền điện, nước được khai báo ở Tài chính › Chính sách thu và biểu phí › Dịch vụ chợ và tự vào khoản phải thu khi Trưởng Ban tính/phát hành. Hình thức thu do Quản trị hệ thống cấu hình (tab Điện & nước).</div></div></div>`;
    const p=currentPeriod(), q=(f.mrSearch||'').toLowerCase(), filter=f.mrStatus||'all';
    const groups=A.db.readings.filter(r=>r.period===p.id&&U.inM(A.idx.stall.get(r.stallId))).map(r=>({r,st:A.idx.stall.get(r.stallId),elec:mrItem(r,'elec'),water:mrItem(r,'water')}));
    const match=g=>!q||[g.st.code,g.st.traderId&&A.idx.trader.get(g.st.traderId)&&A.idx.trader.get(g.st.traderId).name,g.st.traderId,mrCode(g.st,'elec'),mrCode(g.st,'water')].join(' ').toLowerCase().includes(q);
    const rows=groups.filter(g=>match(g)&&(filter==='all'||(filter==='PENDING'?(g.elec.current==null||g.water.current==null):filter==='RECORDED'?(g.elec.current!=null&&g.water.current!=null):mrPointState(g)===filter)));
    const total=groups.length, done=groups.filter(g=>g.elec.current!=null&&g.water.current!=null).length, incomplete=total-done, abnormalCount=groups.filter(g=>mrPointState(g)==='ABNORMAL').length, pg=U.pager('mrpoint'+p.id+filter,rows.length,20);
    const kpi=(title,val,status,danger)=>`<button class="card kpi" data-act="mr-status" data-id="${status}" style="text-align:left"><div class="k-label">${title}</div><div class="k-value" ${danger?'style="color:#df2225"':''}>${val}</div>${title==='Tổng điểm cần ghi'?`<div class="k-sub">${total} điểm · ${total*2} đồng hồ</div>`:''}</button>`;
    return `<div class="card meter-title"><div class="card-b"><h2>GHI CHỈ SỐ ĐIỆN, NƯỚC</h2><p>Theo dõi và ghi nhận chỉ số điện, nước theo từng kỳ, kèm ảnh đồng hồ và cảnh báo tiêu thụ bất thường.</p></div></div>${periodHeaderHtml(p)}<div class="kpis">${kpi('Tổng điểm cần ghi',total,'all')}${kpi('Đã ghi đủ',done,'RECORDED')}${kpi('Chưa ghi đủ',incomplete,'PENDING',true)}${kpi('Bất thường',abnormalCount,'ABNORMAL',true)}</div><div class="card"><div class="card-h"><div class="seg">${[['all','Tất cả'],['PENDING','Chưa ghi đủ'],['RECORDED','Đã ghi đủ'],['ABNORMAL','Bất thường']].map(x=>`<button class="${filter===x[0]?'on':''}" data-act="mr-status" data-id="${x[0]}">${x[1]}</button>`).join('')}</div><span class="spacer"></span><input class="input meter-search" data-in="mr-search" placeholder="Tìm mã điểm, tiểu thương, mã đồng hồ..." value="${U.esc(f.mrSearch||'')}">${p.status==='RECORDING'&&A.canDo('dien-nuoc.chot-ky',ui.market)?'<button class="btn" data-act="dn-close-period">Chốt kỳ</button>':''}</div><div class="card-b">${U.table([{t:'Điểm KD'},{t:'Mã tiểu thương'},{t:'Tên tiểu thương'},{t:'Chỉ số điện kỳ này'},{t:'Chỉ số nước kỳ này'},{t:'Cảnh báo'},{t:'Trạng thái'},{t:'Thao tác'}],rows.slice(pg.start,pg.end).map(g=>{const state=mrPointState(g),t=g.st.traderId?A.idx.trader.get(g.st.traderId):null,warning=mrAbnormal(g.elec)&&mrAbnormal(g.water)?'⚠ Điện & nước cần kiểm tra':mrAbnormal(g.elec)?'⚠ Điện bất thường':mrAbnormal(g.water)?'⚠ Nước bất thường':'—',action=!mrCanRecord(g.st)?'<button class="btn sm" data-act="mr-point-detail" data-id="'+g.st.id+'" data-period="'+p.id+'">Xem</button>':state==='PENDING'?'<button class="btn sm primary" data-act="mr-point-open" data-id="'+g.st.id+'" data-period="'+p.id+'">Ghi chỉ số</button>':state==='MISSING_ELEC'?'<button class="btn sm primary" data-act="mr-open" data-id="'+g.st.id+'" data-period="'+p.id+'" data-kind="elec">Ghi điện</button>':state==='MISSING_WATER'?'<button class="btn sm primary" data-act="mr-open" data-id="'+g.st.id+'" data-period="'+p.id+'" data-kind="water">Ghi nước</button>':'<button class="btn sm" data-act="mr-point-detail" data-id="'+g.st.id+'" data-period="'+p.id+'">'+(state==='ABNORMAL'?'Kiểm tra':'Xem')+'</button>';return `<tr><td><b>${g.st.code}</b></td><td>${t?t.id:'<span class="muted">—</span>'}</td><td>${t?U.esc(t.name):'<span class="muted">Chưa có tiểu thương</span>'}</td><td>⚡ ${mrValueCell(g.elec)}</td><td>💧 ${mrValueCell(g.water)}</td><td>${warning==='—'?'<span class="muted">—</span>':'<span class="tag warn">'+warning+'</span>'}</td><td>${mrPointLabel(state)}</td><td>${action}</td></tr>`;}))}${pg.html}<div class="small muted" style="margin-top:8px">Một điểm kinh doanh hiển thị một dòng; điện và nước vẫn là hai reading độc lập.</div></div></div>`;
  };
  A.ACT['mr-point-open']=el=>{const r=findReading(el.dataset.id,el.dataset.period);if(!r)return;const e=mrItem(r,'elec'),w=mrItem(r,'water');A.modal(A.mHead('Ghi chỉ số · '+e.st.code)+`<div class="modal-b"><p>Chọn loại đồng hồ cần ghi cho <b>${e.st.code}</b>.</p><div class="row"><button class="btn primary" data-act="mr-open" data-id="${e.st.id}" data-period="${r.period}" data-kind="elec">⚡ Ghi điện</button><button class="btn primary" data-act="mr-open" data-id="${e.st.id}" data-period="${r.period}" data-kind="water">💧 Ghi nước</button></div></div><div class="modal-f"><button class="btn" data-act="close">Đóng</button></div>`);};
  A.ACT['mr-point-detail']=el=>{const r=findReading(el.dataset.id,el.dataset.period);if(!r)return;const e=mrItem(r,'elec'),w=mrItem(r,'water'),card=x=>{const c=mrConsumption(x),his=A.db.readings.filter(y=>y.stallId===x.st.id).sort((a,b)=>b.period.localeCompare(a.period));return `<section class="meter-section"><h4>${x.kind==='elec'?'⚡ ĐIỆN':'💧 NƯỚC'}</h4><dl class="kv"><dt>Mã đồng hồ</dt><dd>${x.meterId}</dd><dt>Chỉ số kỳ trước</dt><dd>${x.previous} ${x.cfg.unit}</dd><dt>Chỉ số kỳ này</dt><dd><b>${x.current==null?'—':x.current+' '+x.cfg.unit}</b></dd><dt>Sản lượng</dt><dd>${c==null?'—':x.current+' − '+x.previous+' = '+c+' '+x.cfg.unit}</dd><dt>Cảnh báo</dt><dd>${mrAbnormal(x)?'<span class="tag warn">Bất thường</span>':'Bình thường'}</dd></dl><div class="mr-detail-preview">${PHOTO_URLS[mrPreviewKey(x)]?`<img src="${PHOTO_URLS[mrPreviewKey(x)]}">`:(mrPhoto(x)?'📷 '+U.esc(mrPhoto(x).name):'Chưa có ảnh')}</div><h4 style="margin-top:12px">LỊCH SỬ ${x.cfg.label.toUpperCase()}</h4>${U.table([{t:'Kỳ'},{t:'Chỉ số cũ'},{t:'Chỉ số mới'},{t:'Tiêu thụ'},{t:'Ảnh'}],his.map(y=>{const z=mrItem(y,x.kind),v=mrConsumption(z);return `<tr><td>${U.per(y.period)}</td><td>${z.previous}</td><td>${z.current==null?'—':z.current}</td><td>${v==null?'—':v+' '+x.cfg.unit}</td><td>${mrPhoto(z)?'📷':'—'}</td></tr>`}))}</section>`;};A.modal(A.mHead('CHI TIẾT GHI CHỈ SỐ · '+e.st.code+' · Kỳ '+U.per(r.period))+`<div class="modal-b meter-modal">${card(e)}${card(w)}</div><div class="modal-f"><button class="btn" data-act="close">Đóng</button></div>`,true);};
  A.ACT['mr-evidence-add']=()=>{if(!mrDraft)return;const item=mrItem(findReading(mrDraft.stallId,mrDraft.period),mrDraft.kind);if(!mrCanRecord(item.st))return;const input=document.createElement('input');input.type='file';input.accept='image/*';input.style.display='none';document.body.appendChild(input);input.onchange=()=>{const file=input.files&&input.files[0];if(file){mrDraft.evidence={name:file.name,type:file.type,size:file.size,addedAt:nowStamp(),mock:true};mrDraft.preview=URL.createObjectURL(file);PHOTO_URLS[mrPreviewKey(item)]=mrDraft.preview;}input.remove();mrOpenV2(item);};input.click();};
  A.ACT['mr-evidence-remove']=()=>{if(!mrDraft)return;const item=mrItem(findReading(mrDraft.stallId,mrDraft.period),mrDraft.kind);delete PHOTO_URLS[mrPreviewKey(item)];mrDraft.evidence=null;mrDraft.preview=null;mrOpenV2(item);};
  // ---------- Meter reading workflow V3: one business point per row, two independent readings ----------
  let mrV3Draft = null;
  const mrV3Billing = id => (A.db.billingPeriods || []).find(x => x.id === id) || null;
  // Meter period is shared by month, but completion/lock belongs to one market.
  // Legacy records without completionByMarket retain their global metadata as a fallback.
  A.meterPeriodMarketState = function (p, market) {
    const scoped = p && p.completionByMarket && p.completionByMarket[market];
    return scoped || { status: (p && p.status) || 'PENDING', completedBy: p && p.completedBy, completedAt: p && p.completedAt, closedBy: p && p.closedBy, closedAt: p && p.closedAt, legacyGlobal: true };
  };
  A.meterPeriodIsClosed = (p, market) => A.meterPeriodMarketState(p, market).status === 'CLOSED';
  const mrPeriodState = p => A.meterPeriodMarketState(p, ui.market);
  const mrPeriodClosed = p => A.meterPeriodIsClosed(p, ui.market);
  const mrV3PeriodState = p => mrPeriodClosed(p) ? 'CLOSED' : (mrPeriodState(p).status === 'RECORDING' || ((mrV3Billing(p.id) || {}).status === 'PREPARING') ? 'RECORDING' : 'PENDING');
  const mrV3PeriodLabel = p => mrV3PeriodState(p) === 'CLOSED' ? '<span class="tag ok">Đã hoàn tất</span>' : mrV3PeriodState(p) === 'RECORDING' ? '<span class="tag info">Đang ghi</span>' : '<span class="tag">Chưa bắt đầu</span>';
  const mrV3Contract = st => (A.db.contracts || []).find(c => (c.businessPointId || c.stallId) === st.id && c.status === 'hieuluc');
  function mrV3EnsureRows(p) {
    let changed = false;
    A.db.stalls.filter(st => U.inM(st) && st.hasMeter && mrV3Contract(st)).forEach(st => {
      if (findReading(st.id, p.id)) return;
      const prior = (A.db.readings || []).filter(r => r.stallId === st.id && r.period < p.id).sort((a, b) => b.period.localeCompare(a.period))[0];
      A.db.readings.push({ stallId: st.id, period: p.id, elecPrev: prior ? prior.elecCur : null, elecCur: null, elecAvg: prior ? prior.elecAvg : 0, waterPrev: prior ? prior.waterCur : null, waterCur: null, waterAvg: prior ? prior.waterAvg : 0, status: 'PENDING', recordedBy: null, recordedAt: null, elecPhoto: null, waterPhoto: null });
      changed = true;
    });
    if (changed) A.save();
  }
  const mrV3Groups = p => { mrV3EnsureRows(p); return (A.db.readings || []).filter(r => r.period === p.id && U.inM(A.idx.stall.get(r.stallId))).map(r => ({ r, st: A.idx.stall.get(r.stallId), elec: mrItem(r, 'elec'), water: mrItem(r, 'water') })).filter(x => x.st); };
  function mrV3State(g) {
    const e = g.elec.current != null, w = g.water.current != null;
    if (!e || !w) return 'NOT_RECORDED';
    if (g.r.reviewRequired || ((mrAbnormal(g.elec) || mrAbnormal(g.water)) && !g.r.reviewedAt)) return 'NEEDS_REVIEW';
    return 'RECORDED';
  }
  const mrV3Tag = state => ({ NOT_RECORDED: '<span class="tag">Chưa ghi</span>', PARTIAL: '<span class="tag warn">Chưa ghi đủ</span>', RECORDED: '<span class="tag ok">Đã ghi</span>', NEEDS_REVIEW: '<span class="tag warn">Cần kiểm tra</span>' })[state];
  const mrV3Number = v => v == null ? '—' : Number(v).toLocaleString('vi-VN');
  const mrV3Consumption = item => { const v = mrConsumption(item); return v == null ? '—' : mrV3Number(v) + ' ' + item.cfg.unit; };
  const mrV3Warning = g => { const kinds = [mrAbnormal(g.elec) && 'Tiêu thụ điện tăng cao so với kỳ trước', mrAbnormal(g.water) && 'Tiêu thụ nước tăng cao so với kỳ trước'].filter(Boolean); return kinds.length ? `<span class="tag warn">${U.esc(kinds.join(' · '))}</span>` : '<span class="muted">—</span>'; };
  const mrV3Editable = p => mrV3PeriodState(p) === 'RECORDING';
  function mrV3Open(stallId, period) {
    const r = findReading(stallId, period), st = A.idx.stall.get(stallId), p = A.db.meterPeriods.find(x => x.id === period), trader = st && st.traderId ? A.idx.trader.get(st.traderId) : null, contract = st && mrV3Contract(st);
    if (!r || !st || !p) return;
    const editable = mrV3Editable(p) && mrCanRecord(st), elec = mrItem(r, 'elec'), water = mrItem(r, 'water'), needsReview = elec.current != null && water.current != null && (mrAbnormal(elec) || mrAbnormal(water)) && !r.reviewedAt;
    mrV3Draft = { stallId, period, photos: { elec: mrPhoto(elec), water: mrPhoto(water) } };
    const meter = item => { const prior = mrPreviousHistory(item), prev = prior ? prior[item.cfg.cur] : item.previous, previousDate = prior ? prior.recordedAt : '—', current = item.current, diff = current == null || prev == null ? null : current - prev; return `<section class="meter-section"><h4>${item.kind === 'elec' ? 'ĐIỆN' : 'NƯỚC'}</h4><dl class="kv"><dt>Chỉ số kỳ trước</dt><dd><b>${mrV3Number(prev)} ${item.cfg.unit}</b></dd><dt>Ngày ghi kỳ trước</dt><dd>${previousDate || '—'}</dd></dl><div class="field"><label>Chỉ số kỳ này (${item.cfg.unit})</label><input class="input" id="mrv3-${item.kind}" data-in="mrv3-value" data-kind="${item.kind}" type="number" min="0" value="${current == null ? '' : current}" ${editable ? '' : 'disabled'}></div><div id="mrv3-${item.kind}-result" class="meter-consumption ${diff != null && diff < 0 ? 'danger' : ''}">${diff == null ? 'Nhập chỉ số để tính sản lượng.' : `${mrV3Number(current)} − ${mrV3Number(prev)} = <b>${mrV3Number(diff)} ${item.cfg.unit}</b>`}</div><div class="row" style="margin-top:8px;gap:8px">${mrV3Draft.photos[item.kind] ? `<span class="tag ok">Có ảnh: ${U.esc(mrV3Draft.photos[item.kind].name)}</span>` : '<span class="small muted">Chưa có ảnh đồng hồ</span>'}${editable ? `<button class="btn sm" data-act="mr-v3-photo" data-kind="${item.kind}">Chọn ảnh</button>` : ''}</div></section>`; };
    A.modal(A.mHead('Ghi chỉ số điện, nước') + `<div class="modal-b meter-modal"><div class="small muted">Điểm KD: <b>${U.esc(st.code)}</b> · Tiểu thương: ${trader ? U.esc(trader.name) : '—'} · Hợp đồng: ${contract ? U.esc(contract.id) : '—'} · Kỳ thu: ${U.per(period)}</div>${meter(elec)}${meter(water)}${needsReview ? '<div class="note warn">Chỉ số có dấu hiệu cần kiểm tra. Xác nhận sau khi đã rà soát thực tế.</div>' : ''}<section class="meter-section"><h4>GHI CHÚ</h4><textarea id="mrv3-note" class="input" rows="2" ${editable ? '' : 'disabled'}>${U.esc(r.note || '')}</textarea></section></div><div class="modal-f"><button class="btn" data-act="close">Hủy</button>${needsReview && editable ? `<button class="btn" data-act="mr-v3-review-confirm" data-id="${stallId}" data-period="${period}">Đã kiểm tra chỉ số</button>` : ''}${editable ? `<button class="btn primary" data-act="mr-v3-save" data-id="${stallId}" data-period="${period}">Lưu chỉ số</button>` : ''}</div>`, true);
  }
  A.VIEWS['dien-nuoc'] = function () {
    const p = currentPeriod(); if (!p) return '<div class="empty">Chưa có kỳ thu.</div>';
    const bill = mrV3Billing(p.id), groups = mrV3Groups(p), state = f.mrStatus || 'all', q = (f.mrSearch || '').toLowerCase();
    const rows = groups.filter(g => { const s = mrV3State(g), c = mrV3Contract(g.st); return (state === 'all' || s === state) && (!q || [g.st.code, g.st.traderId && (A.idx.trader.get(g.st.traderId) || {}).name, c && c.id].join(' ').toLowerCase().includes(q)); });
    const total = groups.length, done = groups.filter(g => mrV3State(g) === 'RECORDED').length, partial = groups.filter(g => ['NOT_RECORDED', 'PARTIAL'].includes(mrV3State(g))).length, review = groups.filter(g => mrV3State(g) === 'NEEDS_REVIEW').length, editable = mrV3Editable(p), canClose = A.canDo('dien-nuoc.chot-ky', ui.market), acc = mrMe(), responsible = acc && A.canDo('dien-nuoc.ghi-chi-so', ui.market) ? (acc.fullName || acc.code) : 'Theo phân công điểm KD', canComplete = editable && canClose && total > 0 && done === total;
    const kpi = (label, value, filter) => `<button class="card kpi" data-act="mr-status" data-id="${filter}" style="text-align:left"><div class="k-label">${label}</div><div class="k-value">${value}</div></button>`;
    const day = (bill && bill.meterReadDate) || p.closeDate || '—', periodOptions = (A.db.meterPeriods || []).slice().sort((a, b) => b.id.localeCompare(a.id)).map(x => `<option value="${x.id}" ${x.id === p.id ? 'selected' : ''}>${U.per(x.id)}</option>`).join('');
    const market = U.market(ui.market) || {};
    return `<div class="card meter-title"><div class="card-b"><h2>Chỉ số điện, nước</h2><p>Ghi nhận chỉ số điện, nước theo từng điểm kinh doanh trong kỳ thu.</p><div class="row" style="margin-top:12px"><label class="small">Kỳ thu</label><select class="input" style="min-width:130px" data-ch="mp-select">${periodOptions}</select></div><dl class="kv" style="margin-top:12px"><dt>Kỳ thu</dt><dd><b>${U.per(p.id)}</b></dd><dt>Chợ</dt><dd>${U.esc(market.name || ui.market || '—')}</dd><dt>Ngày ghi chỉ số</dt><dd>${day === '—' ? day : U.dmy(day)}</dd><dt>NV phụ trách</dt><dd>${U.esc(responsible)}</dd><dt>Trạng thái ghi chỉ số</dt><dd>${mrV3PeriodLabel(p)}</dd>${mrV3PeriodState(p) === 'CLOSED' ? `<dt>Đã hoàn tất bởi</dt><dd>${U.esc(p.closedBy || p.completedBy || '—')} · ${U.esc(p.closedAt || p.completedAt || '—')}</dd>` : ''}</dl></div></div><div class="kpis">${kpi('Điểm cần ghi', total, 'all')}${kpi('Đã ghi đủ', done, 'RECORDED')}${kpi('Chưa ghi đủ', partial, 'PARTIAL')}${kpi('Cần kiểm tra', review, 'NEEDS_REVIEW')}</div><div class="card"><div class="card-h"><div class="seg">${[['all','Tất cả'],['NOT_RECORDED','Chưa ghi'],['RECORDED','Đã ghi'],['NEEDS_REVIEW','Cần kiểm tra']].map(x => `<button class="${state === x[0] ? 'on' : ''}" data-act="mr-status" data-id="${x[0]}">${x[1]}</button>`).join('')}</div><span class="spacer"></span><input class="input meter-search" data-in="mr-search" placeholder="Tìm mã điểm, tiểu thương, mã hợp đồng..." value="${U.esc(f.mrSearch || '')}">${editable && canClose ? `<button class="btn primary" data-act="mr-v3-complete-open" ${canComplete ? '' : 'disabled'}>Hoàn tất ghi chỉ số</button>` : ''}</div><div class="card-b">${U.table([{t:'Điểm KD'},{t:'Tiểu thương'},{t:'Điện kỳ trước',num:true},{t:'Điện kỳ này',num:true},{t:'Tiêu thụ điện',num:true},{t:'Nước kỳ trước',num:true},{t:'Nước kỳ này',num:true},{t:'Tiêu thụ nước',num:true},{t:'Cảnh báo'},{t:'Trạng thái'},{t:'Thao tác'}], rows.map(g => { const s = mrV3State(g), tr = g.st.traderId && A.idx.trader.get(g.st.traderId), action = editable && mrCanRecord(g.st) ? `<button class="btn sm ${s === 'NOT_RECORDED' ? 'primary' : ''}" data-act="mr-v3-open" data-id="${g.st.id}" data-period="${p.id}">${s === 'NOT_RECORDED' ? 'Ghi chỉ số' : 'Xem/Sửa'}</button>` : `<button class="btn sm" data-act="mr-v3-open" data-id="${g.st.id}" data-period="${p.id}">Xem</button>`; return `<tr><td><b>${U.esc(g.st.code)}</b></td><td>${tr ? U.esc(tr.name) + '<div class="small muted">' + U.esc(tr.id) + '</div>' : '—'}</td><td class="num">${mrV3Number(g.elec.previous)}</td><td class="num">${mrV3Number(g.elec.current)}</td><td class="num">${mrV3Consumption(g.elec)}</td><td class="num">${mrV3Number(g.water.previous)}</td><td class="num">${mrV3Number(g.water.current)}</td><td class="num">${mrV3Consumption(g.water)}</td><td>${mrV3Warning(g)}</td><td>${mrV3Tag(s)}</td><td>${action}</td></tr>`; }), { empty: 'Không có điểm kinh doanh cần ghi chỉ số trong phạm vi này.' })}<div class="small muted" style="margin-top:8px">Màn này chỉ lưu chỉ số và sản lượng; không tính tiền hoặc tạo khoản phải thu.</div></div></div>`;
  };
  A.ACT['mr-status'] = el => { f.mrStatus = el.dataset.id; A.render(); };
  A.ACT['mr-v3-open'] = el => mrV3Open(el.dataset.id, el.dataset.period);
  A.IN['mrv3-value'] = el => { const kind = el.dataset.kind, r = findReading(mrV3Draft.stallId, mrV3Draft.period), prev = r[kind === 'elec' ? 'elecPrev' : 'waterPrev'], current = el.value === '' ? null : Number(el.value), out = A.$('#mrv3-' + kind + '-result'); if (!out) return; if (current != null && prev != null && current < prev) out.innerHTML = 'Chỉ số kỳ này không được nhỏ hơn chỉ số kỳ trước.'; else out.innerHTML = current == null || prev == null ? 'Nhập chỉ số để tính sản lượng.' : `${mrV3Number(current)} − ${mrV3Number(prev)} = <b>${mrV3Number(current - prev)} ${kind === 'elec' ? 'kWh' : 'm³'}</b>`; };
  A.ACT['mr-v3-photo'] = el => { if (!mrV3Draft) return; const input = document.createElement('input'); input.type = 'file'; input.accept = 'image/*'; input.style.display = 'none'; document.body.appendChild(input); input.onchange = () => { const file = input.files && input.files[0]; if (file) { mrV3Draft.photos[el.dataset.kind] = { name: file.name, type: file.type, size: file.size, addedAt: nowStamp(), mock: true }; } input.remove(); mrV3Open(mrV3Draft.stallId, mrV3Draft.period); }; input.click(); };
  A.ACT['mr-v3-save'] = el => { const r = findReading(el.dataset.id, el.dataset.period), p = A.db.meterPeriods.find(x => x.id === el.dataset.period), st = A.idx.stall.get(el.dataset.id); if (!r || !p || !st || !mrV3Editable(p) || !mrCanRecord(st)) return; const e = A.$('#mrv3-elec').value === '' ? null : Number(A.$('#mrv3-elec').value), w = A.$('#mrv3-water').value === '' ? null : Number(A.$('#mrv3-water').value); if (!Number.isFinite(e) && e !== null || !Number.isFinite(w) && w !== null) return U.toast('Vui lòng nhập chỉ số hợp lệ.'); if (e != null && r.elecPrev != null && e < r.elecPrev || w != null && r.waterPrev != null && w < r.waterPrev) return U.toast('Chỉ số kỳ này không được nhỏ hơn chỉ số kỳ trước.'); r.elecCur = e; r.waterCur = w; r.elecPhoto = mrV3Draft.photos.elec; r.waterPhoto = mrV3Draft.photos.water; r.note = A.$('#mrv3-note').value.trim(); r.recordedBy = mrRecorder(); r.recordedAt = nowStamp(); r.reviewedAt = null; r.reviewedBy = null; r.status = e != null && w != null ? 'RECORDED' : 'PENDING'; A.save(); A.closeModal(); A.render(); U.toast('Đã lưu chỉ số cho điểm ' + st.code); };
  A.ACT['mr-v3-review-confirm'] = el => { const r = findReading(el.dataset.id, el.dataset.period), p = A.db.meterPeriods.find(x => x.id === el.dataset.period), st = A.idx.stall.get(el.dataset.id); if (!r || !p || !st || !mrV3Editable(p) || !mrCanRecord(st) || r.elecCur == null || r.waterCur == null) return; r.reviewedAt = nowStamp(); r.reviewedBy = mrRecorder(); A.save(); A.closeModal(); A.render(); U.toast('Đã xác nhận kiểm tra chỉ số điểm ' + st.code); };
  A.ACT['mr-v3-complete-open'] = () => { const p = currentPeriod(), groups = mrV3Groups(p), bad = groups.filter(g => mrV3State(g) !== 'RECORDED').length; if (bad) return U.toast('Còn điểm chưa ghi đủ hoặc cần kiểm tra.'); A.modal(A.mHead('Hoàn tất ghi chỉ số kỳ thu ' + U.per(p.id) + '?') + `<div class="modal-b">Tất cả chỉ số của các điểm kinh doanh sẽ được xác nhận để sử dụng cho bước lập khoản phải thu.<div class="note info" style="margin-top:12px">Thao tác này không phát hành khoản phải thu.</div></div><div class="modal-f"><button class="btn" data-act="close">Hủy</button><button class="btn primary" data-act="mr-v3-complete-confirm" data-id="${p.id}">Hoàn tất</button></div>`); };
  A.ACT['mr-v3-complete-confirm'] = el => { const p = A.db.meterPeriods.find(x => x.id === el.dataset.id), groups = p && mrV3Groups(p); if (!p || !mrV3Editable(p) || !A.canDo('dien-nuoc.chot-ky', ui.market) || groups.some(g => mrV3State(g) !== 'RECORDED')) return U.toast('Kỳ chưa đủ điều kiện hoàn tất.'); const acc = mrMe() || {}, at = nowStamp(), by = acc.fullName || acc.code || acc.id || ''; p.completionByMarket = Object.assign({}, p.completionByMarket || {}, { [ui.market]: { status: 'CLOSED', completedBy: by, completedById: acc.id || '', completedAt: at, closedBy: by, closedAt: at } }); A.save(); A.closeModal(); A.render(); U.toast('Đã hoàn tất ghi chỉ số kỳ thu ' + U.per(p.id) + '.'); };

  // ---------- Khoản phải thu ----------
  // ---------- Meter reading workflow V4: review and completion are explicit period actions ----------
  function mrV4Stats(p) {
    const groups = mrV3Groups(p);
    const stats = { total: groups.length, recorded: 0, unrecorded: 0, review: 0 };
    groups.forEach(g => { const s = mrV3State(g); if (s === 'RECORDED') stats.recorded++; else if (s === 'NEEDS_REVIEW') stats.review++; else stats.unrecorded++; });
    return Object.assign(stats, { groups });
  }
  function mrV4EnsureDemoPeriod() {
    const periods = A.db.meterPeriods || [], active = periods.filter(x => x.status !== 'CLOSED').sort((a, b) => b.id.localeCompare(a.id))[0];
    // Không tự tạo kỳ demo mới: hết kỳ đang ghi thì hiển thị kỳ gần nhất; kỳ sau chỉ sinh từ luồng thu phí.
    return active || periods.slice().sort((a, b) => b.id.localeCompare(a.id))[0] || null;
  }
  function mrV4CurrentPeriod() {
    const selected = f.mrPeriod && (A.db.meterPeriods || []).find(x => x.id === f.mrPeriod);
    return selected || mrV4EnsureDemoPeriod();
  }
  function mrV4Warning(g) {
    if (g.r.reviewReason) return `<span class="tag warn">${U.esc(g.r.reviewReason)}</span>`;
    return mrV3Warning(g);
  }
  function mrV4DisplayState(p, stats) {
    if (mrPeriodClosed(p)) return 'CLOSED';
    // Readings still remain in the recording phase until every review is resolved.
    // “Cần kiểm tra” is represented by its KPI/filter, not a locked period state.
    if (stats.unrecorded > 0 || stats.review > 0) return 'RECORDING';
    return 'READY';
  }
  function mrV4StateTag(state) {
    return { CLOSED: '<span class="tag ok">🔒 Đã hoàn tất</span>', RECORDING: '<span class="tag info">Đang ghi</span>', CHECKING: '<span class="tag warn">Đang kiểm tra</span>', READY: '<span class="tag info">Sẵn sàng hoàn tất</span>' }[state];
  }
  function mrV4Responsible() {
    const collector = A.ACCOUNTS && A.ACCOUNTS.getMarketCollector ? A.ACCOUNTS.getMarketCollector(ui.market) : null;
    return collector ? (collector.fullName || collector.code || collector.id) : 'Chưa phân công';
  }
  function mrV4Helper(state, stats) {
    if (state === 'CLOSED') return stats.recorded + '/' + stats.total + ' điểm đã hợp lệ. Chỉ số đã được khóa.';
    if (stats.review && !stats.unrecorded) return 'Đã nhập đủ chỉ số nhưng còn ' + stats.review + ' điểm cần xác minh.';
    if (stats.unrecorded && stats.review) return 'Còn ' + stats.unrecorded + ' điểm chưa ghi và ' + stats.review + ' điểm cần kiểm tra.';
    if (stats.unrecorded) return 'Còn ' + stats.unrecorded + ' điểm chưa ghi.';
    return 'Tất cả chỉ số hợp lệ, sẵn sàng hoàn tất.';
  }
  function mrV4DemoReviews(p) {
    // Chỉ thêm minh họa cho kỳ đang ghi và chỉ một lần. Không mở lại kỳ đã khóa,
    // không tạo kỳ mới, không chạm khoản phải thu hay dữ liệu các kỳ lịch sử.
    if (!p || p.status !== 'RECORDING' || p.reviewDemoSeeded) return;
    const candidates = mrV3Groups(p).filter(g => mrV3State(g) === 'RECORDED').slice(0, 3);
    if (candidates.length !== 3) return;
    const reasons = ['Điện tăng bất thường.', 'Nước tăng bất thường.', 'Chỉ số cần xác minh.'];
    candidates.forEach((g, i) => { g.r.reviewRequired = true; g.r.reviewReason = reasons[i]; g.r.reviewDemo = true; });
    p.reviewDemoSeeded = true;
    A.save();
  }
  function mrV4ReviewOpen(stallId, period) {
    const r = findReading(stallId, period), p = (A.db.meterPeriods || []).find(x => x.id === period), st = A.idx.stall.get(stallId), trader = st && st.traderId ? A.idx.trader.get(st.traderId) : null, contract = st && mrV3Contract(st);
    if (!r || !p || !st || !mrV3Editable(p) || !mrCanRecord(st)) return;
    const e = mrItem(r, 'elec'), w = mrItem(r, 'water'), warning = r.reviewReason || [mrAbnormal(e) && 'Điện tăng bất thường so với kỳ trước.', mrAbnormal(w) && 'Nước tăng bất thường so với kỳ trước.'].filter(Boolean).join(' ');
    const meter = item => { const diff = item.current == null || item.previous == null ? '—' : mrV3Number(item.current - item.previous) + ' ' + item.cfg.unit; return `<section class="meter-section"><h4>${item.kind === 'elec' ? 'ĐIỆN' : 'NƯỚC'}</h4><dl class="kv"><dt>Chỉ số kỳ trước</dt><dd>${mrV3Number(item.previous)} ${item.cfg.unit}</dd></dl><div class="field"><label>Chỉ số kỳ này</label><input class="input" id="mrv4-${item.kind}" type="number" min="0" value="${item.current == null ? '' : item.current}"></div><div class="small muted">Tiêu thụ hiện tại: ${diff}</div>${item.r[item.cfg.photo] ? `<button class="btn sm" style="margin-top:8px" data-act="mr-v4-photo-view" data-id="${stallId}" data-period="${period}" data-kind="${item.kind}">Xem ảnh đồng hồ</button>` : ''}</section>`; };
    A.modal(A.mHead('Kiểm tra chỉ số – ' + U.esc(st.code)) + `<div class="modal-b meter-modal"><dl class="kv"><dt>Tiểu thương</dt><dd>${trader ? U.esc(trader.name) : '—'}</dd><dt>Mã HĐ</dt><dd>${contract ? U.esc(contract.id) : '—'}</dd><dt>Điểm KD</dt><dd><b>${U.esc(st.code)}</b></dd></dl><div class="note warn">⚠ ${U.esc(warning || 'Chỉ số cần xác minh.')}</div>${meter(e)}${meter(w)}<section class="meter-section"><h4>Kết quả kiểm tra</h4><label class="row" style="gap:8px"><input type="radio" name="mrv4-result" value="ADJUSTED"> Chỉ số đã nhập sai – Tôi đã điều chỉnh lại</label><label class="row" style="gap:8px;margin-top:8px"><input type="radio" name="mrv4-result" value="CONFIRMED"> Chỉ số chính xác – Xác nhận số liệu bất thường là hợp lệ</label><div class="field" style="margin-top:10px"><label>Ghi chú kiểm tra</label><textarea id="mrv4-note" class="input" rows="3" placeholder="Đã đối chiếu ảnh đồng hồ, chỉ số chính xác."></textarea></div></section></div><div class="modal-f"><button class="btn" data-act="close">Hủy</button><button class="btn primary" data-act="mr-v4-review-confirm" data-id="${stallId}" data-period="${period}">Xác nhận kiểm tra</button></div>`, true);
  }
  A.ACT['mr-v4-photo-view'] = el => { const r = findReading(el.dataset.id, el.dataset.period); if (!r) return; const att = r[el.dataset.kind === 'elec' ? 'elecPhoto' : 'waterPhoto']; A.modal(A.mHead('Ảnh đồng hồ') + `<div class="modal-b"><div class="empty">📷<br>${U.esc((att || {}).name || 'Ảnh đồng hồ')}<div class="small muted">Ảnh minh họa trong prototype.</div></div></div><div class="modal-f"><button class="btn" data-act="close">Đóng</button></div>`); };
  function mrV4Detail(stallId, period) {
    const r = findReading(stallId, period), st = A.idx.stall.get(stallId), trader = st && st.traderId ? A.idx.trader.get(st.traderId) : null;
    if (!r || !st) return;
    const audit = r.reviewHistory && r.reviewHistory[0];
    const consumption = (cur, prev, unit) => cur == null || prev == null ? '—' : (cur - prev) + ' ' + unit;
    A.modal(A.mHead('Chi tiết chỉ số – ' + U.esc(st.code)) + `<div class="modal-b"><dl class="kv"><dt>Điểm KD</dt><dd><b>${U.esc(st.code)}</b></dd><dt>Tiểu thương</dt><dd>${trader ? U.esc(trader.name) : '—'}</dd><dt>Điện</dt><dd>${mrV3Number(r.elecPrev)} → ${mrV3Number(r.elecCur)} · ${consumption(r.elecCur, r.elecPrev, 'kWh')}</dd><dt>Nước</dt><dd>${mrV3Number(r.waterPrev)} → ${mrV3Number(r.waterCur)} · ${consumption(r.waterCur, r.waterPrev, 'm³')}</dd></dl>${audit ? `<div class="note info" style="margin-top:12px"><b>Điểm này từng cần kiểm tra</b><br>Kết quả: ${audit.reviewResult === 'ADJUSTED' ? 'Đã điều chỉnh' : 'Xác nhận hợp lệ'}<br>Người kiểm tra: ${U.esc(audit.reviewedBy || '—')}<br>Thời gian: ${U.esc(audit.reviewedAt || '—')}${audit.reviewNote ? '<br>Ghi chú: ' + U.esc(audit.reviewNote) : ''}</div>` : ''}</div><div class="modal-f"><button class="btn primary" data-act="close">Đóng</button></div>`);
  }
  // Điểm đã qua bước kiểm tra mở chi tiết read-only để giữ rõ audit thay vì quay lại form nhập.
  A.ACT['mr-v3-open'] = el => { const r = findReading(el.dataset.id, el.dataset.period); if (!r) return; if (r.reviewedAt) return mrV4Detail(el.dataset.id, el.dataset.period); mrV3Open(el.dataset.id, el.dataset.period); };
  A.ACT['mr-v4-review-open'] = el => mrV4ReviewOpen(el.dataset.id, el.dataset.period);
  A.ACT['mr-v4-review-confirm'] = el => {
    const r = findReading(el.dataset.id, el.dataset.period), p = (A.db.meterPeriods || []).find(x => x.id === el.dataset.period), st = A.idx.stall.get(el.dataset.id);
    const choice = (A.$('input[name="mrv4-result"]:checked') || {}).value, note = (A.$('#mrv4-note') || {}).value.trim();
    if (!r || !p || !st || !choice || !mrV3Editable(p) || !mrCanRecord(st)) return U.toast('Vui lòng chọn kết quả kiểm tra.');
    const oldReading = { elec: r.elecCur, water: r.waterCur }, elec = Number(A.$('#mrv4-elec').value), water = Number(A.$('#mrv4-water').value);
    if (!Number.isFinite(elec) || !Number.isFinite(water) || elec < r.elecPrev || water < r.waterPrev) return U.toast('Chỉ số kỳ này không được nhỏ hơn chỉ số kỳ trước.');
    if (choice === 'ADJUSTED' && elec === oldReading.elec && water === oldReading.water) return U.toast('Vui lòng điều chỉnh ít nhất một chỉ số hoặc chọn xác nhận số liệu chính xác.');
    const acc = mrMe() || {}, audit = { reviewedBy: acc.fullName || acc.code || acc.id || '', reviewedAt: nowStamp(), reviewResult: choice, reviewNote: note, oldReading, newReading: { elec, water } };
    r.elecCur = elec; r.waterCur = water; r.reviewRequired = false; r.reviewReason = null; r.reviewedBy = audit.reviewedBy; r.reviewedAt = audit.reviewedAt; r.reviewResult = audit.reviewResult; r.reviewNote = audit.reviewNote; r.reviewHistory = r.reviewHistory || []; r.reviewHistory.unshift(audit); r.status = 'RECORDED';
    A.save(); A.closeModal(); A.render(); U.toast('Đã xác nhận kiểm tra chỉ số điểm ' + st.code + '.');
  };
  A.ACT['mr-v4-complete-open'] = () => {
    const p = mrV4CurrentPeriod(), stats = mrV4Stats(p); if (!p || mrPeriodClosed(p) || !stats.total || stats.unrecorded || stats.review) return;
    const market = U.market(ui.market) || {};
    A.modal(A.mHead('Hoàn tất ghi chỉ số kỳ ' + U.per(p.id) + '?') + `<div class="modal-b"><dl class="kv"><dt>Chợ</dt><dd>${U.esc(market.name || ui.market)}</dd><dt>Điểm cần ghi</dt><dd>${stats.total}</dd><dt>Đã ghi hợp lệ</dt><dd>${stats.recorded}</dd><dt>Chưa ghi</dt><dd>${stats.unrecorded}</dd><dt>Cần kiểm tra</dt><dd>${stats.review}</dd></dl><div class="note info">Sau khi hoàn tất, chỉ số của kỳ này sẽ được khóa và được sử dụng làm dữ liệu đầu vào để lập khoản phải thu. Thao tác này không tạo hoặc phát hành khoản phải thu.</div></div><div class="modal-f"><button class="btn" data-act="close">Hủy</button><button class="btn primary" data-act="mr-v4-complete-confirm" data-id="${p.id}">Xác nhận hoàn tất</button></div>`);
  };
  A.ACT['mr-v4-complete-confirm'] = el => {
    const p = (A.db.meterPeriods || []).find(x => x.id === el.dataset.id), stats = p && mrV4Stats(p);
    if (!p || !stats || mrPeriodClosed(p) || !A.canDo('dien-nuoc.chot-ky', ui.market) || !stats.total || stats.unrecorded || stats.review) return U.toast('Kỳ chưa đủ điều kiện hoàn tất.');
    const acc = mrMe() || {}, at = nowStamp(), by = acc.fullName || acc.code || acc.id || ''; p.completionByMarket = Object.assign({}, p.completionByMarket || {}, { [ui.market]: { status: 'CLOSED', completedBy: by, completedById: acc.id || '', completedAt: at, closedBy: by, closedAt: at } });
    A.save(); A.closeModal(); A.render(); U.toast('Đã hoàn tất ghi chỉ số kỳ ' + U.per(p.id) + '.');
  };
  A.VIEWS['dien-nuoc'] = function () {
    const rawPeriod = mrV4CurrentPeriod(); if (!rawPeriod) return '<div class="empty">Chưa có kỳ thu.</div>';
    mrV4DemoReviews(rawPeriod);
    const p = Object.assign({}, rawPeriod, mrPeriodState(rawPeriod));
    const bill = mrV3Billing(p.id), stats = mrV4Stats(p), state = f.mrStatus || 'all', q = (f.mrSearch || '').toLowerCase(), displayState = mrV4DisplayState(p, stats), editable = mrV3Editable(p), canClose = A.canDo('dien-nuoc.chot-ky', ui.market);
    const rows = stats.groups.filter(g => { const s = mrV3State(g), c = mrV3Contract(g.st); return (state === 'all' || s === state) && (!q || [g.st.code, g.st.traderId && (A.idx.trader.get(g.st.traderId) || {}).name, c && c.id].join(' ').toLowerCase().includes(q)); });
    const kpi = (label, value, filter) => `<button class="card kpi" data-act="mr-status" data-id="${filter}" style="text-align:left"><div class="k-label">${label}</div><div class="k-value">${value}</div></button>`;
    const day = (bill && bill.meterReadDate) || p.closeDate || '—', periods = (A.db.meterPeriods || []).slice().sort((a,b)=>b.id.localeCompare(a.id)).map(x => `<option value="${x.id}" ${x.id === p.id ? 'selected' : ''}>${U.per(x.id)}</option>`).join(''), market = U.market(ui.market) || {};
    const blocked = stats.unrecorded && stats.review ? `Còn ${stats.unrecorded} điểm chưa ghi và ${stats.review} điểm cần kiểm tra.` : stats.unrecorded ? `Còn ${stats.unrecorded} điểm chưa ghi chỉ số.` : stats.review ? `Còn ${stats.review} điểm cần kiểm tra trước khi có thể hoàn tất ghi chỉ số.` : '';
    return `<div class="card meter-title"><div class="card-b"><h2>Chỉ số điện, nước</h2><p>Ghi nhận chỉ số điện, nước theo từng điểm kinh doanh trong kỳ thu.</p><div class="row" style="margin-top:12px"><label class="small">Kỳ thu</label><select class="input" style="min-width:130px" data-ch="mp-select">${periods}</select></div><dl class="kv" style="margin-top:12px"><dt>Kỳ thu</dt><dd><b>${U.per(p.id)}</b></dd><dt>Chợ</dt><dd>${U.esc(market.name || ui.market || '—')}</dd><dt>Ngày ghi chỉ số</dt><dd>${day === '—' ? day : U.dmy(day)}</dd><dt>NV thu phí phụ trách</dt><dd>${U.esc(mrV4Responsible())}</dd><dt>Trạng thái</dt><dd>${mrV4StateTag(displayState)}</dd>${displayState === 'CLOSED' ? `<dt>Hoàn tất bởi</dt><dd>${U.esc(p.completedBy || p.closedBy || '—')} · ${U.esc(p.completedAt || p.closedAt || '—')}</dd>` : ''}</dl><div class="small muted" style="margin-top:8px">${mrV4Helper(displayState, stats)}</div></div></div><div class="kpis">${kpi('Điểm cần ghi', stats.total, 'all')}${kpi('Đã ghi', stats.recorded, 'RECORDED')}${kpi('Chưa ghi', stats.unrecorded, 'NOT_RECORDED')}${kpi('Cần kiểm tra', stats.review, 'NEEDS_REVIEW')}</div><div class="card"><div class="card-h"><div class="seg">${[['all','Tất cả'],['NOT_RECORDED','Chưa ghi'],['RECORDED','Đã ghi'],['NEEDS_REVIEW','Cần kiểm tra']].map(x => `<button class="${state === x[0] ? 'on' : ''}" data-act="mr-status" data-id="${x[0]}">${x[1]}</button>`).join('')}</div><span class="spacer"></span><input class="input meter-search" data-in="mr-search" placeholder="Tìm mã điểm, tiểu thương, mã hợp đồng..." value="${U.esc(f.mrSearch || '')}">${editable && canClose ? `<button class="btn primary" data-act="mr-v4-complete-open" ${stats.total && !stats.unrecorded && !stats.review ? '' : 'disabled'}>Hoàn tất ghi chỉ số</button>` : ''}</div><div class="card-b">${blocked && editable ? `<div class="small muted" style="margin-bottom:10px">${blocked}</div>` : ''}${U.table([{t:'Điểm KD'},{t:'Tiểu thương'},{t:'Điện kỳ trước',num:true},{t:'Điện kỳ này',num:true},{t:'Tiêu thụ điện',num:true},{t:'Nước kỳ trước',num:true},{t:'Nước kỳ này',num:true},{t:'Tiêu thụ nước',num:true},{t:'Cảnh báo'},{t:'Trạng thái'},{t:'Thao tác'}], rows.map(g => { const s = mrV3State(g), tr = g.st.traderId && A.idx.trader.get(g.st.traderId), canRecord = editable && mrCanRecord(g.st); const action = mrPeriodClosed(rawPeriod) ? `<button class="btn sm" data-act="mr-v3-open" data-id="${g.st.id}" data-period="${p.id}">Xem</button>` : s === 'NEEDS_REVIEW' && canRecord ? `<button class="btn sm primary" data-act="mr-v4-review-open" data-id="${g.st.id}" data-period="${p.id}">Kiểm tra</button>` : s === 'NOT_RECORDED' && canRecord ? `<button class="btn sm primary" data-act="mr-v3-open" data-id="${g.st.id}" data-period="${p.id}">Ghi chỉ số</button>` : `<button class="btn sm" data-act="mr-v3-open" data-id="${g.st.id}" data-period="${p.id}">Xem</button>`; return `<tr><td><b>${U.esc(g.st.code)}</b></td><td>${tr ? U.esc(tr.name) + '<div class="small muted">' + U.esc(tr.id) + '</div>' : '—'}</td><td class="num">${mrV3Number(g.elec.previous)}</td><td class="num">${mrV3Number(g.elec.current)}</td><td class="num">${mrV3Consumption(g.elec)}</td><td class="num">${mrV3Number(g.water.previous)}</td><td class="num">${mrV3Number(g.water.current)}</td><td class="num">${mrV3Consumption(g.water)}</td><td>${mrV3Warning(g)}</td><td>${mrV3Tag(s)}</td><td>${action}</td></tr>`; }), {empty:'Không có điểm kinh doanh cần ghi chỉ số trong phạm vi này.'})}<div class="small muted" style="margin-top:8px">Màn này chỉ lưu chỉ số và sản lượng; không tính tiền hoặc tạo khoản phải thu.</div></div></div>`;
  };

  // V5 keeps row actions strictly state-driven; authorization remains enforced in every write handler.
  function mrV5WarningText(g) {
    if (g.r.reviewReason) return g.r.reviewReason;
    const reasons = [];
    if (mrAbnormal(g.elec)) reasons.push('Điện tăng bất thường so với kỳ trước.');
    if (mrAbnormal(g.water)) reasons.push('Nước tăng bất thường so với kỳ trước.');
    return reasons.join(' ') || 'Chỉ số cần xác minh.';
  }
  function mrV5ReviewOpen(stallId, period) {
    const r = findReading(stallId, period), p = (A.db.meterPeriods || []).find(x => x.id === period), st = A.idx.stall.get(stallId), trader = st && st.traderId ? A.idx.trader.get(st.traderId) : null, contract = st && mrV3Contract(st);
    if (!r || !p || !st || mrPeriodClosed(p) || !mrCanRecord(st)) return U.toast('Bạn không có quyền kiểm tra chỉ số của điểm này.');
    const meter = (kind, label, unit, prev, cur) => `<section class="meter-section"><h4>${label}</h4><dl class="kv"><dt>Chỉ số kỳ trước</dt><dd>${mrV3Number(prev)} ${unit}</dd></dl><div class="field"><label>Chỉ số kỳ này</label><input class="input" id="mrv5-${kind}" data-in="mr-v5-reading" data-kind="${kind}" type="number" min="0" value="${cur == null ? '' : cur}"></div><div id="mrv5-${kind}-consumption" class="small muted">${cur == null ? 'Nhập chỉ số để tính sản lượng.' : `${mrV3Number(cur)} - ${mrV3Number(prev)} = ${mrV3Number(cur - prev)} ${unit}`}</div></section>`;
    A.modal(A.mHead('Kiểm tra chỉ số điện, nước') + `<div class="modal-b meter-modal"><div class="small muted"><b>Điểm KD:</b> ${U.esc(st.code)} · <b>Tiểu thương:</b> ${trader ? U.esc(trader.name) : '—'} · <b>Hợp đồng:</b> ${contract ? U.esc(contract.id) : '—'} · <b>Kỳ thu:</b> ${U.per(period)}</div><div class="note warn" style="margin-top:12px"><b>Cần kiểm tra</b><br>⚠ ${U.esc(mrV5WarningText({ r, elec: mrItem(r, 'elec'), water: mrItem(r, 'water') }))}</div>${meter('elec', 'ĐIỆN', 'kWh', r.elecPrev, r.elecCur)}${meter('water', 'NƯỚC', 'm³', r.waterPrev, r.waterCur)}<section class="meter-section"><h4>KẾT QUẢ KIỂM TRA</h4><label class="row" style="gap:8px"><input type="radio" name="mrv5-result" value="ADJUSTED"> Đã điều chỉnh chỉ số</label><label class="row" style="gap:8px;margin-top:8px"><input type="radio" name="mrv5-result" value="CONFIRMED"> Chỉ số hiện tại chính xác</label><div class="field" style="margin-top:10px"><label>Ghi chú kiểm tra</label><textarea id="mrv5-note" class="input" rows="3" placeholder="Đã kiểm tra ảnh đồng hồ, số liệu chính xác."></textarea></div></section></div><div class="modal-f"><button class="btn" data-act="close">Hủy</button><button class="btn primary" data-act="mr-v5-review-confirm" data-id="${stallId}" data-period="${period}">Xác nhận kiểm tra</button></div>`, true);
  }
  A.IN['mr-v5-reading'] = el => {
    const r = findReading(mrV5Draft.stallId, mrV5Draft.period), kind = el.dataset.kind, prev = kind === 'elec' ? r.elecPrev : r.waterPrev, unit = kind === 'elec' ? 'kWh' : 'm³', current = el.value === '' ? null : Number(el.value), out = A.$('#mrv5-' + kind + '-consumption');
    if (!out) return;
    out.innerHTML = current == null ? 'Nhập chỉ số để tính sản lượng.' : !Number.isFinite(current) || current < prev ? 'Chỉ số kỳ này không được nhỏ hơn chỉ số kỳ trước.' : `${mrV3Number(current)} - ${mrV3Number(prev)} = <b>${mrV3Number(current - prev)} ${unit}</b>`;
  };
  let mrV5Draft = null;
  A.ACT['mr-v5-review-open'] = el => { mrV5Draft = { stallId: el.dataset.id, period: el.dataset.period }; mrV5ReviewOpen(el.dataset.id, el.dataset.period); };
  A.ACT['mr-v5-review-confirm'] = el => {
    const r = findReading(el.dataset.id, el.dataset.period), p = (A.db.meterPeriods || []).find(x => x.id === el.dataset.period), st = A.idx.stall.get(el.dataset.id), result = (A.$('input[name="mrv5-result"]:checked') || {}).value, note = (A.$('#mrv5-note') || {}).value.trim();
    const elec = Number(A.$('#mrv5-elec').value), water = Number(A.$('#mrv5-water').value);
    if (!r || !p || !st || mrPeriodClosed(p) || !mrCanRecord(st) || !result) return U.toast('Vui lòng chọn kết quả kiểm tra.');
    if (!Number.isFinite(elec) || !Number.isFinite(water) || elec < r.elecPrev || water < r.waterPrev) return U.toast('Chỉ số kỳ này không được nhỏ hơn chỉ số kỳ trước.');
    const oldReading = { elec: r.elecCur, water: r.waterCur };
    if (result === 'CONFIRMED' && (elec !== oldReading.elec || water !== oldReading.water)) return U.toast('Nếu đã sửa chỉ số, vui lòng chọn “Đã điều chỉnh chỉ số”.');
    if (result === 'ADJUSTED' && elec === oldReading.elec && water === oldReading.water) return U.toast('Vui lòng điều chỉnh ít nhất một chỉ số hoặc chọn “Chỉ số hiện tại chính xác”.');
    const acc = mrMe() || {}, audit = { reviewedBy: acc.fullName || acc.code || acc.id || '', reviewedAt: nowStamp(), reviewResult: result, reviewNote: note, oldReading, newReading: { elec, water } };
    r.elecCur = elec; r.waterCur = water; r.reviewRequired = false; r.reviewReason = null; r.reviewedBy = audit.reviewedBy; r.reviewedAt = audit.reviewedAt; r.reviewResult = audit.reviewResult; r.reviewNote = audit.reviewNote; r.reviewHistory = r.reviewHistory || []; r.reviewHistory.unshift(audit); r.status = 'RECORDED';
    A.save(); A.closeModal(); A.render(); U.toast('Đã xác nhận kiểm tra chỉ số điểm ' + st.code + '.');
  };
  A.VIEWS['dien-nuoc'] = function () {
    const rawPeriod = mrV4CurrentPeriod(), p = Object.assign({}, rawPeriod, mrPeriodState(rawPeriod)), stats = mrV4Stats(p), state = f.mrStatus || 'all', q = (f.mrSearch || '').toLowerCase(), display = mrV4DisplayState(p, stats), editable = !mrPeriodClosed(p), canClose = A.canDo('dien-nuoc.chot-ky', ui.market), market = U.market(ui.market) || {};
    const rows = stats.groups.filter(g => { const c = mrV3Contract(g.st); return (state === 'all' || mrV3State(g) === state) && (!q || [g.st.code, (A.idx.trader.get(g.st.traderId) || {}).name, c && c.id].join(' ').toLowerCase().includes(q)); });
    const periods = (A.db.meterPeriods || []).slice().sort((a,b)=>b.id.localeCompare(a.id)).map(x => `<option value="${x.id}" ${x.id === p.id ? 'selected' : ''}>${U.per(x.id)}</option>`).join('');
    const kpi = (label, value, filter) => `<button class="card kpi" data-act="mr-status" data-id="${filter}" style="text-align:left"><div class="k-label">${label}</div><div class="k-value">${value}</div></button>`;
    const helper = mrV4Helper(display, stats), blocked = stats.unrecorded || stats.review;
    return `<div class="card meter-title"><div class="card-b"><h2>Chỉ số điện, nước</h2><p>Ghi nhận chỉ số điện, nước theo từng điểm kinh doanh trong kỳ thu.</p><div class="row" style="margin-top:12px"><label class="small">Kỳ thu</label><select class="input" style="min-width:130px" data-ch="mp-select">${periods}</select></div><dl class="kv" style="margin-top:12px"><dt>Kỳ thu</dt><dd><b>${U.per(p.id)}</b></dd><dt>Chợ</dt><dd>${U.esc(market.name || ui.market)}</dd><dt>Ngày ghi chỉ số</dt><dd>${U.dmy(p.closeDate)}</dd><dt>NV thu phí phụ trách</dt><dd>${U.esc(mrV4Responsible())}</dd><dt>Trạng thái</dt><dd>${mrV4StateTag(display)}</dd>${display === 'CLOSED' ? `<dt>Hoàn tất bởi</dt><dd>${U.esc(p.completedBy || p.closedBy || '—')} · ${U.esc(p.completedAt || p.closedAt || '—')}</dd>` : ''}</dl><div class="small muted" style="margin-top:8px">${helper}</div></div></div><div class="kpis">${kpi('Điểm cần ghi',stats.total,'all')}${kpi('Đã ghi',stats.recorded,'RECORDED')}${kpi('Chưa ghi',stats.unrecorded,'NOT_RECORDED')}${kpi('Cần kiểm tra',stats.review,'NEEDS_REVIEW')}</div><div class="card"><div class="card-h"><div class="seg">${[['all','Tất cả'],['NOT_RECORDED','Chưa ghi'],['RECORDED','Đã ghi'],['NEEDS_REVIEW','Cần kiểm tra']].map(x=>`<button class="${state===x[0]?'on':''}" data-act="mr-status" data-id="${x[0]}">${x[1]}</button>`).join('')}</div><span class="spacer"></span><input class="input meter-search" data-in="mr-search" placeholder="Tìm mã điểm, tiểu thương, mã hợp đồng..." value="${U.esc(f.mrSearch || '')}">${editable && canClose ? `<button class="btn primary" data-act="mr-v4-complete-open" ${!blocked && stats.total ? '' : 'disabled'}>Hoàn tất ghi chỉ số</button>` : ''}</div><div class="card-b">${blocked && editable ? `<div class="small muted" style="margin-bottom:10px">${stats.unrecorded && stats.review ? `Còn ${stats.unrecorded} điểm chưa ghi và ${stats.review} điểm cần kiểm tra.` : stats.unrecorded ? `Còn ${stats.unrecorded} điểm chưa ghi chỉ số.` : `Còn ${stats.review} điểm cần kiểm tra trước khi có thể hoàn tất ghi chỉ số.`}</div>` : ''}${U.table([{t:'Điểm KD'},{t:'Tiểu thương'},{t:'Điện kỳ trước',num:true},{t:'Điện kỳ này',num:true},{t:'Tiêu thụ điện',num:true},{t:'Nước kỳ trước',num:true},{t:'Nước kỳ này',num:true},{t:'Tiêu thụ nước',num:true},{t:'Cảnh báo'},{t:'Trạng thái'},{t:'Thao tác'}],rows.map(g=>{const s=mrV3State(g),tr=A.idx.trader.get(g.st.traderId),action=p.status==='CLOSED'?`<button class="btn sm" data-act="mr-v3-open" data-id="${g.st.id}" data-period="${p.id}">Xem</button>`:s==='NOT_RECORDED'?`<button class="btn sm primary" data-act="mr-v3-open" data-id="${g.st.id}" data-period="${p.id}">Ghi chỉ số</button>`:s==='NEEDS_REVIEW'?`<button class="btn sm primary" data-act="mr-v5-review-open" data-id="${g.st.id}" data-period="${p.id}">Kiểm tra</button>`:mrCanRecord(g.st)?`<button class="btn sm" data-act="mr-v5-edit-open" data-id="${g.st.id}" data-period="${p.id}">Cập nhật</button>`:`<button class="btn sm" data-act="mr-v3-open" data-id="${g.st.id}" data-period="${p.id}">Xem</button>`;return `<tr><td><b>${U.esc(g.st.code)}</b></td><td>${tr?U.esc(tr.name):'—'}</td><td class="num">${mrV3Number(g.elec.previous)}</td><td class="num">${mrV3Number(g.elec.current)}</td><td class="num">${mrV3Consumption(g.elec)}</td><td class="num">${mrV3Number(g.water.previous)}</td><td class="num">${mrV3Number(g.water.current)}</td><td class="num">${mrV3Consumption(g.water)}</td><td>${s==='NEEDS_REVIEW'?`<span class="tag warn">${U.esc(mrV5WarningText(g))}</span>`:'<span class="muted">—</span>'}</td><td>${mrV3Tag(s)}</td><td>${action}</td></tr>`;}),{empty:'Không có điểm kinh doanh cần ghi chỉ số trong phạm vi này.'})}</div></div>`;
  };

  // Trước khi hoàn tất, điểm đã ghi mở thẳng form sửa (kể cả điểm đã qua kiểm tra); mrV3Open/mr-v3-save tự
  // khóa khi kỳ đã hoàn tất hoặc người dùng không được ghi chỉ số điểm này.
  A.ACT['mr-v5-edit-open'] = el => mrV3Open(el.dataset.id, el.dataset.period);
  // Meter screen keeps its selected reading period locally; it does not change the shared finance period.
  A.CH['mp-select'] = el => { f.mrPeriod = el.value; f.mrStatus = 'all'; A.render(); };

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
    return ptReqs().filter(r => r.market === ui.market && (!invoiceId || r.invoiceId === invoiceId) && ptInScope(A.idx.invoice.get(r.invoiceId))).map(r => {
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
    const t = A.idx.trader.get(i.traderId), st = U.invStall(i), delta = ptReqDelta(req);
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
        <div class="field"><label>Dòng phát sinh cần điều chỉnh</label><select class="input" data-ch="adj-line">${i.items.map((x, n) => `<option value="${n}" ${idx === n ? 'selected' : ''}>${U.esc((x.stallId && U.invStallIds(i).length > 1 ? ((A.idx.stall.get(x.stallId) || {}).code || x.stallId) + ' · ' : '') + ptItemKind(x.name) + ' · ' + x.name)}</option>`).join('')}</select></div>
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
  // ---------- PHAI_THU_THEO_TIEU_THUONG ----------
  // Màn Khoản phải thu phục vụ ĐỊNH HƯỚNG THU: thu của ai, bao nhiêu, đã thu chưa. Mỗi dòng = 1 tiểu thương
  // trong kỳ; tiểu thương thuê nhiều điểm được gộp tổng, vào chi tiết mới thấy từng khoản (mỗi khoản vẫn
  // giữ mã PT-… sinh khi Trưởng Ban phát hành, dùng xuyên suốt ở biên lai / công nợ).
  // Phạm vi xem: luôn trong ui.market (⊂ marketScopes). Quyền action và Market scope độc lập với Layout.
  const ptScopeAll = () => A.canDo('phai-thu.xem-toan-cho', ui.market);
  function ptInScope(i, all) {
    if (!i || A.receivableMarket(i) !== ui.market) return false;
    const acc = A.currentAccount();
    return !!(acc && A.allowedMarkets(acc).indexOf(ui.market) !== -1 && U.can('phai-thu'));
  }
  function ptGroups(invs) {
    const map = new Map();
    invs.forEach(i => { const g = map.get(i.traderId) || { t: A.idx.trader.get(i.traderId), list: [] }; g.list.push(i); map.set(i.traderId, g); });
    return Array.from(map.values()).filter(g => g.t).map(g => {
      const amount = U.sum(g.list, i => i.amount), paid = U.sum(g.list, i => i.paid), open = g.list.filter(i => i.status !== 'paid');
      const due = (open.length ? open : g.list).map(i => i.due).sort()[0];
      const status = !open.length ? 'paid' : paid > 0 ? 'partial' : 'unpaid';
      return Object.assign(g, { amount, paid, due, status, over: open.some(U.isOver), adjusted: g.list.some(i => i.adjust), pending: g.list.some(i => ptPendingReq(i.id)) });
    });
  }
  // ---------- PHAI_THU_THEO_KHU_VA_BAN_DO (chợ thu theo phần: receivableGrouping 'TRADER') ----------
  // Số tiền / đã thu theo TỪNG ĐIỂM của 1 mã khoản (đã thu = điểm có trong payment.stallIds).
  const ptCollectorName = () => '';
  function ptStallLine(i, id, covered) {
    const ids = U.invStallIds(i), its = i.items.filter(x => (x.stallId || ids[0]) === id), amount = U.sum(its, x => x.amount);
    const paid = covered.has(id);
    return { id, st: A.idx.stall.get(id) || {}, its, amount, paid, paidAmount: paid ? amount : 0 };
  }
  // Bản "rút gọn" của khoản theo tập điểm (phần của NV / khu đang lọc) — chỉ để HIỂN THỊ, không ghi dữ liệu.
  function ptPortion(i, keep) {
    const covered = A.invCoveredStalls(i), lines = U.invStallIds(i).filter(keep).map(id => ptStallLine(i, id, covered));
    if (!lines.length) return null;
    const amount = U.sum(lines, l => l.amount), paid = U.sum(lines, l => l.paidAmount);
    return Object.assign({}, i, { amount, paid, status: paid >= amount ? 'paid' : paid > 0 ? 'partial' : 'unpaid', portion: true });
  }
  // Vùng thu = DÃY (Row) của mô hình mặt bằng v16 (A.db.buildings → floors → rows → stalls). Dãy là đơn vị
  // phân công NV thu phí (row.collectorId); stall.section (getter) = row.code nên các bộ lọc cũ vẫn khớp.
  // Thứ tự: Toà nhà → Tầng → Dãy (theo order) — dùng cho lộ trình đi thu và Bản đồ thu.
  function ptLayoutRows(mid) {
    const bOrd = new Map((A.db.buildings || []).filter(b => b.market === mid).map(b => [b.id, b.order || 0]));
    const fOrd = new Map((A.db.floors || []).filter(x => x.market === mid).map(x => [x.id, x.order || 0]));
    return (A.db.rows || []).filter(r => r.market === mid && r.status !== 'inactive')
      .sort((a, b) => (bOrd.get(a.buildingId) || 0) - (bOrd.get(b.buildingId) || 0) || (a.floorId ? fOrd.get(a.floorId) || 0 : 999) - (b.floorId ? fOrd.get(b.floorId) || 0 : 999) || (a.order || 0) - (b.order || 0));
  }
  function ptRowPlace(r) {
    const fl = r.floorId && A.idx.floor ? A.idx.floor.get(r.floorId) : null, b = A.idx.building ? A.idx.building.get(r.buildingId) : null;
    return fl ? fl.name : b ? b.name : '';
  }
  function ptZones() {
    return ptLayoutRows(ui.market).map(r => ({ id: r.code, rowId: r.id, name: r.name + (ptRowPlace(r) ? ' · ' + ptRowPlace(r) : '') }));
  }
  // Bảng chi tiết khoản thu theo phần: mỗi điểm 1 dòng tiêu đề (người thu, phải thu, đã thu) + các dòng tiền.
  // Đã thu → mờ; chưa thu → đậm. onlyStalls: giới hạn điểm được xem (NV thu phí chỉ thấy phần của mình).
  function ptPartTable(i, onlyStalls, totalLabel) {
    const covered = A.invCoveredStalls(i);
    const ids = U.invStallIds(i).filter(id => !onlyStalls || onlyStalls.indexOf(id) !== -1);
    const lines = ids.map(id => ptStallLine(i, id, covered))
      .sort((a, b) => ptCollectorName(a.st).localeCompare(ptCollectorName(b.st)) || String(a.st.code).localeCompare(String(b.st.code)));
    const faded = 'opacity:.45', strong = 'font-weight:700';
    const rows = [];
    lines.forEach(l => {
      const style = l.paid ? faded : strong;
      rows.push(`<tr style="background:#f5f7fb;${style}"><td><b>Điểm ${U.esc(l.st.code || l.id)}</b>${l.st.sectionName ? ' <span class="small muted">· ' + U.esc(l.st.sectionName) + '</span>' : ''}</td><td>${U.esc(ptCollectorName(l.st))}</td><td class="num">${U.money(l.amount)}</td><td class="num">${l.paid ? U.money(l.paidAmount) : '0 đ'}</td><td>${l.paid ? '<span class="tag ok">Đã thu</span>' : '<span class="tag">Chưa thu</span>'}</td></tr>`);
      l.its.forEach(x => rows.push(`<tr style="${l.paid ? faded : 'font-weight:600'}"><td style="padding-left:22px">${U.esc(x.name)}</td><td></td><td class="num">${U.money(x.amount)}</td><td class="num">${l.paid ? U.money(x.amount) : '—'}</td><td></td></tr>`));
    });
    const amount = U.sum(lines, l => l.amount), paid = U.sum(lines, l => l.paidAmount);
    // Tổng theo người thu (khu vực) để Trưởng Ban nhìn nhanh ai còn phải thu.
    const byC = new Map();
    lines.forEach(l => { const k = ptCollectorName(l.st), v = byC.get(k) || { amount: 0, paid: 0, pts: [] }; v.amount += l.amount; v.paid += l.paidAmount; v.pts.push(l.st.code || l.id); byC.set(k, v); });
    const summary = byC.size > 1 ? U.table([{ t: 'Người thu' }, { t: 'Điểm phụ trách' }, { t: 'Phải thu', num: true }, { t: 'Đã thu', num: true }],
      Array.from(byC.entries()).map(([k, v]) => `<tr style="${v.paid >= v.amount ? faded : strong}"><td>${U.esc(k)}</td><td>${U.esc(v.pts.join(', '))}</td><td class="num">${U.money(v.amount)}</td><td class="num">${U.money(v.paid)}</td></tr>`)) + '<div style="height:10px"></div>' : '';
    return summary + U.table([{ t: 'Nội dung' }, { t: 'Người thu' }, { t: 'Số tiền', num: true }, { t: 'Đã thu', num: true }, { t: '' }],
      rows.concat([`<tr><td><b>${totalLabel || (onlyStalls ? 'Cộng phần của bạn' : 'Tổng cộng')}</b></td><td></td><td class="num"><b>${U.money(amount)}</b></td><td class="num"><b>${U.money(paid)}</b></td><td></td></tr>`]));
  }
  // Bản đồ thu: vẽ theo cấu trúc mặt bằng v16 (Toà nhà → Tầng → Dãy → điểm theo số thứ tự), mỗi ô tô màu theo
  // tình trạng thu của điểm trong kỳ đang xem và hiện số tiền. NV thu phí (không có xem toàn chợ) chỉ thấy Dãy
  // được phân công cho mình (phân công theo Dãy nên không lẫn quầy của người khác).
  function ptMapHtml(fp, scopeAll, zone) {
    const mid = ui.market;
    const byStall = new Map();
    A.db.invoices.filter(i => i.period === fp.id && U.inM(i)).forEach(i => { const cov = A.invCoveredStalls(i); U.invStallIds(i).forEach(id => byStall.set(id, { i, line: ptStallLine(i, id, cov) })); });
    const COLORS = { paid: ['#dff3e6', '#2e8b57'], unpaid: ['#ffffff', '#6b7280'], over: ['#fde2e2', '#d6453b'], none: ['#f1f2f4', '#c3c7cf'] };
    const legend = [['paid', 'Đã thu'], ['unpaid', 'Chưa thu'], ['over', 'Quá hạn'], ['none', 'Không phát sinh khoản / điểm trống']].map(([k, t]) => `<span style="display:inline-flex;align-items:center;gap:6px;margin-right:14px"><i style="width:14px;height:14px;border-radius:3px;background:${COLORS[k][0]};border:1.5px solid ${COLORS[k][1]}"></i>${t}</span>`).join('');
    const cell = st => {
      const x = byStall.get(st.id);
      const k = x ? (x.line.paid ? 'paid' : (U.isOver(x.i) ? 'over' : 'unpaid')) : 'none';
      const t = x && A.idx.trader.get(x.i.traderId);
      const tip = x ? `${st.code} · ${t ? t.name : ''} · ${U.money(x.line.amount)} · ${x.line.paid ? 'Đã thu' : 'Chưa thu'} · ${x.i.id}` : `${st.code} · không phát sinh khoản kỳ này`;
      return `<button class="cell" title="${U.esc(tip)}" ${x ? `data-act="inv-open" data-id="${x.i.id}" data-stall="${st.id}"` : 'disabled'} style="height:44px;line-height:1.15;display:flex;flex-direction:column;justify-content:center;background:${COLORS[k][0]};border:1.5px solid ${COLORS[k][1]};color:#1f2937;cursor:${x ? 'pointer' : 'default'};${k === 'paid' ? 'opacity:.7;font-weight:500' : k === 'unpaid' || k === 'over' ? 'font-weight:700' : 'font-weight:500'}">${U.esc(st.code)}${x ? `<span style="font-weight:400;font-size:10px">${U.moneyShort(x.line.amount)}</span>` : ''}</button>`;
    };
    const rowHtml = r => {
      if (zone && r.code !== zone) return '';
      const stalls = A.db.stalls.filter(st => st.rowId === r.id).sort((a, b) => (a.num || 0) - (b.num || 0));
      if (!stalls.length) return '';
      let tot = 0, got = 0, nPaid = 0, nDue = 0;
      stalls.forEach(st => { const x = byStall.get(st.id); if (!x) return; tot += x.line.amount; got += x.line.paidAmount; nDue++; if (x.line.paid) nPaid++; });
      const per = Math.min(Math.max(stalls.length, 4), 12);
      return `<div class="plan-section"><h4>${U.esc(r.name)}<span>${U.esc(r.code)}</span><span style="margin-left:auto"><span class="tag ${nDue && nPaid === nDue ? 'ok' : ''}">${nPaid}/${nDue} điểm đã thu</span> <span class="tag">${U.money(got)} / ${U.money(tot)}</span></span></h4>
        <div class="bar-mini" style="margin:2px 0 8px"><i style="width:${U.pct(got, tot)}%"></i></div><div class="plan-row"><div class="cells" style="--n:${per};grid-template-columns:repeat(${per},minmax(58px,1fr))">${stalls.map(cell).join('')}</div></div></div>`;
    };
    const rows = ptLayoutRows(mid);
    const body = (A.db.buildings || []).filter(b => b.market === mid).sort((a, b) => (a.order || 0) - (b.order || 0)).map(b => {
      const own = rows.filter(r => r.buildingId === b.id);
      const groups = [];
      own.forEach(r => { const g = groups.find(x => x.floorId === (r.floorId || null)); if (g) g.rows.push(r); else groups.push({ floorId: r.floorId || null, rows: [r] }); });
      const html = groups.map(g => { const zs = g.rows.map(rowHtml).filter(Boolean).join(''); const fl = g.floorId && A.idx.floor ? A.idx.floor.get(g.floorId) : null; return zs ? `${fl && groups.length > 1 ? `<div class="mb-floor-heading"><b>${U.esc(fl.name)}</b></div>` : ''}${zs}` : ''; }).filter(Boolean).join('');
      return html ? `<div class="card" style="margin-bottom:12px"><div class="card-h"><h3>${U.esc(b.name)}</h3><span class="small muted">Theo cấu trúc tại Hạ tầng chợ › Mặt bằng & điểm kinh doanh</span></div><div class="card-b"><div class="plan">${html}</div></div></div>` : '';
    }).join('');
    return `<div class="card"><div class="card-b small" style="padding-top:12px">${legend}<span class="muted">${scopeAll ? 'Bấm vào ô để xem tiền của riêng điểm đó trong mã khoản thu.' : 'Chỉ hiện Dãy, điểm kinh doanh và số tiền thuộc phần được phân công cho bạn. Bấm vào ô để xem chi tiết.'}</span></div></div>${body || (scopeAll ? '<div class="empty">Chợ chưa khai báo cấu trúc mặt bằng (Toà nhà/Tầng/Dãy) hoặc không có Dãy khớp bộ lọc.</div>' : '<div class="empty">Bạn chưa được phân công Dãy nào ở chợ này.</div>')}`;
  }
  // Khoản phải thu — góc nhìn NV thu phí: không hiện tiền (tiền cần thu xem ở Thu tiền & biên lai),
  // chỉ đếm khoản theo tình trạng thu và liệt kê điểm KD được phân công cho chính mình.
  function ptMyPoints(list) {
    const ids = [];
    list.forEach(i => U.invStallIds(i).forEach(id => { const st = A.idx.stall.get(id); if (st && ids.indexOf(st.code || id) === -1) ids.push(st.code || id); }));
    return ids.join(', ') || '—';
  }
  function ptCollectorKpis(groups) {
    const n = groups.length, done = groups.filter(g => g.status === 'paid').length, over = groups.filter(g => g.status !== 'paid' && g.over).length;
    return `<div class="kpis">
      <div class="card kpi"><div class="k-label">Khoản được phân công</div><div class="k-value">${n}</div><div class="k-sub">Theo tiểu thương, kỳ đang xem</div></div>
      <div class="card kpi"><div class="k-label">Đã thu</div><div class="k-value">${done}</div><div class="bar-mini"><i style="width:${U.pct(done, n)}%"></i></div></div>
      <div class="card kpi"><div class="k-label">Chưa thu</div><div class="k-value" style="color:#df2225">${n - done}</div><div class="k-sub">Thu tại Thu tiền &amp; biên lai</div></div>
      <div class="card kpi"><div class="k-label">Quá hạn</div><div class="k-value">${over}</div><div class="k-sub">Chuyển sang Công nợ</div></div></div>`;
  }
  function ptNewStatus(status) {
    const m = { NOT_CALCULATED: ['Chưa tính', ''], HAS_ERRORS: ['Có lỗi cần xử lý', 'danger'], READY_TO_PUBLISH: ['Sẵn sàng phát hành', 'ok'], PUBLISHED: ['Đã phát hành', 'ok'], VALID: ['✓ Hợp lệ', 'ok'], INVALID: ['⚠ Cần xử lý', 'danger'] };
    const x = m[status] || m.DRAFT; return `<span class="tag ${x[1]}">${x[0]}</span>`;
  }
  function ptNewPeriod() {
    const list = A.db.billingPeriods || [];
    return list.find(p => p.id === f.ptPeriod) || list.find(p => p.id === ui.period) || list[list.length - 1];
  }
  function ptNewGroups(market, period) { const b = A.features.finance.billing; return b ? b.traderGroups(market, period) : []; }
  function ptNewAmount(rows, type) { return U.sum(rows.filter(r => r.items[0] && r.items[0].chargeType === type), r => r.amount); }
  function ptReceivableCode(market, period, traderId, ordinal) {
    const marketCode = String(market || '').replace(/[^A-Za-z0-9]/g, '').toUpperCase();
    const periodCode = String(period || '').replace(/[^0-9]/g, '').slice(0, 6);
    const traderCode = String(traderId || '').replace(/[^A-Za-z0-9]/g, '').toUpperCase();
    return 'KPT-' + marketCode + '-' + periodCode + '-' + traderCode + (ordinal > 1 ? '-' + String(ordinal).padStart(2, '0') : '');
  }
  function ptNewView() {
    const billing = A.features.finance.billing, p = ptNewPeriod();
    if (!p || !billing) return '<div class="empty">Chưa có kỳ thu hoặc chức năng tính khoản phải thu.</div>';
    const market = ui.market, meter = (A.db.meterPeriods || []).find(x => x.id === p.id), contracts = (A.db.contracts || []).filter(c => c.market === market && c.status === 'hieuluc' && c.start <= p.endDate && (!c.end || c.end >= p.startDate));
    const groups = ptNewGroups(market, p.id), warns = billing.warnings(market, p.id), published = (A.db.invoices || []).filter(i => i.market === market && i.period === p.id && i.billingStatus === 'PUBLISHED'), isPublished = !!published.length, q = (f.ptSearch || '').toLowerCase();
    const rowFilter = f.ptValidation || 'all';
    const sourceRows = isPublished ? published.map(i => ({ traderId: i.traderId, rows: (i.items || []).map(item => ({ amount: item.amount, items: [item], contractId: item.contractId, stallId: item.stallId })), contractIds: i.contractIds || [], amount: i.amount, validationStatus: 'VALID', invoice: i, errors: [] })) : groups;
    const codeCounts = {};
    const withCodes = sourceRows.map(g => { const base = ptReceivableCode(market, p.id, g.traderId, 1), ordinal = (codeCounts[base] || 0) + 1; codeCounts[base] = ordinal; return Object.assign({}, g, { receivableCode: ptReceivableCode(market, p.id, g.traderId, ordinal) }); });
  const shown = withCodes.filter(g => { const t = A.idx.trader.get(g.traderId) || {}; return (rowFilter === 'all' || (rowFilter === 'valid' ? g.validationStatus === 'VALID' : g.validationStatus === 'HAS_ERRORS')) && (!q || [t.name, t.id, g.receivableCode, ...(g.contractIds || [])].join(' ').toLowerCase().includes(q)); });
  const total = U.sum(shown, g => g.amount), issueCount = groups.filter(g => g.validationStatus === 'HAS_ERRORS').length, canManage = A.canDo('phai-thu.phat-hanh', market), calculated = groups.length > 0 || warns.length > 0, ready = calculated && !!groups.length && A.meterPeriodIsClosed(meter, market) && !warns.some(w => String(w.severity || '').toUpperCase() === 'BLOCKING') && !issueCount;
    const state = isPublished ? 'PUBLISHED' : !calculated ? 'NOT_CALCULATED' : ready ? 'READY_TO_PUBLISH' : 'HAS_ERRORS';
    const periods = (A.db.billingPeriods || []).slice().sort((a,b) => b.id.localeCompare(a.id)).map(x => `<option value="${x.id}" ${x.id === p.id ? 'selected' : ''}>${U.esc(x.label || U.per(x.id))}</option>`).join('');
    const readiness = `<div class="row small" style="gap:12px;flex-wrap:wrap;margin-top:10px"><span>${A.meterPeriodIsClosed(meter, market) ? '✓' : '○'} Chỉ số điện, nước: <b>${A.meterPeriodIsClosed(meter, market) ? 'Đã hoàn tất' : 'Chưa hoàn tất'}</b>${A.meterPeriodIsClosed(meter, market) ? ' ' + (A.db.readings || []).filter(r => r.period === p.id && (A.idx.stall.get(r.stallId) || {}).market === market).length + ' điểm' : ''}</span><span>${warns.some(w => w.code && w.code.indexOf('POLICY') >= 0) ? '○' : '✓'} Biểu phí: <b>${warns.some(w => w.code && w.code.indexOf('POLICY') >= 0) ? 'Cần kiểm tra' : 'Đã cấu hình'}</b></span><span>✓ Hợp đồng hiệu lực: <b>${contracts.length} hợp đồng</b></span></div>`;
    return `<div class="card"><div class="card-b"><h2 style="margin:0">Khoản phải thu</h2><div class="row" style="gap:10px;flex-wrap:wrap;margin-top:12px"><label class="small">Kỳ thu</label><select class="input" data-ch="pt-period">${periods}</select><span class="tag">${U.esc((U.market(market) || {}).name || market)}</span><span>${ptNewStatus(state)}</span><span class="spacer"></span>${!isPublished && canManage ? `<button class="btn" data-act="pt-calc">${calculated ? 'Tính lại khoản phải thu' : 'Tính nháp khoản phải thu'}</button><button class="btn primary" data-act="pt-publish-open" ${ready ? '' : 'disabled'}>Phát hành ${groups.length} khoản phải thu</button>` : ''}</div>${readiness}${!isPublished && !ready ? `<div class="small muted" style="margin-top:8px">${!A.meterPeriodIsClosed(meter, market) ? 'Cần hoàn tất và khóa chỉ số điện, nước trước khi tính/phát hành.' : warns.length ? 'Có ' + warns.length + ' dữ liệu cần xử lý trước khi phát hành.' : 'Tính nháp để hệ thống kiểm tra dữ liệu nguồn.'}</div>` : ''}${isPublished ? `<div class="note info" style="margin-top:10px">Đã phát hành ${U.dmy(p.issuedAt || published[0].publishedAt || published[0].issuedAt)} · ${U.esc(p.issuedBy || published[0].publishedBy || '—')}. Snapshot số tiền đã được khóa; theo dõi thanh toán ở màn Thu tiền & biên lai.</div>` : ''}</div></div>
      <div class="kpis"><div class="card kpi"><div class="k-label">Tiểu thương</div><div class="k-value">${shown.length}</div></div><div class="card kpi"><div class="k-label">Hợp đồng / Điểm KD</div><div class="k-value">${isPublished ? U.sum(shown, g => (g.contractIds || []).length) : new Set(groups.flatMap(g => g.contractIds)).size}</div></div><div class="card kpi"><div class="k-label">Tổng dự kiến thu</div><div class="k-value">${U.moneyShort(total)}</div><div class="k-sub">${U.money(total)}</div></div><div class="card kpi"><div class="k-label">Cần xử lý</div><div class="k-value">${issueCount}</div><div class="k-sub">${issueCount ? '' : '✓ Sẵn sàng phát hành'}</div></div></div>
      ${warns.length ? `<div class="note warn"><b>Dữ liệu cần xử lý</b>${warns.map(w => `<div>${U.esc(w.message)}</div>`).join('')}</div>` : ''}
      <div class="card"><div class="card-h"><h3>Danh sách khoản phải thu</h3><div class="seg">${[['all','Tất cả'],['valid','Hợp lệ'],['errors','Cần xử lý']].map(x => `<button class="${rowFilter === x[0] ? 'on' : ''}" data-act="pt-validation" data-id="${x[0]}">${x[1]}</button>`).join('')}</div><input class="input" data-in="pt-search" placeholder="Tìm tiểu thương, mã khoản thu, mã HĐ, mã điểm..." value="${U.esc(f.ptSearch || '')}"></div><div class="card-b">${U.table([{t:'Tiểu thương'},{t:'Mã khoản thu'},{t:'HĐ / Điểm KD',num:true},{t:'Mặt bằng',num:true},{t:'Điện',num:true},{t:'Nước',num:true},{t:'Dịch vụ',num:true},{t:'Tổng phải thu',num:true},{t:'Trạng thái'},{t:'Thao tác'}], shown.map(g => { const t = A.idx.trader.get(g.traderId) || {}, bad = g.validationStatus === 'HAS_ERRORS'; return `<tr><td><b>${U.esc(t.name || g.traderId)}</b><div class="small muted">${U.esc(t.id || g.traderId)}</div></td><td class="small"><b>${U.esc(g.receivableCode)}</b></td><td class="num">${(g.contractIds || []).length}</td><td class="num">${bad && !ptNewAmount(g.rows,'LAND') ? '—' : U.money(ptNewAmount(g.rows,'LAND'))}</td><td class="num">${U.money(ptNewAmount(g.rows,'ELECTRICITY'))}</td><td class="num">${U.money(ptNewAmount(g.rows,'WATER'))}</td><td class="num">${U.money(ptNewAmount(g.rows,'MARKET_SERVICE'))}</td><td class="num"><b>${U.money(g.amount)}</b></td><td>${ptNewStatus(bad ? 'INVALID' : 'VALID')}</td><td><button class="btn sm" data-act="pt-new-detail" data-trader="${U.esc(g.traderId)}" data-period="${p.id}">${bad ? 'Xem lỗi' : 'Xem chi tiết'}</button></td></tr>`; }), {empty:'Chưa có khoản phải thu nháp trong kỳ này.'})}</div></div>`;
  }
  A.VIEWS['phai-thu'] = function () { return ptNewView();
    A.syncDebts();
    const fp = financePeriod(), p = fp.id;
    const periods = A.db.issuedPeriods;
    const billing = A.features.finance.billing;
    const draftRows = billing ? billing.drafts(ui.market, p) : [];
    const billingWarnings = billing ? billing.warnings(ui.market, p) : [];
    const blockingWarnings = billingWarnings.filter(x => x.severity === 'BLOCKING');
    const q = (f.ptSearch || '').toLowerCase();
    const scopeAll = ptScopeAll();
    const meId = (A.currentAccount() || {}).id;
    // Lọc khu + Bản đồ thu chỉ bật cho chợ thu theo phần (cấu hình D.MARKETS[].receivableGrouping 'TRADER',
    // hiện là Chợ Cao Lãnh) — đọc cấu hình chợ, không hard-code mã chợ.
    const zoneMode = (U.market(ui.market) || {}).receivableGrouping === 'TRADER';
    const canMap = zoneMode && A.canDo('phai-thu.ban-do-thu', ui.market);
    const zones = zoneMode ? ptZones() : [], zone = zones.some(z => z.id === f.ptZone) ? f.ptZone : '', view = canMap && f.ptView === 'map' ? 'map' : 'list';
    const inZone = id => !zone || (A.idx.stall.get(id) || {}).section === zone;
    const inv = A.db.invoices.filter(i => i.period === p && ptInScope(i, scopeAll) && U.invStallIds(i).some(inZone));
    const sessionReceivables = sessionCashReceivables(true);
    const rows = ptGroups(inv).filter(g => (!f.ptStatus || (f.ptStatus === 'over' ? g.over : g.status === f.ptStatus))
      && (!q || g.t.name.toLowerCase().includes(q) || g.t.id.toLowerCase().includes(q) || g.list.some(i => i.id.toLowerCase().includes(q) || U.invPoints(i).toLowerCase().includes(q))))
      .sort((a, b) => Number(b.over) - Number(a.over) || (b.amount - b.paid) - (a.amount - a.paid) || a.t.name.localeCompare(b.t.name));
    const sessionRows = sessionReceivables.filter(x => (!f.ptStatus || x.status === f.ptStatus) && sessionCashMatchesSearch(x, q));
    const pg = U.pager('pt' + p, rows.length, 25);
    const spg = U.pager('ptSession' + p, sessionRows.length, 12);
    const amt = U.sum(inv, i => i.amount), paid = U.sum(inv, i => i.paid);
    const allAmt = amt + U.sum(sessionReceivables, x => x.amount), allPaid = paid + U.sum(sessionReceivables, x => x.paid);
    const canIssue = A.canDo('phai-thu.phat-hanh', ui.market);
    const reqRowsAll = ptRequestRows();
    // PHAT_HANH_KHOAN_THU: kỳ đã phát hành ở chợ đang chọn → hiện thông tin phát hành (không còn nút "Mở kỳ thu
    // tiếp theo": mở kỳ thu tháng mới thuộc Cài đặt › Kỳ thu, quyền action:cai-dat.ky-thu).
    const mInv = A.db.invoices.filter(i => i.market === ui.market && i.period === p);
    const issuedHere = mInv.length > 0;
    const notiT = (A.db.notifications || []).find(n => n.kind === 'RECEIVABLE_ISSUED' && n.market === ui.market && n.period === p);
    const notiC = (A.db.notifications || []).find(n => n.kind === 'RECEIVABLE_LIST_TO_COLLECTORS' && n.market === ui.market && n.period === p);
    const issuedInfo = issuedHere && scopeAll ? `<span class="tag ok" title="${U.esc(notiC && notiC.collectorCounts ? 'Danh sách thu: ' + Object.keys(notiC.collectorCounts).map(k => { const a = A.ACCOUNTS && A.ACCOUNTS.get(k); return (a ? a.fullName : k) + ': ' + notiC.collectorCounts[k] + ' điểm'; }).join(' · ') : '')}">Đã phát hành ${mInv.length} khoản${notiT ? ' · ' + U.dmy(notiT.at) + (notiT.by ? ' · ' + U.esc(notiT.by) : '') : ''}</span>${notiT ? `<span class="small muted">Đã gửi thông báo cho ${notiT.sent} tiểu thương${notiC ? ' · đã chuyển danh sách thu cho ' + notiC.sent + ' NV thu phí' : ''}</span>` : ''}` : '';
    return `<div class="card"><div class="card-b" style="padding-top:14px">${financeTimeBarRow('Kỳ thu')}
      <div class="row small" style="margin-top:8px;flex-wrap:wrap"><span class="muted">Hạn nộp: <b>${U.dmy(fp.dueDate)}</b></span><span class="spacer"></span>
      ${issuedInfo}${canIssue ? `${issuedHere ? '' : `<button class="btn" data-act="pt-calc">${U.icon('settings')}Tính khoản thu kỳ này</button>`}${draftRows.length ? `<button class="btn primary" data-act="pt-issue" ${blockingWarnings.length ? 'disabled title="Cần xử lý cảnh báo chặn"' : ''}>Phát hành khoản thu</button>` : ''}` : ''}</div>
      ${draftRows.length || billingWarnings.length ? `<div class="note" style="margin-top:10px"><b>Dự thảo kỳ ${fp.label}:</b> ${draftRows.length} khoản · ${U.money(U.sum(draftRows, x => x.amount))}${billingWarnings.length ? ` · <span class="${blockingWarnings.length ? 'danger' : 'warn'}">${billingWarnings.length} cảnh báo${blockingWarnings.length ? ' chặn phát hành' : ''}</span>` : ''}${draftRows.length ? ` · <button class="link-btn" data-act="pt-draft-open">Xem kiểm tra</button>` : ''}</div>` : ''}</div></div>
    ${scopeAll ? `<div class="kpis">
      <div class="card kpi"><div class="k-label">Số khoản phải thu</div><div class="k-value">${inv.length + sessionReceivables.length}</div><div class="k-sub">Gồm khoản cố định và khoản đăng ký phiên</div></div>
      <div class="card kpi"><div class="k-label">Tổng phải thu</div><div class="k-value">${U.moneyShort(allAmt)}</div><div class="k-sub">${U.money(allAmt)}</div></div>
      <div class="card kpi"><div class="k-label">Đã thu</div><div class="k-value">${U.moneyShort(allPaid)}</div><div class="bar-mini"><i style="width:${U.pct(allPaid, allAmt)}%"></i></div></div>
      <div class="card kpi"><div class="k-label">Còn phải thu</div><div class="k-value" style="color:#df2225">${U.moneyShort(allAmt - allPaid)}</div><div class="k-sub">Tỷ lệ thu ${U.pctTxt(U.pct(allPaid, allAmt))}</div></div></div>` : ptCollectorKpis(ptGroups(inv))}
    ${zoneMode ? `<div class="card"><div class="card-b" style="padding-top:12px"><div class="row" style="gap:8px;flex-wrap:wrap;align-items:center">
      ${canMap ? `<div class="seg"><button class="${view === 'list' ? 'on' : ''}" data-act="pt-view" data-id="list">Danh sách</button><button class="${view === 'map' ? 'on' : ''}" data-act="pt-view" data-id="map">Bản đồ thu</button></div>` : ''}
      <span class="label-sm">Khu vực</span><select class="input" style="width:240px" data-ch="pt-zone"><option value="">Tất cả khu</option>${zones.map(z => `<option value="${U.esc(z.id)}" ${zone === z.id ? 'selected' : ''}>${U.esc(z.name)}</option>`).join('')}</select>
      ${zone && scopeAll ? '<span class="small muted">Hiện mọi mã khoản có ít nhất 1 điểm thuộc khu này; cột Số tiền / Đã thu là phần của khu.</span>' : ''}</div></div></div>` : ''}
    ${view === 'map' ? ptMapHtml(fp, scopeAll, zone) : ''}
    <div class="card" ${view === 'map' ? 'style="display:none"' : ''}><div class="card-h"><h3>Danh sách khoản phải thu kỳ ${fp.label}${zone ? ' · ' + U.esc((zones.find(z => z.id === zone) || {}).name || zone) : ''}</h3>
      <select class="input" data-ch="pt-status"><option value="">Mọi trạng thái</option><option value="paid" ${f.ptStatus === 'paid' ? 'selected' : ''}>Đã thu</option><option value="unpaid" ${f.ptStatus === 'unpaid' ? 'selected' : ''}>Chưa thu</option><option value="partial" ${f.ptStatus === 'partial' ? 'selected' : ''}>Thu một phần</option><option value="over" ${f.ptStatus === 'over' ? 'selected' : ''}>Quá hạn</option></select>
      <input class="input" placeholder="Mã khoản, tiểu thương, mã tiểu thương, mã điểm" data-in="pt-search" value="${U.esc(f.ptSearch || '')}"></div>
      ${scopeAll ? '' : '<div class="card-b" style="padding-bottom:0"><div class="note info">Đang hiển thị khoản phải thu của các điểm kinh doanh được phân công cho bạn.</div></div>'}
      <div class="card-b">${U.table(scopeAll ? [{ t: 'Mã khoản' }, { t: 'Tiểu thương' }, { t: 'Số tiền', num: true }, { t: 'Đã thu', num: true }, { t: 'Hạn nộp' }, { t: 'Trạng thái' }] : [{ t: 'Mã khoản' }, { t: 'Tiểu thương' }, { t: 'Điểm KD của bạn' }, { t: 'Số tiền', num: true }, { t: 'Hạn nộp' }, { t: 'Trạng thái' }],
        rows.slice(pg.start, pg.end).map(g => { const one = g.list.length === 1 ? g.list[0] : null; return `<tr class="click" ${one ? `data-act="inv-open" data-id="${one.id}"` : `data-act="pt-trader-open" data-id="${g.t.id}"`}><td>${one ? one.id : `<b>${g.list.length} khoản</b><div class="small muted">Xem chi tiết</div>`}${g.adjusted ? ' <span class="tag purple">Miễn giảm</span>' : ''}</td><td>${U.esc(g.t.name)}<div class="small muted">${g.t.id}</div></td>
          ${scopeAll ? `<td class="num">${U.money(g.amount)}${one && one.portion && zone ? `<div class="small muted">Tổng mã: ${U.money((A.idx.invoice.get(one.id) || one).amount)}</div>` : ''}</td><td class="num">${U.money(g.paid)}</td>` : `<td>${U.esc(ptMyPoints(g.list))}</td><td class="num"><b>${U.money(g.amount)}</b></td>`}<td>${U.dmy(g.due)}</td><td>${one && A.invPartMode(one) ? U.invTag(one) : U.invTag(g)}${g.pending ? ' <span class="tag warn">Chờ điều chỉnh</span>' : ''}</td></tr>`; }), { empty: scopeAll ? 'Chưa có khoản phải thu trong kỳ' : 'Chưa có khoản phải thu của điểm được phân công cho bạn' })}${pg.html}</div></div>
    ${!scopeAll && !sessionRows.length ? '' : `<div class="card"><div class="card-h"><h3>Khoản thu tiền mặt đăng ký phiên chợ</h3></div>
      <div class="card-b">${U.table([{ t: 'Mã đăng ký' }, { t: 'Tiểu thương' }, { t: 'Phiên' }, { t: 'Số tiền', num: true }, { t: 'Đã thu', num: true }, { t: 'Hạn thu' }, { t: 'Trạng thái' }],
        sessionRows.slice(spg.start, spg.end).map(x => `<tr><td>${U.esc(x.id)}<div class="small muted">${U.esc(x.payment.id)}</div></td><td>${U.esc(x.trader.name)}<div class="small muted">${x.trader.id}</div></td>
          <td>${U.dmy(x.session.sessionDate || x.session.date)}<div class="small muted">${U.esc(x.session.name || x.session.id)}</div></td>
          <td class="num">${U.money(x.amount)}</td><td class="num">${U.money(x.paid)}</td><td>${U.esc(x.dueAt || '')}</td><td>${sessionCashStatusTag(x)}</td></tr>`),
        { empty: 'Chưa có khoản thu tiền mặt từ đăng ký phiên chợ' })}${spg.html}</div></div>`}
    ${!scopeAll && !reqRowsAll.length ? '' : `<div class="card"><div class="card-h"><h3>Yêu cầu miễn giảm / điều chỉnh</h3></div>
      <div class="card-b">${U.table([{ t: 'Mã yêu cầu' }, { t: 'Khoản' }, { t: 'Dòng điều chỉnh' }, { t: 'Hiện tại', num: true }, { t: 'Đề nghị', num: true }, { t: 'Chênh lệch', num: true }, { t: 'Lý do' }, { t: 'Trạng thái' }, { t: '' }],
        reqRowsAll, { empty: 'Chưa có yêu cầu điều chỉnh' })}</div></div>`}`;
  };
  A.CH['pt-status'] = el => { f.ptStatus = el.value; A.render(); };
  A.CH['pt-period'] = el => { f.ptPeriod = el.value; A.render(); };
  A.ACT['pt-validation'] = el => { f.ptValidation = el.dataset.id || 'all'; A.render(); };
  A.CH['pt-zone'] = el => { if (!U.can('phai-thu')) return; f.ptZone = el.value; A.render(); };
  // Bản đồ thu: action:phai-thu.ban-do-thu (kiểm tra lại trong handler, không chỉ ẩn nút).
  A.ACT['pt-view'] = el => { if (!U.can('phai-thu')) return; if (el.dataset.id === 'map' && !A.canDo('phai-thu.ban-do-thu', ui.market)) return U.toast('Bạn không có quyền xem Bản đồ thu'); f.ptView = el.dataset.id === 'map' ? 'map' : 'list'; A.render(); };
  A.IN['pt-search'] = el => { f.ptSearch = el.value; A.render(); };
  A.ACT['pt-calc'] = () => {
    if (!A.canDo('phai-thu.phat-hanh', ui.market)) return;
    const billing = A.features.finance.billing, fp = ptNewPeriod();
    if (!billing) return U.toast('Chưa tải được chức năng tính khoản thu');
    const out = billing.calculatePeriod(ui.market, fp.id);
    A.render();
    U.toast(out.warnings.some(x => x.severity === 'BLOCKING') ? 'Chưa thể tính nháp: cần hoàn tất dữ liệu nguồn.' : 'Đã tính nháp ' + out.drafts.length + ' thành phần phí để kiểm tra.');
  };
  A.ACT['pt-issue'] = () => {
    if (!A.canDo('phai-thu.phat-hanh', ui.market)) return;
    const billing = A.features.finance.billing, fp = financePeriod();
    if (!billing) return;
    const out = billing.issue(ui.market, fp.id, (A.currentAccount() || {}).fullName || '');
    if (out.blocking.length) return U.toast('Không thể phát hành: còn cảnh báo cần xử lý');
    if (!out.issued.length) return U.toast('Không có khoản dự thảo hợp lệ để phát hành');
    U.log('Phát hành ' + out.issued.length + ' khoản phải thu kỳ ' + fp.id);
    A.render(); U.toast('Đã phát hành ' + out.issued.length + ' khoản phải thu (' + U.moneyShort(U.sum(out.issued, x => x.amount)) + '), đã gửi thông báo cho tiểu thương và chuyển danh sách thu cho NV thu phí');
  };
  A.ACT['pt-draft-open'] = () => {
    const billing = A.features.finance.billing, fp = financePeriod();
    if (!billing) return;
    const rows = billing.drafts(ui.market, fp.id), ws = billing.warnings(ui.market, fp.id);
    A.modal(A.mHead('Kiểm tra dự thảo khoản thu ' + fp.label) + `<div class="modal-b">
      <div class="kpis"><div class="card kpi"><div class="k-label">Khoản dự thảo</div><div class="k-value">${rows.length}</div></div><div class="card kpi"><div class="k-label">Tổng dự kiến</div><div class="k-value">${U.moneyShort(U.sum(rows, x => x.amount))}</div></div><div class="card kpi"><div class="k-label">Cảnh báo</div><div class="k-value">${ws.length}</div></div></div>
      ${ws.length ? `<div class="note" style="margin:12px 0"><b>Cảnh báo</b>${ws.map(w => `<div class="${w.severity === 'BLOCKING' ? 'danger' : 'warn'}">${w.severity === 'BLOCKING' ? 'Không thể phát hành' : 'Cần kiểm tra'}: ${U.esc(w.message)}</div>`).join('')}</div>` : ''}
      ${U.table([{ t: 'Tiểu thương' }, { t: 'Điểm KD' }, { t: 'Khoản thu' }, { t: 'Căn cứ tính' }, { t: 'Số tiền', num: true }], rows.map(d => { const i = d.items[0], t = A.idx.trader.get(d.traderId), st = A.idx.stall.get(d.stallId); return `<tr><td>${U.esc((t || {}).name || d.traderId)}<div class="small muted">${d.traderId}</div></td><td>${U.esc((st || {}).code || '—')}</td><td>${U.esc(i.name || 'Khoản thu')}</td><td class="small">${U.esc(i.explanation || '')}${i.policyReference ? `<div class="muted">${U.esc(i.policyReference)}</div>` : ''}</td><td class="num">${U.money(d.amount)}</td></tr>`; }), { empty: 'Chưa có khoản dự thảo' })}
      </div><div class="modal-f"><button class="btn" data-act="close">Đóng</button></div>`, true);
  };
  function ptStyleDetailCards() {
    setTimeout(() => {
      const modal = document.querySelector('.modal');
      if (!modal) return;
      Array.from(modal.querySelectorAll('section')).filter(s => /^HỢP ĐỒNG\b/.test((s.querySelector('h4') || {}).textContent || '')).forEach(section => {
        section.style.marginTop = '14px';
        section.style.padding = '14px 16px';
        section.style.border = '1px solid #dfe5ee';
        section.style.borderRadius = '12px';
        section.style.background = '#fbfcfe';
        section.style.boxShadow = '0 2px 8px rgba(31, 41, 55, .05)';
        const heading = section.querySelector('h4');
        if (heading) {
          heading.style.margin = '0 0 10px';
          heading.style.paddingBottom = '9px';
          heading.style.borderBottom = '1px solid #e7ebf2';
          heading.style.color = '#25324a';
        }
      });
    }, 0);
  }
  function ptNewDetail(traderId, period) {
    ptStyleDetailCards();
    const billing = A.features.finance.billing, p = (A.db.billingPeriods || []).find(x => x.id === period), group = billing && billing.traderGroups(ui.market, period).find(x => x.traderId === traderId), invoice = (A.db.invoices || []).find(i => i.market === ui.market && i.period === period && i.traderId === traderId), t = A.idx.trader.get(traderId) || {};
    const rows = group ? group.rows : (invoice ? (invoice.items || []).map(item => ({ contractId: item.contractId, stallId: item.stallId, amount: item.amount, items: [item], reviewStatus: 'PUBLISHED' })) : []);
    if (!p || !rows.length) return U.toast('Không tìm thấy chi tiết khoản phải thu.');
    const contracts = Array.from(new Set(rows.map(x => x.contractId))).map(id => ({ id, rows: rows.filter(x => x.contractId === id) }));
    const line = r => { const i = r.items[0] || {}; return `<div style="padding:7px 0;border-bottom:1px solid var(--border,#e5e7eb)"><div class="row"><b>${U.esc(i.name || 'Khoản phí')}</b><span class="spacer"></span><b>${U.money(r.amount)}</b></div><div class="small muted" style="margin-top:3px">${U.esc(i.explanation || '')}${i.chargeType === 'LAND' ? ' = ' + U.money(r.amount) : i.meter ? ' · ' + Number(i.meter.consumption).toLocaleString('vi-VN') + ' ' + U.esc(i.unit || '') + ' × ' + U.money(i.unitPrice) + ' = ' + U.money(r.amount) : ' · ' + U.money(r.amount)}</div></div>`; };
    const errors = group ? group.errors || [] : [];
    const errorsHtml = errors.length ? `<div class="note warn" style="margin-top:14px"><b>⚠ CẦN XỬ LÝ</b>${errors.map(e => { const st = A.idx.stall.get(e.businessPointId) || {}, label = e.chargeType === 'LAND' ? 'Mặt bằng' : e.chargeType === 'ELECTRICITY' ? 'Điện' : e.chargeType === 'WATER' ? 'Nước' : e.chargeType === 'MARKET_SERVICE' ? 'Dịch vụ' : 'Dữ liệu hợp đồng'; const go = e.code.indexOf('POLICY') >= 0 ? 'cau-hinh-gia' : e.code.indexOf('METER') >= 0 || e.code === 'ABNORMAL_CONSUMPTION' ? 'dien-nuoc' : e.code.indexOf('POINT') >= 0 || e.code.indexOf('AREA') >= 0 ? 'mat-bang' : 'hop-dong'; return `<div style="margin-top:8px"><b>${U.esc(e.contractId || 'Hợp đồng')} · ${U.esc(st.code || e.businessPointId || '—')}</b><br>${U.esc(label)}: ❌ ${U.esc(e.message)} <button class="btn sm" data-act="go" data-id="${go}">Đi đến dữ liệu nguồn</button></div>`; }).join('')}</div>` : '';
    A.modal(A.mHead('Chi tiết khoản phải thu') + `<div class="modal-b"><dl class="kv"><dt>Tiểu thương</dt><dd><b>${U.esc(t.name || traderId)}</b> (${U.esc(t.id || traderId)})</dd><dt>Kỳ thu</dt><dd>${U.esc(p.label || U.per(period))}</dd><dt>Số hợp đồng</dt><dd>${contracts.length}</dd></dl>${errorsHtml}${contracts.map(c => { const st = A.idx.stall.get(c.rows[0].stallId) || {}, source = (A.db.contracts || []).find(x => x.id === c.id) || {}, applies = source.serviceApplicability || {}, types = c.rows.map(x => (x.items[0] || {}).chargeType); const absent = [['ELECTRICITY','Điện',applies.electricity],['WATER','Nước',applies.water],['MARKET_SERVICE','Dịch vụ',applies.marketService]].filter(x => !x[2] && !types.includes(x[0])).map(x => `<div class="small muted">${x[1]}: Không đăng ký</div>`).join(''); return `<section style="margin-top:16px"><h4 style="margin:0 0 7px">HỢP ĐỒNG ${U.esc(c.id || '—')}</h4><div class="small muted">Điểm KD: <b>${U.esc(st.code || c.rows[0].stallId || '—')}</b></div>${c.rows.map(line).join('')}${absent}<div class="row" style="padding-top:8px"><b>TỔNG ĐIỂM ${U.esc(st.code || '')}</b><span class="spacer"></span><b>${U.money(U.sum(c.rows, x => x.amount))}</b></div></section>`; }).join('')}<div class="note info" style="margin-top:16px"><b>TỔNG KHOẢN PHẢI THU TIỂU THƯƠNG</b><span style="float:right"><b>${U.money(group ? group.amount : invoice.amount)}</b></span></div></div><div class="modal-f"><button class="btn" data-act="close">Đóng</button></div>`, true);
  }
  A.ACT['pt-new-detail'] = el => ptNewDetail(el.dataset.trader, el.dataset.period);
  A.ACT['pt-review-confirm'] = el => { const billing = A.features.finance.billing, actor = (A.currentAccount() || {}).fullName || ''; if (!A.canDo('phai-thu.phat-hanh', ui.market) || !billing.review(ui.market, el.dataset.period, el.dataset.trader, 'CONFIRM', [], {}, actor)) return U.toast('Không thể xác nhận khoản phải thu.'); A.closeModal(); A.render(); U.toast('Đã xác nhận khoản phải thu của tiểu thương.'); };
  A.ACT['pt-review-reject-open'] = el => {
    const billing = A.features.finance.billing, g = billing.traderGroups(ui.market, el.dataset.period).find(x => x.traderId === el.dataset.trader), t = A.idx.trader.get(el.dataset.trader) || {};
    if (!g) return; const choices = g.contractIds.map(id => { const st = A.idx.stall.get((g.rows.find(r => r.contractId === id) || {}).stallId) || {}; return `<label class="row" style="gap:7px;margin:6px 0"><input type="checkbox" data-pt-contract value="${U.esc(id)}"> ${U.esc(id)} · ${U.esc(st.code || '—')}</label>`; }).join('');
    A.modal(A.mHead('Trả lại kiểm tra khoản phải thu') + `<div class="modal-b"><div class="small muted">Tiểu thương: <b>${U.esc(t.name || el.dataset.trader)}</b></div><div class="field" style="margin-top:12px"><label>Hợp đồng/Điểm cần kiểm tra *</label>${choices}</div><div class="field"><label>Lý do trả lại *</label><textarea id="pt-reject-reason" class="input" rows="3"></textarea></div><div class="field"><label>Loại dữ liệu cần kiểm tra</label><label class="row" style="gap:7px"><input type="checkbox" data-pt-cat value="ELECTRICITY"> Chỉ số điện</label><label class="row" style="gap:7px"><input type="checkbox" data-pt-cat value="WATER"> Chỉ số nước</label><label class="row" style="gap:7px"><input type="checkbox" data-pt-cat value="CONTRACT"> Hợp đồng</label><label class="row" style="gap:7px"><input type="checkbox" data-pt-cat value="RATE"> Biểu phí</label><label class="row" style="gap:7px"><input type="checkbox" data-pt-cat value="OTHER"> Khác</label></div></div><div class="modal-f"><button class="btn" data-act="close">Hủy</button><button class="btn primary" data-act="pt-review-reject" data-trader="${U.esc(el.dataset.trader)}" data-period="${el.dataset.period}">Lưu trả lại</button></div>`, true);
  };
  A.ACT['pt-review-reject'] = el => { const selected = Array.from(document.querySelectorAll('[data-pt-contract]:checked')).map(x => x.value), categories = Array.from(document.querySelectorAll('[data-pt-cat]:checked')).map(x => x.value), reason = (A.$('#pt-reject-reason') || {}).value.trim(), actor = (A.currentAccount() || {}).fullName || ''; if (!reason || !selected.length) return U.toast('Vui lòng chọn hợp đồng/điểm và nhập lý do trả lại.'); if (!A.features.finance.billing.review(ui.market, el.dataset.period, el.dataset.trader, 'REJECT', selected, { reason, categories }, actor)) return; A.closeModal(); A.render(); U.toast('Đã trả lại dữ liệu nguồn để kiểm tra; các hợp đồng khác được giữ nguyên.'); };
  A.ACT['pt-publish-open'] = () => { const billing = A.features.finance.billing, p = ptNewPeriod(), groups = billing.traderGroups(ui.market, p.id), warns = billing.warnings(ui.market, p.id).filter(w => String(w.severity || 'BLOCKING').toUpperCase() === 'BLOCKING'); if (!groups.length || warns.length || groups.some(g => g.validationStatus !== 'VALID')) return U.toast('Cần xử lý toàn bộ lỗi dữ liệu trước khi phát hành.'); A.modal(A.mHead('Phát hành khoản phải thu kỳ ' + U.esc(p.label || U.per(p.id))) + `<div class="modal-b"><dl class="kv"><dt>Chợ</dt><dd>${U.esc((U.market(ui.market) || {}).name || ui.market)}</dd><dt>Tiểu thương</dt><dd>${groups.length}</dd><dt>Hợp đồng/Điểm KD</dt><dd>${new Set(groups.flatMap(g => g.contractIds)).size}</dd><dt>Tổng phải thu</dt><dd><b>${U.money(U.sum(groups, g => g.amount))}</b></dd><dt>Cần xử lý</dt><dd>0</dd></dl><div class="note info">Sau khi phát hành, snapshot số tiền được khóa. Prototype chỉ tạo payment reference/QR metadata và sự kiện thông báo; không tạo thanh toán hay biên lai.</div></div><div class="modal-f"><button class="btn" data-act="close">Hủy</button><button class="btn primary" data-act="pt-publish-confirm" data-period="${p.id}">Xác nhận phát hành</button></div>`, true); };
  A.ACT['pt-publish-confirm'] = el => { const billing = A.features.finance.billing, actor = (A.currentAccount() || {}).fullName || '', out = billing.issue(ui.market, el.dataset.period, actor); if (!out.issued.length) return U.toast('Chưa đủ điều kiện phát hành khoản phải thu.'); U.log('Phát hành ' + out.issued.length + ' khoản phải thu kỳ ' + el.dataset.period); A.closeModal(); A.render(); U.toast('Đã phát hành ' + out.issued.length + ' khoản phải thu.'); };
  // Chi tiết khoản gộp nhiều điểm KD: nhóm dòng theo điểm, mỗi điểm có dòng tiêu đề + tạm tính.
  const ptStaffName = accId => { const a = accId && A.ACCOUNTS.get(accId); return a ? a.fullName : 'Chưa phân công NV thu phí'; };
  function ptStallRows(i, id, indent) {
    const ids = U.invStallIds(i), its = i.items.filter(x => (x.stallId || ids[0]) === id), st = A.idx.stall.get(id) || {};
    if (!its.length) return [];
    return [`<tr style="background:#f5f7fb"><td style="padding-left:${indent}px"><b>Điểm ${U.esc(st.code || id)}</b>${st.sectionName ? ' <span class="small muted">· ' + U.esc(st.sectionName) + '</span>' : ''}</td><td class="num"><b>${U.money(U.sum(its, x => x.amount))}</b></td></tr>`]
      .concat(its.map(x => `<tr><td style="padding-left:${indent + 22}px">${x.name}</td><td class="num">${U.money(x.amount)}</td></tr>`));
  }
  // Chi tiết khoản. Chế độ thu theo phần: nhóm theo PHẦN (NV phụ trách) → điểm → dòng tiền; onlyPart = phần
  // của NV đang xem (NV không được thấy phần của người khác).
  function ptItemRows(i, onlyPart) {
    const ids = U.invStallIds(i);
    if (A.invPartMode(i) && (ids.length > 1 || onlyPart)) {
      const covered = A.invCoveredStalls(i), pays = A.db.payments.filter(p => p.invoiceId === i.id);
      return A.invParts(i).filter(pt => !onlyPart || pt.collectorId === onlyPart.collectorId).reduce((rows, pt) => {
        const pay = pays.find(p => Array.isArray(p.stallIds) && pt.stallIds.every(id => p.stallIds.indexOf(id) !== -1));
        const st = pt.paid ? `<span class="tag ok">Đã thu${pay ? ' · ' + (D.METHOD[pay.method] || pay.method) + ' · ' + pay.receipt : ''}</span>` : (pt.stallIds.some(id => covered.has(id)) ? '<span class="tag warn">Thu dở</span>' : '<span class="tag">Chưa thu</span>');
        rows.push(`<tr style="background:#e9eef7"><td><b>Phần NV ${U.esc(ptStaffName(pt.collectorId))}</b> ${st}</td><td class="num"><b>${U.money(pt.amount)}</b></td></tr>`);
        pt.stallIds.forEach(id => { rows.push.apply(rows, ptStallRows(i, id, 14)); });
        return rows;
      }, []);
    }
    if (ids.length <= 1) return i.items.map(x => `<tr><td>${x.name}</td><td class="num">${U.money(x.amount)}</td></tr>`);
    return ids.reduce((rows, id) => rows.concat(ptStallRows(i, id, 0)), []);
  }
  A.ACT['pt-trader-open'] = el => {
    if (!U.can('phai-thu')) return;
    const fp = financePeriod(), t = A.idx.trader.get(el.dataset.id);
    const list = A.db.invoices.filter(i => i.traderId === el.dataset.id && i.period === fp.id && ptInScope(i));
    if (!t || !list.length) return U.toast('Không có khoản phải thu trong phạm vi xem của bạn');
    const g = ptGroups(list)[0];
    A.modal(A.mHead('Khoản phải thu kỳ ' + fp.label + ' · ' + t.name) + `<div class="modal-b">
      <dl class="kv"><dt>Tiểu thương</dt><dd>${U.esc(t.name)} (${t.id})</dd><dt>Số khoản</dt><dd>${list.length} khoản · ${U.mShort(t.market)}</dd><dt>Hạn nộp</dt><dd>${U.dmy(g.due)}</dd><dt>Trạng thái</dt><dd>${U.invTag(g)}</dd></dl><div class="divider"></div>
      ${U.table([{ t: 'Mã khoản' }, { t: 'Điểm KD' }, { t: 'Nội dung' }, { t: 'Số tiền', num: true }, { t: 'Đã thu', num: true }, { t: 'Trạng thái' }],
        list.map(i => `<tr class="click" data-act="inv-open" data-id="${i.id}"><td><b>${i.id}</b>${i.adjust ? ' <span class="tag purple">Miễn giảm</span>' : ''}</td><td>${U.esc(U.invPoints(i) || '—')}</td><td class="small">${i.items.map(x => U.esc(x.name) + ': ' + U.money(x.amount)).join('<br>')}</td><td class="num">${U.money(i.amount)}</td><td class="num">${U.money(i.paid)}</td><td>${U.invTag(i)}${ptPendingReq(i.id) ? ' <span class="tag warn">Chờ điều chỉnh</span>' : ''}</td></tr>`)
        .concat([`<tr><td colspan="3"><b>Tổng cộng</b></td><td class="num"><b>${U.money(g.amount)}</b></td><td class="num"><b>${U.money(g.paid)}</b></td><td></td></tr>`]))}
      <div class="small muted" style="margin-top:8px">Bấm vào từng khoản để xem chi tiết, biên lai và yêu cầu điều chỉnh.</div>
      </div><div class="modal-f"><button class="btn" data-act="close">Đóng</button></div>`, true);
  };
  A.ACT['inv-open'] = el => {
    const i = A.idx.invoice.get(el.dataset.id);
    if (!i || !U.can('phai-thu') || !ptInScope(i)) return U.toast('Khoản phải thu không thuộc phạm vi xem của bạn');
    const t = A.idx.trader.get(i.traderId);
    let onlyPart = A.invPartMode(i) && !ptScopeAll() ? A.invMyPart(i, (A.currentAccount() || {}).id) : null;
    // BAN_DO_THU_THEO_DIEM: mở từ ô trên Bản đồ thu → chỉ hiện tiền của ĐÚNG điểm đó trong mã khoản (cùng mã,
    // cùng tiểu thương). Phạm vi xem vẫn như cũ: NV thu phí chỉ mở được điểm thuộc phần của mình.
    let stallView = null;
    if (el.dataset.stall && A.invPartMode(i)) {
      const sid = el.dataset.stall;
      if (U.invStallIds(i).indexOf(sid) === -1 || (onlyPart && onlyPart.stallIds.indexOf(sid) === -1)) return U.toast('Điểm kinh doanh không thuộc phạm vi xem của bạn');
      const line = ptStallLine(i, sid, A.invCoveredStalls(i));
      stallView = line;
      onlyPart = { stallIds: [sid], amount: line.amount, paid: line.paid };
    }
    const pays = A.db.payments.filter(p => p.invoiceId === i.id && (!onlyPart || (Array.isArray(p.stallIds) && p.stallIds.some(id => onlyPart.stallIds.indexOf(id) !== -1)))), reqRows = ptRequestRows(i.id);
    A.modal(A.mHead('Khoản phải thu ' + i.id) + `<div class="modal-b">
      <dl class="kv"><dt>Tiểu thương</dt><dd>${U.esc(t.name)} (${t.id})</dd><dt>Điểm KD</dt><dd>${onlyPart ? onlyPart.stallIds.map(id => (A.idx.stall.get(id) || {}).code || id).join(', ') + (stallView ? (stallView.st.sectionName ? ' · ' + U.esc(stallView.st.sectionName) : '') + ` <span class="small muted">(1/${U.invStallIds(i).length} điểm của mã khoản)</span>` : ' <span class="small muted">(phần của bạn)</span>') : U.invStall(i).code} · ${U.mShort(i.market)}</dd>
        <dt>Kỳ / hạn nộp</dt><dd>${U.per(i.period)} · hạn ${U.dmy(i.due)}</dd>${A.debtOf(i) ? `<dt>Công nợ</dt><dd><span class="tag danger">${A.debtOf(i).id}</span> <span class="small muted">Hệ thống tự chuyển lúc ${U.esc(A.debtOf(i).createdAt)} · còn nợ ${U.money(A.debtOf(i).amount)}</span></dd>` : ''}<dt>Trạng thái</dt><dd>${onlyPart ? (onlyPart.paid ? '<span class="tag ok">Đã thu</span>' : '<span class="tag">Chưa thu</span>') : U.invTag(i)}</dd></dl><div class="divider"></div>
      ${A.invPartMode(i) ? ptPartTable(i, onlyPart ? onlyPart.stallIds : null, stallView ? 'Cộng tiền điểm ' + U.esc(stallView.st.code || stallView.id) : '') : ''}${A.invPartMode(i) ? '' : U.table([{ t: 'Nội dung' }, { t: 'Số tiền', num: true }], ptItemRows(i, onlyPart)
        .concat(i.adjust ? [`<tr><td>${U.esc(i.adjust.itemName || 'Điều chỉnh khoản phải thu')} (${U.esc(i.adjust.reason)}) – đã phê duyệt</td><td class="num">${ptMoneySigned(i.adjust.delta != null ? i.adjust.delta : -(i.adjust.value || 0))}</td></tr>`] : [])
        .concat([`<tr><td><b>${onlyPart ? 'Cộng phần của bạn' : 'Tổng cộng'}</b></td><td class="num"><b>${U.money(onlyPart ? onlyPart.amount : i.amount)}</b></td></tr>`]))}
      ${pays.length ? '<div class="divider"></div><b>Thanh toán</b>' + U.table([{ t: 'Biên lai' }, { t: 'Ngày' }, { t: 'Hình thức' }, { t: 'Số tiền', num: true }], pays.map(p => `<tr class="click" data-act="receipt" data-id="${p.receipt}"><td>${p.receipt}</td><td>${U.dmy(p.date)} ${p.time}</td><td>${D.METHOD[p.method]}</td><td class="num">${U.money(p.amount)}</td></tr>`)) : ''}
      ${reqRows.length ? '<div class="divider"></div><b>Yêu cầu điều chỉnh</b>' + U.table([{ t: 'Mã yêu cầu' }, { t: 'Khoản' }, { t: 'Dòng điều chỉnh' }, { t: 'Hiện tại', num: true }, { t: 'Đề nghị', num: true }, { t: 'Chênh lệch', num: true }, { t: 'Lý do' }, { t: 'Trạng thái' }, { t: '' }], reqRows) : ''}
      </div><div class="modal-f">
      ${ptCanRequestAdjust(i) ? `<button class="btn" data-act="inv-adjust" data-id="${i.id}">Gửi yêu cầu miễn giảm / điều chỉnh</button>` : ''}
      <!-- Màn Khoản phải thu chỉ để xem/định hướng thu: không có nút Thu tiền (thu ở màn Thu tiền & biên lai). -->
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
  function receivableCollectAllowedForMarket(market) {
    return A.canCollectReceivable(market);
  }
  // Kỳ thu của chợ đã được NV thu phí "Chốt kỳ thu" (collectionHandoffByMarket) → không ghi nhận thu mới.
  function collectingBusinessStateOk(invoices) {
    const p = financePeriod();
    return invoices.length && p && p.status === 'COLLECTING' && !invoices.some(i => ttHandoff(p, A.receivableMarket(i)));
  }
  // Buổi thu hôm nay của NV đã chốt → không thu tiền mặt thêm trong ngày (tránh tiền mặt ngoài phiếu đã chốt).
  function cashDayClosedFor(market) { const acc = A.currentAccount(); return !!(acc && ttDayClosed(market, acc.code || acc.id, U.today())); }
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
    const invs = A.db.invoices.filter(i => i.traderId === t.id && i.status !== 'paid' && i.market === t.market && !A.invPartMode(i)).sort((a, b) => a.due.localeCompare(b.due));
    // Không thu một phần: số tiền luôn = toàn bộ còn phải thu của các khoản đã chọn.
    const total = U.sum(invs.filter(i => ps.sel.includes(i.id)), U.due);
    const amount = total;
    const currentDebt = U.traderDebt(t.id), willComplete = amount >= currentDebt;
    A.modal(A.mHead('Thu tiền · ' + U.esc(t.name)) + `<div class="modal-b">
      <div class="note ${willComplete ? 'info' : ''}" style="margin-bottom:12px">${willComplete ? 'Sau khi xác nhận, tiểu thương này sẽ hoàn thành toàn bộ khoản phải thu hiện tại.' : 'Sau khi xác nhận, tiểu thương vẫn còn khoản phải thu chưa hoàn thành.'}</div>
      ${U.table([{ t: '' }, { t: 'Khoản' }, { t: 'Kỳ' }, { t: 'Điểm KD' }, { t: 'Hạn' }, { t: 'Còn phải thu', num: true }],
        invs.map(i => `<tr><td><input type="checkbox" data-ch="pay-sel" data-id="${i.id}" ${ps.sel.includes(i.id) ? 'checked' : ''}></td><td>${i.id}</td><td>${U.per(i.period)}</td><td>${U.invStall(i).code}</td><td>${U.isOver(i) ? `<span class="tag danger">${U.dmy(i.due)}</span>` : U.dmy(i.due)}</td><td class="num">${U.money(U.due(i))}</td></tr>`), { empty: 'Không còn khoản nào phải thu' })}
      <div class="form-grid" style="margin-top:14px">
        <div class="field"><label>Số tiền thu (thu đủ các khoản đã chọn)</label><input class="input" value="${U.money(total)}" disabled></div></div>
      <div class="note info" style="margin-top:12px">Khoản phải thu phải được thanh toán đủ. Hệ thống không hỗ trợ thu một phần. Chuyển khoản/QR do hệ thống ghi nhận khi khớp giao dịch thanh toán.</div>
      </div><div class="modal-f"><button class="btn" data-act="close">Hủy</button>
      <button class="btn primary" data-act="pay-confirm" ${amount > 0 ? '' : 'disabled'}>Xác nhận thu tiền mặt & in biên lai</button></div>`, true);
  }
  A.ACT['pay-open'] = el => {
    if (A.current === 'phai-thu') { U.toast('Màn Khoản phải thu chỉ dùng để kiểm tra và gửi yêu cầu điều chỉnh, không thu tiền trực tiếp.'); return; }
    const tid = el.dataset.id, t = A.idx.trader.get(tid);
    if (!t || !receivableCollectAllowedForMarket(t.market)) { U.toast('Không thể thu khoản phải thu trong phạm vi tài khoản hiện tại'); return; }
    const invs = A.db.invoices.filter(i => i.traderId === tid && i.status !== 'paid' && i.market === t.market && !A.invPartMode(i));
    if (!invs.length) { U.toast('Tiểu thương không còn khoản nào phải thu theo cách thu này'); return; }
    if (!collectingBusinessStateOk(invs)) { U.toast('Chỉ thu trực tiếp cho kỳ đang ở trạng thái Đang thu'); return; }
    if (cashDayClosedFor(t.market)) { U.toast('Buổi thu hôm nay đã chốt — tiếp tục thu vào buổi/ngày tiếp theo'); return; }
    ui.pay = { traderId: tid, sel: el.dataset.inv ? [el.dataset.inv] : invs.map(i => i.id), method: 'tm', amount: null };
    renderPay();
  };
  // Adapter của CTA cũ `pay-part-*`: giờ thu phần còn lại của khoản thuộc Market, không còn ownership theo Point.
  function payPartContext(invId) {
    const inv = A.idx.invoice.get(invId), acc = A.currentAccount();
    if (!inv || !acc || inv.status === 'paid' || A.receivableMarket(inv) !== ui.market) return { err: 'Khoản phải thu không còn hợp lệ' };
    if (!receivableCollectAllowedForMarket(inv.market)) return { err: 'Không có quyền thu tiền trong phạm vi tài khoản hiện tại' };
    if (A.debtOf(inv)) return { err: 'Khoản đã quá hạn và chuyển sang Công nợ (' + A.debtOf(inv).id + ') — không thu theo luồng thường, chỉ thu theo luồng thu hồi nợ' };
    if (!collectingBusinessStateOk([inv])) return { err: 'Chỉ thu cho kỳ đang ở trạng thái Đang thu' };
    if (cashDayClosedFor(inv.market)) return { err: 'Buổi thu hôm nay đã chốt — tiếp tục thu vào buổi/ngày tiếp theo' };
    const part = { stallIds: U.invStallIds(inv), due: U.due(inv), paid: inv.status === 'paid' };
    if (part.paid || part.due <= 0) return { err: 'Khoản này đã thu' };
    return { inv, part, acc, t: A.idx.trader.get(inv.traderId) };
  }
  A.ACT['pay-part-open'] = el => {
    const c = payPartContext(el.dataset.id);
    if (c.err) { U.toast(c.err); A.render(); return; }
    const rows = [];
    c.part.stallIds.forEach(id => {
      const st = A.idx.stall.get(id) || {}, its = c.inv.items.filter(x => (x.stallId || U.invStallIds(c.inv)[0]) === id);
      rows.push(`<tr style="background:#f5f7fb"><td><b>Điểm ${U.esc(st.code || id)}</b>${st.sectionName ? ' <span class="small muted">· ' + U.esc(st.sectionName) + '</span>' : ''}</td><td class="num"><b>${U.money(U.sum(its, x => x.amount))}</b></td></tr>`);
      its.forEach(x => rows.push(`<tr><td style="padding-left:22px">${U.esc(x.name)}</td><td class="num">${U.money(x.amount)}</td></tr>`));
    });
    A.modal(A.mHead('Thu tiền · ' + U.esc(c.t.name)) + `<div class="modal-b">
      <dl class="kv"><dt>Mã khoản</dt><dd><b>${c.inv.id}</b> · kỳ ${U.per(c.inv.period)}</dd><dt>Tiểu thương</dt><dd>${U.esc(c.t.name)} (${c.t.id})</dd><dt>Còn phải thu</dt><dd><b>${U.money(c.part.due)}</b></dd></dl>
      <div class="divider"></div>${U.table([{ t: 'Nội dung' }, { t: 'Số tiền', num: true }], rows.concat([`<tr><td><b>Còn phải thu</b></td><td class="num"><b>${U.money(c.part.due)}</b></td></tr>`]))}
      <div class="note info" style="margin-top:12px">Khoản phải thu thuộc Chợ đang chọn. Người thu được lưu theo giao dịch thực tế.</div>
      </div><div class="modal-f"><button class="btn" data-act="close">Hủy</button>
      <button class="btn primary" data-act="pay-part-confirm" data-id="${c.inv.id}" data-method="tm">Xác nhận thu tiền mặt & in biên lai</button></div>`, true);
  };
  A.ACT['pay-part-confirm'] = el => {
    // NV thu phí không tự xác nhận QR/chuyển khoản: hệ thống ghi nhận khi khớp giao dịch thanh toán.
    if (el.dataset.method && el.dataset.method !== 'tm') { U.toast('Chuyển khoản/QR do hệ thống ghi nhận khi khớp giao dịch — không xác nhận thủ công.'); return; }
    const c = payPartContext(el.dataset.id), method = 'tm';
    if (c.err) { U.toast(c.err); A.closeModal(); A.render(); return; }
    const actor = c.acc.code || c.acc.id;
    const pays = A.applyPayment([c.inv.id], c.part.due, method, actor);
    U.log('Thu khoản ' + c.inv.id + ' (' + (method === 'tm' ? 'tiền mặt' : 'QR tại quầy') + ')');
    A.render(); A.showReceipt(pays, { autoPrint: false }); // in khi tiểu thương cần: nút In biên lai
    U.toast('Đã thu ' + U.money(c.part.due) + (method === 'tm' ? ' tiền mặt' : ' qua QR') + ' · biên lai đã gửi Mini app');
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
  A.ACT['pay-confirm'] = () => {
    if (A.current === 'phai-thu') { U.toast('Màn Khoản phải thu không thực hiện thu tiền trực tiếp.'); A.closeModal(); return; }
    const ps = ui.pay;
    const t = ps && A.idx.trader.get(ps.traderId);
    if (!t || !receivableCollectAllowedForMarket(t.market)) { U.toast('Không thể thu khoản phải thu trong phạm vi tài khoản hiện tại'); A.closeModal(); return; }
    const sel = A.db.invoices.filter(i => ps.sel.includes(i.id) && i.traderId === t.id && i.market === t.market && i.status !== 'paid' && !A.invPartMode(i));
    if (!sel.length) { U.toast('Khoản phải thu không còn hợp lệ (đã thu hoặc không thuộc phạm vi)'); A.closeModal(); A.render(); return; }
    if (!collectingBusinessStateOk(sel)) { U.toast('Chỉ thu trực tiếp cho kỳ đang ở trạng thái Đang thu'); return; }
    if (cashDayClosedFor(t.market)) { U.toast('Buổi thu hôm nay đã chốt — tiếp tục thu vào buổi/ngày tiếp theo'); A.closeModal(); return; }
    // Không thu một phần: luôn thu đủ toàn bộ còn phải thu của các khoản đã chọn.
    const total = U.sum(sel, U.due);
    const amount = total;
    if (amount <= 0) { U.toast('Số tiền thu không hợp lệ'); return; }
    const actor = (A.currentAccount() && A.currentAccount().code) || 'NV07';
    const pays = A.applyPayment(sel.map(i => i.id), amount, 'tm', actor);
    const completed = U.traderDebt(t.id) === 0;
    A.render(); A.showReceipt(pays, { autoPrint: true });
    U.toast('Đã thu ' + U.money(amount) + (completed ? ' · tiểu thương đã hoàn thành' : ' · còn khoản phải thu') + ' · biên lai đã gửi Mini app');
  };

  function receiptRows(payDate, methodOverride) {
    const q = (f.receiptSearch || '').toLowerCase();
    const method = methodOverride || f.receiptMethod || 'all';
    const status = f.receiptStatus || 'all';
    return A.db.payments.filter(p => U.inM(p) && A.receiptBusinessStateOk(p) && (!payDate || p.date === payDate))
      .map(p => {
        const i = A.idx.invoice.get(p.invoiceId), t = A.idx.trader.get(p.traderId), st = i && U.invStall(i);
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
      <div class="card"><div class="card-h"><div><h3>Thu phí theo phiên trực tiếp</h3><div class="small muted">Các khoản đăng ký phiên chợ quê cần thu trực tiếp trước điểm danh.</div></div><span class="spacer"></span><span class="tag warn">${sessionList.length} chờ thu</span></div>
        <div class="card-b">${U.table([{ t: 'Tiểu thương' }, { t: 'Đăng ký / phiên' }, { t: 'Hạn thu' }, { t: 'Số tiền', num: true }, { t: 'Trạng thái' }, { t: '' }],
          sessionList.slice(spg.start, spg.end).map(x => `<tr><td><b>${U.esc(x.trader.name)}</b><div class="small muted">${x.trader.id} · ${U.maskPhone(x.trader.phone)}</div></td>
            <td>${U.esc(x.id)}<div class="small muted">${U.dmy(x.session.sessionDate || x.session.date)} · ${U.esc(x.session.name || x.session.id)}</div></td>
            <td>${U.esc(x.dueAt || '')}</td><td class="num">${U.money(x.amount)}</td><td>${sessionCashStatusTag(x)}</td>
            <td>${sessionCashCollectAllowed(x) ? `<button class="btn sm primary" data-act="pay-session-open" data-id="${x.payment.id}">Thu phí trực tiếp</button>` : ''}</td></tr>`),
          { empty: 'Không có đăng ký phiên chờ thu tiền mặt' })}${spg.html}</div></div>
      <div class="card"><div class="card-h"><div><h3>Thu phí cố định tại quầy</h3><div class="small muted">Các khoản phí tháng/quý còn phải thu của tiểu thương.</div></div><span class="spacer"></span><span class="tag">${list.length} hồ sơ</span></div>
        <div class="card-b">
          ${U.table([{ t: 'Tiểu thương' }, { t: 'Điểm KD' }, { t: 'Còn phải thu', num: true }, { t: 'Trạng thái' }, { t: '' }],
          list.slice(pg.start, pg.end).map(x => `<tr><td><b>${U.esc(x.t.name)}</b><div class="small muted">${x.t.id} · ${U.maskPhone(x.t.phone)}</div></td><td>${x.t.stalls.map(id => A.idx.stall.get(id).code).join(', ')}</td><td class="num">${U.money(x.amt)}<div class="small muted">${x.n} khoản</div></td><td>${x.over ? `<span class="tag danger">Quá hạn ${U.moneyShort(x.over)}</span>` : '<span class="tag warn">Chờ thu</span>'}</td><td>${receivableCollectAllowedForMarket(x.t.market) ? `<button class="btn sm primary" data-act="pay-open" data-id="${x.t.id}">Thu tiền</button>` : ''}</td></tr>`), { empty: 'Không còn tiểu thương cần thu' })}${pg.html}
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
  // Correct tab axis: Thu tien / Bien lai. This final assignment supersedes the layout above.
  // ---------- DANH_SACH_DI_THU (Thu tiền › Thu tiền, chợ receivableGrouping 'TRADER' — Chợ Cao Lãnh) ----------
  // Bảng của NV thu phí: mỗi dòng = PHẦN của mình trong 1 mã khoản (các gian mình được phân công của 1 tiểu
  // thương), xếp theo LỘ TRÌNH ĐI THU: khu (theo cấu trúc Mặt bằng) → dãy → số gian. Gồm kỳ đang xem + phần
  // còn nợ của kỳ trước. Trưởng Ban/lãnh đạo (action:phai-thu.xem-toan-cho) chỉ XEM mọi phần, có cột Người thu,
  // không có nút thao tác. Không phát sinh permission mới: thu tiền/ghi chú dùng action:thu-tien.thu + phần
  // phải thuộc chính tài khoản (stall.collectorId), kiểm tra lại trong handler (payPartContext).
  function thuNotes() { A.db.collectionNotes = Array.isArray(A.db.collectionNotes) ? A.db.collectionNotes : []; return A.db.collectionNotes; }
  function thuLastNote(invId, collectorId) { return (A.db.collectionNotes || []).filter(n => n.invoiceId === invId && n.collectorId === collectorId).slice(-1)[0] || null; }
  function thuBreakdown(inv, stallIds) {
    const ids = U.invStallIds(inv), its = inv.items.filter(x => stallIds.indexOf(x.stallId || ids[0]) !== -1);
    const elec = U.sum(its.filter(x => /^Tiền điện/.test(x.name)), x => x.amount), water = U.sum(its.filter(x => /^Tiền nước/.test(x.name)), x => x.amount);
    return { rent: U.sum(its, x => x.amount) - elec - water, elec, water };
  }
  // meId = account đang xem: ô ghi chú đi thu hiện ghi chú của chính người đó (khớp thu-note-inline).
  // Không truyền meId thì lấy an toàn từ A.currentAccount() (tránh ReferenceError meId).
  function thuRouteRows(p, meId) {
    if (meId == null) meId = (A.currentAccount() || {}).id;
    const zones = ptZones(), zIdx = id => { const n = zones.findIndex(z => z.id === id); return n === -1 ? 999 : n; };
    const rows = [];
    A.db.invoices.filter(i => A.receivableMarket(i) === ui.market && (i.period === p || (i.period < p && i.status !== 'paid'))).forEach(i => {
      const sts = U.invStallIds(i).map(id => A.idx.stall.get(id) || {}).sort((a, b) => zIdx(a.section) - zIdx(b.section) || String(a.section).localeCompare(String(b.section)) || (a.num || 0) - (b.num || 0));
      const first = sts[0] || {}, pays = A.db.payments.filter(x => x.invoiceId === i.id);
      const part = { stallIds: U.invStallIds(i), amount: i.amount, due: U.due(i), paid: i.status === 'paid' };
      rows.push({ inv: i, part, sts, first, zone: first.section, zi: zIdx(first.section), t: A.idx.trader.get(i.traderId), pay: i.status === 'paid' ? pays[pays.length - 1] : null, debt: i.status === 'paid' ? null : A.debtOf(i), old: i.period < p, over: i.status !== 'paid' && U.isOver(i), note: thuLastNote(i.id, meId), nParts: 1 });
    });
    return rows.sort((a, b) => a.zi - b.zi || (a.first.num || 0) - (b.first.num || 0) || a.inv.period.localeCompare(b.inv.period));
  }
  function thuRouteHtml(p, payDate) {
    const acc = A.currentAccount() || {}, meId = acc.id, meCode = acc.code || acc.id;
    const canCollect = receivableCollectAllowedForMarket(ui.market);
    const scopeAll = ptScopeAll();
    if (A.allowedMarkets(acc).indexOf(ui.market) === -1) return `<div class="card"><div class="card-b"><div class="empty">Bạn chưa được phân công Chợ này.</div></div></div>`;
    const q = (f.thuSearch || '').toLowerCase();
    const all = thuRouteRows(p.id, meId);
    const zones = ptZones().filter(z => all.some(r => r.sts.some(st => st.section === z.id)));
    const zone = zones.some(z => z.id === f.thuZone) ? f.thuZone : '';
    const status = ['todo', 'done', 'all', 'debt'].indexOf(f.thuStatus) !== -1 ? f.thuStatus : 'all'; // P chốt: mặc định Tất cả — tích Đã thu dòng vẫn ở tại chỗ (mờ)
    // KPI theo khu/người thu đang lọc (không phụ thuộc ô tìm kiếm); bảng theo cả ô tìm kiếm.
    const scoped = all.filter(r => !zone || r.sts.some(st => st.section === zone));
    const base = scoped.filter(r => !q || [r.t && r.t.name, r.t && r.t.id, r.t && r.t.phone, r.inv.id, r.sts.map(st => st.code).join(' '), r.pay && r.pay.receipt].join(' ').toLowerCase().includes(q));
    const inStatus = (r, k) => k === 'all' || (k === 'done' ? r.part.paid : k === 'debt' ? !!r.debt : !r.part.paid && !r.debt);
    const rows = base.filter(r => inStatus(r, status));
    const cur = scoped.filter(r => !r.old), curDone = cur.filter(r => r.part.paid), debtRows = scoped.filter(r => r.debt), todoRows = scoped.filter(r => !r.part.paid && !r.debt);
    const tot = U.sum(cur, r => r.part.amount), got = U.sum(curDone, r => r.part.amount);
    const myPays = A.db.payments.filter(x => U.inM(x) && x.date === payDate && (scopeAll || x.by === meCode) && A.idx.invoice.get(x.invoiceId));
    const cash = U.sum(myPays.filter(x => x.method === 'tm'), x => x.amount), qr = U.sum(myPays.filter(x => x.method !== 'tm'), x => x.amount);
    const kpis = `<div class="kpis">
      <div class="card kpi"><div class="k-label">${scopeAll ? 'Phải thu kỳ ' + p.label + ' (cả chợ)' : 'Phần tôi phải thu kỳ ' + p.label}</div><div class="k-value">${U.moneyShort(tot)}</div><div class="k-sub">${cur.length} tiểu thương · ${U.sum(cur, r => r.part.stallIds.length)} gian</div></div>
      <div class="card kpi"><div class="k-label">Đã thu</div><div class="k-value">${U.moneyShort(got)}</div><div class="bar-mini"><i style="width:${U.pct(got, tot)}%"></i></div><div class="k-sub">${curDone.length}/${cur.length} tiểu thương · ${U.pctTxt(U.pct(got, tot))}</div></div>
      <div class="card kpi"><div class="k-label">Còn phải thu (luồng thường)</div><div class="k-value" style="color:#df2225">${U.moneyShort(U.sum(todoRows, r => r.part.due))}</div><div class="k-sub">${todoRows.length} chưa thu${debtRows.length ? ' · <span style="color:#d6453b">' + debtRows.length + ' quá hạn đã chuyển công nợ (' + U.moneyShort(U.sum(debtRows, r => r.part.due)) + ')</span>' : ''}</div></div>
      <div class="card kpi"><div class="k-label">${scopeAll ? 'Tiền mặt NV đã thu ngày ' : 'Tiền mặt cần nộp BQL ngày '}${U.dmy(payDate)}</div><div class="k-value">${U.moneyShort(cash)}</div><div class="k-sub">${myPays.filter(x => x.method === 'tm').length} biên lai tiền mặt${qr ? ' · QR ' + U.moneyShort(qr) + ' (không nộp tay)' : ''}</div></div></div>`;
    const cnt = k => base.filter(r => inStatus(r, k)).length;
    const filters = `<div class="card"><div class="card-b" style="padding-top:12px"><div class="row" style="gap:8px;flex-wrap:wrap;align-items:center">
      <div class="seg">${[['all', 'Tất cả'], ['todo', 'Chưa thu'], ['done', 'Đã thu'], ['debt', 'Quá hạn · công nợ']].map(x => `<button class="${status === x[0] ? 'on' : ''}" data-act="thu-status" data-id="${x[0]}">${x[1]} (${cnt(x[0])})</button>`).join('')}</div>
      <span class="label-sm">Khu</span><select class="input" style="width:230px" data-ch="thu-zone"><option value="">${scopeAll ? 'Tất cả khu' : 'Tất cả khu của tôi'}</option>${zones.map(z => `<option value="${z.id}" ${zone === z.id ? 'selected' : ''}>${U.esc(z.name)}</option>`).join('')}</select>
      ${scopeAll ? '<span class="tag">Danh sách theo Chợ đang chọn</span>' : ''}
    </div></div></div>`;
    const pg = U.pager('thuRoute', rows.length, 20);
    // THU_TIEN_DANH_DAU (P chốt 29/09): cột Vị trí | Tiểu thương | Mã khoản | Tiền cần thu | Trạng thái | Ghi chú.
    // NV đến gian: nhận tiền mặt → tích "Đã thu" (xác nhận 1 bước) → biên lai phát ngay, gửi tiểu thương, hiện ở
    // "Biên lai đã gửi"; chưa nộp → để nguyên "Chưa thu", ghi chú văn bản tự do ở cột Ghi chú (P chốt 29/09: bỏ nút Thu sau). Tiểu thương tự chuyển khoản/QR → hệ thống tự ghi Đã thu, NV
    // không thao tác gì.
    // Tên cột tiền theo bộ lọc (P 29/09): Đã thu → "Tiền đã thu"; Chưa thu → "Tiền cần thu"; Quá hạn → "Tiền nợ";
    // Tất cả → "Số tiền" + nhãn nhỏ đã thu / cần thu / nợ dưới từng dòng.
    const curStatus = status, moneyCol = { done: 'Tiền đã thu', todo: 'Tiền cần thu', debt: 'Tiền nợ', all: 'Số tiền' }[status];
    const cols = [{ t: 'Vị trí' }, { t: 'Tiểu thương' }, { t: 'Mã khoản' }, { t: moneyCol, num: true }, { t: 'Trạng thái' }, { t: 'Ghi chú' }];
    const zAll = ptZones();
    let lastZone = null;
    const body = [];
    rows.slice(pg.start, pg.end).forEach(r => {
      if (r.zone !== lastZone) {
        lastZone = r.zone;
        const zr = scoped.filter(x => x.zone === r.zone && !x.old), zDone = zr.filter(x => x.part.paid), z = zAll.find(x => x.id === r.zone);
        body.push(`<tr style="background:#eef2f9"><td colspan="${cols.length}"><b>${U.esc(z ? z.name : (r.first.sectionName || r.zone || ''))}</b> <span class="small muted">· ${zDone.length}/${zr.length} tiểu thương đã thu · ${U.money(U.sum(zDone, x => x.part.amount))} / ${U.money(U.sum(zr, x => x.part.amount))}</span></td></tr>`);
      }
      const paid = r.part.paid;
      const rowsOf = r.sts.map(st => st.section).filter((v, n, a) => v && a.indexOf(v) === n);
      const pos = r.sts.map(st => `<b>${U.esc(st.code || '')}</b>`).join(', ') + `<div class="small muted">Dãy ${U.esc(rowsOf.join(', ') || '—')}</div>`;
      const byQr = paid && r.pay && r.pay.method !== 'tm';
      const status = paid
        ? `<span class="tag ok">✓ Đã thu · ${byQr ? 'QR/chuyển khoản' : 'Tiền mặt'}</span>${r.pay ? `<div class="small"><button class="link-btn" data-act="receipt" data-id="${r.pay.receipt}">${r.pay.receipt}</button> <span class="muted">${U.dmy(r.pay.date)} ${r.pay.time || ''}</span></div>` : ''}`
        : r.debt ? `<span class="tag danger">Quá hạn · đã chuyển công nợ</span><div class="small muted">${r.debt.id} · hạn ${U.dmy(r.inv.due)} — không thu theo luồng thường</div>`
        : !scopeAll && canCollect
          // P chốt 29/09: 1 nút trạng thái duy nhất — bấm "Chưa thu" → popup hỏi đổi sang "Đã thu".
          ? `<button class="btn sm" data-act="thu-mark-open" data-id="${r.inv.id}" title="Bấm để đổi trạng thái sang Đã thu" style="gap:6px;border-color:#f0b37a;background:#fff7ef;color:#9a4b0c;font-weight:600">○ Chưa thu <span style="font-weight:400">▸</span></button>${r.over ? `<div class="small" style="color:#d6453b;margin-top:4px">Quá hạn ${U.overDays(r.inv)} ngày</div>` : ''}`
          : `${r.over ? `<span class="tag danger">Quá hạn ${U.overDays(r.inv)} ngày</span>` : '<span class="tag">Chưa thu</span>'}`;
      // Đã thu (đã có biên lai) → hiện rõ nét bình thường, chỉ phân biệt bằng tag xanh "Đã thu".
      body.push(`<tr style="${r.debt ? 'background:#fff5f5' : ''}"><td>${pos}</td>
        <td><b>${U.esc(r.t ? r.t.name : '')}</b><div class="small muted">${r.t ? r.t.id + ' · ' + U.maskPhone(r.t.phone) : ''}</div></td>
        <td>${r.inv.id}<div class="small muted">Kỳ ${U.per(r.inv.period)}${r.old ? ' · <span style="color:#d6453b">nợ kỳ trước</span>' : ''}${r.nParts > 1 ? ' · ' + r.part.stallIds.length + '/' + U.invStallIds(r.inv).length + ' gian' : ''}</div></td>
        <td class="num"><b>${U.money(r.part.amount)}</b>${curStatus === 'all' ? `<div class="small" style="color:${paid ? '#167a3c' : r.debt ? '#d6453b' : '#6b7280'}">${paid ? 'đã thu' : r.debt ? 'nợ' : 'cần thu'}</div>` : ''}</td><td>${status}</td>
        <td class="small">${!paid && !r.debt && !scopeAll && canCollect
          ? `<input class="input" style="min-width:170px" data-ch="thu-note-inline" data-id="${r.inv.id}" placeholder="Ghi chú…" title="Ghi chú nếu chưa nộp / không gặp (không bắt buộc)" value="${U.esc(r.note ? r.note.text : '')}">${r.note && r.note.text ? `<div class="muted">${U.esc(r.note.at)}</div>` : ''}`
          : r.note && r.note.text && !paid ? U.esc(r.note.text) + `<div class="muted">${U.esc(r.note.at)}</div>` : '<span class="muted">—</span>'}</td></tr>`);
    });
    return kpis + filters + `<div class="card"><div class="card-h"><div><h3>${scopeAll ? 'Danh sách thu theo phần của nhân viên' : 'Danh sách đi thu của tôi'} · kỳ ${p.label}</h3><div class="small muted">Xếp theo lộ trình khu → dãy → gian. ${scopeAll ? 'Mỗi dòng là phần của 1 nhân viên trong 1 mã khoản.' : 'Nhận tiền mặt thì bấm nút "Chưa thu" → xác nhận đổi sang "Đã thu" (biên lai phát ngay, gửi tiểu thương); chưa nộp / không gặp thì ghi vào cột Ghi chú (không bắt buộc). Tiểu thương tự chuyển khoản/QR sẽ tự hiện Đã thu. Thu đủ đúng số tiền, không thu một phần, không thu hộ.'}</div></div></div>
      <div class="card-b">${U.table(cols, body, { empty: status === 'todo' ? 'Đã thu hết phần phải thu 🎉' : 'Không có dòng phù hợp' })}${pg.html}</div></div>`;
  }
  // ---------- DOI_SOAT_CUOI_NGAY (chợ thu theo phần) ----------
  // NV thu phí bấm "Chốt buổi thu" → 1 PHIẾU NỘP TIỀN gồm các biên lai tiền mặt CỦA MÌNH trong ngày chưa thuộc phiếu
  // nào (thu tiếp sau đó → buổi mới, phiếu mới). Kế toán BQL nhận tiền, nhập số thực nhận, bấm "Đã đối soát"; lệch
  // thì bắt buộc ghi lý do. Quyền: action:thu-tien.chot-buoi (collector), action:doi-soat.xac-nhan-phieu-nop
  // (market_accountant) — kiểm tra lại trong handler; Trưởng Ban / lãnh đạo chỉ xem (doi-soat.xem-tien-mat).
  function cashHandovers() { A.db.cashHandovers = Array.isArray(A.db.cashHandovers) ? A.db.cashHandovers : []; return A.db.cashHandovers; }
  function hoHandedIds() { const s = new Set(); (A.db.cashHandovers || []).forEach(h => h.paymentIds.forEach(id => s.add(id))); return s; }
  function hoAccByCode(code) { return A.ACCOUNTS.list().find(a => (a.code || a.id) === code) || null; }
  function hoName(code) { const a = hoAccByCode(code); return a ? a.fullName : U.staffName(code); }
  function hoAssignedRows(h, pays) {
    const rows = A.db.rows || [];
    const ids = Array.isArray(h.assignedRowIds) ? h.assignedRowIds : [];
    if (ids.length) return ids.map(id => rows.find(r => r.id === id)).filter(Boolean);
    const pointRowIds = new Set((pays || []).flatMap(p => p.stallIds || []).map(id => (A.idx.stall.get(id) || {}).rowId).filter(Boolean));
    const assigned = rows.filter(r => r.market === h.market && r.collectorId === h.collectorId);
    return assigned.length ? assigned : rows.filter(r => pointRowIds.has(r.id));
  }
  function hoAreaLabel(row) { return row.name + (ptRowPlace(row) ? ' · ' + ptRowPlace(row) : ''); }
  function hoReceiptDetails(p) {
    const inv = A.idx.invoice.get(p.invoiceId), ids = p.stallIds || (inv ? U.invStallIds(inv) : []);
    const stalls = ids.map(id => A.idx.stall.get(id)).filter(Boolean);
    const areas = Array.from(new Set(stalls.map(st => {
      const row = st.rowId && A.idx.row.get(st.rowId);
      return row ? hoAreaLabel(row) : st.sectionName || st.section || '';
    }).filter(Boolean)));
    const items = inv ? inv.items.filter(item => !item.stallId || ids.includes(item.stallId)).map(item => item.name).filter(Boolean) : [];
    return { inv, trader: A.idx.trader.get(p.traderId), stalls, areas, items };
  }
  function hoState(h) {
    if (h.status === 'MATCHED' || (h.status === 'RECONCILED' && !h.diff)) return { id: 'MATCHED', label: 'Đã khớp', cls: 'ok' };
    if (h.status === 'RESOLVED') return { id: 'RESOLVED', label: 'Đã xử lý chênh lệch', cls: 'ok' };
    if (h.status === 'WAITING_EXPLANATION' || (h.status === 'RECONCILED' && h.diff)) return { id: 'WAITING_EXPLANATION', label: 'Chờ giải trình', cls: 'warn' };
    return { id: 'SUBMITTED', label: 'Chờ đối soát', cls: 'info' };
  }
  function hoStatusTag(h) { const s = hoState(h); return `<span class="tag ${s.cls}">${s.label}</span>`; }
  function hoDateTime(h) { return U.esc(h.submittedAt || (U.dmy(h.date) + ' ' + (h.time || ''))); }
  // THU_HOI_NO_CHOT_BUOI (P chốt 29/09): tiền mặt thu nợ chốt buổi RIÊNG ở màn Công nợ (phiếu PNN-…); tiền mặt thu
  // phí thường chốt ở Thu tiền (phiếu PN-…). Cả 2 loại đều do Kế toán BQL xác nhận nộp đủ → kết thúc luồng.
  const hoKindOk = (x, kind) => kind === 'DEBT' ? !!x.debtId : !x.debtId;
  function hoOpenCash(code, market, date, kind) {
    const handed = hoHandedIds();
    return A.db.payments.filter(x => x.market === market && x.method === 'tm' && x.by === code && x.date === date && !handed.has(x.id) && hoKindOk(x, kind || 'FEE') && A.receiptBusinessStateOk(x) && A.idx.invoice.get(x.invoiceId));
  }
  function hoCanClose(market) { return U.can('thu-tien') && A.canDo('thu-tien.chot-buoi', market); }
  function hoCanReconcile(market) { return dsCanAction('doi-soat.xac-nhan-phieu-nop', market); }
  // BIEN_LAI_DA_GUI_THEO_BUOI (P chốt 29/09): màn của NV thu phí — biên lai của chính mình gom theo NGÀY, trong
  // ngày tách cụm: "Chưa chốt" (nhạt — chưa bàn giao) và từng phiếu nộp đã chốt (đậm). Chốt buổi có popup xác
  // nhận. Không phát sinh permission mới: dùng action:thu-tien.chot-buoi, kiểm tra lại trong handler.
  function hoCollectorPanel(p, payDate, kind) {
    kind = kind === 'DEBT' ? 'DEBT' : 'FEE';
    const acc = A.currentAccount() || {}, code = acc.code || acc.id, market = ui.market, q = (f.thuSearch || '').toLowerCase();
    const handedBy = {}; cashHandovers().filter(h => h.market === market && h.collectorCode === code).forEach(h => h.paymentIds.forEach(id => { handedBy[id] = h; }));
    const pays = A.db.payments.filter(x => x.market === market && x.by === code && x.date >= p.startDate && x.date <= p.endDate && A.receiptBusinessStateOk(x) && A.idx.invoice.get(x.invoiceId))
      .filter(x => hoKindOk(x, kind)).filter(x => { if (!q || kind === 'DEBT') return true; const t = A.idx.trader.get(x.traderId); return [x.receipt, x.invoiceId, t && t.name, t && t.id, (x.stallIds || []).map(id => (A.idx.stall.get(id) || {}).code).join(' ')].join(' ').toLowerCase().includes(q); })
      .sort((a, b) => (b.date + b.time).localeCompare(a.date + a.time));
    const open = pays.filter(x => !handedBy[x.id] && x.method === 'tm'), closed = pays.filter(x => handedBy[x.id]);
    const waiting = closed.filter(x => ['SUBMITTED', 'WAITING_EXPLANATION'].includes(hoState(handedBy[x.id]).id)), finished = closed.filter(x => ['MATCHED', 'RESOLVED'].includes(hoState(handedBy[x.id]).id));
    const canClose = hoCanClose(market);
    const kpis = `<div class="kpis">
      <div class="card kpi"><div class="k-label">${kind === 'DEBT' ? 'Biên lai thu nợ' : 'Biên lai đã phát'} kỳ ${p.label}</div><div class="k-value">${pays.length}</div><div class="k-sub">${U.money(U.sum(pays, x => x.amount))}</div></div>
      <div class="card kpi"><div class="k-label">Chưa chốt buổi</div><div class="k-value" style="color:${open.length ? '#d6453b' : '#20a04e'}">${U.moneyShort(U.sum(open, x => x.amount))}</div><div class="k-sub">${open.length} biên lai tiền mặt</div></div>
      <div class="card kpi"><div class="k-label">Đã chốt · chờ kế toán</div><div class="k-value">${U.moneyShort(U.sum(waiting, x => x.amount))}</div><div class="k-sub">${waiting.length} biên lai</div></div>
      <div class="card kpi"><div class="k-label">Đã nộp đủ</div><div class="k-value" style="color:#20a04e">${U.moneyShort(U.sum(finished, x => x.amount))}</div><div class="k-sub">${finished.length} biên lai</div></div></div>`;
    const cols = [{ t: 'Số biên lai' }, { t: 'Mã khoản' }, { t: 'Tiểu thương' }, { t: 'Gian' }, { t: 'Giờ' }, { t: 'Hình thức' }, { t: 'Số tiền', num: true }];
    const row = (x, strong) => { const t = A.idx.trader.get(x.traderId); return `<tr class="click" data-act="receipt" data-id="${x.receipt}" style="${strong ? 'font-weight:600' : 'opacity:.5'}"><td style="padding-left:22px">${x.receipt}</td><td>${x.invoiceId}${x.debtId ? ' <span class="tag danger">Thu nợ ' + x.debtId + '</span>' : ''}</td><td>${U.esc(t ? t.name : '')}</td><td>${(x.stallIds || []).map(id => (A.idx.stall.get(id) || {}).code || id).join(', ')}</td><td>${x.time || ''}</td><td>${U.esc(D.METHOD[x.method] || x.method)}</td><td class="num">${U.money(x.amount)}</td></tr>`; };
    const body = [];
    const days = Array.from(new Set(pays.map(x => x.date))).sort().reverse();
    days.forEach(d => {
      const dayPays = pays.filter(x => x.date === d);
      body.push(`<tr style="background:#e3e9f4"><td colspan="${cols.length}"><b>Ngày ${U.dmy(d)}</b> <span class="small muted">· ${dayPays.length} biên lai · ${U.money(U.sum(dayPays, x => x.amount))}</span></td></tr>`);
      const dOpen = dayPays.filter(x => !handedBy[x.id] && x.method === 'tm');
      if (dOpen.length) {
        body.push(`<tr style="background:#fff8ec"><td colspan="${cols.length}"><div class="row" style="align-items:center;gap:10px;flex-wrap:wrap"><span class="tag warn">○ Chưa chốt</span><span class="small">${dOpen.length} biên lai tiền mặt · <b>${U.money(U.sum(dOpen, x => x.amount))}</b> — chưa bàn giao cho kế toán</span><span class="spacer"></span>${canClose && d <= U.today() ? `<button class="btn sm primary" data-act="ho-close-open" data-date="${d}" data-kind="${kind}">Chốt buổi thu${kind === 'DEBT' ? ' nợ' : ''}</button>` : ''}</div></td></tr>`);
        dOpen.forEach(x => body.push(row(x, false)));
      }
      const hs = Array.from(new Set(dayPays.filter(x => handedBy[x.id]).map(x => handedBy[x.id]))).sort((a, b) => b.submittedAt.localeCompare(a.submittedAt));
      hs.forEach(h => {
        const hp = dayPays.filter(x => handedBy[x.id] === h);
        body.push(`<tr style="background:#f0f5ff"><td colspan="${cols.length}"><div class="row" style="align-items:center;gap:10px;flex-wrap:wrap"><button class="link-btn" data-act="ho-view" data-id="${h.id}"><b>${h.id}</b></button><span class="small">Chốt lúc ${U.esc(h.submittedAt)} · ${hp.length} biên lai · <b>${U.money(h.amount)}</b></span><span class="spacer"></span>${hoStatusTag(h)}${hoState(h).id === 'MATCHED' || hoState(h).id === 'RESOLVED' ? `<span class="small muted">${U.esc(h.confirmedBy || h.reconciledBy || '')} · ${U.esc(h.confirmedAt || h.reconciledAt || '')}</span>` : ''}</div></td></tr>`);
        hp.forEach(x => body.push(row(x, true)));
      });
      dayPays.filter(x => !handedBy[x.id] && x.method !== 'tm').forEach(x => body.push(row(x, true)));
    });
    if (kind === 'DEBT') return `<div class="card"><div class="card-h"><div><h3>Tiền mặt thu nợ · chốt buổi nộp Kế toán</h3><div class="small muted">Biên lai thu nợ tiền mặt <b>nhạt</b> = chưa chốt buổi; bấm <b>Chốt buổi thu nợ</b> → mang tiền tới Kế toán Ban Quản lý; Kế toán xác nhận nộp đủ thì luồng thu nợ mới kết thúc. Nợ trả qua QR không cần chốt buổi.</div></div></div>
      <div class="card-b">${kpis}${U.table(cols, body, { empty: 'Chưa có biên lai thu nợ trong kỳ này' })}</div></div>`;
    return kpis + `<div class="card"><div class="card-h"><div><h3>Biên lai đã gửi của tôi · kỳ ${p.label}</h3><div class="small muted">Gom theo ngày. Biên lai <b>nhạt</b> = chưa chốt buổi; bấm <b>Chốt buổi thu</b> để gom thành phiếu nộp tiền (hiện <b>đậm</b>) rồi mang tiền tới Kế toán. Bấm vào biên lai để xem lại / in.</div></div></div>
      <div class="card-b">${U.table(cols, body, { empty: 'Chưa phát hành biên lai nào trong kỳ này' })}</div></div>`;
  }
  function hoReceiptTable(pays) {
    return `<div class="cash-reconcile-receipts">${U.table([{ t: 'Mã biên lai' }, { t: 'Tiểu thương' }, { t: 'Điểm kinh doanh' }, { t: 'Khu/Dãy' }, { t: 'Khoản thu' }, { t: 'Số tiền', num: true }, { t: 'Thời gian thu' }],
      pays.map(p => {
        const d = hoReceiptDetails(p);
        return `<tr><td><b>${U.esc(p.receipt || p.id)}</b></td><td>${U.esc(d.trader ? d.trader.name : p.traderId || '')}</td><td>${d.stalls.map(st => U.esc(st.code || st.id)).join(', ') || '—'}</td><td>${d.areas.map(U.esc).join(', ') || '—'}</td><td>${p.debtId ? 'Thu hồi công nợ ' + U.esc(p.debtId) : U.esc(d.items.join(', ') || (d.inv && d.inv.id) || '')}</td><td class="num">${U.money(p.amount)}</td><td>${U.dmy(p.date)} ${U.esc(p.time || '')}</td></tr>`;
      }), { empty: 'Phiếu chưa có biên lai tiền mặt tham chiếu' })}</div>`;
  }
  const hoDateOk = d => /^\d{4}-\d{2}-\d{2}$/.test(d || '') && d <= U.today();
  A.ACT['ho-close-open'] = el => {
    const acc = A.currentAccount() || {}, code = acc.code || acc.id, date = (el && el.dataset.date) || U.today(), kind = el && el.dataset.kind === 'DEBT' ? 'DEBT' : 'FEE';
    if (!hoCanClose(ui.market)) return U.toast('Bạn không có quyền chốt buổi thu');
    if (!hoDateOk(date)) return U.toast('Ngày chốt không hợp lệ');
    const open = hoOpenCash(code, ui.market, date, kind);
    if (!open.length) return U.toast('Chưa có biên lai tiền mặt nào chưa chốt');
    A.modal(A.mHead('Xác nhận chốt buổi thu') + `<div class="modal-b">
      <p style="margin:0 0 10px;font-size:1.05em">Bạn có muốn <b>chốt buổi thu${kind === 'DEBT' ? ' nợ' : ''}</b> ngày <b>${U.dmy(date)}</b> không?</p>
      <div class="note info" style="margin-bottom:10px">${open.length} biên lai tiền mặt dưới đây sẽ được khóa trong phiếu riêng của bạn và gửi Kế toán đối soát. Sau khi chốt không thể thêm/bớt biên lai; khoản thu tiếp theo thuộc buổi mới.</div>
      <div class="field" style="max-width:360px;margin-bottom:12px"><label for="ho-declared-amount">Số tiền kê khai nộp</label><input id="ho-declared-amount" class="input" type="number" min="0" step="1000" value="${U.sum(open, x => x.amount)}"></div>
      ${hoReceiptTable(open)}</div>
      <div class="modal-f"><button class="btn" data-act="close">Không, để sau</button><button class="btn primary" data-act="ho-close-confirm" data-date="${date}" data-kind="${kind}">Có, chốt buổi thu${kind === 'DEBT' ? ' nợ' : ''}</button></div>`, true);
  };
  A.ACT['ho-close-confirm'] = el => {
    const acc = A.currentAccount() || {}, code = acc.code || acc.id, date = (el && el.dataset.date) || U.today(), kind = el && el.dataset.kind === 'DEBT' ? 'DEBT' : 'FEE';
    if (!hoCanClose(ui.market)) { U.toast('Bạn không có quyền chốt buổi thu'); A.closeModal(); return; }
    if (!hoDateOk(date)) { U.toast('Ngày chốt không hợp lệ'); A.closeModal(); return; }
    const open = hoOpenCash(code, ui.market, date, kind);
    if (!open.length) { U.toast('Không còn biên lai tiền mặt chưa chốt'); A.closeModal(); A.render(); return; }
    const declaredInput = A.$('#ho-declared-amount'), declaredAmount = declaredInput ? Number(declaredInput.value) : U.sum(open, x => x.amount);
    if (!Number.isFinite(declaredAmount) || declaredAmount < 0) { U.toast('Nhập số tiền kê khai nộp hợp lệ'); return; }
    const d = date.replace(/-/g, '').slice(2), n = cashHandovers().filter(h => h.collectorCode === code && h.date === date && (h.kind || 'FEE') === kind).length + 1;
    const assignedRows = (A.db.rows || []).filter(r => r.market === ui.market && r.collectorId === acc.id);
    const h = { id: (kind === 'DEBT' ? 'PNN-' : 'PN-') + d + '-' + code + '-' + U.pad(n, 2), kind, market: ui.market, marketId: ui.market, periodId: financePeriod().id, collectorId: acc.id, collectorCode: code, collectorName: acc.fullName || hoName(code), date, paymentIds: open.map(x => x.id), amount: U.sum(open, x => x.amount), declaredAmount, assignedRowIds: assignedRows.map(r => r.id), assignedAreas: assignedRows.map(hoAreaLabel), submittedAt: U.dmy(U.today()) + ' ' + U.nowTime(), status: 'SUBMITTED' };
    cashHandovers().push(h);
    U.log('Chốt buổi thu ' + h.id + ': ' + open.length + ' biên lai tiền mặt, ' + U.money(h.amount));
    A.save(); A.closeModal(); A.render(); U.toast('Đã chốt buổi thu ' + h.id + ' · mang ' + U.money(h.amount) + ' tới Kế toán đối soát');
  };
  function hoModal(h) {
    const pays = h.paymentIds.map(id => A.db.payments.find(x => x.id === id)).filter(Boolean);
    const canRec = h.status === 'SUBMITTED' && hoCanReconcile(h.market);
    const declared = h.declaredAmount == null ? h.amount : h.declaredAmount;
    const diff = h.receivedAmount == null ? null : h.receivedAmount - h.amount;
    const confirmer = h.confirmedBy || h.reconciledBy;
    const confirmedAt = h.confirmedAt || h.reconciledAt;
    const areas = h.assignedAreas || hoAssignedRows(h, pays).map(hoAreaLabel);
    const resultMeta = confirmer ? `<div class="small muted" style="margin-top:8px">${U.esc(h.status === 'MATCHED' || (!h.diff && h.status === 'RECONCILED') ? 'Xác nhận bởi' : 'Ghi nhận bởi')} ${U.esc(confirmer)} · ${U.esc(confirmedAt || '')}</div>` : '';
    A.modal(`<div class="cash-reconcile-modal">${A.mHead('Đối soát phiếu · ' + U.esc(h.id))}
      <div class="modal-b">
        <section class="cash-reconcile-section"><h4>Thông tin phiếu</h4><dl class="cash-reconcile-facts">
          <div><dt>Mã phiếu</dt><dd><b>${U.esc(h.id)}</b></dd></div><div><dt>Ngày/giờ chốt</dt><dd>${hoDateTime(h)}</dd></div>
          <div><dt>Chợ</dt><dd>${U.esc(U.market(h.market).name)}</dd></div><div><dt>Nhân viên thu phí</dt><dd><b>${U.esc(h.collectorName || hoName(h.collectorCode))}</b> (${U.esc(h.collectorCode)})</dd></div>
          <div><dt>Khu/Dãy phụ trách</dt><dd>${areas.map(U.esc).join(', ') || '—'}</dd></div><div><dt>Trạng thái phiếu</dt><dd>${hoStatusTag(h)}</dd></div>
        </dl></section>
        <section class="cash-reconcile-section"><h4>Đối chiếu số tiền</h4><dl class="cash-reconcile-facts">
          <div><dt>Tổng tiền theo biên lai tiền mặt</dt><dd><b>${U.money(h.amount)}</b></dd></div><div><dt>Số tiền NV thu phí kê khai nộp</dt><dd>${U.money(declared)}</dd></div>
          ${h.receivedAmount == null ? '' : `<div><dt>Số tiền thực nhận</dt><dd>${U.money(h.receivedAmount)}</dd></div><div><dt>Chênh lệch so với biên lai</dt><dd>${U.money(diff)}</dd></div>`}
        </dl>
        ${canRec ? `<div class="cash-reconcile-inputs"><div class="field"><label for="ho-received">Số tiền thực nhận</label><input id="ho-received" class="input" data-in="ho-received" data-expected="${h.amount}" type="number" min="0" step="1000" value="${h.amount}"></div>
          <div class="cash-reconcile-live-diff"><span>Chênh lệch tự tính</span><output id="ho-difference-preview">0 đ</output></div>
          <div class="field"><label for="ho-note">Lý do chênh lệch (bắt buộc nếu lệch)</label><textarea id="ho-note" class="input" rows="2" placeholder="Nhập lý do hoặc nội dung cần giải trình"></textarea></div></div>` : ''}
        ${h.note ? `<div class="note warn" style="margin-top:10px"><b>Lý do / ghi chú:</b> ${U.esc(h.note)}</div>` : ''}${resultMeta}</section>
        <section class="cash-reconcile-section"><h4>Biên lai tiền mặt thuộc buổi thu <span class="tag">${pays.length}</span></h4>${hoReceiptTable(pays)}</section>
      </div>
      <div class="modal-f"><button class="btn" data-act="close">Đóng</button>${canRec ? `<button class="btn" data-act="ho-reconcile" data-id="${h.id}" data-mode="diff">Ghi nhận chênh lệch</button><button class="btn primary" data-act="ho-reconcile" data-id="${h.id}" data-mode="match">Xác nhận khớp</button>` : ''}</div></div>`, true);
  }
  A.ACT['ho-view'] = el => {
    const h = cashHandovers().find(x => x.id === el.dataset.id);
    if (!h || h.market !== ui.market) return;
    const acc = A.currentAccount() || {};
    if (!(h.collectorCode === (acc.code || acc.id) && U.can('thu-tien')) && !dsCanCash(h.market)) return U.toast('Phiếu không thuộc phạm vi xem của bạn');
    hoModal(h);
  };
  A.ACT['ho-reconcile'] = el => {
    const h = cashHandovers().find(x => x.id === el.dataset.id);
    if (!h || h.market !== ui.market || !hoCanReconcile(h.market)) { U.toast('Bạn không có quyền đối soát phiếu nộp tiền'); A.closeModal(); return; }
    if (h.status !== 'SUBMITTED') { U.toast('Phiếu đã được ghi nhận, không thể sửa kết quả đối soát'); A.closeModal(); A.render(); return; }
    const matching = el.dataset.mode === 'match', inp = A.$('#ho-received'), note = ((A.$('#ho-note') || {}).value || '').trim();
    const received = inp ? Number(inp.value) : NaN;
    if (!Number.isFinite(received) || received < 0) return U.toast('Nhập số tiền thực nhận');
    const diff = received - h.amount;
    if (matching && diff !== 0) return U.toast('Số thực nhận chưa bằng tổng biên lai — kiểm tra lại hoặc ghi nhận chênh lệch');
    if (!matching && diff === 0) return U.toast('Số thực nhận đã khớp tổng biên lai — bấm "Xác nhận khớp"');
    if (!matching && !note) return U.toast('Có chênh lệch ' + U.money(diff) + ' — bắt buộc ghi lý do giải trình');
    const acc = A.currentAccount() || {};
    Object.assign(h, { status: matching ? 'MATCHED' : 'WAITING_EXPLANATION', receivedAmount: received, diff, note: matching ? '' : note, confirmedBy: acc.fullName || '', confirmedByCode: acc.code || acc.id, confirmedAt: U.dmy(U.today()) + ' ' + U.nowTime() });
    U.log('Đối soát phiếu nộp ' + h.id + ': thực nhận ' + U.money(received) + (diff ? ' · lệch ' + U.money(diff) : ''));
    A.save(); A.closeModal(); A.render(); U.toast(diff ? 'Đã ghi nhận nộp lệch ' + U.money(diff) : 'Đã xác nhận ' + hoName(h.collectorCode) + ' nộp đủ ' + U.money(h.amount) + ' — phiếu ' + h.id + ' hoàn tất');
  };
  A.IN['ho-received'] = el => {
    const output = A.$('#ho-difference-preview');
    if (!output) return;
    const received = el.value === '' ? NaN : Number(el.value), expected = Number(el.dataset.expected);
    const diff = Number.isFinite(received) ? received - expected : null;
    output.textContent = diff == null ? '—' : U.money(diff);
    output.classList.toggle('cash-reconcile-diff', diff != null && diff !== 0);
  };
  // Đối soát › Tiền mặt: phiếu chốt buổi thu của Chợ đang chọn (phạm vi theo Account.marketScopes) trong khoảng ngày.
  // h.collectorId/collectorCode là NGƯỜI THỰC TẾ đã chốt/nộp phiếu (lịch sử giao dịch), không phải NV đang phụ trách Chợ.
  function dsHandoverView() {
    const from = dsTxFrom(), to = dsTxTo(), canRec = hoCanReconcile(ui.market);
    const all = cashHandovers().filter(h => h.market === ui.market && h.date >= from && h.date <= to);
    const statusOf = h => hoState(h).id;
    const waiting = all.filter(h => statusOf(h) === 'SUBMITTED');
    const matched = all.filter(h => statusOf(h) === 'MATCHED');
    const explanations = all.filter(h => statusOf(h) === 'WAITING_EXPLANATION');
    const q = (ui.hoSearch || '').trim().toLowerCase();
    const collector = ui.hoCollector || 'all', status = ui.hoStatus || 'all';
    const allowed = new Set(A.allowedMarkets(A.currentAccount()));
    const markets = D.MARKETS.filter(m => allowed.has(m.id));
    const collectors = A.ACCOUNTS.list().filter(a => A.ACCOUNTS.primaryRole(a) === 'collector' && A.allowedMarkets(a).includes(ui.market));
    // NV đã chuyển khỏi Chợ vẫn phải lọc được phiếu lịch sử của mình — bổ sung từ chính các phiếu, không sửa dữ liệu.
    all.forEach(h => {
      if (!h.collectorId || collectors.some(a => a.id === h.collectorId)) return;
      collectors.push({ id: h.collectorId, fullName: h.collectorName || hoName(h.collectorCode) || h.collectorCode || h.collectorId });
    });
    const rows = all.filter(h => (collector === 'all' || h.collectorId === collector)
      && (status === 'all' || statusOf(h) === status)
      && (!q || [h.id, h.collectorName, hoName(h.collectorCode), h.collectorCode].join(' ').toLowerCase().includes(q)))
      .sort((a, b) => b.submittedAt.localeCompare(a.submittedAt));
    const pendingAmount = U.sum(all.filter(h => ['SUBMITTED', 'WAITING_EXPLANATION'].includes(statusOf(h))), h => h.amount);
    const canOpen = h => statusOf(h) === 'SUBMITTED' && canRec;
    const marketFilter = `<select class="input" data-ch="ho-market-filter" aria-label="Chợ">${markets.map(m => `<option value="${m.id}" ${m.id === ui.market ? 'selected' : ''}>${U.esc(m.name)}</option>`).join('')}</select>`;
    const filters = `<div class="card"><div class="card-b row cash-reconcile-filters">
      ${marketFilter}<select class="input" data-ch="ho-collector"><option value="all">Nhân viên thu phí: Tất cả</option>${collectors.map(a => `<option value="${a.id}" ${collector === a.id ? 'selected' : ''}>${U.esc(a.fullName)}</option>`).join('')}</select>
      <select class="input" data-ch="ho-status"><option value="all" ${status === 'all' ? 'selected' : ''}>Trạng thái: Tất cả</option><option value="SUBMITTED" ${status === 'SUBMITTED' ? 'selected' : ''}>Chờ đối soát</option><option value="MATCHED" ${status === 'MATCHED' ? 'selected' : ''}>Đã khớp</option><option value="WAITING_EXPLANATION" ${status === 'WAITING_EXPLANATION' ? 'selected' : ''}>Chờ giải trình</option><option value="RESOLVED" ${status === 'RESOLVED' ? 'selected' : ''}>Đã xử lý chênh lệch</option></select>
      <input class="input" data-in="ho-search" placeholder="Tìm mã phiếu hoặc tên nhân viên" value="${U.esc(ui.hoSearch || '')}">
    </div></div>`;
    const tableRows = rows.map(h => {
      const state = hoState(h);
      const declared = h.declaredAmount == null ? h.amount : h.declaredAmount;
      const difference = h.receivedAmount == null ? null : h.receivedAmount - h.amount;
      return `<tr><td><b>${U.esc(h.id)}</b>${h.kind === 'DEBT' ? '<div><span class="tag">Thu hồi nợ</span></div>' : ''}</td><td>${hoDateTime(h)}</td><td>${U.esc(U.mShort(h.market))}</td><td>${U.esc(h.collectorName || hoName(h.collectorCode))}<div class="small muted">${U.esc(h.collectorCode)}</div></td>
        <td class="num">${h.paymentIds.length}</td><td class="num">${U.money(h.amount)}</td><td class="num">${U.money(declared)}</td><td class="num ${difference && difference !== 0 ? 'cash-reconcile-diff' : ''}">${difference == null ? '—' : U.money(difference)}</td><td><span class="tag ${state.cls}">${state.label}</span></td>
        <td><button class="btn sm ${canOpen(h) ? 'primary' : ''}" data-act="ho-view" data-id="${h.id}">${canOpen(h) ? 'Đối soát' : 'Xem'}</button></td></tr>`;
    });
    return `<div class="kpis cash-reconcile-kpis">
      <div class="card kpi"><div class="k-label">Chờ đối soát</div><div class="k-value">${waiting.length}</div></div>
      <div class="card kpi"><div class="k-label">Đã khớp</div><div class="k-value">${matched.length}</div></div>
      <div class="card kpi"><div class="k-label">Chờ giải trình / Có chênh lệch</div><div class="k-value">${explanations.length}</div></div>
      <div class="card kpi"><div class="k-label">Tổng tiền chờ đối soát</div><div class="k-value">${U.moneyShort(pendingAmount)}</div><div class="k-sub">${U.money(pendingAmount)}</div></div>
    </div>${filters}<div class="card cash-reconcile-list"><div class="card-h"><div><h3>Phiếu chốt buổi thu tiền mặt</h3><div class="small muted">Mỗi phiếu thuộc một nhân viên thu phí, một chợ và một ngày/ca thu. Chỉ biên lai tiền mặt trong phiếu được đối chiếu.</div></div>${!canRec ? '<span class="tag">Chỉ xem</span>' : ''}</div>
      <div class="card-b">${U.table([{ t: 'Mã phiếu chốt buổi thu' }, { t: 'Ngày/giờ chốt' }, { t: 'Chợ' }, { t: 'Nhân viên thu phí' }, { t: 'Số biên lai tiền mặt', num: true }, { t: 'Tổng tiền theo biên lai', num: true }, { t: 'NV kê khai nộp', num: true }, { t: 'Chênh lệch', num: true }, { t: 'Trạng thái' }, { t: 'Thao tác' }], tableRows, { empty: 'Chưa có phiếu chốt buổi thu trong khoảng ngày/kỳ đã chọn' })}</div></div>`;
  }
  A.CH['ho-market-filter'] = el => {
    if (!A.allowedMarkets(A.currentAccount()).includes(el.value)) return;
    ui.market = el.value; ui.page = {}; A.saveUi(); A.route();
  };
  A.CH['ho-collector'] = el => { ui.hoCollector = el.value; ui.page['ho-list'] = 0; A.render(); };
  A.CH['ho-status'] = el => { ui.hoStatus = el.value; ui.page['ho-list'] = 0; A.render(); };
  A.IN['ho-search'] = el => { ui.hoSearch = el.value; ui.page['ho-list'] = 0; A.render(); };
  // BIEN_LAI_DA_GUI (Thu tiền › Biên lai, chợ thu theo phần): NV thấy biên lai CHÍNH MÌNH đã phát & gửi tiểu
  // thương; Trưởng Ban (xem toàn chợ) thấy mọi biên lai, có cột Người thu. Số biên lai gắn mã khoản.
  function thuReceiptsHtml(p, payDate) {
    const acc = A.currentAccount() || {}, meCode = acc.code || acc.id;
    const scopeAll = ptScopeAll();
    if (A.allowedMarkets(acc).indexOf(ui.market) === -1) return `<div class="card"><div class="card-b"><div class="empty">Bạn chưa được phân công Chợ này.</div></div></div>`;
    const q = (f.thuSearch || '').toLowerCase(), onlyDay = f.rcOnlyDay === true;
    const list = A.db.payments.filter(x => U.inM(x) && A.receiptBusinessStateOk(x) && x.date >= p.startDate && x.date <= p.endDate)
      .map(x => ({ p: x, i: A.idx.invoice.get(x.invoiceId), t: A.idx.trader.get(x.traderId) }))
      .filter(x => x.i && (!onlyDay || x.p.date === payDate)
        && (!q || [x.p.receipt, x.i.id, x.t && x.t.name, x.t && x.t.id, (x.p.stallIds || []).map(id => (A.idx.stall.get(id) || {}).code).join(' ')].join(' ').toLowerCase().includes(q)))
      .sort((a, b) => (b.p.date + b.p.time).localeCompare(a.p.date + a.p.time));
    const day = list.filter(x => x.p.date === payDate), cashDay = U.sum(day.filter(x => x.p.method === 'tm'), x => x.p.amount);
    const pg = U.pager('thuRc', list.length, 20);
    const byName = code => { const a = A.ACCOUNTS.list().find(x => x.code === code); return a ? a.fullName : (code === 'Mini app' || code === 'Hệ thống' ? code + ' (tiểu thương tự nộp)' : code); };
    const cols = [{ t: 'Số biên lai' }, { t: 'Mã khoản' }, { t: 'Tiểu thương' }, { t: 'Gian' }, { t: 'Hình thức' }, { t: 'Số tiền', num: true }, { t: 'Thời điểm' }].concat(scopeAll ? [{ t: 'Người thu' }] : []).concat([{ t: 'Gửi tiểu thương' }]);
    if (!scopeAll) return hoCollectorPanel(p, payDate);
    return `<div class="kpis">
      <div class="card kpi"><div class="k-label">Biên lai đã gửi kỳ ${p.label}</div><div class="k-value">${list.length}</div><div class="k-sub">${U.money(U.sum(list, x => x.p.amount))}</div></div>
      <div class="card kpi"><div class="k-label">Biên lai ngày ${U.dmy(payDate)}</div><div class="k-value">${day.length}</div><div class="k-sub">${U.money(U.sum(day, x => x.p.amount))}</div></div>
      <div class="card kpi"><div class="k-label">${scopeAll ? 'Tiền mặt NV thu ngày ' : 'Tiền mặt cần nộp BQL ngày '}${U.dmy(payDate)}</div><div class="k-value">${U.moneyShort(cashDay)}</div><div class="k-sub">${day.filter(x => x.p.method === 'tm').length} biên lai tiền mặt</div></div></div>
      <div class="card"><div class="card-h"><div><h3>${scopeAll ? 'Biên lai đã gửi (toàn chợ)' : 'Biên lai đã gửi'}</h3><div class="small muted">Số biên lai gắn mã khoản (BL-&lt;kỳ&gt;-&lt;số khoản&gt;-&lt;lần thu&gt;); một mã khoản có thể có nhiều biên lai. Tiểu thương nhận đúng số biên lai này.</div></div><span class="spacer"></span>
        <label class="small row" style="gap:6px"><input type="checkbox" data-ch="rc-only-day" ${onlyDay ? 'checked' : ''}> Chỉ ngày ${U.dmy(payDate)}</label></div>
        <div class="card-b">${U.table(cols, list.slice(pg.start, pg.end).map(x => `<tr class="click" data-act="receipt" data-id="${x.p.receipt}"><td><b>${x.p.receipt}</b><div class="small muted">Tra cứu ${x.p.lookup || ''}</div></td><td>${x.i.id}<div class="small muted">Kỳ ${U.per(x.i.period)}</div></td>
          <td>${U.esc(x.t ? x.t.name : '')}<div class="small muted">${x.t ? x.t.id : ''}</div></td><td>${(x.p.stallIds || U.invStallIds(x.i)).map(id => (A.idx.stall.get(id) || {}).code || id).join(', ')}</td>
          <td>${U.esc(D.METHOD[x.p.method] || x.p.method)}</td><td class="num">${U.money(x.p.amount)}</td><td>${U.dmy(x.p.date)} ${x.p.time || ''}</td>
          ${scopeAll ? `<td>${U.esc(byName(x.p.by))}</td>` : ''}<td><span class="tag ok">✓ Mini app · Zalo</span></td></tr>`), { empty: 'Chưa có biên lai nào trong kỳ này' })}${pg.html}</div></div>`;
  }
  A.CH['rc-only-day'] = el => { if (!U.can('thu-tien')) return; f.rcOnlyDay = el.checked; ui.page.thuRc = 0; A.render(); };
  A.ACT['thu-status'] = el => { if (!U.can('thu-tien')) return; f.thuStatus = el.dataset.id; ui.page.thuRoute = 0; A.render(); };
  A.CH['thu-zone'] = el => { if (!U.can('thu-tien')) return; f.thuZone = el.value; ui.page.thuRoute = 0; A.render(); };
  A.CH['thu-collector'] = el => { if (!U.can('thu-tien')) return; f.thuCollector = el.value; ui.page.thuRoute = 0; A.render(); };
  // Ghi chú đi thu (văn bản tự do, không bắt buộc): cùng điều kiện với ghi nhận thu (payPartContext: quyền thu
  // tiền theo chợ, đúng phần được phân công, kỳ Đang thu, chưa thu, chưa chuyển công nợ).
  A.CH['thu-note-inline'] = el => {
    const c = payPartContext(el.dataset.id);
    if (c.err) { U.toast(c.err); A.render(); return; }
    const text = (el.value || '').trim(), last = thuLastNote(c.inv.id, c.acc.id);
    if (text === (last ? last.text : '')) return;
    thuNotes().push({ id: 'GC-' + U.pad(thuNotes().length + 1, 5), kind: 'NOTE', invoiceId: c.inv.id, collectorId: c.acc.id, stallIds: c.part.stallIds.slice(), text, at: U.dmy(U.today()) + ' ' + U.nowTime(), by: c.acc.code || c.acc.id });
    U.log('Ghi chú đi thu khoản ' + c.inv.id + ': ' + (text || '(xóa ghi chú)'));
    A.save(); A.render(); U.toast(text ? 'Đã lưu ghi chú' : 'Đã xóa ghi chú');
  };
  A.ACT['thu-mark-open'] = el => A.CH['thu-mark'](el);
  A.CH['thu-mark'] = el => {
    if ('checked' in el) el.checked = false;
    const c = payPartContext(el.dataset.id);
    if (c.err) { U.toast(c.err); A.render(); return; }
    A.modal(A.mHead('Đổi trạng thái sang "Đã thu"?') + `<div class="modal-b">
      <div style="margin-bottom:10px">Trạng thái hiện tại: <span class="tag warn">○ Chưa thu</span> → <span class="tag ok">✓ Đã thu</span></div>
      <dl class="kv"><dt>Tiểu thương</dt><dd><b>${U.esc(c.t.name)}</b> (${c.t.id})</dd><dt>Mã khoản</dt><dd>${c.inv.id} · kỳ ${U.per(c.inv.period)}</dd>
        <dt>Gian</dt><dd>${c.part.stallIds.map(id => (A.idx.stall.get(id) || {}).code || id).join(', ')}</dd><dt>Số tiền</dt><dd><b style="font-size:1.2em">${U.money(c.part.due)}</b></dd></dl>
      <div class="note info" style="margin-top:10px">Xác nhận là biên lai điện tử được phát ngay (số biên lai gắn mã khoản ${c.inv.id}), gửi tới tiểu thương qua Mini app/Zalo và lưu ở "Biên lai đã gửi" của bạn.</div></div>
      <div class="modal-f"><button class="btn" data-act="close">Hủy</button><button class="btn primary" data-act="pay-part-confirm" data-id="${c.inv.id}" data-method="tm">✓ Đã nhận đủ tiền mặt · đổi thành Đã thu</button></div>`);
  };
  A.VIEWS['thu-tien'] = function () {
    A.syncDebts();
    const q = (f.thuSearch || '').toLowerCase();
    const payDate = f.thuDate || U.today();
    const p = financePeriod();
    const debtors = new Map(), me = (A.currentAccount() || {}).id, partRows = [];
    A.db.invoices.filter(i => U.inM(i) && i.status !== 'paid').forEach(i => {
      if (A.invPartMode(i)) {
        // THU_THEO_PHAN_NHAN_VIEN: NV chỉ thấy PHẦN của mình (không thấy phần/trạng thái của người khác).
        const part = A.invMyPart(i, me);
        if (part && !part.paid) partRows.push({ kind: 'part', inv: i, part, t: A.idx.trader.get(i.traderId), amt: part.due, n: 1, over: U.isOver(i) ? part.due : 0 });
        return;
      }
      const d = debtors.get(i.traderId) || { n: 0, amt: 0, over: 0 };
      d.n++; d.amt += U.due(i); if (U.isOver(i)) d.over += U.due(i);
      debtors.set(i.traderId, d);
    });
    const codesOf = ids => ids.map(id => (A.idx.stall.get(id) || {}).code || id);
    const list = Array.from(debtors.entries()).map(([id, d]) => Object.assign({ kind: 'trader', t: A.idx.trader.get(id) }, d)).concat(partRows)
      .filter(x => x.t && (!q || x.t.name.toLowerCase().includes(q) || x.t.phone.includes(q) || x.t.id.toLowerCase().includes(q) || (x.inv && x.inv.id.toLowerCase().includes(q))
        || (x.kind === 'part' ? codesOf(x.part.stallIds) : x.t.stalls.map(id => A.idx.stall.get(id).code)).some(c => c.toLowerCase().includes(q))))
      .sort((a, b) => b.over - a.over || b.amt - a.amt);
    const sessionList = sessionCashReceivables(false).filter(x => sessionCashMatchesSearch(x, q));
    const receipts = receiptRows(payDate);
    const today = A.db.payments.filter(p => U.inM(p) && p.date === payDate).slice().reverse();
    const cash = U.sum(today.filter(p => p.method === 'tm'), p => p.amount);
    const non = U.sum(today.filter(p => p.method !== 'tm'), p => p.amount);
    const sessionAmt = U.sum(sessionList, x => x.amount), fixedAmt = U.sum(list, x => x.amt);
    const done = receipts.filter(x => x.complete).length;
    const tabs = [['thu-tien', 'Thu tiền'], ['bien-lai', (U.market(ui.market) || {}).receivableGrouping === 'TRADER' ? 'Biên lai đã gửi' : 'Biên lai']];
    const tab = tabs.some(t => t[0] === f.thuTab) ? f.thuTab : 'thu-tien';
    const pg = U.pager('thuCashFixed', list.length, 12);
    const spg = U.pager('thuCashSession', sessionList.length, 12);
    const rpg = U.pager('thuReceipt', receipts.length, 12);
    const timeBar = `<div class="card"><div class="card-b" style="padding-top:14px">${financeTimeBarRow('Kỳ khoản thu')}
      <div class="row small" style="margin-top:10px;gap:8px;flex-wrap:wrap">
        <input class="input" style="min-width:260px;flex:1" placeholder="Tìm tiểu thương, SĐT, mã đăng ký, biên lai, mã điểm" data-in="thu-search" value="${U.esc(f.thuSearch || '')}">
        <span class="label-sm">Ngày thu / biên lai</span><input type="date" class="input" style="width:160px" data-ch="thu-date" value="${payDate}">
        <span class="tag ${p.status === 'COLLECTING' ? 'ok' : ''}">${p.status === 'COLLECTING' ? 'Đang thu' : 'Kỳ trước'}</span>
      </div></div></div>`;
    const tabBar = `<div class="card"><div class="card-b" style="padding-top:14px"><div class="seg">${tabs.map(t => `<button class="${tab === t[0] ? 'on' : ''}" data-act="thu-tab" data-id="${t[0]}">${t[1]}</button>`).join('')}</div></div></div>`;
    if (tab === 'bien-lai' && (U.market(ui.market) || {}).receivableGrouping === 'TRADER') return timeBar + tabBar + thuReceiptsHtml(p, payDate);
    if (tab === 'bien-lai') {
      return timeBar + tabBar + `<div class="kpis">
        <div class="card kpi"><div class="k-label">Tổng biên lai ngày chọn</div><div class="k-value">${receipts.length}</div><div class="k-sub">${U.money(U.sum(receipts, x => x.p.amount))}</div></div>
        <div class="card kpi"><div class="k-label">Hết dư nợ sau thu</div><div class="k-value">${done}</div><div class="k-sub">${U.pctTxt(U.pct(done, receipts.length))}</div></div>
        <div class="card kpi"><div class="k-label">Tiền mặt</div><div class="k-value">${U.moneyShort(cash)}</div><div class="k-sub">${receipts.filter(x => x.p.method === 'tm').length} biên lai</div></div>
        <div class="card kpi"><div class="k-label">QR / chuyển khoản</div><div class="k-value">${U.moneyShort(non)}</div><div class="k-sub">${receipts.filter(x => x.p.method !== 'tm').length} biên lai</div></div></div>
        <div class="card"><div class="card-h"><div><h3>Biên lai & truy vết</h3><div class="small muted">Tra cứu biên lai đã phát hành sau khi ghi nhận thu thành công.</div></div><span class="spacer"></span><span class="tag ok">${done} hết dư nợ</span><span class="tag">${receipts.length} biên lai</span></div><div class="card-b">
          <div class="row" style="gap:8px;flex-wrap:wrap;margin-bottom:10px">
            <input class="input" style="min-width:240px;flex:1" placeholder="Tìm biên lai / tiểu thương / mã điểm" data-in="receipt-search" value="${U.esc(f.receiptSearch || '')}">
            <select class="input" style="width:150px" data-ch="receipt-method"><option value="all">Mọi hình thức</option>${Object.keys(D.METHOD).map(m => `<option value="${m}" ${(f.receiptMethod || 'all') === m ? 'selected' : ''}>${D.METHOD[m]}</option>`).join('')}</select>
            <select class="input" style="width:160px" data-ch="receipt-status"><option value="all">Mọi trạng thái</option><option value="complete" ${(f.receiptStatus || 'all') === 'complete' ? 'selected' : ''}>Hết dư nợ</option><option value="debt" ${(f.receiptStatus || 'all') === 'debt' ? 'selected' : ''}>Còn dư nợ</option></select>
          </div>
          ${U.table([{ t: 'Biên lai' }, { t: 'Tiểu thương' }, { t: 'Điểm / khoản' }, { t: 'Hình thức' }, { t: 'Số tiền', num: true }, { t: 'Sau thu' }],
            receipts.slice(rpg.start, rpg.end).map(x => `<tr class="click" data-act="receipt" data-id="${x.p.receipt}"><td><b>${x.p.receipt}</b><div class="small muted">${U.dmy(x.p.date)} ${x.p.time} · ${x.p.lookup}</div></td><td>${x.t ? U.esc(x.t.name) : ''}<div class="small muted">${x.t ? x.t.id : ''}</div></td><td>${x.st ? x.st.code : (x.reg ? U.esc(x.reg.code || x.reg.id) : '')}<div class="small muted">${x.i ? x.i.id + ' · kỳ ' + U.per(x.i.period) : (x.session ? 'Phiên chợ quê · ' + U.dmy(x.session.sessionDate || x.session.date) : '')}</div></td><td>${D.METHOD[x.p.method]}</td><td class="num">${U.money(x.p.amount)}</td><td>${x.complete ? '<span class="tag ok">Hết dư nợ</span>' : '<span class="tag warn">Còn dư nợ</span>'}</td></tr>`),
            { empty: 'Không tìm thấy biên lai phù hợp' })}${rpg.html}</div></div>`;
    }
    if ((U.market(ui.market) || {}).receivableGrouping === 'TRADER') return timeBar + tabBar + thuRouteHtml(p, payDate);
    return timeBar + tabBar + `<div class="kpis">
      <div class="card kpi"><div class="k-label">Đăng ký phiên chờ thu</div><div class="k-value">${sessionList.length}</div><div class="k-sub">${U.money(sessionAmt)}</div></div>
      <div class="card kpi"><div class="k-label">Phí cố định chờ thu</div><div class="k-value">${list.length}</div><div class="k-sub">${U.money(fixedAmt)}</div></div>
      <div class="card kpi"><div class="k-label">Tiền mặt đã thu ngày chọn</div><div class="k-value">${U.moneyShort(cash)}</div><div class="k-sub">${today.filter(p => p.method === 'tm').length} biên lai</div></div>
      <div class="card kpi"><div class="k-label">Cần thu</div><div class="k-value">${sessionList.length + list.length}</div><div class="k-sub">${U.money(sessionAmt + fixedAmt)}</div></div></div>
      <div class="card"><div class="card-h"><div><h3>Thu phí theo phiên trực tiếp</h3><div class="small muted">Các khoản đăng ký phiên chợ quê cần thu trực tiếp trước điểm danh.</div></div><span class="spacer"></span><span class="tag warn">${sessionList.length} chờ thu</span></div>
        <div class="card-b">${U.table([{ t: 'Tiểu thương' }, { t: 'Đăng ký / phiên' }, { t: 'Hạn thu' }, { t: 'Số tiền', num: true }, { t: 'Trạng thái' }, { t: '' }],
          sessionList.slice(spg.start, spg.end).map(x => `<tr><td><b>${U.esc(x.trader.name)}</b><div class="small muted">${x.trader.id} · ${U.maskPhone(x.trader.phone)}</div></td>
            <td>${U.esc(x.id)}<div class="small muted">${U.dmy(x.session.sessionDate || x.session.date)} · ${U.esc(x.session.name || x.session.id)}</div></td>
            <td>${U.esc(x.dueAt || '')}</td><td class="num">${U.money(x.amount)}</td><td>${sessionCashStatusTag(x)}</td>
            <td>${sessionCashCollectAllowed(x) ? `<button class="btn sm primary" data-act="pay-session-open" data-id="${x.payment.id}">Thu phí trực tiếp</button>` : ''}</td></tr>`),
          { empty: 'Không có đăng ký phiên chờ thu tiền mặt' })}${spg.html}</div></div>
      <div class="card"><div class="card-h"><div><h3>Thu phí cố định tại quầy</h3><div class="small muted">Các khoản phí tháng/quý còn phải thu của tiểu thương.</div></div><span class="spacer"></span><span class="tag">${list.length} hồ sơ</span></div>
        <div class="card-b">${U.table([{ t: 'Tiểu thương' }, { t: 'Điểm KD' }, { t: 'Còn phải thu', num: true }, { t: 'Trạng thái' }, { t: '' }],
          list.slice(pg.start, pg.end).map(x => x.kind === 'part'
            ? `<tr><td><b>${U.esc(x.t.name)}</b><div class="small muted">${x.t.id} · ${U.maskPhone(x.t.phone)}</div></td><td>${codesOf(x.part.stallIds).join(', ')}<div class="small muted">Mã khoản ${x.inv.id}</div></td><td class="num">${U.money(x.amt)}<div class="small muted">Phần của bạn</div></td><td>${x.over ? `<span class="tag danger">Quá hạn</span>` : '<span class="tag warn">Chờ thu</span>'}</td><td>${receivableCollectAllowedForMarket(x.t.market) ? `<button class="btn sm primary" data-act="pay-part-open" data-id="${x.inv.id}">Thu tiền</button>` : ''}</td></tr>`
            : `<tr><td><b>${U.esc(x.t.name)}</b><div class="small muted">${x.t.id} · ${U.maskPhone(x.t.phone)}</div></td><td>${x.t.stalls.map(id => A.idx.stall.get(id).code).join(', ')}</td><td class="num">${U.money(x.amt)}<div class="small muted">${x.n} khoản</div></td><td>${x.over ? `<span class="tag danger">Quá hạn ${U.moneyShort(x.over)}</span>` : '<span class="tag warn">Chờ thu</span>'}</td><td>${receivableCollectAllowedForMarket(x.t.market) ? `<button class="btn sm primary" data-act="pay-open" data-id="${x.t.id}">Thu tiền</button>` : ''}</td></tr>`),
          { empty: 'Không còn tiểu thương cần thu' })}${pg.html}</div></div>`;
  };
  A.ACT['thu-tab'] = el => { f.thuTab = el.dataset.id; ui.page.thu = 0; ui.page.thuReceipt = 0; A.render(); };

  // ---------- THU_TIEN_WORKSPACE — workspace kỳ thu của NV thu phí (bản cuối, thay các layout thu-tien ở trên) ----------
  // Luồng: khoản phải thu đã phát hành → Thu tiền (CHỈ THU ĐỦ, không thu một phần) → biên lai → Chốt buổi thu theo
  // ngày → NV thu phí CHỐT KỲ THU (kỳ của chợ → ĐÃ CHỐT) → sinh bản ghi CHỜ ĐỐI SOÁT cho Kế toán Trung tâm.
  // Không tạo nguồn dữ liệu mới: khoản phải thu = A.db.invoices; giao dịch + biên lai = A.applyPayment → A.db.payments;
  // buổi thu = phiếu A.db.cashHandovers (PN-…, Đối soát đọc nguyên trạng; chỉ bổ sung field mô tả buổi: sessionDate,
  // transfer*); bàn giao kỳ = billingPeriod.collectionHandoffByMarket[market] (cùng mẫu cashReconciliationByMarket).
  // Quyền: thu = A.canCollectReceivable (action:thu-tien.thu) và không phải người xem toàn chợ; chốt buổi + hoàn tất =
  // action:thu-tien.chot-buoi (NV thu phí). Handler luôn kiểm tra lại, không chỉ ẩn nút.
  const TT_STATUS = { PAID: ['Đã thu đủ', 'ok'], UNPAID: ['Chưa thu', 'warn'] };
  const TT_SESSION = { COLLECTING: ['Đang thu', 'info'], NOT_CLOSED: ['Chưa chốt', 'warn'], CLOSED: ['Đã chốt', 'ok'], NO_CASH: ['Không có tiền mặt', ''] };
  const TT_REVIEW_BANK = ['UNMATCHED', 'AMOUNT_MISMATCH', 'NEEDS_REVIEW'];
  const ttTag = (label, cls) => `<span class="tag ${cls || ''}">${U.esc(label)}</span>`;
  const ttIsTransfer = x => x.method !== 'tm';
  const ttSorted = list => list.slice().sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));
  const ttPeriodLabel = p => p.label || U.per(p.id);
  // 1 chợ + 1 kỳ = billingPeriod.collectionHandoffByMarket[market]: bản ghi CHỐT KỲ THU của chợ (NV thu phí) đồng thời
  // là bản ghi ĐỐI SOÁT của Kế toán Trung tâm. billingPeriod dùng chung cho 12 chợ nên KHÔNG đổi billingPeriod.status
  // khi 1 chợ chốt. Hai vòng đời tách nhau: kỳ thu (theo chợ) ĐANG THU → ĐÃ CHỐT (có bản ghi); đối soát
  // reconciliationStatus WAITING → RECONCILED. Bản ghi cũ ("Hoàn tất thu & chuyển đối soát": status
  // WAITING_RECONCILIATION, completedAt/completedBy) được đọc qua các helper dưới đây — không migrate dữ liệu.
  function ttHandoff(p, market) { const m = p && p.collectionHandoffByMarket; return (m && m[market]) || null; }
  const rcClosedAt = r => (r && (r.closedAt || r.completedAt)) || '';
  const rcClosedBy = r => (r && (r.closedBy || r.completedBy)) || '';
  const rcStatus = r => (r && r.reconciliationStatus) || 'WAITING';
  const RC_RESULT = { MATCHED: ['Đủ', 'ok'], SHORTAGE: ['Thiếu', 'danger'], SURPLUS: ['Thừa', 'warn'] };
  // Trạng thái chỉ nêu kết quả Thiếu / Đủ / Thừa; số tiền chênh lệch xem ở chi tiết.
  function rcStatusTag(r) {
    if (!r) return '<span class="tag">Chưa chốt kỳ</span>';
    if (rcStatus(r) !== 'RECONCILED') return '<span class="tag warn">Chờ đối soát</span>';
    const res = RC_RESULT[r.result] || RC_RESULT.MATCHED;
    return `<span class="tag ok">Đã đối soát</span> <span class="tag ${res[1]}">${res[0]}</span>`;
  }
  function ttPeriodState(p, market) {
    if (p.status === 'CLOSED') return { id: 'CLOSED', label: 'Đã chốt kỳ', cls: 'ok' };
    if (ttHandoff(p, market)) return { id: 'CLOSED', label: 'Đã chốt kỳ', cls: 'ok' };
    if (p.status === 'COLLECTING') return { id: 'COLLECTING', label: 'Đang thu', cls: 'info' };
    if (p.status === 'OPEN' || p.status === 'PREPARING') return { id: 'OPEN', label: 'Chưa phát hành', cls: '' };
    return { id: 'PAST', label: 'Kỳ trước', cls: '' };
  }
  function ttCanCollect(market) { return receivableCollectAllowedForMarket(market) && !ptScopeAll(); }
  // Buổi đã chốt qua workspace này (phiếu có sessionDate). Phiếu legacy không có sessionDate không khóa ngày.
  function ttDayClosed(market, code, date) {
    return (A.db.cashHandovers || []).some(h => h.market === market && (h.kind || 'FEE') === 'FEE' && h.collectorCode === code && h.sessionDate === date);
  }
  // ===== PROTOTYPE DEMO BYPASS — TẠM THỜI, chưa phải nghiệp vụ chính thức (chốt theo ngày hay theo phiên chưa quyết định).
  // Gỡ bỏ: đặt PROTOTYPE_COLLECTION_DEMO = false (hoặc xoá khối này) → validation thật hoạt động lại nguyên trạng.
  // Chỉ bypass 2 điểm chặn: (1) thu tiếp sau khi buổi hôm nay đã chốt, (2) Chốt kỳ thu khi chưa đạt checklist.
  // KHÔNG bypass: thu đủ 100%, trùng giao dịch, khoản đã thu, quyền/marketScopes, trạng thái kỳ, dữ liệu buổi đã chốt.
  const PROTOTYPE_COLLECTION_DEMO = true;
  const TT_DEMO = Object.freeze({ allowCollectionAfterDayClose: PROTOTYPE_COLLECTION_DEMO, allowEarlyPeriodClose: PROTOTYPE_COLLECTION_DEMO });
  // Khoá thu vì buổi hôm nay đã chốt (ttDayClosed giữ nguyên; chỉ việc KHOÁ thu được bypass).
  function ttDayLocked(market, code, date) { return !TT_DEMO.allowCollectionAfterDayClose && ttDayClosed(market, code, date); }
  function ttHandedBy(market) {
    const map = {};
    (A.db.cashHandovers || []).filter(h => h.market === market).forEach(h => (h.paymentIds || []).forEach(id => { map[id] = h; }));
    return map;
  }
  function ttRows(p, market) {
    const codeCounts = {};
    return A.db.invoices.filter(i => A.receivableMarket(i) === market && i.period === p.id).map(i => {
      const pays = ttSorted(A.db.payments.filter(x => x.invoiceId === i.id && A.receiptBusinessStateOk(x)));
      const paid = i.status === 'paid';
      const baseCode = ptReceivableCode(market, p.id, i.traderId, 1), ordinal = (codeCounts[baseCode] || 0) + 1;
      codeCounts[baseCode] = ordinal;
      return { inv: i, t: A.idx.trader.get(i.traderId) || { id: i.traderId, name: i.traderId }, pays, last: pays[pays.length - 1] || null,
        status: paid ? 'PAID' : 'UNPAID', remaining: paid ? 0 : Math.max(0, U.due(i)), stallIds: U.invStallIds(i), receivableCode: ptReceivableCode(market, p.id, i.traderId, ordinal) };
    });
  }
  // KẾT QUẢ THU của kỳ (market + period) dùng cho Chốt kỳ thu và Đối soát thu tiền: payment thành công của các khoản phải
  // thu thuộc kỳ/chợ này, LOẠI payment thu hồi công nợ (payment.debtId — luồng THU_HOI_NO/màn Công nợ; nghiệp vụ hiện tại
  // không xét nộp muộn/công nợ). Cùng MỘT tập payment → cash + transfer = collected theo định nghĩa. KPI màn Thu tiền
  // (ttStats) giữ nguyên; module Công nợ và dữ liệu nợ không đổi.
  function ttPeriodCollection(rows) {
    const all = rows.flatMap(r => r.pays), pays = all.filter(x => !x.debtId), debt = all.filter(x => x.debtId);
    const cashPays = pays.filter(x => !ttIsTransfer(x)), transferPays = pays.filter(ttIsTransfer);
    const cash = U.sum(cashPays, x => x.amount), transfer = U.sum(transferPays, x => x.amount);
    return { cashPays, transferPays, cash, transfer, collected: cash + transfer, debtExcluded: U.sum(debt, x => x.amount), debtExcludedCount: debt.length };
  }
  function ttStats(rows) {
    const pays = rows.flatMap(r => r.pays), cash = pays.filter(x => !ttIsTransfer(x)), transfer = pays.filter(ttIsTransfer);
    return { total: rows.length, paid: rows.filter(r => r.status === 'PAID').length, unpaid: rows.filter(r => r.status === 'UNPAID').length,
      amount: U.sum(rows, r => r.inv.amount), collected: U.sum(rows, r => r.inv.amount - r.remaining), remaining: U.sum(rows, r => r.remaining),
      cash: U.sum(cash, x => x.amount), cashCount: cash.length, transfer: U.sum(transfer, x => x.amount), transferCount: transfer.length };
  }
  // Buổi thu = 1 ngày của 1 NV thu phí tại 1 chợ. Tiền mặt của buổi = biên lai tiền mặt thu phí (không gồm thu nợ —
  // chốt riêng ở Công nợ) do NV lập trong ngày, đúng tập hoOpenCash sẽ khóa; CK = giao dịch chuyển khoản/QR hệ thống đã
  // ghi nhận cho khoản phải thu của kỳ trong ngày. code = null → mọi NV của chợ (người xem).
  function ttSessions(p, market, code, rows) {
    const handedBy = ttHandedBy(market), periodInv = new Set(rows.map(r => r.inv.id)), today = U.today();
    const cashAll = A.db.payments.filter(x => x.market === market && x.method === 'tm' && !x.debtId && (!code || x.by === code) && A.receiptBusinessStateOk(x) && A.idx.invoice.get(x.invoiceId));
    const transfers = A.db.payments.filter(x => periodInv.has(x.invoiceId) && ttIsTransfer(x) && A.receiptBusinessStateOk(x));
    const hs = (A.db.cashHandovers || []).filter(h => h.market === market && (h.kind || 'FEE') === 'FEE' && (!code || h.collectorCode === code) && h.periodId === p.id);
    const dates = new Set(cashAll.filter(x => periodInv.has(x.invoiceId)).map(x => x.date).concat(transfers.map(x => x.date), hs.map(h => h.date)));
    if (ttPeriodState(p, market).id === 'COLLECTING' && today >= p.startDate) dates.add(today);
    return Array.from(dates).sort().reverse().map(d => {
      const cash = cashAll.filter(x => x.date === d), tr = transfers.filter(x => x.date === d), open = cash.filter(x => !handedBy[x.id]);
      const dayHs = Array.from(new Set(cash.filter(x => handedBy[x.id]).map(x => handedBy[x.id]).concat(hs.filter(h => h.date === d))));
      const status = open.length ? (d === today && !dayHs.length ? 'COLLECTING' : 'NOT_CLOSED') : dayHs.length ? 'CLOSED' : d === today ? 'COLLECTING' : 'NO_CASH';
      return { date: d, cash, transfers: tr, open, handovers: dayHs, status, cashTotal: U.sum(cash, x => x.amount), transferTotal: U.sum(tr, x => x.amount) };
    });
  }
  function ttChecklist(market, rows, sessions) {
    const handedBy = ttHandedBy(market), periodInv = new Set(rows.map(r => r.inv.id));
    const unpaid = rows.filter(r => r.status !== 'PAID' || r.remaining > 0);
    const openCash = A.db.payments.filter(x => periodInv.has(x.invoiceId) && x.method === 'tm' && !x.debtId && A.receiptBusinessStateOk(x) && !handedBy[x.id]);
    const openSessions = sessions.filter(s => s.open.length);
    const review = (A.db.bank || []).filter(b => b.market === market && TT_REVIEW_BANK.includes(b.status) && (periodInv.has(b.receivableId) || rows.some(r => String(b.ref || '').includes(r.inv.id))));
    const items = [
      { ok: rows.length > 0 && !unpaid.length, text: !rows.length ? 'Chưa có khoản phải thu đã phát hành trong kỳ' : unpaid.length ? `Còn ${unpaid.length} khoản chưa thu · còn ${U.money(U.sum(unpaid, r => r.remaining))} phải thu` : 'Tất cả khoản phải thu đã thanh toán đủ' },
      { ok: !openSessions.length, text: openSessions.length ? `Còn ${openSessions.length} buổi thu chưa chốt` : 'Tất cả buổi thu đã chốt' },
      { ok: !openCash.length, text: openCash.length ? `Còn ${openCash.length} giao dịch tiền mặt chưa chốt buổi` : 'Không còn giao dịch tiền mặt chưa khóa' },
      { ok: !review.length, text: review.length ? `Còn ${review.length} giao dịch chuyển khoản cần tra soát` : 'Không còn giao dịch chờ xử lý' },
      { ok: rows.length > 0 && !U.sum(rows, r => r.remaining), text: U.sum(rows, r => r.remaining) ? 'Tổng đã thu chưa bằng Tổng phải thu' : 'Tổng phải thu = Tổng đã thu' }
    ];
    return { items, ok: items.every(x => x.ok), unpaid, openCash, openSessions, review };
  }
  // Ngữ cảnh dùng chung cho view và handler: mọi số liệu KPI/bảng/checklist lấy từ cùng 1 lần tính.
  function ttContext() {
    const acc = A.currentAccount() || {}, market = ui.market, p = financePeriod();
    if (!p || A.allowedMarkets(acc).indexOf(market) === -1) return null;
    const canClose = hoCanClose(market), code = canClose ? (acc.code || acc.id) : null;
    const rows = ttRows(p, market), sessions = ttSessions(p, market, code, rows);
    return { acc, market, p, code, canClose, rows, s: ttStats(rows), sessions, check: ttChecklist(market, rows, sessions), state: ttPeriodState(p, market) };
  }
  const ttChecklistHtml = check => `<ul class="tt-check">${check.items.map(x => `<li class="${x.ok ? 'is-ok' : 'is-bad'}"><span>${x.ok ? '✓' : '✕'}</span>${U.esc(x.text)}</li>`).join('')}</ul>`;
  function ttBreakdownHtml(inv) {
    const ids = U.invStallIds(inv), items = inv.items || [];
    const html = ids.map(id => {
      const st = A.idx.stall.get(id) || {}, its = items.filter(x => (x.stallId || ids[0]) === id);
      return `<div class="tt-bd-group"><div class="tt-bd-line tt-bd-h"><b>Điểm ${U.esc(st.code || id)}</b><b>${U.money(U.sum(its, x => x.amount))}</b></div>${its.map(x => `<div class="tt-bd-line"><span>${U.esc(x.name || 'Khoản thu')}</span><span>${U.money(x.amount)}</span></div>`).join('')}</div>`;
    }).join('');
    return html || '<div class="small muted">Khoản phải thu không có chi tiết thành phần.</div>';
  }

  function ttHeadHtml(c) {
    const { p, market, s, state } = c, mk = U.market(market) || {}, pct = U.pct(s.paid, s.total);
    const collector = A.ACCOUNTS.getMarketCollector ? A.ACCOUNTS.getMarketCollector(market) : null;
    const markets = (typeof A.effectiveMarkets === 'function' ? A.effectiveMarkets() : D.MARKETS).filter(m => A.allowedMarkets(c.acc).includes(m.id));
    const periods = (A.db.billingPeriods || []).map(x => `<option value="${x.id}" ${x.id === p.id ? 'selected' : ''}>${U.esc(ttPeriodLabel(x))}</option>`).join('');
    const today = c.sessions.find(x => x.date === U.today());
    const canCloseToday = c.canClose && state.id === 'COLLECTING' && today && today.open.length > 0;
    const handoff = ttHandoff(p, market);
    const actions = c.canClose && state.id === 'COLLECTING' ? `<div class="tt-head-actions">
        <button class="btn" data-act="tt-session-close-open" data-date="${U.today()}" ${canCloseToday ? '' : 'disabled'} title="${canCloseToday ? '' : 'Không có giao dịch tiền mặt chưa chốt trong ngày hôm nay'}">Chốt buổi thu hôm nay</button>
        <button class="btn primary" data-act="tt-finish-open" ${c.check.ok || TT_DEMO.allowEarlyPeriodClose ? '' : 'disabled'}>Chốt kỳ thu</button></div>` : '';
    const reason = c.canClose && state.id === 'COLLECTING' && !c.check.ok ? `<div class="tt-head-reason">Chưa đủ điều kiện chốt kỳ thu: ${c.check.items.filter(x => !x.ok).map(x => U.esc(x.text)).join(' · ')}. <button class="link-btn" data-act="tt-tab" data-id="progress">Xem tiến độ kỳ thu</button></div>` : '';
    const handoffNote = handoff ? `<div class="tt-head-reason">${ttClosedNote(handoff)} Không ghi nhận giao dịch mới trong kỳ này.</div>` : '';
    return `<div class="card tt-head"><div class="card-b"><div class="tt-head-b">
      <div class="tt-head-info">
        <div class="tt-head-row"><label class="tt-f"><span>Kỳ thu</span><select class="input" data-ch="fp-select">${periods}</select></label>
          <label class="tt-f"><span>Chợ</span>${markets.length > 1 ? `<select class="input" data-ch="market-select">${markets.map(m => `<option value="${m.id}" ${m.id === market ? 'selected' : ''}>${U.esc(m.name)}</option>`).join('')}</select>` : `<b>${U.esc(mk.name || market)}</b>`}</label>
          <span class="tt-f"><span>Trạng thái</span>${ttTag(state.label, state.cls)}</span></div>
        <dl class="tt-facts"><div><dt>Thời gian thu</dt><dd>${U.dmy(p.startDate)} – ${U.dmy(p.dueDate)}</dd></div><div><dt>Hạn nộp</dt><dd>${U.dmy(p.dueDate)}</dd></div><div><dt>NV thu phí</dt><dd>${U.esc(collector ? collector.fullName : 'Chưa phân công')}</dd></div></dl>
      </div>
      <div class="tt-head-progress"><div class="tt-progress-label">Tiến độ toàn kỳ</div><div class="tt-progress-num"><b>${s.paid} / ${s.total}</b> đã thu <b class="tt-pct">${U.pctTxt(pct)}</b></div><div class="bar-mini"><i style="width:${pct}%"></i></div>${actions}</div>
    </div>${reason}${handoffNote}</div></div>`;
  }
  function ttKpisHtml(s) {
    const k = (label, value, cls) => `<div class="card kpi"><div class="k-label">${label}</div><div class="k-value ${cls || ''}">${value}</div></div>`;
    return `<div class="kpis tt-kpis">${k('Tổng khoản phải thu', s.total)}${k('Đã thu đủ', s.paid, 'tt-ok')}${k('Chưa thu', s.unpaid)}
      ${k('Tiền mặt đã thu kỳ này', U.money(s.cash))}${k('Chuyển khoản đã ghi nhận', U.money(s.transfer))}${k('Còn phải thu', U.money(s.remaining), s.remaining ? 'tt-bad' : 'tt-ok')}</div>`;
  }
  function ttListRows(c) {
    const q = (f.ttSearch || '').trim().toLowerCase(), flt = ['UNPAID', 'PAID'].includes(f.ttStatus) ? f.ttStatus : 'all';
    const base = c.rows.filter(r => !q || [r.t.name, r.t.id, r.t.phone, r.inv.id, r.stallIds.map(id => (A.idx.stall.get(id) || {}).code || id).join(' ')].join(' ').toLowerCase().includes(q));
    const order = { UNPAID: 0, PAID: 1 };
    const rows = base.filter(r => flt === 'all' || r.status === flt).sort(f.ttSort === 'due'
      ? (a, b) => String(a.inv.due).localeCompare(String(b.inv.due)) || order[a.status] - order[b.status] || String(a.t.name).localeCompare(String(b.t.name), 'vi')
      : (a, b) => order[a.status] - order[b.status] || String(a.t.name).localeCompare(String(b.t.name), 'vi'));
    return { base, rows, flt, cnt: k => base.filter(r => k === 'all' || r.status === k).length };
  }
  function ttReplaceTraderCodeColumn(rows) {
    setTimeout(() => {
      const header = Array.from(document.querySelectorAll('th')).find(x => x.textContent.trim() === 'Mã TT');
      if (!header) return;
      header.textContent = 'Mã khoản thu';
      const table = header.closest('table');
      if (!table) return;
      Array.from(table.querySelectorAll('tbody tr')).forEach((tr, index) => {
        const cell = tr.children[1], row = rows[index];
        if (!cell || !row) return;
        cell.innerHTML = '<b>' + U.esc(row.receivableCode) + '</b><div class="small muted">' + U.esc(row.inv.id) + '</div>';
      });
    }, 0);
  }
  function ttListHtml(c) {
    const { base, rows, flt, cnt } = ttListRows(c), pg = U.pager('ttList', rows.length, 20);
    const canCollect = ttCanCollect(c.market) && c.state.id === 'COLLECTING', dayClosed = c.code && ttDayClosed(c.market, c.code, U.today()), dayLocked = c.code && ttDayLocked(c.market, c.code, U.today());
    const body = rows.slice(pg.start, pg.end).map(r => {
      const codes = r.stallIds.map(id => (A.idx.stall.get(id) || {}).code || id), st = TT_STATUS[r.status];
      const method = r.last ? U.esc(D.METHOD[r.last.method] || r.last.method) : '<span class="muted">—</span>';
      const detail = `<button class="btn sm ghost" data-act="tt-detail" data-id="${r.inv.id}">Xem chi tiết</button>`;
      const action = r.status === 'PAID'
        ? (r.last ? `<button class="btn sm" data-act="tt-receipt" data-id="${U.esc(r.last.receipt)}">Xem biên lai</button>` : '')
        : canCollect ? `<button class="btn sm primary" data-act="tt-pay-open" data-id="${r.inv.id}" ${dayLocked ? 'disabled title="Buổi thu hôm nay đã chốt — tiếp tục thu vào ngày tiếp theo"' : ''}>Thu tiền</button>` : '';
      return `<tr><td><b>${U.esc(r.t.name)}</b>${r.t.phone ? `<div class="small muted">${U.maskPhone(r.t.phone)}</div>` : ''}</td><td>${U.esc(r.t.id)}<div class="small muted">${U.esc(r.inv.id)}</div></td>
        <td>${codes.length} điểm<div class="small muted">${U.esc(codes.join(', '))}</div></td><td class="num">${U.money(r.inv.amount)}</td><td class="num">${U.money(r.inv.amount - r.remaining)}</td><td class="num"><b>${U.money(r.remaining)}</b></td>
        <td>${U.dmy(r.inv.due)}</td><td>${ttTag(st[0], st[1])}</td><td>${method}</td><td class="nowrap tt-actions">${action}${detail}</td></tr>`;
    });
    ttReplaceTraderCodeColumn(rows.slice(pg.start, pg.end));
    return `<div class="card-b tt-toolbar">
        <input class="input tt-search" data-in="tt-search" placeholder="Tìm tiểu thương, mã TT, mã khoản, điểm KD..." value="${U.esc(f.ttSearch || '')}">
        <div class="seg">${[['all', 'Tất cả'], ['UNPAID', 'Chưa thu'], ['PAID', 'Đã thu đủ']].map(x => `<button class="${flt === x[0] ? 'on' : ''}" data-act="tt-status" data-id="${x[0]}">${x[1]} (${cnt(x[0])})</button>`).join('')}</div>
        <span class="spacer"></span>
        <button class="btn sm ${f.ttSort === 'due' ? 'on' : 'ghost'}" data-act="tt-sort">${f.ttSort === 'due' ? '✓ ' : ''}Sắp xếp theo hạn nộp</button>
        <button class="btn sm ghost" data-act="tt-export" ${base.length ? '' : 'disabled'}>Xuất danh sách</button></div>
      ${dayClosed && c.state.id === 'COLLECTING' ? (dayLocked ? '<div class="card-b tt-inline-note"><div class="note info">Buổi thu hôm nay đã chốt. Các khoản còn lại tiếp tục thu vào buổi/ngày tiếp theo.</div></div>'
        : '<div class="card-b tt-inline-note"><div class="note info">Buổi thu hôm nay đã chốt. Chế độ prototype đang cho phép tiếp tục thu các khoản còn lại để mô phỏng các ngày thu tiếp theo. <span class="tag warn">Demo mô phỏng ngày tiếp theo</span></div></div>') : ''}
      <div class="card-b">${U.table([{ t: 'Tiểu thương' }, { t: 'Mã TT' }, { t: 'Điểm KD' }, { t: 'Tổng phải thu', num: true }, { t: 'Đã thu', num: true }, { t: 'Còn lại', num: true }, { t: 'Hạn nộp' }, { t: 'Trạng thái' }, { t: 'Phương thức' }, { t: 'Thao tác' }],
        body, { empty: c.rows.length ? 'Không có khoản phù hợp bộ lọc' : 'Chưa có khoản phải thu đã phát hành trong kỳ này' })}${pg.html}</div>`;
  }
  function ttReorderTransactionColumns() {
    setTimeout(() => {
      const header = Array.from(document.querySelectorAll('th')).find(x => x.textContent.trim() === 'Thời gian');
      if (!header) return;
      const table = header.closest('table'), head = table && header.parentElement;
      if (!table || !head) return;
      const labels = Array.from(head.children).map(x => x.textContent.trim());
      const order = ['Mã giao dịch', 'Mã khoản phải thu', 'Tiểu thương', 'Số tiền', 'Phương thức', 'Mã biên lai', 'Trạng thái', 'Thao tác'];
      const timeIndex = labels.indexOf('Thời gian');
      if (timeIndex >= 0) {
        head.children[timeIndex].remove();
        table.querySelectorAll('tbody tr').forEach(row => { if (row.children[timeIndex]) row.children[timeIndex].remove(); });
      }
      const currentLabels = Array.from(head.children).map(x => x.textContent.trim());
      const indexes = order.map(label => currentLabels.indexOf(label)).filter(index => index >= 0);
      const reorder = row => indexes.map(index => row.children[index]).filter(Boolean).forEach(cell => row.appendChild(cell));
      reorder(head);
      Array.from(table.querySelectorAll('tbody tr')).forEach(reorder);
    }, 0);
  }
  function ttTxHtml(c) {
    const q = (f.ttTxSearch || '').trim().toLowerCase(), m = ['tm', 'transfer'].includes(f.ttTxMethod) ? f.ttTxMethod : 'all', handedBy = ttHandedBy(c.market);
    const all = c.rows.flatMap(r => r.pays.map(p => ({ p, r }))).sort((a, b) => (b.p.date + b.p.time).localeCompare(a.p.date + a.p.time));
    const list = all.filter(x => (m === 'all' || (m === 'tm' ? !ttIsTransfer(x.p) : ttIsTransfer(x.p))) && (!q || [x.p.id, x.p.receipt, x.r.inv.id, x.r.t.name, x.r.t.id].join(' ').toLowerCase().includes(q)));
    const pg = U.pager('ttTx', list.length, 20);
    ttReorderTransactionColumns();
    const status = x => ttIsTransfer(x.p) ? ttTag('Đã ghi nhận', 'ok')
      : handedBy[x.p.id] ? `${ttTag('Đã chốt buổi', 'ok')}<div class="small muted">${U.esc(handedBy[x.p.id].id)}</div>` : ttTag('Chưa chốt buổi', 'warn');
    const cnt = k => all.filter(x => k === 'all' || (k === 'tm' ? !ttIsTransfer(x.p) : ttIsTransfer(x.p))).length;
    return `<div class="card-b tt-toolbar">
        <input class="input tt-search" data-in="tt-tx-search" placeholder="Tìm mã giao dịch, biên lai, mã khoản, tiểu thương..." value="${U.esc(f.ttTxSearch || '')}">
        <div class="seg">${[['all', 'Tất cả'], ['tm', 'Tiền mặt'], ['transfer', 'Chuyển khoản']].map(x => `<button class="${m === x[0] ? 'on' : ''}" data-act="tt-tx-method" data-id="${x[0]}">${x[1]} (${cnt(x[0])})</button>`).join('')}</div></div>
      <div class="card-b">${U.table([{ t: 'Thời gian' }, { t: 'Tiểu thương' }, { t: 'Mã giao dịch' }, { t: 'Mã khoản phải thu' }, { t: 'Số tiền', num: true }, { t: 'Phương thức' }, { t: 'Mã biên lai' }, { t: 'Trạng thái' }, { t: 'Thao tác' }],
        list.slice(pg.start, pg.end).map(x => `<tr><td class="nowrap">${U.dmy(x.p.date)} ${U.esc(x.p.time || '')}</td><td>${U.esc(x.r.t.name)}<div class="small muted">${U.esc(x.r.t.id)}</div></td><td>${U.esc(x.p.id)}</td><td>${U.esc(x.r.inv.id)}</td>
          <td class="num">${U.money(x.p.amount)}</td><td>${U.esc(D.METHOD[x.p.method] || x.p.method)}</td><td>${U.esc(x.p.receipt)}</td><td>${status(x)}</td><td><button class="btn sm" data-act="tt-receipt" data-id="${U.esc(x.p.receipt)}">Xem biên lai</button></td></tr>`),
        { empty: 'Chưa có giao dịch trong kỳ này' })}${pg.html}
        <div class="small muted tt-foot">Giao dịch đã xác nhận không sửa trực tiếp số tiền. Chuyển khoản/QR do hệ thống ghi nhận khi khớp giao dịch thanh toán.</div></div>`;
  }
  function ttSessionsHtml(c) {
    const act = s => `<button class="btn sm" data-act="tt-session-view" data-date="${s.date}">Xem chi tiết</button>${c.canClose && c.state.id === 'COLLECTING' && s.open.length ? `<button class="btn sm primary" data-act="tt-session-close-open" data-date="${s.date}">Chốt buổi thu</button>` : ''}`;
    return `<div class="card-b">${U.table([{ t: 'Ngày' }, { t: 'Tiền mặt', num: true }, { t: 'CK ghi nhận', num: true }, { t: 'Tổng thu', num: true }, { t: 'GD', num: true }, { t: 'Trạng thái' }, { t: 'Thao tác' }],
      c.sessions.map(s => { const st = TT_SESSION[s.status]; return `<tr class="click" data-act="tt-session-view" data-date="${s.date}"><td><b>${U.dmy(s.date)}</b>${s.handovers.length ? `<div class="small muted">${s.handovers.map(h => U.esc(h.id)).join(', ')}</div>` : ''}</td>
        <td class="num">${U.money(s.cashTotal)}</td><td class="num">${U.money(s.transferTotal)}</td><td class="num"><b>${U.money(s.cashTotal + s.transferTotal)}</b></td><td class="num">${s.cash.length + s.transfers.length}</td><td>${ttTag(st[0], st[1])}</td><td class="nowrap tt-actions">${act(s)}</td></tr>`; }),
      { empty: 'Chưa có buổi thu nào trong kỳ này' })}
      <div class="small muted tt-foot">Mỗi ngày thu là một buổi. Chốt buổi khóa các giao dịch tiền mặt của buổi để chuẩn bị đối soát; không khóa kỳ thu.</div></div>`;
  }
  function ttProgressHtml(c) {
    const { p, s, check, sessions, state } = c, pct = U.pct(s.paid, s.total);
    const need = sessions.filter(x => x.cash.length), closed = need.filter(x => !x.open.length);
    const early = !check.ok && TT_DEMO.allowEarlyPeriodClose;
    const cta = c.canClose && state.id === 'COLLECTING' ? `<div class="tt-progress-cta"><button class="btn primary" data-act="tt-finish-open" ${check.ok || early ? '' : 'disabled'}>Chốt kỳ thu</button>${check.ok ? '' : early ? '<span class="small muted"><span class="tag warn">Prototype</span> Chưa đạt điều kiện chốt kỳ theo nghiệp vụ bên trên — vẫn cho phép chốt kỳ mô phỏng để demo, kèm cảnh báo.</span>' : '<span class="small muted">Nút được bật khi tất cả điều kiện bên trên đạt.</span>'}</div>` : '';
    const handoff = ttHandoff(p, c.market);
    return `<div class="card-b tt-progress">
      <div class="tt-progress-h"><div><h3>Kỳ thu ${U.esc(ttPeriodLabel(p))}</h3><div class="small muted">${U.dmy(p.startDate)} – ${U.dmy(p.dueDate)}</div></div>${ttTag(state.label, state.cls)}</div>
      <div class="tt-progress-grid">
        <dl class="tt-sum"><div><dt>Tổng khoản phải thu</dt><dd>${s.total}</dd></div><div><dt>Đã thu đủ</dt><dd>${s.paid}</dd></div><div><dt>Chưa thu</dt><dd>${s.unpaid}</dd></div></dl>
        <dl class="tt-sum"><div><dt>Tổng phải thu</dt><dd>${U.money(s.amount)}</dd></div><div><dt>Đã thu</dt><dd>${U.money(s.collected)}</dd></div><div><dt>Tiền mặt</dt><dd>${U.money(s.cash)}</dd></div><div><dt>Chuyển khoản</dt><dd>${U.money(s.transfer)}</dd></div><div class="is-total"><dt>Còn phải thu</dt><dd>${U.money(s.remaining)}</dd></div></dl>
      </div>
      <div class="tt-progress-bars"><div><div class="tt-progress-label">Khoản đã thu đủ: <b>${s.paid} / ${s.total}</b> (${U.pctTxt(pct)})</div><div class="bar-mini"><i style="width:${pct}%"></i></div></div>
        <div><div class="tt-progress-label">Buổi thu đã chốt: <b>${closed.length} / ${need.length}</b> buổi có tiền mặt</div><div class="bar-mini"><i style="width:${U.pct(closed.length, need.length)}%"></i></div></div></div>
      <h4 class="tt-sec-title">Điều kiện chốt kỳ thu</h4>${ttChecklistHtml(check)}${cta}
      ${handoff ? `<div class="note info">${ttClosedNote(handoff)} Tiền mặt đã thu bàn giao cho Kế toán Trung tâm để đối soát.</div>` : ''}</div>`;
  }
  A.VIEWS['thu-tien'] = function () {
    const c = ttContext();
    if (!c) return `<div class="card"><div class="card-b"><div class="empty">${financePeriod() ? 'Bạn chưa được phân công Chợ này.' : 'Chưa có kỳ thu.'}</div></div></div>`;
    const tabs = [['list', 'Danh sách thu'], ['tx', 'Giao dịch & biên lai'], ['sessions', 'Tổng hợp theo buổi thu'], ['progress', 'Tiến độ kỳ thu']];
    const tab = tabs.some(t => t[0] === f.ttTab) ? f.ttTab : 'list';
    const body = tab === 'tx' ? ttTxHtml(c) : tab === 'sessions' ? ttSessionsHtml(c) : tab === 'progress' ? ttProgressHtml(c) : ttListHtml(c);
    return ttHeadHtml(c) + ttKpisHtml(c.s) + `<div class="card tt-work"><div class="card-h tt-tabs"><div class="seg">${tabs.map(t => `<button class="${tab === t[0] ? 'on' : ''}" data-act="tt-tab" data-id="${t[0]}">${t[1]}</button>`).join('')}</div></div>${body}</div>`;
  };
  A.ACT['tt-tab'] = el => { if (!U.can('thu-tien')) return; f.ttTab = el.dataset.id; A.closeModal(); A.render(); };
  A.ACT['tt-status'] = el => { f.ttStatus = el.dataset.id; ui.page.ttList = 0; A.render(); };
  A.ACT['tt-sort'] = () => { f.ttSort = f.ttSort === 'due' ? '' : 'due'; ui.page.ttList = 0; A.render(); };
  A.IN['tt-search'] = el => { f.ttSearch = el.value; ui.page.ttList = 0; A.render(); };
  A.ACT['tt-tx-method'] = el => { f.ttTxMethod = el.dataset.id; ui.page.ttTx = 0; A.render(); };
  A.IN['tt-tx-search'] = el => { f.ttTxSearch = el.value; ui.page.ttTx = 0; A.render(); };
  A.ACT['tt-export'] = () => {
    const c = U.can('thu-tien') && ttContext();
    if (!c) return;
    U.csv('danh-sach-thu-' + c.market.toLowerCase() + '-' + c.p.id, ['Tiểu thương', 'Mã TT', 'Mã khoản', 'Điểm KD', 'Tổng phải thu', 'Đã thu', 'Còn lại', 'Hạn nộp', 'Trạng thái', 'Phương thức'],
      ttListRows(c).rows.map(r => [r.t.name, r.t.id, r.inv.id, r.stallIds.map(id => (A.idx.stall.get(id) || {}).code || id).join(', '), r.inv.amount, r.inv.amount - r.remaining, r.remaining, U.dmy(r.inv.due), TT_STATUS[r.status][0], r.last ? (D.METHOD[r.last.method] || r.last.method) : '']));
  };
  A.ACT['tt-detail'] = el => {
    const c = U.can('thu-tien') && ttContext(), r = c && c.rows.find(x => x.inv.id === el.dataset.id);
    if (!r) return U.toast('Không tìm thấy khoản phải thu trong kỳ/chợ đang chọn');
    const st = TT_STATUS[r.status];
    A.modal(A.mHead('Chi tiết khoản phải thu') + `<div class="modal-b tt-pay">
      <div class="tt-pay-who"><b>${U.esc(r.t.name)}</b> (${U.esc(r.t.id)}) ${ttTag(st[0], st[1])}<div class="small muted">${U.esc(r.inv.id)} · Kỳ thu ${U.esc(ttPeriodLabel(c.p))} · Hạn nộp ${U.dmy(r.inv.due)}</div></div>
      <dl class="tt-sum"><div><dt>Tổng phải thu</dt><dd>${U.money(r.inv.amount)}</dd></div><div><dt>Đã thanh toán</dt><dd>${U.money(r.inv.amount - r.remaining)}</dd></div><div class="is-total"><dt>Còn phải thu</dt><dd>${U.money(r.remaining)}</dd></div></dl>
      <h4 class="tt-sec-title">Chi tiết khoản thu</h4>${ttBreakdownHtml(r.inv)}
      ${r.pays.length ? `<h4 class="tt-sec-title">Giao dịch</h4>${U.table([{ t: 'Thời gian' }, { t: 'Mã giao dịch' }, { t: 'Phương thức' }, { t: 'Số tiền', num: true }, { t: 'Biên lai' }], r.pays.map(x => `<tr><td>${U.dmy(x.date)} ${U.esc(x.time || '')}</td><td>${U.esc(x.id)}</td><td>${U.esc(D.METHOD[x.method] || x.method)}</td><td class="num">${U.money(x.amount)}</td><td><button class="link-btn" data-act="tt-receipt" data-id="${U.esc(x.receipt)}">${U.esc(x.receipt)}</button></td></tr>`))}` : ''}
      </div><div class="modal-f"><button class="btn" data-act="close">Đóng</button></div>`, true);
  };

  // ---- Thu tiền: chỉ thu đủ; tiền mặt NV xác nhận, chuyển khoản do hệ thống ghi nhận ----
  function ttPayContext(invId) {
    const inv = A.idx.invoice.get(invId), p = financePeriod(), acc = A.currentAccount(), code = acc && (acc.code || acc.id);
    if (!inv || !acc || !p || A.receivableMarket(inv) !== ui.market || inv.period !== p.id) return { err: 'Khoản phải thu không thuộc kỳ/chợ đang chọn' };
    if (!ttCanCollect(ui.market)) return { err: 'Bạn không có quyền thu tiền khoản này' };
    const state = ttPeriodState(p, ui.market);
    if (state.id !== 'COLLECTING') return { err: state.id === 'CLOSED' ? 'Kỳ thu đã chốt — không ghi nhận thanh toán mới trong kỳ này' : 'Chỉ thu tiền khi kỳ đang ở trạng thái Đang thu' };
    if (inv.status === 'paid' || U.due(inv) <= 0) return { err: 'Khoản phải thu đã được thu đủ' };
    if (ttDayLocked(ui.market, code, U.today())) return { err: 'Buổi thu hôm nay đã chốt — tiếp tục thu vào buổi/ngày tiếp theo' };
    return { inv, p, acc, code, t: A.idx.trader.get(inv.traderId) || { id: inv.traderId, name: inv.traderId }, remaining: U.due(inv) };
  }
  function ttPayModal() {
    const st = ui.ttPay, c = st && ttPayContext(st.invId);
    if (!c || c.err) { ui.ttPay = null; A.closeModal(); if (c) U.toast(c.err); return; }
    const mk = U.market(ui.market) || {}, cash = st.method !== 'transfer';
    const amount = st.amount == null ? c.remaining : st.amount, ok = amount === c.remaining;
    const ref = c.inv.paymentReference || (c.inv.qrReference || {}).reference || '';
    const account = A.BANK_ACCOUNTS && A.BANK_ACCOUNTS.listByMarket(ui.market).find(a => a.isCollectionAccount && a.status !== 'inactive');
    const review = (A.db.bank || []).filter(b => b.market === ui.market && TT_REVIEW_BANK.includes(b.status) && (b.receivableId === c.inv.id || String(b.ref || '').includes(c.inv.id)));
    const cashHtml = `<div class="tt-cash"><div class="tt-bd-line"><span>Số tiền phải thu</span><b>${U.money(c.remaining)}</b></div>
        <div class="field"><label for="tt-pay-amount">Số tiền nhận (đ)</label><input id="tt-pay-amount" class="input" type="number" min="0" step="1000" inputmode="numeric" data-in="tt-pay-amount" data-remaining="${c.remaining}" value="${amount == null || amount < 0 ? '' : amount}"></div>
        <div id="tt-pay-amount-msg" class="small ${ok ? 'muted' : 'tt-err'}">${ok ? 'Khoản phải thu phải được thanh toán đủ. Hệ thống không hỗ trợ thu một phần.' : 'Số tiền nhận phải bằng đúng ' + U.money(c.remaining) + '. Hệ thống không hỗ trợ thu một phần.'}</div>
        <div class="field"><label for="tt-pay-note">Ghi chú (không bắt buộc)</label><textarea id="tt-pay-note" class="input" rows="2" data-in="tt-pay-note">${U.esc(st.note || '')}</textarea></div></div>`;
    const transferHtml = `<div class="tt-cash"><dl class="tt-sum">${account ? `<div><dt>Tài khoản nhận</dt><dd>${U.esc(account.accountNumber)} · ${U.esc(A.BANK_ACCOUNTS.bankName(account.bankCode))}</dd></div><div><dt>Chủ tài khoản</dt><dd>${U.esc(account.accountHolderName || '')}</dd></div>` : ''}
        <div><dt>Số tiền</dt><dd>${U.money(c.remaining)}</dd></div>${ref ? `<div><dt>Nội dung chuyển khoản</dt><dd><b>${U.esc(ref)}</b></dd></div>` : ''}</dl>
        <div class="note info">Giao dịch chuyển khoản sẽ được hệ thống ghi nhận khi khớp được giao dịch thanh toán. Nhân viên thu phí không tự xác nhận đã nhận tiền chuyển khoản.</div>
        ${review.length ? `<div class="note" style="margin-top:8px">Có ${review.length} giao dịch ngân hàng liên quan khoản này đang <b>cần tra soát</b>.</div>` : ''}</div>`;
    A.modal(A.mHead('Thu tiền') + `<div class="modal-b tt-pay">
      <div class="tt-pay-who"><b>${U.esc(c.t.name)}</b> (${U.esc(c.t.id)})<div class="small muted">Kỳ thu ${U.esc(ttPeriodLabel(c.p))} · ${U.esc(mk.name || ui.market)} · ${U.esc(c.inv.id)}</div></div>
      <dl class="tt-sum"><div><dt>Tổng phải thu</dt><dd>${U.money(c.inv.amount)}</dd></div><div><dt>Đã thanh toán</dt><dd>${U.money(c.inv.paid)}</dd></div><div class="is-total"><dt>Còn phải thu</dt><dd>${U.money(c.remaining)}</dd></div></dl>
      <details class="tt-acc"><summary>Xem chi tiết khoản thu</summary>${ttBreakdownHtml(c.inv)}</details>
      <h4 class="tt-sec-title">Phương thức thanh toán</h4>
      <div class="tt-methods">${[['cash', 'Tiền mặt'], ['transfer', 'Chuyển khoản']].map(x => `<label class="tt-method ${(x[0] === 'cash') === cash ? 'on' : ''}"><input type="radio" name="tt-pay-method" value="${x[0]}" data-ch="tt-pay-method" ${(x[0] === 'cash') === cash ? 'checked' : ''}> ${x[1]}</label>`).join('')}</div>
      ${cash ? cashHtml : transferHtml}</div>
      <div class="modal-f">${cash ? `<button class="btn" data-act="close">Hủy</button><button id="tt-pay-submit" class="btn primary" data-act="tt-pay-review" ${ok ? '' : 'disabled'}>Xác nhận thu tiền</button>` : '<button class="btn" data-act="close">Đóng</button>'}</div>`);
  }
  A.ACT['tt-pay-open'] = el => {
    const c = ttPayContext(el.dataset.id);
    if (c.err) { U.toast(c.err); A.render(); return; }
    ui.ttPay = { invId: c.inv.id, method: 'cash', amount: null, note: '' };
    ttPayModal();
  };
  A.ACT['tt-pay-back'] = () => ttPayModal();
  A.CH['tt-pay-method'] = el => { if (!ui.ttPay) return; ui.ttPay.method = el.value === 'transfer' ? 'transfer' : 'cash'; ttPayModal(); };
  A.IN['tt-pay-note'] = el => { if (ui.ttPay) ui.ttPay.note = el.value; };
  // Kiểm tra trực tiếp trên DOM, không render lại modal để giữ con trỏ nhập liệu.
  A.IN['tt-pay-amount'] = el => {
    if (!ui.ttPay) return;
    const remaining = Number(el.dataset.remaining), v = el.value === '' ? NaN : Number(el.value), ok = Number.isFinite(v) && v === remaining;
    ui.ttPay.amount = Number.isFinite(v) ? v : -1;
    const btn = A.$('#tt-pay-submit'), msg = A.$('#tt-pay-amount-msg');
    if (btn) btn.disabled = !ok;
    if (msg) { msg.className = 'small ' + (ok ? 'muted' : 'tt-err'); msg.textContent = ok ? 'Khoản phải thu phải được thanh toán đủ. Hệ thống không hỗ trợ thu một phần.' : 'Số tiền nhận phải bằng đúng ' + U.money(remaining) + '. Hệ thống không hỗ trợ thu một phần.'; }
  };
  A.ACT['tt-pay-review'] = () => {
    const st = ui.ttPay, c = st && ttPayContext(st.invId);
    if (!c || c.err) { ui.ttPay = null; A.closeModal(); A.render(); return U.toast(c ? c.err : 'Phiên thu tiền không còn hợp lệ'); }
    if (st.method === 'transfer') return U.toast('Chuyển khoản do hệ thống ghi nhận khi khớp giao dịch — không xác nhận thủ công.');
    const inp = A.$('#tt-pay-amount'), amount = inp ? (inp.value === '' ? NaN : Number(inp.value)) : (st.amount == null ? c.remaining : st.amount);
    if (!Number.isFinite(amount) || amount !== c.remaining) return U.toast('Số tiền nhận phải bằng đúng ' + U.money(c.remaining) + '. Hệ thống không hỗ trợ thu một phần.');
    st.amount = amount; st.note = String((A.$('#tt-pay-note') || {}).value || st.note || '').trim();
    A.modal(A.mHead('Xác nhận đã nhận tiền') + `<div class="modal-b tt-pay">
      <dl class="tt-sum"><div><dt>Tiểu thương</dt><dd>${U.esc(c.t.name)} (${U.esc(c.t.id)})</dd></div><div><dt>Kỳ thu</dt><dd>${U.esc(ttPeriodLabel(c.p))}</dd></div><div><dt>Phương thức</dt><dd>Tiền mặt</dd></div><div class="is-total"><dt>Số tiền</dt><dd>${U.money(amount)}</dd></div></dl>
      ${st.note ? `<div class="small muted" style="margin-top:8px">Ghi chú: ${U.esc(st.note)}</div>` : ''}
      <div class="note" style="margin-top:12px">Vui lòng kiểm đếm tiền trước khi xác nhận. Sau khi xác nhận, hệ thống sẽ ghi nhận giao dịch và phát hành biên lai.</div></div>
      <div class="modal-f"><button class="btn" data-act="tt-pay-back">Hủy</button><button class="btn primary" data-act="tt-pay-commit">Xác nhận</button></div>`);
  };
  A.ACT['tt-pay-commit'] = () => {
    const st = ui.ttPay, c = st && ttPayContext(st.invId);
    // Bấm lặp: lần sau khoản đã 'paid' → ttPayContext trả lỗi, không tạo giao dịch/biên lai thứ hai.
    if (!c || c.err) { ui.ttPay = null; A.closeModal(); A.render(); return U.toast(c ? c.err : 'Phiên thu tiền không còn hợp lệ'); }
    if (st.method === 'transfer' || st.amount !== c.remaining) return U.toast('Số tiền nhận phải bằng đúng ' + U.money(c.remaining) + '. Hệ thống không hỗ trợ thu một phần.');
    const pays = A.applyPayment([c.inv.id], c.remaining, 'tm', c.code), pay = pays[0];
    if (pays.length !== 1 || !pay || c.inv.status !== 'paid' || U.due(c.inv) !== 0) {
      console.error('[thu-tien] applyPayment không thu đủ khoản', c.inv.id, pays);
      ui.ttPay = null; A.closeModal(); A.render(); return U.toast('Không ghi nhận được giao dịch thu đủ — vui lòng kiểm tra lại khoản phải thu');
    }
    if (st.note) pay.note = st.note;
    U.log('Thu tiền mặt khoản ' + c.inv.id + ' · ' + U.money(pay.amount) + ' · biên lai ' + pay.receipt);
    A.save(); ui.ttPay = null; A.render();
    A.modal(A.mHead('Thu tiền thành công') + `<div class="modal-b tt-pay"><div class="tt-success">✓ THU TIỀN THÀNH CÔNG</div>
      <div class="tt-pay-who"><b>${U.esc(c.t.name)}</b><div class="small muted">Kỳ ${U.esc(ttPeriodLabel(c.p))}</div></div>
      <dl class="tt-sum"><div class="is-total"><dt>Số tiền</dt><dd>${U.money(pay.amount)}</dd></div><div><dt>Phương thức</dt><dd>Tiền mặt</dd></div><div><dt>Mã giao dịch</dt><dd>${U.esc(pay.id)}</dd></div><div><dt>Mã biên lai</dt><dd>${U.esc(pay.receipt)}</dd></div><div><dt>Thời gian</dt><dd>${U.dmy(pay.date)} ${U.esc(pay.time)}</dd></div></dl></div>
      <div class="modal-f"><button class="btn" data-act="tt-receipt" data-id="${U.esc(pay.receipt)}">Xem biên lai</button><button class="btn" data-act="tt-receipt-print" data-id="${U.esc(pay.receipt)}">In biên lai</button><button class="btn primary" data-act="close">Đóng</button></div>`);
  };

  // ---- Biên lai điện tử (prototype: không phải chứng từ phát hành qua hệ thống chính thức) ----
  function ttPayByReceipt(no) { return A.db.payments.find(x => x.receipt === no && x.market === ui.market && A.receiptBusinessStateOk(x)) || null; }
  function ttReceiptHtml(pay) {
    const inv = A.idx.invoice.get(pay.invoiceId), t = A.idx.trader.get(pay.traderId) || {}, mk = U.market(pay.market) || {};
    const bp = inv && (A.db.billingPeriods || []).find(x => x.id === inv.period);
    const lines = inv && !pay.debtId && Number(pay.amount) === Number(inv.amount) && (inv.items || []).length
      ? inv.items.map(x => `<tr><td>${U.esc(x.name || 'Khoản thu')}${x.stallId ? `<div class="small muted">Điểm ${U.esc((A.idx.stall.get(x.stallId) || {}).code || x.stallId)}</div>` : ''}</td><td class="num">${U.money(x.amount)}</td></tr>`)
      : [`<tr><td>Thu khoản ${U.esc(inv ? inv.id : pay.invoiceId || '')}</td><td class="num">${U.money(pay.amount)}</td></tr>`];
    return `<div class="receipt tt-receipt"><div class="tt-rc-org"><b>UBND PHƯỜNG CAO LÃNH</b><div>${U.esc(String(mk.name || pay.market).toLocaleUpperCase('vi'))}</div></div>
      <h4>BIÊN LAI THU TIỀN</h4><div class="sub">Số: <b>${U.esc(pay.receipt)}</b></div>
      <dl class="kv"><dt>Tiểu thương</dt><dd>${U.esc(t.name || pay.traderId)}</dd><dt>Mã TT</dt><dd>${U.esc(t.id || pay.traderId)}</dd><dt>Kỳ thu</dt><dd>${U.esc(bp ? ttPeriodLabel(bp) : inv ? U.per(inv.period) : '')}</dd>
        <dt>Ngày thu</dt><dd>${U.dmy(pay.date)} ${U.esc(pay.time || '')}</dd><dt>NV thu phí</dt><dd>${U.esc(A.paymentActorLabel(pay))}</dd><dt>Phương thức</dt><dd>${U.esc(D.METHOD[pay.method] || pay.method)}</dd>
        <dt>Mã giao dịch</dt><dd>${U.esc(pay.id)}</dd><dt>Mã khoản phải thu</dt><dd>${U.esc(pay.invoiceId || '')}</dd></dl>
      ${U.table([{ t: 'Nội dung thu' }, { t: 'Số tiền', num: true }], lines)}
      <div class="tt-rc-total"><span>Tổng cộng</span><b>${U.money(pay.amount)}</b></div>
      <div class="tt-rc-ref">Mã tra cứu: <b>${U.esc(pay.lookup || '')}</b>${inv && inv.paymentReference ? ` · Tham chiếu thanh toán: <b>${U.esc(inv.paymentReference)}</b>` : ''}</div>
      <div class="small muted">Biên lai điện tử của bản mẫu (prototype) — không phải chứng từ phát hành qua hệ thống chính thức.</div></div>`;
  }
  function ttStyleReceipt() {
    setTimeout(() => {
      const receipt = document.querySelector('.tt-receipt');
      if (!receipt) return;
      Object.assign(receipt.style, { maxWidth: '760px', margin: '0 auto', padding: '28px 34px', border: '1px solid #d8dee8', borderRadius: '4px', background: '#fff', boxShadow: '0 3px 12px rgba(31,41,55,.08)', color: '#172033' });
      const org = receipt.querySelector('.tt-rc-org');
      if (org) Object.assign(org.style, { textAlign: 'center', lineHeight: '1.55', fontSize: '13px', textTransform: 'uppercase' });
      const title = receipt.querySelector('h4');
      if (title) Object.assign(title.style, { margin: '22px 0 4px', textAlign: 'center', fontSize: '20px', letterSpacing: '.04em' });
      const sub = receipt.querySelector('.sub');
      if (sub) Object.assign(sub.style, { textAlign: 'center', color: '#596579', marginBottom: '22px' });
      const facts = receipt.querySelector('.kv');
      if (facts) Object.assign(facts.style, { display: 'grid', gridTemplateColumns: '150px 1fr 150px 1fr', gap: '8px 14px', padding: '16px 0', borderTop: '1px solid #e5e9f0', borderBottom: '1px solid #e5e9f0' });
      const table = receipt.querySelector('table');
      if (table) { Object.assign(table.style, { marginTop: '20px', width: '100%', borderCollapse: 'collapse' }); table.querySelectorAll('th').forEach(x => Object.assign(x.style, { background: '#f3f5f8', fontWeight: '700', borderBottom: '1px solid #cfd6e2' })); table.querySelectorAll('th,td').forEach(x => Object.assign(x.style, { padding: '10px 12px', borderBottom: '1px solid #e5e9f0' })); }
      const total = receipt.querySelector('.tt-rc-total');
      if (total) Object.assign(total.style, { display: 'flex', justifyContent: 'flex-end', gap: '28px', marginTop: '18px', padding: '14px 0', borderTop: '2px solid #172033', fontSize: '17px' });
      const ref = receipt.querySelector('.tt-rc-ref');
      if (ref) Object.assign(ref.style, { marginTop: '18px', padding: '12px 14px', background: '#f7f9fc', border: '1px dashed #b8c2d1', textAlign: 'center' });
    }, 0);
  }
  function ttReceiptModal(pay) {
    ttStyleReceipt();
    A.modal(A.mHead('Biên lai điện tử') + `<div class="modal-b">${ttReceiptHtml(pay)}</div>
      <div class="modal-f"><button class="btn" data-act="tt-receipt-print" data-id="${U.esc(pay.receipt)}">In biên lai</button><button class="btn" data-act="tt-receipt-send" data-id="${U.esc(pay.receipt)}">Gửi qua Zalo / Mini app</button><button class="btn primary" data-act="close">Đóng</button></div>`, true);
  }
  A.ACT['tt-receipt'] = el => {
    const pay = U.can('thu-tien') && ttPayByReceipt(el.dataset.id);
    if (!pay) return U.toast('Không tìm thấy biên lai trong phạm vi chợ đang chọn');
    ttReceiptModal(pay);
  };
  A.ACT['tt-receipt-print'] = el => {
    const pay = U.can('thu-tien') && ttPayByReceipt(el.dataset.id);
    if (!pay) return U.toast('Không tìm thấy biên lai trong phạm vi chợ đang chọn');
    if (!A.$('.tt-receipt')) ttReceiptModal(pay);
    pay.printStatus = 'PRINTED_MOCK'; A.save();
    setTimeout(() => window.print(), 0);
  };
  // Gửi lại dùng kênh thông báo lưu trữ hiện có (A.addTraderNotification) — mô phỏng, không gọi API ngoài.
  A.ACT['tt-receipt-send'] = el => {
    const pay = U.can('thu-tien') && ttPayByReceipt(el.dataset.id);
    if (!pay) return U.toast('Không tìm thấy biên lai trong phạm vi chợ đang chọn');
    if (!A.canDo('thu-tien.thu', pay.market)) return U.toast('Bạn không có quyền gửi biên lai');
    const key = 'receipt-resend:' + pay.id + ':' + U.today(), sent = (A.db.notifications || []).some(n => n.eventKey === key);
    if (sent) return U.toast('Biên lai ' + pay.receipt + ' đã được gửi lại hôm nay');
    A.addTraderNotification({ kind: 'PAYMENT_RECEIPT', traderId: pay.traderId, market: pay.market, referenceId: pay.id, eventKey: key, channels: ['Mini app', 'Zalo OA'],
      title: 'Biên lai ' + pay.receipt, body: 'Biên lai ' + pay.receipt + ' · ' + U.money(pay.amount) + ' cho khoản ' + (pay.invoiceId || '') + '. Mã tra cứu ' + (pay.lookup || '') + '.' });
    pay.receiptDelivery = Object.assign({}, pay.receiptDelivery, { resentAt: nowStamp(), status: 'SENT_MOCK' });
    U.log('Gửi lại biên lai ' + pay.receipt + ' qua Mini app/Zalo (mô phỏng)');
    A.save(); U.toast('Đã gửi biên lai tới tiểu thương qua Mini app / Zalo OA (mô phỏng)');
  };

  // ---- Chốt buổi thu (theo ngày) — KHÔNG phải chốt kỳ ----
  function ttSessionCloseContext(date) {
    const c = U.can('thu-tien') && ttContext();
    if (!c || !c.canClose) return { err: 'Bạn không có quyền chốt buổi thu' };
    if (!hoDateOk(date)) return { err: 'Ngày chốt không hợp lệ' };
    if (c.state.id !== 'COLLECTING') return { err: 'Chỉ chốt buổi khi kỳ đang ở trạng thái Đang thu' };
    const open = hoOpenCash(c.code, c.market, date, 'FEE');
    if (!open.length) return { err: ttDayClosed(c.market, c.code, date) ? 'Buổi thu ngày ' + U.dmy(date) + ' đã được chốt' : 'Không có giao dịch tiền mặt chưa chốt trong buổi này' };
    const periodInv = new Set(c.rows.map(r => r.inv.id));
    const transfers = A.db.payments.filter(x => periodInv.has(x.invoiceId) && ttIsTransfer(x) && x.date === date && A.receiptBusinessStateOk(x));
    return Object.assign(c, { date, open, transfers, cashTotal: U.sum(open, x => x.amount), transferTotal: U.sum(transfers, x => x.amount) });
  }
  A.ACT['tt-session-close-open'] = el => {
    const c = ttSessionCloseContext(el.dataset.date || U.today());
    if (c.err) { U.toast(c.err); A.render(); return; }
    A.modal(A.mHead('Chốt buổi thu ngày ' + U.dmy(c.date)) + `<div class="modal-b tt-pay">
      <dl class="tt-sum"><div><dt>NV thu phí</dt><dd>${U.esc(c.acc.fullName || c.code)}</dd></div><div><dt>Chợ</dt><dd>${U.esc((U.market(c.market) || {}).name || c.market)}</dd></div></dl>
      <dl class="tt-sum"><div><dt>Số giao dịch tiền mặt</dt><dd>${c.open.length}</dd></div><div><dt>Tiền mặt đã thu</dt><dd>${U.money(c.cashTotal)}</dd></div>
        <div><dt>Số giao dịch chuyển khoản đã ghi nhận</dt><dd>${c.transfers.length}</dd></div><div><dt>Chuyển khoản đã ghi nhận</dt><dd>${U.money(c.transferTotal)}</dd></div>
        <div><dt>Tổng giao dịch đã thu</dt><dd>${c.open.length + c.transfers.length}</dd></div><div class="is-total"><dt>Tổng giá trị</dt><dd>${U.money(c.cashTotal + c.transferTotal)}</dd></div>
        <div><dt>Còn chưa thu trong kỳ</dt><dd>${c.s.unpaid} khoản</dd></div></dl>
      <div class="note info" style="margin-top:12px">Sau khi chốt buổi thu, các giao dịch tiền mặt thuộc buổi này được khóa để chuẩn bị đối soát. Kỳ thu vẫn tiếp tục; ngày tiếp theo vẫn thu bình thường.</div></div>
      <div class="modal-f"><button class="btn" data-act="close">Hủy</button><button class="btn primary" data-act="tt-session-close-confirm" data-date="${c.date}">Chốt buổi thu</button></div>`);
  };
  A.ACT['tt-session-close-confirm'] = el => {
    const c = ttSessionCloseContext(el.dataset.date || U.today());
    if (c.err) { U.toast(c.err); A.closeModal(); A.render(); return; }
    const acc = c.acc, d = c.date.replace(/-/g, '').slice(2);
    let n = cashHandovers().filter(h => h.collectorCode === c.code && h.date === c.date && (h.kind || 'FEE') === 'FEE').length + 1;
    while (cashHandovers().some(h => h.id === 'PN-' + d + '-' + c.code + '-' + U.pad(n, 2))) n++;
    const assignedRows = (A.db.rows || []).filter(r => r.market === c.market && r.collectorId === acc.id), at = nowStamp();
    const h = { id: 'PN-' + d + '-' + c.code + '-' + U.pad(n, 2), kind: 'FEE', market: c.market, marketId: c.market, periodId: c.p.id, collectorId: acc.id, collectorCode: c.code, collectorName: acc.fullName || hoName(c.code),
      date: c.date, paymentIds: c.open.map(x => x.id), amount: c.cashTotal, declaredAmount: c.cashTotal, assignedRowIds: assignedRows.map(r => r.id), assignedAreas: assignedRows.map(hoAreaLabel), submittedAt: at, status: 'SUBMITTED',
      sessionDate: c.date, cashCount: c.open.length, transferPaymentIds: c.transfers.map(x => x.id), transferCount: c.transfers.length, transferAmount: c.transferTotal, closedAt: at, closedBy: acc.fullName || c.code, source: 'THU_TIEN_WORKSPACE' };
    cashHandovers().push(h);
    U.log('Chốt buổi thu ' + U.dmy(c.date) + ' (' + h.id + '): ' + c.open.length + ' giao dịch tiền mặt, ' + U.money(h.amount));
    A.save(); A.closeModal(); A.render(); U.toast('Đã chốt buổi thu ngày ' + U.dmy(c.date) + ' · ' + h.id + ' · tiền mặt ' + U.money(h.amount));
  };
  A.ACT['tt-session-view'] = el => {
    const c = U.can('thu-tien') && ttContext(), s = c && c.sessions.find(x => x.date === el.dataset.date);
    if (!s) return;
    const handedBy = ttHandedBy(c.market), st = TT_SESSION[s.status];
    const rows = ttSorted(s.cash.concat(s.transfers)).reverse().map(x => { const t = A.idx.trader.get(x.traderId) || {}; return `<tr><td>${U.esc(x.time || '')}</td><td>${U.esc(t.name || x.traderId)}</td><td>${U.esc(x.id)}</td><td>${U.esc(x.invoiceId)}</td><td class="num">${U.money(x.amount)}</td><td>${U.esc(D.METHOD[x.method] || x.method)}</td>
      <td><button class="link-btn" data-act="tt-receipt" data-id="${U.esc(x.receipt)}">${U.esc(x.receipt)}</button></td><td>${ttIsTransfer(x) ? ttTag('Đã ghi nhận', 'ok') : handedBy[x.id] ? ttTag('Đã chốt', 'ok') : ttTag('Chưa chốt', 'warn')}</td></tr>`; });
    A.modal(A.mHead('Buổi thu ngày ' + U.dmy(s.date)) + `<div class="modal-b tt-pay">
      <dl class="tt-sum"><div><dt>Trạng thái</dt><dd>${ttTag(st[0], st[1])}</dd></div><div><dt>Tiền mặt</dt><dd>${U.money(s.cashTotal)}</dd></div><div><dt>CK ghi nhận</dt><dd>${U.money(s.transferTotal)}</dd></div><div class="is-total"><dt>Tổng thu</dt><dd>${U.money(s.cashTotal + s.transferTotal)}</dd></div>
        ${s.handovers.length ? `<div><dt>Phiếu chốt buổi</dt><dd>${s.handovers.map(h => `${U.esc(h.id)} · ${U.esc(h.closedAt || h.submittedAt || '')}`).join('<br>')}</dd></div>` : ''}</dl>
      <h4 class="tt-sec-title">Giao dịch trong buổi</h4>${U.table([{ t: 'Giờ' }, { t: 'Tiểu thương' }, { t: 'Mã giao dịch' }, { t: 'Mã khoản' }, { t: 'Số tiền', num: true }, { t: 'Phương thức' }, { t: 'Biên lai' }, { t: 'Trạng thái' }], rows, { empty: 'Chưa có giao dịch trong buổi này' })}</div>
      <div class="modal-f"><button class="btn" data-act="close">Đóng</button>${c.canClose && c.state.id === 'COLLECTING' && s.open.length ? `<button class="btn primary" data-act="tt-session-close-open" data-date="${s.date}">Chốt buổi thu</button>` : ''}</div>`, true);
  };

  // ---- Chốt kỳ thu — NV thu phí hoàn tất công việc thu của chợ trong kỳ (ĐANG THU → ĐÃ CHỐT) ----
  // Sau khi chốt: sinh (1 lần) bản ghi CHỜ ĐỐI SOÁT cho Kế toán Trung tâm tại collectionHandoffByMarket[market].
  // Kế toán KHÔNG chốt kỳ; đối soát không làm kỳ quay lại Đang thu. data-act giữ tên cũ tt-finish-* (nội bộ).
  function ttFinishContext() {
    const c = U.can('thu-tien') && ttContext();
    if (!c || !c.canClose) return { err: 'Bạn không có quyền chốt kỳ thu này' };
    if (c.state.id !== 'COLLECTING') return { err: c.state.id === 'CLOSED' ? 'Kỳ thu đã được chốt' : 'Chỉ chốt kỳ khi kỳ đang ở trạng thái Đang thu' };
    // Validation thật giữ nguyên; PROTOTYPE chỉ đánh dấu c.early để bắt buộc đi qua modal cảnh báo.
    if (!c.check.ok) {
      if (!TT_DEMO.allowEarlyPeriodClose) return { err: 'Chưa đủ điều kiện chốt kỳ: ' + c.check.items.filter(x => !x.ok).map(x => x.text).join('; ') };
      c.early = true;
    }
    c.collector = A.ACCOUNTS.getMarketCollector ? A.ACCOUNTS.getMarketCollector(c.market) : null;
    c.col = ttPeriodCollection(c.rows);
    return c;
  }
  function ttClosedNote(h) {
    const sm = h.summary || {};
    return `Đã chốt kỳ thu lúc ${U.esc(rcClosedAt(h))} · ${U.esc(rcClosedBy(h))}. Đối soát: ${rcStatusTag(h)}`
      + (h.prototypeBypass ? ` <span class="tag warn">Prototype</span> Chốt kỳ mô phỏng khi mới thu ${U.esc(String(sm.paidCount != null ? sm.paidCount : '?'))}/${U.esc(String(sm.receivables != null ? sm.receivables : '?'))} khoản, còn ${U.money(sm.remaining || 0)} chưa thu.` : '');
  }
  function ttCloseSummaryHtml(c) {
    return `<dl class="tt-sum"><div><dt>Kỳ thu</dt><dd>${U.esc(ttPeriodLabel(c.p))}</dd></div><div><dt>Chợ</dt><dd>${U.esc((U.market(c.market) || {}).name || c.market)}</dd></div><div><dt>NV thu phí</dt><dd>${U.esc((c.collector && c.collector.fullName) || c.acc.fullName || c.code)}</dd></div></dl>
      <h4 class="tt-sec-title">Kết quả thu</h4>
      <dl class="tt-sum"><div><dt>Tổng khoản phải thu</dt><dd>${c.s.total}</dd></div><div><dt>Đã thu đủ</dt><dd>${c.s.paid}/${c.s.total}</dd></div>
        <div><dt>Tổng phải thu</dt><dd>${U.money(c.s.amount)}</dd></div><div><dt>Tổng đã thu</dt><dd>${U.money(c.col.collected)}</dd></div><div class="is-total"><dt>Còn phải thu</dt><dd>${U.money(c.s.remaining)}</dd></div></dl>
      <h4 class="tt-sec-title">Phân theo phương thức</h4>
      <dl class="tt-sum"><div><dt>Tiền mặt</dt><dd>${U.money(c.col.cash)}</dd></div><div><dt>Chuyển khoản</dt><dd>${U.money(c.col.transfer)}</dd></div><div class="is-total"><dt>Tổng</dt><dd>${U.money(c.col.collected)}</dd></div></dl>
      ${ttChecklistHtml(c.check)}`;
  }
  // PROTOTYPE: cảnh báo chốt kỳ khi chưa đạt điều kiện nghiệp vụ. Số liệu lấy thẳng từ ttContext, không sửa.
  function ttFinishEarlyModal(c) {
    A.modal(A.mHead('Chốt kỳ thu') + `<div class="modal-b tt-pay">
      <div class="note"><b>⚠ CHẾ ĐỘ PROTOTYPE</b><br>Kỳ thu hiện chưa đạt đủ điều kiện chốt theo nghiệp vụ chính thức.<br>Bạn đang sử dụng chế độ mô phỏng để tiếp tục kiểm tra các màn hình tiếp theo.</div>
      <dl class="tt-sum" style="margin-top:12px"><div><dt>Đã thu</dt><dd>${c.s.paid}/${c.s.total}</dd></div><div><dt>Còn chưa thu</dt><dd>${c.s.total - c.s.paid} khoản</dd></div><div class="is-total"><dt>Còn phải thu</dt><dd>${U.money(c.s.remaining)}</dd></div></dl>
      ${ttCloseSummaryHtml(c)}
      <div class="small muted" style="margin-top:8px">Không có khoản thu, giao dịch hay biên lai nào được tạo hoặc thay đổi. Kế toán Trung tâm sẽ thấy đúng số liệu thật ở trên.</div></div>
      <div class="modal-f"><button class="btn" data-act="close">Hủy</button><button class="btn primary" data-act="tt-finish-confirm" data-early="1">Tiếp tục mô phỏng chốt kỳ</button></div>`, true);
  }
  A.ACT['tt-finish-open'] = () => {
    const c = ttFinishContext();
    if (c.err) { U.toast(c.err); A.render(); return; }
    if (c.early) { ttFinishEarlyModal(c); return; }
    A.modal(A.mHead('Xác nhận chốt kỳ thu') + `<div class="modal-b tt-pay">${ttCloseSummaryHtml(c)}
      <div class="note" style="margin-top:12px">Sau khi chốt kỳ, Nhân viên thu phí không thể tiếp tục ghi nhận thanh toán trong kỳ này.<br>Số tiền mặt đã thu sẽ được bàn giao cho Kế toán Trung tâm để thực hiện đối soát.</div></div>
      <div class="modal-f"><button class="btn" data-act="close">Hủy</button><button class="btn primary" data-act="tt-finish-confirm">Chốt kỳ thu</button></div>`, true);
  };
  A.ACT['tt-finish-confirm'] = el => {
    const c = ttFinishContext();
    if (c.err) { U.toast(c.err); A.closeModal(); A.render(); return; }
    // PROTOTYPE: chốt kỳ mô phỏng chỉ khi người dùng đã xác nhận qua modal cảnh báo.
    if (c.early && !(el && el.dataset && el.dataset.early === '1')) { ttFinishEarlyModal(c); return; }
    const at = nowStamp(), col = c.col, collector = c.collector || c.acc;
    // Snapshot số liệu THẬT tại thời điểm chốt — Kế toán đối soát trên snapshot này, không tính lại.
    const rec = { marketId: c.market, periodId: c.p.id, periodStatus: 'CLOSED', closedAt: at, closedBy: c.acc.fullName || c.code, closedByCode: c.code, closedById: c.acc.id,
      collectorId: collector.id, collectorName: collector.fullName || c.code, reconciliationStatus: 'WAITING', createdAt: at,
      summary: { receivables: c.s.total, paidCount: c.s.paid, amount: c.s.amount, remaining: c.s.remaining,
        // Tiền của kỳ = ttPeriodCollection (không gồm thu hồi công nợ): cash + transfer = collected.
        cashScope: 'PERIOD_ONLY', collected: col.collected, cash: col.cash, cashCount: col.cashPays.length, transfer: col.transfer, transferCount: col.transferPays.length,
        cashPaymentIds: col.cashPays.map(x => x.id), transferPaymentIds: col.transferPays.map(x => x.id), debtExcludedAmount: col.debtExcluded, debtExcludedCount: col.debtExcludedCount,
        closedSessions: c.sessions.filter(x => x.cash.length && !x.open.length).length } };
    if (c.early) Object.assign(rec, { prototypeBypass: true, prototypeBypassReason: 'EARLY_PERIOD_CLOSE', unmetConditions: c.check.items.filter(x => !x.ok).map(x => x.text) });
    // Idempotent: ttFinishContext từ chối khi chợ đã có bản ghi chốt → mỗi chợ + kỳ đúng 1 bản ghi.
    c.p.collectionHandoffByMarket = Object.assign({}, c.p.collectionHandoffByMarket || {}, { [c.market]: rec });
    U.log('Chốt kỳ thu ' + ttPeriodLabel(c.p) + ' tại ' + c.market + ' → chờ đối soát' + (c.early ? ' (PROTOTYPE — chốt kỳ mô phỏng, còn ' + U.money(c.s.remaining) + ' chưa thu)' : ''));
    A.save(); A.closeModal(); A.render();
    A.modal(A.mHead('Đã chốt kỳ thu') + `<div class="modal-b tt-pay"><div class="tt-success">✓ ĐÃ CHỐT KỲ THU</div>
      <p>Kỳ thu ${U.esc(ttPeriodLabel(c.p))} tại ${U.esc((U.market(c.market) || {}).name || c.market)} đã chốt. Vui lòng bàn giao tiền mặt đã thu cho Kế toán Trung tâm để đối soát.</p>
      <dl class="tt-sum"><div><dt>Trạng thái kỳ thu</dt><dd>${ttTag('Đã chốt kỳ', 'ok')}</dd></div><div><dt>Đối soát</dt><dd>${rcStatusTag(rec)}</dd></div>
        <div><dt>Đã thu</dt><dd>${c.s.paid} / ${c.s.total} khoản</dd></div><div class="is-total"><dt>Tiền mặt bàn giao</dt><dd>${U.money(col.cash)}</dd></div></dl>
      ${c.early ? '<div class="note" style="margin-top:12px"><span class="tag warn">Prototype</span> Chốt kỳ mô phỏng — còn ' + U.money(c.s.remaining) + ' chưa thu.</div>' : ''}</div>
      <div class="modal-f"><button class="btn primary" data-act="close">Đóng</button></div>`);
  };

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
    return { inv, trader: A.idx.trader.get(inv.traderId), stall: U.invStall(inv) };
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
  const DS_SESSION_STATUS_LABEL = {
    SCHEDULED: 'Đã lên lịch',
    REGISTRATION_OPEN: 'Đang mở đăng ký',
    REGISTRATION_CLOSED: 'Đã đóng đăng ký',
    WAITING_RECONCILIATION: 'Chờ đối soát',
    CLOSED: 'Đã đóng phiên',
    COMPLETED: 'Hoàn thành',
    CANCELLED: 'Đã hủy',
    POSTPONED: 'Tạm hoãn',
    open: 'Đang mở đăng ký',
    registration_closed: 'Đã đóng đăng ký',
    preparing: 'Đang chuẩn bị',
    active: 'Đang diễn ra',
    pending_close: 'Chờ chốt phiên',
    closed: 'Đã đóng phiên',
    cancelled: 'Đã hủy',
    postponed: 'Tạm hoãn'
  };
  function dsSessionStatusTag(s) {
    const status = s && s.status;
    const cls = status === 'CLOSED' || status === 'COMPLETED' || status === 'closed' ? 'ok'
      : status === 'CANCELLED' || status === 'cancelled' ? 'danger'
        : status === 'REGISTRATION_OPEN' || status === 'open' || status === 'active' ? 'warn' : '';
    return `<span class="tag ${cls}">${U.esc(DS_SESSION_STATUS_LABEL[status] || status || '-')}</span>`;
  }
  function dsSessionPayStatusTag(p) {
    if (!p) return '<span class="tag">Chưa có payment</span>';
    const map = {
      WAITING_PAYMENT: ['Chờ thanh toán online', 'warn'],
      WAITING_COLLECTION: ['Chờ thu trực tiếp', 'warn'],
      SUCCESS: ['Đã thu', 'ok'],
      RECONCILED: ['Đã khớp', 'ok'],
      FAILED: ['Thất bại', 'danger'],
      CANCELLED: ['Đã hủy', 'danger']
    };
    const x = map[p.status] || [p.status, ''];
    return `<span class="tag ${x[1]}">${U.esc(x[0])}</span>`;
  }
  function dsSessionRegStatusLabel(status) {
    return ({
      registered: 'Đã đăng ký',
      approved: 'Đã duyệt',
      waitlisted: 'Danh sách chờ',
      rejected: 'Từ chối',
      withdrawn: 'Đã rút',
      CANCELLED: 'Đã hủy',
      REJECTED: 'Từ chối',
      CONFIRMED: 'Đã xác nhận',
      CHECKED_IN: 'Đã điểm danh',
      PARTICIPATING: 'Đang tham gia',
      COMPLETED: 'Hoàn thành'
    })[status] || status || '-';
  }
  function dsSessionPaymentForReg(reg, pays) {
    return pays.find(p => p.registrationId === reg.id && p.method === reg.paymentMethod) || pays.find(p => p.registrationId === reg.id) || null;
  }
  function dsSessionReceiptForPayment(payment, receipts) {
    return payment ? (receipts.find(r => r.sessionPaymentId === payment.id) || receipts.find(r => r.receiptNumber === payment.receiptNumber)) : null;
  }
  function dsCollectorLabel(id) {
    if (!id) return '-';
    const staff = U.staffName(id);
    return staff && staff !== id ? `${U.esc(staff)} (${U.esc(id)})` : U.esc(id);
  }
  function dsCanSessionDetail(s) {
    return !!(s && s.marketId === ui.market && U.can('doi-soat') && (dsCanBank(s.marketId) || dsCanCash(s.marketId)));
  }
  function dsSessionDetailHtml(s) {
    const t = dsSessionTotals(s), st = dsSessionState(s);
    const cashDelta = t.cashSystem - t.cashReceipts;
    const onlineReceived = t.onlineRecon + t.onlineSuccess;
    const totalReceived = onlineReceived + t.cashSystem;
    const byCollector = {};
    t.pays.filter(p => p.method === 'CASH' && p.status === 'SUCCESS').forEach(p => {
      const k = p.collectedBy || '-';
      byCollector[k] = byCollector[k] || { n: 0, amount: 0, receipts: 0 };
      byCollector[k].n += 1;
      byCollector[k].amount += p.amount || 0;
      if (p.receiptNumber) byCollector[k].receipts += 1;
    });
    const collectorRows = Object.keys(byCollector).map(k => {
      const x = byCollector[k];
      return `<tr><td>${dsCollectorLabel(k)}</td><td class="num">${x.n}</td><td class="num">${U.money(x.amount)}</td><td class="num">${x.receipts}</td></tr>`;
    });
    const detailRows = t.regs.map(r => {
      const p = dsSessionPaymentForReg(r, t.pays);
      const rc = dsSessionReceiptForPayment(p, t.receipts);
      const trader = A.idx.trader.get(r.merchantId || r.traderId);
      const expected = r.totalAmount || (p ? p.amount : 0);
      const received = p && (p.status === 'SUCCESS' || p.status === 'RECONCILED') ? (p.amount || 0) : 0;
      const collector = p && p.method === 'CASH' ? (p.collectedBy || '-') : (p && p.method === 'ONLINE' && (p.status === 'SUCCESS' || p.status === 'RECONCILED') ? 'Hệ thống / ngân hàng' : '-');
      const receiptNo = rc ? rc.receiptNumber : (p && p.receiptNumber ? p.receiptNumber : '');
      return `<tr><td>${U.esc(r.code || r.id)}<div class="small muted">${U.esc(dsSessionRegStatusLabel(r.status))}</div></td>
        <td>${trader ? U.esc(trader.name) : U.esc(r.merchantId || r.traderId || '')}<div class="small muted">${U.esc(r.merchantId || r.traderId || '')}</div></td>
        <td>${r.paymentMethod === 'CASH' ? 'Trực tiếp' : 'Online/QR'}</td>
        <td class="num">${U.money(expected)}</td><td class="num">${U.money(received)}</td>
        <td>${dsSessionPayStatusTag(p)}</td><td>${receiptNo ? U.esc(receiptNo) : '<span class="muted">Chưa có</span>'}</td>
        <td>${dsCollectorLabel(collector)}</td></tr>`;
    });
    return `<div class="modal-b">
      <div class="row" style="align-items:flex-start;gap:16px;flex-wrap:wrap">
        <div style="flex:1;min-width:260px"><h3 style="margin:0">${U.esc(s.code)}</h3><div class="small muted">${U.dmy(s.sessionDate)} · ${U.esc(s.name || '')}</div></div>
        <div>${dsSessionStatusTag(s)}</div><div><span class="tag ${st.cls}">${st.label}</span></div>
      </div>
      <div class="note info" style="margin-top:12px">Chi tiết này dùng để rà soát sau phiên: hệ thống dự kiến phải thu bao nhiêu, thực nhận qua online/tiền mặt bao nhiêu, biên lai đã phát hành chưa và ai phụ trách khoản thu trực tiếp.</div>
      <div class="kpis" style="margin-top:12px">
        <div class="card kpi"><div class="k-label">Tổng phải thu theo đăng ký</div><div class="k-value">${U.moneyShort(t.expected)}</div><div class="k-sub">${U.money(t.expected)}</div></div>
        <div class="card kpi"><div class="k-label">Đã nhận online</div><div class="k-value">${U.moneyShort(onlineReceived)}</div><div class="k-sub">Đã khớp ${U.money(t.onlineRecon)} · chờ ${U.money(t.onlineSuccess + t.onlineWaiting)}</div></div>
        <div class="card kpi"><div class="k-label">Đã nhận trực tiếp</div><div class="k-value">${U.moneyShort(t.cashSystem)}</div><div class="k-sub">Theo biên lai ${U.money(t.cashReceipts)}</div></div>
        <div class="card kpi"><div class="k-label">Chênh lệch tiền mặt</div><div class="k-value" style="color:${cashDelta === 0 ? '#20a04e' : '#df2225'}">${U.moneyShort(cashDelta)}</div><div class="k-sub">Hệ thống - biên lai</div></div>
      </div>
      <div class="card"><div class="card-h"><h3>Nhân viên phụ trách thu trực tiếp</h3></div><div class="card-b">
        ${U.table([{ t: 'Người thu' }, { t: 'Số khoản', num: true }, { t: 'Số tiền đã nhận', num: true }, { t: 'Số biên lai', num: true }], collectorRows, { empty: 'Chưa có khoản thu trực tiếp đã ghi nhận' })}
      </div></div>
      <div class="card"><div class="card-h"><h3>Rà soát từng đăng ký</h3></div><div class="card-b">
        ${U.table([{ t: 'Đăng ký' }, { t: 'Tiểu thương' }, { t: 'Hình thức' }, { t: 'Phải thu', num: true }, { t: 'Đã nhận', num: true }, { t: 'Trạng thái thu' }, { t: 'Biên lai' }, { t: 'Phụ trách thu' }], detailRows, { empty: 'Phiên chưa có đăng ký' })}
      </div></div>
      ${t.openEx.length ? `<div class="card"><div class="card-h"><h3>Ngoại lệ đang mở</h3></div><div class="card-b">${U.table([{ t: 'Loại' }, { t: 'Nội dung' }, { t: 'Trạng thái' }],
        t.openEx.map(e => `<tr><td>${U.esc(e.type || '')}</td><td>${U.esc(e.note || e.message || '')}</td><td>${U.esc(e.status || '')}</td></tr>`))}</div></div>` : ''}
    </div><div class="modal-f"><button class="btn primary" data-act="close">Đóng</button></div>`;
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
    return `<div class="card"><div class="card-h"><div><h3>Đối soát phiên chợ quê</h3><div class="small muted">Kiểm tra sau phiên: phải thu, thực nhận, biên lai, người thu và ngoại lệ.</div></div><span class="spacer"></span><span class="small muted">Nguồn: đăng ký, thanh toán, biên lai và exception</span></div>
      <div class="card-b"><div class="note info" style="margin-bottom:10px">Màn này không dùng để thu tiền. Nó dùng để rà soát từng phiên chợ quê TTĐ sau khi phát sinh thu online hoặc thu trực tiếp: thu bao nhiêu, đã nhận bao nhiêu, biên lai có khớp không và ai phụ trách khoản thu.</div>${U.table([{ t: 'Phiên' }, { t: 'Trạng thái phiên' }, { t: 'Phải thu', num: true }, { t: 'Đã nhận', num: true }, { t: 'Tiền mặt theo biên lai', num: true }, { t: 'Ngoại lệ' }, { t: 'Kết quả' }, { t: '' }],
        rows.map(s => {
          const t = dsSessionTotals(s), st = dsSessionState(s);
          const received = t.onlineRecon + t.onlineSuccess + t.cashSystem;
          return `<tr><td><b>${U.esc(s.code)}</b><div class="small muted">${U.dmy(s.sessionDate)} · ${U.esc(s.name || '')}</div></td>
            <td>${dsSessionStatusTag(s)}</td>
            <td class="num">${U.money(t.expected)}</td><td class="num">${U.money(received)}<div class="small muted">Online ${U.money(t.onlineRecon + t.onlineSuccess)} · trực tiếp ${U.money(t.cashSystem)}</div></td>
            <td class="num">${U.money(t.cashReceipts)}</td><td>${t.openEx.length ? `<span class="tag danger">${t.openEx.length} mở</span>` : '<span class="tag ok">Không</span>'}</td>
            <td><span class="tag ${st.cls}">${st.label}</span></td><td><button class="btn sm" data-act="ds-session-detail" data-id="${s.id}">Chi tiết</button></td></tr>`;
        }), { empty: 'Chưa có dữ liệu phiên chợ để đối soát' })}</div></div>`;
  }
  A.ACT['ds-session-detail'] = el => {
    const s = dsSessions().find(x => x.id === el.dataset.id);
    if (!dsCanSessionDetail(s)) return;
    A.modal(A.mHead('Chi tiết đối soát phiên chợ quê') + dsSessionDetailHtml(s), true);
  };

  A.VIEWS['doi-soat'] = function () {
    const canBank = dsCanBank(), canCash = dsCanCash();
    const tabs = [];
    if (canBank) tabs.push(['ngan-hang', 'Ngân hàng / QR']);
    if (canCash) tabs.push(['tien-mat', 'Buổi thu tiền mặt']);
    if (!tabs.length) return '<div class="card"><div class="empty">Bạn chưa được cấp quyền xem nghiệp vụ đối soát.</div></div>';
    const tab = tabs.some(t => t[0] === ui.dsTab) ? ui.dsTab : tabs[0][0];
    const tabBar = tabs.length > 1
      ? `<div class="seg">${tabs.map(t => `<button class="${tab === t[0] ? 'on' : ''}" data-act="ds-tab" data-id="${t[0]}">${t[1]}</button>`).join('')}</div>`
      : `<h3 style="margin:0;font-size:var(--font-size-md)">${tabs[0][1]}</h3>`;
    const timeBar = `<div class="card"><div class="card-b" style="padding-top:14px">${financeTimeBarRow('Kỳ khoản thu')}
      <div class="row small" style="margin-top:8px;flex-wrap:wrap"><span class="label-sm">Ngày giao dịch</span>
        <input type="date" class="input" style="width:150px" data-ch="ds-from" value="${dsTxFrom()}"><span class="muted">→</span>
        <input type="date" class="input" style="width:150px" data-ch="ds-to" value="${dsTxTo()}"></div></div></div>`;
    return timeBar + `<div class="card"><div class="card-b" style="padding-top:14px">${tabBar}</div></div>` + (tab === 'ngan-hang' ? dsBankView() : ((U.market(ui.market) || {}).receivableGrouping === 'TRADER' ? dsHandoverView() : dsCashView()));
  };

  // ---------- THEO DÕI KỲ ĐỐI SOÁT ----------
  // Kỳ vẫn là A.db.billingPeriods; chỉ bổ sung metadata xác nhận đối soát trên chính kỳ đó.
  function periodReconRows(period, market) {
    return cashHandovers().filter(h => {
      const sameMarket = (h.marketId || h.market) === market;
      return sameMarket && (h.periodId ? h.periodId === period.id : h.date >= period.startDate && h.date <= period.endDate);
    });
  }
  function periodReconMeta(period, market) {
    const map = period.cashReconciliationByMarket;
    return map && map[market] ? map[market] : null;
  }
  function periodReconState(period, rows, market) {
    const pending = rows.filter(h => hoState(h).id === 'SUBMITTED');
    const explanation = rows.filter(h => hoState(h).id === 'WAITING_EXPLANATION');
    const processed = rows.filter(h => ['MATCHED', 'RESOLVED'].includes(hoState(h).id));
    if (period.status === 'CLOSED') return { id: 'CLOSED', label: 'Đã chốt kỳ thu', cls: 'ok' };
    const meta = periodReconMeta(period, market);
    if (meta && meta.status === 'COMPLETED') return { id: 'COMPLETED', label: 'Đã hoàn tất đối soát', cls: 'ok' };
    if (explanation.length) return { id: 'EXPLANATION', label: 'Chờ xử lý chênh lệch', cls: 'warn' };
    if (rows.length && !pending.length && processed.length === rows.length) return { id: 'READY', label: 'Đủ điều kiện xác nhận', cls: 'info' };
    if (rows.length) return { id: 'RECONCILING', label: 'Đang đối soát', cls: 'info' };
    return { id: 'COLLECTING', label: 'Đang thu', cls: 'warn' };
  }
  function periodReconSummary(period, market) {
    const rows = periodReconRows(period, market);
    const state = periodReconState(period, rows, market);
    const matched = rows.filter(h => hoState(h).id === 'MATCHED');
    const unresolved = rows.filter(h => hoState(h).id === 'WAITING_EXPLANATION');
    const pending = rows.filter(h => hoState(h).id === 'SUBMITTED');
    const done = rows.filter(h => ['MATCHED', 'RESOLVED'].includes(hoState(h).id));
    return { period, market, rows, state, meta: periodReconMeta(period, market), matched, unresolved, pending, done, total: U.sum(rows, h => h.amount || 0), reconciled: U.sum(done, h => h.amount || 0) };
  }
  function periodReconMarkets() {
    const allowed = new Set(A.allowedMarkets(A.currentAccount()));
    return D.MARKETS.filter(m => allowed.has(m.id));
  }
  function periodReconSummaries() {
    const markets = periodReconMarkets(), marketFilter = ui.dsPeriodMarket || 'all';
    return (A.db.billingPeriods || []).flatMap(p => markets.filter(m => marketFilter === 'all' || m.id === marketFilter).map(m => periodReconSummary(p, m.id)));
  }
  function periodReconTag(s) { return `<span class="tag ${s.cls}">${U.esc(s.label)}</span>`; }
  function periodReconDetailHtml(summary) {
    const p = summary.period, rows = summary.rows;
    const ready = summary.rows.length > 0 && summary.pending.length === 0 && summary.unresolved.length === 0 && summary.done.length === summary.rows.length && summary.state.id === 'READY';
    const pct = rows.length ? Math.round((summary.done.length / rows.length) * 100) : 0;
    const grouped = rows.slice().sort((a, b) => (a.collectorName || '').localeCompare(b.collectorName || '') || a.date.localeCompare(b.date));
    const list = U.table([{ t: 'Phiếu chốt buổi thu' }, { t: 'Nhân viên thu phí' }, { t: 'Khu/Dãy phụ trách' }, { t: 'Ngày/giờ chốt' }, { t: 'Số tiền', num: true }, { t: 'Trạng thái' }, { t: '' }], grouped.map(h => {
      const areas = h.assignedAreas || hoAssignedRows(h, h.paymentIds.map(id => A.db.payments.find(x => x.id === id)).filter(Boolean)).map(hoAreaLabel);
      return `<tr><td><b>${U.esc(h.id)}</b></td><td>${U.esc(h.collectorName || hoName(h.collectorCode))}</td><td>${areas.map(U.esc).join(', ') || '—'}</td><td>${hoDateTime(h)}</td><td class="num">${U.money(h.amount)}</td><td>${hoStatusTag(h)}</td><td><button class="btn sm" data-act="ds-period-ho-view" data-id="${U.esc(h.id)}">Xem phiếu</button></td></tr>`;
    }), { empty: 'Chưa có phiếu chốt buổi thu trong kỳ này' });
    return `<div class="period-reconcile-detail"><section class="cash-reconcile-section"><h4>Thông tin kỳ</h4><dl class="cash-reconcile-facts"><div><dt>Kỳ thu</dt><dd><b>${U.esc(p.label || p.id)}</b></dd></div><div><dt>Chợ</dt><dd>${U.esc(U.market(summary.market).name)}</dd></div><div><dt>Thời gian thu</dt><dd>${U.dmy(p.startDate)} – ${U.dmy(p.endDate)}</dd></div><div><dt>Trạng thái kỳ</dt><dd>${periodReconTag(summary.state)}</dd></div></dl></section>
      <section class="cash-reconcile-section"><h4>Tiến độ đối soát</h4><div class="period-reconcile-progress"><div><b>${summary.done.length}/${rows.length}</b> phiếu đã xử lý · ${summary.matched.length} phiếu đã khớp${summary.unresolved.length ? ` · ${summary.unresolved.length} phiếu chờ xử lý chênh lệch` : ''}</div><div class="period-reconcile-progress-bar"><i style="width:${pct}%"></i></div></div></section>
      <section class="cash-reconcile-section"><h4>Phiếu chốt buổi thu</h4>${list}</section>
      ${summary.meta && summary.meta.completedAt ? `<div class="note info">Kỳ đã được xác nhận hoàn tất bởi <b>${U.esc(summary.meta.completedBy || '')}</b> lúc ${U.esc(summary.meta.completedAt)}. Kỳ đã sẵn sàng để Trưởng Ban Quản lý chốt.</div>` : ''}
      <div class="modal-f"><button class="btn" data-act="close">Đóng</button>${ready ? `<button class="btn primary" data-act="ds-period-confirm" data-period="${U.esc(p.id)}" data-market="${U.esc(summary.market)}">Xác nhận hoàn tất đối soát kỳ</button>` : ''}</div></div>`;
  }
  function periodReconView() {
    const summaries = periodReconSummaries(), statusFilter = ui.dsPeriodStatus || 'all', periodFilter = ui.dsPeriodFilter || 'all';
    const rows = summaries.filter(s => (statusFilter === 'all' || s.state.id === statusFilter) && (periodFilter === 'all' || s.period.id === periodFilter));
    const total = rows.reduce((n, s) => n + s.rows.length, 0), matched = rows.reduce((n, s) => n + s.matched.length, 0), pending = rows.reduce((n, s) => n + s.pending.length, 0), discrepancy = rows.reduce((n, s) => n + s.unresolved.length, 0), reconciled = rows.reduce((n, s) => n + s.reconciled, 0), waiting = rows.reduce((n, s) => n + U.sum(s.pending.concat(s.unresolved), h => h.amount || 0), 0);
    const marketOptions = periodReconMarkets().map(m => `<option value="${m.id}" ${((ui.dsPeriodMarket || 'all') === m.id) ? 'selected' : ''}>${U.esc(m.name)}</option>`).join('');
    const periodOptions = (A.db.billingPeriods || []).map(p => `<option value="${p.id}" ${((ui.dsPeriodFilter || 'all') === p.id) ? 'selected' : ''}>${U.esc(p.label || p.id)}</option>`).join('');
    const table = U.table([{ t: 'Kỳ thu' }, { t: 'Chợ' }, { t: 'Thời gian thu' }, { t: 'Số buổi thu/phiếu' }, { t: 'Đã khớp', num: true }, { t: 'Chờ đối soát', num: true }, { t: 'Chờ giải trình / chênh lệch', num: true }, { t: 'Tổng tiền mặt', num: true }, { t: 'Trạng thái kỳ' }, { t: 'Thao tác' }], rows.map(s => `<tr><td><b>${U.esc(s.period.label || s.period.id)}</b></td><td>${U.esc(U.mShort(s.market))}</td><td>${U.dmy(s.period.startDate)} – ${U.dmy(s.period.endDate)}</td><td class="num">${s.rows.length}</td><td class="num">${s.matched.length}</td><td class="num">${s.pending.length}</td><td class="num">${s.unresolved.length}</td><td class="num">${U.money(s.total)}</td><td>${periodReconTag(s.state)}</td><td><button class="btn sm" data-act="ds-period-detail" data-period="${U.esc(s.period.id)}" data-market="${U.esc(s.market)}">Xem chi tiết</button></td></tr>`), { empty: 'Chưa có kỳ thu trong phạm vi được cấp' });
    const statusOptions = [['all', 'Trạng thái: Tất cả'], ['COLLECTING', 'Đang thu'], ['RECONCILING', 'Đang đối soát'], ['EXPLANATION', 'Chờ xử lý chênh lệch'], ['READY', 'Đủ điều kiện xác nhận'], ['COMPLETED', 'Đã hoàn tất đối soát'], ['CLOSED', 'Đã chốt kỳ thu']].map(([id, label]) => `<option value="${id}" ${statusFilter === id ? 'selected' : ''}>${label}</option>`).join('');
    return `<div class="period-reconcile-page"><div class="card"><div class="card-h"><div><h2 style="margin:0">Theo dõi kỳ đối soát</h2><div class="small muted">Tổng hợp từ các phiếu chốt buổi thu tiền mặt; Kế toán Trung tâm không chốt kỳ và không tạo công nợ.</div></div></div><div class="card-b row period-reconcile-filters"><select class="input" data-ch="ds-period-filter"><option value="all">Kỳ thu: Tất cả</option>${periodOptions}</select><select class="input" data-ch="ds-period-market"><option value="all">Chợ: Tất cả trong phạm vi</option>${marketOptions}</select><select class="input" data-ch="ds-period-status">${statusOptions}</select></div></div><div class="kpis period-reconcile-kpis"><div class="card kpi"><div class="k-label">Tổng phiếu chốt buổi thu</div><div class="k-value">${total}</div></div><div class="card kpi"><div class="k-label">Đã đối soát khớp</div><div class="k-value">${matched}</div></div><div class="card kpi"><div class="k-label">Đang chờ đối soát</div><div class="k-value">${pending}</div></div><div class="card kpi"><div class="k-label">Đang có chênh lệch</div><div class="k-value">${discrepancy}</div></div><div class="card kpi"><div class="k-label">Tiền mặt đã đối soát / chờ đối soát</div><div class="k-value">${U.moneyShort(reconciled)} / ${U.moneyShort(waiting)}</div><div class="k-sub">${U.money(reconciled)} / ${U.money(waiting)}</div></div></div><div class="card"><div class="card-b">${table}</div></div></div>`;
  }
  A.CH['ds-period-filter'] = el => { ui.dsPeriodFilter = el.value; A.render(); };
  A.CH['ds-period-market'] = el => { ui.dsPeriodMarket = el.value; A.render(); };
  A.CH['ds-period-status'] = el => { ui.dsPeriodStatus = el.value; A.render(); };
  A.ACT['ds-period-detail'] = el => {
    if (!U.can('theo-doi-ky-doi-soat')) return;
    const s = periodReconSummaries().find(x => x.period.id === el.dataset.period && x.market === el.dataset.market);
    if (!s) return;
    A.modal(A.mHead('Chi tiết kỳ đối soát · ' + U.esc(s.period.label || s.period.id)) + `<div class="modal-b">${periodReconDetailHtml(s)}</div>`, true);
  };
  A.ACT['ds-period-ho-view'] = el => {
    if (!U.can('theo-doi-ky-doi-soat')) return;
    const h = cashHandovers().find(x => x.id === el.dataset.id);
    if (h) hoModal(h);
  };
  A.ACT['ds-period-confirm'] = el => {
    if (!U.can('theo-doi-ky-doi-soat') || !A.canDo('theo-doi-ky-doi-soat.xac-nhan-hoan-tat', el.dataset.market)) return U.toast('Bạn chưa được cấp quyền xác nhận hoàn tất đối soát kỳ');
    const p = (A.db.billingPeriods || []).find(x => x.id === el.dataset.period), s = p && periodReconSummary(p, el.dataset.market);
    if (!s || s.state.id !== 'READY') return U.toast('Kỳ chưa đủ điều kiện xác nhận hoàn tất đối soát');
    const acc = A.currentAccount() || {};
    const byMarket = Object.assign({}, p.cashReconciliationByMarket || {});
    byMarket[el.dataset.market] = { status: 'COMPLETED', completedAt: nowStamp(), completedBy: acc.fullName || acc.code || acc.id || '' };
    p.cashReconciliationByMarket = byMarket;
    A.save(); A.closeModal(); A.render(); U.toast('Kỳ đã hoàn tất đối soát và sẵn sàng để Trưởng Ban Quản lý chốt kỳ thu');
  };
  // ==================== ĐỐI SOÁT THU TIỀN (Kế toán Trung tâm · 12 chợ) ====================
  // Thay nghiệp vụ cũ "Theo dõi kỳ đối soát"/"Đối soát buổi thu" đối với Kế toán Trung tâm (các hàm periodRecon* ở trên
  // giữ lại cho action cũ, không còn được render). Nguồn DUY NHẤT: bản ghi chốt kỳ collectionHandoffByMarket[market]
  // do NV thu phí sinh khi "Chốt kỳ thu" (snapshot số liệu thật). Kế toán chỉ đối chiếu tiền mặt bàn giao với tiền mặt
  // hệ thống và lưu vết: KHÔNG thu tiền, KHÔNG sửa payment/biên lai, KHÔNG chốt kỳ, KHÔNG đổi billingPeriod.status.
  // Route giữ id 'theo-doi-ky-doi-soat' để dùng lại screen/action permission đã cấp cho central_accountant.
  const rcCanView = () => U.can('theo-doi-ky-doi-soat');
  const rcInScope = market => A.allowedMarkets(A.currentAccount()).indexOf(market) !== -1;
  // Kế toán Trung tâm làm việc liên chợ: màn có bộ lọc Chợ riêng (topbar ẩn), nên KHÔNG ràng theo SelectedMarket.
  // Quyền = action permission (A.canDo không truyền market, vì guard chung so targetMarket với ui.market)
  // + phạm vi bản ghi kiểm tra riêng qua marketScopes (rcInScope).
  const rcCanConfirm = market => rcCanView() && rcInScope(market)
    && A.canDo('theo-doi-ky-doi-soat.xac-nhan-hoan-tat');
  const rcKey = (periodId, market) => periodId + '|' + market;
  function rcMarkets() {
    const allowed = new Set(A.allowedMarkets(A.currentAccount()));
    return (typeof A.effectiveMarkets === 'function' ? A.effectiveMarkets() : D.MARKETS).filter(m => allowed.has(m.id));
  }
  const rcPeriods = () => (A.db.billingPeriods || []).slice().sort((a, b) => String(b.id).localeCompare(String(a.id)));
  function rcDefaultPeriod() {
    const ps = rcPeriods();
    return (ps.find(p => p.collectionHandoffByMarket && Object.keys(p.collectionHandoffByMarket).length) || ps.find(p => p.status === 'COLLECTING') || ps[0] || {}).id || 'all';
  }
  function rcCollectorName(r, market) {
    if (r && (r.collectorName || r.completedBy)) return r.collectorName || r.completedBy;
    const col = A.ACCOUNTS.getMarketCollector ? A.ACCOUNTS.getMarketCollector(market) : null;
    return col ? col.fullName : '—';
  }
  // Mỗi dòng = 1 chợ + 1 kỳ. Chợ chưa chốt kỳ vẫn hiện (khi lọc 1 kỳ) để Kế toán thấy đủ 12 chợ.
  function rcRows(periodId) {
    const markets = rcMarkets();
    const rows = rcPeriods().filter(p => periodId === 'all' || p.id === periodId).flatMap(p => markets.map(m => {
      const r = ttHandoff(p, m.id), reconciled = !!r && rcStatus(r) === 'RECONCILED';
      return { p, m, r, bucket: !r ? 'OPEN' : reconciled ? 'RECONCILED' : 'WAITING', diff: reconciled && !!r.result && r.result !== 'MATCHED', collectorName: rcCollectorName(r, m.id) };
    }));
    return periodId === 'all' ? rows.filter(x => x.r) : rows;
  }
  function rcFind(periodId, market) {
    const p = (A.db.billingPeriods || []).find(x => x.id === periodId);
    return p && rcInScope(market) ? { p, m: U.market(market) || { id: market, name: market }, r: ttHandoff(p, market) } : null;
  }
  function rcEval(system, raw) {
    const v = String(raw == null ? '' : raw).trim() === '' ? NaN : Number(raw);
    if (!Number.isFinite(v) || v < 0 || Math.round(v) !== v) return { valid: false };
    const diff = v - system;
    return { valid: true, actual: v, diff, result: diff === 0 ? 'MATCHED' : diff < 0 ? 'SHORTAGE' : 'SURPLUS' };
  }
  function rcDiffHtml(ev) {
    if (!ev.valid) return '<div class="rc-diff"><span class="muted">Nhập số tiền mặt thực tế nhận để hệ thống tính chênh lệch.</span></div>';
    const sign = ev.diff > 0 ? '+' : ev.diff < 0 ? '−' : '';
    if (ev.result === 'MATCHED') return `<div class="rc-diff is-ok"><b>✓ ĐỦ</b><span>Chênh lệch: <b>0 đ</b></span></div>`;
    return `<div class="rc-diff ${ev.result === 'SHORTAGE' ? 'is-bad' : 'is-warn'}"><b>⚠ ${ev.result === 'SHORTAGE' ? 'THIẾU' : 'THỪA'}</b><span>Chênh lệch: <b>${sign}${U.money(Math.abs(ev.diff))}</b> · ${ev.result === 'SHORTAGE' ? 'Thiếu' : 'Thừa'} ${U.money(Math.abs(ev.diff))}</span></div>`;
  }
  const rcSubmitLabel = ev => ev.valid && ev.diff !== 0 ? 'Xác nhận kết quả đối soát' : 'Xác nhận đối soát';
  const rcSubmitOk = (ev, note) => ev.valid && (ev.diff === 0 || !!String(note || '').trim());
  function rcDraft(key) {
    if (!ui.rcDraft || ui.rcDraft.key !== key) ui.rcDraft = { key, actual: '', note: '' };
    return ui.rcDraft;
  }
  const rcSum = r => r.summary || {};
  // Số tiền đối soát của 1 bản ghi. Bản ghi mới (cashScope PERIOD_ONLY) đã loại thu hồi công nợ lúc chốt kỳ. Bản ghi chốt
  // trước quyết định này nhưng có danh sách payment: lọc bỏ payment.debtId ngay khi đọc (không ghi đè dữ liệu). Bản ghi cũ
  // không có danh sách payment: dùng nguyên số đã lưu.
  function rcFigures(r) {
    const sm = rcSum(r);
    if (sm.cashScope === 'PERIOD_ONLY' || !Array.isArray(sm.cashPaymentIds) || !Array.isArray(sm.transferPaymentIds)) {
      const cash = Number(sm.cash || 0), transfer = Number(sm.transfer || 0);
      return { cash, transfer, collected: sm.cashScope === 'PERIOD_ONLY' ? cash + transfer : Number(sm.collected || 0), transferCount: sm.transferCount != null ? sm.transferCount : (sm.transferPaymentIds || []).length, transferIds: sm.transferPaymentIds };
    }
    const own = ids => ids.map(id => A.db.payments.find(x => x.id === id)).filter(x => x && !x.debtId);
    const cp = own(sm.cashPaymentIds), tp = own(sm.transferPaymentIds), cash = U.sum(cp, x => x.amount), transfer = U.sum(tp, x => x.amount);
    return { cash, transfer, collected: cash + transfer, transferCount: tp.length, transferIds: tp.map(x => x.id) };
  }
  // Đối soát chuyển khoản: tổng chuyển khoản hệ thống ghi nhận trong kỳ (snapshot chốt kỳ) so với tổng tiền vào tài
  // khoản ngân hàng của chợ trong thời gian thu (sao kê db.bank, trừ tiền thu hồi công nợ — ngoài phạm vi kỳ, giống
  // phần tiền của kỳ). Bản ghi đã đối soát dùng số đã lưu lúc xác nhận.
  function rcBankCheck(p, m, r) {
    const fig = rcFigures(r);
    if (rcStatus(r) === 'RECONCILED' && r.bankInflowAmount != null) return { system: fig.transfer, systemCount: fig.transferCount, bank: r.bankInflowAmount, bankCount: r.bankInflowCount, diff: r.bankInflowAmount - fig.transfer };
    const debtPay = id => !!id && !!(A.db.payments.find(x => x.id === id) || {}).debtId;
    const lines = (A.db.bank || []).filter(b => b.market === m.id && b.date >= p.startDate && b.date <= p.endDate && !debtPay(b.paymentId) && !/^CHOSO CN-/.test(b.ref || ''));
    const bank = U.sum(lines, b => Number(b.amount || 0));
    return { system: fig.transfer, systemCount: fig.transferCount, bank, bankCount: lines.length, diff: bank - fig.transfer };
  }
  function rcBankHtml(bc) {
    const ok = bc.diff === 0, sign = bc.diff > 0 ? '+' : bc.diff < 0 ? '−' : '';
    return `<dl class="tt-sum"><div><dt>Chuyển khoản theo hệ thống</dt><dd>${U.money(bc.system)} <span class="small muted">· ${bc.systemCount || 0} giao dịch</span></dd></div><div><dt>Tiền vào tài khoản ngân hàng (sao kê)</dt><dd>${U.money(bc.bank)} <span class="small muted">· ${bc.bankCount || 0} giao dịch</span></dd></div></dl>
      <div class="rc-diff ${ok ? 'is-ok' : 'is-bad'}"><b>${ok ? '✓ KHỚP' : '⚠ CHÊNH LỆCH'}</b><span>Chênh lệch: <b>${sign}${U.money(Math.abs(bc.diff))}</b>${ok ? '' : ' · Kiểm tra lại sao kê ngân hàng'}</span></div>`;
  }
  function rcDetailHtml(x) {
    const { p, m, r } = x, sm = rcSum(r), acc = A.currentAccount() || {}, done = rcStatus(r) === 'RECONCILED', can = !done && rcCanConfirm(m.id);
    const fig = rcFigures(r), system = fig.cash, transfer = fig.transfer, transferCount = fig.transferCount;
    const draft = rcDraft(rcKey(p.id, m.id)), ev = rcEval(system, draft.actual);
    const paid = sm.paidCount != null ? `${sm.paidCount}/${sm.receivables}` : '—';
    const cashBlock = done
      ? `<dl class="tt-sum"><div><dt>Tiền mặt theo hệ thống</dt><dd>${U.money(r.systemCashAmount)}</dd></div><div><dt>Tiền mặt thực nhận</dt><dd>${U.money(r.actualCashAmount)}</dd></div></dl>
        ${rcDiffHtml({ valid: true, diff: Number(r.differenceAmount || 0), result: r.result || 'MATCHED' })}
        <dl class="tt-sum"><div><dt>Ghi chú đối soát</dt><dd>${r.note ? U.esc(r.note) : '<span class="muted">—</span>'}</dd></div></dl>`
      : can ? `<dl class="tt-sum"><div class="is-total"><dt>Tiền mặt theo hệ thống</dt><dd>${U.money(system)}</dd></div></dl>
        <div class="field"><label for="rc-actual">Tiền mặt thực tế nhận (đ)</label><input id="rc-actual" class="input rc-actual" type="number" min="0" step="1000" inputmode="numeric" data-in="rc-actual" data-system="${system}" value="${U.esc(draft.actual)}" placeholder="${system}"></div>
        <div id="rc-diff-box">${rcDiffHtml(ev)}</div>
        <div class="field"><label for="rc-note">Ghi chú đối soát <span id="rc-note-req" class="small ${ev.valid && ev.diff !== 0 ? 'tt-err' : 'muted'}">${ev.valid && ev.diff !== 0 ? '(bắt buộc khi có chênh lệch)' : '(không bắt buộc khi khớp)'}</span></label><textarea id="rc-note" class="input" rows="2" data-in="rc-note" placeholder="Lý do chênh lệch, người bàn giao, ...">${U.esc(draft.note)}</textarea></div>`
      : `<dl class="tt-sum"><div class="is-total"><dt>Tiền mặt theo hệ thống</dt><dd>${U.money(system)}</dd></div></dl><div class="note info">Bạn chỉ có quyền xem bản ghi đối soát này.</div>`;
    return `<div class="modal-b tt-pay rc-modal">
      <div class="tt-pay-who"><b>${U.esc(m.name)}</b> · Kỳ ${U.esc(ttPeriodLabel(p))} ${rcStatusTag(r)}${r.prototypeBypass ? ' <span class="tag warn">Prototype — chốt kỳ mô phỏng</span>' : ''}</div>
      <dl class="tt-sum"><div><dt>NV thu phí</dt><dd>${U.esc(rcCollectorName(r, m.id))}</dd></div><div><dt>Ngày chốt kỳ</dt><dd>${U.esc(rcClosedAt(r) || '—')}</dd></div>
        <div><dt>Người đối soát</dt><dd>${U.esc(done ? r.reconciledBy || '—' : acc.fullName || acc.code || '—')}</dd></div>${done ? `<div><dt>Thời gian đối soát</dt><dd>${U.esc(r.reconciledAt || '')}</dd></div>` : ''}</dl>
      <h4 class="tt-sec-title">1. Kết quả thu đã chốt <span class="small muted">(chỉ xem)</span></h4>
      <dl class="tt-sum"><div><dt>Tổng khoản thu</dt><dd>${sm.receivables != null ? sm.receivables : '—'}</dd></div><div><dt>Đã thu</dt><dd>${paid}</dd></div>
        <div><dt>Tổng phải thu</dt><dd>${U.money(sm.amount || 0)}</dd></div><div><dt>Tổng đã thu</dt><dd>${U.money(fig.collected)}</dd></div>${sm.remaining ? `<div class="is-total"><dt>Còn phải thu</dt><dd>${U.money(sm.remaining)}</dd></div>` : ''}</dl>
      <h4 class="tt-sec-title">2. Phân theo phương thức</h4>
      <dl class="tt-sum"><div><dt>Tiền mặt</dt><dd>${U.money(system)}</dd></div><div><dt>Chuyển khoản</dt><dd>${U.money(transfer)}</dd></div><div class="is-total"><dt>Tổng</dt><dd>${U.money(system + transfer)}</dd></div></dl>
      <h4 class="tt-sec-title">3. Đối soát tiền mặt bàn giao</h4>${cashBlock}
      <h4 class="tt-sec-title">4. Đối soát chuyển khoản</h4>${rcBankHtml(rcBankCheck(p, m, r))}</div>
      <div class="modal-f"><button class="btn" data-act="close">${can ? 'Hủy' : 'Đóng'}</button>${can ? `<button id="rc-submit" class="btn primary" data-act="rc-review" data-period="${U.esc(p.id)}" data-market="${U.esc(m.id)}" ${rcSubmitOk(ev, draft.note) ? '' : 'disabled'}>${rcSubmitLabel(ev)}</button>` : ''}</div>`;
  }
  function rcOpen(periodId, market) {
    const x = rcFind(periodId, market);
    if (!rcCanView() || !x || !x.r) return U.toast('Không tìm thấy bản ghi đối soát trong phạm vi của bạn');
    A.modal(A.mHead('Đối soát thu tiền') + rcDetailHtml(x), true);
  }
  function rcView() {
    // Bảng không có cột Kỳ thu nên bộ lọc luôn là 1 kỳ cụ thể.
    const markets = rcMarkets(), periodId = rcPeriods().some(p => p.id === ui.rcPeriod) ? ui.rcPeriod : rcDefaultPeriod(), marketF = markets.some(m => m.id === ui.rcMarket) ? ui.rcMarket : 'all';
    const statusF = ['WAITING', 'DIFF', 'RECONCILED'].includes(ui.rcStatus) ? ui.rcStatus : 'all', q = String(ui.rcSearch || '').trim().toLowerCase();
    const base = rcRows(periodId).filter(x => marketF === 'all' || x.m.id === marketF);
    const rows = base.filter(x => (statusF === 'all' || (statusF === 'DIFF' ? x.diff : x.bucket === statusF))
      && (!q || [x.m.name, x.m.id, ttPeriodLabel(x.p), x.p.id, x.collectorName].join(' ').toLowerCase().includes(q)));
    const k = (label, value, cls) => `<div class="card kpi"><div class="k-label">${label}</div><div class="k-value ${cls || ''}">${value}</div></div>`;
    const cnt = b => base.filter(x => b === 'DIFF' ? x.diff : x.bucket === b).length;
    const body = rows.map(x => {
      const sm = x.r ? rcFigures(x.r) : null, act = !x.r ? '<span class="small muted">Chưa chốt kỳ</span>'
        : `<button class="btn sm ${x.bucket === 'WAITING' && rcCanConfirm(x.m.id) ? 'primary' : ''}" data-act="rc-open" data-period="${U.esc(x.p.id)}" data-market="${U.esc(x.m.id)}">${x.bucket === 'WAITING' && rcCanConfirm(x.m.id) ? 'Đối soát' : 'Xem'}</button>`;
      // Ngày đối soát = ngày lưu kết quả đối soát (chỉ ngày; giờ xem ở chi tiết).
      const rcDay = x.r && rcStatus(x.r) === 'RECONCILED' && x.r.reconciledAt ? String(x.r.reconciledAt).split(' ')[0] : '';
      return `<tr><td><b>${U.esc(x.m.name)}</b></td><td>${U.esc(x.collectorName)}</td><td class="nowrap">${rcDay ? U.esc(rcDay) : '<span class="muted">—</span>'}</td>
        <td class="num">${sm ? U.money(sm.collected) : '—'}</td><td class="num">${sm ? U.money(sm.cash) : '—'}</td><td class="num">${sm ? U.money(sm.transfer) : '—'}</td>
        <td>${rcStatusTag(x.r)}</td><td class="nowrap">${act}</td></tr>`;
    });
    return `<div class="card"><div class="card-b"><h2 style="margin:0">Đối soát thu tiền</h2><div class="small muted">Đối chiếu và xác nhận số tiền do Nhân viên thu phí bàn giao từ các chợ.</div></div></div>
      <div class="kpis">${k('Tổng chợ', marketF === 'all' ? markets.length : 1)}${k('Chờ đối soát', cnt('WAITING'), cnt('WAITING') ? 'tt-bad' : '')}${k('Đã đối soát', cnt('RECONCILED'), 'tt-ok')}${k('Có chênh lệch', cnt('DIFF'), cnt('DIFF') ? 'tt-bad' : '')}</div>
      <div class="card"><div class="card-b tt-toolbar">
        <label class="tt-f"><span>Kỳ thu</span><select class="input" data-ch="rc-period">${rcPeriods().map(p => `<option value="${U.esc(p.id)}" ${p.id === periodId ? 'selected' : ''}>${U.esc(ttPeriodLabel(p))}</option>`).join('')}</select></label>
        <label class="tt-f"><span>Chợ</span><select class="input" data-ch="rc-market"><option value="all">Tất cả ${markets.length} chợ</option>${markets.map(m => `<option value="${m.id}" ${m.id === marketF ? 'selected' : ''}>${U.esc(m.name)}</option>`).join('')}</select></label>
        <div class="seg">${[['all', 'Tất cả'], ['WAITING', 'Chờ đối soát'], ['DIFF', 'Có chênh lệch'], ['RECONCILED', 'Đã đối soát']].map(s => `<button class="${statusF === s[0] ? 'on' : ''}" data-act="rc-status" data-id="${s[0]}">${s[1]}</button>`).join('')}</div>
        <input class="input tt-search" data-in="rc-search" value="${U.esc(ui.rcSearch || '')}" placeholder="Tìm theo chợ, nhân viên thu phí..."></div>
      <div class="card-b">${U.table([{ t: 'Chợ' }, { t: 'NV thu phí' }, { t: 'Ngày đối soát' }, { t: 'Tổng đã thu', num: true }, { t: 'Tiền mặt bàn giao', num: true }, { t: 'Chuyển khoản', num: true }, { t: 'Trạng thái đối soát' }, { t: 'Thao tác' }], body,
        { empty: 'Không có bản ghi đối soát phù hợp bộ lọc' })}
        <div class="small muted tt-foot">Bản ghi được tạo khi Nhân viên thu phí Chốt kỳ thu. Kế toán Trung tâm không chốt kỳ, không thu tiền và không sửa giao dịch.</div></div></div>`;
  }
  A.VIEWS['theo-doi-ky-doi-soat'] = function () {
    if (!rcCanView()) return '<div class="card"><div class="empty">Bạn chưa được cấp quyền xem màn Đối soát thu tiền.</div></div>';
    return rcView();
  };
  A.CH['rc-period'] = el => { ui.rcPeriod = el.value || 'all'; A.render(); };
  A.CH['rc-market'] = el => { ui.rcMarket = el.value || 'all'; A.render(); };
  A.ACT['rc-status'] = el => { ui.rcStatus = el.dataset.id || 'all'; A.render(); };
  A.IN['rc-search'] = el => { ui.rcSearch = el.value; A.render(); };
  A.ACT['rc-open'] = el => rcOpen(el.dataset.period, el.dataset.market);
  // Tính chênh lệch ngay khi nhập — cập nhật DOM tại chỗ, không render lại modal để giữ con trỏ.
  function rcSyncForm() {
    const d = ui.rcDraft, inp = A.$('#rc-actual');
    if (!d || !inp) return;
    const ev = rcEval(Number(inp.dataset.system), d.actual), box = A.$('#rc-diff-box'), btn = A.$('#rc-submit'), req = A.$('#rc-note-req');
    if (box) box.innerHTML = rcDiffHtml(ev);
    if (btn) { btn.disabled = !rcSubmitOk(ev, d.note); btn.textContent = rcSubmitLabel(ev); }
    if (req) { const need = ev.valid && ev.diff !== 0; req.className = 'small ' + (need ? 'tt-err' : 'muted'); req.textContent = need ? '(bắt buộc khi có chênh lệch)' : '(không bắt buộc khi khớp)'; }
  }
  A.IN['rc-actual'] = el => { if (ui.rcDraft) { ui.rcDraft.actual = el.value; rcSyncForm(); } };
  A.IN['rc-note'] = el => { if (ui.rcDraft) { ui.rcDraft.note = el.value; rcSyncForm(); } };
  // Kiểm tra lại toàn bộ trong handler: quyền + phạm vi chợ + bản ghi còn CHỜ ĐỐI SOÁT + số liệu nhập hợp lệ.
  function rcCommitContext(el) {
    const x = rcFind(el.dataset.period, el.dataset.market);
    if (!x || !x.r) return { err: 'Không tìm thấy bản ghi đối soát trong phạm vi của bạn' };
    if (!rcCanConfirm(x.m.id)) return { err: 'Bạn chưa được cấp quyền xác nhận đối soát thu tiền' };
    if (rcStatus(x.r) !== 'WAITING') return { err: rcStatus(x.r) === 'RECONCILED'
      ? 'Bản ghi đã được đối soát — không chỉnh sửa'
      : 'Bản ghi không còn ở trạng thái Chờ đối soát' };
    const fig = rcFigures(x.r), d = rcDraft(rcKey(x.p.id, x.m.id)), system = fig.cash, ev = rcEval(system, d.actual);
    if (!ev.valid) return { err: 'Vui lòng nhập số tiền mặt thực tế nhận hợp lệ' };
    if (ev.diff !== 0 && !String(d.note || '').trim()) return { err: 'Có chênh lệch — bắt buộc nhập ghi chú đối soát' };
    return Object.assign(x, { d, ev, system, transfer: fig.transfer, collected: fig.collected, acc: A.currentAccount() || {} });
  }
  A.ACT['rc-review'] = el => {
    const c = rcCommitContext(el);
    if (c.err) return U.toast(c.err);
    const res = RC_RESULT[c.ev.result];
    A.modal(A.mHead('Xác nhận kết quả đối soát') + `<div class="modal-b tt-pay">
      <div class="tt-pay-who"><b>${U.esc(c.m.name)}</b> · Kỳ ${U.esc(ttPeriodLabel(c.p))}<div class="small muted">NV bàn giao: ${U.esc(rcCollectorName(c.r, c.m.id))}</div></div>
      <dl class="tt-sum"><div><dt>Tổng đã thu</dt><dd>${U.money(c.collected)}</dd></div><div><dt>Tiền mặt theo hệ thống</dt><dd>${U.money(c.system)}</dd></div>
        <div><dt>Tiền mặt thực nhận</dt><dd>${U.money(c.ev.actual)}</dd></div><div><dt>Chuyển khoản</dt><dd>${U.money(c.transfer)}</dd></div>
        <div class="is-total"><dt>Chênh lệch</dt><dd>${c.ev.diff > 0 ? '+' : c.ev.diff < 0 ? '−' : ''}${U.money(Math.abs(c.ev.diff))}</dd></div><div><dt>Kết quả</dt><dd><span class="tag ${res[1]}">${res[0].toUpperCase()}</span></dd></div>
        <div><dt>Người đối soát</dt><dd>${U.esc(c.acc.fullName || c.acc.code || '')}</dd></div><div><dt>Ghi chú</dt><dd>${c.d.note ? U.esc(c.d.note) : '<span class="muted">—</span>'}</dd></div></dl>
      <div class="note" style="margin-top:12px">Sau khi xác nhận, kết quả đối soát được lưu vết và không chỉnh sửa. Kỳ thu vẫn ở trạng thái Đã chốt.</div></div>
      <div class="modal-f"><button class="btn" data-act="rc-open" data-period="${U.esc(c.p.id)}" data-market="${U.esc(c.m.id)}">Hủy</button><button class="btn primary" data-act="rc-commit" data-period="${U.esc(c.p.id)}" data-market="${U.esc(c.m.id)}">${c.ev.diff === 0 ? 'Xác nhận đối soát' : 'Xác nhận kết quả đối soát'}</button></div>`);
  };
  A.ACT['rc-commit'] = el => {
    const c = rcCommitContext(el);
    if (c.err) { U.toast(c.err); A.closeModal(); A.render(); return; }
    // Chỉ ghi vào bản ghi đối soát; billingPeriod.status, payment, biên lai, khoản phải thu không đổi.
    // Lưu snapshot đối soát chuyển khoản (tiền vào tài khoản ngân hàng tại thời điểm xác nhận).
    const bc = rcBankCheck(c.p, c.m, c.r);
    Object.assign(c.r, { bankInflowAmount: bc.bank, bankInflowCount: bc.bankCount, transferDifferenceAmount: bc.diff });
    Object.assign(c.r, { reconciliationStatus: 'RECONCILED', reconciledAt: nowStamp(), reconciledBy: c.acc.fullName || c.acc.code || c.acc.id, reconciledById: c.acc.id, reconciledByCode: c.acc.code || '',
      systemCashAmount: c.system, actualCashAmount: c.ev.actual, transferAmount: c.transfer, totalCollectedAmount: c.collected, differenceAmount: c.ev.diff, result: c.ev.result, note: String(c.d.note || '').trim() });
    ui.rcDraft = null;
    U.log('Đối soát thu tiền ' + c.m.id + ' kỳ ' + ttPeriodLabel(c.p) + ': ' + c.ev.result + ' (chênh lệch ' + U.money(c.ev.diff) + ')');
    A.save(); A.render(); rcOpen(c.p.id, c.m.id);
    U.toast('Đã xác nhận đối soát ' + c.m.name + ' kỳ ' + ttPeriodLabel(c.p) + ' — ' + RC_RESULT[c.ev.result][0]);
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
    if (q) cands = cands.filter(i => i.id.toLowerCase().includes(q) || A.idx.trader.get(i.traderId).name.toLowerCase().includes(q) || U.invStall(i).code.toLowerCase().includes(q));
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
        cands.map(i => `<tr><td>${i.id}</td><td>${U.esc(A.idx.trader.get(i.traderId).name)}</td><td>${U.invStall(i).code}</td><td>${U.per(i.period)}</td><td class="num">${U.money(U.due(i))}</td><td><button class="btn sm primary" data-act="ds-bank-match-pick" data-inv="${i.id}">Chọn</button></td></tr>`),
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
      const label = inv ? U.invStall(inv).code : (reg ? (reg.code || reg.id) + (s ? ' · ' + U.dmy(s.sessionDate || s.date) : '') : '');
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
    A.syncDebts();
    if ((U.market(ui.market) || {}).receivableGrouping === 'TRADER') return cnDebtView();
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
          <td class="nowrap">${A.canDo('cong-no.nhac-no', x.t.market) ? `<button class="btn sm" data-act="cn-remind" data-id="${x.t.id}">Nhắc nợ</button>` : ''} ${receivableCollectAllowedForMarket(x.t.market) ? `<button class="btn sm primary" data-act="pay-open" data-id="${x.t.id}">Thu tiền</button>` : ''}</td></tr>`), { empty: 'Không có nợ quá hạn 🎉' })}${pg.html}</div></div>`;
  };
  // THU_HOI_NO (P chốt 29/09/2026): NV thu phí phụ trách gian đi thu nợ; KHÔNG trả nợ một phần (thu đủ phần nợ của
  // mình); số tiền = đúng số còn thiếu (phạt/lãi: chưa có). Tiền ghi vào KHOẢN THU GỐC (PT-…, cái chính) và gắn
  // mã nợ CN-… trên giao dịch/biên lai; QR thu nợ dùng nội dung mã nợ nhưng luôn map về mã khoản thu.
  // Quyền: action:cong-no.thu-no (collector) + phần nợ thuộc chính tài khoản — kiểm tra lại trong handler.
  function cnDebtCtx(debtId) {
    const d = (A.db.debts || []).find(x => x.id === debtId), acc = A.currentAccount();
    if (!d || d.market !== ui.market || d.status !== 'OPEN') return { err: 'Khoản nợ không còn hợp lệ' };
    if (!acc || !U.can('cong-no') || !A.canDo('cong-no.thu-no', d.market)) return { err: 'Bạn không có quyền thu hồi nợ' };
    const inv = A.idx.invoice.get(d.invoiceId); if (!inv) return { err: 'Không tìm thấy khoản thu gốc' };
    if (A.allowedMarkets(acc).indexOf(d.market) === -1) return { err: 'Khoản nợ ngoài phạm vi Chợ được phân công' };
    const ids = U.invStallIds(inv);
    return { d, inv, acc, ids, amount: U.due(inv), t: A.idx.trader.get(d.traderId) };
  }
  const cnQrContent = d => 'CHOSO ' + d.id + ' ' + d.invoiceId;
  const cnCyc = () => { const c = (A.SERVICE_CFG && A.SERVICE_CFG.cycle()) || {}; const r1 = Number(c.reminder1Days) || 3; return { r1, r2: Math.max(r1, Number(c.reminder2Days) || 7) }; };
  function cnDebtView() {
    const scopeAll = ptScopeAll();
    const st = ['open', 'cut', 'closed', 'all'].indexOf(f.cnDebtStatus) !== -1 ? f.cnDebtStatus : 'open';
    const scoped = (A.db.debts || []).filter(d => d.market === ui.market && A.allowedMarkets(A.currentAccount()).indexOf(d.market) !== -1)
      .map(d => { const i = A.idx.invoice.get(d.invoiceId); return { d, i, t: A.idx.trader.get(d.traderId), remain: i ? U.due(i) : 0, pays: A.db.payments.filter(x => x.debtId === d.id) }; })
      .sort((a, b) => ({ OPEN: 0, UNRECOVERABLE: 1 }[a.d.status] ?? 2) - ({ OPEN: 0, UNRECOVERABLE: 1 }[b.d.status] ?? 2) || a.d.dueDate.localeCompare(b.d.dueDate) || a.d.id.localeCompare(b.d.id));
    const open = scoped.filter(x => x.d.status === 'OPEN'), closed = scoped.filter(x => x.d.status === 'CLOSED'), cut = scoped.filter(x => x.d.status === 'UNRECOVERABLE');
    const list = st === 'open' ? open : st === 'closed' ? closed : st === 'cut' ? cut : scoped;
    const tot = U.sum(open, x => x.remain), maxDays = Math.max.apply(null, open.map(x => U.days(x.d.dueDate, U.today())).concat([0]));
    const canCollect = A.canDo('cong-no.thu-no', ui.market);
    const pg = U.pager('cnDebt', list.length, 20);
    const statusCell = x => {
      if (x.d.status === 'UNRECOVERABLE') return `<span class="tag danger">⚡ Không thu hồi · danh sách cắt điện</span><div class="small muted">Đã gửi thông báo cắt điện ${U.esc(x.d.powerCut.noticeSentAt)} · luồng kết thúc</div>`;
      if (x.d.status !== 'OPEN') {
        // Luồng kết thúc khi: QR (tiền vào tài khoản) hoặc tiền mặt đã chốt buổi và Kế toán xác nhận nộp đủ.
        const hoOf = p => (A.db.cashHandovers || []).find(h => h.paymentIds.indexOf(p.id) !== -1);
        const st2 = p => { if (p.method !== 'tm') return '<span class="tag ok">QR · hoàn tất</span>'; const h = hoOf(p); return !h ? '<span class="tag warn">Tiền mặt · chưa chốt buổi</span>' : h.status !== 'RECONCILED' ? `<span class="tag warn">Đã chốt ${h.id} · chờ Kế toán</span>` : h.diff ? `<span class="tag danger">Kế toán: nộp lệch ${U.money(h.diff)}</span>` : '<span class="tag ok">Kế toán xác nhận nộp đủ · hoàn tất</span>'; };
        const done = x.pays.length && x.pays.every(p => p.method !== 'tm' || ((hoOf(p) || {}).status === 'RECONCILED'));
        return `<span class="tag ${done ? 'ok' : 'warn'}">${done ? '✓ Đã thu hồi · hoàn tất' : '✓ Đã thu nợ · chờ nộp Kế toán'}</span>${x.pays.map(p => `<div class="small"><button class="link-btn" data-act="receipt" data-id="${p.receipt}">${p.receipt}</button> <span class="muted">${U.esc(D.METHOD[p.method] || p.method)} · ${U.dmy(p.date)} ${p.time || ''}</span><div>${st2(p)}</div></div>`).join('')}`;
      }
      return `<span class="tag danger">Còn nợ</span>${canCollect ? `<div class="row" style="gap:6px;margin-top:6px;flex-wrap:nowrap"><label class="btn sm primary" style="gap:6px;cursor:pointer"><input type="checkbox" data-ch="cn-collect" data-id="${x.d.id}"> Đã thu nợ</label></div>` : ''}`;
    };
    return `<div class="kpis">
      <div class="card kpi"><div class="k-label">Khoản còn nợ</div><div class="k-value" style="color:#df2225">${open.length}</div><div class="k-sub">${new Set(open.map(x => x.d.traderId)).size} tiểu thương</div></div>
      <div class="card kpi"><div class="k-label">Tổng nợ còn lại</div><div class="k-value" style="color:#df2225">${U.moneyShort(tot)}</div><div class="k-sub">${U.money(tot)}</div></div>
      <div class="card kpi"><div class="k-label">Đã thu hồi</div><div class="k-value" style="color:#20a04e">${closed.length}</div><div class="k-sub">${U.money(U.sum(closed, x => U.sum(x.pays, p => p.amount)))}</div></div>
      <div class="card kpi"><div class="k-label">Danh sách cắt điện</div><div class="k-value" style="color:#df2225">${cut.length}</div><div class="k-sub">${U.money(U.sum(cut, x => x.remain))} không thu hồi</div></div></div>
    <div class="card"><div class="card-b" style="padding-top:12px"><div class="seg">${[['open', 'Còn nợ', open.length], ['cut', 'Danh sách cắt điện', cut.length], ['closed', 'Đã thu hồi', closed.length], ['all', 'Tất cả', scoped.length]].map(x => `<button class="${st === x[0] ? 'on' : ''}" data-act="cn-debt-status" data-id="${x[0]}">${x[1]} (${x[2]})</button>`).join('')}</div>${scopeAll ? ' <span class="tag">Chỉ xem — NV thu phí phụ trách gian đi thu nợ</span>' : ''}</div></div>
    <div class="card"><div class="card-h"><div><h3>Khoản nợ chuyển từ Khoản phải thu</h3><div class="small muted">Quá hạn nộp → hệ thống tự chuyển sang đây. Thu nợ: đúng số còn thiếu, không thu một phần. Tiền ghi vào mã khoản thu gốc; biên lai gắn mã nợ. Tiểu thương có thể quét QR thu nợ (nội dung mã nợ, tự khớp về mã khoản thu). Hệ thống tự nhắc lần 1 sau ${cnCyc().r1} ngày, lần 2 sau ${cnCyc().r2} ngày quá hạn; quá ${cnCyc().r2} ngày → không thu hồi, vào danh sách cắt điện và gửi thông báo cắt điện.</div></div></div>
      <div class="card-b">${U.table([{ t: 'Mã nợ' }, { t: 'Mã khoản thu gốc' }, { t: 'Tiểu thương' }, { t: 'Gian' }, { t: 'Số tiền nợ', num: true }, { t: 'Quá hạn', num: true }, { t: 'Trạng thái' }, { t: 'Nhắc nợ' }],
        list.slice(pg.start, pg.end).map(x => `<tr style="${x.d.status !== 'OPEN' ? 'opacity:.6' : ''}"><td><b>${x.d.id}</b><div class="small muted">${U.esc(x.d.createdBy)} · ${U.esc(x.d.createdAt)}</div></td><td><button class="link-btn" data-act="inv-open" data-id="${x.d.invoiceId}">${x.d.invoiceId}</button><div class="small muted">Kỳ ${U.per(x.d.period)} · hạn ${U.dmy(x.d.dueDate)}</div></td>
          <td><b>${U.esc(x.t ? x.t.name : '')}</b><div class="small muted">${x.t ? x.t.id + ' · ' + U.maskPhone(x.t.phone) : ''}</div></td><td>${x.d.stallIds.map(id => (A.idx.stall.get(id) || {}).code || id).join(', ')}</td>
          <td class="num"><b>${U.money(x.d.status === 'OPEN' ? x.remain : x.d.amount)}</b></td><td class="num">${x.d.status === 'OPEN' ? `<span class="tag danger">${U.days(x.d.dueDate, U.today())} ngày</span>` : '—'}</td><td>${statusCell(x)}</td>
          <td class="small">${(x.d.autoReminders || []).map(r => `<div>Lần ${r.level}: ${U.esc(r.at)} <span class="muted">(tự động)</span></div>`).join('')}${x.d.status === 'OPEN' ? `<div class="nowrap" style="margin-top:4px">${(x.i && x.i.reminders) || 0} lượt ${A.canDo('cong-no.nhac-no', ui.market) ? `<button class="btn sm" data-act="cn-debt-remind" data-id="${x.d.id}">Nhắc nợ</button>` : ''} <button class="btn sm" data-act="cn-debt-qr" data-id="${x.d.id}">QR</button></div>` : (x.d.autoReminders || []).length ? '' : '—'}</td></tr>`),
        { empty: st === 'open' ? 'Không còn khoản nợ 🎉' : 'Không có dòng phù hợp' })}${pg.html}</div></div>${!scopeAll && A.canDo('cong-no.thu-no', ui.market) ? hoCollectorPanel(financePeriod(), U.today(), 'DEBT') : ''}`;
  }
  A.ACT['cn-debt-status'] = el => { if (!U.can('cong-no')) return; f.cnDebtStatus = el.dataset.id; ui.page.cnDebt = 0; A.render(); };
  A.CH['cn-collect'] = el => {
    el.checked = false;
    const c = cnDebtCtx(el.dataset.id);
    if (c.err) { U.toast(c.err); A.render(); return; }
    A.modal(A.mHead('Xác nhận đã thu nợ') + `<div class="modal-b">
      <dl class="kv"><dt>Tiểu thương</dt><dd><b>${U.esc(c.t ? c.t.name : '')}</b> (${c.d.traderId})</dd><dt>Mã nợ</dt><dd><b>${c.d.id}</b></dd><dt>Khoản thu gốc</dt><dd>${c.inv.id} · kỳ ${U.per(c.inv.period)}</dd>
        <dt>Gian</dt><dd>${c.ids.map(id => (A.idx.stall.get(id) || {}).code || id).join(', ')}</dd><dt>Số tiền</dt><dd><b style="font-size:1.2em">${U.money(c.amount)}</b></dd></dl>
      <div class="note info" style="margin-top:10px">Thu đủ đúng số trên (không thu một phần). Biên lai phát ngay, ghi vào khoản thu ${c.inv.id}, gắn mã nợ ${c.d.id}; tiền mặt vào buổi thu hiện tại để chốt nộp Kế toán.</div></div>
      <div class="modal-f"><button class="btn" data-act="close">Hủy</button><button class="btn primary" data-act="cn-collect-confirm" data-id="${c.d.id}">✓ Đã nhận đủ tiền mặt</button></div>`);
  };
  A.ACT['cn-collect-confirm'] = el => {
    const c = cnDebtCtx(el.dataset.id);
    if (c.err) { U.toast(c.err); A.closeModal(); A.render(); return; }
    const pays = A.payDebt(c.d, 'tm', c.acc.code || c.acc.id, c.ids);
    if (!pays.length) { U.toast('Không ghi nhận được khoản thu nợ'); return; }
    U.log('Thu hồi nợ ' + c.d.id + ' (khoản ' + c.inv.id + '): ' + U.money(c.amount) + ' tiền mặt');
    A.render(); A.showReceipt(pays, { autoPrint: false });
    U.toast('Đã thu nợ ' + U.money(c.amount) + (c.d.status === 'CLOSED' ? ' · khoản nợ đã tất toán' : ''));
  };
  A.ACT['cn-debt-qr'] = el => {
    const d = (A.db.debts || []).find(x => x.id === el.dataset.id), me = (A.currentAccount() || {}).id;
    if (!d || d.market !== ui.market || !U.can('cong-no') || A.allowedMarkets(A.currentAccount()).indexOf(d.market) === -1) return;
    const i = A.idx.invoice.get(d.invoiceId), bank = (D.BANK_BY_MARKET && D.BANK_BY_MARKET[d.market]) || 'Vietcombank';
    A.modal(A.mHead('QR thu nợ ' + d.id) + `<div class="modal-b" style="text-align:center">
      <div style="display:inline-block;padding:14px;border:1px solid #d9dfeb;border-radius:12px;font-size:64px;line-height:1">▦</div>
      <dl class="kv" style="text-align:left;margin-top:12px"><dt>Ngân hàng</dt><dd>${U.esc(bank)} · Ban Quản lý ${U.esc(U.mShort(d.market))}</dd><dt>Số tiền</dt><dd><b>${U.money(i ? U.due(i) : d.amount)}</b> <span class="small muted">(toàn bộ nợ còn lại, cố định)</span></dd>
        <dt>Nội dung</dt><dd><b>${cnQrContent(d)}</b></dd><dt>Tự khớp</dt><dd>Mã nợ ${d.id} → khoản thu ${d.invoiceId}</dd></dl>
      <div class="small muted">QR mô phỏng. Tiểu thương quét → ngân hàng báo có → hệ thống tự ghi vào khoản thu gốc, phát biên lai, tất toán nợ.</div></div>
      <div class="modal-f"><button class="btn primary" data-act="close">Đóng</button></div>`);
  };
  A.ACT['cn-debt-remind'] = el => {
    const d = (A.db.debts || []).find(x => x.id === el.dataset.id), me = (A.currentAccount() || {}).id;
    if (!d || d.status !== 'OPEN' || d.market !== ui.market || !A.canDo('cong-no.nhac-no', d.market) || A.allowedMarkets(A.currentAccount()).indexOf(d.market) === -1) return U.toast('Không thể nhắc khoản nợ này');
    const i = A.idx.invoice.get(d.invoiceId), t = A.idx.trader.get(d.traderId);
    if (i) i.reminders = (i.reminders || 0) + 1;
    A.db.notifications = A.db.notifications || [];
    A.db.notifications.unshift({ id: 'TB-' + U.pad(32 + A.db.notifications.length, 3), at: U.today(), kind: 'DEBT_REMINDER', market: d.market, traderId: d.traderId, debtId: d.id, invoiceId: d.invoiceId,
      title: 'Nhắc nợ ' + d.id + ' (khoản ' + d.invoiceId + ')', group: 'Nhắc nợ · ' + (t ? t.name : d.traderId), channels: ['Mini app', 'Zalo OA', 'SMS'], sent: 1, delivered: 1, read: 0, auto: false,
      body: 'Khoản ' + d.invoiceId + ' quá hạn ' + U.dmy(d.dueDate) + ', còn nợ ' + U.money(i ? U.due(i) : d.amount) + '. Trả tiền mặt cho NV thu phí hoặc quét QR nội dung "' + cnQrContent(d) + '".' });
    U.log('Nhắc nợ ' + d.id + ' tới ' + (t ? t.name : d.traderId));
    A.save(); A.render(); U.toast('Đã gửi nhắc nợ ' + d.id + ' kèm QR thu nợ tới ' + (t ? t.name : ''));
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
    A.db.invoices.filter(i => U.inM(i) && U.isOver(i)).forEach(i => rows.push([A.idx.trader.get(i.traderId).name, U.invStall(i).code, i.id, U.per(i.period), U.due(i), U.overDays(i)]));
    U.csv('cong-no-qua-han', ['Tiểu thương', 'Điểm KD', 'Khoản', 'Kỳ', 'Còn nợ', 'Số ngày quá hạn'], rows);
  };

  // HINH_THUC_THU_DIEN_NUOC — chặn ở MỌI handler ghi dữ liệu chỉ số điện, nước (không chỉ ẩn nút) khi chợ
  // đang thu chia đều như dịch vụ.
  (function guardMeterHandlers() {
    const block = fn => function (el) { if (mrServiceMode()) { U.toast('Chợ đang thu điện, nước chia đều như dịch vụ — không ghi chỉ số'); A.closeModal(); A.render(); return; } return fn.apply(this, arguments); };
    ['dn-save-draft', 'dn-close-period', 'dn-close-confirm', 'dn-adjust-req', 'dn-adjust-send', 'mr-save', 'mr-open', 'mr-point-open', 'mr-evidence-add'].forEach(k => { if (A.ACT[k]) A.ACT[k] = block(A.ACT[k]); });
    ['dn-photo-add'].forEach(k => { if (A.CH[k]) A.CH[k] = block(A.CH[k]); });
  })();
})(window.APP);

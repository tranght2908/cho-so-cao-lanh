/* Business-point quick panels (Phase 15.15, from js/v-dieuhanh.js): A.stallPanel (non-CL point detail),
 * the CL quick drawer opened from the layout diagram, and the point status change (stall-status).
 * Không hiển thị "Nợ phí"/công nợ ở đây: không phải trạng thái điểm KD; khoản chưa thu chỉ xem/thu tại
 * module Thu phí/Khoản phải thu. */
(function (A) {
  'use strict';
  const D = A.D, U = A.U, ui = A.ui;
  A.stallPanel = function (st) {
    const t = st.traderId ? A.idx.trader.get(st.traderId) : null;
    const c = st.contractId ? A.idx.contract.get(st.contractId) : null;
    const loc = A.features.businessPoints.service.location(st);
    const canXemHoSo = A.canDo('so-do.xem-ho-so', st.market);
    const canTaoHopDong = A.canDo('so-do.tao-hop-dong', st.market) || A.canDo('hop-dong.tao', st.market);
    const canDoiTrangThai = A.canDo('so-do.doi-trang-thai', st.market);
    const left = c ? U.days(U.today(), c.end) : null;
    return `<div class="row"><h3>${st.code}</h3>${A.mbStatusTag(A.pointDisplayStatus(st))}</div>
      <div class="muted small" style="margin:2px 0 12px">${U.esc(loc.label)} · ${U.mShort(st.market)}</div>
      <dl class="kv"><dt>Ngành hàng</dt><dd>${U.esc(st.cat)}</dd><dt>Loại quầy</dt><dd>${U.rentalLabel(st)}</dd><dt>Loại diện tích</dt><dd>${U.esc(U.areaTypeLabel(st.areaTypeId) || '—')}</dd>
        <dt>Diện tích</dt><dd>${st.area.toLocaleString('vi-VN')} m²</dd><dt>Đơn giá</dt><dd>${U.unitLabel(st)}</dd>
        ${c && c.monthly ? `<dt>Giá dịch vụ/tháng</dt><dd>${U.money(c.monthly)}</dd>` : ''}</dl>
      <div class="divider"></div>
      ${t ? `<dl class="kv"><dt>Tiểu thương</dt><dd><a href="#" data-act="trader" data-id="${t.id}">${U.esc(t.name)}</a> (${t.id})</dd>
        <dt>Điện thoại</dt><dd>${U.maskPhone(t.phone)}</dd><dt>Mini app</dt><dd>${t.app ? '<span class="tag ok">Đã cài</span>' : '<span class="tag">Chưa cài</span>'}</dd>
        ${c ? `<dt>Hợp đồng</dt><dd>${c.id}<br><span class="small muted">${U.dmy(c.start)} – ${U.dmy(c.end)} · ${left < 0 ? '<b style="color:#df2225">Đã hết hạn</b>' : left <= 30 ? `<b style="color:#df2225">còn ${left} ngày</b>` : 'còn ' + left + ' ngày'}</span></dd>` : ''}</dl>`
        : '<div class="note info">Điểm kinh doanh đang trống, có thể cho thuê.</div>'}
      ${(canXemHoSo || canTaoHopDong || canDoiTrangThai) ? `<div class="row" style="margin-top:14px">
        ${t ? (canXemHoSo ? `<button class="btn" data-act="trader" data-id="${t.id}">Hồ sơ</button>` : '') : (canTaoHopDong ? `<button class="btn primary" data-act="ct-new" data-point="${st.id}">Tạo hợp đồng</button>` : '')}
        ${canDoiTrangThai ? `<button class="btn" data-act="stall-status" data-id="${st.id}">Đổi trạng thái</button>` : ''}</div>` : ''}
      ${st.history && st.history.length ? `<div class="divider"></div><div class="small"><b>Lịch sử thay đổi</b>${st.history.map(h => `<div class="muted">${h}</div>`).join('')}</div>` : ''}`;
  };

  // ---- Mặt bằng chợ — Chợ Cao Lãnh: drawer "xem nhanh" khi click 1 điểm trên sơ đồ (KHÁC
  // A.stallPanel ở trên — A.stallPanel GIỮ NGUYÊN, vẫn dùng cho Mặt bằng chợ quê TTĐ + màn "Điểm
  // kinh doanh" TTD, không đổi gì ở đó). Theo yêu cầu BUSINESS_POINT_MAP_DRAWER_REFACTOR: chỉ XEM
  // NHANH (4 nhóm A/B/C/D), KHÔNG có nút "Đổi trạng thái"/"Thu tiền"/"Tạo hợp đồng", KHÔNG mở modal
  // hồ sơ lớn tại chỗ — thay bằng 2 nút điều hướng dùng lại router/state hiện có (A.go + A.ACT có
  // sẵn của chính 2 màn đích), không tạo màn/modal chi tiết thứ hai.
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
    const left = c ? U.days(U.today(), c.end) : null;
    const sec = (label, body) => `<div class="row"><b style="font-size:var(--font-size-sm)">${label}</b></div><div style="margin:6px 0 14px">${body}</div>`;
    const actions = [];
    if (t && canXemHoSo) actions.push(`<button class="btn" data-act="mb-open-trader" data-id="${t.id}">Xem hồ sơ tiểu thương</button>`);
    if (canXemDiemKD) actions.push(`<button class="btn" data-act="mb-open-diemkd" data-id="${st.id}">Xem điểm kinh doanh</button>`);
    return `<div class="muted small" style="margin:2px 0 12px">${U.esc(A.features.businessPoints.service.location(st).label)} · ${U.esc(U.market(st.market).name)}</div>
      ${sec('A. Thông tin điểm', `<dl class="kv">
        <dt>Loại diện tích</dt><dd>${U.esc(U.areaTypeLabel(st.areaTypeId) || '—')}</dd>
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
        <dt>Thời hạn</dt><dd>${U.dmy(c.start)} – ${U.dmy(c.end)}<br><span class="small muted">${left < 0 ? '<b style="color:#df2225">Đã hết hạn</b>' : left <= 30 ? `<b style="color:#df2225">còn ${left} ngày</b>` : 'còn ' + left + ' ngày'}</span></dd>
        <dt>Trạng thái</dt><dd>${(d => `<span class="tag ${d.tone}">${d.label}</span>`)(A.features.contracts.service.DISPLAY_STATUS[A.features.contracts.service.displayStatus(c)])}</dd></dl>`
        : '<div class="note info">Chưa có hợp đồng hiệu lực.</div>')}
      <div class="divider"></div>
      ${actions.length ? `<div class="row" style="gap:8px;flex-wrap:wrap">${actions.join('')}</div>` : ''}`;
  }

  // A.VIEWS['mat-bang'] giờ định nghĩa ở js/v-cautruc.js (mbWorkspaceHtml) — nơi giữ cây cấu trúc +
  // model LAYOUT. File này chỉ còn giữ đúng phần thao tác điểm kinh doanh thật (drawer khi click 1
  // điểm trên sơ đồ) dùng chung cho cả route 'mat-bang' lẫn màn "Điểm kinh doanh" (screen:diem-kd,
  // độc lập, không đổi).
  // Vẽ drawer "xem nhanh" 1 điểm trên sơ đồ Mặt bằng chợ — tách thành hàm THUẦN (không tự
  // push/reset navigation stack) để dùng lại được cả khi mở làm drawer GỐC (action `stall`) LẪN khi
  // dùng làm "cách vẽ lại drawer nguồn" cho nút "← Quay lại" (A.drawerPush, xem core.js).
  function mbOpenStallDrawer(st) {
    if (st && A.openDkDrawer) A.openDkDrawer(st);
  }
  Object.assign(A.ACT, {
    'stall-status': el => {
      const st = A.mbBusinessPointById(ui.market, el.dataset.id);
      if (!st) { U.toast('Không tìm thấy điểm kinh doanh trong chợ hiện tại'); return; }
      if (!A.canDo('so-do.doi-trang-thai', st.market)) return;
      // Chỉ đổi trạng thái VẬN HÀNH; Đang thuê/Còn trống theo hợp đồng. Không có "Nợ phí" (không phải trạng thái điểm).
      const opts = Object.keys(D.POINT_STATUS);
      A.modal(A.mHead('Đổi trạng thái vận hành điểm ' + st.code) + `<div class="modal-b"><div class="form-grid">
        <div class="field"><label>Trạng thái vận hành</label><select class="input" id="ss-status">${opts.map(k => `<option value="${k}" ${(st.operationalStatus || st.status) === k ? 'selected' : ''}>${A.pointOpLabel(k)}</option>`).join('')}</select></div>
        <div class="field"><label>Lý do</label><input class="input" id="ss-reason" placeholder="VD: tiểu thương xin tạm nghỉ 1 tháng"></div></div>
        <div class="small muted" style="margin-top:10px">Tình trạng sử dụng (Đang thuê/Còn trống) do hợp đồng quyết định.</div></div>
        <div class="modal-f"><button class="btn" data-act="close">Hủy</button><button class="btn primary" data-act="stall-status-save" data-id="${st.id}">Lưu</button></div>`);
    },
    'stall-status-save': el => {
      const st = A.mbBusinessPointById(ui.market, el.dataset.id);
      if (!st) { U.toast('Không tìm thấy điểm kinh doanh trong chợ hiện tại'); return; }
      if (!A.canDo('so-do.doi-trang-thai', st.market)) return;
      const ns = A.$('#ss-status').value, reason = A.$('#ss-reason').value.trim();
      if (!D.POINT_STATUS[ns]) return;
      st.history = st.history || [];
      st.history.unshift(`${U.dmy(U.today())}: ${A.pointOpLabel(st.operationalStatus || st.status)} → ${A.pointOpLabel(ns)}${reason ? ' (' + reason + ')' : ''}`);
      st.operationalStatus = ns; st.status = ns;
      U.log(`Đổi trạng thái vận hành điểm ${st.code} sang ${A.pointOpLabel(st.status)}`);
      A.save(); A.closeModal(); A.render(); U.toast('Đã cập nhật trạng thái ' + st.code);
    }
  });
  A.features.businessPoints.openStallDrawer = mbOpenStallDrawer;
})(window.APP);

/* Business-point quick panels (Phase 15.15, from js/v-dieuhanh.js): A.stallPanel (non-CL point detail),
 * the CL quick drawer opened from the layout diagram, and the point status change (stall-status). */
(function (A) {
  'use strict';
  const D = A.D, U = A.U, ui = A.ui;
  A.stallPanel = function (st) {
    const t = st.traderId ? A.idx.trader.get(st.traderId) : null;
    const c = st.contractId ? A.idx.contract.get(st.contractId) : null;
    const unpaid = A.db.invoices.filter(i => U.invStallIds(i).indexOf(st.id) !== -1 && i.status !== 'paid');
    const canThuTien = A.canCollectReceivable(st.market);
    const canXemHoSo = A.canDo('so-do.xem-ho-so', st.market);
    const canTaoHopDong = A.canDo('so-do.tao-hop-dong', st.market) || A.canDo('hop-dong.tao', st.market);
    const canDoiTrangThai = A.canDo('so-do.doi-trang-thai', st.market);
    const left = c ? U.days(U.today(), c.end) : null;
    return `<div class="row"><h3>${st.code}</h3>${U.statusTag(st.status)}</div>
      <div class="muted small" style="margin:2px 0 12px">${U.esc(st.sectionName)} · ${U.market(st.market).floors.find(f => f.id === st.floor).name} · ${U.mShort(st.market)}</div>
      <dl class="kv"><dt>Ngành hàng</dt><dd>${U.esc(st.cat)}</dd><dt>Loại quầy</dt><dd>${U.rentalLabel(st)}</dd><dt>Loại mặt bằng</dt><dd>${U.typeLabel(st.type)}</dd>
        <dt>Diện tích</dt><dd>${st.area.toLocaleString('vi-VN')} m²</dd><dt>Đơn giá</dt><dd>${U.unitLabel(st)}</dd>
        ${c && c.monthly ? `<dt>Giá dịch vụ/tháng</dt><dd>${U.money(c.monthly)}</dd>` : ''}</dl>
      <div class="divider"></div>
      ${t ? `<dl class="kv"><dt>Tiểu thương</dt><dd><a href="#" data-act="trader" data-id="${t.id}">${U.esc(t.name)}</a> (${t.id})</dd>
        <dt>Điện thoại</dt><dd>${U.maskPhone(t.phone)}</dd><dt>Mini app</dt><dd>${t.app ? '<span class="tag ok">Đã cài</span>' : '<span class="tag">Chưa cài</span>'}</dd>
        ${c ? `<dt>Hợp đồng</dt><dd>${c.id}<br><span class="small muted">${U.dmy(c.start)} – ${U.dmy(c.end)} · ${left <= 30 ? `<b style="color:#df2225">còn ${left} ngày</b>` : 'còn ' + left + ' ngày'}</span></dd>` : ''}
        <dt>Công nợ</dt><dd>${unpaid.length ? `<b style="color:#df2225">${U.money(U.sum(unpaid, U.due))}</b> <span class="small muted">(${unpaid.length} kỳ)</span>` : '<span class="tag ok">Không nợ</span>'}</dd></dl>`
        : '<div class="note info">Điểm kinh doanh đang trống, có thể cho thuê.</div>'}
      ${(canThuTien || canXemHoSo || canTaoHopDong || canDoiTrangThai) ? `<div class="row" style="margin-top:14px">
        ${canThuTien && t && unpaid.length ? `<button class="btn primary" data-act="pay-open" data-id="${t.id}">${U.icon('card')}Thu tiền</button>` : ''}
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
    const unpaid = t ? A.db.invoices.filter(i => U.invStallIds(i).indexOf(st.id) !== -1 && i.status !== 'paid') : [];
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
        <dt>Thời hạn</dt><dd>${U.dmy(c.start)} – ${U.dmy(c.end)}<br><span class="small muted">${left <= 30 ? `<b style="color:#df2225">còn ${left} ngày</b>` : 'còn ' + left + ' ngày'}</span></dd>
        <dt>Trạng thái</dt><dd>${c.status === 'hieuluc' ? '<span class="tag ok">Đang hiệu lực</span>' : '<span class="tag">Đã thanh lý</span>'}</dd></dl>`
        : '<div class="note info">Chưa có hợp đồng hiệu lực.</div>')}
      <div class="divider"></div>
      ${sec('D. Công nợ', !t ? '<span class="tag">Không có nghĩa vụ hiện tại</span>'
        : owe ? `<span class="tag danger">Nợ phí</span> <b style="color:#df2225;margin-left:6px">${U.money(owe)}</b>`
        : '<span class="tag ok">Không nợ</span>')}
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
    if (st && st.market === 'CL') {
      A.openDkDrawer(st);
      return;
    }
    ui.sel = st.id;
    A.$('#modal-root').innerHTML = `<div class="drawer-overlay" data-act="close"></div><div class="drawer">${A.drawerBackHtml()}
        <div class="drawer-h"><div><h3>${st.code}</h3><div class="small muted" style="margin-top:2px">${U.statusTag(st.status)}</div></div><span class="spacer"></span><button class="x" data-act="close" aria-label="Đóng">×</button></div>
        <div class="drawer-b">${st.market === 'CL' ? mbStallPanelCL(st) : A.stallPanel(st)}</div></div>`;
    A.render();
  }
  Object.assign(A.ACT, {
    'stall-status': el => {
      const st = A.mbBusinessPointById(ui.market, el.dataset.id);
      if (!st) { U.toast('Không tìm thấy điểm kinh doanh trong chợ hiện tại'); return; }
      if (!A.canDo('so-do.doi-trang-thai', st.market)) return;
      const opts = ['thue', 'ngung', 'tranhchap'].concat(st.traderId ? [] : ['trong']);
      A.modal(A.mHead('Đổi trạng thái điểm ' + st.code) + `<div class="modal-b"><div class="form-grid">
        <div class="field"><label>Trạng thái mới</label><select class="input" id="ss-status">${opts.map(k => `<option value="${k}" ${st.status === k ? 'selected' : ''}>${D.STATUS[k].label}</option>`).join('')}</select></div>
        <div class="field"><label>Lý do</label><input class="input" id="ss-reason" placeholder="VD: tiểu thương xin tạm nghỉ 1 tháng"></div></div>
        <div class="small muted" style="margin-top:10px">Trạng thái "Nợ phí" do hệ thống tự xác định theo công nợ quá hạn.</div></div>
        <div class="modal-f"><button class="btn" data-act="close">Hủy</button><button class="btn primary" data-act="stall-status-save" data-id="${st.id}">Lưu</button></div>`);
    },
    'stall-status-save': el => {
      const st = A.mbBusinessPointById(ui.market, el.dataset.id);
      if (!st) { U.toast('Không tìm thấy điểm kinh doanh trong chợ hiện tại'); return; }
      if (!A.canDo('so-do.doi-trang-thai', st.market)) return;
      const ns = A.$('#ss-status').value, reason = A.$('#ss-reason').value.trim();
      st.history = st.history || [];
      st.history.unshift(`${U.dmy(U.today())}: ${D.STATUS[st.status].label} → ${D.STATUS[ns].label}${reason ? ' (' + reason + ')' : ''}`);
      st.status = ns; A.refreshStall(st);
      U.log(`Đổi trạng thái điểm ${st.code} sang ${D.STATUS[st.status].label}`);
      A.save(); A.closeModal(); A.render(); U.toast('Đã cập nhật trạng thái ' + st.code);
    }
  });
  A.features.businessPoints.openStallDrawer = mbOpenStallDrawer;
})(window.APP);

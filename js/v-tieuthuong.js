/* Màn hình: Điểm kinh doanh, Tiểu thương, Hợp đồng. */
(function (A) {
  'use strict';
  const D = A.D, U = A.U, ui = A.ui;
  const f = ui.f;
  // MAT_BANG_KHU_TANG_DAY_REDESIGN: ui.dkTab (cũ — 'list'/'requests') đã bỏ, thay bằng ui.mb.view
  // ('grid'/'table', xem js/v-cautruc.js) dùng chung cho cả workspace Mặt bằng & điểm kinh doanh.

  // ---------- Điểm kinh doanh ----------
  // MAT_BANG_KHU_TANG_DAY_REDESIGN: "Danh mục điểm kinh doanh" (bảng CL) nay là CHẾ ĐỘ "Bảng" của
  // CÙNG workspace Mặt bằng & điểm kinh doanh — dataset LUÔN lấy qua A.mbCurrentPoints('CL')
  // (js/v-cautruc.js: phạm vi cây Khu/Tầng/Dãy đang chọn + bộ lọc DÙNG CHUNG search/trạng thái/ngành
  // hàng/loại diện tích với chế độ Sơ đồ), KHÔNG còn state filter riêng (mục 11 yêu cầu redesign:
  // "không tạo dataset riêng cho UI mới"). MAT_BANG_LOAI_DIEN_TICH: "Loại điểm kinh doanh" (pointType/
  // D.POINT_TYPE — Ki-ốt/Quầy/Sạp/Cửa hàng) KHÔNG được tài liệu nghiệp vụ xác nhận nên KHÔNG còn dùng
  // trong bảng/filter màn này — thay bằng "Loại diện tích" (st.areaType, dùng chung ui.mb.filter.areaType,
  // xem js/v-cautruc.js A.mbMatchesFilter). pointType/D.POINT_TYPE vẫn GIỮ NGUYÊN cho nghiệp vụ tách/
  // gộp/chuyển đổi điểm (dkPointTypeLabel bên dưới) — KHÔNG xóa field toàn cục, chỉ bỏ khỏi UI bảng.
  function dkSeller(s) {
    const assignment = (A.db.directSellerAssignments || []).find(x => x.pointId === s.id && x.status === 'ACTIVE');
    if (assignment) return assignment.traderId ? A.idx.trader.get(assignment.traderId) : { id: assignment.personId || '', name: assignment.fullName, phone: assignment.phone, idNo: assignment.idNumber };
    if (s.sellerId) return A.idx.trader.get(s.sellerId);
    return s.traderId ? A.idx.trader.get(s.traderId) : null;
  }
  function dkPointTypeLabel(s) {
    return s.pointType && D.POINT_TYPE[s.pointType] ? D.POINT_TYPE[s.pointType].label : 'Chưa có thông tin';
  }
  // "NV thu phí phụ trách" (PHAN_CONG_NHAN_VIEN_THU_PHI) — đọc TRỰC TIẾP s.collectorId (data.js,
  // gán theo dãy qua popup "Sửa dãy" ở js/v-cautruc.js: A.CH['qh-zone-collector']) — THAM CHIẾU
  // account.id, REUSE A.ACCOUNTS, KHÔNG tạo field/nguồn dữ liệu trùng nghĩa.
  function dkCollectorLabel(s) {
    if (!s.collectorId) return 'Chưa phân công';
    const acc = A.ACCOUNTS.get(s.collectorId);
    return acc ? acc.fullName : 'Chưa phân công';
  }
  function dkclHasFilter() {
    const flt = ui.mb.filter;
    return !!(flt.areaType || flt.search || flt.status || flt.cat);
  }
  // Dataset DUY NHẤT — CHÍNH XÁC cùng nguồn A.mbCurrentPoints('CL') mà chế độ Sơ đồ đang dùng để tô
  // màu/mờ ô (mục 3/11 yêu cầu redesign) — bộ lọc "Loại diện tích" nay áp dụng NGAY trong
  // A.mbMatchesFilter (ui.mb.filter.areaType, js/v-cautruc.js) nên không cần lọc thêm ở đây nữa.
  function dkRowsCL() {
    return A.mbCurrentPoints('CL');
  }
  function dkRowHtmlCL(s, pos) {
    const t = s.traderId ? A.idx.trader.get(s.traderId) : null;
    const seller = dkSeller(s);
    const path = A.mbLayoutPathForPoint('CL', s);
    const collectorLabel = dkCollectorLabel(s);
    return `<tr class="click" data-act="dk-open" data-id="${s.id}">
      <td class="mb-col-code"><b>${s.code}</b></td>
      ${pos.zone ? `<td class="mb-col-zone">${U.esc(path.khu)}</td>` : ''}
      ${pos.floor ? `<td class="mb-col-floor">${U.esc(path.tang)}</td>` : ''}
      ${pos.row ? `<td class="mb-col-row" title="${U.esc(s.sectionName)}">${U.esc(path.day)}</td>` : ''}
      <td class="num mb-col-area">${s.area.toLocaleString('vi-VN')}</td>
      <td class="mb-col-area-type">${U.esc(U.areaTypeLabel(s.areaType) || 'Chưa có thông tin')}</td>
      <td class="mb-col-category" title="${U.esc(s.cat)}">${U.esc(s.cat)}</td>
      <td class="mb-col-trader" title="${t ? U.esc(t.name) : ''}">${t ? U.esc(t.name) : '<span class="muted">–</span>'}</td>
      <td class="mb-col-seller" title="${seller ? U.esc(seller.name) : ''}">${seller ? U.esc(seller.name) : '<span class="muted">–</span>'}</td>
      <td class="small mb-col-collector">${U.esc(collectorLabel)}</td>
      <td class="mb-col-status">${U.statusTag(s.status)}</td>
      <td class="nowrap mb-col-actions"><button class="btn sm" data-act="dk-open" data-id="${s.id}">Xem</button></td>
    </tr>`;
  }
  // Bảng — CHẾ ĐỘ "Bảng" của workspace dùng chung (gọi từ A.dkTableHtml, xem A.VIEWS['mat-bang']/
  // js/v-cautruc.js mbRightHtml). MAT_BANG_TABLE_TOOLBAR_UNIFY (mục 1/2 yêu cầu): search/ngành hàng
  // (trước ở card header dùng chung, đã bỏ — xem mbWorkspaceHtml js/v-cautruc.js) nay gộp vào ĐÚNG 1
  // toolbar này cùng "Loại diện tích"/"Xóa bộ lọc"/"Xuất Excel" — tái dùng NGUYÊN
  // data-in="mb-filter-search"/data-ch="mb-filter-cat"/"mb-filter-area-type" (dùng chung với
  // js/v-cautruc.js, không tạo control/state mới).
  function dkViewCL() {
    const rows = dkRowsCL(), pg = U.pager('dkcl', rows.length, 25), flt = ui.mb.filter, cats = A.mbCatOptions('CL'), pos = A.mbPositionColumnVisibility();
    return `<div class="card mb-table-card"><div class="card-h" style="flex-wrap:wrap">
      <input class="input" data-in="mb-filter-search" placeholder="Tìm mã điểm / tiểu thương" value="${U.esc(flt.search)}">
      <select class="input" data-ch="mb-filter-area-type"><option value="">Loại diện tích: Tất cả</option>${U.AREA_TYPE_CODES.map(k => `<option value="${k}" ${flt.areaType === k ? 'selected' : ''}>${U.areaTypeLabel(k)}</option>`).join('')}</select>
      <select class="input" data-ch="mb-filter-cat"><option value="">Ngành hàng: Tất cả</option>${cats.map(cName => `<option value="${U.esc(cName)}" ${flt.cat === cName ? 'selected' : ''}>${U.esc(cName)}</option>`).join('')}</select>
      <button class="btn" data-act="dkcl-clear" ${dkclHasFilter() ? '' : 'disabled'}>↺ Xóa bộ lọc</button>
      <span class="spacer"></span>
      <button class="btn" data-act="dkcl-csv">⬇ Xuất Excel</button></div>
      <div class="card-b">${U.table([{ t: '<span class="mb-col-code">Mã điểm</span>' }, pos.zone && { t: '<span class="mb-col-zone">Khu</span>' }, pos.floor && { t: '<span class="mb-col-floor">Tầng</span>' }, pos.row && { t: '<span class="mb-col-row">Dãy</span>' }, { t: '<span class="mb-col-area">Diện tích (m²)</span>', num: true }, { t: '<span class="mb-col-area-type">Loại diện tích</span>' }, { t: '<span class="mb-col-category">Ngành hàng</span>' }, { t: '<span class="mb-col-trader">Tiểu thương</span>' }, { t: '<span class="mb-col-seller">Người bán thực tế</span>' }, { t: '<span class="mb-col-collector">NV thu phí</span>' }, { t: '<span class="mb-col-status">Trạng thái</span>' }, { t: '<span class="mb-col-actions">Thao tác</span>' }].filter(Boolean),
        rows.slice(pg.start, pg.end).map(s => dkRowHtmlCL(s, pos)), { empty: 'Không có điểm kinh doanh phù hợp bộ lọc.' })}${pg.html}</div></div>`;
  }
  A.dkTableHtml = mid => mid === 'CL' ? dkViewCL() : null;
  // "Xóa bộ lọc" của bảng: reset TOÀN BỘ bộ lọc dùng chung (search/trạng thái/ngành hàng/loại diện
  // tích) — KHÔNG đụng ui.mb.sel (phạm vi cây đang chọn, mục 7 yêu cầu: giữ selection).
  A.ACT['dkcl-clear'] = () => {
    ui.mb.filter = { search: '', status: '', cat: '', areaType: '' };
    ui.page.dkcl = 0;
    A.render();
  };
  A.ACT['dkcl-csv'] = () => U.csv('diem-kinh-doanh-cho-cao-lanh', ['Mã điểm', 'Khu', 'Tầng', 'Dãy', 'Diện tích m2', 'Loại diện tích', 'Ngành hàng', 'Người thuê', 'Người bán thực tế', 'NV thu phí', 'Trạng thái'],
    dkRowsCL().map(s => {
      const t = s.traderId ? A.idx.trader.get(s.traderId) : null, seller = dkSeller(s), path = A.mbLayoutPathForPoint('CL', s);
      return [s.code, path.khu, path.tang, path.day, s.area, U.areaTypeLabel(s.areaType) || '', s.cat, t ? t.name : '', seller ? seller.name : '', dkCollectorLabel(s), D.STATUS[s.status].label];
    }));
  // Drawer chi tiết CL — bố cục theo BUSINESS_POINT_CL_DETAIL_DRAWER_REFACTOR (xem
  // BUSINESS_POINT_CL_DETAIL_DRAWER_REFACTOR_REPORT.md): action đặt NGAY tại khối thông tin mà nó
  // tác động, KHÔNG gom xuống footer — không còn `drawer-f`. Người thuê ≠ Người bán thực tế tiếp tục
  // tái dùng ĐÚNG dkSeller()/pointType/sellerId đã có (mục 11 yêu cầu — không đổi model).
  //   - "Chỉnh sửa thông tin"/"Gộp điểm"/"Chuyển đổi điểm": 3 action tái dùng NGUYÊN action
  //     permission 'cau-truc.edit' đã có (cùng phạm vi "sửa cấu trúc/đặc tính mặt bằng" mà
  //     v-cautruc.js đang dùng cho khối/tầng/khu/loại điểm quy hoạch), KHÔNG tạo permission key mới.
  //     "Gộp điểm" CHỈ ghi 1 dòng lịch sử minh hoạ (không gộp thật A.db.stalls — tránh phá quan hệ
  //     trader/contract/invoice đang khoá theo stallId) — xem NEED_CONFIRMATION trong report cũ.
  //     "Chỉnh sửa thông tin" (ngành hàng/diện tích) và "Chuyển đổi điểm" (pointType — field THUẦN
  //     HIỂN THỊ, không ảnh hưởng tính giá) là mutation THẬT vì an toàn/độc lập với các module khác.
  //   - "Tách điểm": KHÔNG còn là action trực tiếp trong drawer này (BUSINESS_POINT_SPLIT_WORKFLOW —
  //     xem BUSINESS_POINT_SPLIT_WORKFLOW_IMPLEMENTATION_REPORT.md). Đây là 1 NGHIỆP VỤ CÓ QUY
  //     TRÌNH phê duyệt nhiều bước (lập yêu cầu → BQL hoàn thiện phương án → Trưởng BQL phê duyệt →
  //     thực hiện), không phải thao tác chỉnh sửa trực tiếp 1 điểm — xem tab "Yêu cầu thay đổi" ở
  //     A.VIEWS['diem-kd']/dkScreenCL() bên dưới, dùng 5 permKey action:diem-kd.tach-diem.*
  //     (permissions.js) thay vì 'cau-truc.edit'.
  //   - "Xem hồ sơ tiểu thương": ĐỔI TÊN từ "Hồ sơ", tái dùng NGUYÊN action permission
  //     'so-do.xem-ho-so' + handler `trader` có sẵn (mở modal hồ sơ tại chỗ, không tạo màn mới).
  //   - BỎ hẳn "Đổi trạng thái"/"Tạo hợp đồng" khỏi drawer này (mục 8 yêu cầu — không tạo UI cho
  //     phép tự chọn trạng thái tuỳ ý, đặc biệt "Nợ phí"; xem NEED_CONFIRMATION về Tạo hợp đồng).
  // id điểm đang ở EDIT MODE trong drawer CL (null = VIEW MODE, mặc định) — cùng pattern module-
  // level state đã dùng cho ttEditId (drawer Tiểu thương CL) bên dưới: chỉ 1 drawer CL mở tại 1
  // thời điểm nên 1 biến là đủ, không cần lưu theo từng điểm.
  let dkEditId = null;
  let dkDirectSellerPointId = null;
  let dkDirectSellerDraft = null;
  // UI-only state: không lưu localStorage; mỗi lần mở điểm mới luôn quay về Tổng quan.
  let dkDetailActiveTab = 'overview';
  const dkDirectSellerStatusLabel = { PENDING_VERIFICATION: 'Chờ xác minh', ACTIVE: 'Đã xác minh', ENDED: 'Đã kết thúc' };
  function dkDirectSellerList(st) { return (A.db.directSellerAssignments || []).filter(x => x.pointId === st.id).sort((a, b) => String(b.startDate).localeCompare(String(a.startDate))); }
  function dkDirectSellerActive(st) { return dkDirectSellerList(st).find(x => x.status === 'ACTIVE') || null; }
  function dkDirectSellerSectionHtml(st, canEdit) {
    const active = dkDirectSellerActive(st), history = dkDirectSellerList(st);
    const person = active && (active.traderId ? A.idx.trader.get(active.traderId) : null);
    const activeHtml = active ? `<dl class="kv"><dt>Người trực tiếp kinh doanh</dt><dd>${U.esc(active.fullName)}</dd>${active.idNumber?`<dt>CCCD/định danh</dt><dd>${U.esc(active.idNumber)}</dd>`:''}${active.phone?`<dt>SĐT</dt><dd>${U.esc(active.phone)}</dd>`:''}<dt>Quan hệ</dt><dd>${U.esc(active.relationship || 'Chưa ghi nhận')}</dd><dt>Từ ngày</dt><dd>${U.dmy(active.startDate)}</dd><dt>Trạng thái</dt><dd><span class="tag ok">Đã xác minh</span></dd></dl>
      <div class="row" style="gap:8px;flex-wrap:wrap;margin-top:8px">${person ? `<button class="btn sm" data-act="dkcl-open-trader" data-id="${person.id}" data-stall="${st.id}">Xem hồ sơ</button>` : ''}${canEdit ? `<button class="btn sm" data-act="dkds-open" data-id="${st.id}">Thay đổi người trực tiếp KD</button>` : ''}</div>`
      : `<div class="note">${U.icon('warning')}Chưa đăng ký${canEdit ? `<br><button class="btn sm" style="margin-top:8px" data-act="dkds-open" data-id="${st.id}">+ Bổ sung thông tin</button>` : ''}</div>`;
    const historyHtml = history.length ? history.map(a => `<div style="padding:6px 0;border-bottom:1px solid #eef2f7"><b>${U.esc(a.fullName)}</b> <span class="tag ${a.status === 'ACTIVE' ? 'ok' : a.status === 'PENDING_VERIFICATION' ? 'warn' : ''}">${dkDirectSellerStatusLabel[a.status] || a.status}</span><div class="small muted">${U.dmy(a.startDate)} → ${a.endDate ? U.dmy(a.endDate) : 'hiện tại'}</div></div>`).join('') : '<div class="small muted">Chưa có lịch sử.</div>';
    const pending = history.filter(a => a.status === 'PENDING_VERIFICATION');
    return `${activeHtml}
      ${pending.length && canEdit ? `<div class="note info" style="margin-top:10px">Có ${pending.length} đăng ký chờ xác minh. ${pending.map(a => `<button class="btn sm" data-act="dkds-verify-open" data-id="${a.id}">Xác minh ${U.esc(a.fullName)}</button>`).join(' ')}</div>` : ''}
      <div class="small muted" style="margin:12px 0 6px">Lịch sử người trực tiếp kinh doanh</div>${historyHtml}`;
  }
  function dkDirectSellerFormHtml(st) {
    const d = dkDirectSellerDraft;
    const owner = st.traderId ? A.idx.trader.get(st.traderId) : null;
    return `<div class="drawer-h detail-form-head"><div><h3>${st.code}</h3><div class="small muted">Bổ sung / thay đổi người trực tiếp kinh doanh</div></div><span class="spacer"></span><button class="x" data-act="dkds-cancel" data-id="${st.id}">×</button></div><div class="detail-form-tabs">${U.icon('users')} Người trực tiếp kinh doanh</div><div class="drawer-b detail-form-body"><section class="detail-form-card">
      <div class="field"><label><input type="radio" name="dkds-kind" data-ch="dkds-kind" value="owner" ${d.kind === 'owner' ? 'checked' : ''}> Chính tiểu thương/chủ thể hiện tại trực tiếp kinh doanh</label></div>
      <div class="field"><label><input type="radio" name="dkds-kind" data-ch="dkds-kind" value="other" ${d.kind === 'other' ? 'checked' : ''}> Người khác trực tiếp kinh doanh</label></div>
      ${d.kind === 'owner' ? `<div class="note">${owner ? `${U.esc(owner.name)} · ${U.maskPhone(owner.phone)}` : 'Điểm chưa có chủ thể hợp đồng; hãy nhập người khác.'}</div>` : `<div class="field"><label>Họ tên *</label><input class="input" data-in="dkds-name" value="${U.esc(d.fullName)}"></div><div class="field" style="margin-top:8px"><label>CCCD/định danh</label><input class="input" data-in="dkds-idno" value="${U.esc(d.idNumber)}"></div><div class="field" style="margin-top:8px"><label>SĐT</label><input class="input" data-in="dkds-phone" value="${U.esc(d.phone)}"></div><div class="field" style="margin-top:8px"><label>Quan hệ với chủ thể</label><input class="input" data-in="dkds-relationship" value="${U.esc(d.relationship)}"></div>`}
      <div class="field" style="margin-top:8px"><label>Ngày bắt đầu *</label><input class="input" type="date" data-in="dkds-start" value="${U.esc(d.startDate)}"></div><div class="field" style="margin-top:8px"><label>Ghi chú</label><textarea class="input" rows="2" data-in="dkds-note">${U.esc(d.note)}</textarea></div><div class="small muted">Tệp minh họa chỉ là metadata mock, không upload tệp thật.</div></section></div><div class="drawer-f detail-form-footer"><button class="btn" data-act="dkds-cancel" data-id="${st.id}">Hủy</button><button class="btn primary" data-act="dkds-save" data-id="${st.id}">Lưu đăng ký chờ xác minh</button></div>`;
  }
  function dkHistoryHtml(st) {
    if (!st.history || !st.history.length) return '<div class="small muted">Chưa có lịch sử thay đổi.</div>';
    return st.history.map(h => {
      const i = h.indexOf(': ');
      const date = i === -1 ? '' : h.slice(0, i), desc = i === -1 ? h : h.slice(i + 2);
      return `<div style="padding:6px 0;border-bottom:1px solid #eef2f7">${date ? `<div class="small muted">${U.esc(date)}</div>` : ''}<div>${U.esc(desc)}</div></div>`;
    }).join('');
  }
  function dkDetailTabsHtml(active) {
    const tabs = [['overview','store','Tổng quan'],['contract','file','Hợp đồng'],['directSeller','users','Người trực tiếp kinh doanh'],['history','refresh','Lịch sử thay đổi']];
    return `<div class="dk-popup-tabs" role="tablist">${tabs.map(x => `<button role="tab" aria-selected="${active === x[0]}" class="${active === x[0] ? 'on' : ''}" data-act="dkdetail-tab" data-id="${x[0]}">${x[2]}</button>`).join('')}</div>`;
  }
  function dkPopupShell(st, m, active, content) {
    const canEdit=A.canDo('cau-truc.edit',st.market);
    return `<div class="drawer-h dk-popup-head"><div><div class="row" style="gap:10px"><h3>${st.code}</h3>${U.statusTag(st.status)}</div><div class="small muted dk-popup-meta">${U.esc(dkPointTypeLabel(st))} · ${U.esc((m.floors.find(fl=>fl.id===st.floor)||{}).name||'')} · ${U.esc(m.name)}</div></div><span class="spacer"></span>${canEdit?`<button class="btn sm" data-act="dkcl-edit-open" data-id="${st.id}">Chỉnh sửa thông tin</button>`:''}<button class="x" data-act="close" aria-label="Đóng">×</button></div>${dkDetailTabsHtml(active)}<div class="drawer-b dk-detail-body dk-tab-content">${content}</div><div class="drawer-f dk-popup-footer"><button class="btn" data-act="close">Đóng</button></div>`;
  }
  function dkDirectSellerSummaryHtml(st) {
    const a=dkDirectSellerActive(st);
    if(!a)return `<div class="note">${U.icon('warning')} Chưa đăng ký người trực tiếp kinh doanh.</div>`;
    return `<dl class="kv"><dt>Họ tên</dt><dd>${U.esc(a.fullName)}</dd><dt>Quan hệ</dt><dd>${U.esc(a.relationship||'Chưa ghi nhận')}</dd><dt>Trạng thái xác minh</dt><dd><span class="tag ${a.status==='ACTIVE'?'ok':'warn'}">${dkDirectSellerStatusLabel[a.status]||a.status}</span></dd></dl><div class="row" style="margin-top:10px"><button class="btn sm" data-act="dkdetail-seller">Xem chi tiết</button></div>`;
  }
  function dkContractTabHtml(st, t, c) {
    const history = A.db.contracts.filter(x => x.stallId === st.id).sort((a,b) => b.start.localeCompare(a.start));
    const historyHtml = `<section class="dk-detail-card dk-single-card" style="margin-top:12px"><div class="dk-detail-card-h"><span class="dk-card-icon orange">${U.icon('refresh')}</span><div><b>Lịch sử người thuê</b><div class="small muted">Derived từ Contract; mã điểm ${st.code} không thay đổi khi đổi người thuê</div></div></div>${history.length ? U.table([{t:'Hợp đồng'},{t:'Tiểu thương'},{t:'Thời hạn'},{t:'Trạng thái'}], history.map(x=>`<tr><td>${x.id}</td><td>${A.idx.trader.get(x.traderId)?U.esc(A.idx.trader.get(x.traderId).name):x.traderId}</td><td>${U.dmy(x.start)} – ${U.dmy(x.end)}</td><td>${x.status==='hieuluc'?'<span class="tag ok">Đang hiệu lực</span>':'<span class="tag">'+(x.status==='chamdut'?'Đã chấm dứt':'Đã kết thúc')+'</span>'}</td></tr>`)) : '<div class="small muted">Chưa có lịch sử hợp đồng.</div>'}</section>`;
    if(!c)return `<section class="dk-detail-card dk-single-card"><div class="dk-detail-card-h"><span class="dk-card-icon green">${U.icon('file')}</span><div><b>Chưa có hợp đồng hiện hành</b><div class="small muted">Điểm kinh doanh này hiện chưa có hợp đồng đang hiệu lực.</div></div></div></section>${historyHtml}`;
    const left=U.days(U.today(),c.end);
    return `<section class="dk-detail-card dk-single-card"><div class="dk-detail-card-h"><span class="dk-card-icon green">${U.icon('file')}</span><div><b>Hợp đồng hiện hành</b><div class="small muted">Thông tin hợp đồng gắn với điểm kinh doanh</div></div></div><dl class="kv"><dt>Mã hợp đồng</dt><dd><b>${c.id}</b></dd><dt>Trạng thái</dt><dd>${c.status==='hieuluc'?'<span class="tag ok">Đang hiệu lực</span>':U.esc(c.status)}</dd><dt>Chủ thể hợp đồng</dt><dd>${t?`${U.esc(t.name)} · ${t.id}`:'Chưa có'}</dd><dt>Điểm kinh doanh</dt><dd>${st.code}</dd><dt>Ngày bắt đầu</dt><dd>${U.dmy(c.start)}</dd><dt>Ngày kết thúc</dt><dd>${U.dmy(c.end)}</dd><dt>Thời hạn còn lại</dt><dd>${left} ngày</dd></dl>${t&&A.canDo('so-do.xem-ho-so',st.market)?`<div class="row" style="margin-top:12px"><button class="btn sm" data-act="dkcl-open-trader" data-id="${t.id}" data-stall="${st.id}">Xem hồ sơ tiểu thương</button></div>`:''}</section>${historyHtml}`;
  }
  function dkDetailHtmlCL(st) {
    if (dkDirectSellerPointId === st.id) return dkDirectSellerFormHtml(st);
    if (dkEditId === st.id) return dkEditHtmlCL(st);
    const m = U.market('CL');
    const floorName = (m.floors.find(fl => fl.id === st.floor) || {}).name || '';
    const t = st.traderId ? A.idx.trader.get(st.traderId) : null;
    const c = st.contractId ? A.idx.contract.get(st.contractId) : null;
    const canEdit = A.canDo('cau-truc.edit', st.market);
    const canXemHoSo = A.canDo('so-do.xem-ho-so', st.market);
    const left = c ? U.days(U.today(), c.end) : null;
    // MAT_BANG_KHU_TANG_DAY_REDESIGN: vị trí Khu/Tầng/Dãy + người phụ trách (mục 8 yêu cầu redesign).
    const dkPos = A.mbLayoutPathForPoint('CL', st);
    if (dkDetailActiveTab === 'contract') return dkPopupShell(st, m, 'contract', dkContractTabHtml(st, t, c));
    if (dkDetailActiveTab === 'directSeller') return dkPopupShell(st, m, 'directSeller', `<section class="dk-detail-card dk-single-card"><div class="dk-detail-card-h"><span class="dk-card-icon purple">${U.icon('users')}</span><div><b>Người trực tiếp kinh doanh hiện tại</b><div class="small muted">Thông tin đầy đủ và lịch sử xác minh</div></div></div>${dkDirectSellerSectionHtml(st, canEdit)}</section>`);
    if (dkDetailActiveTab === 'history') return dkPopupShell(st, m, 'history', `<section class="dk-detail-card dk-single-card"><div class="dk-detail-card-h"><span class="dk-card-icon orange">${U.icon('refresh')}</span><div><b>Lịch sử thay đổi</b><div class="small muted">Các thay đổi đã được ghi nhận tại điểm kinh doanh</div></div></div>${dkHistoryHtml(st)}</section>`);
    // Người bán thực tế: CHỈ hiển thị tên (mục 2 yêu cầu BUSINESS_POINT_CL_DETAIL_DRAWER_REDESIGN)
    // — kể cả khi trùng người thuê cũng không kèm chú thích/badge/số điện thoại nào khác, tránh
    // nhồi thông tin giải thích dư thừa vào đúng 1 dòng label/value.
    return `<div class="drawer-h dk-popup-head"><div><div class="row" style="gap:10px"><h3>${st.code}</h3>${U.statusTag(st.status)}</div><div class="small muted dk-popup-meta">${U.esc(dkPointTypeLabel(st))} · ${U.esc(floorName)} · ${U.esc(m.name)}</div></div><span class="spacer"></span>
        ${canEdit ? `<button class="btn sm" data-act="dkcl-edit-open" data-id="${st.id}">Chỉnh sửa thông tin</button>` : ''}
        <button class="x" data-act="close" aria-label="Đóng">×</button></div>
      ${dkDetailTabsHtml('overview')}
      <div class="drawer-b dk-detail-body dk-overview-body">
        <section class="dk-detail-card">
        <div class="dk-detail-card-h"><span class="dk-card-icon blue">${U.icon('store')}</span><div><b>Thông tin điểm kinh doanh</b><div class="small muted">Thông tin vị trí và đặc tính điểm</div></div></div>
        <dl class="kv">
          <dt>Mã điểm</dt><dd><b>${st.code}</b></dd>
          <dt>Khu</dt><dd>${U.esc(dkPos.khu)}</dd>
          <dt>Tầng</dt><dd>${U.esc(dkPos.tang)}</dd>
          <dt>Dãy</dt><dd>${U.esc(dkPos.day)}</dd>
          <dt>Loại điểm</dt><dd>${U.esc(dkPointTypeLabel(st))}</dd>
          <dt>Diện tích</dt><dd>${st.area.toLocaleString('vi-VN')} m²</dd>
          <dt>Loại diện tích</dt><dd>${U.esc(U.areaTypeLabel(st.areaType) || 'Chưa có thông tin')}</dd>
          <dt>Ngành hàng</dt><dd>${U.esc(st.cat) || 'Chưa có thông tin'}</dd>
          <dt>Đơn giá áp dụng</dt><dd>${U.unitLabel(st)}</dd>
          <dt>Trạng thái cấu trúc</dt><dd>${st.structuralStatus === 'MERGED' ? '<span class="tag warn">Đã gộp</span>' : st.structuralStatus === 'SPLIT' ? '<span class="tag purple">Đã tách</span>' : '<span class="tag ok">Hoạt động</span>'}</dd>
        </dl>
        ${st.structuralStatus === 'SPLIT' ? '<div class="note info" style="margin-top:10px">Điểm này đã được tách theo một yêu cầu tách điểm — xem lịch sử ở mục D.</div>' : ''}${st.structuralStatus === 'MERGED' ? `<div class="note info" style="margin-top:10px">Điểm này đã được gộp; bản ghi được giữ lại để truy vết lịch sử.${st.mergedIntoPointId&&A.idx.stall.get(st.mergedIntoPointId)?` <button class="btn sm" data-act="dkmerge-view-point" data-id="${st.mergedIntoPointId}">Xem ${A.idx.stall.get(st.mergedIntoPointId).code}</button>`:''}</div>` : ''}${st.mergeRequestId ? `<div class="note info" style="margin-top:10px">Điểm được tạo từ nghiệp vụ gộp. Điểm nguồn: ${(st.sourcePointIds||[]).map(id=>{const x=A.idx.stall.get(id);return x?`<button class="btn sm" data-act="dkmerge-view-point" data-id="${x.id}">${x.code}</button>`:'';}).join(' ')}<br>Ánh xạ mặt bằng cần được cập nhật tại Cấu hình mặt bằng.</div>` : ''}
        </section>
        <section class="dk-detail-card">
        <div class="dk-detail-card-h"><span class="dk-card-icon green">${U.icon('store')}</span><div><b>Thông tin sử dụng</b><div class="small muted">Hợp đồng và chủ thể đang sử dụng</div></div></div>
        <dl class="kv">
          <dt>Trạng thái</dt><dd>${U.statusTag(st.status)}</dd>
          <dt>Chủ thể hợp đồng</dt><dd>${t ? `${U.esc(t.name)} · ${t.id}` : 'Chưa có'}</dd>
          <dt>Hợp đồng hiện hành</dt><dd>${c ? c.id : 'Chưa có hợp đồng hiệu lực'}</dd>
          ${c ? `<dt>Thời hạn</dt><dd>${U.dmy(c.start)} – ${U.dmy(c.end)}<br><span class="small muted">${left <= 30 ? `<b style="color:#df2225">còn ${left} ngày</b>` : 'còn ' + left + ' ngày'}</span></dd>` : ''}
          <dt>NV thu phí phụ trách</dt><dd>${U.esc(dkCollectorLabel(st))}</dd>
        </dl>
        ${t && canXemHoSo ? `<div class="row" style="margin-top:10px"><button class="btn sm" data-act="dkcl-open-trader" data-id="${t.id}" data-stall="${st.id}">Xem hồ sơ tiểu thương</button></div>` : ''}
        </section>
        <section class="dk-detail-card">
        <div class="dk-detail-card-h"><span class="dk-card-icon purple">${U.icon('users')}</span><div><b>Người trực tiếp kinh doanh</b><div class="small muted">Khác với chủ thể hợp đồng</div></div></div>
        ${dkDirectSellerSummaryHtml(st)}
        </section>
        <section class="dk-detail-card">
        <div class="dk-detail-card-h"><span class="dk-card-icon orange">${U.icon('file')}</span><div><b>Ghi chú</b><div class="small muted">Các thông tin bổ sung về điểm kinh doanh</div></div></div>
        <div class="dk-note-box">${st.note ? U.esc(st.note) : 'Chưa có ghi chú.'}</div>
        </section>
      </div><div class="drawer-f dk-popup-footer"><button class="btn" data-act="close">Đóng</button></div>`;
  }
  // ---- EDIT MODE (Mục tiêu 2 BUSINESS_POINT_CL_DETAIL_DRAWER_REDESIGN): chuyển drawer TẠI CHỖ,
  // KHÔNG mở modal/drawer thứ hai — chỉ được chỉnh Vị trí/Loại điểm/Diện tích/Ngành hàng (mô tả đơn
  // thuần của điểm); Mã điểm readonly; Trạng thái/Người thuê/Người bán thực tế/Hợp đồng/Thời hạn/
  // Công nợ KHÔNG có mặt trong form này (phụ thuộc nghiệp vụ hợp đồng/sử dụng điểm/tài chính, không
  // sửa ở đây). Đơn giá áp dụng CHỈ hiển thị (lấy theo cấu hình khu vực hiện có D.MARKETS — không
  // cho nhập tay, không tạo nguồn giá mới) — xem dkcl-edit-save: đơn giá tự cập nhật đúng theo Vị
  // trí mới (qua `sec.type` config sẵn có), không phải giá trị người dùng gõ.
  function dkEditHtmlCL(st) {
    const m = U.market('CL');
    const locOptions = m.floors.filter(fl => fl.sections.length).map(fl =>
      `<optgroup label="${U.esc(fl.name)}">${fl.sections.map(s => `<option value="${fl.id}|${s.id}" ${st.floor === fl.id && st.section === s.id ? 'selected' : ''}>${U.esc(s.name)}</option>`).join('')}</optgroup>`
    ).join('');
    const typeOptions = Object.keys(D.POINT_TYPE).map(k => `<option value="${k}" ${st.pointType === k ? 'selected' : ''}>${D.POINT_TYPE[k].label}</option>`).join('');
    return `<div class="drawer-h detail-form-head"><div><h3>${st.code}</h3><div class="small muted" style="margin-top:2px">Chỉnh sửa thông tin điểm kinh doanh</div></div><span class="spacer">
        </span><button class="x" data-act="close" aria-label="Đóng">×</button></div><div class="detail-form-tabs">${U.icon('edit')} Thông tin điểm kinh doanh</div>
      <div class="drawer-b detail-form-body"><section class="detail-form-card">
        <div class="form-grid" style="grid-template-columns:1fr">
          <div class="field"><label>Mã điểm</label><input class="input" value="${st.code}" disabled></div>
          <div class="field"><label>Vị trí *</label><select class="input" id="dke-loc">${locOptions}</select></div>
          <div class="field"><label>Loại điểm *</label><select class="input" id="dke-type">${typeOptions}</select></div>
          <div class="field"><label>Diện tích (m²) *</label><input class="input" type="number" min="0" step="0.1" id="dke-area" value="${st.area}"></div>
          <div class="field"><label>Ngành hàng *</label><input class="input" id="dke-cat" value="${U.esc(st.cat || '')}"></div>
          <div class="field"><label>Đơn giá áp dụng</label><input class="input" value="${U.unitLabel(st)}" disabled>
            <div class="small muted" style="margin-top:2px">Áp dụng theo biểu phí hiện hành của khu vực, không chỉnh sửa tại đây.</div></div>
        </div></section>
        </div><div class="drawer-f detail-form-footer">
          <button class="btn" data-act="dkcl-edit-cancel" data-id="${st.id}">Hủy</button>
          <button class="btn primary" data-act="dkcl-edit-save" data-id="${st.id}">Lưu thay đổi</button>
        </div>
      </div>`;
  }
  // Vẽ lại pop-up chi tiết điểm KD (CL). Nội dung và back-stack được giữ nguyên; chỉ thay shell
  // drawer hẹp bằng modal rộng để đọc thông tin điểm, hợp đồng và người trực tiếp KD dễ hơn.
  function dkRerenderDrawer(st) {
    A.$('#modal-root').innerHTML = `<div class="overlay" data-act="overlay"><div class="modal wide dk-detail-popup" role="dialog" aria-modal="true">${A.drawerBackHtml()}${dkDetailHtmlCL(st)}</div></div>`;
  }
  A.ACT['dkdetail-tab'] = el => {
    const active=['overview','contract','directSeller','history'].includes(el.dataset.id) ? el.dataset.id : 'overview';
    // point id không cần nằm ở tab vì chỉ một popup điểm mở tại một thời điểm; lấy từ popup state bên dưới.
    const current=A.idx.stall.get(dkDetailPointId);
    if(!current)return;
    dkDetailActiveTab=active; dkRerenderDrawer(current);
  };
  A.ACT['dkdetail-seller'] = () => { const st=A.idx.stall.get(dkDetailPointId); if(st){ dkDetailActiveTab='directSeller'; dkRerenderDrawer(st); } };
  let dkDetailPointId = null;
  // Mở pop-up chi tiết điểm KD — dùng chung cho action GỐC (`dk-open`) và drill-down từ Mặt bằng.
  A.openDkDrawer = function (st) {
    if (st.market !== 'CL') { A.modal(A.mHead('Điểm kinh doanh') + `<div class="modal-b detail">${A.stallPanel(st)}</div>`); return; }
    dkEditId = null;
    dkDetailPointId = st.id;
    dkDetailActiveTab = 'overview';
    dkRerenderDrawer(st);
    A.render();
  };
  // ---- Chỉnh sửa thông tin (Vị trí/Loại điểm/Diện tích/Ngành hàng) — mutation thật, ghi lịch sử.
  // KHÔNG mở modal chồng lên drawer (Mục tiêu 2 BUSINESS_POINT_CL_DETAIL_DRAWER_REDESIGN): chuyển
  // TRỰC TIẾP drawer đang mở sang EDIT MODE tại chỗ bằng dkEditId + dkRerenderDrawer, giữ nguyên
  // "← Quay lại" nếu drawer này được mở như drawer con.
  A.ACT['dkcl-edit-open'] = el => {
    const st = A.idx.stall.get(el.dataset.id);
    if (!st || !A.canDo('cau-truc.edit', st.market)) return;
    dkEditId = st.id;
    dkRerenderDrawer(st);
  };
  A.ACT['dkcl-edit-cancel'] = el => {
    const st = A.idx.stall.get(el.dataset.id);
    if (!st) return;
    dkEditId = null;
    dkRerenderDrawer(st);
  };
  A.ACT['dkcl-edit-save'] = el => {
    const st = A.idx.stall.get(el.dataset.id);
    if (!st || !A.canDo('cau-truc.edit', st.market)) return;
    const [floorId, sectionId] = A.$('#dke-loc').value.split('|');
    const type = A.$('#dke-type').value;
    const area = Number(A.$('#dke-area').value);
    const cat = A.$('#dke-cat').value.trim();
    const fl = U.market('CL').floors.find(x => x.id === floorId);
    const sec = fl && fl.sections.find(s => s.id === sectionId);
    if (!sec || !(area > 0) || !cat) { U.toast('Vui lòng chọn vị trí hợp lệ và nhập đủ diện tích, ngành hàng'); return; }
    const changes = [];
    if (fl.id !== st.floor || sec.id !== st.section) changes.push(`vị trí "${st.sectionName}" → "${sec.name}"`);
    if (type !== st.pointType) changes.push(`loại điểm "${dkPointTypeLabel(st)}" → "${D.POINT_TYPE[type] ? D.POINT_TYPE[type].label : type}"`);
    if (area !== st.area) changes.push(`diện tích ${st.area} m² → ${area} m²`);
    if (cat !== st.cat) changes.push(`ngành hàng "${st.cat}" → "${cat}"`);
    // Đơn giá áp dụng lấy theo `sec.type` (cấu hình khu vực có sẵn trong D.MARKETS) — KHÔNG cho
    // người dùng nhập tay, không tạo nguồn giá mới (mục "Đơn giá áp dụng" của yêu cầu).
    st.floor = fl.id; st.section = sec.id; st.sectionName = sec.name; st.type = sec.type;
    st.pointType = type; st.area = area; st.cat = cat;
    if (changes.length) { st.history = st.history || []; st.history.unshift(`${U.dmy(U.today())}: Cập nhật thông tin điểm (${changes.join(', ')})`); }
    A.save();
    dkEditId = null;
    dkRerenderDrawer(st);
    A.render(); U.toast('Đã cập nhật thông tin ' + st.code);
  };
  // Người trực tiếp KD có vòng đời độc lập với chủ thể hợp đồng. Mọi đăng ký mới đều PENDING;
  // xác minh mới thay ACTIVE cũ thành ENDED, nhờ vậy không ghi đè lịch sử.
  A.CH['dkds-kind'] = el => { if (dkDirectSellerDraft) { dkDirectSellerDraft.kind = el.value; const st = A.idx.stall.get(dkDirectSellerPointId); if (st) dkRerenderDrawer(st); } };
  A.IN['dkds-name'] = el => { if (dkDirectSellerDraft) dkDirectSellerDraft.fullName = el.value; };
  A.IN['dkds-idno'] = el => { if (dkDirectSellerDraft) dkDirectSellerDraft.idNumber = el.value; };
  A.IN['dkds-phone'] = el => { if (dkDirectSellerDraft) dkDirectSellerDraft.phone = el.value; };
  A.IN['dkds-relationship'] = el => { if (dkDirectSellerDraft) dkDirectSellerDraft.relationship = el.value; };
  A.IN['dkds-start'] = el => { if (dkDirectSellerDraft) dkDirectSellerDraft.startDate = el.value; };
  A.IN['dkds-note'] = el => { if (dkDirectSellerDraft) dkDirectSellerDraft.note = el.value; };
  A.ACT['dkds-open'] = el => {
    const st = A.idx.stall.get(el.dataset.id);
    if (!st || !A.canDo('cau-truc.edit', st.market)) return;
    dkDirectSellerPointId = st.id;
    dkDirectSellerDraft = { kind: st.traderId ? 'owner' : 'other', fullName: '', idNumber: '', phone: '', relationship: 'Người bán thay', startDate: U.today(), note: '' };
    dkRerenderDrawer(st);
  };
  A.ACT['dkds-cancel'] = el => { const st = A.idx.stall.get(el.dataset.id); dkDirectSellerPointId = null; dkDirectSellerDraft = null; if (st) dkRerenderDrawer(st); };
  A.ACT['dkds-save'] = el => {
    const st = A.idx.stall.get(el.dataset.id), d = dkDirectSellerDraft;
    if (!st || !d || !A.canDo('cau-truc.edit', st.market)) return;
    let person = null, fullName = d.fullName.trim(), idNumber = d.idNumber.trim(), phone = d.phone.trim(), relationship = d.relationship.trim();
    if (d.kind === 'owner') {
      person = st.traderId ? A.idx.trader.get(st.traderId) : null;
      if (!person) { U.toast('Điểm chưa có chủ thể hợp đồng, vui lòng nhập người trực tiếp kinh doanh'); return; }
      fullName = person.name; idNumber = person.idNo || ''; phone = person.phone || ''; relationship = 'Chủ thể hợp đồng trực tiếp kinh doanh';
    }
    if (!fullName || !d.startDate) { U.toast('Vui lòng nhập họ tên và ngày bắt đầu'); return; }
    const now = U.today(), acc = A.currentAccount();
    const seq = (A.db.directSellerAssignments || []).length + 1;
    A.db.directSellerAssignments.push({ id: 'DSA-' + U.pad(seq, 4), market: st.market, pointId: st.id, traderId: person ? person.id : null, personId: person ? person.id : null, fullName, idNumber, phone, relationship: relationship || 'Chưa ghi nhận', startDate: d.startDate, endDate: null, status: 'PENDING_VERIFICATION', source: 'STAFF_DECLARATION', verifiedBy: null, verifiedAt: null, note: d.note.trim(), createdAt: now, updatedAt: now, createdBy: acc ? acc.id : null });
    A.save(); dkDirectSellerPointId = null; dkDirectSellerDraft = null; dkRerenderDrawer(st); A.render(); U.toast('Đã lưu đăng ký, chờ xác minh.');
  };
  A.ACT['dkds-verify-open'] = el => {
    const a=(A.db.directSellerAssignments||[]).find(x=>x.id===el.dataset.id);
    if(!a||a.status!=='PENDING_VERIFICATION'||!A.canDo('cau-truc.edit',a.market))return;
    A.modal(A.mHead('XÁC MINH NGƯỜI TRỰC TIẾP KINH DOANH')+`<div class="modal-b detail-confirm-body"><div class="detail-confirm-icon">${U.icon('check')}</div><h3>${U.esc(a.fullName)}</h3><p class="muted">Xác nhận thông tin người trực tiếp kinh doanh tại điểm ${U.esc((A.idx.stall.get(a.pointId)||{}).code||'')}.</p><dl class="kv"><dt>Quan hệ</dt><dd>${U.esc(a.relationship||'Chưa ghi nhận')}</dd><dt>Từ ngày</dt><dd>${U.dmy(a.startDate)}</dd></dl></div><div class="modal-f detail-form-footer"><button class="btn" data-act="close">Hủy</button><button class="btn primary" data-act="dkds-verify-save" data-id="${a.id}">${U.icon('check')}Xác minh</button></div>`);
  };
  A.ACT['dkds-verify-save'] = el => {
    const a = (A.db.directSellerAssignments || []).find(x => x.id === el.dataset.id);
    if (!a || a.status !== 'PENDING_VERIFICATION' || !A.canDo('cau-truc.edit', a.market)) return;
    const st = A.idx.stall.get(a.pointId); if (!st) return;
    const now = U.today(), acc = A.currentAccount();
    (A.db.directSellerAssignments || []).filter(x => x.pointId === a.pointId && x.status === 'ACTIVE').forEach(x => { x.status = 'ENDED'; x.endDate = now; x.updatedAt = now; });
    a.status = 'ACTIVE'; a.verifiedBy = acc ? acc.id : null; a.verifiedAt = now; a.updatedAt = now;
    A.save(); dkRerenderDrawer(st); A.render(); U.toast('Đã xác minh người trực tiếp kinh doanh.');
  };
  // ---- Chuyển đổi điểm (đổi pointType — field thuần hiển thị, KHÔNG ảnh hưởng đơn giá) ----
  A.ACT['dkcl-convert-open'] = el => {
    const st = A.idx.stall.get(el.dataset.id);
    if (!st || !A.canDo('cau-truc.edit', st.market)) return;
    const opts = Object.keys(D.POINT_TYPE).filter(k => k !== st.pointType);
    A.modal(A.mHead('Chuyển đổi điểm ' + st.code) + `<div class="modal-b">
      <p class="muted" style="margin-top:0">Loại điểm hiện tại: <b>${U.esc(dkPointTypeLabel(st))}</b></p>
      <div class="field"><label>Chuyển sang loại điểm</label><select class="input" id="dkv-type">${opts.map(k => `<option value="${k}">${D.POINT_TYPE[k].label}</option>`).join('')}</select></div>
      <div class="note" style="margin-top:10px">Chỉ đổi phân loại hiển thị của điểm, không ảnh hưởng đơn giá dịch vụ đang áp dụng.</div></div>
      <div class="modal-f"><button class="btn" data-act="close">Hủy</button><button class="btn primary" data-act="dkcl-convert-save" data-id="${st.id}">Chuyển đổi</button></div>`);
  };
  A.ACT['dkcl-convert-save'] = el => {
    const st = A.idx.stall.get(el.dataset.id);
    if (!st || !A.canDo('cau-truc.edit', st.market)) return;
    const to = A.$('#dkv-type').value, fromLabel = dkPointTypeLabel(st), toLabel = D.POINT_TYPE[to] ? D.POINT_TYPE[to].label : to;
    st.pointType = to;
    st.history = st.history || []; st.history.unshift(`${U.dmy(U.today())}: Chuyển đổi loại điểm: ${fromLabel} → ${toLabel}`);
    A.save();
    dkRerenderDrawer(st);
    A.render(); U.toast('Đã chuyển đổi ' + st.code + ' sang ' + toLabel);
  };
  // ---- Gộp điểm — PROTOTYPE INTERACTION (mục 15 yêu cầu cũ): hệ thống hiện tại chưa có nghiệp vụ
  // thực thi đầy đủ (tạo/xoá điểm kèm phân bổ lại trader/hợp đồng/hoá đơn theo stallId) — KHÔNG tự
  // thiết kế database phức tạp/backend giả. Chỉ ghi 1 dòng lịch sử minh hoạ ý định thao tác, KHÔNG
  // restructure A.db.stalls thật. Xem NEED_CONFIRMATION trong report cũ. "Tách điểm" đã tách hẳn
  // sang nghiệp vụ có quy trình riêng — xem tab "Yêu cầu thay đổi" (BUSINESS_POINT_SPLIT_WORKFLOW
  // bên dưới), KHÔNG còn ở đây nữa.
  A.ACT['dkcl-merge-open'] = el => {
    const st = A.idx.stall.get(el.dataset.id);
    if (!st || !(A.canDo('diem-kd.gop-diem.lap-yeu-cau', st.market) || A.canDo('diem-kd.gop-diem.assign', st.market))) return;
    dkMergeDraft = { a: st.id, b: '', code: '', reason: '', assignedTo: '' };
    A.modal(dkMergeForm(), true);
    return;
    const candidates = A.db.stalls.filter(s => s.market === st.market && s.section === st.section && s.id !== st.id && s.status === 'trong');
    A.modal(A.mHead('Gộp điểm ' + st.code) + `<div class="modal-b">
      <p class="muted" style="margin-top:0">Gộp <b>${st.code}</b> với 1 điểm còn trống khác trong cùng khu vực (${U.esc(st.sectionName)}) thành 1 điểm lớn hơn.</p>
      ${candidates.length
        ? `<div class="field"><label>Gộp với điểm</label><select class="input" id="dkm-with">${candidates.map(s => `<option value="${s.id}">${s.code} (${s.area} m²)</option>`).join('')}</select></div>
           <div class="note" style="margin-top:10px">Prototype: thao tác này chỉ ghi nhận minh hoạ vào lịch sử thay đổi, CHƯA gộp thật 2 điểm trong dữ liệu chính thức.</div>`
        : '<div class="note">Không có điểm còn trống nào khác trong cùng khu vực để gộp.</div>'}
      </div>
      <div class="modal-f"><button class="btn" data-act="close">Hủy</button>${candidates.length ? `<button class="btn primary" data-act="dkcl-merge-save" data-id="${st.id}">Ghi nhận</button>` : ''}</div>`);
  };
  A.ACT['dkmerge-view-point'] = el => { const st=A.idx.stall.get(el.dataset.id); if(st) A.openDkDrawer(st); };
  A.ACT['dkcl-merge-save'] = el => {
    U.toast('Gộp điểm phải đi qua Yêu cầu thay đổi; thao tác minh họa cũ đã bị vô hiệu hóa.');
    return;
    const st = A.idx.stall.get(el.dataset.id);
    if (!st || !A.canDo('cau-truc.edit', st.market)) return;
    const withId = A.$('#dkm-with').value, other = A.idx.stall.get(withId);
    if (!other) return;
    st.history = st.history || [];
    st.history.unshift(`${U.dmy(U.today())}: Yêu cầu gộp điểm ${st.code} với ${other.code} — ghi nhận minh hoạ, chưa áp dụng vào dữ liệu chính thức`);
    A.save();
    dkRerenderDrawer(st);
    A.render(); U.toast('Đã ghi nhận yêu cầu gộp điểm ' + st.code + ' (minh hoạ prototype)');
  };

  // ==========================================================================================
  // ---------- Yêu cầu thay đổi điểm kinh doanh — nghiệp vụ TÁCH ĐIỂM (Chợ Cao Lãnh) ----------
  // BUSINESS_POINT_SPLIT_WORKFLOW_IMPLEMENTATION_REPORT.md. Model dữ liệu: A.db.pointRequests
  // (mảng MỚI, xem data.js build()) — mỗi phần tử là 1 yêu cầu thay đổi, V1 chỉ có type SPLIT.
  // internal id của record MỚI (khi thực hiện tách) và mã điểm kinh doanh (businessPointCode) là 2
  // khái niệm khác nhau — GIỮ NGUYÊN đúng quy ước id đã có của A.db.stalls (`id = market + '-' +
  // code`, xem data.js build() dòng tạo `stalls`), KHÔNG dùng `code` làm id, KHÔNG bịa 1 lược đồ id
  // khác cho riêng điểm mới tạo từ tách. Permission: 5 permKey action:diem-kd.tach-diem.* (xem
  // js/permissions.js) — MỌI mutation đều gọi A.canDo(...) lại ngay trong handler, không chỉ dựa
  // vào nút đã ẩn/hiện đúng ở UI (mục 10/13 yêu cầu).
  // Sinh mã điểm mới dự kiến từ mã điểm nguồn bằng hậu tố A/B/C... (mục 5 yêu cầu — mã điểm KHÔNG
  // cho người dùng tự nhập nếu tránh được): bỏ qua hậu tố đã trùng mã điểm CÒN TỒN TẠI trong cùng
  // chợ, không đụng/đổi mã của bất kỳ điểm nào khác (KA-A02, KA-A03...) — hàm này chỉ SINH mã, chưa
  // ghi gì vào A.db.stalls.
  function dkSplitSuggestCodes(st) {
    const used = new Set(A.db.stalls.filter(s => s.market === st.market).map(s => s.code));
    const codes = [];
    for (let c = 65; c <= 90 && codes.length < 2; c++) {
      const candidate = st.code + String.fromCharCode(c);
      if (!used.has(candidate)) codes.push(candidate);
    }
    while (codes.length < 2) codes.push(st.code + '-' + (codes.length + 1)); // phòng thủ tối đa, thực tế 26 hậu tố không tới
    return codes;
  }
  // Ngành hàng cho phép của khu vực chứa điểm nguồn (mục 7 yêu cầu — điểm mới KHÔNG được chọn ngành
  // hàng ngoài quy hoạch khu). Model hiện tại (data.js MARKETS) mỗi khu (`section`) khai báo ĐÚNG 1
  // ngành hàng quy hoạch (`section.cat`, vd "Khu rau củ, trái cây" → cat "Rau củ, trái cây") — mảng
  // trả về ở đây phản ánh ĐÚNG độ chi tiết dữ liệu hiện có (1 phần tử), KHÔNG bịa thêm danh sách
  // nhiều ngành/khu chưa từng tồn tại trong model chỉ để phục vụ dropdown.
  function dkZoneAllowedCats(st) {
    const m = U.market(st.market);
    const fl = m.floors.find(x => x.id === st.floor);
    const sec = fl && fl.sections.find(x => x.id === st.section);
    return sec ? [sec.cat] : [st.cat];
  }
  function dksrPlanDefaults(st) {
    const codes = dkSplitSuggestCodes(st), cats = dkZoneAllowedCats(st);
    const a1 = +(st.area / 2).toFixed(1), a2 = +(st.area - a1).toFixed(1);
    return {
      a: { code: codes[0], area: a1, pointType: st.pointType, cat: cats[0] || st.cat },
      b: { code: codes[1], area: a2, pointType: st.pointType, cat: cats[0] || st.cat }
    };
  }
  function dkReqFind(id) { return A.db.pointRequests.find(r => r.id === id); }
  function dkReqNextId() {
    const nums = A.db.pointRequests.map(r => parseInt(String(r.id).replace('YC-', ''), 10)).filter(n => !isNaN(n));
    return 'YC-' + U.pad((nums.length ? Math.max.apply(null, nums) : 0) + 1, 4);
  }
  const DKREQ_STATUS_LABEL = { DRAFT: 'Nháp', STAFF_REVIEW: 'BQL đang xử lý', PENDING_APPROVAL: 'Chờ phê duyệt', APPROVED: 'Đã phê duyệt', REJECTED: 'Từ chối', IMPLEMENTING: 'Đang thực hiện', COMPLETED: 'Hoàn thành' };
  const DKREQ_STATUS_CLASS = { DRAFT: '', STAFF_REVIEW: 'info', PENDING_APPROVAL: 'warn', APPROVED: 'info', REJECTED: 'danger', IMPLEMENTING: 'warn', COMPLETED: 'ok' };
  function dkReqStatusTag(s) { return `<span class="tag ${DKREQ_STATUS_CLASS[s] || ''}">${U.esc(DKREQ_STATUS_LABEL[s] || s)}</span>`; }
  // Supplement — 3 nguồn khởi tạo (mục 1 yêu cầu bổ sung): source CHỈ thể hiện nguồn khởi tạo, KHÔNG
  // phải cơ chế authorization (không có bất kỳ `if (source === 'MANAGER')` nào quyết định quyền ở
  // bất kỳ đâu trong file này — mọi quyền vẫn qua A.canDo()).
  function dkReqSourceLabel(s) { return s === 'TRADER' ? 'Tiểu thương' : s === 'MANAGER' ? 'Trưởng BQL' : 'Nhân viên BQL'; }
  // assignedTo là người phụ trách xuyên suốt. Visibility vẫn theo screen/scope, nhưng các mutation
  // của nhân viên phải khớp đúng account này (ngoại lệ duy nhất là tiếp nhận request TRADER chưa giao).
  function dkReqAssigneeName(r) {
    if (!r.assignedTo) return 'Chưa phân công';
    const acc = A.ACCOUNTS.get(r.assignedTo);
    return acc ? acc.fullName : 'Chưa phân công';
  }
  function dkReqOwnedByCurrent(r) { const a = A.currentAccount(); return !!(a && r.assignedTo && r.assignedTo === a.id); }
  function dkReqCanAccept(r) { return r.status === 'DRAFT' && !r.assignedTo && A.canDo('diem-kd.tach-diem.tiep-nhan', r.market); }
  function dkReqResponsibilityText(r) {
    if (!r.assignedTo) return 'Chờ tiếp nhận';
    if (r.status === 'APPROVED') return 'Chờ thực hiện';
    if (r.status === 'PENDING_APPROVAL') return 'Chờ phê duyệt';
    if (r.status === 'COMPLETED') return 'Đã hoàn thành';
    return 'Đang xử lý';
  }

  // ---- Timeline "D. Quá trình xử lý" — 3 bộ bước theo nguồn đề nghị (mục 8/9 yêu cầu bổ sung):
  //   TRADER  : có thêm bước "tiếp nhận"/"hoàn thiện phương án" (BQL phải tự làm từ đầu).
  //   STAFF   : không cần "tiếp nhận" (nhân viên đã nhập đủ phương án ngay khi lập yêu cầu).
  //   MANAGER : có thêm bước "giao nhân viên xử lý" (Trưởng BQL đề xuất, KHÔNG tự lập phương án kỹ
  //             thuật — mục 3/9 yêu cầu bổ sung, tách rõ "đề xuất xem xét" khỏi "phê duyệt phương án
  //             đã được NV BQL kiểm tra/hoàn thiện").
  // ✓ done · ● đang chờ (bước kế tiếp chưa xong) · ✗ bị từ chối · ○ chưa tới.
  const DKREQ_STEPS_TRADER = [
    { key: 'created', label: 'Yêu cầu được tạo' },
    { key: 'received', label: 'Nhân viên Ban Quản lý tiếp nhận' },
    { key: 'planned', label: 'Hoàn thiện phương án' },
    { key: 'submitted', label: 'Gửi Trưởng Ban Quản lý phê duyệt' },
    { key: 'approved', label: 'Trưởng Ban Quản lý phê duyệt' },
    { key: 'implementing', label: 'Thực hiện tách điểm' },
    { key: 'completed', label: 'Hoàn thành' }
  ];
  const DKREQ_STEPS_STAFF = [
    { key: 'created', label: 'Yêu cầu được tạo' },
    { key: 'submitted', label: 'Gửi Trưởng Ban Quản lý phê duyệt' },
    { key: 'approved', label: 'Trưởng Ban Quản lý phê duyệt' },
    { key: 'implementing', label: 'Thực hiện tách điểm' },
    { key: 'completed', label: 'Hoàn thành' }
  ];
  const DKREQ_STEPS_MANAGER = [
    { key: 'created', label: 'Trưởng Ban Quản lý đề xuất xem xét tách điểm' },
    { key: 'assigned', label: 'Đã giao nhân viên xử lý' },
    { key: 'received', label: 'Nhân viên Ban Quản lý tiếp nhận, kiểm tra hiện trạng' },
    { key: 'planned', label: 'Hoàn thiện phương án' },
    { key: 'submitted', label: 'Trình lại Trưởng Ban Quản lý phê duyệt phương án' },
    { key: 'approved', label: 'Trưởng Ban Quản lý phê duyệt phương án' },
    { key: 'implementing', label: 'Thực hiện tách điểm' },
    { key: 'completed', label: 'Hoàn thành' }
  ];
  function dkReqStepDefs(r) {
    return r.source === 'TRADER' ? DKREQ_STEPS_TRADER : r.source === 'MANAGER' ? DKREQ_STEPS_MANAGER : DKREQ_STEPS_STAFF;
  }
  // Tính TRẠNG THÁI từng bước (done/current/rejected/pending) từ timeline — KHÔNG kèm label, để dùng
  // chung được cho cả Web (nhãn kỹ thuật, dkReqSteps() bên dưới) LẪN Mini App (nhãn thân thiện, xem
  // A.pointReq.stepStates ở cuối phần này / MINI_APP_SPLIT_AND_FLOORPLAN_CODE_REPORT.md) — chỉ 1 nơi
  // duy nhất tính logic done/current/rejected, tránh 2 cơ chế lệch nhau giữa 2 bề mặt hiển thị.
  function dkReqStepStates(r) {
    const defs = dkReqStepDefs(r);
    const byKey = {}; (r.timeline || []).forEach(e => { byKey[e.key] = e; });
    const rejectedAt = r.status === 'REJECTED' ? defs.findIndex(d => d.key === 'approved') : -1;
    const list = rejectedAt === -1 ? defs : defs.slice(0, rejectedAt + 1);
    let currentSet = false;
    return list.map(d => {
      const e = byKey[d.key];
      const isRejectStep = r.status === 'REJECTED' && d.key === 'approved';
      const done = !!e;
      let state = done ? (isRejectStep ? 'rejected' : 'done') : 'pending';
      if (!done && !currentSet) { state = 'current'; currentSet = true; }
      return { key: d.key, state, at: e ? e.at : null, by: e ? e.by : null, note: e ? e.note : null };
    });
  }
  function dkReqSteps(r) {
    const defs = dkReqStepDefs(r);
    const byKey = {}; defs.forEach(d => { byKey[d.key] = d.label; });
    return dkReqStepStates(r).map(s => ({
      label: s.state === 'rejected' ? 'Trưởng Ban Quản lý từ chối' : byKey[s.key],
      state: s.state, at: s.at, by: s.by, note: s.note
    }));
  }
  function dkReqTimelineHtml(r) {
    return `<div class="yc-steps">${dkReqSteps(r).map(s => {
      const ico = s.state === 'done' ? '✓' : s.state === 'rejected' ? '✗' : s.state === 'current' ? '●' : '○';
      return `<div class="yc-step yc-step-${s.state}"><div class="yc-step-ico">${ico}</div><div>
        <div class="yc-step-label">${U.esc(s.label)}</div>
        ${s.at ? `<div class="small muted">${U.esc(s.by || '')}${s.by ? ' · ' : ''}${U.esc(s.at)}</div>` : ''}
        ${s.note ? `<div class="small muted">${U.esc(s.note)}</div>` : ''}
        </div></div>`;
    }).join('')}</div>`;
  }

  // ---- "C. Phương án tách" — hiển thị (đã lưu trong r.plan) VÀ form nhập (dùng chung 1 draft) ----
  // dkPlanMode: null (không mở form nào) | 'create' (form "+ Lập yêu cầu tách điểm") | 'complete'
  // (form "Tiếp nhận & hoàn thiện phương án"/"Sửa phương án" cho 1 yêu cầu đã có, xem dkReqPlanEditId).
  // dkPlanDraft: { stallId, a:{code,area,pointType,cat}, b:{...}, reason, note, files:[name,...] } —
  // DÙNG CHUNG cho cả 2 mode để 2 field editor Section-B (dkPlanFieldsHtml) + lý do/ghi chú/tệp
  // (dkPlanFilesHtml) chỉ cần viết 1 lần, không lặp UI. CHỈ là state tạm phía FE, chưa ghi vào
  // A.db.pointRequests cho tới khi bấm Lưu (giống pattern ttPendingDocs/dkEditId đã có trong file).
  let dkPlanMode = null;
  let dkPlanDraft = null;
  let dkReqPlanEditId = null; // id yêu cầu đang ở chế độ sửa phương án (mode 'complete')
  // Lý do TỪ CHỐI — nhập TẠI CHỖ ngay trong drawer chi tiết yêu cầu (KHÔNG dùng A.modal(), vì modal
  // dùng chung #modal-root với drawer sẽ ghi đè mất luôn drawer đang mở phía sau — mục 16 yêu cầu:
  // không được mất context/phải tìm lại request).
  let dkReqRejectId = null;
  let dkRejectReasonDraft = '';

  // Thay #modal-root có giữ lại focus/vị trí con trỏ của Ô ĐANG GÕ (data-in) — CÙNG kỹ thuật với
  // A.render() ở core.js (xem A.render() — focusKey/caret), viết riêng ở đây vì A.render() chỉ vẽ
  // lại #view, không đụng #modal-root nơi drawer/form này đang sống. Dùng cho các field cần phản hồi
  // realtime (diện tích → tổng diện tích, mục 6 yêu cầu) mà KHÔNG mất vị trí con trỏ đang gõ.
  function ycSetModal(html) {
    const root = A.$('#modal-root');
    const ae = document.activeElement;
    const focusKey = ae && ae.dataset && ae.dataset.in ? ae.dataset.in : null;
    const caret = focusKey ? ae.selectionStart : null;
    root.innerHTML = html;
    if (focusKey) {
      const el = document.querySelector(`[data-in="${focusKey}"]`);
      if (el) { el.focus(); try { el.setSelectionRange(caret, caret); } catch (e) { /* bỏ qua */ } }
    }
  }
  function dkPlanTypeOptions(current) {
    return Object.keys(D.POINT_TYPE).map(k => `<option value="${k}" ${k === current ? 'selected' : ''}>${D.POINT_TYPE[k].label}</option>`).join('');
  }
  function dkPlanCatOptions(allowed, current) {
    const opts = allowed.length ? allowed : [current];
    return opts.map(c => `<option value="${U.esc(c)}" ${c === current ? 'selected' : ''}>${U.esc(c)}</option>`).join('');
  }
  // Realtime "Tổng diện tích: X / Y m² ✓" (mục 6 yêu cầu) — so sánh đúng dung sai làm tròn 0.1 m² đã
  // dùng khi sinh area mặc định (toFixed(1)), tránh báo lệch giả do phép trừ số thực.
  function dkPlanTotalHtml(srcArea) {
    const total = +(dkPlanDraft.a.area + dkPlanDraft.b.area).toFixed(1);
    const ok = Math.abs(total - srcArea) < 0.05;
    const diff = Math.abs(total - srcArea).toFixed(1);
    return `<div class="small" style="font-weight:600;margin-top:6px;color:${ok ? '#167a3c' : '#b01c1e'}">Tổng diện tích: ${total.toLocaleString('vi-VN')} / ${srcArea.toLocaleString('vi-VN')} m² ${ok ? '✓' : (total < srcArea ? `— còn thiếu ${diff} m²` : `— vượt ${diff} m²`)}</div>`;
  }
  function dkPlanFieldsHtml(st, allowedCats) {
    return `<div class="split-plan">
      <div class="split-box"><div class="small muted">Điểm nguồn</div><b>${st.code}</b><div class="small muted">${st.area.toLocaleString('vi-VN')} m²</div></div>
      <div class="split-arrow">↓ Tách</div>
      <div class="split-result">
        <div class="split-box" style="text-align:left">
          <div class="small muted" style="text-align:center;margin-bottom:4px">Điểm mới 1</div>
          <div class="field"><label>Mã điểm dự kiến</label><input class="input" value="${U.esc(dkPlanDraft.a.code)}" disabled></div>
          <div class="field" style="margin-top:6px"><label>Diện tích (m²) *</label><input class="input" type="number" min="0" step="0.1" data-in="dkrp-area-a" value="${dkPlanDraft.a.area}"></div>
          <div class="field" style="margin-top:6px"><label>Loại điểm</label><select class="input" data-ch="dkrp-type-a">${dkPlanTypeOptions(dkPlanDraft.a.pointType)}</select></div>
          <div class="field" style="margin-top:6px"><label>Ngành hàng</label><select class="input" data-ch="dkrp-cat-a">${dkPlanCatOptions(allowedCats, dkPlanDraft.a.cat)}</select></div>
        </div>
        <div class="split-box" style="text-align:left">
          <div class="small muted" style="text-align:center;margin-bottom:4px">Điểm mới 2</div>
          <div class="field"><label>Mã điểm dự kiến</label><input class="input" value="${U.esc(dkPlanDraft.b.code)}" disabled></div>
          <div class="field" style="margin-top:6px"><label>Diện tích (m²) *</label><input class="input" type="number" min="0" step="0.1" data-in="dkrp-area-b" value="${dkPlanDraft.b.area}"></div>
          <div class="field" style="margin-top:6px"><label>Loại điểm</label><select class="input" data-ch="dkrp-type-b">${dkPlanTypeOptions(dkPlanDraft.b.pointType)}</select></div>
          <div class="field" style="margin-top:6px"><label>Ngành hàng</label><select class="input" data-ch="dkrp-cat-b">${dkPlanCatOptions(allowedCats, dkPlanDraft.b.cat)}</select></div>
        </div>
      </div>
      ${dkPlanTotalHtml(st.area)}
    </div>`;
  }
  // "Tài liệu / hình ảnh kèm theo" (mục 8 yêu cầu) — FE prototype: chỉ mô phỏng chọn file cục bộ
  // (input type=file, KHÔNG upload server/kho lưu trữ thật), cùng kỹ thuật input ẩn gắn tạm vào DOM
  // đã dùng ở tt-doc-replace (không tạo cơ chế thứ hai).
  function dkPlanFilesHtml() {
    return `<div class="field" style="margin-top:10px"><label>Tài liệu / hình ảnh kèm theo</label>
      <div class="row" style="gap:6px;flex-wrap:wrap">${dkPlanDraft.files.map((name, i) => `<span class="tag info">${U.esc(name)} <button class="x" style="font-size:14px;line-height:1" data-act="dkplan-file-remove" data-idx="${i}" aria-label="Bỏ tệp ${U.esc(name)}">×</button></span>`).join('')}
      <button class="btn sm" type="button" data-act="dkplan-file-pick">+ Chọn tệp</button></div>
      <div class="small muted" style="margin-top:2px">Chỉ mô phỏng chọn tệp minh họa cho prototype, chưa upload lên máy chủ.</div></div>`;
  }
  function dkPlanRerenderCurrent() {
    if (dkPlanMode === 'complete') { const r = dkReqFind(dkReqPlanEditId); if (r) dkReqRerenderDrawer(r); }
    else if (dkPlanMode === 'create') dksrRerender();
  }
  A.IN['dkrp-area-a'] = el => { if (!dkPlanDraft || !dkPlanDraft.a) return; dkPlanDraft.a.area = Number(el.value) || 0; dkPlanRerenderCurrent(); };
  A.IN['dkrp-area-b'] = el => { if (!dkPlanDraft || !dkPlanDraft.b) return; dkPlanDraft.b.area = Number(el.value) || 0; dkPlanRerenderCurrent(); };
  A.CH['dkrp-type-a'] = el => { if (!dkPlanDraft || !dkPlanDraft.a) return; dkPlanDraft.a.pointType = el.value; dkPlanRerenderCurrent(); };
  A.CH['dkrp-type-b'] = el => { if (!dkPlanDraft || !dkPlanDraft.b) return; dkPlanDraft.b.pointType = el.value; dkPlanRerenderCurrent(); };
  A.CH['dkrp-cat-a'] = el => { if (!dkPlanDraft || !dkPlanDraft.a) return; dkPlanDraft.a.cat = el.value; dkPlanRerenderCurrent(); };
  A.CH['dkrp-cat-b'] = el => { if (!dkPlanDraft || !dkPlanDraft.b) return; dkPlanDraft.b.cat = el.value; dkPlanRerenderCurrent(); };
  A.IN['dkrp-reason'] = el => { if (dkPlanDraft) dkPlanDraft.reason = el.value; };
  A.IN['dkrp-note'] = el => { if (dkPlanDraft) dkPlanDraft.note = el.value; };
  A.ACT['dkplan-file-pick'] = () => {
    if (!dkPlanDraft) return;
    const old = A.$('#dkplan-file-input'); if (old) old.remove();
    const input = document.createElement('input');
    input.type = 'file'; input.id = 'dkplan-file-input'; input.accept = 'image/*,.pdf'; input.style.display = 'none';
    input.addEventListener('change', () => {
      if (input.files && input.files[0] && dkPlanDraft) { dkPlanDraft.files.push(input.files[0].name); dkPlanRerenderCurrent(); }
      input.remove();
    });
    document.body.appendChild(input);
    input.click();
  };
  A.ACT['dkplan-file-remove'] = el => {
    if (!dkPlanDraft) return;
    dkPlanDraft.files.splice(Number(el.dataset.idx), 1);
    dkPlanRerenderCurrent();
  };

  // ---- Form "+ Lập yêu cầu tách điểm" (LUỒNG A — BQL chủ động, mục 3/4 yêu cầu) ----
  // Điểm KHÔNG hiển thị nếu đã tách rồi (structuralStatus 'SPLIT') — 1 điểm chỉ tách được 1 lần
  // trong V1 (không có nghiệp vụ tách điểm đã tách).
  function dksrEligibleStalls() {
    return A.db.stalls.filter(s => s.market === 'CL' && s.structuralStatus !== 'SPLIT').sort((a, b) => a.code.localeCompare(b.code));
  }
  function dksrPointInfoHtml(st) {
    const m = U.market('CL');
    const fl = m.floors.find(x => x.id === st.floor);
    const t = st.traderId ? A.idx.trader.get(st.traderId) : null;
    const c = st.contractId ? A.idx.contract.get(st.contractId) : null;
    const left = c ? U.days(U.today(), c.end) : null;
    return `<dl class="kv">
        <dt>Mã điểm</dt><dd>${st.code}</dd>
        <dt>Vị trí</dt><dd>${U.esc(fl ? fl.name : '')} → ${U.esc(st.sectionName)}</dd>
        <dt>Khu vực / quy hoạch</dt><dd>${U.esc(st.sectionName)} (${U.esc(dkZoneAllowedCats(st).join(', '))})</dd>
        <dt>Diện tích</dt><dd>${st.area.toLocaleString('vi-VN')} m²</dd>
        <dt>Loại điểm</dt><dd>${U.esc(dkPointTypeLabel(st))}</dd>
        <dt>Ngành hàng hiện tại</dt><dd>${U.esc(st.cat) || 'Chưa có thông tin'}</dd>
        <dt>Trạng thái</dt><dd>${U.statusTag(st.status)}</dd>
        <dt>Người thuê</dt><dd>${t ? U.esc(t.name) : 'Chưa có'}</dd>
        <dt>Hợp đồng hiện hành</dt><dd>${c ? c.id : 'Chưa có hợp đồng hiệu lực'}</dd>
        ${c ? `<dt>Thời hạn</dt><dd>${U.dmy(c.start)} – ${U.dmy(c.end)}${left != null ? ` (còn ${left} ngày)` : ''}</dd>` : ''}
      </dl>
      ${c && c.status === 'hieuluc' ? `<div class="note" style="margin-top:8px">Điểm đang có hợp đồng hiệu lực. Việc lập yêu cầu tách không tự động thay đổi hợp đồng. Cần kiểm tra và xử lý ảnh hưởng hợp đồng trước khi thực hiện thay đổi cấu trúc.</div>` : ''}`;
  }
  function dksrFormHtml() {
    const eligible = dksrEligibleStalls();
    const st = dkPlanDraft.stallId ? A.idx.stall.get(dkPlanDraft.stallId) : null;
    return `<div class="drawer-h"><div><h3>Lập yêu cầu tách điểm</h3><div class="small muted" style="margin-top:2px">Chợ Cao Lãnh</div></div><span class="spacer"></span>
        <button class="x" data-act="close" aria-label="Đóng">×</button></div>
      <div class="drawer-b">
        <div class="field"><label>Điểm kinh doanh cần tách *</label><select class="input" data-ch="dksr-point"><option value="">— Chọn điểm —</option>${eligible.map(s => `<option value="${s.id}" ${dkPlanDraft.stallId === s.id ? 'selected' : ''}>${s.code} · ${U.esc(s.sectionName)} · ${s.area.toLocaleString('vi-VN')} m²</option>`).join('')}</select></div>
        ${st ? `<div style="margin-top:10px">${dksrPointInfoHtml(st)}</div>
          <div class="divider"></div>
          <div class="small muted" style="margin-bottom:6px">Phương án tách</div>
          ${dkPlanFieldsHtml(st, dkZoneAllowedCats(st))}
          <div class="divider"></div>
          <div class="field"><label>Lý do đề xuất *</label><textarea class="input" rows="2" data-in="dkrp-reason">${U.esc(dkPlanDraft.reason)}</textarea></div>
          <div class="field" style="margin-top:10px"><label>Ghi chú</label><textarea class="input" rows="2" data-in="dkrp-note">${U.esc(dkPlanDraft.note)}</textarea></div>
          ${dkPlanFilesHtml()}
          <div class="row" style="justify-content:flex-end;margin-top:14px">
            <button class="btn" data-act="dksr-cancel">Hủy</button>
            <button class="btn primary" data-act="dksr-save">Lưu yêu cầu</button>
          </div>` : '<div class="small muted" style="margin-top:10px">Chọn 1 điểm kinh doanh để xem thông tin và lập phương án tách.</div>'}
      </div>`;
  }
  function dksrRerender() { ycSetModal(`<div class="drawer-overlay" data-act="close"></div><div class="drawer drawer-yc">${dksrFormHtml()}</div>`); }
  // "+ Lập yêu cầu tách điểm" dùng CHUNG 1 nút cho cả Luồng 2 (NV BQL tự lập ĐỦ phương án) và Luồng 3
  // (Trưởng BQL chỉ đề xuất + giao việc, mục 3 yêu cầu bổ sung) — form nào hiện ra do PERMISSION
  // quyết định, KHÔNG hard-code role: có 'tiep-nhan' (tự làm được phần kỹ thuật) → form đầy đủ; nếu
  // không nhưng có 'assign' → form đề xuất/giao việc nhẹ. Ưu tiên 'tiep-nhan' trước vì đó là năng lực
  // rộng hơn (đã đủ để tự hoàn thiện phương án thì không cần đi qua bước giao việc trung gian).
  A.ACT['dksr-open'] = () => {
    const canFull = A.canDo('diem-kd.tach-diem.tiep-nhan', 'CL');
    const canAssign = A.canDo('diem-kd.tach-diem.assign', 'CL');
    if (!A.canDo('diem-kd.tach-diem.lap-yeu-cau', 'CL') && !canAssign) return;
    A.drawerReset();
    if (!canFull && canAssign) { A.ACT['dkma-open'](); return; }
    dkPlanMode = 'create'; dkReqPlanEditId = null;
    dkPlanDraft = { stallId: null, a: null, b: null, reason: '', note: '', files: [] };
    dksrRerender();
    A.render();
  };
  A.CH['dksr-point'] = el => {
    if (!dkPlanDraft) return;
    const st = el.value ? A.idx.stall.get(el.value) : null;
    dkPlanDraft.stallId = st ? st.id : null;
    if (st) { const d = dksrPlanDefaults(st); dkPlanDraft.a = d.a; dkPlanDraft.b = d.b; } else { dkPlanDraft.a = null; dkPlanDraft.b = null; }
    dksrRerender();
  };
  A.ACT['dksr-cancel'] = () => { dkPlanMode = null; dkPlanDraft = null; A.closeModal(); A.render(); };
  A.ACT['dksr-save'] = () => {
    if (!A.canDo('diem-kd.tach-diem.lap-yeu-cau', 'CL')) return;
    if (!dkPlanDraft || !dkPlanDraft.stallId) { U.toast('Vui lòng chọn điểm kinh doanh cần tách'); return; }
    const st = A.idx.stall.get(dkPlanDraft.stallId);
    if (!st || st.market !== 'CL' || st.structuralStatus === 'SPLIT') { U.toast('Điểm kinh doanh không hợp lệ để lập yêu cầu tách'); return; }
    const reason = (dkPlanDraft.reason || '').trim();
    if (!reason) { U.toast('Vui lòng nhập lý do đề xuất'); return; }
    if (!dkPlanDraft.a || !dkPlanDraft.b || !(dkPlanDraft.a.area > 0) || !(dkPlanDraft.b.area > 0)) { U.toast('Vui lòng nhập diện tích hợp lệ cho cả 2 điểm mới'); return; }
    const total = +(dkPlanDraft.a.area + dkPlanDraft.b.area).toFixed(1);
    if (Math.abs(total - st.area) > 0.05) { U.toast(`Tổng diện tích (${total} m²) phải bằng đúng diện tích điểm nguồn (${st.area} m²)`); return; }
    const acc = A.currentAccount(), actorName = acc ? acc.fullName : 'Không rõ', nowAt = U.dmy(U.today());
    const r = {
      id: dkReqNextId(), type: 'SPLIT', market: 'CL', pointId: st.id, source: 'STAFF',
      requestedByName: actorName, requestedByTraderId: null,
      // Nhân viên tự lập ĐỦ phương án ngay khi tạo (Luồng 2) → người khởi tạo = người xử lý luôn,
      // không cần bước giao việc riêng (mục 2/5 yêu cầu bổ sung).
      createdBy: acc ? acc.id : null, assignedTo: acc ? acc.id : null,
      requestedAt: A.db.today,
      reason, note: (dkPlanDraft.note || '').trim(), attachments: dkPlanDraft.files.map(name => ({ name })),
      status: 'STAFF_REVIEW',
      plan: { a: Object.assign({}, dkPlanDraft.a), b: Object.assign({}, dkPlanDraft.b) },
      timeline: [{ key: 'created', at: nowAt, by: actorName }],
      resultPointIds: null
    };
    A.db.pointRequests.push(r);
    U.log(`Lập yêu cầu tách điểm ${st.code} (${r.id})`);
    A.save();
    dkPlanMode = null; dkPlanDraft = null;
    A.closeModal();
    A.render();
    A.ACT['cl-req-open']();
    U.toast('Đã lưu yêu cầu tách điểm ' + st.code + ' (' + r.id + ')');
  };

  // ---- Form "Đề xuất tách điểm" (LUỒNG 3 — Trưởng BQL chủ động đề xuất, mục 3 yêu cầu bổ sung) ----
  // KHÁC hẳn dksrFormHtml (Luồng 2): KHÔNG bắt nhập phương án kỹ thuật (diện tích/loại điểm/ngành
  // hàng của 2 điểm mới) — chỉ chọn điểm cần xem xét + lý do/nội dung chỉ đạo + chọn người xử lý.
  // State tạm riêng (dkAssignDraft) — KHÔNG dùng chung dkPlanDraft vì hình dạng dữ liệu khác hẳn
  // (không có a/b, có thêm assignedTo/note giao việc).
  let dkAssignDraft = null; // { stallId, reason, assignedTo, note }
  // Danh sách người xử lý hợp lệ để chọn ở mục C (mục 3 yêu cầu bổ sung): ACTIVE + marketScopes chứa
  // CL + có đúng permission "tiếp nhận/xử lý yêu cầu tách điểm" — lọc ĐỘNG qua permission engine
  // (A.PERM.canAction theo role thật của từng account), KHÔNG lọc cứng theo tên role.
  function dkAssignCandidates() {
    return A.ACCOUNTS.list().filter(a => a.status === 'active'
      && A.allowedMarkets(a).indexOf('CL') !== -1
      && A.PERM.canAction(A.ACCOUNTS.primaryRole(a), 'diem-kd.tach-diem.tiep-nhan'));
  }
  function dkmaFormHtml() {
    const st = dkAssignDraft.stallId ? A.idx.stall.get(dkAssignDraft.stallId) : null;
    const candidates = dkAssignCandidates();
    return `<div class="drawer-h"><div><h3>Đề xuất tách điểm</h3><div class="small muted" style="margin-top:2px">Chợ Cao Lãnh</div></div><span class="spacer"></span>
        <button class="x" data-act="close" aria-label="Đóng">×</button></div>
      <div class="drawer-b">
        <div class="small muted" style="margin:-4px 0 12px">A. Điểm cần xem xét tách</div>
        <div class="field"><label>Điểm kinh doanh *</label><select class="input" data-ch="dkma-point"><option value="">— Chọn điểm —</option>${dksrEligibleStalls().map(s => `<option value="${s.id}" ${dkAssignDraft.stallId === s.id ? 'selected' : ''}>${s.code} · ${U.esc(s.sectionName)} · ${s.area.toLocaleString('vi-VN')} m²</option>`).join('')}</select></div>
        ${st ? `<div style="margin-top:10px">${dksrPointInfoHtml(st)}</div>
          <div class="divider"></div>
          <div class="small muted" style="margin-bottom:6px">B. Nội dung đề xuất</div>
          <div class="field"><label>Lý do / nội dung chỉ đạo *</label><textarea class="input" rows="3" data-in="dkma-reason" placeholder="Ví dụ: Đề nghị kiểm tra khả năng tách ${U.esc(st.code)} thành các điểm kinh doanh nhỏ hơn để phục vụ phương án bố trí mặt bằng kỳ tiếp theo.">${U.esc(dkAssignDraft.reason)}</textarea></div>
          <div class="divider"></div>
          <div class="small muted" style="margin-bottom:6px">C. Giao xử lý</div>
          ${candidates.length
            ? `<div class="field"><label>Người xử lý *</label><select class="input" data-ch="dkma-assignee"><option value="">— Chọn nhân viên —</option>${candidates.map(a => `<option value="${a.id}" ${dkAssignDraft.assignedTo === a.id ? 'selected' : ''}>${U.esc(a.fullName)}${a.title ? ' · ' + U.esc(a.title) : ''}</option>`).join('')}</select></div>
               <div class="field" style="margin-top:10px"><label>Ghi chú giao việc</label><textarea class="input" rows="2" data-in="dkma-note">${U.esc(dkAssignDraft.note)}</textarea></div>`
            : '<div class="note">Chưa có nhân viên nào đủ điều kiện xử lý yêu cầu tách điểm (Chợ Cao Lãnh). Vào "Tài khoản người dùng" để gán vai trò/phạm vi chợ phù hợp.</div>'}
          <div class="row" style="justify-content:flex-end;margin-top:14px">
            <button class="btn" data-act="dkma-cancel">Hủy</button>
            <button class="btn primary" data-act="dkma-save" ${candidates.length ? '' : 'disabled'}>Giao xử lý</button>
          </div>` : '<div class="small muted" style="margin-top:10px">Chọn 1 điểm kinh doanh để xem thông tin và đề xuất tách.</div>'}
      </div>`;
  }
  function dkmaRerender() { ycSetModal(`<div class="drawer-overlay" data-act="close"></div><div class="drawer drawer-yc">${dkmaFormHtml()}</div>`); }
  A.ACT['dkma-open'] = () => {
    if (!A.canDo('diem-kd.tach-diem.assign', 'CL')) return;
    A.drawerReset();
    dkAssignDraft = { stallId: null, reason: '', assignedTo: '', note: '' };
    dkmaRerender();
    A.render();
  };
  A.CH['dkma-point'] = el => {
    if (!dkAssignDraft) return;
    dkAssignDraft.stallId = el.value || null;
    dkmaRerender();
  };
  A.IN['dkma-reason'] = el => { if (dkAssignDraft) dkAssignDraft.reason = el.value; };
  A.IN['dkma-note'] = el => { if (dkAssignDraft) dkAssignDraft.note = el.value; };
  A.CH['dkma-assignee'] = el => { if (dkAssignDraft) dkAssignDraft.assignedTo = el.value; };
  A.ACT['dkma-cancel'] = () => { dkAssignDraft = null; A.closeModal(); A.render(); };
  A.ACT['dkma-save'] = () => {
    if (!A.canDo('diem-kd.tach-diem.assign', 'CL')) return;
    if (!dkAssignDraft || !dkAssignDraft.stallId) { U.toast('Vui lòng chọn điểm kinh doanh cần xem xét tách'); return; }
    const st = A.idx.stall.get(dkAssignDraft.stallId);
    if (!st || st.market !== 'CL' || st.structuralStatus === 'SPLIT') { U.toast('Điểm kinh doanh không hợp lệ để đề xuất tách'); return; }
    const reason = (dkAssignDraft.reason || '').trim();
    if (!reason) { U.toast('Vui lòng nhập lý do / nội dung chỉ đạo'); return; }
    const assignee = dkAssignDraft.assignedTo ? A.ACCOUNTS.get(dkAssignDraft.assignedTo) : null;
    // Re-check ĐÚNG điều kiện đã dùng để lọc dropdown (mục 3 yêu cầu bổ sung) — không chỉ tin dữ liệu
    // <option> đã render, phòng trường hợp account vừa bị khoá/đổi quyền giữa lúc mở form.
    if (!assignee || assignee.status !== 'active' || A.allowedMarkets(assignee).indexOf('CL') === -1
      || !A.PERM.canAction(A.ACCOUNTS.primaryRole(assignee), 'diem-kd.tach-diem.tiep-nhan')) {
      U.toast('Vui lòng chọn người xử lý hợp lệ'); return;
    }
    const acc = A.currentAccount(), actorName = acc ? acc.fullName : 'Không rõ', nowAt = U.dmy(U.today());
    const r = {
      id: dkReqNextId(), type: 'SPLIT', market: 'CL', pointId: st.id, source: 'MANAGER',
      requestedByName: actorName, requestedByTraderId: null,
      createdBy: acc ? acc.id : null, assignedTo: assignee.id,
      requestedAt: A.db.today,
      reason, note: (dkAssignDraft.note || '').trim(), attachments: [],
      status: 'STAFF_REVIEW',
      plan: null, // Trưởng BQL KHÔNG tự lập phương án kỹ thuật khi tạo đề xuất (mục 3 yêu cầu bổ sung)
      timeline: [
        { key: 'created', at: nowAt, by: actorName },
        { key: 'assigned', at: nowAt, by: actorName, note: 'Giao ' + assignee.fullName + ' xử lý' }
      ],
      resultPointIds: null
    };
    A.db.pointRequests.push(r);
    U.log(`Đề xuất tách điểm ${st.code}, giao ${assignee.fullName} xử lý (${r.id})`);
    A.save();
    dkAssignDraft = null;
    A.closeModal();
    A.render();
    A.ACT['cl-req-open']();
    U.toast('Đã giao ' + assignee.fullName + ' xử lý đề xuất tách điểm ' + st.code + ' (' + r.id + ')');
  };

  // ---- Drawer "Xem" 1 yêu cầu — bố cục A-D (mục 9 yêu cầu) ----
  function dkReqActionsHtml(r) {
    if (r.type === 'MERGE') return dkMergeReqActionsHtml(r);
    if (r.type === 'CONVERT') return dkConvertReqActionsHtml(r);
    if (dkReqRejectId === r.id) return '';
    const btns = [];
    // Nhãn nút theo NỘI DUNG thật (đã có phương án hay chưa), không theo status/source — đúng cho cả
    // 3 nguồn: TRADER/MANAGER mới tạo chưa có `plan` (kể cả khi đã ở STAFF_REVIEW, vd MANAGER giao
    // việc xong) đều hiện "Tiếp nhận & hoàn thiện phương án"; đã có `plan` rồi thì hiện "Sửa phương
    // án" (mục 11 yêu cầu bổ sung — action phụ thuộc business state thật, không chỉ status enum).
    if (dkReqCanAccept(r)) {
      btns.push(`<button class="btn sm primary" data-act="dkreq-accept" data-id="${r.id}">Tiếp nhận xử lý</button>`);
    }
    if (r.status === 'STAFF_REVIEW' && dkReqOwnedByCurrent(r) && A.canDo('diem-kd.tach-diem.tiep-nhan', r.market)) {
      btns.push(`<button class="btn sm" data-act="dkreq-plan-open" data-id="${r.id}">${!r.plan ? 'Lập phương án' : 'Sửa phương án'}</button>`);
    }
    // r.plan bắt buộc phải có mới cho gửi (mục 11 yêu cầu bổ sung — action phụ thuộc business state
    // thật): request nguồn MANAGER mới tạo/giao việc luôn có `plan: null`, nút "Gửi phê duyệt" chỉ
    // nên xuất hiện sau khi NV BQL đã hoàn thiện phương án, tránh dẫn tới màn hình báo lỗi cụt.
    if (r.status === 'STAFF_REVIEW' && r.plan && dkReqOwnedByCurrent(r) && A.canDo('diem-kd.tach-diem.gui-phe-duyet', r.market)) {
      btns.push(`<button class="btn sm primary" data-act="dkreq-submit" data-id="${r.id}">Gửi phê duyệt</button>`);
    }
    if (r.status === 'PENDING_APPROVAL' && A.canDo('diem-kd.tach-diem.phe-duyet', r.market)) {
      // Mục 9 yêu cầu bổ sung: request nguồn MANAGER ghi rõ "Phê duyệt phương án" — phân biệt với
      // "Trưởng BQL đề xuất" (bước tạo) để không hiểu lầm là "tự phê duyệt đề xuất của chính mình".
      btns.push(`<button class="btn sm primary" data-act="dkreq-approve" data-id="${r.id}">${r.source === 'MANAGER' ? 'Phê duyệt phương án' : 'Phê duyệt'}</button>`);
      btns.push(`<button class="btn sm danger" data-act="dkreq-reject-open" data-id="${r.id}">Từ chối</button>`);
    }
    if (r.status === 'APPROVED' && dkReqOwnedByCurrent(r) && A.canDo('diem-kd.tach-diem.thuc-hien', r.market)) {
      btns.push(`<button class="btn sm primary" data-act="dkreq-execute" data-id="${r.id}">Thực hiện tách điểm</button>`);
    }
    return btns.join('');
  }
  function dkReqRejectBoxHtml(r) {
    if (dkReqRejectId !== r.id) return '';
    return `<div class="note" style="margin:10px 0">
      <div class="field"><label>Lý do từ chối *</label><textarea class="input" rows="2" data-in="dkreq-reject-reason">${U.esc(dkRejectReasonDraft)}</textarea></div>
      <div class="row" style="justify-content:flex-end;margin-top:8px">
        <button class="btn sm" data-act="dkreq-reject-cancel" data-id="${r.id}">Hủy</button>
        <button class="btn sm danger" data-act="dkreq-reject-save" data-id="${r.id}">Xác nhận từ chối</button>
      </div></div>`;
  }
  function dkReqPlanHtml(r, st) {
    if (!r.plan) return '<div class="small muted">Chưa có phương án tách. Nhân viên phụ trách đang kiểm tra và hoàn thiện phương án.</div>';
    const total = +(r.plan.a.area + r.plan.b.area).toFixed(1);
    const srcArea = st ? st.area : total;
    const ok = Math.abs(total - srcArea) < 0.05;
    const typeLabel = k => D.POINT_TYPE[k] ? D.POINT_TYPE[k].label : k;
    const resultLinks = r.resultPointIds && r.resultPointIds.length
      ? `<div class="row" style="margin-top:8px;gap:6px;justify-content:center">${r.resultPointIds.map(id => { const s2 = A.idx.stall.get(id); return s2 ? `<button class="btn sm" data-act="dkreq-view-point" data-id="${r.id}" data-point="${s2.id}">Xem ${s2.code}</button>` : ''; }).join('')}</div>`
      : '';
    return `<div class="split-plan">
      <div class="split-box"><div class="small muted">Điểm nguồn</div><b>${st ? st.code : r.pointId}</b><div class="small muted">${srcArea.toLocaleString('vi-VN')} m²</div></div>
      <div class="split-arrow">↓ Tách</div>
      <div class="split-result">
        <div class="split-box"><div class="small muted">Điểm mới 1</div><b>${U.esc(r.plan.a.code)}</b><div class="small muted">${r.plan.a.area.toLocaleString('vi-VN')} m²</div><div class="small muted">${U.esc(typeLabel(r.plan.a.pointType))} · ${U.esc(r.plan.a.cat)}</div></div>
        <div class="split-box"><div class="small muted">Điểm mới 2</div><b>${U.esc(r.plan.b.code)}</b><div class="small muted">${r.plan.b.area.toLocaleString('vi-VN')} m²</div><div class="small muted">${U.esc(typeLabel(r.plan.b.pointType))} · ${U.esc(r.plan.b.cat)}</div></div>
      </div>
      <div class="small" style="font-weight:600;color:${ok ? '#167a3c' : '#b01c1e'}">Tổng diện tích: ${total.toLocaleString('vi-VN')} / ${srcArea.toLocaleString('vi-VN')} m² ${ok ? '✓' : '(chênh lệch ' + Math.abs(total - srcArea).toFixed(1) + ' m²)'}</div>
      ${resultLinks}
    </div>`;
  }
  function dkReqDetailHtml(r) {
    if (r.type === 'MERGE') return dkMergeReqDetailHtml(r);
    if (r.type === 'CONVERT') return dkConvertReqDetailHtml(r);
    const st = A.idx.stall.get(r.pointId);
    const t = st && st.traderId ? A.idx.trader.get(st.traderId) : null;
    const c = st && st.contractId ? A.idx.contract.get(st.contractId) : null;
    const canXemHoSo = st && A.canDo('so-do.xem-ho-so', st.market);
    return `<div class="drawer-h detail-form-head" style="flex-wrap:wrap"><div><h3>${r.id}</h3><div class="small muted" style="margin-top:2px">${dkReqStatusTag(r.status)}</div></div><span class="spacer"></span>
        <div class="row" style="gap:6px">${dkReqActionsHtml(r)}</div>
        <button class="x" data-act="close" aria-label="Đóng">×</button></div><div class="detail-form-tabs">${U.icon('file')} Chi tiết yêu cầu thay đổi điểm</div>
      <div class="drawer-b request-detail-body">
        ${dkReqRejectBoxHtml(r)}
        <div class="small muted" style="margin:-4px 0 12px">A. Thông tin yêu cầu</div>
        <dl class="kv">
          <dt>Mã yêu cầu</dt><dd>${r.id}</dd>
          <dt>Loại yêu cầu</dt><dd>Tách điểm kinh doanh</dd>
          <dt>Nguồn đề nghị</dt><dd>${dkReqSourceLabel(r.source)}</dd>
          <dt>Người đề nghị</dt><dd>${U.esc(r.requestedByName)}</dd>
          <dt>Ngày đề nghị</dt><dd>${U.dmy(r.requestedAt)}</dd>
          <dt>Người phụ trách</dt><dd>${U.esc(dkReqAssigneeName(r))}</dd>
          <dt>Lý do</dt><dd>${U.esc(r.reason) || 'Chưa ghi nhận'}</dd>
          ${r.note ? `<dt>Ghi chú</dt><dd>${U.esc(r.note)}</dd>` : ''}
          ${r.attachments && r.attachments.length ? `<dt>Tài liệu kèm theo</dt><dd>${r.attachments.map(a => U.esc(a.name)).join(', ')}</dd>` : ''}
        </dl>
        <div class="divider"></div>
        <div class="small muted" style="margin-bottom:6px">NGƯỜI PHỤ TRÁCH</div>
        <dl class="kv"><dt>Người phụ trách</dt><dd>${U.esc(dkReqAssigneeName(r))}</dd><dt>Vai trò</dt><dd>${r.assignedTo && A.ACCOUNTS.get(r.assignedTo) ? U.esc(A.ACCOUNTS.get(r.assignedTo).title || 'Nhân viên BQL') : 'Chưa phân công'}</dd><dt>Nhận xử lý lúc</dt><dd>${(r.timeline || []).find(x => x.key === 'received') ? U.esc((r.timeline || []).find(x => x.key === 'received').at) : 'Chưa tiếp nhận'}</dd><dt>Trạng thái trách nhiệm</dt><dd>${U.esc(dkReqResponsibilityText(r))}</dd></dl>
        <div class="divider"></div>
        <div class="small muted" style="margin-bottom:6px">B. Điểm kinh doanh hiện tại</div>
        ${st ? `<dl class="kv">
          <dt>Mã điểm</dt><dd>${st.code}</dd>
          <dt>Vị trí</dt><dd>${U.esc((U.market('CL').floors.find(fl => fl.id === st.floor) || {}).name || '')} → ${U.esc(st.sectionName)}</dd>
          <dt>Khu vực</dt><dd>${U.esc(st.sectionName)}</dd>
          <dt>Diện tích</dt><dd>${st.area.toLocaleString('vi-VN')} m²</dd>
          <dt>Người thuê</dt><dd>${t ? U.esc(t.name) : 'Chưa có'}</dd>
          <dt>Hợp đồng hiện hành</dt><dd>${c ? c.id : 'Chưa có hợp đồng hiệu lực'}</dd>
          <dt>Trạng thái</dt><dd>${U.statusTag(st.status)}${st.structuralStatus === 'SPLIT' ? ' <span class="tag purple">Đã tách</span>' : ''}</dd>
        </dl>
        ${c && c.status === 'hieuluc' ? `<div class="note" style="margin-top:8px">Điểm đang có hợp đồng hiệu lực. Việc lập/thực hiện yêu cầu tách không tự động thay đổi hợp đồng. Cần kiểm tra và xử lý ảnh hưởng hợp đồng trước khi thực hiện thay đổi cấu trúc.</div>` : ''}
        <div class="row" style="margin-top:8px;gap:6px">
          <button class="btn sm" data-act="dkreq-view-point" data-id="${r.id}" data-point="${st.id}">Xem chi tiết điểm kinh doanh</button>
          ${t && canXemHoSo ? `<button class="btn sm" data-act="dkreq-view-trader" data-id="${r.id}" data-trader="${t.id}" data-point="${st.id}">Xem hồ sơ tiểu thương</button>` : ''}
        </div>` : '<div class="note">Điểm kinh doanh nguồn không còn tồn tại.</div>'}
        <div class="divider"></div>
        <div class="small muted" style="margin-bottom:6px">C. Phương án tách</div>
        ${dkReqPlanHtml(r, st)}
        <div class="divider"></div>
        <div class="small muted" style="margin-bottom:6px">D. Quá trình xử lý</div>
        ${dkReqTimelineHtml(r)}
      </div>`;
  }
  function dkReqPlanEditHtml(r) {
    const st = A.idx.stall.get(r.pointId);
    return `<div class="drawer-h"><div><h3>${r.id}</h3><div class="small muted" style="margin-top:2px">Hoàn thiện phương án tách điểm</div></div><span class="spacer"></span>
        <button class="x" data-act="close" aria-label="Đóng">×</button></div>
      <div class="drawer-b">
        ${dkPlanFieldsHtml(st, dkZoneAllowedCats(st))}
        <div class="divider"></div>
        <div class="field"><label>Lý do đề xuất *</label><textarea class="input" rows="2" data-in="dkrp-reason">${U.esc(dkPlanDraft.reason)}</textarea></div>
        <div class="field" style="margin-top:10px"><label>Ghi chú</label><textarea class="input" rows="2" data-in="dkrp-note">${U.esc(dkPlanDraft.note)}</textarea></div>
        ${dkPlanFilesHtml()}
        <div class="row" style="justify-content:flex-end;margin-top:14px">
          <button class="btn" data-act="dkreq-plan-cancel" data-id="${r.id}">Hủy</button>
          <button class="btn primary" data-act="dkreq-plan-save" data-id="${r.id}">Lưu phương án</button>
        </div>
      </div>`;
  }
  // Vẽ lại ĐÚNG drawer chi tiết yêu cầu đang mở — dùng chung cho: mở lần đầu, VIEW ↔ sửa phương án,
  // sau mỗi mutation (gửi/phê duyệt/từ chối/thực hiện) — giữ nguyên "← Quay lại" (nếu có) qua
  // A.drawerBackHtml() vì đây luôn là vẽ lại CHÍNH drawer hiện tại, không phải mở mới/drill-down.
  function dkReqRerenderDrawer(r) {
    const body = (dkPlanMode === 'complete' && dkReqPlanEditId === r.id) ? dkReqPlanEditHtml(r) : dkReqDetailHtml(r);
    ycSetModal(`<div class="drawer-overlay" data-act="close"></div><div class="drawer drawer-yc">${A.drawerBackHtml()}${body}</div>`);
  }
  // Click "Xem" ở bảng "Yêu cầu thay đổi" = mở drawer GỐC — reset navigation stack (mục 6/16 yêu
  // cầu: không hiện "← Quay lại" giả).
  A.ACT['dkreq-open'] = el => {
    const r = dkReqFind(el.dataset.id);
    if (!r) return;
    A.drawerReset();
    dkPlanMode = null; dkReqPlanEditId = null; dkPlanDraft = null; dkReqRejectId = null; dkRejectReasonDraft = '';
    dkReqRerenderDrawer(r);
    A.render();
  };
  // "Xem chi tiết điểm kinh doanh"/"Xem hồ sơ tiểu thương" NGAY TRONG drawer yêu cầu = mở drawer CON
  // — đẩy cách vẽ lại đúng drawer yêu cầu hiện tại vào navigation stack (label = mã yêu cầu) để "←
  // Quay lại YC-00xx" hoạt động đúng (mục 16 yêu cầu — không mất context, không phải tìm lại request).
  A.ACT['dkreq-view-point'] = el => {
    const r = dkReqFind(el.dataset.id), st = A.idx.stall.get(el.dataset.point);
    if (!r || !st) return;
    A.drawerPush(r.id, () => dkReqRerenderDrawer(r));
    A.openDkDrawer(st);
  };
  A.ACT['dkreq-view-trader'] = el => {
    const r = dkReqFind(el.dataset.id), st = A.idx.stall.get(el.dataset.point), t = A.idx.trader.get(el.dataset.trader);
    if (!r || !st || !t || !A.canDo('so-do.xem-ho-so', st.market)) return;
    A.drawerPush(r.id, () => dkReqRerenderDrawer(r));
    A.openTraderDrawer(t);
  };

  // ---- "Tiếp nhận & hoàn thiện phương án" (LUỒNG B) / "Sửa phương án" (mục 3 yêu cầu) ----
  A.ACT['dkreq-accept'] = el => {
    const r = dkReqFind(el.dataset.id), acc = A.currentAccount();
    if (!r || !acc || !dkReqCanAccept(r)) return;
    r.assignedTo = acc.id; r.status = 'STAFF_REVIEW';
    r.timeline.push({ key: 'received', at: U.dmy(U.today()), by: acc.fullName });
    A.save();
    U.log(`Tiếp nhận yêu cầu tách điểm ${r.id} bởi ${acc.fullName}`);
    dkPlanMode = 'complete'; dkReqPlanEditId = r.id;
    const st = A.idx.stall.get(r.pointId), base = r.plan || dksrPlanDefaults(st);
    dkPlanDraft = { stallId: st.id, a: Object.assign({}, base.a), b: Object.assign({}, base.b), reason: r.reason || '', note: r.note || '', files: (r.attachments || []).map(x => x.name) };
    dkReqRerenderDrawer(r); A.render(); U.toast('Đã tiếp nhận xử lý yêu cầu.');
  };
  A.ACT['dkreq-plan-open'] = el => {
    const r = dkReqFind(el.dataset.id);
    if (!r || !dkReqOwnedByCurrent(r) || !A.canDo('diem-kd.tach-diem.tiep-nhan', r.market)) return;
    if (r.status !== 'STAFF_REVIEW') return;
    const st = A.idx.stall.get(r.pointId);
    if (!st) { U.toast('Điểm kinh doanh nguồn không còn tồn tại'); return; }
    const base = r.plan || dksrPlanDefaults(st);
    dkPlanMode = 'complete'; dkReqPlanEditId = r.id;
    dkPlanDraft = { stallId: st.id, a: Object.assign({}, base.a), b: Object.assign({}, base.b), reason: r.reason || '', note: r.note || '', files: (r.attachments || []).map(x => x.name) };
    dkReqRerenderDrawer(r);
  };
  A.ACT['dkreq-plan-cancel'] = el => {
    const r = dkReqFind(el.dataset.id);
    dkPlanMode = null; dkReqPlanEditId = null; dkPlanDraft = null;
    if (r) dkReqRerenderDrawer(r);
  };
  A.ACT['dkreq-plan-save'] = el => {
    const r = dkReqFind(el.dataset.id);
    if (!r || !dkReqOwnedByCurrent(r) || !A.canDo('diem-kd.tach-diem.tiep-nhan', r.market)) return;
    if (r.status !== 'STAFF_REVIEW') return;
    const st = A.idx.stall.get(r.pointId);
    if (!st || !dkPlanDraft) return;
    const reason = (dkPlanDraft.reason || '').trim();
    if (!reason) { U.toast('Vui lòng nhập lý do đề xuất'); return; }
    if (!(dkPlanDraft.a.area > 0) || !(dkPlanDraft.b.area > 0)) { U.toast('Vui lòng nhập diện tích hợp lệ cho cả 2 điểm mới'); return; }
    const total = +(dkPlanDraft.a.area + dkPlanDraft.b.area).toFixed(1);
    if (Math.abs(total - st.area) > 0.05) { U.toast(`Tổng diện tích (${total} m²) phải bằng đúng diện tích điểm nguồn (${st.area} m²)`); return; }
    const acc = A.currentAccount(), actorName = acc ? acc.fullName : 'Không rõ', nowAt = U.dmy(U.today());
    r.plan = { a: Object.assign({}, dkPlanDraft.a), b: Object.assign({}, dkPlanDraft.b) };
    r.reason = reason; r.note = (dkPlanDraft.note || '').trim();
    r.attachments = dkPlanDraft.files.map(name => ({ name }));
    // Không đổi assignedTo ở đây: người phụ trách đã được xác lập khi tự lập, được giao, hoặc tiếp nhận.
    const plannedEntry = r.timeline.find(x => x.key === 'planned');
    if (plannedEntry) { plannedEntry.at = nowAt; plannedEntry.by = actorName; } else r.timeline.push({ key: 'planned', at: nowAt, by: actorName });
    U.log(`Hoàn thiện phương án tách điểm ${st.code} (yêu cầu ${r.id})`);
    A.save();
    dkPlanMode = null; dkReqPlanEditId = null; dkPlanDraft = null;
    dkReqRerenderDrawer(r);
    A.render();
    U.toast('Đã lưu phương án tách điểm ' + st.code);
  };

  // ---- "Gửi phê duyệt" (mục 3 yêu cầu — chuyển STAFF_REVIEW → PENDING_APPROVAL) ----
  A.ACT['dkreq-submit'] = el => {
    const r = dkReqFind(el.dataset.id);
    if (!r || !dkReqOwnedByCurrent(r) || !A.canDo('diem-kd.tach-diem.gui-phe-duyet', r.market)) return;
    if (r.status !== 'STAFF_REVIEW') return;
    if (!r.plan) { U.toast('Chưa có phương án tách — cần hoàn thiện phương án trước khi gửi'); return; }
    const st = A.idx.stall.get(r.pointId);
    if (st) {
      const total = +(r.plan.a.area + r.plan.b.area).toFixed(1);
      if (Math.abs(total - st.area) > 0.05) { U.toast('Tổng diện tích phương án không khớp diện tích điểm nguồn, cần sửa lại trước khi gửi'); return; }
    }
    const acc = A.currentAccount(), actorName = acc ? acc.fullName : 'Không rõ';
    r.status = 'PENDING_APPROVAL';
    r.timeline.push({ key: 'submitted', at: U.dmy(U.today()), by: actorName });
    U.log(`Gửi yêu cầu tách điểm ${r.id} cho Trưởng Ban Quản lý phê duyệt`);
    A.save();
    dkReqRerenderDrawer(r);
    A.render();
    U.toast(`Yêu cầu tách điểm ${st ? st.code : r.pointId} đang chờ phê duyệt.`);
  };

  // ---- Phê duyệt / Từ chối (mục 10/12 yêu cầu — CHỈ market_manager, đổi trạng thái, KHÔNG tách
  // ngay) ----
  A.ACT['dkreq-approve'] = el => {
    const r = dkReqFind(el.dataset.id);
    if (!r || !A.canDo('diem-kd.tach-diem.phe-duyet', r.market)) return;
    if (r.status !== 'PENDING_APPROVAL') return;
    const acc = A.currentAccount(), actorName = acc ? acc.fullName : 'Không rõ';
    r.status = 'APPROVED';
    r.timeline.push({ key: 'approved', at: U.dmy(U.today()), by: actorName });
    U.log(`Phê duyệt yêu cầu tách điểm ${r.id}`);
    A.save();
    dkReqRerenderDrawer(r);
    A.render();
    const st = A.idx.stall.get(r.pointId);
    U.toast(`Yêu cầu tách điểm ${st ? st.code : r.pointId} đã được phê duyệt.`);
  };
  A.IN['dkreq-reject-reason'] = el => { dkRejectReasonDraft = el.value; };
  A.ACT['dkreq-reject-open'] = el => {
    const r = dkReqFind(el.dataset.id);
    if (!r || !A.canDo('diem-kd.tach-diem.phe-duyet', r.market)) return;
    if (r.status !== 'PENDING_APPROVAL') return;
    dkReqRejectId = r.id; dkRejectReasonDraft = '';
    dkReqRerenderDrawer(r);
  };
  A.ACT['dkreq-reject-cancel'] = el => {
    dkReqRejectId = null; dkRejectReasonDraft = '';
    const r = dkReqFind(el.dataset.id);
    if (r) dkReqRerenderDrawer(r);
  };
  A.ACT['dkreq-reject-save'] = el => {
    const r = dkReqFind(el.dataset.id);
    if (!r || !A.canDo('diem-kd.tach-diem.phe-duyet', r.market)) return;
    if (r.status !== 'PENDING_APPROVAL') return;
    const reason = (dkRejectReasonDraft || '').trim();
    if (!reason) { U.toast('Vui lòng nhập lý do từ chối'); return; }
    const acc = A.currentAccount(), actorName = acc ? acc.fullName : 'Không rõ';
    r.status = 'REJECTED';
    r.timeline.push({ key: 'approved', at: U.dmy(U.today()), by: actorName, note: 'Từ chối: ' + reason });
    U.log(`Từ chối yêu cầu tách điểm ${r.id} — lý do: ${reason}`);
    A.save();
    dkReqRejectId = null; dkRejectReasonDraft = '';
    dkReqRerenderDrawer(r);
    A.render();
    const st = A.idx.stall.get(r.pointId);
    U.toast(`Yêu cầu tách điểm ${st ? st.code : r.pointId} đã bị từ chối.`);
  };

  // ---- "Thực hiện tách điểm" (mục 13 yêu cầu — CHỈ khi APPROVED, re-check TOÀN BỘ điều kiện ngay
  // trong handler, KHÔNG chỉ dựa vào nút đã ẩn/hiện đúng ở UI) ----
  A.ACT['dkreq-execute'] = el => {
    const r = dkReqFind(el.dataset.id);
    if (!r) return;
    if (!dkReqOwnedByCurrent(r) || !A.canDo('diem-kd.tach-diem.thuc-hien', r.market)) { U.toast('Chỉ người phụ trách được thực hiện tách điểm.'); return; }
    if (r.status !== 'APPROVED') { U.toast('Yêu cầu chưa ở trạng thái Đã phê duyệt'); return; }
    if (!r.plan) { U.toast('Yêu cầu chưa có phương án tách hợp lệ'); return; }
    const st = A.idx.stall.get(r.pointId);
    if (!st || st.market !== 'CL') { U.toast('Điểm kinh doanh nguồn không còn tồn tại hoặc không thuộc Chợ Cao Lãnh'); return; } // điểm nguồn còn tồn tại + thuộc CL
    if (st.structuralStatus === 'SPLIT') { U.toast('Điểm này đã được tách trước đó'); return; }
    const codeA = r.plan.a.code, codeB = r.plan.b.code;
    if (A.db.stalls.some(s => s.market === st.market && (s.code === codeA || s.code === codeB))) { U.toast('Mã điểm mới đã tồn tại, không thể thực hiện'); return; } // mã điểm mới chưa tồn tại
    const total = +(r.plan.a.area + r.plan.b.area).toFixed(1);
    if (!(r.plan.a.area > 0) || !(r.plan.b.area > 0) || Math.abs(total - st.area) > 0.05) { U.toast('Tổng diện tích phương án không khớp diện tích điểm nguồn'); return; } // tổng diện tích hợp lệ
    const allowedCats = dkZoneAllowedCats(st);
    if (allowedCats.length && (allowedCats.indexOf(r.plan.a.cat) === -1 || allowedCats.indexOf(r.plan.b.cat) === -1)) { U.toast('Ngành hàng trong phương án không đúng quy hoạch khu vực'); return; } // ngành hàng phù hợp quy hoạch
    const acc = A.currentAccount(), actorName = acc ? acc.fullName : 'Không rõ';
    const mk = plan => ({
      id: st.market + '-' + plan.code, code: plan.code, market: st.market, floor: st.floor, section: st.section, sectionName: st.sectionName,
      row: null, num: null, type: st.type, areaType: st.areaType, pointType: plan.pointType, cat: plan.cat, area: plan.area, hasMeter: false, status: 'trong',
      traderId: null, sellerId: null, contractId: null,
      history: [`${U.dmy(U.today())}: Tách từ điểm ${st.code} theo yêu cầu ${r.id}`],
      parentPointId: st.id, splitRequestId: r.id
    });
    const a = mk(r.plan.a), b = mk(r.plan.b);
    A.db.stalls.push(a, b);
    A.idx.stall.set(a.id, a); A.idx.stall.set(b.id, b);
    // Proposed seller từ Mini App chỉ được sao chép thành bản ghi CHỜ XÁC MINH cho các điểm con;
    // không gán sellerId và không có đường nào tự động ACTIVE.
    if (r.proposedDirectSeller && r.proposedDirectSeller.fullName) {
      A.db.directSellerAssignments = A.db.directSellerAssignments || [];
      [a, b].forEach(child => A.db.directSellerAssignments.push({
        id: 'DSA-' + U.pad(A.db.directSellerAssignments.length + 1, 4), market: child.market, pointId: child.id,
        traderId: null, personId: null, fullName: r.proposedDirectSeller.fullName, idNumber: '', phone: '',
        relationship: 'Dự kiến sau tách điểm', startDate: U.today(), endDate: null, status: 'PENDING_VERIFICATION',
        source: 'SPLIT_PROPOSED', verifiedBy: null, verifiedAt: null, note: 'Sao chép từ thông tin dự kiến của yêu cầu ' + r.id,
        createdAt: U.today(), updatedAt: U.today()
      }));
    }
    st.structuralStatus = 'SPLIT'; // KHÔNG xoá bản ghi nguồn — vẫn giữ nguyên lịch sử (mục 13 yêu cầu)
    st.history = st.history || [];
    st.history.unshift(`${U.dmy(U.today())}: Tách điểm thành ${a.code} + ${b.code} theo yêu cầu ${r.id}${r.reason ? ' — Lý do: ' + r.reason : ''}`);
    const nowAt = U.dmy(U.today());
    r.status = 'COMPLETED'; // prototype đồng bộ (không có job nền thật) — timeline vẫn ghi đủ cả 2 mốc
    // 'implementing' lẫn 'completed' (mục 2/13 yêu cầu: Đã phê duyệt ≠ Đã hoàn thành tách vẫn phân
    // biệt rõ ở D. Quá trình xử lý, dù UI thực hiện gộp 1 click).
    r.resultPointIds = [a.id, b.id];
    r.timeline.push({ key: 'implementing', at: nowAt, by: actorName });
    r.timeline.push({ key: 'completed', at: nowAt, by: actorName });
    U.log(`Thực hiện tách điểm ${st.code} thành ${a.code}, ${b.code} (yêu cầu ${r.id})`);
    A.save();
    dkReqRerenderDrawer(r);
    A.render();
    U.toast(`Điểm ${st.code} đã được tách thành ${a.code} và ${b.code}.`);
  };

  // ---- Bảng "Yêu cầu thay đổi" + bộ lọc (mục 2 yêu cầu) ----
  function dkReqRowsCL() {
    const q = (f.dkreqSearch || '').trim().toLowerCase();
    const queryMatches = r => {
      if (!q || r.id.toLowerCase().includes(q)) return true;
      if (r.type === 'MERGE') return (r.sourcePointIds || []).some(id => { const s=A.idx.stall.get(id); return !!(s && s.code.toLowerCase().includes(q)); });
      if (r.type === 'CONVERT') return [r.fromPointId, r.toPointId].some(id => { const s = id && A.idx.stall.get(id); return !!(s && s.code.toLowerCase().includes(q)); });
      const s=A.idx.stall.get(r.pointId); return !!(s && s.code.toLowerCase().includes(q));
    };
    return A.db.pointRequests.filter(r => r.market === 'CL'
      && (!f.dkreqStatus || r.status === f.dkreqStatus)
      && (!f.dkreqSource || r.source === f.dkreqSource)
      && queryMatches(r))
      .sort((a, b) => b.id.localeCompare(a.id));
  }
  function dkReqHasFilter() { return !!(f.dkreqStatus || f.dkreqSource || (f.dkreqSearch && f.dkreqSearch.trim())); }
  function dkReqRowHtmlCL(r) {
    const st = A.idx.stall.get(r.pointId); const mergeCodes = r.type === 'MERGE' ? (r.sourcePointIds || []).map(id => { const x=A.idx.stall.get(id); return x?x.code:id; }).join(' + ') : '';
    const convertCodes = r.type === 'CONVERT' ? [r.fromPointId, r.toPointId].map(id => { const x = id && A.idx.stall.get(id); return x ? x.code : (id || '?'); }).join(' → ') : '';
    return `<tr class="click" data-act="dkreq-open" data-id="${r.id}">
      <td><b>${r.id}</b></td>
      <td>${r.type === 'MERGE' ? 'Gộp điểm' : r.type === 'CONVERT' ? 'Chuyển đổi vị trí' : 'Tách điểm'}</td>
      <td>${r.type === 'MERGE' ? mergeCodes : r.type === 'CONVERT' ? convertCodes : (st ? st.code : r.pointId)}</td>
      <td>${dkReqSourceLabel(r.source)}</td>
      <td>${U.esc(r.requestedByName)}</td>
      <td>${U.esc(dkReqAssigneeName(r))}</td>
      <td>${U.dmy(r.requestedAt)}</td>
      <td>${dkReqStatusTag(r.status)}${r.status === 'APPROVED' && dkReqOwnedByCurrent(r) ? '<div class="small muted">Chờ thực hiện</div>' : ''}</td>
      <td class="nowrap"><button class="btn sm" data-act="dkreq-open" data-id="${r.id}">Xem</button></td>
    </tr>`;
  }
  function dkRequestsViewCL() {
    const rows = dkReqRowsCL(), pg = U.pager('dkreq', rows.length, 25);
    return `<div class="card"><div class="card-h"><h3>Yêu cầu thay đổi điểm kinh doanh</h3>
      <select class="input" data-ch="dkreq-status"><option value="">Mọi trạng thái</option>${Object.keys(DKREQ_STATUS_LABEL).map(k => `<option value="${k}" ${f.dkreqStatus === k ? 'selected' : ''}>${DKREQ_STATUS_LABEL[k]}</option>`).join('')}</select>
      <select class="input" data-ch="dkreq-source"><option value="">Tất cả nguồn đề nghị</option><option value="TRADER" ${f.dkreqSource === 'TRADER' ? 'selected' : ''}>Tiểu thương</option><option value="STAFF" ${f.dkreqSource === 'STAFF' ? 'selected' : ''}>Nhân viên BQL</option><option value="MANAGER" ${f.dkreqSource === 'MANAGER' ? 'selected' : ''}>Trưởng BQL</option></select>
      <input class="input" placeholder="Mã yêu cầu / mã điểm" data-in="dkreq-search" value="${U.esc(f.dkreqSearch || '')}">
      <button class="btn" data-act="dkreq-clear" ${dkReqHasFilter() ? '' : 'disabled'}>↺ Xóa bộ lọc</button></div>
      <div class="card-b">${U.table([{ t: 'Mã yêu cầu' }, { t: 'Loại yêu cầu' }, { t: 'Mã điểm' }, { t: 'Nguồn đề nghị' }, { t: 'Người đề nghị' }, { t: 'Người phụ trách' }, { t: 'Ngày gửi' }, { t: 'Trạng thái' }, { t: 'Thao tác' }],
        rows.slice(pg.start, pg.end).map(dkReqRowHtmlCL), { empty: 'Chưa có yêu cầu thay đổi nào.' })}${pg.html}</div></div>`;
  }
  A.CH['dkreq-status'] = el => { f.dkreqStatus = el.value; ui.page.dkreq = 0; A.render(); };
  A.CH['dkreq-source'] = el => { f.dkreqSource = el.value; ui.page.dkreq = 0; A.render(); };
  A.IN['dkreq-search'] = el => { f.dkreqSearch = el.value; ui.page.dkreq = 0; A.render(); };
  A.ACT['dkreq-clear'] = () => { f.dkreqStatus = ''; f.dkreqSource = ''; f.dkreqSearch = ''; ui.page.dkreq = 0; A.render(); };

  // MAT_BANG_KHU_TANG_DAY_REDESIGN (bản cập nhật cuối): "Mặt bằng & điểm kinh doanh" là DUY NHẤT
  // 1 workspace với công tắc chế độ hiển thị "▦ Sơ đồ | ☰ Bảng" (A.mbWorkspaceHtml(), xem
  // js/v-cautruc.js) — KHÔNG còn tab ngang hàng nào khác phía trên workspace này.
  // "Yêu cầu thay đổi" (Tách/Gộp/Chuyển đổi) đã bị loại bỏ hoàn toàn khỏi UI của màn này theo yêu
  // cầu mới nhất — không dời sang chỗ khác, không tạo menu mới cho nghiệp vụ này trong phạm vi màn
  // này. Toàn bộ logic nghiệp vụ (dkReq*/dkMerge*/dkConvert*, A.db.pointRequests, A.pointReq) GIỮ
  // NGUYÊN 100% vì js/mini.js (Mini App phía tiểu thương) vẫn tiêu thụ trực tiếp — xem khối
  // "API dùng chung cho Mini App" bên dưới. A.ACT['cl-req-open'] cũng được giữ nguyên (vẫn được
  // gọi nội bộ sau khi lưu tách/gộp/chuyển-đổi ở nơi khác) dù không còn nút nào trên màn này mở nó.
  function clLayoutView() {
    return A.mbWorkspaceHtml();
  }
  A.ACT['cl-req-open'] = () => { A.modal(A.mHead('Yêu cầu thay đổi điểm kinh doanh') + `<div class="modal-b">${dkRequestsViewCL()}</div>`, true); };

  // ---- API dùng chung cho Mini App (js/mini.js) — "TÁCH ĐIỂM tiểu thương gửi từ Mini App" ----
  // Expose ĐÚNG các hàm/hằng số nội bộ đã có của module này qua A.pointReq — KHÔNG tạo mảng dữ liệu
  // song song/schema riêng cho Mini App (mục 1 yêu cầu bổ sung): Mini App đọc/ghi thẳng
  // A.db.pointRequests qua các hàm này, cùng 1 nguồn sự thật với tab "Yêu cầu thay đổi" của Web BQL.
  //   find(id)      : tìm request theo id — TÁI DÙNG dkReqFind, không viết lại.
  //   nextId()      : sinh mã YC-xxxx tiếp theo — TÁI DÙNG dkReqNextId, đảm bảo Web/Mini App dùng
  //                   CHUNG 1 cơ chế sinh id (mục 8 yêu cầu bổ sung: "không tạo hai cơ chế khác nhau").
  //   ACTIVE_STATUSES: tập trạng thái được coi là "đang xử lý" (mục 4 yêu cầu bổ sung) — dùng để Mini
  //                   App chặn tạo request tách trùng cho cùng 1 điểm.
  //   isActive(r)   : true nếu request còn đang xử lý (chưa REJECTED/COMPLETED).
  //   activeFor(pointId): request SPLIT đang active của 1 điểm, null nếu không có.
  //   stepStates(r) : trạng thái từng bước timeline (done/current/rejected/pending), KHÔNG kèm label
  //                   — Mini App tự gắn nhãn thân thiện riêng (xem dkReqStepStates ở trên).
  const DKREQ_ACTIVE_STATUSES = new Set(['DRAFT', 'STAFF_REVIEW', 'PENDING_APPROVAL', 'APPROVED', 'IMPLEMENTING']);
  A.pointReq = {
    find: dkReqFind,
    nextId: dkReqNextId,
    ACTIVE_STATUSES: DKREQ_ACTIVE_STATUSES,
    isActive: r => !!r && DKREQ_ACTIVE_STATUSES.has(r.status),
    activeFor: pointId => A.db.pointRequests.find(r => r.type === 'SPLIT' && r.pointId === pointId && DKREQ_ACTIVE_STATUSES.has(r.status)) || null,
    stepStates: dkReqStepStates
  };

  // ==================== GỘP ĐIỂM — prototype row/num adjacency ====================
  // Rule này CHỈ phục vụ prototype: hai điểm cùng floor/section và num liền nhau trong cùng row.
  // Model không có geometry/span nên result point không được vẽ/hack vào floorplan.
  let dkMergeDraft = null;
  function dkMergeActiveConflict(id, exceptId) { return A.db.pointRequests.some(r => r.id !== exceptId && r.type && r.status !== 'REJECTED' && r.status !== 'COMPLETED' && ((r.sourcePointIds || []).indexOf(id) >= 0 || r.pointId === id)); }
  function dkMergeActive(st, exceptId) { return !!st && (!st.structuralStatus || st.structuralStatus === 'ACTIVE') && !dkMergeActiveConflict(st.id, exceptId); }
  function dkMergeCandidates(st) { return !st ? [] : A.db.stalls.filter(x => x.id !== st.id && x.market === 'CL' && x.floor === st.floor && x.section === st.section && dkMergeActive(x) && dkMergeActive(st) && x.row != null && st.row === x.row && x.num != null && Math.abs(x.num - st.num) === 1); }
  function dkMergeCode(a, b) { const ma=/^(.*-)(\d+)$/.exec(a.code), mb=/^(.*-)(\d+)$/.exec(b.code); return ma && mb && ma[1] === mb[1] ? ma[1] + [ma[2],mb[2]].sort((x,y)=>+x-+y).join('-') : [a.code,b.code].sort().join('-'); }
  function dkMergeSeller(st) { const a = dkDirectSellerActive(st); return a ? a.fullName : 'Chưa đăng ký'; }
  function dkMergeContractState(a,b) { if (!a.contractId && !b.contractId) return { resolved:true, blocking:false, text:'Không có hợp đồng đang hiệu lực.' }; if (a.traderId && a.traderId === b.traderId) return { resolved:false, blocking:false, text:'Hai điểm có hợp đồng hiệu lực. Cần xác nhận điều kiện hợp đồng trước khi thực hiện; Gộp không tự sửa/hợp nhất/chấm dứt hợp đồng.' }; return { resolved:false, blocking:true, text:'Các điểm có người sử dụng/hợp đồng khác nhau. Cần xử lý quan hệ sử dụng và hợp đồng trước khi thực hiện.' }; }
  function dkMergePointCard(st) { const t=st.traderId&&A.idx.trader.get(st.traderId), c=st.contractId&&A.idx.contract.get(st.contractId); return `<div class="split-box" style="text-align:left"><b>${st.code}</b><div class="small muted">${st.area} m² · ${U.esc(dkPointTypeLabel(st))}</div><div class="small">Chủ thể HĐ: ${t?U.esc(t.name):'Chưa có'}</div><div class="small">Trực tiếp KD: ${U.esc(dkMergeSeller(st))}</div><div class="small">HĐ: ${c?c.id:'Không có'}</div></div>`; }
  function dkMergeForm() { const d=dkMergeDraft, a=d.a?A.idx.stall.get(d.a):null, cs=dkMergeCandidates(a), b=d.b?A.idx.stall.get(d.b):null, manager=A.canDo('diem-kd.gop-diem.assign','CL')&&!A.canDo('diem-kd.gop-diem.tiep-nhan','CL'); const staff=A.ACCOUNTS.list(); return A.mHead('GỘP ĐIỂM KINH DOANH')+`<div class="modal-b"><div class="field"><label>A. Điểm thứ nhất *</label><select class="input" data-ch="dkmerge-a"><option value="">— Chọn điểm —</option>${A.db.stalls.filter(x=>x.market==='CL'&&dkMergeActive(x)&&x.row!=null).map(x=>`<option value="${x.id}" ${d.a===x.id?'selected':''}>${x.code}</option>`).join('')}</select></div>${a?`<div style="margin-top:10px">${dkMergePointCard(a)}</div><div class="divider"></div><b>B. Chọn điểm gộp cùng</b><div class="small muted">Chỉ hiển thị điểm liền kề cùng hàng/khu (quy tắc prototype).</div><div class="row" style="margin-top:8px;gap:8px;flex-wrap:wrap">${cs.length?cs.map(x=>`<button class="btn ${d.b===x.id?'primary':''}" data-act="dkmerge-b" data-id="${x.id}">${x.code} · ${x.area} m²</button>`).join(''):'<span class="note">Không có điểm liền kề phù hợp.</span>'}</div>`:''}${a&&b?`<div class="divider"></div><b>C. Kiểm tra hiện trạng</b><div class="split-result" style="margin-top:8px">${dkMergePointCard(a)}${dkMergePointCard(b)}</div><div class="note ${dkMergeContractState(a,b).resolved?'info':''}" style="margin-top:8px">${dkMergeContractState(a,b).resolved?'⚠ ':'⛔ '}${U.esc(dkMergeContractState(a,b).text)}</div><div class="divider"></div><b>D. Phương án gộp</b><div class="field" style="margin-top:8px"><label>Mã điểm dự kiến</label><input class="input" data-in="dkmerge-code" value="${U.esc(d.code||dkMergeCode(a,b))}"></div><div class="field"><label>Diện tích sau gộp</label><input class="input" value="${+(a.area+b.area).toFixed(1)} m²" disabled></div><div class="field"><label>Lý do gộp *</label><textarea class="input" data-in="dkmerge-reason">${U.esc(d.reason||'')}</textarea></div>${manager?`<div class="field"><label>Người phụ trách *</label><select class="input" data-ch="dkmerge-assignee"><option value="">— Chọn NV BQL —</option>${staff.filter(x=>x.status==='active'&&A.allowedMarkets(x).indexOf('CL')>=0&&A.PERM.canAction(A.ACCOUNTS.primaryRole(x),'diem-kd.gop-diem.tiep-nhan')).map(x=>`<option value="${x.id}" ${d.assignedTo===x.id?'selected':''}>${U.esc(x.fullName)}</option>`).join('')}</select></div>`:''}<div class="row" style="justify-content:flex-end;margin-top:12px"><button class="btn" data-act="close">Hủy</button><button class="btn primary" data-act="dkmerge-save">Lưu yêu cầu</button></div>`:''}</div>`; }
  A.CH['dkmerge-a']=el=>{dkMergeDraft.a=el.value;dkMergeDraft.b='';A.modal(dkMergeForm(),true);}; A.CH['dkmerge-assignee']=el=>{dkMergeDraft.assignedTo=el.value;}; A.IN['dkmerge-code']=el=>{dkMergeDraft.code=el.value;}; A.IN['dkmerge-reason']=el=>{dkMergeDraft.reason=el.value;};
  A.ACT['dkmerge-open']=()=>{if(!A.canDo('diem-kd.gop-diem.lap-yeu-cau','CL')&&!A.canDo('diem-kd.gop-diem.assign','CL'))return;dkMergeDraft={a:'',b:'',code:'',reason:'',assignedTo:''};A.modal(dkMergeForm(),true);}; A.ACT['dkmerge-b']=el=>{dkMergeDraft.b=el.dataset.id;A.modal(dkMergeForm(),true);};
  A.ACT['dkmerge-save']=()=>{const d=dkMergeDraft,a=A.idx.stall.get(d.a),b=A.idx.stall.get(d.b),acc=A.currentAccount(),manager=A.canDo('diem-kd.gop-diem.assign','CL')&&!A.canDo('diem-kd.gop-diem.tiep-nhan','CL');if(!acc||acc.status!=='active'||ui.market!=='CL'||A.allowedMarkets(acc).indexOf('CL')<0)return U.toast('Tài khoản hoặc phạm vi chợ không hợp lệ');if(!a||!b||!dkMergeCandidates(a).some(x=>x.id===b.id)||!d.reason.trim())return U.toast('Chọn hai điểm liền kề và nhập lý do');const assignee=manager?A.ACCOUNTS.get(d.assignedTo):acc;if(!assignee||assignee.status!=='active'||A.allowedMarkets(assignee).indexOf('CL')<0)return U.toast('Chọn người phụ trách hợp lệ');const cc=dkMergeContractState(a,b);const r={id:dkReqNextId(),type:'MERGE',market:'CL',source:manager?'MANAGER':'STAFF',sourcePointIds:[a.id,b.id],createdBy:acc.id,assignedTo:assignee.id,requestedByName:acc.fullName,requestedByTraderId:null,requestedAt:U.today(),reason:d.reason.trim(),note:'',attachments:[],status:'STAFF_REVIEW',plan:manager?null:{resultCode:(d.code||dkMergeCode(a,b)).trim(),resultArea:+(a.area+b.area).toFixed(1),pointType:a.pointType,category:a.cat,contractCondition:cc.resolved?'RESOLVED':'UNRESOLVED'},timeline:[{key:'created',at:U.dmy(U.today()),by:acc.fullName},{key:'assigned',at:U.dmy(U.today()),by:acc.fullName,note:'Giao '+assignee.fullName}],resultPointIds:[]};A.db.pointRequests.push(r);A.save();A.closeModal();A.render();A.ACT['cl-req-open']();};

  // Chi tiết/hành động MERGE tách riêng SPLIT nhưng dùng cùng request collection và status machine.
  let dkMergePlanEditId = null, dkMergePlanDraft = null;
  function dkMergeSources(r) { return (r.sourcePointIds || []).map(id => A.idx.stall.get(id)).filter(Boolean); }
  function dkMergeOwned(r) { const acc=A.currentAccount(); return !!(acc && r.assignedTo === acc.id); }
  function dkMergeTimeline(r) { const labels={created:'Tạo yêu cầu',assigned:'Phân công',received:'Tiếp nhận',planned:'Lập phương án',submitted:'Gửi phê duyệt',approved:'Phê duyệt',implementing:'Thực hiện gộp',completed:'Hoàn thành'}; return `<div class="timeline">${(r.timeline||[]).map(x=>`<div class="timeline-i"><b>${labels[x.key]||x.key}</b><div class="small muted">${U.esc(x.at||'')} · ${U.esc(x.by||'')}</div>${x.note?`<div class="small">${U.esc(x.note)}</div>`:''}</div>`).join('')}</div>`; }
  function dkMergeReqActionsHtml(r) { const b=[], own=dkMergeOwned(r), src=dkMergeSources(r), valid=src.length===2; if(r.status==='DRAFT'&&!r.assignedTo&&A.canDo('diem-kd.gop-diem.tiep-nhan',r.market)) b.push(`<button class="btn sm primary" data-act="dkmerge-accept" data-id="${r.id}">Tiếp nhận xử lý</button>`); if(r.status==='STAFF_REVIEW'&&own&&A.canDo('diem-kd.gop-diem.gui-phe-duyet',r.market)) { b.push(`<button class="btn sm" data-act="dkmerge-plan-open" data-id="${r.id}">${r.plan?'Cập nhật phương án':'Lập phương án'}</button>`); if(r.plan&&valid)b.push(`<button class="btn sm primary" data-act="dkmerge-submit" data-id="${r.id}">Gửi phê duyệt</button>`); } if(r.status==='PENDING_APPROVAL'&&A.canDo('diem-kd.gop-diem.phe-duyet',r.market)){b.push(`<button class="btn sm primary" data-act="dkmerge-approve" data-id="${r.id}">Phê duyệt phương án</button><button class="btn sm danger" data-act="dkmerge-reject" data-id="${r.id}">Từ chối</button>`);} if(r.status==='APPROVED'&&own&&A.canDo('diem-kd.gop-diem.thuc-hien',r.market)){const ok=r.plan&&r.plan.contractCondition==='RESOLVED';b.push(`<button class="btn sm primary" data-act="dkmerge-execute" data-id="${r.id}" ${ok?'':'disabled'}>Thực hiện gộp điểm</button>`);} return b.join(''); }
  function dkMergeReqDetailHtml(r) { return dkMergeReqDetailDesignHtml(r); }
  function dkMergeReqDetailDesignHtml(r) {
    const s=dkMergeSources(r), a=s[0], b=s[1], p=r.plan, cc=a&&b?dkMergeContractState(a,b):null;
    const statusBlock=`<div class="merge-status-box"><div class="small muted">Trạng thái</div>${dkReqStatusTag(r.status)}<dl class="kv"><dt>Ngày đề nghị</dt><dd>${U.dmy(r.requestedAt)}</dd><dt>Người phụ trách</dt><dd>${U.esc(dkReqAssigneeName(r))}</dd>${(r.timeline||[]).find(x=>x.key==='approved')?`<dt>Người phê duyệt</dt><dd>${U.esc((r.timeline||[]).find(x=>x.key==='approved').by||'')}</dd>`:''}</dl></div>`;
    const sourceCards=s.length?`<div class="merge-source-grid">${s.map(dkMergePointCard).join('')}</div>`:'<div class="note">Điểm nguồn không còn tồn tại.</div>';
    const result=p?`<div class="merge-result-card"><div class="small muted">Điểm mới sau gộp</div><b>${U.esc(p.resultCode||'Chưa xác định')}</b><div>${p.resultArea} m²</div><div class="small muted">${U.esc(dkPointTypeLabel({pointType:p.pointType}))} · ${U.esc(p.category||'')}</div></div>`:'<div class="merge-result-card muted">Chưa có phương án gộp.</div>';
    return `<div class="drawer-h detail-form-head" style="flex-wrap:wrap"><div><h3>${r.id} · Gộp điểm</h3><div class="small muted">${dkReqStatusTag(r.status)}</div></div><span class="spacer"></span><div class="row" style="gap:6px">${dkMergeReqActionsHtml(r)}</div><button class="x" data-act="close" aria-label="Đóng">×</button></div><div class="detail-form-tabs">${U.icon('file')} Chi tiết yêu cầu thay đổi điểm</div><div class="drawer-b merge-request-detail"><section class="merge-detail-section"><h4>A. Thông tin yêu cầu</h4><div class="merge-info-grid"><dl class="kv"><dt>Mã yêu cầu</dt><dd>${r.id}</dd><dt>Loại yêu cầu</dt><dd>Gộp điểm kinh doanh</dd><dt>Nguồn đề nghị</dt><dd>${dkReqSourceLabel(r.source)}</dd><dt>Người đề nghị</dt><dd>${U.esc(r.requestedByName||'')}</dd><dt>Lý do</dt><dd>${U.esc(r.reason||'Chưa ghi nhận')}</dd></dl>${statusBlock}</div></section><section class="merge-detail-section"><h4>B. Các điểm kinh doanh hiện tại (đề xuất gộp)</h4>${sourceCards}${cc?`<div class="note ${cc.blocking?'':'info'}" style="margin-top:10px">${cc.blocking?'⛔ ':'⚠ '}${U.esc(cc.text)}</div>`:''}</section><section class="merge-detail-section"><h4>C. Phương án gộp</h4><div class="merge-flow"><div class="merge-flow-sources">${s.map(x=>`<div class="merge-flow-source"><b>${x.code}</b><span>${x.area} m² · ${U.esc(dkPointTypeLabel(x))}</span></div>`).join('')}</div><div class="merge-flow-arrow">Gộp →</div>${result}</div>${p?`<div class="small ${p.contractCondition==='RESOLVED'?'ok':'danger'}" style="margin-top:10px">${p.contractCondition==='RESOLVED'?'✓ Đủ điều kiện hợp đồng để thực hiện.':'⛔ Điều kiện hợp đồng chưa hoàn tất — không thể thực hiện gộp.'}</div>`:''}</section><section class="merge-detail-section"><h4>D. Quá trình xử lý</h4>${dkMergeTimeline(r)}</section>${r.resultPointIds&&r.resultPointIds.length?`<div class="row" style="margin-top:10px">${r.resultPointIds.map(id=>{const x=A.idx.stall.get(id);return x?`<button class="btn sm" data-act="dkreq-view-point" data-id="${r.id}" data-point="${x.id}">Xem ${x.code}</button>`:'';}).join('')}</div>`:''}</div><div class="drawer-f detail-form-footer"><button class="btn" data-act="close">Đóng</button></div>`;
  }
  function dkMergePlanModal(r) { const s=dkMergeSources(r), a=s[0],b=s[1],p=dkMergePlanDraft; return A.mHead('PHƯƠNG ÁN GỘP ĐIỂM')+`<div class="modal-b"><div class="split-result">${a?dkMergePointCard(a):''}${b?dkMergePointCard(b):''}</div><div class="field"><label>Mã điểm dự kiến *</label><input class="input" data-in="dkmerge-plan-code" value="${U.esc(p.resultCode)}"></div><div class="field"><label>Diện tích sau gộp</label><input class="input" disabled value="${p.resultArea} m²"></div><div class="field"><label>Lý do gộp *</label><textarea class="input" data-in="dkmerge-plan-reason">${U.esc(p.reason)}</textarea></div><div class="field"><label>Điều kiện hợp đồng (mock)</label><select class="input" data-ch="dkmerge-plan-contract"><option value="UNRESOLVED" ${p.contractCondition==='UNRESOLVED'?'selected':''}>Chưa hoàn tất — chặn thực hiện</option><option value="RESOLVED" ${p.contractCondition==='RESOLVED'?'selected':''}>Đã hoàn tất — cho phép thực hiện</option></select><div class="small muted">Không làm thay đổi hợp đồng; chỉ mô phỏng xác nhận điều kiện trước execution.</div></div><div class="row" style="justify-content:flex-end;margin-top:12px"><button class="btn" data-act="close">Hủy</button><button class="btn primary" data-act="dkmerge-plan-save" data-id="${r.id}">Lưu phương án</button></div></div>`; }
  A.IN['dkmerge-plan-code']=el=>{dkMergePlanDraft.resultCode=el.value;}; A.IN['dkmerge-plan-reason']=el=>{dkMergePlanDraft.reason=el.value;}; A.CH['dkmerge-plan-contract']=el=>{dkMergePlanDraft.contractCondition=el.value;};
  A.ACT['dkmerge-accept']=el=>{const r=dkReqFind(el.dataset.id),acc=A.currentAccount(),s=r&&dkMergeSources(r);if(!r||r.type!=='MERGE'||!acc||r.status!=='DRAFT'||r.assignedTo||!A.canDo('diem-kd.gop-diem.tiep-nhan',r.market)||s.length!==2)return U.toast('Không thể tiếp nhận yêu cầu này');r.assignedTo=acc.id;r.status='STAFF_REVIEW';r.timeline.push({key:'received',at:U.dmy(U.today()),by:acc.fullName});A.save();dkReqRerenderDrawer(r);A.render();};
  A.ACT['dkmerge-plan-open']=el=>{const r=dkReqFind(el.dataset.id),s=r&&dkMergeSources(r);if(!r||r.type!=='MERGE'||!dkMergeOwned(r)||r.status!=='STAFF_REVIEW'||!A.canDo('diem-kd.gop-diem.gui-phe-duyet',r.market)||s.length!==2)return;const cc=dkMergeContractState(s[0],s[1]);dkMergePlanEditId=r.id;dkMergePlanDraft=Object.assign({resultCode:dkMergeCode(s[0],s[1]),resultArea:+(s[0].area+s[1].area).toFixed(1),pointType:s[0].pointType,category:s[0].cat,reason:r.reason||'',contractCondition:cc.resolved?'RESOLVED':'UNRESOLVED'},r.plan||{});dkMergePlanDraft.reason=r.reason||dkMergePlanDraft.reason;A.modal(dkMergePlanModal(r),true);};
  A.ACT['dkmerge-plan-save']=el=>{const r=dkReqFind(el.dataset.id),s=r&&dkMergeSources(r),p=dkMergePlanDraft;if(!r||!p||!dkMergeOwned(r)||r.status!=='STAFF_REVIEW'||!A.canDo('diem-kd.gop-diem.gui-phe-duyet',r.market)||s.length!==2)return;const code=(p.resultCode||'').trim(),reason=(p.reason||'').trim(),area=+(s[0].area+s[1].area).toFixed(1);if(!code||!reason)return U.toast('Nhập mã điểm dự kiến và lý do');if(A.db.stalls.some(x=>x.code===code&&x.id!==r.resultPointIds[0]))return U.toast('Mã điểm kết quả đã tồn tại');r.plan={resultCode:code,resultArea:area,pointType:s[0].pointType,category:s[0].cat,contractCondition:p.contractCondition};r.reason=reason;const acc=A.currentAccount();r.timeline.push({key:'planned',at:U.dmy(U.today()),by:acc.fullName});A.save();A.closeModal();dkMergePlanEditId=null;dkMergePlanDraft=null;dkReqRerenderDrawer(r);A.render();};
  A.ACT['dkmerge-submit']=el=>{const r=dkReqFind(el.dataset.id),s=r&&dkMergeSources(r);if(!r||!dkMergeOwned(r)||r.status!=='STAFF_REVIEW'||!r.plan||!A.canDo('diem-kd.gop-diem.gui-phe-duyet',r.market)||s.length!==2)return U.toast('Phương án gộp chưa hợp lệ');r.status='PENDING_APPROVAL';r.timeline.push({key:'submitted',at:U.dmy(U.today()),by:A.currentAccount().fullName});A.save();dkReqRerenderDrawer(r);A.render();};
  A.ACT['dkmerge-approve']=el=>{const r=dkReqFind(el.dataset.id);if(!r||r.status!=='PENDING_APPROVAL'||!A.canDo('diem-kd.gop-diem.phe-duyet',r.market))return;r.status='APPROVED';r.timeline.push({key:'approved',at:U.dmy(U.today()),by:A.currentAccount().fullName});A.save();dkReqRerenderDrawer(r);A.render();};
  A.ACT['dkmerge-reject']=el=>{const r=dkReqFind(el.dataset.id);if(!r||r.status!=='PENDING_APPROVAL'||!A.canDo('diem-kd.gop-diem.phe-duyet',r.market))return;r.status='REJECTED';r.timeline.push({key:'approved',at:U.dmy(U.today()),by:A.currentAccount().fullName,note:'Từ chối'});A.save();dkReqRerenderDrawer(r);A.render();};
  A.ACT['dkmerge-execute']=el=>{const r=dkReqFind(el.dataset.id),acc=A.currentAccount();if(!r||r.type!=='MERGE'||!acc||acc.status!=='active'||ui.market!=='CL'||A.allowedMarkets(acc).indexOf('CL')<0||!dkMergeOwned(r)||!A.canDo('diem-kd.gop-diem.thuc-hien',r.market)||r.market!=='CL'||r.status!=='APPROVED'||!r.plan)return U.toast('Bạn không thể thực hiện yêu cầu này');const ids=r.sourcePointIds||[],s=ids.map(id=>A.idx.stall.get(id));if(ids.length!==2||new Set(ids).size!==2||s.some(x=>!x)||s.some(x=>x.market!=='CL'||!dkMergeActive(x,r.id)))return U.toast('Điểm nguồn không còn đủ điều kiện cấu trúc');const [a,b]=s;if(a.floor!==b.floor||a.section!==b.section||a.row==null||a.row!==b.row||a.num==null||b.num==null||Math.abs(a.num-b.num)!==1)return U.toast('Hai điểm không còn liền kề theo quy tắc prototype');if(r.plan.contractCondition!=='RESOLVED')return U.toast('Điều kiện hợp đồng chưa hoàn tất');const code=(r.plan.resultCode||'').trim(),area=+(a.area+b.area).toFixed(1),cats=dkZoneAllowedCats(a);if(!code||A.db.stalls.some(x=>x.code===code)||r.plan.resultArea!==area||(cats.length&&cats.indexOf(r.plan.category)===-1))return U.toast('Phương án kết quả không còn hợp lệ');const result={id:'CL-'+code,code,market:'CL',floor:a.floor,section:a.section,sectionName:a.sectionName,row:null,num:null,type:a.type,areaType:a.areaType,pointType:r.plan.pointType,cat:r.plan.category,area,status:'trong',traderId:null,sellerId:null,contractId:null,structuralStatus:'ACTIVE',sourcePointIds:[a.id,b.id],mergeRequestId:r.id,needsFloorplanMapping:true,history:[`${U.dmy(U.today())}: Gộp từ ${a.code} + ${b.code} theo yêu cầu ${r.id}`]};a.structuralStatus='MERGED';b.structuralStatus='MERGED';a.mergedIntoPointId=result.id;b.mergedIntoPointId=result.id;a.history=a.history||[];b.history=b.history||[];a.history.unshift(`${U.dmy(U.today())}: Gộp với ${b.code}, kết quả ${result.code}, yêu cầu ${r.id}`);b.history.unshift(`${U.dmy(U.today())}: Gộp với ${a.code}, kết quả ${result.code}, yêu cầu ${r.id}`);A.db.stalls.push(result);A.idx.stall.set(result.id,result);r.status='COMPLETED';r.resultPointIds=[result.id];r.timeline.push({key:'implementing',at:U.dmy(U.today()),by:acc.fullName},{key:'completed',at:U.dmy(U.today()),by:acc.fullName});A.save();dkReqRerenderDrawer(r);A.render();U.toast(`Đã gộp ${a.code} và ${b.code} thành ${result.code}.`);};

  // ==================== CHUYỂN ĐỔI VỊ TRÍ ĐIỂM KINH DOANH ====================
  // BUSINESS_POINT_RELOCATION_WORKFLOW_IMPLEMENTATION_REPORT.md. V1 CHỈ hỗ trợ conversionType
  // RELOCATE_TO_VACANT_POINT (đổi chỗ 1 điểm ĐANG SỬ DỤNG sang 1 điểm ĐANG TRỐNG khác, cùng Chợ Cao
  // Lãnh) — KHÔNG tạo/xoá điểm, KHÔNG đổi pointCode/geometry, KHÔNG cần liền kề (khác hẳn quy tắc
  // adjacency của GỘP ĐIỂM — không tái dùng dkMergeCandidates/dkMergeActive). Dùng CHUNG
  // A.db.pointRequests (type 'CONVERT', field mới `fromPointId`/`toPointId`/`conversionType`) —
  // KHÔNG tạo collection riêng, đúng pattern đã áp dụng cho SPLIT/MERGE.
  function dkConvertActiveConflict(pointId, exceptId) {
    // Conflict check DÙNG CHUNG cho CẢ 3 loại yêu cầu hiện có (SPLIT.pointId, MERGE.sourcePointIds,
    // CONVERT.fromPointId/toPointId) — rộng hơn dkMergeActiveConflict (chỉ biết SPLIT/MERGE) vì
    // CONVERT cần biết cả khi 1 điểm đang là TARGET của 1 yêu cầu chuyển đổi khác đang xử lý. Đây là
    // hàm MỚI, KHÔNG sửa dkMergeActiveConflict/dksrEligibleStalls hiện có (mục "không phá SPLIT/MERGE").
    return A.db.pointRequests.some(r => r.id !== exceptId && r.status !== 'REJECTED' && r.status !== 'COMPLETED'
      && (r.pointId === pointId || (r.sourcePointIds || []).indexOf(pointId) !== -1 || r.fromPointId === pointId || r.toPointId === pointId));
  }
  // Điểm nguồn hợp lệ: thuộc CL, cấu trúc ACTIVE (chưa SPLIT/MERGED), ĐANG có người sử dụng
  // (traderId — chuyển đổi vị trí chỉ có ý nghĩa với điểm đang dùng), không đang dính yêu cầu khác.
  function dkConvertSourceEligible(st, exceptId) {
    return !!st && st.market === 'CL' && (!st.structuralStatus || st.structuralStatus === 'ACTIVE')
      && !!st.traderId && !dkConvertActiveConflict(st.id, exceptId || null);
  }
  function dkConvertEligibleSources() {
    return A.db.stalls.filter(s => dkConvertSourceEligible(s, null)).sort((a, b) => a.code.localeCompare(b.code));
  }
  // Điểm đích hợp lệ: thuộc CL, cấu trúc ACTIVE, ĐANG TRỐNG thật (status 'trong' VÀ không có
  // traderId), khác điểm nguồn, không đang dính yêu cầu khác (trừ CHÍNH yêu cầu đang sửa — exceptId —
  // để cho phép giữ nguyên target cũ khi mở lại "Sửa phương án"). KHÔNG yêu cầu liền kề/cùng khu vực
  // ("Không yêu cầu adjacency" — khác hẳn Gộp điểm).
  function dkConvertTargetEligible(st, source, exceptId) {
    return !!st && st.market === 'CL' && st.id !== (source && source.id) && (!st.structuralStatus || st.structuralStatus === 'ACTIVE')
      && st.status === 'trong' && !st.traderId && !dkConvertActiveConflict(st.id, exceptId || null);
  }
  function dkConvertTargetCandidates(source, exceptId) {
    if (!source) return [];
    return A.db.stalls.filter(s => dkConvertTargetEligible(s, source, exceptId)).sort((a, b) => a.code.localeCompare(b.code));
  }
  // Điều kiện hợp đồng tại điểm NGUỒN (mock, giống dkMergeContractState) — KHÔNG tự sửa/chấm dứt hợp
  // đồng ở bất kỳ đâu, chỉ hiển thị + cho NV BQL tự đánh dấu PENDING/RESOLVED trên phương án.
  function dkConvertContractInfo(source) {
    const c = source && source.contractId ? A.idx.contract.get(source.contractId) : null;
    if (!c || c.status !== 'hieuluc') return { contract: c, resolved: true, text: 'Không có hợp đồng đang hiệu lực tại điểm nguồn.' };
    return { contract: c, resolved: false, text: `Điểm nguồn đang có hợp đồng hiệu lực (${c.id}). Cần xác nhận xử lý hợp đồng trước khi thực hiện — chuyển đổi vị trí KHÔNG tự sửa/chấm dứt/gán lại hợp đồng.` };
  }
  // So sánh khu vực/loại/diện tích/ngành hàng/trạng thái/đơn giá nguồn↔đích (mục "So sánh" của C) —
  // CHỈ hiển thị, KHÔNG dùng để chặn (không có yêu cầu adjacency/cùng ngành hàng ở V1).
  function dkConvertUnitPrice(st) { return st.type === 'phien' ? D.SESSION_FEE : D.UNIT[st.type]; }
  function dkConvertCompareHtml(a, b) {
    const areaDiff = +(b.area - a.area).toFixed(1);
    const sameUnitBasis = a.type === b.type;
    const priceDiff = sameUnitBasis ? dkConvertUnitPrice(b) - dkConvertUnitPrice(a) : null;
    const row = (label, av, bv, diff) => `<tr><td>${label}</td><td>${av}</td><td>${bv}</td><td>${diff != null ? diff : '<span class="muted">–</span>'}</td></tr>`;
    return `<div class="tbl-wrap" style="margin-top:8px"><table class="tbl"><thead><tr><th></th><th>Điểm nguồn</th><th>Điểm đích</th><th>Chênh lệch</th></tr></thead><tbody>
      ${row('Khu vực', U.esc(a.sectionName), U.esc(b.sectionName), null)}
      ${row('Loại điểm', U.esc(dkPointTypeLabel(a)), U.esc(dkPointTypeLabel(b)), null)}
      ${row('Diện tích', a.area.toLocaleString('vi-VN') + ' m²', b.area.toLocaleString('vi-VN') + ' m²', (areaDiff > 0 ? '+' : '') + areaDiff.toLocaleString('vi-VN') + ' m²')}
      ${row('Ngành hàng', U.esc(a.cat) || 'Chưa có', U.esc(b.cat) || 'Chưa có', null)}
      ${row('Trạng thái', U.statusTag(a.status), U.statusTag(b.status), null)}
      ${row('Đơn giá', U.unitLabel(a), U.unitLabel(b), priceDiff != null ? (priceDiff > 0 ? '+' : '') + U.money(priceDiff) + '/m²/ngày' : 'Không so sánh được (khác loại điểm)')}
      </tbody></table></div>`;
  }
  // Bảng điều kiện PASS/WARNING/BLOCKER (mục C yêu cầu) — tính lại LUÔN từ dữ liệu HIỆN TẠI (không
  // chỉ dựa vào lúc lập yêu cầu) để re-check execution phản ánh đúng "nếu target đã thay đổi thì
  // STOP". `contractCondition` lấy từ r.plan nếu có (NV BQL đã tự đánh dấu), mặc định theo
  // dkConvertContractInfo(source) khi chưa lập phương án.
  function dkConvertConditions(r, source, target) {
    const rows = [];
    const push = (label, level, note) => rows.push({ label, level, note });
    push('Điểm nguồn tồn tại, thuộc Chợ Cao Lãnh, đang có người sử dụng', source && source.market === 'CL' && !!source.traderId ? 'PASS' : 'BLOCKER', source ? '' : 'Điểm nguồn không còn tồn tại.');
    if (!target) { push('Đã chọn điểm đích', 'BLOCKER', 'Chưa chọn điểm đích cho phương án.'); return rows; }
    push('Điểm đích tồn tại, thuộc Chợ Cao Lãnh, còn TRỐNG', target.market === 'CL' && target.status === 'trong' && !target.traderId ? 'PASS' : 'BLOCKER', '');
    push('Cấu trúc còn hiệu lực (chưa Tách/Gộp)', (!source || !source.structuralStatus || source.structuralStatus === 'ACTIVE') && (!target.structuralStatus || target.structuralStatus === 'ACTIVE') ? 'PASS' : 'BLOCKER', '');
    const conflict = (source && dkConvertActiveConflict(source.id, r ? r.id : null)) || dkConvertActiveConflict(target.id, r ? r.id : null);
    push('Không có yêu cầu thay đổi khác đang xử lý trên 2 điểm', conflict ? 'BLOCKER' : 'PASS', conflict ? 'Điểm nguồn hoặc điểm đích đang dính 1 yêu cầu thay đổi khác chưa hoàn tất/từ chối.' : '');
    const allowedCats = dkZoneAllowedCats(target);
    const catOk = !source || !allowedCats.length || allowedCats.indexOf(source.cat) !== -1;
    push('Ngành hàng phù hợp quy hoạch khu vực đích', catOk ? 'PASS' : 'WARNING', catOk ? '' : `Khu vực đích quy hoạch ngành hàng "${allowedCats.join(', ')}", khác ngành hàng hiện tại của điểm nguồn ("${source.cat || 'chưa có'}").`);
    const debt = source ? U.traderDebt(source.traderId) : 0;
    push('Công nợ của tiểu thương tại điểm nguồn', debt > 0 ? 'WARNING' : 'PASS', debt > 0 ? `Còn nợ ${U.money(debt)} — cần xác nhận hướng xử lý, không tự chặn.` : 'Không có công nợ.');
    const cc = dkConvertContractInfo(source);
    const contractCondition = r && r.plan && r.plan.contractCondition ? r.plan.contractCondition : (cc.resolved ? 'RESOLVED' : 'PENDING');
    push('Điều kiện hợp đồng tại điểm nguồn', contractCondition === 'RESOLVED' ? 'PASS' : 'WARNING', cc.text);
    const seller = source && dkDirectSellerActive(source);
    push('Người trực tiếp kinh doanh tại điểm nguồn', seller ? 'WARNING' : 'PASS', seller ? `Đang có "${seller.fullName || (A.idx.trader.get(seller.traderId||'')||{}).name || ''}" đăng ký trực tiếp kinh doanh tại điểm nguồn — KHÔNG tự sao chép sang điểm đích, cần đăng ký lại thủ công nếu cần.` : 'Chưa ghi nhận người trực tiếp kinh doanh khác người thuê.');
    return rows;
  }
  function dkConvertConditionsHtml(r, source, target) {
    const rows = dkConvertConditions(r, source, target);
    const cls = { PASS: 'ok', WARNING: 'warn', BLOCKER: 'danger' };
    const label = { PASS: 'Đạt', WARNING: 'Cảnh báo', BLOCKER: 'Chặn' };
    return `<div class="m-list">${rows.map(x => `<div class="it" style="align-items:flex-start"><span style="flex:1">${U.esc(x.label)}${x.note ? `<div class="small muted">${U.esc(x.note)}</div>` : ''}</span><span class="tag ${cls[x.level]}">${label[x.level]}</span></div>`).join('')}</div>`;
  }
  function dkConvertHasBlocker(rows) { return rows.some(x => x.level === 'BLOCKER'); }

  let dkcvMode = null; // null | 'create' (form đầy đủ, Luồng 2) | 'complete' (Tiếp nhận & lập/sửa phương án)
  let dkcvDraft = null; // { fromPointId, toPointId, reason, note, files:[], contractCondition }
  let dkcvPlanEditId = null;
  let dkcvAssignDraft = null; // { stallId, reason, assignedTo, note } — Luồng 3 (Trưởng BQL đề xuất)

  function dkcvSourceInfoHtml(st) {
    const cc = dkConvertContractInfo(st);
    const seller = dkDirectSellerActive(st);
    return `<dl class="kv">
      <dt>Mã điểm</dt><dd>${st.code}</dd>
      <dt>Vị trí</dt><dd>${U.esc(st.sectionName)}</dd>
      <dt>Diện tích</dt><dd>${st.area.toLocaleString('vi-VN')} m²</dd>
      <dt>Loại điểm</dt><dd>${U.esc(dkPointTypeLabel(st))}</dd>
      <dt>Ngành hàng</dt><dd>${U.esc(st.cat) || 'Chưa có thông tin'}</dd>
      <dt>Người thuê</dt><dd>${st.traderId ? U.esc(A.idx.trader.get(st.traderId).name) : 'Chưa có'}</dd>
      <dt>Hợp đồng hiện hành</dt><dd>${cc.contract ? cc.contract.id : 'Chưa có hợp đồng hiệu lực'}</dd>
      <dt>Người trực tiếp kinh doanh</dt><dd>${seller ? U.esc(seller.fullName || (seller.traderId && A.idx.trader.get(seller.traderId) ? A.idx.trader.get(seller.traderId).name : '')) : 'Chưa ghi nhận'}</dd>
    </dl>${!cc.resolved ? `<div class="note" style="margin-top:8px">${U.esc(cc.text)}</div>` : ''}`;
  }
  function dkcvFormHtml() {
    const sources = dkConvertEligibleSources();
    const st = dkcvDraft.fromPointId ? A.idx.stall.get(dkcvDraft.fromPointId) : null;
    const targets = st ? dkConvertTargetCandidates(st, null) : [];
    const target = dkcvDraft.toPointId ? A.idx.stall.get(dkcvDraft.toPointId) : null;
    const rows = st && target ? dkConvertConditions(null, st, target) : [];
    return `<div class="drawer-h"><div><h3>Lập yêu cầu chuyển đổi vị trí</h3><div class="small muted" style="margin-top:2px">Chợ Cao Lãnh</div></div><span class="spacer"></span>
        <button class="x" data-act="close" aria-label="Đóng">×</button></div>
      <div class="drawer-b">
        <div class="small muted" style="margin:-4px 0 8px">A. Điểm kinh doanh cần chuyển đi</div>
        <div class="field"><label>Điểm hiện tại *</label><select class="input" data-ch="dkcv-from"><option value="">— Chọn điểm —</option>${sources.map(s => `<option value="${s.id}" ${dkcvDraft.fromPointId === s.id ? 'selected' : ''}>${s.code} · ${U.esc(s.sectionName)} · ${s.area.toLocaleString('vi-VN')} m²</option>`).join('')}</select></div>
        ${st ? `<div style="margin-top:10px">${dkcvSourceInfoHtml(st)}</div>
          <div class="divider"></div>
          <div class="small muted" style="margin-bottom:6px">B. Điểm đích đề xuất</div>
          <div class="field"><label>Điểm còn trống *</label><select class="input" data-ch="dkcv-to"><option value="">— Chọn điểm đích —</option>${targets.map(s => `<option value="${s.id}" ${dkcvDraft.toPointId === s.id ? 'selected' : ''}>${s.code} · ${U.esc(s.sectionName)} · ${s.area.toLocaleString('vi-VN')} m²</option>`).join('')}</select></div>
          ${!targets.length ? '<div class="note">Không có điểm trống hợp lệ nào trong Chợ Cao Lãnh.</div>' : ''}
          ${target ? `<div class="divider"></div><div class="small muted" style="margin-bottom:6px">C. Kiểm tra điều kiện & phương án</div>
            <div class="merge-flow"><div class="merge-flow-source"><b>${st.code}</b><span>${st.area} m² · ${U.esc(dkPointTypeLabel(st))}</span></div><div class="merge-flow-arrow">Chuyển đến →</div><div class="merge-flow-source"><b>${target.code}</b><span>${target.area} m² · ${U.esc(dkPointTypeLabel(target))}</span></div></div>
            ${dkConvertCompareHtml(st, target)}
            ${dkConvertConditionsHtml(null, st, target)}
            <div class="field" style="margin-top:10px"><label>Điều kiện hợp đồng (mock)</label><select class="input" data-ch="dkcv-contract"><option value="PENDING" ${dkcvDraft.contractCondition !== 'RESOLVED' ? 'selected' : ''}>Chưa hoàn tất — chặn thực hiện</option><option value="RESOLVED" ${dkcvDraft.contractCondition === 'RESOLVED' ? 'selected' : ''}>Đã hoàn tất — cho phép thực hiện</option></select><div class="small muted">Không làm thay đổi hợp đồng thật; chỉ mô phỏng xác nhận điều kiện trước khi thực hiện.</div></div>
            <div class="divider"></div>
            <div class="field"><label>Lý do đề xuất *</label><textarea class="input" rows="2" data-in="dkcv-reason">${U.esc(dkcvDraft.reason)}</textarea></div>
            <div class="field" style="margin-top:10px"><label>Ghi chú</label><textarea class="input" rows="2" data-in="dkcv-note">${U.esc(dkcvDraft.note)}</textarea></div>
            <div class="row" style="justify-content:flex-end;margin-top:14px">
              <button class="btn" data-act="dkcv-cancel">Hủy</button>
              <button class="btn primary" data-act="dkcv-save" ${dkConvertHasBlocker(rows) ? 'disabled' : ''}>Lưu yêu cầu</button>
            </div>` : ''}` : '<div class="small muted" style="margin-top:10px">Chọn 1 điểm kinh doanh đang sử dụng để lập yêu cầu chuyển đổi vị trí.</div>'}
      </div>`;
  }
  function dkcvFormRerender() { ycSetModal(`<div class="drawer-overlay" data-act="close"></div><div class="drawer drawer-yc">${dkcvFormHtml()}</div>`); }
  // "+ Lập yêu cầu thay đổi" dùng CHUNG 1 nút cho Luồng 2 (NV BQL tự lập đủ phương án) và Luồng 3
  // (Trưởng BQL chỉ đề xuất + giao việc) — giống hệt pattern dksr-open (SPLIT).
  A.ACT['dkconvert-open'] = () => {
    const canFull = A.canDo('diem-kd.chuyen-doi.tiep-nhan', 'CL');
    const canAssign = A.canDo('diem-kd.chuyen-doi.assign', 'CL');
    if (!A.canDo('diem-kd.chuyen-doi.lap-yeu-cau', 'CL') && !canAssign) return;
    A.drawerReset();
    if (!canFull && canAssign) { A.ACT['dkcva-open'](); return; }
    dkcvMode = 'create'; dkcvPlanEditId = null;
    dkcvDraft = { fromPointId: null, toPointId: null, reason: '', note: '', files: [], contractCondition: 'PENDING' };
    dkcvFormRerender();
    A.render();
  };
  A.CH['dkcv-from'] = el => {
    if (!dkcvDraft) return;
    dkcvDraft.fromPointId = el.value || null; dkcvDraft.toPointId = null;
    const st = dkcvDraft.fromPointId ? A.idx.stall.get(dkcvDraft.fromPointId) : null;
    dkcvDraft.contractCondition = st && dkConvertContractInfo(st).resolved ? 'RESOLVED' : 'PENDING';
    dkcvFormRerender();
  };
  // dkcv-to dùng CHUNG cho cả form tạo mới (dkcvMode 'create') lẫn form lập/sửa phương án (dkcvMode
  // 'complete') — rerender ĐÚNG form đang mở theo mode, KHÔNG luôn gọi dkcvFormRerender() (nếu không
  // sẽ vẽ nhầm sang form tạo mới khi đang ở form lập phương án của 1 yêu cầu đã tồn tại).
  A.CH['dkcv-to'] = el => {
    if (!dkcvDraft) return;
    dkcvDraft.toPointId = el.value || null;
    if (dkcvMode === 'complete') { const r = dkReqFind(dkcvPlanEditId); if (r) dkcvPlanRerender(r); }
    else dkcvFormRerender();
  };
  A.CH['dkcv-contract'] = el => { if (dkcvDraft) dkcvDraft.contractCondition = el.value; };
  A.IN['dkcv-reason'] = el => { if (dkcvDraft) dkcvDraft.reason = el.value; };
  A.IN['dkcv-note'] = el => { if (dkcvDraft) dkcvDraft.note = el.value; };
  A.ACT['dkcv-cancel'] = () => { dkcvMode = null; dkcvDraft = null; A.closeModal(); A.render(); };
  A.ACT['dkcv-save'] = () => {
    if (!A.canDo('diem-kd.chuyen-doi.lap-yeu-cau', 'CL')) return;
    if (!dkcvDraft || !dkcvDraft.fromPointId || !dkcvDraft.toPointId) { U.toast('Vui lòng chọn điểm nguồn và điểm đích'); return; }
    const st = A.idx.stall.get(dkcvDraft.fromPointId), target = A.idx.stall.get(dkcvDraft.toPointId);
    if (!dkConvertSourceEligible(st, null) || !dkConvertTargetEligible(target, st, null)) { U.toast('Điểm nguồn hoặc điểm đích không còn hợp lệ, vui lòng chọn lại'); dkcvFormRerender(); return; }
    if (dkConvertHasBlocker(dkConvertConditions(null, st, target))) { U.toast('Còn điều kiện bị chặn, không thể lưu yêu cầu'); return; }
    const reason = (dkcvDraft.reason || '').trim();
    if (!reason) { U.toast('Vui lòng nhập lý do đề xuất'); return; }
    const acc = A.currentAccount(), actorName = acc ? acc.fullName : 'Không rõ', nowAt = U.dmy(U.today());
    const r = {
      id: dkReqNextId(), type: 'CONVERT', conversionType: 'RELOCATE_TO_VACANT_POINT', market: 'CL', source: 'STAFF',
      fromPointId: st.id, toPointId: target.id,
      requestedByName: actorName, requestedByTraderId: null,
      createdBy: acc ? acc.id : null, assignedTo: acc ? acc.id : null,
      requestedAt: A.db.today,
      reason, note: (dkcvDraft.note || '').trim(), attachments: dkcvDraft.files.map(name => ({ name })),
      status: 'STAFF_REVIEW',
      plan: { toPointId: target.id, contractCondition: dkcvDraft.contractCondition === 'RESOLVED' ? 'RESOLVED' : 'PENDING' },
      timeline: [{ key: 'created', at: nowAt, by: actorName }],
      resultPointIds: null, postCheck: null
    };
    A.db.pointRequests.push(r);
    U.log(`Lập yêu cầu chuyển đổi vị trí ${st.code} → ${target.code} (${r.id})`);
    A.save();
    dkcvMode = null; dkcvDraft = null;
    A.closeModal();
    A.render();
    A.ACT['cl-req-open']();
    U.toast(`Đã lưu yêu cầu chuyển đổi vị trí ${st.code} → ${target.code} (${r.id})`);
  };

  // ---- Luồng 3 — Trưởng BQL chủ động đề xuất (KHÔNG tự chọn điểm đích/phương án kỹ thuật) ----
  // Danh sách NV BQL đủ điều kiện — KHÔNG tái dùng dkAssignCandidates() (lọc theo permKey
  // 'diem-kd.tach-diem.tiep-nhan' của SPLIT): 1 account có thể được cấp quyền tiếp nhận CONVERT mà
  // không có quyền tiếp nhận SPLIT (hoặc ngược lại) khi admin phân quyền tuỳ biến — phải lọc đúng
  // permKey 'diem-kd.chuyen-doi.tiep-nhan' riêng của CONVERT, cùng cách lọc động qua A.PERM.canAction.
  function dkConvertAssignCandidates() {
    return A.ACCOUNTS.list().filter(a => a.status === 'active'
      && A.allowedMarkets(a).indexOf('CL') !== -1
      && A.PERM.canAction(A.ACCOUNTS.primaryRole(a), 'diem-kd.chuyen-doi.tiep-nhan'));
  }
  function dkcvAssignFormHtml() {
    const st = dkcvAssignDraft.stallId ? A.idx.stall.get(dkcvAssignDraft.stallId) : null;
    const candidates = dkConvertAssignCandidates();
    return `<div class="drawer-h"><div><h3>Đề xuất chuyển đổi vị trí</h3><div class="small muted" style="margin-top:2px">Chợ Cao Lãnh</div></div><span class="spacer"></span>
        <button class="x" data-act="close" aria-label="Đóng">×</button></div>
      <div class="drawer-b">
        <div class="small muted" style="margin:-4px 0 12px">A. Điểm cần xem xét chuyển đổi vị trí</div>
        <div class="field"><label>Điểm kinh doanh *</label><select class="input" data-ch="dkcva-point"><option value="">— Chọn điểm —</option>${dkConvertEligibleSources().map(s => `<option value="${s.id}" ${dkcvAssignDraft.stallId === s.id ? 'selected' : ''}>${s.code} · ${U.esc(s.sectionName)} · ${s.area.toLocaleString('vi-VN')} m²</option>`).join('')}</select></div>
        ${st ? `<div style="margin-top:10px">${dkcvSourceInfoHtml(st)}</div>
          <div class="divider"></div>
          <div class="small muted" style="margin-bottom:6px">B. Nội dung đề xuất</div>
          <div class="field"><label>Lý do / nội dung chỉ đạo *</label><textarea class="input" rows="3" data-in="dkcva-reason" placeholder="Ví dụ: Đề nghị kiểm tra khả năng chuyển ${U.esc(st.code)} sang 1 điểm còn trống phù hợp hơn.">${U.esc(dkcvAssignDraft.reason)}</textarea></div>
          <div class="divider"></div>
          <div class="small muted" style="margin-bottom:6px">C. Giao xử lý</div>
          ${candidates.length
            ? `<div class="field"><label>Người xử lý *</label><select class="input" data-ch="dkcva-assignee"><option value="">— Chọn nhân viên —</option>${candidates.map(a => `<option value="${a.id}" ${dkcvAssignDraft.assignedTo === a.id ? 'selected' : ''}>${U.esc(a.fullName)}${a.title ? ' · ' + U.esc(a.title) : ''}</option>`).join('')}</select></div>
               <div class="field" style="margin-top:10px"><label>Ghi chú giao việc</label><textarea class="input" rows="2" data-in="dkcva-note">${U.esc(dkcvAssignDraft.note)}</textarea></div>`
            : '<div class="note">Chưa có nhân viên nào đủ điều kiện xử lý yêu cầu chuyển đổi vị trí (Chợ Cao Lãnh).</div>'}
          <div class="row" style="justify-content:flex-end;margin-top:14px">
            <button class="btn" data-act="dkcva-cancel">Hủy</button>
            <button class="btn primary" data-act="dkcva-save" ${candidates.length ? '' : 'disabled'}>Giao xử lý</button>
          </div>` : '<div class="small muted" style="margin-top:10px">Chọn 1 điểm kinh doanh để xem thông tin và đề xuất chuyển đổi vị trí.</div>'}
      </div>`;
  }
  function dkcvaRerender() { ycSetModal(`<div class="drawer-overlay" data-act="close"></div><div class="drawer drawer-yc">${dkcvAssignFormHtml()}</div>`); }
  A.ACT['dkcva-open'] = () => {
    if (!A.canDo('diem-kd.chuyen-doi.assign', 'CL')) return;
    A.drawerReset();
    dkcvAssignDraft = { stallId: null, reason: '', assignedTo: '', note: '' };
    dkcvaRerender();
    A.render();
  };
  A.CH['dkcva-point'] = el => { if (dkcvAssignDraft) { dkcvAssignDraft.stallId = el.value || null; dkcvaRerender(); } };
  A.IN['dkcva-reason'] = el => { if (dkcvAssignDraft) dkcvAssignDraft.reason = el.value; };
  A.IN['dkcva-note'] = el => { if (dkcvAssignDraft) dkcvAssignDraft.note = el.value; };
  A.CH['dkcva-assignee'] = el => { if (dkcvAssignDraft) dkcvAssignDraft.assignedTo = el.value; };
  A.ACT['dkcva-cancel'] = () => { dkcvAssignDraft = null; A.closeModal(); A.render(); };
  A.ACT['dkcva-save'] = () => {
    if (!A.canDo('diem-kd.chuyen-doi.assign', 'CL')) return;
    if (!dkcvAssignDraft || !dkcvAssignDraft.stallId) { U.toast('Vui lòng chọn điểm kinh doanh cần xem xét'); return; }
    const st = A.idx.stall.get(dkcvAssignDraft.stallId);
    if (!dkConvertSourceEligible(st, null)) { U.toast('Điểm kinh doanh không hợp lệ để đề xuất chuyển đổi vị trí'); return; }
    const reason = (dkcvAssignDraft.reason || '').trim();
    if (!reason) { U.toast('Vui lòng nhập lý do / nội dung chỉ đạo'); return; }
    const assignee = dkcvAssignDraft.assignedTo ? A.ACCOUNTS.get(dkcvAssignDraft.assignedTo) : null;
    if (!assignee || assignee.status !== 'active' || A.allowedMarkets(assignee).indexOf('CL') === -1
      || !A.PERM.canAction(A.ACCOUNTS.primaryRole(assignee), 'diem-kd.chuyen-doi.tiep-nhan')) {
      U.toast('Vui lòng chọn người xử lý hợp lệ'); return;
    }
    const acc = A.currentAccount(), actorName = acc ? acc.fullName : 'Không rõ', nowAt = U.dmy(U.today());
    const r = {
      id: dkReqNextId(), type: 'CONVERT', conversionType: 'RELOCATE_TO_VACANT_POINT', market: 'CL', source: 'MANAGER',
      fromPointId: st.id, toPointId: null,
      requestedByName: actorName, requestedByTraderId: null,
      createdBy: acc ? acc.id : null, assignedTo: assignee.id,
      requestedAt: A.db.today,
      reason, note: (dkcvAssignDraft.note || '').trim(), attachments: [],
      status: 'STAFF_REVIEW',
      plan: null, // Trưởng BQL KHÔNG tự chọn điểm đích/phương án kỹ thuật khi tạo đề xuất
      timeline: [
        { key: 'created', at: nowAt, by: actorName },
        { key: 'assigned', at: nowAt, by: actorName, note: 'Giao ' + assignee.fullName + ' xử lý' }
      ],
      resultPointIds: null, postCheck: null
    };
    A.db.pointRequests.push(r);
    U.log(`Đề xuất chuyển đổi vị trí ${st.code}, giao ${assignee.fullName} xử lý (${r.id})`);
    A.save();
    dkcvAssignDraft = null;
    A.closeModal();
    A.render();
    A.ACT['cl-req-open']();
    U.toast('Đã giao ' + assignee.fullName + ' xử lý đề xuất chuyển đổi vị trí ' + st.code + ' (' + r.id + ')');
  };

  // ---- Tiếp nhận (nguồn TRADER) / Lập & sửa phương án (chọn hoặc đổi điểm đích + điều kiện hợp đồng) ----
  function dkcvOwned(r) { const acc = A.currentAccount(); return !!(acc && r.assignedTo === acc.id); }
  function dkcvCanAccept(r) { return r.type === 'CONVERT' && r.status === 'DRAFT' && !r.assignedTo && A.canDo('diem-kd.chuyen-doi.tiep-nhan', r.market); }
  A.ACT['dkconvert-accept'] = el => {
    const r = dkReqFind(el.dataset.id), acc = A.currentAccount();
    if (!r || !acc || !dkcvCanAccept(r)) return;
    r.assignedTo = acc.id; r.status = 'STAFF_REVIEW';
    r.timeline.push({ key: 'received', at: U.dmy(U.today()), by: acc.fullName });
    A.save();
    U.log(`Tiếp nhận yêu cầu chuyển đổi vị trí ${r.id} bởi ${acc.fullName}`);
    dkReqRerenderDrawer(r); A.render(); U.toast('Đã tiếp nhận xử lý yêu cầu.');
  };
  function dkcvPlanFormHtml(r) {
    const st = A.idx.stall.get(r.fromPointId);
    const targets = st ? dkConvertTargetCandidates(st, r.id) : [];
    const target = dkcvDraft.toPointId ? A.idx.stall.get(dkcvDraft.toPointId) : null;
    const rows = st && target ? dkConvertConditions(r, st, target) : [];
    return `<div class="drawer-h"><div><h3>${r.id}</h3><div class="small muted" style="margin-top:2px">Lập phương án chuyển đổi vị trí</div></div><span class="spacer"></span>
        <button class="x" data-act="close" aria-label="Đóng">×</button></div>
      <div class="drawer-b">
        ${st ? `<div>${dkcvSourceInfoHtml(st)}</div><div class="divider"></div>` : '<div class="note">Điểm nguồn không còn tồn tại.</div>'}
        <div class="field"><label>Điểm đích còn trống *</label><select class="input" data-ch="dkcv-to"><option value="">— Chọn điểm đích —</option>${targets.map(s => `<option value="${s.id}" ${dkcvDraft.toPointId === s.id ? 'selected' : ''}>${s.code} · ${U.esc(s.sectionName)} · ${s.area.toLocaleString('vi-VN')} m²</option>`).join('')}</select></div>
        ${!targets.length ? '<div class="note">Không có điểm trống hợp lệ nào trong Chợ Cao Lãnh.</div>' : ''}
        ${st && target ? `<div class="divider"></div><div class="small muted" style="margin-bottom:6px">Kiểm tra điều kiện & phương án</div>
          <div class="merge-flow"><div class="merge-flow-source"><b>${st.code}</b><span>${st.area} m² · ${U.esc(dkPointTypeLabel(st))}</span></div><div class="merge-flow-arrow">Chuyển đến →</div><div class="merge-flow-source"><b>${target.code}</b><span>${target.area} m² · ${U.esc(dkPointTypeLabel(target))}</span></div></div>
          ${dkConvertCompareHtml(st, target)}
          ${dkConvertConditionsHtml(r, st, target)}
          <div class="field" style="margin-top:10px"><label>Điều kiện hợp đồng (mock)</label><select class="input" data-ch="dkcv-contract"><option value="PENDING" ${dkcvDraft.contractCondition !== 'RESOLVED' ? 'selected' : ''}>Chưa hoàn tất — chặn thực hiện</option><option value="RESOLVED" ${dkcvDraft.contractCondition === 'RESOLVED' ? 'selected' : ''}>Đã hoàn tất — cho phép thực hiện</option></select></div>` : ''}
        <div class="divider"></div>
        <div class="field"><label>Lý do đề xuất *</label><textarea class="input" rows="2" data-in="dkcv-reason">${U.esc(dkcvDraft.reason)}</textarea></div>
        <div class="field" style="margin-top:10px"><label>Ghi chú</label><textarea class="input" rows="2" data-in="dkcv-note">${U.esc(dkcvDraft.note)}</textarea></div>
        <div class="row" style="justify-content:flex-end;margin-top:14px">
          <button class="btn" data-act="dkcv-plan-cancel" data-id="${r.id}">Hủy</button>
          <button class="btn primary" data-act="dkcv-plan-save" data-id="${r.id}" ${target && !dkConvertHasBlocker(rows) ? '' : 'disabled'}>Lưu phương án</button>
        </div>
      </div>`;
  }
  // Vẽ form "Lập/Sửa phương án" thay THẲNG vào #modal-root (giống dkReqRerenderDrawer nhưng với
  // body riêng của CONVERT) — KHÔNG dùng A.modal() (sẽ đè mất drawer đang mở, xem ghi chú ycSetModal
  // ở trên) và KHÔNG sửa dkReqRerenderDrawer dùng chung với SPLIT (hàm đó chỉ biết dkPlanMode/
  // dkReqPlanEditId của SPLIT, không biết dkcvMode/dkcvPlanEditId riêng của CONVERT).
  function dkcvPlanRerender(r) {
    ycSetModal(`<div class="drawer-overlay" data-act="close"></div><div class="drawer drawer-yc">${A.drawerBackHtml()}${dkcvPlanFormHtml(r)}</div>`);
  }
  A.ACT['dkconvert-plan-open'] = el => {
    const r = dkReqFind(el.dataset.id);
    if (!r || r.type !== 'CONVERT' || !dkcvOwned(r) || !A.canDo('diem-kd.chuyen-doi.tiep-nhan', r.market) || r.status !== 'STAFF_REVIEW') return;
    const st = A.idx.stall.get(r.fromPointId);
    if (!st) { U.toast('Điểm kinh doanh nguồn không còn tồn tại'); return; }
    const cc = dkConvertContractInfo(st);
    dkcvMode = 'complete'; dkcvPlanEditId = r.id;
    dkcvDraft = { fromPointId: st.id, toPointId: (r.plan && r.plan.toPointId) || r.toPointId || null, reason: r.reason || '', note: r.note || '', files: (r.attachments || []).map(x => x.name), contractCondition: (r.plan && r.plan.contractCondition) || (cc.resolved ? 'RESOLVED' : 'PENDING') };
    dkcvPlanRerender(r);
  };
  A.ACT['dkcv-plan-cancel'] = el => {
    const r = dkReqFind(el.dataset.id);
    dkcvMode = null; dkcvPlanEditId = null; dkcvDraft = null;
    if (r) dkReqRerenderDrawer(r);
  };
  A.ACT['dkcv-plan-save'] = el => {
    const r = dkReqFind(el.dataset.id);
    if (!r || r.type !== 'CONVERT' || !dkcvOwned(r) || !A.canDo('diem-kd.chuyen-doi.tiep-nhan', r.market) || r.status !== 'STAFF_REVIEW' || !dkcvDraft) return;
    const st = A.idx.stall.get(r.fromPointId), target = dkcvDraft.toPointId ? A.idx.stall.get(dkcvDraft.toPointId) : null;
    if (!dkConvertSourceEligible(st, r.id)) { U.toast('Điểm nguồn không còn đủ điều kiện, không thể lưu phương án'); return; }
    if (!target || !dkConvertTargetEligible(target, st, r.id)) { U.toast('Vui lòng chọn điểm đích còn trống hợp lệ'); return; }
    if (dkConvertHasBlocker(dkConvertConditions(r, st, target))) { U.toast('Còn điều kiện bị chặn, không thể lưu phương án'); return; }
    const reason = (dkcvDraft.reason || '').trim();
    if (!reason) { U.toast('Vui lòng nhập lý do đề xuất'); return; }
    const acc = A.currentAccount(), actorName = acc ? acc.fullName : 'Không rõ', nowAt = U.dmy(U.today());
    r.toPointId = target.id;
    r.plan = { toPointId: target.id, contractCondition: dkcvDraft.contractCondition === 'RESOLVED' ? 'RESOLVED' : 'PENDING' };
    r.reason = reason; r.note = (dkcvDraft.note || '').trim();
    r.attachments = dkcvDraft.files.map(name => ({ name }));
    const plannedEntry = r.timeline.find(x => x.key === 'planned');
    if (plannedEntry) { plannedEntry.at = nowAt; plannedEntry.by = actorName; } else r.timeline.push({ key: 'planned', at: nowAt, by: actorName });
    U.log(`Lập phương án chuyển đổi vị trí ${st.code} → ${target.code} (yêu cầu ${r.id})`);
    A.save();
    dkcvMode = null; dkcvPlanEditId = null; dkcvDraft = null;
    dkReqRerenderDrawer(r);
    A.render();
    U.toast('Đã lưu phương án chuyển đổi vị trí ' + st.code + ' → ' + target.code);
  };
  A.ACT['dkconvert-submit'] = el => {
    const r = dkReqFind(el.dataset.id);
    if (!r || r.type !== 'CONVERT' || !dkcvOwned(r) || !A.canDo('diem-kd.chuyen-doi.gui-phe-duyet', r.market) || r.status !== 'STAFF_REVIEW') return;
    if (!r.plan || !r.plan.toPointId) { U.toast('Chưa có phương án — cần chọn điểm đích trước khi gửi'); return; }
    const st = A.idx.stall.get(r.fromPointId), target = A.idx.stall.get(r.plan.toPointId);
    if (!dkConvertSourceEligible(st, r.id)) { U.toast('Điểm nguồn không còn đủ điều kiện, cần kiểm tra lại trước khi gửi'); return; }
    if (!target || !dkConvertTargetEligible(target, st, r.id)) { U.toast('Điểm đích không còn hợp lệ, cần sửa lại phương án trước khi gửi'); return; }
    const acc = A.currentAccount(), actorName = acc ? acc.fullName : 'Không rõ';
    r.status = 'PENDING_APPROVAL';
    r.timeline.push({ key: 'submitted', at: U.dmy(U.today()), by: actorName });
    U.log(`Gửi yêu cầu chuyển đổi vị trí ${r.id} cho Trưởng Ban Quản lý phê duyệt`);
    A.save();
    dkReqRerenderDrawer(r);
    A.render();
    U.toast(`Yêu cầu chuyển đổi vị trí ${st.code} → ${target.code} đang chờ phê duyệt.`);
  };
  A.ACT['dkconvert-approve'] = el => {
    const r = dkReqFind(el.dataset.id);
    if (!r || r.type !== 'CONVERT' || !A.canDo('diem-kd.chuyen-doi.phe-duyet', r.market) || r.status !== 'PENDING_APPROVAL') return;
    const acc = A.currentAccount(), actorName = acc ? acc.fullName : 'Không rõ';
    r.status = 'APPROVED';
    r.timeline.push({ key: 'approved', at: U.dmy(U.today()), by: actorName });
    U.log(`Phê duyệt yêu cầu chuyển đổi vị trí ${r.id}`);
    A.save();
    dkReqRerenderDrawer(r);
    A.render();
    U.toast('Yêu cầu chuyển đổi vị trí đã được phê duyệt.');
  };
  // Hộp "Lý do từ chối" RIÊNG cho CONVERT — dùng CHUNG state dkReqRejectId/dkRejectReasonDraft với
  // SPLIT (không cần 2 bộ biến), nhưng KHÔNG dùng chung dkReqRejectBoxHtml() vì hàm đó hard-code
  // data-act="dkreq-reject-cancel"/"dkreq-reject-save" (handler CỦA SPLIT, sai permKey/log nếu áp
  // dụng cho request CONVERT) — viết riêng để trỏ đúng dkconvert-reject-cancel/dkconvert-reject-save.
  function dkConvertRejectBoxHtml(r) {
    if (dkReqRejectId !== r.id) return '';
    return `<div class="note" style="margin:10px 0">
      <div class="field"><label>Lý do từ chối *</label><textarea class="input" rows="2" data-in="dkreq-reject-reason">${U.esc(dkRejectReasonDraft)}</textarea></div>
      <div class="row" style="justify-content:flex-end;margin-top:8px">
        <button class="btn sm" data-act="dkconvert-reject-cancel" data-id="${r.id}">Hủy</button>
        <button class="btn sm danger" data-act="dkconvert-reject-save" data-id="${r.id}">Xác nhận từ chối</button>
      </div></div>`;
  }
  A.ACT['dkconvert-reject-open'] = el => {
    const r = dkReqFind(el.dataset.id);
    if (!r || r.type !== 'CONVERT' || !A.canDo('diem-kd.chuyen-doi.phe-duyet', r.market) || r.status !== 'PENDING_APPROVAL') return;
    dkReqRejectId = r.id; dkRejectReasonDraft = '';
    dkReqRerenderDrawer(r);
  };
  A.ACT['dkconvert-reject-cancel'] = el => {
    dkReqRejectId = null; dkRejectReasonDraft = '';
    const r = dkReqFind(el.dataset.id);
    if (r) dkReqRerenderDrawer(r);
  };
  A.ACT['dkconvert-reject-save'] = el => {
    const r = dkReqFind(el.dataset.id);
    if (!r || r.type !== 'CONVERT' || !A.canDo('diem-kd.chuyen-doi.phe-duyet', r.market) || r.status !== 'PENDING_APPROVAL') return;
    const reason = (dkRejectReasonDraft || '').trim();
    if (!reason) { U.toast('Vui lòng nhập lý do từ chối'); return; }
    const acc = A.currentAccount(), actorName = acc ? acc.fullName : 'Không rõ';
    r.status = 'REJECTED';
    r.timeline.push({ key: 'approved', at: U.dmy(U.today()), by: actorName, note: 'Từ chối: ' + reason });
    U.log(`Từ chối yêu cầu chuyển đổi vị trí ${r.id} — lý do: ${reason}`);
    A.save();
    dkReqRejectId = null; dkRejectReasonDraft = '';
    dkReqRerenderDrawer(r);
    A.render();
    U.toast('Yêu cầu chuyển đổi vị trí đã bị từ chối.');
  };
  // ---- "Thực hiện chuyển đổi vị trí" — re-check TOÀN BỘ điều kiện ngay trong handler (mục Execution) ----
  A.ACT['dkconvert-execute'] = el => {
    const r = dkReqFind(el.dataset.id), acc = A.currentAccount();
    if (!r || r.type !== 'CONVERT') return;
    if (!acc || acc.status !== 'active' || ui.market !== 'CL' || A.allowedMarkets(acc).indexOf('CL') < 0) { U.toast('Tài khoản hoặc phạm vi chợ không hợp lệ'); return; }
    if (!dkcvOwned(r) || !A.canDo('diem-kd.chuyen-doi.thuc-hien', r.market)) { U.toast('Chỉ người phụ trách được thực hiện chuyển đổi vị trí.'); return; }
    if (r.market !== 'CL' || r.status !== 'APPROVED') { U.toast('Yêu cầu chưa ở trạng thái Đã phê duyệt'); return; }
    if (!r.plan || !r.plan.toPointId) { U.toast('Yêu cầu chưa có phương án hợp lệ'); return; }
    const st = A.idx.stall.get(r.fromPointId), target = A.idx.stall.get(r.plan.toPointId);
    if (!dkConvertSourceEligible(st, r.id)) { U.toast('Điểm nguồn không còn đủ điều kiện thực hiện'); return; }
    if (!dkConvertTargetEligible(target, st, r.id)) { U.toast('Điểm đích đã thay đổi (không còn trống hoặc không hợp lệ) — không thể thực hiện'); return; }
    if (dkConvertHasBlocker(dkConvertConditions(r, st, target))) { U.toast('Còn điều kiện bị chặn, không thể thực hiện'); return; }
    if (r.plan.contractCondition !== 'RESOLVED') { U.toast('Điều kiện hợp đồng chưa hoàn tất'); return; }
    const trader = st.traderId ? A.idx.trader.get(st.traderId) : null;
    if (!trader) { U.toast('Điểm nguồn không còn người sử dụng hợp lệ'); return; }
    const actorName = acc.fullName, nowAt = U.dmy(U.today());
    // SOURCE → trống, giữ nguyên point/pointCode/geometry/lịch sử.
    st.status = 'trong'; st.traderId = null; st.sellerId = null; st.contractId = null;
    st.history = st.history || [];
    st.history.unshift(`${nowAt}: ${trader.name} chuyển vị trí kinh doanh sang ${target.code} theo yêu cầu ${r.id}${r.reason ? ' — Lý do: ' + r.reason : ''}`);
    // TARGET → có người sử dụng, giữ nguyên pointCode/area/geometry; KHÔNG tự tạo/gán hợp đồng.
    target.status = 'thue'; target.traderId = trader.id;
    target.history = target.history || [];
    target.history.unshift(`${nowAt}: Tiếp nhận chuyển đổi từ ${st.code} — ${trader.name} theo yêu cầu ${r.id}`);
    // TRADER: cập nhật quan hệ đang sử dụng điểm nào (t.stalls) — giữ nguyên lịch sử hợp đồng/công nợ.
    trader.stalls = trader.stalls.filter(id => id !== st.id);
    if (trader.stalls.indexOf(target.id) === -1) trader.stalls.push(target.id);
    r.status = 'COMPLETED';
    r.resultPointIds = [target.id];
    r.timeline.push({ key: 'implementing', at: nowAt, by: actorName });
    r.timeline.push({ key: 'completed', at: nowAt, by: actorName });
    U.log(`Thực hiện chuyển đổi vị trí ${st.code} → ${target.code} cho ${trader.name} (yêu cầu ${r.id})`);
    A.save();
    dkReqRerenderDrawer(r);
    A.render();
    U.toast(`Đã chuyển ${trader.name} từ ${st.code} sang ${target.code}.`);
  };

  // ---- Hậu kiểm hồ sơ sau chuyển đổi (chỉ khi COMPLETED) — tracking cơ bản, KHÔNG implement thủ tục hành chính ----
  const DKCV_POSTCHECK_LABEL = { CAN_KIEM_TRA: 'Cần kiểm tra cập nhật', DA_CAP_NHAT: 'Đã cập nhật', KHONG_AP_DUNG: 'Không áp dụng' };
  let dkcvPostCheckEditId = null;
  let dkcvPostCheckDraft = null;
  // Hậu kiểm do CHÍNH NV BQL phụ trách xuyên suốt ghi nhận (cùng người lập phương án/thực hiện) —
  // KHÔNG mở rộng cho Trưởng BQL (permKey 'phe-duyet') vì Trưởng BQL chỉ phê duyệt, không phải
  // executor (mục "ASSIGNED TO" yêu cầu gốc).
  function dkcvPostCheckCanEdit(r) { return r.type === 'CONVERT' && r.status === 'COMPLETED' && dkcvOwned(r) && A.canDo('diem-kd.chuyen-doi.tiep-nhan', r.market); }
  function dkcvPostCheckHtml(r) {
    const pc = r.postCheck;
    if (dkcvPostCheckEditId === r.id) {
      const d = dkcvPostCheckDraft;
      const opt = (key, cur) => `<option value="${key}" ${cur === key ? 'selected' : ''}>${DKCV_POSTCHECK_LABEL[key]}</option>`;
      return `<div class="note" style="margin-top:0">
        <div class="field"><label>Hợp đồng / hồ sơ sử dụng</label><select class="input" data-ch="dkcv-pc-contract">${Object.keys(DKCV_POSTCHECK_LABEL).map(k => opt(k, d.contractStatus)).join('')}</select></div>
        <div class="field" style="margin-top:8px"><label>ĐKKD / địa điểm kinh doanh</label><select class="input" data-ch="dkcv-pc-license">${Object.keys(DKCV_POSTCHECK_LABEL).map(k => opt(k, d.businessLicenseStatus)).join('')}</select></div>
        <div class="field" style="margin-top:8px"><label>Ghi chú</label><textarea class="input" rows="2" data-in="dkcv-pc-note">${U.esc(d.note)}</textarea></div>
        <div class="row" style="justify-content:flex-end;margin-top:8px">
          <button class="btn sm" data-act="dkcv-postcheck-cancel" data-id="${r.id}">Hủy</button>
          <button class="btn sm primary" data-act="dkcv-postcheck-save" data-id="${r.id}">Lưu hậu kiểm</button>
        </div></div>`;
    }
    return `<dl class="kv">
      <dt>Chuyển vị trí trong hệ thống</dt><dd><span class="tag ok">Hoàn thành</span></dd>
      <dt>Hợp đồng / hồ sơ sử dụng</dt><dd>${pc ? DKCV_POSTCHECK_LABEL[pc.contractStatus] : 'Chưa cập nhật'}</dd>
      <dt>ĐKKD / địa điểm kinh doanh</dt><dd>${pc ? DKCV_POSTCHECK_LABEL[pc.businessLicenseStatus] : 'Chưa cập nhật'}</dd>
      ${pc && pc.note ? `<dt>Ghi chú</dt><dd>${U.esc(pc.note)}</dd>` : ''}
      ${pc ? `<dt>Người xác nhận</dt><dd>${U.esc(pc.confirmedBy)} · ${U.esc(pc.confirmedAt)}</dd>` : ''}
    </dl>${dkcvPostCheckCanEdit(r) ? `<div class="row" style="justify-content:flex-end;margin-top:8px"><button class="btn sm" data-act="dkcv-postcheck-open" data-id="${r.id}">${pc ? 'Cập nhật hậu kiểm' : 'Ghi nhận hậu kiểm'}</button></div>` : ''}`;
  }
  A.ACT['dkcv-postcheck-open'] = el => {
    const r = dkReqFind(el.dataset.id);
    if (!r || !dkcvPostCheckCanEdit(r)) return;
    const pc = r.postCheck;
    dkcvPostCheckEditId = r.id;
    dkcvPostCheckDraft = { contractStatus: (pc && pc.contractStatus) || 'CAN_KIEM_TRA', businessLicenseStatus: (pc && pc.businessLicenseStatus) || 'CAN_KIEM_TRA', note: (pc && pc.note) || '' };
    dkReqRerenderDrawer(r);
  };
  A.CH['dkcv-pc-contract'] = el => { if (dkcvPostCheckDraft) dkcvPostCheckDraft.contractStatus = el.value; };
  A.CH['dkcv-pc-license'] = el => { if (dkcvPostCheckDraft) dkcvPostCheckDraft.businessLicenseStatus = el.value; };
  A.IN['dkcv-pc-note'] = el => { if (dkcvPostCheckDraft) dkcvPostCheckDraft.note = el.value; };
  A.ACT['dkcv-postcheck-cancel'] = el => { dkcvPostCheckEditId = null; dkcvPostCheckDraft = null; const r = dkReqFind(el.dataset.id); if (r) dkReqRerenderDrawer(r); };
  A.ACT['dkcv-postcheck-save'] = el => {
    const r = dkReqFind(el.dataset.id);
    if (!r || !dkcvPostCheckCanEdit(r) || !dkcvPostCheckDraft) return;
    const acc = A.currentAccount();
    r.postCheck = { systemMoved: 'DONE', contractStatus: dkcvPostCheckDraft.contractStatus, businessLicenseStatus: dkcvPostCheckDraft.businessLicenseStatus, note: (dkcvPostCheckDraft.note || '').trim(), confirmedBy: acc ? acc.fullName : 'Không rõ', confirmedAt: U.dmy(U.today()) };
    U.log(`Cập nhật hậu kiểm hồ sơ sau chuyển đổi vị trí (${r.id})`);
    A.save();
    dkcvPostCheckEditId = null; dkcvPostCheckDraft = null;
    dkReqRerenderDrawer(r);
    A.render();
    U.toast('Đã lưu hậu kiểm hồ sơ.');
  };

  // ---- Actions/Timeline/Detail cho CONVERT — dispatch từ dkReqActionsHtml/dkReqDetailHtml (giống MERGE) ----
  const DKCONVERT_STEP_LABEL = { created: 'Tạo yêu cầu', assigned: 'Phân công', received: 'Tiếp nhận', planned: 'Lập phương án', submitted: 'Gửi phê duyệt', approved: 'Phê duyệt', implementing: 'Thực hiện chuyển đổi', completed: 'Hoàn thành' };
  function dkConvertTimeline(r) {
    return `<div class="timeline">${(r.timeline || []).map(x => `<div class="timeline-i"><b>${DKCONVERT_STEP_LABEL[x.key] || x.key}</b><div class="small muted">${U.esc(x.at || '')} · ${U.esc(x.by || '')}</div>${x.note ? `<div class="small">${U.esc(x.note)}</div>` : ''}</div>`).join('')}</div>`;
  }
  function dkConvertReqActionsHtml(r) {
    const b = [];
    if (dkReqRejectId === r.id) return '';
    if (dkcvCanAccept(r)) b.push(`<button class="btn sm primary" data-act="dkconvert-accept" data-id="${r.id}">Tiếp nhận xử lý</button>`);
    if (r.status === 'STAFF_REVIEW' && dkcvOwned(r) && A.canDo('diem-kd.chuyen-doi.tiep-nhan', r.market)) {
      b.push(`<button class="btn sm" data-act="dkconvert-plan-open" data-id="${r.id}">${r.plan ? 'Sửa phương án' : 'Lập phương án'}</button>`);
      if (r.plan && A.canDo('diem-kd.chuyen-doi.gui-phe-duyet', r.market)) b.push(`<button class="btn sm primary" data-act="dkconvert-submit" data-id="${r.id}">Gửi phê duyệt</button>`);
    }
    if (r.status === 'PENDING_APPROVAL' && A.canDo('diem-kd.chuyen-doi.phe-duyet', r.market)) {
      b.push(`<button class="btn sm primary" data-act="dkconvert-approve" data-id="${r.id}">${r.source === 'MANAGER' ? 'Phê duyệt phương án' : 'Phê duyệt'}</button>`);
      b.push(`<button class="btn sm danger" data-act="dkconvert-reject-open" data-id="${r.id}">Từ chối</button>`);
    }
    if (r.status === 'APPROVED' && dkcvOwned(r) && A.canDo('diem-kd.chuyen-doi.thuc-hien', r.market)) {
      const ok = r.plan && r.plan.contractCondition === 'RESOLVED';
      b.push(`<button class="btn sm primary" data-act="dkconvert-execute" data-id="${r.id}" ${ok ? '' : 'disabled'}>Thực hiện chuyển đổi</button>`);
    }
    return b.join('');
  }
  function dkConvertReqDetailHtml(r) {
    const st = A.idx.stall.get(r.fromPointId);
    const target = r.plan && r.plan.toPointId ? A.idx.stall.get(r.plan.toPointId) : (r.toPointId ? A.idx.stall.get(r.toPointId) : null);
    const canXemHoSo = st && A.canDo('so-do.xem-ho-so', st.market);
    return `<div class="drawer-h detail-form-head" style="flex-wrap:wrap"><div><h3>${r.id} · Chuyển đổi vị trí</h3><div class="small muted">${dkReqStatusTag(r.status)}</div></div><span class="spacer"></span>
        <div class="row" style="gap:6px">${dkConvertReqActionsHtml(r)}</div>
        <button class="x" data-act="close" aria-label="Đóng">×</button></div><div class="detail-form-tabs">${U.icon('file')} Chi tiết yêu cầu thay đổi điểm</div>
      <div class="drawer-b merge-request-detail">
        ${dkConvertRejectBoxHtml(r)}
        <section class="merge-detail-section"><h4>A. Thông tin yêu cầu</h4><div class="merge-info-grid">
          <dl class="kv">
            <dt>Mã yêu cầu</dt><dd>${r.id}</dd>
            <dt>Loại yêu cầu</dt><dd>Chuyển đổi vị trí điểm kinh doanh</dd>
            <dt>Nguồn đề nghị</dt><dd>${dkReqSourceLabel(r.source)}</dd>
            <dt>Người đề nghị</dt><dd>${U.esc(r.requestedByName)}</dd>
            <dt>Lý do</dt><dd>${U.esc(r.reason) || 'Chưa ghi nhận'}</dd>
            ${r.note ? `<dt>Ghi chú</dt><dd>${U.esc(r.note)}</dd>` : ''}
          </dl>
          <div class="merge-status-box"><div class="small muted">Trạng thái</div>${dkReqStatusTag(r.status)}<dl class="kv"><dt>Ngày đề nghị</dt><dd>${U.dmy(r.requestedAt)}</dd><dt>Người phụ trách</dt><dd>${U.esc(dkReqAssigneeName(r))}</dd><dt>Trạng thái trách nhiệm</dt><dd>${U.esc(dkReqResponsibilityText(r))}</dd></dl></div>
        </div></section>
        <section class="merge-detail-section"><h4>B. Hiện trạng & vị trí đề xuất</h4>
          <div class="merge-flow">
            ${st ? `<div class="merge-flow-source"><b>${st.code}</b><span>${st.area} m² · ${U.esc(st.sectionName)}</span></div>` : '<div class="note">Điểm nguồn không còn tồn tại.</div>'}
            <div class="merge-flow-arrow">→</div>
            ${target ? `<div class="merge-flow-source"><b>${target.code}</b><span>${target.area} m² · ${U.esc(target.sectionName)}</span></div>` : '<div class="note">Chưa có phương án (chưa chọn điểm đích).</div>'}
          </div>
          ${st ? `<div class="row" style="margin:0 12px 10px;gap:6px">
            <button class="btn sm" data-act="dkreq-view-point" data-id="${r.id}" data-point="${st.id}">Xem điểm nguồn</button>
            ${target ? `<button class="btn sm" data-act="dkreq-view-point" data-id="${r.id}" data-point="${target.id}">Xem điểm đích</button>` : ''}
            ${st.traderId && canXemHoSo ? `<button class="btn sm" data-act="dkreq-view-trader" data-id="${r.id}" data-trader="${st.traderId}" data-point="${st.id}">Xem hồ sơ tiểu thương</button>` : ''}
          </div>` : ''}
        </section>
        <section class="merge-detail-section"><h4>C. Kiểm tra điều kiện & phương án</h4>
          ${st && target ? `${dkConvertCompareHtml(st, target)}${dkConvertConditionsHtml(r, st, target)}
            <div class="small" style="padding:0 12px 10px">Ảnh hưởng dự kiến: <b>${st.code}</b> → trở thành trống; <b>${target.code}</b> → ${U.esc(r.requestedByName)} chuyển sang sử dụng; Hợp đồng → cần xử lý riêng (không tự động).</div>`
            : '<div class="note" style="margin:0 12px 10px">Chưa đủ dữ liệu để kiểm tra điều kiện (chưa chọn điểm đích).</div>'}
        </section>
        <section class="merge-detail-section"><h4>D. Quá trình xử lý</h4>${dkConvertTimeline(r)}</section>
        ${r.status === 'COMPLETED' ? `<section class="merge-detail-section"><h4>E. Hồ sơ sau chuyển đổi</h4><div style="padding:12px">${dkcvPostCheckHtml(r)}</div></section>` : ''}
      </div>`;
  }
  // Dispatch từ dkReqActionsHtml/dkReqDetailHtml (2 điểm gọi hiện có, cùng pattern MERGE) — thêm bên
  // dưới, không sửa 2 hàm gốc quá nhiều (chỉ thêm đúng 1 nhánh `if (r.type === 'CONVERT') ...` mỗi hàm).

  // ---- API dùng chung cho Mini App (thêm cho CONVERT, KHÔNG đổi A.pointReq.activeFor hiện có —
  // giữ nguyên hành vi SPLIT/MERGE — chỉ BỔ SUNG member mới) ----
  A.pointReq.convertTargetCandidates = (source, exceptId) => dkConvertTargetCandidates(source, exceptId);
  A.pointReq.convertActiveConflict = (pointId, exceptId) => dkConvertActiveConflict(pointId, exceptId || null);

  // ---- Chợ quê TTĐ / fallback: bảng tổng quát cũ, KHÔNG đổi (ngoài phạm vi task CL) ----
  function dkRows() {
    const q = (f.dkSearch || '').toLowerCase();
    return A.db.stalls.filter(s => U.inM(s)
      && (!f.dkSection || s.market + ':' + s.section === f.dkSection)
      && (!f.dkStatus || s.status === f.dkStatus)
      && (!q || s.code.toLowerCase().includes(q) || (s.traderId && A.idx.trader.get(s.traderId).name.toLowerCase().includes(q))));
  }
  function dkLine(s) {
    const t = s.traderId ? A.idx.trader.get(s.traderId) : null, c = s.contractId ? A.idx.contract.get(s.contractId) : null;
    return [s.code, U.mShort(s.market), s.sectionName, s.cat, U.typeLabel(s.type), s.area, U.unitLabel(s), c && c.monthly ? c.monthly : '', t ? t.name : '', D.STATUS[s.status].label];
  }
  function dkViewGeneric() {
    const rows = dkRows(), pg = U.pager('dk', rows.length, 25);
    const sections = [];
    D.MARKETS.filter(m => ui.market === 'ALL' || m.id === ui.market).forEach(m => m.floors.forEach(fl => fl.sections.forEach(s => sections.push([m.id + ':' + s.id, (ui.market === 'ALL' ? m.short + ' · ' : '') + s.name]))));
    return `<div class="card"><div class="card-h"><h3>Danh mục điểm kinh doanh</h3>
      <select class="input" data-ch="dk-section"><option value="">Tất cả khu vực</option>${sections.map(s => `<option value="${s[0]}" ${f.dkSection === s[0] ? 'selected' : ''}>${U.esc(s[1])}</option>`).join('')}</select>
      <select class="input" data-ch="dk-status"><option value="">Mọi trạng thái</option>${Object.keys(D.STATUS).map(k => `<option value="${k}" ${f.dkStatus === k ? 'selected' : ''}>${D.STATUS[k].label}</option>`).join('')}</select>
      <input class="input" placeholder="Mã điểm / tiểu thương" data-in="dk-search" value="${U.esc(f.dkSearch || '')}">
      <button class="btn" data-act="dk-csv">⬇ Xuất Excel</button></div>
      <div class="card-b">${U.table([{ t: 'Mã điểm' }, { t: 'Chợ' }, { t: 'Khu vực' }, { t: 'Loại' }, { t: 'DT (m²)', num: true }, { t: 'Đơn giá' }, { t: 'Giá/tháng', num: true }, { t: 'Tiểu thương' }, { t: 'Trạng thái' }],
        rows.slice(pg.start, pg.end).map(s => {
          const l = dkLine(s);
          return `<tr class="click" data-act="dk-open" data-id="${s.id}"><td><b>${l[0]}</b></td><td>${l[1]}</td><td>${U.esc(l[2])}</td><td>${l[4]}</td><td class="num">${l[5].toLocaleString('vi-VN')}</td><td class="nowrap">${l[6]}</td><td class="num">${l[7] ? U.money(l[7]) : '–'}</td><td>${U.esc(l[8]) || '<span class="muted">–</span>'}</td><td>${U.statusTag(s.status)}</td></tr>`;
        }))}${pg.html}
        <div class="small muted" style="margin-top:8px">Lịch sử tách, gộp, chuyển đổi điểm kinh doanh (nếu có) được lưu vết đầy đủ trong hồ sơ từng điểm.</div></div></div>`;
  }
  A.CH['dk-section'] = el => { f.dkSection = el.value; ui.page.dk = 0; A.render(); };
  A.CH['dk-status'] = el => { f.dkStatus = el.value; ui.page.dk = 0; A.render(); };
  A.IN['dk-search'] = el => { f.dkSearch = el.value; ui.page.dk = 0; A.render(); };
  A.ACT['dk-csv'] = () => U.csv('diem-kinh-doanh', ['Mã điểm', 'Chợ', 'Khu vực', 'Ngành hàng', 'Loại', 'Diện tích m2', 'Đơn giá', 'Giá dịch vụ/tháng', 'Tiểu thương', 'Trạng thái'], dkRows().map(dkLine));

  A.VIEWS['mat-bang'] = () => ui.market === 'CL' ? clLayoutView() : A.mbWorkspaceHtml();
  A.VIEWS['diem-kd'] = () => ui.market === 'CL' ? clLayoutView() : dkViewGeneric();
  // Click "Xem" trên bảng danh mục = mở drawer GỐC (không phải drill-down) — reset navigation
  // stack trước khi vẽ (mục 6 yêu cầu back navigation: không hiện "← Quay lại" giả).
  A.ACT['dk-open'] = el => { A.drawerReset(); A.openDkDrawer(A.idx.stall.get(el.dataset.id)); };
  // "Xem hồ sơ tiểu thương" NGAY TRONG drawer chi tiết điểm KD (Phần B) — mở drawer CON: đẩy cách vẽ
  // lại đúng drawer điểm KD hiện tại vào navigation stack (label = mã điểm) để "← Quay lại <mã
  // điểm>" hoạt động đúng khi xem xong hồ sơ tiểu thương quay lại (khác hẳn `trader`/`dk-open` vốn
  // là mở GỐC nên luôn reset stack).
  A.ACT['dkcl-open-trader'] = el => {
    const st = A.idx.stall.get(el.dataset.stall);
    const t = A.idx.trader.get(el.dataset.id);
    if (!st || !t || !A.canDo('so-do.xem-ho-so', st.market)) return;
    A.drawerPush(st.code, () => dkRerenderDrawer(st));
    A.openTraderDrawer(t);
  };

  // ---------- Tiểu thương ----------
  // Chợ Cao Lãnh (selectedMarket = CL): màn hồ sơ tiểu thương riêng theo yêu cầu
  // TIEU_THUONG_CL_SCREEN_REFACTOR (xem TIEU_THUONG_CL_SCREEN_REFACTOR_REPORT.md). Quan hệ lọc theo
  // Khu vực/Ngành hàng đi qua ĐÚNG chuỗi TIỂU THƯƠNG → HỢP ĐỒNG/QUAN HỆ THUÊ (t.stalls) → ĐIỂM KINH
  // DOANH (A.idx.stall) → KHU VỰC (st.section)/NGÀNH HÀNG (st.cat) — KHÔNG thêm field "khu vực" vào
  // trader, không duplicate dữ liệu. State filter RIÊNG (f.ttcl*, ui.page.ttcl) — tách biệt hoàn
  // toàn với f.tt*/ui.page.tt bên dưới (ttRows/ttViewGeneric, dùng cho TTD/market khác — KHÔNG đổi).
  // HOTFIX (drawer edit inline, xem báo cáo): id tiểu thương đang ở EDIT MODE trong drawer CL — null
  // = VIEW MODE (mặc định). Chỉ 1 drawer CL có thể mở tại 1 thời điểm nên 1 biến module là đủ, không
  // cần lưu theo từng trader. Reset về null mỗi khi mở lại drawer từ đầu (A.ACT.trader) hoặc sau khi
  // Hủy/Lưu — đảm bảo "mặc định mở drawer: VIEW MODE" (mục 2 yêu cầu).
  let ttEditId = null;
  // HOTFIX (mục 9-11 yêu cầu): giấy tờ đang chờ thay thế trong EDIT MODE hiện tại — { [docKey]:
  // {fileName} }. CHỈ là state tạm phía FE, chưa ghi vào trader.docFiles cho tới khi bấm "Lưu thay
  // đổi" (tt-edit-save); "Hủy" xóa sạch, không để sót giữa các lần mở drawer khác nhau.
  let ttPendingDocs = {};
  // 4 giấy tờ cố định của hồ sơ số hóa CL (mục 12/17 yêu cầu TRADER_PROFILE_AND_MINIAPP_WORKFLOW —
  // tách CCCD mặt trước/sau thành 2 card riêng thay vì 1 card "CCCD 2 mặt" gộp trước đây). key dùng
  // làm field trong trader.docFiles, label dùng để hiển thị/mock preview. Đây là NGUỒN DUY NHẤT cho
  // cả wizard "+ Thêm tiểu thương" (xem TT_WIZARD_STEP_LABEL/ttWizardStep3Html bên dưới) lẫn Section
  // B của drawer chi tiết — không tạo danh mục giấy tờ song song. Key cũ 'cccd' (gộp) của dữ liệu cũ
  // (nếu có trong docFiles đã lưu) không còn được đọc — chỉ là mock metadata rỗng mặc định nên không
  // có dữ liệu thật nào bị mất.
  const TT_DOCS = [
    { key: 'cccdFront', label: 'CCCD - Mặt trước' },
    { key: 'cccdBack', label: 'CCCD - Mặt sau' },
    { key: 'dkkd', label: 'Giấy chứng nhận đăng ký kinh doanh' },
    { key: 'avatar', label: 'Ảnh chân dung' }
  ];
  // Expose cho js/mini.js (đăng ký/bổ sung hồ sơ Mini App dùng ĐÚNG danh mục này — mục 32 yêu cầu
  // "không duplicate trader data"). v-tieuthuong.js load TRƯỚC mini.js (xem index.html) nên luôn có
  // giá trị khi mini.js thực thi.
  A.ttDocDefs = TT_DOCS;
  // Attachment của prototype được lưu cùng record sở hữu. Ảnh mới giữ thêm data URL để
  // có thể xem lại sau reload localStorage; PDF/tệp khác chỉ giữ metadata, không giả preview.
  function ttCaptureFile(file, done) {
    const meta = { name: file.name, type: file.type || '', size: Number(file.size || 0), addedAt: U.today(), mock: true };
    if (!file.type || file.type.indexOf('image/') !== 0) return done(meta);
    const reader = new FileReader();
    reader.onload = () => done(Object.assign(meta, { dataUrl: reader.result }));
    reader.onerror = () => done(meta);
    reader.readAsDataURL(file);
  }
  function ttDocLabel(key) { const doc = TT_DOCS.find(x => x.key === key); return doc ? doc.label : 'Hồ sơ khác'; }
  function ttFileCanPreview(file) { return !!(file && file.dataUrl && String(file.dataUrl).indexOf('data:image/') === 0); }
  function ttFileMetaLabel(file) {
    if (!file) return 'Chưa có';
    if (file.type === 'application/pdf' || /\.pdf$/i.test(file.name || '')) return 'PDF · Đã tải lên';
    return ttFileCanPreview(file) ? 'Ảnh · Đã tải lên' : 'Đã tải lên';
  }
  function ttFileViewHtml(title, file) {
    const preview = ttFileCanPreview(file) ? `<img class="tt-file-preview" src="${U.esc(file.dataUrl)}" alt="${U.esc(title)}">` : '<div class="note info">Prototype chỉ có metadata của tệp này, chưa có dữ liệu xem trước.</div>';
    return A.mHead('Xem tài liệu') + `<div class="modal-b"><p><b>${U.esc(title)}</b></p><p class="small muted">${U.esc(file && file.name || '')}</p>${preview}</div><div class="modal-f"><button class="btn primary" data-act="close">Đóng</button></div>`;
  }
  // Hồ sơ sử dụng điểm là adapter bổ sung cho quan hệ sẵn có trader.stalls <->
  // stall.traderId. Nó giữ dữ liệu theo TỪNG điểm (không thay thế contracts).
  function ttUsageStore() { return Array.isArray(A.db.pointUsages) ? A.db.pointUsages : (A.db.pointUsages = []); }
  function ttActiveUsage(pointId) { return ttUsageStore().find(x => x.pointId === pointId && x.status === 'ACTIVE') || null; }
  function ttUsageFor(t, pointId) { return ttUsageStore().find(x => x.traderId === t.id && x.pointId === pointId && x.status === 'ACTIVE') || null; }
  function ttUsageStart(t, st) { const u = ttUsageFor(t, st.id); return u ? u.startDate : ((st.contractId && A.idx.contract.get(st.contractId) || {}).start || t.since || ''); }
  function ttPointPath(st) { const p = A.mbLayoutPathForPoint ? A.mbLayoutPathForPoint(st.market, st) : null; return p ? [p.khu, p.tang, p.day, st.code].filter(x => x && x !== '—').join(' → ') : [st.sectionName, st.code].filter(Boolean).join(' → '); }
  function ttSectionsOf(t) {
    return t.stalls.map(id => A.idx.stall.get(id)).filter(Boolean).map(st => st.section);
  }
  // Cột "Khu vực" ở bảng danh sách (mục 3-4 yêu cầu hotfix) — suy ra từ ĐÚNG quan hệ Trader → Điểm
  // KD (t.stalls) → st.sectionName đã có, KHÔNG thêm field "area" giả vào trader. Dedupe bằng Set để
  // nhiều điểm cùng khu vực không lặp tên khu (mục 4 yêu cầu: "Khu A, Khu A" → chỉ còn "Khu A").
  function ttSectionNamesOf(t) {
    const names = t.stalls.map(id => A.idx.stall.get(id)).filter(Boolean).map(st => st.sectionName);
    return Array.from(new Set(names));
  }
  function ttCatsOf(t) {
    const stalls = t.stalls.map(id => A.idx.stall.get(id)).filter(Boolean);
    return stalls.length ? Array.from(new Set(stalls.map(st => st.cat))) : [t.cat || 'Chưa gán'];
  }
  // ==================== TRADER_PROFILE_AND_MINIAPP_WORKFLOW ====================
  // CORRECTION (xem TRADER_PROFILE_MINIAPP_CORRECTION_REPORT.md): Mini App KHÔNG còn tự đăng ký hồ
  // sơ — Trader Profile luôn do NV BQL tạo trước (mục 7), Mini App chỉ TRA CỨU theo SĐT rồi
  // đăng nhập/kích hoạt (js/mini.js). Vì vậy: bỏ hẳn khái niệm PENDING_LINK (miniLinkRequests không
  // còn nguồn phát sinh nào trong runtime mới — field/collection GIỮ LẠI trong data.js chỉ để tương
  // thích, không đọc nữa) và bỏ tab "Chờ xác minh" (không còn cách nào tạo ra trạng thái này nữa,
  // hiển thị 1 tab luôn rỗng là dead UI). `profileStatus` vẫn giữ nguyên 4 giá trị + 3 tab lọc còn
  // lại (Tất cả/Đang hoạt động/Cần bổ sung/Ngừng hoạt động) — 2 trạng thái NEEDS_SUPPLEMENT/INACTIVE
  // không còn cách set qua UI ở V1 nhưng field vẫn hữu ích để BQL gán tay sau này qua "Chỉnh sửa
  // thông tin" (ngoài phạm vi task này) hoặc nghiệp vụ tương lai — fallback 'ACTIVE' cho record thiếu
  // field.
  const TT_PROFILE_LABEL = { ACTIVE: 'Đang hoạt động', PENDING_VERIFICATION: 'Chờ xác minh', NEEDS_SUPPLEMENT: 'Cần bổ sung', INACTIVE: 'Ngừng hoạt động' };
  const TT_PROFILE_CLASS = { ACTIVE: 'ok', PENDING_VERIFICATION: 'warn', NEEDS_SUPPLEMENT: 'danger', INACTIVE: '' };
  function ttProfileStatus(t) { return t.profileStatus || 'ACTIVE'; }
  function ttProfileStatusTag(t) { const s = ttProfileStatus(t); return `<span class="tag ${TT_PROFILE_CLASS[s] || ''}">${TT_PROFILE_LABEL[s] || s}</span>`; }
  // Tài khoản Mini App liên kết với hồ sơ — đọc qua A.ACCOUNTS.byTraderId (account.traderId — xem
  // js/accounts.js), KHÔNG dùng `t.app` (cờ "đã cài đặt app" thuần cũ, giữ nguyên cho các màn khác
  // đang dùng — dashboard/báo cáo/công nợ ngoài phạm vi feature này). Nhãn nghiệp vụ đổi sang
  // "kích hoạt" (mục 18 yêu cầu correction — Mini App giờ là "kích hoạt bằng SĐT+OTP", không phải
  // "liên kết hồ sơ đăng ký") — CHỈ đổi label hiển thị, KHÔNG đổi giá trị kỹ thuật NOT_LINKED/LINKED/
  // LOCKED (giữ nguyên để tương thích, xem A.ACCOUNTS.byTraderId/ttCreateLinkedAccount dùng chung
  // cho cả wizard cũ đã bỏ lẫn luồng OTP mới).
  function ttLinkedAccount(t) { return A.ACCOUNTS.byTraderId(t.id); }
  function ttMiniAppState(t) {
    const acc = ttLinkedAccount(t);
    return acc ? (acc.status === 'active' ? 'LINKED' : 'LOCKED') : 'NOT_LINKED';
  }
  const TT_MINIAPP_LABEL = { NOT_LINKED: 'Chưa kích hoạt', LINKED: 'Đã kích hoạt', LOCKED: 'Đã khóa' };
  const TT_MINIAPP_CLASS = { NOT_LINKED: '', LINKED: 'ok', LOCKED: 'danger' };
  function ttMiniAppTag(t) { const s = ttMiniAppState(t); return `<span class="tag ${TT_MINIAPP_CLASS[s]}">${TT_MINIAPP_LABEL[s]}</span>`; }
  function ttclHasFilter() {
    return !!(f.ttclFloor || f.ttclSection || f.ttclCat || f.ttclApp || (f.ttclSearch && f.ttclSearch.trim()));
  }
  // Search theo tên/SĐT/CCCD/mã tiểu thương/mã điểm KD (mục 5 yêu cầu — CCCD ĐƯỢC search dù bảng
  // chính không hiển thị CCCD đầy đủ; kết quả search không làm lộ thêm dữ liệu vì bảng vẫn mask).
  function ttSearchMatchCL(t, q) {
    if (t.name.toLowerCase().includes(q)) return true;
    if (t.phone.includes(q)) return true;
    if ((t.idNo || '').includes(q)) return true;
    if (t.id.toLowerCase().includes(q)) return true;
    return t.stalls.some(id => { const st = A.idx.stall.get(id); return st && st.code.toLowerCase().includes(q); });
  }
  // Lọc kết hợp được (giống pattern đã dùng ở Điểm kinh doanh CL): 1 tiểu thương = 1 dòng, chỉ cần
  // MỘT trong các điểm đang thuê thỏa khu vực/ngành hàng đang lọc là đủ để tiểu thương đó xuất hiện —
  // không flatten theo điểm nên không thể duplicate dòng.
  function ttRowsCL() {
    const q = (f.ttclSearch || '').trim().toLowerCase();
    return A.db.traders.filter(t => U.inM(t)
      && (!f.ttclFloor || t.stalls.some(id => { const st=A.idx.stall.get(id); return st && st.floor===f.ttclFloor; }))
      && (!f.ttclSection || ttSectionsOf(t).includes(f.ttclSection))
      && (!f.ttclCat || ttCatsOf(t).includes(f.ttclCat))
      && (!f.ttclApp || ttMiniAppState(t) === f.ttclApp)
      && (!q || ttSearchMatchCL(t, q)));
  }
  function ttRowHtmlCL(t) {
    const debt = U.traderDebt(t.id), over = U.traderOverdue(t.id);
    // Bảng chính bỏ Điện thoại/Địa chỉ/CCCD đầy đủ (mục 4/35 yêu cầu) — dữ liệu model KHÔNG đổi, vẫn
    // xem đủ trong drawer chi tiết (Section A) và vẫn tìm được qua ô search (ttSearchMatchCL).
    const area = ttSectionNamesOf(t).join(', ') || '–';
    const points = t.stalls.map(id => A.idx.stall.get(id)).filter(Boolean);
    const pointLabel = points.length > 1 ? points.length + ' điểm' : (points[0] ? points[0].code : '–');
    const updated = (t.updatedAt || t.since || '').split('-').reverse().join('/');
    return `<tr class="click" data-act="trader" data-id="${t.id}">
      <td>${t.id}</td><td><b>${U.esc(t.name)}</b></td><td>${U.maskPhone(t.phone)}</td><td>${U.maskId(t.idNo)}</td>
      <td title="${U.esc(area)}">${U.esc(pointLabel)}</td><td>${U.esc(ttCatsOf(t).join(', '))}</td><td>${updated || '–'}</td>
      <td class="nowrap"><button class="btn sm" data-act="trader" data-id="${t.id}">Xem</button></td></tr>`;
  }
  function ttViewCL() {
    const rows = ttRowsCL();
    const pg = U.pager('ttcl', rows.length, 25);
    const m = U.market('CL');
    const sections = [], cats = [];
    m.floors.forEach(fl => fl.sections.forEach(s => { sections.push([s.id, s.name]); if (!cats.includes(s.cat)) cats.push(s.cat); }));
    const body = U.table([{ t: 'Mã TT' }, { t: 'Họ tên' }, { t: 'Số điện thoại' }, { t: 'Số giấy tờ' }, { t: 'Điểm KD' }, { t: 'Ngành hàng' }, { t: 'Ngày cập nhật' }, { t: 'Thao tác' }],
      rows.slice(pg.start, pg.end).map(ttRowHtmlCL), { empty: 'Không có tiểu thương phù hợp.' });
    return `<div class="card trader-table-card"><div class="card-h" style="flex-direction:column;align-items:stretch;gap:10px">
      <div class="row" style="justify-content:space-between;flex-wrap:wrap"><h3 style="margin:0">Hồ sơ tiểu thương</h3>
        ${A.canDo('tieu-thuong.them-moi', ui.market) ? '<button class="btn primary" data-act="tt-new">+ Thêm hồ sơ tiểu thương</button>' : ''}</div>
      <div class="row" style="flex-wrap:wrap;gap:8px">
        <select class="input" data-ch="ttcl-floor"><option value="">Tầng: Tất cả</option>${m.floors.map(x=>`<option value="${x.id}" ${f.ttclFloor===x.id?'selected':''}>${U.esc(x.name)}</option>`).join('')}</select>
        <select class="input" data-ch="ttcl-section"><option value="">Khu / dãy: Tất cả</option>${sections.map(s => `<option value="${s[0]}" ${f.ttclSection === s[0] ? 'selected' : ''}>${U.esc(s[1])}</option>`).join('')}</select>
        <select class="input" data-ch="ttcl-cat"><option value="">Tất cả ngành hàng</option>${cats.map(c => `<option ${f.ttclCat === c ? 'selected' : ''}>${U.esc(c)}</option>`).join('')}</select>
        <input class="input" placeholder="Tìm tên, SĐT, số giấy tờ, mã TT, mã điểm..." data-in="ttcl-search" value="${U.esc(f.ttclSearch || '')}">
        <button class="btn" data-act="ttcl-clear" ${ttclHasFilter() ? '' : 'disabled'}>↺ Xóa bộ lọc</button>
      </div>
      </div>
      <div class="card-b">${body}${pg.html}
        </div></div>`;
  }
  A.CH['ttcl-section'] = el => { f.ttclSection = el.value; ui.page.ttcl = 0; A.render(); };
  A.CH['ttcl-floor'] = el => { f.ttclFloor = el.value; ui.page.ttcl = 0; A.render(); };
  A.CH['ttcl-cat'] = el => { f.ttclCat = el.value; ui.page.ttcl = 0; A.render(); };
  A.CH['ttcl-app'] = el => { f.ttclApp = el.value; ui.page.ttcl = 0; A.render(); };
  A.IN['ttcl-search'] = el => { f.ttclSearch = el.value; ui.page.ttcl = 0; A.render(); };
  // "Xóa bộ lọc": reset đúng 4 state filter hiện có, KHÔNG đổi dữ liệu nghiệp vụ.
  A.ACT['ttcl-clear'] = () => {
    f.ttclFloor = ''; f.ttclSection = ''; f.ttclCat = ''; f.ttclApp = ''; f.ttclSearch = '';
    ui.page.ttcl = 0;
    A.render();
  };

  // ---- Chợ quê TTĐ / fallback: danh sách tổng quát cũ, KHÔNG đổi (ngoài phạm vi task CL) ----
  function ttRows() {
    const q = (f.ttSearch || '').toLowerCase();
    return A.db.traders.filter(t => U.inM(t)
      && (!f.ttApp || (f.ttApp === 'yes') === !!t.app)
      && (!q || t.name.toLowerCase().includes(q) || t.phone.includes(q) || t.id.toLowerCase().includes(q) || t.stalls.some(id => A.idx.stall.get(id).code.toLowerCase().includes(q))));
  }
  function ttViewGeneric() {
    const rows = ttRows(), pg = U.pager('tt', rows.length, 25);
    return `<div class="card trader-table-card"><div class="card-h"><h3>${ui.role === 'ward_leader' ? 'Tra cứu tiểu thương' : 'Hồ sơ tiểu thương'}</h3>
      <select class="input" data-ch="tt-app"><option value="">Mini app: tất cả</option><option value="yes" ${f.ttApp === 'yes' ? 'selected' : ''}>Đã cài mini app</option><option value="no" ${f.ttApp === 'no' ? 'selected' : ''}>Chưa cài</option></select>
      <input class="input" placeholder="Tên, SĐT, mã điểm KD" data-in="tt-search" value="${U.esc(f.ttSearch || '')}">
      ${A.canDo('tieu-thuong.them-moi', ui.market) ? '<button class="btn primary" data-act="tt-new">+ Thêm tiểu thương</button>' : ''}</div>
      <div class="card-b">${U.table([{ t: 'Mã' }, { t: 'Họ tên' }, { t: 'Điện thoại' }, { t: 'Chợ' }, { t: 'Ngành hàng' }, { t: 'Điểm KD' }, { t: 'Mini app' }, { t: 'Công nợ', num: true }],
        rows.slice(pg.start, pg.end).map(t => {
          const debt = U.traderDebt(t.id), over = U.traderOverdue(t.id);
          return `<tr class="click" data-act="trader" data-id="${t.id}"><td>${t.id}</td><td><b>${U.esc(t.name)}</b></td><td>${U.maskPhone(t.phone)}</td><td>${U.mShort(t.market)}</td><td>${U.esc(t.cat)}</td>
            <td>${t.stalls.map(id => A.idx.stall.get(id).code).join(', ') || '–'}</td><td>${t.app ? '<span class="tag ok">Đã cài</span>' : '<span class="tag">Chưa</span>'}</td>
            <td class="num" style="${over ? 'color:#df2225;font-weight:600' : ''}">${debt ? U.money(debt) : '–'}</td></tr>`;
        }))}${pg.html}
        <div class="small muted" style="margin-top:8px">Số điện thoại, số giấy tờ được che trên danh sách theo Nghị định 356/2025/NĐ-CP về bảo vệ dữ liệu cá nhân.</div></div></div>`;
  }
  A.VIEWS['tieu-thuong'] = () => ui.market === 'CL' ? ttViewCL() : ttViewGeneric();
  A.CH['tt-app'] = el => { f.ttApp = el.value; ui.page.tt = 0; A.render(); };
  A.IN['tt-search'] = el => { f.ttSearch = el.value; ui.page.tt = 0; A.render(); };

  // ---- Drawer hồ sơ tiểu thương — Chợ Cao Lãnh (bố cục A-E theo yêu cầu, xem báo cáo) ----
  // TTĐ/market khác: GIỮ NGUYÊN modal cũ (nhánh else trong A.ACT.trader bên dưới), không đổi 1 dòng.
  // Section B (Hồ sơ số hóa) — 3 giấy tờ được coi là hồ sơ bắt buộc đã có sẵn của tiểu thương
  // (TIEU_THUONG_CL_DRAWER_REDESIGN, xem báo cáo): chỉ còn nút "Xem" (mock preview có sẵn qua
  // tt-doc-view), KHÔNG còn badge "Đã có"/"Chưa có" (mục 6 yêu cầu).
  // Trạng thái THẬT theo t.docFiles[doc.key] (mục 6/17 yêu cầu — "Đã tải lên"/"Chưa có", không còn
  // hard-code "Đã tải lên" cho mọi giấy tờ như bản cũ). Nút "Xem" chỉ hiện khi thật sự có file mock.
  function ttDocRow(t, doc) {
    const f2 = (t.docFiles || {})[doc.key];
    return `<div class="tt-doc-tile"><span class="tt-doc-tile-icon">${U.icon('file')}</span><span class="tt-doc-label"><b>${U.esc(doc.label)}</b><small>${ttFileMetaLabel(f2)}${f2 ? ` · ${U.esc(f2.name || '')}` : ''}</small></span>${ttFileCanPreview(f2) ? `<button class="btn sm" data-act="tt-doc-view" data-id="${t.id}" data-key="${doc.key}">Xem</button>` : ''}</div>`;
  }
  function ttDetailDocRowsHtml(t) {
    const files = t.docFiles || {};
    const keys = Object.keys(files).filter(key => key !== 'avatar');
    if (!keys.length) return '<div class="tt-empty-inline">Chưa có giấy tờ cá nhân hoặc hồ sơ khác.</div>';
    return `<div class="tt-doc-list">${keys.map(key => {
      const file = files[key], label = ttDocLabel(key);
      return `<div class="tt-doc-tile"><span class="tt-doc-tile-icon">${U.icon('file')}</span><span class="tt-doc-label"><b>${U.esc(label)}</b><small>${ttFileMetaLabel(file)}${file && file.name ? ` · ${U.esc(file.name)}` : ''}</small></span>${ttFileCanPreview(file) ? `<button class="btn sm" data-act="tt-doc-view" data-id="${t.id}" data-key="${key}">Xem</button>` : ''}</div>`;
    }).join('')}</div>`;
  }
  // EDIT MODE của Hồ sơ số hóa (mục 9-11 yêu cầu hotfix): thêm nút "Thay thế" cạnh "Xem". Giấy tờ
  // nào KHÔNG bấm "Thay thế" thì giữ nguyên file cũ (mục 10) — chỉ hiện dòng "đang chờ thay thế" cho
  // đúng giấy tờ có file mới trong ttPendingDocs, chưa ghi gì vào dữ liệu thật cho tới khi Lưu.
  function ttDocRowEdit(doc) {
    const pending = ttPendingDocs[doc.key];
    const current = (A.idx.trader.get(ttEditId) || {}).docFiles || {};
    const file = pending || current[doc.key];
    return `<div style="padding:7px 0;border-bottom:1px solid #eef2f7">
      <div class="row" style="justify-content:space-between">
        <span class="tt-doc-label">${doc.label}</span>
        <span class="row" style="gap:6px">
          ${ttFileCanPreview(file) && !pending ? `<button class="btn sm" data-act="tt-doc-view" data-id="${ttEditId}" data-key="${doc.key}">Xem</button>` : ''}
          <button class="btn sm" data-act="tt-doc-replace" data-key="${doc.key}">Thay thế</button>
        </span>
      </div>
      ${pending ? `<div class="small" style="color:var(--brand);margin-top:4px">Đang chờ thay thế bằng "${U.esc(pending.name)}" — áp dụng khi bấm "Lưu thay đổi"</div>` : ''}
    </div>`;
  }
  // Section C — mỗi điểm kinh doanh 1 card riêng (mục 7 yêu cầu), người trực tiếp kinh doanh của
  // ĐÚNG điểm đó nằm ngay trong card (mục 8 yêu cầu) — không còn section D riêng cho người bán.
  // Không suy đoán "giống người thuê" khi sellerId rỗng — nhất quán với quy ước đã chốt ở drawer
  // Mặt bằng chợ (mbStallSeller): null hiển thị đúng nghĩa "chưa ghi nhận", không tự bịa dữ liệu.
  // HOTFIX (mục 4-6 yêu cầu): "Người trực tiếp kinh doanh" gộp về 1 dòng (label + tên + SĐT + badge),
  // wrap tự nhiên qua .row (flex-wrap:wrap có sẵn) thay vì 4 dòng cứng như trước. Seller khác người
  // thuê: tên clickable mở lại đúng modal thông tin cơ bản (tt-seller-view) đã có, KHÔNG gán nghĩa vụ
  // tài chính cho seller — hợp đồng/người thuê phía trên card vẫn là chủ thể với BQL.
  // HOTFIX (drawer C — tách "Vị trí" thành dòng riêng + rút gọn "Người trực tiếp kinh doanh", xem
  // báo cáo): "Vị trí" dùng ĐÚNG field thật đang có trong model (st.sectionName) — KHÔNG suy diễn/
  // tách chuỗi "sectionName · cat" cũ, không đổi schema stall chỉ để phục vụ trình bày. Người trực
  // tiếp kinh doanh rút về đúng 1 dòng label/value như Vị trí/Hợp đồng/Thời hạn: trùng người thuê
  // → chỉ tên (đã đủ thông tin ở Section A, không lặp SĐT/badge); khác người thuê → CHỈ tên
  // clickable, tái dùng NGUYÊN action tt-seller-view/permission hiện có (A.canDo bên trong handler
  // đó không đổi) — không tạo luồng nghiệp vụ mới, không thêm nút "Xem" riêng.
  function ttPointCardHtml(t, stallId) {
    const st = A.idx.stall.get(stallId);
    if (!st) return '';
    const usage = ttUsageFor(t, st.id);
    const seller = dkSeller(st);
    const sameSellerRenter = !!(seller && seller.id === t.id);
    const sellerCell = !seller
      ? '<span class="small muted">Chưa ghi nhận</span>'
      : sameSellerRenter
        ? U.esc(seller.name)
      : seller.id ? `<a href="#" data-act="tt-seller-view" data-id="${seller.id}">${U.esc(seller.name)}</a>` : U.esc(seller.name);
    const placement = usage && Array.isArray(usage.placementFiles) ? usage.placementFiles : [];
    return `<div class="plan-section tt-point-tile">
      <div class="row tt-point-title"><h4>${st.code}</h4>${U.statusTag(st.status)}</div>
      <div class="tt-point-location">${U.esc(ttPointPath(st))}</div>
      <dl class="kv">
        <dt>Ngành hàng</dt><dd>${U.esc(usage ? usage.category : st.cat)}</dd>
        <dt>Diện tích</dt><dd>${st.area.toLocaleString('vi-VN')} m²</dd>
        <dt>Ngày bắt đầu</dt><dd>${U.dmy(ttUsageStart(t, st))}</dd>
        <dt>Loại diện tích</dt><dd>${U.esc(U.areaTypeLabel(st.areaType) || 'Chưa có thông tin')}</dd>
      </dl>
      <div class="divider"></div>
      <div class="tt-point-subhead">NGƯỜI BÁN TRỰC TIẾP</div><div class="tt-seller-block">${seller ? `${sellerCell}<div class="tt-meta">${seller.phone ? U.maskPhone(seller.phone) + ' · ' : ''}${sameSellerRenter ? 'Chính tiểu thương trực tiếp bán' : 'Người trực tiếp bán'}</div>` : 'Chưa ghi nhận'}</div>
      <div class="divider"></div>
      <div class="tt-point-subhead">HỒ SƠ BỐ TRÍ</div>${placement.length ? `<div class="tt-placement-list">${placement.map((x,i) => `<div class="tt-placement-row"><span>${U.icon('file')}</span><div><b>${U.esc(x.name)}</b><small>${ttFileMetaLabel(x)}</small></div>${ttFileCanPreview(x) ? `<button class="btn sm" data-act="tt-placement-view" data-point="${st.id}" data-file="${i}">Xem</button>` : ''}</div>`).join('')}</div>` : '<div class="tt-empty-inline">Chưa có tệp</div>'}
      <div class="row tt-point-action"><button class="btn sm" data-act="tt-open-point" data-id="${st.id}" data-trader="${t.id}">${U.icon('store')}Xem chi tiết điểm kinh doanh</button></div>
    </div>`;
  }
  // Section A — VIEW MODE (mặc định khi mở drawer).
  function ttSectionAViewHtml(t) {
    const portrait = (t.docFiles || {}).avatar;
    const portraitHtml = ttFileCanPreview(portrait)
      ? `<img src="${U.esc(portrait.dataUrl)}" alt="Ảnh chân dung ${U.esc(t.name)}">`
      : `<span>${U.icon('users')}</span><small>${portrait ? 'Đã tải ảnh, chưa có dữ liệu xem trước' : 'Chưa có ảnh chân dung'}</small>`;
    return `<div class="tt-profile-layout"><div class="tt-portrait ${ttFileCanPreview(portrait) ? 'has-image' : ''}">${portraitHtml}</div><dl class="kv"><dt>Mã tiểu thương</dt><dd>${t.id}</dd><dt>Họ và tên</dt><dd>${U.esc(t.name)}</dd><dt>Số điện thoại</dt><dd>${U.maskPhone(t.phone)}</dd><dt>Loại giấy tờ</dt><dd>${U.esc(t.idType || 'CCCD')}</dd><dt>Số giấy tờ</dt><dd>${U.maskId(t.idNo)}</dd></dl></div>`;
  }
  // Section A — EDIT MODE (mục 2 yêu cầu hotfix): chỉnh ngay trong drawer, KHÔNG mở modal/drawer thứ
  // hai. Mã tiểu thương là identifier — KHÔNG đưa vào form (mục 2). Mini app không thuộc form chỉnh
  // sửa này (chưa có nghiệp vụ bật/tắt mini app từ phía BQL — giữ nguyên, ngoài phạm vi hotfix).
  function ttSectionAEditHtml(t) {
    return `<div class="form-grid"><div class="field"><label>Họ tên *</label><input class="input" id="tte-name" value="${U.esc(t.name)}"></div><div class="field"><label>Số điện thoại *</label><input class="input" id="tte-phone" value="${U.esc(t.phone)}"></div><div class="field"><label>Loại giấy tờ *</label><select class="input" id="tte-idtype"><option value="CCCD" ${(!t.idType||t.idType==='CCCD')?'selected':''}>CCCD</option><option value="CMND" ${t.idType==='CMND'?'selected':''}>CMND</option><option value="Hộ chiếu" ${t.idType==='Hộ chiếu'?'selected':''}>Hộ chiếu</option></select></div><div class="field"><label>Số giấy tờ *</label><input class="input" id="tte-idno" value="${U.esc(t.idNo)}"></div></div>
    <div class="row" style="justify-content:flex-end;margin-top:14px">
      <button class="btn" data-act="tt-edit-cancel" data-id="${t.id}">Hủy</button>
      <button class="btn primary" data-act="tt-edit-save" data-id="${t.id}">Lưu thay đổi</button>
    </div>`;
  }
  // Section E — Tài khoản Mini App (CORRECTION mục 17): CHỈ READ quan hệ Account.traderId — KHÔNG
  // còn nhánh "yêu cầu liên kết đang chờ" (PENDING_LINK đã bỏ khỏi runtime, xem ghi chú đầu file).
  // Không password management. Khóa/mở khóa chỉ đổi account.status (KHÔNG đụng profileStatus — 2
  // trục độc lập, mục 19 yêu cầu correction + NEED_CONFIRMATION #5).
  function ttMiniAppSectionHtml(t) {
    const canVerify = A.canDo('tieu-thuong.xac-minh', t.market);
    const acc = ttLinkedAccount(t);
    if (acc) {
      const locked = acc.status !== 'active';
      return `<dl class="kv">
          <dt>Trạng thái</dt><dd>${locked ? '<span class="tag danger">Đã khóa</span>' : '<span class="tag ok">Đã kích hoạt</span>'}</dd>
          <dt>Tài khoản</dt><dd>${acc.id}</dd>
          <dt>SĐT đăng nhập</dt><dd>${U.maskPhone(acc.phone || t.phone)}</dd>
          <dt>Hồ sơ liên kết</dt><dd>${t.id}</dd>
          <dt>Trạng thái truy cập</dt><dd>${locked ? 'Đã khóa' : 'Hoạt động'}</dd>
        </dl>
        ${canVerify ? `<div class="row" style="margin-top:8px"><button class="btn sm ${locked ? '' : 'danger'}" data-act="tt-miniapp-toggle" data-id="${t.id}">${locked ? 'Mở khóa truy cập' : 'Khóa truy cập'}</button></div>` : ''}`;
    }
    return `<div class="note"><span class="tag">Chưa kích hoạt</span><div style="margin-top:8px">Số điện thoại đăng ký: <b>${U.maskPhone(t.phone)}</b></div>
      <div class="small muted" style="margin-top:4px">Tiểu thương có thể sử dụng số điện thoại đã đăng ký với Ban Quản lý để kích hoạt Mini App.</div></div>
      ${canVerify ? `<div class="row" style="margin-top:8px"><button class="btn sm" data-act="tt-miniapp-copy-guide" data-id="${t.id}">Sao chép hướng dẫn</button></div>` : ''}`;
  }
  A.ACT['tt-miniapp-toggle'] = el => {
    const t = A.idx.trader.get(el.dataset.id);
    if (!t || !A.canDo('tieu-thuong.xac-minh', t.market)) return;
    const acc = ttLinkedAccount(t);
    if (!acc) return;
    const next = acc.status === 'active' ? 'disabled' : 'active';
    A.ACCOUNTS.setStatus(acc.id, next);
    U.log(`${next === 'active' ? 'Mở khóa' : 'Khóa'} truy cập Mini App của ${t.name} (${t.id})`);
    ttRerenderDrawer(t);
    A.render();
    U.toast(next === 'active' ? 'Đã mở khóa truy cập Mini App.' : 'Đã khóa truy cập Mini App.');
  };
  // Mock UI/toast thuần (mục 17 yêu cầu correction — thay "Gửi hướng dẫn đăng ký hồ sơ" cũ, không
  // còn ý nghĩa, bằng hành động nhẹ "Sao chép hướng dẫn" kích hoạt bằng SĐT). Không notification thật.
  A.ACT['tt-miniapp-copy-guide'] = el => {
    const t = A.idx.trader.get(el.dataset.id);
    if (!t || !A.canDo('tieu-thuong.xac-minh', t.market)) return;
    U.toast('Đã sao chép hướng dẫn kích hoạt Mini App (SĐT ' + U.maskPhone(t.phone) + ') — minh họa.');
  };
  // Renderer cũ được giữ làm tham chiếu compatibility; popup hiện dùng renderer bên dưới.
  function ttDrawerHtmlLegacy(t) {
    const canEdit = A.canDo('tieu-thuong.them-moi', t.market);
    const editing = canEdit && ttEditId === t.id;
    const canCongNo = U.can('cong-no');
    const debt = U.traderDebt(t.id);
    const unpaidCount = A.db.invoices.filter(i => i.traderId === t.id && i.status !== 'paid').length;
    const status = ttProfileStatus(t);
    return `<div class="drawer-h detail-form-head" style="flex-wrap:wrap"><div><div class="row" style="gap:9px"><h3>${U.esc(t.name)}</h3>${ttProfileStatusTag(t)}</div><div class="small muted" style="margin-top:2px">${t.id} · ${U.esc(U.mShort(t.market))}</div></div><span class="spacer"></span>
        ${canEdit && !editing ? `<button class="btn sm" data-act="tt-edit-open" data-id="${t.id}">${U.icon('edit')}Chỉnh sửa thông tin</button>` : ''}
        <button class="x" data-act="close" aria-label="Đóng">×</button></div><div class="detail-form-tabs">${U.icon('users')} Hồ sơ tiểu thương</div>
      <div class="drawer-b tt-detail-body">
        ${status === 'NEEDS_SUPPLEMENT' ? `<div class="note" style="margin-bottom:12px">Hồ sơ cần bổ sung: ${U.esc(t.supplementNote || 'Chưa ghi nội dung yêu cầu.')}</div>` : ''}
        <section class="tt-detail-card tt-profile-card">
        <div class="tt-detail-card-h"><span>${U.icon('users')}</span><div><b>A. Thông tin tiểu thương</b><div class="small muted">Hồ sơ định danh và thông tin kinh doanh</div></div></div>
        ${editing ? ttSectionAEditHtml(t) : ttSectionAViewHtml(t)}
        </section>
        <section class="tt-detail-card">
        <div class="tt-detail-card-h"><span>${U.icon('file')}</span><div><b>B. Hồ sơ số hóa</b><div class="small muted">Tài liệu minh họa đã lưu</div></div></div>
        <div class="tt-doc-grid">${TT_DOCS.map(d => editing ? ttDocRowEdit(d) : ttDocRow(t, d)).join('')}</div>
        </section>
        <section class="tt-detail-card tt-points-card">
        <div class="tt-detail-card-h"><span>${U.icon('store')}</span><div><b>C. Điểm kinh doanh đang sử dụng</b><div class="small muted">Vai trò tại từng điểm và hợp đồng liên quan</div></div></div>
        <div class="plan">${t.stalls.length ? t.stalls.map(id => ttPointCardHtml(t, id)).join('') : '<div class="empty small">Tiểu thương chưa có điểm kinh doanh đang sử dụng.</div>'}</div>
        </section>
        <section class="tt-detail-card">
        <div class="tt-detail-card-h"><span>${U.icon('file')}</span><div><b>Lịch sử hợp đồng</b><div class="small muted">Truy vết từ quan hệ Contract, không sao chép vào hồ sơ tiểu thương</div></div></div>
        ${(()=>{const cs=A.db.contracts.filter(c=>c.traderId===t.id).sort((a,b)=>b.start.localeCompare(a.start));return cs.length?U.table([{t:'Mã HĐ'},{t:'Điểm KD'},{t:'Thời hạn'},{t:'Trạng thái'},{t:''}],cs.map(c=>`<tr><td>${c.id}</td><td>${A.idx.stall.get(c.stallId)?A.idx.stall.get(c.stallId).code:'—'}</td><td>${U.dmy(c.start)} – ${U.dmy(c.end)}</td><td>${c.status==='hieuluc'?'<span class="tag ok">Hiệu lực</span>':'<span class="tag">'+(c.status==='chamdut'?'Đã chấm dứt':'Đã kết thúc')+'</span>'}</td><td><button class="btn sm" data-act="ct-view" data-id="${c.id}">Xem</button></td></tr>`)): '<div class="empty small">Chưa có hợp đồng.</div>';})()}
        </section>
        ${A.VEHICLES ? A.VEHICLES.traderSection(t) : ''}<section class="tt-detail-card">
        <div class="tt-detail-card-h"><span>${U.icon('money')}</span><div><b>E. Tình trạng công nợ</b><div class="small muted">Tóm tắt các khoản cần theo dõi</div></div></div>
        <dl class="kv">
          <dt>Công nợ hiện tại</dt><dd>${debt ? `<b style="color:#df2225">${U.money(debt)}</b>` : '<span class="tag ok">Không nợ</span>'}</dd>
          <dt>Khoản chưa thanh toán</dt><dd>${unpaidCount}</dd>
        </dl>
        ${canCongNo ? `<div class="row" style="margin-top:8px"><button class="btn sm" data-act="tt-open-congno">Xem chi tiết công nợ</button></div>` : ''}
        </section>
        <section class="tt-detail-card">
        <div class="tt-detail-card-h"><span>${U.icon('phone')}</span><div><b>E. Tài khoản Mini App</b><div class="small muted">Liên kết đăng nhập ứng dụng tiểu thương</div></div></div>
        ${ttMiniAppSectionHtml(t)}
        </section>
      </div><div class="drawer-f detail-form-footer"><button class="btn" data-act="close">Đóng</button></div>`;
  }
  // Chi tiết hồ sơ theo mô hình mới: dữ liệu kinh doanh nằm theo từng điểm,
  // không còn đưa Contract hoặc Mini App vào popup hồ sơ.
  function ttDrawerHtmlCL(t) {
    const canEdit=A.canDo('tieu-thuong.them-moi',t.market), editing=canEdit&&ttEditId===t.id, debt=U.traderDebt(t.id), unpaid=A.db.invoices.filter(i=>i.traderId===t.id&&i.status!=='paid').length;
    return `<div class="drawer-h detail-form-head"><div><div class="row" style="gap:9px"><h3>${U.esc(t.name)}</h3>${ttProfileStatusTag(t)}</div><div class="small muted">${t.id} · ${U.esc(U.mShort(t.market))}</div></div><span class="spacer"></span>${canEdit&&!editing?`<button class="btn sm" data-act="tt-edit-open" data-id="${t.id}">${U.icon('edit')}Chỉnh sửa thông tin</button>`:''}<button class="x" data-act="close" aria-label="Đóng">×</button></div><div class="drawer-b tt-detail-body"><section class="tt-detail-card"><div class="tt-detail-card-h"><span>${U.icon('users')}</span><div><b>A. Thông tin tiểu thương</b><div class="small muted">Thông tin nhận dạng và liên hệ</div></div></div>${editing?ttSectionAEditHtml(t):ttSectionAViewHtml(t)}</section><section class="tt-detail-card"><div class="tt-detail-card-h"><span>${U.icon('file')}</span><div><b>B. Giấy tờ & hồ sơ đính kèm</b><div class="small muted">Giấy tờ cá nhân và tài liệu liên quan</div></div></div>${editing?`<div class="tt-doc-grid">${TT_DOCS.map(x=>ttDocRowEdit(x)).join('')}</div>`:ttDetailDocRowsHtml(t)}</section><section class="tt-detail-card tt-points-card"><div class="tt-detail-card-h"><span>${U.icon('store')}</span><div><b>C. Điểm kinh doanh đang sử dụng</b><div class="small muted">Thông tin kinh doanh tại từng điểm</div></div></div><div class="plan">${t.stalls.length?t.stalls.map(id=>ttPointCardHtml(t,id)).join(''):'<div class="empty small">Tiểu thương chưa có điểm kinh doanh đang sử dụng.</div>'}</div></section>${A.VEHICLES?A.VEHICLES.traderSection(t):''}<section class="tt-detail-card"><div class="tt-detail-card-h"><span>${U.icon('money')}</span><div><b>E. Tình trạng công nợ</b><div class="small muted">Tóm tắt các khoản cần theo dõi</div></div></div><dl class="kv"><dt>Công nợ hiện tại</dt><dd>${debt?`<b class="tt-debt-value">${U.money(debt)}</b>`:'<span class="tag ok">Không nợ</span>'}</dd><dt>Khoản chưa thanh toán</dt><dd>${unpaid}</dd></dl>${U.can('cong-no')?`<div class="row" style="margin-top:8px"><button class="btn sm" data-act="tt-open-congno">Xem chi tiết công nợ</button></div>`:''}</section></div><div class="drawer-f"><button class="btn" data-act="close">Đóng</button></div>`;
  }
  A.ACT['tt-placement-view'] = el => {
    const st = A.idx.stall.get(el.dataset.point);
    const usage = st && ttActiveUsage(st.id);
    const file = usage && (usage.placementFiles || [])[Number(el.dataset.file)];
    if (!file) return U.toast('Không tìm thấy tệp hồ sơ bố trí.');
    A.modal(ttFileViewHtml('Hồ sơ bố trí · ' + st.code, file));
  };
  A.ACT['tt-doc-view'] = el => {
    const t = A.idx.trader.get(el.dataset.id);
    const file = t && (t.docFiles || {})[el.dataset.key];
    if (!file) return U.toast('Không tìm thấy tệp hồ sơ.');
    A.modal(ttFileViewHtml(ttDocLabel(el.dataset.key), file));
  };
  // "Thay thế" giấy tờ (mục 9 yêu cầu hotfix) — FE prototype: chỉ mở file picker cục bộ (input
  // type=file, KHÔNG upload server/storage thật), lưu tên file vào state tạm ttPendingDocs. Chưa
  // đụng dữ liệu trader — chỉ thật sự áp dụng (ghi t.docFiles) khi bấm "Lưu thay đổi" (tt-edit-save),
  // "Hủy" (tt-edit-cancel) xóa sạch state tạm này. Re-check permission tại đây, không chỉ dựa vào
  // nút đã được ẩn/hiện đúng theo canEdit (mục 12 yêu cầu: handler phải tự kiểm tra lại).
  A.ACT['tt-doc-replace'] = el => {
    const t = A.idx.trader.get(ttEditId);
    if (!t || !A.canDo('tieu-thuong.them-moi', t.market)) return;
    const key = el.dataset.key;
    // Gắn input vào DOM (ẩn) thay vì tạo rời rạc rồi bỏ ngay — input.click() vẫn mở đúng file picker
    // của hệ điều hành như bình thường, nhưng input còn tồn tại trong DOM để có thể dọn dẹp đúng
    // cách sau khi chọn/hủy (tránh rò rỉ node lơ lửng qua nhiều lần "Thay thế").
    const old = A.$('#tt-doc-replace-input'); if (old) old.remove();
    const input = document.createElement('input');
    input.type = 'file'; input.id = 'tt-doc-replace-input'; input.accept = 'image/*,.pdf'; input.style.display = 'none';
    input.addEventListener('change', () => {
      if (input.files && input.files[0]) ttCaptureFile(input.files[0], meta => { ttPendingDocs[key] = meta; ttRerenderDrawer(t); });
      input.remove();
    });
    document.body.appendChild(input);
    input.click();
  };
  // "Xem thông tin" người trực tiếp kinh doanh khi KHÁC người thuê (mục 8 yêu cầu) — chỉ xem thông
  // tin cơ bản (không phải hồ sơ tài chính/công nợ), không biến người bán thành chủ thể nghĩa vụ tài
  // chính với BQL. NEED_CONFIRMATION: xem báo cáo về phạm vi hiển thị của modal này.
  A.ACT['tt-seller-view'] = (el, e) => {
    if (e) e.preventDefault();
    const s = A.idx.trader.get(el.dataset.id);
    if (!s) return;
    A.modal(A.mHead('Người trực tiếp kinh doanh') + `<div class="modal-b"><dl class="kv">
      <dt>Họ tên</dt><dd>${U.esc(s.name)}</dd>
      <dt>Điện thoại</dt><dd>${U.maskPhone(s.phone)}</dd>
      <dt>CCCD</dt><dd>${U.maskId(s.idNo)}</dd>
      </dl></div>
      <div class="modal-f"><button class="btn primary" data-act="close">Đóng</button></div>`);
  };
  // Điều hướng "Xem" hợp đồng → màn Hợp đồng, tái dùng ĐÚNG state search/tab sẵn có của màn đó
  // (f.hdSearch/ui.contractTab) — không sửa 1 dòng nào trong A.VIEWS['hop-dong'].
  A.ACT['tt-open-contract'] = (el, e) => {
    if (e) e.preventDefault();
    const c = A.idx.contract.get(el.dataset.id);
    if (!c) return;
    ui.contractTab = c.status === 'hieuluc' ? 'all' : 'end';
    f.hdSearch = c.id;
    ui.page['hd' + ui.contractTab] = 0;
    A.go('hop-dong');
  };
  // Điều hướng "Xem công nợ" → màn Công nợ & nhắc nợ (screen-level, màn đó không có ô tìm theo tên
  // nên không thể tự động lọc đúng 1 tiểu thương — không sửa màn tài chính để thêm cơ chế đó).
  A.ACT['tt-open-congno'] = () => { if (U.can('cong-no')) A.go('cong-no'); };
  A.ACT['tt-open-point'] = el => {
    const t=A.idx.trader.get(el.dataset.trader), st=A.idx.stall.get(el.dataset.id);
    if(!t||!st)return;
    A.drawerPush(t.id, () => ttRerenderDrawer(t));
    A.openDkDrawer(st);
  };

  // Mở drawer hồ sơ tiểu thương — hàm THUẦN dùng chung cho action GỐC (`trader`, tự reset stack) và
  // khi mở làm drawer CON từ Mặt bằng chợ/Điểm kinh doanh (`mb-open-trader`/`dkcl-open-trader`, tự
  // push stack) — xem js/v-dieuhanh.js + `dkcl-open-trader` ở trên.
  A.openTraderDrawer = function (t) {
    if (t.market === 'CL') {
      ttEditId = null; // mở lại từ đầu luôn ở VIEW MODE (mục 2 yêu cầu hotfix)
      ttPendingDocs = {};
      A.$('#modal-root').innerHTML = `<div class="drawer-overlay" data-act="close"></div><div class="drawer drawer-tt-cl">${A.drawerBackHtml()}${ttDrawerHtmlCL(t)}</div>`;
      A.render();
      return;
    }
    const invs = A.db.invoices.filter(i => i.traderId === t.id).sort((a, b) => b.period.localeCompare(a.period)).slice(0, 8);
    const cts = A.db.contracts.filter(c => c.traderId === t.id);
    const pays = A.db.payments.filter(p => p.traderId === t.id).slice(-6).reverse();
    A.modal(A.mHead(U.esc(t.name) + ' · ' + t.id) + `<div class="modal-b"><div class="grid g2">
      <dl class="kv"><dt>Giới tính / năm sinh</dt><dd>${t.gender} · ${t.birth}</dd><dt>Điện thoại</dt><dd>${U.maskPhone(t.phone)}</dd>
        <dt>CCCD</dt><dd>${U.maskId(t.idNo)}</dd><dt>Địa chỉ</dt><dd>${U.esc(t.address)}</dd>
        <dt>Hộ kinh doanh</dt><dd>${t.hkd ? 'Có giấy CN ĐKKD' : 'Cá nhân kinh doanh'}</dd></dl>
      <dl class="kv"><dt>Chợ</dt><dd>${U.mShort(t.market)}</dd><dt>Ngành hàng</dt><dd>${U.esc(t.cat)}</dd><dt>Kinh doanh từ</dt><dd>${U.dmy(t.since)}</dd>
        <dt>Mini app</dt><dd>${t.app ? '<span class="tag ok">Đã cài</span>' : '<span class="tag">Chưa cài</span>'}</dd>
        <dt>Giấy tờ số hóa</dt><dd><span class="tag info">CCCD 2 mặt</span> ${t.hkd ? '<span class="tag info">Giấy CN ĐKKD</span>' : ''}</dd></dl></div>
      <div class="divider"></div><b>Điểm kinh doanh & hợp đồng</b>
      ${U.table([{ t: 'Số hợp đồng' }, { t: 'Điểm KD' }, { t: 'Thời hạn' }, { t: 'Giá/tháng', num: true }, { t: 'Trạng thái' }], cts.map(c => `<tr><td>${c.id}</td><td>${A.idx.stall.get(c.stallId).code}</td><td>${U.dmy(c.start)} – ${U.dmy(c.end)}</td><td class="num">${c.monthly ? U.money(c.monthly) : 'Theo phiên'}</td><td>${c.status === 'hieuluc' ? '<span class="tag ok">Hiệu lực</span>' : '<span class="tag">Đã thanh lý</span>'}</td></tr>`))}
      <div class="divider"></div><b>Khoản phải thu gần đây</b>
      ${U.table([{ t: 'Mã' }, { t: 'Kỳ' }, { t: 'Số tiền', num: true }, { t: 'Đã thu', num: true }, { t: 'Trạng thái' }], invs.map(i => `<tr><td>${i.id}</td><td>${U.per(i.period)}</td><td class="num">${U.money(i.amount)}</td><td class="num">${U.money(i.paid)}</td><td>${U.invTag(i)}</td></tr>`))}
      ${pays.length ? `<div class="divider"></div><b>Biên lai gần đây</b>${U.table([{ t: 'Biên lai' }, { t: 'Ngày' }, { t: 'Hình thức' }, { t: 'Số tiền', num: true }], pays.map(p => `<tr class="click" data-act="receipt" data-id="${p.receipt}"><td>${p.receipt}</td><td>${U.dmy(p.date)}</td><td>${D.METHOD[p.method]}</td><td class="num">${U.money(p.amount)}</td></tr>`))}` : ''}
      </div><div class="modal-f">${A.canDo('thu-tien.thu', t.market) && U.traderDebt(t.id) ? `<button class="btn primary" data-act="pay-open" data-id="${t.id}">${U.icon('card')}Thu tiền</button>` : ''}<button class="btn" data-act="close">Đóng</button></div>`, true);
  };
  // Click "Xem"/dòng bảng ở màn Tiểu thương (và các link trader ở nơi khác) = mở drawer/modal GỐC —
  // reset navigation stack trước (mục 6 yêu cầu back navigation: không hiện "← Quay lại" giả).
  A.ACT.trader = (el, e) => {
    if (e) e.preventDefault();
    A.drawerReset();
    A.openTraderDrawer(A.idx.trader.get(el.dataset.id));
  };

  // ==================== TÀI KHOẢN MINI APP — find-or-create khi kích hoạt (CORRECTION) ====================
  // Trước đây: 2 hàm này phục vụ 2 popup xác minh hồ sơ Mini App (đã BỎ — xem
  // TRADER_PROFILE_MINIAPP_CORRECTION_REPORT.md). Nghiệp vụ mới: Mini App KHÔNG tự đăng ký hồ sơ,
  // chỉ tra cứu SĐT rồi "kích hoạt" — nhưng bước "tìm hoặc tạo Trader Account" vẫn CẦN đúng logic
  // find-or-create này, nên GIỮ NGUYÊN 2 hàm, chỉ đổi vai trò gọi: giờ được gọi từ js/mini.js (luồng
  // OTP đăng nhập) qua A.createLinkedTraderAccount — expose bên dưới.
  function ttNextAccountId() {
    const nums = A.ACCOUNTS.list().map(a => { const m = /^AC-TT(\d+)$/.exec(a.id); return m ? parseInt(m[1], 10) : NaN; }).filter(n => !isNaN(n));
    return 'AC-TT' + U.pad((nums.length ? Math.max.apply(null, nums) : 0) + 1, 2);
  }
  // Tìm-hoặc-tạo account Mini App cho ĐÚNG 1 trader — an toàn gọi lại nhiều lần (không tạo trùng nếu
  // trader đã có account, xem mục 15 yêu cầu correction "Account uniqueness").
  function ttCreateLinkedAccount(trader, phone) {
    if (A.ACCOUNTS.byTraderId(trader.id)) return A.ACCOUNTS.byTraderId(trader.id);
    const id = ttNextAccountId();
    const acc = { id, code: id.replace('AC-', ''), fullName: trader.name, phone: phone || trader.phone, accountType: 'Tiểu thương', title: 'Tiểu thương', roleIds: ['trader'], organization: U.mShort(trader.market), marketScopes: [trader.market], status: 'active', traderId: trader.id };
    A.ACCOUNTS.add(acc);
    return acc;
  }
  // Expose cho js/mini.js (đăng nhập/kích hoạt Mini App bằng SĐT+OTP — mục 14 yêu cầu correction).
  A.createLinkedTraderAccount = ttCreateLinkedAccount;

  // ==================== "+ Thêm tiểu thương" — stepper 4 bước (mục 8-14 yêu cầu) ====================
  // Thay hoàn toàn ttForm()/tt-ocr/tt-save cũ (modal 1 bước) bằng wizard 4 bước dùng chung 1 draft,
  // giống hệt pattern dkPlanDraft/dksrFormHtml (Tách điểm) — reuse ycSetModal() để có header/footer
  // cố định + body scroll đúng yêu cầu (mục 8: "modal phải scroll body, header cố định, footer rõ,
  // không vượt viewport"), KHÔNG dùng A.modal() (chỉ scroll nguyên khối, dễ mất nút Lưu khi form dài).
  function ttNextId() {
    const nums = A.db.traders.map(t => parseInt(String(t.id).replace('TT', ''), 10)).filter(n => !isNaN(n));
    return 'TT' + U.pad((nums.length ? Math.max.apply(null, nums) : 0) + 1, 4);
  }
  const TT_OCR_SAMPLE = { name: 'Nguyễn Thị Mỹ Duyên', idNo: '087196012345', birth: '1988', gender: 'Nữ', address: 'Khóm 3, phường Cao Lãnh' };
  const TT_WIZARD_STEP_LABEL = ['', 'Thông tin tiểu thương', 'Điểm kinh doanh', 'Người bán & phương tiện', 'Hồ sơ & xác nhận'];
  // Danh mục giấy tờ dùng CHUNG với Section B drawer chi tiết — xem TT_DOCS (định nghĩa phía trên,
  // gần ttDocRow/ttDocRowEdit), KHÔNG tạo danh mục thứ 2.
  let ttWizardDraft = null; // { step, name, idNo, gender, birth, phone, address, market, hkd, licenseNo, licenseDate, since, docFiles, vehicles, confirmPhoneWarning }
  function ttWizardRerender() { ycSetModal(`<div class="drawer-overlay" data-act="close"></div><div class="drawer drawer-yc drawer-trader-form">${ttWizardHtml()}</div>`); }
  // Kiểm tra trùng tối thiểu (mục 13 yêu cầu): CCCD trùng CHÍNH XÁC → BLOCK; SĐT trùng (CCCD khác)
  // → WARNING, không tự chặn nhưng bắt xác nhận đã kiểm tra trước khi cho lưu (mục "không silently
  // create duplicate").
  function ttDuplicateCheck(idNo, phone) {
    const cccdMatch = idNo ? A.db.traders.find(t => t.market === ui.market && t.idNo === idNo) : null;
    if (cccdMatch) return { level: 'BLOCK', trader: cccdMatch };
    const phoneMatch = phone ? A.db.traders.find(t => t.phone === phone) : null;
    if (phoneMatch) return { level: 'WARNING', trader: phoneMatch };
    return { level: 'OK' };
  }
  function ttWizardStepperHtml(step) {
    return `<div class="seg" style="margin-bottom:14px">${TT_WIZARD_STEP_LABEL.slice(1).map((label, i) => `<button class="${step === i + 1 ? 'on' : ''}" data-act="tt-wizard-goto" data-id="${i + 1}" ${i + 1 > ttWizardDraft.furthestStep ? 'disabled' : ''}>${i + 1}. ${label}</button>`).join('')}</div>`;
  }
  function ttWizardStep1Html(d) {
    return `<div class="row" style="margin-bottom:12px;gap:10px;align-items:center"><button class="btn" data-act="tt-wizard-ocr">📷 Quét CCCD / OCR giả lập</button><span class="small muted">Mô phỏng chọn/chụp ảnh CCCD để tự điền thông tin bên dưới</span></div>
      ${d.ocrApplied ? '<div class="note info" style="margin-bottom:12px">Thông tin được nhận diện tự động. Vui lòng kiểm tra trước khi lưu.</div>' : ''}
      <div class="form-grid">
        <div class="field"><label>Họ và tên *</label><input class="input" data-in="ttw-name" value="${U.esc(d.name)}"></div>
        <div class="field"><label>Số CCCD *</label><input class="input" data-in="ttw-idno" value="${U.esc(d.idNo)}"></div>
        <div class="field"><label>Giới tính</label><select class="input" data-ch="ttw-gender"><option ${d.gender === 'Nữ' ? 'selected' : ''}>Nữ</option><option ${d.gender === 'Nam' ? 'selected' : ''}>Nam</option></select></div>
        <div class="field"><label>Năm sinh</label><input class="input" data-in="ttw-birth" value="${U.esc(String(d.birth || ''))}"></div>
        <div class="field"><label>Điện thoại *</label><input class="input" data-in="ttw-phone" value="${U.esc(d.phone)}" placeholder="09xxxxxxxx"></div>
        <div class="field"><label>Địa chỉ</label><input class="input" data-in="ttw-addr" value="${U.esc(d.address)}"></div>
      </div>
      <div class="note" style="margin-top:12px">Mã tiểu thương do hệ thống tự sinh theo mã <b>TTxxxx</b> khi lưu, không nhập tay.</div>
      ${A.VEHICLES ? A.VEHICLES.draftSection(d, { add: 'ttw-vehicle-add', edit: 'ttw-vehicle-edit', remove: 'ttw-vehicle-remove' }) : ''}`;
  }
  function ttWizardStep2Html(d) {
    return `<div class="form-grid">
        <div class="field"><label>Chợ</label><input class="input" value="${U.esc(U.mShort(d.market))}" disabled></div>
        <div class="field"><label>Hình thức kinh doanh</label><select class="input" data-ch="ttw-hkd"><option value="0" ${!d.hkd ? 'selected' : ''}>Cá nhân kinh doanh</option><option value="1" ${d.hkd ? 'selected' : ''}>Có giấy CN ĐKKD</option></select></div>
        <div class="field"><label>Ngày bắt đầu kinh doanh tại chợ</label><input class="input" type="date" data-ch="ttw-since" value="${d.since || ''}"></div>
        <div class="field"><label>Số GCN đăng ký kinh doanh</label><input class="input" data-in="ttw-license" value="${U.esc(d.licenseNo || '')}" ${d.hkd ? '' : 'disabled'}></div>
        <div class="field"><label>Ngày cấp</label><input class="input" type="date" data-ch="ttw-license-date" value="${d.licenseDate || ''}" ${d.hkd ? '' : 'disabled'}></div>
      </div>
      <div class="note" style="margin-top:12px">Chưa bắt buộc chọn điểm kinh doanh ở bước này — gán điểm/tạo hợp đồng thực hiện riêng tại màn Điểm kinh doanh/Hợp đồng sau khi lưu hồ sơ.</div>`;
  }
  function ttWizardDocCardHtml(doc, d) {
    const f2 = d.docFiles[doc.key];
    return `<div class="tt-doc-tile" style="flex-direction:column;align-items:stretch;gap:8px">
      <div class="row" style="justify-content:space-between"><b>${U.esc(doc.label)}</b>${f2 ? '<span class="tag ok">Đã tải</span>' : '<span class="tag">Chưa tải</span>'}</div>
      ${f2 ? `<div class="small muted">${U.esc(f2.name)}</div>` : ''}
      <div class="row" style="gap:6px">${f2 ? `<button class="btn sm" data-act="tt-wizard-doc-view" data-key="${doc.key}">Xem</button>` : ''}<button class="btn sm" data-act="tt-wizard-doc-pick" data-key="${doc.key}">${f2 ? 'Thay thế' : 'Tải lên (mock)'}</button></div>
    </div>`;
  }
  function ttWizardStep3Html(d) {
    return `<div class="tt-doc-grid">${TT_DOCS.map(doc => ttWizardDocCardHtml(doc, d)).join('')}</div>
      <div class="note" style="margin-top:12px">Prototype: chỉ mô phỏng chọn tệp minh họa (metadata), chưa upload lên máy chủ thật.</div>`;
  }
  function ttWizardStep4Html(d) {
    const dup = ttDuplicateCheck(d.idNo.trim(), d.phone.trim());
    const errs = [];
    if (!d.name.trim()) errs.push('Chưa nhập họ và tên.');
    if (!d.idNo.trim()) errs.push('Chưa nhập số CCCD.');
    if (!d.phone.trim()) errs.push('Chưa nhập số điện thoại.');
    const docCount = TT_DOCS.filter(x => d.docFiles[x.key]).length;
    let dupHtml = '';
    if (dup.level === 'BLOCK') {
      dupHtml = `<div class="note" style="margin-top:12px;border-color:#f0aaaa;background:var(--danger-soft)"><b>Phát hiện hồ sơ tiểu thương đã tồn tại.</b>
        <div style="margin-top:6px">${dup.trader.id} · ${U.esc(dup.trader.name)} · ${U.maskPhone(dup.trader.phone)}</div>
        <div class="row" style="margin-top:8px"><button class="btn sm" data-act="tt-wizard-view-existing" data-id="${dup.trader.id}">Xem hồ sơ</button></div></div>`;
    } else if (dup.level === 'WARNING') {
      dupHtml = `<div class="note" style="margin-top:12px">⚠ Số điện thoại trùng với hồ sơ ${dup.trader.id} · ${U.esc(dup.trader.name)} (CCCD khác) — vui lòng kiểm tra đây có phải 2 tiểu thương khác nhau không.
        <label class="row small" style="margin-top:8px;gap:6px;align-items:center;cursor:pointer"><input type="checkbox" data-ch="ttw-confirm-phone" ${d.confirmPhoneWarning ? 'checked' : ''}> Tôi đã kiểm tra, đây là 2 tiểu thương khác nhau</label></div>`;
    }
    return `<dl class="kv">
        <dt>Họ tên</dt><dd>${U.esc(d.name) || '<span class="muted">Chưa nhập</span>'}</dd>
        <dt>CCCD</dt><dd>${U.esc(d.idNo) || '<span class="muted">Chưa nhập</span>'}</dd>
        <dt>Điện thoại</dt><dd>${U.esc(d.phone) || '<span class="muted">Chưa nhập</span>'}</dd>
        <dt>Chợ</dt><dd>${U.esc(U.mShort(d.market))}</dd>
        <dt>Hình thức kinh doanh</dt><dd>${d.hkd ? 'Có giấy CN ĐKKD' : 'Cá nhân kinh doanh'}</dd>
        <dt>Hồ sơ số hóa</dt><dd>${docCount}/${TT_DOCS.length} tài liệu đã tải</dd>
      </dl>
      ${errs.length ? `<div class="note" style="margin-top:12px">${errs.map(e => U.esc(e)).join('<br>')}</div>` : ''}
      ${dupHtml}`;
  }
  // Wizard nghiệp vụ mới: profile và quan hệ sử dụng một điểm được nhập cùng
  // phiên, nhưng chỉ tạo dữ liệu khi xác nhận ở bước 4.
  function ttUsageWizardStep1(d) {
    return `<div class="form-grid"><div class="field"><label>Mã tiểu thương</label><input class="input" value="${ttNextId()}" disabled></div><div class="field"><label>Họ và tên *</label><input class="input" data-in="ttw-name" value="${U.esc(d.name)}"></div><div class="field"><label>Số điện thoại *</label><input class="input" data-in="ttw-phone" value="${U.esc(d.phone)}"></div><div class="field"><label>Loại giấy tờ *</label><select class="input" data-ch="ttw-idtype"><option value="CCCD" ${d.idType==='CCCD'?'selected':''}>CCCD</option><option value="CMND" ${d.idType==='CMND'?'selected':''}>CMND</option><option value="Hộ chiếu" ${d.idType==='Hộ chiếu'?'selected':''}>Hộ chiếu</option></select></div><div class="field"><label>Số giấy tờ *</label><input class="input" data-in="ttw-idno" value="${U.esc(d.idNo)}"></div><div class="field"><label>Ngành hàng *</label><input class="input" data-in="ttw-cat" value="${U.esc(d.cat)}" placeholder="Ví dụ: Rau củ"></div></div>`;
  }
  function ttUsageWizardStep2(d) {
    const vacant=A.db.stalls.filter(s=>s.market===d.market&&s.status==='trong');
    const st=vacant.find(s=>s.id===d.pointId)||null;
    return `<div class="form-grid"><div class="field"><label>Chợ</label><input class="input" value="${U.esc(U.mShort(d.market))}" disabled></div><div class="field"><label>Điểm kinh doanh *</label><select class="input" data-ch="ttw-point"><option value="">— Chọn điểm còn trống —</option>${vacant.map(s=>`<option value="${s.id}" ${d.pointId===s.id?'selected':''}>${s.code} · ${U.esc(s.sectionName)} · ${s.area} m²</option>`).join('')}</select></div><div class="field"><label>Ngày bắt đầu *</label><input class="input" type="date" data-ch="ttw-start" value="${d.startDate}"></div><div class="field"><label>Ngành hàng tại điểm *</label><input class="input" data-in="ttw-point-cat" value="${U.esc(d.pointCat||d.cat)}"></div></div>${st?`<div class="note info" style="margin-top:12px"><b>${st.code}</b><br>${U.esc(ttPointPath(st))}<br>${st.area} m² · ${U.esc(U.areaTypeLabel(st.areaType)||'Chưa có thông tin')}<br>Trạng thái: Còn trống</div>`:''}`;
  }
  function ttUsageWizardStep3(d) {
    const seller=d.sellerKind==='other'?`<div class="form-grid" style="margin-top:10px"><div class="field"><label>Họ tên *</label><input class="input" data-in="ttw-seller-name" value="${U.esc(d.sellerName)}"></div><div class="field"><label>Số điện thoại *</label><input class="input" data-in="ttw-seller-phone" value="${U.esc(d.sellerPhone)}"></div><div class="field"><label>Ngày bắt đầu *</label><input class="input" type="date" data-ch="ttw-seller-start" value="${d.sellerStartDate}"></div></div>`:'';
    return `<section class="tt-detail-card"><div class="tt-detail-card-h"><span>${U.icon('users')}</span><div><b>A. Người bán trực tiếp</b></div></div><label class="row" style="gap:8px"><input type="radio" name="seller" data-ch="ttw-seller-kind" value="owner" ${d.sellerKind==='owner'?'checked':''}> Chính tiểu thương trực tiếp bán</label><label class="row" style="gap:8px;margin-top:8px"><input type="radio" name="seller" data-ch="ttw-seller-kind" value="other" ${d.sellerKind==='other'?'checked':''}> Người khác trực tiếp bán</label>${seller}</section>${A.VEHICLES?A.VEHICLES.draftSection(d,{add:'ttw-vehicle-add',edit:'ttw-vehicle-edit',remove:'ttw-vehicle-remove'}):''}`;
  }
  function ttUsageWizardStep4(d) {
    const st=A.idx.stall.get(d.pointId), docs=Object.keys(d.docFiles||{}).length, attachments=(d.placementFiles||[]);
    return `<section class="tt-detail-card"><div class="tt-detail-card-h"><span>${U.icon('file')}</span><div><b>GIẤY TỜ CÁ NHÂN</b></div></div><div class="tt-doc-grid">${TT_DOCS.map(x=>ttWizardDocCardHtml(x,d)).join('')}</div></section><section class="tt-detail-card"><div class="tt-detail-card-h"><span>${U.icon('attachment')}</span><div><b>HỢP ĐỒNG / QUYẾT ĐỊNH BỐ TRÍ ĐIỂM</b><div class="small muted">Tệp đính kèm của việc bố trí điểm, không tạo hợp đồng độc lập.</div></div></div>${attachments.length?attachments.map((x,i)=>`<div class="row"><span style="flex:1">${U.esc(x.name)}</span><button class="btn sm" data-act="ttw-placement-remove" data-index="${i}">Xóa</button></div>`).join(''):'<div class="small muted">Chưa có tệp đính kèm.</div>'}<button class="btn sm" style="margin-top:8px" data-act="ttw-placement-pick">+ Tải tệp</button></section><section class="tt-detail-card"><div class="tt-detail-card-h"><span>${U.icon('check')}</span><div><b>XÁC NHẬN</b></div></div><dl class="kv"><dt>Tiểu thương</dt><dd>${U.esc(d.name)} · ${U.esc(d.phone)} · ${U.esc(d.idNo)}</dd><dt>Điểm kinh doanh</dt><dd>${st?st.code+' · '+U.esc(ttPointPath(st)):'Chưa chọn'}</dd><dt>Ngày bắt đầu</dt><dd>${U.dmy(d.startDate)}</dd><dt>Người bán</dt><dd>${d.sellerKind==='owner'?'Chính tiểu thương':U.esc(d.sellerName||'Chưa nhập')}</dd><dt>Phương tiện</dt><dd>${(d.vehicles||[]).length} bản ghi</dd><dt>Hồ sơ</dt><dd>${docs} tệp giấy tờ; ${attachments.length} tệp QĐ/HĐ</dd></dl></section>`;
  }
  function ttFormError(d, key) { return d.errors && d.errors[key] ? `<div class="small" style="color:#c73737;margin-top:5px">⚠ ${U.esc(d.errors[key])}</div>` : ''; }
  function ttSingleFormHtml(d) {
    const dup = ttDuplicateCheck(d.idNo.trim(), d.phone.trim());
    const cats = Array.from(new Set(A.db.stalls.filter(s => s.market === d.market).map(s => s.cat).filter(Boolean))).sort();
    const points = d.cat ? A.db.stalls.filter(s => s.market === d.market && s.status === 'trong' && s.cat === d.cat) : [];
    const st = A.idx.stall.get(d.pointId);
    const docRows = TT_DOCS.map(doc => { const x=(d.docFiles||{})[doc.key]; return `<div class="row" style="padding:5px 0"><span style="flex:1">${U.esc(doc.label)}${x?`: ${U.esc(x.name)}`:''}</span>${x?`<button class="btn sm" data-act="tt-wizard-doc-view" data-key="${doc.key}">Xem</button><button class="btn sm" data-act="ttw-doc-remove" data-key="${doc.key}">Xóa</button>`:`<button class="btn sm" data-act="tt-wizard-doc-pick" data-key="${doc.key}">+ Chọn tệp</button>`}</div>`; }).join('');
    const placement = (d.placementFiles||[]).map((x,i)=>`<div class="row" style="padding:5px 0"><span style="flex:1">${U.esc(x.name)}</span><button class="btn sm" data-act="ttw-placement-remove" data-index="${i}">Xóa</button></div>`).join('');
    const vehicleBlock = d.hasVehicles ? `${A.VEHICLES ? A.VEHICLES.draftSection(d,{add:'ttw-vehicle-add',edit:'ttw-vehicle-edit',remove:'ttw-vehicle-remove'}) : ''}` : '';
    return `<div class="drawer-h"><div><h3>THÊM HỒ SƠ TIỂU THƯƠNG</h3><div class="small muted" style="margin-top:2px">${U.esc(U.mShort(d.market))}</div></div><span class="spacer"></span><button class="x" data-act="tt-wizard-cancel" aria-label="Đóng">×</button></div><div class="drawer-b" style="padding:24px 30px"><section><h3>1. Thông tin tiểu thương</h3><div class="divider"></div><div class="form-grid"><div class="field"><label>Mã tiểu thương</label><input class="input" value="${ttNextId()}" disabled><div class="small muted">Hệ thống tự sinh</div></div><div class="field"><label>Họ và tên *</label><input id="ttw-name-field" class="input" data-in="ttw-name" value="${U.esc(d.name)}">${ttFormError(d,'name')}</div><div class="field"><label>Số điện thoại *</label><input class="input" data-in="ttw-phone" value="${U.esc(d.phone)}">${ttFormError(d,'phone')}</div><div class="field"><label>Loại giấy tờ *</label><select class="input" data-ch="ttw-idtype"><option value="CCCD" ${d.idType==='CCCD'?'selected':''}>CCCD</option><option value="CMND" ${d.idType==='CMND'?'selected':''}>CMND</option><option value="Hộ chiếu" ${d.idType==='Hộ chiếu'?'selected':''}>Hộ chiếu</option></select></div><div class="field"><label>Số giấy tờ *</label><input id="ttw-idno-field" class="input" data-in="ttw-idno" value="${U.esc(d.idNo)}">${dup.level==='OK'&&d.idNo?`<div class="small" style="color:#267a45;margin-top:5px">✓ Số giấy tờ chưa tồn tại trong ${U.esc(U.mShort(d.market))}</div>`:''}${dup.level==='BLOCK'?`<div class="small" style="color:#c73737;margin-top:5px">⚠ Số giấy tờ này đã tồn tại trong ${U.esc(U.mShort(d.market))}.<br><b>${dup.trader.id} - ${U.esc(dup.trader.name)}</b> · ${U.maskPhone(dup.trader.phone)}<br><button class="btn sm" style="margin-top:5px" data-act="tt-wizard-view-existing" data-id="${dup.trader.id}">Xem hồ sơ hiện có</button></div>`:ttFormError(d,'idNo')}</div></div></section><section style="margin-top:28px"><h3>2. Thông tin kinh doanh</h3><div class="divider"></div><div class="form-grid"><div class="field"><label>Ngành hàng *</label><select class="input" data-ch="ttw-cat"><option value="">— Chọn ngành hàng —</option>${cats.map(x=>`<option value="${U.esc(x)}" ${d.cat===x?'selected':''}>${U.esc(x)}</option>`).join('')}</select>${ttFormError(d,'cat')}</div><div class="field"><label>Điểm kinh doanh *</label><select class="input" data-ch="ttw-point" ${d.cat?'':'disabled'}><option value="">${d.cat?'— Chọn điểm kinh doanh —':'Vui lòng chọn ngành hàng trước'}</option>${points.map(x=>`<option value="${x.id}" ${d.pointId===x.id?'selected':''}>${x.code} · ${U.esc(ttPointPath(x))} · ${x.area} m²</option>`).join('')}</select>${d.cat&&!points.length?`<div class="small" style="color:#8a5b00;margin-top:5px">Không còn điểm kinh doanh trống phù hợp với ngành hàng ${U.esc(d.cat)}.</div>`:ttFormError(d,'point')}</div><div class="field"><label>Ngày bắt đầu *</label><input class="input" type="date" data-ch="ttw-start" value="${d.startDate}">${ttFormError(d,'startDate')}</div></div>${st?`<div class="note info" style="margin-top:12px"><div class="row"><b style="flex:1">${st.code}</b>${U.statusTag(st.status)}</div><div style="margin-top:6px">${U.esc(ttPointPath(st))}</div><div class="small" style="margin-top:5px">${st.area} m² · ${U.esc(U.areaTypeLabel(st.areaType)||'Chưa có thông tin')} · ${U.esc(st.cat)}</div></div>`:''}</section><section style="margin-top:28px"><h3>3. Người bán trực tiếp</h3><div class="divider"></div><div class="small" style="margin-bottom:10px">Người trực tiếp kinh doanh tại điểm có thể là chính tiểu thương hoặc người được tiểu thương bố trí.</div><label class="row" style="gap:8px"><input type="radio" name="seller" data-ch="ttw-seller-kind" value="owner" ${d.sellerKind==='owner'?'checked':''}> Chính tiểu thương trực tiếp bán</label><label class="row" style="gap:8px;margin-top:8px"><input type="radio" name="seller" data-ch="ttw-seller-kind" value="other" ${d.sellerKind==='other'?'checked':''}> Người khác trực tiếp bán</label>${d.sellerKind==='other'?`<div class="form-grid" style="margin-top:14px"><div class="field"><label>Họ tên *</label><input class="input" data-in="ttw-seller-name" value="${U.esc(d.sellerName)}">${ttFormError(d,'sellerName')}</div><div class="field"><label>Số điện thoại *</label><input class="input" data-in="ttw-seller-phone" value="${U.esc(d.sellerPhone)}">${ttFormError(d,'sellerPhone')}</div><div class="field"><label>Ngày bắt đầu *</label><input class="input" type="date" data-ch="ttw-seller-start" value="${d.sellerStartDate}">${ttFormError(d,'sellerStartDate')}</div></div>`:''}</section><section style="margin-top:28px"><h3>4. Phương tiện đăng ký</h3><div class="divider"></div><label class="row" style="gap:8px"><input type="checkbox" data-ch="ttw-has-vehicles" ${d.hasVehicles?'checked':''}> Có đăng ký phương tiện</label>${vehicleBlock}</section><section style="margin-top:28px"><h3>5. Hồ sơ đính kèm</h3><div class="divider"></div><div class="grid g2"><div><b>Giấy tờ cá nhân</b><div style="margin-top:8px">${docRows}</div></div><div><b>Hợp đồng / Quyết định bố trí điểm kinh doanh</b><div class="small muted" style="margin:5px 0">Tệp đính kèm của việc sử dụng điểm.</div>${placement||'<div class="small muted">Chưa có tệp.</div>'}<button class="btn sm" style="margin-top:8px" data-act="ttw-placement-pick">+ Chọn ảnh / tệp</button></div></div></section></div><div class="drawer-f"><button class="btn" data-act="tt-wizard-cancel">Hủy</button><span class="spacer"></span><button class="btn primary" data-act="tt-wizard-save">Lưu hồ sơ</button></div>`;
  }
  function ttWizardHtml() { return ttSingleFormHtml(ttWizardDraft); }
  A.ACT['tt-new'] = () => {
    if (!A.canDo('tieu-thuong.them-moi', ui.market)) return;
    A.drawerReset();
    ttWizardDraft = { name: '', idNo: '', idType: 'CCCD', phone: '', cat: '', market: ui.market, pointId: '', startDate: A.db.today, pointCat: '', sellerKind: 'owner', sellerName: '', sellerPhone: '', sellerStartDate: A.db.today, docFiles: {}, placementFiles: [], vehicles: [], hasVehicles: false, confirmPhoneWarning: false, errors: {} };
    ttWizardRerender();
    A.render();
  };
  A.ACT['tt-wizard-cancel'] = () => { ttWizardDraft = null; A.closeModal(); A.render(); };
  A.ACT['tt-wizard-ocr'] = () => {
    if (!ttWizardDraft) return;
    Object.assign(ttWizardDraft, TT_OCR_SAMPLE, { ocrApplied: true });
    ttWizardRerender();
    U.toast('Đã nhận dạng CCCD (giả lập) — vui lòng kiểm tra lại thông tin');
  };
  // 3 field bắt buộc của bước 1 — PHẢI rerender ngay khi gõ để nút "Tiếp theo →"/"Lưu hồ sơ" cập
  // nhật đúng trạng thái disabled theo dữ liệu MỚI NHẤT (không chỉ dựa vào lần render trước, tránh
  // kẹt "disabled" giả sau khi OCR chỉ điền tên/CCCD mà chưa có điện thoại). ttWizardRerender() giữ
  // nguyên focus/caret cho input đang gõ (ycSetModal), an toàn gọi lại mỗi keystroke.
  A.IN['ttw-name'] = el => { if (ttWizardDraft) { ttWizardDraft.name = el.value; ttWizardRerender(); } };
  A.IN['ttw-idno'] = el => { if (ttWizardDraft) { ttWizardDraft.idNo = el.value; ttWizardRerender(); } };
  A.IN['ttw-cat'] = el => { if (ttWizardDraft) { ttWizardDraft.cat = el.value; ttWizardDraft.pointCat = el.value; ttWizardRerender(); } };
  A.IN['ttw-point-cat'] = el => { if (ttWizardDraft) ttWizardDraft.pointCat = el.value; };
  A.IN['ttw-seller-name'] = el => { if (ttWizardDraft) ttWizardDraft.sellerName = el.value; };
  A.IN['ttw-seller-phone'] = el => { if (ttWizardDraft) ttWizardDraft.sellerPhone = el.value; };
  A.IN['ttw-birth'] = el => { if (ttWizardDraft) ttWizardDraft.birth = el.value; };
  A.IN['ttw-phone'] = el => { if (ttWizardDraft) { ttWizardDraft.phone = el.value; ttWizardRerender(); } };
  A.IN['ttw-addr'] = el => { if (ttWizardDraft) ttWizardDraft.address = el.value; };
  A.IN['ttw-license'] = el => { if (ttWizardDraft) ttWizardDraft.licenseNo = el.value; };
  A.CH['ttw-gender'] = el => { if (ttWizardDraft) ttWizardDraft.gender = el.value; };
  A.CH['ttw-idtype'] = el => { if (ttWizardDraft) ttWizardDraft.idType = el.value; };
  A.CH['ttw-cat'] = el => { if (!ttWizardDraft) return; ttWizardDraft.cat=el.value; ttWizardDraft.pointCat=el.value; const st=A.idx.stall.get(ttWizardDraft.pointId); if(st && st.cat!==el.value) ttWizardDraft.pointId=''; ttWizardRerender(); };
  A.CH['ttw-point'] = el => { if (ttWizardDraft) { ttWizardDraft.pointId = el.value; ttWizardRerender(); } };
  A.CH['ttw-start'] = el => { if (ttWizardDraft) ttWizardDraft.startDate = el.value; };
  A.CH['ttw-seller-kind'] = el => { if (ttWizardDraft) { ttWizardDraft.sellerKind = el.value; ttWizardRerender(); } };
  A.CH['ttw-seller-start'] = el => { if (ttWizardDraft) ttWizardDraft.sellerStartDate = el.value; };
  A.CH['ttw-has-vehicles'] = el => { if (ttWizardDraft) { ttWizardDraft.hasVehicles=el.checked; ttWizardRerender(); } };
  A.CH['ttw-hkd'] = el => { if (ttWizardDraft) { ttWizardDraft.hkd = el.value === '1'; ttWizardRerender(); } };
  A.CH['ttw-since'] = el => { if (ttWizardDraft) ttWizardDraft.since = el.value; };
  A.CH['ttw-license-date'] = el => { if (ttWizardDraft) ttWizardDraft.licenseDate = el.value; };
  A.CH['ttw-confirm-phone'] = el => { if (ttWizardDraft) { ttWizardDraft.confirmPhoneWarning = el.checked; ttWizardRerender(); } };
  A.ACT['ttw-vehicle-add'] = () => { if (ttWizardDraft && A.VEHICLES) A.VEHICLES.openDraftModal(ttWizardDraft, null, ttWizardRerender); };
  A.ACT['ttw-vehicle-edit'] = el => { const i = Number(el.dataset.index); if (ttWizardDraft && A.VEHICLES && Number.isInteger(i)) A.VEHICLES.openDraftModal(ttWizardDraft, i, ttWizardRerender); };
  A.ACT['ttw-vehicle-remove'] = el => { const i = Number(el.dataset.index); if (!ttWizardDraft || !Number.isInteger(i) || i < 0 || i >= ttWizardDraft.vehicles.length) return; ttWizardDraft.vehicles.splice(i, 1); ttWizardRerender(); };
  A.ACT['tt-wizard-doc-pick'] = el => {
    if (!ttWizardDraft) return;
    const key = el.dataset.key;
    const old = A.$('#tt-wizard-file-input'); if (old) old.remove();
    const input = document.createElement('input');
    input.type = 'file'; input.id = 'tt-wizard-file-input'; input.accept = 'image/*,.pdf'; input.style.display = 'none';
    input.addEventListener('change', () => {
      if (input.files && input.files[0] && ttWizardDraft) ttCaptureFile(input.files[0], meta => { if (ttWizardDraft) { ttWizardDraft.docFiles[key] = meta; ttWizardRerender(); } });
      input.remove();
    });
    document.body.appendChild(input);
    input.click();
  };
  A.ACT['tt-wizard-doc-view'] = el => {
    const key = el.dataset.key, doc = TT_DOCS.find(x => x.key === key);
    const f2 = ttWizardDraft && ttWizardDraft.docFiles[key];
    if (f2) A.modal(ttFileViewHtml(doc ? doc.label : 'Tài liệu', f2));
  };
  A.ACT['ttw-placement-pick'] = () => { if (!ttWizardDraft) return; const input=document.createElement('input'); input.type='file'; input.accept='image/*,.pdf'; input.style.display='none'; input.onchange=()=>{if(input.files[0])ttCaptureFile(input.files[0], meta=>{if(ttWizardDraft){ttWizardDraft.placementFiles.push(meta);ttWizardRerender();}});input.remove();}; document.body.appendChild(input); input.click(); };
  A.ACT['ttw-placement-remove'] = el => { if (!ttWizardDraft) return; ttWizardDraft.placementFiles.splice(Number(el.dataset.index),1); ttWizardRerender(); };
  A.ACT['ttw-doc-remove'] = el => { if (!ttWizardDraft) return; delete ttWizardDraft.docFiles[el.dataset.key]; ttWizardRerender(); };
  A.ACT['tt-wizard-view-existing'] = el => {
    const t = A.idx.trader.get(el.dataset.id);
    if (!t) return;
    ttWizardDraft = null; A.closeModal();
    A.drawerReset();
    A.openTraderDrawer(t);
  };
  A.ACT['tt-wizard-save'] = () => {
    if (!A.canDo('tieu-thuong.them-moi', ui.market)) return;
    const d = ttWizardDraft;
    if (!d) return;
    const errors = {};
    const selected = A.idx.stall.get(d.pointId);
    if (!d.name.trim()) errors.name = 'Vui lòng nhập họ và tên.';
    if (!d.phone.trim()) errors.phone = 'Vui lòng nhập số điện thoại.';
    if (!d.idNo.trim()) errors.idNo = 'Vui lòng nhập số giấy tờ.';
    if (!d.cat) errors.cat = 'Vui lòng chọn ngành hàng.';
    if (!d.pointId) errors.point = 'Vui lòng chọn điểm kinh doanh.';
    else if (!selected || selected.market !== d.market || selected.status !== 'trong' || selected.cat !== d.cat) errors.point = 'Điểm kinh doanh không còn trống hoặc không phù hợp ngành hàng.';
    if (!d.startDate) errors.startDate = 'Vui lòng chọn ngày bắt đầu.';
    if (d.sellerKind === 'other') { if (!d.sellerName.trim()) errors.sellerName='Vui lòng nhập họ tên người bán.'; if (!d.sellerPhone.trim()) errors.sellerPhone='Vui lòng nhập số điện thoại người bán.'; if (!d.sellerStartDate) errors.sellerStartDate='Vui lòng chọn ngày bắt đầu.'; }
    const duplicateNow = ttDuplicateCheck(d.idNo.trim(), d.phone.trim());
    if (duplicateNow.level === 'BLOCK') errors.idNo = 'Số giấy tờ đã tồn tại trong chợ.';
    if (Object.keys(errors).length) { d.errors = errors; const firstKey=Object.keys(errors)[0], selector={name:'#ttw-name-field',phone:'[data-in="ttw-phone"]',idNo:'#ttw-idno-field',cat:'[data-ch="ttw-cat"]',point:'[data-ch="ttw-point"]',startDate:'[data-ch="ttw-start"]',sellerName:'[data-in="ttw-seller-name"]',sellerPhone:'[data-in="ttw-seller-phone"]',sellerStartDate:'[data-ch="ttw-seller-start"]'}[firstKey]; ttWizardRerender(); setTimeout(() => { const first = selector && document.querySelector(selector); if (first) { first.scrollIntoView({ block:'center' }); first.focus(); } }, 0); return; }
    d.errors = {};
    const name = d.name.trim(), idNo = d.idNo.trim(), phone = d.phone.trim();
    if (!name || !idNo || !phone) { U.toast('Vui lòng nhập đủ họ tên, số CCCD và điện thoại'); return; }
    const dup = ttDuplicateCheck(idNo, phone);
    if (dup.level === 'BLOCK') { U.toast('Phát hiện hồ sơ tiểu thương đã tồn tại — không thể tạo hồ sơ mới'); return; }
    if (dup.level === 'WARNING' && !d.confirmPhoneWarning) { U.toast('Vui lòng xác nhận đã kiểm tra số điện thoại trùng trước khi lưu'); return; }
    const st = A.idx.stall.get(d.pointId);
    if (!st || st.market !== d.market || st.status !== 'trong') { U.toast('Điểm kinh doanh đã không còn trống. Vui lòng chọn lại.'); return; }
    if (!d.cat || !d.pointCat || !d.startDate || (d.sellerKind === 'other' && (!d.sellerName.trim() || !d.sellerPhone.trim() || !d.sellerStartDate))) { U.toast('Vui lòng hoàn tất thông tin điểm kinh doanh và người bán.'); return; }
    // Hồ sơ do NV BQL nhập thủ công coi là ACTIVE ngay. Quan hệ mới được lưu
    // ở pointUsages, đồng thời cập nhật link legacy để toàn bộ tài chính/sơ đồ
    // hiện hữu tiếp tục đọc đúng một trader/point như trước.
    const t = {
      id: ttNextId(), name, phone, idNo, idType: d.idType || 'CCCD',
      market: d.market, cat: d.cat.trim(), hkd: false, since: d.startDate, app: false, bank: false, stalls: [st.id],
      profileStatus: 'ACTIVE', source: 'STAFF', supplementNote: '',
      licenseNo: null, licenseDate: null,
      docFiles: Object.assign({}, d.docFiles)
    };
    A.db.traders.push(t); A.idx.trader.set(t.id, t);
    st.traderId = t.id; st.sellerId = d.sellerKind === 'owner' ? t.id : null; st.status = 'thue'; st.cat = d.pointCat.trim();
    st.history = st.history || []; st.history.unshift(`${U.dmy(d.startDate)}: bố trí ${t.id} · ${t.name}`);
    ttUsageStore().push({ id:'PU-'+U.pad(ttUsageStore().length+1,4), market:st.market, pointId:st.id, traderId:t.id, startDate:d.startDate, category:st.cat, placementFiles:(d.placementFiles||[]).slice(), status:'ACTIVE', createdAt:U.today(), updatedAt:U.today() });
    const seller = d.sellerKind === 'owner' ? { traderId:t.id, personId:t.id, fullName:t.name, phone:t.phone, relationship:'Chính tiểu thương trực tiếp bán', startDate:d.startDate } : { traderId:null, personId:null, fullName:d.sellerName.trim(), phone:d.sellerPhone.trim(), relationship:'Người bán thay', startDate:d.sellerStartDate };
    A.db.directSellerAssignments = A.db.directSellerAssignments || [];
    A.db.directSellerAssignments.filter(x=>x.pointId===st.id&&x.status==='ACTIVE').forEach(x=>{x.status='ENDED';x.endDate=U.today();x.updatedAt=U.today();});
    A.db.directSellerAssignments.push(Object.assign({id:'DSA-'+U.pad(A.db.directSellerAssignments.length+1,4),market:st.market,pointId:st.id,idNumber:'',endDate:null,status:'ACTIVE',source:'TRADER_PROFILE_WIZARD',createdAt:U.today(),updatedAt:U.today()},seller));
    if (A.VEHICLES) A.VEHICLES.persistDrafts(t, d.vehicles, { pointId: st.id, startDate: d.startDate });
    t.updatedAt=U.today(); U.log('Thêm hồ sơ tiểu thương ' + t.id + ' và bố trí điểm ' + st.code);
    A.save();
    ttWizardDraft = null;
    A.closeModal(); A.render();
    U.toast('Đã lưu hồ sơ ' + t.id + ' và bố trí điểm ' + st.code + '.');
  };
  // "Chỉnh sửa thông tin tiểu thương" (CL, HOTFIX mục 1-2 yêu cầu) — reuse ĐÚNG action permission
  // 'tieu-thuong.them-moi' đã có (cùng phạm vi "quản lý hồ sơ tiểu thương"), không tạo permission
  // key mới. targetMarket lấy từ chính record t.market, không dựa ui.market. Chuyển drawer sang EDIT
  // MODE TẠI CHỖ bằng cách set ttEditId rồi render lại ĐÚNG container drawer đang mở — KHÔNG gọi
  // A.modal() (tránh mở modal/drawer thứ hai, tránh thay thế #modal-root làm mất drawer hiện tại).
  function ttRerenderDrawer(t) {
    A.$('#modal-root').innerHTML = `<div class="drawer-overlay" data-act="close"></div><div class="drawer drawer-tt-cl">${A.drawerBackHtml()}${ttDrawerHtmlCL(t)}</div>`;
  }
  A.ACT['tt-edit-open'] = el => {
    const t = A.idx.trader.get(el.dataset.id);
    if (!t || !A.canDo('tieu-thuong.them-moi', t.market)) return;
    ttEditId = t.id;
    ttPendingDocs = {};
    ttRerenderDrawer(t);
  };
  A.ACT['tt-edit-cancel'] = el => {
    const t = A.idx.trader.get(el.dataset.id);
    if (!t) return;
    ttEditId = null;
    ttPendingDocs = {}; // bỏ luôn file vừa chọn để thay thế, chưa lưu thì không áp dụng (mục 11)
    ttRerenderDrawer(t);
  };
  A.ACT['tt-edit-save'] = el => {
    const t = A.idx.trader.get(el.dataset.id);
    if (!t || !A.canDo('tieu-thuong.them-moi', t.market)) return;
    const name = A.$('#tte-name').value.trim(), idNo = A.$('#tte-idno').value.trim(), phone = A.$('#tte-phone').value.trim();
    if (!name || !idNo || !phone) { U.toast('Vui lòng nhập đủ họ tên, số CCCD và điện thoại'); return; }
    if (A.db.traders.some(x => x.idNo === idNo && x.id !== t.id)) { U.toast('Số CCCD đã tồn tại trong hệ thống'); return; }
    t.name = name; t.idNo = idNo; t.phone = phone;
    t.idType = A.$('#tte-idtype').value;
    // Hồ sơ số hóa: CHỈ ghi đè đúng giấy tờ có file thay thế đang chờ (mục 10 yêu cầu) — giấy tờ
    // không bấm "Thay thế" giữ nguyên tham chiếu cũ, không bắt upload lại toàn bộ khi chỉ sửa field
    // thông tin khác.
    const pendingKeys = Object.keys(ttPendingDocs);
    if (pendingKeys.length) {
      t.docFiles = t.docFiles || {};
      pendingKeys.forEach(key => { t.docFiles[key] = Object.assign({}, ttPendingDocs[key], { updatedAt: U.today() }); });
    }
    U.log('Cập nhật hồ sơ tiểu thương ' + t.id + ' – ' + name);
    A.save();
    ttEditId = null;
    ttPendingDocs = {};
    ttRerenderDrawer(t);
    A.render(); U.toast('Đã cập nhật hồ sơ ' + t.id);
  };

  // ---------- Hợp đồng ----------
  function hdFixedContract(c) {
    const st = c && A.idx.stall.get(c.stallId);
    return st && U.rentalKind(st) === 'fixed';
  }
  A.VIEWS['hop-dong'] = function () {
    const q = (f.hdSearch || '').toLowerCase(), tab = ui.contractTab;
    const canNew = A.canDo('so-do.tao-hop-dong', ui.market) || A.canDo('hop-dong.tao', ui.market);
    const canExtend = A.canDo('hop-dong.gia-han', ui.market);
    const canEnd = A.canDo('hop-dong.thanh-ly', ui.market);
    const rows = A.db.contracts.filter(c => U.inM(c) && hdFixedContract(c)
      && (tab === 'all' ? c.status === 'hieuluc' : tab === 'exp' ? c.status === 'hieuluc' && U.days(U.today(), c.end) <= 30 : c.status === 'thanhly')
      && (!q || c.id.toLowerCase().includes(q) || A.idx.trader.get(c.traderId).name.toLowerCase().includes(q) || A.idx.stall.get(c.stallId).code.toLowerCase().includes(q)))
      .sort((a, b) => tab === 'exp' ? a.end.localeCompare(b.end) : 0);
    const pg = U.pager('hd' + tab, rows.length, 25);
    const n = k => A.db.contracts.filter(c => U.inM(c) && hdFixedContract(c) && (k === 'all' ? c.status === 'hieuluc' : k === 'exp' ? c.status === 'hieuluc' && U.days(U.today(), c.end) <= 30 : c.status === 'thanhly')).length;
    return `<div class="card"><div class="card-h">
      <div class="seg">${[['all', 'Đang hiệu lực'], ['exp', 'Sắp hết hạn ≤ 30 ngày'], ['end', 'Đã thanh lý']].map(x => `<button class="${tab === x[0] ? 'on' : ''}" data-act="hd-tab" data-id="${x[0]}">${x[1]} (${n(x[0])})</button>`).join('')}</div>
      <span class="spacer"></span><input class="input" placeholder="Số HĐ, tiểu thương, mã điểm" data-in="hd-search" value="${U.esc(f.hdSearch || '')}">
      ${canNew ? '<button class="btn primary" data-act="ct-new">+ Tạo hợp đồng</button>' : ''}</div>
      <div class="card-b">${U.table([{ t: 'Số hợp đồng' }, { t: 'Tiểu thương' }, { t: 'Điểm KD' }, { t: 'Loại' }, { t: 'Thời hạn' }, { t: 'Còn lại', num: true }, { t: 'Giá/tháng', num: true }, { t: 'Bản số hóa' }, { t: '' }],
        rows.slice(pg.start, pg.end).map(c => {
          const left = U.days(U.today(), c.end);
          return `<tr><td>${c.id}</td><td><a href="#" data-act="trader" data-id="${c.traderId}">${U.esc(A.idx.trader.get(c.traderId).name)}</a></td><td>${A.idx.stall.get(c.stallId).code}</td><td class="small">${c.kind}</td>
            <td class="nowrap">${U.dmy(c.start)} – ${U.dmy(c.end)}</td><td class="num">${c.status === 'hieuluc' ? (left <= 30 ? `<span class="tag danger">${left} ngày</span>` : left + ' ngày') : '–'}</td>
            <td class="num">${U.money(c.monthly)}</td><td>${c.scanned ? '<span class="tag info">PDF</span>' : '<span class="tag warn">Chưa scan</span>'}</td>
            <td class="nowrap">${c.status === 'hieuluc' ? `${canExtend ? `<button class="btn sm" data-act="ct-extend" data-id="${c.id}">Gia hạn</button>` : ''} ${canEnd ? `<button class="btn sm danger" data-act="ct-end" data-id="${c.id}">Thanh lý</button>` : ''}` : ''}</td></tr>`;
        }))}${pg.html}
        <div class="small muted" style="margin-top:8px">Màn này chỉ quản lý hợp đồng thuê cố định quầy tháng/quý. Quầy thuê theo phiên/khách vãng lai xử lý ở màn Phiên chợ quê.</div></div></div>`;
  };
  A.ACT['hd-tab'] = el => { ui.contractTab = el.dataset.id; A.render(); };
  A.IN['hd-search'] = el => { f.hdSearch = el.value; ui.page['hd' + ui.contractTab] = 0; A.render(); };
  A.ACT['ct-extend'] = el => {
    const c = A.idx.contract.get(el.dataset.id);
    if (!hdFixedContract(c)) return;
    if (!A.canDo('hop-dong.gia-han', c.market)) return;
    A.modal(A.mHead('Gia hạn ' + c.id) + `<div class="modal-b"><p>Hợp đồng hiện hết hạn ngày <b>${U.dmy(c.end)}</b>.</p>
      <div class="field"><label>Gia hạn thêm</label><select class="input" id="ext-m"><option value="12">12 tháng</option><option value="24">24 tháng</option><option value="36" selected>36 tháng</option></select></div></div>
      <div class="modal-f"><button class="btn" data-act="close">Hủy</button><button class="btn primary" data-act="ct-extend-save" data-id="${c.id}">Gia hạn</button></div>`);
  };
  A.ACT['ct-extend-save'] = el => {
    const c = A.idx.contract.get(el.dataset.id);
    if (!hdFixedContract(c)) return;
    if (!A.canDo('hop-dong.gia-han', c.market)) return;
    const m = Number(A.$('#ext-m').value);
    const d = new Date(c.end); d.setMonth(d.getMonth() + m);
    c.end = d.toISOString().slice(0, 10);
    U.log(`Gia hạn hợp đồng ${c.id} thêm ${m} tháng`);
    A.save(); A.closeModal(); A.render(); U.toast(`Đã gia hạn ${c.id} đến ${U.dmy(c.end)}`);
  };
  A.ACT['ct-end'] = el => {
    const c = A.idx.contract.get(el.dataset.id);
    if (!hdFixedContract(c)) return;
    if (!A.canDo('hop-dong.thanh-ly', c.market)) return;
    const debt = U.sum(A.db.invoices.filter(i => i.contractId === c.id && i.status !== 'paid'), U.due);
    A.modal(A.mHead('Thanh lý ' + c.id) + `<div class="modal-b"><p>Thanh lý hợp đồng với <b>${U.esc(A.idx.trader.get(c.traderId).name)}</b> tại điểm <b>${A.idx.stall.get(c.stallId).code}</b>. Điểm kinh doanh sẽ chuyển sang "Còn trống".</p>
      ${debt ? `<div class="note">Tiểu thương còn nợ ${U.money(debt)}. Cần thu hoặc cấn trừ tiền đặt cọc trước khi thanh lý.</div>` : ''}</div>
      <div class="modal-f"><button class="btn" data-act="close">Hủy</button><button class="btn danger" data-act="ct-end-save" data-id="${c.id}">Xác nhận thanh lý</button></div>`);
  };
  A.ACT['ct-end-save'] = el => {
    const c = A.idx.contract.get(el.dataset.id);
    if (!hdFixedContract(c)) return;
    if (!A.canDo('hop-dong.thanh-ly', c.market)) return;
    const st = A.idx.stall.get(c.stallId), t = A.idx.trader.get(c.traderId);
    c.status = 'thanhly'; c.end = U.today();
    st.history = st.history || []; st.history.unshift(`${U.dmy(U.today())}: thanh lý ${c.id} (${t.name})`);
    st.status = 'trong'; st.traderId = null; st.contractId = null;
    t.stalls = t.stalls.filter(id => id !== st.id);
    U.log(`Thanh lý hợp đồng ${c.id}`);
    A.save(); A.closeModal(); A.render(); U.toast('Đã thanh lý ' + c.id);
  };
  A.ACT['ct-new'] = el => {
    if (!A.canDo('so-do.tao-hop-dong', ui.market) && !A.canDo('hop-dong.tao', ui.market)) return;
    const pre = el.dataset.id;
    const empty = A.db.stalls.filter(s => s.status === 'trong' && U.rentalKind(s) === 'fixed' && (pre ? s.id === pre : U.inM(s)));
    if (!empty.length) { U.toast('Không còn điểm kinh doanh trống'); return; }
    const mk = empty[0].market;
    const traders = A.db.traders.filter(t => t.market === mk || t.stalls.length === 0).slice(-60).reverse();
    A.modal(A.mHead('Tạo hợp đồng thuê điểm kinh doanh') + `<div class="modal-b"><div class="form-grid">
      <div class="field"><label>Điểm kinh doanh còn trống</label><select class="input" id="nc-stall">${empty.map(s => `<option value="${s.id}">${s.code} · ${U.esc(s.sectionName)} · ${s.area.toLocaleString('vi-VN')} m²</option>`).join('')}</select></div>
      <div class="field"><label>Tiểu thương</label><select class="input" id="nc-trader">${traders.map(t => `<option value="${t.id}">${t.id} · ${U.esc(t.name)}</option>`).join('')}</select></div>
      <div class="field"><label>Thời hạn</label><select class="input" id="nc-term"><option value="12">12 tháng</option><option value="36" selected>36 tháng</option></select></div>
      <div class="field"><label>Ngày bắt đầu</label><input class="input" value="${U.dmy(U.today())}" disabled></div></div>
      <div class="note info" style="margin-top:12px">Chỉ tạo hợp đồng cho quầy thuê cố định tháng/quý. Quầy thuê theo phiên/khách vãng lai không được chọn ở màn này.</div></div>
      <div class="modal-f"><button class="btn" data-act="close">Hủy</button><button class="btn primary" data-act="ct-new-save">Tạo hợp đồng</button></div>`);
  };
  A.ACT['ct-new-save'] = () => {
    const st = A.idx.stall.get(A.$('#nc-stall').value);
    if (!st || st.status !== 'trong' || U.rentalKind(st) !== 'fixed' || (!A.canDo('so-do.tao-hop-dong', st.market) && !A.canDo('hop-dong.tao', st.market))) return;
    const t = A.idx.trader.get(A.$('#nc-trader').value), term = Number(A.$('#nc-term').value);
    const end = new Date(U.today()); end.setMonth(end.getMonth() + term); end.setDate(end.getDate() - 1);
    const fixedPolicy = D.RATE_POLICY_SEED.stallPrices.find(x => x.marketId === st.market && x.marketModel === D.RATE_MARKET_MODEL.FIXED_MONTHLY && x.status === 'active');
    const unit = fixedPolicy ? fixedPolicy.amount : D.UNIT[st.type];
    const monthly = Math.round(st.area * unit * 30 / 1000) * 1000;
    const c = { id: 'HĐ-' + st.market + '-2026-' + U.pad(A.db.contracts.length + 1, 4), stallId: st.id, traderId: t.id, market: st.market, kind: 'Hợp đồng thuê cố định quầy tháng/quý', start: U.today(), end: end.toISOString().slice(0, 10), unit, monthly, deposit: monthly, status: 'hieuluc', scanned: true };
    A.db.contracts.push(c); A.idx.contract.set(c.id, c);
    st.status = 'thue'; st.traderId = t.id; st.contractId = c.id; t.stalls.push(st.id);
    if (t.cat === 'Chưa gán') t.cat = st.cat;
    st.history = st.history || []; st.history.unshift(`${U.dmy(U.today())}: ký ${c.id} với ${t.name}`);
    U.log(`Tạo hợp đồng ${c.id} cho điểm ${st.code}`);
    A.save(); A.closeModal(); A.render(); U.toast('Đã tạo ' + c.id);
  };
})(window.APP);

// Detail-layout refresh: mirrors the compact two-column contract dossier while
// preserving the Contract V1 actions and data model above.
(function (A) {
  'use strict';
  const U = A.U;
  const active = c => c && c.status === 'hieuluc';
  const days = c => U.days(U.today(), c.end);
  const point = c => A.idx.stall.get(c.stallId);
  const trader = c => A.idx.trader.get(c.traderId);
  const tag = c => c.status === 'thanhly' ? '<span class="tag">Đã thanh lý</span>' : c.status === 'chamdut' ? '<span class="tag danger">Đã chấm dứt</span>' : active(c) ? '<span class="tag ok">Đang hiệu lực</span>' : '<span class="tag">Đã kết thúc</span>';
  const price = c => c.monthly ? U.money(c.monthly) + '/tháng' : 'Theo phiên';
  function section(icon, key, title, body, tone) {
    return `<section class="contract-detail-section ${tone || ''}"><h4><span>${U.icon(icon)}</span>${key}. ${title}</h4>${body}</section>`;
  }
  function pairs(rows) { return `<dl class="contract-detail-kv">${rows.map(r => `<dt>${r[0]}</dt><dd>${r[1]}</dd>`).join('')}</dl>`; }
  function detail(c) {
    const t = trader(c), s = point(c), files = c.signedCopies || [], h = c.history || [];
    const warning = active(c) && days(c) <= 30 ? `<b class="${days(c) <= 15 ? 'contract-danger-text' : 'contract-warn-text'}">${days(c)} ngày · Sắp hết hạn</b>` : active(c) ? days(c) + ' ngày' : '—';
    const contract = section('file', 'A', 'THÔNG TIN HỢP ĐỒNG', pairs([['Mã hợp đồng', '<b>' + c.id + '</b>'], ['Ngày ký', U.dmy(c.signedDate || c.start)], ['Ngày hiệu lực', U.dmy(c.start)], ['Ngày hết hạn', U.dmy(c.end)], ['Trạng thái', tag(c)], ['Thời hạn còn lại', warning]]), 'contract-amber');
    const traderBlock = section('users', 'B', 'TIỂU THƯƠNG', pairs([['Tiểu thương', t ? '<b>' + U.esc(t.name) + ' · ' + t.id + '</b>' : '—'], ['Điện thoại', t ? '☎ ' + U.maskPhone(t.phone) : '—'], ['Loại / diện tích', s ? 'Loại: ' + U.esc(U.typeLabel(s.type)) + '<br>Diện tích: <b>' + s.area + ' m²</b>' : '—']]) + (t ? `<div class="contract-section-action"><button class="btn sm" data-act="trader" data-id="${t.id}">${U.icon('eye')}Xem hồ sơ tiểu thương</button></div>` : ''), 'contract-blue');
    const pointBlock = section('store', 'C', 'ĐIỂM KINH DOANH', pairs([['Mã điểm', '<b>' + (s ? s.code : '—') + '</b>'], ['Khu vực', s ? U.esc(s.sectionName) : '—'], ['Loại / diện tích', s ? U.esc(U.typeLabel(s.type)) + ' · <b>' + s.area + ' m²</b>' : '—']]) + (s ? `<div class="contract-section-action"><button class="btn sm" data-act="dk-open" data-id="${s.id}">${U.icon('store')}Xem chi tiết điểm</button></div>` : ''), 'contract-mint');
    const vehicleFees = (c.vehicleFeeSnapshot || []).length ? `<div class="contract-vehicle-snapshot"><b>PHƯƠNG TIỆN</b><br>${c.vehicleFeeSnapshot.map(x => U.esc((x.plateNumber || x.type || 'Phương tiện')) + ': ' + U.money(x.amount) + ' / tháng').join('<br>')}<br><b>Tổng phí phương tiện: ${U.money(c.vehicleFeeSnapshot.reduce((n, x) => n + Number(x.amount || 0), 0))} / tháng</b></div>` : '';
    const regularFees = (c.feeSnapshot || []).filter(x => !String(x.name || '').startsWith('Phí phương tiện'));
    const fees = (regularFees.length ? regularFees.map(x => U.esc(x.name) + ': ' + U.money(x.amount)).join('<br>') : (vehicleFees ? '' : 'Chưa ghi nhận')) + vehicleFees;
    const finance = section('money', 'D', 'ĐƠN GIÁ & KHOẢN PHÍ', pairs([['Đơn giá snapshot', c.unit ? U.money(c.unit) + (c.unitLabel ? ' ' + U.esc(c.unitLabel) : '') : '—'], ['Giá thuê', '<b>' + price(c) + '</b>'], ['Khoản phí kèm theo', fees]]), 'contract-sky');
    const copies = section('attachment', 'E', 'BẢN SỐ HÓA HỢP ĐỒNG', files.length ? `<div class="contract-copy-list">${files.map((x,i) => `<div class="contract-copy"><span class="contract-copy-icon">${U.icon('file')}</span><span><b>Ảnh trang ${x.page || i + 1}</b><small>${U.esc(x.name)}</small></span><span class="tag ok">Đã lưu</span><button class="btn sm" data-act="ct-copy-view" data-id="${c.id}" data-file="${i}">Xem</button></div>`).join('')}</div>` : `<div class="contract-empty-copy"><span>${U.icon('file')}</span><div><b>Chưa cập nhật ảnh hợp đồng giấy đã ký.</b><small>Vui lòng thêm ảnh chụp/scan hợp đồng sau khi hai bên ký giấy.</small></div></div>` + (A.canDo('hop-dong.cap-nhat-ban-ky', c.market) ? `<button class="btn sm contract-add-copy" data-act="ct-copy-add" data-id="${c.id}">+ Thêm ảnh</button>` : ''), 'contract-purple');
    const history = section('refresh', 'F', 'LỊCH SỬ', h.length ? `<div class="tbl-wrap"><table class="tbl contract-history"><thead><tr><th>Thời gian</th><th>Sự kiện</th><th>Mô tả</th><th>Người thực hiện</th></tr></thead><tbody>${h.map(x => `<tr><td>${U.esc(x.at || '—')}</td><td><b>${U.esc(x.action || '—')}</b></td><td>${U.esc(x.detail || '—')}</td><td>${U.esc(x.by || 'Hệ thống')}</td></tr>`).join('')}</tbody></table></div>` : '<div class="empty small">Chưa có lịch sử xử lý.</div>', 'contract-history-section');
    return A.mHead(`${U.icon('file')}Hợp đồng ${c.id}`) + `<div class="modal-b contract-detail-body"><div class="contract-detail-grid">${contract}${traderBlock}${pointBlock}${finance}</div>${copies}${history}</div><div class="modal-f contract-detail-footer">${A.canDo('hop-dong.in', c.market) ? `<button class="btn primary" data-act="ct-print" data-id="${c.id}">${U.icon('print')}In hợp đồng</button>` : ''}${active(c) && A.canDo('hop-dong.gia-han', c.market) ? `<button class="btn" data-act="ct-renew" data-id="${c.id}">${U.icon('file')}Gia hạn / Tạo HĐ mới</button>` : ''}${active(c) && A.canDo('hop-dong.cham-dut', c.market) ? `<button class="btn danger" data-act="ct-terminate" data-id="${c.id}">× Chấm dứt</button>` : ''}${(active(c) || c.status === 'chamdut') && A.canDo('hop-dong.thanh-ly', c.market) ? `<button class="btn danger" data-act="ct-liquidate" data-id="${c.id}">⌁ Thanh lý</button>` : ''}<button class="btn" data-act="close">Đóng</button></div>`;
  }
  A.contractDetailLayoutV2 = detail;
  A.ACT['ct-view'] = el => { const c = A.idx.contract.get(el.dataset.id); if (c) A.modal(detail(c), true); };
})(window.APP);

// The Contract V1 handlers are initialized after the layout helper above; set
// the final view action here so the new dossier layout remains authoritative.
(function (A) {
  'use strict';
  A.ACT['ct-view'] = el => {
    const c = A.idx.contract.get(el.dataset.id);
    if (c && A.contractDetailLayoutV2) A.modal(A.contractDetailLayoutV2(c), true);
  };
})(window.APP);

// CONTRACT_MANAGEMENT_V1: contract records remain compatible with the legacy
// fields (`stallId`, `traderId`, `start`, `end`, `monthly`, `status`). New
// fields below are additive snapshots / audit metadata only.
(function (A) {
  'use strict';
  const U = A.U, ui = A.ui, f = ui.f;
  const active = c => c && c.status === 'hieuluc';
  const left = c => U.days(U.today(), c.end);
  const warn = c => !active(c) || left(c) > 30 ? '' : 'Sắp hết hạn';
  const cStatus = c => c.status === 'thanhly' ? 'Đã thanh lý' : c.status === 'chamdut' ? 'Đã chấm dứt' : active(c) ? 'Đang hiệu lực' : 'Đã kết thúc';
  const cTag = c => c.status === 'thanhly' ? '<span class="tag">Đã thanh lý</span>' : c.status === 'chamdut' ? '<span class="tag danger">Đã chấm dứt</span>' : active(c) ? '<span class="tag ok">Đang hiệu lực</span>' : '<span class="tag">Đã kết thúc</span>';
  const point = c => A.idx.stall.get(c.stallId), trader = c => A.idx.trader.get(c.traderId);
  const money = c => c.monthly ? U.money(c.monthly) + '/tháng' : 'Theo phiên';
  const event = (c, action, detail) => {
    c.history = c.history || [];
    c.history.unshift({ at: U.dmy(U.today()) + ' ' + U.nowTime(), action, detail: detail || '' });
  };
  const nextId = market => {
    const y = new Date(U.today()).getFullYear();
    const max = A.db.contracts.reduce((n, c) => Math.max(n, +(String(c.id).match(/-(\d+)$/) || [0, 0])[1]), 0);
    return 'HĐ-' + market + '-' + y + '-' + U.pad(max + 1, 4);
  };
  function expiryNotifications(c) {
    if (!active(c)) return;
    const d = left(c); [30, 15].forEach(m => {
      if (d > m) return;
      const key = 'contract-expiry:' + c.id + ':' + m;
      if (A.db.notifications.some(n => n.eventKey === key)) return;
      const t = trader(c), s = point(c); if (!t || !s) return;
      A.db.notifications.unshift({ id: 'TB-' + U.pad(32 + A.db.notifications.length, 3), at: U.today(), title: 'Hợp đồng ' + c.id + ' còn ' + d + ' ngày', body: 'Hợp đồng thuê điểm ' + s.code + ' của bạn sẽ hết hạn ngày ' + U.dmy(c.end) + '.', group: c.market, traderId: t.id, channels: ['Web BQL', 'Mini app'], sent: 1, delivered: 1, read: 0, auto: true, eventKey: key });
      event(c, 'Cảnh báo ' + m + ' ngày', 'Đã tạo mock notification cho BQL và tiểu thương');
    });
  }
  function syncExpiry() { A.db.contracts.filter(c => U.inM(c)).forEach(expiryNotifications); }
  function vacantCandidates(market, selected) {
    return A.db.stalls.filter(s => s.market === market && (selected ? s.id === selected : true) && s.status === 'trong' && !A.db.contracts.some(c => active(c) && c.stallId === s.id));
  }
  function contractDetail(c) {
    const t = trader(c), s = point(c), files = c.signedCopies || [], hist = c.history || [];
    const canPrint = A.canDo('hop-dong.in', c.market), canCopy = A.canDo('hop-dong.cap-nhat-ban-ky', c.market), canRenew = A.canDo('hop-dong.gia-han', c.market), canTerminate = A.canDo('hop-dong.cham-dut', c.market), canLiquidate = A.canDo('hop-dong.thanh-ly', c.market);
    return A.mHead('Hợp đồng ' + c.id) + `<div class="modal-b"><section><h4>A. THÔNG TIN HỢP ĐỒNG</h4><dl class="kv"><dt>Mã hợp đồng</dt><dd>${c.id}</dd><dt>Ngày ký</dt><dd>${U.dmy(c.signedDate || c.start)}</dd><dt>Hiệu lực</dt><dd>${U.dmy(c.start)}</dd><dt>Hết hạn</dt><dd>${U.dmy(c.end)}</dd><dt>Trạng thái</dt><dd>${cTag(c)}</dd><dt>Thời hạn còn lại</dt><dd>${active(c) ? (left(c) + ' ngày' + (warn(c) ? ' · <b>' + warn(c) + '</b>' : '')) : '—'}</dd></dl></section><section><h4>B. TIỂU THƯƠNG</h4><dl class="kv"><dt>Tiểu thương</dt><dd>${t ? U.esc(t.name) + ' · ' + t.id : '—'}</dd><dt>Điện thoại</dt><dd>${t ? U.maskPhone(t.phone) : '—'}</dd></dl>${t ? `<button class="btn sm" data-act="trader" data-id="${t.id}">Xem hồ sơ tiểu thương</button>` : ''}</section><section><h4>C. ĐIỂM KINH DOANH</h4><dl class="kv"><dt>Mã điểm</dt><dd>${s ? s.code : '—'}</dd><dt>Khu vực</dt><dd>${s ? U.esc(s.sectionName) : '—'}</dd><dt>Loại / diện tích</dt><dd>${s ? U.typeLabel(s.type) + ' · ' + s.area + ' m²' : '—'}</dd></dl>${s ? `<button class="btn sm" data-act="dk-open" data-id="${s.id}">Xem chi tiết điểm</button>` : ''}</section><section><h4>D. ĐƠN GIÁ & KHOẢN PHÍ</h4><dl class="kv"><dt>Đơn giá snapshot</dt><dd>${c.unit ? U.money(c.unit) + (c.unitLabel ? ' ' + U.esc(c.unitLabel) : '') : '—'}</dd><dt>Giá thuê</dt><dd>${money(c)}</dd><dt>Khoản phí kèm theo</dt><dd>${(c.feeSnapshot || []).length ? c.feeSnapshot.map(x => U.esc(x.name) + ': ' + U.money(x.amount)).join('<br>') : 'Chưa ghi nhận'}</dd></dl></section><section><h4>E. BẢN SỐ HÓA HỢP ĐỒNG</h4>${files.length ? files.map((x, i) => `<div class="row" style="padding:5px 0"><span style="flex:1">Ảnh trang ${x.page || i + 1} · ${U.esc(x.name)}</span><span class="tag ok">Đã lưu</span><button class="btn sm" data-act="ct-copy-view" data-id="${c.id}" data-file="${i}">Xem</button></div>`).join('') : '<div class="small muted">Chưa cập nhật ảnh hợp đồng giấy đã ký.</div>'}${canCopy ? `<div style="margin-top:8px"><button class="btn sm" data-act="ct-copy-add" data-id="${c.id}">+ Thêm ảnh</button></div>` : ''}</section><section><h4>F. LỊCH SỬ</h4>${hist.length ? `<div class="small">${hist.map(x => `<div style="padding:4px 0">${U.esc(x.at || '')} · <b>${U.esc(x.action || '')}</b>${x.detail ? ' — ' + U.esc(x.detail) : ''}</div>`).join('')}</div>` : '<div class="small muted">Chưa có sự kiện lịch sử.</div>'}</section></div><div class="modal-f">${canPrint ? `<button class="btn" data-act="ct-print" data-id="${c.id}">${U.icon('print')}In hợp đồng</button>` : ''}${active(c) && canRenew ? `<button class="btn" data-act="ct-renew" data-id="${c.id}">Gia hạn / Tạo HĐ mới</button>` : ''}${active(c) && canTerminate ? `<button class="btn danger" data-act="ct-terminate" data-id="${c.id}">Chấm dứt</button>` : ''}${(c.status === 'chamdut' || active(c)) && canLiquidate ? `<button class="btn danger" data-act="ct-liquidate" data-id="${c.id}">Thanh lý</button>` : ''}<button class="btn" data-act="close">Đóng</button></div>`;
  }
  A.VIEWS['hop-dong'] = function () {
    syncExpiry();
    const q = (f.hdSearch || '').toLowerCase(), tab = ui.contractTab || 'all', status = f.hdStatus || 'all';
    const all = A.db.contracts.filter(c => U.inM(c));
    const pick = c => (tab === 'all' || (tab === 'active' && active(c)) || (tab === '30' && active(c) && left(c) <= 30 && left(c) > 15) || (tab === '15' && active(c) && left(c) <= 15) || (tab === 'end' && !active(c))) && (status === 'all' || c.status === status || (status === 'expired' && active(c) && left(c) < 0));
    const rows = all.filter(c => pick(c) && (!q || [c.id, trader(c) && trader(c).name, c.traderId, point(c) && point(c).code].join(' ').toLowerCase().includes(q))).sort((a,b) => a.end.localeCompare(b.end));
    const count = fn => all.filter(fn).length, pg = U.pager('hd' + tab, rows.length, 25);
    const cards = [['all','Tổng hợp đồng',count(()=>true)],['active','Đang hiệu lực',count(active)],['30','Sắp hết hạn ≤ 30 ngày',count(c=>active(c)&&left(c)<=30&&left(c)>15)],['15','Sắp hết hạn ≤ 15 ngày',count(c=>active(c)&&left(c)<=15)],['end','Đã kết thúc',count(c=>!active(c))]];
    return `<div class="grid g4" style="margin-bottom:14px">${cards.map(x=>`<button class="card" data-act="hd-tab" data-id="${x[0]}" style="text-align:left"><div class="small muted">${x[1]}</div><div style="font-size:24px;font-weight:800;margin-top:5px">${x[2]}</div></button>`).join('')}</div><div class="card contract-table-card"><div class="card-h"><div class="seg">${[['all','Tất cả'],['active','Đang hiệu lực'],['30','Sắp hết hạn'],['15','Sắp hết hạn ≤ 15 ngày'],['end','Đã kết thúc']].map(x=>`<button class="${tab===x[0]?'on':''}" data-act="hd-tab" data-id="${x[0]}">${x[1]}</button>`).join('')}</div><span class="spacer"></span><input class="input" placeholder="Tìm mã HĐ, tên/mã tiểu thương, mã điểm..." data-in="hd-search" value="${U.esc(f.hdSearch||'')}">${A.canDo('hop-dong.tao',ui.market)?'<button class="btn primary" data-act="ct-new">+ Khởi tạo hợp đồng</button>':''}</div><div class="card-b">${U.table([{t:'Mã HĐ'},{t:'Tiểu thương'},{t:'Điểm KD'},{t:'Hiệu lực'},{t:'Hết hạn'},{t:'Đơn giá',num:true},{t:'Thời hạn còn lại'},{t:'Trạng thái'},{t:'Thao tác'}],rows.slice(pg.start,pg.end).map(c=>`<tr><td><b>${c.id}</b></td><td>${trader(c)?U.esc(trader(c).name)+'<div class="small muted">'+c.traderId+'</div>':'—'}</td><td>${point(c)?point(c).code:'—'}</td><td>${U.dmy(c.start)}</td><td>${U.dmy(c.end)}</td><td class="num">${money(c)}</td><td>${active(c)?(warn(c)?`<span class="tag ${left(c)<=15?'danger':'warn'}">${warn(c)} · ${left(c)} ngày</span>`:left(c)+' ngày'):'—'}</td><td>${cTag(c)}</td><td><button class="btn sm" data-act="ct-view" data-id="${c.id}">Xem</button></td></tr>`))}${pg.html}</div></div>`;
  };
  A.ACT['hd-tab'] = el => { ui.contractTab = el.dataset.id; ui.page['hd' + ui.contractTab] = 0; A.render(); };
  A.IN['hd-search'] = el => { f.hdSearch = el.value; A.render(); };
  // Status filter is intentionally separate from expiry tabs: it filters the
  // actual persisted lifecycle status, while tabs remain quick monitoring views.
  const contractViewWithStatusFilter = A.VIEWS['hop-dong'];
  A.VIEWS['hop-dong'] = function () {
    const current = f.hdStatus || 'all';
    const select = `<select class="input contract-status-filter" data-ch="hd-status" aria-label="Lọc theo trạng thái hợp đồng"><option value="all" ${current === 'all' ? 'selected' : ''}>Tất cả trạng thái</option><option value="hieuluc" ${current === 'hieuluc' ? 'selected' : ''}>Đang hiệu lực</option><option value="expired" ${current === 'expired' ? 'selected' : ''}>Đã hết hạn</option><option value="chamdut" ${current === 'chamdut' ? 'selected' : ''}>Đã chấm dứt / Chờ thanh lý</option><option value="thanhly" ${current === 'thanhly' ? 'selected' : ''}>Đã thanh lý</option></select>`;
    const filtered = current !== 'all' || !!f.hdSearch || (ui.contractTab || 'all') !== 'all';
    const clear = filtered ? '<button class="btn" data-act="hd-clear-filters">Xóa bộ lọc</button>' : '';
    return contractViewWithStatusFilter().replace('<span class="spacer"></span>', select + clear + '<span class="spacer"></span>');
  };
  A.CH['hd-status'] = el => { f.hdStatus = el.value; ui.page['hd' + (ui.contractTab || 'all')] = 0; A.render(); };
  A.ACT['hd-clear-filters'] = () => { f.hdStatus = 'all'; f.hdSearch = ''; ui.contractTab = 'all'; ui.page.hdall = 0; A.render(); };
  A.ACT['ct-view'] = el => { const c=A.idx.contract.get(el.dataset.id); if(c) A.modal(A.contractDetailLayoutV2 ? A.contractDetailLayoutV2(c) : contractDetail(c), true); };
  A.ACT['ct-new'] = el => {
    const old = el.dataset.id ? A.idx.contract.get(el.dataset.id) : null, market = old ? old.market : ui.market, options = old ? vacantCandidates(market, old.stallId).concat([point(old)]) : vacantCandidates(market);
    if (!options.length) return U.toast('Không có điểm kinh doanh phù hợp để cho thuê');
    const ts = A.db.traders.filter(t => t.market === market); const d0 = old ? new Date(old.end) : new Date(U.today()); if(old) d0.setDate(d0.getDate()+1);
    A.modal(A.mHead(old ? 'Tạo hợp đồng mới từ ' + old.id : 'Khởi tạo hợp đồng') + `<div class="modal-b"><div class="form-grid"><div class="field"><label>Mẫu hợp đồng *</label><select class="input" id="ct-template"><option>Hợp đồng thuê điểm kinh doanh</option><option>Đăng ký quầy theo năm</option></select></div><div class="field"><label>Tiểu thương *</label><select class="input" id="ct-trader">${ts.map(t=>`<option value="${t.id}" ${old&&t.id===old.traderId?'selected':''}>${t.id} · ${U.esc(t.name)}</option>`).join('')}</select></div><div class="field"><label>Điểm kinh doanh *</label><select class="input" id="ct-stall">${options.map(s=>`<option value="${s.id}" ${old&&s.id===old.stallId?'selected':''}>${s.code} · ${U.esc(s.sectionName)} · ${s.area} m²</option>`).join('')}</select></div><div class="field"><label>Ngày ký *</label><input class="input" id="ct-sign" type="date" value="${U.today()}"></div><div class="field"><label>Ngày hiệu lực *</label><input class="input" id="ct-start" type="date" value="${d0.toISOString().slice(0,10)}"></div><div class="field"><label>Ngày hết hạn *</label><input class="input" id="ct-end" type="date" value="${new Date(d0.getFullYear()+1,d0.getMonth(),d0.getDate()-1).toISOString().slice(0,10)}"></div><div class="field"><label>Đơn giá/tháng *</label><input class="input" id="ct-monthly" type="number" min="0" value="${old?old.monthly:0}"></div><div class="field"><label>Khoản phí kèm theo (tên: số tiền, mỗi dòng)</label><textarea class="input" id="ct-fees" rows="3">${old&&(old.feeSnapshot||[]).map(x=>x.name+': '+x.amount).join('\n')}</textarea></div></div><div class="note info">Mã hợp đồng được hệ thống tự sinh. Giá và phí được snapshot tại thời điểm khởi tạo; sau này không thay đổi theo cấu hình giá.</div></div><div class="modal-f"><button class="btn" data-act="close">Hủy</button><button class="btn primary" data-act="ct-new-save" data-prev="${old?old.id:''}">Khởi tạo</button></div>`, true);
  };
  A.ACT['ct-new-save'] = el => {
    const s= A.idx.stall.get(A.$('#ct-stall').value), t=A.idx.trader.get(A.$('#ct-trader').value), start=A.$('#ct-start').value, end=A.$('#ct-end').value, monthly=Number(A.$('#ct-monthly').value);
    if(!s||!t||!start||!end||end<start||monthly<0||!A.canDo('hop-dong.tao',s.market)) return U.toast('Vui lòng kiểm tra lại tiểu thương, điểm, thời hạn và đơn giá.');
    if(s.market!==ui.market||A.db.contracts.some(c=>active(c)&&c.stallId===s.id)) return U.toast('Điểm kinh doanh đã có hợp đồng hiệu lực.');
    const feeSnapshot=(A.$('#ct-fees').value||'').split('\n').map(x=>x.trim()).filter(Boolean).map(x=>{const a=x.split(':');return {name:a[0].trim(),amount:Number((a.slice(1).join(':')||'0').replace(/[^0-9.-]/g,''))||0};});
    const c={id:nextId(s.market),stallId:s.id,traderId:t.id,market:s.market,kind:A.$('#ct-template').value,start,end,signedDate:A.$('#ct-sign').value||start,unit:monthly,unitLabel:'đ/tháng',monthly,deposit:monthly,status:'hieuluc',scanned:false,feeSnapshot,signedCopies:[],history:[],previousContractId:el.dataset.prev||null};
    event(c,'Khởi tạo hợp đồng','Từ mẫu '+c.kind); A.db.contracts.push(c); A.reindex(); s.status='thue';s.traderId=t.id;s.contractId=c.id;if(!t.stalls.includes(s.id))t.stalls.push(s.id); s.history=s.history||[];s.history.unshift(U.dmy(U.today())+': ký '+c.id+' với '+t.name); expiryNotifications(c);U.log('Khởi tạo hợp đồng '+c.id);A.save();A.closeModal();A.render();U.toast('Đã khởi tạo '+c.id);
  };
  A.ACT['ct-renew'] = el => { const c=A.idx.contract.get(el.dataset.id); if(c&&A.canDo('hop-dong.gia-han',c.market)){A.closeModal(); A.ACT['ct-new']({dataset:{id:c.id}});} };
  // Legacy action aliases are deliberately redirected: renewal must never mutate
  // the old record's end date or price snapshot.
  A.ACT['ct-extend'] = el => A.ACT['ct-renew'](el);
  A.ACT['ct-extend-save'] = el => A.ACT['ct-renew'](el);
  A.ACT['ct-end'] = el => A.ACT['ct-liquidate'](el);
  A.ACT['ct-end-save'] = el => A.ACT['ct-liquidate-save'](el);
  A.ACT['ct-copy-add'] = el => { const c=A.idx.contract.get(el.dataset.id); if(!c||!A.canDo('hop-dong.cap-nhat-ban-ky',c.market))return; const input=document.createElement('input');input.type='file';input.accept='image/*,.pdf';input.style.display='none';document.body.appendChild(input);input.onchange=()=>{if(input.files[0]){c.signedCopies=c.signedCopies||[];c.signedCopies.push({name:input.files[0].name,page:c.signedCopies.length+1,addedAt:U.today(),mock:true});c.scanned=true;event(c,'Cập nhật bản ký','Đã lưu metadata '+input.files[0].name);A.save();A.closeModal();A.modal(contractDetail(c),true);}input.remove();};input.click(); };
  A.ACT['ct-copy-view'] = el => { const c=A.idx.contract.get(el.dataset.id), x=c&&(c.signedCopies||[])[+el.dataset.file]; if(x)A.modal(A.mHead('Bản số hóa')+`<div class="modal-b"><p><b>${U.esc(x.name)}</b></p><div class="note info">Prototype chỉ lưu metadata; không có upload hoặc storage thật.</div></div><div class="modal-f"><button class="btn" data-act="close">Đóng</button></div>`); };
  A.ACT['ct-print'] = el => { const c=A.idx.contract.get(el.dataset.id),t=trader(c),s=point(c);if(!c||!A.canDo('hop-dong.in',c.market))return;event(c,'In hợp đồng','In biểu mẫu để ký giấy');A.save();const w=window.open('','_blank');if(!w)return U.toast('Trình duyệt đã chặn cửa sổ in.');w.document.write(`<html><head><title>${c.id}</title><style>body{font:15px Arial;max-width:760px;margin:40px auto;line-height:1.7}h1{text-align:center}table{width:100%;border-collapse:collapse}td{border:1px solid #555;padding:8px}.sign{display:flex;justify-content:space-between;margin-top:80px;text-align:center}</style></head><body><h1>HỢP ĐỒNG THUÊ ĐIỂM KINH DOANH</h1><p><b>Mã hợp đồng:</b> ${c.id}</p><p><b>Ban Quản lý:</b> Chợ ${U.mShort(c.market)} · UBND phường Cao Lãnh</p><table><tr><td>Tiểu thương</td><td>${t?U.esc(t.name)+' · '+t.id:''}</td></tr><tr><td>Điểm kinh doanh</td><td>${s?s.code+' · '+U.esc(s.sectionName):''}</td></tr><tr><td>Thời hạn</td><td>${U.dmy(c.start)} – ${U.dmy(c.end)}</td></tr><tr><td>Đơn giá</td><td>${money(c)}</td></tr><tr><td>Khoản phí</td><td>${(c.feeSnapshot||[]).map(x=>U.esc(x.name)+': '+U.money(x.amount)).join('<br>')||'Không'}</td></tr></table><div class="sign"><div>ĐẠI DIỆN BQL<br><br><br><br>Ký, ghi rõ họ tên</div><div>TIỂU THƯƠNG<br><br><br><br>Ký, ghi rõ họ tên</div></div><script>window.onload=()=>window.print()<\/script></body></html>`);w.document.close(); };
  function release(c){const s=point(c),t=trader(c);if(s&&!A.db.contracts.some(x=>x.id!==c.id&&active(x)&&x.stallId===s.id)){s.status='trong';s.traderId=null;s.contractId=null;}if(t)t.stalls=t.stalls.filter(id=>!s||id!==s.id);}
  A.ACT['ct-terminate'] = el => {const c=A.idx.contract.get(el.dataset.id);if(!c||!A.canDo('hop-dong.cham-dut',c.market))return;const t=trader(c),s=point(c),remaining=U.days(U.today(),c.end),fees=(c.feeSnapshot||[]).map(x=>U.esc(x.name)).join(', ')||'Chưa ghi nhận',file=c._terminationDraftAttachment;A.modal(`<div class="terminate-head"><span class="terminate-head-icon">${U.icon('file')}</span><div><h3>Chấm dứt hợp đồng</h3><p>Ghi nhận việc kết thúc hợp đồng trước thời hạn.</p></div><button class="x" data-act="close" aria-label="Đóng">×</button></div><div class="modal-b terminate-body"><section class="terminate-info"><h4>${U.icon('file')}Thông tin hợp đồng</h4><div class="terminate-info-grid"><dl class="kv"><dt>Mã hợp đồng</dt><dd><b>${c.id}</b></dd><dt>Tiểu thương</dt><dd><b>${t?U.esc(t.name)+' · '+t.id:'—'}</b></dd><dt>Điểm kinh doanh</dt><dd><b>${s?s.code:'—'}</b></dd><dt>Ngày ký</dt><dd>${U.dmy(c.signedDate||c.start)}</dd><dt>Ngày hiệu lực</dt><dd>${U.dmy(c.start)}</dd><dt>Ngày hết hạn</dt><dd>${U.dmy(c.end)}</dd></dl><dl class="kv"><dt>Trạng thái hiện tại</dt><dd><span class="tag ok">Đang hiệu lực</span></dd><dt>Thời hạn còn lại</dt><dd><b>${remaining} ngày</b> (${U.dmy(c.end)})</dd><dt>Đơn giá thuê</dt><dd><b>${c.monthly?U.money(c.monthly)+'/tháng':'Theo phiên'}</b></dd><dt>Các khoản phí</dt><dd>${fees}</dd></dl></div><button class="btn sm terminate-view-contract" data-act="ct-view" data-id="${c.id}">${U.icon('eye')}Xem chi tiết hợp đồng</button></section><section class="terminate-section"><h4>${U.icon('file')}Thông tin chấm dứt</h4><div class="terminate-form-grid"><div class="field"><label>Ngày chấm dứt <b>*</b></label><input id="ct-stop-date" type="date" class="input" value="${U.today()}"></div><div class="field"><label>Lý do chấm dứt <b>*</b></label><select id="ct-stop-reason" class="input"><option value="">— Chọn lý do —</option><option>Tiểu thương xin nghỉ</option><option>Chuyển địa điểm kinh doanh</option><option>Vi phạm điều khoản hợp đồng</option><option>Theo thỏa thuận hai bên</option><option>Lý do khác</option></select></div></div><div class="field"><label>Chi tiết lý do <span class="muted">*</span></label><textarea id="ct-stop-detail" class="input" rows="3" placeholder="Nhập chi tiết lý do chấm dứt hợp đồng..."></textarea></div></section><section class="terminate-section terminate-files"><h4>${U.icon('attachment')}Tài liệu kèm theo (nếu có)</h4><div class="terminate-file-add"><button class="btn sm" data-act="ct-terminate-file" data-id="${c.id}">+ Thêm tài liệu</button><span>Đính kèm biên bản, quyết định, văn bản liên quan... (ảnh chụp/mock)</span></div>${file?`<div class="terminate-file-row"><span>${U.icon('file')}</span><div><b>${U.esc(file.name)}</b><small>Mock metadata · ${U.dmy(U.today())}</small></div><button class="btn sm" data-act="ct-terminate-file-remove" data-id="${c.id}">Xóa</button></div>`:''}</section><section class="terminate-section terminate-note"><h4>${U.icon('chat')}Ghi chú (không bắt buộc)</h4><textarea id="ct-stop-note" class="input" rows="2" placeholder="Nhập ghi chú..."></textarea></section><div class="terminate-warning"><span>${U.icon('warning')}</span><div><b>Lưu ý: Sau khi xác nhận chấm dứt, hợp đồng sẽ chuyển sang trạng thái Đã chấm dứt.</b><small>Nếu các nghĩa vụ liên quan (công nợ, bàn giao điểm...) chưa hoàn tất, hợp đồng sẽ ở trạng thái Chờ thanh lý.</small></div></div></div><div class="modal-f terminate-footer"><button class="btn" data-act="close">Hủy</button><button class="btn danger" data-act="ct-terminate-save" data-id="${c.id}">× Xác nhận chấm dứt</button></div>`,true);};
  A.ACT['ct-terminate-file']=el=>{const c=A.idx.contract.get(el.dataset.id);if(!c||!A.canDo('hop-dong.cham-dut',c.market))return;const input=document.createElement('input');input.type='file';input.accept='image/*,.pdf';input.style.display='none';document.body.appendChild(input);input.onchange=()=>{if(input.files[0])c._terminationDraftAttachment={name:input.files[0].name,mock:true};input.remove();A.ACT['ct-terminate']({dataset:{id:c.id}});};input.click();};
  A.ACT['ct-terminate-file-remove']=el=>{const c=A.idx.contract.get(el.dataset.id);if(!c)return;delete c._terminationDraftAttachment;A.ACT['ct-terminate']({dataset:{id:c.id}});};
  A.ACT['ct-terminate-save']=el=>{const c=A.idx.contract.get(el.dataset.id),reason=A.$('#ct-stop-reason').value.trim(),date=A.$('#ct-stop-date').value,detail=A.$('#ct-stop-detail').value.trim();if(!c||!reason||!date||!detail||!A.canDo('hop-dong.cham-dut',c.market))return U.toast('Cần nhập ngày, lý do và chi tiết lý do chấm dứt.');c.status='chamdut';c.termination={date,reason,detail,note:A.$('#ct-stop-note').value.trim(),attachment:c._terminationDraftAttachment||null};delete c._terminationDraftAttachment;event(c,'Chấm dứt hợp đồng',reason);release(c);A.save();A.closeModal();A.render();U.toast('Đã chấm dứt '+c.id);};
  A.ACT['ct-liquidate']=el=>{const c=A.idx.contract.get(el.dataset.id);if(!c||!A.canDo('hop-dong.thanh-ly',c.market))return;if(c.status!=='chamdut'&&U.days(U.today(),c.end)>0)return U.toast('Chỉ thanh lý hợp đồng đã hết hạn hoặc đã chấm dứt.');const t=trader(c),s=point(c),debt=U.sum(A.db.invoices.filter(i=>i.contractId===c.id&&i.status!=='paid'),U.due),d=c._liquidationDraft||{checks:{},copies:[]},checks=d.checks||{},copies=d.copies||[];const required=['pointReturned','conditionChecked','damagesRecorded','compensationResolved','keysHandedOver','minutesPrepared','minutesSigned'];const bqlDone=required.filter(k=>checks[k]).length,remaining=(debt?2:0)+(required.length-bqlDone)+(copies.length?0:1),system=(title,detail,ok,action)=>`<div class="liquidate-system-row"><span class="${ok?'system-ok':'system-warn'}">${ok?'✓':'!'}</span><div><b>${title}</b><small>${detail}</small></div><span class="tag ${ok?'ok':'warn'}">${ok?'Hoàn tất':'Chưa hoàn tất'}</span>${action||''}</div>`,manual=(key,title,detail)=>`<label class="liquidate-manual-row"><input type="checkbox" data-act="ct-liquidate-toggle" data-id="${c.id}" data-key="${key}" ${checks[key]?'checked':''}><span></span><div><b>${title}</b><small>${detail}</small></div></label>`;A.modal(`<div class="liquidate-head"><span class="liquidate-head-icon">${U.icon('file')}</span><div><h3>Thanh lý hợp đồng</h3><p>Checklist xác nhận hoàn tất quan hệ thuê và giải phóng điểm kinh doanh.</p></div><button class="x" data-act="close" aria-label="Đóng">×</button></div><div class="modal-b liquidate-body liquidation-v2"><section class="liquidate-info"><h4>${U.icon('file')}Thông tin hợp đồng</h4><div class="liquidate-info-grid"><dl class="kv"><dt>Mã hợp đồng</dt><dd><b>${c.id}</b></dd><dt>Tiểu thương</dt><dd><b>${t?U.esc(t.name)+' · '+t.id:'—'}</b></dd><dt>Điểm kinh doanh</dt><dd><b>${s?s.code+' ('+U.esc(s.sectionName)+')':'—'}</b></dd></dl><dl class="kv"><dt>Ngày ký</dt><dd>${U.dmy(c.signedDate||c.start)}</dd><dt>Hiệu lực</dt><dd>${U.dmy(c.start)}</dd><dt>Hết hạn</dt><dd>${U.dmy(c.end)}</dd><dt>Trạng thái</dt><dd>${c.status==='chamdut'?'<span class="tag warn">Đã chấm dứt</span>':'<span class="tag">Đã hết hạn</span>'}</dd></dl></div></section><div class="liquidate-notice"><span>${U.icon('warning')}</span><div><b>Checklist xác nhận của NV BQL</b><small>Công nợ được hệ thống tự kiểm tra; các điều kiện thực tế bên dưới do NV BQL xác nhận.</small></div></div><section class="liquidation-group"><h4>1. Công nợ & chi phí <span class="small muted">(hệ thống kiểm tra)</span></h4>${system('Đã thanh toán tiền thuê đến ngày kết thúc',debt?'Còn phải thu: '+U.money(debt):'Không còn khoản phải thu theo hợp đồng.',!debt,`<button class="btn sm" data-act="ct-liquidate-info" data-text="Công nợ & chi phí">Xem chi tiết</button>`)}${system('Đã xử lý điện, nước và các khoản phí dịch vụ',debt?'Còn có khoản phải thu cần xử lý.':'Không phát hiện khoản phí chưa hoàn tất.',!debt,'')}${system('Đã xử lý các khoản công nợ còn lại',debt?'Còn công nợ '+U.money(debt)+', không thể xác nhận thanh lý.':'Không còn công nợ.',!debt,'')}${system('Đã xử lý tiền đặt cọc (nếu có)',c.deposit?'Tiền đặt cọc snapshot: '+U.money(c.deposit)+' — NV BQL xác nhận trong biên bản.':'Không có tiền đặt cọc.',!!checks.depositHandled,'')}</section><section class="liquidation-group"><h4>2. Bàn giao điểm kinh doanh / tài sản <span class="small muted">(NV BQL xác nhận)</span></h4>${manual('pointReturned','Tiểu thương đã hoàn trả điểm kinh doanh','Đã bàn giao mặt bằng cho Ban quản lý.')}${manual('conditionChecked','Đã kiểm tra hiện trạng điểm / tài sản','Ghi nhận hiện trạng thực tế tại thời điểm bàn giao.')}${manual('damagesRecorded','Đã ghi nhận hư hỏng, mất mát nếu có','Không áp dụng nếu không phát sinh.')}${manual('compensationResolved','Đã hoàn tất nghĩa vụ bồi thường nếu phát sinh','Không áp dụng nếu không phát sinh.')}</section><section class="liquidation-group"><h4>3. Hồ sơ bàn giao <span class="small muted">(NV BQL xác nhận)</span></h4>${manual('keysHandedOver','Đã bàn giao chìa khóa / thẻ / giấy tờ liên quan','Xác nhận đã thu hồi toàn bộ vật dụng liên quan.')}${manual('minutesPrepared','Đã lập biên bản thanh lý / bàn giao','In biên bản để hai bên ký giấy.')}${manual('minutesSigned','Hai bên đã ký biên bản','Xác nhận biên bản giấy đã được ký.')}</section><section class="liquidation-docs"><h4>${U.icon('attachment')}Biên bản thanh lý đã ký</h4><div class="liquidation-doc-actions"><button class="btn sm" data-act="ct-liquidate-print" data-id="${c.id}">${U.icon('print')}In biên bản thanh lý</button><button class="btn sm" data-act="ct-liquidate-copy-add" data-id="${c.id}">+ Cập nhật bản đã ký</button></div>${copies.length?`<div class="liquidation-copy-list">${copies.map((x,i)=>`<div><span>${U.icon('file')}</span><b>Ảnh trang ${i+1} · ${U.esc(x.name)}</b><span class="tag ok">Đã lưu</span><button class="btn sm" data-act="ct-liquidate-copy-remove" data-id="${c.id}" data-file="${i}">Xóa</button></div>`).join('')}</div><div class="liquidation-signed-ok">✓ Đã lưu bản thanh lý có chữ ký</div>`:`<div class="liquidation-no-copy">Chưa có bản thanh lý đã ký. In biên bản → ký giấy → cập nhật ảnh chụp/scan (metadata mock).</div>`}</section><div class="field liquidate-note"><label>Ghi chú (không bắt buộc)</label><textarea class="input" id="ct-liquidate-note" rows="2" placeholder="Nhập ghi chú về việc thanh lý hợp đồng..."></textarea></div><div class="liquidate-warning"><span>${U.icon('warning')}</span><div><b>Lưu ý: Sau khi thanh lý, hợp đồng sẽ không thể khôi phục.</b><small>Quy trình pháp lý, mẫu biên bản và tài liệu bắt buộc vẫn cần BQL xác nhận.</small></div></div></div><div class="modal-f liquidate-footer"><span class="liquidate-remaining">${remaining?'Còn '+remaining+' điều kiện chưa hoàn tất':'Tất cả điều kiện bắt buộc đã hoàn tất'}</span><button class="btn" data-act="close">Hủy</button><button class="btn danger" data-act="ct-liquidate-save" data-id="${c.id}" ${remaining?'disabled':''}>${U.icon('check')}Xác nhận thanh lý</button></div>`,true);};
  A.ACT['ct-liquidate-info']=el=>U.toast(el.dataset.text+' — dữ liệu công nợ được đọc từ khoản phải thu của hợp đồng.');
  A.ACT['ct-liquidate-toggle']=el=>{const c=A.idx.contract.get(el.dataset.id);if(!c||!A.canDo('hop-dong.thanh-ly',c.market))return;c._liquidationDraft=c._liquidationDraft||{checks:{},copies:[]};c._liquidationDraft.checks[el.dataset.key]=el.checked;A.ACT['ct-liquidate']({dataset:{id:c.id}});};
  A.ACT['ct-liquidate-copy-add']=el=>{const c=A.idx.contract.get(el.dataset.id);if(!c||!A.canDo('hop-dong.thanh-ly',c.market))return;const input=document.createElement('input');input.type='file';input.accept='image/*,.pdf';input.style.display='none';document.body.appendChild(input);input.onchange=()=>{if(input.files[0]){c._liquidationDraft=c._liquidationDraft||{checks:{},copies:[]};c._liquidationDraft.copies.push({name:input.files[0].name,mock:true});}input.remove();A.ACT['ct-liquidate']({dataset:{id:c.id}});};input.click();};
  A.ACT['ct-liquidate-copy-remove']=el=>{const c=A.idx.contract.get(el.dataset.id);if(!c||!c._liquidationDraft)return;c._liquidationDraft.copies.splice(+el.dataset.file,1);A.ACT['ct-liquidate']({dataset:{id:c.id}});};
  A.ACT['ct-liquidate-print']=el=>{const c=A.idx.contract.get(el.dataset.id),t=trader(c),s=point(c);if(!c||!A.canDo('hop-dong.thanh-ly',c.market))return;const w=window.open('','_blank');if(!w)return U.toast('Trình duyệt đã chặn cửa sổ in.');w.document.write(`<html><head><title>Biên bản thanh lý ${c.id}</title><style>body{font:15px Arial;max-width:720px;margin:40px auto;line-height:1.7}h1{text-align:center}table{border-collapse:collapse;width:100%}td{border:1px solid #666;padding:8px}.sign{display:flex;justify-content:space-between;text-align:center;margin-top:80px}</style></head><body><h1>BIÊN BẢN THANH LÝ HỢP ĐỒNG</h1><p>Mã hợp đồng: <b>${c.id}</b></p><table><tr><td>Tiểu thương</td><td>${t?U.esc(t.name)+' · '+t.id:''}</td></tr><tr><td>Điểm kinh doanh</td><td>${s?s.code:''}</td></tr><tr><td>Thời hạn hợp đồng</td><td>${U.dmy(c.start)} – ${U.dmy(c.end)}</td></tr></table><p>Hai bên xác nhận hoàn tất quan hệ thuê theo biên bản này.</p><div class="sign"><div>ĐẠI DIỆN BQL<br><br><br>Ký, ghi rõ họ tên</div><div>TIỂU THƯƠNG<br><br><br>Ký, ghi rõ họ tên</div></div><script>window.onload=()=>window.print()<\/script></body></html>`);w.document.close();};
  A.ACT['ct-liquidate-save']=el=>{const c=A.idx.contract.get(el.dataset.id),d=c&&c._liquidationDraft,debt=c?U.sum(A.db.invoices.filter(i=>i.contractId===c.id&&i.status!=='paid'),U.due):0,required=['pointReturned','conditionChecked','damagesRecorded','compensationResolved','keysHandedOver','minutesPrepared','minutesSigned'];if(!c||!d||!A.canDo('hop-dong.thanh-ly',c.market)||c.status!=='chamdut'&&U.days(U.today(),c.end)>0||debt||!required.every(k=>d.checks[k])||!d.copies.length)return U.toast('Chưa thể thanh lý: cần hoàn tất công nợ, checklist NV BQL và bản thanh lý đã ký.');const note=A.$('#ct-liquidate-note');c.status='thanhly';c.liquidatedAt=U.today();c.liquidationNote=note?note.value.trim():'';c.liquidationChecklist=d.checks;c.liquidationSignedCopies=d.copies;delete c._liquidationDraft;event(c,'Thanh lý hợp đồng',c.liquidationNote||'Checklist và bản thanh lý ký đã hoàn tất');release(c);A.save();A.closeModal();A.render();U.toast('Đã thanh lý '+c.id);};
})(window.APP);

/* Business-point UI (Phase 15.15, from js/v-tieuthuong.js): CL point table (table mode of the mat-bang
 * workspace), CL point drawer (overview / contract / direct seller / history), point edit, direct seller
 * registration and verification, generic point table (route diem-kd outside CL), A.openDkDrawer. */
(function (A) {
  'use strict';
  const D = A.D, U = A.U, ui = A.ui;
  const f = ui.f;
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
    const path = A.mbLayoutPathForPoint('CL', s);
    const collectorLabel = dkCollectorLabel(s);
    return `<tr class="click" data-act="dk-open" data-id="${s.id}">
      <td class="mb-col-code"><b>${s.code}</b>${A.WORKFLOW && A.WORKFLOW.isRecentPoint(s.id) ? '<div><span class="workflow-new">Mới cập nhật</span></div>' : ''}</td>
      ${pos.zone ? `<td class="mb-col-zone">${U.esc(path.khu)}</td>` : ''}
      ${pos.floor ? `<td class="mb-col-floor">${U.esc(path.tang)}</td>` : ''}
      ${pos.row ? `<td class="mb-col-row" title="${U.esc(s.sectionName)}">${U.esc(path.day)}</td>` : ''}
      <td class="num mb-col-area">${s.area.toLocaleString('vi-VN')}</td>
      <td class="mb-col-area-type">${U.esc(U.areaTypeLabel(s.areaType) || 'Chưa có thông tin')}</td>
      <td class="mb-col-category" title="${U.esc(s.cat)}">${U.esc(s.cat)}</td>
      <td class="mb-col-trader" title="${t ? U.esc(t.name) : ''}">${t ? U.esc(t.name) : '<span class="muted">–</span>'}</td>
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
      <div class="card-b">${U.table([{ t: '<span class="mb-col-code">Mã điểm</span>' }, pos.zone && { t: '<span class="mb-col-zone">Khu</span>' }, pos.floor && { t: '<span class="mb-col-floor">Tầng</span>' }, pos.row && { t: '<span class="mb-col-row">Dãy</span>' }, { t: '<span class="mb-col-area">Diện tích (m²)</span>', num: true }, { t: '<span class="mb-col-area-type">Loại diện tích</span>' }, { t: '<span class="mb-col-category">Ngành hàng</span>' }, { t: '<span class="mb-col-trader">Tiểu thương</span>' }, { t: '<span class="mb-col-collector">NV thu phí</span>' }, { t: '<span class="mb-col-status">Trạng thái</span>' }, { t: '<span class="mb-col-actions">Thao tác</span>' }].filter(Boolean),
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
    return `<div class="drawer-h dk-popup-head"><div><div class="row" style="gap:10px"><h3>${st.code}</h3>${U.statusTag(st.status)}${A.WORKFLOW && A.WORKFLOW.isRecentPoint(st.id) ? '<span class="workflow-new">Mới cập nhật</span>' : ''}</div><div class="small muted dk-popup-meta">${U.esc(dkPointTypeLabel(st))} · ${U.esc((m.floors.find(fl=>fl.id===st.floor)||{}).name||'')} · ${U.esc(m.name)}</div></div><span class="spacer"></span>${canEdit?`<button class="btn sm" data-act="dkcl-edit-open" data-id="${st.id}">Chỉnh sửa thông tin</button>`:''}<button class="x" data-act="close" aria-label="Đóng">×</button></div>${dkDetailTabsHtml(active)}<div class="drawer-b dk-detail-body dk-tab-content">${content}</div><div class="drawer-f dk-popup-footer"><button class="btn" data-act="close">Đóng</button></div>`;
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
    return `<section class="dk-detail-card dk-single-card"><div class="dk-detail-card-h"><span class="dk-card-icon green">${U.icon('file')}</span><div><b>Hợp đồng hiện hành</b><div class="small muted">Thông tin hợp đồng gắn với điểm kinh doanh</div></div></div><dl class="kv"><dt>Mã hợp đồng</dt><dd><b>${c.id}</b></dd><dt>Trạng thái</dt><dd>${c.status==='hieuluc'?'<span class="tag ok">Đang hiệu lực</span>':U.esc(c.status)}</dd><dt>Chủ thể hợp đồng</dt><dd>${t?`${U.esc(t.name)} · ${t.id}`:'Chưa có'}</dd><dt>Điểm kinh doanh</dt><dd>${st.code}</dd><dt>Ngày bắt đầu</dt><dd>${U.dmy(c.start)}</dd><dt>Ngày kết thúc</dt><dd>${U.dmy(c.end)}</dd><dt>Thời hạn còn lại</dt><dd>${left} ngày</dd></dl><div class="row" style="margin-top:12px">${t&&A.canDo('so-do.xem-ho-so',st.market)?`<button class="btn sm" data-act="dkcl-open-trader" data-id="${t.id}" data-stall="${st.id}">Xem hồ sơ tiểu thương</button>`:''}<button class="btn sm" data-act="ct-view" data-id="${c.id}">Xem hợp đồng</button></div></section>${historyHtml}`;
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

  A.VIEWS['diem-kd'] = () => ui.market === 'CL' ? A.mbWorkspaceHtml() : dkViewGeneric();
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
  // Direct-seller lookup read by the trader drawer.
  A.features.businessPoints.ui = { dkSeller };
})(window.APP);

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
  // hàng/loại diện tích với chế độ Sơ đồ), KHÔNG còn state filter riêng. v16: "Loại điểm" (pointType)
  // đã bỏ khỏi model; bảng/filter dùng "Loại diện tích" (stall.areaTypeId).
  function dkSeller(s) {
    const assignment = (A.db.directSellerAssignments || []).find(x => x.pointId === s.id && x.status === 'ACTIVE');
    if (assignment) return assignment.traderId ? A.idx.trader.get(assignment.traderId) : { id: assignment.personId || '', name: assignment.fullName, phone: assignment.phone, idNo: assignment.idNumber };
    if (s.sellerId) return A.idx.trader.get(s.sellerId);
    return s.traderId ? A.idx.trader.get(s.traderId) : null;
  }
  // "NV thu phí phụ trách" — phân công theo Dãy (row.collectorId, đọc qua s.collectorId); THAM CHIẾU
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
  // Chế độ "Bảng" của workspace Mặt bằng (mọi chợ): dataset DUY NHẤT = A.mbCurrentPoints(mid) —
  // phạm vi node đang chọn trên cây + bộ lọc dùng chung (chip trạng thái, tìm kiếm, loại diện tích,
  // ngành hàng). Vị trí/ngành hàng/NV thu phí đều suy từ Dãy của điểm, không lưu trên điểm.
  const dkMarket = () => (ui.market === 'ALL' ? (ui.qh && ui.qh.market) || 'CL' : ui.market);
  function dkRowsOf(mid) {
    return A.mbCurrentPoints(mid);
  }
  // Table occupant follows the same selected-date rule as status/search:
  // Point → occupying Contract → Trader. No Trader field is stored on Point.
  function dkOccupantAt(s) { return A.mbOccupantAt ? A.mbOccupantAt(s) : null; }
  function dkRowHtml(s, pos) {
    const occupant = dkOccupantAt(s);
    const occupantTitle = occupant ? `${occupant.id} · ${occupant.name}` : '';
    return `<tr class="click" data-act="dk-open" data-id="${s.id}">
      <td class="mb-col-code"><b>${s.code}</b>${A.WORKFLOW && A.WORKFLOW.isRecentPoint(s.id) ? '<div><span class="workflow-new">Mới cập nhật</span></div>' : ''}</td>
      ${pos.location ? `<td class="mb-col-location">${U.esc(A.mbPointLocationLabel(s, pos.level))}</td>` : ''}
      <td class="num mb-col-area">${s.area.toLocaleString('vi-VN')}</td>
      <td class="mb-col-area-type">${U.esc(U.areaTypeLabel(s.areaTypeId) || 'Chưa có thông tin')}</td>
      ${pos.industry ? `<td class="mb-col-category" title="${U.esc(s.cat)}">${U.esc(s.cat)}</td>` : ''}
      <td class="mb-col-trader"${occupant ? ` title="${U.esc(occupantTitle)}"` : ''}>${occupant ? U.esc(occupant.name) : '—'}</td>
      <td class="small mb-col-collector">${U.esc(dkCollectorLabel(s))}</td>
      <td class="mb-col-status">${A.mbStatusTag(A.mbStatusAt(s))}</td>
    </tr>`;
  }
  function dkView(mid) {
    const rows = dkRowsOf(mid), pg = U.pager('dkcl', rows.length, 25), flt = ui.mb.filter, cats = A.mbCatOptions(mid), pos = A.mbPositionColumnVisibility();
    return `<div class="card mb-table-card"><div class="card-h" style="flex-wrap:wrap">
      <input class="input" data-in="mb-filter-search" placeholder="Tìm mã điểm / tiểu thương" value="${U.esc(flt.search)}" aria-label="Tìm mã điểm hoặc tiểu thương">
      <select class="input" data-ch="mb-filter-area-type" aria-label="Loại diện tích"><option value="">Loại diện tích: Tất cả</option>${U.AREA_TYPE_CODES.map(k => `<option value="${k}" ${flt.areaType === k ? 'selected' : ''}>${U.areaTypeLabel(k)}</option>`).join('')}</select>
      ${pos.industry ? `<select class="input" data-ch="mb-filter-cat" aria-label="Ngành hàng"><option value="">Ngành hàng: Tất cả</option>${cats.map(cName => `<option value="${U.esc(cName)}" ${flt.cat === cName ? 'selected' : ''}>${U.esc(cName)}</option>`).join('')}</select>` : ''}
      <button class="btn" data-act="dkcl-clear" ${dkclHasFilter() ? '' : 'disabled'}>↺ Xóa bộ lọc</button>
      <span class="spacer"></span>
      <span class="small muted">${rows.length.toLocaleString('vi-VN')} điểm</span>
      <button class="btn" data-act="dkcl-csv">⬇ Xuất Excel</button></div>
      <div class="card-b">${U.table([{ t: '<span class="mb-col-code">Mã điểm</span>' }, pos.location && { t: '<span class="mb-col-location">Vị trí</span>' }, { t: '<span class="mb-col-area">Diện tích (m²)</span>', num: true }, { t: '<span class="mb-col-area-type">Loại diện tích</span>' }, pos.industry && { t: '<span class="mb-col-category">Ngành hàng</span>' }, { t: '<span class="mb-col-trader">Tiểu thương</span>' }, { t: '<span class="mb-col-collector">NV thu phí phụ trách</span>' }, { t: '<span class="mb-col-status">Tình trạng</span>' }].filter(Boolean),
        rows.slice(pg.start, pg.end).map(s => dkRowHtml(s, pos)), { empty: 'Không có điểm kinh doanh phù hợp bộ lọc.' })}${pg.html}</div></div>`;
  }
  A.dkTableHtml = mid => dkView(mid);
  // "Xóa bộ lọc" của bảng: reset TOÀN BỘ bộ lọc dùng chung (search/trạng thái/ngành hàng/loại diện
  // tích) — KHÔNG đụng ui.mb.sel (phạm vi cây đang chọn).
  A.ACT['dkcl-clear'] = () => {
    ui.mb.filter = { search: '', status: '', cat: '', areaType: '' };
    ui.page.dkcl = 0;
    A.render();
  };
  A.ACT['dkcl-csv'] = () => {
    const mid = dkMarket();
    U.csv('diem-kinh-doanh-' + mid.toLowerCase(), ['Mã điểm', 'Khối/Nhà chợ', 'Tầng', 'Dãy', 'Diện tích m2', 'Loại diện tích', 'Ngành hàng', 'Người thuê', 'Người bán thực tế', 'NV thu phí', 'Tình trạng'],
      dkRowsOf(mid).map(s => {
        const t = A.mbOccupantAt(s), seller = dkSeller(s), path = A.mbLayoutPathForPoint(mid, s);
        return [s.code, path.khu, path.tang, path.day, s.area, U.areaTypeLabel(s.areaTypeId) || '', s.cat, t ? t.name : '', seller ? seller.name : '', dkCollectorLabel(s), A.mbStatusLabel(A.mbStatusAt(s))];
      }));
  };
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
  function dkDirectSellerFormHtml(st) {
    const d = dkDirectSellerDraft;
    const owner = st.traderId ? A.idx.trader.get(st.traderId) : null;
    return `<div class="drawer-h detail-form-head"><div><h3>${st.code}</h3><div class="small muted">Bổ sung / thay đổi người trực tiếp kinh doanh</div></div><span class="spacer"></span><button class="x" data-act="dkds-cancel" data-id="${st.id}">×</button></div><div class="detail-form-tabs">${U.icon('users')} Người trực tiếp kinh doanh</div><div class="drawer-b detail-form-body"><section class="detail-form-card">
      <div class="field"><label><input type="radio" name="dkds-kind" data-ch="dkds-kind" value="owner" ${d.kind === 'owner' ? 'checked' : ''}> Chính tiểu thương/chủ thể hiện tại trực tiếp kinh doanh</label></div>
      <div class="field"><label><input type="radio" name="dkds-kind" data-ch="dkds-kind" value="other" ${d.kind === 'other' ? 'checked' : ''}> Người khác trực tiếp kinh doanh</label></div>
      ${d.kind === 'owner' ? `<div class="note">${owner ? `${U.esc(owner.name)} · ${U.maskPhone(owner.phone)}` : 'Điểm chưa có chủ thể hợp đồng; hãy nhập người khác.'}</div>` : `<div class="field"><label>Họ tên *</label><input class="input" data-in="dkds-name" value="${U.esc(d.fullName)}"></div><div class="field" style="margin-top:8px"><label>CCCD/định danh</label><input class="input" data-in="dkds-idno" value="${U.esc(d.idNumber)}"></div><div class="field" style="margin-top:8px"><label>SĐT</label><input class="input" data-in="dkds-phone" value="${U.esc(d.phone)}"></div><div class="field" style="margin-top:8px"><label>Quan hệ với chủ thể</label><input class="input" data-in="dkds-relationship" value="${U.esc(d.relationship)}"></div>`}
      <div class="field" style="margin-top:8px"><label>Ngày bắt đầu *</label><input class="input" type="date" data-in="dkds-start" value="${U.esc(d.startDate)}"></div><div class="field" style="margin-top:8px"><label>Ghi chú</label><textarea class="input" rows="2" data-in="dkds-note">${U.esc(d.note)}</textarea></div><div class="small muted">Tệp minh họa chỉ là metadata mock, không upload tệp thật.</div></section></div><div class="drawer-f detail-form-footer"><button class="btn" data-act="dkds-cancel" data-id="${st.id}">Hủy</button><button class="btn primary" data-act="dkds-save" data-id="${st.id}">Lưu đăng ký chờ xác minh</button></div>`;
  }
  // Pop-up chi tiết điểm KD dùng CÙNG thiết kế với pop-up Hồ sơ tiểu thương (một trang cuộn, các khối
  // A–E kiểu contract-detail-section, cặp nhãn/giá trị contract-detail-kv, footer căn giữa) — xem
  // traders/page.js ttDrawerHtmlCL. Chỉ đổi trình bày; dữ liệu/quyền/handler giữ nguyên.
  const dkSection = (icon, key, title, body, tone) => `<section class="contract-detail-section ${tone || ''}"><h4><span>${U.icon(icon)}</span>${key}. ${title}</h4>${body}</section>`;
  const dkPairs = rows => `<dl class="contract-detail-kv">${rows.map(r => `<dt>${r[0]}</dt><dd>${r[1]}</dd>`).join('')}</dl>`;
  const dkActions = list => { const html = list.filter(Boolean).join(''); return html ? `<div class="contract-section-action dk-dossier-actions">${html}</div>` : ''; };
  function dkHistoryHtml(st) {
    if (!st.history || !st.history.length) return '<div class="small muted">Chưa có lịch sử thay đổi.</div>';
    return dkPairs(st.history.map(h => {
      const i = h.indexOf(': ');
      return i === -1 ? ['—', U.esc(h)] : [U.esc(h.slice(0, i)), U.esc(h.slice(i + 2))];
    }));
  }
  // Point → contracts on this point (current / future / ended), derived from Contract records.
  function dkContractsHtml(st) {
    const BP = A.features.businessPoints.service, today = U.today(), canContract = U.can('hop-dong');
    const list = A.db.contracts.filter(x => (x.businessPointId || x.stallId) === st.id).sort((a, b) => String(b.start).localeCompare(String(a.start)));
    if (!list.length) return '<div class="small muted">Chưa có hợp đồng nào gắn với điểm này.</div>';
    const phaseTag = c => { const ph = BP.contractPhase(c, today); return ph === 'current' ? '<span class="tag ok">Đang hiệu lực</span>' : ph === 'future' ? '<span class="tag info">Sắp hiệu lực</span>' : `<span class="tag">${c.status === 'chamdut' ? 'Đã chấm dứt' : c.status === 'thanhly' ? 'Đã thanh lý' : 'Đã kết thúc'}</span>`; };
    return `<div class="contract-copy-list">${list.map(c => { const t = A.idx.trader.get(c.traderId); return `<div class="contract-copy dk-contract-row"><span class="contract-copy-icon">${U.icon('file')}</span><span><b>${U.esc(c.id)} · ${t ? U.esc(t.name) : U.esc(c.traderId)}</b><small>${U.dmy(c.start)} → ${c.end ? U.dmy(c.end) : 'không thời hạn'}</small></span>${phaseTag(c)}${canContract ? `<button class="btn sm" data-act="ct-view" data-id="${c.id}">Xem hợp đồng</button>` : ''}</div>`; }).join('')}</div>`;
  }
  // Point → trader → contract, date-aware through the shared availability rule (business-points
  // service): occupied NOW vs free now, plus a scheduled future contract. "Trống hôm nay" is never
  // presented as "trống mãi".
  function dkUsageHtml(st, canXemHoSo) {
    const BP = A.features.businessPoints.service, today = U.today();
    const c = BP.contractOn(st.id, today), t = c ? A.idx.trader.get(c.traderId) : null, next = BP.nextOccupancy(st.id, today);
    const since = c ? null : BP.freeSince(st.id, today), nt = next ? A.idx.trader.get(next.contract.traderId) : null;
    const left = c && c.end ? U.days(today, BP.occupyingInterval(c).end) : null;
    const canContract = U.can('hop-dong');
    const rows = c
      ? [['Tình trạng hôm nay', '<span class="tag ok">Đang sử dụng</span>'], ['Tiểu thương', t ? `<b>${U.esc(t.name)}</b> · ${t.id}` : U.esc(c.traderId)], ['Hợp đồng', `<b>${c.id}</b>`],
        ['Thời hạn', `${U.dmy(c.start)} → ${c.end ? U.dmy(c.end) : 'không thời hạn'}${left != null ? ` · ${left <= 30 ? `<b class="contract-danger-text">còn ${left} ngày</b>` : 'còn ' + left + ' ngày'}` : ''}`]]
      : [['Tình trạng hôm nay', `<span class="tag">Đang trống</span>${BP.isAllocatable(st) ? '' : ' <span class="small muted">(không bố trí được do trạng thái điểm)</span>'}`], ['Trống từ', since ? U.dmy(since) : 'Chưa ghi nhận hợp đồng']];
    if (next) rows.push(['Đã có lịch bố trí từ', `${U.dmy(next.interval.start)} · ${U.esc(next.contract.id)}${nt ? ' · ' + U.esc(nt.name) : ''}`]);
    rows.push(['NV thu phí phụ trách', U.esc(dkCollectorLabel(st))]);
    return dkPairs(rows) + dkActions([
      t && canXemHoSo ? `<button class="btn sm" data-act="dkcl-open-trader" data-id="${t.id}" data-stall="${st.id}">${U.icon('eye')}Xem hồ sơ tiểu thương</button>` : '',
      c && canContract ? `<button class="btn sm" data-act="ct-view" data-id="${c.id}">${U.icon('file')}Xem hợp đồng</button>` : '',
      next && canContract ? `<button class="btn sm" data-act="ct-view" data-id="${next.contract.id}">${U.icon('file')}Xem hợp đồng sắp tới</button>` : ''
    ]);
  }
  function dkStructuralNotes(st) {
    return `${st.structuralStatus === 'SPLIT' ? '<div class="note info" style="margin-top:10px">Điểm này đã được tách theo một yêu cầu tách điểm — xem lịch sử ở mục D.</div>' : ''}${st.structuralStatus === 'MERGED' ? `<div class="note info" style="margin-top:10px">Điểm này đã được gộp; bản ghi được giữ lại để truy vết lịch sử.${st.mergedIntoPointId && A.idx.stall.get(st.mergedIntoPointId) ? ` <button class="btn sm" data-act="dkmerge-view-point" data-id="${st.mergedIntoPointId}">Xem ${A.idx.stall.get(st.mergedIntoPointId).code}</button>` : ''}</div>` : ''}${st.mergeRequestId ? `<div class="note info" style="margin-top:10px">Điểm được tạo từ nghiệp vụ gộp. Điểm nguồn: ${(st.sourcePointIds || []).map(id => { const x = A.idx.stall.get(id); return x ? `<button class="btn sm" data-act="dkmerge-view-point" data-id="${x.id}">${x.code}</button>` : ''; }).join(' ')}<br>Ánh xạ mặt bằng cần được cập nhật tại Cấu hình mặt bằng.</div>` : ''}`;
  }
  const dkHead = st => `<div class="drawer-h tt-dossier-head"><h3>${U.icon('store')}Điểm kinh doanh ${U.esc(st.code)}</h3>${A.WORKFLOW && A.WORKFLOW.isRecentPoint(st.id) ? '<span class="workflow-new">Mới cập nhật</span>' : ''}<button class="x" data-act="close" aria-label="Đóng">×</button></div>`;
  function dkDetailHtmlCL(st) {
    if (dkDirectSellerPointId === st.id) return dkDirectSellerFormHtml(st);
    if (dkEditId === st.id) return dkEditHtmlCL(st);
    const m = U.market('CL'), dkPos = A.mbLayoutPathForPoint('CL', st);
    const canEdit = A.canDo('cau-truc.edit', st.market), canXemHoSo = A.canDo('so-do.xem-ho-so', st.market);
    const structural = st.structuralStatus === 'MERGED' ? '<span class="tag warn">Đã gộp</span>' : st.structuralStatus === 'SPLIT' ? '<span class="tag purple">Đã tách</span>' : '<span class="tag ok">Hoạt động</span>';
    const info = dkSection('store', 'A', 'THÔNG TIN ĐIỂM KINH DOANH', dkPairs([['Mã điểm', `<b>${U.esc(st.code)}</b>`], ['Tình trạng', A.mbStatusTag(A.pointDisplayStatus(st))], ['Trạng thái vận hành', U.esc(A.pointOpLabel(st.status))], ['Chợ', U.esc(m.name)], ['Khối/Nhà chợ', U.esc(dkPos.khu)], ['Tầng', U.esc(dkPos.tang)], ['Dãy', U.esc(dkPos.day)], ['Diện tích', `<b>${st.area.toLocaleString('vi-VN')} m²</b>`], ['Loại diện tích', U.esc(U.areaTypeLabel(st.areaTypeId) || 'Chưa có thông tin')], ['Ngành hàng (theo dãy)', U.esc(st.cat) || 'Chưa có thông tin'], ['Đơn giá áp dụng', U.unitLabel(st)], ['Trạng thái cấu trúc', structural]]) + dkStructuralNotes(st), 'contract-blue');
    const usage = dkSection('users', 'B', 'TÌNH TRẠNG SỬ DỤNG', dkUsageHtml(st, canXemHoSo), 'contract-mint');
    const contracts = dkSection('file', 'C', 'HỢP ĐỒNG TẠI ĐIỂM', dkContractsHtml(st), 'contract-amber');
    const history = dkSection('refresh', 'D', 'LỊCH SỬ THAY ĐỔI', dkHistoryHtml(st), 'contract-sky');
    const note = dkSection('file', 'E', 'GHI CHÚ', `<div class="small ${st.note ? '' : 'muted'}">${st.note ? U.esc(st.note) : 'Chưa có ghi chú.'}</div>`, 'contract-purple');
    const footer = `${canEdit ? `<button class="btn primary" data-act="dkcl-edit-open" data-id="${st.id}">${U.icon('edit')}Chỉnh sửa thông tin</button>` : ''}<button class="btn" data-act="close">Đóng</button>`;
    return `${dkHead(st)}<div class="drawer-b contract-detail-body"><div class="contract-detail-grid">${info}${usage}${contracts}${history}${note}</div></div><div class="drawer-f contract-detail-footer">${footer}</div>`;
  }
  // ---- EDIT MODE: "Chỉnh sửa điểm kinh doanh" — chỉ sửa thông tin DO ĐIỂM KINH DOANH SỞ HỮU:
  // vị trí (Khối → Tầng → Dãy, lưu rowId), diện tích, loại diện tích, trạng thái vận hành
  // (Hoạt động/Tạm ngừng/Đang tranh chấp — cùng quyền với "Đổi trạng thái" sẵn có), ghi chú. Ngành
  // hàng thuộc Dãy nên chỉ hiển thị theo dãy đã chọn. Mã điểm/Chợ chỉ đọc. Tình trạng sử dụng (hợp đồng), Nợ phí (khoản phải thu), NV thu phí
  // (phân công theo dãy) chỉ hiển thị. KHÔNG có giá/mức thu, chỉ số điện nước, phương tiện ở đây.
  // Draft là state UI tạm (không lưu) để các select phụ thuộc giữ giá trị giữa các lần vẽ lại.
  let dkEditDraft = null;
  const DK_OP = D.POINT_STATUS;
  const dkLayout = () => A.features.marketLayout.store;
  const dkBlocks = mid => dkLayout().blocksOf(mid) || [];
  const dkZoneMatch = (mid, z) => { const r = z ? A.mbResolveZoneContext(mid, z) : null; return r && r.matched ? r : null; };
  function dkZoneOfPoint(st) {
    for (const b of dkBlocks(st.market)) for (const f of b.floors) for (const z of f.zones) if (z.key === st.rowId) return { b, f, z };
    return null;
  }
  const dkOpOf = st => DK_OP[st.status] ? st.status : 'active';
  const dkParseArea = v => { const n = Number(String(v == null ? '' : v).trim().replace(/\s|m²/g, '').replace(',', '.')); return Number.isFinite(n) ? n : NaN; };
  const dkFmtArea = n => Number(n || 0).toLocaleString('vi-VN', { maximumFractionDigits: 2 });
  function dkEditStart(st) {
    const loc = dkZoneOfPoint(st);
    dkEditDraft = { id: st.id, blockKey: loc ? loc.b.key : '', floorKey: loc ? loc.f.key : '', zoneKey: loc ? loc.z.key : '', origZoneKey: loc ? loc.z.key : '', area: dkFmtArea(st.area), areaType: st.areaTypeId || '', op: dkOpOf(st), note: st.note || '' };
  }
  // NV thu phí phân công theo Dãy: đổi dãy → NV của dãy mới.
  function dkCollectorPreview(st, d) {
    const mid = st.market, z = d.zoneKey ? dkLayout().findZone(mid, d.zoneKey) : null;
    const label = id => { const acc = id ? A.ACCOUNTS.get(id) : null; return acc ? acc.fullName : 'Chưa phân công'; };
    if (!z) return { name: 'Chưa xác định', note: 'Chọn dãy để xác định nhân viên phụ trách.' };
    if (d.zoneKey === d.origZoneKey) return { name: label(st.collectorId), note: `Theo phân công dãy ${U.esc(z.code || z.name || '')}`, id: st.collectorId || null };
    const zid = z.row.collectorId || null;
    return { name: label(zid), note: `Nhân viên phụ trách sẽ được xác định theo dãy mới ${U.esc(z.code || z.name || '')}.`, id: zid || null };
  }
  function dkEditDirtySignificant(st, d) {
    return d.zoneKey !== d.origZoneKey || dkParseArea(d.area) !== Number(st.area) || d.areaType !== (st.areaTypeId || '');
  }
  function dkEditWarnHtml(st, d) {
    const c = A.features.businessPoints.service.contractOn(st.id, U.today());
    return c && dkEditDirtySignificant(st, d) ? '<div class="note">Điểm đang có hợp đồng hiệu lực. Thay đổi thông tin mặt bằng có thể ảnh hưởng đến dữ liệu áp dụng cho các kỳ tiếp theo; hợp đồng và khoản thu đã phát hành không bị sửa.</div>' : '';
  }
  function dkEditHtmlCL(st) {
    if (!dkEditDraft || dkEditDraft.id !== st.id) dkEditStart(st);
    const d = dkEditDraft, mid = st.market, m = U.market(mid), BP = A.features.businessPoints.service;
    const blocks = dkBlocks(mid), block = blocks.find(b => b.key === d.blockKey) || null;
    const floors = block ? block.floors : [], floor = floors.find(f => f.key === d.floorKey) || null;
    const zones = floor ? floor.zones : [], zone = zones.find(z => z.key === d.zoneKey) || null;
    const opt = (list, cur, ph, lbl) => `${cur ? '' : `<option value="">${ph}</option>`}${list.map(x => `<option value="${x.key}" ${x.key === cur ? 'selected' : ''}>${U.esc(lbl(x))}</option>`).join('')}`;
    const c = BP.contractOn(st.id, U.today()), t = c ? A.idx.trader.get(c.traderId) : null;
    const usage = c
      ? `<b>● ${A.mbStatusLabel('thue')}</b><div class="small muted">Theo ${U.esc(c.id)}${t ? ' · ' + U.esc(t.name) + ' · ' + t.id : ''}</div>`
      : `<b>○ ${A.mbStatusLabel('trong')}</b><div class="small muted">Không có hợp đồng hiệu lực hiện tại</div>`;
    const debt = c && BP.debtStatus(st, c.id) === 'overdue' ? '<div class="small" style="margin-top:4px"><span class="tag danger">Nợ phí</span> <span class="muted">theo khoản phải thu quá hạn, không chỉnh tại đây</span></div>' : '';
    const col = dkCollectorPreview(st, d), canOp = A.canDo('so-do.doi-trang-thai', mid);
    const opField = canOp
      ? `<select class="input" id="dke-op" data-ch="dke-field" data-k="op">${Object.keys(DK_OP).map(k => `<option value="${k}" ${d.op === k ? 'selected' : ''}>${DK_OP[k]}</option>`).join('')}</select>`
      : `<div class="dke-readonly">${DK_OP[d.op]}</div>`;
    const ro = (label, value) => `<div class="field"><label>${label}</label><div class="dke-readonly">${value}</div></div>`;
    const secA = `<div class="form-grid">${ro('Mã điểm', `<b>${U.esc(st.code)}</b>`)}${ro('Chợ', U.esc(m.name))}
      <div class="field"><label>Khối/Nhà chợ *</label><select class="input" id="dke-block" data-ch="dke-block">${opt(blocks, d.blockKey, '— Chọn khối —', b => b.name)}</select></div>
      <div class="field"><label>Tầng *</label><select class="input" id="dke-floor" data-ch="dke-floor" ${block ? '' : 'disabled'}>${opt(floors, d.floorKey, '— Chọn tầng —', f => f.name)}</select></div>
      <div class="field dke-wide"><label>Dãy *</label><select class="input" id="dke-zone" data-ch="dke-zone" ${floor ? '' : 'disabled'}>${opt(zones, d.zoneKey, '— Chọn dãy —', z => (z.name || z.code) + (z.code ? ' - ' + z.code : ''))}</select></div></div>`;
    const secB = `<div class="form-grid">
      <div class="field"><label>Diện tích (m²) *</label><input class="input" id="dke-area" inputmode="decimal" data-ch="dke-field" data-k="area" value="${U.esc(d.area)}"></div>
      <div class="field"><label>Loại diện tích *</label><select class="input" id="dke-area-type" data-ch="dke-field" data-k="areaType">${d.areaType ? '' : '<option value="">— Chọn loại diện tích —</option>'}${U.AREA_TYPE_CODES.map(k => `<option value="${k}" ${d.areaType === k ? 'selected' : ''}>${U.areaTypeLabel(k)}</option>`).join('')}</select></div>
      ${ro('Ngành hàng (theo dãy)', zone ? U.esc(zone.catMain || '—') : '—')}</div>`;
    const secC = `<div class="form-grid">${ro('Tình trạng sử dụng', usage + debt)}${ro('Nhân viên thu phí phụ trách', `<b>${U.esc(col.name)}</b><div class="small muted">${col.note}</div>`)}
      <div class="field"><label>Tình trạng vận hành${canOp ? ' *' : ''}</label>${opField}</div></div>`;
    const secD = `<textarea class="input" id="dke-note" rows="3" data-ch="dke-field" data-k="note" placeholder="Nhập ghi chú về điểm kinh doanh...">${U.esc(d.note)}</textarea>`;
    return `<div class="drawer-h tt-dossier-head"><div><h3>${U.icon('edit')}Chỉnh sửa điểm kinh doanh</h3><div class="small muted">${U.esc(st.code)} · ${U.esc(m.name)}</div></div><span class="spacer"></span><button class="x" data-act="close" aria-label="Đóng">×</button></div>
      <div class="drawer-b contract-detail-body dke-form"><div id="dke-warn-slot">${dkEditWarnHtml(st, d)}</div><div class="contract-detail-grid">${dkSection('store', 'A', 'THÔNG TIN ĐIỂM', secA, 'contract-blue')}${dkSection('file', 'B', 'ĐẶC ĐIỂM MẶT BẰNG', secB, 'contract-mint')}${dkSection('users', 'C', 'TÌNH TRẠNG & PHỤ TRÁCH', secC, 'contract-amber')}${dkSection('file', 'D', 'GHI CHÚ', secD, 'contract-purple')}</div></div>
      <div class="drawer-f contract-detail-footer"><button class="btn" data-act="dkcl-edit-cancel" data-id="${st.id}">Hủy</button><button class="btn primary" data-act="dkcl-edit-save" data-id="${st.id}">Lưu thay đổi</button></div>`;
  }
  // Khu đổi → reset Tầng + Dãy; Tầng đổi → reset Dãy (không giữ cấu trúc không hợp lệ).
  const dkEditPoint = () => dkEditDraft && A.idx.stall.get(dkEditDraft.id);
  A.CH['dke-block'] = el => { const st = dkEditPoint(); if (!st) return; if (el.value !== dkEditDraft.blockKey) { dkEditDraft.blockKey = el.value; dkEditDraft.floorKey = ''; dkEditDraft.zoneKey = ''; } dkRerenderDrawer(st, true); };
  A.CH['dke-floor'] = el => { const st = dkEditPoint(); if (!st) return; if (el.value !== dkEditDraft.floorKey) { dkEditDraft.floorKey = el.value; dkEditDraft.zoneKey = ''; } dkRerenderDrawer(st, true); };
  A.CH['dke-zone'] = el => { const st = dkEditPoint(); if (!st) return; dkEditDraft.zoneKey = el.value; dkRerenderDrawer(st, true); };
  // Ô nhập/lựa chọn khác chỉ cập nhật draft + cảnh báo tại chỗ (không vẽ lại cả pop-up, tránh mất
  // cú bấm "Lưu thay đổi" ngay sau khi rời ô nhập).
  A.CH['dke-field'] = el => {
    const st = dkEditPoint(), k = el.dataset.k;
    if (!st || !['area', 'areaType', 'op', 'note'].includes(k)) return;
    dkEditDraft[k] = el.value;
    const slot = A.$('#dke-warn-slot'); if (slot) slot.innerHTML = dkEditWarnHtml(st, dkEditDraft);
  };
  // Vẽ lại pop-up chi tiết điểm KD (CL) trong CÙNG khung pop-up với Hồ sơ tiểu thương (drawer-tt-cl);
  // back-stack ("← Quay lại") giữ nguyên.
  function dkRerenderDrawer(st, refresh) {
    A.$('#modal-root').innerHTML = `<div class="drawer-overlay" data-act="close"></div><div class="drawer drawer-tt-cl dk-dossier${refresh ? ' is-refresh' : ''}" role="dialog" aria-modal="true">${A.drawerBackHtml()}${dkDetailHtmlCL(st)}</div>`;
  }
  // Pop-up không còn tab (một trang cuộn); action giữ lại để các liên kết cũ chỉ vẽ lại pop-up.
  A.ACT['dkdetail-tab'] = () => { const current = A.idx.stall.get(dkDetailPointId); if (current) dkRerenderDrawer(current); };
  let dkDetailPointId = null;
  // Mở pop-up chi tiết điểm KD — dùng chung cho action GỐC (`dk-open`) và drill-down từ Mặt bằng.
  A.openDkDrawer = function (st) {
    if (st.market !== 'CL') { A.modal(A.mHead('Điểm kinh doanh') + `<div class="modal-b detail">${A.stallPanel(st)}</div>`); return; }
    dkEditId = null; dkEditDraft = null;
    dkDetailPointId = st.id;
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
    dkEditStart(st);
    dkRerenderDrawer(st);
  };
  A.ACT['dkcl-edit-cancel'] = el => {
    const st = A.idx.stall.get(el.dataset.id);
    if (!st) return;
    dkEditId = null; dkEditDraft = null;
    dkRerenderDrawer(st);
  };
  A.ACT['dkcl-edit-save'] = el => {
    const st = A.idx.stall.get(el.dataset.id), d = dkEditDraft;
    if (!st || !d || d.id !== st.id || !A.canDo('cau-truc.edit', st.market) || !A.allowedMarkets(A.currentAccount()).includes(st.market)) return U.toast('Bạn không có quyền chỉnh sửa điểm kinh doanh này.');
    const mid = st.market, S = dkLayout();
    const block = dkBlocks(mid).find(b => b.key === d.blockKey), floor = block && block.floors.find(f => f.key === d.floorKey), zone = floor && floor.zones.find(z => z.key === d.zoneKey);
    if (!block || !floor || !zone || !dkZoneMatch(mid, zone)) return U.toast('Vui lòng chọn đủ Khối, Tầng và Dãy hợp lệ.');
    const area = dkParseArea(d.area);
    if (!(area > 0)) return U.toast('Diện tích phải là số lớn hơn 0.');
    if (U.AREA_TYPE_CODES.indexOf(d.areaType) === -1) return U.toast('Vui lòng chọn loại diện tích hợp lệ.');
    if (!DK_OP[d.op]) return U.toast('Trạng thái vận hành không hợp lệ.');
    const opChanged = d.op !== dkOpOf(st);
    if (opChanged && !A.canDo('so-do.doi-trang-thai', mid)) return U.toast('Bạn không có quyền đổi trạng thái vận hành.');
    // Diện tích: SUM(điểm trong Dãy) <= diện tích phân bổ của Dãy; chỉ tiêu chợ theo loại diện tích (nếu đã khai báo).
    const BP = A.features.businessPoints.service, rowUsed = U.sum(BP.pointsOfRow(zone.key).filter(x => x.id !== st.id), x => Number(x.area) || 0);
    if (rowUsed + area > zone.area + 1e-9) return U.toast(`Dãy ${zone.code} chỉ còn ${Math.max(0, zone.area - rowUsed).toLocaleString('vi-VN')} m² chưa phân bổ cho điểm (phân bổ ${zone.area.toLocaleString('vi-VN')} m²).`);
    const MS = A.features.markets && A.features.markets.service, mk = MS && MS.get(mid), cap = mk && mk.capacityByAreaType && mk.capacityByAreaType.find(x => x.areaTypeId === d.areaType);
    if (cap) {
      const same = A.db.stalls.filter(x => x.market === mid && x.id !== st.id && x.areaTypeId === d.areaType);
      if (same.length + 1 > cap.maxPointCount) return U.toast(`Vượt chỉ tiêu số điểm loại "${U.areaTypeLabel(d.areaType)}" của chợ (${cap.maxPointCount} điểm).`);
      if (U.sum(same, x => Number(x.area) || 0) + area > cap.maxArea + 1e-9) return U.toast(`Vượt chỉ tiêu diện tích loại "${U.areaTypeLabel(d.areaType)}" của chợ (${cap.maxArea.toLocaleString('vi-VN')} m²).`);
    }
    const moved = d.zoneKey !== d.origZoneKey, before = BP.location(st);
    const changes = [], today = U.dmy(U.today());
    if (moved) changes.push(`vị trí "${before.day}" → "${zone.name}"`);
    if (area !== Number(st.area)) changes.push(`diện tích ${st.area} m² → ${area} m²`);
    if (d.areaType !== (st.areaTypeId || '')) changes.push(`loại diện tích "${U.areaTypeLabel(st.areaTypeId) || '—'}" → "${U.areaTypeLabel(d.areaType)}"`);
    const note = String(d.note || '').trim();
    if (note !== (st.note || '')) changes.push('ghi chú');
    // Chỉ ghi các field do điểm kinh doanh sở hữu; không đụng hợp đồng/khoản thu/chỉ số/phương tiện.
    st.rowId = zone.key; st.area = area; st.areaTypeId = d.areaType;
    if (note !== (st.note || '')) st.note = note;
    if (moved) changes.push('NV thu phí theo dãy mới');
    st.history = st.history || [];
    if (changes.length) st.history.unshift(`${today}: Cập nhật thông tin điểm (${changes.join(', ')})`);
    if (opChanged) {
      st.history.unshift(`${today}: ${A.pointOpLabel(st.status)} → ${A.pointOpLabel(d.op)}`);
      st.status = d.op;
    }
    A.save();
    dkEditId = null; dkEditDraft = null;
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
      && (!f.dkSection || s.rowId === f.dkSection)
      && (!f.dkStatus || A.pointDisplayStatus(s) === f.dkStatus)
      && (!q || s.code.toLowerCase().includes(q) || (s.traderId && A.idx.trader.get(s.traderId).name.toLowerCase().includes(q))));
  }
  function dkLine(s) {
    const t = s.traderId ? A.idx.trader.get(s.traderId) : null, c = s.contractId ? A.idx.contract.get(s.contractId) : null;
    return [s.code, U.mShort(s.market), A.features.businessPoints.service.location(s).label, s.cat, U.areaTypeLabel(s.areaTypeId) || '', s.area, U.unitLabel(s), c && c.monthly ? c.monthly : '', t ? t.name : '', A.mbStatusLabel(A.pointDisplayStatus(s))];
  }
  function dkViewGeneric() {
    const rows = dkRows(), pg = U.pager('dk', rows.length, 25);
    const sections = [];
    (A.db.rows || []).filter(r => ui.market === 'ALL' || r.market === ui.market).forEach(r => sections.push([r.id, (ui.market === 'ALL' ? U.mShort(r.market) + ' · ' : '') + r.name]));
    return `<div class="card"><div class="card-h"><h3>Danh mục điểm kinh doanh</h3>
      <select class="input" data-ch="dk-section"><option value="">Tất cả dãy</option>${sections.map(s => `<option value="${s[0]}" ${f.dkSection === s[0] ? 'selected' : ''}>${U.esc(s[1])}</option>`).join('')}</select>
      <select class="input" data-ch="dk-status"><option value="">Mọi trạng thái</option>${Object.keys(D.STATUS).map(k => `<option value="${k}" ${f.dkStatus === k ? 'selected' : ''}>${A.mbStatusLabel(k)}</option>`).join('')}</select>
      <input class="input" placeholder="Mã điểm / tiểu thương" data-in="dk-search" value="${U.esc(f.dkSearch || '')}">
      <button class="btn" data-act="dk-csv">⬇ Xuất Excel</button></div>
      <div class="card-b">${U.table([{ t: 'Mã điểm' }, { t: 'Chợ' }, { t: 'Vị trí' }, { t: 'Loại diện tích' }, { t: 'DT (m²)', num: true }, { t: 'Đơn giá' }, { t: 'Giá/tháng', num: true }, { t: 'Tiểu thương' }, { t: 'Trạng thái' }],
        rows.slice(pg.start, pg.end).map(s => {
          const l = dkLine(s);
          return `<tr class="click" data-act="dk-open" data-id="${s.id}"><td><b>${l[0]}</b></td><td>${l[1]}</td><td>${U.esc(l[2])}</td><td>${l[4]}</td><td class="num">${l[5].toLocaleString('vi-VN')}</td><td class="nowrap">${l[6]}</td><td class="num">${l[7] ? U.money(l[7]) : '–'}</td><td>${U.esc(l[8]) || '<span class="muted">–</span>'}</td><td>${A.mbStatusTag(A.pointDisplayStatus(s))}</td></tr>`;
        }))}${pg.html}
        <div class="small muted" style="margin-top:8px">Lịch sử tách, gộp, chuyển đổi điểm kinh doanh (nếu có) được lưu vết đầy đủ trong hồ sơ từng điểm.</div></div></div>`;
  }
  A.CH['dk-section'] = el => { f.dkSection = el.value; ui.page.dk = 0; A.render(); };
  A.CH['dk-status'] = el => { f.dkStatus = el.value; ui.page.dk = 0; A.render(); };
  A.IN['dk-search'] = el => { f.dkSearch = el.value; ui.page.dk = 0; A.render(); };
  A.ACT['dk-csv'] = () => U.csv('diem-kinh-doanh', ['Mã điểm', 'Chợ', 'Vị trí', 'Ngành hàng', 'Loại diện tích', 'Diện tích m2', 'Đơn giá', 'Giá dịch vụ/tháng', 'Tiểu thương', 'Trạng thái'], dkRows().map(dkLine));

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

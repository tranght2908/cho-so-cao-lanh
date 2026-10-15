/* Màn hình "Danh mục chợ" (Điều hành > Danh mục chợ) — Quản trị hệ thống quản lý thông tin CƠ BẢN CẤP
 * CHỢ (tên, mã, địa điểm, hạng, ảnh đại diện) và QUY MÔ chợ. Số điện thoại liên hệ thuộc TÀI KHOẢN người
 * phụ trách (Accounts), không phải thuộc tính của chợ: form không nhập/hiển thị market.phone (field cũ
 * giữ nguyên). Đây là BƯỚC 1 của quy trình:
 *   1. Tạo chợ  2. Thiết lập mặt bằng  3. Khai báo điểm kinh doanh  4. Cấu hình biểu phí  5. Hoạt động.
 * Form tạo/sửa KHÔNG cấu hình bảng giá, loại diện tích kinh doanh hay đơn vị quản lý (đơn vị chung, chỉ
 * hiển thị), và KHÔNG cho chọn trạng thái — trạng thái do vòng đời mặt bằng quyết định (store.js
 * completeLayoutSetup/normalizeLifecycle). Field cũ priceConfigId/allowedAreaTypeIds của bản ghi đã lưu
 * được giữ nguyên, không ghi đè. KHÔNG phải màn cấu trúc bên trong 1 chợ (Khu/Tầng/Dãy/Điểm kinh doanh
 * — đó là A.VIEWS['mat-bang'], do Tổ trưởng bố trí theo thực tế).
 * Dữ liệu: features/markets/store.js (A.MARKET_CATALOG) qua service. "Tình trạng mặt bằng" và "Đã số
 * hoá" luôn SUY RA (layout + điểm kinh doanh thật), không lưu cờ/bộ đếm riêng — xem service.js.
 * Quyền: RBAC hiện có — screen:danh-muc-cho, action:danh-muc-cho.tao/.sua.
 */
(function (A) {
  'use strict';
  const U = A.U, ui = A.ui, MC = A.features.markets.service;

  const LAYOUT_STATE = { set: 'Đã thiết lập', unset: 'Chưa thiết lập' };
  const fmtNum = n => Number(n || 0).toLocaleString('vi-VN', { maximumFractionDigits: 2 });
  const fmtM2 = n => fmtNum(n) + ' m²';

  function filterState() {
    const f = ui.dmcFilter || (ui.dmcFilter = { search: '', rank: '', status: '', layout: '' });
    if (f.layout === undefined) f.layout = '';
    return f;
  }
  function layoutKey(r) { return MC.layoutReady(r.id) ? 'set' : 'unset'; }
  function filteredRows() {
    const f = filterState(), q = String(f.search || '').trim().toLowerCase();
    return MC.rows().filter(r => (!q || [r.name, r.address, r.code].join(' ').toLowerCase().includes(q)) &&
      (!f.rank || r.rank === f.rank) && (!f.status || r.status === f.status) && (!f.layout || layoutKey(r) === f.layout));
  }
  function rankTag(rank) {
    const cls = rank === 'HANG_1' ? 'info' : rank === 'HANG_2' ? 'purple' : 'warn';
    return `<span class="tag ${cls}">${U.esc(MC.RANKS[rank] || rank || '—')}</span>`;
  }
  function statusTag(status) {
    const x = MC.STATUS[status] || ['Chưa xác định', ''];
    return `<span class="tag ${x[1]}">${x[0]}</span>`;
  }
  // Trạng thái chợ + dòng phụ theo vòng đời dùng chung (lifecycle.service.marketLifecycle): mặt bằng đã thiết
  // lập nhưng chưa đủ điều kiện → "Chờ cấu hình biểu phí". Không tự suy luận tại màn này.
  function statusCell(r) {
    const lc = MC.lifecycle(r.id);
    const sub = !lc || !lc.hint ? '' : `<div class="small muted">Bước hiện tại: ${U.esc(lc.hint)}</div>`;
    const warning = lc && lc.feeConfigWarning ? '<div class="small dmc-warn">Cần cập nhật mức thu/biểu phí</div>' : '';
    return statusTag(r.status) + sub + warning;
  }
  function layoutTag(r) {
    return layoutKey(r) === 'set' ? `<span class="tag ok">${LAYOUT_STATE.set}</span>` : `<span class="tag">${LAYOUT_STATE.unset}</span>`;
  }
  function scaleCell(r) {
    if (r.businessArea === null) return '<span class="small muted">Chưa cập nhật</span>';
    return `<b>${fmtM2(r.businessArea)}</b>${r.totalArea !== null ? `<div class="small muted">Tổng ${fmtM2(r.totalArea)}</div>` : ''}`;
  }
  // Ảnh đại diện chợ; chợ chưa có ảnh (kể cả dữ liệu cũ) dùng placeholder mặc định.
  function marketImageHtml(image, cls) {
    return image && image.dataUrl
      ? `<img class="dmc-image ${cls || ''}" src="${U.esc(image.dataUrl)}" alt="Ảnh đại diện chợ">`
      : `<div class="dmc-image dmc-image-empty ${cls || ''}">${U.icon('store')}<span>Chưa có ảnh đại diện</span></div>`;
  }
  const STATUS_NOTE = 'Chợ chỉ chuyển sang hoạt động sau khi hoàn tất thiết lập mặt bằng và cấu hình mức thu riêng của chợ (mặt bằng, điện, nước, dịch vụ).';
  function canCreate() { return A.canDo('danh-muc-cho.tao'); }
  function canEdit() { return A.canDo('danh-muc-cho.sua'); }
  function canAssignManager() { return A.canDo('danh-muc-cho.phan-cong-nguoi-phu-trach'); }

  function managementContextHtml() {
    const markets = MC.rows();
    const unit = MC.managementUnit(markets[0] || {});
    return `<section class="card dmc-management-context" aria-label="Thông tin đơn vị quản lý">
      <header class="dmc-management-head"><h3>${U.esc(unit)}</h3>${canCreate() ? '<button class="btn primary" data-act="dmc-new">+ Thêm chợ mới</button>' : ''}</header>
      <div class="dmc-management-body">
        <div class="dmc-management-item"><span>Đơn vị quản lý</span><b>Trung tâm Cung ứng dịch vụ công phường Cao Lãnh</b></div>
        <div class="dmc-management-item"><span>Bộ phận quản lý</span><b>Tổ Quản lý chợ</b></div>
        <div class="dmc-management-item"><span>Phạm vi quản lý</span><b>${fmtNum(markets.length)} chợ</b></div>
      </div>
      <div class="small muted" style="padding:0 16px 14px">Người phụ trách được phân công riêng theo từng chợ; phân công không tự cấp vai trò, quyền hoặc phạm vi chợ.</div>
    </section>`;
  }

  // ---------- KPI ----------
  function kpisHtml() {
    const all = MC.rows();
    const set = all.filter(r => layoutKey(r) === 'set').length;
    const declared = all.filter(r => r.businessArea !== null);
    const area = U.sum(declared, r => r.businessArea || 0);
    const missing = all.length - declared.length;
    const card = (label, value, sub) => `<div class="card kpi"><div class="k-label">${label}</div><div class="k-value">${value}</div><div class="k-sub">${sub}</div></div>`;
    return `<div class="kpis dmc-kpis">
      ${card('Tổng số chợ', fmtNum(all.length), fmtNum(all.filter(r => r.status === 'ACTIVE').length) + ' chợ đang hoạt động')}
      ${card('Đã thiết lập mặt bằng', fmtNum(set), 'Đã có cấu trúc Khu/Tầng/Dãy')}
      ${card('Chưa thiết lập mặt bằng', fmtNum(all.length - set), 'Chờ Tổ trưởng thiết lập')}
      ${declared.length ? card('Tổng quy mô kinh doanh', fmtM2(area), fmtNum(declared.length) + ' chợ đã khai báo' + (missing ? ' · ' + fmtNum(missing) + ' chợ chưa khai báo' : '')) : card('Tổng quy mô kinh doanh', 'Chưa cập nhật', 'Chưa có chợ nào khai báo quy mô')}
    </div>`;
  }

  // ---------- Chi tiết chợ ----------
  function lifecycleNote(r) {
    const lc = MC.lifecycle(r.id);
    if (!lc || !lc.feeGap || (lc.stage !== 'PENDING_FEE' && !lc.feeConfigWarning)) return '';
    return `<div class="small ${lc.feeConfigWarning ? 'dmc-warn' : 'muted'}">${U.esc(lc.feeGap)}</div>`;
  }
  function detailHtml(r) {
    const edit = canEdit();
    const nonBiz = r.totalArea !== null && r.businessArea !== null ? fmtM2(r.totalArea - r.businessArea) : 'Chưa cập nhật';
    const ready = layoutKey(r) === 'set';
    const ms = MC.assignmentStatus(r.id), ma = ms.assignment, person = ms.account;
    const role = person && A.PERM.role(A.ACCOUNTS.primaryRole(person));
    const phone = person && person.phone ? (canAssignManager() && ui.dmcShowAssignmentPhone ? person.phone : U.maskPhone(person.phone)) : '—';
    const assignmentLabel = ms.state === 'ACTIVE' ? (ms.hasScope ? 'Đang phụ trách' : 'Đang phụ trách · chưa có phạm vi chợ') : ms.state === 'PLANNED' ? 'Phân công chưa đến ngày hiệu lực' : ms.state === 'ACCOUNT_INACTIVE' ? 'Tài khoản không hoạt động / cần phân công lại' : 'Chưa phân công';
    const history = MC.assignments(r.id);
    return A.mHead(`${U.esc(r.name)} <span class="small muted">(${U.esc(r.code)})</span>`) + `<div class="modal-b dmc-detail">
      <section class="dmc-section"><h4>A. THÔNG TIN CHỢ</h4>
        ${marketImageHtml(r.image, 'dmc-image-detail')}
        <dl class="kv">
          <dt>Tên chợ</dt><dd>${U.esc(r.name)}</dd>
          <dt>Mã chợ</dt><dd>${U.esc(r.code)}</dd>
          <dt>Địa điểm</dt><dd>${U.esc(r.address || '—')}</dd>
          <dt>Hạng chợ</dt><dd>${rankTag(r.rank)}</dd>
          <dt>Đơn vị quản lý</dt><dd>${U.esc(MC.managementUnit(r))}</dd>
          <dt>Trạng thái chợ</dt><dd>${statusCell(r)}${lifecycleNote(r)}</dd>
        </dl>
      </section>
      <section class="dmc-section"><h4>B. QUY MÔ CHỢ</h4>
        <dl class="kv">
          <dt>Tổng diện tích chợ</dt><dd>${r.totalArea !== null ? fmtM2(r.totalArea) : 'Chưa cập nhật'}</dd>
          <dt>Diện tích phục vụ kinh doanh</dt><dd>${r.businessArea !== null ? fmtM2(r.businessArea) : 'Chưa cập nhật'}</dd>
          <dt>Diện tích ngoài kinh doanh</dt><dd>${nonBiz}</dd>
        </dl>
      </section>
      <section class="dmc-section"><h4>C. TÌNH TRẠNG MẶT BẰNG</h4>
        <div>${ready ? `<span class="tag ok">Đã thiết lập</span> <span class="small muted">${fmtNum(MC.layoutZoneCount(r.id))} dãy đã khai báo</span>` : '<span class="tag">Chưa thiết lập</span>'}</div>
        <div class="small muted" style="margin-top:6px">Mặt bằng, điểm kinh doanh và loại diện tích do Tổ Quản lý chợ thiết lập tại màn "Mặt bằng & điểm kinh doanh"; mức thu riêng của chợ cấu hình sau khi mặt bằng được thiết lập. Chợ chỉ chuyển sang Đang hoạt động khi cấu hình mức thu của chợ đầy đủ.</div>
      </section>
      <section class="dmc-section"><h4>D. PHÂN CÔNG QUẢN LÝ</h4>
        <dl class="kv">
          <dt>Người phụ trách</dt><dd>${U.esc(person ? person.fullName : 'Chưa phân công')}</dd>
          <dt>Vai trò</dt><dd>${U.esc(role ? role.name : '—')}</dd>
          <dt>Ngày bắt đầu</dt><dd>${U.esc(ma ? ma.effectiveFrom : '—')}</dd>
          <dt>Tình trạng</dt><dd>${U.esc(assignmentLabel)}</dd>
          <dt>Số điện thoại</dt><dd>${U.esc(phone)}${person && person.phone && canAssignManager() ? ` <button class="dmc-phone-toggle" data-act="dmc-toggle-assignment-phone">${U.icon(ui.dmcShowAssignmentPhone ? 'eye-off' : 'eye')}</button>` : ''}</dd>
        </dl>
        ${ms.state === 'ACTIVE' && !ms.hasScope ? '<div class="note warn">Người phụ trách chưa có phạm vi chợ phù hợp. Phân công không đồng nghĩa cấp quyền; Quản trị viên cần cấp phạm vi bằng cơ chế RBAC hiện có.</div>' : ''}
        ${history.length ? `<details><summary>Lịch sử phân công (${history.length})</summary>${U.table([{t:'Hiệu lực'},{t:'Người phụ trách'},{t:'Lý do / ghi chú'},{t:'Thao tác'}], history.map(x => { const a=A.ACCOUNTS.get(x.accountId); return `<tr><td>${U.esc(x.effectiveFrom)}${x.effectiveTo?' – '+U.esc(x.effectiveTo):''}</td><td>${U.esc(a ? a.fullName : x.accountId)}</td><td>${U.esc(x.reason || '—')}${x.note?'<div class="small muted">'+U.esc(x.note)+'</div>':''}</td><td>${x.effectiveFrom > U.today() && canAssignManager() ? `<button class="btn sm" data-act="dmc-assignment-edit" data-market="${U.esc(r.id)}" data-id="${U.esc(x.id)}">Sửa</button><button class="btn sm" data-act="dmc-assignment-cancel" data-market="${U.esc(r.id)}" data-id="${U.esc(x.id)}">Hủy</button>` : '—'}</td></tr>`; }), {empty:''})}</details>` : '<div class="small muted">Chưa có lịch sử phân công.</div>'}
      </section>
    </div>
    <div class="modal-f"><button class="btn" data-act="close">Đóng</button>${canAssignManager() ? `<button class="btn" data-act="dmc-assignment-open" data-id="${U.esc(r.id)}">Thay đổi người phụ trách</button>` : ''}${edit ? `<button class="btn primary" data-act="dmc-edit" data-id="${U.esc(r.id)}">Chỉnh sửa</button>` : ''}</div>`;
  }

  // ---------- Form Thêm / Chỉnh sửa ----------
  // Chỉ thông tin cơ bản + quy mô (bước 1). Ảnh đang chọn giữ ở ui.dmcImageDraft cho tới khi lưu/đóng form.
  const valOf = v => v === null || v === undefined ? '' : String(v);
  function numInput(id, value, unit, attrs) {
    return `<div class="dmc-num"><input class="input" type="number" min="0" ${attrs || 'step="any"'} id="${id}" data-in="dmc-scale" value="${U.esc(valOf(value))}"><span class="dmc-suffix">${unit}</span></div>`;
  }
  const err = id => `<div class="dmc-err" id="dmc-err-${id}"></div>`;
  const IMAGE_TYPES = ['image/jpeg', 'image/png'];
  const IMAGE_EXT = /\.(jpe?g|png)$/i;
  const IMAGE_MAX_INPUT = 10 * 1024 * 1024; // tệp gốc tối đa 10 MB, ảnh lớn được thu nhỏ trước khi lưu
  const IMAGE_MAX_EDGE = 1280;
  const IMAGE_MAX_STORED = 1.5 * 1024 * 1024; // giới hạn Data URL lưu vào localStorage
  function imageBoxHtml(image) {
    return `${marketImageHtml(image, 'dmc-image-preview')}
      <div class="dmc-image-actions">
        <label class="btn sm dmc-image-pick">${U.icon('camera')}${image ? 'Đổi ảnh' : 'Chọn ảnh'}<input type="file" accept=".jpg,.jpeg,.png,image/jpeg,image/png" data-ch="dmc-image"></label>
        ${image ? '<button class="btn sm" data-act="dmc-image-remove">Xóa ảnh</button>' : ''}
        <span class="small muted">JPG, JPEG hoặc PNG.</span>
      </div>`;
  }
  function refreshImageBox() { setText('dmc-image-box', imageBoxHtml(ui.dmcImageDraft || null)); }
  function marketForm(r) {
    const x = r || { code: MC.nextCode(), name: '', address: '', rank: 'HANG_3', status: 'NOT_ACTIVE', totalArea: null, businessArea: null };
    return A.mHead(r ? 'Chỉnh sửa chợ' : 'Thêm chợ mới') + `<div class="modal-b dmc-form">
      <div class="dmc-err-summary" id="dmc-err-summary"></div>
      <section class="dmc-section"><h4>A. THÔNG TIN CHỢ</h4>
        <div class="form-grid">
          <div class="field"><label>Tên chợ *</label><input class="input" id="dmc-name" value="${U.esc(x.name)}">${err('name')}</div>
          <div class="field"><label>Mã chợ</label><input class="input" id="dmc-code" value="${U.esc(x.code)}" readonly disabled><div class="small muted">${r ? 'Mã chợ dùng làm khóa tham chiếu, không thay đổi.' : 'Hệ thống tự sinh khi lưu.'}</div></div>
          <div class="field"><label>Địa điểm *</label><input class="input" id="dmc-address" value="${U.esc(x.address)}">${err('address')}</div>
          <div class="field"><label>Hạng chợ</label><select class="input" id="dmc-rank">${Object.keys(MC.RANKS).map(k => `<option value="${k}" ${x.rank === k ? 'selected' : ''}>${MC.RANKS[k]}</option>`).join('')}</select></div>
        </div>
        <div class="field dmc-image-field"><label>Ảnh đại diện chợ</label><div class="dmc-image-box" id="dmc-image-box">${imageBoxHtml(ui.dmcImageDraft || null)}</div>${err('image')}</div>
      </section>
      <section class="dmc-section"><h4>B. QUY MÔ CHỢ</h4>
        <div class="form-grid">
          <div class="field"><label>Tổng diện tích chợ *</label>${numInput('dmc-total-area', x.totalArea, 'm²')}${err('totalArea')}</div>
          <div class="field"><label>Diện tích phục vụ kinh doanh *</label>${numInput('dmc-business-area', x.businessArea, 'm²')}${err('businessArea')}</div>
        </div>
        <div class="dmc-derived"><span>Diện tích ngoài kinh doanh <small class="muted">(tự tính)</small></span><b id="dmc-nonbiz">—</b></div>
        <div class="small muted">Phần diện tích còn lại dành cho lối đi, khu quản lý, kỹ thuật và khu vực dùng chung.</div>
      </section>
      ${!r ? assignmentFormHtml(null, false) : ''}
      <section class="dmc-section dmc-status-section"><div class="dmc-status-line"><span>Trạng thái</span>${r ? statusCell(r) : statusTag('NOT_ACTIVE')}</div>
        <div class="small muted">${STATUS_NOTE}</div>
      </section>
    </div>
    <div class="modal-f"><button class="btn" data-act="close">Hủy</button><button class="btn primary" data-act="dmc-save" data-id="${r ? U.esc(r.id) : ''}">Lưu chợ</button></div>`;
  }

  function assignmentOptions(selected) { return MC.eligibleResponsibleAccounts().map(a => { const role=A.PERM.role(A.ACCOUNTS.primaryRole(a)); return `<option value="${U.esc(a.id)}" ${a.id===selected?'selected':''}>${U.esc(a.fullName)} · ${U.esc(role ? role.name : a.code)}</option>`; }).join(''); }
  function assignmentFormHtml(value, changing) {
    const x=value||{}, id=x.accountId||'', start=x.effectiveFrom||U.today();
    return `<section class="dmc-section dmc-assignment"><h4>${changing ? 'THAY ĐỔI NGƯỜI PHỤ TRÁCH' : 'C. PHÂN CÔNG QUẢN LÝ'}</h4>
      <div class="form-grid"><div class="field"><label>Đơn vị quản lý</label><input class="input" value="Trung tâm Cung ứng dịch vụ công phường Cao Lãnh" disabled></div><div class="field"><label>Bộ phận quản lý</label><input class="input" value="Tổ Quản lý chợ" disabled></div></div>
      <div class="form-grid"><div class="field"><label>Người phụ trách chợ${changing?' *':''}</label><select class="input" id="dmc-assignee"><option value="">${changing?'Chọn người phụ trách':'Chưa phân công'}</option>${assignmentOptions(id)}</select><div id="dmc-assignee-warning" class="small dmc-warn"></div></div><div class="field"><label>Ngày bắt đầu phụ trách${changing?' *':''}</label><input class="input" id="dmc-assignment-from" type="date" value="${U.esc(start)}" ${x.id ? 'readonly' : ''}></div></div>
      ${changing ? '<div class="field"><label>Lý do thay đổi *</label><textarea class="input" id="dmc-assignment-reason" rows="2"></textarea></div>' : ''}<div class="field"><label>Ghi chú phân công</label><textarea class="input" id="dmc-assignment-note" rows="2">${U.esc(x.note||'')}</textarea></div>
      <div class="note info">Phân công xác định phạm vi chợ của Tổ trưởng kể từ ngày hiệu lực; không tự cấp thêm quyền nghiệp vụ hoặc thay đổi vai trò.</div>
    </section>`;
  }
  function refreshAssignmentWarning(marketId) { const accountId=inputValue('dmc-assignee'), host=A.$('#dmc-assignee-warning'); if (!host) return; host.textContent=accountId && MC.scopeWarning(marketId, accountId) ? 'Cảnh báo: tài khoản legacy chưa được chuyển đổi và hiện chưa có phạm vi chợ phù hợp.' : ''; }

  function inputValue(id) { const el = A.$('#' + id); return el ? String(el.value || '').trim() : ''; }
  // '' → null (bỏ trống); chuỗi không phải số → NaN.
  function numValue(id) { const s = inputValue(id).replace(',', '.'); return s === '' ? null : Number(s); }
  function scaleInput() {
    return { totalArea: numValue('dmc-total-area'), businessArea: numValue('dmc-business-area') };
  }
  function setText(id, html) { const el = A.$('#' + id); if (el) el.innerHTML = html; }
  function refreshDerived() {
    const s = scaleInput();
    const ok = v => v !== null && !isNaN(v);
    setText('dmc-nonbiz', ok(s.totalArea) && ok(s.businessArea) ? fmtM2(s.totalArea - s.businessArea) : '—');
  }
  const ERR_KEYS = ['name', 'address', 'totalArea', 'businessArea'];
  function showErrors(errors) {
    ERR_KEYS.forEach(k => setText('dmc-err-' + k, errors[k] ? U.esc(errors[k]) : ''));
    setText('dmc-err-summary', ERR_KEYS.some(k => errors[k]) ? '<div class="note">Chưa lưu được: vui lòng kiểm tra các mục được đánh dấu đỏ bên dưới.</div>' : '');
  }
  function openForm(r) { ui.dmcImageDraft = r && r.image ? r.image : null; A.modal(marketForm(r), true); refreshDerived(); }
  // Ảnh lớn được thu nhỏ (cạnh dài ≤ IMAGE_MAX_EDGE, JPEG) để vừa localStorage; không có canvas thì dùng ảnh gốc.
  function shrinkImage(dataUrl, type, done) {
    if (typeof Image === 'undefined' || typeof document === 'undefined') return done(dataUrl, type);
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, IMAGE_MAX_EDGE / Math.max(img.width || 1, img.height || 1));
      if (scale === 1 && dataUrl.length <= IMAGE_MAX_STORED) return done(dataUrl, type);
      try {
        const canvas = document.createElement('canvas');
        canvas.width = Math.round(img.width * scale); canvas.height = Math.round(img.height * scale);
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        done(canvas.toDataURL('image/jpeg', 0.85), 'image/jpeg');
      } catch (e) { console.error('[danh-muc-cho] Không thu nhỏ được ảnh:', e); done(dataUrl, type); }
    };
    img.onerror = () => done(null);
    img.src = dataUrl;
  }

  A.VIEWS['danh-muc-cho'] = function () {
    const rows = filteredRows(), f = filterState();
    return `<div class="dmc-page">${managementContextHtml()}
    ${kpisHtml()}
    <div class="card dmc-filters-card"><div class="card-b"><div class="filters dmc-filters">
      <input class="input dmc-search" data-in="dmc-search" value="${U.esc(f.search)}" placeholder="Tìm kiếm theo tên chợ, địa điểm...">
      <select class="input" data-ch="dmc-rank"><option value="">Hạng chợ: Tất cả</option>${Object.keys(MC.RANKS).map(k => `<option value="${k}" ${f.rank === k ? 'selected' : ''}>${MC.RANKS[k]}</option>`).join('')}</select>
      <select class="input" data-ch="dmc-status"><option value="">Trạng thái chợ: Tất cả</option>${Object.keys(MC.STATUS).map(k => `<option value="${k}" ${f.status === k ? 'selected' : ''}>${MC.STATUS[k][0]}</option>`).join('')}</select>
      <select class="input" data-ch="dmc-layout"><option value="">Tình trạng mặt bằng: Tất cả</option>${Object.keys(LAYOUT_STATE).map(k => `<option value="${k}" ${f.layout === k ? 'selected' : ''}>${LAYOUT_STATE[k]}</option>`).join('')}</select>
      <button class="btn" data-act="dmc-reset">Làm mới</button>
      <button class="btn" data-act="dmc-csv">⬇ Xuất Excel</button>
    </div></div></div>
    <div class="card catalog-table-card dmc-table-card"><div class="card-b">${U.table(
      [{ t: 'STT' }, { t: 'Tên chợ' }, { t: 'Địa điểm' }, { t: 'Hạng chợ' }, { t: 'Quy mô kinh doanh' }, { t: 'Tình trạng mặt bằng' }, { t: 'Trạng thái chợ' }, { t: 'Thao tác' }],
      rows.map((r, i) => `<tr>
        <td class="dmc-col-index">${i + 1}</td>
        <td class="dmc-col-name"><div class="dmc-market-name"><b>${U.esc(r.name)}</b><span>${U.esc(r.code)}</span></div></td>
        <td class="dmc-col-address"><div class="dmc-address" title="${U.esc(r.address || '—')}">${U.esc(r.address || '—')}</div></td>
        <td class="dmc-col-rank">${rankTag(r.rank)}</td>
        <td class="dmc-col-scale"><div class="dmc-scale">${scaleCell(r)}</div></td>
        <td class="dmc-col-layout">${layoutTag(r)}</td>
        <td class="dmc-col-status">${statusTag(r.status)}</td>
        <td class="nowrap dmc-col-actions">
          <button class="btn sm" data-act="dmc-open" data-id="${U.esc(r.id)}">Xem chi tiết</button>
          ${canEdit() ? `<button class="btn sm" data-act="dmc-edit" data-id="${U.esc(r.id)}">Chỉnh sửa</button>` : ''}
        </td></tr>`), { empty: 'Không tìm thấy chợ phù hợp.' }
    )}</div></div></div>`;
  };

  A.IN['dmc-search'] = el => { filterState().search = el.value; A.render(); };
  A.IN['dmc-scale'] = () => refreshDerived();
  A.CH['dmc-image'] = el => {
    const file = el.files && el.files[0];
    el.value = '';
    setText('dmc-err-image', '');
    if (!file) return;
    if (IMAGE_TYPES.indexOf(file.type) === -1 || !IMAGE_EXT.test(file.name || '')) return setText('dmc-err-image', 'Chỉ chấp nhận ảnh JPG, JPEG hoặc PNG.');
    if (file.size > IMAGE_MAX_INPUT) return setText('dmc-err-image', 'Ảnh vượt quá 10 MB. Vui lòng chọn ảnh nhỏ hơn.');
    const reader = new FileReader();
    reader.onerror = () => setText('dmc-err-image', 'Không đọc được tệp ảnh. Vui lòng chọn ảnh khác.');
    reader.onload = () => shrinkImage(String(reader.result || ''), file.type, (dataUrl, type) => {
      if (!dataUrl) return setText('dmc-err-image', 'Tệp không phải ảnh hợp lệ. Vui lòng chọn ảnh khác.');
      if (dataUrl.length > IMAGE_MAX_STORED) return setText('dmc-err-image', 'Ảnh quá lớn để lưu trong bản thử nghiệm. Vui lòng chọn ảnh nhỏ hơn.');
      ui.dmcImageDraft = { name: file.name, type: type, dataUrl: dataUrl };
      refreshImageBox();
    });
    reader.readAsDataURL(file);
  };
  A.ACT['dmc-image-remove'] = () => { ui.dmcImageDraft = null; setText('dmc-err-image', ''); refreshImageBox(); };
  A.CH['dmc-rank'] = el => { filterState().rank = el.value; A.render(); };
  A.CH['dmc-status'] = el => { filterState().status = el.value; A.render(); };
  A.CH['dmc-layout'] = el => { filterState().layout = el.value; A.render(); };
  A.CH['dmc-assignee'] = () => { const edit=A.$('#dmc-assignment-market'); refreshAssignmentWarning(edit ? edit.value : MC.nextCode()); };
  A.ACT['dmc-reset'] = () => { ui.dmcFilter = { search: '', rank: '', status: '', layout: '' }; A.render(); };
  A.ACT['dmc-toggle-assignment-phone'] = () => { ui.dmcShowAssignmentPhone = !ui.dmcShowAssignmentPhone; const open=ui.dmcOpenMarketId&&MC.get(ui.dmcOpenMarketId); if(open) A.modal(detailHtml(open), true); };
  A.ACT['dmc-csv'] = () => {
    U.csv('danh-muc-cho', ['Tên chợ', 'Mã chợ', 'Địa điểm', 'Hạng chợ', 'Đơn vị quản lý', 'Trạng thái chợ', 'Tổng diện tích (m²)', 'Diện tích kinh doanh (m²)', 'Diện tích ngoài kinh doanh (m²)', 'Tình trạng mặt bằng'],
      filteredRows().map(r => {
        return [r.name, r.code, r.address || '', MC.RANKS[r.rank] || '', MC.managementUnit(r), MC.STATUS[r.status] ? MC.STATUS[r.status][0] : '',
          r.totalArea !== null ? r.totalArea : '', r.businessArea !== null ? r.businessArea : '', r.nonBusinessArea !== null ? r.nonBusinessArea : '', LAYOUT_STATE[layoutKey(r)]];
      }));
  };
  A.ACT['dmc-open'] = el => { const r = MC.get(el.dataset.id); if (r) { ui.dmcOpenMarketId=r.id; A.modal(detailHtml(r), true); } };
  A.ACT['dmc-new'] = () => { if (canCreate()) openForm(null); };
  A.ACT['dmc-edit'] = el => { const r = MC.get(el.dataset.id); if (r && canEdit()) openForm(r); };
  A.ACT['dmc-save'] = el => {
    const existing = el.dataset.id ? MC.get(el.dataset.id) : null;
    if (existing ? !canEdit() : !canCreate()) return;
    const acc = A.currentAccount();
    const user = acc ? acc.fullName : 'Không rõ';
    const name = inputValue('dmc-name');
    const address = inputValue('dmc-address');
    const errors = {};
    if (!name) errors.name = 'Vui lòng nhập tên chợ.';
    else if (MC.nameTaken(name, existing && existing.id)) errors.name = 'Tên chợ đã tồn tại. Vui lòng kiểm tra hoặc nhập tên khác.';
    if (!address) errors.address = 'Vui lòng nhập địa điểm.';
    // Quy mô bắt buộc cho cả tạo mới và chỉnh sửa (không được xoá trắng quy mô đã có).
    const scale = MC.validateScale(scaleInput(), { required: true, marketId: existing && existing.id });
    Object.assign(errors, scale.errors);
    if (errors.name || errors.address || !scale.ok) { showErrors(errors); return; }
    // Chỉ thông tin cơ bản + quy mô. Không gửi trạng thái, bảng giá, loại diện tích, đơn vị quản lý, số điện
    // thoại: field cũ của bản ghi đã lưu giữ nguyên, chợ mới không được tự gán.
    const patch = Object.assign({ name, address, rank: inputValue('dmc-rank') || 'HANG_3', image: ui.dmcImageDraft || null }, scale.value);
    if (!existing) {
      const accountId=inputValue('dmc-assignee');
      const prepared=MC.prepareInitialAssignment(MC.nextCode(), accountId ? { accountId, effectiveFrom:inputValue('dmc-assignment-from'), note:inputValue('dmc-assignment-note') } : null, acc);
      if (!prepared.ok) { setText('dmc-err-summary', '<div class="note">Không thể lưu phân công: dữ liệu người phụ trách hoặc ngày hiệu lực không hợp lệ.</div>'); return; }
      patch.managementAssignments=prepared.assignments;
    }
    const saved = existing ? MC.update(existing.id, patch, user) : MC.add(Object.assign({ code: MC.nextCode() }, patch), user);
    if (!saved) { setText('dmc-err-summary', '<div class="note">Không lưu được dữ liệu trên trình duyệt (bộ nhớ có thể đã đầy). Vui lòng thử ảnh nhỏ hơn hoặc xóa ảnh rồi lưu lại.</div>'); return; }
    ui.dmcImageDraft = null;
    A.closeModal(); A.render(); U.toast(existing ? 'Đã cập nhật chợ.' : 'Thêm chợ thành công.');
  };
  A.ACT['dmc-assignment-open'] = el => { const r=MC.get(el.dataset.id); if (!r || !canAssignManager()) return; ui.dmcOpenMarketId=r.id; A.modal(A.mHead('Thay đổi người phụ trách') + `<div class="modal-b">${assignmentFormHtml(null, true)}<input type="hidden" id="dmc-assignment-market" value="${U.esc(r.id)}"></div><div class="modal-f"><button class="btn" data-act="dmc-open" data-id="${U.esc(r.id)}">Hủy</button><button class="btn primary" data-act="dmc-assignment-save" data-market="${U.esc(r.id)}">Lưu thay đổi</button></div>`, true); refreshAssignmentWarning(r.id); };
  A.ACT['dmc-assignment-save'] = el => { const marketId=el.dataset.market, accountId=inputValue('dmc-assignee'), reason=inputValue('dmc-assignment-reason'), effectiveFrom=inputValue('dmc-assignment-from'); const out=MC.assign(marketId,{accountId,effectiveFrom,reason,note:inputValue('dmc-assignment-note')},A.currentAccount()); if(!out.ok){ U.toast(out.reason==='OVERLAP'?'Ngày hiệu lực chồng chéo với một phân công đã có.':out.reason==='REASON_REQUIRED'?'Vui lòng nhập lý do thay đổi.':'Không thể lưu phân công.'); return; } A.closeModal(); A.render(); U.toast(out.scopeWarning?'Đã lưu phân công. Lưu ý người phụ trách chưa có phạm vi chợ phù hợp.':'Đã cập nhật người phụ trách chợ.'); };
  A.ACT['dmc-assignment-edit'] = el => { const r=MC.get(el.dataset.market), row=r&&MC.assignments(r.id).find(x=>x.id===el.dataset.id); if(!r||!row||!canAssignManager())return; A.modal(A.mHead('Sửa kế hoạch phân công')+`<div class="modal-b">${assignmentFormHtml(row,true)}<input type="hidden" id="dmc-assignment-market" value="${U.esc(r.id)}"></div><div class="modal-f"><button class="btn" data-act="dmc-open" data-id="${U.esc(r.id)}">Hủy</button><button class="btn primary" data-act="dmc-assignment-edit-save" data-market="${U.esc(r.id)}" data-id="${U.esc(row.id)}">Lưu</button></div>`,true); refreshAssignmentWarning(r.id); };
  A.ACT['dmc-assignment-edit-save'] = el => { const out=MC.updateFutureAssignment(el.dataset.market,el.dataset.id,{accountId:inputValue('dmc-assignee'),reason:inputValue('dmc-assignment-reason'),note:inputValue('dmc-assignment-note')},A.currentAccount()); if(!out.ok){U.toast(out.reason==='REASON_REQUIRED'?'Vui lòng nhập lý do thay đổi.':'Không thể sửa kế hoạch phân công.');return;} A.closeModal();A.render();U.toast('Đã cập nhật kế hoạch phân công.'); };
  A.ACT['dmc-assignment-cancel'] = el => { const reason=window.prompt('Nhập lý do hủy kế hoạch phân công:'); if(reason===null)return; const out=MC.cancelFutureAssignment(el.dataset.market,el.dataset.id,reason,A.currentAccount()); if(!out.ok){U.toast(out.reason==='REASON_REQUIRED'?'Cần nhập lý do hủy.':'Không thể hủy kế hoạch phân công.');return;} const r=MC.get(el.dataset.market); A.modal(detailHtml(r),true);U.toast('Đã hủy kế hoạch phân công.'); };
})(window.APP);

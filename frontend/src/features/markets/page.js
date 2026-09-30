/* Màn hình "Danh mục chợ" (Điều hành > Danh mục chợ) — Quản trị hệ thống quản lý thông tin CẤP CHỢ
 * (tên, mã, địa điểm, hạng, đơn vị quản lý chung, bảng giá áp dụng, trạng thái), QUY MÔ
 * chợ và các LOẠI DIỆN TÍCH KINH DOANH ÁP DỤNG (allowedAreaTypeIds — không có quota số điểm/m² theo
 * loại). KHÔNG phải màn cấu trúc bên trong 1 chợ (Khu/Tầng/Dãy/Điểm kinh doanh — đó là
 * A.VIEWS['mat-bang'], do Tổ trưởng bố trí theo thực tế).
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
  function layoutTag(r) {
    return layoutKey(r) === 'set' ? `<span class="tag ok">${LAYOUT_STATE.set}</span>` : `<span class="tag">${LAYOUT_STATE.unset}</span>`;
  }
  const areaTypeNames = r => (r.allowedAreaTypeIds || []).map(k => U.areaTypeLabel(k) || k);
  function scaleCell(r) {
    const n = (r.allowedAreaTypeIds || []).length;
    const sub = `<div class="small muted">${n ? fmtNum(n) + ' loại diện tích áp dụng' : 'Chưa chọn loại diện tích'}</div>`;
    return (r.businessArea === null ? '<span class="small muted">Chưa cập nhật</span>' : `<b>${fmtM2(r.businessArea)}</b>`) + sub;
  }
  function canCreate() { return A.canDo('danh-muc-cho.tao'); }
  function canEdit() { return A.canDo('danh-muc-cho.sua'); }

  // Tổ Quản lý chợ là đơn vị chung, độc lập với dữ liệu legacy trên từng Market.
  // Chỉ account current + active mới được dùng để trình bày người đang đảm nhiệm.
  function currentMarketManager() {
    const accounts = A.ACCOUNTS;
    const managers = accounts && accounts.currentList ? accounts.currentList().filter(a =>
      accounts.primaryRole(a) === 'market_manager' && accounts.isActive(a)
    ) : [];
    if (managers.length === 1) return managers[0];
    if (!managers.length) return null;
    // Không chọn ngẫu nhiên khi dữ liệu current bất thường có nhiều Tổ trưởng active.
    return 'AMBIGUOUS';
  }

  function managementContextHtml() {
    const markets = MC.rows();
    const unit = MC.managementUnit(markets[0] || {});
    const manager = currentMarketManager();
    const managerName = manager === 'AMBIGUOUS' ? 'Cần xác nhận dữ liệu' : manager ? (manager.fullName || manager.name || manager.code || 'Chưa cập nhật') : 'Chưa có người đảm nhiệm';
    const hasPhone = !!(manager && manager !== 'AMBIGUOUS' && manager.phone);
    const phone = hasPhone && ui.dmcShowManagerPhone ? manager.phone : hasPhone ? U.maskPhone(manager.phone) : manager && manager !== 'AMBIGUOUS' ? 'Chưa cập nhật' : '—';
    const phoneControl = hasPhone ? `<button class="dmc-phone-toggle" data-act="dmc-toggle-manager-phone" aria-pressed="${ui.dmcShowManagerPhone ? 'true' : 'false'}" title="${ui.dmcShowManagerPhone ? 'Ẩn số điện thoại' : 'Xem số điện thoại'}" aria-label="${ui.dmcShowManagerPhone ? 'Ẩn số điện thoại' : 'Xem số điện thoại'}">${U.icon(ui.dmcShowManagerPhone ? 'eye-off' : 'eye')}</button>` : '';
    return `<section class="card dmc-management-context" aria-label="Thông tin đơn vị quản lý">
      <header class="dmc-management-head"><h3>${U.esc(unit)}</h3>${canCreate() ? '<button class="btn primary" data-act="dmc-new">+ Thêm chợ mới</button>' : ''}</header>
      <div class="dmc-management-body">
        <div class="dmc-management-item"><span>Tổ trưởng</span><b>${U.esc(managerName)}</b></div>
        <div class="dmc-management-item"><span>Số điện thoại</span><b class="dmc-phone-value">${U.esc(phone)}${phoneControl}</b></div>
        <div class="dmc-management-item"><span>Phạm vi quản lý</span><b>${fmtNum(markets.length)} chợ</b></div>
      </div>
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
      ${card('Tổng số chợ', fmtNum(all.length), fmtNum(all.filter(r => r.status === 'active').length) + ' chợ đang hoạt động')}
      ${card('Đã thiết lập mặt bằng', fmtNum(set), 'Đã có cấu trúc Khu/Tầng/Dãy')}
      ${card('Chưa thiết lập mặt bằng', fmtNum(all.length - set), 'Chờ Tổ trưởng thiết lập')}
      ${declared.length ? card('Tổng quy mô kinh doanh', fmtM2(area), fmtNum(declared.length) + ' chợ đã khai báo' + (missing ? ' · ' + fmtNum(missing) + ' chợ chưa khai báo' : '')) : card('Tổng quy mô kinh doanh', 'Chưa cập nhật', 'Chưa có chợ nào khai báo quy mô')}
    </div>`;
  }

  // ---------- Chi tiết chợ ----------
  function areaTypesDetailHtml(r) {
    const names = areaTypeNames(r);
    return names.length ? `<div class="dmc-area-chips">${names.map(n => `<span class="tag">${U.esc(n)}</span>`).join('')}</div>` : '<span class="small muted">Chưa chọn loại diện tích kinh doanh.</span>';
  }
  function detailHtml(r) {
    const edit = canEdit();
    const nonBiz = r.totalArea !== null && r.businessArea !== null ? fmtM2(r.totalArea - r.businessArea) : 'Chưa cập nhật';
    const ready = layoutKey(r) === 'set';
    return A.mHead(`${U.esc(r.name)} <span class="small muted">(${U.esc(r.code)})</span>`) + `<div class="modal-b dmc-detail">
      <section class="dmc-section"><h4>A. THÔNG TIN CHUNG</h4>
        <dl class="kv">
          <dt>Tên chợ</dt><dd>${U.esc(r.name)}</dd>
          <dt>Mã chợ</dt><dd>${U.esc(r.code)}</dd>
          <dt>Địa điểm</dt><dd>${U.esc(r.address || '—')}</dd>
          <dt>Hạng chợ</dt><dd>${rankTag(r.rank)}</dd>
          <dt>Đơn vị quản lý</dt><dd>${U.esc(MC.managementUnit(r))}</dd>
          <dt>Số điện thoại</dt><dd>${U.esc(r.phone || 'Chưa cập nhật')}</dd>
          <dt>Trạng thái chợ</dt><dd>${statusTag(r.status)}</dd>
        </dl>
      </section>
      <section class="dmc-section"><h4>B. QUY MÔ CHỢ</h4>
        <dl class="kv">
          <dt>Tổng diện tích chợ</dt><dd>${r.totalArea !== null ? fmtM2(r.totalArea) : 'Chưa cập nhật'}</dd>
          <dt>Diện tích phục vụ kinh doanh</dt><dd>${r.businessArea !== null ? fmtM2(r.businessArea) : 'Chưa cập nhật'}</dd>
          <dt>Diện tích ngoài kinh doanh</dt><dd>${nonBiz}</dd>
        </dl>
      </section>
      <section class="dmc-section"><h4>C. LOẠI DIỆN TÍCH KINH DOANH ÁP DỤNG</h4>${areaTypesDetailHtml(r)}</section>
      <section class="dmc-section"><h4>D. TÌNH TRẠNG MẶT BẰNG</h4>
        <div>${ready ? `<span class="tag ok">Đã thiết lập mặt bằng</span> <span class="small muted">${fmtNum(MC.layoutZoneCount(r.id))} dãy đã khai báo</span>` : '<span class="tag">Chưa thiết lập mặt bằng</span>'}</div>
        <div class="small muted" style="margin-top:6px">Mặt bằng do Tổ Quản lý chợ thiết lập tại màn "Mặt bằng & điểm kinh doanh", theo các loại diện tích áp dụng ở mục C.</div>
      </section>
    </div>
    <div class="modal-f"><button class="btn" data-act="close">Đóng</button>${edit ? `<button class="btn primary" data-act="dmc-edit" data-id="${U.esc(r.id)}">Chỉnh sửa</button>` : ''}</div>`;
  }

  // ---------- Form Thêm / Chỉnh sửa ----------
  const valOf = v => v === null || v === undefined ? '' : String(v);
  function numInput(id, value, unit, attrs) {
    return `<div class="dmc-num"><input class="input" type="number" min="0" ${attrs || 'step="any"'} id="${id}" data-in="dmc-scale" value="${U.esc(valOf(value))}"><span class="dmc-suffix">${unit}</span></div>`;
  }
  const err = id => `<div class="dmc-err" id="dmc-err-${id}"></div>`;
  function marketForm(r) {
    const x = r || { code: MC.nextCode(), name: '', address: '', rank: 'HANG_3', phone: '', priceConfigId: MC.PRICE_CONFIGS[0].id, status: 'active', totalArea: null, businessArea: null, allowedAreaTypeIds: null };
    const builtin = r && !r.isCustom;
    const usage = r ? MC.usage(r.id) : {};
    const required = !r || r.businessArea !== null;
    // Chỉ chọn loại áp dụng — không mặc định chọn sẵn loại nào khi chợ chưa cấu hình.
    const allowed = x.allowedAreaTypeIds || [];
    const areaTypeItems = MC.areaTypes().map(t => {
      const u = usage[t.id];
      return `<label class="dmc-area-item"><input type="checkbox" id="dmc-at-${t.id}" ${allowed.indexOf(t.id) !== -1 ? 'checked' : ''}><span>${U.esc(t.label)}</span>${u && u.count ? `<small class="muted">${fmtNum(u.count)} điểm đang sử dụng</small>` : ''}</label>`;
    }).join('');
    return A.mHead(r ? 'Chỉnh sửa chợ' : 'Thêm chợ mới') + `<div class="modal-b dmc-form">
      <div class="dmc-err-summary" id="dmc-err-summary"></div>
      <section class="dmc-section"><h4>A. THÔNG TIN CHUNG</h4>
        <div class="form-grid">
          <div class="field"><label>Tên chợ *</label><input class="input" id="dmc-name" value="${U.esc(x.name)}" ${builtin ? 'disabled' : ''}>${err('name')}</div>
          <div class="field"><label>Mã chợ</label><input class="input" id="dmc-code" value="${U.esc(x.code)}" disabled><div class="small muted">${r ? 'Mã chợ dùng làm khóa tham chiếu, không thay đổi.' : 'Hệ thống tự sinh khi lưu.'}</div></div>
          <div class="field"><label>Địa điểm *</label><input class="input" id="dmc-address" value="${U.esc(x.address)}">${err('address')}</div>
          <div class="field"><label>Hạng chợ</label><select class="input" id="dmc-rank">${Object.keys(MC.RANKS).map(k => `<option value="${k}" ${x.rank === k ? 'selected' : ''}>${MC.RANKS[k]}</option>`).join('')}</select></div>
          <div class="field"><label>Đơn vị quản lý</label><input class="input" value="${U.esc(MC.managementUnit(x))}" readonly></div>
          <div class="field"><label>Số điện thoại</label><input class="input" id="dmc-phone" value="${U.esc(x.phone)}"></div>
          <div class="field"><label>Bảng giá áp dụng</label><select class="input" id="dmc-price">${MC.PRICE_CONFIGS.map(p => `<option value="${p.id}" ${x.priceConfigId === p.id ? 'selected' : ''}>${U.esc(p.label)}</option>`).join('')}</select></div>
          <div class="field"><label>Trạng thái</label><select class="input" id="dmc-status">${Object.keys(MC.STATUS).map(k => `<option value="${k}" ${x.status === k ? 'selected' : ''}>${MC.STATUS[k][0]}</option>`).join('')}</select></div>
        </div>
        ${builtin ? '<div class="small muted" style="margin-top:8px">Tên chợ hệ thống hiện có không đổi tại đây (dùng làm khóa tham chiếu xuyên suốt hệ thống).</div>' : ''}
      </section>
      <section class="dmc-section"><h4>B. QUY MÔ CHỢ</h4>
        ${required ? '' : '<div class="note info" style="margin-bottom:10px">Có thể để trống thông tin quy mô nếu chưa có số liệu chính thức. Loại diện tích kinh doanh được cấu hình theo thực tế áp dụng tại chợ.</div>'}
        <div class="form-grid">
          <div class="field"><label>Tổng diện tích chợ${required ? ' *' : ''}</label>${numInput('dmc-total-area', x.totalArea, 'm²')}${err('totalArea')}</div>
          <div class="field"><label>Diện tích phục vụ kinh doanh${required ? ' *' : ''}</label>${numInput('dmc-business-area', x.businessArea, 'm²')}${err('businessArea')}</div>
        </div>
        <div class="dmc-derived"><span>Diện tích ngoài kinh doanh</span><b id="dmc-nonbiz">—</b></div>
        <div class="small muted">Phần diện tích còn lại có thể dành cho lối đi, khu quản lý, kỹ thuật và các khu vực dùng chung.</div>
      </section>
      <section class="dmc-section"><h4>C. LOẠI DIỆN TÍCH KINH DOANH ÁP DỤNG</h4>
        <div class="small muted" style="margin-bottom:8px">Chọn các loại diện tích được sử dụng khi bố trí điểm kinh doanh tại chợ này.</div>
        <div class="dmc-area-types">${areaTypeItems}</div>
        ${err('areaTypes')}
      </section>
    </div>
    <div class="modal-f"><button class="btn" data-act="close">Hủy</button><button class="btn primary" data-act="dmc-save" data-id="${r ? U.esc(r.id) : ''}">Lưu chợ</button></div>`;
  }

  function inputValue(id) { const el = A.$('#' + id); return el ? String(el.value || '').trim() : ''; }
  // '' → null (bỏ trống); chuỗi không phải số → NaN.
  function numValue(id) { const s = inputValue(id).replace(',', '.'); return s === '' ? null : Number(s); }
  function scaleInput() {
    return { totalArea: numValue('dmc-total-area'), businessArea: numValue('dmc-business-area') };
  }
  function selectedAreaTypes() { return MC.areaTypes().map(t => t.id).filter(id => { const el = A.$('#dmc-at-' + id); return !!(el && el.checked); }); }
  function setText(id, html) { const el = A.$('#' + id); if (el) el.innerHTML = html; }
  function refreshDerived() {
    const s = scaleInput();
    const ok = v => v !== null && !isNaN(v);
    setText('dmc-nonbiz', ok(s.totalArea) && ok(s.businessArea) ? fmtM2(s.totalArea - s.businessArea) : '—');
  }
  const ERR_KEYS = ['name', 'address', 'totalArea', 'businessArea', 'areaTypes'];
  function showErrors(errors) {
    ERR_KEYS.forEach(k => setText('dmc-err-' + k, errors[k] ? U.esc(errors[k]) : ''));
    setText('dmc-err-summary', ERR_KEYS.some(k => errors[k]) ? '<div class="note">Chưa lưu được: vui lòng kiểm tra các mục được đánh dấu đỏ bên dưới.</div>' : '');
  }
  function openForm(r) { A.modal(marketForm(r), true); refreshDerived(); }

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
  A.CH['dmc-rank'] = el => { filterState().rank = el.value; A.render(); };
  A.CH['dmc-status'] = el => { filterState().status = el.value; A.render(); };
  A.CH['dmc-layout'] = el => { filterState().layout = el.value; A.render(); };
  A.ACT['dmc-reset'] = () => { ui.dmcFilter = { search: '', rank: '', status: '', layout: '' }; A.render(); };
  // Presentation-only state: never persists and naturally returns to masked after reload.
  A.ACT['dmc-toggle-manager-phone'] = () => { ui.dmcShowManagerPhone = !ui.dmcShowManagerPhone; A.render(); };
  A.ACT['dmc-csv'] = () => {
    U.csv('danh-muc-cho', ['Tên chợ', 'Mã chợ', 'Địa điểm', 'Hạng chợ', 'Đơn vị quản lý', 'Số điện thoại', 'Bảng giá áp dụng', 'Trạng thái chợ', 'Tổng diện tích (m²)', 'Diện tích kinh doanh (m²)', 'Loại diện tích áp dụng', 'Tình trạng mặt bằng'],
      filteredRows().map(r => {
        return [r.name, r.code, r.address || '', MC.RANKS[r.rank] || '', MC.managementUnit(r), r.phone || '', (MC.priceConfig(r.priceConfigId) || {}).label || '', MC.STATUS[r.status] ? MC.STATUS[r.status][0] : '',
          r.totalArea !== null ? r.totalArea : '', r.businessArea !== null ? r.businessArea : '', areaTypeNames(r).join(', '), LAYOUT_STATE[layoutKey(r)]];
      }));
  };
  A.ACT['dmc-open'] = el => { const r = MC.get(el.dataset.id); if (r) A.modal(detailHtml(r), true); };
  A.ACT['dmc-new'] = () => { if (canCreate()) openForm(null); };
  A.ACT['dmc-edit'] = el => { const r = MC.get(el.dataset.id); if (r && canEdit()) openForm(r); };
  A.ACT['dmc-save'] = el => {
    const existing = el.dataset.id ? MC.get(el.dataset.id) : null;
    if (existing ? !canEdit() : !canCreate()) return;
    const acc = A.currentAccount();
    const user = acc ? acc.fullName : 'Không rõ';
    const name = existing && !existing.isCustom ? existing.name : inputValue('dmc-name');
    const address = inputValue('dmc-address');
    const errors = {};
    if (!name) errors.name = 'Vui lòng nhập tên chợ.';
    if (!address) errors.address = 'Vui lòng nhập địa điểm.';
    // Chợ mới, hoặc chợ đã từng khai báo quy mô: bắt buộc (không được xoá trắng quy mô đã có).
    const scale = MC.validateScale(scaleInput(), { required: !existing || existing.businessArea !== null });
    const types = MC.validateAreaTypes(selectedAreaTypes(), existing ? existing.allowedAreaTypeIds : null, existing ? MC.usage(existing.id) : {});
    Object.assign(errors, scale.errors);
    if (!types.ok) errors.areaTypes = types.error;
    if (errors.name || errors.address || !scale.ok || !types.ok) { showErrors(errors); return; }
    const patch = {
      address, rank: inputValue('dmc-rank') || 'HANG_3', phone: inputValue('dmc-phone'),
      priceConfigId: inputValue('dmc-price') || MC.PRICE_CONFIGS[0].id, status: inputValue('dmc-status') || 'active'
    };
    Object.assign(patch, scale.value, { allowedAreaTypeIds: types.value });
    if (existing) {
      if (existing.isCustom) patch.name = name;
      MC.update(existing.id, patch, user);
    } else {
      MC.add(Object.assign({ name, code: MC.nextCode() }, patch), user);
    }
    A.closeModal(); A.render(); U.toast(existing ? 'Đã cập nhật chợ.' : 'Thêm chợ thành công.');
  };
})(window.APP);

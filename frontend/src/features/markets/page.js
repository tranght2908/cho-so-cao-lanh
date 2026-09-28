/* Màn hình "Danh mục chợ" (Điều hành > Danh mục chợ) — Quản trị hệ thống quản lý thông tin CẤP CHỢ
 * (tên, mã, địa điểm, hạng, đơn vị quản lý/tổ trưởng phụ trách, bảng giá áp dụng, trạng thái) và QUY MÔ
 * + CHỈ TIÊU ĐIỂM KINH DOANH theo loại diện tích (capacity). KHÔNG phải màn cấu trúc bên trong 1 chợ
 * (Khu/Tầng/Dãy/Điểm kinh doanh — đó là A.VIEWS['mat-bang'], do Tổ trưởng thiết lập trong giới hạn
 * capacity khai báo ở đây).
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
  function scaleCell(r) {
    if (r.businessArea === null) return '<span class="small muted">Chưa cập nhật</span>';
    const t = MC.capacityTotals(r);
    return `<b>${fmtM2(r.businessArea)}</b><div class="small muted">${t ? fmtNum(t.maxPointCount) + ' điểm tối đa' : 'Chưa khai báo chỉ tiêu'}</div>`;
  }
  function canCreate() { return A.canDo('danh-muc-cho.tao'); }
  function canEdit() { return A.canDo('danh-muc-cho.sua'); }

  function priceConfigHtml(cfg) {
    if (!cfg) return '<div class="small muted">Chưa cấu hình bảng giá.</div>';
    return `<div class="small muted" style="margin-bottom:8px">${U.esc(cfg.label)} · Căn cứ: ${U.esc(cfg.legalBasis)}</div>
      <div class="tbl-wrap"><table class="tbl"><thead><tr><th>Hạng mục</th><th class="num">Đơn giá</th></tr></thead>
      <tbody>${cfg.rows.map(x => `<tr><td>${U.esc(x.label)}</td><td class="num">${U.money(x.amount)}/${U.esc(String(x.unit).replace(/^đ\//, ''))}</td></tr>`).join('')}</tbody></table></div>`;
  }

  // ---------- KPI ----------
  function kpisHtml() {
    const all = MC.rows();
    const set = all.filter(r => layoutKey(r) === 'set').length;
    const declared = all.filter(r => r.businessArea !== null);
    const area = U.sum(declared, r => r.businessArea || 0);
    const pts = U.sum(declared, r => (MC.capacityTotals(r) || { maxPointCount: 0 }).maxPointCount);
    const missing = all.length - declared.length;
    const card = (label, value, sub) => `<div class="card kpi"><div class="k-label">${label}</div><div class="k-value">${value}</div><div class="k-sub">${sub}</div></div>`;
    return `<div class="kpis dmc-kpis">
      ${card('Tổng số chợ', fmtNum(all.length), fmtNum(all.filter(r => r.status === 'active').length) + ' chợ đang hoạt động')}
      ${card('Đã thiết lập mặt bằng', fmtNum(set), 'Đã có cấu trúc Khu/Tầng/Dãy')}
      ${card('Chưa thiết lập mặt bằng', fmtNum(all.length - set), 'Chờ Tổ trưởng thiết lập')}
      ${declared.length ? card('Tổng quy mô kinh doanh', fmtM2(area), fmtNum(pts) + ' điểm tối đa' + (missing ? ' · ' + fmtNum(missing) + ' chợ chưa khai báo' : '')) : card('Tổng quy mô kinh doanh', 'Chưa cập nhật', 'Chưa có chợ nào khai báo quy mô')}
    </div>`;
  }

  // ---------- Chi tiết chợ ----------
  function capacityDetailHtml(r) {
    const usage = MC.usage(r.id);
    const cap = r.capacityByAreaType;
    const capOf = id => cap ? (cap.find(x => x.areaTypeId === id) || { maxPointCount: 0, maxArea: 0 }) : null;
    const types = MC.areaTypes();
    let tu = { count: 0, area: 0 };
    const rows = types.map(t => {
      const c = capOf(t.id), u = usage[t.id] || { count: 0, area: 0 };
      tu = { count: tu.count + u.count, area: tu.area + u.area };
      const left = c ? `${fmtNum(c.maxPointCount - u.count)} điểm<div class="small muted">${fmtM2(c.maxArea - u.area)}</div>` : '<span class="small muted">—</span>';
      return `<tr><td>${U.esc(t.label)}</td>
        <td class="num">${c ? fmtNum(c.maxPointCount) : '<span class="small muted">Chưa cập nhật</span>'}</td>
        <td class="num">${c ? fmtM2(c.maxArea) : '<span class="small muted">Chưa cập nhật</span>'}</td>
        <td class="num">${fmtNum(u.count)} điểm<div class="small muted">${fmtM2(u.area)}</div></td>
        <td class="num">${left}</td></tr>`;
    });
    const none = usage._none;
    if (none) rows.push(`<tr><td>Chưa phân loại</td><td class="num">—</td><td class="num">—</td><td class="num">${fmtNum(none.count)} điểm<div class="small muted">${fmtM2(none.area)}</div></td><td class="num">—</td></tr>`);
    const t = MC.capacityTotals(r);
    if (none) tu = { count: tu.count + none.count, area: tu.area + none.area };
    return `<div class="tbl-wrap"><table class="tbl dmc-cap-tbl"><thead><tr><th>Loại diện tích</th><th class="num">Số điểm tối đa</th><th class="num">Diện tích tối đa</th><th class="num">Đã số hóa</th><th class="num">Còn lại</th></tr></thead>
      <tbody>${rows.join('')}</tbody>
      <tfoot><tr><th>Tổng cộng</th><th class="num">${t ? fmtNum(t.maxPointCount) : '—'}</th><th class="num">${t ? fmtM2(t.maxArea) : '—'}</th><th class="num">${fmtNum(tu.count)} điểm<div class="small muted">${fmtM2(tu.area)}</div></th><th class="num">${t ? fmtNum(t.maxPointCount - tu.count) + ' điểm' : '—'}</th></tr></tfoot></table></div>
      <div class="small muted" style="margin-top:6px">"Đã số hóa" được tính từ các điểm kinh doanh hiện có trên Mặt bằng & điểm kinh doanh của chợ.</div>`;
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
          <dt>Đơn vị quản lý</dt><dd>${U.esc(r.unit || '—')}</dd>
          <dt>Tổ trưởng phụ trách</dt><dd>${U.esc(r.manager || 'Chưa phân công')}</dd>
          <dt>Số điện thoại</dt><dd>${U.esc(r.phone || 'Chưa cập nhật')}</dd>
          <dt>Trạng thái chợ</dt><dd>${statusTag(r.status)}</dd>
        </dl>
        <div style="margin-top:10px"><b class="small">Bảng giá áp dụng</b></div>
        ${priceConfigHtml(MC.priceConfig(r.priceConfigId))}
      </section>
      <section class="dmc-section"><h4>B. QUY MÔ CHỢ</h4>
        <dl class="kv">
          <dt>Tổng diện tích chợ</dt><dd>${r.totalArea !== null ? fmtM2(r.totalArea) : 'Chưa cập nhật'}</dd>
          <dt>Diện tích phục vụ kinh doanh</dt><dd>${r.businessArea !== null ? fmtM2(r.businessArea) : 'Chưa cập nhật'}</dd>
          <dt>Diện tích ngoài kinh doanh</dt><dd>${nonBiz}</dd>
        </dl>
      </section>
      <section class="dmc-section"><h4>C. CHỈ TIÊU ĐIỂM KINH DOANH</h4>${capacityDetailHtml(r)}</section>
      <section class="dmc-section"><h4>D. TÌNH TRẠNG MẶT BẰNG</h4>
        <div>${ready ? `<span class="tag ok">Đã thiết lập mặt bằng</span> <span class="small muted">${fmtNum(MC.layoutZoneCount(r.id))} dãy đã khai báo</span>` : '<span class="tag">Chưa thiết lập mặt bằng</span>'}</div>
        <div class="small muted" style="margin-top:6px">Mặt bằng do Tổ trưởng Tổ quản lý chợ thiết lập tại màn "Mặt bằng & điểm kinh doanh", trong giới hạn chỉ tiêu ở mục C.</div>
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
    const x = r || { code: MC.nextCode(), name: '', address: '', rank: 'HANG_3', unit: '', manager: '', phone: '', priceConfigId: MC.PRICE_CONFIGS[0].id, status: 'active', totalArea: null, businessArea: null, capacityByAreaType: null };
    const builtin = r && !r.isCustom;
    const usage = r ? MC.usage(r.id) : {};
    const capOf = id => (x.capacityByAreaType || []).find(c => c.areaTypeId === id) || {};
    const required = !r || r.businessArea !== null;
    const capRows = MC.areaTypes().map(t => {
      const c = capOf(t.id), u = usage[t.id];
      return `<tr><td>${U.esc(t.label)}</td>
        <td>${numInput('dmc-cap-count-' + t.id, c.maxPointCount, 'điểm', 'step="1"')}</td>
        <td>${numInput('dmc-cap-area-' + t.id, c.maxArea, 'm²')}</td>
        ${r ? `<td class="num">${u ? fmtNum(u.count) + ' điểm<div class="small muted">' + fmtM2(u.area) + '</div>' : '<span class="small muted">0 điểm</span>'}</td>` : ''}
      </tr><tr class="dmc-err-row"><td colspan="${r ? 4 : 3}">${err('cap-' + t.id)}</td></tr>`;
    }).join('');
    return A.mHead(r ? 'Chỉnh sửa chợ' : 'Thêm chợ mới') + `<div class="modal-b dmc-form">
      <div class="dmc-err-summary" id="dmc-err-summary"></div>
      <section class="dmc-section"><h4>A. THÔNG TIN CHUNG</h4>
        <div class="form-grid">
          <div class="field"><label>Tên chợ *</label><input class="input" id="dmc-name" value="${U.esc(x.name)}" ${builtin ? 'disabled' : ''}>${err('name')}</div>
          <div class="field"><label>Mã chợ</label><input class="input" id="dmc-code" value="${U.esc(x.code)}" disabled><div class="small muted">${r ? 'Mã chợ dùng làm khóa tham chiếu, không thay đổi.' : 'Hệ thống tự sinh khi lưu.'}</div></div>
          <div class="field"><label>Địa điểm *</label><input class="input" id="dmc-address" value="${U.esc(x.address)}">${err('address')}</div>
          <div class="field"><label>Hạng chợ</label><select class="input" id="dmc-rank">${Object.keys(MC.RANKS).map(k => `<option value="${k}" ${x.rank === k ? 'selected' : ''}>${MC.RANKS[k]}</option>`).join('')}</select></div>
          <div class="field"><label>Đơn vị quản lý</label><input class="input" id="dmc-unit" value="${U.esc(x.unit)}"></div>
          <div class="field"><label>Tổ trưởng phụ trách</label><input class="input" id="dmc-manager" value="${U.esc(x.manager)}"></div>
          <div class="field"><label>Số điện thoại</label><input class="input" id="dmc-phone" value="${U.esc(x.phone)}"></div>
          <div class="field"><label>Bảng giá áp dụng</label><select class="input" id="dmc-price">${MC.PRICE_CONFIGS.map(p => `<option value="${p.id}" ${x.priceConfigId === p.id ? 'selected' : ''}>${U.esc(p.label)}</option>`).join('')}</select></div>
          <div class="field"><label>Trạng thái</label><select class="input" id="dmc-status">${Object.keys(MC.STATUS).map(k => `<option value="${k}" ${x.status === k ? 'selected' : ''}>${MC.STATUS[k][0]}</option>`).join('')}</select></div>
        </div>
        ${builtin ? '<div class="small muted" style="margin-top:8px">Tên chợ hệ thống hiện có không đổi tại đây (dùng làm khóa tham chiếu xuyên suốt hệ thống).</div>' : ''}
      </section>
      <section class="dmc-section"><h4>B. QUY MÔ CHỢ</h4>
        ${required ? '' : '<div class="note info" style="margin-bottom:10px">Chợ chưa khai báo quy mô. Có thể để trống mục B và C nếu chưa có số liệu chính thức.</div>'}
        <div class="form-grid">
          <div class="field"><label>Tổng diện tích chợ${required ? ' *' : ''}</label>${numInput('dmc-total-area', x.totalArea, 'm²')}${err('totalArea')}</div>
          <div class="field"><label>Diện tích phục vụ kinh doanh${required ? ' *' : ''}</label>${numInput('dmc-business-area', x.businessArea, 'm²')}${err('businessArea')}</div>
        </div>
        <div class="dmc-derived"><span>Diện tích ngoài kinh doanh</span><b id="dmc-nonbiz">—</b></div>
        <div class="small muted">Phần diện tích còn lại có thể dành cho lối đi, khu quản lý, kỹ thuật và các khu vực dùng chung.</div>
      </section>
      <section class="dmc-section"><h4>C. CHỈ TIÊU ĐIỂM KINH DOANH</h4>
        <div class="small muted" style="margin-bottom:8px">Giới hạn số điểm và diện tích theo từng loại diện tích mà Tổ trưởng được phép thiết lập trên mặt bằng.${r ? ' Không thể đặt chỉ tiêu thấp hơn phần mặt bằng đã số hóa.' : ''}</div>
        <div class="tbl-wrap"><table class="tbl dmc-cap-tbl"><thead><tr><th>Loại diện tích</th><th>Số điểm tối đa</th><th>Diện tích tối đa (m²)</th>${r ? '<th class="num">Hiện có trên mặt bằng</th>' : ''}</tr></thead>
          <tbody>${capRows}</tbody>
          <tfoot><tr><th>Tổng cộng</th><th id="dmc-cap-total-count">0 điểm</th><th id="dmc-cap-total-area">0 m²</th>${r ? '<th></th>' : ''}</tr></tfoot></table></div>
        ${err('table')}
      </section>
    </div>
    <div class="modal-f"><button class="btn" data-act="close">Hủy</button><button class="btn primary" data-act="dmc-save" data-id="${r ? U.esc(r.id) : ''}">Lưu chợ</button></div>`;
  }

  function inputValue(id) { const el = A.$('#' + id); return el ? String(el.value || '').trim() : ''; }
  // '' → null (bỏ trống); chuỗi không phải số → NaN.
  function numValue(id) { const s = inputValue(id).replace(',', '.'); return s === '' ? null : Number(s); }
  function scaleInput() {
    const capacity = {};
    MC.areaTypes().forEach(t => { capacity[t.id] = { maxPointCount: numValue('dmc-cap-count-' + t.id), maxArea: numValue('dmc-cap-area-' + t.id) }; });
    return { totalArea: numValue('dmc-total-area'), businessArea: numValue('dmc-business-area'), capacity };
  }
  function setText(id, html) { const el = A.$('#' + id); if (el) el.innerHTML = html; }
  function refreshDerived() {
    const s = scaleInput();
    const ok = v => v !== null && !isNaN(v);
    setText('dmc-nonbiz', ok(s.totalArea) && ok(s.businessArea) ? fmtM2(s.totalArea - s.businessArea) : '—');
    let cnt = 0, area = 0;
    Object.keys(s.capacity).forEach(k => {
      const c = s.capacity[k];
      if (ok(c.maxPointCount)) cnt += c.maxPointCount;
      if (ok(c.maxArea)) area += c.maxArea;
    });
    setText('dmc-cap-total-count', fmtNum(cnt) + ' điểm');
    setText('dmc-cap-total-area', fmtM2(area) + (ok(s.businessArea) ? ` <span class="small muted">/ ${fmtM2(s.businessArea)}</span>` : ''));
  }
  function showErrors(errors) {
    ['name', 'address', 'totalArea', 'businessArea', 'table'].forEach(k => setText('dmc-err-' + k, errors[k] ? U.esc(errors[k]) : ''));
    MC.areaTypes().forEach(t => {
      const e = (errors.capacity || {})[t.id] || {};
      setText('dmc-err-cap-' + t.id, [e.maxPointCount, e.maxArea].filter(Boolean).map(m => `<div>${U.esc(t.label)}: ${U.esc(m)}</div>`).join(''));
    });
    const n = ['name', 'address', 'totalArea', 'businessArea', 'table'].filter(k => errors[k]).length + Object.keys(errors.capacity || {}).length;
    setText('dmc-err-summary', n ? '<div class="note">Chưa lưu được: vui lòng kiểm tra các mục được đánh dấu đỏ bên dưới.</div>' : '');
  }
  function openForm(r) { A.modal(marketForm(r), true); refreshDerived(); }

  A.VIEWS['danh-muc-cho'] = function () {
    const rows = filteredRows(), f = filterState();
    return `<div class="page-head"><div><h2>Danh mục chợ</h2><p class="muted">Quản lý thông tin, quy mô và chỉ tiêu mặt bằng của các chợ thuộc phạm vi quản lý.</p></div>${canCreate() ? '<button class="btn primary" data-act="dmc-new">+ Thêm chợ mới</button>' : ''}</div>
    ${kpisHtml()}
    <div class="card"><div class="card-b"><div class="filters">
      <input class="input" data-in="dmc-search" value="${U.esc(f.search)}" placeholder="Tìm kiếm theo tên chợ, địa điểm...">
      <select class="input" data-ch="dmc-rank"><option value="">Hạng chợ: Tất cả</option>${Object.keys(MC.RANKS).map(k => `<option value="${k}" ${f.rank === k ? 'selected' : ''}>${MC.RANKS[k]}</option>`).join('')}</select>
      <select class="input" data-ch="dmc-status"><option value="">Trạng thái chợ: Tất cả</option>${Object.keys(MC.STATUS).map(k => `<option value="${k}" ${f.status === k ? 'selected' : ''}>${MC.STATUS[k][0]}</option>`).join('')}</select>
      <select class="input" data-ch="dmc-layout"><option value="">Tình trạng mặt bằng: Tất cả</option>${Object.keys(LAYOUT_STATE).map(k => `<option value="${k}" ${f.layout === k ? 'selected' : ''}>${LAYOUT_STATE[k]}</option>`).join('')}</select>
      <button class="btn" data-act="dmc-reset">Làm mới</button>
      <button class="btn" data-act="dmc-csv">⬇ Xuất Excel</button>
    </div></div></div>
    <div class="card catalog-table-card"><div class="card-b">${U.table(
      [{ t: 'STT' }, { t: 'Tên chợ' }, { t: 'Địa điểm' }, { t: 'Hạng chợ' }, { t: 'Quy mô kinh doanh' }, { t: 'Tình trạng mặt bằng' }, { t: 'Trạng thái chợ' }, { t: 'Tổ trưởng phụ trách' }, { t: 'Thao tác' }],
      rows.map((r, i) => `<tr>
        <td>${i + 1}</td>
        <td><b>${U.esc(r.name)}</b><div class="small muted">${U.esc(r.code)}</div></td>
        <td>${U.esc(r.address || '—')}</td>
        <td>${rankTag(r.rank)}</td>
        <td>${scaleCell(r)}</td>
        <td>${layoutTag(r)}</td>
        <td>${statusTag(r.status)}</td>
        <td>${r.manager ? U.esc(r.manager) : '<span class="small muted">Chưa phân công</span>'}</td>
        <td class="nowrap">
          <button class="btn sm" data-act="dmc-open" data-id="${U.esc(r.id)}">Xem chi tiết</button>
          ${canEdit() ? `<button class="btn sm" data-act="dmc-edit" data-id="${U.esc(r.id)}">Chỉnh sửa</button>` : ''}
        </td></tr>`), { empty: 'Không tìm thấy chợ phù hợp.' }
    )}</div></div>`;
  };

  A.IN['dmc-search'] = el => { filterState().search = el.value; A.render(); };
  A.IN['dmc-scale'] = () => refreshDerived();
  A.CH['dmc-rank'] = el => { filterState().rank = el.value; A.render(); };
  A.CH['dmc-status'] = el => { filterState().status = el.value; A.render(); };
  A.CH['dmc-layout'] = el => { filterState().layout = el.value; A.render(); };
  A.ACT['dmc-reset'] = () => { ui.dmcFilter = { search: '', rank: '', status: '', layout: '' }; A.render(); };
  A.ACT['dmc-csv'] = () => {
    U.csv('danh-muc-cho', ['Tên chợ', 'Mã chợ', 'Địa điểm', 'Hạng chợ', 'Đơn vị quản lý', 'Tổ trưởng phụ trách', 'Số điện thoại', 'Bảng giá áp dụng', 'Trạng thái chợ', 'Tổng diện tích (m²)', 'Diện tích kinh doanh (m²)', 'Số điểm tối đa', 'Tình trạng mặt bằng'],
      filteredRows().map(r => {
        const t = MC.capacityTotals(r);
        return [r.name, r.code, r.address || '', MC.RANKS[r.rank] || '', r.unit || '', r.manager || 'Chưa phân công', r.phone || '', (MC.priceConfig(r.priceConfigId) || {}).label || '', MC.STATUS[r.status] ? MC.STATUS[r.status][0] : '',
          r.totalArea !== null ? r.totalArea : '', r.businessArea !== null ? r.businessArea : '', t ? t.maxPointCount : '', LAYOUT_STATE[layoutKey(r)]];
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
    const errors = { capacity: {} };
    if (!name) errors.name = 'Vui lòng nhập tên chợ.';
    if (!address) errors.address = 'Vui lòng nhập địa điểm.';
    // Chợ mới, hoặc chợ đã từng khai báo quy mô: bắt buộc (không được xoá trắng capacity đã có).
    const scale = MC.validateScale(scaleInput(), { required: !existing || existing.businessArea !== null, usage: existing ? MC.usage(existing.id) : {} });
    Object.assign(errors, scale.errors, { capacity: scale.errors.capacity });
    if (errors.name || errors.address || !scale.ok) { showErrors(errors); return; }
    const patch = {
      address, rank: inputValue('dmc-rank') || 'HANG_3', unit: inputValue('dmc-unit'), manager: inputValue('dmc-manager'), phone: inputValue('dmc-phone'),
      priceConfigId: inputValue('dmc-price') || MC.PRICE_CONFIGS[0].id, status: inputValue('dmc-status') || 'active'
    };
    Object.assign(patch, scale.value);
    if (existing) {
      if (existing.isCustom) patch.name = name;
      MC.update(existing.id, patch, user);
    } else {
      MC.add(Object.assign({ name, code: MC.nextCode() }, patch), user);
    }
    A.closeModal(); A.render(); U.toast(existing ? 'Đã cập nhật chợ.' : 'Thêm chợ thành công.');
  };
})(window.APP);

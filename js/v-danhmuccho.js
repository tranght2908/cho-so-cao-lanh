/* Màn hình "Danh mục chợ" (Điều hành > Danh mục chợ) — quản lý thông tin CẤP CHỢ (tên, mã, địa
 * điểm, hạng, Ban Quản lý/người phụ trách, bảng giá áp dụng, trạng thái) cho toàn hệ thống/phạm vi
 * quản lý. KHÔNG phải màn cấu trúc bên trong 1 chợ (Khu/Tầng/Dãy/Điểm kinh doanh — đó là
 * A.VIEWS['mat-bang'], js/v-cautruc.js/v-tieuthuong.js, GIỮ NGUYÊN không đụng tới ở đây).
 * Dữ liệu: js/marketcatalog.js (A.MARKET_CATALOG) — merge D.MARKETS (nguồn danh sách chợ có sẵn)
 * với phần meta danh mục lưu riêng, xem ghi chú đầu file đó.
 * Quyền: RBAC hiện có (js/permissions.js) — screen:danh-muc-cho (system_admin, ward_leader xem được;
 * ward_leader chỉ đọc), action:danh-muc-cho.tao/.sua (chỉ system_admin).
 */
(function (A) {
  'use strict';
  const U = A.U, ui = A.ui, MC = A.MARKET_CATALOG;

  function filterState() { return ui.dmcFilter || (ui.dmcFilter = { search: '', rank: '', status: '' }); }
  function filteredRows() {
    const f = filterState(), q = String(f.search || '').trim().toLowerCase();
    return MC.rows().filter(r => (!q || [r.name, r.address, r.code].join(' ').toLowerCase().includes(q)) &&
      (!f.rank || r.rank === f.rank) && (!f.status || r.status === f.status));
  }
  function rankTag(rank) {
    const cls = rank === 'HANG_1' ? 'info' : rank === 'HANG_2' ? 'purple' : 'warn';
    return `<span class="tag ${cls}">${U.esc(MC.RANKS[rank] || rank || '—')}</span>`;
  }
  function statusTag(status) {
    const x = MC.STATUS[status] || ['Chưa xác định', ''];
    return `<span class="tag ${x[1]}">${x[0]}</span>`;
  }
  function priceBadge(r) {
    const cfg = MC.priceConfig(r.priceConfigId);
    if (!cfg) return '<span class="small muted">Chưa cấu hình</span>';
    return `<span class="tag info">${U.esc(cfg.shortLabel)}</span><button class="btn sm" data-act="dmc-price" data-id="${U.esc(r.id)}">Xem bảng giá</button>`;
  }
  function canCreate() { return A.canDo('danh-muc-cho.tao'); }
  function canEdit() { return A.canDo('danh-muc-cho.sua'); }

  function priceConfigHtml(cfg) {
    if (!cfg) return '<div class="empty">Chưa cấu hình bảng giá.</div>';
    return `<div class="small muted" style="margin-bottom:10px">Căn cứ: ${U.esc(cfg.legalBasis)}</div>
      <div class="tbl-wrap"><table class="tbl"><thead><tr><th>Hạng mục</th><th class="num">Đơn giá</th></tr></thead>
      <tbody>${cfg.rows.map(x => `<tr><td>${U.esc(x.label)}</td><td class="num">${U.money(x.amount)}/${U.esc(String(x.unit).replace(/^đ\//, ''))}</td></tr>`).join('')}</tbody></table></div>`;
  }
  function openPriceModal(r) {
    A.modal(A.mHead('Bảng giá áp dụng — ' + r.name) + `<div class="modal-b">${priceConfigHtml(MC.priceConfig(r.priceConfigId))}</div><div class="modal-f"><button class="btn" data-act="close">Đóng</button></div>`);
  }

  function detailDrawer(r) {
    const edit = canEdit();
    return `<div class="drawer-h"><div><h3>${U.esc(r.name)} <span class="small muted">(${U.esc(r.code)})</span></h3><div class="small muted">${statusTag(r.status)}</div></div><span class="spacer"></span><button class="x" data-act="close" aria-label="Đóng">×</button></div>
    <div class="drawer-b">
      <h4 style="margin:0 0 8px">THÔNG TIN CHUNG</h4>
      <dl class="kv">
        <dt>Tên chợ</dt><dd>${U.esc(r.name)}</dd>
        <dt>Mã chợ</dt><dd>${U.esc(r.code)}</dd>
        <dt>Địa điểm</dt><dd>${U.esc(r.address || '—')}</dd>
        <dt>Hạng chợ</dt><dd>${rankTag(r.rank)}</dd>
        <dt>Trạng thái</dt><dd>${statusTag(r.status)}</dd>
      </dl>
      <h4 style="margin:18px 0 8px">THÔNG TIN QUẢN LÝ</h4>
      <dl class="kv">
        <dt>Ban Quản lý</dt><dd>${U.esc(r.unit || '—')}</dd>
        <dt>Người phụ trách</dt><dd>${U.esc(r.manager || 'Chưa phân công')}</dd>
        <dt>Số điện thoại</dt><dd>${U.esc(r.phone || '—')}</dd>
      </dl>
      <h4 style="margin:18px 0 8px">BẢNG GIÁ ÁP DỤNG</h4>
      ${priceConfigHtml(MC.priceConfig(r.priceConfigId))}
    </div>
    <div class="drawer-f"><button class="btn" data-act="close">Đóng</button>${edit ? `<button class="btn primary" data-act="dmc-edit" data-id="${U.esc(r.id)}">Chỉnh sửa</button>` : ''}</div>`;
  }
  function openDetail(r) { if (!r) return; A.$('#modal-root').innerHTML = `<div class="drawer-overlay" data-act="close"></div><div class="drawer">${detailDrawer(r)}</div>`; }

  function inputValue(id) { const el = A.$('#' + id); return el ? String(el.value || '').trim() : ''; }
  function marketForm(r) {
    const x = r || { code: '', name: '', address: '', rank: 'HANG_1', unit: '', manager: '', phone: '', priceConfigId: MC.PRICE_CONFIGS[0].id, status: 'active' };
    const builtin = r && !r.isCustom;
    return A.mHead(r ? 'Chỉnh sửa chợ' : 'Thêm chợ mới') + `<div class="modal-b">
      <div class="form-grid">
        <div class="field"><label>Tên chợ *</label><input class="input" id="dmc-name" value="${U.esc(x.name)}" ${builtin ? 'disabled' : ''}></div>
        <div class="field"><label>Mã chợ *</label><input class="input" id="dmc-code" value="${U.esc(x.code)}" ${r ? 'disabled' : ''}></div>
        <div class="field"><label>Địa điểm *</label><input class="input" id="dmc-address" value="${U.esc(x.address)}"></div>
        <div class="field"><label>Hạng chợ *</label><select class="input" id="dmc-rank">${Object.keys(MC.RANKS).map(k => `<option value="${k}" ${x.rank === k ? 'selected' : ''}>${MC.RANKS[k]}</option>`).join('')}</select></div>
        <div class="field"><label>Ban Quản lý / Đơn vị phụ trách</label><input class="input" id="dmc-unit" value="${U.esc(x.unit)}"></div>
        <div class="field"><label>Người phụ trách</label><input class="input" id="dmc-manager" value="${U.esc(x.manager)}"></div>
        <div class="field"><label>Số điện thoại</label><input class="input" id="dmc-phone" value="${U.esc(x.phone)}"></div>
        <div class="field"><label>Bảng giá áp dụng *</label><select class="input" id="dmc-price">${MC.PRICE_CONFIGS.map(p => `<option value="${p.id}" ${x.priceConfigId === p.id ? 'selected' : ''}>${U.esc(p.label)}</option>`).join('')}</select></div>
        <div class="field"><label>Trạng thái</label><select class="input" id="dmc-status"><option value="active" ${x.status === 'active' ? 'selected' : ''}>Hoạt động</option><option value="inactive" ${x.status === 'inactive' ? 'selected' : ''}>Tạm ngừng</option></select></div>
      </div>
      ${builtin ? '<div class="small muted" style="margin-top:10px">Tên và mã của chợ hệ thống hiện có không thể đổi tại đây (dùng làm khoá tham chiếu xuyên suốt hệ thống).</div>' : ''}
    </div>
    <div class="modal-f"><button class="btn" data-act="close">Hủy</button><button class="btn primary" data-act="dmc-save" data-id="${r ? U.esc(r.id) : ''}">Lưu chợ</button></div>`;
  }

  A.VIEWS['danh-muc-cho'] = function () {
    const rows = filteredRows(), f = filterState();
    return `<div class="page-head"><div><h2>Danh mục chợ</h2><p class="muted">Quản lý danh sách các chợ thuộc phạm vi quản lý.</p></div>${canCreate() ? '<button class="btn primary" data-act="dmc-new">+ Thêm chợ mới</button>' : ''}</div>
    <div class="card"><div class="card-b"><div class="filters">
      <input class="input" data-in="dmc-search" value="${U.esc(f.search)}" placeholder="Tìm kiếm theo tên chợ, địa điểm...">
      <select class="input" data-ch="dmc-rank"><option value="">Hạng chợ: Tất cả</option>${Object.keys(MC.RANKS).map(k => `<option value="${k}" ${f.rank === k ? 'selected' : ''}>${MC.RANKS[k]}</option>`).join('')}</select>
      <select class="input" data-ch="dmc-status"><option value="">Trạng thái: Tất cả</option>${Object.keys(MC.STATUS).map(k => `<option value="${k}" ${f.status === k ? 'selected' : ''}>${MC.STATUS[k][0]}</option>`).join('')}</select>
      <button class="btn" data-act="dmc-reset">Làm mới</button>
      <button class="btn" data-act="dmc-csv">⬇ Xuất Excel</button>
    </div></div></div>
    <div class="card catalog-table-card"><div class="card-b">${U.table(
      [{ t: 'STT' }, { t: 'Tên chợ' }, { t: 'Địa điểm' }, { t: 'Hạng chợ' }, { t: 'Ban Quản lý / Người phụ trách' }, { t: 'Bảng giá áp dụng' }, { t: 'Trạng thái' }, { t: 'Thao tác' }],
      rows.map((r, i) => `<tr>
        <td>${i + 1}</td>
        <td><b>${U.esc(r.name)}</b><div class="small muted">${U.esc(r.code)}</div></td>
        <td>${U.esc(r.address || '—')}</td>
        <td>${rankTag(r.rank)}</td>
        <td>${U.esc(r.unit || '—')}${r.manager ? `<div class="small muted">${U.esc(r.manager)}</div>` : '<div class="small muted">Chưa phân công</div>'}</td>
        <td>${priceBadge(r)}</td>
        <td>${statusTag(r.status)}</td>
        <td class="nowrap">
          <button class="btn sm" data-act="dmc-open" data-id="${U.esc(r.id)}">Xem chi tiết</button>
          ${canEdit() ? `<button class="btn sm" data-act="dmc-edit" data-id="${U.esc(r.id)}">Chỉnh sửa</button>` : ''}
        </td></tr>`), { empty: 'Không tìm thấy chợ phù hợp.' }
    )}</div></div>`;
  };

  A.IN['dmc-search'] = el => { filterState().search = el.value; A.render(); };
  A.CH['dmc-rank'] = el => { filterState().rank = el.value; A.render(); };
  A.CH['dmc-status'] = el => { filterState().status = el.value; A.render(); };
  A.ACT['dmc-reset'] = () => { ui.dmcFilter = { search: '', rank: '', status: '' }; A.render(); };
  A.ACT['dmc-csv'] = () => {
    U.csv('danh-muc-cho', ['Tên chợ', 'Mã chợ', 'Địa điểm', 'Hạng chợ', 'Ban Quản lý', 'Người phụ trách', 'Bảng giá áp dụng', 'Trạng thái'],
      filteredRows().map(r => [r.name, r.code, r.address || '', MC.RANKS[r.rank] || '', r.unit || '', r.manager || 'Chưa phân công', (MC.priceConfig(r.priceConfigId) || {}).label || '', MC.STATUS[r.status] ? MC.STATUS[r.status][0] : '']));
  };
  A.ACT['dmc-open'] = el => openDetail(MC.get(el.dataset.id));
  A.ACT['dmc-price'] = el => { const r = MC.get(el.dataset.id); if (r) openPriceModal(r); };
  A.ACT['dmc-new'] = () => { if (canCreate()) A.modal(marketForm(null)); };
  A.ACT['dmc-edit'] = el => { const r = MC.get(el.dataset.id); if (r && canEdit()) A.modal(marketForm(r)); };
  A.ACT['dmc-save'] = el => {
    const existing = el.dataset.id ? MC.get(el.dataset.id) : null;
    if (existing ? !canEdit() : !canCreate()) return;
    const acc = A.currentAccount();
    const user = acc ? acc.fullName : 'Không rõ';
    const name = inputValue('dmc-name') || (existing ? existing.name : ''), code = inputValue('dmc-code'), address = inputValue('dmc-address');
    const rank = inputValue('dmc-rank'), priceConfigId = inputValue('dmc-price'), status = inputValue('dmc-status');
    if (!name) { U.toast('Vui lòng nhập tên chợ.'); return; }
    if (!code) { U.toast('Vui lòng nhập mã chợ.'); return; }
    if (!address) { U.toast('Vui lòng nhập địa điểm.'); return; }
    if (!rank) { U.toast('Vui lòng chọn hạng chợ.'); return; }
    if (!priceConfigId) { U.toast('Vui lòng chọn bảng giá áp dụng.'); return; }
    if (!existing && MC.codeTaken(code)) { U.toast('Mã chợ đã tồn tại.'); return; }
    const patch = { address, rank, unit: inputValue('dmc-unit'), manager: inputValue('dmc-manager'), phone: inputValue('dmc-phone'), priceConfigId, status: status || 'active' };
    if (existing) {
      if (existing.isCustom) patch.name = name;
      MC.update(existing.id, patch, user);
    } else {
      MC.add(Object.assign({ name, code }, patch), user);
    }
    A.closeModal(); A.render(); U.toast(existing ? 'Đã cập nhật chợ.' : 'Thêm chợ thành công.');
  };
})(window.APP);

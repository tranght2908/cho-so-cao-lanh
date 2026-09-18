/* Tài sản chợ V1 — FE prototype, chỉ áp dụng Chợ Cao Lãnh. */
(function (A) {
  'use strict';
  const D = A.D, U = A.U, ui = A.ui;
  const CATEGORIES = {
    ELECTRICAL: 'Điện', WATER: 'Cấp nước', FIRE_SAFETY: 'PCCC', SECURITY: 'An ninh',
    VENTILATION: 'Thông gió', SANITATION: 'Vệ sinh', OTHER: 'Khác'
  };
  const STATUSES = { ACTIVE: ['Hoạt động', 'ok'], ISSUE: ['Có sự cố', 'danger'], MAINTENANCE: ['Đang bảo trì', 'warn'], INACTIVE: ['Ngừng hoạt động', ''] };

  function ensureAssets() {
    if (!A.db) return;
    let changed = false;
    if (!Array.isArray(A.db.marketAssets)) { A.db.marketAssets = D.build().marketAssets || []; changed = true; }
    // Migration additive: chỉ bổ sung mock detail cho asset seed cũ, không đụng incident store.
    const seed = D.build().marketAssets || [];
    seed.forEach(s => {
      const current = A.db.marketAssets.find(a => a.id === s.id);
      if (!current || current.demoDetailVersion === 1) return;
      ['lastMaintenanceAt', 'incidents', 'maintenanceHistory', 'images'].forEach(k => { if (s[k] !== undefined) current[k] = s[k]; });
      current.demoDetailVersion = 1; changed = true;
    });
    if (changed) A.save();
  }
  function assets() { ensureAssets(); return (A.db.marketAssets || []).filter(x => x.market === 'CL'); }
  function asset(id) { return assets().find(x => x.id === id); }
  function categoryLabel(key) { return CATEGORIES[key] || key || 'Khác'; }
  function statusTag(status) { const x = STATUSES[status] || ['Chưa xác định', '']; return `<span class="tag ${x[1]}">${x[0]}</span>`; }
  function relatedIncidents(a) { return Array.isArray(a.incidents) ? a.incidents : []; }
  function dueSoon(a) {
    if (!a.maintenanceDueDate || a.status === 'INACTIVE') return false;
    const days = Math.round((new Date(a.maintenanceDueDate + 'T00:00:00') - new Date(U.today() + 'T00:00:00')) / 86400000);
    return days >= 0 && days <= 30;
  }
  function filterState() { return ui.assetFilter || (ui.assetFilter = { search: '', category: '', location: '', status: '' }); }
  function filteredAssets() {
    const f = filterState(), q = String(f.search || '').trim().toLowerCase();
    return assets().filter(a => (!q || [a.code, a.name, a.locationLabel].join(' ').toLowerCase().includes(q)) &&
      (!f.category || a.category === f.category) && (!f.location || a.locationLabel === f.location) && (!f.status || a.status === f.status));
  }
  function nextId() { return 'AST-CL-' + String(Math.max(0, ...assets().map(a => Number((a.id.match(/(\d+)$/) || [0, 0])[1]))) + 1).padStart(3, '0'); }
  function locations() { return Array.from(new Set(assets().map(a => a.locationLabel))).sort(); }
  function inputValue(id) { const el = A.$('#' + id); return el ? String(el.value || '').trim() : ''; }

  function renderTable(rows) {
    return `<div class="card asset-table-card"><div class="card-h asset-table-head"><h3>Danh sách tài sản</h3><span class="small muted">${rows.length} tài sản</span></div><div class="table-wrap asset-table-wrap"><table class="asset-table"><colgroup><col class="asset-col-code"><col class="asset-col-name"><col class="asset-col-category"><col class="asset-col-location"><col class="asset-col-status"><col class="asset-col-incidents"><col class="asset-col-actions"></colgroup><thead><tr><th>Mã tài sản</th><th>Tên tài sản</th><th>Nhóm</th><th>Vị trí</th><th>Trạng thái</th><th class="asset-cell-center">Sự cố liên quan</th><th class="asset-cell-center">Thao tác</th></tr></thead><tbody>${rows.length ? rows.map(a => {
      const inc = relatedIncidents(a);
      return `<tr class="asset-table-row" data-act="asset-open" data-id="${a.id}"><td class="asset-code"><b>${U.esc(a.code)}</b></td><td class="asset-ellipsis" title="${U.esc(a.name)}">${U.esc(a.name)}</td><td class="asset-ellipsis" title="${U.esc(categoryLabel(a.category))}">${U.esc(categoryLabel(a.category))}</td><td class="asset-ellipsis" title="${U.esc(a.locationLabel)}">${U.esc(a.locationLabel)}</td><td>${statusTag(a.status)}</td><td class="asset-cell-center">${inc.length ? inc.map(i => `<span class="tag info asset-incident">${U.esc(i.id)}</span>`).join(' ') : '<span class="muted">—</span>'}</td><td class="asset-cell-center"><button class="btn sm asset-view-btn" data-act="asset-open" data-id="${a.id}">Xem</button></td></tr>`;
    }).join('') : '<tr><td colspan="7"><div class="empty">Chưa có tài sản phù hợp.</div></td></tr>'}</tbody></table></div></div>`;
  }

  A.VIEWS['tai-san'] = function () {
    ensureAssets();
    const all = assets(), rows = filteredAssets(), f = filterState();
    const kpi = (label, value, cls, sub) => `<div class="card kpi"><div class="k-label">${label}</div><div class="k-value"${cls ? ` style="color:${cls}"` : ''}>${value}</div><div class="k-sub">${sub || 'Theo dữ liệu tài sản CL'}</div></div>`;
    return `<div class="page-head"><div><h2>Tài sản chợ</h2><p class="muted">Quản lý danh mục tài sản, trạng thái và sự cố liên quan tại Chợ Cao Lãnh.</p></div>${A.canDo('tai-san.create', 'CL') ? '<button class="btn primary" data-act="asset-new">+ Thêm tài sản</button>' : ''}</div>
      <div class="kpis asset-kpis">${kpi('Tổng tài sản', all.length)}${kpi('Hoạt động tốt', all.filter(a => a.status === 'ACTIVE').length, '#167a3c')}${kpi('Có sự cố', all.filter(a => a.status === 'ISSUE').length, '#b01c1e')}${kpi('Đang bảo trì', all.filter(a => a.status === 'MAINTENANCE').length, '#9a4b0c')}${kpi('Sắp bảo trì', all.filter(dueSoon).length, '#9a4b0c', 'Trong 30 ngày tới')}</div>
      <div class="card"><div class="card-b"><div class="filters"><input class="input" data-ch="asset-filter" data-k="search" value="${U.esc(f.search)}" placeholder="Mã hoặc tên tài sản..."><select class="input" data-ch="asset-filter" data-k="category"><option value="">Tất cả nhóm</option>${Object.keys(CATEGORIES).map(k => `<option value="${k}" ${f.category === k ? 'selected' : ''}>${CATEGORIES[k]}</option>`).join('')}</select><select class="input" data-ch="asset-filter" data-k="location"><option value="">Tất cả khu vực</option>${locations().map(x => `<option value="${U.esc(x)}" ${f.location === x ? 'selected' : ''}>${U.esc(x)}</option>`).join('')}</select><select class="input" data-ch="asset-filter" data-k="status"><option value="">Tất cả trạng thái</option>${Object.keys(STATUSES).map(k => `<option value="${k}" ${f.status === k ? 'selected' : ''}>${STATUSES[k][0]}</option>`).join('')}</select><button class="btn" data-act="asset-reset">Đặt lại</button></div></div></div>${renderTable(rows)}`;
  };

  function incidentRows(a) {
    const xs = relatedIncidents(a);
    return xs.length ? `<div class="table-wrap"><table><thead><tr><th>Mã sự cố</th><th>Tiêu đề</th><th>Ngày phản ánh</th><th>Trạng thái</th><th>Người xử lý</th></tr></thead><tbody>${xs.map(i => `<tr><td><b>${i.id}</b></td><td>${U.esc(i.title)}</td><td>${U.dmy(i.created)}</td><td><span class="tag info">${U.esc((D.INCIDENT_STATES.find(s => s.id === i.state) || {}).label || i.state)}</span></td><td>${U.esc(i.assigneeName || U.staffName(i.assignee) || 'Chưa phân công')}</td></tr>`).join('')}</tbody></table></div>` : '<div class="empty">Chưa có sự cố liên quan.</div>';
  }
  function assetDrawer(a) {
    const tab = ui.assetTab || 'overview', canEdit = A.canDo('tai-san.edit', a.market);
    const tabs = [['overview','Tổng quan'],['incidents','Sự cố liên quan'],['maintenance','Lịch sử bảo trì'],['images','Hình ảnh']];
    let body = '';
    if (tab === 'overview') body = `<dl class="kv"><dt>Mã tài sản</dt><dd>${U.esc(a.code)}</dd><dt>Tên tài sản</dt><dd>${U.esc(a.name)}</dd><dt>Nhóm tài sản</dt><dd>${U.esc(categoryLabel(a.category))}</dd><dt>Chợ</dt><dd>${U.esc(U.market(a.market).name)}</dd><dt>Vị trí</dt><dd>${U.esc(a.locationLabel)}</dd><dt>Ngày lắp đặt</dt><dd>${a.installedAt ? U.dmy(a.installedAt) : '—'}</dd><dt>Trạng thái</dt><dd>${statusTag(a.status)}</dd><dt>Bảo trì gần nhất</dt><dd>${a.lastMaintenanceAt ? U.dmy(a.lastMaintenanceAt) : '—'}</dd><dt>Bảo trì dự kiến</dt><dd>${a.maintenanceDueDate ? U.dmy(a.maintenanceDueDate) : '—'}</dd><dt>Mô tả</dt><dd>${U.esc(a.description || '—')}</dd><dt>Ghi chú</dt><dd>${U.esc(a.note || '—')}</dd></dl>`;
    if (tab === 'incidents') body = incidentRows(a);
    if (tab === 'maintenance') body = a.maintenanceHistory && a.maintenanceHistory.length ? `<div class="table-wrap"><table><thead><tr><th>Mã</th><th>Nội dung</th><th>Ngày</th><th>Trạng thái</th></tr></thead><tbody>${a.maintenanceHistory.map(m => { const planned = m.status === 'PLANNED', progress = m.status === 'IN_PROGRESS'; return `<tr><td><b>${U.esc(m.id)}</b></td><td title="${U.esc(m.description || m.title)}">${U.esc(m.title)}</td><td>${U.dmy(m.date)}</td><td><span class="tag ${planned || progress ? 'warn' : 'ok'}">${planned ? 'Dự kiến' : (progress ? 'Đang thực hiện' : 'Hoàn thành')}</span></td></tr>`; }).join('')}</tbody></table></div>` : '<div class="empty">Chưa có lịch sử bảo trì.</div>';
    if (tab === 'images') body = a.images && a.images.length ? `<div class="asset-images">${a.images.map(n => `<div class="asset-image">📷<br><span class="small">${U.esc(n)}</span></div>`).join('')}</div>` : '<div class="empty">Chưa có hình ảnh.</div>';
    return `<div class="drawer-h"><div><h3>${U.esc(a.code)}</h3><div class="small muted">${U.esc(a.name)} · ${statusTag(a.status)}</div></div><span class="spacer"></span><button class="x" data-act="close" aria-label="Đóng">×</button></div><div class="drawer-b"><div class="seg asset-tabs">${tabs.map(t => `<button class="${tab === t[0] ? 'on' : ''}" data-act="asset-tab" data-id="${a.id}" data-tab="${t[0]}">${t[1]}</button>`).join('')}</div><div style="margin-top:16px">${body}</div></div><div class="drawer-f">${canEdit ? `<button class="btn primary" data-act="asset-edit" data-id="${a.id}">Chỉnh sửa</button>` : ''}<button class="btn" data-act="close">Đóng</button></div>`;
  }
  function openAsset(a) { if (!a) return; ui.assetOpen = a.id; ui.assetTab = ui.assetTab || 'overview'; A.$('#modal-root').innerHTML = `<div class="drawer-overlay" data-act="close"></div><div class="drawer asset-detail-drawer">${assetDrawer(a)}</div>`; }
  function assetForm(a) {
    const x = a || { code:'', name:'', category:'ELECTRICAL', locationLabel:'', installedAt:'', status:'ACTIVE', maintenanceDueDate:'', description:'', note:'' };
    return A.mHead(a ? 'Chỉnh sửa tài sản' : 'Thêm tài sản') + `<div class="modal-b"><div class="form-grid"><div class="field"><label>Mã tài sản *</label><input class="input" id="asset-code" value="${U.esc(x.code)}"></div><div class="field"><label>Tên tài sản *</label><input class="input" id="asset-name" value="${U.esc(x.name)}"></div><div class="field"><label>Nhóm *</label><select class="input" id="asset-category">${Object.keys(CATEGORIES).map(k => `<option value="${k}" ${x.category === k ? 'selected' : ''}>${CATEGORIES[k]}</option>`).join('')}</select></div><div class="field"><label>Khu vực / vị trí *</label><input class="input" id="asset-location" value="${U.esc(x.locationLabel)}"></div><div class="field"><label>Ngày lắp đặt</label><input class="input" type="date" id="asset-installed" value="${U.esc(x.installedAt || '')}"></div><div class="field"><label>Trạng thái *</label><select class="input" id="asset-status">${Object.keys(STATUSES).map(k => `<option value="${k}" ${x.status === k ? 'selected' : ''}>${STATUSES[k][0]}</option>`).join('')}</select></div><div class="field"><label>Ngày bảo trì dự kiến</label><input class="input" type="date" id="asset-due" value="${U.esc(x.maintenanceDueDate || '')}"></div><div class="field"><label>Ảnh</label><input class="input" type="file" accept="image/*" disabled><div class="small muted">Mock V1 chưa lưu ảnh vào localStorage.</div></div></div><div class="field" style="margin-top:12px"><label>Mô tả</label><textarea class="input" id="asset-description" rows="2">${U.esc(x.description || '')}</textarea></div><div class="field"><label>Ghi chú</label><textarea class="input" id="asset-note" rows="2">${U.esc(x.note || '')}</textarea></div></div><div class="modal-f"><button class="btn" data-act="close">Hủy</button><button class="btn primary" data-act="asset-save" data-id="${a ? a.id : ''}">Lưu tài sản</button></div>`;
  }

  A.CH['asset-filter'] = el => { filterState()[el.dataset.k] = el.value; A.render(); };
  A.ACT['asset-reset'] = () => { ui.assetFilter = { search: '', category: '', location: '', status: '' }; A.render(); };
  A.ACT['asset-open'] = el => { ui.assetTab = 'overview'; openAsset(asset(el.dataset.id)); };
  A.ACT['asset-tab'] = el => { ui.assetTab = el.dataset.tab; openAsset(asset(el.dataset.id)); };
  A.ACT['asset-new'] = () => { if (A.canDo('tai-san.create', 'CL')) A.modal(assetForm(null)); };
  A.ACT['asset-edit'] = el => { const a = asset(el.dataset.id); if (a && A.canDo('tai-san.edit', a.market)) A.modal(assetForm(a)); };
  A.ACT['asset-save'] = el => {
    const existing = asset(el.dataset.id), action = existing ? 'tai-san.edit' : 'tai-san.create';
    if (!A.canDo(action, 'CL')) return;
    const code = inputValue('asset-code').toUpperCase(), name = inputValue('asset-name'), locationLabel = inputValue('asset-location');
    if (!code || !name || !locationLabel) { U.toast('Vui lòng nhập mã, tên và vị trí tài sản.'); return; }
    if (assets().some(a => a.code.toUpperCase() === code && a.id !== (existing && existing.id))) { U.toast('Mã tài sản đã tồn tại.'); return; }
    const now = U.today(), target = existing || { id: nextId(), market:'CL', createdAt:now, maintenanceHistory:[], images:[] };
    Object.assign(target, { code, name, category:inputValue('asset-category'), locationLabel, installedAt:inputValue('asset-installed'), status:inputValue('asset-status'), maintenanceDueDate:inputValue('asset-due') || null, description:inputValue('asset-description'), note:inputValue('asset-note'), updatedAt:now });
    if (!existing) A.db.marketAssets.push(target);
    A.save(); A.closeModal(); A.render(); U.toast(existing ? 'Đã cập nhật tài sản.' : 'Đã thêm tài sản.');
  };
})(window.APP);

/* Tài sản chợ V1 — FE prototype, chỉ áp dụng Chợ Cao Lãnh. */
(function (A) {
  'use strict';
  const D = A.D, U = A.U, ui = A.ui;
  const CATEGORIES = {
    ELECTRICAL: 'Điện', WATER: 'Nước', OTHER: 'Khác'
  };
  const STATUSES = { ACTIVE: ['Hoạt động', 'ok'], ISSUE: ['Có sự cố', 'danger'], MAINTENANCE: ['Đang bảo trì', 'warn'], INACTIVE: ['Ngừng hoạt động', ''] };
  // Trạng thái quản lý do BQL thiết lập. ISSUE ("Có sự cố") chỉ là trạng thái hiển thị dẫn xuất từ sự cố đang mở.
  const MANAGED_STATUSES = ['ACTIVE', 'MAINTENANCE', 'INACTIVE'];

  function ensureAssets() {
    if (!A.db) return;
    let changed = false;
    if (!Array.isArray(A.db.marketAssets)) { A.db.marketAssets = D.build().marketAssets || []; changed = true; }
    // Migration additive: chỉ bổ sung mock detail cho asset seed cũ, không đụng incident store.
    const seed = D.build().marketAssets || [];
    seed.forEach(s => {
      const current = A.db.marketAssets.find(a => a.id === s.id);
      if (!current || current.demoDetailVersion === 1) return;
      ['lastMaintenanceAt', 'maintenanceHistory', 'images'].forEach(k => { if (s[k] !== undefined) current[k] = s[k]; });
      current.demoDetailVersion = 1; changed = true;
    });
    if (changed) A.save();
  }
  function assets() { ensureAssets(); return (A.db.marketAssets || []).filter(x => x.market === 'CL'); }
  function asset(id) { return assets().find(x => x.id === id); }
  function categoryGroupKey(key) {
    if (key === 'ELECTRICAL') return 'ELECTRICAL';
    if (key === 'WATER') return 'WATER';
    return 'OTHER';
  }
  function categoryLabel(key) { return CATEGORIES[categoryGroupKey(key)] || 'Khác'; }
  function statusTag(status) { const x = STATUSES[status] || ['Chưa xác định', '']; return `<span class="tag ${x[1]}">${x[0]}</span>`; }
  // Hồ sơ phản ánh/sự cố (A.db.incidents) là nguồn dữ liệu duy nhất; tài sản chỉ đọc qua incident.assetId.
  // Trường legacy asset.incidents (mock cũ) không còn được đọc.
  const incApi = () => A.features.complaints || {};
  const incIsOpen = i => incApi().isOpen ? incApi().isOpen(i) : (i.state !== 'hoanthanh' && i.state !== 'dong');
  const incIsLate = i => incApi().late ? incApi().late(i) : false;
  const incCanView = i => incApi().canView ? incApi().canView(i) : false;
  const incStateLabel = i => (D.INCIDENT_STATES.find(s => s.id === i.state) || {}).label || i.state;
  const fmtAt = v => { const s = String(v || ''); return s ? U.dmy(s.slice(0, 10)) + (s.length > 10 ? ' ' + s.slice(11, 16) : '') : ''; };
  function relatedIncidents(a) {
    return (A.db.incidents || []).filter(i => i.market === a.market && i.assetId === a.id)
      .sort((x, y) => String(y.created || '').localeCompare(String(x.created || '')));
  }
  function incidentSummary(a) {
    const xs = relatedIncidents(a), open = xs.filter(incIsOpen);
    return { total: xs.length, open: open.length, late: open.filter(incIsLate).length, done: xs.length - open.length };
  }
  // Tình trạng hiện tại: Ngừng hoạt động / Đang bảo trì là trạng thái quản lý, giữ nguyên. Còn lại:
  // có sự cố đang mở → "Có sự cố", không có → "Hoạt động". Giá trị ISSUE legacy đã lưu không được đọc.
  function currentStatus(a) {
    if (a.status === 'INACTIVE' || a.status === 'MAINTENANCE') return a.status;
    return incidentSummary(a).open ? 'ISSUE' : 'ACTIVE';
  }
  function incidentCell(a) {
    const s = incidentSummary(a);
    if (!s.total) return '<span class="muted">Chưa phát sinh</span>';
    if (s.open) return [s.late ? `<span class="tag danger asset-incident">${s.late} quá hạn</span>` : '', s.open > s.late ? `<span class="tag warn asset-incident">${s.open - s.late} đang xử lý</span>` : ''].filter(Boolean).join(' ');
    return `<span class="tag ok asset-incident">${s.done} đã xử lý</span>`;
  }
  function dueSoon(a) {
    if (!a.maintenanceDueDate || a.status === 'INACTIVE') return false;
    const days = Math.round((new Date(a.maintenanceDueDate + 'T00:00:00') - new Date(U.today() + 'T00:00:00')) / 86400000);
    return days >= 0 && days <= 30;
  }
  // ---------- Vị trí tài sản: tham chiếu graph mặt bằng v16 (A.db.buildings/floors/rows/stalls) ----------
  // Asset chỉ lưu locationType + locationId; khối/tầng/dãy/điểm và nhãn đều suy ra lúc hiển thị.
  // Asset cũ chỉ có locationLabel (text tự do) → hiển thị read-only, không đoán mapping.
  const LOC_TYPES = { BUILDING: 'Khối/Nhà', FLOOR: 'Tầng', ROW: 'Dãy', POINT: 'Điểm kinh doanh' };
  const layoutStore = () => A.features.marketLayout.store;
  const pointService = () => A.features.businessPoints.service;
  const idxGet = (name, id) => (id && A.idx && A.idx[name] && A.idx[name].get(id)) || null;
  const rowName = r => r ? 'Dãy ' + r.code : '';
  function resolveLocation(a) {
    const type = a && a.locationType, id = a && a.locationId;
    if (!type || !id) {
      const text = (a && a.locationLabel) || '—';
      return { legacy: true, label: text, secondary: 'Vị trí cũ / chưa chuẩn hóa', fullPath: text, market: a && a.market, building: null, floor: null, row: null, point: null };
    }
    let building = null, floor = null, row = null, point = null;
    if (type === 'POINT') { point = idxGet('stall', id); if (point) { row = pointService().row(point); floor = pointService().floor(point); building = pointService().building(point); } }
    if (type === 'ROW') { row = idxGet('row', id); if (row) { floor = idxGet('floor', row.floorId); building = idxGet('building', row.buildingId); } }
    if (type === 'FLOOR') { floor = idxGet('floor', id); if (floor) building = idxGet('building', floor.buildingId); }
    if (type === 'BUILDING') building = idxGet('building', id);
    const target = { BUILDING: building, FLOOR: floor, ROW: row, POINT: point }[type];
    if (!target) return { missing: true, label: 'Vị trí không còn tồn tại', secondary: (LOC_TYPES[type] || type) + ' · ' + id, fullPath: 'Vị trí không còn tồn tại (' + id + ')', market: a.market, building, floor, row, point };
    const b = building && building.name, f = floor && floor.name, r = rowName(row), p = point && point.code;
    const label = { BUILDING: b, FLOOR: f, ROW: r, POINT: p }[type] || '—';
    const secondary = { BUILDING: '', FLOOR: b, ROW: [b, f].filter(Boolean).join(' · '), POINT: [r, f || b].filter(Boolean).join(' · ') }[type] || '';
    return { type, label, secondary, fullPath: [b, f, r, p].filter(Boolean).join(' → '), market: target.market, building, floor, row, point };
  }
  function locationCell(a) {
    const loc = resolveLocation(a);
    return `<div class="asset-loc" title="${U.esc(loc.fullPath)}"><b class="${loc.missing ? 'danger-text' : ''}">${U.esc(loc.label)}</b>${loc.secondary ? `<span class="small muted">${U.esc(loc.secondary)}</span>` : ''}</div>`;
  }
  // Bộ lọc khu vực: theo Khối/Nhà (id) cho asset đã chuẩn hóa; asset cũ lọc theo text cũ.
  function locationKey(a) { const loc = resolveLocation(a); return loc.legacy ? 'L:' + loc.label : (loc.building ? 'B:' + loc.building.id : ''); }
  function filterState() { return ui.assetFilter || (ui.assetFilter = { search: '', category: '', location: '', status: '' }); }
  function filteredAssets() {
    const f = filterState(), q = String(f.search || '').trim().toLowerCase();
    return assets().filter(a => (!q || [a.code, a.name, categoryLabel(a.category), resolveLocation(a).fullPath].join(' ').toLowerCase().includes(q)) &&
      (!f.category || categoryGroupKey(a.category) === f.category) && (!f.location || locationKey(a) === f.location) && (!f.status || currentStatus(a) === f.status));
  }
  function nextId() { return 'AST-CL-' + String(Math.max(0, ...assets().map(a => Number((a.id.match(/(\d+)$/) || [0, 0])[1]))) + 1).padStart(3, '0'); }
  function locations() {
    const out = new Map();
    assets().forEach(a => { const k = locationKey(a), loc = resolveLocation(a); if (k && !out.has(k)) out.set(k, loc.legacy ? loc.label + ' (vị trí cũ)' : loc.building.name); });
    return Array.from(out, ([key, label]) => ({ key, label })).sort((x, y) => x.label.localeCompare(y.label, 'vi'));
  }
  function inputValue(id) { const el = A.$('#' + id); return el ? String(el.value || '').trim() : ''; }

  function renderTable(rows) {
    return `<div class="card asset-table-card"><div class="card-h asset-table-head"><h3>Danh sách tài sản</h3><span class="small muted">${rows.length} tài sản</span></div><div class="table-wrap asset-table-wrap"><table class="asset-table"><colgroup><col class="asset-col-code"><col class="asset-col-name"><col class="asset-col-category"><col class="asset-col-location"><col class="asset-col-status"><col class="asset-col-incidents"><col class="asset-col-actions"></colgroup><thead><tr><th>Mã tài sản</th><th>Tên tài sản</th><th>Nhóm</th><th>Vị trí</th><th>Trạng thái</th><th class="asset-cell-center">Sự cố</th><th class="asset-cell-center">Thao tác</th></tr></thead><tbody>${rows.length ? rows.map(a => {
      return `<tr class="asset-table-row" data-act="asset-open" data-id="${a.id}"><td class="asset-code"><b>${U.esc(a.code)}</b></td><td class="asset-ellipsis" title="${U.esc(a.name)}">${U.esc(a.name)}</td><td class="asset-ellipsis" title="${U.esc(categoryLabel(a.category))}">${U.esc(categoryLabel(a.category))}</td><td>${locationCell(a)}</td><td>${statusTag(currentStatus(a))}</td><td class="asset-cell-center">${incidentCell(a)}</td><td class="asset-cell-center"><button class="btn sm asset-view-btn" data-act="asset-open" data-id="${a.id}">Xem</button></td></tr>`;
    }).join('') : '<tr><td colspan="7"><div class="empty">Chưa có tài sản phù hợp.</div></td></tr>'}</tbody></table></div></div>`;
  }

  A.VIEWS['tai-san'] = function () {
    ensureAssets();
    const all = assets(), rows = filteredAssets(), f = filterState();
    const kpi = (label, value, cls, sub) => `<div class="card kpi"><div class="k-label">${label}</div><div class="k-value"${cls ? ` style="color:${cls}"` : ''}>${value}</div><div class="k-sub">${sub || 'Theo dữ liệu tài sản CL'}</div></div>`;
    return `<div class="page-head"><div><h2>Tài sản chợ</h2><p class="muted">Quản lý danh mục tài sản, trạng thái và sự cố liên quan tại Chợ Cao Lãnh.</p></div>${A.canDo('tai-san.create', 'CL') ? '<button class="btn primary" data-act="asset-new">+ Thêm tài sản</button>' : ''}</div>
      <div class="kpis asset-kpis">${kpi('Tổng tài sản', all.length)}${kpi('Hoạt động tốt', all.filter(a => currentStatus(a) === 'ACTIVE').length, '#167a3c')}${kpi('Có sự cố', all.filter(a => currentStatus(a) === 'ISSUE').length, '#b01c1e', 'Sự cố chưa hoàn tất xử lý')}${kpi('Đang bảo trì', all.filter(a => currentStatus(a) === 'MAINTENANCE').length, '#9a4b0c')}${kpi('Sắp bảo trì', all.filter(dueSoon).length, '#9a4b0c', 'Trong 30 ngày tới')}</div>
      <div class="card"><div class="card-b"><div class="filters"><input class="input" data-ch="asset-filter" data-k="search" value="${U.esc(f.search)}" placeholder="Mã hoặc tên tài sản..."><select class="input" data-ch="asset-filter" data-k="category"><option value="">Tất cả nhóm</option>${Object.keys(CATEGORIES).map(k => `<option value="${k}" ${f.category === k ? 'selected' : ''}>${CATEGORIES[k]}</option>`).join('')}</select><select class="input" data-ch="asset-filter" data-k="location"><option value="">Tất cả khu vực</option>${locations().map(x => `<option value="${U.esc(x.key)}" ${f.location === x.key ? 'selected' : ''}>${U.esc(x.label)}</option>`).join('')}</select><select class="input" data-ch="asset-filter" data-k="status"><option value="">Tất cả trạng thái</option>${Object.keys(STATUSES).map(k => `<option value="${k}" ${f.status === k ? 'selected' : ''}>${STATUSES[k][0]}</option>`).join('')}</select><button class="btn" data-act="asset-reset">Đặt lại</button></div></div></div>${renderTable(rows)}`;
  };

  function incidentImages(names) {
    return `<div class="inc-image-list">${names.map(n => `<div class="inc-image-thumb">📷<span>${U.esc(typeof n === 'string' ? n : (n && n.name) || '')}</span></div>`).join('')}</div>`;
  }
  // Chỉ đọc hồ sơ gốc: Tiểu thương (nội dung, điểm, ảnh ban đầu) · BQL (phân công) · NV kỹ thuật (xử lý, kết quả, ảnh).
  function incidentCard(i) {
    const st = A.idx.stall.get(i.stallId), t = A.idx.trader.get(i.traderId), w = i.work || {}, ins = i.inspection || {}, imgs = i.images || {};
    const before = (imgs.report || []).concat(imgs.inspection || []), after = imgs.work || [];
    const kv = [
      ['Thời gian phản ánh', fmtAt(i.created)],
      ['Người phản ánh', t ? t.name : i.reporterName],
      ['Điểm kinh doanh', st && st.code],
      ['Nội dung phản ánh', i.desc || i.title],
      ['NV kỹ thuật xử lý', i.assignee ? U.staffName(i.assignee) : ''],
      // saveWork() ghi cùng nội dung vào inspection.condition và work.content — không hiện lặp lại.
      ['Kết quả kiểm tra hiện trường', ins.condition && ins.condition !== w.content ? ins.condition : ''],
      ['Ghi chú kỹ thuật', ins.note],
      ['Nội dung xử lý', w.content],
      ['Kết quả xử lý', w.result],
      ['Hoàn thành lúc', fmtAt(w.completedAt)]
    ].filter(x => x[1]);
    return `<article class="asset-incident-card"><div class="asset-incident-card-h"><b>${U.esc(i.id)}</b><span class="asset-incident-title">${U.esc(i.title || '')}</span><span class="tag ${incIsOpen(i) ? 'warn' : 'ok'}">${U.esc(incStateLabel(i))}</span>${incIsLate(i) ? '<span class="tag danger">Quá hạn</span>' : ''}</div>
      <dl class="asset-profile-kv">${kv.map(x => `<dt>${x[0]}</dt><dd>${U.esc(x[1])}</dd>`).join('')}</dl>
      ${before.length ? `<div class="asset-incident-images"><span class="small muted">Ảnh hiện trạng</span>${incidentImages(before)}</div>` : ''}${after.length ? `<div class="asset-incident-images"><span class="small muted">Ảnh sau xử lý</span>${incidentImages(after)}</div>` : ''}
      ${incCanView(i) ? `<div class="asset-incident-card-f"><button class="btn sm" data-act="inc-open" data-id="${U.esc(i.id)}" data-readonly="1">Xem hồ sơ sự cố</button></div>` : ''}</article>`;
  }
  function incidentHistory(a, limit) {
    const xs = relatedIncidents(a), shown = limit ? xs.slice(0, limit) : xs;
    return xs.length ? `<div class="asset-incident-history">${shown.map(incidentCard).join('')}</div>` : '<div class="empty">Chưa phát sinh sự cố.</div>';
  }
  function maintenanceRows(a) {
    const xs = a.maintenanceHistory || [];
    return xs.length ? `<div class="table-wrap asset-detail-table"><table><thead><tr><th>Mã bảo trì</th><th>Nội dung</th><th>Ngày thực hiện</th><th>Trạng thái</th><th>Người thực hiện</th></tr></thead><tbody>${xs.map(m => { const planned=m.status==='PLANNED', progress=m.status==='IN_PROGRESS'; return `<tr><td><b>${U.esc(m.id)}</b></td><td>${U.esc(m.title)}</td><td>${U.dmy(m.date)}</td><td><span class="tag ${planned||progress?'warn':'ok'}">${planned?'Dự kiến':progress?'Đang thực hiện':'Hoàn thành'}</span></td><td>${U.esc(m.by || '—')}</td></tr>`; }).join('')}</tbody></table></div>` : '<div class="empty">Chưa có lịch sử bảo trì.</div>';
  }
  function imageGrid(a) {
    const xs = a.images || [];
    return xs.length ? `<div class="asset-detail-images">${xs.map((n, idx) => `<div class="asset-detail-image"><div class="asset-image-placeholder">📷</div><b>${idx === 0 ? 'Hình ảnh tình trạng tài sản' : 'Hình ảnh liên quan'}</b><span>${U.esc(n)}</span></div>`).join('')}</div>` : '<div class="empty">Chưa có hình ảnh.</div>';
  }
  function overviewHtml(a, canEdit) {
    const incidents = relatedIncidents(a), maintenance = a.maintenanceHistory || [];
    return `<section class="asset-detail-section"><div class="asset-detail-section-h"><h4>ⓘ Thông tin tài sản</h4>${canEdit ? `<button class="btn sm" data-act="asset-edit" data-id="${a.id}">✎ Chỉnh sửa</button>` : ''}</div><div class="asset-profile"><div class="asset-profile-icon">💡</div><div class="asset-profile-name"><b>${U.esc(a.code)}</b><span>${U.esc(a.name)}</span>${statusTag(currentStatus(a))}</div><dl class="asset-profile-kv"><dt>Nhóm tài sản</dt><dd>${U.esc(categoryLabel(a.category))}</dd><dt>Chợ</dt><dd>${U.esc(U.market(a.market).name)}</dd><dt>Vị trí</dt><dd>${(loc => `<span class="${loc.missing ? 'danger-text' : ''}">${U.esc(loc.fullPath)}</span>${loc.legacy || loc.missing ? `<div class="small muted">${U.esc(loc.secondary)}</div>` : ''}`)(resolveLocation(a))}</dd><dt>Ngày lắp đặt</dt><dd>${a.installedAt ? U.dmy(a.installedAt) : '—'}</dd><dt>Bảo trì gần nhất</dt><dd>${a.lastMaintenanceAt ? U.dmy(a.lastMaintenanceAt) : '—'}</dd><dt>Bảo trì dự kiến</dt><dd>${a.maintenanceDueDate ? U.dmy(a.maintenanceDueDate) : '—'}</dd><dt>Mô tả</dt><dd>${U.esc(a.description || '—')}</dd><dt>Ghi chú</dt><dd>${U.esc(a.note || '—')}</dd></dl></div></section><section class="asset-detail-section asset-detail-incidents"><div class="asset-detail-section-h"><h4>⚒ Lịch sử sự cố (${incidents.length})</h4></div>${incidentHistory(a, 2)}${incidents.length > 2 ? '<button class="btn sm asset-detail-link" data-act="asset-tab" data-id="'+a.id+'" data-tab="incidents">Xem tất cả sự cố →</button>' : ''}</section><section class="asset-detail-section asset-detail-maintenance"><div class="asset-detail-section-h"><h4>◉ Lịch sử bảo trì (${maintenance.length})</h4></div>${maintenanceRows(a)}</section><section class="asset-detail-section asset-detail-gallery"><div class="asset-detail-section-h"><h4>▣ Hình ảnh (${(a.images || []).length})</h4></div>${imageGrid(a)}<div class="asset-detail-note">ⓘ Ảnh sử dụng cho mục đích tra cứu và quản lý tài sản.</div></section>`;
  }
  function assetDrawer(a) {
    const tab = ui.assetTab || 'overview', canEdit = A.canDo('tai-san.edit', a.market);
    const tabs = [['overview','Tổng quan'],['incidents','Lịch sử sự cố'],['maintenance','Lịch sử bảo trì'],['images','Hình ảnh']];
    let body = '';
    if (tab === 'overview') body = overviewHtml(a, canEdit);
    if (tab === 'incidents') body = incidentHistory(a);
    if (tab === 'maintenance') body = maintenanceRows(a);
    if (tab === 'images') body = imageGrid(a);
    return `<div class="drawer-h asset-detail-head"><div><h3>${U.esc(a.code)} <span class="asset-detail-head-name">(${U.esc(a.name)})</span></h3><div class="small muted">${statusTag(currentStatus(a))}</div></div><span class="spacer"></span><button class="x" data-act="close" aria-label="Đóng">×</button></div><div class="drawer-b asset-detail-body"><div class="seg asset-tabs">${tabs.map(t => `<button class="${tab === t[0] ? 'on' : ''}" data-act="asset-tab" data-id="${a.id}" data-tab="${t[0]}">${t[1]}</button>`).join('')}</div><div class="asset-detail-content">${body}</div></div><div class="drawer-f"><button class="btn" data-act="close">Đóng</button></div>`;
  }
  function openAsset(a) { if (!a) return; ui.assetOpen = a.id; ui.assetTab = ui.assetTab || 'overview'; A.$('#modal-root').innerHTML = `<div class="drawer-overlay" data-act="close"></div><div class="drawer asset-detail-drawer">${assetDrawer(a)}</div>`; }
  // ---------- Chọn vị trí có cấu trúc (form Thêm/Sửa) ----------
  // Nháp chọn lưu trong ui.assetLocDraft theo ID; chỉ liệt kê entity thuộc chợ của tài sản.
  const LOC_KEYS = ['type', 'building', 'floor', 'row', 'point'];
  const LOC_FIELD = { type: 'type', building: 'buildingId', floor: 'floorId', row: 'rowId', point: 'pointId' };
  const NO_FLOOR = 'NONE';
  function locDraftFrom(a) {
    const market = a ? a.market : 'CL', loc = a ? resolveLocation(a) : null, d = { market, type: '', buildingId: '', floorId: '', rowId: '', pointId: '', legacyLabel: '' };
    if (!loc) return d;
    if (loc.legacy) { d.legacyLabel = a.locationLabel || ''; return d; }
    return Object.assign(d, { type: a.locationType, buildingId: loc.building ? loc.building.id : '', floorId: loc.floor ? loc.floor.id : (loc.row && !loc.row.floorId && layoutStore().hasFloors(loc.row.buildingId) ? NO_FLOOR : ''), rowId: loc.row ? loc.row.id : '', pointId: loc.point ? loc.point.id : '' });
  }
  function locDraft() { return ui.assetLocDraft || (ui.assetLocDraft = locDraftFrom(null)); }
  function locFieldsHtml() {
    const d = locDraft(), S = layoutStore(), mid = d.market, allFloors = S.floorsOf(mid);
    const opt = (v, label, on) => `<option value="${U.esc(v)}" ${on ? 'selected' : ''}>${U.esc(label)}</option>`;
    const select = (k, label, items, value, placeholder) => `<div class="field"><label>${label} *</label><select class="input" id="asset-loc-${k}" data-ch="asset-loc" data-k="${k}">${opt('', placeholder, !value)}${items.map(x => opt(x[0], x[1], x[0] === value)).join('')}</select></div>`;
    const out = [select('type', 'Phạm vi tài sản', Object.keys(LOC_TYPES).filter(t => t !== 'FLOOR' || allFloors.length).map(t => [t, LOC_TYPES[t]]), d.type, 'Chọn phạm vi')];
    if (d.type) {
      const buildings = S.buildingsOf(mid).filter(b => d.type !== 'FLOOR' || allFloors.some(f => f.buildingId === b.id));
      out.push(select('building', 'Khối/Nhà', buildings.map(b => [b.id, b.name]), d.buildingId, 'Chọn khối/nhà'));
      const floors = allFloors.filter(f => f.buildingId === d.buildingId), needRows = d.type === 'ROW' || d.type === 'POINT';
      // Tầng tùy chọn: chỉ hiện khi khối có chia tầng; khối vừa có tầng vừa có dãy không chia tầng → thêm lựa chọn riêng.
      if (d.buildingId && floors.length && (d.type === 'FLOOR' || needRows)) {
        const loose = needRows && S.hasLooseRows(d.buildingId);
        out.push(select('floor', 'Tầng', floors.map(f => [f.id, f.name]).concat(loose ? [[NO_FLOOR, 'Không chia tầng']] : []), d.floorId, 'Chọn tầng'));
      }
      if (needRows && d.buildingId && (!floors.length || d.floorId)) {
        const rows = S.rowsOf(mid).filter(r => r.buildingId === d.buildingId && (!floors.length || (d.floorId === NO_FLOOR ? !r.floorId : r.floorId === d.floorId)));
        out.push(select('row', 'Dãy', rows.map(r => [r.id, rowName(r) + (r.name ? ' · ' + r.name : '')]), d.rowId, 'Chọn dãy'));
      }
      if (d.type === 'POINT' && d.rowId) out.push(select('point', 'Điểm kinh doanh', S.pointsOfRow(d.rowId).filter(p => p.market === mid).map(p => [p.id, p.code]), d.pointId, 'Chọn điểm kinh doanh'));
    }
    const legacy = d.legacyLabel && !d.type ? `<div class="note warn small asset-loc-legacy">Vị trí cũ / chưa chuẩn hóa: <b>${U.esc(d.legacyLabel)}</b>. Chọn phạm vi để chuẩn hóa theo mặt bằng; để trống sẽ giữ nguyên vị trí cũ.</div>` : '';
    return `<label class="asset-loc-title">Vị trí tài sản *</label>${legacy}<div class="form-grid">${out.join('')}</div>`;
  }
  // → { type, id } đã kiểm tra thuộc chợ của tài sản; { keepLegacy } nếu giữ vị trí cũ; { error } nếu thiếu/sai.
  function locationFromDraft(d) {
    if (!d.type) return d.legacyLabel ? { keepLegacy: true } : { error: 'Vui lòng chọn phạm vi và vị trí tài sản.' };
    const id = { BUILDING: d.buildingId, FLOOR: d.floorId === NO_FLOOR ? '' : d.floorId, ROW: d.rowId, POINT: d.pointId }[d.type];
    if (!LOC_TYPES[d.type] || !id) return { error: 'Vui lòng chọn đầy đủ vị trí tài sản (' + (LOC_TYPES[d.type] || 'phạm vi') + ').' };
    const loc = resolveLocation({ locationType: d.type, locationId: id, market: d.market });
    if (loc.missing || loc.market !== d.market) return { error: 'Vị trí đã chọn không thuộc mặt bằng của chợ này.' };
    return { type: d.type, id };
  }
  function assetForm(a) {
    const x = a || { code:'', name:'', category:'ELECTRICAL', installedAt:'', status:'ACTIVE', maintenanceDueDate:'', description:'', note:'' };
    ui.assetLocDraft = locDraftFrom(a);
    return A.mHead(a ? 'Chỉnh sửa tài sản' : 'Thêm tài sản') + `<div class="modal-b"><div class="form-grid"><div class="field"><label>Mã tài sản *</label><input class="input" id="asset-code" value="${U.esc(x.code)}"></div><div class="field"><label>Tên tài sản *</label><input class="input" id="asset-name" value="${U.esc(x.name)}"></div><div class="field"><label>Nhóm *</label><select class="input" id="asset-category">${Object.keys(CATEGORIES).map(k => `<option value="${k}" ${x.category === k ? 'selected' : ''}>${CATEGORIES[k]}</option>`).join('')}</select></div><div class="field"><label>Ngày lắp đặt</label><input class="input" type="date" id="asset-installed" value="${U.esc(x.installedAt || '')}"></div><div class="field"><label>Trạng thái *</label><select class="input" id="asset-status">${MANAGED_STATUSES.map(k => `<option value="${k}" ${x.status === k ? 'selected' : ''}>${STATUSES[k][0]}</option>`).join('')}</select><div class="small muted">"Có sự cố" được xác định tự động từ phản ánh/sự cố đang mở.</div></div><div class="field"><label>Ngày bảo trì dự kiến</label><input class="input" type="date" id="asset-due" value="${U.esc(x.maintenanceDueDate || '')}"></div><div class="field"><label>Ảnh</label><input class="input" type="file" accept="image/*" disabled><div class="small muted">Mock V1 chưa lưu ảnh vào localStorage.</div></div></div><div class="asset-loc-form" id="asset-loc-fields">${locFieldsHtml()}</div><div class="field" style="margin-top:12px"><label>Mô tả</label><textarea class="input" id="asset-description" rows="2">${U.esc(x.description || '')}</textarea></div><div class="field"><label>Ghi chú</label><textarea class="input" id="asset-note" rows="2">${U.esc(x.note || '')}</textarea></div></div><div class="modal-f"><button class="btn" data-act="close">Hủy</button><button class="btn primary" data-act="asset-save" data-id="${a ? a.id : ''}">Lưu tài sản</button></div>`;
  }

  A.CH['asset-filter'] = el => { filterState()[el.dataset.k] = el.value; A.render(); };
  A.ACT['asset-reset'] = () => { ui.assetFilter = { search: '', category: '', location: '', status: '' }; A.render(); };
  A.ACT['asset-open'] = el => { ui.assetTab = 'overview'; openAsset(asset(el.dataset.id)); };
  A.ACT['asset-tab'] = el => { ui.assetTab = el.dataset.tab; openAsset(asset(el.dataset.id)); };
  A.ACT['asset-new'] = () => { if (A.canDo('tai-san.create', 'CL')) A.modal(assetForm(null)); };
  A.ACT['asset-edit'] = el => { const a = asset(el.dataset.id); if (a && A.canDo('tai-san.edit', a.market)) A.modal(assetForm(a)); };
  A.CH['asset-loc'] = el => {
    const d = locDraft(), k = el.dataset.k;
    if (LOC_KEYS.indexOf(k) === -1) return;
    d[LOC_FIELD[k]] = el.value || '';
    // Đổi cấp trên → xóa lựa chọn cấp dưới (đổi phạm vi vẫn giữ Khối/Nhà đã chọn).
    LOC_KEYS.slice(LOC_KEYS.indexOf(k) + 1).forEach(x => { if (!(k === 'type' && x === 'building')) d[LOC_FIELD[x]] = ''; });
    const box = A.$('#asset-loc-fields'); if (box) box.innerHTML = locFieldsHtml();
  };
  A.ACT['asset-save'] = el => {
    const existing = asset(el.dataset.id), action = existing ? 'tai-san.edit' : 'tai-san.create';
    if (!A.canDo(action, 'CL')) return;
    const code = inputValue('asset-code').toUpperCase(), name = inputValue('asset-name');
    if (!code || !name) { U.toast('Vui lòng nhập mã và tên tài sản.'); return; }
    const d = locDraft();
    if (d.market !== (existing ? existing.market : 'CL')) { U.toast('Vị trí đã chọn không thuộc chợ của tài sản.'); return; }
    const loc = locationFromDraft(d);
    if (loc.error) { U.toast(loc.error); return; }
    if (MANAGED_STATUSES.indexOf(inputValue('asset-status')) === -1) { U.toast('Trạng thái tài sản không hợp lệ. "Có sự cố" được xác định tự động từ sự cố đang mở.'); return; }
    if (assets().some(a => a.code.toUpperCase() === code && a.id !== (existing && existing.id))) { U.toast('Mã tài sản đã tồn tại.'); return; }
    const now = U.today(), target = existing || { id: nextId(), market:'CL', createdAt:now, maintenanceHistory:[], images:[] };
    // Vị trí mới chỉ lưu tham chiếu; bỏ locationLabel cũ để không còn 2 nguồn vị trí.
    if (!loc.keepLegacy) { target.locationType = loc.type; target.locationId = loc.id; delete target.locationLabel; }
    Object.assign(target, { code, name, category:inputValue('asset-category'), installedAt:inputValue('asset-installed'), status:inputValue('asset-status'), maintenanceDueDate:inputValue('asset-due') || null, description:inputValue('asset-description'), note:inputValue('asset-note'), updatedAt:now });
    if (!existing) A.db.marketAssets.push(target);
    ui.assetLocDraft = null;
    A.save(); A.closeModal(); A.render(); U.toast(existing ? 'Đã cập nhật tài sản.' : 'Đã thêm tài sản.');
  };
  // Helper đọc vị trí dùng chung (read-only) cho module khác cần hiển thị vị trí tài sản.
  (A.features.assets || (A.features.assets = {})).resolveLocation = resolveLocation;
})(window.APP);

/* Điều hành – "Mặt bằng & điểm kinh doanh" (route #/mat-bang, screen permission 'mat-bang' DUY NHẤT).
 * v16: đọc/ghi graph mặt bằng DUY NHẤT trong A.db qua features/market-layout/store.js:
 *   Chợ → Khối/Nhà chợ (buildings) → Tầng (floors, TUỲ CHỌN) → Dãy (rows: 1 ngành hàng, allocatedArea)
 *   → Điểm kinh doanh (stalls). Mọi thay đổi cấu trúc đi qua command của store rồi A.save().
 * Bố cục (workspace thiết kế mặt bằng, xây dần — không còn wizard nhiều bước): header (tình trạng tại ngày
 * + chip trạng thái) · thanh ngân sách diện tích của chợ · 3 vùng: cây "Cấu trúc mặt bằng" (Chợ → Khối/Nhà
 * → Tầng? → Dãy, menu ⋮ theo node) | sơ đồ logic của node đang chọn (Sơ đồ | Danh sách dùng CHUNG phạm vi
 * node) | inspector thông tin & thiết lập. Thêm/sửa từng đối tượng qua modal nhỏ, lưu ngay (A.save()).
 * Rule diện tích theo cấp nằm ở store (S.budget, *Errors). Không lưu số liệu dẫn xuất nào.
 * State UI (không persist): ui.mb.sel = null | {k:'building'|'floor'|'row', id}, ui.mb.view,
 * ui.mb.filter, ui.mb.collapsed, ui.mb.menu (menu ⋮ đang mở), ui.mb.treeOpen (mobile). */
(function (A) {
  'use strict';
  const D = A.D, U = A.U, ui = A.ui;
  const S = A.features.marketLayout.store;
  const BP = () => A.features.businessPoints.service;
  const MS = () => A.features.markets && A.features.markets.service;
  const { CATS, save: saveLayout, blocksOf, floorsOfBlock, firstFloorKey, firstZonePlace, findZone } = S;
  const fmt = n => Number(n || 0).toLocaleString('vi-VN', { maximumFractionDigits: 2 });
  const m2 = n => fmt(n) + ' m²';

  if (!ui.qh) ui.qh = { market: 'CL', selZone: null };
  function qhMarket() { return ui.market === 'ALL' ? ui.qh.market : ui.market; }
  if (!ui.mb) ui.mb = { sel: null, collapsed: {}, treeOpen: false, mode: 'overview', inspectorOpen: false, treeSearch: '', pointId: null, zoom: 1 };
  if (!ui.mb.collapsed) ui.mb.collapsed = {};
  if (!ui.mb.view) ui.mb.view = 'grid';
  if (!ui.mb.filter) ui.mb.filter = { search: '', status: '', cat: '', areaType: '' };
  if (!ui.mb.mode) ui.mb.mode = 'overview';
  if (ui.mb.inspectorOpen === undefined) ui.mb.inspectorOpen = false;
  if (ui.mb.treeSearch === undefined) ui.mb.treeSearch = '';
  if (!ui.mb.zoom) ui.mb.zoom = 1;

  // ---------- dữ liệu cấu trúc (đọc thẳng graph A.db qua store) ----------
  const floorsOfB = (mid, bid) => S.floorsOf(mid).filter(f => f.buildingId === bid);
  const rowsOfF = (mid, fid) => S.rowsOf(mid).filter(r => r.floorId === fid);
  const looseRowsOfB = (mid, bid) => S.rowsOf(mid).filter(r => r.buildingId === bid && !r.floorId);
  const rowsOfB = (mid, bid) => S.rowsOf(mid).filter(r => r.buildingId === bid);
  const pointsOfRows = rows => rows.reduce((acc, r) => acc.concat(S.pointsOfRow(r.id)), []);
  function rowInfo(r) {
    const pts = S.pointsOfRow(r.id), used = U.sum(pts, st => Number(st.area) || 0), alloc = Number(r.allocatedArea) || 0;
    return { pts, used, alloc, remaining: alloc - used };
  }
  function buildingInfo(mid, b) {
    const floors = floorsOfB(mid, b.id), rows = rowsOfB(mid, b.id);
    return { floors, rows, loose: looseRowsOfB(mid, b.id), pts: pointsOfRows(rows) };
  }

  // ---------- selection model ----------
  // Chấp nhận key cũ ('block'/'zone') từ state/liên kết trước đó rồi chuẩn hoá về building/row.
  const LEGACY_SEL = { block: 'building', zone: 'row' };
  function selNode(mid) {
    const sel = ui.mb.sel;
    if (!sel) return { k: 'overview' };
    const k = LEGACY_SEL[sel.k] || sel.k;
    if (k === 'building') { const b = S.buildingsOf(mid).find(x => x.id === sel.id); if (b) return { k, b }; }
    if (k === 'floor') { const f = S.floorsOf(mid).find(x => x.id === sel.id); if (f) return { k, f, b: A.idx.building.get(f.buildingId) }; }
    if (k === 'row') { const r = S.rowsOf(mid).find(x => x.id === sel.id); if (r) return { k, r, f: r.floorId ? A.idx.floor.get(r.floorId) : null, b: A.idx.building.get(r.buildingId) }; }
    ui.mb.sel = null; // node đã bị xoá / đổi chợ → về Tổng quan
    return { k: 'overview' };
  }
  function select(k, id) {
    ui.mb.sel = k === 'overview' ? null : { k, id };
    ui.mb.pointId = null;
    ui.mb.mode = k === 'overview' ? 'overview' : 'branch';
    ui.mb.inspectorOpen = k !== 'overview';
    ui.mb.menu = null; ui.page.dkcl = 0; A.render();
  }
  const isSel = (mid, k, id) => { const n = selNode(mid); return n.k === k && (k === 'overview' || (n[k === 'building' ? 'b' : k === 'floor' ? 'f' : 'r'] || {}).id === id); };

  // ---- API dùng chung cho Sơ đồ/Bảng (business-points/page.js): phạm vi node đang chọn → điểm thật ----
  A.mbSelectedStalls = function (mid) {
    const n = selNode(mid), all = A.mbBusinessPointsForMarket(mid);
    if (n.k === 'row') return all.filter(st => st.rowId === n.r.id);
    const rowIds = n.k === 'floor' ? new Set(rowsOfF(mid, n.f.id).map(r => r.id)) : n.k === 'building' ? new Set(rowsOfB(mid, n.b.id).map(r => r.id)) : null;
    return rowIds ? all.filter(st => rowIds.has(st.rowId)) : all;
  };
  A.mbSelectedLevel = function () { return selNode(qhMarket()).k; };
  // Cột bảng theo phạm vi: đã chọn Dãy thì không lặp lại vị trí/ngành hàng.
  A.mbPositionColumnVisibility = function () {
    const level = A.mbSelectedLevel();
    return { level, location: level !== 'row', industry: level !== 'row' };
  };
  A.mbLayoutPathForPoint = function (mid, st) {
    const loc = BP().location(st);
    return { khu: loc.khu, tang: loc.tang, day: loc.day };
  };
  // Vị trí gọn theo phạm vi đang xem: bỏ các cấp đã nằm trong breadcrumb.
  A.mbPointLocationLabel = function (st, level) {
    const loc = BP().location(st), parts = [];
    if (level === 'overview' && loc.building) parts.push(loc.building.name);
    if ((level === 'overview' || level === 'building') && loc.floor) parts.push(loc.floor.name);
    if (loc.row) parts.push('Dãy ' + loc.row.code);
    return parts.join(' › ') || '—';
  };
  // Bộ lọc dùng chung — chip trạng thái áp dụng cả Sơ đồ lẫn Bảng; tìm kiếm/ngành hàng/loại diện tích
  // chỉ hiển thị & áp dụng ở chế độ Bảng.
  A.mbMatchesFilter = function (st) {
    const flt = ui.mb.filter;
    if (flt.status && A.mbStatusAt(st) !== flt.status) return false;
    if (ui.mb.view !== 'table') return true;
    if (flt.cat && st.cat !== flt.cat) return false;
    if (flt.areaType && st.areaTypeId !== flt.areaType) return false;
    const q = (flt.search || '').trim().toLowerCase();
    if (q) {
      // The visible/searchable trader is date-aware occupancy data, never a
      // field persisted on the Point. This keeps the table aligned with the
      // “Tình trạng tại ngày” control and with future/ended contracts.
      const t = A.mbOccupantAt ? A.mbOccupantAt(st) : null;
      if (!st.code.toLowerCase().includes(q) && !(t && t.name.toLowerCase().includes(q))) return false;
    }
    return true;
  };
  // The List tab is a market-wide operational list. Tree selection only
  // controls the map drill-down; otherwise an imported point in another Row
  // could raise the market KPI but be invisible to an exact code search.
  A.mbCurrentPoints = function (mid) {
    const points = ui.mb.view === 'table' ? A.mbBusinessPointsForMarket(mid) : A.mbSelectedStalls(mid);
    return points.filter(A.mbMatchesFilter);
  };
  // Ngành hàng của các Dãy trong chợ (nguồn: row.industry).
  A.mbCatOptions = function (mid) { return Array.from(new Set(S.rowsOf(mid).map(r => r.industry).filter(Boolean))).sort((a, b) => a.localeCompare(b, 'vi')); };
  function mbCan(mid) { return { edit: A.canDo('cau-truc.edit', mid), del: A.canDo('cau-truc.delete', mid), reset: A.canDo('cau-truc.reset', mid) }; }

  // ---------- menu ⋮ ----------
  // Mỗi node có đúng các thao tác hợp lệ với hierarchy; item chạy qua 'mb-menu-run' (đóng menu rồi
  // gọi action gốc). Đóng khi click ra ngoài hoặc ESC.
  function menuItems(mid, kind, node) {
    const can = mbCan(mid), items = [];
    if (kind === 'building') {
      const hasFloors = floorsOfB(mid, node.id).length > 0, hasLoose = looseRowsOfB(mid, node.id).length > 0;
      if (can.edit && (hasFloors || !hasLoose)) items.push({ label: 'Thêm tầng', run: 'qh-add-floor', data: { block: node.id } });
      if (can.edit && !hasFloors) items.push({ label: 'Thêm Dãy', run: 'qh-add-zone', data: { block: node.id, floor: S.NO_FLOOR + node.id } });
      if (can.edit) items.push({ label: 'Chỉnh sửa Khối/Nhà', run: 'qh-edit-block', data: { id: node.id } });
      if (can.del) items.push({ label: 'Ngừng khai thác', run: 'qh-del-block', data: { id: node.id }, danger: true });
    } else if (kind === 'floor') {
      if (can.edit) items.push({ label: 'Thêm Dãy', run: 'qh-add-zone', data: { block: node.buildingId, floor: node.id } });
      if (can.edit) items.push({ label: 'Chỉnh sửa Tầng', run: 'qh-edit-floor', data: { block: node.buildingId, id: node.id } });
      if (can.del) items.push({ label: 'Ngừng sử dụng', run: 'qh-del-floor', data: { block: node.buildingId, id: node.id }, danger: true });
    } else if (kind === 'row') {
      if (can.edit) items.push({ label: 'Thêm điểm kinh doanh', run: 'mb-add-point', data: { id: node.id } });
      if (can.edit) items.push({ label: 'Chỉnh sửa Dãy', run: 'qh-zone-edit-open', data: { id: node.id } });
      if (can.del) items.push({ label: 'Ngừng khai thác', run: 'qh-del-zone', data: { id: node.id }, danger: true });
    }
    return items;
  }
  function menuHtml(items) {
    return `<div class="mb-menu" role="menu">${items.map(i => `<button class="mb-menu-item ${i.danger ? 'danger' : ''}" role="menuitem" data-act="mb-menu-run" data-run="${i.run}" ${Object.keys(i.data).map(k => `data-${k}="${U.esc(i.data[k])}"`).join(' ')}>${U.esc(i.label)}</button>`).join('')}</div>`;
  }
  function kebabHtml(menuKey, items, label) {
    if (!items.length) return '';
    const open = ui.mb.menu === menuKey;
    return `<div class="mb-kebab-wrap"><button class="mb-kebab ${open ? 'on' : ''}" data-act="mb-menu" data-id="${U.esc(menuKey)}" aria-haspopup="menu" aria-expanded="${open}" aria-label="Thao tác: ${U.esc(label)}" title="Thao tác">⋮</button>${open ? menuHtml(items) : ''}</div>`;
  }

  // ---------- cây "Cấu trúc chợ" ----------
  function treeNode(mid, kind, node, depth, title, sub, collapseKey) {
    const active = isSel(mid, kind, node.id);
    const caret = collapseKey
      ? `<button class="mb-caret" data-act="mb-toggle-node" data-key="${collapseKey}" aria-label="${ui.mb.collapsed[collapseKey] ? 'Mở rộng' : 'Thu gọn'} ${U.esc(title)}" aria-expanded="${!ui.mb.collapsed[collapseKey]}">${ui.mb.collapsed[collapseKey] ? '▸' : '▾'}</button>`
      : '<span class="mb-caret-sp"></span>';
    return `<div class="mb-tnode mb-tnode-${kind} ${active ? 'on' : ''}" style="--d:${depth}">${caret}
      <button class="mb-tlabel" data-act="mb-sel-${kind}" data-id="${node.id}" ${active ? 'aria-current="true"' : ''}><span class="mb-tname">${U.esc(title)}</span>${sub ? `<span class="mb-tsub">${U.esc(sub)}</span>` : ''}</button>
      ${kebabHtml(kind + ':' + node.id, menuItems(mid, kind, node), title)}</div>`;
  }
  // Tree tới cấp Dãy (không hiển thị điểm); mỗi node kèm diện tích được phân bổ.
  const areaSub = v => v == null || v === '' ? 'Chưa khai báo DT' : m2(v);
  const rowNodeHtml = (mid, r, depth) => treeNode(mid, 'row', r, depth, r.name || 'Dãy ' + r.code, r.code + ' · ' + (r.industry || 'Chưa có ngành hàng') + ' · ' + m2(r.allocatedArea));
  function mbTreeHtml(mid) {
    const mk = MS() && MS().get(mid);
    const q = String(ui.mb.treeSearch || '').trim().toLocaleLowerCase('vi-VN');
    const matches = value => !q || String(value || '').toLocaleLowerCase('vi-VN').includes(q);
    const overview = `<div class="mb-tnode mb-tnode-overview ${isSel(mid, 'overview') ? 'on' : ''}" style="--d:0"><button class="mb-tlabel" data-act="mb-sel-overview" ${isSel(mid, 'overview') ? 'aria-current="true"' : ''}><span class="mb-tname">${U.esc(U.market(mid).name)}</span><span class="mb-tsub">${areaSub(mk ? mk.businessArea : null)}</span></button></div>`;
    const bs = S.buildingsOf(mid);
    if (!bs.length) return overview + '<div class="mb-tree-empty">Chưa có cấu trúc mặt bằng.</div>';
    const result = bs.map(b => {
      const floors = floorsOfB(mid, b.id), loose = looseRowsOfB(mid, b.id), bKey = 'b:' + b.id;
      const floorNodes = floors.map(f => {
        const fKey = 'f:' + f.id, rows = rowsOfF(mid, f.id).filter(r => matches(r.name + ' ' + r.code + ' ' + r.industry));
        if (q && !matches(f.name + ' ' + f.code) && !rows.length) return '';
        return treeNode(mid, 'floor', f, 1, f.name, areaSub(f.businessArea), rows.length ? fKey : null) + (rows.length && !ui.mb.collapsed[fKey] ? rows.map(r => rowNodeHtml(mid, r, 2)).join('') : '');
      }).join('');
      const looseNodes = loose.filter(r => matches(r.name + ' ' + r.code + ' ' + r.industry)).map(r => rowNodeHtml(mid, r, 1)).join('');
      if (q && !matches(b.name + ' ' + b.code) && !floorNodes && !looseNodes) return '';
      const kids = floorNodes + looseNodes;
      return `<div class="mb-tbranch">${treeNode(mid, 'building', b, 0, b.name, areaSub(b.businessArea), floors.length || loose.length ? bKey : null)}${ui.mb.collapsed[bKey] ? '' : kids}</div>`;
    }).join('');
    return overview + (result || '<div class="mb-tree-empty">Không tìm thấy Khối/Nhà, Tầng hoặc Dãy phù hợp.</div>');
  }

  // ---------- breadcrumb ----------
  function crumbHtml(mid, n) {
    const segs = [{ label: U.market(mid).name, act: 'mb-sel-overview' }];
    if (n.b) segs.push({ label: n.b.name, act: 'mb-sel-building', id: n.b.id });
    if (n.f) segs.push({ label: n.f.name, act: 'mb-sel-floor', id: n.f.id });
    if (n.r) segs.push({ label: 'Dãy ' + n.r.code });
    return `<nav class="mb-crumb" aria-label="Vị trí">${segs.map((s, i) => i === segs.length - 1
      ? `<span class="mb-crumb-cur">${U.esc(s.label)}</span>`
      : `<button class="mb-crumb-link" data-act="${s.act}" ${s.id ? `data-id="${s.id}"` : ''}>${U.esc(s.label)}</button><span class="mb-crumb-sep">/</span>`).join('')}</nav>`;
  }
  function viewSwitcherHtml() {
    return `<div class="seg"><button class="${ui.mb.view === 'grid' ? 'on' : ''}" data-act="mb-view" data-id="grid">▦ Sơ đồ</button><button class="${ui.mb.view === 'table' ? 'on' : ''}" data-act="mb-view" data-id="table">☰ Danh sách</button></div>`;
  }

  // ---------- khối trình bày dùng chung ----------
  const tile = (label, value, sub, cls) => `<div class="mb-stat ${cls || ''}"><div class="mb-stat-l">${label}</div><div class="mb-stat-v">${value}</div>${sub ? `<div class="mb-stat-s">${sub}</div>` : ''}</div>`;
  function statusBreakdown(points) {
    const c = A.mbStatusCounts(points);
    const parts = A.features.businessPoints.service.DISPLAY_STATUSES.filter(k => c[k]).map(k => `<span class="mb-sb"><i style="background:${D.STATUS[k].color}"></i>${c[k]} ${U.esc(A.mbStatusLabel(k).toLowerCase())}</span>`);
    return parts.length ? `<div class="mb-sbs">${parts.join('')}</div>` : '';
  }
  function wsHead(title, sub, actions) {
    return `<div class="mb-ws-head"><div><h3>${U.esc(title)}</h3>${sub ? `<div class="mb-ws-sub">${sub}</div>` : ''}</div>${actions ? `<div class="mb-ws-actions">${actions}</div>` : ''}</div>`;
  }
  // Chợ đã có bất kỳ Khối/Tầng/Dãy/điểm nào (đọc graph A.db qua store).
  const hasLayout = mid => S.initialSetup.graphExists(mid);
  // Vòng đời dùng chung: mặt bằng đã thiết lập nhưng chợ chưa đủ điều kiện hoạt động → nhắc cấu hình biểu phí.
  const LAYOUT_DONE_MSG = 'Đã hoàn tất thiết lập mặt bằng.';
  const PENDING_FEE_MSG = 'Chợ chưa được chuyển sang trạng thái Đang hoạt động. Cần hoàn tất cấu hình mức thu và biểu phí.';
  const FEE_WARNING_MSG = 'Chợ đang hoạt động nhưng cần cập nhật cấu hình mức thu.';
  function lifecycleNoteHtml(mid) {
    const lc = A.features.markets.service.lifecycle(mid);
    if (lc && lc.feeConfigWarning) return `<div class="note mb-lifecycle-note"><b>${FEE_WARNING_MSG}</b> ${U.esc(lc.feeGap)}</div>`;
    return lc && lc.stage === 'PENDING_FEE' ? `<div class="note info mb-lifecycle-note"><b>${LAYOUT_DONE_MSG}</b> ${PENDING_FEE_MSG}</div>` : '';
  }
  function marketStatusSummaryHtml(mid) {
    const lc = A.features.markets.service.lifecycle(mid);
    const fee = A.features.lifecycle.service.marketFeeStatus(mid);
    if (!lc || !fee) return '';
    const layout = lc.layoutReady ? 'Đã thiết lập' : 'Chưa thiết lập';
    const market = lc.status === 'ACTIVE' ? 'Đang hoạt động' : 'Chưa hoạt động';
    const warning = lc.feeConfigWarning ? '<span class="mb-status-warning">Cần cập nhật mức thu/biểu phí</span>' : '';
    return `<div class="mb-status-summary"><span>Tình trạng mặt bằng: <b>${layout}</b></span><span>Trạng thái cấu hình mức thu: <b>${U.esc(fee.label)}</b></span><span>Trạng thái chợ: <b>${market}</b></span><span>Bước hiện tại: <b>${U.esc(lc.hint || lc.label)}</b></span>${warning}</div>`;
  }
  const areaTxt = v => v == null || v === '' ? 'Chưa khai báo' : m2(v);
  const rowTitle = r => r.name || 'Dãy ' + r.code;

  // ---------- ngân sách diện tích (Chợ → Khối/Nhà → Tầng → Dãy → Điểm; số liệu từ S.budget) ----------
  // b = { total, allocated, remaining }; total null = cấp này chưa khai báo diện tích (dữ liệu cũ).
  const meterNum = (label, value, cls) => `<div class="mb-meter-n ${cls || ''}"><span>${label}</span><b>${value}</b></div>`;
  function meterHtml(b, what) {
    const overBy = b.total == null ? 0 : b.allocated - b.total, isOver = overBy > 1e-9;
    const pct = b.total == null ? 0 : b.total > 0 ? Math.min(100, b.allocated / b.total * 100) : (b.allocated > 0 ? 100 : 0);
    return `<div class="mb-meter">
      <div class="mb-meter-nums">${meterNum(what.total, areaTxt(b.total))}${meterNum(what.allocated, m2(b.allocated))}${meterNum('Còn lại', b.total == null ? '—' : isOver ? 'Vượt ' + m2(overBy) : m2(b.remaining), isOver ? 'over' : '')}</div>
      ${b.total == null ? '' : `<div class="mb-meter-bar ${isOver ? 'over' : ''}" role="progressbar" aria-label="${U.esc(what.allocated)}" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${Math.round(pct)}"><i style="width:${pct.toFixed(1)}%"></i></div>`}
    </div>`;
  }
  function budgetBarHtml(mid) {
    const b = S.budget.market(mid);
    const notes = [
      b.total == null ? 'Chợ chưa khai báo diện tích phục vụ kinh doanh trong Danh mục chợ — chưa kiểm tra được giới hạn cấp chợ.' : '',
      b.unsetChildren ? fmt(b.unsetChildren) + ' Khối/Nhà chưa khai báo diện tích phân bổ.' : ''
    ].filter(Boolean).map(x => `<div class="small muted">${U.esc(x)}</div>`).join('');
    return `<div class="card mb-budget"><div class="card-b"><div class="mb-budget-title">Thiết lập mặt bằng: <b>${U.esc(U.market(mid).name)}</b></div>
      ${meterHtml(b, { total: 'Diện tích phục vụ kinh doanh', allocated: 'Đã phân bổ' })}${notes}</div></div>`;
  }

  // ---------- CENTER: sơ đồ logic theo node đang chọn (không phải CAD: không toạ độ, không kéo thả) ----------
  const addTile = (act, label, data) => `<button class="mb-add-tile" data-act="${act}" ${data || ''}>+ ${label}</button>`;
  // Guard hierarchy hiện có: Khối có Tầng thì Dãy phải thuộc Tầng; Khối có Dãy trực tiếp thì không thêm Tầng.
  const canAddFloor = (mid, b) => floorsOfB(mid, b.id).length > 0 || !looseRowsOfB(mid, b.id).length;
  const canAddLooseRow = (mid, b) => !floorsOfB(mid, b.id).length;
  function rowTileHtml(r) {
    const i = rowInfo(r);
    const preview = i.pts.slice(0, 12).map(st => `<button class="mb-mini-point s-${A.mbStatusAt(st)}" data-act="stall" data-id="${st.id}" title="${U.esc(st.code)}">${U.esc(st.code)}</button>`).join('');
    return `<section class="mb-rowtile mb-map-node"><button class="mb-rowtile-open" data-act="mb-sel-row" data-id="${r.id}"><b>${U.esc(rowTitle(r))}</b><span class="mb-rowtile-code">${U.esc(r.code)} · ${U.esc(r.industry || 'Chưa có ngành hàng')}</span><span class="mb-rowtile-meta"><span>${m2(i.alloc)}</span><span>${fmt(i.pts.length)} điểm</span></span></button>${preview ? `<div class="mb-mini-grid">${preview}${i.pts.length > 12 ? `<span class="mb-mini-more">+${i.pts.length - 12}</span>` : ''}</div>` : '<div class="mb-mini-empty">Chưa có điểm KD</div>'}</section>`;
  }
  function emptyMarketHtml(mid, can) {
    const m = MS() && MS().get(mid);
    return `<div class="card"><div class="card-b mb-empty"><h3>Chợ chưa có cấu trúc mặt bằng.</h3>
      <p>Diện tích phục vụ kinh doanh: <b>${areaTxt(m ? m.businessArea : null)}</b></p>
      <p class="small muted">Xây dần cấu trúc: Khối/Nhà → Tầng (nếu có) → Dãy → điểm kinh doanh. Mỗi đối tượng được lưu ngay khi thêm.</p>
      ${can.edit ? '<div class="mb-empty-actions"><button class="btn primary" data-act="qh-add-block">+ Thêm Khối/Nhà đầu tiên</button></div>' : ''}</div></div>`;
  }
  // Cấp Chợ: mỗi Khối/Nhà là một khối, liệt kê Tầng (hoặc Dãy nếu không chia tầng) kèm diện tích.
  function marketDiagramHtml(mid, can) {
    const blocks = S.buildingsOf(mid).map(b => {
      const floors = floorsOfB(mid, b.id);
      const groups = floors.length ? floors.map(f => ({ name:f.name, pts:pointsOfRows(rowsOfF(mid,f.id)) })) : [{ name:'Dãy', pts:pointsOfRows(looseRowsOfB(mid,b.id)) }];
      const count = groups.reduce((n,g)=>n + g.pts.length,0);
      const preview = groups.map(g => `<div class="mb-block-floor-preview"><span>${U.esc(g.name)}</span><div class="mb-mini-grid">${g.pts.slice(0,24).map(st => `<button class="mb-mini-point s-${A.mbStatusAt(st)}" data-act="stall" data-id="${st.id}" title="${U.esc(st.code)} · ${m2(st.area)} · ${U.esc(A.mbStatusLabel(A.mbStatusAt(st)))}"> </button>`).join('')}${g.pts.length > 24 ? `<span class="mb-mini-more">+${g.pts.length - 24}</span>` : ''}</div></div>`).join('');
      return `<section class="mb-block"><button class="mb-block-h" data-act="mb-sel-building" data-id="${b.id}"><span class="mb-kind">Khối/Nhà${b.code ? ' · ' + U.esc(b.code) : ''}</span><b>${U.esc(b.name)}</b><span class="mb-block-area">${areaTxt(b.businessArea)} · ${fmt(count)} điểm</span></button>${preview || '<span class="muted">Chưa có điểm KD</span>'}</section>`;
    }).join('');
    return wsHead('Sơ đồ mặt bằng', U.esc(U.market(mid).name)) + `<div class="mb-floorplan-label">ĐƯỜNG PHÍA BẮC · LỐI ĐI TRUNG TÂM · CỔNG CHÍNH</div><div class="mb-blocks">${blocks}</div>`;
  }
  // Cấp Khối/Nhà: các Tầng (mỗi tầng liệt kê Dãy) hoặc các Dãy trực tiếp nếu không chia tầng.
  function buildingDiagramHtml(mid, n, can) {
    const b = n.b, floors = floorsOfB(mid, b.id);
    const head = wsHead(b.name, `${b.code ? U.esc(b.code) + ' · ' : ''}${areaTxt(b.businessArea)}`);
    if (floors.length) {
      const blocks = floors.map(f => {
        const rows = rowsOfF(mid, f.id);
        return `<div class="mb-block mb-block-floor"><button class="mb-block-h" data-act="mb-sel-floor" data-id="${f.id}"><span class="mb-kind">Tầng${f.code ? ' · ' + U.esc(f.code) : ''}</span><b>${U.esc(f.name)}</b><span class="mb-block-area">${areaTxt(f.businessArea)}</span></button>
          <div class="mb-rowtiles">${rows.map(rowTileHtml).join('') || '<span class="muted">Chưa có Dãy</span>'}</div></div>`;
      }).join('');
      return head + `<div class="mb-blocks">${blocks}${can.edit ? addTile('qh-add-floor', 'Thêm tầng', `data-block="${b.id}"`) : ''}</div>`;
    }
    const rows = looseRowsOfB(mid, b.id);
    const adds = !can.edit ? '' : (canAddFloor(mid, b) ? addTile('qh-add-floor', 'Thêm tầng', `data-block="${b.id}"`) : '') + addTile('qh-add-zone', 'Thêm Dãy', `data-block="${b.id}" data-floor="${S.NO_FLOOR + b.id}"`);
    return head + (rows.length ? '<div class="small muted mb-ws-note">Không chia tầng — Dãy thuộc trực tiếp Khối/Nhà.</div>' : '') + `<div class="mb-rowtiles">${rows.map(rowTileHtml).join('')}${adds}</div>`;
  }
  // Cấp Tầng: ngân sách tầng + các Dãy.
  function floorDiagramHtml(mid, n, can) {
    const f = n.f, rows = rowsOfF(mid, f.id);
    return wsHead(f.name, U.esc([n.b && n.b.name, f.code].filter(Boolean).join(' · ')))
      + meterHtml(S.budget.floor(f), { total: 'Diện tích tầng', allocated: 'Đã phân bổ cho Dãy' })
      + `<div class="mb-rowtiles">${rows.map(rowTileHtml).join('')}${can.edit ? addTile('qh-add-zone', 'Thêm Dãy', `data-block="${f.buildingId}" data-floor="${f.id}"`) : ''}</div>`;
  }
  // Cấp Dãy: các điểm kinh doanh (mã, diện tích, tình trạng).
  function rowDiagramHtml(mid, n) {
    const r = n.r, i = rowInfo(r);
    return wsHead(rowTitle(r), `${U.esc(r.code)} · ${U.esc(r.industry || 'Chưa có ngành hàng')} · ${m2(i.alloc)}`)
      + statusBreakdown(i.pts) + `<div class="plan">${A.mbCellsHtml(i.pts, { detail: true })}</div>`;
  }
  function mbCenterHtml(mid) {
    const can = mbCan(mid);
    const n = selNode(mid);
    const legend = `<div class="mb-map-legend">${A.features.businessPoints.service.DISPLAY_STATUSES.map(k => `<span><i style="background:${D.STATUS[k].color}"></i>${U.esc(A.mbStatusLabel(k))}</span>`).join('')}</div>`;
    const controls = `<div class="mb-map-controls"><button class="btn sm" data-act="mb-zoom" data-step="-0.1" title="Thu nhỏ">−</button><button class="btn sm" data-act="mb-zoom" data-step="0.1" title="Phóng to">+</button><button class="btn sm" data-act="mb-zoom-reset">100%</button><button class="btn sm" data-act="mb-zoom-fit">Fit</button><button class="btn sm" data-act="mb-fullscreen">⛶</button></div>`;
    const bar = `<div class="mb-map-top"><div>${crumbHtml(mid, n)}${legend}</div>${controls}</div>`;
    if (!hasLayout(mid)) return bar + emptyMarketHtml(mid, can);
    const body = n.k === 'row' ? rowDiagramHtml(mid, n) : n.k === 'floor' ? floorDiagramHtml(mid, n, can) : n.k === 'building' ? buildingDiagramHtml(mid, n, can) : marketDiagramHtml(mid, can);
    return bar + `<div class="mb-map-canvas"><div class="mb-map-content" style="--mb-zoom:${ui.mb.zoom}">${body}</div></div>`;
  }

  // ---------- INSPECTOR: thông tin & thiết lập của node đang chọn (chỉ xem ở đây, sửa qua modal nhỏ) ----------
  const kv = rows => `<dl class="mb-kv">${rows.map(r => `<dt>${r[0]}</dt><dd>${r[1]}</dd>`).join('')}</dl>`;
  const inspBtn = (act, label, data, cls) => `<button class="btn sm ${cls || ''}" data-act="${act}" ${data || ''}>${label}</button>`;
  function areaTypesHtml(mid) {
    const names = S.allowedAreaTypes(mid).map(k => `<span class="tag">${U.esc(U.areaTypeLabel(k))}</span>`).join('');
    return `<div class="mb-insp-sec"><h4>Loại diện tích áp dụng</h4><div class="mb-chips">${names}</div>${S.areaTypesConfigured(mid) ? '' : '<div class="small muted">Chợ chưa cấu hình loại diện tích áp dụng trong Danh mục chợ — tạm cho phép tất cả loại.</div>'}</div>`;
  }
  // Nhóm điểm hiện có của Dãy theo (loại diện tích, diện tích/điểm): "Có mái che · 2 × 5 m² = 10 m²".
  function pointGroupsHtml(pts) {
    const groups = [];
    pts.forEach(st => {
      const area = Number(st.area) || 0, g = groups.find(x => x.type === st.areaTypeId && x.area === area);
      if (g) g.count++; else groups.push({ type: st.areaTypeId, area, count: 1 });
    });
    return groups.length ? `<ul class="mb-groups">${groups.map(g => `<li><span>${U.esc(U.areaTypeLabel(g.type) || 'Chưa phân loại')}</span><span>${fmt(g.count)} × ${m2(g.area)} = <b>${m2(g.count * g.area)}</b></span></li>`).join('')}</ul>` : '<div class="small muted">Dãy chưa có điểm kinh doanh.</div>';
  }
  function inspectorHtml(mid) {
    const can = mbCan(mid), n = selNode(mid), acts = [];
    let title, body;
    if (ui.mb.pointId) {
      const st = A.idx.stall.get(ui.mb.pointId);
      if (st && st.market === mid) {
        const loc = BP().location(st), occupant = A.mbOccupantAt(st), contract = A.features.businessPoints.service.contractOn(st.id, A.mbStatusDate());
        title = 'Chi tiết điểm kinh doanh';
        body = kv([['Mã điểm', U.esc(st.code)], ['Trạng thái', A.mbStatusTag(A.mbStatusAt(st))], ['Vị trí', U.esc(loc.label)], ['Diện tích', m2(st.area)], ['Loại diện tích', U.esc(U.areaTypeLabel(st.areaTypeId) || '—')], ['Ngành hàng', U.esc(BP().industry(st) || '—')], ['Tiểu thương', occupant ? U.esc(occupant.name) : '—'], ['Hợp đồng', contract ? U.esc(contract.id) : '—']]);
        if (occupant && U.can('tieu-thuong')) acts.push(inspBtn('mb-open-trader', 'Xem hồ sơ', `data-id="${occupant.id}"`));
        if (contract && U.can('hop-dong')) acts.push(inspBtn('go', 'Xem hợp đồng', 'data-to="hop-dong"'));
      } else ui.mb.pointId = null;
    }
    if (!title && n.k === 'building') {
      const b = n.b, i = buildingInfo(mid, b), bb = S.budget.building(b);
      title = 'Khối/Nhà chợ';
      body = kv([['Tên', U.esc(b.name)], ['Mã', U.esc(b.code || '—')], ['Mô hình', i.floors.length ? fmt(i.floors.length) + ' tầng' : i.loose.length ? 'Không chia tầng' : 'Chưa có tầng/Dãy'], ['Số Dãy', fmt(i.rows.length)], ['Số điểm', fmt(i.pts.length)]])
        + meterHtml(bb, { total: 'Diện tích Khối/Nhà', allocated: bb.childKind === 'floor' ? 'Đã phân bổ cho Tầng' : 'Đã phân bổ cho Dãy' });
      if (can.edit) {
        acts.push(inspBtn('qh-edit-block', 'Chỉnh sửa', `data-id="${b.id}"`));
        if (canAddFloor(mid, b)) acts.push(inspBtn('qh-add-floor', '+ Thêm tầng', `data-block="${b.id}"`, 'primary'));
        if (canAddLooseRow(mid, b)) acts.push(inspBtn('qh-add-zone', '+ Thêm Dãy', `data-block="${b.id}" data-floor="${S.NO_FLOOR + b.id}"`, i.floors.length ? '' : 'primary'));
      }
      if (can.del) acts.push(inspBtn('qh-del-block', 'Ngừng khai thác', `data-id="${b.id}"`, 'danger'));
    } else if (!title && n.k === 'floor') {
      const f = n.f, rows = rowsOfF(mid, f.id);
      title = 'Tầng';
      body = kv([['Tên', U.esc(f.name)], ['Mã', U.esc(f.code || '—')], ['Khối/Nhà', U.esc(n.b ? n.b.name : '—')], ['Số Dãy', fmt(rows.length)], ['Số điểm', fmt(pointsOfRows(rows).length)]])
        + meterHtml(S.budget.floor(f), { total: 'Diện tích tầng', allocated: 'Đã phân bổ cho Dãy' });
      if (can.edit) acts.push(inspBtn('qh-edit-floor', 'Chỉnh sửa', `data-block="${f.buildingId}" data-id="${f.id}"`), inspBtn('qh-add-zone', '+ Thêm Dãy', `data-block="${f.buildingId}" data-floor="${f.id}"`, 'primary'));
      if (can.del) acts.push(inspBtn('qh-del-floor', 'Ngừng sử dụng', `data-block="${f.buildingId}" data-id="${f.id}"`, 'danger'));
    } else if (!title && n.k === 'row') {
      const r = n.r, i = rowInfo(r);
      title = 'Dãy';
      body = kv([['Nhà', U.esc(n.b ? n.b.name : '—')], ['Tầng', U.esc(n.f ? n.f.name : 'Không chia tầng')], ['Ngành hàng', U.esc(r.industry || '—')], ['Tên Dãy', U.esc(rowTitle(r))], ['Mã Dãy', U.esc(r.code)]])
        + meterHtml(S.budget.row(r), { total: 'Diện tích phân bổ', allocated: 'Đã sử dụng' })
        + `<div class="mb-insp-sec"><h4>Các điểm kinh doanh trong Dãy</h4><div class="small muted">${fmt(i.pts.length)} điểm · ${m2(i.used)}</div>${pointGroupsHtml(i.pts)}${can.edit ? inspBtn('mb-add-point', '+ Thêm nhóm điểm', `data-id="${r.id}"`, 'primary') : ''}</div>`;
      if (can.edit) acts.push(inspBtn('qh-zone-edit-open', 'Chỉnh sửa Dãy', `data-id="${r.id}"`));
      if (can.del) acts.push(inspBtn('qh-del-zone', 'Ngừng khai thác', `data-id="${r.id}"`, 'danger'));
    } else if (!title) {
      const m = MS() && MS().get(mid);
      title = 'Chợ';
      body = kv([['Chợ', U.esc(U.market(mid).name)], ['Diện tích phục vụ KD', areaTxt(m ? m.businessArea : null)], ['Khối/Nhà', fmt(S.buildingsOf(mid).length)], ['Tầng', fmt(S.floorsOf(mid).length)], ['Dãy', fmt(S.rowsOf(mid).length)], ['Điểm kinh doanh', fmt(A.mbBusinessPointsForMarket(mid).length)]])
        + areaTypesHtml(mid);
      if (can.edit && hasLayout(mid)) acts.push(inspBtn('qh-add-block', '+ Thêm Khối/Nhà', '', 'primary'));
    }
    return `<aside class="card mb-insp" aria-label="Thông tin và thiết lập"><div class="card-h"><h3>${title}</h3><span class="spacer"></span><button class="x" data-act="mb-inspector-close" aria-label="Đóng panel thông tin">×</button></div><div class="card-b">${body}${acts.length ? `<div class="mb-insp-actions">${acts.join('')}</div>` : ''}</div></aside>`;
  }

  // ---------- drawer "Sửa dãy" ----------
  // Sửa trực tiếp Dãy (A.db.rows) qua S.updateRow — mỗi thay đổi được kiểm tra ngay (mã duy nhất, đúng
  // 1 ngành hàng, diện tích phân bổ >= tổng diện tích điểm, tổng dãy trên tầng <= diện tích tầng).
  function qhZoneDrawerHtml(mid, z) {
    const can = mbCan(mid), dis = can.edit ? '' : 'disabled';
    const blocks = blocksOf(mid), floors = floorsOfBlock(mid, z.blockId).filter(f => !f.virtual);
    const pts = S.pointsOfRow(z.key);
    const used = U.sum(pts, st => Number(st.area) || 0);
    const byType = U.KNOWN_AREA_TYPE_CODES.map(k => ({ k, list: pts.filter(st => st.areaTypeId === k) })).filter(x => x.list.length);
    return `<div class="drawer-h"><div><h3>Sửa Dãy</h3><div class="small muted" style="margin-top:2px">${U.esc(z.code || '')} · ${U.esc(z.catMain || '')}</div></div><span class="spacer"></span><button class="x" data-act="close" aria-label="Đóng">×</button></div>
      <div class="drawer-b">
      <div class="form-grid">
        <div class="field"><label>Mã Dãy *</label><input class="input" ${dis} data-ch="qh-zone-field" data-zone="${z.key}" data-k="code" value="${U.esc(z.code || '')}"></div>
        <div class="field"><label>Tên Dãy *</label><input class="input" ${dis} data-ch="qh-zone-field" data-zone="${z.key}" data-k="name" value="${U.esc(z.name || '')}"></div>
        <div class="field"><label>Thuộc Khối/Nhà chợ</label><select class="input" ${dis} data-ch="qh-zone-field" data-zone="${z.key}" data-k="blockId">${blocks.map(b => `<option value="${b.key}" ${b.key === z.blockId ? 'selected' : ''}>${U.esc(b.name)}</option>`).join('')}</select></div>
        ${floors.length ? `<div class="field"><label>Tầng</label><select class="input" ${dis} data-ch="qh-zone-field" data-zone="${z.key}" data-k="floorId">${floors.map(f => `<option value="${f.key}" ${f.key === z.floorId ? 'selected' : ''}>${U.esc(f.name)}</option>`).join('')}</select></div>` : '<div class="field"><label>Tầng</label><div class="dke-readonly">Không chia tầng</div></div>'}
        <div class="field"><label>Ngành hàng *</label><select class="input" ${dis} data-ch="qh-zone-field" data-zone="${z.key}" data-k="industry">${CATS.map(c => `<option ${c === z.catMain ? 'selected' : ''}>${U.esc(c)}</option>`).join('')}</select></div>
        <div class="field"><label>Diện tích phân bổ (m²) *</label><input class="input" ${dis} type="number" min="0" data-ch="qh-zone-field" data-zone="${z.key}" data-k="area" value="${z.area || 0}"></div>
      </div>
      <div class="field" style="margin-top:10px"><label>Ghi chú</label><textarea class="input" ${dis} rows="2" data-ch="qh-zone-field" data-zone="${z.key}" data-k="note">${U.esc(z.note || '')}</textarea></div>
      <div class="divider"></div>
      <h4 style="margin:0;font-size:var(--font-size-base);font-weight:600">Điểm kinh doanh trong Dãy</h4>
      <div class="small muted" style="margin:4px 0 8px">Mọi điểm trong Dãy kế thừa ngành hàng của Dãy; mỗi điểm có loại diện tích riêng.</div>
      <div>${U.table([{ t: 'Loại diện tích' }, { t: 'Số điểm', num: true }, { t: 'Diện tích (m²)', num: true }],
        byType.map(x => `<tr><td>${U.esc(U.areaTypeLabel(x.k))}</td><td class="num">${x.list.length}</td><td class="num">${fmt(U.sum(x.list, st => Number(st.area) || 0))}</td></tr>`), { empty: 'Dãy chưa có điểm kinh doanh' })}</div>
      <div class="row" style="padding:8px 2px;font-weight:600"><span>Tổng cộng</span><span class="spacer"></span><span>${fmt(pts.length)} điểm · ${fmt(used)} / ${m2(z.area || 0)} phân bổ</span></div>
      </div>
      <div class="drawer-f"><span class="spacer"></span><button class="btn" data-act="close">Đóng</button></div>`;
  }
  function qhOpenZoneDrawer(mid, zk) {
    const z = findZone(mid, zk);
    if (!z) return;
    ui.qh.selZone = zk; ui.mb.sel = { k: 'row', id: zk }; ui.mb.menu = null;
    A.render();
    A.$('#modal-root').innerHTML = `<div class="drawer-overlay" data-act="close"></div><div class="drawer">${qhZoneDrawerHtml(mid, z)}</div>`;
  }
  // Vẽ lại drawer đang mở sau mỗi thay đổi field để luôn khớp dữ liệu mới nhất.
  function qhSyncDrawer() {
    if (!ui.qh.selZone || !document.querySelector('.drawer')) return;
    const mid = qhMarket(), z = findZone(mid, ui.qh.selZone);
    if (!z) { A.closeModal(); return; }
    A.$('#modal-root').innerHTML = `<div class="drawer-overlay" data-act="close"></div><div class="drawer">${qhZoneDrawerHtml(mid, z)}</div>`;
  }

  // ---------- trang ----------
  function layoutToolbarHtml(mid, can) {
    const n = selNode(mid), editable = can.edit;
    const importGuard = A.features.marketLayout.importer && A.features.marketLayout.importer.canOpen(mid);
    const button = (act, label, enabled, data) => `<button class="btn sm ${enabled ? '' : 'is-disabled'}" data-act="${act}" ${data || ''} ${enabled ? '' : 'disabled'} title="${enabled ? label : 'Chọn đúng cấp cấu trúc để thao tác'}">${label}</button>`;
    return `<div class="mb-toolbar"><div class="mb-toolbar-actions">
      ${button('qh-add-block', '+ Khối/Nhà', editable && n.k === 'overview')}
      ${button('qh-add-floor', '+ Tầng', editable && n.k === 'building', n.k === 'building' ? `data-block="${n.b.id}"` : '')}
      ${button('qh-add-zone', '+ Dãy', editable && n.k === 'floor', n.k === 'floor' ? `data-block="${n.f.buildingId}" data-floor="${n.f.id}"` : '')}
      ${button('mb-add-point', '+ Điểm KD', editable && n.k === 'row', n.k === 'row' ? `data-id="${n.r.id}"` : '')}
      <button class="btn sm ${importGuard && importGuard.ok ? '' : 'is-disabled'}" data-act="mb-import-open" ${importGuard && importGuard.ok ? '' : 'disabled'} title="${U.esc(importGuard && !importGuard.ok ? importGuard.error : 'Nhập điểm KD từ Excel')}">Nhập điểm KD từ Excel</button>
      <span class="spacer"></span>${button('mb-complete-layout', 'Hoàn tất mặt bằng', editable && MS().layoutGraphReady(mid))}
    </div></div>`;
  }
  function marketKpisHtml(mid) {
    const m = MS().get(mid), b = S.budget.market(mid), stats = A.mbMarketStats(mid);
    const kpi = (label, value, sub) => `<div class="mb-market-kpi"><span>${label}</span><b>${value}</b>${sub ? `<small>${sub}</small>` : ''}</div>`;
    return `<div class="mb-market-kpis">${kpi('Tổng diện tích chợ', areaTxt(m && m.totalArea))}${kpi('Diện tích phục vụ KD', areaTxt(m && m.businessArea))}${kpi('Đã phân bổ', m2(b.allocated))}${kpi('Còn lại', b.remaining == null ? '—' : m2(b.remaining))}${kpi('Tổng điểm KD', fmt(stats.total))}${kpi('Tỷ lệ lấp đầy', U.pctTxt(stats.occPct))}</div>`;
  }
  function mbWorkspaceHtml() {
    const mid = qhMarket(), can = mbCan(mid), m = U.market(mid), open = !!ui.mb.treeOpen;
    const stats = A.mbMarketStats(mid);
    const flt = ui.mb.filter;
    const c = k => stats.byStatus[k] || 0;
    // Chip trạng thái (bấm để lọc): Tổng điểm = điểm của chợ; Đang thuê/Còn trống theo hợp đồng;
    // Tạm ngưng/Tranh chấp theo trạng thái vận hành — tất cả suy ra, không lưu. Không có "Nợ phí".
    const chip = (k, label, extra) => `<button class="mb-chip ${k ? 'mb-chip-' + k : 'mb-chip-total'} ${flt.status === (k || '') ? 'on' : ''}" data-act="mb-filter-status" data-id="${k || ''}">${k ? `<i style="background:${D.STATUS[k].color}"></i>` : ''}<b>${extra != null ? extra : c(k)}</b>${label}</button>`;
    const summary = chip(null, 'Tổng điểm', stats.total) + A.features.businessPoints.service.DISPLAY_STATUSES.map(k => chip(k, A.mbStatusLabel(k))).join('');
    const layout = hasLayout(mid);
    const addBtn = layout && can.edit ? '<button class="btn sm primary" data-act="qh-add-block">+ Khối/Nhà</button>' : '';
    const resetBtn = can.reset && layout && !stats.total ? `<button class="btn sm mb-more" data-act="qh-reset" title="Xóa toàn bộ cấu trúc (chợ chưa có điểm kinh doanh)" aria-label="Xóa toàn bộ cấu trúc">⋯</button>` : '';
    const tabs = `<div class="seg mb-primary-tabs"><button class="${ui.mb.view === 'grid' ? 'on' : ''}" data-act="mb-view" data-id="grid">Sơ đồ mặt bằng</button><button class="${ui.mb.view === 'table' ? 'on' : ''}" data-act="mb-view" data-id="table">Danh sách điểm kinh doanh</button></div>`;
    const tree = `<aside class="mb-tree-card" aria-label="Cấu trúc chợ"><div class="mb-pane-title"><h3>Cấu trúc chợ</h3>${resetBtn}</div><input class="input mb-tree-search" data-in="mb-tree-search" value="${U.esc(ui.mb.treeSearch)}" placeholder="Tìm Khối/Nhà, Tầng, Dãy..." aria-label="Tìm cấu trúc chợ"><div class="mb-tree" role="tree">${mbTreeHtml(mid)}</div></aside>`;
    const chrome = `${tabs}${layoutToolbarHtml(mid, can)}${marketStatusSummaryHtml(mid)}${marketKpisHtml(mid)}`;
    if (ui.mb.view === 'table') return `<section class="mb-redesign">${chrome}<div class="mb-list-workspace">${A.dkTableHtml ? A.dkTableHtml(mid) : ''}</div></section>`;
    return `<section class="mb-redesign">${chrome}<div class="mb-map-shell">${tree}<main class="mb-ws">${mbCenterHtml(mid)}</main>${ui.mb.inspectorOpen ? inspectorHtml(mid) : ''}</div></section>`;
  }

  // ---------- đóng menu ⋮: click ra ngoài / ESC ----------
  if (typeof document !== 'undefined' && document.addEventListener) {
    document.addEventListener('click', e => {
      if (!ui.mb.menu || !e.target || !e.target.closest || e.target.closest('.mb-kebab-wrap')) return;
      ui.mb.menu = null; A.render();
    });
    document.addEventListener('keydown', e => { if (e.key === 'Escape' && ui.mb.menu) { ui.mb.menu = null; A.render(); } });
  }

  // ---------- modal nhỏ: thêm/sửa MỘT đối tượng; lưu xong đối tượng hiện ngay trên tree + sơ đồ ----------
  // Mọi rule diện tích nằm ở store (S.addBuilding/updateBuilding/addFloor/updateFloor/addRow/updateRow,
  // S.pointGroups); modal chỉ hiển thị ngân sách của cấp cha và báo lỗi store trả về.
  const numField = (id, label, value, extra) => `<div class="field"><label for="${id}">${label}</label><div class="mb-num"><input class="input" id="${id}" type="number" min="0" step="any" value="${value == null ? '' : U.esc(String(value))}" ${extra || ''}><span>m²</span></div></div>`;
  const formErr = () => '<div class="mb-form-err" id="mb-form-err" role="alert"></div>';
  function showFormErr(msgs) { const el = A.$('#mb-form-err'); if (el) el.innerHTML = msgs.map(U.esc).join('<br>'); U.toast(msgs[0]); }
  const val = id => { const el = A.$('#' + id); return el && el.value != null ? String(el.value).trim() : ''; };
  // Ngân sách cấp cha trừ phần của chính đối tượng đang sửa (để "Còn lại" đúng khi chỉnh sửa).
  const without = (b, own) => b.total == null ? Object.assign({}, b, { allocated: b.allocated - own }) : { total: b.total, allocated: b.allocated - own, remaining: b.total - (b.allocated - own) };
  const ctxHtml = (title, b, what) => `<div class="mb-form-ctx"><div class="mb-form-ctx-t">${title}</div>${meterHtml(b, what)}</div>`;
  const requireArea = (raw, label) => raw === '' ? 'Vui lòng nhập ' + label + '.' : !(Number(raw) > 0) ? label.charAt(0).toUpperCase() + label.slice(1) + ' phải lớn hơn 0.' : '';

  function blockModal(mid, b) {
    const mb = S.budget.market(mid), ctx = without(mb, b ? Number(b.businessArea) || 0 : 0);
    A.modal(A.mHead(b ? 'Chỉnh sửa Khối/Nhà chợ' : 'Thêm Khối/Nhà chợ') + `<div class="modal-b"><div class="form-grid">
      <div class="field"><label for="qhb-name">Tên Khối/Nhà *</label><input class="input" id="qhb-name" value="${U.esc(b ? b.name : '')}" placeholder="VD: Nhà A"></div>
      <div class="field"><label for="qhb-code">Mã *</label><input class="input" id="qhb-code" value="${U.esc(b ? b.code || '' : S.nextBuildingCode(mid))}"></div>
      ${numField('qhb-area', 'Diện tích kinh doanh phân bổ *', b ? b.businessArea : null)}</div>
      ${ctxHtml('Diện tích chợ còn có thể phân bổ', ctx, { total: 'Diện tích phục vụ kinh doanh', allocated: 'Đã phân bổ cho Khối/Nhà khác' })}${formErr()}</div>
      <div class="modal-f"><button class="btn" data-act="close">Hủy</button><button class="btn primary" data-act="${b ? 'qh-edit-block-save' : 'qh-add-block-save'}" ${b ? `data-id="${b.id}"` : ''}>${b ? 'Lưu' : 'Thêm'}</button></div>`);
  }
  function readBlockForm() {
    const f = { name: val('qhb-name'), code: val('qhb-code'), businessArea: val('qhb-area') }, errs = [];
    if (!f.name) errs.push('Vui lòng nhập tên Khối/Nhà chợ.');
    if (!f.code) errs.push('Vui lòng nhập mã Khối/Nhà.');
    const a = requireArea(f.businessArea, 'diện tích kinh doanh phân bổ cho Khối/Nhà'); if (a) errs.push(a);
    return { f, errs };
  }
  function floorModal(mid, bid, f) {
    const b = A.idx.building.get(bid); if (!b) return;
    const ctx = without(S.budget.building(b), f ? Number(f.businessArea) || 0 : 0);
    A.modal(A.mHead(f ? 'Chỉnh sửa tầng' : 'Thêm tầng') + `<div class="modal-b"><div class="form-grid">
      <div class="field"><label for="qhf-name">Tên tầng *</label><input class="input" id="qhf-name" value="${U.esc(f ? f.name : '')}" placeholder="VD: Tầng 1"></div>
      <div class="field"><label for="qhf-code">Mã tầng</label><input class="input" id="qhf-code" value="${U.esc(f ? f.code || '' : S.nextFloorCode(bid))}"></div>
      ${numField('qhf-area', 'Diện tích kinh doanh của tầng *', f ? f.businessArea : null)}</div>
      ${ctxHtml('Nhà: ' + U.esc(b.name), ctx, { total: 'Diện tích Nhà', allocated: 'Đã phân bổ' })}${formErr()}</div>
      <div class="modal-f"><button class="btn" data-act="close">Hủy</button><button class="btn primary" data-act="${f ? 'qh-edit-floor-save' : 'qh-add-floor-save'}" data-block="${bid}" ${f ? `data-id="${f.id}"` : ''}>${f ? 'Lưu' : 'Thêm'}</button></div>`);
  }
  function readFloorForm() {
    const f = { name: val('qhf-name'), code: val('qhf-code'), businessArea: val('qhf-area') }, errs = [];
    if (!f.name) errs.push('Vui lòng nhập tên tầng.');
    const a = requireArea(f.businessArea, 'diện tích kinh doanh của tầng'); if (a) errs.push(a);
    return { f, errs };
  }

  // "Thêm Dãy" — đúng thứ tự: 1. Ngành hàng → 2. Tên Dãy (gợi ý, sửa được) → 3. Mã Dãy (tự sinh bằng
  // S.nextRowCode, chỉ đọc, không dùng lại khoảng trống) → 4. Diện tích phân bổ. Tên đã sửa tay thì đổi
  // ngành hàng không ghi đè.
  function setZoneIndustry(d, industry) {
    const oldSuggestion = S.suggestRowName(d.industry, d.code);
    d.industry = industry || '';
    d.code = S.nextRowCode(d.mid, d.industry);
    if (!d.nameDirty || !d.name || d.name === oldSuggestion) { d.name = S.suggestRowName(d.industry, d.code); d.nameDirty = false; }
  }
  function readZoneName(d) {
    const e = A.$('#qhz-name');
    if (!e || e.value == null || !d.industry) return;
    d.name = String(e.value).trim(); d.nameDirty = d.name !== S.suggestRowName(d.industry, d.code);
  }
  const isRealFloor = fk => !!fk && String(fk).indexOf(S.NO_FLOOR) !== 0;
  function zoneParentBudget(place) {
    if (isRealFloor(place.floorId)) { const f = A.idx.floor.get(place.floorId); return f ? { title: 'Tầng: ' + f.name, b: S.budget.floor(f), total: 'Diện tích tầng' } : null; }
    const b = A.idx.building.get(place.blockId);
    return b ? { title: 'Khối/Nhà: ' + b.name + ' (không chia tầng)', b: S.budget.building(b), total: 'Diện tích Khối/Nhà' } : null;
  }
  function renderAddZone() {
    const d = ui.mb.zoneDraft; if (!d) return;
    const p = zoneParentBudget(d.place);
    A.modal(A.mHead('Thêm Dãy') + `<div class="modal-b"><div class="form-grid">
      <div class="field"><label for="qhz-industry">1. Ngành hàng *</label><select class="input" id="qhz-industry" data-ch="qhz-industry"><option value="">— Chọn ngành hàng —</option>${CATS.map(c => `<option ${c === d.industry ? 'selected' : ''}>${U.esc(c)}</option>`).join('')}</select></div>
      <div class="field"><label for="qhz-name">2. Tên Dãy *</label><input class="input" id="qhz-name" data-in="qhz-name" placeholder="${d.industry ? 'VD: ' + U.esc(S.suggestRowName(d.industry, d.code)) : 'Chọn ngành hàng trước'}" value="${U.esc(d.name)}" ${d.industry ? '' : 'disabled'}></div>
      <div class="field"><label for="qhz-code">3. Mã Dãy</label><input class="input" id="qhz-code" value="${U.esc(d.code)}" placeholder="—" readonly aria-readonly="true" tabindex="-1"><div class="small muted" style="margin-top:4px">Tự động tạo theo ngành hàng và các Dãy hiện có.</div></div>
      ${numField('qhz-area', '4. Diện tích phân bổ cho Dãy *', d.area, 'data-in="qhz-area"')}</div>
      ${p ? ctxHtml(U.esc(p.title), p.b, { total: p.total, allocated: 'Đã phân bổ' }) : ''}
      <div class="small muted" style="margin-top:8px">Mỗi Dãy có đúng 1 ngành hàng; điểm kinh doanh trong Dãy kế thừa ngành hàng này.</div>${formErr()}</div>
      <div class="modal-f"><button class="btn" data-act="close">Hủy</button><button class="btn primary" data-act="qh-add-zone-save">Thêm</button></div>`);
  }
  A.CH['qhz-industry'] = el => { const d = ui.mb.zoneDraft; if (!d) return; readZoneName(d); d.area = val('qhz-area'); setZoneIndustry(d, el.value); renderAddZone(); };
  A.IN['qhz-name'] = el => { const d = ui.mb.zoneDraft; if (!d) return; d.name = String(el.value || '').trim(); d.nameDirty = d.name !== S.suggestRowName(d.industry, d.code); };
  A.IN['qhz-area'] = el => { const d = ui.mb.zoneDraft; if (d) d.area = String(el.value || '').trim(); };
  const infoModal = (title, body) => A.modal(A.mHead(U.esc(title)) + `<div class="modal-b">${body}</div><div class="modal-f"><button class="btn primary" data-act="close">Đã hiểu</button></div>`);

  // "Thêm nhóm điểm" cho MỘT Dãy: quantity × areaPerPoint theo nhóm; loại diện tích chỉ lấy từ các loại chợ
  // áp dụng (S.allowedAreaTypes). Validation/preview/commit đi qua S.pointGroups (một engine duy nhất).
  const pointDraft = () => ui.mb.pointDraft;
  const groupArea = g => (Number(g.quantity) || 0) * (Number(g.areaPerPoint) || 0);
  function pointAddSummary(d, result, info) {
    const count = d.groups.reduce((s, g) => s + (Number(g.quantity) || 0), 0);
    return { count, text: `Tổng: ${fmt(count)} điểm · ${m2(result.addedArea)} · còn có thể bố trí ${m2(Math.max(0, info.remaining))}` };
  }
  function renderPointAdd() {
    const d = pointDraft(); if (!d) return;
    const r = A.idx.row.get(d.rowId), mid = d.marketId; if (!r) return;
    const info = rowInfo(r), result = S.pointGroups.validate(mid, r.id, d.groups), types = S.allowedAreaTypes(mid);
    const groups = d.groups || [], sum = pointAddSummary(d, result, info);
    const rows = groups.map(g => `<tr class="mb-point-group"><td data-label="Loại diện tích"><select class="input" data-ch="mb-point-field" data-id="${g.id}" data-key="areaTypeId">${types.map(k => `<option value="${k}" ${k === g.areaTypeId ? 'selected' : ''}>${U.esc(U.areaTypeLabel(k))}</option>`).join('')}</select></td><td data-label="Số lượng điểm"><input class="input" type="number" min="1" step="1" data-in="mb-point-field" data-ch="mb-point-field" data-id="${g.id}" data-key="quantity" value="${U.esc(String(g.quantity || ''))}"></td><td data-label="Diện tích mỗi điểm"><input class="input" type="number" min="0" data-in="mb-point-field" data-ch="mb-point-field" data-id="${g.id}" data-key="areaPerPoint" value="${U.esc(String(g.areaPerPoint || ''))}"></td><td data-label="Tổng diện tích" id="mb-pg-total-${g.id}">${m2(groupArea(g))}</td><td class="mb-point-remove"><button class="btn sm danger" data-act="mb-point-group-remove" data-id="${g.id}">Xóa</button></td></tr><tr class="mb-point-preview"><td colspan="5" class="small muted">Preview: ${(result.pointCodes[g.id] || []).map(U.esc).join(', ') || '—'}</td></tr>`).join('');
    const exhausted = info.remaining <= 1e-9;
    const body = exhausted ? `<div class="modal-b"><div class="note info"><b>Dãy ${U.esc(r.code)} đã sử dụng hết diện tích được phân bổ.</b><div>${fmt(info.used)} / ${fmt(info.alloc)} m²</div></div></div><div class="modal-f"><button class="btn" data-act="close">Đóng</button><button class="btn primary" data-act="qh-zone-edit-open" data-id="${r.id}">Điều chỉnh diện tích Dãy</button></div>`
      : `<div class="modal-b mb-point-add"><div class="mb-point-context"><b>Dãy ${U.esc(r.code)} · ${U.esc(r.industry)}</b><div class="small muted">Ngành hàng được kế thừa từ Dãy và không thể thay đổi tại đây.</div></div>
        ${meterHtml(S.budget.row(r), { total: 'Diện tích phân bổ', allocated: 'Đã bố trí' })}
        ${S.areaTypesConfigured(mid) ? '' : '<div class="note info" style="margin-top:12px">Chợ chưa cấu hình loại diện tích áp dụng trong Danh mục chợ — tạm hiển thị tất cả loại.</div>'}
        <div class="tbl-wrap" style="margin-top:12px"><table class="tbl mb-point-table"><thead><tr><th>Loại diện tích *</th><th>Số lượng điểm *</th><th>Diện tích mỗi điểm (m²) *</th><th>Tổng diện tích</th><th></th></tr></thead><tbody>${rows}</tbody></table></div>
        <button class="btn sm" data-act="mb-point-group-add">+ Thêm nhóm</button>
        <div class="mb-pg-sum" id="mb-pg-sum">${sum.text}</div>
        <div class="note danger" id="mb-pg-err" style="margin-top:12px" ${result.errors.length ? '' : 'hidden'}>${result.errors.map(x => `<div>${U.esc(x)}</div>`).join('')}</div></div>
      <div class="modal-f"><button class="btn" data-act="mb-point-cancel">Hủy</button><span class="spacer"></span><button class="btn primary" id="mb-pg-commit" data-act="mb-point-commit" ${result.ok && sum.count ? '' : 'disabled'}>Tạo ${fmt(sum.count)} điểm</button></div>`;
    A.modal(A.mHead('Thêm nhóm điểm kinh doanh') + body);
  }
  // Cập nhật tại chỗ khi gõ số lượng / diện tích (không vẽ lại modal để giữ con trỏ).
  function syncPointAdd() {
    const d = pointDraft(), r = d && A.idx.row.get(d.rowId); if (!r) return;
    const result = S.pointGroups.validate(d.marketId, r.id, d.groups), sum = pointAddSummary(d, result, rowInfo(r));
    d.groups.forEach(g => { const el = A.$('#mb-pg-total-' + g.id); if (el) el.textContent = m2(groupArea(g)); });
    const s = A.$('#mb-pg-sum'); if (s) s.textContent = sum.text;
    const e = A.$('#mb-pg-err'); if (e) { e.innerHTML = result.errors.map(x => `<div>${U.esc(x)}</div>`).join(''); e.hidden = !result.errors.length; }
    const c = A.$('#mb-pg-commit'); if (c) { c.disabled = !(result.ok && sum.count); c.textContent = 'Tạo ' + fmt(sum.count) + ' điểm'; }
  }
  function importModal(mid) {
    const p = ui.mb.importPreview;
    if (!p) return A.modal(A.mHead('Nhập điểm kinh doanh từ Excel') + `<div class="modal-b mb-import"><p>Chỉ nhập điểm vào Khối/Nhà, Tầng và Dãy đã có của <b>${U.esc(U.market(mid).name)}</b>.</p><div class="row"><button class="btn" data-act="mb-import-template">Tải file mẫu</button><button class="btn primary" data-act="mb-import-file">Chọn file .xlsx</button></div><p class="small muted">Sheet bắt buộc: DiemKinhDoanh. Hệ thống kiểm tra toàn bộ batch trước khi ghi dữ liệu.</p></div><div class="modal-f"><button class="btn" data-act="close">Đóng</button></div>`);
    const rows = p.rows.map(x => `<tr class="${x.errors.length ? 'mb-import-bad' : ''}"><td>${x.line}</td><td>${U.esc(x.code || '—')}</td><td>${U.esc(x.rowId ? A.idx.row.get(x.rowId).code : '—')}</td><td>${x.area > 0 ? m2(x.area) : '—'}</td><td>${U.esc(U.areaTypeLabel(x.areaTypeId) || '—')}</td><td>${U.esc(x.industry || '—')}</td><td>${x.errors.length ? `<span class="mb-import-error">${U.esc(x.errors.join(' '))}</span>` : '<span class="ok">✓ Hợp lệ</span>'}</td></tr>`).join('');
    return A.modal(A.mHead('Kiểm tra dữ liệu nhập') + `<div class="modal-b mb-import"><div class="mb-import-stats">Tổng dòng: <b>${p.rows.length}</b> · Hợp lệ: <b>${p.valid}</b> · Lỗi: <b>${p.errors}</b> · DT sẽ thêm: <b>${m2(p.totalArea)}</b></div><div class="tbl-wrap"><table class="tbl"><thead><tr><th>STT</th><th>Mã điểm</th><th>Dãy</th><th>Diện tích</th><th>Loại diện tích</th><th>Ngành hàng</th><th>Kết quả</th></tr></thead><tbody>${rows}</tbody></table></div></div><div class="modal-f"><button class="btn" data-act="mb-import-open">Chọn file khác</button><span class="spacer"></span><button class="btn" data-act="close">Hủy</button><button class="btn primary" data-act="mb-import-commit" ${p.errors ? 'disabled' : ''}>Nhập dữ liệu</button></div>`);
  }
  Object.assign(A.ACT, {
    'mb-sel-overview': () => select('overview'),
    'mb-sel-building': el => select('building', el.dataset.id),
    'mb-sel-floor': el => select('floor', el.dataset.id),
    'mb-sel-row': el => select('row', el.dataset.id),
    // Tên action cũ (liên kết/test trước v16).
    'mb-sel-block': el => select('building', el.dataset.id),
    'mb-sel-zone': el => select('row', el.dataset.id),
    'mb-toggle-node': el => { const k = el.dataset.key; ui.mb.collapsed[k] = !ui.mb.collapsed[k]; A.render(); },
    'mb-toggle-tree': () => { ui.mb.treeOpen = !ui.mb.treeOpen; A.render(); },
    'mb-menu': el => { ui.mb.menu = ui.mb.menu === el.dataset.id ? null : el.dataset.id; A.render(); },
    'mb-menu-run': el => { const fn = A.ACT[el.dataset.run]; ui.mb.menu = null; A.render(); if (fn) fn(el); },
    // Chuyển Sơ đồ/Bảng — chỉ đổi ui.mb.view, giữ nguyên node đang chọn và bộ lọc.
    'mb-view': el => { ui.mb.view = el.dataset.id === 'table' ? 'table' : 'grid'; A.render(); },
    'mb-zoom': el => { ui.mb.zoom = Math.max(0.7, Math.min(1.5, Number(ui.mb.zoom || 1) + Number(el.dataset.step || 0))); A.render(); },
    'mb-zoom-reset': () => { ui.mb.zoom = 1; A.render(); },
    'mb-zoom-fit': () => { ui.mb.zoom = 1; A.render(); },
    'mb-fullscreen': el => { const map = el.closest && el.closest('.mb-map-shell'); if (map && map.requestFullscreen) map.requestFullscreen(); },
    'mb-mode': el => { ui.mb.mode = el.dataset.id === 'branch' && ui.mb.sel ? 'branch' : 'overview'; if (ui.mb.mode === 'overview') ui.mb.sel = null; A.render(); },
    'mb-inspector-close': () => { ui.mb.inspectorOpen = false; ui.mb.pointId = null; A.render(); },
    'mb-complete-layout': () => {
      const mid = qhMarket();
      if (!A.canDo('cau-truc.edit', mid) || !MS().layoutGraphReady(mid)) return U.toast('Mặt bằng chưa đủ điều kiện hoàn tất. Cần có Khối/Nhà, Dãy và Điểm kinh doanh hợp lệ.');
      const out = A.features.lifecycle.service.completeMarketLayout(mid, A.currentAccount().fullName || 'Người dùng');
      if (!out) return U.toast('Không thể hoàn tất thiết lập mặt bằng.');
      A.save(); A.render();
      U.toast('Đã hoàn tất thiết lập mặt bằng. Chợ cần hoàn tất cấu hình mức thu trước khi chuyển sang Đang hoạt động.');
    },
    'mb-import-open': () => { const mid = qhMarket(), guard = A.features.marketLayout.importer.canOpen(mid); if (!guard.ok) return U.toast(guard.error); ui.mb.importPreview = null; ui.mb.importRowId = selNode(mid).k === 'row' ? selNode(mid).r.id : null; importModal(mid); },
    'mb-import-template': () => { const mid = qhMarket(); if (A.canDo('cau-truc.edit', mid)) A.features.marketLayout.importer.template(); },
    'mb-import-file': () => {
      const mid = qhMarket(), guard = A.features.marketLayout.importer.canOpen(mid); if (!guard.ok) return U.toast(guard.error);
      const input = document.createElement('input'); input.type = 'file'; input.accept = '.xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'; input.style.display = 'none'; document.body.appendChild(input);
      input.onchange = () => A.features.marketLayout.importer.read(input.files && input.files[0], (data, error) => { input.remove(); if (error) return U.toast(error); ui.mb.importPreview = A.features.marketLayout.importer.validate(mid, data); importModal(mid); }); input.click();
    },
    'mb-import-commit': () => { const mid = qhMarket(), out = A.features.marketLayout.importer.commit(mid, ui.mb.importPreview); if (!out.ok) return U.toast(out.errors[0]); const rows = new Set(out.stalls.map(x => x.rowId)).size; ui.mb.importPreview = null; A.closeModal(); A.render(); U.toast('Đã nhập ' + out.stalls.length + ' điểm kinh doanh vào ' + rows + ' Dãy.'); },
    'mb-filter-status': el => { const k = el.dataset.id || ''; ui.mb.filter.status = A.features.businessPoints.service.DISPLAY_STATUSES.includes(k) ? k : ''; A.render(); },
    'mb-filter-clear': () => { ui.mb.filter = { search: '', status: '', cat: '', areaType: '' }; A.render(); },
    'mb-add-point': el => {
      const mid = qhMarket(), r = A.idx.row.get(el.dataset.id);
      if (!r || r.market !== mid || !A.canDo('cau-truc.edit', mid)) return;
      ui.mb.pointDraft = { marketId: mid, rowId: r.id, groups: [{ id: 'tmp-point-group-1', areaTypeId: S.allowedAreaTypes(mid)[0], quantity: 1, areaPerPoint: '' }], seq: 2 };
      renderPointAdd();
    },
    'mb-point-group-add': () => { const d = pointDraft(); if (!d) return; d.groups.push({ id: 'tmp-point-group-' + d.seq++, areaTypeId: S.allowedAreaTypes(d.marketId)[0], quantity: 1, areaPerPoint: '' }); renderPointAdd(); },
    'mb-point-group-remove': el => { const d = pointDraft(); if (!d) return; d.groups = d.groups.filter(g => g.id !== el.dataset.id); renderPointAdd(); },
    'mb-point-cancel': () => { ui.mb.pointDraft = null; A.closeModal(); },
    'mb-point-commit': () => {
      const d = pointDraft(); if (!d || !A.canDo('cau-truc.edit', d.marketId)) return;
      const before = A.features.markets.service.lifecycle(d.marketId);
      const out = S.pointGroups.commit(d.marketId, d.rowId, d.groups);
      if (!out.ok) { renderPointAdd(); U.toast(out.errors[0]); return; }
      const code = A.idx.row.get(d.rowId).code; ui.mb.pointDraft = null; A.closeModal(); A.render(); U.toast(`Đã tạo ${out.stalls.length} điểm kinh doanh tại Dãy ${code}.`);
      // Lần đầu mặt bằng chuyển sang "Đã thiết lập": báo rõ chợ chưa hoạt động nếu còn chờ biểu phí.
      const after = A.features.markets.service.lifecycle(d.marketId);
      if (before && after && !before.layoutReady && after.layoutReady) U.toast(after.stage === 'ACTIVE' ? LAYOUT_DONE_MSG + ' Chợ đã đủ điều kiện và chuyển sang Đang hoạt động.' : LAYOUT_DONE_MSG + ' ' + PENDING_FEE_MSG);
    },
    'qh-zone-edit-open': el => { if (findZone(qhMarket(), el.dataset.id)) qhOpenZoneDrawer(qhMarket(), el.dataset.id); },
    'qh-reset': () => {
      if (!A.canDo('cau-truc.reset', qhMarket())) return;
      A.modal(A.mHead('Xóa cấu trúc mặt bằng') + `<div class="modal-b">Toàn bộ Khối/Nhà, Tầng, Dãy đã khai báo cho <b>${U.esc(U.market(qhMarket()).name)}</b> sẽ bị xóa. Chỉ thực hiện được khi chợ chưa có điểm kinh doanh nào.</div>
        <div class="modal-f"><button class="btn" data-act="close">Hủy</button><button class="btn danger" data-act="qh-reset-ok">Xóa cấu trúc</button></div>`);
    },
    'qh-reset-ok': () => {
      const mid = qhMarket();
      if (!A.canDo('cau-truc.reset', mid)) return;
      if (!S.resetMarket(mid)) { A.closeModal(); U.toast('Không thể xóa cấu trúc vì chợ đã có điểm kinh doanh.'); return; }
      ui.qh.selZone = null; ui.mb.sel = null;
      saveLayout(); A.closeModal(); A.render(); U.toast('Đã xóa cấu trúc mặt bằng của ' + U.mShort(mid));
    },
    'qh-add-block': () => {
      const mid = qhMarket();
      if (!A.canDo('cau-truc.edit', mid)) return;
      blockModal(mid, null);
    },
    'qh-add-block-save': () => {
      const mid = qhMarket();
      if (!A.canDo('cau-truc.edit', mid)) return;
      const form = readBlockForm();
      if (form.errs.length) return showFormErr(form.errs);
      const res = S.addBuilding(mid, form.f);
      if (res.errors) return showFormErr(res.errors);
      ui.mb.sel = { k: 'building', id: res.building.id };
      saveLayout(); A.closeModal(); A.render(); U.toast('Đã thêm Khối/Nhà chợ "' + res.building.name + '"');
    },
    'qh-edit-block': el => {
      const mid = qhMarket();
      if (!A.canDo('cau-truc.edit', mid)) return;
      const b = S.buildingsOf(mid).find(x => x.id === el.dataset.id);
      if (b) blockModal(mid, b);
    },
    'qh-edit-block-save': el => {
      const mid = qhMarket();
      if (!A.canDo('cau-truc.edit', mid) || !S.buildingsOf(mid).some(x => x.id === el.dataset.id)) return;
      const form = readBlockForm();
      if (form.errs.length) return showFormErr(form.errs);
      const errs = S.updateBuilding(el.dataset.id, form.f);
      if (errs.length) return showFormErr(errs);
      saveLayout(); A.closeModal(); A.render(); U.toast('Đã cập nhật Khối/Nhà chợ');
    },
    // "Ngừng khai thác": không xoá cứng node còn Tầng/Dãy/điểm; node trống thì được gỡ khỏi cấu trúc.
    'qh-del-block': el => {
      const mid = qhMarket();
      if (!A.canDo('cau-truc.delete', mid)) return;
      const b = S.buildingsOf(mid).find(x => x.id === el.dataset.id);
      if (!b) return;
      const i = buildingInfo(mid, b);
      if (i.rows.length) return infoModal('Chưa thể ngừng khai thác', `Khối/Nhà chợ <b>${U.esc(b.name)}</b> đang có ${i.rows.length} Dãy và ${i.pts.length} điểm kinh doanh. Cần xử lý các Dãy/điểm kinh doanh trước.`);
      A.modal(A.mHead('Ngừng khai thác Khối/Nhà chợ') + `<div class="modal-b">Khối/Nhà chợ <b>${U.esc(b.name)}</b> chưa có Dãy nào${i.floors.length ? ` (${i.floors.length} tầng trống)` : ''} và sẽ được gỡ khỏi cấu trúc.</div>
        <div class="modal-f"><button class="btn" data-act="close">Hủy</button><button class="btn danger" data-act="qh-del-block-ok" data-id="${b.id}">Gỡ khỏi cấu trúc</button></div>`);
    },
    'qh-del-block-ok': el => {
      if (!A.canDo('cau-truc.delete', qhMarket())) return;
      if (!S.removeBuilding(el.dataset.id)) { U.toast('Khối/Nhà chợ đang có Dãy, không thể gỡ.'); return; }
      saveLayout(); A.closeModal(); A.render(); U.toast('Đã gỡ Khối/Nhà chợ khỏi cấu trúc');
    },
    'qh-add-floor': el => {
      const mid = qhMarket();
      if (!A.canDo('cau-truc.edit', mid)) return;
      if (S.hasLooseRows(el.dataset.block)) return infoModal('Không thể thêm tầng', 'Khối/Nhà chợ này đang có Dãy không chia tầng. Chỉ thêm tầng cho Khối/Nhà chợ chia tầng hoặc chưa có Dãy.');
      if (!S.buildingsOf(mid).some(b => b.id === el.dataset.block)) return;
      floorModal(mid, el.dataset.block, null);
    },
    'qh-add-floor-save': el => {
      const mid = qhMarket();
      if (!A.canDo('cau-truc.edit', mid) || !S.buildingsOf(mid).some(b => b.id === el.dataset.block)) return;
      const form = readFloorForm();
      if (form.errs.length) return showFormErr(form.errs);
      const res = S.addFloor(el.dataset.block, form.f.name, form.f.businessArea, { code: form.f.code });
      if (res.errors) return showFormErr(res.errors);
      ui.mb.sel = { k: 'floor', id: res.floor.id };
      saveLayout(); A.closeModal(); A.render(); U.toast('Đã thêm tầng "' + res.floor.name + '"');
    },
    'qh-edit-floor': el => {
      const mid = qhMarket();
      if (!A.canDo('cau-truc.edit', mid)) return;
      const f = S.floorsOf(mid).find(x => x.id === el.dataset.id);
      if (f) floorModal(mid, f.buildingId, f);
    },
    'qh-edit-floor-save': el => {
      const mid = qhMarket();
      if (!A.canDo('cau-truc.edit', mid) || !S.floorsOf(mid).some(f => f.id === el.dataset.id)) return;
      const form = readFloorForm();
      if (form.errs.length) return showFormErr(form.errs);
      const errs = S.updateFloor(el.dataset.id, form.f);
      if (errs.length) return showFormErr(errs);
      saveLayout(); A.closeModal(); A.render(); U.toast('Đã cập nhật tầng');
    },
    'qh-del-floor': el => {
      const mid = qhMarket();
      if (!A.canDo('cau-truc.delete', mid)) return;
      const f = S.floorsOf(mid).find(x => x.id === el.dataset.id);
      if (!f) return;
      const rows = rowsOfF(mid, f.id);
      if (rows.length) return infoModal('Chưa thể ngừng sử dụng tầng', `Tầng <b>${U.esc(f.name)}</b> đang có ${rows.length} Dãy. Cần xử lý các Dãy trước.`);
      A.modal(A.mHead('Ngừng sử dụng tầng') + `<div class="modal-b">Tầng <b>${U.esc(f.name)}</b> chưa có Dãy nào và sẽ được gỡ khỏi cấu trúc.</div>
        <div class="modal-f"><button class="btn" data-act="close">Hủy</button><button class="btn danger" data-act="qh-del-floor-ok" data-block="${f.buildingId}" data-id="${f.id}">Gỡ khỏi cấu trúc</button></div>`);
    },
    'qh-del-floor-ok': el => {
      if (!A.canDo('cau-truc.delete', qhMarket())) return;
      if (!S.removeFloor(el.dataset.id)) { U.toast('Tầng đang có Dãy, không thể gỡ.'); return; }
      saveLayout(); A.closeModal(); A.render(); U.toast('Đã gỡ tầng khỏi cấu trúc');
    },
    'qh-add-zone': el => {
      const mid = qhMarket();
      if (!A.canDo('cau-truc.edit', mid)) return;
      const place = el.dataset.block ? { blockId: el.dataset.block, floorId: el.dataset.floor } : firstZonePlace(mid);
      if (!place) { U.toast('Cần có Khối/Nhà chợ trước khi thêm Dãy'); return; }
      // Transient form state only: industry → generated code + suggested name. Nothing here is persisted.
      ui.mb.zoneDraft = { mid, place, industry: '', code: '', name: '', nameDirty: false, area: '' };
      renderAddZone();
    },
    'qh-add-zone-save': () => {
      const d = ui.mb.zoneDraft, mid = qhMarket();
      if (!d || d.mid !== mid || !A.canDo('cau-truc.edit', mid)) return;
      readZoneName(d); d.area = val('qhz-area') || d.area || '';
      if (!d.industry) return showFormErr(['Vui lòng chọn ngành hàng.']);
      if (!d.name) return showFormErr(['Chưa nhập tên dãy.']);
      const areaErr = requireArea(d.area, 'diện tích phân bổ cho Dãy');
      if (areaErr) return showFormErr([areaErr]);
      // Save-time regeneration: if another Row took the candidate meanwhile, show the new code instead of saving.
      const fresh = S.nextRowCode(mid, d.industry);
      if (!d.code || fresh !== d.code) { setZoneIndustry(d, d.industry); renderAddZone(); U.toast('Mã Dãy đã được cập nhật thành ' + d.code + ' do dữ liệu Dãy thay đổi. Vui lòng kiểm tra rồi bấm Thêm.'); return; }
      const res = S.addRow(mid, d.place, d.code, d.name, d.industry, d.area);
      if (res.errors) return showFormErr(res.errors);
      ui.mb.zoneDraft = null; ui.mb.sel = { k: 'row', id: res.row.id };
      saveLayout(); A.closeModal(); A.render();
      U.toast('Đã thêm Dãy ' + res.row.code + '.');
    },
    'qh-del-zone': el => {
      const mid = qhMarket();
      if (!A.canDo('cau-truc.delete', mid)) return;
      const r = A.idx.row.get(el.dataset.id);
      if (!r || r.market !== mid) return;
      const n = S.pointsOfRow(r.id).length;
      if (n) return infoModal('Chưa thể ngừng khai thác Dãy ' + r.code, `Dãy <b>${U.esc(r.name)}</b> đang có ${n} điểm kinh doanh. Không gỡ Dãy còn điểm kinh doanh để giữ lịch sử hợp đồng và khoản thu.`);
      A.modal(A.mHead('Ngừng khai thác Dãy ' + U.esc(r.code)) + `<div class="modal-b">Dãy <b>${U.esc(r.name)}</b> chưa có điểm kinh doanh nào và sẽ được gỡ khỏi cấu trúc.</div>
        <div class="modal-f"><button class="btn" data-act="close">Hủy</button><button class="btn danger" data-act="qh-del-zone-ok" data-id="${r.id}">Gỡ khỏi cấu trúc</button></div>`);
    },
    'qh-del-zone-ok': el => {
      if (!A.canDo('cau-truc.delete', qhMarket())) return;
      if (!S.removeRow(el.dataset.id)) { U.toast('Dãy còn điểm kinh doanh, không thể gỡ.'); return; }
      if (ui.qh.selZone === el.dataset.id) ui.qh.selZone = null;
      if (ui.mb.sel && ui.mb.sel.id === el.dataset.id) ui.mb.sel = null;
      saveLayout(); A.closeModal(); A.render(); U.toast('Đã gỡ Dãy khỏi cấu trúc');
    }
  });
  A.CH['qh-zone-field'] = el => {
    const mid = qhMarket();
    if (!A.canDo('cau-truc.edit', mid)) { A.render(); return; }
    const z = findZone(mid, el.dataset.zone);
    if (!z) return;
    const k = el.dataset.k;
    const patch = k === 'area' ? { allocatedArea: el.value }
      : k === 'blockId' ? { buildingId: el.value, floorId: firstFloorKey(mid, el.value) }
        : k === 'floorId' ? { floorId: el.value }
          : k === 'industry' ? { industry: el.value }
            : ['code', 'name', 'note'].indexOf(k) !== -1 ? { [k]: String(el.value || '').trim() } : null;
    if (!patch) return;
    const errs = S.updateRow(z.key, patch);
    if (errs.length) U.toast(errs[0]); else saveLayout();
    A.render(); qhSyncDrawer();
  };
  A.IN['mb-point-field'] = el => { const d = pointDraft(), g = d && d.groups.find(x => x.id === el.dataset.id); if (g) { g[el.dataset.key] = el.value; syncPointAdd(); } };
  A.CH['mb-point-field'] = el => { const d = pointDraft(), g = d && d.groups.find(x => x.id === el.dataset.id); if (g) { g[el.dataset.key] = el.value; renderPointAdd(); } };
  A.IN['mb-filter-search'] = el => { ui.mb.filter.search = el.value; A.render(); };
  A.IN['mb-tree-search'] = el => { ui.mb.treeSearch = el.value; A.render(); };
  A.CH['mb-filter-cat'] = el => { ui.mb.filter.cat = el.value; A.render(); };
  A.CH['mb-filter-area-type'] = el => { ui.mb.filter.areaType = el.value; A.render(); };
  // "Tình trạng tại ngày": chỉ đổi ngày xem (UI, không lưu); chip/bảng/sơ đồ tính lại theo hợp đồng.
  A.CH['mb-status-date'] = el => { A.mbSetStatusDate(el.value); ui.page.dkcl = 0; A.render(); };
  A.ACT['mb-status-today'] = () => { A.mbSetStatusDate(null); ui.page.dkcl = 0; A.render(); };

  A.mbWorkspaceHtml = mbWorkspaceHtml;
  A.VIEWS['mat-bang'] = mbWorkspaceHtml;
})(window.APP);

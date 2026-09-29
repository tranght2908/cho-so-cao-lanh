/* Điều hành – "Mặt bằng & điểm kinh doanh" (route #/mat-bang, screen permission 'mat-bang' DUY NHẤT).
 * v16: đọc/ghi graph mặt bằng DUY NHẤT trong A.db qua features/market-layout/store.js:
 *   Chợ → Khối/Nhà chợ (buildings) → Tầng (floors, TUỲ CHỌN) → Dãy (rows: 1 ngành hàng, allocatedArea)
 *   → Điểm kinh doanh (stalls). Mọi thay đổi cấu trúc đi qua command của store rồi A.save().
 * Bố cục: header (tình trạng tại ngày + chip trạng thái) · cây "Cấu trúc chợ" (điều hướng thật, menu ⋮
 * theo từng node) · workspace bên phải theo node đang chọn (Tổng quan / Khối / Tầng / Dãy), chế độ
 * Sơ đồ | Bảng dùng CHUNG phạm vi node đang chọn. Không lưu số liệu dẫn xuất nào.
 * State UI (không persist): ui.mb.sel = null | {k:'building'|'floor'|'row', id}, ui.mb.view,
 * ui.mb.filter, ui.mb.collapsed, ui.mb.menu (menu ⋮ đang mở), ui.mb.treeOpen (mobile). */
(function (A) {
  'use strict';
  const D = A.D, U = A.U, ui = A.ui;
  const S = A.features.marketLayout.store;
  const BP = () => A.features.businessPoints.service;
  const MS = () => A.features.markets && A.features.markets.service;
  const { CATS, save: saveLayout, blocksOf, findBlock, floorsOfBlock, findFloor, firstFloorKey, firstZonePlace, findZone } = S;
  const mbCollectorAccounts = mid => BP().collectorAccounts(mid);
  const fmt = n => Number(n || 0).toLocaleString('vi-VN', { maximumFractionDigits: 2 });
  const m2 = n => fmt(n) + ' m²';

  if (!ui.qh) ui.qh = { market: 'CL', selZone: null };
  function qhMarket() { return ui.market === 'ALL' ? ui.qh.market : ui.market; }
  if (!ui.mb) ui.mb = { sel: null, collapsed: {}, treeOpen: false };
  if (!ui.mb.collapsed) ui.mb.collapsed = {};
  if (!ui.mb.view) ui.mb.view = 'grid';
  if (!ui.mb.filter) ui.mb.filter = { search: '', status: '', cat: '', areaType: '' };

  // ---------- dữ liệu cấu trúc (đọc thẳng graph A.db qua store) ----------
  const floorsOfB = (mid, bid) => S.floorsOf(mid).filter(f => f.buildingId === bid);
  const rowsOfF = (mid, fid) => S.rowsOf(mid).filter(r => r.floorId === fid);
  const looseRowsOfB = (mid, bid) => S.rowsOf(mid).filter(r => r.buildingId === bid && !r.floorId);
  const rowsOfB = (mid, bid) => S.rowsOf(mid).filter(r => r.buildingId === bid);
  const pointsOfRows = rows => rows.reduce((acc, r) => acc.concat(S.pointsOfRow(r.id)), []);
  function rowInfo(r) {
    const pts = S.pointsOfRow(r.id), used = U.sum(pts, st => Number(st.area) || 0), alloc = Number(r.allocatedArea) || 0;
    const acc = r.collectorId ? A.ACCOUNTS.get(r.collectorId) : null;
    return { pts, used, alloc, remaining: alloc - used, collector: acc ? acc.fullName : 'Chưa phân công', hasCollector: !!acc };
  }
  function floorInfo(mid, f) {
    const rows = rowsOfF(mid, f.id), allocated = U.sum(rows, r => Number(r.allocatedArea) || 0);
    const biz = f.businessArea == null ? null : Number(f.businessArea);
    return { rows, pts: pointsOfRows(rows), allocated, biz, remaining: biz == null ? null : biz - allocated };
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
  function select(k, id) { ui.mb.sel = k === 'overview' ? null : { k, id }; ui.mb.menu = null; ui.page.dkcl = 0; A.render(); }
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
  A.mbCurrentPoints = function (mid) { return A.mbSelectedStalls(mid).filter(A.mbMatchesFilter); };
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
      if (can.edit) items.push({ label: 'Phân công NV thu phí', run: 'mb-assign-collector', data: { id: node.id } });
      if (can.edit) items.push({ label: 'Chỉnh sửa Dãy', run: 'qh-zone-edit-open', data: { id: node.id } });
      if (can.del) items.push({ label: 'Ngừng khai thác', run: 'qh-del-zone', data: { id: node.id }, danger: true });
    } else if (kind === 'top') {
      if (can.edit) items.push({ label: 'Thêm Khối/Nhà chợ', run: 'qh-add-block', data: {} });
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
  const rowNodeHtml = (mid, r, depth) => treeNode(mid, 'row', r, depth, r.name || 'Dãy ' + r.code, r.code + ' · ' + (r.industry || 'Chưa có ngành hàng'));
  function mbTreeHtml(mid) {
    const overview = `<div class="mb-tnode mb-tnode-overview ${isSel(mid, 'overview') ? 'on' : ''}" style="--d:0"><button class="mb-tlabel" data-act="mb-sel-overview" ${isSel(mid, 'overview') ? 'aria-current="true"' : ''}><span class="mb-tname">Tổng quan</span></button></div>`;
    const bs = S.buildingsOf(mid);
    if (!bs.length) return overview + '<div class="mb-tree-empty">Chưa thiết lập mặt bằng.</div>';
    return overview + bs.map(b => {
      const floors = floorsOfB(mid, b.id), loose = looseRowsOfB(mid, b.id), bKey = 'b:' + b.id;
      const kids = floors.map(f => {
        const fKey = 'f:' + f.id, rows = rowsOfF(mid, f.id);
        return treeNode(mid, 'floor', f, 1, f.name, '', rows.length ? fKey : null) + (rows.length && !ui.mb.collapsed[fKey] ? rows.map(r => rowNodeHtml(mid, r, 2)).join('') : '');
      }).join('') + loose.map(r => rowNodeHtml(mid, r, 1)).join('');
      return `<div class="mb-tbranch">${treeNode(mid, 'building', b, 0, b.name, '', floors.length || loose.length ? bKey : null)}${ui.mb.collapsed[bKey] ? '' : kids}</div>`;
    }).join('');
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
    return `<div class="seg"><button class="${ui.mb.view === 'grid' ? 'on' : ''}" data-act="mb-view" data-id="grid">▦ Sơ đồ</button><button class="${ui.mb.view === 'table' ? 'on' : ''}" data-act="mb-view" data-id="table">☰ Bảng</button></div>`;
  }

  // ---------- khối trình bày dùng chung ----------
  const tile = (label, value, sub, cls) => `<div class="mb-stat ${cls || ''}"><div class="mb-stat-l">${label}</div><div class="mb-stat-v">${value}</div>${sub ? `<div class="mb-stat-s">${sub}</div>` : ''}</div>`;
  function statusBreakdown(points) {
    const c = A.mbStatusCounts(points);
    const parts = ['thue', 'trong', 'no', 'ngung', 'tranhchap'].filter(k => c[k]).map(k => `<span class="mb-sb"><i style="background:${D.STATUS[k].color}"></i>${c[k]} ${U.esc(A.mbStatusLabel(k).toLowerCase())}</span>`);
    return parts.length ? `<div class="mb-sbs">${parts.join('')}</div>` : '';
  }
  function areaLine(used, total, unitLabel) {
    const over = used > total + 1e-9;
    return `<span class="${over ? 'mb-over' : ''}">${fmt(used)} / ${m2(total)}</span>${unitLabel ? ` <span class="muted">${unitLabel}</span>` : ''}`;
  }
  function rowCardHtml(mid, r) {
    const i = rowInfo(r);
    return `<div class="mb-rowcard">
      <button class="mb-rowcard-h" data-act="mb-sel-row" data-id="${r.id}"><span class="mb-rowcard-name">${U.esc(r.name || 'Dãy ' + r.code)}</span><span class="mb-rowcard-sub">${U.esc(r.code)} · ${U.esc(r.industry || 'Chưa có ngành hàng')}</span></button>
      <div class="mb-rowcard-meta"><span>${i.pts.length} điểm</span><span>Diện tích điểm: ${areaLine(i.used, i.alloc)}</span><span>NV thu phí: <b class="${i.hasCollector ? '' : 'muted'}">${U.esc(i.collector)}</b></span></div>
      ${statusBreakdown(i.pts)}${A.mbCellsHtml(i.pts)}</div>`;
  }
  function wsHead(title, sub, actions) {
    return `<div class="mb-ws-head"><div><h3>${U.esc(title)}</h3>${sub ? `<div class="mb-ws-sub">${sub}</div>` : ''}</div>${actions ? `<div class="mb-ws-actions">${actions}</div>` : ''}</div>`;
  }

  // ---------- capacity (Danh mục chợ — chỉ đọc ở màn này) ----------
  function marketCapacity(mid) {
    const row = MS() && MS().get(mid);
    return row && Array.isArray(row.capacityByAreaType) ? row.capacityByAreaType : null;
  }
  function capacityHtml(mid) {
    const cap = marketCapacity(mid);
    if (!cap) return `<div class="note info"><b>Chưa cập nhật quy mô và chỉ tiêu mặt bằng.</b><div class="small">Quản trị hệ thống cần cập nhật thông tin này trong Danh mục chợ.</div></div>`;
    const usage = MS().usage(mid);
    const types = U.AREA_TYPE_CODES.filter(k => { const c = cap.find(x => x.areaTypeId === k) || {}; return (c.maxPointCount || c.maxArea) || usage[k]; });
    const cell = (cnt, area) => `<b>${fmt(cnt)} điểm</b><div class="small muted">${m2(area)}</div>`;
    return `<div class="tbl-wrap"><table class="tbl mb-cap-tbl"><thead><tr><th>Loại diện tích</th><th class="num">Đã tạo</th><th class="num">Tối đa</th><th class="num">Còn lại</th></tr></thead><tbody>${types.map(k => {
      const c = cap.find(x => x.areaTypeId === k) || { maxPointCount: 0, maxArea: 0 }, u = usage[k] || { count: 0, area: 0 };
      const rc = c.maxPointCount - u.count, ra = c.maxArea - u.area, over = rc < 0 || ra < -1e-9;
      return `<tr><td>${U.esc(U.areaTypeLabel(k))}</td><td class="num">${cell(u.count, u.area)}</td><td class="num">${cell(c.maxPointCount, c.maxArea)}</td>
        <td class="num ${over ? 'mb-over' : ''}">${over ? 'Vượt chỉ tiêu' : `Còn ${fmt(rc)} điểm`}<div class="small ${over ? '' : 'muted'}">${ra < 0 ? 'vượt ' + m2(-ra) : m2(ra)}</div></td></tr>`;
    }).join('') || '<tr><td colspan="4" class="muted">Chưa khai báo chỉ tiêu theo loại diện tích.</td></tr>'}</tbody></table></div>
      <div class="small muted" style="margin-top:6px">Chỉ tiêu do Quản trị hệ thống khai báo trong Danh mục chợ; "Đã tạo" tính từ điểm kinh doanh hiện có.</div>`;
  }

  // ---------- workspace: chợ chưa có mặt bằng ----------
  function emptyMarketHtml(mid, can) {
    const cap = marketCapacity(mid);
    return `<div class="card"><div class="card-b mb-empty">
      <h3>Chưa thiết lập mặt bằng</h3>
      <p class="muted">${U.esc(U.market(mid).name)} chưa có Khối/Nhà chợ, Dãy hay điểm kinh doanh nào.</p>
      ${cap ? `<div class="mb-empty-cap"><h4>Chỉ tiêu mặt bằng đã được khai báo</h4>${capacityHtml(mid)}</div>` : '<div class="note info">Chưa cập nhật quy mô/chỉ tiêu mặt bằng.</div>'}
      ${can.edit ? '<div class="mb-empty-actions"><button class="btn primary" data-act="mb-setup">Thiết lập mặt bằng</button></div>' : ''}
    </div></div>`;
  }

  // ---------- workspace: Tổng quan ----------
  function overviewHtml(mid) {
    const bs = S.buildingsOf(mid), pts = A.mbBusinessPointsForMarket(mid);
    const list = bs.map(b => {
      const i = buildingInfo(mid, b);
      const shape = i.floors.length ? `${i.floors.length} tầng` : 'Không chia tầng';
      return `<button class="mb-listitem" data-act="mb-sel-building" data-id="${b.id}"><span class="mb-listitem-name">${U.esc(b.name)}</span><span class="mb-listitem-sub">${shape} · ${i.rows.length} Dãy · ${i.pts.length} điểm</span><span class="mb-listitem-go" aria-hidden="true">›</span></button>`;
    }).join('');
    return `<div class="card"><div class="card-b">${wsHead('Tổng quan mặt bằng', U.esc(U.market(mid).name))}
        <div class="mb-stats">${tile('Khối/Nhà chợ', fmt(bs.length))}${tile('Tầng', fmt(S.floorsOf(mid).length))}${tile('Dãy', fmt(S.rowsOf(mid).length))}${tile('Điểm kinh doanh', fmt(pts.length))}</div></div></div>
      <div class="card"><div class="card-h"><h3>Chỉ tiêu toàn chợ</h3></div><div class="card-b">${capacityHtml(mid)}</div></div>
      <div class="card"><div class="card-h"><h3>Cấu trúc hiện tại</h3></div><div class="card-b"><div class="mb-list">${list}</div></div></div>`;
  }

  // ---------- workspace: Khối/Nhà chợ ----------
  function buildingHtml(mid, n, can) {
    const b = n.b, i = buildingInfo(mid, b);
    const shape = i.floors.length ? `${i.floors.length} tầng` : 'Không chia tầng';
    const status = b.status === 'active' ? '<span class="tag ok">Đang khai thác</span>' : `<span class="tag">${U.esc(b.status || '—')}</span>`;
    const action = !can.edit ? ''
      : i.floors.length || !i.loose.length ? `<button class="btn sm" data-act="qh-add-floor" data-block="${b.id}">+ Thêm tầng</button>${!i.floors.length ? `<button class="btn sm" data-act="qh-add-zone" data-block="${b.id}" data-floor="${S.NO_FLOOR + b.id}">+ Thêm Dãy</button>` : ''}`
        : `<button class="btn sm" data-act="qh-add-zone" data-block="${b.id}" data-floor="${S.NO_FLOOR + b.id}">+ Thêm Dãy</button>`;
    const head = `<div class="card"><div class="card-b">${wsHead(b.name, `${shape} · ${i.rows.length} Dãy · ${i.pts.length} điểm KD · ${status}`, action)}${statusBreakdown(i.pts)}</div></div>`;
    if (i.floors.length) {
      return head + `<div class="card"><div class="card-h"><h3>Các tầng</h3></div><div class="card-b"><div class="mb-list">${i.floors.map(f => {
        const fi = floorInfo(mid, f);
        const area = fi.biz == null ? '<span class="muted">Chưa khai báo diện tích kinh doanh</span>'
          : `DT kinh doanh ${m2(fi.biz)} · Đã phân bổ cho Dãy ${m2(fi.allocated)} · <span class="${fi.remaining < 0 ? 'mb-over' : ''}">Còn lại ${m2(fi.remaining)}</span>`;
        return `<button class="mb-listitem" data-act="mb-sel-floor" data-id="${f.id}"><span class="mb-listitem-name">${U.esc(f.name)}</span><span class="mb-listitem-sub">${fi.rows.length} Dãy · ${fi.pts.length} điểm KD</span><span class="mb-listitem-sub">${area}</span><span class="mb-listitem-go" aria-hidden="true">›</span></button>`;
      }).join('')}</div></div></div>`;
    }
    return head + (i.loose.length ? `<div class="mb-rowcards">${i.loose.map(r => rowCardHtml(mid, r)).join('')}</div>` : '<div class="card"><div class="card-b empty">Khối/Nhà chợ chưa có tầng hoặc Dãy nào.</div></div>');
  }

  // ---------- workspace: Tầng ----------
  function floorHtml(mid, n, can) {
    const f = n.f, i = floorInfo(mid, f);
    const action = can.edit ? `<button class="btn sm primary" data-act="qh-add-zone" data-block="${f.buildingId}" data-floor="${f.id}">+ Thêm Dãy</button>` : '';
    const tiles = (i.biz == null
      ? tile('Diện tích kinh doanh', '—', 'Chưa khai báo')
      : tile('Diện tích kinh doanh', m2(i.biz))) + tile('Đã phân bổ cho Dãy', m2(i.allocated))
      + (i.biz == null ? tile('Còn chưa phân bổ', '—') : tile('Còn chưa phân bổ', m2(i.remaining), '', i.remaining < 0 ? 'over' : ''))
      + tile('Số Dãy', fmt(i.rows.length)) + tile('Số điểm', fmt(i.pts.length));
    return `<div class="card"><div class="card-b">${wsHead(f.name, U.esc(n.b ? n.b.name : ''), action)}<div class="mb-stats">${tiles}</div></div></div>
      ${i.rows.length ? `<div class="mb-rowcards">${i.rows.map(r => rowCardHtml(mid, r)).join('')}</div>` : '<div class="card"><div class="card-b empty">Tầng chưa có Dãy nào.</div></div>'}`;
  }

  // ---------- workspace: Dãy ----------
  function rowHtml(mid, n, can) {
    const r = n.r, i = rowInfo(r);
    const loc = [n.b && n.b.name, n.f && n.f.name].filter(Boolean).join(' › ');
    const actions = [
      can.edit ? `<button class="btn sm primary" data-act="mb-add-point" data-id="${r.id}">+ Thêm điểm kinh doanh</button>` : '',
      can.edit ? `<button class="btn sm" data-act="mb-assign-collector" data-id="${r.id}">Phân công NV thu phí</button>` : '',
      kebabHtml('row-ws:' + r.id, menuItems(mid, 'row', r).filter(x => x.run !== 'mb-add-point' && x.run !== 'mb-assign-collector'), 'Dãy ' + r.code)
    ].join('');
    const tiles = tile('Diện tích phân bổ', m2(i.alloc)) + tile('Diện tích điểm đã tạo', m2(i.used))
      + tile('Còn có thể bố trí', i.remaining < 0 ? 'Vượt ' + m2(-i.remaining) : m2(i.remaining), '', i.remaining < 0 ? 'over' : '')
      + tile('Số điểm', fmt(i.pts.length)) + tile('NV thu phí', `<span class="mb-stat-text">${U.esc(i.collector)}</span>`);
    return `<div class="card"><div class="card-b">${wsHead(r.name || 'Dãy ' + r.code, `${U.esc(r.code)} · ${U.esc(r.industry || 'Chưa có ngành hàng')}${loc ? ' · ' + U.esc(loc) : ''}`, actions)}<div class="mb-stats">${tiles}</div></div></div>
      <div class="card"><div class="card-h"><h3>Sơ đồ điểm kinh doanh</h3></div><div class="card-b">${statusBreakdown(i.pts)}<div class="plan">${A.mbCellsHtml(i.pts)}</div></div></div>`;
  }

  function mbRightHtml(mid) {
    const can = mbCan(mid);
    if (!setup.graphExists(mid)) return emptyMarketHtml(mid, can);
    const n = selNode(mid);
    const bar = `<div class="mb-ws-bar">${crumbHtml(mid, n)}${viewSwitcherHtml()}</div>`;
    if (ui.mb.view === 'table') return bar + (A.dkTableHtml ? A.dkTableHtml(mid) : '');
    const body = n.k === 'row' ? rowHtml(mid, n, can) : n.k === 'floor' ? floorHtml(mid, n, can) : n.k === 'building' ? buildingHtml(mid, n, can) : overviewHtml(mid);
    return bar + body;
  }

  // ---------- drawer "Sửa dãy" (dùng chung cho Chỉnh sửa Dãy / Phân công NV thu phí) ----------
  // Sửa trực tiếp Dãy (A.db.rows) qua S.updateRow — mỗi thay đổi được kiểm tra ngay (mã duy nhất, đúng
  // 1 ngành hàng, diện tích phân bổ >= tổng diện tích điểm, tổng dãy trên tầng <= diện tích tầng).
  function qhZoneDrawerHtml(mid, z) {
    const can = mbCan(mid), dis = can.edit ? '' : 'disabled';
    const blocks = blocksOf(mid), floors = floorsOfBlock(mid, z.blockId).filter(f => !f.virtual);
    const pts = S.pointsOfRow(z.key);
    const used = U.sum(pts, st => Number(st.area) || 0);
    const byType = U.AREA_TYPE_CODES.map(k => ({ k, list: pts.filter(st => st.areaTypeId === k) })).filter(x => x.list.length);
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
      <h4 style="margin:0;font-size:var(--font-size-sm)">Điểm kinh doanh trong Dãy</h4>
      <div class="small muted" style="margin:4px 0 8px">Mọi điểm trong Dãy kế thừa ngành hàng của Dãy; mỗi điểm có loại diện tích riêng.</div>
      <div>${U.table([{ t: 'Loại diện tích' }, { t: 'Số điểm', num: true }, { t: 'Diện tích (m²)', num: true }],
        byType.map(x => `<tr><td>${U.esc(U.areaTypeLabel(x.k))}</td><td class="num">${x.list.length}</td><td class="num">${fmt(U.sum(x.list, st => Number(st.area) || 0))}</td></tr>`), { empty: 'Dãy chưa có điểm kinh doanh' })}</div>
      <div class="row" style="padding:8px 2px;font-weight:600"><span>Tổng cộng</span><span class="spacer"></span><span>${fmt(pts.length)} điểm · ${fmt(used)} / ${m2(z.area || 0)} phân bổ</span></div>
      ${qhZoneCollectorSectionHtml(mid, z, dis)}
      </div>
      <div class="drawer-f"><span class="spacer"></span><button class="btn" data-act="close">Đóng</button></div>`;
  }
  // Phân công NV thu phí theo Dãy (row.collectorId) — áp dụng cả khi Dãy chưa có điểm.
  function qhZoneCollectorSectionHtml(mid, z, dis) {
    const row = A.idx.row.get(z.key), curId = row ? row.collectorId || '' : '';
    return `<div class="divider"></div>
      <div class="row" id="qh-collector"><h4 style="margin:0;font-size:var(--font-size-sm)">Phân công thu phí</h4></div>
      <div class="field" style="margin-top:8px"><label>Nhân viên thu phí phụ trách</label>
        <select class="input" ${dis} data-ch="qh-zone-collector" data-zone="${z.key}">
          <option value="" ${!curId ? 'selected' : ''}>— Chưa phân công —</option>
          ${mbCollectorAccounts(mid).map(a => `<option value="${a.id}" ${curId === a.id ? 'selected' : ''}>${U.esc(a.fullName)}</option>`).join('')}
        </select>
      </div>
      <div class="small muted" style="margin-top:4px">Áp dụng cho ${fmt(S.pointsOfRow(z.key).length)} điểm kinh doanh thuộc Dãy này; lịch sử thu cũ không thay đổi.</div>`;
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
  function mbWorkspaceHtml() {
    const mid = qhMarket(), can = mbCan(mid), m = U.market(mid), open = !!ui.mb.treeOpen;
    const stats = A.mbMarketStats(mid);
    const flt = ui.mb.filter;
    const c = k => stats.byStatus[k] || 0;
    // Chip trạng thái (bấm để lọc): Tổng điểm = điểm của chợ; Đang thuê/Còn trống theo hợp đồng; Nợ phí
    // theo khoản phải thu; Tạm ngưng/Tranh chấp theo trạng thái vận hành — tất cả suy ra, không lưu.
    const chip = (k, label, extra) => `<button class="mb-chip ${k ? 'mb-chip-' + k : 'mb-chip-total'} ${flt.status === (k || '') ? 'on' : ''}" data-act="mb-filter-status" data-id="${k || ''}">${k ? `<i style="background:${D.STATUS[k].color}"></i>` : ''}<b>${extra != null ? extra : c(k)}</b>${label}</button>`;
    const summary = chip(null, 'Tổng điểm', stats.total) + ['thue', 'trong', 'no', 'ngung', 'tranhchap'].map(k => chip(k, A.mbStatusLabel(k))).join('');
    const hasLayout = setup.graphExists(mid);
    const topItems = menuItems(mid, 'top');
    const topOpen = ui.mb.menu === 'top';
    const addBtn = hasLayout && topItems.length
      ? `<div class="mb-kebab-wrap"><button class="btn sm primary" data-act="mb-menu" data-id="top" aria-haspopup="menu" aria-expanded="${topOpen}">+ Bổ sung cấu trúc</button>${topOpen ? menuHtml(topItems) : ''}</div>` : '';
    const resetBtn = can.reset && hasLayout && !stats.total ? `<button class="btn sm mb-more" data-act="qh-reset" title="Xóa toàn bộ cấu trúc (chợ chưa có điểm kinh doanh)" aria-label="Xóa toàn bộ cấu trúc">⋯</button>` : '';
    return `<div class="card mb-head"><div class="card-b mb-head-b">
      <div class="mb-head-info"><h3>Mặt bằng & điểm kinh doanh</h3><div class="mb-head-sub"><b>${U.esc(m.name)}</b></div></div>
        <div class="mb-status-context">
          <div class="mb-status-date"><label>Tình trạng tại ngày <input class="input" type="date" data-ch="mb-status-date" value="${A.mbStatusDate()}"></label>${A.mbStatusDate() !== U.today() ? '<button class="btn sm" data-act="mb-status-today">Hôm nay</button>' : ''}</div>
          <div class="mb-summary">${summary}</div>
        </div></div></div>
    <button class="btn sm mb-tree-toggle" data-act="mb-toggle-tree">${open ? '✕ Đóng cấu trúc' : '☰ Cấu trúc chợ'}</button>
    <div class="mb-workspace">
      <div class="card mb-tree-card ${open ? 'open' : ''}"><div class="card-h mb-tree-h">
          <h3>Cấu trúc chợ</h3><span class="spacer"></span>${addBtn}${resetBtn}</div>
        <div class="card-b mb-tree" role="tree">${mbTreeHtml(mid)}</div></div>
      <div class="mb-ws">${mbRightHtml(mid)}</div>
    </div>`;
  }

  // ---------- đóng menu ⋮: click ra ngoài / ESC ----------
  if (typeof document !== 'undefined' && document.addEventListener) {
    document.addEventListener('click', e => {
      if (!ui.mb.menu || !e.target || !e.target.closest || e.target.closest('.mb-kebab-wrap')) return;
      ui.mb.menu = null; A.render();
    });
    document.addEventListener('keydown', e => { if (e.key === 'Escape' && ui.mb.menu) { ui.mb.menu = null; A.render(); } });
  }

  // "Thêm Dãy": Ngành hàng first; Mã Dãy is generated (S.nextRowCode, same rule as the setup wizard) and
  // read-only; Tên Dãy is only a suggestion — once the user edits it, changing industry never overwrites it.
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
  function renderAddZone() {
    const d = ui.mb.zoneDraft; if (!d) return;
    A.modal(A.mHead('Thêm Dãy') + `<div class="modal-b"><div class="form-grid">
      <div class="field"><label>Ngành hàng *</label><select class="input" id="qhz-industry" data-ch="qhz-industry"><option value="">— Chọn ngành hàng —</option>${CATS.map(c => `<option ${c === d.industry ? 'selected' : ''}>${U.esc(c)}</option>`).join('')}</select></div>
      <div class="field"><label>Tên Dãy *</label><input class="input" id="qhz-name" data-in="qhz-name" placeholder="${d.industry ? 'VD: ' + U.esc(S.suggestRowName(d.industry, d.code)) : 'Chọn ngành hàng trước'}" value="${U.esc(d.name)}" ${d.industry ? '' : 'disabled'}></div>
      <div class="field"><label>Mã Dãy</label><input class="input" id="qhz-code" value="${U.esc(d.code)}" placeholder="—" readonly aria-readonly="true" tabindex="-1"><div class="small muted" style="margin-top:4px">Tự động tạo theo ngành hàng và các Dãy hiện có.</div></div></div>
      <div class="small muted" style="margin-top:8px">Mỗi Dãy có đúng 1 ngành hàng; điểm kinh doanh trong Dãy kế thừa ngành hàng này.</div></div>
      <div class="modal-f"><button class="btn" data-act="close">Hủy</button><button class="btn primary" data-act="qh-add-zone-save">Thêm</button></div>`);
  }
  A.CH['qhz-industry'] = el => { const d = ui.mb.zoneDraft; if (!d) return; readZoneName(d); setZoneIndustry(d, el.value); renderAddZone(); };
  A.IN['qhz-name'] = el => { const d = ui.mb.zoneDraft; if (!d) return; d.name = String(el.value || '').trim(); d.nameDirty = d.name !== S.suggestRowName(d.industry, d.code); };
  const infoModal = (title, body) => A.modal(A.mHead(U.esc(title)) + `<div class="modal-b">${body}</div><div class="modal-f"><button class="btn primary" data-act="close">Đã hiểu</button></div>`);
  const areaField = (id, value) => `<div class="field"><label>Diện tích kinh doanh của tầng (m²)</label><input class="input" id="${id}" type="number" min="0" step="any" value="${value == null ? '' : U.esc(String(value))}" placeholder="Để trống nếu chưa khảo sát"></div>`;

  // Wizard initial setup: its entire working set stays in ui.mb.setupDraft until step 5.
  const setup = S.initialSetup;
  const setupDraft = () => ui.mb.setupDraft;
  const sn = v => Number(v) || 0;
  const setupItem = (kind, id) => ({ building: setupDraft().buildings, floor: setupDraft().floors, row: setupDraft().rows, group: setupDraft().pointGroups }[kind] || []).find(x => x.id === id);
  const setupErrs = step => (setup.validate(setupDraft()).byStep[step] || []).map(x => `<div class="note danger small" style="margin-top:8px">${U.esc(x)}</div>`).join('');
  const setupTitle = ['Khối/Nhà', 'Tầng', 'Dãy & ngành hàng', 'Điểm kinh doanh', 'Kiểm tra'];
  function setupModalHtml() {
    const d = setupDraft(), step = d.step || 1, check = setup.validate(d), preview = check.preview;
    const floorsFor = bid => d.floors.filter(x => x.buildingDraftId === bid);
    const rowsFor = (bid, fid) => d.rows.filter(x => x.buildingDraftId === bid && (x.floorDraftId || '') === (fid || ''));
    const groupsFor = rid => d.pointGroups.filter(x => x.rowDraftId === rid);
    const field = (kind, item, key, label, type) => `<div class="field"><label>${label}</label><input class="input" ${type === 'number' ? 'type="number" min="0"' : ''} data-in="mb-setup-field" data-kind="${kind}" data-id="${item.id}" data-key="${key}" value="${U.esc(String(item[key] == null ? '' : item[key]))}"></div>`;
    let body = '';
    if (step === 1) body = `<h3>1. Khối/Nhà chợ</h3><p class="muted">Khai báo các khu vực vật lý chính của chợ. Dữ liệu chỉ là bản nháp cho đến khi hoàn tất.</p>${d.buildings.map(b => `<div class="card" style="margin:10px 0"><div class="card-b"><div class="form-grid">${field('building',b,'name','Tên Khối/Nhà *')}<div class="field"><label>Mô hình *</label><select class="input" data-ch="mb-setup-field" data-kind="building" data-id="${b.id}" data-key="hasFloors"><option value="true" ${b.hasFloors ? 'selected' : ''}>Có tầng</option><option value="false" ${!b.hasFloors ? 'selected' : ''}>Không chia tầng</option></select></div></div>${d.buildings.length > 1 ? `<button class="btn sm danger" data-act="mb-setup-remove" data-kind="building" data-id="${b.id}">Xóa</button>` : ''}</div></div>`).join('')}<button class="btn" data-act="mb-setup-add" data-kind="building">+ Thêm Khối/Nhà</button>${setupErrs(1)}`;
    if (step === 2) body = `<h3>2. Tầng</h3><p class="muted">Chỉ áp dụng cho Khối/Nhà được chọn mô hình Có tầng.</p>${d.buildings.map(b => b.hasFloors ? `<div class="card" style="margin:10px 0"><div class="card-h"><h3>${U.esc(b.name || 'Khối/Nhà chưa đặt tên')}</h3></div><div class="card-b">${floorsFor(b.id).map(f => `<div class="form-grid" style="margin-bottom:8px">${field('floor',f,'name','Tên tầng *')}${field('floor',f,'businessArea','Diện tích kinh doanh (m²) *','number')}<div class="field actions bottom"><button class="btn sm danger" data-act="mb-setup-remove" data-kind="floor" data-id="${f.id}">Xóa</button></div></div>`).join('')}<button class="btn sm" data-act="mb-setup-add" data-kind="floor" data-building="${b.id}">+ Thêm tầng</button></div></div>` : `<div class="note info" style="margin:10px 0">${U.esc(b.name || 'Khối/Nhà chưa đặt tên')}: không chia tầng; Dãy sẽ được khai báo trực tiếp ở bước sau.</div>`).join('')}${setupErrs(2)}`;
    if (step === 3) body = `<h3>3. Dãy & ngành hàng</h3><p class="muted">Mỗi Dãy có đúng một ngành hàng. Mã Dãy được tự sinh và hiển thị ở bước kiểm tra.</p>${d.buildings.map(b => { const places=b.hasFloors?floorsFor(b.id).map(f=>({id:f.id,name:f.name,area:f.businessArea})):[{id:'',name:'Không chia tầng',area:null}]; return `<div class="card" style="margin:10px 0"><div class="card-h"><h3>${U.esc(b.name || 'Khối/Nhà chưa đặt tên')}</h3></div><div class="card-b">${places.map(place=>{const rs=rowsFor(b.id,place.id), allocated=rs.reduce((s,r)=>s+sn(r.allocatedArea),0);return `<div style="margin-bottom:14px"><b>${U.esc(place.name)}</b>${place.area != null?`<div class="small muted">${fmt(place.area)} m² · Đã phân bổ ${fmt(allocated)} m²</div>`:''}${rs.map(r=>`<div class="form-grid" style="margin-top:8px">${field('row',r,'name','Tên Dãy *')}<div class="field"><label>Ngành hàng *</label><select class="input" data-ch="mb-setup-field" data-kind="row" data-id="${r.id}" data-key="industry"><option value="">— Chọn ngành hàng —</option>${CATS.map(x=>`<option value="${U.esc(x)}" ${x===r.industry?'selected':''}>${U.esc(x)}</option>`).join('')}</select></div>${field('row',r,'allocatedArea','Diện tích phân bổ (m²) *','number')}<div class="field actions bottom"><button class="btn sm danger" data-act="mb-setup-remove" data-kind="row" data-id="${r.id}">Xóa</button></div></div>`).join('')}<button class="btn sm" data-act="mb-setup-add" data-kind="row" data-building="${b.id}" data-floor="${place.id}">+ Thêm Dãy</button></div>`}).join('')}</div></div>`}).join('')}${setupErrs(3)}`;
    if (step === 4) body = `<h3>4. Điểm kinh doanh</h3><p class="muted">Tạo hàng loạt điểm theo từng Dãy; tổng diện tích điểm không được vượt diện tích phân bổ.</p>${check.capacity?'':'<div class="note info">Chợ chưa được khai báo chỉ tiêu mặt bằng. Hệ thống chỉ kiểm tra giới hạn theo cấu trúc.</div>'}${d.rows.map(r=>{const gs=groupsFor(r.id),used=gs.reduce((s,g)=>s+sn(g.quantity)*sn(g.areaPerPoint),0);return `<div class="card" style="margin:10px 0"><div class="card-h"><h3>${U.esc(preview.rowCodes[r.id] || '—')} · ${U.esc(r.name || 'Dãy chưa đặt tên')}</h3><span class="spacer"></span><span class="small muted">${fmt(used)} / ${fmt(r.allocatedArea)} m²</span></div><div class="card-b"><div class="tbl-wrap"><table class="tbl"><thead><tr><th>Loại diện tích</th><th>Số điểm</th><th>DT/điểm</th><th>Tổng DT</th><th></th></tr></thead><tbody>${gs.map(g=>`<tr><td><select class="input" data-ch="mb-setup-field" data-kind="group" data-id="${g.id}" data-key="areaTypeId">${U.AREA_TYPE_CODES.map(k=>`<option value="${k}" ${k===g.areaTypeId?'selected':''}>${U.esc(U.areaTypeLabel(k))}</option>`).join('')}</select></td><td>${field('group',g,'quantity','', 'number')}</td><td>${field('group',g,'areaPerPoint','', 'number')}</td><td>${fmt(sn(g.quantity)*sn(g.areaPerPoint))} m²</td><td><button class="btn sm danger" data-act="mb-setup-remove" data-kind="group" data-id="${g.id}">Xóa</button></td></tr><tr><td colspan="5" class="small muted">Preview: ${(preview.pointCodes[g.id]||[]).map(U.esc).join(', ')||'—'}</td></tr>`).join('')}</tbody></table></div><button class="btn sm" data-act="mb-setup-add" data-kind="group" data-row="${r.id}">+ Thêm nhóm</button></div></div>`}).join('') || '<div class="empty">Hãy khai báo Dãy ở bước 3 trước.</div>'}${setupErrs(4)}`;
    if (step === 5) { const count = d.pointGroups.reduce((s,g)=>s+sn(g.quantity),0); body = `<h3>5. Kiểm tra & hoàn tất</h3><div class="mb-stats">${tile('Khối/Nhà',fmt(d.buildings.length))}${tile('Tầng',fmt(d.floors.length))}${tile('Dãy',fmt(d.rows.length))}${tile('Điểm kinh doanh',fmt(count))}</div>${d.buildings.map(b=>`<div class="card" style="margin-top:10px"><div class="card-h"><h3>${U.esc(b.name)}</h3></div><div class="card-b">${d.rows.filter(r=>r.buildingDraftId===b.id).map(r=>{const gs=groupsFor(r.id),a=gs.reduce((s,g)=>s+sn(g.quantity)*sn(g.areaPerPoint),0);return `<div><b>${U.esc(preview.rowCodes[r.id])}</b> · ${U.esc(r.industry)}<div class="small muted">${gs.reduce((s,g)=>s+sn(g.quantity),0)} điểm · ${fmt(a)}/${fmt(r.allocatedArea)} m²</div></div>`}).join('')}</div></div>`).join('')}${check.capacity?`<div class="note info" style="margin-top:10px">Chỉ tiêu được kiểm tra đồng thời theo số điểm và diện tích từng loại.</div>`:'<div class="note info" style="margin-top:10px">Chợ chưa có chỉ tiêu theo loại diện tích; không hiển thị giới hạn giả.</div>'}${check.ok?'<div class="note ok" style="margin-top:10px">Bản nháp hợp lệ và sẵn sàng ghi dữ liệu mặt bằng.</div>':`<div class="note danger" style="margin-top:10px"><b>Cần sửa trước khi hoàn tất:</b><ul>${check.errors.map(x=>`<li>${U.esc(x)}</li>`).join('')}</ul></div>`}`; }
    return `<div class="modal-b"><div class="mb-setup-stepper">${setupTitle.map((x,i)=>`<span class="${i+1===step?'active':i+1<step?'done':''}">${i+1}. ${x}</span>`).join('')}</div>${body}</div><div class="modal-f"><button class="btn" data-act="mb-setup-cancel">Hủy</button><span class="spacer"></span>${step>1?'<button class="btn" data-act="mb-setup-back">Quay lại</button>':''}${step<5?'<button class="btn primary" data-act="mb-setup-next">Tiếp tục</button>':`<button class="btn primary" data-act="mb-setup-finish" ${check.ok?'':'disabled'}>Hoàn tất thiết lập mặt bằng</button>`}</div>`;
  }
  const renderSetup = () => A.modal(A.mHead('Thiết lập mặt bằng ban đầu') + `<div class="modal-sub">${U.esc(U.market(setupDraft().marketId).name)}</div>` + setupModalHtml());

  // Compact extension flow for one existing Row. It delegates validation/preview/commit to
  // S.pointGroups, the same PointGroup engine used by the initial-setup wizard.
  const pointDraft = () => ui.mb.pointDraft;
  function renderPointAdd() {
    const d = pointDraft(); if (!d) return;
    const r = A.idx.row.get(d.rowId), mid = d.marketId; if (!r) return;
    const info = rowInfo(r), result = S.pointGroups.validate(mid, r.id, d.groups);
    const groups = d.groups || [], count = groups.reduce((s, g) => s + (Number(g.quantity) || 0), 0);
    const rows = groups.map(g => `<tr class="mb-point-group"><td data-label="Loại diện tích"><select class="input" data-ch="mb-point-field" data-id="${g.id}" data-key="areaTypeId">${U.AREA_TYPE_CODES.map(k => `<option value="${k}" ${k === g.areaTypeId ? 'selected' : ''}>${U.esc(U.areaTypeLabel(k))}</option>`).join('')}</select></td><td data-label="Số điểm"><input class="input" type="number" min="1" step="1" data-in="mb-point-field" data-ch="mb-point-field" data-id="${g.id}" data-key="quantity" value="${U.esc(String(g.quantity || ''))}"></td><td data-label="DT/điểm"><input class="input" type="number" min="0" data-in="mb-point-field" data-ch="mb-point-field" data-id="${g.id}" data-key="areaPerPoint" value="${U.esc(String(g.areaPerPoint || ''))}"></td><td data-label="Tổng DT">${fmt((Number(g.quantity)||0)*(Number(g.areaPerPoint)||0))} m²</td><td class="mb-point-remove"><button class="btn sm danger" data-act="mb-point-group-remove" data-id="${g.id}">Xóa</button></td></tr><tr class="mb-point-preview"><td colspan="5" class="small muted">Preview: ${(result.pointCodes[g.id] || []).map(U.esc).join(', ') || '—'}</td></tr>`).join('');
    const exhausted = info.remaining <= 1e-9;
    const body = exhausted ? `<div class="modal-b"><div class="note info"><b>Dãy ${U.esc(r.code)} đã sử dụng hết diện tích được phân bổ.</b><div>${fmt(info.used)} / ${fmt(info.alloc)} m²</div></div></div><div class="modal-f"><button class="btn" data-act="close">Đóng</button><button class="btn primary" data-act="qh-zone-edit-open" data-id="${r.id}">Điều chỉnh diện tích Dãy</button></div>` : `<div class="modal-b mb-point-add"><div class="mb-point-context"><b>Dãy ${U.esc(r.code)} · ${U.esc(r.industry)}</b><div class="small muted">Ngành hàng được kế thừa từ Dãy và không thể thay đổi tại đây.</div></div><div class="mb-stats" style="margin-top:12px">${tile('Diện tích phân bổ',m2(info.alloc))}${tile('Đã bố trí',m2(info.used))}${tile('Còn có thể bố trí',m2(Math.max(0, info.remaining)))}${tile('Số điểm hiện tại',fmt(info.pts.length))}</div>${result.capacity ? '' : '<div class="note info" style="margin-top:12px">Chợ chưa được khai báo chỉ tiêu theo loại diện tích. Hệ thống hiện chỉ kiểm tra diện tích còn lại của Dãy.</div>'}<div class="tbl-wrap" style="margin-top:12px"><table class="tbl mb-point-table"><thead><tr><th>Loại diện tích</th><th>Số điểm</th><th>DT/điểm</th><th>Tổng DT</th><th></th></tr></thead><tbody>${rows}</tbody></table></div><button class="btn sm" data-act="mb-point-group-add">+ Thêm nhóm</button>${result.errors.length ? `<div class="note danger" style="margin-top:12px">${result.errors.map(x=>`<div>${U.esc(x)}</div>`).join('')}</div>` : ''}</div><div class="modal-f"><button class="btn" data-act="mb-point-cancel">Hủy</button><span class="spacer"></span><button class="btn primary" data-act="mb-point-commit" ${result.ok && count ? '' : 'disabled'}>Tạo ${fmt(count)} điểm</button></div>`;
    A.modal(A.mHead('Thêm điểm kinh doanh') + body);
  }
  function openCollectorAssignment(mid, rowId) {
    const r = A.idx.row.get(rowId), BPsvc = BP(); if (!r) return; ui.mb.assignmentRowId = rowId;
    const current = r.collectorId ? A.ACCOUNTS.get(r.collectorId) : null, candidates = BPsvc.collectorAccounts(mid);
    const selected = ui.mb.assignmentCollectorId == null ? (r.collectorId || '') : ui.mb.assignmentCollectorId;
    const loc = [A.idx.building.get(r.buildingId), r.floorId && A.idx.floor.get(r.floorId)].filter(Boolean).map(x => x.name).join(' / ') || '—';
    const sel = selected ? A.ACCOUNTS.get(selected) : null, load = sel ? BPsvc.collectorLoad(sel.id, mid) : null;
    A.modal(A.mHead('Phân công nhân viên thu phí') + `<div class="modal-b"><dl class="kv"><dt>Dãy</dt><dd><b>${U.esc(r.code)}</b> · ${U.esc(r.industry)}</dd><dt>Vị trí</dt><dd>${U.esc(loc)}</dd><dt>Hiện tại</dt><dd>${U.esc(current ? current.fullName : 'Chưa phân công')}</dd></dl><div class="field"><label>Nhân viên thu phí</label><select class="input" data-ch="mb-assignment-select"><option value="">— Chưa phân công —</option>${candidates.map(a => `<option value="${a.id}" ${a.id === selected ? 'selected' : ''}>${U.esc(a.fullName)}${a.phone ? ' · ' + U.esc(a.phone) : ''}</option>`).join('')}</select></div>${sel ? `<div class="note info">Phạm vi chợ: ${U.esc(U.market(mid).name)}<br>Đang phụ trách: ${load.rows} Dãy · ${load.points} điểm kinh doanh</div>` : '<div class="note info">Dãy có thể ở trạng thái Chưa phân công.</div>'}</div><div class="modal-f"><button class="btn" data-act="close">Hủy</button><button class="btn primary" data-act="mb-assignment-save" data-id="${r.id}">Lưu phân công</button></div>`);
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
    'mb-filter-status': el => { ui.mb.filter.status = el.dataset.id; A.render(); },
    'mb-filter-clear': () => { ui.mb.filter = { search: '', status: '', cat: '', areaType: '' }; A.render(); },
    'mb-setup': () => {
      const mid = qhMarket();
      if (!A.canDo('cau-truc.edit', mid)) return;
      if (setup.graphExists(mid)) { U.toast('Chợ này đã có cấu trúc mặt bằng; chỉ dùng workspace để bổ sung/chỉnh sửa.'); return; }
      ui.mb.setupDraft = setup.createDraft(mid); ui.mb.setupDraft.step = 1; renderSetup();
    },
    'mb-setup-add': el => {
      const d = setupDraft(); if (!d) return;
      const kind = el.dataset.kind, id = `tmp-${kind}-${d.seq[kind]++}`;
      if (kind === 'building') d.buildings.push({ id, name: '', hasFloors: true });
      if (kind === 'floor') d.floors.push({ id, buildingDraftId: el.dataset.building, name: '', businessArea: '' });
      if (kind === 'row') d.rows.push({ id, buildingDraftId: el.dataset.building, floorDraftId: el.dataset.floor || null, name: '', industry: '', allocatedArea: '' });
      if (kind === 'group') d.pointGroups.push({ id, rowDraftId: el.dataset.row, areaTypeId: U.AREA_TYPE_CODES[0], quantity: 1, areaPerPoint: '' });
      renderSetup();
    },
    'mb-setup-remove': el => {
      const d = setupDraft(); if (!d) return;
      const kind = el.dataset.kind, id = el.dataset.id;
      if (kind === 'building') { const fs = new Set(d.floors.filter(x => x.buildingDraftId === id).map(x => x.id)), rs = new Set(d.rows.filter(x => x.buildingDraftId === id).map(x => x.id)); d.buildings = d.buildings.filter(x => x.id !== id); d.floors = d.floors.filter(x => !fs.has(x.id)); d.rows = d.rows.filter(x => !rs.has(x.id)); d.pointGroups = d.pointGroups.filter(x => !rs.has(x.rowDraftId)); }
      if (kind === 'floor') { const rs = new Set(d.rows.filter(x => x.floorDraftId === id).map(x => x.id)); d.floors = d.floors.filter(x => x.id !== id); d.rows = d.rows.filter(x => !rs.has(x.id)); d.pointGroups = d.pointGroups.filter(x => !rs.has(x.rowDraftId)); }
      if (kind === 'row') { d.rows = d.rows.filter(x => x.id !== id); d.pointGroups = d.pointGroups.filter(x => x.rowDraftId !== id); }
      if (kind === 'group') d.pointGroups = d.pointGroups.filter(x => x.id !== id);
      renderSetup();
    },
    'mb-setup-back': () => { const d = setupDraft(); if (d) { d.step = Math.max(1, d.step - 1); renderSetup(); } },
    'mb-setup-next': () => { const d = setupDraft(); if (!d) return; const c = setup.validate(d); if ((c.byStep[d.step] || []).length) { U.toast(c.byStep[d.step][0]); renderSetup(); return; } d.step = Math.min(5, d.step + 1); renderSetup(); },
    'mb-setup-cancel': () => { const d = setupDraft(); if (!d) return; A.modal(A.mHead('Bỏ thiết lập mặt bằng?') + `<div class="modal-b">Các thông tin đang nhập chỉ là bản nháp và chưa được lưu vào dữ liệu mặt bằng.</div><div class="modal-f"><button class="btn" data-act="mb-setup-cancel-back">Tiếp tục chỉnh sửa</button><button class="btn danger" data-act="mb-setup-cancel-ok">Bỏ bản nháp</button></div>`); },
    'mb-setup-cancel-back': () => renderSetup(),
    'mb-setup-cancel-ok': () => { ui.mb.setupDraft = null; A.closeModal(); },
    'mb-setup-finish': () => {
      const d = setupDraft(); if (!d || !A.canDo('cau-truc.edit', d.marketId)) return;
      const res = setup.commit(d);
      if (!res.ok) { d.step = res.step || 5; renderSetup(); U.toast((res.errors || ['Không thể hoàn tất thiết lập.'])[0]); return; }
      ui.mb.setupDraft = null; ui.mb.sel = res.buildings.length ? { k: 'building', id: res.buildings[0].id } : null;
      A.closeModal(); A.render(); U.toast('Đã thiết lập mặt bằng cho ' + U.market(d.marketId).name + '.');
    },
    'mb-add-point': el => {
      const mid = qhMarket(), r = A.idx.row.get(el.dataset.id);
      if (!r || r.market !== mid || !A.canDo('cau-truc.edit', mid)) return;
      ui.mb.pointDraft = { marketId: mid, rowId: r.id, groups: [{ id: 'tmp-point-group-1', areaTypeId: U.AREA_TYPE_CODES[0], quantity: 1, areaPerPoint: '' }], seq: 2 };
      renderPointAdd();
    },
    'mb-point-group-add': () => { const d = pointDraft(); if (!d) return; d.groups.push({ id: 'tmp-point-group-' + d.seq++, areaTypeId: U.AREA_TYPE_CODES[0], quantity: 1, areaPerPoint: '' }); renderPointAdd(); },
    'mb-point-group-remove': el => { const d = pointDraft(); if (!d) return; d.groups = d.groups.filter(g => g.id !== el.dataset.id); renderPointAdd(); },
    'mb-point-cancel': () => { ui.mb.pointDraft = null; A.closeModal(); },
    'mb-point-commit': () => {
      const d = pointDraft(); if (!d || !A.canDo('cau-truc.edit', d.marketId)) return;
      const out = S.pointGroups.commit(d.marketId, d.rowId, d.groups);
      if (!out.ok) { renderPointAdd(); U.toast(out.errors[0]); return; }
      const code = A.idx.row.get(d.rowId).code; ui.mb.pointDraft = null; A.closeModal(); A.render(); U.toast(`Đã tạo ${out.stalls.length} điểm kinh doanh tại Dãy ${code}.`);
    },
    // Phân công NV thu phí: tạm dùng drawer "Sửa Dãy" (mục Phân công thu phí) — redesign ở task sau.
    'mb-assign-collector': el => {
      const mid = qhMarket();
      if (!A.canDo('cau-truc.edit', mid) || !findZone(mid, el.dataset.id)) return;
      ui.mb.assignmentCollectorId = null; openCollectorAssignment(mid, el.dataset.id);
    },
    'mb-assignment-save': el => {
      const mid = qhMarket(), row = A.idx.row.get(el.dataset.id), next = ui.mb.assignmentCollectorId == null ? (row && row.collectorId || '') : ui.mb.assignmentCollectorId;
      if (!row || row.market !== mid) return;
      const previous = row.collectorId, changed = previous !== (next || null);
      if (changed && previous && next) { ui.mb.assignmentPending = { mid, rowId: row.id, next }; A.modal(A.mHead('Xác nhận đổi phân công') + `<div class="modal-b">Dãy <b>${U.esc(row.code)}</b> hiện do <b>${U.esc((A.ACCOUNTS.get(previous)||{}).fullName || '—')}</b> phụ trách. Sau khi thay đổi, <b>${U.esc((A.ACCOUNTS.get(next)||{}).fullName || '—')}</b> sẽ phụ trách các nghiệp vụ phát sinh thuộc Dãy này.</div><div class="modal-f"><button class="btn" data-act="mb-assignment-back" data-id="${row.id}">Hủy</button><button class="btn primary" data-act="mb-assignment-confirm">Xác nhận</button></div>`); return; }
      if (changed && previous && !next) { ui.mb.assignmentPending = { mid, rowId: row.id, next: '' }; A.modal(A.mHead('Gỡ phân công') + `<div class="modal-b">Sau khi gỡ phân công, Dãy <b>${U.esc(row.code)}</b> sẽ chưa có nhân viên thu phí phụ trách.</div><div class="modal-f"><button class="btn" data-act="mb-assignment-back" data-id="${row.id}">Hủy</button><button class="btn danger" data-act="mb-assignment-confirm">Gỡ phân công</button></div>`); return; }
      const out = BP().assignRowCollector(mid, row.id, next); if (!out.ok) { U.toast(out.errors[0]); return; } ui.mb.assignmentCollectorId = null; A.closeModal(); A.render(); U.toast(next ? 'Đã lưu phân công nhân viên thu phí.' : 'Đã gỡ phân công nhân viên thu phí.');
    },
    'mb-assignment-back': el => { const p = ui.mb.assignmentPending; ui.mb.assignmentPending = null; if (p) openCollectorAssignment(p.mid, el.dataset.id); },
    'mb-assignment-confirm': () => { const p = ui.mb.assignmentPending; if (!p) return; const out = BP().assignRowCollector(p.mid, p.rowId, p.next); ui.mb.assignmentPending = null; if (!out.ok) { U.toast(out.errors[0]); return; } ui.mb.assignmentCollectorId = null; A.closeModal(); A.render(); U.toast(p.next ? 'Đã đổi phân công nhân viên thu phí.' : 'Đã gỡ phân công nhân viên thu phí.'); },
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
      if (!A.canDo('cau-truc.edit', qhMarket())) return;
      A.modal(A.mHead('Thêm Khối/Nhà chợ') + `<div class="modal-b"><div class="field"><label>Tên Khối/Nhà chợ *</label><input class="input" id="qhb-name" placeholder="VD: Nhà chợ chính"></div></div>
        <div class="modal-f"><button class="btn" data-act="close">Hủy</button><button class="btn primary" data-act="qh-add-block-save">Thêm</button></div>`);
    },
    'qh-add-block-save': () => {
      const mid = qhMarket();
      if (!A.canDo('cau-truc.edit', mid)) return;
      const name = A.$('#qhb-name').value.trim();
      if (!name) { U.toast('Vui lòng nhập tên Khối/Nhà chợ'); return; }
      const b = S.addBuilding(mid, name);
      ui.mb.sel = { k: 'building', id: b.id };
      saveLayout(); A.closeModal(); A.render(); U.toast('Đã thêm Khối/Nhà chợ "' + name + '"');
    },
    'qh-edit-block': el => {
      const mid = qhMarket();
      if (!A.canDo('cau-truc.edit', mid)) return;
      const b = findBlock(mid, el.dataset.id);
      if (!b) return;
      A.modal(A.mHead('Chỉnh sửa Khối/Nhà chợ') + `<div class="modal-b"><div class="field"><label>Tên Khối/Nhà chợ *</label><input class="input" id="qhb-name" value="${U.esc(b.name)}"></div></div>
        <div class="modal-f"><button class="btn" data-act="close">Hủy</button><button class="btn primary" data-act="qh-edit-block-save" data-id="${b.key}">Lưu</button></div>`);
    },
    'qh-edit-block-save': el => {
      if (!A.canDo('cau-truc.edit', qhMarket())) return;
      const name = A.$('#qhb-name').value.trim();
      if (!name) { U.toast('Vui lòng nhập tên Khối/Nhà chợ'); return; }
      S.renameBuilding(el.dataset.id, name);
      saveLayout(); A.closeModal(); A.render(); U.toast('Đã cập nhật');
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
      A.modal(A.mHead('Thêm tầng') + `<div class="modal-b"><div class="form-grid"><div class="field"><label>Tên tầng *</label><input class="input" id="qhf-name" placeholder="VD: Tầng 1"></div>${areaField('qhf-area', null)}</div></div>
        <div class="modal-f"><button class="btn" data-act="close">Hủy</button><button class="btn primary" data-act="qh-add-floor-save" data-block="${el.dataset.block}">Thêm</button></div>`);
    },
    'qh-add-floor-save': el => {
      if (!A.canDo('cau-truc.edit', qhMarket())) return;
      const name = A.$('#qhf-name').value.trim();
      if (!name) { U.toast('Vui lòng nhập tên tầng'); return; }
      const res = S.addFloor(el.dataset.block, name, A.$('#qhf-area') ? A.$('#qhf-area').value : null);
      if (res.errors) { U.toast(res.errors[0]); return; }
      ui.mb.sel = { k: 'floor', id: res.floor.id };
      saveLayout(); A.closeModal(); A.render(); U.toast('Đã thêm tầng "' + name + '"');
    },
    'qh-edit-floor': el => {
      const mid = qhMarket();
      if (!A.canDo('cau-truc.edit', mid)) return;
      const f = S.floorsOf(mid).find(x => x.id === el.dataset.id);
      if (!f) return;
      A.modal(A.mHead('Chỉnh sửa tầng') + `<div class="modal-b"><div class="form-grid"><div class="field"><label>Tên tầng *</label><input class="input" id="qhf-name" value="${U.esc(f.name)}"></div>${areaField('qhf-area', f.businessArea)}</div>
        <div class="small muted" style="margin-top:8px">Tổng diện tích phân bổ cho các Dãy trên tầng không được vượt diện tích kinh doanh của tầng.</div></div>
        <div class="modal-f"><button class="btn" data-act="close">Hủy</button><button class="btn primary" data-act="qh-edit-floor-save" data-block="${f.buildingId}" data-id="${f.id}">Lưu</button></div>`);
    },
    'qh-edit-floor-save': el => {
      if (!A.canDo('cau-truc.edit', qhMarket())) return;
      const name = A.$('#qhf-name').value.trim();
      if (!name) { U.toast('Vui lòng nhập tên tầng'); return; }
      const errs = S.updateFloor(el.dataset.id, { name, businessArea: A.$('#qhf-area') ? A.$('#qhf-area').value : null });
      if (errs.length) { U.toast(errs[0]); return; }
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
      ui.mb.zoneDraft = { mid, place, industry: '', code: '', name: '', nameDirty: false };
      renderAddZone();
    },
    'qh-add-zone-save': () => {
      const d = ui.mb.zoneDraft, mid = qhMarket();
      if (!d || d.mid !== mid || !A.canDo('cau-truc.edit', mid)) return;
      readZoneName(d);
      if (!d.industry) { U.toast('Vui lòng chọn ngành hàng.'); return; }
      if (!d.name) { U.toast('Chưa nhập tên dãy.'); return; }
      // Save-time regeneration: if another Row took the candidate meanwhile, show the new code instead of saving.
      const fresh = S.nextRowCode(mid, d.industry);
      if (!d.code || fresh !== d.code) { setZoneIndustry(d, d.industry); renderAddZone(); U.toast('Mã Dãy đã được cập nhật thành ' + d.code + ' do dữ liệu Dãy thay đổi. Vui lòng kiểm tra rồi bấm Thêm.'); return; }
      const res = S.addRow(mid, d.place, d.code, d.name, d.industry);
      if (res.errors) { U.toast(res.errors[0]); return; }
      ui.mb.zoneDraft = null;
      saveLayout(); A.closeModal();
      // Mở luôn drawer "Sửa Dãy" để khai báo tiếp diện tích phân bổ.
      qhOpenZoneDrawer(mid, res.row.id);
      U.toast('Đã thêm Dãy ' + res.row.code + '. Vui lòng khai báo diện tích phân bổ.');
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
  // Phân công NV thu phí theo Dãy: ghi row.collectorId (thay thế phân công cũ, không cộng dồn).
  A.CH['qh-zone-collector'] = el => {
    const mid = qhMarket();
    if (!A.canDo('cau-truc.edit', mid)) { A.render(); return; }
    const z = findZone(mid, el.dataset.zone);
    if (!z) return;
    const collectorId = el.value || null;
    const assigned = BP().assignRowCollector(mid, z.key, collectorId);
    if (!assigned.ok) { U.toast(assigned.errors[0]); return; }
    const acc = collectorId ? A.ACCOUNTS.get(collectorId) : null;
    U.toast(acc ? `Đã phân công ${acc.fullName} phụ trách thu phí Dãy ${z.code}` : `Đã bỏ phân công thu phí Dãy ${z.code}`);
    A.render(); qhSyncDrawer();
  };
  // Draft field handlers intentionally do not persist or mutate A.db.
  A.IN['mb-setup-field'] = el => {
    const d = setupDraft(); if (!d) return;
    const item = setupItem(el.dataset.kind, el.dataset.id); if (!item) return;
    item[el.dataset.key] = el.value;
  };
  A.CH['mb-setup-field'] = el => {
    const d = setupDraft(); if (!d) return;
    const item = setupItem(el.dataset.kind, el.dataset.id); if (!item) return;
    item[el.dataset.key] = el.dataset.key === 'hasFloors' ? el.value === 'true' : el.value;
    renderSetup();
  };
  A.IN['mb-point-field'] = el => { const d = pointDraft(), g = d && d.groups.find(x => x.id === el.dataset.id); if (g) g[el.dataset.key] = el.value; };
  A.CH['mb-point-field'] = el => { const d = pointDraft(), g = d && d.groups.find(x => x.id === el.dataset.id); if (g) { g[el.dataset.key] = el.value; renderPointAdd(); } };
  A.CH['mb-assignment-select'] = el => { ui.mb.assignmentCollectorId = el.value || ''; const row = A.idx.row.get(ui.mb.assignmentRowId); if (row) openCollectorAssignment(qhMarket(), row.id); };
  A.IN['mb-filter-search'] = el => { ui.mb.filter.search = el.value; A.render(); };
  A.CH['mb-filter-cat'] = el => { ui.mb.filter.cat = el.value; A.render(); };
  A.CH['mb-filter-area-type'] = el => { ui.mb.filter.areaType = el.value; A.render(); };
  // "Tình trạng tại ngày": chỉ đổi ngày xem (UI, không lưu); chip/bảng/sơ đồ tính lại theo hợp đồng.
  A.CH['mb-status-date'] = el => { A.mbSetStatusDate(el.value); ui.page.dkcl = 0; A.render(); };
  A.ACT['mb-status-today'] = () => { A.mbSetStatusDate(null); ui.page.dkcl = 0; A.render(); };

  A.mbWorkspaceHtml = mbWorkspaceHtml;
  A.VIEWS['mat-bang'] = mbWorkspaceHtml;
})(window.APP);

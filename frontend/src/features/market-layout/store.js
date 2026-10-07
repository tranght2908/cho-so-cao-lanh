/* Market layout store (v16) — read-model + commands over the SINGLE layout graph in A.db (AGENTS §12):
 *   A.db.buildings (Khối/Nhà chợ) → A.db.floors (Tầng, TUỲ CHỌN) → A.db.rows (Dãy: đúng 1 ngành hàng,
 *   allocatedArea) → A.db.stalls (điểm kinh doanh, rowId).
 * Persisted with the rest of A.db ('choso-caolanh-state'). The legacy key 'choso-caolanh-layout' is no
 * longer read or written (left untouched in the browser as a backup).
 * The current Mặt bằng UI still consumes a nested view block → floor → zone; that view is DERIVED here on
 * every call (zone = Dãy). A building's rows without floor are grouped under one virtual floor
 * ({virtual:true}, key NO_FLOOR + buildingId) that exists only in the view, never in data. */
(function (A) {
  'use strict';
  const D = A.D, U = A.U;
  const NO_FLOOR = 'NF:';

  const db = () => A.db;
  const list = name => (db() && db()[name]) || [];
  const byMarket = (name, mid) => list(name).filter(x => x.market === mid).sort((a, b) => (a.order || 0) - (b.order || 0));
  const seqId = (prefix, name) => { let n = list(name).length + 1, id; do { id = prefix + n++; } while (list(name).some(x => x.id === id)); return id; };
  const realFloorId = fk => (!fk || String(fk).indexOf(NO_FLOOR) === 0) ? null : fk;

  // ---------- nested view cho UI hiện tại ----------
  function zoneView(r) {
    return { key: r.id, code: r.code, name: r.name, blockId: r.buildingId, floorId: r.floorId || NO_FLOOR + r.buildingId,
      catMain: r.industry || '', area: Number(r.allocatedArea) || 0, note: r.note || '', status: r.status, row: r };
  }
  function blockView(b) {
    const rows = list('rows').filter(r => r.buildingId === b.id).sort((x, y) => (x.order || 0) - (y.order || 0));
    const floors = list('floors').filter(f => f.buildingId === b.id).sort((x, y) => (x.order || 0) - (y.order || 0))
      .map(f => ({ key: f.id, name: f.name, businessArea: f.businessArea == null ? null : Number(f.businessArea), zones: rows.filter(r => r.floorId === f.id).map(zoneView), floor: f }));
    const loose = rows.filter(r => !r.floorId);
    if (!floors.length || loose.length) floors.push({ key: NO_FLOOR + b.id, name: 'Không chia tầng', virtual: true, businessArea: null, zones: loose.map(zoneView) });
    return { key: b.id, name: b.name, floors, building: b };
  }
  function blocksOf(mid) { return byMarket('buildings', mid).map(blockView); }
  function findBlock(mid, bk) { return blocksOf(mid).find(b => b.key === bk); }
  function floorsOfBlock(mid, bk) { const b = findBlock(mid, bk); return b ? b.floors : []; }
  function findFloor(mid, bk, fk) { return floorsOfBlock(mid, bk).find(f => f.key === fk); }
  function firstFloorKey(mid, bk) { const fs = floorsOfBlock(mid, bk); return fs.length ? fs[0].key : null; }
  function firstZonePlace(mid) {
    const b = blocksOf(mid)[0];
    const f = b && b.floors[0];
    return b && f ? { blockId: b.key, floorId: f.key } : null;
  }
  function findFloorOfZone(mid, zk) {
    for (const b of blocksOf(mid)) for (const f of b.floors) if (f.zones.some(z => z.key === zk)) return f;
    return null;
  }
  function findZone(mid, zk) { const r = A.idx && A.idx.row ? A.idx.row.get(zk) : null; return r && r.market === mid ? zoneView(r) : null; }
  function flatZones(mid) { return byMarket('rows', mid).map(zoneView); }
  function codeTaken(mid, code, excludeKey) {
    const c = String(code || '').trim().toLowerCase();
    return byMarket('rows', mid).some(r => r.id !== excludeKey && String(r.code || '').trim().toLowerCase() === c);
  }
  function marketLayoutStats(mid) {
    const pts = list('stalls').filter(st => st.market === mid);
    return { blocks: byMarket('buildings', mid).length, floors: byMarket('floors', mid).length, zones: byMarket('rows', mid).length,
      pts: pts.length, area: U.sum(pts, st => Number(st.area) || 0), draft: 0 };
  }
  const pointsOfRow = rowId => list('stalls').filter(st => st.rowId === rowId);
  const rowsOfFloor = floorId => list('rows').filter(r => r.floorId === floorId);

  // ---------- ngân sách diện tích theo cấp ----------
  // Mỗi cấp chỉ so với con TRỰC TIẾP: Chợ (businessArea, Danh mục chợ) → Khối/Nhà (businessArea) → Tầng
  // (businessArea) hoặc Dãy không chia tầng → Dãy (allocatedArea) → Điểm (area). Không cộng điểm vào tầng
  // (không double count). Giá trị null = chưa khai báo (dữ liệu cũ) → cấp đó chưa giới hạn con.
  const areaOf = (x, key) => x[key] == null || x[key] === '' ? null : Number(x[key]);
  const sumOf = (arr, key) => U.sum(arr, x => Number(x[key]) || 0);
  const floorsOfBuilding = bid => list('floors').filter(f => f.buildingId === bid);
  const looseRowsOfBuilding = bid => list('rows').filter(r => r.buildingId === bid && !r.floorId);
  function budgetOf(total, allocated) { return { total, allocated, remaining: total == null ? null : total - allocated }; }
  function marketBudget(mid) {
    const m = marketMeta(mid), bs = byMarket('buildings', mid);
    return Object.assign(budgetOf(m && m.businessArea != null ? Number(m.businessArea) : null, sumOf(bs, 'businessArea')), { unsetChildren: bs.filter(b => areaOf(b, 'businessArea') == null).length });
  }
  function buildingBudget(b) {
    const floors = floorsOfBuilding(b.id), kids = floors.length ? floors : looseRowsOfBuilding(b.id);
    return Object.assign(budgetOf(areaOf(b, 'businessArea'), sumOf(kids, floors.length ? 'businessArea' : 'allocatedArea')), { childKind: floors.length ? 'floor' : 'row' });
  }
  function floorBudget(f) { return budgetOf(areaOf(f, 'businessArea'), sumOf(rowsOfFloor(f.id), 'allocatedArea')); }
  function rowBudget(r) { return budgetOf(Number(r.allocatedArea) || 0, sumOf(pointsOfRow(r.id), 'area')); }
  const over = (sum, cap) => sum > cap + 1e-9;
  const exceedMsg = (by, what) => `Vượt ${fmt(by)} m² so với diện tích ${what}.`;
  // phrase: "các Dãy hiện đang được phân bổ tổng cộng" / "các điểm kinh doanh trong Dãy hiện có tổng diện tích".
  const shrinkMsg = (value, phrase, used) => `Không thể giảm xuống ${fmt(value)} m² vì ${phrase} ${fmt(used)} m².`;

  // ---------- validation ----------
  // SUM(point.area trong Dãy) <= row.allocatedArea; SUM(row.allocatedArea trên Tầng) <= floor.businessArea;
  // Dãy không chia tầng: SUM(row.allocatedArea của Khối) <= building.businessArea.
  function rowErrors(row) {
    const errs = [];
    const used = U.sum(pointsOfRow(row.id), st => Number(st.area) || 0);
    if (!String(row.code || '').trim()) errs.push('Chưa nhập mã dãy.');
    else if (codeTaken(row.market, row.code, row.id)) errs.push('Mã dãy "' + row.code + '" đã tồn tại trong chợ này.');
    if (!String(row.name || '').trim()) errs.push('Chưa nhập tên dãy.');
    if (!row.industry) errs.push('Mỗi dãy phải có đúng 1 ngành hàng.');
    if (!(Number(row.allocatedArea) >= 0)) errs.push('Diện tích phân bổ của dãy không hợp lệ.');
    else if (over(used, Number(row.allocatedArea))) errs.push(shrinkMsg(row.allocatedArea, 'các điểm kinh doanh trong Dãy hiện có tổng diện tích', used));
    const f = row.floorId ? list('floors').find(x => x.id === row.floorId) : null;
    if (f && f.businessArea != null) {
      const sum = U.sum(rowsOfFloor(f.id).filter(r => r.id !== row.id), r => Number(r.allocatedArea) || 0) + (Number(row.allocatedArea) || 0);
      if (over(sum, Number(f.businessArea))) errs.push(exceedMsg(sum - Number(f.businessArea), 'còn lại của ' + f.name));
    }
    const b = !row.floorId ? list('buildings').find(x => x.id === row.buildingId) : null;
    if (b && areaOf(b, 'businessArea') != null) {
      const sum = sumOf(looseRowsOfBuilding(b.id).filter(r => r.id !== row.id), 'allocatedArea') + (Number(row.allocatedArea) || 0);
      if (over(sum, Number(b.businessArea))) errs.push(exceedMsg(sum - Number(b.businessArea), 'còn lại của Khối/Nhà "' + b.name + '"'));
    }
    // A floorless Row still consumes the market's structural business area. This also protects
    // a row adjustment where no Floor capacity exists to enforce the boundary.
    const market = marketMeta(row.market);
    if (market && market.businessArea != null) {
      const total = U.sum(byMarket('rows', row.market).filter(r => r.id !== row.id), r => Number(r.allocatedArea) || 0) + (Number(row.allocatedArea) || 0);
      if (total > Number(market.businessArea) + 1e-9) errs.push('Tổng diện tích phân bổ các Dãy của chợ (' + total.toLocaleString('vi-VN') + ' m²) vượt diện tích phục vụ kinh doanh (' + Number(market.businessArea).toLocaleString('vi-VN') + ' m²).');
    }
    return errs;
  }

  // ---------- commands (in-memory; the caller saves with A.save()) ----------
  // Khối/Nhà: businessArea = diện tích kinh doanh được phân bổ từ chợ (null = dữ liệu cũ chưa khai báo).
  function buildingErrors(b) {
    const errs = [];
    if (!String(b.name || '').trim()) errs.push('Chưa nhập tên Khối/Nhà chợ.');
    else if (byMarket('buildings', b.market).some(x => x.id !== b.id && norm(x.name) === norm(b.name))) errs.push('Tên Khối/Nhà chợ "' + b.name + '" đã tồn tại trong chợ này.');
    if (String(b.code || '').trim() && byMarket('buildings', b.market).some(x => x.id !== b.id && norm(x.code) === norm(b.code))) errs.push('Mã Khối/Nhà "' + b.code + '" đã tồn tại trong chợ này.');
    const area = areaOf(b, 'businessArea');
    if (area == null) return errs;
    if (!(area > 0)) { errs.push('Diện tích kinh doanh phân bổ cho Khối/Nhà phải lớn hơn 0.'); return errs; }
    const kids = buildingBudget(b);
    if (over(kids.allocated, area)) errs.push(shrinkMsg(area, kids.childKind === 'floor' ? 'các Tầng hiện đang được phân bổ tổng cộng' : 'các Dãy hiện đang được phân bổ tổng cộng', kids.allocated));
    const m = marketMeta(b.market);
    if (m && m.businessArea != null) {
      const sum = sumOf(byMarket('buildings', b.market).filter(x => x.id !== b.id), 'businessArea') + area;
      if (over(sum, Number(m.businessArea))) errs.push(exceedMsg(sum - Number(m.businessArea), 'phục vụ kinh doanh còn lại của chợ'));
    }
    return errs;
  }
  // Mã gợi ý B1, B2… (cùng quy ước bản thiết lập ban đầu cũ), không trùng mã đã có trong chợ.
  function nextBuildingCode(mid) {
    const taken = new Set(byMarket('buildings', mid).map(b => norm(b.code)));
    let i = byMarket('buildings', mid).length + 1, code;
    do { code = 'B' + i++; } while (taken.has(norm(code)));
    return code;
  }
  function nextFloorCode(bid) {
    const taken = new Set(floorsOfBuilding(bid).map(f => norm(f.code)));
    let i = floorsOfBuilding(bid).length + 1, code;
    do { code = 'T' + i++; } while (taken.has(norm(code)));
    return code;
  }
  // fields: { name, code, businessArea } — trả về { building } hoặc { errors } (không ghi khi lỗi).
  function addBuilding(mid, fields) {
    const f = fields || {};
    const b = { id: seqId(mid + '-B-', 'buildings'), market: mid, code: String(f.code || '').trim() || nextBuildingCode(mid), name: String(f.name || '').trim(),
      businessArea: areaOrNull(f.businessArea), order: byMarket('buildings', mid).length + 1, status: 'active' };
    const errs = buildingErrors(b);
    if (errs.length) return { errors: errs };
    db().buildings = list('buildings').concat([b]); A.reindex(); return { building: b };
  }
  // patch: name, code, businessArea — trả về lỗi (không ghi) nếu vi phạm.
  function updateBuilding(id, patch) {
    const b = list('buildings').find(x => x.id === id);
    if (!b) return ['Không tìm thấy Khối/Nhà chợ.'];
    const next = Object.assign({}, b, patch);
    if ('businessArea' in patch) next.businessArea = areaOrNull(patch.businessArea);
    if ('name' in patch) next.name = String(patch.name || '').trim();
    if ('code' in patch) next.code = String(patch.code || '').trim();
    const errs = buildingErrors(next);
    if (errs.length) return errs;
    Object.assign(b, next);
    return [];
  }
  function renameBuilding(id, name) { updateBuilding(id, { name }); return list('buildings').find(x => x.id === id); }
  function removeBuilding(id) {
    if (list('rows').some(r => r.buildingId === id)) return false;
    db().floors = list('floors').filter(f => f.buildingId !== id);
    db().buildings = list('buildings').filter(b => b.id !== id); A.reindex(); return true;
  }
  // Hierarchy guard: một Khối/Nhà hoặc chia tầng (Dãy thuộc Tầng) hoặc không (Dãy thuộc thẳng Khối).
  const hasFloors = bid => list('floors').some(f => f.buildingId === bid);
  const hasLooseRows = bid => list('rows').some(r => r.buildingId === bid && !r.floorId);
  function floorErrors(f) {
    const errs = [];
    if (!String(f.name || '').trim()) errs.push('Chưa nhập tên tầng.');
    else if (floorsOfBuilding(f.buildingId).some(x => x.id !== f.id && norm(x.name) === norm(f.name))) errs.push('Tên tầng "' + f.name + '" đã tồn tại trong Khối/Nhà này.');
    if (f.businessArea != null) {
      const allocated = U.sum(rowsOfFloor(f.id), r => Number(r.allocatedArea) || 0);
      if (!(Number(f.businessArea) >= 0)) errs.push('Diện tích kinh doanh của tầng không hợp lệ.');
      else if (over(allocated, Number(f.businessArea))) errs.push(shrinkMsg(f.businessArea, 'các Dãy hiện đang được phân bổ tổng cộng', allocated));
      const b = list('buildings').find(x => x.id === f.buildingId);
      if (b && areaOf(b, 'businessArea') != null) {
        const sum = sumOf(floorsOfBuilding(b.id).filter(x => x.id !== f.id), 'businessArea') + Number(f.businessArea);
        if (over(sum, Number(b.businessArea))) errs.push(exceedMsg(sum - Number(b.businessArea), 'còn lại của Khối/Nhà "' + b.name + '"'));
      }
    }
    return errs;
  }
  const areaOrNull = v => (v === '' || v == null) ? null : Number(v);
  // opts: { code } — mã tầng gợi ý T1, T2… nếu không nhập.
  function addFloor(buildingId, name, businessArea, opts) {
    const b = list('buildings').find(x => x.id === buildingId);
    if (!b) return { errors: ['Không tìm thấy khối/nhà chợ.'] };
    if (hasLooseRows(buildingId)) return { errors: ['Khối "' + b.name + '" đang có dãy không chia tầng, không thể thêm tầng.'] };
    const code = String((opts && opts.code) || '').trim() || nextFloorCode(buildingId);
    const f = { id: seqId(b.market + '-F-', 'floors'), market: b.market, buildingId, code, name, businessArea: areaOrNull(businessArea), order: list('floors').filter(x => x.buildingId === buildingId).length + 1 };
    const errs = floorErrors(f);
    if (errs.length) return { errors: errs };
    db().floors = list('floors').concat([f]); A.reindex(); return { floor: f };
  }
  // patch: name, businessArea — trả về lỗi (không ghi) nếu vi phạm.
  function updateFloor(id, patch) {
    const f = list('floors').find(x => x.id === id);
    if (!f) return ['Không tìm thấy tầng.'];
    const next = Object.assign({}, f, patch);
    if ('businessArea' in patch) next.businessArea = areaOrNull(patch.businessArea);
    const errs = floorErrors(next);
    if (errs.length) return errs;
    Object.assign(f, next);
    return [];
  }
  function renameFloor(id, name) { updateFloor(id, { name }); return list('floors').find(x => x.id === id); }
  function removeFloor(id) {
    if (rowsOfFloor(id).length) return false;
    db().floors = list('floors').filter(f => f.id !== id); A.reindex(); return true;
  }
  // Tạo Dãy mới (chưa có điểm) — bắt buộc đúng 1 ngành hàng ngay khi tạo; allocatedArea tuỳ chọn (mặc định 0).
  function addRow(mid, place, code, name, industry, allocatedArea) {
    if (!realFloorId(place.floorId) && hasFloors(place.blockId)) return { errors: ['Khối này chia tầng — hãy thêm dãy vào một tầng cụ thể.'] };
    const r = { id: seqId(mid + '-R-', 'rows'), market: mid, buildingId: place.blockId, floorId: realFloorId(place.floorId), code, name,
      industry: industry || '', allocatedArea: Math.max(0, Number(allocatedArea) || 0), order: byMarket('rows', mid).length + 1, status: 'active', note: '' };
    const errs = rowErrors(r);
    if (errs.length) return { errors: errs };
    db().rows = list('rows').concat([r]); A.reindex(); return { row: r };
  }
  // patch: code, name, industry, allocatedArea, note, buildingId, floorId (view key) — trả về lỗi (không ghi) nếu vi phạm.
  function updateRow(id, patch) {
    const r = list('rows').find(x => x.id === id);
    if (!r) return ['Không tìm thấy dãy.'];
    const next = Object.assign({}, r, patch);
    if ('floorId' in patch) next.floorId = realFloorId(patch.floorId);
    if ('allocatedArea' in patch) next.allocatedArea = Math.max(0, Number(patch.allocatedArea) || 0);
    const errs = rowErrors(next);
    if (errs.length) return errs;
    Object.assign(r, next);
    return [];
  }
  function removeRow(id) {
    if (pointsOfRow(id).length) return false;
    db().rows = list('rows').filter(r => r.id !== id); A.reindex(); return true;
  }
  // Xoá toàn bộ cấu trúc của 1 chợ — chỉ khi chợ chưa có điểm kinh doanh nào (không xoá điểm/hợp đồng).
  function resetMarket(mid) {
    if (list('stalls').some(st => st.market === mid)) return false;
    const bIds = new Set(byMarket('buildings', mid).map(b => b.id));
    db().rows = list('rows').filter(r => !bIds.has(r.buildingId));
    db().floors = list('floors').filter(f => !bIds.has(f.buildingId));
    db().buildings = list('buildings').filter(b => b.market !== mid);
    A.reindex(); return true;
  }

  // ---------- Thiết lập mặt bằng ban đầu (draft-only) — DEPRECATED ----------
  // Màn Mặt bằng không còn mở wizard nhiều bước (thay bằng workspace xây dần từng Khối/Tầng/Dãy/nhóm điểm).
  // API dưới đây chỉ còn giữ cho tương thích/kiểm thử (nextRowCode dùng chung); không có entry point UI.
  // Wizard sử dụng các bản ghi tạm trong UI. Không command nào dưới đây ghi vào A.db
  // cho đến `commitInitialSetup`, để Hủy/Quay lại không để lại cấu trúc dở dang.
  const norm = v => String(v || '').trim().toLocaleLowerCase('vi-VN');
  const n = v => Number(v) || 0;
  const fmt = v => n(v).toLocaleString('vi-VN', { maximumFractionDigits: 2 });
  const tmp = (kind, i) => `tmp-${kind}-${i}`;
  const pointPad = v => String(v).padStart(2, '0');
  const graphExists = mid => ['buildings', 'floors', 'rows', 'stalls'].some(k => byMarket(k, mid).length > 0);
  const effectiveMarket = mid => (A.effectiveMarkets ? A.effectiveMarkets() : []).some(m => m.id === mid);
  const marketMeta = mid => A.features && A.features.markets && A.features.markets.service && A.features.markets.service.get(mid);
  const areaTypes = () => U.AREA_TYPE_CODES || [];
  // Loại diện tích dùng được khi bố trí điểm tại chợ = allowedAreaTypeIds (Danh mục chợ). Chợ chưa cấu hình
  // (null, dữ liệu cũ) → tạm dùng toàn bộ danh mục để không chặn dữ liệu hiện có (xem areaTypesConfigured).
  const areaTypesConfigured = mid => { const m = marketMeta(mid); return !!(m && Array.isArray(m.allowedAreaTypeIds)); };
  const allowedAreaTypes = mid => { const m = marketMeta(mid); return m && Array.isArray(m.allowedAreaTypeIds) ? areaTypes().filter(k => m.allowedAreaTypeIds.indexOf(k) !== -1) : areaTypes(); };
  const areaLabel = id => U.areaTypeLabel ? U.areaTypeLabel(id) : id;
  const cleanCode = value => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().replace(/Đ/g, 'D').replace(/[^A-Z0-9]+/g, ' ').trim();
  const initials = value => cleanCode(value).split(/\s+/).filter(Boolean).map(x => x[0]).join('').slice(0, 4) || 'D';
  // ONE Row code rule for "Thêm Dãy" and the initial-setup wizard: industry prefix (D.INDUSTRY_CODES)
  // + alphabetic suffix, unique per market. Next suffix = highest existing suffix of that prefix + 1,
  // so gaps (HS-A, HS-C → HS-D) are never reused. Existing Row codes are never rewritten.
  const rowCodePrefix = industry => (D.INDUSTRY_CODES && D.INDUSTRY_CODES[industry]) || initials(industry);
  const suffixNum = s => Array.from(s).reduce((v, ch) => v * 26 + ch.charCodeAt(0) - 64, 0);
  const suffixOf = v => { let s = ''; for (let x = v; x > 0; x = Math.floor((x - 1) / 26)) s = String.fromCharCode(65 + (x - 1) % 26) + s; return s; };
  function nextRowCode(mid, industry, extraCodes) {
    if (!industry) return '';
    const prefix = rowCodePrefix(industry), codes = byMarket('rows', mid).map(r => r.code).concat(extraCodes || []);
    const pattern = new RegExp('^' + prefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '-([A-Z]+)$', 'i');
    let max = codes.reduce((m, c) => { const x = pattern.exec(String(c || '').trim()); return x ? Math.max(m, suffixNum(x[1].toUpperCase())) : m; }, 0), code;
    const taken = new Set(codes.map(norm));
    do { code = prefix + '-' + suffixOf(++max); } while (taken.has(norm(code)));
    return code;
  }
  // Presentation-only default name for a generated code, e.g. "Dãy thủy hải sản C".
  const suggestRowName = (industry, code) => {
    const suffix = (/-([A-Z]+)$/.exec(code || '') || [])[1];
    return industry && suffix ? 'Dãy ' + String(industry).toLocaleLowerCase('vi-VN') + ' ' + suffix : '';
  };
  function createInitialDraft(mid) {
    return { marketId: mid, buildings: [{ id: tmp('building', 1), name: '', hasFloors: true }], floors: [], rows: [], pointGroups: [], seq: { building: 2, floor: 1, row: 1, group: 1 } };
  }
  function draftRowCodeMap(draft) {
    const generated = [];
    return draft.rows.reduce((out, r) => {
      const code = nextRowCode(draft.marketId, r.industry, generated);
      if (code) generated.push(code);
      out[r.id] = code;
      return out;
    }, {});
  }
  function draftPointUsage(draft) {
    const out = {};
    draft.pointGroups.forEach(g => {
      const u = out[g.areaTypeId] || (out[g.areaTypeId] = { count: 0, area: 0 });
      u.count += Number(g.quantity) || 0;
      u.area += (Number(g.quantity) || 0) * (Number(g.areaPerPoint) || 0);
    });
    return out;
  }
  // Shared PointGroup rules (thêm nhóm điểm vào Dãy + API thiết lập ban đầu cũ). Loại diện tích phải
  // thuộc các loại chợ áp dụng; KHÔNG còn quota số điểm/m² theo loại.
  function validatePointGroups(groups, rowById, fail, mid) {
    const allowed = allowedAreaTypes(mid);
    (groups || []).forEach(g => {
      const row = rowById(g.rowDraftId || g.rowId);
      if (!row) return fail('Nhóm điểm phải thuộc một Dãy hợp lệ.');
      if (!areaTypes().includes(g.areaTypeId)) fail('Loại diện tích của nhóm điểm không hợp lệ.');
      else if (!allowed.includes(g.areaTypeId)) fail('Loại diện tích "' + areaLabel(g.areaTypeId) + '" không được áp dụng tại chợ này.');
      if (!Number.isInteger(Number(g.quantity)) || Number(g.quantity) < 1) fail('Số điểm trong mỗi nhóm phải là số nguyên từ 1 trở lên.');
      if (!(Number(g.areaPerPoint) > 0)) fail('Diện tích mỗi điểm phải lớn hơn 0.');
    });
  }
  function pointCodesForGroups(mid, rowCode, groups, existingCodes) {
    const prefix = String(rowCode || '');
    const taken = new Set((existingCodes || []).map(code => norm(code)));
    let max = 0;
    (existingCodes || []).forEach(code => { const m = String(code || '').match(new RegExp('^' + prefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '(\\d+)$')); if (m) max = Math.max(max, Number(m[1])); });
    const out = {};
    (groups || []).forEach(g => { out[g.id] = []; for (let i = 0; i < (Number(g.quantity) || 0); i++) { let code; do { code = prefix + pointPad(++max); } while (taken.has(norm(code))); taken.add(norm(code)); out[g.id].push(code); } });
    return out;
  }
  function validateRowPointGroups(mid, rowId, groups) {
    const row = list('rows').find(r => r.id === rowId && r.market === mid), errors = [];
    const fail = msg => errors.push(msg);
    if (!row) return { ok: false, errors: ['Không tìm thấy Dãy hoặc Dãy không thuộc chợ đang chọn.'] };
    validatePointGroups((groups || []).map(g => Object.assign({}, g, { rowId })), id => id === rowId ? row : null, fail, mid);
    // Σ(điểm hiện có) + Σ(quantity × areaPerPoint) <= row.allocatedArea.
    const current = pointsOfRow(rowId), used = U.sum(current, st => Number(st.area) || 0), addedArea = U.sum(groups || [], g => n(g.quantity) * n(g.areaPerPoint)), remaining = n(row.allocatedArea) - used;
    if (addedArea > remaining + 1e-9) fail(exceedMsg(addedArea - remaining, 'được phân bổ cho Dãy'));
    const added = draftPointUsage({ pointGroups: groups || [] });
    const pointCodes = pointCodesForGroups(mid, row.code, groups, current.map(x => x.code));
    const all = Object.values(pointCodes).flat();
    if (all.some(code => list('stalls').some(st => st.market === mid && norm(st.code) === norm(code)))) fail('Mã điểm kinh doanh tự sinh bị trùng với dữ liệu hiện có.');
    return { ok: !errors.length, errors, row, used, remaining, addedArea, pointCodes, added };
  }
  function commitRowPoints(mid, rowId, groups) {
    const check = validateRowPointGroups(mid, rowId, groups);
    if (!check.ok) return Object.assign({ ok: false }, check);
    const next = [];
    (groups || []).forEach(g => (check.pointCodes[g.id] || []).forEach((code, i) => next.push({ id: mid + '-' + code, code, market: mid, rowId, num: Number((code.match(/(\d+)$/) || [0, i + 1])[1]), area: n(g.areaPerPoint), areaTypeId: g.areaTypeId, status: 'active', operationalStatus: 'active', usageStatus: 'VACANT', usageReason: null, hasMeter: false, type: '', note: '', history: [] })));
    // Build all points first; one array swap + one save prevents a partial create.
    db().stalls = list('stalls').concat(next); A.reindex();
    // The incremental workspace is a valid setup path. A market becomes
    // operational only after its canonical graph has a valid point.
    const lifecycle = A.features && A.features.lifecycle && A.features.lifecycle.service;
    if (lifecycle && lifecycle.normalizeMarketLifecycle) lifecycle.normalizeMarketLifecycle(mid, 'Thiết lập mặt bằng');
    A.save();
    return { ok: true, stalls: next, check };
  }
  function setupPreview(draft) {
    const codes = draftRowCodeMap(draft);
    const pointCodes = {};
    draft.rows.forEach(r => {
      let seq = list('stalls').filter(st => st.market === draft.marketId && st.rowId && String(st.code || '').indexOf(codes[r.id]) === 0).length;
      draft.pointGroups.filter(g => g.rowDraftId === r.id).forEach(g => {
        pointCodes[g.id] = [];
        for (let i = 0; i < (Number(g.quantity) || 0); i++) pointCodes[g.id].push(codes[r.id] + pointPad(++seq));
      });
    });
    return { rowCodes: codes, pointCodes, usage: draftPointUsage(draft) };
  }
  function validateInitialSetup(draft) {
    const errors = [], byStep = { 1: [], 2: [], 3: [], 4: [] };
    const fail = (step, message) => { errors.push(message); byStep[step].push(message); };
    if (!draft || !draft.marketId || !effectiveMarket(draft.marketId)) fail(1, 'Chợ đã chọn không còn tồn tại hoặc không thuộc phạm vi hiệu lực.');
    if (draft && graphExists(draft.marketId)) fail(1, 'Chợ này đã có cấu trúc mặt bằng, không thể chạy thiết lập ban đầu.');
    const buildings = (draft && draft.buildings) || [], floors = (draft && draft.floors) || [], rows = (draft && draft.rows) || [], groups = (draft && draft.pointGroups) || [];
    if (!buildings.length) fail(1, 'Cần khai báo ít nhất một Khối/Nhà chợ.');
    const buildingIds = new Set(buildings.map(b => b.id));
    const buildingNames = new Set();
    buildings.forEach(b => {
      if (!String(b.name || '').trim()) fail(1, 'Tên Khối/Nhà chợ không được để trống.');
      const key = norm(b.name); if (key && buildingNames.has(key)) fail(1, 'Tên Khối/Nhà chợ không được trùng trong cùng chợ.'); buildingNames.add(key);
      if (typeof b.hasFloors !== 'boolean') fail(1, 'Cần chọn mô hình Có tầng hoặc Không chia tầng cho mỗi Khối/Nhà.');
    });
    const floorIds = new Set(floors.map(f => f.id));
    buildings.filter(b => b.hasFloors).forEach(b => { if (!floors.some(f => f.buildingDraftId === b.id)) fail(2, `Khối/Nhà "${b.name || 'chưa đặt tên'}" cần có ít nhất một tầng.`); });
    floors.forEach(f => {
      const b = buildings.find(x => x.id === f.buildingDraftId);
      if (!b || !b.hasFloors) fail(2, 'Tầng phải thuộc một Khối/Nhà có mô hình Có tầng.');
      if (!String(f.name || '').trim()) fail(2, 'Tên tầng không được để trống.');
      if (!(Number(f.businessArea) > 0)) fail(2, `Diện tích kinh doanh của tầng "${f.name || 'chưa đặt tên'}" phải lớn hơn 0.`);
      if (floors.some(x => x !== f && x.buildingDraftId === f.buildingDraftId && norm(x.name) === norm(f.name))) fail(2, 'Tên tầng không được trùng trong cùng Khối/Nhà.');
    });
    rows.forEach(r => {
      const b = buildings.find(x => x.id === r.buildingDraftId), f = floors.find(x => x.id === r.floorDraftId);
      if (!b) fail(3, 'Dãy phải thuộc một Khối/Nhà hợp lệ.');
      if (b && b.hasFloors && (!f || f.buildingDraftId !== b.id)) fail(3, `Dãy "${r.name || 'chưa đặt tên'}" phải thuộc một tầng hợp lệ.`);
      if (b && !b.hasFloors && r.floorDraftId) fail(3, `Khối/Nhà "${b.name}" không chia tầng nên Dãy không được gắn tầng.`);
      if (!String(r.name || '').trim()) fail(3, 'Tên dãy không được để trống.');
      if (!D.INDUSTRIES.includes(r.industry)) fail(3, `Dãy "${r.name || 'chưa đặt tên'}" phải chọn đúng một ngành hàng từ danh mục.`);
      if (!(Number(r.allocatedArea) > 0)) fail(3, `Diện tích phân bổ của Dãy "${r.name || 'chưa đặt tên'}" phải lớn hơn 0.`);
    });
    floors.forEach(f => {
      const allocated = rows.filter(r => r.floorDraftId === f.id).reduce((s, r) => s + n(r.allocatedArea), 0);
      if (allocated > n(f.businessArea) + 1e-9) fail(3, `Tổng diện tích phân bổ các Dãy trên ${f.name} là ${fmt(allocated)} m², vượt diện tích kinh doanh ${fmt(f.businessArea)} m².`);
    });
    const market = marketMeta(draft && draft.marketId);
    const totalStructural = rows.reduce((s, r) => s + n(r.allocatedArea), 0);
    if (market && market.businessArea != null && totalStructural > n(market.businessArea) + 1e-9) fail(3, `Tổng diện tích phân bổ cho Dãy là ${fmt(totalStructural)} m², vượt diện tích phục vụ kinh doanh của chợ (${fmt(market.businessArea)} m²).`);
    validatePointGroups(groups, id => rows.find(r => r.id === id), msg => fail(4, msg), draft && draft.marketId);
    rows.forEach(r => {
      const used = groups.filter(g => g.rowDraftId === r.id).reduce((s, g) => s + n(g.quantity) * n(g.areaPerPoint), 0);
      if (used > n(r.allocatedArea) + 1e-9) fail(4, `Tổng diện tích điểm của Dãy "${r.name || 'chưa đặt tên'}" là ${fmt(used)} m², vượt diện tích phân bổ ${fmt(r.allocatedArea)} m².`);
    });
    const preview = draft ? setupPreview(draft) : { rowCodes: {}, pointCodes: {}, usage: {} };
    const codes = Object.values(preview.rowCodes).filter(Boolean); if (new Set(codes.map(norm)).size !== codes.length) fail(3, 'Mã Dãy tự sinh bị trùng. Vui lòng kiểm tra tên/ngành hàng.');
    const allPointCodes = Object.values(preview.pointCodes).flat(); if (new Set(allPointCodes.map(norm)).size !== allPointCodes.length || allPointCodes.some(code => list('stalls').some(st => st.market === draft.marketId && norm(st.code) === norm(code)))) fail(4, 'Mã điểm kinh doanh tự sinh bị trùng với dữ liệu hiện có.');
    return { ok: !errors.length, errors, byStep, preview, market, totalStructural };
  }
  function commitInitialSetup(draft) {
    const check = validateInitialSetup(draft);
    if (!check.ok) return { ok: false, errors: check.errors, step: [1, 2, 3, 4].find(s => check.byStep[s].length) || 5, check };
    const mid = draft.marketId, p = check.preview;
    const buildingId = {}, floorId = {}, rowId = {}, buildingCode = {};
    const uniqueId = (seed, exists) => { let i = 1, id = seed; while (exists.has(id)) id = seed + '-' + i++; exists.add(id); return id; };
    const bIds = new Set(list('buildings').map(x => x.id)), fIds = new Set(list('floors').map(x => x.id)), rIds = new Set(list('rows').map(x => x.id));
    const newBuildings = draft.buildings.map((b, i) => { const code = 'B' + (byMarket('buildings', mid).length + i + 1), id = uniqueId(mid + '-B-' + code, bIds); buildingId[b.id] = id; buildingCode[b.id] = code; return { id, market: mid, code, name: String(b.name).trim(), order: byMarket('buildings', mid).length + i + 1, status: 'active' }; });
    const newFloors = draft.floors.map((f, i) => { const code = 'F' + (i + 1), id = uniqueId(mid + '-F-' + buildingCode[f.buildingDraftId] + '-' + code, fIds); floorId[f.id] = id; return { id, market: mid, buildingId: buildingId[f.buildingDraftId], code, name: String(f.name).trim(), businessArea: n(f.businessArea), order: i + 1 }; });
    const newRows = draft.rows.map((r, i) => { const code = p.rowCodes[r.id], id = uniqueId(mid + '-R-' + code, rIds); rowId[r.id] = id; return { id, market: mid, buildingId: buildingId[r.buildingDraftId], floorId: r.floorDraftId ? floorId[r.floorDraftId] : null, code, name: String(r.name).trim(), industry: r.industry, allocatedArea: n(r.allocatedArea), order: byMarket('rows', mid).length + i + 1, status: 'active', note: '' }; });
    const newStalls = [];
    draft.pointGroups.forEach(g => (p.pointCodes[g.id] || []).forEach((code, i) => newStalls.push({ id: mid + '-' + code, code, market: mid, rowId: rowId[g.rowDraftId], num: i + 1, area: n(g.areaPerPoint), areaTypeId: g.areaTypeId, status: 'active', operationalStatus: 'active', usageStatus: 'VACANT', usageReason: null, hasMeter: false, type: '', note: '', history: [] })));
    // All final records exist before the first assignment. One state save follows one graph swap.
    const old = { buildings: db().buildings, floors: db().floors, rows: db().rows, stalls: db().stalls };
    try {
      db().buildings = old.buildings.concat(newBuildings); db().floors = old.floors.concat(newFloors); db().rows = old.rows.concat(newRows); db().stalls = old.stalls.concat(newStalls);
      A.reindex();
      const lifecycle = A.features && A.features.lifecycle && A.features.lifecycle.service;
      if (lifecycle) lifecycle.completeMarketLayout(mid);
      A.save();
      return { ok: true, buildings: newBuildings, floors: newFloors, rows: newRows, stalls: newStalls, check };
    } catch (err) {
      db().buildings = old.buildings; db().floors = old.floors; db().rows = old.rows; db().stalls = old.stalls; A.reindex();
      return { ok: false, errors: ['Không thể lưu thiết lập mặt bằng. Dữ liệu chưa được thay đổi.'], error: err };
    }
  }

  const marketLayout = A.features.marketLayout || (A.features.marketLayout = {});
  marketLayout.store = {
    CATS: D.INDUSTRIES, NO_FLOOR, nextRowCode, suggestRowName, save: () => A.save(),
    of: mid => ({ blocks: blocksOf(mid) }),
    buildingsOf: mid => byMarket('buildings', mid), floorsOf: mid => byMarket('floors', mid), rowsOf: mid => byMarket('rows', mid),
    pointsOfRow, rowErrors, floorErrors, buildingErrors, hasFloors, hasLooseRows,
    budget: { market: marketBudget, building: buildingBudget, floor: floorBudget, row: rowBudget },
    allowedAreaTypes, areaTypesConfigured, nextBuildingCode, nextFloorCode,
    blocksOf, findBlock, floorsOfBlock, findFloor, firstFloorKey, firstZonePlace, findFloorOfZone, findZone, flatZones, codeTaken, marketLayoutStats,
    addBuilding, updateBuilding, renameBuilding, removeBuilding, addFloor, updateFloor, renameFloor, removeFloor, addRow, updateRow, removeRow, resetMarket,
    initialSetup: { graphExists, createDraft: createInitialDraft, preview: setupPreview, validate: validateInitialSetup, commit: commitInitialSetup },
    pointGroups: { validate: validateRowPointGroups, commit: commitRowPoints, preview: pointCodesForGroups }
  };
})(window.APP);

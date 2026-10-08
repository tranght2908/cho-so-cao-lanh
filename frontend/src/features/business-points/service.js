/* Business-point facade. Rendering, filtering, structural changes and layout stay in legacy code. */
(function (A) {
  'use strict';

  if (!A || !A.features || !A.features.businessPoints || !A.features.businessPoints.repository) return;

  const businessPoints = A.features.businessPoints;
  const repository = businessPoints.repository;
  const service = businessPoints.service || (businessPoints.service = {});

  service.list = function () { return repository.list(); };
  service.get = function (id) { return repository.getById(id); };
  // Occupancy commands are in-memory only; the orchestrating use case saves once.
  service.occupy = function (id, traderId, contractId) { return repository.occupy(id, traderId, contractId); };
  service.vacate = function (id) { return repository.vacate(id); };
  service.addHistory = function (id, entry) { return repository.addHistory(id, entry); };

  // ---- Occupancy / availability: ONE derived rule (point + occupying contracts) ----
  // No availablePoints store: every answer is derived from A.db.stalls + A.db.contracts at call time.
  // Dates are ISO 'YYYY-MM-DD'; contract `end` is inclusive; a missing end means open-ended.
  //   hieuluc          → occupies [start, end]
  //   chamdut/thanhly  → historic occupancy ends at termination/full term. A
  //                      terminated/expired point is separately locked by
  //                      pendingHandover until liquidation confirms release.
  //   any other status → never occupies
  const contracts = () => (A.features.contracts && A.features.contracts.service ? A.features.contracts.service.list() : []);
  const usage = st => st && st.usageStatus || 'VACANT';
  const operational = st => st && (st.operationalStatus || st.status) || 'active';
  const MAX = '9999-12-31';
  const dayBefore = d => new Date(Date.parse(d) - 86400000).toISOString().slice(0, 10);
  const dayAfter = d => new Date(Date.parse(d) + 86400000).toISOString().slice(0, 10);
  // Operational point states that are not open for allocation (stall.status v16) and retired
  // structural records (merged/split). Occupancy/debt are derived, never stored on the point.
  const BLOCKED_STATUS = ['suspended', 'disputed', 'inactive'];
  // A terminated or normally expired contract locks the point for handover.
  // It is not an occupancy interval, but it must block every new allocation
  // until the contract is liquidated.
  service.pendingHandover = function (pointId, date) {
    const day = date || A.U.today();
    return contracts().find(c => (c.businessPointId || c.stallId) === pointId &&
      c.status === 'PENDING_LIQUIDATION') || null;
  };
  service.occupyingInterval = function (c) {
    if (!c || !c.start) return null;
    const end = c.end || MAX;
    if (c.status === 'ACTIVE') return { start: c.start, end };
    if (c.status === 'PENDING_LIQUIDATION' || c.status === 'LIQUIDATED') {
      const stop = c.termination && c.termination.date;
      if (!stop) return c.status === 'LIQUIDATED' ? { start: c.start, end } : null;
      const last = dayBefore(stop) < end ? dayBefore(stop) : end;
      return last >= c.start ? { start: c.start, end: last } : null;
    }
    return null;
  };
  // Occupying contracts of one point, each with its derived interval, oldest first.
  service.occupancies = function (pointId) {
    return contracts().filter(c => (c.businessPointId || c.stallId) === pointId)
      .map(c => ({ contract: c, interval: service.occupyingInterval(c) })).filter(x => x.interval)
      .sort((a, b) => a.interval.start.localeCompare(b.interval.start));
  };
  const overlaps = (i, from, to) => i.start <= to && i.end >= from;
  service.isAllocatable = function (st) { return !!st && BLOCKED_STATUS.indexOf(operational(st)) === -1 && usage(st) === 'VACANT' && st.structuralStatus !== 'MERGED' && st.structuralStatus !== 'SPLIT'; };
  // Contracts that overlap [from, to] on the point (exceptId: contract being edited).
  service.conflicts = function (pointId, from, to, exceptId) {
    return service.occupancies(pointId).filter(x => x.contract.id !== exceptId && overlaps(x.interval, from, to || from));
  };
  service.isAvailable = function (pointId, from, to, opts) {
    const st = repository.getById(pointId);
    if (!st || !from || (to && to < from)) return false;
    if (opts && opts.market && st.market !== opts.market) return false;
    return service.isAllocatable(st) && !service.pendingHandover(pointId, A.U.today()) && !service.conflicts(pointId, from, to || from, opts && opts.exceptId).length;
  };
  // Single date = range [date, date].
  service.availablePoints = function (market, from, to) {
    return repository.list().filter(st => st.market === market && service.isAvailable(st.id, from, to || from));
  };
  // Hợp đồng gắn với điểm tại ngày `date`. Scope 10/2026: hợp đồng ACTIVE đã hết hạn KHÔNG tự giải phóng điểm —
  // nó vẫn là quan hệ tiểu thương ↔ điểm ("Đang thuê") cho tới khi có xử lý nghiệp vụ khác; hết hạn chỉ là
  // cảnh báo tại hợp đồng. Khoảng chiếm dụng dùng cho kiểm tra trùng lịch (occupyingInterval) giữ nguyên.
  service.contractOn = function (pointId, date) {
    const occ = service.occupancies(pointId), x = occ.find(o => overlaps(o.interval, date, date));
    if (x) return x.contract;
    const held = occ.filter(o => o.contract.status === 'ACTIVE' && o.interval.start <= date);
    return held.length ? held[held.length - 1].contract : null;
  };
  // "Trống từ": day after the last occupancy that ended before `date`; null = no recorded contract.
  service.freeSince = function (pointId, date) {
    const past = service.occupancies(pointId).filter(o => o.interval.end < date);
    return past.length ? dayAfter(past.reduce((m, o) => o.interval.end > m ? o.interval.end : m, past[0].interval.end)) : null;
  };
  // First occupancy starting after `date` (a scheduled future contract).
  service.nextOccupancy = function (pointId, date) {
    return service.occupancies(pointId).find(o => o.interval.start > date) || null;
  };
  // Date-aware relationship label for one contract (current / future / historical).
  service.contractPhase = function (c, date) {
    const i = service.occupyingInterval(c);
    if (!i) return 'ended';
    return i.start > date ? 'future' : i.end < date ? 'ended' : 'current';
  };

  // ---- Helper chuẩn cho graph mặt bằng v16 (Building → Floor? → Row → điểm) ----
  // Module khác (Hợp đồng/Tiểu thương/Tài chính…) dùng các helper này thay vì tự đọc cấu trúc.
  const idx = name => (A.idx && A.idx[name]) || null;
  service.row = function (st) { const m = idx('row'); return st && st.rowId && m ? m.get(st.rowId) || null : null; };
  service.floor = function (st) { const r = service.row(st), m = idx('floor'); return r && r.floorId && m ? m.get(r.floorId) || null : null; };
  service.building = function (st) { const r = service.row(st), m = idx('building'); return r && m ? m.get(r.buildingId) || null : null; };
  // Ngành hàng thuộc Dãy; điểm kế thừa.
  service.industry = function (st) { const r = service.row(st); return r ? r.industry || '' : ''; };
  // Vị trí hiển thị: khu = Khối/Nhà chợ, tang = Tầng (— nếu Dãy không thuộc tầng), day = Dãy.
  service.location = function (st) {
    const b = service.building(st), f = service.floor(st), r = service.row(st);
    return { building: b, floor: f, row: r, khu: b ? b.name : '—', tang: f ? f.name : '—', day: r ? r.name : '—',
      label: [b && b.name, f && f.name, r && r.name].filter(Boolean).join(' → ') || '—' };
  };
  service.pointsOfRow = function (rowId) { return repository.list().filter(st => st.rowId === rowId); };
  // Tình trạng sử dụng: suy từ hợp đồng chiếm dụng tại ngày xem.
  service.usageStatus = function (st, date) { return st && service.contractOn(st.id, date || A.U.today()) ? 'occupied' : 'vacant'; };
  // Người đang sử dụng: người thuê theo hợp đồng; quầy theo phiên (không có hợp đồng tháng) lấy khách
  // quen đã gắn điểm trong hồ sơ tiểu thương (traders[].stalls).
  service.occupantId = function (st, date) {
    if (!st) return null;
    const c = service.contractOn(st.id, date || A.U.today());
    if (c) return c.traderId;
    if (A.U.rentalKind && A.U.rentalKind(st) === 'session') {
      const t = (A.db.traders || []).find(x => (x.stalls || []).indexOf(st.id) !== -1);
      return t ? t.id : null;
    }
    return null;
  };
  // Công nợ: suy từ khoản phải thu quá hạn còn nợ (tuỳ chọn giới hạn theo 1 hợp đồng).
  service.debtStatus = function (st, contractId) {
    return st && (A.db.invoices || []).some(i => i.stallId === st.id && (!contractId || i.contractId === contractId) && A.U.isOver(i)) ? 'overdue' : 'none';
  };
  // Tình trạng hiển thị tổng hợp (khoá chú giải D.STATUS): vận hành → sử dụng (hợp đồng tại ngày xem).
  // "Nợ phí" KHÔNG phải trạng thái điểm KD (công nợ đã bỏ khỏi scope): điểm có hợp đồng hiệu lực luôn là
  // 'thue' kể cả khi còn khoản phải thu quá hạn. D.STATUS.no chỉ giữ nhãn cho dữ liệu/mã cũ, không trả về nữa.
  // DISPLAY_STATUSES = đúng tập giá trị hàm này trả về — mọi chip/bộ lọc/thống kê trạng thái dùng danh sách này.
  service.DISPLAY_STATUSES = ['thue', 'trong', 'ngung', 'tranhchap'];
  service.displayStatus = function (st, date) {
    if (!st) return 'trong';
    if (operational(st) === 'suspended' || operational(st) === 'inactive' || usage(st) === 'SUSPENDED') return 'ngung';
    if (operational(st) === 'disputed') return 'tranhchap';
    const c = service.contractOn(st.id, date || A.U.today());
    // Occupancy belongs to the active contract interval, not the denormalized
    // usageStatus cache. This keeps layout, point list and contract views in
    // agreement even while legacy data is being normalized.
    return c ? 'thue' : 'trong';
  };
  // ---- Tỷ lệ lấp đầy: MỘT công thức dùng chung (Tổng quan liên chợ, Báo cáo, thống kê Mặt bằng) ----
  // Điểm hợp lệ = bỏ bản ghi đã gộp/tách (MERGED/SPLIT — chỉ giữ để truy vết).
  // Lấp đầy = Đang thuê (displayStatus 'thue') / Tổng điểm hợp lệ × 100; tổng = 0 → 0%.
  service.isCountable = function (st) { return !!st && st.structuralStatus !== 'MERGED' && st.structuralStatus !== 'SPLIT'; };
  service.occupancy = function (points, date) {
    const byStatus = {};
    service.DISPLAY_STATUSES.forEach(k => { byStatus[k] = 0; });
    let total = 0;
    (points || []).forEach(st => {
      if (!service.isCountable(st)) return;
      total++;
      const k = service.displayStatus(st, date);
      byStatus[k] = (byStatus[k] || 0) + 1;
    });
    const occupied = byStatus.thue || 0, vacant = byStatus.trong || 0;
    return { total, occupied, vacant, blocked: total - occupied - vacant, byStatus, pct: A.U.pct(occupied, total) };
  };
  service.activeSeller = function (st) { return st ? (A.db.directSellerAssignments || []).find(x => x.pointId === st.id && x.status === 'ACTIVE') || null : null; };
  service.POINT_STATUS = A.D.POINT_STATUS;
})(window.APP);

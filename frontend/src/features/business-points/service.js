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
  //   chamdut/thanhly  → occupies [start, min(end, termination.date − 1 day)] (the point is released
  //                      on the termination date, as contracts.service.terminate does); a liquidated
  //                      contract without termination occupied its full term
  //   any other status → never occupies
  const contracts = () => (A.features.contracts && A.features.contracts.service ? A.features.contracts.service.list() : []);
  const MAX = '9999-12-31';
  const dayBefore = d => new Date(Date.parse(d) - 86400000).toISOString().slice(0, 10);
  const dayAfter = d => new Date(Date.parse(d) + 86400000).toISOString().slice(0, 10);
  // Point states that are not open for allocation (Tạm ngừng / Đang tranh chấp) and retired
  // structural records (merged/split). Occupancy states (thue/no/trong) are NOT used here.
  const BLOCKED_STATUS = ['ngung', 'tranhchap'];
  service.occupyingInterval = function (c) {
    if (!c || !c.start) return null;
    const end = c.end || MAX;
    if (c.status === 'hieuluc') return { start: c.start, end };
    if (c.status === 'chamdut' || c.status === 'thanhly') {
      const stop = c.termination && c.termination.date;
      if (!stop) return c.status === 'thanhly' ? { start: c.start, end } : null;
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
  service.isAllocatable = function (st) { return !!st && BLOCKED_STATUS.indexOf(st.status) === -1 && st.structuralStatus !== 'MERGED' && st.structuralStatus !== 'SPLIT'; };
  // Contracts that overlap [from, to] on the point (exceptId: contract being edited).
  service.conflicts = function (pointId, from, to, exceptId) {
    return service.occupancies(pointId).filter(x => x.contract.id !== exceptId && overlaps(x.interval, from, to || from));
  };
  service.isAvailable = function (pointId, from, to, opts) {
    const st = repository.getById(pointId);
    if (!st || !from || (to && to < from)) return false;
    if (opts && opts.market && st.market !== opts.market) return false;
    return service.isAllocatable(st) && !service.conflicts(pointId, from, to || from, opts && opts.exceptId).length;
  };
  // Single date = range [date, date].
  service.availablePoints = function (market, from, to) {
    return repository.list().filter(st => st.market === market && service.isAvailable(st.id, from, to || from));
  };
  service.contractOn = function (pointId, date) {
    const x = service.occupancies(pointId).find(o => overlaps(o.interval, date, date));
    return x ? x.contract : null;
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
})(window.APP);

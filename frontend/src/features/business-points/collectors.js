/* Fee-collector assignment of business points (Phase 15.15, from js/v-cautruc.js). Each point has ONE
 * active collector (stall.collectorId); a layout zone is only a quick way to select its real points.
 * Queries: collector accounts in scope, zone assignment state/label. Command: assignCollector. */
(function (A) {
  'use strict';
  const service = A.features.businessPoints.service;
  const mbZonePoints = (mid, z) => A.mbBusinessPointsForZone(mid, z);
  const rows = () => A.db.rows || [], points = () => A.db.stalls || [];
  const account = id => A.ACCOUNTS.get(id);
  const isCollector = a => !!a && a.status === 'active' && A.ACCOUNTS.primaryRole(a) === 'collector';
  const inMarket = (a, mid) => isCollector(a) && A.allowedMarkets(a).indexOf(mid) !== -1;
  // PHAN_CONG_NHAN_VIEN_THU_PHI: tài khoản demo role 'collector' (Nhân viên thu phí) thuộc phạm vi
  // chợ mid — REUSE A.ACCOUNTS (mục 1 yêu cầu: không tạo danh sách nhân viên riêng), cùng cách lọc
  // dkCollectorLabel() đã có ở js/v-tieuthuong.js (không dùng D.STAFF — đó là roster cũ, khác nguồn).
  function mbCollectorAccounts(mid) {
    return A.ACCOUNTS.list().filter(a => inMarket(a, mid));
  }
  // Phân công NV thu phí theo Dãy (v16: row.collectorId là nguồn DUY NHẤT; điểm đọc qua Dãy):
  //   null     = dãy chưa có điểm
  //   ''       = chưa phân công
  //   <acc id> = NV phụ trách dãy ('MIXED' không còn xảy ra vì phân công ở cấp dãy)
  function mbZoneCollectorId(mid, z) {
    const row = z && A.idx.row ? A.idx.row.get(z.key) : null;
    if (!row || !mbZonePoints(mid, z).length) return null;
    return row.collectorId || '';
  }
  function mbZoneCollectorLabel(mid, z) {
    const id = mbZoneCollectorId(mid, z);
    if (id === null || id === '') return id === null ? null : 'Chưa phân công';
    if (id === 'MIXED') return 'Nhiều NV phụ trách';
    const acc = A.ACCOUNTS.get(id);
    return acc ? acc.fullName : 'Chưa phân công';
  }
  A.mbZoneCollectorLabel = mbZoneCollectorLabel;
  service.collectorAccounts = mbCollectorAccounts;
  service.zoneCollectorId = mbZoneCollectorId;
  // Standard data-scope helpers: all joins derive from Row → collectorId, never a copied point field.
  service.collectorRows = (accountId, mid) => rows().filter(r => r.collectorId === accountId && (!mid || r.market === mid));
  service.collectorPointIds = (accountId, mid) => new Set(service.collectorRows(accountId, mid).flatMap(r => points().filter(p => p.rowId === r.id).map(p => p.id)));
  service.collectorPoints = (accountId, mid) => points().filter(p => service.collectorPointIds(accountId, mid).has(p.id));
  service.pointCollector = pointId => { const p = service.get(pointId), r = p && service.row(p); return r && r.collectorId ? account(r.collectorId) || null : null; };
  service.collectorCanAccessPoint = (accountId, pointId) => service.collectorPointIds(accountId).has(pointId);
  service.collectorLoad = (accountId, mid) => { const rs = service.collectorRows(accountId, mid), ids = new Set(rs.map(r => r.id)); return { rows: rs.length, points: points().filter(p => ids.has(p.rowId)).length }; };
  const contractPointId = c => c && (c.businessPointId || c.stallId);
  service.collectorCanAccessContract = (accountId, contractId) => { const c = (A.db.contracts || []).find(x => x.id === contractId); return !!c && service.collectorCanAccessPoint(accountId, contractPointId(c)); };
  service.collectorCanAccessTrader = (accountId, traderId) => (A.db.contracts || []).some(c => c.traderId === traderId && service.collectorCanAccessPoint(accountId, contractPointId(c)));
  service.receivableScope = receivable => { const pointId = receivable && (receivable.businessPointId || receivable.stallId); return !pointId || !service.get(pointId) ? { kind: 'nonPointScoped', collector: null, pointId: null } : { kind: 'pointScoped', collector: service.pointCollector(pointId), pointId }; };
  service.collectorCanAccessReceivable = (accountId, id) => { const x = (A.db.invoices || []).find(i => i.id === id), s = service.receivableScope(x); return s.kind === 'pointScoped' && service.collectorCanAccessPoint(accountId, s.pointId); };
  service.collectorCanAccessDebt = service.collectorCanAccessReceivable;
  service.collectorCanAccessPayment = (accountId, id) => { const p = (A.db.payments || []).find(x => x.id === id); return !!p && !!p.invoiceId && service.collectorCanAccessReceivable(accountId, p.invoiceId); };
  // One atomic update; direct callers cannot assign an inactive/out-of-scope/non-collector account.
  service.assignRowCollector = (mid, rowId, collectorId) => {
    const row = rows().find(r => r.id === rowId && r.market === mid);
    if (!row) return { ok: false, errors: ['Không tìm thấy Dãy trong chợ đang chọn.'] };
    if (!A.effectiveMarkets().some(m => m.id === mid) || !A.canDo('cau-truc.edit', mid)) return { ok: false, errors: ['Bạn không có quyền phân công tại chợ này.'] };
    if (collectorId && !inMarket(account(collectorId), mid)) return { ok: false, errors: ['Nhân viên thu phí không hoạt động hoặc không thuộc phạm vi chợ này.'] };
    row.collectorId = collectorId || null; A.reindex(); A.save(); return { ok: true, row };
  };
  // Legacy command preserved, but writes only the Row source of truth.
  service.assignCollector = function (list, collectorId) { const first = (list || [])[0], r = first && service.row(first); return r ? service.assignRowCollector(r.market, r.id, collectorId) : { ok: false, errors: ['Chưa chọn Dãy.'] }; };
})(window.APP);

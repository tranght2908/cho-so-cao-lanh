/* Collector market-scope helpers. Collector access is Account.marketScopes -> Market.
 * row.collectorId remains readable only as a deprecated compatibility adapter for consumers that have
 * not yet migrated (notably Finance and the trader portals); it is never an access source here. */
(function (A) {
  'use strict';
  const service = A.features.businessPoints.service;
  const rows = () => A.db.rows || [], points = () => A.db.stalls || [];
  const account = id => A.ACCOUNTS.get(id);
  const isCollector = a => !!a && A.ACCOUNTS.isActive(a) && A.ACCOUNTS.primaryRole(a) === 'collector';
  const inMarket = (a, mid) => isCollector(a) && A.allowedMarkets(a).indexOf(mid) !== -1;
  // PHAN_CONG_NHAN_VIEN_THU_PHI: tài khoản demo role 'collector' (Nhân viên thu phí) thuộc phạm vi
  // chợ mid — REUSE A.ACCOUNTS (mục 1 yêu cầu: không tạo danh sách nhân viên riêng), cùng cách lọc
  // dkCollectorLabel() đã có ở js/v-tieuthuong.js (không dùng D.STAFF — đó là roster cũ, khác nguồn).
  function mbCollectorAccounts(mid) {
    return A.ACCOUNTS.getMarketCollectors ? A.ACCOUNTS.getMarketCollectors(mid) : A.ACCOUNTS.list().filter(a => inMarket(a, mid));
  }
  service.collectorAccounts = mbCollectorAccounts;
  // Assignment semantics belong to Accounts. These aliases keep market/collector
  // consumers on the same source without recreating a second assignment registry.
  service.getMarketCollectors = mid => A.ACCOUNTS.getMarketCollectors(mid);
  service.getMarketCollector = mid => A.ACCOUNTS.getMarketCollector(mid);
  // Scope helpers deliberately use record.market, never Row.collectorId.
  service.collectorRows = (accountId, mid) => { const a = account(accountId); return rows().filter(r => (!mid || r.market === mid) && inMarket(a, r.market)); };
  service.collectorPoints = (accountId, mid) => { const a = account(accountId); return points().filter(p => (!mid || p.market === mid) && inMarket(a, p.market)); };
  service.collectorPointIds = (accountId, mid) => new Set(service.collectorPoints(accountId, mid).map(p => p.id));
  // Deprecated: a market can have several collectors, so this is not a current ownership source.
  // Retained only for Finance/trader-portal compatibility until their dedicated migration tasks.
  service.pointCollector = pointId => { const p = service.get(pointId), r = p && service.row(p); return r && r.collectorId ? account(r.collectorId) || null : null; };
  service.collectorCanAccessPoint = (accountId, pointId) => { const p = service.get(pointId), a = account(accountId); return !!p && inMarket(a, p.market); };
  service.collectorLoad = (accountId, mid) => ({ rows: service.collectorRows(accountId, mid).length, points: service.collectorPoints(accountId, mid).length });
  const contractPointId = c => c && (c.businessPointId || c.stallId);
  service.collectorCanAccessContract = (accountId, contractId) => { const c = (A.db.contracts || []).find(x => x.id === contractId); if (!c) return false; const p = service.get(contractPointId(c)); if (p) return service.collectorCanAccessPoint(accountId, p.id); const t = (A.db.traders || []).find(x => x.id === c.traderId); return !!t && inMarket(account(accountId), t.market); };
  service.collectorCanAccessTrader = (accountId, traderId) => { const t = (A.db.traders || []).find(x => x.id === traderId); return !!t && inMarket(account(accountId), t.market); };
  service.receivableScope = receivable => { const pointId = receivable && (receivable.businessPointId || receivable.stallId); return !pointId || !service.get(pointId) ? { kind: 'nonPointScoped', collector: null, pointId: null } : { kind: 'pointScoped', collector: service.pointCollector(pointId), pointId }; };
  service.collectorCanAccessReceivable = (accountId, id) => { const x = (A.db.invoices || []).find(i => i.id === id), s = service.receivableScope(x); return s.kind === 'pointScoped' && service.collectorCanAccessPoint(accountId, s.pointId); };
  service.collectorCanAccessDebt = service.collectorCanAccessReceivable;
  service.collectorCanAccessPayment = (accountId, id) => { const p = (A.db.payments || []).find(x => x.id === id); return !!p && !!p.invoiceId && service.collectorCanAccessReceivable(accountId, p.invoiceId); };
})(window.APP);

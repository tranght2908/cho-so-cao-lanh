/* Canonical lifecycle state machine for market, business point, trader and contract. */
(function (A) {
  'use strict';

  const features = A.features || (A.features = {});
  const lifecycle = features.lifecycle || (features.lifecycle = {});
  const service = lifecycle.service || (lifecycle.service = {});
  const MARKET = service.MARKET = { NOT_ACTIVE: 'NOT_ACTIVE', ACTIVE: 'ACTIVE' };
  const LAYOUT = service.LAYOUT = { PENDING_SETUP: 'PENDING_SETUP', SETUP_COMPLETED: 'SETUP_COMPLETED' };
  const USAGE = service.USAGE = { VACANT: 'VACANT', RENTED: 'RENTED', SUSPENDED: 'SUSPENDED' };
  const CONTRACT = service.CONTRACT = { ACTIVE: 'ACTIVE', PENDING_LIQUIDATION: 'PENDING_LIQUIDATION', LIQUIDATED: 'LIQUIDATED' };
  const TRADER = service.TRADER = { WAITING_ALLOCATION: 'WAITING_ALLOCATION', ACTIVE: 'ACTIVE', INACTIVE: 'INACTIVE' };

  const contractPointId = c => c && (c.businessPointId || c.stallId);
  const point = id => A.idx && A.idx.stall ? A.idx.stall.get(id) : null;
  const trader = id => A.idx && A.idx.trader ? A.idx.trader.get(id) : null;
  const day = value => value || A.U.today();
  const normalizeContract = c => {
    if (!c) return null;
    if (c.status === 'LIQUIDATED' || c.status === 'thanhly') c.status = CONTRACT.LIQUIDATED;
    else if (c.status === 'PENDING_LIQUIDATION' || c.status === 'chamdut') { c.status = CONTRACT.PENDING_LIQUIDATION; c.endReason = c.endReason || 'EARLY_TERMINATION'; }
    else c.status = CONTRACT.ACTIVE;
    return c;
  };
  const normalizeTrader = t => {
    if (!t) return null;
    const old = t.status || t.profileStatus;
    t.status = old === 'ACTIVE' ? TRADER.ACTIVE : old === 'INACTIVE' ? TRADER.INACTIVE : TRADER.WAITING_ALLOCATION;
    return t;
  };
  const normalizePoint = s => {
    if (!s) return null;
    if (!s.operationalStatus) s.operationalStatus = ['suspended', 'disputed', 'inactive'].includes(s.status) ? s.status : 'active';
    if (!USAGE[s.usageStatus]) s.usageStatus = USAGE.VACANT;
    if (s.usageStatus !== USAGE.SUSPENDED) s.usageReason = null;
    return s;
  };
  const setPointUsage = (id, status, reason) => {
    const s = typeof id === 'string' ? point(id) : id;
    if (!s) return null;
    normalizePoint(s);
    s.usageStatus = status;
    s.usageReason = status === USAGE.SUSPENDED ? reason || null : null;
    return s;
  };
  const activeContractsFor = traderId => (A.db.contracts || []).filter(c => c.traderId === traderId && c.status === CONTRACT.ACTIVE);
  service.recalculateTrader = function (traderOrId) {
    const t = typeof traderOrId === 'string' ? trader(traderOrId) : traderOrId;
    if (!t) return null;
    normalizeTrader(t);
    t.status = activeContractsFor(t.id).length ? TRADER.ACTIVE : (t.status === TRADER.INACTIVE ? TRADER.INACTIVE : TRADER.WAITING_ALLOCATION);
    return t;
  };
  service.activateContract = function (contractOrId) {
    const c = typeof contractOrId === 'string' ? (A.idx.contract && A.idx.contract.get(contractOrId)) : contractOrId;
    if (!c) return null;
    c.status = CONTRACT.ACTIVE; c.endReason = null;
    setPointUsage(contractPointId(c), USAGE.RENTED);
    const t = trader(c.traderId); if (t) { t.status = TRADER.ACTIVE; if (!Array.isArray(t.stalls)) t.stalls = []; if (!t.stalls.includes(contractPointId(c))) t.stalls.push(contractPointId(c)); }
    return c;
  };
  service.expireContract = function (contractOrId) {
    const c = typeof contractOrId === 'string' ? (A.idx.contract && A.idx.contract.get(contractOrId)) : contractOrId;
    if (!c || c.status === CONTRACT.LIQUIDATED) return c || null;
    c.status = CONTRACT.PENDING_LIQUIDATION; c.endReason = 'EXPIRED';
    setPointUsage(contractPointId(c), USAGE.SUSPENDED, 'CONTRACT_EXPIRED');
    service.recalculateTrader(c.traderId);
    return c;
  };
  service.terminateContract = function (contractOrId) {
    const c = typeof contractOrId === 'string' ? (A.idx.contract && A.idx.contract.get(contractOrId)) : contractOrId;
    if (!c || c.status === CONTRACT.LIQUIDATED) return c || null;
    c.status = CONTRACT.PENDING_LIQUIDATION; c.endReason = 'EARLY_TERMINATION';
    setPointUsage(contractPointId(c), USAGE.SUSPENDED, 'CONTRACT_TERMINATED');
    service.recalculateTrader(c.traderId);
    return c;
  };
  service.liquidateContract = function (contractOrId) {
    const c = typeof contractOrId === 'string' ? (A.idx.contract && A.idx.contract.get(contractOrId)) : contractOrId;
    if (!c) return null;
    c.status = CONTRACT.LIQUIDATED;
    setPointUsage(contractPointId(c), USAGE.VACANT);
    const t = trader(c.traderId);
    if (t && Array.isArray(t.stalls)) t.stalls = t.stalls.filter(id => id !== contractPointId(c));
    service.recalculateTrader(c.traderId);
    return c;
  };
  service.syncExpiry = function (date) {
    const today = day(date); let changed = false;
    (A.db.contracts || []).forEach(c => {
      if (c.status === CONTRACT.ACTIVE && c.end && c.end < today) { service.expireContract(c); changed = true; }
    });
    return changed;
  };
  service.completeMarketLayout = function (marketId, user) {
    const markets = features.markets && features.markets.service;
    return markets && markets.completeLayoutSetup ? markets.completeLayoutSetup(marketId, user) : null;
  };
  service.migrate = function () {
    if (!A.db) return false;
    let changed = false;
    const markets = features.markets && features.markets.service;
    if (markets) markets.rows().forEach(m => {
      // One-time migration only: legacy markets had no completion marker, so an
      // existing graph is evidence of setup already completed before this model.
      if (!m.layoutLifecycleVersion && (A.db.rows || []).some(r => r.market === m.id)) {
        service.completeMarketLayout(m.id, 'Migration lifecycle'); changed = true;
      }
    });
    (A.db.stalls || []).forEach(s => {
      const before = JSON.stringify([s.operationalStatus, s.usageStatus, s.usageReason]);
      normalizePoint(s);
      if (before !== JSON.stringify([s.operationalStatus, s.usageStatus, s.usageReason])) changed = true;
    });
    (A.db.traders || []).forEach(t => { const before = t.status; normalizeTrader(t); if (before !== t.status) changed = true; });
    (A.db.contracts || []).forEach(c => { const before = JSON.stringify([c.status, c.endReason]); normalizeContract(c); if (before !== JSON.stringify([c.status, c.endReason])) changed = true; });
    if (service.syncExpiry()) changed = true;
    // Contracts are authoritative for usage and trader business status after normalization.
    (A.db.stalls || []).forEach(s => {
      const c = (A.db.contracts || []).find(x => contractPointId(x) === s.id && x.status === CONTRACT.ACTIVE);
      if (c && s.usageStatus !== USAGE.RENTED) { setPointUsage(s, USAGE.RENTED); changed = true; }
    });
    (A.db.traders || []).forEach(t => { const before = t.status; service.recalculateTrader(t); if (before !== t.status) changed = true; });
    return changed;
  };
})(window.APP);

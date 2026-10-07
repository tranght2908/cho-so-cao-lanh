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
  // A signed contract may start in the future. `ACTIVE` is its persisted
  // contractual state; occupancy and trader business status are day-specific.
  const effectiveOn = (c, date) => !!c && c.status === CONTRACT.ACTIVE &&
    (!c.start || c.start <= day(date)) && (!c.end || c.end >= day(date));
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
  const activeContractsFor = (traderId, date) => (A.db.contracts || []).filter(c => c.traderId === traderId && effectiveOn(c, date));
  service.recalculateTrader = function (traderOrId, date) {
    const t = typeof traderOrId === 'string' ? trader(traderOrId) : traderOrId;
    if (!t) return null;
    normalizeTrader(t);
    t.status = activeContractsFor(t.id, date).length ? TRADER.ACTIVE : (t.status === TRADER.INACTIVE ? TRADER.INACTIVE : TRADER.WAITING_ALLOCATION);
    return t;
  };
  service.activateContract = function (contractOrId, date) {
    const c = typeof contractOrId === 'string' ? (A.idx.contract && A.idx.contract.get(contractOrId)) : contractOrId;
    if (!c) return null;
    c.status = CONTRACT.ACTIVE; c.endReason = null;
    // A future contract reserves its interval but must not rent the point or
    // activate the trader before its start date.
    if (!effectiveOn(c, date)) return c;
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
      if (c.status !== CONTRACT.ACTIVE) return;
      if (c.end && c.end < today) { service.expireContract(c); changed = true; return; }
      if (effectiveOn(c, today)) {
        const s = point(contractPointId(c)), t = trader(c.traderId);
        const before = JSON.stringify([s && s.usageStatus, t && t.status]);
        service.activateContract(c, today);
        if (before !== JSON.stringify([s && s.usageStatus, t && t.status])) changed = true;
      }
    });
    return changed;
  };
  service.completeMarketLayout = function (marketId, user) {
    const markets = features.markets && features.markets.service;
    return markets && markets.completeLayoutSetup ? markets.completeLayoutSetup(marketId, user) : null;
  };
  // Market lifecycle is derived only from the canonical layout graph. A market
  // with an incomplete/missing graph is never active, regardless of legacy
  // catalog flags, declared area, price configuration or business-area types.
  service.marketLayoutComplete = function (marketId) {
    const markets = features.markets && features.markets.service;
    return !!(markets && markets.layoutGraphReady && markets.layoutGraphReady(marketId));
  };
  service.normalizeMarketLifecycle = function (marketId, user) {
    const markets = features.markets && features.markets.service;
    if (!markets || !markets.normalizeLifecycle) return null;
    return markets.normalizeLifecycle(marketId, service.marketLayoutComplete(marketId), user || 'Migration lifecycle');
  };
  service.migrate = function () {
    if (!A.db) return false;
    let changed = false;
    const markets = features.markets && features.markets.service;
    if (markets) markets.rows().forEach(m => {
      // Idempotent backfill: normalize both fields from the actual layout
      // graph, including legacy PENDING_SETUP + ACTIVE combinations.
      const out = service.normalizeMarketLifecycle(m.id, 'Migration lifecycle');
      if (out && out.changed) changed = true;
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
    // A future contract is not current occupancy; this repairs legacy RENTED
    // values that were written at signing time.
    (A.db.stalls || []).forEach(s => {
      const c = (A.db.contracts || []).find(x => contractPointId(x) === s.id && effectiveOn(x));
      if (c && s.usageStatus !== USAGE.RENTED) { setPointUsage(s, USAGE.RENTED); changed = true; }
      if (!c && s.usageStatus === USAGE.RENTED) { setPointUsage(s, USAGE.VACANT); changed = true; }
    });
    (A.db.traders || []).forEach(t => { const before = t.status; service.recalculateTrader(t); if (before !== t.status) changed = true; });
    return changed;
  };
})(window.APP);

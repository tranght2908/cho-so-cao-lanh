/* Shared prototype data store (Phase 15.3, from js/core.js).
 * Single owner of the persisted business state A.db (localStorage 'choso-caolanh-state'),
 * its lookup indexes A.idx, fresh seeding from window.DATA and the stored-state load/migration. */
(function (A) {
  'use strict';
  const D = A.D;
  const KEY = 'choso-caolanh-state';
  const data = A.data || (A.data = {});
  // ---------- dữ liệu ----------
  A.reindex = function () {
    const db = A.db;
    A.idx = {
      stall: new Map(db.stalls.map(s => [s.id, s])),
      trader: new Map(db.traders.map(s => [s.id, s])),
      contract: new Map(db.contracts.map(s => [s.id, s])),
      invoice: new Map(db.invoices.map(s => [s.id, s]))
    };
  };

  A.save = function () { try { localStorage.setItem(KEY, JSON.stringify(A.db)); } catch (e) { /* bỏ qua */ } };

  A.fresh = function () {
    A.db = D.build();
    A.reindex();
    A.db.stalls.forEach(A.refreshStall);
  };
  // Load persisted state (same version only) or seed fresh; then additive migrations.
  data.loadDb = function () {
    try {
      const s = localStorage.getItem(KEY);
      if (s) { const x = JSON.parse(s); if (x && x.version === D.VERSION) A.db = x; }
    } catch (e) { A.db = null; }
    if (A.db) A.reindex(); else A.fresh();
    // FE/localStorage migration: preserve existing records and legacy fields, adding only areaType.
    const areaTypeByLegacyType = { kiot: 'covered', nhalong: 'covered', ngoai: 'self_produced', phien: 'session' };
    const migratedAreaType = A.db.stalls.some(st => !st.areaType);
    if (migratedAreaType) {
      A.db.stalls.forEach(st => { if (!st.areaType) st.areaType = areaTypeByLegacyType[st.type] || 'covered'; });
      A.save();
    }
  };
  data.clearPersisted = function () {
    try { localStorage.removeItem(KEY); } catch (e) { /* bỏ qua */ }
  };
})(window.APP);

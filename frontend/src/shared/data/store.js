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
    // GOM_KHOAN_THU_THEO_TIEU_THUONG — bất biến dữ liệu: chợ receivableGrouping 'TRADER' chỉ có 1 khoản
    // phải thu / tiểu thương / kỳ. Dữ liệu đã lưu (seed cũ, cache) vi phạm → dựng lại seed hiện tại.
    if (A.db && Array.isArray(A.db.invoices)) {
      const grouped = new Set((D.MARKETS || []).filter(m => m.receivableGrouping === 'TRADER').map(m => m.id));
      const seen = new Set();
      const broken = A.db.invoices.some(i => { if (!grouped.has(i.market) || !i.stallId) return false; const k = i.traderId + '|' + i.period; if (seen.has(k)) return true; seen.add(k); return false; });
      if (broken) { A.db = null; try { localStorage.removeItem(KEY); } catch (e) { /* bỏ qua */ } }
    }
    if (A.db) A.reindex(); else A.fresh();
    // QUA_HAN_CHUYEN_CONG_NO: khoản quá hạn chưa thu → hệ thống tự chuyển công nợ (idempotent).
    if (A.syncDebts) A.syncDebts({ save: false });
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

/* Shared prototype data store (Phase 15.3, from js/core.js).
 * Single owner of the persisted business state A.db (localStorage 'choso-caolanh-state'),
 * its lookup indexes A.idx, fresh seeding from window.DATA and the stored-state load/migration.
 * Mặt bằng (v16): A.db.buildings/floors/rows/stalls là graph mặt bằng DUY NHẤT; điểm kinh doanh được
 * gắn prototype tương thích (A.data.stallPrototype — features/business-points/repository.js). */
(function (A) {
  'use strict';
  const D = A.D;
  const KEY = 'choso-caolanh-state';
  const BACKUP_KEY = 'choso-caolanh-state-backup';
  const data = A.data || (A.data = {});
  // ---------- dữ liệu ----------
  A.reindex = function () {
    const db = A.db;
    if (data.stallPrototype) db.stalls.forEach(s => { if (Object.getPrototypeOf(s) !== data.stallPrototype) Object.setPrototypeOf(s, data.stallPrototype); });
    A.idx = {
      building: new Map((db.buildings || []).map(s => [s.id, s])),
      floor: new Map((db.floors || []).map(s => [s.id, s])),
      row: new Map((db.rows || []).map(s => [s.id, s])),
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
  };
  // Trước khi bỏ state của version cũ (reseed có chủ đích, vd. 15 → 16), sao lưu MỘT lần nguyên văn vào
  // 'choso-caolanh-state-backup' ({version, savedAt, state}) — không ghi đè backup đã có; hết dung lượng
  // thì chỉ cảnh báo, không chặn khởi động.
  function backupOutdated(raw, version) {
    try {
      if (!localStorage.getItem(BACKUP_KEY)) localStorage.setItem(BACKUP_KEY, JSON.stringify({ version, savedAt: new Date().toISOString(), state: raw }));
    } catch (e) { console.warn('[choso] Không sao lưu được state v' + version + ' trước khi seed lại:', e); }
  }
  // Load persisted state (same version only) or seed fresh; then additive migrations.
  data.loadDb = function () {
    try {
      const s = localStorage.getItem(KEY);
      if (s) {
        const x = JSON.parse(s);
        if (x && x.version === D.VERSION) A.db = x;
        else if (x && x.version) backupOutdated(s, x.version);
      }
    } catch (e) { A.db = null; }
    if (A.db) A.reindex(); else A.fresh();
    // Hồ sơ/tài khoản: collection nghiệp vụ đổi số điện thoại, cùng state prototype A.db.
    // Không sao chép account; mỗi request chỉ tham chiếu accountId.
    if (!Array.isArray(A.db.phoneChangeRequests)) A.db.phoneChangeRequests = [];
    // Metadata actor là phần trình bày có thể chỉnh sửa trong Cài đặt. Chỉ bổ sung các
    // record còn thiếu; identity/name/roleId vẫn đọc từ DATA.ACTORS và không vào A.db.
    const actorMetadata = Array.isArray(A.db.actorMetadata) ? A.db.actorMetadata : [];
    let migratedActorMetadata = !Array.isArray(A.db.actorMetadata);
    const knownActorMetadata = new Set(actorMetadata.map(x => x && x.id));
    (D.ACTORS || []).forEach(a => {
      if (!knownActorMetadata.has(a.id)) {
        actorMetadata.push({ id: a.id, unit: a.unit || '', responsibilities: String(a.responsibility || '').split(/[;,]\s*/).filter(Boolean) });
        migratedActorMetadata = true;
      }
    });
    A.db.actorMetadata = actorMetadata;
    if (migratedActorMetadata) A.save();
  };
  data.clearPersisted = function () {
    try { localStorage.removeItem(KEY); } catch (e) { /* bỏ qua */ }
  };
})(window.APP);

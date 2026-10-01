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
  // Last persisted snapshot seen by this tab. It protects unrelated changes
  // made in a second web app from a stale whole-A.db save.
  let baselineDb = null;
  const clone = value => JSON.parse(JSON.stringify(value));
  const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
  const captureBaseline = db => { baselineDb = clone(db); };
  const hasIdObjects = list => Array.isArray(list) && list.every(x => x && typeof x === 'object' && !Array.isArray(x) && x.id != null);

  // Three-way merge: unchanged local fields retain the newest persisted value;
  // local edits apply on top. Arrays of business records merge by stable id.
  function mergeChanged(base, local, remote) {
    if (same(local, base)) return clone(remote);
    if (same(remote, base)) return clone(local);
    if (Array.isArray(base) && Array.isArray(local) && Array.isArray(remote) && hasIdObjects(base) && hasIdObjects(local) && hasIdObjects(remote)) {
      const baseById = new Map(base.map(x => [x.id, x]));
      const localById = new Map(local.map(x => [x.id, x]));
      const remoteById = new Map(remote.map(x => [x.id, x]));
      const ids = remote.map(x => x.id).concat(local.map(x => x.id).filter(id => !remoteById.has(id)));
      return ids.reduce((out, id) => {
        const b = baseById.get(id), l = localById.get(id), r = remoteById.get(id);
        if (!b) { out.push(clone(l || r)); return out; }
        if (!l) { if (!r || same(r, b)) return out; out.push(clone(r)); return out; }
        if (!r) { if (!same(l, b)) out.push(clone(l)); return out; }
        out.push(mergeChanged(b, l, r)); return out;
      }, []);
    }
    if (base && local && remote && typeof base === 'object' && typeof local === 'object' && typeof remote === 'object' && !Array.isArray(base) && !Array.isArray(local) && !Array.isArray(remote)) {
      const out = {};
      new Set(Object.keys(base).concat(Object.keys(local), Object.keys(remote))).forEach(key => {
        const inBase = Object.prototype.hasOwnProperty.call(base, key), inLocal = Object.prototype.hasOwnProperty.call(local, key), inRemote = Object.prototype.hasOwnProperty.call(remote, key);
        if (!inLocal) { if (inRemote && (!inBase || !same(remote[key], base[key]))) out[key] = clone(remote[key]); return; }
        if (!inRemote) { if (!inBase || !same(local[key], base[key])) out[key] = clone(local[key]); return; }
        out[key] = inBase ? mergeChanged(base[key], local[key], remote[key]) : clone(local[key]);
      });
      return out;
    }
    return clone(local);
  }
  function readSharedState() {
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) return { db: null };
      const db = JSON.parse(raw);
      return db && db.version === D.VERSION ? { db } : { db: null, incompatible: true };
    } catch (e) { return { db: null, invalid: true }; }
  }
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

  A.save = function () {
    try {
      const latest = readSharedState();
      if (latest.incompatible || latest.invalid) { console.warn('[choso] Shared state khong tuong thich; bo qua ghi de.'); return false; }
      if (latest.db && baselineDb && !same(latest.db, baselineDb)) { A.db = mergeChanged(baselineDb, A.db, latest.db); A.reindex(); }
      localStorage.setItem(KEY, JSON.stringify(A.db));
      captureBaseline(A.db);
      return true;
    } catch (e) { return false; }
  };

  A.fresh = function () {
    A.db = D.build();
    A.reindex();
    captureBaseline(A.db);
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
        if (x && x.version === D.VERSION) { A.db = x; captureBaseline(x); }
        else if (x && x.version) backupOutdated(s, x.version);
      }
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
    // Hợp đồng seed cũ thiếu serviceApplicability → tính nháp bỏ qua điện, nước, dịch vụ. Bổ sung đúng như seed
    // hiện tại (điểm có công tơ: điện + nước; chợ TTD: dịch vụ), không đụng hợp đồng đã khai báo trên UI.
    let serviceMigrated = false;
    (A.db.contracts || []).forEach(c => {
      if (c.serviceApplicability) return;
      const st = A.idx.stall.get(c.businessPointId || c.stallId) || {};
      c.serviceApplicability = { electricity: !!st.hasMeter, water: !!st.hasMeter, marketService: c.market === 'TTD' };
      serviceMigrated = true;
    });
    if (serviceMigrated) A.save();
    // QUA_HAN_CHUYEN_CONG_NO: khoản quá hạn chưa thu → hệ thống tự chuyển công nợ (idempotent).
    if (A.syncDebts) A.syncDebts({ save: false });
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
  // External-tab refresh: never seed, clear, or write localStorage. UI callers
  // decide separately whether it is safe to render (for example, no open form).
  data.reloadSharedState = function () {
    const latest = readSharedState();
    if (!latest.db) return { changed: false, reason: latest.incompatible ? 'INCOMPATIBLE' : (latest.invalid ? 'INVALID' : 'EMPTY') };
    if (baselineDb && same(latest.db, baselineDb)) return { changed: false };
    A.db = latest.db;
    captureBaseline(latest.db);
    A.reindex();
    if (A.syncDebts) A.syncDebts({ save: false });
    if (!Array.isArray(A.db.phoneChangeRequests)) A.db.phoneChangeRequests = [];
    return { changed: true };
  };
  data.clearPersisted = function () {
    try { localStorage.removeItem(KEY); } catch (e) { /* bỏ qua */ }
  };
})(window.APP);

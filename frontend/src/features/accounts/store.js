/* Dữ liệu dùng chung cho màn "Tài khoản người dùng" (Vận hành) — đồng thời là nguồn
 * "Account Demo" mà topbar dùng để xác định phiên đang chạy (xem A.currentAccount() ở core.js).
 * Module này ĐỘC LẬP với D.STAFF trong data.js — D.STAFF vẫn giữ nguyên,
 * tiếp tục dùng cho dropdown "Người xử lý" ở Phản ánh & sự cố như cũ.
 * Seed mặc định TÁI SỬ DỤNG các bản ghi D.STAFF (không đổi mã/tên/chợ) cho 2 chợ có sẵn dữ liệu
 * nghiệp vụ (Chợ Cao Lãnh 'CL', Chợ quê Tân Thuận Đông 'TTD'), cộng thêm account demo tự viết cho
 * 10 chợ còn lại trong market master (RBAC_MARKET_SCOPE_MIGRATION mục 19 — market master 12 chợ,
 * xem D.MARKETS ở data.js) để chứng minh market scope hoạt động đúng ở mọi chợ, không chỉ 2 chợ gốc.
 *
 * RBAC_MARKET_SCOPE_MIGRATION: role master 8 → 6 (loại 'market_staff'/'accountant' — xem
 * js/permissions.js). roleIds của mọi account LUÔN thuộc 1 trong 6 role còn hiệu lực; đọc role hiệu
 * lực của account LUÔN qua A.ACCOUNTS.primaryRole() (không đọc roleIds[0] trực tiếp ở nơi khác), để
 * sau này hỗ trợ nhiều role/account chỉ cần sửa đúng 1 hàm này.
 *
 * scopeType (GLOBAL/MARKET, mục 5 yêu cầu) KHÔNG lưu thành field riêng để tránh 2 nguồn dữ liệu có
 * thể lệch nhau — suy ra TRỰC TIẾP từ marketScopes: chứa 'ALL' = GLOBAL (system_admin/ward_leader),
 * ngược lại = MARKET (market_manager/collector/technician/trader). Xem A.ACCOUNTS.scopeType() và
 * A.allowedMarkets() (js/core.js) — nơi DUY NHẤT giải mã 'ALL'.
 */
(function (A) {
  'use strict';
  const D = A.D;
  const U = A.U;
  const AKEY = 'choso-caolanh-accounts';
  const ASCHEMA_KEY = 'choso-caolanh-accounts-schema';
  const defaultAccounts = () => A.data.getSource('accounts-seed').defaultAccounts();
  // Các account/role này có phạm vi nghiệp vụ được chốt là toàn bộ market. `ALL` là convention
  // sẵn có; A.allowedMarkets() là nơi duy nhất giải mã nó sang danh sách market hiệu lực.
  const CANONICAL_MARKET_MANAGER_ID = 'AC-NV01';
  const ALL_SCOPE_ROLE_IDS = ['system_admin', 'ward_leader', 'central_accountant'];
  // Explicit former per-market manager seed IDs only. Never infer legacy status
  // from a user-editable code suffix such as "-QL".
  const LEGACY_MANAGER_SEED_IDS = new Set([
    'AC-NV06', 'AC-HA-QL', 'AC-TVH-QL', 'AC-TTT-QL', 'AC-TL-QL', 'AC-TT-QL',
    'AC-TTH-QL', 'AC-MN-QL', 'AC-LH-QL', 'AC-XB-QL', 'AC-SQ-QL'
  ]);

  // ACCOUNT_TYPES ("Loại tài khoản" — filter/field hiển thị riêng, độc lập với Vai trò RBAC nhưng
  // PHẢI khớp đúng 1-1 với tên 6 role hiện hành để không còn nhãn "mồ côi" (RBAC_MARKET_SCOPE_
  // MIGRATION mục 2: "role labels" cũng phải migrate) — lấy ĐỘNG từ A.PERM.roles() (permissions.js
  // đã chạy xong trước accounts.js trong index.html, xem thứ tự script), không hard-code chuỗi lặp.
  const ACCOUNT_TYPES = A.PERM.roles().map(r => r.name);

  const RETIRED_SEED_ACCOUNT_IDS = [
    'AC-BQL-TTD', 'AC-PHIEN-DEMO',
    // RBAC_MARKET_SCOPE_MIGRATION: account demo "Nguyễn Văn A"/"Nguyễn Thanh Bình" tạo riêng cho
    // luồng "market_staff tiếp nhận yêu cầu tách điểm" (BUSINESS_POINT_SPLIT_WORKFLOW supplement) —
    // role 'market_staff' đã loại bỏ, bước "tiếp nhận" của tách/gộp/chuyển đổi điểm kinh doanh nay
    // gộp hẳn vào market_manager (NV01 đã có đủ quyền) nên không còn lý do nghiệp vụ riêng để giữ 2
    // account này (mục 26: "không giữ alias role cũ chỉ để tránh sửa code"). CL vẫn đủ 4 account
    // D.STAFF (1 market_manager + 2 collector + 1 technician) để demo mọi thao tác còn lại.
    'AC-NV08'
  ];

  // Safe-merge cho account ĐÃ LƯU trong localStorage từ trước khi có field `traderId` (mục tương
  // tự mergeNewDefaultAccounts — KHÔNG đổi bất kỳ giá trị nào đã có, chỉ bổ sung field còn thiếu).
  function ensureTraderIdField(list) {
    let changed = false;
    list.forEach(a => { if (!('traderId' in a)) { a.traderId = null; changed = true; } });
    return changed;
  }

  // Chỉ chuẩn hóa account có phạm vi toàn hệ thống đã được chốt. Không chạm scope tự chọn của
  // collector/technician/trader, Kế toán phường, hay các account quản lý legacy theo từng chợ.
  function normalizeFixedAllScopes(list) {
    let changed = false;
    list.forEach(a => {
      const roleId = (a.roleIds || [])[0];
      const fixedAll = ALL_SCOPE_ROLE_IDS.indexOf(roleId) !== -1 || (a.id === CANONICAL_MARKET_MANAGER_ID && roleId === 'market_manager');
      if (!fixedAll || (Array.isArray(a.marketScopes) && a.marketScopes.length === 1 && a.marketScopes[0] === 'ALL')) return;
      a.marketScopes = ['ALL'];
      changed = true;
    });
    return changed;
  }

  // Bổ sung AN TOÀN account demo MỚI vào danh sách account ĐÃ LƯU trong localStorage của trình
  // duyệt — KHÔNG đụng account nào đã có (kể cả đã bị người dùng tuỳ biến qua màn "Tài khoản người
  // dùng": đổi tên, khoá/mở khoá, đổi vai trò/phạm vi chợ...). Chỉ thêm những id hoàn toàn chưa tồn
  // tại trong mảng đã lưu, giống nguyên tắc "merge, không reset" mà js/permissions.js đã áp dụng cho
  // RolePermission — KHÔNG bump `A.RBAC_SCHEMA` chỉ để thêm account demo (bump RBAC_SCHEMA sẽ kéo
  // theo reseed toàn bộ role/account/ui state, quá rộng so với thay đổi thật sự cần).
  function mergeNewDefaultAccounts(stored) {
    const ids = new Set(stored.map(a => a.id));
    const additions = defaultAccounts().filter(a => !ids.has(a.id));
    if (!additions.length) return stored;
    const merged = stored.concat(additions);
    try { localStorage.setItem(AKEY, JSON.stringify(merged)); } catch (e) { /* bỏ qua */ }
    return merged;
  }
  function loadAccounts() {
    try {
      // Schema migration: mảng account đã lưu từ bản role/market cũ không tương thích (RBAC_SCHEMA
      // đã bump — xem js/core.js) — chỉ dùng lại nếu đúng schema hiện tại, ngược lại bỏ và seed lại
      // từ defaultAccounts() (12 chợ, 6 role). Không cố "vá" account role đã nghỉ hưu (mục 25: fallback
      // an toàn, không tự nâng quyền).
      if (localStorage.getItem(ASCHEMA_KEY) === String(A.RBAC_SCHEMA)) {
        const s = localStorage.getItem(AKEY);
        if (s) {
          const x = JSON.parse(s);
          if (Array.isArray(x)) {
            const merged = mergeSeedAccounts(x);
            if (ensureTraderIdField(merged) || normalizeFixedAllScopes(merged)) { try { localStorage.setItem(AKEY, JSON.stringify(merged)); } catch (e) { /* bỏ qua */ } }
            return merged;
          }
        }
      }
    } catch (e) { /* bỏ qua */ }
    return defaultAccounts();
  }
  function mergeSeedAccounts(accounts) {
    const before = accounts.length;
    accounts = accounts.filter(a => RETIRED_SEED_ACCOUNT_IDS.indexOf(a.id) === -1);
    const existingIds = new Set(accounts.map(a => a.id));
    let changed = accounts.length !== before;
    // Seed may add a missing demo login phone after an account has already been
    // persisted. Backfill only a blank persisted value: never overwrite a phone
    // that a prototype user/admin has explicitly configured.
    const seedById = new Map(defaultAccounts().map(a => [a.id, a]));
    const legacyAccountantSeeds = {
      'AC-KTTT01': { id: 'AC-KTTT01', code: 'KTTT01', fullName: 'Nguyễn Thị Minh Anh', phone: '0900000006', accountType: 'Kế toán Trung tâm', title: 'Kế toán Trung tâm', roleIds: ['central_accountant'], organization: 'Tổ Văn phòng – Trung tâm Cung ứng dịch vụ công', marketScopes: ['CL'], status: 'active' },
    };
    accounts.forEach(a => {
      const legacy = legacyAccountantSeeds[a.id], seed = seedById.get(a.id);
      if (!legacy || !seed || !Object.keys(legacy).every(key => JSON.stringify(a[key]) === JSON.stringify(legacy[key]))) return;
      Object.assign(a, seed);
      changed = true;
    });
    accounts.forEach(a => {
      const seed = seedById.get(a.id);
      if (!seed || a.id !== 'AC-KTTT01' || (a.roleIds || []).length) return;
      const fields = ['code', 'fullName', 'phone', 'accountType', 'title', 'organization', 'marketScopes', 'status'];
      if (!fields.every(key => JSON.stringify(a[key]) === JSON.stringify(seed[key]))) return;
      a.roleIds = seed.roleIds;
      changed = true;
    });
    accounts.forEach(a => {
      const seed = seedById.get(a.id);
      const existingPhone = String(a.phone || '').replace(/\D/g, '');
      if (!seed || existingPhone || !seed.phone) return;
      const phone = String(seed.phone).replace(/\D/g, '');
      const taken = accounts.some(other => other.id !== a.id && String(other.phone || '').replace(/\D/g, '') === phone);
      if (!taken) { a.phone = seed.phone; changed = true; }
    });
    const chiQuyetSeed = defaultAccounts().find(a => a.id === 'AC-CHI-QUYET');
    const oldChiQuyet = accounts.find(a => a.id === 'AC-CHI-QUYET' || a.fullName === 'Chí Quyết');
    if (chiQuyetSeed && oldChiQuyet) {
      Object.assign(oldChiQuyet, {
        id: chiQuyetSeed.id,
        code: chiQuyetSeed.code,
        fullName: chiQuyetSeed.fullName,
        phone: chiQuyetSeed.phone,
        accountType: chiQuyetSeed.accountType,
        title: chiQuyetSeed.title,
        roleIds: chiQuyetSeed.roleIds,
        organization: chiQuyetSeed.organization,
        marketScopes: chiQuyetSeed.marketScopes,
        status: chiQuyetSeed.status,
        linkedTraderId: chiQuyetSeed.linkedTraderId
      });
      existingIds.add(chiQuyetSeed.id);
      changed = true;
    }
    defaultAccounts().forEach(acc => {
      if (!existingIds.has(acc.id)) {
        accounts.push(acc);
        existingIds.add(acc.id);
        changed = true;
      }
    });
    if (changed) {
      try {
        localStorage.setItem(AKEY, JSON.stringify(accounts));
        localStorage.setItem(ASCHEMA_KEY, String(A.RBAC_SCHEMA));
      } catch (e) { /* bỏ qua */ }
    }
    return accounts;
  }
  let ACCOUNTS = loadAccounts();
  function saveAccounts() {
    try {
      localStorage.setItem(AKEY, JSON.stringify(ACCOUNTS));
      localStorage.setItem(ASCHEMA_KEY, String(A.RBAC_SCHEMA));
    } catch (e) { /* bỏ qua */ }
  }

  // Current collector assignment is derived solely from active collector accounts'
  // marketScopes. Persisted scopes on locked accounts are intentionally retained for
  // history/compatibility, but do not reserve a market for a current assignment.
  const isActiveCollector = account => !!account && A.ACCOUNTS && A.ACCOUNTS.isActive(account)
    && A.ACCOUNTS.primaryRole(account) === 'collector';
  const uniqueMarketScopes = scopes => Array.from(new Set((scopes || []).filter(Boolean)));
  function marketCollectors(marketId, excludeId) {
    return ACCOUNTS.filter(a => a.id !== excludeId && isActiveCollector(a)
      && A.allowedMarkets(a).indexOf(marketId) !== -1);
  }
  function marketCollectorState(marketId, excludeId) {
    const collectors = marketCollectors(marketId, excludeId);
    return {
      marketId,
      collectors,
      status: collectors.length === 0 ? 'UNASSIGNED' : (collectors.length === 1 ? 'ASSIGNED' : 'CONFLICT'),
      collector: collectors.length === 1 ? collectors[0] : null
    };
  }

  // This is the only write path that can move a current collector assignment. It
  // changes the old and new account in memory first, then persists the account list
  // once, so no intermediate duplicate assignment is stored.
  function saveCollectorAccount(record, options) {
    options = options || {};
    const existing = record && record.id && ACCOUNTS.find(a => a.id === record.id);
    const candidate = Object.assign({}, existing || {}, record || {});
    const isNew = !existing;
    const scopes = uniqueMarketScopes(candidate.marketScopes);
    const transferMarkets = new Set(options.transferMarkets || []);
    if (A.ACCOUNTS.primaryRole(candidate) !== 'collector') return { ok: false, reason: 'NOT_COLLECTOR' };
    if (isNew && !scopes.length) return { ok: false, reason: 'COLLECTOR_SCOPE_REQUIRED' };

    const conflicts = (isActiveCollector(candidate) ? scopes : []).map(marketId => ({ marketId, collectors: marketCollectors(marketId, candidate.id) }))
      .filter(x => x.collectors.length);
    const unconfirmed = conflicts.filter(x => !transferMarkets.has(x.marketId));
    if (unconfirmed.length) return { ok: false, reason: 'TRANSFER_REQUIRED', conflicts: unconfirmed };

    candidate.marketScopes = scopes;
    if (existing) Object.assign(existing, candidate); else ACCOUNTS.push(candidate);
    // A transfer deliberately resolves every active legacy conflict for the chosen
    // market; it never chooses one conflict participant arbitrarily.
    conflicts.forEach(x => {
      x.collectors.forEach(old => {
        old.marketScopes = uniqueMarketScopes(old.marketScopes).filter(id => id !== x.marketId);
      });
    });
    saveAccounts();
    return { ok: true, account: existing || candidate, transferred: conflicts.map(x => x.marketId) };
  }

  A.ACCOUNTS = {
    KEY: AKEY,
    ACCOUNT_TYPES: ACCOUNT_TYPES,
    list: () => ACCOUNTS,
    get: id => ACCOUNTS.find(a => a.id === id),
    normalizePhone: phone => String(phone || '').replace(/\D/g, ''),
    byPhone: phone => {
      const normalized = String(phone || '').replace(/\D/g, '');
      return normalized ? ACCOUNTS.find(a => String(a.phone || '').replace(/\D/g, '') === normalized) || null : null;
    },
    authStatus: account => {
      const status = account && account.status;
      if (status === 'PENDING_ACTIVATION') return 'PENDING_ACTIVATION';
      if (status === 'LOCKED' || status === 'locked' || status === 'disabled') return 'LOCKED';
      return 'ACTIVE';
    },
    isActive: account => !!account && !['LOCKED', 'locked', 'disabled', 'PENDING_ACTIVATION'].includes(account.status),
    // V1 chỉ dùng roleIds[0] làm role hiệu lực (mỗi account seed đúng 1 role). Cấu trúc roleIds[]
    // vẫn là mảng để sau này hỗ trợ nhiều role/account mà không phải đổi shape dữ liệu — khi đó
    // chỉ cần sửa đúng hàm này (thêm UI chọn role trong account), mọi nơi khác đang gọi hàm này
    // không cần sửa.
    primaryRole: account => (account && account.roleIds && account.roleIds[0]) || null,
    // scopeType (mục 5 yêu cầu) — suy ra từ marketScopes, KHÔNG lưu field riêng (xem comment đầu
    // file). 'GLOBAL' = system_admin/ward_leader (marketScopes chứa 'ALL'); 'MARKET' = còn lại.
    scopeType: account => (account && Array.isArray(account.marketScopes) && account.marketScopes.indexOf('ALL') !== -1) ? 'GLOBAL' : 'MARKET',
    scopeModeForRole: roleId => roleId === 'trader' ? 'TRADER' : (roleId === 'market_manager' || ALL_SCOPE_ROLE_IDS.indexOf(roleId) !== -1 ? 'ALL' : 'MARKET'),
    canonicalMarketManagerId: () => CANONICAL_MARKET_MANAGER_ID,
    isCanonicalMarketManager: account => !!account && account.id === CANONICAL_MARKET_MANAGER_ID && A.ACCOUNTS.primaryRole(account) === 'market_manager',
    isKnownLegacyManagerSeed: account => !!account && LEGACY_MANAGER_SEED_IDS.has(account.id) && A.ACCOUNTS.primaryRole(account) === 'market_manager',
    // Presentation-only current organization list. Legacy records remain in
    // ACCOUNTS/list/localStorage for compatibility and can still be audited.
    currentList: () => ACCOUNTS.filter(a => !A.ACCOUNTS.isKnownLegacyManagerSeed(a)),
    getMarketCollectors: marketId => marketCollectors(marketId),
    getMarketCollector: marketId => marketCollectorState(marketId).collector,
    marketCollectorState: (marketId, excludeId) => marketCollectorState(marketId, excludeId),
    collectorMarketConflicts: account => {
      if (!account || A.ACCOUNTS.primaryRole(account) !== 'collector') return [];
      return uniqueMarketScopes(account.marketScopes).filter(mid => marketCollectorState(mid).status === 'CONFLICT');
    },
    saveCollectorAccount,
    // Tài khoản Mini App liên kết với 1 traderId (TRADER_PROFILE_AND_MINIAPP_WORKFLOW) — chỉ tìm
    // trong account role 'trader', KHÔNG giả định 1-1 tuyệt đối ở tầng dữ liệu (phòng thủ dữ liệu
    // hỏng/nhiều account cùng trỏ 1 traderId) nhưng UI/nghiệp vụ luôn coi là 1-1.
    byTraderId: traderId => ACCOUNTS.find(a => a.traderId === traderId) || null,
    codeTaken: (code, excludeId) => {
      const c = (code || '').trim().toLowerCase();
      return ACCOUNTS.some(a => a.id !== excludeId && a.code.trim().toLowerCase() === c);
    },
    add: acc => { ACCOUNTS.push(acc); saveAccounts(); },
    update: (id, patch) => { const a = A.ACCOUNTS.get(id); if (a) Object.assign(a, patch); saveAccounts(); },
    setStatus: (id, status) => { const a = A.ACCOUNTS.get(id); if (a) a.status = status; saveAccounts(); },
    resetDefault: () => { ACCOUNTS = defaultAccounts(); saveAccounts(); }
  };
  // Phase 12: expose this store to src/features/accounts through the shared data
  // adapter (same pattern as marketcatalog.js). Persistence stays here (AKEY).
  if (A.data && typeof A.data.registerSource === 'function') {
    A.data.registerSource('accounts', {
      list: () => A.ACCOUNTS.list(),
      get: id => A.ACCOUNTS.get(id),
      byTraderId: traderId => A.ACCOUNTS.byTraderId(traderId),
      add: acc => A.ACCOUNTS.add(acc),
      setStatus: (id, status) => A.ACCOUNTS.setStatus(id, status)
    });
  }

  // Staff directory lookup (D.STAFF mock; from js/core.js, Phase 15.8).
  U.staffName = id => { const s = D.STAFF.find(x => x.id === id); return s ? s.name : (id || ''); };
})(window.APP);

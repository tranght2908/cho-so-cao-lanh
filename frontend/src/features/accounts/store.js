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
  // technician: ['ALL'] chỉ để mở sự cố được giao ở bất kỳ chợ nào (Incident.assignee là nguồn phân công).
  const ALL_SCOPE_ROLE_IDS = ['system_admin', 'ward_leader', 'central_accountant', 'technician'];
  // Explicit former per-market manager seed IDs only. Never infer legacy status
  // from a user-editable code suffix such as "-QL".
  const LEGACY_MANAGER_SEED_IDS = new Set([
    'AC-NV06', 'AC-HA-QL', 'AC-TVH-QL', 'AC-TTT-QL', 'AC-TL-QL', 'AC-TT-QL',
    'AC-TTH-QL', 'AC-MN-QL', 'AC-LH-QL', 'AC-XB-QL', 'AC-SQ-QL'
  ]);
  // Account demo cũ KHÔNG thuộc tổ chức hiện hành (danh sách id tường minh, không suy luận theo hậu tố/tên/
  // role). Bản ghi đã lưu được GIỮ NGUYÊN (không xoá, không đổi status) để đọc lịch sử; chỉ bị loại khỏi
  // currentList/KPI/bộ lọc, không được tính là NV đang phụ trách và không đăng nhập được (authStatus suy ra).
  const RETIRED_DEMO_ACCOUNT_IDS = new Set([
    'AC-NV04', 'AC-NV08', 'AC-KT01', 'AC-KTP01',
    'AC-HA-TP', 'AC-TVH-TP', 'AC-TTT-TP', 'AC-TL-TP', 'AC-TT-TP', 'AC-TTH-TP', 'AC-MN-TP', 'AC-LH-TP', 'AC-XB-TP', 'AC-SQ-TP',
    'AC-TVH-KT', 'AC-TTT-KT', 'AC-TL-KT', 'AC-TT-KT', 'AC-TTH-KT', 'AC-MN-KT', 'AC-LH-KT', 'AC-XB-KT', 'AC-SQ-KT'
  ]);
  const isLegacyManagerRecord = a => !!a && LEGACY_MANAGER_SEED_IDS.has(a.id) && (a.roleIds || [])[0] === 'market_manager';
  // Account có role kế toán cũ (A06/market_accountant) cũng không thuộc tổ chức hiện hành.
  const isCurrentOrganization = a => !!a && !isLegacyManagerRecord(a) && !RETIRED_DEMO_ACCOUNT_IDS.has(a.id)
    && !(A.PERM.isLegacyCompatRole && A.PERM.isLegacyCompatRole((a.roleIds || [])[0]));

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
    // AC-NV08 không còn bị xoá ở đây: nay thuộc RETIRED_DEMO_ACCOUNT_IDS (giữ bản ghi, ẩn khỏi tổ chức).
  ];

  // Safe-merge cho account ĐÃ LƯU trong localStorage từ trước khi có field `traderId` (mục tương
  // tự mergeNewDefaultAccounts — KHÔNG đổi bất kỳ giá trị nào đã có, chỉ bổ sung field còn thiếu).
  function ensureTraderIdField(list) {
    let changed = false;
    list.forEach(a => { if (!('traderId' in a)) { a.traderId = null; changed = true; } });
    return changed;
  }

  // ---------- ACCOUNT 1 — N TRADER PROFILE (Account.traderIds[]) ----------
  // Quan hệ lưu ở PHÍA ACCOUNT (không có Trader.accountId): A.db (chứa hồ sơ) có thể được dựng lại độc lập với
  // kho account. Bất biến: traderIds luôn là mảng, không trùng; traderId (hồ sơ mặc định — tương thích giai đoạn
  // chuyển đổi) nếu có thì nằm trong traderIds; linkedTraderId (legacy) chỉ để migrate/đọc. Một hồ sơ không thuộc
  // hai account — dữ liệu cũ vi phạm KHÔNG tự sửa, chỉ báo qua traderLinkConflicts().
  const uniqIds = xs => Array.from(new Set((xs || []).filter(x => typeof x === 'string' && x)));
  function traderIdsOf(a) {
    if (!a) return [];
    return uniqIds((Array.isArray(a.traderIds) ? a.traderIds : []).concat([a.traderId, a.linkedTraderId]));
  }
  // Chuẩn hoá liên kết của 1 account (idempotent): gom traderId/linkedTraderId vào traderIds; account tiểu thương có
  // đúng 1 hồ sơ và chưa có traderId → dùng hồ sơ đó làm traderId mặc định (auth/portal hiện đọc traderId).
  function normalizeTraderLinks(a) {
    if (!a) return false;
    const before = JSON.stringify([a.traderIds, a.traderId]);
    a.traderIds = traderIdsOf(a);
    if (!a.traderId && a.traderIds.length === 1 && (a.roleIds || [])[0] === 'trader') a.traderId = a.traderIds[0];
    return JSON.stringify([a.traderIds, a.traderId]) !== before;
  }
  // LIEN_KET_AC_TT01 (01/10/2026): account demo AC-TT01 (Nguyễn Thị Hoa, 0909345678) trước đây seed traderId null
  // → cổng tiểu thương báo "chưa liên kết hồ sơ" và phạm vi chợ trống. Liên kết đúng 1 lần với hồ sơ TT0001 (cùng
  // tên, cùng SĐT, Chợ Cao Lãnh) nếu account chưa có hồ sơ nào và hồ sơ chưa thuộc account khác; sau đó tôn trọng
  // mọi thay đổi liên kết của Quản trị.
  function linkDemoTraderAccounts(list) {
    const a = list.find(x => x.id === 'AC-TT01');
    if (!a || a.demoTraderLinkVersion >= 1) return false;
    const taken = list.some(o => o !== a && traderIdsOf(o).indexOf('TT0001') !== -1);
    if (!traderIdsOf(a).length && !taken) { a.traderId = 'TT0001'; a.traderIds = ['TT0001']; }
    a.demoTraderLinkVersion = 1;
    return true;
  }
  function ensureTraderIdsField(list) {
    let changed = false;
    list.forEach(a => { if (normalizeTraderLinks(a)) changed = true; });
    return changed;
  }

  // Chỉ chuẩn hóa account HIỆN HÀNH có phạm vi toàn hệ thống đã được chốt. Không chạm scope tự chọn của
  // collector/trader, account ngoài tổ chức hiện hành, hay các account quản lý legacy theo từng chợ.
  function normalizeFixedAllScopes(list) {
    let changed = false;
    list.forEach(a => {
      if (!isCurrentOrganization(a)) return;
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
  // CURRENT_ORG_DEMO v1: đưa account NV thu phí/kỹ thuật demo hiện hành đã lưu (seed cũ) về bộ demo chuẩn —
  // chỉ đổi trường còn ĐÚNG giá trị seed cũ (người dùng đã tuỳ biến thì giữ nguyên). Marker theo từng
  // account (currentOrgDemoVersion) để chạy đúng 1 lần, reload không lặp. Không thêm/xoá account, không đổi status.
  const CURRENT_ORG_DEMO_VERSION = 1;
  function normalizeCurrentOrgDemoAccounts(list) {
    let changed = false;
    const seeds = new Map(defaultAccounts().map(a => [a.id, a]));
    const collectorScopes = (A.data.getSource('accounts-seed').collectorMarketScopes || (() => ({})))();
    const marketIds = new Set(D.MARKETS.map(m => m.id));
    const oldOrgs = new Set(D.MARKETS.map(m => 'Ban Quản lý ' + m.short).concat(D.MARKETS.map(m => 'Ban Quản lý ' + m.name)));
    const same = (x, y) => JSON.stringify(x) === JSON.stringify(y);
    list.forEach(a => {
      const seed = seeds.get(a.id), roleId = (a.roleIds || [])[0];
      if (!seed || !isCurrentOrganization(a) || a.currentOrgDemoVersion >= CURRENT_ORG_DEMO_VERSION) return;
      if (roleId !== (seed.roleIds || [])[0] || ['collector', 'technician'].indexOf(roleId) === -1) return;
      const staff = D.STAFF.find(x => 'AC-' + x.id === a.id);
      const oldScope = staff ? [staff.market] : (a.id === 'AC-HA-KT' ? ['HA'] : null);
      if (oldOrgs.has(a.organization)) a.organization = seed.organization;
      if (oldScope && same(a.marketScopes, oldScope)) {
        if (roleId === 'technician') a.marketScopes = ['ALL'];
        else {
          // Không tạo trùng NV thu phí hiện hành: bỏ qua Chợ đang có NV thu phí hiện hành khác.
          const taken = mid => list.some(o => o !== a && (o.roleIds || [])[0] === 'collector' && A.ACCOUNTS.isActive(o)
            && A.allowedMarkets(o).indexOf(mid) !== -1);
          const wanted = (collectorScopes[a.code] || []).filter(mid => marketIds.has(mid) && (mid === oldScope[0] || !taken(mid)));
          if (wanted.length) a.marketScopes = wanted;
        }
      }
      a.currentOrgDemoVersion = CURRENT_ORG_DEMO_VERSION;
      changed = true;
    });
    return changed;
  }
  let loadedFromStorage = false;
  function loadAccounts() {
    try {
      // Keep a valid persisted account array across schema revisions.  The
      // normalizers below are additive; a schema marker alone is never grounds
      // to discard accounts created by the other web application.
      // Accounts are shared by frontend/index.html and frontend/tieu-thuong/
      // under one origin.  A stale schema marker must not hide a valid account
      // list and replace it with defaults in the other web app.
      const s = localStorage.getItem(AKEY);
      if (s) {
        const x = JSON.parse(s);
        if (Array.isArray(x)) {
          loadedFromStorage = true;
          const schemaMismatch = localStorage.getItem(ASCHEMA_KEY) !== String(A.RBAC_SCHEMA);
          const merged = mergeSeedAccounts(x);
          const traderField = ensureTraderIdField(merged), demoLink = linkDemoTraderAccounts(merged), traderLinks = ensureTraderIdsField(merged), fixedAll = normalizeFixedAllScopes(merged);
          if (schemaMismatch || traderField || demoLink || traderLinks || fixedAll) {
            try {
              localStorage.setItem(AKEY, JSON.stringify(merged));
              localStorage.setItem(ASCHEMA_KEY, String(A.RBAC_SCHEMA));
            } catch (e) { /* bỏ qua */ }
          }
          return merged;
        }
      }
    } catch (e) { /* bỏ qua */ }
    const seeded = defaultAccounts();
    ensureTraderIdsField(seeded);
    return seeded;
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
    // KTTT01 cũ có thể đã được normalizeFixedAllScopes đổi scope ['CL'] → ['ALL'] ở lần load trước, nên
    // marketScopes chấp nhận cả hai. Chỉ khớp khi MỌI trường khác còn đúng seed cũ; sau khi nâng lên seed
    // hiện tại thì không còn khớp nữa (idempotent).
    const legacyFieldOk = (key, a, legacy) => key === 'marketScopes'
      ? [JSON.stringify(legacy.marketScopes), JSON.stringify(['ALL'])].indexOf(JSON.stringify(a.marketScopes)) !== -1
      : JSON.stringify(a[key]) === JSON.stringify(legacy[key]);
    accounts.forEach(a => {
      const legacy = legacyAccountantSeeds[a.id], seed = seedById.get(a.id);
      if (!legacy || !seed || !Object.keys(legacy).every(key => legacyFieldOk(key, a, legacy))) return;
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
  let accountBaseline = JSON.parse(JSON.stringify(ACCOUNTS));
  const accountSame = (a, b) => JSON.stringify(a) === JSON.stringify(b);
  function mergeAccount(base, local, remote) {
    if (accountSame(local, base)) return JSON.parse(JSON.stringify(remote));
    if (accountSame(remote, base)) return JSON.parse(JSON.stringify(local));
    const out = {};
    new Set(Object.keys(base).concat(Object.keys(local), Object.keys(remote))).forEach(key => {
      const b = Object.prototype.hasOwnProperty.call(base, key), l = Object.prototype.hasOwnProperty.call(local, key), r = Object.prototype.hasOwnProperty.call(remote, key);
      if (!l) { if (r && (!b || !accountSame(remote[key], base[key]))) out[key] = remote[key]; return; }
      if (!r) { if (!b || !accountSame(local[key], base[key])) out[key] = local[key]; return; }
      out[key] = b && !accountSame(local[key], base[key]) && !accountSame(remote[key], base[key]) ? local[key] : (!accountSame(local[key], base[key]) ? local[key] : remote[key]);
    });
    return out;
  }
  function mergeAccounts(base, local, remote) {
    const bm = new Map(base.map(a => [a.id, a])), lm = new Map(local.map(a => [a.id, a])), rm = new Map(remote.map(a => [a.id, a]));
    const ids = remote.map(a => a.id).concat(local.map(a => a.id).filter(id => !rm.has(id)));
    return ids.reduce((out, id) => { const b = bm.get(id), l = lm.get(id), r = rm.get(id); out.push(b && l && r ? mergeAccount(b, l, r) : JSON.parse(JSON.stringify(l || r))); return out; }, []);
  }
  // Chạy sau khi A.ACCOUNTS sẵn sàng (cần isActive/allowedMarkets để không tạo trùng NV thu phí hiện hành).
  // Chỉ cho account ĐÃ LƯU; seed mới đã đúng bộ demo hiện hành nên không ghi gì lúc boot lần đầu.
  function migrateCurrentOrgDemo() {
    if (loadedFromStorage && normalizeCurrentOrgDemoAccounts(ACCOUNTS)) saveAccounts();
  }
  function saveAccounts() {
    try {
      const raw = localStorage.getItem(AKEY);
      if (raw) {
        const latest = JSON.parse(raw);
        if (Array.isArray(latest) && !accountSame(latest, accountBaseline)) ACCOUNTS = mergeAccounts(accountBaseline, ACCOUNTS, latest);
      }
      localStorage.setItem(AKEY, JSON.stringify(ACCOUNTS));
      localStorage.setItem(ASCHEMA_KEY, String(A.RBAC_SCHEMA));
      accountBaseline = JSON.parse(JSON.stringify(ACCOUNTS));
    } catch (e) { /* bỏ qua */ }
  }
  // Refresh the cache from the one shared account source.  Do not run seed
  // migration here: an external-tab refresh must never write accounts back.
  function reloadAccounts() {
    try {
      const raw = localStorage.getItem(AKEY);
      if (!raw) return { changed: false };
      const latest = JSON.parse(raw);
      if (!Array.isArray(latest)) return { changed: false, reason: 'INVALID' };
      if (JSON.stringify(latest) === JSON.stringify(ACCOUNTS)) return { changed: false };
      ACCOUNTS = latest;
      accountBaseline = JSON.parse(JSON.stringify(latest));
      return { changed: true };
    } catch (e) { return { changed: false, reason: 'INVALID' }; }
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
    const scopes = uniqueMarketScopes(candidate.marketScopes);
    const transferMarkets = new Set(options.transferMarkets || []);
    if (A.ACCOUNTS.primaryRole(candidate) !== 'collector') return { ok: false, reason: 'NOT_COLLECTOR' };
    // NV thu phí có thể có 0..N Chợ (mới tạo = chưa được Tổ trưởng phân công) — không bắt buộc ≥1 Chợ.

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

  const traderById = id => (A.idx && A.idx.trader ? A.idx.trader.get(id) : ((A.db && A.db.traders) || []).find(t => t.id === id)) || null;
  const accountsOfTrader = traderId => traderId ? ACCOUNTS.filter(a => traderIdsOf(a).indexOf(traderId) !== -1) : [];
  // Write path CHUẨN để gắn thêm hồ sơ vào account Tiểu thương (feature không tự push vào traderIds).
  function linkTraderProfile(accountId, traderId) {
    const a = ACCOUNTS.find(x => x.id === accountId);
    if (!a) return { ok: false, reason: 'ACCOUNT_NOT_FOUND' };
    if ((a.roleIds || [])[0] !== 'trader') return { ok: false, reason: 'NOT_TRADER_ACCOUNT' };
    const t = traderById(traderId);
    if (!t) return { ok: false, reason: 'TRADER_NOT_FOUND' };
    const owners = accountsOfTrader(traderId);
    if (owners.some(x => x.id !== a.id)) return { ok: false, reason: 'TRADER_LINKED_TO_OTHER_ACCOUNT', accountIds: owners.map(x => x.id) };
    const norm = A.ACCOUNTS.normalizePhone;
    if (!norm(t.phone) || norm(t.phone) !== norm(a.phone)) return { ok: false, reason: 'PHONE_MISMATCH' };
    // (chợ, SĐT) duy nhất giữa các hồ sơ: không có hồ sơ KHÁC cùng chợ + cùng SĐT (kể cả hồ sơ đã gắn account này).
    const dupMarketPhone = ((A.db && A.db.traders) || []).filter(x => x.id !== t.id && x.market === t.market && norm(x.phone) === norm(t.phone));
    if (dupMarketPhone.length) return { ok: false, reason: 'DUPLICATE_MARKET_PHONE', traderIds: dupMarketPhone.map(x => x.id) };
    if (owners.length) return { ok: true, account: a, alreadyLinked: true };
    a.traderIds = traderIdsOf(a).concat([traderId]);
    if (!a.traderId) a.traderId = traderId;
    saveAccounts();
    return { ok: true, account: a, alreadyLinked: false };
  }

  // ---------- OTP prototype DÙNG CHUNG cho web quản lý (app/auth.js) và web Tiểu thương (tieu-thuong/) ----------
  // Mã mô phỏng cố định; phiên OTP (challenge) dùng MỘT LẦN, gắn account + SĐT, có hạn; người gọi giữ challenge
  // trong state màn hình (không lưu localStorage). Kích hoạt Chờ kích hoạt → Đang hoạt động CHỈ sau khi xác thực đúng.
  const OTP_DEMO = '123456', OTP_TTL_MS = 5 * 60 * 1000;
  let otpSeq = 0;
  // Web Tiểu thương (canonical cho A07): session trong sessionStorage — cùng khoá trader-web đang dùng.
  const TRADER_WEB_SESSION_KEY = 'choso-caolanh-trader-web-session';

  A.ACCOUNTS = {
    reload: reloadAccounts,
    KEY: AKEY,
    ACCOUNT_TYPES: ACCOUNT_TYPES,
    list: () => ACCOUNTS,
    get: id => ACCOUNTS.find(a => a.id === id),
    normalizePhone: phone => String(phone || '').replace(/\D/g, ''),
    byPhone: phone => {
      const normalized = String(phone || '').replace(/\D/g, '');
      return normalized ? ACCOUNTS.find(a => String(a.phone || '').replace(/\D/g, '') === normalized) || null : null;
    },
    // Account ngoài tổ chức hiện hành (legacy/retired demo) được SUY RA là LOCKED — không ghi đè status đã lưu.
    authStatus: account => {
      if (account && !isCurrentOrganization(account)) return 'LOCKED';
      const status = account && account.status;
      if (status === 'PENDING_ACTIVATION') return 'PENDING_ACTIVATION';
      if (status === 'LOCKED' || status === 'locked' || status === 'disabled') return 'LOCKED';
      return 'ACTIVE';
    },
    isActive: account => !!account && isCurrentOrganization(account) && !['LOCKED', 'locked', 'disabled', 'PENDING_ACTIVATION'].includes(account.status),
    // V1 chỉ dùng roleIds[0] làm role hiệu lực (mỗi account seed đúng 1 role). Cấu trúc roleIds[]
    // vẫn là mảng để sau này hỗ trợ nhiều role/account mà không phải đổi shape dữ liệu — khi đó
    // chỉ cần sửa đúng hàm này (thêm UI chọn role trong account), mọi nơi khác đang gọi hàm này
    // không cần sửa.
    primaryRole: account => (account && account.roleIds && account.roleIds[0]) || null,
    // scopeType (mục 5 yêu cầu) — suy ra từ marketScopes, KHÔNG lưu field riêng (xem comment đầu
    // file). 'GLOBAL' = system_admin/ward_leader (marketScopes chứa 'ALL'); 'MARKET' = còn lại.
    scopeType: account => (account && Array.isArray(account.marketScopes) && account.marketScopes.indexOf('ALL') !== -1) ? 'GLOBAL' : 'MARKET',
    scopeModeForRole: roleId => roleId === 'trader' ? 'TRADER' : (roleId === 'market_manager' || ALL_SCOPE_ROLE_IDS.indexOf(roleId) !== -1 ? 'ALL' : 'MARKET'),
    // Vai trò của form "Thêm/Sửa tài khoản nội bộ": role hiện hành CÓ trong danh mục actor (D.ACTORS), trừ
    // Tiểu thương (tài khoản Mini App đi luồng riêng). Không có A06/market_accountant/role legacy.
    internalRoles: () => A.PERM.currentRoles().filter(r => r.id !== 'trader' && (D.ACTORS || []).some(x => x.roleId === r.id)),
    // Đơn vị suy ra theo vai trò — không nhập tự do. Tổ Quản lý chợ chung (MARKET_CATALOG.MANAGEMENT_UNIT) cho
    // A02/A03/A04; vai trò khác lấy "Đơn vị" của actor (D.ACTORS, bản chỉnh ở Vai trò & phân quyền nếu có).
    // null = vai trò không có actor (trader/legacy/tuỳ biến) → nơi gọi giữ đơn vị đã lưu.
    organizationForRole: roleId => {
      if (['market_manager', 'collector', 'technician'].indexOf(roleId) !== -1) return (A.MARKET_CATALOG && A.MARKET_CATALOG.MANAGEMENT_UNIT) || 'Tổ Quản lý chợ';
      const actor = roleId && roleId !== 'trader' ? (D.ACTORS || []).find(x => x.roleId === roleId) : null;
      if (!actor) return null;
      const meta = A.db && Array.isArray(A.db.actorMetadata) ? A.db.actorMetadata.find(x => x && x.id === actor.id) : null;
      return meta && typeof meta.unit === 'string' && meta.unit.trim() ? meta.unit.trim() : (actor.unit || null);
    },
    // Đơn vị HIỂN THỊ của một account (list/chi tiết/form/menu người dùng): theo vai trò/actor metadata; chỉ
    // vai trò không có actor (trader/legacy/tuỳ biến) mới dùng organization đã lưu trên account.
    organizationOf: account => (account && A.ACCOUNTS.organizationForRole(A.ACCOUNTS.primaryRole(account))) || (account && account.organization) || '',
    canonicalMarketManagerId: () => CANONICAL_MARKET_MANAGER_ID,
    isCanonicalMarketManager: account => !!account && account.id === CANONICAL_MARKET_MANAGER_ID && A.ACCOUNTS.primaryRole(account) === 'market_manager',
    isKnownLegacyManagerSeed: account => isLegacyManagerRecord(account),
    isRetiredDemoAccount: account => !!account && RETIRED_DEMO_ACCOUNT_IDS.has(account.id),
    isCurrentOrganization: account => isCurrentOrganization(account),
    // Current organization list (màn Tài khoản, KPI, thanh demo, ứng viên phân công). Legacy/retired records
    // remain in ACCOUNTS/list/localStorage for compatibility and history lookups.
    currentList: () => ACCOUNTS.filter(isCurrentOrganization),
    // Ứng viên nhận sự cố: NV kỹ thuật hiện hành, đang hoạt động — không lọc theo Chợ.
    currentTechnicians: () => ACCOUNTS.filter(a => A.ACCOUNTS.isActive(a) && A.ACCOUNTS.primaryRole(a) === 'technician'),
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
    // Account của một hồ sơ: xét TOÀN BỘ traderIds (kể cả traderId/linkedTraderId legacy). Hồ sơ thuộc >1 account
    // (dữ liệu cũ xung đột) → null, không chọn ngẫu nhiên; dùng traderLinkState/isTraderLinked để phân biệt.
    byTraderId: traderId => { const xs = accountsOfTrader(traderId); return xs.length === 1 ? xs[0] : null; },
    traderLinkState: traderId => { const xs = accountsOfTrader(traderId); return { traderId, status: xs.length === 0 ? 'NONE' : (xs.length === 1 ? 'LINKED' : 'CONFLICT'), accounts: xs }; },
    isTraderLinked: traderId => accountsOfTrader(traderId).length > 0,
    traderIdsOf: account => traderIdsOf(account),
    // Từng liên kết kèm trạng thái: hồ sơ không còn trong A.db → missing (GIỮ id, không tự xoá).
    traderProfileLinks: account => traderIdsOf(account).map(id => { const t = traderById(id); return { traderId: id, trader: t, missing: !t }; }),
    traderProfilesOf: account => traderIdsOf(account).map(traderById).filter(Boolean),
    // Chợ mà account CÓ hồ sơ — chỉ để hiển thị/chọn chợ. KHÔNG phải quyền xem toàn chợ: quyền bản ghi của
    // Tiểu thương luôn theo traderId của hồ sơ đang dùng.
    traderMarketsOf: account => Array.from(new Set(traderIdsOf(account).map(traderById).filter(Boolean).map(t => t.market).filter(Boolean))),
    traderLinkConflicts: () => {
      const owners = new Map();
      ACCOUNTS.forEach(a => traderIdsOf(a).forEach(id => { if (!owners.has(id)) owners.set(id, []); owners.get(id).push(a.id); }));
      return Array.from(owners.entries()).filter(x => x[1].length > 1).map(x => ({ traderId: x[0], accountIds: x[1] }));
    },
    linkTraderProfile: (accountId, traderId) => linkTraderProfile(accountId, traderId),
    // Hồ sơ mặc định khi mở web Tiểu thương: traderId (nếu là hồ sơ hợp lệ của account) → hồ sơ đầu tiên; null nếu không có.
    defaultTraderProfile: account => { const ps = traderIdsOf(account).map(traderById).filter(Boolean); return ps.find(t => t.id === (account && account.traderId)) || ps[0] || null; },
    otpDemoCode: OTP_DEMO,
    issueOtpChallenge: account => ({ id: 'OTP-' + (++otpSeq), accountId: account.id, phone: A.ACCOUNTS.normalizePhone(account.phone), expiresAt: Date.now() + OTP_TTL_MS }),
    // { ok } | { ok:false, reason: LOCKED | NO_CHALLENGE | EXPIRED | WRONG_CODE }
    verifyOtpChallenge: (challenge, account, phone, code) => {
      if (!account || A.ACCOUNTS.authStatus(account) === 'LOCKED') return { ok: false, reason: 'LOCKED' };
      if (!challenge || challenge.accountId !== account.id || challenge.phone !== A.ACCOUNTS.normalizePhone(phone)) return { ok: false, reason: 'NO_CHALLENGE' };
      if (Date.now() > challenge.expiresAt) return { ok: false, reason: 'EXPIRED' };
      if (String(code || '') !== OTP_DEMO) return { ok: false, reason: 'WRONG_CODE' };
      return { ok: true };
    },
    // Idempotent: chỉ Chờ kích hoạt → Đang hoạt động; không đụng traderIds/traderId/scopes.
    activateAfterOtp: account => {
      if (account && A.ACCOUNTS.authStatus(account) === 'PENDING_ACTIVATION') A.ACCOUNTS.update(account.id, { status: 'ACTIVE', activatedAt: new Date().toISOString() });
    },
    TRADER_WEB_SESSION_KEY,
    TRADER_WEB_URL: 'tieu-thuong/index.html',
    // Mở phiên web Tiểu thương cho account A07 đã xác thực (dùng khi A07 đăng nhập nhầm web quản lý).
    startTraderWebSession: account => {
      const t = A.ACCOUNTS.defaultTraderProfile(account);
      try { sessionStorage.setItem(TRADER_WEB_SESSION_KEY, JSON.stringify({ accountId: account.id, traderId: t ? t.id : null })); } catch (e) { console.warn('[choso] Không lưu được phiên web Tiểu thương', e); }
    },
    codeTaken: (code, excludeId) => {
      const c = (code || '').trim().toLowerCase();
      return ACCOUNTS.some(a => a.id !== excludeId && a.code.trim().toLowerCase() === c);
    },
    add: acc => { normalizeTraderLinks(acc); ACCOUNTS.push(acc); saveAccounts(); },
    update: (id, patch) => { const a = A.ACCOUNTS.get(id); if (a) { Object.assign(a, patch); normalizeTraderLinks(a); } saveAccounts(); },
    setStatus: (id, status) => { const a = A.ACCOUNTS.get(id); if (a) a.status = status; saveAccounts(); },
    resetDefault: () => { ACCOUNTS = defaultAccounts(); saveAccounts(); }
  };
  migrateCurrentOrgDemo();
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
  // D.STAFF trước, rồi account theo code/id (kể cả account ngoài tổ chức hiện hành) để lịch sử vẫn ra tên.
  U.staffName = id => {
    const s = D.STAFF.find(x => x.id === id);
    if (s) return s.name;
    const a = id && ACCOUNTS.find(x => x.code === id || x.id === id);
    return a ? a.fullName : (id || '');
  };
})(window.APP);

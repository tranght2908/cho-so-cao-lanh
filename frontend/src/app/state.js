/* Application namespace and initial runtime state (Phase 15.1 — owner of C01).
 * Single owner of window.APP creation, A.D, the db/idx/current slots, A.RBAC_SCHEMA, the
 * VIEWS/ACT/IN/CH registries, the A.ui defaults and A.$. Loaded right after data.js; every
 * other script attaches to window.APP. */
window.APP = (function () {
  'use strict';
  const D = window.DATA;
  // RBAC V1 — version của schema role/account/ui (permissions.js, accounts.js, choso-caolanh-ui
  // đều đọc hằng số này). Tăng số này khi seed role/account/ui đổi cấu trúc không tương thích
  // ngược, để dữ liệu localStorage cũ tự bị bỏ qua và reseed lại an toàn.
  // v1 → v2 (Phase 2 — Market Scope): ui.market trước đây có thể là 'ALL' hợp lệ; từ Phase 2 nó
  // luôn phải là 'CL'/'TTD' cụ thể. Bump version để mọi state cũ (kể cả market:'ALL' đã lưu từ
  // Phase 1) bị bỏ qua hoàn toàn thay vì cố vá — A.syncAccountContext() ở A.load() sẽ tự chọn lại
  // market hợp lệ theo đúng account đang dùng.
  // v3 → v4 (RBAC_MARKET_SCOPE_MIGRATION): role master 8 → 6 (market_staff/accountant loại bỏ) +
  // market master 2 → 12 chợ (D.MARKETS, data.js). Bump để: (1) js/permissions.js reseed roles/
  // rolePerms SẠCH theo 6 role mới (bỏ qua nhánh merge — không còn account/permission nào giữ
  // market_staff/accountant "dưới tên khác"); (2) js/accounts.js reseed account demo SẠCH theo 12
  // chợ + 6 role (accounts cũ scoped role đã nghỉ hưu không "tự nâng quyền" thành role khác — bị bỏ
  // hẳn, seed lại an toàn từ defaultAccounts()); (3) UI state cũ (currentDemoAccountId trỏ tới 1
  // account không còn tồn tại) tự rơi về fallback an toàn của A.currentAccount()/A.syncAccountContext()
  // — không tự chọn account quyền cao hơn. Không có mapping account cũ nào chắc chắn 1:1 (tên/SĐT độc
  // lập với role thật) nên KHÔNG cố "vá" state cũ — reseed sạch là fallback an toàn nhất (mục 25 yêu
  // cầu: "fallback an toàn; không tự nâng quyền; không tự chuyển account thành Admin"). Xem
  // RBAC_MARKET_SCOPE_MIGRATION_REPORT.md.
  const RBAC_SCHEMA = 4; // 4: role master 6 role + market master 12 chợ
  const A = {
    D, db: null, idx: null, current: null, RBAC_SCHEMA,
    VIEWS: {}, ACT: {}, IN: {}, CH: {},
    ui: {
      // currentDemoAccountId là nguồn xác thực duy nhất cho phiên demo — role hiệu lực (ui.role)
      // luôn được suy ra từ account này (A.syncAccountContext()), không còn set trực tiếp qua UI.
      currentDemoAccountId: null, role: null,
      // MARKET_SELECTOR_ALL_UNIFICATION: market (selectedMarket) là 1 chợ cụ thể HOẶC 'ALL' — 'ALL'
      // chỉ hợp lệ khi account đang dùng có scopeType GLOBAL (system_admin/ward_leader — xem
      // A.ACCOUNTS.scopeType()). A.syncAccountContext() đảm bảo bất biến này ngay sau khi có account
      // (xem A.load()); giá trị khởi tạo dưới đây chỉ là placeholder trước khi có account, không bao
      // giờ được dùng để hiển thị/filter thật. Trước đây có 1 biến ui.xmScope RIÊNG cho bộ lọc nội bộ
      // của các màn CROSS (Tổng quan/Báo cáo) — đã BỎ, hợp nhất về đúng 1 state (ui.market) và đúng 1
      // selector (dropdown "Chợ" trên thanh top, xem chrome()) để tránh 2 điều khiển cho cùng 1 khái
      // niệm "đang xem chợ nào" (yêu cầu "không tạo selector thứ hai").
      market: 'ALL', planMarket: 'CL', floor: { CL: 'T1', TTD: 'KHU' }, hidden: {}, sel: null, planSearch: '',
      page: {}, f: {}, contractTab: 'all', period: '2026-11', report: 'lapday', readingsFilter: 'all', incCat: '',
      dsTab: null, dsBankFilter: 'all', dsBankSearch: '', dsFrom: null, dsTo: null,
      mini: { traderId: null, step: 'login', tab: 'home', pay: null, lastPays: null, attach: false, bill: null }
    }
  };
  const $ = s => document.querySelector(s);
  A.$ = $;
  return A;
})();

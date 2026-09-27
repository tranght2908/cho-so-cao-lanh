# Frontend Architecture Audit — Chợ số Cao Lãnh

> Phạm vi audit: source đang có trong worktree tại thời điểm kiểm tra, chỉ đọc mã. Không thay đổi hành vi, dữ liệu hay cấu trúc runtime. Báo cáo có tính đến các file chưa được Git theo dõi nhưng đang được `index.html` nạp: `js/auth.js`, `js/workflow.js`.

## Tóm tắt điều hành

| Chỉ số | Kết quả |
|---|---:|
| File JavaScript runtime | 18 |
| Tổng dòng JavaScript | 13.530 |
| Dòng `data.js` | 1.006 |
| Dòng CSS | 1.047 |
| Route/screen thực tế | 21 (19 mục menu hiển thị thường xuyên, 1 hidden/legacy, 1 mini app) |
| Key localStorage | 11 |
| Key sessionStorage | 1 |
| Collection mock trong `DATA.build()` | 33 |
| Không gian tên chính | `window.DATA`, `window.APP` / `A` |
| Network/API runtime | Không phát hiện `fetch`, `XMLHttpRequest`, axios hoặc WebSocket |

Năm vấn đề kiến trúc lớn nhất:

1. **Global mutable state:** hầu như mọi view đọc/ghi trực tiếp `A.db`, `A.ui`, `A.idx`, rồi tự gọi `A.save()`/`A.render()`.
2. **God files:** `v-tieuthuong.js` (3.059 dòng), `v-dieuhanh.js` (2.070), `v-vanhanh.js` (1.711), `v-taichinh.js` (1.451), `mini.js` (1.333) gộp view, HTML template, business rule, handler, mutation và popup.
3. **Load-order override:** cùng `A.VIEWS[...]` bị gán lại nhiều lần; view cuối cùng phụ thuộc vào thứ tự `<script>` trong `index.html`.
4. **Persistence phân tán:** state nghiệp vụ trong một key `A.db`, nhưng layout, account, quyền, danh mục chợ, biểu phí, ngân hàng lại ở các key riêng; không có repository/service layer thống nhất.
5. **Backend boundary chưa có:** view/handler làm join dữ liệu, sinh ID, validation, transition trạng thái và mutation trực tiếp; đây là phần sẽ khó thay sang API Spring Boot nhất.

## 1. Cây thư mục hiện tại

```text
cho_so_cao_lanh/
├── index.html                         # application shell, script order
├── data.js                            # constants + deterministic mock database builder
├── styles.css                         # toàn bộ CSS global và screen-specific
├── README.md                          # mô tả prototype, không tham gia runtime
├── AGENTS.md                          # hướng dẫn dự án, không tham gia runtime
├── BAO_CAO_TAI_KHOAN_MOCK.md          # báo cáo xuất trước đó, không runtime
├── XUAT_DU_LIEU_MOCK_MAC_DINH.json    # export mock, không runtime
└── js/
    ├── core.js                        # bootstrap, state, router, UI helpers, chrome
    ├── permissions.js                 # role/permission seed, migration, authorization
    ├── accounts.js                    # account seed + account persistence/helpers
    ├── auth.js                        # login SĐT/OTP mock + session/header
    ├── workflow.js                    # workflow hồ sơ→hợp đồng→điểm→account
    ├── marketcatalog.js               # market catalog persistence/service
    ├── bankaccounts.js                # bank account persistence/service
    ├── serviceconfig.js               # rate/service configuration persistence/service
    ├── v-dieuhanh.js                  # dashboard + phiên chợ quê
    ├── v-danhmuccho.js                # market catalog screen
    ├── v-cautruc.js                   # layout structure/workspace
    ├── v-tieuthuong.js                # traders, points, contracts, point requests
    ├── vehicles.js                    # transport/vehicle helpers used by business-point UI
    ├── v-taichinh.js                  # utility, receivable, collection, reconciliation, debt
    ├── v-vanhanh.js                   # incident, notification, report, account, setting, rate UI
    ├── v-taisan.js                    # market assets
    ├── v-baocao-mau.js                # report-form/CSV helpers
    └── mini.js                        # merchant mini app
```

### File source chính

| File | Dòng | Trách nhiệm thực tế | Màn hình/module chính |
|---|---:|---|---|
| `index.html` | 73 | Shell DOM, topbar/sidebar/modal/toast roots, load order | toàn app |
| `data.js` | 1.006 | constants, 12 market master, reference data, seeded database builder | mọi module mock |
| `styles.css` | 1.047 | global design tokens/layout và CSS cho nhiều modal/screen | toàn app |
| `js/core.js` | 896 | app namespace, `A.db`, index, router, menu, chrome, shared UI/receipt helpers | toàn app |
| `js/permissions.js` | 690 | permission catalog, role seed, migration, `A.PERM`, `A.canDo` | RBAC/cài đặt |
| `js/accounts.js` | 265 | account seed, local persistence, role/scope helpers | account/auth/RBAC |
| `js/v-dieuhanh.js` | 2.070 | dashboard liên chợ và full lifecycle phiên chợ quê | tổng quan, phiên chợ |
| `js/v-tieuthuong.js` | 3.059 | merchant profile, points, split/merge/convert, contract | tiểu thương, mặt bằng CL, hợp đồng |
| `js/v-cautruc.js` | 766 | authoritative structure layout model, tree/workspace/drawer | mặt bằng |
| `js/v-taichinh.js` | 1.451 | meter, receivable, payment, reconciliation, debt | tài chính |
| `js/v-vanhanh.js` | 1.711 | incident, notification, report, account admin, settings, pricing/bank screens | vận hành + admin + configuration |
| `js/mini.js` | 1.333 | merchant self-service app and legacy mini login flow | mini app |
| `js/workflow.js` | 176 | cross-feature workflow overlays and actions | traders/contracts/accounts |
| Các file còn lại | 93–188 | catalog/service/asset/report helpers | các feature hẹp |

## 2. Bản đồ toàn bộ màn hình

`A.route()` lấy hash `#/id`, kiểm quyền qua `U.can(id)`, áp dụng market applicability (`A.SCREEN_MARKET`), rồi gọi `A.VIEWS[id]`. `#/so-do` và `#/cau-truc` được redirect sang `#/mat-bang`; `#/diem-kd` ở Chợ Cao Lãnh cũng được chuyển vào workspace mặt bằng ở mode bảng.

| Route/screen | Tên màn hình | File định nghĩa/render cuối | Render chính | Phụ trợ đáng chú ý |
|---|---|---|---|---|
| `#/tong-quan` | Tổng quan liên chợ | `v-dieuhanh.js` | `A.VIEWS['tong-quan']` | KPI, chart, filter market, drill-down |
| `#/danh-muc-cho` | Danh mục chợ | `v-danhmuccho.js` | `A.VIEWS['danh-muc-cho']` | `A.MARKETS_CATALOG`, CRUD modal |
| `#/mat-bang` | Mặt bằng chợ / mặt bằng & điểm KD CL | `v-tieuthuong.js` override `v-cautruc.js` | `clLayoutView()` hoặc `A.mbWorkspaceHtml()` | `v-cautruc` tree/layout; drawer điểm; `vehicles.js` |
| `#/diem-kd` | Điểm kinh doanh (hidden/legacy route) | `v-tieuthuong.js` | `dkViewGeneric()` hoặc `clLayoutView()` | tại CL route redirect vào `mat-bang` bảng |
| `#/tai-san` | Tài sản chợ | `v-taisan.js` | `A.VIEWS['tai-san']` | CRUD asset, `A.db.marketAssets` |
| `#/phien-cho` | Phiên chợ quê | `v-dieuhanh.js` | `A.VIEWS['phien-cho']` | session lifecycle, registration, attendance, payment, close |
| `#/tieu-thuong` | Hồ sơ tiểu thương | `v-tieuthuong.js` | `ttViewCL()` / `ttViewGeneric()` | table, detail drawer, edit mode, document mock file metadata |
| `#/hop-dong` | Hợp đồng | `workflow.js` wrapper trên `v-tieuthuong.js` | wrapped `A.VIEWS['hop-dong']` | task “Cần xử lý”, create/renew/terminate/liquidate/detail |
| `#/cau-hinh-gia` | Chính sách thu và biểu phí | `v-vanhanh.js` | `A.VIEWS['cau-hinh-gia']` | `A.SERVICE_CFG` |
| `#/tai-khoan-ngan-hang` | Danh sách tài khoản ngân hàng | `v-vanhanh.js` | `A.VIEWS['tai-khoan-ngan-hang']` | `A.BANK_ACCOUNTS` |
| `#/dien-nuoc` | Chỉ số điện, nước | `v-taichinh.js` (gán 3 lần, bản cuối hiệu lực) | `A.VIEWS['dien-nuoc']` | readings, period, adjustment request |
| `#/phai-thu` | Khoản phải thu | `v-taichinh.js` | `A.VIEWS['phai-thu']` | billing period, issue/adjust/waive |
| `#/thu-tien` | Thu tiền & biên lai | `v-taichinh.js` (gán 2 lần) | `A.VIEWS['thu-tien']` | collection form, receipt |
| `#/doi-soat` | Đối soát | `v-taichinh.js` | `A.VIEWS['doi-soat']` | bank rows, cash deposit/confirm |
| `#/cong-no` | Công nợ & nhắc nợ | `v-taichinh.js` | `A.VIEWS['cong-no']` | overdue, reminders |
| `#/su-co` | Phản ánh & sự cố | `v-vanhanh.js` (gán 2 lần) | `A.VIEWS['su-co']` | assignment, state transition, evidence |
| `#/thong-bao` | Thông báo đa kênh | `v-vanhanh.js` | `A.VIEWS['thong-bao']` | mock send/read |
| `#/bao-cao` | Báo cáo thống kê | `v-vanhanh.js` + `v-baocao-mau.js` | `A.VIEWS['bao-cao']` | `A.stateFormHtml`, CSV |
| `#/tai-khoan` | Tài khoản người dùng | `workflow.js` wrapper trên `v-vanhanh.js` | wrapped `A.VIEWS['tai-khoan']` | account CRUD/lock/role + pending-account tasks |
| `#/cai-dat` | Cài đặt & phân quyền | `v-vanhanh.js` | `A.VIEWS['cai-dat']` | `A.PERM` role/permission editor, reset |
| `#/mini-app` | Mini app tiểu thương | `mini.js` | `A.VIEWS['mini-app']` | self profile, bills, contract, payment, incident, point requests |

Popup/modal/drawer không có router riêng. Hầu hết được render bằng `A.modal(...)`, `A.drawer(...)` hoặc ghi thẳng vào `#modal-root`; handler được dispatch qua `data-act` và registry toàn cục `A.ACT`.

## 3. Mổ xẻ file lớn

Số “function token” là số lần xuất hiện keyword `function` (bao gồm inner function); không phải metric cyclomatic complexity. Số action là số đăng ký `A.ACT[...]` trong file.

| File | Dòng / function token / action | Nhóm chức năng và dependency | Đánh giá trách nhiệm |
|---|---:|---|---|
| `core.js` | 896 / 41 / 1 | utilities (`A.U`), format/chart/CSV/QR, index/reindex, load/save DB, market scope, menu/router/render, receipt, event delegation | **Trộn app shell, persistence, UI primitives, business receipt và demo switcher.** Hầu hết module phụ thuộc vào nó. |
| `data.js` | 1.006 / 9 / 0 | market/reference constants, PRNG deterministic, seed stalls/traders/contracts/invoices/payments/session/etc. | Một source mock rõ ràng nhưng cũng mang business seed lớn; không phải view. |
| `v-dieuhanh.js` | 2.070 / 156 / 0 | dashboard + toàn bộ session market domain: state machine, registrations, attendance, replacement, payment, reconciliation/closing and UI | **God file.** Hai bounded context khác nhau (dashboard và session operations) chung file. |
| `v-tieuthuong.js` | 3.059 / 174 / 135 | business points, CL floor layout, trader profile/detail/edit/create, document mock files, split/merge/convert workflow, contract lifecycle | **God file cao nhất.** Ít nhất 4 feature riêng; 135 handlers làm navigation khó. |
| `v-cautruc.js` | 766 / 51 / 0 | independent layout tree model, local layout persistence, block/floor/zone CRUD, workspace/drawer | Layout-specific nhưng coupling vì expose `A.mbWorkspaceHtml`, `A.mbBusinessPointsForMarket`, `A.openDkDrawer`. |
| `v-taichinh.js` | 1.451 / 90 / 50 | meter reading, billing periods, receivables, payment/receipt, reconciliation, cash, debt | **God file vừa.** Nhiều subdomain tài chính và duplicate view assignment. |
| `v-vanhanh.js` | 1.711 / 97 / 73 | incidents, notifications, reports, account administration, settings/RBAC UI, fee policy, bank account UI | **God file.** “Vận hành” đang chứa cả system administration/configuration. |
| `mini.js` | 1.333 / 81 / 0 | merchant mini UI, payment, contract/notice/incident, point requests, registration; còn mini phone/OTP legacy | Rất nhiều cross-feature joins trực tiếp qua `A.db` và `A.pointReq`. |
| `permissions.js` | 690 / 15 / 1 | catalog, default roles/matrix, migration, permission persistence, helper can/canAction | Hợp lý là central RBAC; migration history khiến file dài. |
| `accounts.js` | 265 / 9 / 0 | seed accounts, local load/merge, account CRUD/accessors/scope | Đúng domain account; có coupling `A.D.STAFF` và `A.db` để demo trader link. |
| `workflow.js` | 176 / 11 / 14 | derived task, popup and mutations trader→contract→stall→account; monkey-patch view/action existing | Boundary đúng ý tưởng nhưng implementation **override handler/view của module khác**, nên có load-order coupling. |
| `vehicles.js` | 188 / 16 / 10 | helper/filter/modal around seller/vehicle/business point | Tên file không phản ánh hết context; phụ thuộc `A.db.stalls/traders`. |
| `styles.css` | 1.047 | global + all screen CSS, modal/drawer/detail/contract/request hotfixes | Single stylesheet; CSS của feature không co-locate với view. |

### Function/view dài hoặc khó kiểm thử

Các handler được minify một dòng nên “số dòng” không phản ánh kích thước logic. Các điểm cần ưu tiên tách theo nội dung thực tế:

- `v-tieuthuong.js:3052` `A.ACT['ct-liquidate']`: modal thanh lý rất dài; render + business condition + UI helper closure chung một handler.
- `v-tieuthuong.js:1352` `A.ACT['dkmerge-execute']`: validation, mutation stall, state transition, reindex/persist/render trong một expression dài.
- `v-tieuthuong.js:3048` `A.ACT['ct-terminate']`: full form, document mock and state flow in one handler.
- `v-dieuhanh.js`: session domain trải từ line 61 tới route render 1.605; riêng registration/attendance/replacement có nhiều helper stateful.
- `v-taichinh.js`: view and handlers bao phủ nhiều workflow tài chính; `dien-nuoc` được định nghĩa ở 101, 267, 312; `thu-tien` ở 728, 790.
- `v-vanhanh.js`: `su-co` được định nghĩa ở 17 và 289; module account/settings/pricing/bank lives alongside incidents.

### Duplicate/gần duplicate và override

**Phát hiện vấn đề:**

- `A.VIEWS['mat-bang']`: `v-cautruc.js:765` gán workspace, sau đó `v-tieuthuong.js:1993` ghi đè. Bản sau gọi lại `A.mbWorkspaceHtml()` cho market khác CL, nên hiện hoạt động nhờ thứ tự load.
- `A.VIEWS['hop-dong']`: `v-tieuthuong.js` gán ở 2.814, 2.998, 3.013; `workflow.js:89` tiếp tục bọc view hiện tại. Đây là decorator bằng override, không có composition contract rõ ràng.
- `A.VIEWS['dien-nuoc']` gán 3 lần và `A.VIEWS['thu-tien']` gán 2 lần trong `v-taichinh.js`; `A.VIEWS['su-co']` gán 2 lần trong `v-vanhanh.js`.
- `workflow.js` thay `A.ACT['tt-new']`, `A.ACT['ct-new']` theo load order. Đây là code coupling ngầm.
- HTML strings lớn, `data-act` and `A.ACT` rải trong các file; chưa thấy component renderer tái sử dụng ổn định ngoài utility `U.table`, `A.modal`, `A.drawer`.

## 4. Cấu trúc thực tế theo module nghiệp vụ

| Module | Code hiện tại phải tìm | Nơi bắt đầu / ghi chú |
|---|---|---|
| Điều hành | `v-dieuhanh.js`, `core.js`, `v-baocao-mau.js` | dashboard `tong-quan`; session chợ quê cùng file |
| Danh mục chợ | `v-danhmuccho.js`, `marketcatalog.js`, `data.js`, `permissions.js` | screen cross-market; catalog có persistence riêng |
| Mặt bằng chợ | `v-cautruc.js`, `v-tieuthuong.js`, `vehicles.js`, `core.js` | layout model riêng + CL-specific point screen override |
| Hồ sơ tiểu thương | `v-tieuthuong.js`, `workflow.js`, `data.js`, `mini.js` | list/detail/edit/doc files; workflow new profile overrides `tt-new` |
| Hợp đồng | `v-tieuthuong.js`, `workflow.js`, `serviceconfig.js`, `core.js` | contract list/detail/lifecycle; workflow decorates view/create |
| Tài chính/khoản thu | `v-taichinh.js`, `serviceconfig.js`, `data.js`, `core.js` | meter, billing, receivable |
| Công nợ | `v-taichinh.js`, `mini.js`, `data.js` | invoice/payment-derived debt + reminder |
| Thu phí/biên lai | `v-taichinh.js`, `core.js`, `mini.js` | payment write + `A.receiptHtml`/print |
| Vận hành | `v-vanhanh.js`, `mini.js`, `data.js` | incident/notification; direct staff/account joins |
| Tài sản | `v-taisan.js`, `data.js` | `marketAssets` only |
| Báo cáo | `v-vanhanh.js`, `v-baocao-mau.js`, `v-dieuhanh.js`, `core.js` | dashboard and report are separate code paths |
| Tài khoản người dùng | `v-vanhanh.js`, `accounts.js`, `workflow.js`, `auth.js` | admin UI; account source `A.ACCOUNTS` |
| Phân quyền | `permissions.js`, `v-vanhanh.js`, `core.js` | central policy + settings editor |
| Đăng nhập/xác thực | `auth.js`, `accounts.js`, `core.js`, `mini.js` | global phone OTP mock is newer; mini has older login UI too |
| Cấu hình dịch vụ | `serviceconfig.js`, `v-vanhanh.js`, `data.js`, `core.js` | policy is stored separately; not fully input to all billing logic |
| Phương tiện | `vehicles.js`, `v-tieuthuong.js`, `data.js` | business-point-associated helpers, no own route |
| Workflow | `workflow.js`, then `v-tieuthuong.js`, `v-vanhanh.js`, `auth.js` | cross-feature orchestration by direct mutation |

## 5. Data flow hiện tại

```text
data.js
  ├─ window.DATA constants/reference seed
  └─ DATA.build()
       ↓ (first load / schema mismatch)
core.js: A.load()
  ├─ A.db  ← `choso-caolanh-state` (if valid) OR DATA.build()
  ├─ A.reindex() → A.idx Map indexes
  └─ A.ui ← `choso-caolanh-ui`
       ↓
all views/handlers read/write A.db and A.ui directly
       ↓
A.save() → localStorage `choso-caolanh-state`
       ↓
A.render() → A.VIEWS[current]() → HTML strings into #view
       ↓
delegated click/change handlers in core dispatch data-act/data-ch
       ↓
A.ACT / A.CH registered from feature scripts
```

Song song với `A.db` có các store localStorage riêng:

```text
permissions.js   → A.PERM          → choso-caolanh-permissions
accounts.js      → A.ACCOUNTS      → choso-caolanh-accounts (+ schema key)
auth.js          → session account → choso-caolanh-ui
serviceconfig.js → A.SERVICE_CFG   → choso-caolanh-serviceconfig
marketcatalog.js → A.MARKETS_CATALOG → choso-caolanh-marketcatalog
bankaccounts.js  → A.BANK_ACCOUNTS → choso-caolanh-bankaccounts
v-cautruc.js     → LAYOUT          → choso-caolanh-layout
```

Không có service/repository abstraction giữa UI và state. `A.db` là in-memory mutable object; quan hệ được join bằng `A.idx` hoặc `Array.find/filter` ngay trong renderer/handler. Không phát hiện backend request/network client.

## 6. Inventory mock data

| Nhóm | Nguồn | Dữ liệu | Người dùng chính | Sau backend |
|---|---|---|---|---|
| Mock nghiệp vụ chính | `data.js: build()` | `stalls`, `traders`, `contracts`, `invoices`, `payments`, `readings`, `incidents`, `marketAssets`, `notifications` | tất cả view | thay bằng API/read model |
| Session/chợ quê | `data.js: build()` | `sessions`, `marketSessions`, registrations, payments, receipts, attendance, replacement, notifications | `v-dieuhanh`, `mini`, finance/core | thay bằng session APIs |
| Tài chính lifecycle | `data.js: build()` | `months`, `issuedPeriods`, `meterPeriods`, adjustment requests, `cashDeposits`, `cashConfirms`, `billingPeriods`, `bank`, `audit` | `v-taichinh`, dashboard | backend ledger/transaction APIs |
| Điểm KD workflow | `data.js: build()` | `pointRequests`, `directSellerAssignments`, `miniLinkRequests` (empty compatibility array) | `v-tieuthuong`, `mini` | backend workflow/resources |
| Reference/seed | `data.js` | 12 `MARKETS`, `STATUS`, `POINT_TYPE`, `METHOD`, incident states, staff, roles, constants, bank master | core/feature screens | backend catalog/config or frontend static enums |
| Biểu phí seed | `data.js: RATE_POLICY_SEED` | stall price, utilities, extra services, legal basis, mock attachments | `serviceconfig`, `v-vanhanh`, core | backend pricing/config |
| Bank account seed | `data.js: BANK_ACCOUNT_SEED`, `BANKS` | bank account list and bank master | `bankaccounts`, finance UI | backend banking config |
| Demo accounts | `accounts.js: BASE_ACCOUNTS`, runtime merged accounts | roles, scopes, linked trader and account status | auth, core header, account UI | backend identity/account service |
| RBAC seed | `permissions.js: CATALOG/defaultRoles/defaultRolePermissions` | permissions and default role-permission matrix | core/permissions/account UI | backend RBAC; frontend receives effective permissions |
| Runtime-generated mock | `data.js` deterministic PRNG, `mockPhoto`, seed session/debt/point requests; features create file metadata and records | generated stable demo records; browser-file metadata only | multiple | remove seed; retain DTO mapping only |

Default DB currently contains 33 top-level collections. The prior default export counted 275 traders, 332 business points, 262 contracts, 1.283 receivables, 1.140 payments and 14 incidents. Those counts describe source seed, not a user’s changed localStorage.

## 7. localStorage / sessionStorage inventory

| Key | File đọc | File ghi | Nội dung | Module |
|---|---|---|---|---|
| `choso-caolanh-state` | `core.js` | `core.js` | toàn bộ `A.db` seed đã thay đổi | nghiệp vụ chung |
| `choso-caolanh-ui` | `core.js`, `auth.js` | `core.js`, `auth.js` | selected market, current demo account, auth session account | shell/auth |
| `choso-caolanh-guide` | `core.js` | `core.js` | marker đã xem hướng dẫn | shell |
| `choso-caolanh-permissions` | `permissions.js` | `permissions.js` | roles + role permissions + versions | RBAC |
| `choso-caolanh-accounts` | `accounts.js` | `accounts.js` | account list | account/auth |
| `choso-caolanh-accounts-schema` | `accounts.js` | `accounts.js` | account schema compatibility marker | account |
| `choso-caolanh-bankaccounts` | `bankaccounts.js` | `bankaccounts.js` | bank account catalog | configuration |
| `choso-caolanh-marketcatalog` | `marketcatalog.js` | `marketcatalog.js` | market catalog overrides | market catalog |
| `choso-caolanh-serviceconfig` | `serviceconfig.js` | `serviceconfig.js` | rate/service policy overrides | pricing |
| `choso-caolanh-layout` | `v-cautruc.js` | `v-cautruc.js` | separate layout block/floor/zone tree | market layout |
| `prototype-demo-mode` | `auth.js` | không thấy writer runtime | flag show demo-account UI | demo tooling |
| `choso-caolanh-workflow-recent-point` *(sessionStorage)* | `workflow.js` | `workflow.js` | recently assigned stall marker | workflow UX |

**Phát hiện vấn đề:** `A.db.stalls` và `choso-caolanh-layout` cùng mô tả cấu trúc/mặt bằng ở hai representation khác nhau. `v-cautruc.js` có adapter từ stalls sang layout và comment xác nhận layout là authoritative for workspace, nhưng màn CL vẫn có renderer riêng trong `v-tieuthuong.js`; cần làm rõ target aggregate trước migration.

## 8. Coupling map

```text
core
├── DATA, ACCOUNTS, PERM
├── owns A.db/A.idx/A.ui/router/render/ACT dispatcher
└── used by every feature

traders + contracts + business points (v-tieuthuong)
├── A.db.stalls/traders/contracts/invoices/notifications
├── A.SERVICE_CFG and U.appliedStallPrice
├── A.openDkDrawer/A.mbWorkspaceHtml from v-cautruc
├── A.currentAccount/A.canDo/A.allowedMarkets
└── overwritten by workflow

workflow
├── directly mutates traders/contracts/stalls/accounts
├── wraps A.VIEWS['hop-dong'] and A.VIEWS['tai-khoan']
└── overrides A.ACT['tt-new'] and A.ACT['ct-new']

finance (v-taichinh)
├── reads/writes invoices/payments/readings/bank/cash/billing in A.db
├── uses core receipt/utility helpers
└── mini app reads same invoices/payments directly

operations (v-vanhanh)
├── incidents/notifications from A.db
├── account administration via A.ACCOUNTS
├── RBAC via A.PERM
├── pricing via A.SERVICE_CFG
└── bank configuration via A.BANK_ACCOUNTS

mini
├── direct ownership filter on A.db.traders/stalls/contracts/invoices/incidents
├── direct point-request calls via A.pointReq in v-tieuthuong
├── session data from v-dieuhanh/data collections
└── auth current account from auth/accounts/core
```

### Coupling classifications

- **Global state coupling:** all feature modules depend on `window.APP` and mutable `A.db`; no import boundary.
- **Load-order coupling:** `index.html` script order is an implicit dependency graph. `workflow.js` must load after `v-tieuthuong`/`v-vanhanh`; `auth.js` wraps `A.route` and must load after core.
- **Cross-feature write coupling:** contract create/terminate/liquidate mutates stall and trader; finance mutates invoices/payments and core receipt; point workflows mutate stalls and contracts; account workflow creates account from trader/contract/stall.
- **Potential circular conceptual dependency:** layout is supplied by `v-cautruc`, then `v-tieuthuong` wraps its view; mini uses point request API from `v-tieuthuong`; both depend on core. There is no ES-module import cycle because there are no modules, but runtime dependency is cyclic conceptually.
- **Shared function in wrong module:** session workflow is in dashboard file; account/settings/pricing/bank are in operations file; point workflow is in trader file; merchant mini login duplicates the newer global auth concern.

## 9. CSS audit

- `styles.css`: **1.047 lines**, one global stylesheet; approximately **833 selector blocks** by line-based count.
- Global layers: tokens/reset, layout/sidebar/topbar, cards/tables/buttons/forms/tags/modal/drawer/toast/print.
- Feature layers mixed in the same file: auth (around 610), merchant detail/edit, point request, contract termination/liquidation, bank/report styles, responsive/print blocks.
- Inline style attributes found in JS/HTML: **549** occurrences. Most are HTML template styles; they make visual changes hard to search and cannot be reused or themed consistently.
- `!important`: 12 property occurrences, mainly print and late “hotfix” style regions (lines 803–947). These are signals of cascade/specificity pressure, not necessarily functional bugs.
- Several comment-labelled “HOTFIX” blocks and very specific selectors (`.drawer...`, `.detail-form...`, `.request-detail...`) indicate historical patch layering.

Recommendation only: retain a small global foundation, then move feature CSS next to feature view files during refactor. Do not mechanically split every selector first; extract by screen after renderer extraction to avoid breaking the cascade.

## 10. Backend readiness map

| Module | UI currently reads/writes | Future frontend service/API boundary |
|---|---|---|
| Auth/session | `A.ACCOUNTS`, `A.ui`, localStorage | `AuthService`: OTP request/verify, session/token, current user |
| Accounts/RBAC | `A.ACCOUNTS`, `A.PERM`, localStorage | `AccountService`, `RoleService`, `PermissionService` |
| Market catalog | `A.MARKETS_CATALOG` and `DATA.MARKETS` | `MarketService` |
| Layout/business point | `A.db.stalls`, local layout tree | `MarketLayoutService`, `BusinessPointService` |
| Traders | `A.db.traders`, document metadata | `TraderService`, `DocumentService` |
| Contracts | `A.db.contracts`, direct stall/trader writes | `ContractService`; backend transaction updates occupancy |
| Pricing/config | `A.SERVICE_CFG`, `DATA.RATE_POLICY_SEED` | `PricingPolicyService`, `ServiceConfigService` |
| Meter/billing | `A.db.readings`, `meterPeriods`, `billingPeriods`, `invoices` | `MeterService`, `BillingPeriodService`, `ReceivableService` |
| Collection/receipt | `A.db.payments`, `cashDeposits`, `cashConfirms` | `PaymentService`, `ReceiptService`, `CashHandoverService` |
| Reconciliation/bank | `A.db.bank`, `A.BANK_ACCOUNTS` | `BankAccountService`, `ReconciliationService` |
| Debt | derived from invoices/payments | `DebtService` or receivable query endpoint |
| Incident/notification | `A.db.incidents`, `notifications` | `IncidentService`, `NotificationService`, `AttachmentService` |
| Session market | session/registration/attendance/payment collections | `MarketSessionService`, registration/attendance/settlement APIs |
| Asset | `A.db.marketAssets` | `AssetService` |
| Reports | arrays filtered in view | query/report endpoints optimized by scope/period |

Important boundary: future UI should call feature service/repository methods, never mutate returned DTO arrays to synchronize related aggregates. For example contract activation should be one backend command that atomically creates/activates contract and updates business-point occupancy.

## 11. God-file risk ranking

| Rank | File | Lines | Evidence of mixed responsibility | Risk |
|---:|---|---:|---|---|
| 1 | `v-tieuthuong.js` | 3.059 | traders + documents + point table/layout CL + split/merge/convert + contracts | highest regression and test risk |
| 2 | `v-dieuhanh.js` | 2.070 | dashboard + entire session market domain | difficult navigation/ownership |
| 3 | `v-vanhanh.js` | 1.711 | operations + report + accounts + settings/RBAC UI + pricing/bank UI | unrelated admin domains coupled |
| 4 | `v-taichinh.js` | 1.451 | meter + receivable + payment + reconcile + debt | financial side-effect risk |
| 5 | `mini.js` | 1.333 | many self-service features and legacy login | ownership/security scope risk |
| 6 | `data.js` | 1.006 | broad seed/reference factory | acceptable mock source, but must be isolated before backend |
| 7 | `core.js` | 896 | shell + persistence + rendering + utility + receipt | high blast radius |

## 12–14. Cấu trúc đề xuất và migration map (đề xuất, chưa thực hiện)

Giữ JavaScript thuần trong giai đoạn đầu nếu không có yêu cầu framework. Chỉ chuyển từ global script sang ES modules khi test baseline đã ổn. Cấu trúc feature-based phù hợp hơn cấu trúc `v-*` hiện tại:

```text
src/
├── app/
│   ├── bootstrap.js              # initialize dependency container
│   ├── router.js                 # hash router, route guards
│   ├── shell.js                  # sidebar/topbar/modal/toast
│   └── session.js                # client session only
├── shared/
│   ├── ui/                       # table, modal, drawer, pagination, chart, receipt print
│   ├── utils/                    # date, money, escape, CSV, identifiers
│   ├── authz/                    # permission/scope evaluator
│   └── storage/                  # temporary prototype repositories/migrations
├── features/
│   ├── dashboard/{index,overview,components}/
│   ├── markets/{index,catalog,service}/
│   ├── market-layout/{index,structure,workspace,business-points}/
│   ├── traders/{index,list,detail,form,documents,service}/
│   ├── contracts/{index,list,detail,form,lifecycle,service}/
│   ├── finance/{meter,receivables,collection,reconciliation,debt,service}/
│   ├── market-sessions/{index,lifecycle,registrations,attendance,settlement}/
│   ├── operations/{incidents,notifications}/
│   ├── assets/{index,service}/
│   ├── reports/{index,forms,export}/
│   ├── accounts/{index,account-list,roles,permissions}/
│   ├── pricing/{index,rate-policy,bank-accounts}/
│   ├── mini-app/{index,home,bills,contracts,requests,incidents}/
│   └── auth/{index,phone-otp,header}/
├── api/                          # later HTTP clients and DTO adapters
└── mocks/
    ├── seed-data.js
    └── repositories/             # temporary in-memory/localStorage adapters
```

Do not create empty folders merely to mirror this tree. A feature earns `service.js`/`state.js` only when it has its own query/mutation boundary.

### Current file → destination

| Current file | Nội dung | Đề xuất destination |
|---|---|---|
| `index.html` | DOM roots/script load | `app/shell.html` or minimal entry HTML; `app/bootstrap.js` |
| `core.js` | state/router/chrome/utilities/receipt | split `app/router`, `app/shell`, `shared/ui`, `shared/utils`, `mocks/repositories` |
| `data.js` | all mock/reference seed | `mocks/seed-data.js`, `shared/constants` for true frontend enums |
| `permissions.js` | permission catalog + evaluator + seed migration | `shared/authz` plus `mocks/repositories/permissions` |
| `accounts.js` | account repository/accessors | `features/accounts/service`, `mocks/repositories/accounts` |
| `auth.js` | OTP UI/session/header | `features/auth/*` |
| `workflow.js` | profile-contract-account orchestration | split commands into `traders`, `contracts`, `accounts`; optional `features/onboarding` orchestrator |
| `v-dieuhanh.js` | overview + session market | `dashboard/*` and `market-sessions/*` |
| `v-danhmuccho.js` + `marketcatalog.js` | catalog UI/repository | `features/markets/*` |
| `v-cautruc.js` | structure/workspace | `features/market-layout/structure`, `workspace` |
| `v-tieuthuong.js` | points/traders/contracts/point workflow | `market-layout/business-points`, `traders/*`, `contracts/*`, `market-layout/point-requests` |
| `vehicles.js` | point-associated seller/vehicle logic | `features/market-layout/business-points/vehicles` or standalone feature only if route emerges |
| `v-taichinh.js` | meter through debt | `features/finance/{meter,receivables,collection,reconciliation,debt}` |
| `v-vanhanh.js` | incidents/notice/report/accounts/settings/pricing/bank | `operations/*`, `reports/*`, `accounts/*`, `pricing/*` |
| `v-taisan.js` | assets | `features/assets/*` |
| `v-baocao-mau.js` | forms/CSV helpers | `features/reports/forms`, `shared/utils/csv` |
| `mini.js` | merchant app | `features/mini-app/*`; remove duplicate login after auth consolidation |
| `serviceconfig.js` | pricing local repository | `features/pricing/service` / mock repository |
| `bankaccounts.js` | bank account local repository | `features/pricing/bank-accounts-service` |
| `styles.css` | all layers | `shared/ui/*.css` + per-feature CSS co-located |

## 15. Kế hoạch refactor an toàn

| Phase | Tác động | Mục tiêu | Rủi ro | Regression test |
|---|---|---|---|---|
| 0. Baseline | none | capture route/RBAC/localStorage snapshots and manual happy paths | none | all 21 routes, 6 roles, reset/reload |
| 1. Characterization | add tests only when test harness is agreed | lock router, permission, data invariants, receipt/debt/session transitions | test setup scope | current UI unchanged |
| 2. Shared extraction | `core.js` helpers one group at a time | move pure date/money/escape/CSV/table/modal helpers without semantic change | high blast radius | compare markup/actions for neighboring screens |
| 3. Repository façade | `A.db` access behind feature repository functions, still localStorage | introduce replaceable read/write contract | accidental persistence divergence | reload and existing localStorage migration |
| 4. Router/shell | isolate route registry and shell | eliminate view override dependence incrementally | navigation/RBAC | direct hash, denied route, market scope tests |
| 5. Split largest features | `v-tieuthuong`, then `v-dieuhanh`, `v-taichinh`, `v-vanhanh` | one bounded context per PR | handler registration collision | happy path per extracted screen |
| 6. CSS co-location | after each renderer moves | reduce inline styles and hotfix cascade slowly | visual regressions | desktop/mobile/print screenshots |
| 7. Auth consolidation | `auth.js` + duplicate mini login | one client session flow while retaining RBAC | lockout/merchant ownership | OTP mock, refresh, logout, each role |
| 8. API adapters | add `api/*` behind repositories | switch one feature at a time to Spring Boot | DTO/transaction mismatch | contract tests and feature fallback |
| 9. Remove mock adapters | only after backend parity | delete seed/localStorage progressively | data migration/loss | production-like regression suite |

No phase should combine structural moves with business-rule changes. Keep route ids, permission keys, DOM `data-act` names and localStorage migration compatible until their replacement is verified.

## 16. Kết luận

1. **Kiến trúc thực chất:** vanilla JS single-page prototype, global namespace and script-load-order composition, hash router, mutable in-memory DB persisted to localStorage.
2. **Khó maintain nhất:** `v-tieuthuong.js` because it combines four independent domains and a large action registry; then `v-dieuhanh.js` because dashboard and session market are unrelated bounded contexts.
3. **Nên tách đầu tiên:** extract the trader/contract/business-point boundaries from `v-tieuthuong.js`, but first create repository/query helpers so extracted code does not keep direct arbitrary `A.db` mutations.
4. **Có nên refactor trước Spring Boot?** Có, nhưng theo lát mỏng. First establish repository/service interfaces and feature boundaries; do not delay backend indefinitely for a big-bang rewrite.
5. **Nên ở frontend:** rendering, local UI state, form state, navigation, presentation validation, permission-driven visibility, DTO mapping, optimistic/loading/error state.
6. **Phải chuyển sang backend:** authentication/OTP, account status, RBAC authorization, market scope enforcement, IDs, workflow state transition, contract-point atomic consistency, money/receivable/payment/debt calculations, audit, document storage, report aggregation.
7. **Mock data:** isolate deterministic seed and localStorage repositories under `mocks/`; expose the same interfaces that future HTTP repositories use. Do not let views know whether source is mock or API.
8. **Target structure:** feature-based tree in sections 12–14, with a small shared UI/util/authz layer and explicit API/repository boundaries.

## Phát hiện vấn đề (không sửa trong audit)

- `A.SCREEN_MARKET` does not enumerate `tai-khoan-ngan-hang`, although it has an RBAC screen and view. `A.screenMarketOk()` treats unknown key as allowed; this may be intentional SYSTEM-like behavior but should be made explicit during refactor.
- `README.md` still describes two markets while current `DATA.MARKETS` / RBAC seed supports 12; documentation drift.
- Source displayed through PowerShell includes mojibake in output, while file bytes should be checked in an editor/browser before claiming a source encoding defect. This audit does not alter encoding.
- The actual browser localStorage can override default seed; audit findings about records/counts describe code and default source, not an arbitrary existing user profile.

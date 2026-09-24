# AGENTS.md

# Digital Market Management System — Cao Lãnh

This repository contains the frontend prototype for the **Digital Market Management System (Quản lý chợ số)** of Cao Lãnh Ward, Đồng Tháp Province.

This file is the mandatory working contract for AI coding agents such as OpenAI Codex, Claude Code, Copilot, or other automated agents.

The repository already contains working prototype behavior, business rules, routing, RBAC, mock data, and localStorage state.

**DO NOT treat this repository as a blank project. Before changing anything, inspect the existing implementation.**

---

## 1. PROJECT STATUS

Current implementation stage:

> **FRONTEND PROTOTYPE**

The current repository is not yet the final production system.

Therefore:

- frontend behavior may use mock data;
- localStorage may be used for persistence;
- external integrations may be simulated;
- backend APIs may not exist yet;
- authentication may be simulated;
- payment integrations may be mocked;
- Zalo/SMS integrations may be represented by UI behavior only.

Do not build a fake backend inside the frontend.

Do not claim that a mock integration is a real integration.

Code should remain structured so that mock data can later be replaced by backend APIs.

---

## 2. AUTHORITATIVE REQUIREMENTS

The current implementation must follow the latest approved business documents.

### PRIMARY BUSINESS SOURCE

`Tai-lieu-thuyet-minh-phan-he-quan-ly-cho-so-Cao-Lanh-Dong-Thap-v2.docx`

This document is the **CURRENT BUSINESS BASELINE**.

It defines:

- current project scope;
- 12-market model;
- current actors;
- current business workflows;
- monthly fee collection;
- business point management;
- merchant management;
- fee collector assignment;
- monthly receivables;
- payment/collection;
- receipt generation;
- cash handover;
- debt;
- complaint handling;
- reporting;
- required information;
- business boundaries.

### SECONDARY REFERENCE

`Dac_ta_chi_tiet_Phan_he_2_Quan_ly_Cho_so.docx`

Use this document only as a detailed reference for requirements that remain compatible with the primary business source.

It may provide useful detail for validation, audit, state transitions, data relationships, security, exception handling, and acceptance criteria.

### PRECEDENCE

When requirements conflict:

1. Latest explicit user instruction.
2. Primary business source.
3. Secondary detailed specification.
4. Existing confirmed implementation.
5. Existing prototype behavior.

Prototype behavior is never allowed to override confirmed business requirements.

If the documents do not clearly define the required behavior, **do not invent a business rule**.

Report:

`NEEDS_CONFIRMATION: <question>`

---

## 3. CURRENT BUSINESS SCOPE

The system currently manages 12 markets in Cao Lãnh Ward:

1. Chợ Cao Lãnh
2. Chợ Hòa An
3. Chợ Tân Việt Hòa
4. Chợ Tân Thuận Tây
5. Chợ Thông Lưu
6. Chợ Tân Tịch
7. Chợ Tịnh Thới
8. Chợ Mỹ Ngãi
9. Chợ Tân Thuận Đông
10. Chợ Long Hồi
11. Chợ Xẻo Bèo (CDC)
12. Chợ Sáu Quốc

Older prototype code may still contain assumptions that only Chợ Cao Lãnh and Chợ Tân Thuận Đông exist. Treat those assumptions as **LEGACY** unless explicitly required.

New implementation must not introduce new two-market-only logic.

Avoid market-specific branching when a rule actually applies to all markets. Prefer configuration/data-driven behavior.

---

## 4. CORE BUSINESS GOALS

The Market Management module focuses on three operational areas.

### A. Digitize market data

Manage markets, market structure, business points, merchants, collector assignments, and fee configuration.

### B. Monthly fee collection

Manage monthly collection periods, receivables, collection, partial payment, receipts, cash handover, debt, exemptions/adjustments where applicable, and monthly closing.

### C. Complaint / incident handling

Manage complaint reception, assignment, technical processing, result, completion, and reporting.

Do not expand the system beyond these confirmed business areas without an explicit requirement.

---

## 5. IMPORTANT REPOSITORY FILES

The repository currently uses a lightweight frontend architecture. Before editing, inspect the actual current version of these files.

### `index.html`

Main application shell. It may contain application layout, navigation, script loading, shared containers, and common UI structure.

Do not put large business logic directly into `index.html`.

### `data.js`

Contains prototype/mock business data.

Potential responsibilities include markets, market metadata, stalls/business points, sample users, and supporting datasets.

Do not create a second market dataset without first checking whether the required data already exists here or is initialized through `A.db`.

### `js/core.js`

Core application behavior. Potential responsibilities include application namespace, shared state, routing, initialization, selected market, common utilities, and mock-data initialization.

Changes here have system-wide impact. Do not modify `core.js` for a screen-local problem unless necessary.

### `js/permissions.js`

Central permission/RBAC definitions.

All authorization behavior should remain centralized here or through the existing permission layer.

Do not implement screen authorization by scattering direct role checks throughout individual views unless this is already part of the centralized permission mechanism.

Prefer existing permission helpers such as `A.U.can(...)` or the equivalent currently present in the repository. Inspect the actual implementation before using it.

### `js/accounts.js`

Account-related prototype behavior. Potential responsibilities include sample accounts, account configuration, role assignment, and market scope.

Do not duplicate account state elsewhere.

### `js/serviceconfig.js`

Service/fee configuration related behavior.

Inspect before adding prices, monthly fees, service configuration, or effective-date logic.

Do not create another independent fee configuration store.

### `js/v-cautruc.js`

**CRITICAL FILE.**

This file has historically contained major market-layout / market-structure behavior.

The project previously consolidated market structure and layout into a single user-facing screen.

Current canonical route:

`#/mat-bang`

Legacy concepts/routes may include:

`#/so-do`

`#/cau-truc`

These must not be recreated as independent competing screens.

If redirects currently exist from the legacy routes to `#/mat-bang`, preserve them unless the task explicitly changes routing.

Before modifying this file:

1. inspect the current layout model;
2. inspect localStorage usage;
3. inspect market adapters;
4. inspect event handlers;
5. inspect RBAC checks;
6. inspect how business points are rendered.

Do not introduce another independent layout model.

### `js/v-dieuhanh.js`

Contains operational/management views. Inspect existing responsibilities before moving functionality into or out of this file.

### `js/v-taichinh.js`

Contains financial/collection-related prototype views.

Changes may affect receivables, collection, debt, reconciliation, receipts, or financial dashboards.

Financial changes require extra care.

### `js/v-tieuthuong.js`

Contains merchant-related functionality.

Do not create another merchant source of truth elsewhere.

### `js/v-vanhanh.js`

Contains operational workflow functionality.

Inspect existing workflow ownership before adding complaint, assignment, incident, or operational behavior.

### `styles.css`

Shared application styling.

Prefer existing classes and design patterns. Do not introduce a new design system for a single screen.

---

## 6. APPLICATION NAMESPACE

The prototype uses the existing application namespace, commonly referenced as:

`A`

Existing patterns may include:

- `A.db`
- `A.VIEWS`
- `A.U`
- `A.MENU`

Do not create another global application object such as `APP`, `AppState`, `globalStore`, or `window.store` unless an architecture migration is explicitly requested.

Extend the existing architecture instead of creating a parallel one.

---

## 7. ROUTING RULES

The current prototype is hash-route based.

Example:

`#/mat-bang`

Before creating a new route:

1. inspect existing route registration;
2. inspect `A.VIEWS`;
3. inspect navigation configuration;
4. inspect permission mapping.

Do not create duplicate routes for the same business capability.

For market layout, the canonical route is `#/mat-bang`.

Do not restore separate "Cấu trúc chợ" and "Sơ đồ chợ" implementations unless explicitly requested.

---

## 8. MARKET SELECTION

The application supports multi-market operation.

The selected market must respect the logged-in account's market scope.

Conceptually:

`available markets ∩ user market scope = selectable markets`

Never allow a user to switch to a market outside their scope merely by changing frontend state or URL parameters.

Prototype UI must reflect the same restriction even before backend authorization exists.

---

## 9. DYNAMIC RBAC MUST BE PRESERVED

The project has moved away from static role-only menu permissions.

Do not revert to a model where permissions are hardcoded only in menu role arrays.

Authorization must conceptually support:

`Account → Role → Screen permissions → Action permissions → Market scope`

Existing dynamic RBAC behavior must be preserved.

Do not replace dynamic permissions with hardcoded checks.

---

## 10. CURRENT BUSINESS ROLES

### 10.1 System Administrator — Quản trị hệ thống

Main responsibilities:

- accounts;
- roles/permissions;
- 12-market catalog;
- shared configuration;
- shared price configuration.

System Administrator does not automatically perform daily market operations.

### 10.2 Market Management Leader — Trưởng Ban Quản lý chợ

Within assigned market scope, this role may:

- build/manage market layout;
- declare business points;
- configure collection amounts;
- assign fee collectors;
- open monthly collection period;
- close monthly collection period;
- approve exemptions/reductions;
- confirm cash handover;
- receive complaints;
- assign complaints;
- view market reports.

This is the main operational approval role.

### 10.3 Fee Collector — Nhân viên thu phí

Within assigned business points, this role may:

- update permitted business-point information;
- update merchant information;
- view assigned monthly collection list;
- record collection;
- record partial collection;
- access/issue receipt;
- submit collected cash;
- remind debtors.

Do not automatically give this role market-wide administrative access.

### 10.4 Technical Staff — Nhân viên kỹ thuật

Responsibilities:

- receive assigned complaint/incident;
- process work;
- update progress;
- upload result/evidence;
- complete assigned work.

Do not give financial permissions merely because the user belongs to the Market Management organization.

### 10.5 Merchant / Citizen — Tiểu thương / Người dân

Capabilities may include:

- receive payment notification;
- receive receipt;
- pay via supported method;
- lookup receipt;
- submit complaint;
- receive complaint result.

Do not expose internal management functions.

### 10.6 Cao Lãnh Ward Leadership — Lãnh đạo UBND phường

This is primarily a supervisory role.

It may:

- view aggregate dashboard for 12 markets;
- view monthly reports;
- view overdue complaints.

It must not perform normal market operational actions unless a later approved requirement explicitly grants them.

---

## 11. PERMISSION IMPLEMENTATION

When adding a feature, do not only hide the menu item.

Check permission at:

1. navigation visibility;
2. screen access;
3. action/button access;
4. handler execution where appropriate.

For prototype code, prevent unauthorized actions even when a handler is called directly from the console/UI.

Use the existing permission abstraction.

Do not invent new permission naming conventions if equivalent keys already exist.

---

## 12. MARKET LAYOUT — CRITICAL ARCHITECTURAL RULE

The market layout has historically been a high-risk area because multiple data representations existed during prototype development.

The current implementation must have **ONE authoritative layout source**.

Before modifying layout logic, identify:

- where the layout is loaded;
- where it is stored;
- its localStorage key;
- how it maps to business points;
- whether migration/adapters exist.

Known historical localStorage key:

`choso-caolanh-layout`

Treat this as historical context, not permission to create another store.

If the current implementation already uses it as the authoritative layout store, extend that implementation.

Do not introduce parallel stores such as `marketLayouts2`, `newLayout`, `layoutV2`, `TTDLayout`, or `CLLayout` merely to make a feature easier.

If a data-model migration is necessary, perform an explicit migration.

---

## 13. `mat-bang` IS THE UNIFIED MARKET LAYOUT SCREEN

The market layout screen represents both structural organization and visual representation of business points.

Do not reintroduce duplicate screens for "Thiết lập cấu trúc", "Sơ đồ", and "Điểm kinh doanh" when they represent the same layout capability.

If the current design has replaced a separate "Điểm kinh doanh" mode with table view / layout-map view, do not reintroduce the old "Điểm kinh doanh" tab or mode without an explicit requirement.

Likewise, do not reintroduce deprecated controls such as a separate "lập yêu cầu thay đổi" flow if the current approved design removed it.

Always inspect the current UI before modifying this screen.

---

## 14. MARKET STRUCTURE MODEL

A market may conceptually contain:

`Market → Area / Floor → Row → Business Point`

But not every market must use every level.

Examples:

Large market:

`Market → Floor → Area → Row → Business Point`

Small market:

`Market → Area → Business Point`

Very small market:

`Market → Business Point`

Do not assume a fixed tree depth.

Rendering and data mapping must tolerate missing intermediate levels.

---

## 15. BUSINESS POINT MODEL

Each business point should support at least:

- code;
- market;
- location;
- area/floor/row when applicable;
- area size;
- area type;
- business category;
- assigned fee collector;
- operational status.

Current simple business states include:

- Còn trống
- Đang kinh doanh
- Tạm ngừng
- Nợ phí

Do not automatically copy older, more complex state models into the current prototype.

If debt and occupancy need simultaneous representation, prefer a base operational state plus a debt warning/indicator rather than destroying one state to represent the other.

---

## 16. MERCHANT RULES

Merchant information belongs to the business-point workflow.

Minimum information:

- full name;
- phone number;
- document/identity number;
- business point;
- start date;
- supporting files/images where applicable.

Within the same market, duplicate identity/document numbers must be validated according to the current business requirement.

When a merchant is assigned to a business point, the business point may become `Đang kinh doanh`.

Do not physically delete merchant history after financial activity has been generated.

---

## 17. FEE COLLECTOR ASSIGNMENT

Each business point has **ONE active fee collector at a time**.

The Market Management Leader can assign collectors individually or in bulk.

When changing collector:

- current responsibility moves to the new collector;
- historical collection records remain associated with the original collector.

Never rewrite old receipt/payment ownership when collector assignment changes.

---

## 18. FEE CONFIGURATION

Current business rules allow a business point's monthly amount to use:

**Method A**

`Unit price × area × 30 days`

or:

**Method B**

`Fixed monthly amount`

Additional fixed monthly charges may exist.

Configuration should preserve:

- method;
- unit price;
- fixed amount;
- additional amount;
- effective date;
- basis/reason.

Do not silently overwrite historical configurations.

---

## 19. QĐ 480 PRICE DATA

The primary business source contains price rules based on QĐ 480/QĐ-UBND.

Treat those values as business data.

Do not scatter these numbers throughout view code.

Store them in an appropriate configuration/data layer.

Do not duplicate price constants in multiple files.

If the user asks to change price behavior, inspect the current configuration implementation first.

---

## 20. COLLECTION PERIOD

**CRITICAL RULE: The current system uses MONTHLY COLLECTION PERIOD ONLY.**

Do not implement quarterly, yearly, or arbitrary accounting periods unless a newer approved requirement explicitly adds them.

---

## 21. MONTHLY BUSINESS FLOW

The expected high-level monthly workflow is:

1. Open monthly period.
2. Generate receivables for eligible business points.
3. Include previous outstanding debt.
4. Assign collection list according to fee collector.
5. Notify merchant.
6. Merchant may pay by supported electronic channel.
7. Fee collector collects remaining amounts.
8. Record full or partial collection.
9. Issue receipt.
10. Fee collector submits collected cash.
11. Market Management Leader confirms cash receipt.
12. Close monthly period.
13. Carry unpaid amount to debt.
14. Generate monthly report.

When implementing any financial screen, verify where that screen belongs in this flow.

Do not create isolated financial actions that bypass this workflow.

---

## 22. RECEIVABLE RULES

A receivable should conceptually contain:

- month;
- market;
- business point;
- assigned collector;
- current charge;
- previous debt;
- amount due;
- amount paid;
- remaining amount;
- status.

Use the exact current data model where one already exists.

Do not create a second receivable model only for UI convenience.

---

## 23. PARTIAL PAYMENT

Partial payment is allowed.

Example:

- Amount due: 1,000,000
- Collected: 600,000
- Remaining: 400,000

Do not mark the receivable as fully paid.

The remaining amount must continue to appear in debt/collection views.

---

## 24. PAYMENT CHANNELS

Current business channels include:

- cash;
- bank transfer;
- QR.

All payment channels must eventually affect the same receivable.

Do not maintain independent debt totals for each payment channel.

Payment method is an attribute of the transaction, not a separate financial truth.

---

## 25. CASH COLLECTION != CASH HANDOVER

This distinction is mandatory.

Event A:

`Merchant → pays cash → Fee Collector`

Event B:

`Fee Collector → submits cash → Market Management`

Event C:

`Market Management Leader → confirms received cash`

These are not the same event.

Never automatically mark cash as handed over merely because collection was recorded.

---

## 26. CASH HANDOVER

The system should be capable of representing:

- collector;
- collection session/date;
- expected cash;
- submitted cash;
- confirmed cash;
- difference;
- submission status;
- confirmation status.

If there is a difference, preserve it for handling.

Do not silently force values to match.

---

## 27. RECEIPTS

Every successful collection/payment must remain traceable.

Receipt data should include at least:

- receipt number;
- receivable;
- amount;
- payment method;
- collector/source;
- timestamp;
- lookup code.

In prototype mode, receipt generation may be simulated.

Do not pretend a prototype receipt has been legally issued through an external production service.

---

## 28. MONTH CLOSING

Only the authorized Market Management Leader should close the market's monthly collection period.

When closing:

- unpaid amount becomes debt;
- partially paid balance becomes debt;
- debt carries to the next period;
- closed-period numbers should not be silently edited.

If a correction is required after closing, use an explicit adjustment mechanism rather than rewriting history.

---

## 29. COMPLAINT WORKFLOW

Current complaint workflow:

`Tiếp nhận → Đang xử lý → Hoàn thành → Đóng`

Do not replace it with an older, more complex workflow unless explicitly requested by a newer requirement.

Complaint categories may include:

- điện;
- nước;
- vệ sinh;
- an ninh trật tự;
- PCCC;
- hạ tầng;
- khác.

---

## 30. COMPLAINT RESPONSIBILITY

Typical flow:

`Merchant/Citizen → submit complaint`

`Market Management → receive complaint`

`Market Management Leader → assign technical employee`

`Technical Employee → process → update progress → attach result evidence`

`Reporter → receives result → may evaluate`

The system should preserve responsible person, timestamps, status changes, and evidence.

---

## 31. REPORTING

Reporting should support appropriate scope.

### Fee Collector

Only assigned work/data.

### Market Management Leader

Assigned market(s).

### Ward Leadership

Aggregate information across the 12 markets.

Important indicators may include:

- total receivable;
- total collected;
- outstanding debt;
- collection rate;
- debt by market;
- debt by collector;
- cash handover;
- complaint count;
- complaint status;
- overdue complaints.

Do not expose cross-market information to users without appropriate scope.

---

## 32. FRONTEND STATE

Because this is currently a prototype, state may be stored in JavaScript objects, `A.db`, localStorage, and mock datasets.

Before adding state:

**SEARCH FIRST.**

Determine whether an equivalent source already exists.

Do not create a new localStorage key just because it is easier.

---

## 33. LOCALSTORAGE RULES

When changing persisted prototype data:

1. identify the current key;
2. inspect existing stored structure;
3. preserve backward compatibility where reasonable;
4. provide migration if structure changes;
5. handle missing/corrupted old data safely.

Never assume localStorage is empty.

Avoid destructive initialization that overwrites existing prototype data every page load.

---

## 34. SINGLE SOURCE OF TRUTH

This rule is **CRITICAL** for this repository.

There must be one authoritative source for each business domain.

Examples:

- Markets → one source
- Market layout → one source
- Business points → one source
- Merchants → one source
- Accounts → one source
- Permissions → one source
- Fee configuration → one source
- Receivables → one source

Views may derive data.

Views must not become independent databases.

---

## 35. DERIVED DATA

Prefer deriving display information instead of storing duplicates.

For example, do not independently store `stall.isDebt = true` if debt can reliably be determined from receivables.

Prefer:

`business point + receivable/debt data → derived UI indicator`

unless the current business model explicitly requires persisted status.

This prevents stale state.

---

## 36. DO NOT REINTRODUCE LEGACY ARCHITECTURE

During development, older branches may contain previous approaches.

Do not copy old code merely because it already exists.

Before porting code from another branch:

1. identify the current branch architecture;
2. compare data models;
3. compare routes;
4. compare RBAC;
5. identify duplicate sources of truth;
6. port business rules rather than blindly porting implementation.

A successful old implementation may still be incompatible with the current architecture.

---

## 37. UI DESIGN RULES

The prototype is for real market-management workflows.

Optimize for operational clarity.

Prefer:

- vertical information flow;
- readable tables;
- clear grouping;
- simple filters;
- clear primary action;
- clear status;
- fewer simultaneous panels;
- responsive/mobile-friendly collection screens.

Avoid:

- excessive split-screen layouts;
- too many cards competing for attention;
- duplicate tabs;
- repeated information;
- hidden important actions;
- decorative complexity.

When the user asks to simplify a screen, simplify the existing screen. Do not compensate by adding another navigation layer.

---

## 38. SCREEN-SPECIFIC CHANGES

When the user says:

`chỉ sửa màn X`

treat that as a **SCOPE LOCK**.

Allowed:

- screen X;
- directly required helper/style/data changes.

Not allowed without explicit need:

- redesign other screens;
- change global navigation;
- change unrelated permissions;
- refactor the entire architecture;
- rename unrelated modules;
- migrate unrelated data.

If a shared dependency must change, keep the modification minimal.

---

## 39. EVENT HANDLERS

The current prototype may use delegated DOM handlers.

Before adding a handler, search for existing:

- `data-act`;
- action names;
- click delegation;
- render functions.

Do not register duplicate handlers for the same action.

For `mat-bang`, historical handler names may include:

- `mb-sel-zone`
- `mb-sel-overview`
- `mb-toggle-node`
- `mb-toggle-tree`
- `qh-zone-edit-open`

Inspect whether they still exist before changing behavior.

Never assume historical names still represent current behavior.

---

## 40. MARKET LAYOUT FUNCTIONS

Historical/current implementation may contain functions such as:

- `mbWorkspaceHtml`
- `mbTreeHtml`
- `mbRightHtml`
- `qhSyncDrawer`

These names are provided only to help locate existing implementation.

Do not recreate them if they no longer exist.

Search the repository first.

If they exist, modify them consistently with the existing rendering pipeline.

---

## 41. NO BLIND REWRITE

Do not replace an entire file just to implement a small feature.

Prefer the **smallest coherent change**.

Large rewrite is acceptable only when:

- explicitly requested;
- existing architecture prevents the requirement;
- migration is planned;
- behavior is validated afterward.

---

## 42. FINANCIAL CODE SAFETY

Financial code is high-risk.

When modifying financial behavior, check:

- partial payment;
- duplicate collection;
- previous debt;
- collector assignment;
- period state;
- cash vs transfer;
- cash handover;
- receipt generation;
- closing behavior.

Never use UI labels as the source of financial truth.

Never derive monetary correctness solely from DOM state.

---

## 43. IDEMPOTENCY IN PROTOTYPE

Even in the prototype, avoid obvious duplicate operations.

Examples:

- double-clicking "Đã thu" must not accidentally create two payments;
- repeated rendering must not duplicate data;
- reloading must not regenerate the same monthly receivable repeatedly.

Use stable identifiers and existence checks where appropriate.

---

## 44. IDENTIFIERS

Business records should have stable IDs.

Do not use array index as the long-term identity for:

- market;
- business point;
- merchant;
- receivable;
- payment;
- receipt;
- complaint.

Array index may change after sorting/filtering.

Use stable IDs/codes.

---

## 45. MOCK DATA

Mock data must be believable and internally consistent.

Examples:

- a business point assigned to Market A must not reference a collector scoped only to Market B;
- a receipt must reference an existing receivable;
- a debt amount must agree with collection history.

Do not add random mock values that violate business relationships.

---

## 46. NO UNREQUESTED BACKEND

Unless explicitly asked, do not add:

- Express;
- Node server;
- database;
- authentication server;
- Firebase;
- Supabase;
- REST backend;
- backend infrastructure.

This repository is currently a frontend prototype.

Keep changes compatible with the current prototype goal.

---

## 47. NO UNREQUESTED FRAMEWORK MIGRATION

Do not migrate the application to React, Vue, Angular, Next.js, Vite, TypeScript, or another framework unless explicitly requested.

Work with the existing architecture.

---

## 48. DEPENDENCY POLICY

Avoid adding dependencies for tasks that can reasonably be implemented with the existing stack.

Before adding any dependency:

1. confirm the project already uses package management;
2. explain why existing code cannot reasonably solve the problem;
3. evaluate impact on deployment.

Prototype simplicity is preferred.

---

## 49. DATA MIGRATION

If changing persisted data structure, do not simply reset localStorage.

Implement migration when practical:

`old data → detect schema → normalize → migrate → validate → persist new structure`

Migration should be safe to run more than once when possible.

---

## 50. ERROR HANDLING

Prototype behavior must fail visibly and safely.

Do not silently swallow important errors.

For user-facing failures, show understandable Vietnamese messages.

For development, log enough information to diagnose the issue.

Do not expose sensitive information unnecessarily.

---

## 51. VIETNAMESE UI

User-facing application text should primarily use Vietnamese.

Use terminology from the business documents.

Prefer:

- Điểm kinh doanh
- Tiểu thương
- Nhân viên thu phí
- Trưởng Ban Quản lý
- Kỳ thu tháng
- Khoản phải thu
- Đã thu
- Còn nợ
- Nộp tiền
- Biên lai
- Phản ánh

Avoid introducing alternative terminology for the same concept without a reason.

Consistency is more important than stylistic variation.

---

## 52. BEFORE EVERY TASK

Before editing code, the agent must:

1. read this `AGENTS.md`;
2. inspect `git status`;
3. identify the current branch;
4. inspect files relevant to the request;
5. search for existing implementation;
6. identify source of truth;
7. identify relevant RBAC rules;
8. identify localStorage/state impact;
9. identify affected routes;
10. identify the relevant business requirement.

Do not start coding immediately after reading only the user's prompt.

---

## 53. REQUIRED IMPLEMENTATION PLAN

For non-trivial changes, internally determine:

- **CURRENT** — what exists now;
- **TARGET** — what the user requested;
- **GAP** — exact behavior that must change;
- **FILES** — minimum files required;
- **RISKS** — RBAC/data/routing/persistence impact.

Then implement.

Do not ask the user to approve routine implementation details unless a business decision is genuinely ambiguous.

---

## 54. AFTER EVERY CHANGE

At minimum inspect:

`git diff --check`

`git diff`

`git status`

If the project has an existing runnable validation command, run it.

Do not invent a test command that the project does not support.

---

## 55. BROWSER / RUNTIME VALIDATION

When the environment allows running the prototype, verify the changed workflow.

For UI changes check:

- initial render;
- navigation;
- relevant buttons;
- filtering;
- market switching;
- modal/drawer behavior;
- persistence after reload where applicable.

For RBAC changes check at least:

- one allowed role;
- one denied role.

For financial changes check:

- unpaid;
- partial payment;
- full payment.

---

## 56. REGRESSION CHECK

After changing a shared file such as:

- `core.js`
- `permissions.js`
- `data.js`
- `v-cautruc.js`
- shared CSS

verify at least one neighboring workflow that depends on it.

Shared-file changes require broader validation than screen-local changes.

---

## 57. GIT SAFETY

The user may already have uncommitted work.

Never destroy it.

Forbidden unless explicitly authorized:

`git reset --hard`

`git clean -fd`

`git checkout -- .`

`git restore .`

Do not force checkout another branch when the worktree is dirty.

Do not overwrite unrelated changes.

---

## 58. BRANCH SAFETY

Before merge/rebase/cherry-pick, check `git status`.

If there are uncommitted changes, stop and preserve them before history-changing operations.

Do not automatically resolve business-logic conflicts by choosing "ours" or "theirs".

For conflicts involving:

- `data.js`
- `core.js`
- `permissions.js`
- `v-cautruc.js`

resolve semantically.

These files may represent different sources of truth.

---

## 59. PORTING FROM OLD BRANCHES

When porting an old feature, do not blindly cherry-pick if architecture has changed.

Prefer:

1. inspect old implementation;
2. extract required business behavior;
3. inspect current architecture;
4. reimplement behavior using current architecture;
5. test migration/data compatibility.

Business behavior is portable. Architecture is not necessarily portable.

---

## 60. DEFINITION OF DONE

A task is complete only when all applicable conditions are satisfied:

- requested behavior works;
- business requirement is respected;
- current architecture is preserved;
- no duplicate source of truth introduced;
- RBAC remains correct;
- market scope remains correct;
- persistence remains valid;
- no unrelated functionality changed;
- syntax/runtime checks pass;
- diff contains only intended changes;
- remaining uncertainties are reported.

Visual appearance alone is not sufficient.

---

## 61. COMPLETION REPORT FORMAT

After implementing a task, report using this structure:

### Completed

Short description of what was implemented.

### Files changed

- `path/file.js` — reason
- `styles.css` — reason

### Business rules preserved

List relevant business rules.

### Validation performed

List commands/tests actually executed.

### Regression check

State what neighboring behavior was checked.

### Not changed

Mention important adjacent areas intentionally left untouched.

### Needs confirmation

Only include this section when unresolved business decisions remain.

Never claim a test passed if it was not actually executed.

---

## 62. BUSINESS RULES THAT MUST NOT BE INFERRED

Do not invent:

- additional collection periods;
- new user roles;
- new approval hierarchy;
- new financial formulas;
- new debt penalties;
- new late fees;
- automatic exemptions;
- automatic approvals;
- accounting entries;
- legal receipt behavior;
- new complaint statuses;
- new market hierarchy levels;
- new integration behavior.

If required but undocumented:

`NEEDS_CONFIRMATION`

---

## 63. IMPORTANT CURRENT DESIGN DECISIONS

Unless the current code or a newer user instruction says otherwise, preserve these decisions:

### Market layout

Use one unified `mat-bang` capability.

Do not split structure/layout/business-point management back into competing implementations.

### RBAC

Use dynamic account/role/action/market-scope authorization.

Do not return to static menu-role authorization.

### Multi-market

Design for all 12 markets.

Do not hardcode only CL and TTD.

### Collection

Monthly period only.

### Complaint

Use the current simplified complaint workflow.

### Prototype

Frontend-first.

Do not build backend infrastructure unless requested.

### Data

One source of truth per domain.

Do not create duplicate state stores.

---

## 64. WHEN USER INSTRUCTIONS OVERRIDE THIS FILE

The user's latest explicit instruction may intentionally change a current design decision.

If so:

1. follow the user's requested change;
2. preserve unaffected business rules;
3. update dependent implementation only as necessary;
4. do not use this file as a reason to ignore the requested change.

However, if the request appears to conflict with an authoritative business requirement, identify the conflict before making an irreversible business-rule change.

---

## 65. FINAL RULE

Do not make the business fit the old prototype.

Do not make the new requirement fit an old branch.

Do not create a second architecture because changing the current one is inconvenient.

Always work in this order:

`BUSINESS REQUIREMENT`

↓

`CURRENT REPOSITORY ARCHITECTURE`

↓

`EXISTING SOURCE OF TRUTH`

↓

`MINIMUM REQUIRED CHANGE`

↓

`RBAC / DATA / PERSISTENCE CHECK`

↓

`IMPLEMENTATION`

↓

`VALIDATION`

↓

`DIFF REVIEW`

When uncertain:

**SEARCH FIRST.**

When still uncertain:

**ASK / REPORT `NEEDS_CONFIRMATION`.**

**Never guess a business rule.**

# SERVICE_PRICING_SCREEN_IMPLEMENTATION_REPORT — STEP A

Tách "Cấu hình giá dịch vụ" khỏi Cài đặt sang màn Tài chính độc lập — Screen + RBAC + Market Scope
ONLY. Không nối biểu giá vào thuật toán tính khoản phải thu (đúng phạm vi STEP A đã chốt).

---

## 1. Files changed

- `js/core.js` — thêm mục menu `cau-hinh-gia` vào nhóm "Tài chính"; thêm
  `A.SCREEN_MARKET['cau-hinh-gia'] = 'BOTH'`.
- `js/permissions.js` — `CATALOG` (thêm `screen:cau-hinh-gia` + 3 `action:cau-hinh-gia.*`, xoá 3
  `action:cai-dat.gia-*`); `defaultRolePermissions()` (thêm default mới, xoá 3 dòng cũ);
  `PERM_SEED_VERSION` 3→4; viết lại `loadState()` để MERGE thay vì reseed toàn bộ khi
  `seedVersion` lệch (hàm mới `mergeIntoCurrentSeed()`).
- `js/v-vanhanh.js` — toàn bộ thay đổi UI/handler: `SETTINGS_TABS`, router `A.VIEWS['cai-dat']`,
  `A.VIEWS['cau-hinh-gia']` (mới), `settingsGiaHtml`/`settingsDienNuocHtml`/`settingsDichVuHtml` +
  3 drawer + toàn bộ handler `cfg-price-*`/`cfg-util-*`/`cfg-svc-*`, `renderCfgForm`/
  `cfg-form-save`, `cfg-att-add`/`cfg-att-del`; 2 helper mới `cfgGiaActionKey`/
  `cfgPriceMutateAllowed`/`cfgAttachMutateAllowed`/`cfgAllBadge`.
- `js/serviceconfig.js` — chỉ sửa comment đầu file cho đúng vị trí UI mới (KHÔNG đổi model/API).
- Không sửa `js/accounts.js`, `js/v-taichinh.js`, `js/v-tieuthuong.js`, `js/v-dieuhanh.js`,
  `js/v-cautruc.js`, `index.html`, `data.js` — đúng cam kết mục 12 đề bài (không đụng thuật toán
  tính tiền).

---

## 2. Screen/menu changes

- Screen mới `id: 'cau-hinh-gia'`, label "Cấu hình giá dịch vụ", đặt đầu tiên trong nhóm "Tài
  chính" (`core.js A.MENU`), đúng trước `dien-nuoc`. Verify sống (screenshot) thứ tự sidebar hiển
  thị đúng: *Cấu hình giá dịch vụ → Chỉ số điện, nước → Khoản phải thu → Thu tiền & biên lai →
  Đối soát → Công nợ & nhắc nợ*.
- `A.SCREEN_MARKET['cau-hinh-gia'] = 'BOTH'` — áp dụng cho cả CL/TTD theo `selectedMarket`.
- Màn mới chỉ 3 tab nội bộ: Đơn giá mặt bằng / Điện & nước / Dịch vụ khác (`PRICE_TABS`, thay
  hẳn `CFG_TABS` cũ 5 phần tử).
- `SETTINGS_TABS` (Cài đặt & phân quyền) bỏ hẳn tab "Cấu hình dịch vụ"; **Kỳ thu**/**Quy tắc thu
  phí** đưa thẳng lên tab cấp 1 (trước đây 2 cấp: Cài đặt → Cấu hình dịch vụ → Kỳ thu). Verify
  sống (screenshot) Cài đặt hiển thị đúng: *Kỳ thu / Quy tắc thu phí / Vai trò & phân quyền / Tích
  hợp / Nhật ký kiểm toán*.

---

## 3. RBAC changes

`screenRoles['cau-hinh-gia'] = ['market_manager', 'accountant', 'ward_leader']` — đúng default đề
bài (market_staff/collector/technician/trader/system_admin đều DENY mặc định, verify sống ở mục
11 dưới).

---

## 4. Old permission keys removed

`action:cai-dat.gia-mat-bang`, `action:cai-dat.gia-dien-nuoc`, `action:cai-dat.dich-vu-khac` — xoá
hẳn khỏi `CATALOG` **và** khỏi mọi `rolePerms` đã lưu (kể cả tuỳ biến admin cho 3 key này) qua
merge migration (mục 9). Không giữ song song 2 hệ permission cho cùng hành động.

---

## 5. New permission keys

```
action:cau-hinh-gia.mat-bang     → market_manager (GRANT), tất cả role khác DENY
action:cau-hinh-gia.dien-nuoc    → market_manager (GRANT), tất cả role khác DENY
action:cau-hinh-gia.dich-vu-khac → market_manager (GRANT), tất cả role khác DENY
```

`accountant`/`ward_leader` có `screen:cau-hinh-gia` nhưng KHÔNG có 3 action trên → xem, không sửa.
`system_admin` không có cả screen lẫn 3 action → không phải business superuser.

---

## 6. Handler-level gates

Toàn bộ mutation handler của 3 nhóm giá giờ re-check `A.canDo` **trước khi ghi**, không chỉ ẩn
nút:

| Handler | Gate |
|---|---|
| `cfg-price-new`/`cfg-price-edit`/`cfg-price-toggle` | `cfgPriceMutateAllowed('stallPrices', rec\|null)` |
| `cfg-util-new`/`cfg-util-edit`/`cfg-util-toggle` | `cfgPriceMutateAllowed('utilities', rec\|null)` |
| `cfg-svc-new`/`cfg-svc-edit`/`cfg-svc-toggle` | `cfgPriceMutateAllowed('extraServices', rec\|null)` |
| `cfg-form-save` (dùng chung cả 3 loại) | đọc lại `existing` từ storage theo `d.id` (không tin `d.marketId` phía client cho case Sửa), gọi `cfgPriceMutateAllowed(d.cat, existing)` |
| `cfg-att-add`/`cfg-att-del` (dùng chung 5 loại config) | `cfgAttachMutateAllowed(cat, rec)` — derive đúng actionKey theo `cat` (3 nhóm giá dùng `cau-hinh-gia.*`; `billingCycle`/`billingRules` giữ nguyên hành vi cũ, không đổi) |

`cfgPriceMutateAllowed(cat, rec)`: `rec=null` (tạo mới) → kiểm theo `ui.market`; `rec` có sẵn →
kiểm theo đúng `rec.marketId` (không phải `ui.market` hiện tại — chặn được cả trường hợp forge đổi
`ui.market` để lách qua bản ghi thuộc chợ khác); `rec.marketId === 'ALL'` → luôn `false` (mục 8).

---

## 7. Market-scope enforcement

- List 3 nhóm giá lọc theo `r.marketId === ui.market` (`stallPrices`/`utilities`) hoặc
  `r.marketId === ui.market || r.marketId === 'ALL'` (`extraServices`, giữ hiển thị legacy).
- Bản ghi MỚI luôn `marketId: ui.market` — không còn field chọn chợ tự do trong form (`cf-market`
  đổi từ `<select>` sang hiển thị read-only; handler `A.CH['cf-market']` đã xoá).
- Không hard-code market theo Role ở bất kỳ đâu — toàn bộ đi qua `A.canDo`/`ui.market`/
  `A.allowedMarkets`.
- Verify sống: `market_manager` với `marketScopes:['CL']` chỉ thấy/sửa được dữ liệu CL; forge gọi
  thẳng `cfg-price-edit`/`cfg-price-toggle` trên bản ghi TTD bị chặn, dữ liệu không đổi; đổi
  `marketScopes` sang `['CL','TTD']` rồi đổi `selectedMarket` → list và quyền thao tác đổi đúng
  theo từng chợ.

---

## 8. Legacy `ALL` behavior

- Không reset storage, không migrate cưỡng bức — bản ghi `extraServices` cũ có `marketId:'ALL'`
  (seed "Gửi xe") vẫn còn nguyên, hiển thị ở **mọi** `selectedMarket` (không bị lọc mất).
- Luôn **read-only**: không có nút Sửa/Vô hiệu hoá/Thêm-tài liệu nào hiển thị; forge gọi handler
  trực tiếp (`cfg-svc-edit`, `cfg-svc-toggle`) đều bị chặn ở tầng handler (`cfgPriceMutateAllowed`
  trả `false` ngay khi thấy `rec.marketId==='ALL'`, không phụ thuộc permission).
- Có nhãn rõ ràng "Dữ liệu cũ · nhiều chợ" (`cfgAllBadge`) kèm tooltip giải thích, thay vì tự suy
  đoán quy bản ghi về CL hay TTD.
- Bản ghi MỚI (`cfg-svc-new`) không còn default `marketId:'ALL'` — đổi thành `ui.market` (trước
  đây seed handler này để mặc định `'ALL'`, đã sửa).
- Verify sống: bản ghi "Gửi xe" tồn tại nguyên vẹn sau mọi thao tác test; tạo mới dịch vụ → luôn
  ra đúng chợ đang chọn, không bao giờ `'ALL'`.

---

## 9. Permission migration behavior

**PERM_SEED_VERSION: 3 → 4.** Đã implement merge thật (không phải chỉ ghi comment) trong
`loadState()`/`mergeIntoCurrentSeed()`:

1. `schemaVersion` khớp (shape hợp lệ) nhưng `seedVersion` lệch → gọi `mergeIntoCurrentSeed(stored)`
   thay vì `freshState()`.
2. Role mặc định nào chưa có trong `stored.roles` → thêm; role đã có giữ nguyên mọi field.
3. `rolePerms` lọc bỏ mọi dòng có `permKey` không còn trong `CATALOG` hiện tại (3 key
   `cai-dat.gia-*` biến mất theo đúng cách này).
4. `permKey` hoàn toàn mới (0 dòng nào trong `stored` sau bước 3) → thêm default grant.
5. `permKey` cũ còn hợp lệ → **giữ nguyên 100%**, kể cả tuỳ biến admin.
6. Ghi lại `seedVersion = PERM_SEED_VERSION`, persist ngay (không chờ lượt grant/revoke đầu tiên —
   giữ đúng "Hotfix persist migration" pattern Phase 3).

**Verify sống (test J)**: tạo payload giả lập `seedVersion:3` có 3 key cũ + 1 grant tuỳ biến
KHÔNG liên quan (`collector` được cấp thêm `cau-truc.reset`, không nằm trong default matrix của
bất kỳ version nào) → reload → kết quả: `seedVersion=4`; grant tuỳ biến **còn nguyên**; 3 key cũ
biến mất; 4 permission mới xuất hiện đúng default; Account (11 bản ghi), `currentDemoAccountId`,
business data (324 stall) hoàn toàn không đổi.

---

## 10. Kỳ thu / Quy tắc thu phí behavior

**Không đổi gì về nghiệp vụ hay permission.** `cai-dat.ky-thu`/`cai-dat.quy-tac-thu-phi` giữ
nguyên key, giữ nguyên default (`system_admin` only), giữ nguyên `cfgCan()` (không chuyển sang
`A.canDo`/market-scope). `billingCycle`/`billingRules` model không sửa. Chỉ đổi VỊ TRÍ hiển thị
(lên tab cấp 1 trong Cài đặt thay vì lồng trong "Cấu hình dịch vụ" cũ).

**GAP ghi nhận lại (không sửa ở task này, đã nêu ở audit)**: `billingRules.approverRoleId` vẫn giữ
giá trị mặc định `'bql'` (role id tiền-RBAC-V1, mồ côi) — không đụng theo đúng chỉ thị mục 11 đề
bài.

---

## 11. Test results

| # | Test | Kết quả |
|---|---|---|
| A | `market_manager` CL: vào screen, chỉ thấy giá CL, thêm/sửa/toggle CL OK, forge sửa/toggle TTD bị chặn (dữ liệu không đổi) | **PASS** |
| B | `market_manager` TTD: tương tự cho TTD (test qua account tạm cấp `marketScopes:['CL','TTD']`, đổi `selectedMarket` sang TTD) | **PASS** |
| C | `market_manager` CL+TTD: đổi `selectedMarket` → list đổi đúng (CL: 4 dòng, TTD: 1 dòng gốc + 1 dòng vừa tạo); thao tác đúng theo từng market | **PASS** |
| D | `accountant`: vào được (đúng khi test bằng route đồng bộ — xem ghi chú debug), thấy nút Xem, không thấy Thêm/Sửa; forge `cfg-price-toggle` bị chặn | **PASS** |
| E | `ward_leader`: vào được read-only; forge mutation bị chặn | **PASS** |
| F | `system_admin`: mặc định KHÔNG vào được screen (`A.current !== 'cau-hinh-gia'` sau route); không có 3 action mới | **PASS** |
| G | `market_staff`/`collector`/`technician`/`trader`: cả 4 đều bị chặn khỏi screen | **PASS** |
| H | Dynamic: revoke `cau-hinh-gia.mat-bang` khỏi `market_manager` → nút biến mất, forge handler vẫn bị chặn; grant lại → hoạt động lại đúng | **PASS** |
| I | Legacy `extraServices` `marketId:'ALL'`: không crash, không mất dữ liệu, không tạo `'ALL'` mới, luôn read-only, hiển thị ở mọi chợ | **PASS** |
| J | Migration: tuỳ biến không liên quan giữ nguyên; 3 key cũ biến mất; 4 permission mới đúng default; Account/UI/business data không reset | **PASS** |
| K | Regression Phase 1–5B: payment cross-market vẫn bị chặn; contract OR-logic vẫn đúng; `marketScopes`/`selectedMarket` invariant vẫn đúng; builtin role protection vẫn đúng; render 8 account × 19 screen không lỗi | **PASS** |

*Ghi chú debug*: lần chạy đầu của test D/E dùng `A.go()` rồi đọc `A.current` NGAY trong cùng 1
đoạn script → đọc phải state cũ do `location.hash=` kích hoạt `hashchange` bất đồng bộ (hiện tượng
đã biết, ghi trong lịch sử dự án). Sửa cách test bằng gọi `A.route()` trực tiếp ngay sau khi set
hash (đồng bộ) — kết quả PASS nhất quán ở lần chạy lại. Không phải lỗi code.

---

## 12. Regression results

Toàn bộ mục K ở trên PASS. Không phát hiện regression nào so với Phase 1–5B.

---

## 13. `node --check`

```
js/core.js          OK
js/permissions.js   OK
js/v-vanhanh.js      OK
js/serviceconfig.js OK
```

---

## 14. Browser console

0 lỗi (`onlyErrors: true`) xuyên suốt toàn bộ phiên test, bao gồm sau khi reload để áp dụng migration
thật và sau khi render 8 account × 19 screen.

---

## 15. Remaining GAP

- **Biểu giá vẫn chưa nối vào thuật toán tính khoản phải thu** (đúng phạm vi STEP A — cố tình
  không làm). `pt-issue`/`ct-new-save`/`inv-adjust-save`/`pay-confirm` không đổi, vẫn đọc
  `data.js` hằng số tĩnh. Ghi chú prototype đã hiển thị rõ trên màn mới đúng yêu cầu mục 13 đề bài.
- `billingRules.approverRoleId = 'bql'` vẫn mồ côi (mục 10/11 — cố ý không sửa).
- Không có version-by-effective-date thật cho 3 nhóm giá (đã ghi nhận ở audit, ngoài phạm vi STEP A).
- `extraServices` legacy `'ALL'` sẽ tồn tại vĩnh viễn trừ khi admin chủ động "chuẩn hoá" (xoá bản
  ghi cũ, tạo lại 2 bản ghi CL+TTD riêng) — không có cơ chế tự động, đúng chủ đích "không tự suy
  đoán" của đề bài.

---

## 16. NEED_CONFIRMATION

Không có mục nào cần xác nhận thêm để hoàn thành STEP A — mọi quyết định nghiệp vụ mở (market
mandatory cho system_admin/ward_leader, phạm vi ALL cho extraServices, v.v.) đã được chốt tường
minh trong chính lệnh triển khai STEP A này.

---

### Xác nhận bắt buộc theo yêu cầu đề bài

| Mục | Kết quả |
|---|---|
| `PERM_SEED_VERSION` | **4** (từ 3) |
| `RBAC_SCHEMA` có đổi không? | **NO** (vẫn = 2) |
| Account storage có bị reset không? | **NO** |
| Permission customizations có bị reset không? | **NO** (merge giữ nguyên, verify test J) |
| Business data có bị reset không? | **NO** |

---

*Hết báo cáo STEP A. Dừng lại — không tự làm STEP B, không tự nối biểu giá vào khoản phải thu.*

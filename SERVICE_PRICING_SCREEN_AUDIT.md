# SERVICE_PRICING_SCREEN_AUDIT — Tách "Cấu hình giá dịch vụ" sang nhóm Tài chính

> Báo cáo thuần audit + thiết kế. **Không có code nào bị sửa.** Mọi khẳng định dẫn trực tiếp
> file/function/dòng code cụ thể. Đã đọc toàn bộ `js/serviceconfig.js`, `js/v-vanhanh.js` (toàn bộ
> khối "Cấu hình dịch vụ", dòng ~480-845), `js/permissions.js`, `js/core.js`, `js/accounts.js`,
> `index.html`; đối chiếu chéo có mục tiêu với `js/v-taichinh.js`, `js/v-tieuthuong.js`, `data.js`
> bằng grep để xác nhận chỗ dữ liệu giá THẬT SỰ được dùng để tính tiền.

---

## 1. Current UI structure

Menu hiện tại (`core.js A.MENU`, dòng 394-424):

```
Vận hành
  su-co, thong-bao, bao-cao, tai-khoan, cai-dat
```

`cai-dat` (label "Cài đặt & phân quyền") có 4 sub-tab nội bộ (`SETTINGS_TABS`,
`v-vanhanh.js:476`): `dongia` ("Cấu hình dịch vụ"), `vaitro` ("Vai trò & phân quyền"), `tichhop`
("Tích hợp"), `nhatky` ("Nhật ký kiểm toán"). Tab `dongia` lại có **5 sub-sub-tab riêng**
(`CFG_TABS`, `v-vanhanh.js:849`): `gia` ("Đơn giá mặt bằng"), `dien-nuoc` ("Điện & nước"),
`dich-vu` ("Dịch vụ khác"), `ky-thu` ("Kỳ thu"), `quy-tac` ("Quy tắc thu phí") — router tại
`settingsDongiaHtml()` (`v-vanhanh.js:850-859`).

Nhóm "Tài chính" hiện tại (`core.js:407-413`):
```
dien-nuoc, phai-thu, thu-tien, doi-soat, cong-no
```
Hoàn toàn tách biệt — không màn Tài chính nào tham chiếu tới `dongia`/`CFG_TABS`.

`screen:cai-dat` chỉ `system_admin` có (`permissions.js`, `screenRoles['cai-dat'] = ['system_admin']`)
→ hiện tại **chỉ system_admin** vào được UI "Cấu hình dịch vụ" (kể cả 5 sub-sub-tab bên trong),
đúng đề bài mô tả "cấu hình dịch vụ đang nằm trong Cài đặt".

---

## 2. Current pricing data model

Module riêng `js/serviceconfig.js` — `A.SERVICE_CFG`, lưu `localStorage['choso-caolanh-serviceconfig']`
(`SKEY`, dòng 10), **hoàn toàn độc lập với `data.js`** (tự khai báo ở dòng 1-6:
*"Module này ĐỘC LẬP với data.js — KHÔNG đọc/ghi D.UNIT, D.SESSION_FEE, D.ELEC, D.WATER"*).

5 collection trong `CFG` (`defaultConfig()`, dòng 16-46):

| Collection | Field chính | Có `marketId`? |
|---|---|---|
| `stallPrices[]` | `marketId, area, stallType, amount, unit, effectiveFrom, effectiveTo, status, legalBasis, attachments, history` | Có — luôn 1 giá trị `'CL'`/`'TTD'` cụ thể (form chỉ cho chọn 1 trong 2, `v-vanhanh.js:648`) |
| `utilities[]` | `marketId, elecPrice, waterPrice, effectiveFrom, status, legalBasis, ...` | Có — cùng dạng single-market |
| `extraServices[]` | `name, marketId, calcMethod, amount, unit, effectiveFrom, status, ...` | Có — **NHƯNG cho phép `marketId:'ALL'`** (seed "Gửi xe", dòng 31; form có option `value="ALL"`, dòng 661) |
| `billingCycle` (object đơn, không phải mảng) | `cycle, meterCutoffDay, issueDay, dueDay, reminder1Days, reminder2Days, autoIssue, autoRemind` | **Không** — 1 cấu hình chung toàn hệ thống, không theo chợ |
| `billingRules` (object đơn) | `allowAdjust, allowWaiver, requireReason, waiverApprovalThreshold, approverRoleId, allowPartialPay, allowVoidReceipt, requireNoteOnAdjust` | **Không** |

**Phát hiện quan trọng — `marketId:'ALL'` ở đây là 1 quy ước KHÁC, KHÔNG liên quan** tới
`Account.marketScopes:['ALL']` (legacy, đã audit/xử lý ở Phase 5A/5B). Giá trị này **không hề đi
qua `A.allowedMarkets()`** — không có validation, không có cơ chế "diễn giải thành CL+TTD" nào cả,
chỉ là 1 chuỗi được so sánh trực tiếp (`r.marketId === 'ALL' ? 'Tất cả chợ' : U.mShort(r.marketId)`,
dòng 609). Cần tránh nhầm lẫn 2 khái niệm "ALL" này khi thiết kế Phase 6.

**Phát hiện — `billingRules.approverRoleId` mặc định là `'bql'`** (dòng 40,
`serviceconfig.js`) — đây là role ID **cũ, đã bị thay thế hoàn toàn từ Phase 1 RBAC V1** (8 role
hiện tại không có `'bql'`). Select `br-approver` (`v-vanhanh.js:831`) lặp `A.PERM.roles()` (8 role
V1) nên giá trị lưu sẵn `'bql'` không khớp option nào — 1 tham chiếu mồ côi từ trước RBAC V1, chưa
từng được dọn.

---

## 3. Current pricing handlers

Tất cả qua `A.SERVICE_CFG` API (`serviceconfig.js:59-105`): `add/update/setStatus/updateCycle/
updateRules/addAttachment/removeAttachment`. Handler UI tương ứng trong `v-vanhanh.js`:

| Hành động | Handler | Re-check permission trong handler? |
|---|---|---|
| Thêm đơn giá mặt bằng | `A.ACT['cfg-price-new']` (551) → `A.ACT['cfg-form-save']` (698) | **KHÔNG** |
| Sửa đơn giá mặt bằng | `A.ACT['cfg-price-edit']` (552) → `cfg-form-save` | **KHÔNG** |
| Vô hiệu hoá/kích hoạt | `A.ACT['cfg-price-toggle']` (557) | **KHÔNG** |
| Thêm/sửa/toggle điện nước | `cfg-util-new/edit/toggle` (590-600) | **KHÔNG** |
| Thêm/sửa/toggle dịch vụ khác | `cfg-svc-new/edit/toggle` (629-639) | **KHÔNG** |
| Sửa kỳ thu (7 field) | `bc-cycle/cutoff/issue/due/r1/r2/autoissue/autoremind` (808-815) | **KHÔNG** |
| Sửa quy tắc thu phí (8 field) | `br-adjust/waiver/reason/partial/void/noteadjust/threshold/approver` (839-846) | **KHÔNG** |
| Thêm/xoá tài liệu đính kèm | `cfg-att-add`/`cfg-att-del` (721+) | **KHÔNG** |
| Sửa căn cứ pháp lý | `cfg-editlegal`-liên quan | **KHÔNG** |

**Toàn bộ ~30 handler của module này chỉ được gate ở TẦNG UI** — biến `canManage = cfgCan(action)`
(`cfgCan()`, dòng 482: `A.PERM.canAction(ui.role, 'cai-dat.' + action)`) chỉ quyết định NÚT có
render hay không (`${canManage ? '<button ...>' : ''}`). **Không một handler nào trong danh sách
trên tự gọi lại `cfgCan()`/`A.canDo()` trước khi ghi dữ liệu** — khác hẳn pattern dual-gate
(UI-gate + handler-gate) đã áp dụng nhất quán cho mọi action khác trong toàn app từ Phase 4B (xem
`PHASE4_ACTION_AUDIT.md`, `PHASE4B` report). Đây là do quyết định phạm vi tại Phase 4B: khi đó,
"Cấu hình dịch vụ" chỉ cần SỬA SEED role (`cai-dat.gia-*` từ `market_manager` sai về đúng
`system_admin`), **không mở rộng handler-gate cho các key `cai-dat.gia-*` này** — quyết định đó
được ghi lại nguyên văn trong báo cáo Phase 4B mục "service-config's ~30 handlers get seed-correction
only, not new handler-gates". Ở thời điểm đó hợp lý vì CHỈ `system_admin` (role duy nhất luôn có
`marketScopes:['ALL']`) có quyền — không có rủi ro cross-market. **Giả định này sẽ KHÔNG còn đúng**
nếu `market_manager` (thường bị giới hạn 1 chợ) được cấp quyền quản lý giá — xem mục 8/18.

---

## 4. Current pricing permissions

`permissions.js` CATALOG (dòng 87-91) — 5 action key hiện có, tất cả `group: 'Vận hành'`,
`screenId: 'cai-dat'`:

```
action:cai-dat.gia-mat-bang   → ['system_admin']
action:cai-dat.gia-dien-nuoc  → ['system_admin']
action:cai-dat.dich-vu-khac   → ['system_admin']
action:cai-dat.ky-thu         → ['system_admin']
action:cai-dat.quy-tac-thu-phi → ['system_admin']
```

(xác nhận trong `actionRoles`, `permissions.js` mục 3 — 5 key này là 5/5 trong nhóm 5 permission
`cai-dat.*` "pre-existing" mà Phase 4B chỉ sửa seed, không mở handler-gate — xem mục 3). Không có
key `screen:cau-hinh-gia` hay bất kỳ key nào mang tên "tai-chinh"/"gia" độc lập — toàn bộ đang nằm
dưới namespace `cai-dat`.

---

## 5. Current market behavior

**Không có filter theo market ở bất kỳ đâu trong UI này**:
- `settingsGiaHtml()` (524): `rows = A.SERVICE_CFG.list('stallPrices')` — lấy **TOÀN BỘ** bản ghi,
  cả CL lẫn TTD, hiển thị chung 1 bảng (cột "Chợ" chỉ để hiển thị, không dùng để lọc).
- `settingsDienNuocHtml()` (565): tương tự, `A.SERVICE_CFG.list('utilities')` không lọc.
- `settingsDichVuHtml()` (604): tương tự.
- Không có đối chiếu nào với `ui.market`/`A.allowedMarkets(A.currentAccount())`/`U.inM()` trong
  toàn bộ file `serviceconfig.js` (0 kết quả grep `ui.market`/`allowedMarkets` trong file này).
- `cfgCan()` (482) chỉ kiểm `A.PERM.canAction(ui.role, ...)` — **không nhận `targetMarket`**, khác
  hẳn `A.canDo(actionKey, targetMarket)` (core.js) mà mọi action khác trong app đã dùng từ Phase 4B.

Hệ quả: hiện tại **vô hại** (chỉ `system_admin`, luôn `marketScopes:['ALL']`, chạm được màn này) —
nhưng đây là 1 gap kiến trúc thật sự cần lấp khi đổi chủ sở hữu nghiệp vụ sang `market_manager`
(xem mục 11/13/18).

---

## 6. Current relationship with meter readings

**Không có liên kết code nào.** Xác nhận bằng grep `D.ELEC|D.WATER` toàn bộ `js/`:

- `js/v-taichinh.js:103` (màn `dien-nuoc`, dòng chú thích hiển thị ngay trên UI cho người dùng
  xem): *"Đơn giá mẫu {ELEC}/kWh · {WATER}/m³ **chỉ để tham khảo trên màn này, không dùng để tính
  khoản phải thu**."* — chính code hiện tại đã tự công khai xác nhận điều này.
- `js/v-taichinh.js:270-271` (`A.ACT['pt-issue']`, nơi THẬT SỰ tính tiền điện/nước cho khoản phải
  thu): `amount: kwh * D.ELEC`, `amount: m3 * D.WATER` — đọc thẳng hằng số `data.js:16-17`
  (`const ELEC = 3200`, `const WATER = 12000`), **không hề gọi `A.SERVICE_CFG.list('utilities')`**.
- `js/serviceconfig.js:590` (`cfg-util-new`) chỉ MƯỢN `D.ELEC`/`D.WATER` làm giá trị KHỞI TẠO mặc
  định cho form nhập liệu — 1 chiều, không đồng bộ ngược.

→ Chỉ số điện nước ghi ở màn `dien-nuoc` (`A.CH.reading`, `A.db.readings`) hoàn toàn không đọc
`A.SERVICE_CFG.utilities` khi tính sản lượng → tiền; luồng "B. Điện nước" mô tả ở đề bài mục 3
**tồn tại một phần** (chỉ số cũ/mới → sản lượng, đã có ở `data.js`/`v-taichinh.js`) nhưng **KHÔNG
nhân với "biểu giá đang có hiệu lực" lấy từ `A.SERVICE_CFG`** — nhân với hằng số tĩnh.

---

## 7. Current relationship with receivables

Tương tự mục 6, xác nhận thêm 2 điểm:

- **Giá mặt bằng**: `A.ACT['ct-new-save']` (`v-tieuthuong.js:203`) —
  `const unit = st.type === 'phien' ? D.SESSION_FEE : D.UNIT[st.type];` — đọc `data.js:13,15`
  (`UNIT = {kiot:2000, nhalong:2000, ngoai:800}`, `SESSION_FEE = 20000`), **không đọc
  `A.SERVICE_CFG.stallPrices`**. Giá mặt bằng được "khoá" vào hợp đồng tại thời điểm tạo
  (`c.unit`, `c.monthly` lưu trong `contracts[]`) — hoàn toàn tách khỏi module giá.
- **Dịch vụ khác**: `pt-issue` (`v-taichinh.js:241-269`) build `items[]` chỉ gồm phí mặt bằng +
  điện + nước — **không có bước nào cộng thêm `extraServices`** (Vệ sinh/Bảo vệ/Gửi xe...) vào
  khoản phải thu. Luồng "C. Dịch vụ khác → Phí dịch vụ" ở đề bài mục 3 **hoàn toàn chưa tồn tại**
  trong code tính tiền — chỉ tồn tại dưới dạng UI mock ở `settingsDichVuHtml()`.
- **Kỳ thu**: `pt-issue` hardcode literal `period: '2026-10'`, `issued: '2026-10-01'`,
  `due: '2026-10-15'` (`v-taichinh.js:274`), và `db.billingPeriods.push({..., dueDate:
  '2026-10-15', ...})` (dòng 280) — không đọc `A.SERVICE_CFG.cycle().issueDay/dueDay/meterCutoffDay`.
  Giá trị mock trùng ngẫu nhiên với seed mặc định (`issueDay:1, dueDay:15`) khiến de giống như đã
  nối, nhưng đổi `bc-issue`/`bc-due` trên UI **không ảnh hưởng gì** tới lần phát hành kế tiếp.
- **Quy tắc thu phí**: `A.ACT['inv-adjust-save']` (`v-taichinh.js`, đã audit ở Phase 4B) tự tính
  `value = Math.round(base * pctv / 100 / 1000) * 1000` với `pctv` chọn thủ công từ 1 `<select>`
  cố định (10/30/50/100) — không đọc `billingRules.allowWaiver`/`waiverApprovalThreshold`/
  `approverRoleId`. `A.ACT['pay-confirm']` không đọc `allowPartialPay`. Xác nhận bằng grep — 0 kết
  quả cho các field này trong `v-taichinh.js`.

**Kết luận trung tâm của toàn bộ audit này**: luồng "CẤU HÌNH GIÁ → Mặt bằng/Điện nước/Dịch vụ →
Khoản phải thu → Thu tiền → Đối soát → Công nợ" mô tả ở đề bài mục 3 **CHƯA được nối ở bất kỳ mắt
xích nào**. `A.SERVICE_CFG` hiện tại là **UI mock thuần tuý, cô lập hoàn toàn** — di chuyển màn
hình sang nhóm Tài chính (mục 5 đề bài) là thay đổi ĐÚNG hướng nghiệp vụ, nhưng **không tự động
làm cho giá "có tác dụng"** tính tiền; đó là 1 khối việc RIÊNG, lớn hơn nhiều, ngoài phạm vi 1 lần
di chuyển màn hình.

---

## 8. Problems with current design

1. **[BLOCKER-adjacent — kiến trúc]** Toàn bộ `A.SERVICE_CFG` không kết nối với luồng tính tiền
   thật (`data.js` hằng số tĩnh + literal hardcode trong `pt-issue`/`ct-new-save`) — xem mục 6/7.
   Không phải bug do lần audit này gây ra, đã vậy từ khi module ra đời; nhưng BẮT BUỘC phải nêu rõ
   trước khi đổi vị trí menu, tránh tạo cảm giác "giờ nó đã là cấu hình thật".
2. **[Gap RBAC]** 0/30 handler của module có handler-level permission re-check — chỉ UI-gate. Nếu
   giữ nguyên khi mở quyền cho `market_manager`, đây là lỗ hổng thật (không còn được che bởi việc
   "chỉ system_admin chạm tới") — 1 tài khoản `market_manager` (hoặc bất kỳ ai forge gọi thẳng
   `A.ACT`/`A.CH` qua console) có thể sửa giá ngay cả khi checkbox `cai-dat.phan-quyen` bị thu hồi
   quyền tương ứng, miễn UI đã render sẵn (hoặc bằng cách gọi tay).
3. **[Gap market scope]** Không filter theo market ở list, không check market ở handler — nếu
   `market_manager` có `marketScopes:['CL']` được cấp quyền, họ vẫn nhìn thấy VÀ (nếu forge handler)
   sửa được giá của TTD. Vi phạm nguyên tắc `Account.marketScopes` là nguồn enforce duy nhất.
4. **[Naming]** Permission key `cai-dat.gia-mat-bang`/`cai-dat.gia-dien-nuoc`/`cai-dat.dich-vu-khac`
   mang tiền tố `cai-dat` dù nghiệp vụ đang đề xuất chuyển hẳn sang Tài chính — tên quyền không còn
   phản ánh đúng vị trí/chủ sở hữu nghiệp vụ.
5. **[Dữ liệu mồ côi]** `billingRules.approverRoleId` mặc định `'bql'` — role ID tiền-RBAC-V1,
   không khớp bất kỳ role nào hiện có (mục 2).
6. **[Không versioning an toàn]** `A.SERVICE_CFG.update()` (`serviceconfig.js:72-77`) làm
   `Object.assign(r, patch)` — **ghi đè trực tiếp lên đúng bản ghi cũ**, không tạo bản ghi mới theo
   `effectiveFrom` mới. `effectiveTo` tồn tại trong shape (`stallPrices[].effectiveTo`) nhưng
   **không có bất kỳ chỗ nào trong code set giá trị này** (luôn `null`, kể cả sau khi tạo bản ghi
   mới hay vô hiệu hoá bản ghi cũ) — nghĩa là hiện tại đổi giá = sửa thẳng bản ghi đang có, không
   phải "đóng bản ghi cũ, mở bản ghi mới". Nếu sau này nối vào `pt-issue`, sửa giá sẽ **hồi tố**
   ảnh hưởng tới việc tính lại giá hiển thị cho các kỳ đã phát hành trước đó nếu `pt-issue` (hoặc
   bất kỳ màn nào) đọc lại record theo `id` thay vì snapshot giá tại thời điểm phát hành. Hiện tại
   vô hại (vì chưa nối), nhưng PHẢI thiết kế lại theo hướng version-by-effective-date trước khi nối
   thật — đánh dấu GAP theo đúng yêu cầu mục 8 đề bài.
7. **[extraServices `marketId:'ALL'`]** dùng riêng, không qua `A.allowedMarkets()`, dễ nhầm với
   quy ước `Account.marketScopes` — cần làm rõ ngữ nghĩa khi thiết kế lại (mục 2).
8. **[Kỳ thu / Quy tắc thu phí không có `marketId`]** — 2 khối cấu hình toàn hệ thống, không theo
   chợ — cần xác nhận đây có đúng ý đồ nghiệp vụ không (mục 15/16), vì các chợ CL/TTD có mô hình
   thu phí khác biệt hẳn (CL: kỳ hằng tháng qua hợp đồng; TTD: theo phiên chợ Thứ Bảy — xem
   `A.ACT['session-save']`, `v-dieuhanh.js`, hoàn toàn không dùng `billingCycle`/`billingRules`).

---

## 9. Proposed new screen

**Khả thi, không có trở ngại kỹ thuật.** Kiến trúc hiện tại (`A.MENU`, `A.VIEWS`, `A.SCREEN_MARKET`,
`A.PERM.CATALOG`) đã được thiết kế để mở rộng screen mới mà không cần đổi shape (đã làm nhiều lần
qua Phase 1-5B). Đề xuất:

- Screen id: `cau-hinh-gia` (khớp gợi ý đề bài).
- Tên hiển thị: **"Cấu hình giá dịch vụ"**.
- `A.VIEWS['cau-hinh-gia']`: tái sử dụng gần như nguyên vẹn `settingsGiaHtml()` +
  `settingsDienNuocHtml()` + `settingsDichVuHtml()` (chỉ 3 tab, đúng đề bài mục 5 — **không** mang
  theo `ky-thu`/`quy-tac`), dưới dạng router nội bộ giống `CFG_TABS` hiện tại nhưng rút còn 3 phần
  tử.
- `A.SCREEN_MARKET['cau-hinh-gia']`: đề xuất `'BOTH'` (giống `phai-thu`/`thu-tien`/`doi-soat`/
  `cong-no`) — vì cả `stallPrices`/`utilities` đều có bản ghi riêng cho từng chợ cụ thể (CL và
  TTD), và `market_manager` cần chọn đúng `selectedMarket` để thao tác đúng phạm vi (mục 13),
  **không** dùng `'CL'` (như `dien-nuoc`) vì TTD cũng có `stallPrices` (quầy theo phiên) cần cấu
  hình.
- `A.SERVICE_CFG` (module dữ liệu) **giữ nguyên, không đổi** — chỉ đổi NƠI RENDER UI, đúng tinh
  thần "không phá kiến trúc". `stallPrices`/`utilities`/`extraServices` tiếp tục dùng chung 1 kho
  dữ liệu; chỉ khác là bây giờ list/form cần thêm điều kiện lọc theo `ui.market` (xem mục 13).

---

## 10. Proposed menu position

```
Tài chính
  cau-hinh-gia   ← "Cấu hình giá dịch vụ" (MỚI, đặt đầu tiên — đúng thứ tự luồng nghiệp vụ mục 3 đề bài)
  dien-nuoc      ← "Ghi chỉ số điện, nước" (giữ nguyên tên/vị trí tương đối)
  phai-thu
  thu-tien
  doi-soat
  cong-no
```

Thực thi (khi sang Phase implement, KHÔNG làm ở đây): thêm 1 phần tử vào mảng `items` của group
`'Tài chính'` trong `A.MENU` (`core.js:407-413`), đặt trước `dien-nuoc`. Không đổi group
`'Vận hành'` ngoài việc xoá tab `dongia` khỏi `SETTINGS_TABS` (`v-vanhanh.js:476`, còn lại
`vaitro`/`tichhop`/`nhatky`).

---

## 11. Proposed RBAC

Theo đúng mong muốn nghiệp vụ ở đề bài mục 6, đối chiếu 8 role hiện có:

| Role | Screen `cau-hinh-gia` | Action sửa/thêm/vô hiệu hoá giá |
|---|---|---|
| `market_manager` | Có | Có (3 action mới) |
| `accountant` | Có | **Không** (chỉ xem) |
| `ward_leader` | Có (nếu xác nhận phù hợp mô hình giám sát — xem NEED_CONFIRMATION) | Không |
| `market_staff` | Không (mặc định) | Không |
| `collector` | Không | Không |
| `technician` | Không | Không |
| `trader` | Không | Không |
| `system_admin` | Không mặc định (không tự động vì là admin hệ thống — đúng nguyên tắc đã chốt xuyên suốt Phase 4B/5B) | Không |

**Phương án action key — đề xuất B (namespace mới), có lý do rõ ràng, không chỉ vì "đẹp tên"**:

Đổi từ `cai-dat.gia-mat-bang` / `cai-dat.gia-dien-nuoc` / `cai-dat.dich-vu-khac` sang:

```
cau-hinh-gia.mat-bang
cau-hinh-gia.dien-nuoc
cau-hinh-gia.dich-vu-khac
```

Lý do chọn B thay vì A (giữ nguyên `cai-dat.*`):
- `permKey` trong `CATALOG` đã có field `screenId` (`permissions.js:87-91`) — nếu vẫn giữ
  `screenId:'cai-dat'` cho 1 action nhưng screen thật sự đã chuyển sang `cau-hinh-gia`, dữ liệu tự
  mâu thuẫn (permission label sẽ tự gắn nhầm tag màn hình — xem `permsMatrixHtml()` Phase 5B, dùng
  `A.menuItem(p.screenId).label` làm tên nhóm hiển thị — nếu để `screenId:'cai-dat'`, action giá sẽ
  bị xếp nhầm vào nhóm "Cài đặt & phân quyền" trong UI phân quyền, dù screen thật đã đổi).
- Giữ tên `cai-dat.*` sau khi rời khỏi Cài đặt sẽ gây hiểu nhầm y hệt vấn đề "Phạm vi dữ liệu" mà
  Phase 5A/5B vừa dọn cho Role — lặp lại đúng loại lỗi vừa sửa.
- 3 key MỚI hoàn toàn (không tái dùng `cai-dat.gia-*`) tránh trường hợp 1 permKey cũ vẫn tồn tại
  trong `rolePerms` đã lưu của trình duyệt admin (tự động cấp lại quyền cũ cho `system_admin` theo
  đúng key cũ — không sao vì action cũ sẽ bị xoá khỏi `CATALOG`) nhưng KHÔNG map sang key mới —
  admin phải grant lại tường minh cho `market_manager`/`accountant` theo đúng default seed mới,
  **không suy luận ngầm "đổi tên = giữ nguyên ai đang có quyền"**.
- **Tránh trùng lặp/permission song song**: 3 key `cai-dat.gia-*` cũ **phải bị xoá khỏi `CATALOG`**
  (không giữ lại song song 2 bộ key cho cùng 1 hành động) — nếu không sẽ có 2 permission độc lập
  điều khiển cùng 1 hành động thực tế (`cfgCan()`/handler chỉ có thể đọc 1 trong 2), vi phạm đúng
  điều đề bài mục 6 yêu cầu tránh ("permission duplicate", "permission system song song").
- `cai-dat.ky-thu`/`cai-dat.quy-tac-thu-phi` **giữ nguyên namespace `cai-dat`** vì 2 tab này KHÔNG
  di chuyển màn hình ở lần này (mục 15/16) — namespace của chúng vẫn khớp đúng vị trí UI thật.

**accountant xem read-only**: dùng đúng pattern `screen:cau-hinh-gia` (được vào màn) NHƯNG không có
3 action `cau-hinh-gia.*` (không thấy nút Thêm/Sửa/Vô hiệu hoá) — giống hệt pattern read-only đã
áp dụng cho `ward_leader` ở màn Đối soát (`doi-soat.xem-ngan-hang` có nhưng `doi-soat.gan-thu-cong`
không) — tái dùng đúng pattern đã có, không cần cơ chế mới.

---

## 12. Proposed permission migration strategy

Đổi `CATALOG` (thêm 3 key mới `cau-hinh-gia.*`, xoá 3 key cũ `cai-dat.gia-*`) và đổi
`screenRoles`/`actionRoles` mặc định (thêm `screen:cau-hinh-gia`, gán default cho
`market_manager`/`accountant`/(`ward_leader`?)) — đây **CHÍNH LÀ** loại thay đổi mà
`PHASE5A_ACCOUNT_ROLE_SCOPE_AUDIT.md` mục 12 đã dự liệu trước ("khi 1 phase sau này thật sự cần
thêm/bớt permission key... bắt buộc bump `PERM_SEED_VERSION`") — **BẮT BUỘC bump `PERM_SEED_VERSION`
(3 → 4)** khi implement thật (không thực hiện ở audit này).

Đề xuất áp dụng đúng chiến lược merge đã thiết kế ở Phase 5A/5B (comment hiện có ngay trên
`PERM_SEED_VERSION` trong `permissions.js`) thay vì reseed toàn bộ — cụ thể cho lần đổi này:
- Merge giữ nguyên MỌI `rolePerms` hiện có cho các permKey KHÔNG đổi (toàn bộ 45 action key khác +
  17 screen key khác — không đụng).
- 3 permKey MỚI (`action:cau-hinh-gia.mat-bang/dien-nuoc/dich-vu-khac`) + `screen:cau-hinh-gia`:
  thêm grant mặc định theo bảng mục 11.
- 3 permKey CŨ (`action:cai-dat.gia-mat-bang/gia-dien-nuoc/dich-vu-khac`): xoá khỏi `CATALOG` và
  khỏi mọi `rolePerms` đã lưu (kể cả tuỳ biến admin đã grant/revoke cho 3 key này) — đây là hành
  động MẤT dữ liệu tuỳ biến có chủ đích, chấp nhận được vì bản chất hành động (tên quyền) đã đổi
  hẳn ý nghĩa vị trí, không phải 1 lần đổi UI đơn thuần.
- `cai-dat.ky-thu`/`cai-dat.quy-tac-thu-phi`: **không đổi**, giữ nguyên `rolePerms` hiện có.

Không thực hiện bất kỳ thay đổi nào ở trên trong audit này — chỉ ghi lại chiến lược cho lần
implement.

---

## 13. Market-scope rules

Đề xuất (khi implement, không làm ở đây):
- `A.VIEWS['cau-hinh-gia']` và 3 renderer con (`settingsGiaHtml`/`settingsDienNuocHtml`/
  `settingsDichVuHtml` phiên bản mới): lọc `rows` theo
  `r.marketId === ui.market || r.marketId === 'ALL'` (giữ đúng ngữ nghĩa `extraServices` hiện có,
  mục 2) thay vì lấy toàn bộ không lọc — đúng bất biến `SelectedMarket` (mục 6.1 đề bài).
- Form thêm/sửa (`renderCfgForm`): field "Chợ" (`cf-market`) cho `stallPrices`/`utilities` nên
  **khoá cứng vào `ui.market` hiện tại** (không cho chọn tự do sang chợ khác) khi tạo mới từ màn
  này — nhất quán với cách `dien-nuoc`/`phai-thu` luôn thao tác trong phạm vi `selectedMarket`.
  `extraServices` vẫn có thể giữ lựa chọn `'ALL'` (áp dụng cả 2 chợ) như hiện tại — đây là 1 chọn
  lựa nghiệp vụ hợp lý riêng của loại dữ liệu này, không phải lỗi.
- Handler `cfg-form-save`/`cfg-*-toggle`/`cfg-att-*`: thêm re-check
  `A.canDo('cau-hinh-gia.<x>', targetMarket)` với `targetMarket = record.marketId` (nếu
  `record.marketId !== 'ALL'`) TRƯỚC khi ghi — lấp đúng gap mục 8.2/8.3, theo đúng pattern
  `A.canDo(actionKey, targetMarket)` đã dùng cho mọi action khác từ Phase 4B.
- **Không hard-code market theo Role** — không có bất kỳ điều kiện `if (ui.role ===
  'market_manager') mid = 'CL'` nào; mọi kiểm tra market đều qua `A.allowedMarkets(currentAccount())`
  / so khớp `ui.market`, đúng nguyên tắc xuyên suốt Phase 2-5B.
- **Không dùng `'ALL'` làm `selectedMarket`** — `ui.market` tiếp tục luôn là `'CL'`/`'TTD'` cụ thể
  (bất biến `A.syncAccountContext()`, không đổi).

---

## 14. Pricing/effective-date/history considerations

Model hiện tại **CÓ MỘT PHẦN** cơ chế hiệu lực/lịch sử, nhưng chưa đủ an toàn cho việc nối vào tính
tiền thật (đã nêu ở mục 8.6):

| Có sẵn | Chưa có / GAP |
|---|---|
| `effectiveFrom` (ngày hiệu lực bắt đầu) | `effectiveTo` tồn tại trong shape nhưng **không nơi nào set giá trị** — luôn `null` |
| `status: 'active'/'inactive'` (vô hiệu hoá thủ công) | Không có khái niệm "nhiều bản ghi cùng 1 khu vực/loại điểm, khác `effectiveFrom`, hệ thống tự chọn bản đang hiệu lực theo ngày" — hiện tại 1 `(marketId, area, stallType)` chỉ có ĐÚNG 1 bản ghi sống, sửa = ghi đè |
| `legalBasis` (căn cứ pháp lý — số văn bản, ngày ban hành, cơ quan, trích yếu) | Đầy đủ, không có gap |
| `attachments[]` (tài liệu đính kèm, mock không upload server) | Đầy đủ, không có gap |
| `history[]` (nhật ký thay đổi dạng text tự do: `{time, user, action, detail}`) | Chỉ là **audit trail hiển thị**, KHÔNG phải version log có thể dùng để tra cứu "giá tại ngày X là bao nhiêu" — `detail` là chuỗi tự do (`'2.000 đ/m²/ngày'`), không structured, không tái sử dụng được để tính toán |
| — | **Không có cơ chế "khoá giá tại thời điểm phát hành"** — nếu nối vào `pt-issue` mà không snapshot giá vào từng `invoice.items[]` (hiện `pt-issue` ĐÃ tự làm điều này đúng cách cho điện/nước — snapshot `amount` tính sẵn vào `items`, không lưu tham chiếu `priceId` sống — nên về nguyên tắc AN TOÀN nếu áp dụng đúng pattern này khi nối `A.SERVICE_CFG` sau này) |

**Điểm tích cực đáng ghi nhận**: cách `pt-issue` hiện xử lý điện/nước (snapshot `amount` đã nhân
sẵn vào `items[]` của từng invoice, không lưu con trỏ sống tới bảng giá) **chính là pattern đúng**
để tránh hồi tố — nếu Phase sau nối `A.SERVICE_CFG` vào `pt-issue`, chỉ cần tiếp tục snapshot theo
đúng cách này (đọc giá tại thời điểm phát hành, ghi số tiền đã tính vào invoice, không lưu tham
chiếu ngược tới `stallPrices`/`utilities` record) thì vấn đề "sửa giá cũ làm sai khoản đã phát
hành" **tự động không xảy ra** — dù vậy, UI "Cấu hình giá dịch vụ" vẫn nên hiển thị rõ cảnh báo
"sửa giá chỉ áp dụng cho lần phát hành tiếp theo, không hồi tố" để tránh admin hiểu nhầm, và vẫn
nên bổ sung version-by-effective-date thật sự (thay vì ghi đè) nếu nghiệp vụ cần tra cứu "biểu giá
tại 1 ngày trong quá khứ" — đánh dấu GAP, không thiết kế chi tiết ở đây (ngoài phạm vi 1 lần audit
UI).

---

## 15. Recommendation for "Kỳ thu"

**Đề xuất: (A) ở lại Cài đặt, GIỮ NGUYÊN vị trí hiện tại** — lý do:

- Nội dung thật sự cấu hình (`meterCutoffDay`, `issueDay`, `dueDay`, `reminder1Days/2Days`,
  `autoIssue`, `autoRemind`) là tham số **vận hành chu trình phát hành** áp dụng thống nhất, không
  gắn với 1 biểu giá cụ thể nào và **không có `marketId`** (mục 2/8.8) — bản chất gần "cấu hình quy
  trình hệ thống" hơn là "giá dịch vụ".
- Không có liên kết nào với 3 loại giá (`stallPrices`/`utilities`/`extraServices`) — gộp chung màn
  "Cấu hình giá dịch vụ" sẽ làm màn mới lẫn lộn 2 loại cấu hình khác bản chất (giá tiền vs. lịch
  trình), đi ngược đúng tinh thần "tách rõ" mà đề bài đang theo đuổi (giống việc Phase 5B vừa tách
  Screen/Action Permission).
- **Vấn đề thực tế đã phát hiện ở mục 8.8**: CL và TTD có mô hình thu phí khác hẳn nhau (CL theo kỳ
  hằng tháng qua hợp đồng; TTD theo phiên chợ quê, không đi qua `billingCycle` ở bất kỳ đâu — xác
  nhận `A.ACT['session-save']` trong `v-dieuhanh.js` không đọc `A.SERVICE_CFG` chút nào) — nghĩa là
  `billingCycle` hiện tại **thực chất chỉ áp dụng cho CL**, dù không có `marketId` khai báo tường
  minh. Đây là điểm **NEED_CONFIRMATION** (mục 20) trước khi quyết định vị trí lâu dài — nhưng
  KHÔNG cản trở khuyến nghị "giữ ở Cài đặt cho lần audit này", vì dù đặt ở đâu, bản thân cấu hình
  cũng cần làm rõ phạm vi áp dụng trước.

---

## 16. Recommendation for "Quy tắc thu phí"

**Đề xuất: (A) ở lại Cài đặt, GIỮ NGUYÊN vị trí hiện tại** — lý do:

- Nội dung (`allowAdjust`, `allowWaiver`, `requireReason`, `waiverApprovalThreshold`,
  `approverRoleId`, `allowPartialPay`, `allowVoidReceipt`, `requireNoteOnAdjust`) là **quy tắc
  nghiệp vụ/quy trình phê duyệt** (ai được duyệt, ngưỡng bao nhiêu %, có bắt buộc lý do không) —
  gần với "chính sách quản trị" hơn là "bảng giá".
- Gắn trực tiếp với khái niệm **Role** (`approverRoleId`) — đặt cạnh "Vai trò & phân quyền" (cùng
  trong Cài đặt) hợp lý hơn đặt cạnh 3 bảng giá thuần số liệu.
- **Không có `marketId`**, và không có bằng chứng trong code cho thấy quy tắc này cần khác nhau
  giữa CL/TTD (không giống mục 15, ở đây chưa phát hiện xung đột nghiệp vụ nào giữa 2 chợ).
- Cũng **chưa được nối** vào `inv-adjust-save`/`pay-confirm` (mục 7) — dời màn hình không giải
  quyết gì cho việc "có tác dụng thật", nên ưu tiên giữ nguyên, tránh di chuyển 2 lần (1 lần bây
  giờ, 1 lần nữa nếu sau này quyết định nối logic thật và phát hiện vị trí phù hợp hơn).

**Cả 2 mục 15/16 đều đề xuất (A)** — khác với 3 loại giá (đề xuất di chuyển) vì lý do bản chất dữ
liệu khác nhau rõ ràng: giá gắn liền trực tiếp với `marketId` + số tiền cụ thể (đúng nghĩa "Tài
chính"); kỳ thu/quy tắc là tham số vận hành/chính sách hệ thống, hiện không có tín hiệu nào đủ mạnh
để rời khỏi Cài đặt.

---

## 17. Exact files/functions expected to change (khi implement Phase sau)

| File | Hàm/khối | Thay đổi |
|---|---|---|
| `core.js` | `A.MENU` (394-424) | Thêm `{id:'cau-hinh-gia', ico:'💰'(hoặc icon phù hợp), label:'Cấu hình giá dịch vụ'}` vào đầu `items` của group `'Tài chính'` |
| `core.js` | `A.SCREEN_MARKET` (241-249) | Thêm `'cau-hinh-gia': 'BOTH'` |
| `permissions.js` | `CATALOG` (33-98) | Thêm `screen:cau-hinh-gia` + 3 `action:cau-hinh-gia.*`; xoá 3 `action:cai-dat.gia-*` |
| `permissions.js` | `defaultRolePermissions()` — `screenRoles`/`actionRoles` (141-215) | Thêm grant mặc định theo bảng mục 11; xoá 3 dòng cũ |
| `permissions.js` | `PERM_SEED_VERSION` (253) | Bump 3 → 4 (mục 12) |
| `v-vanhanh.js` | `SETTINGS_TABS` (476) | Xoá phần tử `['dongia', 'Cấu hình dịch vụ']` |
| `v-vanhanh.js` | `CFG_TABS` (849) | Rút còn 3 phần tử (`gia`/`dien-nuoc`/`dich-vu`) cho screen mới; `ky-thu`/`quy-tac` tiếp tục hiển thị trong Cài đặt qua 1 tab-bar riêng (2 phần tử) |
| `v-vanhanh.js` (hoặc file mới, ví dụ `v-cauhinhgia.js` — cân nhắc theo mục 18) | `settingsGiaHtml`/`cfgPriceDrawerHtml`/`cfg-price-*` (523-562) | Di chuyển sang `A.VIEWS['cau-hinh-gia']`; thêm lọc/gate theo market (mục 13) |
| (tương tự) | `settingsDienNuocHtml`/`cfgUtilDrawerHtml`/`cfg-util-*` (564-601) | Di chuyển + gate market |
| (tương tự) | `settingsDichVuHtml`/`cfgSvcDrawerHtml`/`cfg-svc-*` (603-640) | Di chuyển + gate market |
| (tương tự) | `renderCfgForm`/`cfg-form-save` (644-718) | Di chuyển; thêm handler-level `A.canDo` re-check; khoá `cf-market` theo `ui.market` khi tạo mới (mục 13) |
| `v-vanhanh.js` | `settingsKyThuHtml`/`settingsQuyTacHtml` (786-846) | **GIỮ NGUYÊN vị trí trong Cài đặt** (mục 15/16) — không di chuyển |
| `v-vanhanh.js` | `cfgCan()` (482) | Cân nhắc thay bằng `A.canDo('cau-hinh-gia.' + action, targetMarket)` cho 3 hành động giá; giữ nguyên `A.PERM.canAction(ui.role,'cai-dat.'+action)` cho `ky-thu`/`quy-tac-thu-phi` (không đổi tên 2 key này) |
| `serviceconfig.js` | *Không đổi* | Model/API giữ nguyên; chỉ nơi gọi đổi |
| `index.html` | *Không đổi* | Không có markup tĩnh liên quan |

---

## 18. Regression risks

- **Rủi ro cao nhất**: quên xoá 3 permKey cũ `cai-dat.gia-*` khỏi `CATALOG` sau khi thêm 3 key mới
  → tồn tại song song 2 hệ permission cho cùng 1 hành động (đúng điều đề bài mục 6 cảnh báo tránh)
  → `system_admin` (đã có sẵn quyền cũ) vẫn thao tác được qua UI cũ (nếu code cũ chưa xoá hết) mà
  không đi qua permission mới.
- **Rủi ro trung bình**: nếu tách `settingsGiaHtml` v.v. sang `A.VIEWS['cau-hinh-gia']` nhưng quên
  đồng bộ 2 nơi (UI mới trong Tài chính + code cũ còn sót lại trong `CFG_TABS`/Cài đặt) — dữ liệu
  `A.SERVICE_CFG` dùng chung nên không lệch dữ liệu, nhưng dễ để lại "màn ma" (route cũ
  `#/cai-dat` tab `dongia` vẫn còn nếu quên xoá khỏi `SETTINGS_TABS`).
- **Rủi ro thấp nhưng cần chú ý**: nếu thêm handler-level `A.canDo(key, targetMarket)` cho
  `cfg-form-save` mà `targetMarket` lấy từ `d.marketId` khi `d.marketId === 'ALL'` (trường hợp
  `extraServices`) — phải xử lý đúng như "không có target cụ thể" (bỏ qua check market, giống cách
  `phai-thu.phat-hanh` không truyền `targetMarket` vì là hành động toàn hệ thống, xem Phase 4B) —
  KHÔNG được so `'ALL' !== ui.market` rồi chặn nhầm (sẽ khoá luôn `market_manager` hợp lệ khỏi sửa
  dịch vụ áp dụng "Tất cả chợ").
- **Không có rủi ro nào đe doạ** nghiệp vụ tính tiền hiện có (`pt-issue`, `ct-new-save`,
  `inv-adjust-save`) vì các hàm này **không đọc `A.SERVICE_CFG`** (mục 6/7) — di chuyển/đổi
  permission module này an toàn tuyệt đối với luồng thu-chi đang chạy.
- **Rủi ro về kỳ vọng người dùng**: nếu chỉ di chuyển UI mà không làm rõ (qua ghi chú/help text)
  rằng giá vẫn CHƯA có tác dụng tính tiền thật, `market_manager` sau khi được cấp quyền có thể hiểu
  nhầm "tôi vừa đổi giá điện, kỳ tới sẽ tính theo giá mới" — không đúng (mục 6/7). Khuyến nghị thêm
  1 dòng ghi chú rõ ràng trên chính màn `cau-hinh-gia` khi implement (không làm ở audit này).

---

## 19. Implementation test plan (cho Phase sau, không chạy ở audit này)

1. Screen: `market_manager` (marketScopes bất kỳ) vào được `#/cau-hinh-gia`; `market_staff`/
   `collector`/`technician`/`trader` không vào được (hash bị chặn, route fallback đúng).
2. Action: `market_manager` thấy nút Thêm/Sửa/Vô hiệu hoá ở cả 3 tab; `accountant` chỉ thấy nút
   "Xem", không thấy nút sửa.
3. Market scope: `market_manager` với `marketScopes:['CL']` — list chỉ hiển thị bản ghi
   `marketId==='CL'` (+ `'ALL'` của `extraServices`); không thấy/không sửa được bản ghi TTD dù
   forge handler trực tiếp.
4. `market_manager` với `marketScopes:['CL','TTD']` — đổi `selectedMarket` → list đổi theo đúng
   chợ đang chọn.
5. Dynamic RBAC: revoke `cau-hinh-gia.mat-bang` khỏi `market_manager` → nút biến mất; forge gọi
   `cfg-price-toggle` trực tiếp vẫn bị handler chặn (không chỉ ẩn UI).
6. `system_admin` mặc định KHÔNG có 3 action mới (đúng "không tự động business superuser").
7. Migration: seed cũ có `rolePerms` chứa `action:cai-dat.gia-mat-bang` cho `system_admin` → sau
   khi bump `PERM_SEED_VERSION`, key cũ biến mất khỏi `CATALOG`/`rolePerms`; key mới có default
   grant đúng bảng mục 11; **không** reset Account/UI/business data (đúng pattern Phase 5A/5B).
8. `ky-thu`/`quy-tac-thu-phi` vẫn ở đúng vị trí cũ trong Cài đặt, hành vi/permission không đổi.
9. Regression: `node --check` toàn bộ file sửa; render đủ 8 role × các màn liên quan không lỗi
   console; toàn bộ test case Phase 4B/5B (payment, contract OR-logic, admin self-protection...)
   vẫn PASS (không file nào trong `v-taichinh.js`/`v-tieuthuong.js` bị đụng ở thay đổi này).

---

## 20. NEED_CONFIRMATION

1. **`ward_leader` có nên xem read-only màn "Cấu hình giá dịch vụ" không?** Đề bài mục 6 nói "nếu
   phù hợp với mô hình giám sát" — hiện `ward_leader` đã có `screen:doi-soat`/`screen:phai-thu`
   read-only tương tự (đúng vai trò giám sát liên chợ), nên về mặt PATTERN thì hợp lý để nhất
   quán; nhưng đây là quyết định nghiệp vụ (lãnh đạo phường có cần thấy chi tiết biểu giá nội bộ
   BQL hay không), không đủ căn cứ code để tự quyết.
2. **`billingCycle` (Kỳ thu) có thực sự chỉ áp dụng cho CL không?** Code hiện tại không có
   `marketId` nhưng luồng TTD (phiên chợ quê) không hề đọc field này — cần xác nhận nghiệp vụ:
   nếu đúng chỉ áp dụng CL, cấu trúc dữ liệu tương lai cần thêm `marketId` (hoặc tách 1 khối
   `sessionConfig` riêng cho TTD) — không tự quyết ở đây (mục 15).
3. **`extraServices` có cần giữ lựa chọn `marketId:'ALL'` (áp dụng đồng thời 2 chợ) trong màn mới,
   hay ép mỗi bản ghi chỉ 1 chợ như `stallPrices`/`utilities`?** Hiện tại hợp lý cho 1 số dịch vụ
   dùng chung hạ tầng (gửi xe...) nhưng cần xác nhận có dịch vụ nào THẬT SỰ cần "1 giá áp dụng cả
   2 chợ" hay đây chỉ là dữ liệu demo.
4. **`billingRules.approverRoleId` (mặc định `'bql'` mồ côi) nên sửa thành role nào khi implement?**
   Ứng viên hợp lý nhất theo mô tả hiện có (`waiverApprovalThreshold`, gắn với miễn giảm khoản phải
   thu — hiện `phai-thu.mien-giam` chỉ `market_manager` có) là `market_manager`, nhưng cần xác nhận
   trước khi sửa (không tự đổi ở audit này).
5. **Phạm vi "nối luồng giá thật vào `pt-issue`/`ct-new-save`/`inv-adjust-save`" (mục 6/7/14) có
   nằm trong dự định của Phase kế tiếp không, hay chỉ dừng ở việc di chuyển UI + RBAC lần này?**
   Ảnh hưởng lớn tới việc có cần thiết kế version-by-effective-date (mục 14) ngay hay có thể để
   sau — nếu chỉ di chuyển UI, GAP mục 8.6/14 có thể ghi nhận và hoãn; nếu định nối luôn, cần 1
   audit/thiết kế riêng cho phần này trước khi code.

---

## Bảng tổng hợp CURRENT → PROBLEM → TARGET

| Mục | CURRENT | PROBLEM | TARGET (Phase sau) |
|---|---|---|---|
| **Screen location** | `dongia` là sub-tab trong `cai-dat` (`SETTINGS_TABS`, `v-vanhanh.js:476`) | Lẫn với cấu hình hệ thống (Vai trò, Tích hợp, Nhật ký) dù bản chất là dữ liệu tài chính theo chợ | Screen độc lập `cau-hinh-gia` trong group "Tài chính", trước `dien-nuoc` (mục 9/10) |
| **Screen permission** | `screen:cai-dat` → chỉ `system_admin` (`permissions.js` screenRoles) | `market_manager` (chủ sở hữu nghiệp vụ thật) không vào được | `screen:cau-hinh-gia` → `market_manager`, `accountant`, (`ward_leader`? — NEED_CONFIRMATION #1) |
| **Giá mặt bằng** | `action:cai-dat.gia-mat-bang` → `system_admin`; handler không re-check; list không lọc market | Sai chủ sở hữu; không handler-gate; không market-gate | `action:cau-hinh-gia.mat-bang` → `market_manager` (sửa), `accountant` (xem); `A.canDo(key, targetMarket)` ở cả UI lẫn handler |
| **Giá điện nước** | `action:cai-dat.gia-dien-nuoc` → `system_admin`; cùng vấn đề trên; **không nối với `pt-issue`** (đọc `D.ELEC`/`D.WATER` tĩnh) | Sai chủ sở hữu; không gate; **UI mock, chỉnh sửa không có tác dụng tính tiền** | `action:cau-hinh-gia.dien-nuoc` → `market_manager`/`accountant`; giữ nguyên chưa nối (đánh dấu GAP rõ ràng cho người dùng, mục 18) hoặc nối thật nếu NEED_CONFIRMATION #5 xác nhận |
| **Dịch vụ khác** | `action:cai-dat.dich-vu-khac` → `system_admin`; **không cộng vào `pt-issue`** | Sai chủ sở hữu; không gate; hoàn toàn chưa ảnh hưởng khoản phải thu | `action:cau-hinh-gia.dich-vu-khac` → `market_manager`/`accountant`; giữ `marketId:'ALL'` cho dịch vụ dùng chung (NEED_CONFIRMATION #3) |
| **market_manager** | Không có quyền nào trên 3 loại giá | Không thể làm đúng vai trò "chịu trách nhiệm thiết lập giá" theo yêu cầu nghiệp vụ mới | Có đủ 3 action `cau-hinh-gia.*`, giới hạn theo `marketScopes` của chính account |
| **accountant** | Không có quyền/không thấy màn | Không phục vụ được nghiệp vụ tài chính cần tham chiếu giá | Có `screen:cau-hinh-gia`, KHÔNG có 3 action sửa — xem read-only |
| **system_admin** | Duy nhất có toàn bộ quyền (do lịch sử, không do thiết kế có chủ đích) | Vi phạm nguyên tắc "system_admin không tự động business superuser" nếu giữ nguyên sau khi đổi chủ sở hữu nghiệp vụ | Không có 3 action `cau-hinh-gia.*` mặc định; vẫn giữ toàn quyền `tai-khoan.*`/`cai-dat.vai-tro.*`/`cai-dat.phan-quyen` (quản trị hệ thống, không đổi) |
| **marketScopes** | Không filter, không check ở bất kỳ đâu trong module | Latent gap — vô hại hiện tại (chỉ system_admin ALL chạm tới) nhưng vỡ ngay khi mở quyền cho role 1-chợ | List lọc theo `ui.market`; form khoá `marketId` theo `ui.market` khi tạo mới; handler re-check `targetMarket` |
| **Kỳ thu** | Tab trong `cai-dat` → `dongia`; không `marketId`; không nối `pt-issue` (literal hardcode) | UI mock, và nghi vấn "chỉ áp dụng CL" chưa xác nhận (NEED_CONFIRMATION #2) | **Giữ nguyên vị trí Cài đặt** (mục 15) — không di chuyển trong lần này |
| **Quy tắc thu phí** | Tab trong `cai-dat` → `dongia`; `approverRoleId` mồ côi (`'bql'`); không nối `inv-adjust-save`/`pay-confirm` | UI mock; dữ liệu mồ côi tiền-RBAC-V1 | **Giữ nguyên vị trí Cài đặt** (mục 16) — không di chuyển; sửa `approverRoleId` mặc định khi có xác nhận (NEED_CONFIRMATION #4) |
| **Receivable integration** | `pt-issue`/`ct-new-save`/`inv-adjust-save` đọc `data.js` hằng số tĩnh + literal hardcode; **0 tham chiếu tới `A.SERVICE_CFG`** | Toàn bộ luồng "Cấu hình giá → Khoản phải thu" mô tả ở đề bài mục 3 chưa tồn tại trong code | Ngoài phạm vi 1 lần di chuyển UI — cần 1 audit/thiết kế riêng (NEED_CONFIRMATION #5) nếu quyết định nối thật; nếu chỉ dừng ở UI/RBAC, cần ghi chú rõ ràng "chưa ảnh hưởng tính tiền" ngay trên màn hình mới |

---

*Hết báo cáo audit. Không có code nào bị sửa. Dừng lại — không implement, không tạo screen thật,
không sửa menu/permission, không tự sang bước tiếp theo.*

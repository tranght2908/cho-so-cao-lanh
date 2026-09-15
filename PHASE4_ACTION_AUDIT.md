# PHASE 4A — ACTION PERMISSION AUDIT

> **Chỉ audit / phân tích. Không implement, không sửa code.** Toàn bộ nhận định dưới đây được rút
> trực tiếp từ việc đọc lại toàn văn `js/permissions.js`, `js/accounts.js`, `js/core.js`, và 6 file
> view (`js/v-cautruc.js`, `js/v-dieuhanh.js`, `js/v-tieuthuong.js`, `js/v-taichinh.js`,
> `js/v-vanhanh.js`, `js/mini.js`) + grep xác nhận từng entry point tại thời điểm audit (ngay sau
> khi Phase 3 + hotfix migration đã được ACCEPTED). Không suy diễn "có screen permission = được
> thao tác" — mọi dòng dưới đây phân biệt rõ quyền xem màn hình (`screen:*`) và quyền thao tác
> (`action:*`).

---

## 0. Quy ước đọc bảng

- **CURRENT_PERMISSION_KEY**: key thật đang có trong `CATALOG` (`js/permissions.js`), ghi `KHÔNG CÓ`
  nếu chưa tồn tại.
- **PROPOSED_V1_KEY**: tên đề xuất cho Phase 4B — giữ nguyên `CURRENT_PERMISSION_KEY` nếu không cần
  đổi; chỉ khác khi mục 10 của yêu cầu audit đã gợi ý tên khác (ví dụ nhóm `reconciliation.*` cho
  Đối soát). **Không đổi tên trong code ở bước này.**
- **ACTION_TYPE**: A=View/Navigation, B=Mutation, C=Approval, D=Export/Print, E=System Admin.
- **UI_GATE**: nút/hành động có bị ẩn bởi `A.PERM.canAction(...)` (hoặc tương đương) khi build HTML
  không.
- **HANDLER_GATE**: hàm xử lý thật sự (`A.ACT[...]`/`A.CH[...]`) có tự `A.PERM.canAction(...)` lại
  lần nữa trước khi ghi dữ liệu không (độc lập với UI_GATE).
- **STATUS**: `CONFIRMED_V1` (đã đúng/đủ, không cần đổi ở Phase 4B) · `NEED_CONFIRMATION` (cần quyết
  định nghiệp vụ trước khi code) · `CURRENT_GAP` (thiếu permission hoặc thiếu re-check, cần Phase 4B
  xử lý) · `NOT_IMPLEMENTED` (chức năng chưa tồn tại trong code).

---

## 1. BẢNG AUDIT CHÍNH

### 1.0 Tổng quan liên chợ (`tong-quan`)

Thuần dashboard/view — không có mutation action nào. Nút "Xem" trong danh sách cảnh báo chỉ là
`data-act="go"` điều hướng sang màn khác (đã tự có `U.can(target)` để ẩn nếu người dùng không có
quyền màn đích) — không cần permission riêng. **Không có dòng action nào cần audit thêm.**

### 1.1 Thiết lập mặt bằng chợ (`cau-truc`)

| SCREEN | ACTION | CURRENT_KEY | PROPOSED_V1_KEY | TYPE | UI_GATE | HANDLER_GATE | ENTRY_POINTS | MARKET_CHECK | BUSINESS_STATE | RISK | PROPOSED_ROLES | STATUS | NOTES |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| cau-truc | Xem cây cấu trúc / sơ đồ quy hoạch | *(qua `screen:cau-truc`)* | *(không cần)* | A | — | — | render `A.VIEWS['cau-truc']` | N/A | NO | LOW | mọi role có screen | CONFIRMED_V1 | Screen permission đã đủ |
| cau-truc | Thêm/sửa khối, tầng, khu, loại điểm; lưu nháp/chính thức | KHÔNG CÓ | `cau-truc.edit` | B | NO | NO | `qh-add-block(-save)`, `qh-edit-block(-save)`, `qh-add-floor(-save)`, `qh-edit-floor(-save)`, `qh-add-zone-save`, `qh-zone-field`(CH), `qh-pt-add`, `qh-pt-field`(CH), `qh-save-draft`, `qh-save-final` — `js/v-cautruc.js:196‑367` (~13 handler) | NO (thao tác trên `qhMarket()`, không re-check account scope) | Một phần — `validateZone()` chặn Lưu chính thức nếu thiếu field/diện tích vượt khu (business rule, không phải authorization) | **HIGH** | market_manager: edit; market_staff: edit | CURRENT_GAP | Toàn bộ 13 handler không có bất kỳ `A.PERM.canAction` nào |
| cau-truc | Xoá khối/tầng/khu/loại điểm | KHÔNG CÓ | `cau-truc.delete` | B | NO | NO | `qh-del-block(-ok)`, `qh-del-floor(-ok)`, `qh-del-zone(-ok)`, `qh-pt-del` — `js/v-cautruc.js:232‑327` | NO | Có — chặn xoá khối/tầng còn khu con bên trong (business rule) | **HIGH** | market_manager: delete; market_staff: `NEED_CONFIRMATION` (đúng như RBAC_V1_SPEC §5 đã nêu) | CURRENT_GAP / NEED_CONFIRMATION (role) | |
| cau-truc | Khôi phục cấu trúc mặc định (ghi đè toàn bộ layout 1 chợ) | KHÔNG CÓ | `cau-truc.reset` | B | NO | NO | `qh-reset` → `qh-reset-ok` — `js/v-cautruc.js:199‑208` | Gián tiếp (thao tác trên `qhMarket()` — market đã được kẹp bởi selectedMarket, nhưng không re-check tường minh) | NO | **HIGH** (destructive, ghi đè toàn bộ) | market_manager only | CURRENT_GAP | |

### 1.2 Sơ đồ mặt bằng (`so-do`)

| ACTION | CURRENT_KEY | PROPOSED_V1_KEY | TYPE | UI_GATE | HANDLER_GATE | ENTRY_POINTS | MARKET_CHECK | BUSINESS_STATE | RISK | PROPOSED_ROLES | STATUS | NOTES |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Xem hồ sơ tiểu thương từ ô sơ đồ | `action:so-do.xem-ho-so` | (giữ) | A | YES (`v-dieuhanh.js:132,149`) | NO — `A.ACT.trader` (`v-tieuthuong.js:69`) không re-check | 1 điểm gọi từ so-do; **CÙNG handler** `A.ACT.trader` còn được gọi từ bảng `tieu-thuong` và `hop-dong` **KHÔNG qua key này** | NO | NO | LOW | ward_leader (view), market_manager, market_staff, accountant, collector | CONFIRMED_V1 | Việc `tieu-thuong`/`hop-dong` gọi thẳng `A.ACT.trader` không qua `so-do.xem-ho-so` là **đúng thiết kế** (2 màn đó tự có `screen:*` riêng bảo vệ, không phải bypass) — ghi rõ để tránh hiểu nhầm là lỗi |
| Tạo hợp đồng từ ô trống | `action:so-do.tao-hop-dong` | (giữ) | B | YES (`v-dieuhanh.js:133,149`) | NO — `ct-new-save` (`v-tieuthuong.js:186`) không re-check | so-do panel (GATED); **hop-dong screen's "+ Tạo hợp đồng" gọi cùng `ct-new`/`ct-new-save` KHÔNG qua key này** (xem 1.6) | NO | Chặn nếu hết điểm trống (`v-tieuthuong.js:174`) | **HIGH** (do trùng entry point ungated ở hop-dong) | market_manager, market_staff | CURRENT_GAP (do entry point ở hop-dong) | Cùng 1 mutation (`ct-new-save`) có 2 lối vào với 2 mức gate khác nhau |
| Đổi trạng thái điểm kinh doanh | `action:so-do.doi-trang-thai` | (giữ) | B | YES (`v-dieuhanh.js:134,150`) | NO — `stall-status-save` (`v-dieuhanh.js:208`) | 1 điểm duy nhất | NO (không re-check `st.market` so với selectedMarket) | NO | MEDIUM | market_manager, market_staff | CURRENT_GAP (handler bypass) | |

### 1.3 Điểm kinh doanh (`diem-kd`)

| ACTION | CURRENT_KEY | PROPOSED_V1_KEY | TYPE | UI_GATE | HANDLER_GATE | ENTRY_POINTS | MARKET_CHECK | BUSINESS_STATE | RISK | PROPOSED_ROLES | STATUS | NOTES |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Xuất Excel danh mục | KHÔNG CÓ | `diem-kd.export` | D | NO | NO | `dk-csv` (`v-tieuthuong.js:38`) | NO | NO | LOW (chỉ export dữ liệu đã hiển thị sẵn) | tất cả role có `screen:diem-kd` | NEED_CONFIRMATION | RBAC_V1_SPEC §5: "Bổ sung nếu cần granular" — chưa chốt |
| Xem chi tiết 1 điểm | *(qua `screen:diem-kd`)* | (không cần) | A | — | — | `dk-open` → `A.stallPanel` (dùng lại action key của so-do bên trong) | N/A | NO | LOW | mọi role có screen | CONFIRMED_V1 | |

### 1.4 Phiên chợ quê (`phien-cho`)

| ACTION | CURRENT_KEY | PROPOSED_V1_KEY | TYPE | UI_GATE | HANDLER_GATE | ENTRY_POINTS | MARKET_CHECK | BUSINESS_STATE | RISK | PROPOSED_ROLES | STATUS | NOTES |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Điểm danh & chốt phiên | `action:phien-cho.chot-phien` | (giữ) | B | YES (`v-dieuhanh.js:235`) | NO — `session-save` (`v-dieuhanh.js:255`) | 1 điểm duy nhất | YES — gián tiếp qua Market Applicability Phase 2 (`A.SCREEN_MARKET['phien-cho']='TTD'`, chỉ hiện khi selectedMarket=TTD) | Có — chỉ hiện nút nếu phiên 12/09 `pending` (chưa có trong `A.db.sessions`) | MEDIUM | market_manager, market_staff (collector **không** mặc định — đúng định hướng "Collector không chốt phiên mặc định") | CURRENT_GAP (role mặc định hiện chỉ có market_manager, thiếu market_staff so với định hướng V1) | Seed hiện tại (`actionRoles`) chưa cập nhật cho market_staff dù screen đã cấp ở Phase 3 |

### 1.5 Tiểu thương (`tieu-thuong`)

| ACTION | CURRENT_KEY | PROPOSED_V1_KEY | TYPE | UI_GATE | HANDLER_GATE | ENTRY_POINTS | MARKET_CHECK | BUSINESS_STATE | RISK | PROPOSED_ROLES | STATUS | NOTES |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Thêm hồ sơ tiểu thương (kể cả "Quét CCCD giả lập") | `action:tieu-thuong.them-moi` | (giữ) | B | YES (`v-tieuthuong.js:56`) | NO — `tt-save` (`v-tieuthuong.js:108`) | 1 điểm; `tt-ocr` chỉ điền sẵn form, không tự lưu | NO | Có — chặn trùng CCCD (`v-tieuthuong.js:111`, business rule thật) | MEDIUM | market_manager, market_staff | CURRENT_GAP (role mặc định thiếu market_staff — cùng dạng gap như phien-cho) | |
| Sửa hồ sơ tiểu thương | — | `tieu-thuong.edit` | B | — | — | **Không tồn tại** — không có handler edit nào trong `v-tieuthuong.js` | — | — | — | — | NOT_IMPLEMENTED | Chỉ có Thêm mới, chưa có Sửa |

### 1.6 Hợp đồng (`hop-dong`)

| ACTION | CURRENT_KEY | PROPOSED_V1_KEY | TYPE | UI_GATE | HANDLER_GATE | ENTRY_POINTS | MARKET_CHECK | BUSINESS_STATE | RISK | PROPOSED_ROLES | STATUS | NOTES |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Tạo hợp đồng | KHÔNG CÓ | `hop-dong.tao` | B | NO (tại nút riêng của hop-dong) | NO — `ct-new-save` (`v-tieuthuong.js:186`) | Nút "+ Tạo hợp đồng" trên chính `hop-dong` (`v-tieuthuong.js:131`, **ungated**) + so-do panel (gated bởi `so-do.tao-hop-dong`, xem 1.2) | NO | Chặn nếu hết điểm trống | **HIGH** | market_manager: tạo+gia hạn+thanh lý; market_staff: tạo+gia hạn (theo RBAC_V1_SPEC §5) | CURRENT_GAP | 2 entry point cho cùng 1 mutation, gate không đồng nhất |
| Gia hạn hợp đồng | KHÔNG CÓ | `hop-dong.gia-han` | B | NO | NO — `ct-extend-save` (`v-tieuthuong.js:150`) | 1 điểm, chỉ trên `hop-dong` | NO | Ngầm định qua tab (chỉ hợp đồng `hieuluc` mới có nút) | **HIGH** | market_manager, market_staff | CURRENT_GAP | |
| Thanh lý hợp đồng | KHÔNG CÓ | `hop-dong.thanh-ly` | B | NO | NO — `ct-end-save` (`v-tieuthuong.js:163`) | 1 điểm, chỉ trên `hop-dong` | NO | **Yếu** — nếu còn nợ chỉ hiện ghi chú cảnh báo (`v-tieuthuong.js:159‑160`), **không chặn** thao tác | **HIGH** | market_manager: có; market_staff: `NEED_CONFIRMATION`; chặn khi còn nợ: `NEED_CONFIRMATION` (đúng RBAC_V1_SPEC §5/§11) | CURRENT_GAP / NEED_CONFIRMATION | Không tự quyết định business rule "còn nợ có được thanh lý không" |

### 1.7 Chỉ số điện, nước (`dien-nuoc`)

| ACTION | CURRENT_KEY | PROPOSED_V1_KEY | TYPE | UI_GATE | HANDLER_GATE | ENTRY_POINTS | MARKET_CHECK | BUSINESS_STATE | RISK | PROPOSED_ROLES | STATUS | NOTES |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Nhập/lưu nháp chỉ số + ảnh đồng hồ | `action:dien-nuoc.ghi-chi-so` | (giữ) | B | YES (`v-taichinh.js:82,100`) | Một phần — `A.CH.reading`/`dn-photo-add` (`v-taichinh.js:111‑134`) tự kiểm `p.status !== 'RECORDING'` (business state) nhưng **không re-check permission** | 1 điểm | YES — screen chỉ applicable CL (Phase 2), TTD không có dữ liệu đồng hồ | Có — chỉ sửa được khi kỳ đang `RECORDING` | MEDIUM | market_manager, market_staff | CURRENT_GAP (role thiếu market_staff so với định hướng); HANDLER_GATE thiếu permission re-check | RBAC_V1_SPEC §5: "NV BQL: ghi chỉ số + yêu cầu điều chỉnh" |
| Chốt kỳ ghi chỉ số | `action:dien-nuoc.chot-ky` | (giữ) | B | YES (`v-taichinh.js:83,99`) | NO — `dn-close-confirm` (`v-taichinh.js:161`) không re-check quyền, **cũng không re-verify** điều kiện "đã ghi đủ" (chỉ `disabled` ở UI modal) | 1 điểm | Gián tiếp qua Market Applicability | Có nhưng **chỉ enforce ở UI** (nút Xác nhận `disabled` nếu `todo>0`, handler không tự kiểm lại) | MEDIUM‑HIGH | market_manager; market_staff `NEED_CONFIRMATION` (RBAC_V1_SPEC §5 nêu rõ) | CURRENT_GAP / NEED_CONFIRMATION | Có thể chốt kỳ thiếu dữ liệu nếu bypass UI |
| Yêu cầu điều chỉnh chỉ số đã chốt | `action:dien-nuoc.yeu-cau-dieu-chinh` | (giữ) | C (đề xuất phê duyệt, hiện chỉ là "gửi yêu cầu") | YES (`v-taichinh.js:172,178`) | NO — `dn-adjust-send` (`v-taichinh.js:195`) | 1 điểm | Gián tiếp qua Market Applicability | Có — chỉ hiện khi kỳ `CLOSED` | MEDIUM | market_manager, market_staff | CURRENT_GAP (handler) | Tự nhận trong code: "chưa có quy trình phê duyệt backend" (`v-taichinh.js:210`) — chỉ tạo record `PENDING`, không có bước duyệt thật |

### 1.8 Khoản phải thu (`phai-thu`)

| ACTION | CURRENT_KEY | PROPOSED_V1_KEY | TYPE | UI_GATE | HANDLER_GATE | ENTRY_POINTS | MARKET_CHECK | BUSINESS_STATE | RISK | PROPOSED_ROLES | STATUS | NOTES |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Phát hành khoản phải thu tự động (bulk) | KHÔNG CÓ | `phai-thu.phat-hanh` | B | NO | NO — `pt-issue` (`v-taichinh.js:241`) | 1 điểm | NO | **Yếu** — chỉ ẩn nút nếu kỳ 10/2026 đã phát hành (`periods.includes(...)`, kiểm tra ở UI, handler không re-verify) | **HIGH** | market_manager, accountant (theo RBAC_V1_SPEC §5); "Trưởng BQL hay Kế toán phát hành cuối cùng" = `NEED_CONFIRMATION` | CURRENT_GAP / NEED_CONFIRMATION | Sinh hàng loạt Invoice mới — có thể double-issue nếu bypass UI |
| Miễn giảm / điều chỉnh khoản phải thu | `action:phai-thu.mien-giam` | (giữ) | C | YES (`v-taichinh.js:281`) | NO — `inv-adjust-save` (`v-taichinh.js:293`) | 1 điểm | NO | Có — chỉ hiện nếu chưa `paid` và chưa `adjust` | MEDIUM‑HIGH | market_manager; "ai duyệt miễn giảm" = `NEED_CONFIRMATION` (RBAC_V1_SPEC §5/§11) | CURRENT_GAP / NEED_CONFIRMATION | Tự nhận trong UI: "Prototype: phê duyệt ngay" — không có bước duyệt 2 cấp thật (`v-taichinh.js:290`) |

### 1.9 Thu tiền & biên lai (`thu-tien`) — **rủi ro cao nhất tìm thấy trong audit**

| ACTION | CURRENT_KEY | PROPOSED_V1_KEY | TYPE | UI_GATE | HANDLER_GATE | ENTRY_POINTS | MARKET_CHECK | BUSINESS_STATE | RISK | PROPOSED_ROLES | STATUS | NOTES |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Thu tiền (mở modal `pay-open` → xác nhận `pay-confirm`) | `action:thu-tien.thu` | (giữ) | B | **KHÔNG NHẤT QUÁN** — xem 5 entry point | **NO ở cả 5 điểm** — `pay-open`/`pay-confirm` (`v-taichinh.js:322,331`) không re-check | **5 entry point xác nhận bằng grep `data-act="pay-open"`:**<br>1. `v-dieuhanh.js:148` (panel Sơ đồ) — GATE<br>2. `v-taichinh.js:282` (modal Khoản phải thu) — GATE<br>3. `v-taichinh.js:360` (**bảng con nợ chính màn `thu-tien`**) — **KHÔNG GATE**<br>4. `v-taichinh.js:704` (nút "Thu" trong `cong-no`) — **KHÔNG GATE**<br>5. `v-tieuthuong.js:87` (modal hồ sơ Tiểu thương) — GATE | NO — không re-check `traderId`/`invoiceId` thuộc market nào so với selectedMarket/account scope | Có — chỉ thu khoản `status !== 'paid'`, dùng `U.due()` để không thu quá số còn lại (business logic đúng, nhưng không phải authorization) | **HIGH — CRITICAL** | market_manager, accountant, collector (RBAC_V1_SPEC §5) | CURRENT_GAP | Đã xác minh lại bằng source y hệt phát hiện ở báo cáo Phase 3 — **2/5 entry point hoàn toàn không kiểm tra permission**, và **0/5 handler thật sự re-check** dù 3/5 có UI gate |

### 1.10 Đối soát (`doi-soat`) — màn được bảo vệ tốt nhất hiện có

| ACTION | CURRENT_KEY | PROPOSED_V1_KEY | TYPE | UI_GATE | HANDLER_GATE | ENTRY_POINTS | MARKET_CHECK | BUSINESS_STATE | RISK | PROPOSED_ROLES | STATUS | NOTES |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Xem đối soát ngân hàng/QR | `action:doi-soat.xem-ngan-hang` | `reconciliation.bank.view` | A | YES (gate cả tab, `v-taichinh.js:410‑415`) | N/A (view) | 1 điểm | Có — theo `dsTxFrom/dsTxTo` + `U.inM` | NO | LOW | ward_leader (view), market_manager, accountant | CONFIRMED_V1 | |
| Gắn khoản thu thủ công | `action:doi-soat.gan-thu-cong` | `reconciliation.bank.manual_match` | B | YES (`v-taichinh.js:453`) | **YES** — `ds-bank-match`(`:531`) và `ds-bank-match-confirm`(`:545`) đều tự `if (!dsCanBankMatch()) return;` | 1 điểm | NO | Có — chỉ áp dụng cho giao dịch chưa `MATCHED_*` | LOW | market_manager, accountant | CONFIRMED_V1 | **Mẫu tham chiếu tốt nhất trong toàn app** — nên dùng làm pattern chuẩn cho Phase 4B |
| Xem đối soát tiền mặt | `action:doi-soat.xem-tien-mat` | `reconciliation.cash.view` | A | YES (gate tab) | N/A | 1 điểm | Có — lọc theo ngày hiện tại + `U.inM` | NO | LOW | ward_leader (view), market_manager, accountant | CONFIRMED_V1 | |
| Xác nhận đối soát nộp quỹ | `action:doi-soat.xac-nhan-nop-quy` | `reconciliation.cash.confirm` | C | YES (`v-taichinh.js:618`) | **YES** — `ds-cash-confirm` (`:655`) tự `if (!dsCanCashConfirm()) return;` **VÀ tự re-check business state** (`dsCashStatusOf(e0).id !== 'RECONCILED' || e0.confirm`) | 1 điểm | NO | Có, **được re-verify trong chính handler** | **RẤT THẤP** | market_manager, accountant | CONFIRMED_V1 | Action được bảo vệ đầy đủ nhất toàn hệ thống — cả permission lẫn business state đều re-check |
| Xem lịch sử truy vết | `action:doi-soat.xem-truy-vet` | `reconciliation.audit.view` | A | YES (2 điểm: drawer ngân hàng + drawer tiền mặt) | N/A | 2 điểm, nhất quán | N/A | NO | LOW | market_manager, accountant | CONFIRMED_V1 | |
| Xuất Excel (ngân hàng/tiền mặt) | KHÔNG CÓ | `doi-soat.export` | D | NO (nút export không tự kiểm, nhưng **chỉ render khi đã ở đúng tab** vốn đã cần `xem-ngan-hang`/`xem-tien-mat`) | NO | `ds-csv`(`:467`), `ds-cash-csv`(`:600`) | N/A | NO | LOW‑MEDIUM | Gián tiếp qua quyền xem tab; LĐ phường export = `NEED_CONFIRMATION` (RBAC_V1_SPEC §5) | NEED_CONFIRMATION | Rủi ro thấp hơn các export khác vì đã có 1 lớp gate gián tiếp qua tab |

### 1.11 Công nợ & nhắc nợ (`cong-no`)

| ACTION | CURRENT_KEY | PROPOSED_V1_KEY | TYPE | UI_GATE | HANDLER_GATE | ENTRY_POINTS | MARKET_CHECK | BUSINESS_STATE | RISK | PROPOSED_ROLES | STATUS | NOTES |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Nhắc nợ 1 tiểu thương | KHÔNG CÓ | `cong-no.nhac-no` | B | NO | NO — `cn-remind` (`v-taichinh.js:713`) | 1 điểm | NO | NO | MEDIUM | market_manager, accountant, market_staff (RBAC_V1_SPEC §5) | CURRENT_GAP | |
| Nhắc nợ hàng loạt | KHÔNG CÓ | `cong-no.nhac-no-hang-loat` | B | NO | NO — `cn-remind-all` (`v-taichinh.js:714`) | 1 điểm | NO | NO | MEDIUM | market_manager, accountant; market_staff = `NEED_CONFIRMATION`; collector = `NEED_CONFIRMATION` (RBAC_V1_SPEC §5) | CURRENT_GAP / NEED_CONFIRMATION | Gửi hàng loạt + tạo notification, rủi ro spam nếu lạm dụng |
| Xuất Excel công nợ | KHÔNG CÓ | `cong-no.export` | D | NO | NO — `cn-csv` (`v-taichinh.js:721`) | 1 điểm | NO | NO | LOW‑MEDIUM | mọi role có `screen:cong-no` | CURRENT_GAP | |
| Thu tiền (nút "Thu") | `action:thu-tien.thu` | (giữ) | B | **NO** | NO | `v-taichinh.js:704` | NO | NO | **HIGH** | — | CURRENT_GAP | Trùng với entry point #4 đã liệt kê ở mục 1.9 — không lặp lại risk count |

### 1.12 Phản ánh & sự cố (`su-co`)

| ACTION | CURRENT_KEY | PROPOSED_V1_KEY | TYPE | UI_GATE | HANDLER_GATE | ENTRY_POINTS | MARKET_CHECK | BUSINESS_STATE | RISK | PROPOSED_ROLES | STATUS | NOTES |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Tạo phản ánh thủ công (phía BQL) | `action:su-co.tao-phan-anh` | (giữ) | B | YES (`v-vanhanh.js:26`) | NO — `inc-new-save` (`:102`) | 1 điểm (BQL). **Tiểu thương tự gửi qua Mini App (`mini-report`, `mini.js:159`) là 1 đường TẠO KHÁC, gọi thẳng `A.addIncident()`, KHÔNG qua key này** | NO | NO | MEDIUM | market_manager, market_staff | CURRENT_GAP (handler); role thiếu market_staff | Đường Mini App **đúng thiết kế** không cần qua `su-co.tao-phan-anh` (đó là self-service của chính trader) — không phải lỗ hổng, chỉ cần ghi rõ để Phase 4B không nhầm |
| Phân công người xử lý | `action:su-co.phan-cong` | (giữ) | B | YES (`v-vanhanh.js:39,49`) | NO — `inc-assign` (`:60`, là `A.CH`) | 1 điểm | NO | NO | MEDIUM | market_manager; market_staff = `NEED_CONFIRMATION` (RBAC_V1_SPEC §5) | CURRENT_GAP / NEED_CONFIRMATION | |
| Chuyển trạng thái xử lý | `action:su-co.chuyen-trang-thai` | (giữ) | B | YES (`v-vanhanh.js:42,56`) | NO — `inc-next` (`:68`) | 1 điểm | NO | Có — chỉ hiện nếu còn `next` state (không vượt quá "Đóng") | MEDIUM | market_manager, market_staff, technician (RBAC_V1_SPEC §5) | CURRENT_GAP (handler); role hiện chỉ có market_manager | |
| Chuyển vượt cấp lên phường | `action:su-co.vuot-cap` | (giữ) | B | YES (`v-vanhanh.js:40,54`) | NO — `inc-escalate` (`:76`) | 1 điểm | NO | Có — chỉ khi chưa `escalated` và đang `isOpen` | MEDIUM | market_manager | CONFIRMED_V1 (role) / CURRENT_GAP (handler) | |
| Gửi ý kiến chỉ đạo | `action:su-co.chi-dao` | (giữ) | B | YES (`v-vanhanh.js:41,52,55`) | NO — `inc-comment` (`:81`) | 1 điểm | NO | Có — chỉ khi `escalated` | LOW‑MEDIUM | **ward_leader** (đây là action duy nhất seed mặc định cho `ward_leader` thay vì `market_manager`, xác nhận đúng ý "chỉ đạo/escalation" của mục 9 yêu cầu) | CONFIRMED_V1 (role) / CURRENT_GAP (handler) | |
| Đóng/hoàn tất sự cố (kỹ thuật) | — | — | B | — | — | Dùng chung `inc-next` (Chuyển trạng thái) | — | — | — | Kỹ thuật có được đóng sự cố = `NEED_CONFIRMATION` (RBAC_V1_SPEC §11) | NEED_CONFIRMATION | Không có action riêng "đóng" — nếu cấp `su-co.chuyen-trang-thai` cho technician sẽ tự động cho luôn khả năng đóng, cần quyết định trước |

### 1.13 Thông báo đa kênh (`thong-bao`)

| ACTION | CURRENT_KEY | PROPOSED_V1_KEY | TYPE | UI_GATE | HANDLER_GATE | ENTRY_POINTS | MARKET_CHECK | BUSINESS_STATE | RISK | PROPOSED_ROLES | STATUS | NOTES |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Gửi thông báo hàng loạt | KHÔNG CÓ | `thong-bao.gui` | B | NO | NO — `tb-send` (`v-vanhanh.js:138`) | 1 điểm | NO | Có — bắt buộc nhập tiêu đề + ≥1 kênh (validate, không phải authorization) | MEDIUM‑HIGH | market_manager; market_staff = `NEED_CONFIRMATION` (RBAC_V1_SPEC §5) | CURRENT_GAP / NEED_CONFIRMATION | Gửi tới hàng trăm tiểu thương cùng lúc, rủi ro uy tín nếu lạm dụng |

### 1.14 Báo cáo thống kê (`bao-cao`)

| ACTION | CURRENT_KEY | PROPOSED_V1_KEY | TYPE | UI_GATE | HANDLER_GATE | ENTRY_POINTS | MARKET_CHECK | BUSINESS_STATE | RISK | PROPOSED_ROLES | STATUS | NOTES |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Chọn báo cáo / xem | *(qua `screen:bao-cao`)* | (không cần) | A | — | — | `rp` | N/A | NO | LOW | mọi role có screen | CONFIRMED_V1 | |
| Xuất Excel | KHÔNG CÓ | `bao-cao.export` | D | NO | NO — `rp-csv` (`v-vanhanh.js:198`) | 1 điểm | NO | NO | LOW | system_admin, ward_leader, market_manager, market_staff, accountant (RBAC_V1_SPEC §5) | NEED_CONFIRMATION | Rủi ro thấp (đọc thuần) nhưng vẫn nên có key riêng theo định hướng |
| In / PDF | *(dùng chung `A.ACT.print`)* | (không cần) | D | — | — | `core.js` `print` action, dùng chung toàn app | N/A | NO | LOW | mọi role có screen | CONFIRMED_V1 | `window.print()` thuần, không xuất dữ liệu thô |

### 1.15 Tài khoản người dùng (`tai-khoan`)

| ACTION | CURRENT_KEY | PROPOSED_V1_KEY | TYPE | UI_GATE | HANDLER_GATE | ENTRY_POINTS | MARKET_CHECK | BUSINESS_STATE | RISK | PROPOSED_ROLES | STATUS | NOTES |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Thêm tài khoản | `action:tai-khoan.tao-moi` | (giữ) | E | YES (`v-vanhanh.js:273,283`) | NO — `acc-form-save` (`:340`) | 1 điểm | N/A | Có — validate mã trùng (`v-vanhanh.js:344`) | MEDIUM | system_admin | CONFIRMED_V1 (role) / CURRENT_GAP (handler) | |
| Sửa tài khoản | `action:tai-khoan.sua` | (giữ) | E | YES (`:231,274,307`) | NO — `acc-form-save` | 2 điểm (bảng + drawer), nhất quán | N/A | NO | MEDIUM | system_admin | CONFIRMED_V1 (role) / CURRENT_GAP (handler) | |
| Khoá/mở khoá tài khoản | `action:tai-khoan.khoa-mo-khoa` | (giữ) | E | YES (`:275,308`) | NO — `acc-toggle` (`:358`) | 1 điểm | N/A | NO | MEDIUM | system_admin | CONFIRMED_V1 (role) / CURRENT_GAP (handler) | |
| Gán vai trò / phạm vi chợ cho tài khoản | `action:tai-khoan.gan-quyen` | (giữ) | E | YES — khoá field `af-role`/`af-scope` nếu không có quyền (`:255‑256,258,264`) | N/A (chỉ disable field, không có handler mutation riêng ngoài `acc-form-save`) | 1 điểm | N/A | NO | MEDIUM | system_admin | CONFIRMED_V1 | Đây **chính là** cơ chế gán `marketScopes` cho account — xem ghi chú mục 11 |

### 1.16 Cài đặt & phân quyền (`cai-dat`)

**Cấu hình dịch vụ** (5 key đã có, đều theo đúng 1 pattern):

| ACTION | CURRENT_KEY | PROPOSED_V1_KEY | TYPE | UI_GATE | HANDLER_GATE | ENTRY_POINTS | MARKET_CHECK | BUSINESS_STATE | RISK | PROPOSED_ROLES | STATUS | NOTES |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Quản lý đơn giá mặt bằng | `action:cai-dat.gia-mat-bang` | (giữ) | E | YES (`cfgCan('gia-mat-bang')`) | NO — `cfg-price-new/edit/toggle`, `cfg-form-save` | new/edit/toggle + đính kèm tài liệu, ~6 handler | NO (thao tác trên `marketId` của record, không so với account scope) | NO | LOW‑MEDIUM (cấu hình tách biệt khỏi engine tính tiền thật — đã ghi trong baseline) | system_admin | CONFIRMED_V1 (role) / CURRENT_GAP (handler) | |
| Quản lý giá điện, nước | `action:cai-dat.gia-dien-nuoc` | (giữ) | E | YES | NO | tương tự, ~6 handler | NO | NO | LOW‑MEDIUM | system_admin | CONFIRMED_V1 (role) / CURRENT_GAP (handler) | |
| Quản lý dịch vụ khác | `action:cai-dat.dich-vu-khac` | (giữ) | E | YES | NO | tương tự, ~6 handler | NO | NO | LOW‑MEDIUM | system_admin | CONFIRMED_V1 (role) / CURRENT_GAP (handler) | |
| Cấu hình kỳ thu | `action:cai-dat.ky-thu` | (giữ) | E | YES (`disabled` field) | NO — mọi `A.CH['bc-*']` | ~8 handler | N/A | NO | LOW | system_admin | CONFIRMED_V1 (role) / CURRENT_GAP (handler) | |
| Cấu hình quy tắc thu phí | `action:cai-dat.quy-tac-thu-phi` | (giữ) | E | YES (`disabled` field) | NO — mọi `A.CH['br-*']` | ~8 handler, gồm cả chọn `approverRoleId` (không có tác dụng thật, xem baseline) | N/A | NO | LOW | system_admin | CONFIRMED_V1 (role) / CURRENT_GAP (handler) | |

**Vai trò & phân quyền** — nhóm rủi ro cấu trúc cao nhất:

| ACTION | CURRENT_KEY | PROPOSED_V1_KEY | TYPE | UI_GATE | HANDLER_GATE | ENTRY_POINTS | MARKET_CHECK | BUSINESS_STATE | RISK | PROPOSED_ROLES | STATUS | NOTES |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Tạo/Sửa/Vô hiệu hoá/Xoá vai trò | KHÔNG CÓ | `cai-dat.vai-tro.tao`, `.sua`, `.khoa`, `.xoa` | E | **NO** — 4 nút "Phân quyền"/"Sửa"/"Vô hiệu hoá"/"Xoá" trong `settingsVaitroHtml()` (`v-vanhanh.js:801‑812`) hiện ra **vô điều kiện**, chỉ cần vào được `cai-dat` | NO — `role-form-save`(`:861`), `role-toggle`(`:881`), `role-del-ok`(`:900`) chỉ có business-rule (không xoá/khoá role gốc, không xoá role đang dùng), không có permission check | ~7 handler | N/A | Có (không cho xoá role builtin/đang dùng — nhưng là business rule, không phải authorization) | **CẤU TRÚC: MEDIUM** (thực tế hiện chỉ `system_admin` mới vào được `cai-dat` theo ma trận Phase 3, nên rủi ro khai thác THỰC TẾ ở mức thấp) nhưng **THIẾU HOÀN TOÀN** granularity nội bộ | system_admin | CURRENT_GAP | Chính là action nhạy cảm nhất hệ thống về mặt cấu trúc — hiện bó chung với `screen:cai-dat`, không tách được "chỉ xem" khỏi "được xoá role" |
| Cấp/thu hồi permission cho 1 role (checkbox `perm-toggle`) | KHÔNG CÓ | `cai-dat.phan-quyen` | E | **NO** — checkbox luôn hiện, không disable | NO — `perm-toggle` (`v-vanhanh.js:832`) gọi thẳng `A.PERM.grant`/`revoke` | 1 điểm nhưng lặp lại cho **mọi** trong 47 permission key × mọi role hiển thị trong bảng | N/A | NO | **CẤU TRÚC: MEDIUM‑HIGH** (cùng lý do trên — rủi ro thật hiện thấp vì chỉ system_admin chạm tới, nhưng đây là hành động thay đổi TOÀN BỘ ma trận RBAC) | system_admin | CURRENT_GAP | Đây là hành động có thể **tự thay đổi chính hệ thống phân quyền** — ưu tiên cao nhất cho Phase 4B dù rủi ro khai thác hiện tại thấp |
| Đặt lại dữ liệu mẫu (xoá toàn bộ business state) | KHÔNG CÓ | `cai-dat.reset-demo` | E | NO | NO — `reset-ok` (`v-vanhanh.js:909`) → `A.resetAll()` | 1 điểm | N/A | NO (modal xác nhận, nhưng không phải permission check) | MEDIUM (destructive nhưng chỉ ảnh hưởng dữ liệu demo, không phải dữ liệu RBAC) | system_admin | CURRENT_GAP | |

### 1.17 Mini app tiểu thương (`mini-app`)

Toàn bộ action (`mini-otp`, `mini-login`, `mini-pay`/`mini-paid`, `mini-report`, `mini-rate`,
`mini-bill`, `mini-tab`, v.v. — `js/mini.js`) hoạt động trên `trader()` được suy ra từ
`mini().traderId`, vốn chỉ là 1 dropdown "Xem với tư cách tiểu thương mẫu" (mô phỏng, không phải
đăng nhập thật) — đã ghi nhận từ baseline gốc. **Đúng theo RBAC_V1_SPEC §5: "Giữ self-service hiện
tại; không thêm action permission nội bộ trong task này."** STATUS: **CONFIRMED_V1** — không cần
thêm permission nào ở đây trong Phase 4B.

---

## 2. Existing Action Permission Catalog (nguyên trạng — không đổi trong audit này)

29 `action:*` key hiện có trong `CATALOG` (`js/permissions.js:52‑80`), seed mặc định (`actionRoles`,
`js/permissions.js`) hiện **chưa đổi từ Phase 1** — chỉ `market_manager`/`ward_leader` có quyền:

| Key | Role mặc định hiện tại | Khớp định hướng V1 (RBAC_V1_SPEC §5)? |
|---|---|---|
| `so-do.xem-ho-so` | market_manager | Thiếu market_staff, accountant, collector, technician (view-only) |
| `so-do.tao-hop-dong` | market_manager | Thiếu market_staff |
| `so-do.doi-trang-thai` | market_manager | Thiếu market_staff |
| `phien-cho.chot-phien` | market_manager | Thiếu market_staff |
| `tieu-thuong.them-moi` | market_manager | Thiếu market_staff |
| `dien-nuoc.ghi-chi-so` | market_manager | Thiếu market_staff |
| `dien-nuoc.chot-ky` | market_manager | Đúng theo "Trưởng BQL: cả 3"; market_staff = NEED_CONFIRMATION |
| `dien-nuoc.yeu-cau-dieu-chinh` | market_manager | Thiếu market_staff |
| `phai-thu.mien-giam` | market_manager | Ai duyệt = NEED_CONFIRMATION |
| `thu-tien.thu` | market_manager | Thiếu accountant, collector |
| `doi-soat.xem-ngan-hang` | ward_leader, market_manager | Thiếu accountant |
| `doi-soat.gan-thu-cong` | market_manager | Thiếu accountant |
| `doi-soat.xem-tien-mat` | ward_leader, market_manager | Thiếu accountant |
| `doi-soat.xac-nhan-nop-quy` | market_manager | Thiếu accountant |
| `doi-soat.xem-truy-vet` | market_manager | Thiếu accountant |
| `su-co.tao-phan-anh` | market_manager | Thiếu market_staff |
| `su-co.phan-cong` | market_manager | market_staff = NEED_CONFIRMATION |
| `su-co.chuyen-trang-thai` | market_manager | Thiếu market_staff, technician |
| `su-co.vuot-cap` | market_manager | Đúng |
| `su-co.chi-dao` | ward_leader | Đúng |
| `tai-khoan.tao-moi` | market_manager | **Sai theo V1** — phải là system_admin only |
| `tai-khoan.sua` | market_manager | **Sai theo V1** — phải là system_admin only |
| `tai-khoan.khoa-mo-khoa` | market_manager | **Sai theo V1** — phải là system_admin only |
| `tai-khoan.gan-quyen` | market_manager | **Sai theo V1** — phải là system_admin only |
| `cai-dat.gia-mat-bang` | market_manager | **Sai theo V1** — phải là system_admin only |
| `cai-dat.gia-dien-nuoc` | market_manager | **Sai theo V1** — phải là system_admin only |
| `cai-dat.dich-vu-khac` | market_manager | **Sai theo V1** — phải là system_admin only |
| `cai-dat.ky-thu` | market_manager | **Sai theo V1** — phải là system_admin only |
| `cai-dat.quy-tac-thu-phi` | market_manager | **Sai theo V1** — phải là system_admin only |

**Ghi chú quan trọng:** vì `market_manager` không còn có `screen:tai-khoan`/`screen:cai-dat` từ Phase 3
(chỉ `system_admin` có 2 screen này), 8 action key "Sai theo V1" ở trên **hiện không thể bị khai thác
thật** (không ai vào được màn để bấm) — nhưng bản thân dữ liệu `actionRoles` vẫn sai, cần Phase 4B sửa
để nhất quán, tránh trường hợp Phase 4B/5 sau này lỡ cấp `screen:tai-khoan`/`screen:cai-dat` cho
`market_manager` rồi vô tình kế thừa luôn quyền action cũ.

---

## 3. Missing Action Permissions (không có `action:*` key nào bảo vệ)

17 action nghiệp vụ thật (mutation/export) hiện **hoàn toàn không có** permission key:

`cau-truc.edit`, `cau-truc.delete`, `cau-truc.reset`, `diem-kd.export`, `hop-dong.tao`,
`hop-dong.gia-han`, `hop-dong.thanh-ly`, `phai-thu.phat-hanh`, `doi-soat.export`, `cong-no.nhac-no`,
`cong-no.nhac-no-hang-loat`, `cong-no.export`, `thong-bao.gui`, `bao-cao.export`,
`cai-dat.vai-tro.*` (tạo/sửa/khoá/xoá — gộp 1 nhóm), `cai-dat.phan-quyen`, `cai-dat.reset-demo`.

---

## 4. Duplicate / Overlapping Keys

- **Không tìm thấy 2 permission key nào định nghĩa trùng chức năng.** Điểm "overlap" thật sự nằm ở
  **entry point**, không phải key: `so-do.tao-hop-dong` và `hop-dong.tao` (đề xuất) đều dẫn tới cùng
  handler `ct-new-save`; `so-do.doi-trang-thai` không trùng gì khác. Xem mục 5 để biết chi tiết các
  entry point trùng handler nhưng khác gate.
- `A.stallPanel` (dùng bởi cả `so-do` và `diem-kd`) và `A.ACT.trader` (dùng bởi `so-do`, `tieu-thuong`,
  `hop-dong`) là 2 hàm dùng chung hợp lý — không phải "duplicate" cần dọn, chỉ cần Phase 4B nhớ rằng
  sửa gate ở 1 chỗ không tự động sửa chỗ khác gọi cùng hàm.

---

## 5. Ungated Entry Points (điểm vào không có `UI_GATE`)

| # | Entry point | Action liên quan | Permission liên quan đã tồn tại? |
|---|---|---|---|
| 1 | `v-taichinh.js:360` — nút "Thu tiền" trong bảng con nợ, màn `thu-tien` | thu tiền | CÓ (`thu-tien.thu`) nhưng **không áp dụng tại đây** |
| 2 | `v-taichinh.js:704` — nút "Thu" trong màn `cong-no` | thu tiền | CÓ (`thu-tien.thu`) nhưng **không áp dụng tại đây** |
| 3 | `v-tieuthuong.js:131` — nút "+ Tạo hợp đồng" trên chính màn `hop-dong` | tạo hợp đồng | Không (action `hop-dong.tao` chưa tồn tại) |
| 4‑20 | Toàn bộ 17 action liệt kê ở mục 3 (mọi entry point của chúng) | — | Không |

**Kết luận mục 5:** #1 và #2 là 2 trường hợp NGHIÊM TRỌNG NHẤT vì permission key `thu-tien.thu`
**đã tồn tại** và **được áp dụng đúng ở 3 nơi khác** cho cùng 1 hành động — nghĩa là hành vi mong
muốn đã rõ ràng, chỉ 2 điểm này bị bỏ sót khi code.

---

## 6. Handler Bypass Risks (UI_GATE=YES nhưng HANDLER_GATE=NO)

Trong 29 action key hiện có, chỉ **2/29** có handler tự re-check permission:
`doi-soat.gan-thu-cong` (`ds-bank-match`, `ds-bank-match-confirm`) và `doi-soat.xac-nhan-nop-quy`
(`ds-cash-confirm`) — 2 action này còn tự re-verify cả business state. **27/29 action key còn lại chỉ
gate ở UI** — bất kỳ ai có thể chạy JS trong console (ví dụ `APP.ACT['stall-status-save']({dataset:{id:'...'}})`)
đều có thể thực thi hành động bất kể `ui.role` hiện tại có quyền hay không. Đây là **đặc điểm kiến
trúc cố hữu** của app front-end thuần (không có backend chặn request), không phải lỗi implement giai
đoạn nào — nhưng mức độ đồng đều giữa các action là khác nhau (đối soát tốt hơn hẳn phần còn lại).

---

## 7. Market-Scope Risks

- **Không có mutation handler nào trong toàn bộ codebase tự so sánh `target.market` với
  `ui.market`/`A.allowedMarkets(account)`.** Bảo vệ market hiện tại hoàn toàn **gián tiếp**: dữ liệu
  hiển thị trong UI đã được lọc theo `U.inM`/Market Applicability (Phase 2) từ trước, nên trong luồng
  sử dụng bình thường, id truyền vào handler luôn thuộc đúng market. Nếu bypass UI (console/devtools),
  không có gì chặn thao tác lên 1 bản ghi thuộc market khác selectedMarket hiện tại.
- Trường hợp cụ thể xác nhận được: `stall-status-save` (so-do), `ct-extend-save`/`ct-end-save`/`ct-new-save`
  (hợp đồng), `pt-issue` (phát hành phải thu), toàn bộ handler `qh-*` (cau-truc) — không có handler
  nào trong nhóm này re-check market của bản ghi đang sửa.
- **Ngoại lệ tích cực:** `phien-cho`/`dien-nuoc` được bảo vệ ở tầng **screen** (Market Applicability
  Phase 2, `A.SCREEN_MARKET`), nên dù handler bên trong không tự check, người dùng **không thể vào
  được màn** nếu market không applicable — giảm đáng kể rủi ro cho 2 màn này so với các màn `BOTH`.

---

## 8. Business-State Risks

| Action | Business state hiện có | Enforce ở đâu | Ghi chú |
|---|---|---|---|
| `hop-dong.thanh-ly` | Cảnh báo nếu còn nợ | Chỉ hiển thị note, **không chặn** | NEED_CONFIRMATION — không tự thêm rule chặn |
| `dien-nuoc.chot-ky` | Phải ghi đủ 100% điểm mới chốt được | **Chỉ ở UI** (`disabled` attribute), handler `dn-close-confirm` không re-verify | CURRENT_GAP kỹ thuật |
| `dien-nuoc.yeu-cau-dieu-chinh` | Chỉ áp dụng cho kỳ đã `CLOSED` | Chỉ ở UI (điều kiện hiện nút), handler không re-verify | CURRENT_GAP kỹ thuật |
| `phai-thu.phat-hanh` | Không phát hành trùng kỳ đã có | Chỉ ở UI (ẩn nút), handler không re-verify | CURRENT_GAP kỹ thuật |
| `phai-thu.mien-giam` | Không miễn giảm khoản đã `paid`/đã `adjust` | Chỉ ở UI, handler không re-verify | CURRENT_GAP kỹ thuật |
| `thu-tien.thu` | Không thu vượt số còn nợ (`U.due`) | Có tính toán đúng trong `A.applyPayment`, đây là business LOGIC thật (không phải chỉ UI) | Ít rủi ro hơn các dòng trên vì logic nằm trong hàm dùng chung, không phải điều kiện hiển thị |
| `doi-soat.xac-nhan-nop-quy` | Phải `RECONCILED` và chưa `confirm` | **Re-verify trong chính handler** | Duy nhất — mẫu tham chiếu tốt |
| `su-co.chuyen-trang-thai`/`vuot-cap`/`chi-dao` | Theo đúng máy trạng thái 6 bước, không escalate 2 lần | Chỉ ở UI (điều kiện hiện nút) | CURRENT_GAP kỹ thuật, rủi ro thấp hơn (không phải tiền) |
| `cau-truc.delete` (block/floor) | Không xoá nếu còn con bên trong | Kiểm tra trong chính handler (`v-cautruc.js:235‑236,273`) — **đây là 1 trong số ít business state được re-verify thật trong handler dù KHÔNG có permission gate** | Rủi ro dữ liệu thấp nhưng vẫn thiếu permission |

---

## 9. NEED_CONFIRMATION List

Giữ nguyên toàn bộ 13 mục từ `RBAC_V1_SPEC.md` §11 (chưa mục nào được giải quyết ở Phase 1‑3, audit
này không tự quyết định thêm):

1. NV BQL (market_staff) có được xoá cấu trúc mặt bằng? (`cau-truc.delete`)
2. NV BQL có được thanh lý hợp đồng? (`hop-dong.thanh-ly`)
3. Thanh lý hợp đồng khi còn nợ: block / approve / warning?
4. NV BQL có được chốt kỳ điện nước? (`dien-nuoc.chot-ky`)
5. Ai duyệt miễn giảm/điều chỉnh khoản phải thu? (`phai-thu.mien-giam`)
6. Trưởng BQL hay Kế toán có quyền phát hành khoản phải thu cuối cùng? (`phai-thu.phat-hanh`)
7. NV BQL có được gửi thông báo hàng loạt? (`thong-bao.gui`)
8. NV BQL có được phân công sự cố? (`su-co.phan-cong`)
9. Kỹ thuật có được đóng/hoàn tất sự cố? (dùng chung `su-co.chuyen-trang-thai`)
10. Collector có được nhắc nợ (đơn lẻ/hàng loạt)? (`cong-no.nhac-no*`)
11. LĐ phường có được export đối soát? (`doi-soat.export`)
12. "Cán bộ phụ trách kinh tế/chợ" có là role riêng không?
13. `Role.scope` giữ song song với `Account.marketScopes` hay account scope là nguồn enforce chính?
    *(đã có quyết định kiến trúc từ Phase 2: Account.marketScopes là nguồn chính — mục này coi như
    đã trả lời ở tầng kiến trúc, nhưng chưa có action nào thực sự cần phân biệt case này thêm)*

**Bổ sung phát hiện mới từ audit action-level** (không có trong danh sách gốc của spec):

14. `diem-kd.export` có cần permission riêng hay để mở cho mọi role có `screen:diem-kd`?
15. `bao-cao.export` có cần permission riêng hay để mở cho mọi role có `screen:bao-cao`?
16. `cong-no.export` có cần permission riêng hay tương tự trên?
17. Mức độ granularity mong muốn cho `cai-dat.vai-tro.*` — 1 permission chung "quản lý vai trò" hay
    tách riêng tạo/sửa/khoá/xoá như spec đã liệt kê tên?

---

## 10. Proposed V1 Action Matrix (ĐỀ XUẤT — chưa implement)

Áp dụng nguyên tắc least-privilege đã chốt ở mục 9 yêu cầu: role chỉ nhận thêm action khi **đã có
CONFIRMED_V1 rõ ràng** từ RBAC_V1_SPEC hoặc suy luận trực tiếp không mơ hồ; mọi ô còn nghi vấn để
trống (không tự cấp).

| Action | system_admin | ward_leader | market_manager | market_staff | accountant | collector | technician | trader |
|---|---|---|---|---|---|---|---|---|
| cau-truc.edit | — | — | ✓ | ✓ | — | — | — | — |
| cau-truc.delete | — | — | ✓ | ? | — | — | — | — |
| cau-truc.reset | — | — | ✓ | — | — | — | — | — |
| so-do.xem-ho-so | — | ✓ | ✓ | ✓ | — | — | — | — |
| so-do.tao-hop-dong / hop-dong.tao | — | — | ✓ | ✓ | — | — | — | — |
| so-do.doi-trang-thai | — | — | ✓ | ✓ | — | — | — | — |
| phien-cho.chot-phien | — | — | ✓ | ✓ | — | — | — | — |
| tieu-thuong.them-moi | — | — | ✓ | ✓ | — | — | — | — |
| hop-dong.gia-han | — | — | ✓ | ✓ | — | — | — | — |
| hop-dong.thanh-ly | — | — | ✓ | ? | — | — | — | — |
| dien-nuoc.ghi-chi-so | — | — | ✓ | ✓ | — | — | — | — |
| dien-nuoc.chot-ky | — | — | ✓ | ? | — | — | — | — |
| dien-nuoc.yeu-cau-dieu-chinh | — | — | ✓ | ✓ | — | — | — | — |
| phai-thu.phat-hanh | — | — | ✓ | — | ✓ | — | — | — |
| phai-thu.mien-giam | — | — | ? | — | ? | — | — | — |
| thu-tien.thu | — | — | ✓ | — | ✓ | ✓ | — | — |
| doi-soat.xem-ngan-hang | — | ✓ | ✓ | — | ✓ | — | — | — |
| doi-soat.gan-thu-cong | — | — | ✓ | — | ✓ | — | — | — |
| doi-soat.xem-tien-mat | — | ✓ | ✓ | — | ✓ | — | — | — |
| doi-soat.xac-nhan-nop-quy | — | — | ✓ | — | ✓ | — | — | — |
| doi-soat.xem-truy-vet | — | — | ✓ | — | ✓ | — | — | — |
| doi-soat.export | — | ? | ✓ | — | ✓ | — | — | — |
| cong-no.nhac-no | — | — | ✓ | ✓ | ✓ | ? | — | — |
| cong-no.nhac-no-hang-loat | — | — | ✓ | ? | ✓ | ? | — | — |
| su-co.tao-phan-anh | — | — | ✓ | ✓ | — | — | — | — |
| su-co.phan-cong | — | — | ✓ | ? | — | — | — | — |
| su-co.chuyen-trang-thai | — | — | ✓ | ✓ | — | — | ✓* | — |
| su-co.vuot-cap | — | — | ✓ | — | — | — | — | — |
| su-co.chi-dao | — | ✓ | — | — | — | — | — | — |
| thong-bao.gui | — | — | ✓ | ? | — | — | — | — |
| tai-khoan.* (4 action) | ✓ | — | — | — | — | — | — | — |
| cai-dat.gia-*/dich-vu-khac/ky-thu/quy-tac-thu-phi | ✓ | — | — | — | — | — | — | — |
| cai-dat.vai-tro.* | ✓ | — | — | — | — | — | — | — |
| cai-dat.phan-quyen | ✓ | — | — | — | — | — | — | — |
| cai-dat.reset-demo | ✓ | — | — | — | — | — | — | — |

`✓` = CONFIRMED_V1 (có căn cứ rõ từ RBAC_V1_SPEC hoặc suy luận trực tiếp) · `?` = NEED_CONFIRMATION
(không tự cấp) · `—` = không cấp mặc định. `*` technician chỉ nên nhận `su-co.chuyen-trang-thai` nếu
mục 9 câu hỏi #9 (đóng sự cố) được xác nhận — hiện để `✓*` có điều kiện, **KHÔNG coi là đã chốt**.

---

## 11. Phạm vi chợ theo Account — xác nhận riêng theo mục 11 yêu cầu

- **Đã xác nhận đúng theo yêu cầu:** `marketScopes` là thuộc tính của **Account**, không hard-code
  theo Role — `js/accounts.js` cho thấy 3 account cùng role `collector` (AC-NV03, AC-NV04 đều CL;
  AC-NV07 TTD) có `marketScopes` khác nhau, đúng ví dụ nêu trong yêu cầu.
- **Màn "Tài khoản người dùng" ĐÃ có UI cho system_admin cấu hình `marketScopes` theo từng account**
  (dropdown "Phạm vi chợ", gate bởi `tai-khoan.gan-quyen`, `v-vanhanh.js:264`) — không phải
  `NOT_IMPLEMENTED` như một số hệ thống khác có thể thiếu.
- **UI GAP thật sự tìm thấy:** dropdown "Phạm vi chợ" chỉ cho chọn **1 giá trị duy nhất** —
  `'ALL'` hoặc đúng 1 market (`A.CH['af-scope'] = el => { ui.accForm.marketScopes = [el.value]; }`,
  `v-vanhanh.js:338`) — **không có cách chọn chính xác tập con nhiều-nhưng-không-phải-tất-cả** (trong
  prototype hiện tại việc này vô hại vì chỉ có đúng 2 market nên "cả 2" = "ALL" về mặt kết quả, nhưng
  về mặt UI/dữ liệu là 2 khái niệm khác nhau bị gộp làm một). Ghi nhận **UI_GAP**, không sửa ở audit
  này.

---

## 12. Recommended Implementation Order cho Phase 4B

1. **`thu-tien.thu`** — vá 2 entry point ungated (`v-taichinh.js:360,704`) trước tiên; đây là gap tài
   chính nghiêm trọng nhất và permission key đã sẵn có, không cần quyết định nghiệp vụ mới.
2. **`cai-dat.vai-tro.*` + `cai-dat.phan-quyen`** — thêm permission cho chính cơ chế quản trị quyền,
   ưu tiên cao dù rủi ro khai thác hiện tại thấp (nguyên tắc "bảo vệ cái bảo vệ hệ thống" trước).
3. **`hop-dong.tao/gia-han/thanh-ly`** — thêm 3 key mới + đồng bộ gate cho entry point trùng với
   `so-do.tao-hop-dong`; chờ xác nhận mục 9 câu 2, 3 trước khi gán role cho `market_staff`/thanh lý.
4. **`cau-truc.edit/delete/reset`** — thêm 3 key mới, gate ~20 handler hiện có.
5. **`phai-thu.phat-hanh`** — thêm key mới; đồng thời cân nhắc thêm re-verify business state
   (không double-issue) trong chính handler theo mẫu `ds-cash-confirm`.
6. **`cong-no.*` (3 key) + `thong-bao.gui`** — nhóm rủi ro trung bình còn lại.
7. **Đồng bộ `actionRoles` seed hiện có** cho khớp định hướng V1 (thêm `market_staff`/`accountant`
   vào các key đã tồn tại nhưng seed còn thiếu — mục 2) + dọn 8 key `tai-khoan.*`/`cai-dat.*` đang
   sai default role (`market_manager`) dù hiện không khai thác được.
8. **`doi-soat.export`, `bao-cao.export`, `diem-kd.export`, `cong-no.export`** — nhóm export rủi ro
   thấp nhất, làm sau cùng.
9. Cân nhắc thêm **handler-level re-check** cho các action đã có permission nhưng chỉ gate UI (mục 6),
   ưu tiên theo đúng thứ tự rủi ro ở trên, dùng `ds-bank-match`/`ds-cash-confirm` làm mẫu tham chiếu.

*(Thứ tự này là ĐỀ XUẤT tham khảo cho Phase 4B, không phải quyết định đã chốt — vẫn cần xác nhận các
mục NEED_CONFIRMATION liên quan trước khi code từng bước.)*

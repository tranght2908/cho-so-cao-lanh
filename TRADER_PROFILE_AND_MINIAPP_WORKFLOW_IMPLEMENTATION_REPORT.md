# Quản lý hồ sơ tiểu thương + Đăng ký/Liên kết tài khoản Mini App — Implementation Report

Phạm vi: Chợ Cao Lãnh. FE prototype thuần (HTML/CSS/JS/mock data/localStorage) — không backend, không
API, không OCR/OTP/upload thật.

## 1. Audit architecture (trước khi sửa)

- **Trader model** (`data.js`): `{id:'TTxxxx', name, gender, phone, idNo, birth, address, market, cat,
  hkd, since, app:boolean, bank, stalls:[]}`. `app` chỉ là cờ "đã cài app" thuần hiển thị/thống kê —
  **không phải** quan hệ tài khoản. Không có `profileStatus`/`source`/`docFiles` mặc định (docFiles
  chỉ được gán lazy qua thao tác "Thay thế" trong drawer).
- **Account model** (`js/accounts.js`): hoàn toàn KHÔNG có field liên kết tới trader. `AC-TT01`/
  `AC-TT02` (role `trader`) là 2 account demo **độc lập**, tên/SĐT riêng, không tham chiếu bất kỳ bản
  ghi nào trong `A.db.traders`.
- **Mini App hiện tại** (`js/mini.js`): không có khái niệm "đăng nhập bằng account" — `trader()` lấy
  thẳng 1 bản ghi `A.db.traders` qua `ui.mini.traderId`, với fallback bắt buộc `t.stalls.length > 0`.
  Dropdown "Xem với tư cách tiểu thương mẫu" chọn trực tiếp từ `A.db.traders`, không qua Account.
  Không có luồng đăng ký nào tồn tại trước đây.
- **Màn Tiểu thương CL** (`js/v-tieuthuong.js`): danh sách/lọc theo khu vực-ngành hàng-mini app (cờ
  `t.app`) đã có; modal "+ Thêm tiểu thương" chỉ 1 bước (không stepper, không bước hồ sơ số hóa,
  không chặn trùng CCCD — chỉ toast nếu trùng); drawer chi tiết có sẵn Section A-D, **chưa có** Section
  E (tài khoản Mini App); OCR mock cơ bản (1 nút, tự điền, không có bước riêng).
  đã có: `so-do.xem-ho-so`.
- **Permission**: `action:tieu-thuong.them-moi` (market_manager, market_staff) dùng chung cho add/edit.
  Không có permKey nào cho xác minh/liên kết.
- **Account Management** (`js/v-vanhanh.js`): bảng mặc định hiển thị TẤT CẢ account kể cả role
  `trader` — chưa lọc theo yêu cầu.

**Kết luận audit**: hầu hết yêu cầu là MỚI hoàn toàn (không có gì để "tiếp quản dở dang"); phải bổ
sung field mới an toàn/backward-compatible cho cả Trader và Account, và một collection nhỏ MỚI cho
"yêu cầu liên kết" (không phải Trader Profile) — không có blocker nghiêm trọng.

## 2. Files changed

| File | Nội dung |
|---|---|
| `data.js` | +field mới trên trader (`profileStatus/source/supplementNote/licenseNo/licenseDate`), mảng mới `miniLinkRequests`, 2 bản ghi demo (case 3, case 4). Bump `VERSION` 11→12. |
| `js/accounts.js` | +field `traderId` trên Account, safe-merge migration, `A.ACCOUNTS.byTraderId()`. |
| `js/core.js` | `A.ensureMiniAppDemoLink()` — liên kết 1 lần AC-TT01 với trader đang thuê KA-A01 (demo case 1), gọi trong `A.load()`. |
| `js/permissions.js` | +1 permKey `action:tieu-thuong.xac-minh`. Bump `PERM_SEED_VERSION` 11→12. |
| `js/v-tieuthuong.js` | Toàn bộ UI Web BQL: tabs/filter trạng thái hồ sơ + Mini App, wizard 4 bước "+ Thêm tiểu thương" (OCR/hồ sơ số hóa/chặn trùng), Section E drawer chi tiết, 2 popup xác minh (hồ sơ mới / yêu cầu liên kết), yêu cầu bổ sung. |
| `js/v-vanhanh.js` | Lọc mặc định ẩn account role trader khỏi bảng "Tài khoản người dùng". |
| `js/mini.js` | Đăng ký Mini App 6 bước, màn trạng thái hồ sơ (PENDING/NEEDS_SUPPLEMENT/INACTIVE), màn chờ liên kết + tự chuyển khi được duyệt, luồng bổ sung & gửi lại. |

**Không đụng**: `styles.css`, `index.html`, `js/v-cautruc.js`, `js/v-dieuhanh.js`, `js/v-taichinh.js`
(kể cả các chỗ dùng `t.app` cho dashboard/công nợ — cố tình giữ nguyên, xem mục 18), module Hợp
đồng/Công nợ/Điểm kinh doanh/SPLIT/MERGE/CONVERT.

## 3. Trader schema changes

Thêm (additive, mọi trader cũ tự có `ACTIVE`/`STAFF` sau khi bump VERSION rebuild):

```js
profileStatus: 'ACTIVE' | 'PENDING_VERIFICATION' | 'NEEDS_SUPPLEMENT' | 'INACTIVE'
source: 'STAFF' | 'MINI_APP'
supplementNote: string
licenseNo, licenseDate: string | null
docFiles: { cccdFront, cccdBack, dkkd, avatar } // đổi shape từ {cccd, dkkd, avatar} — mock rỗng mặc định nên không mất dữ liệu thật nào
verifyLog: [{key, at, by, note?}] // chỉ trader nguồn MINI_APP mới có, phục vụ "E. Lịch sử xử lý"
```

`t.app` (cờ "đã cài app" cũ) **giữ nguyên, không đổi ý nghĩa** — vẫn dùng cho dashboard/báo cáo/công
nợ (`v-dieuhanh.js`, `v-taichinh.js`, bảng TTĐ). Concept mới "liên kết Mini App" hoàn toàn tách biệt,
đọc qua `A.ACCOUNTS.byTraderId()`.

## 4. Account relation

```js
Account { ..., traderId: string | null }
```

Safe-merge: `ensureTraderIdField()` bổ sung `traderId: null` cho account đã lưu chưa có field này —
không đụng giá trị nào khác. `A.ACCOUNTS.byTraderId(id)` là API tra cứu MỚI duy nhất.

`A.ensureMiniAppDemoLink()` (core.js, chạy 1 lần trong `A.load()`, idempotent) liên kết demo
`AC-TT01` với đúng trader đang thuê `CL-KA-A01` (Ngô Văn Nam, deterministic vì seed RNG cố định) —
chỉ để có sẵn **Case 1** mà không cần thao tác tay; **không** chạy lại nếu đã có bất kỳ account trader
nào có `traderId`.

## 5. Profile status model

| Value | Label UI | Ý nghĩa |
|---|---|---|
| `ACTIVE` | Đang hoạt động | Hồ sơ chính thức |
| `PENDING_VERIFICATION` | Chờ xác minh | Đăng ký mới qua Mini App, chưa xác nhận |
| `NEEDS_SUPPLEMENT` | Cần bổ sung | NV BQL yêu cầu bổ sung thông tin/tài liệu |
| `INACTIVE` | Ngừng hoạt động | Dự phòng field (chưa có luồng nào tự chuyển sang trạng thái này ở V1 — xem NEED_CONFIRMATION) |

Độc lập hoàn toàn với Mini App status (mục 6).

## 6. Mini App status model

Không tạo enum lưu trực tiếp trên trader — suy ra ĐỘNG từ quan hệ Account có sẵn (đúng gợi ý "nếu
account model đã biểu diễn bằng traderId/status → reuse"):

```js
function ttMiniAppState(t) {
  const acc = A.ACCOUNTS.byTraderId(t.id);
  if (acc) return acc.status === 'active' ? 'LINKED' : 'LOCKED';
  return ttPendingLinkRequest(t) ? 'PENDING_LINK' : 'NOT_LINKED';
}
```

`PENDING_LINK` chỉ áp dụng cho trader đang là `matchedTraderId` của 1 `miniLinkRequests` status
`PENDING_LINK`. Label UI: Chưa liên kết / Chờ liên kết / Đã liên kết / Đã khóa — khớp đúng yêu cầu.

## 7. Manual create workflow (Web BQL)

Modal `ttForm()` cũ (1 bước) → thay bằng wizard 4 bước dùng chung 1 draft (`ttWizardDraft`), tái dùng
đúng pattern drawer scroll-đúng (`ycSetModal`, đã có sẵn từ nghiệp vụ Tách/Gộp/Chuyển đổi điểm — không
tạo cơ chế modal mới): **1. Thông tin cá nhân → 2. Thông tin kinh doanh → 3. Hồ sơ số hóa → 4. Kiểm
tra & lưu**. Điều hướng bước qua `.seg` (cùng style tab tách/gộp/chuyển đổi điểm), có thể bấm quay lại
bước đã qua (`tt-wizard-goto`, không cho nhảy tới bước chưa qua). Mã tiểu thương KHÔNG cho nhập — sinh
bởi `ttNextId()` (helper mới, cùng logic robust `dkReqNextId()` đã dùng cho pointRequests) khi bấm Lưu.

Trader tạo thủ công: `profileStatus: 'ACTIVE'` ngay (xem NEED_CONFIRMATION #1), `source: 'STAFF'`,
`app: false`, Mini App mặc định "Chưa liên kết" (không tạo Account nào). Không tạo hợp đồng/gán điểm/
khoản phải thu — đúng yêu cầu.

## 8. OCR mock

Bước 1 có nút "📷 Quét CCCD / OCR giả lập" (`tt-wizard-ocr`) — điền `TT_OCR_SAMPLE` (họ tên/CCCD/năm
sinh/giới tính/địa chỉ) vào draft + hiện banner "Thông tin được nhận diện tự động. Vui lòng kiểm tra
trước khi lưu." NV BQL vẫn sửa được mọi field sau đó. Không OCR thật, không API ngoài.

## 9. Documents

`TT_DOCS` (đổi từ 3→4 mục: **CCCD - Mặt trước / CCCD - Mặt sau** thay cho "CCCD 2 mặt" gộp cũ, +GCN
ĐKKD, +Ảnh chân dung) — dùng CHUNG cho: wizard bước 3 (`tt-wizard-doc-pick`, mock file input), drawer
Section B (view/edit), popup xác minh Section C, VÀ expose qua `A.ttDocDefs` để Mini App (bước 5 đăng
ký + màn bổ sung) dùng lại **đúng 1 danh mục duy nhất** (không tạo danh mục song song). Chỉ lưu mock
metadata `{name}`, không upload thật.

## 10. Duplicate detection

`ttDuplicateCheck(idNo, phone)`:
- CCCD trùng CHÍNH XÁC → `BLOCK` — hiện đúng UI mẫu trong yêu cầu ("Phát hiện hồ sơ tiểu thương đã
  tồn tại. TTxxxx · Tên · SĐT che" + nút "[Xem hồ sơ]"), nút Lưu bị `disabled`, handler `tt-wizard-save`
  re-check lại (không chỉ dựa UI).
- SĐT trùng (CCCD khác) → `WARNING` — bắt buộc tick checkbox "Tôi đã kiểm tra, đây là 2 tiểu thương
  khác nhau" mới cho Lưu (không silently tạo trùng).
- Áp dụng ở CẢ 2 nơi: wizard Web BQL (chặn tạo mới) và đăng ký Mini App (chỉ theo CCCD, xem mục 11 —
  quyết định case A/B, không có bước "cảnh báo SĐT" phía trader vì trader không có quyền tự quyết
  liên kết).

## 11. Mini App registration

6 bước: SĐT → OTP giả lập (6 ô, tự điền, không SMS thật) → Thông tin cá nhân → Thông tin kinh doanh
→ Hồ sơ số hóa (4 card, `A.ttDocDefs`) → Kiểm tra & gửi. State `ui.mini.regStep`/`regDraft` — hoàn
toàn tách khỏi `traderId` (chưa có identity thật cho tới khi gửi). Entry point: nút "Chưa có tài
khoản? Đăng ký Mini App" trên màn đăng nhập hiện có.

Gửi đăng ký (`mini-reg-submit`) — so khớp CCCD với `A.db.traders`:
- **Không khớp** → tạo Trader Profile mới NGAY (`profileStatus: PENDING_VERIFICATION`, `source:
  MINI_APP`, `stalls: []`) + `mini().traderId` trỏ vào đó → trader "vào app" nhưng chỉ thấy màn trạng
  thái (không phải app đầy đủ).
- **Khớp CCCD chính xác** → **KHÔNG** tạo trader mới. Tạo 1 bản ghi MỚI trong `A.db.miniLinkRequests`
  (collection nhỏ, hoàn toàn mới, KHÔNG phải bản sao Trader Profile — chỉ giữ dữ liệu THÔ do Mini App
  nộp để so sánh) với `status: PENDING_LINK`, `matchedTraderId`. `mini().pendingLinkId` trỏ vào đó.

`trader()` (mini.js) đã BỎ điều kiện `!t.stalls.length` để cho phép "đăng nhập" như 1 trader chưa có
điểm kinh doanh (không ảnh hưởng dropdown demo hiện có — dropdown vẫn tự lọc chỉ trader có stalls).

## 12. BQL verification

Tab "Chờ xác minh" (màn Tiểu thương) hợp nhất 2 nguồn (`ttVerifyQueue()`): trader thật
`PENDING_VERIFICATION` + `miniLinkRequests` `PENDING_LINK` — 1 bảng, cột "Nguồn"/"Trạng thái" phân
biệt rõ ("Chờ xác minh" vs "Đề nghị liên kết").

- **Popup CASE A** (`tt-verify-open`, hồ sơ mới): bố cục A-E đúng mẫu yêu cầu (Thông tin cá nhân /
  Thông tin kinh doanh / Hồ sơ số hóa / Kiểm tra trùng / Lịch sử xử lý). Footer: [Yêu cầu bổ sung] +
  [Xác nhận hồ sơ] (không có nút "liên kết" vì không có match).
- **Popup CASE B** (`tt-verify-link-open`, yêu cầu liên kết): bảng so sánh "Hệ thống hiện tại (TTxxxx)
  vs Thông tin Mini App" (5 dòng: họ tên/CCCD/SĐT/giới tính/địa chỉ) + cảnh báo trùng CCCD tường minh.
  Footer: [Từ chối] + **[Liên kết với TTxxxx]** (không phải "xác nhận tạo hồ sơ" — đúng yêu cầu mục 26).

`ttCreateLinkedAccount()` — hàm dùng CHUNG cho cả 2 nút xác nhận, tự re-check `A.ACCOUNTS.byTraderId()`
trước khi tạo (không tạo account trùng). Sinh id theo convention có sẵn `AC-TTxx` (kế tiếp
`AC-TT01/02`).

## 13. Existing profile linking

`tt-verify-link-confirm` **CHỈ**: (1) tạo Account mới `traderId = matchedTraderId`, (2) đổi
`miniLinkRequests.status = 'LINKED'` + ghi lịch sử. **KHÔNG** đụng bất kỳ field nào của Trader Profile
hiện có (`name/idNo/phone/address/hkd/stalls/...` giữ nguyên 100%) — đã verify bằng test thực tế
(mục 19 Regression, TEST 7).

## 14. Supplement workflow

`tt-verify-supplement-save` (chỉ áp dụng CASE A — trader thật đã tồn tại, PENDING_VERIFICATION):
`profileStatus → NEEDS_SUPPLEMENT`, ghi `supplementNote` + `verifyLog`. Mini App
(`screenProfileStatus`) hiện đúng banner + nội dung yêu cầu, nút "Cập nhật & gửi lại" mở form
(`screenSupplementForm`, prefill từ chính hồ sơ trader) cho sửa họ tên/CCCD/SĐT/địa chỉ/4 tài liệu —
`mini-supplement-save` set lại `PENDING_VERIFICATION` + ghi `verifyLog` resubmitted. Không có
notification API — chỉ đổi state + hiển thị trực tiếp.

## 15. Account management filtering

`accRows()` (`js/v-vanhanh.js`) thêm điều kiện `hideTraders = f.type !== 'Tiểu thương'` — bảng MẶC
ĐỊNH ẩn `accountType === 'Tiểu thương'`; nếu NV/admin chủ động chọn filter "Loại tài khoản: Tiểu
thương" thì vẫn tra cứu được (không khoá cứng, chỉ ẩn theo mặc định). KPI "Tiểu thương" (đếm tổng)
giữ nguyên không đổi. Đã verify: bảng mặc định 0 dòng trader, chọn filter → hiện đủ cả 4 account demo
tạo trong lúc test.

## 16. Market scope

Toàn bộ luồng mới (wizard, verify popup, đăng ký Mini App) đều cố định `market: 'CL'`/dùng
`ui.market` hiện có, không thêm cơ chế chọn/chuyển chợ. Danh sách/tab tiểu thương vẫn qua
`U.inM(t)` sẵn có (lọc theo `ui.market`) — không đổi hành vi TTĐ (`ttViewGeneric`/`ttRows` giữ
nguyên, không chạm 1 dòng).

## 17. Permission changes

1 permKey mới `action:tieu-thuong.xac-minh` (group "Tiểu thương & hợp đồng", screen `tieu-thuong`),
mặc định `market_manager` + `market_staff` (cùng ma trận `tieu-thuong.them-moi` — xem NEED_CONFIRMATION
#3). Safe-merge qua đúng cơ chế `mergeIntoCurrentSeed()`/`loadState()` có sẵn (đã verify: permKey tự
xuất hiện đúng ma trận ngay từ lần load đầu, không cần thao tác thêm). Mọi handler xác minh/liên kết/
khóa Mini App đều gọi `A.canDo('tieu-thuong.xac-minh', market)` **trong chính handler**, không chỉ dựa
ẩn/hiện nút.

## 18. Existing module compatibility

- **Hợp đồng/Công nợ/Điểm kinh doanh**: đọc-only, không sửa 1 dòng logic nghiệp vụ nào (`U.traderDebt`,
  `A.idx.contract`, `st.contractId`... giữ nguyên).
- **`t.app`**: giữ nguyên ý nghĩa/giá trị cũ, các màn ngoài phạm vi (`v-dieuhanh.js` dashboard,
  `v-taichinh.js` danh sách nợ, `ttViewGeneric`/TTĐ) **không đụng** — vẫn đọc `t.app` như cũ.
- **SPLIT/MERGE/CONVERT**: không sửa 1 dòng handler/state machine nào của 3 nghiệp vụ này — đã chạy
  lại full 1 lượt SPLIT (YC-0016: submit→approve→execute→COMPLETED) qua đúng UI thật để xác nhận.
- **Mini App hiện có**: split/merge/convert-request-của-tiểu-thương, thanh toán QR, phản ánh... không
  đổi handler nào — chỉ thêm nhánh dispatch MỚI ở đầu `phone()` (không chạm nhánh cũ) + nới lỏng đúng
  1 điều kiện trong `trader()`.

## 19. Regression results (test thực tế qua Chrome, không chỉ đọc code)

| # | Kịch bản | Kết quả |
|---|---|---|
| 1 | Tạo trader thủ công đủ luồng (OCR mock → sửa tay → hồ sơ số hóa → kiểm tra & lưu) | PASS — TT0276 tạo đúng, `ACTIVE`, `source:STAFF` |
| 2 | Trader mới không có điểm | PASS — Section C hiện "Tiểu thương chưa có điểm kinh doanh đang sử dụng." |
| 3 | Duplicate CCCD (trùng TT0001) | PASS — bị chặn đúng UI mẫu, nút Lưu disabled |
| 4 | Duplicate SĐT (CCCD khác) | PASS — warning + checkbox bắt buộc, disabled tới khi tick |
| 5 | Mini App đăng ký mới (CASE A) | PASS — trader mới PENDING_VERIFICATION, xuất hiện ngay tab "Chờ xác minh" |
| 6 | BQL xác nhận hồ sơ mới | PASS — `ACTIVE` + tạo Account mới `AC-TT04` liên kết đúng `traderId` |
| 7 | Mini App đăng ký CCCD trùng TT có sẵn (CASE B) | PASS — không tạo trader mới, tạo `miniLinkRequests` `PENDING_LINK`; sau khi Liên kết: field TT0004/TT0003 **không đổi** (verify trực tiếp qua JS), chỉ có Account mới xuất hiện |
| 8 | Yêu cầu bổ sung → Mini App thấy → bổ sung → gửi lại | PASS — full loop `NEEDS_SUPPLEMENT → PENDING_VERIFICATION`, `verifyLog` ghi đủ 2 bước |
| 9 | Account management ẩn trader mặc định | PASS — bảng mặc định 0 dòng trader; lọc "Tiểu thương" vẫn thấy đủ 4 account; `AC-TTxx` không bị xoá, Mini App login không hỏng |
| 10 | Trader detail đọc point/contract/debt | PASS — Section C/D không đổi hành vi |
| 11 | Market scope | PASS — mọi dropdown/tab chỉ CL |
| 12 | Mini App hiện có (thanh toán/phản ánh/split/merge/convert-request) | PASS — không lỗi khi thao tác lại |
| 13 | SPLIT/MERGE/CONVERT | PASS — chạy lại 1 lượt SPLIT đầy đủ qua UI thật, hoàn thành, không lỗi |
| 14 | `node --check` | PASS — 12/12 file JS của dự án |
| 15 | Console trình duyệt | PASS — 0 lỗi qua toàn bộ phiên test (nhiều lần load lại, chuyển tài khoản, điều hướng tất cả 16 màn) |

**Bug phát hiện + đã sửa trong lúc test (không phải do audit tĩnh mà nhờ chạy tay)**:
- Nút "Tiếp theo"/"Lưu hồ sơ" ở wizard bị kẹt `disabled` sau khi gõ CCCD/SĐT (thiếu rerender) — đã
  sửa (`ttWizardRerender()` trong 3 handler `ttw-name/idno/phone`).
- Label lịch sử xử lý thiếu key `submitted` (hiện chữ thô thay vì "Gửi đăng ký") — đã sửa.
- **Bug quan trọng nhất**: `demo-account` (chuyển tài khoản demo — cách DUY NHẤT để "đóng vai" BQL rồi
  quay lại vai trader trong prototype này) gọi chung `A.resetMiniRequestState()` — nếu để hàm này xoá
  luôn `regStep/regDraft/pendingLinkId/supplementDraft` (như tôi làm ban đầu) thì đúng luồng bắt buộc
  "trader gửi đăng ký → đổi account demo sang NV BQL xác nhận → đổi lại account demo về trader xem kết
  quả" sẽ mất trắng trạng thái `pendingLinkId` ngay ở bước đổi account đầu tiên. Đã tách riêng
  `miniResetRegState()` chỉ gọi từ `mini-trader` (đổi tiểu thương mẫu)/không gọi từ `demo-account` hay
  `mini-logout` — verify lại bằng đúng kịch bản đó (CASE B), tự chuyển màn thành công.
- Demo data case 4 ban đầu trùng trader với case 1 (cùng dùng người thuê KA-A01) khiến việc "liên kết"
  luôn tái sử dụng account đã liên kết sẵn thay vì tạo mới — đã đổi case 4 sang người thuê KA-A02.

## 20. `node --check`

```
data.js OK · js/core.js OK · js/permissions.js OK · js/accounts.js OK
js/v-tieuthuong.js OK · js/v-vanhanh.js OK · js/mini.js OK
(+ 5 file không đụng: v-cautruc.js/v-dieuhanh.js/v-taichinh.js/bankaccounts.js/serviceconfig.js — vẫn OK)
```

## 21. Browser console

0 lỗi/uncaught exception trong toàn bộ phiên test (Chrome thật, `read_console_messages(onlyErrors:true)`),
qua tất cả 16 màn hình + toàn bộ luồng mới + regression SPLIT.

## 22. Known limitations

- Chưa có cơ chế thực sự "resume đúng phiên điện thoại" khi đổi Tài khoản demo nhiều lần liên tiếp
  theo những cách phức tạp hơn kịch bản đã test (ví dụ đổi tiểu thương mẫu NGAY GIỮA lúc đang có
  `pendingLinkId`) — đã cố tình để `mini-trader` xoá sạch state đăng ký (đúng ngữ nghĩa "đổi danh
  tính điện thoại"), nghĩa là nếu người demo bấm đổi tiểu thương mẫu thay vì đổi Tài khoản demo giữa
  chừng, `pendingLinkId` sẽ mất — chấp nhận được vì đó thực sự là hành động "đổi người dùng điện thoại".
- Trạng thái `INACTIVE` có đủ label/UI nhưng KHÔNG có luồng nghiệp vụ nào tự chuyển trader sang trạng
  thái này ở V1 (không có yêu cầu nào mô tả khi nào 1 hồ sơ "ngừng hoạt động") — field/tab tồn tại sẵn
  sàng, chỉ cần bổ sung 1 hành động sau này.
- "Yêu cầu bổ sung" và popup xác minh CASE A không re-check lại toàn bộ duplicate sau khi trader tự
  sửa CCCD/SĐT trong bước "Bổ sung & gửi lại" (Mini App) — chấp nhận rủi ro nhỏ cho V1 prototype, ghi
  nhận NEED_CONFIRMATION #4 bên dưới.
- "Gửi hướng dẫn đăng ký" (Section E khi chưa liên kết) chỉ là `U.toast()` — không có notification
  thật, đúng như cho phép trong yêu cầu.

## 23. NEED_CONFIRMATION

1. **Trader mới do NV BQL nhập thủ công có ACTIVE ngay hay cần verification?** → Prototype chọn
   **ACTIVE ngay** (nguồn STAFF được coi là đáng tin cậy, khác kênh Mini App tự đăng ký luôn cần
   PENDING_VERIFICATION). Có thể sai nếu quy trình thật yêu cầu NV nhập cũng phải qua duyệt cấp trên.
2. **GCN ĐKKD có bắt buộc cho mọi trader không?** → Prototype coi là **KHÔNG bắt buộc** (chỉ hiện/nhập
   khi chọn "Có giấy CN ĐKKD"), không chặn lưu nếu để trống dù đã chọn hkd=true.
3. **Ai ngoài market_staff được quyền xác minh?** → Mặc định dùng đúng ma trận `tieu-thuong.them-moi`
   hiện có (`market_manager` + `market_staff`), KHÔNG tự thêm role nào khác (accountant/collector...).
4. **Có cho trader thay đổi CCCD sau khi đã verified không?** → Giữ nguyên hành vi cũ đã có từ trước
   (`tt-edit-save` cho phép sửa CCCD không giới hạn theo trạng thái) — KHÔNG tự thêm ràng buộc mới,
   vì đây là hành vi ĐÃ TỒN TẠI trước phiên làm việc này, ngoài phạm vi yêu cầu hiện tại.
5. **Account Mini App bị khóa có ảnh hưởng profile ACTIVE không?** → Prototype chọn **KHÔNG ảnh
   hưởng** — 2 trục hoàn toàn độc lập (đã verify bằng test: khóa Account, `profileStatus` vẫn `ACTIVE`).

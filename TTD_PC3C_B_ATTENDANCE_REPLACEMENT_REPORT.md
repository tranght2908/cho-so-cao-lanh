# TTD-PC3C-B — Attendance Replacement Report

## 1. Pre-check

- Branch expected: `feature/ttd-attendance-replacement`
- HEAD expected: `2f7d0c7`
- Worktree before implementation: clean
- Result: PASS

## 2. Audit trước sửa

- Session mới đang dùng `id`, `market`, `date`, `startTime`, `endTime`, `registrationStartAt`, `registrationDeadline`, `status`, `note`, audit fields; session legacy được `sessionReadModel()`/`normalizeSession()` fallback.
- `sessionRegistrations` lưu đăng ký theo phiên với `sessionId`, `market`, `traderId`, `pointId`, `listType`, `status`, `waitlistOrder`, note/audit fields.
- `sessionAttendances` lưu điểm danh theo business key `sessionId + registrationId`, có canonical resolver deterministic.
- Official attendance lấy từ registration `approved + official`, point TTD positive-validated qua adapter, trader hiển thị lấy từ `point.traderId`.
- Waitlist hợp lệ là `waitlisted + waitlist`, trader TTD hợp lệ, `pointId` nullable.
- Permission hiện tại trước PC3C-B là `PERM_SEED_VERSION = 9`, đã có marker PC3A/B/C-A.
- Rollback hiện tại dùng snapshot own-property/value/serialized collection và `extraLog`.
- PC3C-B chỉ hợp lệ khi session `preparing`.
- Rủi ro chính: legacy state chưa có collection replacement, duplicate active replacement, cross-market point/trader giả.

## 3. Files changed

- `data.js`
- `js/permissions.js`
- `js/v-dieuhanh.js`
- `styles.css`
- `TTD_PC3C_B_ATTENDANCE_REPLACEMENT_REPORT.md`

## 4. Permission migration

- Thêm action `phien-cho.dieu-phoi-du-bi`, `screenId = phien-cho`.
- Default grant: `market_staff`.
- `market_manager` và role khác không có mutation mặc định.
- Bump `PERM_SEED_VERSION` lên `10`.
- Thêm marker `pc3cReplacementPermVersion = 1`.
- Migration chỉ thêm action mới khi chưa có role nào giữ action đó.
- Sửa merge seed loop để không cấp lại PC3 action đã bị custom revoke khi bump version.

## 5. Replacement schema

Fresh state có:

```js
sessionReplacements: []
```

Record:

```js
{
  id,
  sessionId,
  market,
  absentRegistrationId,
  absentTraderId,
  replacementRegistrationId,
  replacementTraderId,
  pointId,
  reason,
  status,
  assignedAt,
  assignedBy,
  cancelledAt,
  cancelledBy,
  cancelReason,
  createdAt,
  createdBy,
  updatedAt,
  updatedBy
}
```

Không đổi registration/attendance gốc, không đổi point/trader/contract/finance.

## 6. Business keys/canonical policy

- Active replacement unique theo `sessionId + absentRegistrationId`.
- Active replacement unique theo `sessionId + replacementRegistrationId`.
- Canonical duplicate chọn theo:
  1. `updatedAt` mới nhất;
  2. `createdAt` mới nhất;
  3. `id` theo chuỗi;
  4. stable fingerprint.
- Renderer sort bản sao trước khi dedupe, không mutate/save.
- Mutation thành công chỉ chuẩn hóa duplicate active cho business key liên quan.

## 7. Eligibility guards

Handler re-check:

- session tồn tại, market TTD, status `preparing`;
- quyền `phien-cho.dieu-phoi-du-bi`;
- account/scope TTD qua `A.canDo`;
- official absent registration hợp lệ;
- attendance canonical của official là `absent_excused` hoặc `absent_unexcused`;
- waitlist registration hợp lệ, cùng session, trader TTD;
- không duplicate active replacement;
- reason trim không rỗng.

## 8. UI/UX

- Trong attendance section, official row vắng có action `Điều phối dự bị`.
- Modal `Điều phối hộ dự bị` hiển thị hộ vắng, điểm, khu, mặt hàng, trạng thái/lý do vắng và chọn waitlist khả dụng.
- Sau điều phối, official row hiển thị `Đã có hộ thay` và tên hộ thay thế.
- Replacement row hiển thị `Hộ thay thế`, điểm của official vắng, action `Điểm danh hộ thay`.
- Có action `Hủy điều phối` khi replacement active.
- Thêm khu vực `Điều phối dự bị` để xem lịch sử active/cancelled.

## 9. Attendance của hộ thay

- Hộ thay active xuất hiện trong attendance read model bằng `replacementRegistrationId`.
- Attendance vẫn dùng business key `sessionId + registrationId`.
- Hộ dự bị chưa active replacement không xuất hiện trong attendance.
- Hủy điều phối không xóa attendance lịch sử.
- `late_notified`, `absent_excused`, `late_arrived` giữ guard PC3C-A.

## 10. KPI semantics

- KPI `Chính thức` giữ số official approved ban đầu.
- `Đã có mặt` tính `present + late_arrived`, gồm hộ thay active nếu đã điểm danh.
- `Cần xử lý` tính `pending + late_notified`, gồm hộ thay active chưa điểm danh.
- `Vắng mặt` tính `absent_excused + absent_unexcused`.
- Official vắng không bị tính thành có mặt khi có hộ thay.

## 11. Cancel workflow

- Chỉ hủy khi session `preparing`, replacement active, quyền/scope hợp lệ.
- Bắt buộc lý do hủy.
- Chuyển `status = cancelled`, lưu `cancelledAt/cancelledBy/cancelReason`.
- Không xóa record replacement hoặc attendance.
- Hộ chính thức có thể được điều phối lại sau hủy.

## 12. Rollback

- Replacement mutation snapshot:
  - own-property/value/serialized `sessionReplacements`;
  - own-property/value/serialized `sessionAttendances`;
  - `extraLog`.
- Save throw restore deep-equal, gồm cả trạng thái property chưa tồn tại.
- Không đóng modal/success toast khi save lỗi.

## 13. Role/scope matrix

- `market_staff` scope TTD: điều phối, hủy điều phối, điểm danh hộ thay.
- `market_manager`: xem mặc định, không mutation replacement mặc định.
- Staff CL: bị scope TTD chặn qua `A.canDo`.
- Role khác: không có mutation mặc định.

## 14. VM/stub results

PASS:

- Fresh state có `sessionReplacements`.
- Permission fresh: staff có action, manager không có mặc định.
- Existing state thiếu action được migrate.
- Custom revoke/grant PC3 được giữ.
- Render replacement active không mutate state.
- Duplicate active legacy chọn canonical mới nhất độc lập thứ tự mảng.
- Direct replacement-save tạo đúng active replacement.
- Duplicate active absent bị chặn và không save.
- Save throw rollback property missing deep-equal.
- Cancel replacement giữ attendance lịch sử.

## 15. Regression

- PC3C-A attendance canonical giữ nguyên.
- Registration workflow PC3B không đổi.
- Session lifecycle/transition không đổi.
- `SESSION_FEE = 20000`.
- Không ghi `session.booths`.
- Không tạo finance record.
- Không sửa stalls/contracts/traders/accounts/routes.

## 16. Data invariants

Render/tab switch không mutate:

- sessions
- sessionRegistrations
- sessionAttendances
- sessionReplacements
- extraLog
- stalls/traders/contracts/invoices/payments

## 17. Browser smoke

Chưa chạy browser thật trong môi trường này. Đã kiểm VM/stub và static.

## 18. Static checks

- `node --check data.js`: PASS
- `node --check js/permissions.js`: PASS
- `node --check js/v-dieuhanh.js`: PASS

## 19. Rủi ro/giới hạn

- Chưa triển khai gọi điện hộ dự bị, kết quả liên hệ, cảnh báo nghỉ nhiều, thu phí hoặc thay đổi hợp đồng.
- Nên smoke UI thủ công desktop/mobile trước khi commit.

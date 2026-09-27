# Báo cáo tài khoản mock / demo

Nguồn kiểm tra: `data.js`, `js/accounts.js`, `js/permissions.js`, `js/core.js`, `js/auth.js`.

Đây là danh sách account trong source seed mặc định. Dữ liệu trong localStorage `choso-caolanh-accounts` có thể có thêm account do người dùng tạo trong lúc chạy prototype.

| Họ tên | ID tài khoản | Số điện thoại | Role ID / tên role | marketScopes | Trạng thái source | Login SĐT |
|---|---|---|---|---|---|---|
| Trần Minh Khoa | AC-NV01 | Chưa có SĐT | `market_manager` / Trưởng Ban Quản lý chợ | CL, TTD | active | Không |
| Lê Thị Ngọc Hân | AC-NV02 | Chưa có SĐT | `collector` / Nhân viên thu phí | CL | active | Không |
| Phạm Văn Lợi | AC-NV03 | Chưa có SĐT | `collector` / Nhân viên thu phí | CL | active | Không |
| Nguyễn Thị Diễm | AC-NV04 | Chưa có SĐT | `collector` / Nhân viên thu phí | CL | active | Không |
| Võ Hoàng Tuấn | AC-NV05 | Chưa có SĐT | `technician` / Nhân viên kỹ thuật | CL | active | Không |
| Huỳnh Thanh Tâm | AC-NV06 | Chưa có SĐT | `market_manager` / Trưởng Ban Quản lý chợ | CL, TTD | active | Không |
| Đỗ Thị Kim Yến | AC-NV07 | Chưa có SĐT | `collector` / Nhân viên thu phí | TTD | active | Không |
| Mai Thị Thanh Xuân | AC-NV08 | Chưa có SĐT | `collector` / Nhân viên thu phí | TTD | active* | Không |
| Nguyễn Hoàng Phúc | AC-NV09 | Chưa có SĐT | `technician` / Nhân viên kỹ thuật | TTD | active | Không |
| Nguyễn Văn Phúc | AC-LD01 | 0909123456 | `ward_leader` / Lãnh đạo UBND phường | ALL | active | Có |
| Đặng Thị Thu | AC-QT01 | 0909234567 | `system_admin` / Quản trị hệ thống | ALL | active | Có |
| Chí Quyết | AC-CHI-QUYET | 0909000001 | `trader` / Tiểu thương | TTD | active | Có |
| Tiểu thương Chợ quê Tân Thuận Đông | AC-TT-TTD | 0909666777 | `trader` / Tiểu thương | TTD | active | Có, chưa có traderId |
| Nguyễn Thị Hoa | AC-TT01 | 0909345678 | `trader` / Tiểu thương | CL | active | Có, traderId null ở seed |
| Trần Văn Sáu | AC-TT02 | 0909456789 | `trader` / Tiểu thương | TTD | disabled (LOCKED) | Không |
| Nguyễn Văn Hòa | AC-HA-QL | Chưa có SĐT | `market_manager` / Trưởng Ban Quản lý chợ | HA | active | Không |
| Trần Thị Ngọc An | AC-HA-TP | Chưa có SĐT | `collector` / Nhân viên thu phí | HA | active | Không |
| Lê Văn Bình | AC-HA-KT | Chưa có SĐT | `technician` / Nhân viên kỹ thuật | HA | active | Không |
| Phạm Văn Việt | AC-TVH-QL | Chưa có SĐT | `market_manager` / Trưởng Ban Quản lý chợ | TVH | active | Không |
| Đặng Thị Hồng Hòa | AC-TVH-TP | Chưa có SĐT | `collector` / Nhân viên thu phí | TVH | active | Không |
| Bùi Văn Toàn | AC-TVH-KT | Chưa có SĐT | `technician` / Nhân viên kỹ thuật | TVH | active | Không |
| Ngô Văn Tây | AC-TTT-QL | Chưa có SĐT | `market_manager` / Trưởng Ban Quản lý chợ | TTT | active | Không |
| Dương Thị Mỹ Dân | AC-TTT-TP | Chưa có SĐT | `collector` / Nhân viên thu phí | TTT | active | Không |
| Lý Văn Thuận | AC-TTT-KT | Chưa có SĐT | `technician` / Nhân viên kỹ thuật | TTT | active | Không |
| Hồ Văn Lưu | AC-TL-QL | Chưa có SĐT | `market_manager` / Trưởng Ban Quản lý chợ | TL | active | Không |
| Mai Thị Bình | AC-TL-TP | Chưa có SĐT | `collector` / Nhân viên thu phí | TL | active | Không |
| Trương Văn Thông | AC-TL-KT | Chưa có SĐT | `technician` / Nhân viên kỹ thuật | TL | active | Không |
| Châu Văn Tịch | AC-TT-QL | Chưa có SĐT | `market_manager` / Trưởng Ban Quản lý chợ | TT | active | Không |
| Lâm Thị Tân | AC-TT-TP | Chưa có SĐT | `collector` / Nhân viên thu phí | TT | active | Không |
| Nguyễn Văn Đức | AC-TT-KT | Chưa có SĐT | `technician` / Nhân viên kỹ thuật | TT | active | Không |
| Trần Văn Thới | AC-TTH-QL | Chưa có SĐT | `market_manager` / Trưởng Ban Quản lý chợ | TTH | active | Không |
| Lê Thị Tịnh | AC-TTH-TP | Chưa có SĐT | `collector` / Nhân viên thu phí | TTH | active | Không |
| Phạm Văn Long | AC-TTH-KT | Chưa có SĐT | `technician` / Nhân viên kỹ thuật | TTH | active | Không |
| Huỳnh Văn Ngãi | AC-MN-QL | Chưa có SĐT | `market_manager` / Trưởng Ban Quản lý chợ | MN | active | Không |
| Võ Thị Mỹ | AC-MN-TP | Chưa có SĐT | `collector` / Nhân viên thu phí | MN | active | Không |
| Đỗ Văn Sang | AC-MN-KT | Chưa có SĐT | `technician` / Nhân viên kỹ thuật | MN | active | Không |
| Ngô Văn Hồi | AC-LH-QL | Chưa có SĐT | `market_manager` / Trưởng Ban Quản lý chợ | LH | active | Không |
| Dương Thị Long | AC-LH-TP | Chưa có SĐT | `collector` / Nhân viên thu phí | LH | active | Không |
| Hồ Văn Thịnh | AC-LH-KT | Chưa có SĐT | `technician` / Nhân viên kỹ thuật | LH | active | Không |
| Mai Văn Bèo | AC-XB-QL | Chưa có SĐT | `market_manager` / Trưởng Ban Quản lý chợ | XB | active | Không |
| Trương Thị Xẻo | AC-XB-TP | Chưa có SĐT | `collector` / Nhân viên thu phí | XB | active | Không |
| Châu Văn Phát | AC-XB-KT | Chưa có SĐT | `technician` / Nhân viên kỹ thuật | XB | active | Không |
| Lâm Văn Quốc | AC-SQ-QL | Chưa có SĐT | `market_manager` / Trưởng Ban Quản lý chợ | SQ | active | Không |
| Nguyễn Thị Sáu | AC-SQ-TP | Chưa có SĐT | `collector` / Nhân viên thu phí | SQ | active | Không |
| Lâm Văn Cường | AC-SQ-KT | Chưa có SĐT | `technician` / Nhân viên kỹ thuật | SQ | active | Không |

## SĐT dùng để test Login

| Mục tiêu | SĐT | Ghi chú |
|---|---:|---|
| Quản trị hệ thống | 0909234567 | AC-QT01 |
| Lãnh đạo UBND | 0909123456 | AC-LD01 |
| Tiểu thương có liên kết hồ sơ | 0909000001 | AC-CHI-QUYET → traderId `TTD-CQ` |
| Tiểu thương active nhưng chưa liên kết trader seed | 0909666777 | AC-TT-TTD |
| Tiểu thương active nhưng traderId null trong seed | 0909345678 | AC-TT01 |
| Kiểm tra account bị khóa | 0909456789 | AC-TT02 |

Hiện source mặc định chưa có SĐT cho Trưởng BQL, Nhân viên thu phí và Nhân viên kỹ thuật; các account này chưa thể đi qua màn Login SĐT.

## Cơ chế Login và OTP

- Màn Login tìm trực tiếp `account.phone` qua `A.ACCOUNTS.byPhone()`; so sánh sau khi bỏ ký tự không phải số.
- OTP mock cố định: `123456`.
- Status `disabled`, `locked`, `LOCKED` được diễn giải là `LOCKED`; `PENDING_ACTIVATION` chỉ được tạo cho tài khoản tiểu thương do Admin tạo trong workflow.
- Nếu OTP đúng ở trạng thái `PENDING_ACTIVATION`, code chuyển account sang `ACTIVE`, ghi `activatedAt` và `lastLoginAt`.

* `AC-NV08` có trong fresh default seed, nhưng migration localStorage cũ có danh sách loại account này. Vì vậy state đã migrate có thể không còn record đó.

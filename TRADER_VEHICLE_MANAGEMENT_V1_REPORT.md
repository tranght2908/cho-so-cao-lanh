# Trader Vehicle Management V1 — Implementation Report

## 1. Audit

- Trader detail và Contract create/detail nằm trong `js/v-tieuthuong.js`.
- Trader trước đây chưa có danh sách phương tiện. V1 bổ sung store additive `A.db.traderVehicles`.
- Contract đã có `traderId`, `stallId` và `feeSnapshot`; V1 thêm `vehicleFeeSnapshot` khi có xe được chọn.
- Cấu hình giá có sẵn `A.SERVICE_CFG.extraServices`; phí vehicle được thêm vào đúng nhóm này.
- Receivable hiện không đọc `feeSnapshot`; không thay đổi module tài chính/billing.

## 2. Files changed

- `index.html` — tải helper `js/vehicles.js`.
- `js/vehicles.js` — store mock, CRUD trạng thái vehicle, UI Trader Detail, lookup phí, snapshot khi tạo Contract.
- `js/v-tieuthuong.js` — chèn section phương tiện vào hồ sơ tiểu thương.
- `styles.css` — style gọn cho danh sách xe và chọn phí trong modal hợp đồng.

## 3. Vehicle schema and relation

`A.db.traderVehicles[]` dùng schema: `id`, `traderId`, `market`, `type`, `plateNumber`, `description`, `note`, `status`, `createdAt`, `updatedAt`.

Vehicle thuộc Trader, không thuộc BusinessPoint. `ACTIVE` được phép chọn trong hợp đồng; `INACTIVE` được giữ để truy vết lịch sử.

## 4. Vehicle UI

Trader Detail có section **Phương tiện đăng ký**, hỗ trợ thêm, sửa và ngừng sử dụng. Xe đạp được phép không có biển số. Dữ liệu mẫu tạo xe máy + xe đạp cho tiểu thương CL đầu tiên nếu chưa có vehicle nào.

## 5. Service-price relation and contract integration

Phí phương tiện được lookup theo `extraServices` với `category: VEHICLE`, `vehicleType`, `marketId` và trạng thái `active`. Modal khởi tạo hợp đồng hiển thị checkbox xe của đúng trader, giá/tháng và tổng phí. Đổi trader sẽ render lại danh sách xe, nên selection cũ không được mang sang trader mới.

## 6. Fee snapshot / Receivable compatibility

Khi lưu Contract, selected vehicle được lưu ở `vehicleFeeSnapshot`; các line tương ứng cũng được đưa vào `feeSnapshot` tương thích với UI Contract hiện có. Giá service config đổi về sau không thay đổi Contract cũ. Không tự tạo Receivable và không sửa billing engine.

## 7. Permission and scope

Các hành động cập nhật vehicle recheck `A.canDo('tieu-thuong.them-moi', trader.market)`. Tạo Contract vẫn qua `A.canDo('hop-dong.tao', market)` có sẵn; market của vehicle lấy từ Trader.

## 8. Regression results

- Trader vehicle add/edit/deactivate: implemented with local/mock state.
- Contract vehicle lookup, multi-select, total and snapshot: implemented.
- Missing service price: checkbox bị vô hiệu hóa và hiển thị cảnh báo; không gán 0đ.
- Receivable: không chạm code path hiện có.
- `node --check js/vehicles.js`: PASS.
- `node --check js/v-tieuthuong.js`: PASS.
- Browser console: cần smoke test thủ công trong browser; chưa có browser automation trong workspace.

## 9. Known limitations / NEED_CONFIRMATION

1. V1 chỉ quản lý phương tiện đăng ký + phí phương tiện, không quản lý từng lượt xe vào/ra.
2. Danh mục loại xe và các đơn giá tạo ra là **dữ liệu mẫu**; BQL cần xác nhận mức chính thức.
3. Chưa xác nhận một vehicle có được dùng trên nhiều hợp đồng/điểm hay không.
4. Chưa có workflow amendment cho thay đổi xe khi Contract đang hiệu lực; snapshot của hợp đồng cũ được giữ nguyên.
5. Không có backend, upload, kiểm soát cổng, QR/RFID/camera hay phát sinh khoản phải thu tự động.

# Chợ số Cao Lãnh – Prototype

Prototype **Hệ thống quản lý chợ số** phường Cao Lãnh, tỉnh Đồng Tháp.

**Xem trực tiếp:** https://tranght2908.github.io/cho-so-cao-lanh/


## Phạm vi

Có 02 chợ: **Chợ Cao Lãnh** (hạng 1, tòa nhà mới gồm hầm, tầng 1, tầng 2 và khu ngoài nhà lồng) và **Chợ quê Cù lao Tân Thuận Đông** (phiên chợ họp chiều thứ Bảy).

Các chức năng chính:

| Vai trò | Màn hình |
|---|---|
| Lãnh đạo UBND phường | Cổng giám sát liên chợ, sơ đồ mặt bằng, tra cứu, báo cáo, phản ánh vượt cấp |
| Ban Quản lý chợ | Sơ đồ số mặt bằng theo trạng thái; điểm kinh doanh; tiểu thương (có OCR giả lập); hợp đồng; chỉ số điện nước; phát hành khoản phải thu; thu tiền (tiền mặt, chuyển khoản, QR) và biên lai điện tử; đối soát; công nợ và nhắc nợ; sự cố (6 trạng thái); thông báo đa kênh; phiên chợ quê; báo cáo (xuất CSV); cài đặt và phân quyền |
| Tiểu thương | Mini app: đăng nhập OTP, xem và thanh toán khoản phải nộp, biên lai, hợp đồng, thông báo, gửi phản ánh, đánh giá dịch vụ |

Giá dịch vụ của Chợ Cao Lãnh lấy theo **QĐ 480/QĐ-UBND ngày 14/02/2026** của UBND tỉnh Đồng Tháp. Mức thu theo phiên của chợ quê chỉ là giả định để minh họa.

## Kỹ thuật

- Viết bằng HTML, CSS và JavaScript thuần. Không cần build, không có máy chủ.
- Dữ liệu mẫu được sinh cố định trong `data.js`.
- Các thao tác trong lúc demo (thu tiền, gửi phản ánh…) lưu ở `localStorage` của trình duyệt. Muốn quay về dữ liệu ban đầu thì bấm **Cài đặt → Đặt lại dữ liệu mẫu**.
- Chạy trên máy: mở `index.html` bằng trình duyệt.

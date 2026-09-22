# Báo cáo gộp Mặt bằng & điểm kinh doanh

## 1. Kết quả

**PASS có điều kiện.** Màn Chợ Cao Lãnh đã được gộp thành một workspace ba tab; TTD giữ renderer, route và drawer riêng. Kiểm tra browser thật đã chạy. Kiểm tra `node --check` chưa chạy được vì máy không có `node` trong `PATH`.

## 2. Pre-check

- Worktree ban đầu sạch.
- Branch ban đầu: `main`.
- Đã tạo branch: `feature/cl-layout-business-point-unification`.
- HEAD ban đầu: `fec32f1 feat: update latest prototype changes`.
- Remote: `origin` trỏ tới repository GitHub hiện tại.
- Không commit, push, merge, stash, reset hoặc stage.

## 3. Audit trước sửa

- Menu được khai báo trong `js/core.js`, nhóm `Hạ tầng chợ`.
- `mat-bang` render workspace trong `js/v-cautruc.js`; `diem-kd` CL render danh sách/yêu cầu trong `js/v-tieuthuong.js`.
- State cũ: `ui.mb` cho sơ đồ, `ui.dkTab` và `ui.f.dkcl*`/`ui.f.dkreq*` cho màn điểm kinh doanh.
- Drawer sơ đồ CL được nối từ `js/v-dieuhanh.js`; drawer danh sách/yêu cầu và các workflow nằm trong `js/v-tieuthuong.js`.
- Layout mutations dùng `cau-truc.*`; nghiệp vụ yêu cầu dùng các permission `diem-kd.*`; TTD có các guard `market === 'TTD'` riêng trong `js/v-dieuhanh.js`.

## 4. Thiết kế đã triển khai

- CL hiển thị một menu `Mặt bằng & điểm kinh doanh`.
- Ba tab dùng `ui.dkTab`: `map`, `list`, `requests`.
- Tab sơ đồ gọi lại renderer layout hiện có.
- Tab danh sách và yêu cầu gọi lại renderer/filter/action hiện có, không tạo schema mới.
- Badge yêu cầu dùng trực tiếp `A.db.pointRequests` theo `market === 'CL'`.
- CSS mới được scope dưới `.cl-layout-point-page` và `.cl-layout-point-tabs`.

## 5. Drawer và dữ liệu

- Click điểm trên sơ đồ CL và nút `Xem` trong danh sách cùng gọi `A.openDkDrawer` và cùng dùng `.dk-detail-popup`.
- Drawer yêu cầu tiếp tục dùng navigation stack hiện có.
- Không sửa `data.js`, schema, `DATA.VERSION`, localStorage migration hay collection khi render/tab switch.
- Các mutation hiện có tiếp tục là nơi duy nhất gọi `A.save()`.

## 6. Route và permission

- CL: `#/mat-bang` mở tab sơ đồ; `#/diem-kd` mở danh sách; `#/cau-truc` và `#/so-do` mở sơ đồ.
- Hash legacy CL được chuẩn hóa bằng `history.replaceState`, không tạo hashchange loop.
- `mat-bang` CL cho phép truy cập nếu có ít nhất một trong hai screen permission cũ; action vẫn kiểm tra permission key cũ.
- TTD không đi qua wrapper CL; `#/mat-bang`, `#/diem-kd` và `#/phien-cho` giữ hành vi cũ.

## 7. Files changed

- `js/core.js`: menu, label động, route alias và screen access OR cho CL.
- `js/v-cautruc.js`: expose renderer layout và tiêu đề CL có điều kiện.
- `js/v-tieuthuong.js`: wrapper ba tab và handler tab.
- `js/v-dieuhanh.js`: CL map click dùng drawer đầy đủ chung.
- `styles.css`: responsive tab strip và table wrapper scoped.
- `CL_LAYOUT_BUSINESS_POINT_UNIFICATION_REPORT.md`: báo cáo này.

## 8. Kiểm thử

Browser smoke đã kiểm tra:

- CL mở `#/mat-bang` với tab `Sơ đồ mặt bằng`.
- Tab `Danh sách điểm` có filter và bảng.
- Tab `Yêu cầu thay đổi` có badge `4`, filter và nút lập yêu cầu.
- `#/diem-kd` được chuẩn hóa về workspace chung với tab danh sách.
- `#/cau-truc` và `#/so-do` được chuẩn hóa về workspace chung với tab sơ đồ.
- Click điểm trên sơ đồ CL mở `.dk-detail-popup`.
- Click `Xem` trong danh sách mở cùng `.dk-detail-popup`.
- Chuyển sang TTD không có tab gộp, tiêu đề vẫn `Mặt bằng chợ`, renderer vẫn là workspace cũ.

Static checks:

- `git diff --check`: PASS.
- `git diff --stat`: PASS.
- `git status --short`: chỉ có các file nhiệm vụ và report.
- `node --check data.js js/core.js js/permissions.js js/v-cautruc.js js/v-dieuhanh.js`: NOT RUN, lệnh `node` không tồn tại trong `PATH`.
- Quét conflict marker: không phát hiện marker conflict thật; các kết quả là comment separator `====` hiện hữu.
- Duplicate DOM id trong `index.html`: không phát hiện.

## 9. Regression và rủi ro còn lại

- TTD không được chỉnh renderer mặt bằng, drawer, phiên chợ, đăng ký, điểm danh, xin nghỉ hoặc replacement.
- Chưa thể xác nhận bằng Node VM/stub do thiếu Node runtime trên máy.
- Browser smoke chưa thay thế đầy đủ test mutation workflow của từng trạng thái yêu cầu; các handler nghiệp vụ được tái sử dụng nguyên trạng và chưa đổi schema.
# RBAC V1 SPEC --- Hệ thống quản lý chợ số phường Cao Lãnh

> **Target:** FE Prototype. Nguồn hiện trạng:
> `CURRENT_RBAC_BASELINE.md`. Không triển khai backend/API/database/auth
> thật.

## 1. Quy ước

-   `CONFIRMED_V1`: áp dụng ngay.
-   `NEED_CONFIRMATION`: chưa đủ căn cứ, Claude không được tự quyết.
-   `NOT_IMPLEMENTED`: chưa có trong prototype, không tạo trong task
    RBAC.
-   `CURRENT_GAP`: code hiện có nhưng chưa enforce đúng.

Nguyên tắc: giữ permission engine động; không hard-code role để kiểm tra
quyền; tách Market Scope khỏi Selected Market; action phải có action
permission; `ALL` không còn là global selected market.

## 2. Role Catalog V1

  ------------------------------------------------------------------------
  Role ID            Tên               Phạm vi           Trách nhiệm
  ------------------ ----------------- ----------------- -----------------
  `system_admin`     Quản trị hệ thống Hệ thống          Account, role,
                                                         permission, cấu
                                                         hình, tích hợp,
                                                         audit

  `ward_leader`      Lãnh đạo UBND     Liên chợ          Giám sát,
                     phường                              dashboard, tra
                                                         cứu, báo cáo, chỉ
                                                         đạo

  `market_manager`   Trưởng BQL chợ    Market được phân  Điều hành/phê
                                       công              duyệt nghiệp vụ

  `market_staff`     Nhân viên BQL chợ Market được phân  Vận hành hằng
                                       công              ngày

  `accountant`       Kế toán           Market được phân  Tài chính, đối
                                       công              soát, công nợ

  `collector`        Nhân viên thu phí Market được phân  Thu tiền, cập
                                       công              nhật thu/biên lai

  `technician`       Nhân viên kỹ      Market được phân  Sự cố/kỹ
                     thuật             công              thuật/bảo trì

  `trader`           Tiểu thương       Self              Mini App, dữ liệu
                                                         của chính mình
  ------------------------------------------------------------------------

`Cán bộ phụ trách kinh tế/chợ phường`: `NEED_CONFIRMATION`.

Không tạo role riêng cho nhân viên Chợ quê. Dùng role nghiệp vụ +
`marketScopes`. `system_admin` không đồng nghĩa `market_manager`;
`collector` không đồng nghĩa `accountant`.

## 3. Account, Role và Market Scope

``` text
Account
 ├── roleIds[]
 ├── marketScopes[]
 └── status
        ↓
Permission Set
        ↓
Allowed Markets
        ↓
Selected Market
        ↓
Screen Permission
        ↓
Action Permission
        ↓
Business State
```

Market IDs: `CL` và `TTD`. Global market selector chỉ cho chọn market cụ
thể trong `account.marketScopes`; bỏ `ALL`.

Cross-market screen như Tổng quan liên chợ/Báo cáo có thể có filter nội
bộ `Tất cả | CL | TTD`; `Tất cả` chỉ bao gồm market trong scope account.

## 4. Screen Permission Matrix V1

  --------------------------------------------------------------------------------
  Screen    Admin      LĐ     Trưởng   NV BQL  Kế toán  Thu phí  Kỹ thuật   Tiểu
                     phường    BQL                                         thương
  -------- -------- -------- -------- -------- -------- -------- -------- --------
  Tổng        ✓        ✓       ---      ---      ---      ---      ---      ---
  quan                                                                    
  liên chợ                                                                

  Cấu hình   ---      ---       ✓        ✓       ---      ---      ---      ---
  mặt bằng                                                                

  Sơ đồ       ✓        ✓        ✓        ✓        ✓        ✓        ✓       ---
  mặt bằng                                                                

  Điểm        ✓        ✓        ✓        ✓        ✓        ✓       ---      ---
  kinh                                                                    
  doanh                                                                   

  Phiên      ---       ✓        ✓        ✓       ---       ✓       ---      ---
  chợ quê                                                                 

  Tiểu        ✓        ✓        ✓        ✓        ✓        ✓       ---      ---
  thương                                                                  

  Hợp đồng    ✓        ✓        ✓        ✓        ✓       ---      ---      ---

  Chỉ số     ---      ---       ✓        ✓        ✓       ---      ---      ---
  điện,                                                                   
  nước                                                                    

  Khoản      ---       ✓        ✓        ✓        ✓        ✓       ---      ---
  phải thu                                                                

  Thu tiền   ---      ---       ✓       ---       ✓        ✓       ---      ---
  & biên                                                                  
  lai                                                                     

  Đối soát   ---       ✓        ✓       ---       ✓       ---      ---      ---

  Công nợ    ---       ✓        ✓        ✓        ✓        ✓       ---      ---
  & nhắc                                                                  
  nợ                                                                      

  Phản ánh   ---       ✓        ✓        ✓       ---      ---       ✓       ---
  & sự cố                                                                 

  Thông      ---      ---       ✓        ✓       ---      ---      ---      ---
  báo đa                                                                  
  kênh                                                                    

  Báo cáo     ✓        ✓        ✓        ✓        ✓       ---      ---      ---
  thống kê                                                                

  Tài         ✓       ---      ---      ---      ---      ---      ---      ---
  khoản                                                                   
  người                                                                   
  dùng                                                                    

  Cài đặt     ✓       ---      ---      ---      ---      ---      ---      ---
  & phân                                                                  
  quyền                                                                   

  Mini app   ---      ---      ---      ---      ---      ---      ---       ✓
  tiểu                                                                    
  thương                                                                  
  --------------------------------------------------------------------------------

Đây là default seed; mapping Role → Permission vẫn phải sửa động được.

## 5. Action Permission V1

### Cấu hình mặt bằng

Bổ sung: - `action:cau-truc.edit` - `action:cau-truc.delete` -
`action:cau-truc.reset`

Trưởng BQL: edit/delete/reset. NV BQL: edit. NV BQL delete:
`NEED_CONFIRMATION`.

### Sơ đồ mặt bằng

Giữ: - `action:so-do.xem-ho-so` - `action:so-do.tao-hop-dong` -
`action:so-do.doi-trang-thai`

Trưởng BQL/NV BQL: mutation. LĐ phường: read-only.

### Điểm kinh doanh

Bổ sung `action:diem-kd.export` nếu cần granular. Không tạo CRUD mới nếu
UI chưa có.

### Phiên chợ quê

Giữ `action:phien-cho.chot-phien`: Trưởng BQL + NV BQL. LĐ phường
view-only. Collector không chốt phiên mặc định.

### Tiểu thương

Giữ `action:tieu-thuong.them-moi`: Trưởng BQL + NV BQL.

### Hợp đồng

Bổ sung: - `action:hop-dong.tao` - `action:hop-dong.gia-han` -
`action:hop-dong.thanh-ly`

Trưởng BQL: cả 3. NV BQL: tạo + gia hạn. NV BQL thanh lý:
`NEED_CONFIRMATION`. Thanh lý khi còn nợ: `NEED_CONFIRMATION`, task RBAC
không tự thay business rule.

### Điện nước

Giữ: - `action:dien-nuoc.ghi-chi-so` - `action:dien-nuoc.chot-ky` -
`action:dien-nuoc.yeu-cau-dieu-chinh`

NV BQL: ghi chỉ số + yêu cầu điều chỉnh. Trưởng BQL: cả 3. NV BQL chốt
kỳ: `NEED_CONFIRMATION`. Kỹ thuật không cấp mặc định.

### Khoản phải thu

Giữ `action:phai-thu.mien-giam`; bổ sung `action:phai-thu.phat-hanh`.
Trưởng BQL/Kế toán có thể phát hành. Quyền/phê duyệt miễn giảm:
`NEED_CONFIRMATION`. Không tạo workflow duyệt mới.

### Thu tiền & biên lai

Giữ `action:thu-tien.thu`: mặc định Trưởng BQL + Kế toán + NV thu phí.
Phải enforce cùng permission ở mọi entry point, gồm chính màn Thu tiền
và Công nợ.

### Đối soát

Giữ: - `action:doi-soat.xem-ngan-hang` -
`action:doi-soat.gan-thu-cong` - `action:doi-soat.xem-tien-mat` -
`action:doi-soat.xac-nhan-nop-quy` - `action:doi-soat.xem-truy-vet`

LĐ phường: xem ngân hàng/tiền mặt read-only. Trưởng BQL: xem ngân
hàng/tiền mặt/truy vết. Kế toán: cả 5. Collector: không vào màn mặc
định. Có thể thêm `action:doi-soat.export`; LĐ phường export =
`NEED_CONFIRMATION`.

### Công nợ

Bổ sung: - `action:cong-no.nhac-no` -
`action:cong-no.nhac-no-hang-loat` - `action:cong-no.export`

Trưởng BQL + Kế toán: cả 3. NV BQL: nhắc 1 người; hàng loạt
`NEED_CONFIRMATION`. Collector nhắc nợ: `NEED_CONFIRMATION`. Nút Thu tái
sử dụng `action:thu-tien.thu`.

### Phản ánh & sự cố

Giữ: - `action:su-co.tao-phan-anh` - `action:su-co.phan-cong` -
`action:su-co.chuyen-trang-thai` - `action:su-co.vuot-cap` -
`action:su-co.chi-dao`

LĐ phường: chỉ đạo + view. Trưởng BQL: tạo/phân công/chuyển trạng
thái/vượt cấp. NV BQL: tạo/chuyển trạng thái. Kỹ thuật: chuyển trạng
thái. NV BQL phân công và Kỹ thuật đóng cuối cùng: `NEED_CONFIRMATION`.

### Thông báo

Bổ sung `action:thong-bao.gui`. Trưởng BQL: grant. NV BQL:
`NEED_CONFIRMATION`.

### Báo cáo

Có thể bổ sung `action:bao-cao.export`. Default: Admin, LĐ phường,
Trưởng BQL, NV BQL, Kế toán.

### Tài khoản

Giữ: - `action:tai-khoan.tao-moi` - `action:tai-khoan.sua` -
`action:tai-khoan.khoa-mo-khoa` - `action:tai-khoan.gan-quyen`

Default: chỉ `system_admin`. `status`, `roleIds`, `marketScopes` phải có
tác dụng runtime demo.

### Cài đặt & phân quyền

Các action cấu hình hiện có mặc định chỉ `system_admin`.

Bổ sung: - `action:cai-dat.vai-tro.tao` - `action:cai-dat.vai-tro.sua` -
`action:cai-dat.vai-tro.khoa` - `action:cai-dat.vai-tro.xoa` -
`action:cai-dat.phan-quyen` - `action:cai-dat.reset-demo`

Default: chỉ `system_admin`.

### Mini App

Giữ self-service hiện tại; không thêm action permission nội bộ trong
task này.

## 6. Market Applicability

  Screen                          CL                  TTD           Cross-market
  ---------------------- -------------------- -------------------- --------------
  Tổng quan liên chợ              ✓                    ✓                 ✓
  Cấu hình mặt bằng               ✓                    ✓                ---
  Sơ đồ mặt bằng                  ✓                    ✓                ---
  Điểm kinh doanh                 ✓                    ✓                ---
  Phiên chợ quê                  ---                   ✓                ---
  Tiểu thương/Hợp đồng            ✓                    ✓                ---
  Chỉ số điện nước                ✓                  ---\*              ---
  Tài chính còn lại               ✓                    ✓                ---
  Phản ánh/Thông báo              ✓                    ✓                ---
  Báo cáo                         ✓                    ✓                 ✓
  Tài khoản               theo account scope   theo account scope   filter riêng
  Cài đặt                    theo bản ghi         theo bản ghi         system
  Mini App                   theo trader          theo trader           ---

`*` Prototype hiện không có meter riêng cho quầy TTD; RBAC V1 không tạo
nghiệp vụ mới.

Rule bắt buộc:

``` text
canSeePhienCho =
  hasScreenPermission('phien-cho')
  && account.marketScopes.includes('TTD')
  && selectedMarket === 'TTD'
```

Đổi từ TTD sang CL khi đang ở `phien-cho`: ẩn menu, route sang screen
hợp lệ, không stale active state.

## 7. Permission Evaluation

``` text
CAN_VIEW_SCREEN =
  account.status === ACTIVE
  AND hasScreenPermission(activeRole, screen)
  AND accountHasRequiredMarketScope(screen, selectedMarket)
  AND screenApplicableToMarket(screen, selectedMarket)
```

``` text
CAN_DO_ACTION =
  CAN_VIEW_SCREEN
  AND hasActionPermission(activeRole, action)
  AND accountHasMarketScope(target.market)
  AND target.market === selectedMarket
  AND businessStateAllows(action, target)
```

System-level actions không bắt buộc target market.

## 8. Dynamic behavior

Không viết business authorization kiểu:

``` text
if (role === 'accountant') ...
```

Role chỉ dùng để seed mapping. Quyền thực tế phải đi qua permission
engine. Khi System Admin tick/bỏ tick permission, menu/nút phải cập nhật
ngay bằng cơ chế render hiện có.

## 9. CURRENT_GAP cần xử lý

1.  Runtime hiện chỉ có `lanhdao`, `bql`, `tieuthuong`.
2.  `D.ROLES`/`ACCOUNT_TYPES` chưa điều khiển permission.
3.  `Account.roleIds`, `marketScopes`, `status` chưa enforce.
4.  `Role.scope/market` mới là metadata.
5.  Global selector còn `ALL`.
6.  Menu chưa theo market applicability.
7.  `phien-cho` hard-code TTD nhưng menu vẫn hiện khi chọn CL.
8.  Nhiều mutation action chưa có action permission.
9.  `thu-tien.thu` check không nhất quán.
10. Quản lý Role/Permission chưa có permission bảo vệ chính nó.
11. Reset demo chưa có permission riêng.
12. Phần lớn action chỉ gate UI; handler không re-check.

## 10. Ngoài phạm vi RBAC V1

Không làm backend, API, database, authentication thật, JWT, file
storage, workflow duyệt mới, nối service config vào billing engine,
redesign màn nghiệp vụ, tạo màn mới, tạo role chưa xác nhận, hay
refactor ngoài RBAC/market scope.

## 11. NEED_CONFIRMATION

1.  NV BQL có được xóa cấu trúc mặt bằng?
2.  NV BQL có được thanh lý hợp đồng?
3.  Thanh lý khi còn nợ: block/approve/warning?
4.  NV BQL có được chốt kỳ điện nước?
5.  Ai duyệt miễn giảm/điều chỉnh?
6.  Trưởng BQL hay Kế toán có quyền phát hành cuối cùng?
7.  NV BQL có được gửi thông báo hàng loạt?
8.  NV BQL có được phân công sự cố?
9.  Kỹ thuật có được đóng/hoàn tất sự cố?
10. Collector có được nhắc nợ?
11. LĐ phường có được export đối soát?
12. Cán bộ phụ trách kinh tế/chợ có là role riêng?
13. `Role.scope` có giữ song song với `Account.marketScopes` hay account
    scope là nguồn enforce chính?

Với mục chưa xác nhận: mặc định ít quyền hơn, không tự tạo workflow.

## 12. Acceptance Criteria

-   Có 8 role V1 trong permission engine.
-   Không còn phụ thuộc 3 role cũ để quyết định business authorization.
-   Account demo gắn được role V1.
-   `marketScopes` thực sự giới hạn selector/screen/data/action.
-   Global selected market không còn `ALL`.
-   Cross-market dashboard/report dùng filter nội bộ.
-   `Phiên chợ quê` chỉ hiện khi selected market = TTD và account có TTD
    scope.
-   Screen permission chặn menu + direct route.
-   Mutation action quan trọng có action permission.
-   `thu-tien.thu` enforce nhất quán.
-   Quản lý role/permission + reset demo chỉ System Admin mặc định.
-   Không thêm hard-coded role authorization.
-   Thay đổi permission cập nhật UI ngay.
-   Không phá mock data ngoài migration cần thiết.
-   Không thêm backend/API/database/auth thật.
-   Không tự triển khai các mục `NEED_CONFIRMATION`.

## 13. Migration

``` text
lanhdao    → ward_leader
tieuthuong → trader

bql → KHÔNG map 1:1
      tách thành:
      market_manager
      market_staff
      accountant
      collector
      technician

+ system_admin
```

Không rename `bql` thành một role mới vì role này hiện gom nhiều trách
nhiệm khác nhau.

## 14. Kết luận

``` text
WHO?       Account → Role
WHAT?      Permission → Screen + Action
WHERE?     Market Scope → Selected Market
WHEN?      Market Applicability → Business State
```

Permission quyết định **được làm gì**; Market Scope quyết định **được
làm ở đâu**; Selected Market quyết định **đang làm ở đâu**; Business
State quyết định **lúc này có được làm hay không**.

Đây là target V1 cho FE prototype, không phải security architecture
production.

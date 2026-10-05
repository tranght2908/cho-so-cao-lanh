/*
 * Dữ liệu MẪU cho prototype Hệ thống quản lý chợ số phường Cao Lãnh.
 * Toàn bộ tên người, số điện thoại, số giấy tờ, số tiền đều là GIẢ LẬP để minh họa.
 * Số liệu thật (số sạp, số tiểu thương, số thu) sẽ được thay khi khảo sát 02 chợ.
 */
window.DATA = (function () {
  'use strict';

  // v10: thêm dữ liệu demo luồng mở đăng ký phiên chợ quê TTĐ -> Mini app -> thu tiền mặt -> đối soát.
  // v7 (màn Điểm kinh doanh CL): thêm field THUẦN HIỂN THỊ `pointType` trên section CL (khai báo rõ
  // ràng — xem MARKETS bên dưới) + lan truyền vào stall khi build() — KHÔNG đổi/xoá `type` (vẫn
  // dùng tính đơn giá dịch vụ ở các màn tài chính, giữ nguyên) và KHÔNG đổi `cat` (ngành hàng, khái
  // niệm riêng). Bump version để cache localStorage cũ (thiếu field mới) tự rebuild — độc lập với
  // RBAC_SCHEMA/PERM_SEED_VERSION (js/core.js, js/permissions.js — KHÔNG đổi 2 hằng số đó).
  // v8 (nghiệp vụ "Tách điểm kinh doanh", BUSINESS_POINT_SPLIT_WORKFLOW): thêm mảng MỚI
  // `pointRequests` (yêu cầu thay đổi điểm kinh doanh — V1 chỉ có type SPLIT) + field MỚI THUẦN HIỂN
  // THỊ `structuralStatus` trên stall (mặc định không có = chưa từng tách; 'SPLIT' = điểm nguồn đã
  // được tách, GIỮ NGUYÊN bản ghi để còn lịch sử, không xoá) + 2 field tham chiếu MỚI
  // `parentPointId`/`splitRequestId` trên các stall được TẠO RA từ tách điểm — không đổi/xoá field
  // nào đang có của stall hiện tại. Bump version để cache localStorage cũ (thiếu field/mảng mới) tự
  // rebuild thay vì thiếu `A.db.pointRequests` gây lỗi runtime.
  // v9 (supplement "Trưởng BQL chủ động đề xuất" — 3 nguồn khởi tạo TRADER/STAFF/MANAGER): mỗi phần
  // tử `pointRequests` có thêm 2 field MỚI `createdBy` (id account/tiểu thương khởi tạo — account id
  // cho STAFF/MANAGER, trader id cho TRADER) và `assignedTo` (id account nhân viên đang/được giao xử
  // lý, null nếu chưa ai nhận) — KHÔNG xoá `requestedByName`/`requestedByTraderId` cũ (vẫn dùng làm
  // tên hiển thị cache). Bump version để 3 bản ghi mẫu cũ tự sinh lại kèm 2 field mới (localStorage
  // cũ thiếu field sẽ được rebuild, không vá thủ công).
  // v10: thay `sellerId` hiển thị đơn lẻ bằng lịch sử assignment người trực tiếp kinh doanh.
  // sellerId vẫn được giữ để các màn cũ không mất dữ liệu; `directSellerAssignments` là nguồn
  // nghiệp vụ mới cho drawer Điểm kinh doanh.
  // v12 (TRADER_PROFILE_AND_MINIAPP_WORKFLOW): thêm field MỚI trên trader — `profileStatus`
  // ('ACTIVE'|'PENDING_VERIFICATION'|'NEEDS_SUPPLEMENT'|'INACTIVE'), `source` ('STAFF'|'MINI_APP'),
  // `supplementNote`, `licenseNo`, `licenseDate` — KHÔNG đổi/xoá field nào đang có. Thêm mảng MỚI
  // `miniLinkRequests` (yêu cầu liên kết tài khoản Mini App với hồ sơ tiểu thương đã có sẵn — CCCD
  // trùng khớp, KHÔNG tạo trader mới). Bump version để cache localStorage cũ (thiếu field/mảng
  // mới) tự rebuild.
  // v13 (CORRECTION — TRADER_PROFILE_MINIAPP_CORRECTION_REPORT.md): bỏ 2 bản ghi demo seed cho flow
  // "Mini App tự đăng ký hồ sơ" (đã loại khỏi nghiệp vụ) — trader "Nguyễn Thị Mai" PENDING_VERIFICATION
  // và `miniLinkRequests` seed "LK-0001". `miniLinkRequests` vẫn trả về nhưng LUÔN rỗng. Bump version
  // để cache cũ (còn 2 bản ghi lỗi thời) tự rebuild sạch.
  // v13 also retains the upstream session/finance seeds below; the version is a
  // compatibility marker for the complete combined seed shape.
  // v13 also adds TTĐ overdue debt seed rows for Cong no & nhac no.
  // v14 (RBAC_MARKET_SCOPE_MIGRATION — mở rộng market master 2 → 12 chợ theo yêu cầu nghiệp vụ mới):
  // thêm 10 phần tử MỚI vào MARKETS (id 'HA'/'TVH'/'TTT'/'TL'/'TT'/'TTH'/'MN'/'LH'/'XB'/'SQ'), mỗi
  // phần tử chỉ có thông tin CẤP CHỢ (tên/địa điểm/hạng) + `floors: []` — CỐ Ý KHÔNG sinh cấu trúc
  // Khối/Tầng/Khu/điểm kinh doanh cho 10 chợ này (ngoài phạm vi yêu cầu, xem RBAC_MARKET_SCOPE_
  // MIGRATION_REPORT.md) — build() bên dưới vẫn chạy AN TOÀN cho market floors:[] (forEach rỗng =
  // không sinh thêm stall nào). KHÔNG đổi/xoá 2 phần tử 'CL'/'TTD' hiện có (id, floors, toàn bộ dữ
  // liệu nghiệp vụ demo GIỮ NGUYÊN). Đồng thời cập nhật 3 dòng D.STAFF có chức danh thuộc role RBAC
  // đã bị loại bỏ ('Kế toán', 'Nhân viên Ban Quản lý chợ' — xem js/permissions.js) sang đúng 1 trong
  // 6 role RBAC còn hiệu lực, để dropdown "Người xử lý" (Phản ánh & sự cố) và STAFF_ROLE_MAP
  // (js/accounts.js) không còn tham chiếu role đã nghỉ hưu nào. Bump version để cache A.db cũ (thiếu
  // stall của market mới — vốn không có gì để sinh — và còn giữ role text cũ) tự rebuild.
  // 14 → 15 (PHAN_CONG_NHAN_VIEN_THU_PHI): thêm field collectorId (null mặc định) trên mỗi điểm kinh
  // doanh — cache A.db cũ chưa có field này cần rebuild để field tồn tại nhất quán trên mọi điểm.
  // 15 → 16 (MAT_BANG_DATA_MODEL_V16): mặt bằng chỉ còn MỘT graph trong A.db — buildings → floors
  // (tuỳ chọn) → rows (Dãy, đúng 1 ngành hàng, allocatedArea) → stalls (rowId, area, areaTypeId,
  // status vận hành). MARKETS[].floors[].sections[] đã bỏ. Dataset demo mới nhỏ (CL 49 điểm, TTD
  // 22 điểm); toàn bộ dữ liệu nghiệp vụ tham chiếu điểm được sinh lại đồng bộ. Backup seed v15:
  // backups/mock-v15-20260929/.
  // 16 → 28 (MERGE_TAI_CHINH_P, 29/09/2026): gộp nhánh Tài chính của P lên mô hình mặt bằng v16 (Dãy). Chợ Cao
  // Lãnh: 1 khoản phải thu / tiểu thương / kỳ (receivableGrouping 'TRADER'), phân công NV thu phí theo Dãy
  // (row.collectorId), TT0003 thuê 3 điểm ở 3 Dãy của 3 NV, kỳ 09 phát hành đủ + hạn 30/09, 10 khoản quá hạn
  // (hạn 28/25/22/20 tháng 9) để demo công nợ / thu hồi nợ, số biên lai gắn mã khoản, ngày dữ liệu 29/09/2026.
  // (Nhánh Tài chính trước đó dùng VERSION 17–27 trên mô hình khu cũ — lấy 28 để mọi cache cũ đều dựng lại.)
  // 28 → 29 (KY_09_DEN_GHI_CHI_SO, 01/10/2026): kỳ 09/2026 dừng ở bước "NV thu phí đã ghi đủ chỉ số điện, nước"
  // — kỳ ghi chỉ số chưa hoàn tất, chưa tính nháp/phát hành/thu/chốt/đối soát; không có dữ liệu kỳ 10.
  // 29 → 30 (BO_KY_10): gỡ mọi dữ liệu/công cụ demo kỳ 10/2026; cache v29 có thể đã sinh kỳ 10 → dựng lại.
  // 30 → 31 (KY_11_DEN_HOAN_TAT_GHI_CHI_SO): mở kỳ thu 11/2026, NV thu phí đã ghi đủ chỉ số; hôm nay = 29/10/2026.
  // 31 → 32 (KHOA_GIA_THEO_HOP_DONG): thêm đơn giá ki-ốt CL v2 (2.500 đ từ 01/09/2026); HĐ khóa bảng giá tại
  // ngày bắt đầu (billing.freezeContractTerms) nên HĐ cũ vẫn giữ giá v1.
  const VERSION = 32;
  const TODAY = new Date(2026, 8, 13); // 13/09/2026

  // Giá dịch vụ sử dụng diện tích bán hàng – QĐ 480/QĐ-UBND ngày 14/02/2026 (đ/m²/ngày, đã gồm VAT)
  const UNIT = { kiot: 2000, nhalong: 2000, ngoai: 800 };
  // Chợ quê không có trong QĐ 480 → mức thu theo phiên là GIẢ ĐỊNH để minh họa
  const SESSION_FEE = 20000;
  const ELEC = 3200;   // đ/kWh – đơn giá mẫu
  const WATER = 12000; // đ/m³ – đơn giá mẫu
  // Tài khoản ngân hàng thu hộ của Ban Quản lý theo từng chợ (đối soát) – GIẢ ĐỊNH minh họa
  // Enum dùng chung cho "Chính sách thu và biểu phí". Giá trị được lưu tường minh trên từng dòng,
  // không suy luận loại thuế/mô hình thu từ tab hay đơn vị tính.
  const RATE_MARKET_MODEL = {
    FIXED_MONTHLY: 'FIXED_MONTHLY',
    MARKET_SESSION: 'MARKET_SESSION'
  };
  const RATE_COLLECTION_CYCLE = { MONTH: 'MONTH', SESSION: 'SESSION', DAY: 'DAY' };
  const RATE_TAX_CLASS = {
    TAXABLE_REVENUE: 'TAXABLE_REVENUE',
    PASS_THROUGH_NON_TAX: 'PASS_THROUGH_NON_TAX'
  };
  // Danh mục tối giản để các dòng phí tham chiếu. Task này chưa xây UI quản trị riêng cho danh mục.
  const WAIVER_TYPES = [
    { id: 'WAIVER_AUTHORIZED_DECISION', name: 'Miễn, giảm theo quyết định của cơ quan có thẩm quyền', active: true }
  ];
  const RATE_POLICY_SEED = {
    stallPrices: [
      { id: 'sp-cl-kiot-v1', marketId: 'CL', area: 'Toàn chợ (hạng 1)', stallType: 'Ki-ốt', marketModel: RATE_MARKET_MODEL.FIXED_MONTHLY, collectionCycle: RATE_COLLECTION_CYCLE.MONTH, amount: 2000, unit: 'đ/m²/ngày', taxClass: RATE_TAX_CLASS.TAXABLE_REVENUE, waiverTypeId: 'WAIVER_AUTHORIZED_DECISION', effectiveFrom: '2026-02-14', effectiveTo: '2026-08-31', status: 'active', legalBasis: { docNo: '480/QĐ-UBND', docDate: '2026-02-14', issuer: 'UBND tỉnh Đồng Tháp', summary: 'Quy định đơn giá dịch vụ chợ', effectiveDate: '2026-02-14', note: '' }, attachments: [{ id: 'att-001', name: 'QD_480_2026.pdf', type: 'application/pdf', note: 'Văn bản căn cứ', mock: true }], history: [{ time: '14/02/2026 09:30', user: 'Trần Minh Khoa', action: 'Tạo đơn giá', detail: '2.000 đ/m²/ngày' }] },
      { id: 'sp-cl-kiot-v2', marketId: 'CL', area: 'Toàn chợ (hạng 1)', stallType: 'Ki-ốt', marketModel: RATE_MARKET_MODEL.FIXED_MONTHLY, collectionCycle: RATE_COLLECTION_CYCLE.MONTH, amount: 2500, unit: 'đ/m²/ngày', taxClass: RATE_TAX_CLASS.TAXABLE_REVENUE, waiverTypeId: 'WAIVER_AUTHORIZED_DECISION', effectiveFrom: '2026-09-01', effectiveTo: null, status: 'active', previousVersionId: 'sp-cl-kiot-v1', legalBasis: { docNo: '15/QĐ-BQLC', docDate: '2026-08-20', issuer: 'Ban Quản lý Chợ Cao Lãnh', summary: 'Điều chỉnh đơn giá ki-ốt từ tháng 09/2026', effectiveDate: '2026-09-01', note: 'Dữ liệu mẫu FE prototype' }, attachments: [], history: [{ time: '20/08/2026 09:00', user: 'Trần Minh Khoa', action: 'Áp dụng phí', detail: '2.500 đ/m²/ngày từ 01/09/2026' }] },
      { id: 'sp-cl-nhalong-v1', marketId: 'CL', area: 'Toàn chợ (hạng 1)', stallType: 'Trong nhà lồng chợ', marketModel: RATE_MARKET_MODEL.FIXED_MONTHLY, collectionCycle: RATE_COLLECTION_CYCLE.MONTH, amount: 2000, unit: 'đ/m²/ngày', taxClass: RATE_TAX_CLASS.TAXABLE_REVENUE, waiverTypeId: 'WAIVER_AUTHORIZED_DECISION', effectiveFrom: '2026-02-14', effectiveTo: null, status: 'active', legalBasis: { docNo: '480/QĐ-UBND', docDate: '2026-02-14', issuer: 'UBND tỉnh Đồng Tháp', summary: 'Quy định đơn giá dịch vụ chợ', effectiveDate: '2026-02-14', note: '' }, attachments: [], history: [{ time: '14/02/2026 09:30', user: 'Trần Minh Khoa', action: 'Tạo đơn giá', detail: '2.000 đ/m²/ngày' }] },
      { id: 'sp-cl-ngoai-v1', marketId: 'CL', area: 'Ngoài nhà lồng', stallType: 'Tự sản tự tiêu', marketModel: RATE_MARKET_MODEL.FIXED_MONTHLY, collectionCycle: RATE_COLLECTION_CYCLE.MONTH, amount: 800, unit: 'đ/m²/ngày', taxClass: RATE_TAX_CLASS.TAXABLE_REVENUE, waiverTypeId: 'WAIVER_AUTHORIZED_DECISION', effectiveFrom: '2026-02-14', effectiveTo: null, status: 'active', legalBasis: { docNo: '480/QĐ-UBND', docDate: '2026-02-14', issuer: 'UBND tỉnh Đồng Tháp', summary: 'Quy định đơn giá dịch vụ chợ', effectiveDate: '2026-02-14', note: '' }, attachments: [{ id: 'att-002', name: 'bang_gia_trang_3.png', type: 'image/png', note: 'Trang có bảng đơn giá', mock: true }], history: [{ time: '14/02/2026 09:30', user: 'Trần Minh Khoa', action: 'Tạo đơn giá', detail: '800 đ/m²/ngày' }] },
      { id: 'sp-ttd-codinh-v1', marketId: 'TTD', area: 'Khu quầy thuê cố định', stallType: 'Quầy cố định tháng/quý', marketModel: RATE_MARKET_MODEL.FIXED_MONTHLY, collectionCycle: RATE_COLLECTION_CYCLE.MONTH, amount: 1200, unit: 'đ/m²/ngày', taxClass: RATE_TAX_CLASS.TAXABLE_REVENUE, waiverTypeId: null, effectiveFrom: '2026-01-01', effectiveTo: null, status: 'active', legalBasis: { docNo: '', docDate: '', issuer: 'UBND phường Cao Lãnh', summary: 'Mức thu giả định cho quầy cố định chợ quê', effectiveDate: '2026-01-01', note: 'Giả định FE prototype, chờ xác nhận mức thu chính thức' }, attachments: [], history: [{ time: '01/01/2026 08:00', user: 'Huỳnh Thanh Tâm', action: 'Tạo đơn giá', detail: '1.200 đ/m²/ngày' }] },
      { id: 'sp-ttd-phien-v1', marketId: 'TTD', area: 'Khu chợ quê', stallType: 'Quầy theo phiên', marketModel: RATE_MARKET_MODEL.MARKET_SESSION, collectionCycle: RATE_COLLECTION_CYCLE.SESSION, amount: 20000, unit: 'đ/phiên', taxClass: RATE_TAX_CLASS.TAXABLE_REVENUE, waiverTypeId: null, effectiveFrom: '2026-01-01', effectiveTo: null, status: 'active', legalBasis: { docNo: '', docDate: '', issuer: 'UBND phường Cao Lãnh', summary: 'Mức thu giả định, chưa có trong phụ lục QĐ 480', effectiveDate: '2026-01-01', note: 'Giả định, chờ văn bản chính thức' }, attachments: [], history: [{ time: '01/01/2026 08:00', user: 'Trần Minh Khoa', action: 'Tạo đơn giá', detail: '20.000 đ/phiên' }] }
    ],
    utilities: [
      { id: 'ut-cl-v1', marketId: 'CL', marketModel: RATE_MARKET_MODEL.FIXED_MONTHLY, collectionCycle: RATE_COLLECTION_CYCLE.MONTH, elecPrice: 3200, elecUnit: 'đ/kWh', waterPrice: 12000, waterUnit: 'đ/m³', taxClass: RATE_TAX_CLASS.PASS_THROUGH_NON_TAX, waiverTypeId: null, effectiveFrom: '2026-01-01', effectiveTo: null, status: 'active', legalBasis: { docNo: '', docDate: '', issuer: 'Theo giá bán lẻ hiện hành', summary: 'Thu hộ điện, nước theo giá gốc cho điểm kinh doanh có đồng hồ riêng', effectiveDate: '2026-01-01', note: '' }, attachments: [], history: [{ time: '01/01/2026 08:00', user: 'Võ Hoàng Tuấn', action: 'Tạo cấu hình', detail: 'Điện 3.200 đ/kWh · Nước 12.000 đ/m³' }] },
      { id: 'ut-ttd-v1', marketId: 'TTD', marketModel: RATE_MARKET_MODEL.FIXED_MONTHLY, collectionCycle: RATE_COLLECTION_CYCLE.MONTH, elecPrice: 3200, elecUnit: 'đ/kWh', waterPrice: 12000, waterUnit: 'đ/m³', taxClass: RATE_TAX_CLASS.PASS_THROUGH_NON_TAX, waiverTypeId: null, effectiveFrom: '2026-01-01', effectiveTo: null, status: 'active', legalBasis: { docNo: '', docDate: '', issuer: 'Theo giá bán lẻ hiện hành', summary: 'Thu hộ điện, nước cho quầy cố định chợ quê', effectiveDate: '2026-01-01', note: 'Nhân viên Ban Quản lý chợ ghi chỉ số tại quầy cố định' }, attachments: [], history: [{ time: '01/01/2026 08:00', user: 'Nguyễn Hoàng Phúc', action: 'Tạo cấu hình', detail: 'Điện 3.200 đ/kWh · Nước 12.000 đ/m³' }] }
    ],
    extraServices: [
      { id: 'es-cl-vesinh-v1', name: 'Vệ sinh', marketId: 'CL', marketModel: RATE_MARKET_MODEL.FIXED_MONTHLY, collectionCycle: RATE_COLLECTION_CYCLE.MONTH, calcMethod: 'area', amount: 2000, unit: 'đ/m²/tháng', taxClass: RATE_TAX_CLASS.TAXABLE_REVENUE, waiverTypeId: 'WAIVER_AUTHORIZED_DECISION', effectiveFrom: '2026-01-01', effectiveTo: null, status: 'active', legalBasis: { docNo: '', docDate: '', issuer: '', summary: '', effectiveDate: '', note: '' }, attachments: [], history: [{ time: '01/01/2026 08:00', user: 'Trần Minh Khoa', action: 'Tạo dịch vụ', detail: '2.000 đ/m²/tháng' }] },
      { id: 'es-cl-baove-v1', name: 'Bảo vệ', marketId: 'CL', marketModel: RATE_MARKET_MODEL.FIXED_MONTHLY, collectionCycle: RATE_COLLECTION_CYCLE.MONTH, calcMethod: 'fixed', amount: 50000, unit: 'đ/điểm/tháng', taxClass: RATE_TAX_CLASS.TAXABLE_REVENUE, waiverTypeId: null, effectiveFrom: '2026-01-01', effectiveTo: null, status: 'active', legalBasis: { docNo: '', docDate: '', issuer: '', summary: '', effectiveDate: '', note: '' }, attachments: [], history: [{ time: '01/01/2026 08:00', user: 'Trần Minh Khoa', action: 'Tạo dịch vụ', detail: '50.000 đ/điểm/tháng' }] },
      { id: 'es-ttd-vesinh-v1', name: 'Vệ sinh chợ quê', marketId: 'TTD', marketModel: RATE_MARKET_MODEL.FIXED_MONTHLY, collectionCycle: RATE_COLLECTION_CYCLE.MONTH, calcMethod: 'fixed', amount: 40000, unit: 'đ/quầy/tháng', taxClass: RATE_TAX_CLASS.TAXABLE_REVENUE, waiverTypeId: null, effectiveFrom: '2026-01-01', effectiveTo: null, status: 'active', legalBasis: { docNo: '', docDate: '', issuer: '', summary: 'Phí dịch vụ khác cho quầy cố định TTD', effectiveDate: '2026-01-01', note: 'Giả định FE prototype' }, attachments: [], history: [{ time: '01/01/2026 08:00', user: 'Huỳnh Thanh Tâm', action: 'Tạo dịch vụ', detail: '40.000 đ/quầy/tháng' }] },
      { id: 'es-all-guixe-v1', name: 'Gửi xe', marketId: 'ALL', marketModel: RATE_MARKET_MODEL.FIXED_MONTHLY, collectionCycle: RATE_COLLECTION_CYCLE.DAY, calcMethod: 'qty', amount: 3000, unit: 'đ/lượt', taxClass: RATE_TAX_CLASS.TAXABLE_REVENUE, waiverTypeId: null, effectiveFrom: '2026-01-01', effectiveTo: null, status: 'inactive', legalBasis: { docNo: '', docDate: '', issuer: '', summary: '', effectiveDate: '', note: 'Chưa triển khai, đang chờ bố trí bãi xe' }, attachments: [], history: [{ time: '01/01/2026 08:00', user: 'Trần Minh Khoa', action: 'Tạo dịch vụ', detail: '3.000 đ/lượt (tạm chưa áp dụng)' }] }
    ]
  };

  const BANK_BY_MARKET = { CL: 'Vietcombank', TTD: 'Agribank' };

  // Danh mục ngân hàng cho dropdown "Ngân hàng" ở màn Danh sách tài khoản ngân hàng (Tài chính >
  // Quản lý khai báo) — chỉ phục vụ hiển thị/lọc trong prototype, không kết nối cổng thanh toán thật.
  const BANKS = [
    { code: 'VCB', name: 'Vietcombank' },
    { code: 'AGB', name: 'Agribank' },
    { code: 'BIDV', name: 'BIDV' },
    { code: 'VTB', name: 'VietinBank' },
    { code: 'ACB', name: 'ACB' },
    { code: 'STB', name: 'Sacombank' },
    { code: 'MB', name: 'MB Bank' },
    { code: 'TCB', name: 'Techcombank' },
    { code: 'VPB', name: 'VPBank' },
    { code: 'OCB', name: 'OCB' }
  ];
  // Seed "Danh sách tài khoản ngân hàng" — tài khoản của Ban Quản lý chợ dùng nhận tiền qua
  // QR/chuyển khoản từ tiểu thương, phục vụ đối soát giao dịch. Tách theo từng chợ (marketId) như
  // phần lớn dữ liệu nghiệp vụ khác trong hệ thống (xem RATE_POLICY_SEED). hasTransactions:true minh
  // họa tài khoản đã có giao dịch tham chiếu — không được xoá cứng, chỉ chuyển "Ngừng hoạt động".
  const BANK_ACCOUNT_SEED = [
    { id: 'BA-CL-01', marketId: 'CL', bankCode: 'VCB', bankName: 'Vietcombank', accountHolderName: 'BAN QUAN LY CHO CAO LANH', accountNumber: '0071001234567', isCollectionAccount: true, note: 'Tài khoản thu chính - Chợ Cao Lãnh', status: 'active', hasTransactions: true, createdBy: 'Trần Minh Khoa', createdAt: '01/01/2026 08:00', updatedBy: 'Trần Minh Khoa', updatedAt: '01/01/2026 08:00' },
    { id: 'BA-CL-02', marketId: 'CL', bankCode: 'BIDV', bankName: 'BIDV', accountHolderName: 'BAN QUAN LY CHO CAO LANH', accountNumber: '12310009988776', isCollectionAccount: false, note: 'Tài khoản dự phòng, chưa dùng thu tiền', status: 'active', hasTransactions: false, createdBy: 'Trần Minh Khoa', createdAt: '15/01/2026 09:20', updatedBy: 'Trần Minh Khoa', updatedAt: '15/01/2026 09:20' },
    { id: 'BA-TTD-01', marketId: 'TTD', bankCode: 'AGB', bankName: 'Agribank', accountHolderName: 'BAN QUAN LY CHO QUE TAN THUAN DONG', accountNumber: '3305201122334', isCollectionAccount: true, note: 'Tài khoản thu chính - Chợ quê Tân Thuận Đông', status: 'active', hasTransactions: true, createdBy: 'Huỳnh Thanh Tâm', createdAt: '01/01/2026 08:00', updatedBy: 'Huỳnh Thanh Tâm', updatedAt: '01/01/2026 08:00' },
    { id: 'BA-TTD-02', marketId: 'TTD', bankCode: 'VTB', bankName: 'VietinBank', accountHolderName: 'HUYNH THANH TAM', accountNumber: '0999888777', isCollectionAccount: false, note: 'Tài khoản cá nhân tổ trưởng, đã ngừng dùng', status: 'inactive', hasTransactions: false, createdBy: 'Huỳnh Thanh Tâm', createdAt: '05/01/2026 10:00', updatedBy: 'Trần Minh Khoa', updatedAt: '20/03/2026 14:00' }
  ];


  const MARKETS = [
    {
      id: 'CL', name: 'Chợ Cao Lãnh', short: 'Chợ Cao Lãnh', hang: 'Chợ hạng 1', kind: 'daily',
      // GOM_KHOAN_THU_THEO_TIEU_THUONG (P chốt 28/09/2026): mỗi tiểu thương 1 khoản phải thu (1 mã PT-…) / kỳ,
      // gồm mọi điểm KD họ thuê; chi tiết khoản tách theo từng điểm. Chợ khác giữ 1 khoản / hợp đồng.
      receivableGrouping: 'TRADER',
      address: 'Khóm 7, phường Cao Lãnh, tỉnh Đồng Tháp',
      note: 'Tòa nhà chợ mới: 1 hầm, 1 trệt, 1 lầu, khoảng 20.435 m² sàn',
      priceNote: 'Giá dịch vụ theo QĐ 480/QĐ-UBND ngày 14/02/2026: ki-ốt và trong nhà lồng 2.000 đ/m²/ngày; ngoài nhà lồng 800 đ/m²/ngày',
    },
    {
      id: 'TTD', name: 'Chợ quê Cù lao Tân Thuận Đông', short: 'Chợ quê Tân Thuận Đông', hang: 'Phiên chợ du lịch cộng đồng', kind: 'session',
      address: 'Tổ 4, khóm Tân Phát, phường Cao Lãnh, tỉnh Đồng Tháp',
      note: 'Họp chiều thứ Bảy hằng tuần, 14h–20h',
      priceNote: 'Chợ quê không có trong phụ lục QĐ 480. Mức thu 20.000 đ/quầy/phiên chỉ là GIẢ ĐỊNH để minh họa, do phường quyết định',
    },
    // 10 chợ còn lại trong phạm vi quản lý mới (RBAC_MARKET_SCOPE_MIGRATION — mục 4 yêu cầu) — CHỈ
    // khai báo thông tin CẤP CHỢ (tên/địa điểm/hạng); chưa có mặt bằng (không có building/row nào
    // trong A.db) vì chưa khảo sát hạ tầng, KHÔNG thuộc phạm vi công việc này (xem ghi chú v14 ở đầu file). `kind: 'daily'` (chợ họp hằng ngày,
    // giống Chợ Cao Lãnh) là giả định hợp lý cho prototype — không có dữ liệu khảo sát thật để phân
    // biệt "daily"/"session" cho từng chợ trong số này.
    { id: 'HA', name: 'Chợ Hòa An', short: 'Chợ Hòa An', hang: 'Chợ hạng 2', kind: 'daily', address: 'Khóm Hòa Khánh, phường Cao Lãnh, tỉnh Đồng Tháp', note: '', priceNote: '' },
    { id: 'TVH', name: 'Chợ Tân Việt Hòa', short: 'Chợ Tân Việt Hòa', hang: 'Chợ hạng 3', kind: 'daily', address: 'Khóm Tân Hòa Việt, phường Cao Lãnh, tỉnh Đồng Tháp', note: '', priceNote: '' },
    { id: 'TTT', name: 'Chợ Tân Thuận Tây', short: 'Chợ Tân Thuận Tây', hang: 'Chợ hạng 3', kind: 'daily', address: 'Khóm Tân Dân, phường Cao Lãnh, tỉnh Đồng Tháp', note: '', priceNote: '' },
    { id: 'TL', name: 'Chợ Thông Lưu', short: 'Chợ Thông Lưu', hang: 'Chợ hạng 3', kind: 'daily', address: 'Khóm Đông Bình, phường Cao Lãnh, tỉnh Đồng Tháp', note: '', priceNote: '' },
    { id: 'TT', name: 'Chợ Tân Tịch', short: 'Chợ Tân Tịch', hang: 'Chợ hạng 3', kind: 'daily', address: 'Khóm Tân Thuận, phường Cao Lãnh, tỉnh Đồng Tháp', note: '', priceNote: '' },
    { id: 'TTH', name: 'Chợ Tịnh Thới', short: 'Chợ Tịnh Thới', hang: 'Chợ hạng 3', kind: 'daily', address: 'Khóm Tịnh Long, phường Cao Lãnh, tỉnh Đồng Tháp', note: '', priceNote: '' },
    { id: 'MN', name: 'Chợ Mỹ Ngãi', short: 'Chợ Mỹ Ngãi', hang: 'Chợ hạng 3', kind: 'daily', address: 'Khóm 1, phường Cao Lãnh, tỉnh Đồng Tháp', note: '', priceNote: '' },
    { id: 'LH', name: 'Chợ Long Hồi', short: 'Chợ Long Hồi', hang: 'Chợ hạng 3', kind: 'daily', address: 'Khóm Tịnh Hưng, phường Cao Lãnh, tỉnh Đồng Tháp', note: '', priceNote: '' },
    { id: 'XB', name: 'Chợ Xẻo Bèo (CDC)', short: 'Chợ Xẻo Bèo', hang: 'Chợ hạng 3', kind: 'daily', address: 'Khóm Hòa Mỹ, phường Cao Lãnh, tỉnh Đồng Tháp', note: '', priceNote: '' },
    { id: 'SQ', name: 'Chợ Sáu Quốc', short: 'Chợ Sáu Quốc', hang: 'Chợ hạng 3', kind: 'daily', address: 'Khóm Hòa Long, phường Cao Lãnh, tỉnh Đồng Tháp', note: '', priceNote: '' }
  ];

  // Danh mục ngành hàng DUY NHẤT (thuộc Dãy — điểm kế thừa từ Dãy). 'Quầy cố định tháng/quý' là nhóm
  // cũ của TTD, giữ tạm vì biểu phí quầy cố định TTD đang khớp theo tên này (xem U.appliedStallPrice).
  const INDUSTRIES = ['Ki-ốt tổng hợp', 'Thủy hải sản', 'Thịt, gia cầm', 'Rau củ, trái cây', 'Lương thực, thực phẩm khô',
    'Bách hóa tổng hợp', 'May mặc, giày dép', 'Ăn uống', 'Dịch vụ', 'Nông sản tự sản tự tiêu',
    'Ẩm thực dân dã', 'Nông sản, đặc sản', 'Trải nghiệm', 'Quầy cố định tháng/quý', 'Khác'];
  // Tiền tố mã Dãy theo ngành hàng (Row.code = tiền tố + hậu tố chữ cái: HS-A, HS-B…). Thuộc cùng danh
  // mục ngành hàng ở trên; các mã HS/TG/RC/BH/AU/TS/CD/AT/NS/TN khớp dữ liệu Dãy hiện có.
  const INDUSTRY_CODES = { 'Ki-ốt tổng hợp': 'KI', 'Thủy hải sản': 'HS', 'Thịt, gia cầm': 'TG', 'Rau củ, trái cây': 'RC',
    'Lương thực, thực phẩm khô': 'LT', 'Bách hóa tổng hợp': 'BH', 'May mặc, giày dép': 'MM', 'Ăn uống': 'AU', 'Dịch vụ': 'DV',
    'Nông sản tự sản tự tiêu': 'TS', 'Ẩm thực dân dã': 'AT', 'Nông sản, đặc sản': 'NS', 'Trải nghiệm': 'TN',
    'Quầy cố định tháng/quý': 'CD', 'Khác': 'KH' };
  // Trạng thái VẬN HÀNH lưu trên điểm (stall.status). Tình trạng sử dụng (hợp đồng) và công nợ (khoản
  // phải thu) KHÔNG lưu trên điểm — suy ra ở features/business-points/service.js.
  const POINT_STATUS = { active: 'Hoạt động', suspended: 'Tạm ngừng', disputed: 'Đang tranh chấp' };

  // Seed mặt bằng v16: Market → Building → Floor (tuỳ chọn) → Row (Dãy) → điểm kinh doanh.
  // Row.code = mã khu cũ + dãy vật lý (HS-A, HS-B…); mã điểm = Row.code + số thứ tự (HS-A01).
  // points: [areaTypeId, diện tích m²]; type = cầu nối tính giá cũ (kiot|nhalong|ngoai|phien).
  const LAYOUT_SEED = {
    CL: [
      { code: 'NCC', name: 'Nhà chợ chính', floors: [
        { code: 'T1', name: 'Tầng 1', businessArea: 420, rows: [
          { code: 'KA-A', name: 'Dãy ki-ốt mặt tiền A', industry: 'Ki-ốt tổng hợp', allocatedArea: 100, type: 'kiot', meter: true, points: [['covered', 14], ['covered', 13.5], ['covered', 15], ['covered', 12.5], ['covered', 14], ['covered', 16]] },
          { code: 'HS-A', name: 'Dãy thủy hải sản A', industry: 'Thủy hải sản', allocatedArea: 36, type: 'nhalong', meter: true, points: [['covered', 5], ['covered', 5.5], ['covered', 4.5], ['covered', 6], ['uncovered', 4], ['uncovered', 4]] },
          { code: 'HS-B', name: 'Dãy thủy hải sản B', industry: 'Thủy hải sản', allocatedArea: 26, type: 'nhalong', meter: true, points: [['covered', 5], ['covered', 5], ['covered', 5.5], ['covered', 4.5]] },
          { code: 'TG-A', name: 'Dãy thịt, gia cầm A', industry: 'Thịt, gia cầm', allocatedArea: 32, type: 'nhalong', meter: true, points: [['covered', 5], ['covered', 5], ['covered', 6], ['covered', 4.5], ['covered', 5]] },
          { code: 'RC-A', name: 'Dãy rau củ, trái cây A', industry: 'Rau củ, trái cây', allocatedArea: 30, type: 'nhalong', points: [['covered', 4], ['covered', 4], ['covered', 3.5], ['uncovered', 4], ['uncovered', 3]] }
        ] },
        { code: 'T2', name: 'Tầng 2', businessArea: 300, rows: [
          { code: 'KB-A', name: 'Dãy ki-ốt tầng 2', industry: 'Ki-ốt tổng hợp', allocatedArea: 64, type: 'kiot', meter: true, points: [['covered', 14], ['covered', 13], ['covered', 15], ['covered', 12.5]] },
          { code: 'BH-A', name: 'Dãy bách hóa tổng hợp A', industry: 'Bách hóa tổng hợp', allocatedArea: 40, type: 'nhalong', points: [['covered', 6], ['covered', 6], ['covered', 7], ['covered', 5.5], ['covered', 6]] },
          { code: 'AU-A', name: 'Dãy ăn uống A', industry: 'Ăn uống', allocatedArea: 40, type: 'nhalong', meter: true, points: [['covered', 8], ['covered', 8], ['covered', 7.5], ['covered', 9]] }
        ] }
      ] },
      { code: 'NNL', name: 'Khu ngoài nhà lồng', floors: [], rows: [
        { code: 'TS-A', name: 'Dãy tự sản tự tiêu A', industry: 'Nông sản tự sản tự tiêu', allocatedArea: 20, type: 'ngoai', points: [['self_produced', 2.5], ['self_produced', 2.5], ['self_produced', 3], ['self_produced', 2], ['self_produced', 2.5], ['self_produced', 3]] },
        { code: 'TS-B', name: 'Dãy tự sản tự tiêu B', industry: 'Nông sản tự sản tự tiêu', allocatedArea: 16, type: 'ngoai', points: [['self_produced', 2.5], ['self_produced', 3], ['uncovered', 3], ['uncovered', 3]] }
      ] }
    ],
    TTD: [
      { code: 'KCQ', name: 'Khu chợ quê', floors: [], rows: [
        { code: 'CD-A', name: 'Dãy quầy thuê cố định', industry: 'Quầy cố định tháng/quý', allocatedArea: 70, type: 'nhalong', meter: true, points: [['covered', 10], ['covered', 9], ['covered', 11], ['covered', 10], ['covered', 8.5], ['covered', 12]] },
        { code: 'AT-A', name: 'Dãy ẩm thực dân dã A', industry: 'Ẩm thực dân dã', allocatedArea: 40, type: 'phien', points: [['session', 7], ['session', 7.5], ['session', 6.5], ['session', 8], ['session', 7]] },
        { code: 'AT-B', name: 'Dãy ẩm thực dân dã B', industry: 'Ẩm thực dân dã', allocatedArea: 32, type: 'phien', points: [['session', 7], ['session', 7], ['session', 6.5], ['session', 8]] },
        { code: 'NS-A', name: 'Dãy nông sản, đặc sản', industry: 'Nông sản, đặc sản', allocatedArea: 32, type: 'phien', points: [['session', 6.5], ['session', 7], ['session', 7], ['uncovered', 6]] },
        { code: 'TN-A', name: 'Dãy trải nghiệm tự làm món', industry: 'Trải nghiệm', allocatedArea: 24, type: 'phien', points: [['session', 7], ['session', 6.5], ['session', 7]] }
      ] }
    ]
  };

  // Chú giải HIỂN THỊ "tình trạng" tổng hợp của điểm trên Mặt bằng/bảng (suy ra — xem
  // businessPoints.service.displayStatus): thue/no/trong từ hợp đồng + khoản phải thu, ngung/tranhchap
  // từ trạng thái vận hành. KHÔNG phải giá trị lưu trên stall.status.
  const STATUS = {
    thue: { label: 'Đang kinh doanh', color: '#3aa85b' },
    no: { label: 'Nợ phí', color: '#de3b3d' },
    ngung: { label: 'Tạm ngừng', color: '#ef852e' },
    tranhchap: { label: 'Đang tranh chấp', color: '#7c54cd' },
    choban_giao: { label: 'Chờ bàn giao', color: '#ef852e' },
    trong: { label: 'Còn trống', color: '#c9d3cf' }
  };

  const METHOD = { tm: 'Tiền mặt', qr: 'Quét mã QR', ck: 'Chuyển khoản' };

  const INCIDENT_STATES = [
    { id: 'tiepnhan', label: 'Tiếp nhận' },
    { id: 'phancong', label: 'Phân công' },
    { id: 'dangxuly', label: 'Đang xử lý' },
    { id: 'chonghiemthu', label: 'Chờ nghiệm thu' },
    { id: 'hoanthanh', label: 'Hoàn thành' },
    { id: 'dong', label: 'Đóng' }
  ];

  // RBAC_MARKET_SCOPE_MIGRATION: role RBAC 'accountant' (Kế toán) và 'market_staff' (Nhân viên Ban
  // Quản lý chợ chung chung) đã bị loại khỏi role master (js/permissions.js) — 3 dòng chức danh bên
  // dưới (NV02/NV08/NV09) migrate sang đúng 1 trong 6 role RBAC còn hiệu lực theo nghiệp vụ thực tế
  // gần nhất (mục 26 yêu cầu): Kế toán → Nhân viên thu phí (nghiệp vụ thu/khoản phải thu gần nhất,
  // "xác nhận tiền nộp về" chuyển hẳn sang Trưởng BQL); Nhân viên Ban Quản lý chợ (TTD, chưa có ai
  // giữ mảng kỹ thuật) → Nhân viên kỹ thuật, lấp đúng chỗ trống role này ở TTD. Không đổi tên/mã/chợ.
  const STAFF = [
    { id: 'NV01', name: 'Trần Minh Khoa', role: 'Trưởng Ban Quản lý chợ', market: 'CL' },
    { id: 'NV02', name: 'Lê Thị Ngọc Hân', role: 'Nhân viên thu phí', market: 'CL' },
    { id: 'NV03', name: 'Phạm Văn Lợi', role: 'Nhân viên thu phí', market: 'CL' },
    { id: 'NV04', name: 'Nguyễn Thị Diễm', role: 'Nhân viên thu phí', market: 'CL' },
    { id: 'NV05', name: 'Võ Hoàng Tuấn', role: 'Nhân viên kỹ thuật (điện, nước)', market: 'CL' },
    { id: 'NV06', name: 'Huỳnh Thanh Tâm', role: 'Trưởng Ban Quản lý chợ', market: 'TTD' },
    { id: 'NV07', name: 'Đỗ Thị Kim Yến', role: 'Nhân viên thu phí phiên', market: 'TTD' },
    { id: 'NV08', name: 'Mai Thị Thanh Xuân', role: 'Nhân viên thu phí', market: 'TTD' },
    { id: 'NV09', name: 'Nguyễn Hoàng Phúc', role: 'Nhân viên kỹ thuật (điện, nước)', market: 'TTD' }
  ];

  // RBAC_MARKET_SCOPE_MIGRATION: bảng tài liệu (KHÔNG được bất kỳ view nào đọc — chỉ còn 1 self
  // reference trong comment js/permissions.js) — cập nhật cho khớp đúng 6 role RBAC hiện hành, bỏ
  // "Kế toán"/không còn "Nhân viên Ban Quản lý chợ" chung chung, để không còn bảng nào liệt kê role
  // đã nghỉ hưu dù không có tác dụng runtime.
  const ROLES = [
    { role: 'Lãnh đạo UBND phường', scope: 'Toàn hệ thống (12 chợ)', rights: 'Xem cổng giám sát, báo cáo, tra cứu; xử lý phản ánh vượt cấp' },
    { role: 'Trưởng Ban Quản lý chợ', scope: 'Chợ được giao', rights: 'Toàn quyền nghiệp vụ; phê duyệt miễn giảm, thanh lý hợp đồng' },
    { role: 'Nhân viên thu phí', scope: 'Chợ được giao', rights: 'Thu tiền, phát hành biên lai, ghi chỉ số điện nước, nhắc nợ' },
    { role: 'Nhân viên kỹ thuật', scope: 'Chợ được giao', rights: 'Nhận và xử lý công việc, sự cố được phân công' },
    { role: 'Tiểu thương', scope: 'Điểm kinh doanh của mình', rights: 'Mini app: xem, thanh toán khoản phải nộp; xem hợp đồng; gửi phản ánh' },
    { role: 'Quản trị hệ thống', scope: 'Toàn hệ thống (12 chợ)', rights: 'Tài khoản, phân quyền, danh mục chợ, cấu hình đơn giá, kỳ thu, nhật ký' }
  ];

  // Danh mục actor nghiệp vụ chỉ dùng để hiển thị tại Cài đặt → Vai trò & phân quyền.
  // roleId chỉ nối tới role RBAC đã tồn tại; null nghĩa là chưa có ma trận quyền hiện hữu.
  // Danh mục này không cấp, thu hồi hay suy diễn quyền runtime.
  const ACTORS = [
    { id: 'A01', code: 'QT', name: 'Quản trị hệ thống', unit: 'Cán bộ CNTT/Trung tâm', scope: 'Toàn hệ thống', responsibility: 'Quản lý tài khoản, vai trò, phân quyền; danh mục 12 chợ; bảng giá QĐ 480; tra nhật ký.', roleId: 'system_admin' },
    { id: 'A02', code: 'TT', name: 'Tổ trưởng Tổ Quản lý chợ', unit: 'Tổ Quản lý chợ, bến xe, bến khách ngang sông', scope: 'Chợ được phân công', responsibility: 'Quy hoạch khu, phân công nhân viên thu phí theo khu, khai báo mức thu, mở/chốt kỳ thu tháng, duyệt miễn giảm, duyệt tiểu thương, giao và theo dõi phản ánh, xem báo cáo.', roleId: 'market_manager' },
    { id: 'A03', code: 'NVTP', name: 'Nhân viên thu phí', unit: 'Tổ Quản lý chợ', scope: 'Các chợ được phân công', responsibility: 'Thu phí tháng tại điểm kinh doanh, phát biên lai điện tử, nộp tiền mặt tháng cho kế toán Trung tâm, nhắc nộp phí.', roleId: 'collector' },
    { id: 'A04', code: 'NVKT', name: 'Nhân viên kỹ thuật', unit: 'Tổ Quản lý chợ', scope: 'Phản ánh được giao', responsibility: 'Nhận và xử lý phản ánh của tiểu thương/người dân, cập nhật tiến độ, kết quả kèm ảnh.', roleId: 'technician' },
    { id: 'A05', code: 'KTTT', name: 'Kế toán Trung tâm', unit: 'Tổ Văn phòng – Trung tâm Cung ứng dịch vụ công', scope: 'Toàn bộ 12 chợ', responsibility: 'Xác nhận phiếu nộp tiền mặt của nhân viên thu phí, đối soát số thu kỳ tháng với chứng từ, xem và xuất số liệu thu, công nợ, báo cáo tài chính.', roleId: 'central_accountant' },
    { id: 'A07', code: 'TTH', name: 'Tiểu thương', unit: 'Thương nhân kinh doanh tại chợ', scope: 'Chỉ dữ liệu của chính mình', responsibility: 'Tự đăng ký tài khoản, xem khoản phải nộp, thanh toán QR/chuyển khoản, xem biên lai, gửi và đánh giá phản ánh, nhận thông báo.', roleId: 'trader' },
    { id: 'A08', code: 'LĐ', name: 'Lãnh đạo UBND phường', unit: 'UBND phường Cao Lãnh', scope: 'Tổng hợp 12 chợ (chỉ xem)', responsibility: 'Xem số liệu tổng hợp thu phí, công nợ, phản ánh của 12 chợ; không thao tác nghiệp vụ.', roleId: 'ward_leader' }
  ];

  const HO = ['Nguyễn', 'Trần', 'Lê', 'Phạm', 'Huỳnh', 'Võ', 'Phan', 'Đặng', 'Bùi', 'Đỗ', 'Ngô', 'Dương', 'Lý', 'Hồ', 'Mai', 'Trương', 'Châu', 'Lâm'];
  const DEM_NU = ['Thị', 'Thị Kim', 'Thị Ngọc', 'Thị Thanh', 'Thị Mỹ', 'Thị Bích', 'Thị Hồng'];
  const DEM_NAM = ['Văn', 'Minh', 'Hoàng', 'Quốc', 'Thanh', 'Công', 'Hữu'];
  const TEN_NU = ['Lan', 'Hoa', 'Hằng', 'Thảo', 'Trang', 'Nga', 'Hạnh', 'Mai', 'Loan', 'Phượng', 'Dung', 'Tuyết', 'Hương', 'Yến', 'Nhung', 'Diễm', 'Xuân', 'Thu', 'Kiều', 'Oanh'];
  const TEN_NAM = ['Hùng', 'Dũng', 'Phúc', 'Tài', 'Lộc', 'Sơn', 'Tâm', 'Hải', 'Nam', 'Thắng', 'Toàn', 'Hiếu', 'Bình', 'Khoa', 'Trung'];

  function build() {
    let seed = 20260913;
    const R = function () {
      seed |= 0; seed = seed + 0x6D2B79F5 | 0;
      let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
    const pick = a => a[Math.floor(R() * a.length)];
    const between = (a, b) => a + Math.floor(R() * (b - a + 1));
    const chance = p => R() < p;
    const pad = (n, l) => String(n).padStart(l || 2, '0');
    const iso = d => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
    const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
    const addMonths = (d, n) => { const x = new Date(d); x.setMonth(x.getMonth() + n); return x; };
    const saturdays = (y, m) => { const r = []; const d = new Date(y, m, 1); while (d.getMonth() === m) { if (d.getDay() === 6) r.push(new Date(d)); d.setDate(d.getDate() + 1); } return r; };

    const stalls = [], traders = [], contracts = [], invoices = [], payments = [];
    const buildings = [], floors = [], rows = [];

    // ---- Mặt bằng v16: Building → Floor (tuỳ chọn) → Row (Dãy) → điểm kinh doanh (LAYOUT_SEED) ----
    // Điểm chỉ lưu field của chính nó; ngành hàng thuộc Row, vị trí suy từ rowId, người thuê/hợp đồng
    // suy từ contracts, công nợ suy từ invoices. `type` giữ làm cầu nối cho biểu phí/phiên chợ cũ.
    const rowById = new Map();
    Object.keys(LAYOUT_SEED).forEach(mid => LAYOUT_SEED[mid].forEach((b, bi) => {
      const building = { id: mid + '-B-' + b.code, market: mid, code: b.code, name: b.name, order: bi + 1, status: 'active' };
      buildings.push(building);
      const addRows = (list, floorId) => list.forEach(r => {
        const row = {
          id: mid + '-R-' + r.code, market: mid, buildingId: building.id, floorId, code: r.code, name: r.name,
          industry: r.industry, allocatedArea: r.allocatedArea, order: rows.filter(x => x.market === mid).length + 1,
          status: 'active', collectorId: null, note: ''
        };
        rows.push(row);
        rowById.set(row.id, row);
        r.points.forEach((pt, pi) => {
          const code = r.code + pad(pi + 1);
          stalls.push({
            id: mid + '-' + code, code, market: mid, rowId: row.id, num: pi + 1, area: pt[1], areaTypeId: pt[0],
            status: 'active', hasMeter: !!r.meter, type: r.type, note: '', history: []
          });
        });
      });
      (b.floors || []).forEach((f, fi) => {
        const floor = { id: mid + '-F-' + b.code + '-' + f.code, market: mid, buildingId: building.id, code: f.code, name: f.name, businessArea: f.businessArea, order: fi + 1 };
        floors.push(floor);
        addRows(f.rows, floor.id);
      });
      addRows(b.rows || [], null);
    }));
    const industryOf = st => rowById.get(st.rowId).industry;
    const sectionOf = st => st.code.split('-')[0]; // mã khu cũ (KA, HS, AU…) — chỉ dùng khi sinh số liệu mẫu

    // ---- Kịch bản sử dụng điểm của seed (chỉ dùng khi sinh dữ liệu; KHÔNG lưu trên điểm) ----
    const VACANT = new Set(['CL-KA-A06', 'CL-HS-A06', 'CL-RC-A04', 'CL-RC-A05', 'CL-TS-A06', 'CL-TS-B04', 'CL-KB-A03', 'CL-KB-A04', 'CL-BH-A04', 'CL-BH-A05', 'CL-AU-A03', 'TTD-CD-A06']);
    const SUSPENDED = new Set(['CL-RC-A05']);
    const DISPUTED = new Set(['CL-TG-A05']);
    // Quầy theo phiên TTD: 5 khách quen (không có hợp đồng tháng), các quầy còn lại để trống cho đăng ký phiên.
    const SESSION_REGULAR = new Set(['TTD-AT-A04', 'TTD-AT-A05', 'TTD-AT-B03', 'TTD-AT-B04', 'TTD-NS-A04']);
    const SHARED = [['CL-KA-A01', 'CL-KA-A02'], ['CL-HS-B01', 'CL-HS-B02'],
      // THU_THEO_PHAN_NHAN_VIEN (nhánh Tài chính): TT0003 thuê 3 điểm ở 3 Dãy của 3 NV thu phí khác nhau.
      ['CL-KA-A04', 'CL-HS-A01', 'CL-TG-A01']]; // 1 tiểu thương nhiều điểm
    // Dữ liệu mẫu chỉ giữ nợ ở kỳ gần nhất, không treo nợ quá 1 tháng.
    const DEBT_MONTHS = { 'CL-HS-A03': 1, 'CL-TG-A02': 1, 'CL-BH-A02': 1, 'CL-TS-B02': 1 };
    const PARTIAL = { 'CL-AU-A02': '2026-08', 'CL-KA-A03': '2026-09' };
    const EXPIRING = { 'CL-HS-B04': 7, 'CL-AU-A04': 18, 'CL-TS-A05': 25 }; // số ngày còn lại
    stalls.forEach(st => {
      if (SUSPENDED.has(st.id)) st.status = 'suspended';
      if (DISPUTED.has(st.id)) st.status = 'disputed';
    });

    // ---- Tiểu thương ----
    let tSeq = 0;
    function newTrader(market, cat, fixed) {
      const female = chance(0.78);
      const name = female
        ? pick(HO) + ' ' + pick(DEM_NU) + ' ' + pick(TEN_NU)
        : pick(HO) + ' ' + pick(DEM_NAM) + ' ' + pick(TEN_NAM);
      const t = Object.assign({
        id: 'TT' + pad(++tSeq, 4), name, gender: female ? 'Nữ' : 'Nam',
        phone: '09' + between(0, 9) + between(1000000, 9999999),
        idNo: '087' + between(100000000, 999999999),
        birth: between(1962, 1998),
        address: pick(['Khóm 1', 'Khóm 2', 'Khóm 3', 'Khóm 5', 'Khóm 7', 'Khóm Tân Phát', 'Khóm Đông Thạnh', 'Khóm Hòa Khánh', 'Khóm Mỹ Tây']) + ', phường Cao Lãnh',
        market, cat, hkd: chance(0.62),
        since: iso(new Date(between(2008, 2025), between(0, 11), between(1, 28))),
        app: chance(market === 'TTD' ? 0.64 : 0.57), bank: chance(0.74),
        stalls: [],
        // v12 — TRADER_PROFILE_AND_MINIAPP_WORKFLOW: hồ sơ seed/đã có sẵn coi là chính thức
        // (ACTIVE, nguồn STAFF — do BQL quản lý từ trước, không phải đăng ký qua Mini App).
        profileStatus: 'ACTIVE', source: 'STAFF', supplementNote: '', licenseNo: null, licenseDate: null
      }, fixed || {});
      traders.push(t);
      return t;
    }
    // TT0001 (account demo AC-TT01) và TTD-CQ (account AC-CHI-QUYET) là 2 hồ sơ cố định — account
    // đã lưu trỏ tới 2 id này nên seed luôn phải có, kèm điểm + hợp đồng hợp lệ.
    const FIXED_TRADERS = {
      'CL-KA-A01': { name: 'Nguyễn Thị Hoa', gender: 'Nữ', phone: '0909345678', app: true },
      // TT0003 — account demo AC-TT03 (Trần Thị Kim Nhung), tiểu thương nhiều điểm của nhánh Tài chính.
      'CL-KA-A04': { name: 'Trần Thị Kim Nhung', gender: 'Nữ', app: true }
    };
    const holder = new Map(); // pointId → tiểu thương đang sử dụng (người thuê / khách phiên quen)
    stalls.forEach(st => {
      if (VACANT.has(st.id)) return;
      if (st.type === 'phien' && !SESSION_REGULAR.has(st.id)) return;
      let t;
      if (st.id === 'TTD-CD-A01') {
        t = {
          id: 'TTD-CQ', name: 'Chí Quyết', gender: 'Nam', phone: '0909000001', cccd: '087093000001', idNo: '087093000001',
          address: 'Khóm Tân Phát, phường Cao Lãnh', market: 'TTD', cat: industryOf(st), hkd: true, since: '2026-01-01',
          app: true, bank: true, stalls: [], profileStatus: 'ACTIVE', source: 'STAFF', supplementNote: '', licenseNo: null, licenseDate: null
        };
        traders.push(t);
      } else {
        const group = SHARED.find(g => g.indexOf(st.id) > 0);
        t = group ? holder.get(group[0]) : newTrader(st.market, industryOf(st), FIXED_TRADERS[st.id]);
      }
      t.stalls.push(st.id);
      holder.set(st.id, t);
    });
    // Hồ sơ chưa có hợp đồng (chưa được bố trí điểm) — demo "tiểu thương chưa có HĐ".
    newTrader('CL', 'Rau củ, trái cây');
    newTrader('CL', 'Bách hóa tổng hợp');

    // ---- Hợp đồng ----
    const TYPE_PRICE_LABEL = { kiot: 'Ki-ốt', nhalong: 'Trong nhà lồng chợ', ngoai: 'Tự sản tự tiêu', phien: 'Quầy theo phiên' };
    function unitFor(st) {
      const pol = RATE_POLICY_SEED.stallPrices.find(x => x.marketId === st.market && x.marketModel === RATE_MARKET_MODEL.FIXED_MONTHLY && x.status === 'active'
        && (x.stallType === TYPE_PRICE_LABEL[st.type] || x.stallType === industryOf(st)));
      return pol ? pol.amount : UNIT[st.type];
    }
    let cSeq = 0;
    const contractOfPoint = new Map(); // hợp đồng đang hiệu lực của điểm (chỉ dùng khi sinh dữ liệu)
    function mkContract(st, t, start, end, extra) {
      const unit = unitFor(st);
      const monthly = Math.round(st.area * unit * 30 / 1000) * 1000;
      const c = Object.assign({
        id: 'HĐ-' + st.market + '-' + start.slice(0, 4) + '-' + pad(++cSeq, 4),
        stallId: st.id, traderId: t.id, market: st.market,
        kind: 'Hợp đồng thuê cố định quầy tháng/quý',
        start, end, unit, monthly, deposit: monthly, status: 'hieuluc', scanned: chance(0.8),
        // Dịch vụ áp dụng (như hợp đồng tạo trên UI): điểm có công tơ tính điện, nước; chợ TTD thu thêm dịch vụ chợ.
        serviceApplicability: { electricity: !!st.hasMeter, water: !!st.hasMeter, marketService: st.market === 'TTD' }
      }, extra || {});
      contracts.push(c);
      return c;
    }
    stalls.forEach(st => {
      const t = holder.get(st.id);
      if (!t || st.type === 'phien') return;
      let start, end;
      if (st.market === 'TTD') { start = '2026-01-01'; end = '2026-12-31'; }
      else if (EXPIRING[st.id]) {
        const e = addDays(new Date(2026, 9, 29), EXPIRING[st.id]); // tính theo ngày dữ liệu 29/10/2026 (db.today)
        end = iso(e); start = iso(addDays(addMonths(e, -36), 1));
      } else {
        // bắt đầu từ 11/2023 đến 07/2026 để hợp đồng còn hiệu lực sau ngày 13/09/2026
        const s0 = addMonths(new Date(2023, 10, 1), between(0, 32));
        start = iso(s0); end = iso(addDays(addMonths(s0, 36), -1));
      }
      contractOfPoint.set(st.id, mkContract(st, t, start, end));
    });
    // Hợp đồng đã kết thúc: điểm nay đang trống, lịch sử + khoản thu cũ vẫn giữ.
    const endedContracts = [
      mkContract(stalls.find(x => x.id === 'CL-KB-A04'), newTrader('CL', 'Ki-ốt tổng hợp'), '2023-07-01', '2026-06-30',
        { status: 'thanhly', liquidatedAt: '2026-07-05', liquidationNote: 'Hết hạn hợp đồng, tiểu thương không gia hạn; đã hoàn tất công nợ và bàn giao mặt bằng.' }),
      mkContract(stalls.find(x => x.id === 'CL-BH-A05'), newTrader('CL', 'Bách hóa tổng hợp'), '2025-03-01', '2028-02-29',
        { status: 'chamdut', termination: { date: '2026-08-16', reason: 'Tiểu thương xin chấm dứt trước hạn do chuyển địa điểm kinh doanh.' } })
    ];

    // ---- Khoản phải thu & thanh toán ----
    const PERIODS = ['2026-05', '2026-06', '2026-07', '2026-08', '2026-09'];
    // Kỳ tài chính dùng chung cho 5 màn Tài chính (điện nước, khoản phải thu, thu tiền, đối soát, công nợ):
    // kỳ nghiệp vụ (billing period) tách biệt với ngày phát sinh giao dịch thực tế (payment/transaction date).
    const BILLING_PERIODS = PERIODS.map((p, idx) => {
      const [y, mo] = p.split('-').map(Number);
      const lastDay = new Date(y, mo, 0).getDate();
      return {
        id: p, label: pad(mo) + '/' + y,
        startDate: p + '-01', endDate: p + '-' + pad(lastDay), dueDate: p === '2026-09' ? '2026-09-30' : p + '-15', // QUA_HAN_KY_09: kỳ 09 hạn 30/09
        status: idx === PERIODS.length - 1 ? 'COLLECTING' : 'PAST'
      };
    });
    const NONCASH = { '2026-05': 0.45, '2026-06': 0.52, '2026-07': 0.58, '2026-08': 0.64, '2026-09': 0.67 };
    const collectors = { CL: ['NV03', 'NV04'], TTD: ['NV07'] };
    let iSeq = 0, rSeq = 0;

    function makeItems(st, c, period) {
      const items = [];
      items.push({ name: 'Phí quầy cố định tháng/quý (' + st.area + ' m² × ' + c.unit.toLocaleString('vi-VN') + ' đ × 30 ngày)', amount: c.monthly });
      if (st.hasMeter) {
        const kwh = between(st.type === 'kiot' ? 120 : 50, st.type === 'kiot' ? 320 : 180);
        const m3 = between(2, sectionOf(st) === 'AU' || sectionOf(st) === 'HS' ? 18 : 6);
        items.push({ name: 'Tiền điện (' + kwh + ' kWh × ' + ELEC.toLocaleString('vi-VN') + ' đ)', amount: kwh * ELEC });
        items.push({ name: 'Tiền nước (' + m3 + ' m³ × ' + WATER.toLocaleString('vi-VN') + ' đ)', amount: m3 * WATER });
      }
      if (st.market === 'TTD') {
        RATE_POLICY_SEED.extraServices
          .filter(x => x.status === 'active' && x.marketModel === RATE_MARKET_MODEL.FIXED_MONTHLY && x.marketId === st.market)
          .forEach(x => {
            const amount = x.calcMethod === 'area' ? Math.round(st.area * x.amount / 1000) * 1000 : x.amount;
            items.push({ name: x.name + ' (' + x.unit + ')', amount });
          });
      }
      return items;
    }

    // Phát sinh khoản phải thu theo HỢP ĐỒNG, kể cả hợp đồng đã kết thúc,
    // nhưng chỉ trong các kỳ hợp đồng còn hiệu lực.
    contracts.forEach(c => {
      const st = stalls.find(x => x.id === c.stallId);
      if (!st) return;
      // Dữ liệu mẫu không để nợ phí quá 1 tháng.
      const debtMonths = Math.min(DEBT_MONTHS[st.id] || 0, 1);
      const stop = c.status === 'chamdut' && c.termination?.date ? c.termination.date : c.end;
      PERIODS.forEach((p, pi) => {
        const pStart = p + '-01';
        if (c.start > pStart && c.start.slice(0, 7) !== p) return;
        if (stop < pStart) return;
        const items = makeItems(st, c, p);
        const amount = items.reduce((a, b) => a + b.amount, 0);
        const [y, mo] = p.split('-').map(Number);
        const inv = {
          id: 'PT-' + p.replace('-', '') + '-' + pad(++iSeq, 5), period: p, market: st.market,
          stallId: st.id, traderId: c.traderId, contractId: c.id, items, amount, paid: 0,
          issued: iso(new Date(y, mo - 1, 1)), due: iso(new Date(y, mo - 1, 15)), status: 'unpaid', adjust: null, reminders: 0
        };
        const unpaidBecauseDebt = debtMonths && pi >= PERIODS.length - debtMonths;
        let pay = !unpaidBecauseDebt;
        if (p === '2026-09' && pay) pay = chance(0.62);
        if (PARTIAL[st.id] === p) pay = true;
        if (pay) {
          // Thanh toán một phần chỉ dùng cho các kỳ seed gần nhất,
          // tránh tạo công nợ cũ kéo dài quá 1 tháng.
          const partial = PARTIAL[st.id] === p && pi >= PERIODS.length - 2;
          const amt = partial ? Math.round(amount * 0.5 / 1000) * 1000 : amount;
          const noncash = chance(NONCASH[p]);
          const method = noncash ? (chance(0.72) ? 'qr' : 'ck') : 'tm';
          let day = between(1, p === '2026-09' ? 13 : 15);
          if (p === '2026-09' && chance(0.22)) day = 13;
          const pr = {
            id: 'GD' + pad(++rSeq, 6), invoiceId: inv.id, market: st.market, traderId: c.traderId,
            amount: amt, method, date: iso(new Date(y, mo - 1, day)),
            time: pad(between(6, 17)) + ':' + pad(between(0, 59)),
            by: method === 'tm' ? pick(collectors[st.market]) : 'Hệ thống',
            receipt: 'BL' + p.replace('-', '').slice(2) + '-' + pad(rSeq, 6),
            lookup: Math.random().toString(36).slice(2, 8).toUpperCase(),
            reconciled: method === 'tm' ? null : true
          };
          payments.push(pr);
          inv.paid = amt;
          inv.status = partial ? 'partial' : 'paid';
        }
        invoices.push(inv);
      });
    });

    // Ổn định mã tra cứu theo seed
    function seedTtdOverdueDebt() {
      // Không để nợ quá 1 tháng: các khoản còn nợ của Chợ quê TTĐ chỉ nằm ở kỳ 08 và 09/2026
      // (quá hạn nhiều nhất 29 ngày so với ngày hiện tại 13/09/2026).
      const profiles = [
        { period: '2026-08', due: '2026-08-15', amount: 120000, reminders: 2 },
        { period: '2026-08', due: '2026-08-15', amount: 90000, reminders: 1 },
        { period: '2026-09', due: '2026-09-10', amount: 70000, reminders: 1 },
        { period: '2026-09', due: '2026-09-10', amount: 40000, reminders: 0 }
      ];
      const used = new Set();
      const rows = contracts
        .filter(c => c.market === 'TTD' && c.status === 'hieuluc')
        .map(c => ({ c, st: stalls.find(s => s.id === c.stallId), t: traders.find(t => t.id === c.traderId) }))
        .filter(x => x.st && x.t && x.t.id !== 'TTD-CQ');
      profiles.forEach((p, idx) => {
        const x = rows.find(r => !used.has(r.t.id));
        if (!x) return;
        used.add(x.t.id);
        invoices.push({
          id: 'PT-TTD-CN-' + pad(idx + 1, 3),
          period: p.period,
          market: 'TTD',
          stallId: x.st.id,
          traderId: x.t.id,
          contractId: x.c.id,
          items: [{ name: 'Phi dich vu cho que con no ky ' + p.period, amount: p.amount }],
          amount: p.amount,
          paid: 0,
          issued: p.period + '-01',
          due: p.due,
          status: 'unpaid',
          adjust: null,
          reminders: p.reminders
        });
      });
    }
    seedTtdOverdueDebt();

    payments.forEach(p => { p.lookup = (Math.floor(R() * 2176782336)).toString(36).toUpperCase().padStart(6, 'X'); });

    // ---- Kỳ ghi chỉ số điện, nước: mỗi tháng là 1 dataset độc lập, liên kết với nhau
    // (chỉ số MỚI của kỳ trước = chỉ số CŨ của kỳ sau) ----
    const METER_PERIODS = [
      { id: '2026-07', month: 7, year: 2026, status: 'CLOSED', closeDate: '2026-08-10', closedBy: 'Trần Minh Khoa', closedAt: '10/08/2026 17:05' },
      { id: '2026-08', month: 8, year: 2026, status: 'CLOSED', closeDate: '2026-09-10', closedBy: 'Trần Minh Khoa', closedAt: '10/09/2026 17:20' },
      // KY_09_PHAT_HANH_DU: ghi chỉ số xong → chốt kỳ ghi số → phát hành khoản thu; kỳ 09 đã phát hành đủ.
      { id: '2026-09', month: 9, year: 2026, status: 'CLOSED', closeDate: '2026-09-12', closedBy: 'Trần Minh Khoa', closedAt: '12/09/2026 17:00' }
    ];
    const recAt = (mo, y, dMin, dMax) => pad(between(dMin, dMax)) + '/' + pad(mo) + '/' + y + ' ' + pad(between(7, 17)) + ':' + pad(between(0, 59));
    const mockPhoto = (code, kind, period) => ({ name: code + '-' + kind + '-' + period.slice(5) + '-' + period.slice(0, 4) + '.jpg', type: 'image/jpeg', size: between(180, 420) * 1000, mock: true });

    const readings = [];
    const meterRecorders = { CL: 'NV05', TTD: 'NV09' };
    stalls.filter(s => s.hasMeter && contractOfPoint.has(s.id) && s.status === 'active').forEach(st => {
      const avg = st.type === 'kiot' ? between(150, 260) : between(60, 150);
      const wAvg = between(3, 12);

      // Kỳ 09/2026 (đang ghi) – giữ nguyên phân bố demo trước đây
      const base09 = between(1200, 9800), wBase09 = between(100, 900);
      const entered09 = chance(0.62);
      const abnormal09 = entered09 && chance(0.08);
      const cons09 = abnormal09 ? Math.round(avg * (1.7 + R())) : Math.round(avg * (0.8 + R() * 0.4));
      const elecCur09 = entered09 ? base09 + cons09 : null;
      const waterCur09 = entered09 ? wBase09 + Math.round(wAvg * (0.8 + R() * 0.5)) : null;

      // Kỳ 08/2026 (đã chốt): MỚI(08) = CŨ(09); CŨ(08) suy từ tiêu thụ trung bình
      const elecCur08 = base09, waterCur08 = wBase09;
      const elecPrev08 = elecCur08 - Math.round(avg * (0.8 + R() * 0.4));
      const waterPrev08 = waterCur08 - Math.round(wAvg * (0.8 + R() * 0.5));

      // Kỳ 07/2026 (đã chốt): MỚI(07) = CŨ(08)
      const elecCur07 = elecPrev08, waterCur07 = waterPrev08;
      const elecPrev07 = elecCur07 - Math.round(avg * (0.8 + R() * 0.4));
      const waterPrev07 = waterCur07 - Math.round(wAvg * (0.8 + R() * 0.5));

      function mk(period, mo, y, elecPrev, elecCur, waterPrev, waterCur, closed) {
        const done = closed || (elecCur != null && waterCur != null);
        readings.push({
          stallId: st.id, period,
          elecPrev, elecCur, elecAvg: avg,
          waterPrev, waterCur, waterAvg: wAvg,
          status: done ? 'RECORDED' : 'PENDING',
          recordedBy: done ? (meterRecorders[st.market] || 'NV05') : null,
          recordedAt: done ? recAt(mo, y, 4, closed ? 9 : 12) : null,
          elecPhoto: done ? mockPhoto(st.code, 'dien', period) : null,
          waterPhoto: done ? mockPhoto(st.code, 'nuoc', period) : null
        });
      }
      mk('2026-07', 7, 2026, elecPrev07, elecCur07, waterPrev07, waterCur07, true);
      mk('2026-08', 8, 2026, elecPrev08, elecCur08, waterPrev08, waterCur08, true);
      mk('2026-09', 9, 2026, base09, elecCur09, wBase09, waterCur09, false);
    });

    // ---- PHÂN CÔNG NV THU PHÍ THEO DÃY (nhánh Tài chính, trước v16 là theo khu) ----
    // Chợ Cao Lãnh: Dãy ki-ốt mặt tiền (KA-…) → Nguyễn Thị Diễm (AC-NV04), thủy hải sản (HS-…) → Lê Thị Ngọc Hân
    // (AC-NV02), thịt gia cầm (TG-…) → Phạm Văn Lợi (AC-NV03); các nhóm Dãy còn lại chia vòng 3 NV. Chợ quê TTĐ:
    // chia vòng 2 NV (AC-NV07, AC-NV08). Ghi lên Row.collectorId (mô hình v16: phân công theo Dãy).
    (function assignCollectorsByRow() {
      const prefix = r => String(r.code).split('-')[0];
      const plan = { CL: { fixed: { KA: 'AC-NV04', HS: 'AC-NV02', TG: 'AC-NV03' }, ring: ['AC-NV02', 'AC-NV03', 'AC-NV04'] }, TTD: { fixed: {}, ring: ['AC-NV07', 'AC-NV08'] } };
      Object.keys(plan).forEach(mid => {
        const p = plan[mid], zone = Object.assign({}, p.fixed); let k = 0;
        rows.filter(r => r.market === mid).forEach(r => { const z = prefix(r); if (!zone[z]) zone[z] = p.ring[k++ % p.ring.length]; r.collectorId = zone[z]; });
      });
    })();
    const collectorOfStall = st => { const r = st && rowById.get(st.rowId); return (r && r.collectorId) || ''; };
    // Người ghi chỉ số = NV thu phí phụ trách Dãy của điểm (mã NV, bỏ tiền tố 'AC-').
    Object.keys(meterRecorders).forEach(k => delete meterRecorders[k]);
    // ---- DONG_BO_TIEN_DIEN_NUOC (v17): tiền điện, nước trên khoản phải thu = chỉ số thật ----
    // Trước v17 makeItems() random kWh/m³ độc lập với bảng chỉ số → số tiền không khớp chỉ số. Quy tắc
    // khớp với billing.js (phát hành thật): khoản phải thu kỳ P dùng chỉ số kỳ P, sản lượng = mới − cũ,
    // thiếu chỉ số mới thì KHÔNG tính tiền điện/nước kỳ đó. Không dùng RNG (không làm lệch dữ liệu sau).
    //   - Kỳ đã có chỉ số (07, 08, 09 đã ghi): viết lại dòng tiền điện/nước theo chỉ số.
    //   - Kỳ 09 chưa ghi chỉ số: bỏ dòng tiền điện/nước khỏi khoản phải thu kỳ 09.
    //   - Kỳ chưa có bảng chỉ số (05, 06, hoặc điểm đã tạm ngừng): lập chỉ số lùi (chỉ số mới kỳ trước
    //     = chỉ số cũ kỳ sau) theo đúng sản lượng đã tính trên khoản phải thu → số tiền giữ nguyên.
    // Sau cùng tính lại tổng khoản phải thu và số tiền của giao dịch đã thu tương ứng.
    (function syncUtilityChargesWithReadings() {
      const isElec = it => /^Tiền điện \(/.test(it.name), isWater = it => /^Tiền nước \(/.test(it.name);
      const qtyOf = it => it ? Number((it.name.match(/\(([\d.]+) (?:kWh|m³)/) || [])[1] || 0) : 0;
      const elecItem = kwh => ({ name: 'Tiền điện (' + kwh + ' kWh × ' + ELEC.toLocaleString('vi-VN') + ' đ)', amount: kwh * ELEC });
      const waterItem = m3 => ({ name: 'Tiền nước (' + m3 + ' m³ × ' + WATER.toLocaleString('vi-VN') + ' đ)', amount: m3 * WATER });
      const closedAt = p => { const [y, mo] = p.split('-').map(Number); return '08/' + pad(mo === 12 ? 1 : mo + 1) + '/' + (mo === 12 ? y + 1 : y) + ' 09:00'; };
      const touched = new Set();
      // TT0003: kỳ 09/2026 đủ chỉ số cả 4 điểm (Nguyễn Thị Diễm ghi 12/09) → khoản kỳ 09 có đủ điện, nước.
      const multiT = traders.find(t => t.id === 'TT0003');
      (multiT ? multiT.stalls : []).forEach(id => {
        const st = stalls.find(x => x.id === id), r = readings.find(x => x.stallId === id && x.period === '2026-09');
        if (!st || !r || r.status === 'RECORDED') return;
        if (r.elecCur == null) r.elecCur = r.elecPrev + r.elecAvg;
        if (r.waterCur == null) r.waterCur = r.waterPrev + r.waterAvg;
        Object.assign(r, { status: 'RECORDED', recordedBy: 'NV04', recordedAt: '12/09/2026 08:15',
          elecPhoto: { name: st.code + '-dien-09-2026.jpg', type: 'image/jpeg', size: 300000, mock: true },
          waterPhoto: { name: st.code + '-nuoc-09-2026.jpg', type: 'image/jpeg', size: 300000, mock: true } });
      });
      // KY_09_PHAT_HANH_DU (v22): mọi điểm có công tơ đều đã ghi đủ chỉ số kỳ 09 (05–11/09), sản lượng = mức
      // trung bình của điểm → khoản phải thu kỳ 09 có đủ tiền điện, nước. Không dùng RNG.
      readings.filter(r => r.period === '2026-09' && r.status !== 'RECORDED').forEach(r => {
        const st = stalls.find(x => x.id === r.stallId);
        if (!st) return;
        if (r.elecCur == null) r.elecCur = r.elecPrev + r.elecAvg;
        if (r.waterCur == null) r.waterCur = r.waterPrev + r.waterAvg;
        Object.assign(r, { status: 'RECORDED', recordedBy: collectorOfStall(st).replace(/^AC-/, '') || 'NV05', recordedAt: pad(5 + (st.num || 0) % 7) + '/09/2026 ' + pad(7 + (st.num || 0) % 9) + ':' + pad((st.num || 0) * 7 % 60),
          elecPhoto: r.elecPhoto || { name: st.code + '-dien-09-2026.jpg', type: 'image/jpeg', size: 300000, mock: true },
          waterPhoto: r.waterPhoto || { name: st.code + '-nuoc-09-2026.jpg', type: 'image/jpeg', size: 300000, mock: true } });
      });
      stalls.filter(st => st.hasMeter).forEach(st => {
        const invs = invoices.filter(i => i.stallId === st.id && i.items.some(it => isElec(it) || isWater(it)));
        if (!invs.length) return;
        const own = readings.filter(r => r.stallId === st.id);
        const byP = {}; own.forEach(r => { byP[r.period] = r; });
        // Lập chỉ số lùi cho các kỳ có khoản phải thu nhưng chưa có bảng chỉ số.
        const first = own.slice().sort((a, b) => a.period.localeCompare(b.period))[0];
        let elecAnchor = first ? first.elecPrev : 1000 + st.num * 137, waterAnchor = first ? first.waterPrev : 100 + st.num * 11;
        const elecAvg = first ? first.elecAvg : null, waterAvg = first ? first.waterAvg : null;
        PERIODS.slice().reverse().forEach(p => {
          if (byP[p] || (first && p > first.period)) return;
          const inv = invs.find(i => i.period === p);
          if (!inv) return;
          const kwh = qtyOf(inv.items.find(isElec)), m3 = qtyOf(inv.items.find(isWater));
          const r = {
            stallId: st.id, period: p,
            elecPrev: elecAnchor - kwh, elecCur: elecAnchor, elecAvg: elecAvg || kwh,
            waterPrev: waterAnchor - m3, waterCur: waterAnchor, waterAvg: waterAvg || m3,
            status: 'RECORDED', recordedBy: collectorOfStall(st).replace(/^AC-/, '') || 'NV05', recordedAt: closedAt(p),
            elecPhoto: { name: st.code + '-dien-' + p.slice(5) + '-' + p.slice(0, 4) + '.jpg', type: 'image/jpeg', size: 300000, mock: true },
            waterPhoto: { name: st.code + '-nuoc-' + p.slice(5) + '-' + p.slice(0, 4) + '.jpg', type: 'image/jpeg', size: 300000, mock: true }
          };
          readings.push(r); byP[p] = r;
          elecAnchor = r.elecPrev; waterAnchor = r.waterPrev;
        });
        // Viết lại dòng tiền điện/nước của từng khoản phải thu theo chỉ số cùng kỳ.
        invs.forEach(inv => {
          const r = byP[inv.period], rent = inv.items.filter(it => !isElec(it) && !isWater(it));
          const extra = [];
          if (r && r.elecCur != null) extra.push(elecItem(r.elecCur - r.elecPrev));
          if (r && r.waterCur != null) extra.push(waterItem(r.waterCur - r.waterPrev));
          inv.items = rent.slice(0, 1).concat(extra, rent.slice(1));
          inv.amount = inv.items.reduce((a, b) => a + b.amount, 0);
          touched.add(inv.id);
        });
      });
      // Giao dịch đã thu theo số mới (thu đủ = tổng mới; thu một phần giữ tỉ lệ 50% như seed gốc).
      payments.filter(pm => touched.has(pm.invoiceId)).forEach(pm => {
        const inv = invoices.find(i => i.id === pm.invoiceId);
        pm.amount = inv.status === 'partial' ? Math.round(inv.amount * 0.5 / 1000) * 1000 : inv.amount;
        inv.paid = pm.amount;
      });
      // ---- GOM_KHOAN_THU_THEO_TIEU_THUONG (v19) — chợ có receivableGrouping === 'TRADER' ----
      // Gộp các khoản cùng tiểu thương + kỳ thành 1 khoản (giữ mã nhỏ nhất). Mỗi dòng chi tiết mang stallId/
      // contractId của điểm tạo ra nó. Không nộp một phần: nếu mọi khoản thành phần đã thu đủ thì gộp thành
      // 1 giao dịch/1 biên lai (ngày = lần thu cuối); nếu có khoản chưa thu đủ thì cả khoản gộp là CHƯA THU.
      // Chạy trước phần sao kê/nộp quỹ nên các số liệu đó tự khớp.
      const groupMarkets = new Set(MARKETS.filter(m => m.receivableGrouping === 'TRADER').map(m => m.id));
      const byKey = new Map();
      invoices.filter(i => groupMarkets.has(i.market) && i.stallId).forEach(i => {
        const k = i.traderId + '|' + i.period;
        if (!byKey.has(k)) byKey.set(k, []);
        byKey.get(k).push(i);
      });
      const dropInv = new Set(), dropPay = new Set();
      byKey.forEach(list => {
        list.sort((a, b) => a.id.localeCompare(b.id));
        const head = list[0], ids = new Set(list.map(i => i.id));
        const pays = payments.filter(pm => ids.has(pm.invoiceId)).sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));
        const allPaid = list.every(i => i.status === 'paid');
        const items = [];
        list.forEach(i => i.items.forEach(it => items.push(Object.assign({}, it, { stallId: i.stallId, contractId: i.contractId }))));
        Object.assign(head, {
          stallIds: list.map(i => i.stallId), contractIds: list.map(i => i.contractId), items,
          amount: items.reduce((a, b) => a + b.amount, 0), reminders: Math.max.apply(null, list.map(i => i.reminders || 0))
        });
        list.slice(1).forEach(i => dropInv.add(i.id));
        if (list.length === 1) return;
        if (allPaid && pays.length) {
          const keep = pays[0], last = pays[pays.length - 1];
          Object.assign(keep, { invoiceId: head.id, amount: head.amount, date: last.date, time: last.time });
          pays.slice(1).forEach(pm => dropPay.add(pm.id));
          head.paid = head.amount; head.status = 'paid';
        } else {
          pays.forEach(pm => dropPay.add(pm.id));
          head.paid = 0; head.status = 'unpaid';
        }
      });
      // THU_THEO_PHAN_NHAN_VIEN (v20): chợ gộp không có "thu một phần tiền" — khoản chưa thu đủ ở seed cũ
      // (partial) chuyển về CHƯA THU; khoản đã thu đủ ghi rõ các điểm đã thu trên giao dịch (stallIds).
      invoices.filter(i => groupMarkets.has(i.market) && !dropInv.has(i.id)).forEach(i => {
        const ids = Array.isArray(i.stallIds) && i.stallIds.length ? i.stallIds : [i.stallId];
        const pays = payments.filter(pm => pm.invoiceId === i.id);
        if (i.status === 'paid') { pays.forEach(pm => { pm.stallIds = ids.slice(); }); return; }
        pays.forEach(pm => dropPay.add(pm.id));
        i.paid = 0; i.status = 'unpaid';
      });
      // KY_09_PHAT_HANH_DU (v22): chợ gộp theo tiểu thương (Chợ Cao Lãnh) — Trưởng Ban đã phát hành TOÀN BỘ
      // khoản kỳ 09 (đã có mã PT-…), tất cả CHƯA THU (bỏ giao dịch/biên lai kỳ 09 cũ của các khoản này).
      invoices.filter(i => groupMarkets.has(i.market) && i.period === '2026-09' && !dropInv.has(i.id)).forEach(i => {
        payments.filter(pm => pm.invoiceId === i.id).forEach(pm => dropPay.add(pm.id));
        i.paid = 0; i.status = 'unpaid';
      });
      for (let n = invoices.length - 1; n >= 0; n--) if (dropInv.has(invoices[n].id)) invoices.splice(n, 1);
      for (let n = payments.length - 1; n >= 0; n--) if (dropPay.has(payments[n].id)) payments.splice(n, 1);
      // BIEN_LAI_THEO_MA_KHOAN (v24): chợ gộp theo tiểu thương — số biên lai gắn mã khoản, đánh số theo lần thu
      // của khoản đó (BL-202608-00014-01…). Chạy trước sao kê nên receiptId trên sao kê tự khớp.
      invoices.filter(i => groupMarkets.has(i.market)).forEach(i => {
        payments.filter(pm => pm.invoiceId === i.id).sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time))
          .forEach((pm, k) => { pm.receipt = 'BL-' + i.id.replace(/^PT-/, '') + '-' + pad(k + 1, 2); });
      });
      ['2026-06', '2026-05'].forEach(p => {
        if (METER_PERIODS.some(x => x.id === p) || !readings.some(r => r.period === p)) return;
        const [y, mo] = p.split('-').map(Number);
        METER_PERIODS.unshift({ id: p, month: mo, year: y, status: 'CLOSED', closeDate: y + '-' + pad(mo + 1) + '-10', closedBy: 'Trần Minh Khoa', closedAt: '10/' + pad(mo + 1) + '/' + y + ' 17:00' });
      });
    })();

    readings.forEach(r => { if (!r.recordedBy) return; const st = stalls.find(x => x.id === r.stallId); const c = collectorOfStall(st); if (c) r.recordedBy = c.replace(/^AC-/, ''); });

    // ---- Phản ánh, sự cố ----
    const TPL = [
      ['Điện', 'Mất điện dãy ki-ốt, cần kiểm tra CB tổng'],
      ['Cấp thoát nước', 'Nước tràn khu thủy hải sản, cống thoát bị nghẹt'],
      ['Vệ sinh', 'Rác chưa được thu gom cuối buổi chiều'],
      ['An ninh trật tự', 'Buôn bán lấn chiếm lối đi chung'],
      ['PCCC', 'Bình chữa cháy hết hạn kiểm định'],
      ['Điện', 'Đèn chiếu sáng lối đi bị hỏng'],
      ['Hạ tầng', 'Mái che bị dột khi mưa lớn'],
      ['Cấp thoát nước', 'Đồng hồ nước chạy bất thường'],
      ['Vệ sinh', 'Nhà vệ sinh công cộng xuống cấp'],
      ['Khác', 'Đề nghị gia hạn thời gian nộp phí do tạm nghỉ ốm'],
      ['An ninh trật tự', 'Mất trộm hàng hóa ban đêm'],
      ['Hạ tầng', 'Nền gạch bong tróc trước quầy'],
      ['Điện', 'Ổ cắm quầy bị chập, có mùi khét'],
      ['Khác', 'Đề nghị bố trí thêm chỗ để xe cho khách']
    ];
    const stateCycle = ['tiepnhan', 'phancong', 'dangxuly', 'chonghiemthu', 'hoanthanh', 'hoanthanh', 'dong', 'tiepnhan', 'phancong', 'dangxuly', 'chonghiemthu', 'dong', 'tiepnhan', 'hoanthanh'];
    const rented = stalls.filter(s => holder.has(s.id));
    const incidents = TPL.map((t, i) => {
      const st = i % 5 === 3 ? pick(rented.filter(s => s.market === 'TTD')) : pick(rented.filter(s => s.market === 'CL'));
      const created = addDays(TODAY, -between(0, 9));
      const state = stateCycle[i];
      return {
        id: 'SC-' + pad(i + 101, 4), market: st.market, stallId: st.id, traderId: holder.get(st.id).id,
        cat: t[0], title: t[1], state, source: i % 3 === 0 ? 'Nhập tại Ban Quản lý' : 'Mini app tiểu thương',
        escalated: i === 3 || i === 10,
        created: iso(created), deadline: iso(addDays(created, t[0] === 'PCCC' || t[0] === 'Điện' ? 1 : 3)),
        assignee: state === 'tiepnhan' ? null : (st.market === 'TTD' ? 'NV06' : 'NV05'),
        rating: state === 'dong' ? between(4, 5) : null,
        log: [{ at: iso(created), text: 'Tiếp nhận phản ánh' }]
      };
    });

    // Tài sản chợ V1 — prototype FE cho Chợ Cao Lãnh. NEED_CONFIRMATION: danh mục
    // và taxonomy trạng thái chính thức cần được xác nhận với khách hàng.
    const marketAssets = [
      ['AST-CL-001','TS-DEN-01','Đèn chiếu sáng','ELECTRICAL','Khu A - Dãy 1','ACTIVE','2024-03-15','2026-12-15','Đèn lối đi khu A','Hoạt động ổn định sau bảo trì định kỳ.'],
      ['AST-CL-002','TS-DEN-02','Đèn chiếu sáng','ELECTRICAL','Khu B - Dãy 2','ISSUE','2024-03-15','2026-09-20','Đèn lối đi khu B','Đang liên kết phản ánh hỏng đèn.'],
      ['AST-CL-003','TS-NUOC-01','Đường ống nước','WATER','Khu A - Tuyến chính','MAINTENANCE','2023-06-20','2026-09-18','Tuyến cấp nước khu A','Đang bảo trì cục bộ.'],
      ['AST-CL-004','TS-NUOC-02','Vòi nước công cộng','WATER','Khu C - Lối đi','ACTIVE','2025-01-12','2026-10-05','Vòi nước phục vụ vệ sinh',''],
      ['AST-CL-005','TS-PCCC-01','Bình chữa cháy','FIRE_SAFETY','Khu A - Cổng chính','ACTIVE','2024-01-10','2026-09-28','Bình chữa cháy bột ABC',''],
      ['AST-CL-006','TS-PCCC-02','Tủ báo cháy','FIRE_SAFETY','Khu B - Hành lang','ISSUE','2024-02-08',null,'Tủ điều khiển báo cháy','Đang có phản ánh cần kiểm tra.'],
      ['AST-CL-007','TS-CAM-01','Camera giám sát','SECURITY','Khu B - Dãy 3','ACTIVE','2024-05-11','2026-11-15','Camera quan sát lối đi',''],
      ['AST-CL-008','TS-CAM-02','Camera giám sát','SECURITY','Khu C - Cổng phụ','INACTIVE','2022-08-19',null,'Camera cổng phụ','Ngừng hoạt động, chờ thay thế.'],
      ['AST-CL-009','TS-QUAT-01','Quạt thông gió','VENTILATION','Nhà lồng A','ACTIVE','2024-07-03','2026-10-10','Quạt thông gió nhà lồng',''],
      ['AST-CL-010','TS-QUAT-02','Quạt thông gió','VENTILATION','Nhà lồng B','MAINTENANCE','2023-11-25','2026-09-16','Quạt thông gió nhà lồng','Bảo trì motor.'],
      ['AST-CL-011','TS-VS-01','Thùng rác công cộng','SANITATION','Khu C - Lối đi','ACTIVE','2025-02-14',null,'Thùng rác phân loại',''],
      ['AST-CL-012','TS-VS-02','Bồn rửa tay','SANITATION','Khu A - Nhà vệ sinh','ISSUE','2024-09-01','2026-09-22','Bồn rửa tay công cộng','Cần kiểm tra van cấp nước.'],
      ['AST-CL-013','TS-MAI-01','Mái che lối đi','OTHER','Khu B - Dãy ngoài','ACTIVE','2023-04-18','2026-10-01','Mái che lối đi',''],
      ['AST-CL-014','TS-DIEN-01','Tủ điện tổng','ELECTRICAL','Khu A - Phòng kỹ thuật','ACTIVE','2023-02-27','2026-12-01','Tủ điện phân phối','']
    ].map(x => ({ id:x[0], code:x[1], name:x[2], category:x[3], market:'CL', locationLabel:x[4], status:x[5], installedAt:x[6], maintenanceDueDate:x[7], description:x[8], note:x[9], maintenanceHistory:[], incidents:[], images:[], createdAt:'2026-01-01', updatedAt:'2026-09-13' }));
    // Mock detail độc lập của Tài sản chợ V1; KHÔNG phải bản ghi của module Phản ánh & sự cố.
    const assetDetails = {
      'AST-CL-001': { lastMaintenanceAt:'2026-06-15', incidents:[
        {id:'SC-DEMO-001', title:'Đèn chiếu sáng chập chờn', created:'2026-03-10', state:'hoanthanh', assigneeName:'Nguyễn Văn A', description:'Kiểm tra đường dây và thay bóng đèn.'},
        {id:'SC-DEMO-002', title:'Đèn khu vực không sáng', created:'2026-06-12', state:'dong', assigneeName:'Nguyễn Văn A', description:'Thay bóng và kiểm tra nguồn điện.'}
      ], maintenanceHistory:[
        {id:'BT-001', title:'Kiểm tra hệ thống chiếu sáng', date:'2026-03-10', status:'COMPLETED', description:'Kiểm tra nguồn điện, dây dẫn và bóng đèn.'},
        {id:'BT-002', title:'Thay bóng đèn', date:'2026-06-15', status:'COMPLETED', description:'Thay bóng hỏng và vệ sinh bộ đèn.'},
        {id:'BT-003', title:'Kiểm tra định kỳ', date:'2026-12-15', status:'PLANNED', description:'Kiểm tra theo lịch dự kiến.'}
      ], images:['Đèn chiếu sáng - Khu A · Tình trạng sau bảo trì · 15/06/2026','Tủ đèn lối đi - Khu A · 15/06/2026'] },
      'AST-CL-002': { incidents:[
        {id:'SC-DEMO-003', title:'Đèn lối đi khu B không hoạt động', created:'2026-09-12', state:'dangxuly', assigneeName:'Nguyễn Văn A', description:'Đang kiểm tra nguồn cấp điện.'},
        {id:'SC-DEMO-004', title:'Đèn khu B chập chờn', created:'2026-05-20', state:'hoanthanh', assigneeName:'Nguyễn Văn A', description:'Đã thay bóng đèn và kiểm tra đầu nối.'}
      ], maintenanceHistory:[{id:'BT-004',title:'Kiểm tra nguồn cấp đèn',date:'2026-09-12',status:'IN_PROGRESS',description:'Đang thực hiện.'}] },
      'AST-CL-003': { incidents:[{id:'SC-DEMO-005',title:'Đường ống nước khu A rò rỉ',created:'2026-09-11',state:'dangxuly',assigneeName:'Trần Văn B',description:'Đang khoanh vùng và thay đoạn ống hỏng.'}], maintenanceHistory:[
        {id:'BT-005',title:'Kiểm tra đường ống nước',date:'2026-03-10',status:'COMPLETED',description:'Kiểm tra áp lực và mối nối.'},
        {id:'BT-006',title:'Bảo trì tuyến cấp nước khu A',date:'2026-09-12',status:'IN_PROGRESS',description:'Thay đoạn ống bị rò.'}
      ] },
      'AST-CL-005': { lastMaintenanceAt:'2026-06-01', maintenanceHistory:[{id:'BT-007',title:'Kiểm định bình chữa cháy',date:'2026-06-01',status:'COMPLETED',description:'Kiểm tra niêm phong và áp suất bình.'}] },
      'AST-CL-007': { images:['Camera giám sát - Khu B · Góc quan sát dãy 3 · 01/08/2026','Camera giám sát - Khu B · Tủ kết nối · 01/08/2026'] },
      'AST-CL-008': { maintenanceHistory:[{id:'BT-008',title:'Kiểm tra camera cổng phụ',date:'2026-08-20',status:'COMPLETED',description:'Ghi nhận thiết bị ngừng hoạt động, chờ thay thế.'}] }
    };
    marketAssets.forEach(a => Object.assign(a, assetDetails[a.id] || {}));

    // ---- Thông báo đã gửi ----
    const notifications = [
      { id: 'TB-030', at: '2026-08-28', title: 'Lịch phun khử khuẩn toàn chợ ngày 30/8', group: 'Chợ Cao Lãnh', channels: ['Mini app', 'Zalo OA'], sent: 0, delivered: 0.96, read: 0.74, auto: false },
      { id: 'TB-029', at: '2026-08-20', title: 'Nhắc nộp phí quá hạn kỳ 08/2026', group: 'Danh sách nợ phí', channels: ['Mini app', 'Zalo OA', 'SMS'], sent: 0, delivered: 0.95, read: 0.69, auto: true },
      { id: 'TB-028', at: '2026-08-15', title: 'Hướng dẫn thanh toán bằng mã QR', group: 'Toàn bộ tiểu thương', channels: ['Mini app', 'Zalo OA'], sent: 0, delivered: 0.97, read: 0.77, auto: false },
      { id: 'TB-027', at: '2026-08-08', title: 'Phiên chợ quê thứ Bảy 08/8 kéo dài đến 21h', group: 'Chợ quê Tân Thuận Đông', channels: ['Mini app', 'Zalo OA'], sent: 0, delivered: 0.98, read: 0.88, auto: false }
    ];
    const countFor = g => g === 'Toàn bộ tiểu thương' ? traders.length : g === 'Chợ Cao Lãnh' ? traders.filter(t => t.market === 'CL').length : g === 'Chợ quê Tân Thuận Đông' ? traders.filter(t => t.market === 'TTD').length : Math.round(traders.length * 0.09);
    notifications.forEach(n => { n.sent = countFor(n.group); });
    const todayIso = iso(TODAY);

    // ---- Phiên chợ quê ----
    const sessions = [];
    const sessionRegistrations = [];
    const sessionAttendances = [];
    const sessionPayments = [];
    const sessionReceipts = [];
    const sessionNotifications = [];
    const marketSessions = [];
    const sessionReplacements = [];
    // Phiên 12/09/2026 để trống để demo thao tác "chốt phiên"
    for (let d = new Date(2026, 5, 20); d <= addDays(TODAY, -8); d = addDays(d, 7)) {
      const booths = between(30, 36);
      sessions.push({
        date: iso(d), booths, fee: booths * SESSION_FEE,
        visitors: between(2300, 3150), revenue: between(195, 285) * 1000000,
        noncash: +(0.25 + R() * 0.2).toFixed(2)
      });
    }
    const ttdSessionCats = Array.from(new Set(stalls.filter(s => s.market === 'TTD' && s.type === 'phien').map(industryOf).filter(Boolean))).slice(0, 4);
    const ttdSessionExtras = RATE_POLICY_SEED.extraServices
      .filter(x => x.marketId === 'TTD' && x.status === 'active' && x.marketModel === RATE_MARKET_MODEL.MARKET_SESSION)
      .map(x => ({ name: x.name, amount: x.amount || 0, sourceId: x.id }));
    sessions.push({
      id: 'PC-TTD-20260919', market: 'TTD', date: '2026-09-19', startTime: '14:00', endTime: '20:00',
      registrationStartAt: '2026-09-13T08:00', registrationDeadline: '2026-09-18T17:00',
      status: 'open', note: 'Phiên demo đang mở đăng ký để kiểm thử Mini app tiểu thương',
      createdBy: 'Huỳnh Thanh Tâm', createdAt: '2026-09-13T08:00', updatedBy: 'Huỳnh Thanh Tâm', updatedAt: '2026-09-13T08:05'
    });
    marketSessions.push(
      {
        id: 'PC-TTD-20260919', code: 'PC-TTD-20260919', marketId: 'TTD',
        name: 'Phiên chợ quê thứ Bảy 19/09/2026', sessionDate: '2026-09-19', startTime: '14:00', endTime: '20:00',
        registrationOpenAt: '2026-09-13', registrationCloseAt: '2026-09-18',
        totalStalls: 24, maxStallsPerMerchant: 2, allowedBusinessCategories: ttdSessionCats.length ? ttdSessionCats : ['Ẩm thực', 'Nông sản', 'Thủ công'],
        pricingConfig: { unitPrice: SESSION_FEE, additionalFees: ttdSessionExtras, source: 'DATA.SESSION_FEE' },
        cashPaymentEnabled: true, onlinePaymentEnabled: true, waitingListEnabled: true,
        status: 'REGISTRATION_OPEN', createdBy: 'Huỳnh Thanh Tâm', createdAt: '2026-09-13', updatedBy: 'Huỳnh Thanh Tâm', updatedAt: '2026-09-13'
      },
      {
        id: 'PC-TTD-20260926', code: 'PC-TTD-20260926', marketId: 'TTD',
        name: 'Phiên chợ quê thứ Bảy 26/09/2026', sessionDate: '2026-09-26', startTime: '14:00', endTime: '20:00',
        registrationOpenAt: '2026-09-20', registrationCloseAt: '2026-09-24',
        totalStalls: 30, maxStallsPerMerchant: 2, allowedBusinessCategories: ttdSessionCats.length ? ttdSessionCats : ['Ẩm thực', 'Nông sản', 'Thủ công'],
        pricingConfig: { unitPrice: SESSION_FEE, additionalFees: ttdSessionExtras, source: 'DATA.SESSION_FEE' },
        cashPaymentEnabled: true, onlinePaymentEnabled: true, waitingListEnabled: true,
        status: 'SCHEDULED', createdBy: 'Huỳnh Thanh Tâm', createdAt: '2026-09-13', updatedBy: 'Huỳnh Thanh Tâm', updatedAt: '2026-09-13'
      }
    );
    const ttdDemoTraders = traders.filter(t => t.market === 'TTD' && t.id !== 'TTD-CQ' && t.stalls.length).slice(0, 4);
    const sessionAmount = stallsCount => stallsCount * SESSION_FEE + ttdSessionExtras.reduce((a, x) => a + (x.amount || 0) * stallsCount, 0);
    const addSessionReg = (idx, trader, stallsCount, method, paymentStatus, opts) => {
      if (!trader) return null;
      const amount = sessionAmount(stallsCount);
      const code = 'DK-20260919-' + pad(idx, 3);
      const reg = {
        id: 'DK-TTD-20260919-' + pad(idx, 3), code, sessionId: 'PC-TTD-20260919',
        market: 'TTD', marketId: 'TTD', traderId: trader.id, merchantId: trader.id,
        pointId: null, requestedSectionId: null, requestedStalls: stallsCount, businessCategory: trader.cat,
        listType: 'official', status: 'registered', waitlistOrder: null,
        paymentMethod: method, paymentWorkflowStatus: paymentStatus, pricingSnapshot: {
          unitPrice: SESSION_FEE, numberOfStalls: stallsCount, stallFee: stallsCount * SESSION_FEE,
          additionalFees: ttdSessionExtras.map(x => Object.assign({}, x, { amount: (x.amount || 0) * stallsCount })),
          totalAmount: amount, source: 'DATA.SESSION_FEE', capturedAt: todayIso
        },
        totalAmount: amount, registeredAt: todayIso, createdBy: 'Mini app tiểu thương', createdAt: todayIso,
        updatedBy: 'Mini app tiểu thương', updatedAt: todayIso, note: opts && opts.note || ''
      };
      sessionRegistrations.push(reg);
      const pay = {
        id: 'PM-TTD-20260919-' + pad(idx, 3), sessionId: reg.sessionId, registrationId: reg.id, marketId: 'TTD',
        method, status: paymentStatus, amount, reference: (method === 'CASH' ? 'CASH-' : 'MOCK-') + code,
        createdAt: todayIso, dueAt: '2026-09-19 14:00', paidAt: null, collectedAt: null, collectedBy: null
      };
      sessionPayments.push(pay);
      return { reg, pay, amount };
    };
    const cashPending = addSessionReg(1, ttdDemoTraders[0], 1, 'CASH', 'WAITING_COLLECTION', { note: 'Demo: chờ nhân viên thu phí xác nhận tiền mặt' });
    const cashPending2 = addSessionReg(2, ttdDemoTraders[1], 2, 'CASH', 'WAITING_COLLECTION', { note: 'Demo: đăng ký 2 quầy, chờ thu tiền mặt' });
    const onlinePending = addSessionReg(3, ttdDemoTraders[2], 1, 'ONLINE', 'WAITING_PAYMENT', { note: 'Demo: chờ thanh toán QR' });
    const cashDone = addSessionReg(4, ttdDemoTraders[3], 1, 'CASH', 'SUCCESS', { note: 'Demo: đã thu tiền mặt để đối soát' });
    if (cashDone) {
      const receiptNo = 'BL-PC-260913-00001';
      const p = {
        id: 'GD' + pad(payments.reduce((mx, x) => Math.max(mx, Number(String(x.id).replace(/\D/g, '')) || 0), 0) + 1, 6), invoiceId: null, market: 'TTD', traderId: cashDone.reg.traderId,
        amount: cashDone.amount, method: 'tm', date: todayIso, time: '10:20', by: 'NV07', receipt: receiptNo,
        lookup: 'TTD001', reconciled: null, sourceType: 'SESSION_REGISTRATION',
        sessionId: cashDone.reg.sessionId, registrationId: cashDone.reg.id, sessionPaymentId: cashDone.pay.id,
        receiptDelivery: { miniApp: true, sentAt: todayIso + ' 10:20', status: 'SENT_MOCK' }, printStatus: 'PENDING'
      };
      payments.push(p);
      cashDone.pay.collectedAt = todayIso + ' 10:20';
      cashDone.pay.collectedBy = 'NV07';
      cashDone.pay.receiptNumber = receiptNo;
      cashDone.reg.paymentWorkflowStatus = 'CONFIRMED';
      cashDone.reg.receiptNumber = receiptNo;
      cashDone.reg.confirmedAt = todayIso + ' 10:20';
      sessionReceipts.push({
        id: 'RC-00001', receiptNumber: receiptNo, paymentId: p.id, sessionPaymentId: cashDone.pay.id,
        sessionId: cashDone.reg.sessionId, registrationId: cashDone.reg.id, marketId: 'TTD', merchantId: cashDone.reg.traderId,
        amount: cashDone.amount, method: 'CASH', issuedAt: todayIso + ' 10:20', collectedAt: todayIso + ' 10:20',
        collectedBy: 'NV07', sentToMiniAppAt: todayIso + ' 10:20', printStatus: 'PENDING'
      });
    }
    sessionNotifications.push({
      id: 'SN-PC-TTD-20260919-OPEN', sessionId: 'PC-TTD-20260919', marketId: 'TTD',
      kind: 'SESSION_REGISTRATION_OPEN', at: todayIso, channels: ['Mini app'],
      text: 'Phiên chợ quê 19/09/2026 đã mở đăng ký. Tiểu thương có thể đăng ký quầy theo phiên.'
    });
    notifications.unshift({
      id: 'TB-032', at: todayIso, title: 'Phiên chợ quê 19/09/2026 đã mở đăng ký',
      group: 'Chợ quê Tân Thuận Đông', channels: ['Mini app'], sent: traders.filter(t => t.market === 'TTD').length,
      delivered: 1, read: 0, auto: true, kind: 'SESSION_REGISTRATION_OPEN', sessionId: 'PC-TTD-20260919',
      text: 'Tiểu thương có thể đăng ký trong tab Đăng ký khi phiên còn mở.'
    });

    // ---- Đối soát: sao kê ngân hàng ngày 13/09/2026 ----
    // Chuỗi truy vết: BankStatementTransaction -> Payment -> Receivable (khoản phải thu) -> Receipt (biên lai)
    const bankLog = (b, actor, text) => b.log.push({ at: b.time, actor, text });
    const bank = payments.filter(p => p.date === todayIso && p.method !== 'tm').map((p, i) => {
      const b = {
        id: 'SK' + pad(i + 1, 4), date: p.date, time: p.time, amount: p.amount, ref: 'CHOSO ' + p.invoiceId,
        market: p.market, bankName: BANK_BY_MARKET[p.market] || 'Vietcombank',
        paymentId: p.id, receivableId: p.invoiceId, receiptId: p.receipt,
        status: 'MATCHED_AUTO', matched: true, matchedBy: null, matchedAt: null, matchMethod: 'AUTO', log: []
      };
      bankLog(b, 'Hệ thống', 'Nhận sao kê ' + b.id);
      bankLog(b, 'Hệ thống', 'Khớp tự động với khoản phải thu ' + p.invoiceId + ' (trùng mã tham chiếu, số tiền, trong cửa sổ thời gian hợp lệ)');
      return b;
    });
    function addBankMock(o) {
      const b = Object.assign({ date: todayIso, market: 'CL', bankName: BANK_BY_MARKET.CL, paymentId: null, receivableId: null, receiptId: null, matched: false, matchedBy: null, matchedAt: null, matchMethod: null, log: [] }, o);
      bank.push(b);
      return b;
    }
    const bUnmatched = addBankMock({ id: 'SK' + pad(bank.length + 1, 4), time: '10:42', amount: 450000, ref: 'CK TIEN SAP CO HANG', status: 'UNMATCHED' });
    bankLog(bUnmatched, 'Hệ thống', 'Nhận sao kê ' + bUnmatched.id);
    bankLog(bUnmatched, 'Hệ thống', 'Không tìm thấy khoản phải thu phù hợp');

    const bReview = addBankMock({ id: 'SK' + pad(bank.length + 1, 4), time: '15:07', amount: 1260000, ref: 'NOP PHI CHO THANG 9', status: 'NEEDS_REVIEW' });
    bankLog(bReview, 'Hệ thống', 'Nhận sao kê ' + bReview.id);
    bankLog(bReview, 'Hệ thống', 'Nội dung có khả năng liên quan phí chợ nhưng không xác định được khoản phải thu cụ thể – cần kiểm tra thủ công');

    const mismatchInv = invoices.find(i => i.market === 'CL' && i.period === '2026-09' && i.status === 'unpaid');
    if (mismatchInv) {
      const bMis = addBankMock({
        id: 'SK' + pad(bank.length + 1, 4), time: '16:35', amount: Math.max(0, mismatchInv.amount - 20000),
        ref: 'CHOSO ' + mismatchInv.id, market: mismatchInv.market, bankName: BANK_BY_MARKET[mismatchInv.market] || 'Vietcombank',
        receivableId: mismatchInv.id, status: 'AMOUNT_MISMATCH'
      });
      bankLog(bMis, 'Hệ thống', 'Nhận sao kê ' + bMis.id);
      bankLog(bMis, 'Hệ thống', 'Tìm thấy khoản phải thu ' + mismatchInv.id + ' qua mã tham chiếu nhưng số tiền chuyển khoản lệch so với số tiền phải thu – cần Kế toán kiểm tra');
    }
    bank.sort((a, b) => a.time.localeCompare(b.time));

    // ---- Đối soát: nộp quỹ tiền mặt ngày 13/09/2026 ----
    const cashTotalForEmployee = employeeId => payments.filter(p => p.date === todayIso && p.method === 'tm' && p.by === employeeId).reduce((a, p) => a + p.amount, 0);
    const nv03Cash = cashTotalForEmployee('NV03'), nv04Cash = cashTotalForEmployee('NV04');
    const cashDeposits = [
      { id: 'NQ-00030', employeeId: 'NV03', market: 'CL', date: todayIso, amount: nv03Cash, depositedAt: '13/09/2026 17:10', receivedBy: 'NV02', attachment: { name: 'phieu_nop_quy_00030.pdf', type: 'application/pdf' } },
      { id: 'NQ-00031', employeeId: 'NV04', market: 'CL', date: todayIso, amount: Math.max(0, nv04Cash - 93600), depositedAt: '13/09/2026 17:30', receivedBy: 'NV02', attachment: { name: 'phieu_nop_quy_00031.pdf', type: 'application/pdf' } }
    ].filter(d => d.amount > 0); // kỳ 09 Chợ Cao Lãnh chưa thu → không có phiếu nộp quỹ 0 đ
    const cashConfirms = [];

    // ---- Chuỗi 12 tháng (mô phỏng) cho biểu đồ ----
    const months = [];
    const expectedMonthly = contracts.filter(c => c.market === 'CL').reduce((a, c) => a + c.monthly, 0);
    const nc = [0.18, 0.21, 0.25, 0.29, 0.33, 0.37, 0.41];
    for (let i = 0; i < 7; i++) {
      const d = new Date(2025, 9 + i, 1);
      // hệ số gồm cả tiền điện, nước để khớp mức thu thực tế các kỳ 05–09/2026
      const total = Math.round(expectedMonthly * (1.48 + R() * 0.08) * (0.9 + R() * 0.05));
      months.push({ period: d.getFullYear() + '-' + pad(d.getMonth() + 1), cash: Math.round(total * (1 - nc[i])), noncash: Math.round(total * nc[i]) });
    }

    const audit = [
      { at: '13/09/2026 08:12', who: 'Lê Thị Ngọc Hân', what: 'Đối soát tự động sao kê ngân hàng ngày 12/09/2026' },
      { at: '12/09/2026 16:40', who: 'Trần Minh Khoa', what: 'Phê duyệt miễn giảm 50% kỳ 09/2026 cho điểm KD HS-B03 (lý do: sửa chữa mái che)' },
      { at: '12/09/2026 09:05', who: 'Quản trị hệ thống', what: 'Cập nhật đơn giá theo QĐ 480/QĐ-UBND ngày 14/02/2026' },
      { at: '11/09/2026 14:21', who: 'Phạm Văn Lợi', what: 'Hủy biên lai BL2609-000388 (thu nhầm), lập lại BL2609-000391' },
      { at: '01/09/2026 00:05', who: 'Hệ thống', what: 'Tự động phát hành khoản phải thu kỳ 09/2026' }
    ];

    // ---- Yêu cầu thay đổi điểm kinh doanh — V1 chỉ nghiệp vụ TÁCH ĐIỂM (BUSINESS_POINT_SPLIT_
    // WORKFLOW), Chợ Cao Lãnh. Dữ liệu mẫu TỐI THIỂU đủ demo ĐỦ 3 nguồn khởi tạo (mục 1/2/14 yêu cầu
    // bổ sung — TRADER/STAFF/MANAGER):
    //   YC-0015: nguồn Tiểu thương (Ngô Văn Nam, điểm KA-A01 thật đang thuê) — Nguyễn Văn A (nhân
    //            viên BQL, account AC-NV08) đã tiếp nhận + hoàn thiện phương án + gửi, đang chờ
    //            Trưởng BQL phê duyệt.
    //   YC-0016: nguồn Nhân viên BQL chủ động (Nguyễn Văn A tự lập, tự xử lý) — đã lập phương án,
    //            đang trong quá trình xử lý (chưa gửi phê duyệt).
    //   YC-0017: nguồn Tiểu thương, mới gửi mong muốn qua Mini app — CHƯA có phương án cụ thể, CHƯA
    //            ai nhận (assignedTo null, demo bước "Nhân viên BQL tiếp nhận").
    //   YC-0018: nguồn Trưởng BQL chủ động đề xuất (Trần Minh Khoa, account AC-NV01) — giao Nguyễn
    //            Văn A xử lý, CHƯA có phương án (đúng luồng 3: Trưởng BQL KHÔNG tự lập phương án kỹ
    //            thuật khi tạo đề xuất, xem mục 3 yêu cầu bổ sung).
    // createdBy: id account (STAFF/MANAGER) hoặc trader id (TRADER) — người KHỞI TẠO. assignedTo: id
    // account nhân viên đang/được giao XỬ LÝ — KHÔNG giả định createdBy === assignedTo (mục 5 yêu cầu
    // bổ sung). area 2 điểm mới LUÔN cộng đúng bằng area điểm nguồn thật (đọc từ `stalls` vừa build ở
    // trên, KHÔNG hard-code số liệu minh họa) để phương án hợp lệ ngay từ đầu.
    const pointRequests = [];
    (function seedSplitRequests() {
      const holderId = st => (holder.get(st.id) || {}).id || null;
      const kaA01 = stalls.find(s => s.id === 'CL-KA-A01');
      const kaA03 = stalls.find(s => s.id === 'CL-KA-A03');
      const rcA01 = stalls.find(s => s.id === 'CL-RC-A01');
      const kbA02 = stalls.find(s => s.id === 'CL-KB-A02');
      const STAFF_NAME = 'Nguyễn Văn A'; // AC-NV08, market_staff scoped CL — xem js/accounts.js
      const MANAGER_NAME = 'Trần Minh Khoa'; // AC-NV01, market_manager
      if (kaA01) {
        const a1 = 7.0, a2 = +(kaA01.area - a1).toFixed(1);
        pointRequests.push({
          id: 'YC-0015', type: 'SPLIT', market: 'CL', pointId: kaA01.id, source: 'TRADER',
          requestedByName: traders.find(t => t.id === holderId(kaA01)).name, requestedByTraderId: holderId(kaA01),
          createdBy: holderId(kaA01), assignedTo: 'AC-NV08',
          requestedAt: '2026-09-10',
          reason: 'Muốn tách điểm để cùng người thân kinh doanh riêng, mỗi người phụ trách một ngành hàng.',
          note: '', attachments: [],
          status: 'PENDING_APPROVAL',
          plan: {
            a: { code: kaA01.code + 'A', area: a1, cat: industryOf(kaA01) },
            b: { code: kaA01.code + 'B', area: a2, cat: industryOf(kaA01) }
          },
          timeline: [
            { key: 'created', at: '10/09/2026', by: traders.find(t => t.id === holderId(kaA01)).name + ' (Mini app)' },
            { key: 'received', at: '10/09/2026', by: STAFF_NAME },
            { key: 'planned', at: '11/09/2026', by: STAFF_NAME },
            { key: 'submitted', at: '12/09/2026', by: STAFF_NAME }
          ],
          resultPointIds: null
        });
      }
      if (kaA03) {
        const a1 = +(kaA03.area / 2 - 0.05).toFixed(1), a2 = +(kaA03.area - a1).toFixed(1);
        pointRequests.push({
          id: 'YC-0016', type: 'SPLIT', market: 'CL', pointId: kaA03.id, source: 'STAFF',
          requestedByName: STAFF_NAME, requestedByTraderId: null,
          createdBy: 'AC-NV08', assignedTo: 'AC-NV08',
          requestedAt: '2026-09-12',
          reason: 'Bố trí lại mặt bằng ki-ốt mặt tiền tầng 1 để tiếp nhận thêm hộ kinh doanh mới đăng ký.',
          note: '', attachments: [],
          status: 'STAFF_REVIEW',
          plan: {
            a: { code: kaA03.code + 'A', area: a1, cat: industryOf(kaA03) },
            b: { code: kaA03.code + 'B', area: a2, cat: industryOf(kaA03) }
          },
          timeline: [{ key: 'created', at: '12/09/2026', by: STAFF_NAME }],
          resultPointIds: null
        });
      }
      if (rcA01) {
        pointRequests.push({
          id: 'YC-0017', type: 'SPLIT', market: 'CL', pointId: rcA01.id, source: 'TRADER',
          requestedByName: traders.find(t => t.id === holderId(rcA01)).name, requestedByTraderId: holderId(rcA01),
          createdBy: holderId(rcA01), assignedTo: null,
          requestedAt: '2026-09-13',
          reason: 'Muốn tách quầy để chia sẻ kinh doanh cùng người thân, mỗi người phụ trách một nửa quầy.',
          note: '', attachments: [],
          status: 'DRAFT',
          plan: null,
          timeline: [{ key: 'created', at: '13/09/2026', by: traders.find(t => t.id === holderId(rcA01)).name + ' (Mini app)' }],
          resultPointIds: null
        });
      }
      if (kbA02) {
        pointRequests.push({
          id: 'YC-0018', type: 'SPLIT', market: 'CL', pointId: kbA02.id, source: 'MANAGER',
          requestedByName: MANAGER_NAME, requestedByTraderId: null,
          createdBy: 'AC-NV01', assignedTo: 'AC-NV08',
          // Ngày dùng '2026-09-13' (đúng "hôm nay" của prototype, xem TODAY ở trên) thay vì ví dụ
          // minh hoạ '19/09/2026' trong yêu cầu bổ sung — request mới nhất không thể có ngày TRONG
          // TƯƠNG LAI so với "hôm nay" của hệ thống (nhất quán với YC-0015/16/17 đã seed từ trước).
          requestedAt: '2026-09-13',
          reason: 'Đề nghị kiểm tra phương án tách điểm để phục vụ bố trí mặt bằng kỳ tiếp theo.',
          note: '', attachments: [],
          status: 'STAFF_REVIEW',
          plan: null, // Trưởng BQL KHÔNG tự lập phương án kỹ thuật khi tạo đề xuất (mục 3 yêu cầu bổ sung)
          timeline: [
            { key: 'created', at: '13/09/2026', by: MANAGER_NAME },
            { key: 'assigned', at: '13/09/2026', by: MANAGER_NAME, note: 'Giao ' + STAFF_NAME + ' xử lý' }
          ],
          resultPointIds: null
        });
      }
    })();

    // CORRECTION (xem TRADER_PROFILE_MINIAPP_CORRECTION_REPORT.md): Mini App KHÔNG còn tự đăng ký hồ
    // sơ (business flow cũ đã bị loại bỏ) — 2 bản ghi demo "Nguyễn Thị Mai" (PENDING_VERIFICATION) và
    // "LK-0001" (miniLinkRequests PENDING_LINK) từng seed cho flow cũ KHÔNG còn khớp nghiệp vụ mới
    // nên đã bỏ. `miniLinkRequests` GIỮ LẠI làm mảng RỖNG (compatibility — vẫn được return ở cuối
    // build() để tránh lỗi runtime nếu còn chỗ nào đọc `A.db.miniLinkRequests`), không seed nội dung.
    const miniLinkRequests = [];

    // Người trực tiếp kinh doanh (Chợ Cao Lãnh): mặc định = người thuê; 2 điểm minh hoạ người bán thay
    // (điểm thứ 2 của tiểu thương nhiều điểm, và 1 điểm nhượng lại cho người khác trực tiếp bán).
    const noContractCl = traders.filter(t => t.market === 'CL' && !t.stalls.length && !contracts.some(c => c.traderId === t.id));
    const SELLER_OTHER = { 'CL-KA-A02': noContractCl[0], 'CL-TG-A03': noContractCl[1] };
    const directSellerAssignments = stalls.filter(s => s.market === 'CL' && contractOfPoint.has(s.id)).map((s, i) => {
      const owner = holder.get(s.id);
      const person = SELLER_OTHER[s.id] || owner;
      return {
        id: 'DSA-' + pad(i + 1, 4), market: s.market, pointId: s.id,
        traderId: person.id, personId: person.id,
        fullName: person.name, idNumber: person.idNo || '', phone: person.phone || '',
        relationship: person.id === owner.id ? 'Chủ thể hợp đồng trực tiếp kinh doanh' : 'Người bán thay',
        startDate: '2026-01-01', endDate: null, status: 'ACTIVE', source: 'SEED',
        verifiedBy: 'AC-NV01', verifiedAt: '2026-01-01', note: '', createdAt: '2026-01-01', updatedAt: '2026-01-01'
      };
    });
    // ---- QUA_HAN_CHUYEN_CONG_NO (v25): demo ĐÚNG 10 khoản quá hạn ở Chợ Cao Lãnh ----
    // Giữ 10 khoản kỳ 08/2026 chưa thu (quá hạn 15/08 → hệ thống tự chuyển công nợ lúc chạy), chia đều các NV thu
    // phí; mọi khoản chưa thu khác của kỳ 05–08 coi như đã thu tiền mặt đúng kỳ (1 biên lai / khoản, người thu =
    // NV phụ trách gian). Không dùng RNG; không đụng ngày hôm nay nên sao kê / nộp quỹ không đổi.
    (function seedDemoDebts() {
      const grouped = new Set(MARKETS.filter(m => m.receivableGrouping === 'TRADER').map(m => m.id));
      const old = invoices.filter(i => grouped.has(i.market) && i.period < '2026-09' && i.status !== 'paid').sort((a, b) => a.id.localeCompare(b.id));
      const collectorOf = i => collectorOfStall(stalls.find(x => x.id === ((i.stallIds && i.stallIds[0]) || i.stallId)));
      const byC = {};
      // QUA_HAN_KY_09 (v26, P chốt 29/09): demo nợ lấy từ KỲ 09 (không còn nợ kỳ 05–08). Mọi khoản kỳ 09 hạn nộp
      // 30/09; riêng 10 khoản CL (chia đều NV, 1 gian/khoản, bỏ TT0003) hạn 28/09 → quá hạn vào ngày dữ liệu 29/09
      // → hệ thống tự chuyển công nợ khi chạy (A.syncDebts).
      invoices.filter(i => i.period === '2026-09').forEach(i => { i.due = '2026-09-30'; });
      const sep = invoices.filter(i => grouped.has(i.market) && i.period === '2026-09' && i.status !== 'paid' && i.traderId !== 'TT0003' && (!i.stallIds || i.stallIds.length === 1)).sort((a, b) => a.id.localeCompare(b.id));
      sep.forEach(i => { const c = collectorOf(i); (byC[c] = byC[c] || []).push(i); });
      const keep = new Set(), cs = Object.keys(byC).sort();
      const step = c => Math.max(1, Math.floor(byC[c].length / 4));
      for (let k = 0; keep.size < 10 && cs.some(c => byC[c].length); k++) { const c = cs[k % cs.length]; const i = byC[c].splice(Math.min(byC[c].length - 1, step(c)), 1)[0]; if (i) keep.add(i.id); }
      // THU_HOI_NO demo (v27): 10 khoản nợ kỳ 09 trải đủ các bước của luồng (ngày dữ liệu 29/09): hạn 28/09 (mới
      // chuyển nợ), 25/09 (đã nhắc lần 1), 22/09 (đã nhắc lần 2), 20/09 (quá 7 ngày → danh sách cắt điện).
      cs.forEach((c, ci) => invoices.filter(i => keep.has(i.id) && collectorOf(i) === c).sort((a, b) => a.id.localeCompare(b.id)).forEach((i, j) => {
        i.due = '2026-09-' + [28, 25, ci === 1 ? 20 : 22, 20][Math.min(j, 3)];
      }));
      let n = payments.reduce((m, x) => Math.max(m, Number(String(x.id).replace(/\D/g, '')) || 0), 0);
      old.forEach((i, k) => {
        const code = collectorOf(i).replace(/^AC-/, '') || 'NV05', date = i.period + '-' + pad(8 + k % 6), time = pad(8 + k % 9) + ':' + pad(k * 7 % 60);
        const ids = Array.isArray(i.stallIds) && i.stallIds.length ? i.stallIds : [i.stallId];
        n++;
        payments.push({ id: 'GD' + pad(n, 6), invoiceId: i.id, market: i.market, traderId: i.traderId, amount: i.amount - (i.paid || 0), method: 'tm', date, time, by: code,
          receipt: 'BL-' + i.id.replace(/^PT-/, '') + '-' + pad(payments.filter(x => x.invoiceId === i.id).length + 1, 2), lookup: ('R' + i.id.replace(/\D/g, '')).slice(-6),
          paymentStatus: 'SUCCESS', paidAt: date + ' ' + time, receiptIssuedAt: date + ' ' + time, reconciled: null,
          receiptDelivery: { miniApp: true, sentAt: date + ' ' + time, status: 'SENT_MOCK' }, printStatus: 'PRINTED_MOCK', stallIds: ids.slice() });
        i.paid = i.amount; i.status = 'paid';
      });
    })();

    // ---- PHAT_HANH_KHOAN_THU (v23): phát hành kỳ 09/2026 đã gửi thông báo + chuyển danh sách thu ----
    // Trưởng Ban phát hành ngày 01/09 → (1) mỗi tiểu thương nhận thông báo mã khoản + số tiền (traderLines),
    // (2) danh sách thu chuyển cho NV thu phí được phân công theo khu (collectorCounts: số điểm / NV).
    (function seedIssueNotifications() {
      const P = '2026-09', label = '09/2026', MANAGER = { CL: 'Trần Minh Khoa' };
      let seq = 31;
      MARKETS.forEach(m => {
        const inv = invoices.filter(i => i.market === m.id && i.period === P);
        if (!inv.length) return;
        const traderLines = {}, collectorCounts = {};
        inv.forEach(i => {
          traderLines[i.traderId] = 'Mã khoản ' + i.id + ' · ' + i.amount.toLocaleString('vi-VN') + ' đ · hạn nộp ' + i.due.split('-').reverse().join('/') + '. Nộp tiền mặt cho NV thu phí hoặc quét QR trên Mini app.';
          (Array.isArray(i.stallIds) && i.stallIds.length ? i.stallIds : [i.stallId]).forEach(id => { const c = collectorOfStall(stalls.find(x => x.id === id)) || 'Chưa phân công'; collectorCounts[c] = (collectorCounts[c] || 0) + 1; });
        });
        const by = MANAGER[m.id] || '';
        notifications.unshift({ id: 'TB-' + pad(seq++, 3), at: P + '-01', kind: 'RECEIVABLE_LIST_TO_COLLECTORS', market: m.id, period: P, title: 'Chuyển danh sách thu kỳ ' + label + ' cho nhân viên thu phí', group: 'Nhân viên thu phí · ' + m.short, channels: ['Ứng dụng nhân viên'], sent: Object.keys(collectorCounts).filter(k => k !== 'Chưa phân công').length, delivered: 1, read: 1, auto: true, by, collectorCounts });
        notifications.unshift({ id: 'TB-' + pad(seq++, 3), at: P + '-01', kind: 'RECEIVABLE_ISSUED', market: m.id, period: P, title: 'Thông báo khoản phải nộp kỳ ' + label, group: 'Tiểu thương có khoản phải thu · ' + m.short, channels: ['Mini app', 'Zalo OA'], sent: Object.keys(traderLines).length, delivered: 0.97, read: 0.81, auto: true, by, traderLines });
      });
      BILLING_PERIODS.filter(b => b.id === P).forEach(b => { b.calculationStatus = 'ISSUED'; b.issuedAt = '01/09/2026 08:00'; b.issuedBy = 'Trần Minh Khoa'; });
    })();

    // KY_09_DEN_GHI_CHI_SO (v29): đưa kỳ 09/2026 của mọi chợ về đúng bước đầu luồng thu phí — NV thu phí đã ghi
    // đủ chỉ số điện, nước (giữ nguyên readings, kể cả 3 điểm tăng bất thường → "Cần kiểm tra"). Mọi dữ liệu
    // của các bước sau (khoản phải thu, thanh toán, sao kê, thông báo phát hành, nhật ký thu) bị gỡ để thao tác lại.
    (function resetPeriod09ToMeterRecorded() {
      const P = '2026-09', dropInv = new Set(invoices.filter(i => i.period === P).map(i => i.id));
      const dropPay = new Set(payments.filter(p => dropInv.has(p.invoiceId)).map(p => p.id));
      const keep = (arr, pred) => { for (let n = arr.length - 1; n >= 0; n--) if (!pred(arr[n])) arr.splice(n, 1); };
      keep(invoices, i => !dropInv.has(i.id));
      keep(payments, p => !dropPay.has(p.id));
      // Toàn bộ sao kê mẫu là giao dịch thu kỳ 09 (13/09) — chưa phát hành thì chưa có tiền về.
      keep(bank, b => b.date < P + '-01');
      keep(notifications, n => !(n.period === P && /^RECEIVABLE_/.test(n.kind || '')));
      keep(audit, a => !/kỳ 09\/2026|BL2609-|sao kê ngân hàng ngày 12\/09/.test(a.what || ''));
      // Chỉ số lùi (syncUtilityChargesWithReadings) ghi "08/<tháng sau>" → kỳ 09 phải ghi trong tháng 09.
      readings.filter(r => r.period === P && r.recordedAt && !/\/09\/2026/.test(r.recordedAt)).forEach(r => { r.recordedAt = '11/09/2026 09:00'; });
      const mp = METER_PERIODS.find(x => x.id === P);
      if (mp) {
        ['closedBy', 'closedAt', 'completedBy', 'completedAt', 'completionByMarket'].forEach(k => delete mp[k]);
        // reviewDemoSeeded chặn mrV4DemoReviews gắn thêm 3 cảnh báo giả: chỉ giữ cảnh báo thật theo số liệu.
        Object.assign(mp, { status: 'RECORDING', reviewDemoSeeded: true });
      }
      const bp = BILLING_PERIODS.find(x => x.id === P);
      if (bp) { ['issuedAt', 'issuedBy'].forEach(k => delete bp[k]); Object.assign(bp, { status: 'PREPARING', calculationStatus: 'DATA_ENTRY' }); }
    })();

    // KY_11_DEN_HOAN_TAT_GHI_CHI_SO (v31): mở kỳ thu 11/2026 như thao tác "Tạo kỳ thu" với lịch mặc định
    // (chuẩn bị/ghi 25/10, phát hành 28/10, bắt đầu thu 29/10, hạn 03/11). NV thu phí phụ trách Dãy đã ghi đủ
    // chỉ số mọi điểm có công tơ + hợp đồng hiệu lực (sản lượng 85–115% mức trung bình, không điểm bất thường)
    // → màn Chỉ số điện, nước dừng ở "Sẵn sàng hoàn tất"; Tổ trưởng bấm "Hoàn tất ghi chỉ số" để đi tiếp.
    (function openPeriod11WithMeterRecorded() {
      const P = '2026-11', hash = v => String(v).split('').reduce((n, ch) => ((n * 31) + ch.charCodeAt(0)) >>> 0, 7);
      BILLING_PERIODS.push({ id: P, label: '11/2026', preparationDate: '2026-10-25', meterReadDate: '2026-10-25', expectedIssueDate: '2026-10-28',
        startDate: '2026-10-29', dueDate: '2026-11-03', endDate: '2026-11-30', status: 'PREPARING', calculationStatus: 'DATA_ENTRY' });
      // reviewDemoSeeded: không để mrV4DemoReviews gắn cảnh báo giả làm khóa nút Hoàn tất.
      METER_PERIODS.push({ id: P, month: 11, year: 2026, status: 'RECORDING', closeDate: '2026-10-25', reviewDemoSeeded: true });
      stalls.filter(st => st.hasMeter && contracts.some(c => (c.businessPointId || c.stallId) === st.id && c.status === 'hieuluc')).forEach(st => {
        const prior = readings.filter(r => r.stallId === st.id && r.period < P && r.elecCur != null && r.waterCur != null).sort((a, b) => b.period.localeCompare(a.period))[0];
        const elecAvg = prior && prior.elecAvg > 0 ? prior.elecAvg : 100, waterAvg = prior && prior.waterAvg > 0 ? prior.waterAvg : 5, h = hash(st.id);
        const elecPrev = prior ? prior.elecCur : 0, waterPrev = prior ? prior.waterCur : 0, day = 20 + h % 6;
        readings.push({
          stallId: st.id, period: P, elecPrev, elecCur: elecPrev + Math.max(1, Math.round(elecAvg * (0.85 + (h % 31) / 100))), elecAvg,
          waterPrev, waterCur: waterPrev + Math.max(1, Math.round(waterAvg * (0.85 + (h % 29) / 100))), waterAvg, status: 'RECORDED',
          recordedBy: collectorOfStall(st).replace(/^AC-/, '') || (st.market === 'TTD' ? 'NV09' : 'NV05'),
          recordedAt: day + '/10/2026 ' + pad(7 + h % 9) + ':' + pad(h % 60),
          elecPhoto: { name: st.code + '-dien-11-2026.jpg', type: 'image/jpeg', size: 300000, mock: true },
          waterPhoto: { name: st.code + '-nuoc-11-2026.jpg', type: 'image/jpeg', size: 300000, mock: true }
        });
      });
    })();

    return {
      // KY_11_DEN_HOAN_TAT_GHI_CHI_SO: "hôm nay" = 29/10/2026 (ngày bắt đầu thu kỳ 11) để các bước thu tiền/chốt
      // buổi ghi nhận giao dịch trong khoảng thời gian thu của kỳ. Dữ liệu mẫu vẫn sinh theo mốc TODAY 13/09.
      version: VERSION, today: '2026-10-29', buildings, floors, rows, stalls, traders, contracts, invoices, payments, readings, incidents, marketAssets,
      notifications, sessions, marketSessions, sessionRegistrations, sessionPayments, sessionReceipts, sessionNotifications, sessionAttendances, sessionReplacements, bank, months, audit, issuedPeriods: PERIODS.filter(p => p !== '2026-09'), extraLog: [],
      meterPeriods: METER_PERIODS, meterAdjustRequests: [], receivableAdjustRequests: [],
      cashDeposits, cashConfirms, billingPeriods: BILLING_PERIODS,
      // Metadata trình bày của actor. Identity/name/roleId tiếp tục chỉ thuộc DATA.ACTORS;
      // collection này không được dùng cho RBAC và chỉ lưu hai field được phép chỉnh sửa trên UI.
      actorMetadata: ACTORS.map(a => ({ id: a.id, unit: a.unit, responsibilities: String(a.responsibility || '').split(/[;,]\s*/).filter(Boolean) })),
      pointRequests, directSellerAssignments, miniLinkRequests
    };
  }

  return { VERSION, TODAY, UNIT, SESSION_FEE, ELEC, WATER, RATE_MARKET_MODEL, RATE_COLLECTION_CYCLE, RATE_TAX_CLASS, WAIVER_TYPES, RATE_POLICY_SEED, BANK_BY_MARKET, BANKS, BANK_ACCOUNT_SEED, MARKETS, INDUSTRIES, INDUSTRY_CODES, POINT_STATUS, LAYOUT_SEED, STATUS, METHOD, INCIDENT_STATES, STAFF, ROLES, ACTORS, build };
})();

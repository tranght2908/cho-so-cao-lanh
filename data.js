/*
 * Dữ liệu MẪU cho prototype Hệ thống quản lý chợ số phường Cao Lãnh.
 * Toàn bộ tên người, số điện thoại, số giấy tờ, số tiền đều là GIẢ LẬP để minh họa.
 * Số liệu thật (số sạp, số tiểu thương, số thu) sẽ được thay khi khảo sát 02 chợ.
 */
window.DATA = (function () {
  'use strict';

  // v7 (màn Điểm kinh doanh CL): thêm field THUẦN HIỂN THỊ `pointType` trên section CL (khai báo rõ
  // ràng — xem MARKETS bên dưới) + lan truyền vào stall khi build() — KHÔNG đổi/xoá `type` (vẫn
  // dùng tính đơn giá dịch vụ ở các màn tài chính, giữ nguyên) và KHÔNG đổi `cat` (ngành hàng, khái
  // niệm riêng). Bump version để cache localStorage cũ (thiếu field mới) tự rebuild — độc lập với
  // RBAC_SCHEMA/PERM_SEED_VERSION (js/core.js, js/permissions.js — KHÔNG đổi 2 hằng số đó).
  const VERSION = 7;
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
      { id: 'sp-cl-kiot-v1', marketId: 'CL', area: 'Toàn chợ (hạng 1)', stallType: 'Ki-ốt', marketModel: RATE_MARKET_MODEL.FIXED_MONTHLY, collectionCycle: RATE_COLLECTION_CYCLE.MONTH, amount: 2000, unit: 'đ/m²/ngày', taxClass: RATE_TAX_CLASS.TAXABLE_REVENUE, waiverTypeId: 'WAIVER_AUTHORIZED_DECISION', effectiveFrom: '2026-02-14', effectiveTo: null, status: 'active', legalBasis: { docNo: '480/QĐ-UBND', docDate: '2026-02-14', issuer: 'UBND tỉnh Đồng Tháp', summary: 'Quy định đơn giá dịch vụ chợ', effectiveDate: '2026-02-14', note: '' }, attachments: [{ id: 'att-001', name: 'QD_480_2026.pdf', type: 'application/pdf', note: 'Văn bản căn cứ', mock: true }], history: [{ time: '14/02/2026 09:30', user: 'Trần Minh Khoa', action: 'Tạo đơn giá', detail: '2.000 đ/m²/ngày' }] },
      { id: 'sp-cl-nhalong-v1', marketId: 'CL', area: 'Toàn chợ (hạng 1)', stallType: 'Trong nhà lồng chợ', marketModel: RATE_MARKET_MODEL.FIXED_MONTHLY, collectionCycle: RATE_COLLECTION_CYCLE.MONTH, amount: 2000, unit: 'đ/m²/ngày', taxClass: RATE_TAX_CLASS.TAXABLE_REVENUE, waiverTypeId: 'WAIVER_AUTHORIZED_DECISION', effectiveFrom: '2026-02-14', effectiveTo: null, status: 'active', legalBasis: { docNo: '480/QĐ-UBND', docDate: '2026-02-14', issuer: 'UBND tỉnh Đồng Tháp', summary: 'Quy định đơn giá dịch vụ chợ', effectiveDate: '2026-02-14', note: '' }, attachments: [], history: [{ time: '14/02/2026 09:30', user: 'Trần Minh Khoa', action: 'Tạo đơn giá', detail: '2.000 đ/m²/ngày' }] },
      { id: 'sp-cl-ngoai-v1', marketId: 'CL', area: 'Ngoài nhà lồng', stallType: 'Tự sản tự tiêu', marketModel: RATE_MARKET_MODEL.FIXED_MONTHLY, collectionCycle: RATE_COLLECTION_CYCLE.MONTH, amount: 800, unit: 'đ/m²/ngày', taxClass: RATE_TAX_CLASS.TAXABLE_REVENUE, waiverTypeId: 'WAIVER_AUTHORIZED_DECISION', effectiveFrom: '2026-02-14', effectiveTo: null, status: 'active', legalBasis: { docNo: '480/QĐ-UBND', docDate: '2026-02-14', issuer: 'UBND tỉnh Đồng Tháp', summary: 'Quy định đơn giá dịch vụ chợ', effectiveDate: '2026-02-14', note: '' }, attachments: [{ id: 'att-002', name: 'bang_gia_trang_3.png', type: 'image/png', note: 'Trang có bảng đơn giá', mock: true }], history: [{ time: '14/02/2026 09:30', user: 'Trần Minh Khoa', action: 'Tạo đơn giá', detail: '800 đ/m²/ngày' }] },
      { id: 'sp-ttd-phien-v1', marketId: 'TTD', area: 'Khu chợ quê', stallType: 'Quầy theo phiên', marketModel: RATE_MARKET_MODEL.MARKET_SESSION, collectionCycle: RATE_COLLECTION_CYCLE.SESSION, amount: 20000, unit: 'đ/phiên', taxClass: RATE_TAX_CLASS.TAXABLE_REVENUE, waiverTypeId: null, effectiveFrom: '2026-01-01', effectiveTo: null, status: 'active', legalBasis: { docNo: '', docDate: '', issuer: 'UBND phường Cao Lãnh', summary: 'Mức thu giả định, chưa có trong phụ lục QĐ 480', effectiveDate: '2026-01-01', note: 'Giả định, chờ văn bản chính thức' }, attachments: [], history: [{ time: '01/01/2026 08:00', user: 'Trần Minh Khoa', action: 'Tạo đơn giá', detail: '20.000 đ/phiên' }] }
    ],
    utilities: [
      { id: 'ut-cl-v1', marketId: 'CL', marketModel: RATE_MARKET_MODEL.FIXED_MONTHLY, collectionCycle: RATE_COLLECTION_CYCLE.MONTH, elecPrice: 3200, elecUnit: 'đ/kWh', waterPrice: 12000, waterUnit: 'đ/m³', taxClass: RATE_TAX_CLASS.PASS_THROUGH_NON_TAX, waiverTypeId: null, effectiveFrom: '2026-01-01', effectiveTo: null, status: 'active', legalBasis: { docNo: '', docDate: '', issuer: 'Theo giá bán lẻ hiện hành', summary: 'Thu hộ điện, nước theo giá gốc cho điểm kinh doanh có đồng hồ riêng', effectiveDate: '2026-01-01', note: '' }, attachments: [], history: [{ time: '01/01/2026 08:00', user: 'Võ Hoàng Tuấn', action: 'Tạo cấu hình', detail: 'Điện 3.200 đ/kWh · Nước 12.000 đ/m³' }] }
    ],
    extraServices: [
      { id: 'es-cl-vesinh-v1', name: 'Vệ sinh', marketId: 'CL', marketModel: RATE_MARKET_MODEL.FIXED_MONTHLY, collectionCycle: RATE_COLLECTION_CYCLE.MONTH, calcMethod: 'area', amount: 2000, unit: 'đ/m²/tháng', taxClass: RATE_TAX_CLASS.TAXABLE_REVENUE, waiverTypeId: 'WAIVER_AUTHORIZED_DECISION', effectiveFrom: '2026-01-01', effectiveTo: null, status: 'active', legalBasis: { docNo: '', docDate: '', issuer: '', summary: '', effectiveDate: '', note: '' }, attachments: [], history: [{ time: '01/01/2026 08:00', user: 'Trần Minh Khoa', action: 'Tạo dịch vụ', detail: '2.000 đ/m²/tháng' }] },
      { id: 'es-cl-baove-v1', name: 'Bảo vệ', marketId: 'CL', marketModel: RATE_MARKET_MODEL.FIXED_MONTHLY, collectionCycle: RATE_COLLECTION_CYCLE.MONTH, calcMethod: 'fixed', amount: 50000, unit: 'đ/điểm/tháng', taxClass: RATE_TAX_CLASS.TAXABLE_REVENUE, waiverTypeId: null, effectiveFrom: '2026-01-01', effectiveTo: null, status: 'active', legalBasis: { docNo: '', docDate: '', issuer: '', summary: '', effectiveDate: '', note: '' }, attachments: [], history: [{ time: '01/01/2026 08:00', user: 'Trần Minh Khoa', action: 'Tạo dịch vụ', detail: '50.000 đ/điểm/tháng' }] },
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
      address: 'Khóm 7, phường Cao Lãnh, tỉnh Đồng Tháp',
      note: 'Tòa nhà chợ mới: 1 hầm, 1 trệt, 1 lầu, khoảng 20.435 m² sàn',
      priceNote: 'Giá dịch vụ theo QĐ 480/QĐ-UBND ngày 14/02/2026: ki-ốt và trong nhà lồng 2.000 đ/m²/ngày; ngoài nhà lồng 800 đ/m²/ngày',
      // pointType (CHỈ Chợ Cao Lãnh — màn "Điểm kinh doanh"): "loại điểm kinh doanh" theo nghĩa bán
      // lẻ (Quầy hàng/Sạp hàng/Ki-ốt/Cửa hàng), KHÁC với `type` phía trên (hạng mục tính đơn giá
      // dịch vụ theo QĐ 480 — giữ nguyên, không đổi) và KHÁC với `cat` (ngành hàng). Khai báo RÕ
      // RÀNG theo từng khu vực thực tế ngay tại đây (không suy đoán từ `cat`/ngành hàng):
      //   kiot   = Ki-ốt (đúng nghĩa vật lý — có vách ngăn, cửa riêng, mặt tiền)
      //   sap    = Sạp hàng (bàn/bục cố định — hàng tươi sống/khô/ăn uống)
      //   cuahang= Cửa hàng (không gian khép kín, diện tích lớn hơn — bách hóa/may mặc/dịch vụ)
      //   quay   = Quầy hàng (khu trưng bày nhỏ gọn ngoài nhà lồng)
      floors: [
        {
          id: 'T1', name: 'Tầng 1', desc: 'Lương thực, thực phẩm, thủy hải sản', sections: [
            { id: 'KA', name: 'Ki-ốt mặt tiền tầng 1', cat: 'Ki-ốt tổng hợp', type: 'kiot', pointType: 'kiot', rows: ['A'], per: 20, area: [12, 16], meter: true },
            { id: 'HS', name: 'Khu thủy hải sản', cat: 'Thủy hải sản', type: 'nhalong', pointType: 'sap', rows: ['A', 'B', 'C'], per: 12, area: [4, 6], meter: true },
            { id: 'TG', name: 'Khu thịt, gia cầm', cat: 'Thịt, gia cầm', type: 'nhalong', pointType: 'sap', rows: ['A', 'B'], per: 12, area: [4, 6], meter: true },
            { id: 'RC', name: 'Khu rau củ, trái cây', cat: 'Rau củ, trái cây', type: 'nhalong', pointType: 'sap', rows: ['A', 'B', 'C'], per: 12, area: [3, 5] },
            { id: 'LT', name: 'Khu lương thực, thực phẩm khô', cat: 'Lương thực, thực phẩm khô', type: 'nhalong', pointType: 'sap', rows: ['A', 'B'], per: 12, area: [4, 8] }
          ]
        },
        {
          id: 'T2', name: 'Tầng 2', desc: 'Bách hóa tổng hợp, ăn uống, dịch vụ', sections: [
            { id: 'KB', name: 'Ki-ốt tầng 2', cat: 'Ki-ốt tổng hợp', type: 'kiot', pointType: 'kiot', rows: ['A'], per: 16, area: [12, 16], meter: true },
            { id: 'BH', name: 'Khu bách hóa tổng hợp', cat: 'Bách hóa tổng hợp', type: 'nhalong', pointType: 'cuahang', rows: ['A', 'B', 'C'], per: 12, area: [4, 8] },
            { id: 'MM', name: 'Khu may mặc, giày dép', cat: 'May mặc, giày dép', type: 'nhalong', pointType: 'cuahang', rows: ['A', 'B', 'C'], per: 12, area: [4, 8] },
            { id: 'AU', name: 'Khu ăn uống', cat: 'Ăn uống', type: 'nhalong', pointType: 'sap', rows: ['A', 'B'], per: 10, area: [6, 10], meter: true },
            { id: 'DV', name: 'Khu dịch vụ cho thuê', cat: 'Dịch vụ', type: 'nhalong', pointType: 'cuahang', rows: ['A'], per: 10, area: [8, 12], meter: true }
          ]
        },
        {
          id: 'NL', name: 'Ngoài nhà lồng', desc: 'Bán hàng tự sản tự tiêu', sections: [
            { id: 'TS', name: 'Khu tự sản tự tiêu', cat: 'Nông sản tự sản tự tiêu', type: 'ngoai', pointType: 'quay', rows: ['A', 'B'], per: 15, area: [2, 3] }
          ]
        },
        { id: 'H', name: 'Tầng hầm', desc: 'Bãi xe và khu kỹ thuật – không bố trí điểm kinh doanh', sections: [], parking: true }
      ]
    },
    {
      id: 'TTD', name: 'Chợ quê Cù lao Tân Thuận Đông', short: 'Chợ quê Tân Thuận Đông', hang: 'Phiên chợ du lịch cộng đồng', kind: 'session',
      address: 'Tổ 4, khóm Tân Phát, phường Cao Lãnh, tỉnh Đồng Tháp',
      note: 'Họp chiều thứ Bảy hằng tuần, 14h–20h',
      priceNote: 'Chợ quê không có trong phụ lục QĐ 480. Mức thu 20.000 đ/quầy/phiên chỉ là GIẢ ĐỊNH để minh họa, do phường quyết định',
      floors: [
        {
          id: 'KHU', name: 'Khu chợ quê', desc: 'Họp chiều thứ Bảy, 14h–20h', sections: [
            { id: 'AT', name: 'Khu ẩm thực dân dã', cat: 'Ẩm thực dân dã', type: 'phien', rows: ['A', 'B'], per: 10, area: [6, 9] },
            { id: 'NS', name: 'Khu nông sản, đặc sản', cat: 'Nông sản, đặc sản', type: 'phien', rows: ['A'], per: 7, area: [6, 9] },
            { id: 'TN', name: 'Khu trải nghiệm tự làm món', cat: 'Trải nghiệm', type: 'phien', rows: ['A'], per: 9, area: [6, 9] }
          ]
        }
      ]
    }
  ];

  const STATUS = {
    thue: { label: 'Đang thuê', color: '#3aa85b' },
    no: { label: 'Nợ phí', color: '#de3b3d' },
    ngung: { label: 'Tạm ngừng', color: '#ef852e' },
    tranhchap: { label: 'Đang tranh chấp', color: '#7c54cd' },
    trong: { label: 'Còn trống', color: '#c9d3cf' }
  };

  // "Loại điểm kinh doanh" (màn Điểm kinh doanh, Chợ Cao Lãnh) — xem ghi chú `pointType` ở MARKETS.
  const POINT_TYPE = {
    quay: { label: 'Quầy hàng' },
    sap: { label: 'Sạp hàng' },
    kiot: { label: 'Ki-ốt' },
    cuahang: { label: 'Cửa hàng' }
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

  const STAFF = [
    { id: 'NV01', name: 'Trần Minh Khoa', role: 'Trưởng Ban Quản lý chợ', market: 'CL' },
    { id: 'NV02', name: 'Lê Thị Ngọc Hân', role: 'Kế toán', market: 'CL' },
    { id: 'NV03', name: 'Phạm Văn Lợi', role: 'Nhân viên thu phí', market: 'CL' },
    { id: 'NV04', name: 'Nguyễn Thị Diễm', role: 'Nhân viên thu phí', market: 'CL' },
    { id: 'NV05', name: 'Võ Hoàng Tuấn', role: 'Nhân viên kỹ thuật (điện, nước)', market: 'CL' },
    { id: 'NV06', name: 'Huỳnh Thanh Tâm', role: 'Tổ quản lý chợ quê', market: 'TTD' },
    { id: 'NV07', name: 'Đỗ Thị Kim Yến', role: 'Nhân viên thu phí phiên', market: 'TTD' }
  ];

  const ROLES = [
    { role: 'Lãnh đạo UBND phường', scope: 'Tất cả chợ', rights: 'Xem cổng giám sát, báo cáo, tra cứu; xử lý phản ánh vượt cấp' },
    { role: 'Trưởng Ban Quản lý chợ', scope: 'Chợ được giao', rights: 'Toàn quyền nghiệp vụ; phê duyệt miễn giảm, thanh lý hợp đồng' },
    { role: 'Kế toán', scope: 'Chợ được giao', rights: 'Phát hành khoản phải thu, đối soát, báo cáo tài chính' },
    { role: 'Nhân viên thu phí', scope: 'Chợ được giao', rights: 'Thu tiền, phát hành biên lai, ghi chỉ số điện nước' },
    { role: 'Nhân viên kỹ thuật', scope: 'Chợ được giao', rights: 'Nhận và xử lý công việc, sự cố được phân công' },
    { role: 'Tiểu thương', scope: 'Điểm kinh doanh của mình', rights: 'Mini app: xem, thanh toán khoản phải nộp; xem hợp đồng; gửi phản ánh' },
    { role: 'Quản trị hệ thống', scope: 'Toàn hệ thống', rights: 'Tài khoản, phân quyền, cấu hình đơn giá, kỳ thu, nhật ký' }
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

    // ---- Điểm kinh doanh ----
    MARKETS.forEach(m => m.floors.forEach(f => f.sections.forEach(s => s.rows.forEach(row => {
      for (let i = 1; i <= s.per; i++) {
        const code = s.id + '-' + row + pad(i);
        const area = +(s.area[0] + R() * (s.area[1] - s.area[0])).toFixed(1);
        let status;
        const r = R();
        if (m.kind === 'session') status = r < 0.05 ? 'trong' : r < 0.10 ? 'no' : 'thue';
        else status = r < 0.10 ? 'trong' : r < 0.14 ? 'ngung' : r < 0.21 ? 'no' : r < 0.225 ? 'tranhchap' : 'thue';
        stalls.push({
          id: m.id + '-' + code, code, market: m.id, floor: f.id, section: s.id, sectionName: s.name,
          row, num: i, type: s.type, pointType: s.pointType || null, cat: s.cat, area, hasMeter: !!s.meter, status, traderId: null,
          // sellerId (CHỈ Chợ Cao Lãnh — màn "Điểm kinh doanh"): người TRỰC TIẾP bán tại điểm, THAM
          // CHIẾU đúng entity `traders` sẵn có (không tạo entity/duplicate tên) — null = "chưa xác
          // định/giống người thuê hiện hành" (gán cụ thể ở bước tạo tiểu thương bên dưới cho điểm đã
          // có người thuê). KHÔNG dùng cho bất kỳ logic tài chính/hợp đồng/công nợ nào — các nghiệp
          // vụ đó GIỮ NGUYÊN gắn với traderId.
          sellerId: null, contractId: null, history: []
        });
      }
    }))));

    // ---- Tiểu thương ----
    let tSeq = 0;
    function newTrader(market, cat) {
      const female = chance(0.78);
      const name = female
        ? pick(HO) + ' ' + pick(DEM_NU) + ' ' + pick(TEN_NU)
        : pick(HO) + ' ' + pick(DEM_NAM) + ' ' + pick(TEN_NAM);
      const t = {
        id: 'TT' + pad(++tSeq, 4), name, gender: female ? 'Nữ' : 'Nam',
        phone: '09' + between(0, 9) + between(1000000, 9999999),
        idNo: '087' + between(100000000, 999999999),
        birth: between(1962, 1998),
        address: pick(['Khóm 1', 'Khóm 2', 'Khóm 3', 'Khóm 5', 'Khóm 7', 'Khóm Tân Phát', 'Khóm Đông Thạnh', 'Khóm Hòa Khánh', 'Khóm Mỹ Tây']) + ', phường Cao Lãnh',
        market, cat, hkd: chance(0.62),
        since: iso(new Date(between(2008, 2025), between(0, 11), between(1, 28))),
        app: chance(market === 'TTD' ? 0.64 : 0.57), bank: chance(0.74),
        stalls: []
      };
      traders.push(t);
      return t;
    }

    let prev = null;
    stalls.forEach(st => {
      if (st.status === 'trong') { prev = null; return; }
      let t;
      if (prev && prev.market === st.market && prev.cat === st.cat && prev.stalls.length < 2 && chance(0.07)) t = prev;
      else t = newTrader(st.market, st.cat);
      t.stalls.push(st.id);
      st.traderId = t.id;
      prev = t;
    });

    // ---- Người bán thực tế (sellerId, CHỈ Chợ Cao Lãnh — xem ghi chú ở stalls.push()) ----
    // Mặc định người bán = người thuê (đúng thực tế đa số điểm KD). Sau đó đổi sellerId khác
    // traderId ở MỘT SỐ ÍT điểm để minh hoạ đúng 2 trường hợp bắt buộc: (a) người thuê nhượng lại
    // cho người khác trực tiếp bán, (b) một người thuê nhiều điểm nhưng người bán từng điểm khác
    // nhau. Điểm còn trống KHÔNG gán sellerId (giữ null — không tạo người bán giả để lấp UI).
    const clOccupied = stalls.filter(s => s.market === 'CL' && s.traderId);
    clOccupied.forEach(s => { s.sellerId = s.traderId; });
    const clMultiStallTrader = traders.find(t => t.market === 'CL' && t.stalls.length >= 2);
    if (clMultiStallTrader) {
      const othersForMulti = traders.filter(x => x.market === 'CL' && x.id !== clMultiStallTrader.id);
      const st2 = othersForMulti.length && stalls.find(s => s.id === clMultiStallTrader.stalls[1]);
      if (st2) st2.sellerId = pick(othersForMulti).id;
    }
    let sellerSwaps = 0;
    clOccupied.forEach(s => {
      if (sellerSwaps >= 6 || s.sellerId !== s.traderId) return; // bỏ qua điểm đã đổi ở bước trên
      if (chance(0.03)) {
        const others = traders.filter(x => x.market === 'CL' && x.id !== s.traderId);
        if (others.length) { s.sellerId = pick(others).id; sellerSwaps++; }
      }
    });

    // ---- Hợp đồng ----
    let cSeq = 0;
    stalls.filter(s => s.traderId).forEach(st => {
      const m = st.market;
      let start, end;
      if (m === 'TTD') {
        start = new Date(2026, 0, 1); end = new Date(2026, 11, 31);
      } else if (chance(0.075)) {
        end = addDays(TODAY, between(3, 30)); start = addMonths(end, -36);
      } else {
        // bắt đầu từ 11/2023 đến 07/2026 để hợp đồng còn hiệu lực sau ngày 13/09/2026
        start = addMonths(new Date(2023, 10, 1), between(0, 32));
        end = addDays(addMonths(start, 36), -1);
      }
      const unit = m === 'TTD' ? SESSION_FEE : UNIT[st.type];
      const monthly = m === 'TTD' ? 0 : Math.round(st.area * unit * 30 / 1000) * 1000;
      const c = {
        id: 'HĐ-' + m + '-' + start.getFullYear() + '-' + pad(++cSeq, 4),
        stallId: st.id, traderId: st.traderId, market: m,
        kind: m === 'TTD' ? 'Đăng ký quầy theo năm' : 'Hợp đồng thuê điểm kinh doanh',
        start: iso(start), end: iso(end), unit, monthly,
        deposit: m === 'TTD' ? 0 : monthly, status: 'hieuluc', scanned: chance(0.8)
      };
      contracts.push(c);
      st.contractId = c.id;
    });

    // ---- Khoản phải thu & thanh toán ----
    const PERIODS = ['2026-05', '2026-06', '2026-07', '2026-08', '2026-09'];
    // Kỳ tài chính dùng chung cho 5 màn Tài chính (điện nước, khoản phải thu, thu tiền, đối soát, công nợ):
    // kỳ nghiệp vụ (billing period) tách biệt với ngày phát sinh giao dịch thực tế (payment/transaction date).
    const BILLING_PERIODS = PERIODS.map((p, idx) => {
      const [y, mo] = p.split('-').map(Number);
      const lastDay = new Date(y, mo, 0).getDate();
      return {
        id: p, label: pad(mo) + '/' + y,
        startDate: p + '-01', endDate: p + '-' + pad(lastDay), dueDate: p + '-15',
        status: idx === PERIODS.length - 1 ? 'COLLECTING' : 'PAST'
      };
    });
    const NONCASH = { '2026-05': 0.45, '2026-06': 0.52, '2026-07': 0.58, '2026-08': 0.64, '2026-09': 0.67 };
    const collectors = { CL: ['NV03', 'NV04'], TTD: ['NV07'] };
    let iSeq = 0, rSeq = 0;

    function makeItems(st, c, period) {
      const [y, mo] = period.split('-').map(Number);
      const items = [];
      if (st.market === 'TTD') {
        const n = saturdays(y, mo - 1).length;
        items.push({ name: 'Phí quầy theo phiên (' + n + ' phiên × ' + SESSION_FEE.toLocaleString('vi-VN') + ' đ)', amount: n * SESSION_FEE });
      } else {
        items.push({ name: 'Giá dịch vụ sử dụng diện tích bán hàng (' + st.area + ' m² × ' + c.unit.toLocaleString('vi-VN') + ' đ × 30 ngày)', amount: c.monthly });
        if (st.hasMeter) {
          const kwh = between(st.type === 'kiot' ? 120 : 50, st.type === 'kiot' ? 320 : 180);
          const m3 = between(2, st.section === 'AU' || st.section === 'HS' ? 18 : 6);
          items.push({ name: 'Tiền điện (' + kwh + ' kWh × ' + ELEC.toLocaleString('vi-VN') + ' đ)', amount: kwh * ELEC });
          items.push({ name: 'Tiền nước (' + m3 + ' m³ × ' + WATER.toLocaleString('vi-VN') + ' đ)', amount: m3 * WATER });
        }
      }
      return items;
    }

    stalls.filter(s => s.contractId).forEach(st => {
      const c = contracts.find(x => x.id === st.contractId);
      const debtMonths = st.status === 'no' ? between(1, 4) : 0;
      PERIODS.forEach((p, pi) => {
        const pStart = p + '-01';
        if (c.start > pStart && st.market === 'CL' && c.start.slice(0, 7) !== p) return;
        if (st.status === 'ngung' && pi >= 3) return; // tạm ngừng: không phát sinh 2 kỳ gần nhất
        const items = makeItems(st, c, p);
        const amount = items.reduce((a, b) => a + b.amount, 0);
        const [y, mo] = p.split('-').map(Number);
        const inv = {
          id: 'PT-' + p.replace('-', '') + '-' + pad(++iSeq, 5), period: p, market: st.market,
          stallId: st.id, traderId: st.traderId, contractId: c.id, items, amount, paid: 0,
          issued: iso(new Date(y, mo - 1, 1)), due: iso(new Date(y, mo - 1, 15)), status: 'unpaid', adjust: null, reminders: 0
        };
        const unpaidBecauseDebt = debtMonths && pi >= PERIODS.length - debtMonths;
        let pay = !unpaidBecauseDebt;
        if (p === '2026-09' && pay) pay = chance(0.62);
        if (pay) {
          const partial = chance(0.03);
          const amt = partial ? Math.round(amount * 0.5 / 1000) * 1000 : amount;
          const noncash = chance(NONCASH[p]);
          const method = noncash ? (chance(0.72) ? 'qr' : 'ck') : 'tm';
          let day = between(1, p === '2026-09' ? 13 : 15);
          if (p === '2026-09' && chance(0.22)) day = 13;
          const pr = {
            id: 'GD' + pad(++rSeq, 6), invoiceId: inv.id, market: st.market, traderId: st.traderId,
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
    payments.forEach(p => { p.lookup = (Math.floor(R() * 2176782336)).toString(36).toUpperCase().padStart(6, 'X'); });

    // ---- Kỳ ghi chỉ số điện, nước: mỗi tháng là 1 dataset độc lập, liên kết với nhau
    // (chỉ số MỚI của kỳ trước = chỉ số CŨ của kỳ sau) ----
    const METER_PERIODS = [
      { id: '2026-07', month: 7, year: 2026, status: 'CLOSED', closeDate: '2026-08-10', closedBy: 'Trần Minh Khoa', closedAt: '10/08/2026 17:05' },
      { id: '2026-08', month: 8, year: 2026, status: 'CLOSED', closeDate: '2026-09-10', closedBy: 'Trần Minh Khoa', closedAt: '10/09/2026 17:20' },
      { id: '2026-09', month: 9, year: 2026, status: 'RECORDING', closeDate: '2026-10-10' }
    ];
    const recAt = (mo, y, dMin, dMax) => pad(between(dMin, dMax)) + '/' + pad(mo) + '/' + y + ' ' + pad(between(7, 17)) + ':' + pad(between(0, 59));
    const mockPhoto = (code, kind, period) => ({ name: code + '-' + kind + '-' + period.slice(5) + '-' + period.slice(0, 4) + '.jpg', type: 'image/jpeg', size: between(180, 420) * 1000, mock: true });

    const readings = [];
    stalls.filter(s => s.hasMeter && s.traderId && s.status !== 'ngung').forEach(st => {
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
          recordedBy: done ? 'NV05' : null,
          recordedAt: done ? recAt(mo, y, 4, closed ? 9 : 12) : null,
          elecPhoto: done ? mockPhoto(st.code, 'dien', period) : null,
          waterPhoto: done ? mockPhoto(st.code, 'nuoc', period) : null
        });
      }
      mk('2026-07', 7, 2026, elecPrev07, elecCur07, waterPrev07, waterCur07, true);
      mk('2026-08', 8, 2026, elecPrev08, elecCur08, waterPrev08, waterCur08, true);
      mk('2026-09', 9, 2026, base09, elecCur09, wBase09, waterCur09, false);
    });

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
    const stateCycle = ['tiepnhan', 'phancong', 'dangxuly', 'dangxuly', 'chonghiemthu', 'hoanthanh', 'dong', 'tiepnhan', 'phancong', 'dangxuly', 'hoanthanh', 'dong', 'tiepnhan', 'chonghiemthu'];
    const rented = stalls.filter(s => s.traderId);
    const incidents = TPL.map((t, i) => {
      const st = i % 5 === 3 ? pick(rented.filter(s => s.market === 'TTD')) : pick(rented.filter(s => s.market === 'CL'));
      const created = addDays(TODAY, -between(0, 9));
      const state = stateCycle[i];
      return {
        id: 'SC-' + pad(i + 101, 4), market: st.market, stallId: st.id, traderId: st.traderId,
        cat: t[0], title: t[1], state, source: i % 3 === 0 ? 'Nhập tại Ban Quản lý' : 'Mini app tiểu thương',
        escalated: i === 3 || i === 10,
        created: iso(created), deadline: iso(addDays(created, t[0] === 'PCCC' || t[0] === 'Điện' ? 1 : 3)),
        assignee: state === 'tiepnhan' ? null : (st.market === 'TTD' ? 'NV06' : 'NV05'),
        rating: state === 'dong' ? between(4, 5) : null,
        log: [{ at: iso(created), text: 'Tiếp nhận phản ánh' }]
      };
    });

    // ---- Thông báo đã gửi ----
    const notifications = [
      { id: 'TB-031', at: '2026-09-01', title: 'Phát hành khoản phải thu kỳ 09/2026', group: 'Toàn bộ tiểu thương', channels: ['Mini app', 'Zalo OA'], sent: 0, delivered: 0.97, read: 0.81, auto: true },
      { id: 'TB-030', at: '2026-08-28', title: 'Lịch phun khử khuẩn toàn chợ ngày 30/8', group: 'Chợ Cao Lãnh', channels: ['Mini app', 'Zalo OA'], sent: 0, delivered: 0.96, read: 0.74, auto: false },
      { id: 'TB-029', at: '2026-08-20', title: 'Nhắc nộp phí quá hạn kỳ 08/2026', group: 'Danh sách nợ phí', channels: ['Mini app', 'Zalo OA', 'SMS'], sent: 0, delivered: 0.95, read: 0.69, auto: true },
      { id: 'TB-028', at: '2026-08-15', title: 'Hướng dẫn thanh toán bằng mã QR', group: 'Toàn bộ tiểu thương', channels: ['Mini app', 'Zalo OA'], sent: 0, delivered: 0.97, read: 0.77, auto: false },
      { id: 'TB-027', at: '2026-08-08', title: 'Phiên chợ quê thứ Bảy 08/8 kéo dài đến 21h', group: 'Chợ quê Tân Thuận Đông', channels: ['Mini app', 'Zalo OA'], sent: 0, delivered: 0.98, read: 0.88, auto: false }
    ];
    const countFor = g => g === 'Toàn bộ tiểu thương' ? traders.length : g === 'Chợ Cao Lãnh' ? traders.filter(t => t.market === 'CL').length : g === 'Chợ quê Tân Thuận Đông' ? traders.filter(t => t.market === 'TTD').length : Math.round(traders.length * 0.09);
    notifications.forEach(n => { n.sent = countFor(n.group); });

    // ---- Phiên chợ quê ----
    const sessions = [];
    const sessionRegistrations = [];
    const sessionAttendances = [];
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

    // ---- Đối soát: sao kê ngân hàng ngày 13/09/2026 ----
    // Chuỗi truy vết: BankStatementTransaction -> Payment -> Receivable (khoản phải thu) -> Receipt (biên lai)
    const todayIso = iso(TODAY);
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
    ];
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
      { at: '12/09/2026 16:40', who: 'Trần Minh Khoa', what: 'Phê duyệt miễn giảm 50% kỳ 09/2026 cho điểm KD HS-B07 (lý do: sửa chữa mái che)' },
      { at: '12/09/2026 09:05', who: 'Quản trị hệ thống', what: 'Cập nhật đơn giá theo QĐ 480/QĐ-UBND ngày 14/02/2026' },
      { at: '11/09/2026 14:21', who: 'Phạm Văn Lợi', what: 'Hủy biên lai BL2609-000388 (thu nhầm), lập lại BL2609-000391' },
      { at: '01/09/2026 00:05', who: 'Hệ thống', what: 'Tự động phát hành khoản phải thu kỳ 09/2026' }
    ];

    return {
      version: VERSION, today: iso(TODAY), stalls, traders, contracts, invoices, payments, readings, incidents,
      notifications, sessions, sessionRegistrations, sessionAttendances, sessionReplacements, bank, months, audit, issuedPeriods: PERIODS.slice(), extraLog: [],
      meterPeriods: METER_PERIODS, meterAdjustRequests: [],
      cashDeposits, cashConfirms, billingPeriods: BILLING_PERIODS
    };
  }

  return { VERSION, TODAY, UNIT, SESSION_FEE, ELEC, WATER, RATE_MARKET_MODEL, RATE_COLLECTION_CYCLE, RATE_TAX_CLASS, WAIVER_TYPES, RATE_POLICY_SEED, BANK_BY_MARKET, BANKS, BANK_ACCOUNT_SEED, MARKETS, STATUS, POINT_TYPE, METHOD, INCIDENT_STATES, STAFF, ROLES, build };
})();

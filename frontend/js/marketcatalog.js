/* Dữ liệu "Danh mục chợ" (Điều hành > Danh mục chợ) — quản lý thông tin CẤP CHỢ (tên, mã, địa
 * điểm, hạng, Ban Quản lý/người phụ trách, bảng giá áp dụng, trạng thái). KHÔNG lẫn với dữ liệu
 * cấu trúc bên trong 1 chợ (Khu/Tầng/Dãy/Điểm kinh doanh — đó là D.MARKETS[].floors, xem màn
 * "Mặt bằng & điểm kinh doanh", js/v-cautruc.js/v-tieuthuong.js).
 *
 * Nguồn dữ liệu DUY NHẤT cho DANH SÁCH chợ thuộc market master (12 chợ — RBAC_MARKET_SCOPE_MIGRATION,
 * xem D.MARKETS ở data.js) vẫn là D.MARKETS — module này KHÔNG tạo 1 mảng chợ song song cạnh tranh
 * với D.MARKETS, chỉ lưu THÊM các thuộc tính cấp danh mục mà D.MARKETS chưa có (hạng theo enum V1,
 * Ban Quản lý, người phụ trách, số điện thoại, bảng giá áp dụng, trạng thái hoạt động) — keyed theo
 * đúng D.MARKETS[].id. rows()/get() merge 2 nguồn này tại thời điểm đọc, không copy/ghi đè name/
 * address. 10/12 chợ (ngoài CL/TTD) mới chỉ có thông tin cấp chợ (floors:[] — chưa khảo sát hạ tầng),
 * module này vẫn seed đủ meta danh mục cho cả 12 chợ, không cần biết market nào có/thiếu cấu trúc
 * mặt bằng thật.
 *
 * "+ Thêm chợ mới" (V1 prototype, cho chợ THẬT SỰ NGOÀI market master 12 chợ, vd. mới sáp nhập/mới
 * phát sinh) chỉ tạo bản ghi CATALOG (tên, mã, địa điểm, hạng, BQL, bảng giá, trạng thái) — CỐ Ý
 * KHÔNG tự sinh thêm 1 phần tử D.MARKETS[] mới (không floors/sections) vì nhiều nơi trong app tra
 * cứu Chợ theo đúng market master hiện có (vd. account.marketScopes chỉ hợp lệ với id trong
 * D.MARKETS — xem A.allowedMarkets() ở js/core.js, D.BANK_BY_MARKET, ASSET ở js/v-baocao-mau.js…) —
 * thêm 1 market "rỗng" vào đó có nguy cơ hiện nhãn/undefined sai ở những màn KHÔNG thuộc phạm vi yêu
 * cầu này. Chợ mới tạo qua đây hiển thị đầy đủ trong "Danh mục chợ" (isCustom:true) nhưng CHƯA xuất
 * hiện ở bộ chọn Chợ trên topbar / Mặt bằng & điểm kinh doanh / gán account.marketScopes — đúng
 * nghiệp vụ thật: khai báo danh mục trước, khảo sát/triển khai hạ tầng (Mặt bằng) và mở rộng market
 * master là bước sau, ngoài phạm vi yêu cầu này.
 */
(function (A) {
  'use strict';
  const D = A.D;
  const CKEY = 'choso-caolanh-marketcatalog';

  // Hạng chợ (enum V1, KHÁC với D.MARKETS[].hang — chuỗi mô tả tự do dùng hiển thị ở Mặt bằng chợ,
  // GIỮ NGUYÊN không đổi/xoá).
  const RANKS = { HANG_1: 'Hạng 1', HANG_2: 'Hạng 2', HANG_3: 'Hạng 3' };
  const STATUS = { active: ['Hoạt động', 'ok'], inactive: ['Tạm ngừng', 'warn'] };

  // Cấu hình "Bảng giá áp dụng" tối giản cho màn Danh mục chợ (mục 6/9 yêu cầu) — mock/config data
  // RIÊNG cho màn này, KHÔNG nối vào D.RATE_POLICY_SEED/A.SERVICE_CFG (nguồn tính khoản phải thu thật
  // ở nhóm Tài chính, xem js/serviceconfig.js) để không ảnh hưởng nghiệp vụ Tài chính hiện có.
  const PRICE_CONFIGS = [
    {
      id: 'QD480_CHO_CAO_LANH', label: 'QĐ 480 — Chợ Cao Lãnh', shortLabel: 'QĐ 480',
      legalBasis: 'QĐ 480/QĐ-UBND ngày 14/02/2026', rows: [
        { label: 'Ki-ốt', amount: 2000, unit: 'đ/m²/ngày' },
        { label: 'Trong nhà lồng', amount: 2000, unit: 'đ/m²/ngày' },
        { label: 'Ngoài nhà lồng tự sản tự tiêu/hàng rong', amount: 800, unit: 'đ/m²/ngày' }
      ]
    },
    {
      id: 'QD480_NHOM_CON_LAI', label: 'QĐ 480 — Nhóm chợ còn lại', shortLabel: 'QĐ 480',
      legalBasis: 'QĐ 480/QĐ-UBND ngày 14/02/2026', rows: [
        { label: 'Có mái che', amount: 2000, unit: 'đ/m²/ngày' },
        { label: 'Không mái che hoặc mái che tự trang bị', amount: 1500, unit: 'đ/m²/ngày' },
        { label: 'Không mái che khu tự sản tự tiêu', amount: 1000, unit: 'đ/m²/ngày' }
      ]
    }
  ];

  function isBuiltin(id) { return !!(D.MARKETS || []).find(m => m.id === id); }
  function staffManagerName(mid) {
    const s = (D.STAFF || []).find(x => x.market === mid && x.role === 'Trưởng Ban Quản lý chợ');
    if (s) return s.name;
    // 10 chợ mới trong market master (RBAC_MARKET_SCOPE_MIGRATION) không có D.STAFF (nghiệp vụ
    // Phản ánh & sự cố ở data.js vẫn chỉ dùng CL/TTD) — tra account demo market_manager tương ứng
    // (js/accounts.js) làm "Người phụ trách" mặc định thay vì để trống.
    const acc = A.ACCOUNTS && A.ACCOUNTS.list().find(a => A.ACCOUNTS.primaryRole(a) === 'market_manager' && (a.marketScopes || []).indexOf(mid) !== -1);
    return acc ? acc.fullName : '';
  }
  // Hạng chợ mặc định theo đúng market master 12 chợ (RBAC_MARKET_SCOPE_MIGRATION mục 4) — CL hạng
  // 1, HA hạng 2, 10 chợ còn lại hạng 3.
  const RANK_BY_MARKET = { CL: 'HANG_1', HA: 'HANG_2' };
  function defaultMetaFor(m) {
    return {
      id: m.id, code: m.id,
      rank: RANK_BY_MARKET[m.id] || 'HANG_3',
      unit: 'Ban Quản lý ' + m.name,
      manager: staffManagerName(m.id),
      phone: '',
      priceConfigId: m.id === 'CL' ? 'QD480_CHO_CAO_LANH' : 'QD480_NHOM_CON_LAI',
      status: 'active',
      createdBy: 'Hệ thống (seed mặc định)', createdAt: 'seed', updatedBy: null, updatedAt: null
    };
  }
  function defaultCatalog() { return (D.MARKETS || []).map(defaultMetaFor); }

  function loadList() {
    try {
      const s = localStorage.getItem(CKEY);
      if (s) { const x = JSON.parse(s); if (Array.isArray(x)) return x; }
    } catch (e) { /* bỏ qua */ }
    return defaultCatalog();
  }
  let LIST = loadList();
  function save() { try { localStorage.setItem(CKEY, JSON.stringify(LIST)); } catch (e) { /* bỏ qua */ } }
  // Bổ sung meta mặc định cho market builtin MỚI xuất hiện trong D.MARKETS (chưa từng có trong
  // LIST đã lưu) — idempotent, không đụng bản ghi đã có/đã tuỳ biến.
  function ensureSeeded() {
    let changed = false;
    (D.MARKETS || []).forEach(m => {
      if (!LIST.some(x => x.id === m.id)) { LIST.push(defaultMetaFor(m)); changed = true; }
    });
    if (changed) save();
  }
  ensureSeeded();

  function metaRow(id) { return LIST.find(x => x.id === id); }
  function mergedRow(id) {
    const meta = metaRow(id);
    if (!meta) return null;
    if (isBuiltin(id)) {
      const m = D.MARKETS.find(x => x.id === id);
      return {
        id: m.id, code: meta.code || m.id, name: m.name, address: m.address,
        rank: meta.rank, unit: meta.unit, manager: meta.manager, phone: meta.phone,
        priceConfigId: meta.priceConfigId, status: meta.status, isCustom: false,
        createdBy: meta.createdBy, createdAt: meta.createdAt, updatedBy: meta.updatedBy, updatedAt: meta.updatedAt
      };
    }
    return Object.assign({ isCustom: true }, meta);
  }

  const MC = A.MARKET_CATALOG = {
    KEY: CKEY,
    RANKS: RANKS,
    STATUS: STATUS,
    PRICE_CONFIGS: PRICE_CONFIGS,
    priceConfig: id => PRICE_CONFIGS.find(p => p.id === id) || null,
    rows: () => { ensureSeeded(); return LIST.map(x => mergedRow(x.id)).filter(Boolean); },
    get: id => { ensureSeeded(); return mergedRow(id); },
    isBuiltin: isBuiltin,
    codeTaken: (code, excludeId) => {
      const c = String(code || '').trim().toUpperCase();
      if (!c) return false;
      return MC.rows().some(r => r.id !== excludeId && r.code.toUpperCase() === c);
    },
    // Chỉ tạo bản ghi DANH MỤC (không tạo D.MARKETS[] mới — xem ghi chú đầu file).
    add: (rec, user) => {
      const id = String(rec.code || '').trim().toUpperCase();
      const row = {
        id: id, code: id, name: (rec.name || '').trim(), address: (rec.address || '').trim(),
        rank: rec.rank, unit: (rec.unit || '').trim(), manager: (rec.manager || '').trim(),
        phone: (rec.phone || '').trim(), priceConfigId: rec.priceConfigId, status: rec.status || 'active',
        createdBy: user || 'Không rõ', createdAt: new Date().toISOString(), updatedBy: user || 'Không rõ', updatedAt: new Date().toISOString()
      };
      LIST.push(row);
      save();
      return mergedRow(row.id);
    },
    update: (id, patch, user) => {
      const meta = metaRow(id);
      if (!meta) return null;
      if (isBuiltin(id)) {
        // Tên/Địa điểm của 2 chợ hệ thống hiện có thuộc D.MARKETS (nguồn hiển thị dùng chung toàn
        // app, vd. Mặt bằng chợ, MARKET_LABELS ở js/core.js) — cập nhật TRỰC TIẾP tại đây khi có,
        // không lưu bản sao trong meta để tránh 2 nguồn lệch nhau. Không đổi `short`/`hang`/`floors`.
        const m = D.MARKETS.find(x => x.id === id);
        if (m && patch.address !== undefined) m.address = String(patch.address || '').trim();
      } else {
        if (patch.name !== undefined) meta.name = String(patch.name || '').trim();
        if (patch.address !== undefined) meta.address = String(patch.address || '').trim();
      }
      ['rank', 'unit', 'manager', 'phone', 'priceConfigId', 'status'].forEach(k => {
        if (patch[k] !== undefined) meta[k] = patch[k];
      });
      meta.updatedBy = user || 'Không rõ';
      meta.updatedAt = new Date().toISOString();
      save();
      return mergedRow(id);
    },
    resetDefault: () => { LIST = defaultCatalog(); save(); }
  };
})(window.APP);

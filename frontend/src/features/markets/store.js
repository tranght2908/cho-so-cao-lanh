/* Dữ liệu "Danh mục chợ" (Điều hành > Danh mục chợ) — quản lý thông tin CẤP CHỢ (tên, mã, địa
 * điểm, hạng, Ban Quản lý/người phụ trách, bảng giá áp dụng, trạng thái). KHÔNG lẫn với dữ liệu
 * cấu trúc bên trong 1 chợ (Khối/Tầng/Dãy/Điểm kinh doanh — đó là A.db.buildings/floors/rows/stalls, xem màn
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
 * "+ Thêm chợ mới" (chợ NGOÀI 12 chợ gốc) chỉ tạo bản ghi CATALOG (isCustom:true) — KHÔNG ghi thêm
 * phần tử vào D.MARKETS (mock seed tĩnh của data.js).
 *
 * DANH SÁCH CHỢ HIỆU LỰC — read-model DUY NHẤT cho toàn app: A.effectiveMarkets()
 *   = D.MARKETS (12 chợ gốc, giữ nguyên object/id) + chợ custom trong danh mục, merge theo id (chợ
 *   gốc luôn thắng, không bao giờ trùng). Chợ custom được trình bày cùng shape với chợ gốc (không mang
 *   cấu trúc mặt bằng — cấu trúc nằm ở A.db.buildings/floors/rows), object ổn định theo id. U.market()/U.mShort() và A.allowedMarkets()
 *   (giải mã marketScopes) đều đọc qua đây. KHÔNG tự cấp marketScope cho account nào: account có
 *   'ALL' (Quản trị hệ thống/Lãnh đạo phường) thấy chợ custom; account bị giới hạn marketScopes chỉ
 *   thấy khi được gán đúng id chợ đó.
 */
(function (A) {
  'use strict';
  const D = A.D;
  const U = A.U;
  const CKEY = 'choso-caolanh-marketcatalog';

  // Hạng chợ (enum V1, KHÁC với D.MARKETS[].hang — chuỗi mô tả tự do dùng hiển thị ở Mặt bằng chợ,
  // GIỮ NGUYÊN không đổi/xoá).
  const RANKS = { HANG_1: 'Hạng 1', HANG_2: 'Hạng 2', HANG_3: 'Hạng 3' };
  const STATUS = { NOT_ACTIVE: ['Chưa hoạt động', 'warn'], ACTIVE: ['Đang hoạt động', 'ok'] };
  const LAYOUT_STATUS = { PENDING_SETUP: 'Chưa thiết lập', SETUP_COMPLETED: 'Đã thiết lập' };
  const normalizeStatus = value => value === 'ACTIVE' || value === 'active' ? 'ACTIVE' : 'NOT_ACTIVE';
  const normalizeLayoutStatus = value => value === 'SETUP_COMPLETED' ? 'SETUP_COMPLETED' : 'PENDING_SETUP';
  // Cả 12 chợ thuộc một Tổ Quản lý chợ. Không suy ra đơn vị hoặc nhân sự theo từng market.
  const MANAGEMENT_UNIT = 'Tổ Quản lý chợ';

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
  // Hạng chợ mặc định theo đúng market master 12 chợ (RBAC_MARKET_SCOPE_MIGRATION mục 4) — CL hạng
  // 1, HA hạng 2, 10 chợ còn lại hạng 3.
  const RANK_BY_MARKET = { CL: 'HANG_1', HA: 'HANG_2' };
  function defaultMetaFor(m) {
    return {
      id: m.id, code: m.id,
      rank: RANK_BY_MARKET[m.id] || 'HANG_3',
      unit: MANAGEMENT_UNIT,
      // Legacy/deprecated: personnel assignment belongs to Account/RBAC/marketScopes, not Market.
      manager: '',
      priceConfigId: m.id === 'CL' ? 'QD480_CHO_CAO_LANH' : 'QD480_NHOM_CON_LAI',
      // A catalog record or declared area never activates a market. Only the
      // lifecycle migration/complete-layout command may mark it active.
      status: 'NOT_ACTIVE', layoutStatus: 'PENDING_SETUP', layoutLifecycleVersion: 0,
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
  // Trả về false khi localStorage từ chối ghi (vd. hết dung lượng do ảnh đại diện) — add/update hoàn tác
  // bản ghi trong bộ nhớ để màn hình báo lỗi thay vì "lưu" một trạng thái sẽ mất sau khi tải lại.
  function save() {
    try { localStorage.setItem(CKEY, JSON.stringify(LIST)); return true; }
    catch (e) { if (typeof console !== 'undefined' && console.error) console.error('[market-catalog] Không ghi được localStorage:', e); return false; }
  }
  function reload() {
    const next = loadList();
    if (JSON.stringify(next) === JSON.stringify(LIST)) return { changed: false };
    LIST = next;
    ensureSeeded();
    return { changed: true };
  }
  // Bổ sung meta mặc định cho market builtin MỚI xuất hiện trong D.MARKETS (chưa từng có trong
  // LIST đã lưu) — idempotent, không đụng bản ghi đã có/đã tuỳ biến.
  function ensureSeeded() {
    let changed = false;
    LIST.forEach(row => {
      if (!row) return;
      const status = normalizeStatus(row.status), layoutStatus = normalizeLayoutStatus(row.layoutStatus);
      if (row.status !== status) { row.status = status; changed = true; }
      if (row.layoutStatus !== layoutStatus) { row.layoutStatus = layoutStatus; changed = true; }
    });
    (D.MARKETS || []).forEach(m => {
      if (!LIST.some(x => x.id === m.id)) { LIST.push(defaultMetaFor(m)); changed = true; }
    });
    if (changed) save();
  }
  ensureSeeded();

  function metaRow(id) { return LIST.find(x => x.id === id); }

  // Single catalog-side lifecycle normalizer. The lifecycle service supplies
  // whether the canonical layout graph is complete and whether the market may be
  // activated (layout + fee coverage — lifecycle.service.canActivateMarket); this
  // function persists the matching pair atomically and is safe on every load.
  //   layout chưa xong          → PENDING_SETUP + NOT_ACTIVE (giữ quy tắc cũ).
  //   layout xong, đủ điều kiện → ACTIVE.
  //   layout xong, chưa đủ      → giữ nguyên status hiện có: chợ mới ở NOT_ACTIVE; chợ legacy đã ACTIVE
  //                               KHÔNG bị hạ hàng loạt (lifecycle.marketLifecycle báo legacyActiveGap).
  function normalizeLifecycle(id, layoutComplete, user, opts) {
    const meta = metaRow(id);
    if (!meta) return null;
    const layoutStatus = layoutComplete ? 'SETUP_COMPLETED' : 'PENDING_SETUP';
    const status = !layoutComplete ? 'NOT_ACTIVE' : (opts && opts.canActivate) ? 'ACTIVE' : normalizeStatus(meta.status);
    const changed = meta.layoutStatus !== layoutStatus || meta.status !== status || !meta.layoutLifecycleVersion;
    if (!changed) return { changed: false, market: mergedRow(id) };
    meta.layoutStatus = layoutStatus;
    meta.status = status;
    meta.layoutLifecycleVersion = 1;
    meta.updatedBy = user || 'Migration lifecycle';
    meta.updatedAt = new Date().toISOString();
    save();
    return { changed: true, market: mergedRow(id) };
  }
  // Quy mô chợ & loại diện tích kinh doanh áp dụng do Quản trị hệ thống khai báo:
  //   totalArea          : tổng diện tích chợ (m²)
  //   businessArea       : diện tích phục vụ kinh doanh (m²), 0 <= businessArea <= totalArea
  //   allowedAreaTypeIds : [areaTypeId] — các loại diện tích (U.AREA_TYPE_CODES) được dùng khi bố trí
  //                        điểm kinh doanh tại chợ; null = chưa cấu hình. KHÔNG có quota số điểm/m²
  //                        theo loại — phân bổ do mặt bằng thực tế quyết định.
  //   capacityByAreaType : [{ areaTypeId, maxPointCount, maxArea }] — LEGACY (mô hình chỉ tiêu cũ). Danh
  //                        mục chợ không ghi mới field này; bản ghi cũ vẫn giữ nguyên (không migration
  //                        phá huỷ) nhưng KHÔNG còn module nào dùng làm quota (Mặt bằng đã bỏ).
  // Field TUỲ CHỌN, thêm tương thích ngược: bản ghi đã lưu trước đây (chưa có field) đọc ra null =
  // "Chưa cập nhật" — không migration ghi đè, không tự bịa số liệu cho 12 chợ hiện có. Phần "đã sử
  // dụng" KHÔNG lưu ở đây (suy ra từ điểm kinh doanh thật, xem features/markets/service.js).
  // Ảnh đại diện chợ (prototype: Data URL lưu trong danh mục, không upload server). null = dùng placeholder.
  // Bản ghi cũ chưa có field → null; giá trị hỏng (không phải data:image/jpeg|png) cũng coi như chưa có ảnh.
  function imageOf(v) {
    if (!v || typeof v !== 'object' || !/^data:image\/(jpeg|png);base64,/.test(String(v.dataUrl || ''))) return null;
    return { name: String(v.name || ''), type: String(v.type || ''), dataUrl: String(v.dataUrl) };
  }
  function num(v) { return v === null || v === undefined || v === '' || !isFinite(Number(v)) ? null : Number(v); }
  function scaleOf(meta) {
    const cap = Array.isArray(meta.capacityByAreaType)
      ? meta.capacityByAreaType.filter(x => x && x.areaTypeId).map(x => ({ areaTypeId: String(x.areaTypeId), maxPointCount: num(x.maxPointCount) || 0, maxArea: num(x.maxArea) || 0 }))
      : null;
    const totalArea = num(meta.totalArea), businessArea = num(meta.businessArea);
    return { totalArea, businessArea, nonBusinessArea: totalArea !== null && businessArea !== null ? totalArea - businessArea : null, capacityByAreaType: cap, allowedAreaTypeIds: allowedAreaTypesOf(meta) };
  }
  // Đọc tương thích: ưu tiên allowedAreaTypeIds; bản ghi cũ chỉ có capacityByAreaType → suy ra các loại
  // đã thực sự khai báo chỉ tiêu (> 0 điểm hoặc > 0 m²). Form cũ luôn ghi đủ 4 loại kể cả dòng 0/0, nên
  // dòng 0/0 KHÔNG được coi là "áp dụng". Chỉ đọc — không ghi đè bản ghi đã lưu.
  function allowedAreaTypesOf(meta) {
    const codes = U.AREA_TYPE_CODES || [];
    if (Array.isArray(meta.allowedAreaTypeIds)) return codes.filter(k => meta.allowedAreaTypeIds.indexOf(k) !== -1);
    if (Array.isArray(meta.capacityByAreaType)) {
      return codes.filter(k => meta.capacityByAreaType.some(x => x && x.areaTypeId === k && ((num(x.maxPointCount) || 0) > 0 || (num(x.maxArea) || 0) > 0)));
    }
    return null;
  }
  function mergedRow(id) {
    const meta = metaRow(id);
    if (!meta) return null;
    if (isBuiltin(id)) {
      const m = D.MARKETS.find(x => x.id === id);
      return Object.assign({
        id: m.id, code: meta.code || m.id, name: m.name, address: m.address,
        // phone: LEGACY — chỉ đọc lại giá trị cũ đã lưu; số liên hệ thuộc tài khoản người phụ trách.
        rank: meta.rank, unit: meta.unit, manager: meta.manager, phone: meta.phone, image: imageOf(meta.image),
        priceConfigId: meta.priceConfigId, status: normalizeStatus(meta.status), layoutStatus: normalizeLayoutStatus(meta.layoutStatus), layoutLifecycleVersion: meta.layoutLifecycleVersion || 0, isCustom: false,
        createdBy: meta.createdBy, createdAt: meta.createdAt, updatedBy: meta.updatedBy, updatedAt: meta.updatedAt
      }, scaleOf(meta));
    }
    return Object.assign({ isCustom: true }, meta, { image: imageOf(meta.image) }, scaleOf(meta));
  }
  // Mã cho CHỢ MỚI do hệ thống tự sinh (CHO13, CHO14…) — không trùng id D.MARKETS lẫn mã danh mục đã
  // có; mã/id của các chợ hiện có giữ nguyên, không đổi tên.
  function nextCode() {
    const taken = new Set(LIST.map(x => String(x.code || x.id).toUpperCase()).concat((D.MARKETS || []).map(m => m.id.toUpperCase())));
    let n = LIST.length + 1, code;
    do { code = 'CHO' + String(n++).padStart(2, '0'); } while (taken.has(code));
    return code;
  }

  // ---- Danh sách chợ hiệu lực (xem ghi chú đầu file) ----
  const CUSTOM_VIEWS = new Map(); // id → object chợ custom ổn định (cùng shape D.MARKETS[])
  function customMarketView(meta) {
    let m = CUSTOM_VIEWS.get(meta.id);
    if (!m) { m = { id: meta.id, note: '', priceNote: '', kind: 'daily', isCustom: true }; CUSTOM_VIEWS.set(meta.id, m); }
    m.name = meta.name || meta.id;
    m.short = meta.name || meta.id;
    m.address = meta.address || '';
    m.hang = RANKS[meta.rank] ? 'Chợ ' + RANKS[meta.rank].toLowerCase() : '';
    return m;
  }
  function effectiveMarkets() {
    const base = D.MARKETS || [];
    const seen = new Set(base.map(m => m.id));
    const custom = [];
    LIST.forEach(x => {
      if (!x || !x.id || seen.has(x.id)) return; // chợ gốc thắng; không trùng id
      seen.add(x.id);
      custom.push(customMarketView(x));
    });
    return custom.length ? base.concat(custom) : base;
  }
  // Display helper only: do not rewrite legacy `unit` values persisted in existing catalogs.
  function marketManagementUnit() { return MANAGEMENT_UNIT; }
  A.effectiveMarkets = effectiveMarkets;

  const MC = A.MARKET_CATALOG = {
    KEY: CKEY,
    RANKS: RANKS,
    STATUS: STATUS,
    LAYOUT_STATUS: LAYOUT_STATUS,
    normalizeStatus: normalizeStatus,
    MANAGEMENT_UNIT: MANAGEMENT_UNIT,
    marketManagementUnit: marketManagementUnit,
    PRICE_CONFIGS: PRICE_CONFIGS,
    priceConfig: id => PRICE_CONFIGS.find(p => p.id === id) || null,
    rows: () => { ensureSeeded(); return LIST.map(x => mergedRow(x.id)).filter(Boolean); },
    get: id => { ensureSeeded(); return mergedRow(id); },
    isBuiltin: isBuiltin,
    effectiveMarkets: effectiveMarkets,
    reload: reload,
    codeTaken: (code, excludeId) => {
      const c = String(code || '').trim().toUpperCase();
      if (!c) return false;
      return MC.rows().some(r => r.id !== excludeId && r.code.toUpperCase() === c);
    },
    nextCode: nextCode,
    // Chỉ tạo bản ghi DANH MỤC (không tạo D.MARKETS[] mới — xem ghi chú đầu file).
    // Bước 1 của quy trình (tạo chợ / thông tin cơ bản): KHÔNG gán bảng giá, loại diện tích, đơn vị quản
    // lý (đơn vị chung suy ra từ marketManagementUnit), không tạo mặt bằng/điểm kinh doanh. Chợ mới luôn
    // Chưa hoạt động + Chưa thiết lập mặt bằng; chỉ completeLayoutSetup/normalizeLifecycle được kích hoạt.
    // Trả về null nếu không ghi được localStorage (bản ghi được hoàn tác).
    add: (rec, user) => {
      const id = String(rec.code || '').trim().toUpperCase() || nextCode();
      const row = {
        id: id, code: id, name: (rec.name || '').trim(), address: (rec.address || '').trim(),
        rank: rec.rank,
        // Retained solely for compatibility with legacy persisted records; Markets never assigns it.
        manager: (rec.manager || '').trim(),
        image: imageOf(rec.image),
        priceConfigId: rec.priceConfigId || null, status: 'NOT_ACTIVE', layoutStatus: 'PENDING_SETUP', layoutLifecycleVersion: 1,
        totalArea: num(rec.totalArea), businessArea: num(rec.businessArea),
        allowedAreaTypeIds: Array.isArray(rec.allowedAreaTypeIds) ? rec.allowedAreaTypeIds.slice() : null,
        // Legacy: chỉ giữ nếu nơi gọi truyền vào (màn Danh mục chợ không còn truyền).
        capacityByAreaType: Array.isArray(rec.capacityByAreaType) ? rec.capacityByAreaType : null,
        createdBy: user || 'Không rõ', createdAt: new Date().toISOString(), updatedBy: user || 'Không rõ', updatedAt: new Date().toISOString()
      };
      LIST.push(row);
      if (!save()) { LIST.pop(); return null; }
      return mergedRow(row.id);
    },
    update: (id, patch, user) => {
      const meta = metaRow(id);
      if (!meta) return null;
      // Ảnh chụp trước khi sửa để hoàn tác nếu localStorage từ chối ghi (trả về null).
      const metaBefore = JSON.stringify(meta);
      const base = isBuiltin(id) ? D.MARKETS.find(x => x.id === id) : null;
      const baseBefore = base ? { name: base.name, address: base.address } : null;
      if (isBuiltin(id)) {
        // Tên/Địa điểm của 2 chợ hệ thống hiện có thuộc D.MARKETS (nguồn hiển thị dùng chung toàn
        // app, vd. Mặt bằng chợ, MARKET_LABELS ở js/core.js) — cập nhật TRỰC TIẾP tại đây khi có,
        // không lưu bản sao trong meta để tránh 2 nguồn lệch nhau. Không đổi `short`/`hang`/`floors`.
        const m = D.MARKETS.find(x => x.id === id);
        if (m && patch.name !== undefined) m.name = String(patch.name || '').trim();
        if (m && patch.address !== undefined) m.address = String(patch.address || '').trim();
      } else {
        if (patch.name !== undefined) meta.name = String(patch.name || '').trim();
        if (patch.address !== undefined) meta.address = String(patch.address || '').trim();
      }
      ['rank', 'unit', 'manager', 'priceConfigId', 'totalArea', 'businessArea', 'allowedAreaTypeIds', 'capacityByAreaType'].forEach(k => {
        if (patch[k] !== undefined) meta[k] = patch[k];
      });
      if (patch.image !== undefined) meta.image = imageOf(patch.image);
      if (patch.status !== undefined) meta.status = normalizeStatus(patch.status);
      if (patch.layoutStatus !== undefined) meta.layoutStatus = normalizeLayoutStatus(patch.layoutStatus);
      meta.updatedBy = user || 'Không rõ';
      meta.updatedAt = new Date().toISOString();
      if (!save()) {
        const prev = JSON.parse(metaBefore);
        Object.keys(meta).forEach(k => { delete meta[k]; });
        Object.assign(meta, prev);
        if (base) Object.assign(base, baseBefore);
        return null;
      }
      return mergedRow(id);
    },
    normalizeLifecycle: normalizeLifecycle,
    // Hoàn tất mặt bằng CHỈ đặt tình trạng mặt bằng; không tự kích hoạt chợ (xem normalizeLifecycle).
    completeLayoutSetup: (id, user) => {
      const meta = metaRow(id);
      if (!meta) return null;
      meta.layoutStatus = 'SETUP_COMPLETED'; meta.layoutLifecycleVersion = 1;
      meta.updatedBy = user || 'Hệ thống'; meta.updatedAt = new Date().toISOString();
      save();
      return mergedRow(id);
    },
    resetDefault: () => { LIST = defaultCatalog(); save(); }
  };
  if (A.data && typeof A.data.registerSource === 'function') {
    A.data.registerSource('market-catalog', {
      rows: MC.rows,
      get: MC.get,
      priceConfig: MC.priceConfig,
      codeTaken: MC.codeTaken,
      effectiveMarkets: MC.effectiveMarkets,
      reload: MC.reload,
      nextCode: MC.nextCode,
      add: MC.add,
      update: MC.update,
      normalizeLifecycle: MC.normalizeLifecycle,
      completeLayoutSetup: MC.completeLayoutSetup,
      RANKS: MC.RANKS,
      STATUS: MC.STATUS,
      PRICE_CONFIGS: MC.PRICE_CONFIGS
    });
  }

  // Market lookup helpers (from js/core.js, Phase 15.5) — tra trên danh sách hiệu lực.
  U.market = id => A.effectiveMarkets().find(m => m.id === id);
  U.mShort = id => U.market(id).short;
})(window.APP);

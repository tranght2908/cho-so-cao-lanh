/* Lõi prototype: trạng thái, tiện ích, định tuyến, modal, biểu đồ. */
window.APP = (function () {
  'use strict';
  const D = window.DATA;
  const KEY = 'choso-caolanh-state', UIKEY = 'choso-caolanh-ui', GUIDEKEY = 'choso-caolanh-guide';
  // RBAC V1 — version của schema role/account/ui (permissions.js, accounts.js, choso-caolanh-ui
  // đều đọc hằng số này). Tăng số này khi seed role/account/ui đổi cấu trúc không tương thích
  // ngược, để dữ liệu localStorage cũ tự bị bỏ qua và reseed lại an toàn.
  // v1 → v2 (Phase 2 — Market Scope): ui.market trước đây có thể là 'ALL' hợp lệ; từ Phase 2 nó
  // luôn phải là 'CL'/'TTD' cụ thể. Bump version để mọi state cũ (kể cả market:'ALL' đã lưu từ
  // Phase 1) bị bỏ qua hoàn toàn thay vì cố vá — A.syncAccountContext() ở A.load() sẽ tự chọn lại
  // market hợp lệ theo đúng account đang dùng.
  // v3 → v4 (RBAC_MARKET_SCOPE_MIGRATION): role master 8 → 6 (market_staff/accountant loại bỏ) +
  // market master 2 → 12 chợ (D.MARKETS, data.js). Bump để: (1) js/permissions.js reseed roles/
  // rolePerms SẠCH theo 6 role mới (bỏ qua nhánh merge — không còn account/permission nào giữ
  // market_staff/accountant "dưới tên khác"); (2) js/accounts.js reseed account demo SẠCH theo 12
  // chợ + 6 role (accounts cũ scoped role đã nghỉ hưu không "tự nâng quyền" thành role khác — bị bỏ
  // hẳn, seed lại an toàn từ defaultAccounts()); (3) UI state cũ (currentDemoAccountId trỏ tới 1
  // account không còn tồn tại) tự rơi về fallback an toàn của A.currentAccount()/A.syncAccountContext()
  // — không tự chọn account quyền cao hơn. Không có mapping account cũ nào chắc chắn 1:1 (tên/SĐT độc
  // lập với role thật) nên KHÔNG cố "vá" state cũ — reseed sạch là fallback an toàn nhất (mục 25 yêu
  // cầu: "fallback an toàn; không tự nâng quyền; không tự chuyển account thành Admin"). Xem
  // RBAC_MARKET_SCOPE_MIGRATION_REPORT.md.
  const RBAC_SCHEMA = 4; // 4: role master 6 role + market master 12 chợ
  const A = {
    D, db: null, idx: null, current: null, RBAC_SCHEMA,
    VIEWS: {}, ACT: {}, IN: {}, CH: {},
    ui: {
      // currentDemoAccountId là nguồn xác thực duy nhất cho phiên demo — role hiệu lực (ui.role)
      // luôn được suy ra từ account này (A.syncAccountContext()), không còn set trực tiếp qua UI.
      currentDemoAccountId: null, role: null,
      // MARKET_SELECTOR_ALL_UNIFICATION: market (selectedMarket) là 1 chợ cụ thể HOẶC 'ALL' — 'ALL'
      // chỉ hợp lệ khi account đang dùng có scopeType GLOBAL (system_admin/ward_leader — xem
      // A.ACCOUNTS.scopeType()). A.syncAccountContext() đảm bảo bất biến này ngay sau khi có account
      // (xem A.load()); giá trị khởi tạo dưới đây chỉ là placeholder trước khi có account, không bao
      // giờ được dùng để hiển thị/filter thật. Trước đây có 1 biến ui.xmScope RIÊNG cho bộ lọc nội bộ
      // của các màn CROSS (Tổng quan/Báo cáo) — đã BỎ, hợp nhất về đúng 1 state (ui.market) và đúng 1
      // selector (dropdown "Chợ" trên thanh top, xem chrome()) để tránh 2 điều khiển cho cùng 1 khái
      // niệm "đang xem chợ nào" (yêu cầu "không tạo selector thứ hai").
      market: 'ALL', planMarket: 'CL', floor: { CL: 'T1', TTD: 'KHU' }, hidden: {}, sel: null, planSearch: '',
      page: {}, f: {}, contractTab: 'all', period: '2026-09', report: 'lapday', readingsFilter: 'all', incCat: '',
      dsTab: null, dsBankFilter: 'all', dsBankSearch: '', dsFrom: null, dsTo: null,
      mini: { traderId: null, step: 'login', tab: 'home', pay: null, lastPays: null, attach: false, bill: null }
    }
  };
  const ui = A.ui;
  const $ = s => document.querySelector(s);
  A.$ = $;

  // ---------- tiện ích ----------
  const U = A.U = {};
  U.pad = (n, l) => String(n).padStart(l || 2, '0');
  U.esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  U.money = n => Math.round(n || 0).toLocaleString('vi-VN') + ' đ';
  U.moneyShort = n => {
    n = n || 0;
    if (Math.abs(n) >= 1e9) return (n / 1e9).toLocaleString('vi-VN', { maximumFractionDigits: 2 }) + ' tỷ';
    if (Math.abs(n) >= 1e6) return (n / 1e6).toLocaleString('vi-VN', { maximumFractionDigits: 1 }) + ' tr';
    if (Math.abs(n) >= 1e3) return Math.round(n / 1e3).toLocaleString('vi-VN') + 'k';
    return String(Math.round(n));
  };
  U.pct = (a, b) => b ? Math.round(a * 1000 / b) / 10 : 0;
  U.pctTxt = v => (v || 0).toLocaleString('vi-VN', { maximumFractionDigits: 1 }) + '%';
  U.dmy = s => s ? s.slice(8, 10) + '/' + s.slice(5, 7) + '/' + s.slice(0, 4) : '';
  U.per = p => p.slice(5) + '/' + p.slice(0, 4);
  U.days = (a, b) => Math.round((Date.parse(b) - Date.parse(a)) / 86400000);
  U.sum = (arr, f) => arr.reduce((a, x) => a + (f ? f(x) : x), 0);
  U.maskPhone = p => p ? p.slice(0, 3) + '****' + p.slice(-3) : '';
  U.maskId = s => s ? s.slice(0, 3) + '******' + s.slice(-3) : '';
  // Bộ icon SVG inline dùng chung: không phụ thuộc emoji/font của thiết bị. `title` chỉ dùng khi icon
  // đứng một mình; icon đi kèm text là decorative để screen reader không đọc lặp lại.
  const ICON_PATHS = {
    dashboard: '<path d="M4 13h6V4H4v9Zm0 7h6v-4H4v4Zm10 0h6v-9h-6v9Zm0-16v4h6V4h-6Z"/>',
    vehicle: '<path d="M3 16v-3l2-5h14l2 5v3M5 16v3m14-3v3M3 13h18M7 16h.01M17 16h.01"/>',
    map: '<path d="m9 18-6 3V6l6-3 6 3 6-3v15l-6 3-6-3Zm0-12v12m6-9v12"/>',
    store: '<path d="M3 10h18M5 10v10h14V10M4 4h16l1 6H3l1-6Zm5 10h6"/>', users: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2m17-7a4 4 0 1 0 0-8m-7 5a4 4 0 1 0 0-8"/>',
    file: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6Zm0 0v6h6M8 13h8m-8 4h8"/>', money: '<path d="M12 2v20m5-16.5A4 4 0 0 0 13.5 4h-3A3.5 3.5 0 0 0 10.5 11h3a3.5 3.5 0 1 1 0 7h-3A4 4 0 0 1 7 16.5"/>', bank: '<path d="m3 10 9-6 9 6M5 10v8m4-8v8m6-8v8m4-8v8M3 21h18"/>', bolt: '<path d="m13 2-9 12h7l-1 8 9-12h-7l1-8Z"/>', receipt: '<path d="M4 2v20l2-1.5L8 22l2-1.5 2 1.5 2-1.5 2 1.5 2-1.5 2 1.5V2H4Zm4 5h8m-8 4h8m-8 4h5"/>', card: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 10h18m-14 5h3"/>', refresh: '<path d="M20 11a8 8 0 1 0 2 5.3M20 4v7h-7"/>', bell: '<path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9m-8 13h4"/>', chart: '<path d="M3 3v18h18M7 16l4-5 3 3 5-7"/>', settings: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1-2.1 2.1-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.5v.2h-3v-.2a1.7 1.7 0 0 0-1-1.5 1.7 1.7 0 0 0-1.9.3l-.1.1L6.6 17l.1-.1A1.7 1.7 0 0 0 7 15a1.7 1.7 0 0 0-1.5-1H5v-3h.5A1.7 1.7 0 0 0 7 10a1.7 1.7 0 0 0-.3-1.9l-.1-.1 2.1-2.1.1.1a1.7 1.7 0 0 0 1.9.3 1.7 1.7 0 0 0 1-1.5V4h3v.8a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.9-.3l.1-.1L19.8 8l-.1.1a1.7 1.7 0 0 0-.3 1.9 1.7 1.7 0 0 0 1.5 1h.1v3h-.1a1.7 1.7 0 0 0-1.5 1Z"/>', phone: '<rect x="6" y="2" width="12" height="20" rx="2"/><path d="M10 18h4"/>', camera: '<path d="M4 7h3l2-3h6l2 3h3v13H4V7Zm8 9a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z"/>', print: '<path d="M6 9V3h12v6M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2m-2-4H8v7h8v-7Z"/>', edit: '<path d="m4 20 4.5-1 10-10a2.1 2.1 0 0 0-3-3l-10 10L4 20Zm10-13 3 3"/>', trash: '<path d="M4 7h16m-10 4v6m4-6v6M9 7V4h6v3m-9 0 1 14h10l1-14"/>', close: '<path d="m6 6 12 12M18 6 6 18"/>', menu: '<path d="M4 6h16M4 12h16M4 18h16"/>', check: '<path d="m5 12 4 4L19 6"/>', warning: '<path d="m12 3 10 18H2L12 3Zm0 6v4m0 4h.01"/>', attachment: '<path d="m21 11-8.5 8.5a5 5 0 0 1-7-7L14 4a3.5 3.5 0 0 1 5 5l-8.5 8.5a2 2 0 0 1-3-3L15 7"/>'
  };
  U.icon = (name, title) => `<svg class="ui-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"${title ? ` role="img" aria-label="${U.esc(title)}"` : ' aria-hidden="true"'}>${ICON_PATHS[name] || ICON_PATHS.file}</svg>`;
  U.market = id => D.MARKETS.find(m => m.id === id);
  U.mShort = id => U.market(id).short;
  // MARKET_SELECTOR_ALL_UNIFICATION: ui.market có thể là 'ALL' (account GLOBAL). U.inM chỉ dùng ở
  // các màn 'BOTH'/'CL'/'TTD' (theo A.SCREEN_MARKET) — renderer của các màn đó KHÔNG BAO GIỜ chạy
  // khi ui.market === 'ALL' (A.render() chặn trước, xem A.marketRequiredHtml()), nên so sánh trực
  // tiếp ở đây luôn an toàn (không cần nhánh 'ALL' riêng).
  U.inM = x => x.market === ui.market;
  // Dùng riêng cho các màn cross-market (Tổng quan liên chợ, Báo cáo) — nhận thẳng 1 market cụ
  // thể HOẶC 'ALL' làm tham số, KHÔNG đọc ui.market toàn cục. 'ALL' ở đây là "Tất cả" của bộ lọc
  // NỘI BỘ màn đó (xem A.xmMarket()), không phải selectedMarket.
  U.inScope = (x, m) => m === 'ALL' || x.market === m;
  U.staffName = id => { const s = D.STAFF.find(x => x.id === id); return s ? s.name : (id || ''); };
  U.typeLabel = t => ({ kiot: 'Ki-ốt', nhalong: 'Trong nhà lồng', ngoai: 'Ngoài nhà lồng', phien: 'Quầy phiên' }[t]);
  // Physical-area taxonomy for Mặt bằng only; it is separate from `type` and `pointType`.
  U.areaTypeLabel = t => ({ covered: 'Có mái che', uncovered: 'Không mái che', self_produced: 'Tự sản tự tiêu', session: 'Theo phiên' }[t]);
  // Các mã loại diện tích dùng chung cho dropdown/filter của màn Mặt bằng.
  U.AREA_TYPE_CODES = ['covered', 'uncovered', 'self_produced', 'session'];
  // Đơn giá hiện hành của điểm KD lấy từ "Chính sách thu và biểu phí", không phải
  // đơn giá snapshot của hợp đồng. NEED_CONFIRMATION: quy tắc mapping biểu phí
  // theo khu vực/loại điểm cần được nghiệp vụ xác nhận khi có API/backend.
  U.appliedStallPrice = st => {
    if (!st) return null;
    const stallType = { kiot: 'Ki-ốt', nhalong: 'Trong nhà lồng chợ', ngoai: 'Tự sản tự tiêu', phien: 'Quầy theo phiên' }[st.type];
    if (!stallType) return null;
    const prices = A.SERVICE_CFG ? A.SERVICE_CFG.list('stallPrices') : ((D.RATE_POLICY_SEED || {}).stallPrices || []);
    const today = U.today ? U.today() : '';
    return prices.find(r => r.marketId === st.market && r.stallType === stallType && r.status === 'active'
      && (!r.effectiveFrom || r.effectiveFrom <= today) && (!r.effectiveTo || r.effectiveTo >= today)) || null;
  };
  U.unitLabel = st => {
    const price = U.appliedStallPrice(st);
    if (!price) return 'Chưa cấu hình';
    return U.money(price.amount) + '/' + String(price.unit || '').replace(/^đ\//, '');
  };
  U.rentalKind = st => st && st.type === 'phien' ? 'session' : 'fixed';
  U.rentalLabel = st => U.rentalKind(st) === 'session' ? 'Quầy thuê theo phiên / khách vãng lai' : 'Quầy thuê cố định tháng/quý';
  U.statusTag = s => `<span class="tag"><span class="dot" style="background:${D.STATUS[s].color}"></span>${D.STATUS[s].label}</span>`;
  U.today = () => A.db.today;
  U.nowTime = () => { const d = new Date(); return U.pad(d.getHours()) + ':' + U.pad(d.getMinutes()); };
  U.due = i => i.amount - i.paid;
  U.isOver = i => i.status !== 'paid' && i.due < U.today();
  U.overDays = i => Math.max(0, U.days(i.due, U.today()));
  U.invTag = i => i.status === 'paid' ? '<span class="tag ok">Đã thu</span>'
    : i.status === 'partial' ? '<span class="tag warn">Thu một phần</span>'
      : U.isOver(i) ? `<span class="tag danger">Quá hạn ${U.overDays(i)} ngày</span>` : '<span class="tag">Chưa đến hạn</span>';
  U.traderDebt = id => U.sum(A.db.invoices.filter(i => i.traderId === id && i.status !== 'paid'), U.due);
  U.traderOverdue = id => U.sum(A.db.invoices.filter(i => i.traderId === id && U.isOver(i)), U.due);
  // CAN_VIEW_SCREEN (RBAC_V1_SPEC.md mục 7) = account active AND screen permission AND market
  // scope/context hợp lệ AND screen applicable với selectedMarket. Không thay permission matrix —
  // chỉ thêm 2 điều kiện market vào đúng 1 điểm kiểm tra dùng chung cho mọi nơi (menu, router,
  // liên kết chéo screen), tránh rải hard-code if(screen===...)/if(market===...) ở từng view.
  U.can = r => {
    const it = A.menuItem(r), role = A.PERM.role(ui.role);
    const acc = A.currentAccount();
    if (!it || !role || !role.active || !acc || acc.status !== 'active') return false;
    const screenAllowed = r === 'mat-bang' && ui.market === 'CL'
      ? (A.PERM.canScreen(ui.role, 'mat-bang') || A.PERM.canScreen(ui.role, 'diem-kd'))
      : A.PERM.canScreen(ui.role, r);
    if (!screenAllowed) return false;
    return A.screenMarketOk(r, acc);
  };
  // Phase 4B — CAN_DO_ACTION: điểm kiểm tra DUY NHẤT để THỰC THI 1 action mutation (không chỉ hiển
  // thị nút). Dùng ở cả UI gate (build HTML) LẪN handler gate (ngay trước khi ghi dữ liệu) — cùng 1
  // hàm, không lặp lại điều kiện account/market rải rác ở từng file view.
  //   actionKey    : phần sau 'action:' trong CATALOG (vd. 'thu-tien.thu').
  //   targetMarket : market của bản ghi đang thao tác (vd. invoice.market, st.market, r.market...).
  //                  Bỏ qua (undefined/null) cho action không gắn với 1 chợ cụ thể (vd. tai-khoan.*,
  //                  cai-dat.*). Nếu có, PHẢI khớp đúng selectedMarket hiện tại (ui.market) — vì
  //                  ui.market luôn nằm trong A.allowedMarkets(account) theo bất biến của Phase 2
  //                  (A.syncAccountContext), so khớp với ui.market đã bao hàm luôn điều kiện
  //                  "targetMarket ∈ account.marketScopes" mà không cần kiểm tra lại 2 lần.
  A.canDo = function (actionKey, targetMarket) {
    const acc = A.currentAccount();
    if (!acc || acc.status !== 'active') return false;
    if (!A.PERM.canAction(ui.role, actionKey)) return false;
    if (targetMarket != null && targetMarket !== ui.market) return false;
    return true;
  };
  A.canDirectCollect = function (targetMarket) {
    return targetMarket === 'TTD' && ui.market === 'TTD' && U.can('thu-tien') && A.canDo('thu-tien.thu', targetMarket);
  };
  A.canCollectReceivable = function (targetMarket) {
    return (targetMarket === 'CL' || targetMarket === 'TTD')
      && U.can('thu-tien') && A.canDo('thu-tien.thu', targetMarket);
  };
  U.pager = (key, total, size) => {
    const pages = Math.max(1, Math.ceil(total / size));
    const p = Math.min(ui.page[key] || 0, pages - 1);
    ui.page[key] = p;
    return {
      start: p * size, end: p * size + size,
      html: `<div class="pager">${total ? (p * size + 1) + '–' + Math.min(total, p * size + size) + ' / ' + total : '0 dòng'}
        <button class="btn sm" data-act="page" data-k="${key}" data-d="-1" ${p === 0 ? 'disabled' : ''}>‹ Trước</button>
        <button class="btn sm" data-act="page" data-k="${key}" data-d="1" ${p >= pages - 1 ? 'disabled' : ''}>Sau ›</button></div>`
    };
  };
  U.table = (cols, rows, opts) => {
    opts = opts || {};
    return `<div class="tbl-wrap"><table class="tbl"><thead><tr>${cols.map(c => `<th class="${c.num ? 'num' : ''}">${c.t}</th>`).join('')}</tr></thead>
      <tbody>${rows.length ? rows.join('') : `<tr><td colspan="${cols.length}" class="empty">${opts.empty || 'Không có dữ liệu'}</td></tr>`}</tbody></table></div>`;
  };
  U.csv = (name, cols, rows) => {
    const csv = '﻿' + [cols].concat(rows).map(r => r.map(v => '"' + String(v == null ? '' : v).replace(/"/g, '""') + '"').join(',')).join('\r\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    a.download = name + '.csv';
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 1500);
    U.toast('Đã xuất tệp ' + name + '.csv (mở được bằng Excel)');
  };
  U.toast = msg => {
    const el = document.createElement('div');
    el.className = 'toast'; el.textContent = msg;
    $('#toasts').appendChild(el);
    setTimeout(() => el.remove(), 3600);
  };
  U.log = what => { const acc = A.currentAccount(); A.db.extraLog.unshift({ at: U.dmy(U.today()) + ' ' + U.nowTime(), who: acc ? acc.fullName : 'Không rõ', what }); };

  // Mã QR minh họa (không phải QR thật)
  U.qr = (text, size) => {
    let h = 2166136261;
    for (let i = 0; i < text.length; i++) { h ^= text.charCodeAt(i); h = Math.imul(h, 16777619); }
    const N = 25, cells = [];
    const rnd = () => { h ^= h << 13; h ^= h >>> 17; h ^= h << 5; return (h >>> 0) / 4294967296; };
    const finder = (x, y) => (x < 7 && y < 7) || (x >= N - 7 && y < 7) || (x < 7 && y >= N - 7);
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) if (!finder(x, y) && rnd() < 0.48) cells.push(`<rect x="${x}" y="${y}" width="1" height="1"/>`);
    const fp = (x, y) => `<rect x="${x}" y="${y}" width="7" height="7"/><rect x="${x + 1}" y="${y + 1}" width="5" height="5" fill="#fff"/><rect x="${x + 2}" y="${y + 2}" width="3" height="3"/>`;
    return `<svg viewBox="-2 -2 29 29" width="${size || 170}" height="${size || 170}" role="img" aria-label="Mã QR minh họa"><rect x="-2" y="-2" width="29" height="29" fill="#fff"/><g fill="#0d2e55">${cells.join('')}${fp(0, 0)}${fp(N - 7, 0)}${fp(0, N - 7)}</g><rect x="10" y="10" width="5" height="5" rx="1" fill="#0089df"/></svg>`;
  };

  // ---------- biểu đồ ----------
  const niceMax = v => { const p = Math.pow(10, Math.floor(Math.log10(v))); const n = v / p; return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10) * p; };
  U.bars = (labels, series, o) => {
    o = Object.assign({ h: 230, stacked: true, fmt: U.moneyShort, max: null }, o || {});
    const W = 660, H = o.h, L = 54, B = 28, Tp = 12, Rt = 8;
    const tot = labels.map((_, i) => o.stacked ? U.sum(series, s => s.values[i]) : Math.max.apply(null, series.map(s => s.values[i])));
    const max = o.max || niceMax(Math.max.apply(null, tot.concat([1])));
    const ph = H - Tp - B, bw = (W - L - Rt) / labels.length;
    let g = '';
    for (let k = 0; k <= 4; k++) {
      const y = Tp + ph * (1 - k / 4);
      g += `<line x1="${L}" x2="${W - Rt}" y1="${y}" y2="${y}" stroke="#e5eaf1"/><text x="${L - 6}" y="${y + 4}" text-anchor="end" font-size="11" fill="#6b7683">${o.fmt(max * k / 4)}</text>`;
    }
    labels.forEach((lb, i) => {
      const x0 = L + i * bw;
      if (o.stacked) {
        let acc = 0; const w = bw * 0.62, x = x0 + (bw - w) / 2;
        series.forEach(s => {
          const v = s.values[i], hh = ph * v / max, y = Tp + ph - ph * (acc + v) / max;
          g += `<rect x="${x}" y="${y}" width="${w}" height="${Math.max(0, hh)}" fill="${s.color}" rx="2"><title>${lb} · ${s.name}: ${o.fmt(v)}</title></rect>`;
          acc += v;
        });
      } else {
        const w = bw * 0.7 / series.length;
        series.forEach((s, j) => {
          const v = s.values[i], hh = ph * v / max;
          g += `<rect x="${x0 + bw * 0.15 + j * w}" y="${Tp + ph - hh}" width="${w - 2}" height="${Math.max(0, hh)}" fill="${s.color}" rx="2"><title>${lb} · ${s.name}: ${o.fmt(v)}</title></rect>`;
        });
      }
      g += `<text x="${x0 + bw / 2}" y="${H - 9}" text-anchor="middle" font-size="11" fill="#5c646f">${lb}</text>`;
    });
    return `<div class="chart"><svg viewBox="0 0 ${W} ${H}">${g}</svg><div class="chart-legend">${series.map(s => `<span><i style="background:${s.color}"></i>${s.name}</span>`).join('')}</div></div>`;
  };
  U.donut = (parts, center) => {
    const total = U.sum(parts, p => p.value) || 1;
    let off = 25, arcs = '';
    parts.forEach(p => {
      const len = p.value * 100 / total;
      arcs += `<circle r="15.9155" cx="21" cy="21" fill="none" stroke="${p.color}" stroke-width="6" stroke-dasharray="${len} ${100 - len}" stroke-dashoffset="${off}"><title>${p.label}: ${p.value}</title></circle>`;
      off -= len;
    });
    return `<div class="donut-wrap"><svg viewBox="0 0 42 42">${arcs}<text x="21" y="21" text-anchor="middle" font-size="6.5" font-weight="700" fill="#0f1e32">${center ? center[0] : ''}</text><text x="21" y="27" text-anchor="middle" font-size="3.2" fill="#5c646f">${center ? center[1] : ''}</text></svg>
      <div class="donut-legend">${parts.map(p => `<div><span class="tag"><span class="dot" style="background:${p.color}"></span>${p.label}</span><b>${p.value}</b></div>`).join('')}</div></div>`;
  };

  // ---------- dữ liệu ----------
  A.reindex = function () {
    const db = A.db;
    A.idx = {
      stall: new Map(db.stalls.map(s => [s.id, s])),
      trader: new Map(db.traders.map(s => [s.id, s])),
      contract: new Map(db.contracts.map(s => [s.id, s])),
      invoice: new Map(db.invoices.map(s => [s.id, s]))
    };
  };
  A.refreshStall = function (st) {
    if (st.status !== 'thue' && st.status !== 'no') return;
    st.status = A.db.invoices.some(i => i.stallId === st.id && U.isOver(i)) ? 'no' : 'thue';
  };
  A.save = function () { try { localStorage.setItem(KEY, JSON.stringify(A.db)); } catch (e) { /* bỏ qua */ } };

  // ---------- RBAC V1 — Account Demo đang dùng ----------
  // Nguồn xác thực runtime: currentDemoAccountId → account → account.status → account.roleIds.
  // A.currentAccount() luôn trả về 1 account ACTIVE hợp lệ, tự "heal" nếu id đang lưu không tồn
  // tại hoặc trỏ tới account đã bị khoá (status !== 'active') — không bao giờ để phiên demo chạy
  // với 1 account rỗng/không hợp lệ.
  A.currentAccount = function () {
    let acc = ui.currentDemoAccountId ? A.ACCOUNTS.get(ui.currentDemoAccountId) : null;
    if (!acc || acc.status !== 'active') {
      acc = A.ACCOUNTS.list().find(a => a.status === 'active') || null;
      ui.currentDemoAccountId = acc ? acc.id : null;
    }
    return acc;
  };
  // Market Scope: Account.marketScopes là nguồn enforce chính (KHÔNG dùng Role.scope). 'ALL' trong
  // marketScopes (dữ liệu mock hợp lệ, xem accounts.js — dùng cho account GLOBAL: system_admin/
  // ward_leader) = "toàn hệ thống", giải nén thành ĐÚNG danh sách id hiện có trong D.MARKETS (market
  // master 12 chợ, data.js) ở đây — nơi DUY NHẤT hiểu 'ALL' theo nghĩa này. Nơi khác trong app
  // không được tự ý coi 'ALL' là 1 market cụ thể. RBAC_MARKET_SCOPE_MIGRATION: KHÔNG còn hard-code
  // ['CL','TTD'] — market hợp lệ tra theo D.MARKETS động, để account MARKET scoped tới bất kỳ chợ
  // nào trong 12 chợ đều được nhận diện đúng, không chỉ 2 chợ demo gốc.
  A.allowedMarkets = function (account) {
    const scopes = (account && account.marketScopes) || [];
    if (scopes.indexOf('ALL') !== -1) return D.MARKETS.map(m => m.id);
    const validIds = new Set(D.MARKETS.map(m => m.id));
    return scopes.filter(m => validIds.has(m));
  };
  // Market applicability theo RBAC_V1_SPEC.md mục 6 — nguồn cấu hình TẬP TRUNG duy nhất, tránh
  // rải if(screen===...)/if(market===...) ở từng view:
  //   'CROSS'  = màn liên chợ (Tổng quan, Danh mục chợ, Báo cáo) — không bị chặn bởi selectedMarket,
  //              đọc thẳng A.xmMarket() (= ui.market) làm phạm vi lọc nội bộ; selectedMarket='ALL'
  //              (account GLOBAL) là điều kiện bình thường ở đúng các màn này.
  //   'BOTH'   = MARKET VIEW áp dụng cho TẤT CẢ chợ trong phạm vi account (không giới hạn CL/TTD —
  //              đã mở rộng cho 12 chợ), theo đúng selectedMarket cụ thể hiện tại. Khi selectedMarket
  //              ='ALL' (account GLOBAL), màn vẫn "truy cập được" (menu/route không chặn — xem
  //              A.screenMarketOk()) nhưng A.render() hiện thông báo yêu cầu chọn 1 chợ cụ thể thay
  //              vì gọi renderer thật (A.marketRequiredHtml() — MARKET_SELECTOR_ALL_UNIFICATION).
  //   'CL'/'TTD' = chỉ áp dụng đúng 1 chợ cụ thể (nghiệp vụ đặc thù của riêng chợ đó trong prototype
  //              — Tài sản chợ mới demo cho Chợ Cao Lãnh, Phiên chợ quê là đặc thù Chợ quê Tân Thuận
  //              Đông — KHÔNG phải "giả định 2 chợ" cần tổng quát hoá, giữ nguyên). Cùng quy tắc
  //              'ALL' như 'BOTH' ở trên.
  //   'SYSTEM' = không gate theo market (Tài khoản, Cài đặt = hệ thống).
  A.SCREEN_MARKET = {
    'tong-quan': 'CROSS', 'bao-cao': 'CROSS', 'danh-muc-cho': 'CROSS',
    'mat-bang': 'BOTH', 'tai-san': 'CL', 'diem-kd': 'BOTH', 'tieu-thuong': 'BOTH', 'hop-dong': 'BOTH',
    'cau-hinh-gia': 'BOTH',
    'phai-thu': 'BOTH', 'thu-tien': 'BOTH', 'doi-soat': 'BOTH', 'cong-no': 'BOTH',
    'su-co': 'BOTH', 'thong-bao': 'BOTH',
    'phien-cho': 'TTD',
    'dien-nuoc': 'BOTH',
    'tai-khoan': 'SYSTEM', 'cai-dat': 'SYSTEM', 'mini-app': 'BOTH'
  };
  // screenId có hợp lệ với market scope của account + selectedMarket hiện tại không. Đây là điểm
  // kiểm tra DUY NHẤT cho cả 2 vế "accountHasRequiredMarketScope" và "screenApplicableToMarket"
  // của công thức CAN_VIEW_SCREEN (RBAC_V1_SPEC.md mục 7).
  // MARKET_SELECTOR_ALL_UNIFICATION: khi ui.market === 'ALL' (chỉ đạt được nếu account đang dùng có
  // scopeType GLOBAL — A.syncAccountContext() đảm bảo bất biến này), màn 'BOTH'/'CL'/'TTD' vẫn coi là
  // "truy cập được" (không biến mất khỏi menu, route không bị bật lại về màn khác) — nhưng renderer
  // thật của màn đó KHÔNG được gọi với ui.market='ALL' (xem A.render()/A.marketRequiredHtml()), tự
  // hiện thông báo "chọn 1 chợ cụ thể" thay vì render sai dữ liệu hoặc crash.
  A.screenMarketOk = function (screenId, account) {
    const kind = A.SCREEN_MARKET[screenId];
    if (!kind || kind === 'CROSS' || kind === 'SYSTEM') return true;
    if (ui.market === 'ALL') return true;
    if (A.allowedMarkets(account).indexOf(ui.market) === -1) return false; // ngoài phạm vi account
    if (kind === 'BOTH') return true;
    return kind === ui.market; // 'CL' hoặc 'TTD' cụ thể
  };
  // "Tất cả" của các màn cross-market (Tổng quan liên chợ, Báo cáo, Danh mục chợ) giờ ĐỌC THẲNG
  // selectedMarket (ui.market) — không còn ui.xmScope/A.xmScopeBar() riêng (đã bỏ, gộp về đúng 1
  // state/1 cơ chế, xem A.marketSelectOptionsHtml() bên dưới). A.syncAccountContext() đảm bảo
  // ui.market luôn hợp lệ (1 chợ cụ thể trong A.allowedMarkets(account), hoặc 'ALL' chỉ khi account
  // GLOBAL) trước khi bất kỳ renderer nào chạy, nên ở đây chỉ cần trả nguyên giá trị.
  A.xmMarket = function () { return ui.market; };
  // Sinh HTML <option> cho dropdown chọn chợ (value=ui.market hiện tại được đánh dấu selected) —
  // "Tất cả" (value='ALL') chỉ có khi account đang dùng scopeType GLOBAL. Dùng chung cho dropdown
  // "Chợ" trên topbar (mọi màn 'BOTH'/'CL'/'TTD') VÀ dropdown "Phạm vi xem" vẽ riêng trong nội dung
  // "Tổng quan liên chợ" (xem js/v-dieuhanh.js) — ĐÚNG 1 nguồn logic option, tránh viết lại 2 lần
  // rồi lệch nhau; cả 2 nơi cùng dùng data-ch="market-select" → A.CH['market-select'] → A.ACT.market
  // (cùng 1 state/1 handler, không phải 2 selector độc lập).
  A.marketSelectOptionsHtml = function () {
    const accNow = A.currentAccount();
    const isGlobal = A.ACCOUNTS.scopeType(accNow) === 'GLOBAL';
    const opts = (isGlobal ? [['ALL', 'Tất cả']] : []).concat(A.allowedMarkets(accNow).map(id => [id, U.mShort(id)]));
    return opts.map(o => `<option value="${o[0]}" ${ui.market === o[0] ? 'selected' : ''}>${U.esc(o[1])}</option>`).join('');
  };
  // ui.role KHÔNG còn được set trực tiếp qua hành động chọn role, và ui.market luôn phải là 1 chợ
  // hợp lệ trong A.allowedMarkets(account) HOẶC 'ALL' (chỉ khi account đang dùng có scopeType GLOBAL
  // — A.ACCOUNTS.scopeType()) — cả 2 luôn được suy ra/kẹp lại từ account đang dùng ở đây. Gọi mỗi khi
  // currentDemoAccountId đổi, và phòng thủ thêm ở đầu chrome()/A.route() để bắt cả trường hợp account
  // (hoặc marketScopes của nó) bị khoá/đổi giữa phiên.
  // MARKET_SELECTOR_ALL_UNIFICATION mục 8 test H: đổi từ account GLOBAL đang ở 'ALL' sang account
  // MARKET-scoped (Trưởng BQL/NV thu phí/NV kỹ thuật) phải tự kẹp ui.market về 1 chợ cụ thể — KHÔNG
  // được giữ 'ALL' trái phép. Ngược lại, nếu ui.market đã là 1 chợ cụ thể hợp lệ và account mới là
  // GLOBAL, GIỮ NGUYÊN chợ đang chọn (không tự nhảy sang 'ALL') — chỉ người dùng bấm dropdown mới đổi.
  A.syncAccountContext = function () {
    const acc = A.currentAccount();
    ui.role = acc ? A.ACCOUNTS.primaryRole(acc) : null;
    const allowed = A.allowedMarkets(acc);
    const isGlobal = acc && A.ACCOUNTS.scopeType(acc) === 'GLOBAL';
    if (ui.market === 'ALL') {
      if (!isGlobal) ui.market = allowed[0] || 'CL'; // clamp: ALL không hợp lệ với account MARKET-scoped
    } else if (allowed.length) {
      if (allowed.indexOf(ui.market) === -1) ui.market = isGlobal ? 'ALL' : allowed[0];
    } else if (!ui.market) ui.market = 'CL'; // phòng thủ tối đa, không kỳ vọng xảy ra với seed hiện tại
    return { role: ui.role, market: ui.market };
  };

  A.saveUi = function () { try { localStorage.setItem(UIKEY, JSON.stringify({ schemaVersion: RBAC_SCHEMA, currentDemoAccountId: ui.currentDemoAccountId, market: ui.market })); } catch (e) { /* bỏ qua */ } };
  A.fresh = function () {
    A.db = D.build();
    A.reindex();
    A.db.stalls.forEach(A.refreshStall);
  };
  // TRADER_PROFILE_AND_MINIAPP_WORKFLOW — demo case "hồ sơ đã có sẵn + Mini App ĐÃ LIÊN KẾT" (mục
  // 37 Case 1): account.traderId không thể seed cứng trong js/accounts.js (module đó chạy TRƯỚC
  // khi A.db tồn tại — data.js chỉ build() khi A.load()/A.fresh() được gọi ở init()) và tên 2
  // account demo cũ (AC-TT01/02) không khớp bất kỳ trader nào (dữ liệu trader sinh ngẫu nhiên có
  // seed riêng). Chạy ĐÚNG 1 lần, chỉ khi CHƯA account trader nào có traderId (idempotent — an toàn
  // gọi lại mỗi lần load): liên kết AC-TT01 với ĐÚNG trader đang thuê KA-A01 thật (deterministic vì
  // seed RNG trong data.js cố định) — đồng bộ luôn fullName/phone hiển thị của account demo cho
  // khớp, tránh gây hiểu lầm "AC-TT01 tên khác nhưng lại đại diện cho 1 trader tên khác".
  A.ensureMiniAppDemoLink = function () {
    if (!A.ACCOUNTS || !A.db) return;
    const hasAnyLink = A.ACCOUNTS.list().some(a => A.ACCOUNTS.primaryRole(a) === 'trader' && a.traderId);
    if (hasAnyLink) return;
    const acc = A.ACCOUNTS.get('AC-TT01');
    const kaA01 = A.db.stalls && A.db.stalls.find(s => s.id === 'CL-KA-A01');
    const trader = kaA01 && A.db.traders.find(t => t.id === kaA01.traderId);
    if (acc && trader && !acc.traderId) {
      A.ACCOUNTS.update(acc.id, { traderId: trader.id, fullName: trader.name, phone: trader.phone });
    }
  };
  A.load = function () {
    try {
      const s = localStorage.getItem(KEY);
      if (s) { const x = JSON.parse(s); if (x && x.version === D.VERSION) A.db = x; }
    } catch (e) { A.db = null; }
    if (A.db) A.reindex(); else A.fresh();
    // FE/localStorage migration: preserve existing records and legacy fields, adding only areaType.
    const areaTypeByLegacyType = { kiot: 'covered', nhalong: 'covered', ngoai: 'self_produced', phien: 'session' };
    const migratedAreaType = A.db.stalls.some(st => !st.areaType);
    if (migratedAreaType) {
      A.db.stalls.forEach(st => { if (!st.areaType) st.areaType = areaTypeByLegacyType[st.type] || 'covered'; });
      A.save();
    }
    A.ensureMiniAppDemoLink();
    // RBAC V1 migration: ui state cũ (schema khác, hoặc còn giữ shape {role, market} kiểu cũ
    // không có currentDemoAccountId) không tương thích — bỏ qua, để currentDemoAccountId=null rồi
    // A.currentAccount()/A.syncAccountContext() bên dưới tự chọn 1 account ACTIVE + 1 market hợp
    // lệ mặc định. Nhờ vậy không bao giờ còn sót ui.role='bql'/'lanhdao'/'tieuthuong' hay
    // ui.market='ALL' hay market không thuộc scope của account.
    try {
      const u = JSON.parse(localStorage.getItem(UIKEY) || 'null');
      if (u && u.schemaVersion === RBAC_SCHEMA && u.currentDemoAccountId) {
        ui.currentDemoAccountId = u.currentDemoAccountId;
        if (u.market) ui.market = u.market;
      }
    } catch (e) { /* bỏ qua */ }
    // syncAccountContext() kẹp ui.market vào đúng A.allowedMarkets(account) — xử lý luôn cả 3 case
    // của mục 12: market='ALL' (đã hết hạn), market không tồn tại, hoặc market hợp lệ nhưng không
    // thuộc scope account đang dùng (ví dụ localStorage ghi bởi 1 account khác trước đó).
    A.syncAccountContext();
  };

  // Ghi nhận thanh toán cho danh sách khoản phải thu (trả khoản cũ trước)
  A.applyPayment = function (invoiceIds, amount, method, by) {
    const db = A.db;
    let remain = amount;
    const out = [];
    const invs = invoiceIds.map(id => A.idx.invoice.get(id)).filter(Boolean).sort((a, b) => a.due.localeCompare(b.due));
    const time = U.nowTime();
    invs.forEach(inv => {
      if (remain <= 0) return;
      const take = Math.min(U.due(inv), remain);
      if (take <= 0) return;
      inv.paid += take;
      inv.status = inv.paid >= inv.amount ? 'paid' : 'partial';
      remain -= take;
      const n = db.payments.length + 1;
      const p = {
        id: 'GD' + U.pad(n, 6), invoiceId: inv.id, market: inv.market, traderId: inv.traderId, amount: take, method,
        date: db.today, time, by, receipt: 'BL2609-' + U.pad(n, 6),
        paymentStatus: 'SUCCESS', paidAt: db.today + ' ' + time, receiptIssuedAt: db.today + ' ' + time,
        lookup: Math.random().toString(36).slice(2, 8).toUpperCase(), reconciled: method === 'tm' ? null : true,
        receiptDelivery: { miniApp: true, sentAt: db.today + ' ' + time, status: 'SENT_MOCK' },
        printStatus: 'PENDING'
      };
      db.payments.push(p);
      out.push(p);
      if (method !== 'tm') {
        const bk = {
          id: 'SK' + U.pad(db.bank.length + 1, 4), date: db.today, time, amount: take, ref: 'CHOSO ' + inv.id,
          market: inv.market, bankName: (D.BANK_BY_MARKET && D.BANK_BY_MARKET[inv.market]) || 'Vietcombank',
          paymentId: p.id, receivableId: inv.id, receiptId: p.receipt,
          status: 'MATCHED_AUTO', matched: true, matchedBy: null, matchedAt: null, matchMethod: 'AUTO',
          log: [{ at: time, actor: 'Hệ thống', text: 'Nhận sao kê tương ứng thanh toán ' + p.id }, { at: time, actor: 'Hệ thống', text: 'Khớp tự động với khoản phải thu ' + inv.id }]
        };
        db.bank.push(bk);
      }
      A.refreshStall(A.idx.stall.get(inv.stallId));
    });
    A.save();
    return out;
  };

  // ---------- modal ----------
  A.modal = function (html, wide) {
    $('#modal-root').innerHTML = `<div class="overlay" data-act="overlay"><div class="modal ${wide ? 'wide' : ''}" role="dialog" aria-modal="true">${html}</div></div>`;
  };
  A.closeModal = function () { A.drawerReset(); $('#modal-root').innerHTML = ''; };
  A.mHead = t => `<div class="modal-h"><h3>${t}</h3><button class="x" data-act="close" aria-label="Đóng">×</button></div>`;

  // ---------- điều hướng drawer (back stack nhỏ, dùng chung) ----------
  // Cho phép nút "← Quay lại" hoạt động khi 1 drawer được mở TỪ 1 drawer khác (vd Mặt bằng chợ →
  // Hồ sơ tiểu thương/Điểm kinh doanh) — KHÔNG phải router mới, KHÔNG hard-code từng cặp biến kiểu
  // backToTGA04/backToKAA01. Chỉ 1 stack {label, render} dùng chung cho mọi drawer trong app:
  //   label  : nhãn hiển thị trên nút "← Quay lại <label>" — LẤY ĐỘNG từ chính điểm/đối tượng
  //            nguồn (vd mã điểm 'TG-A04'), không hard-code theo tên màn hình.
  //   render : hàm KHÔNG tham số (tự đóng gói qua closure) chỉ để VẼ LẠI đúng drawer nguồn — hàm
  //            này KHÔNG được tự push/reset stack, để các cấp back xa hơn (nếu có) không bị sai.
  let drawerStack = [];
  // Gọi TRƯỚC khi vẽ 1 drawer CON (drill-down từ drawer đang mở).
  A.drawerPush = function (label, render) { drawerStack.push({ label, render }); };
  // Gọi khi mở 1 drawer ĐỘC LẬP (không phải drill-down từ drawer khác, vd mở trực tiếp từ 1 dòng
  // trong bảng danh sách) — đảm bảo không hiện "← Quay lại" giả khi drawer không có drawer cha.
  A.drawerReset = function () { drawerStack = []; };
  A.drawerBack = function () { const prev = drawerStack.pop(); if (prev) prev.render(); };
  // "← Quay lại <label>" — CHỈ trả về khi thực sự có drawer cha (stack không rỗng); rỗng thì không
  // render gì (không có back giả).
  A.drawerBackHtml = function () {
    if (!drawerStack.length) return '';
    const label = drawerStack[drawerStack.length - 1].label;
    return `<div class="drawer-back-row"><button class="btn sm" data-act="drawer-back">← Quay lại ${U.esc(label)}</button></div>`;
  };

  function receiptSessionPayment(p) {
    return p && p.sessionPaymentId && A.db.sessionPayments ? A.db.sessionPayments.find(x => x.id === p.sessionPaymentId) : null;
  }
  function receiptSessionRecord(p) {
    return p && A.db.sessionReceipts ? A.db.sessionReceipts.find(x => x.paymentId === p.id || x.receiptNumber === p.receipt) : null;
  }
  function receiptPaymentSuccessAt(p) {
    if (!p) return null;
    const sp = receiptSessionPayment(p);
    if (sp) {
      if (sp.status !== 'SUCCESS' && sp.status !== 'RECONCILED') return null;
      return sp.collectedAt || sp.paidAt || sp.reconciledAt || (p.date && p.time ? p.date + ' ' + p.time : null);
    }
    if (p.paymentStatus && p.paymentStatus !== 'SUCCESS') return null;
    return p.paidAt || (p.date && p.time ? p.date + ' ' + p.time : null);
  }
  function receiptIssuedAt(p) {
    if (!p) return null;
    const rc = receiptSessionRecord(p);
    return (rc && rc.issuedAt) || p.receiptIssuedAt || (p.date && p.time ? p.date + ' ' + p.time : null);
  }
  A.receiptBusinessStateOk = function (p) {
    const paidAt = receiptPaymentSuccessAt(p), issuedAt = receiptIssuedAt(p);
    return !!(p && p.receipt && paidAt && issuedAt && issuedAt >= paidAt);
  };
  A.receiptHtml = function (pays) {
    pays = (pays || []).filter(A.receiptBusinessStateOk);
    if (!pays.length) return '<div class="note danger">Bien lai khong hop le: chi phat hanh sau khi thanh toan thanh cong.</div>';
    const p0 = pays[0], t = A.idx.trader.get(p0.traderId), m = U.market(p0.market);
    const rows = pays.map(p => {
      const inv = A.idx.invoice.get(p.invoiceId);
      const s = p.sessionId && A.db.marketSessions ? A.db.marketSessions.find(x => x.id === p.sessionId) : null;
      const reg = p.registrationId && A.db.sessionRegistrations ? A.db.sessionRegistrations.find(x => x.id === p.registrationId) : null;
      const content = inv
        ? `Kỳ ${U.per(inv.period)} · ${A.idx.stall.get(inv.stallId).code}`
        : `Phiên chợ quê · ${s ? U.dmy(s.sessionDate) : U.esc(p.sessionId || '')}${reg ? ' · ' + U.esc(reg.code || reg.id) : ''}`;
      return `<tr><td>${p.receipt}</td><td>${content}</td><td class="num">${U.money(p.amount)}</td></tr>`;
    });
    return `<div class="receipt"><h4>BIÊN LAI THU TIỀN ĐIỆN TỬ</h4><div class="sub">Ban Quản lý ${m.name} · UBND phường Cao Lãnh</div>
      <div class="row" style="align-items:flex-start;gap:16px"><dl class="kv" style="flex:1">
        <dt>Người nộp</dt><dd>${U.esc(t.name)} (${t.id})</dd>
        <dt>Hình thức</dt><dd>${D.METHOD[p0.method]}</dd>
        <dt>Thời gian</dt><dd>${U.dmy(p0.date)} ${p0.time}</dd>
        <dt>Người thu</dt><dd>${U.esc(p0.by === 'Hệ thống' || p0.by === 'Mini app' ? p0.by + ' (tự động)' : U.staffName(p0.by))}</dd>
        <dt>Mã tra cứu</dt><dd><b>${p0.lookup}</b></dd>
        <dt>Gửi Mini app</dt><dd><span class="tag ok">Đã gửi</span></dd></dl>
        <div class="note info" style="max-width:220px">Biên lai dùng để rà soát dữ liệu, truy vết giao dịch và kiểm soát thu theo từng phương thức.</div></div>
      <div class="divider"></div>
      ${U.table([{ t: 'Số biên lai' }, { t: 'Nội dung' }, { t: 'Số tiền', num: true }], rows)}
      <div class="total" style="margin-top:10px">${U.money(U.sum(pays, p => p.amount))}</div>
      <div class="small muted" style="margin-top:8px">✓ Đã gửi biên lai tới tiểu thương qua Mini app và Zalo OA (mô phỏng)</div></div>`;
  };
  A.showReceipt = function (pays, opts) {
    pays = (pays || []).filter(A.receiptBusinessStateOk);
    if (!pays.length) { U.toast('Khong the lap/xem bien lai truoc khi thanh toan thanh cong'); return; }
    A.modal(A.mHead('Biên lai điện tử') + `<div class="modal-b">${A.receiptHtml(pays)}</div>
      <div class="modal-f"><button class="btn" data-act="print">In biên lai</button><button class="btn primary" data-act="close">Xong</button></div>`);
    if (opts && opts.autoPrint) {
      pays.forEach(p => { p.printStatus = 'PRINTED_MOCK'; });
      A.save();
      setTimeout(() => window.print(), 0);
    }
  };

  // ---------- menu & định tuyến ----------
  // Ghi chú: từ Giai đoạn 2, quyền truy cập từng mục KHÔNG còn khai báo cứng ở đây nữa —
  // xem A.PERM (js/permissions.js). Danh sách vai trò cũng lấy động từ A.PERM.activeRoles().
  A.MENU = [
    { group: 'Điều hành', items: [
      { id: 'tong-quan', ico: U.icon('dashboard'), label: 'Tổng quan liên chợ' },
      // "Danh mục chợ" = quản lý thông tin CẤP CHỢ (tên, mã, địa điểm, hạng, BQL, bảng giá, trạng
      // thái) — KHÁC "Mặt bằng chợ" bên dưới (cấu trúc Khu/Tầng/Dãy/Điểm kinh doanh BÊN TRONG 1 chợ,
      // GIỮ NGUYÊN không đổi). Xem js/marketcatalog.js + js/v-danhmuccho.js.
      { id: 'danh-muc-cho', ico: U.icon('store'), label: 'Danh mục chợ' },
      { sub: 'Hạ tầng chợ' },
      // Phase 7: UI "Thiết lập mặt bằng chợ" + "Sơ đồ mặt bằng" đã gộp thành 1 workspace "Mặt bằng
      // chợ" (MARKET_LAYOUT_UX_HOTFIX_REPORT.md) và nay RBAC cũng chuẩn hóa theo — 2 screen
      // permission cũ 'so-do'/'cau-truc' gộp thành DUY NHẤT 'mat-bang', route chính #/mat-bang.
      // Hash cũ #/so-do, #/cau-truc vẫn redirect an toàn về #/mat-bang (xem A.route()). Xem
      // MARKET_LAYOUT_SCREEN_PERMISSION_AUDIT.md + MARKET_LAYOUT_SCREEN_PERMISSION_IMPLEMENTATION_REPORT.md.
      { id: 'mat-bang', ico: U.icon('map'), label: 'Mặt bằng chợ' },
      { id: 'tai-san', ico: U.icon('settings'), label: 'Tài sản chợ' },
      { id: 'diem-kd', ico: U.icon('store'), label: 'Điểm kinh doanh', hidden: true },
      { id: 'phien-cho', ico: U.icon('store'), label: 'Phiên chợ quê' }
    ] },
    { group: 'Tiểu thương', items: [
      { id: 'tieu-thuong', ico: U.icon('users'), label: 'Hồ sơ tiểu thương' }
    ] },
    { group: 'Tài chính', items: [
      { sub: 'Quản lý khai báo' },
      { id: 'cau-hinh-gia', ico: U.icon('money'), label: 'Chính sách thu và biểu phí' },
      { id: 'tai-khoan-ngan-hang', ico: U.icon('bank'), label: 'Danh sách tài khoản ngân hàng' },
      { sub: 'Nghiệp vụ tài chính' },
      { id: 'dien-nuoc', ico: U.icon('bolt'), label: 'Chỉ số điện, nước' },
      { id: 'phai-thu', ico: U.icon('receipt'), label: 'Khoản phải thu' },
      { id: 'thu-tien', ico: U.icon('card'), label: 'Thu tiền & biên lai' },
      { id: 'doi-soat', ico: U.icon('refresh'), label: 'Đối soát', badge: () => A.db.bank.filter(b => !b.matched).length },
      { id: 'cong-no', ico: '⏰', label: 'Công nợ & nhắc nợ' }
    ] },
    { group: 'Vận hành', items: [
      { id: 'su-co', ico: U.icon('warning'), label: 'Phản ánh & sự cố', badge: () => A.db.incidents.filter(i => U.inM(i) && i.state === 'tiepnhan').length },
      { id: 'thong-bao', ico: U.icon('bell'), label: 'Thông báo đa kênh' },
      { id: 'bao-cao', ico: U.icon('chart'), label: 'Báo cáo thống kê' },
      { id: 'tai-khoan', ico: U.icon('users'), label: 'Tài khoản người dùng' },
      { id: 'cai-dat', ico: U.icon('settings'), label: 'Cài đặt & phân quyền' }
    ] },
    { group: 'Dành cho tiểu thương', items: [
      { id: 'mini-app', ico: U.icon('warning'), label: 'Gửi phản ánh' }
    ] }
  ];
  A.menuItem = id => { for (const g of A.MENU) for (const it of g.items) if (it.id === id) return it; return null; };

  // Nhãn rút gọn cho thanh "Tài khoản demo" (mục 14 yêu cầu — biết ngay account thuộc role nào mà
  // không làm thanh quá dài với tới 12 chợ × nhiều role). Role tuỳ biến/không có trong map vẫn hiển
  // thị đúng tên đầy đủ (fallback ở chrome() bên dưới), không crash nếu admin đổi tên 1 trong 6 role
  // gốc hoặc tạo role mới.
  const DEMO_ROLE_SHORT = {
    system_admin: 'QTHT', ward_leader: 'Lãnh đạo', market_manager: 'Trưởng BQL',
    collector: 'Thu phí', technician: 'Kỹ thuật', trader: 'Tiểu thương'
  };
  // DEMO_ACCOUNT_BAR_COMPACT_GROUPING (mục 4/5/6/10 yêu cầu): với 12 chợ, liệt kê phẳng mọi account
  // hợp lệ (bản cũ) làm thanh dài hàng chục nút khi selectedMarket='ALL'. Nhóm lại theo 2 tầng, vẫn
  // ĐÚNG 1 nguồn dữ liệu (A.ACCOUNTS.list()) và ĐÚNG 1 tiêu chí lọc (marketScopes qua
  // A.allowedMarkets(), KHÔNG hardcode theo tên/id):
  //   - "Tài khoản toàn hệ thống" (scopeType GLOBAL — system_admin/ward_leader): LUÔN hiện, mọi
  //     selectedMarket, để luôn có đường quay lại account GLOBAL (mục 6).
  //   - selectedMarket='ALL': CHỈ hiện nhóm GLOBAL ở trên + 1 dòng gợi ý — KHÔNG bung account của cả
  //     12 chợ (mục 4).
  //   - selectedMarket=1 chợ cụ thể: thêm các nhóm MARKET-scoped account CÓ chợ đó trong marketScopes,
  //     xếp theo role (mục 5) — account KHÔNG thuộc chợ đang chọn không xuất hiện.
  const DEMO_MARKET_ROLE_ORDER = ['market_manager', 'collector', 'technician', 'trader'];
  function demoAccountBtnHtml(a, withRolePrefix) {
    const roleTxt = withRolePrefix ? (DEMO_ROLE_SHORT[A.ACCOUNTS.primaryRole(a)] || (A.PERM.role(A.ACCOUNTS.primaryRole(a)) || {}).name || '') : '';
    return `<button class="${ui.currentDemoAccountId === a.id ? 'on' : ''}" data-act="demo-account" data-id="${a.id}">${roleTxt ? U.esc(roleTxt) + ' — ' : ''}${U.esc(a.fullName)}</button>`;
  }
  function demoAccountBarHtml() {
    const active = A.ACCOUNTS.list().filter(a => a.status === 'active');
    const globals = active.filter(a => A.ACCOUNTS.scopeType(a) === 'GLOBAL');
    const globalGroup = globals.length ? `<span class="label-sm">Tài khoản toàn hệ thống</span><span class="seg">${globals.map(a => demoAccountBtnHtml(a, true)).join('')}</span>` : '';
    if (ui.market === 'ALL') {
      return globalGroup + '<span class="small muted">Chọn một chợ cụ thể để xem tài khoản demo thuộc chợ đó.</span>';
    }
    const marketAccounts = active.filter(a => A.ACCOUNTS.scopeType(a) !== 'GLOBAL' && A.allowedMarkets(a).indexOf(ui.market) !== -1);
    const roleGroups = DEMO_MARKET_ROLE_ORDER.map(rid => {
      const list = marketAccounts.filter(a => A.ACCOUNTS.primaryRole(a) === rid);
      if (!list.length) return '';
      const r = A.PERM.role(rid);
      return `<span class="label-sm">${U.esc(DEMO_ROLE_SHORT[rid] || (r ? r.name : rid))}</span><span class="seg">${list.map(a => demoAccountBtnHtml(a, false)).join('')}</span>`;
    }).join('');
    // Phòng thủ: account MARKET với role tuỳ biến (admin thêm role thứ 7+ ngoài 4 role gốc ở trên,
    // xem js/permissions.js) vẫn phải hiện, không âm thầm biến mất khỏi thanh demo.
    const known = new Set(DEMO_MARKET_ROLE_ORDER);
    const others = marketAccounts.filter(a => !known.has(A.ACCOUNTS.primaryRole(a)));
    const otherGroup = others.length ? `<span class="label-sm">Khác</span><span class="seg">${others.map(a => demoAccountBtnHtml(a, true)).join('')}</span>` : '';
    return globalGroup + roleGroups + otherGroup;
  }

  function chrome() {
    // Phòng thủ: nếu account đang dùng vừa bị khoá/xoá giữa phiên, hoặc marketScopes của nó
    // không còn chứa selectedMarket đang lưu, tự "heal" role + market về đúng account trước khi
    // render menu/route — mỗi lần render đều chạy qua đây.
    A.syncAccountContext();
    $('#nav').innerHTML = A.MENU.map(g => {
      // "sub" là nhãn phụ nhóm menu con (không phải màn hình), chỉ để hiển thị — không qua U.can.
      // `hidden` (không còn mục nào dùng sau Phase 7 — trước đó 'cau-truc' từng đánh dấu hidden để
      // gộp UI với 'so-do', nay cả 2 đã hợp nhất thành đúng 1 entry 'mat-bang'): vẫn giữ lại cơ chế
      // lọc này (loại khỏi DANH SÁCH LINK hiển thị nhưng KHÔNG ảnh hưởng U.can()/A.menuItem()/route
      // trực tiếp qua hash) phòng khi cần dùng lại cho 1 màn khác sau này.
      const raw = g.items.filter(it => it.sub || (U.can(it.id) && !it.hidden));
      const items = raw.filter((it, i) => !it.sub || raw.slice(i + 1).some(x => !x.sub));
      if (!items.some(it => !it.sub)) return '';
      return `<div class="nav-group">${g.group}</div>` + items.map(it => {
        if (it.sub) return `<div class="nav-subgroup">${it.sub}</div>`;
        const b = it.badge ? it.badge() : 0;
        const label = it.id === 'mat-bang' && ui.market === 'CL' ? 'Mặt bằng & điểm kinh doanh' : it.label;
        return `<a href="#/${it.id}" class="${A.current === it.id ? 'active' : ''}"><span class="ico">${it.ico}</span>${label}${b ? `<span class="badge">${b}</span>` : ''}</a>`;
      }).join('');
    }).join('');
    // RBAC_MARKET_SCOPE_MIGRATION mục 11-14 + DEMO_ACCOUNT_BAR_COMPACT_GROUPING: thanh "Tài khoản
    // demo" lọc theo ui.market (selectedMarket) và nhóm theo scope/role — xem demoAccountBarHtml().
    $('#role-seg').innerHTML = demoAccountBarHtml();
    const activeRole = A.PERM.role(ui.role);
    const roleLabelEl = $('#active-role-label');
    if (roleLabelEl) roleLabelEl.textContent = activeRole ? ('Vai trò: ' + activeRole.name) : '';
    // MARKET_SELECTOR_ALL_UNIFICATION: market selector dropdown — CÓ lựa chọn "Tất cả" (value='ALL')
    // khi account đang dùng có scopeType GLOBAL (A.ACCOUNTS.scopeType() — system_admin/ward_leader).
    // Với account MARKET, dropdown chỉ liệt kê ĐÚNG (các) chợ trong marketScopes của account đó,
    // KHÔNG có "Tất cả" — account không thể tự đổi sang chợ/phạm vi ngoài scope vì lựa chọn đó không
    // tồn tại trong dropdown. A.marketSelectHtml() sinh ra ĐÚNG 1 lần logic option này, dùng chung
    // cho cả dropdown "Chợ" trên topbar LẪN dropdown "Phạm vi xem" trong Tổng quan liên chợ (xem
    // js/v-dieuhanh.js) — cả 2 chỗ cùng đọc/ghi ui.market qua data-ch="market-select"/A.ACT.market,
    // không phải 2 state/2 cơ chế khác nhau, chỉ là 2 vị trí hiển thị của ĐÚNG 1 selector.
    $('#market-seg').innerHTML = `<select class="input" style="min-width:200px" data-ch="market-select">${A.marketSelectOptionsHtml()}</select>`;
    // TONG_QUAN_MARKET_DROPDOWN_DEDUP: "Tổng quan liên chợ" tự vẽ dropdown "Phạm vi xem" riêng ngay
    // trong nội dung dashboard (cùng control, xem trên) — ẩn bản trên topbar CHỈ cho đúng màn này để
    // khỏi có 2 dropdown chọn chợ cùng lúc trên 1 màn. Các màn khác (kể cả 'mini-app', đã ẩn từ
    // trước) không đổi.
    $('#market-wrap').style.display = (A.current === 'mini-app' || A.current === 'tong-quan') ? 'none' : '';
    const it = A.menuItem(A.current);
    const pageLabel = it && it.id === 'mat-bang' && ui.market === 'CL' ? 'Mặt bằng & điểm kinh doanh' : (it ? it.label : '');
    $('#page-title').textContent = pageLabel;
    document.title = (pageLabel ? pageLabel + ' · ' : '') + 'Chợ số Cao Lãnh – Prototype';
  }

  // MARKET_SELECTOR_ALL_UNIFICATION mục 5: màn 'BOTH'/'CL'/'TTD' bắt buộc cần 1 chợ cụ thể để render
  // đúng (Mặt bằng, Tài sản chợ, Tiểu thương, Hợp đồng, Thu tiền, Đối soát, Công nợ, Phản ánh...) —
  // khi ui.market === 'ALL', KHÔNG được silently fallback về Chợ Cao Lãnh và KHÔNG được gọi renderer
  // thật của màn đó (nhiều renderer tra cứu U.market(ui.market)/U.inM trực tiếp, sẽ sai dữ liệu hoặc
  // crash nếu chạy với 'ALL') — hiện thông báo yêu cầu chọn 1 chợ cụ thể thay thế.
  A.marketRequiredHtml = function (screenId) {
    const msg = screenId === 'mat-bang'
      ? 'Vui lòng chọn một chợ cụ thể để xem và quản lý mặt bằng.'
      : (() => { const it = A.menuItem(screenId); const lbl = it ? it.label : 'nội dung màn này'; return `Vui lòng chọn một chợ cụ thể để xem ${lbl.charAt(0).toLowerCase() + lbl.slice(1)}.`; })();
    return `<div class="empty">${U.esc(msg)}</div>`;
  };
  A.render = function (scroll) {
    const ae = document.activeElement;
    const focusKey = ae && ae.dataset && ae.dataset.in ? ae.dataset.in : null;
    const caret = focusKey ? ae.selectionStart : null;
    chrome();
    // A.current chỉ có thể là null khi router (bên dưới) không tìm được bất kỳ screen nào mà
    // account hiện tại có quyền — không được render A.VIEWS[...] trong trường hợp đó dù hàm view
    // có tồn tại hay không (NO SCREEN PERMISSION = NO SCREEN RENDER).
    const view = A.current ? A.VIEWS[A.current] : null;
    const kind = A.current ? A.SCREEN_MARKET[A.current] : null;
    const needsMarket = ui.market === 'ALL' && (kind === 'BOTH' || kind === 'CL' || kind === 'TTD');
    $('#view').innerHTML = A.current
      ? (needsMarket ? A.marketRequiredHtml(A.current) : (view ? view() : '<div class="empty">Đang xây dựng</div>'))
      : '<div class="empty">Tài khoản hiện chưa được cấp quyền truy cập chức năng.</div>';
    if (focusKey) {
      const el = document.querySelector(`[data-in="${focusKey}"]`);
      if (el) { el.focus(); try { el.setSelectionRange(caret, caret); } catch (e) { /* bỏ qua */ } }
    }
    if (scroll) window.scrollTo(0, 0);
  };
  // Screen đầu tiên (theo đúng thứ tự A.MENU) mà account/role hiện tại có screen permission —
  // dùng làm đích fallback thay cho hard-code 'tong-quan' (vốn không tồn tại với 5 role đang
  // trống quyền ở Phase 1). Trả về null nếu role không có bất kỳ screen permission nào.
  A.firstAccessibleScreen = function () {
    for (const g of A.MENU) for (const it of g.items) if (!it.sub && U.can(it.id)) return it.id;
    return null;
  };
  A.route = function () {
    // Đồng bộ role + selectedMarket từ account đang dùng TRƯỚC khi đánh giá quyền — đảm bảo
    // U.can() bên dưới luôn dựa trên context mới nhất, kể cả khi route() được gọi ngay sau khi
    // đổi account/market mà chưa qua chrome() lần nào.
    A.syncAccountContext();
    let r = (location.hash || '').replace(/^#\/?/, '');
    // Hợp đồng không còn là màn nghiệp vụ độc lập. Giữ route/view cũ và các
    // permission liên quan cho tương thích dữ liệu/phụ thuộc nội bộ, nhưng mọi
    // truy cập hash cũ đều quay về Hồ sơ tiểu thương.
    if (r === 'hop-dong') r = 'tieu-thuong';
    // Phase 7 — tương thích ngược 2 hash cũ trước khi chuẩn hóa screen permission (so-do/cau-truc
    // → mat-bang, xem MARKET_LAYOUT_SCREEN_PERMISSION_IMPLEMENTATION_REPORT.md): đổi thẳng sang
    // 'mat-bang' NGAY TẠI ĐÂY, trước khi đánh giá U.can(r) — không cần nhánh xử lý riêng, logic
    // fallback U.can(r)/A.firstAccessibleScreen() ngay dưới đây tự áp dụng y hệt mọi route khác
    // (account không có quyền 'mat-bang' thì tự rơi về fallback, không trắng trang/không loop).
    // MAT_BANG_KHU_TANG_DAY_REDESIGN: "Sơ đồ mặt bằng"/"Danh sách điểm" không còn 2 tab riêng — cả
    // 2 route vẫn dẫn vào ĐÚNG 1 workspace (ui.mb.view chọn Sơ đồ/Bảng, xem js/v-cautruc.js), chỉ
    // khác giá trị mặc định khi mới vào theo đúng ý nghĩa route cũ (#/mat-bang → Sơ đồ, #/diem-kd →
    // Bảng) — GIỮ NGUYÊN route, không tự ý đổi.
    if (ui.market === 'CL' && r === 'mat-bang') {
      if (ui.mb) ui.mb.view = 'grid';
    } else if (ui.market === 'CL' && (r === 'diem-kd' || r === 'so-do' || r === 'cau-truc')) {
      if (ui.mb) ui.mb.view = r === 'diem-kd' ? 'table' : 'grid';
      r = 'mat-bang';
    } else if (r === 'so-do' || r === 'cau-truc') r = 'mat-bang';
    // NO SCREEN PERMISSION = NO SCREEN RENDER: route yêu cầu (từ hash, kể cả gõ thẳng URL) chỉ
    // được nhận nếu U.can(r) đúng — U.can() đã bao gồm cả permission LẪN market applicability
    // (Phase 2), nên 1 route trước đó hợp lệ (vd. phien-cho khi đang TTD) sẽ tự động bị chặn nếu
    // selectedMarket đổi sang market không applicable, không cần xử lý riêng cho từng screen.
    // Không còn fallback hard-code 'tong-quan' — dò screen đầu tiên account thực sự có quyền VÀ
    // applicable với market hiện tại; nếu không còn screen nào, A.current = null và A.render() sẽ
    // hiện trạng thái "chưa được cấp quyền" thay vì render bất kỳ view nào.
    if (!r || !U.can(r)) {
      const role = A.PERM.role(ui.role);
      r = (role && role.selfService && U.can('mini-app')) ? 'mini-app' : A.firstAccessibleScreen();
    }
    const changed = A.current !== r;
    A.current = r;
    // Phase 2 hotfix: nếu route thật sự hiển thị (r) khác với screen đang ghi trên hash (do vừa
    // fallback — vd. đổi market khiến screen cũ hết applicable), đồng bộ lại hash cho khớp NGAY
    // TẠI ĐÂY bằng history.replaceState — KHÔNG dùng location.hash=... vì thao tác đó tự bắn thêm
    // 1 sự kiện 'hashchange' gọi lại A.route(), có nguy cơ tạo vòng lặp. replaceState chỉ sửa
    // thanh địa chỉ, không bắn hashchange/popstate nên không thể tự gọi lại A.route(). Nếu r là
    // null (không còn screen nào truy cập được) thì KHÔNG đụng vào hash — giữ nguyên trạng thái
    // empty/access hiện tại, không tự bịa 1 fallback screen trái quyền.
    if (r) {
      const wanted = '#/' + r;
      if (location.hash !== wanted) {
        try { history.replaceState(null, '', wanted); } catch (e) { /* bỏ qua */ }
      }
    }
    $('#sidebar').classList.remove('open');
    A.render(changed);
  };
  A.go = r => { if (location.hash === '#/' + r) A.route(); else location.hash = '#/' + r; };

  // ---------- hành động chung ----------
  Object.assign(A.ACT, {
    overlay: (el, e) => { if (e.target === el) A.closeModal(); },
    close: () => A.closeModal(),
    print: () => window.print(),
    menu: () => $('#sidebar').classList.toggle('open'),
    'demo-account': el => {
      // RBAC V1: đổi Account Demo đang dùng — role hiệu lực VÀ selectedMarket đều được suy ra lại
      // từ account mới (mục 4 yêu cầu Phase 2: giữ nguyên selectedMarket nếu vẫn thuộc
      // allowedMarkets của account mới, ngược lại tự chuyển sang allowedMarkets[0] —
      // syncAccountContext() làm đúng việc này). Đích 'tong-quan' bên dưới chỉ là gợi ý điều
      // hướng — A.go()/A.route() luôn re-validate qua U.can() (đã gồm cả market) và tự sửa về
      // đúng screen (hoặc trạng thái "chưa có quyền") nếu không hợp lệ với account mới.
      const acc = A.ACCOUNTS.get(el.dataset.id);
      if (!acc || acc.status !== 'active') return;
      if (A.resetMiniRequestState) A.resetMiniRequestState();
      ui.currentDemoAccountId = acc.id;
      A.syncAccountContext();
      A.saveUi();
      const role = A.PERM.role(ui.role);
      if (U.can('mini-app') && ((role && role.selfService) || A.canDirectCollect(ui.market))) A.go('mini-app');
      else if (!U.can(A.current) || A.current === 'mini-app') A.go('tong-quan'); else A.route();
    },
    // Đổi selectedMarket toàn cục: chấp nhận market nằm trong allowedMarkets của account đang dùng,
    // HOẶC 'ALL' nếu account có scopeType GLOBAL (MARKET_SELECTOR_ALL_UNIFICATION — phòng thủ, UI vốn
    // chỉ render đúng các lựa chọn này). Luôn đi qua A.route() thay vì A.render() để route hiện tại
    // được re-validate ngay (vd. đang ở "Phiên chợ quê" mà đổi sang Chợ Cao Lãnh phải tự chuyển màn
    // khác, không được tiếp tục hiện phien-cho cũ — mục 6).
    market: el => {
      const id = el.dataset.id;
      const acc = A.currentAccount();
      if (id === 'ALL') { if (A.ACCOUNTS.scopeType(acc) !== 'GLOBAL') return; }
      else if (A.allowedMarkets(acc).indexOf(id) === -1) return;
      ui.market = id; ui.page = {}; ui.sel = null; A.saveUi(); A.route();
    },
    page: el => { ui.page[el.dataset.k] = (ui.page[el.dataset.k] || 0) + Number(el.dataset.d); A.render(); },
    go: el => A.go(el.dataset.to),
    receipt: el => A.showReceipt(A.db.payments.filter(p => p.receipt === el.dataset.id && U.inM(p) && A.receiptBusinessStateOk(p))),
    guide: () => A.guide(),
    'drawer-back': () => A.drawerBack()
  });
  // Cầu nối cho dropdown thay hàng nút .seg cũ (RBAC_MARKET_SCOPE_MIGRATION mục 8) — tái dùng
  // NGUYÊN VẸN logic A.ACT.market đã có (không tạo helper thứ 2), chỉ đổi nguồn đọc giá trị từ
  // el.dataset.id (nút bấm) sang el.value (select).
  Object.assign(A.CH, {
    'market-select': el => A.ACT.market({ dataset: { id: el.value } })
  });

  A.guide = function () {
    A.modal(A.mHead('Hướng dẫn xem prototype') + `<div class="modal-b">
      <p class="muted" style="margin-top:0">Prototype mô phỏng <b>Hệ thống quản lý chợ số</b> cho phạm vi 12 chợ (Chợ Cao Lãnh và Chợ quê Cù lao Tân Thuận Đông có đầy đủ dữ liệu nghiệp vụ demo; 10 chợ còn lại mới có trong danh mục, chưa khảo sát hạ tầng). Đổi <b>Tài khoản demo</b> và <b>Chợ</b> ở thanh trên cùng.</p>
      <ol class="script">
        <li><div><b>Lãnh đạo phường → Tổng quan liên chợ:</b> số liệu tổng hợp, so sánh giữa các chợ, cảnh báo cần xử lý.</div></li>
        <li><div><b>Ban Quản lý chợ quê TTĐ → Thu tiền & biên lai:</b> ghi nhận thu tiền mặt trực tiếp, hệ thống phát hành biên lai, tự mở lệnh in và gửi biên lai qua Mini app.</div></li>
        <li><div><b>Tiểu thương → Mini app:</b> đăng nhập bằng OTP, thanh toán khoản phải nộp, gửi phản ánh kèm ảnh.</div></li>
        <li><div>Quay lại <b>Ban Quản lý chợ → Phản ánh & sự cố:</b> phản ánh vừa gửi đã nằm ở cột "Tiếp nhận" để phân công xử lý.</div></li>
        <li><div><b>Báo cáo thống kê:</b> hơn 10 báo cáo, xuất Excel (CSV) hoặc in PDF.</div></li>
      </ol>
      <div class="note" style="margin-top:14px">Toàn bộ tên, số tiền, số sạp là dữ liệu mẫu minh họa. Thao tác trong lúc xem được lưu trên trình duyệt; vào <b>Cài đặt → Đặt lại dữ liệu mẫu</b> để quay về ban đầu.</div>
      </div><div class="modal-f"><button class="btn primary" data-act="close">Bắt đầu xem</button></div>`);
  };

  function init() {
    A.load();
    document.addEventListener('click', e => {
      const el = e.target.closest('[data-act]');
      if (!el) return;
      const fn = A.ACT[el.dataset.act];
      if (fn) fn(el, e);
    });
    document.addEventListener('input', e => { const el = e.target.closest('[data-in]'); if (el && A.IN[el.dataset.in]) A.IN[el.dataset.in](el); });
    document.addEventListener('change', e => { const el = e.target.closest('[data-ch]'); if (el && A.CH[el.dataset.ch]) A.CH[el.dataset.ch](el); });
    document.addEventListener('keydown', e => { if (e.key === 'Escape') A.closeModal(); });
    window.addEventListener('hashchange', A.route);
    A.route();
    let seen = false;
    try { seen = !!localStorage.getItem(GUIDEKEY); localStorage.setItem(GUIDEKEY, '1'); } catch (e) { /* bỏ qua */ }
    if (!seen) A.guide();
  }
  A.resetAll = function () {
    try { localStorage.removeItem(KEY); } catch (e) { /* bỏ qua */ }
    A.fresh(); ui.sel = null; ui.page = {};
    ui.mini = { traderId: null, step: 'login', tab: 'home', pay: null, lastPays: null, attach: false, bill: null };
  };
  document.addEventListener('DOMContentLoaded', init);
  return A;
})();

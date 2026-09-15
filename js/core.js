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
  const RBAC_SCHEMA = 2;
  const A = {
    D, db: null, idx: null, current: null, RBAC_SCHEMA,
    VIEWS: {}, ACT: {}, IN: {}, CH: {},
    ui: {
      // currentDemoAccountId là nguồn xác thực duy nhất cho phiên demo — role hiệu lực (ui.role)
      // luôn được suy ra từ account này (A.syncAccountContext()), không còn set trực tiếp qua UI.
      currentDemoAccountId: null, role: null,
      // market (selectedMarket) luôn là 'CL'/'TTD' cụ thể sau khi A.syncAccountContext() chạy lần
      // đầu (xem A.load()) — giá trị khởi tạo 'ALL' dưới đây chỉ là placeholder trước khi có
      // account, không bao giờ được dùng để hiển thị/filter thật.
      market: 'ALL', xmScope: 'ALL', planMarket: 'CL', floor: { CL: 'T1', TTD: 'KHU' }, hidden: {}, sel: null, planSearch: '',
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
  U.market = id => D.MARKETS.find(m => m.id === id);
  U.mShort = id => U.market(id).short;
  // Phase 2: selectedMarket (ui.market) không còn có thể là 'ALL' — luôn là 'CL'/'TTD' cụ thể
  // (A.syncAccountContext() đảm bảo điều này). Vì vậy U.inM chỉ còn so sánh trực tiếp.
  U.inM = x => x.market === ui.market;
  // Dùng riêng cho các màn cross-market (Tổng quan liên chợ, Báo cáo) — nhận thẳng 1 market cụ
  // thể HOẶC 'ALL' làm tham số, KHÔNG đọc ui.market toàn cục. 'ALL' ở đây là "Tất cả" của bộ lọc
  // NỘI BỘ màn đó (xem A.xmMarket()), không phải selectedMarket.
  U.inScope = (x, m) => m === 'ALL' || x.market === m;
  U.staffName = id => { const s = D.STAFF.find(x => x.id === id); return s ? s.name : (id || ''); };
  U.typeLabel = t => ({ kiot: 'Ki-ốt', nhalong: 'Trong nhà lồng', ngoai: 'Ngoài nhà lồng', phien: 'Quầy phiên' }[t]);
  U.unitLabel = st => st.type === 'phien' ? U.money(D.SESSION_FEE) + '/quầy/phiên' : U.money(D.UNIT[st.type]) + '/m²/ngày';
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
    if (!A.PERM.canScreen(ui.role, r)) return false;
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
    return `<svg viewBox="-2 -2 29 29" width="${size || 170}" height="${size || 170}" role="img" aria-label="Mã QR minh họa"><rect x="-2" y="-2" width="29" height="29" fill="#fff"/><g fill="#10362e">${cells.join('')}${fp(0, 0)}${fp(N - 7, 0)}${fp(0, N - 7)}</g><rect x="10" y="10" width="5" height="5" rx="1" fill="#c93d6e"/></svg>`;
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
      g += `<line x1="${L}" x2="${W - Rt}" y1="${y}" y2="${y}" stroke="#e6ecea"/><text x="${L - 6}" y="${y + 4}" text-anchor="end" font-size="11" fill="#7a8883">${o.fmt(max * k / 4)}</text>`;
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
      g += `<text x="${x0 + bw / 2}" y="${H - 9}" text-anchor="middle" font-size="11" fill="#5f6e69">${lb}</text>`;
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
    return `<div class="donut-wrap"><svg viewBox="0 0 42 42">${arcs}<text x="21" y="21" text-anchor="middle" font-size="6.5" font-weight="700" fill="#1b2a26">${center ? center[0] : ''}</text><text x="21" y="27" text-anchor="middle" font-size="3.2" fill="#66756f">${center ? center[1] : ''}</text></svg>
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
  // Phase 2 — Market Scope: Account.marketScopes là nguồn enforce chính (KHÔNG dùng Role.scope).
  // 'ALL' trong marketScopes (dữ liệu mock hợp lệ, xem accounts.js) = "toàn hệ thống", giải nén
  // thành 2 market cụ thể ở đây — nơi DUY NHẤT hiểu 'ALL' theo nghĩa này. Nơi khác trong app
  // không được tự ý coi 'ALL' là 1 market cụ thể.
  A.allowedMarkets = function (account) {
    const scopes = (account && account.marketScopes) || [];
    if (scopes.indexOf('ALL') !== -1) return ['CL', 'TTD'];
    return scopes.filter(m => m === 'CL' || m === 'TTD');
  };
  // Market applicability theo RBAC_V1_SPEC.md mục 6 — nguồn cấu hình TẬP TRUNG duy nhất, tránh
  // rải if(screen===...)/if(market===...) ở từng view:
  //   'CROSS'  = màn liên chợ (Tổng quan, Báo cáo) — không bị chặn bởi selectedMarket, có bộ lọc
  //              nội bộ riêng (xem A.xmMarket()/A.xmScopeBar()).
  //   'BOTH'   = áp dụng cho cả CL và TTD, theo đúng selectedMarket hiện tại.
  //   'CL'/'TTD' = chỉ áp dụng đúng 1 chợ trong prototype V1 hiện tại.
  //   'SYSTEM' = không gate theo market (Tài khoản, Cài đặt = hệ thống; Mini app = theo tự phục
  //              vụ/trader context riêng, không theo selectedMarket).
  A.SCREEN_MARKET = {
    'tong-quan': 'CROSS', 'bao-cao': 'CROSS',
    'mat-bang': 'BOTH', 'diem-kd': 'BOTH', 'tieu-thuong': 'BOTH', 'hop-dong': 'BOTH',
    'cau-hinh-gia': 'BOTH',
    'phai-thu': 'BOTH', 'thu-tien': 'BOTH', 'doi-soat': 'BOTH', 'cong-no': 'BOTH',
    'su-co': 'BOTH', 'thong-bao': 'BOTH',
    'phien-cho': 'TTD',
    'dien-nuoc': 'CL',
    'tai-khoan': 'SYSTEM', 'cai-dat': 'SYSTEM', 'mini-app': 'SYSTEM'
  };
  // screenId có hợp lệ với market scope của account + selectedMarket hiện tại không. Đây là điểm
  // kiểm tra DUY NHẤT cho cả 2 vế "accountHasRequiredMarketScope" và "screenApplicableToMarket"
  // của công thức CAN_VIEW_SCREEN (RBAC_V1_SPEC.md mục 7).
  A.screenMarketOk = function (screenId, account) {
    const kind = A.SCREEN_MARKET[screenId];
    if (!kind || kind === 'CROSS' || kind === 'SYSTEM') return true;
    if (A.allowedMarkets(account).indexOf(ui.market) === -1) return false; // ngoài phạm vi account
    if (kind === 'BOTH') return true;
    return kind === ui.market; // 'CL' hoặc 'TTD' cụ thể
  };
  // "Tất cả" của bộ lọc NỘI BỘ cho các màn cross-market — gộp các chợ trong PHẠM VI ACCOUNT hiện
  // tại (A.allowedMarkets), KHÔNG phải gộp toàn hệ thống vô điều kiện, và hoàn toàn tách biệt với
  // selectedMarket toàn cục (ui.market luôn CL/TTD cụ thể, không bao giờ là 'ALL').
  A.xmMarket = function () {
    const allowed = A.allowedMarkets(A.currentAccount());
    if (allowed.length <= 1) return allowed[0] || ui.market;
    return (ui.xmScope && allowed.indexOf(ui.xmScope) !== -1) ? ui.xmScope : 'ALL';
  };
  const MARKET_LABELS = { CL: 'Chợ Cao Lãnh', TTD: 'Chợ quê TTĐ' };
  // Thanh chọn "Tất cả / CL / TTD" nội bộ dùng chung cho Tổng quan liên chợ + Báo cáo thống kê.
  // Không hiện gì nếu account chỉ có 1 market trong scope (không có gì để chọn).
  A.xmScopeBar = function () {
    const allowed = A.allowedMarkets(A.currentAccount());
    if (allowed.length <= 1) return '';
    const cur = A.xmMarket();
    const opts = [['ALL', 'Tất cả']].concat(allowed.map(id => [id, MARKET_LABELS[id]]));
    return `<div class="seg">${opts.map(o => `<button class="${cur === o[0] ? 'on' : ''}" data-act="xm-scope" data-id="${o[0]}">${o[1]}</button>`).join('')}</div>`;
  };
  // ui.role KHÔNG còn được set trực tiếp qua hành động chọn role, và ui.market luôn phải nằm
  // trong A.allowedMarkets(account) — cả 2 luôn được suy ra/kẹp lại từ account đang dùng ở đây.
  // Gọi mỗi khi currentDemoAccountId đổi, và phòng thủ thêm ở đầu chrome()/A.route() để bắt cả
  // trường hợp account (hoặc marketScopes của nó) bị khoá/đổi giữa phiên.
  A.syncAccountContext = function () {
    const acc = A.currentAccount();
    ui.role = acc ? A.ACCOUNTS.primaryRole(acc) : null;
    const allowed = A.allowedMarkets(acc);
    if (allowed.length) { if (allowed.indexOf(ui.market) === -1) ui.market = allowed[0]; }
    else if (!ui.market) ui.market = 'CL'; // phòng thủ tối đa, không kỳ vọng xảy ra với seed hiện tại
    return { role: ui.role, market: ui.market };
  };

  A.saveUi = function () { try { localStorage.setItem(UIKEY, JSON.stringify({ schemaVersion: RBAC_SCHEMA, currentDemoAccountId: ui.currentDemoAccountId, market: ui.market })); } catch (e) { /* bỏ qua */ } };
  A.fresh = function () {
    A.db = D.build();
    A.reindex();
    A.db.stalls.forEach(A.refreshStall);
  };
  A.load = function () {
    try {
      const s = localStorage.getItem(KEY);
      if (s) { const x = JSON.parse(s); if (x && x.version === D.VERSION) A.db = x; }
    } catch (e) { A.db = null; }
    if (A.db) A.reindex(); else A.fresh();
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
        lookup: Math.random().toString(36).slice(2, 8).toUpperCase(), reconciled: method === 'tm' ? null : true
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
  A.closeModal = function () { $('#modal-root').innerHTML = ''; };
  A.mHead = t => `<div class="modal-h"><h3>${t}</h3><button class="x" data-act="close" aria-label="Đóng">×</button></div>`;

  A.receiptHtml = function (pays) {
    const p0 = pays[0], t = A.idx.trader.get(p0.traderId), m = U.market(p0.market);
    const rows = pays.map(p => {
      const inv = A.idx.invoice.get(p.invoiceId);
      return `<tr><td>${p.receipt}</td><td>Kỳ ${U.per(inv.period)} · ${A.idx.stall.get(inv.stallId).code}</td><td class="num">${U.money(p.amount)}</td></tr>`;
    });
    return `<div class="receipt"><h4>BIÊN LAI THU TIỀN ĐIỆN TỬ</h4><div class="sub">Ban Quản lý ${m.name} · UBND phường Cao Lãnh</div>
      <div class="row" style="align-items:flex-start;gap:16px"><dl class="kv" style="flex:1">
        <dt>Người nộp</dt><dd>${U.esc(t.name)} (${t.id})</dd>
        <dt>Hình thức</dt><dd>${D.METHOD[p0.method]}</dd>
        <dt>Thời gian</dt><dd>${U.dmy(p0.date)} ${p0.time}</dd>
        <dt>Người thu</dt><dd>${U.esc(p0.by === 'Hệ thống' || p0.by === 'Mini app' ? p0.by + ' (tự động)' : U.staffName(p0.by))}</dd>
        <dt>Mã tra cứu</dt><dd><b>${p0.lookup}</b></dd></dl>
        <div style="text-align:center">${U.qr(p0.lookup, 92)}<div class="small muted">Quét để tra cứu</div></div></div>
      <div class="divider"></div>
      ${U.table([{ t: 'Số biên lai' }, { t: 'Nội dung' }, { t: 'Số tiền', num: true }], rows)}
      <div class="total" style="margin-top:10px">${U.money(U.sum(pays, p => p.amount))}</div>
      <div class="small muted" style="margin-top:8px">✓ Đã gửi biên lai tới tiểu thương qua Mini app và Zalo OA (mô phỏng)</div></div>`;
  };
  A.showReceipt = function (pays) {
    if (!pays || !pays.length) return;
    A.modal(A.mHead('Biên lai điện tử') + `<div class="modal-b">${A.receiptHtml(pays)}</div>
      <div class="modal-f"><button class="btn" data-act="print">In biên lai</button><button class="btn primary" data-act="close">Xong</button></div>`);
  };

  // ---------- menu & định tuyến ----------
  // Ghi chú: từ Giai đoạn 2, quyền truy cập từng mục KHÔNG còn khai báo cứng ở đây nữa —
  // xem A.PERM (js/permissions.js). Danh sách vai trò cũng lấy động từ A.PERM.activeRoles().
  A.MENU = [
    { group: 'Điều hành', items: [
      { id: 'tong-quan', ico: '📊', label: 'Tổng quan liên chợ' },
      { sub: 'Hạ tầng chợ' },
      // Phase 7: UI "Thiết lập mặt bằng chợ" + "Sơ đồ mặt bằng" đã gộp thành 1 workspace "Mặt bằng
      // chợ" (MARKET_LAYOUT_UX_HOTFIX_REPORT.md) và nay RBAC cũng chuẩn hóa theo — 2 screen
      // permission cũ 'so-do'/'cau-truc' gộp thành DUY NHẤT 'mat-bang', route chính #/mat-bang.
      // Hash cũ #/so-do, #/cau-truc vẫn redirect an toàn về #/mat-bang (xem A.route()). Xem
      // MARKET_LAYOUT_SCREEN_PERMISSION_AUDIT.md + MARKET_LAYOUT_SCREEN_PERMISSION_IMPLEMENTATION_REPORT.md.
      { id: 'mat-bang', ico: '🗺️', label: 'Mặt bằng chợ' },
      { id: 'diem-kd', ico: '🏪', label: 'Điểm kinh doanh' },
      { id: 'phien-cho', ico: '🪷', label: 'Phiên chợ quê' }
    ] },
    { group: 'Tiểu thương & hợp đồng', items: [
      { id: 'tieu-thuong', ico: '👥', label: 'Tiểu thương' },
      { id: 'hop-dong', ico: '📄', label: 'Hợp đồng', badge: () => A.db.contracts.filter(c => U.inM(c) && c.status === 'hieuluc' && U.days(U.today(), c.end) <= 30).length }
    ] },
    { group: 'Tài chính', items: [
      { id: 'cau-hinh-gia', ico: '💰', label: 'Cấu hình giá dịch vụ' },
      { id: 'dien-nuoc', ico: '⚡', label: 'Chỉ số điện, nước' },
      { id: 'phai-thu', ico: '🧾', label: 'Khoản phải thu' },
      { id: 'thu-tien', ico: '💳', label: 'Thu tiền & biên lai' },
      { id: 'doi-soat', ico: '🔁', label: 'Đối soát', badge: () => A.db.bank.filter(b => !b.matched).length },
      { id: 'cong-no', ico: '⏰', label: 'Công nợ & nhắc nợ' }
    ] },
    { group: 'Vận hành', items: [
      { id: 'su-co', ico: '🛠️', label: 'Phản ánh & sự cố', badge: () => A.db.incidents.filter(i => U.inM(i) && i.state === 'tiepnhan').length },
      { id: 'thong-bao', ico: '📣', label: 'Thông báo đa kênh' },
      { id: 'bao-cao', ico: '📈', label: 'Báo cáo thống kê' },
      { id: 'tai-khoan', ico: '🧑‍💼', label: 'Tài khoản người dùng' },
      { id: 'cai-dat', ico: '⚙️', label: 'Cài đặt & phân quyền' }
    ] },
    { group: 'Dành cho tiểu thương', items: [
      { id: 'mini-app', ico: '📱', label: 'Mini app tiểu thương' }
    ] }
  ];
  A.menuItem = id => { for (const g of A.MENU) for (const it of g.items) if (it.id === id) return it; return null; };

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
        return `<a href="#/${it.id}" class="${A.current === it.id ? 'active' : ''}"><span class="ico">${it.ico}</span>${it.label}${b ? `<span class="badge">${b}</span>` : ''}</a>`;
      }).join('');
    }).join('');
    // RBAC V1: topbar không còn cho chọn role trực tiếp — chọn Account Demo, role chỉ hiển thị.
    $('#role-seg').innerHTML = A.ACCOUNTS.list().filter(a => a.status === 'active')
      .map(a => `<button class="${ui.currentDemoAccountId === a.id ? 'on' : ''}" data-act="demo-account" data-id="${a.id}">${U.esc(a.fullName)}</button>`).join('');
    const activeRole = A.PERM.role(ui.role);
    const roleLabelEl = $('#active-role-label');
    if (roleLabelEl) roleLabelEl.textContent = activeRole ? ('Vai trò: ' + activeRole.name) : '';
    // RBAC V1 Phase 2: global market selector chỉ hiện market thuộc A.allowedMarkets(account
    // đang dùng), không còn 'ALL'. Nếu account chỉ có 1 market, selector chỉ còn 1 nút (đã luôn
    // "on" vì syncAccountContext() đảm bảo ui.market chính là market đó).
    $('#market-seg').innerHTML = A.allowedMarkets(A.currentAccount())
      .map(id => `<button class="${ui.market === id ? 'on' : ''}" data-act="market" data-id="${id}">${MARKET_LABELS[id]}</button>`).join('');
    $('#market-wrap').style.display = A.current === 'mini-app' ? 'none' : '';
    const it = A.menuItem(A.current);
    $('#page-title').textContent = it ? it.label : '';
    document.title = (it ? it.label + ' · ' : '') + 'Chợ số Cao Lãnh – Prototype';
  }

  A.render = function (scroll) {
    const ae = document.activeElement;
    const focusKey = ae && ae.dataset && ae.dataset.in ? ae.dataset.in : null;
    const caret = focusKey ? ae.selectionStart : null;
    chrome();
    // A.current chỉ có thể là null khi router (bên dưới) không tìm được bất kỳ screen nào mà
    // account hiện tại có quyền — không được render A.VIEWS[...] trong trường hợp đó dù hàm view
    // có tồn tại hay không (NO SCREEN PERMISSION = NO SCREEN RENDER).
    const view = A.current ? A.VIEWS[A.current] : null;
    $('#view').innerHTML = A.current
      ? (view ? view() : '<div class="empty">Đang xây dựng</div>')
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
    // Phase 7 — tương thích ngược 2 hash cũ trước khi chuẩn hóa screen permission (so-do/cau-truc
    // → mat-bang, xem MARKET_LAYOUT_SCREEN_PERMISSION_IMPLEMENTATION_REPORT.md): đổi thẳng sang
    // 'mat-bang' NGAY TẠI ĐÂY, trước khi đánh giá U.can(r) — không cần nhánh xử lý riêng, logic
    // fallback U.can(r)/A.firstAccessibleScreen() ngay dưới đây tự áp dụng y hệt mọi route khác
    // (account không có quyền 'mat-bang' thì tự rơi về fallback, không trắng trang/không loop).
    if (r === 'so-do' || r === 'cau-truc') r = 'mat-bang';
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
      ui.currentDemoAccountId = acc.id;
      A.syncAccountContext();
      A.saveUi();
      const role = A.PERM.role(ui.role);
      if (role && role.selfService) A.go('mini-app'); else if (!U.can(A.current) || A.current === 'mini-app') A.go('tong-quan'); else A.route();
    },
    // Đổi selectedMarket toàn cục: chỉ chấp nhận market nằm trong allowedMarkets của account đang
    // dùng (phòng thủ — UI vốn chỉ render đúng các nút này). Luôn đi qua A.route() thay vì
    // A.render() để route hiện tại được re-validate ngay (vd. đang ở "Phiên chợ quê" mà đổi sang
    // Chợ Cao Lãnh phải tự chuyển màn khác, không được tiếp tục hiện phien-cho cũ — mục 6).
    market: el => {
      const id = el.dataset.id;
      if (A.allowedMarkets(A.currentAccount()).indexOf(id) === -1) return;
      ui.market = id; ui.page = {}; ui.sel = null; A.saveUi(); A.route();
    },
    'xm-scope': el => { ui.xmScope = el.dataset.id; A.render(); },
    page: el => { ui.page[el.dataset.k] = (ui.page[el.dataset.k] || 0) + Number(el.dataset.d); A.render(); },
    go: el => A.go(el.dataset.to),
    receipt: el => A.showReceipt(A.db.payments.filter(p => p.receipt === el.dataset.id)),
    guide: () => A.guide()
  });

  A.guide = function () {
    A.modal(A.mHead('Hướng dẫn xem prototype') + `<div class="modal-b">
      <p class="muted" style="margin-top:0">Prototype mô phỏng <b>Hệ thống quản lý chợ số</b> cho 02 chợ: Chợ Cao Lãnh và Chợ quê Cù lao Tân Thuận Đông. Đổi <b>Vai trò</b> và <b>Chợ</b> ở thanh trên cùng.</p>
      <ol class="script">
        <li><div><b>Lãnh đạo phường → Tổng quan liên chợ:</b> số liệu tổng hợp, so sánh 02 chợ, cảnh báo cần xử lý.</div></li>
        <li><div><b>Ban Quản lý chợ → Sơ đồ mặt bằng:</b> bấm vào một ô màu đỏ (nợ phí) để xem tiểu thương, hợp đồng, công nợ → <b>Thu tiền</b> bằng mã QR → nhận biên lai điện tử.</div></li>
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

/* Lõi prototype: trạng thái, tiện ích, định tuyến, modal, biểu đồ. */
window.APP = (function () {
  'use strict';
  const D = window.DATA;
  const KEY = 'choso-caolanh-state', UIKEY = 'choso-caolanh-ui', GUIDEKEY = 'choso-caolanh-guide';
  const A = {
    D, db: null, idx: null, current: null,
    VIEWS: {}, ACT: {}, IN: {}, CH: {},
    ui: {
      role: 'bql', market: 'ALL', planMarket: 'CL', floor: { CL: 'T1', TTD: 'KHU' }, hidden: {}, sel: null, planSearch: '',
      page: {}, f: {}, contractTab: 'all', period: '2026-09', report: 'lapday', readingsFilter: 'all', incCat: '',
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
  U.inM = x => ui.market === 'ALL' || x.market === ui.market;
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
  U.can = r => {
    const it = A.menuItem(r), role = A.PERM.role(ui.role);
    return !!it && !!role && role.active && A.PERM.canScreen(ui.role, r);
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
  U.log = what => { A.db.extraLog.unshift({ at: U.dmy(U.today()) + ' ' + U.nowTime(), who: ui.role === 'lanhdao' ? 'Lãnh đạo UBND phường' : 'Trần Minh Khoa', what }); };

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
  A.saveUi = function () { try { localStorage.setItem(UIKEY, JSON.stringify({ role: ui.role, market: ui.market })); } catch (e) { /* bỏ qua */ } };
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
    try {
      const u = JSON.parse(localStorage.getItem(UIKEY) || 'null');
      if (u) { ui.role = u.role || ui.role; ui.market = u.market || ui.market; }
    } catch (e) { /* bỏ qua */ }
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
      if (method !== 'tm') db.bank.push({ id: 'SK' + U.pad(db.bank.length + 1, 4), time, amount: take, ref: 'CHOSO ' + inv.id, paymentId: p.id, matched: true });
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
      { id: 'cau-truc', ico: '🧱', label: 'Thiết lập mặt bằng chợ' },
      { id: 'so-do', ico: '🗺️', label: 'Sơ đồ mặt bằng' },
      { id: 'phien-cho', ico: '🪷', label: 'Phiên chợ quê' }
    ] },
    { group: 'Tiểu thương & hợp đồng', items: [
      { id: 'diem-kd', ico: '🏪', label: 'Điểm kinh doanh' },
      { id: 'tieu-thuong', ico: '👥', label: 'Tiểu thương' },
      { id: 'hop-dong', ico: '📄', label: 'Hợp đồng', badge: () => A.db.contracts.filter(c => U.inM(c) && c.status === 'hieuluc' && U.days(U.today(), c.end) <= 30).length }
    ] },
    { group: 'Tài chính', items: [
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
  const MKTS = [['ALL', 'Tất cả'], ['CL', 'Chợ Cao Lãnh'], ['TTD', 'Chợ quê TTĐ']];

  function chrome() {
    $('#nav').innerHTML = A.MENU.map(g => {
      const items = g.items.filter(it => U.can(it.id));
      if (!items.length) return '';
      return `<div class="nav-group">${g.group}</div>` + items.map(it => {
        const b = it.badge ? it.badge() : 0;
        return `<a href="#/${it.id}" class="${A.current === it.id ? 'active' : ''}"><span class="ico">${it.ico}</span>${it.label}${b ? `<span class="badge">${b}</span>` : ''}</a>`;
      }).join('');
    }).join('');
    $('#role-seg').innerHTML = A.PERM.activeRoles().map(r => `<button class="${ui.role === r.id ? 'on' : ''}" data-act="role" data-id="${r.id}">${U.esc(r.name)}</button>`).join('');
    $('#market-seg').innerHTML = MKTS.map(m => `<button class="${ui.market === m[0] ? 'on' : ''}" data-act="market" data-id="${m[0]}">${m[1]}</button>`).join('');
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
    const view = A.VIEWS[A.current];
    $('#view').innerHTML = view ? view() : '<div class="empty">Đang xây dựng</div>';
    if (focusKey) {
      const el = document.querySelector(`[data-in="${focusKey}"]`);
      if (el) { el.focus(); try { el.setSelectionRange(caret, caret); } catch (e) { /* bỏ qua */ } }
    }
    if (scroll) window.scrollTo(0, 0);
  };
  A.route = function () {
    let r = (location.hash || '').replace(/^#\/?/, '');
    const role = A.PERM.role(ui.role);
    const def = (role && role.selfService) ? 'mini-app' : 'tong-quan';
    if (!r || !U.can(r)) r = def;
    const changed = A.current !== r;
    A.current = r;
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
    role: el => {
      ui.role = el.dataset.id; A.saveUi();
      const role = A.PERM.role(ui.role);
      if (role && role.selfService) A.go('mini-app'); else if (!U.can(A.current) || A.current === 'mini-app') A.go('tong-quan'); else A.route();
    },
    market: el => { ui.market = el.dataset.id; ui.page = {}; ui.sel = null; A.saveUi(); A.render(); },
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

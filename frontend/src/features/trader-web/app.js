/* Cổng tiểu thương — web app riêng (frontend/tieu-thuong/index.html).
 * Giao diện dùng đúng thành phần của hệ thống quản lý (auth-shell, sidebar/topbar, page-head,
 * kpis, card, U.table, tag, modal) để hai phía nhìn thống nhất.
 * Dữ liệu: dùng chung A.db, A.ACCOUNTS và nghiệp vụ hiện có (A.applyPayment, A.addIncident,
 * A.showReceipt) nên thanh toán/phản ánh từ đây hiện ngay ở trang quản lý cùng trình duyệt.
 * Không tạo nguồn dữ liệu nghiệp vụ mới; chỉ lưu phiên đăng nhập của trang này vào sessionStorage.
 * Trang này thay A.route/A.render/A.guide của bootstrap bằng bộ định tuyến riêng (chỉ trên trang này). */
(function (A) {
  'use strict';
  if (!A) return;
  // `A.ui` is the shared UI context used by the canonical sidebar renderer
  // (`trader-portal/page.js`).  This web app owns authentication/session only;
  // it supplies the authenticated context to that existing shell.
  const D = A.D, U = A.U, $ = A.$, ui = A.ui;
  const SKEY = A.ACCOUNTS.TRADER_WEB_SESSION_KEY; // dùng chung với web quản lý (chuyển A07 sang đây)
  const SOURCE = 'Web app tiểu thương';
  const CATS = ['Điện', 'Cấp thoát nước', 'Vệ sinh', 'An ninh trật tự', 'PCCC', 'Hạ tầng', 'Khác'];

  // ---------- trạng thái giao diện của trang (không phải dữ liệu nghiệp vụ) ----------
  // accountId = tài khoản đăng nhập (A07); traderId = HỒ SƠ ĐANG XEM (activeTraderProfile) — thuộc Account.traderIds.
  const S = { traderId: null, accountId: null, step: 'phone', phone: '', loginAccountId: null, otpChallenge: null, otp: '', error: '',
    paySel: null, paying: false, openInv: null, contractSel: null, billFilter: 'all', noticeFilter: 'all', headerPopover: null, draftImages: [], sessionImages: {}, ratingDrafts: {}, lastPays: null, feeFilter: '', lookup: '', lookupResult: null };
  function loadSession() {
    try { const x = JSON.parse(sessionStorage.getItem(SKEY) || 'null'); if (x && x.accountId) { S.accountId = x.accountId; S.traderId = x.traderId || null; } } catch (e) { /* bỏ qua */ }
  }
  function saveSession() {
    try { if (S.accountId) sessionStorage.setItem(SKEY, JSON.stringify({ traderId: S.traderId, accountId: S.accountId })); else sessionStorage.removeItem(SKEY); } catch (e) { /* bỏ qua */ }
  }

  // ---------- danh tính & phạm vi ----------
  const normPhone = p => String(p || '').replace(/\D/g, '');
  const accounts = () => A.features.accounts.service;
  // Tài khoản trong phiên: phải là tài khoản Tiểu thương (A07) và đang hoạt động (đã kích hoạt qua OTP).
  // Trong web Tiểu thương, "tài khoản hiện tại" LUÔN là tài khoản A07 của phiên (không dùng tài khoản demo/đầu tiên).
  A.currentAccount = () => sessionAccount();
  function sessionAccount() {
    const acc = S.accountId ? A.ACCOUNTS.get(S.accountId) : null;
    return acc && A.ACCOUNTS.primaryRole(acc) === 'trader' && A.ACCOUNTS.authStatus(acc) === 'ACTIVE' ? acc : null;
  }
  // Hồ sơ được xem = hồ sơ liên kết với CHÍNH tài khoản (Account.traderIds) và còn hiệu lực. KHÔNG dùng marketScopes.
  const profileUsable = t => !!t && (!t.profileStatus || t.profileStatus === 'ACTIVE');
  function myProfiles(acc) { return acc ? A.ACCOUNTS.traderProfilesOf(acc).filter(profileUsable) : []; }
  // Tương thích các handler cũ: tài khoản của phiên nếu `t` là một hồ sơ của nó.
  function traderAccount(t) {
    const acc = sessionAccount();
    return acc && t && A.ACCOUNTS.traderIdsOf(acc).indexOf(t.id) !== -1 ? acc : null;
  }
  // Hồ sơ đang xem (activeTraderProfile): S.traderId nếu thuộc tài khoản; nếu không → hồ sơ mặc định. Không
  // có hồ sơ hợp lệ → null (màn "chưa liên kết"), không lấy hồ sơ người khác/hồ sơ mẫu.
  function me() {
    const acc = sessionAccount(), mine = myProfiles(acc);
    if (!acc || !mine.length) return null;
    let t = mine.find(x => x.id === S.traderId);
    if (!t) { const def = A.ACCOUNTS.defaultTraderProfile(acc); t = def && mine.indexOf(def) !== -1 ? def : mine[0]; S.traderId = t.id; saveSession(); }
    return t;
  }
  function logout(msg) {
    Object.assign(S, { traderId: null, accountId: null, step: 'phone', phone: '', loginAccountId: null, otpChallenge: null, otp: '', error: '', paySel: null, lastPays: null, headerPopover: null });
    saveSession();
    location.hash = '#/dang-nhap';
    render();
    if (msg) U.toast(msg);
  }
  // ---------- dữ liệu của tiểu thương (chỉ đọc, suy ra từ A.db) ----------
  const stallOf = id => A.idx.stall.get(id);
  const marketName = id => (U.market(id) || { name: id }).name;
  const myInvoices = t => A.db.invoices.filter(i => i.traderId === t.id);
  const unpaid = t => myInvoices(t).filter(i => i.status !== 'paid').sort((a, b) => a.due.localeCompare(b.due));
  const myPayments = t => A.db.payments.filter(p => p.traderId === t.id).sort((a, b) => (b.date + (b.time || '')).localeCompare(a.date + (a.time || '')));
  const myIncidents = t => A.db.incidents.filter(i => i.traderId === t.id).slice().reverse();
  const incState = id => (D.INCIDENT_STATES.find(s => s.id === id) || { label: id }).label;
  const incTag = i => `<span class="tag ${i.state === 'dong' || i.state === 'hoanthanh' ? 'ok' : 'info'}">${U.esc(incState(i.state))}</span>`;
  function notices(t) {
    const debt = U.traderOverdue(t.id) > 0, mk = U.market(t.market).short;
    return (A.db.notifications || []).filter(n => n.traderId === t.id || n.group === 'Toàn bộ tiểu thương' || n.group === mk || n.group === 'Ngành hàng: ' + t.cat || (debt && n.group === 'Danh sách nợ phí'))
      .slice().sort((a, b) => (b.at || '').localeCompare(a.at || ''));
  }
  const pointStatus = st => { const k = A.features.businessPoints.service.displayStatus(st); return `<span class="tag ${k === 'no' ? 'danger' : k === 'thue' ? 'ok' : ''}">${U.esc(D.STATUS[k] ? D.STATUS[k].label : k)}</span>`; };
  const MARK = '<svg viewBox="0 0 32 32" aria-hidden="true"><path d="M5 12l2-6h18l2 6z" fill="#0089df"/><path d="M5 12h22v3a3.5 3.5 0 0 1-7 0 3.5 3.5 0 0 1-7 0 3.5 3.5 0 0 1-7 0z" fill="#4fb3ff"/><path d="M7 17v10h18V17" fill="#0b4a9e"/><rect x="13" y="20" width="6" height="7" fill="#fff"/></svg>';

  // ==================== ĐĂNG NHẬP (dùng khung đăng nhập của hệ thống) ====================
  function authBrand(eyebrow, desc) {
    return `<section class="auth-brand"><div class="auth-mark">${MARK}</div>
      <div class="auth-eyebrow">${eyebrow}</div><div class="auth-title">Chợ số<br>phường Cao Lãnh</div><div class="auth-province">Tỉnh Đồng Tháp</div>
      <p class="auth-desc">${desc}</p></section>`;
  }
  function authFoot() {
    return `<div class="auth-support"><div class="auth-support-h"><span aria-hidden="true">?</span>Cần hỗ trợ?</div>
      <p>Chưa có tài khoản hoặc không đăng nhập được? Vui lòng liên hệ Ban Quản lý chợ nơi bạn đang kinh doanh.</p>
      <a class="btn link" href="#/tra-cuu">Tra cứu biên lai không cần đăng nhập</a></div>
      <div class="auth-proto">Phiên bản nguyên mẫu phục vụ trình diễn. Dữ liệu trong hệ thống là dữ liệu minh họa.</div>`;
  }
  function screenLogin() {
    const err = S.error ? `<div class="auth-error" role="alert">${U.esc(S.error)}</div>` : '';
    let form;
    if (S.step === 'otp') {
      const acc = S.loginAccountId ? A.ACCOUNTS.get(S.loginAccountId) : null;
      form = `<div class="auth-brand-label">Cổng tiểu thương</div><h1>Xác thực OTP</h1>
        <p class="auth-lead">Mã xác thực đã được gửi đến số điện thoại <b>${U.maskPhone(acc ? acc.phone : S.phone)}</b></p>
        <div class="field"><label id="tw-otp-label">Mã OTP *</label><div class="auth-otp" role="group" aria-labelledby="tw-otp-label">${[0, 1, 2, 3, 4, 5].map(i => `<input class="input" inputmode="numeric" autocomplete="one-time-code" maxlength="1" data-tw-otp="${i}" value="${U.esc(S.otp[i] || '')}" aria-label="Số ${i + 1}">`).join('')}</div>${err}</div>
        <button class="btn primary auth-submit" data-act="tw-verify">Xác nhận</button>
        <div class="small muted auth-demo-otp">Prototype: đã tự điền OTP mô phỏng <b>${A.ACCOUNTS.otpDemoCode}</b>, không gửi SMS thật. Bấm "Xác nhận" để tiếp tục.</div>
        <div class="auth-links"><button class="btn link" data-act="tw-back">← Đổi số điện thoại</button></div>`;
    } else {
      form = `<div class="auth-brand-label">Cổng tiểu thương</div><h1>Đăng nhập</h1>
        <p class="auth-lead">Sử dụng số điện thoại đã đăng ký với Ban Quản lý chợ.</p>
        <div class="field"><label for="tw-phone">Số điện thoại *</label><input id="tw-phone" class="input auth-input" type="tel" inputmode="tel" autocomplete="tel" data-in="tw-phone" value="${U.esc(S.phone)}" placeholder="Nhập số điện thoại">${err}</div>
        <button class="btn primary auth-submit" data-act="tw-lookup">Tiếp tục</button>`;
    }
    return `<div class="auth-shell"><div class="auth-panel">${authBrand('Cổng tiểu thương', 'Xem khoản phí, thanh toán, nhận biên lai và gửi phản ánh tới Ban Quản lý chợ.')}<section class="auth-form">${form}${authFoot()}</section></div></div>`;
  }

  function screenUnlinked(acc) {
    return `<div class="auth-shell"><div class="auth-panel">${authBrand('Cổng tiểu thương', 'Xem khoản phí, thanh toán, nhận biên lai và gửi phản ánh tới Ban Quản lý chợ.')}<section class="auth-form"><div class="auth-brand-label">Cổng tiểu thương</div><h1>${U.esc(acc.fullName || '')}</h1>
      <div class="auth-error" role="alert">Tài khoản chưa được liên kết với hồ sơ tiểu thương.</div>
      <p class="auth-lead">Vui lòng liên hệ Ban Quản lý chợ để được liên kết hồ sơ.</p>
      <div class="auth-links"><button class="btn link" data-act="tw-logout">Đăng xuất</button></div>${authFoot()}</section></div></div>`;
  }
  // ==================== TRA CỨU BIÊN LAI (công khai) ====================
  function screenLookup() {
    const r = S.lookupResult;
    let out = '';
    if (r === 'none') out = '<div class="auth-error" role="alert">Không tìm thấy biên lai với mã tra cứu này.</div>';
    else if (r) {
      const inv = A.idx.invoice.get(r.invoiceId), st = inv && stallOf(inv.stallId);
      out = `<dl class="kv" style="margin-top:14px"><dt>Số biên lai</dt><dd><b>${U.esc(r.receipt)}</b></dd><dt>Số tiền</dt><dd><b>${U.money(r.amount)}</b></dd>
        <dt>Kỳ thu</dt><dd>${inv ? U.per(inv.period) : '—'}</dd><dt>Điểm kinh doanh</dt><dd>${st ? U.esc(st.code) + ' · ' + U.esc(marketName(st.market)) : '—'}</dd>
        <dt>Hình thức</dt><dd>${U.esc(D.METHOD[r.method] || r.method)}</dd><dt>Thời gian</dt><dd>${U.dmy(r.date)} ${U.esc(r.time || '')}</dd></dl>
        <button class="btn auth-submit" data-act="tw-receipt" data-id="${r.id}">Xem biên lai</button>`;
    }
    const back = me() ? '<a class="btn link" href="#/trang-chu">← Về trang chủ</a>' : '<a class="btn link" href="#/dang-nhap">← Về đăng nhập</a>';
    return `<div class="auth-shell"><div class="auth-panel">${authBrand('Tra cứu biên lai', 'Nhập mã tra cứu in trên biên lai điện tử để kiểm tra giao dịch.')}
      <section class="auth-form"><div class="auth-brand-label">Cổng tiểu thương</div><h1>Tra cứu biên lai</h1>
        <p class="auth-lead">Mã tra cứu gồm 6 ký tự, in trên biên lai điện tử.</p>
        <div class="field"><label for="tw-lookup">Mã tra cứu *</label><input id="tw-lookup" class="input auth-input" data-in="tw-lookup" value="${U.esc(S.lookup)}" placeholder="VD: 8K2QZP" style="text-transform:uppercase"></div>
        <button class="btn primary auth-submit" data-act="tw-lookup-go">Tra cứu</button>${out}
        <div class="auth-links">${back}</div></section></div></div>`;
  }

  // ==================== CÁC MÀN SAU ĐĂNG NHẬP (góc nhìn của tiểu thương) ====================
  const periodOf = i => U.per(i.period);
  const currentPeriod = t => { const ps = myInvoices(t).map(i => i.period).sort(); return ps.length ? ps[ps.length - 1] : null; };
  const contractService = () => A.features.contracts && A.features.contracts.service;
  const contractPointId = c => c && (c.businessPointId || c.stallId);
  const contractPhase = c => (contractService() && contractService().presentationStatus(c)) || 'ended';
  const contractOrder = { current: 0, upcoming: 1, expired: 2, terminated: 3, liquidated: 4, ended: 5 };
  const contractsOf = t => A.db.contracts.filter(c => c.traderId === t.id).sort((a, b) => (contractOrder[contractPhase(a)] - contractOrder[contractPhase(b)]) || String(b.start || '').localeCompare(String(a.start || '')));
  const daysLeft = c => U.days(String(A.db.today || U.today()), c.end);
  const section = (title, body, action) => `<section class="card tw-sec"><div class="card-h"><h3>${title}</h3>${action || ''}</div><div class="card-b">${body}</div></section>`;
  const empty = txt => `<div class="tw-empty">${txt}</div>`;

  // Thông báo kỳ thu: suy ra từ khoản phải thu đã phát hành (ngày phát hành, số tiền, hạn nộp),
  // gộp với thông báo chung của Ban Quản lý. Không lưu thêm bản ghi nào.
  function feeNotices(t) {
    const invs = myInvoices(t).filter(i => i.issued);
    return Array.from(new Set(invs.map(i => i.period))).map(p => {
      const xs = invs.filter(i => i.period === p), total = U.sum(xs, i => i.amount);
      const codes = xs.map(i => (stallOf(i.stallId) || {}).code).filter(Boolean);
      const open = xs.find(i => U.due(i) > 0) || xs[0];
      return { id: 'KT-' + p, at: xs.map(i => i.issued).sort()[0], kind: 'fee', invoiceId: open.id,
        title: 'Thông báo phí dịch vụ kỳ ' + U.per(p),
        body: 'Số tiền phải nộp ' + U.money(total) + (codes.length > 1 ? ' cho ' + codes.length + ' điểm kinh doanh (' + codes.join(', ') + ')' : codes.length ? ' cho điểm ' + codes[0] : '') + ', hạn nộp ' + U.dmy(xs[0].due) + '.' };
    });
  }
  function allNotices(t) {
    return feeNotices(t).concat(notices(t).map(n => ({ id: n.id, at: n.at, kind: 'bql', title: n.title, body: n.body || n.text || '' })))
      .sort((a, b) => (b.at || '').localeCompare(a.at || ''));
  }
  // Projection of the shared notification collections for the signed-in
  // account/trader. It deliberately does not introduce a trader-web notification store.
  function headerNotifications(t, acc) {
    const market = U.market(t.market) || {}, debt = U.traderOverdue(t.id) > 0;
    const inOperationalScope = n => {
      if (n.accountId) return n.accountId === acc.id;
      if (n.traderId) return n.traderId === t.id;
      const group = String(n.group || '');
      return group === 'Toàn bộ tiểu thương' || group === market.short || group === 'Ngành hàng: ' + t.cat || (debt && group === 'Danh sách nợ phí');
    };
    const personal = (A.db.personalNotifications || []).filter(n => n && n.recipientAccountId === acc.id).map(n => ({
      source: 'personal', id: n.id, raw: n, title: n.title || 'Thông báo', message: n.message || n.body || '', at: n.createdAt || n.at,
      read: !!n.readAt, type: n.type || '', targetRoute: n.targetRoute || ''
    }));
    const operational = (A.db.notifications || []).filter(n => n && inOperationalScope(n)).map(n => ({
      source: 'operational', id: n.id, raw: n, title: n.title || 'Thông báo', message: n.body || n.text || n.message || '', at: n.createdAt || n.at,
      read: !!(n.readByAccount && n.readByAccount[acc.id]), type: n.type || n.kind || '', targetRoute: n.targetRoute || ''
    }));
    return personal.concat(operational).sort((a, b) => String(b.at || '').localeCompare(String(a.at || '')));
  }
  function headerNotificationTime(value) {
    const date = String(value || '').slice(0, 10);
    return date ? U.dmy(date) : '—';
  }
  function traderNotificationRoute(n) {
    const type = String(n.type || '').toLowerCase(), target = String(n.targetRoute || '').toLowerCase();
    if (type.indexOf('contract') !== -1 || target.indexOf('hop-dong') !== -1) return 'hop-dong';
    if (type.indexOf('incident') !== -1 || type.indexOf('complaint') !== -1 || target.indexOf('su-co') !== -1 || target.indexOf('phan-anh') !== -1) return 'phan-anh';
    if (type.indexOf('receivable') !== -1 || type.indexOf('receipt') !== -1 || type.indexOf('payment') !== -1 || ['phai-thu', 'thu-tien', 'cong-no', 'doi-soat', 'hoa-don', 'thanh-toan'].some(x => target.indexOf(x) !== -1)) return 'hoa-don';
    if (target.indexOf('thong-tin-ca-nhan') !== -1 || target.indexOf('tai-khoan') !== -1) return 'tai-khoan';
    if (target === 'thong-bao') return 'thong-bao';
    return 'trang-chu';
  }
  function markHeaderNotificationRead(n, accountId) {
    if (!n || n.read) return;
    if (n.source === 'personal') n.raw.readAt = new Date().toISOString();
    else {
      // `read` of the operational multi-channel record is delivery analytics, not
      // an inbox state. Keep it intact and retain this account's read receipt only.
      n.raw.readByAccount = Object.assign({}, n.raw.readByAccount, { [accountId]: new Date().toISOString() });
    }
    A.save();
  }
  function headerNotificationPopover(t, acc) {
    const rows = headerNotifications(t, acc), unread = rows.filter(n => !n.read).length;
    return `<div class="tw-header-popover tw-notification-popover" role="dialog" aria-label="Thông báo"><div class="tw-header-popover-head"><b>Thông báo</b>${unread ? `<span>${unread > 99 ? '99+' : unread} chưa đọc</span>` : ''}</div><div class="tw-notification-list">${rows.length ? rows.map(n => `<button class="tw-notification-item${n.read ? '' : ' unread'}" data-act="tw-header-notification-open" data-source="${n.source}" data-id="${U.esc(n.id)}"><i aria-hidden="true"></i><span><b>${U.esc(n.title)}</b>${n.message ? `<small>${U.esc(n.message)}</small>` : ''}<em>${headerNotificationTime(n.at)}</em></span></button>`).join('') : '<div class="tw-notification-empty">Bạn chưa có thông báo.</div>'}</div></div>`;
  }
  function headerAccountPopover(t, acc, initial) {
    const name = acc.fullName || t.name || '—', phone = acc.phone || t.phone || '—';
    return `<div class="tw-header-popover tw-account-popover" role="dialog" aria-label="Tài khoản"><div class="tw-account-summary"><span class="tw-avatar tw-avatar-lg">${U.esc(initial)}</span><div><b>${U.esc(name)}</b><small>Tiểu thương</small><small>${U.esc(phone)}</small></div></div><div class="tw-account-actions"><button data-act="tw-header-account-profile">${U.icon('users')}<span>Thông tin tài khoản</span></button><button data-act="tw-logout">${U.icon('close')}<span>Đăng xuất</span></button></div></div>`;
  }
  const noticeItem = n => `<div class="tw-item${n.invoiceId ? ' click' : ''}"${n.invoiceId ? ` data-act="tw-bill-open" data-id="${n.invoiceId}"` : ''}>
      <span class="tw-dot ${n.kind === 'fee' ? 'fee' : ''}" aria-hidden="true">${U.icon(n.kind === 'fee' ? 'receipt' : 'bell')}</span>
      <div class="tw-item-m"><b>${U.esc(n.title)}</b>${n.body ? `<span class="small">${U.esc(n.body)}</span>` : ''}<span class="small muted">${U.dmy(n.at)} · ${n.kind === 'fee' ? 'Kỳ thu tháng' : 'Ban Quản lý chợ'}</span></div></div>`;

  function billCard(i, open, byStall) {
    const st = stallOf(i.stallId), pays = A.db.payments.filter(p => p.invoiceId === i.id);
    return `<div class="tw-bill${open ? ' open' : ''}">
      <button class="tw-bill-h" data-act="tw-bill" data-id="${i.id}" aria-expanded="${open}">
        <span class="tw-item-m">${byStall ? `<b>${st ? U.esc(st.code) : U.esc(i.id)}</b><span class="small muted">${st ? U.esc(st.sectionName || '') + ' · ' : ''}Hạn nộp ${U.dmy(i.due)}</span>` : `<b>Kỳ ${periodOf(i)}</b><span class="small muted">${st ? U.esc(st.code) + ' · ' : ''}Hạn nộp ${U.dmy(i.due)}</span>`}</span>
        <span class="tw-bill-r"><b>${U.money(i.amount)}</b>${U.invTag(i)}</span></button>
      ${open ? `<div class="tw-bill-b">
        <dl class="kv"><dt>Mã khoản</dt><dd>${U.esc(i.id)}</dd><dt>Ngày thông báo</dt><dd>${U.dmy(i.issued)}</dd><dt>Điểm kinh doanh</dt><dd>${st ? U.esc(st.code + ' · ' + (st.sectionName || '')) : '—'}</dd></dl>
        <div class="tw-lines">${(i.items || []).map(x => `<div><span>${U.esc(x.name)}</span><span>${U.money(x.amount)}</span></div>`).join('')}
          <div class="sum"><span>Tổng tiền kỳ ${periodOf(i)}</span><span>${U.money(i.amount)}</span></div>
          <div><span>Đã nộp</span><span>${U.money(i.paid)}</span></div>
          <div class="sum"><span>Còn phải nộp</span><span>${U.money(U.due(i))}</span></div></div>
        ${pays.length ? `<div class="small muted" style="margin:10px 0 4px">Biên lai</div>${pays.map(p => `<button class="tw-receipt" data-act="tw-receipt" data-id="${p.id}">${U.icon('file')}<span>${U.esc(p.receipt)} · ${U.esc(D.METHOD[p.method] || p.method)} · ${U.dmy(p.date)}</span><b>${U.money(p.amount)}</b></button>`).join('')}` : ''}
        ${U.due(i) > 0 ? '<a class="btn primary tw-full" href="#/thanh-toan">Thanh toán kỳ này</a>' : ''}
      </div>` : ''}</div>`;
  }

  function pageHome(t) {
    const cp = currentPeriod(t), cur = myInvoices(t).filter(i => i.period === cp);
    const curDue = U.sum(cur, U.due), older = unpaid(t).filter(i => i.period !== cp), olderDue = U.sum(older, U.due);
    const cons = contractsOf(t).filter(x => x.status === 'hieuluc');
    const inc = myIncidents(t).slice(0, 2);
    const period = cp ? `<section class="card tw-period"><div class="card-b">
        <div class="tw-period-h"><span class="small muted">Kỳ thu tháng ${U.per(cp)}</span>${cur.every(i => i.status === 'paid') ? '<span class="tag ok">Đã nộp đủ</span>' : (cur.some(U.isOver) ? '<span class="tag danger">Quá hạn</span>' : '<span class="tag warn">Chưa nộp</span>')}</div>
        <div class="tw-amount">${U.money(curDue || U.sum(cur, i => i.amount))}</div>
        <div class="small muted">${curDue ? 'Số tiền cần nộp · hạn nộp ' + U.dmy(cur[0].due) : 'Đã nộp đủ kỳ này · cảm ơn bạn'}</div>
        ${olderDue ? `<div class="note warn" style="margin-top:12px">Còn nợ ${older.length} khoản các kỳ trước: <b>${U.money(olderDue)}</b></div>` : ''}
        <div class="tw-actions">${curDue + olderDue ? `<a class="btn primary" href="#/thanh-toan">Thanh toán ${U.money(curDue + olderDue)}</a>` : ''}<a class="btn" href="#/hoa-don">Xem hóa đơn</a></div>
      </div></section>` : section('Kỳ thu', empty('Chưa có khoản phí nào được thông báo.'));
    return `<div class="tw-hello"><h2>Xin chào, ${U.esc(t.name)}</h2><div class="small muted">${U.esc(marketName(t.market))}</div></div>
      ${period}
      <div class="tw-quick">${[['hoa-don', 'receipt', 'Hóa đơn'], ['hop-dong', 'file', 'Hợp đồng'], ['phan-anh', 'warning', 'Phản ánh'], ['thong-bao', 'bell', 'Thông báo']].map(x => `<a href="#/${x[0]}">${U.icon(x[1])}<span>${x[2]}</span></a>`).join('')}</div>
      ${section('Hợp đồng của tôi', cons.map(c => `<div class="tw-item click" data-act="tw-go" data-id="hop-dong"><span class="tw-dot">${U.icon('file')}</span><div class="tw-item-m"><b>${U.esc(c.id)}</b><span class="small muted">${U.esc((stallOf(c.stallId) || {}).code || '')} · hiệu lực đến ${U.dmy(c.end)}</span></div>${contractLeftTag(c)}</div>`).join('') || empty('Chưa có hợp đồng đang hiệu lực.'))}
      ${section('Thông báo mới', allNotices(t).slice(0, 3).map(noticeItem).join('') || empty('Chưa có thông báo.'), '<a class="btn sm" href="#/thong-bao">Tất cả</a>')}
      ${section('Phản ánh của tôi', inc.map(i => `<div class="tw-item click" data-act="tw-inc" data-id="${i.id}"><span class="tw-dot">${U.icon('warning')}</span><div class="tw-item-m"><b>${U.esc(i.title)}</b><span class="small muted">${U.esc(i.id)} · ${U.dmy(i.created)}</span></div>${incTag(i)}</div>`).join('') || empty('Bạn chưa gửi phản ánh nào.'), t.stalls.length ? '<button class="btn sm primary" data-act="tw-report-new">+ Gửi phản ánh</button>' : '')}`;
  }

  // Mỗi kỳ thu tháng là 1 nhóm; trong kỳ liệt kê hóa đơn theo từng điểm kinh doanh.
  function periodGroups(rows) {
    const periods = Array.from(new Set(rows.map(i => i.period)));
    return periods.map(p => {
      const xs = rows.filter(i => i.period === p), due = U.sum(xs, U.due), total = U.sum(xs, i => i.amount);
      const tag = due <= 0 ? '<span class="tag ok">Đã nộp đủ</span>' : xs.some(U.isOver) ? '<span class="tag danger">Quá hạn</span>' : '<span class="tag warn">Còn phải nộp</span>';
      return `<section class="card tw-sec"><div class="card-h"><h3>Kỳ thu tháng ${U.per(p)}</h3>${tag}</div><div class="card-b">
        <div class="tw-period-sum"><span>Tổng tiền kỳ <b>${U.money(total)}</b></span>${due > 0 ? `<span>Còn phải nộp <b class="tw-red">${U.money(due)}</b></span>` : ''}<span class="small muted">${xs.length} điểm kinh doanh</span></div>
        ${xs.map(i => billCard(i, S.openInv === i.id, true)).join('')}</div></section>`;
    }).join('');
  }
  function pageBills(t) {
    const f = S.billFilter || 'all';
    const all = myInvoices(t).slice().sort((a, b) => b.period.localeCompare(a.period) || a.id.localeCompare(b.id));
    const rows = all.filter(i => f === 'all' || (f === 'unpaid' ? i.status !== 'paid' : i.status === 'paid'));
    const due = U.sum(unpaid(t), U.due);
    return `<div class="tw-hello"><h2>Hóa đơn theo kỳ thu</h2><div class="small muted">Phí dịch vụ được thông báo mỗi tháng khi đến kỳ thu.</div></div>
      ${due ? `<div class="note warn tw-due-note"><span>Còn phải nộp <b>${U.money(due)}</b> (${unpaid(t).length} khoản)</span><a class="btn primary sm" href="#/thanh-toan">Thanh toán</a></div>` : '<div class="note info">Bạn đã nộp đủ các kỳ thu.</div>'}
      <div class="seg tw-seg">${[['all', 'Tất cả'], ['unpaid', 'Chưa nộp đủ'], ['paid', 'Đã nộp']].map(x => `<button class="${f === x[0] ? 'on' : ''}" data-act="tw-bill-filter" data-id="${x[0]}">${x[1]}</button>`).join('')}</div>
      ${periodGroups(rows) || `<section class="card tw-sec"><div class="card-b">${empty('Không có hóa đơn phù hợp.')}</div></section>`}`;
  }

  function pagePay(t) {
    if (S.lastPays) {
      const p = S.lastPays;
      return `<section class="card tw-sec"><div class="card-b tw-center">
          <div class="tw-ok">${U.icon('check')}</div><h2>Thanh toán thành công</h2>
          <div class="tw-amount">${U.money(U.sum(p, x => x.amount))}</div>
          <div class="small muted">Biên lai điện tử đã được gửi tới bạn và lưu trong mục Hóa đơn.</div>
          <div style="margin-top:14px;text-align:left">${p.map(x => `<button class="tw-receipt" data-act="tw-receipt" data-id="${x.id}">${U.icon('file')}<span>${U.esc(x.receipt)} · mã tra cứu <b>${U.esc(x.lookup)}</b></span><b>${U.money(x.amount)}</b></button>`).join('')}</div>
          <div class="tw-actions"><button class="btn primary" data-act="tw-receipt-last">Xem biên lai</button><a class="btn" href="#/trang-chu">Về trang chủ</a></div></div></section>`;
    }
    const list = unpaid(t);
    if (!list.length) return `<div class="tw-hello"><h2>Thanh toán</h2></div><div class="note info">Bạn không còn khoản nào cần thanh toán.</div>`;
    if (!S.paySel) S.paySel = list.map(i => i.id);
    S.paySel = S.paySel.filter(id => list.some(i => i.id === id));
    const sel = list.filter(i => S.paySel.indexOf(i.id) !== -1), total = U.sum(sel, U.due);
    const content = 'CHOSO ' + t.id;
    const bank = (D.BANK_BY_MARKET && D.BANK_BY_MARKET[t.market]) || 'Tài khoản thu của Ban Quản lý chợ';
    return `<div class="tw-hello"><h2>Thanh toán</h2><div class="small muted">Chọn kỳ cần nộp rồi quét mã QR bằng ứng dụng ngân hàng.</div></div>
      ${section('Chọn kỳ cần nộp', list.map(i => `<label class="tw-item tw-check"><input type="checkbox" data-ch="tw-sel" value="${i.id}" ${S.paySel.indexOf(i.id) !== -1 ? 'checked' : ''}>
          <div class="tw-item-m"><b>Kỳ ${periodOf(i)}</b><span class="small muted">${U.esc((stallOf(i.stallId) || {}).code || '')} · hạn ${U.dmy(i.due)}</span></div><span class="tw-bill-r"><b>${U.money(U.due(i))}</b>${U.isOver(i) ? '<span class="tag danger">Quá hạn</span>' : ''}</span></label>`).join(''))}
      <section class="card tw-sec"><div class="card-b tw-center">
        ${total ? `<div class="small muted">Quét mã bằng ứng dụng ngân hàng bất kỳ</div>
          <div class="tw-qr">${U.qr(content + ' ' + total, 200)}</div>
          <div class="tw-amount">${U.money(total)}</div>
          <dl class="kv" style="text-align:left;margin:12px 0"><dt>Ngân hàng</dt><dd>${U.esc(bank)}</dd><dt>Nội dung</dt><dd><b>${U.esc(content)}</b></dd><dt>Số kỳ</dt><dd>${sel.length}</dd></dl>
          <button class="btn primary tw-full" data-act="tw-paid" ${S.paying ? 'disabled' : ''}>Giả lập: ngân hàng báo đã chuyển khoản</button>
          <div class="small muted" style="margin-top:8px">Prototype: chưa kết nối cổng thanh toán thật. Có thể nộp tiền mặt cho nhân viên thu phí.</div>` : '<div class="note">Chọn ít nhất một kỳ để tạo mã QR.</div>'}
      </div></section>`;
  }

  function contractStatus(c) {
    const phase = contractPhase(c);
    const labels = { current: 'Đang hiệu lực', upcoming: 'Chưa đến hiệu lực', expired: 'Đã hết hạn', terminated: 'Đã chấm dứt', liquidated: 'Đã thanh lý', ended: 'Đã kết thúc' };
    const tones = { current: 'ok', upcoming: 'info', expired: 'warn', terminated: '', liquidated: '', ended: '' };
    return `<span class="tag ${tones[phase] || ''}">${labels[phase] || '—'}</span>`;
  }
  const contractLeftTag = contractStatus;
  const pointOfContract = c => stallOf(contractPointId(c));
  const formatArea = point => point && Number.isFinite(Number(point.area)) ? `${Number(point.area).toLocaleString('vi-VN')} m²` : '—';
  function contractPointCard(c) {
    const point = pointOfContract(c), BP = A.features.businessPoints.service;
    if (!point) return `<div class="tw-contract-point"><div class="tw-contract-point-h"><b>Chưa xác định được điểm kinh doanh</b>${contractStatus(c)}</div><div class="small muted">Thông tin điểm kinh doanh của hợp đồng này hiện chưa khả dụng.</div></div>`;
    const loc = BP.location(point);
    // Cổng tiểu thương cũng được nạp độc lập, nên chỉ dùng pointCollector khi
    // facade scope đã có mặt; fallback vẫn derive đúng Row → collectorId.
    const row = BP.row(point);
    const collector = typeof BP.pointCollector === 'function' ? BP.pointCollector(point.id) : (row && row.collectorId && A.ACCOUNTS.get(row.collectorId));
    const usage = { current: 'Đang thuê', upcoming: 'Chưa đến hiệu lực', expired: 'Đã hết hạn', terminated: 'Đã chấm dứt', liquidated: 'Đã thanh lý', ended: 'Đã kết thúc' }[contractPhase(c)] || '—';
    return `<article class="tw-contract-point">
      <div class="tw-contract-point-h"><b>${U.esc(point.code || '—')}</b><span class="tag ${contractPhase(c) === 'current' ? 'ok' : ''}">${usage}</span></div>
      <div class="tw-contract-location"><span>Vị trí</span><b>${U.esc(loc.label || '—')}</b></div>
      <div class="tw-point-meta"><div><span>Ngành hàng</span><b>${U.esc(BP.industry(point) || '—')}</b></div><div><span>Diện tích</span><b>${formatArea(point)}</b></div><div><span>Loại diện tích</span><b>${U.esc(U.areaTypeLabel(point.areaTypeId) || '—')}</b></div></div>
      ${collector ? `<div class="tw-contract-extra"><span>Nhân viên thu phí phụ trách</span><b>${U.esc(collector.fullName || collector.name || '—')}</b></div>` : ''}
    </article>`;
  }
  function contractChargeSection(c) {
    const snapshots = Array.isArray(c.feeSnapshot) ? c.feeSnapshot.filter(x => x && x.amount !== undefined && x.amount !== null) : [];
    if (snapshots.length) return `<section class="tw-contract-section"><h3>Giá và các khoản thu áp dụng</h3><div class="tw-charge-list">${snapshots.map(x => `<div><span>${U.esc(x.name || 'Khoản thu')}</span><b>${U.money(x.amount)}${x.unitLabel ? ' / ' + U.esc(x.unitLabel) : ''}</b></div>`).join('')}</div><p class="small muted">Khoản phải thu thực tế được xác định theo chính sách, biểu phí có hiệu lực tại từng kỳ thu.</p></section>`;
    const monthly = Number(c.monthly);
    const policyAmount = c.feePolicy && Number(c.feePolicy.amount);
    const amount = monthly > 0 ? monthly : (policyAmount > 0 ? policyAmount : null);
    if (!amount) return `<section class="tw-contract-section"><h3>Giá và các khoản thu áp dụng</h3><div class="small muted">Chưa có thông tin mức thu.</div></section>`;
    return `<section class="tw-contract-section"><h3>Giá và các khoản thu áp dụng</h3><div class="tw-charge-list"><div><span>Mức giá theo hợp đồng</span><b>${U.money(amount)} / tháng</b></div></div><p class="small muted">Khoản phải thu thực tế được xác định theo chính sách, biểu phí có hiệu lực tại từng kỳ thu.</p></section>`;
  }
  function pageContracts(t) {
    const cons = contractsOf(t);
    if (!cons.length) return `<div class="tw-hello"><h2>Hợp đồng & điểm kinh doanh</h2><div class="small muted">Xem hợp đồng và các điểm kinh doanh của bạn.</div></div><section class="card tw-sec"><div class="card-b"><div class="note info">Bạn chưa có hợp đồng kinh doanh.</div></div></section>`;
    const selected = cons.find(c => c.id === S.contractSel) || cons[0];
    S.contractSel = selected.id;
    const point = pointOfContract(selected), points = point ? [point] : [];
    const files = Array.isArray(selected.signedCopies) ? selected.signedCopies.filter(Boolean) : [];
    return `<div class="tw-hello"><h2>Hợp đồng & điểm kinh doanh</h2><div class="small muted">Xem hợp đồng và các điểm kinh doanh của bạn.</div></div>
      <div class="tw-contract-workspace">
        <aside class="tw-contract-list" aria-label="Danh sách hợp đồng"><div class="tw-contract-list-title">Danh sách hợp đồng</div>${cons.map(c => {
          const cp = pointOfContract(c);
          return `<button class="tw-contract-choice${c.id === selected.id ? ' on' : ''}" data-act="tw-contract-select" data-id="${U.esc(c.id)}" aria-pressed="${c.id === selected.id}">
            <b>${U.esc(c.id)}</b>${contractStatus(c)}
            <span>${U.dmy(c.start)} – ${U.dmy(c.end)}</span><span>${U.esc(marketName(c.market || t.market))}</span><small>${cp ? '1 điểm kinh doanh' : 'Chưa có điểm kinh doanh'}</small>
          </button>`;
        }).join('')}</aside>
        <section class="card tw-contract-detail">
          <div class="card-h tw-contract-detail-h"><div><h3>${U.esc(selected.id)}</h3><span class="small muted">Hợp đồng thuê điểm kinh doanh</span></div>${contractStatus(selected)}</div>
          <div class="card-b">
            <section class="tw-contract-section"><h3>Thông tin hợp đồng</h3><div class="tw-contract-info-grid">
              <div><span>Thời hạn</span><b>${U.dmy(selected.start)} – ${U.dmy(selected.end)}</b></div>
              <div><span>Chợ</span><b>${U.esc(marketName(selected.market || t.market))}</b></div>
              ${selected.kind ? `<div><span>Loại hợp đồng</span><b>${U.esc(selected.kind)}</b></div>` : ''}
              ${selected.signedDate ? `<div><span>Ngày ký</span><b>${U.dmy(selected.signedDate)}</b></div>` : ''}
            </div></section>
            <section class="tw-contract-section"><h3>Điểm kinh doanh thuộc hợp đồng</h3>${points.map(() => contractPointCard(selected)).join('') || '<div class="small muted">Chưa có thông tin điểm kinh doanh.</div>'}</section>
            ${contractChargeSection(selected)}
            ${files.length ? `<section class="tw-contract-section"><h3>Hồ sơ hợp đồng</h3><div class="small muted">Đã lưu ${files.length} tệp hồ sơ hợp đồng.</div></section>` : ''}
          </div>
        </section>
      </div>`;
  }

  function pageReport(t) {
    const inc = myIncidents(t);
    return `<div class="tw-hello tw-hello-a"><div><h2>Phản ánh, kiến nghị</h2><div class="small muted">Gửi tới Ban Quản lý chợ và theo dõi kết quả xử lý.</div></div>${t.stalls.length ? '<button class="btn primary" data-act="tw-report-new">+ Gửi phản ánh</button>' : ''}</div>
      <section class="card tw-sec"><div class="card-b">${inc.map(i => `<div class="tw-item click" data-act="tw-inc" data-id="${i.id}"><span class="tw-dot">${U.icon('warning')}</span>
        <div class="tw-item-m"><b>${U.esc(i.title)}</b><span class="small muted">${U.esc(i.id)} · ${U.esc(i.cat)} · ${U.dmy(i.created)}${reportImages(i).length ? ' · ' + reportImages(i).length + ' ảnh' : ''}</span>
        ${(i.state === 'hoanthanh' || i.state === 'dong') ? `<span class="small">${i.rating ? '★'.repeat(i.rating) + ' Đã đánh giá' : (i.state === 'hoanthanh' ? 'Đã xử lý xong · chạm để xem kết quả và đánh giá' : 'Đã đóng')}</span>` : ''}</div>${incTag(i)}</div>`).join('') || empty('Bạn chưa gửi phản ánh nào.')}</div></section>`;
  }
  const MAX_IMG = 5, MAX_MB = 10;
  const reportImages = i => (i.images && i.images.report) || (i.photo ? ['Ảnh phản ánh'] : []);
  function draftThumbs() {
    return S.draftImages.map((x, n) => `<div class="inc-image-thumb"><img src="${x.url}" alt=""><span>${U.esc(x.name)}</span><button class="x" data-act="tw-image-remove" data-n="${n}" aria-label="Bỏ ảnh">×</button></div>`).join('');
  }
  // Có bản xem trước trong phiên thì hiện ảnh thật; không thì hiện tên tệp như màn quản lý.
  function thumbs(names, urls) {
    return names && names.length ? `<div class="inc-image-list">${names.map((n, k) => `<div class="inc-image-thumb">${urls && urls[k] ? `<img src="${urls[k]}" alt="">` : '📷'}<span>${U.esc(typeof n === 'string' ? n : n.name)}</span></div>`).join('')}</div>` : '<div class="small muted">Chưa có hình ảnh.</div>';
  }
  function clearDraft() { S.draftImages.forEach(x => URL.revokeObjectURL(x.url)); S.draftImages = []; }
  function openIncident(t, id) {
    const i = A.db.incidents.find(x => x.id === id);
    if (!i || i.traderId !== t.id) { U.toast('Không tìm thấy phản ánh'); return; }
    const hist = i.history && i.history.length ? i.history.map(h => [h.at, h.action + (h.detail ? ' – ' + h.detail : '')]) : (i.log || []).map(h => [h.at, h.text]);
    const done = i.state === 'hoanthanh' || i.state === 'dong';
    const canRate = i.state === 'hoanthanh';
    const draft = S.ratingDrafts[i.id] || {};
    const selectedRating = Number(draft.rating || i.rating || 0);
    const comment = draft.comment != null ? draft.comment : ((i.feedback || {}).comment || '');
    const when = v => U.esc(String(v || '').replace('T', ' · '));
    A.modal(A.mHead('Phản ánh ' + U.esc(i.id)) + `<div class="modal-b">
      <dl class="kv"><dt>Nội dung</dt><dd><b>${U.esc(i.title)}</b>${i.desc && i.desc !== i.title ? `<div class="small">${U.esc(i.desc)}</div>` : ''}</dd><dt>Nhóm</dt><dd>${U.esc(i.cat)}</dd>
        <dt>Điểm kinh doanh</dt><dd>${U.esc((stallOf(i.stallId) || {}).code || '—')}</dd><dt>Ngày gửi</dt><dd>${when(i.created)}</dd><dt>Trạng thái</dt><dd>${incTag(i)}</dd></dl>
      <h4 style="margin:16px 0 8px">Ảnh bạn gửi</h4>${thumbs(reportImages(i), S.sessionImages[i.id])}
      ${i.work ? `<h4 style="margin:16px 0 8px">Kết quả xử lý</h4><dl class="kv"><dt>Nội dung xử lý</dt><dd>${U.esc(i.work.content || '—')}</dd><dt>Kết quả</dt><dd>${U.esc(i.work.result || '—')}</dd><dt>Hoàn thành lúc</dt><dd>${when(i.work.completedAt)}</dd></dl><div style="margin-top:8px">${thumbs((i.images && i.images.work) || [])}</div>` : ''}
      <h4 style="margin:16px 0 8px">Tiến độ xử lý</h4>${U.table([{ t: 'Thời gian' }, { t: 'Diễn biến' }], hist.map(h => `<tr><td>${when(h[0])}</td><td>${U.esc(h[1])}</td></tr>`))}
      ${done ? `<h4 style="margin:16px 0 8px">Đánh giá kết quả</h4>${canRate ? `<div class="stars">${[1, 2, 3, 4, 5].map(n => `<button class="${selectedRating >= n ? 'on' : ''}" data-act="tw-rate-pick" data-id="${i.id}" data-n="${n}" aria-label="${n} sao">★</button>`).join('')}<span class="small muted">${selectedRating ? selectedRating + ' sao' : 'Chạm để chấm điểm'}</span></div>
        <textarea class="input" data-in="tw-rate-comment" data-id="${i.id}" rows="3" maxlength="300" placeholder="Nhập nhận xét về kết quả xử lý..." style="margin-top:8px">${U.esc(comment || '')}</textarea>
        <div class="row" style="justify-content:flex-end;margin-top:8px"><button class="btn primary" data-act="tw-rate-submit" data-id="${i.id}">Gửi đánh giá</button></div>` : `<dl class="kv"><dt>Mức đánh giá</dt><dd>${i.rating ? '★'.repeat(i.rating) + '☆'.repeat(5 - i.rating) : '—'}</dd>${comment ? `<dt>Nhận xét</dt><dd>${U.esc(comment)}</dd>` : ''}</dl>`}` : ''}
      </div><div class="modal-f"><button class="btn" data-act="close">Đóng</button></div>`);
  }
  function openReportForm(t) {
    clearDraft();
    A.modal(A.mHead('Gửi phản ánh') + `<div class="modal-b"><div class="form-grid">
      <div class="field"><label for="tw-cat">Nhóm vấn đề</label><select class="input" id="tw-cat">${CATS.map(c => `<option>${c}</option>`).join('')}</select></div>
      <div class="field"><label for="tw-stall">Điểm kinh doanh</label><select class="input" id="tw-stall">${t.stalls.map(stallOf).filter(Boolean).map(st => `<option value="${st.id}">${U.esc(st.code)} · ${U.esc(st.sectionName || '')}</option>`).join('')}</select></div></div>
      <div class="field" style="margin-top:12px"><label for="tw-text">Nội dung *</label><textarea class="input" id="tw-text" rows="4" placeholder="Mô tả vấn đề, vị trí, thời điểm phát hiện"></textarea></div>
      <div class="field" style="margin-top:12px"><label>Hình ảnh hiện trường (tối đa ${MAX_IMG} ảnh, mỗi ảnh ≤ ${MAX_MB} MB)</label>
        <div class="row" style="gap:8px;flex-wrap:wrap">
          <label class="btn">${U.icon('camera')} Chụp ảnh<input type="file" accept="image/*" capture="environment" data-ch="tw-images" hidden></label>
          <label class="btn">${U.icon('attachment')} Chọn ảnh có sẵn<input type="file" accept="image/*" multiple data-ch="tw-images" hidden></label>
        </div>
        <div class="inc-image-draft" id="tw-image-draft" style="margin-top:10px">${draftThumbs()}</div>
        <div class="small muted" style="margin-top:6px">Prototype: ảnh chỉ xem trước trên trình duyệt này, chưa tải lên máy chủ.</div></div></div>
      <div class="modal-f"><button class="btn" data-act="close">Hủy</button><button class="btn primary" data-act="tw-report">Gửi phản ánh</button></div>`);
  }

  function pageNotices(t) {
    const f = S.noticeFilter || 'all';
    const list = allNotices(t).filter(n => f === 'all' || n.kind === f);
    return `<div class="tw-hello"><h2>Thông báo</h2><div class="small muted">Thông báo phí khi đến kỳ thu và thông báo từ Ban Quản lý ${U.esc(marketName(t.market))}.</div></div>
      <div class="seg tw-seg">${[['all', 'Tất cả'], ['fee', 'Kỳ thu'], ['bql', 'Ban Quản lý']].map(x => `<button class="${f === x[0] ? 'on' : ''}" data-act="tw-notice-filter" data-id="${x[0]}">${x[1]}</button>`).join('')}</div>
      <section class="card tw-sec"><div class="card-b">${list.map(noticeItem).join('') || empty('Chưa có thông báo.')}</div></section>`;
  }

  function pageAccount(t) {
    const idNo = String(t.idNo || '');
    return `<div class="tw-hello"><h2>Tài khoản</h2></div>
      ${section('Thông tin tiểu thương', `<dl class="kv"><dt>Họ tên</dt><dd><b>${U.esc(t.name)}</b></dd><dt>Số điện thoại</dt><dd>${U.esc(t.phone)}</dd><dt>Số giấy tờ</dt><dd>${idNo ? '•••••' + U.esc(idNo.slice(-4)) : '—'}</dd>
        <dt>Chợ</dt><dd>${U.esc(marketName(t.market))}</dd><dt>Ngành hàng</dt><dd>${U.esc(t.cat || '—')}</dd><dt>Địa chỉ</dt><dd>${U.esc(t.address || '—')}</dd></dl>
        <div class="small muted" style="margin-top:10px">Muốn thay đổi thông tin, vui lòng liên hệ Ban Quản lý chợ.</div>`)}
      ${section('Điểm kinh doanh', t.stalls.map(stallOf).filter(Boolean).map(st => `<div class="tw-item"><span class="tw-dot">${U.icon('store')}</span><div class="tw-item-m"><b>${U.esc(st.code)}</b><span class="small muted">${U.esc(st.sectionName || '')} · ${Number(st.area || 0).toLocaleString('vi-VN')} m²</span></div>${pointStatus(st)}</div>`).join('') || empty('Chưa có điểm kinh doanh.'))}
      <section class="card tw-sec"><div class="card-b" style="padding-top:12px">
        <a class="tw-item click" href="#/tra-cuu"><span class="tw-dot">${U.icon('receipt')}</span><div class="tw-item-m"><b>Tra cứu biên lai</b><span class="small muted">Kiểm tra biên lai bằng mã tra cứu</span></div>›</a>
        <button class="btn tw-full" data-act="tw-logout">Đăng xuất</button></div></section>`;
  }

  // ==================== KHUNG (màu, phông, thành phần của hệ thống; bố cục dành cho tiểu thương) ====================
  const TABS = [['trang-chu', 'Trang chủ', 'dashboard'], ['hoa-don', 'Hóa đơn', 'receipt'], ['hop-dong', 'Hợp đồng', 'file'], ['phan-anh', 'Phản ánh', 'warning'], ['thong-bao', 'Thông báo', 'bell']];
  const PAGES = { 'trang-chu': pageHome, 'hoa-don': pageBills, 'thanh-toan': pagePay, 'hop-dong': pageContracts, 'phan-anh': pageReport, 'thong-bao': pageNotices, 'tai-khoan': pageAccount };
  const route = () => (location.hash.replace(/^#\/?/, '').split('?')[0] || '');

  // "Chợ đang xem": các chợ có hồ sơ liên kết với tài khoản (traderMarketsOf). Chọn chợ = chọn hồ sơ của chợ đó;
  // dữ liệu luôn lọc theo hồ sơ (traderId), không theo toàn chợ.
  function profileSwitchHtml(t, acc) {
    const mine = myProfiles(acc);
    if (mine.length < 2) return '';
    return `<label class="tw-profile-switch"><span>Chợ đang xem</span><select class="input" data-ch="tw-profile" aria-label="Chợ đang xem">${mine.map(p => `<option value="${p.id}" ${p.id === t.id ? 'selected' : ''}>${U.esc(marketName(p.market))}</option>`).join('')}</select></label>`;
  }
  function shell(t, r) {
    const due = unpaid(t).length;
    const badge = id => id === 'hoa-don' && due ? `<i class="tw-badge">${due}</i>` : '';
    const initial = (t.name.split(' ').slice(-1)[0] || '?').charAt(0);
    const acc = traderAccount(t);
    const headerRows = headerNotifications(t, acc);
    const unread = headerRows.filter(n => !n.read).length;
    const notificationOpen = S.headerPopover === 'notifications';
    const accountOpen = S.headerPopover === 'account';
    return `<header class="tw-top"><div class="tw-top-in">
        <a class="tw-brand" href="#/trang-chu"><span class="brand-logo">${MARK.replace('<svg ', '<svg width="24" height="24" ')}</span><span><b>Chợ số Cao Lãnh</b><small>Cổng tiểu thương · ${U.esc(U.market(t.market).short)}</small></span></a>${profileSwitchHtml(t, acc)}
        <nav class="tw-nav" aria-label="Điều hướng">${TABS.map(x => `<a href="#/${x[0]}" class="${r === x[0] ? 'on' : ''}">${x[1]}${badge(x[0])}</a>`).join('')}</nav>
        <div class="tw-header-actions">
          <div class="tw-header-popover-anchor">
            <button class="tw-header-bell" type="button" data-act="tw-header-notifications" aria-label="Thông báo" aria-expanded="${notificationOpen}">${U.icon('bell')}${unread ? `<i class="tw-header-badge">${unread > 99 ? '99+' : unread}</i>` : ''}</button>
            ${notificationOpen ? headerNotificationPopover(t, acc) : ''}
          </div>
          <div class="tw-header-popover-anchor">
            <button class="tw-me${accountOpen || r === 'tai-khoan' ? ' on' : ''}" type="button" data-act="tw-header-account" aria-expanded="${accountOpen}" title="Tài khoản"><span class="tw-avatar">${U.esc(initial)}</span><span class="tw-me-copy"><b class="tw-me-n">${U.esc(acc.fullName || t.name)}</b><small class="tw-me-role">Tiểu thương</small></span></button>
            ${accountOpen ? headerAccountPopover(t, acc, initial) : ''}
          </div>
        </div>
      </div></header>
      <main class="tw-main">${PAGES[r](t)}</main>
      <nav class="tw-tabbar" aria-label="Điều hướng nhanh">${TABS.map(x => `<a href="#/${x[0]}" class="${r === x[0] ? 'on' : ''}">${U.icon(x[2])}<span>${x[1]}</span>${badge(x[0])}</a>`).join('')}</nav>`;
  }

  function render() {
    const root = document.getElementById('tw-root');
    if (!root) return;
    let r = route();
    if (r === 'tra-cuu') { root.innerHTML = screenLookup(); return; }
    const t = me();
    if (!t && sessionAccount()) { root.innerHTML = screenUnlinked(sessionAccount()); return; }
    if (!t) {
      if (S.accountId) { S.traderId = null; S.accountId = null; saveSession(); }
      if (r !== 'dang-nhap') history.replaceState(null, '', '#/dang-nhap');
      root.innerHTML = screenLogin();
      bindOtp();
      return;
    }
    // Giao diện chính thức sau đăng nhập: Web App Tiểu thương dạng sidebar (trader-portal / A.VIEWS['mini-app']).
    root.innerHTML = portalHtml(t);
  }
  // Đồng bộ ngữ cảnh cho giao diện sidebar: tài khoản phiên (A07), vai trò trader, hồ sơ đang xem và chợ của hồ sơ.
  // Hồ sơ đổi từ ô "Chợ đang xem" (ui.mini.traderId) được nhận nếu thuộc chính tài khoản.
  function portalHtml(t) {
    const acc = sessionAccount();
    ui.mini = ui.mini || {};
    if (ui.mini.traderId && ui.mini.traderId !== t.id && myProfiles(acc).some(p => p.id === ui.mini.traderId)) { S.traderId = ui.mini.traderId; saveSession(); t = me(); }
    Object.assign(ui.mini, { traderId: t.id, step: 'app' });
    ui.role = 'trader'; ui.market = t.market;
    return A.VIEWS['mini-app'] ? A.VIEWS['mini-app']() : '<div class="empty">Không tải được giao diện tiểu thương.</div>';
  }
  // Ô OTP 6 số: tự nhảy ô, Enter = Xác nhận (giống màn đăng nhập của hệ thống).
  function bindOtp() {
    const boxes = Array.from(document.querySelectorAll('[data-tw-otp]'));
    boxes.forEach((el, k) => {
      el.addEventListener('input', () => {
        S.otp = boxes.map(x => String(x.value || '').replace(/\D/g, '').slice(-1)).join(''); S.error = '';
        if (el.value && k < 5) boxes[k + 1].focus();
      });
      el.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); A.ACT['tw-verify'](); } });
    });
    const phone = document.getElementById('tw-phone');
    if (phone) phone.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); S.phone = phone.value; A.ACT['tw-lookup'](); } });
    const first = phone || boxes.find(x => !x.value);
    if (first) first.focus();
  }

  A.route = function () {
    if (route() !== 'thanh-toan') { S.lastPays = null; S.paySel = null; }
    if (route() !== 'hoa-don') S.openInv = null;
    const sb = document.getElementById('sidebar'); if (sb) sb.classList.remove('open');
    A.closeModal(); render(); window.scrollTo(0, 0);
  };
  A.render = function () { render(); };
  A.guide = function () { /* không hiện hướng dẫn của trang quản lý */ };

  // ==================== HÀNH ĐỘNG ====================
  // Đăng nhập: SĐT → Tài khoản A07 (không phải hồ sơ) → OTP dùng một lần (mã mô phỏng dùng chung) → kích hoạt nếu
  // Chờ kích hoạt → vào hồ sơ mặc định. Tài khoản nội bộ / bị khoá không vào được web Tiểu thương.
  function requestOtp(acc) {
    Object.assign(S, { loginAccountId: acc.id, otpChallenge: A.ACCOUNTS.issueOtpChallenge(acc), step: 'otp', otp: A.ACCOUNTS.otpDemoCode, error: '' });
    render();
  }
  function lookupAccount(phone) {
    const acc = A.ACCOUNTS.byPhone(phone);
    if (!acc || A.ACCOUNTS.primaryRole(acc) !== 'trader') return { error: 'Số điện thoại chưa có tài khoản tiểu thương. Vui lòng liên hệ Ban Quản lý chợ.' };
    if (A.ACCOUNTS.authStatus(acc) === 'LOCKED') return { error: 'Tài khoản đang tạm khóa. Vui lòng liên hệ Ban Quản lý chợ.' };
    return { acc };
  }
  A.IN['tw-phone'] = el => { S.phone = el.value; };
  // Nhập/dán cả mã OTP 6 số một lần (bổ sung cho 6 ô nhập từng số ở bindOtp).
  A.IN['tw-otp'] = el => { S.otp = String(el.value || '').replace(/\D/g, '').slice(0, 6); S.error = ''; };
  A.CH['tw-profile'] = el => {
    const acc = sessionAccount();
    if (!acc || !myProfiles(acc).some(p => p.id === el.value)) return; // chỉ hồ sơ của chính tài khoản
    Object.assign(S, { traderId: el.value, paySel: null, contractSel: null, openInv: null, headerPopover: null });
    saveSession(); render();
  };
  A.IN['tw-lookup'] = el => { S.lookup = el.value; };
  A.IN['tw-rate-comment'] = el => {
    const id = el.dataset.id;
    S.ratingDrafts[id] = Object.assign({}, S.ratingDrafts[id] || {}, { comment: el.value });
  };
  A.CH['tw-images'] = el => {
    const files = Array.from(el.files || []);
    el.value = '';
    for (const f of files) {
      if (S.draftImages.length >= MAX_IMG) { U.toast('Chỉ đính kèm tối đa ' + MAX_IMG + ' ảnh'); break; }
      if (!/^image\//.test(f.type)) { U.toast('Tệp ' + f.name + ' không phải hình ảnh'); continue; }
      if (f.size > MAX_MB * 1024 * 1024) { U.toast('Ảnh ' + f.name + ' vượt quá ' + MAX_MB + ' MB'); continue; }
      S.draftImages.push({ name: f.name, url: URL.createObjectURL(f) });
    }
    const box = $('#tw-image-draft'); if (box) box.innerHTML = draftThumbs();
  };
  A.CH['tw-sel'] = el => {
    const set = new Set(S.paySel || []);
    if (el.checked) set.add(el.value); else set.delete(el.value);
    S.paySel = Array.from(set); render();
  };
  Object.assign(A.ACT, {
    'tw-lookup': () => {
      if (!normPhone(S.phone)) { S.error = 'Vui lòng nhập số điện thoại.'; render(); return; }
      const r = lookupAccount(S.phone);
      if (r.error) { S.error = r.error; render(); return; }
      requestOtp(r.acc);
    },
    'tw-back': () => { Object.assign(S, { step: 'phone', otp: '', error: '', loginAccountId: null, otpChallenge: null }); render(); },
    'tw-verify': () => {
      const acc = S.loginAccountId ? A.ACCOUNTS.get(S.loginAccountId) : null;
      if (!acc || A.ACCOUNTS.primaryRole(acc) !== 'trader') { Object.assign(S, { step: 'phone', otpChallenge: null }); render(); return; }
      const v = A.ACCOUNTS.verifyOtpChallenge(S.otpChallenge, acc, acc.phone, S.otp);
      if (!v.ok) {
        if (v.reason === 'LOCKED') Object.assign(S, { step: 'phone', otpChallenge: null, error: 'Tài khoản đang tạm khóa. Vui lòng liên hệ Ban Quản lý chợ.' });
        else if (v.reason === 'EXPIRED') Object.assign(S, { otpChallenge: null, error: 'Mã OTP đã hết hạn. Vui lòng đăng nhập lại để nhận mã mới.' });
        else if (v.reason === 'NO_CHALLENGE') S.error = 'Mã OTP không còn hiệu lực. Vui lòng đăng nhập lại để nhận mã mới.';
        else S.error = 'Mã OTP không chính xác. Vui lòng kiểm tra lại.';
        render(); return;
      }
      A.ACCOUNTS.activateAfterOtp(acc); // chỉ Chờ kích hoạt → Đang hoạt động
      const def = A.ACCOUNTS.defaultTraderProfile(acc);
      Object.assign(S, { accountId: acc.id, traderId: def ? def.id : null, step: 'phone', otp: '', error: '', loginAccountId: null, otpChallenge: null });
      saveSession();
      location.hash = '#/trang-chu';
      render();
    },
    'tw-logout': () => logout('Đã đăng xuất'),
    // Mục "Đăng xuất" của sidebar (trader-portal) gọi auth-logout.
    'auth-logout': () => logout('Đã đăng xuất'),
    'tw-header-notifications': () => { S.headerPopover = S.headerPopover === 'notifications' ? null : 'notifications'; render(); },
    'tw-header-account': () => { S.headerPopover = S.headerPopover === 'account' ? null : 'account'; render(); },
    'tw-header-account-profile': () => {
      S.headerPopover = null;
      if (route() === 'tai-khoan') render(); else location.hash = '#/tai-khoan';
    },
    'tw-header-notification-open': el => {
      const t = me(), acc = t && traderAccount(t);
      if (!t || !acc) return;
      const notice = headerNotifications(t, acc).find(n => n.source === el.dataset.source && n.id === el.dataset.id);
      if (!notice) return;
      markHeaderNotificationRead(notice, acc.id);
      S.headerPopover = null;
      const destination = traderNotificationRoute(notice);
      if (route() === destination) render(); else location.hash = '#/' + destination;
    },
    'tw-bill': el => { S.openInv = S.openInv === el.dataset.id ? null : el.dataset.id; render(); },
    'tw-contract-select': el => { const t = me(); if (!t || !contractsOf(t).some(c => c.id === el.dataset.id)) return; S.contractSel = el.dataset.id; render(); },
    'tw-bill-open': el => { S.openInv = el.dataset.id; S.billFilter = 'all'; location.hash = '#/hoa-don'; },
    'tw-bill-filter': el => { S.billFilter = el.dataset.id; render(); },
    'tw-notice-filter': el => { S.noticeFilter = el.dataset.id; render(); },
    'tw-go': el => { location.hash = '#/' + el.dataset.id; },
    'tw-pdf': () => U.toast('Mở bản số hóa hợp đồng (PDF) – minh họa'),
    'tw-paid': () => {
      const t = me();
      if (!t) { logout('Phiên đăng nhập đã hết, vui lòng đăng nhập lại'); return; }
      if (S.paying) return;
      const list = unpaid(t).filter(i => (S.paySel || []).indexOf(i.id) !== -1);
      if (!list.length) { U.toast('Chọn ít nhất một khoản cần thanh toán'); return; }
      S.paying = true;
      try {
        const pays = A.applyPayment(list.map(i => i.id), U.sum(list, U.due), 'qr', SOURCE);
        S.lastPays = pays; S.paySel = null;
        render();
        U.toast('Ngân hàng báo có · đã ghi nhận ' + U.money(U.sum(pays, p => p.amount)));
      } catch (e) {
        console.error('[trader-web] applyPayment', e);
        U.toast('Không ghi nhận được thanh toán, vui lòng thử lại');
      } finally { S.paying = false; }
    },
    'tw-receipt-last': () => { if (S.lastPays) A.showReceipt(S.lastPays); },
    'tw-receipt': el => {
      const p = A.db.payments.find(x => x.id === el.dataset.id), t = me();
      // Đã đăng nhập: chỉ biên lai của mình. Tra cứu công khai: đúng biên lai vừa tra theo mã.
      const ok = p && ((t && p.traderId === t.id) || (route() === 'tra-cuu' && S.lookupResult && S.lookupResult.id === p.id));
      if (!ok) { U.toast('Không tìm thấy biên lai'); return; }
      A.showReceipt([p]);
    },
    'tw-lookup-go': () => {
      const code = String(S.lookup || '').trim().toUpperCase();
      if (!code) { U.toast('Vui lòng nhập mã tra cứu'); return; }
      S.lookupResult = A.db.payments.find(p => String(p.lookup || '').toUpperCase() === code) || 'none';
      render();
    },
    'tw-report-new': () => { const t = me(); if (t && t.stalls.length) openReportForm(t); },
    'tw-report': () => {
      const t = me();
      if (!t) { A.closeModal(); logout('Phiên đăng nhập đã hết, vui lòng đăng nhập lại'); return; }
      const stall = stallOf($('#tw-stall') && $('#tw-stall').value);
      if (!stall || t.stalls.indexOf(stall.id) === -1 || stall.market !== t.market) { U.toast('Điểm kinh doanh không thuộc tài khoản của bạn'); return; }
      const text = ($('#tw-text').value || '').trim();
      if (!text) { U.toast('Vui lòng nhập nội dung phản ánh'); return; }
      const title = text.length > 60 ? text.slice(0, 57) + '…' : text;
      const imgs = S.draftImages.slice();
      const i = A.addIncident(stall.id, $('#tw-cat').value, title, text, SOURCE, imgs.length > 0);
      // Giống màn quản lý: chỉ lưu tên ảnh vào images.report (không lưu base64); ảnh thật xem được trong phiên.
      i.images = { report: imgs.map(x => x.name), inspection: [], work: [] };
      if (imgs.length) S.sessionImages[i.id] = imgs.map(x => x.url);
      S.draftImages = [];
      A.save(); A.closeModal(); render();
      U.toast('Đã gửi ' + i.id + '. Ban Quản lý chợ đã tiếp nhận.');
    },
    'tw-inc': el => { const t = me(); if (t) openIncident(t, el.dataset.id); },
    'tw-image-remove': el => {
      const x = S.draftImages.splice(Number(el.dataset.n), 1)[0];
      if (x) URL.revokeObjectURL(x.url);
      const box = $('#tw-image-draft'); if (box) box.innerHTML = draftThumbs();
    },
    'tw-rate-pick': el => {
      const t = me(), i = A.db.incidents.find(x => x.id === el.dataset.id);
      if (!t || !i || i.traderId !== t.id || i.state !== 'hoanthanh') return;
      S.ratingDrafts[i.id] = Object.assign({}, S.ratingDrafts[i.id] || {}, { rating: Number(el.dataset.n) });
      openIncident(t, i.id);
    },
    'tw-rate-submit': el => {
      const t = me(), i = A.db.incidents.find(x => x.id === el.dataset.id);
      if (!t || !i || i.traderId !== t.id || i.state !== 'hoanthanh') return;
      const draft = S.ratingDrafts[i.id] || {};
      const rating = Number(draft.rating || 0);
      if (!rating) { U.toast('Vui lòng chọn số sao đánh giá.'); return; }
      const api = A.features.complaints || {};
      const ok = api.submitTraderRating ? api.submitTraderRating(i, t, rating, draft.comment || '', SOURCE) : false;
      if (!ok) { U.toast('Không thể lưu đánh giá phản ánh này.'); return; }
      delete S.ratingDrafts[i.id];
      const inModal = !!document.querySelector('#modal-root .modal');
      render();
      if (inModal) openIncident(t, i.id);
      U.toast('Cảm ơn bạn đã đánh giá. Phản ánh đã được đóng.');
    },
    'tw-rate': el => {
      A.ACT['tw-rate-pick'](el);
      A.ACT['tw-rate-submit'](el);
    }
  });

  document.addEventListener('click', e => {
    if (S.headerPopover && !e.target.closest('.tw-header-popover-anchor')) {
      S.headerPopover = null;
      render();
    }
  });
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && S.headerPopover) {
      S.headerPopover = null;
      render();
    }
  });

  loadSession();
})(window.APP);

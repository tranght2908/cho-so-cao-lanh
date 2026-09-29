/* Đăng nhập FE: SĐT + OTP mock, dùng A.ACCOUNTS/A.ui hiện có. */
(function (A) {
  'use strict';
  const U = A.U, ui = A.ui;
  // OTP mô phỏng của prototype (không gửi SMS thật).
  const DEMO_OTP = '123456';
  const now = () => new Date().toISOString();
  const initials = name => {
    const words = String(name || '').trim().split(/\s+/).filter(Boolean);
    return words.length > 1 ? (words[0][0] + words[words.length - 1][0]).toUpperCase() : (words[0] || '?').slice(0, 2).toUpperCase();
  };
  const accountStatus = acc => A.ACCOUNTS.authStatus(acc);
  const accountActive = acc => accountStatus(acc) === 'ACTIVE';
  const sessionDevice = () => { const p = (typeof navigator !== 'undefined' && navigator.platform) || ''; return /win/i.test(p) ? 'Windows' : /mac/i.test(p) ? 'macOS' : /linux/i.test(p) ? 'Linux' : /android/i.test(p) ? 'Android' : /iphone|ipad/i.test(p) ? 'iOS' : 'Chưa ghi nhận'; };
  const sessionBrowser = () => { const ua = (typeof navigator !== 'undefined' && navigator.userAgent) || ''; return /edg/i.test(ua) ? 'Microsoft Edge' : /chrome|crios/i.test(ua) ? 'Chrome' : /firefox/i.test(ua) ? 'Firefox' : /safari/i.test(ua) ? 'Safari' : 'Chưa ghi nhận'; };
  const createSessionMetadata = acc => ({ accountId: acc.id, device: sessionDevice(), browser: sessionBrowser(), locationLabel: '', loginAt: now() });
  const traderFor = acc => acc && acc.traderId && A.idx && A.idx.trader.get(acc.traderId);
  const avatarHtml = (acc, extraClass) => {
    const t = traderFor(acc), portrait = (t && t.docFiles && t.docFiles.avatar) || (acc && acc.avatar);
    if (portrait && portrait.dataUrl) return `<span class="avatar ${extraClass || ''} has-photo"><img src="${U.esc(portrait.dataUrl)}" alt=""></span>`;
    return `<span class="avatar ${extraClass || ''}">${U.esc(initials(acc && acc.fullName))}</span>`;
  };

  A.isDemoMode = () => { try { return localStorage.getItem('prototype-demo-mode') === 'true'; } catch (e) { return false; } };
  A.isLoggedIn = () => !!((ui.sessionAccountId && accountActive(A.ACCOUNTS.get(ui.sessionAccountId))) || (A.isDemoMode() && ui.currentDemoAccountId && accountActive(A.ACCOUNTS.get(ui.currentDemoAccountId))));
  A.currentAccount = function () {
    const session = ui.sessionAccountId && A.ACCOUNTS.get(ui.sessionAccountId);
    if (session && accountActive(session)) return session;
    if (A.isDemoMode()) {
      const demo = ui.currentDemoAccountId && A.ACCOUNTS.get(ui.currentDemoAccountId);
      return demo && accountActive(demo) ? demo : null;
    }
    return null;
  };
  const previousSaveUi = A.saveUi;
  A.saveUi = function () {
    try { localStorage.setItem('choso-caolanh-ui', JSON.stringify({ schemaVersion: A.RBAC_SCHEMA, currentDemoAccountId: ui.currentDemoAccountId, sessionAccountId: ui.sessionAccountId, sessionMetadata: ui.sessionMetadata, market: ui.market })); } catch (e) { previousSaveUi(); }
  };
  const previousLoad = A.load;
  A.load = function () {
    previousLoad();
    try {
      const stored = JSON.parse(localStorage.getItem('choso-caolanh-ui') || 'null');
      if (stored && stored.schemaVersion === A.RBAC_SCHEMA && stored.sessionAccountId) { ui.sessionAccountId = stored.sessionAccountId; ui.sessionMetadata = stored.sessionMetadata && stored.sessionMetadata.accountId === stored.sessionAccountId ? stored.sessionMetadata : null; }
    } catch (e) { ui.sessionAccountId = null; }
    if (!A.isLoggedIn()) { ui.sessionAccountId = null; ui.sessionMetadata = null; }
    if (A.isDemoMode() && !ui.currentDemoAccountId) {
      const firstDemo = A.ACCOUNTS.list().find(accountActive);
      ui.currentDemoAccountId = firstDemo ? firstDemo.id : null;
    }
    const acc = A.currentAccount();
    if (acc && A.ACCOUNTS.primaryRole(acc) === 'trader') Object.assign(ui.mini, { traderId: acc.traderId, step: 'app', tab: 'home', loginStep: 'phone' });
    A.syncAccountContext();
  };

  // ---- Giao diện đăng nhập: 1 khung 2 cột dùng chung cho bước SĐT và bước OTP. Chỉ đổi trình bày;
  // tra cứu tài khoản, OTP mô phỏng, khóa tài khoản và chuyển hướng sau đăng nhập giữ nguyên. ----
  // Cùng biểu tượng chợ với thanh bên (index.html .brand-logo), không dùng ảnh/logo bên ngoài.
  const AUTH_MARK = '<svg viewBox="0 0 32 32" aria-hidden="true"><path d="M5 12l2-6h18l2 6z" fill="#0089df"/><path d="M5 12h22v3a3.5 3.5 0 0 1-7 0 3.5 3.5 0 0 1-7 0 3.5 3.5 0 0 1-7 0z" fill="#4fb3ff"/><path d="M7 17v10h18V17" fill="#0b4a9e"/><rect x="13" y="20" width="6" height="7" fill="#fff"/></svg>';
  // Hình minh họa mảnh (đơn sắc) gợi sơ đồ dãy/sạp trong chợ — chỉ trang trí, không có dữ liệu.
  const AUTH_ART = '<svg class="auth-art" viewBox="0 0 320 120" aria-hidden="true"><g fill="none" stroke="currentColor" stroke-width="1.4"><path d="M20 44 40 18h240l20 26"/><path d="M20 44h280"/><path d="M34 44v64M286 44v64M20 108h280"/>' +
    [0, 1, 2, 3, 4, 5].map(i => `<rect x="${48 + i * 38}" y="58" width="28" height="20" rx="2"/><rect x="${48 + i * 38}" y="84" width="28" height="18" rx="2"/>`).join('') + '</g></svg>';
  function authBrandHtml() {
    return `<section class="auth-brand"><div class="auth-mark">${AUTH_MARK}</div>
      <div class="auth-eyebrow">Hệ thống quản lý</div><div class="auth-title">Chợ số<br>phường Cao Lãnh</div><div class="auth-province">Tỉnh Đồng Tháp</div>
      <p class="auth-desc">Quản lý tập trung hoạt động các chợ trên địa bàn phường.</p>${AUTH_ART}</section>`;
  }
  // Không có SĐT/email hỗ trợ chính thức trong dữ liệu dự án → không hiển thị số liên hệ nào; chỉ mở
  // danh sách chợ kèm địa chỉ đã có trong danh mục chợ (D.MARKETS).
  function authSupportHtml() {
    return `<div class="auth-support"><div class="auth-support-h"><span aria-hidden="true">?</span>Cần hỗ trợ?</div>
      <p>Chưa có tài khoản hoặc không đăng nhập được? Vui lòng liên hệ Ban Quản lý chợ nơi bạn đang kinh doanh.</p>
      <button type="button" class="btn link" data-act="auth-contact">Xem thông tin liên hệ</button></div>
      <div class="auth-proto">Phiên bản nguyên mẫu phục vụ trình diễn. Dữ liệu trong hệ thống là dữ liệu minh họa.</div>`;
  }
  function loginHtml() {
    const d = ui.auth || { step: 'phone', phone: '', otp: '', error: '' };
    const otp = d.otp || '';
    const error = d.error ? `<div class="auth-error" id="auth-error" role="alert">${U.esc(d.error)}</div>` : '';
    const invalid = d.error ? ' is-invalid" aria-invalid="true" aria-describedby="auth-error' : '';
    const form = d.step === 'otp'
      ? `<div class="auth-brand-label">Chợ số Cao Lãnh</div><h1>Xác thực OTP</h1><p class="auth-lead">Mã xác thực đã được gửi đến số điện thoại <b>${U.maskPhone(d.phone)}</b></p>
        <div class="field"><label id="auth-otp-label">Mã OTP *</label><div class="auth-otp" role="group" aria-labelledby="auth-otp-label">${[0, 1, 2, 3, 4, 5].map(i => `<input class="input${invalid}" inputmode="numeric" autocomplete="one-time-code" maxlength="1" data-auth-otp="${i}" value="${U.esc(otp[i] || '')}" aria-label="Số ${i + 1}">`).join('')}</div>${error}</div>
        <button class="btn primary auth-submit" data-act="auth-verify">Xác nhận</button>
        <div class="small muted auth-demo-otp">Prototype: đã tự điền OTP mô phỏng <b>${DEMO_OTP}</b>, không gửi SMS thật.</div>
        <div class="auth-links"><button class="btn link" data-act="auth-change-phone">← Đổi số điện thoại</button><button class="btn link" data-act="auth-resend">Gửi lại mã</button></div>`
      : `<div class="auth-brand-label">Chợ số Cao Lãnh</div><h1>Đăng nhập hệ thống</h1><p class="auth-lead">Sử dụng số điện thoại đã đăng ký để truy cập hệ thống.</p>
        <div class="field"><label for="auth-phone">Số điện thoại *</label><input id="auth-phone" class="input auth-input${invalid}" type="tel" inputmode="tel" autocomplete="tel" data-auth-phone value="${U.esc(d.phone || '')}" placeholder="Nhập số điện thoại">${error}</div>
        <button class="btn primary auth-submit" data-act="auth-continue">Tiếp tục</button>`;
    return `<div class="auth-shell"><div class="auth-panel">${authBrandHtml()}<section class="auth-form" aria-label="${d.step === 'otp' ? 'Xác thực OTP' : 'Đăng nhập hệ thống'}">${form}${authSupportHtml()}</section></div></div>`;
  }
  function bindInputs() {
    document.querySelectorAll('[data-auth-otp]').forEach(el => {
      el.addEventListener('input', () => {
        const d = ui.auth; d.otp = Array.from(document.querySelectorAll('[data-auth-otp]')).map(x => String(x.value || '').replace(/\D/g, '').slice(-1)).join('');
        if (el.value && Number(el.dataset.authOtp) < 5) document.querySelector(`[data-auth-otp="${Number(el.dataset.authOtp) + 1}"]`).focus();
      });
      // Enter = bấm "Xác nhận" (cùng action, không thêm luồng mới).
      el.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); A.ACT['auth-verify'](); } });
    });
    const phone = document.querySelector('[data-auth-phone]');
    if (phone) {
      phone.addEventListener('input', () => { ui.auth.phone = phone.value; ui.auth.error = ''; });
      phone.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); ui.auth.phone = phone.value; A.ACT['auth-continue'](); } });
    }
    const otpBoxes = Array.from(document.querySelectorAll('[data-auth-otp]'));
    const first = phone || otpBoxes.find(x => !x.value) || otpBoxes[otpBoxes.length - 1];
    if (first && first.focus) first.focus();
  }
  // Danh sách Ban Quản lý chợ: CHỈ dữ liệu đã có (tên chợ + địa chỉ trong danh mục chợ). Chưa có số
  // điện thoại/email chính thức nên hiển thị "chưa cấu hình", không tự đặt số.
  let authContactQuery = '';
  function authContactHtml() {
    const q = authContactQuery.trim().toLowerCase();
    const rows = A.effectiveMarkets().filter(m => !q || [m.name, m.address].join(' ').toLowerCase().includes(q));
    return A.mHead('Thông tin liên hệ Ban Quản lý chợ') + `<div class="modal-b auth-contact">
      <input class="input" data-in="auth-contact-search" placeholder="Tìm tên chợ..." value="${U.esc(authContactQuery)}" aria-label="Tìm tên chợ">
      <div class="auth-contact-list">${rows.length ? rows.map(m => `<div class="auth-contact-row"><b>${U.esc(m.name)}</b>${m.address ? `<small>${U.esc(m.address)}</small>` : ''}</div>`).join('') : '<div class="empty small">Không tìm thấy chợ phù hợp.</div>'}</div>
      <div class="note info">Số điện thoại và email liên hệ của Ban Quản lý chợ đang được cập nhật.</div></div>
      <div class="modal-f"><button class="btn" data-act="close">Đóng</button></div>`;
  }
  A.ACT['auth-contact'] = () => { authContactQuery = ''; A.modal(authContactHtml()); };
  A.IN['auth-contact-search'] = el => {
    authContactQuery = el.value;
    const list = document.querySelector('.auth-contact-list');
    if (!list) return A.modal(authContactHtml());
    const tmp = document.createElement('div'); tmp.innerHTML = authContactHtml();
    const fresh = tmp.querySelector('.auth-contact-list');
    list.innerHTML = fresh ? fresh.innerHTML : '';
  };
  A.showLogin = function () {
    document.body.classList.add('auth-required');
    ui.auth = ui.auth || { step: 'phone', phone: '', otp: '', error: '' };
    document.querySelector('#auth-root').innerHTML = loginHtml();
    bindInputs();
  };
  A.userHeaderHtml = function (acc) {
    const role = A.PERM.role(A.ACCOUNTS.primaryRole(acc));
    const open = ui.activeHeaderPopover === 'account';
    return `<div class="header-popover-anchor user-menu-anchor"><button class="user-menu-trigger" data-act="auth-user-menu" aria-expanded="${open}">${avatarHtml(acc)}<span><b>${U.esc(acc.fullName)}</b><small>${U.esc((role && role.name) || acc.title || '')}</small></span><span class="user-chevron">▾</span></button>${open ? userMenuHtml(acc) : ''}</div>`;
  };
  function userMenuHtml(acc) {
    const role = A.PERM.role(A.ACCOUNTS.primaryRole(acc));
    return `<div class="header-popover user-popover">${avatarHtml(acc, 'lg')}<div><b>${U.esc(acc.fullName)}</b><small>${U.esc((role && role.name) || acc.title || '')}</small><small>${U.esc(acc.organization || '')}</small></div><div class="user-popover-actions"><button data-act="auth-profile">Thông tin cá nhân</button><button data-act="auth-logout">Đăng xuất</button></div></div>`;
  }
  function completeLogin(acc) {
    if (accountStatus(acc) === 'PENDING_ACTIVATION') A.ACCOUNTS.update(acc.id, { status: 'ACTIVE', activatedAt: now() });
    const loginAt = now(); A.ACCOUNTS.update(acc.id, { lastLoginAt: loginAt });
    ui.sessionAccountId = acc.id; ui.currentDemoAccountId = null;
    ui.sessionMetadata = Object.assign(createSessionMetadata(acc), { loginAt });
    if (A.ACCOUNTS.primaryRole(acc) === 'trader') Object.assign(ui.mini, { traderId: acc.traderId, step: 'app', tab: 'home', loginStep: 'phone', loginPhone: null, loginTraderId: null });
    A.saveUi();
    ui.auth = { step: 'phone', phone: '', otp: '', error: '' };
    document.body.classList.remove('auth-required');
    document.body.classList.toggle('trader-session', A.ACCOUNTS.primaryRole(acc) === 'trader');
    A.go(A.ACCOUNTS.primaryRole(acc) === 'trader' ? 'mini-app' : (A.firstAccessibleScreen() || 'tong-quan'));
  }
  const previousRoute = A.route;
  A.route = function () {
    if (!A.isLoggedIn()) { A.showLogin(); return; }
    document.body.classList.remove('auth-required');
    document.body.classList.toggle('trader-session', A.ACCOUNTS.primaryRole(A.currentAccount()) === 'trader');
    previousRoute();
  };
  const previousRender = A.render;
  A.render = function (scroll) { if (!A.isLoggedIn()) { A.showLogin(); return; } previousRender(scroll); };

  A.ACT['auth-continue'] = () => {
    const d = ui.auth || {}, acc = A.ACCOUNTS.byPhone(d.phone);
    if (!acc) { d.error = 'Số điện thoại chưa được đăng ký. Vui lòng liên hệ Ban Quản lý chợ.'; return A.showLogin(); }
    if (accountStatus(acc) === 'LOCKED') { d.error = 'Tài khoản hiện đang bị khóa. Vui lòng liên hệ Ban Quản lý chợ.'; return A.showLogin(); }
    // Prototype: tự điền sẵn OTP mô phỏng để trình diễn nhanh; người dùng vẫn bấm "Xác nhận".
    Object.assign(d, { step: 'otp', otp: DEMO_OTP, error: '' }); A.showLogin();
  };
  A.ACT['auth-verify'] = () => {
    const d = ui.auth || {}, acc = A.ACCOUNTS.byPhone(d.phone);
    if (!acc || accountStatus(acc) === 'LOCKED') { d.step = 'phone'; d.error = 'Tài khoản hiện không thể đăng nhập. Vui lòng liên hệ Ban Quản lý chợ.'; return A.showLogin(); }
    if (d.otp !== DEMO_OTP) { d.error = 'Mã OTP không chính xác. Vui lòng kiểm tra lại.'; return A.showLogin(); }
    completeLogin(acc);
  };
  A.ACT['auth-resend'] = () => { ui.auth.error = ''; U.toast('Đã gửi lại OTP mô phỏng đến ' + U.maskPhone(ui.auth.phone) + '.'); };
  A.ACT['auth-change-phone'] = () => { Object.assign(ui.auth, { step: 'phone', otp: '', error: '' }); A.showLogin(); };
  A.ACT['auth-user-menu'] = () => { ui.activeHeaderPopover = ui.activeHeaderPopover === 'account' ? null : 'account'; ui.personalNotificationsExpanded = false; A.render(); };
  // "Thông tin cá nhân": màn hồ sơ của CHÍNH tài khoản đang đăng nhập (accounts/profile.js).
  A.ACT['auth-profile'] = () => { ui.activeHeaderPopover = null; A.closeModal(); if (A.currentAccount()) { ui.profile = { mode: 'self', accountId: null, tab: 'info' }; if (A.openTraderPortalProfile && A.openTraderPortalProfile()) return; A.go('thong-tin-ca-nhan'); } };
  A.ACT['auth-logout'] = () => { ui.activeHeaderPopover = null; ui.sessionAccountId = null; ui.currentDemoAccountId = null; ui.sessionMetadata = null; A.saveUi(); A.closeModal(); document.body.classList.remove('trader-session'); ui.auth = { step: 'phone', phone: '', otp: '', error: '' }; A.showLogin(); };
  A.ACT['mini-logout'] = () => A.ACT['auth-logout']();
})(window.APP);

/* Đăng nhập FE: SĐT + OTP mock, dùng A.ACCOUNTS/A.ui hiện có. */
(function (A) {
  'use strict';
  const U = A.U, ui = A.ui;
  const now = () => new Date().toISOString();
  const initials = name => {
    const words = String(name || '').trim().split(/\s+/).filter(Boolean);
    return words.length > 1 ? (words[0][0] + words[words.length - 1][0]).toUpperCase() : (words[0] || '?').slice(0, 2).toUpperCase();
  };
  const accountStatus = acc => A.ACCOUNTS.authStatus(acc);
  const accountActive = acc => accountStatus(acc) === 'ACTIVE';
  const traderFor = acc => acc && acc.traderId && A.idx && A.idx.trader.get(acc.traderId);
  const avatarHtml = (acc, extraClass) => {
    const t = traderFor(acc), portrait = t && t.docFiles && t.docFiles.avatar;
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
    try { localStorage.setItem('choso-caolanh-ui', JSON.stringify({ schemaVersion: A.RBAC_SCHEMA, currentDemoAccountId: ui.currentDemoAccountId, sessionAccountId: ui.sessionAccountId, market: ui.market })); } catch (e) { previousSaveUi(); }
  };
  const previousLoad = A.load;
  A.load = function () {
    previousLoad();
    try {
      const stored = JSON.parse(localStorage.getItem('choso-caolanh-ui') || 'null');
      if (stored && stored.schemaVersion === A.RBAC_SCHEMA && stored.sessionAccountId) ui.sessionAccountId = stored.sessionAccountId;
    } catch (e) { ui.sessionAccountId = null; }
    if (!A.isLoggedIn()) ui.sessionAccountId = null;
    if (A.isDemoMode() && !ui.currentDemoAccountId) {
      const firstDemo = A.ACCOUNTS.list().find(accountActive);
      ui.currentDemoAccountId = firstDemo ? firstDemo.id : null;
    }
    const acc = A.currentAccount();
    if (acc && A.ACCOUNTS.primaryRole(acc) === 'trader') Object.assign(ui.mini, { traderId: acc.traderId, step: 'app', tab: 'home', loginStep: 'phone' });
    A.syncAccountContext();
  };

  function loginHtml() {
    const d = ui.auth || { step: 'phone', phone: '', otp: '', error: '' };
    const otp = d.otp || '';
    const error = d.error ? `<div class="auth-error">${U.esc(d.error)}</div>` : '';
    if (d.step === 'otp') return `<div class="auth-shell"><div class="auth-card"><div class="auth-logo">Chợ số Cao Lãnh</div><h1>Xác thực OTP</h1><p>Mã xác thực đã được gửi đến<br><b>${U.maskPhone(d.phone)}</b></p>${error}<div class="auth-otp">${[0,1,2,3,4,5].map(i => `<input class="input" inputmode="numeric" maxlength="1" data-auth-otp="${i}" value="${U.esc(otp[i] || '')}" aria-label="Số ${i + 1}">`).join('')}</div><button class="btn primary auth-submit" data-act="auth-verify">Xác nhận</button><div class="small muted auth-demo-otp">Prototype: OTP mô phỏng là <b>123456</b>, không gửi SMS thật.</div><div class="auth-links"><button class="btn link" data-act="auth-resend">Gửi lại</button><button class="btn link" data-act="auth-change-phone">← Đổi số điện thoại</button></div></div></div>`;
    return `<div class="auth-shell"><div class="auth-card"><div class="auth-logo">Chợ số Cao Lãnh</div><h1>Đăng nhập</h1><p>Sử dụng số điện thoại đã đăng ký<br>với Ban Quản lý chợ.</p>${error}<div class="field"><label>Số điện thoại</label><input class="input" inputmode="tel" data-auth-phone value="${U.esc(d.phone || '')}" placeholder="092 xxx xxxx"></div><button class="btn primary auth-submit" data-act="auth-continue">Tiếp tục</button><div class="auth-help">Bạn chưa có tài khoản?<br>Vui lòng liên hệ Ban Quản lý chợ.</div></div></div>`;
  }
  function bindInputs() {
    document.querySelectorAll('[data-auth-otp]').forEach(el => el.addEventListener('input', () => {
      const d = ui.auth; d.otp = Array.from(document.querySelectorAll('[data-auth-otp]')).map(x => String(x.value || '').replace(/\D/g, '').slice(-1)).join('');
      if (el.value && Number(el.dataset.authOtp) < 5) document.querySelector(`[data-auth-otp="${Number(el.dataset.authOtp) + 1}"]`).focus();
    }));
    const phone = document.querySelector('[data-auth-phone]');
    if (phone) phone.addEventListener('input', () => { ui.auth.phone = phone.value; ui.auth.error = ''; });
  }
  A.showLogin = function () {
    document.body.classList.add('auth-required');
    ui.auth = ui.auth || { step: 'phone', phone: '', otp: '', error: '' };
    document.querySelector('#auth-root').innerHTML = loginHtml();
    bindInputs();
  };
  A.userHeaderHtml = function (acc) {
    const role = A.PERM.role(A.ACCOUNTS.primaryRole(acc));
    return `<button class="user-menu-trigger" data-act="auth-user-menu">${avatarHtml(acc)}<span><b>${U.esc(acc.fullName)}</b><small>${U.esc((role && role.name) || acc.title || '')}</small></span><span class="user-chevron">▾</span></button>`;
  };
  function userMenuHtml(acc) {
    const t = traderFor(acc), role = A.PERM.role(A.ACCOUNTS.primaryRole(acc));
    return `<div class="user-popover">${avatarHtml(acc, 'lg')}<div><b>${U.esc(acc.fullName)}</b><small>${U.esc((role && role.name) || acc.title || '')}</small><small>${U.esc(acc.organization || '')}</small></div><div class="user-popover-actions"><button data-act="auth-profile">${t ? 'Hồ sơ của tôi' : 'Thông tin tài khoản'}</button><button data-act="auth-logout">Đăng xuất</button></div></div>`;
  }
  function completeLogin(acc) {
    if (accountStatus(acc) === 'PENDING_ACTIVATION') A.ACCOUNTS.update(acc.id, { status: 'ACTIVE', activatedAt: now() });
    A.ACCOUNTS.update(acc.id, { lastLoginAt: now() });
    ui.sessionAccountId = acc.id; ui.currentDemoAccountId = null;
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
    Object.assign(d, { step: 'otp', otp: '', error: '' }); A.showLogin();
  };
  A.ACT['auth-verify'] = () => {
    const d = ui.auth || {}, acc = A.ACCOUNTS.byPhone(d.phone);
    if (!acc || accountStatus(acc) === 'LOCKED') { d.step = 'phone'; d.error = 'Tài khoản hiện không thể đăng nhập. Vui lòng liên hệ Ban Quản lý chợ.'; return A.showLogin(); }
    if (d.otp !== '123456') { d.error = 'Mã OTP không chính xác. Vui lòng kiểm tra lại.'; return A.showLogin(); }
    completeLogin(acc);
  };
  A.ACT['auth-resend'] = () => { ui.auth.error = ''; U.toast('Đã gửi lại OTP mô phỏng đến ' + U.maskPhone(ui.auth.phone) + '.'); };
  A.ACT['auth-change-phone'] = () => { Object.assign(ui.auth, { step: 'phone', otp: '', error: '' }); A.showLogin(); };
  A.ACT['auth-user-menu'] = () => { const root = document.querySelector('#modal-root'), acc = A.currentAccount(); if (root && acc) root.innerHTML = `<div class="user-popover-wrap" data-act="close">${userMenuHtml(acc)}</div>`; };
  A.ACT['auth-profile'] = () => { const acc = A.currentAccount(); A.closeModal(); if (acc && A.ACCOUNTS.primaryRole(acc) === 'trader') A.go('mini-app'); else A.modal(A.mHead('Thông tin tài khoản') + `<div class="modal-b"><dl class="kv"><dt>Họ tên</dt><dd>${U.esc(acc.fullName)}</dd><dt>Số điện thoại</dt><dd>${U.esc(acc.phone || 'Chưa cập nhật')}</dd><dt>Đơn vị</dt><dd>${U.esc(acc.organization || '')}</dd></dl></div><div class="modal-f"><button class="btn primary" data-act="close">Đóng</button></div>`); };
  A.ACT['auth-logout'] = () => { ui.sessionAccountId = null; ui.currentDemoAccountId = null; A.saveUi(); A.closeModal(); document.body.classList.remove('trader-session'); ui.auth = { step: 'phone', phone: '', otp: '', error: '' }; A.showLogin(); };
  A.ACT['mini-logout'] = () => A.ACT['auth-logout']();
})(window.APP);

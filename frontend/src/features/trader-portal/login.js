/* Luồng liên thông hồ sơ → hợp đồng → điểm KD → tài khoản → OTP.
 * Prototype FE: chỉ điều phối các nguồn dữ liệu hiện hữu A.db/A.ACCOUNTS. */
(function (A) {
  'use strict';
  const U = A.U, ui = A.ui;
  const active = c => c && c.status === 'ACTIVE';
  const trader = id => A.idx.trader.get(id);
  const stall = id => A.idx.stall.get(id);
  const accounts = A.features.accounts.service;
  const accountFor = id => accounts.byTraderId(id);
  const contracts = A.features.contracts.service;
  const marketName = id => U.mShort(id);



  // OTP mock chỉ cho đăng nhập tài khoản đã được Admin tạo; không tự sinh account từ Mini App.
  A.ACT['mini-login-verify'] = () => {
    const m = ui.mini || {}, t = trader(m.loginTraderId);
    if (!t) { m.loginStep = 'phone'; A.render(); return; }
    const acc = accountFor(t.id);
    if (!acc) return U.toast('Tài khoản chưa được kích hoạt. Vui lòng liên hệ Ban Quản lý chợ.');
    if (acc.status !== 'active') { m.loginStep = 'locked'; A.render(); return; }
    Object.assign(m, { traderId: t.id, step: 'app', tab: 'home', loginStep: 'phone', loginPhone: null, loginTraderId: null }); A.save(); A.render();
  };
})(window.APP);

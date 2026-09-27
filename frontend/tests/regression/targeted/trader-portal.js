// Targeted suite: effective trader portal/OTP and collector portal actions.
// Its expectation is explicitly recorded from b9f5c74 before portal migration.
module.exports = function traderPortal(r) {
  const { snap, login, inp, act, go, A } = r;
  const trader = () => A.idx.trader.get('TTD-CQ') || A.db.traders.find(x => x.market === 'TTD' && x.phone);

  login('AC-CHI-QUYET', 'TTD'); go('mini-app');
  snap('portal login render', () => A.current);
  const t = trader();
  snap('portal phone lookup', () => { inp('mini-login-phone', t && t.phone || ''); act('mini-login-lookup', {}); return A.ui.mini.loginStep; });
  snap('portal otp send', () => act('mini-login-send-otp', {}));
  snap('portal otp verify', () => act('mini-login-verify', {}));
  snap('portal trader home', () => A.current);
  ['bills', 'contract', 'register', 'notice', 'report', 'home'].forEach(tab => snap('portal tab ' + tab, () => act('mini-tab', { id: tab })));
  snap('portal logout', () => act('mini-logout', {}));

  login('AC-NV07', 'TTD'); go('mini-app');
  snap('portal collector render', () => A.current);
  snap('portal collector home', () => act('mini-collector-home', {}));
};

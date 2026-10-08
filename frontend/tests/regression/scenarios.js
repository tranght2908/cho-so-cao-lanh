// Behavioural replay (229 steps, unchanged from the Phase 13 master-run harness).
// runScenarios(root) replays the scenarios against a frontend root and returns the trace.
// Each step records: error, save count, toasts, hashes of A.db / account store / sessionStorage /
// modal HTML / view HTML / return value, and the storage key list. `_modal`/`_view` keep the raw
// HTML for diff diagnostics only; they are not part of the persisted baseline.
const crypto = require('crypto');
const { createApp } = require('./harness');

function runScenarios(root) {
  const h = createApp(root);
  const A = h.A, ui = A.ui;
  const hash = s => crypto.createHash('sha1').update(String(s)).digest('hex').slice(0, 12);
  const steps = [];
  let lastSaves = 0, lastToasts = 0;
  function snap(name, fn) {
    let err = null, ret;
    try { ret = fn(); h.flush(); } catch (e) { err = String(e && e.message || e); }
    const rec = {
      name, err,
      saves: h.trace.saves - lastSaves,
      toasts: h.trace.toasts.slice(lastToasts),
      db: hash(JSON.stringify(A.db)),
      accounts: hash(JSON.stringify(A.ACCOUNTS.list())),
      storageKeys: Array.from(h.localStorage._m.keys()).sort().concat(Array.from(h.sessionStorage._m.keys()).map(k => 'session:' + k)),
      session: hash(JSON.stringify(Array.from(h.sessionStorage._m.entries()))),
      modal: hash(h.modal()), view: hash(h.view()),
      ret: ret === undefined ? undefined : hash(JSON.stringify(ret)),
      _modal: h.modal(), _view: h.view()
    };
    lastSaves = h.trace.saves; lastToasts = h.trace.toasts.length;
    steps.push(rec);
    return ret;
  }
  const login = (acc, market) => { ui.sessionAccountId = acc; ui.market = market; A.syncAccountContext(); };
  const routes = ['tong-quan', 'danh-muc-cho', 'mat-bang', 'diem-kd', 'tai-san', 'phien-cho', 'tieu-thuong', 'hop-dong', 'cau-hinh-gia', 'tai-khoan-ngan-hang', 'dien-nuoc', 'phai-thu', 'thu-tien', 'doi-soat', 'cong-no', 'su-co', 'thong-bao', 'bao-cao', 'tai-khoan', 'cai-dat', 'mini-app'];

  // 1. Route rendering for admin in CL and TTD, and ward leader.
  [['AC-QT01', 'CL'], ['AC-QT01', 'TTD'], ['AC-LD01', 'CL'], ['AC-NV01', 'CL'], ['AC-NV07', 'TTD']].forEach(([acc, mk]) => {
    login(acc, mk);
    routes.forEach(r => snap(`route ${acc} ${mk} ${r}`, () => { h.go(r); return A.current; }));
  });
  login('AC-NV01', 'CL'); h.go('tieu-thuong');

  // 2. Derived workflow states.
  snap('needsContract CL', () => A.features.contracts.service.tradersWithPendingRental('CL').map(t => t.id));
  snap('needsAccount', () => A.features.accounts.service.tradersNeedingAccount().map(t => t.id));

  // 3. Trader detail + edit (Phase 6 surface).
  const clTrader = A.db.traders.find(t => t.market === 'CL' && t.stalls.length);
  snap('trader drawer', () => h.act('trader', { id: clTrader.id }));
  snap('trader edit open', () => h.act('tt-edit-open', { id: clTrader.id }));
  snap('trader edit save', () => { h.input('#tte-name', clTrader.name + ' X'); h.input('#tte-idno', clTrader.idNo); h.input('#tte-phone', clTrader.phone); h.input('#tte-idtype', 'CCCD'); h.act('tt-edit-save', { id: clTrader.id }); });

  // 4. Contract list/detail reads.
  h.go('hop-dong');
  snap('hop-dong view', () => h.view());
  ['UPCOMING', 'ACTIVE', 'EXPIRED', 'LEGACY'].forEach(v => snap('ctw-status ' + v, () => A.CH['ctw-status']({ value: v })));
  snap('ctw-clear', () => h.act('ctw-clear', {}));
  snap('ctw-q', () => A.IN['ctw-q']({ value: 'hđ-cl' }));
  snap('ctw-q clear', () => A.IN['ctw-q']({ value: '' }));
  const someContract = A.db.contracts.find(c => c.market === 'CL' && c.status === 'ACTIVE');
  snap('ct-view', () => h.act('ct-view', { id: someContract.id }));
  snap('trader drawer w/ contracts', () => h.act('trader', { id: someContract.traderId }));

  // 7. Profile create + contract CTA.
  snap('tt-new', () => h.act('tt-new', {}));
  snap('wf-profile-save', () => { ['name', 'phone', 'idno', 'address', 'cat'].forEach((k, i) => { const e = h.el('#p' + k); e.value = ['Lê Văn Test', '0911222333', '087000111222', 'Cao Lãnh', 'Rau'][i]; A.IN['wf-p-' + k](e); }); h.act('wf-profile-save', {}); });
  const created = A.db.traders[A.db.traders.length - 1];
  snap('wf-profile-contract', () => h.act('wf-profile-contract', { id: created.id }));
  h.go('hop-dong');

  // 5. Contract create — the only flow: rental item pending_contract → workspace form → batch create.
  snap('ct-new (toolbar)', () => h.act('ct-new', {}));
  const newTrader = created;
  const vacant = A.features.businessPoints.service.availablePoints('CL', '2026-05-15', '2027-05-14');
  A.features.traders.service.setRentalDraft(newTrader.id, [{ pointId: vacant[0].id, charges: { land: true }, feeRefs: {} }]);
  snap('ct-new (trader)', () => h.act('ct-new', { trader: newTrader.id }));
  snap('ctw-submit invalid', () => h.act('ctw-submit', {}));
  snap('ctw-submit', () => { A.CH['ctw-row']({ dataset: { id: vacant[0].id, k: 'start' }, value: '2026-05-15' }); A.CH['ctw-row']({ dataset: { id: vacant[0].id, k: 'end' }, value: '2027-05-14' }); h.act('ctw-submit', {}); });
  snap('after create: records', () => { const c = A.db.contracts[A.db.contracts.length - 1], st = A.idx.stall.get(vacant[0].id), t = A.idx.trader.get(newTrader.id); return { c, s: { usageStatus: st.usageStatus, traderId: st.traderId, contractId: st.contractId }, t: { status: t.status, stalls: t.stalls, rentalDraft: t.rentalDraft } }; });
  snap('after create: needsContract', () => A.features.contracts.service.tradersWithPendingRental('CL').map(t => t.id));
  snap('after create: needsAccount', () => A.features.accounts.service.tradersNeedingAccount().map(t => t.id));
  snap('ctw-submit duplicate', () => h.act('ctw-submit', {}));
  h.go('hop-dong');

  // 6. Account readiness.
  login('AC-QT01', 'CL'); h.go('tai-khoan');
  snap('wf-account-open', () => h.act('wf-account-open', { id: newTrader.id }));
  snap('wf-account-create', () => h.act('wf-account-create', { id: newTrader.id }));
  snap('after account: needsAccount', () => A.features.accounts.service.tradersNeedingAccount().map(t => t.id));
  snap('wf-send-activation', () => h.act('wf-send-activation', { id: newTrader.id }));

  // 8. Print (the only remaining contract action; renew / terminate / liquidate / signed-copy UI retired 10/2026).
  login('AC-NV01', 'CL');
  h.go('hop-dong');
  const c2 = A.db.contracts.find(c => c.market === 'CL' && c.status === 'ACTIVE' && c.id !== someContract.id);
  snap('ct-print', () => h.act('ct-print', { id: c2.id }));
  snap('final needsContract', () => A.features.contracts.service.tradersWithPendingRental('CL').map(t => t.id));
  snap('final needsAccount', () => A.features.accounts.service.tradersNeedingAccount().map(t => t.id));

  // 10. Re-render every route after the mutations (CL + TTD).
  [['AC-QT01','CL'], ['AC-QT01','TTD'], ['AC-NV01','CL']].forEach(([acc, mk]) => { login(acc, mk); routes.forEach(r => snap(`post route ${acc} ${mk} ${r}`, () => { h.go(r); return A.current; })); });

  // 11. Reload from persisted storage: state must round-trip.
  const persisted = {}; h.localStorage._m.forEach((v, k) => { persisted[k] = v; });
  const h2 = createApp(root, { storage: persisted });
  steps.push({ name: 'reload db equal', err: null, ret: hash(JSON.stringify(h2.A.db)) === hash(JSON.stringify(A.db)) ? 'EQUAL' : 'DIFF' });

  return { steps, totalSaves: h.trace.saves };
}

module.exports = { runScenarios };

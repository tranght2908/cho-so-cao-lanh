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
  snap('needsContract CL', () => A.WORKFLOW.needsContract('CL').map(t => t.id));
  snap('needsAccount', () => A.WORKFLOW.needsAccount().map(t => t.id));

  // 3. Trader detail + edit (Phase 6 surface).
  const clTrader = A.db.traders.find(t => t.market === 'CL' && t.stalls.length);
  snap('trader drawer', () => h.act('trader', { id: clTrader.id }));
  snap('trader edit open', () => h.act('tt-edit-open', { id: clTrader.id }));
  snap('trader edit save', () => { h.input('#tte-name', clTrader.name + ' X'); h.input('#tte-idno', clTrader.idNo); h.input('#tte-phone', clTrader.phone); h.input('#tte-idtype', 'CCCD'); h.act('tt-edit-save', { id: clTrader.id }); });

  // 4. Contract list/detail reads.
  h.go('hop-dong');
  snap('hop-dong view', () => h.view());
  ['all', 'active', '30', '15', 'end'].forEach(tab => snap('hd-tab ' + tab, () => h.act('hd-tab', { id: tab })));
  snap('hd-status chamdut', () => { const e = h.el('#tmp'); e.value = 'chamdut'; A.CH['hd-status'](e); });
  snap('hd-clear', () => h.act('hd-clear-filters', {}));
  snap('hd-search', () => { const e = h.el('#tmp2'); e.value = 'hđ-cl'; A.IN['hd-search'](e); });
  snap('hd-search clear', () => { const e = h.el('#tmp2'); e.value = ''; A.IN['hd-search'](e); });
  const someContract = A.db.contracts.find(c => c.market === 'CL' && c.status === 'hieuluc');
  snap('ct-view', () => h.act('ct-view', { id: someContract.id }));
  snap('ct-copy-view', () => h.act('ct-copy-view', { id: someContract.id, file: '0' }));
  snap('trader drawer w/ contracts', () => h.act('trader', { id: someContract.traderId }));

  // 7. Profile create + contract CTA.
  snap('tt-new', () => h.act('tt-new', {}));
  snap('wf-profile-save', () => { ['name', 'phone', 'idno', 'address', 'cat'].forEach((k, i) => { const e = h.el('#p' + k); e.value = ['Lê Văn Test', '0911222333', '087000111222', 'Cao Lãnh', 'Rau'][i]; A.IN['wf-p-' + k](e); }); h.act('wf-profile-save', {}); });
  const created = A.db.traders[A.db.traders.length - 1];
  snap('wf-profile-contract', () => h.act('wf-profile-contract', { id: created.id }));
  h.go('hop-dong');

  // 5. Contract create (effective workflow path).
  snap('ct-new (toolbar)', () => h.act('ct-new', {}));
  const nc = A.WORKFLOW.needsContract('CL');
  const newTrader = nc[0];
  snap('wf-contract-open', () => h.act('wf-contract-open', { id: newTrader && newTrader.id }));
  // v16: occupancy is derived (stall.status is operational only).
  const vacant = A.db.stalls.filter(s => s.market === 'CL' && A.pointDisplayStatus(s) === 'trong' && !A.db.contracts.some(c => c.status === 'hieuluc' && c.stallId === s.id));
  snap('wf-contract-file', () => { h.setFiles([{ name: 'scan1.jpg', type: 'image/jpeg', size: 10 }]); h.act('wf-contract-file', {}); });
  snap('wf-contract-save invalid', () => { h.input('#wf-ct-trader', newTrader.id); h.input('#wf-ct-stall', vacant[0].id); h.input('#wf-ct-start', '2026-05-15'); h.input('#wf-ct-end', '2026-01-01'); h.act('wf-contract-save', {}); });
  snap('wf-contract-save', () => { h.input('#wf-ct-trader', newTrader.id); h.input('#wf-ct-stall', vacant[0].id); h.input('#wf-ct-start', '2026-05-15'); h.input('#wf-ct-end', '2027-05-14'); h.input('#wf-ct-monthly', '1500000'); h.input('#wf-ct-fees', 'Vệ sinh: 50000\nBảo vệ: 30000'); h.act('wf-contract-save', {}); });
  snap('after create: records', () => { const c = A.db.contracts[A.db.contracts.length - 1], s = A.idx.stall.get(vacant[0].id), t = A.idx.trader.get(newTrader.id); return { c, s: { status: s.status, traderId: s.traderId, contractId: s.contractId, history: s.history }, tStalls: t.stalls, recent: A.WORKFLOW.isRecentPoint(s.id), idx: A.idx.contract.get(c.id) === c }; });
  snap('after create: needsContract', () => A.WORKFLOW.needsContract('CL').map(t => t.id));
  snap('after create: needsAccount', () => A.WORKFLOW.needsAccount().map(t => t.id));
  snap('wf-contract-save duplicate', () => { h.act('wf-contract-open', { id: newTrader.id }); h.input('#wf-ct-trader', newTrader.id); h.input('#wf-ct-stall', vacant[0].id); h.input('#wf-ct-start', '2026-05-15'); h.input('#wf-ct-end', '2027-05-14'); h.act('wf-contract-save', {}); });
  snap('wf-go-stall', () => h.act('wf-go-stall', { id: vacant[0].id }));
  h.go('hop-dong');

  // 6. Account readiness.
  login('AC-QT01', 'CL'); h.go('tai-khoan');
  snap('wf-account-open', () => h.act('wf-account-open', { id: newTrader.id }));
  snap('wf-account-create', () => h.act('wf-account-create', { id: newTrader.id }));
  snap('after account: needsAccount', () => A.WORKFLOW.needsAccount().map(t => t.id));
  snap('wf-send-activation', () => h.act('wf-send-activation', { id: newTrader.id }));

  // 8. Renew (opens create form), extend/end aliases, copy add, print.
  login('AC-NV01', 'CL');
  h.go('hop-dong');
  const c2 = A.db.contracts.find(c => c.market === 'CL' && c.status === 'hieuluc' && c.id !== someContract.id);
  snap('ct-renew', () => h.act('ct-renew', { id: c2.id }));
  snap('ct-extend alias', () => h.act('ct-extend', { id: c2.id }));
  snap('ct-copy-add', () => { h.setFiles([{ name: 'signed-p1.jpg', type: 'image/jpeg', size: 5 }]); h.act('ct-copy-add', { id: c2.id }); });
  snap('ct-print', () => h.act('ct-print', { id: c2.id }));

  // 9. Terminate then liquidate a contract without debt.
  const noDebt = A.db.contracts.find(c => c.market === 'CL' && c.status === 'hieuluc' && c.id !== c2.id && !A.db.invoices.some(i => i.contractId === c.id && i.status !== 'paid'));
  snap('ct-terminate open', () => h.act('ct-terminate', { id: noDebt.id }));
  snap('ct-terminate-file', () => { h.setFiles([{ name: 'bb.pdf', type: 'application/pdf', size: 3 }]); h.act('ct-terminate-file', { id: noDebt.id }); });
  snap('ct-terminate-save invalid', () => { h.input('#ct-stop-reason', ''); h.input('#ct-stop-date', '2026-05-15'); h.input('#ct-stop-detail', ''); h.act('ct-terminate-save', { id: noDebt.id }); });
  snap('ct-terminate-save', () => { h.input('#ct-stop-reason', 'Tiểu thương xin nghỉ'); h.input('#ct-stop-date', '2026-05-15'); h.input('#ct-stop-detail', 'Nghỉ kinh doanh'); h.input('#ct-stop-note', 'ghi chú'); h.act('ct-terminate-save', { id: noDebt.id }); });
  snap('after terminate: records', () => { const c = A.idx.contract.get(noDebt.id), s = A.idx.stall.get(c.stallId), t = A.idx.trader.get(c.traderId); return { c, s: s && { status: s.status, traderId: s.traderId, contractId: s.contractId }, tStalls: t && t.stalls }; });
  snap('ct-liquidate open', () => h.act('ct-liquidate', { id: noDebt.id }));
  ['pointReturned', 'conditionChecked', 'damagesRecorded', 'compensationResolved', 'keysHandedOver', 'minutesPrepared', 'minutesSigned'].forEach(k => snap('ct-liquidate-toggle ' + k, () => h.act('ct-liquidate-toggle', { id: noDebt.id, key: k }, { checked: true })));
  snap('ct-liquidate-save missing copy', () => h.act('ct-liquidate-save', { id: noDebt.id }));
  snap('ct-liquidate-copy-add', () => { h.setFiles([{ name: 'tl.jpg', type: 'image/jpeg', size: 4 }]); h.act('ct-liquidate-copy-add', { id: noDebt.id }); });
  snap('ct-liquidate-save', () => { h.input('#ct-liquidate-note', 'Đã bàn giao'); h.act('ct-liquidate-save', { id: noDebt.id }); });
  snap('after liquidate: records', () => { const c = A.idx.contract.get(noDebt.id); return { c }; });
  const debtC = A.db.contracts.find(c => c.status === 'hieuluc' && A.db.invoices.some(i => i.contractId === c.id && i.status !== 'paid'));
  snap('ct-liquidate active (not expired)', () => debtC && h.act('ct-liquidate', { id: debtC.id }));
  snap('ct-end alias', () => debtC && h.act('ct-end', { id: debtC.id }));
  snap('final needsContract', () => A.WORKFLOW.needsContract('CL').map(t => t.id));
  snap('final needsAccount', () => A.WORKFLOW.needsAccount().map(t => t.id));

  // 10. Re-render every route after the mutations (CL + TTD).
  [['AC-QT01','CL'], ['AC-QT01','TTD'], ['AC-NV01','CL']].forEach(([acc, mk]) => { login(acc, mk); routes.forEach(r => snap(`post route ${acc} ${mk} ${r}`, () => { h.go(r); return A.current; })); });

  // 11. Reload from persisted storage: state must round-trip.
  const persisted = {}; h.localStorage._m.forEach((v, k) => { persisted[k] = v; });
  const h2 = createApp(root, { storage: persisted });
  steps.push({ name: 'reload db equal', err: null, ret: hash(JSON.stringify(h2.A.db)) === hash(JSON.stringify(A.db)) ? 'EQUAL' : 'DIFF' });

  return { steps, totalSaves: h.trace.saves };
}

module.exports = { runScenarios };

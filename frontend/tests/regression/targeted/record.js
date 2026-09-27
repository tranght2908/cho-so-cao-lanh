// Step recorder for targeted suites. Records exactly the same fields as scenarios.js `snap`
// (error, save count, toasts, hashes of A.db / account store / sessionStorage / modal / view /
// return value, storage keys) so targeted traces are compared with the same compareTraces().
const crypto = require('crypto');
const hash = s => crypto.createHash('sha1').update(String(s)).digest('hex').slice(0, 12);

function makeRecorder(h) {
  const A = h.A, steps = [];
  let lastSaves = h.trace.saves, lastToasts = h.trace.toasts.length;
  function snap(name, fn) {
    let err = null, ret;
    try { ret = fn(); h.flush(); } catch (e) { err = String(e && e.message || e); }
    steps.push({
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
    });
    lastSaves = h.trace.saves; lastToasts = h.trace.toasts.length;
    return ret;
  }
  // Helpers driving delegated handlers the way the DOM does (el.value / el.checked / dataset).
  const login = (acc, market) => { A.ui.sessionAccountId = acc; A.ui.market = market; A.syncAccountContext(); };
  let seq = 0;
  const field = (value, extra) => Object.assign(h.el('#__field' + (++seq)), { value, checked: !!value, dataset: {} }, extra || {});
  const ch = (key, value, extra) => { const fn = A.CH[key]; if (!fn) throw new Error('No change handler ' + key); fn(field(value, extra)); h.flush(); };
  const inp = (key, value, extra) => { const fn = A.IN[key]; if (!fn) throw new Error('No input handler ' + key); fn(field(value, extra)); h.flush(); };
  return { steps, snap, login, ch, inp, act: h.act, go: h.go, input: h.input, A, h };
}

module.exports = { makeRecorder, hash };

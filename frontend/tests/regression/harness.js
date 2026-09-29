// Headless harness: loads the real frontend scripts (index.html order) with a stub DOM,
// fixed clock and seeded RNG, so scenarios can be replayed on baseline vs working tree.
const fs = require('fs'), vm = require('vm'), path = require('path');

// The ONLY source of the runtime script list: the real <script src> order of frontend/index.html.
function indexScripts(root) {
  const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  return Array.from(html.matchAll(/<script src="([^"]+)"><\/script>/g)).map(m => m[1].split('?')[0]); // bỏ query cache-busting (?v=)
}

function createApp(root, opts) {
  opts = opts || {};
  const listeners = {};
  const registry = new Map();
  const files = { next: null };
  function makeEl(tag) {
    const own = { tagName: (tag || 'div').toUpperCase(), value: '', innerHTML: '', textContent: '', outerHTML: '', checked: false, dataset: {}, style: {}, files: [], _l: {} };
    own.classList = { add() {}, remove() {}, toggle() {}, contains() { return false; } };
    own.addEventListener = (ev, fn) => { (own._l[ev] = own._l[ev] || []).push(fn); };
    own.remove = () => {};
    own.appendChild = x => x;
    own.focus = () => {};
    own.click = () => {
      if (own.tagName === 'INPUT' && own.type === 'file' && files.next) {
        own.files = files.next; files.next = null;
        if (typeof own.onchange === 'function') own.onchange();
        (own._l.change || []).forEach(fn => fn());
      }
    };
    own.querySelectorAll = () => [];
    own.querySelector = () => null;
    own.closest = () => null;
    own.getBoundingClientRect = () => ({ top: 0, left: 0, width: 0, height: 0 });
    own.setAttribute = () => {}; own.getAttribute = () => null; own.removeAttribute = () => {};
    own.scrollIntoView = () => {}; own.scrollTo = () => {};
    return own;
  }
  const el = sel => { if (!registry.has(sel)) registry.set(sel, makeEl()); return registry.get(sel); };
  const document = {
    querySelector: sel => el(sel), querySelectorAll: () => [], getElementById: id => el('#' + id),
    createElement: tag => makeEl(tag), body: makeEl('body'), activeElement: null, title: '',
    addEventListener: (ev, fn) => { (listeners[ev] = listeners[ev] || []).push(fn); }
  };
  const store = (m => ({ getItem: k => m.has(k) ? m.get(k) : null, setItem: (k, v) => m.set(k, String(v)), removeItem: k => m.delete(k), _m: m }));
  const localStorage = store(new Map()), sessionStorage = store(new Map());
  const winListeners = {};
  const location = { _hash: '', get hash() { return this._hash; }, set hash(v) { this._hash = v.startsWith('#') ? v : '#' + v; (winListeners.hashchange || []).forEach(fn => fn()); } };
  const FIXED = new Date('2026-05-15T09:30:00Z').getTime();
  class FixedDate extends Date { constructor(...a) { if (a.length) super(...a); else super(FIXED); } static now() { return FIXED; } }
  let seed = 12345;
  const rng = () => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648; };
  const math = Object.create(Math); math.random = rng;
  const timers = [];
  const ctx = {
    console, JSON, Map, Set, Array, Object, String, Number, Boolean, RegExp, Error, TypeError, Symbol, Promise, Intl, parseInt, parseFloat, isNaN, isFinite, encodeURIComponent, decodeURIComponent,
    Date: FixedDate, Math: math, document, localStorage, sessionStorage, location,
    history: { replaceState: (a, b, u) => { location._hash = u; } },
    setTimeout: fn => { timers.push(fn); return timers.length; }, clearTimeout: () => {},
    requestAnimationFrame: fn => { timers.push(fn); return 1; },
    FileReader: class { readAsDataURL(f) { this.result = 'data:' + (f.type || '') + ';base64,QUJD'; this.onload && this.onload(); } },
    navigator: { clipboard: { writeText: () => Promise.resolve() }, userAgent: 'node' },
    alert: () => {}, confirm: () => true, prompt: () => null, Blob: class {}, URL: { createObjectURL: () => 'blob:x', revokeObjectURL: () => {} },
    matchMedia: () => ({ matches: false, addEventListener() {} }), innerWidth: 1280, innerHeight: 800, scrollTo: () => {}, open: () => null,
    getComputedStyle: () => ({})
  };
  ctx.window = ctx; ctx.self = ctx; ctx.globalThis = ctx;
  ctx.addEventListener = (ev, fn) => { (winListeners[ev] = winListeners[ev] || []).push(fn); };
  vm.createContext(ctx);
  if (opts.storage) Object.keys(opts.storage).forEach(k => localStorage.setItem(k, opts.storage[k]));
  const scripts = indexScripts(root);
  scripts.forEach(src => vm.runInContext(fs.readFileSync(path.join(root, src), 'utf8'), ctx, { filename: src }));
  const A = ctx.APP;
  const flush = () => { let n = 0; while (timers.length && n++ < 50) timers.shift()(); };
  (listeners.DOMContentLoaded || []).forEach(fn => fn());
  flush();
  const trace = { saves: 0, toasts: [] };
  const origSave = A.save; A.save = function () { trace.saves++; return origSave.apply(this, arguments); };
  const origToast = A.U.toast; A.U.toast = function (m) { trace.toasts.push(String(m)); try { return origToast.apply(this, arguments); } catch (e) { return undefined; } };
  return {
    A, ctx, trace, scripts, flush, registry, localStorage, sessionStorage, location,
    el, setFiles: list => { files.next = list; },
    modal: () => el('#modal-root').innerHTML, view: () => el('#view').innerHTML,
    act: (name, dataset, extra) => { const e = Object.assign(makeEl('button'), extra || {}); e.dataset = dataset || {}; const fn = A.ACT[name]; if (!fn) throw new Error('No action ' + name); const r = fn(e, { preventDefault() {} }); flush(); return r; },
    input: (sel, value) => { el(sel).value = value; },
    go: r => { location.hash = '#/' + r; flush(); }
  };
}
module.exports = { createApp, indexScripts };

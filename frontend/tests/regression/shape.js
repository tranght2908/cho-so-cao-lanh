// Runtime shape, registry, routes, storage identifiers and script loadability.
// Everything is derived from the real script order in frontend/index.html (harness.indexScripts).
const fs = require('fs'), vm = require('vm'), path = require('path');
const { createApp, indexScripts } = require('./harness');

// Route ids of the application menu/router (A.SCREEN_MARKET + tai-khoan-ngan-hang). 21 routes.
const ROUTES = ['tong-quan', 'danh-muc-cho', 'mat-bang', 'diem-kd', 'tai-san', 'phien-cho', 'tieu-thuong', 'hop-dong', 'cau-hinh-gia', 'tai-khoan-ngan-hang', 'dien-nuoc', 'phai-thu', 'thu-tien', 'doi-soat', 'cong-no', 'su-co', 'thong-bao', 'bao-cao', 'tai-khoan', 'cai-dat', 'mini-app'];
// Same account/market combinations as the behavioural replay (scenarios.js step 1).
const ROUTE_CONTEXTS = [['AC-QT01', 'CL'], ['AC-QT01', 'TTD'], ['AC-LD01', 'CL'], ['AC-NV01', 'CL'], ['AC-NV07', 'TTD']];

// 1. Every script referenced by index.html exists and compiles.
function checkScripts(root) {
  const scripts = indexScripts(root), errors = [];
  scripts.forEach(s => {
    try { new vm.Script(fs.readFileSync(path.join(root, s), 'utf8'), { filename: s }); } catch (e) { errors.push(s + ': ' + e.message); }
  });
  return { scripts, errors };
}

// 2. Shape after all scripts ran but BEFORE DOMContentLoaded (initial namespace + A.ui defaults).
function preInitShape(root) {
  const mk = () => ({ getItem: () => null, setItem() {}, removeItem() {} });
  const el = () => ({ style: {}, dataset: {}, classList: { add() {}, remove() {}, toggle() {} }, appendChild() {}, remove() {} });
  const ctx = { console, document: { querySelector: el, querySelectorAll: () => [], createElement: el, body: el(), addEventListener() {} }, localStorage: mk(), sessionStorage: mk(), location: { hash: '' }, history: { replaceState() {} }, setTimeout: () => 0 };
  ctx.window = ctx; vm.createContext(ctx);
  indexScripts(root).forEach(s => vm.runInContext(fs.readFileSync(path.join(root, s), 'utf8'), ctx, { filename: s }));
  const A = ctx.APP;
  return {
    A: Object.keys(A).sort(), U: Object.keys(A.U).sort(), ui: JSON.stringify(A.ui),
    db: A.db, idx: A.idx, current: A.current, DisDATA: A.D === ctx.DATA, dollar: typeof A.$, RBAC_SCHEMA: A.RBAC_SCHEMA
  };
}

// 3. Shape after full boot (DOMContentLoaded + auth), registry key sets, init-time storage writes.
function postInitShape(root) {
  const h = createApp(root);
  const A = h.A;
  const shape = {
    A: Object.keys(A).sort(), U: Object.keys(A.U).sort(), RBAC_SCHEMA: A.RBAC_SCHEMA, uiKeys: Object.keys(A.ui).sort(),
    views: Object.keys(A.VIEWS).sort(), act: Object.keys(A.ACT).sort(), in: Object.keys(A.IN).sort(), ch: Object.keys(A.CH).sort(),
    initLocalStorage: Array.from(h.localStorage._m.keys()).sort(), initSessionStorage: Array.from(h.sessionStorage._m.keys()).sort()
  };
  // Routes: registered view + actually rendered by the router (A.current === route) in at least one context.
  const reached = new Set();
  ROUTE_CONTEXTS.forEach(([acc, mk]) => {
    A.ui.sessionAccountId = acc; A.ui.market = mk; A.syncAccountContext();
    ROUTES.forEach(r => { h.go(r); if (A.current === r) reached.add(r); });
  });
  shape.routes = ROUTES.map(r => ({ route: r, registered: typeof A.VIEWS[r] === 'function', reached: reached.has(r) }));
  return shape;
}

// 4. Storage identifiers used by runtime code (static scan of every loaded script).
//    Identifier arguments (KEY, UIKEY, ...) are resolved to their string constant, so the same
//    storage key written under two spellings (UIKEY and 'choso-caolanh-ui') counts once.
function storageIdentifiers(root) {
  const consts = {}, uses = { localStorage: new Set(), sessionStorage: new Set() }, unresolved = [];
  const sources = indexScripts(root).map(s => fs.readFileSync(path.join(root, s), 'utf8'));
  sources.forEach(src => { for (const m of src.matchAll(/\b([A-Z][A-Z0-9_]*)\s*=\s*'([^']+)'/g)) consts[m[1]] = m[2]; });
  sources.forEach(src => {
    for (const m of src.matchAll(/\b(localStorage|sessionStorage)\.(?:getItem|setItem|removeItem)\(\s*([^,)]+)/g)) {
      const arg = m[2].trim();
      const lit = arg.match(/^'([^']+)'$/);
      const val = lit ? lit[1] : consts[arg];
      if (val) uses[m[1]].add(val); else unresolved.push(m[1] + ':' + arg);
    }
  });
  return { localStorage: Array.from(uses.localStorage).sort(), sessionStorage: Array.from(uses.sessionStorage).sort(), unresolved };
}

function captureShape(root) {
  return { pre: preInitShape(root), post: postInitShape(root), storage: storageIdentifiers(root) };
}

module.exports = { captureShape, checkScripts, ROUTES };

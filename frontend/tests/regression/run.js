// Frontend prototype regression suite. Usage (from the repository root or anywhere):
//   node frontend/tests/regression/run.js
// Compares the CURRENT runtime against the persisted, approved baseline in ./baseline/.
// Never writes the baseline (see update-baseline.js). Exit code 0 = pass, 1 = failure.
const fs = require('fs'), path = require('path');
const { checkScripts, captureShape } = require('./shape');
const { runScenarios } = require('./scenarios');
const { compareTraces } = require('./compare');
const { SUITES, runSuite } = require('./targeted');
const INV = require('./invariants');

const ROOT = path.resolve(__dirname, '..', '..');
const BASE = path.join(__dirname, 'baseline');
const results = [];
const check = (name, ok, detail) => { results.push({ name, ok: !!ok, detail: detail || '' }); };
const eq = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const readJson = f => JSON.parse(fs.readFileSync(path.join(BASE, f), 'utf8'));

function main() {
  let meta, baseShape, baseTrace;
  try { meta = readJson('meta.json'); baseShape = readJson('shape.json'); baseTrace = readJson('trace.json'); } catch (e) {
    console.error('Baseline missing or unreadable in ' + BASE + ': ' + e.message);
    console.error('Create it explicitly with: node frontend/tests/regression/update-baseline.js --reason "<why>"');
    return 1;
  }
  console.log(`Baseline: ${meta.label} (commit ${meta.commit}, recorded ${meta.recordedAt})`);

  // 1. Runtime scripts load.
  const sc = checkScripts(ROOT);
  check('runtime scripts compile (' + sc.scripts.length + ' from index.html)', !sc.errors.length, sc.errors.join('; '));

  let shape;
  try { shape = captureShape(ROOT); check('runtime boots headless', true); } catch (e) { check('runtime boots headless', false, e.stack); return report(); }
  const p = shape.post;

  // 2. Approved invariants (independent of the baseline).
  check(`registry views = ${INV.views}`, p.views.length === INV.views, p.views.length);
  check(`registry actions = ${INV.actions}`, p.act.length === INV.actions, p.act.length);
  check(`registry input handlers = ${INV.inputHandlers}`, p.in.length === INV.inputHandlers, p.in.length);
  check(`registry change handlers = ${INV.changeHandlers}`, p.ch.length === INV.changeHandlers, p.ch.length);
  check(`RBAC_SCHEMA = ${INV.rbacSchema}`, p.RBAC_SCHEMA === INV.rbacSchema && shape.pre.RBAC_SCHEMA === INV.rbacSchema, p.RBAC_SCHEMA);
  const okRoutes = p.routes.filter(r => r.registered && r.reached);
  check(`routes ${INV.routes}/${INV.routes} (registered and rendered by the router)`, okRoutes.length === INV.routes && p.routes.length === INV.routes,
    p.routes.filter(r => !r.registered || !r.reached).map(r => r.route + (r.registered ? ' not reached' : ' not registered')).join(', '));
  check(`storage: ${INV.localStorageKeys} localStorage identifiers`, shape.storage.localStorage.length === INV.localStorageKeys, shape.storage.localStorage.join(', '));
  check(`storage: ${INV.sessionStorageKeys} sessionStorage identifier`, shape.storage.sessionStorage.length === INV.sessionStorageKeys, shape.storage.sessionStorage.join(', '));
  check('storage: every storage call resolves to a known key', !shape.storage.unresolved.length, shape.storage.unresolved.join(', '));

  // 3. Shape equality against the approved baseline.
  const diffKeys = (a, b) => Object.keys(Object.assign({}, a, b)).filter(k => !eq(a[k], b[k]));
  const setDiff = (a, b) => { const A = new Set(a || []), B = new Set(b || []); return { removed: [...A].filter(x => !B.has(x)), added: [...B].filter(x => !A.has(x)) }; };
  const pre = diffKeys(baseShape.pre, shape.pre);
  check('APP shape before boot (A keys, A.U keys, db/idx/current slots, A.D, A.$) = baseline', !pre.filter(k => k !== 'ui').length, pre.join(', '));
  check('A.ui initial structure = baseline', eq(baseShape.pre.ui, shape.pre.ui));
  ['A', 'U', 'uiKeys', 'views', 'act', 'in', 'ch', 'initLocalStorage', 'initSessionStorage', 'routes'].forEach(k => {
    const d = Array.isArray(baseShape.post[k]) && k !== 'routes' ? setDiff(baseShape.post[k], p[k]) : null;
    check(`post-boot ${k} = baseline`, eq(baseShape.post[k], p[k]), d ? JSON.stringify(d) : '');
  });
  check('storage identifiers = baseline', eq(baseShape.storage, shape.storage), JSON.stringify(setDiff(baseShape.storage.localStorage.concat(baseShape.storage.sessionStorage), shape.storage.localStorage.concat(shape.storage.sessionStorage))));

  // 4. Behavioural replay against the approved trace.
  let trace;
  try { trace = runScenarios(ROOT); } catch (e) { check('behaviour replay runs', false, e.stack); return report(); }
  const errs = trace.steps.filter(s => s.err);
  check(`behaviour replay: ${INV.replaySteps} steps`, trace.steps.length === INV.replaySteps, trace.steps.length);
  check('behaviour replay: no step error', !errs.length, errs.map(s => s.name + ': ' + s.err).join('; '));
  const cmp = compareTraces(baseTrace.steps, trace.steps);
  check(`behaviour replay = baseline (${baseTrace.steps.length} steps)`, !cmp.diffs && trace.totalSaves === baseTrace.totalSaves,
    (cmp.diffs ? cmp.diffs + ' differing step(s)\n' + cmp.lines.join('\n') : '') + (trace.totalSaves !== baseTrace.totalSaves ? `\ntotal saves ${baseTrace.totalSaves} -> ${trace.totalSaves}` : ''));

  // 5. Targeted suites against their pre-migration baselines (baseline/targeted/<suite>.json).
  SUITES.forEach(name => {
    let base;
    try { base = readJson(path.join('targeted', name + '.json')); } catch (e) { check(`targeted '${name}': baseline present`, false, 'record it from the pre-migration runtime with record-targeted.js'); return; }
    let t;
    try { t = runSuite(ROOT, name); } catch (e) { check(`targeted '${name}' runs`, false, e.stack); return; }
    const c = compareTraces(base.steps, t.steps);
    check(`targeted '${name}' = baseline (${base.steps.length} steps, source ${base.meta.sourceCommit})`, !c.diffs && t.totalSaves === base.totalSaves,
      (c.diffs ? c.diffs + ' differing step(s)\n' + c.lines.join('\n') : '') + (t.totalSaves !== base.totalSaves ? `\ntotal saves ${base.totalSaves} -> ${t.totalSaves}` : ''));
  });
  return report();
}

function report() {
  results.forEach(r => {
    console.log(`${r.ok ? 'PASS' : 'FAIL'}  ${r.name}`);
    if (!r.ok && r.detail !== '') console.log('      ' + String(r.detail).split('\n').join('\n      '));
  });
  const failed = results.filter(r => !r.ok).length;
  console.log(failed ? `\nREGRESSION FAILED: ${failed} of ${results.length} checks` : `\nREGRESSION PASSED: ${results.length}/${results.length} checks`);
  return failed ? 1 : 0;
}

process.exitCode = main();

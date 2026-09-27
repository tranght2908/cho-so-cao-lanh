// EXPLICIT baseline refresh. Never run by run.js.
//   node frontend/tests/regression/update-baseline.js --reason "<approved phase / why>"
// Records the CURRENT runtime as the new approved baseline (shape.json, trace.json, meta.json).
// Refuses when runtime files under frontend/ have uncommitted changes, so every baseline maps to
// a commit; pass --allow-dirty only if you really intend to baseline an uncommitted runtime.
// Does NOT touch invariants.js — change approved counts there by hand, deliberately.
const fs = require('fs'), path = require('path'), { execFileSync } = require('child_process');
const { captureShape } = require('./shape');
const { runScenarios } = require('./scenarios');
const { toBaselineSteps } = require('./compare');

const ROOT = path.resolve(__dirname, '..', '..');
const BASE = path.join(__dirname, 'baseline');
const args = process.argv.slice(2);
const reasonIdx = args.indexOf('--reason');
const reason = reasonIdx !== -1 ? args[reasonIdx + 1] : null;
const labelIdx = args.indexOf('--label');
const label = labelIdx !== -1 ? args[labelIdx + 1] : null;

if (!reason) {
  console.error('Refusing: pass --reason "<approved phase / why>" (optionally --label "<short name>").');
  process.exit(1);
}
const git = a => execFileSync('git', a, { cwd: ROOT, encoding: 'utf8' }).trim();
const commit = git(['rev-parse', '--short', 'HEAD']);
const dirty = git(['status', '--porcelain', '--', '.', ':(exclude)tests']);
if (dirty && !args.includes('--allow-dirty')) {
  console.error('Refusing: runtime files under frontend/ have uncommitted changes:\n' + dirty);
  console.error('Commit the approved runtime first, or pass --allow-dirty deliberately.');
  process.exit(1);
}

const shape = captureShape(ROOT);
const trace = runScenarios(ROOT);
const errs = trace.steps.filter(s => s.err);
if (errs.length) {
  console.error('Refusing: the replay has step errors:\n' + errs.map(s => s.name + ': ' + s.err).join('\n'));
  process.exit(1);
}
fs.mkdirSync(BASE, { recursive: true });
fs.writeFileSync(path.join(BASE, 'shape.json'), JSON.stringify(shape, null, 1) + '\n');
fs.writeFileSync(path.join(BASE, 'trace.json'), JSON.stringify({ steps: toBaselineSteps(trace.steps), totalSaves: trace.totalSaves }, null, 1) + '\n');
fs.writeFileSync(path.join(BASE, 'meta.json'), JSON.stringify({
  label: label || ('baseline @ ' + commit), commit, dirty: !!dirty, recordedAt: new Date().toISOString(), reason,
  steps: trace.steps.length, totalSaves: trace.totalSaves,
  registry: { views: shape.post.views.length, actions: shape.post.act.length, inputHandlers: shape.post.in.length, changeHandlers: shape.post.ch.length }
}, null, 1) + '\n');
console.log(`Baseline written to ${BASE} (commit ${commit}${dirty ? ', DIRTY' : ''}, ${trace.steps.length} steps). Review the diff before committing it.`);

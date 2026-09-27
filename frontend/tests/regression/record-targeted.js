// EXPLICIT recording of a targeted suite baseline. Never run by run.js.
//   node frontend/tests/regression/record-targeted.js --root <pre-migration frontend root> --commit <sha> --suite <name> --reason "<why>"
// The root must be the runtime the suite is meant to protect BEFORE the migration that touches
// it (e.g. an export made with `git archive <approved commit> frontend | tar -x -C <dir>`), so the
// expectation never comes from the migrated implementation. The recorded file states its source.
const fs = require('fs'), path = require('path');
const { runSuite } = require('./targeted');
const { toBaselineSteps } = require('./compare');

const args = process.argv.slice(2);
const opt = k => { const i = args.indexOf('--' + k); return i !== -1 ? args[i + 1] : null; };
const root = opt('root'), commit = opt('commit'), suite = opt('suite'), reason = opt('reason');
if (!root || !commit || !suite || !reason) {
  console.error('Refusing: --root, --commit, --suite and --reason are all required.');
  process.exit(1);
}
const trace = runSuite(path.resolve(root), suite);
const errs = trace.steps.filter(s => s.err);
if (errs.length) {
  console.error('Refusing: the suite has step errors on the given root:\n' + errs.map(s => s.name + ': ' + s.err).join('\n'));
  process.exit(1);
}
const dir = path.join(__dirname, 'baseline', 'targeted');
fs.mkdirSync(dir, { recursive: true });
fs.writeFileSync(path.join(dir, suite + '.json'), JSON.stringify({
  meta: { suite, sourceCommit: commit, recordedAt: new Date().toISOString(), reason, steps: trace.steps.length, totalSaves: trace.totalSaves },
  steps: toBaselineSteps(trace.steps), totalSaves: trace.totalSaves
}, null, 1) + '\n');
console.log(`Recorded targeted baseline '${suite}' from ${root} (commit ${commit}, ${trace.steps.length} steps).`);

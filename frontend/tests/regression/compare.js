// Step-by-step trace comparison (same keys and semantics as the Phase 13 compare.js).
// Returns { diffs, lines }. `base` comes from the persisted baseline (hashes only); `cur` is a
// fresh run, so HTML snippets can only be shown for the current side.
const KEYS = ['err', 'saves', 'toasts', 'db', 'accounts', 'storageKeys', 'session', 'modal', 'view', 'ret'];

function compareTraces(baseSteps, curSteps) {
  const lines = [];
  let diffs = 0;
  if (baseSteps.length !== curSteps.length) { lines.push(`STEP COUNT ${baseSteps.length} -> ${curSteps.length}`); diffs++; }
  for (let i = 0; i < Math.min(baseSteps.length, curSteps.length); i++) {
    const x = baseSteps[i], y = curSteps[i];
    const bad = KEYS.filter(k => JSON.stringify(x[k]) !== JSON.stringify(y[k]));
    if (x.name !== y.name) bad.unshift('name');
    if (!bad.length) continue;
    diffs++;
    lines.push(`DIFF #${i} ${x.name}${x.name !== y.name ? ' / ' + y.name : ''} :: ${bad.join(',')}`);
    bad.filter(k => ['modal', 'view'].includes(k)).forEach(k => {
      const s = y['_' + k] || '';
      lines.push(`   cur ${k} (first 200 chars): ${JSON.stringify(s.slice(0, 200))}`);
    });
    bad.filter(k => ['err', 'saves', 'toasts', 'ret', 'storageKeys'].includes(k)).forEach(k => lines.push(`   ${k}: ${JSON.stringify(x[k])} => ${JSON.stringify(y[k])}`));
    if (diffs > 25) { lines.push('... (stopped after 25 differing steps)'); break; }
  }
  return { diffs, lines };
}

// Strips diagnostic raw HTML so a trace can be persisted as a baseline.
function toBaselineSteps(steps) {
  return steps.map(s => { const o = Object.assign({}, s); delete o._modal; delete o._view; return o; });
}

module.exports = { compareTraces, toBaselineSteps, KEYS };

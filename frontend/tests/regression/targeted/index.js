// Targeted suites: extra action-level coverage added during Phase 15 for domains the 229-step
// replay covers only through route renders. Each suite runs on a fresh headless app.
const { createApp } = require('../harness');
const { makeRecorder } = require('./record');

const SUITES = ['ops', 'layout', 'sessions', 'finance', 'trader-portal'];

function runSuite(root, name) {
  const h = createApp(root);
  const r = makeRecorder(h);
  require('./' + name)(r);
  return { steps: r.steps, totalSaves: h.trace.saves };
}

module.exports = { SUITES, runSuite };

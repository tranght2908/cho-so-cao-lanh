/* Regression: backfill legacy market lifecycle flags from the canonical layout graph. */
const assert = require('assert');
const path = require('path');
const { createApp } = require('./harness');
const root = path.resolve(__dirname, '../..');

// Start from the current canonical state, then emulate an old catalog in which
// flags were written independently from the layout graph.
const seed = createApp(root);
const legacyCatalog = JSON.parse(seed.localStorage.getItem('choso-caolanh-marketcatalog'));
const ha = legacyCatalog.find(m => m.id === 'HA');
ha.layoutStatus = 'PENDING_SETUP'; ha.status = 'ACTIVE'; ha.layoutLifecycleVersion = 0;
const ttd = legacyCatalog.find(m => m.id === 'TTD');
delete ttd.layoutStatus; ttd.status = 'NOT_ACTIVE'; ttd.layoutLifecycleVersion = 0;

const h = createApp(root, { storage: {
  'choso-caolanh-state': seed.localStorage.getItem('choso-caolanh-state'),
  'choso-caolanh-marketcatalog': JSON.stringify(legacyCatalog)
} });
const A = h.A, MC = A.features.markets.service;

// Case 1: PENDING_SETUP + ACTIVE without a valid graph is repaired downward.
assert.strictEqual(MC.get('HA').layoutStatus, 'PENDING_SETUP');
assert.strictEqual(MC.get('HA').status, 'NOT_ACTIVE');

// Case 2: a valid legacy graph is authoritative even when catalog flags are absent/wrong.
assert(MC.layoutGraphReady('TTD'));
assert.strictEqual(MC.get('TTD').layoutStatus, 'SETUP_COMPLETED');
assert.strictEqual(MC.get('TTD').status, 'ACTIVE');

const rows = MC.rows();
assert.strictEqual(rows.length, 12);
assert.strictEqual(rows.filter(m => MC.layoutReady(m.id)).length, 2, 'KPI: established layout count');
assert.strictEqual(rows.filter(m => !MC.layoutReady(m.id)).length, 10, 'KPI: pending layout count');
assert.strictEqual(rows.filter(m => m.status === 'ACTIVE').length, 2, 'KPI: active market count');
assert(!rows.some(m => m.layoutStatus === 'PENDING_SETUP' && m.status === 'ACTIVE'));

const persisted = JSON.parse(h.localStorage.getItem('choso-caolanh-marketcatalog'));
assert.strictEqual(persisted.find(m => m.id === 'HA').status, 'NOT_ACTIVE');
assert.strictEqual(persisted.find(m => m.id === 'TTD').layoutStatus, 'SETUP_COMPLETED');

// Case 3: the persisted backfill survives a reload and does not regress.
const reloaded = createApp(root, { storage: {
  'choso-caolanh-state': h.localStorage.getItem('choso-caolanh-state'),
  'choso-caolanh-marketcatalog': h.localStorage.getItem('choso-caolanh-marketcatalog')
} }).A.features.markets.service;
assert.strictEqual(reloaded.get('HA').status, 'NOT_ACTIVE');
assert.strictEqual(reloaded.get('TTD').layoutStatus, 'SETUP_COMPLETED');
assert(!reloaded.rows().some(m => m.layoutStatus === 'PENDING_SETUP' && m.status === 'ACTIVE'));

console.log('market-lifecycle-migration: PASS');

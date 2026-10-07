const assert = require('assert');
const path = require('path');
const { createApp } = require('./harness');

const h = createApp(path.resolve(__dirname, '../..'));
const A = h.A;
const TS = A.features.traders.service;
const AS = A.features.accounts.service;

const phone = '0988111222', idNo = '079999999999';
const profileA = TS.create({ id: 'TX-CM-CL', name: 'Cùng người', phone, idNo, market: 'CL', stalls: [] });
assert(profileA);
assert.equal(profileA.status, 'WAITING_ALLOCATION');
const account = AS.createTraderAccount({ id: 'AC-CM-01', code: 'CM01', fullName: profileA.name, phone, roleIds: ['trader'], marketScopes: ['CL'], traderId: profileA.id });
assert(account);
A.ACCOUNTS.activateAfterOtp(account);
const beforeAccounts = A.ACCOUNTS.list().length;

// Same phone/CCCD is legal in another market and joins the existing account.
const profileB = TS.create({ id: 'TX-CM-HA', name: 'Cùng người', phone, idNo, market: 'HA', stalls: [] });
assert(profileB);
assert.equal(profileB.status, 'WAITING_ALLOCATION');
assert.equal(A.ACCOUNTS.list().length, beforeAccounts);
assert.deepEqual(Array.from(A.ACCOUNTS.traderIdsOf(account)).sort(), [profileA.id, profileB.id].sort());
assert(account.marketScopes.includes('CL') && account.marketScopes.includes('HA'));
assert.equal(A.ACCOUNTS.byTraderId(profileB.id).id, account.id);

// The duplicate rule remains strictly market-local.
assert.equal(TS.create({ id: 'TX-CM-CL-DUP', name: 'Trùng CL', phone, idNo, market: 'CL', stalls: [] }), null);

// Independent profile lifecycle: account activation does not promote either
// profile, and Profile A may be active while Profile B still waits for placement.
profileA.status = 'ACTIVE';
assert.equal(A.ACCOUNTS.get(account.id).status, 'ACTIVE');
assert.equal(profileA.status, 'ACTIVE');
assert.equal(profileB.status, 'WAITING_ALLOCATION');

// Contract ownership is profile-specific; the account has both scopes but a
// profile query cannot see the other profile's contract.
A.db.contracts.push(
  { id: 'HD-CM-CL', traderId: profileA.id, market: 'CL', stallId: 'CL-KA-A01', businessPointId: 'CL-KA-A01', start: '2026-01-01', end: '2027-01-01', status: 'ACTIVE' },
  { id: 'HD-CM-HA', traderId: profileB.id, market: 'HA', stallId: 'HA-POINT', businessPointId: 'HA-POINT', start: '2026-01-01', end: '2027-01-01', status: 'ACTIVE' }
);
assert.deepEqual(A.db.contracts.filter(c => c.traderId === profileA.id).map(c => c.id), ['HD-CM-CL']);
assert.deepEqual(A.db.contracts.filter(c => c.traderId === profileB.id).map(c => c.id), ['HD-CM-HA']);

// Cross-tab catalog hydration must route through the same lifecycle migration.
const legacyCatalog = A.MARKET_CATALOG.rows().map(m => Object.assign({}, m));
const ha = legacyCatalog.find(m => m.id === 'HA');
ha.layoutStatus = 'PENDING_SETUP'; ha.status = 'ACTIVE';
h.localStorage.setItem(A.MARKET_CATALOG.KEY, JSON.stringify(legacyCatalog));
const refreshed = A.refreshSharedState();
assert(refreshed.changed);
assert.equal(A.MARKET_CATALOG.get('HA').layoutStatus, 'PENDING_SETUP');
assert.equal(A.MARKET_CATALOG.get('HA').status, 'NOT_ACTIVE');

console.log('cross-market-merchant-profile: PASS');

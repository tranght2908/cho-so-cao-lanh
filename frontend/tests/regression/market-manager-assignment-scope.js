/* Focused regression: manager scope is derived from active market assignments. */
const assert = require('assert');
const path = require('path');
const { createApp } = require('./harness');

const h = createApp(path.resolve(__dirname, '../..'));
const A = h.A, MC = A.features.markets.service;
const admin = A.ACCOUNTS.get('AC-QT01');
A.ui.sessionAccountId = admin.id; A.ui.currentDemoAccountId = admin.id; A.ui.market = 'ALL'; A.syncAccountContext();

const manager = { id: 'AC-TEST-MGR-SCOPE', code: 'QLTEST', fullName: 'Tổ trưởng kiểm thử', phone: '0987111099', accountType: 'Tổ trưởng Tổ Quản lý chợ', roleIds: ['market_manager'], organization: 'Tổ Quản lý chợ', marketScopes: [], managerScopeMode: 'ASSIGNMENT', status: 'ACTIVE' };
A.ACCOUNTS.add(manager);
assert.deepStrictEqual(Array.from(A.allowedMarkets(manager)), [], 'new manager has no implicit market');

const now = A.U.today();
assert(MC.assign('HA', { accountId: manager.id, effectiveFrom: now, reason: 'Phân công A', note: '' }, admin).ok);
assert.deepStrictEqual(Array.from(A.allowedMarkets(manager)), ['HA']);
assert(MC.assign('TVH', { accountId: manager.id, effectiveFrom: now, reason: 'Phân công B', note: '' }, admin).ok);
assert.deepStrictEqual(Array.from(A.allowedMarkets(manager)).sort(), ['HA', 'TVH']);

// A planned replacement never grants the incoming manager early access, and
// only removes the outgoing manager from the replaced market on that date.
const successor = { id: 'AC-TEST-MGR-SUCCESSOR', code: 'QLTEST02', fullName: 'Successor', phone: '0987111098', accountType: 'Manager', roleIds: ['market_manager'], organization: 'Market team', marketScopes: [], managerScopeMode: 'ASSIGNMENT', status: 'ACTIVE' };
A.ACCOUNTS.add(successor);
assert(MC.assign('HA', { accountId: successor.id, effectiveFrom: '2099-02-01', reason: 'Planned handover', note: '' }, admin).ok);
assert.deepStrictEqual(Array.from(A.allowedMarkets(successor)), [], 'future assignment does not grant access early');
assert.deepStrictEqual(Array.from(MC.assignedMarketIdsForAccount(manager.id, '2099-02-01')), ['TVH'], 'outgoing manager retains other assigned markets only');
assert.deepStrictEqual(Array.from(MC.assignedMarketIdsForAccount(successor.id, '2099-02-01')), ['HA'], 'incoming manager receives the replaced market from its effective date');

// Direct action invocation cannot use a forged selected market outside scope.
A.ui.sessionAccountId = manager.id; A.ui.currentDemoAccountId = manager.id; A.ui.market = 'CL'; A.syncAccountContext();
assert.notStrictEqual(A.ui.market, 'CL', 'context clamps forged selected market');
A.ui.market = 'CL';
assert.strictEqual(A.canDo('hop-dong.xac-nhan-su-dung', 'CL'), false, 'canDo independently rejects out-of-scope target');

// A legacy ALL manager is unchanged until Admin explicitly confirms a real assignment.
const legacy = A.ACCOUNTS.get('AC-NV01');
assert(A.ACCOUNTS.managerNeedsAssignmentReview(legacy), 'legacy ALL manager requires review');
const before = JSON.stringify({ scopes: legacy.marketScopes, mode: legacy.managerScopeMode, conversion: legacy.managerScopeConversion });
assert.strictEqual(A.ACCOUNTS.convertMarketManager(legacy.id, admin).ok, false, 'cannot convert before effective assignment review');
assert.strictEqual(JSON.stringify({ scopes: legacy.marketScopes, mode: legacy.managerScopeMode, conversion: legacy.managerScopeConversion }), before, 'failed conversion does not mutate legacy account');

console.log('market-manager-assignment-scope regression PASS');

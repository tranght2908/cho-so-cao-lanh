/* Focused regression for dated market-responsibility assignments. */
const assert = require('assert');
const path = require('path');
const { createApp } = require('./harness');
const h = createApp(path.resolve(__dirname, '../..')), A = h.A;
const MC = A.features.markets.service;
const admin = A.ACCOUNTS.get('AC-QT01');
A.ui.sessionAccountId = admin.id; A.ui.market = 'ALL'; A.syncAccountContext();
const manager = MC.eligibleResponsibleAccounts()[0];
const effectiveNow = A.U.today(), futureDate = '2099-06-01';
assert(manager, 'seed has an eligible responsible account');
const created = MC.add({ code: 'MMA01', name: 'Chợ kiểm thử phân công', address: 'Kiểm thử', rank: 'HANG_3', totalArea: 100, businessArea: 80,
  managementAssignments: MC.prepareInitialAssignment('MMA01', { accountId: manager.id, effectiveFrom: effectiveNow }, admin).assignments }, admin.fullName);
assert(created && MC.assignmentAt('MMA01', effectiveNow).accountId === manager.id, 'initial assignment persists with the market');
const scopes = JSON.stringify(manager.marketScopes), roles = JSON.stringify(manager.roleIds);
const future = MC.assign('MMA01', { accountId: manager.id, effectiveFrom: futureDate, reason: 'Kế hoạch kiểm thử', note: '' }, admin);
assert(future.ok, 'future assignment is accepted: ' + JSON.stringify(future));
assert.strictEqual(MC.assignmentAt('MMA01', effectiveNow).accountId, manager.id);
assert.strictEqual(MC.assignmentAt('MMA01', futureDate).accountId, manager.id);
// Phân công trước kết thúc đúng NGÀY TRƯỚC ngày hiệu lực của kế hoạch mới (liền mạch, không hở ngày ở múi giờ UTC+7).
const firstRow = MC.assignments('MMA01').find(x => x.effectiveFrom === effectiveNow);
assert.strictEqual(firstRow.effectiveTo, '2099-05-31', 'previous assignment ends the day before the new one');
assert(MC.assignmentAt('MMA01', '2099-05-31'), 'no unassigned gap day');
assert(MC.assignments('MMA01').every(x => !/[ÃÂÆ][\u0080-ÿ]|á»/.test(String(x.reason || '') + String(x.note || ''))), 'Vietnamese audit text is not mis-encoded');
assert.strictEqual(JSON.stringify(manager.marketScopes), scopes, 'assignment never changes marketScopes');
assert.strictEqual(JSON.stringify(manager.roleIds), roles, 'assignment never changes roles');
assert.strictEqual(MC.assign('MMA01', { accountId: manager.id, effectiveFrom: futureDate, reason: 'Trùng', note: '' }, admin).reason, 'OVERLAP');
assert(MC.cancelFutureAssignment('MMA01', future.assignment.id, 'Hủy kiểm thử', admin).ok, 'future plan can be cancelled');
assert(MC.assignments('MMA01').some(x => x.id === future.assignment.id && x.cancelledAt), 'cancelled plan remains auditable');
console.log('market-management-assignment regression PASS');

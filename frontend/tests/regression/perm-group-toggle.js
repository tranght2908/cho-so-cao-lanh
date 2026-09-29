/* Focused regression: "Chọn tất cả" per action-permission group in Cài đặt → Phân quyền chi tiết
 * grants/revokes exactly that group's keys through A.PERM and respects cai-dat.phan-quyen. */
const assert = require('assert');
const path = require('path');
const { createApp } = require('./harness');

const h = createApp(path.resolve(__dirname, '../..')), A = h.A;
const login = id => { A.ui.sessionAccountId = id; A.ui.market = 'CL'; A.syncAccountContext(); };
login('AC-QT01');
const role = 'collector';
A.ui.permRole = role; h.go('cai-dat');
const keysOf = screenId => A.PERM.catalog().filter(p => p.kind === 'action' && p.screenId === screenId).map(p => p.key);
const group = keysOf('hop-dong');
assert(group.length > 1, 'contract group has several action permissions');
const others = () => A.PERM.rolePermKeys(role).filter(k => group.indexOf(k) === -1).sort().join('|');
const before = others();
const toggle = checked => A.CH['perm-group-toggle']({ checked, dataset: { role, keys: group.join(',') } });

toggle(true);
assert(group.every(k => A.PERM.rolePermKeys(role).includes(k)), 'all group keys granted');
assert.strictEqual(others(), before, 'other groups untouched');
toggle(false);
assert(group.every(k => !A.PERM.rolePermKeys(role).includes(k)), 'all group keys revoked');
assert.strictEqual(others(), before);
assert(/data-ch="perm-group-toggle"/.test(h.view()) && /Chọn tất cả/.test(h.view()));

login('AC-NV01');
toggle(true);
assert(group.every(k => !A.PERM.rolePermKeys(role).includes(k)), 'user without cai-dat.phan-quyen cannot grant');
console.log('perm group toggle regression PASS');

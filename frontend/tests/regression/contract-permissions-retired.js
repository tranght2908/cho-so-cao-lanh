/* Focused regression (scope 10/2026): Gia hạn / Chấm dứt / Thanh lý hợp đồng + Cập nhật bản ký số hóa đã retire.
 * F: ma trận "Cài đặt & phân quyền" không hiển thị 4 quyền này, không cấp mới được (kể cả gọi handler trực tiếp).
 * G: vai trò legacy đã lưu các key cũ → app vẫn mở, ma trận/màn Hợp đồng render được, key cũ không bị xoá. */
const assert = require('assert');
const path = require('path');
const { createApp } = require('./harness');

const ROOT = path.resolve(__dirname, '../..');
const RETIRED = ['action:hop-dong.gia-han', 'action:hop-dong.cham-dut', 'action:hop-dong.thanh-ly', 'action:hop-dong.cap-nhat-ban-ky'];
let passed = 0;
const ok = (label, fn) => { try { fn(); passed++; } catch (e) { e.message = label + ': ' + e.message; throw e; } };
const login = (A, id, market) => { A.ui.sessionAccountId = id; A.ui.currentDemoAccountId = id; A.ui.market = market || 'CL'; A.syncAccountContext(); };

const h = createApp(ROOT), A = h.A;
ok('F: permission matrix hides Gia hạn / Chấm dứt / Thanh lý / Cập nhật bản ký', () => {
  login(A, 'AC-QT01');
  const keys = A.PERM.catalog().map(p => p.key);
  RETIRED.forEach(k => { assert(!keys.includes(k), k + ' not in the current catalog'); assert(A.PERM.isRetiredPermission(k)); });
  assert(keys.includes('action:hop-dong.tao') && keys.includes('action:hop-dong.in'), 'remaining contract permissions still configurable');
  // Profile page (Thông tin cá nhân) lists granted permissions from the same current catalog.
  assert(!A.PERM.catalog().some(p => /bản số hóa/.test(p.label)));
  ['market_manager', 'collector'].forEach(role => {
    A.ui.permRole = role; h.go('cai-dat');
    const v = h.view();
    assert(/data-ch="perm-toggle"/.test(v), 'matrix rendered for ' + role);
    RETIRED.forEach(k => assert(!v.includes(`data-key="${k}"`), role + ' matrix hides ' + k));
    assert(!/>Gia hạn hợp đồng<|>Thanh lý hợp đồng<|>Chấm dứt hợp đồng|>Cập nhật bản số hóa hợp đồng</.test(v), 'labels hidden');
  });
});
ok('F: a retired key cannot be granted, even by calling the handler directly', () => {
  login(A, 'AC-QT01');
  const role = 'collector';
  ['action:hop-dong.gia-han', 'action:hop-dong.cap-nhat-ban-ky'].forEach(k => {
    A.PERM.revoke(role, k);
    A.CH['perm-toggle']({ checked: true, dataset: { role, key: k } });
    assert(!A.PERM.rolePermKeys(role).includes(k), 'direct grant refused: ' + k);
  });
  A.CH['perm-group-toggle']({ checked: true, dataset: { role, keys: RETIRED.join(',') } });
  RETIRED.forEach(k => assert(!A.PERM.rolePermKeys(role).includes(k), k));
});
ok('fresh seed does not grant the retired keys', () => {
  const fresh = createApp(ROOT).A;
  ['market_manager', 'collector'].forEach(r => RETIRED.forEach(k => assert(!fresh.PERM.rolePermKeys(r).includes(k), r + ' ' + k)));
});
ok('G: legacy roles holding the old keys → app opens, matrix + Hợp đồng render, keys kept (no migration)', () => {
  const stored = JSON.parse(h.localStorage.getItem('choso-caolanh-permissions'));
  assert(stored && Array.isArray(stored.rolePerms), 'fixture: persisted permission state');
  RETIRED.forEach(k => stored.rolePerms.push({ roleId: 'market_manager', permKey: k, grantedAt: '2026-01-01', grantedBy: 'legacy' }));
  const h2 = createApp(ROOT, { storage: { 'choso-caolanh-permissions': JSON.stringify(stored) } }), A2 = h2.A;
  RETIRED.forEach(k => assert(A2.PERM.rolePermKeys('market_manager').includes(k), 'legacy key kept: ' + k));
  login(A2, 'AC-QT01'); A2.ui.permRole = 'market_manager'; h2.go('cai-dat');
  const v = h2.view();
  assert(v.length > 500 && !RETIRED.some(k => v.includes(`data-key="${k}"`)), 'matrix renders without the retired keys');
  login(A2, 'AC-NV01', 'CL'); h2.go('hop-dong');
  assert(/<h2>Hợp đồng<\/h2>/.test(h2.view()) && !/data-act="ct-(renew|terminate|liquidate)"/.test(h2.view()));
});
console.log(`contract-permissions-retired regression PASS (${passed} checks)`);

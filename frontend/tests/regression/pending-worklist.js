/* Focused regression: pending ACCOUNT work stays compact on the Tài khoản page and opens as a paginated worklist.
 * (The former contract worklist — "Tiểu thương chưa có hợp đồng" + old create form — was retired with
 * contracts/create.js; contracts are now created from Hồ sơ tiểu thương → màn Hợp đồng, see contract-workspace.js
 * and contract-create-rules.js.) */
const assert = require('assert');
const path = require('path');
const { createApp } = require('./harness');
const root = path.resolve(__dirname, '../..');

const countRows = html => (html.match(/class="pending-work-row"/g) || []).length;
const login = (A, accountId) => { A.ui.sessionAccountId = accountId; A.ui.market = 'CL'; A.syncAccountContext(); };

// Account work: 250 eligible traders must not be inserted into the primary page.
{
  const h = createApp(root), A = h.A;
  login(A, 'AC-QT01');
  A.db.traders = []; A.db.stalls = []; A.db.contracts = [];
  for (let n = 1; n <= 250; n++) {
    const traderId = `PW-TT${String(n).padStart(3, '0')}`, pointId = `PW-PT${String(n).padStart(3, '0')}`;
    A.db.traders.push({ id: traderId, name: `Hồ sơ chờ ${n}`, phone: `098${String(n).padStart(7, '0')}`, market: 'CL' }); // dải SĐT không trùng account nhân sự demo (SĐT đăng nhập phải duy nhất)
    A.db.stalls.push({ id: pointId, code: `PW-A${n}`, market: 'CL', status: 'thue', traderId, area: 4, cat: 'Quầy', sectionName: 'Khu A' });
    A.db.contracts.push({ id: `PW-HD${String(n).padStart(3, '0')}`, traderId, stallId: pointId, businessPointId: pointId, market: 'CL', status: 'ACTIVE', start: '2026-01-01', end: '2026-12-31' });
  }
  A.reindex(); h.go('tai-khoan');
  assert.strictEqual(A.features.accounts.service.tradersNeedingAccount().length, 250);
  assert(/250/.test(h.view()));
  assert.strictEqual(countRows(h.view()), 0, 'main account page must not contain pending rows');
  h.act('wf-account-worklist');
  assert(/250 trường hợp/.test(h.modal()));
  assert.strictEqual(countRows(h.modal()), 15, 'worklist page size is bounded');
  A.IN['wf-account-search']({ value: 'PW-TT042' });
  assert(/PW-TT042/.test(h.modal()));
  assert.strictEqual(countRows(h.modal()), 1, 'search narrows the worklist');
  h.act('wf-account-open', { id: 'PW-TT042' });
  h.act('wf-account-create', { id: 'PW-TT042' });
  assert.strictEqual(A.features.accounts.service.tradersNeedingAccount().length, 249);
  h.go('tai-khoan');
  assert(/249/.test(h.view()), 'summary updates after existing create-account action');
}

console.log('pending worklist regression PASS');

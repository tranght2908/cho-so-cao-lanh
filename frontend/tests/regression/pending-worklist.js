/* Focused regression: pending work stays compact on pages and opens as a paginated worklist. */
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
    A.db.traders.push({ id: traderId, name: `Hồ sơ chờ ${n}`, phone: `090${String(n).padStart(7, '0')}`, market: 'CL' });
    A.db.stalls.push({ id: pointId, code: `PW-A${n}`, market: 'CL', status: 'thue', traderId, area: 4, cat: 'Quầy', sectionName: 'Khu A' });
    A.db.contracts.push({ id: `PW-HD${String(n).padStart(3, '0')}`, traderId, stallId: pointId, businessPointId: pointId, market: 'CL', status: 'hieuluc', start: '2026-01-01', end: '2026-12-31' });
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

// Contract work: the existing creation action remains the one used by the worklist.
{
  const h = createApp(root), A = h.A;
  login(A, 'AC-NV01');
  const traderId = 'PW-CONTRACT-01';
  A.db.traders = [{ id: traderId, name: 'Hồ sơ chờ hợp đồng', phone: '0901234567', market: 'CL' }];
  A.db.contracts = [];
  A.db.stalls = [{ id: 'PW-POINT-01', code: 'PW-A01', market: 'CL', status: 'trong', area: 4, cat: 'Quầy', sectionName: 'Khu A' }];
  A.reindex(); h.go('hop-dong');
  assert(/1/.test(h.view()));
  assert.strictEqual(countRows(h.view()), 0, 'main contract page must not contain pending rows');
  h.act('wf-contract-worklist');
  assert(/Hồ sơ chờ hợp đồng/.test(h.modal()));
  assert(/data-act="wf-contract-open"/.test(h.modal()));
  h.act('wf-contract-open', { id: traderId });
  assert(/Tạo hợp đồng/.test(h.modal()), 'the existing contract form opens from worklist');
}

console.log('pending worklist regression PASS');

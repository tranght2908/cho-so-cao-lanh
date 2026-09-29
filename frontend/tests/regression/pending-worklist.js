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
  assert(/TIỂU THƯƠNG CHƯA CÓ HỢP ĐỒNG/.test(h.view()));
  assert(/data-act="trader"/.test(h.view()) && /data-act="wf-contract-open"/.test(h.view()));
  h.act('wf-contract-open', { id: traderId });
  assert(/Tạo hợp đồng/.test(h.modal()), 'the existing contract form opens from worklist');
}

// Canonical "Tiểu thương chưa có hợp đồng" worklist: both CTAs converge, rows/counts derive from traders + contracts.
{
  const h = createApp(root), A = h.A;
  const BP = A.features.businessPoints.service, CS = A.features.contracts.service;
  const addDays = (d, n) => new Date(Date.parse(d) + n * 86400000).toISOString().slice(0, 10);
  const cardCount = html => { const m = /pending-summary-count">(\d+)</.exec(html); return m ? +m[1] : null; };
  const rowOf = (html, id) => { const i = html.indexOf(`<b>${id}</b>`); return i < 0 ? '' : html.slice(i, html.indexOf('</tr>', i)); };
  const scopesBefore = JSON.stringify(A.ACCOUNTS.list().map(a => [a.id, a.marketScopes]));
  login(A, 'AC-NV01');
  A.db.traders.push({ id: 'PW-NEW-A', name: 'Mai Thị Chờ A', phone: '0970000428', idNo: '087000009991', market: 'CL', stalls: [] });
  A.db.traders.push({ id: 'PW-NEW-B', name: 'Huỳnh Chờ B', phone: '0980000130', idNo: '087000009992', market: 'CL', stalls: [] });
  A.db.traders.push({ id: 'PW-OTHER-HA', name: 'Tiểu thương chợ khác', phone: '0990000001', idNo: '087000009993', market: 'HA', stalls: [] });
  A.reindex();
  const pendingBefore = CS.pendingContractTraders('CL');
  assert.deepStrictEqual(A.WORKFLOW.needsContract('CL').map(t => t.id), pendingBefore.map(t => t.id), 'cards and worklist share one helper');
  assert(pendingBefore.some(t => t.id === 'PW-NEW-A') && !pendingBefore.some(t => t.id === 'PW-OTHER-HA'));

  h.go('tieu-thuong');
  assert.strictEqual(cardCount(h.view()), pendingBefore.length, 'trader card count');
  assert(/Xem &amp; xử lý|Xem & xử lý/.test(h.view()) && /data-act="wf-contract-worklist"/.test(h.view()));
  h.act('wf-contract-worklist');
  assert.strictEqual(A.current, 'hop-dong'); assert.strictEqual(h.location.hash, '#/hop-dong');
  assert.strictEqual(h.modal(), '', 'worklist is not the old modal worklist');
  const fromTrader = h.view();
  assert(/TIỂU THƯƠNG CHƯA CÓ HỢP ĐỒNG/.test(fromTrader) && !/Chợ<\/th>/.test(fromTrader), 'fixed market hides market column');

  h.go('tieu-thuong'); h.go('hop-dong');
  assert(!/TIỂU THƯƠNG CHƯA CÓ HỢP ĐỒNG/.test(h.view()), 'leaving the route resets the transient worklist state');
  assert.strictEqual(cardCount(h.view()), pendingBefore.length, 'contract card count');
  assert(/Xem &amp; tạo hợp đồng|Xem & tạo hợp đồng/.test(h.view()));
  h.act('wf-contract-worklist');
  assert.strictEqual(h.view(), fromTrader, 'both CTAs render exactly the same worklist');

  A.IN['wf-contract-pending-search']({ value: 'PW-' });
  const list = h.view();
  assert(list.includes('PW-NEW-A') && list.includes('PW-NEW-B') && !list.includes('PW-OTHER-HA'), 'only pending traders of the selected market');
  const row = rowOf(list, 'PW-NEW-A');
  assert(/Chờ bố trí/.test(row) && row.includes(A.U.maskPhone('0970000428')));
  assert.deepStrictEqual((row.match(/data-act="([^"]+)"/g) || []).map(x => x.slice(10, -1)), ['trader', 'wf-contract-open'], 'row has exactly Xem chi tiết + Tạo hợp đồng');
  assert(/>Xem chi tiết</.test(row) && />Tạo hợp đồng</.test(row));

  h.act('trader', { id: 'PW-NEW-A' });
  assert(/Hồ sơ tiểu thương PW-NEW-A/.test(h.modal()), 'Xem chi tiết reuses the Trader Detail drawer');
  h.act('close');
  assert.strictEqual(h.modal(), ''); assert.strictEqual(A.current, 'hop-dong');
  assert(h.view().includes('PW-NEW-A') && /TIỂU THƯƠNG CHƯA CÓ HỢP ĐỒNG/.test(h.view()), 'closing detail returns to the same worklist');

  h.act('wf-contract-open', { id: 'PW-NEW-A' });
  const form = h.modal();
  assert(/A\. TIỂU THƯƠNG/.test(form) && form.includes('PW-NEW-A') && !/id="wf-ct-trader"/.test(form), 'trader fixed/read-only');
  assert(/B\. THỜI HẠN/.test(form) && /id="wf-ct-building"/.test(form) && /id="wf-ct-row"/.test(form) && /D\. CHÍNH SÁCH THU/.test(form) && /E\. HỒ SƠ HỢP ĐỒNG/.test(form), 'Contract Create v16 form');
  const start = A.U.today(), end = addDays(start, 30);
  const candidates = A.db.stalls.filter(p => p.market === 'CL' && BP.row(p) && BP.building(p) && BP.isAllocatable(p) && BP.isAvailable(p.id, start, end) && A.U.appliedStallPrice && A.U.appliedStallPrice(p));
  assert(candidates.length >= 2, 'fixture has two free priced points');
  const fill = p => {
    h.input('#wf-ct-trader', 'PW-NEW-B'); // ignored while trader is locked
    h.input('#wf-ct-start', start); h.input('#wf-ct-end', end);
    A.features.contracts.form.pickPoint(p.id);
    const b = BP.building(p), f = BP.floor(p);
    h.input('#wf-ct-building', b.id); h.input('#wf-ct-floor', f ? f.id : ''); h.input('#wf-ct-row', BP.row(p).id); h.input('#wf-ct-point', p.id);
  };
  fill(candidates[0]);
  const before = A.db.contracts.length;
  h.act('wf-contract-save');
  assert.strictEqual(A.db.contracts.length, before + 1, h.trace.toasts.at(-1));
  assert.strictEqual(A.db.contracts.at(-1).traderId, 'PW-NEW-A', 'locked trader cannot be swapped');
  assert(/Tạo hợp đồng thành công/.test(h.modal()));
  A.closeModal();
  const pendingAfter = CS.pendingContractTraders('CL');
  assert.strictEqual(pendingAfter.length, pendingBefore.length - 1);
  assert(!h.view().includes('PW-NEW-A') && h.view().includes('PW-NEW-B'), 'row disappears after create');
  h.go('tieu-thuong'); assert.strictEqual(cardCount(h.view()), pendingAfter.length, 'trader card refreshed');
  h.go('hop-dong'); assert.strictEqual(cardCount(h.view()), pendingAfter.length, 'contract card refreshed');

  // Onboarding worklist ≠ contract eligibility: a second contract remains possible from the trader dossier.
  h.act('trader', { id: 'PW-NEW-A' });
  assert(/data-act="wf-contract-open" data-id="PW-NEW-A"/.test(h.modal()), 'no single-contract blocker');
  h.act('wf-contract-open', { id: 'PW-NEW-A' });
  fill(candidates.find(p => BP.isAvailable(p.id, start, end)));
  h.act('wf-contract-save');
  assert.strictEqual(CS.listByTrader('PW-NEW-A').length, 2, h.trace.toasts.at(-1));
  A.closeModal();

  assert(!['pendingTraders', 'pendingContracts', 'workItems'].some(k => k in A.db), 'no persisted work items');
  assert(!Array.from(h.localStorage._m.keys()).some(k => /pending|workitem/i.test(k)), 'no pending-worklist storage key');
  assert(!A.db.traders.some(t => 'collectorId' in t), 'no trader.collectorId');
  const src = require('fs').readFileSync(path.join(root, 'src/features/contracts/create.js'), 'utf8');
  assert(/collectorCanAccessPoint/.test(src) && /A\.ACT\['wf-contract-save'\][\s\S]*?if \(!collectorCanUse\(s\)\)/.test(src), 'save keeps Row collector validation');
  assert.strictEqual(JSON.stringify(A.ACCOUNTS.list().map(a => [a.id, a.marketScopes])), scopesBefore, 'marketScopes unchanged');
}

console.log('pending worklist regression PASS');

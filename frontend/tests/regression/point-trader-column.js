/* Date-aware Trader column in Mặt bằng → Bảng. No Point ownership fields are used. */
const assert = require('assert');
const path = require('path');
const { createApp } = require('./harness');
const root = path.resolve(__dirname, '../..');
let passed = 0;
const ok = (label, fn) => { try { fn(); passed++; } catch (e) { e.message = label + ': ' + e.message; throw e; } };

const h = createApp(root), A = h.A, BP = A.features.businessPoints.service;
const manager = A.ACCOUNTS.list().find(a => A.ACCOUNTS.primaryRole(a) === 'market_manager' && A.allowedMarkets(a).includes('CL'));
const vacant = A.db.stalls.filter(p => p.market === 'CL' && !BP.occupancies(p.id).length);
assert(manager && vacant.length >= 2, 'seed provides an isolated v16 fixture');
const traders = [
  { id: 'TEST-TT-OCC-A', name: 'Tiểu thương test chiếm dụng A', market: 'CL', stalls: [] },
  { id: 'TEST-TT-OCC-B', name: 'Tiểu thương test chiếm dụng B', market: 'CL', stalls: [] },
  { id: 'TEST-TT-TERM', name: 'Tiểu thương test chấm dứt', market: 'CL', stalls: [] }
];
A.db.traders.push(...traders);

A.ui.sessionAccountId = manager.id; A.ui.market = 'CL'; A.syncAccountContext();
const [point, terminatedPoint] = vacant;
const ids = ['TEST-MB-OCC-1', 'TEST-MB-OCC-2', 'TEST-MB-TERM'];
const add = c => A.db.contracts.push(Object.assign({ market: 'CL', history: [], status: 'hieuluc' }, c, { businessPointId: c.stallId }));
add({ id: ids[0], traderId: traders[0].id, stallId: point.id, start: '2026-01-01', end: '2026-06-30' });
add({ id: ids[1], traderId: traders[1].id, stallId: point.id, start: '2026-07-01', end: '2026-12-31' });
add({ id: ids[2], traderId: traders[2].id, stallId: terminatedPoint.id, start: '2026-01-01', end: '2026-12-31', status: 'chamdut', termination: { date: '2026-06-01' } });
A.reindex();

function tableAt(date, rowId) {
  if (A.current !== 'mat-bang') h.go('mat-bang');
  A.mbSetStatusDate(date);
  A.ui.mb.view = 'table'; A.ui.mb.sel = { k: 'row', id: rowId || point.rowId };
  A.ui.mb.filter = { search: '', status: '', cat: '', areaType: '' };
  A.render(); h.flush();
  return h.view();
}
function traderCell(html, pointId) {
  const row = html.match(new RegExp(`<tr class="click" data-act="dk-open" data-id="${pointId}">([\\s\\S]*?)<\\/tr>`));
  return row ? row[1].match(/<td class="mb-col-trader"[^>]*>([\s\S]*?)<\/td>/) : null;
}

ok('1 table restores the Tiểu thương column, including at Row scope', () => {
  const html = tableAt('2026-03-01');
  assert(/<span class="mb-col-trader">Tiểu thương<\/span>/.test(html));
  assert(traderCell(html, point.id), 'Row-scoped table keeps the trader cell');
});
ok('2–5 current occupant follows selected date; future and ended contracts do not leak', () => {
  let html = tableAt('2026-03-01');
  assert.strictEqual(A.mbOccupantAt(point).id, traders[0].id);
  assert(traderCell(html, point.id)[1].includes(traders[0].name));
  html = tableAt('2026-08-01');
  assert.strictEqual(A.mbOccupantAt(point).id, traders[1].id);
  assert(traderCell(html, point.id)[1].includes(traders[1].name));
  html = tableAt('2027-01-01');
  assert.strictEqual(A.mbOccupantAt(point), null);
  assert.strictEqual(traderCell(html, point.id)[1], '—');
});
ok('6 terminated contract is shown only within its occupying interval', () => {
  let html = tableAt('2026-05-31', terminatedPoint.rowId);
  assert.strictEqual(A.mbOccupantAt(terminatedPoint).id, traders[2].id);
  assert(traderCell(html, terminatedPoint.id)[1].includes(traders[2].name));
  html = tableAt('2026-06-01', terminatedPoint.rowId);
  assert.strictEqual(A.mbOccupantAt(terminatedPoint), null);
  assert.strictEqual(traderCell(html, terminatedPoint.id)[1], '—');
});
ok('7–9 table search uses only the occupant at the selected date', () => {
  tableAt('2026-08-01');
  A.IN['mb-filter-search']({ value: traders[1].name });
  assert.strictEqual(A.mbCurrentPoints('CL').length, 1);
  assert.strictEqual(A.mbCurrentPoints('CL')[0].id, point.id);
  A.IN['mb-filter-search']({ value: traders[0].name });
  assert.strictEqual(A.mbCurrentPoints('CL').length, 0, 'historical trader is not searchable after their contract ends');
});
ok('10–11 no Trader ownership fields are persisted on Point', () => {
  [point, terminatedPoint].forEach(p => {
    assert(!Object.prototype.hasOwnProperty.call(p, 'traderId'));
    assert(!Object.prototype.hasOwnProperty.call(p, 'traderName'));
  });
});

// Harness data is in-memory, but still clean its fixture to avoid test coupling.
A.db.contracts = A.db.contracts.filter(c => !ids.includes(c.id));
A.db.traders = A.db.traders.filter(t => !traders.some(x => x.id === t.id));
A.reindex(); A.mbSetStatusDate(null); A.ui.mb.filter = { search: '', status: '', cat: '', areaType: '' };
console.log(`point-trader-column regression PASS (${passed} checks)`);

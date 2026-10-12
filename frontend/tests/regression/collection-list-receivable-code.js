/* Regression: màn "Thu tiền & biên lai" — cột Mã khoản thu luôn thuộc ĐÚNG khoản phải thu của dòng khi tìm kiếm từng ký tự,
 * đổi bộ lọc trạng thái, sắp xếp và phân trang. Mã được in trực tiếp từ dữ liệu của dòng khi dựng (trước đây cột được thay
 * bằng setTimeout theo vị trí dòng nên gõ nhanh làm hiện mã của dòng khác). Không đổi dữ liệu mã khoản thu / thu tiền.
 * Fixture: seed kỳ 11/2026 nạp như trình duyệt (Tổ trưởng xác nhận dự kiến HĐ sắp hết hạn trước khi phát hành, không sửa seed). */
const assert = require('assert');
const path = require('path');
const { createApp, confirmEndingForSeed } = require('./harness');

const h = createApp(path.resolve(__dirname, '../..'), { seedIssue: true, beforeSeedIssue: confirmEndingForSeed }), A = h.A;
let passed = 0;
const ok = (label, fn) => { try { fn(); passed++; } catch (e) { console.error('FAILED: ' + label); e.message = label + ': ' + e.message; throw e; } };
const login = (id, market) => { A.ui.sessionAccountId = id; A.ui.currentDemoAccountId = id; A.ui.market = market; A.syncAccountContext(); };
login('AC-NV02', 'CL');
A.ui.page = A.ui.page || {};
h.go('thu-tien');
const invoices = A.db.invoices.filter(i => i.billingPeriodId === 'CL_2026-11');
assert(invoices.length > 20, 'fixture: more than one page of CL receivables');
const before = JSON.stringify({ invoices: A.db.invoices, payments: A.db.payments });
const expectedCode = inv => {
  const same = invoices.filter(i => i.traderId === inv.traderId), ordinal = same.indexOf(inv) + 1;
  return 'KPT-CL-202611-' + String(inv.traderId).replace(/[^A-Za-z0-9]/g, '').toUpperCase() + (ordinal > 1 ? '-' + String(ordinal).padStart(2, '0') : '');
};
const codeHtml = (code, id) => '<td><b>' + A.U.esc(code) + '</b><div class="small muted">' + A.U.esc(id) + '</div></td>';
// Mỗi dòng của bảng danh sách thu: tên tiểu thương + ô mã (mã khoản thu + mã PT) phải cùng một khoản phải thu.
function rowsOf(view) {
  const body = view.split('<tbody>')[1] || '';
  return body.split('<tr>').slice(1).map(tr => {
    const name = (tr.match(/^<td><b>([^<]*)<\/b>/) || [])[1], cell = (tr.match(/<\/td><td><b>([^<]*)<\/b><div class="small muted">(PT-[^<]*)<\/div><\/td>/) || []);
    return { name, code: cell[1], invId: cell[2] };
  }).filter(r => r.name);
}
function assertRowsConsistent(label, min) {
  const view = h.view(), rows = rowsOf(view);
  assert(rows.length >= (min || 1), label + ': rows rendered');
  rows.forEach(r => {
    assert(r.code && r.invId, label + ': code cell present for ' + r.name);
    const inv = invoices.find(i => i.id === r.invId);
    assert(inv, label + ': invoice ' + r.invId + ' exists');
    assert.strictEqual(A.U.esc((A.idx.trader.get(inv.traderId) || {}).name || inv.traderId), r.name, label + ': row trader owns ' + r.invId);
    assert.strictEqual(r.code, expectedCode(inv), label + ': code belongs to ' + r.invId);
    assert(view.includes(codeHtml(r.code, r.invId)), label + ': rendered in the row itself');
  });
  return rows;
}

ok('cột "Mã khoản thu" được dựng trực tiếp theo từng dòng (không còn thay cột bằng setTimeout)', () => {
  const v = h.view();
  assert(v.includes('<th class="">Mã khoản thu</th>'), 'header');
  assert(!/<th class="">Mã TT<\/th>/.test(v.split('Danh sách thu')[1] || v), 'old header gone from the collection table');
  assertRowsConsistent('trang 1', 10);
});
ok('gõ tìm kiếm từng ký tự "Nguyễn Thị Hoa" (không xả timer giữa các phím): dòng còn lại mang đúng mã của khoản đó', () => {
  const name = 'Nguyễn Thị Hoa', hoa = invoices.find(i => (A.idx.trader.get(i.traderId) || {}).name === name);
  assert(hoa, 'fixture: Nguyễn Thị Hoa has a CL receivable');
  for (let k = 1; k <= name.length; k++) A.IN['tt-search']({ value: name.slice(0, k) });
  h.flush();
  const rows = assertRowsConsistent('tìm kiếm');
  assert(rows.every(r => r.name === name), 'only her row(s)');
  assert(rows.some(r => r.invId === hoa.id && r.code === expectedCode(hoa)));
});
ok('các tiểu thương khác: tìm theo tên từng người, mã luôn khớp khoản của người đó', () => {
  const names = Array.from(new Set(invoices.map(i => (A.idx.trader.get(i.traderId) || {}).name).filter(Boolean))).slice(0, 12);
  names.forEach(n => {
    for (let k = 1; k <= n.length; k += 3) A.IN['tt-search']({ value: n.slice(0, k) });
    A.IN['tt-search']({ value: n }); h.flush();
    assertRowsConsistent('tìm ' + n).forEach(r => assert.strictEqual(r.name, A.U.esc(n)));
  });
  A.IN['tt-search']({ value: '' }); h.flush();
});
ok('đổi bộ lọc trạng thái + sắp xếp + phân trang: mã vẫn thuộc đúng dòng', () => {
  A.ACT['tt-status']({ dataset: { id: 'UNPAID' } }); h.flush(); assertRowsConsistent('Chưa thu');
  A.ACT['tt-sort']({ dataset: {} }); h.flush(); assertRowsConsistent('sắp xếp theo hạn nộp');
  A.ACT['tt-status']({ dataset: { id: 'all' } }); h.flush();
  const p1 = assertRowsConsistent('trang 1', 10).map(r => r.invId);
  A.ui.page.ttList = 1; A.render(); h.flush();
  const p2 = assertRowsConsistent('trang 2').map(r => r.invId);
  assert(!p2.some(id => p1.includes(id)), 'page 2 shows other receivables');
  A.ui.page.ttList = 0; A.render(); h.flush();
});
ok('dữ liệu khoản phải thu / thu tiền không đổi', () => {
  assert.strictEqual(JSON.stringify({ invoices: A.db.invoices, payments: A.db.payments }), before, 'display-only change');
});
console.log('collection-list-receivable-code regression PASS (' + passed + ' checks)');

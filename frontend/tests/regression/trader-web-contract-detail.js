/* Focused regression: web Tiểu thương › "Hợp đồng & điểm kinh doanh" — chi tiết hợp đồng dạng lưới gọn.
 * Chỉ presentation: không còn "Thông tin khác", "Nhân viên thu phí phụ trách" chỉ ở thẻ Điểm kinh doanh, bảng khoản
 * thu không có STT. Dữ liệu/quan hệ hợp đồng không đổi. */
const assert = require('assert');
const path = require('path');
const { createApp } = require('./harness');

const ROOT = path.resolve(__dirname, '../..');
const TW_ROOT = path.join(ROOT, 'tieu-thuong');
let passed = 0;
const ok = (label, fn) => { try { fn(); passed++; } catch (e) { e.message = label + ': ' + e.message; throw e; } };
const twHtml = h => h.el('#tw-root').innerHTML || '';
const count = (s, x) => s.split(x).length - 1;
const PHONE = '0953200001';

const hb = createApp(ROOT), B = hb.A, TS = B.features.traders.service, BP = B.features.businessPoints.service;
const today = B.U.today(), end = (() => { const d = new Date(today + 'T00:00:00Z'); d.setUTCFullYear(d.getUTCFullYear() + 1); return d.toISOString().slice(0, 10); })();
const t = TS.create({ id: 'TT-CD1', name: 'Tiểu thương TT-CD1', phone: PHONE, idNo: '087000000901', idType: 'CCCD', market: 'CL', stalls: [], source: 'STAFF', since: today, app: false });
const free = B.db.stalls.filter(p => p.market === 'CL' && BP.row(p) && BP.isAvailable(p.id, today, end));
const mkContract = (id, p) => B.features.contracts.service.createWithPointAllocation({ contract: { id, traderId: t.id, stallId: p.id, businessPointId: p.id, market: 'CL', kind: 'Hợp đồng thuê điểm kinh doanh', start: today, end, monthly: 810000, status: 'hieuluc', history: [] }, traderId: t.id, pointId: p.id, pointHistoryEntry: 'test' });
mkContract('HĐ-CD-1', free[0]); mkContract('HĐ-CD-2', free[1]);
B.ACCOUNTS.add({ id: 'AC-CD', code: 'CD', fullName: t.name, phone: PHONE, roleIds: ['trader'], organization: '', marketScopes: [], status: 'ACTIVE', traderIds: [t.id], traderId: t.id });
B.save();
const contractsBefore = JSON.stringify(B.db.contracts), stallsBefore = JSON.stringify(B.db.stalls);

const ht = createApp(TW_ROOT, { localStorage: hb.localStorage }), T = ht.A;
ht.act('tw-back'); T.IN['tw-phone']({ value: PHONE }); ht.act('tw-lookup'); T.IN['tw-otp']({ value: '123456' }); ht.act('tw-verify');
ht.act('merchant-nav', { id: 'contracts' });
const detail = () => { const h = twHtml(ht); return h.slice(h.indexOf('portal-contract-detail')); };
const section = (html, title) => { const i = html.indexOf('<h3>' + title + '</h3>'); return html.slice(i, html.indexOf('</section>', i)); };

ok('master-detail kept: list on the left, selected contract on the right', () => {
  const h = twHtml(ht);
  assert(h.includes('portal-contract-list') && h.includes('portal-contract-detail'));
  assert(h.includes('data-act="mini-contract-select" data-id="HĐ-CD-1"') && h.includes('data-act="mini-contract-select" data-id="HĐ-CD-2"'));
  assert(/portal-contract-choice selected"[^>]*data-id="HĐ-CD-/.test(h));
});

ok('header + contract info grid holds signed date and trader status; no "Thông tin khác"', () => {
  const d = detail();
  assert(/<header class="portal-detail-head"><div><h2>HĐ-CD-\d<\/h2><p>Hợp đồng thuê điểm kinh doanh<\/p><\/div><span class="portal-contract-status current">Đang hiệu lực<\/span><\/header>/.test(d));
  const info = section(d, 'Thông tin hợp đồng');
  ['Thời hạn', 'Chợ', 'Loại hợp đồng', 'Ngày ký hợp đồng', 'Trạng thái tiểu thương'].forEach(x => assert(info.includes('<span>' + x + '</span>'), x));
  assert(!d.includes('Thông tin khác') && !d.includes('portal-contract-other'));
  assert(!d.includes('<span>Trạng thái điểm</span>'), 'point status only as the badge');
});

ok('business point card: badge header + one grid incl. the collector, shown exactly once', () => {
  const d = detail(), card = section(d, 'Điểm kinh doanh thuộc hợp đồng');
  assert(card.includes('portal-point-usage current">Đang thuê'));
  const grid = card.slice(card.indexOf('portal-point-detail-list'));
  ['Vị trí', 'Ngành hàng', 'Diện tích', 'Loại diện tích'].forEach(x => assert(grid.includes('<span>' + x + '</span>'), x));
  assert(count(d, 'Nhân viên thu phí phụ trách') <= 1, 'collector not duplicated');
  const collector = T.ACCOUNTS.getMarketCollector('CL');
  if (collector && typeof T.features.businessPoints.service.pointCollector === 'function' && T.features.businessPoints.service.pointCollector(T.idx.contract.get('HĐ-CD-1').stallId)) {
    assert(grid.includes('Nhân viên thu phí phụ trách'), 'collector inside the point grid');
  }
  assert(!d.includes('portal-point-collector'));
});

ok('charges table without STT, amount right-aligned, policy note kept', () => {
  const charges = section(detail(), 'Giá và các khoản thu áp dụng');
  assert(charges.includes('<div class="portal-charge-head"><span>Khoản thu</span><span>Đơn vị tính</span><span class="num">Mức áp dụng</span><span>Ghi chú</span></div>'));
  assert(!charges.includes('STT'));
  assert(charges.includes(T.U.money(810000)) && charges.includes('Khoản phải thu thực tế được xác định theo chính sách'));
});

ok('selecting another contract still switches the detail; data unchanged', () => {
  ht.act('mini-contract-select', { id: 'HĐ-CD-2' });
  assert(detail().includes('<h2>HĐ-CD-2</h2>'));
  ht.act('mini-contract-select', { id: 'HĐ-CD-1' });
  assert(detail().includes('<h2>HĐ-CD-1</h2>'));
  assert.strictEqual(JSON.stringify(T.db.contracts), contractsBefore);
  assert.strictEqual(JSON.stringify(T.db.stalls), stallsBefore);
});

console.log(`trader-web-contract-detail regression PASS (${passed} checks)`);

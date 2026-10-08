/* Focused regression: trạng thái Hợp đồng ở app tiểu thương (tieu-thuong/index.html → trader-portal screens) dùng CHUNG
 * contracts.service.displayStatus với màn Hợp đồng quản trị: Chưa hiệu lực / Còn hiệu lực / Đã hết hạn (theo ngày);
 * dữ liệu cũ chấm dứt / chờ thanh lý / đã thanh lý chỉ đọc "(dữ liệu cũ)". Hết hạn chỉ là display state:
 * không ghi localStorage, không đổi điểm / hồ sơ / hợp đồng / rentalDraft. */
const assert = require('assert');
const path = require('path');
const { createApp } = require('./harness');

const ROOT = path.resolve(__dirname, '../..'), TW_ROOT = path.join(ROOT, 'tieu-thuong');
let passed = 0;
const ok = (label, fn) => { try { fn(); passed++; } catch (e) { e.message = label + ': ' + e.message; throw e; } };
const PHONE = '0953200077';

// ---- Web quản lý: hồ sơ + tài khoản tiểu thương + hợp đồng ở 3 trạng thái theo ngày + 1 hợp đồng dữ liệu cũ ----
const hb = createApp(ROOT), B = hb.A, TS = B.features.traders.service, BP = B.features.businessPoints.service, billing = B.features.finance.billing;
const today = B.U.today(), add = n => { const d = new Date(today + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
const t = TS.create({ id: 'TT-TWS', name: 'Tiểu thương trạng thái HĐ', phone: PHONE, idNo: '087000000977', idType: 'CCCD', market: 'CL', stalls: [], source: 'STAFF', since: today, app: false });
const free = B.db.stalls.filter(p => p.market === 'CL' && BP.row(p) && BP.isAvailable(p.id, today, add(500)));
const APPLIES = { electricity: false, water: false, marketService: false };
const mk = (id, p, start, end) => B.features.contracts.service.createWithPointAllocation({ contract: { id, traderId: t.id, stallId: p.id, businessPointId: p.id, market: 'CL', kind: 'Hợp đồng thuê điểm kinh doanh', start, end, status: 'ACTIVE', history: [], serviceApplicability: APPLIES, priceTerms: billing.buildPriceTerms('CL', p, p.area, start, APPLIES, 'CONTRACT') }, traderId: t.id, pointId: p.id, pointHistoryEntry: 'test' });
assert(mk('HĐ-TWS-UP', free[0], add(20), add(380)), 'upcoming');
assert(mk('HĐ-TWS-ON', free[1], today, add(300)), 'active');
assert(mk('HĐ-TWS-EXP', free[2], today, add(100)), 'to expire');
// Thời gian trôi qua: hợp đồng thứ 3 đã hết hạn (không qua luồng nào — hết hạn không có side effect).
const exp = B.features.contracts.service.get('HĐ-TWS-EXP'); exp.start = add(-400); exp.end = add(-10);
// Dữ liệu cũ do luồng trước đây sinh ra (chờ thanh lý vì hết hạn) — chỉ đọc.
B.db.contracts.push({ id: 'HĐ-TWS-LEG', traderId: t.id, stallId: free[3].id, businessPointId: free[3].id, market: 'CL', start: add(-800), end: add(-200), status: 'PENDING_LIQUIDATION', endReason: 'EXPIRED', history: [], serviceApplicability: APPLIES, priceTerms: billing.buildPriceTerms('CL', free[3], free[3].area, add(-800), APPLIES, 'CONTRACT') });
B.reindex();
B.ACCOUNTS.add({ id: 'AC-TWS', code: 'TWS', fullName: t.name, phone: PHONE, roleIds: ['trader'], organization: '', marketScopes: [], status: 'ACTIVE', traderIds: [t.id], traderId: t.id });
B.save();
const storage = () => JSON.stringify(Array.from(hb.localStorage._m.entries()).filter(([k]) => !/session|guide|ui/i.test(k)));

// ---- App tiểu thương: đăng nhập + mở "Hợp đồng & điểm kinh doanh" ----
const ht = createApp(TW_ROOT, { localStorage: hb.localStorage }), T = ht.A;
ht.act('tw-back'); T.IN['tw-phone']({ value: PHONE }); ht.act('tw-lookup'); T.IN['tw-otp']({ value: '123456' }); ht.act('tw-verify');
const storageAfterLogin = storage();
ht.act('merchant-nav', { id: 'contracts' });
const html = () => ht.el('#tw-root').innerHTML || '';
const select = id => { ht.act('mini-contract-select', { id }); return html(); };
const header = h => (h.match(/<header class="portal-detail-head">[\s\S]*?<\/header>/) || [''])[0];
const choice = (h, id) => { const i = h.indexOf(`data-id="${id}"`); return h.slice(i, h.indexOf('</button>', i)); };

ok('CASE 1: start > today → "Chưa hiệu lực"', () => {
  assert(/>Chưa hiệu lực</.test(choice(html(), 'HĐ-TWS-UP')));
  assert(/portal-contract-status upcoming">Chưa hiệu lực</.test(header(select('HĐ-TWS-UP'))));
});
ok('CASE 2: today in [start, end] → "Còn hiệu lực"', () => {
  assert(/portal-contract-status current">Còn hiệu lực</.test(header(select('HĐ-TWS-ON'))));
  assert(html().includes('portal-point-usage current">Đang thuê'));
});
ok('CASE 3: today > end → "Đã hết hạn" + warning; point still "Đang thuê"; no action', () => {
  const h = select('HĐ-TWS-EXP');
  assert(/portal-contract-status expired">Đã hết hạn</.test(header(h)));
  assert(h.includes(`Hợp đồng này đã hết hạn từ ngày ${T.U.dmy(add(-10))}.`));
  assert(h.includes('portal-point-usage current">Đang thuê'), 'expiry does not release the point');
  assert(!/Gia hạn|Chấm dứt|Thanh lý hợp đồng/.test(h), 'no renew / terminate / liquidate CTA');
});
ok('CASE 6 + CASE 7: a contract that only passed its end date is never "Chờ thanh lý" / "Đã kết thúc"', () => {
  const h = html();
  assert(!/Chờ thanh lý<|Đã kết thúc|Đã chấm dứt</.test(choice(h, 'HĐ-TWS-EXP')) && !/Chờ thanh lý<|Đã kết thúc/.test(header(select('HĐ-TWS-EXP'))));
  ['HĐ-TWS-UP', 'HĐ-TWS-ON', 'HĐ-TWS-EXP'].forEach(id => assert(!/Đã kết thúc|Chờ thanh lý<|Đã chấm dứt<|Đã thanh lý</.test(choice(html(), id)), id));
  assert(!html().includes('Đã kết thúc'), '"Đã kết thúc" is gone from the trader app');
});
ok('CASE 5: legacy PENDING_LIQUIDATION still readable, read-only "(dữ liệu cũ)", no crash', () => {
  const h = select('HĐ-TWS-LEG');
  assert(/Chờ thanh lý \(dữ liệu cũ\)/.test(header(h)), header(h));
  assert(!h.includes('đã hết hạn từ ngày'), 'legacy record is not re-labelled');
  assert.strictEqual(T.features.contracts.service.get('HĐ-TWS-LEG').status, 'PENDING_LIQUIDATION', 'not migrated');
});
ok('CASE 4: rendering expired / legacy contracts writes nothing (contract, point, trader, rentalDraft, storage)', () => {
  ['HĐ-TWS-EXP', 'HĐ-TWS-LEG', 'HĐ-TWS-ON', 'HĐ-TWS-UP'].forEach(select);
  ht.act('merchant-nav', { id: 'home' }); ht.act('merchant-nav', { id: 'contracts' });
  assert.strictEqual(storage(), storageAfterLogin, 'localStorage unchanged by status display');
  const c = T.features.contracts.service.get('HĐ-TWS-EXP'), p = T.features.businessPoints.service.get(free[2].id);
  assert.strictEqual(c.status, 'ACTIVE'); assert(!c.endReason);
  assert.strictEqual(p.usageStatus, 'RENTED'); assert.strictEqual(p.traderId, t.id);
  assert(T.features.traders.service.getProfile(t.id).stalls.includes(free[2].id), 'trader-point link kept');
});
console.log(`trader-contract-status regression PASS (${passed} checks)`);

/* Khóa giá theo HĐ: HĐ chụp bảng giá tại ngày bắt đầu; billing đọc giá đã khóa, không đọc giá hiện hành;
 * chi tiết đơn giá hiển thị số HĐ đang dùng mức giá. */
const assert = require('assert');
const path = require('path');
const { createApp } = require('./harness');

const h = createApp(path.resolve(__dirname, '../..'));
const A = h.A, SC = A.SERVICE_CFG, billing = A.features.finance.billing;
const login = (id, market) => { A.ui.sessionAccountId = id; A.ui.market = market; A.syncAccountContext(); };
// Danh sách HĐ trong chi tiết mặc định thu gọn — bấm nút mới sổ ra.
const expand = (cat, id) => { assert(h.modal().includes('data-act="price-ct-toggle"')); h.act('price-ct-toggle', { cat, id }); };
const oldLand = SC.get('stallPrices', 'sp-cl-kiot-v1'), newLand = SC.get('stallPrices', 'sp-cl-kiot-v2');
assert(oldLand && newLand);
assert.strictEqual(oldLand.effectiveTo, '2026-08-31');

// Mọi HĐ đều có bảng giá đã khóa (migration LEGACY chụp theo ngày bắt đầu HĐ).
assert(A.db.contracts.every(c => c.priceTerms));
const kiot = A.db.contracts.find(c => c.market === 'CL' && c.status === 'ACTIVE' && c.priceTerms.land && c.priceTerms.land.policyId === oldLand.id);
assert(kiot, 'HĐ ki-ốt cũ phải giữ đơn giá v1');
assert.strictEqual(kiot.priceTerms.land.amount, 2000);

// HĐ mới ký từ 01/09/2026 chụp đơn giá v2.
const st = A.idx.stall.get(kiot.businessPointId || kiot.stallId);
const fresh = billing.buildPriceTerms('CL', st, st.area, '2026-09-15', { electricity: true, water: true }, 'CONTRACT');
assert.strictEqual(fresh.land.policyId, newLand.id);
assert.strictEqual(fresh.land.amount, 2500);


// HĐ mẫu ký 01/09/2026 (TT0049) khóa đơn giá v2.
const fresh2 = A.db.contracts.find(c => c.traderId === 'TT0049');
assert(fresh2 && fresh2.priceTerms.land.policyId === newLand.id);

// Màn Mặt bằng: chỉ 2 trạng thái, không còn Khóa / Mở khóa / Vô hiệu hóa.
login('AC-NV01', 'CL');
h.go('cau-hinh-gia');
// Màn Chính sách thu = cấu hình mức thu theo chợ: lịch sử mức giá nằm trong chi tiết chợ, tab tương ứng.
h.act('fcm-open', { id: 'CL' }); h.act('fcm-dtab', { id: 'land' });
assert(h.view().includes('Ngừng áp dụng từ 01/09/2026'));
assert(h.view().includes('Đang áp dụng'));
assert(!/Vô hiệu hóa|Mở khóa|>Khóa<|Hết hiệu lực/.test(h.view()));

// Xem dòng 2.000: liệt kê HĐ ki-ốt cũ; dòng 2.500: liệt kê HĐ ký 01/09/2026. Không có nút Vô hiệu hóa.
h.act('policy-land-view', { id: oldLand.id });
const used = A.db.contracts.filter(c => (c.status === 'ACTIVE' || c.status === 'hieuluc') && c.end >= (A.db.today || A.U.today()) && c.priceTerms.land && c.priceTerms.land.policyId === oldLand.id).length;
assert(used > 0);
assert(h.modal().includes('Hợp đồng đang dùng: <b>' + used + ' hợp đồng</b>'));
assert(h.modal().includes('HỢP ĐỒNG ĐANG ÁP DỤNG MỨC GIÁ NÀY (' + used + ')'));
assert(!h.modal().includes(kiot.id), 'mặc định thu gọn');
expand('stallPrices', oldLand.id);
assert(h.modal().includes(kiot.id) && h.modal().includes('data-ch="price-ct-market"') && h.modal().includes('data-in="price-ct-q"'));
// Tìm theo tên tiểu thương (không dấu) / lọc chợ: chỉ còn dòng khớp; bộ lọc chợ ngoài danh sách → không còn dòng nào.
const kiotTrader = A.idx.trader.get(kiot.traderId);
A.IN['price-ct-q']({ value: kiot.id });
// Harness dùng DOM giả: vẽ lại (thu gọn rồi mở lại, giữ bộ lọc) để đếm dòng hiển thị.
const visible = () => { h.act('price-ct-toggle', { cat: 'stallPrices', id: oldLand.id }); h.act('price-ct-toggle', { cat: 'stallPrices', id: oldLand.id }); return (h.modal().match(/<tr data-market="[^"]*" data-q="[^"]*">/g) || []).length };
assert.strictEqual(visible(), 1);
A.IN['price-ct-q']({ value: kiotTrader.name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').toLowerCase() });
assert(visible() >= 1 && visible() < used);
A.IN['price-ct-q']({ value: '' });
A.CH['price-ct-market']({ value: 'CL' });
assert.strictEqual(visible(), used);
A.IN['price-ct-q']({ value: 'khong-co-hop-dong-nay' });
assert.strictEqual(visible(), 0);
assert(h.modal().includes('data-ct-empty style="margin-top:6px"'), 'hiện thông báo không có HĐ phù hợp');
A.IN['price-ct-q']({ value: '' }); A.CH['price-ct-market']({ value: '' });
assert.strictEqual(visible(), used);
h.act('price-ct-toggle', { cat: 'stallPrices', id: oldLand.id });
assert(!h.modal().includes(kiot.id), 'thu gọn lại');
assert(!h.modal().includes('Vô hiệu hóa') && !h.modal().includes('price-cancel-open'), 'mức có HĐ dùng: không có nút Hủy');
h.act('policy-land-view', { id: newLand.id });
assert(h.modal().includes('HỢP ĐỒNG ĐANG ÁP DỤNG MỨC GIÁ NÀY (1)') && !h.modal().includes(fresh2.id));
expand('stallPrices', newLand.id);
assert(h.modal().includes(fresh2.id));

// Hủy mức đang có HĐ dùng → bị chặn (gọi thẳng handler).
h.act('price-cancel', { cat: 'stallPrices', id: oldLand.id });
assert.strictEqual(oldLand.status, 'active');
assert(h.trace.toasts.some(x => /đang có hợp đồng áp dụng/.test(x)));

// Giá điện mới từ 01/11/2026 qua form: giá cũ "Ngừng áp dụng từ 01/11/2026", vẫn active; HĐ cũ vẫn tính giá cũ.
const oldElec = kiot.priceTerms.electricity, elecRecord = SC.get('utilities', oldElec.policyId);
assert(oldElec && elecRecord && elecRecord.marketId === 'CL');
const file = { name: 'qd-dien.pdf', type: 'application/pdf', size: 1, mock: true };
const elecCount = () => SC.list('utilities').length;
h.act('fcm-dtab', { id: 'electricity' });
const before = elecCount();
A.ui.feeForm = { tab: 'electricity', marketId: 'CL', name: '', calcMethod: 'fixed', amount: oldElec.price + 900, effectiveFrom: '2026-11-15', effectiveTo: '', file };
h.act('fee-save', {});
assert.strictEqual(elecCount(), before, 'ngày hiệu lực khác 01 bị chặn');
A.ui.feeForm = { tab: 'electricity', marketId: 'CL', name: '', calcMethod: 'fixed', amount: oldElec.price + 900, effectiveFrom: '2026-11-01', effectiveTo: '', file };
h.act('fee-save', {});
assert.strictEqual(elecCount(), before + 1);
const newElec = SC.list('utilities').find(x => x.previousVersionId === elecRecord.id && x.status === 'active');
assert(newElec);
assert.strictEqual(elecRecord.effectiveTo, '2026-10-31');
assert.strictEqual(elecRecord.status, 'active');
assert(h.view().includes('Ngừng áp dụng từ 01/11/2026'));
h.act('fee-view', { cat: 'utilities', id: elecRecord.id });
assert(h.modal().includes('Ngừng áp dụng từ 01/11/2026'));
assert(/HỢP ĐỒNG ĐANG ÁP DỤNG MỨC GIÁ NÀY \([1-9]/.test(h.modal()));
expand('utilities', elecRecord.id);
assert(h.modal().includes(kiot.id));

const bp = A.db.billingPeriods.find(p => p.marketId === 'CL' && p.period === '2026-11');
assert(bp);
bp.meter = Object.assign({}, bp.meter, { status: 'COMPLETED' });
const out = billing.calculatePeriod('CL', bp.id);
const mine = out.drafts.filter(d => d.contractId === kiot.id);
const land = mine.find(d => d.items[0].chargeType === 'LAND');
assert(land, 'phải có dòng mặt bằng của HĐ');
assert.strictEqual(land.items[0].policyId, oldLand.id);
assert.strictEqual(land.items[0].unitPrice, 2000);
const land2 = out.drafts.find(d => d.contractId === fresh2.id && d.items[0].chargeType === 'LAND');
assert(land2 && land2.items[0].unitPrice === 2500, 'HĐ mới tính 2.500');
const elec = mine.find(d => d.items[0].chargeType === 'ELECTRICITY');
if (elec) assert.strictEqual(elec.items[0].unitPrice, oldElec.price);

// Tài khoản không có quyền gọi thẳng handler → không đổi dữ liệu.
login('AC-LD01', 'CL');
h.act('price-cancel', { cat: 'utilities', id: newElec.id });
assert.strictEqual(newElec.status, 'active');
const n0 = elecCount();
A.ui.feeForm = { tab: 'electricity', marketId: 'CL', name: '', calcMethod: 'fixed', amount: 9999, effectiveFrom: '2026-12-01', effectiveTo: '', file };
h.act('fee-save', {});
assert.strictEqual(elecCount(), n0);

// Hủy mức nhập sai (chưa HĐ nào dùng) → mức cũ áp dụng lại.
login('AC-NV01', 'CL');
h.act('fee-view', { cat: 'utilities', id: newElec.id });
assert(h.modal().includes('price-cancel-open'));
h.act('price-cancel', { cat: 'utilities', id: newElec.id });
assert.strictEqual(newElec.status, 'cancelled');
assert.strictEqual(elecRecord.effectiveTo, null);
h.act('fcm-dtab', { id: 'electricity' });
assert(!h.view().includes('data-id="' + newElec.id + '"'), 'mức đã hủy ẩn khỏi bảng');

// Danh sách HĐ trong drawer không chứa HĐ ngoài marketScopes.
const outside = A.db.contracts.find(c => c.market === 'TTD' && (c.status === 'ACTIVE' || c.status === 'hieuluc') && c.priceTerms);
assert(outside);
outside.priceTerms.land = Object.assign({}, outside.priceTerms.land, { policyId: oldLand.id });
const acc = A.currentAccount(), scopes = acc.marketScopes;
acc.marketScopes = ['CL']; A.syncAccountContext();
h.act('policy-land-view', { id: oldLand.id });
expand('stallPrices', oldLand.id);
assert(h.modal().includes(kiot.id) && !h.modal().includes(outside.id));
acc.marketScopes = scopes; A.syncAccountContext();

console.log('contract price lock regression PASS');

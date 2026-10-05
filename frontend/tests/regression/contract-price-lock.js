/* Khóa giá theo HĐ: HĐ chụp bảng giá tại ngày bắt đầu; billing đọc giá đã khóa, không đọc giá hiện hành;
 * chi tiết đơn giá hiển thị số HĐ đang dùng mức giá. */
const assert = require('assert');
const path = require('path');
const { createApp } = require('./harness');

const h = createApp(path.resolve(__dirname, '../..'));
const A = h.A, SC = A.SERVICE_CFG, billing = A.features.finance.billing;
const login = (id, market) => { A.ui.sessionAccountId = id; A.ui.market = market; A.syncAccountContext(); };
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

// Giá điện mới từ kỳ 11 không làm đổi khoản của HĐ đã khóa giá điện cũ.
const oldElec = kiot.priceTerms.electricity;
assert(oldElec && oldElec.price > 0);
const elecRecord = SC.get('utilities', oldElec.policyId);
SC.add('utilities', Object.assign({}, elecRecord, { id: undefined, history: [], attachments: [], elecPrice: oldElec.price + 900, effectiveFrom: '2026-11-01', effectiveTo: null, status: 'active' }), 'test');

const bp = A.db.billingPeriods.find(p => p.marketId === 'CL' && p.period === '2026-11');
assert(bp);
bp.meter = Object.assign({}, bp.meter, { status: 'COMPLETED' });
const out = billing.calculatePeriod('CL', bp.id);
const mine = out.drafts.filter(d => d.contractId === kiot.id);
const land = mine.find(d => d.items[0].chargeType === 'LAND');
assert(land, 'phải có dòng mặt bằng của HĐ');
assert.strictEqual(land.items[0].policyId, oldLand.id);
assert.strictEqual(land.items[0].unitPrice, 2000);
const elec = mine.find(d => d.items[0].chargeType === 'ELECTRICITY');
if (elec) assert.strictEqual(elec.items[0].unitPrice, oldElec.price);

// Chi tiết đơn giá: "Hợp đồng đang dùng: n hợp đồng" ở đầu; mặt bằng không còn nút Vô hiệu hóa.
login('AC-NV01', 'CL');
h.go('cau-hinh-gia');
A.ui.cfgTab = 'land'; A.render();
h.act('policy-land-view', { id: oldLand.id });
const used = A.db.contracts.filter(c => (c.status === 'ACTIVE' || c.status === 'hieuluc') && c.end >= (A.db.today || A.U.today()) && c.priceTerms.land && c.priceTerms.land.policyId === oldLand.id).length;
assert(used > 0);
assert(h.modal().includes('Hợp đồng đang dùng: <b>' + used + ' hợp đồng</b>'));
assert(!h.modal().includes('policy-land-disable-open'));
h.act('policy-land-view', { id: newLand.id });
assert(h.modal().includes('Hợp đồng đang dùng: <b>0 hợp đồng</b>'));
h.act('fee-view', { cat: 'utilities', id: oldElec.policyId });
assert(/Hợp đồng đang dùng: <b>[1-9]\d* hợp đồng<\/b>/.test(h.modal()));

console.log('contract price lock regression PASS');

/* Sơ đồ và Danh sách điểm KD phải gọi cùng một drawer, cùng dữ liệu hợp đồng. */
const assert = require('assert');
const path = require('path');
const { createApp } = require('./harness');

const h = createApp(path.resolve(__dirname, '../..'));
const A = h.A, BP = A.features.businessPoints.service, CS = A.features.contracts.service;
A.ui.sessionAccountId = 'AC-NV01'; A.ui.currentDemoAccountId = 'AC-NV01'; A.ui.market = 'CL'; A.syncAccountContext();

const point = BP.list().find(p => p.market === 'CL' && (c => c && c.priceTerms && c.priceTerms.land)(BP.contractOn(p.id, A.U.today())));
assert(point, 'fixture has an occupied point with a price-terms snapshot');
const contract = BP.contractOn(point.id, A.U.today());
const before = JSON.stringify({ point, contract, traders: A.db.traders });

h.go('mat-bang');
h.act('stall', { id: point.id });
const fromMap = h.modal();
assert(fromMap.includes(point.code), 'map drawer shows selected point');
assert(fromMap.includes('THÔNG TIN ĐIỂM KINH DOANH'));
assert(fromMap.includes('MỨC THU THEO HỢP ĐỒNG'));
assert(fromMap.includes(A.U.money(contract.priceTerms.land.amount)), 'uses contract price snapshot');
assert(!fromMap.includes('Giá dịch vụ/tháng'), 'does not render an unrelated fixed service price');
assert(!fromMap.includes('Đơn giá áp dụng'), 'does not fall back to point/reference price');

h.act('close');
h.act('mb-view', { id: 'table' });
h.act('dk-open', { id: point.id });
const fromList = h.modal();
assert.strictEqual(fromList, fromMap, 'map and list use exactly the same drawer renderer');
assert(fromList.includes(contract.id), 'linked contract is shown');
assert(fromList.includes('Trạng thái hợp đồng'), 'current contract status is kept in the usage section');
assert(!fromList.includes('HỢP ĐỒNG TẠI ĐIỂM'), 'does not duplicate contract history in the drawer');
assert(!fromList.includes('data-act="ct-view"') && !fromList.includes('data-act="dkcl-open-trader"'), 'does not render navigation actions in the drawer');
h.act('close');
const vacant = BP.list().find(p => p.market === 'CL' && !BP.contractOn(p.id, A.U.today()));
assert(vacant, 'fixture has a vacant point');
h.act('dk-open', { id: vacant.id });
const vacantDrawer = h.modal();
assert(vacantDrawer.includes('Đang trống'), 'vacant point keeps its empty state');
assert(!vacantDrawer.includes('MỨC THU THEO HỢP ĐỒNG'), 'vacant point does not show price from an inactive contract');
assert(!vacantDrawer.includes('HỢP ĐỒNG TẠI ĐIỂM'), 'vacant point does not show historical contracts in the drawer');
h.act('close');
assert.strictEqual(JSON.stringify({ point, contract, traders: A.db.traders }), before, 'open/close only reads data');

console.log('business-point-unified-drawer regression PASS (17 checks)');

/* Focused end-to-end billing regression. Uses the real prototype modules with a
 * local fixture so the demo seed and approved baselines are never rewritten. */
const assert = require('assert');
const path = require('path');
const { createApp } = require('./harness');

const h = createApp(path.resolve(__dirname, '../..'));
const A = h.A;
A.ui.sessionAccountId = 'AC-NV01'; A.ui.market = 'CL'; A.syncAccountContext();
// Luồng này kiểm tra phát hành THEO NGUỒN (1 khoản / nguồn thu). Chợ Cao Lãnh cấu hình receivableGrouping
// 'TRADER' (gộp 1 khoản / tiểu thương / kỳ — nhánh Tài chính); tắt cấu hình trong phạm vi test để giữ nguyên
// các khẳng định theo nguồn bên dưới.
const clMarket = (A.D.MARKETS || []).find(m => m.id === 'CL'); if (clMarket) delete clMarket.receivableGrouping;

// Isolate official financial output; configuration stays in its existing store.
A.db.invoices = []; A.db.payments = []; A.db.billingDrafts = []; A.db.billingWarnings = [];
A.db.stalls = [
  { id: 'HS-A06', code: 'HS-A06', market: 'CL', type: 'kiot', areaTypeId: 'covered', cat: 'Thực phẩm', area: 4.3, status: 'thue', traderId: 'TT0275', hasMeter: true },
  { id: 'HS-A07', code: 'HS-A07', market: 'CL', type: 'kiot', areaTypeId: 'covered', cat: 'Thực phẩm', area: 3, status: 'thue', traderId: 'TT0275', hasMeter: false }
];
A.db.traders = [{ id: 'TT0275', name: 'Nguyễn Văn A', market: 'CL', stalls: ['HS-A06', 'HS-A07'] }];
A.db.contracts = [
  { id: 'HĐ001', market: 'CL', traderId: 'TT0275', stallId: 'HS-A06', businessPointId: 'HS-A06', start: '2026-01-01', end: '2026-12-31', status: 'ACTIVE', serviceApplicability: { electricity: true, water: true, marketService: true } },
  { id: 'HĐ002', market: 'CL', traderId: 'TT0275', stallId: 'HS-A07', businessPointId: 'HS-A07', start: '2026-01-01', end: '2026-12-31', status: 'ACTIVE', serviceApplicability: { electricity: false, water: false, marketService: true } }
];
A.db.readings = [{ stallId: 'HS-A06', period: '2026-09', elecPrev: 100, elecCur: 120, elecAvg: 15, waterPrev: 20, waterCur: 25, waterAvg: 4, status: 'RECORDED' }];
A.db.traderVehicles = [{ id: 'VEH-001', traderId: 'TT0275', market: 'CL', type: 'MOTORBIKE', plateNumber: '66H1-12345', startDate: '2026-01-01', endDate: null, status: 'ACTIVE' }];
A.db.billingPeriods = [{ id: 'CL_2026-09', marketId: 'CL', period: '2026-09', label: '09/2026', startDate: '2026-09-01', endDate: '2026-09-30', dueDate: '2026-10-15', meter: { status: 'COMPLETED' } }];
A.db.issuedPeriods = [];
A.reindex();

// Isolate one opted-in market service and one structured vehicle policy; no
// price is stored on the vehicle record.
A.SERVICE_CFG.list('extraServices').filter(x => x.marketId === 'CL' && x.category !== 'VEHICLE').forEach(x => { x.status = 'inactive'; });
A.SERVICE_CFG.add('extraServices', { name: 'Vệ sinh', category: 'GENERAL', marketId: 'CL', calcMethod: 'fixed', amount: 20000, unit: 'đ/tháng', collectionCycle: 'MONTH', effectiveFrom: '2026-01-01', effectiveTo: null, status: 'active', legalBasis: { docNo: 'P-DV', effectiveDate: '2026-01-01' } }, 'test');
const vehiclePolicy = A.SERVICE_CFG.add('extraServices', { name: 'Phí xe máy', category: 'VEHICLE', vehicleType: 'MOTORBIKE', marketId: 'CL', calcMethod: 'fixed', amount: 70000, unit: 'đ/tháng', collectionCycle: 'MONTH', effectiveFrom: '2026-01-01', effectiveTo: null, status: 'active', legalBasis: { docNo: 'P-XE', effectiveDate: '2026-01-01' } }, 'test');
const billing = A.features.finance.billing;

let out = billing.calculatePeriod('CL', '2026-09');
assert.strictEqual(out.warnings.filter(x => x.severity === 'BLOCKING').length, 0);
assert.strictEqual(out.drafts.length, 6, 'two land + electricity + water + two service policies');

A.db.readings[0].elecCur = 130;
out = billing.calculatePeriod('CL', '2026-09');
assert(out.warnings.some(x => x.code === 'ABNORMAL_CONSUMPTION' && x.severity === 'BLOCKING'));
assert.strictEqual(out.warnings.some(x => x.severity === 'BLOCKING'), true, 'unreviewed abnormal meter reading blocks issue');
A.db.readings[0].elecCur = 120;

// A second calculation replaces only mutable drafts; it never duplicates them.
out = billing.calculatePeriod('CL', '2026-09');
assert.strictEqual(billing.drafts('CL', '2026-09').length, 6);

const issued = billing.issue('CL', '2026-09', 'Trưởng BQL');
assert.strictEqual(issued.issued.length, 1, 'one issued invoice per trader / market period');
assert.strictEqual(A.db.billingDrafts.length, 0);
assert(A.db.invoices.every(x => x.billingStatus === 'PUBLISHED' && x.items.every(i => i.status === 'PUBLISHED')));

const total = A.db.invoices.reduce((sum, x) => sum + x.amount, 0);
const payments = A.applyPayment(A.db.invoices.map(x => x.id), total, 'tm', 'NV01');
assert.strictEqual(payments.length, 1);
assert.strictEqual(A.U.traderDebt('TT0275'), 0);

// Meter source failures block issuance for the affected period.
A.db.invoices = []; A.db.payments = []; A.db.billingDrafts = []; A.db.billingWarnings = [];
delete A.db.billingPeriods[0].issuance;
A.db.readings[0].elecCur = null;
out = billing.calculatePeriod('CL', '2026-09');
assert(out.warnings.some(x => x.code === 'MISSING_METER_READING' && x.severity === 'BLOCKING'));
A.db.readings[0].elecCur = 90;
out = billing.calculatePeriod('CL', '2026-09');
assert(out.warnings.some(x => x.code === 'INVALID_METER_READING' && x.severity === 'BLOCKING'));

console.log('billing flow regression PASS');

/* Focused regression: "Khoản phải thu → Xem chi tiết" shows the months / explanation of the STORED charge lines.
 * Issued receivables are immutable: their months come from the lines themselves (chargeMonth / feePeriod), never from
 * the calculation rule now in force; meter lines may be re-explained for display from the stored readings and price
 * unit (kWh / m³), without writing anything. No "old rule" label is invented (no reliable version metadata). */
const assert = require('assert');
const path = require('path');
const { createApp } = require('./harness');

const ROOT = path.resolve(__dirname, '../..');
let passed = 0;
const ok = (label, fn) => { try { fn(); passed++; } catch (e) { e.message = label + ': ' + e.message; throw e; } };
const text = html => html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
const detail = (h, traderId, periodId) => {
  const A = h.A;
  A.ui.sessionAccountId = 'AC-NV01'; A.ui.currentDemoAccountId = 'AC-NV01'; A.ui.market = 'CL'; A.syncAccountContext();
  h.go('phai-thu'); h.act('pt-new-detail', { trader: traderId, period: periodId });
  return text(h.modal());
};

// ---- A. New engine: round CL_2026-11 calculated (not issued) ----
{
  const h = createApp(ROOT), A = h.A, MP = A.features.finance.marketPeriod, B = A.features.finance.billing;
  MP.ensurePeriodsForCurrentCycle();
  const mp = MP.get('CL', '2026-11');
  MP.meterPoints(mp).forEach(st => { if (!MP.readingOf(mp, st.id)) A.db.readings.push({ stallId: st.id, billingPeriodId: mp.id, period: '2026-11', elecPrev: 1000, elecCur: 1180, waterPrev: 100, waterCur: 110, reviewedAt: '2026-10-28' }); });
  mp.meter = { status: 'COMPLETED', mode: 'RECORDED' };
  B.calculatePeriod('CL', mp.id, 'test');
  const t = detail(h, 'TT0001', mp.id);
  ok('new lines: note follows the drafted lines (usage 10, land 11, meter window, 30-day convention)', () => {
    assert(/Tháng tính phí theo các dòng khoản: Điện, nước tháng 10\/2026 \(chỉ số 25\/09\/2026 → 25\/10\/2026\) · Mặt bằng tháng 11\/2026 \(quy ước tháng 30 ngày\)/.test(t), t.slice(0, 400));
  });
  ok('new lines: titles, explanation, consumption unit and amounts agree', () => {
    assert(/Mặt bằng 11\/2026 840\.000 đ 14 m² × 2\.000 đ\/m²\/ngày × 30 ngày \(đủ tháng, quy ước 30 ngày\) = 840\.000 đ · Tháng tính phí 11\/2026/.test(t));
    assert(/Điện 10\/2026 579\.200 đ 8\.391 − 8\.210 = 181 kWh · 181 kWh × 3\.200 đ = 579\.200 đ · Tháng tính phí 10\/2026/.test(t));
    assert(/Nước 10\/2026 120\.000 đ 518 − 508 = 10 m³ · 10 m³ × 12\.000 đ = 120\.000 đ · Tháng tính phí 10\/2026/.test(t));
    assert(!/\d đ\/kWh|\d đ\/m³ ·/.test(t), 'no price unit used as consumption unit');
  });
}

// ---- B. Issued receivable whose lines have the shape produced before the 10/2026 month rules ----
{
  const h = createApp(ROOT, { seedIssue: true }), A = h.A, MP = A.features.finance.marketPeriod;
  const mp = MP.get('CL', '2026-11');
  const inv = A.db.invoices.find(i => i.traderId === 'TT0001' && i.billingPeriodId === mp.id);
  assert(inv && MP.isIssued(mp), 'fixture: issued CL_2026-11 receivable');
  // Exactly the stored shape seen in the browser (old engine): no chargeMonth / quantityUnit / usageWindow / billableDays.
  inv.items = [
    { id: 'ITEM-LAND', chargeType: 'LAND', name: 'Mặt bằng 12/2026', quantity: 14, unit: 'đ/m²/ngày', unitPrice: 2000, days: 31, feePeriod: '2026-12', amount: 868000, explanation: '14 m² × 2.000 đ/m²/ngày × 31 ngày', contractId: 'HĐ-CL-2025-0001', stallId: 'CL-KA-A01', status: 'PUBLISHED' },
    { id: 'ITEM-EL', chargeType: 'ELECTRICITY', name: 'Điện 11/2026', meter: { previous: 8210, current: 8391, consumption: 181 }, quantity: 181, unit: 'đ/kWh', unitPrice: 3200, feePeriod: '2026-11', amount: 579200, explanation: '8.391 − 8.210 = 181 đ/kWh', contractId: 'HĐ-CL-2025-0001', stallId: 'CL-KA-A01', status: 'PUBLISHED' },
    { id: 'ITEM-WA', chargeType: 'WATER', name: 'Nước 11/2026', meter: { previous: 508, current: 518, consumption: 10 }, quantity: 10, unit: 'đ/m³', unitPrice: 12000, feePeriod: '2026-11', amount: 120000, explanation: '518 − 508 = 10 đ/m³', contractId: 'HĐ-CL-2025-0001', stallId: 'CL-KA-A01', status: 'PUBLISHED' }
  ];
  inv.amount = 868000 + 579200 + 120000;
  A.save();
  // Navigating to the screen seeds personal notifications (existing, unrelated) — snapshot after it, so the check
  // isolates what opening the detail does.
  A.ui.sessionAccountId = 'AC-NV01'; A.ui.currentDemoAccountId = 'AC-NV01'; A.ui.market = 'CL'; A.syncAccountContext(); h.go('phai-thu');
  const invBefore = JSON.stringify(inv), storageBefore = Array.from(h.localStorage._m.values()).join('');
  const t = detail(h, 'TT0001', mp.id);
  ok('old lines: note derived from the stored lines (11 for meter, 12 for land), no invented window / convention / version label', () => {
    assert(/Tháng tính phí theo các dòng khoản: Điện, nước tháng 11\/2026 · Mặt bằng tháng 12\/2026 ?\./.test(t), t.slice(0, 400));
    assert(!/25\/09\/2026|quy ước tháng 30 ngày|trước 10\/2026|quy tắc cũ/.test(t), 'no metadata the lines do not carry');
  });
  ok('old lines: titles / months / amounts as issued; meter explanation rebuilt with the consumption unit (display only)', () => {
    assert(/Mặt bằng 12\/2026 868\.000 đ 14 m² × 2\.000 đ\/m²\/ngày × 31 ngày = 868\.000 đ · Tháng tính phí 12\/2026/.test(t));
    assert(/Điện 11\/2026 579\.200 đ 8\.391 − 8\.210 = 181 kWh · 181 kWh × 3\.200 đ = 579\.200 đ · Tháng tính phí 11\/2026/.test(t));
    assert(/Nước 11\/2026 120\.000 đ 518 − 508 = 10 m³ · 10 m³ × 12\.000 đ = 120\.000 đ · Tháng tính phí 11\/2026/.test(t));
    assert(!/181 đ\/kWh|10 đ\/m³/.test(t), 'stored "181 đ/kWh" is not shown mixed with the new unit');
    assert(/TỔNG KHOẢN PHẢI THU TIỂU THƯƠNG 1\.567\.200 đ/.test(t), 'total = issued amount');
  });
  ok('old lines: the issued receivable is not modified (id, status, amounts, explanation, storage)', () => {
    assert.strictEqual(JSON.stringify(inv), invBefore);
    assert.strictEqual(inv.items[1].explanation, '8.391 − 8.210 = 181 đ/kWh', 'original explanation kept');
    assert.strictEqual(Array.from(h.localStorage._m.values()).join(''), storageBefore, 'nothing written by viewing');
  });
  ok('Khoản phải thu header of the issued round follows the same stored lines', () => {
    A.closeModal(); A.CH['pt-period']({ value: mp.id, dataset: {} });
    const v = text(h.view());
    assert(/Kỳ 11\/2026/.test(v), 'issued round selected');
    // Fixture mixes 1 old-shape receivable with 34 new ones → the header lists every month the stored lines carry.
    assert(/Tháng tính phí theo các dòng khoản: Điện, nước(, dịch vụ)? tháng [^·]*11\/2026[^·]*· Mặt bằng tháng [^.]*12\/2026/.test(v), v.slice(0, 500));
    assert(/Tháng tính phí theo các dòng khoản:/.test(v) && !/Dự kiến theo lịch kỳ/.test(v), v.slice(0, 300));
  });
}

// ---- C. Round not calculated yet → planned months from the calendar rule, clearly labelled as planned ----
{
  const h = createApp(ROOT), A = h.A, MP = A.features.finance.marketPeriod;
  MP.ensurePeriodsForCurrentCycle();
  const mp = MP.get('CL', '2026-11');
  A.db.billingDrafts = (A.db.billingDrafts || []).filter(d => d.billingPeriodId !== mp.id);
  ok('no lines yet → "Dự kiến theo lịch kỳ" (usage 10, land 11)', () => {
    A.ui.sessionAccountId = 'AC-NV01'; A.ui.currentDemoAccountId = 'AC-NV01'; A.ui.market = 'CL'; A.syncAccountContext();
    h.go('phai-thu'); A.CH['pt-period']({ value: mp.id, dataset: {} });
    const v = text(h.view());
    assert(/Kỳ 11\/2026/.test(v), 'round selected');
    assert(/Dự kiến theo lịch kỳ: điện, nước, dịch vụ tháng 10\/2026 .*Mặt bằng thu trước tháng 11\/2026/.test(v), v.slice(0, 500));
  });
}
console.log(`receivable-detail-display regression PASS (${passed} checks)`);

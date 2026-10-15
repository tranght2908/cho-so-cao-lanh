/* Regression (10/2026): nút "Đi đến dữ liệu nguồn" trong popup Chi tiết khoản phải thu. Trước đây nút dùng data-act="go"
 * với data-id (handler đọc data-to) → A.go(undefined): popup không đóng, màn phía sau lặng lẽ về Tổng quan. Nay mỗi loại
 * cảnh báo có đích riêng, kiểm tra quyền trước khi hiện nút và khi thực hiện, đóng popup rồi mới điều hướng:
 *   cảnh báo hợp đồng → chi tiết ĐÚNG hợp đồng + cuộn tới "Theo dõi xử lý hợp đồng"; chỉ số → Chỉ số điện, nước đúng kỳ;
 *   mức thu → Cấu hình giá; điểm KD / diện tích → Mặt bằng. Chỉ điều hướng — không đổi dữ liệu nghiệp vụ.
 * Cảnh báo hợp đồng lấy từ seed (CL kỳ 11/2026: HĐ hết hạn trong tháng mặt bằng). Các loại còn lại là bản sao trong bộ nhớ
 * harness của cảnh báo đó với mã khác (chỉ để kiểm tra điều hướng). Không chạm localStorage thật. */
const assert = require('assert');
const path = require('path');
const { createApp } = require('./harness');

const h = createApp(path.resolve(__dirname, '../..'), { seedIssue: true }), A = h.A;
const B = A.features.finance.billing, MP = A.features.finance.marketPeriod;
let passed = 0;
const ok = (label, fn) => { try { fn(); passed++; } catch (e) { console.error('FAILED: ' + label); e.message = label + ': ' + e.message; throw e; } };
const login = (id, market) => { A.ui.sessionAccountId = id; A.ui.currentDemoAccountId = id; A.ui.market = market; A.syncAccountContext(); };
login('AC-NV01', 'CL');
const mp = MP.get('CL', '2026-11');
const land = B.warnings('CL', mp.id).find(w => w.code === 'LAND_NOT_COVERED');
assert(land && land.contractId && land.traderId, 'seed contract warning');
const snapshot = () => JSON.stringify([A.db.contracts.find(c => c.id === land.contractId), A.db.billingDrafts, A.db.invoices, mp.meter]);
const before = snapshot();
const openPopup = () => { A.closeModal(); h.go('phai-thu'); h.act('pt-new-detail', { trader: land.traderId, period: mp.id }); return h.modal(); };
const sourceButtons = html => (html.match(/<button[^>]*>Đi đến dữ liệu nguồn<\/button>/g) || []);
// Bản sao cảnh báo với mã khác — cùng tiểu thương / hợp đồng / kỳ (chỉ để kiểm tra điều hướng).
const fake = (code, chargeType) => A.db.billingWarnings.push(Object.assign({}, land, { code, chargeType, message: 'Kiểm thử điều hướng ' + code, action: undefined, gapFrom: undefined, gapTo: undefined }));

ok('cảnh báo hợp đồng: đóng popup, mở ĐÚNG chi tiết hợp đồng, cuộn tới "Theo dõi xử lý hợp đồng"', () => {
  const m = openPopup();
  assert(!/data-act="go"/.test(m), 'no generic go button');
  assert(m.includes('data-act="pt-contract-open" data-id="' + land.contractId + '"'), 'targets the warned contract');
  const target = h.el('#ctw-followup'); let scrolled = 0;
  target.scrollIntoView = () => { scrolled++; };
  h.act('pt-contract-open', { id: land.contractId });
  assert.strictEqual(h.modal(), '', 'popup closed');
  assert.strictEqual(A.current, 'hop-dong');
  const v = h.view();
  assert(v.includes('Hợp đồng ' + land.contractId) && v.includes('id="ctw-followup"') && /Theo dõi xử lý hợp đồng/.test(v), 'contract detail with follow-up section');
  assert.strictEqual(A.ui.contractWs.focus, null, 'focus request consumed once');
  ok.pending = new Promise(res => setTimeout(() => { res(scrolled); }, 20));
});
ok('cảnh báo chỉ số: mở màn Chỉ số điện, nước đúng chợ, đúng kỳ của khoản phải thu', () => {
  fake('MISSING_METER_READING', 'ELECTRICITY');
  const m = openPopup();
  assert(m.includes('data-act="pt-meter-open" data-period="2026-11"'), m.match(/MISSING_METER[\s\S]{0,400}/));
  h.act('pt-meter-open', { period: '2026-11' });
  assert.strictEqual(h.modal(), '', 'popup closed');
  assert.strictEqual(A.current, 'dien-nuoc'); assert.strictEqual(A.ui.market, 'CL');
  assert(/Kỳ thu[\s\S]*11\/2026/.test(h.view()), 'period 11/2026 shown');
});
ok('cảnh báo mức thu / điểm KD: pt-source-open đóng popup rồi mở Cấu hình giá / Mặt bằng; route ngoài danh sách bị chặn', () => {
  fake('MISSING_LAND_POLICY', 'LAND'); fake('MISSING_AREA', 'LAND');
  const m = openPopup();
  assert(m.includes('data-act="pt-source-open" data-id="cau-hinh-gia"') && m.includes('data-act="pt-source-open" data-id="mat-bang"'));
  h.act('pt-source-open', { id: 'cau-hinh-gia' });
  assert.strictEqual(h.modal(), ''); assert.strictEqual(A.current, 'cau-hinh-gia');
  openPopup(); h.act('pt-source-open', { id: 'mat-bang' });
  assert.strictEqual(h.modal(), ''); assert.strictEqual(A.current, 'mat-bang');
  openPopup(); const toasts = h.trace.toasts.length;
  h.act('pt-source-open', { id: 'tai-khoan' });
  assert(/không có quyền/.test(h.trace.toasts.slice(toasts).join(' ')) && A.current === 'phai-thu', 'non-whitelisted route refused');
});
ok('không có quyền màn đích: không hiện nút, gọi thẳng handler cũng không điều hướng', () => {
  const role = A.ui.role, deny = new Set(['hop-dong', 'dien-nuoc', 'cau-hinh-gia', 'mat-bang']);
  const can = A.U.can;
  A.U.can = id => deny.has(id) ? false : can(id);
  try {
    const m = openPopup();
    assert.strictEqual(sourceButtons(m).length, 0, 'no source button without screen permission');
    const toasts = h.trace.toasts.length;
    h.act('pt-contract-open', { id: land.contractId }); h.act('pt-meter-open', { period: '2026-11' }); h.act('pt-source-open', { id: 'mat-bang' });
    assert.strictEqual(A.current, 'phai-thu', 'stayed on Khoản phải thu');
    assert.strictEqual(h.trace.toasts.slice(toasts).filter(t => /không có quyền/.test(t)).length, 3);
  } finally { A.U.can = can; }
  assert.strictEqual(A.ui.role, role);
  // Vai trò thật: Lãnh đạo không có quyền Chỉ số điện, nước → không thấy nút chỉ số.
  login('AC-LD01', 'CL');
  if (A.U.can('phai-thu')) assert(!openPopup().includes('data-act="pt-meter-open"'), 'leader: no meter button');
  login('AC-NV01', 'CL');
});
ok('chỉ điều hướng: hợp đồng, khoản phải thu nháp, khoản đã phát hành, chỉ số không đổi', () => {
  A.db.billingWarnings = A.db.billingWarnings.filter(w => !/^Kiểm thử điều hướng/.test(w.message || ''));
  assert.strictEqual(snapshot(), before);
});
ok.pending.then(scrolled => {
  assert(scrolled >= 1, 'scrolled to Theo dõi xử lý hợp đồng');
  console.log('receivable-source-navigation regression PASS (' + (passed + 1) + ' checks)');
}).catch(e => { console.error('FAILED: scroll — ' + e.message); process.exit(1); });

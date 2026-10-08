/* Focused regression: redesigned UI of "Chính sách thu và biểu phí" (10/2026) — layout only, same business rules.
 * List (8 columns, consistent chips, neutral "Chưa khai báo"), market page (header, real progress, 4 vertical rows),
 * popups with one layout (price → effective date → evidence → note; footer = Hủy / Lưu mức thu), field-level errors,
 * no reference-price UI, dirty-cancel confirmation, double-submit
 * guard, evidence requirement taken from the save service (validateOnly, no write), history columns, read-only role.
 * Fixtures are in-memory only; nothing here resets any market. */
const assert = require('assert');
const path = require('path');
const { createApp } = require('./harness');

const ROOT = path.resolve(__dirname, '../..');
const h = createApp(ROOT), A = h.A, C = A.SERVICE_CFG, MC = A.features.markets.service, L = A.features.lifecycle.service, S = A.features.marketLayout.store, fc = A.features.feeConfig;
let passed = 0;
const ok = (label, fn) => { try { fn(); passed++; } catch (e) { e.message = label + ': ' + e.message; throw e; } };
const json = x => JSON.stringify(x);
const login = (id, market) => { A.ui.sessionAccountId = id; A.ui.currentDemoAccountId = id; A.ui.market = market || 'ALL'; A.syncAccountContext(); };
const FILE = { name: 'quyet-dinh-muc-thu.pdf', type: 'application/pdf', size: 2048, mock: true };
const thisMonth = A.U.today().slice(0, 8) + '01', nextMonth = fc.nextMonthStart();
const field = (p, v) => A.IN['fcm-field']({ dataset: { path: p }, value: String(v) });
const store = () => h.localStorage.getItem(C.KEY);
const open = mid => { h.go('cau-hinh-gia'); h.act('fcm-back'); h.act('fcm-open', { id: mid }); };
const edit = card => h.act('fcm-edit', { card });
const foot = () => { const m = h.modal(); return m.slice(m.indexOf('class="modal-f')); };
const body = () => { const m = h.modal(); return m.slice(0, m.indexOf('class="modal-f')); };
const order = (s, parts) => parts.every((p, i) => i === 0 || (s.indexOf(parts[i - 1]) !== -1 && s.indexOf(p) > s.indexOf(parts[i - 1])));
const setupLayout = (marketId, types) => {
  const draft = S.initialSetup.createDraft(marketId);
  draft.buildings[0].name = 'Nhà lồng A';
  draft.floors.push({ id: 'f1', buildingDraftId: draft.buildings[0].id, name: 'Tầng 1', businessArea: 300 });
  draft.rows.push({ id: 'r1', buildingDraftId: draft.buildings[0].id, floorDraftId: 'f1', name: 'Dãy A', industry: A.D.INDUSTRIES[0], allocatedArea: 300 });
  types.forEach((t, i) => draft.pointGroups.push({ id: 'g' + i, rowDraftId: 'r1', areaTypeId: t, quantity: 4, areaPerPoint: 10 }));
  assert(S.initialSetup.commit(draft).ok);
};
const newMarket = (name, types) => { const m = MC.add({ name, address: 'Khóm test', rank: 'HANG_3', totalArea: 1000, businessArea: 600 }, 'test'); setupLayout(m.id, types); return m.id; };

login('AC-NV01'); // Tổ trưởng: thiết lập mức thu trong phạm vi chợ
const initial = store();

ok('list: title, description, 8 columns in order, fixed column widths, "Xem" for each market in scope', () => {
  h.go('cau-hinh-gia');
  const v = h.view();
  assert(/<h2>Chính sách thu và biểu phí<\/h2>/.test(v) && /Quản lý khoản thu và mức giá áp dụng cho từng chợ\./.test(v));
  const ths = (v.match(/<thead><tr>([\s\S]*?)<\/tr><\/thead>/) || [])[1].replace(/<[^>]+>/g, '|').split('|').filter(Boolean);
  assert.strictEqual(json(ths), json(['STT', 'Mã chợ', 'Tên chợ', 'Hạng chợ', 'Khoản thu áp dụng', 'Trạng thái cấu hình', 'Ngày hiệu lực gần nhất', 'Thao tác']));
  assert(/<colgroup>/.test(v) && /class="tbl fcm-list-tbl"/.test(v));
  assert(/<th class="c-center">Trạng thái cấu hình<\/th><th class="c-center">Ngày hiệu lực gần nhất<\/th><th class="c-center">Thao tác<\/th>/.test(v), 'right-hand columns centred');
  assert(/<td class="c-center"><button class="btn sm" data-act="fcm-open"/.test(v) && /<b class="fcm-name"/.test(v), 'action cell + 2-line market name');
  const n = A.allowedMarkets(A.currentAccount()).length;
  assert.strictEqual((v.match(/data-act="fcm-open"[^>]*>Xem<\/button>/g) || []).length, n);
});
ok('list: charge chips distinguish Áp dụng / Không áp dụng / Chưa khai báo; "Chưa khai báo" is never red', () => {
  const v = h.view(), i = v.indexOf('data-id="TVH"'), row = v.slice(v.lastIndexOf('<tr>', i), i);
  assert.strictEqual(C.chargeApplicability('TVH'), null, 'fixture: TVH undeclared');
  assert.strictEqual((row.match(/fcm-chip is-none/g) || []).length, 3, 'Điện / Nước / Dịch vụ chưa khai báo');
  assert(/fcm-chip is-on[^>]*>.*Mặt bằng/.test(row), 'Mặt bằng luôn áp dụng');
  assert(!/tag danger/.test(v.slice(v.indexOf('<tbody>'), v.indexOf('</tbody>'))), 'no red label in the list');
  ['Chưa cấu hình', 'Đã cấu hình'].forEach(t => assert(v.includes(t), t));
});
let m1;
ok('market page: header + progress computed from data + 4 vertical rows (no card grid)', () => {
  m1 = newMarket('Chợ giao diện U1', ['covered', 'uncovered']);
  open(m1);
  const v = h.view();
  assert(/data-act="fcm-back">← Danh sách/.test(v) && /Cấu hình mức thu – Chợ giao diện U1/.test(v) && /Mã chợ <b>/.test(v) && /Hạng <b>Hạng 3<\/b>/.test(v));
  assert(/Trạng thái cấu hình <span class="tag ">Chưa cấu hình/.test(v));
  assert.strictEqual((v.match(/class="fcm-row" data-row="/g) || []).length, 4);
  assert(order(v, ['data-row="land"', 'data-row="electricity"', 'data-row="water"', 'data-row="service"']));
  assert(!/fcm-cards|fcm-card"/.test(v), 'old card layout gone');
  assert(/Đã xử lý <b>0\/4<\/b> khoản thu · còn 4 khoản cần xử lý/.test(v));
  assert((v.match(/tag fcm-t-none">Chưa khai báo/g) || []).length === 3, 'undeclared rows are neutral');
  assert(/Khoản bắt buộc · 2 loại diện tích có điểm kinh doanh/.test(v) && /<b>0\/2<\/b> loại diện tích có giá/.test(v));
});
ok('land popup: one table (type · points · market price), sections in order, footer only Hủy / Lưu mức thu', () => {
  edit('land');
  const b = body(), f = foot();
  assert(/Thiết lập giá mặt bằng – Chợ giao diện U1/.test(h.modal()));
  assert.strictEqual((b.match(/<table/g) || []).length, 1, 'one table');
  assert(/<th>Loại diện tích<\/th><th class="num">Số điểm kinh doanh<\/th><th>Đơn giá áp dụng/.test(b));
  assert.strictEqual((b.match(/data-path="land\./g) || []).length, 2, 'only the market\'s area types');
  assert(order(b, ['Mức thu theo loại diện tích', 'Thời gian áp dụng', 'Văn bản căn cứ', 'Ghi chú']), 'section order');
  assert(/Ngày bắt đầu hiệu lực <span class="fcm-star"/.test(b) && /type="date"/.test(b) && /type="file"/.test(b), 'date + uploader in the body');
  assert(!/type="date"|type="file"/.test(f), 'not in the footer');
  assert.strictEqual(json((f.match(/<button[^>]*>([^<]*)<\/button>/g) || []).map(x => x.replace(/<[^>]+>/g, ''))), json(['Hủy', 'Lưu mức thu']));
  assert(!/QĐ 480|Giá tham chiếu|Dùng giá tham chiếu/.test(b), 'no shared-reference controls remain');
  assert(/Áp dụng từ ngày \d{2}\/\d{2}\/\d{4}/.test(h.modal()), 'dd/mm/yyyy shown next to the date');
});
ok('field errors stay at the field, typed values are kept, nothing is written', () => {
  const before = store();
  field('land.covered', '-5'); field('land.uncovered', '1500'); field('effectiveFrom', A.U.today().slice(0, 8) + '15');
  A.ui.feeCfg.draft.file = FILE; h.act('fcm-save');
  const m = h.modal();
  assert(/Chưa lưu được\./.test(m) && /Vui lòng sửa 2 mục được đánh dấu bên dưới/.test(m), 'short summary');
  assert(/data-path="land\.covered" value="-5"/.test(m) && /fcm-num is-invalid[^>]*data-path="land\.covered"/.test(m), 'value kept + marked');
  const sec2 = m.slice(m.indexOf('Thời gian áp dụng'), m.indexOf('Văn bản căn cứ'));
  assert(/fcm-ferr[^>]*>Giá mới chỉ được có hiệu lực từ ngày 01 của tháng\./.test(sec2), 'date error under the date');
  assert(/fcm-ferr[^>]*>Giá Có mái che phải là số lớn hơn 0\./.test(m.slice(0, m.indexOf('Thời gian áp dụng'))), 'price error under the price');
  assert.strictEqual(store(), before);
});
ok('evidence requirement comes from the save rule (validateOnly — no write); file can be replaced / removed', () => {
  const before = store();
  field('land.covered', '2600'); field('effectiveFrom', thisMonth);
  const v = fc.saveMarketFeeConfig(m1, A.ui.feeCfg.draft, 'test', { validateOnly: true });
  assert(v.validateOnly && v.ok && v.needsFile && v.priceChanges === 2, json(v));
  assert.strictEqual(store(), before, 'validateOnly writes nothing');
  assert(/Bắt buộc cho thay đổi này/.test(h.modal()) && /📄 <b>quyet-dinh-muc-thu\.pdf<\/b>/.test(h.modal()) && /Thay tệp/.test(h.modal()));
  h.act('fcm-file-remove');
  assert(/Chưa chọn tệp/.test(h.modal()) && A.ui.feeCfg.draft.file === null);
});
ok('Hủy with unsaved changes asks first (in the footer); discard writes nothing', () => {
  const before = store();
  h.act('fcm-popup-close');
  assert(/Bỏ các thay đổi chưa lưu\?/.test(foot()) && h.modal() !== '', 'still open, asks');
  h.act('fcm-discard-cancel');
  assert(!/Bỏ các thay đổi chưa lưu/.test(h.modal()) && A.ui.feeCfg.draft.land.covered === '2600', 'back to editing, input kept');
  h.act('fcm-popup-close'); h.act('fcm-popup-discard');
  assert.strictEqual(h.modal(), ''); assert.strictEqual(store(), before);
  edit('land'); h.act('fcm-popup-close');
  assert.strictEqual(h.modal(), '', 'no change → closes directly');
});
ok('save once even when Lưu is pressed twice / while saving; success message shown', () => {
  edit('land');
  field('land.covered', '2500'); field('land.uncovered', '1500'); field('effectiveFrom', thisMonth); A.ui.feeCfg.draft.file = FILE;
  const n = C.list('stallPrices').length;
  A.ui.feeCfg.saving = true; h.act('fcm-save');
  assert.strictEqual(C.list('stallPrices').length, n, 'ignored while saving');
  A.ui.feeCfg.saving = false;
  h.act('fcm-save'); h.act('fcm-save');
  assert.strictEqual(C.list('stallPrices').length, n + 2, 'one version per area type');
  assert(/Đã lưu cấu hình/.test(h.trace.toasts.at(-1)) && h.modal() === '');
  assert(/<b>2\/2<\/b> loại diện tích có giá/.test(h.view()));
});
ok('opening the land popup keeps the market-owned current price as a draft and never writes a version', () => {
  edit('land');
  const before = store();
  assert.strictEqual(A.ui.feeCfg.draft.land.covered, '2500');
  assert(/Hiện hành: <b>2\.500<\/b> đ\/m²\/ngày/.test(h.modal()), 'current price shown apart from the input');
  assert(!/QĐ 480|Giá tham chiếu|Dùng giá tham chiếu/.test(h.modal()));
  assert.strictEqual(store(), before, 'opening only creates a draft');
  h.act('fcm-reset');
});
ok('charges: "Không áp dụng" counts as handled; electricity applied without price stays to do', () => {
  h.act('fcm-apply', { k: 'electricity', v: '1' });
  assert(/Khoản thu áp dụng – Chợ giao diện U1/.test(h.modal()) && /Lưu khai báo/.test(foot()));
  h.act('fcm-charge', { k: 'water', v: '0' }); h.act('fcm-charge', { k: 'service', v: '0' }); field('effectiveFrom', thisMonth);
  h.act('fcm-save');
  const v = h.view();
  assert(/Đã xử lý <b>3\/4<\/b> khoản thu/.test(v), 'land + water N/A + service N/A');
  assert(/Còn cần xử lý: Tiền điện: chưa thiết lập mức thu/.test(v));
  assert(/data-row="water"[\s\S]*?Không yêu cầu đơn giá[\s\S]*?Không áp dụng/.test(v));
});
ok('electricity popup: same layout (price info → effective date → evidence), current price read-only + "Đơn giá mới"', () => {
  edit('electricity');
  let b = body();
  assert(order(b, ['Thông tin đơn giá', 'Thời gian áp dụng', 'Văn bản căn cứ']) && /Chưa có đơn giá điện đang hiệu lực\./.test(b));
  field('electricity.price', '3100'); field('effectiveFrom', thisMonth); A.ui.feeCfg.draft.file = FILE; h.act('fcm-save');
  assert(/Đã xử lý <b>4\/4<\/b> khoản thu/.test(h.view()) && /Trạng thái cấu hình <span class="tag ok">Đã cấu hình/.test(h.view()));
  edit('electricity'); b = body();
  assert(/Đơn giá hiện hành<\/span><b>3\.100 đ\/kWh<\/b>/.test(b) && /Đơn giá mới điện <span class="fcm-star"/.test(b) && /data-path="electricity.price" value="3100"/.test(b), 'never an empty field');
  assert.strictEqual(json((foot().match(/<button[^>]*>([^<]*)<\/button>/g) || []).map(x => x.replace(/<[^>]+>/g, ''))), json(['Hủy', 'Lưu mức thu']));
  h.act('fcm-popup-close');
});
ok('service popup: table columns, add form in order, change of an existing service, parking fee not listed', () => {
  h.act('fcm-apply', { k: 'service', v: '1' }); h.act('fcm-charge', { k: 'service', v: '1' }); field('effectiveFrom', thisMonth); h.act('fcm-save');
  edit('service');
  const ths = (body().match(/<table class="tbl fcm-svc-tbl"><thead><tr>([\s\S]*?)<\/tr>/) || [])[1].replace(/<[^>]+>/g, '|').split('|').filter(Boolean);
  assert.strictEqual(json(ths), json(['Tên dịch vụ', 'Đơn vị tính', 'Mức thu', 'Chu kỳ thu', 'Ngày hiệu lực', 'Trạng thái', 'Thao tác']));
  h.act('fcm-svc-add');
  const b = body();
  assert(order(b, ['Tên dịch vụ <span', 'Đơn vị tính <span', 'Mức thu <span', 'Chu kỳ thu</label>', 'Ghi chú', 'Thời gian áp dụng', 'Văn bản căn cứ']), 'form order');
  const key = A.ui.feeCfg.draft.newServices[0].key;
  field(`new.${key}.name`, 'Phí vệ sinh'); field(`new.${key}.amount`, '50000'); field('effectiveFrom', thisMonth); A.ui.feeCfg.draft.file = FILE;
  h.act('fcm-save');
  const svc = C.list('extraServices').find(x => x.marketId === m1 && x.name === 'Phí vệ sinh');
  assert(svc && svc.amount === 50000);
  edit('service');
  assert(/data-act="fcm-svc-edit" data-id="[^"]+">Đổi mức thu/.test(body()) && !/data-path="services\./.test(body()));
  h.act('fcm-svc-edit', { id: svc.id });
  assert(new RegExp('data-path="services\\.' + svc.id + '" value="50000"').test(body()) && /Hủy đổi/.test(body()));
  assert(!C.list('extraServices').filter(x => x.category === 'VEHICLE').some(x => body().includes('>' + A.U.esc(x.name || '') + '</b>')), 'no parking fee');
  h.act('fcm-reset');
});
ok('market page shows services count + details; history tab: version columns + action log', () => {
  assert(/<b>1<\/b> dịch vụ đang hiệu lực/.test(h.view()) && /Xem danh sách dịch vụ \(1\)/.test(h.view()));
  h.act('fcm-back'); h.act('fcm-tab', { id: 'history' });
  const v = h.view(), ths = (v.match(/<table class="tbl fcm-ver-tbl"><thead><tr>([\s\S]*?)<\/tr>/) || [])[1].replace(/<[^>]+>/g, '|').split('|').filter(Boolean);
  assert.strictEqual(json(ths), json(['Chợ', 'Khoản thu', 'Mức giá', 'Thời gian hiệu lực', 'Trạng thái phiên bản', 'Người cập nhật', 'Thời điểm cập nhật', 'Văn bản căn cứ']));
  assert(/Nhật ký thao tác/.test(v) && /quyet-dinh-muc-thu\.pdf/.test(v));
  h.act('fcm-tab', { id: 'list' });
});
ok('read-only role: popup shows values disabled, only "Đóng", no Áp dụng toggle', () => {
  login('AC-LD01');
  open('CL'); edit('land');
  assert(!/data-act="fcm-save"/.test(h.modal()) && /data-path="land\.[a-z_]+"[^>]*disabled/.test(h.modal()) && /chỉ có quyền xem/.test(h.modal()));
  assert.strictEqual(json((foot().match(/<button[^>]*>([^<]*)<\/button>/g) || []).map(x => x.replace(/<[^>]+>/g, ''))), json(['Đóng']));
  h.act('fcm-popup-close');
  assert(!/data-act="fcm-edit" data-card="land"/.test(h.view()) && /data-act="fcm-apply"[^>]*disabled/.test(h.view()));
  login('AC-NV01');
});
ok('browsing every market page and popup (no save) changes no data of the 12 markets', () => {
  const snap = store(), ids = MC.rows().map(m => m.id);
  ids.forEach(mid => { open(mid); ['land', 'land-view', 'electricity', 'water', 'service'].forEach(c => { edit(c); h.act('fcm-popup-close'); h.act('fcm-popup-discard'); }); });
  assert.strictEqual(store(), snap);
  assert(initial !== null || snap !== null);
});
console.log(`fee-config-ui regression PASS (${passed} checks)`);

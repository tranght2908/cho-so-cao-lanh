/* Focused regression: OCR (demo provider) on the single-page "Tạo hồ sơ tiểu thương" form — optional helper only.
 * Upload CCCD front → "Quét thông tin bằng OCR" → "Kết quả nhận diện OCR" → "Áp dụng vào biểu mẫu" fills Section A
 * (never the phone); fields that already hold different data need confirmation; duplicate validation still applies.
 * Abstraction: traders.service.extractTraderIdentityFromImages with the demo provider (source DEMO_OCR). */
const assert = require('assert');
const path = require('path');
const { createApp } = require('./harness');

(async () => {
  const h = createApp(path.resolve(__dirname, '../..')), A = h.A, TS = A.features.traders.service;
  let passed = 0;
  const ok = async (label, fn) => { try { await fn(); passed++; } catch (e) { e.message = label + ': ' + e.message; throw e; } };
  A.ui.sessionAccountId = 'AC-NV01'; A.ui.currentDemoAccountId = 'AC-NV01'; A.ui.market = 'CL'; A.syncAccountContext();
  const file = name => ({ name, type: 'image/png', size: 1000, addedAt: A.U.today(), mock: true });
  const start = () => { h.go('tieu-thuong'); h.act('tp-new'); return A.ui.traderWorkspace.wizard; };
  const view = () => h.view();
  const upload = (key, name) => { h.setFiles([{ name, type: 'image/png', size: 1000 }]); h.act('tp-file', { key }); };
  const type = (k, v) => A.IN['tp-field']({ dataset: { k }, value: v });

  await ok('abstraction + separate demo provider; no phone in the result', async () => {
    assert.strictEqual(typeof TS.extractTraderIdentityFromImages, 'function');
    assert.strictEqual(typeof TS.extractTraderIdentityFromImagesDemo, 'function');
    assert.strictEqual(TS.identityOcrProviderName(), 'DEMO_OCR');
    const out = await TS.extractTraderIdentityFromImages({ cccdFront: file('cccd_demo_hoa_front.png') });
    assert(out.ok);
    assert.strictEqual(JSON.stringify(Object.keys(out.result).sort()), JSON.stringify(['address', 'confidence', 'documentNumber', 'documentType', 'fullName', 'source']));
    assert(/^DEMO-/.test(out.result.documentNumber), 'document number clearly marked DEMO');
    const unknown = await TS.extractTraderIdentityFromImages({ cccdFront: file('IMG_2031.png') });
    assert(!unknown.ok && /cccd_demo_/.test(unknown.error), 'non-sample image is not "recognised"');
  });
  await ok('OCR is optional: disabled without a CCCD front image (tooltip), handler refuses', async () => {
    const d = start();
    assert(/data-act="tp-ocr-run" disabled title="Vui lòng tải ảnh CCCD để sử dụng OCR\."/.test(view()) && />Quét thông tin bằng OCR demo</.test(view()));
    assert(view().includes('OCR demo phục vụ trình diễn, không phải xác thực giấy tờ.'), 'demo note kept verbatim');
    assert(!/Bước \d|Tiếp theo/.test(view()), 'no wizard step wording');
    await A.ACT['tp-ocr-run']();
    assert(!d.ocr || d.ocr.status !== 'done');
    upload('cccdBack', 'cccd_demo_hoa_back.png');
    assert(/data-act="tp-ocr-run" disabled/.test(view()), 'back side alone is not enough');
  });
  let d;
  await ok('scan returns Nguyễn Thị Hoa as a preview only — nothing written yet', async () => {
    d = start();
    upload('cccdFront', 'cccd_demo_hoa_front.png');
    assert(!/data-act="tp-ocr-run" disabled/.test(view()));
    await A.ACT['tp-ocr-run']();
    const v = view();
    assert(/Kết quả nhận diện OCR/.test(v) && /Nguyễn Thị Hoa/.test(v) && /DEMO-CCCD-001/.test(v) && /97%/.test(v) && /DỮ LIỆU MẪU – KHÔNG CÓ GIÁ TRỊ/.test(v));
    assert.strictEqual(d.name, ''); assert.strictEqual(d.idNo, '');
  });
  await ok('"Áp dụng vào biểu mẫu" fills Section A, phone stays empty, fields stay editable', async () => {
    h.act('tp-ocr-apply');
    assert.strictEqual(d.name, 'Nguyễn Thị Hoa'); assert.strictEqual(d.idType, 'CCCD'); assert.strictEqual(d.idNo, 'DEMO-CCCD-001'); assert.strictEqual(d.address, 'Phường Cao Lãnh, Đồng Tháp');
    assert.strictEqual(d.phone, '', 'phone never derived from the document');
    const v = view();
    assert(/id="tp-name" data-in="tp-field" data-k="name" value="Nguyễn Thị Hoa"/.test(v) && /id="tp-phone" data-in="tp-field" data-k="phone" value=""/.test(v));
    assert(/<option selected>CCCD<\/option>/.test(v));
    type('name', 'Nguyễn Thị Hoa B'); assert.strictEqual(d.name, 'Nguyễn Thị Hoa B', 'user can edit after OCR');
  });
  await ok('fields holding different data → confirmation before replacing; "Giữ dữ liệu hiện tại" keeps them', async () => {
    const d2 = start();
    type('name', 'Lê Văn An'); type('address', 'Khóm 1');
    upload('cccdFront', 'cccd_demo_hoa_front.png');
    await A.ACT['tp-ocr-run']();
    h.act('tp-ocr-apply');
    assert.strictEqual(d2.name, 'Lê Văn An', 'not overwritten without confirmation');
    assert(/Các ô đang có dữ liệu khác: Họ và tên, Địa chỉ/.test(view()) && /data-confirm="1"/.test(view()));
    h.act('tp-ocr-cancel');
    assert.strictEqual(d2.name, 'Lê Văn An');
    h.act('tp-ocr-apply'); h.act('tp-ocr-apply', { confirm: '1' });
    assert.strictEqual(d2.name, 'Nguyễn Thị Hoa'); assert.strictEqual(d2.address, 'Phường Cao Lãnh, Đồng Tháp'); assert.strictEqual(d2.phone, '');
    h.act('tp-wizard-cancel');
  });
  await ok('duplicate document number in the market still blocks saving', async () => {
    const other = { id: 'TT-OCR-DUP', name: 'Hồ sơ khác', phone: '0977000999', idType: 'CCCD', idNo: 'DEMO-CCCD-001', address: 'x', market: 'CL', stalls: [], status: 'WAITING_ALLOCATION', source: 'STAFF' };
    A.db.traders.push(other); A.reindex();
    const d3 = start(); upload('cccdFront', 'cccd_demo_hoa_front.png'); await A.ACT['tp-ocr-run'](); h.act('tp-ocr-apply');
    type('phone', '0977000123');
    const n = TS.list().length;
    h.act('tp-save');
    assert.strictEqual(TS.list().length, n, 'not saved');
    assert(/Số CCCD\/giấy tờ đã được dùng cho hồ sơ tiểu thương khác trong chợ này\./.test(h.trace.toasts.at(-1)), h.trace.toasts.at(-1));
    assert(A.ui.traderWorkspace.wizard === d3, 'form stays open for correction');
    A.db.traders.splice(A.db.traders.indexOf(other), 1); A.reindex();
    h.act('tp-wizard-cancel');
  });
  await ok('replacing the front image discards a previous OCR result', async () => {
    const d2 = start();
    upload('cccdFront', 'cccd_demo_minh_front.png');
    await A.ACT['tp-ocr-run']();
    assert.strictEqual(d2.ocr.result.fullName, 'Trần Văn Minh');
    h.act('tp-file-remove', { key: 'cccdFront' });
    assert.strictEqual(d2.ocr, null);
    assert(/data-act="tp-ocr-run" disabled/.test(view()));
    h.act('tp-wizard-cancel');
  });
  console.log(`trader-ocr-demo regression PASS (${passed} checks)`);
})().catch(e => { console.error(e); process.exit(1); });

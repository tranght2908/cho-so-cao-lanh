/* OCR DEMO cho prototype — KHÔNG phải dịch vụ OCR production, KHÔNG đọc/xác thực giấy tờ thật.
 *
 * Cách demo (A): nhận diện ảnh mẫu theo TÊN TỆP ảnh CCCD mặt trước, dạng cccd_demo_<mã>_front.(png|jpg|jpeg),
 * rồi trả bộ dữ liệu MẪU tương ứng. Số giấy tờ luôn có tiền tố "DEMO-" để không thể nhầm với số CCCD thật;
 * mọi kết quả gắn source = 'DEMO_OCR'. Ảnh không theo mẫu → báo không nhận diện được (không bịa dữ liệu).
 */
(function (A) {
  'use strict';
  if (!A || !A.features || !A.features.traders || !A.features.traders.service) return;
  const service = A.features.traders.service;
  const SAMPLES = {
    hoa: { fullName: 'Nguyễn Thị Hoa', documentType: 'CCCD', documentNumber: 'DEMO-CCCD-001', address: 'Phường Cao Lãnh, Đồng Tháp', confidence: 0.97 },
    minh: { fullName: 'Trần Văn Minh', documentType: 'CCCD', documentNumber: 'DEMO-CCCD-002', address: 'Phường Cao Lãnh, Đồng Tháp', confidence: 0.93 }
  };
  const PATTERN = /^cccd_demo_([a-z0-9]+)_front\.(png|jpe?g)$/i;
  function extractTraderIdentityFromImagesDemo(images) {
    const name = String((images && images.cccdFront && images.cccdFront.name) || '').trim();
    const m = PATTERN.exec(name), sample = m && SAMPLES[m[1].toLowerCase()];
    if (!sample) return { ok: false, error: 'OCR demo chỉ nhận ảnh mẫu đặt tên dạng cccd_demo_<tên>_front.png (ví dụ cccd_demo_hoa_front.png). Vui lòng nhập tay.' };
    return { ok: true, result: Object.assign({}, sample, { source: 'DEMO_OCR' }) };
  }
  extractTraderIdentityFromImagesDemo.providerName = 'DEMO_OCR';
  service.extractTraderIdentityFromImagesDemo = extractTraderIdentityFromImagesDemo;
  service.IDENTITY_OCR_DEMO_FILES = Object.keys(SAMPLES).map(k => 'cccd_demo_' + k + '_front.png');
  if (service.setIdentityOcrProvider) service.setIdentityOcrProvider(extractTraderIdentityFromImagesDemo);
})(window.APP);

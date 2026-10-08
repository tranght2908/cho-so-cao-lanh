/* Trích xuất thông tin nhận dạng tiểu thương từ ảnh giấy tờ — ABSTRACTION dùng chung.
 *
 *   traders.service.extractTraderIdentityFromImages(images, opts) → Promise<{ ok, result?, error? }>
 *     images : { cccdFront, cccdBack, ... } — metadata tệp đã chọn ở bước "Hồ sơ giấy tờ" ({ name, type, size }).
 *     result : { fullName, documentType, documentNumber, address, confidence, source }
 *
 * Prototype chưa có dịch vụ OCR thật: provider mặc định là OCR DEMO (identity-ocr-demo.js, source = 'DEMO_OCR').
 * Khi có dịch vụ thật, đăng ký provider khác qua setIdentityOcrProvider — renderer không đổi.
 * Kết quả chỉ là GỢI Ý để người dùng kiểm tra rồi chủ động "Áp dụng vào biểu mẫu"; không tự ghi vào hồ sơ, không
 * thay thế validation (trùng SĐT / số giấy tờ trong chợ vẫn chạy như nhập tay). Không bao giờ suy ra số điện thoại.
 */
(function (A) {
  'use strict';
  if (!A || !A.features || !A.features.traders || !A.features.traders.service) return;
  const service = A.features.traders.service;
  let provider = null;
  service.setIdentityOcrProvider = function (fn) { provider = typeof fn === 'function' ? fn : null; };
  service.identityOcrProviderName = function () { return provider && provider.providerName || null; };
  service.extractTraderIdentityFromImages = function (images, opts) {
    const front = images && images.cccdFront;
    if (!front) return Promise.resolve({ ok: false, error: 'Vui lòng tải ảnh CCCD mặt trước trước khi quét.' });
    if (!provider) return Promise.resolve({ ok: false, error: 'Chưa cấu hình dịch vụ OCR.' });
    return Promise.resolve().then(() => provider(images, opts || {})).then(out => {
      if (!out || !out.ok || !out.result) return { ok: false, error: (out && out.error) || 'Không đọc được thông tin từ ảnh.' };
      const r = out.result;
      // Chỉ trả đúng các trường nhận dạng; không có số điện thoại.
      return { ok: true, result: { fullName: String(r.fullName || ''), documentType: String(r.documentType || ''), documentNumber: String(r.documentNumber || ''),
        address: String(r.address || ''), confidence: Number(r.confidence) || 0, source: String(r.source || '') } };
    }, err => {
      if (typeof console !== 'undefined' && console.error) console.error('[identity-ocr] provider lỗi:', err);
      return { ok: false, error: 'Dịch vụ OCR gặp lỗi. Vui lòng thử lại hoặc nhập tay.' };
    });
  };
})(window.APP);

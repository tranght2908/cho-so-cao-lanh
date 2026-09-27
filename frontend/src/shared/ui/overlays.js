/* Shared overlays: toast, modal and drawer back-stack (Phase 15.2, from js/core.js). */
(function (A) {
  'use strict';
  const U = A.U, $ = A.$;
  U.toast = msg => {
    const el = document.createElement('div');
    el.className = 'toast'; el.textContent = msg;
    $('#toasts').appendChild(el);
    setTimeout(() => el.remove(), 3600);
  };

  // ---------- modal ----------
  A.modal = function (html, wide) {
    $('#modal-root').innerHTML = `<div class="overlay" data-act="overlay"><div class="modal ${wide ? 'wide' : ''}" role="dialog" aria-modal="true">${html}</div></div>`;
  };
  A.closeModal = function () { A.drawerReset(); $('#modal-root').innerHTML = ''; };
  A.mHead = t => `<div class="modal-h"><h3>${t}</h3><button class="x" data-act="close" aria-label="Đóng">×</button></div>`;

  // ---------- điều hướng drawer (back stack nhỏ, dùng chung) ----------
  // Cho phép nút "← Quay lại" hoạt động khi 1 drawer được mở TỪ 1 drawer khác (vd Mặt bằng chợ →
  // Hồ sơ tiểu thương/Điểm kinh doanh) — KHÔNG phải router mới, KHÔNG hard-code từng cặp biến kiểu
  // backToTGA04/backToKAA01. Chỉ 1 stack {label, render} dùng chung cho mọi drawer trong app:
  //   label  : nhãn hiển thị trên nút "← Quay lại <label>" — LẤY ĐỘNG từ chính điểm/đối tượng
  //            nguồn (vd mã điểm 'TG-A04'), không hard-code theo tên màn hình.
  //   render : hàm KHÔNG tham số (tự đóng gói qua closure) chỉ để VẼ LẠI đúng drawer nguồn — hàm
  //            này KHÔNG được tự push/reset stack, để các cấp back xa hơn (nếu có) không bị sai.
  let drawerStack = [];
  // Gọi TRƯỚC khi vẽ 1 drawer CON (drill-down từ drawer đang mở).
  A.drawerPush = function (label, render) { drawerStack.push({ label, render }); };
  // Gọi khi mở 1 drawer ĐỘC LẬP (không phải drill-down từ drawer khác, vd mở trực tiếp từ 1 dòng
  // trong bảng danh sách) — đảm bảo không hiện "← Quay lại" giả khi drawer không có drawer cha.
  A.drawerReset = function () { drawerStack = []; };
  A.drawerBack = function () { const prev = drawerStack.pop(); if (prev) prev.render(); };
  // "← Quay lại <label>" — CHỈ trả về khi thực sự có drawer cha (stack không rỗng); rỗng thì không
  // render gì (không có back giả).
  A.drawerBackHtml = function () {
    if (!drawerStack.length) return '';
    const label = drawerStack[drawerStack.length - 1].label;
    return `<div class="drawer-back-row"><button class="btn sm" data-act="drawer-back">← Quay lại ${U.esc(label)}</button></div>`;
  };
  Object.assign(A.ACT, {
    overlay: (el, e) => { if (e.target === el) A.closeModal(); },
    close: () => A.closeModal(),
    'drawer-back': () => A.drawerBack()
  });
})(window.APP);

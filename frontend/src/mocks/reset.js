/* Demo data reset (Phase 15.13, from js/v-vanhanh.js + js/core.js): actions reset / reset-ok and
 * A.resetAll — reseeds business mock data only (accounts, roles and permissions untouched). */
(function (A) {
  'use strict';
  const U = A.U, ui = A.ui;
  A.ACT.reset = () => {
    if (!A.canDo('cai-dat.reset-demo')) return;
    // Phase 5B: chỉ làm rõ label/helper text — hành vi A.resetAll() KHÔNG đổi (chỉ reset business
    // mock data, KHÔNG đụng Account/Role/Permission — xem core.js). KHÔNG gọi thêm
    // A.ACCOUNTS.resetDefault()/A.PERM.resetDefault() ở đây (quyết định đã chốt Phase 5B mục 17).
    A.modal(A.mHead('Đặt lại dữ liệu nghiệp vụ mẫu') + `<div class="modal-b">Mọi thao tác đã làm trong lúc xem (thu tiền, phản ánh, hợp đồng…) sẽ bị xóa và quay về dữ liệu mẫu ban đầu.
      <div class="note info" style="margin-top:10px">Không ảnh hưởng tài khoản, vai trò và phân quyền.</div></div>
    <div class="modal-f"><button class="btn" data-act="close">Hủy</button><button class="btn danger" data-act="reset-ok">Đặt lại</button></div>`);
  };
  A.ACT['reset-ok'] = () => { if (!A.canDo('cai-dat.reset-demo')) return; A.resetAll(); A.closeModal(); A.render(); U.toast('Đã đặt lại dữ liệu nghiệp vụ mẫu'); };

  A.resetAll = function () {
    A.data.clearPersisted();
    A.fresh(); ui.sel = null; ui.page = {};
    if (A.features.complaints && A.features.complaints.ensureDemoIncidents) A.features.complaints.ensureDemoIncidents();
    ui.mini = { traderId: null, step: 'login', tab: 'home', pay: null, lastPays: null, attach: false, bill: null };
  };
})(window.APP);

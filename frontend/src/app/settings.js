/* Settings screen host (Phase 15.13, from js/v-vanhanh.js): route cai-dat and its tab bar. Each tab
 * panel is owned elsewhere: billing cycle/rules → features/fee-config, roles/permissions →
 * features/access-control, audit log → shared/data/audit.js; the integrations panel is static. */
(function (A) {
  'use strict';
  const ui = A.ui;
  const SETTINGS_TABS = [['kythu', 'Lịch & kỳ thu'], ['vaitro', 'Vai trò & phân quyền'], ['tichhop', 'Tích hợp'], ['nhatky', 'Nhật ký kiểm toán']];
  const isSettingsTab = tab => SETTINGS_TABS.some(x => x[0] === tab);
  // Legacy state may still contain the removed `quytac` tab. Resolve it in memory
  // to the safe first tab; no fee-rule configuration is deleted or persisted here.
  if (!isSettingsTab(ui.settingsTab)) ui.settingsTab = 'kythu';

  // Phase 6 STEP A: 3 tab giá (Đơn giá mặt bằng/Điện & nước/Dịch vụ khác) đã chuyển sang màn
  // "Chính sách thu và biểu phí" độc lập trong nhóm Tài chính (A.VIEWS['cau-hinh-gia']).
  // Các config quy tắc thu phí legacy vẫn được giữ ở data/service layer để tương thích,
  // nhưng không còn là tab nghiệp vụ của màn Cài đặt & phân quyền.
  function settingsTabBar(tab) {
    return `<div class="seg">${SETTINGS_TABS.map(t => `<button class="${tab === t[0] ? 'on' : ''}" data-act="settings-tab" data-id="${t[0]}">${t[1]}</button>`).join('')}</div>`;
  }

  function settingsTichhopHtml() {
    return `<div class="card"><div class="card-h"><h3>Tích hợp</h3></div><div class="card-b small">
      ${[['Ngân hàng – mã QR động (VietQR), nhận báo có', 'Mô phỏng'], ['Zalo OA – gửi thông báo, biên lai', 'Mô phỏng'], ['SMS brandname', 'Mô phỏng'], ['Biên lai điện tử', 'Mô phỏng'], ['Nền tảng tích hợp, chia sẻ dữ liệu của tỉnh (LGSP)', 'Khi triển khai'], ['Trung tâm điều hành thông minh (IOC)', 'Khi triển khai'], ['Đăng nhập một lần (SSO) dùng chung với các hệ thống của phường', 'Khi triển khai']].map(r => `<div class="row" style="padding:7px 0;border-bottom:1px solid #eef2f7"><span style="flex:1">${r[0]}</span><span class="tag ${r[1] === 'Mô phỏng' ? 'ok' : ''}">${r[1]}</span></div>`).join('')}</div></div>`;
  }

  A.VIEWS['cai-dat'] = function () {
    const tab = isSettingsTab(ui.settingsTab) ? ui.settingsTab : 'kythu';
    if (ui.settingsTab !== tab) ui.settingsTab = tab;
    const body = tab === 'kythu' ? A.features.feeConfig.settingsKyThuHtml()
      : tab === 'tichhop' ? settingsTichhopHtml()
      : tab === 'nhatky' ? A.data.auditLogHtml()
      : A.features.accessControl.settingsVaitroHtml();
    return `${settingsTabBar(tab)}${body}`;
  };
  A.ACT['settings-tab'] = el => { ui.settingsTab = isSettingsTab(el.dataset.id) ? el.dataset.id : 'kythu'; A.render(); };
})(window.APP);

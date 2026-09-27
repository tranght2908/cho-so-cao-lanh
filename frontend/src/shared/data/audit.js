/* Shared audit log (Phase 15.3/15.13): U.log appends to A.db.extraLog; auditLogHtml renders the
 * settings "Nhật ký kiểm toán" panel (extraLog + audit). */
(function (A) {
  'use strict';
  const U = A.U;
  U.log = what => { const acc = A.currentAccount(); A.db.extraLog.unshift({ at: U.dmy(U.today()) + ' ' + U.nowTime(), who: acc ? acc.fullName : 'Không rõ', what }); };

  function settingsNhatkyHtml() {
    const log = A.db.extraLog.concat(A.db.audit);
    return `<div class="card"><div class="card-h"><h3>Nhật ký kiểm toán</h3>${A.canDo('cai-dat.reset-demo') ? '<button class="btn danger" data-act="reset">↺ Đặt lại dữ liệu nghiệp vụ mẫu</button>' : ''}</div><div class="card-b">
      ${U.table([{ t: 'Thời điểm' }, { t: 'Người thực hiện' }, { t: 'Thao tác' }], log.slice(0, 25).map(l => `<tr><td class="nowrap">${l.at}</td><td>${U.esc(l.who)}</td><td>${U.esc(l.what)}</td></tr>`))}</div></div>`;
  }
  // Audit log panel hosted by the settings screen (cai-dat, tab nhatky).
  A.data.auditLogHtml = settingsNhatkyHtml;
})(window.APP);

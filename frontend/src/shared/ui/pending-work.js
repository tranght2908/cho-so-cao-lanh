/* Shared presentation for compact pending-work summaries and paged worklists.
 * Features retain their own qualification, filtering and action rules. */
(function (A) {
  'use strict';
  const U = A.U;
  const ui = A.ui;
  const pending = (A.UI || (A.UI = {})).pending = {};

  pending.summary = ({ count, title, description, action, actionLabel }) => {
    if (!count) return '';
    return `<section class="card pending-summary"><div class="pending-summary-count">${count}</div><div class="pending-summary-copy"><h3>Cần xử lý</h3><b>${U.esc(title)}</b><div class="small muted">${U.esc(description)}</div></div><span class="spacer"></span><button class="btn sm primary" data-act="${action}">${U.esc(actionLabel || 'Xem & xử lý')}</button></section>`;
  };

  pending.pager = ({ key, total, size, action }) => {
    const pages = Math.max(1, Math.ceil(total / size));
    const page = Math.min(ui.page[key] || 0, pages - 1);
    ui.page[key] = page;
    return { start: page * size, end: (page + 1) * size, html: `<div class="pager pending-work-pager"><span>${total ? (page * size + 1) + '–' + Math.min(total, (page + 1) * size) + ' / ' + total : '0 dòng'}</span><button class="btn sm" data-act="${action}" data-k="${key}" data-d="-1" ${page === 0 ? 'disabled' : ''}>‹ Trước</button><button class="btn sm" data-act="${action}" data-k="${key}" data-d="1" ${page >= pages - 1 ? 'disabled' : ''}>Sau ›</button></div>` };
  };

  pending.worklist = ({ title, count, searchKey, searchValue, placeholder, rows, pagerHtml, empty }) => A.mHead(title) + `<div class="modal-b pending-worklist"><div class="pending-worklist-meta">${count} trường hợp</div><input class="input pending-worklist-search" data-in="${searchKey}" placeholder="${U.esc(placeholder)}" value="${U.esc(searchValue || '')}"><div class="pending-worklist-rows">${rows || `<div class="empty">${U.esc(empty || 'Không có trường hợp phù hợp')}</div>`}</div>${pagerHtml || ''}</div><div class="modal-f"><button class="btn" data-act="close">Đóng</button></div>`;
})(window.APP);

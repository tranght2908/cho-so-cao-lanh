/* Shared table, pager and CSV export (Phase 15.2, from js/core.js). */
(function (A) {
  'use strict';
  const U = A.U, ui = A.ui;
  U.pager = (key, total, size) => {
    const pages = Math.max(1, Math.ceil(total / size));
    const p = Math.min(ui.page[key] || 0, pages - 1);
    ui.page[key] = p;
    return {
      start: p * size, end: p * size + size,
      html: `<div class="pager">${total ? (p * size + 1) + '–' + Math.min(total, p * size + size) + ' / ' + total : '0 dòng'}
        <button class="btn sm" data-act="page" data-k="${key}" data-d="-1" ${p === 0 ? 'disabled' : ''}>‹ Trước</button>
        <button class="btn sm" data-act="page" data-k="${key}" data-d="1" ${p >= pages - 1 ? 'disabled' : ''}>Sau ›</button></div>`
    };
  };
  U.table = (cols, rows, opts) => {
    opts = opts || {};
    return `<div class="tbl-wrap"><table class="tbl"><thead><tr>${cols.map(c => `<th class="${c.num ? 'num' : ''}">${c.t}</th>`).join('')}</tr></thead>
      <tbody>${rows.length ? rows.join('') : `<tr><td colspan="${cols.length}" class="empty">${opts.empty || 'Không có dữ liệu'}</td></tr>`}</tbody></table></div>`;
  };
  U.csv = (name, cols, rows) => {
    const csv = '﻿' + [cols].concat(rows).map(r => r.map(v => '"' + String(v == null ? '' : v).replace(/"/g, '""') + '"').join(',')).join('\r\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    a.download = name + '.csv';
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 1500);
    U.toast('Đã xuất tệp ' + name + '.csv (mở được bằng Excel)');
  };
  A.ACT.page = el => { ui.page[el.dataset.k] = (ui.page[el.dataset.k] || 0) + Number(el.dataset.d); A.render(); };
})(window.APP);

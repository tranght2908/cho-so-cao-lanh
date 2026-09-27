/* Shared pure formatters and the prototype clock (Phase 15.2, from js/core.js).
 * Owns the A.U namespace object; every other script adds helpers to this same object. */
(function (A) {
  'use strict';
  // ---------- tiện ích ----------
  const U = A.U = {};
  U.pad = (n, l) => String(n).padStart(l || 2, '0');
  U.esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  U.money = n => Math.round(n || 0).toLocaleString('vi-VN') + ' đ';
  U.moneyShort = n => {
    n = n || 0;
    if (Math.abs(n) >= 1e9) return (n / 1e9).toLocaleString('vi-VN', { maximumFractionDigits: 2 }) + ' tỷ';
    if (Math.abs(n) >= 1e6) return (n / 1e6).toLocaleString('vi-VN', { maximumFractionDigits: 1 }) + ' tr';
    if (Math.abs(n) >= 1e3) return Math.round(n / 1e3).toLocaleString('vi-VN') + 'k';
    return String(Math.round(n));
  };
  U.pct = (a, b) => b ? Math.round(a * 1000 / b) / 10 : 0;
  U.pctTxt = v => (v || 0).toLocaleString('vi-VN', { maximumFractionDigits: 1 }) + '%';
  U.dmy = s => s ? s.slice(8, 10) + '/' + s.slice(5, 7) + '/' + s.slice(0, 4) : '';
  U.per = p => p.slice(5) + '/' + p.slice(0, 4);
  U.days = (a, b) => Math.round((Date.parse(b) - Date.parse(a)) / 86400000);
  U.sum = (arr, f) => arr.reduce((a, x) => a + (f ? f(x) : x), 0);
  U.maskPhone = p => p ? p.slice(0, 3) + '****' + p.slice(-3) : '';
  U.maskId = s => s ? s.slice(0, 3) + '******' + s.slice(-3) : '';

  U.today = () => A.db.today;
  U.nowTime = () => { const d = new Date(); return U.pad(d.getHours()) + ':' + U.pad(d.getMinutes()); };
})(window.APP);

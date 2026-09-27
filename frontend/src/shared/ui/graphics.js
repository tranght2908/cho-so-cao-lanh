/* Shared generated graphics: mock QR code, bar chart, donut chart (Phase 15.2, from js/core.js). */
(function (A) {
  'use strict';
  const U = A.U;
  // Mã QR minh họa (không phải QR thật)
  U.qr = (text, size) => {
    let h = 2166136261;
    for (let i = 0; i < text.length; i++) { h ^= text.charCodeAt(i); h = Math.imul(h, 16777619); }
    const N = 25, cells = [];
    const rnd = () => { h ^= h << 13; h ^= h >>> 17; h ^= h << 5; return (h >>> 0) / 4294967296; };
    const finder = (x, y) => (x < 7 && y < 7) || (x >= N - 7 && y < 7) || (x < 7 && y >= N - 7);
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) if (!finder(x, y) && rnd() < 0.48) cells.push(`<rect x="${x}" y="${y}" width="1" height="1"/>`);
    const fp = (x, y) => `<rect x="${x}" y="${y}" width="7" height="7"/><rect x="${x + 1}" y="${y + 1}" width="5" height="5" fill="#fff"/><rect x="${x + 2}" y="${y + 2}" width="3" height="3"/>`;
    return `<svg viewBox="-2 -2 29 29" width="${size || 170}" height="${size || 170}" role="img" aria-label="Mã QR minh họa"><rect x="-2" y="-2" width="29" height="29" fill="#fff"/><g fill="#0d2e55">${cells.join('')}${fp(0, 0)}${fp(N - 7, 0)}${fp(0, N - 7)}</g><rect x="10" y="10" width="5" height="5" rx="1" fill="#0089df"/></svg>`;
  };

  // ---------- biểu đồ ----------
  const niceMax = v => { const p = Math.pow(10, Math.floor(Math.log10(v))); const n = v / p; return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10) * p; };
  U.bars = (labels, series, o) => {
    o = Object.assign({ h: 230, stacked: true, fmt: U.moneyShort, max: null }, o || {});
    const W = 660, H = o.h, L = 54, B = 28, Tp = 12, Rt = 8;
    const tot = labels.map((_, i) => o.stacked ? U.sum(series, s => s.values[i]) : Math.max.apply(null, series.map(s => s.values[i])));
    const max = o.max || niceMax(Math.max.apply(null, tot.concat([1])));
    const ph = H - Tp - B, bw = (W - L - Rt) / labels.length;
    let g = '';
    for (let k = 0; k <= 4; k++) {
      const y = Tp + ph * (1 - k / 4);
      g += `<line x1="${L}" x2="${W - Rt}" y1="${y}" y2="${y}" stroke="#e5eaf1"/><text x="${L - 6}" y="${y + 4}" text-anchor="end" font-size="11" fill="#6b7683">${o.fmt(max * k / 4)}</text>`;
    }
    labels.forEach((lb, i) => {
      const x0 = L + i * bw;
      if (o.stacked) {
        let acc = 0; const w = bw * 0.62, x = x0 + (bw - w) / 2;
        series.forEach(s => {
          const v = s.values[i], hh = ph * v / max, y = Tp + ph - ph * (acc + v) / max;
          g += `<rect x="${x}" y="${y}" width="${w}" height="${Math.max(0, hh)}" fill="${s.color}" rx="2"><title>${lb} · ${s.name}: ${o.fmt(v)}</title></rect>`;
          acc += v;
        });
      } else {
        const w = bw * 0.7 / series.length;
        series.forEach((s, j) => {
          const v = s.values[i], hh = ph * v / max;
          g += `<rect x="${x0 + bw * 0.15 + j * w}" y="${Tp + ph - hh}" width="${w - 2}" height="${Math.max(0, hh)}" fill="${s.color}" rx="2"><title>${lb} · ${s.name}: ${o.fmt(v)}</title></rect>`;
        });
      }
      g += `<text x="${x0 + bw / 2}" y="${H - 9}" text-anchor="middle" font-size="11" fill="#5c646f">${lb}</text>`;
    });
    return `<div class="chart"><svg viewBox="0 0 ${W} ${H}">${g}</svg><div class="chart-legend">${series.map(s => `<span><i style="background:${s.color}"></i>${s.name}</span>`).join('')}</div></div>`;
  };
  U.donut = (parts, center) => {
    const total = U.sum(parts, p => p.value) || 1;
    let off = 25, arcs = '';
    parts.forEach(p => {
      const len = p.value * 100 / total;
      arcs += `<circle r="15.9155" cx="21" cy="21" fill="none" stroke="${p.color}" stroke-width="6" stroke-dasharray="${len} ${100 - len}" stroke-dashoffset="${off}"><title>${p.label}: ${p.value}</title></circle>`;
      off -= len;
    });
    return `<div class="donut-wrap"><svg viewBox="0 0 42 42">${arcs}<text x="21" y="21" text-anchor="middle" font-size="6.5" font-weight="700" fill="#0f1e32">${center ? center[0] : ''}</text><text x="21" y="27" text-anchor="middle" font-size="3.2" fill="#5c646f">${center ? center[1] : ''}</text></svg>
      <div class="donut-legend">${parts.map(p => `<div><span class="tag"><span class="dot" style="background:${p.color}"></span>${p.label}</span><b>${p.value}</b></div>`).join('')}</div></div>`;
  };
})(window.APP);

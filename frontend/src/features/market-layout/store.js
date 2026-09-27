/* Market layout store (Phase 15.14, from js/v-cautruc.js) — the SINGLE authoritative layout source
 * (AGENTS §12): per-market model block → floor → zone with planned point types, persisted in
 * localStorage 'choso-caolanh-layout', seeded from D.MARKETS. Read/written only through this API. */
(function (A) {
  'use strict';
  const D = A.D, U = A.U;
  const LKEY = 'choso-caolanh-layout';

  const CATS = ['Ki-ốt tổng hợp', 'Thủy hải sản', 'Thịt, gia cầm', 'Rau củ, trái cây', 'Lương thực, thực phẩm khô',
    'Bách hóa tổng hợp', 'May mặc, giày dép', 'Ăn uống', 'Dịch vụ', 'Nông sản tự sản tự tiêu',
    'Ẩm thực dân dã', 'Nông sản, đặc sản', 'Trải nghiệm', 'Khác'];

  let seq = 0;
  const newKey = p => p + '_' + (++seq) + '_' + Math.random().toString(36).slice(2, 6);

  // ---------- cấu trúc mặc định: gợi ý dựa theo MARKETS hiện có (chỉ đọc, không ghi ngược) ----------
  function defaultLayout() {
    const out = {};
    D.MARKETS.forEach(m => {
      const blocks = [];
      m.floors.forEach(fl => {
        if (fl.parking) return; // tầng hầm: không quy hoạch điểm kinh doanh
        const bname = m.kind === 'session' ? 'Khu chợ quê' : 'Nhà chợ chính';
        let block = blocks.find(b => b.name === bname);
        if (!block) { block = { key: newKey('b'), name: bname, floors: [] }; blocks.push(block); }
        const floor = { key: newKey('f'), name: fl.name, zones: [] };
        fl.sections.forEach(s => {
          const avg = +((s.area[0] + s.area[1]) / 2).toFixed(1);
          const qty = s.rows.length * s.per;
          floor.zones.push({
            key: newKey('z'), code: s.id, name: s.name, blockId: block.key, floorId: floor.key,
            catMain: s.cat, catSub: '', area: Math.round(avg * qty), note: '', status: 'chinhthuc',
            planned: [{ key: newKey('p'), name: U.areaTypeLabel(({ kiot: 'covered', nhalong: 'covered', ngoai: 'self_produced', phien: 'session' }[s.type] || 'covered')), std: avg, qty: qty }]
          });
        });
        block.floors.push(floor);
      });
      out[m.id] = { blocks: blocks };
    });
    return out;
  }

  function loadLayout() {
    try { const s = localStorage.getItem(LKEY); if (s) return JSON.parse(s); } catch (e) { /* bỏ qua */ }
    return defaultLayout();
  }
  let LAYOUT = loadLayout();
  function saveLayout() { try { localStorage.setItem(LKEY, JSON.stringify(LAYOUT)); } catch (e) { /* bỏ qua */ } }

  // ---------- truy vấn cấu trúc ----------
  function blocksOf(mid) { return LAYOUT[mid].blocks; }
  function findBlock(mid, bk) { return blocksOf(mid).find(b => b.key === bk); }
  function floorsOfBlock(mid, bk) { const b = findBlock(mid, bk); return b ? b.floors : []; }
  function findFloor(mid, bk, fk) { return floorsOfBlock(mid, bk).find(f => f.key === fk); }
  function firstFloorKey(mid, bk) { const fs = floorsOfBlock(mid, bk); return fs.length ? fs[0].key : null; }
  function firstZonePlace(mid) {
    const b = blocksOf(mid)[0];
    const f = b && b.floors[0];
    return b && f ? { blockId: b.key, floorId: f.key } : null;
  }
  function findFloorOfZone(mid, zk) {
    for (const b of blocksOf(mid)) for (const f of b.floors) if (f.zones.some(z => z.key === zk)) return f;
    return null;
  }
  function findZone(mid, zk) {
    for (const b of blocksOf(mid)) for (const f of b.floors) { const z = f.zones.find(x => x.key === zk); if (z) return z; }
    return null;
  }
  function flatZones(mid) {
    const out = [];
    blocksOf(mid).forEach(b => b.floors.forEach(f => f.zones.forEach(z => out.push(z))));
    return out;
  }
  function codeTaken(mid, code, excludeKey) {
    const c = code.trim().toLowerCase();
    return flatZones(mid).some(z => z.key !== excludeKey && (z.code || '').trim().toLowerCase() === c);
  }
  function marketLayoutStats(mid) {
    const zs = flatZones(mid);
    let pts = 0, area = 0, draft = 0;
    zs.forEach(z => {
      if (z.status === 'nhap') draft++;
      z.planned.forEach(p => { pts += Number(p.qty) || 0; area += (Number(p.std) || 0) * (Number(p.qty) || 0); });
    });
    return { blocks: blocksOf(mid).length, floors: U.sum(blocksOf(mid), b => b.floors.length), zones: zs.length, pts: pts, area: area, draft: draft };
  }
  const marketLayout = A.features.marketLayout || (A.features.marketLayout = {});
  marketLayout.store = {
    CATS, newKey, save: saveLayout,
    of: mid => LAYOUT[mid],
    resetMarket: mid => { LAYOUT[mid] = defaultLayout()[mid]; },
    blocksOf, findBlock, floorsOfBlock, findFloor, firstFloorKey, firstZonePlace, findFloorOfZone, findZone, flatZones, codeTaken, marketLayoutStats
  };
})(window.APP);

/*
 * Dữ liệu MẪU cho prototype Hệ thống quản lý chợ số phường Cao Lãnh.
 * Toàn bộ tên người, số điện thoại, số giấy tờ, số tiền đều là GIẢ LẬP để minh họa.
 * Số liệu thật (số sạp, số tiểu thương, số thu) sẽ được thay khi khảo sát 02 chợ.
 */
window.DATA = (function () {
  'use strict';

  const VERSION = 3;
  const TODAY = new Date(2026, 8, 13); // 13/09/2026

  // Giá dịch vụ sử dụng diện tích bán hàng – QĐ 480/QĐ-UBND ngày 14/02/2026 (đ/m²/ngày, đã gồm VAT)
  const UNIT = { kiot: 2000, nhalong: 2000, ngoai: 800 };
  // Chợ quê không có trong QĐ 480 → mức thu theo phiên là GIẢ ĐỊNH để minh họa
  const SESSION_FEE = 20000;
  const ELEC = 3200;   // đ/kWh – đơn giá mẫu
  const WATER = 12000; // đ/m³ – đơn giá mẫu

  const MARKETS = [
    {
      id: 'CL', name: 'Chợ Cao Lãnh', short: 'Chợ Cao Lãnh', hang: 'Chợ hạng 1', kind: 'daily',
      address: 'Khóm 7, phường Cao Lãnh, tỉnh Đồng Tháp',
      note: 'Tòa nhà chợ mới: 1 hầm, 1 trệt, 1 lầu, khoảng 20.435 m² sàn',
      priceNote: 'Giá dịch vụ theo QĐ 480/QĐ-UBND ngày 14/02/2026: ki-ốt và trong nhà lồng 2.000 đ/m²/ngày; ngoài nhà lồng 800 đ/m²/ngày',
      floors: [
        {
          id: 'T1', name: 'Tầng 1', desc: 'Lương thực, thực phẩm, thủy hải sản', sections: [
            { id: 'KA', name: 'Ki-ốt mặt tiền tầng 1', cat: 'Ki-ốt tổng hợp', type: 'kiot', rows: ['A'], per: 20, area: [12, 16], meter: true },
            { id: 'HS', name: 'Khu thủy hải sản', cat: 'Thủy hải sản', type: 'nhalong', rows: ['A', 'B', 'C'], per: 12, area: [4, 6], meter: true },
            { id: 'TG', name: 'Khu thịt, gia cầm', cat: 'Thịt, gia cầm', type: 'nhalong', rows: ['A', 'B'], per: 12, area: [4, 6], meter: true },
            { id: 'RC', name: 'Khu rau củ, trái cây', cat: 'Rau củ, trái cây', type: 'nhalong', rows: ['A', 'B', 'C'], per: 12, area: [3, 5] },
            { id: 'LT', name: 'Khu lương thực, thực phẩm khô', cat: 'Lương thực, thực phẩm khô', type: 'nhalong', rows: ['A', 'B'], per: 12, area: [4, 8] }
          ]
        },
        {
          id: 'T2', name: 'Tầng 2', desc: 'Bách hóa tổng hợp, ăn uống, dịch vụ', sections: [
            { id: 'KB', name: 'Ki-ốt tầng 2', cat: 'Ki-ốt tổng hợp', type: 'kiot', rows: ['A'], per: 16, area: [12, 16], meter: true },
            { id: 'BH', name: 'Khu bách hóa tổng hợp', cat: 'Bách hóa tổng hợp', type: 'nhalong', rows: ['A', 'B', 'C'], per: 12, area: [4, 8] },
            { id: 'MM', name: 'Khu may mặc, giày dép', cat: 'May mặc, giày dép', type: 'nhalong', rows: ['A', 'B', 'C'], per: 12, area: [4, 8] },
            { id: 'AU', name: 'Khu ăn uống', cat: 'Ăn uống', type: 'nhalong', rows: ['A', 'B'], per: 10, area: [6, 10], meter: true },
            { id: 'DV', name: 'Khu dịch vụ cho thuê', cat: 'Dịch vụ', type: 'nhalong', rows: ['A'], per: 10, area: [8, 12], meter: true }
          ]
        },
        {
          id: 'NL', name: 'Ngoài nhà lồng', desc: 'Bán hàng tự sản tự tiêu', sections: [
            { id: 'TS', name: 'Khu tự sản tự tiêu', cat: 'Nông sản tự sản tự tiêu', type: 'ngoai', rows: ['A', 'B'], per: 15, area: [2, 3] }
          ]
        },
        { id: 'H', name: 'Tầng hầm', desc: 'Bãi xe và khu kỹ thuật – không bố trí điểm kinh doanh', sections: [], parking: true }
      ]
    },
    {
      id: 'TTD', name: 'Chợ quê Cù lao Tân Thuận Đông', short: 'Chợ quê Tân Thuận Đông', hang: 'Phiên chợ du lịch cộng đồng', kind: 'session',
      address: 'Tổ 4, khóm Tân Phát, phường Cao Lãnh, tỉnh Đồng Tháp',
      note: 'Họp chiều thứ Bảy hằng tuần, 14h–20h',
      priceNote: 'Chợ quê không có trong phụ lục QĐ 480. Mức thu 20.000 đ/quầy/phiên chỉ là GIẢ ĐỊNH để minh họa, do phường quyết định',
      floors: [
        {
          id: 'KHU', name: 'Khu chợ quê', desc: 'Họp chiều thứ Bảy, 14h–20h', sections: [
            { id: 'AT', name: 'Khu ẩm thực dân dã', cat: 'Ẩm thực dân dã', type: 'phien', rows: ['A', 'B'], per: 10, area: [6, 9] },
            { id: 'NS', name: 'Khu nông sản, đặc sản', cat: 'Nông sản, đặc sản', type: 'phien', rows: ['A'], per: 7, area: [6, 9] },
            { id: 'TN', name: 'Khu trải nghiệm tự làm món', cat: 'Trải nghiệm', type: 'phien', rows: ['A'], per: 9, area: [6, 9] }
          ]
        }
      ]
    }
  ];

  const STATUS = {
    thue: { label: 'Đang thuê', color: '#2e9e6a' },
    no: { label: 'Nợ phí', color: '#d6453b' },
    ngung: { label: 'Tạm ngừng', color: '#e0a526' },
    tranhchap: { label: 'Đang tranh chấp', color: '#7b4bc4' },
    trong: { label: 'Còn trống', color: '#c9d3cf' }
  };

  const METHOD = { tm: 'Tiền mặt', qr: 'Quét mã QR', ck: 'Chuyển khoản' };

  const INCIDENT_STATES = [
    { id: 'tiepnhan', label: 'Tiếp nhận' },
    { id: 'phancong', label: 'Phân công' },
    { id: 'dangxuly', label: 'Đang xử lý' },
    { id: 'chonghiemthu', label: 'Chờ nghiệm thu' },
    { id: 'hoanthanh', label: 'Hoàn thành' },
    { id: 'dong', label: 'Đóng' }
  ];

  const STAFF = [
    { id: 'NV01', name: 'Trần Minh Khoa', role: 'Trưởng Ban Quản lý chợ', market: 'CL' },
    { id: 'NV02', name: 'Lê Thị Ngọc Hân', role: 'Kế toán', market: 'CL' },
    { id: 'NV03', name: 'Phạm Văn Lợi', role: 'Nhân viên thu phí', market: 'CL' },
    { id: 'NV04', name: 'Nguyễn Thị Diễm', role: 'Nhân viên thu phí', market: 'CL' },
    { id: 'NV05', name: 'Võ Hoàng Tuấn', role: 'Nhân viên kỹ thuật (điện, nước)', market: 'CL' },
    { id: 'NV06', name: 'Huỳnh Thanh Tâm', role: 'Tổ quản lý chợ quê', market: 'TTD' },
    { id: 'NV07', name: 'Đỗ Thị Kim Yến', role: 'Nhân viên thu phí phiên', market: 'TTD' }
  ];

  const ROLES = [
    { role: 'Lãnh đạo UBND phường', scope: 'Tất cả chợ', rights: 'Xem cổng giám sát, báo cáo, tra cứu; xử lý phản ánh vượt cấp' },
    { role: 'Trưởng Ban Quản lý chợ', scope: 'Chợ được giao', rights: 'Toàn quyền nghiệp vụ; phê duyệt miễn giảm, thanh lý hợp đồng' },
    { role: 'Kế toán', scope: 'Chợ được giao', rights: 'Phát hành khoản phải thu, đối soát, báo cáo tài chính' },
    { role: 'Nhân viên thu phí', scope: 'Chợ được giao', rights: 'Thu tiền, phát hành biên lai, ghi chỉ số điện nước' },
    { role: 'Nhân viên kỹ thuật', scope: 'Chợ được giao', rights: 'Nhận và xử lý công việc, sự cố được phân công' },
    { role: 'Tiểu thương', scope: 'Điểm kinh doanh của mình', rights: 'Mini app: xem, thanh toán khoản phải nộp; xem hợp đồng; gửi phản ánh' },
    { role: 'Quản trị hệ thống', scope: 'Toàn hệ thống', rights: 'Tài khoản, phân quyền, cấu hình đơn giá, kỳ thu, nhật ký' }
  ];

  const HO = ['Nguyễn', 'Trần', 'Lê', 'Phạm', 'Huỳnh', 'Võ', 'Phan', 'Đặng', 'Bùi', 'Đỗ', 'Ngô', 'Dương', 'Lý', 'Hồ', 'Mai', 'Trương', 'Châu', 'Lâm'];
  const DEM_NU = ['Thị', 'Thị Kim', 'Thị Ngọc', 'Thị Thanh', 'Thị Mỹ', 'Thị Bích', 'Thị Hồng'];
  const DEM_NAM = ['Văn', 'Minh', 'Hoàng', 'Quốc', 'Thanh', 'Công', 'Hữu'];
  const TEN_NU = ['Lan', 'Hoa', 'Hằng', 'Thảo', 'Trang', 'Nga', 'Hạnh', 'Mai', 'Loan', 'Phượng', 'Dung', 'Tuyết', 'Hương', 'Yến', 'Nhung', 'Diễm', 'Xuân', 'Thu', 'Kiều', 'Oanh'];
  const TEN_NAM = ['Hùng', 'Dũng', 'Phúc', 'Tài', 'Lộc', 'Sơn', 'Tâm', 'Hải', 'Nam', 'Thắng', 'Toàn', 'Hiếu', 'Bình', 'Khoa', 'Trung'];

  function build() {
    let seed = 20260913;
    const R = function () {
      seed |= 0; seed = seed + 0x6D2B79F5 | 0;
      let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
    const pick = a => a[Math.floor(R() * a.length)];
    const between = (a, b) => a + Math.floor(R() * (b - a + 1));
    const chance = p => R() < p;
    const pad = (n, l) => String(n).padStart(l || 2, '0');
    const iso = d => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
    const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
    const addMonths = (d, n) => { const x = new Date(d); x.setMonth(x.getMonth() + n); return x; };
    const saturdays = (y, m) => { const r = []; const d = new Date(y, m, 1); while (d.getMonth() === m) { if (d.getDay() === 6) r.push(new Date(d)); d.setDate(d.getDate() + 1); } return r; };

    const stalls = [], traders = [], contracts = [], invoices = [], payments = [];

    // ---- Điểm kinh doanh ----
    MARKETS.forEach(m => m.floors.forEach(f => f.sections.forEach(s => s.rows.forEach(row => {
      for (let i = 1; i <= s.per; i++) {
        const code = s.id + '-' + row + pad(i);
        const area = +(s.area[0] + R() * (s.area[1] - s.area[0])).toFixed(1);
        let status;
        const r = R();
        if (m.kind === 'session') status = r < 0.05 ? 'trong' : r < 0.10 ? 'no' : 'thue';
        else status = r < 0.10 ? 'trong' : r < 0.14 ? 'ngung' : r < 0.21 ? 'no' : r < 0.225 ? 'tranhchap' : 'thue';
        stalls.push({
          id: m.id + '-' + code, code, market: m.id, floor: f.id, section: s.id, sectionName: s.name,
          row, num: i, type: s.type, cat: s.cat, area, hasMeter: !!s.meter, status, traderId: null, contractId: null, history: []
        });
      }
    }))));

    // ---- Tiểu thương ----
    let tSeq = 0;
    function newTrader(market, cat) {
      const female = chance(0.78);
      const name = female
        ? pick(HO) + ' ' + pick(DEM_NU) + ' ' + pick(TEN_NU)
        : pick(HO) + ' ' + pick(DEM_NAM) + ' ' + pick(TEN_NAM);
      const t = {
        id: 'TT' + pad(++tSeq, 4), name, gender: female ? 'Nữ' : 'Nam',
        phone: '09' + between(0, 9) + between(1000000, 9999999),
        idNo: '087' + between(100000000, 999999999),
        birth: between(1962, 1998),
        address: pick(['Khóm 1', 'Khóm 2', 'Khóm 3', 'Khóm 5', 'Khóm 7', 'Khóm Tân Phát', 'Khóm Đông Thạnh', 'Khóm Hòa Khánh', 'Khóm Mỹ Tây']) + ', phường Cao Lãnh',
        market, cat, hkd: chance(0.62),
        since: iso(new Date(between(2008, 2025), between(0, 11), between(1, 28))),
        app: chance(market === 'TTD' ? 0.64 : 0.57), bank: chance(0.74),
        stalls: []
      };
      traders.push(t);
      return t;
    }

    let prev = null;
    stalls.forEach(st => {
      if (st.status === 'trong') { prev = null; return; }
      let t;
      if (prev && prev.market === st.market && prev.cat === st.cat && prev.stalls.length < 2 && chance(0.07)) t = prev;
      else t = newTrader(st.market, st.cat);
      t.stalls.push(st.id);
      st.traderId = t.id;
      prev = t;
    });

    // ---- Hợp đồng ----
    let cSeq = 0;
    stalls.filter(s => s.traderId).forEach(st => {
      const m = st.market;
      let start, end;
      if (m === 'TTD') {
        start = new Date(2026, 0, 1); end = new Date(2026, 11, 31);
      } else if (chance(0.075)) {
        end = addDays(TODAY, between(3, 30)); start = addMonths(end, -36);
      } else {
        // bắt đầu từ 11/2023 đến 07/2026 để hợp đồng còn hiệu lực sau ngày 13/09/2026
        start = addMonths(new Date(2023, 10, 1), between(0, 32));
        end = addDays(addMonths(start, 36), -1);
      }
      const unit = m === 'TTD' ? SESSION_FEE : UNIT[st.type];
      const monthly = m === 'TTD' ? 0 : Math.round(st.area * unit * 30 / 1000) * 1000;
      const c = {
        id: 'HĐ-' + m + '-' + start.getFullYear() + '-' + pad(++cSeq, 4),
        stallId: st.id, traderId: st.traderId, market: m,
        kind: m === 'TTD' ? 'Đăng ký quầy theo năm' : 'Hợp đồng thuê điểm kinh doanh',
        start: iso(start), end: iso(end), unit, monthly,
        deposit: m === 'TTD' ? 0 : monthly, status: 'hieuluc', scanned: chance(0.8)
      };
      contracts.push(c);
      st.contractId = c.id;
    });

    // ---- Khoản phải thu & thanh toán ----
    const PERIODS = ['2026-05', '2026-06', '2026-07', '2026-08', '2026-09'];
    const NONCASH = { '2026-05': 0.45, '2026-06': 0.52, '2026-07': 0.58, '2026-08': 0.64, '2026-09': 0.67 };
    const collectors = { CL: ['NV03', 'NV04'], TTD: ['NV07'] };
    let iSeq = 0, rSeq = 0;

    function makeItems(st, c, period) {
      const [y, mo] = period.split('-').map(Number);
      const items = [];
      if (st.market === 'TTD') {
        const n = saturdays(y, mo - 1).length;
        items.push({ name: 'Phí quầy theo phiên (' + n + ' phiên × ' + SESSION_FEE.toLocaleString('vi-VN') + ' đ)', amount: n * SESSION_FEE });
      } else {
        items.push({ name: 'Giá dịch vụ sử dụng diện tích bán hàng (' + st.area + ' m² × ' + c.unit.toLocaleString('vi-VN') + ' đ × 30 ngày)', amount: c.monthly });
        if (st.hasMeter) {
          const kwh = between(st.type === 'kiot' ? 120 : 50, st.type === 'kiot' ? 320 : 180);
          const m3 = between(2, st.section === 'AU' || st.section === 'HS' ? 18 : 6);
          items.push({ name: 'Tiền điện (' + kwh + ' kWh × ' + ELEC.toLocaleString('vi-VN') + ' đ)', amount: kwh * ELEC });
          items.push({ name: 'Tiền nước (' + m3 + ' m³ × ' + WATER.toLocaleString('vi-VN') + ' đ)', amount: m3 * WATER });
        }
      }
      return items;
    }

    stalls.filter(s => s.contractId).forEach(st => {
      const c = contracts.find(x => x.id === st.contractId);
      const debtMonths = st.status === 'no' ? between(1, 4) : 0;
      PERIODS.forEach((p, pi) => {
        const pStart = p + '-01';
        if (c.start > pStart && st.market === 'CL' && c.start.slice(0, 7) !== p) return;
        if (st.status === 'ngung' && pi >= 3) return; // tạm ngừng: không phát sinh 2 kỳ gần nhất
        const items = makeItems(st, c, p);
        const amount = items.reduce((a, b) => a + b.amount, 0);
        const [y, mo] = p.split('-').map(Number);
        const inv = {
          id: 'PT-' + p.replace('-', '') + '-' + pad(++iSeq, 5), period: p, market: st.market,
          stallId: st.id, traderId: st.traderId, contractId: c.id, items, amount, paid: 0,
          issued: iso(new Date(y, mo - 1, 1)), due: iso(new Date(y, mo - 1, 15)), status: 'unpaid', adjust: null, reminders: 0
        };
        const unpaidBecauseDebt = debtMonths && pi >= PERIODS.length - debtMonths;
        let pay = !unpaidBecauseDebt;
        if (p === '2026-09' && pay) pay = chance(0.62);
        if (pay) {
          const partial = chance(0.03);
          const amt = partial ? Math.round(amount * 0.5 / 1000) * 1000 : amount;
          const noncash = chance(NONCASH[p]);
          const method = noncash ? (chance(0.72) ? 'qr' : 'ck') : 'tm';
          let day = between(1, p === '2026-09' ? 13 : 15);
          if (p === '2026-09' && chance(0.22)) day = 13;
          const pr = {
            id: 'GD' + pad(++rSeq, 6), invoiceId: inv.id, market: st.market, traderId: st.traderId,
            amount: amt, method, date: iso(new Date(y, mo - 1, day)),
            time: pad(between(6, 17)) + ':' + pad(between(0, 59)),
            by: method === 'tm' ? pick(collectors[st.market]) : 'Hệ thống',
            receipt: 'BL' + p.replace('-', '').slice(2) + '-' + pad(rSeq, 6),
            lookup: Math.random().toString(36).slice(2, 8).toUpperCase(),
            reconciled: method === 'tm' ? null : true
          };
          payments.push(pr);
          inv.paid = amt;
          inv.status = partial ? 'partial' : 'paid';
        }
        invoices.push(inv);
      });
    });

    // Ổn định mã tra cứu theo seed
    payments.forEach(p => { p.lookup = (Math.floor(R() * 2176782336)).toString(36).toUpperCase().padStart(6, 'X'); });

    // ---- Chỉ số điện nước kỳ 09/2026 ----
    const readings = [];
    stalls.filter(s => s.hasMeter && s.traderId && s.status !== 'ngung').forEach(st => {
      const base = between(1200, 9800);
      const avg = st.type === 'kiot' ? between(150, 260) : between(60, 150);
      const entered = chance(0.62);
      const abnormal = entered && chance(0.08);
      const cons = abnormal ? Math.round(avg * (1.7 + R())) : Math.round(avg * (0.8 + R() * 0.4));
      const wBase = between(100, 900);
      const wAvg = between(3, 12);
      readings.push({
        stallId: st.id, period: '2026-09',
        elecPrev: base, elecCur: entered ? base + cons : null, elecAvg: avg,
        waterPrev: wBase, waterCur: entered ? wBase + Math.round(wAvg * (0.8 + R() * 0.5)) : null, waterAvg: wAvg,
        photo: entered, by: entered ? 'NV05' : null
      });
    });

    // ---- Phản ánh, sự cố ----
    const TPL = [
      ['Điện', 'Mất điện dãy ki-ốt, cần kiểm tra CB tổng'],
      ['Cấp thoát nước', 'Nước tràn khu thủy hải sản, cống thoát bị nghẹt'],
      ['Vệ sinh', 'Rác chưa được thu gom cuối buổi chiều'],
      ['An ninh trật tự', 'Buôn bán lấn chiếm lối đi chung'],
      ['PCCC', 'Bình chữa cháy hết hạn kiểm định'],
      ['Điện', 'Đèn chiếu sáng lối đi bị hỏng'],
      ['Hạ tầng', 'Mái che bị dột khi mưa lớn'],
      ['Cấp thoát nước', 'Đồng hồ nước chạy bất thường'],
      ['Vệ sinh', 'Nhà vệ sinh công cộng xuống cấp'],
      ['Khác', 'Đề nghị gia hạn thời gian nộp phí do tạm nghỉ ốm'],
      ['An ninh trật tự', 'Mất trộm hàng hóa ban đêm'],
      ['Hạ tầng', 'Nền gạch bong tróc trước quầy'],
      ['Điện', 'Ổ cắm quầy bị chập, có mùi khét'],
      ['Khác', 'Đề nghị bố trí thêm chỗ để xe cho khách']
    ];
    const stateCycle = ['tiepnhan', 'phancong', 'dangxuly', 'dangxuly', 'chonghiemthu', 'hoanthanh', 'dong', 'tiepnhan', 'phancong', 'dangxuly', 'hoanthanh', 'dong', 'tiepnhan', 'chonghiemthu'];
    const rented = stalls.filter(s => s.traderId);
    const incidents = TPL.map((t, i) => {
      const st = i % 5 === 3 ? pick(rented.filter(s => s.market === 'TTD')) : pick(rented.filter(s => s.market === 'CL'));
      const created = addDays(TODAY, -between(0, 9));
      const state = stateCycle[i];
      return {
        id: 'SC-' + pad(i + 101, 4), market: st.market, stallId: st.id, traderId: st.traderId,
        cat: t[0], title: t[1], state, source: i % 3 === 0 ? 'Nhập tại Ban Quản lý' : 'Mini app tiểu thương',
        escalated: i === 3 || i === 10,
        created: iso(created), deadline: iso(addDays(created, t[0] === 'PCCC' || t[0] === 'Điện' ? 1 : 3)),
        assignee: state === 'tiepnhan' ? null : (st.market === 'TTD' ? 'NV06' : 'NV05'),
        rating: state === 'dong' ? between(4, 5) : null,
        log: [{ at: iso(created), text: 'Tiếp nhận phản ánh' }]
      };
    });

    // ---- Thông báo đã gửi ----
    const notifications = [
      { id: 'TB-031', at: '2026-09-01', title: 'Phát hành khoản phải thu kỳ 09/2026', group: 'Toàn bộ tiểu thương', channels: ['Mini app', 'Zalo OA'], sent: 0, delivered: 0.97, read: 0.81, auto: true },
      { id: 'TB-030', at: '2026-08-28', title: 'Lịch phun khử khuẩn toàn chợ ngày 30/8', group: 'Chợ Cao Lãnh', channels: ['Mini app', 'Zalo OA'], sent: 0, delivered: 0.96, read: 0.74, auto: false },
      { id: 'TB-029', at: '2026-08-20', title: 'Nhắc nộp phí quá hạn kỳ 08/2026', group: 'Danh sách nợ phí', channels: ['Mini app', 'Zalo OA', 'SMS'], sent: 0, delivered: 0.95, read: 0.69, auto: true },
      { id: 'TB-028', at: '2026-08-15', title: 'Hướng dẫn thanh toán bằng mã QR', group: 'Toàn bộ tiểu thương', channels: ['Mini app', 'Zalo OA'], sent: 0, delivered: 0.97, read: 0.77, auto: false },
      { id: 'TB-027', at: '2026-08-08', title: 'Phiên chợ quê thứ Bảy 08/8 kéo dài đến 21h', group: 'Chợ quê Tân Thuận Đông', channels: ['Mini app', 'Zalo OA'], sent: 0, delivered: 0.98, read: 0.88, auto: false }
    ];
    const countFor = g => g === 'Toàn bộ tiểu thương' ? traders.length : g === 'Chợ Cao Lãnh' ? traders.filter(t => t.market === 'CL').length : g === 'Chợ quê Tân Thuận Đông' ? traders.filter(t => t.market === 'TTD').length : Math.round(traders.length * 0.09);
    notifications.forEach(n => { n.sent = countFor(n.group); });

    // ---- Phiên chợ quê ----
    const sessions = [];
    // Phiên 12/09/2026 để trống để demo thao tác "chốt phiên"
    for (let d = new Date(2026, 5, 20); d <= addDays(TODAY, -8); d = addDays(d, 7)) {
      const booths = between(30, 36);
      sessions.push({
        date: iso(d), booths, fee: booths * SESSION_FEE,
        visitors: between(2300, 3150), revenue: between(195, 285) * 1000000,
        noncash: +(0.25 + R() * 0.2).toFixed(2)
      });
    }

    // ---- Sao kê ngân hàng ngày 13/09/2026 (đối soát) ----
    const todayIso = iso(TODAY);
    const bank = payments.filter(p => p.date === todayIso && p.method !== 'tm').map((p, i) => ({
      id: 'SK' + pad(i + 1, 4), time: p.time, amount: p.amount, ref: 'CHOSO ' + p.invoiceId, paymentId: p.id, matched: true
    }));
    bank.push({ id: 'SK' + pad(bank.length + 1, 4), time: '10:42', amount: 450000, ref: 'CK TIEN SAP CO HANG', paymentId: null, matched: false });
    bank.push({ id: 'SK' + pad(bank.length + 1, 4), time: '15:07', amount: 1260000, ref: 'NOP PHI CHO THANG 9', paymentId: null, matched: false });
    bank.sort((a, b) => a.time.localeCompare(b.time));

    // ---- Chuỗi 12 tháng (mô phỏng) cho biểu đồ ----
    const months = [];
    const expectedMonthly = contracts.filter(c => c.market === 'CL').reduce((a, c) => a + c.monthly, 0);
    const nc = [0.18, 0.21, 0.25, 0.29, 0.33, 0.37, 0.41];
    for (let i = 0; i < 7; i++) {
      const d = new Date(2025, 9 + i, 1);
      // hệ số gồm cả tiền điện, nước để khớp mức thu thực tế các kỳ 05–09/2026
      const total = Math.round(expectedMonthly * (1.48 + R() * 0.08) * (0.9 + R() * 0.05));
      months.push({ period: d.getFullYear() + '-' + pad(d.getMonth() + 1), cash: Math.round(total * (1 - nc[i])), noncash: Math.round(total * nc[i]) });
    }

    const audit = [
      { at: '13/09/2026 08:12', who: 'Lê Thị Ngọc Hân', what: 'Đối soát tự động sao kê ngân hàng ngày 12/09/2026' },
      { at: '12/09/2026 16:40', who: 'Trần Minh Khoa', what: 'Phê duyệt miễn giảm 50% kỳ 09/2026 cho điểm KD HS-B07 (lý do: sửa chữa mái che)' },
      { at: '12/09/2026 09:05', who: 'Quản trị hệ thống', what: 'Cập nhật đơn giá theo QĐ 480/QĐ-UBND ngày 14/02/2026' },
      { at: '11/09/2026 14:21', who: 'Phạm Văn Lợi', what: 'Hủy biên lai BL2609-000388 (thu nhầm), lập lại BL2609-000391' },
      { at: '01/09/2026 00:05', who: 'Hệ thống', what: 'Tự động phát hành khoản phải thu kỳ 09/2026' }
    ];

    return {
      version: VERSION, today: iso(TODAY), stalls, traders, contracts, invoices, payments, readings, incidents,
      notifications, sessions, bank, months, audit, issuedPeriods: PERIODS.slice(), extraLog: []
    };
  }

  return { VERSION, TODAY, UNIT, SESSION_FEE, ELEC, WATER, MARKETS, STATUS, METHOD, INCIDENT_STATES, STAFF, ROLES, build };
})();

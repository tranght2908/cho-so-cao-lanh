/* Quản lý phương tiện tiểu thương — FE prototype V1.
 * Store tách riêng khỏi Trader và Hợp đồng. Phí luôn được suy ra từ biểu phí
 * có hiệu lực theo kỳ; đăng ký phương tiện không lưu giá như một nguồn sự thật.
 */
(function (A) {
  'use strict';
  const U = A.U;
  const TYPES = {
    MOTORBIKE: { label: 'Xe máy', icon: '🛵' },
    BICYCLE: { label: 'Xe đạp', icon: '🚲' },
    CAR: { label: 'Ô tô', icon: '🚗' },
    ELECTRIC_BIKE: { label: 'Xe đạp/xe máy điện', icon: '🛴' },
    OTHER: { label: 'Khác', icon: '🚙' }
  };
  const db = () => {
    A.db.traderVehicles = Array.isArray(A.db.traderVehicles) ? A.db.traderVehicles : [];
    return A.db.traderVehicles;
  };
  const vehiclesFor = (traderId, activeOnly) => db().filter(v => v.traderId === traderId && (!activeOnly || v.status === 'ACTIVE'));
  const vehiclePrice = (market, type, effectiveDate) => {
    const sc = A.SERVICE_CFG;
    if (!sc) return null;
    const date = effectiveDate || U.today();
    return sc.list('extraServices').filter(x => x.marketId === market && x.status === 'active' && x.category === 'VEHICLE' && x.vehicleType === type
      && (!x.effectiveFrom || x.effectiveFrom <= date) && (!x.effectiveTo || x.effectiveTo >= date))
      .sort((a, b) => String(b.effectiveFrom || '').localeCompare(String(a.effectiveFrom || '')))[0] || null;
  };
  // Finance and fee configuration retain these read-only legacy helpers. Trader profile UI no longer
  // renders or mutates vehicle registrations.
  A.VEHICLES = { TYPES, list: vehiclesFor, price: vehiclePrice };
})(window.APP);

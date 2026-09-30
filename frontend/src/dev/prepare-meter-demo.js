/* DEV-only meter-reading preparation for the confirmed CL / 2026-10 demo. No UI entry point. */
(function (A) {
  'use strict';
  const TARGET = Object.freeze({ marketId: 'CL', period: '2026-10', reviewCases: 3 });
  const list = x => Array.isArray(x) ? x : [];
  const exactTarget = input => !!input && input.marketId === TARGET.marketId && input.period === TARGET.period && input.reviewCases === TARGET.reviewCases;
  const finiteNonNegative = x => Number.isFinite(Number(x)) && Number(x) >= 0;
  const hash = value => String(value).split('').reduce((n, ch) => ((n * 31) + ch.charCodeAt(0)) >>> 0, 7);

  function meterState(meter, marketId) {
    return (meter && meter.completionByMarket && meter.completionByMarket[marketId]) || { status: (meter && meter.status) || 'PENDING' };
  }
  function eligibleStalls(db, marketId) {
    return list(db.stalls).filter(stall => stall.market === marketId && stall.hasMeter && list(db.contracts).some(contract =>
      (contract.businessPointId || contract.stallId) === stall.id && contract.status === 'hieuluc'))
      .sort((a, b) => String(a.code).localeCompare(String(b.code)));
  }
  function normalIncrement(avg, min, max, seed) {
    const desired = min + (hash(seed) % (max - min + 1));
    if (!finiteNonNegative(avg) || Number(avg) === 0) return desired;
    return Math.max(1, Math.min(desired, Math.max(1, Math.floor(Number(avg) * 1.25))));
  }
  function abnormalIncrement(avg) {
    return Math.max(Math.floor(Number(avg) * 2) + 1, Math.floor(Number(avg) * 1.5) + 1);
  }
  function isAbnormal(reading, kind) {
    const prev = Number(reading[kind + 'Prev']), cur = Number(reading[kind + 'Cur']), avg = Number(reading[kind + 'Avg']);
    return Number.isFinite(prev) && Number.isFinite(cur) && avg > 0 && cur - prev > avg * 1.5;
  }
  function clearReview(reading) {
    ['reviewRequired', 'reviewReason', 'reviewedBy', 'reviewedAt', 'reviewResult', 'reviewNote', 'reviewHistory', 'reviewDemo'].forEach(key => delete reading[key]);
  }
  function chooseCases(rows) {
    const free = new Set(rows);
    const take = predicate => {
      const row = rows.find(x => free.has(x) && predicate(x.reading));
      if (row) free.delete(row);
      return row;
    };
    return [
      { type: 'ELECTRICITY_HIGH', row: take(r => Number(r.elecAvg) > 0) },
      { type: 'WATER_HIGH', row: take(r => Number(r.waterAvg) > 0) },
      { type: 'BOTH_HIGH', row: take(r => Number(r.elecAvg) > 0 && Number(r.waterAvg) > 0) }
    ];
  }
  function inspect(input) {
    const db = A.db, meter = list(db.meterPeriods).find(x => x.id === input.period);
    const stalls = eligibleStalls(db, input.marketId), byStall = new Map();
    const allTargetReadings = list(db.readings).filter(r => r.period === input.period && ((list(db.stalls).find(s => s.id === r.stallId) || {}).market === input.marketId));
    allTargetReadings.forEach(reading => {
      const items = byStall.get(reading.stallId) || [];
      items.push(reading); byStall.set(reading.stallId, items);
    });
    const rows = stalls.map(stall => ({ stall, reading: (byStall.get(stall.id) || [])[0] }));
    const errors = [];
    if (!meter) errors.push('METER_PERIOD_NOT_FOUND');
    else if (meterState(meter, input.marketId).status === 'CLOSED') errors.push('METER_PERIOD_CLOSED');
    if (stalls.length !== 24) errors.push('EXPECTED_24_ELIGIBLE_STALLS_GOT_' + stalls.length);
    if (allTargetReadings.length !== stalls.length) errors.push('TARGET_READING_COUNT_MISMATCH');
    if (rows.some(x => !x.reading || (byStall.get(x.stall.id) || []).length !== 1)) errors.push('TARGET_READING_MAPPING_INVALID');
    if (rows.some(x => !x.reading || !finiteNonNegative(x.reading.elecPrev) || !finiteNonNegative(x.reading.waterPrev))) errors.push('PREVIOUS_READING_MISSING');
    const cases = chooseCases(rows.filter(x => x.reading));
    if (cases.some(x => !x.row)) errors.push('INSUFFICIENT_AVERAGE_FOR_3_REAL_WARNINGS');
    return { ok: !errors.length, errors, meter, stalls, rows, cases, allTargetReadings };
  }
  function report(input, scope) {
    return {
      ok: scope.ok,
      target: Object.assign({}, input),
      errors: scope.errors,
      counts: { eligibleStalls: scope.stalls.length, targetReadings: scope.allTargetReadings.length },
      completionStatus: scope.meter ? meterState(scope.meter, input.marketId).status : null,
      reviewCases: scope.cases.filter(x => x.row).map(x => ({ type: x.type, stallId: x.row.stall.id, stallCode: x.row.stall.code }))
    };
  }

  const DEV = A.DEV || (A.DEV = {});
  DEV.preflightPrepareMeterDemo = function (input) {
    if (!exactTarget(input)) return { ok: false, code: 'EXPLICIT_TARGET_REQUIRED', message: 'Phải truyền đúng { marketId: "CL", period: "2026-10", reviewCases: 3 }; không có prepare-all.' };
    const result = report(input, inspect(input)); console.info('[meter-demo] preflight', result); return result;
  };
  DEV.prepareMeterDemo = function (input) {
    if (!exactTarget(input)) return { ok: false, code: 'EXPLICIT_TARGET_REQUIRED', message: 'Từ chối chuẩn bị readings: phải truyền đúng marketId, period và reviewCases = 3.' };
    const scope = inspect(input), before = report(input, scope);
    if (!scope.ok) return Object.assign({ code: 'PREFLIGHT_FAILED', message: 'Dữ liệu chưa phù hợp; không ghi readings nào.' }, before);
    const caseByReading = new Map(scope.cases.map(x => [x.row.reading, x.type]));
    scope.rows.forEach(({ stall, reading }) => {
      const electricityNormal = normalIncrement(reading.elecAvg, 50, 250, stall.id + '|electricity');
      const waterNormal = normalIncrement(reading.waterAvg, 2, 15, stall.id + '|water');
      const type = caseByReading.get(reading);
      reading.elecCur = Number(reading.elecPrev) + (type === 'ELECTRICITY_HIGH' || type === 'BOTH_HIGH' ? abnormalIncrement(reading.elecAvg) : electricityNormal);
      reading.waterCur = Number(reading.waterPrev) + (type === 'WATER_HIGH' || type === 'BOTH_HIGH' ? abnormalIncrement(reading.waterAvg) : waterNormal);
      clearReview(reading);
      reading.status = 'RECORDED';
      reading.recordedBy = 'DEV_METER_DEMO';
      reading.recordedAt = '2026-10-15 09:00';
    });
    const valid = scope.rows.filter(x => !isAbnormal(x.reading, 'elec') && !isAbnormal(x.reading, 'water')).length;
    const review = scope.rows.filter(x => isAbnormal(x.reading, 'elec') || isAbnormal(x.reading, 'water')).length;
    if (valid !== 21 || review !== 3) throw new Error('Meter demo invariant failed: expected 21 valid and 3 review cases.');
    A.reindex(); A.save(); if (A.render) A.render();
    const result = { ok: true, before, after: { valid, review, unrecorded: 0, completionStatus: meterState(scope.meter, input.marketId).status }, reviewCases: report(input, scope).reviewCases };
    console.info('[meter-demo] completed', result); return result;
  };
})(window.APP);

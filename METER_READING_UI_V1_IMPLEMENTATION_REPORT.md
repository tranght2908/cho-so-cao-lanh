# METER READING UI V1 — Implementation Report

## 1. Audit

- Render module: `js/v-taichinh.js`, screen `A.VIEWS['dien-nuoc']`.
- Existing reading schema is one backward-compatible record per `stallId + period`: `elecPrev`, `elecCur`, `elecAvg`, `waterPrev`, `waterCur`, `waterAvg`, `elecPhoto`, `waterPhoto`, `status`, `recordedBy`, `recordedAt`.
- Meter periods are `A.db.meterPeriods`; finance periods are `A.db.billingPeriods`. Current screen reuses the meter-period selector in `ui.period`.
- Point/trader relation: `Reading.stallId → Stall.traderId → Trader`. Existing finance reads the legacy reading fields when it displays/creates subsequent sample receivables.
- Existing price references are `D.ELEC`/`D.WATER`; service configuration is intentionally not connected to live finance pricing.
- Existing permission and scope: `A.canDo('dien-nuoc.ghi-chi-so', market)`, selected market `ui.market`, screen applicable only to `CL`.

## 2. Files changed

- `js/v-taichinh.js`
- `styles.css`

## 3. Meter / reading schema

No parallel persisted schema was created. The V1 UI presents two virtual, stable meter identities per existing reading record:

- Electricity: `CT-<point-code>-01`
- Water: `DN-<point-code>-01`

Both read/write the pre-existing electricity/water fields in the same `stallId + period` record, preserving finance compatibility.

## 4. Delivered behavior

- Period selector, type/status filters, functional search, and derived summary cards.
- One scan-friendly table row per business point; electricity and water stay independent internally but are grouped only for list rendering.
- Read-only previous value obtained from the closest earlier record for the same point and meter type; no cross-meter lookup.
- Modal with point, meter, prior period, automatic consumption, evidence metadata, notes, and save validation.
- `current < previous` is blocked; zero consumption is permitted.
- Evidence is local/mock metadata only and is attached to the relevant reading + type + period. Selecting an image from the Web device uses `URL.createObjectURL` to show an immediate session-only preview; localStorage retains metadata only.
- Point detail shows both meter cards and each meter's own historical periods; existing monthly data supplies the history.
- Prototype abnormal warning is clearly implemented as `consumption > 150%` of the existing seeded average; it never changes a reading automatically.
- No receivable/payment is created by this UI.

## 5. Permission / scope and regression

- All save paths re-check `A.canDo`, selected market, period, and reading existence.
- Duplicate reads are prevented by updating the existing `stallId + period` reading rather than inserting a second record.
- Existing receivable uses its old reading fields unchanged.
- `node --check js/v-taichinh.js`: PASS.
- `git diff --check`: PASS.
- Browser-console/manual-flow test remains required in a browser environment.

## 6. NEED_CONFIRMATION

1. The abnormal-consumption threshold is a prototype demo rule, not an approved business rule.
2. Whether an evidence photo is mandatory for every meter reading is not confirmed.
3. Replacement/reset meters and a new reading lower than the old reading require a confirmed business workflow; V1 blocks normal saving in that case.

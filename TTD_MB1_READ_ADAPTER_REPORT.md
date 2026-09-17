# TTD-MB1 READ ADAPTER REPORT

## 1. Pre-check

- `git branch --show-current`: `feature/ttd-market-layout-workflow`
- `git status --short`: clean before changes
- `git log -1 --oneline`: `1ecfffb feat: unify market layout RBAC and normalize typography`

## 2. Direct read paths before refactor

- `js/v-dieuhanh.js`: `mbMatchRealSection(mid, code)` searched `D.MARKETS` floors and matched `zone.code === section.id`.
- `js/v-dieuhanh.js`: `A.mbOverviewHtml` called `mbMatchRealSection(mid, z.code)` and then filtered `A.db.stalls` by `st.market === mid && st.section === z.code`.
- `js/v-dieuhanh.js`: `A.mbZoneDiagramHtml` called `mbMatchRealSection(mid, z.code)` and then filtered `A.db.stalls` by `st.market === mid && st.floor === f.id && st.section === sec.id`.
- `js/v-cautruc.js`: `mbWorkspaceHtml` header summary filtered `A.db.stalls` by `st.market === mid` and counted statuses directly.
- `js/v-dieuhanh.js`: `A.ACT.stall`, `stall-status`, and `stall-status-save` read points with `A.idx.stall.get(...)` directly.

## 3. Helpers added

- `A.mbResolveZoneContext(mid, zone)`: resolves market/floor/section using the current `zone.code === section.id` mapping and returns `{ market, floor, section, matched, reason }`.
- `A.mbBusinessPointsForZone(mid, zone)`: reads `A.db.stalls` through resolved market/floor/section, returning `[]` when unmatched.
- `A.mbBusinessPointById(mid, pointId)`: looks up by id and confirms `record.market === mid`.
- `A.mbBusinessPointsForMarket(mid)`: reads all `A.db.stalls` for one market, independent from `LAYOUT`.
- `A.mbMarketStats(mid)`: derives total/status distribution from `A.mbBusinessPointsForMarket`.
- `A.mbZoneStats(mid, zone)`: derives total/status distribution from `A.mbBusinessPointsForZone`.

## 4. Refactor result

- `A.mbOverviewHtml` now uses `A.mbResolveZoneContext` and `A.mbZoneStats`.
- `A.mbZoneDiagramHtml` now uses `A.mbResolveZoneContext` and `A.mbBusinessPointsForZone`.
- `mbWorkspaceHtml` summary now uses `A.mbMarketStats(mid)`, preserving the pre-MB1 semantics: all real points in the selected market, not only points reachable from current layout zones.
- Drawer/status handlers now use `A.mbBusinessPointById(ui.market, id)` before opening UI or mutating status.

## 4.1. Header stats fix

- Market-level stats and zone-level stats are intentionally separate.
- Header stats are market-level and do not depend on `LAYOUT`, zone matching, or section matching.
- Missing layout zones do not remove points from the header.
- Duplicate zones do not double-count points in the header.
- Overview/diagram remain zone-level and still show only zones present in `LAYOUT`.
- Remaining limitation: a custom zone that does not match a real section still renders the existing fallback in overview/diagram; this phase does not add schema migration or new mapping rules.

## 5. Test summary

- CL: `HS` adapter count matched old logic: `36`.
- TTD: `AT = 20`, `NS = 7`, `TN = 9`, total `36`.
- Header market stats: TTD total `36`; CL total remains equal to all real CL stalls.
- Missing-zone fixture: TTD header stays `36`.
- Duplicate-zone fixture: TTD header stays `36`; each duplicate `AT` zone still has zone stats `20`.
- Zone not matched: `matched=false`, reason `section-not-found`, points `[]`.
- Cross-market: `A.mbBusinessPointById('TTD', CL id) === null`; `A.mbBusinessPointById('CL', TTD id) === null`.
- Cross-market handler guard: drawer/status did not open for a point outside selected market and status did not mutate.
- Read tests kept `A.db.stalls` and `sessions` deep-equal.

## 6. Scope confirmation

- No schema change.
- No migration.
- No new localStorage key.
- No source-of-truth change.
- No UI/route/menu/permission change.
- No changes to `data.js`, `js/core.js`, `js/permissions.js`, `styles.css`, or other modules.

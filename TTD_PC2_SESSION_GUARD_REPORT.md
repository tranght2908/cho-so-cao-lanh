# TTD-PC2 Session Guard Report

## Scope

- Hardened the existing `phien-cho` demo flow only.
- No session schema change.
- No lifecycle, attendance collection, finance integration, or permission change.
- Business market remains fixed to TTD.

## Read Path

- Old session modal path read points directly from `A.db.stalls.filter(s => s.market === 'TTD' && s.traderId)`.
- New path reads all TTD points through `A.mbBusinessPointsForMarket('TTD')`, then applies the existing eligibility rule: `traderId` is present.
- Display order follows the adapter array order and keeps the previous checked-by-status behavior.

## Guards

- `session-open` now checks selected market, screen/context, action permission for TTD, duplicate session date, and adapter availability before opening the modal.
- `session-save` repeats market, context, permission, adapter, input, DOM, and duplicate checks independently before mutation.
- The pending demo date is centralized as `TTD_PENDING_SESSION_DATE = '2026-09-12'`.

## DOM Validation

- Checked checkbox ids are reconciled against the eligible TTD point set.
- Fake ids, CL ids, or unknown ids block the save.
- Duplicate checked ids are counted once.
- `visitors` and `revenue` must be finite non-negative numbers.
- `fee` is recalculated from `booths * D.SESSION_FEE`.

## Duplicate Protection

- The duplicate check runs again immediately before push.
- If a session with the pending date appears after the modal opened, save is blocked and no second session is created.

## Save Rollback

- The session object is pushed only after validation passes.
- If `A.save()` throws, the pushed session is removed.
- Any success log added before save is also rolled back.

## Tests

- Adapter called with `TTD`.
- Eligible list contains only TTD points with `traderId`.
- `session-open` blocks CL, missing permission, duplicate date, and adapter failure.
- Valid save pushes exactly one schema-compatible session and calls `A.save()` once.
- Fake DOM ids are blocked; duplicate ids do not inflate `booths`.
- Duplicate/race save is blocked.
- Invalid visitors/revenue inputs are blocked.
- Save failure rolls back session and success log.
- Stalls and finance collections are not mutated by read/guard tests.

## Remaining Limits

- No lifecycle states.
- No detailed attendance persistence.
- No finance integration.
- The pending date and metrics remain demo values.
- Eligibility still means “point has traderId”; this is the existing rule and still needs business confirmation.

# Phase 10 — Contract Lifecycle Migration

Master run 8→13. Baseline `cd41337`; Phases 8–9 are in the working tree.

## Operations that actually exist (effective `CONTRACT_MANAGEMENT_V1` handlers)

| Operation | Effective handler | Legacy behavior (characterized) | Migrated? |
|---|---|---|---|
| Renew | `ct-renew` (+ aliases `ct-extend`, `ct-extend-save`) | Permission check → `closeModal` → calls final `A.ACT['ct-new']` (workflow) with `{dataset:{id}}`. It never mutates the old contract. The workflow reads `dataset.trader`, so it opens the generic form, or shows "Chưa có hồ sơ tiểu thương phù hợp." if the market has no eligible trader. | Lookup only (`CS.get`). **Behavior preserved** (no new renewal lifecycle invented). |
| Signed document update | `ct-copy-add` | Mock file picker → `signedCopies ||= []` → push `{name, page: n+1, addedAt, mock:true}` → `scanned = true` → history "Cập nhật bản ký" → save → reopen detail | Yes → `contracts.service.addSignedCopy` |
| Print | `ct-print` | History "In hợp đồng" → save → print window | Yes → `contracts.service.recordEvent` |
| Terminate | `ct-terminate[-file, -file-remove]`, `ct-terminate-save` | Validate reason, date and detail → `status='chamdut'` → `termination={date,reason,detail,note,attachment}` → delete draft attachment → history → `release(c)` → save | Yes → `contracts.service.terminate` |
| Liquidate | `ct-liquidate[-toggle, -copy-add, -copy-remove, -print, -info]`, `ct-liquidate-save` (+ aliases `ct-end`, `ct-end-save`) | Validate draft, no unpaid invoice for the contract, 7 checklist items, signed minutes, and expired/terminated state → `status='thanhly'`, `liquidatedAt`, `liquidationNote`, `liquidationChecklist`, `liquidationSignedCopies` → delete draft → history → `release(c)` → save | Yes → `contracts.service.liquidate` |

### Point release (exact legacy `release(c)` semantics, preserved)

```text
s = point(c), t = trader(c)
if s && no OTHER active contract (status 'hieuluc') uses s:
    s.status = 'trong'; s.traderId = null; s.contractId = null
if t: t.stalls = t.stalls.filter(id => !s || id !== s.id)     // reassigned; always unlinks
```

Point history is never deleted. No invoice, payment or deposit adjustment is created: liquidation only **reads** unpaid invoices as a precondition, and that check stays in the UI handler unchanged.

## New orchestration

```text
V1 UI handler (form read, validation, messages, drafts, modals)
  → contracts.service.terminate(id, termination, historyEntry)
      applyTermination → addHistory → releasePoint → APP.data.save()
  → contracts.service.liquidate(id, liquidation, historyEntry)
      applyLiquidation → addHistory → releasePoint → APP.data.save()
  → contracts.service.addSignedCopy(id, {name, addedAt}, historyEntry)
      addSignedCopy → addHistory → APP.data.save()
  → contracts.service.recordEvent(id, historyEntry)
      addHistory → APP.data.save()

releasePoint(c) (in the contracts service):
  businessPoints.service.vacate(pointId)       only when no other active contract uses the point
  traders.service.unlinkPoint(traderId, pointId|null)
```

Each command saves exactly once, in the same position as the legacy `A.save()`. Repositories write only their own aggregate:
- contracts repository: `addHistory`, `addSignedCopy`, `applyTermination`, `applyLiquidation`
- business-points repository: `vacate`
- traders repository: `unlinkPoint`

As in Phase 9, these are frontend orchestration boundaries without a real transaction. **The backend implementations MUST be `@Transactional` use cases.**

History entries are still built in the UI by `eventEntry(action, detail)`, with the same shape `{at, action, detail}`. The legacy in-place `event(c, …)` helper is kept for the remaining legacy users: `expiryNotifications` and the unreachable V1 `ct-new-save`.

### Intentionally retained (legacy)

- **Draft state on the contract record** (`_terminationDraftAttachment`, `_liquidationDraft`) is written in place by `ct-terminate-file*` and `ct-liquidate-toggle/copy-*` without saving. That is legacy behavior; the commands above consume it.
- **`syncExpiry` / `expiryNotifications`** write notifications and contract history during `hop-dong` render, without saving. Unchanged.
- **V1 `ct-new` / `ct-new-save`** (wrapped by `vehicles.js`) and the older main-module definitions. These are unreachable: every form containing `data-act="ct-new-save"` is opened only by `ct-new` implementations that `workflow.js` replaced. They are not an effective lifecycle path, so they are not migrated. Removal is evaluated in Phase 11/13.

## Validation

- Behavioral regression harness: **BEHAVIOUR EQUAL (229/229)** vs `cd41337`.
- Lifecycle smoke test (`smoke-lifecycle.js`, real UI actions, both trees) PASSES 15/15, and the **serialized results are byte-identical between baseline and current**. It covers:
  - terminate with another active contract on the same point: the point stays occupied, but the trader is unlinked;
  - terminate with an attachment, then liquidate with the 7 checks and signed minutes: the point is released to `trong`, links are cleared and the history is kept;
  - signed copies paged 1..n with `scanned=true`;
  - print audit event;
  - renew delegates to the create path with no mutation;
  - one save per command;
  - no invoice or payment mutation;
  - `needsContract` reflects released traders.
- Phase 9 create smoke still PASSES 14/14.
- `node --check`: 28 files PASS. Routes 21/21. Storage 11 + 1 unchanged. Legacy order unchanged. `git diff --check` PASS.

**PHASE 10 PASS.**

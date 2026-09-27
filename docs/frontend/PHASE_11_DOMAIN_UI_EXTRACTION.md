# Phase 11 — Domain UI Extraction

Master run 8→13. Baseline `cd41337`; Phases 8–10 are in the working tree.

## Goal and approach

Reduce the `js/v-tieuthuong.js` god-file by ownership, using **move, don't duplicate**. Move a block, switch its registration (script position), validate, and remove the old copy in the same step. Delete only code whose override is proven.

## What moved

| Block (from `js/v-tieuthuong.js`) | New file | Why it is safe |
|---|---|---|
| Detail-layout IIFE (`A.contractDetailLayoutV2`) | `src/features/contracts/detail.js` | A self-contained top-level IIFE that communicates only through `APP`. |
| `CONTRACT_MANAGEMENT_V1` IIFE: effective `hop-dong` view + status filter wrapper; `hd-*`, `ct-*` handlers | `src/features/contracts/page.js` | Self-contained IIFE, same reason. |

Both files load **immediately after** `js/v-tieuthuong.js` and **before** `js/vehicles.js`. The sequence in which `A.VIEWS`/`A.ACT` values are assigned and captured is therefore unchanged:

```text
v-tieuthuong.js (main module)
  → contracts/detail.js
  → contracts/page.js
  → vehicles.js (wraps ct-new/ct-new-save)
  → … → workflow.js (wraps hop-dong, replaces ct-new)
```

The relative order of the 19 legacy scripts is unchanged (the new files are inserted between them). The moved code is verbatim apart from a header comment.

`js/v-tieuthuong.js`: **3,058 → 2,809 lines** (`wc -l`).

## What was deleted (proven overridden)

| Deleted code | Proof |
|---|---|
| Main-module contract section (103 lines): `hdFixedContract`, first `A.VIEWS['hop-dong']`, `hd-tab`, `hd-search`, `ct-extend`, `ct-extend-save`, `ct-end`, `ct-end-save`, `ct-new`, `ct-new-save` | V1 re-registers every one of these keys during the same script load, before any other script captures them. `vehicles.js` and `workflow.js` capture only after V1. `hdFixedContract` had no other caller. |
| `ct-view` override IIFE (9 lines) | Re-assigned by V1's `ct-view` before any event could fire. |
| `A.ACT['ct-view']` inside the detail-layout IIFE (1 line) | Same. |

The effective registries were compared with `regcheck.js`, which loads baseline and current in the harness and compares every `A.ACT`/`A.VIEWS`/`A.IN`/`A.CH` key and handler source:
- key sets: **identical**;
- handlers with different source: only `ct-copy-add, ct-copy-view, ct-liquidate*, ct-print, ct-renew, ct-terminate*, ct-view, wf-contract-save`, i.e. exactly the handlers intentionally rewired in Phases 8–10. Every other effective handler, including all keys previously shadowed by the deleted code, is byte-identical.

## Override review (`EFFECTIVE_RUNTIME_ACTIONS.md` candidates)

| Key | Finding | Action |
|---|---|---|
| `hop-dong` | First-generation view was dead; V1 is effective, wrapped by status filter and `workflow.js`. | Dead view deleted; V1 moved. |
| `ct-new` | Final = `workflow.js`. V1 `ct-new` is captured by the `vehicles.js` wrapper, which is itself replaced, so it is unreachable. First-gen deleted. | V1 + wrapper **kept** (see below). |
| `tt-new` | Final = `workflow.js`. The legacy wizard (`tt-new`, `tt-wizard-*`, `ttw-*`, ~170 lines) is unreachable: every wizard handler guards on `ttWizardDraft`, which only the overridden `tt-new` sets. | **Kept, documented.** It is the only "create trader + allocate point + direct seller + vehicles" implementation, so removing it is a product decision, not a refactor. |
| `mat-bang` | `v-tieuthuong.js` override delegates to `A.mbWorkspaceHtml` (from `v-cautruc.js`) for non-CL markets, so it is still used. | Kept. |
| `tai-khoan` | `workflow.js` wrapper calls the captured `v-vanhanh.js` view, so it is still used. | Kept. |

V1 `ct-new`/`ct-new-save` and the `vehicles.js` `enhanceContractModal` wrapper are unreachable for the same reason as the wizard, but they are the only path that snapshots vehicle fees (`vehicleFeeSnapshot`). Kept and documented. The effective workflow create does not offer vehicle fees; that is baseline behavior and was not changed.

## Not extracted (and why)

| Area | Blocker |
|---|---|
| Trader list/drawer/edit UI | Spread over two regions of the main module. It shares module state with business-point and wizard code both ways: `f.ttcl*`/`f.tt*` filter state; `ttEditId`/`ttPendingDocs` (used by the edit handlers after the wizard); `TT_DOCS` (also exported to `workflow.js`/`mini.js`); `ttUsageStore`/`ttPointPath` (used by the point drawer); `dkSeller` (point section). Extraction would require publishing ~15 internal functions on `APP` as new global surface. The data path is already behind `TradersService`/`BusinessPointsService`/`ContractsService`. |
| Business-point table/drawer, split/merge/conversion | Same shared closure. It also includes deep `pointRequests` workflows that the ownership analysis assigns to a dedicated point-change feature, which needs its own characterization phase. |

## Validation (checkpoint)

- Full regression harness: **BEHAVIOUR EQUAL (229/229)**. This covers trader list/detail/edit/documents, contract list/tabs/filter/search/detail, create, lifecycle, business-point display (`mat-bang`/`diem-kd` renders), the market layout routes, account readiness/creation, and all 21 routes for 5 account/market combinations before and after mutations.
- Create smoke 14/14 PASS; lifecycle smoke 15/15 PASS, with results byte-identical to baseline.
- `node --check`: 30 files PASS. Routes 21/21. Storage 11 + 1 unchanged. Legacy relative order unchanged. `git diff --check` PASS.

**PHASE 11 PASS.**

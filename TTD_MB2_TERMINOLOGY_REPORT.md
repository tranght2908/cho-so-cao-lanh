# TTD-MB2 Terminology Report

## Scope

- Adjusted `mat-bang` terminology and controls by selected market.
- TTD uses `mid === 'TTD'` only; role is not used for terminology.
- No schema, localStorage key, adapter, permission, route, or business data change.

## TTD UI Changes

- Tree header shows `Phân khu chợ`.
- The top `+ Khối/Nhà chợ` button is hidden.
- Block and floor CRUD controls are hidden.
- Zone add button shows `+ Khu chức năng`.
- Zone drawer hides `Thuộc khối/nhà chợ` and `Tầng`.
- Existing zone labels, planned point labels, and zone data fields remain unchanged.

## Hidden Block/Floor Handling

- TTD zone add ignores caller-provided `data-block` and `data-floor`.
- New TTD zones use the existing first block/floor in the current TTD layout.
- TTD zone field changes for `blockId` and `floorId` return safely without mutating the zone.
- Existing `blockId` and `floorId` remain persisted on zone objects.

## Handler Guards

The following block/floor handlers now return safely for TTD before mutation:

- `qh-add-block`
- `qh-add-block-save`
- `qh-edit-block`
- `qh-edit-block-save`
- `qh-del-block`
- `qh-del-block-ok`
- `qh-add-floor`
- `qh-add-floor-save`
- `qh-edit-floor`
- `qh-edit-floor-save`
- `qh-del-floor`
- `qh-del-floor-ok`

## CL Regression

- CL keeps the `Cấu trúc` title.
- CL keeps `+ Khối/Nhà chợ`.
- CL keeps block/floor CRUD controls.
- CL zone drawer keeps `Thuộc khối/nhà chợ` and `Tầng`.
- CL add/edit zone behavior remains on the original block/floor path.

## Limits

- TTD still uses the existing layout schema internally.
- This phase does not introduce area/section/businessPoint schema.
- This phase does not migrate localStorage or rewrite stored layouts.
- If a custom TTD layout has multiple blocks/floors, block/floor CRUD remains guarded, but the stored structure itself is not normalized in this phase.

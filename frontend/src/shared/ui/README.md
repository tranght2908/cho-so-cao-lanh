# Shared UI primitives

Presentation primitives with no business knowledge (Phase 15.2):

| File | Owns |
|---|---|
| `icons.js` | `U.icon` and the inline SVG set |
| `table.js` | `U.table`, `U.pager`, `U.csv`, action `page` |
| `overlays.js` | `U.toast`, `A.modal` / `A.closeModal` / `A.mHead`, drawer back-stack (`A.drawerPush/Reset/Back/BackHtml`), actions `overlay`, `close`, `drawer-back` |
| `graphics.js` | `U.qr` (mock QR), `U.bars`, `U.donut` |

Styling stays in `frontend/styles.css`.

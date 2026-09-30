# Market sessions feature

> **Không còn được runtime load (30/09/2026).** Module "Phiên chợ quê" đã bỏ khỏi sản phẩm: `index.html` không nạp `page.js`, menu/route `phien-cho` đã gỡ (`#/phien-cho` → `#/mat-bang`), quyền `phien-cho.*` bị ẩn khỏi catalog hiện hành. Mã nguồn giữ tạm làm legacy; dữ liệu phiên trong `A.db` không bị xoá.

Owns the Tân Thuận Đông `phien-cho` page, its session model, registration
workflow, attendance, replacement, and session-close actions. The page remains
a classic script and preserves the existing `A.VIEWS`, `A.ACT`, and `A.CH`
contracts while the frontend migration is in progress.

The Mini App session-registration and payment UI remains in `js/mini.js` until
the trader-portal migration batch; it calls the session domain contracts exposed
by this feature.

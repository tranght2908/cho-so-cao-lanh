# Market sessions feature

Owns the Tân Thuận Đông `phien-cho` page, its session model, registration
workflow, attendance, replacement, and session-close actions. The page remains
a classic script and preserves the existing `A.VIEWS`, `A.ACT`, and `A.CH`
contracts while the frontend migration is in progress.

The Mini App session-registration and payment UI remains in `js/mini.js` until
the trader-portal migration batch; it calls the session domain contracts exposed
by this feature.

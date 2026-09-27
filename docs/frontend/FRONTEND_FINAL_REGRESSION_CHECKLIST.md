# Frontend Final Regression Checklist (after master run 8→13)

Run in a real browser. Start with **Cài đặt → Đặt lại dữ liệu mẫu**, or clear `localStorage`, so the seed is fresh. Keep DevTools open and record any **new** console error. Items marked ★ touch code changed in Phases 6–12.

Suggested accounts:
- `AC-QT01`: system admin; can create accounts.
- `AC-NV01`: Chợ Cao Lãnh market manager; trader/contract permissions.
- `AC-NV07`: TTĐ collector.
- `AC-LD01`: ward leader; read-oriented.
- A trader account for the Mini App.

## AUTH

- [ ] Login by phone → OTP → dashboard/first permitted screen.
- [ ] Wrong OTP shows the existing error; a locked account is refused.
- [ ] Logout returns to login; reload keeps the session as before.
- [ ] Role visibility: menu items per role match the previous build (admin, manager, collector, ward leader, trader → Mini App).
- [ ] Market selector: MARKET-scoped accounts see only their markets; GLOBAL accounts see "Tất cả".

## MARKETS

- [ ] Danh mục chợ lists 12 markets; filter/search; CSV export.
- [ ] View and edit a market (permitted role); save; reload keeps the change.

## TRADERS

- [ ] ★ Hồ sơ tiểu thương list, CL: floor/zone/category filters, search by name/phone/ID/point code, "Xóa bộ lọc", pagination.
- [ ] ★ Non-CL market: generic list, Mini App filter, "Điểm KD" column.
- [ ] ★ Open detail drawer: portrait, sections A–E, point cards (section C), unpaid count.
- [ ] ★ Edit profile: empty-field message; duplicate CCCD message; save; reload keeps the data.
- [ ] ★ Documents: view preview; "Thay thế" → pending note → Save applies / Cancel discards.
- [ ] "+ Thêm hồ sơ tiểu thương" (workflow) → save → success modal → "Tạo hợp đồng ngay" / "Để sau".

## BUSINESS POINT

- [ ] Mặt bằng (CL): tree Khu/Tầng/Dãy, grid/table views, point drawer, seller info.
- [ ] Non-CL layout workspace renders.
- [ ] ★ After creating a contract, the point shows as rented and the "new" marker appears.
- [ ] ★ Availability: the contract form lists only vacant points of the market without an active contract (same set as before).
- [ ] Split / merge / conversion request screens open (no behavior change expected).

## CONTRACTS

- [ ] ★ Hợp đồng list: summary cards, tabs (Tất cả / Hiệu lực / ≤30 / ≤15 / Đã kết thúc), status filter, "Xóa bộ lọc", search, pagination.
- [ ] ★ "Cần xử lý" task for traders without a contract.
- [ ] ★ Detail dossier (A–F sections), "Xem hồ sơ tiểu thương", "Xem chi tiết điểm".
- [ ] ★ Create: form preselection, point change updates price/info, invalid dates rejected, duplicate rejected, success modal → "Đi tới điểm kinh doanh" / "Xem hợp đồng". Reload: contract, point status and trader link persist.
- [ ] ★ Renew ("Gia hạn / Tạo HĐ mới"): opens the create flow (or the "Chưa có hồ sơ tiểu thương phù hợp." toast); the old contract is unchanged.
- [ ] ★ Signed document: "+ Thêm ảnh" → the copy is listed as "Ảnh trang n" in section E of the dossier, a history entry is added, and "Xem" opens its metadata.
- [ ] ★ Print: a print window opens (or the popup-blocked toast); a history entry "In hợp đồng" is added.
- [ ] ★ Terminate: validation message; attachment add/remove; confirm → "Đã chấm dứt"; point released (unless another active contract uses it); trader unlinked.
- [ ] ★ Liquidate: blocked when not expired/terminated; debt blocks; 7 checklist items + signed minutes enable the button; confirm → "Đã thanh lý"; point released.

## FINANCE

- [ ] Khoản phải thu: list/filter; issue period if applicable.
- [ ] Thu tiền & biên lai: collect cash, receipt printed/sent; debt updates.
- [ ] Công nợ & nhắc nợ: amounts unchanged vs previous build for the same seed.
- [ ] Đối soát: bank matching.
- [ ] Chỉ số điện, nước: readings and adjustments.
- [ ] ★ Trader drawer "Khoản chưa thanh toán" equals the invoice list count.

## OPERATIONS

- [ ] Phản ánh & sự cố: create incident with image, assign, progress statuses.
- [ ] Thông báo đa kênh: list/send.
- [ ] Tài sản chợ: list/add.

## ACCOUNTS

- [ ] ★ Tài khoản: "Cần xử lý" lists traders with an active contract + point and no account (`needsAccount`).
- [ ] ★ "Tạo tài khoản" → confirmation → create → status PENDING_ACTIVATION, ID `AC-TT<nn>`; "Gửi thông báo kích hoạt" toast.
- [ ] Linked trader account can activate via OTP in the Mini App.
- [ ] Permission denied roles do not see create buttons.

## REPORTS

- [ ] Tổng quan liên chợ dashboard (scope selector), alerts.
- [ ] Báo cáo thống kê: open, export CSV, print.

## MINI APP

- [ ] Trader login by phone/OTP (linked account; locked account refused).
- [ ] Home: points, contracts, charges.
- [ ] Pay a charge; receipt; incident submission.
- [ ] Market-session registration (TTĐ) if applicable.

## FINAL

- [ ] Reload after all steps: no data loss; no new localStorage keys other than the 11 known ones and the sessionStorage recent-point marker.
- [ ] Console: no new errors.

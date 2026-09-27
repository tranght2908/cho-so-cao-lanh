# Frontend Refactor Rules

## Golden Rule

Refactor thay đổi cấu trúc code, **KHÔNG thay đổi behavior** nếu phase không nói rõ.

## Mỗi phase phải

1. Có phạm vi nhỏ và nêu rõ public contract bị ảnh hưởng.
2. Không đồng thời sửa business rule.
3. Giữ route compatibility.
4. Giữ RBAC compatibility.
5. Giữ `data-act` / `data-ch` compatibility cho đến khi có migration riêng.
6. Giữ localStorage compatibility cho đến repository migration được kiểm chứng.
7. Không xóa mock trước khi API có parity.
8. Không tạo duplicate implementation hoặc source of truth song song.
9. Không tạo file tên `new`, `new2`, `final`, `final2`, `temp`, `backup`, `copy`.
10. Không comment-out code cũ để “giữ lại”.
11. Chỉ xóa code cũ sau khi replacement được kiểm chứng bằng regression checklist.
12. Sau mỗi phase chạy regression checklist trong `docs/FRONTEND_BASELINE.md`.
13. Một commit chỉ nên đại diện cho một phase/refactor concern.

## Phase discipline

- Không đổi script order, route id, permission key, storage key, status code, account/market/business identifier trong một structural phase nếu không có migration được phê duyệt.
- Không “dọn” override `A.VIEWS` hoặc `A.ACT` chỉ vì nó trông duplicate; trước hết phải thay bằng composition có test characterization.
- Không kết hợp extract file với redesign UI/CSS hoặc chỉnh business data.
- Cần kiểm tra working tree trước và sau mỗi phase. Không đưa thay đổi sẵn có của người dùng vào phase refactor.
- Mọi source runtime mới cần có một owner feature rõ ràng; view không được tự tạo repository/store riêng.

## Architecture direction

```text
UI
↓
Feature service
↓
Repository interface
↓
Mock repository NOW
↓
API repository LATER
```

View không được biết data đến từ mock hay API. View chỉ gọi feature service/query/command; repository mới biết localStorage/mock hay HTTP API.

## Definition of done cho một refactor phase

- Không có behavior change ngoài phạm vi đã được phê duyệt.
- Route/RBAC/storage compatibility đã được kiểm tra.
- Regression checklist phù hợp đã chạy.
- `git diff --check` sạch.
- Không tự `git add`, commit hoặc push nếu chưa được yêu cầu.

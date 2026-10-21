---
agent: agent
description: Cập nhật memory bank cuối phiên hoặc trước commit
---

# Cập nhật Memory Bank

Đọc lại **toàn bộ** `.github/memory-bank/` (kể cả file tưởng không đổi), rồi:

1. Thu thập sự thật: `git status`, `git diff --stat`, `git log --oneline -10`, kết quả kiểm tra đã chạy trong phiên.
2. `activeContext.md`: ghi ngày hôm nay (YYYY-MM-DD) + nhánh; đang làm gì; **bước tiếp theo** đánh số; vấn đề mở. Xóa thứ đã xong (chuyển sang `progress.md`). Giữ dưới ~60 dòng.
3. `progress.md`: chuyển mục sang "Đã xong" **chỉ khi** đã chạy kiểm tra và qua — ghi commit + tên test. Thêm lỗi/hạn chế mới phát hiện.
4. `decisions.md`: thêm `D-xxx` cho mỗi lựa chọn kiến trúc trong phiên (chỉ ghi thêm).
5. `systemPatterns.md` / `techContext.md`: thêm mẫu, cạm bẫy, lệnh, phụ thuộc mới. Xóa điều đã sai.
6. `projectbrief.md` / `productContext.md`: chỉ đổi khi phạm vi hoặc nguyên tắc sản phẩm đổi.

Quy tắc: ghi *vì sao* và *trạng thái*, không chép code; dùng đường dẫn file; không bịa kết quả test.
Cuối cùng liệt kê ngắn những file memory bank đã sửa và thay đổi chính.

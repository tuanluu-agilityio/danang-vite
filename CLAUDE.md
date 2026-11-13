# CLAUDE.md

Hướng dẫn cho agent của dự án nằm trong `.github/` (dùng chung cho Claude Code, GitHub Copilot và agent khác). File này chỉ nạp chúng vào ngữ cảnh.

@.github/copilot-instructions.md
@.github/memory-bank/activeContext.md

Khi cần thêm:
- Tính năng đã xong / còn thiếu: `.github/memory-bank/progress.md`
- Kiến trúc, mẫu code, cạm bẫy: `.github/memory-bank/systemPatterns.md`
- Quy tắc theo vùng code: `.github/instructions/*.instructions.md` (xem `applyTo` ở đầu mỗi file để biết áp cho thư mục nào) — đọc file tương ứng trước khi sửa vùng đó.
- Quy trình lặp lại: `.github/prompts/*.prompt.md` (người dùng có thể nói "chạy prompt verify", "update memory bank"…).

Đang có việc nhiều phiên "Nâng cấp sông Hàn + nhà hai bờ" (nhánh `feature/ven-song-chan-thuc`): trước khi làm tiếp việc đó, đọc `docs/ai/PROJECT_STATE.md` rồi làm theo mục **Quy trình tiếp tục** trong file (kèm `docs/ai/DECISIONS.md`, `ASSET_MANIFEST.md`, `QA_LOG.md`, `AUDIT.md`). Khi người dùng bảo dừng / tạm nghỉ: cập nhật các file đó trước, chạy `git status`, rồi báo bàn giao.

<!-- entire-agent:begin -->
Read .entire/agent-guide.md for this repository's workflow, source inspection, and verification guidance.
@.entire/agent-guide.md
<!-- entire-agent:end -->

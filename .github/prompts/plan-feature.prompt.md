---
agent: agent
description: Lập kế hoạch triển khai một tính năng từ đặc tả trong prompts/ (chưa viết code)
argument-hint: Đường dẫn đặc tả, vd. prompts/bo-song-han.md
---

# Lập kế hoạch tính năng

Đầu vào: `${input:spec:Đường dẫn đặc tả trong prompts/}`.

1. Đọc đặc tả, `.github/copilot-instructions.md`, `.github/memory-bank/systemPatterns.md`, `activeContext.md`, `decisions.md`.
2. Khảo sát code mà đặc tả nhắc tới; tóm tắt API sẽ dùng (hàm, kiểu, file:dòng).
3. Liệt kê rủi ro với **bất biến** (seed `rand`, draw call, i18n 9 ngôn ngữ, thông số trong config) và cách tránh.
4. Viết kế hoạch theo giai đoạn, mỗi giai đoạn có:
   - file tạo/sửa;
   - cách kiểm tra (lệnh cụ thể, ngưỡng draw call);
   - điểm dừng để commit.
   Giai đoạn đầu luôn là phần ít rủi ro nhất có thể kiểm tra độc lập (config + dọn chỗ + đo draw call).
5. Ghi những gì đặc tả để ngỏ thành câu hỏi cho người dùng; không tự quyết thay.
6. Lưu kế hoạch tóm tắt vào `.github/memory-bank/activeContext.md` (mục "Bước tiếp theo"); quyết định kiến trúc vào `decisions.md`.

Không viết code trong bước này.

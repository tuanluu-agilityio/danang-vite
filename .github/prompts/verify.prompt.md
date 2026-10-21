---
agent: agent
description: Chạy bộ kiểm tra phù hợp với thay đổi hiện tại và báo kết quả thật
---

# Kiểm tra trước khi báo xong

1. `git status` + `git diff --stat` để biết vùng thay đổi.
2. Luôn chạy: `npm run typecheck` rồi `npm run build`.
3. Chọn test theo vùng đổi:

| Đổi ở | Chạy |
|---|---|
| `src/main.ts`, `environment/`, `common/`, `core/`, bất kỳ công trình | `npm run test:drawcalls` (so `tests/KET-QUA.md`) |
| `views/`, `audio/narration.ts`, locales `*Stops`, Tour | `npm run test:tour` |
| `bridges/han-tunnel/`, `ui/hrUI.ts` | `npm run test:tunnel` |
| `scripts/narration/`, `public/voice/`, `gen-narration.mjs` | `npm run test:voice` |
| `environment/riverfront/` | `npm run test:riverfront` + `test:drawcalls` |

   Mỗi test 10–20 phút: chạy nền nếu được, chạy các test độc lập song song khi máy đủ mạnh.
4. Nếu test chụp ảnh (`tests/screens/`): **mở xem ảnh** và soát lỗi hiển thị (z-fighting, chữ lật gương, bloom cháy trắng, vật thể chồng nhau).
5. Báo cáo: bảng lệnh → đạt/không đạt → trích dòng lỗi thật. Draw call: trước/sau ở các góc nhìn có chênh. Test không chạy được thì nói rõ lý do.
6. Ghi kết quả vào `.github/memory-bank/progress.md`.

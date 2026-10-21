---
applyTo: "src/i18n/**,scripts/narration/**,scripts/gen-narration.mjs,public/voice/**"
description: Quy tắc bản dịch giao diện và thuyết minh Tour
---

# i18n và thuyết minh

## Giao diện (`src/i18n/locales/*.json`)
- 9 ngôn ngữ: `vi` (mặc định, nguồn), `en`, `ko`, `ja`, `zh`, `th`, `ar` (RTL, `_dir: "rtl"`), `hi`, `ru`.
- **Khóa mới phải có ở cả 9 file**, cùng kiểu dữ liệu. `t()` rơi về `vi` rồi về chính khóa — đừng dựa vào điều đó để bỏ sót.
- Đặt tên khóa: tiền tố công trình (`hr*`, `sh*`, `rf*`), góc nhìn `v<Tên>` (vd. `vHrCutaway`), Tour `<prefix>Stops`.
- Tour: `<prefix>Stops` là mảng `[tiêu đề, lời]`, **số phần tử và thứ tự trùng** mảng điểm dừng trong `views/tourStops.ts`.
- Tham số trong chuỗi: `{ten}`. Bản dịch tự nhiên, không dịch máy từng chữ; giữ tên riêng Việt (có dấu ở vi/en, phiên âm hợp lý ở ngôn ngữ khác).
- Chèn khóa hàng loạt: viết script một lần theo mẫu `scripts/add-tunnel-locales.mjs`.
- Kiểm tra JSON hợp lệ sau khi sửa (`node -e "JSON.parse(require('fs').readFileSync(f,'utf8'))"`).

## Thuyết minh (`scripts/narration/<lang>.json` → `public/voice/`)
- Khóa và thứ tự giống hệt locales. Viết số, đơn vị, viết tắt **bằng chữ** để TTS không vấp ("sáu trăm mét", không "600 m").
- Công trình chưa xây: phải có câu nói rõ là mô hình phương án đề xuất.
- Sau khi sửa lời: `npm run gen:voice` (chỉ sinh clip đổi), rồi commit `public/voice/` + `manifest.json`.
- TTS lỗi → báo lại, **không tự tạo clip giả** hay sửa tay `manifest.json`.
- Thêm ngôn ngữ: theo prompt `.github/prompts/add-narration-language.prompt.md`.

# Active Context

_Cập nhật: 2026-10-21 · Nhánh chính: `main`_

## Trạng thái
- `main` đã có đủ: Hầm vượt sông Hàn (PR #1), hai bờ sông + tối ưu draw call + thuyết minh tiếng Nga (PR #2), bộ hướng dẫn AI agent + memory bank (PR #3, qua `feature/riverfront`).
- Riverfront đã tích hợp: `buildRiverfront()` gọi sau `new HanTunnel()` trong `main.ts`, `updateRiverfront()` trong `animate()`, có trong `window.__app`; `test:riverfront` đã có.
- `tests/drawcalls.mjs` đã đo thêm các góc nhìn `hr*`/`rf*`, nhưng bảng chuẩn `tests/KET-QUA.md` vẫn là bản 2026-10-20 (chỉ 18 góc nhìn cũ).

## Bước tiếp theo
1. Chạy đủ bộ test trên `main` (`build`, `test:drawcalls`, `test:tour`, `test:tunnel`, `test:riverfront`, `test:voice`), ghi kết quả vào `progress.md` — chưa chạy đủ sau khi merge.
2. Cập nhật `tests/KET-QUA.md` với bảng chuẩn mới gồm cả góc nhìn `hr*`, `rf*`.
3. Sửa dòng giới thiệu Hầm bị lặp ở đầu `README.md`.

## Vấn đề mở / cần quyết
- Tọa độ các địa danh riverfront là ước lượng (chưa có nguồn công khai); số tầng đã xác minh — xem comment đầu `src/environment/riverfront/landmarks.ts`.
- Thuyết minh cho ko, ja, zh, th, ar, hi: chưa lên kế hoạch.
- Đặc tả `prompts/cau-rong.md` (dựng lại Cầu Rồng chi tiết) chưa bắt đầu.

# Active Context

_Cập nhật: 2026-10-21 · Nhánh: `feature/riverfront` (đã push, chưa merge vào `main`)_

## Trạng thái
- `feature/riverfront` đã có đủ: Hầm vượt sông Hàn, hai bờ sông (riverfront), tối ưu draw call cho hầm + riverfront, thuyết minh tiếng Nga. `main` mới chỉ có tới `ca91609` (giao diện tiếng Nga).
- Riverfront đã tích hợp: `buildRiverfront()` gọi sau `new HanTunnel()` trong `main.ts`, `updateRiverfront()` trong `animate()`, có trong `window.__app`; `test:riverfront` đã có.
- `tests/drawcalls.mjs` đã đo thêm các góc nhìn `hr*`/`rf*`, nhưng bảng chuẩn `tests/KET-QUA.md` vẫn là bản 2026-10-20 (chỉ 18 góc nhìn cũ).

## Bước tiếp theo
1. Chạy đủ bộ test trên `feature/riverfront` (`build`, `test:drawcalls`, `test:tour`, `test:tunnel`, `test:riverfront`, `test:voice`), ghi kết quả vào `progress.md`.
2. Cập nhật `tests/KET-QUA.md` với bảng chuẩn mới gồm cả góc nhìn `hr*`, `rf*`.
3. Sửa dòng giới thiệu Hầm bị lặp ở đầu `README.md`.
4. Mở PR `feature/riverfront` → `main`.

## Vấn đề mở / cần quyết
- Tọa độ các địa danh riverfront là ước lượng (chưa có nguồn công khai); số tầng đã xác minh — xem comment đầu `src/environment/riverfront/landmarks.ts`.
- Thuyết minh cho ko, ja, zh, th, ar, hi: chưa lên kế hoạch.
- Đặc tả `prompts/cau-rong.md` (dựng lại Cầu Rồng chi tiết) chưa bắt đầu.

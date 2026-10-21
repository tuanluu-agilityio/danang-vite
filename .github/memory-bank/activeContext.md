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
4. **Thời tiết** (đặc tả `prompts/ke-hoach-thoi-tiet.md`, chưa code, nhánh dự kiến `feature/weather`): 4 preset Nắng hè / Mưa / Gió mùa / Bão + "Hiện trạng" no-op; module `src/environment/weather/`; điều biến sau `applyNight` (D-009). 8 giai đoạn, GĐ1 = config + khung rỗng + đo draw call chênh 0. Người dùng đã trả lời 7 câu hỏi (mục 12b của đặc tả). GĐ1 đã code (xem mục "Thời tiết — Giai đoạn 1"); bước tiếp theo là GĐ2 (khí quyển 4 preset + UI) sau khi GĐ1 qua `test:drawcalls`.

## Thời tiết — Giai đoạn 1 (nhánh `feature/weather`, chưa commit)
- Đã làm: `weatherBase` → `CONFIG.weather` trong `src/config.ts` (preset, Beaufort, giãn nở, hằng số thời gian, seed 20061001, `monthPreset`); `weatherU` trong `src/core/shared.ts`; `src/environment/weather/{state,impact,index}.ts`; `main.ts` gọi `buildWeather()` sau `buildRiverfront()`, `updateWeather()` ngay sau `applyNight()`, `weather` có trong `window.__app` (`weather.impact()`, `setPreset()`, `setIntensity()`). Chưa áp gì lên cảnh. `npm run build` qua.
- Quyết định theo 12b: không có `closeWind`/`swingMaxWind` (cấm lưu thông, khoá quay cầu theo trạng thái `closed` của preset Bão / mốc 60 s kịch bản); ×20 cố định; `?test` luôn là `now`, tự chọn preset theo tháng chỉ khi không có `?test` (chưa code, GĐ2+); ngân sách draw call preset thời tiết ≤ +3.
- Chưa làm / chờ chấm: `test:drawcalls` chênh 0 và kiểm `__app.weather.impact()` (TP mặt cầu ≈ 29 m/s khi v₁₀ = 25) do script ngoài chạy. `tests/weather-check.mjs` + `npm run test:weather` chưa có (bản đặc tả mục 11). GĐ1 không có hiệu ứng hình nên không chụp ảnh.
- Hiệu năng (D-010): đã thêm `CONFIG.weather.perf` (chưa có code đọc) và bổ sung đặc tả mục 4.3 "Chống overdraw", 4.6, bảng mục 9, kiểm tra GĐ3, mục 11 (7b, 7c). Áp dụng khi code GĐ3 (`rain.ts`) và GĐ5 (`lightning.ts`).
- Ghi chú: `impact()` dùng `CONFIG.length` (666) cho Rồng, `totalLength` cho các cầu khác (TP 1.856 m là tổng cả cầu, chỉ để tham khảo giãn nở). Hầm: không chịu gió, không giãn nở.

## Vấn đề mở / cần quyết
- Tọa độ các địa danh riverfront là ước lượng (chưa có nguồn công khai); số tầng đã xác minh — xem comment đầu `src/environment/riverfront/landmarks.ts`.
- Thuyết minh cho ko, ja, zh, th, ar, hi: chưa lên kế hoạch.
- Đặc tả `prompts/cau-rong.md` (dựng lại Cầu Rồng chi tiết) chưa bắt đầu.

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
- Rà lại 2026-10-21: code GĐ1 đã đủ theo mục 10 + 12b (commit `4baacb1`), không phải sửa thêm; `npm run build` qua (tsc + vite). `updateWeather(dt, time)` hiện chưa nhận `camera` (đặc tả mục 5.3 có) — thêm khi GĐ3 cần. Các test không chạy theo yêu cầu; chờ script ngoài chấm. Bước tiếp theo: GĐ2 sau khi GĐ1 qua chấm.
- Hiệu năng (D-010): đã thêm `CONFIG.weather.perf` (chưa có code đọc) và bổ sung đặc tả mục 4.3 "Chống overdraw", 4.6, bảng mục 9, kiểm tra GĐ3, mục 11 (7b, 7c). Áp dụng khi code GĐ3 (`rain.ts`) và GĐ5 (`lightning.ts`).
- Ghi chú: `impact()` dùng `CONFIG.length` (666) cho Rồng, `totalLength` cho các cầu khác (TP 1.856 m là tổng cả cầu, chỉ để tham khảo giãn nở). Hầm: không chịu gió, không giãn nở.

## Thời tiết — Giai đoạn 2 (nhánh `feature/weather`, chưa commit)
- Đã làm: `src/environment/weather/atmosphere.ts` (`buildAtmosphere()` chụp gốc, `applyAtmosphere(state, night, dt)`); `CONFIG.weather.atmosphere` (mọi hệ số mục 4.2); `updateWeather(dt, time, night)` gọi sau `applyNight`; UI `select#weatherSel` + `input#weatherK` trong `.panel.brand` (`src/ui/weatherUI.ts`, CSS `.weather-row`); i18n 7 khoá (`weather, wxNow, wxSummer, wxRain, wxMonsoon, wxStorm, wxIntensity`) bằng `scripts/add-weather-locales.mjs`; `tests/weather-lib.mjs`, `tests/weather-check.mjs` (+ `npm run test:weather`: chỉ phần GĐ2 — `now` không đổi, storm→now khớp tuyệt đối ngày/đêm, preset khác đổi cảnh), `tests/weather-gd2-shots.mjs` (ảnh vào `tests/screens/weather-gd2/`, đã tự xem overview/tpBay/shOverview ngày/đêm; draw call đọc từ HUD bằng nhau giữa các preset).
- Quyết định: trọng số liên tục từ `state.current`, không theo tên preset — `sunny = haze`, `gray = max(rain, (cloud−0,5)·1,4)`, `stormK = min(rain, wind/28)` (thanh cường độ co giãn mượt). Khi cả ba ≈ 0 và `level` ≈ 0 thì `restore()` trả đúng giá trị gốc một lần rồi không đụng gì (nên `now` no-op, storm→now khớp tuyệt đối). Màu thời tiết (ban ngày) nhân `1 − 0,9·night` để ban đêm vẫn tối. Mây xoay khi bão bằng `spin` cộng dồn, về 0 khi restore. Nước dâng = `water.position.y += level` (thuyền chìm nhẹ, chưa xử lý riêng; hầm không kiểm).
- Chưa làm: tự chọn preset theo tháng khi không có `?test` (12b-6, hoãn vì đổi mặc định hiển thị; làm ở GĐ sau); chạy `test:weather`, `test:drawcalls` (script ngoài chấm); xung chớp exposure (GĐ5); mưa/ướt (GĐ3). Water 40 000 m, `water.size` 0,4 khi bão làm mặt nước hơi vỡ hạt ở gần — xem lại nếu muốn.
- Rà lại sau lần chấm LỖI (2026-10-21): log `gd2-l0-build.log` (build qua) và `gd2-l0-test-drawcalls.log` (52/52 góc nhìn khớp chuẩn) đều tốt; nguyên nhân LỖI là `scripts/run-weather.ps1` chỉ khai `test:drawcalls` cho GĐ2 nên `test:weather` không bao giờ chạy, còn người kiểm tra tự chạy thì bị từ chối quyền. Đã sửa: thêm `test:weather` vào `tests` của GĐ2 trong `run-weather.ps1`. Không đổi code ứng dụng, không nới điều kiện nào. `npm run build` qua; `node --check` hai file `tests/weather-*.mjs` qua. `test:weather` chưa được chạy (cấm trong phiên này) — chờ script ngoài chạy và chấm.
- 2026-10-21 (sau đó): đã chạy tay `npm run build` + `npm run test:weather` → `weather-check: đạt` (now no-op, storm→now khớp tuyệt đối ngày/đêm, mưa/bão sương dày, console sạch). Chạy lại GĐ2 bằng `run-weather.ps1 -Resume` để script ngoài chấm với log.
- Bước tiếp theo: GĐ3 (mưa + mặt ướt, `rain.ts`, `wetness.ts`, ngân sách ≤ +3 draw call, chống overdraw D-010) sau khi GĐ2 qua chấm.

## Thời tiết — Giai đoạn 3 (nhánh `feature/weather`, chưa commit)
- Đã làm (lần 0): `rain.ts`, `wetness.ts`, option `weather` trong `bridgePatch` (`shaders.ts`), `registerWet`/`weather: true` cho vật liệu TP/TTL/SH, nối `index.ts`/`main.ts`, `CONFIG.weather` (mưa, perf), `tests/weather-gd3-shots.mjs` (ảnh vào `tests/screens/weather-gd3/`). Lần chấm 0: build qua, `test:drawcalls` 52/52 chênh 0, `test:tunnel` LỖI.
- Lần chấm 0 LỖI vì `test:tunnel`: hai lỗi **có sẵn trong code hầm** (không do mưa/ướt), nên phải sửa trong `HanTunnel.ts` dù nằm ngoài danh sách file của GĐ3, vì "`test:tunnel` qua" là điều kiện của GĐ3:
  1. `riverbed.group.visible` từng phụ thuộc `details.visible` (LOD 600 m), mà camera `hrOverview` cách tâm hầm ≈ 797 m → bật mặt cắt không hiện đáy sông (`hrBed` false ở bước 2 của test). Sửa ở lần 0: bỏ `details.visible &&`. Draw call không đổi (52/52).
  2. `applySim()` cộng dao động sóng `sin(performance.now()·1,3)·0,08` lên `lift` khi `lift > 1`. Đồng hồ thật nên test ngẫu nhiên: ở khung đầu BALLAST `lift` = 8,4 + tối đa 0,08 > ngưỡng 8,4 (log: 8,4395). Sửa (lần 1): dao động chỉ chìm xuống, `(sin − 1)·0,04` ∈ [−0,08; 0] → không bao giờ vượt `FLOAT_LIFT`; FLOAT_IN vẫn > 8. Không nới test.
- Lần 1: `npm run build` qua. Đã xem lại ảnh `shDeck-dem-rain`, `overview-ngay-rain`, `hrGallery-ngay-storm` (có vệt mưa, đường ướt sẫm màu, trong hầm không có mưa). Các test không chạy theo yêu cầu, chờ script ngoài chấm.
- Chưa có bằng chứng: so ảnh `now` trước/sau trùng điểm ảnh; FPS SwiftShader/GPU thật (`wxStreet` chưa có, góc nhìn mới thuộc GĐ6); khung dài nhất ≤ `perf.maxFrameMs`; draw call preset `rain` (≤ +1) chỉ đọc từ HUD trong script ảnh. Ô chọn thời tiết vẫn hiện "Hiện trạng" khi `setWx` đặt preset qua API (helper test, không qua UI).
- Bước tiếp theo: chờ chấm lại GĐ3 (`build`, `test:drawcalls`, `test:tunnel`), commit GĐ3, rồi sang GĐ4 (gió).

## Vấn đề mở / cần quyết
- Tọa độ các địa danh riverfront là ước lượng (chưa có nguồn công khai); số tầng đã xác minh — xem comment đầu `src/environment/riverfront/landmarks.ts`.
- Thuyết minh cho ko, ja, zh, th, ar, hi: chưa lên kế hoạch.
- Đặc tả `prompts/cau-rong.md` (dựng lại Cầu Rồng chi tiết) chưa bắt đầu.

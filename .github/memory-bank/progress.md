# Progress

_Cập nhật: 2026-10-22_

## Đã xong
| Tính năng | Commit | Kiểm tra |
|---|---|---|
| Chuyển 1 file HTML → Vite + TS, giữ nguyên hành vi | `b500bb5` | `test:drawcalls`: 36/36 lần đo chênh 0 so bản gốc (`tests/KET-QUA.md`, 2026-10-20) |
| 4 cầu: Rồng, Thuận Phước, Trần Thị Lý, sông Hàn (quay) | `b500bb5` | `test:drawcalls`, `test:tour` |
| Thuyết minh Tour vi + en (msedge-tts, manifest thời lượng) | `7c60d82` | `test:voice` |
| Giao diện tiếng Nga (locale `ru`) | `ca91609` | — |
| Hầm vượt sông Hàn: trắc dọc, mặt cắt địa chất, mô phỏng dìm, lái xe xuyên hầm, Tour 8 điểm, i18n 9 ngôn ngữ, thuyết minh vi/en | `bdab293` | `test:tunnel`, `test:tour` |
| Hai bờ sông: địa danh, mặt LED trái tim + "DN" (đối đáp/đồng bộ), quảng cáo hư cấu, dải đi bộ, dọn nhà scale 0, i18n 9 ngôn ngữ | `7003788` | `test:riverfront` |
| Giảm draw call riverfront (frustum culling LED, gộp khung bảng, LOD 400 m) | `a22095c` | `test:drawcalls` |
| Giảm draw call hầm (gộp biển/LED/lam, ẩn theo khoảng cách 600 m / xe 450 m / toàn bộ 1.500 m) | `a4802ad` | `test:drawcalls`, `test:tunnel` |
| Test: timeout dài hơn, `test:tour -- --only`, đo thêm góc nhìn hầm/riverfront | `92c8d34` | — |
| Thuyết minh tiếng Nga (`ru-RU-SvetlanaNeural`, 5 Tour / 36 điểm dừng) | `0a0b6be` | `test:voice` |
| Thời tiết GĐ1: khung + config (`feature/weather`) | `4baacb1` | `build` |
| Thời tiết GĐ2: khí quyển 4 preset + UI chọn preset | `3978854` | `test:weather`, `test:drawcalls` |
| Thời tiết GĐ3: mưa + mặt ướt | `5f780b4` | `test:drawcalls`, `test:tunnel` |
| Thời tiết GĐ4: gió (cây, dây, thuyền, mây, sóng) | `e3906e7` | `test:drawcalls`, `test:tour` |
| Thời tiết GĐ5: bão — chớp, đóng cầu, cầu quay, trình diễn | `1b39173` | `test:drawcalls`, `test:weather` |
| Thời tiết GĐ6: bảng "Ảnh hưởng tới cầu", góc nhìn `wx*`, i18n | `c169343` | `test:drawcalls`, `test:weather` |
| Thời tiết GĐ7: kịch bản bão 120 s, nắng hè, cây đổ, âm thanh | `edced8b` | `test:drawcalls`, `test:weather`, `test:tour` |
| Thời tiết GĐ8: hoàn tất — `KET-QUA.md`, README, memory bank (chưa commit) | — | `build`, toàn bộ bộ test (log `gd8-l0-*`) |

Tất cả đã vào `main` (PR #1 hầm, PR #2 riverfront, PR #3 hướng dẫn AI agent). Nhánh `feature/weather` (GĐ1–GĐ7 đã commit) chưa merge vào `main`.

## Còn thiếu
- Merge `feature/weather` vào `main` (chưa làm, chờ người dùng quyết định).
- Tự chọn preset theo tháng khi không có `?test` (12b-6, đã đồng ý nhưng chưa code; đổi mặc định hiển thị nên cần chạy lại bộ test).
- Thời tiết: số draw call từng preset (`rain`, `storm`, …) chưa ghi vào `KET-QUA.md`; log GD8 chỉ ghi `now`. Cột "bản gốc" của `test:drawcalls` chưa đo lại trong bản này.
- Thời tiết: sóng bạc đầu cửa sông, bơm hầm, tàu cao `ship` của Cầu sông Hàn, ảo ảnh mặt cầu chưa có.
- Thuyết minh cho ko, ja, zh, th, ar, hi.
- Dựng lại Cầu Rồng chi tiết theo `prompts/cau-rong.md`.
- Bật `strict` TypeScript dần theo thư mục (giai đoạn 2).

## Lỗi / hạn chế đã biết
- README có dòng giới thiệu Hầm bị lặp hai lần (đầu file).
- `msedge-tts` là dịch vụ không chính thức: có thể lỗi khi sinh clip; clip đã sinh vẫn dùng được.

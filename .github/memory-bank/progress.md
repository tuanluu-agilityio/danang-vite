# Progress

_Cập nhật: 2026-10-21_

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

Tất cả các commit từ `bdab293` trở đi mới nằm trên `feature/riverfront`, chưa vào `main`.

## Còn thiếu
- Bảng chuẩn draw call mới trong `tests/KET-QUA.md` (gồm `hr*`, `rf*`).
- Thuyết minh cho ko, ja, zh, th, ar, hi.
- Dựng lại Cầu Rồng chi tiết theo `prompts/cau-rong.md`.
- Bật `strict` TypeScript dần theo thư mục (giai đoạn 2).

## Lỗi / hạn chế đã biết
- README có dòng giới thiệu Hầm bị lặp hai lần (đầu file).
- `msedge-tts` là dịch vụ không chính thức: có thể lỗi khi sinh clip; clip đã sinh vẫn dùng được.

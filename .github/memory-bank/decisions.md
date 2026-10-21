# Decisions (ADR rút gọn)

Chỉ ghi thêm ở cuối. Mẫu:

```
## D-xxx: <tiêu đề> — YYYY-MM-DD — Trạng thái: Chấp nhận | Thay bởi D-yyy
Bối cảnh: …  Quyết định: …  Hệ quả: …
```

---

## D-001: Không dùng framework UI — 2026-10-20 — Chấp nhận
Bối cảnh: bản gốc là một file HTML + three. Quyết định: Vite + TS thuần, DOM tay trong `index.html` + `src/ui/`. Hệ quả: bundle nhỏ; UI mới viết theo mẫu `panel.ts` (`toggle`, `selectBridge`).

## D-002: Giữ thứ tự dựng để bảo toàn chuỗi `rand()` có seed — 2026-10-20 — Chấp nhận
Bối cảnh: vị trí nhà/cây/xe sinh từ `rand = rng(20130329)` dùng chung. Quyết định: `main.ts` giữ đúng thứ tự bản gốc; công trình mới dựng sau cùng và dọn chỗ bằng scale-0 instance; phần ngẫu nhiên mới dùng `rng(seed)` riêng. Hệ quả: so được draw call với bản gốc; mọi tính năng mới phải theo mẫu `corridor.ts`.

## D-003: Draw call của bản gốc là chuẩn hồi quy — 2026-10-20 — Chấp nhận
Quyết định: `tests/original/index.html` (bản gốc sửa tối thiểu) + `test:drawcalls` là thước đo. Hệ quả: tối ưu hay tính năng mới đều phải báo chênh lệch draw call.

## D-004: `strict: false` ở giai đoạn 1 — 2026-10-20 — Chấp nhận
Bối cảnh: chuyển code cũ nguyên trạng. Quyết định: tắt strict, bật dần theo thư mục ở giai đoạn sau.

## D-005: Thuyết minh bằng clip mp3 sinh sẵn (msedge-tts) — Chấp nhận
Bối cảnh: cần giọng đọc tự nhiên, không backend. Quyết định: sinh clip offline, commit vào `public/voice/`, `manifest.json` lưu thời lượng + hash. Hệ quả: ngôn ngữ chưa có clip → Tour chạy lặng, nút Thuyết minh khóa.

## D-006: Mỗi công trình một thư mục + lớp kế thừa `BridgeBase` — Chấp nhận
Quyết định: thông số ở một khối trong `config.ts`, code ở `src/bridges/<ten>/`. Cầu Rồng giữ dạng hàm rời (có trước `BridgeBase`). Hệ quả: thêm công trình theo prompt `.github/prompts/new-structure.prompt.md`.

## D-007: Hầm dựng theo phương án đề xuất 2025 — Chấp nhận
Quyết định: bám số công bố (1.670 m = 600 + 380 + 415, 6 làn, 60 km/h); mặt cắt, độ sâu, cửa hầm là ước lượng. Các phương án 2016/2017 chỉ nhắc trong thuyết minh.

## D-008: Không dùng thương hiệu thật trên quảng cáo/tòa nhà — 2026-10-21 — Chấp nhận
Quyết định: thương hiệu hư cấu + thông điệp du lịch; tòa thật (Novotel, Vinpearl) dựng khối nhưng không logo.

## D-009: Thời tiết là lớp điều biến sau ngày/đêm, chạy bằng shader — 2026-10-21 — Đề xuất (chờ duyệt đặc tả `prompts/ke-hoach-thoi-tiet.md`)
Bối cảnh: `applyNight()` ghi đè mỗi khung hình sương, đèn, phơi sáng, màu nước; cần thêm mưa/gió/bão mà không lệch draw call hay chuỗi `rand()`. Quyết định: `updateWeather()` gọi ngay sau `applyNight()` và chỉ nhân/lerp các giá trị đó; giá trị applyNight không đặt lại thì chụp gốc lúc build và trả đúng khi preset "Hiện trạng" (no-op). Mưa, lắc cây, rung cáp làm trong vertex shader (uniform `weatherU` riêng, không gộp vào `shared` vì `MAT.ledRail` dùng nguyên object đó); ngẫu nhiên dùng `rng(seed)` riêng; không thêm đèn động hay pass hậu kỳ. Hệ quả: preset mặc định chênh 0 draw call; preset thời tiết ≤ +2 (mưa, tia chớp); `bridgePatch` có thêm option `weather`/`sway` mặc định tắt.

## D-010: Hiệu năng thời tiết đo bằng fill rate và khựng, không chỉ draw call — 2026-10-21 — Chấp nhận
Bối cảnh: mưa chỉ +1 draw call nhưng 6.000 vệt trong suốt sát camera ở pixelRatio 2 tô lại màn hình nhiều lần; đổi preset có thể buộc three.js biên dịch lại program (khựng). Quyết định: mưa bỏ vệt gần `rainNear`, mờ theo xa, giới hạn pixelRatio khi mưa, tự hạ `mesh.count` theo FPS (tắt khi `?test`); mọi hiệu ứng điều khiển bằng uniform, không đổi `defines`/`transparent`/số đèn theo preset; `buildWeather()` biên dịch trước bằng `compileAsync`. Thông số ở `CONFIG.weather.perf`. Hệ quả: `test:weather` kiểm thêm khung dài nhất ≤ `maxFrameMs` và `renderer.info.programs` không tăng khi đổi preset; GĐ3 đo FPS trên GPU thật, không chỉ SwiftShader.

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

# Bán đảo Sơn Trà núi rừng tự nhiên (D-047) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Thay các hình nón của Sơn Trà (và Hải Vân) bằng một lưới địa hình liền mạch phủ rừng, nhìn thuyết phục từ bốn cầu, không tăng lệnh vẽ.

**Architecture:** Hàm độ cao thuần `stHeight` / `hvHeight` trong `src/environment/terrain.ts` (sống núi + nhiễu tất định). `mountains.ts` lấy mẫu thành một `BufferGeometry` có pháp tuyến mượt, màu đỉnh nướng, thuộc tính `aRock`. `MAT.mountain` vá shader thêm vân tán rừng từ một texture canvas lát được. Ba task nối tiếp nhau (hình → lưới → vật liệu + chỉnh theo ảnh) nên làm trong một phiên, không chia agent song song.

**Tech Stack:** TypeScript, three@0.165, `tsx --test`, Playwright (GPU thật) để chụp ảnh.

**Spec:** `docs/superpowers/specs/2026-11-15-son-tra-nui-rung-design.md`

## Global Constraints

- Không gọi `rand()`; không đổi thứ tự `build*()` trong `src/main.ts`.
- Vẫn đúng một `Mesh` núi, một lệnh vẽ; ≤ 140 000 tam giác.
- Núi ≤ 2,5 m trong vùng x < 1480, z > −3700; mặt đất tại (2600, −4700) ≤ 698 m.
- Thông số ở `CONFIG.sonTra`, chú thích tiếng Việt + đơn vị + `(ước lượng)`.
- Không thư viện, không tệp tài nguyên, không khóa i18n mới. Comment tiếng Việt.

## Review Focus

- Ban đêm / hoàng hôn: núi không được sáng rực hay đen kịt khác thường so với trước (xem ảnh `*-night`).
- Lượt phản chiếu mặt nước: shader vá phải chạy được trong lượt gương (ảnh `thuanphuoc`, `bay` có bóng núi trên nước, console sạch).
- Dù lượn cất cánh ở (2600, 702, −4700): camera không nằm trong núi (kiểm đơn vị độ cao + ảnh `glider`).
- Mép đất bờ Đông Thuận Phước: không khe nước hẹp hay bậc xanh giữa đất và chân núi (ảnh `thuanphuoc`).
- Nhìn gần (dù lượn sát sườn): vân tán không lặp ô rõ, không răng cưa lấp lánh.

---

### Task 1: Hàm độ cao

**Files:** Create `src/environment/terrain.ts`, `tests/terrain-unit/terrain.test.ts`; Modify `src/config.ts` (khối `sonTra`), `package.json` (`"test:terrain:unit": "tsx --test tests/terrain-unit/*.test.ts"`).

**Interfaces — Produces:**
- `stHeight(x: number, z: number): number` — m, Sơn Trà, đã áp vùng cấm; âm = dưới nước.
- `hvHeight(x: number, z: number): number` — m, Hải Vân.
- `ST_BOX`, `HV_BOX: { x0, x1, z0, z1 }` — khung lấy mẫu.
- `stNoise(x: number, z: number): number` — nhiễu giá trị 0..1 (dùng lại cho màu).

- [x] Viết test: tất định (gọi hai lần bằng nhau); `max` trong bán kính 400 m quanh (2600, −4700) thuộc 660..698 và `stHeight(2600, −4700) ≤ 698`; mọi mẫu bước 40 m trong x 262..1480, z −3700..−2300 có `stHeight ≤ 2.5`; trên lưới 26 m toàn `ST_BOX` chênh cao giữa hai mẫu kề ≤ 1,9 × 26 m; đường chân trời từ (40, 13, −17) quét 160 tia phương vị về phía núi có ≥ 3 cực đại cục bộ cách nhau ≥ 4 tia; mọi giá trị hữu hạn.
- [x] Chạy `npm run test:terrain:unit`, thấy trượt vì chưa có module.
- [x] Viết `terrain.ts` theo spec §4.1.
- [x] Chạy lại tới khi đạt; `npm run typecheck`; commit.

### Task 2: Lưới núi

**Files:** Modify `src/environment/mountains.ts`; Test: thêm vào `tests/terrain-unit/terrain.test.ts`.

**Interfaces — Consumes:** Task 1. **Produces:** `mtGeometry(): THREE.BufferGeometry` (position, normal, color, `aRock`; có index) — `buildMountains()` dùng nó với `MAT.mountain`.

- [x] Test: `mtGeometry()` có đủ 4 thuộc tính, không NaN, số tam giác ≤ 140 000 và ≥ 30 000, pháp tuyến dài ≈ 1 và `normal.y > 0` mọi đỉnh, không đỉnh nào trong vùng cấm cao hơn 2,5 m.
- [x] Viết lưới theo spec §4.2 (tách phần dựng hình khỏi `scene.add` để test node không cần renderer: `mtGeometry` nằm trong `terrain.ts`-cùng-thư-mục file mới `mountainGeo.ts` nếu `mountains.ts` kéo theo `core/renderer`).
- [x] Test đạt, `typecheck`, commit.

### Task 3: Vật liệu rừng + chỉnh theo ảnh

**Files:** Modify `src/core/materials.ts` (`MAT.mountain`), `src/core/textures.ts` hoặc file mới `src/environment/mountainMat.ts` (texture tán + vá shader); `tests/sontra-shots.mjs` (đã có).

- [x] Vật liệu theo spec §4.3.
- [x] `npm run build && node tests/sontra-shots.mjs --label=after`; xem ảnh bốn cầu + vịnh + sát sườn + đêm; chỉnh điểm sống / nhiễu / màu rồi lặp lại tới khi không còn dấu hình học và các mục Review Focus ổn.
- [x] So lệnh vẽ `stats.json` trước / sau (phải bằng nhau từng góc); `test:terrain:unit`, `typecheck`, `build`; commit.

### Task 4: Kiểm cuối + tài liệu

- [x] Review toàn nhánh bằng một agent mới (đọc diff), sửa điều đáng sửa.
- [x] Ghi D-047 vào `.github/memory-bank/decisions.md`, cập nhật `activeContext.md`, `progress.md`, `copilot-instructions.md` §5 (lệnh mới), trạng thái spec; commit.

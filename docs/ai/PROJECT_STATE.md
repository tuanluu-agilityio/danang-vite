# PROJECT_STATE — Nâng cấp độ chân thực sông Hàn + nhà hai bờ

> File này là điểm vào của việc "Da Nang Riverside Realism Upgrade". Phiên mới: đọc file này trước, rồi làm theo mục **Quy trình tiếp tục** ở cuối. Chỉ ghi điều có thật; việc chưa kiểm thì ghi là chưa kiểm.

| | |
|---|---|
| **Dự án** | Da Nang Riverside Realism Upgrade (D-036 nước, D-037 nhà) |
| **Nhánh** | `feature/ven-song-chan-thuc` (từ `main` `752ea22`); commit M1 `eae444c`; **chỉ có trên máy, chưa push** (không có upstream) |
| **Mốc hiện tại** | M3 Task 3.0–3.3 và M4 Task 4.0 (tối ưu GPU) và M3 3.6 xong; còn M3 3.4, 3.5, rồi M4 4.1–4.4 |
| **Trạng thái** | M1 **đã được người dùng duyệt** (2026-11-13, "Đồng ý"); M2 người dùng cho đi tiếp (2026-11-13: "Đồng ý hạ chiều cao, làm tiếp M3"); M3 phần nhà đã làm, **chờ người dùng xem** (`tests/screens/ven-song/nha2/`, `toi-uu/`); GPU +3 đến +10 % so với `main` ở bốn góc, du-luon mưa +10 đến +12 % |
| **Cập nhật** | 2026-11-13 15:45 +07 (sau M4 task 4.0) |

## Việc vừa xong (đã kiểm)
Shader mặt nước mới (`src/core/waterShader.ts`) nối vào `Water.js`, ngày / đêm / mưa / bão; ảnh trước / sau 6 điều kiện × 8 góc; đo A/B GPU thật. Chi tiết ở `QA_LOG.md` mục 2026-11-13.

## Việc đang làm
Không có việc dở. Người dùng đã trả lời (2026-11-13): (1) nước: "Đồng ý"; (2) sắc hoàng hôn: "Nên note lại sẽ làm sau" → nằm trong việc tồn M3 (task 3.5), không làm ở M2.

## Đã hoàn thành
- [x] Kiểm kê hiện trạng (`AUDIT.md`), số đo gốc và ảnh "trước" (`tests/screens/ven-song/truoc/`, không commit; dựng lại được bằng lệnh ở `QA_LOG.md`).
- [x] Công cụ chụp / đo dùng lại được: `tests/ven-song-shots.mjs` (GPU thật, 8 góc cố định, 6 điều kiện, `--dist=` để đo A/B).
- [x] M1: shader nước nhiều lớp sóng, Fresnel, màu theo độ sâu, nắng lấp lánh, gợn mưa, sóng bạc đầu, bọt mép kè; gương 1024 × 512; thông số ở `CONFIG.water`.
- [x] M2 Task 2.1–2.3 (2026-11-13): kit phụ kiện nhà 5 họ dựng bằng Blender (`blender/scripts/`, `blender/scenes/riverside_buildings.blend`), `public/buildings/kit.glb` 276 644 byte, `npm run gen:buildings`, `npm run test:buildings:unit` 24/24. Thiết kế: spec §6 (D-037 bản 2).
- [x] M2 Task 2.4–2.6 (2026-11-13): `src/environment/buildings/` (`kitData.ts`, `families.ts`, `kit.ts`), `aFam` + mặt đứng theo họ trong `patchWindows`, `CONFIG.buildings`, vùng mẫu 122 nhà bờ Tây; đường lùi `?buildings=off`; ảnh `tests/screens/ven-song/nha1/`; số đo ở `QA_LOG.md`.
- [x] M3 Task 3.0–3.3 (2026-11-13): `bkReshape()` hạ chiều cao 628 nhà dải sát sông hai bờ, kit hai bờ bằng `aFlip` (596 nhà), LOD kit 600 / 1 400 m, bảng màu tường / kính / mái theo họ, cửa hàng sáng đêm; ảnh `tests/screens/ven-song/nha2/`; A/B chuẩn so với `main` ở `QA_LOG.md` (**+10 đến +26 % GPU, không đạt**).
- [x] M4 Task 4.0 (2026-11-13, người dùng: "Đồng ý, làm tối ưu GPU trước"): `bkCull()` cắt kit theo khung nhìn + tầm `kitFar` mỗi khung, rút mẫu texture shader nước, `?mirror=WxH` để đo; A/B ở `QA_LOG.md`; quyết định ở `DECISIONS.md` mục "Tối ưu GPU sau M3".
- [x] Spec + plan (`docs/superpowers/specs|plans/2026-11-13-ven-song-chan-thuc*`).

## Còn lại (theo thứ tự ưu tiên)
1. **M1 — đã duyệt**. Việc nhỏ còn mở, dời sang M3 task 3.5 / M4 (plan task 1.6): sóng bạc đầu khi bão còn mảng cứng ở gần camera; chưa có sắc ấm lúc hoàng hôn (hệ ngày / đêm hiện không có trạng thái hoàng hôn, xem `DECISIONS.md` D-036 mục Hệ quả); vệt sóng sau tàu chưa làm.
2. **M2 — nguyên mẫu nhà**: dựng thư viện nhà 5 họ trong Blender (`blender/scripts/`), xuất GLB, thay một cụm nhà ven sông bờ Tây quanh Cầu Rồng; chụp trước / sau. Cách làm đề xuất ở `DECISIONS.md` D-037 (chưa kiểm chứng).
3. **M3 — mở rộng**: thay nhà cả hai bờ, LOD ba mức, chi tiết bờ kè, vệt sóng tàu, hoàng hôn.
4. **M4 — tối ưu và QA**: chạy đủ bộ test nặng một lần (`copilot-instructions.md` §5), `test:citynight -- --baseline`, ghi `tests/KET-QUA.md`.

## Trạng thái lúc lưu (2026-11-13 14:05 +07)
- `git status`: chỉ còn ` M src/config.ts` = thay đổi `strollBase.walk` 3,5 → 1,6 của người dùng (cố ý không commit). Mọi thứ khác của M1 nằm trong `eae444c` và commit điểm lưu này.
- Không còn tiến trình test nào chạy. Worktree tạm dùng đo A/B đã xóa (`git worktree list` chỉ còn các worktree có từ trước).
- Sự cố trong phiên: khi xóa worktree tạm, `git worktree remove --force` đi xuyên junction và xóa `.bin`, `.package-lock.json`, `.vite` trong `node_modules` của repo; `npm ci` sau đó hỏng giữa chừng (EPERM, dev server của người dùng đang giữ file) và xóa thêm; đã cài bù bằng `npm install`. Kiểm sau khi cài: `npm ls --depth=0` đủ 7 gói, `npm run build` đạt, `package-lock.json` không đổi. Nếu lệnh npm nào lỗi lạ ở phiên sau: tắt dev server rồi `npm ci`. Lần sau đo A/B: gỡ junction bằng `cmd /c rmdir` trước khi xóa worktree.
- Ảnh và số đo ở `tests/screens/ven-song/` (`truoc`, `sau`, `sau1`–`sau3` là các vòng chỉnh, `ab-*`) còn trên đĩa, không commit; mất thì dựng lại theo `ASSET_MANIFEST.md`.

## Vướng mắc
Không có.

## Kiểm chứng gần nhất (2026-11-13)
- `npm run build` (gồm `tsc --noEmit`): đạt.
- `tests/ven-song-shots.mjs`: 0 lỗi console ở cả 48 ảnh; program 176 → 176; lệnh vẽ không đổi ở mọi góc.
- A/B GPU thật (Intel Arc, 1600 × 900, 2 vòng xen kẽ): +0,7 đến +1,0 ms mỗi khung (+6 đến +9 %). Bảng ở `QA_LOG.md`.
- `npm run test:weather`: "weather-check: đạt", exit 0.
- **Chưa chạy**: `test:citynight` (vệt đèn đêm đã chép nguyên vào shader mới, mới xem bằng ảnh), `test:tunnel` (mặt cắt hầm chèn mã vào shader nước: trang nạp không lỗi, chưa bật mặt cắt để xem), `test:drawcalls`, `test:perf -- --strict`, `test:mobile` và các test nặng khác; chưa xem trên điện thoại thật.

## Việc kế tiếp (một việc)
**M3 task 3.4 chi tiết kè và dải ven sông** (3.6 tài liệu đã xong). Task 3.5 (vệt sóng tàu, sóng bạc đầu mịn hơn, sắc hoàng hôn): người dùng bảo hoàng hôn làm sau; hai việc kia làm nếu còn ngân sách GPU (du-luon mưa đang +10 đến +12 %). Sau đó M4 4.1: đủ bộ test nặng một lượt (lệch có chủ ý: `test:citynight -- --baseline`, `test:drawcalls` +5, ảnh của `test:riverfront` / `test:tunnel` / `test:sunwheel`). Song song chờ người dùng xem nhà M3. Việc kỹ thuật còn nợ: `disposeBuildingKit()` chưa từng chạy; mặt cắt hầm khi có kit chưa xem; điện thoại / bậc chất lượng Thấp chưa kiểm; mat-pho đêm +6 lệnh vẽ (nguồn của +1 chưa rõ).

## File quan trọng
| File | Vai trò |
|---|---|
| `src/core/waterShader.ts` | fragment shader nước (D-036) |
| `src/core/water.ts` | dựng `Water`, texture pháp tuyến, `waterFx` (uRain, uStorm), bậc chất lượng phản chiếu |
| `src/config.ts` khối `waterBase` | mọi thông số nước |
| `src/environment/weather/atmosphere.ts` | ghi `distortionScale`, `size`, `waterColor`, `waterFx` theo thời tiết |
| `src/core/dayNight.ts` | `waterColor`, `sunColor` theo ngày / đêm |
| `src/bridges/han-tunnel/cutaway.ts` | chèn `discard` vào shader nước (cần chuỗi `void main() {` và varying `worldPosition`) |
| `src/environment/city.ts` | ~7 900 nhà hộp `InstancedMesh`, vị trí từ `rand()` (KHÔNG đổi chuỗi) |
| `src/environment/riverfront/` | địa danh, biển quảng cáo, dọn nhà; đọc instance nhà của `city.ts` |
| `tests/ven-song-shots.mjs` | ảnh + số đo trước / sau |
| `docs/ai/*.md` | bộ nhớ của việc này |

## Quy trình tiếp tục
1. `git status`, `git log --oneline -5`, `git branch --show-current` (phải là `feature/ven-song-chan-thuc`). Thay đổi `strollBase.walk` trong `src/config.ts` là của người dùng: giữ, không commit, không hoàn nguyên.
2. Đọc file này, `DECISIONS.md`, `ASSET_MANIFEST.md`, `QA_LOG.md`; rồi plan `docs/superpowers/plans/2026-11-13-ven-song-chan-thuc.md`.
3. Đối chiếu với repo thật (file trong bảng trên, `blender/`, `public/buildings/`). Repo khác tài liệu thì repo đúng, sửa tài liệu.
4. `npm run build` làm kiểm tra khói.
5. Làm "Việc kế tiếp". Sau mỗi task: cập nhật file này + `QA_LOG.md` / `ASSET_MANIFEST.md` / `DECISIONS.md` rồi commit.

# ASSET_MANIFEST — Nâng cấp sông Hàn + nhà hai bờ

Mỗi tài nguyên sinh ra hoặc sửa: ghi một dòng. Tài nguyên đã đạt kiểm tra thì không dựng lại.

## Tài nguyên Blender / GLB
Chưa có. Blender 4.5.10 LTS có sẵn ở `C:/Program Files/Blender Foundation/Blender 4.5/blender.exe` (đã chạy `--version`, 2026-11-13); các script hiện có gọi qua `scripts/people/blender.mjs` (biến môi trường `BLENDER`).

| Tên | Loại | Nguồn `.blend` / script | GLB | Texture | Tam giác | Vật liệu | LOD | Trạng thái | Góc kiểm | Sửa lần cuối |
|---|---|---|---|---|---|---|---|---|---|---|
| (M2 sẽ thêm) | | | | | | | | | | |

## Tài nguyên sinh bằng code (không có file)
| Tên | Loại | Nguồn | Kích thước | Trạng thái | Sửa lần cuối |
|---|---|---|---|---|---|
| Texture pháp tuyến sóng | `DataTexture` RGBA, lặp liền mạch, có mipmap | `makeWaterNormals()` trong `src/core/water.ts`, `rng(77)` | 512² (`CONFIG.water.normalSize`; trước là 256², không mipmap) | Đang dùng (M1) | 2026-11-13 |
| Ảnh phản chiếu mặt nước | `WebGLRenderTarget` | `Water` trong `src/core/water.ts` | 1024 × 512 (`CONFIG.water.mirror`; trước là 512²) | Đang dùng (M1) | 2026-11-13 |
| Shader mặt nước | GLSL fragment | `src/core/waterShader.ts` | — | Đang dùng (M1), chờ duyệt | 2026-11-13 |

## Ảnh và số đo (không commit, `tests/screens/` nằm trong `.gitignore`)
| Thư mục | Nội dung | Dựng lại |
|---|---|---|
| `tests/screens/ven-song/truoc/` | 48 ảnh + `metrics.json` của `main` `752ea22` | build `main` ở một worktree, rồi `node tests/ven-song-shots.mjs --label=truoc --dist=<worktree>/dist` |
| `tests/screens/ven-song/sau/` | 48 ảnh + `metrics.json` (chỉ của lượt bão cuối) sau M1 | `npm run build && node tests/ven-song-shots.mjs --label=sau` |
| `tests/screens/ven-song/ab-A1,A2,B1,B2/` | `metrics.json` của phép đo A/B | xem `QA_LOG.md` |

# Plan — Nâng cấp sông Hàn và nhà hai bờ

Spec: [2026-11-13-ven-song-chan-thuc-design.md](../specs/2026-11-13-ven-song-chan-thuc-design.md) · Trạng thái sống: [docs/ai/PROJECT_STATE.md](../../ai/PROJECT_STATE.md) · Nhánh `feature/ven-song-chan-thuc`.
Sau mỗi task: cập nhật `docs/ai/PROJECT_STATE.md` (+ `QA_LOG.md`, `ASSET_MANIFEST.md`, `DECISIONS.md` khi liên quan) rồi commit. Test nặng (SwiftShader) chỉ chạy một lần ở M4.

## M0 — Kiểm kê (xong 2026-11-13)
- [x] 0.1 Đọc mã nước, bờ, nhà, thời tiết, ngày / đêm → `docs/ai/AUDIT.md`.
- [x] 0.2 `tests/ven-song-shots.mjs`; ảnh và số đo gốc của `main` `752ea22`.
- [x] 0.3 Bộ nhớ `docs/ai/`, spec, plan.

## M1 — Nguyên mẫu nước (xong, người dùng duyệt 2026-11-13)
- [x] 1.1 `CONFIG.water`; `src/core/waterShader.ts`; nối vào `water.ts`.
- [x] 1.2 `waterFx` (mưa, bão) từ `weather/atmosphere.ts`.
- [x] 1.3 Ảnh sau, chỉnh ba vòng theo ảnh; A/B GPU.
- [x] 1.4 `npm run build`, `npm run test:weather`.
- [x] 1.5 Người dùng duyệt bằng mắt: "Đồng ý" (2026-11-13), không yêu cầu chỉnh.
- [ ] 1.6 (dời sang M4, chạy cùng bộ test nặng) `test:citynight` (vệt đèn), `test:tunnel` (mặt cắt chèn vào shader nước), xem bậc chất lượng Thấp (`reflectEvery: 0`) và điện thoại.

Nghiệm thu: spec §7 dòng M1.

## M2 — Nguyên mẫu nhà
- [x] 2.1 (xong 2026-11-13, theo spec §6 bản 2: kit phụ kiện, không phải đế / thân / mái) `blender/scripts/build_building_library.py`: 5 họ; chạy qua `scripts/people/blender.mjs`; lưu `blender/scenes/riverside_buildings.blend`. Kiểm: mở lại file, đếm tam giác ≤ trần.
- [x] 2.2 `blender/scripts/export_assets.py` → `public/buildings/kit.glb`; lệnh `npm run gen:buildings`; ghi `ASSET_MANIFEST.md`.
- [x] 2.3 (24/24) Test đơn vị `tests/buildings-unit/` (trần dung lượng, tam giác, đủ 5 họ, có ba đoạn) + `npm run test:buildings:unit`.
- [x] 2.4 `src/environment/buildings/`: nạp GLB, mỗi họ một `InstancedMesh` kit chồng lên thân hộp (spec §6.3), shader áp `_OFF` / `_RULE` / `_GLOW`, `aFam` cho thân; `CONFIG.buildings`; đường lùi về hộp.
- [x] 2.5 Thay một cụm bờ Tây quanh Cầu Rồng (không đổi `items`, không thêm `rand()`); chọn họ bằng băm chỉ số.
- [x] 2.6 (A/B GPU chuẩn so với `main` còn nợ, mới có A/B với `?buildings=off`) Ảnh trước / sau (`nha-tay`, `nha-dong`, `mat-pho`, `tren-cao`; ngày + đêm), A/B GPU, lệnh vẽ; `test:stroll:unit`, `test:drive:unit`.
- [x] 2.7 Người dùng cho đi tiếp và đồng ý hạ chiều cao (2026-11-13) → D-038.

## M3 — Mở rộng
- [x] 3.0 `bkReshape()`: hạ chiều cao nhà dải sát sông (D-038).
- [x] 3.1 Cả hai bờ (xoay 180° bằng `aFlip`); phân bố họ theo khoảng cách tới sông.
- [x] 3.2 LOD kit trong shader đỉnh (600 m bỏ chi tiết tầng, 1 400 m bỏ cả kit); kit không vào bóng / gương nên không cần `passLod`.
- [x] 3.3 Cửa sổ đêm theo họ (dựa trên `patchWindows`).
- [ ] 3.4 Chi tiết kè và dải ven sông còn thiếu.
- [ ] 3.5 Nước: vệt sóng sau tàu (đọc vị trí đội tàu, không sửa hệ tàu), sóng bạc đầu mịn hơn, sắc hoàng hôn (người dùng: "note lại sẽ làm sau", 2026-11-13; đụng `dayNight.ts`, hệ ngày / đêm chung).
- [ ] 3.6 README mục Cấu trúc + ghi nguồn tài nguyên; `copilot-instructions.md` §5 thêm lệnh mới.

## M4 — Tối ưu và QA
- [x] 4.0 **Tối ưu GPU** (xong 2026-11-13): từ +10 đến +26 % xuống +3 đến +10 % ở bốn góc, riêng du-luon mưa còn +10 đến +12 % (`QA_LOG.md`). `bkCull()` cắt kit theo khung nhìn + tầm xa, rút mẫu texture shader nước.
- [ ] 4.1 Đủ bộ test của `copilot-instructions.md` §5, một lượt; `test:citynight -- --baseline` trước khi so.
- [ ] 4.2 `tests/KET-QUA.md`: bảng lệnh vẽ, GPU A/B, dung lượng.
- [ ] 4.3 Ngày, hoàng hôn, đêm, mưa, bão × trên cao, mặt cầu, dù lượn, mặt phố; điện thoại.
- [ ] 4.4 Báo cáo QA cuối ở `docs/ai/QA_LOG.md`; cập nhật memory bank; PR.

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
- [ ] 2.1 `blender/scripts/build_building_library.py`: 5 họ, mỗi họ đế / thân / mái; chạy qua `scripts/people/blender.mjs`; lưu `blender/scenes/riverside_buildings.blend`. Kiểm: mở lại file, đếm tam giác ≤ trần.
- [ ] 2.2 `blender/scripts/export_assets.py` → `public/buildings/library.glb`; lệnh `npm run gen:buildings`; ghi `ASSET_MANIFEST.md`.
- [ ] 2.3 Test đơn vị `tests/buildings-unit/` (trần dung lượng, tam giác, đủ 5 họ, có ba đoạn) + `npm run test:buildings:unit`.
- [ ] 2.4 `src/environment/buildings/`: nạp GLB, gộp họ bằng `aPart`, shader đỉnh co giãn phần thân; `CONFIG.buildings`; đường lùi về hộp.
- [ ] 2.5 Thay một cụm bờ Tây quanh Cầu Rồng (không đổi `items`, không thêm `rand()`); chọn họ bằng băm chỉ số.
- [ ] 2.6 Ảnh trước / sau (`nha-tay`, `nha-dong`, `mat-pho`, `tren-cao`; ngày + đêm), A/B GPU, lệnh vẽ; `test:stroll:unit`, `test:drive:unit`.
- [ ] 2.7 Chốt hoặc sửa D-037; **người dùng duyệt bằng mắt.**

## M3 — Mở rộng
- [ ] 3.1 Cả hai bờ; phân bố họ theo khoảng cách tới sông.
- [ ] 3.2 LOD ba mức; bản thưa cho lượt bóng / gương (`core/passLod.ts`).
- [ ] 3.3 Cửa sổ đêm theo họ (dựa trên `patchWindows`).
- [ ] 3.4 Chi tiết kè và dải ven sông còn thiếu.
- [ ] 3.5 Nước: vệt sóng sau tàu (đọc vị trí đội tàu, không sửa hệ tàu), sóng bạc đầu mịn hơn, sắc hoàng hôn (người dùng: "note lại sẽ làm sau", 2026-11-13; đụng `dayNight.ts`, hệ ngày / đêm chung).
- [ ] 3.6 README mục Cấu trúc + ghi nguồn tài nguyên; `copilot-instructions.md` §5 thêm lệnh mới.

## M4 — Tối ưu và QA
- [ ] 4.1 Đủ bộ test của `copilot-instructions.md` §5, một lượt; `test:citynight -- --baseline` trước khi so.
- [ ] 4.2 `tests/KET-QUA.md`: bảng lệnh vẽ, GPU A/B, dung lượng.
- [ ] 4.3 Ngày, hoàng hôn, đêm, mưa, bão × trên cao, mặt cầu, dù lượn, mặt phố; điện thoại.
- [ ] 4.4 Báo cáo QA cuối ở `docs/ai/QA_LOG.md`; cập nhật memory bank; PR.

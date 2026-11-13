# QA_LOG — Nâng cấp sông Hàn + nhà hai bờ

Số "đo" là số máy in ra; chỗ nào ước lượng thì ghi rõ "ước lượng". Mới nhất ở trên.

## 2026-11-13 — M4 Task 4.0: tối ưu GPU (bản làm việc trước commit 4.0)
- **Lệnh**: như A/B của M3 (`main` `752ea22` build ở thư mục tạm, xen kẽ A1, B1, A2, B2 với `--noshots --only=ngay,dem,mua`); ảnh sau tối ưu: `node tests/ven-song-shots.mjs --label=toi-uu --only=ngay,dem,bao`.
- **Dò chi phí trước khi sửa (Intel Arc, 1600 × 900, đo bằng tham số URL tạm, script dò đã xóa)**: cỡ gương hầu như không ảnh hưởng (1024 × 512, 768 × 384, 512 × 512 lệch nhau trong khoảng 0,3 ms, cỡ nhiễu); kit khoảng 0,6 ms; nhánh `aFam` trong fragment shader thân nhà khoảng 0,3–0,5 ms; phần còn lại là shader nước.
- **Đã sửa**: (1) `bkCull(camera)` trong `kit.ts`: mỗi khung dồn instance kit còn trong tầm `kitFar` và trong khung nhìn lên đầu mảng, đặt `mesh.count` (không thêm lệnh vẽ, không thêm lưới); (2) `waterShader.ts`: vệt gió lấy 1 mẫu texture thay vì nhiều, bọt / sóng bạc đầu chỉ lấy mẫu khi gần kè hoặc `uStorm > 0,3`, dùng `textureLod`; (3) `water.ts`: `?mirror=WxH` để đo, mặc định vẫn `CONFIG.water.mirror` 1024 × 512 (giữ vì đổi cỡ không lợi gì).
- **A/B GPU thật so với `main` sau tối ưu**:

| Góc - điều kiện | A = `main` (2 vòng) | B = nhánh (2 vòng) | Lệch | Trước tối ưu | Lệnh vẽ |
|---|---|---|---|---|---|
| tren-cao - ngày | 11,20 / 11,01 | 12,08 / 12,08 | +8 đến +10 % | +14 đến +26 % | 268 → 273 |
| sat-nuoc - ngày | 7,97 / 7,91 | 8,36 / 8,28 | +4 đến +6 % | +10 đến +17 % | 235 → 240 |
| tren-cao - đêm | 11,20 / 10,92 | 11,81 / 11,82 | +5 đến +8 % | xem mục M3 | 272 → 277 |
| doc-song - đêm | 8,47 / 8,55 | 9,06 / 8,81 | +3 đến +7 % | xem mục M3 | 230 → 235 |
| du-luon - mưa | 10,08 / 9,87 | 11,09 / 11,10 | **+10 đến +12 %** | xem mục M3 | 269 → 274 |

- Tam giác tren-cao ngày: 4 146 557 → 4 239 033 (trước tối ưu 4 463 509). Program 180, lỗi console 0 ở 27 ảnh `toi-uu`. `test:buildings:unit` 35/35, `npm run build` đạt.
- **Xem ảnh (agent tự xem)**: `nha-mau-ngay`, `sat-nuoc-bao` giống trước tối ưu: kit hiện đủ ở nhà trong khung nhìn, bọt mép kè và sóng bạc đầu như cũ (sóng bạc đầu vẫn là mảng cứng, lỗi đã biết).
- **Kết luận**: bốn trong năm góc đạt mục tiêu ≤ khoảng +10 %; **du-luon mưa còn +10 đến +12 %** (gợn mưa + nước). Chưa thử trong trình duyệt: kit có nháy khi quay camera nhanh không (cắt theo khung nhìn tính mỗi khung trên CPU, lý thuyết không trễ khung), chi phí CPU của `bkCull` (596 nhà, chưa đo riêng).

## 2026-11-13 — M3 Task 3.0–3.3: hạ chiều cao dải sát sông, kit hai bờ, LOD kit, màu (bản làm việc trước commit M3)
- **Lệnh**: `npm run build && node tests/ven-song-shots.mjs --label=nha2 --only=ngay,dem`; A/B chuẩn: `main` `752ea22` build từ `git archive` ở thư mục tạm, xen kẽ `--label=ab3-A1 --dist=<tạm>/dist --noshots --only=ngay,dem,mua`, `ab3-B1`, `ab3-A2`, `ab3-B2`.
- **A/B GPU thật so với `main` (nước M1 + nhà M3 cộng lại; Intel Arc, 1600 × 900)**:

| Góc - điều kiện | A = `main` (2 vòng) | B = nhánh (2 vòng) | Lệch | Lệnh vẽ | Tam giác |
|---|---|---|---|---|---|
| tren-cao - ngày | 11,02 / 11,06 | 12,60 / 13,90 | +1,6 đến +2,8 (+14 đến +26 %) | 268 → 273 | 4 146 557 → 4 463 509 |
| sat-nuoc - ngày | 8,13 / 7,89 | 8,93 / 9,27 | +0,8 đến +1,4 (+10 đến +17 %) | 235 → 240 | 4 338 207 → 4 655 159 |
| tren-cao - đêm | 11,24 / 11,24 | 12,44 / 13,13 | +1,2 đến +1,9 (+11 đến +17 %) | 272 → 277 | 4 177 063 → 4 494 015 |
| doc-song - đêm | 8,36 / 8,54 | 9,42 / 9,78 | +1,1 đến +1,2 (+12 đến +15 %) | 230 → 235 | 4 058 747 → 4 375 699 |
| du-luon - mưa | 10,35 / 10,03 | 11,65 / 12,44 | +1,3 đến +2,4 (+13 đến +24 %) | 269 → 274 | 4 121 293 → 4 438 245 |

  **KHÔNG ĐẠT mục tiêu ≤ khoảng +10 % của spec §3.** Riêng nước (M1) đã chiếm +0,7 đến +1,0 ms; phần nhà thêm khoảng +0,5 đến +1,5 ms. Việc tối ưu ghi ở plan M4 task 4.0.
- Program 176 → 180; 0 lỗi console ở mọi lượt; lệnh vẽ +5 mọi góc (mat-pho đêm +6, chưa rõ nguồn +1); tam giác +316 952 mỗi góc (bộ đếm tính cả tam giác đã thu về một điểm).
- **Dải sát sông (cách kè ≤ 300 m)**: bờ Tây 305 nhà, bờ Đông 323 nhà; chiều cao trung vị 47,4 → 22,3 m (Tây), 52,5 → 22,3 m (Đông); nhà dưới 20 m: 21 → 139 (Tây), 14 → 121 (Đông); 0 nhà bị nâng, 0 nhà dưới 9 m. Kit: 596 nhà (họ 1: 99, 2: 136, 3: 122, 4: 67, 5: 172).
- **Test**: build sạch; `test:buildings:unit` 35/35 (phiên chính chạy lại); agent con báo `test:drive:unit` 124/124, `test:boats:unit` 17/17, `test:traffic:unit` 11/11, `test:stroll:unit` 86/87 (ca trượt cũ do `strollBase.walk` chưa commit của người dùng).
- **Quảng cáo sau khi hạ chiều cao** (agent con đếm): panos 8, mái 5, màn hình 3, băng rôn 102, đủ như trước.
- **Xem ảnh (phiên chính xem `nha-mau-ngay`, `nha-dong-ngay`, `tren-cao-ngay`, `doc-song-dem`; người dùng chưa duyệt)**:
  - Đạt: hai bờ sát sông thành dãy nhà thấp nhiều màu (kem, vàng, hồng, xanh nhạt), mái ngói / mái xanh, cửa hàng tầng trệt, khách sạn tầm trung, vài tháp kính; bờ Đông chi tiết quay ra sông; đêm có cửa hàng sáng ấm, LED chỉ còn trên tháp thật.
  - Chưa đạt: phía sau dải (cách kè > 300 m) vẫn là rừng tháp trắng, chỗ chuyển tiếp đột ngột; "nhà ống" là khối 14–29 m nên ra dãy nhà chứ không phải từng căn hẹp; hàng nhà đầu còn nhiều khoảng trống và sân phẳng; kính cửa hàng ban ngày tối; ban đêm dải sát sông tối hơn trước (ít tháp sáng), vệt đèn trên sông bớt rực.
- **Ảnh chuyển động** (agent con, script tạm): không thấy nhấp nháy giữa kit và thân, không giật rõ khi qua ngưỡng LOD 600 m / 1 400 m.
- **Chưa kiểm**: mọi test trình duyệt SwiftShader (dự kiến lệch có chủ ý: `test:citynight` cần `-- --baseline`, `test:drawcalls` +5, ảnh của `test:riverfront` / `test:tunnel` / `test:sunwheel`); mặt cắt Hầm cùng kit; `disposeBuildingKit()`; điện thoại, bậc chất lượng Thấp.

## 2026-11-13 15:20 — M2 nguyên mẫu nhà (kit trong three, vùng mẫu bờ Tây −700 ≤ x ≤ −262, |z| ≤ 500)
- **Máy / lệnh**: như M1; `npm run build && node tests/ven-song-shots.mjs --label=nha1 --only=ngay,dem` (thêm góc `nha-mau`). Ảnh ở `tests/screens/ven-song/nha1/`.
- **Kết quả máy đo** (agent con chạy, phiên chính chạy lại `npm run build` và `test:buildings:unit`): build sạch; `test:buildings:unit` 30/30; `test:drive:unit` 124/124; `test:stroll:unit` 86/87 (trượt "hướng theo camYaw" do `strollBase.walk` 1,6 chưa commit của người dùng, có từ trước); 0 lỗi console; program 176 → 180, không tăng thêm sau khi đi hết các góc.
- **Vùng mẫu**: 122 nhà — họ 1 khách sạn 33, họ 2 chung cư 25, họ 3 thương mại 6, họ 4 văn phòng 52, họ 5 nhà ống 6.
- **Lệnh vẽ** (trước → sau, ngày / đêm): tren-cao 268 → 273 / 272 → 277; du-luon 268 → 273 / 271 → 276; nha-tay 154 → 159 / 178 → 183; mat-pho 240 → 244 / 243 → 248; sat-nuoc 235 → 239 / 257 → 261; nha-dong 157 → 159 (cả hai, dù không thấy vùng mẫu: hình cầu bao của cả họ quá to); doc-song, bo-ke +0. Trong trần +6 của spec.
- **Tam giác**: +71 264 ở lượt chính khi thấy cả vùng (tính cả tam giác tầng đã thu về một điểm); lượt bóng và gương +0.
- **GPU**: A/B xen kẽ một vòng với `?buildings=off` (cùng bản build, không phải so với `main`): góc nha-mau 11,9 / 11,6 → 12,7 / 12,5 ms (khoảng +0,6 đến +1,2 ms); góc tren-cao nhiễu lớn, không kết luận được. **Chưa có phép A/B chuẩn so với `main`.**
- **Đường lùi**: `?buildings=off` → 0 lưới `bk-fam*`, 176 program, 0 lỗi.
- **Xem ảnh (phiên chính tự xem `nha-mau-ngay`, `nha-tay-ngay`, `nha-mau-dem`; người dùng chưa duyệt)**:
  - Đạt: trong vùng mẫu nhà không còn là hộp trơn: tháp kính có dải ban công mặt sông và khung biển hiệu mái sáng về đêm, văn phòng có lam đứng, mái có tường chắn / khối kỹ thuật; cửa sổ đêm và viền LED vẫn chạy; không thấy vật lơ lửng hay mảng shading hỏng.
  - Chưa đạt: vẫn là "rừng tháp" trắng xám trên nền đất phẳng, chưa ra phố Đà Nẵng: chỉ 6 nhà ống vì nhà ven sông hầu hết cao trên 30 m (chiều cao lấy từ `rand()`, chưa đổi); màu tường ít sắc; nhìn từ xa (nha-tay) khác biệt nhỏ; mặt đất giữa các nhà trống.
- **Chưa kiểm**: nhấp nháy z-fighting khi chuyển động (mới có ảnh tĩnh); đường lật X cho bờ Đông và `disposeBuildingKit()` chưa chạy lần nào; mặt cắt Hầm cùng kit; thân `aFam = 0` có giống từng điểm ảnh bản cũ không (theo mã thì nhánh cũ giữ nguyên); chưa chạy test trình duyệt SwiftShader nào.
- **Kết luận**: kỹ thuật của D-037 bản 2 chạy được trong trần lệnh vẽ; về hình ảnh mới là bước đầu. **Chờ người dùng xem và quyết hướng M3.**

## 2026-11-13 14:05 — Điểm lưu trước khi tắt máy
- Sau sự cố `node_modules` (xem `PROJECT_STATE.md` mục "Trạng thái lúc lưu") đã cài bù bằng `npm install`: `npm ls --depth=0` đủ gói, `npm run build` đạt (`tsc --noEmit` + `vite build`), `npx tsx --version` chạy. **Chưa chạy lại** test trình duyệt nào sau khi cài bù (`test:weather` đạt là trước sự cố, cùng mã nguồn).

## 2026-11-13 — M1 nguyên mẫu nước (bản làm việc trên `feature/ven-song-chan-thuc`, chưa commit lúc đo)
- **Máy / trình duyệt**: Windows 11, GPU Intel Arc (ANGLE D3D11), Chromium headless của Playwright, 1600 × 900, URL `?test&perf` (ở `?test` bộ đèn giữ `full`).
- **Lệnh**: `npm run build && node tests/ven-song-shots.mjs --label=sau`; A/B: bản `main` `752ea22` build ở một worktree tạm, chạy xen kẽ `--label=ab-A1 --dist=<worktree>/dist --noshots --only=ngay,dem,mua`, `--label=ab-B1 --noshots --only=ngay,dem,mua`, rồi A2, B2.
- **Góc**: tren-cao, doc-song, sat-nuoc, bo-ke, du-luon, mat-pho, nha-tay, nha-dong (tọa độ trong script). **Điều kiện**: ngày, hoàng hôn (`night` 0,62), đêm, mưa, bão, mưa đêm.

| Góc - điều kiện | A = `main` (ms GPU, 2 vòng) | B = nước mới (2 vòng) | Lệch | Lệnh vẽ A → B |
|---|---|---|---|---|
| tren-cao - ngày | 11,08 / 11,29 | 12,00 / 11,95 | +0,8 (+7 %) | 268 → 268 |
| sat-nuoc - ngày | 7,83 / 7,95 | 8,52 / 8,52 | +0,6 (+8 %) | 235 → 235 |
| tren-cao - đêm | 11,01 / 11,10 | 12,23 / 11,83 | +1,0 (+9 %) | 272 → 272 |
| doc-song - đêm | 8,59 / 8,21 | 8,67 / 9,02 | +0,4 (+5 %) | 230 → 230 |
| du-luon - mưa | 10,16 / 10,32 | 10,98 / 11,22 | +0,9 (+8 %) | 269 → 269 |

- Tam giác không đổi ở mọi góc. Program 176 → 176. Lỗi console: 0 ở mọi lượt.
- Heap JS cuối lượt dao động 93–133 MB giữa các lượt cùng bản build (GC), không dùng để kết luận rò bộ nhớ. Chưa đo bộ nhớ GPU; ảnh gương lớn hơn 512² → 1024 × 512 (ước lượng thêm khoảng 1 MB màu + độ sâu), texture pháp tuyến 256² → 512² có mipmap (ước lượng thêm khoảng 1 MB).
- **Lưu ý về số tuyệt đối**: lượt đo gốc đầu ngày cho 12,4 / 8,5 / 13,0 / 10,5 / 14,7 ms, và một lượt lỡ đo lại bản cũ (build hỏng vì lỗi kiểu nên `dist/` chưa đổi) cho 14,8 / 14,8 / 17,1 / 15,1 / 17,7 ms: máy trôi tới 3–5 ms theo nhiệt / tải. Chỉ bảng A/B xen kẽ ở trên là so được.
- **Xem ảnh (agent tự xem, người dùng chưa duyệt)**:
  - Đạt: sát nước không còn vỡ ô vuông; nhìn từ trên thấy màu nước xanh rêu thay vì xám sữa; ảnh phản chiếu nhà kéo dài theo chiều đứng; vòng gợn mưa thấy rõ ở gần; bão nước tối, có sóng bạc đầu; đêm vẫn có vệt đèn màu.
  - Chưa đạt / còn thô: sóng bạc đầu khi bão là mảng cứng mép ở gần camera; "hoàng hôn" không có sắc ấm (hệ ngày / đêm không có trạng thái hoàng hôn); đêm có đốm sáng nhỏ rải giữa sông (sao phản chiếu + vệt đèn khuếch đại); màu theo độ sâu sát kè khó nhận ra ở góc xa; chưa có vệt sóng sau tàu.
- **Sửa trong lúc làm**: tách sóng dài / gợn nhỏ để ảnh phản chiếu hết lấm tấm; hạ độ bão hòa (lần đầu ra xanh ngọc kiểu bể bơi); sóng bạc đầu đổi từ đốm li ti sang vệt thưa.
- **Test tự động**: `npm run build` đạt. `npm run test:weather` (SwiftShader, trên bản build cuối của M1): "weather-check: đạt", exit 0.
- **Chưa chạy**: `test:citynight`, `test:tunnel`, `test:drawcalls`, `test:perf -- --strict`, `test:mobile`, các test nặng khác; bậc chất lượng Thấp (gương tắt) và điện thoại chưa xem.
- **Kết luận**: M1 đạt tiêu chí máy đo được (0 lỗi, +0 lệnh vẽ, GPU ≤ +10 %); **chờ người dùng duyệt bằng mắt**.

## 2026-11-13 — Số đo gốc (`main` `752ea22`)
Xem `AUDIT.md` mục "Số đo gốc". Ảnh ở `tests/screens/ven-song/truoc/` (không commit).

# QA_LOG — Nâng cấp sông Hàn + nhà hai bờ

Số "đo" là số máy in ra; chỗ nào ước lượng thì ghi rõ "ước lượng". Mới nhất ở trên.

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

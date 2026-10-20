# Nhiệm vụ: Thêm mô hình Cầu sông Hàn (cầu quay) vào project Three.js hiện có

## Bối cảnh
Project hiện đã có **Cầu Rồng**, **Cầu Thuận Phước** và **Cầu Trần Thị Lý** dựng bằng Three.js. Tôi muốn bổ sung **Cầu sông Hàn** — cây cầu quay duy nhất ở Việt Nam — vào CÙNG scene, chi tiết, sống động và chân thực nhất có thể, **bao gồm animation quay 90°**. Ba cầu hiện có phải giữ nguyên hành vi và hiệu năng.

## Bước 0 — BẮT BUỘC: Đọc project trước khi viết code
1. Đọc cấu trúc thư mục, file entry, module của **cả ba cầu đã có**, và `bridges/common/` (nếu đã tách).
2. Ghi lại cho tôi:
   - Phiên bản three.js, cách import, bundler.
   - Đơn vị/tỉ lệ, hướng Bắc, trục đứng.
   - Vị trí, hướng của 3 cầu và đường sông Hàn; khoảng trống giữa Cầu Rồng và Cầu Thuận Phước.
   - Hệ nước, Sky, ánh sáng, bloom, chế độ ngày/đêm, **đồng hồ thời gian trong scene (nếu có)**, GUI, camera presets, hệ xe chạy, hệ thuyền chạy trên sông.
   - Cách Cầu Rồng xử lý sự kiện có kịch bản (phun lửa/nước) — để làm sự kiện quay cầu theo cùng pattern.
3. Tóm tắt rồi mới bắt đầu. Tái sử dụng tối đa thành phần chung (cáp, lan can, cột đèn, LED, traffic, thuyền).

## Kiến trúc code
- Module `src/bridges/songHan/`: `SongHanBridge.js` (class chính, trả về `THREE.Group`), `config.js`, `fixedSpans.js`, `swingSpan.js` (tháp + dầm thép + dây văng của phần quay), `turntablePier.js`, `swingController.js` (state machine quay cầu), `lighting.js`, `materials.js`.
- **Phần quay phải là một `THREE.Group` riêng có pivot đúng tại tâm trụ quay**, chứa tháp, dầm, dây văng, lan can, đèn, xe đang ở trên nhịp quay — để chỉ cần xoay một group.
- Mọi kích thước trong `config.js`, comment đơn vị mét, ghi `// ước lượng` cho số không có nguồn.
- Cùng API như các cầu trước: `update(dt, t)`, `dispose()`, cùng cách đăng ký GUI/camera/day-night.

## Vị trí địa lý
- Cầu nằm ở **trung tâm thành phố**, giữa Cầu Rồng (phía Nam, thượng lưu) và Cầu Thuận Phước (phía Bắc, hạ lưu). Thứ tự từ cửa biển vào: Thuận Phước → **sông Hàn** → Rồng → Trần Thị Lý.
- Trục cầu **Tây – Đông**: bờ Tây nối đường **Lê Duẩn** (giao với đường Bạch Đằng ven sông), bờ Đông nối đường **Phạm Văn Đồng** (hướng ra biển Mỹ Khê).
- Đặt theo tỉ lệ project; nếu khoảng cách thật không khớp với vị trí 2 cầu đã đặt, hỏi tôi trước.

## Thông số kỹ thuật thật
| Hạng mục | Giá trị |
|---|---|
| Loại cầu | Cầu quay (swing bridge) kết hợp dây văng; khánh thành 29/3/2000 |
| Tổng chiều dài | 487,7 m |
| Bề rộng | 12,9 m |
| Nhịp cố định | 11 nhịp × 33 m, BTCT dự ứng lực (chia ra hai bên phần quay — tỉ lệ chia theo ảnh, ghi ước lượng) |
| Nhịp quay | **122,7 m**, dây văng đối xứng, quay quanh **một trụ tròn ở giữa** dạng mâm xoay đỡ trên vành (rim-bearing turntable) |
| Vật liệu nhịp quay | Dầm và tháp bằng **thép**, bản mặt cầu BTCT |
| Tĩnh không khi đóng | ~25 m (theo Wikipedia — đối chiếu ảnh, nếu thấy quá cao so với ảnh thì báo tôi) |
| Cơ chế | Phần giữa quay **90°** quanh trục đứng, nằm dọc dòng sông, mở **2 luồng** cho tàu qua hai bên trụ |
| Lịch quay (du lịch) | Khoảng 23h tối thứ 7 và Chủ nhật, quay về vị trí cũ sau khoảng 30–60 phút |

## Chi tiết mô hình từng phần

### 1. Trụ quay (turntable pier)
- Trụ tròn lớn giữa sông, đỉnh có mâm xoay: vành ray tròn, bánh xe/con lăn quanh vành, tâm trụ (king pin), vỏ che cơ cấu.
- Phần nhìn thấy được khi quay phải hợp lý: khe hở giữa phần quay và phần đứng yên, mép mâm.
- Hệ thống đệm chống va (fender) quanh trụ để bảo vệ khỏi tàu — dạng khối/cọc đơn giản quanh trụ, dọc theo hướng nhịp quay khi mở.

### 2. Nhịp quay dây văng (swing span)
- Dầm thép đối xứng hai cánh (~61 m mỗi bên tính từ tâm), tiết diện hộp hoặc dầm I đôi — **đối chiếu ảnh tham khảo**.
- Tháp thép ở chính giữa (trên trụ quay). Hình dạng tháp, số cột tháp (một cột ở tim cầu hay hai cột hai bên mép) và số mặt phẳng dây **không có trong số liệu** — xác định từ ảnh tôi đính kèm, mô tả lại cho tôi trước khi dựng.
- Dây văng dạng **rẻ quạt đối xứng** hai phía tháp, mỗi phía dây neo đều dọc cánh dầm. Dây là đoạn thẳng, dựng bằng InstancedMesh (tính trung điểm, độ dài, quaternion).
- Hai đầu cánh: khớp nối với nhịp cố định (khe co giãn, gối tựa đầu cánh, chốt khóa khi đóng).

### 3. Nhịp cố định (11 × 33 m)
- Dầm BTCT dự ứng lực trên trụ thân trụ BTCT (InstancedMesh cho trụ và dầm lặp lại).
- Cao độ hạ dần về mố hai bờ; nối vào đường Bạch Đằng (Tây) và đường bờ Đông.
- Hai trụ cố định sát phần quay là trụ đón (rest pier) — có gối đỡ đầu cánh khi cầu đóng.

### 4. Mặt cầu
- Rộng 12,9 m: làn xe hai chiều + lề bộ hành hai bên, lan can, cột đèn.
- Vạch kẻ đường bằng `CanvasTexture`.
- **Barie + đèn tín hiệu giao thông** ở hai đầu phần quay (và/hoặc ở hai đầu cầu) — dùng trong kịch bản quay.

### 5. Vật liệu (PBR)
- Thép tháp/dầm nhịp quay: sơn màu (đối chiếu ảnh), metalness ~0.7, roughness ~0.4.
- Bê tông trụ/dầm cố định: xám, roughness ~0.85, normal noise procedural; trụ có vệt nước bám.
- Mâm xoay & ray: thép tối, có chút gỉ/dầu mỡ ở vùng cơ cấu.

### 6. Chiếu sáng ban đêm
- Đèn trang trí dọc cầu, tháp và dây văng, đổi màu (dùng lại hệ LED/shader đã có cho các cầu khác).
- Phản chiếu trên mặt nước, kết hợp bloom sẵn có.
- Khi đang quay: đèn tín hiệu đỏ nhấp nháy ở barie, đèn báo hàng hải trên trụ quay và đầu cánh.

## Animation quay cầu (trọng tâm)
Cài đặt `swingController.js` là một **state machine**:

`CLOSED → STOP_TRAFFIC → UNLOCK → ROTATING_OPEN → OPEN → ROTATING_CLOSE → LOCK → REOPEN_TRAFFIC → CLOSED`

- **STOP_TRAFFIC:** đèn tín hiệu chuyển đỏ, barie hạ xuống; hệ xe dừng trước barie; xe đang trên nhịp quay chạy hết ra ngoài (hoặc ẩn) trước khi quay.
- **UNLOCK:** hiệu ứng nhỏ — nhịp quay nâng nhẹ vài cm (khỏi gối đầu cánh), chốt khóa rút ra.
- **ROTATING_OPEN:** xoay group nhịp quay 90° quanh trục đứng qua tâm trụ, có **ease-in/ease-out** (vận tốc góc tăng dần – đều – giảm dần, không giật). Thời lượng thật khoảng vài phút; cho phép **hệ số tăng tốc** trong GUI (vd 1×, 10×, 30×).
- **OPEN:** nhịp quay nằm dọc dòng sông; mở 2 luồng hai bên trụ; **thuyền/tàu** (dùng hệ thuyền có sẵn hoặc tạo mới) đi qua hai luồng.
- **ROTATING_CLOSE → LOCK → REOPEN_TRAFFIC:** đảo ngược, hạ nhịp, khóa, barie nâng, đèn xanh, xe chạy tiếp.
- Hướng xoay (cùng/ngược chiều kim đồng hồ) để trong config; kiểm tra không va chạm hình học với trụ đón và fender trong suốt hành trình.
- Kích hoạt: nút **"Quay cầu"** trong GUI; nếu project có đồng hồ thời gian trong scene, tự động quay lúc **23:00 thứ 7 và Chủ nhật** (theo giờ scene), giữ mở trong khoảng thời gian cấu hình được.
- Phát event (`swingStart`, `swingOpen`, `swingClosed`) để camera/âm thanh/hệ khác có thể lắng nghe. Nếu project có âm thanh: còi báo, tiếng động cơ mâm xoay (positional audio, tùy chọn).

## Sống động (bật/tắt bằng GUI)
- Xe hai chiều trên cầu (dùng hệ traffic chung), dừng/chạy theo trạng thái quay.
- Người đi bộ trên lề cầu và bờ sông Bạch Đằng (mức chi tiết thấp).
- Thuyền du lịch sông Hàn chạy nối lộ trình qua Cầu Rồng – Cầu sông Hàn – Cầu Thuận Phước.

## Camera & tương tác
- Preset mới: "Cầu sông Hàn — toàn cảnh", "Trên cao nhìn xuống trụ quay" (thấy rõ chuyển động 90°), "Từ bờ Bạch Đằng", "Trên mặt cầu".
- Khi bấm "Quay cầu", tùy chọn camera tự bay đến góc nhìn đẹp nhất rồi quay về góc cũ khi xong.
- Thêm "Đến Cầu sông Hàn" vào menu chọn cầu.

## Hiệu năng
- Giữ ≥ 60 FPS với **cả bốn cầu**, kể cả trong lúc quay.
- Group quay không được trộn geometry (merge) với phần cố định; merge riêng trong từng phần.
- InstancedMesh cho dây văng, trụ, dầm lặp, cột đèn, lan can, xe.
- Kiểm tra shadow và bounding sphere của group quay cập nhật đúng khi xoay (tránh bị frustum-cull sai).
- Báo cáo `renderer.info` trước/sau.

## Quy trình làm việc
1. Bước 0 → tóm tắt + câu hỏi (vị trí, mô tả tháp/dây văng từ ảnh).
2. Nhịp cố định + trụ quay + dầm nhịp quay đúng kích thước → cho tôi xem.
3. Tháp + dây văng nhịp quay → cho tôi xem.
4. State machine quay cầu + barie + đèn tín hiệu → demo quay ở tốc độ 30×.
5. Vật liệu, LED ban đêm, tích hợp xe và thuyền.
6. Camera preset, tối ưu, kiểm tra không va chạm.
7. Chạy project: không lỗi console; Cầu Rồng (kể cả phun lửa/nước), Cầu Thuận Phước, Cầu Trần Thị Lý vẫn hoạt động bình thường.

Sau mỗi bước, tóm tắt ngắn đã làm gì và file nào thay đổi.
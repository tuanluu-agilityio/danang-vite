# PROMPT — Xây dựng Hầm vượt sông Hàn trong dự án "Đà Nẵng 3D"

> Dán toàn bộ file này cho agent lập trình (Claude Code) đang mở thư mục `danang-vite`.

---

## 0. Vai trò và mục tiêu

Bạn là kỹ sư đồ hoạ Three.js kiêm kỹ sư cầu hầm. Dự án `danang-vite` (Vite + TypeScript + three@0.165, không dùng framework UI) đang dựng 4 cầu trên sông Hàn: Cầu Rồng, Thuận Phước, Trần Thị Lý, Sông Hàn. Mỗi cầu có góc nhìn riêng, Tour tự động với thuyết minh và bảng thông số. Đọc kỹ [README.md](../README.md) trước khi làm.

**Nhiệm vụ:** thêm công trình thứ 5 là **Hầm vượt sông Hàn**, theo đúng mức chi tiết và cách tổ chức code của 4 cầu hiện có. Hầm phải:
1. **Bám thông tin đã công bố** (mục 1). Chỗ nào chưa công bố thì tự thiết kế theo mục 2, nhưng phải hợp lý về kỹ thuật và ghi chú `(ước lượng)` trong `config.ts`, giống cách các cầu đang làm.
2. **Hợp với Đà Nẵng**: xe máy chiếm đa số, mùa mưa bão và ngập (tháng 9 đến 12), nắng gắt, gió biển mặn, có di tích Thành Điện Hải gần cửa hầm phía Tây.
3. **Nhìn được phần nằm dưới đất và dưới nước**: có chế độ mặt cắt/xuyên thấu, lái xe xuyên hầm, Tour có thuyết minh, và mô phỏng dìm đốt hầm.
4. **Không làm hỏng những gì đang có**: 4 cầu, vị trí nhà/cây/xe (chuỗi ngẫu nhiên có seed), draw call của các góc nhìn cũ, và các test hiện tại.

Hầm **mới ở giai đoạn đề xuất, chưa xây**. Giao diện và lời thuyết minh phải nói rõ đây là *mô hình phương án đề xuất*.

---

## 1. Thông tin đã công bố (bắt buộc bám theo)

| Hạng mục | Giá trị | Nguồn |
|---|---|---|
| Hướng tuyến | Từ nút **Đống Đa – Trần Phú** (Hải Châu, bờ Tây) sang nút **Vân Đồn – Trần Hưng Đạo** (Sơn Trà, bờ Đông), tuyến thẳng | Tiền Phong 07/2024; Tuổi Trẻ 03/2025 |
| Tổng chiều dài tuyến chính (phương án 2025) | **≈ 1.670 m**, gồm hầm kín qua sông **600 m**, hầm kín trên bờ **380 m**, hầm hở **415 m**. Phần còn lại là đường dẫn | Tuổi Trẻ 19/03/2025 |
| Quy mô | **6 làn xe cơ giới** (3 làn mỗi chiều) | BRITEC 2016–2017; Tiền Phong 2024 |
| Tốc độ thiết kế | **60 km/h** | Phương án 2017 |
| Độ dốc dọc tham khảo | Hầm kín **≈ 2%**, hầm hở **≈ 4%** (phương án 2017) | Nguồn tổng hợp |
| Tổng mức đầu tư | **6.880 tỷ đồng**: xây lắp 3.900 tỷ, giải phóng mặt bằng 2.000 tỷ, chi phí khác ≈ 980 tỷ | Tuổi Trẻ 19/03/2025 |
| Tiến độ | Thuộc quy hoạch 2021–2030, tầm nhìn 2050 (QĐ 359, QĐ 1287). Đầu tư dự kiến **2031–2045** | Tuổi Trẻ, Tiền Phong |
| Bối cảnh | Sẽ là **hầm vượt sông thứ hai của Việt Nam**, sau hầm Thủ Thiêm ở TP.HCM (hầm dìm, khánh thành 2011) | Người Quan Sát |

Các phương án cũ (2016: 1.315 m, đoạn hầm chìm 900 m; 2017: 1.405 m, hầm kín 1.005 m, 4.700 tỷ) **chỉ nhắc trong thuyết minh** như lịch sử phương án. **Dùng phương án 2025 làm chuẩn.**

---

## 2. Thiết kế đề xuất (phần tự thiết kế, ghi "(ước lượng)" trong config)

### 2.1 Vị trí trong cảnh
Quy ước trục (xem đầu [src/config.ts](../src/config.ts)): đơn vị là mét. Trục X chạy Tây → Đông. Trục Z dọc sông, −Z là phía Bắc. Mặt nước ở y = 0, mặt đất `landY = 2.5`, mặt đường `roadY = 2.6`. Sông rộng ~524 m (`bankX = 262`). Đường Bạch Đằng ở x = −299, Trần Hưng Đạo ở x = +299.

- Tim hầm đặt ở **z = −1700**, tức khoảng 620 m về phía Bắc Cầu sông Hàn (z = −1080) và 1,2 km về phía Nam Cầu Thuận Phước (z = −2900). Ngoài thực tế, đường Đống Đa cũng nằm phía Bắc Lê Duẩn một quãng tương tự.
- Hầm chạy thẳng theo trục X, vuông góc với dòng sông. Lý trình đối xứng qua tim sông x = 0:

| Đoạn | Phạm vi \|x\| (m) | Dài mỗi bên | Ghi chú |
|---|---|---|---|
| Hầm kín qua sông (hầm dìm) | 0 → 300 | 300 (tổng 600) | Chạy dưới cả Bạch Đằng và Trần Hưng Đạo |
| Hầm kín trên bờ (đào hở, lấp lại) | 300 → 490 | 190 (tổng 380) | |
| Hầm hở (máng chữ U) | 490 → 697,5 | 207,5 (tổng 415) | Có mái lam che 80 m sát cửa hầm |
| Đường dẫn trên mặt đất | 697,5 → 835 | 137,5 | Cộng với các đoạn trên được tổng ≈ 1.670 m |

Bờ Tây nối tiếp sang đường Đống Đa (x < −835), bờ Đông nối tiếp sang Vân Đồn (x > 835).

### 2.2 Phương pháp thi công (thể hiện được trên mô hình)
- **Qua sông: hầm dìm (immersed tube).** Gồm **5 đốt bê tông cốt thép, mỗi đốt 120 m**, đúc sẵn trong ụ khô, lai dắt bằng phao rồi dìm xuống hào đã nạo vét. Đây là phương pháp hầm Thủ Thiêm dùng, hợp với nền đất yếu và lòng sông nông. Khe nối giữa các đốt có gioăng cao su GINA và Omega (mô hình hoá thành khe 0,3 m và vòng gioăng sẫm màu). Trên nóc đốt có lớp đá hộc bảo vệ dày 1,0–1,5 m, chống neo tàu.
- **Trên bờ: đào hở có tường vây barrette** (diaphragm wall) dày 1,0 m, thi công xong thì lấp và trả lại mặt đường.
- **Hầm hở:** máng chữ U bằng bê tông cốt thép, có cọc chống đẩy nổi (hầm nằm dưới mực nước ngầm).

### 2.3 Mặt cắt ngang
Hai ống xe và một hành lang thoát nạn ở giữa, giống hầm Thủ Thiêm:

```
|1,0| ống Bắc (Tây→Đông) 12,5 |0,6| hành lang 3,0 |0,6| ống Nam (Đông→Tây) 12,5 |1,0|  = 31,2 m
```
- Mỗi ống có 3 làn: **2 làn ô tô 3,5 m** và **1 làn xe máy 3,5 m sát lề phải**. Làn xe máy ngăn bằng vạch liền kèm đinh phản quang. Ô tô chạy 60 km/h, xe máy 40 km/h. Lý do: xe máy chiếm phần lớn lưu lượng ở Đà Nẵng, cấm xe máy vào hầm thì hầm thiếu khả thi về xã hội. Lề trái 0,5 m, lề phải 1,0 m, mỗi bên có gờ bộ hành bảo trì 0,75 m.
- Tĩnh không **4,75 m** theo TCVN. Ống xe cao 6,1 m bên trong (phần trên dành cho quạt phản lực, đèn và biển báo). Bản đáy 1,2 m, bản nóc 1,2 m, nên **đốt dìm cao 8,5 m**.
- Hành lang giữa được tăng áp chống khói. **Cứ 100 m có một cửa ngang** từ ống xe sang hành lang, cửa sơn xanh lá, có đèn EXIT.

### 2.4 Trắc dọc (tự kiểm tra bằng code)
- Đáy sông (mới thêm, mục 3.3): sâu khoảng **−6,0 m** ở luồng giữa, nông dần về **−2,5 m** sát kè.
- Nóc đốt dìm phải thấp hơn đáy sông ít nhất **1,0 m**, chưa tính lớp đá bảo vệ. Mặt đường đáy hầm vào khoảng **−14 đến −15 m**.
- Độ dốc: hầm hở ≤ **4,5%**, hầm kín trên bờ ≤ **3,5%**. Đoạn dưới sông dốc ≤ **2%** và có điểm trũng ở tim sông. Đường cong đứng dùng parabol hoặc Catmull-Rom như `roadProfile` của các cầu, viết hàm `hrRoadY(x)` theo mẫu [src/bridges/song-han/profile.ts](../src/bridges/song-han/profile.ts).
- **Gờ chắn ngập ở cửa hầm:** đỉnh dốc ngay trước cửa hầm hở cao **y = 3,6 m**, tức +1,0 m so với mặt phố, để nước ngập đường không tràn vào hầm (Đà Nẵng hay ngập khi mưa lớn cộng triều cường).
- Thêm một test (mục 6) khẳng định: độ dốc lớn nhất từng đoạn nằm trong giới hạn, nóc hầm luôn thấp hơn đáy sông ≥ 1,0 m, và cao độ liên tục tại mọi chỗ chuyển đoạn.

### 2.5 Thiết bị an toàn và vận hành (dựng thành mô hình, gom instancing)
- **Quạt phản lực**: thông gió dọc, từng cặp treo trần, cách nhau ~100 m. Cánh quạt quay khi đang bật.
- **Chiếu sáng**: vùng ngưỡng 80 m đầu hầm sáng hơn hẳn, sau đó vùng chuyển tiếp rồi vùng trong. Ban ngày vùng ngưỡng sáng mạnh, ban đêm giảm theo `shared.uNight`. Điều này khớp nguyên lý thích nghi mắt và có thể mô phỏng được.
- Hộp **SOS và bình chữa cháy** cách 50 m, **họng nước chữa cháy**, camera CCTV, biển chỉ dẫn thoát nạn phát quang.
- **Đèn tín hiệu điều khiển làn** (✕ đỏ / ↓ xanh) mỗi 150 m. Bảng **VMS** ở hai cửa hầm hiển thị "HẦM SÔNG HÀN · 60 km/h · XE MÁY ĐI LÀN PHẢI".
- **Khung giới hạn chiều cao 4,5 m** đặt 50 m trước cửa hầm hở. Biển cấm xe chở hàng nguy hiểm, xe thô sơ, người đi bộ. Container từ cảng Tiên Sa vẫn đi Cầu Thuận Phước, đây là lý do logic cho lệnh cấm.
- **Cửa phai chống ngập**: khe thép và cửa trượt ở cửa hầm hở, bình thường để mở.
- **Trạm bơm** ở điểm trũng giữa sông, gồm hố thu và lưới thu nước dọc mép đường. Thuyết minh nhắc đến bơm vì lượng mưa lớn trong mùa mưa.
- **Nhà điều hành và thông gió** cạnh cửa hầm Đông, thấp tầng, có ống thoát khí được ngụy trang thành kiến trúc.

### 2.6 Kiến trúc cửa hầm (văn hoá, khí hậu)
- **Mái lam che nắng mưa** dài 80 m trên mỗi hầm hở, sát cửa hầm kín. Lam bê tông siêu tính năng xếp nghiêng, hở 40%, có ba tác dụng: giảm hiệu ứng "hố đen" khi xe từ nắng gắt chạy vào, giảm mưa hắt xuống dốc, và đón gió bão xuyên qua thay vì hứng gió như một tấm buồm (gió bão cấp 12–13).
- **Cửa Tây (Hải Châu)**: gần **Thành Điện Hải** (di tích quốc gia đặc biệt, xây năm 1813). Cửa hầm làm thấp, ốp đá màu gạch thành cổ, mép mái lam có nhịp răng cưa gợi tường thành. Nhà cao tầng không chen vào vùng đệm di tích.
- **Cửa Đông (Sơn Trà)**: gợi **sóng biển và làng chài Nại Hiên, Mân Thái**. Mép mái lam uốn lượn như con sóng, bên cạnh có cụm điêu khắc thuyền thúng nhỏ.
- **Ban đêm**: dải LED trắng ấm chạy theo mép mái lam và tường máng, chuyển nhẹ sang xanh nước biển. Độ sáng thấp hơn Cầu Rồng, Trần Thị Lý để không tranh nổi bật với chúng.
- Hai bên hầm hở có hàng cây và dải cỏ, tường máng có ô chữ "HẦM SÔNG HÀN" và lý trình.

---

## 3. Yêu cầu triển khai trong code

### 3.1 Cấu trúc và quy ước (đọc code trước, làm theo đúng mẫu)
- Thư mục mới **`src/bridges/han-tunnel/`**: `HanTunnel.ts` (class), `index.ts`, `profile.ts` (`HR`, `hrRoadY`), `materials.ts`, `immersed.ts` (5 đốt dìm và khe nối), `cutCover.ts` (hầm kín trên bờ), `openRamp.ts` (máng U, mái lam, gờ chắn ngập, cửa phai), `portals.ts` (kiến trúc hai cửa), `equipment.ts` (quạt, đèn, SOS, VMS, cửa thoát nạn), `riverbed.ts` (đáy sông và lớp địa chất), `life.ts` (xe), `immersion.ts` (mô phỏng dìm đốt hầm).
- `HanTunnel extends BridgeBase` ([src/common/BridgeBase.ts](../src/common/BridgeBase.ts)), prefix `hr`. Dùng `concreteParts`/`steelParts` + `finalize()` để gộp hình học. Phần nhỏ đưa vào `details` (LOD). Toàn bộ nội thất hầm đưa vào `noReflect`, vì mặt nước không cần phản chiếu chúng.
- Thông số đặt trong **một khối `hanTunnelBase` + `deriveHr()` trong [src/config.ts](../src/config.ts)**, giống `songHanBase`/`deriveSh`, rồi export `CONFIG.hanTunnel`. Mỗi dòng có chú thích tiếng Việt, đơn vị, và `(ước lượng)` nếu không có trong mục 1.
- Comment tiếng Việt, mật độ comment và cách đặt tên giống các file cầu hiện có. Không thêm thư viện mới.

### 3.2 Không phá vỡ chuỗi ngẫu nhiên có seed (bắt buộc)
- **Không** sửa `avoid()` trong [src/environment/city.ts](../src/environment/city.ts). `avoid(...) || rand()` sẽ đổi số lần gọi `rand()`, làm xê dịch toàn bộ nhà và cây.
- Để dọn nhà, cây, cột đèn nằm trên hành lang tuyến (|z − (−1700)| < 30 m, |x| từ 300 đến 835), làm theo mẫu `hideBankTrees()` trong [SongHanBridge.ts](../src/bridges/song-han/SongHanBridge.ts): **sau khi dựng xong**, gán ma trận scale 0 cho các instance bị đè. Nhà nằm trong `InstancedMesh` thuộc `THREE.LOD` của `buildCity`, nên phải xử lý cả level `near` lẫn `far`.
- Khởi tạo `HanTunnel` trong [src/main.ts](../src/main.ts) **sau** `SongHanBridge` (sau mọi lệnh dựng có dùng `rand`). Xe trong hầm dùng bộ sinh số riêng `rng(seed)` như [src/core/water.ts](../src/core/water.ts) làm.

### 3.3 Mặt đất, mặt nước, đáy sông
- **Khoét mặt đất:** khối đất trong `buildRiverBanks()` ([src/environment/river.ts](../src/environment/river.ts)) đang là một hộp đặc từ y = −6 đến 2,5. Tách hộp này thành nhiều hộp để chừa **lỗ chữ nhật đúng bằng mặt bằng hai máng hầm hở** (cộng 1 m mỗi bên). Thành máng chữ U là phần lấp kín mép lỗ. Đoạn này không gọi `rand()`.
- **Mặt nước:** `Water` là một mặt phẳng 40×40 km ở y = 0, nên sẽ hiện ra trong lòng máng hầm hở. Dùng `onBeforeCompile` để vá shader (Water.js có `varying vec4 worldPosition`), thêm uniform mảng chữ nhật `uHoles` và `discard` các điểm nằm trong mặt bằng hai máng. Giữ nguyên hiệu ứng nước ở mọi chỗ khác.
- **Đáy sông:** thêm lưới đáy sông màu bùn cát, sâu −2,5 m sát kè và −6 m ở giữa, chỉ trong đoạn z ∈ [−2100, −1300] để tiết kiệm. Thêm rãnh hào nạo vét có lớp đá hộc phủ nóc hầm. Bình thường mặt nước đục che hết, chỉ thấy rõ ở chế độ mặt cắt.

### 3.4 Chế độ mặt cắt / xuyên thấu (tính năng chính)
- Nút **"Mặt cắt địa chất"** bật/tắt. Khi bật:
  - Mặt nước bán trong suốt (uniform `alpha` của Water ≈ 0,35, `transparent = true`). Tắt thì trả lại như cũ.
  - Mặt đất dọc tuyến bị cắt bằng **clipping plane** z = −1700 + 16 (chỉ áp cho vật liệu đất, đá kè, đường, nhà, cây khi đang bật; nhớ bật `renderer.localClippingEnabled`). Phần đất phía Nam tuyến được giữ lại.
  - Hiện một **tấm mặt cắt địa chất** dọc tuyến: lớp cát san lấp, cát pha, sét yếu, sét cứng, đá phong hoá (dải màu và nhãn), cùng tường vây barrette, cọc dưới máng U, mực nước ngầm (đường nét đứt xanh).
  - **Nhãn 3D** gắn vào các mốc: "Hầm dìm 5 × 120 m", "Khe nối GINA", "Hầm đào hở 190 m", "Hầm hở 207,5 m", "Trạm bơm", "Gờ chắn ngập +1,0 m", "Đáy sông −6 m". Dùng sprite canvas hoặc CSS overlay. Nhãn đổi ngôn ngữ qua i18n.
- Tắt chế độ thì mọi vật liệu trở về trạng thái ban đầu, không rò rỉ material hay uniform.

### 3.5 Bên trong hầm
- Ánh sáng: `scene.environment` (RoomEnvironment) làm nội thất sáng giả tạo. Vật liệu trong hầm đặt `envMapIntensity` thấp (≈ 0,1–0,2). Tạo cảm giác sáng bằng dải đèn emissive (bloom ban đêm) và gradient vertex color (trần tối, mặt đường sáng dưới đèn), **không dùng hàng loạt PointLight**.
- Ống xe: mặt đường có vạch làn (tái dùng texture làn đường, xem [src/common/textures.ts](../src/common/textures.ts)), lề, tường ốp tấm sáng màu ở phần dưới 3 m, trần sơn tối, khe nối đốt hầm.
- **Hiệu ứng thích nghi mắt** khi lái xe vào hoặc ra: `renderer.toneMappingExposure` giảm dần về khoảng 70% trong 1,5 s rồi trả về giá trị gốc 0,55. Ra khỏi chế độ hầm luôn khôi phục đúng 0,55.
- Xe: dùng hệ xe chung ([src/common/traffic.ts](../src/common/traffic.ts), đọc API trước). Làn ô tô có xe con, taxi, buýt. **Làn phải dày xe máy.** Nếu `traffic.ts` chưa có kiểu xe máy thì thêm kiểu mới bằng instancing, khoảng 0,1 m³ hình hộp người + xe, không làm đổi chuỗi random của các cầu khác. Xe theo `hrRoadY(x)`. Tắt/bật bằng nút "Xe cộ".

### 3.6 Mô phỏng dìm đốt hầm (tương tự nút "Quay cầu" của Cầu sông Hàn)
- Nút **"Mô phỏng dìm đốt hầm"**. Chọn tốc độ 1× / 10× / 30×, có dòng trạng thái `aria-live`.
- Máy trạng thái (mẫu [SwingController.ts](../src/bridges/song-han/SwingController.ts)):
  `IDLE → FLOAT_IN` (đốt số 3, đầu bịt kín, nổi trên phao, có 2 tàu kéo dắt từ phía Bắc vào) → `POSITION` (neo bằng 2 phao định vị) → `BALLAST` (bơm nước dằn, đốt chìm dần tới cao độ thiết kế, nước gợn quanh) → `PULL_JOINT` (kích kéo áp khít vào đốt kề, gioăng GINA bị nén) → `BACKFILL` (lấp cát hai bên, đá hộc phủ nóc) → `DONE`.
- Trong lúc mô phỏng, đốt 3 và lớp lấp được tạm ẩn khỏi hầm hoàn chỉnh rồi "lắp" lại. Kết thúc thì trả hầm về trạng thái hoàn chỉnh. Camera tùy chọn bám theo (giống nút "Camera theo dõi khi quay").
- Thuyền du lịch trên sông vẫn chạy bình thường, nhưng tránh vùng thi công: đặt vùng cấm z ∈ [−1760, −1640] trong lúc mô phỏng.

### 3.7 Góc nhìn, Tour, bảng thông số, UI
- Thêm nút chọn công trình `data-bridge="hr"`, nhãn **"Hầm sông Hàn"**, vào `.seg` trong [index.html](../index.html), cùng khối `.view-list data-list="hr"`:
  - `hrTour`: Tour tự động
  - `hrOverview`: Toàn cảnh tuyến hầm
  - `hrCutaway`: Mặt cắt dọc (tự bật chế độ mặt cắt)
  - `hrPortalW`: Cửa hầm Tây – Thành Điện Hải
  - `hrPortalE`: Cửa hầm Đông – Sơn Trà
  - `hrDrive`: Lái xe xuyên hầm (camera mode mới `hrDrive`, giống `tpDrive` trong [camera.ts](../src/views/camera.ts), chạy theo làn ô tô giữa từ đường Đống Đa sang Vân Đồn rồi lặp, kèm hiệu ứng thích nghi mắt)
  - `hrGallery`: Hành lang thoát nạn
  - Các nút bật/tắt: "Mặt cắt địa chất", "Xe cộ", "Mô phỏng dìm đốt hầm" (khối điều khiển như `.swing-box`)
- `VIEWS` và `BRIDGE_HOME` ([presets.ts](../src/views/presets.ts)): thêm `hr: 'hrOverview'`. Góc nhìn dưới mặt đất dùng `maxPolar`.
- `SPEC_KEYS` ([panel.ts](../src/ui/panel.ts)): `hr: { specLen: 'hrLengthVal' (≈ 1.670 m), specWidth: 'hrWidthVal' (31,2 m mặt cắt đốt dìm), specSpanLabel: 'hrSpan' ("Hầm dìm qua sông"), specSpanVal: 'hrSpanVal' (600 m · 5 đốt), specNote: 'hrNote', lanes: '6' }`. `hrNote` ghi: *"Phương án đề xuất 2025, dự kiến đầu tư 2031–2045, tổng mức 6.880 tỷ đồng. Mặt cắt, độ sâu, kiến trúc cửa hầm là ước lượng."*
- **Tour `HR_TOUR`** ([tourStops.ts](../src/views/tourStops.ts) và `TOUR_DEFS` key `hr: { view: 'hrTour', key: 'hrStops', ... }`), khoảng 8 điểm dừng. Đường bay không xuyên qua mặt đất, mặt nước hoặc thành hầm; các đoạn dưới đất bay trong lòng hầm hoặc bật mặt cắt.
  1. Trên cao nhìn toàn tuyến, giữa Cầu sông Hàn và Thuận Phước. Giới thiệu: hầm vượt sông thứ hai của Việt Nam, đang ở dạng đề xuất.
  2. Cửa Tây, mái lam: gần Thành Điện Hải, tác dụng chống chói và chống hắt mưa.
  3. Gờ chắn ngập và cửa phai: mùa mưa bão, triều cường.
  4. Mặt cắt (tự bật): 5 đốt dìm × 120 m, nằm dưới đáy sông −6 m.
  5. Khe nối GINA và cảnh dìm đốt hầm (có thể kích hoạt mô phỏng bằng cờ `immerse: true`, giống `swing: true`).
  6. Trong ống xe: 3 làn mỗi chiều, làn phải cho xe máy, quạt phản lực, đèn vùng ngưỡng.
  7. Hành lang thoát nạn: cửa ngang mỗi 100 m, tăng áp chống khói.
  8. Cửa Đông, nhìn ra Sơn Trà: kết nối với biển, giảm tải cho Cầu Rồng và Cầu sông Hàn. Nhắc tổng mức 6.880 tỷ, tiến độ 2031–2045.
- **i18n:** thêm mọi khóa mới (`bridgeHr`, `vHr…`, `hrStops`, `hrLengthVal`, `hrNote`, nhãn mặt cắt, trạng thái mô phỏng `im_*`) vào **cả 9 file** `src/i18n/locales/{vi,en,ko,ja,zh,th,ar,hi,ru}.json`. Bản dịch phải tự nhiên, `ar` hiển thị đúng chiều phải sang trái. Cập nhật `loadingSub`.
- **Thuyết minh:** thêm `hrStops` vào `scripts/narration/vi.json` và `en.json` (số và đơn vị viết bằng chữ, theo hướng dẫn trong README), chạy `npm run gen:voice` rồi commit `public/voice/`. Nếu dịch vụ TTS lỗi thì báo lại, đừng tự bịa clip.

### 3.8 Tích hợp vào cảnh chung
- Thêm đoạn đường Đống Đa (x ∈ [−1900, −835]) và Vân Đồn (x ∈ [835, 1480]) ở z = −1700, mỗi chiều 3 làn, vào `ROADS3` trong [streets.ts](../src/environment/streets.ts), cùng nút giao với Bạch Đằng/Trần Hưng Đạo **ở mặt đất** (xe trên Bạch Đằng chạy trên nóc hầm kín).
- Nhìn từ xa (`overview`, `tpBoth`, `shOverview`…) phải thấy hai máng hầm hở và mái lam như một phần đô thị, không lộ hình học dưới đất.
- Âm thanh (nếu module `audio` cho phép mà không phải viết lại): khi camera trong hầm thì có tiếng ù quạt và tiếng xe vọng.

---

## 4. Hiệu năng (đo bằng `npm run test:drawcalls`)
- Các góc nhìn cũ **không tăng quá 12 draw call** so với bảng trong [tests/KET-QUA.md](../tests/KET-QUA.md). Góc nhìn chỉ thấy 4 cầu cũ, không thấy tuyến hầm, phải **chênh 0**.
- Góc nhìn của hầm ≤ 260 draw call, cả ngày lẫn đêm.
- Gộp bê tông thành một mesh. Các vật lặp lại (quạt, đèn, SOS, lam, khe nối, xe) dùng `InstancedMesh`. Đặt LOD: `lodDistance ≈ 1300`, `farDistance ≈ 1600`. Toàn bộ nội thất ẩn khi camera ở ngoài và cách cửa hầm quá 250 m, trừ khi đang bật mặt cắt.
- `dispose()` giải phóng đầy đủ, kể cả material và texture riêng của hầm.

---

## 5. Kế hoạch làm (theo giai đoạn, kiểm tra xong giai đoạn trước mới sang giai đoạn sau)
1. **Khảo sát:** đọc `config.ts`, `BridgeBase.ts`, toàn bộ `bridges/song-han/`, `environment/*`, `common/traffic.ts`, `views/*`, `ui/*`, `i18n/index.ts`, `tests/*.mjs`. Tóm tắt API sẽ dùng.
2. **Config, profile, test hình học trắc dọc** (mục 2.4). `npm run typecheck`.
3. Khoét đất, vá shader nước, đáy sông. Kiểm tra cảnh cũ không đổi bằng `test:drawcalls`.
4. Hầm dìm, hầm đào hở, hầm hở, cửa hầm, mái lam, gờ chắn ngập.
5. Nội thất, thiết bị an toàn, đèn ngày/đêm, xe (có xe máy).
6. Chế độ mặt cắt, nhãn, tấm địa chất.
7. Mô phỏng dìm đốt hầm.
8. UI, góc nhìn, `hrDrive`, Tour, i18n 9 ngôn ngữ, thuyết minh vi/en.
9. Test và đo hiệu năng, cập nhật README (mục cấu trúc, ghi chú hầm) và `tests/KET-QUA.md`.

Commit theo từng giai đoạn trên nhánh mới `feature/han-tunnel`, không commit thẳng `main`.

---

## 6. Kiểm tra bắt buộc trước khi báo xong
- `npm run build` không lỗi TypeScript.
- Test mới **`tests/tunnel-check.mjs`** (script `test:tunnel`), gồm:
  - Hình học: độ dốc từng đoạn, nóc hầm ≥ 1,0 m dưới đáy sông, cao độ liên tục, gờ chắn ngập ở y = 3,6, tổng chiều dài các đoạn bằng 600/380/415 m.
  - Chạy `hrTour` hết vòng: chú thích đổi đúng 8 điểm, camera không lọt dưới mặt đất hay mặt nước khi đang ở ngoài hầm, chế độ mặt cắt tự bật và tắt đúng.
  - Mô phỏng dìm đốt hầm chạy qua đủ các trạng thái và trả hầm về trạng thái hoàn chỉnh.
  - Bật rồi tắt mặt cắt 3 lần: vật liệu nước và đất trở về đúng giá trị gốc (`alpha`, `transparent`, `clippingPlanes`), exposure vẫn là 0,55.
- `npm run test:tour` và `npm run test:voice` vẫn qua. `test:drawcalls` đạt mục 4, kèm thêm các góc nhìn `hr*`.
- Chụp màn hình bằng Playwright (ngày và đêm) cho: `hrOverview`, `hrCutaway`, `hrPortalW`, `hrPortalE`, `hrDrive`, `hrGallery`, và một khung giữa mô phỏng dìm. Lưu vào `tests/screens/` và tự xem lại ảnh để soát lỗi z-fighting, nước lọt vào máng, nội thất quá sáng, nhãn chồng nhau.
- Báo cáo trung thực: cái gì xong, cái gì còn thiếu, số draw call trước/sau, những thông số nào là ước lượng.

---

## 7. Nguồn tham khảo
- Tuổi Trẻ (19/03/2025), *Đà Nẵng đề xuất phương án xây hầm qua sông Hàn hơn 6.800 tỉ*: https://tuoitre.vn/da-nang-de-xuat-phuong-an-xay-ham-qua-song-han-hon-6-800-ti-20250319183650911.htm
- Tiền Phong (07/2024), *Hầm chui qua sông Hàn sẽ như thế nào?*: https://tienphong.vn/ham-chui-qua-song-han-se-nhu-the-nao-post1655756.tpo
- VnExpress, chủ đề *Đà Nẵng sẽ xây hầm vượt sông Hàn*: https://vnexpress.net/topic/da-nang-se-xay-ham-vuot-song-han-21586
- VOH, *Đề xuất phương án xây dựng hầm vượt sông Hàn*: https://voh.com.vn/giao-thong/de-xuat-phuong-an-xay-dung-ham-vuot-song-han-hon-6000-ty-dong-585589.html
- Người Quan Sát, *Hầm vượt sông thứ hai của Việt Nam…*: https://nguoiquansat.vn/ham-vuot-song-thu-hai-cua-viet-nam-di-qua-dong-song-bieu-tuong-cua-do-thi-dang-song-nhat-the-gioi-chi-phi-gan-7-000-ty-217642.html

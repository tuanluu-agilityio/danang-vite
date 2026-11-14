# Chế độ lái xe máy (xe tay ga) — thiết kế

_Ngày: 2026-11-14 · Quyết định: D-040 · Nhánh: `feature/xe-may` (từ `main` `a66989b`) · Trạng thái: người dùng bảo tự quyết và làm tới demo cuối (2026-11-14); §17 thay các mục tương ứng ở trên. **Đã triển khai Task 1–10 trên `feature/xe-may` (HEAD mã `54dd2cb`), test trình duyệt `test:bike` viết xong nhưng chưa chạy trọn, chưa chạy test nặng nào, chưa review toàn nhánh (dừng theo lời người dùng: "không cần chạy test, tôi tự test", 2026-11-14); chưa PR / merge, Worker chưa deploy.** Lệch so với spec khi làm: xem §18_

Ghi chú về nguồn gốc từng điều: **(ND)** = người dùng nói / đã duyệt trong buổi brainstorming; **(Claude)** = lựa chọn của Claude, người dùng chưa phản đối nhưng cũng chưa duyệt riêng; không ghi gì = suy ra trực tiếp từ mã hiện có.

## 1. Ý định

Thẻ "Xe máy — Sắp có" ở màn chọn (`index.html` `data-pick="bike"`, khóa `exBike` / `exSoon`) trở thành một chế độ khám phá thật: người xem ngồi lên một chiếc xe tay ga, nghe máy nổ, vặn ga chạy trên chính mạng đường của chế độ Ô tô, nghiêng xe qua khúc rẽ, qua bốn cây cầu và Hầm vượt sông Hàn (phương án đề xuất), ngày, đêm và mưa. **(ND)**

Vì sao: đây là cách người Đà Nẵng thật sự đi trong thành phố; người dùng muốn cảm giác "đang ở đó", vượt hẳn mức "gắn mô hình xe vào camera chạy". Ưu tiên theo thứ tự: nhập vai, chân thực, phản hồi nhanh, ăn khớp với cảnh hiện có. **(ND)**

## 2. Mục tiêu / không làm / thất bại

**Mục tiêu**
1. Thẻ Xe máy mở được; vào bằng thẻ hoặc `?explore=bike`.
2. Góc nhìn thứ nhất là trải nghiệm chính: thấy ghi đông, mặt đồng hồ, gương, hai tay; có góc nhìn thứ ba; đổi qua lại không ngắt chuyến đi. **(ND)**
3. Xe nghiêng khi rẽ, có quán tính, nặng tay ở tốc độ cao, nhạy ở tốc độ thấp; nhún giảm xóc; bánh lăn và bám mặt đường trên dốc cầu. **(ND)**
4. Người lái có xương ngồi đúng tư thế, tay bám ghi đông, chân đặt sàn xe, nghiêng theo xe, phản ứng khi tăng tốc / phanh. **(ND)**
5. Âm thanh nhiều lớp phản hồi theo ga và tốc độ. **(ND)**
6. Ăn khớp ngày / đêm / thời tiết sẵn có; mưa đổi cảm giác lái. **(ND)**
7. Nhiều người: người khác thấy xe + người lái; ngoại tuyến vẫn lái một mình.
8. Máy tính và điện thoại; 9 ngôn ngữ.

**Không làm**
- Không đua, không chọn nhiều xe, không độ xe, không bản đồ mới. **(ND)**
- Không dựng mô phỏng giao thông mới; dùng xe tự động sẵn có. **(ND)**
- Không gương chiếu hậu phản chiếu thật (mỗi gương là một lượt vẽ cảnh) — gương dùng vật liệu phản chiếu trời giả. **(Claude)**
- Không thêm biển báo, vạch qua đường, mũi tên mới trên toàn mạng đường; chỉ tăng chi tiết nhựa đường nhìn gần và mặt đường ướt (§9). **(Claude)**
- Không giọt nước trên kính / màn hình ở góc nhìn thứ nhất. **(Claude)**
- Không ngã xe, không hư hỏng: đâm vật cản thì dừng / trượt dọc như ô tô.
- Không gộp chế độ Ô tô và xe máy thành một khung chung (cách 2 đã loại, §4).

**Thất bại dù chạy được**
- Tay rời ghi đông, bánh lơ lửng hoặc chìm, người lái xuyên thân xe.
- Camera rung gây chóng mặt; đường chân trời lắc theo từng phím.
- Xe quay như một khối cứng (không nghiêng), hoặc đổi tốc độ / hướng tức thời.
- Tiếng máy là một vòng lặp nghe ra ngay, giật khi đổi lớp, còn kêu sau khi thoát.
- Chế độ Ô tô, Dù lượn, Đi dạo, Tour đổi hành vi; góc nhìn cũ tăng lệnh vẽ; chuỗi `rand()` đổi.

## 3. Hiện trạng (đã đọc mã, `main` `a66989b`)

- **Chế độ Ô tô (D-034)** `src/explore/drive/`: `net.ts` + `roadData.ts` (≈ 150 ô mặt đường nhiều tầng, cổng nhịp quay), `solids.ts` + `sceneSolids.ts` (vật cản), `collide.ts` (thân xe chữ nhật 9 điểm mẫu, `drMove` / `drFits` / `drSegClear`), `motion.ts` (mô hình xe đạp động học, `drStep`, sơ tán `drEvacStep`), `camera.ts` (sau xe, kẹp trần hầm), `hud.ts` (đồng hồ DOM, bản đồ nhỏ), `touch.ts`, `keys.ts`, `sound.ts` (2 dao động + còi, cổng `sfxPort` / `extPort`), `car.ts` / `cars.ts` (glb + hình tạm, làm nóng shader), `index.ts` (điều phối, `cam.mode = 'car'`). Kích thước thân xe là hằng số cấp module đọc `CONFIG.drive.car` trong `collide.ts` và `motion.ts`.
- **Người có xương**: Đi dạo `src/explore/stroll/{rig,anim,avatars,char}.ts` với `public/people/p0.glb` (nam) / `p3.glb` (nữ) sau D-039; người treo dù `src/explore/pilot/{rig,ik,react,bones,gear}.ts` (đoạn `sit`, IK hai khớp tay, lò xo phản ứng theo rẽ / tăng giảm tốc / gió, trang bị dựng bằng code thành SkinnedMesh).
- **Nhiều người** `src/explore/multi/`, Worker `server/multi/` (`danang-sky`): ba loại chỗ `fly` / `walk` / `drive`, mỗi loại 5; `join` kind `drive`; `pos` người lái `[slot, x, y, z, yaw, v, st, ts]`; `lobby.drivers`; `ch` (nhân vật) đi theo `join` kind `walk` và `lobby.walkers`.
- **Xe tự động**: `common/trafficQuery.ts` `trNearby()` trả hộp các xe gần; đã có xe tay ga hình khối (`common/vehicles/shapes.ts`).
- **Âm thanh** `src/audio/index.ts`: toàn bộ tổng hợp bằng Web Audio, không có tệp âm thanh hiệu ứng nào; `public/voice/` có mp3 thuyết minh.
- **Chưa có ở đâu**: camera góc nhìn thứ nhất, nghiêng xe, giảm xóc, mặt đường ướt, bụi nước, tiếng theo vị trí.

## 4. Các cách đã cân nhắc

1. **`src/explore/bike/` riêng, dùng lại nền của Ô tô** — _đã chọn_ **(ND)**. Mạng đường, vật cản, va chạm, sơ tán, cần gạt cảm ứng, bản đồ nhỏ dùng nguyên; chỉ thêm tham số "thân xe" cho `collide.ts` / `drEvacStep`. Viết mới: chuyển động có nghiêng, giảm xóc, hai camera, mô hình + người lái, âm thanh, phần HUD riêng. Ô tô gần như không bị đụng.
2. **Gộp Ô tô + xe máy thành khung "phương tiện" chung** — loại: sửa sâu chế độ Ô tô trong khi `test:drive` chưa từng chạy trọn; rủi ro hỏng cái đang chạy.
3. **Chép `drive/` rồi sửa** — loại: hai bản va chạm / mạng đường lệch nhau dần.

Kèm theo, đã duyệt **(ND)**: mô hình ngoài CC BY; người lái Rocketbox theo lựa chọn nam / nữ; dùng chung 5 chỗ lái với Ô tô; tiếng máy bằng đoạn thu CC0, phần còn lại tổng hợp; mưa bằng shader + một lưới hạt, không phản chiếu thật, không đèn mới.

## 5. Xe

### 5.1 Mô hình
- Nguồn **(ND chọn "bạn có thể chọn", Claude chọn)**: "Honda SH 125" của steveconrad82, Sketchfab, CC BY 4.0, 92,3 nghìn tam giác (`https://sketchfab.com/3d-models/honda-sh-125-07e1bc00d26f44958c0fa8062ce94e36`). Dự phòng: "Honda PCX 2023 Scooter" của parchin666, CC BY 4.0, 149,9 nghìn tam giác. **Chưa ai mở lưới**: giấy phép và số tam giác đọc từ trang, phải kiểm lại trên trang lúc tải; cấu trúc lưới (bánh / phuộc / ghi đông có tách được không) chỉ biết khi mở tệp. Người dùng tải tệp nguồn về `scripts/bike/` (Sketchfab cần đăng nhập). SH không tách được ⇒ thử PCX; cả hai không được ⇒ dừng, hỏi người dùng.
- Xử lý: `npm run gen:bike` → `scripts/bike/convert.py` (Blender 4.5 qua `scripts/people/blender.mjs`, mẫu `scripts/car/convert.py`): xóa logo, chữ hãng, biển số; giảm tam giác; tách các nút `body`, `front` (phuộc + ghi đông + chắn bùn trước + gương + cụm đồng hồ, gốc đặt trên trục cổ lái), `wheelF`, `wheelR`; gộp vật liệu về: sơn (màu theo slot như ô tô), nhựa đen, kim loại sáng, kính đèn (emissive), mặt đồng hồ (nhận texture canvas), mặt gương.
- Trần: `public/bike/scooter.glb` ≤ 1,2 MB, ≤ 30 000 tam giác; có test kiểm. **(Claude; ô tô là 0,88 MB / 18 000)**
- Ghi công: `public/bike/LICENSE-Scooter.txt`, README, dòng `#bkCredit` ở màn chọn / sảnh (CC BY buộc ghi tên tác phẩm gốc nên chữ "Honda SH 125" chỉ xuất hiện ở dòng ghi công). Trong giao diện gọi là "Xe máy" / "xe tay ga".
- Hình tạm khi glb chậm / lỗi / quá `CONFIG.bike.model.timeoutMs`: dựng bằng code từ hình xe tay ga sẵn có ở `common/vehicles/shapes.ts`, cùng kích thước va chạm.
- Lệnh vẽ: xe của mình ≤ 6, người lái ≤ 2 (thân + mũ / phụ kiện gộp); xe người khác ≤ 4 kể cả người lái. Chưa có xe máy nào thì +0 ở mọi góc cũ (nhóm chỉ vào cảnh khi có xe, như `drCars`).

### 5.2 Thông số (`CONFIG.bike`, mọi dòng có chú thích tiếng Việt + đơn vị + nguồn hoặc `(ước lượng)`)
Số của Honda SH 125i theo trí nhớ của Claude, **phải đối chiếu nguồn công bố khi lập plan** rồi ghi nguồn: dài 2,090 m, rộng 0,739 m, cao 1,129 m, cơ sở 1,353 m, yên cao 0,799 m, bánh 16 inch (đường kính ngoài ≈ 0,57 m trước / ≈ 0,60 m sau), 134 kg. Ước lượng: `vMax` 25 m/s (90 km/h), 0–50 km/h ≈ 5 s, phanh 7 m/s² (khô), nhả ga 1,2 m/s² (hãm động cơ + ly tâm nhả), nghiêng tối đa 35° khô.

### 5.3 Chuyển động (`src/explore/bike/motion.ts`, không import three, test được bằng Node)
Giữ khung của `drStep`: bước con ≤ `sim.dt`, dời thân bằng `drMove`, mất phần tốc độ hướng vào vật cản, kết quả không phụ thuộc tần số khung, không cấp phát mỗi khung. Khác ô tô ở chỗ **người chơi điều khiển độ nghiêng, không phải góc lái**:
- Trạng thái thêm `lean` (rad, dương = nghiêng trái), `leanV`, `susF` / `susR` (hành trình giảm xóc trước / sau, m), `rpm`, `throttle` đã làm mượt, `sig` (xi nhan −1 / 0 / 1).
- Tốc độ ≥ `vBlend` (≈ 4 m/s): phím trái / phải đặt độ nghiêng đích `±leanMax(v)`; `lean` tiến về đích như hệ lò xo giảm chấn tới hạn với tần số giảm theo tốc độ (nặng tay khi nhanh); tốc độ đổi hướng = `g · tan(lean) / v`. `leanMax(v)` kẹp thêm sao cho bán kính rẽ không nhỏ hơn bán kính hình học.
- Tốc độ thấp: trộn dần sang lái bằng góc lái như mô hình xe đạp động học của ô tô (bán kính quay nhỏ ≈ 2 m), độ nghiêng nhỏ theo `atan(v² κ / g)`. Đứng yên xe thẳng đứng (chống chân không mô phỏng).
- Ga: đường cong tăng tốc kiểu `drAccel` với số của xe máy; ga làm mượt (`throttle`) để không đổi gia tốc tức thời. Phanh tăng dần trong ≈ 0,15 s. Space = phanh gấp (cả hai phanh), không trượt.
- Lùi: xe tay ga không có số lùi. Giữ S khi đã đứng: dắt lùi ≤ 1 m/s (cần để thoát góc kẹt). **(Claude)**
- Vòng tua (cho âm thanh và kim đồng hồ): mô hình hộp số vô cấp — cầm chừng khi đứng; dưới ≈ 12 km/h ly tâm trượt (tua lên theo ga, xe mới nhích); vặn ga thì tua nhảy lên vùng công suất rồi giữ gần đó trong khi tốc độ tăng; nhả ga tua rơi về mức tỉ lệ tốc độ.
- Giảm xóc (chỉ hình + camera, không đổi quỹ đạo): mỗi đầu xe một lò xo giảm chấn; đầu vào là gia tốc dọc (phanh ⇒ chúi đầu, ga ⇒ nhún đuôi), đổi độ dốc tại mối nối ô mặt đường (lên / xuống dốc cầu), và nhiễu mặt đường biên độ nhỏ theo tốc độ từ `rng(seed)` riêng.
- Mưa (`weatherU` / preset thời tiết hiện có): nghiêng tối đa 35° → 27°, phanh 7 → 5,0 m/s² (ước lượng; ban đầu ghi 5,5, hạ ở Task 1 vì cộng hãm nhả ga 1,2 m/s² thì 5,5 không thể cho quãng phanh ướt dài hơn khô ≥ 20 %: trần 1,224, đo 1,194), chuyển mượt theo cường độ mưa. Gió bão đẩy nhẹ độ nghiêng (≤ 2°), không làm mất lái.
- Thân va chạm: chữ nhật dài × rộng của xe máy (không nới theo độ nghiêng **(Claude)**), chiều cao tính cả người lái (≈ 1,7 m) cho vật cản theo cao độ. `collide.ts` và `drEvacStep` nhận kích thước thân qua tham số, mặc định là VF 3; **`test:drive:unit` phải giữ 124/124 không sửa kỳ vọng**.
- Hồi phục: phím R (và nút trên HUD) đặt xe về tim làn gần nhất của ô mặt đường gần nhất, hướng theo chiều làn bên phải, đứng yên. Gợi ý "bấm R" hiện khi xe bị chặn mà vẫn vặn ga quá 3 s. Rơi khỏi mọi ô (dữ liệu sai) ⇒ tự về chỗ xuất phát như ô tô.
- Xuất phát: chỗ của slot như ô tô (`drSpawnPose`), trên Cầu Rồng chiều đi Đông, đi bên phải.
- Xe tự động: như ô tô (mình lao vào thì bị chặn, nó chạy tới thì đi xuyên). Sơ tán nhịp quay Cầu sông Hàn: dùng `drEvacStep` với thân xe máy.

## 6. Người lái (`src/explore/bike/rider.ts` + dùng lại `pilot/ik.ts`, `stroll/rig.ts`)
- Nhân vật: `p0.glb` (nam) / `p3.glb` (nữ) theo lựa chọn ở sảnh, dùng chung bộ chọn và khóa lưu của D-039; vào thẳng `?explore=bike` thì theo lựa chọn đã lưu, mặc định nam.
- Tư thế ngồi: **để người làm quyết** giữa (a) thêm đoạn một khung `ride` vào `p0` / `p3` qua `gen:people` từ nguồn ngồi của Rocketbox (như `sit` của `pilot.glb`), và (b) đặt tư thế nền bằng bảng góc khớp trong code. Tiêu chí chọn: (a) nếu chạy lại `gen:people` cho kết quả tất định và không đổi các đoạn sẵn có (`test:stroll:unit` giữ nguyên); không thì (b).
- IK hai khớp: hai tay tới hai tay nắm (điểm neo là nút con của `front`, nên bẻ lái thì tay theo), hai chân tới sàn để chân. Sai số bàn tay – tay nắm ≤ 2 cm, bàn chân – sàn ≤ 3 cm (test).
- Phản ứng (mẫu `pilot/react.ts`): thân trên nghiêng theo xe nhưng đầu giữ thẳng hơn (≈ 60 % độ nghiêng), ngả sau khi tăng tốc, chúi trước khi phanh, nhún theo giảm xóc; biên độ nhỏ, có lò xo.
- Mũ bảo hiểm nửa đầu dựng bằng code, gắn xương đầu (luật Việt Nam; cũng che tóc xuyên camera). **(Claude)**
- Góc nhìn thứ nhất: ẩn đầu + mũ của chính mình (thu xương đầu về scale ≈ 0), giữ thân, tay.
- Ban đêm người lái không được đen kịt (hạn chế đã biết của người treo dù): kiểm bằng ảnh.

## 7. Camera (`src/explore/bike/camera.ts`)
- **Thứ nhất (mặc định) (ND)**: điểm mắt là một điểm cố định trong hệ thân xe (trên yên ≈ 0,75 m, lùi sau cổ lái), không lấy từ xương đầu (tránh rung theo hoạt ảnh). Cao mắt so với mặt đường ≈ 1,45 m. `fov` ≈ 75° (ước lượng), mặt cắt gần hạ đủ để không cắt ghi đông (≈ 0,1 m; `stop()` trả lại giá trị cũ cùng `fov`).
  - Cuộn theo ≈ 60 % độ nghiêng xe (đầu người giữ thăng bằng), có lò xo; chúi / ngửa theo giảm xóc với hệ số < 1; rung mặt đường biên độ ≤ 1 cm và chỉ tăng nhẹ theo tốc độ; lùi nhẹ khi tăng tốc, dồn trước khi phanh (≤ 4 cm).
  - Kéo chuột / vuốt: nhìn quanh ±120° ngang, −40°..+30° dọc, thôi kéo thì tự về như `drCamDrag`.
  - Một hệ số `CONFIG.bike.cam.motion` (0..1) nhân mọi chuyển động phụ; `prefers-reduced-motion` ⇒ 0,3.
- **Thứ ba**: `drCamPlace` với bộ số của xe máy (gần và thấp hơn ô tô), nhận bộ số qua tham số thay vì đọc cứng `CONFIG.drive.cam`; giữ cắt theo vật cản và kẹp trần hầm. Cuộn theo ≈ 20 % độ nghiêng.
- Đổi góc nhìn: phím V / nút HUD; trộn vị trí + hướng trong ≈ 0,4 s, không dừng xe. Chế độ xem người khác luôn là thứ ba.
- Trong hầm và dưới gầm cầu, góc thứ nhất không cần cắt vật cản (camera nằm trong thân va chạm).

## 8. Âm thanh (`src/explore/bike/sound.ts`, dùng `audio.sfxPort()` / `extPort()` và nút 🔊 như ô tô)
- **Máy** **(ND)**: 3 đoạn thu CC0 (cầm chừng, tua thấp có tải, tua cao có tải) giải mã thành `AudioBuffer`, phát lặp có điểm lặp, trộn chéo theo `rpm` + `throttle`, `playbackRate` theo `rpm` trong ±20 % quanh tua gốc của mỗi đoạn. Tiếng đề máy khi vào, tắt máy khi thoát. Nguồn (ví dụ Freesound lọc CC0) do người làm tìm; **người dùng nghe duyệt** trước khi commit. Trần: tổng ≤ 400 kB, đặt ở `public/bike/snd/` kèm `LICENSE-Sounds.txt`. Tải lười khi vào chế độ; chưa về / lỗi ⇒ máy tổng hợp (răng cưa + nhiễu qua lọc) để không bao giờ câm.
- **Tổng hợp**: lốp (nhiễu lọc theo |v|), gió (nhiễu dải thông theo v², to hơn ở góc thứ nhất), phanh (rít nhẹ khi phanh mạnh ở tốc độ cao), giảm xóc (tiếng "cụp" nhỏ khi hành trình vượt ngưỡng), xi nhan (tích tắc), còi (hai nốt, cao hơn còi ô tô), mưa trên mũ khi trời mưa.
- **Theo vị trí**: tối đa 3 giọng cho xe tự động gần nhất từ `trNearby` (âm lượng theo khoảng cách, `StereoPannerNode` theo hướng tương đối, cao độ theo tốc độ tương đối); nền thành phố và nền sông trộn theo khoảng cách tới mép kè |x| = 262; trên cầu tăng gió. Trong ô `tunnel`: bật nhánh vọng (trễ có hồi tiếp qua lọc), chuyển mượt ≈ 0,5 s.
- Mọi tham số ghi tối đa mỗi `sound.updateMs`; `stop()` dừng và ngắt mọi nút, thả cổng riêng; vào lại không nhân đôi (test đếm nút sống).
- Không trần âm lượng nào vượt mức mô tơ ô tô hiện tại quá 6 dB; có nén (`DynamicsCompressorNode`) ở đầu ra riêng của chế độ để không vọt tiếng.

## 9. Ngày / đêm / mưa
- **Đèn**: không thêm `PointLight` / `SpotLight` (bất biến 5). Đèn pha, đèn hậu, đèn phanh, xi nhan là emissive đọc `shared.uNight` / trạng thái xe; đèn pha luôn bật (xe đời mới), sáng hơn về đêm. Vệt đèn pha trên mặt đường: một tấm cộng màu (texture canvas) bám mặt đường trước xe, chỉ hiện khi `uNight` > ngưỡng, lớp 1 / `noReflect`, +1 lệnh vẽ ban đêm. **(Claude)**
- **Mặt đồng hồ**: texture canvas (kim tốc độ theo `v` thật, kim tua, đèn xi nhan), vẽ lại tối đa 10 lần/giây, tự sáng ban đêm.
- **Gương**: vật liệu kim loại nhẵn nhận màu trời hiện tại (ngày xanh, đêm tối + ánh đèn ấm), không vẽ lại cảnh.
- **Mặt đường nhìn gần + ướt**: một hàm vá shader dùng chung (`onBeforeCompile`, mẫu các vật liệu đang đọc `shared`) áp cho các vật liệu mặt đường mà người lái chạy trên (danh sách do người làm lập khi đọc `driveRoadGeo.ts`, `streets.ts`, mặt cầu, `han-tunnel/materials.ts`): (1) hạt nhựa đường mịn theo tọa độ thế giới, mờ dần theo khoảng cách; (2) khi mưa: tối màu, giảm nhám, vệt sáng kéo dọc dưới đèn đường về đêm (cùng ý tưởng vệt trên sông D-023, không phản chiếu thật), hầm không ướt. Điều kiện: +0 lệnh vẽ, số program không tăng ở `test:perf -- --strict`, góc cũ ban ngày trời khô nhìn từ xa không đổi thấy được. **Đây là phần rủi ro nhất** (đụng vật liệu dùng chung): làm thành mốc riêng, có cờ `CONFIG.bike.road.detail` / `wet` tắt được, và bỏ được mà không ảnh hưởng phần còn lại.
- **Bụi nước bánh xe**: một lưới hạt (một lệnh vẽ, chỉ khi mưa và v > ngưỡng), số hạt theo tốc độ × cường độ mưa, ngẫu nhiên từ `rng(seed)` riêng.
- Hạt mưa, sấm, gió: của hệ thời tiết sẵn có, không đổi. Bão: vẫn lái được; xe tự động theo luật sẵn có.
- Cầu Rồng phun, cầu quay ban đêm: `exNightStep(dt, false)` như ô tô.

## 10. Điều khiển, HUD, i18n
- Phím (theo `e.code`, cùng quy tắc bỏ ô nhập / tổ hợp / nhả khi blur của `drive/keys.ts`): W / ↑ ga · S / ↓ phanh (đứng yên: dắt lùi) · A / ← , D / → nghiêng rẽ · Space phanh gấp · H còi · V đổi góc nhìn · Q / E xi nhan trái / phải (tự tắt sau khi rẽ xong hoặc bấm lại) · R về làn · Esc thoát (qua `explore.exit()`). Người làm kiểm V / Q / E / R không trùng phím đang dùng trong chế độ khám phá; trùng thì đổi và ghi vào spec.
- Cảm ứng: dùng lại bố cục và mã `drive/touch.ts` (cần gạt ngang, GA, PHANH, vuốt nhìn) + nút đổi góc nhìn, còi, về làn, 🔊, Thoát; tôn trọng vùng an toàn; kiểm bằng `test:mobile`.
- HUD: dùng lại khung `#drHud` (đồng hồ số km/h, bản đồ nhỏ có chú thích Hầm "phương án đề xuất", gợi ý phím tự ẩn) với lớp `body.bike` bật phần riêng: đèn xi nhan, nút góc nhìn. Đồng hồ DOM giữ ở cả hai góc nhìn (mặt đồng hồ 3D nhỏ, khó đọc trên điện thoại).
- i18n: khóa mới tiền tố `bk*` đủ 9 ngôn ngữ; `exBike` giữ; bỏ ghi chú `exSoon` khỏi thẻ (khóa `exSoon` để lại nếu còn chỗ khác dùng, không thì xóa đủ 9 tệp).
- Mã: tiền tố hàm `bk*`; `cam.mode = 'bike'`; `ExChoice` thêm `'bike'`; `main.ts` gọi `bike.update(dt)` cạnh `drive.update(dt)`; `window.__app.bike` khi `?test` (có `step(dt, inp)`, `placeAt`).

## 11. Nhiều người
- Dùng chung 5 chỗ kind `drive` với Ô tô **(ND)**. `join` thêm `veh` (0 ô tô — mặc định khi vắng, 1 xe máy) và `ch` (nhân vật, như kind `walk`); máy chủ giữ theo slot (cả qua hibernation, như `ch` của D-039) và phát trong `lobby.drivers`; `joined` vọng lại `veh`.
- `pos` người lái giữ nguyên dạng `[slot, x, y, z, yaw, v, st, ts]`; với xe máy `st` mang độ nghiêng (rad) thay cho góc lái. Người làm kiểm khoảng kẹp `st` ở Worker có chứa ±0,7 rad.
- Tương thích: máy chủ cũ (không vọng `veh` trong `joined`) ⇒ khách rời chỗ và lái một mình, như quy tắc "máy chủ cũ không gửi `drivers`". Khách cũ thấy người đi xe máy thành một chiếc ô tô cho tới khi tải lại trang (chấp nhận).
- Hiển thị: `remoteDrive.ts` chọn hình theo `veh`; xe máy người khác = glb + người lái có xương ở tư thế ngồi, nghiêng theo `st`, không IK chân / phản ứng (rẻ), điện thoại dùng hình tạm. Nhãn tên trên đầu người lái; chấm trên bản đồ nhỏ như ô tô. Không va chạm với nhau.
- Sảnh: thẻ Xe máy mở sảnh lái (đếm chung "n/5" với ô tô) kèm bộ chọn nam / nữ; hết chỗ ⇒ xem (camera thứ ba bám xe đang xem, ô tô hay xe máy). Rời máy, mất kết nối, lời mời: như ô tô.
- Thoát: `leave` + gỡ xe + người lái của mình; không để lại hình mồ côi (test hai trình duyệt).
- **Deploy Worker `danang-sky` phải hỏi người dùng riêng**; trước đó xe máy chạy một mình.

## 12. Ràng buộc dự án (nhắc lại chỗ dễ vi phạm)
- Không thêm / bớt lời gọi `rand()`, không đổi thứ tự `build*()`; ngẫu nhiên mới dùng `rng(seed)`.
- Góc nhìn cũ +0 lệnh vẽ; mọi thứ của xe máy chỉ vào cảnh khi vào chế độ.
- Mọi số ở `src/config.ts` (`CONFIG.bike`), chú thích tiếng Việt, đơn vị, nguồn / `(ước lượng)`.
- Không thư viện runtime mới; glb nạp bằng `GLTFLoader` sẵn có; âm thanh bằng Web Audio.
- Mỗi khung không cấp phát (D-018); shader mới làm nóng trước như `drCarSetWarm` (hai biến thể ngày / đêm).
- Hầm vượt sông Hàn luôn ghi "phương án đề xuất".
- Tệp âm thanh ngoài: mở rộng tinh thần D-033 (giấy phép cho phân phối lại, tệp `LICENSE-*`, trần dung lượng, đường lùi) sang âm thanh; ghi thành D-040 trong `decisions.md`.

## 13. Kiểm tra
- `npm run test:bike:unit` (Node, nhanh): đường cong tăng tốc (0–50 km/h, `vMax`); nghiêng ổn định = `atan(v² / (g·R))`; đáp ứng chậm dần theo tốc độ; quãng phanh khô / mưa; dắt lùi; không phụ thuộc tần số khung; mô hình vòng tua; xi nhan tự tắt; thân va chạm tham số (ô tô không đổi); toán camera (điểm mắt, tỉ lệ cuộn, trộn góc nhìn); định tuyến âm thanh + đếm nút sau `stop()` (ngữ cảnh giả); `scooter.glb` (trần dung lượng / tam giác, đủ nút, không còn lưới logo / biển số theo tên, tệp giấy phép, ghi công); IK tay / chân trong sai số; `veh` / `ch` trong giao thức; đủ khóa `bk*` ở 9 ngôn ngữ.
- `npm run test:bike` (trình duyệt, đọc `dist/`): vào bằng thẻ và `?explore=bike`; xuất phát trên mặt đường; lái theo kịch bản (`__app.bike.step`) qua 4 cầu + 2 ống hầm; đâm lan can / tường hầm không xuyên; bánh cách mặt đường ≤ 2 cm trên dốc; barie + sơ tán Cầu sông Hàn; đổi góc nhìn; tay – tay nắm ≤ 2 cm khi bẻ lái hết cỡ; đèn ngày / đêm / phanh / xi nhan; mưa (ma sát, bụi nước hiện / ẩn); chặn / làm chậm `scooter.glb` và tệp âm thanh (đường lùi); HUD 9 ngôn ngữ; lệnh vẽ trong ngân sách §5.1; thoát rồi vào lại 3 lần: số bộ nghe, nút âm thanh, lưới trong cảnh không tăng; sau khi thoát: Ô tô, Đi dạo, Dù lượn vào được (khói).
- Hồi quy đơn vị mỗi mốc: `typecheck`, `test:drive:unit` (124/124), `test:multi:unit`, `test:stroll:unit`, `test:pilot:unit`, `test:people:unit`; `test:multi:worker` khi đổi Worker.
- Test nặng chạy **một lần cuối nhánh** (quy ước của người dùng): `test:drive`, `test:mobile`, `test:multi`, `test:explore`, `test:stroll`, `test:drawcalls` (góc cũ +0), `test:perf -- --strict` (+0 program ở thao tác cũ), `test:gpu` (so với `main`, ghi `tests/KET-QUA.md`).
- Duyệt bằng mắt / tai trên GPU thật (người dùng, `npm run dev`) sau các mốc: lái được ở góc thứ ba; mô hình + người lái + góc thứ nhất; âm thanh; đêm + mưa.

## 14. Thứ tự mốc (cho plan)
1. Nền: thân va chạm tham số, `bike/motion.ts`, camera thứ ba, hình tạm, mở thẻ + `?explore=bike` (một mình) → **demo 1**.
2. Mô hình (`gen:bike`) + người lái + IK.
3. Camera thứ nhất, mặt đồng hồ, giảm xóc, đổi góc nhìn → **demo 2**.
4. Âm thanh → **demo 3 (nghe)**.
5. Đêm (đèn, vệt pha) + mưa (ma sát, bụi nước) ; rồi mốc riêng "mặt đường nhìn gần + ướt" → **demo 4**.
6. HUD, cảm ứng, i18n.
7. Nhiều người + Worker (deploy hỏi riêng).
8. Test trình duyệt, test nặng một lượt, tài liệu (README Cấu trúc, `copilot-instructions.md` §5 thêm lệnh, memory bank, `decisions.md` D-040).

Tiến độ giữa các phiên: ô đánh dấu trong plan `docs/superpowers/plans/2026-11-14-xe-may.md` + `.github/memory-bank/activeContext.md` (không tạo thêm tệp tiến độ riêng).

## 15. Để người làm quyết
- Tư thế ngồi: đoạn `ride` trong glb hay bảng góc khớp (§6).
- Chi tiết mô hình toán của lò xo nghiêng / giảm xóc, miễn đạt test §13 và cảm giác được duyệt ở demo.
- Tên / bố cục tệp trong `src/explore/bike/`, mức dùng lại `drive/hud.ts` so với viết phần riêng.
- Nguồn cụ thể của 3 đoạn thu máy (CC0), cách cắt điểm lặp.
- Danh sách vật liệu mặt đường được vá shader.
- Mọi số `(ước lượng)` trong `CONFIG.bike`, chỉnh sau từng demo.

## 16. Nguồn
- Mô hình: Sketchfab, hai đường dẫn ở §5.1 (đọc trang 2026-11-14 qua công cụ tóm tắt, chưa tải).
- Mã: `src/explore/drive/*`, `src/explore/pilot/*`, `src/explore/stroll/*`, `src/explore/multi/protocol.ts`, `src/explore/chooser.ts`, `src/config.ts` (`driveBase`) tại `main` `a66989b`.
- Spec tham chiếu: `2026-11-12-lai-xe-oto-design.md`, `2026-11-12-nguoi-du-luon-that-design.md`.

## 17. Sửa đổi sau khi reviewer đọc + chỉ thị "tự quyết, không hỏi lại tới bản demo cuối" (ND, 2026-11-14)

Người dùng bảo Claude tự quyết và làm tới bản demo cuối, ghi vấn đề lại để hỏi sau. Các mục dưới đây **thay** chỗ tương ứng ở trên; tất cả là **(Claude)**, chưa được duyệt riêng. Danh sách cần hỏi lại ở §18.

1. **Mô hình (thay §5.1):** dùng "Motor Scooter" của Grab3D (`https://grab3d.com/models/vehicles/scooter/`, CC0 1.0, tải không cần đăng nhập, 19 290 tam giác, 1,30 MB, không nhãn hiệu, biển số trống; dựng bằng script Blender, không có hình học / texture do AI sinh, theo `LICENSE.txt` của gói). Lý do: SH 125 / PCX trên Sketchfab cần đăng nhập mới tải được. Tệp nguồn + `LICENSE.txt` + `manifest.json` ở `scripts/bike/src/`. Kiểu dáng cách điệu (xe tay ga cổ điển kiểu Ý, màu bạc hà), **không đạt mức "rất thật"** người dùng muốn: ghi ở §18. Cấu trúc nguồn: nút `scooter_body` (1 primitive, texture nướng), `scooter_steering` (6 primitive; gốc trên trục cổ lái nghiêng 22°, trục quay glTF (0, 0,927, −0,375), khóa lái ±30°), `scooter_wheel_front` / `_rear` (3 primitive mỗi bánh, gốc ở trục, lăn quanh X cục bộ, bán kính 0,22 m), mũi xe +Z glTF, cơ sở 1,32 m, bao 0,737 × 1,978 × 1,377 m. `gen:bike` (Blender): đổi mũi về +X, gộp primitive (cổ lái → 1 lưới màu đỉnh + 1 lưới mặt đèn; mỗi bánh → 1 lưới), ảnh ≤ 1024 px, thêm lưới nhỏ đèn hậu / xi nhan / mặt đồng hồ nếu nguồn không có vật liệu riêng. Trần glb 1,0 MB. Không đổi màu theo slot (màu sơn nằm trong texture nướng); người chơi phân biệt bằng nhãn tên. Ghi nguồn trong README + `public/bike/LICENSE-Scooter.txt` (CC0 không buộc ghi công, vẫn ghi); không cần dòng `#bkCredit`.
2. **Thông số (thay §5.2):** kích thước va chạm và hình theo mô hình đang dùng (dài 1,98, rộng 0,74, cơ sở 1,32, bánh 0,44 m), không theo SH 125i. Hiệu năng giữ ước lượng xe tay ga 110–125 cc.
3. **Mặt đường ướt (sửa §3, §9):** đã có sẵn `src/environment/weather/wetness.ts` (tối màu ×0,65, nhám về 0,25 theo `uWet`, đăng ký `MAT.road`, `MAT.road2`, `MAT.paver`, `MAT.stone` và `road` của ba cầu). Không làm lại. Việc mới: (a) đăng ký thêm `roadOut` của hầm (dốc hở); (b) hạt nhựa nhìn gần + vệt sáng đêm khi ướt, viết **nối** vào hook sẵn có (`MAT.road` / `MAT.road2` đã có `onBeforeCompile` của ảo ảnh mùa hè ở `weather/summer.ts`; một vật liệu chỉ có một hook), cường độ qua một uniform dùng chung = 0 ngoài chế độ xe máy ⇒ góc cũ không đổi điểm ảnh, số program không tăng. Vẫn là mốc riêng, bỏ được.
4. **Độ nghiêng qua mạng (sửa §11):** Worker kẹp `st` ở ±`steerMax` = ±0,56 rad (`server/multi/src/room.ts`, `multi/params.ts`, có test ghim). Không đổi số đó: xe máy gửi `st = lean × 0,8`, bên nhận chia lại. Khách cũ thấy xe máy thành ô tô bẻ lái: chấp nhận.
5. **Mặt cắt gần (sửa §7):** camera chính `near` 0,5 (`core/renderer.ts`), không có depth logarit. Góc thứ nhất dùng `near` 0,2 (vật gần mắt nhất ≈ 0,35 m), góc thứ ba giữ 0,5; `fov` thứ nhất 75°, thứ ba như ô tô; trộn góc nhìn nội suy cả `fov` và `near`, gọi `onResize()`; `stop()` trả cả hai. Kiểm bằng ảnh: mặt nước / vạch đường xa không nhấp nháy ở góc thứ nhất.
6. **Chọn nhân vật (sửa §6, §11):** dùng chung khóa `localStorage` `stChar` với Đi dạo (đổi ở sảnh xe máy cũng đổi nhân vật đi dạo). Bộ chọn chỉ hiện ở sảnh (có máy chủ); một mình / ngoại tuyến / `?explore=bike` dùng giá trị đã lưu. Máy chủ hiện ép `ch: 0` cho chỗ lái: `veh` + `ch` cho kind `drive` là việc mới ở cả Worker (kể cả attachment qua hibernation) lẫn khách.
7. **Sảnh chung ô tô + xe máy (sửa §11):** danh sách người lái ghi biểu tượng loại xe; `joined` vọng `veh`; người xem nhận lời mời thì lên loại xe của thẻ đã chọn; người xem chạy module của thẻ đã chọn, hình xe người khác (cả hai loại) do `multi/remoteDrive.ts` dựng nên module nào cũng thấy đủ.
8. **Tham số thân xe (bổ sung §5.3):** hằng số đọc `CONFIG.drive.car` nằm ở `drive/collide.ts` (`HL`, `HW`, `AX`, `REACH`), `drive/motion.ts`, `drive/car.ts`, `multi/labels.ts`, `multi/remoteDrive.ts`; `drCamPlace` / `drCamDrag` đọc cứng `CONFIG.drive.cam` và giữ trạng thái module `cs`. Tất cả nhận tham số, mặc định là ô tô. Chiều cao thân trong `drFits`: người lập plan đọc mã rồi quyết.
9. **Bám đường khi mưa (bổ sung §5.3):** `motion.ts` nhận `grip` (0..1) qua đầu vào, không tự đọc thời tiết (test tất định). `index.ts` tính từ `weatherU.uWet` (trễ theo mưa), = khô khi xe trong ô `tunnel` kín.
10. **Tư thế ngồi (chốt §6):** bảng góc khớp trong code + IK (cách b); không chạy lại `gen:people`.
11. **Âm thanh máy (sửa §8):** Freesound và các kho CC0 tương tự cần đăng nhập để tải, nên bản này làm **máy tổng hợp nhiều lớp** làm chính (chuỗi hài theo tần số nổ của máy một xi lanh bốn kỳ qua `PeriodicWave`, điều biên theo nhịp nổ, nhiễu nạp / xả qua lọc theo ga, tiếng dây đai vô cấp), không có tệp âm thanh. Đường nạp đoạn thu (`decodeAudioData`, mp3 với `loopStart` / `loopEnd` nằm trong đoạn để tránh khoảng lặng đầu cuối) để lại làm nâng cấp khi có tệp. Khác với điều người dùng đã duyệt (đoạn thu thật): ghi ở §18.
12. **Phím (chốt §10):** V và R chưa dùng ở đâu; Q / E chỉ là ga dù lượn và bộ nghe đó bỏ qua khi ở chế độ lái ⇒ giữ nguyên bảng phím.

## 18. Cần hỏi người dùng ở bản demo cuối (cập nhật theo thực tế, 2026-11-14, Task 12)
1. Mô hình cách điệu của Grab3D có chấp nhận không, hay người dùng tải SH 125 / PCX (cần tài khoản Sketchfab, CC BY ⇒ phải thêm dòng ghi công) để thay (đường `gen:bike` phải sửa cho mô hình mới).
2. Tiếng máy tổng hợp có đủ không, hay người dùng cung cấp đoạn thu CC0. **Chưa ai nghe** tiếng máy / còi / các lớp khác.
3. Mức trộn các lớp âm thanh (`CONFIG.bike.sound`): toàn ước lượng, cần nghe để chỉnh.
4. Deploy Worker `danang-sky` (chưa deploy thì xe máy chỉ chạy một mình: máy chủ cũ không vọng `veh` ⇒ khách trả chỗ, lái một mình).
5. Hạt nhựa + vệt đèn khi ướt có nên bật cả ở các chế độ khác (hiện chỉ khi lái xe máy, `shared.uRoadNear`).
6. Các số `(ước lượng)` của `CONFIG.bike` sau khi lái thử.
7. Mặt cắt gần góc thứ nhất là **0,55** (không phải 0,2 như §17.5): cắt bỏ thân trên người lái khỏi khung (vai / cổ áo ở độ sâu < 0,5 m; gương ≥ 0,67, đồng hồ ≥ 0,69, tay nắm ≥ 0,72 m), không nhấp nháy trên ảnh SwiftShader; đổi lại **tay trái bị cắt** khi bẻ hết lái trái ở tốc độ đi bộ. Mắt đo từ xương mắt nhân vật (cao 1,72 m nam / 1,63 m nữ, không phải ≈ 1,45 m của §7 vì yên mô hình cao 0,85 m), `back` 0,41, `tilt` −0,26.
8. Lệnh vẽ: xe của mình ≈ 15 (mô hình 10 primitive + bóng 1 + người lái 4) thay cho ≤ 6 + 2 của §5.1 (chỉ trong chế độ xe máy). Xe máy người khác là **hình tạm dựng bằng code** (xe + người khối đội mũ) + bóng = 2 lệnh vẽ trên mọi máy, thay cho "glb + người lái có xương" của §11, để giữ trần ≤ 4; phương án đẹp hơn: một glb low-poly gộp không người có xương.
9. Bản dịch khóa `bk*` + `exBikeDesc` ở 8 ngôn ngữ cần người bản ngữ duyệt.
10. Chạy bộ test nặng (`test:drive`, `test:mobile` có mục 8 xe máy mới, `test:explore`, `test:stroll`, `test:multi`, `test:drawcalls`, `test:perf -- --strict`, `test:gpu`) và cho `test:bike` chạy trọn: lượt dở duy nhất có mục 4 LỖI (sơ tán nhịp quay xong sau 4,7 s mô phỏng so với ≤ 1 s mong đợi; lái 90 km/h vào barie còn v 2,81 m/s so với < 0,5), chưa phân tích lỗi test hay lỗi sản phẩm (`drEvacStep` vẫn dùng cỡ ô tô, §5.3 "với thân xe máy" chưa làm).

Lệch khác so với phần trên, đã làm khi triển khai (chi tiết ở `decisions.md` D-040 và nhật ký plan): tiếng máy hoàn toàn tổng hợp, không đường nạp đoạn thu; giọng xe gần không đổi cao độ theo tốc độ tương đối, chưa có "tăng gió trên cầu" (§8); người lái 4 lệnh vẽ (Rocketbox 3 primitive + mũ); mặt đường: 6 vật liệu được vá (`MAT.road`, `MAT.road2`, `road` ba cầu, `roadOut`), `roadIn` không vá, mặt cầu + `roadOut` dùng chung hook / khóa program của `MAT.road2` (+0 program); vệt ướt là hoa văn theo góc quanh camera, không bám vị trí đèn thật, hiện cả dưới gầm cầu; gương dùng nguyên vật liệu `mirror` của glb, không có mã đổi màu theo trời như §9 ghi (ảnh từ yên: mặt gương xanh xám ban ngày, tối ban đêm); không có dòng ghi công `#bkCredit` (CC0).

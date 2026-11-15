# Siêu anh hùng nguyên bản thay người thường ở Đi dạo và Xe máy (D-048)

_2026-11-15 · nhánh `feature/nhan-vat-sieu-anh-hung` (worktree `.worktrees/sieu-anh-hung`, từ `main` `e5c498f`) · trạng thái: đã triển khai trên nhánh (Task 1–4), chờ người dùng duyệt demo; chưa mở PR_

Bản yêu cầu gốc của người dùng ("Project enhancement: replace player avatar with Spider-Man", 2026-11-15) muốn người chơi khám phá Đà Nẵng trong vai Người Nhện ở hai chế độ Đi dạo và Xe máy. Spec này ghi lại vì sao hướng đó đổi thành **siêu anh hùng nguyên bản**, và thiết kế đã chốt cùng người dùng.

## 1. Ý định

- Người chơi ở **Đi dạo** và **Xe máy** thấy mình (và người khác thấy họ) là một siêu anh hùng đeo mặt nạ thay cho người thường. Mục tiêu là cảm giác "đang khám phá Đà Nẵng như một siêu anh hùng".
- Nhân vật phải đi / chạy / đứng tự nhiên như bây giờ, ngồi xe máy đúng tư thế (tay trên tay nắm, chân trên sàn), không trôi, không trượt, không méo khớp.
- Mọi máy trong phòng phải thấy cùng một người bằng cùng một nhân vật, kể cả người vào sau và người kết nối lại.

## 2. Vì sao không phải Người Nhện (kết quả tìm tài nguyên)

**Không tìm được mô hình Người Nhện nào dùng hợp pháp được trên trang công khai và trong repo công khai.** Người dùng đã đọc kết quả này và chọn hướng B (siêu anh hùng nguyên bản), 2026-11-15.

Đã tìm ở Sketchfab, CGTrader, RenderHub và tìm chung trên web (2026-11-15). Chi tiết:

- Không có nguồn nào do Marvel / Disney phát hành hoặc cấp phép cho dùng trên web. Mọi kết quả đều là sản phẩm người hâm mộ đăng ở chợ mô hình.
- Giấy phép mà người tải lên chọn (CC, Royalty Free, Extended Use) chỉ áp cho **file mô hình** của họ, không cho **nhân vật**. Điều khoản Sketchfab đặt trách nhiệm về quyền bên thứ ba lên người tải lên, và cấm dùng tài nguyên vi phạm quyền sở hữu trí tuệ của bên khác. RenderHub ghi rõ giấy phép là "IP Restricted".
- Có mô hình lấy ra từ game (Marvel vs Capcom Infinite trên CGTrader) mà vẫn dán nhãn "Royalty Free". Bản yêu cầu cấm rõ loại này.
- Ràng buộc của dự án: bất biến số 5 (`copilot-instructions.md`) đòi giấy phép "cho để trong repo công khai và phân phối lại". Trang chạy công khai trên Netlify và có nút ủng hộ (D-021).
- Người dùng hỏi "tôi tải về được không". Câu trả lời: việc tải về không đổi quyền với nhân vật. Lựa chọn "chỉ xem riêng trên máy, không commit, không deploy" nằm ngoài spec này.

Bảng so sánh. Ô "chưa xác minh" là thông tin không mở trang để đọc. Không ô nào là số bịa.

| Tiêu chí | Sketchfab "spider man" (e7a0ffa3…) | Sketchfab "spider-man miles morales" (ef158f7a…) | CGTrader "rigged spider man 3d model" | CGTrader "spider man from marvel vs capcom infinite" | RenderHub "Spider-Man MCU Suit Rigged and Game Ready" | **Chọn: Rocketbox `Male_Adult_10` / `Female_Adult_03` vẽ lại thành siêu anh hùng nguyên bản** |
|---|---|---|---|---|---|---|
| Nguồn | https://sketchfab.com/3d-models/spider-man-e7a0ffa3e3174634bdb1edc08ac0bd7c | https://sketchfab.com/3d-models/spider-man-miles-morales-ef158f7af4de4246baa9651bcb1965d2 | https://www.cgtrader.com/3d-models/character/fantasy-character/rigged-spider-man-3d-model | https://www.cgtrader.com/free-3d-models/character/man/spider-man-from-marvel-vs-capcom-infinite | https://www.renderhub.com/mustafamohmmed/spider-man-mcu-suit-rigged-and-game-ready-3d-model | https://github.com/microsoft/Microsoft-Rocketbox (commit ghim `0943055`, như `convert.py`) |
| Người làm | chưa xác minh | chưa xác minh | chưa xác minh | chưa xác minh | `mustafamohmmed` (theo URL) | Microsoft (Rocketbox) |
| Giấy phép file | chưa xác minh | chưa xác minh | chưa xác minh (kết quả tìm ghi "Royalty Free No AI") | "Royalty Free" theo kết quả tìm, nhưng mô tả ghi mọi quyền thuộc Marvel và Capcom | "Extended Use License (IP Restricted)" theo kết quả tìm | MIT (`public/people/LICENSE-Rocketbox.txt`) |
| Quyền nhân vật | không có: nhân vật thuộc Marvel | không có | không có | không có, là đồ lấy từ game | không có ("IP Restricted") | thiết kế bộ đồ nguyên bản của dự án |
| Định dạng | chưa xác minh | chưa xác minh | chưa xác minh | chưa xác minh | chưa xác minh | FBX + TGA nguồn → GLB (đường `gen:people` đã có) |
| Có xương | chưa xác minh | chưa xác minh | có (theo tên) | chưa xác minh | có (theo tên) | có, `Bip01_*`, ≥ 50 khớp, đã chạy trong dự án |
| Chuyển động | chưa xác minh | chưa xác minh | chưa xác minh | chưa xác minh | chưa xác minh | `idle`, `walk`, `jog`, `sprint`, `photo` (thu từ người thật, đã nướng) |
| Số tam giác / texture | chưa xác minh | chưa xác minh | chưa xác minh | chưa xác minh | chưa xác minh | như `p0` / `p3` hiện tại (texture 1024 thân / 512 đầu); `p0.glb` 1 106 536 B, `p3.glb` 1 423 620 B |
| Hợp Đi dạo | — | — | — | — | — | Cao: dùng y nguyên bộ trộn đoạn `stClipMix` |
| Hợp Xe máy | — | — | — | — | — | Cao: dùng y nguyên bảng góc khớp + IK của `BkRider` (đòi tên xương `Bip01`) |
| Hợp hiệu năng | — | — | — | — | — | Cao: bỏ được primitive alpha (tóc / mi), bớt 1 lệnh vẽ mỗi nhân vật |
| Khuyến nghị | Không | Không | Không | Không, cấm hẳn | Không | **Chọn** |

Hướng A (bản Người Nhện có giấy phép chính thức) chỉ mở lại khi người dùng có thỏa thuận cấp phép với Marvel / Disney. Spec này không làm hướng đó.

## 3. Mục tiêu, không làm, phản mục tiêu

**Mục tiêu**
- Hai siêu anh hùng nguyên bản, gắn vào ô chọn Nam / Nữ đang có (D-039):
  - **Nam: "Dây Cầu Phát Sáng"** (người dùng chọn phác thảo C). Bộ đồ xanh lam, mảng đỏ ở ngực và mặt trước đùi. Các đường chỉ thẳng màu xanh băng xòe từ cổ áo xuống thân như dây văng cầu Thuận Phước. Biểu tượng hình thoi (tháp cầu) giữa ngực. Mặt nạ kín, kính chữ T màu xanh băng. Ban đêm các đường chỉ và kính phát sáng.
  - **Nữ: "Sóng Biển Đà Nẵng"** (người dùng chọn phác thảo B). Bộ đồ xanh hải quân. Hai dải sóng đỏ chéo từ vai xuống hông đối diện, viền trắng ngà mảnh. Biểu tượng là vòng tròn ba con sóng giữa ngực. Mặt nạ kín, hai kính hổ phách nhỏ góc cạnh.
  - Hai bộ dùng chung bảng màu đỏ / xanh nhưng khác hẳn nhau. Người dùng chọn kết hợp "nam C, nữ B".
- Đi dạo: đứng, đi, chạy bộ, chạy nhanh, chụp ảnh như hiện nay, vì cùng năm đoạn chuyển động và cùng bộ trộn.
- Xe máy: ngồi xe bằng đúng hệ bảng góc khớp + IK tay / chân + lò xo phản ứng đang có.
- Nhiều người: mình, người khác, người vào sau, kết nối lại, đổi giữa Đi dạo và Xe máy đều thấy đúng anh hùng. Không đổi giao thức, không đổi máy chủ, không deploy Worker.

**Không làm**
- Không đổi Dù lượn (người treo `pilot.glb`), Ô tô (không hiện người lái), Tour, đám đông người đi bộ (`crowd.bin`), cảnh, ánh sáng, thời tiết, điều khiển, camera, vật lý xe.
- Không thêm chuyển động mới (đu dây, leo tường, nhảy). Không thêm nhân vật thứ ba. Không đổi ý nghĩa `ch` trên mạng.

**Phản mục tiêu.** Có các điểm này thì coi là hỏng, kể cả khi chạy được:
- Nhân vật gợi ra Người Nhện: lưới mạng nhện, hình con nhện, cặp mắt trắng lớn viền đen, bố cục "thân đỏ, hai hông và chân xanh", tên hay mô tả nhắc tới "nhện" / "Spider" / Marvel.
- Hai máy thấy cùng một người bằng hai nhân vật khác nhau (lỗi D-039 quay lại).
- Lộ tóc, mi, chân mày hay da mặt người thường dưới mặt nạ; xuyên mũ; răng cưa vì mảnh alpha cũ.
- Góc nhìn cũ thêm lệnh vẽ; thêm thư viện runtime.

## 4. Hiện trạng (đã đọc mã trên `main` `e5c498f`)

- **Một bộ nạp chung cho hai chế độ:** `stRigLoad(model)` (`src/explore/stroll/rig.ts`) nạp `CONFIG.stroll.anim.models[model]` bằng `GLTFLoader` import động, đệm theo số mô hình, làm nóng shader qua `stRigSetWarm` (`stroll/index.ts`), lỗi thì trả `null` một lần.
- **Mô hình theo lựa chọn:** `stCharModel(ch) = CONFIG.stroll.anim.chars[exCharNorm(ch)]` (`anim.ts`), hiện `chars: [0, 3]` → `p0.glb` nam (`Male_Adult_10`), `p3.glb` nữ (`Female_Adult_03`).
- **Đi dạo:**
  - `stAvatars` (`avatars.ts`) giữ 5 slot. Slot của mình theo `stChar.get()` (`char.ts`, `localStorage['stChar']`), người khác theo `ch` trong `lobby.walkers`.
  - Đổi `ch` thì gỡ bản sao. Mô hình chưa về thì hiện hình khối (`blocky.ts`).
  - `StRig` = `SkeletonUtils.clone` + `AnimationMixer`, trọng số từ `stClipMix` theo dáng + tốc độ, pha chung cho walk / jog / sprint.
  - Mô hình mặt hướng +X, chân ở y = 0.
- **Xe máy:**
  - `BkRider` (`bike/rider.ts`) dùng `bkRiderLoad(ch) = stRigLoad(stCharModel(ch))`, không có mixer.
  - Mỗi khung: `PlBones.restore()`, rồi bảng góc khớp, IK chân tới neo `foot_l` / `foot_r`, IK tay tới `grip_l` / `grip_r`.
  - Tìm xương theo tên `Bip01_*` (`pilot/bones.ts`). Mũ nửa khối cầu dựng bằng code, gắn xương đầu (`CONFIG.bike.rider.helmet`). Góc nhìn thứ nhất thu xương đầu về scale ≈ 0, mắt lấy từ `Bip01 LEye` / `REye`.
  - Xe máy của mình: `bike/index.ts` `loadRider()` theo `stChar`. Xe máy người khác: `multi/remoteDrive.ts`, nguồn đệm theo `stCharModel(ch)`, `ch` lấy từ `drivers` khi `veh === 1`.
- **Mạng:**
  - `join` kind `walk` (hoặc `drive` + `veh 1`) mang `ch`. Máy chủ (`server/multi/src/room.ts`) chuẩn hóa bằng `exCharNorm` (chỉ 0 / 1), giữ theo slot + attachment, phát trong `walkers` / `drivers`.
  - Vì vậy **mọi thay đổi nằm ở chỗ "`ch` → tệp nào"** là tự đồng bộ cho mình, người khác, người vào sau, kết nối lại.
- **Sảnh:**
  - `#stCharPick` (`index.html`) có hai nút radio với ảnh `public/people/thumb-m.webp` / `thumb-f.webp` (≤ 20 kB, `npm run gen:thumbs` vẽ từ `p0` / `p3`). Chữ `stChar` / `stCharM` / `stCharF` (9 ngôn ngữ).
  - Hiện ở sảnh Đi dạo và sảnh Xe máy, kể cả ngoại tuyến (`multi/lobby.ts`). Chế độ khác không dùng.
- **Sinh mô hình:**
  - `scripts/people/convert.py` (Blender 4.5, `npm run gen:people`) tải FBX + TGA Rocketbox vào `.cache/`, thu texture (thân 1024, đầu 512, alpha 512), cắt và nướng năm đoạn, quay mặt về +X, xuất GLB JPEG, vá `extras.speed` / `height`.
  - Có khối `if __name__ == '__main__'`. `crowd.py` đã nạp file này để dùng lại hàm.
- **Test đang có:**
  - `tests/stroll-unit/glb.test.ts`: `p0..p4` ≤ 1,5 MB / tổng ≤ 6 MB, năm đoạn + speed, 1 skin ≥ 50 khớp, có `height`, có xương `Bip01 Pelvis / L Foot / R Foot / Head`; ảnh xem trước ≤ 20 kB.
  - `tests/bike-unit/rider.test.ts` (nhân vật giả dựng từ vị trí xương `p0.glb`), `avatars.test.ts`, `test:char`, `test:stroll`, `test:bike`.

## 5. Các cách đã cân nhắc

**Về nhân vật (người dùng chọn 1):**
1. **Hai anh hùng nam / nữ, giữ ô chọn (chọn).** Không đổi giao thức, không deploy, giữ trọn D-039.
2. Một anh hùng duy nhất, ẩn ô chọn. Mất tính năng D-039.
3. Thêm anh hùng làm lựa chọn thứ ba (`ch = 2`). Phải sửa `exCharNorm` ở khách + máy chủ và deploy Worker. Máy cũ thấy người đó thành nam thường.

**Về cách dựng mô hình (quyết định của agent, người dùng không phản đối):**
1. **Vẽ lại Rocketbox `Male_Adult_10` / `Female_Adult_03` bằng script Blender (chọn).** Giữ khung xương, chuyển động, tỉ lệ, neo IK nên Đi dạo và Xe máy chạy không đổi mã. Giấy phép MIT có sẵn.
2. Mô hình siêu anh hùng CC0 khác (ví dụ các gói nhân vật CC0) rồi chuyển chuyển động sang. Xương khác `Bip01` nên phải viết lại phần tìm xương của `PlBones`, chỉnh lại bảng góc khớp xe máy, chuyển năm đoạn chuyển động. Nhiều việc và rủi ro hơn, lại chưa có ứng viên đã xác minh.
3. Tô màu lúc chạy (canvas texture theo UV của `p0` / `p3`). Không xóa được tóc / mảnh alpha (tóc lòi qua mặt nạ), UV Rocketbox rời rạc nên khó vẽ hoa văn liền mạch.

## 6. Thiết kế

### 6.1 Tài nguyên: `public/people/hero-m.glb`, `hero-f.glb`

- **Script mới `scripts/people/hero.py`**, lệnh `npm run gen:hero`, chạy qua `scripts/people/blender.mjs` như `gen:people`. Script nạp `convert.py` như `crowd.py` đang làm để dùng lại `fetch_char`, `fetch_clip`, `add_clip`, `glb_patch` và các hằng (`COMMIT`, `CLIPS`, `FPS`, `NHUONG`...). Như vậy năm đoạn chuyển động của anh hùng trùng từng khung với `p0` / `p3`. **Không sửa đầu ra `p0..p4`.**
- **Bộ đồ vẽ trong không gian vật thể rồi nướng ra UV:**
  - Ở tư thế đứng gốc, dựng một vật liệu thủ tục trong Blender (nút Texture Coordinate → Object, toán học, ColorRamp): mảng màu theo chiều cao / mặt trước-sau / trái-phải, đường chỉ xòe từ cổ (nam), dải sóng chéo (nữ), biểu tượng chiếu từ phía trước lên ngực.
  - Nướng (Cycles, bake Emit / Diffuse color) ra texture màu: thân 1024 px, đầu 512 px. Cách này không phụ thuộc bố cục UV rời rạc của Rocketbox.
  - Bàn tay và bàn chân là găng và ủng cùng bộ.
- **Mặt nạ:**
  - Xóa mọi mặt dùng vật liệu alpha (tóc tấm, mi, lông mày). Đầu ra còn 2 primitive (thân, đầu), mọi vật liệu `OPAQUE`.
  - Tóc khối của mô hình (nếu có) phải bỏ hoặc ép sát hộp sọ để mặt nạ tròn trơn. Cách cụ thể chọn sau khi mở mô hình trong Blender (plan Task 1, bước khảo sát).
  - Kính mắt là mảng màu trên texture đầu: chữ T (nam), hai kính hổ phách góc cạnh (nữ).
- **Phát sáng ban đêm (nam):**
  - Nướng thêm `emissiveTexture` 512 px: chỉ đường chỉ xòe, biểu tượng hình thoi và kính chữ T là sáng, còn lại đen. Nữ không có phát sáng.
  - Lúc chạy: `stRigSource` vá vật liệu có `emissiveMap` bằng `onBeforeCompile`, nhân phát sáng với `clamp(shared.uNight) × CONFIG.stroll.hero.glow`, như đèn xe máy ở `bike/model.ts`. Không thêm đèn.
  - `customProgramCacheKey` cố định nên mọi bản sao dùng chung một program.
- **Trần (test kiểm):**
  - Mỗi tệp ≤ 1,5 MB.
  - Số tam giác ≤ số của `p0` / `p3` tương ứng (chỉ bớt vì xóa tóc / mi).
  - Đúng 2 primitive, không vật liệu `BLEND` / `MASK`.
  - 1 skin ≥ 50 khớp, đủ xương `Bip01 Pelvis / L Foot / R Foot / Head / L Hand / R Hand / LEye / REye`.
  - Năm đoạn đúng tên, `extras.speed` bằng `p0` / `p3` (sai số 0,01 m/s), có `height`.
  - `hero-m.glb` có `emissiveTexture`, `hero-f.glb` không có.
  - Không Draco / Meshopt.
- **Giấy phép:**
  - Hình học và xương là Rocketbox (MIT), đã có `LICENSE-Rocketbox.txt`. Thêm một dòng ghi `hero-m.glb` / `hero-f.glb` là bản sửa đổi từ `Male_Adult_10` / `Female_Adult_03` bằng `scripts/people/hero.py`.
  - Bộ đồ là thiết kế nguyên bản của dự án. README mục ghi nguồn thêm một dòng, kèm câu "không liên quan tới nhân vật thương mại nào".
  - MIT không buộc ghi công trong giao diện nên không thêm dòng ghi công.

### 6.2 Nối vào mã chạy (không đổi kiến trúc)

- `CONFIG.stroll.anim.models` thêm `'people/hero-m.glb'` (số 5) và `'people/hero-f.glb'` (số 6). `chars: [0, 3]` → `[5, 6]`.
  - `p0..p4` giữ nguyên trong `public/`: test glb cũ, `gen:people` và `crowd.py` vẫn dùng. Khi chạy không còn nạp tệp nào trong số đó.
  - Vì mọi chỗ đều đi qua `stCharModel`, Đi dạo của mình, Đi dạo người khác (`avatars.ts`), xe máy của mình (`bike/index.ts`), xe máy người khác (`remoteDrive.ts`) và nạp trước ở sảnh (`lobby.ts`) đều tự dùng anh hùng.
- **Mũ bảo hiểm xe máy:** anh hùng đội mặt nạ kín nên ẩn mũ nửa đầu. Thêm `CONFIG.bike.rider.helmet.show` (mặc định `false`). Mũ vẫn được dựng (giữ cấu trúc, test cũ chạy), chỉ `visible = false`. _(Quyết định của agent; đổi thành `true` là có mũ lại.)_
- **Đường lùi:** giữ nguyên hành vi hiện có. `hero-*.glb` nạp lỗi / quá hạn thì Đi dạo hiện hình khối, xe máy chạy không người (người khác: hình tạm `BkBike` lite). Không lùi về `p0` / `p3`: lỗi thường do mạng, tải thêm 1,1–1,4 MB chỉ để lùi là chậm thêm. _(Quyết định của agent.)_
- **Không đổi:** `protocol.ts`, `session.ts`, `server/multi/*`, `exCharNorm`, `stChar`, `PlBones`, bảng góc khớp, IK, camera, chuyển động, điều khiển.
- **Khách cũ:** tab đã mở từ trước khi deploy trang vẫn vẽ người thường (trang cũ trỏ `p0` / `p3`), không lỗi vì `ch` không đổi nghĩa. Tải lại trang là thấy anh hùng.

### 6.3 Đi dạo

- Trạng thái chuyển động giữ nguyên: đứng (`idle`), đi (`walk`), chạy bộ (`jog`), chạy nhanh (`sprint`), chụp ảnh (`photo`). Không có đoạn rẽ hay dừng riêng: rẽ là quay gốc theo `yaw`, dừng là mờ dần về `idle` với hằng thời gian `anim.fade`. Hành vi này giữ như hiện tại vì bản yêu cầu đòi không đổi điều khiển.
- Chân ở y = 0, mặt hướng +X, `height` trong khoảng 1,5–1,95 m (cùng mô hình gốc nên cùng số).
- Dáng `photo` giơ tay không có máy ảnh (hạn chế cũ, giữ).

### 6.4 Xe máy

- Dùng y nguyên `BkRider`. Đo lại bằng `debug()` cho cả hai anh hùng:
  - tay – tay nắm ≤ 3 cm;
  - cổ chân – đích ≤ 3 cm;
  - xương đầu không xuyên kính chắn gió ở góc lái lớn nhất (xem ảnh ở plan).
- Đổi khung xương sẽ làm hỏng bảng góc khớp; ở đây khung xương không đổi nên không cần chỉnh lại.
- Nữ: lỗi "tóc lòi qua mũ" (D-040) tự hết vì đã xóa tóc và ẩn mũ.

### 6.5 Sảnh

- Vẽ lại `thumb-m.webp` / `thumb-f.webp` từ `hero-m` / `hero-f`. `scripts/people/thumbs.mjs` đọc đường dẫn theo `CONFIG.stroll.anim.chars` / `models` thay vì viết cứng `p<k>`. Giữ tên tệp và trần ≤ 20 kB.
- Đổi chữ khóa `stChar` thành "Siêu anh hùng" (và bản dịch tương ứng ở 8 ngôn ngữ khác). Giữ `stCharM` "Nam", `stCharF` "Nữ". Không thêm khóa mới. _(Quyết định của agent: ảnh đã cho thấy là anh hùng; tên riêng cho từng anh hùng phải dịch 9 thứ tiếng và dễ va tên thương mại.)_
- Bố cục sảnh, màn chọn phương tiện, ảnh thẻ `public/chooser/walk.webp` / `bike.webp` không đổi. Ảnh thẻ chụp người thường, chụp lại bằng `gen:chooser` là việc tùy chọn (§10).

### 6.6 Hiệu năng và tài nguyên

- **Lệnh vẽ:**
  - Mỗi nhân vật 3 → 2 (bỏ primitive alpha), cả Đi dạo lẫn người lái xe máy.
  - Góc nhìn cũ không có nhân vật nên +0.
  - Program: thêm tối đa một biến thể (vật liệu có `emissiveMap` + vá đêm của nam), làm nóng trong `stRigWarm` như cũ. Nữ dùng chung program skinning hiện có.
- **Tải xuống:** hai tệp thay hai tệp, cùng cỡ (`p0` 1,11 MB, `p3` 1,42 MB; trần mỗi tệp 1,5 MB).
- **Bộ nhớ:** không đổi cách giữ nguồn / gỡ bản sao (`StRig.dispose`, `BkRider.dispose`). Vật liệu đã vá thuộc nguồn dùng chung, không dispose theo bản sao.

## 7. Tiêu chí chấp nhận

**Đi dạo**
- [ ] Vào Đi dạo (một mình và có máy chủ) thấy anh hùng đúng giới đã chọn; `stAvatars.debug(slot).model` = 5 hoặc 6, `real === true`.
- [ ] Đứng / đi / chạy bộ / chạy nhanh / chụp ảnh đổi đoạn mượt; trọng số `mix` như với `p0` / `p3` (test đơn vị `avatars.test.ts` / `anim.test.ts` qua).
- [ ] Chân chạm đất: điểm thấp nhất của lưới ở tư thế đứng trong ±2 cm quanh y = 0 (kiểm trong `hero.py` khi xuất).
- [ ] Không lộ tóc / mi / da mặt; mọi vật liệu `OPAQUE` (test glb).

**Xe máy**
- [ ] Người lái là anh hùng đã chọn; `rider.debug()` tay ≤ 3 cm, chân ≤ 3 cm ở thẳng, nghiêng hết trái / phải, bẻ lái hết trái / phải (`rider.test.ts` mở rộng với xương lấy từ `hero-m` / `hero-f`).
- [ ] Không có mũ khi `helmet.show = false`; góc nhìn thứ nhất không thấy trong đầu / mặt nạ.
- [ ] Điều khiển, vật lý, camera không đổi (`test:bike:unit` cũ qua y nguyên trừ ca đổi mô hình).

**Nhiều người**
- [ ] Hai trình duyệt + bot: mỗi người thấy người kia đúng anh hùng (nam C / nữ B) ở Đi dạo và Xe máy, kể cả người vào sau, tải lại trang, đổi chế độ Đi dạo ↔ Xe máy (`test:char` mở rộng thêm kiểm số mô hình 5 / 6).
- [ ] Không đổi `protocol.ts` / `server/multi`; `test:multi:unit` + `test:multi:worker` qua không sửa kỳ vọng.

**Hiệu năng / đường lùi**
- [ ] `hero-*.glb` ≤ 1,5 MB, tam giác ≤ nguồn, 2 primitive (test glb).
- [ ] Chặn `hero-*.glb`: Đi dạo hiện hình khối, xe máy chạy không người, console chỉ một cảnh báo mỗi mô hình (`test:stroll`, `test:bike` mục chặn tệp).
- [ ] Lệnh vẽ góc cũ +0 (`test:drawcalls` nếu người dùng cho chạy); trong Đi dạo / Xe máy mỗi nhân vật bớt 1 lệnh.
- [ ] Không rò bộ nhớ: start → stop × 3 không tăng `renderer.info.memory.geometries / textures` sau lần đầu.

**Không đổi**
- [ ] Dù lượn, Ô tô, Tour, đám đông: không file nào trong `src/explore/pilot/`, `src/explore/drive/` (trừ đọc), `src/common/people/` bị sửa; `test:pilot:unit`, `test:drive:unit`, `test:people:unit` qua.

**Thẩm mỹ (người dùng duyệt bằng mắt)**
- [ ] Ảnh xem trước của `hero.py` (mặt trước, mặt sau, nghiêng, ban đêm cho nam) được agent đối chiếu §3 / §10.4; người dùng duyệt ở demo cuối (§10.3).
- [ ] Đối chiếu danh sách phản mục tiêu ở §3 (không gợi Người Nhện).

## 8. Kiểm

- Đơn vị: `tests/stroll-unit/glb.test.ts` thêm khối cho `hero-m` / `hero-f`; `anim.test.ts` (`stCharModel` → 5 / 6); `avatars.test.ts` (bộ nạp giả vẫn chạy với số mô hình mới); `tests/bike-unit/rider.test.ts` (thêm nguồn giả dựng từ xương `hero-*.glb`; mũ ẩn); `tests/bike-unit/i18n.test.ts` hoặc test khóa i18n có sẵn cho `stChar`.
- Trình duyệt: `test:stroll`, `test:bike`, `test:char`, `test:mobile` (ảnh sảnh). Người dùng thường bảo không chạy test nặng; plan ghi rõ test nào chạy, test nào để lượt chạy chung.
- Mắt: ảnh xem trước của `hero.py` + ảnh chụp trong trình duyệt GPU thật (ngày, đêm, mưa, góc thứ nhất / thứ ba xe máy).

## 9. Rủi ro

- **Nướng texture từ không gian vật thể** bị lem ở đường nối UV hoặc chỗ gập (nách, háng). Giảm bằng cách nướng có margin (16 px), xem ảnh 4 hướng và chỉnh mảng bằng hàm trơn.
- **Tóc khối của Rocketbox** có thể nằm chung lưới đầu, không tách theo vật liệu. Plan có bước khảo sát; lùi về ép đỉnh tóc vào mặt cầu quanh xương đầu.
- **Dung lượng:** `p3.glb` đã 1,42 MB. Texture phát sáng chỉ thêm cho nam (`p0` 1,11 MB) nên còn chỗ. Nữ bỏ texture alpha nên nhỏ đi.
- **Phân biệt với Người Nhện** là phán đoán bằng mắt. Người dùng duyệt ảnh, agent đối chiếu danh sách §3.
- **Khung đầu chậm hơn** nếu thêm program phát sáng mà làm nóng không kịp (`anim.warmMs`). Đo bằng `test:perf -- --strict` khi được chạy.

## 10. Quyết định sau vòng đọc của người lập plan (agent tự chốt, người dùng bảo "tiếp tục không cần hỏi lại", 2026-11-15)

1. **Giữ nguyên hình học quần áo Rocketbox, chỉ sơn đè.** Không shrinkwrap, không bỏ cổ áo.
   - Lý do: chỉnh hình làm lệch trọng số da và các số đo IK xe máy đã chỉnh ở D-040. Chi phí lớn, rủi ro cao cho một việc thẩm mỹ.
   - Đổi lại: anh hùng nam có cổ áo khoác đứng (đọc thành cổ bộ giáp) và quần hơi rộng. Ghi là hạn chế đã biết. Muốn bó sát thì làm ở việc sau.
2. **Màu phẳng thủ tục × che sáng (AO) nướng từ chính lưới, cộng vân vải rất nhẹ.** Không nhân texture gốc vì sẽ lộ đường may, logo, túi áo của quần áo thường.
   - Sơn bằng Python trong `hero.py`: tô tam giác vào không gian UV, nội suy vị trí / pháp tuyến / vùng xương ở tư thế gốc, rồi tính màu bằng numpy. Cách này rõ ràng hơn cây nút Blender.
   - AO nướng bằng Cycles, nếu ảnh thử cho thấy cần.
3. **Không có điểm dừng chờ duyệt ảnh giữa chừng.** Người dùng bảo làm liền tới demo cuối. Agent tự xem ảnh xem trước theo danh sách §3, rồi nối mã luôn. Người dùng duyệt ở demo cuối; nếu đổi thiết kế thì chỉ chạy lại `gen:hero` + `gen:thumbs`, mã không đổi.
4. **Giữ khoảng cách với Người Nhện cho anh hùng nam C**, ràng buộc cụ thể:
   - Mặt nạ, găng, ủng **xanh**, không đỏ.
   - Đỏ chỉ ở tấm ngực hình thang (không xuống bụng, không lên vai) và mặt trước đùi; tổng đỏ ≤ khoảng 25 % mặt trước.
   - Hông, sườn, tay toàn xanh lam, không có mảng xanh hai bên kiểu Người Nhện.
   - Kính chữ T liền (không phải hai mắt trắng).
   - Đường chỉ là tia thẳng xòe từ cổ, không có vòng tròn đồng tâm, không đan lưới.
   - Anh hùng nữ B: nền xanh hải quân, đỏ chỉ ở hai dải sóng chéo và vòng cổ tay.

## 11. Để lại cho người làm / chờ người dùng

- Màu chính xác, độ dày đường chỉ, cỡ biểu tượng, độ sáng ban đêm (`CONFIG.stroll.hero.glow`): agent chọn rồi đưa ảnh cho người dùng duyệt.
- Chụp lại ảnh thẻ màn chọn `walk.webp` / `bike.webp` (`gen:chooser`) để thẻ cũng hiện anh hùng: tùy chọn, chỉ làm khi người dùng bảo.
- Mũ bảo hiểm (`helmet.show`): mặc định ẩn, người dùng có thể đổi.

# Đoạn giới thiệu điện ảnh (Intro Guide) — thiết kế

_D-045 · 2026-11-15 · nhánh `feature/intro-dien-anh` (từ `main` `51e5518`) · Trạng thái: đang triển khai_

Nguồn yêu cầu: bản "BUILD A CINEMATIC 3D INTRO GUIDE FOR DA NANG BRIDGES" của người dùng (2026-11-15). Người dùng yêu cầu đi hết quy trình (khảo sát → spec → plan → làm → kiểm) không dừng hỏi; các lựa chọn dưới đây là quyết định của agent, ghi rõ để người dùng sửa.

## 1. Mục đích

Khách lần đầu mở trang thấy ngay một đoạn mở đầu 55–60 giây **quay bằng chính cảnh 3D đang chạy**: toàn cảnh sông Hàn, bốn cách khám phá (dù lượn, ô tô VF 3, xe máy, đi dạo) chạy bằng đúng mã của từng chế độ, ngày chuyển đêm, Cầu Rồng phun lửa và nước, Cầu sông Hàn quay, rồi dẫn vào màn chọn phương tiện có sẵn. Nguyên tắc: **cho xem, không mô tả**; không dựng tính năng giả; không dựng hệ chọn chế độ thứ hai.

Không làm: thuyết minh giọng nói cho intro; cảnh mới / mô hình mới / vật liệu mới; hiệu ứng hậu kỳ mới (bloom đêm có sẵn giữ nguyên); đồng bộ intro giữa các máy; giới thiệu Hầm sông Hàn (phương án đề xuất, không đưa vào intro để khỏi phải chú thích); Vòng quay Mặt Trời chỉ lọt khung, không có cảnh riêng.

Thất bại dù "chạy được": intro làm hỏng trạng thái khi vào chế độ thật (fov, lớp body, cầu còn mở, đêm kẹt lại, chế độ Trực tiếp không trở lại); làm đổi lệnh vẽ / chuỗi `rand()` của góc cũ; chặn người muốn vào ngay; test cũ `?test` / `?test&chooser` thấy intro.

## 2. Hiện trạng liên quan (đã đọc mã)

- Vào trang: `main.ts` dựng cảnh → `setupExplore()` (`src/explore/index.ts`): `?explore=…` vào thẳng chế độ; không thì `exShowChooser()` hiện `#chooser` sau khung đầu (`#loading.done`). `?test` không hiện màn chọn trừ khi có `chooser`.
- Thoát mọi chế độ khám phá = tải lại trang (`explore.exit()`, D-020). `drive.stop()` và `bike.stop()` trả lại đủ thứ đã đổi; **dù lượn và đi dạo chưa có `stop()`**.
- Bốn chế độ chạy một mình khi `exMulti.session` là `null` (chưa bấm thẻ nào): không mở kết nối. Mỗi chế độ có `update(dt)` đọc phím và `step(dt, inp)` cho test; camera do chính chế độ đặt (`exChase`, `drCamPlace`, `bkCamPlace`, `stCamPlace`).
- Camera: `cam.mode` (`views/state.ts`), `updateCamera()` gọi `controls.update()` ở nhánh mặc định; các chế độ tự đặt camera có nhánh rỗng.
- Ngày / đêm: `dayNight.target` 0–1, `stepNight` tiến dần. Chế độ **Trực tiếp** (D-043, mặc định khi không `?test`) ghi `dayNight.target` và thời tiết theo số liệu thật mỗi khung; `LiveEnv.setMode('manual' | 'live', why)`.
- Cầu Rồng: `show.on`, `show.t` (`bridges/dragon/effects.ts`); chu kỳ thật 48 s: lửa 9 lượt (0–27 s), nước 27–42 s; `weatherFx.showAllowed` chặn khi mưa to / bão.
- Cầu sông Hàn: `SwingController` (`start(speed)`, `requestClose()`, `state`, `canStart`); ở 30× (tốc độ của Tour) từ lúc bắt đầu tới khi nhịp xoay ≈ 1,1 s + chờ xe rời nhịp, xoay 5 s. `swingUI.ts` kéo camera về `shSwingCam` ở sự kiện `swingStart` trừ khi `cam.mode` là tour / chế độ khám phá.
- Phím thật (nguồn: `exHint`, `drHint`, `bkHint`, `stHint` và `keys.ts` từng chế độ): dù W/S lên xuống, A/D rẽ, Q/E tốc độ; ô tô W A S D / mũi tên, Space phanh tay, H còi, kéo chuột xoay camera; xe máy thêm V đổi góc nhìn, Q/E xi nhan, R về làn, Space phanh gấp; đi dạo W A S D, Shift chạy, kéo chuột, P chụp ảnh. Dù lượn khóa trên máy cảm ứng (`lockGliderOnTouch`, nhãn `exDesktopOnly`).
- Lưu trữ: `localStorage['cauRong.lang']`, `['cauRong.env']`, `['stChar']`; `sessionStorage['exMpNotice']`.

## 3. Các hướng đã cân nhắc

1. **Đạo diễn trên cảnh thật (chọn).** Một module `src/intro/` giữ dòng thời gian; mỗi cảnh gọi đúng hệ có sẵn (bốn chế độ chạy một mình bằng đầu vào tự lái, `dayNight.target`, `show`, `SwingController`); camera các cảnh toàn cảnh do intro đặt qua `cam.mode = 'intro'`. Giao diện là một lớp DOM. Đổi mã cũ ít: thêm `stop()` + móc tự lái cho bốn chế độ, một nhánh `cam.mode`, một dòng trong vòng `animate`.
2. Quay sẵn video rồi phát. Loại: người dùng cấm ("không dùng ảnh / video giả làm cảnh 3D"), nặng, không theo ngôn ngữ, lệch khi cảnh đổi.
3. Dựng Tour thứ bảy bằng `TOUR_DEFS`. Loại: Tour chỉ có đường bay + chú thích, không vào được chế độ khám phá, không có điều hướng cảnh / tạm dừng, và `fitDurations` kéo theo thuyết minh.

## 4. Kịch bản

Chín nhịp trong sáu chương. Thời lượng ở `CONFIG.intro` (ước lượng, chỉnh theo mắt). Giữa hai nhịp có màn tối dần `fade` giây (đổi trạng thái lúc màn tối).

| # | id | Chương | Thời lượng | Cảnh | Hệ thật dùng |
|---|---|---|---|---|---|
| 1 | `welcome` | 01 | 7 s | Từ trên cao phía Nam hạ dần về sông Hàn, lộ Cầu Rồng rồi Cầu sông Hàn; ban ngày | camera intro |
| 2 | `glider` | 02 | 4,5 s | Dù bay dọc sông về phía Bắc, trên Cầu Rồng | `explore.start(at)`, `exChase` |
| 3 | `car` | 02 | 4,5 s | VF 3 chạy trên Cầu Rồng về phía đầu rồng; camera xoay quanh xe rồi về sau xe | `drive.start()`, `drive.cam.yaw` (như kéo chuột) |
| 4 | `bike` | 02 | 4,5 s | Xe tay ga: góc thứ nhất rồi chuyển sang thứ ba | `bike.start()`, `bike.setView(3)` (như phím V) |
| 5 | `walk` | 02 | 4,5 s | Đi bộ trên lề Cầu Rồng, camera sau lưng | `stroll.start()` |
| 6 | `daynight` | 03 | 8 s | Toàn cảnh trên cao; trời tối dần, đèn cầu và phố lên | `dayNight.target` 0 → 1 trong `nightRamp` giây |
| 7 | `dragon` | 04 | 9 s | Đêm, camera tiến về đầu rồng; hai lượt lửa rồi nước | `show.on`, `show.t` |
| 8 | `swing` | 05 | 9 s | Đêm, camera vòng quanh trụ quay; nhịp xoay | `ctrl.start(30)` |
| 9 | `finale` | 06 | 6 s rồi giữ | Lùi lên cao thấy cả hệ cầu; tiêu đề + lối vào | camera intro; cầu tự đóng |

- Trung thực về lịch trình diễn: cảnh `dragon` rút gọn chu kỳ (đặt `show.t` nhảy từ lửa sang nước) và có dòng nhỏ "Trình diễn thật: 21:00 thứ Bảy, Chủ nhật"; cảnh `swing` có nhãn "Tua nhanh 30×" và dòng "Cầu quay thật: 23:00 thứ Bảy, Chủ nhật".
- Cảnh `daynight` có một dòng phụ nhắc thời tiết (theo thời tiết thực của Đà Nẵng hoặc tự chọn nắng, mưa, gió mùa, bão); **không** bật mưa trong intro.
- Hết `finale` intro **không tự đóng**: camera trôi chậm, chờ người xem bấm.
- Tọa độ camera và vị trí đặt dù / xe: `CONFIG.intro.shots` và `CONFIG.intro.demo` (đều ước lượng, chỉnh khi xem ảnh GPU thật).

Chữ (vi / en do người dùng cho; bảy ngôn ngữ còn lại dịch theo en):

| Nhịp | Tiêu đề | Dòng phụ |
|---|---|---|
| welcome | KHÁM PHÁ ĐÀ NẴNG / DISCOVER DA NANG | Thành phố bên sông Hàn – Một hành trình, vô vàn góc nhìn. / An interactive journey through the city of bridges. |
| glider | DÙ LƯỢN / PARAGLIDING | Bay tự do trên sông Hàn. / Fly freely above the Han River. |
| car | Ô TÔ / CAR DRIVING | Lái xe khám phá những cây cầu. / Explore Da Nang behind the wheel. |
| bike | XE MÁY / MOTORCYCLE | Tự do rong ruổi qua từng cây cầu. / Ride through the city at your own pace. |
| walk | ĐI DẠO / WALKING | Chậm lại và cảm nhận Đà Nẵng. / Slow down and discover every detail. |
| daynight | MỘT THÀNH PHỐ – HAI SẮC THÁI / ONE CITY. TWO WORLDS. | Khám phá Đà Nẵng từ ban ngày đến đêm rực rỡ. / Experience Da Nang from sunrise to nightfall. |
| dragon | KHI RỒNG THIÊNG THỨC GIẤC / THE DRAGON AWAKENS | Chiêm ngưỡng màn trình diễn phun lửa và nước. / Witness the legendary fire and water show. |
| swing | KỲ QUAN CHUYỂN ĐỘNG / ENGINEERING IN MOTION | Khám phá cơ chế quay độc đáo của cầu sông Hàn. / Experience the iconic rotating Han River Bridge. |
| finale | HÀNH TRÌNH KHÁM PHÁ ĐÀ NẴNG BẮT ĐẦU / YOUR DA NANG ADVENTURE STARTS NOW | Chọn cách khám phá của bạn. / Choose your way. Explore your city. |

## 5. Hành vi

### 5.1 Khi nào phát

- Tự phát khi: không có `?explore=`; không `?test` (hoặc có `?intro`); `localStorage['cauRong.intro'] !== 'off'`; phiên này chưa phát (`sessionStorage['cauRong.introSeen']`); không `prefers-reduced-motion: reduce`; không `navigator.connection.saveData`. Phát sau `#loading.done`, thay chỗ màn chọn; xong / bỏ qua thì hiện màn chọn.
- Vì thoát chế độ là tải lại trang, cờ phiên giữ cho intro **không phát lại sau mỗi lần thoát**. Mở trang ở phiên mới thì phát lại, trừ khi đã chọn "Không hiện lại".
- `?intro=off` tắt hẳn; `?test&intro` bật trong test (bỏ qua cờ phiên và lựa chọn đã lưu).
- Xem lại: nút "Xem giới thiệu" trên màn chọn (`#exIntroBtn`, phát tại chỗ) và trong bảng Cài đặt ở chế độ tham quan (`#btnIntro`: đặt `sessionStorage['cauRong.introPlay']` rồi tải lại trang như `explore.exit()`, để không phải gỡ trạng thái tour / góc nhìn đang chạy).
- Không có lối phát intro khi đang giữ chỗ trong phòng nhiều người (màn chọn và chế độ tham quan đều chưa / không giữ chỗ; nút trên màn chọn ẩn khi sảnh đang mở). Intro không mở kết nối, không gửi gì.

### 5.2 Điều khiển

- Góc trên phải: ô ngôn ngữ (chuyển cho `#langSelect` như `#exLang`), nút **Bỏ qua**.
- Dưới: thanh tiến trình 9 đoạn (bấm để nhảy tới nhịp), nút ◀ ⏸/▶ ▶, ô "Không hiện lại".
- Khối chữ góc dưới trái (giữa dưới ở điện thoại): số chương + tên chương, tiêu đề, dòng phụ, hàng phím (máy có bàn phím) hoặc dòng thao tác cảm ứng (máy cảm ứng), nút hành động của nhịp.
- Bàn phím: Esc bỏ qua, Space tạm dừng / tiếp, ← / → nhịp trước / sau, Enter ở `finale` = Bắt đầu. Khi intro chạy, mọi phím (trừ tổ hợp Ctrl / Meta / Alt và Tab) bị chặn ở pha capture để không lọt xuống phím lái.
- Tạm dừng: dừng dòng thời gian, camera intro và bước của bốn chế độ (xe / dù đứng yên); nước, xe cộ, đèn vẫn sống.
- Nút hành động (mỗi nút kết thúc intro, trả trạng thái, hiện màn chọn rồi **bấm hộ đúng phần tử có sẵn**):
  - `glider` / `car` / `bike` / `walk`: "Bay thử" / "Lái ngay" / "Chạy thử" / "Đi dạo ngay" → `button[data-pick=…]` (qua sảnh như thường). Máy cảm ứng: nhịp `glider` không có nút, hiện `exDesktopOnly`.
  - `dragon`: "Xem trình diễn" → thẻ `guided`, `[data-view="head"]`, `#btnShow`.
  - `swing`: "Xem cầu quay" → thẻ `guided`, `[data-bridge="sh"]`, `#btnSwing`.
  - `finale`: nút chính **BẮT ĐẦU KHÁM PHÁ** → màn chọn; bốn nút nhỏ Dù lượn / Ô tô / Xe máy / Đi dạo (cùng đường với nút hành động) và "Tour 4 cầu có thuyết minh" → thẻ `guided` + `[data-view="allTour"]`; "Xem lại".

### 5.3 Trạng thái và dọn dẹp

`intro.play()` chụp: vị trí camera, `controls.target`, fov, near, `controls.enabled`, `controls.maxPolarAngle`, `dayNight.target`, chế độ `LiveEnv`, `show.on`. Trong lúc phát: `LiveEnv` ở `manual` (lý do nội bộ, không hiện `#liveNotice`), `dayNight` do intro lái.

Mỗi nhịp có `enter` / `leave`; `leave` gọi `stop()` của chế độ nó bật. Kết thúc (xong, bỏ qua, nút hành động, lỗi) chạy cùng một `cleanup()`:

- dừng chế độ đang chạy; `show.on` về giá trị chụp; `dayNight.target` và chế độ `LiveEnv` về giá trị chụp (trời chuyển mượt bằng `stepNight`);
- camera về tư thế chụp, `cam.mode = 'orbit'`, `controls.enabled = true`; gỡ lớp `body.intro`, ẩn `#intro`;
- Cầu sông Hàn: nếu chưa `CLOSED` thì intro tiếp tục "tiễn" (đặt tốc độ 30×, `requestClose()` khi `OPEN`) trong `intro.update` cho tới khi `CLOSED`, rồi thôi hẳn. Người vào lái ngay lúc đó gặp barie như khi cầu quay thật.
- Lỗi trong `enter` / `update` của bất kỳ nhịp nào: ghi `console.warn`, `cleanup()`, hiện màn chọn. Trang không được kẹt ở intro.

Mô hình (`vf3.glb`, `scooter.glb`, nhân vật, `pilot.glb`) nạp trước ngay khi biết sẽ phát (`preload()` có sẵn); chưa về thì chế độ dùng hình tạm có sẵn của nó.

### 5.4 Điện thoại

Cùng kịch bản. Khối chữ xuống giữa dưới, phím thay bằng dòng thao tác cảm ứng thật của chế độ (cần gạt, GA / PHANH, vuốt để nhìn, 📷); nhịp dù lượn ghi "Chỉ dùng trên máy tính". Vùng an toàn (`env(safe-area-inset-*)`), nút ≥ 44 px, `ar` RTL.

## 6. Kiến trúc

```
src/intro/
  timeline.ts   thuần: danh sách nhịp, thời lượng, locate(t), tiến / lùi, hệ số mờ
  shots.ts      thuần: nội suy tư thế camera theo CONFIG.intro.shots
  scenes.ts     enter / update / leave từng nhịp (đụng cảnh)
  ui.ts         lớp DOM #intro: chữ, phím, tiến trình, nút
  index.ts      intro: setup, shouldAutoplay, play, update, skip, seek, cleanup
```

Thay đổi ở mã cũ (tối thiểu, không đổi hành vi khi intro không chạy):

- `views/state.ts`: thêm `'intro'` vào `CameraMode`; `views/camera.ts`: nhánh rỗng; `ui/swingUI.ts`: `swingStart` / `swingClosed` không kéo camera khi `cam.mode === 'intro'`.
- `explore/index.ts`: `explore.start(at?)`, `explore.stop()`, `explore.auto`; chọn phát intro hay hiện màn chọn. `stroll`: `stop()`, `auto`. `drive`, `bike`: `auto`. `auto: ((inp) => void) | null`: khác `null` thì `update()` gọi nó thay cho việc đọc phím / cảm ứng.
- `explore/chooser.ts`: tách "gắn" khỏi "hiện" (`exShowChooser(..., { defer })`, `exRevealChooser()`).
- `main.ts`: `intro.update(dt)` ngay sau `updateCamera(dt)`; bước của bốn chế độ bỏ qua khi `intro.hold`; `setupIntro(...)` trước `setupExplore`; `__app.intro` khi `?test`.
- `index.html`, `main.css`: `#intro`, `#exIntroBtn`, `#btnIntro`; `body.intro` ẩn mọi HUD / bảng khác.
- `config.ts`: `CONFIG.intro`. i18n: khóa `in*` × 9 ngôn ngữ.

Bất biến: không thêm vật thể / vật liệu / đèn vào cảnh (0 lệnh vẽ, 0 program mới ở góc cũ); không gọi `rand()` lúc dựng; không thư viện mới; không cấp phát mỗi khung trong `intro.update`.

## 7. Kiểm

- `npm run test:intro:unit` (không trình duyệt): dòng thời gian (tổng, `locate`, tiến / lùi, kẹp), nội suy camera, đủ khóa `in*` ở 9 ngôn ngữ, mọi nhịp có tư thế trong `CONFIG.intro.shots`, phím trong bảng phím khớp `DR_KEYS` / hint có sẵn.
- `npm run test:intro` (`tests/intro-check.mjs`, `?test&intro`, đọc `dist/`; chạy GPU thật bằng `TEST_REAL_GPU=1`): phát từ khung đầu; từng nhịp vào đúng hệ (`cam.mode`, `dayNight.target`, `show.on`, `ctrl.state`); tạm dừng; tiến / lùi / nhảy; bỏ qua ở mỗi nhịp rồi so trạng thái với trước intro (camera, fov, near, lớp body, `show.on`, `dayNight.target`, số lệnh vẽ); cầu về `CLOSED`; màn chọn hiện; nút hành động vào đúng chế độ; đổi ngôn ngữ đổi chữ; `ar` RTL; điện thoại 390 × 844 không tràn; `?test&chooser` không có intro; "Không hiện lại" + cờ phiên; console sạch.
- Xem ảnh GPU thật từng nhịp để chỉnh camera.
- Test nặng SwiftShader cũ (`test:explore`, `test:mobile`, `test:drawcalls`…) theo lệ của dự án: chạy một lần cuối nhánh nếu người dùng muốn; ghi rõ cái nào chưa chạy.

## 8. Để người dùng quyết sau

- Phát lại mỗi phiên mới (hiện tại) hay chỉ lần đầu tiên trên máy.
- Có thêm thuyết minh giọng nói / nhạc nền cho intro không (hiện im lặng trừ khi người xem đã bật âm thanh).
- Tọa độ camera, thời lượng từng nhịp (`CONFIG.intro`).
- Bản dịch `in*` ở 7 ngôn ngữ cần người bản ngữ duyệt.

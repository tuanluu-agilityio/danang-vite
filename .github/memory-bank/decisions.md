# Decisions (ADR rút gọn)

Chỉ ghi thêm ở cuối. Mẫu:

```
## D-xxx: <tiêu đề> — YYYY-MM-DD — Trạng thái: Chấp nhận | Thay bởi D-yyy
Bối cảnh: …  Quyết định: …  Hệ quả: …
```

---

## D-001: Không dùng framework UI — 2026-10-20 — Chấp nhận
Bối cảnh: bản gốc là một file HTML + three. Quyết định: Vite + TS thuần, DOM tay trong `index.html` + `src/ui/`. Hệ quả: bundle nhỏ; UI mới viết theo mẫu `panel.ts` (`toggle`, `selectBridge`).

## D-002: Giữ thứ tự dựng để bảo toàn chuỗi `rand()` có seed — 2026-10-20 — Chấp nhận
Bối cảnh: vị trí nhà/cây/xe sinh từ `rand = rng(20130329)` dùng chung. Quyết định: `main.ts` giữ đúng thứ tự bản gốc; công trình mới dựng sau cùng và dọn chỗ bằng scale-0 instance; phần ngẫu nhiên mới dùng `rng(seed)` riêng. Hệ quả: so được draw call với bản gốc; mọi tính năng mới phải theo mẫu `corridor.ts`.

## D-003: Draw call của bản gốc là chuẩn hồi quy — 2026-10-20 — Chấp nhận
Quyết định: `tests/original/index.html` (bản gốc sửa tối thiểu) + `test:drawcalls` là thước đo. Hệ quả: tối ưu hay tính năng mới đều phải báo chênh lệch draw call.

## D-004: `strict: false` ở giai đoạn 1 — 2026-10-20 — Chấp nhận
Bối cảnh: chuyển code cũ nguyên trạng. Quyết định: tắt strict, bật dần theo thư mục ở giai đoạn sau.

## D-005: Thuyết minh bằng clip mp3 sinh sẵn (msedge-tts) — Chấp nhận
Bối cảnh: cần giọng đọc tự nhiên, không backend. Quyết định: sinh clip offline, commit vào `public/voice/`, `manifest.json` lưu thời lượng + hash. Hệ quả: ngôn ngữ chưa có clip → Tour chạy lặng, nút Thuyết minh khóa.

## D-006: Mỗi công trình một thư mục + lớp kế thừa `BridgeBase` — Chấp nhận
Quyết định: thông số ở một khối trong `config.ts`, code ở `src/bridges/<ten>/`. Cầu Rồng giữ dạng hàm rời (có trước `BridgeBase`). Hệ quả: thêm công trình theo prompt `.github/prompts/new-structure.prompt.md`.

## D-007: Hầm dựng theo phương án đề xuất 2025 — Chấp nhận
Quyết định: bám số công bố (1.670 m = 600 + 380 + 415, 6 làn, 60 km/h); mặt cắt, độ sâu, cửa hầm là ước lượng. Các phương án 2016/2017 chỉ nhắc trong thuyết minh.

## D-008: Không dùng thương hiệu thật trên quảng cáo/tòa nhà — 2026-10-21 — Chấp nhận
Quyết định: thương hiệu hư cấu + thông điệp du lịch; tòa thật (Novotel, Vinpearl) dựng khối nhưng không logo.

## D-009: Thời tiết là lớp điều biến sau ngày/đêm, chạy bằng shader — 2026-10-21 — Đề xuất (chờ duyệt đặc tả `prompts/ke-hoach-thoi-tiet.md`)
Bối cảnh: `applyNight()` ghi đè mỗi khung hình sương, đèn, phơi sáng, màu nước; cần thêm mưa/gió/bão mà không lệch draw call hay chuỗi `rand()`. Quyết định: `updateWeather()` gọi ngay sau `applyNight()` và chỉ nhân/lerp các giá trị đó; giá trị applyNight không đặt lại thì chụp gốc lúc build và trả đúng khi preset "Hiện trạng" (no-op). Mưa, lắc cây, rung cáp làm trong vertex shader (uniform `weatherU` riêng, không gộp vào `shared` vì `MAT.ledRail` dùng nguyên object đó); ngẫu nhiên dùng `rng(seed)` riêng; không thêm đèn động hay pass hậu kỳ. Hệ quả: preset mặc định chênh 0 draw call; preset thời tiết ≤ +2 (mưa, tia chớp); `bridgePatch` có thêm option `weather`/`sway` mặc định tắt.

## D-010: Hiệu năng thời tiết đo bằng fill rate và khựng, không chỉ draw call — 2026-10-21 — Chấp nhận
Bối cảnh: mưa chỉ +1 draw call nhưng 6.000 vệt trong suốt sát camera ở pixelRatio 2 tô lại màn hình nhiều lần; đổi preset có thể buộc three.js biên dịch lại program (khựng). Quyết định: mưa bỏ vệt gần `rainNear`, mờ theo xa, giới hạn pixelRatio khi mưa, tự hạ `mesh.count` theo FPS (tắt khi `?test`); mọi hiệu ứng điều khiển bằng uniform, không đổi `defines`/`transparent`/số đèn theo preset; `buildWeather()` biên dịch trước bằng `compileAsync`. Thông số ở `CONFIG.weather.perf`. Hệ quả: `test:weather` kiểm thêm khung dài nhất ≤ `maxFrameMs` và `renderer.info.programs` không tăng khi đổi preset; GĐ3 đo FPS trên GPU thật, không chỉ SwiftShader.

## D-011: Sửa hai lỗi Tour có sẵn để `test:tour` qua (lệch bản gốc có chủ đích) — 2026-10-21 — Chấp nhận
Bối cảnh: GĐ4 thời tiết phải qua `test:tour`, nhưng hai lỗi không do thời tiết: (1) Tour Cầu Rồng chạm thân rồng ở x ≈ −282, y ≈ 9,9 — có cả trong bản gốc (`tests/KET-QUA.md`), vì điểm "Trên mặt cầu" ở z = +11,5 còn "Đuôi rồng" ở z = −48 nên đoạn bay cắt dải phân cách chỗ đỉnh thân ≈ 12,4 m; (2) chú thích Tour đổi chữ bằng `setTimeout(300)`, khung hình nặng (bật mặt cắt hầm, biên dịch shader trên SwiftShader) làm timer trễ quá 450 ms test chờ → "3/8" ở điểm 4 và tiêu đề trùng. Quyết định: điểm 3 Tour Cầu Rồng chuyển sang làn phía Bắc (z = −11,5, target z = −2); `showTourCaption()` đổi chữ ngay trong khung hình rồi hiện dần bằng transition CSS (bỏ pha mờ đi trước khi đổi). Hệ quả: đường bay Cầu Rồng khác bản gốc (`test:tour -- tests/original` sẽ báo "KHÁC" cho dragon); chú thích không còn phụ thuộc timer.

## D-012: Vận hành khi bão qua `weatherFx` + hook, không đụng nút người dùng — 2026-10-21 — Chấp nhận
Bối cảnh: GĐ5 phải dọn xe, khoá quay cầu, dừng trình diễn, tắt quảng cáo khi bão, rồi trả đúng lựa chọn cũ của người dùng. Quyết định: `weatherFx` (`core/shared.ts`: `clear`, `boatAway`, `showAllowed`, `swingBlocked`) là nguồn duy nhất, mặc định trung tính; `effectsHooks.ts` ghi vào đó theo `state.current.closed` (trạng thái preset Bão / kịch bản, KHÔNG theo ngưỡng gió — 12b-1). Code hiện có chỉ ĐỌC `weatherFx`: xe ẩn dần bằng `vanished(i, k)` (thứ tự cố định theo chỉ số, không `rand()`), `BridgeBase.life` ẩn khi `clear = 1` (trừ Hầm: `closable = false`), `updateShow` đặt khoá `sWeather`, `SwingController.canStart` + sự kiện `swingBlocked`, quảng cáo qua `setAdsSuppressed()` (nhớ lựa chọn người dùng trong `adsWanted`). `lifeOn`, `show.on` không bao giờ bị ghi. Ngưỡng dừng trình diễn (`ops.showMaxWind`, `showMaxRain`) là ước lượng, vì 12b chỉ bỏ ngưỡng cho cấm lưu thông và quay cầu.

## D-013: Kịch bản bão là một hành trình camera như Tour, thời gian kéo dài theo giọng đọc — 2026-10-22 — Chấp nhận
Bối cảnh: kịch bản bão chỉ gọi `setView()` tới 3 góc nhìn tĩnh (`wxRiverMouth`, `wxTtlStays`, `tpBay`). Lời đọc nói về thuyền về bến, Cầu Rồng, Cầu sông Hàn trong khi camera đứng ở chỗ khác; mốc 4–7 đứng yên ở vịnh Thuận Phước. Clip lại bị giới hạn ≤ khoảng cách mốc − 1,2 s. Quyết định (người dùng chọn): camera bay liên tục qua `STORM_TOUR` (`views/tourStops.ts`, mỗi mốc một điểm, `via: true` = điểm trung gian để tránh mô hình) theo Catmull-Rom mở, làm mượt như `updateTour()`. Camera tới điểm của mốc k ở `T_k + arrive·W_k`. Có giọng đọc thì `W_k = max(gốc, clip + pad)`, các mốc sau dời theo, tính lại khi bật/tắt giọng hoặc đổi ngôn ngữ. `scenario.pose(t)` là hàm thuần (tua `t` thì camera đúng chỗ). Chế độ camera `'storm'` trong `views/camera.ts`. Bỏ `cam` khỏi `CONFIG.weather.scenario.steps` và bỏ `on.camera`. Cây đổ ở mốc cuối quanh `scenario.focus()` chứ không quanh `controls.target`. Hệ quả: tổng thời gian khoảng 2:00–2:10 theo ngôn ngữ, đồng hồ hiện độ dài thật. `times`/`duration` là getter đã co giãn. `test:tour` kiểm cả đường bay kịch bản bão (raycast, y ≥ 3). Không thêm mesh nên draw call không đổi.

## D-015: Tour 4 cầu dùng chung bộ máy Tour, thêm đường bay mở (`loop: false`) — 2026-10-22 — Chấp nhận
Bối cảnh: người dùng muốn một Tour đi qua cả 4 cầu (TTL → Rồng → SH → TP, ~4,2 km), có thuyết minh, đi một chiều rồi trả điều khiển. Tour cũ là đường cong khép kín, lặp vô hạn, trần 16 s mỗi đoạn. Kịch bản bão (D-013) đã có đường bay mở nhưng gắn với dòng thời gian thời tiết. Quyết định: mở rộng `TOUR_DEFS`/`views/tour.ts` thay vì viết module mới. Thêm trường tùy chọn `loop: false` (Catmull-Rom mở, thêm một đoạn "giữ" ở điểm cuối, hết thì `exitTour()`), `segMax` (trần thời lượng đoạn bay, lấy từ `CONFIG.tourAll`) và `TourStop.bridge` (tới điểm thì gọi hook `tourHooks.bridge`, `setupUI` gắn `selectBridge(key, false)`, để tránh vòng import panel → camera → tour). Hệ quả: nút, chú thích, giọng đọc (`fitDurations`), quay cầu (`swing`), thoát Tour dùng chung. Mọi nhánh mới gác sau `loop === false`, nên `durs` và đường bay của 5 Tour cũ không đổi. Không thêm mesh. (D-014 để dành cho Vòng quay Mặt Trời.)


## D-014: Vòng quay Mặt Trời kế thừa `BridgeBase`, dựng sau mọi `rand()` và dọn nền bằng scale 0 — 2026-10-22 — Chấp nhận
Bối cảnh: Sun Wheel (Asia Park, z ≈ +2 280) không phải cầu nhưng cần LOD (`details`/`life`), hòa vào `bridges[]` để `update()` chạy, panel thông tin, `noReflect`, và sau này khoá theo `weatherFx`. Quyết định: `class SunWheel extends BridgeBase` trong `src/bridges/sun-wheel/` (tiền tố `sw`), `new SunWheel()` ngay sau `buildRiverfront()` và trước `buildWeather()` (thời tiết chụp vật liệu gốc). Hệ cục bộ: X dọc mặt vòng quay, Z theo trục quay (+Z là mặt Nam Đông Nam, có biển và quảng trường); `group.position = (x, 0, z)`, `rotation.y = (90° − phương vị)` = +7°. Nền (bệ + quảng trường) dọn bằng `clearRects()` của riverfront (scale 0 cả near lẫn far của LOD), không `rand()`. Thông số ở `CONFIG.sunWheel` (`deriveSunWheel()`): có nguồn 115 m, 64 cabin, 15 phút/vòng, 32 thanh LED; đường kính ≈ 93 m, bệ 13 m, vị trí x là ước lượng suy từ ảnh (xem đặc tả mục 1). Hệ quả: GĐ1 chỉ là khung rỗng, không mesh, nên draw call không đổi; phần hình học, quay, LED, ngồi cabin, thời tiết, Tour làm ở GĐ2–GĐ7.

## D-017: Tour Vòng quay giữ chế độ camera `tour`, cabin ghi đè camera trong `SunWheel.update()` — 2026-10-23 — Chấp nhận
Bối cảnh: Tour 6 điểm có hai điểm ngồi cabin (lên đỉnh, ngắm 4 cầu) nhưng Tour là đường bay Catmull-Rom với đồng hồ, chú thích, thuyết minh riêng; chuyển sang `cam.mode = 'swRide'` sẽ dừng đồng hồ Tour. Quyết định: giữ `cam.mode = 'tour'`; `TourStop.sw` (`ride` / `top` / `night`) gọi `tourHooks.sw` mỗi lần đổi điểm và khi thoát Tour; `swRide.active()` đúng cả khi `tour.on`, nên `SunWheel.update()` (chạy SAU `updateTour()` cùng khung) ghi đè tư thế camera bằng cabin; vào/ra cabin trộn mượt từ/tới điểm đang có trên đường bay (`blend`, `tour.out`). Điểm 4 tua nhanh `tour.climbSpeed` rồi giảm tốc khi quãng còn lại bằng quãng phanh (tính từ `speedAccel`), nên tới đỉnh ở `topSpeed` ×1 mà không vượt đỉnh. `TourStop.minSec` giữ điểm hiện đủ lâu để lên tới đỉnh kể cả khi tắt giọng. Thoát Tour (Esc, hết hành trình) hoặc đổi góc nhìn giữa chừng (`setView` không gọi `exitTour`) đều trả tốc độ quay, ngày/đêm, kiểu show như cũ (`swRide.tourEnd()` + tự phát hiện trong `update`). Hệ quả: không thêm mesh/đèn/`rand()`; `tourHooks.sw` là khe riêng nên không đụng `tourHooks.stop` của Hầm.

## D-016: Ngồi cabin là chế độ camera `'swRide'`, tư thế đặt trong `SunWheel.update()` chứ không trong `updateCamera()` — 2026-10-23 — Chấp nhận
Bối cảnh: camera phải bám cabin đang quay (tới ×60 ≈ 20 m/s). `updateCamera()` chạy TRƯỚC `bridges[].update()` trong `animate()`, nên nếu đặt tư thế ở đó thì camera lệch cabin đúng một bước `dt` (≈ 0,3–1 m ở ×60) và các thanh vành gần mắt bị giật. Quyết định: `src/bridges/sun-wheel/ride.ts` (`swRide`) giữ trạng thái (cabin, yaw, pitch, chặng bay vào) và tính tư thế; `SunWheel.update()` gọi `swRide.update(dt)` ngay sau `advance(dt)`; nhánh `'swRide'` trong `updateCamera()` rỗng. Chuyển chế độ nằm ở `views/camera.ts`: `enterSwRide()`/`leaveSwRide(restore)`, nút là góc nhìn `data-view="swRide"` (bấm lại = xuống) nên `aria-pressed`, Tour, `selectBridge` dùng lại `setView()`; mọi đường rời chế độ (setView, `flyTo` do swingUI/hrUI, `followScenario`) đi qua `dropRide()` trả `controls.enabled`. Xuống bằng Esc / bấm lại nút = `flyTo` về camera + `maxPolarAngle` đã nhớ lúc lên; đổi góc nhìn khác thì bay thẳng tới góc mới. Cabin đứng thẳng nên chỉ cần tịnh tiến (`swCabinPos`), mắt = tâm cabin + `ride.eyeUp`; vỏ cabin là FrontSide nên nhìn từ trong ra không che cảnh. Hệ quả: không thêm mesh/đèn nên draw call không đổi (ngày = đêm, quay không ảnh hưởng); Tour 6 điểm (GĐ7) gọi `enterSwRide()` từ `tourHooks`; thời tiết (GĐ6) chỉ cần đọc `swRide.active()` để hiện dòng "vòng quay dừng do bão".

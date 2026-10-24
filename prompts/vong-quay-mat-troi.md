# PROMPT: Vòng quay Mặt Trời (Sun Wheel) Đà Nẵng

> Dán toàn bộ file này cho agent lập trình (Claude Code / Copilot) đang mở thư mục `danang-vite`.
> Đọc trước: [.github/copilot-instructions.md](../.github/copilot-instructions.md), [.github/memory-bank/systemPatterns.md](../.github/memory-bank/systemPatterns.md), `activeContext.md`, `decisions.md` (D-009, D-012), [.github/prompts/new-structure.prompt.md](../.github/prompts/new-structure.prompt.md), [.github/instructions/bridges.instructions.md](../.github/instructions/bridges.instructions.md).

---

## 0. Vai trò và mục tiêu

Bạn là kỹ sư đồ hoạ Three.js kiêm kỹ sư kết cấu. Cảnh đã có 4 cầu, Hầm (phương án đề xuất), hai bờ sông và thời tiết. Nhiệm vụ: thêm **Sun Wheel** — vòng quay quan sát ở Asia Park, bờ Tây, phía Nam cầu Trần Thị Lý — gồm **vòng quay + bệ + nhà ga** (không dựng Asia Park).

Người xem phải:
- thấy vòng quay **đang hoạt động**: quay đúng tốc độ thật (15 phút/vòng) hoặc tua nhanh ×10 / ×60, cabin luôn đứng thẳng;
- xem **show LED ban đêm** (13 000 LED trên 32 thanh), vài kiểu, có kiểu đồng bộ với LED riverfront;
- **ngồi trong cabin** (camera đi theo) để ngắm 4 cầu từ độ cao tới ~115 m;
- đi **Tour** có thuyết minh vi/en/ru;
- thấy vòng quay **dừng khi Bão** (theo trạng thái `closed`, như D-012).

**Không làm hỏng những gì đang có:** chuỗi `rand()` có seed, draw call các góc nhìn cũ (ngân sách mục 9), ngày/đêm, thời tiết, Tour, thuyết minh, test hiện tại.

Thứ tự ưu tiên khi thiếu thời gian: **P1** hình học + quay + LOD → **P2** LED đêm + ngồi cabin + thời tiết → **P3** Tour + thuyết minh, kiểu show đồng bộ riverfront.

---

## 1. Số liệu thật — xác minh trước khi ghi vào `config.ts`

Quy tắc của dự án: có nguồn thì ghi nguồn, không có thì ghi `(ước lượng)`. **Không bịa số.**

| Đại lượng | Giá trị | Trạng thái | Nguồn |
|---|---|---|---|
| Chiều cao tổng (đỉnh so với mặt đất) | 115 m | đã có nguồn | [Wikipedia](https://en.wikipedia.org/wiki/Sun_Wheel_(Da_Nang)), [danang.gov.vn](https://danang.gov.vn/web/en/detail?id=15064) |
| Số cabin × sức chứa | 64 × 6 = 384 khách | đã có nguồn | Wikipedia, [vietnamtourism.vn](https://vietnamtourism.vn/en/index.php/news/items/8175) |
| Thời gian một vòng | ≈ 15 phút → ω = 2π/900 ≈ 0,00698 rad/s | đã có nguồn | vietnamtourism.vn |
| Khối lượng | 980 t | một nguồn | [vietnambooking](https://www.vietnambooking.com/du-lich/blog-du-lich/vong-quay-mat-troi-sun-wheel-da-nang.html) |
| Chiếu sáng | 13 000 LED trên 32 thanh chính | một nguồn | vietnambooking |
| Lịch sử | "Igosu 108", Biwako Tower (Shiga, Nhật), mở 26/4/1992, cao 108 m; tháo về Đà Nẵng, dựng trên bệ cao hơn, mở 18/7/2014 | đã có nguồn | Wikipedia, [abandonedkansai](https://abandonedkansai.com/2011/09/23/biwako-tower-igosu-108-amusement-park-ferris-wheel/) |
| Đường kính vành | ≈ 93 m | **ước lượng** — suy từ: 115 = bệ 13 + 2·(R + 4,5 cabin) → R ≈ 46,5. Một nguồn ghi 108 m (nhiều khả năng lẫn với chiều cao ở Nhật); đo ngang trên ảnh `n1` ra ≈ 100 m nhưng ảnh chụp từ dưới lên, có phối cảnh | [hoiandaytrip](https://hoiandaytrip.com/sun-wheel-da-nang/), ảnh `n1` |
| Cao tâm trục | ≈ 64 m (= bệ 13 + cabin 4,5 + R) | **ước lượng** | ảnh `n1` |
| Bệ / sàn lên cabin | cao ≈ 13 m, dài ≈ 100 m (dọc mặt vòng quay); cabin thấp nhất chạm sàn mái bệ | **ước lượng** — đo tỉ lệ trên ảnh `n1`, `n3` | ảnh |
| Vị trí tâm (thật) | **16,040525°N; 108,228459°E** | người dùng cung cấp (Google Maps, 2026-10-22) | — |
| Vị trí so với Cầu Rồng | 2 282 m về Nam, 136 m về Đông (Cầu Rồng 16,06116°N; 108,22719°E) | tính từ hai tọa độ trên | [Structurae](https://structurae.net/structures/dragon-river-bridge) |
| Vị trí trong cảnh | **z ≈ +2 280**; x ≈ −440 | z: lấy theo khoảng cách Nam–Bắc (mô hình coi sông thẳng, trục X = Đông thật). x: **ước lượng** = −(262 + ≈180 m từ mép kè Tây, đọc trên ảnh `a1`), vì sông thật lệch dần về Đông khi đi về phía Nam nên không dùng được độ lệch kinh độ | chờ đo (mục 12b) |
| Hướng mặt phẳng vòng quay | phương vị 83° ↔ 263° (Đông Đông Bắc – Tây Tây Nam); trục quay 173° ↔ 353° | người dùng đo trên ảnh vệ tinh (2026-10-22) | — |
| Hướng trong cảnh | `group.rotation.y = +7°` (0,122 rad): đầu Đông của vòng quay lệch về Bắc (−Z) | quy đổi: hướng phương vị A ↦ (sin A, 0, −cos A) | — |
| Mặt chính | mặt có biển "SUN WHEEL" / logo và quảng trường quay **Nam Đông Nam** (+Z trong cảnh); từ cầu Trần Thị Lý nhìn thấy **mặt sau** | đọc từ ảnh `a1`, `a2` | ảnh |
| Hiện trạng | một số nguồn ghi đã ngừng sau 3/9/2025 | chưa xác nhận | Wikipedia (infobox "Closed"), hoiandaytrip |

Thuyết minh và panel phải nói: "Theo một số nguồn, vòng quay đã tạm ngừng hoạt động từ 9/2025; mô hình thể hiện lúc còn vận hành."

### 1.1 Tư liệu cần người dùng cung cấp (thứ tự ưu tiên)
1. **Tọa độ tâm vòng quay** (Google Maps) và **ảnh vệ tinh** thấy hướng mặt phẳng vòng quay — quan trọng nhất.
2. Ảnh **chính diện** ban ngày, thấy trọn vòng: tỉ lệ đường kính / bệ, đếm nan.
3. Ảnh **nghiêng ≈ 45°**: hai cặp chân chữ A, độ dày vành, giàn.
4. Ảnh **cận chân**: bệ, nhà ga, cầu thang, sàn lên cabin, mái, màu sơn.
5. Ảnh **cận cabin**: hình dạng, màu, kính, cách treo.
6. **Video đêm** 10–30 s mỗi kiểu show LED: màu, chu kỳ.
7. Ảnh **từ cầu Trần Thị Lý nhìn về phía Nam** và **từ bờ Đông**: chỉnh vị trí và kích thước tương đối.
8. Ảnh **từ trong cabin ở đỉnh**: đối chiếu góc nhìn `swTop` / ride.
9. Tài liệu kỹ thuật nếu có: đường kính thật, cao trục, nhà sản xuất Igosu 108.

Thiếu ảnh vẫn làm được với số ước lượng, nhưng hướng mặt vòng quay phải đoán và ghi rõ trong config.

### 1.2 Tư liệu người dùng đã gửi
Ảnh lưu ở `prompts/tham-chieu/sun-wheel/` (đã thêm vào `.gitignore`: ảnh lấy từ nguồn ngoài, có bản quyền, chỉ dùng trên máy để dựng hình; không đưa vào `src/` hay `public/`).

| Mục 1.1 | Nội dung | File | Ngày |
|---|---|---|---|
| 1 | Tọa độ tâm 16,040525; 108,228459. Mặt phẳng phương vị 83°/263°, trục 173°/353° | — | 2026-10-22 |
| 3, 4, 7 | Flycam ban ngày từ phía Nam Đông Nam nhìn về Bắc: thấy vòng quay, bệ, quảng trường, cầu Trần Thị Lý và Cầu Rồng phía sau | `a1-flycam-ngay-nhin-bac.png` | 2026-10-22 |
| 6, 7 | Flycam lúc chạng vạng, cùng hướng: nan LED hồng tím, cabin đỏ | `a2-flycam-dem-nhin-bac.png` | 2026-10-22 |
| — | Phối cảnh **quy hoạch đề xuất** quanh Sun Wheel (Aurora Tower, nhà hát…): chỉ để định vị, **không dựng** | `a3-phoi-canh-quy-hoach-de-xuat.png` | 2026-10-22 |
| 2, 4, 6 | Chính diện ban đêm: đếm cabin, nan, đo tỉ lệ bệ / vành | `n1-chinh-dien-dem.png` | 2026-10-22 |
| 3, 6 | Đứng dưới chân nhìn lên ban đêm: giàn tháp đỡ, vành phụ, biển "SUN WHEEL" | `n2-chan-nhin-len-dem.png` | 2026-10-22 |
| 3, 6 | Nhìn nghiêng ban đêm: chiều sâu tháp đỡ, bệ, hai lầu ở hai đầu | `n3-nghieng-dem.png` | 2026-10-22 |

Còn thiếu: ảnh cận cabin ban ngày (mục 5), video show LED (mục 6, mới có ảnh tĩnh hai kiểu), ảnh trong cabin (mục 8).

### 1.3 Đọc từ ảnh (để dựng hình)
- **Cabin**: 64, treo **ngoài** vành, hình trụ bo tròn có kính. Ngày: vỏ đỏ (`a1`). Đêm: viền LED đỏ quanh thân (`n1`, `n2`). Giá treo là khung tam giác nhỏ nối ra vành.
- **Vành và nan**: vành chính + một **vành phụ** ở khoảng 0,65 R + một vành nhỏ quanh moay-ơ; nan dạng thanh mảnh và cáp chéo (nhiều hơn 32 đường nhìn thấy; 32 thanh chính mang LED theo nguồn). Màu trắng.
- **Tháp đỡ**: không phải hai chân chữ A đơn mà là **giàn tháp hình thang** hai bên mặt vòng quay, có 4–5 tầng giằng ngang và giằng chéo, cùng một **trụ đứng ở giữa** từ moay-ơ xuống bệ (có thể là thang kỹ thuật). Màu trắng, ban đêm được chiếu sáng trắng.
- **Biển hiệu**: chữ "SUN WHEEL" phát sáng trắng ngay dưới moay-ơ, ở mặt Nam (`n1`, `n2`). Ảnh `a1` (gần đây) có logo đỏ của Sun World ở cùng chỗ. Dựng chữ "SUN WHEEL" vẽ bằng canvas; không dùng logo.
- **Bệ / nhà ga**: khối dài màu trắng–xám đá, mặt trước có **3 vòm cuốn**; hai đầu là **tháp vuông có ô tròn**, trên đỉnh là **lầu hai tầng mái** (mái đỏ ban ngày). Sàn mái bệ trồng cây, là nơi lên cabin. Giữa mặt Nam có **cổng vòm trang trí vàng** (sân khấu) nhìn ra quảng trường (`a1`).
- **Quảng trường**: sân lát đá rất rộng ở phía Nam Đông Nam của bệ (`a1`), có cột đèn.
- **Đêm**: kiểu 1 — kết cấu chiếu trắng, cabin đỏ, viền vành đỏ (`n1`–`n3`); kiểu 2 — nan và vành LED hồng tím, cabin đỏ (`a2`). Có đèn rọi trời màu xanh (`n1`, `n3`); nếu làm thì chỉ dùng mesh nón phát sáng cộng màu, **không** dùng `SpotLight` (P3).
- **Xung quanh** (`a1`): phía Bắc–Tây là hồ/kênh nhánh và khu vui chơi Asia Park. Ngoài phạm vi: cảnh không có kênh này, không dựng.

---

## 2. Hình học

| Bộ phận | Mô tả | Cách dựng | Nhóm |
|---|---|---|---|
| Quảng trường | sân lát đá phía Nam Đông Nam, cột đèn (emissive) | `boxAt` vertex-colored | tĩnh, gộp bê tông |
| Bệ + nhà ga | khối ≈ 100 × 13 m, 3 vòm cuốn mặt trước, sàn mái có cây, cổng vòm vàng giữa mặt Nam | `boxAt`, `prepColored` (`src/common/geometry.ts`) | tĩnh, gộp bê tông |
| Hai tháp đầu bệ + lầu | tháp vuông có ô tròn, lầu hai tầng mái đỏ | `boxAt`, `loftOct`/nón dẹt | tĩnh, gộp bê tông |
| Tháp đỡ | 2 giàn hình thang (mỗi bên mặt vòng quay), 4–5 tầng giằng ngang + chéo, trụ đứng giữa | `taperedTube` + thanh hộp | tĩnh, gộp thép |
| Trục, moay-ơ | ống theo phương trục quay (173°/353°), moay-ơ | tube + cylinder | tĩnh (trục) / quay (moay-ơ) |
| Vành | vành chính (2 vòng song song + giàn), vành phụ ≈ 0,65 R, vành nhỏ quanh moay-ơ | `TubeGeometry` theo đường tròn, gộp | quay |
| Nan | 32 thanh chính mang LED + cáp chéo mảnh | tube mảnh, gộp | quay |
| Biển "SUN WHEEL" | chữ vẽ canvas, dưới moay-ơ, mặt Nam, phát sáng | plane + canvas texture | tĩnh, details |
| 64 cabin | treo ngoài vành, vỏ đỏ, kính, viền LED đỏ, luôn đứng thẳng | `InstancedMesh` | details |

- Mesh quay: vành + nan + moay-ơ gộp **một mesh** (`mergeGeometries`). Thuộc tính đỉnh `aSpoke` (0–31, −1 cho vành/giàn) và `aR` (0–1 dọc nan) để shader LED.
- Cabin: một `InstancedMesh` 64; mỗi khung cập nhật `instanceMatrix` theo góc vành, hướng luôn thẳng đứng + lắc theo `windFx`.
- Texture (kính cabin, chữ "SUN WHEEL" nếu có) vẽ bằng canvas. Không ảnh ngoài.

---

## 3. Chuyển động

- `θ += ω · speed · dt`, `speed ∈ {0, 1, 10, 60}`; đổi tốc độ mượt bằng `toward()`.
- Cabin i ở góc `θ + i·2π/64`, vị trí `tâm + R·(cos, sin)` trong mặt phẳng vòng quay, không xoay theo vành.
- `?test`: API `sunWheel.setAngle(rad)`, `setSpeed(k)`, `angle()`, `cabinUp(i)` để test không phụ thuộc đồng hồ thật.
- Không dùng `rand()`. Phần ngẫu nhiên (nếu có) dùng `rng(seed)` riêng.

---

## 4. LED ban đêm

- LED nằm trong mesh quay: emissive trong shader, nhân `shared.uNight`, **không thêm draw call**, không thêm `PointLight`/`SpotLight`.
- Kiểu show (uniform `uShow`, `uTime`):
  1. **Trắng** — kết cấu sáng trắng, cabin và viền vành đỏ (mặc định; ảnh `n1`–`n3`)
  2. **Hồng tím** — nan và vành LED hồng tím, cabin đỏ (ảnh `a2`)
  3. Tia chạy từ moay-ơ ra vành
  4. Nhịp tim — đồng bộ với LED trái tim riverfront (đọc pha từ module riverfront, không sửa chuỗi ngẫu nhiên của nó)
  5. Tắt
- Viền LED đỏ của cabin nằm trong vật liệu cabin (emissive theo `uNight`), không thêm mesh.
- Độ sáng không làm bloom cháy màn hình; kiểm bằng ảnh `swNight`.

---

## 5. Kiến trúc code

```
src/bridges/sun-wheel/
  index.ts       re-export SunWheel, SW
  profile.ts     deriveSunWheel(): R, cao trục, góc cabin
  materials.ts   thép, bê tông, kính cabin, LED (bridgePatch, weather: true)
  structure.ts   swBuildBase/Station/Legs/Axle — phần tĩnh
  wheel.ts       swBuildWheel — vành + nan + moay-ơ (một mesh quay)
  cabins.ts      swBuildCabins — InstancedMesh 64
  ledShow.ts     swLedShow — uniform show
  ride.ts        swRide — ngồi cabin
  SunWheel.ts    class SunWheel extends BridgeBase
```

- Dùng `BridgeBase` (`src/common/BridgeBase.ts`) dù không phải cầu: có sẵn LOD, `life`, `closable`, panel, `bridges[]`. Ghi **D-014** vào `decisions.md`.
- `CONFIG.sunWheel` trong `src/config.ts`: mọi thông số mục 1–4, chú thích tiếng Việt, đơn vị, nguồn hoặc `(ước lượng)`.
- `main.ts`: `new SunWheel()` **sau** `buildRiverfront()` và **trước** `buildWeather()` (thời tiết chụp vật liệu gốc); thêm vào `bridges[]` và `window.__app.sunWheel`.
- Dọn: vùng z ≈ 2 280, x < −262 hiện chỉ có đất phẳng, kè, dải đi bộ (khu phố |z| < 1 800, đường Bạch Đằng tới z = 2 600, cây/đèn kè tới z = 2 300). Vẫn khai báo rect và dùng `clearRects()` (`src/environment/riverfront/clearance.ts`), xử lý cả `near` và `far` của `THREE.LOD`.
- LOD: `details` (cabin, nhà ga chi tiết) ẩn khi xa hơn ≈ 1 500 m; mesh tĩnh gộp + mesh vành/LED luôn hiện (điểm mốc). Tất cả vào `noReflect` (layer 1).
- Ngồi cabin (`ride.ts`): camera gắn cabin, tắt OrbitControls, kéo chuột nhìn quanh, Esc / đổi góc nhìn / bắt đầu Tour khác → thoát và trả OrbitControls như cũ. Mẫu: lái xe trong hầm (`hrDrive`).

---

## 6. Thời tiết

- Thêm `weatherFx.wheelStopped` vào `src/core/shared.ts`, đặt trong `updateHooks()` (`src/environment/weather/effectsHooks.ts`) theo `current.closed` của preset Bão. **Không có ngưỡng gió** (D-012).
- Khi dừng: `speed` → 0 bằng `toward()` trong ≈ 10 s (ước lượng); hết bão quay lại tốc độ người dùng chọn.
- Cabin lắc theo `windFx` (biên độ ước lượng, trong config); vật liệu `registerWet`.
- Đang ngồi cabin khi bão tới: vòng quay dừng, cabin vẫn lắc, hiện dòng thông báo (i18n).
- Preset "Hiện trạng" không đổi gì.

---

## 7. UI, góc nhìn, i18n, Tour

- `index.html`: nhóm nút `sw` (`data-list`), góc nhìn `swOverview`, `swFront`, `swBase`, `swFromTTL`, `swNight`, `swTop`; nút Ngồi cabin; ô chọn tốc độ (Dừng / ×1 / ×10 / ×60); ô chọn show LED.
- Panel: `SPEC_KEYS` (`src/ui/panel.ts`), `BRIDGE_HOME` (`src/views/presets.ts`), `src/ui/setupUI.ts`.
- i18n: mọi khoá mới có đủ 9 locale `src/i18n/locales/{vi,en,ko,ja,zh,th,ar,hi,ru}.json` (`ar` RTL), thêm bằng script kiểu `scripts/add-weather-locales.mjs`.
- Tour 6 điểm (`src/views/tourStops.ts`, `TOUR_DEFS`, khoá `swStops`):
  1. Toàn cảnh từ sông
  2. Chân vòng quay và nhà ga
  3. Lịch sử: Igosu 108 → Đà Nẵng (và ghi chú hiện trạng)
  4. Lên cabin, tới đỉnh (`tourHooks` chuyển sang ride)
  5. Nhìn về 4 cầu
  6. Show LED đêm
- Thuyết minh vi/en/ru: `npm run gen:voice`, commit `public/voice/`.

---

## 8. (Để trống — không có âm thanh riêng ở bản này)

---

## 9. Hiệu năng và bất biến

| Góc nhìn | Ngân sách draw call (ngày và đêm) |
|---|---|
| Góc cũ (bảng `tests/KET-QUA.md`) | ≤ chuẩn **+2** (người dùng đã duyệt) |
| Góc mới `sw*` | ≤ 6 cho phần vòng quay |
| Ngày ↔ đêm | chênh 0 (LED không thêm mesh) |
| Preset thời tiết | không thêm so với `now` |

Bất biến khác: không đổi thứ tự `build*()`, không thêm `rand()`, không thư viện runtime, không ảnh ngoài, không đèn mới, mọi số ở `config.ts`.

---

## 10. Kế hoạch theo giai đoạn (nhánh `feature/sun-wheel`, mỗi giai đoạn một commit)

Tạo nhánh từ `main` sau khi thời tiết đã merge; nếu chưa merge thì từ `feature/weather` sau commit GĐ6 thời tiết (cần `weatherFx`).

| GĐ | Nội dung | Kiểm tra |
|---|---|---|
| 0 | Đặc tả này; đối chiếu ảnh, tọa độ người dùng gửi; cập nhật mục 1 | — |
| 1 | `CONFIG.sunWheel` + `deriveSunWheel()`, khung `SunWheel` rỗng, nối `main.ts`, rect dọn | `build`, `test:drawcalls` chênh 0 |
| 2 | Hình học tĩnh + vành/nan + 64 cabin instanced + LOD | ảnh `tests/screens/sunwheel/`, góc cũ ≤ +2 |
| 3 | Quay, cabin đứng thẳng, tốc độ, góc nhìn `sw*` | `test:sunwheel` (chu kỳ, cabin) |
| 4 | LED đêm + 5 kiểu show + đồng bộ riverfront | ảnh đêm, chênh ngày/đêm 0 |
| 5 | Ngồi cabin | `test:sunwheel` phần ride |
| 6 | Thời tiết: dừng khi bão, lắc gió, mặt ướt | `test:weather`, `test:sunwheel` phần bão |
| 7 | Panel, i18n 9 ngôn ngữ, Tour + thuyết minh vi/en/ru | `test:tour`, `test:voice` |
| 8 | `tests/KET-QUA.md` (thêm `sw*`), README mục Cấu trúc, memory bank | đủ bộ test |

---

## 11. Kiểm tra bắt buộc: `tests/sunwheel-check.mjs` (`npm run test:sunwheel`)

1. ×1: sau 90 s mô phỏng góc ≈ 2π/10 (sai ≤ 1 %); ×60 nhanh gấp 60.
2. 64 cabin: trục up lệch ≤ 2° so với Y khi không gió.
3. Đỉnh cabin cao nhất ≈ 115 m (± 1 m); không vật nào trong hành lang Hầm |z + 1700| < 30.
4. Ride: vào → camera bám cabin; ra → OrbitControls trả như cũ.
5. Bão: `wheelStopped` bật, tốc độ → 0 đúng thời gian; về `now` quay lại; `now` không đổi cảnh.
6. Draw call theo mục 9.
7. Console sạch; 9 locale đủ khoá.

Chạy thêm: `test:drawcalls`, `test:tour`, `test:weather`, `test:riverfront`, `test:tunnel`, `test:voice`.

---

## 12b. Câu hỏi đã trả lời (2026-10-22)

1. Hiện trạng: **đang hoạt động**, kèm ghi chú nguồn báo đã ngừng từ 9/2025.
2. Phạm vi: **vòng quay + bệ + nhà ga**, không dựng Asia Park.
3. Tương tác: **cả bốn** — ngồi cabin, tốc độ thật/tua nhanh, show LED, Tour + thuyết minh.
4. Draw call góc cũ: **≤ +2**.

5. Tọa độ và hướng (2026-10-22): xem mục 1 và 1.2.

Còn chờ (không chặn GĐ1, có giá trị ước lượng):
- Khoảng cách từ tâm vòng quay tới mép nước sông Hàn, đo vuông góc bờ trên Google Maps → chốt `x`.
- Khoảng cách từ tâm vòng quay tới tim cầu Trần Thị Lý → kiểm tra `z` (cảnh đặt Trần Thị Lý ở z = +1 300).
- Đường kính hoặc chiều cao trục nếu tìm được nguồn.
- Ảnh cận cabin ban ngày, video show LED, ảnh trong cabin.

---

## 13. Báo cáo khi xong

Liệt kê: đã làm / còn thiếu, draw call trước/sau từng góc, số nào là ước lượng, kết quả test dán nguyên văn (kể cả lỗi).

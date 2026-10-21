# PROMPT: Thời tiết Đà Nẵng và ảnh hưởng tới các cây cầu (mùa hè, mùa mưa: mưa, gió, bão)

> Dán toàn bộ file này cho agent lập trình (Claude Code / Copilot) đang mở thư mục `danang-vite`.
> Đọc trước: [.github/copilot-instructions.md](../.github/copilot-instructions.md), [.github/memory-bank/systemPatterns.md](../.github/memory-bank/systemPatterns.md), `activeContext.md`, `decisions.md` (D-002, D-003, D-009).

---

## 0. Vai trò và mục tiêu

Bạn là kỹ sư đồ hoạ Three.js kiêm kỹ sư cầu. Cảnh hiện có một kiểu trời duy nhất: nắng nhẹ, mây mỏng, gió lặng. Chỉ có trục **ngày ↔ đêm** ([src/core/dayNight.ts](../src/core/dayNight.ts)).

**Nhiệm vụ:** thêm trục thứ hai là **thời tiết**. Người xem chọn được mùa và hiện tượng, và **thấy rõ thời tiết tác động lên từng cây cầu**: kết cấu, giao thông, vận hành, ánh sáng. Bốn trạng thái:

| Trạng thái | Thời kỳ ở Đà Nẵng (cần xác minh, mục 1) | Cảnh nhìn thấy | Ảnh hưởng tới cầu (trọng tâm) |
|---|---|---|---|
| **Nắng hè** | khoảng tháng 4–8 | Trời xanh gắt, nắng chói, hơi nóng bốc trên mặt đường (ảo ảnh mặt đường), sông xanh trong, ít mây | Giãn nở nhiệt mặt cầu, cáp Thuận Phước võng thêm, khe co giãn hẹp lại. Phun lửa Cầu Rồng vẫn diễn |
| **Mưa** (mùa mưa) | khoảng tháng 9–12 | Màn mưa xiên, mặt đường và mặt cầu ướt bóng, phản chiếu đèn ban đêm, sương mù, sông đục màu phù sa, mực nước dâng nhẹ | Xe chạy chậm, bật đèn cả ban ngày. Dây văng Trần Thị Lý **rung do mưa–gió** (hiện tượng thật). Phun lửa có thể tạm dừng |
| **Gió mùa** (Đông Bắc) | khoảng tháng 10–3 | Cây nghiêng và lắc, sóng sông lớn, mây chạy nhanh, thuyền tròng trành, lửa và nước phun bị gió thổi lệch | Gió tăng theo cao độ mặt cầu. Hanger, dây văng và dầm Thuận Phước dao động. Cầu sông Hàn **không quay** khi gió vượt ngưỡng |
| **Bão** | khoảng tháng 9–11 | Trời tối sầm giữa ngày, mưa trắng trời, gió giật, chớp và sấm, nước dâng, sóng bạc đầu ở cửa sông | Cấm lưu thông qua cầu, cấm thuyền, dừng trình diễn, dầm và cáp dao động mạnh. Có **kịch bản bão** tự chạy từ lúc báo bão tới sau bão (mục 6) |

Chế độ **"Hiện trạng"** (mặc định) phải giữ **nguyên từng điểm ảnh và từng draw call** như hiện nay.

**Không làm hỏng những gì đang có:** chuỗi `rand()` có seed, draw call các góc nhìn cũ, ngày/đêm, Tour, thuyết minh, test hiện tại.

Thứ tự ưu tiên khi thiếu thời gian: **P1** khung trạng thái + khí quyển + mưa + mặt ướt → **P2** gió (cây, sóng, cáp) + bão (chớp, đóng cầu, nước dâng) + bảng "Ảnh hưởng tới cầu" → **P3** kịch bản bão có lời dẫn, nắng hè chi tiết (ảo ảnh mặt đường, số giãn nở), âm thanh, sau bão (cây đổ).

---

## 1. Số liệu thật — xác minh trước khi ghi vào `config.ts`

Quy tắc của dự án: có nguồn thì ghi nguồn, không có thì ghi `(ước lượng)`. **Không bịa số.** Bảng dưới là điểm xuất phát. Mọi mục "cần xác minh" phải tra rồi cập nhật lại bảng này, kèm link.

### 1.1 Khí hậu Đà Nẵng
| Đại lượng | Giá trị ban đầu | Trạng thái | Nguồn gợi ý |
|---|---|---|---|
| Mùa khô / nóng | khoảng tháng 1–8, nóng nhất tháng 5–8 | cần xác minh | Đài KTTV khu vực Trung Trung Bộ; QCVN 02:2022/BXD (số liệu điều kiện tự nhiên dùng trong xây dựng) |
| Nhiệt độ không khí cao nhất mùa hè | khoảng 35–38 °C, có ngày gần 40 °C | cần xác minh | như trên |
| Nhiệt độ mặt đường / mặt cầu dưới nắng | cao hơn không khí khoảng 10–20 °C | cần xác minh | tài liệu mặt đường bê tông nhựa |
| Mùa mưa | khoảng tháng 9–12, mưa nhiều nhất tháng 10–11 | cần xác minh | Đài KTTV |
| Lượng mưa năm | khoảng 2.000–2.500 mm | cần xác minh | QCVN 02:2022/BXD |
| Gió mùa Đông Bắc | khoảng tháng 10–3 | cần xác minh | Đài KTTV |
| Mùa bão ảnh hưởng Đà Nẵng | tập trung tháng 9–11 | cần xác minh | Tổng cục KTTV |

### 1.2 Thang gió (đã chuẩn hoá, dùng được ngay)
Thang Beaufort, vận tốc ở độ cao 10 m. Việt Nam dùng thang này trong bản tin bão.

| Cấp | m/s | Mô tả dùng trong UI |
|---|---|---|
| 0–3 | < 5,5 | lặng / gió nhẹ |
| 4–5 | 5,5–10,7 | gió vừa |
| 6 | 10,8–13,8 | gió mạnh |
| 7 | 13,9–17,1 | gió rất mạnh (áp thấp nhiệt đới cấp 6–7) |
| 8–9 | 17,2–24,4 | bão |
| 10–11 | 24,5–32,6 | bão mạnh |
| 12–15 | 32,7–50,9 | bão rất mạnh |
| ≥ 16 | ≥ 51,0 | siêu bão |

Cách phân cấp bão theo Quyết định 18/2021/QĐ-TTg: **cần xác minh** lại số hiệu văn bản và các ngưỡng trước khi ghi nguồn.

### 1.3 Cường độ mưa
Mưa nhỏ / vừa / to / rất to theo lượng mưa 24 h (khoảng 16–50 / 51–100 / > 100 mm cho "vừa / to / rất to"). **Cần xác minh** theo quy định phân loại của ngành KTTV. Trong cảnh chỉ cần ánh xạ 4 mức sang mật độ hạt mưa và tầm nhìn.

### 1.4 Sự kiện tham khảo (dùng cho lời dẫn và kịch bản, xác minh ngày, số liệu)
- Bão **Xangsane** (bão số 6/2006), đổ bộ Đà Nẵng khoảng 30/9–1/10/2006: một trong những cơn bão mạnh nhất từng vào Đà Nẵng.
- Bão **Nari** (bão số 11/2013), khoảng 15/10/2013.
- Bão **Noru** (bão số 4/2022), khoảng 27–28/9/2022: thành phố cấm lưu thông qua các cầu lớn trong lúc bão. **Cần xác minh** danh sách cầu và giờ cấm.
- Mưa lớn lịch sử khoảng 14–15/10/2022: nhiều tuyến phố trung tâm ngập sâu. **Cần xác minh** lượng mưa.

### 1.5 Số liệu kỹ thuật cầu dùng cho tính toán hiển thị
| Đại lượng | Giá trị | Trạng thái |
|---|---|---|
| Hệ số giãn nở nhiệt thép | 12 × 10⁻⁶ /°C | giá trị phổ biến; cần xác minh theo TCVN 11823:2017 |
| Hệ số giãn nở nhiệt bê tông | 10–11 × 10⁻⁶ /°C | như trên |
| Gió theo cao độ: v(z) = v₁₀ · (z / 10)^α | α ≈ 0,12 (mặt nước, địa hình trống) | cần xác minh theo TCVN 2737 (bản mới nhất) |
| Vùng áp lực gió Đà Nẵng | vùng II.B (W₀ ≈ 95 daN/m²) | cần xác minh theo TCVN 2737 bản hiện hành |
| Rung dây văng do mưa–gió (rain-wind induced vibration) | thường gặp khi gió khoảng 6–18 m/s kèm mưa nhỏ–vừa, dây nghiêng 20–45°, tần số khoảng 1–3 Hz | hiện tượng có thật, có nhiều tài liệu; **ngưỡng cụ thể cần xác minh** |
| Vận tốc gió tới hạn flutter của Cầu Thuận Phước | — | **không có nguồn: không ghi số.** Chỉ dùng mô tả định tính |
| Ngưỡng cấm lưu thông qua cầu ở Đà Nẵng | — | **cần xác minh** (thông báo của UBND / Sở GTVT khi có bão). Chưa có nguồn thì để thông số `(ước lượng)` và hỏi người dùng (mục 11) |
| Ngưỡng gió dừng quay Cầu sông Hàn | — | **cần xác minh** (quy trình vận hành cầu quay). Chưa có nguồn thì để `(ước lượng)` |

### 1.6 Ước tính có thể tính ngay (ghi "tính gần đúng" trong UI)
Dùng thông số đang có trong [src/config.ts](../src/config.ts):

- **Giãn nở nhiệt Cầu Rồng** (thép, dài 666 m), từ 25 °C lên 38 °C (ΔT = 13): ΔL = 666 × 12·10⁻⁶ × 13 ≈ **0,10 m** cho toàn cầu, chia cho các khe co giãn.
- **Cáp chủ Thuận Phước võng thêm khi nóng**. Gần đúng parabol: S ≈ L·(1 + 8/3·(f/L)²) và Δf ≈ 3·L·ΔS / (16·f). L = 405 m, f = L / 9,5 ≈ 42,6 m nên S ≈ 417 m. Với ΔT = 25 °C: ΔS ≈ 417 × 12·10⁻⁶ × 25 ≈ 0,125 m, suy ra **Δf ≈ 0,22 m**. Cách tính này bỏ qua chuyển vị đỉnh tháp và độ cứng dầm.
- **Gió ở cao độ mặt cầu** khi v₁₀ = 25 m/s (bão cấp 10), α = 0,12:

| Vị trí | z (m) | hệ số (z/10)^0,12 | v (m/s) |
|---|---|---|---|
| Mặt Cầu Rồng | ≈ 10 (`deckMidY`) | 1,00 | 25 |
| Mặt Cầu sông Hàn | 13,8 | 1,04 | 26 |
| Mặt Trần Thị Lý | ≈ 13,2 | 1,03 | 26 |
| Mặt Thuận Phước | 31,6 | 1,15 | 29 |
| Đỉnh tháp Trần Thị Lý | 145 | 1,38 | 34 |
| Đỉnh tháp Thuận Phước | 91,5 | 1,30 | 33 |

Các số này được tính trong module thuần `impact.ts` (mục 5.2), không ghi cứng.

---

## 2. Từng cây cầu chịu thời tiết thế nào (kịch bản nhìn thấy được)

Biên độ dao động thật chỉ vài cm. Muốn **thấy được**, cảnh nhân biên độ với **hệ số phóng đại** (mặc định ×20, chỉnh trong config). UI ghi rõ "phóng đại ×20" mỗi khi có hiển thị dao động. Đây là mô phỏng trực quan, không phải phân tích kết cấu. Lời dẫn và UI phải nói rõ điều này.

### 2.1 Cầu Rồng (vòm thép hình rồng, `src/bridges/dragon/`)
- **Nắng hè:** vảy rồng (`MAT.scale`, kim loại 0,92) lóa nắng mạnh hơn. Bảng ảnh hưởng hiện "giãn nở ≈ +10 cm toàn cầu (tính gần đúng)".
- **Mưa:** thân rồng và mặt cầu ướt bóng, LED viền thân (`MAT.ledRail`) phản chiếu trên mặt đường ướt ban đêm. Màn **phun lửa bị gió mưa đánh dạt**: hạt lửa có thêm vận tốc gió. Khi mưa to hoặc gió ≥ ngưỡng thì trình diễn **tạm dừng**, dòng `showState` hiện "Tạm dừng do thời tiết". Thực tế có dừng hay không: **cần xác minh**.
- **Gió:** râu rồng (`whiskerGroup`) đung đưa mạnh hơn theo gió. Lửa và tia nước lệch theo hướng gió, sương nước bay xa.
- **Bão:** cấm lưu thông. Xe trên trục Cầu Rồng (`PATHS.axis`) được dọn dần, người đi bộ biến mất. LED thân rồng vẫn sáng (an toàn hàng hải, cần xác minh).

### 2.2 Cầu Thuận Phước (cầu treo 405 m ở cửa sông, lộ gió nhất)
- **Nắng hè:** cáp chủ võng thêm khoảng 0,22 m (tính gần đúng), nhân hệ số phóng đại khi bật "Ảnh hưởng tới cầu".
- **Gió / bão:** chịu gió mạnh nhất vì mặt cầu cao 31,6 m và đứng ngay cửa biển. Hiển thị:
  - **hanger** dao động ngang, hai đầu ngàm, biên độ lớn nhất ở giữa thanh;
  - **dầm** lắc ngang và xoắn nhẹ (dầm hộp thép khí động). Lời dẫn giải thích vì sao dầm có tiết diện khí động: bài học cầu Tacoma Narrows 1940;
  - đèn báo hàng không trên đỉnh tháp vẫn chớp, thấy rõ qua mưa.
- **Bão:** cấm lưu thông, xe biến mất, thuyền vùng cửa sông về bến. Sóng bạc đầu dày nhất ở góc nhìn này.

### 2.3 Cầu Trần Thị Lý (dây văng một tháp nghiêng 145 m)
- **Mưa + gió vừa (6–18 m/s): điểm nhấn kỹ thuật của tính năng.** Dây văng rung theo **cơ chế mưa–gió**: nước mưa chảy thành dòng trên mặt dây làm đổi tiết diện khí động, khiến dây rung mạnh ở gió vừa, **mạnh hơn cả lúc gió bão không mưa**. Mô phỏng: biên độ dây cực đại khi (mưa > 0,2 và gió trong khoảng ngưỡng), giảm khi gió quá mạnh hoặc hết mưa. Ống HDPE gần neo (`hdpeR`, `hdpeLen` trong config) là chỗ đặt giảm chấn trong thực tế. Bảng ảnh hưởng ghi "rung dây do mưa–gió" và biện pháp: gân xoắn trên ống bọc, giảm chấn.
- **Gió mạnh:** đỉnh tháp chịu khoảng 1,38 lần gió mặt đất. Tháp không lắc thấy được (bê tông cứng), chỉ dây dao động.
- **Bão:** cấm lưu thông, cầu đi bộ Nguyễn Văn Trỗi (`nvt`) vắng người.

### 2.4 Cầu sông Hàn (cầu quay)
- **Gió ≥ ngưỡng quay** (ước lượng, xác minh): `SwingController.start()` từ chối. UI cầu quay hiện "Không quay cầu: gió cấp N". Nếu đang mở thì **đóng sớm** (`requestClose`) khi gió vượt ngưỡng. Tour Cầu sông Hàn (điểm `swing: true`) vẫn chạy, nhưng hiện chú thích "tạm hoãn quay do thời tiết" thay vì quay.
- **Mưa:** dây văng đỏ (`stay`) và tháp xanh ướt bóng. Đèn tín hiệu, đèn hàng hải nổi rõ trong mưa đêm.
- **Bão:** cấm lưu thông, tàu cao (`ship`) không qua luồng.

### 2.5 Hầm vượt sông Hàn (phương án đề xuất, chưa xây)
- Bên trong hầm **không mưa, không gió**: màn mưa tắt khi camera ở trong ống hầm (dùng `hrDrive` / vị trí camera so với `profile`).
- **Mưa to / bão:** nước chảy xuống dốc hầm hở, **gờ chắn ngập** `floodSill = 1,0 m` (đã có trong config) giữ nước ở đỉnh dốc. Mái lam (`louverLen`) ướt. Bảng ảnh hưởng ghi "hầm vẫn lưu thông, bơm thoát nước làm việc (phương án đề xuất)". Mọi chữ về hầm phải giữ nhãn **"phương án đề xuất"**.

### 2.6 Sông, bờ, phố (bối cảnh)
- **Mặt nước** ([src/core/water.ts](../src/core/water.ts)): màu đổi xanh trong (hè) → nâu phù sa (mưa, bão). `distortionScale` và tốc độ trôi pháp tuyến tăng theo gió. Mực nước `water.position.y` dâng tối đa khoảng +1,2 m khi bão (ước lượng; phải thấp hơn `landY = 2,5`).
- **Thuyền** ([src/environment/traffic.ts](../src/environment/traffic.ts), [src/common/boats.ts](../src/common/boats.ts)): biên độ tròng trành tăng theo gió (đang là 0,012–0,02 rad). Khi bão thì về bến: dừng, ẩn dần.
- **Cây** ([src/environment/trees.ts](../src/environment/trees.ts)): tán cây tròn và dừa nghiêng theo gió, lắc theo cơn giật. Sau bão có vài cây đổ (P3).
- **Riverfront:** LED trái tim vẫn chạy khi mưa (rất đẹp trên mặt nước đêm mưa). Khi bão thì quảng cáo tắt (`setAdsEnabled(false)`), trả lại trạng thái cũ khi hết bão.

---

## 3. Mô hình trạng thái thời tiết

### 3.1 Tham số liên tục (không lưu "mùa" rời rạc trong code hiển thị)
```ts
interface WeatherParams {
  temp: number;      // °C — nhiệt độ không khí (giãn nở nhiệt, ảo ảnh mặt đường)
  rain: number;      // 0 → 1 — cường độ mưa (0 tạnh, 1 mưa rất to)
  wind: number;      // m/s ở 10 m — gió trung bình
  gust: number;      // m/s — biên độ gió giật cộng thêm
  windDir: number;   // rad — hướng gió THỔI TỚI (0 = từ +X / Đông sang), theo trục cảnh
  cloud: number;     // 0 → 1 — độ phủ mây
  haze: number;      // 0 → 1 — mù nóng (hè)
  level: number;     // m — mực nước sông dâng thêm
  lightning: number; // 0 → 1 — tần suất chớp
  closed: boolean;   // cấm lưu thông qua cầu (suy ra từ gió, hoặc kịch bản ép)
}
```
- `weather.current` tiến dần về `weather.target` theo hằng số thời gian riêng từng tham số, giống `stepNight`. Mưa tới nhanh (khoảng 4 s), **mặt ướt `wet` khô chậm** (khoảng 40 s sau khi tạnh), nước dâng và rút chậm (khoảng 30 s). Tất cả trong config.
- `wet` là biến dẫn xuất (trễ theo `rain`), không do người dùng đặt.
- Gió tức thời: `windNow = wind + gust · g(t)`, với `g(t)` là nhiễu 1D mượt, hạt giống riêng. **Không dùng `rand()`**: dùng `rng(seed)` dựng bảng nhiễu một lần, hoặc tổng các sin không thông ước.

### 3.2 Preset (đặt trong `CONFIG.weather.presets`)
| Preset | temp | rain | wind | gust | cloud | haze | level | lightning |
|---|---|---|---|---|---|---|---|---|
| `now` (Hiện trạng, mặc định: **no-op**, không áp gì) | — | — | — | — | — | — | — | — |
| `summer` (Nắng hè) | 37 | 0 | 3 | 1 | 0,1 | 0,6 | 0 | 0 |
| `rain` (Mưa) | 26 | 0,7 | 6 | 3 | 0,85 | 0 | 0,4 | 0 |
| `monsoon` (Gió mùa Đông Bắc) | 22 | 0,25 | 14 | 5 | 0,7 | 0 | 0,2 | 0 |
| `storm` (Bão) | 25 | 1 | 28 | 10 | 1 | 0 | 1,2 | 0,8 |

Tất cả là `(ước lượng)`, trừ khi tìm được nguồn ở mục 1. Người xem có thêm **thanh cường độ** 0–100 % nhân lên rain/wind/gust/level của preset đang chọn. Ví dụ "Mưa" 30 % là mưa nhỏ, 100 % là mưa rất to.

---

## 4. Hiệu ứng hình ảnh (cách làm cụ thể)

### 4.1 Nguyên tắc ghép với ngày/đêm (quan trọng)
`applyNight(m, time)` **ghi đè mỗi khung hình** các giá trị: màu sương mù, `hemi`, `sun.intensity`, `toneMappingExposure`, màu nước, độ mờ mây. Vì vậy:
1. Gọi `applyWeather(w, m, time)` **ngay sau** `applyNight()` trong `animate()`. Weather chỉ **điều biến** (nhân, lerp) các giá trị applyNight vừa đặt. Khi về `now`, applyNight khung sau tự trả về giá trị cũ, không cần khôi phục.
2. Các giá trị applyNight **không** đặt lại (mật độ sương `FogExp2.density`, uniform `Sky` turbidity/rayleigh/mie, `water.distortionScale`, `water.size`, `water.position.y`, màu mây, `roughness` của vật liệu đường, `MAT.scale`…) phải được **chụp giá trị gốc lúc `buildWeather()`** và trả **đúng** giá trị khi weather = `now`. Đây là cạm bẫy đã biết (xem `test:tunnel` với clippingPlanes).
3. Không thêm `PointLight`/`SpotLight`. Chớp làm bằng xung `hemi.intensity` + `toneMappingExposure` + mesh tia chớp emissive.

### 4.2 Khí quyển (`atmosphere.ts`): P1, **0 draw call mới**
| Thành phần | Nắng hè | Mưa | Bão |
|---|---|---|---|
| `fog.density` (gốc 0,00016) | ×1,3 (mù nóng) | ×5 → ×8 theo rain | ×10 |
| Màu sương | lerp về be nóng `#e8dcc4` theo haze | lerp về xám xanh `#8c9aa3` | `#5d6870` |
| `Sky` turbidity / rayleigh | 3 / 1,0 (trời gắt, trong) | 12 / 3 | 20 / 4 |
| `sun.intensity` | ×1,15 | × (1 − 0,85·cloud) | × 0,1 |
| `hemi.intensity` | ×1,05 | ×0,7, màu xám | ×0,5 |
| `toneMappingExposure` | ×1,08 | ×0,9 | ×0,8 (+ xung khi chớp) |
| Mây (`clouds` InstancedMesh) | opacity × 0,3 | opacity → 1, màu xám đậm | màu gần đen, xoay chậm toàn cụm theo gió |
| Nước | xanh trong `#2f6f6a`, distortion 2,0 | nâu `#5a5a3e`, distortion 4 | nâu đục `#4a4433`, distortion 7, size 0,4 |

Bóng đổ mờ dần khi cloud > 0,7 (giảm `sun.intensity` là đủ, **không** tắt `castShadow`: nút "Bóng đổ" là của người dùng).

### 4.3 Mưa (`rain.ts`): P1, **+1 draw call khi mưa, 0 khi tạnh**
- **Một** `InstancedMesh` gồm N vệt mưa, mỗi vệt là một quad mảnh khoảng 0,02 × 0,5–1,2 m, quay mặt theo camera trong vertex shader. N trong config (đề xuất 6.000, giảm còn 3.000 nếu SwiftShader quá chậm).
- **Không cập nhật CPU mỗi khung.** Vị trí gốc các hạt sinh một lần bằng `rng(seed)` trong hộp 160 × 80 × 160 m. Vertex shader tính `p = mod(p0 + vec3(wx, -vFall, wz) * uTime, box) - box/2 + uCamSnap`, với `uCamSnap` là vị trí camera làm tròn theo lưới. Mưa xiên theo `windNow` (góc nghiêng = atan(wind / vFall), vFall ≈ 9 m/s).
- Số hạt hiển thị điều khiển bằng `mesh.count = round(N · rain)` (không tạo lại buffer). Khi rain = 0 thì `visible = false`.
- `layers.set(1)` (không vẽ vào phản chiếu nước), `castShadow = false`, `frustumCulled = false`, `depthWrite = false`, `transparent`. Màu sáng hơn ban đêm gần đèn: cộng nhẹ `uNight`.
- **Gợn mưa trên mặt nước:** tăng tần số và độ nhám của `waterNormals` qua `size`, `distortionScale` (không thêm mesh). Vòng gợn riêng (P3) chỉ làm nếu ngân sách draw call cho phép.
- Tắt mưa khi camera trong hầm (mục 2.5) hoặc dưới mặt nước.

### 4.4 Mặt ướt (`wetness.ts`): P1, 0 draw call
- Danh sách vật liệu "đường": `MAT.road`, `MAT.road2`, `MAT.paver`, `MAT.stone`, và `mats.road` của từng cầu (TP, TTL, SH: đều `roughness 0.93`). Thêm hàm `registerWet(mat, kind)`. Không dò theo tên, để tránh bỏ sót vật liệu mới.
- Theo `wet`: `roughness` lerp từ gốc (≈ 0,9) về 0,25, `color` nhân 0,65 (đường ướt sẫm màu). `envMapIntensity` tăng để ánh đèn đêm in bóng trên đường.
- Bê tông và thép cầu đã có `bridgePatch` (TP, TTL, SH): thêm option **`weather: true`** vào `BridgePatchOptions`, đọc uniform `uWet` để sẫm màu và giảm roughness. **Phải nối vào `onBeforeCompile` hiện có**, không ghi đè. Thêm `uWet` vào `customProgramCacheKey`.

### 4.5 Gió (`wind.ts`): P2, 0 draw call
Toàn bộ làm trong vertex shader, đọc uniform `uWind` (vec3 hướng × độ lớn tức thời), `uGust`, `uTime`. **Không** cập nhật ma trận instance mỗi khung.
- **Cây:** vá `MAT.leaf`, `MAT.palm` (hiện chưa có `onBeforeCompile`). Dịch tán theo `uWind`, biên độ tỉ lệ độ cao điểm so với gốc, pha lấy từ `instanceMatrix[3].xz`. Thân (`MAT.trunk`) giữ nguyên. Bóng đổ của tán **không** lắc theo (depth material mặc định). Chấp nhận được; nếu lệch rõ thì thêm `customDepthMaterial`.
- **Hanger Thuận Phước, dây văng Trần Thị Lý và Cầu sông Hàn:** thêm option `sway` cho `bridgePatch`: dịch ngang theo dạng `sin(π·t)` (t = vị trí dọc thanh, 0 → 1, hai đầu cố định) × `sin(ω·uTime + pha)`.
  - **Cạm bẫy:** hanger dựng bằng `segmentMatrix` với bán kính 0,03 m, nên dịch trong không gian cục bộ sẽ bị **thu nhỏ theo bán kính**. Phải dịch **sau** khi nhân `instanceMatrix` / `modelMatrix` (không gian thế giới), và lấy `t` từ `position.y + 0.5` của `CylinderGeometry`.
  - Biên độ = f(gió tại cao độ, mưa) × hệ số phóng đại. TTL dùng đường cong "mưa–gió" (mục 2.3), TP dùng đường cong tăng theo v².
  - Cáp chủ TP (`cable`) không lắc (căng lớn). Chỉ đổi võng khi nóng (mục 4.7).
- **Dầm Thuận Phước (P3):** lắc ngang và xoắn nhẹ toàn `group` mặt cầu nếu tách được group. Nếu không, bỏ, và ghi lại lý do trong báo cáo.
- **Thuyền:** nhân biên độ trong `stepBoats` và `updateBoats` với `1 + k·wind`. Chỉ đổi hệ số, **không thêm lời gọi `rand()`**.
- **Lửa và nước phun Cầu Rồng** ([src/bridges/dragon/effects.ts](../src/bridges/dragon/effects.ts)): cộng `windVec · dt · k` vào vận tốc hạt (lửa k lớn, sương k rất lớn). `effects.ts` đang gọi `rand()` khi phát hạt: **không thêm, không bớt lời gọi nào**.
- **Mây:** quay cả cụm `clouds` quanh trục Y theo gió (1 phép gán `rotation.y` mỗi khung).

### 4.6 Chớp và sấm (`lightning.ts`): P2, +1 draw call chỉ trong ~0,2 s mỗi lần chớp
- Lịch chớp sinh bằng `rng(seed)` riêng theo `lightning`: trung bình 1 lần mỗi 6–15 s khi bão.
- Mỗi lần chớp: tạo mới đường gấp khúc tia chớp (khoảng 12 đoạn, có nhánh) bằng **cập nhật buffer có sẵn** của một mesh ribbon emissive (`MeshBasicMaterial`, màu HDR khoảng (3, 3, 4) để bloom). Vị trí ngẫu nhiên cách camera 800–3.000 m. Mesh này `visible` trong 2–3 nháy, mỗi nháy 60–90 ms.
- Đồng thời: `hemi.intensity` += 2,5 giảm dần trong 0,3 s, `toneMappingExposure` × 1,6. Ban ngày bão cũng thấy (trời tối).
- **Sấm** tới sau `khoảng cách / 343 m/s` giây (âm thanh, mục 7). Lời dẫn (P3): "đếm giây giữa chớp và sấm, nhân 343 m ra khoảng cách".

### 4.7 Nắng hè (`summer.ts`): P3, 0 draw call
- **Ảo ảnh mặt đường** (mirage): trong shader vật liệu đường (dùng chung cơ chế với wetness), ở góc nhìn sát mặt (`dot(viewDir, normal)` nhỏ) và xa > 60 m, trộn màu trời và dao động nhẹ UV theo `uTime`, cường độ = haze. Không dùng pass hậu kỳ (tốn draw call và chậm trên SwiftShader).
- Grade màu hè: hemi ấm hơn, sương be, nước xanh ngọc.
- **Giãn nở nhiệt:** chỉ hiển thị **số** trong bảng ảnh hưởng (mục 5.2). Hình học không đổi, trừ tuỳ chọn "phóng đại" cho võng cáp TP: dịch `y` của hanger và cáp chủ theo `Δf · sin(πx/L)` × hệ số phóng đại, qua `sway` shader (cùng uniform).

### 4.8 Sau bão (P3)
- Cây đổ: chọn 6–10 instance cây (bằng `rng(seed)` riêng) **gần góc nhìn** đang xem, đặt ma trận nghiêng 80°. **Lưu ma trận gốc** và trả về khi rời trạng thái "sau bão". Không đụng instance đã bị dọn scale 0 bởi hầm/riverfront.
- Mặt đường còn ướt (`wet` khô chậm), trời quang dần, cầu mở lại.

---

## 5. Kiến trúc code

### 5.1 Thư mục `src/environment/weather/` (theo mẫu `environment/riverfront/`, không kế thừa `BridgeBase`)
| File | Vai trò |
|---|---|
| `index.ts` | `buildWeather()`, `updateWeather(dt, time, camera)`, `setWeatherPreset(name)`, `setWeatherIntensity(k)`, `runStormScenario()` / `stopStormScenario()`, `getWeather()`, `disposeWeather()`. Giữ đối tượng `current` |
| `state.ts` | `WeatherParams`, preset, `stepWeather(dt)` (tiến dần về target), nhiễu gió. **Thuần, không import three scene** |
| `impact.ts` | Thuần: `windAt(z)`, `beaufort(v)`, `bridgeImpacts(w)` → mảng `{ key, windDeck, level, status: 'open' \| 'limited' \| 'closed', effects[] }`, giãn nở, võng cáp. Dùng số từ `CONFIG` |
| `atmosphere.ts` | `snapshotAtmosphere()`, `applyWeather(w, night, time)` (mục 4.2) |
| `rain.ts` | Mesh mưa (mục 4.3) |
| `wetness.ts` | `registerWet()`, cập nhật uniform/thuộc tính (mục 4.4) |
| `wind.ts` | Vá shader cây, uniform gió dùng chung (mục 4.5) |
| `lightning.ts` | Tia chớp + xung sáng (mục 4.6) |
| `scenario.ts` | Kịch bản bão theo mốc thời gian (mục 6) |
| `effectsHooks.ts` | Hệ số cho giao thông, thuyền, trình diễn, cầu quay (mục 5.3) |

Uniform dùng chung: thêm **`weatherU = { uWet, uRain, uWind, uGust, uHaze, uSwayK }`** vào [src/core/shared.ts](../src/core/shared.ts). **Không** thêm vào object `shared`, vì `MAT.ledRail` dùng nguyên `uniforms: shared`; thêm khoá vào đó sẽ âm thầm thêm uniform vào shader LED.

### 5.2 Thông số: khối `weatherBase` trong [src/config.ts](../src/config.ts) → `CONFIG.weather`
Gồm: bảng Beaufort, `alpha` hồ sơ gió, hệ số giãn nở, `presets` (mục 3.2), hằng số thời gian chuyển trạng thái, `rain: { count, box, fall, len }`, `swayExaggeration: 20`, `closeWind` (ngưỡng cấm lưu thông, **ước lượng**), `swingMaxWind` (ngưỡng quay cầu, **ước lượng**), `showMaxWind` / `showMaxRain`, `levelMax`, `lightning: { minGap, maxGap, distMin, distMax }`, `seed` (đề xuất `20061001`, ngày bão Xangsane). Mỗi dòng có chú thích tiếng Việt, đơn vị, nguồn hoặc `(ước lượng)`.

### 5.3 Điểm nối vào code hiện có (sửa tối thiểu, mặc định không đổi hành vi)
| File | Thay đổi |
|---|---|
| [src/main.ts](../src/main.ts) | `buildWeather()` **sau** `buildRiverfront()` (sau mọi `rand`), trước `setupUI`. Trong `animate()`: `updateWeather(dt, time, camera)` ngay sau `applyNight(...)`. Thêm `weather` vào `window.__app` |
| [src/environment/traffic.ts](../src/environment/traffic.ts) | Hệ số `trafficK.speed` (mặc định 1) nhân vào `v.speed * dt`. Khi đóng cầu: `PATHS.axis.hidden` / `PATHS.ttl.hidden` (cơ chế đã có). `updateBoats` nhân biên độ và tốc độ thuyền theo `boatK` |
| [src/common/traffic.ts](../src/common/traffic.ts) `stepTraffic` | Cùng hệ số tốc độ; đóng cầu thì gọi `bridge.setLifeVisible(false)` từ weather, khôi phục **giá trị người dùng đã chọn** (nút `btnTpLife`…), không ép bật |
| [src/common/boats.ts](../src/common/boats.ts) `stepBoats` | Nhân biên độ lắc theo `boatK.rock` |
| [src/bridges/dragon/effects.ts](../src/bridges/dragon/effects.ts) | `updateShow`: thêm điều kiện `weatherAllowsShow()`. Vận tốc hạt cộng gió (mục 4.5). `showLabel` có khoá mới `sWeather` |
| [src/bridges/song-han/SwingController.ts](../src/bridges/song-han/SwingController.ts) | Thêm `canStart: () => boolean = () => true`, kiểm tra trong `start()`. Weather gán predicate. Thêm event `swingBlocked` để UI hiện lý do |
| [src/common/shaders.ts](../src/common/shaders.ts) `bridgePatch` | Option mới `weather?: boolean` (ướt) và `sway?: { kind: 'hanger' \| 'stay' }`. Cache key phải chứa cả hai option |
| Vật liệu TP / TTL / SH | Bật `weather: true` cho bê tông, thép, tháp. `sway` cho `hanger` (TP) và `stay` (TTL, SH). `registerWet(mats.road)` |
| [src/core/shared.ts](../src/core/shared.ts) | `weatherU` (mục 5.1) |
| [src/environment/riverfront/index.ts](../src/environment/riverfront/index.ts) | Khi bão thì tắt quảng cáo tạm thời. Nhớ trạng thái nút người dùng để trả lại |
| [src/audio/index.ts](../src/audio/index.ts) | `setWeather(rain, wind)`, `thunder(delaySec, dist)` (mục 7) |

---

## 6. Kịch bản bão (P2 khung, P3 lời dẫn)

Nút **"Kịch bản bão"** chạy một dòng thời gian khoảng 120 s (tăng tốc), tự đặt target cho `WeatherParams` và ép trạng thái đóng/mở. Chú thích hiện trong khung `#tourCaption` (tái dùng UI Tour) hoặc một khung riêng cùng kiểu.

| Mốc (s) | Thời tiết | Sự kiện | Chú thích (khoá i18n) |
|---|---|---|---|
| 0 | wind 6, cloud 0,6 | Camera bay tới `wxRiverMouth` | `wxS1`: "Bản tin: bão mạnh cấp 11 trên Biển Đông, dự kiến ảnh hưởng Đà Nẵng" |
| 15 | wind 10, cloud 0,9, rain 0,3 | Thuyền du lịch về bến, sóng tăng | `wxS2`: "Cấm tàu thuyền hoạt động trên sông Hàn" |
| 30 | wind 15, rain 0,6 | Dừng phun lửa Cầu Rồng, khoá quay Cầu sông Hàn, quảng cáo tắt | `wxS3`: "Tạm dừng trình diễn, không quay cầu" |
| 45 | wind 22, gust 8, rain 0,9, lightning 0,5 | Dây TTL, hanger TP dao động; camera sang `wxTtlStays` | `wxS4`: "Gió giật mạnh: dây cáp dao động (phóng đại ×20)" |
| 60 | wind 28, gust 10, rain 1, level 0,8 | **Cấm lưu thông qua cầu** (xe dọn dần trong 5 s), camera `tpBay` | `wxS5`: "Cấm phương tiện qua các cầu lớn" (ngưỡng: cần xác minh) |
| 80 | đỉnh bão: level 1,2, lightning 0,9 | Chớp liên tục, sấm, sóng bạc đầu cửa sông | `wxS6`: "Bão đổ bộ: gió cấp 10–11, giật cấp 13" |
| 95 | wind 12, rain 0,5 | Bão suy yếu | `wxS7`: "Bão suy yếu, mưa còn to" |
| 110 | wind 3, rain 0, cloud 0,3 | Mở lại cầu, xe chạy lại, cây đổ (P3), đường còn ướt | `wxS8`: "Sau bão: thông xe, dọn cây đổ" |
| 120 | trả về preset trước kịch bản | | |

Người xem kéo camera hoặc nhấn Esc thì kịch bản **dừng camera** nhưng thời tiết vẫn chạy tới hết, giống cách `exitTour` đang làm. Nút "Dừng kịch bản" thì trả ngay về preset trước.

Lời dẫn bằng giọng đọc (vi / en / ru có sẵn giọng) là **tuỳ chọn** (mục 11). Nếu làm thì theo [.github/prompts/add-narration-language.prompt.md](../.github/prompts/add-narration-language.prompt.md), chạy `npm run gen:voice` và commit `public/voice/`.

---

## 7. Âm thanh (P3, Web Audio, không file ngoài)
Theo mẫu tổng hợp trong [src/audio/index.ts](../src/audio/index.ts), tái dùng `A.noise` (nhiễu nâu) và `A.white`:
- **Mưa:** nhiễu trắng → bandpass 2–6 kHz + lowpass, gain ∝ rain. Thêm "tí tách" ngẫu nhiên (dùng `Math.random` như phần nhạc, **không** dùng `rand`).
- **Gió:** nhiễu nâu → bandpass có tần số trượt theo `windNow` (hú khi giật), gain ∝ wind².
- **Sấm:** nhiễu nâu lowpass 120–300 Hz, tiếng "rền" 2–4 s, độ to ∝ 1/khoảng cách, trễ theo 343 m/s.
- Nhạc nền giảm 30 % khi bão (cùng cơ chế `duck`).

---

## 8. UI, góc nhìn, i18n

### 8.1 Bảng điều khiển (header `.panel.brand` trong [index.html](../index.html), ngay dưới thanh Ngày/Đêm)
- `select#weatherSel`: Hiện trạng / Nắng hè / Mưa / Gió mùa / Bão.
- `input#weatherK` (range 0–100): cường độ.
- `button#btnStormRun.toggle`: Kịch bản bão.
- `button#btnWxImpact.toggle`: Ảnh hưởng tới cầu. Bật thì hiện thẻ `#wxImpact`: mỗi công trình một dòng gồm gió tại mặt cầu (m/s, cấp), trạng thái lưu thông (Mở / Hạn chế / Cấm, kèm màu), hiệu ứng chính (giãn nở, rung dây, không quay cầu…). Có dòng chú thích "Mô phỏng trực quan, phóng đại ×20, số liệu tính gần đúng". Cập nhật 2 lần/giây, giống `fps`.
- Viết `src/ui/weatherUI.ts` theo mẫu `riverfrontUI.ts` + `toggle()` của `panel.ts`, gọi trong `setupUI`. Đổi ngôn ngữ (`onChange`) thì vẽ lại thẻ.
- Preset "Bão" ban đêm vẫn chọn được. Kịch bản bão tự đặt **ban ngày** (`dayNight.target = 0`) để thấy trời tối sầm giữa ngày, rồi trả lại giá trị cũ.

### 8.2 Góc nhìn mới (`VIEWS` trong [src/views/presets.ts](../src/views/presets.ts))
| Khoá | Danh sách | Mô tả | Gợi ý |
|---|---|---|---|
| `wxRiverMouth` | `tp` | Từ cửa sông nhìn vào Thuận Phước, sóng và mưa | pos ≈ [420, 40, TPZ − 900], target ≈ [0, 30, TPZ] (ước lượng, chỉnh khi xem ảnh) |
| `wxTtlStays` | `ttl` | Đứng trên lề cầu nhìn dọc mặt dây văng | gần `ttlDeck`, nhìn lên các dây trước |
| `wxStreet` | `dragon` | Ngang tầm xe trên Bạch Đằng, mặt đường ướt phản chiếu đèn, Cầu Rồng phía sau | pos ≈ [−299, 1,8, 120], target ≈ [−200, 8, 0], `maxPolar` 0,97π |

Thêm nút `data-view` vào đúng `.view-list` và thêm vào danh sách `VIEWS` của [tests/drawcalls.mjs](../tests/drawcalls.mjs).

### 8.3 i18n: đủ 9 ngôn ngữ `src/i18n/locales/{vi,en,ko,ja,zh,th,ar,hi,ru}.json`
Viết `scripts/add-weather-locales.mjs` theo mẫu `scripts/add-riverfront-locales.mjs`. Khoá tối thiểu:
`weather, wxNow, wxSummer, wxRain, wxMonsoon, wxStorm, wxIntensity, wxStormRun, wxStormStop, wxImpact, wxImpactNote, wxWindDeck, wxBeaufort, wxOpen, wxLimited, wxClosed, wxThermal, wxSag, wxRainWind, wxSwingBlocked, wxTunnelOk, sWeather, wxS1…wxS8, vWxRiverMouth, vWxTtlStays, vWxStreet`.
Dịch tự nhiên. `ar` đúng chiều phải sang trái. Chú thích về hầm giữ "phương án đề xuất".

---

## 9. Hiệu năng và bất biến

| Bất biến | Rủi ro trong tính năng này | Cách tránh |
|---|---|---|
| Chuỗi `rand()` | Sinh hạt mưa, lịch chớp, nhiễu gió, cây đổ; sửa `effects.ts` / `traffic.ts` (đang gọi `rand`) | Mọi số ngẫu nhiên mới dùng `rng(CONFIG.weather.seed + k)`. Không thêm/bớt `rand()` trong file cũ. `buildWeather()` sau `buildRiverfront()` |
| Draw call | Mesh mưa, tia chớp, (P3) gợn nước | Preset `now`: **chênh 0** ở mọi góc nhìn, ngày và đêm. Preset khác: **≤ +2** (mưa +1, chớp +1 lúc nháy). Mưa ở layer 1 (không vào phản chiếu), không đổ bóng. Không thêm pass hậu kỳ |
| Vật liệu dùng chung | Đổi roughness/màu `MAT.road`, `MAT.paver`…; vá `MAT.leaf`, `MAT.palm` | Chụp giá trị gốc, trả về **đúng** khi `now`. Vá shader không đổi draw call nhưng đổi program: so ảnh `now` trước/sau phải **trùng từng điểm ảnh** (uniform = 0 thì nhánh phải là no-op, dùng `if (uWet > 0.0)` hoặc nhân 0 chính xác) |
| `bridgePatch` | Thêm option làm đổi cache key và nhánh shader cho mọi cầu | Option mặc định tắt, chuỗi key cũ giữ nguyên khi tắt |
| Mặc định | Gió/mưa mặc định ≠ 0 làm đổi ảnh | Preset `now` là no-op, `weather.enabled = false` |
| Tour | Weather chặn quay cầu làm Tour Cầu sông Hàn treo | `canStart` false thì Tour bỏ qua bước quay, có chú thích. `test:tour` chạy ở preset `now` |
| Hiệu năng SwiftShader | 6.000 vệt mưa trong suốt làm test chậm | `rain.count` trong config. Test dùng số nhỏ qua `__app.weather.setRainCount()` nếu cần |

---

## 10. Kế hoạch theo giai đoạn (xong giai đoạn trước mới sang giai đoạn sau, mỗi giai đoạn một commit trên `feature/weather`)

### Giai đoạn 1: Khung, config, đo chuẩn (rủi ro thấp nhất, kiểm tra độc lập)
- Tạo `feature/weather` từ `main`. Chạy `npm run build && npm run test:drawcalls` trên `main` **trước khi sửa**, lưu kết quả làm chuẩn (bảng `KET-QUA.md` chưa có `hr*`/`rf*`, xem activeContext).
- Tạo `src/config.ts` → `weatherBase`; tạo `weather/state.ts`, `weather/impact.ts` (thuần), `weather/index.ts` (build/update rỗng); thêm `weatherU` vào `core/shared.ts`. Nối `main.ts` và `__app.weather`.
- Kiểm tra: `npm run typecheck`; `npm run build`; `test:drawcalls` **chênh 0** ở mọi góc nhìn so với chuẩn vừa đo; trong console `?test`: `__app.weather.impact()` trả về gió tại cao độ khớp bảng mục 1.6 (TP 31,6 m, v₁₀ = 25 → ≈ 29 m/s).
- Commit: `feat(weather): khung trạng thái thời tiết + config`.

### Giai đoạn 2: Khí quyển 4 preset + UI chọn preset (0 draw call mới)
- `atmosphere.ts` (mục 4.2), nước đổi màu, dâng mực nước. UI `weatherSel` + `weatherK`. Khoá i18n cho tên preset (9 ngôn ngữ).
- Kiểm tra: `test:drawcalls` ở preset `now` chênh 0; chuyển `storm` → `now` thì mọi giá trị chụp gốc khớp tuyệt đối (viết sẵn phần này trong `tests/weather-check.mjs`); chụp ảnh `overview`, `tpBay`, `shOverview` ngày/đêm cho 5 preset rồi tự xem.
- Commit.

### Giai đoạn 3: Mưa + mặt ướt (P1)
- `rain.ts`, `wetness.ts`, option `weather` trong `bridgePatch`, `registerWet` cho đường của các cầu. Tắt mưa trong hầm.
- Kiểm tra: draw call preset `rain` ≤ chuẩn + 1; `now` chênh 0; so ảnh `now` trước/sau giai đoạn trùng điểm ảnh; `test:tunnel` qua (vật liệu chung); FPS SwiftShader không giảm quá 30 % ở `overview` (ghi số).
- Commit.

### Giai đoạn 4: Gió (P2)
- Vá cây, `sway` hanger/dây văng, thuyền, mây, lửa/nước lệch gió, sóng. Đường cong mưa–gió cho TTL.
- Kiểm tra: draw call không đổi so với giai đoạn 3; ảnh `wxTtlStays` ở (`rain` 60 %, gió 12 m/s) thấy dây rung mạnh hơn ở (`storm` không mưa); `test:tour` qua.
- Commit.

### Giai đoạn 5: Bão: chớp, đóng cầu, cầu quay, trình diễn (P2)
- `lightning.ts`, hook `trafficK` / `boatK`, `SwingController.canStart`, `weatherAllowsShow`, quảng cáo tắt tạm, `closed` theo `closeWind`.
- Kiểm tra (`test:weather`): bão thì `songHan.ctrl.start()` trả `false`; `show.fireOn` luôn false; không còn xe trên `PATHS.axis` và trong `life` các cầu; hết bão thì nút người dùng giữ nguyên trạng thái cũ; draw call ≤ chuẩn + 2.
- Commit.

### Giai đoạn 6: Bảng "Ảnh hưởng tới cầu" + góc nhìn mới + i18n đầy đủ (P2)
- `#wxImpact`, 3 góc nhìn, `scripts/add-weather-locales.mjs` (9 ngôn ngữ), thêm góc nhìn vào `drawcalls.mjs`.
- Kiểm tra: đổi qua 9 ngôn ngữ không có khoá thiếu (in `t()` trả về khoá = lỗi); `ar` hiển thị RTL; draw call 3 góc nhìn mới ghi vào bảng.
- Commit.

### Giai đoạn 7: Kịch bản bão + nắng hè chi tiết + sau bão + âm thanh (P3)
- `scenario.ts`, `summer.ts` (ảo ảnh mặt đường, võng cáp phóng đại), cây đổ, âm thanh mưa/gió/sấm.
- Kiểm tra: kịch bản chạy hết 120 s trong test (tăng tốc), không lỗi console; kết thúc thì trả về preset, ngày/đêm cũ; bật/tắt kịch bản 3 lần không rò rỉ (`renderer.info.memory` geometries/textures không tăng).
- Commit.

### Giai đoạn 8: Hoàn tất
- Chạy đủ bộ: `build`, `test:drawcalls`, `test:tour`, `test:tunnel`, `test:riverfront`, `test:voice`, `test:weather`. Ghi kết quả thật, kể cả lỗi.
- Cập nhật `tests/KET-QUA.md` (thêm cột/khối preset thời tiết), README mục **Cấu trúc** (`environment/weather/`), memory bank (`progress.md`, `activeContext.md`, `systemPatterns.md`: mẫu "điều biến sau applyNight", "uniform weatherU").

---

## 11. Kiểm tra bắt buộc: `tests/weather-check.mjs` (`npm run test:weather`)
Dùng `tests/lib.mjs` (`serveDir`, `launch`, `openApp`, `frames`, `pickView`), gom lỗi vào `problems[]`, in tiếng Việt.
1. **No-op:** preset `now` thì draw call 6 góc nhìn mẫu (`overview`, `tpBay`, `ttlOverview`, `shOverview`, `hrOverview`, `rfHearts`) ngày + đêm **bằng** số đo khi chưa có weather (đo trong cùng lần chạy bằng cách gọi trước `buildWeather` hoặc so với bảng chuẩn).
2. **Khôi phục:** `now → storm → now`: fog density, sky uniforms, water distortion/size/position.y, roughness/màu mọi vật liệu đã `registerWet`, `clouds` color, cờ `PATHS.*.hidden`, `lifeOn` các cầu, `adsEnabled` trùng giá trị ban đầu (so `===`).
3. **Ngân sách:** draw call preset `rain` ≤ `now` + 1, `storm` ≤ `now` + 2 (lấy max của 10 khung để bắt cả lúc chớp).
4. **Vận hành:** ở `storm` thì `songHan.ctrl.start()` → `false`, `show.fireOn` false sau 30 s, không xe trên các cầu; ở `now` thì quay cầu được.
5. **Mưa trong hầm:** camera ở `hrGallery` → mesh mưa `visible === false`.
6. **Không rò rỉ:** đổi preset 5 vòng + chạy kịch bản 2 lần: `renderer.info.memory.geometries` / `textures` không tăng.
7. **Console sạch.**
8. **Ảnh** (Playwright, lưu `tests/screens/`, không commit): `overview`, `tpBay`, `wxTtlStays`, `wxStreet`, `shOverview` × 5 preset × ngày/đêm. **Tự xem lại ảnh** và soát: mưa không thành khối trắng đặc ở gần camera, mặt đường ướt có phản chiếu đèn, không có z-fighting do nước dâng ở kè, mây/sương không che mất cầu ở preset `rain` 50 %, bloom chớp không cháy trắng toàn màn hình quá 1 khung.

`test:tour`, `test:voice`, `test:tunnel`, `test:riverfront` vẫn phải qua ở preset mặc định.

---

## 12. Câu hỏi cho người dùng (chưa tự quyết)
1. **Ngưỡng cấm lưu thông qua cầu** và **ngưỡng dừng quay Cầu sông Hàn**: nếu không tìm được văn bản chính thức thì dùng giá trị ước lượng (đề xuất: cấm khi gió ≥ cấp 10, không quay khi gió ≥ cấp 6) có ghi "(ước lượng)", hay chỉ ghi "theo thông báo của thành phố" và không đặt số?
  - Theo thông báo của thành phố
2. **Phóng đại dao động**: ×20 là mặc định. Có muốn thanh chỉnh hệ số (×1 thật → ×50) trong UI không?
  - x20 là phù hợp
3. **Lời dẫn bằng giọng đọc** cho kịch bản bão (vi/en/ru, cần `gen:voice` qua dịch vụ TTS không chính thức): làm trong đợt này hay để sau?
  - Để sau
4. **Ngập phố** (nước tràn mặt đường Bạch Đằng như đợt 10/2022): đề xuất **không** làm (phải sửa địa hình, dễ lệch draw call), chỉ dâng mực nước sông ≤ 1,2 m. Đồng ý không?
  - Đồng ý
5. **Cây đổ sau bão**: có muốn không, vì có thể gây cảm giác nặng nề cho người xem du lịch?
  - Có, tôi muốn chân thật nhất có thể
6. **Thời tiết theo tháng thực**: có muốn tự chọn preset theo tháng hiện tại khi mở trang không (không gọi API, chỉ theo lịch mùa)?
  - Đồng ý
7. **Ngân sách draw call** cho preset thời tiết: đề xuất ≤ +2. Có chấp nhận cao hơn để thêm gợn mưa trên mặt nước (+1) không?
  - Đồng ý

---

## 13. Báo cáo khi xong
Ghi trung thực: giai đoạn nào xong (theo P1/P2/P3), bảng draw call trước/sau cho `now` và từng preset, FPS SwiftShader, thông số nào là ước lượng, nguồn đã tra (link) cho mục 1, ảnh chụp đã xem và lỗi còn lại.

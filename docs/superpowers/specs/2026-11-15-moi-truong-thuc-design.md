# Môi trường 3D theo thời tiết + giờ thực tế Đà Nẵng (D-043) — thiết kế

_Ngày: 2026-11-15 · Nhánh: `feature/moi-truong-thuc` (từ `main` `80273c9`) · Trạng thái: đang làm_
_Nguồn: bản yêu cầu "Real-time Weather-driven 3D Environment" của người dùng (2026-11-15). Người dùng dặn làm thẳng tới khi xong, không chờ duyệt spec / plan; mọi lựa chọn dưới đây ghi "(agent chọn)" là quyết định của agent, người dùng chưa duyệt._

## 1. Mục tiêu và lý do

Người mở trang vào một tối mưa phải thấy Đà Nẵng tối và mưa; mở vào sáng nắng thì thấy thành phố sáng. Số liệu thật (Open-Meteo, đã có từ D-042) và giờ địa phương `Asia/Ho_Chi_Minh` lái trực tiếp cảnh 3D, không chỉ hiện trên thẻ thông tin.

Việc này **đảo một phần D-042** ("số liệu thật không bao giờ ghi đè mô phỏng"): nay có hai chế độ tách bạch, **Trực tiếp** (mặc định) và **Mô phỏng** (toàn bộ điều khiển cũ, độc lập với API).

**Mục tiêu**
- Một ảnh chụp số liệu duy nhất (kho `realtime/store.ts`, cái thẻ `#envCard` đang hiện) lái cả cảnh. Không thêm lần gọi API thứ hai.
- Mây, mưa, gió, tầm nhìn, dông và nhiệt độ thật ánh xạ **liên tục** sang tham số thời tiết sẵn có (`WeatherParams`), tiến dần bằng hằng số thời gian, không nhảy.
- Vị trí mặt trời tính từ ngày giờ + tọa độ Đà Nẵng (không dùng khung giờ cố định), lái sáng / tối, hướng nắng, hướng bóng, hoàng hôn.
- Chế độ Mô phỏng giữ nguyên mọi thứ đang có: preset, cường độ, kịch bản bão, thanh Ngày / Đêm, thẻ "Ảnh hưởng tới cầu".

**Không làm**
- Không ngập, không dâng nước sông, không cấm cầu, không cây đổ theo số liệu thật (`level = 0`, `closed = false` ở chế độ Trực tiếp; cây đổ chỉ khi mô phỏng).
- Không máy chủ, không đổi `server/multi`, không deploy Worker.
- Không sửa shader mặt nước: nhánh `feature/ven-song-chan-thuc` (chưa merge) đang thay shader nước và đã có gợn mưa đọc cùng `WeatherParams` / `weatherFx`; làm ở đây sẽ xung đột. Trên `main` hiện tại mưa thật làm đổi màu nước, sóng (`distortionScale`), không có vòng gợn.
- Không thêm thư viện, không thêm `PointLight` / `SpotLight`, không đổi thứ tự `build*()` hay lời gọi `rand()`.

**Thất bại dù chạy được:** mưa to khi số liệu ghi 0 mm; chớp khi không có dông; API về làm cảnh giật; làm mới tự động ghi đè lựa chọn mô phỏng; lệnh vẽ góc cũ tăng ở `?test`.

## 2. Hiện trạng (đã đọc mã tại `80273c9`)

| Phần | Ở đâu | Ghi chú |
|---|---|---|
| Số liệu thật | `src/realtime/weatherApi.ts`, `store.ts`, `clock.ts`, `src/ui/envUI.ts` | Open-Meteo `current` (nhiệt, ẩm, mưa, mã WMO, mây, gió, hướng, UV, `is_day`) + mọc / lặn; 10 phút một lần; bộ nhớ đệm `localStorage`; `inject()` / `setNow()` cho test. **Thiếu:** tầm nhìn, gió giật, `interval` |
| Thời tiết mô phỏng | `src/environment/weather/` | `WeatherParams` liên tục (rain 0–1, wind m/s, gust, windDir, cloud, haze, level, lightning, closed), `stepWeather` tiến dần theo `CONFIG.weather.tau`, `wet` khô chậm (40 s); khí quyển, mưa (1 lệnh vẽ), mặt ướt, gió (cây, dây, thuyền, sóng), chớp, vận hành cầu. `setParams()` đã có |
| Ngày / đêm | `src/core/dayNight.ts` | Một số `night` 0–1; `applyNight` đặt mặt trời cố định phương vị 205°, cao 40° → −7°; mọi đèn đêm đọc `shared.uNight` |
| Bộ đèn | `src/core/lights.ts` (D-031) | `day` / `night` / `full`; lúc chuyển (0 < night < 0,87) dùng `full`, tốn hơn khoảng 5 ms GPU |
| Nhiều người | `src/explore/multi/`, `server/multi` | Chỉ đồng bộ vị trí / tên / chat. Thời tiết và ngày đêm xưa nay là của từng máy |
| Test | `?test` | Không gọi mạng, mọi test cũ chạy ở preset `now`, ban ngày |

## 3. Phương án

- **A. Dùng lại tầng tham số (chọn).** Số liệu thật → hàm thuần → `WeatherParams` đích + đêm đích + hướng mặt trời; mọi hiệu ứng sẵn có chạy như cũ. Ít mã mới, hai chế độ dùng chung một đường vẽ nên Mô phỏng không thể hỏng vì Trực tiếp, lệnh vẽ không đổi.
- **B. Hệ khí quyển mới** (mây thể tích, bầu trời tự viết, mặt ướt PBR riêng). Đẹp hơn nhưng nhân đôi hệ thời tiết, phá ngân sách lệnh vẽ và trùng việc với nhánh ven sông. Loại.
- **C. Chọn preset gần nhất theo mã WMO.** Rẻ nhất nhưng mưa không tỉ lệ với lượng đo, mây chỉ có vài mức; trái yêu cầu. Loại.

## 4. Thiết kế

### 4.1 Số liệu (mở rộng yêu cầu sẵn có)

Thêm vào danh sách `current`: `visibility` (m), `wind_gusts_10m` (km/h). Đọc thêm `current.interval` (s) để đổi lượng mưa của kỳ quan trắc ra mm/h (`rate = precipitation × 3600 / interval`; thiếu `interval` thì coi 900 s).
`EnvWeather` thêm `gust: number | null`, `vis: number | null`, `rate: number` (mm/h). Kiểm khoảng giá trị khi đọc: nhiệt −20…55 °C, ẩm / mây 0…100, gió 0…250 km/h, mưa ≥ 0, hướng chuẩn hóa 0…360; bắt buộc mà ngoài khoảng ⇒ bỏ cả phản hồi (giữ số liệu cũ); tùy chọn ngoài khoảng ⇒ `null`. Bộ nhớ đệm bản cũ (thiếu trường mới) vẫn đọc được, trường mới coi `null` / suy từ `rain`.

### 4.2 Ánh xạ số liệu → cảnh (`src/realtime/envMap.ts`, hàm thuần, số ở `CONFIG.live`)

| Tham số cảnh | Từ | Quy tắc (agent chọn, ước lượng) |
|---|---|---|
| `rain` 0–1 | `rate` mm/h + mã WMO | nội suy theo các mốc 0,1 → 0,06 · 1 → 0,2 · 2,5 → 0,35 · 7,6 → 0,6 · 20 → 0,85 · 50 → 1 (ngưỡng mưa nhỏ / vừa / to theo cách phân cấp phổ biến); `rate` < 0,05 và mã không phải mưa ⇒ 0; mã mưa phùn / mưa (51–67, 80–82, 95–99) mà `rate` = 0 ⇒ sàn 0,05 (mưa phùn) để hình khớp chữ trên thẻ |
| `wind`, `gust` m/s | `wind`, `gust` km/h | `wind / 3,6`, trần 40; `gust = max(0, gió giật − gió trung bình)`, thiếu thì `0,35 × wind` |
| `windDir` rad | `dir` (độ, hướng gió thổi TỪ) | đổi sang quy ước cảnh "hướng thổi TỚI, 0 = sang +X"; +X là Đông, −Z là Bắc (kiểm với `rain.ts` / `wind.ts`); quay dần theo cung ngắn nhất |
| `cloud` 0–1 | `cloud` % | `/100`, liên tục. Mây thưa không bị coi là u ám: sẵn có `gray = (cloud − grayCloud) × grayGain` |
| `fog` 0–1 (**tham số mới**) | `vis`, mã 45 / 48, `hum` | `vis` ≥ 10 km ⇒ 0; 4 km ⇒ 0,25; 1 km ⇒ 0,7; ≤ 200 m ⇒ 1; mã sương mù ⇒ sàn 0,6; ẩm > 85 % chỉ cộng tối đa 0,1 (mù nhẹ, không thành sương dày) |
| `haze` 0–1 (mù nóng sẵn có) | `temp`, `cloud`, ban ngày | `clamp((temp − 33) / 6) × (1 − cloud)`, chỉ khi mặt trời trên chân trời; đây là ảnh hưởng duy nhất của nhiệt độ lên hình, cùng giãn nở nhiệt / võng cáp sẵn có |
| `lightning` 0–1 | mã WMO | 95 ⇒ 0,5; 96–99 ⇒ 0,8; còn lại 0. Không dông thì không chớp |
| `temp` | `temp` | giữ nguyên |
| `level`, `closed` | — | luôn 0 / `false` |

`fog` trong `atmosphere.ts`: nhân mật độ sương tới `CONFIG.live.fogMax` lần và kéo màu sương về xám trắng; trần chọn sao cho ở `fog = 1` còn nhận ra cầu cách khoảng 600 m. Mật độ mây: số tấm mây hiện (`clouds.count`) và độ đục theo `cloud` (0 lệnh vẽ thêm). Preset mô phỏng có `fog = 0` nên hình mô phỏng cũ không đổi.

Chuyển tiếp: đích mới đi qua `stepWeather`; ở chế độ Trực tiếp các hằng số thời gian nhân `CONFIG.live.tauScale` (chậm hơn mô phỏng) để lần làm mới API không gây đổi cảnh thấy rõ trong một hai giây. Mặt đường khô dần theo `tau.wet` sẵn có. Ảnh chụp đầu tiên của phiên áp tức thì (không có cảnh "đang chuyển" lúc vừa mở trang).

### 4.3 Mặt trời và giờ (`src/realtime/solar.ts`, hàm thuần)

Tính độ cao + phương vị mặt trời từ epoch UTC, vĩ độ, kinh độ (công thức NOAA rút gọn, sai số < 0,5°), không phụ thuộc múi giờ máy khách.
- `night` đích = `1 − smoothstep(elevNight, elevDay, độ cao)` với `elevDay = +6°`, `elevNight = −6°` (chạng vạng dân dụng). Ở Đà Nẵng khoảng chuyển kéo dài chừng 50 phút mỗi đầu ngày; đây cũng là lúc dùng bộ đèn `full`.
- Hướng mặt trời thật đưa vào `setSun` (phương vị la bàn A ⇒ góc cảnh `180° − A`); độ cao của đèn định hướng kẹp ≥ `CONFIG.live.sunMinElev` để bóng không dài vô hạn, bầu trời (`Sky`) nhận độ cao thật nên tự có màu cam lúc mặt trời thấp.
- Cường độ nắng nhân hệ số theo độ cao (trưa = mức ban ngày hiện có, sáng sớm / chiều muộn yếu hơn), màu nắng và màu sương ấm dần khi độ cao < 15°.
- `applyNight(m, time, sun?)`: không truyền `sun` thì y như cũ (Mô phỏng, `?test`), nên ảnh và lệnh vẽ chuẩn không đổi.
- Đồng hồ máy lệch: sau mỗi lần lấy số liệu thành công, nếu giờ máy lệch khỏi giờ quan trắc quá 2 giờ thì hiệu chỉnh theo giờ quan trắc (sai tối đa một kỳ 15 phút).

### 4.4 Hai chế độ (`src/realtime/liveEnv.ts`, bộ điều khiển duy nhất)

- `mode: 'live' | 'manual'`. Mặc định `live`; `?test` mặc định `manual` (mọi test cũ tất định); `?envmode=live|manual` ép. Không lưu chế độ qua phiên: mỗi lần mở trang là Trực tiếp (agent chọn).
- **Trực tiếp:** mỗi khung bộ điều khiển ghi `dayNight.target` và hướng mặt trời; khi kho báo số liệu mới thì tính lại đích thời tiết. Chưa có số liệu hợp lệ (đang tải / mất mạng, không có bộ nhớ đệm): giờ vẫn chạy thật, thời tiết ở trung tính, thẻ ghi rõ; có số liệu thì chuyển dần. Số liệu cũ (> 45 phút): giữ trạng thái hợp lệ cuối, chỉ báo ghi "số liệu cũ". Không bịa số liệu.
- **Mô phỏng:** bộ điều khiển không ghi gì. Trạng thái mô phỏng (preset, cường độ, đêm đích) được nhớ khi sang Trực tiếp và trả lại khi quay về.
- **Chuyển Mô phỏng → Trực tiếp:** dừng kịch bản bão, dựng lại cây đổ, gọi `store.refresh()` nếu số liệu quá `refreshMs`, tính lại đích, cảnh tiến dần.
- **Khóa điều khiển ở Trực tiếp:** thanh Ngày / Đêm, nút Ngày / Đêm, ô chọn thời tiết, thanh cường độ, nút Kịch bản bão bị vô hiệu, kèm dòng "Đang theo thời tiết thực tế" và nút "Chuyển sang Mô phỏng". Không có đường nào đổi mô phỏng mà không bấm chuyển chế độ.
- **Tính năng cần ban đêm** (trình diễn Cầu Rồng, góc nhìn `rfHearts` / `swNight`, tour Vòng quay; đều tự đặt đêm): khi bấm lúc đang Trực tiếp thì chuyển sang Mô phỏng và hiện thông báo có nút "Về Trực tiếp" (agent chọn; phương án kia là cho chúng chạy giữa ban ngày, sai với nội dung "21:00").
- **Chỉ báo:** `#envPill` có chấm + chữ "TRỰC TIẾP" khi Trực tiếp, "MÔ PHỎNG" khi Mô phỏng; `#envCard` có công tắc hai chế độ và dòng giờ quan trắc sẵn có. Khóa i18n mới đủ 9 ngôn ngữ.

### 4.5 Nhiều người

Không đổi giao thức. Mọi khách ở Trực tiếp đọc cùng nguồn (Open-Meteo, cùng tọa độ, quan trắc lượng tử 15 phút) và cùng đồng hồ UTC nên thấy cùng điều kiện. Để các máy đổi số liệu gần như cùng lúc, nhịp làm mới ở chế độ Trực tiếp căn theo mốc quan trắc: lần kế = mốc 15 phút kế tiếp + `CONFIG.live.obsDelayMs` (+ nhiễu vài giây), thay cho "10 phút kể từ lúc mở trang". Mô phỏng là lựa chọn riêng từng máy như xưa nay, không phát cho người khác. Hạn chế: hai máy có thể lệch nhau tối đa khoảng 2 phút quanh mốc; máy mất mạng giữ số liệu cũ.

### 4.6 Hiệu năng

Không vòng lặp mới (bộ điều khiển chạy trong `animate()`), không lưới / vật liệu / đèn mới, không cấp phát mỗi khung. Mưa, chớp, mặt ướt dùng lại lưới và bộ quản lý chất lượng sẵn có (số vệt theo bậc, trần pixelRatio khi mưa). Tính mặt trời mỗi giây một lần là đủ (mặt trời đi 0,004°/s). `?test`: lệnh vẽ 5 góc cũ +0 vì mặc định Mô phỏng `now`.

### 4.7 Kiểm thử

- `npm run test:live:unit` (Node, nhanh): đọc + kiểm khoảng số liệu, ánh xạ 8 trạng thái (quang, ít mây, u ám, mưa nhỏ, mưa to, sương, gió mạnh, dông), mưa 0 mm ⇒ `rain = 0`, không dông ⇒ `lightning = 0`, ẩm cao không thành sương dày; mặt trời Đà Nẵng (trưa, mọc / lặn lệch ≤ 3 phút so với số Open-Meteo đã ghi, phương vị), `night` theo độ cao; bộ điều khiển (mặc định, chuyển chế độ, làm mới không ghi đè Mô phỏng, giữ số liệu cuối khi lỗi, căn mốc làm mới).
- `npm run test:live` (trình duyệt, `?test&envmode=live`, bơm qua `__app.env.store.inject()` + `setNow()`; không ghi `localStorage`): 18 kịch bản của bản yêu cầu, gồm đổi số liệu giữa hai lần làm mới (không khung nào nhảy quá ngưỡng), lỗi API, chuyển chế độ hai chiều, kịch bản bão cũ, vào từng chế độ khám phá, bậc chất lượng Thấp, hai trang cùng số liệu cho cùng tham số.
- Chạy lại: `test:env:unit`, `test:env`, `test:weather`, `test:mobile`; `test:drawcalls` một lần cuối nhánh.

## 5. Tiêu chí nghiệm thu

Như mục 12 của bản yêu cầu; cụ thể hóa: (1) ở Trực tiếp, `weather.state.target` khớp `envMap(store.data)` và `dayNight.target` khớp độ cao mặt trời; (2) Mô phỏng: sau N lần làm mới API, preset / cường độ / đêm không đổi; (3) `?test` không có `envmode`: ảnh và lệnh vẽ như `main`; (4) đủ 9 ngôn ngữ; (5) không lỗi console ở bốn chế độ khám phá khi đang Trực tiếp.

## 6. Để người làm tự quyết

Số cụ thể của `CONFIG.live` (chỉnh theo ảnh), cách vẽ chấm "TRỰC TIẾP", chỗ đặt công tắc trong bảng Cài đặt, cách chia tệp test.

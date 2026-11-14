# Giờ và thời tiết thực tế tại Đà Nẵng (D-042): thiết kế

_Ngày: 2026-11-14 · Nhánh: `feature/thoi-tiet-thuc` (từ `main` `3be9ca3`) · Trạng thái: người dùng đã duyệt prototype phương án B và việc hiện chỉ báo trong chế độ khám phá (2026-11-14); **đã triển khai trên nhánh** (HEAD mã `19658a3`, 2026-11-15, chưa push). Khác bản này sau khi đo trên trình duyệt: vị trí chỉ báo ở vài chế độ (lái xe cảm ứng dưới `#drMapNote` qua `--env-dr-top`; điện thoại đi dạo trái top 60 px; điện thoại xem dù lượn trái top 72 px; cửa sổ hẹp xe máy left 118 / top 134 px), 45 khóa i18n (không phải 46), `?test` không đọc bộ nhớ đệm; chi tiết ở D-042 trong `.github/memory-bank/decisions.md`. Đã chạy: `test:env:unit` 35/35, `TEST_REAL_GPU=1 test:env` 173 kiểm đạt; SwiftShader, `test:mobile`, `test:drawcalls` chưa chạy theo lời người dùng_

## 1. Ý định

Người xem thấy mình đang khám phá một Đà Nẵng "đang sống": lúc nào cũng biết **bây giờ ở Đà Nẵng là mấy giờ** và **thời tiết thật ở đó ra sao**. Khối này là một bảng quan trắc môi trường gắn vào cảnh 3D, không phải một ứng dụng thời tiết.

Yêu cầu gốc: bản "Real-time Weather & Local Time System" của người dùng (2026-11-14), làm theo trình tự thiết kế trước. Prototype đã duyệt nằm ở `prototypes/thoi-tiet-thuc/index.html` trong thư mục làm việc chính (không commit; có ảnh ở `shots/`). Khi triển khai **không thiết kế lại**: kích thước, màu, chữ, chuyển động lấy đúng từ CSS của prototype (khối `#env`, `.glass`, `.env-*`).

## 2. Mục tiêu / không làm / điều phải tránh

**Mục tiêu**
- Đồng hồ HH:mm:ss, thứ, ngày đầy đủ, "Đà Nẵng, Việt Nam", "ICT · UTC+7"; tính theo `Asia/Ho_Chi_Minh` bằng `Intl`, đúng trên máy ở mọi múi giờ; cập nhật mỗi giây, không gọi mạng.
- Thời tiết thật từ Open-Meteo: nhiệt độ °C (nổi bật nhất), biểu tượng + mô tả, cảm giác như, độ ẩm, tốc độ gió km/h, hướng gió, lượng mưa mm, mây che phủ %, chỉ số UV; giờ quan trắc của số liệu.
- Trạng thái: đang tải, bình thường, số liệu cũ, ngoại tuyến.
- Màu nhấn của khối đổi theo buổi thật (bình minh / ngày / hoàng hôn / đêm).
- 9 ngôn ngữ, RTL (`ar`), máy tính + điện thoại, mọi chế độ (tham quan, dù lượn, đi dạo, ô tô, xe máy, chế độ xem).

**Không làm**
- Không đổi cảnh 3D, preset thời tiết mô phỏng, thanh Ngày / Đêm, bộ đèn. Số liệu thật **chỉ đọc để hiển thị**.
- Không dự báo, không biểu đồ, không chọn địa điểm khác, không thư viện runtime mới.
- Không tự đồng bộ cảnh theo thời tiết thật (có thể là tính năng tùy chọn sau này, ngoài phạm vi).

**Điều phải tránh**
- Khối che cảnh hoặc che / chồng điều khiển đang có ở bất kỳ chế độ nào.
- Người xem nhầm số liệu thật với preset mô phỏng "Hiện trạng".
- Gọi mạng khi chạy test (`?test`): test hiện có đếm request và cần kết quả tất định.
- Phím điều khiển (Space, mũi tên, WASD) bị nút của khối nuốt khi đang lái / bay / đi.

## 3. Các cách đã cân nhắc

| | A · HUD nổi | **B · Chỉ báo mở rộng (đã chọn)** |
|---|---|---|
| Hình thức | Thẻ 264 px luôn hiện | Chỉ báo cao 44 px, bấm mới mở thẻ 312 px |
| Che cảnh | Luôn chiếm góc trên trái | Gần như không |
| Điện thoại | Che khoảng một phần ba màn hình | Chỉ báo trên thanh trên, thẻ thành tờ đáy |
| Hợp giao diện | Ngược hướng thu bảng thành nút (D-025) | Cùng kiểu nút ⚙ / ☰ |

Người dùng chọn B (2026-11-14). Không có phương án thứ ba; thẻ chi tiết của B có thêm vạch mặt trời mọc → lặn.

## 4. Thiết kế

### 4.1 Cấu trúc mã (quyết định của agent)

| File | Vai trò |
|---|---|
| `src/realtime/clock.ts` | Thuần: tách giờ / phút / giây và phút-trong-ngày của một `Date` theo múi giờ; tính buổi (`dawn` / `day` / `dusk` / `night`) từ phút mọc / lặn. |
| `src/realtime/weatherApi.ts` | Thuần: dựng URL, đọc JSON Open-Meteo thành `EnvWeather`, mã WMO → nhóm mô tả + biểu tượng, độ → 8 hướng, UV → mức. |
| `src/realtime/store.ts` | Vòng lấy số liệu: hẹn giờ, thử lại, tạm dừng khi tab ẩn, bộ nhớ đệm `localStorage`, trạng thái `loading / ok / stale / offline`, đăng ký lắng nghe. Nhận `fetch`, `now`, `storage` qua tham số để test đơn vị. |
| `src/ui/envUI.ts` | DOM: đồng hồ mỗi giây, vẽ số liệu, mở / đóng, đổi ngôn ngữ. Nối trong `main.ts` sau `setupCompactUI()`. |
| `index.html`, `src/styles/main.css` | Khối `#env` (nút `#envPill` + thẻ `#envCard`), kiểu chép từ prototype, đổi `position:absolute` → `fixed` và lớp `.app.*` → `body.*`. |
| `src/config.ts` | `CONFIG.env` (mục 4.5). |
| `src/ui/compactUI.ts` | Thêm tờ thứ ba `'env'` (`body.sheet-env`). |

Thư mục tên `realtime` để không lẫn với `src/environment/weather/` (mô phỏng). Hai bên không import nhau.

### 4.2 Vị trí

Dùng thuộc tính logic (`inset-inline-*`) trừ khi ghi "vật lý".

| Ngữ cảnh | Chỉ báo `#envPill` | Thẻ `#envCard` |
|---|---|---|
| Máy tính, tham quan | Cạnh ⚙: `top 17px`, `inset-inline-start 72px`, cao 44 px, đủ: biểu tượng, nhiệt độ, vạch, HH:mm, giây, (rê chuột: mô tả), mũi tên | Rơi xuống dưới chỉ báo, rộng 312 px |
| Máy tính, khám phá (`body.explore`) | Góc trên phía Thoát: `top 14px`, `inset-inline-end 14px`, cao 36 px, bản gọn: biểu tượng, nhiệt độ, vạch, HH:mm (không giây, không mô tả, không mũi tên) | Dưới chỉ báo, canh mép phía Thoát; khi mở che nút Thoát, đóng bằng bấm cảnh / Esc / bấm lại |
| Điện thoại (`body.compact`), tham quan | Góc trên phía cuối dòng: `top 13px`, `inset-inline-end 8px`, cao 44 px, bản gọn | Tờ đáy `z-index:10`, bo 18 px, có nút × 40 px, lớp mờ phía sau |
| Điện thoại, đi dạo (`body.compact.stroll`) | Cạnh ⚙: `top 13px`, `inset-inline-start 72px`, bản gọn | Tờ đáy |
| Điện thoại, ô tô / xe máy (`body.compact.drive`) | Cột trái **vật lý** dưới chú thích bản đồ nhỏ: `left 8px`, `top calc(60px + var(--dr-map-h,128px) + 40px)`, cao 34 px, bản gọn | Tờ đáy |

Lý do vị trí khám phá trên máy tính: ở `main`, xe máy đặt 🔊 đúng chỗ cạnh ⚙ (`left 72px`) và 🎥 ◄ ► ngay dưới; góc trên phía Thoát trống ở mọi chế độ khám phá (bảng ☰ ẩn, nút Thoát ở `top 56px`).

Không blur trên `body.compact` (quy tắc D-019); nền đục hơn (`--glass:.86`).

### 4.3 Hành vi

- Mở / đóng qua `openSheet('env')` của `compactUI.ts`: mỗi lúc một tờ; bấm cảnh, Esc, Tour / kịch bản bão bắt đầu thì đóng (cơ chế sẵn có). `#envPill` có `aria-expanded`, `aria-controls="envCard"`.
- Mở ⚙ hoặc ☰ thì thẻ đóng. Khi `body.sheet-settings` trên máy tính ở chế độ tham quan, chỉ báo mờ đi và không nhận chuột (bảng Cài đặt phủ lên chỗ đó).
- Trong `body.explore`: sau mỗi lần bấm chỉ báo hoặc ×, gọi `blur()` để Space / mũi tên không bấm lại nút.
- Màn chọn phương tiện (`#chooser`) và màn tải phủ lên chỉ báo (z-index 20); không cần xử lý riêng.
- Đổi số liệu: phần nhiệt độ và lưới số mờ ra / vào 180 ms. `prefers-reduced-motion`: không chuyển động (quy tắc chung đã có).
- Hiệu ứng lặp vô hạn chỉ có khối xám chạy sáng lúc đang tải.

### 4.4 Số liệu

Một yêu cầu GET, không khóa API:

```
https://api.open-meteo.com/v1/forecast?latitude=16.061&longitude=108.227
  &current=temperature_2m,apparent_temperature,relative_humidity_2m,is_day,precipitation,weather_code,cloud_cover,wind_speed_10m,wind_direction_10m,uv_index
  &daily=sunrise,sunset&timezone=Asia%2FHo_Chi_Minh&wind_speed_unit=kmh&forecast_days=1
```

Đã gọi thử ngày 2026-11-14: trả đủ các trường, `current.time` dạng `2026-11-14T22:15` (giờ địa phương), `current.interval` 900 s, `daily.sunrise[0]` / `sunset[0]` dạng `2026-11-14T05:49`.

- **Nhịp:** lấy khi khởi động, rồi mỗi `refreshMs`. Tab ẩn thì không lấy; hiện lại mà đã quá hạn thì lấy ngay. Sự kiện `online` thì lấy ngay.
- **Lỗi / quá `timeoutMs`:** thử lại sau `retryMs`, gấp đôi mỗi lần tới `retryMaxMs`.
- **Trạng thái:** chưa có số liệu và đang chờ → `loading`; chưa có số liệu và đã lỗi → `offline`; có số liệu và tuổi quan trắc ≤ `staleMs` → `ok`; có số liệu nhưng già hơn → `stale` (vẫn hiện số, mờ hơn, chấm vàng, chân thẻ ghi "Số liệu cũ · quan trắc HH:mm").
- **Bộ nhớ đệm:** lần lấy thành công ghi `localStorage` khóa `cauRong.env`; mở trang đọc lại để hiện ngay (trạng thái theo tuổi), lỗi đọc / ghi thì bỏ qua.
- **Giờ mọc / lặn:** từ `daily`; chưa có thì dùng `CONFIG.env.sunFallback`.
- **`?test`:** không lấy số liệu, trạng thái `loading`, đồng hồ vẫn chạy; trừ khi URL có `env=live` (test của tính năng này chặn URL bằng `page.route`). `__app.env` lộ `store` và `ui` cho test.
- **Mã WMO → nhóm:** 0 quang (ngày / đêm), 1 ít mây (ngày / đêm), 2 có mây, 3 nhiều mây, 45 / 48 sương mù, 51–57 mưa phùn, 61 / 66 / 80 mưa nhẹ, 63 / 81 mưa vừa, 65 / 67 / 82 mưa to, 71–77 / 85 / 86 tuyết, 95–99 dông; mã lạ → có mây. Biểu tượng: 5 hình của prototype (quang ngày / đêm, mây ngày / đêm, mưa) + sương mù, dông, tuyết vẽ cùng nét.

### 4.5 `CONFIG.env`

| Khóa | Giá trị | Ghi chú |
|---|---|---|
| `lat`, `lon` | 16.061, 108.227 | theo yêu cầu người dùng; trùng dòng tọa độ ở bảng Cài đặt |
| `tz` | `'Asia/Ho_Chi_Minh'` | |
| `api` | `'https://api.open-meteo.com/v1/forecast'` | |
| `refreshMs` | 600 000 | 10 phút (yêu cầu: 10–15 phút) |
| `staleMs` | 2 700 000 | 45 phút tính từ giờ quan trắc (ước lượng: 3 bước 15 phút) |
| `timeoutMs` | 10 000 | (ước lượng) |
| `retryMs`, `retryMaxMs` | 60 000, 300 000 | (ước lượng) |
| `dawnMin` | `[-30, 75]` | phút quanh giờ mọc coi là bình minh (ước lượng, theo prototype) |
| `duskMin` | `[-75, 35]` | phút quanh giờ lặn coi là hoàng hôn (ước lượng, theo prototype) |
| `sunFallback` | `[345, 1050]` | 05:45 và 17:30, phút trong ngày, dùng khi chưa có số liệu (ước lượng) |
| `storeKey` | `'cauRong.env'` | |

### 4.6 Chữ và 9 ngôn ngữ

Khóa `env*` ở cả 9 locale: nhãn (`envAria`, `envPlace`, `envFeels`, `envHum`, `envWind`, `envRain`, `envDir`, `envCloud`, `envUv`), 13 mô tả thời tiết (`envWx*`), 8 hướng (`envDirN` … `envDirNW`), 5 mức UV (`envUvLow` … `envUvExt`), mặt trời (`envSunrise`, `envSunset`, `envSunLeft`, `envSunIn`), chân thẻ (`envObs`, `envStale`, `envLoading`, `envOffline`, `envNoData`, `envClockOk`). Đơn vị km/h dùng lại `drSpeedUnit`.

- Ngày tháng: `Intl.DateTimeFormat(<ngôn ngữ>, { timeZone, weekday:'long', day, month:'long', year, numberingSystem:'latn' })`.
- Giờ: chữ số Latin, 24 giờ, ở mọi ngôn ngữ. Khoảng thời gian trên vạch mặt trời: `Intl.NumberFormat(..., { style:'unit', unit:'hour' | 'minute' })`.
- "ICT · UTC+7", "mm", "%", "Open-Meteo" không dịch.
- Thẻ có nhãn rõ là số liệu thực tế (`envAria`: "Giờ và thời tiết thực tế tại Đà Nẵng"); preset mô phỏng "Hiện trạng" giữ nguyên chữ.
- Khối `#env` theo hướng chữ của trang; cụm giờ và số đo đặt `dir="ltr"`.

### 4.7 Ràng buộc dự án

- Không đụng `build*()`, `rand()`, vòng `animate`, đèn, lệnh vẽ: +0 lệnh vẽ ở mọi góc.
- Không thư viện mới; `fetch` + `Intl` có sẵn.
- Open-Meteo: dữ liệu CC BY 4.0, phải ghi nguồn → liên kết "Open-Meteo" ở chân thẻ và một dòng trong README. Gói miễn phí dành cho mục đích phi thương mại (trang có nút "Buy me a coffee": người dùng đã được báo, tự cân nhắc). Mỗi người xem gọi thẳng từ trình duyệt của họ (lộ IP cho Open-Meteo, như mọi tài nguyên bên thứ ba khác của trang).

## 5. Kiểm

- `npm run test:env:unit` (mới, không trình duyệt): đồng hồ đúng khi múi giờ máy khác (đặt `TZ`), ranh giới buổi, đọc JSON mẫu, JSON hỏng / thiếu trường, mã WMO, hướng gió, mức UV, máy trạng thái của store (thành công, lỗi rồi thử lại gấp đôi, cũ, tab ẩn, bộ nhớ đệm), đủ khóa `env*` ở 9 locale.
- `npm run test:env` (mới, trình duyệt, đọc `dist/`): `?test` không gửi request tới Open-Meteo; với `env=live` + `page.route`: số liệu hiện đúng, đổi ngôn ngữ, bốn trạng thái, mở / đóng (bấm, Esc, bấm cảnh), loại trừ với ⚙ / ☰, preset mô phỏng và thanh Ngày / Đêm không đổi khi số liệu thật đổi; không chồng điều khiển ở 1280×720, 390×844, 844×390, `ar`, trong tham quan / đi dạo / ô tô / xe máy.
- `npm run typecheck`, `npm run build`, `npm run test:mobile` (đổi `index.html` / styles / ui).
- Test nặng còn lại chạy một lần cuối nhánh theo ý người dùng.

## 6. Để người làm tự quyết

Chi tiết DOM bên trong thẻ, tên hàm, cách căn mép giây, nét vẽ ba biểu tượng thêm (sương mù, dông, tuyết), bản dịch 8 ngôn ngữ (cần người bản ngữ duyệt sau).

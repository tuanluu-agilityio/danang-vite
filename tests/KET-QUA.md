# Kết quả kiểm tra (cập nhật 2026-10-22, nhánh `feature/tour-4-cau` sau Tour 4 cầu; bảng `now` bên dưới là của GĐ8)

Chromium + SwiftShader, khung 480×270. Draw call = renderer.info.render.calls (gồm bóng đổ, phản chiếu nước, bloom), trung vị 5 khung hình.

## Bộ test Tour 4 cầu (2026-10-22, nhánh `feature/tour-4-cau`)

Log: `tests/screens/tour4-gd4-*.log` (không commit). Không thêm mesh nên draw call phải không đổi.

| Lệnh | Kết quả |
|---|---|
| `npm run typecheck`, `npm run build` | đạt |
| `npm run test:drawcalls` | đạt, 58/58 phép đo (ngày + đêm) khớp bảng `now` bên dưới, chênh 0. Lần chạy đầu bị treo 240 s ở một thao tác nhấp (log `tour4-gd4-drawcalls.log`); chạy lại riêng một mình thì đạt. Chạy không kèm `tests/original` nên chỉ có cột `bản Vite` |
| `npm run test:tour` | đạt: dragon 8, tp 7, ttl 7, sh 6, hr 8, **all 13** (camera thấp nhất 24 m, cầu sông Hàn tự quay ở điểm 8, hết hành trình → orbit), storm 8 |
| `npm run test:voice` | đạt (vi + en + ru, 5 tour, 41 điểm dừng + 8 mốc kịch bản bão mỗi ngôn ngữ) |
| `npm run test:tunnel`, `test:riverfront`, `test:weather` | đạt |

Chưa có bằng chứng: FPS SwiftShader/GPU thật của Tour 4 cầu; giọng đọc nghe thật (headless chỉ kiểm file và thời lượng); Tour 4 cầu ở ban đêm / khi có thời tiết khác `now` (ảnh tự xem chỉ chụp ban ngày).

## Bộ test GĐ8 (2026-10-22)

Log đầy đủ: `tests/screens/weather-logs/gd8-l0-*.log`.

| Lệnh | Kết quả |
|---|---|
| `npm run build` | đạt (`tsc --noEmit` + `vite build`, 137 module) |
| `npm run test:drawcalls` | đạt, 58 góc nhìn (ngày + đêm) đo được ở trạng thái `now` (bảng dưới) |
| `npm run test:tour` | đạt: dragon 8, tp 7, ttl 7, sh 6, hr 8 điểm dừng |
| `npm run test:tunnel` | đạt |
| `npm run test:riverfront` | đạt |
| `npm run test:voice` | đạt (vi + en + ru, 4 tour, 28 điểm dừng mỗi ngôn ngữ) |
| `npm run test:weather` | đạt (`weather-check: đạt`) |

Lưu ý về log `test:drawcalls` GD8: lệnh chạy **không kèm** `tests/original`, nên log chỉ có cột `bản Vite`, không có cột `bản gốc` / `chênh`. Vì vậy bản này **chưa có bằng chứng chênh 0 so với bản gốc**. Số 2026-10-20 ở bảng cũ thấp hơn 7 draw call so với log GD8 ở cùng góc `overview|ngày` (275 → 282) và `head|ngày` (298 → 305); không xác định được phần chênh này do riverfront/hầm (đã merge sau 2026-10-20) hay do thời tiết. Muốn có cột chênh: `npm run test:drawcalls -- tests/original`.

## Draw call bản Vite (trạng thái `now`, không có preset thời tiết)

Các góc nhìn cũ (`overview` … `shDeck`) và các góc `hr*`, `rf*`, `wx*`. Log không ghi số draw call theo từng preset thời tiết (`rain`, `storm`, …); các giới hạn ngân sách (rain ≤ now + 1, storm ≤ now + 2) được kiểm trong `test:weather`, và log chỉ ghi kết quả đạt.

| góc nhìn | ngày | đêm |
|---|---|---|
| overview | 282 | 306 |
| head | 305 | 328 |
| tail | 236 | 264 |
| drive | 216 | 244 |
| bird | 267 | 297 |
| walk | 216 | 243 |
| tpBay | 274 | 295 |
| tpWater | 117 | 138 |
| tpDrive | 125 | 145 |
| tpBoth | 280 | 313 |
| ttlOverview | 239 | 261 |
| ttlBase | 130 | 151 |
| ttlDeck | 147 | 168 |
| ttlBoth | 245 | 267 |
| shOverview | 280 | 329 |
| shTop | 213 | 260 |
| shBank | 235 | 282 |
| shDeck | 206 | 253 |
| hrOverview | 277 | 307 |
| hrCutaway | 358 | 390 |
| hrPortalW | 163 | 190 |
| hrPortalE | 205 | 229 |
| hrDrive | 210 | 234 |
| hrGallery | 169 | 200 |
| rfHearts | 278 | 277 |
| rfBank | 203 | 203 |
| wxRiverMouth | 281 | 281 |
| wxTtlStays | 168 | 168 |
| wxStreet | 286 | 286 |

Góc `wx*` (GĐ6) đo ở `now`; số ở preset `rain` 60 % + gió 12 m/s = `now` + 1 đo trong `weather-gd6-shots.mjs` (ngày và đêm), không có trong log GD8.

## Draw call: bản gốc vs bản Vite (2026-10-20, bảng cũ)

Giữ để đối chiếu; chưa đo lại cùng lần chạy với bản gốc.

```
┌─────────┬────────────────────┬─────────┬──────────┬───────┐
│ (index) │ góc nhìn           │ bản gốc │ bản Vite │ chênh │
├─────────┼────────────────────┼─────────┼──────────┼───────┤
│ 0       │ 'overview|ngày'    │ 275     │ 275      │ 0     │
│ 1       │ 'head|ngày'        │ 298     │ 298      │ 0     │
│ 2       │ 'tail|ngày'        │ 231     │ 231      │ 0     │
│ 3       │ 'drive|ngày'       │ 212     │ 212      │ 0     │
│ 4       │ 'bird|ngày'        │ 260     │ 260      │ 0     │
│ 5       │ 'walk|ngày'        │ 211     │ 211      │ 0     │
│ 6       │ 'tpBay|ngày'       │ 270     │ 270      │ 0     │
│ 7       │ 'tpWater|ngày'     │ 115     │ 115      │ 0     │
│ 8       │ 'tpDrive|ngày'     │ 124     │ 124      │ 0     │
│ 9       │ 'tpBoth|ngày'      │ 274     │ 274      │ 0     │
│ 10      │ 'ttlOverview|ngày' │ 232     │ 232      │ 0     │
│ 11      │ 'ttlBase|ngày'     │ 128     │ 128      │ 0     │
│ 12      │ 'ttlDeck|ngày'     │ 144     │ 144      │ 0     │
│ 13      │ 'ttlBoth|ngày'     │ 239     │ 239      │ 0     │
│ 14      │ 'shOverview|ngày'  │ 260     │ 260      │ 0     │
│ 15      │ 'shTop|ngày'       │ 202     │ 202      │ 0     │
│ 16      │ 'shBank|ngày'      │ 219     │ 219      │ 0     │
│ 17      │ 'shDeck|ngày'      │ 194     │ 194      │ 0     │
│ 18      │ 'overview|đêm'     │ 298     │ 298      │ 0     │
│ 19      │ 'head|đêm'         │ 319     │ 319      │ 0     │
│ 20      │ 'tail|đêm'         │ 258     │ 258      │ 0     │
│ 21      │ 'drive|đêm'        │ 239     │ 239      │ 0     │
│ 22      │ 'bird|đêm'         │ 289     │ 289      │ 0     │
│ 23      │ 'walk|đêm'         │ 237     │ 237      │ 0     │
│ 24      │ 'tpBay|đêm'        │ 290     │ 290      │ 0     │
│ 25      │ 'tpWater|đêm'      │ 136     │ 136      │ 0     │
│ 26      │ 'tpDrive|đêm'      │ 144     │ 144      │ 0     │
│ 27      │ 'tpBoth|đêm'       │ 306     │ 306      │ 0     │
│ 28      │ 'ttlOverview|đêm'  │ 253     │ 253      │ 0     │
│ 29      │ 'ttlBase|đêm'      │ 148     │ 148      │ 0     │
│ 30      │ 'ttlDeck|đêm'      │ 164     │ 164      │ 0     │
│ 31      │ 'ttlBoth|đêm'      │ 260     │ 260      │ 0     │
│ 32      │ 'shOverview|đêm'   │ 306     │ 306      │ 0     │
│ 33      │ 'shTop|đêm'        │ 248     │ 248      │ 0     │
│ 34      │ 'shBank|đêm'       │ 265     │ 265      │ 0     │
│ 35      │ 'shDeck|đêm'       │ 240     │ 240      │ 0     │
└─────────┴────────────────────┴─────────┴──────────┴───────┘
Draw call trùng khớp bản gốc ở mọi góc nhìn.
```

## Tour

Log GD8 (`gd8-l0-test-tour.log`), bản Vite:

```
dragon 8 điểm dừng, camera thấp nhất 3 m → đạt
tp     7 điểm dừng, camera thấp nhất 3 m → đạt
ttl    7 điểm dừng, camera thấp nhất 3.22 m → đạt
sh     6 điểm dừng, camera thấp nhất 3 m, cầu tự quay (“Dừng xe, hạ barie”) → đạt
hr     8 điểm dừng, camera thấp nhất -14.73 m, mô phỏng dìm chạy (“FLOAT_IN”) → đạt
```

Bảng 2026-10-20 cho bản gốc (đối chiếu): dragon ghi LỖI do một điểm chạm ở (−282,2; 9,9; −2,2) đã có sẵn trong bản gốc. Từ GĐ4 (D-011), điểm 3 Tour Cầu Rồng đã đổi sang làn Bắc, nên dragon đạt ở bản Vite. `test:tour -- tests/original` vì vậy báo khác bản gốc ở dragon có chủ đích.

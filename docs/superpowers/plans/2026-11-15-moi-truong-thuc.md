# Môi trường 3D theo thời tiết + giờ thực tế (D-043) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Số liệu Open-Meteo và giờ Đà Nẵng lái cảnh 3D (chế độ Trực tiếp, mặc định), giữ nguyên toàn bộ mô phỏng cũ ở chế độ Mô phỏng.

**Architecture:** Hàm thuần đổi `EnvWeather` → `WeatherParams` đích và epoch → vị trí mặt trời → `night`; một bộ điều khiển (`liveEnv.ts`) ghi đích vào hệ thời tiết / ngày đêm sẵn có khi ở Trực tiếp và không ghi gì khi ở Mô phỏng. Không lưới, vật liệu, đèn, vòng lặp hay lần gọi API mới.

**Tech Stack:** Vite 6, TypeScript 5.9 (`strict: false`), three@0.165, test Node bằng `tsx --test`, test trình duyệt bằng Playwright (`tests/lib.mjs`).

**Spec:** `docs/superpowers/specs/2026-11-15-moi-truong-thuc-design.md` (đọc trước; plan không chép lại bảng ánh xạ §4.2).

## Global Constraints

- Đọc `.github/copilot-instructions.md` §3 (bất biến) và file `.github/instructions/*.instructions.md` ứng với vùng sửa trước khi sửa.
- Không đổi thứ tự `build*()` trong `src/main.ts`, không thêm / bớt lời gọi `rand()`; ngẫu nhiên mới dùng `rng(seed)`.
- Không thêm thư viện, `PointLight`, `SpotLight`, lưới hay vật liệu. Không sửa `src/core/water.ts` (shader nước) và `server/`.
- Mọi số ở `src/config.ts`, khối mới `CONFIG.live`: chú thích tiếng Việt, đơn vị, `(ước lượng)`.
- Khóa i18n mới có đủ 9 tệp `src/i18n/locales/{vi,en,ko,ja,zh,th,ar,hi,ru}.json`.
- `?test` không có `envmode`: hình, lệnh vẽ, hành vi như `main` `80273c9` (chế độ Mô phỏng, preset `now`, ban ngày). `applyNight(m, time)` không tham số thứ ba phải cho kết quả y như cũ; preset mô phỏng có `fog = 0`.
- Comment tiếng Việt, kiểu dòng dài như file xung quanh, không format lại file.
- Sau mọi thay đổi `.ts`: `npm run typecheck`. Không chạy test trình duyệt nặng (SwiftShader) trong từng task; chỉ test Node. Test trình duyệt chạy ở Task 7.
- Commit theo task trên `feature/moi-truong-thuc`, thông điệp tiếng Việt kiểu `feat(live): …`, kết bằng `Co-Authored-By: Claude Fable 5.2 <noreply@anthropic.com>`.

## Review Focus

1. Bộ nhớ đệm `localStorage['cauRong.env']` của bản D-042 (thiếu `gust` / `vis` / `rate`): phải đọc được, không ném, không thành `NaN` trong cảnh (test ở Task 1).
2. Số liệu có mã mưa nhưng `precipitation = 0`, hoặc `precipitation` lớn mà mã quang: cảnh theo lượng đo, sàn mưa phùn chỉ khi mã là mưa (Task 2).
3. Hướng gió qua mốc 0° / 360° (350° → 10°): quay cung ngắn, không quét 340° (Task 4).
4. Làm mới API đến khi đang Mô phỏng hoặc đang chạy kịch bản bão: không đổi gì trong cảnh (Task 5).
5. Tab ẩn nhiều giờ rồi hiện lại (ngày → đêm): cảnh tiến dần tới trạng thái mới, không khung nào có `dt` khổng lồ làm nhảy (Task 5).

---

### Task 1: Số liệu — trường mới, kiểm khoảng, tương thích bộ nhớ đệm

**Files:** Modify `src/realtime/weatherApi.ts`; Test `tests/env-unit/weatherApi.test.ts` (thêm ca, giữ ca cũ; xem tên tệp thật trong `tests/env-unit/`), fixture JSON của `tests/env-check.mjs` nếu nó liệt kê biến `current`.

**Interfaces — Produces:**
```ts
export type EnvWeather = { /* các trường cũ */ gust: number | null; vis: number | null; rate: number };   // gust km/h, vis m, rate mm/h
```
`envUrl` thêm `visibility,wind_gusts_10m` vào `current`. `envParse`: `rate = precipitation × 3600 / (current.interval || 900)`; khoảng hợp lệ theo spec §4.1 (bắt buộc ngoài khoảng ⇒ `null` cả phản hồi; `gust` / `vis` ngoài khoảng ⇒ `null`); `dir` chuẩn hóa về [0, 360). `envIsWeather` nhận đối tượng thiếu ba trường mới và **bổ sung tại chỗ** (`gust = null`, `vis = null`, `rate = rain × 4`).

- [ ] Viết ca test: phản hồi đủ trường (`interval: 900`, `precipitation: 0.5` ⇒ `rate === 2`); thiếu `interval` ⇒ coi 900; `temperature_2m: 99` ⇒ `null`; `visibility: -5` ⇒ `vis === null` còn lại hợp lệ; `wind_direction_10m: 370` ⇒ `dir === 10`; đối tượng đệm kiểu cũ qua `envIsWeather` ⇒ `true` và có `rate`, `gust === null`; URL chứa `visibility` và `wind_gusts_10m`.
- [ ] Chạy `npm run test:env:unit`, thấy ca mới trượt.
- [ ] Sửa `weatherApi.ts`.
- [ ] `npm run typecheck && npm run test:env:unit`: đạt hết (ca cũ không đổi kỳ vọng trừ khi do trường mới).
- [ ] Commit.

### Task 2: Ánh xạ số liệu → tham số cảnh (thuần)

**Files:** Create `src/realtime/envMap.ts`; Modify `src/config.ts` (khối `liveBase` → `CONFIG.live`), `src/environment/weather/state.ts` (thêm `fog` vào `WeatherParams`, `neutralParams`, `stepWeather` với `tau.fog`, quay `windDir` cung ngắn theo `tau.wind` thay cho gán thẳng **chỉ khi** `s.liveTau` bật, xem dưới), `package.json` (`"test:live:unit": "tsx --test tests/live-unit/*.test.ts"`); Test `tests/live-unit/envMap.test.ts`, `tests/live-unit/state.test.ts`.

**Interfaces — Produces:**
```ts
// envMap.ts — không import three / DOM
export function envToParams(w: EnvWeather, sunUp: boolean, cfg: typeof CONFIG.live): WeatherParams;   // level 0, closed false luôn
export function envWindDir(fromDeg: number): number;   // độ khí tượng (thổi TỪ, 0 = Bắc, thuận kim) → rad quy ước cảnh của WeatherParams.windDir
// state.ts
interface WeatherParams { /* cũ */ fog: number }        // 0 → 1 — sương / giảm tầm nhìn (preset mô phỏng: 0)
interface WeatherState { /* cũ */ tauScale: number }    // 1 = mô phỏng; Trực tiếp đặt CONFIG.live.tauScale; khác 1 thì windDir quay dần cung ngắn
```
`CONFIG.live` gồm tối thiểu: `rainCurve` (các cặp mm/h → 0–1 đúng spec §4.2), `rainMin: 0.05`, `drizzleFloor: 0.05`, `windMax: 40`, `gustFallback: 0.35`, `visCurve` (m → fog), `fogCodeFloor: 0.6`, `humHaze: { from: 85, max: 0.1 }`, `heat: { from: 33, span: 6 }`, `lightning: { storm: 0.5, hail: 0.8 }`, `tauScale: 3`, `fogMax`, `elevDay: 6`, `elevNight: -6`, `sunMinElev`, `obsStepMs: 900000`, `obsDelayMs: 90000`, `skewMaxMs: 7200000`. Thêm `tau.fog: 10` vào `CONFIG.weather.tau`.

Trước khi viết `envWindDir`: đọc `rain.ts` và `wind.ts` để xác định chính xác `windDir` được dùng thế nào (vector `(cos, sin)` trên trục X / Z?) và ghi kết luận vào comment đầu hàm. Kỳ vọng: gió Đông Bắc (45°) thổi về Tây Nam ⇒ vector có x < 0, z > 0.

- [ ] Test `envMap`: tám trạng thái của spec §4.7 dựng bằng `EnvWeather` cụ thể; khẳng định: quang (`code 0`, mưa 0, mây 5) ⇒ `rain === 0`, `fog === 0`, `lightning === 0`, `cloud ≈ 0.05`; `rate 0.5` ⇒ `0.06 < rain < 0.2`; `rate 30` ⇒ `rain > 0.85`; `rate 0` + `code 53` ⇒ `rain === 0.05`; `rate 0` + `code 3` ⇒ `rain === 0`; `hum 98`, `vis 20000`, `code 1` ⇒ `fog ≤ 0.1`; `code 45`, `vis 300` ⇒ `fog ≥ 0.9`; `vis null` + `code 45` ⇒ `fog === 0.6`; `wind 72 km/h` ⇒ `wind === 20`; `wind 300` (qua được vì test dựng thẳng) ⇒ `wind === 40`; `gust null` ⇒ `gust === 0.35 × wind`; `code 95` ⇒ `lightning === 0.5`; `code 63` ⇒ `lightning === 0`; `temp 38`, mây 0, `sunUp` ⇒ `haze > 0.5`, `sunUp false` ⇒ `haze === 0`; mọi kết quả `level === 0`, `closed === false`, mọi số hữu hạn; `envWindDir(45)` cho vector x < 0, z > 0.
- [ ] Test `state`: `stepWeather` với `tauScale 1` cho đúng kết quả như trước (so một bước `dt = 1` với công thức `approach` cũ, `windDir` gán thẳng); `tauScale 3` chậm hơn; `windDir` từ 350° tới 10° (đổi rad) với `tauScale 3` đi qua 0°, không qua 180°; `fog` tiến về đích.
- [ ] Thấy trượt, hiện thực, `npm run typecheck && npm run test:live:unit` đạt, `npm run test:env:unit` vẫn đạt.
- [ ] Commit.

### Task 3: Mặt trời (thuần)

**Files:** Create `src/realtime/solar.ts`; Test `tests/live-unit/solar.test.ts`.

**Interfaces — Produces:**
```ts
export function sunPosition(epochMs: number, latDeg: number, lonDeg: number): { elev: number; azim: number };   // độ; azim la bàn 0 = Bắc, 90 = Đông
export function liveNight(elevDeg: number, cfg: { elevDay: number; elevNight: number }): number;               // 0 ngày → 1 đêm, smoothstep, kẹp
export function sunWarm(elevDeg: number): number;                                                              // 0 → 1: 1 khi độ cao ≤ 2°, 0 khi ≥ 15°, 0 khi < −6°
```
Công thức NOAA (phương trình thời gian + xích vĩ theo năm phân số), không dùng `Date#getHours`, chỉ `epochMs`.

- [ ] Test (vĩ 16,061, kinh 108,227): 2026-06-21 04:47 UTC (gần trưa thật) ⇒ `elev` trong 82…83, 2026-12-21 04:45 UTC ⇒ `elev` 50…51 (= 90 − |16,06 ± 23,44|, sai ≤ 1°); 2026-03-20 trưa ⇒ `azim` gần 180 ± 10 và sáng 01:00 UTC ⇒ `azim` 85…100; mọc: tìm bằng dò từng phút thời điểm `elev` vượt −0,833° ngày 2026-11-15, phải trong 22:50…23:10 UTC ngày 14 (≈ 05:55–06:05 ICT; nới ±5 phút); lặn cùng ngày trong 10:05…10:25 UTC (≈ 17:15 ICT); `liveNight(6) === 0`, `liveNight(-6) === 1`, `liveNight(0) === 0.5`, đơn điệu; `sunWarm(1) === 1`, `sunWarm(20) === 0`, `sunWarm(-10) === 0`.
- [ ] Nếu mốc mọc / lặn lệch khoảng đã ghi: kiểm lại bằng một nguồn độc lập trước khi nới test (không sửa test cho khớp mã).
- [ ] Hiện thực, `npm run test:live:unit` đạt, typecheck, commit.

### Task 4: Cảnh nhận tham số mới (sương, mật độ mây, mặt trời thật)

**Files:** Modify `src/core/dayNight.ts`, `src/environment/weather/atmosphere.ts`, `src/environment/weather/index.ts`; đọc `src/core/sky.ts`, `src/core/lights.ts`, `tests/weather-check.mjs` (để không phá kiểm cũ).

**Interfaces — Consumes:** `WeatherParams.fog`, `WeatherState.tauScale` (Task 2), `sunWarm` (Task 3). **Produces:**
```ts
// dayNight.ts
export type SunOverride = { elev: number; azim: number; warm: number };          // elev / azim độ (azim la bàn), warm 0–1
export function applyNight(m: number, time: number, sun?: SunOverride | null): void;
// weather/index.ts — thêm vào interface Weather
setLive(p: WeatherParams | null, instant?: boolean): void;   // p: đặt target = p, enabled = true, tauScale = CONFIG.live.tauScale, không đụng state.preset / intensity; null: tauScale = 1 và trả target về presetTarget(state.preset, state.intensity), enabled = preset !== 'now'
readonly live: boolean;
```
Quy tắc:
- `applyNight` có `sun`: `setSun(max(sun.elev, CONFIG.live.sunMinElev) cho đèn, 180 − sun.azim)`, nhưng `sky.material.uniforms.sunPosition` nhận độ cao thật (cần tách tham số trong `setSun` hoặc thêm `setSunSky`; giữ chữ ký cũ chạy như cũ); `sun.intensity` nhân hệ số độ cao (1 khi `elev ≥ 35°`, giảm dần tới `CONFIG.live.sunLowK` ở chân trời); `sun.color` và màu sương lerp về màu ấm theo `warm` (màu ở `CONFIG.live`), nhớ trả `sun.color` về gốc khi không có `sun`. Không có `sun`: không một dòng nào chạy khác trước.
- `atmosphere.ts`: thêm `fogK = clamp01(c.fog)` vào điều kiện "không có gì thì restore"; mật độ sương nhân thêm `1 + (CONFIG.live.fogMax − 1) × fogK`, màu sương lerp về xám trắng (nhân `dark` ban đêm) theo `fogK`; `clouds.count` = làm tròn `lerp(CONFIG.live.cloudMin, 26, cloud)` **chỉ khi** `weather.live`, và trả về 26 trong `restore()` / khi rời Trực tiếp.
- Chớp, cây đổ (`aftermath`): khi `live` thì không gọi `fellTrees` (spec: không hư hại theo số liệu thật).
- `updateHooks` (đóng cầu …) không cần sửa vì `closed` luôn `false`.

- [ ] Thêm ca vào `tests/live-unit/state.test.ts` cho phần thuần nếu tách được (vd. hàm tính hệ số nắng theo độ cao đặt ở `solar.ts` / `envMap.ts` thay vì trong `dayNight.ts`); phần đụng three kiểm ở Task 7.
- [ ] Hiện thực; `npm run typecheck`, `npm run test:live:unit`, `npm run build`.
- [ ] Tự kiểm nhanh bằng mắt mã: grep mọi nơi gọi `applyNight(` và `setSun(`, xác nhận lời gọi cũ không đổi tham số.
- [ ] Commit.

### Task 5: Bộ điều khiển Trực tiếp / Mô phỏng + nhịp làm mới

**Files:** Create `src/realtime/liveEnv.ts`; Modify `src/realtime/store.ts`, `src/main.ts`, `src/ui/envUI.ts` (chỉ để lộ `now()` đã hiệu chỉnh), `src/ui/setupUI.ts` + `src/ui/weatherUI.ts` (chỉ để lộ hàm đồng bộ lại điều khiển, xem dưới); Test `tests/live-unit/liveEnv.test.ts`, thêm ca vào test kho của `tests/env-unit/`.

**Interfaces — Produces:**
```ts
// liveEnv.ts — phụ thuộc tiêm vào để chạy dưới Node
export type EnvMode = 'live' | 'manual';
export type LiveDeps = {
  cfg: typeof CONFIG.live; lat: number; lon: number;
  now: () => number;                                              // epoch ms (đã hiệu chỉnh)
  store: Pick<EnvStore, 'data' | 'status' | 'onChange' | 'refresh'>;
  weather: { setLive(p: WeatherParams | null, instant?: boolean): void; stopScenario(): void; standTrees(): void };
  dayNight: { night: number; target: number };
  initial: EnvMode;
};
export type LiveEnv = {
  readonly mode: EnvMode; readonly sun: SunOverride | null;       // sun: null ở Mô phỏng ⇒ main.ts gọi applyNight như cũ
  setMode(m: EnvMode, why?: 'user' | 'feature'): void;            // 'feature': tính năng cần đêm tự chuyển (UI hiện thông báo)
  update(dt: number): void;                                       // gọi mỗi khung TRƯỚC stepNight
  onChange(fn: (why: 'user' | 'feature' | 'data') => void): void;
};
export function createLiveEnv(d: LiveDeps): LiveEnv;
// store.ts
EnvDeps.nextDelay?: (now: number) => number;   // có thì thay cfg.refreshMs sau lần lấy thành công
EnvStore.skew(): number;                       // ms cần cộng vào giờ máy (0 khi lệch < CONFIG.live.skewMaxMs)
```
Hành vi:
- `update`: tính lại mặt trời khi `now` đổi quá 1 s kể từ lần trước; ở `live` ghi `dayNight.target = liveNight(elev)` và `sun`. Lần `update` đầu tiên ở `live` gán luôn `dayNight.night = target` (không chạy chuyển cảnh lúc mở trang).
- Kho đổi + `live` + `store.data` khác `null` ⇒ `weather.setLive(envToParams(...), lầnĐầu)`. `data` là `null` ⇒ không gọi gì (giữ trạng thái cuối). `manual` ⇒ bỏ qua hoàn toàn.
- `setMode('manual')`: nhớ không cần gì (trạng thái mô phỏng vẫn nằm trong `state.preset` / `intensity`); gọi `weather.setLive(null)`, trả `dayNight.target` về giá trị mô phỏng đã nhớ lúc rời Mô phỏng (mặc định 0), `sun = null`.
- `setMode('live')`: nhớ `dayNight.target` hiện tại, `weather.stopScenario()`, `weather.standTrees()`, `store.refresh()` nếu số liệu cũ hơn `refreshMs`, áp đích ngay (không `instant`).
- `main.ts`: `initial` = `?envmode=` nếu có, không thì `query.has('test') ? 'manual' : 'live'`; trong `animate()` gọi `liveEnv.update(dt)` trước `stepNight`, `applyNight(dayNight.night, time, liveEnv.sun)`; kẹp `dt` đưa vào `stepNight` / `updateWeather` như hiện có (kiểm xem `animate` đã kẹp `dt` chưa; nếu chưa, **không** đổi cho các hệ khác, chỉ bảo đảm sau tab ẩn lâu cảnh tiến dần: `dt` lớn làm `approach` nhảy thẳng tới đích, nên trong `liveEnv.update` nếu `dt > 1` thì coi là 1 cho phần Trực tiếp). Thêm `liveEnv` vào `__app` (`__app.live`).
- Nhịp: `nextDelay` ở Trực tiếp = thời gian tới mốc `obsStepMs` kế tiếp (tính theo `now` UTC) + `obsDelayMs` + nhiễu 0–20 s từ `rng` riêng; không nhỏ hơn 60 s.
- `skew()`: sau lần lấy thành công, `d = now − data.obs`; nếu `d < −skewMaxMs` hoặc `d > skewMaxMs + obsStepMs` thì `skew = −(d − obsStepMs / 2)`; `envUI` và `liveEnv` dùng `now() + skew()`.

- [ ] Test `liveEnv` (đồng hồ / kho / weather giả): mặc định theo `initial`; `live` + kho bơm số liệu ⇒ `setLive` được gọi với `envToParams` đúng, lần đầu `instant === true`, lần hai `false`; `manual` + kho đổi 3 lần ⇒ `setLive` không được gọi, `dayNight.target` không đổi; `setMode('live')` gọi `stopScenario`, `standTrees`; `setMode('manual')` gọi `setLive(null)` và trả `dayNight.target` đã nhớ; kho báo lỗi (`data` giữ nguyên, trạng thái `stale`) ⇒ không gọi `setLive` thêm; `now` = trưa ⇒ `target === 0`, nửa đêm ⇒ `1`; `update(3600)` sau khi đổi `now` từ trưa sang đêm ⇒ `dayNight.target === 1` nhưng `night` do `stepNight` lo (bộ điều khiển không ghi `night` sau lần đầu); `onChange` báo `'feature'` khi gọi `setMode('manual', 'feature')`.
- [ ] Test kho: `nextDelay` được dùng sau thành công, lỗi vẫn theo `retryMs`; `skew()` = 0 khi giờ máy đúng, khác 0 khi máy lệch 5 giờ; `inject()` không ghi `storage` (khẳng định `setItem` không được gọi).
- [ ] Hiện thực, `npm run typecheck && npm run test:live:unit && npm run test:env:unit && npm run build`.
- [ ] Commit.

### Task 6: Giao diện hai chế độ + i18n

**Files:** Modify `index.html`, `src/styles/main.css`, `src/ui/envUI.ts`, `src/ui/setupUI.ts`, `src/ui/weatherUI.ts`, 9 tệp `src/i18n/locales/*.json`; đọc trước `.github/instructions/ui-views.instructions.md`; Test: thêm khóa mới vào test đủ khóa của `tests/env-unit/` (xem test `env*` hiện có).

**Interfaces — Consumes:** `LiveEnv` (Task 5) qua tham số `setupEnvUI({ live, liveEnv })` và một hàm `bindLiveMode(liveEnv)` gọi từ `main.ts` sau `setupUI`.

Yêu cầu:
- `#envPill`: thêm phần tử `[data-mode]` hiện "TRỰC TIẾP" (chấm đỏ nhịp nhẹ, tắt nhịp khi `prefers-reduced-motion`) hoặc "MÔ PHỎNG"; `#env` có `data-mode="live|manual"`. Không làm chỉ báo rộng quá mức đang có trên điện thoại (đo: chữ chế độ ẩn ở cửa sổ ≤ 420 px, chỉ còn chấm).
- `#envCard`: hàng công tắc hai nút `role="radiogroup"` ("Trực tiếp" / "Mô phỏng") + một dòng giải thích theo chế độ.
- Bảng Cài đặt: `#timeSlider`, `#btnNight`, `#weatherSel`, `#weatherK`, `#btnWxStorm` có `disabled` khi Trực tiếp; phía trên nhóm đó một dòng `#liveLock` "Đang theo thời tiết thực tế" + nút `#btnToManual` "Chuyển sang Mô phỏng" (ẩn ở Mô phỏng, thay bằng nút `#btnToLive` "Về Trực tiếp").
- Khi về Mô phỏng: thanh Ngày / Đêm, ô chọn, thanh cường độ hiện lại đúng trạng thái mô phỏng (đồng bộ từ `dayNight.target`, `weather.state.preset`, `intensity`).
- Tính năng cần đêm (`btnShow` khi bật, `[data-view="rfHearts"]`, `[data-view="swNight"]`, tour Vòng quay; các chỗ ghi `dayNight.target = 1` trong `setupUI.ts`): nếu đang Trực tiếp thì gọi `liveEnv.setMode('manual', 'feature')` **trước** khi ghi; `onChange('feature')` ⇒ hiện thông báo `#liveNotice` (tự ẩn sau 8 s, có nút "Về Trực tiếp").
- Khóa i18n mới (tiền tố `live`): `liveBadge`, `simBadge`, `liveModeLive`, `liveModeManual`, `liveNoteLive`, `liveNoteManual`, `liveLock`, `liveToManual`, `liveToLive`, `liveNotice`, `liveNoData`. Tiếng Việt là bản gốc; 8 ngôn ngữ còn lại dịch tự nhiên, ngắn (chỉ báo ≤ 12 ký tự Latin).
- `ar` RTL: dùng thuộc tính logic (`inset-inline-*`, `margin-inline-*`).

- [ ] Thêm kiểm đủ khóa `live*` × 9 ngôn ngữ vào test Node, thấy trượt.
- [ ] Hiện thực; `npm run typecheck && npm run test:env:unit && npm run test:live:unit && npm run build`.
- [ ] Commit.

### Task 7: Test trình duyệt + kiểm chứng + tài liệu

**Files:** Create `tests/live-check.mjs`; Modify `package.json` (`"test:live": "node tests/live-check.mjs"`), `tests/env-check.mjs` (nếu kiểm cũ vỡ vì DOM mới), `.github/copilot-instructions.md` §5, `.github/memory-bank/{activeContext,progress,decisions}.md` (D-043), `.github/instructions/` (tệp ứng với `src/environment/weather` / `src/ui` nếu có quy tắc mới), README mục Cấu trúc nếu cần, trạng thái spec / plan.

`tests/live-check.mjs` theo mẫu `tests/env-check.mjs` (dùng `tests/lib.mjs`, tôn trọng `TEST_REAL_GPU=1`), mở `?test&envmode=live`, bơm bằng `__app.env.store.inject()` + `__app.env.setNow()`; đọc `__app.weather.state`, `__app.dayNight`, `__app.live`, `renderer.info.render.calls`. Kiểm 18 kịch bản spec §4.7, tối thiểu:
- Từng trạng thái: sau khi bơm và tua (gọi vài trăm khung hoặc chờ), `state.target` khớp kỳ vọng; mưa: lưới mưa hiện, 0 mm: ẩn; dông: `lightning > 0`; sương: `scene.fog.density` lớn hơn gốc và nhỏ hơn `gốc × fogMax × 1,01`.
- Hoàng hôn: `setNow` quét 16:30 → 18:30 ICT từng 5 phút, `dayNight.target` đơn điệu tăng 0 → 1; đêm: `shared.uNight ≈ 1`.
- Đổi số liệu giữa hai lần làm mới: ngay sau `inject`, khung kế tiếp `state.current.rain` đổi < 0,1.
- Lỗi API: `inject(dataCũ, true)` ⇒ `state.target` giữ nguyên; `inject(null, true)` lúc đầu ⇒ thời tiết trung tính, không lỗi console.
- Chuyển Mô phỏng: điều khiển hết `disabled`, chọn preset `storm`, bơm số liệu mới 3 lần ⇒ `state.preset === 'storm'`, `target.rain` không đổi; về Trực tiếp ⇒ `target` khớp số liệu, cây dựng lại.
- Kịch bản bão cũ chạy được ở Mô phỏng; bấm khi Trực tiếp không được (nút `disabled`).
- `?test` không `envmode`: `__app.live.mode === 'manual'`, `state.preset === 'now'`, `dayNight.target === 0`, lệnh vẽ góc mặc định bằng số đo cùng lượt ở `?test&envmode=manual`.
- Vào `?explore=glider|stroll|drive|bike` với `envmode=live` và số liệu mưa: không lỗi console, chỉ báo hiện chữ chế độ.
- Bậc chất lượng Thấp + mưa to: số vệt mưa theo `adaptiveSteps`, không lỗi.
- Hai trang cùng `inject` + cùng `setNow` ⇒ `state.target` và `dayNight.target` bằng nhau từng trường.
- `localStorage['cauRong.env']` không bị ghi bởi `inject`.

- [ ] Viết test, `npm run build`, chạy `TEST_REAL_GPU=1 npm run test:live`; sửa lỗi sản phẩm tìm ra (mỗi lỗi một commit `fix(live): …`).
- [ ] Chạy `TEST_REAL_GPU=1 npm run test:env`, `npm run test:weather`, `npm run test:mobile`; ghi kết quả thật.
- [ ] Chụp ảnh tay (GPU thật) vào `tests/screens/live-*.png` (không commit): nắng trưa, u ám, mưa to đêm, sương, hoàng hôn; xem từng ảnh, chỉnh `CONFIG.live` nếu sai rõ.
- [ ] Cập nhật tài liệu (chỉ ghi điều có thật: test đã chạy / chưa chạy), commit.

## Self-review

Spec §4.1 → Task 1; §4.2 → Task 2 + 4; §4.3 → Task 3 + 4 + 5 (`skew`); §4.4 → Task 5 + 6; §4.5 → Task 5 (`nextDelay`) + Task 7 (hai trang); §4.6 → ràng buộc chung + Task 7 (lệnh vẽ); §4.7 → Task 1–3, 5, 7. Review Focus 1 → Task 1, 2 → Task 2, 3 → Task 2 (`state.test.ts`), 4 → Task 5, 5 → Task 5.

## Trạng thái (2026-11-15)

Task 1–6 xong (commit `a26aeb5`, `f42ba7b`, `0050971`, `aa570c7`, `295b13f`, `3673d45`, `6863e1c`). Task 7 **dở**: người dùng bảo dừng test nặng rồi merge sau khi xem demo. Đã có từ Task 7: ba sửa sản phẩm `397d70a` (tính năng cần đêm chỉ chuyển Mô phỏng khi trời chưa tối), `bdeaf04` (sương che tấm LED), `96c843f` (hoàng hôn ấm hơn) và bản nháp `tests/live-check.mjs` (`9a8937f`, chưa chạy lần nào, chưa đối chiếu đủ 18 kịch bản). Chưa làm: chạy `test:live`, `test:env`, `test:weather`, `test:mobile`, so lệnh vẽ, bộ ảnh `tests/screens/live-*.png`. Các chỗ làm khác plan ghi ở D-043 trong `.github/memory-bank/decisions.md`.

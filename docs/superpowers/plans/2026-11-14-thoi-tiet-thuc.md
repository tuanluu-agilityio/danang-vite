# Giờ và thời tiết thực tế tại Đà Nẵng (D-042) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Thêm chỉ báo "giờ + thời tiết thực tế tại Đà Nẵng" (phương án B đã duyệt): nút nhỏ luôn hiện, bấm mở thẻ chi tiết; đồng hồ theo `Asia/Ho_Chi_Minh`, số liệu Open-Meteo, độc lập hoàn toàn với thời tiết mô phỏng.

**Architecture:** Ba module thuần / gần thuần trong `src/realtime/` (đồng hồ, đọc API, kho trạng thái có tiêm phụ thuộc) và một module DOM `src/ui/envUI.ts`. Mở / đóng dùng cơ chế tờ sẵn có của `src/ui/compactUI.ts` (thêm tờ `'env'`). Không đụng cảnh 3D, vòng `animate`, `src/environment/weather/`.

**Tech Stack:** TypeScript 5.9, Vite 6, CSS thuần, `fetch` + `Intl` của trình duyệt, test đơn vị `tsx --test`, test trình duyệt Playwright (`tests/lib.mjs`).

**Spec:** `docs/superpowers/specs/2026-11-14-thoi-tiet-thuc-design.md` (đọc trước; bảng vị trí §4.2, trạng thái §4.4, `CONFIG.env` §4.5 là nguồn số liệu).

**Prototype đã duyệt (nguồn CSS / DOM / SVG, không thiết kế lại):** `D:/2026 - Tuan/danang-vite/prototypes/thoi-tiet-thuc/index.html` (thư mục làm việc chính, ngoài worktree; chỉ đọc). Ảnh: `…/prototypes/thoi-tiet-thuc/shots/`.

## Global Constraints

- Làm trong worktree `D:/2026 - Tuan/danang-vite/.worktrees/thoi-tiet-thuc`, nhánh `feature/thoi-tiet-thuc`. Không `cd` ra thư mục chính, không `npm ci` / `npm install` (dùng `node_modules` của thư mục cha), không `git stash`.
- Không thư viện runtime mới. Không sửa `src/environment/**`, `src/core/**`, `src/explore/**`, `server/**`, thứ tự `build*()` trong `src/main.ts`.
- Mọi số ở `CONFIG.env` trong `src/config.ts`, mỗi dòng chú thích tiếng Việt + đơn vị + `(ước lượng)` khi không có nguồn.
- Khóa i18n mới có ở cả 9 file `src/i18n/locales/{vi,en,ko,ja,zh,th,ar,hi,ru}.json`. Chữ hiển thị luôn qua `t()`, vẽ lại khi `onChange`.
- CSS điện thoại viết dưới `body.compact …`, máy tính dưới `body:not(.compact) …`, không `@media (max-width)`; hover trong `@media (hover:hover)`; phần tử mới có `z-index` < 10 trừ tờ đang mở (= 10); không blur dưới `body.compact`.
- Comment tiếng Việt, khối tiêu đề `/* ===== … ===== */`, dòng dài kiểu file xung quanh, không format lại file có sẵn.
- `?test` không gửi request tới `api.open-meteo.com` trừ khi URL có `env=live`.
- Không chạy test trình duyệt nặng ngoài các lệnh ghi trong task. Commit theo từng task, kết thúc thông điệp bằng `Co-Authored-By: Claude Fable 5.2 <noreply@anthropic.com>`.

## Review Focus

1. Máy người xem đặt múi giờ khác (UTC−8, UTC+13): đồng hồ, ngày, buổi, giờ quan trắc vẫn theo Đà Nẵng. → Task 1 (test chạy với `TZ` khác).
2. Open-Meteo trả JSON thiếu trường / `null` / HTTP 429 / treo quá `timeoutMs`: không ném lỗi ra console, số cũ giữ nguyên, có thử lại. → Task 1 (store), Task 3 (console sạch).
3. Tab ẩn lâu rồi hiện lại (máy ngủ): không dồn request, lấy đúng một lần, trạng thái `stale` đúng theo tuổi quan trắc. → Task 1.
4. Đang lái / bay / đi mà bấm chỉ báo: Space, mũi tên không bấm lại nút, không mất điều khiển. → Task 2 (`blur()`), Task 3.
5. Chuỗi dài (ru, hi, th) và `ar` RTL: chỉ báo và thẻ không tràn, không chồng ⚙ / Thoát / đồng hồ tốc độ / bản đồ nhỏ. → Task 3.

---

### Task 1: Lõi `src/realtime/` + `CONFIG.env` + khóa i18n + test đơn vị

**Files:**
- Create: `src/realtime/clock.ts`, `src/realtime/weatherApi.ts`, `src/realtime/store.ts`
- Create: `tests/env-unit/clock.test.ts`, `tests/env-unit/weatherApi.test.ts`, `tests/env-unit/store.test.ts`, `tests/env-unit/locales.test.ts`, `tests/env-unit/fixture.json`
- Modify: `src/config.ts` (khối `envBase` cạnh `uiBase`, thêm `env: envBase` vào `CONFIG`), 9 file `src/i18n/locales/*.json`, `package.json` (`"test:env:unit": "tsx --test tests/env-unit/*.test.ts"`)

**Interfaces (Produces):**

```ts
// clock.ts
export type EnvPhase = 'dawn' | 'day' | 'dusk' | 'night';
export function envClockParts(d: Date, tz: string): { h: number; m: number; s: number; min: number };   // min = h*60+m theo tz
export function envHHMM(min: number): string;                                                            // 348 → "05:48", chữ số Latin
export function envPhase(min: number, sunrise: number, sunset: number, dawn: readonly [number, number], dusk: readonly [number, number]): EnvPhase;
// dawn khi sunrise+dawn[0] ≤ min < sunrise+dawn[1]; dusk khi sunset+dusk[0] ≤ min < sunset+dusk[1]; day khi sunrise ≤ min < sunset; còn lại night (dawn / dusk xét trước)

// weatherApi.ts
export type EnvIcon = 'clear-d' | 'clear-n' | 'cloudy-d' | 'cloudy-n' | 'cloud' | 'rain' | 'fog' | 'storm' | 'snow';
export type EnvWeather = { obs: number; obsMin: number; temp: number; feels: number; hum: number; wind: number; dir: number; rain: number; cloud: number; uv: number | null; code: number; isDay: boolean; sunrise: number | null; sunset: number | null };
// obs: epoch ms của current.time (giờ địa phương trong JSON trừ utc_offset_seconds); obsMin / sunrise / sunset: phút trong ngày theo giờ Đà Nẵng
export function envUrl(cfg: { api: string; lat: number; lon: number; tz: string }): string;              // đúng chuỗi truy vấn ở spec §4.4
export function envParse(json: unknown): EnvWeather | null;                                              // null khi thiếu current.time hoặc bất kỳ số bắt buộc nào không hữu hạn; uv / sunrise / sunset thiếu thì null
export function envWx(code: number, isDay: boolean): { key: string; icon: EnvIcon };                     // key là khóa i18n envWx*
export function envCompass(deg: number): 'N' | 'NE' | 'E' | 'SE' | 'S' | 'SW' | 'W' | 'NW';
export function envUvLevel(uv: number): '' | 'Low' | 'Mod' | 'High' | 'VHigh' | 'Ext';                   // ≤0 '', <3 Low, <6 Mod, <8 High, <11 VHigh, còn lại Ext

// store.ts
export type EnvStatus = 'loading' | 'ok' | 'stale' | 'offline';
export type EnvDeps = {
  cfg: typeof CONFIG.env; live: boolean;                         // live=false: không bao giờ gọi fetch
  fetch: (url: string, init?: { signal?: AbortSignal }) => Promise<{ ok: boolean; json(): Promise<unknown> }>;
  now: () => number; storage: { getItem(k: string): string | null; setItem(k: string, v: string): void } | null;
  setTimer: (fn: () => void, ms: number) => unknown; clearTimer: (id: unknown) => void;
};
export type EnvStore = {
  readonly data: EnvWeather | null; status(): EnvStatus;
  start(): void; stop(): void; refresh(): Promise<void>; setVisible(v: boolean): void;
  onChange(fn: () => void): void;
  inject(data: EnvWeather | null, failed?: boolean): void;       // cho test trình duyệt: đặt thẳng số liệu / trạng thái lỗi rồi báo onChange
};
export function createEnvStore(d: EnvDeps): EnvStore;
```

Bảng mã WMO → `{key, icon}`: 0 → `envWxClearD`/`envWxClearN`, `clear-d`/`clear-n`; 1 → `envWxFewD`/`envWxFewN`, `cloudy-d`/`cloudy-n`; 2 → `envWxPartly`, `cloudy-d`/`cloudy-n`; 3 → `envWxOvercast`, `cloud`; 45, 48 → `envWxFog`, `fog`; 51–57 → `envWxDrizzle`, `rain`; 61, 66, 80 → `envWxRainL`, `rain`; 63, 81 → `envWxRainM`, `rain`; 65, 67, 82 → `envWxRainH`, `rain`; 71–77, 85, 86 → `envWxSnow`, `snow`; 95–99 → `envWxStorm`, `storm`; mã khác → như mã 2.

`CONFIG.env`: đúng bảng spec §4.5 (`lat`, `lon`, `tz`, `api`, `refreshMs`, `staleMs`, `timeoutMs`, `retryMs`, `retryMaxMs`, `dawnMin`, `duskMin`, `sunFallback`, `storeKey`).

Khóa i18n (giá trị `vi`; 8 ngôn ngữ còn lại dịch tự nhiên, ngắn gọn, giữ `{t}` / `{n}`):
`envAria` "Giờ và thời tiết thực tế tại Đà Nẵng" · `envPlace` "Đà Nẵng, Việt Nam" · `envFeels` "Cảm giác như {t}°" · `envHum` "Độ ẩm" · `envWind` "Gió" · `envRain` "Lượng mưa" · `envDir` "Hướng gió" · `envCloud` "Mây che phủ" · `envUv` "Chỉ số UV" · `envWxClearD` "Trời nắng" · `envWxClearN` "Trời quang" · `envWxFewD` "Nắng, ít mây" · `envWxFewN` "Ít mây" · `envWxPartly` "Có mây" · `envWxOvercast` "Nhiều mây" · `envWxFog` "Sương mù" · `envWxDrizzle` "Mưa phùn" · `envWxRainL` "Mưa nhẹ" · `envWxRainM` "Mưa vừa" · `envWxRainH` "Mưa to" · `envWxSnow` "Tuyết" · `envWxStorm` "Dông" · `envDirN` "Bắc" · `envDirNE` "Đông Bắc" · `envDirE` "Đông" · `envDirSE` "Đông Nam" · `envDirS` "Nam" · `envDirSW` "Tây Nam" · `envDirW` "Tây" · `envDirNW` "Tây Bắc" · `envUvLow` "Thấp" · `envUvMod` "Vừa" · `envUvHigh` "Cao" · `envUvVHigh` "Rất cao" · `envUvExt` "Cực cao" · `envSunrise` "Mọc {t}" · `envSunset` "Lặn {t}" · `envSunLeft` "còn {t} nắng" · `envSunIn` "mọc sau {t}" · `envObs` "Quan trắc {t} · làm mới mỗi {n} phút" · `envStale` "Số liệu cũ · quan trắc {t}" · `envLoading` "Đang lấy số liệu quan trắc…" · `envOffline` "Mất kết nối · đang thử lại" · `envNoData` "Chưa có số liệu" · `envClockOk` "Đồng hồ vẫn chạy đúng giờ"

Hành vi store (spec §4.4): `start()` đọc bộ nhớ đệm (JSON `EnvWeather` hợp lệ theo cùng phép kiểm của `envParse` về kiểu số; hỏng thì bỏ), rồi `refresh()` nếu `live` và đang hiện. Thành công: ghi đệm, hẹn `refreshMs`. Lỗi (ném, `ok=false`, `envParse` null, quá `timeoutMs` qua `AbortController`): hẹn `retryMs × 2^n` kẹp `retryMaxMs`, `n` về 0 khi thành công. `setVisible(false)` hủy hẹn giờ; `setVisible(true)` lấy ngay nếu đã quá hạn kế tiếp, không thì hẹn phần còn lại. Không bao giờ có hai `fetch` cùng lúc. `status()`: `data` null → (`đã lỗi ít nhất một lần` hoặc `!live` thì … xem dưới); cụ thể: `!data && !failed` → `loading`; `!data && failed` → `offline`; `data && now − data.obs ≤ staleMs` → `ok`; còn lại `stale`. Với `live=false` và không có đệm: `loading`.

- [ ] **Step 1: Viết `tests/env-unit/fixture.json`** = phản hồi thật đã ghi ở spec §4.4 (đủ `utc_offset_seconds: 25200`, `current`, `daily`): `current.time` "2026-11-14T22:15", nhiệt 25.2, cảm giác 30.8, ẩm 93, `is_day` 0, mưa 0, mã 0, mây 10, gió 3.4, hướng 238, UV 0, mọc "2026-11-14T05:49", lặn "2026-11-14T17:13".

- [ ] **Step 2: Viết bốn file test (thất bại trước)** với các khẳng định:
  - `clock.test.ts`: `envClockParts(new Date('2026-11-14T15:15:07Z'), 'Asia/Ho_Chi_Minh')` = `{h:22,m:15,s:7,min:1335}`; cùng kết quả khi `process.env.TZ` là `'America/Los_Angeles'` và `'Pacific/Apia'` (đặt đầu file, trước khi tạo `Date`); nửa đêm: `'2026-11-14T17:00:00Z'` → `h` 0 (không phải 24); `envHHMM(348)` = `'05:48'`, `envHHMM(0)` = `'00:00'`; `envPhase` với mọc 349, lặn 1033, `[-30,75]`, `[-75,35]`: 318 night, 319 dawn, 423 dawn, 424 day, 957 day, 958 dusk, 1067 dusk, 1068 night, 0 night.
  - `weatherApi.test.ts`: `envParse(fixture)` cho `obs === Date.UTC(2026,10,14,15,15)`, `obsMin` 1335, `temp` 25.2, `isDay` false, `sunrise` 349, `sunset` 1033, `uv` 0; bỏ `daily` → `sunrise` null nhưng vẫn khác null; `current.temperature_2m = null` → null; `envParse(null)`, `envParse('x')`, `envParse({})` → null; `envUrl(CONFIG.env)` chứa `latitude=16.061`, `longitude=108.227`, `timezone=Asia%2FHo_Chi_Minh`, `wind_speed_unit=kmh`, `daily=sunrise,sunset` và đủ 10 biến `current`; `envWx` cho từng dòng của bảng mã (kể cả mã 999 → `envWxPartly`); `envCompass`: 0 N, 22 N, 23 NE, 238 SW, 359 N, −10 N, 370 N; `envUvLevel`: 0 '', 2.9 Low, 3 Mod, 6 High, 8 VHigh, 11 Ext.
  - `store.test.ts` (đồng hồ giả + hàng đợi hẹn giờ giả + `fetch` giả đếm lời gọi): (a) thành công → `ok`, `data.temp` 25.2, đệm được ghi, hẹn 600 000 ms; (b) `fetch` ném → `offline`, hẹn 60 000 rồi 120 000, 240 000, 300 000, 300 000; thành công sau đó → `ok` và lần lỗi kế tiếp lại 60 000; (c) có số liệu rồi mọi lần sau lỗi: `ok` cho tới khi `now − obs > 2 700 000` thì `stale`, `data` vẫn giữ; (d) `ok:false` (HTTP 429) và JSON hỏng đều tính là lỗi, không ném; (e) `fetch` treo: sau 10 000 ms bị hủy, tính là lỗi; (f) `setVisible(false)` → không lời gọi nào dù tua 1 giờ; `setVisible(true)` → đúng 1 lời gọi; (g) hai `refresh()` liền nhau → 1 lời gọi; (h) đệm hợp lệ có sẵn → `data` khác null ngay sau `start()` trước khi `fetch` xong; đệm `"{"` hoặc `{"temp":"x"}` → bỏ qua, không ném; `storage: null` và `setItem` ném → không ném; (i) `live:false` → 0 lời gọi, `status()` `loading`; (j) `onChange` gọi sau mỗi lần đổi; `inject(data)` → `ok`, `inject(null, true)` → `offline`.
  - `locales.test.ts`: 46 khóa `env*` liệt kê ở trên có trong cả 9 locale, là chuỗi không rỗng; khóa có `{t}` / `{n}` ở `vi` thì bản dịch cũng có đúng các tham số đó.

- [ ] **Step 3: Chạy** `npm run test:env:unit` → THẤT BẠI (module chưa có).

- [ ] **Step 4: Viết `src/config.ts` (`envBase`), ba module, 46 khóa × 9 locale.** `envClockParts` dùng `Intl.DateTimeFormat('en-GB', { timeZone, hour:'2-digit', minute:'2-digit', second:'2-digit', hourCycle:'h23' })` nhớ đệm theo `tz`.

- [ ] **Step 5: Chạy** `npm run test:env:unit` → mọi test đạt; `npm run typecheck` → sạch.

- [ ] **Step 6: Commit** `feat(realtime): lõi giờ + thời tiết thực tế Đà Nẵng (đồng hồ theo múi giờ, đọc Open-Meteo, kho trạng thái), CONFIG.env, khóa env* 9 ngôn ngữ (D-042 Task 1)`.

---

### Task 2: Giao diện `#env` (HTML, CSS, `envUI.ts`, tờ `'env'`)

**Files:**
- Create: `src/ui/envUI.ts`
- Modify: `index.html` (khối `#env` ngay sau `<header class="panel brand">…</header>`), `src/styles/main.css` (mục mới `/* ===== Giờ và thời tiết thực tế (D-042) ===== */` trước dòng `@media (prefers-reduced-motion…)` cuối file), `src/ui/compactUI.ts`, `src/main.ts`, `README.md`

**Interfaces:**
- Consumes: mọi export của Task 1; `t`, `onChange`, ngôn ngữ hiện tại từ `src/i18n` (xem `index.ts` để lấy mã ngôn ngữ đang dùng); `openSheet`, `ui` từ `compactUI.ts`.
- Produces: `export function setupEnvUI(opts: { live: boolean }): { store: EnvStore; render(): void; setNow(fn: (() => number) | null): void }`. `setNow` thay nguồn thời gian của đồng hồ và buổi (test dùng để ép giờ; `null` trả về `Date.now`). `main.ts` gọi `const envUi = setupEnvUI({ live: !query.has('test') || query.get('env') === 'live' })` ngay sau `setupCompactUI()` (dời khai báo `query` lên nếu cần, không đổi thứ khác) và thêm `env: envUi` vào `__app`.
- `compactUI.ts`: `Sheet = 'none' | 'settings' | 'views' | 'env'`; `openSheet('env')` bật `body.sheet-env`, đặt `aria-expanded` của `#envPill`; bảng `SHEET` thêm `env: ['#env', 'envPill']`; `reveal()` thêm nhánh `el.closest('#env')`.

**DOM** (chép cấu trúc từ prototype, đổi sang thuộc tính `data-i18n` / id thật): `<div id="env" data-phase="day" data-state="loading">` chứa `<button id="envPill" class="env-pill env-glass" aria-expanded="false" aria-controls="envCard" data-i18n-aria="envAria">` và `<div id="envCard" class="env-card env-glass" role="group" data-i18n-aria="envAria">` (nút `#envX` dùng khóa `close`; eyebrow; đồng hồ; ngày; vạch mặt trời; nhiệt độ + mô tả + cảm giác; lưới 6 ô; chân thẻ + liên kết `https://open-meteo.com/` `target="_blank" rel="noopener noreferrer"`). Thêm `<div id="envScrim">` cho tờ đáy điện thoại. Không có phương án A: bỏ `.env-more`, `.more`, mọi quy tắc `[data-concept="A"]`; lớp `.glass` của prototype đổi tên `.env-glass`.

**CSS:** chép khối `#env` … của prototype, đổi `position:absolute` → `fixed`, `.app.compact` → `body.compact`, `.app.sheet-settings` → `body.sheet-settings`, `#env.open` / `.app.env-open` → `body.sheet-env`, `left/right` → `inset-inline-start/end` theo bảng vị trí spec §4.2 (năm ngữ cảnh; hàng `body.compact.drive` dùng `left` vật lý), cộng `env(safe-area-inset-*)` như các bảng khác. Bản gọn (không giây, không mô tả, không mũi tên) áp cho `body.explore` và `body.compact`. `z-index`: chỉ báo 6, thẻ máy tính 9, lớp mờ 9, tờ đáy điện thoại 10. `body.explore` ẩn nhiều thứ bằng `display:none!important`: kiểm `#env` không dính quy tắc nào trong số đó.

**`envUI.ts`:**
- Đồng hồ: `setTimeout` căn mép giây kế tiếp; chỉ ghi `textContent` khi chuỗi đổi; tab ẩn thì dừng, hiện lại thì chạy tiếp và gọi `store.setVisible`. Mỗi lần phút đổi: vẽ lại ngày, buổi (`data-phase`), vạch mặt trời, chân thẻ.
- Buổi và biểu tượng ngày / đêm tính từ **đồng hồ** + giờ mọc / lặn (`data.sunrise ?? CONFIG.env.sunFallback[0]`), không dùng `is_day` của số liệu (số liệu có thể cũ).
- Số: nhiệt độ làm tròn số nguyên; gió làm tròn số nguyên + `t('drSpeedUnit')`; mưa 1 chữ số thập phân theo `toLocaleString(<ngôn ngữ>)` + " mm"; hướng = mũi tên xoay `dir + 180` độ + `t('envDir' + envCompass(dir))`; UV làm tròn số nguyên + mức (`''` thì chỉ số); ban đêm theo đồng hồ thì UV hiện 0 không mức. `uv` null → "—".
- Vạch mặt trời: chấm ở `(min − mọc) / (lặn − mọc)`, ẩn khi ngoài khoảng; chữ giữa `envSunLeft` (ban ngày) / `envSunIn` (đêm, tới lần mọc kế), `{t}` ghép giờ + phút bằng `Intl.NumberFormat(<ngôn ngữ>, { style:'unit', unit:'hour' | 'minute', unitDisplay:'short' })`, bỏ phần giờ khi 0.
- Trạng thái (`data-state` = `store.status()`): `loading` → khối xám; `offline` → nhiệt độ "– –", mô tả `envNoData`, dòng phụ `envClockOk`, chân `envOffline`; `stale` → chân `envStale` với `{t}` = `envHHMM(obsMin)`; `ok` → chân `envObs` với `{n}` = `refreshMs / 60000`; đang `loading` → chân `envLoading`.
- Bấm `#envPill`: `openSheet(ui.sheet === 'env' ? 'none' : 'env')`; `#envX`, `#envScrim`: `openSheet('none')`. Nếu `document.body.classList.contains('explore')` thì sau đó `(document.activeElement as HTMLElement)?.blur()`.
- `onChange` (đổi ngôn ngữ) và `store.onChange` → `render()`. Đổi số liệu: thêm lớp `.out` 180 ms cho hai khối `.env-swap` như prototype (bỏ qua khi `prefers-reduced-motion`).

**README:** một dòng ở mục giấy phép / nguồn: số liệu thời tiết thực tế từ Open-Meteo (CC BY 4.0, liên kết), gọi trực tiếp từ trình duyệt người xem; thêm `realtime/` vào mục **Cấu trúc**.

- [ ] **Step 1:** Sửa `compactUI.ts` (tờ `'env'`), `index.html`, `main.css`, viết `envUI.ts`, nối `main.ts`, README.
- [ ] **Step 2:** `npm run typecheck` → sạch; `npm run test:env:unit` → vẫn đạt; `npm run build` → đạt (ghi kích thước chunk `index` và css trước / sau).
- [ ] **Step 3:** Xem bằng mắt qua ảnh: viết script tạm (ngoài repo, trong thư mục tạm của hệ thống) dùng `serveDir('dist')` + Playwright GPU thật (`args: ['--use-angle=d3d11','--ignore-gpu-blocklist','--enable-gpu']`), chặn `googletagmanager|google-analytics|workers\.dev`, mở `?test&env=live` với `page.route('**/api.open-meteo.com/**')` trả `tests/env-unit/fixture.json`, chụp: máy tính 1440×900 đóng / mở; `__app.env.setNow` ép 13:20 và 21:10 giờ Đà Nẵng; điện thoại 390×844 đóng / mở. So với ảnh `shots/B-*.png`, `M-B-*.png` của prototype; sửa tới khi khớp (kích thước, màu, chữ, khoảng cách).
- [ ] **Step 4:** Commit `feat(ui): chỉ báo giờ + thời tiết thực tế Đà Nẵng, thẻ chi tiết kính tối, tờ 'env' (D-042 Task 2)`.

---

### Task 3: Test trình duyệt `tests/env-check.mjs` + sửa bố cục các chế độ

**Files:**
- Create: `tests/env-check.mjs`
- Modify: `package.json` (`"test:env": "node tests/env-check.mjs"`), `.github/copilot-instructions.md` §5 (hai dòng lệnh `test:env:unit`, `test:env`), `src/styles/main.css` / `src/ui/envUI.ts` khi test lộ lỗi

**Interfaces:** Consumes `__app.env.{store, render, setNow}`, `__app.ui`, `__app.weather`, `__app.dayNight`, `__app.explore`; helper `serveDir, launch, openApp, frames, tap, pick` của `tests/lib.mjs`; mẫu `rects` / `noOverlap` / `topAtCenter` của `tests/mobile-check.mjs` (chép hàm, không import chéo).

Mọi trang mở với `before: (page) => page.route('**/api.open-meteo.com/**', …)` đếm request và trả fixture (hoặc lỗi theo ca). Các mục:

1. **`?test` thường:** 0 request tới Open-Meteo sau 3 s; `#env` hiện, `data-state="loading"`; đồng hồ khớp `/^\d\d:\d\d$/` và bằng giờ Đà Nẵng tính độc lập trong test (`Date.now() + 7 h`, lệch ≤ 1 phút); giây đổi sau 1,2 s.
2. **`env=live`:** đúng 1 request; nhiệt độ "25", mô tả `vi` "Trời quang" (22:15 là đêm), độ ẩm 93, gió 3, hướng "Tây Nam", mưa "0,0", mây 10, UV 0; chân thẻ chứa "22:15" (dùng `setNow` ép 22:20 giờ Đà Nẵng ngày 2026-11-14 để trạng thái `ok`).
3. **Buổi:** `setNow` 05:50 → `data-phase="dawn"`, 13:00 → `day`, 17:00 → `dusk`, 21:00 → `night`; trong cả bốn lần `__app.dayNight.night` và giá trị `#timeSlider`, `#weatherSel`, `#weatherK` không đổi.
4. **Trạng thái:** `store.inject(null, true)` → `offline`, nhiệt độ "– –"; `setNow` +3 giờ sau quan trắc → `stale`, số vẫn hiện; route trả 500 → không có lỗi console.
5. **Độc lập với mô phỏng:** đổi `#weatherSel` sang `storm`, kéo `#timeSlider` 100 → chữ trong `#env` không đổi; `inject` số liệu khác → `__app.weather` (preset, cường độ) không đổi.
6. **Mở / đóng (máy tính 1280×720):** bấm chỉ báo → `body.sheet-env`, `aria-expanded="true"`, thẻ hiện và nằm trong khung; Esc đóng; bấm cảnh đóng mà camera không đổi; bấm ⚙ khi thẻ mở → thẻ đóng, bảng Cài đặt mở, và ngược lại; ☰ tương tự.
7. **Bố cục không chồng** (dùng `noOverlap` trên chỉ báo với các điều khiển đang hiện): máy tính tham quan 1280×720 (`#btnSettings`, `#btnViewsSheet`, `.specs`, `.stats`); điện thoại dọc 390×844 và ngang 844×390 tham quan (`.brand`, `.views`); lặp lại với `#ar`. Chế độ khám phá, máy tính 1280×720 và điện thoại 390×844, mỗi chế độ `?explore=stroll`, `?explore=drive`, `?explore=bike` (xem `tests/stroll-check.mjs`, `drive-check.mjs`, `bike-check.mjs` cách vào chế độ dưới `?test`): chỉ báo hiện, trong khung, không chồng `#btnSettings`, `#btnExExit`, `#stPhoto`, `#drMap`, `#drMapNote`, `#drSpeed`, `#drSoundBtn`, `.bk-btn`, `#drSteer`, `#drGas`, `#drBrake`, `#stPad`; `topAtCenter('#envPill')` đúng (không bị lớp `#drLook` / `#stLook` che: bấm được).
8. **Phím khi khám phá:** ở `?explore=drive` máy tính, bấm chỉ báo rồi nhấn Space → thẻ vẫn mở (`document.activeElement` không phải `#envPill`), Esc đóng thẻ mà không thoát chế độ.
9. **9 ngôn ngữ:** mỗi ngôn ngữ mở thẻ (máy tính + điện thoại dọc): không phần tử nào trong `#envCard` có `scrollWidth > clientWidth + 1`, thẻ trong khung; ngày là chuỗi không rỗng khác nhau giữa `vi` và `en`.
10. **Console:** không có lỗi ở mọi trang đã mở.

Kết thúc in `env-check: đạt` hoặc danh sách LỖI, mã thoát tương ứng (mẫu `mobile-check.mjs`).

- [ ] **Step 1:** Viết `tests/env-check.mjs` + script `test:env`.
- [ ] **Step 2:** `npm run build && npm run test:env`. Sửa CSS / `envUI.ts` cho tới khi mọi kiểm đạt (lỗi là của sản phẩm thì sửa sản phẩm; chỉ sửa test khi giả định của test sai, ghi rõ lý do trong báo cáo). Vị trí ở spec §4.2 là điểm xuất phát: nếu một ngữ cảnh vẫn chồng, dời trong cùng vùng và ghi số mới vào báo cáo.
- [ ] **Step 3:** `npm run test:mobile` (một lượt). Ghi nguyên văn kết quả; kiểm trượt không liên quan `#env` thì chỉ báo cáo, không sửa.
- [ ] **Step 4:** Thêm hai dòng lệnh vào `.github/copilot-instructions.md` §5.
- [ ] **Step 5:** Commit `test(env): env-check trình duyệt (trạng thái, độc lập mô phỏng, bố cục mọi chế độ, 9 ngôn ngữ) + sửa bố cục (D-042 Task 3)`.

---

## Sau các task (phiên điều phối)

- Review toàn nhánh, sửa.
- Cập nhật `.github/memory-bank/` (`activeContext.md`, `progress.md`, `decisions.md` D-042), `.github/instructions/ui-views.instructions.md` (tờ `'env'`, vị trí chỉ báo theo chế độ), trạng thái spec / plan.
- Test nặng còn lại (`test:drawcalls`, `test:perf -- --strict`, `test:explore`, `test:stroll`, `test:drive`, `test:bike`, `test:tour`…): hỏi người dùng trước khi chạy.
- Push / PR / merge chỉ khi người dùng bảo.

# Đoạn giới thiệu điện ảnh (Intro Guide) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Khách lần đầu vào trang xem một đoạn mở đầu ≈ 57 s quay bằng chính cảnh 3D và các chế độ thật, điều khiển được (bỏ qua, tạm dừng, nhảy nhịp, xem lại), rồi vào màn chọn phương tiện có sẵn.

**Architecture:** Module mới `src/intro/` giữ dòng thời gian chín nhịp; mỗi nhịp gọi hệ có sẵn (bốn chế độ chạy một mình bằng móc tự lái `auto`, `dayNight.target`, `show`, `SwingController`); camera các nhịp toàn cảnh do intro đặt dưới `cam.mode = 'intro'`. Giao diện là lớp DOM `#intro`. Mã cũ chỉ thêm móc, không đổi hành vi khi intro không chạy.

**Tech Stack:** Vite 6, TypeScript 5.9 (`strict: false`), three@0.165, DOM thuần, test đơn vị `tsx --test`, test trình duyệt Playwright (`tests/lib.mjs`).

**Spec:** `docs/superpowers/specs/2026-11-15-intro-dien-anh-design.md` (đọc trước; plan không chép lại bảng chữ và bảng kịch bản của spec).

## Global Constraints

- Đọc `.github/copilot-instructions.md` §3 (bất biến) và §6 (phong cách): comment tiếng Việt, khối tiêu đề `/* ===== … ===== */`, dòng dài "một dòng một ý", không format lại file cũ.
- Không thêm vật thể / vật liệu / đèn vào cảnh; không gọi `rand()`; không thư viện mới; không cấp phát mỗi khung trong `intro.update` và trong các hàm `auto`.
- Mọi số ở `CONFIG.intro` (`src/config.ts`), mỗi dòng có chú thích tiếng Việt + đơn vị + `(ước lượng)`.
- Khóa i18n mới tiền tố `in`, đủ 9 tệp `src/i18n/locales/{vi,en,ko,ja,zh,th,ar,hi,ru}.json`.
- Khi intro không chạy: `explore.update` / `stroll.update` / `drive.update` / `bike.update` chạy y như cũ; `?test` và `?test&chooser` không bao giờ thấy intro; `?explore=…` không bao giờ thấy intro.
- `npm run typecheck` sạch sau mỗi task. **Không chạy test SwiftShader nặng** (`test:explore`, `test:mobile`, `test:drawcalls`…); test trình duyệt của intro chạy bằng `TEST_REAL_GPU=1`.
- Commit trên `feature/intro-dien-anh`, message tiếng Việt kiểu `feat(intro): …`, kết thúc bằng dòng `Co-Authored-By: Claude Fable 5.2 <noreply@anthropic.com>`. Không commit `dist/`, `tests/screens/`. `node_modules` là junction: không `npm ci`, không xóa.

## Review Focus

1. Esc / phím lái trong lúc một chế độ đang chạy thử: không được tải lại trang (`explore.exit`) và không lái xe; Esc = bỏ qua intro. (Task 4, kiểm ở Task 5 mục 4.)
2. Bỏ qua khi nhịp Cầu sông Hàn đang xoay: cầu phải tự về `CLOSED`, không kẹt mở, intro thôi chạy nền sau đó. (Task 4; Task 5 mục 6.)
3. Mô hình chưa tải xong / tải lỗi khi tới nhịp của nó: nhịp vẫn chạy bằng hình tạm, không ném lỗi. (Task 4; Task 5 mục 9 chặn `*.glb`.)
4. Đổi ngôn ngữ giữa nhịp (kể cả `ar` RTL) và đổi cỡ cửa sổ / xoay máy: chữ đổi ngay, không tràn. (Task 3–4; Task 5 mục 7–8.)
5. `localStorage` / `sessionStorage` bị chặn: mọi lần đọc / ghi bọc `try`, intro vẫn phát và vẫn bỏ qua được. (Task 4; test đơn vị `inShould` ở Task 1.)

---

### Task 1: Lõi thuần + `CONFIG.intro` + test đơn vị

**Files:**
- Modify: `src/config.ts` (thêm `introBase` cạnh `strollBase`…, và `intro: introBase` trong `CONFIG`)
- Create: `src/intro/timeline.ts`, `src/intro/shots.ts`
- Create: `tests/intro-unit/timeline.test.ts`, `tests/intro-unit/shots.test.ts`
- Modify: `package.json` (script `"test:intro:unit": "tsx --test tests/intro-unit/*.test.ts"`, đặt cạnh `test:env:unit`)

**Interfaces — Produces:**

```ts
// src/config.ts  (Vec3 = [number, number, number])
intro: {
  fade: 0.45,                          // s — màn tối dần ở cuối nhịp và sáng dần ở đầu nhịp
  nightRamp: [1.0, 6.5],               // s — nhịp daynight: dayNight.target đi 0 → 1 tuyến tính trong khoảng này
  swingSpeed: 30,                      // hệ số tăng tốc quay Cầu sông Hàn (bằng Tour)
  drift: 0.012,                        // rad/s — camera trôi quanh điểm nhìn khi finale đã hết và khi tạm dừng không áp
  dragon: { fireAt: 1.2, waterAt: 5.8 },   // s trong nhịp dragon: bật show (show.t = 0); nhảy show.t = 27 (bắt đầu phun nước)
  scenes: [ { id: 'welcome', chapter: 1, dur: 7 }, { id: 'glider', chapter: 2, dur: 4.5 }, { id: 'car', chapter: 2, dur: 4.5 }, { id: 'bike', chapter: 2, dur: 4.5 },
            { id: 'walk', chapter: 2, dur: 4.5 }, { id: 'daynight', chapter: 3, dur: 8 }, { id: 'dragon', chapter: 4, dur: 9 }, { id: 'swing', chapter: 5, dur: 9 }, { id: 'finale', chapter: 6, dur: 6 } ],
  shots: {                             // m — tư thế camera đầu / cuối của nhịp toàn cảnh
    welcome:  { from: { pos: [-900, 950, 2300], target: [0, 0, -400] },  to: { pos: [-380, 210, 760],  target: [20, 20, -80] } },
    daynight: { from: { pos: [-520, 190, 420],  target: [60, 20, -200] }, to: { pos: [-420, 150, 300],  target: [60, 20, -260] } },
    dragon:   { from: { pos: [470, 60, 150],    target: [340, 18, 0] },   to: { pos: [396, 24, 46],     target: [336, 17, 0] } },
    swing:    { from: { pos: [230, 70, -820],   target: [0, 8, -1080] },  to: { pos: [150, 125, -910],  target: [0, 8, -1080] } },
    finale:   { from: { pos: [-300, 260, 500],  target: [0, 0, -300] },   to: { pos: [-760, 620, 1500], target: [0, 0, -300] } }
  },
  demo: {
    glider: { pos: [40, 135, 700], yaw: Math.PI / 2, turnFrom: 1.6, turnTo: 2.8, turn: 1, climb: 0 },   // đặt dù phía Nam Cầu Rồng bay về Bắc; rẽ trái nhẹ trong [turnFrom, turnTo] s
    car:    { gas: 1, camYawFrom: 1.0, camYawTo: 0, camYawS: 3.2 },   // rad — camera lệch quanh xe (drive.cam.yaw) về 0 trong camYawS giây
    bike:   { gas: 0.8, viewAt: 2.0 },                                  // s — lúc chuyển góc thứ nhất → thứ ba
    walk:   { run: false, camYawFrom: 0.5, camYawS: 3.5 }               // rad — camera lệch (so với hướng đi) về 0 trong camYawS giây
  },
  storeKey: 'cauRong.intro', seenKey: 'cauRong.introSeen', playKey: 'cauRong.introPlay'
}
export type IntroConfig = typeof introBase;

// src/intro/timeline.ts  — thuần, không import three / DOM
export type InSceneId = 'welcome' | 'glider' | 'car' | 'bike' | 'walk' | 'daynight' | 'dragon' | 'swing' | 'finale';
export interface InScene { id: InSceneId; chapter: number; dur: number }
export interface InClock { i: number; t: number; paused: boolean; done: boolean }   // i: nhịp đang chạy; t: giây trong nhịp; done: nhịp cuối đã hết thời lượng
export function inCreate(): InClock;                                                   // { i: 0, t: 0, paused: false, done: false }
export function inAdvance(c: InClock, scenes: readonly InScene[], dt: number): number; // trả chỉ số nhịp mới nếu vừa sang nhịp, không thì −1. paused ⇒ −1, không đổi gì. Nhịp cuối: t kẹp ở dur, done = true, không bao giờ sang tiếp
export function inSeek(c: InClock, scenes: readonly InScene[], i: number): number;     // kẹp i vào [0, n − 1], t = 0, done = false; trả i đã kẹp
export function inFade(t: number, dur: number, fade: number, first: boolean, last: boolean): number;   // độ đục màn tối 0–1: đầu nhịp 1 → 0 trong fade (first: không), cuối nhịp 0 → 1 trong fade (last: không)
export function inFill(c: InClock, scenes: readonly InScene[], k: number): number;     // mức đầy 0–1 của đoạn tiến trình thứ k (trước i: 1, sau i: 0, tại i: t / dur)
export function inShould(a: { explore: boolean; test: boolean; introParam: string | null; stored: string | null; seen: boolean; forced: boolean; reducedMotion: boolean; saveData: boolean }): boolean;

// src/intro/shots.ts — thuần
export type InVec = [number, number, number];
export interface InPose { pos: InVec; target: InVec }
export interface InShot { from: InPose; to: InPose }
export function inEase(k: number): number;                                             // smootherstep 6k⁵ − 15k⁴ + 10k³, kẹp [0, 1]
export function inPose(shot: InShot, k: number, pos: InVec, target: InVec): void;      // ghi vào pos / target (không cấp phát), nội suy theo inEase(k)
export function inOrbit(pos: InVec, target: InVec, ang: number): void;                 // quay pos quanh trục Y qua target một góc ang (rad), ghi tại chỗ
```

`inShould`: `false` nếu `explore`; nếu `introParam === 'off'` → `false`; nếu `test` → `introParam !== null`; nếu `forced` (cờ `playKey`) → `true`; còn lại `stored !== 'off' && !seen && !reducedMotion && !saveData`.

- [ ] **Step 1: Viết test đơn vị thất bại** — `tests/intro-unit/timeline.test.ts` (dùng `node:test` + `node:assert/strict` như `tests/env-unit/*.test.ts`), tối thiểu các ca:
  - `inAdvance`: từ `inCreate()`, cộng dồn `dt = 0.05` qua `CONFIG.intro.scenes` → lần lượt trả 1…8 đúng một lần mỗi chỉ số; tổng thời gian tới khi `done` = tổng `dur` (57 s ± 0,05); sau `done` gọi tiếp vẫn `i === 8`, `t === 6`.
  - `paused = true` ⇒ `inAdvance` trả −1 và `t` không đổi.
  - `inSeek(c, S, 99)` → 8; `inSeek(c, S, -3)` → 0; `t === 0`, `done === false`.
  - `inFade(0, 7, 0.45, true, false) === 0`; `inFade(0, 4.5, 0.45, false, false) === 1`; `inFade(2, 4.5, 0.45, false, false) === 0`; `inFade(4.5, 4.5, 0.45, false, false) === 1`; `inFade(6, 6, 0.45, false, true) === 0`.
  - `inFill`: tại `i = 3, t = 2.25` → `inFill(k=2) === 1`, `inFill(k=3) === 0.5`, `inFill(k=4) === 0`.
  - `inShould` bảng chân trị: `explore` → false; `test` không `introParam` → false; `test` + `introParam ''` → true dù `seen`; `introParam 'off'` → false; `stored 'off'` → false; `seen` → false; `forced` + `seen` → true; `reducedMotion` → false; mặc định sạch → true.
  - `CONFIG.intro.scenes`: 9 nhịp, id đúng thứ tự spec §4, `chapter` không giảm, 1…6; mỗi id trong `['welcome','daynight','dragon','swing','finale']` có `CONFIG.intro.shots[id]`.
  - Đủ khóa i18n: đọc 9 tệp JSON, lấy tập khóa bắt đầu `in` + chữ hoa ở `vi.json`, khẳng định tập đó **không rỗng và bằng nhau** ở cả 9 tệp (ca này sẽ đỏ tới khi Task 3 xong; đánh dấu `{ todo: 'Task 3' }` để bộ test không đỏ).
  - `tests/intro-unit/shots.test.ts`: `inEase(0) === 0`, `inEase(1) === 1`, `inEase(0.5) === 0.5`, đơn điệu trên 21 điểm; `inPose` tại `k = 0` / `1` trả đúng `from` / `to`; `inOrbit` giữ nguyên khoảng cách ngang tới target và `y`, quay π đưa `pos` sang đối xứng qua target.
- [ ] **Step 2:** `npm run test:intro:unit` → FAIL (module chưa có).
- [ ] **Step 3:** Thêm `introBase` vào `src/config.ts` (đúng các giá trị ở khối Interfaces), viết `timeline.ts`, `shots.ts`.
- [ ] **Step 4:** `npm run test:intro:unit` → mọi ca đạt (trừ ca `todo`); `npm run typecheck` sạch.
- [ ] **Step 5:** Commit `feat(intro): lõi dòng thời gian + tư thế camera + CONFIG.intro (D-045 Task 1)`.

---

### Task 2: Móc ở các chế độ có sẵn

**Files:**
- Modify: `src/views/state.ts`, `src/views/camera.ts`, `src/ui/swingUI.ts`
- Modify: `src/explore/index.ts`, `src/explore/stroll/index.ts`, `src/explore/drive/index.ts`, `src/explore/bike/index.ts`
- Modify: `src/explore/chooser.ts`

**Interfaces — Produces:**

```ts
// views/state.ts: CameraMode thêm 'intro' (camera do intro.update đặt ngay sau updateCamera)
// views/camera.ts: nhánh rỗng `else if (cam.mode === 'intro') { /* tư thế do intro.update đặt */ }` trước nhánh mặc định
// ui/swingUI.ts: hai điều kiện swingStart / swingClosed thêm `&& cam.mode !== 'intro'`

explore.auto: ((inp: GliderInput) => void) | null            // khác null: update() gọi auto(_inp) thay exInputFromKeys
explore.start(at?: { pos: [number, number, number]; yaw: number }): void   // có at: đặt state.pos / yaw trước exPlaceGlider + exChase(snap); bỏ trống: y như cũ
explore.stop(): void     // chỉ khi đang bay (không phải đang xem): state = null, ẩn dù (glider.visible = false, removeFromParent), keys.clear(), gỡ lớp body 'explore' nếu start() là bên thêm, cam.mode 'glider' → 'orbit', controls.enabled = true; không tải lại trang
stroll.auto: ((inp: StInput) => void) | null                 // khác null: thay stInputFromKeys + touch.read
stroll.stop(): void      // chỉ khi đang đi (không xem): state = null, stAvatars.setSelf(selfSlot, null), gỡ nhóm nhân vật khỏi scene, keys.clear(), gỡ lớp 'stroll' (+ 'explore' nếu start() thêm), cam.mode 'stroll' → 'orbit', controls.enabled = true
drive.auto: ((inp: DrInput) => void) | null                  // khác null: thay drInputFromKeys + touch.read; còi tắt
bike.auto: ((inp: BkInput) => void) | null                   // khác null: thay bkInputFromKeys + bkTouchMerge; grip và gió giật vẫn tính như cũ sau auto; còi tắt

// explore/chooser.ts
export function exShowChooser(onPick, onWatch?, opts?: { defer?: boolean }): void   // defer: gắn mọi thứ như cũ nhưng KHÔNG hiện; không defer: y như cũ
export function exRevealChooser(): void    // hiện màn chọn (hidden = false, inert phần dưới, focus thẻ đầu); chờ #loading.done như cũ; gọi nhiều lần an toàn
// explore/index.ts
export function setupExplore(ctrl: SwingController, deferChooser = false): void    // deferChooser: truyền { defer: true } cho exShowChooser
```

Ghi chú cho người làm: `explore.stop()` và `stroll.stop()` theo mẫu `drive.stop()` (nhớ thứ `start()` đã đổi trong biến `saved`, trả lại ở `stop()`); cả bốn `stop()` phải gọi được nhiều lần và khi chưa `start()`. `auto` là thuộc tính ghi được của object chế độ, mặc định `null`. Dù lượn: `exNightStep` vẫn chạy trong `advance` như cũ.

- [ ] **Step 1:** Sửa `state.ts`, `camera.ts`, `swingUI.ts` như trên.
- [ ] **Step 2:** Thêm `auto` + `stop()` / `start(at)` cho bốn chế độ; tách `exRevealChooser`; tham số `deferChooser`.
- [ ] **Step 3:** `npm run typecheck` sạch; `npm run test:stroll:unit`, `npm run test:drive:unit`, `npm run test:bike:unit`, `npm run test:multi:unit` vẫn đạt như trước khi sửa (ghi số ca).
- [ ] **Step 4: Kiểm tay bằng script tạm** (không commit; để ở thư mục tạm, dùng `tests/lib.mjs` với `TEST_REAL_GPU=1`, `npm run build` trước): mở `?test`, qua `window.__app` gọi lần lượt cho từng chế độ `start()` → 30 khung → `stop()` → khẳng định `cam.mode === 'orbit'`, `camera.fov === 50`, `camera.near === 0.5`, `document.body.className` không còn `explore|stroll|drive|bike`, `renderer.info.render.calls` sau một khung bằng số đo trước khi `start()`; lặp ba vòng; console không có lỗi. `explore.stop` / `stroll.stop` cần lộ qua `__app.explore` / `__app.stroll.stroll` (đã lộ sẵn object).
- [ ] **Step 5:** Commit `feat(intro): móc tự lái auto + stop() cho bốn chế độ, cam.mode 'intro', màn chọn hiện trễ (D-045 Task 2)`.

---

### Task 3: Chữ 9 ngôn ngữ + khung DOM + CSS

**Files:**
- Modify: 9 tệp `src/i18n/locales/*.json`
- Modify: `index.html` (thêm `#intro` ngay trước `#chooser`; `#exIntroBtn` trong `.ex-box` sau `.ex-cards`; `#btnIntro` cuối `#brandBody` trước `#donateLink`)
- Modify: `src/styles/main.css` (mục mới `/* ===== Đoạn giới thiệu (D-045) ===== */` ở cuối)

**Khóa i18n** (vi / en lấy đúng bảng chữ spec §4; còn lại):

| Khóa | vi | en |
|---|---|---|
| `inCh1`…`inCh6` | Chào mừng · Bốn cách khám phá · Ngày và đêm · Cầu Rồng · Cầu sông Hàn · Bắt đầu | Welcome · Four ways to explore · Day and night · Dragon Bridge · Han River Bridge · Begin |
| `inT_<id>`, `inS_<id>` (9 nhịp) | bảng spec §4 | bảng spec §4 |
| `inWx` | Thời tiết: theo thời tiết thực của Đà Nẵng, hoặc tự chọn nắng, mưa, gió mùa, bão. | Weather: follows Da Nang's real weather, or pick sun, rain, monsoon or storm. |
| `inDragonNote` | Trình diễn thật: 21:00 thứ Bảy và Chủ nhật. | The real show: 9 pm on Saturdays and Sundays. |
| `inSwingNote` | Cầu quay thật: 23:00 thứ Bảy và Chủ nhật. | The real rotation: 11 pm on Saturdays and Sundays. |
| `inFast` | Tua nhanh {n}× | {n}× speed |
| `inSkip` · `inPrev` · `inNext` · `inPause` · `inPlay` | Bỏ qua · Nhịp trước · Nhịp sau · Tạm dừng · Tiếp tục | Skip intro · Previous · Next · Pause · Resume |
| `inNoMore` | Không hiện lại | Don't show again |
| `inStart` · `inReplay` · `inWatch` · `inTour` | BẮT ĐẦU KHÁM PHÁ · Xem lại · Xem giới thiệu · Tour 4 cầu có thuyết minh | START EXPLORING · Replay · Watch the intro · Narrated four-bridge tour |
| `inTry_glider` · `inTry_car` · `inTry_bike` · `inTry_walk` · `inTry_dragon` · `inTry_swing` | Bay thử · Lái ngay · Chạy thử · Đi dạo ngay · Xem trình diễn · Xem cầu quay | Try paragliding · Drive now · Ride now · Explore on foot · Watch the dragon show · See the bridge rotate |
| `inK_glider` | `W S|lên / xuống;A D|rẽ;Q E|chậm / nhanh` | `W S|climb / descend;A D|turn;Q E|slower / faster` |
| `inK_car` | `W A S D|lái;Space|phanh tay;H|còi;🖱|xoay camera` | `W A S D|drive;Space|handbrake;H|horn;🖱|turn camera` |
| `inK_bike` | `W A S D|lái;Space|phanh gấp;V|đổi góc nhìn;Q E|xi nhan` | `W A S D|ride;Space|hard brake;V|switch view;Q E|indicators` |
| `inK_walk` | `W A S D|đi;Shift|chạy;🖱|xoay camera;P|chụp ảnh` | `W A S D|walk;Shift|run;🖱|turn camera;P|photo` |
| `inTouch_car` · `inTouch_bike` · `inTouch_walk` | Cần gạt để lái · GA và PHANH · vuốt để nhìn quanh ‖ Cần gạt để lái · GA và PHANH · 🎥 đổi góc nhìn ‖ Cần gạt để đi · vuốt để xoay camera · 📷 chụp ảnh | Stick to steer · GAS and BRAKE · swipe to look around ‖ Stick to steer · GAS and BRAKE · 🎥 switch view ‖ Stick to walk · swipe to turn the camera · 📷 photo |
| `inAria` | Giới thiệu Đà Nẵng 3D | Introduction to Da Nang 3D |

Định dạng `inK_*`: các mục cách nhau `;`, mỗi mục `phím|nghĩa`; **phần phím không dịch** (giữ `W A S D`, `Space`, `Shift`, `🖱`…), chỉ dịch phần nghĩa. Bảy ngôn ngữ còn lại dịch theo en, cùng giọng với các khóa `ex*` / `dr*` / `bk*` / `st*` sẵn có trong tệp đó (xem `exHint`, `drHint`, `bkHint`, `stHint`, `drGas`, `drBrake` của chính ngôn ngữ đó để dùng đúng từ). Thêm khóa vào cuối mỗi tệp, giữ JSON hợp lệ.

**DOM** (`data-i18n` cho chữ tĩnh; chữ theo nhịp do `ui.ts` ghi):

```html
<div id="intro" role="dialog" aria-modal="true" data-i18n-aria="inAria" aria-label="Giới thiệu Đà Nẵng 3D" hidden>
  <div class="in-bar in-bar-t"></div><div class="in-bar in-bar-b"></div>
  <div id="inVeil"></div>
  <div class="in-top">
    <label class="lang in-lang"><span hidden data-i18n="language">Ngôn ngữ</span><select id="inLang" data-i18n-aria="language" aria-label="Ngôn ngữ"></select></label>
    <button id="inSkip" type="button" data-i18n="inSkip">Bỏ qua</button>
  </div>
  <div id="inCap" aria-live="polite">
    <div id="inEyebrow"></div><h2 id="inTitle"></h2><p id="inSub"></p><p id="inNote" hidden></p>
    <div id="inKeys" hidden></div>
    <button id="inAct" type="button" hidden></button>
  </div>
  <div id="inEnd" hidden>
    <button id="inStart" type="button" data-i18n="inStart">BẮT ĐẦU KHÁM PHÁ</button>
    <div class="in-modes">
      <button type="button" data-in-pick="glider" data-i18n="exGlider">Dù lượn</button><button type="button" data-in-pick="car" data-i18n="exCar">Ô tô</button>
      <button type="button" data-in-pick="bike" data-i18n="exBike">Xe máy</button><button type="button" data-in-pick="walk" data-i18n="exWalk">Đi dạo</button>
    </div>
    <div class="in-more"><button id="inTour" type="button" data-i18n="inTour">Tour 4 cầu có thuyết minh</button><button id="inReplay" type="button" data-i18n="inReplay">Xem lại</button></div>
  </div>
  <div class="in-foot">
    <div id="inProg" role="group"></div>
    <div class="in-ctl">
      <button id="inPrev" type="button" data-i18n-aria="inPrev" aria-label="Nhịp trước">◀</button>
      <button id="inPause" type="button" data-i18n-aria="inPause" aria-label="Tạm dừng" aria-pressed="false">❚❚</button>
      <button id="inNext" type="button" data-i18n-aria="inNext" aria-label="Nhịp sau">▶</button>
      <label class="in-nomore"><input id="inNoMore" type="checkbox"><span data-i18n="inNoMore">Không hiện lại</span></label>
    </div>
  </div>
</div>
```

`#exIntroBtn`: `<button type="button" id="exIntroBtn" class="ex-intro" data-i18n="inWatch">Xem giới thiệu</button>`. `#btnIntro`: `<button id="btnIntro" type="button" data-i18n="inWatch">Xem giới thiệu</button>`.

**CSS — yêu cầu** (dùng biến sẵn có `--gold`, `--ink`, `--text`, `--muted`, `--font-display`, `--font-body`, `--panel`, `--panel-line`):

- `#intro`: `position:fixed; inset:0; z-index:21` (trên `#chooser` 20), không nền (cảnh 3D lộ hẳn), bắt mọi con trỏ (`pointer-events:auto`) để kéo chuột không tới canvas. `#intro[hidden]{display:none}`.
- `body.intro`: ẩn `!important` mọi lớp khác: `.panel` (trừ thứ nằm trong `#intro`), `#env`, `#stHud`, `#drHud`, `#exChatBtn`, `#exChat`, `#exMpLabels`, `#chooser`. Viết sao cho thắng các quy tắc `body.explore …{display:block}` (độ đặc hiệu `body.intro.intro` hoặc `!important`).
- Dải phim `.in-bar`: đen, cao `clamp(28px, 7vh, 64px)`, trên / dưới, vào bằng `transform` 0,8 s khi `#intro` hiện. `#inVeil`: phủ kín, nền `#05080a`, `opacity` do JS ghi (không `transition`), `pointer-events:none`.
- Khối chữ `#inCap`: góc dưới trái (`inset-inline-start: clamp(20px, 5vw, 72px)`, `bottom: calc(dải phim + 84px)`), rộng tối đa `min(560px, 88vw)`. `#inEyebrow`: 11–12 px, chữ hoa, giãn chữ `.22em`, màu `--gold`, có gạch mảnh 28 px phía trước. `#inTitle`: `--font-display`, 600, `clamp(34px, 5.2vw, 68px)`, `line-height:1.02`, trắng ngà, `text-wrap:balance`, bóng chữ mềm để đọc được trên trời sáng. `#inSub`: 15–17 px, `--text`. `#inNote`: 12 px, `--muted`. Mỗi lần đổi nhịp JS gắn lại lớp `.in-in` cho `#inCap`: từng dòng trượt lên 14 px + hiện dần, trễ so le 70 ms (`@keyframes`), tắt khi `prefers-reduced-motion`.
- Phím `#inKeys`: hàng `flex` có `gap`, mỗi mục `<span class="in-k"><kbd>W</kbd><kbd>A</kbd>… <i>nghĩa</i></span>`; `kbd`: kính tối mờ (`rgba(10,18,22,.55)` + `backdrop-filter: blur(6px)`), viền `rgba(255,255,255,.22)`, bo 5 px, cao 24 px, `min-width:24px`, chữ `JetBrains Mono` 11 px; `i` không nghiêng, 12 px, `--muted`. Dạng cảm ứng: một dòng chữ `.in-touch`.
- Nút hành động `#inAct`: viên thuốc viền vàng, chữ vàng, có mũi tên `→` (`::after`, đảo ở RTL), rê chuột nền vàng chữ tối; `#inSkip`: viên thuốc kính tối, chữ trắng, góc trên phải (trong `.in-top`, dưới dải phim trên: `top: calc(dải phim + 12px)`); `.in-lang` cạnh nó, kiểu như `.ex-lang`.
- `.in-foot`: đáy, trên dải phim dưới; `#inProg`: 9 nút `button.in-seg` (cao 14 px vùng bấm, vạch 3 px, `flex:1`, đoạn đầu chương cách đoạn trước 10 px), trong mỗi nút `<i>` tô vàng theo `transform:scaleX(var(--f))` gốc trái (gốc phải ở RTL); rê chuột vạch dày 5 px. `.in-ctl`: ba nút tròn 36 px kính tối + ô "Không hiện lại" 12 px `--muted`.
- `#inEnd` (chỉ nhịp cuối): ở chỗ nút hành động, `#inStart` nền vàng chuyển sắc (như `.swing-btn`), chữ tối, 600, giãn chữ `.08em`, cao 52 px, bóng phát sáng nhẹ, rê chuột nhấc 2 px; `.in-modes`: bốn viên thuốc kính tối; `.in-more`: hai nút chữ gạch chân mảnh. Nút `disabled` (dù lượn trên cảm ứng): mờ 45 %.
- Nhịp cuối (`#intro[data-scene="finale"]`): `#inCap` ra giữa màn hình, căn giữa.
- Điện thoại (`body.compact` hoặc `@media (max-width:760px), (max-height:500px)`): `#inCap` căn giữa theo chiều ngang, `bottom` trên `.in-foot`, tiêu đề `clamp(26px, 8vw, 40px)`; nút ≥ 44 px; `env(safe-area-inset-*)` cho `.in-top` và `.in-foot`; `backdrop-filter:none` (như quy tắc `body.compact .panel`). Màn ngang thấp (`max-height:500px`): ẩn `#inNote`, `#inKeys` một dòng cuộn ngang, dải phim 20 px.
- `.ex-intro` (trong màn chọn): nút chữ nhỏ căn giữa dưới các thẻ, màu `--gold`, có `▶` phía trước; ẩn khi sảnh mở (`#chooser:has(#exMpLobby:not([hidden])) .ex-intro{display:none}`). `#btnIntro`: như các nút khác trong `#brandBody`; `body.explore #btnIntro{display:none!important}`.
- Font theo ngôn ngữ: `html:is([lang=ko],[lang=ja],[lang=zh],[lang=th],[lang=ar],[lang=hi]) #inTitle` giảm cỡ ~15 % và `letter-spacing:0` (như quy tắc `#loading`).

- [ ] **Step 1:** Thêm khóa vào `vi.json`, `en.json`, rồi 7 tệp còn lại.
- [ ] **Step 2:** `npm run test:intro:unit`: bỏ `todo` ở ca đủ khóa (nếu Task 1 đã có) → đạt. Kiểm thêm bằng một lệnh node: mọi `inK_*` ở 9 tệp có cùng số mục và phần phím giống hệt `en`.
- [ ] **Step 3:** Thêm DOM + CSS. `npm run build` đạt.
- [ ] **Step 4:** Commit `feat(intro): chữ 9 ngôn ngữ, khung #intro và kiểu dáng (D-045 Task 3)`.

---

### Task 4: Bộ điều khiển intro + nối vào trang

**Files:**
- Create: `src/intro/ui.ts`, `src/intro/scenes.ts`, `src/intro/index.ts`
- Modify: `src/main.ts`

**Interfaces — Consumes:** mọi thứ ở Task 1–3; `dayNight` (`core/dayNight`), `show` (`bridges/dragon/effects`), `camera`, `controls` (`core/renderer`), `onResize` (`core/postprocessing`), `cam` (`views/state`), `explore`, `stroll`, `drive`, `bike`, `stAvatars.preload()`, `plPreload()`, `exRevealChooser`, `exHideChooser`, `t` / `onChange` / `getLang` (`i18n`), `LiveEnv` (`realtime/liveEnv`).

**Produces:**

```ts
// src/intro/index.ts
export interface IntroDeps { ctrl: SwingController; live: LiveEnv | null }
export const intro: {
  readonly active: boolean;                      // đang phát (từ play() tới cleanup())
  readonly hold: boolean;                        // active && paused: main.ts bỏ bước của bốn chế độ
  readonly clock: Readonly<InClock>;             // cho test
  readonly sceneId: InSceneId | null;
  setup(d: IntroDeps): void;                     // gắn DOM, phím, nút #exIntroBtn / #btnIntro; gọi một lần
  wants(q: URLSearchParams): boolean;            // inShould(...) với giá trị đọc từ trình duyệt; đọc + xóa cờ playKey
  play(): void;                                  // phát từ nhịp 0 (chờ #loading.done nếu chưa); đang phát thì bỏ qua
  update(dt: number): void;                      // main.ts gọi mỗi khung, ngay sau updateCamera(dt)
  seek(i: number): void; next(): void; prev(): void; pause(on?: boolean): void;
  skip(): void;                                  // cleanup() + hiện màn chọn
  act(kind: 'glider' | 'car' | 'bike' | 'walk' | 'dragon' | 'swing' | 'tour'): void;   // cleanup() + hiện màn chọn + bấm hộ phần tử có sẵn (spec §5.2)
};
```

**Hành vi phải đúng (spec §5):**

- `play()`: ghi `sessionStorage[seenKey] = '1'`; gọi `plPreload()`, `drive.preload()`, `bike.preload()`, `stAvatars.preload()`; chụp trạng thái (spec §5.3); `live?.setMode('manual', 'user')` nếu đang `live`; `dayNight.target = 0`; `cam.mode = 'intro'`, `controls.enabled = false`, `cam.flight.then = null`; `exHideChooser()`; `body.classList.add('intro')`; hiện `#intro`; vào nhịp 0.
- Mỗi nhịp là một bản ghi `{ enter(), update(t, dt), leave() }` trong `scenes.ts`. Đổi nhịp (tự nhiên, `seek`, `next`, `prev`): `leave()` nhịp cũ → đặt trạng thái nền của nhịp mới → `enter()`. Trạng thái nền theo nhịp: `welcome` … `walk`: `dayNight.target = 0`, và khi **nhảy** tới (không phải chạy tự nhiên từ nhịp trước) thì đặt luôn `dayNight.night = 0`; `daynight`: bắt đầu 0, `update` ghi `target` theo `nightRamp`; `dragon`, `swing`, `finale`: `target = 1`, nhảy tới thì `night = 1`. `show.on = false` ở mọi nhịp trừ `dragon`.
- Nhịp toàn cảnh (`welcome`, `daynight`, `dragon`, `swing`, `finale`): `update` gọi `inPose(shot, t / dur, …)` rồi `camera.position.set`, `controls.target.set`, `camera.lookAt`; `cam.mode` phải là `'intro'` (đặt lại ở `enter` vì `stop()` của chế độ trước đưa về `'orbit'`; đặt lại `controls.enabled = false`). `finale` sau khi hết `dur`: `inOrbit` thêm `CONFIG.intro.drift × dt` mỗi khung.
- Nhịp chế độ: `enter` gọi `start()` (dù: `explore.start(CONFIG.intro.demo.glider)`), gán `auto`; `leave` gán `auto = null` rồi `stop()`.
  - `glider`: `auto` ghi `turn` = `demo.glider.turn` khi `t ∈ [turnFrom, turnTo]`, ngoài ra 0; `climb` = `demo.glider.climb`; `throttle` 0.
  - `car`: `auto` ghi `gas = demo.car.gas`, `brake = 0`, `steer = 0`, `hand = false`; `update` ghi `drive.cam.yaw` = nội suy `camYawFrom → camYawTo` theo `inEase(t / camYawS)` và `drive.cam.idle = 0` (để camera không tự trả về giữa chừng; xem `drCamPlace` trong `drive/camera.ts` rồi làm đúng theo cách nó xử lý kéo chuột).
  - `bike`: `auto` ghi `gas`, `brake = 0`, `steer = 0`, `hard = false`; `t ≥ demo.bike.viewAt` thì `bike.setView(3)` (một lần).
  - `walk`: `auto` ghi `mz` / `mx` sao cho nhân vật đi tới theo hướng `state.yaw` ban đầu (đọc `stInputFromKeys` trong `stroll/keys.ts` để biết quy ước dấu của "W" và ý nghĩa `camYaw`; đi theo hướng xuất phát cố định chứ không theo camera), `run = demo.walk.run`; `update` ghi `stroll.cam.yaw` lệch `camYawFrom` rồi về hướng đi trong `camYawS`.
  - Khi `hold`, `update` của nhịp không chạy (dòng thời gian đứng).
- `dragon`: `enter` `show.on = false`; `t ≥ fireAt` (một lần) `show.on = true; show.t = 0`; `t ≥ waterAt` (một lần) `show.t = 27`; `leave` `show.on = false`. Ghi `#inNote` = `t('inDragonNote')`.
- `swing`: `enter`: nếu `ctrl.state === 'CLOSED'` thì `ctrl.start(CONFIG.intro.swingSpeed)` (nếu `canStart()` sai thì thôi, nhịp vẫn chạy camera); `#inNote` = `t('inFast', { n: 30 }) + ' · ' + t('inSwingNote')`. `leave`: bật cờ "tiễn cầu".
- Tiễn cầu (chạy trong `intro.update` cả khi intro đã `cleanup`, cho tới khi `ctrl.state === 'CLOSED'`): `ctrl.speed = swingSpeed`; `state === 'OPEN'` ⇒ `ctrl.requestClose()`. Vào lại nhịp `swing` khi cầu chưa `CLOSED`: tắt cờ tiễn, để cầu đi tiếp; nếu đang `OPEN` thì giữ mở tới `leave`.
- Màn tối: mỗi khung `#inVeil.style.opacity = inFade(...)` (chỉ ghi khi đổi quá 0,01). Nhảy nhịp bằng nút: đặt `t = 0` của nhịp mới (màn bắt đầu tối rồi sáng dần), không chờ mờ ra.
- `cleanup()` đúng spec §5.3; gọi được nhiều lần; sau nó `intro.active === false`, `#intro.hidden`, `body` không còn lớp `intro`, camera về tư thế chụp bằng `camera.position.copy` + `controls.target.copy` + `controls.update()`.
- Mọi lời gọi `enter` / `update` / `leave` của nhịp bọc `try`; lỗi ⇒ `console.warn('[intro] …', e)`, `skip()`.
- Phím (listener `keydown` trên `window`, pha capture, đăng ký trong `setup`; chỉ xử lý khi `active`): bỏ qua nếu `ctrlKey || metaKey || altKey` hoặc `Tab`; `Escape` → `skip()`; `' '` → `pause()`; `ArrowRight` / `ArrowLeft` → `next()` / `prev()` (đảo ở RTL); `Enter` ở `finale` khi focus không nằm trên nút → `skip()`; mọi phím khác: không làm gì. Mọi phím đã vào đây: `stopImmediatePropagation()`; `preventDefault()` cho Space và mũi tên. Phím gõ trong `#inLang` (select) không chặn mũi tên. `keyup` capture cũng chặn lan khi `active`.
- `ui.ts`: dựng 9 nút `#inProg` một lần; `render(sceneIndex)` ghi eyebrow (`'0' + chapter + ' — ' + t('inCh' + chapter)`), tiêu đề, dòng phụ, ghi chú (`daynight`: `inWx`), phím (`matchMedia('(hover: none)')` ⇒ dòng `inTouch_*`; nhịp `glider` trên cảm ứng: `exDesktopOnly`, không nút hành động), nút hành động (`inTry_*`), `#intro.dataset.scene`, hiện `#inEnd` ở `finale`; gắn lại lớp `.in-in`; `aria-current` cho đoạn tiến trình. `fill()` mỗi khung ghi `--f` cho đoạn đang chạy (chỉ khi đổi ≥ 0,005). `onChange` của i18n ⇒ `render` lại nhịp hiện tại. `#inLang`: như `wireLang` trong `chooser.ts`. Nút `data-in-pick="glider"` và nút hành động dù lượn `disabled` trên cảm ứng.
- `act(kind)`: `cleanup()` → `exRevealChooser()` → bấm hộ: `glider` / `car` / `bike` / `walk` ⇒ `document.querySelector('button[data-pick="…"]').click()` (map `walk` → `data-pick="walk"`); `tour` ⇒ `[data-pick="guided"]`.click() rồi `[data-view="allTour"]`.click(); `dragon` ⇒ guided, `[data-bridge="dragon"]`, `[data-view="head"]`, rồi `#btnShow` nếu `aria-pressed !== 'true'`; `swing` ⇒ guided, `[data-bridge="sh"]`, rồi `#btnSwing`.
- "Không hiện lại": đổi ô ⇒ `localStorage[storeKey] = 'off'` hoặc xóa khóa; lúc `play()` ô phản ánh giá trị đã lưu.
- `#exIntroBtn` ⇒ `intro.play()`. `#btnIntro` ⇒ `sessionStorage[playKey] = '1'` rồi tải lại trang bỏ tham số `explore` / `chooser` (chép cách làm của `explore.exit()`; không gọi `explore.exit()` để khỏi vòng import nếu có).
- Mọi truy cập `localStorage` / `sessionStorage` bọc `try`.

**`main.ts`:**

- Import `intro`; ngay trước `setupExplore(...)`: `intro.setup({ ctrl: songHan.ctrl, live: liveEnv }); const autoIntro = intro.wants(query); setupExplore(songHan.ctrl, autoIntro); if (autoIntro) intro.play();`
- Vòng `animate`: `updateCamera(dt); intro.update(dt); if (!intro.hold) { explore.update(dt); stroll.update(dt); drive.update(dt); bike.update(dt); }` (giữ nguyên `pt = perf.lap('camera', pt)`).
- `__app`: thêm `intro`.
- `intro.play()` khi `#loading` chưa `done`: chờ bằng `MutationObserver` như `chooser.ts`.

- [ ] **Step 1:** Viết `ui.ts`, `scenes.ts`, `index.ts`; nối `main.ts`.
- [ ] **Step 2:** `npm run typecheck`, `npm run test:intro:unit`, `npm run build` đạt.
- [ ] **Step 3: Kiểm khói bằng script tạm** (không commit, `TEST_REAL_GPU=1`, 1280 × 720, `?test&intro`): chờ `__app.intro.active`; với mỗi `i` 0…8: `intro.seek(i)`, chờ 1,2 s, chụp `tests/screens/intro/<i>-<id>.png`, in `cam.mode`, `dayNight.target`, `show.on`, `songHan.ctrl.state`; rồi `intro.skip()`, khẳng định `#chooser` hiện, `cam.mode === 'orbit'`, `camera.fov === 50`; in mọi lỗi console. Sửa tới khi 9 ảnh có hình đúng chế độ và console sạch. Nếu xe máy / ô tô / người đi bộ không nằm trong khung hoặc đâm vật cản trong 4,5 s thì chỉnh số trong `CONFIG.intro.demo` (và báo lại số đã đổi).
- [ ] **Step 4:** Commit `feat(intro): bộ điều khiển chín nhịp, giao diện, nối vào luồng vào trang (D-045 Task 4)`.

---

### Task 5: Test trình duyệt `test:intro`

**Files:**
- Create: `tests/intro-check.mjs`
- Modify: `package.json` (`"test:intro": "node tests/intro-check.mjs"`)

Theo khuôn `tests/env-check.mjs` (`serveDir('dist')`, `launch()`, `openApp()`, `check(name, ok)`, in `intro-check: đạt` / danh sách lỗi, mã thoát 1 khi có lỗi). Một trình duyệt, các trang:

1. **Máy tính 1280 × 720 `?test&intro`**: sau khung đầu `intro.active`, `#intro` hiện, `#chooser` ẩn, `cam.mode === 'intro'`, `sceneId === 'welcome'`; đo trước đó (qua `before` hoặc ngay khi vào) không làm được nên mốc "trước intro" lấy ở trang 3.
2. Cùng trang: `seek` từng nhịp, chờ 1 s thật, kiểm: `glider` → `cam.mode 'glider'` và `explore.state.pos.z` giảm dần; `car` → `'car'`, `drive.state.v > 1`; `bike` → `'bike'`, sau `viewAt` + 0,5 s `bike.view === 3`; `walk` → `'stroll'`, vị trí đổi > 0,5 m; `daynight` → sau 7 s `dayNight.target === 1`; `dragon` → sau `fireAt` + 0,3 s `show.on && show.fireOn`, sau `waterAt` + 0,3 s `show.waterOn`; `swing` → trong 4 s `ctrl.state` thành `ROTATING_OPEN`; `finale` → `#inEnd` hiện. Rời mỗi nhịp chế độ: lớp body không còn `stroll|drive|bike`, `camera.fov === 50`.
3. **`?test&chooser`** (không intro): `intro.active === false`, `#intro.hidden`, màn chọn hiện; ghi mốc: `camera.position`, `controls.target`, `camera.fov`, `camera.near`, `document.body.className`, `dayNight.target`, số lệnh vẽ sau 3 khung. Bấm `#exIntroBtn` → intro phát; `seek(2)` (ô tô), chờ 1 s, `skip()` → so với mốc: mọi giá trị trùng (vị trí ± 0,01; lệnh vẽ bằng sau 5 khung và `dayNight.night` về lại mốc), màn chọn hiện, `drive.active() === false`.
4. Phím: đang nhịp `car`, nhấn `w` / `ArrowLeft`… ⇒ `ArrowLeft` lùi nhịp, `w` không đổi `drive.state.yaw` hay `intro`; `Space` ⇒ `clock.paused`, sau 0,5 s `clock.t` không đổi và `drive.state.x` không đổi; `Space` lại ⇒ chạy tiếp; `Escape` ⇒ intro tắt, **trang không tải lại** (đặt `window.__mark = 1` trước, còn sau).
5. Tiến trình: bấm đoạn thứ 7 ⇒ `sceneId === 'dragon'`; `#inNext` / `#inPrev` đổi nhịp; đoạn trước nhịp hiện tại có `--f` = 1.
6. Cầu: `seek(7)`, chờ tới `ROTATING_OPEN`, `skip()` ⇒ trong 20 s thật `ctrl.state === 'CLOSED'` và sau đó `ctrl.state` giữ `CLOSED` 2 s.
7. Ngôn ngữ: ở nhịp `dragon` đổi `#inLang` sang `en` ⇒ `#inTitle` = `THE DRAGON AWAKENS`; `ar` ⇒ `document.documentElement.dir === 'rtl'`, `#inCap` nằm nửa phải; lặp 9 ngôn ngữ ở nhịp `bike`: `#inTitle`, `#inKeys`, `#inAct` không tràn khung nhìn (`right ≤ innerWidth`, `left ≥ 0`), `#inKeys` có đúng 4 mục.
8. **Điện thoại 390 × 844 `?test&intro`** (`mobile: true`): mỗi nhịp: `#inCap`, `.in-foot`, `#inSkip` trong khung nhìn, không chồng nhau; nhịp `glider`: có chữ `exDesktopOnly`, `#inAct` ẩn; nhịp `car`: `#inKeys` là dòng cảm ứng; `finale`: `[data-in-pick="glider"]` `disabled`, `#inStart` cao ≥ 44 px. Xoay 844 × 390: như trên.
9. **Chặn mô hình** (`page.route('**/*.glb', abort)`, `?test&intro`): chạy `seek` qua 4 nhịp chế độ, không lỗi console ngoài cảnh báo tải, `cam.mode` đúng.
10. Nút hành động (mỗi cái một trang `?test&intro` mới vì vào chế độ thật): `finale` → `[data-in-pick="car"]` ⇒ `cam.mode === 'car'`, `drive.active()`, `intro.active === false`, `camera.fov === CONFIG.drive.cam.fov`; `dragon` → `#inAct` ⇒ `show.on === true`, `cam.mode` thuộc `fly|orbit`; `swing` → `#inAct` ⇒ `ctrl.state !== 'CLOSED'` trong 3 s; `#inTour` ⇒ `cam.mode` thuộc `fly|tour`; `#inStart` ⇒ màn chọn hiện, `cam.mode === 'orbit'`.
11. "Không hiện lại" + cờ phiên (trang không `?test`, chặn `api.open-meteo.com` và `googletagmanager` bằng `page.route`): lần đầu mở ⇒ intro phát; tải lại ⇒ không phát (cờ phiên), màn chọn hiện; xóa `sessionStorage`, tích ô ở lần phát kế, bỏ qua, xóa `sessionStorage`, tải lại ⇒ không phát; `?intro=off` ⇒ không phát; `?explore=stroll` ⇒ không phát.
12. Console sạch ở mọi trang (trừ trang 9).

- [ ] **Step 1:** Viết `tests/intro-check.mjs`, thêm script.
- [ ] **Step 2:** `npm run build && TEST_REAL_GPU=1 npm run test:intro`. Lỗi do sản phẩm thì sửa sản phẩm (trong phạm vi `src/intro/` và các móc của Task 2), lỗi do test thì sửa test; ghi lại từng lỗi đã gặp và cách xử lý.
- [ ] **Step 3:** Commit `test(intro): intro-check trình duyệt (D-045 Task 5)` (kèm các sửa sản phẩm nếu có, tách commit `fix(intro): …`).

---

### Task 6: Chỉnh hình theo ảnh GPU thật + tài liệu

- [ ] **Step 1:** Chụp ảnh từng nhịp (đầu / giữa / cuối) ở 1280 × 720 và 390 × 844, ngày / đêm; chỉnh `CONFIG.intro.shots` / `demo` / thời lượng và CSS tới khi khung hình đẹp, chữ đọc được trên mọi nền. Chạy lại `test:intro:unit`, `test:intro`.
- [ ] **Step 2:** Cập nhật `.github/copilot-instructions.md` §5 (hai lệnh mới), `.github/memory-bank/` (`activeContext.md`, `progress.md`, `decisions.md` D-045, `systemPatterns.md`: móc `auto` / `stop()`, `cam.mode 'intro'`, khóa lưu trữ), `.github/instructions/ui-views.instructions.md` (quy tắc `body.intro`), README mục **Cấu trúc** (`src/intro/`), trạng thái spec. Chỉ ghi điều có thật (test nào đã chạy / chưa).
- [ ] **Step 3:** Commit `docs(intro): spec, plan, D-045, memory bank, lệnh test`.

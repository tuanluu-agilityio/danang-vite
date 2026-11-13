# Người treo dù lượn dạng người thật (D-035) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

> **Trạng thái (2026-11-13):** Task 1–5 xong trên nhánh `feature/nguoi-du-luon-that` (`d7cb895` … `e059626`, spec + plan `5b799c2`, tài liệu `54a575d`); review toàn nhánh xong, sửa ở `227527d` (chỉ `plPreload` nạp `pilot.glb`, dt sau đứt mẫu, ngưỡng lệnh vẽ `multi-check` 3 lưới mỗi dù). Tại `227527d`: `test:explore` đạt 89/89, `test:multi` đạt Mục 1–6 + 7a (93 kiểm) rồi đứng ở 7b (lái xe, D-034), dừng tay; `test:perf -- --strict`, `test:drawcalls` chưa chạy theo lời người dùng (xem demo trước, test chạy một lần sau). Người dùng duyệt trên demo; PR #31.

**Goal:** Thay người khối treo dưới dù lượn bằng nhân vật có xương (Rocketbox `Military_Male_01`, MIT) có tư thế bay, phản ứng theo lượt rẽ / tăng giảm tốc / gió, và bộ đai + dây dựng bằng code bám theo xương.

**Architecture:** `src/explore/pilot/` gồm phần thuần (`react.ts`, `ik.ts`: lò xo, IK, không import three) và phần three (`load.ts`, `bones.ts`, `rig.ts`, `gear.ts`, `index.ts`). `glider.ts` có hai hình học dùng chung (`full` = hình tạm như cũ, `canopy` = chỉ cánh); rig sẵn sàng thì đổi sang `canopy` + nhóm con `ex-pilot`. Dây và đai là một `SkinnedMesh` gắn cứng theo xương nên luôn dính hai đầu.

**Tech Stack:** TypeScript 5.9, three@0.165 (`GLTFLoader`, `SkeletonUtils`, `AnimationMixer`), Blender 4.5 (`scripts/people/blender.mjs`), `tsx --test`, Playwright/Chromium SwiftShader cho test trình duyệt.

**Spec:** `docs/superpowers/specs/2026-11-12-nguoi-du-luon-that-design.md`

## Global Constraints

- Không thêm thư viện runtime. Không thêm đèn. Không đổi thứ tự `build*()`, không thêm / bớt `rand()`.
- Mọi thông số ở `src/config.ts` khối `explore.pilot`: mỗi dòng chú thích tiếng Việt, đơn vị, `(ước lượng)`.
- Comment tiếng Việt, khối tiêu đề `/* ===== ... ===== */`, tiền tố hàm `pl*`, dòng dài kiểu file xung quanh, không format lại file cũ.
- Không cấp phát trong đường khung hình (D-018).
- 5 góc kiểm cũ: +0 lệnh vẽ. Dù có rig ≤ 4 lệnh vẽ.
- `public/people/pilot.glb` ≤ 2,5 MB, ≤ 25 000 tam giác, ≤ 80 xương, có đoạn `sit`, không lưới vũ khí.
- `src/config.ts` đang có một thay đổi **chưa commit của người dùng** (`strollBase.walk` 1,6): không hoàn nguyên, không commit dòng đó.
- Agent con commit file của task mình (`git add` từng đường dẫn, không `git add -A`), **trừ `src/config.ts`**: để nguyên chưa commit, người điều phối tự commit phần của task. Test nặng (trình duyệt) chỉ chạy ở Task 5.
- Hệ cục bộ của dù: +X hướng bay, +Y lên, +Z phải; `bank > 0` nghiêng trái; `yaw` tăng rẽ trái.

## Review Focus

1. `pilot.glb` về **sau** khi người chơi đã rời bay sang xem (dù của mình ẩn) hoặc slot đổi chủ: không gắn rig nhầm, không lỗi → `plUpdate` chỉ gắn trong vòng khung cho dù đang hiện (Task 4, test `index` với bộ nạp giả).
2. `dt` = 0, âm, NaN, hoặc rất lớn (tab ẩn 30 s): lò xo không nổ, không NaN ở xương (Task 2 `react.test.ts`).
3. Đích IK ngoài tầm tay (phanh kéo hết + lắc mạnh): tay duỗi về phía quai, không NaN, khuỷu không gập ngược (Task 2 `ik.test.ts`).
4. Dù người khác nhảy vị trí (mẫu đầu, đổi chủ slot): `acc` / `vy` suy từ sai phân không giật người (kẹp tín hiệu ±1, đặt lại lò xo khi `plReset`) (Task 2 + Task 4).
5. Mất ngữ cảnh WebGL / `compileAsync` treo: quá `warmMs` vẫn dùng rig; quá `loadMs` thì hình khối (Task 4).

---

### Task 1: `gen:pilot` → `public/people/pilot.glb`

**Files:**
- Create: `scripts/people/pilot.py`, `public/people/pilot.glb`, `tests/pilot-unit/glb.test.ts`
- Modify: `public/people/LICENSE-Rocketbox.txt` (thêm dòng `pilot.glb`: nguồn `Military_Male_01`, đã bỏ dao, đổi màu, gộp vật liệu)
- Đọc mẫu: `scripts/people/convert.py` (tải nguồn, nhập FBX, gắn đoạn chuyển động, xuất glb, ảnh xem trước), `tests/stroll-unit/glb.test.ts`

**Interfaces — Produces:**
- `public/people/pilot.glb`: mét, +Y lên, mặt hướng +X, **gốc tọa độ tại xương `Bip01 Pelvis` ở tư thế chuẩn** (đứng), xương tên Rocketbox (three đổi dấu cách thành `_`: `Bip01_Pelvis`, `Bip01_Spine`, `Bip01_Spine1`, `Bip01_Spine2`, `Bip01_Neck`, `Bip01_Head`, `Bip01_L_Clavicle`, `Bip01_L_UpperArm`, `Bip01_L_Forearm`, `Bip01_L_Hand`, `Bip01_L_Thigh`, `Bip01_L_Calf`, `Bip01_L_Foot`, các ngón `Bip01_L_Finger0..4[1,2]`, tương tự `R`).
- Đoạn `sit` (từ `m_sit_chair_breathe_01`, vòng lặp 4–6 s khớp đầu cuối, 30 khung/giây, bỏ kênh ngón tay và bỏ dịch chuyển gốc: hông đứng yên tại gốc).
- `scenes[0].extras = { height, hip }` (m).
- ≤ 2 lưới / 2 vật liệu; màu 1024 JPEG, normal 1024 JPEG, nhám (từ specular) trong kênh G của ORM 512, metalness 0.
- Ảnh xem trước `scripts/people/.cache/preview-pilot/*.jpg`: chữ T trước / sau, tư thế `sit` 4 khung, cận mặt + tay.

- [x] **Step 1:** Viết `tests/pilot-unit/glb.test.ts` (đọc glb bằng node như `tests/stroll-unit/glb.test.ts`): `byteLength ≤ 2.5 * 1024 * 1024`; tổng tam giác ≤ 25 000; số joint ≤ 80; có animation tên `sit` dài 3–7 s; không node / mesh / material nào khớp `/knife|pistol|weapon|gun/i`; có đủ 14 xương bắt buộc liệt kê ở trên (dạng tên gốc có dấu cách hoặc `_`); `extras.hip > 0.8`; `LICENSE-Rocketbox.txt` chứa `pilot.glb` và `Military_Male_01`. Chạy `npx tsx --test tests/pilot-unit/glb.test.ts` → FAIL (chưa có tệp).
- [x] **Step 2:** Viết `scripts/people/pilot.py` theo mẫu `convert.py` (tái dùng `.cache`, commit ghim, đường `Assets/Avatars/Professions/Military_Male_01/`, texture `sm002_{body,equipment,helmet}_color_acu`, `sm002_head_color`, `*_normal`, `*_specular`). Xóa đối tượng / phần lưới dùng vật liệu `combat_knife`. Chỉnh màu: body / equipment / helmet → giảm bão hòa về 0 rồi nhân `(0.36, 0.40, 0.26)` (ô liu sẫm) cho body, `(0.20, 0.21, 0.20)` (than) cho equipment + helmet, giữ độ tương phản (gamma ≈ 1,15); **giày** và **găng** → than đen; da (pixel có hue 0–50°, bão hòa > 0,2 trong body) giữ nguyên. Vùng cờ + bảng tên: tìm bằng ảnh xem trước rồi tô phủ màu vải lân cận. Gộp vật liệu bằng atlas (4 ô 1024 → một ảnh 2048 thu về 1024 nếu vượt trần dung lượng; ưu tiên giữ độ nét mặt + thân).
- [x] **Step 3:** `npm run gen:pilot`; xem ảnh xem trước bằng mắt (Read ảnh): không còn dao, màu ô liu / than, da không bị ám, tư thế ngồi không gãy. Sửa tới khi đạt.
- [x] **Step 4:** `npx tsx --test tests/pilot-unit/glb.test.ts` → PASS. Báo: byte, tam giác, xương, số lưới, thời lượng `sit`, điều chưa làm được (vd. cờ chưa tô sạch).

### Task 2: Phần thuần: `react.ts`, `ik.ts`, cấu hình

**Files:**
- Create: `src/explore/pilot/react.ts`, `src/explore/pilot/ik.ts`, `tests/pilot-unit/react.test.ts`, `tests/pilot-unit/ik.test.ts`
- Modify: `src/config.ts` (thêm `pilot: {...}` vào `exploreBase`, sau `glider`)

**Interfaces — Produces:**
```ts
// react.ts — không import three
export interface PlSignals { turn: number; acc: number; vy: number; wind: number }   // turn, acc, vy đã kẹp [-1, 1]; wind 0..1 mức gió thời tiết
export interface PlPose {
  swingRoll: number; swingPitch: number; swingYaw: number;   // rad, cả người quanh điểm treo
  spineRoll: number; spinePitch: number; spineTwist: number; // rad, tổng cho 3 đốt
  headYaw: number; headRoll: number;                         // rad
  legSide: number; legFore: number; kneeL: number; kneeR: number; legSplit: number;   // rad
  brakeL: number; brakeR: number;                            // 0..1
  packRoll: number; packPitch: number; strap: number;        // rad, chuyển động phụ
}
export class PlReact { readonly pose: PlPose; constructor(seed: number); step(sig: PlSignals, dt: number): void; reset(): void }
/* Tín hiệu từ hai trạng thái liên tiếp (dùng cho mọi dù). Không cấp phát; prev được cập nhật tại chỗ */
export interface PlTrack { x: number; y: number; z: number; speed: number; has: boolean }
export function plSignals(out: PlSignals, prev: PlTrack, x: number, y: number, z: number, bank: number, dt: number, wind: number, turnInput?: number): void;
// ik.ts — không import three; vectơ là mảng số dùng lại
/* Hai khớp: gốc a, dài l1, l2, đích t, cực (hướng khuỷu) p → ghi vị trí khuỷu vào outElbow, đích đã kẹp vào outEnd; trả true nếu trong tầm */
export function plTwoBone(a: ArrayLike<number>, l1: number, l2: number, t: ArrayLike<number>, p: ArrayLike<number>, outElbow: number[], outEnd: number[]): boolean;
```
- `CONFIG.explore.pilot` (mọi dòng có chú thích + đơn vị + `(ước lượng)`): `model: 'people/pilot.glb'`, `loadMs: 15000`, `warmMs: 4000`, `remote: true`, `dtMax: 0.1`, `hang: { fore: 0.10, up: 0.42, half: 0.21 }` (m: điểm móc so với hông trong hệ nhân vật: ra trước, lên, nửa khoảng cách hai móc), `riser: 0.55` (m từ móc lên điểm tụ dây), `base: { recline: 0.30, hip: -0.25, knee: 0.35, legSplit: 0.06 }` (rad cộng lên `sit`), `toggle: { fore: 0.16, up: 0.30, half: 0.30, travel: 0.32 }` (m: quai phanh khi thả, so với điểm treo; quãng kéo), `brake: { base: 0.12, turn: 0.75, slow: 0.6, fast: 0.1 }`, `amp: { swingRoll: 0.20, swingPitch: 0.14, swingYaw: 0.05, leanRoll: 0.16, leanPitch: 0.12, twist: 0.14, headYaw: 0.35, headLevel: 0.6, legSide: 0.20, legFore: 0.22, knee: 0.30, pack: 0.05, strap: 0.5 }` (rad), `spring: { swing: [0.55, 0.35], spine: [1.6, 0.8], head: [2.2, 0.9], legs: [0.9, 0.45], brake: [3.0, 1.0], pack: [1.1, 0.3] }` ([Hz, hệ số tắt]), `gust: { amp: 0.035, freq: [0.23, 0.37, 0.61], windGain: 2.5 }`, `limits: { swing: 0.45, spine: 0.35, head: 0.7, leg: 0.5, knee: [0, 1.2] }`, `gear: { strapW: 0.045, lineR: 0.012, colors: {...} }` (Task 3 bổ sung khóa con nếu cần).

- [x] **Step 1:** Viết `tests/pilot-unit/react.test.ts`:
  - `đứng yên 20 s, wind 0, gust.amp tạm = 0 qua tham số dựng` → mọi trường swing / spine / leg có |giá trị| < 1e-3, `brakeL ≈ brakeR ≈ brake.base` (±0,01).
  - `turn = +1 giữ 6 s` (rẽ trái) → `swingRoll` và `spineRoll` **trái dấu nhau**; `brakeL > brakeR + 0.4`; `headYaw > 0.1` (cùng dấu yaw rẽ trái); đổi `turn = −1` thì mọi dấu đảo.
  - `acc = −1 giữ 3 s` → `brakeL` và `brakeR` đều > `base + 0.3`, `kneeL > 0`; `acc = +1` → cả hai < `base`.
  - `bước nhảy turn 0 → 1`: `swingRoll` có vọt lố (đỉnh tuyệt đối > giá trị ổn định) vì tắt dần < 1; `spineRoll` không vọt quá 10 %.
  - `độc lập tốc độ khung`: 600 bước dt 1/60 so với 200 bước dt 1/20, cùng chuỗi tín hiệu → mọi trường lệch < 0,02.
  - `đầu vào xấu`: dt ∈ {0, −1, NaN, 30}, tín hiệu ±1e6 / NaN → mọi trường hữu hạn và trong `limits`; `brake*` ∈ [0, 1].
  - `plSignals`: lần đầu (`has = false`) → `acc = vy = 0`; bay thẳng tăng tốc 30 m/s² → `acc ≈ 1`; nhảy vị trí 500 m trong một khung → `acc`, `vy` vẫn trong [−1, 1]; `turnInput` có giá trị thì `turn` trộn về phía nó.
  - `gió`: `wind = 1` làm phương sai `swingRoll` (bay thẳng 60 s) lớn hơn `wind = 0` ít nhất 2 lần; hai `seed` khác nhau cho chuỗi khác nhau.
- [x] **Step 2:** Viết `tests/pilot-unit/ik.test.ts`: đích trong tầm → `|end − t| < 1e-3`, `|elbow − a| = l1`, `|end − elbow| = l2` (±1e-4), khuỷu nằm phía cực `p`; đích xa gấp 3 tầm → trả `false`, `end` cách `a` đúng `(l1 + l2) × 0.999`, thẳng hàng với `t`; đích trùng gốc và cực song song hướng đích → không NaN.
- [x] **Step 3:** Chạy `npx tsx --test tests/pilot-unit/react.test.ts tests/pilot-unit/ik.test.ts` → FAIL.
- [x] **Step 4:** Thêm `CONFIG.explore.pilot`, viết `ik.ts`, `react.ts`. Lò xo: bậc hai, tích phân bán ẩn (ổn định mọi dt sau khi chia bước ≤ `dtMax / 4`), `PlReact` giữ mảng trạng thái `Float64Array`. `PlReact` nhận tùy chọn dựng `{ gust?: number }` cho test. Dấu: xem hệ cục bộ ở Global Constraints; `swingRoll > 0` nghĩa là quay quanh +X theo quy tắc bàn tay phải (ghi rõ trong comment đầu file từng trường dương là hướng nào).
- [x] **Step 5:** Test → PASS; `npm run typecheck` sạch.

### Task 3: Trang bị `gear.ts` + tách hình học `glider.ts`

**Files:**
- Create: `src/explore/pilot/gear.ts`, `tests/pilot-unit/gear.test.ts`
- Modify: `src/explore/glider.ts`

**Interfaces:**
- Consumes: `CONFIG.explore.pilot` (Task 2), `CONFIG.explore.glider`.
- Produces:
```ts
// glider.ts
export function exGliderGeometry(kind: 'full' | 'canopy'): THREE.BufferGeometry;   // dùng chung, dựng một lần mỗi loại; 'full' y như hình cũ (cùng số đỉnh)
export function exLineTops(): { x: number; y: number; z: number; side: -1 | 1 }[];  // điểm bám dây trên cánh, hệ group dù (đã cộng originAt)
export function exBrakeTops(): { x: number; y: number; z: number; side: -1 | 1 }[]; // 2–3 điểm mỗi bên trên mép sau cánh cho dây phanh
export const exHangY: number;                                                       // y của điểm treo trong hệ group dù (= −lines × (1 − originAt))
// exPlaceGlider(g, s, dt = 0, inp?) — chữ ký mới; Task 4 nối plUpdate, Task 3 chỉ thêm tham số
// gear.ts
export const PL_GEAR_BONES = ['wing', 'hang', 'pelvis', 'spine', 'handL', 'handR', 'thighL', 'thighR', 'pack'] as const;
export interface PlGearRest { hang: number[]; pelvis: number[]; spine: number[]; handL: number[]; handR: number[]; thighL: number[]; thighR: number[] }   // vị trí nghỉ từng xương trong hệ group dù, m
export function plGearGeometry(rest: PlGearRest): THREE.BufferGeometry;   // position, normal, color, skinIndex (1 xương / đỉnh, trọng số 1; dây: mỗi đầu một xương), skinWeight
export function plGearMaterial(): THREE.MeshStandardMaterial;             // vertexColors, dùng chung
```
- Hình học thuần `BufferGeometry` (không cần DOM) để test chạy bằng node.

- [x] **Step 1:** Viết `tests/pilot-unit/gear.test.ts`: với `rest` mẫu (điểm treo `[0, exHangY, 0]`, hông thấp hơn 0,42 m…): số tam giác ≤ 6 000; mọi `skinIndex` ∈ [0, `PL_GEAR_BONES.length`); tổng `skinWeight` mỗi đỉnh = 1; có đỉnh gắn `wing` **và** đỉnh gắn `hang` (dây treo), có đỉnh gắn `handL` và `handR` (quai phanh); số đỉnh gắn `wing` có vị trí trùng một điểm trong `exLineTops()` ∪ `exBrakeTops()` (±0,05 m) ≥ `2 × lineCount`; không NaN; hộp bao theo Z đối xứng (±1 cm). `exGliderGeometry('canopy')`: không có đỉnh nào thấp hơn `exHangY + 1` m; `exGliderGeometry('full')`: số đỉnh > canopy và hộp bao chạm tới dưới `exHangY`.
- [x] **Step 2:** Chạy → FAIL.
- [x] **Step 3:** Sửa `glider.ts`: tách phần cánh (3 dải) thành `canopy`; `full` = canopy + `exHuman` + dây như cũ (thứ tự gộp giữ nguyên để hình tạm không đổi). `exBuildGlider` vẫn dùng `full`. Thêm `exLineTops`, `exBrakeTops`, `exHangY`, tham số `dt`, `inp` cho `exPlaceGlider` (chưa dùng).
- [x] **Step 4:** Viết `gear.ts` theo spec §6: tấm ngồi + má hông + tấm lưng (pelvis / spine), ba lô + hộp dù dự phòng + quai đỏ (xương `pack`), đai vai ×2, đai ngực + khóa, đai đùi ×2 + khóa (thighL / thighR / pelvis), carabiner ×2 + riser ×2 (đáy `pelvis`… đỉnh `hang`), quai phanh ×2 (handL / handR), dây phanh (đáy hand, đỉnh `wing`, tụ 2–3 nhánh), dây treo `lineCount` mỗi bên (đáy `hang` tại đầu riser, đỉnh `wing`). Dây = lăng trụ 4 cạnh bán kính `gear.lineR`. Đai nổi cách thân 1,5 cm.
- [x] **Step 5:** Test → PASS; `npm run typecheck`; `npm run test:multi:unit` (dùng `glider.ts` gián tiếp? nếu không thì bỏ) vẫn đạt.

### Task 4: Nạp, xương, rig, điều phối, nối vào chế độ bay; chỉnh bằng ảnh

**Files:**
- Create: `src/explore/pilot/load.ts`, `bones.ts`, `rig.ts`, `index.ts`, `tests/pilot-unit/index.test.ts`, `tests/pilot-shots.mjs` (chụp ảnh, không phải test chấm điểm)
- Modify: `src/explore/glider.ts` (`exPlaceGlider` gọi `plUpdate`), `src/explore/index.ts` (preload ở thẻ Dù lượn / `start` / `startWatching`; truyền `dt`, `inp`; `plSetWarm` giống `stRigSetWarm` trong `stroll/index.ts`), `src/explore/multi/remote.ts` (truyền `dt`, tôn trọng `pilot.remote` + bậc điện thoại), `package.json` đã có script (người điều phối thêm).
- Đọc mẫu: `src/explore/stroll/rig.ts`, `avatars.ts`, `stroll/index.ts` (làm nóng), `tests/stroll-unit/avatars.test.ts` (bộ nạp giả).

**Interfaces:**
- Consumes: Task 1 (`pilot.glb`, tên xương, `sit`, `extras.hip`), Task 2 (`PlReact`, `plSignals`, `plTwoBone`), Task 3 (`exGliderGeometry`, `exLineTops`, `exBrakeTops`, `exHangY`, `plGearGeometry`, `plGearMaterial`).
- Produces:
```ts
// index.ts
export function plPreload(): void;
export function plUpdate(glider: THREE.Group, s: GliderState, dt: number, turnInput?: number): void;   // gắn rig nếu nguồn đã có và dù đang hiện; cập nhật tư thế
export function plReset(glider: THREE.Group): void;     // dù nhảy vị trí / đổi chủ: đặt lại lò xo + sai phân
export function plDetach(glider: THREE.Group): void;    // trả hình full, dispose rig
export function plSetWarm(fn: ((o: THREE.Object3D) => Promise<unknown>) | null): void;
export function plDebug(glider: THREE.Group): { real: boolean; handErr: [number, number]; pose: PlPose; calls: number } | null;   // handErr: m, khoảng cách xương bàn tay ↔ quai phanh
export function __plSetLoader(fn: (() => Promise<PlSource | null>) | null): void;   // chỉ cho unit test
```
- `?pilot=off` → `plPreload` / `plUpdate` không làm gì.
- `window.__app.explore.pilotDebug()` = `plDebug(glider của mình)` (thêm vào object `explore`).

- [x] **Step 1:** `tests/pilot-unit/index.test.ts` với bộ nạp giả (cảnh giả có đủ xương bắt buộc + một `SkinnedMesh` nhỏ + clip `sit` rỗng): trước khi nạp xong → hình `full`, không có `ex-pilot`; sau khi nạp → mesh cánh dùng `canopy`, có `ex-pilot`, `plDebug().real`; bộ nạp trả `null` → giữ `full` mãi, chỉ gọi bộ nạp một lần; dù `visible = false` lúc nguồn về → không gắn (Review Focus 1); `plUpdate` với dt NaN / 30 → mọi quaternion xương hữu hạn; `plDetach` → trở lại `full`, không còn `ex-pilot`; 5 dù cùng lúc dùng chung nguồn, mỗi dù skeleton riêng.
- [x] **Step 2:** Viết `load.ts` (mẫu `stRigLoad`: lớp 1, không bóng, `frustumCulled = false`, giữ `normalMap` / `roughnessMap` của glb, `Promise.race` với `loadMs`), `bones.ts` (tra xương, lưu quaternion nghỉ; `plApplyPose(bones, pose, cfg)` cộng góc sau `mixer.update`; IK tay bằng `plTwoBone` trong hệ group dù rồi đổi ra quaternion cục bộ của UpperArm / Forearm; cổ tay + ngón nắm), `rig.ts` (`PlRig`: clone, mixer `sit`, `PlReact`, gear `SkinnedMesh` với `Skeleton` dựng từ [wing, hang, Pelvis, Spine2, L Hand, R Hand, L Thigh, R Thigh, pack] và `boneInverses` từ `PlGearRest` đo ở **tư thế bay nền** sau khi áp `base` + một lần `mixer.update(0)`), `index.ts`.
- [x] **Step 3:** Nối vào `glider.ts`, `explore/index.ts`, `remote.ts`. `npm run typecheck`, `npx tsx --test tests/pilot-unit/*.test.ts` → PASS.
- [x] **Step 4:** `tests/pilot-shots.mjs`: mở `dist/` qua máy chủ tĩnh như các `*-check.mjs`, `?test&explore=glider`, đặt camera thủ công quanh người treo (sau 4 m, ngang trái 3 m, trước 3,5 m, camera bám mặc định, cận tay 1,2 m), ở 5 trạng thái (thẳng; giữ rẽ trái 3 s; rẽ phải; E 2 s; Q 2 s), ngày; thêm đêm + mưa bão cho góc sau. Ghi `tests/screens/pilot-<trạng thái>-<góc>.png` (1280×720). In `pilotDebug()` mỗi trạng thái.
- [x] **Step 5:** `npm run build && node tests/pilot-shots.mjs`; **xem ảnh** (Read), sửa `CONFIG.explore.pilot` / `bones.ts` / `gear.ts` tới khi: tư thế ngồi treo tự nhiên (lưng ngả nhẹ, đùi hơi chúc, gối gập nhẹ), tay nắm quai (`handErr` ≤ 0,03), đai ôm người không xuyên rõ, dây tụ đúng vào riser, rẽ thấy người lắc ra ngoài + thân nghiêng vào + tay bên rẽ kéo xuống. Tối đa 6 vòng build–chụp; còn lỗi thì ghi rõ kèm ảnh.
- [x] **Step 6:** Báo danh sách file, số đo `pilotDebug`, đường dẫn ảnh, điều còn xấu.

### Task 5: Test trình duyệt, tài liệu, chạy kiểm cuối

**Files:**
- Modify: `tests/explore-check.mjs` (mục mới "7 — người treo có xương"), `.github/copilot-instructions.md` (§3.5 danh sách tài sản, §5 lệnh `test:pilot:unit`, `gen:pilot`), `README.md` (nguồn + giấy phép, cấu trúc `src/explore/pilot/`), `.github/memory-bank/{activeContext,progress,decisions,systemPatterns}.md` (D-035), `tests/KET-QUA.md`, spec + plan (trạng thái).

- [x] **Step 1:** Mục 7 trong `explore-check.mjs`: (7a) `?explore=glider`: chờ `pilotDebug().real` ≤ 30 s; hình cánh không còn đỉnh dưới điểm treo; (7b) 5 trạng thái: `handErr` ≤ 0,03; rẽ trái: `swingRoll` và `spineRoll` trái dấu, `brakeL > brakeR`; (7c) lệnh vẽ có dù − ẩn dù ≤ 4; (7d) `?explore=glider&pilot=off`: `real = false`, chênh lệnh vẽ 1; (7e) chặn `**/pilot.glb` (route abort): hình khối, đúng một `console.warn`, không `pageerror`; (7f) đêm + preset bão: 30 khung không lỗi console, `real` vẫn true.
- [ ] **Step 2:** _(2026-11-13: đã chạy `build`, mọi `test:*:unit`, `test:explore` đạt 89/89 tại `e059626` và lại tại `227527d`; `test:multi` tại `227527d` đạt tới 7a rồi đứng ở 7b, dừng tay; `test:perf -- --strict`, `test:drawcalls` chưa chạy theo lời người dùng, chạy một lần sau)_ Chạy **một lần**: `npm run build`, mọi `test:*:unit`, `test:multi:worker` không cần (không đổi máy chủ), `npm run test:explore`, `npm run test:perf -- --strict`, `npm run test:drawcalls` (góc cũ +0), `npm run test:multi` nếu máy còn sức. Ghi kết quả thật vào `tests/KET-QUA.md` và memory bank, kể cả lỗi / chưa chạy.
- [x] **Step 3:** Cập nhật tài liệu, ghi D-035 vào `decisions.md`.

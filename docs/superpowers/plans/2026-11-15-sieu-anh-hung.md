# Siêu anh hùng nguyên bản ở Đi dạo + Xe máy (D-048): kế hoạch thực hiện

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Mục tiêu:** Nhân vật nam / nữ của Đi dạo và Xe máy (mình và người khác) thành hai siêu anh hùng nguyên bản: nam "Dây Cầu Phát Sáng", nữ "Sóng Biển Đà Nẵng".

**Kiến trúc:**
- Hai GLB mới `public/people/hero-m.glb` / `hero-f.glb` sinh bằng `scripts/people/hero.py` (Blender 4.5). Script nạp `convert.py` để dùng lại toàn bộ đường chuyển đổi Rocketbox, xóa mảnh alpha (tóc / mi), sơn bộ đồ bằng numpy trong không gian UV từ vị trí / pháp tuyến / vùng xương ở tư thế gốc.
- Mã chạy chỉ đổi `CONFIG.stroll.anim.chars` → `[5, 6]`. Mọi đường dẫn (`stCharModel` → `stRigLoad`) tự theo, nên Đi dạo, Xe máy, người khác, nạp trước ở sảnh đều đổi.
- Thêm: phát sáng ban đêm cho bộ nam (vá `onBeforeCompile` đọc `shared.uNight`) và cờ ẩn mũ bảo hiểm.

**Công nghệ:** Blender 4.5 (Python, numpy, glTF exporter), three@0.165, TypeScript, `node --test` (tsx), Playwright (ảnh xem trước).

**Spec:** `docs/superpowers/specs/2026-11-15-sieu-anh-hung-design.md`

## Ràng buộc chung

- Không đổi `src/explore/multi/protocol.ts`, `session.ts`, `server/multi/*`, `exCharNorm`, `stChar`, `pilot/*`, `drive/*`, `common/people/*`. Không deploy Worker.
- Không sửa đầu ra `public/people/p0..p4.glb`, không sửa hành vi `convert.py` khi chạy trực tiếp.
- `hero-*.glb`:
  - mỗi tệp ≤ 1,5 MB;
  - tam giác ≤ tam giác nguồn;
  - đúng 2 primitive, mọi vật liệu `OPAQUE`;
  - 1 skin ≥ 50 khớp, đủ xương `Bip01 Pelvis / L Foot / R Foot / Head / L Hand / R Hand / LEye / REye`;
  - năm đoạn `idle walk jog sprint photo` có `extras.speed`, có `height` 1,5–1,95;
  - `hero-m` có `emissiveTexture`, `hero-f` không có;
  - không Draco / Meshopt.
- Danh sách phản mục tiêu (spec §3, §10.4):
  - không lưới mạng nhện, không hình nhện, không hai mắt trắng lớn viền đen;
  - nam: mặt nạ / găng / ủng xanh, đỏ chỉ ở tấm ngực hình thang và mặt trước đùi;
  - tên không chứa "nhện" / "spider" / "Marvel".
- Mọi thông số mới ở `src/config.ts`, chú thích tiếng Việt + đơn vị + `(ước lượng)`.
- Không thêm khóa i18n; chỉ đổi chữ khóa `stChar` ở đủ 9 ngôn ngữ.
- Test nặng (SwiftShader) không chạy theo lời người dùng ("gửi demo cuối để review, không cần chạy lại test nặng", 2026-11-15). Chỉ chạy `typecheck`, `build`, test đơn vị liên quan và xem bằng mắt trên GPU thật.

## Điểm review cần chú ý

1. **Đổi Nam ↔ Nữ ở sảnh khi mô hình kia chưa nạp:** slot đổi mô hình phải gỡ bản sao cũ và hiện hình khối, không giữ nhân vật cũ. Đã có ở `stPlace`; test đơn vị hiện có phải vẫn qua với số mô hình 5 / 6 (Task 2).
2. **Bản sao nhiều người dùng chung vật liệu đã vá:** vá phát sáng phải làm một lần trên nguồn (`stRigSource`), không làm theo bản sao. Program giữ một khóa. Test kiểm `customProgramCacheKey` cố định và chỉ vá vật liệu có `emissiveMap` (Task 2).
3. **Ban ngày bộ nam không được sáng:** hệ số `clamp(uNight)` = 0 thì phát sáng = 0. Kiểm bằng xem ảnh ngày / đêm (Task 4).
4. **Góc nhìn thứ nhất xe máy:** thu xương đầu không được để lộ lỗ ở cổ áo. Mặt nạ không có tóc nên không có mảnh lơ lửng. Xem ảnh (Task 4).
5. **Tệp anh hùng không tải được:** Đi dạo hiện hình khối, xe máy chạy không người, chỉ một cảnh báo console. Đường lùi cũ giữ nguyên; kiểm bằng bộ nạp giả trả `null` trong `avatars.test.ts` (đã có) và chặn tệp khi xem demo (Task 4).

---

### Task 1: `gen:hero`: sinh `hero-m.glb` / `hero-f.glb` + test tệp

**Tệp:**
- Tạo: `scripts/people/hero.py`
- Sửa: `package.json` (thêm `"gen:hero": "node scripts/people/blender.mjs scripts/people/hero.py"`), `public/people/LICENSE-Rocketbox.txt` (thêm dòng về `hero-*.glb`, ghi từ `hero.py`), `README.md` (mục ghi nguồn tài nguyên + lệnh `gen:hero`)
- Test: `tests/stroll-unit/glb.test.ts`

**Giao diện:**
- Tạo ra: `public/people/hero-m.glb` (nguồn `Male_Adult_10`, nhân vật convert số 0), `public/people/hero-f.glb` (nguồn `Female_Adult_03`, nhân vật convert số 3). Hướng, đơn vị, gốc tọa độ như `p0` / `p3`. Ảnh kiểm tra ở `scripts/people/.cache/preview-hero/hero-{m,f}-{front,back,side,q}.png` và `hero-m-night.png`.

- [ ] **Bước 1: Viết test hỏng** trong `glb.test.ts`: `for (const f of ['hero-m', 'hero-f'])`, test tên `` `${f}.glb: anh hùng — 5 đoạn, speed như nguồn, 2 primitive, OPAQUE, xương đủ` ``. Các assert:
  - tồn tại, ≤ 1,5 MB;
  - tên năm đoạn như `p0`;
  - `|speed - speed của p0 (nam) / p3 (nữ)| ≤ 0.01`;
  - `j.meshes` tổng primitive = 2;
  - mọi `materials[i].alphaMode ?? 'OPAQUE'` là `'OPAQUE'`;
  - 1 skin ≥ 50 khớp;
  - đủ tám xương nêu ở Ràng buộc chung (tên trong node có thể là `Bip01 LEye` hoặc `Bip01_LEye`);
  - `height` trong (1,5; 1,95);
  - `hero-m`: có ít nhất một vật liệu `emissiveTexture`; `hero-f`: không có;
  - không Draco / Meshopt;
  - `scenes[0].extras.source` chứa `hero.py`.
- [ ] **Bước 2:** `npx tsx --test tests/stroll-unit/glb.test.ts` → FAIL (thiếu tệp).
- [ ] **Bước 3: Viết `hero.py`.** Nạp `convert.py` như `crowd.py` (thêm `HERE` vào `sys.path`, `import convert`). Không truyền tham số sau `--` để `convert.ONLY` không bị ảnh hưởng.
  - Đặt `convert.OUT` = `.cache/hero-out`. Bọc `convert.fix_materials` bằng `hero_materials(log)`: gọi bản gốc, rồi:
    - (a) xóa mọi mặt có vật liệu alpha (vật liệu nối vào ổ `Alpha`) và gỡ slot đó;
    - (b) sơn texture thân (1024) / đầu (512) mới bằng hàm `paint(kind, role, P, N, R)`;
    - (c) với nam, tạo ảnh phát sáng cùng cỡ, nối vào ổ `Emission Color` (strength 1).
  - Gọi `convert.convert(0)`, `convert.convert(3)` sau khi đặt biến toàn cục `KIND` = `'m'` / `'f'`. Chuyển `p0.glb` → `public/people/hero-m.glb`, `p3.glb` → `hero-f.glb`. `glb_patch` ghi `extras.source = 'Microsoft Rocketbox <tên> (MIT), commit <7 ký tự>; bộ đồ siêu anh hùng nguyên bản — scripts/people/hero.py'`.
  - **Tô UV:**
    - Mỗi tam giác (`loop_triangles`) của từng vật liệu, UV lấy từ lớp `active_render`. Nội suy barycentric vị trí thế giới (tư thế gốc), pháp tuyến đỉnh, trọng số one-hot của 5 vùng.
    - Vùng xương lấy từ nhóm đỉnh nặng nhất: `head` = xương đầu + con; `arm` = Clavicle / UpperArm / Forearm; `hand` = Hand + Finger; `leg` = Thigh / Calf / Foot / Toe; `torso` = còn lại. Vùng của điểm ảnh = argmax.
    - Nở 12 px vào vùng trống (dịch numpy 4 hướng, lặp lại).
  - **Mốc giải phẫu** (đọc `head_local` của xương ở tư thế gốc, hệ Blender: mặt nhìn −Y): cao độ cổ, ngực (`Spine2`), hông (`Pelvis`), gối (`Calf`), mắt (`LEye` / `REye`), tâm đầu.
  - **Thiết kế** (màu là sRGB đã chọn trong spec §3; số đo là ước lượng, chỉnh khi xem ảnh):
    - Nam "Dây Cầu Phát Sáng":
      - nền `#2453a6`; găng, ủng (dưới giữa cẳng chân), đai lưng 4 cm `#16306b`;
      - tấm ngực đỏ `#b8262e` hình thang, chỉ mặt trước, từ dưới cổ 4 cm xuống ngực −12 cm, rộng 34 → 22 cm;
      - mặt trước đùi đỏ (pháp tuyến hướng trước > 0,4, giữa hông − 5 cm và gối + 8 cm);
      - 7 tia `#7fe3ff` dày 7 mm, chiếu (x, z), từ điểm cổ xòe tới đường hông với khoảng cách đều 9 cm, cả trước lẫn sau thân;
      - biểu tượng hình thoi `#7fe3ff` rộng 10 cm, cao 14 cm giữa ngực, viền `#0d1d45`;
      - đường viền tối 4 mm quanh mảng đỏ;
      - đường chỉ dọc cạnh ngoài chân `#7fe3ff` 6 mm;
      - mặt nạ `#2453a6`, kính chữ T `#7fe3ff` (ngang 15 cm × 3,6 cm ở cao độ mắt, sống dọc 2,2 cm × 7 cm xuống mũi), viền kính `#0d1d45`.
      - Phát sáng = tia + biểu tượng + chỉ chân + kính, các chỗ khác đen.
    - Nữ "Sóng Biển Đà Nẵng":
      - nền `#1b2f6b`;
      - hai dải đỏ `#c62f2f` rộng 5 cm, đường tâm đi từ vai (x = ±0,16, cao độ cổ − 3 cm) tới hông đối diện (x = ∓0,12, cao độ hông + 6 cm), cộng sóng sin biên độ 1,5 cm, bước 12 cm, viền `#f4f1e8` 6 mm, trước lẫn sau;
      - biểu tượng tại chỗ hai dải cắt: tròn bán kính 4,5 cm, nền nền, vòng `#f4f1e8` 6 mm, ba đường sóng `#f4f1e8`;
      - vòng cổ tay đỏ 3 cm; găng nền; ủng nền với viền `#f4f1e8`;
      - mặt nạ nền, hai kính `#f2a12a` góc cạnh (hình thang lệch: cạnh trong cao 2,6 cm, cạnh ngoài 1,4 cm, rộng 4,2 cm, tâm cách giữa ± 3,4 cm, ở cao độ mắt), chỉ trắng ngà 4 mm giữa đỉnh đầu.
    - Cả hai: vân vải nhân `1 ± 0,03` (băm theo vị trí 5 mm, `rng` cố định để tất định). AO: chỉ thêm khi ảnh xem trước trông phẳng; nếu thêm thì nướng Cycles AO 32 mẫu, nhân `mix(1, ao, 0,5)`.
  - **Ảnh kiểm tra:** sau khi xuất, nạp lại GLB vào cảnh mới. Đoạn `idle` khung 0. Eevee 600 × 900, nền xám, đèn mặt trời. Bốn góc: trước, sau, nghiêng phải, 3/4. Riêng nam thêm một ảnh trời tối (đèn 0,05) để thấy phát sáng.
  - **In bảng:** byte, tam giác (trước / sau), primitive, vật liệu, cỡ ảnh, `height`, điểm thấp nhất (phải trong ±0,02 m quanh 0).
- [ ] **Bước 4:** `npm run gen:hero` (≈ 3–6 phút) rồi xem ảnh kiểm tra. Đối chiếu danh sách phản mục tiêu; chỉnh thiết kế, chạy lại tới khi đạt.
- [ ] **Bước 5:** `npx tsx --test tests/stroll-unit/glb.test.ts` → PASS (cả test `p0..p4` cũ).
- [ ] **Bước 6:** Thêm dòng ở `LICENSE-Rocketbox.txt` (do `hero.py` ghi nối, tất định) + README (mục tài nguyên và lệnh `gen:hero`).
- [ ] **Bước 7: Commit**
```bash
git add scripts/people/hero.py package.json public/people/hero-m.glb public/people/hero-f.glb public/people/LICENSE-Rocketbox.txt README.md tests/stroll-unit/glb.test.ts
git commit -m "feat(hero): gen:hero sinh hai siêu anh hùng nguyên bản từ Rocketbox (D-048)"
```

### Task 2: Nối vào mã chạy: chọn mô hình, phát sáng đêm, ẩn mũ

**Tệp:**
- Sửa: `src/config.ts` (`stroll.anim.models` thêm `'people/hero-m.glb'`, `'people/hero-f.glb'`; `chars: [5, 6]`; khối mới `stroll.hero: { glow: 1.6 }`; `bike.rider.helmet.show: false`)
- Sửa: `src/explore/stroll/rig.ts` (`stRigSource` vá vật liệu có `emissiveMap`)
- Sửa: `src/explore/bike/rider.ts` (`helmet.visible = RC.helmet.show`)
- Sửa: chú thích đầu `src/explore/stroll/anim.ts`, `avatars.ts`, `bike/rider.ts`, `bike/index.ts`, `multi/remoteDrive.ts` nếu ghi "p0 / p3"
- Sửa: `src/i18n/locales/{vi,en,ko,ja,zh,th,ar,hi,ru}.json` khóa `stChar` → "Siêu anh hùng" / "Superhero" / "슈퍼히어로" / "スーパーヒーロー" / "超级英雄" / "ซูเปอร์ฮีโร่" / "بطل خارق" / "सुपरहीरो" / "Супергерой"
- Test: `tests/stroll-unit/anim.test.ts`, `tests/stroll-unit/avatars.test.ts`, `tests/bike-unit/rider.test.ts`

**Giao diện:**
- Dùng từ Task 1: hai tệp GLB.
- Tạo ra: `stRigGlow(mat: THREE.MeshStandardMaterial): void`, export từ `rig.ts`. Hàm vá phát sáng × `clamp(uNight, 0, 1) × CONFIG.stroll.hero.glow`, đặt `customProgramCacheKey = () => 'stHeroGlow'`. `stRigSource` gọi nó cho mọi vật liệu có `emissiveMap`.

- [ ] **Bước 1: Viết test hỏng:**
  - `anim.test.ts`: `stCharModel(0) === 5`, `stCharModel(1) === 6`, `stCharModel(7) === 5`; `CONFIG.stroll.anim.models[5]` / `[6]` là `'people/hero-m.glb'` / `'people/hero-f.glb'`.
  - `rider.test.ts`: `new BkRider(src).helmet.visible === CONFIG.bike.rider.helmet.show`.
  - Test mới trong `anim.test.ts` hoặc test riêng của rig: `stRigSource` với cảnh giả có hai `MeshStandardMaterial` (một có `emissiveMap`) → chỉ vật liệu có map có `onBeforeCompile` khác mặc định và `customProgramCacheKey()` = `'stHeroGlow'`. Gọi `onBeforeCompile` với shader giả (chuỗi có `#include <emissivemap_fragment>`) → `fragmentShader` chứa `uNight` và `uniforms.uNight === shared.uNight`.
- [ ] **Bước 2:** `npm run test:stroll:unit` và `npm run test:bike:unit` → các test mới FAIL.
- [ ] **Bước 3: Sửa** theo danh sách tệp. `stRigGlow` làm như `bike/model.ts` (thay `#include <emissivemap_fragment>` bằng chính nó + `totalEmissiveRadiance *= clamp(uNight, 0.0, 1.0) * <glow>;`). Đặt `emissive` = trắng để texture quyết định màu. `shared` import từ module đang chứa `uNight` (xem `bike/model.ts`).
- [ ] **Bước 4:** `npm run typecheck`; `npm run test:stroll:unit` (≥ 93 + mới); `npm run test:bike:unit` (109 + mới); `npm run test:multi:unit` (153, không đổi) → PASS. Chỗ nào ghi cứng số mô hình 0 / 3 (ví dụ `rider.test.ts` dựng xương từ `p0.glb`) thì đổi sang `hero-m.glb` chỉ khi test đó nói về "nhân vật đang dùng". Test về tệp `p0` giữ.
- [ ] **Bước 5: Commit**
```bash
git add src tests
git commit -m "feat(hero): Đi dạo + xe máy dùng hai siêu anh hùng; phát sáng đêm, ẩn mũ (D-048)"
```

### Task 3: Ảnh xem trước ở sảnh

**Tệp:**
- Sửa: `scripts/people/thumbs.mjs` (`CHARS` = `[['thumb-m', 'people/hero-m.glb'], ['thumb-f', 'people/hero-f.glb']]`, nạp theo đường dẫn; chú thích ghi phải khớp `CONFIG.stroll.anim.chars` / `models`)
- Sửa: `public/people/thumb-m.webp`, `thumb-f.webp` (sinh lại)
- Test: `tests/stroll-unit/glb.test.ts` (test ảnh xem trước đã có: WebP, ≤ 20 kB; thêm assert `thumbs.mjs` chứa `hero-m.glb` và `hero-f.glb`)

- [ ] **Bước 1:** thêm assert về nội dung `thumbs.mjs` → FAIL.
- [ ] **Bước 2:** sửa `thumbs.mjs`, chạy `npm run gen:thumbs`, xem hai ảnh.
- [ ] **Bước 3:** `npx tsx --test tests/stroll-unit/glb.test.ts` → PASS.
- [ ] **Bước 4: Commit** `feat(hero): ảnh xem trước sảnh là hai siêu anh hùng (D-048)`.

### Task 4: Demo, xem bằng mắt, tài liệu

**Tệp:**
- Sửa: `.github/memory-bank/activeContext.md`, `progress.md`, `decisions.md` (D-048), `.github/copilot-instructions.md` (§3 mục 5 tài nguyên: thêm `hero-*.glb`; §5 thêm `gen:hero`), trạng thái spec / plan.

- [ ] **Bước 1:** `npm run build` → đạt; ghi cỡ chunk.
- [ ] **Bước 2:** Script tạm của agent (Playwright, GPU thật, đọc `dist/`, không commit). Chụp:
  - `?test&explore=stroll` nam và nữ (đặt `localStorage.stChar`): đứng, đi, chạy, góc 3/4 trước;
  - ban đêm (bộ nam sáng, ban ngày không sáng);
  - `?test&explore=bike` góc thứ ba nam / nữ: thẳng và nghiêng hết; góc thứ nhất;
  - sảnh có ô chọn nhân vật.

  Đọc và ghi: `stAvatars.debug(0)` (`model` 5 / 6, `real`), `bike.rider.debug()` (tay ≤ 0,03 m, chân ≤ 0,03 m), console sạch. Chặn `hero-*.glb` một lượt: hình khối / xe không người, một cảnh báo.
- [ ] **Bước 3:** Chạy `npm run dev` cho người dùng xem demo; ghi URL.
- [ ] **Bước 4:** Cập nhật tài liệu AI: chỉ ghi điều có thật, test nào đã / chưa chạy. Commit `docs(hero): D-048 vào memory bank, trạng thái spec / plan`.

## Không chạy (theo lời người dùng)

`test:stroll`, `test:bike`, `test:char`, `test:mobile`, `test:multi`, `test:drawcalls`, `test:perf -- --strict`. Ghi rõ trong memory bank là chưa chạy.

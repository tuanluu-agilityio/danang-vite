# PROMPT: Làm hai bờ sông Hàn giống thật, tòa nhà chiếu trái tim "DN", bảng quảng cáo

> Dán toàn bộ file này cho agent lập trình (Claude Code) đang mở thư mục `danang-vite`.

---

## 0. Vai trò và mục tiêu

Bạn là kỹ sư đồ hoạ Three.js. Dự án `danang-vite` (Vite + TypeScript + three@0.165, không dùng framework UI) đang dựng 4 cầu và Hầm vượt sông Hàn. Đọc kỹ [README.md](../README.md) trước khi làm.

Hiện nay hai bờ sông còn đơn giản: hộp đất, kè đá và dải lát gạch ([src/environment/river.ts](../src/environment/river.ts)); nhà là các hộp sinh ngẫu nhiên có shader cửa sổ ([src/environment/city.ts](../src/environment/city.ts), `patchWindows` trong [src/common/shaders.ts](../src/common/shaders.ts)); cây và đèn đường ([src/environment/trees.ts](../src/environment/trees.ts)).

**Nhiệm vụ:** làm hai bờ sông Hàn **gần với cảnh thật nhất có thể**, gồm:
1. Dựng lại các **địa danh có thật** ven sông (mục 1).
2. Chọn **một tòa cao tầng mỗi bờ** để chiếu LED **hình trái tim và chữ "DN"**: **Novotel Danang Premier Han River** (bờ Tây) và **Vinpearl Condotel Riverfront** (bờ Đông) (mục 2).
3. Thêm **bảng quảng cáo** như phố thật, dùng **thương hiệu hư cấu** xen **thông điệp du lịch của thành phố** (mục 3).
4. Thêm chi tiết đời thường trên bờ: lan can, ghế, bồn hoa, bến du thuyền, cửa hàng tầng trệt (mục 4).

**Không làm hỏng những gì đang có:** 4 cầu, hầm, vị trí nhà/cây/xe (chuỗi ngẫu nhiên có seed), draw call của các góc nhìn cũ, và các test hiện tại.

Thứ tự ưu tiên khi thiếu thời gian: **P1** địa danh + mặt dựng trái tim → **P2** quảng cáo → **P3** chi tiết bờ.

---

## 1. Địa danh có thật (xác minh vị trí trước khi dựng)

### 1.1 Quy đổi toạ độ
Quy ước trục (xem đầu [src/config.ts](../src/config.ts)): đơn vị mét. X chạy Tây → Đông, Z dọc sông, −Z là phía Bắc. Mặt nước y = 0, mặt đất `landY = 2.5`, mặt đường `roadY = 2.6`.

| Mốc trong cảnh | Toạ độ |
|---|---|
| Cầu Rồng | z = 0 |
| Cầu sông Hàn | z = −1080 |
| Cầu Trần Thị Lý | z = +1300 |
| Cầu Thuận Phước | z = −2900 |
| Tim Hầm sông Hàn | z = −1700 (hành lang tuyến \|z + 1700\| < 30 m, không đặt gì lên đó) |
| Mép kè | \|x\| = 262 |
| Đường Bạch Đằng / Trần Hưng Đạo | x = −299 / x = +299 |
| Hàng nhà đầu tiên ven sông | từ \|x\| ≈ 330 |

Cách quy đổi: z = khoảng cách dọc sông tính từ Cầu Rồng (về phía Bắc là âm), x = khoảng cách vuông góc tới tim sông. **Tra Google Maps hoặc nguồn chính thức để xác minh từng vị trí và số tầng.** Các số dưới đây là ước lượng ban đầu; số cuối cùng ghi vào config kèm `(ước lượng)` nếu không có nguồn.

### 1.2 Danh sách địa danh

| Bờ | Công trình | Gợi ý vị trí và hình khối (ước lượng) |
|---|---|---|
| Tây | **Novotel Danang Premier Han River** (36 Bạch Đằng) | ≈ x −345, z −1150, sát phía Bắc chân Cầu sông Hàn. Khoảng 37 tầng, ~150 m. Tháp kính xanh xám, mặt chính nhìn ra sông. **Tòa chiếu trái tim bờ Tây.** |
| Tây | Trung tâm Hành chính Đà Nẵng (24 Trần Phú) | ≈ x −470, z −1230. Cao 166 m, 34 tầng, dáng "bắp ngô": thân trụ thuôn, các lớp lam kính. Là điểm nhấn cao nhất bờ Tây. |
| Tây | Chợ Hàn | ≈ x −330 đến −400, z ≈ −500. Thấp tầng (2–3 tầng), mái phẳng, mặt tiền có chữ "CHỢ HÀN". |
| Tây | Bảo tàng Điêu khắc Chăm | Sát phía Nam chân Tây Cầu Rồng. 1–2 tầng, tường màu vàng đất, mái ngói. |
| Đông | **Vinpearl Condotel Riverfront** (Trần Hưng Đạo) | Vị trí và số tầng **cần xác minh** (khoảng 35–40 tầng). Tháp cao tầng nhìn thẳng ra sông. **Tòa chiếu trái tim bờ Đông.** |
| Đông | Cầu Tình Yêu và tượng Cá chép hoá rồng | Phía Bắc chân Đông Cầu Rồng. Cầu tàu nhô ra sông khoảng 30–40 m, lan can treo khoá tình yêu, đèn trái tim đỏ ban đêm. Tượng cá chép trắng ở đầu cầu tàu. |
| Đông | Cụm khách sạn ven sông | 2–3 tòa 15–25 tầng dọc Trần Hưng Đạo, mặt kính, có bảng tên trên nóc (dùng tên hư cấu, xem mục 3). |

Mức chi tiết: tỉ lệ khối gần đúng, chia tầng, phân biệt kính và tường, vương miện mái, sảnh tầng trệt. **Không cần, và không được, vẽ logo thật** của Novotel hay Vinpearl. Bảng tên trên nóc hai tòa này để trống hoặc chỉ là khung sáng.

---

## 2. Mặt dựng LED trái tim + "DN" (tính năng chính)

### 2.1 Vị trí
- Mỗi tòa có một tấm LED trên **mặt nhìn ra sông**: Novotel quay về **+X**, Vinpearl quay về **−X**. Tấm phủ khoảng **2/3 chiều cao phía trên** của mặt đó, chừa phần chân đế.
- Tấm LED nằm cách mặt kính 0,05–0,1 m (hoặc vá thẳng vào shader của mặt kính) để không bị z-fighting.

### 2.2 Cách vẽ
- Hình vẽ lấy từ **`CanvasTexture`**: một canvas chứa mặt nạ **trái tim** và một mặt nạ **chữ "DN"** (font đậm, không chân). Có thể để hai mặt nạ ở hai kênh màu R và G của cùng một canvas.
- Fragment shader vá bằng `onBeforeCompile`, theo mẫu `patchWindows`/`bridgePatch` trong [src/common/shaders.ts](../src/common/shaders.ts):
  - **Lưới chấm LED**: chia mặt thành ô khoảng 0,8 m. Mỗi ô là một chấm tròn, khe giữa các ô tối. Nhìn gần thấy rõ điểm ảnh LED, nhìn xa thành hình liền.
  - Độ sáng nhân với `shared.uNight` ([src/core/shared.ts](../src/core/shared.ts)). **Ban ngày** tấm LED là kính tối gần như tắt (để lại tối đa 5% cho thấy có màn hình).
  - Màu chính đỏ hồng (khoảng `#ff2a55` → `#ff7aa8`), chữ DN trắng ấm hoặc hồng nhạt.
  - Độ sáng tương đương dải LED các cầu (`led` trong `bridgePatch`) để bloom không bị cháy trắng.

### 2.3 Kịch bản hoạt cảnh (chu kỳ khoảng 24 s)
1. **Tim đập** (0–6 s): trái tim phóng to và thu nhỏ theo nhịp "thình thịch" (hai nhịp gần nhau rồi nghỉ), phóng to tối đa khoảng 8%.
2. **Chữ "DN" hiện dần** (6–12 s): quét từ trái sang phải.
3. **Tim bọc chữ DN** (12–18 s): chữ nằm giữa trái tim, viền tim chạy sáng vòng quanh.
4. **Lấp lánh** (18–24 s): chấm LED nhấp nháy ngẫu nhiên rồi tắt dần, quay về bước 1.

Tham số thời gian đặt trong uniform, không tạo lại material mỗi khung hình.

### 2.4 Hai bờ "đối đáp"
- Chế độ **Đối đáp** (mặc định): hai tòa lệch pha nửa chu kỳ, như bờ Tây nhắn sang bờ Đông rồi bờ Đông trả lời.
- Chế độ **Đồng bộ**: hai tòa chạy cùng pha.
- Nút bật/tắt **"Đèn trái tim"** và nút chọn **"Đồng bộ / Đối đáp"**.

### 2.5 Không lật gương
Chữ "DN" phải **đọc đúng chiều khi nhìn từ sông** ở cả hai tòa. Hai tòa quay ngược hướng nhau, nên trục U của một tấm phải đảo lại. Có test cho việc này (mục 8).

---

## 3. Bảng quảng cáo (thương hiệu hư cấu + du lịch)

### 3.1 Bốn loại bảng
| Loại | Vị trí | Số lượng | Ghi chú |
|---|---|---|---|
| (a) Pano trụ đơn | Dọc Nguyễn Văn Linh, Võ Văn Kiệt, Trần Hưng Đạo, gần đầu cầu | 6–10 | Mặt 12 × 4 m, trụ thép cao khoảng 12 m, hai mặt. Ban đêm có đèn rọi từ dưới lên. |
| (b) Bảng trên nóc nhà | Nóc 4–6 tòa ven sông (không phải hai tòa trái tim) | 4–6 | Khung thép lộ ra, chữ hoặc hình. Ban đêm sáng. |
| (c) Màn LED mặt tiền | 2–3 tòa ven sông, gần Cầu Rồng và Cầu sông Hàn | 2–3 | Đổi quảng cáo mỗi khoảng 8 s bằng dịch UV trong atlas, chuyển mờ 0,6 s. |
| (d) Băng rôn cột đèn | Cột đèn dọc Bạch Đằng, Trần Hưng Đạo | Mỗi 2–3 cột một băng | Treo dọc, hai mặt. Nội dung lễ hội: pháo hoa DIFF, chào năm mới. |

Không đặt bảng chắn tầm nhìn chính tới các cầu, không đặt lên hành lang tuyến hầm.

### 3.2 Atlas và vật liệu
- Một **atlas canvas 2048 × 2048** vẽ lúc chạy (`adAtlas.ts`), chia ô theo tỉ lệ từng loại bảng. **Một vật liệu dùng chung** cho mọi bảng. Emissive = map × `uNight` × hệ số.
- Chữ tiếng Việt có dấu phải hiển thị đúng. Dùng font hệ thống có sẵn, đợi `document.fonts.ready` trước khi vẽ.
- Quảng cáo **không đổi theo i18n**, vì ngoài thực tế bảng quảng cáo ở Đà Nẵng ghi tiếng Việt, đôi khi kèm tiếng Anh.

### 3.3 Nội dung
**Thương hiệu hư cấu** (gợi ý, có thể thêm): Cà phê Hàn Giang, Bia Sóng Biển, Ngân hàng Sông Xanh, Hàng không Hải Âu, Nước mắm Cửa Biển, Bất động sản Sơn Thuỷ Riverside, Điện máy Mặt Trời Mới, Sữa Mây Trắng.

**Thông điệp thành phố:**
- "LỄ HỘI PHÁO HOA QUỐC TẾ ĐÀ NẴNG – DIFF"
- "ĐÀ NẴNG – THÀNH PHỐ ĐÁNG SỐNG"
- "Khám phá Bán đảo Sơn Trà"
- "Ngũ Hành Sơn – Danh thắng quốc gia"
- "Xem Cầu Rồng phun lửa – 21h tối thứ Bảy, Chủ nhật"

**Cấm** dùng tên hoặc logo thương hiệu có thật, kể cả tên na ná (ví dụ không dùng tên giống các hãng sữa, bia, ngân hàng, hãng bay, điện thoại đang có trên thị trường). Trước khi chốt, tự rà danh sách tên và đổi những tên trùng hoặc gần trùng.

---

## 4. Chi tiết bờ sông cho giống thật (P3)

- **Lan can kè** dọc mép kè hai bờ: trụ đá và tay vịn inox. Trụ dùng instancing, tay vịn gộp hình học.
- **Ghế đá, bồn hoa, thùng rác** trên dải đi bộ ven sông (`|x|` từ 264 đến 288), lặp có nhịp, tránh chân cầu và cầu tàu.
- **Bến du thuyền sông Hàn** bờ Tây (gần Cầu Rồng): phao nổi, mái che, cầu dẫn. Thuyền du lịch hiện có không được đâm xuyên phao.
- **Cửa hàng tầng trệt** ở hàng nhà đầu tiên dọc Bạch Đằng, Trần Hưng Đạo: mái hiên nhiều màu, bảng hiệu nhỏ lấy từ atlas (quán cà phê, hải sản, lưu niệm, tên hư cấu).
- **Đèn LED quấn cây** dọc Bạch Đằng ban đêm (đặc trưng của Đà Nẵng): chấm sáng emissive gắn vào thân và tán cây, instancing.

---

## 5. Yêu cầu triển khai trong code

### 5.1 Cấu trúc và quy ước (đọc code trước, làm theo đúng mẫu)
- Thư mục mới **`src/environment/riverfront/`**:
  - `index.ts`: `buildRiverfront()`, `updateRiverfront(dt, time)`, `setHeartsEnabled()`, `setHeartsMode()`, `disposeRiverfront()`
  - `landmarks.ts`: khối các tòa thật
  - `heartFacade.ts`: canvas mặt nạ, vật liệu LED, hoạt cảnh
  - `adAtlas.ts`: vẽ atlas quảng cáo
  - `billboards.ts`: 4 loại bảng
  - `promenade.ts`: lan can, ghế, bồn hoa, bến du thuyền, cửa hàng, đèn quấn cây
  - `clearance.ts`: dọn nhà và cây ngẫu nhiên bị đè
- Thông số đặt trong **một khối `riverfrontBase` trong [src/config.ts](../src/config.ts)**, export `CONFIG.riverfront`. Mỗi dòng có chú thích tiếng Việt, đơn vị, và `(ước lượng)` nếu không có nguồn.
- Comment tiếng Việt, mật độ comment và cách đặt tên giống các file hiện có. Không thêm thư viện mới. Không thêm ảnh ngoài: mọi texture vẽ bằng canvas.

### 5.2 Không phá vỡ chuỗi ngẫu nhiên có seed (bắt buộc)
- **Không** sửa `avoid()` hay vòng lặp `place()` trong [src/environment/city.ts](../src/environment/city.ts). Đổi số lần gọi `rand()` sẽ làm xê dịch toàn bộ nhà, cây và xe.
- Gọi `buildRiverfront()` trong [src/main.ts](../src/main.ts) **sau** `new HanTunnel()`, tức sau mọi lệnh dựng có dùng `rand`.
- Mọi phần ngẫu nhiên mới (vị trí ghế, đèn quấn cây, chọn quảng cáo) dùng bộ sinh số riêng `rng(seed)` trong [src/common/math.ts](../src/common/math.ts), như [src/core/water.ts](../src/core/water.ts) đang làm.
- Nhà ngẫu nhiên nào đè lên chân các tòa thật (cộng lề 4 m), và cây hoặc cột đèn đè lên cầu tàu, bến thuyền: **sau khi dựng xong**, gán ma trận scale 0 cho instance đó. Nhà nằm trong `InstancedMesh` thuộc `THREE.LOD` của `buildCity`, nên phải xử lý **cả level `near` lẫn `far`**. Làm theo mẫu `hideBankTrees()` trong [src/bridges/song-han/SongHanBridge.ts](../src/bridges/song-han/SongHanBridge.ts) và [src/bridges/han-tunnel/corridor.ts](../src/bridges/han-tunnel/corridor.ts).

### 5.3 Ánh sáng và ngày đêm
- Gọi `updateRiverfront(dt, time)` trong vòng `animate()` của `main.ts`. Ngày đêm đọc từ `shared.uNight`, không tự giữ trạng thái riêng.
- Mặt kính các tòa thật dùng `patchWindows` hoặc biến thể của nó để có cửa sổ sáng ban đêm giống các nhà khác.
- Không thêm `PointLight` hay `SpotLight` mới. Đèn rọi bảng quảng cáo làm bằng emissive và gradient trên mặt bảng.
- Các tòa thật và mặt LED có phản chiếu trên mặt nước (đây là cảnh đẹp nhất về đêm). Các chi tiết nhỏ (ghế, bồn hoa, băng rôn) đưa vào `noReflect` hoặc cơ chế tương đương để không tốn draw call phản chiếu.

### 5.4 Góc nhìn và UI
- Thêm vào `VIEWS` trong [src/views/presets.ts](../src/views/presets.ts):
  - `rfHearts`: ban đêm, camera trên mặt sông giữa Cầu Rồng và Cầu sông Hàn, thấy cùng lúc hai tòa trái tim và Cầu sông Hàn phía sau. Chọn góc nhìn này tự chuyển sang đêm (theo cách các góc nhìn đêm khác đang làm, nếu có).
  - `rfBank`: người đi bộ trên dải ven sông Bạch Đằng, nhìn về phía Novotel, thấy lan can, ghế, quảng cáo.
- Thêm hai nút này vào khối `.view-list data-list="dragon"` trong [index.html](../index.html) (hoặc nhóm phù hợp hơn nếu đọc code thấy có).
- Thêm khối điều khiển "Đèn trái tim" (bật/tắt, Đồng bộ / Đối đáp) và "Quảng cáo" (bật/tắt), nối trong [src/ui/setupUI.ts](../src/ui/setupUI.ts).
- **i18n:** mọi khoá mới (`vRfHearts`, `vRfBank`, `rfHearts`, `rfHeartsSync`, `rfHeartsDuet`, `rfAds`…) thêm vào **cả 9 file** `src/i18n/locales/{vi,en,ko,ja,zh,th,ar,hi,ru}.json`. Bản dịch tự nhiên, `ar` đúng chiều phải sang trái.
- Tour: không bắt buộc. Nếu thêm điểm dừng vào Tour Cầu Rồng thì cập nhật cả `scripts/narration/vi.json`, `en.json`, chạy `npm run gen:voice` và commit `public/voice/`. Nếu dịch vụ TTS lỗi thì báo lại, không tự bịa clip.

---

## 6. Hiệu năng (đo bằng `npm run test:drawcalls`)
- Các góc nhìn cũ **tăng không quá 10 draw call** so với bảng trong [tests/KET-QUA.md](../tests/KET-QUA.md), cả ngày lẫn đêm.
- Các góc nhìn không thấy đoạn sông giữa Cầu Trần Thị Lý và Cầu sông Hàn (ví dụ `tpWater`, `tpDrive`, góc nhìn trong hầm `hrGallery`) phải **chênh 0**: dùng LOD và ẩn theo khoảng cách.
- Gộp khối các tòa thật thành một mesh (mặt LED trái tim là mesh riêng). Mỗi loại bảng hoặc đồ vật lặp lại là một `InstancedMesh`. Đặt `THREE.LOD` cho chi tiết P3, ẩn khi camera xa hơn khoảng 600 m.
- `disposeRiverfront()` giải phóng đầy đủ geometry, material, `CanvasTexture`.

---

## 7. Kế hoạch làm (kiểm tra xong giai đoạn trước mới sang giai đoạn sau)
1. **Khảo sát:** đọc `config.ts`, `main.ts`, `environment/*`, `common/shaders.ts`, `common/math.ts`, `core/shared.ts`, `core/water.ts`, `bridges/song-han/SongHanBridge.ts`, `bridges/han-tunnel/corridor.ts`, `views/*`, `ui/*`, `i18n/index.ts`, `tests/*.mjs`. Tóm tắt API sẽ dùng.
2. **Xác minh địa danh:** tra vị trí và số tầng, quy đổi sang toạ độ cảnh, ghi bảng kết quả kèm link nguồn.
3. **Config và dọn nhà:** khối `riverfrontBase`, `clearance.ts`. Chạy `test:drawcalls` để chắc các góc nhìn cũ chưa đổi ngoài phần nhà bị dọn.
4. **Địa danh** (mục 1).
5. **Mặt dựng trái tim** (mục 2).
6. **Atlas và quảng cáo** (mục 3).
7. **Chi tiết bờ** (mục 4).
8. **UI, góc nhìn, i18n 9 ngôn ngữ** (mục 5.4).
9. **Test, ảnh chụp, đo hiệu năng**, cập nhật README (mục cấu trúc) và `tests/KET-QUA.md`.

Làm trên nhánh mới `feature/riverfront` tách từ nhánh hiện tại, commit theo từng giai đoạn, không commit thẳng `main`.

---

## 8. Kiểm tra bắt buộc trước khi báo xong
- `npm run build` không lỗi TypeScript.
- Test mới **`tests/riverfront-check.mjs`** (script `test:riverfront` trong `package.json`), dùng móc `?test` / `window.__app` như các test hiện có (thêm `riverfront` vào `__app` trong `main.ts`):
  - Không instance nhà ngẫu nhiên nào còn hiện mà chân đè lên chân tòa thật.
  - Các nhà không bị dọn **giữ nguyên ma trận** so với trước khi có riverfront (lưu mẫu trước, so sánh sau).
  - Pháp tuyến mặt LED của Novotel hướng +X, của Vinpearl hướng −X. Đi theo trục U tăng thì điểm ảnh chạy sang **bên phải người nhìn từ sông** (chữ không lật gương).
  - Tắt "Đèn trái tim" thì emissive tấm LED bằng 0. Bật lại thì hoạt cảnh chạy tiếp. Bật/tắt 3 lần không rò rỉ material hay texture (đếm `renderer.info.memory`).
  - Ban ngày (`uNight = 0`) độ sáng tấm LED ≤ 5% so với ban đêm.
- `npm run test:tour` và `npm run test:voice` vẫn qua. `test:drawcalls` đạt mục 6, kèm thêm `rfHearts`, `rfBank`.
- Chụp màn hình bằng Playwright ngày và đêm cho `rfHearts`, `rfBank`, `overview`, `shOverview`, `bird`. Lưu vào `tests/screens/` và **tự xem lại ảnh**, soát: chữ "DN" đọc đúng ở cả hai tòa, trái tim rõ hình, bloom không cháy trắng, không z-fighting giữa tấm LED và mặt kính, quảng cáo không che cầu, chữ tiếng Việt có dấu đúng, không nhà nào chồng lên tòa thật.
- Báo cáo trung thực: cái gì xong, cái gì còn thiếu (theo P1/P2/P3), draw call trước/sau, thông số nào là ước lượng, và danh sách tên thương hiệu hư cấu đã dùng.

---

## 9. Nguồn tham khảo
- Google Maps / OpenStreetMap: vị trí Novotel Danang Premier Han River (36 Bạch Đằng), Trung tâm Hành chính Đà Nẵng (24 Trần Phú), Chợ Hàn, Bảo tàng Điêu khắc Chăm, Vinpearl Condotel Riverfront (Trần Hưng Đạo), Cầu Tình Yêu.
- Trang chính thức của từng công trình để lấy số tầng và chiều cao.
- Ảnh đêm sông Hàn trên báo Đà Nẵng, Tuổi Trẻ, VnExpress để tham khảo màu đèn, cách đặt quảng cáo, đèn quấn cây.

Ghi lại link đã dùng trong báo cáo và trong comment đầu `src/environment/riverfront/landmarks.ts`.

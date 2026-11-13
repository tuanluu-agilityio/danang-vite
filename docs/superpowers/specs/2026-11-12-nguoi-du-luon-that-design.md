# Người treo dù lượn dạng người thật (D-035) — thiết kế

_Ngày: 2026-11-12 · Nhánh: `feature/nguoi-du-luon-that` (từ `main` `6dd201a`) · Trạng thái: đã triển khai Task 1–5 và sửa sau review toàn nhánh (`227527d`, 2026-11-13); `test:perf`, `test:drawcalls` chưa chạy, `test:multi` chạy tới 7a; người dùng đã duyệt demo, PR #31_

Người dùng giao bằng một bản yêu cầu tiếng Anh ("upgrade paragliding human character to PUBG-inspired realistic 3D quality") và dặn làm thẳng tới khi xong, không dừng chờ duyệt spec. Mọi lựa chọn kỹ thuật dưới đây là **quyết định của agent**, trừ các ý ghi "người dùng yêu cầu".

## 1. Vì sao

Người treo dưới dù hiện là 20 khối bo tròn gộp cứng vào lưới dù (`exHuman()` trong `src/explore/glider.ts`): không có giải phẫu, không cử động, quay cùng dù như một khối. Người dùng muốn người treo **trông và cử động như người thật** đang bay trên sông Hàn: tỉ lệ cơ thể thật, quần áo dã ngoại kiểu chiến thuật, mũ, găng, giày, đai ngồi + ba lô, tay cầm phanh, thân nghiêng theo lượt rẽ, chân đưa theo quán tính, gió làm người đung đưa nhẹ.

## 2. Mục tiêu / không làm / thất bại

**Mục tiêu (người dùng yêu cầu)**
1. Chế độ dù lượn cũ vẫn chạy y như trước: phím, camera bám, nhiều người, xem, hiệu ứng đêm, thời tiết.
2. Người treo có tỉ lệ người lớn thật, bàn tay có ngón, giày, mũ, quần áo màu ô liu / than / đen.
3. Tư thế bay tự nhiên: ngồi treo, gối hơi gập, tay cầm quai phanh.
4. Phản ứng liên tục theo gió, lượt rẽ, tăng / giảm tốc; không quay như khối cứng.
5. Đai ngồi, ba lô, dây treo, dây phanh nối đúng chỗ, bám theo người khi cử động.
6. Không làm chậm cảnh; có đường lùi khi tải lỗi / chậm.

**Không làm**
- Không vũ khí, không phù hiệu quân đội, không chép nhân vật / logo / texture của PUBG.
- Không đổi mô hình bay (`flight.ts`), camera (`chase.ts`), giao thức nhiều người, máy chủ (`server/multi`): không cần deploy.
- Không mô phỏng vải (cloth), không ragdoll.
- Không đổ bóng từ người treo (như nhân vật Đi dạo; dù bay cao, bóng không thấy).

**Thất bại dù chạy được**
- Người treo vẫn như ma-nơ-canh cứng; tay rời quai phanh; dây treo cắm vào không khí.
- Góc nhìn cũ tăng lệnh vẽ; trang thường (không bay dù) tải thêm dữ liệu.
- Gọi hình tạm là "bản thật".

## 3. Mô hình: nguồn và giấy phép

**Chọn: Microsoft Rocketbox `Military_Male_01`** (`Assets/Avatars/Professions/Military_Male_01`, giấy phép MIT, cùng commit ghim `0943055` với nhân vật Đi dạo). Lý do: giấy phép cho để trong repo công khai và phân phối lại (bất biến #5, D-033); tải được tự động không cần tài khoản; đã có đường ống Blender (`scripts/people/`); có sẵn mũ + kính, áo giáp vải nhiều túi, găng, giày cao cổ, normal map và specular map; cùng bộ xương `Bip01_*` với nhân vật Đi dạo.

Nguồn khác đã cân nhắc và loại:
- **Sketchfab** (mô hình CC BY chất lượng cao hơn): tải về cần tài khoản / API token của người dùng, và phải duyệt giấy phép từng mô hình. Không tự động được. Xem §11 "Đặc tả tài sản nếu muốn nâng tiếp".
- **Mixamo**: cần đăng nhập Adobe; điều khoản không rõ cho việc để tệp gốc trong repo công khai.
- **Ready Player Me**: nét hoạt hình, không đạt hướng hình ảnh.

**Giới hạn phải nói thẳng:** Rocketbox là chất lượng game khoảng 2010 (≈ 15–20 nghìn tam giác, texture 2048). Nó là người có giải phẫu, ngón tay, nếp vải vẽ trong texture và normal map, **chưa phải chất lượng PUBG**. Mức PUBG cần tài sản trả tiền hoặc tài khoản tải về (§11).

**Chỉnh sửa khi chuyển đổi** (`scripts/people/pilot.py`, lệnh `npm run gen:pilot`):
- Bỏ lưới dao găm (`combat_knife`) và mọi lưới vũ khí.
- Chỉnh màu texture thân / trang bị / mũ từ rằn ri số xám sang **ô liu sẫm + than** (giảm bão hòa rồi nhân màu; không đụng da mặt). Vùng phù hiệu cờ trên tay áo và bảng tên ngực: tô phủ màu vải (tọa độ UV tìm bằng ảnh xem trước); không tô được sạch thì ghi vào hạn chế.
- Gộp vật liệu: tối đa **2 lưới / 2 vật liệu** (đục; mảnh alpha nếu nguồn có).
- Texture: màu 1024 JPEG, normal 1024 JPEG, độ nhám suy từ specular map đóng vào kênh G của texture ORM 512 (metalness 0, trừ khóa cài do code dựng).
- Trục và đơn vị như `convert.py`: mét, +Y lên, mặt hướng +X, gốc ở **xương hông** tư thế chuẩn (không phải bàn chân).
- Một đoạn chuyển động `sit`: lấy từ `m_sit_chair_breathe_01` (ngồi, thở), cắt vòng lặp 4–6 s, 30 khung/giây, bỏ kênh ngón tay (ngón do code đặt). Đây là **tư thế nền** có nhịp thở thật; mọi thứ khác do bộ điều khiển xương tính.
- `scenes[0].extras`: `height`, `hip` (cao độ hông tư thế đứng).

**Trần (có test đơn vị kiểm):** `public/people/pilot.glb` ≤ 2,5 MB; ≤ 25 000 tam giác; ≤ 80 xương; có đoạn `sit`; không còn nút / lưới tên chứa `knife`, `pistol`, `weapon`. `LICENSE-Rocketbox.txt` thêm dòng cho `pilot.glb` + ghi đã chỉnh màu, bỏ dao.

## 4. Kiến trúc

Thư mục mới `src/explore/pilot/` (tên yêu cầu → tên trong dự án):

| Yêu cầu | File | Việc |
|---|---|---|
| CharacterLoader | `pilot/load.ts` | `plLoad()`: import() động `GLTFLoader` + `SkeletonUtils`, nạp `pilot.glb` một lần, chuẩn hóa vật liệu, làm nóng shader (`plSetWarm`), quá `loadMs` hoặc lỗi → `null` (không ném, không thử lại) |
| CharacterAnimator | `pilot/rig.ts` | `PlRig`: bản sao + `AnimationMixer` phát `sit`; mỗi khung gọi mixer rồi các bộ điều khiển; `dispose()` |
| CharacterRigController | `pilot/bones.ts` | Tra xương `Bip01_*`, tư thế nền bay (hệ số gập hông / gối / ngả lưng cộng lên `sit`), IK hai khớp cho tay, co ngón nắm quai |
| FlightPoseController + FlightReactionController | `pilot/react.ts` (**thuần, không import three**) | Từ trạng thái bay → tín hiệu (rẽ, gia tốc dọc, lên xuống, gió) → lò xo tắt dần → góc từng nhóm xương, độ kéo phanh trái / phải, góc lắc con lắc. Test đơn vị được |
| EquipmentController | `pilot/gear.ts` | Một `SkinnedMesh` dựng bằng code: đai ngồi, ba lô + dù dự phòng, đai vai / ngực / đùi, khóa, móc carabiner, đai treo (riser), quai phanh, dây phanh, dây treo. Gắn cứng theo xương bằng skinIndex |
| (điều phối) | `pilot/index.ts` | `plAttach(glider)`, `plUpdate(glider, state, dt, inp?)`, `plDetach(glider)`, `plPreload()`, `plDebug()` |

`glider.ts` đổi tối thiểu: tách hình học thành **hai bản** dùng chung: `full` (như cũ, có người khối + dây: hình tạm) và `canopy` (chỉ cánh + dải đèn). `exBuildGlider()` vẫn trả một Group một Mesh với hình `full`; `exPlaceGlider(g, s, dt?, inp?)` gọi `plUpdate`. Khi rig sẵn sàng, `plAttach` đổi `mesh.geometry` sang `canopy` và thêm nhóm con `ex-pilot`. Lỗi / chưa tải: giữ `full` → hình như hôm nay.

**Vì sao dây và đai là SkinnedMesh:** dây treo nối cánh (đứng yên trong hệ dù) với móc trên đai (lắc theo người); dây phanh nối mép sau cánh với bàn tay (IK). Mỗi đầu dây gán cho một "xương" khác nhau thì dây tự co giãn, luôn dính hai đầu, **một lệnh vẽ**. `Skeleton` của trang bị = [xương `wing` (Object3D tĩnh trong hệ dù), xương `hang` (điểm treo, con của nhóm lắc), Pelvis, Spine2, L Hand, R Hand, L Thigh, R Thigh].

**Cây nút mỗi dù (khi có rig):**
```
ex-glider (Group, đặt theo pos / yaw / bank như cũ)
├─ Mesh cánh (hình canopy)                         1 lệnh vẽ
└─ ex-pilot (Group)
   ├─ wing (Object3D tĩnh)
   ├─ swing (Group, tâm quay = đỉnh riser (điểm tụ dây); lắc con lắc)
   │  └─ nhân vật (bản sao glb, 1–2 SkinnedMesh)   1–2 lệnh vẽ
   └─ gear (SkinnedMesh, hệ dù)                    1 lệnh vẽ
```
**Tâm lắc (đã đổi khi làm Task 4):** ở đỉnh riser, nơi dây treo tụ lại, không ở giữa hai carabiner như bản đầu của spec: riser + carabiner + người lắc cùng nhau, dây treo phía trên đứng yên trong hệ dù (đúng vật lý hơn, riser không bị kéo lệch). Nhóm `swing` (`pl-swing`) vừa là tâm lắc vừa là xương `hang` của trang bị.

Tổng ≤ 4 lệnh vẽ mỗi dù có rig (hôm nay 1; khi làm: 3 lưới = cánh + nhân vật + trang bị; `explore-check` 7c đo hiệu render +4 vì cánh của mình ở lớp 0 còn vẽ trong phản chiếu mặt nước, hình khối +2 cùng lý do). Chỉ tồn tại khi bay dù, nên **5 góc kiểm cũ +0**.

**Lớp (layer):** nhân vật + trang bị ở lớp 1 (không vào phản chiếu nước, như nhân vật Đi dạo và dù người khác). Cánh của mình giữ lớp 0 như cũ.

## 5. Tư thế và phản ứng (`react.ts`, `bones.ts`)

Hệ cục bộ của dù: +X hướng bay, +Y lên, +Z phải. `bank > 0` = nghiêng trái.

**Tín hiệu vào** (tính từ `GliderState` nên dùng chung cho dù của mình, dù người khác, chế độ xem):
- `turn` = `bank / bankMax` (−1…1); dù của mình có `inp.turn` thì quai phanh theo phím ngay (tay đi trước, thân theo sau).
- `acc` = đạo hàm tốc độ ngang, chuẩn hóa theo `speedAccel` (dù người khác: sai phân vị trí, làm mượt).
- `vy` = đạo hàm cao độ / `climbRate`.
- `gust` = nhiễu mượt 3 kênh (tổng sin tần số không ước chung, pha theo slot), biên độ nhân `1 + windGain × mức gió thời tiết` (đọc cùng nguồn gió mà cây / mưa dùng; không có thì 0).

**Lò xo tắt dần** (bậc hai, bước bán ẩn, dt kẹp ≤ `dtMax`, không cấp phát): mỗi kênh có tần số và hệ số tắt riêng trong `CONFIG.explore.pilot`.

| Kênh | Đích | Tác động |
|---|---|---|
| Lắc ngang cả người (swing roll) | `−turn × swingRoll` + gió | người văng ra ngoài lượt rẽ so với cánh, trễ rồi dao động tắt dần |
| Lắc dọc (swing pitch) | `−acc × swingPitch` + gió | tăng tốc: người tụt ra sau; hãm: đưa ra trước |
| Xoắn (swing yaw) | gió, nhỏ | đai xoay nhẹ |
| Dồn trọng tâm (spine roll) | `turn × leanRoll` | thân + vai nghiêng **vào** lượt rẽ, chia qua Spine / Spine1 / Spine2 |
| Vặn thân, đầu | `turn × twist`, `turn × headYaw` | vai xoay theo, đầu nhìn vào hướng rẽ; đầu tự giữ gần thẳng đứng (bù một phần góc lắc) |
| Ngả thân | `acc × leanPitch`, `vy` | chúi nhẹ khi tăng tốc, ngả khi hãm / lên |
| Chân | trễ hơn thân (tần số thấp hơn): đưa ngang theo `turn`, đưa trước sau theo `acc`, gối gập thêm khi hãm; hai chân lệch pha, cộng gió | chân theo quán tính |
| Phanh trái / phải (0…1) | `brakeBase + turn⁺ × brakeTurn + giảm tốc × brakeSlow − tăng tốc × brakeFast` | quai phanh kéo xuống `brakeTravel` m; tay theo bằng IK |

**IK tay** (`bones.ts`): hai khớp giải tích (vai → khuỷu → cổ tay), đích = vị trí quai phanh trong hệ dù; khuỷu hướng ra ngoài + xuống; cổ tay xoay cho lòng bàn tay hướng trước; ngón co theo góc cố định (nắm). Đích ngoài tầm với → kẹp về tầm với (không gãy khớp). Sai số tay–quai ≤ 3 cm (test trình duyệt đo).

**Giới hạn khớp:** mọi góc cộng thêm đều kẹp theo bảng `limits` trong config (gối chỉ gập một chiều, khuỷu không duỗi ngược).

**Chuyển động phụ của trang bị:** ba lô và đuôi đai có lò xo riêng trễ hơn thân (lắc nhẹ); đuôi đai thừa phất theo gió bằng xoay "xương" phụ. Không mô phỏng vải.

## 6. Trang bị (`gear.ts`), dựng bằng code

Vertex color + một vật liệu `MeshStandardMaterial` (nhám theo vertex qua hai nhóm màu; khóa / carabiner sáng hơn, `metalness` thấp chung để còn 1 lệnh vẽ). Thành phần:
- Đai ngồi kiểu ghế: tấm ngồi, hai má hông, tấm lưng (gắn Pelvis / Spine).
- Ba lô lưng + hộp dù dự phòng dưới ghế, quai kéo dù dự phòng màu đỏ (gắn Spine2 / Pelvis).
- Đai vai ×2, đai ngực có khóa, đai đùi ×2 có khóa (đầu gắn xương tương ứng nên bám người).
- Móc carabiner ×2 ở hai bên hông trước ngực, đai treo (riser) từ móc lên điểm tụ dây.
- Quai phanh ×2 (vòng nhỏ, gắn xương bàn tay) + dây phanh từ quai lên mép sau cánh.
- Dây treo: `lineCount` dây mỗi bên từ cánh xuống đầu riser (thay dây của hình `full`).

Trần: ≤ 6 000 tam giác. Màu: đen / than / ô liu, điểm nhấn đỏ ở quai dự phòng. Ban đêm: không phát sáng (dải đèn mép cánh giữ nguyên).

## 7. Tải, đường lùi, chất lượng

- `plPreload()` gọi khi bấm thẻ Dù lượn ở màn chọn và khi `explore.start()` / `startWatching()`; trang thường không tải `pilot.glb` (import động, chunk `GLTFLoader` đã có sẵn từ Đi dạo). `plUpdate` không tự nạp: Đi dạo / Lái xe nhìn thấy dù người khác giữ người khối, không tải tệp (sửa sau review toàn nhánh; bản đầu `plUpdate` tự nạp nên hai chế độ đó cũng tải).
- Dù người khác (`pilot.remote`, không phải điện thoại) có người treo là 3 lưới ở lớp 1, tức tối đa +3 lệnh vẽ mỗi dù so với +1 của hình khối (4 dù: ≤ +12; chế độ xem 5 dù: ≤ +15; ngưỡng của `tests/multi-check.mjs` đã đổi theo). Phản chiếu mặt nước của dù mình chỉ còn cánh, không người, không dây (rig ở lớp 1).
- Trước khi rig sẵn sàng: hình `full` cũ (người khối). Sẵn sàng → đổi trong vòng khung, không khựng (shader đã làm nóng bằng `compileAsync`, chờ tối đa `warmMs`).
- Lỗi mạng / tệp hỏng / thiếu đoạn `sit` / thiếu xương bắt buộc / quá `loadMs`: `console.warn` một lần, giữ hình khối suốt phiên.
- `?pilot=off`: ép hình khối (cho test và so sánh).
- Test trình duyệt (SwiftShader): khung đầu chặn luồng chính lâu hơn `loadMs` (15 s) nên test cần người thật nới `CONFIG.explore.pilot.loadMs` (180 s) qua `__app.exFlight.CONFIG_explore` rồi mới `explore.start()` (`tests/pilot-shots.mjs`, `explore-check` mục 7); ca kiểm đường lùi giữ giá trị thật. Giá trị chạy thật giữ 15 000 ms.
- `CONFIG.explore.pilot.remote`: dù người khác có dùng rig không (mặc định có; tối đa 4 bản sao). Điện thoại (bậc khởi đầu `phone`) → dù người khác dùng hình khối, dù của mình vẫn rig.
- `dispose`: `PlRig.dispose()` bỏ mixer + skeleton bản sao + skeleton / hình học riêng của gear; nguồn dùng chung giữ lại. Thoát chế độ là tải lại trang (như cũ) nên không có vòng đời dài hơn.

## 8. Cấu hình

Khối mới `CONFIG.explore.pilot` trong `src/config.ts` (mọi số `(ước lượng)`, có đơn vị, chú thích tiếng Việt): đường dẫn mô hình, `loadMs`, `warmMs`, `remote`, vị trí điểm treo so với hông, tư thế nền (góc), biên độ + tần số + tắt dần từng kênh, `brake*`, `gust*`, `limits`, kích thước trang bị, màu.

`CONFIG.explore.glider` giữ nguyên; `lines` vẫn là khoảng cánh → điểm treo.

## 9. Không đổi

`flight.ts`, `chase.ts`, `nightShows.ts`, `multi/*` trừ `remote.ts` (truyền `dt` cho `exPlaceGlider`), `server/multi`, i18n (không có chữ mới), thứ tự `build*()` và chuỗi `rand()` (không đụng), đèn (không thêm đèn).

## 10. Kiểm

**Đơn vị** (`npm run test:pilot:unit`, `tests/pilot-unit/`):
- `react.test.ts`: đứng yên lâu → mọi kênh về 0 (trừ gió); rẽ trái → swing roll ra ngoài, spine roll vào trong, phanh trái > phanh phải; hãm → hai phanh tăng; mọi đầu ra nằm trong `limits` với đầu vào cực đoan + dt lớn / NaN; không phụ thuộc tốc độ khung (60 Hz so với 20 Hz lệch nhỏ).
- `ik.test.ts`: IK hai khớp đạt đích trong tầm (sai số < 1 mm), ngoài tầm thì duỗi thẳng về phía đích, không NaN.
- `gear.test.ts`: trần tam giác, skinIndex hợp lệ, mỗi dây có đầu gắn `wing` và đầu gắn `hang` / bàn tay.
- `glb.test.ts`: trần dung lượng / tam giác / xương, có `sit`, không lưới vũ khí, có dòng giấy phép.
- `glider.test.ts` nếu dựng được không cần DOM: hình `canopy` không còn đỉnh vùng người.

**Trình duyệt** (thêm mục vào `tests/explore-check.mjs`, chạy **một lần cuối nhánh**): rig thật hiện, hình cánh là `canopy`; tay cách quai ≤ 3 cm ở 5 trạng thái (thẳng, rẽ trái, rẽ phải, tăng tốc, hãm); rẽ thì góc lắc và nghiêng thân đúng dấu; lệnh vẽ của dù ≤ 4; `?pilot=off` và chặn `pilot.glb` → hình khối, 1 lệnh vẽ, không lỗi console; ban đêm và mưa không lỗi.

**Mắt:** ảnh chụp cận cảnh sau / ngang / trước / camera bám, ngày + đêm + mưa (`tests/screens/pilot-*.png`, không commit). Agent xem ảnh và sửa tới khi hết lỗi rõ (xuyên hình, khớp gãy, tay rời quai).

**Hiệu năng:** `test:perf -- --strict` và `test:drawcalls` chạy một lần cuối (góc cũ +0).

## 11. Đặc tả tài sản nếu muốn nâng tiếp lên mức PUBG

Cần người dùng cung cấp (tài khoản / tiền / duyệt giấy phép): một nhân vật nam có xương kiểu humanoid (≤ 40 nghìn tam giác, ≤ 70 xương, có xương ngón), quần áo dã ngoại chiến thuật, texture PBR 2K (màu, normal, ORM), giấy phép cho phân phối lại trong repo công khai (CC BY / CC0 / MIT), không vũ khí. `pilot.py` nhận tệp nguồn khác bằng bảng ánh xạ tên xương → `Bip01_*`; phần `react.ts` / `gear.ts` không đổi.

## 12. Rủi ro

- Tư thế `sit` của Rocketbox là ngồi ghế (lưng thẳng, đùi ngang): cần cộng góc ngả lưng + duỗi chân; chỉnh bằng ảnh.
- Tô lại màu texture có thể lem vào da cổ tay / mặt nếu chung atlas: làm theo mặt nạ màu da (hue) + ảnh xem trước.
- Trang bị gắn cứng theo xương sẽ xuyên nhẹ vào áo khi thân vặn mạnh: giữ biên độ nhỏ, đai nổi cách thân 1–2 cm.
- SwiftShader chậm: test trình duyệt chỉ chạy một lần cuối.

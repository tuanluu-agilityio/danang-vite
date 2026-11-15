# Bán đảo Sơn Trà: núi rừng tự nhiên thay hình nón (D-047)

_2026-11-15 · nhánh `feature/son-tra-nui-rung` (worktree `.worktrees/son-tra`, từ `main` `063c445`) · Trạng thái: đã triển khai (`c69232d`, sửa sau review `82bf208`), merge PR #45 (2026-11-15); ô lưới thực tế 22 m, ≈ 81 000 tam giác_

## 1. Ý định

Người dùng giao bản yêu cầu "Son Tra Peninsula — Exterior Visual Transformation": đứng trên Cầu Rồng, Cầu sông Hàn, Trần Thị Lý, Thuận Phước nhìn về Sơn Trà phải thấy một bán đảo núi xanh rừng nhiệt đới, không phải khối hình học. Chỉ ngoại hình nhìn từ xa. Người dùng bảo không hỏi thêm, làm tới cùng.

Hiện trạng (`src/environment/mountains.ts`, 22 dòng): Sơn Trà là 4 `ConeGeometry` 28 × 7 đoạn bị vặn bằng sin, Hải Vân 3 nón nữa, gộp một lưới, `MAT.mountain` một màu `0x2f4c33`, `flatShading`. Nhìn từ cầu thấy hình nón có mặt phẳng tam giác lớn, chân nón cắt thẳng xuống nước và đè lên khu đất đầu Đông Cầu Thuận Phước. Không hệ nào khác đọc lưới núi (không va chạm, không dẫn đường); dù lượn chỉ dùng tọa độ cất cánh `CONFIG.explore.takeoff` = (2600, 702, −4700).

## 2. Mục tiêu / không làm

Mục tiêu:
- Đường chân trời Sơn Trà liền mạch: một dãy chính nhiều đỉnh, yên ngựa, dông phụ, khe; chân núi thoải ra biển với đường bờ không đều.
- Mặt núi trông như phủ rừng rậm: nhiều sắc xanh, vân tán cây, khe tối, sườn sáng, đá lộ ở dốc đứng và mép nước.
- Hòa vào cảnh bằng đèn và sương có sẵn (`sun`, `scene.fog`), không hệ đèn / thời tiết mới.
- Dãy Hải Vân (cùng lưới, cùng vật liệu) dùng cùng kỹ thuật để không còn nón cạnh Sơn Trà mới (quyết định của agent).

Không làm: đường, chùa, hải đăng, bãi tắm, cây từng gốc, đèn đêm trên núi, va chạm với núi, đổi cầu / nhà / mặt nước / camera / nhiều người. Không đổi vị trí tổng thể của Sơn Trà.

Hỏng dù chạy được: nhìn từ cầu vẫn thấy nón / mặt phẳng; tăng lệnh vẽ ở góc cũ; núi đè lên đất, đường, nhà; dù lượn cất cánh trong lòng núi.

## 3. Các cách đã cân nhắc

1. **Lưới theo hàm độ cao + vật liệu vá shader (chọn).** Hàm `stHeight(x, z)` thuần (sống núi là đường gấp khúc có độ cao + bề rộng, nhiễu giá trị tất định tạo dông / khe / bờ), lấy mẫu trên lưới đều, bỏ ô chìm dưới nước. Một lưới, một lệnh vẽ, không tài nguyên ngoài, chỉnh bằng số trong `CONFIG`.
2. Bản đồ độ cao thật (SRTM) nướng thành ảnh: đúng địa hình hơn nhưng Sơn Trà thật dài 13 km, cảnh đang nén còn khoảng 4 km, phải bóp méo; thêm tệp tải + giấy phép. Không đáng cho mục tiêu "nhìn từ cầu".
3. Mô hình Blender → GLB: thêm tệp, quy trình sinh, khó chỉnh; không lợi hơn cách 1.
4. Giữ nón, chỉ đổi vật liệu: không sửa được đường chân trời, là lỗi chính.

## 4. Thiết kế

### 4.1 Hình dạng (`src/environment/terrain.ts`, thuần, không three)
- Nhiễu giá trị 2D băm số nguyên (không `rand()`, không `rng`), `fbm`, nhiễu sống (`ridged`), vặn miền.
- Mỗi khối núi: danh sách điểm sống `[x, z, cao, rộng]`. Tại điểm p: tìm điểm gần nhất trên đường gấp khúc → cao H, rộng W nội suy; `u = d / W`; mặt cắt lõm tự nhiên. Các sống hợp bằng max mượt.
- Dông phụ và khe: nhân với nhiễu sống đã vặn miền, biên độ lớn ở lưng chừng sườn; nhiễu nhỏ thêm gồ ghề; bờ biển lệch bằng nhiễu tần số thấp.
- Sơn Trà: sống chính Tây → Đông qua đỉnh (2600, −4700) cao ≈ 690 m (thật 696 m), kéo dài về Đông thấp dần; nhánh Tây Nam thấp (chỗ nón 3) và nhánh Đông Nam (chỗ nón 2) giữ vị trí cũ. Mặt đất tại điểm cất cánh ≤ 698 m (dù ở 702 m).
- Vùng cấm: hình chữ nhật đất liền bờ Đông x < 1480, z > −3700 (đất, đường, nhà Thuận Phước). Núi bị ép xuống ≤ 2,3 m (dưới `landY`) tại mép và tăng dần trong 600 m; trong vùng cấm không có tam giác.
- Hải Vân: ba sống quanh vị trí nón cũ, đỉnh ≈ 1100 m, lưới thưa hơn.

### 4.2 Lưới (`mountains.ts`)
- Lưới đều: Sơn Trà ô 26 m, Hải Vân ô 64 m; bỏ ô có cả 4 đỉnh dưới −3 m. Pháp tuyến tính từ sai phân của hàm độ cao (mượt, không `flatShading`).
- Màu đỉnh nướng: sắc rừng theo độ cao + nhiễu mảng lớn; độ khuất (so độ cao với trung bình lân cận: khe tối, dông sáng); đá nâu xám ở dốc > ≈ 48°; dải đá / cát sáng ở mép nước. Thuộc tính `aRock` (0..1) để shader giảm vân tán trên đá.
- Gộp Sơn Trà + Hải Vân một `Mesh`, một lệnh vẽ như cũ. Trần: ≤ 140 000 tam giác tổng (cảnh đang 1,4–3,5 triệu).
- Không đổ bóng, không nhận bóng (vùng bóng của `sun` chỉ ±470 m quanh sông), như cũ.

### 4.3 Vật liệu (`MAT.mountain`)
- `MeshStandardMaterial`, `vertexColors`, roughness 1, bỏ `flatShading`; `onBeforeCompile` + `customProgramCacheKey 'mountainForest'`.
- Texture canvas 512² lát được (`stCanopyTexture`): R = độ cao tán (các đốm tròn chồng nhau), G = nhiễu sắc độ. Lấy mẫu theo tọa độ thế giới xz ở 3 tỉ lệ (≈ 1 / 520, 1 / 130, 1 / 31 m), mipmap lo răng cưa.
- Mảnh: nhân màu với vân tán (tán sáng, kẽ tối), lệch sắc theo G, pháp tuyến nghiêng theo gradient độ cao tán (2 mẫu thêm) để tán bắt nắng; trên đá giảm vân. Sương dùng `scene.fog` sẵn có.
- Đêm: không emissive; núi tối theo đèn môi trường như cũ.

### 4.4 Thông số
`CONFIG.sonTra` (ô lưới, biên độ nhiễu, màu, tỉ lệ vân) có chú thích tiếng Việt + đơn vị + `(ước lượng)`. Bảng điểm sống nằm trong `terrain.ts` (dữ liệu hình dạng, như `roadData.ts`).

## 5. Ràng buộc
- Không gọi `rand()`; `buildMountains()` giữ nguyên chỗ trong `main.ts`.
- Lệnh vẽ góc cũ +0 (vẫn một lưới núi); program: thay một program (`mountain` cũ → `mountainForest`), không tăng.
- Không thư viện, không tệp tài nguyên mới, không khóa i18n.

## 6. Kiểm
- `npm run test:terrain:unit` (node, nhanh): tất định; đỉnh chính 660–698 m gần (2600, −4700) và ≤ 698 m tại điểm cất cánh; ≤ 2,5 m trong vùng cấm; không bước nhảy > 60 % độ dốc giữa hai mẫu kề (không vách hình học); đường chân trời nhìn từ Cầu Rồng có ≥ 3 đỉnh cục bộ; trần tam giác.
- `tests/sontra-shots.mjs` (GPU thật): ảnh trước / sau từ bốn cầu (góc 50° và tele), vịnh, trên cao, sát sườn; ngày + đêm; ghi lệnh vẽ + tam giác. Tiêu chí nhận là ảnh từ cầu, do agent xem rồi người dùng duyệt.
- `typecheck`, `build`. Test nặng SwiftShader (`test:drawcalls`, `test:perf`) chạy một lần cuối nhánh nếu người dùng muốn (thói quen đã ghi của dự án).

## 7. Để người làm tự quyết
Số cụ thể của điểm sống, biên độ nhiễu, màu: chỉnh theo ảnh chụp cho tới khi đạt từ bốn cầu.

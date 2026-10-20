# Nhiệm vụ: Thêm mô hình Cầu Thuận Phước (Đà Nẵng) vào project Three.js hiện có

## Bối cảnh
Project này đã có mô hình **Cầu Rồng Đà Nẵng** dựng bằng Three.js. Tôi muốn bổ sung **Cầu Thuận Phước** vào CÙNG scene, chi tiết, sống động và chân thực nhất có thể, mà không làm hỏng hay thay đổi hành vi của Cầu Rồng.

## Bước 0 — BẮT BUỘC: Đọc project trước khi viết code
Trước khi viết dòng code nào, hãy:
1. Đọc toàn bộ cấu trúc thư mục, file entry (main.js / index.js / App...), và module Cầu Rồng.
2. Xác định và ghi lại cho tôi:
   - Phiên bản three.js, cách import (npm/CDN, ES modules), bundler (Vite/Webpack/không có).
   - **Đơn vị và tỉ lệ** đang dùng (1 unit = 1 m hay tỉ lệ khác?), trục nào là hướng Bắc, trục Y có phải là trục đứng không.
   - Vị trí, hướng của Cầu Rồng và sông Hàn trong scene.
   - Hệ thống nước (Water/Reflector/shader tự viết?), Sky, ánh sáng, shadow, post-processing, chế độ ngày/đêm (nếu có), camera controls, GUI (lil-gui/dat.gui?).
   - Pattern tổ chức code (class, factory function, folder `bridges/`...).
3. Tóm tắt ngắn những điều trên rồi mới bắt đầu. **Tái sử dụng** renderer, scene, nước, bầu trời, đèn, loader, material chung có sẵn — không tạo cái mới song song.

## Kiến trúc code yêu cầu
- Tạo module riêng, ví dụ `src/bridges/thuanPhuoc/` gồm: `ThuanPhuocBridge.js` (class chính, trả về một `THREE.Group`), `towers.js`, `deck.js`, `cables.js`, `approaches.js`, `lighting.js`, `materials.js`, `config.js` (toàn bộ thông số kích thước).
- Mọi kích thước để trong `config.js` dưới dạng hằng số có comment đơn vị (mét) — không "magic number" rải rác.
- Theo đúng style code, naming và pattern của module Cầu Rồng.
- Có `update(deltaTime, elapsed)` cho animation và `dispose()` giải phóng geometry/material/texture.
- Không sửa logic Cầu Rồng; nếu buộc phải refactor phần dùng chung, giải thích lý do trước.

## Vị trí địa lý
- Cầu Thuận Phước nằm ở **cửa sông Hàn, nơi sông đổ ra vịnh Đà Nẵng**, là cây cầu cực Bắc trên sông Hàn — phía hạ lưu (Bắc) Cầu Rồng khoảng 2,5–3 km, sau cầu sông Hàn.
- Cầu chạy gần theo hướng **Tây – Đông**: đầu Tây nối đường Nguyễn Tất Thành (phía Hải Châu/Thuận Phước), đầu Đông nối đường Hoàng Sa – Trường Sa / bán đảo Sơn Trà.
- Đặt cầu theo đúng tương quan này với Cầu Rồng theo tỉ lệ của project. Nếu toàn bộ khoảng cách thật quá xa so với scene hiện tại, hãy đề xuất: (a) giữ tỉ lệ thật và mở rộng sông/mặt nước + fog/LOD, hoặc (b) rút ngắn khoảng cách nhưng giữ đúng tỉ lệ kích thước của từng cây cầu. Hỏi tôi chọn trước khi làm.
- Phía Bắc cầu là mặt biển mở của vịnh; phía Đông xa xa có thể có silhouette núi Sơn Trà (dạng low-poly / billboard đơn giản).

## Thông số kỹ thuật thật (dùng làm chuẩn)
| Hạng mục | Giá trị |
|---|---|
| Loại cầu | Cầu treo dây võng, 3 nhịp liên tục |
| Tổng chiều dài | ~1.856 m |
| Phần cầu treo | 655 m = 125 m (nhịp biên) + **405 m (nhịp chính)** + 125 m (nhịp biên) |
| Dầm cầu treo | Dầm hộp thép liên tục, 69 đốt dầm hàn nối |
| Cầu dẫn | Mỗi bên 12 nhịp × 50 m dầm hộp BTCT dự ứng lực liên tục (~600 m mỗi bên) |
| Bề rộng | 18 m, 4 làn xe |
| Tháp | 2 tháp BTCT dạng khung **chữ H**, cao 80 m tính từ bệ cọc (tổng ~90–92 m trên mặt nước) |
| Cáp chủ | 2 bó, đường kính 360 mm |
| Cáp treo (hanger) | 114 bó, cách đều trung bình ~9,9 m; loại thường Ø65 mm, loại đặc biệt Ø101 mm |
| Tĩnh không thông thuyền | 27 m |
| Chiếu sáng | Hệ LED nghệ thuật đổi màu (Philips), ý tưởng "những cơn gió hướng ra biển" |

Những gì không có số liệu chính xác (độ võng cáp, kích thước tiết diện tháp, cao độ dầm ngang...) thì ước lượng hợp lý theo cầu treo thông thường, ghi rõ là ước lượng trong comment.

## Chi tiết mô hình từng phần

### 1. Tháp (towers)
- Khung chữ H: 2 cột đứng hơi thon dần lên trên, tiết diện hộp chữ nhật có vát cạnh/chamfer; ít nhất 2 dầm ngang (một dưới mặt cầu đỡ dầm, một ở đỉnh), cân nhắc thêm dầm ngang giữa nếu tham chiếu ảnh có.
- Bệ cọc/bệ trụ dưới nước, có đường viền nước bám (vệt ẩm tối màu gần mặt nước).
- Yên ngựa (saddle) trên đỉnh tháp nơi cáp chủ vắt qua, có nắp che.
- Chi tiết nhỏ: đèn báo hàng không đỏ nhấp nháy trên đỉnh tháp, mép khối bê tông có bevel nhẹ.

### 2. Cáp chủ (main cables)
- Hai cáp chủ, mỗi bên một mặt phẳng, dạng **parabol** ở nhịp chính và nhịp biên:
  `y(x) = y_top - 4·f·(x/L)·(1 - x/L)` với f = độ võng (ước lượng ~L/9 đến L/10 cho nhịp 405 m).
- Dựng bằng `TubeGeometry` theo `CatmullRomCurve3` lấy mẫu dày từ công thức parabol.
- Cáp ở nhịp biên chạy từ đỉnh tháp xuống **khối neo (anchorage)** BTCT ở hai đầu phần cầu treo.
- Có các kẹp cáp (cable bands) tại vị trí mỗi hanger.

### 3. Cáp treo (hangers)
- Tổng 114 hanger, khoảng cách ~9,9 m, thẳng đứng từ kẹp cáp chủ xuống neo trên dầm.
- Dùng **InstancedMesh** (một cylinder, scale theo chiều dài) để tối ưu.
- Hanger gần tháp/giữa nhịp dùng loại đường kính lớn hơn nếu hợp lý.

### 4. Dầm hộp thép & mặt cầu
- Tiết diện dầm hộp khí động học (bụng vát hai bên, đáy phẳng), dựng bằng `ExtrudeGeometry` từ `Shape` tiết diện, extrude theo đường cong đứng nhẹ (dầm vồng lên ở giữa nhịp).
- Mặt cầu: 4 làn xe, vạch kẻ đường (trắng/vàng) bằng texture tạo bằng `CanvasTexture`; dải phân cách giữa; lề bộ hành, lan can thép, gờ chắn.
- Cột đèn đường hai bên theo nhịp đều, bóng đèn sáng vào ban đêm.
- Các khe co giãn tại tháp và hai đầu.

### 5. Cầu dẫn (approach spans)
- Mỗi bên 12 nhịp × 50 m dầm hộp BTCT, trụ đôi hoặc trụ đơn đỡ bằng thân trụ BTCT.
- Cao độ hạ dần từ ~30 m (gần tháp) về mặt đất ở hai đầu, chuyển tiếp mượt mà; dùng InstancedMesh cho trụ.
- Nối vào đường bờ/đường phố (nếu scene có).

### 6. Vật liệu (PBR – MeshStandardMaterial / MeshPhysicalMaterial)
- Bê tông tháp/trụ: màu xám sáng, roughness ~0.85, có normal map/noise vết bê tông (tạo procedural nếu project không có texture).
- Thép dầm & cáp: sơn màu sáng (xám/trắng — đối chiếu ảnh tham khảo), metalness ~0.6–0.8, roughness ~0.4.
- Mặt đường: nhựa đường tối, roughness cao.
- Dùng chung environment map với project để phản chiếu đồng nhất.

### 7. Chiếu sáng ban đêm (điểm nhấn quan trọng)
- Hệ LED chạy dọc cáp chủ, hanger và tháp, **đổi màu theo chu kỳ** (gradient chạy dọc cầu kiểu "gió thổi ra biển", chuyển màu xanh dương – tím – hồng – xanh lá...).
- Hiện thực: emissive material + uniform `uTime` trong `onBeforeCompile` hoặc ShaderMaterial, màu thay đổi theo vị trí dọc cầu. Kết hợp với **UnrealBloomPass** (dùng lại composer của project nếu có).
- Phản chiếu ánh đèn trên mặt nước (nếu nước có reflection).
- Tích hợp vào chế độ ngày/đêm hiện có; nếu chưa có thì thêm toggle trong GUI.

### 8. Sống động (tùy chọn, bật/tắt bằng GUI)
- Xe chạy trên 4 làn (InstancedMesh hộp đơn giản có đèn pha/đèn hậu ban đêm), tốc độ khác nhau.
- Tàu thuyền nhỏ đi qua dưới nhịp chính (tĩnh không 27 m).
- Đèn báo hàng không nhấp nháy.

## Camera & tương tác
- Thêm các camera preset (chuyển mượt bằng lerp/tween): toàn cảnh từ vịnh nhìn vào, ngang mặt nước dưới nhịp chính, trên mặt cầu (góc người lái xe), góc cao thấy cả Cầu Rồng và Cầu Thuận Phước.
- Nút trong GUI: "Đến Cầu Rồng" / "Đến Cầu Thuận Phước".

## Hiệu năng
- Mục tiêu ≥ 60 FPS trên laptop tầm trung.
- InstancedMesh cho mọi thành phần lặp (hanger, kẹp cáp, cột đèn, trụ cầu dẫn, lan can, xe).
- Gộp geometry tĩnh cùng material bằng `BufferGeometryUtils.mergeGeometries`.
- LOD cho chi tiết nhỏ (lan can, bu lông, cột đèn) khi camera ở xa.
- Shadow chỉ bật cho thành phần lớn; điều chỉnh shadow camera để bao được cả hai cầu.
- Báo cáo số draw call trước/sau khi thêm cầu (`renderer.info`).

## Quy trình làm việc
1. Bước 0 (đọc project) → tóm tắt + câu hỏi về tỉ lệ/khoảng cách.
2. Dựng phần thô: tháp + dầm + cáp chủ đúng kích thước → cho tôi xem.
3. Thêm hanger, cầu dẫn, mặt đường, lan can.
4. Vật liệu PBR + chiếu sáng LED ban đêm + bloom.
5. Chi tiết sống động, camera preset, tối ưu hiệu năng.
6. Kiểm tra: chạy project, không lỗi console, Cầu Rồng vẫn hoạt động bình thường (kể cả hiệu ứng phun lửa/nước nếu có).

Sau mỗi bước, nói ngắn gọn đã làm gì và file nào thay đổi.
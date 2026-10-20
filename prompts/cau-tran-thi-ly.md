# Nhiệm vụ: Thêm mô hình Cầu Trần Thị Lý (Đà Nẵng) vào project Three.js hiện có

## Bối cảnh
Project hiện đã có **Cầu Rồng** và **Cầu Thuận Phước** dựng bằng Three.js. Tôi muốn bổ sung **Cầu Trần Thị Lý** vào CÙNG scene, chi tiết, sống động và chân thực nhất có thể. Hai cầu hiện có phải giữ nguyên hành vi và hiệu năng.

## Bước 0 — BẮT BUỘC: Đọc project trước khi viết code
1. Đọc cấu trúc thư mục, file entry, và module của **cả hai cầu đã có** (đặc biệt `bridges/thuanPhuoc/` hoặc tương đương).
2. Ghi lại cho tôi:
   - Phiên bản three.js, cách import, bundler.
   - Đơn vị/tỉ lệ (1 unit = ? m), hướng Bắc, trục đứng.
   - Vị trí & hướng của Cầu Rồng, Cầu Thuận Phước và đường sông Hàn trong scene.
   - Hệ nước, Sky, ánh sáng, shadow, post-processing (bloom), chế độ ngày/đêm, GUI, camera presets, hệ xe chạy (nếu có).
   - Các thành phần **đã dùng chung** giữa hai cầu (materials, lighting LED, traffic, InstancedMesh helper...).
3. Tóm tắt ngắn rồi mới bắt đầu. **Tái sử dụng tối đa** những gì đã có. Nếu thấy code lặp giữa 2 cầu cũ mà cầu thứ 3 cũng cần (vd: tạo cáp, lan can, cột đèn, hệ xe), đề xuất tách thành `bridges/common/` — nhưng hỏi tôi trước khi refactor code cũ.

## Kiến trúc code
- Module riêng `src/bridges/tranThiLy/`: `TranThiLyBridge.js` (class chính, trả về `THREE.Group`), `config.js`, `pylon.js`, `stayCables.js`, `deck.js`, `approaches.js`, `lighting.js`, `materials.js`.
- Mọi kích thước trong `config.js`, comment đơn vị mét; giá trị ước lượng ghi rõ `// ước lượng`.
- Cùng pattern, naming, API (`update(dt, t)`, `dispose()`) như hai cầu trước.
- Đăng ký vào cùng hệ thống quản lý cầu (nếu có), GUI, camera preset, day/night.

## Vị trí địa lý
- Cầu bắc qua **sông Hàn ở khu trung tâm**, phía **thượng lưu (Nam) Cầu Rồng** (khoảng 1–2 km), theo trục **Tây – Đông**: nối quận Hải Châu (bờ Tây) với Sơn Trà / Ngũ Hành Sơn (bờ Đông).
- Thứ tự các cầu từ cửa biển vào: Thuận Phước → (cầu sông Hàn) → Cầu Rồng → **Trần Thị Lý**. Đặt đúng tương quan này theo tỉ lệ project.
- Sát phía Bắc cầu là **cầu Nguyễn Văn Trỗi cũ** (cầu giàn thép thấp, nay dành cho đi bộ) — làm mức chi tiết thấp như một tùy chọn, bật/tắt trong GUI.
- Đầu Tây có nút giao thông nhiều tầng với hầm chui — chỉ cần mô phỏng đơn giản đường dẫn đổ xuống mặt đất; không cần dựng hầm chi tiết.

## Thông số kỹ thuật thật
| Hạng mục | Giá trị |
|---|---|
| Loại cầu | Cầu dây văng BTCT, **một tháp nghiêng**, hệ dây văng 3 mặt phẳng |
| Tổng chiều dài | 731 m, gồm 12 nhịp |
| Nhịp dây văng chính | **230 m** (phía Đông của tháp) |
| Bề rộng | 34,5 m mặt cầu (≈35,5 m tổng), **6 làn xe** + lề bộ hành 2 bên |
| Dải phân cách giữa | 5,5 m — tháp và neo dây nhịp chính nằm trên dải này |
| Tháp | BTCT, cao **145 m**, nhô **~134 m trên mặt cầu**, **nghiêng 12° về phía Tây** (ngả ngược về phía bờ Tây, ra xa nhịp chính) |
| Gối tháp | Tháp đứng trên 2 gối cầu cầu (spherical bearing) khổng lồ, mỗi gối chịu ~250.000 kN — không ngàm xuống trụ như cầu thông thường |
| Ý tưởng kiến trúc | "Cánh buồm căng gió" trên sông Hàn |
| Chiếu sáng | LED đổi màu trên tháp và mặt cầu về đêm |

## Đặc điểm cốt lõi phải làm đúng: hệ dây văng 3 mặt phẳng
Đây là điểm nhận diện số 1 của cầu — ưu tiên độ chính xác ở đây hơn mọi chi tiết khác.

1. **Mặt phẳng trước (phía Đông, nhịp chính 230 m):** một mặt phẳng dây **đơn, nằm ở tim cầu** (trên dải phân cách giữa), dạng **semi-fan (nửa rẻ quạt)**: neo phân bố dọc phần trên của tháp, tỏa xuống neo đều dọc dải phân cách của nhịp chính.
2. **Hai mặt phẳng sau (phía Tây, dây neo/backstay):** tỏa từ tháp xuống **hai mép ngoài mặt cầu** phía sau tháp, tạo thành **mặt "rẻ quạt xoắn" (twisted fan)**:
   - Dây neo **cao nhất trên tháp** neo xuống **gần tháp nhất** trên mặt cầu.
   - Dây neo **thấp nhất trên tháp** neo xuống **xa tháp nhất**, ở mép ngoài dầm.
   - Vì vậy các dây giao chéo nhau trong không gian, nhìn từ một số góc tưởng như hội tụ tại một điểm — bề mặt tạo bởi các dây gần với **mặt hyperbolic paraboloid**. Hãy tham số hóa: với i = 0..N-1, điểm neo tháp `P_tower(i)` đi từ trên xuống, điểm neo dầm `P_deck(i)` đi từ gần ra xa; dựng dây là đoạn thẳng `P_tower(i) → P_deck(i)`.
3. Số lượng dây mỗi mặt phẳng: ước lượng từ ảnh tham khảo (khoảng 15–25 dây/mặt); để trong `config.js`.
4. Dây văng là **đường thẳng** (bỏ qua độ võng), dựng bằng **InstancedMesh** cylinder: tính vị trí trung điểm, độ dài, quaternion hướng từ vector hai đầu. Có ống bảo vệ (HDPE) màu sáng ở đoạn gần neo dầm.
5. Sau khi dựng xong, chụp 3 góc (từ trên xuống, ngang từ bờ sông, dọc trục cầu) và tự kiểm tra hiệu ứng "dây xoắn" có hiện ra rõ không.

## Chi tiết mô hình từng phần

### 1. Tháp nghiêng
- Một tháp đơn trên dải phân cách giữa, nghiêng 12° về phía Tây. Tạo theo mặt phẳng nghiêng: dựng tháp thẳng đứng rồi xoay quanh trục ngang (vuông góc trục cầu) tại chân tháp.
- Hình dạng: thon dần từ chân lên đỉnh, mặt cắt dạng đa giác/vát cạnh, đường nét mềm gợi "cánh buồm". Hình dạng tiết diện chính xác không có trong số liệu — **đối chiếu ảnh tham khảo** tôi đính kèm; nếu tháp có khe hở/tách nhánh, mô phỏng theo ảnh.
- Phần chân tháp: khối đế + 2 gối cầu lớn lộ ra (chi tiết đáng chú ý của cầu).
- Hộp neo dây văng dọc thân tháp, đèn báo hàng không đỏ trên đỉnh.

### 2. Dầm & mặt cầu
- Dầm hộp BTCT rộng 34,5 m, tiết diện có cánh hẫng hai bên (`ExtrudeGeometry` từ `Shape`), mặt cầu hơi vồng dọc.
- 6 làn xe + dải phân cách giữa 5,5 m (có neo dây, đèn) + lề bộ hành hai bên, lan can.
- Vạch kẻ làn bằng `CanvasTexture`, khe co giãn modular ở hai đầu.
- Cột đèn chiếu sáng dọc cầu (InstancedMesh).

### 3. Nhịp dẫn & trụ
- Tổng 12 nhịp: ngoài nhịp dây văng chính, các nhịp còn lại là dầm BTCT trên trụ thân rộng; chia nhịp theo tổng 731 m (ước lượng hợp lý, ghi chú).
- Trụ đặt trong sông có vệt nước bám, phản chiếu trên mặt nước.
- Đầu Tây hạ dần xuống nút giao, đầu Đông nối mặt đất bờ Đông.

### 4. Vật liệu (PBR)
- Bê tông tháp/dầm: xám sáng gần trắng, roughness ~0.8, normal/noise procedural nhẹ.
- Dây văng & ống HDPE: trắng/xám nhạt, roughness ~0.5.
- Mặt đường nhựa tối; lan can thép mạ.
- Dùng chung environment map và tone mapping của project.

### 5. Chiếu sáng ban đêm
- Tháp và dây văng được chiếu sáng LED **đổi màu theo chu kỳ** (tháp có thể chuyển dần đỏ/hồng/tím/xanh — gợi "cánh buồm đỏ"), mặt cầu cũng đổi màu.
- Hiện thực bằng emissive + uniform `uTime` (cùng kỹ thuật đã dùng cho Cầu Thuận Phước nếu có — tái sử dụng), kết hợp bloom sẵn có.
- Phản chiếu đèn trên mặt nước.
- Cho phép chọn pattern trong GUI: "tĩnh", "chuyển màu chậm", "sóng màu chạy dọc dây".

### 6. Sống động (bật/tắt bằng GUI)
- Xe chạy trên 6 làn — dùng lại hệ traffic của các cầu khác nếu có.
- Người đi bộ dạng đơn giản trên lề cầu (tùy chọn, mức chi tiết thấp).
- Thuyền du lịch sông Hàn chạy qua dưới cầu, nối lộ trình với Cầu Rồng.

## Camera & tương tác
- Preset mới: "Trần Thị Lý — toàn cảnh", "dưới chân tháp nhìn lên" (thấy rõ dây xoắn), "trên mặt cầu", "góc nhìn thấy cả Cầu Rồng và Trần Thị Lý".
- Thêm nút "Đến Cầu Trần Thị Lý" vào menu chọn cầu hiện có.

## Hiệu năng
- Giữ ≥ 60 FPS với **cả ba cầu**.
- InstancedMesh cho dây văng, cột đèn, lan can, trụ, xe; merge geometry tĩnh cùng material.
- LOD hoặc ẩn chi tiết nhỏ khi camera ở xa; cân nhắc frustum-based visibility cho từng cầu khi ở rất xa.
- Kiểm tra lại shadow camera bao đủ 3 cầu (hoặc shadow theo vùng gần camera).
- Báo cáo `renderer.info` (draw calls, triangles) trước/sau.

## Quy trình làm việc
1. Bước 0 → tóm tắt + câu hỏi (tỉ lệ, vị trí, có refactor `common/` không).
2. Tháp nghiêng + dầm + trụ đúng kích thước → cho tôi xem.
3. Hệ dây văng 3 mặt phẳng → tự kiểm tra 3 góc nhìn → cho tôi xem.
4. Mặt đường, lan can, nhịp dẫn, cầu Nguyễn Văn Trỗi (tùy chọn).
5. Vật liệu, LED ban đêm, bloom.
6. Xe, thuyền, camera preset, tối ưu.
7. Chạy project: không lỗi console, Cầu Rồng và Cầu Thuận Phước vẫn hoạt động bình thường.

Sau mỗi bước, tóm tắt ngắn đã làm gì và file nào thay đổi.
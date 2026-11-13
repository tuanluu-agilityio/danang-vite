# Kiểm kê hiện trạng — sông Hàn và nhà hai bờ (2026-11-13, `main` `752ea22`)

## Dựng hình
| Phần | Cách dựng hiện tại | File |
|---|---|---|
| Mặt nước | Một tấm phẳng 40 km × 40 km ở y = 0, `Water` của three (gương phẳng: vẽ lại cả cảnh vào ảnh 512², mỗi khung ở bậc cao, thưa dần / tắt ở bậc thấp). Texture pháp tuyến 256² sinh bằng code. Vệt đèn đêm chèn vào shader (D-023). | `src/core/water.ts` |
| Bờ sông | Khối hộp gộp: đất (y = 2,5), kè đứng dày 2 m tại \|x\| = 262, dải đi bộ 24 m. Không có mái kè, bậc thềm. | `src/environment/river.ts` |
| Nhà khu phố | Khoảng 7 900 khối hộp `InstancedMesh` (lưới 36 m, chừa đường), cao 9–100 m ngẫu nhiên từ `rand()`, gom cụm 900 m, LOD: gần có cửa sổ vẽ trong shader theo tọa độ thế giới, xa (> 2 200 m) khối trơn, > 8 000 m ẩn. Không có mô hình nhập. | `src/environment/city.ts`, `src/common/shaders.ts` |
| Địa danh ven sông | Khối gộp một lưới: Novotel, Vinpearl, Trung tâm Hành chính, Chợ Hàn, Bảo tàng Chăm, 3 khách sạn, Cầu Tình Yêu. | `src/environment/riverfront/landmarks.ts` |
| Chi tiết bờ | Lan can, ghế, đèn, biển quảng cáo, băng rôn (đã có, D-012). Cây bóng mát + dừa (D-028). | `riverfront/promenade.ts`, `environment/trees.ts` |
| Ngày / đêm | Một tham số `night` 0..1 nội suy mọi thứ; không có trạng thái hoàng hôn riêng. | `src/core/dayNight.ts` |
| Thời tiết | Preset `now / summer / rain / monsoon / storm`; ghi `distortionScale`, `size`, `waterColor`, mực nước. | `src/environment/weather/` |
| Hậu kỳ | Bloom theo bậc chất lượng. | `src/core/postprocessing.ts` |

## Thiếu sót lớn nhất khi nhìn (ảnh `tests/screens/ven-song/truoc/`)
**Nước**
1. Một cỡ sóng duy nhất, lặp thành mảng tròn đều; sát camera vỡ thành ô vuông (độ lệch ảnh phản chiếu tỉ lệ 1 / khoảng cách, không có trần).
2. Màu xám sữa: công thức cộng thẳng 0,1 trắng và hệ số phản xạ nhìn thẳng 0,3 (nước thật 0,02), nên nhìn từ trên xuống không thấy màu nước.
3. Không có màu theo độ sâu, không có bọt mép kè, không có nắng lấp lánh rõ.
4. Mưa không có gợn; bão chỉ tăng độ méo, không có sóng bạc đầu.

**Nhà**
1. Mọi nhà là hộp chữ nhật trắng, mái phẳng trơn, lưới cửa sổ giống nhau, không có tầng trệt, ban công, mái, bồn nước.
2. Quá nhiều tháp 30–40 tầng xếp đều; dải Bạch Đằng / Trần Hưng Đạo thật chủ yếu nhà ống và khách sạn 4–12 tầng, xen vài tháp 20–40 tầng.
3. Mặt đất giữa các nhà là một màu xanh nhạt phẳng, không có vỉa hè, sân.
4. Ban đêm đã khá (D-023: cửa sổ sáng tối ngẫu nhiên, viền LED) nhưng mọi nhà cùng một kiểu.

## Số đo gốc (đo thật, GPU Intel Arc, ANGLE D3D11, Chromium headless, 1600 × 900, `?test&perf`)
| Góc - điều kiện | GPU ms / khung (trung vị) | Lệnh vẽ | Tam giác |
|---|---|---|---|
| tren-cao - ngày | 11,1–11,3 | 268 | 4 146 557 |
| sat-nuoc - ngày | 7,8–8,0 | 235 | 4 338 207 |
| tren-cao - đêm | 11,0–11,1 | 272 | 4 177 063 |
| doc-song - đêm | 8,2–8,6 | 230 | 4 058 747 |
| du-luon - mưa | 10,2–10,3 | 269 | 4 121 293 |

Lượt đo đầu tiên trong ngày cho 12,4 / 8,5 / 13,0 / 10,5 / 14,7 ms: số tuyệt đối trôi theo nhiệt và tải máy tới 3 ms, nên chỉ tin phép so A/B xen kẽ.
Khác: 176 program, 45 texture, 287 geometry, heap JS 111 MB; mở trang headless 90 s (phần lớn là làm nóng shader ở chế độ `?test`, không phải thời gian người dùng thật thấy; chưa đo thời gian tải thật).
Chưa đo: điện thoại thật, bộ nhớ GPU.

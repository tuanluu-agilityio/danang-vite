# Đặc tả: Tour 4 cầu — Trần Thị Lý → Rồng → sông Hàn → Thuận Phước

_Ngày: 2026-10-22 · Nhánh: `feature/tour-4-cau` · Quyết định kiến trúc: D-015_

## 1. Mục tiêu
Một hành trình camera xuyên sông Hàn, đi qua cả 4 cầu theo thứ tự từ Nam lên Bắc, có chú thích 9 ngôn ngữ và giọng đọc vi/en/ru.
Thứ tự (z, m): Trần Thị Lý +1300 → Cầu Rồng 0 → Cầu sông Hàn −1080 → Thuận Phước −2900. Quãng đường ~4,2 km.

## 2. Người dùng đã chốt
| # | Câu hỏi | Trả lời |
|---|---|---|
| 1 | Nút đặt ở đâu | Dưới thanh chọn cầu, luôn hiện (`data-view="allTour"`) |
| 2 | Hết hành trình | Đi một chiều: giữ khung hình ở Thuận Phước tới khi đọc xong, rồi trả điều khiển (orbit). Không bay ngược về |
| 3 | Độ dài | Gọn, ~4–5 phút, ~13 điểm dừng, lời mới (ngắn hơn Tour từng cầu) |
| 4 | Hầm | Nhắc một câu ở đoạn chuyển SH → TP, ghi rõ "phương án đề xuất, chưa xây". Không có điểm dừng riêng |

## 3. Hành vi
- Bấm nút → bay tới điểm 1 (`flyTo`) rồi vào chế độ `tour`, giống Tour từng cầu. Chú thích "Điểm dừng i/13".
- Tới điểm có `bridge` → bảng Thông số + danh sách góc nhìn đổi theo cầu đó (không bay camera).
- Điểm 8 (`swing: true`): Cầu sông Hàn tự quay 30×. Khi bão thì giữ hành vi D-012 (không quay, ghi chú "Tạm hoãn quay cầu").
- Sau điểm cuối: giữ khung hình `max(holdMin, clip + 1,2 s)`, rồi `exitTour()` (trả orbit, ẩn chú thích, dừng giọng).
- Kéo chuột / cuộn / Esc → thoát như Tour cũ.
- Có giọng đọc thì đoạn bay kéo dài cho đọc xong (`fitDurations`). Ngôn ngữ chưa có giọng thì chạy lặng.

## 4. Thông số (`CONFIG.tourAll`, đều là ước lượng)
- `segMax` 24 s: trần thời lượng một đoạn bay. Tour cũ là 16 s; đoạn chuyển giữa hai cầu dài 1–1,8 km.
- `holdMin` 6 s: thời gian giữ khung hình tối thiểu ở điểm cuối.

## 5. Điểm dừng (tọa độ chỉnh theo raycast của `test:tour`)
1. TTL toàn cảnh (mở đầu hành trình) · 2. TTL tháp nghiêng · 3. TTL dây văng trên mặt cầu · 4. Chuyển: dọc sông về Cầu Rồng ·
5. Rồng toàn cảnh từ phía Nam · 6. Đầu rồng · 7. Dưới bụng cầu phía Bắc · 8. SH trên trụ quay (quay cầu) · 9. SH từ phía Bắc ·
10. Chuyển qua tuyến Hầm (phương án đề xuất) · 11. TP trên cao phía Nam · 12. TP bờ Đông · 13. TP từ vịnh (kết, lời chào).

## 6. Bất biến
- Không thêm mesh, không gọi `rand()` → seed và draw call góc nhìn cũ không đổi (ngưỡng 0).
- 5 Tour cũ giữ nguyên `durs` và đường bay. Nhánh mới chỉ chạy khi `loop: false`.
- i18n: `vTourAll`, `allStops` đủ 9 ngôn ngữ; `ar` RTL.
- Không đặt điểm dừng trên hành lang hầm ở độ thấp.

## 7. Kiểm tra
- `test:tour`: thêm Tour `all` (chú thích đúng 13 điểm, y ≥ 3 m, raycast không chạm, quay cầu ở điểm 8, hết hành trình trả `orbit` và không lặp lại).
- `test:voice`: `allStops` đủ clip vi/en/ru, đọc kịp.
- `test:drawcalls`: chênh 0.

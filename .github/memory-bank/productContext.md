# Product Context

## Ai dùng, dùng để làm gì
- **Khách du lịch / người xem trên web:** xem các cây cầu, bật Tour và nghe thuyết minh bằng ngôn ngữ của mình (khách Hàn, Nhật, Trung, Thái, Nga, Ấn, Ả Rập đông ở Đà Nẵng → chọn 9 ngôn ngữ).
- **Người quan tâm kỹ thuật / quy hoạch:** bảng thông số, mặt cắt địa chất của hầm, mô phỏng quay cầu và dìm đốt hầm.

## Trải nghiệm chính
1. Chọn công trình → camera bay tới (`views/camera.ts`, `flyTo`).
2. Danh sách góc nhìn cho từng công trình (`views/presets.ts`, nút trong `index.html`).
3. Tour tự động (thuyết minh hiện có vi, en, ru): đường cong Catmull-Rom qua các điểm dừng, chú thích + thuyết minh; đoạn bay kéo dài cho tới khi đọc xong (`views/tour.ts`, `audio/narration.ts`, `public/voice/manifest.json`).
4. Ngày/đêm chuyển mượt (`core/dayNight.ts`); đèn LED, cửa sổ, bloom về đêm.
5. Mô phỏng: Cầu Rồng phun lửa/nước theo chu kỳ, Cầu sông Hàn quay (`SwingController`), dìm đốt hầm (`immersion.ts`), lái xe xuyên hầm (`hrDrive`).

## Nguyên tắc nội dung
- **Chính xác trước, đẹp sau.** Số đã công bố phải đúng và có nguồn; phần không có nguồn tự thiết kế hợp lý về kỹ thuật và ghi `(ước lượng)`.
- **Công trình chưa xây** (hầm): mọi nơi hiển thị đều nói rõ là *mô hình phương án đề xuất*.
- **Không dùng logo / thương hiệu thật** trên bảng quảng cáo hay tòa nhà; dùng thương hiệu hư cấu + thông điệp du lịch của thành phố.
- **Hợp với Đà Nẵng:** xe máy chiếm đa số lưu lượng, mùa mưa bão (tháng 9–12), gió biển, di tích (Thành Điện Hải), văn hóa Chăm.
- **Thuyết minh để máy đọc:** viết số, đơn vị, viết tắt bằng chữ để giọng TTS không vấp.

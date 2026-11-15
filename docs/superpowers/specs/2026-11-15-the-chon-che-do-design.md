# Thẻ ảnh ở màn chọn phương tiện (D-044)

_2026-11-15 · nhánh `feature/the-chon-che-do` (từ `main` `80273c9`, gộp `305b883`) · trạng thái: đã triển khai (PR #40)_

Bản yêu cầu của người dùng ("Enhancement: Visual Mode Selection Panel", 2026-11-15) bảo xem mã thật rồi làm tới cùng, không dừng ở bản đề xuất; các lựa chọn dưới đây là của agent, người dùng chưa duyệt từng mục.

## 1. Mục tiêu

Màn chọn `#chooser` hiện năm thẻ chỉ có chữ. Đổi thành thẻ ảnh để nhìn là biết mỗi chế độ khác nhau thế nào. Không dựng lại trang, không đổi luồng chọn.

**Không làm:** đổi logic di chuyển, camera, sảnh nhiều người, máy chủ; thêm thư viện; thêm khóa i18n; thêm gì vào cảnh 3D (lệnh vẽ không đổi).

## 2. Các cách đã cân nhắc

| Cách | Được | Mất |
|---|---|---|
| **A. Ảnh chụp từ chính cảnh 3D, mỗi chế độ một khung bằng camera của chế độ đó (đã chọn)** | đúng trải nghiệm thật, đồng bộ ánh sáng / màu, không vướng giấy phép, sinh lại được bằng lệnh | chất lượng bằng đồ họa của dự án, không phải ảnh điện ảnh |
| B. Ảnh chụp thật / ảnh kho | đẹp hơn | lệch với cái người chơi sẽ thấy, phải lo giấy phép + ghi công, khó đồng bộ |
| C. Ảnh do AI vẽ | đẹp, đồng bộ | agent không có công cụ tạo ảnh; ảnh hứa điều trang không có |

Người dùng có ảnh riêng thì thay tệp trong `public/chooser/` (giữ tên, tỉ lệ 4:5; `guided` 3:1), không phải sửa mã.

## 3. Thiết kế

- **Ảnh:** `public/chooser/{glider,car,bike,walk}.webp` 720 × 900 và `guided.webp` 1440 × 480, tổng ≈ 295 kB (trần 150 kB mỗi ảnh, script cảnh báo khi vượt). Sinh bằng `npm run gen:chooser` (`scripts/chooser/shots.mjs`): Chromium của Playwright trên GPU thật, mở `?explore=…&test`, đặt người / xe trên Cầu Rồng, xoay camera bằng kéo chuột, ẩn giao diện, chụp 2× rồi thu nhỏ, nén WebP bằng canvas. Xe AI chạy ngẫu nhiên nên mỗi lượt chụp khác nhau đôi chút; xem ảnh trước khi commit.
- **Thẻ:** vẫn là `button.ex-card[data-pick]` với `<b>` + `<span>` cũ (test cũ đọc `data-pick`, `textContent`, `disabled` không đổi); thêm `<img class="ex-img" loading="lazy" alt="">`. Chữ nằm trên dải tối ở đáy ảnh. Máy tính: bốn thẻ 4:5 một hàng + thẻ Tham quan có hướng dẫn thành dải ngang; hộp rộng tối đa 980 px. Điện thoại dọc (`body.compact`): 2 × 2 thẻ vuông + dải; nằm ngang: năm thẻ một hàng.
- **Trạng thái:** rê chuột (chỉ `hover:hover`) ảnh phóng 1,07, thẻ nhấc 3 px, viền vàng; focus bàn phím viền trắng ngà; thẻ vừa bấm có lớp `.sel` + `aria-pressed` (viền vàng đậm, tên vàng), còn nguyên khi bấm Quay lại từ sảnh; thẻ Dù lượn bị khóa trên máy cảm ứng thì ảnh xám. `prefers-reduced-motion` tắt chuyển động.
- **Sảnh:** `#chooser[data-mode]` + biến `--ex-hero` (do `chooser.ts` đặt lúc bấm) cho ảnh của chế độ vừa chọn đứng thành cột bên đầu dòng của sảnh trên máy tính; hộp sảnh hẹp lại 720 px như trước. Điện thoại không hiện ảnh ở sảnh.
- **Tải:** ảnh nạp lười; vào thẳng `?explore=…` không tải ảnh nào. Ảnh chưa xong thì trong suốt (`.ld`) rồi hiện dần; ảnh lỗi thì thẻ còn nền tối + chữ, vẫn bấm được.

## 4. Kiểm

Xem mục D-044 ở `.github/memory-bank/activeContext.md` (đã chạy / chưa chạy).

---
description: Reviewer — soát thay đổi theo bất biến của dự án, chỉ báo lỗi có căn cứ
---

# Vai trò: Reviewer

Soát `git diff` (hoặc PR) theo thứ tự ưu tiên. Mỗi phát hiện: `file:dòng`, vì sao sai, kịch bản hỏng cụ thể. Không báo chuyện phong cách vụn vặt.

1. **Seed:** có thêm/bớt/đổi thứ tự lời gọi `rand()` hoặc `build*()` trong `main.ts`/`environment/`/`bridges/dragon/` không? Code mới dựng trước `new HanTunnel()` mà có dùng `rand` không?
2. **Draw call:** mesh mới có gộp/instancing/LOD chưa? Có vật chi tiết nhỏ nào còn ở layer 0 (bị vẽ thêm trong lượt phản chiếu)?
3. **Dispose / rò rỉ:** geometry, material, `CanvasTexture` mới có được giải phóng? Bật/tắt chế độ có trả vật liệu chung về đúng trạng thái gốc?
4. **Config:** có số đo hard-code ngoài `config.ts`? Dòng config mới có đơn vị, `(ước lượng)`/nguồn?
5. **i18n:** khóa mới có ở đủ 9 locales? `*Stops` khớp số điểm dừng? `ar` RTL?
6. **Ngày/đêm:** dùng `shared.uNight`, không thêm đèn động.
7. **Nội dung:** công trình chưa xây có ghi "phương án đề xuất"? Không logo/thương hiệu thật.
8. **Test & tài liệu:** có test cho ràng buộc mới? README, `tests/KET-QUA.md`, memory bank đã cập nhật?

Kết luận: danh sách lỗi (nặng → nhẹ) + test nào cần chạy lại.

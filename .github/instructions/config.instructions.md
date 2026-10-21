---
applyTo: "src/config.ts"
description: Quy ước cho file thông số CONFIG
---

# `src/config.ts`

- Mỗi công trình một khối `xxBase` có tiêu đề comment `/* ---- Tên công trình ---- */` + vài dòng mô tả vị trí.
- Thông số phụ thuộc nhau → hàm `deriveXx(C)` trả `{ ...C, <giá trị dẫn xuất> }`; export trong `CONFIG` và kiểu `XxConfig = typeof CONFIG.xx` nếu nơi khác cần.
- **Mỗi dòng:** `// m — ý nghĩa` (đơn vị trước, ý nghĩa sau). Không có nguồn → thêm `(ước lượng)`. Có nguồn công bố → ghi tên nguồn/ngày ở comment đầu khối.
- Không đổi giá trị của khối đã có trừ khi nhiệm vụ yêu cầu: các giá trị cũ ảnh hưởng tới draw call và test.
- Khối mới đặt **trước** `export const CONFIG`, giữ thứ tự các khóa trong `CONFIG` (công trình mới thêm cuối).

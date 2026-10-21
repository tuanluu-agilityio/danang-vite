---
applyTo: "src/bridges/**"
description: Cấu trúc và quy ước cho thư mục công trình (cầu, hầm)
---

# Công trình trong `src/bridges/<ten>/`

Theo đúng mẫu `song-han/`, `thuan-phuoc/`, `tran-thi-ly/`, `han-tunnel/` (Cầu Rồng `dragon/` là dạng hàm rời cũ, không lấy làm mẫu).

| File | Quy tắc |
|---|---|
| `index.ts` | Chỉ re-export |
| `profile.ts` | Hằng số dẫn xuất + hàm hình học thuần (vd. `shRoadY(x)`, `hrRoadY(x)`); dùng được trong `views/presets.ts` và test |
| `materials.ts` | `xxMaterials()`; có `concrete`, `steel`, `textures[]` |
| `<Ten>.ts` | `extends BridgeBase<XxMaterials>`; constructor: `super(name, prefix, z, center, lod)` → `mats` → các `xxBuild*(this)` → `this.finalize()` |
| `life.ts` | Xe/thuyền/người trong `this.life`, cập nhật khi `updateLod()` trả `true` |

- Tiền tố hàm/tên mesh theo `prefix` của công trình (`sh-`, `tp-`, `ttl-`, `hr-`).
- `update(dt, elapsed, cam)` luôn gọi `this.updateLod(cam)` trước.
- Dọn nhà/cây trên tuyến: sau khi dựng, scale 0 instance (mẫu `han-tunnel/corridor.ts`); **không** sửa `environment/city.ts`.
- Trạng thái mô phỏng (quay cầu, dìm hầm) làm thành máy trạng thái riêng (`SwingController`, `immersion.ts`) có trạng thái tên rõ ràng, và trả mọi thứ về nguyên trạng khi kết thúc.
- Thay đổi hình học có ràng buộc kỹ thuật (độ dốc, tĩnh không, độ sâu) → thêm kiểm tra vào test của công trình.

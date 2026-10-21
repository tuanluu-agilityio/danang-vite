---
applyTo: "src/ui/**,src/views/**,index.html,src/styles/**"
description: Quy ước giao diện, góc nhìn và Tour
---

# UI, góc nhìn, Tour

- **Góc nhìn** là dữ liệu trong `views/presets.ts` (`VIEWS`): `{ pos, target, maxPolar? }`, tọa độ thế giới. Góc thấp sát nước/ngước lên cần `maxPolar` (≤ `Math.PI * 0.97`). Cao độ trên mặt cầu dùng hàm `profile.ts` (vd. `shRoadY`).
- Mỗi góc nhìn mới: nút trong `.view-list[data-list="<công trình>"]` của `index.html` + khóa `v<Tên>` ở 9 locales + thêm vào danh sách đo của `tests/drawcalls.mjs` nếu là góc chính.
- **Tour:** điểm dừng trong `views/tourStops.ts` (cờ `swing`, `immerse`, `cutaway`, `interior`); đường bay không được xuyên mặt cầu/tháp/nhà. Lời và tiêu đề ở locales (`<prefix>Stops`), thuyết minh ở `scripts/narration`.
- **Điều khiển:** dùng `toggle(id, fn)` và `selectBridge` của `ui/panel.ts`; UI riêng công trình đặt trong `ui/<prefix>UI.ts` và nối trong `setupUI.ts`. Chữ hiển thị luôn qua `t()`, cập nhật lại khi đổi ngôn ngữ (`onChange`).
- Nhãn 3D bằng `div` định vị theo camera (mẫu `ui/hrUI.ts`), không dùng sprite chữ.
- Kiểm tra RTL (`ar`) khi thêm khối giao diện mới.

# Nâng cấp độ chân thực sông Hàn và nhà hai bờ — thiết kế

_Trạng thái: M1 (nước) đã làm, chờ người dùng duyệt bằng mắt. M2–M4 chưa làm. Cập nhật 2026-11-13._
_Bộ nhớ của việc này: [docs/ai/PROJECT_STATE.md](../../ai/PROJECT_STATE.md). Plan: [2026-11-13-ven-song-chan-thuc.md](../plans/2026-11-13-ven-song-chan-thuc.md)._

## 1. Ý định
Người dùng giao một bản yêu cầu tiếng Anh ("Da Nang Riverside Realism Upgrade", 2026-11-13) với đúng hai mục tiêu: mặt nước sông Hàn trông như sông thật, và nhà hai bờ trông như phố Việt Nam ven biển thay vì khối hộp. Yêu cầu tự làm tới cùng, không hỏi quyết định nhỏ, làm qua nhiều phiên và phải tiếp tục được chỉ từ file trong repo.

## 2. Mục tiêu, ngoài phạm vi
**Mục tiêu**
- Nước: sóng nhiều lớp, Fresnel, màu theo độ sâu, phản chiếu trời / nhà / cầu / đèn đêm, nắng lấp lánh; ngày, hoàng hôn, đêm, mưa (gợn, nhám), bão (sóng mạnh, tối).
- Nhà: thư viện 5 họ (khách sạn kính, chung cư, thương mại, văn phòng, nhà ống thấp tầng) dựng bằng Blender, xuất GLB; mặt đứng, ban công, mái, tầng trệt; cửa sổ đêm sáng tối khác nhau; LOD ba mức.
- Chi tiết bờ: chỉ bổ sung quanh dải ven sông đang có.
- Bộ nhớ dự án ở `docs/ai/` + memory bank.

**Ngoài phạm vi**: dựng lại bốn cầu, hầm, camera, dù lượn, xe cộ, tàu thuyền, giao diện, bộ dựng hình; đổi địa lý sông; thêm thư viện runtime.

**Coi là thất bại dù chạy được**: nước như bể bơi / gương phẳng / biển sóng lớn; skyline kiểu quốc tế chung chung; đổi vị trí nhà làm lệch va chạm Đi dạo / Lái xe, biển quảng cáo, dọn nhà; chuỗi `rand()` đổi.

## 3. Ràng buộc của dự án (từ `copilot-instructions.md` §3)
- Chuỗi `rand()` và thứ tự `build*()` giữ nguyên; ngẫu nhiên mới dùng `rng(seed)` hoặc băm chỉ số.
- Lệnh vẽ: **trần của tính năng này** là +0 ở 5 góc chuẩn của `tests/KET-QUA.md` cho M1; M2–M3 được +0 ở góc không thấy nhà ven sông và tối đa +6 ở góc thấy (để có lưới chi tiết mái / tầng trệt riêng nếu gộp một lưới không đủ). Vượt thì phải sửa spec trước.
- Thời gian khung GPU: lệch không quá khoảng 10 % so với `main` cùng máy, cùng cảnh, đo A/B xen kẽ bằng `tests/ven-song-shots.mjs`.
- Mọi thông số ở `src/config.ts` (`CONFIG.water`, sau này `CONFIG.buildings`). Không thêm `PointLight` / `SpotLight`.
- Mô hình ngoài theo D-033: ở đây mô hình do script của repo sinh ra (không có bên thứ ba), vẫn ghi trong README và có test trần dung lượng / tam giác, có đường lùi về khối hộp khi tải lỗi.
- Trần tài nguyên nhà: mỗi họ ≤ 600 tam giác (gần), ≤ 60 (vừa); tổng GLB ≤ 1,5 MB.

## 4. Các cách đã cân nhắc
**Nước** (chi tiết ở `docs/ai/DECISIONS.md` D-036)
1. *Giữ gương phẳng, viết lại fragment shader* — đã chọn: phản chiếu đúng mọi vật đang có, không thêm lệnh vẽ, không đụng các chỗ đang ghi uniform.
2. Phản chiếu không gian màn hình: mất nhà cao ngoài khung, cần lượt độ sâu và hậu kỳ mới.
3. Lưới nước dịch đỉnh: tốn tam giác, sông lặng gần như không thấy, hở mép kè.

**Nhà** (D-037, đề xuất, chốt ở M2)
1. *Giữ instance của `buildCity()`, thay geometry theo họ, co giãn riêng phần thân trong shader đỉnh, gộp họ bằng `aPart`* — đề xuất: không đổi `rand()`, va chạm và biển quảng cáo giữ nguyên, lệnh vẽ +0.
2. Đặt GLB từng tòa như vật riêng: đẹp nhất từng tòa nhưng hàng nghìn lệnh vẽ, và phải viết lại va chạm.
3. Chỉ vẽ lại mặt đứng bằng shader trên khối hộp: rẻ nhất nhưng vẫn là hộp, không đạt yêu cầu "không còn là khối nguyên thủy".

Người dùng giao phần "làm thế nào" cho agent (bản yêu cầu mục 10), nên các lựa chọn trên là quyết định của agent, không phải điều người dùng đã chọn.

## 5. Thiết kế M1 — nước (đã làm)
- `src/core/waterShader.ts`: fragment shader thay cho của `Water.js`. Bốn lớp sóng (bước 173 / 61 / 23 / 7,3 m), hai lớp nhỏ mờ dần theo khoảng cách; "luồng gió" tần số thấp làm chỗ lặng chỗ gợn; biên độ nhân `distortionScale / 2,4` nên thời tiết hiện có vẫn điều khiển sóng.
- Ảnh phản chiếu: lệch theo độ dốc sóng dài (gợn nhỏ góp 20 %), kéo dài theo chiều đứng × 2,6, có trần gần camera; vệt đèn đêm D-023 chép nguyên.
- Fresnel F0 = 0,02. Màu nước = `waterColor` (do ngày / đêm và thời tiết ghi) × hệ số nông / sâu theo khoảng cách tới kè, ngả xám 30 %.
- Nắng: đốm sắc + quầng rộng, tắt về đêm và khi mưa. Mưa: hai lớp vòng gợn theo ô lưới, mặt nhám, phản chiếu ×0,75. Bão: `uStorm` làm nước tối, sóng bạc đầu. Bọt mép kè 1,6 m.
- `src/core/water.ts`: gương 1024 × 512; texture pháp tuyến 512² có mipmap; `waterFx`.
- `weather/atmosphere.ts`: ghi `waterFx.uRain`, `uStorm`, trả 0 khi về `now`.
- Thông số: `CONFIG.water`.

## 6. Thiết kế M2–M4 (chưa làm; builder được quyền chỉnh chi tiết, ghi vào `DECISIONS.md`)
- M2: `blender/scripts/build_building_library.py` sinh 5 họ nhà (đế / thân / mái tách đoạn, UV, vertex color cho vật liệu), `export_assets.py` xuất `public/buildings/library.glb`; `src/environment/buildings/` nạp bằng `GLTFLoader`, thay geometry cho một cụm ven sông bờ Tây quanh Cầu Rồng; lùi về hộp khi tải lỗi / quá giờ / `?buildings=off`.
- M3: cả hai bờ; LOD gần (mô hình) / vừa (hộp có cửa sổ shader hiện tại) / xa (khối trơn hiện tại); phân bố họ theo khoảng cách tới sông và chiều cao sẵn có; chi tiết kè; vệt sóng tàu; sắc hoàng hôn nếu phạm vi cho phép.
- M4: đủ bộ test, `KET-QUA.md`, điện thoại.

## 7. Tiêu chí nghiệm thu
- M1: ảnh trước / sau cùng góc ở ngày, đêm, mưa, bão; 0 lỗi console; lệnh vẽ +0; GPU ≤ +10 % (A/B); `test:weather` đạt; người dùng duyệt bằng mắt.
- M2: như trên cho cụm nhà mẫu; trần tam giác / dung lượng có test đơn vị; va chạm Đi dạo / Lái xe không đổi (`test:stroll:unit`, `test:drive:unit`).
- M3–M4: đủ bộ test của `copilot-instructions.md` §5 chạy một lần cuối nhánh.

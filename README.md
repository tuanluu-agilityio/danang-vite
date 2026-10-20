# Các cây cầu Đà Nẵng 3D — Vite + TypeScript

Chuyển từ một file `index (2).html` (~4 600 dòng) sang Vite + TypeScript, không dùng framework UI. Mọi tính năng giữ nguyên.
Ngoài bốn cây cầu còn có **Hầm vượt sông Hàn** (phương án đề xuất 2025, chưa xây) — xem mục [Hầm vượt sông Hàn](#hầm-vượt-sông-hàn).
Ngoài bốn cây cầu còn có **Hầm vượt sông Hàn** (phương án đề xuất 2025, chưa xây) — xem mục [Hầm vượt sông Hàn](#hầm-vượt-sông-hàn).

## Chạy

```bash
npm install
npm run dev        # máy chủ phát triển
npm run build      # tsc --noEmit + vite build → dist/
npm run preview    # xem bản build
```

Thêm `?test` vào URL để lộ `window.__app` (renderer, scene, camera, cam, dayNight, tours…) cho script kiểm tra.

## Kiểm tra

Cần Chromium cho Playwright (`npx playwright install chromium` nếu máy chưa có).

```bash
npm run build
npm run test:drawcalls -- [thư-mục-bản-gốc]   # draw call ở 18 góc nhìn × ngày/đêm
npm run test:tour      -- [thư-mục-bản-gốc]   # 5 Tour: chú thích, đường bay, quay cầu sông Hàn, mặt cắt + mô phỏng dìm của hầm
npm run test:tunnel                           # hầm: trắc dọc, mặt cắt bật/tắt, mắt thích nghi, mô phỏng dìm, ảnh chụp vào tests/screens/
```

`tests/original/index.html` là file gốc chỉ sửa hai chỗ: link three từ CDN đổi sang `/three/…` (server kiểm tra lấy từ `node_modules/three`) và thêm móc `?test`. Truyền `tests/original` làm tham số để so sánh hai bản với nhau. Trình duyệt kiểm tra dựng hình bằng CPU (SwiftShader) nên mỗi script chạy khoảng 10–20 phút.

## Cấu trúc

```
src/
  main.ts            thứ tự dựng cảnh + vòng lặp
  config.ts          thông số các cầu
  core/              renderer, scene, camera, controls, bloom, trời/nước, đèn, uniform dùng chung, ngày/đêm
  common/            texture làn đường, loft, boxAt, beamBetween, cột đèn, bảng màu LED, xe cộ, thuyền, người, BridgeBase
  bridges/
    dragon/          Cầu Rồng (mặt cầu, thân, đầu, lửa/nước)
    thuan-phuoc/     Cầu Thuận Phước
    tran-thi-ly/     Cầu Trần Thị Lý
    song-han/        Cầu sông Hàn + SwingController
    han-tunnel/      Hầm vượt sông Hàn (vỏ hầm, nội thất, máng hầm hở, cửa hầm, đáy sông, mặt cắt, mô phỏng dìm)
  environment/       sông Hàn, núi, đường phố, thành phố, cây, giao thông
  views/             góc nhìn có sẵn, flyTo, Tour (đường cong + điểm dừng)
  audio/             nhạc, còi, tiếng xe; narration.ts phát giọng thuyết trình của Tour
  ui/                bảng điều khiển, nút quay cầu, âm thanh
  i18n/              index.ts + locales/{vi,en,ko,ja,zh,th,ar,hi,ru}.json
  styles/main.css
```

## Hầm vượt sông Hàn

Mô hình phương án đề xuất 2025 (Sở Xây dựng Đà Nẵng): tuyến thẳng Đống Đa – Trần Phú → Vân Đồn – Trần Hưng Đạo, ≈ 1.670 m = hầm dìm qua sông 600 m (5 đốt × 120 m) + hầm kín trên bờ 380 m + hầm hở 415 m, 6 làn, 60 km/h, 6.880 tỷ đồng, đầu tư dự kiến 2031–2045. Kế hoạch triển khai chi tiết nằm ở [prompts/ham-vuot-song-han.md](prompts/ham-vuot-song-han.md).
Chiều dài từng đoạn, số làn, tốc độ, độ dốc tham khảo và tổng mức là số đã công bố; **mặt cắt ngang, độ sâu, đáy sông, kiến trúc cửa hầm, thiết bị là ước lượng** (ghi trong `CONFIG.hanTunnel`, `src/config.ts`).

- Trắc dọc `hrRoadY(x)` (đối xứng qua tim sông): đường gãy khúc bo parabol, dốc ≤ 2% dưới sông, ≤ 3,5% hầm kín bờ, ≤ 4,5% hầm hở; nóc hầm dìm thấp hơn đáy sông ≥ 1 m; gờ chắn ngập ở đỉnh dốc cao hơn mặt phố 1 m. `npm run test:tunnel` kiểm tra các ràng buộc này.
- Xe: mỗi chiều 2 làn ô tô + 1 làn xe máy sơn đất nung sát lề phải (xe máy chiếm đa số lưu lượng ở Đà Nẵng).
- Vỏ hầm và nội thất (`underground`) chỉ vẽ khi camera ở trong hầm, bật **Mặt cắt địa chất** hoặc đang **mô phỏng dìm đốt hầm**; từ trên mặt đất thấy máng hầm hở, mái lam, cửa hầm Tây (gợi tường thành Điện Hải) và Đông (gợi sóng biển, thuyền thúng), gờ chắn ngập + cửa phai, khung giới hạn 4,5 m.
- Mặt cắt địa chất: `clippingPlanes` + `clipIntersection` bóc dải đất phía Bắc mặt cắt dọc ống Nam; nước dùng `discard` trong shader (cũng khoét hai máng hầm hở); tấm địa chất vẽ bằng canvas; nhãn 3D là các `div` (`ui/hrUI.ts`). Tắt là trả mọi vật liệu về nguyên trạng.
- Mô phỏng dìm đốt hầm (`immersion.ts`): FLOAT_IN → POSITION → BALLAST → PULL_JOINT → BACKFILL → DONE. Trong lúc chạy, đường hầm đóng, thuyền tránh vùng thi công (`boatKeepOut`).
- Lái xe xuyên hầm (`hrDrive`): độ phơi sáng giảm còn 70% trong hầm rồi trả về giá trị gốc khi ra.
- Nhà, cây, cột đèn nằm trên hành lang tuyến được **thu nhỏ về 0 sau khi cảnh đã dựng** (`corridor.ts`), nên chuỗi `rand()` của khu phố không đổi. Hầm phải dựng sau mọi lệnh dùng `rand` trong `main.ts`.
- i18n: các khóa `hr*`, `vHr*`, `im_*`, `hrStops` có đủ 9 ngôn ngữ; thuyết minh `hrStops` có tiếng Việt và tiếng Anh (`scripts/narration`).

Ghi chú:
- Bộ sinh số ngẫu nhiên có seed nên `main.ts` giữ đúng thứ tự dựng như bản gốc; đổi thứ tự sẽ làm vị trí nhà, cây, xe thay đổi.
- Giai đoạn 1 để `strict: false` trong `tsconfig.json`; có thể bật dần `strict` theo từng thư mục.

## Giọng thuyết trình của Tour (vi, en)

Mỗi điểm dừng của Tour có một clip mp3 trong `public/voice/<ngôn ngữ>/<khóa>-<i>.mp3`; `public/voice/manifest.json` ghi thời lượng từng clip để Tour kéo dài đoạn bay cho tới khi đọc xong. Ngôn ngữ chưa có clip thì Tour chạy lặng và nút **Thuyết minh** bị khóa.

- Lời thoại nằm ở `scripts/narration/{vi,en}.json` (theo đúng khóa và thứ tự điểm dừng trong `i18n/locales`). Viết số, đơn vị, từ viết tắt bằng chữ để giọng đọc không vấp.
- Sửa lời thoại hoặc thêm điểm dừng: `npm run gen:voice` chỉ tạo lại clip đã đổi (`-- --force` để tạo lại tất cả), rồi commit `public/voice/`.
- Giọng đọc lấy từ dịch vụ đọc văn bản của Microsoft Edge qua gói `msedge-tts` (không cần tài khoản, nhưng là dịch vụ không chính thức nên có thể đổi hoặc bị giới hạn; clip đã tạo vẫn dùng được bình thường). Giọng: `vi-VN-HoaiMyNeural`, `en-US-AriaNeural` (đổi trong `scripts/gen-narration.mjs`).
- Thêm ngôn ngữ thứ ba: tạo `scripts/narration/<mã>.json`, thêm giọng vào `VOICES` trong script, chạy lại `npm run gen:voice`.
- Kiểm tra: `npm run build && npm run test:voice` (cần Chromium của Playwright, hoặc đặt `CHROMIUM_PATH` tới Chrome/Edge).

# Các cây cầu Đà Nẵng 3D — Vite + TypeScript

Chuyển từ một file `index (2).html` (~4 600 dòng) sang Vite + TypeScript, không dùng framework UI. Mọi tính năng giữ nguyên.

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
npm run test:tour      -- [thư-mục-bản-gốc]   # 4 Tour: chú thích, đường bay, quay cầu sông Hàn
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
  environment/       sông Hàn, núi, đường phố, thành phố, cây, giao thông
  views/             góc nhìn có sẵn, flyTo, Tour (đường cong + điểm dừng)
  audio/             nhạc, còi, tiếng xe
  ui/                bảng điều khiển, nút quay cầu, âm thanh
  i18n/              index.ts + locales/{vi,en,ko,ja,zh,th,ar,hi}.json
  styles/main.css
```

Ghi chú:
- Bộ sinh số ngẫu nhiên có seed nên `main.ts` giữ đúng thứ tự dựng như bản gốc; đổi thứ tự sẽ làm vị trí nhà, cây, xe thay đổi.
- Giai đoạn 1 để `strict: false` trong `tsconfig.json`; có thể bật dần `strict` theo từng thư mục.

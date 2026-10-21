# System Patterns

## Kiến trúc tổng thể

```
main.ts ── thứ tự dựng cố định (seed!) ──► scene
  ├─ core/         renderer, camera, controls, bloom, trời, nước, đèn, shared uniforms (uTime, uNight), dayNight
  ├─ common/       hình học (boxAt, loft, beamBetween…), shaders (patchWindows), texture canvas, BridgeBase, xe/thuyền/người
  ├─ environment/  sông, núi, phố, nhà (city.ts), cây, giao thông; riverfront/ (địa danh, LED, quảng cáo, bờ)
  ├─ bridges/<x>/  mỗi công trình một thư mục, một lớp kế thừa BridgeBase (trừ dragon: hàm rời, có trước BridgeBase)
  ├─ views/        presets (dữ liệu góc nhìn), tourStops (dữ liệu Tour), tour, camera, state
  ├─ audio/        nhạc, tiếng xe/còi, narration
  ├─ ui/           panel, setupUI + UI riêng từng công trình (swingUI, hrUI)
  └─ i18n/         t(), stops(), 9 file locales JSON
vòng animate(): shared.uTime → dayNight → cập nhật hiệu ứng/giao thông/camera → bridge.update(dt, t, camera) → renderFrame
```

## Mẫu: một công trình mới (`src/bridges/<ten>/`)
| File | Vai trò |
|---|---|
| `index.ts` | Chỉ re-export: lớp, `XX` (profile), hàm cao độ (vd. `shRoadY`) |
| `profile.ts` | Hằng số dẫn xuất từ `CONFIG.<ten>` + hàm hình học thuần (trắc dọc, cao độ) — **không** import three scene |
| `materials.ts` | `xxMaterials()` trả về object kế thừa `BridgeMaterials` (bắt buộc `concrete`, `steel`; `textures[]` để dispose) |
| `<Ten>Bridge.ts` | `class extends BridgeBase<XxMaterials>`: constructor gọi lần lượt `xxBuild*(this)`, cuối cùng `this.finalize()`; `update()` gọi `updateLod()` |
| `life.ts` | Xe/thuyền/người riêng của công trình, đặt trong `this.life` |
| các phần khác | Mỗi bộ phận một file, hàm `xxBuildPhan(b: BridgeBase)` đẩy hình học vào `b.concreteParts`/`b.steelParts` hoặc thêm mesh vào `b.group`/`b.details` |

Tích hợp: khối `xxBase` + `deriveXx()` trong `config.ts` → `new` trong `main.ts` (sau mọi `rand`) → thêm vào mảng `bridges` → `setupUI` → `VIEWS` + nút `index.html` → Tour trong `tourStops.ts` + khóa i18n → narration → test.

## Mẫu: phần cảnh không phải công trình (`environment/riverfront/`)
Không kế thừa `BridgeBase`: module `index.ts` giữ một đối tượng `current`, export `buildX()` / `updateX(dt, time)` / các hàm bật-tắt (`setHeartsEnabled`, `setHeartsMode`, `setAdsEnabled`) / `disposeX()`. Gọi `buildX()` trong `main.ts` sau mọi `rand`, `updateX()` trong `animate()`, thêm vào `window.__app`.

## Mẫu hiệu năng
- `BridgeBase.finalize()` gộp bê tông + thép thành 2 mesh; `details` (LOD) ẩn khi xa hơn `lodDistance`; `farHide` ẩn khi rất xa.
- Chi tiết nhỏ, xe, người: layer 1 → không vẽ trong lượt phản chiếu mặt nước.
- Vật lặp lại → `InstancedMesh`. Ẩn instance = ma trận scale 0 (không xóa, để giữ chỉ số).
- Vật liệu dùng chung ở `core/materials.ts` (`MAT`); `dispose()` không giải phóng vật liệu dùng chung.

## Mẫu ngày/đêm và hiệu ứng
- Đọc `shared.uNight` (0 → 1) trong shader hoặc `update()`; không tự giữ trạng thái ngày/đêm riêng.
- Đèn: emissive + bloom (`core/postprocessing.ts`). Không thêm đèn động mới.
- Cửa sổ sáng: `patchWindows` (`common/shaders.ts`).

## Mẫu dữ liệu tách khỏi code
- Góc nhìn: `views/presets.ts` (`VIEWS`, tọa độ thế giới). Điểm dừng Tour: `views/tourStops.ts`. Tên/lời Tour: khóa trong locales, **đúng thứ tự** với mảng điểm dừng.
- Cờ điểm dừng: `swing`, `immerse`, `cutaway`, `interior`.

## Mẫu kiểm thử
- `?test` → `window.__app` (renderer, scene, camera, cam, songHan, hr, tours, narration…). Thêm đối tượng mới vào `__app` khi cần kiểm.
- `tests/lib.mjs`: `serveDir`, `launch` (SwiftShader), `openApp`, `frames`, `waitFlight`. Test đọc `dist/` → build trước.
- Mỗi test gom lỗi vào `problems[]` + kiểm tra console sạch, in kết quả tiếng Việt.

## Cạm bẫy đã biết
- Thêm/bớt một lời gọi `rand()` ở bất cứ đâu trước cuối chuỗi dựng → toàn bộ nhà/cây/xe xê dịch, draw call lệch bảng chuẩn.
- `city.ts`: không sửa `avoid()` hay vòng `place()`; nhà nằm trong `InstancedMesh` thuộc `THREE.LOD` (`near` + `far`).
- `OrbitControls` không cho camera thấp hơn điểm nhìn → góc nhìn sát nước cần `maxPolar` (tới `Math.PI * 0.97`).
- Mặt cắt địa chất của hầm sửa `clippingPlanes`/`transparent`/`depthWrite` của vật liệu chung → tắt phải trả **đúng** giá trị gốc (test:tunnel kiểm).
- Chữ trên mặt LED / bảng: kiểm tra không bị lật gương theo hướng mặt.

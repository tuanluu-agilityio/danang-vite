import * as THREE from 'three';
import { CONFIG } from '../../config';
import { lerp, clamp } from '../../common/math';

/* [config] Cầu Trần Thị Lý: cao độ mặt đường, tiết diện và trục tháp nghiêng. Thông số ở CONFIG.tranThiLy */
export const TTL = CONFIG.tranThiLy;
export const ttlPattern = { value: 2 };   // pattern LED: 0 tĩnh, 1 chuyển màu chậm, 2 sóng màu chạy dọc dây

/* Cao độ mặt đường: đường cong Catmull-Rom qua các điểm roadProfile, tra bảng cho nhanh */
let ttlLut: number[][] = null;
export function ttlRoadY(x: number) {
  const P = TTL.roadProfile;
  if (x <= P[0][0] || x >= P[P.length - 1][0]) return CONFIG.roadY;
  if (!ttlLut) {
    const c = new THREE.CatmullRomCurve3(P.map(([a, b]) => new THREE.Vector3(a, b, 0)), false, 'centripetal');
    ttlLut = c.getPoints(4000).map((v) => [v.x, v.y]).sort((a, b) => a[0] - b[0]);
  }
  let lo = 0, hi = ttlLut.length - 1;
  while (hi - lo > 1) { const mid = (lo + hi) >> 1; if (ttlLut[mid][0] < x) lo = mid; else hi = mid; }
  const [x0, y0] = ttlLut[lo], [x1, y1] = ttlLut[hi];
  return Math.max(CONFIG.roadY, lerp(y0, y1, (x - x0) / Math.max(1e-6, x1 - x0)));
}
/* Tiết diện tháp theo t (0 = chân, 1 = đỉnh), trong hệ tọa độ trục tháp: mép sau (phía Tây) gần thẳng,
   mép trước cong căng như cánh buồm. Ước lượng — sẽ chỉnh theo ảnh tham khảo. */
export function ttlPylonSection(t: number) {
  const Lx = TTL.pylonLen[1] + (TTL.pylonLen[0] - TTL.pylonLen[1]) * Math.pow(1 - t, 1.4) + 2.4 * Math.sin(Math.PI * t) * (1 - t);
  const Wz = lerp(TTL.pylonWid[0], TTL.pylonWid[1], t);
  const back = -4 + 2 * t;
  return { Lx, Wz, back, front: back + Lx };
}
/* Ma trận dựng tháp: dựng thẳng rồi xoay quanh trục ngang (Z) tại chân tháp, nghiêng về phía Tây (−X) */
export const ttlPylonMatrix = new THREE.Matrix4()
  .makeTranslation(TTL.pylonX, TTL.pylonBaseY, 0)
  .multiply(new THREE.Matrix4().makeRotationZ(TTL.lean));
export function ttlPylonPoint(t: number, lx: number, lz: number, out = new THREE.Vector3()) {
  return out.set(lx, t * TTL.axisLen, lz).applyMatrix4(ttlPylonMatrix);
}
/* Cao độ cầu Nguyễn Văn Trỗi cũ (đi bộ) */
export function nvtY(x: number) {
  const ax = Math.abs(x), B = CONFIG.bankX;
  return ax <= B ? TTL.nvtDeckY : lerp(TTL.nvtDeckY, CONFIG.landY + 0.1, clamp((ax - B) / 26, 0, 1));
}

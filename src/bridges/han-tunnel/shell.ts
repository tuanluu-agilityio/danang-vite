import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { prepColored, bentBox } from '../../common/geometry';
import { smooth, clamp } from '../../common/math';
import { HR, hrRoadY } from './profile';

/* [shell] Vỏ hầm: tiết diện hai ống xe + hành lang thoát nạn, đùn dọc trục X rồi uốn theo trắc dọc.
   Tiết diện đối xứng qua z = 0 (ExtrudeGeometry của three đảo dấu z sau khi xoay, không ảnh hưởng). */
const V = (z: number, y: number) => new THREE.Vector2(z, y);
const BAND = 3.0;   // m — tường ốp tấm sáng màu tới 3 m, phía trên sơn tối

/* Đùn tiết diện (z, y) có lỗ dọc trục X từ x0 tới x1, uốn theo mặt đường hrRoadY */
export function extrudeShape(shape: THREE.Shape, x0: number, x1: number, steps: number) {
  const g = new THREE.ExtrudeGeometry(shape, { depth: x1 - x0, steps, bevelEnabled: false });
  g.rotateY(Math.PI / 2); g.translate(x0, 0, 0);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) p.setY(i, p.getY(i) + hrRoadY(p.getX(i)));
  g.deleteAttribute('uv'); g.deleteAttribute('normal'); g.computeVertexNormals();
  return g;
}
/* Tiết diện 31,2 × 8,5 m: lỗ ống Nam, ống Bắc và hành lang. Thêm đỉnh ở cao độ 3 m để tô hai dải màu tường */
export function boreShape() {
  const W = HR.halfWidth, top = HR.roofTop, bot = -HR.slabBelow;
  const s = new THREE.Shape([V(-W, bot), V(W, bot), V(W, top), V(-W, top)]);
  const hole = (z0: number, z1: number, h: number, band: boolean) => new THREE.Path(band
    ? [V(z0, 0), V(z1, 0), V(z1, BAND - 0.02), V(z1, BAND), V(z1, h), V(z0, h), V(z0, BAND), V(z0, BAND - 0.02)]
    : [V(z0, 0), V(z1, 0), V(z1, h), V(z0, h)]);
  s.holes.push(hole(HR.tubeNear, HR.tubeFar, HR.clear, true), hole(-HR.tubeFar, -HR.tubeNear, HR.clear, true), hole(-HR.corridorHalf, HR.corridorHalf, HR.corridorClear, false));
  return s;
}
/* Độ sáng nền theo vị trí: vùng ngưỡng 80 m cuối hầm kín sáng nhất, giảm dần vào trong */
export const boreLevel = (x: number) => 0.5 + 0.5 * smooth(clamp((Math.abs(x) - 330) / 90, 0, 1));
/* Màu đỉnh (xám đồng nhất): mặt ngoài bê tông trần; trong lòng ống: tường ốp sáng, trần sơn tối, sàn xám */
export function boreColor(x: number, y: number, z: number): number {
  const rel = y - hrRoadY(x);
  if (rel <= -HR.slabBelow + 0.02 || rel >= HR.roofTop - 0.02 || Math.abs(z) >= HR.halfWidth - 0.02) return 0.8;
  const f = boreLevel(x);
  if (rel >= BAND - 0.005) return 0.4 * f;
  if (rel <= 0.02) return 0.5 * f;
  return 0.95 * f;
}
/* Vỏ một đoạn hầm kín [x0, x1] */
export function boreShell(x0: number, x1: number) {
  return prepColored(extrudeShape(boreShape(), x0, x1, Math.max(1, Math.ceil((x1 - x0) / 6))), boreColor);
}
/* Vòng gioăng GINA/Omega ở khe nối hai đốt: dải sẫm quanh chu vi, nhô 6 cm */
export function jointRing(x: number) {
  const W = HR.halfWidth, H = HR.slabBelow + HR.roofTop, yMid = (HR.roofTop - HR.slabBelow) / 2, L = 0.5;
  const parts = [
    bentBox(L, 0.12, W * 2 + 0.12, x, HR.roofTop, 0, 1, hrRoadY), bentBox(L, 0.12, W * 2 + 0.12, x, -HR.slabBelow, 0, 1, hrRoadY),
    bentBox(L, H + 0.12, 0.12, x, yMid, W, 1, hrRoadY), bentBox(L, H + 0.12, 0.12, x, yMid, -W, 1, hrRoadY)
  ];
  return prepColored(mergeGeometries(parts.map((g) => g.toNonIndexed())), () => 0.16);
}

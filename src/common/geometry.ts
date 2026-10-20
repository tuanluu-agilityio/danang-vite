import * as THREE from 'three';
import { lerp } from './math';

export type Profile = (x: number) => number;
type V3 = THREE.Vector3;

export const UP = new THREE.Vector3(0, 1, 0);

/* Hộp uốn theo profile cao độ (dùng cho mặt cầu, dầm, lan can) */
export function bentBox(len: number, h: number, w: number, xc: number, yOff: number, zc: number, segs: number, profile: Profile) {
  const g = new THREE.BoxGeometry(len, h, w, segs, 1, 1);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) { const x = p.getX(i) + xc; p.setXYZ(i, x, p.getY(i) + yOff + profile(x), p.getZ(i) + zc); }
  g.computeVertexNormals();
  return g;
}
/* Mặt phẳng đường uốn theo profile, chạy dọc trục X */
export function bentPlane(len: number, w: number, xc: number, yOff: number, zc: number, segs: number, profile: Profile, flip?: boolean) {
  const g = new THREE.PlaneGeometry(len, w, segs, 1);
  g.rotateX(-Math.PI / 2);
  if (flip) g.rotateY(Math.PI);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) { const x = p.getX(i) + xc; p.setXYZ(i, x, yOff + profile(x), p.getZ(i) + zc); }
  return g;
}
/* Mặt đường phẳng chạy dọc trục Z */
export function zPlane(len: number, w: number, xc: number, y: number, zc: number, flip: boolean) {
  const g = new THREE.PlaneGeometry(len, w, 1, 1);
  g.rotateX(-Math.PI / 2); g.rotateY(flip ? -Math.PI / 2 : Math.PI / 2);
  g.translate(xc, y, zc);
  return g;
}
/* Ống thuôn: bán kính thay đổi theo tham số u (thân rồng, sừng, râu) */
export function taperedTube(curve: THREE.Curve<V3>, segs: number, radial: number, rFn: (u: number) => number,
  frames?: { tangents: V3[]; normals: V3[]; binormals: V3[] }) {
  frames = frames || curve.computeFrenetFrames(segs, false);
  const pos: number[] = [], nor: number[] = [], uv: number[] = [], idx: number[] = [];
  const P = new THREE.Vector3(), N = new THREE.Vector3();
  for (let i = 0; i <= segs; i++) {
    const u = i / segs; curve.getPointAt(u, P); const r = rFn(u);
    const n = frames.normals[i], b = frames.binormals[i];
    for (let j = 0; j <= radial; j++) {
      const v = j / radial * Math.PI * 2, s = Math.sin(v), c = -Math.cos(v);
      N.set(c * n.x + s * b.x, c * n.y + s * b.y, c * n.z + s * b.z).normalize();
      pos.push(P.x + r * N.x, P.y + r * N.y, P.z + r * N.z); nor.push(N.x, N.y, N.z); uv.push(u, j / radial);
    }
  }
  for (let i = 0; i < segs; i++) for (let j = 0; j < radial; j++) {
    const a = i * (radial + 1) + j, b2 = (i + 1) * (radial + 1) + j;
    idx.push(a, b2, a + 1, b2, b2 + 1, a + 1);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  return g;
}
/* Ma trận cho trụ đơn vị (cao 1, trục Y) nối điểm a → b */
export function segmentMatrix(a: V3, b: V3, r: number, out: THREE.Matrix4) {
  const d = new THREE.Vector3().subVectors(b, a); const len = d.length();
  const q = new THREE.Quaternion().setFromUnitVectors(UP, d.normalize());
  return out.compose(new THREE.Vector3().addVectors(a, b).multiplyScalar(0.5), q, new THREE.Vector3(r, len, r));
}
export function shadowed<T extends THREE.Object3D>(m: T, cast = true, receive = true): T { m.castShadow = cast; m.receiveShadow = receive; return m; }

/* ---------- hình học dùng chung cho các cầu ---------- */
type Color3 = number | [number, number, number];
/* Đổi sang non-indexed, bỏ UV, gắn màu đỉnh (mặc định trắng) để gộp chung một vật liệu */
export function prepColored(g: THREE.BufferGeometry, colorFn?: (x: number, y: number, z: number) => Color3) {
  if (g.index) g = g.toNonIndexed();
  if (g.attributes.uv) g.deleteAttribute('uv');
  const p = g.attributes.position, c = new Float32Array(p.count * 3);
  for (let i = 0; i < p.count; i++) {
    const v = colorFn ? colorFn(p.getX(i), p.getY(i), p.getZ(i)) : 1;
    const [r, gg, b] = Array.isArray(v) ? v : [v, v, v];
    c[i * 3] = r; c[i * 3 + 1] = gg; c[i * 3 + 2] = b;
  }
  g.setAttribute('color', new THREE.BufferAttribute(c, 3));
  if (!g.attributes.normal) g.computeVertexNormals();
  return g;
}
/* Vệt nước bám (theo màu đỉnh): sẫm và hơi xanh rêu quanh mực nước */
export function wetLineColor(_x: number, y: number): Color3 {
  if (y < -0.4) return [0.42, 0.44, 0.40];
  if (y < 1.7) return [0.56, 0.6, 0.52];
  if (y < 2.4) { const k = (y - 1.7) / 0.7; return [lerp(0.56, 1, k), lerp(0.6, 1, k), lerp(0.52, 1, k)]; }
  return 1;
}
export interface LoftRing { sx: number; sz: number; cx: number; cz: number; y: number; ch: number }
/* Khối tiết diện bát giác (chữ nhật vát cạnh) đi qua nhiều vòng {sx, sz, cx, cz, y, ch} */
export function loftRings(rings: LoftRing[]) {
  const ring = (r: LoftRing) => {
    const hx = r.sx / 2, hz = r.sz / 2, ch = r.ch;
    return [[hx - ch, -hz], [hx, -hz + ch], [hx, hz - ch], [hx - ch, hz], [-hx + ch, hz], [-hx, hz - ch], [-hx, -hz + ch], [-hx + ch, -hz]]
      .map(([x, z]) => new THREE.Vector3(r.cx + x, r.y, r.cz + z));
  };
  const R = rings.map(ring), pos: number[] = [];
  const tri = (a: V3, b: V3, c: V3) => pos.push(a.x, a.y, a.z, b.x, b.y, b.z, c.x, c.y, c.z);
  const first = rings[0], last = rings[rings.length - 1];
  const ca = new THREE.Vector3(first.cx, first.y, first.cz), cb = new THREE.Vector3(last.cx, last.y, last.cz);
  const A0 = R[0], B1 = R[R.length - 1];
  for (let k = 0; k < R.length - 1; k++) {
    const A = R[k], B = R[k + 1];
    for (let i = 0; i < 8; i++) { const j = (i + 1) % 8; tri(A[i], B[j], A[j]); tri(A[i], B[i], B[j]); }
  }
  for (let i = 0; i < 8; i++) { const j = (i + 1) % 8; tri(cb, B1[j], B1[i]); tri(ca, A0[i], A0[j]); }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.computeVertexNormals();
  return g;
}
type Pair = [number, number] | number[];
/* Khối bát giác thon dần từ y0 lên y1 (dùng cho cột tháp, bệ trụ, dầm ngang) */
export function loftOct(b0: Pair, b1: Pair, y0: number, y1: number, c0: Pair, c1: Pair, ch: number) {
  return loftRings([
    { sx: b0[0], sz: b0[1], cx: c0[0], cz: c0[1], y: y0, ch },
    { sx: b1[0], sz: b1[1], cx: c1[0], cz: c1[1], y: y1, ch }
  ]);
}
export function boxAt(sx: number, sy: number, sz: number, x: number, y: number, z: number, segY = 1) {
  const g = new THREE.BoxGeometry(sx, sy, sz, 1, segY, 1); g.translate(x, y, z); return g;
}
/* Đùn tiết diện (z, y) dọc trục X từ x0 tới x1, rồi uốn theo cao độ profile(x) */
export function extrudeAlongX(pts: number[][], x0: number, x1: number, steps: number, profile: Profile) {
  const shape = new THREE.Shape(pts.map(([z, y]) => new THREE.Vector2(z, y)));
  const g = new THREE.ExtrudeGeometry(shape, { depth: x1 - x0, steps, bevelEnabled: false });
  g.rotateY(Math.PI / 2); g.translate(x0, 0, 0);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) p.setY(i, p.getY(i) + profile(p.getX(i)));
  g.deleteAttribute('uv'); g.deleteAttribute('normal'); g.computeVertexNormals();
  return g;
}
/* Mặt đường dọc X, uốn theo profile, UV theo mét (chu kỳ 12 m) */
export function roadStrip(x0: number, x1: number, w: number, zc: number, yOff: number, segs: number, profile: Profile, flip?: boolean) {
  const g = bentPlane(x1 - x0, w, (x0 + x1) / 2, yOff, zc, segs, profile, flip);
  const p = g.attributes.position, uv = g.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setX(i, p.getX(i) / 12);
  return g;
}
/* Hộp có đáy cố định, mặt trên bám theo cao độ (tường chắn đường đắp) */
export function fillBlock(x0: number, x1: number, w: number, zc: number, bottom: number, topFn: Profile, segs: number) {
  const g = new THREE.BoxGeometry(x1 - x0, 1, w, segs, 1, 1);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i) + (x0 + x1) / 2;
    p.setXYZ(i, x, p.getY(i) > 0 ? topFn(x) : bottom, p.getZ(i) + zc);
  }
  g.computeVertexNormals();
  return g;
}
/* Thanh hộp nối a → b (dàn thép, giằng) */
export function beamBetween(a: V3, b: V3, w: number, h: number) {
  const d = new THREE.Vector3().subVectors(b, a), len = d.length();
  const g: THREE.BufferGeometry = new THREE.BoxGeometry(w, h, len);
  const m = new THREE.Matrix4().lookAt(new THREE.Vector3(), d, Math.abs(d.y / len) > 0.99 ? new THREE.Vector3(1, 0, 0) : UP);
  g.applyMatrix4(m); g.translate((a.x + b.x) / 2, (a.y + b.y) / 2, (a.z + b.z) / 2);
  return g;
}

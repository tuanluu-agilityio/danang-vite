import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { segmentMatrix } from '../../common/geometry';
import { SW } from './profile';

/* ===== Phần quay: vành chính (2 vòng + giằng), vành phụ 0,65 R, vành nhỏ quanh moay-ơ, 32 thanh chính, cáp chéo, moay-ơ =====
   Gộp MỘT mesh, gốc tại tâm trục (mặt phẳng XY cục bộ, quay quanh Z). Thuộc tính đỉnh cho shader LED (giai đoạn 4, ledShow.ts):
   aSpoke = chỉ số thanh chính 0–31; nhóm khác mang mã âm SW_PART: −1 vành chính + giằng, −2 vành phụ + vành moay-ơ, −3 cáp chéo, −4 moay-ơ;
   aR = 0 ở moay-ơ → 1 ở vành, theo khoảng cách tới trục. */
export const SW_PART = { rim: -1, ring: -2, cable: -3, hub: -4 };

const _m = new THREE.Matrix4();
/* ống trụ hở hai đầu nối a → b */
function rod(a: THREE.Vector3, b: THREE.Vector3, r: number, radial = 5) {
  return new THREE.CylinderGeometry(1, 1, 1, radial, 1, true).applyMatrix4(segmentMatrix(a, b, r, _m));
}
function tag(g: THREE.BufferGeometry, spoke: number) {
  if (g.attributes.uv) g.deleteAttribute('uv');
  const p = g.attributes.position, n = p.count, s = new Float32Array(n), r = new Float32Array(n);
  for (let i = 0; i < n; i++) { s[i] = spoke; r[i] = THREE.MathUtils.clamp((Math.hypot(p.getX(i), p.getY(i)) - SW.hub.r) / (SW.rimR - SW.hub.r), 0, 1); }
  g.setAttribute('aSpoke', new THREE.BufferAttribute(s, 1)); g.setAttribute('aR', new THREE.BufferAttribute(r, 1));
  return g;
}
const P = (r: number, a: number, z: number) => new THREE.Vector3(Math.cos(a) * r, Math.sin(a) * r, z);

export function swBuildWheel() {
  const R = SW.rimR, g2 = SW.rim.gap / 2, hz = SW.hub.len / 2, parts: THREE.BufferGeometry[] = [];
  // vành chính: hai vòng song song + giằng thẳng và chéo giữa hai vòng
  for (const z of [-g2, g2]) parts.push(tag(new THREE.TorusGeometry(R, SW.rim.tube, 6, 128).translate(0, 0, z), SW_PART.rim));
  const nt = SW.rim.ties, st = 2 * Math.PI / nt;
  for (let i = 0; i < nt; i++) {
    const a = i * st;
    parts.push(tag(rod(P(R, a, -g2), P(R, a, g2), SW.rim.tube * 0.5, 4), SW_PART.rim));
    parts.push(tag(rod(P(R, a, i % 2 ? g2 : -g2), P(R, a + st, i % 2 ? -g2 : g2), SW.rim.tube * 0.4, 4), SW_PART.rim));
  }
  // vành phụ và vành nhỏ quanh moay-ơ
  parts.push(tag(new THREE.TorusGeometry(R * SW.ring2, SW.ring2Tube, 5, 96), SW_PART.ring));
  parts.push(tag(new THREE.TorusGeometry(SW.hubRing, SW.hubRingTube, 5, 32), SW_PART.ring));
  // moay-ơ
  parts.push(tag(new THREE.CylinderGeometry(SW.hub.r, SW.hub.r, SW.hub.len, 16).rotateX(Math.PI / 2), SW_PART.hub));
  // 32 thanh chính (mang LED): từ mép moay-ơ ra vòng vành cùng phía, xen kẽ hai phía
  for (let i = 0; i < SW.spokes; i++) {
    const a = (i + 0.5) * 2 * Math.PI / SW.spokes, s = i % 2 ? 1 : -1;
    parts.push(tag(rod(P(SW.hub.r, a, s * hz), P(R, a, s * g2), SW.spokeR), i));
  }
  // cáp chéo mảnh: từ moay-ơ lệch tiếp tuyến ra vành
  const nc = SW.cables, sc = 2 * Math.PI / nc;
  for (let i = 0; i < nc; i++) {
    const s = i % 2 ? 1 : -1, a = i * sc;
    parts.push(tag(rod(P(SW.hub.r, a, s * hz * 0.8), P(R, a + s * 1.5 * sc, s * g2), SW.cableR, 3), SW_PART.cable));
  }
  const g = mergeGeometries(parts);
  parts.forEach((p) => p.dispose());
  return g;
}

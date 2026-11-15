import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { CONFIG } from '../config';
import { stHeight, hvHeight, stFbm, stNoise, stLandMask, ST_BOX, HV_BOX, type Box } from './terrain';

/* ============================ Lưới núi Sơn Trà + Hải Vân (D-047) ============================
   Lấy mẫu hàm độ cao trên lưới đều, bỏ ô chìm, pháp tuyến mượt từ sai phân, màu đỉnh nướng sẵn
   (sắc rừng, độ khuất khe / thung lũng, đá ở dốc đứng và mép nước). Không cần renderer nên test node gọi được. */

const T = CONFIG.sonTra;
const sat = (t: number) => (t < 0 ? 0 : t > 1 ? 1 : t), sstep = (a: number, b: number, t: number) => { t = sat((t - a) / (b - a)); return t * t * (3 - 2 * t); };

/* Trung bình hộp bán kính r ô (hai lượt tách trục) */
function blur(src: Float32Array, nx: number, nz: number, r: number) {
  const tmp = new Float32Array(src.length), out = new Float32Array(src.length);
  for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) { let s = 0, n = 0; for (let k = Math.max(0, i - r); k <= Math.min(nx - 1, i + r); k++) { s += src[j * nx + k]; n++; } tmp[j * nx + i] = s / n; }
  for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) { let s = 0, n = 0; for (let k = Math.max(0, j - r); k <= Math.min(nz - 1, j + r); k++) { s += tmp[k * nx + i]; n++; } out[j * nx + i] = s / n; }
  return out;
}

function field(hf: (x: number, z: number) => number, box: Box, cell: number, landMask: ((x: number, z: number) => number) | null) {
  const nx = Math.round((box.x1 - box.x0) / cell) + 1, nz = Math.round((box.z1 - box.z0) / cell) + 1, N = nx * nz;
  const h = new Float32Array(N);
  for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) h[j * nx + i] = hf(box.x0 + i * cell, box.z0 + j * cell);
  const hc = h.map((v) => Math.max(v, 0)), bN = blur(hc, nx, nz, T.aoNear), bF = blur(hc, nx, nz, T.aoFar);
  // ô nào có đỉnh nổi (hoặc sát mặt nước) thì giữ; đánh số lại đỉnh dùng tới
  const idx: number[] = [], map = new Int32Array(N).fill(-1); let used = 0;
  const id = (k: number) => (map[k] < 0 ? (map[k] = used++) : map[k]);
  for (let j = 0; j < nz - 1; j++) for (let i = 0; i < nx - 1; i++) {
    const a = j * nx + i, b = a + 1, c = a + nx, d = c + 1;
    if (Math.max(h[a], h[b], h[c], h[d]) < -3) continue;
    if (landMask && landMask(box.x0 + (i + 0.5) * cell, box.z0 + (j + 0.5) * cell) <= 0 && landMask(box.x0 + i * cell, box.z0 + j * cell) <= 0 && landMask(box.x0 + (i + 1) * cell, box.z0 + (j + 1) * cell) <= 0) continue;   // nằm trọn dưới đất liền
    // chéo đổi chiều theo ô cho đỡ vệt răng cưa một hướng
    if ((i + j) & 1) idx.push(id(a), id(c), id(b), id(b), id(c), id(d)); else idx.push(id(a), id(c), id(d), id(a), id(d), id(b));
  }
  const pos = new Float32Array(used * 3), nor = new Float32Array(used * 3), col = new Float32Array(used * 3), rock = new Float32Array(used);
  const C = (hex: number) => new THREE.Color(hex), cDark = C(T.forestDark), cMid = C(T.forestMid), cLight = C(T.forestLight), cDry = C(T.forestDry), cRock = C(T.rock), cShore = C(T.shore), c = new THREE.Color();
  const H = (i: number, j: number) => h[Math.min(nz - 1, Math.max(0, j)) * nx + Math.min(nx - 1, Math.max(0, i))];
  for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) {
    const k = j * nx + i, v = map[k]; if (v < 0) continue;
    const x = box.x0 + i * cell, z = box.z0 + j * cell, y = h[k];
    pos[v * 3] = x; pos[v * 3 + 1] = Math.max(y, -T.seaDrop - 1); pos[v * 3 + 2] = z;
    const gx = (H(i + 1, j) - H(i - 1, j)) / (2 * cell), gz = (H(i, j + 1) - H(i, j - 1)) / (2 * cell), il = 1 / Math.hypot(gx, 1, gz), ny = il;
    nor[v * 3] = -gx * il; nor[v * 3 + 1] = ny; nor[v * 3 + 2] = -gz * il;
    // độ khuất: thấp hơn trung bình lân cận ⇒ khe / thung lũng ⇒ tối; cao hơn ⇒ dông ⇒ sáng
    const conv = ((hc[k] - bN[k]) / (T.aoNear * cell) * 2.2 + (hc[k] - bF[k]) / (T.aoFar * cell) * 1.6) * T.aoGain;
    const ao = Math.min(1.18, Math.max(0.5, 1 + conv));
    // sắc rừng: mảng lớn + dông sáng / khe tối + mảng lá vàng
    const big = stFbm(x / 760 + 3.1, z / 760 - 8.4, 3), patch = stFbm(x / 230 - 11.2, z / 230 + 5.5, 2), ridge = sat(0.5 + conv * 2.4);
    c.copy(cDark).lerp(cMid, sat(0.25 + ridge * 0.9 + (big - 0.5) * 0.8)).lerp(cLight, sat((ridge - 0.45) * 1.1 + (patch - 0.5) * 0.9) * 0.75);
    c.lerp(cDry, sstep(0.62, 0.8, stFbm(x / 420 + 40.7, z / 420 + 2.3, 3)) * 0.5);
    // đá: dốc đứng (bị nhiễu bẻ vụn) và dải mép nước ngoài vùng tiếp đất
    const lm = landMask ? landMask(x, z) : 1, br = stNoise(x / 60, z / 60);
    const rk = sstep(T.rockSlope[0], T.rockSlope[1], ny + (br - 0.5) * 0.1) * 0.85, sh = sstep(T.shoreY[0], T.shoreY[1], y + (br - 0.5) * 5) * sstep(0.25, 0.6, lm);
    c.lerp(cRock, rk).lerp(cShore, sh);
    const sh2 = y < 60 && lm < 1 ? sstep(0.9, 0.1, lm) * 0.25 : 0;   // chân núi sát đất liền: rừng thưa, sáng hơn chút
    c.lerp(cLight, sh2);
    col[v * 3] = c.r * ao; col[v * 3 + 1] = c.g * ao; col[v * 3 + 2] = c.b * ao; rock[v] = Math.max(rk, sh);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  g.setAttribute('color', new THREE.BufferAttribute(col, 3)); g.setAttribute('aRock', new THREE.BufferAttribute(rock, 1));
  g.setIndex(idx);
  return g;
}

/** Một lưới cho cả Sơn Trà (ô `cell`) và Hải Vân (ô `cellFar`): position, normal, color, aRock, có index. */
export function mtGeometry(): THREE.BufferGeometry {
  return mergeGeometries([field(stHeight, ST_BOX, T.cell, stLandMask), field(hvHeight, HV_BOX, T.cellFar, null)]);
}

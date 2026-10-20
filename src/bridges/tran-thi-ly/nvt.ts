import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { CONFIG } from '../../config';
import { MAT } from '../../core/materials';
import { prepColored, bentBox, boxAt, beamBetween } from '../../common/geometry';
import { TTL, nvtY } from './profile';
import type { TranThiLyBridge } from './TranThiLyBridge';

/* [extras] cầu Nguyễn Văn Trỗi cũ — dàn thép thấp, nay dành cho người đi bộ. Mức chi tiết thấp; mọi số đo là ước lượng. */
export function ttlBuildNvt(bridge: TranThiLyBridge) {
  const M = bridge.mats, Z = TTL.nvtZ, B = CONFIG.bankX, hw = TTL.nvtWidth / 2, nvt = new THREE.Group();
  nvt.name = 'nvt-bridge';
  const P = Array.from({ length: TTL.nvtSpans + 1 }, (_, i) => -B + i * (2 * B / TTL.nvtSpans));
  const conc = [prepColored(bentBox(2 * (B + 26), 0.5, TTL.nvtWidth, 0, -0.25, Z, 120, nvtY))];
  for (const x of P.slice(1, -1)) {
    for (const s of [-1, 1]) conc.push(prepColored(new THREE.CylinderGeometry(1.1, 1.3, TTL.nvtDeckY - 0.5 + 3, 14).translate(x, (TTL.nvtDeckY - 0.5 - 3) / 2, Z + s * 3.2)));
    conc.push(prepColored(boxAt(2.4, 0.9, TTL.nvtWidth + 0.6, x, TTL.nvtDeckY - 0.95, Z)));
  }
  const cm = new THREE.Mesh(mergeGeometries(conc), M.concrete); cm.castShadow = cm.receiveShadow = true; nvt.add(cm);
  // dàn thép kiểu Pratt mỗi nhịp, hai bên
  const beams = [], yb = TTL.nvtDeckY - 0.2, yt = yb + TTL.nvtTruss, panels = 8, bulbs = [];
  const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);
  for (let sp = 0; sp < TTL.nvtSpans; sp++) {
    const a = P[sp], b = P[sp + 1], p = (b - a) / panels;
    for (const s of [-1, 1]) {
      const z = Z + s * (hw + 0.1);
      beams.push(beamBetween(V(a, yb, z), V(b, yb, z), 0.45, 0.5));                    // biên dưới
      beams.push(beamBetween(V(a + p, yt, z), V(b - p, yt, z), 0.45, 0.45));            // biên trên
      beams.push(beamBetween(V(a, yb, z), V(a + p, yt, z), 0.4, 0.4));                  // thanh xiên đầu dàn
      beams.push(beamBetween(V(b, yb, z), V(b - p, yt, z), 0.4, 0.4));
      for (let k = 1; k < panels; k++) {
        beams.push(beamBetween(V(a + k * p, yb, z), V(a + k * p, yt, z), 0.3, 0.3));    // thanh đứng
        bulbs.push(V(a + k * p, yt + 0.35, z));
      }
      for (let k = 1; k < panels / 2; k++) {                                              // thanh xiên hướng vào giữa nhịp
        beams.push(beamBetween(V(a + k * p, yt, z), V(a + (k + 1) * p, yb, z), 0.28, 0.28));
        beams.push(beamBetween(V(b - k * p, yt, z), V(b - (k + 1) * p, yb, z), 0.28, 0.28));
      }
    }
    for (let k = 1; k < panels; k++) beams.push(beamBetween(V(a + k * p, yt, Z - hw), V(a + k * p, yt, Z + hw), 0.25, 0.3)); // giằng ngang trên
  }
  const sm = new THREE.Mesh(mergeGeometries(beams.map((g) => g.toNonIndexed())), M.nvtSteel); sm.castShadow = true; nvt.add(sm);
  // lan can thấp và dây đèn dọc biên trên (sáng ban đêm)
  const rails = [];
  for (const s of [-1, 1]) for (const h of [1.05, 0.55]) rails.push(bentBox(2 * (B + 26), 0.06, 0.06, 0, h, Z + s * (hw - 0.4), 120, nvtY));
  const rm = new THREE.Mesh(mergeGeometries(rails), MAT.rail); rm.layers.set(1); nvt.add(rm);
  const bi = new THREE.InstancedMesh(new THREE.SphereGeometry(0.22, 8, 6), MAT.bulb, bulbs.length), mm = new THREE.Matrix4();
  bulbs.forEach((p, i) => bi.setMatrixAt(i, mm.makeTranslation(p.x, p.y, p.z)));
  nvt.add(bi);
  bridge.group.add(nvt);
  bridge.nvt = nvt; bridge.farHide.push(nvt);
}

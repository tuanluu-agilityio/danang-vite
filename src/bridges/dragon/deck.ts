import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { CONFIG } from '../../config';
import { scene } from '../../core/renderer';
import { MAT } from '../../core/materials';
import { bentBox, bentPlane, shadowed } from '../../common/geometry';
import { ROADS3 } from '../../environment/streets';
import { deckY } from './profile';

/* ============================ Cầu Rồng: mặt cầu ============================ */
export function buildBridgeDeck() {
  const L = CONFIG.length, hw = CONFIG.width / 2, segs = 260;
  const med = CONFIG.median / 2;
  const carriage = CONFIG.lanesPerDir * CONFIG.laneWidth + CONFIG.shoulder; // 13,25 m mỗi chiều
  const sideIn = med + carriage;                                             // mép trong lề đi bộ
  const conc = [], steel = [], paver = [], rail = [], led = [];
  conc.push(bentBox(L, 0.5, CONFIG.width, 0, -0.25, 0, segs, deckY));             // bản mặt cầu
  steel.push(bentBox(570, 3.0, 26, 0, -2.0, 0, 220, deckY));                       // dầm hộp thép ẩn dưới
  conc.push(bentBox(L, 0.3, CONFIG.median, 0, 0.15, 0, segs, deckY));              // dải phân cách giữa 6 m
  for (const s of [-1, 1]) {
    paver.push(bentBox(L, 0.25, CONFIG.sidewalk, 0, 0.125, s * (sideIn + CONFIG.sidewalk / 2), segs, deckY)); // lề đi bộ 2,5 m
    conc.push(bentBox(L, 0.9, 0.35, 0, 0.45, s * (sideIn - 0.175), segs, deckY));   // gờ chắn xe
    rail.push(bentBox(L, 0.08, 0.14, 0, 1.12, s * (hw - 0.1), segs, deckY));        // tay vịn
    rail.push(bentBox(L, 0.06, 0.06, 0, 0.6, s * (hw - 0.1), segs, deckY));
    led.push(bentBox(L, 0.05, 0.1, 0, 1.19, s * (hw - 0.1), segs, deckY));          // dải LED trên lan can
    conc.push(bentBox(L, 0.35, 0.3, 0, -0.1, s * (hw + 0.1), segs, deckY));         // gờ mép ngoài
  }
  scene.add(shadowed(new THREE.Mesh(mergeGeometries(conc), MAT.concrete)));
  scene.add(shadowed(new THREE.Mesh(mergeGeometries(steel), MAT.girder)));
  scene.add(shadowed(new THREE.Mesh(mergeGeometries(paver), MAT.paver), false, true));
  scene.add(shadowed(new THREE.Mesh(mergeGeometries(rail), MAT.rail), true, false));
  scene.add(new THREE.Mesh(mergeGeometries(led), MAT.ledRail));

  // Mặt đường 6 làn (2 chiều × 3 làn) — gom chung với đường bờ để giảm draw call
  ROADS3.push(bentPlane(L, carriage, 0, 0.02, med + carriage / 2, segs, deckY));
  ROADS3.push(bentPlane(L, carriage, 0, 0.02, -(med + carriage / 2), segs, deckY, true));

  // Cột lan can (InstancedMesh)
  const n = Math.floor(L / 2.2), post = new THREE.InstancedMesh(new THREE.BoxGeometry(0.1, 1.15, 0.1), MAT.rail, n * 2);
  const m = new THREE.Matrix4();
  let k = 0;
  for (let i = 0; i < n; i++) for (const s of [-1, 1]) {
    const x = -L / 2 + (i + 0.5) * 2.2;
    m.makeTranslation(x, deckY(x) + 0.575, s * (hw - 0.1)); post.setMatrixAt(k++, m);
  }
  post.castShadow = true; scene.add(post);
}

/* Trụ cầu trong lòng sông */
export function buildPiers() {
  const half = CONFIG.mainTotal / 2; const xs = [-half];
  let x = -half; for (const s of CONFIG.mainSpans) { x += s; xs.push(x); }
  xs.push(...CONFIG.approachPiers);
  const colGeo = new THREE.CylinderGeometry(1, 1, 1, 18).translate(0, 0.5, 0);
  const boxGeo = new THREE.BoxGeometry(1, 1, 1);
  const cols = new THREE.InstancedMesh(colGeo, MAT.pier, xs.length * 2);
  const caps = new THREE.InstancedMesh(boxGeo, MAT.pier, xs.length * 2);
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), v = new THREE.Vector3(), s = new THREE.Vector3();
  let k = 0, c = 0;
  xs.forEach((px) => {
    const big = Math.abs(Math.abs(px) - 100) < 1; // chân vòm chính
    const r = big ? 2.8 : 2.0, top = deckY(px) - 3.4;
    for (const sz of [-1, 1]) { m.compose(v.set(px, -4, sz * 8.5), q, s.set(r, top + 4, r * 1.4)); cols.setMatrixAt(k++, m); }
    m.compose(v.set(px, -1, 0), q, s.set(big ? 16 : 11, 2.4, 28)); caps.setMatrixAt(c++, m);         // bệ trụ
    m.compose(v.set(px, top - 0.8, 0), q, s.set(big ? 7 : 5, 1.6, 25)); caps.setMatrixAt(c++, m);    // xà mũ
  });
  scene.add(shadowed(cols), shadowed(caps));
}

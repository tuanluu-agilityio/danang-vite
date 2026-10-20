import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { MAT } from '../core/materials';
import { bentBox, prepColored, shadowed, UP, type Profile } from './geometry';
import type { BridgeParts } from './BridgeBase';

/* ---------- chi tiết mặt cầu ---------- */
/* Lề bộ hành, gờ chắn bánh, gờ mép, lan can 3 thanh + cột lan can (InstancedMesh) */
export function addDeckEdges(bridge: BridgeParts, o: { x0: number; x1: number; segs: number; profile: Profile; hw: number; sidewalk: number; railStep?: number }) {
  const { x0, x1, segs, profile, hw, sidewalk } = o, L = x1 - x0, xc = (x0 + x1) / 2, step = o.railStep || 2.5;
  const conc = [], paver = [], rail = [];
  for (const s of [-1, 1]) {
    paver.push(bentBox(L, 0.25, sidewalk - 0.3, xc, 0.125, s * (hw - (sidewalk - 0.3) / 2 - 0.3), segs, profile));
    conc.push(bentBox(L, 0.55, 0.25, xc, 0.27, s * (hw - sidewalk + 0.12), segs, profile));      // gờ chắn bánh
    conc.push(bentBox(L, 0.5, 0.3, xc, 0.0, s * (hw - 0.15), segs, profile));                    // gờ mép
    rail.push(bentBox(L, 0.09, 0.12, xc, 1.2, s * (hw - 0.15), segs, profile));                  // tay vịn
    rail.push(bentBox(L, 0.06, 0.06, xc, 0.75, s * (hw - 0.15), segs, profile));
    rail.push(bentBox(L, 0.06, 0.06, xc, 0.4, s * (hw - 0.15), segs, profile));
  }
  bridge.concreteParts.push(...conc.map((g) => prepColored(g, () => 0.9)));
  const pv = shadowed(new THREE.Mesh(mergeGeometries(paver), MAT.paver), false, true); bridge.group.add(pv); bridge.noReflect.push(pv);
  bridge.details.add(new THREE.Mesh(mergeGeometries(rail), MAT.rail));
  const n = Math.floor(L / step), m = new THREE.Matrix4();
  const posts = new THREE.InstancedMesh(new THREE.BoxGeometry(0.1, 1.2, 0.1), MAT.rail, n * 2);
  let k = 0;
  for (let i = 0; i < n; i++) for (const s of [-1, 1]) {
    const x = x0 + (i + 0.5) * step; posts.setMatrixAt(k++, m.makeTranslation(x, profile(x) + 0.6, s * (hw - 0.15)));
  }
  bridge.details.add(posts);
}
/* Cột đèn đường: mỗi hàng {z, s}; s = +1 cần đèn vươn về −z, s = −1 vươn về +z */
export function addLampPosts(bridge: BridgeParts, { xs, profile, rows }: { xs: number[]; profile: Profile; rows: { z: number; s: number }[] }) {
  const lampGeo = mergeGeometries([
    new THREE.CylinderGeometry(0.09, 0.14, 10, 6).translate(0, 5, 0),
    new THREE.BoxGeometry(0.12, 0.12, 2.0).translate(0, 9.9, -0.95)
  ]);
  const poles = new THREE.InstancedMesh(lampGeo, MAT.lampPole, xs.length * rows.length);
  const bulbs = new THREE.InstancedMesh(new THREE.SphereGeometry(0.35, 8, 6).scale(1.6, 0.6, 1), MAT.bulb, xs.length * rows.length);
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), v = new THREE.Vector3(), sc = new THREE.Vector3(1, 1, 1);
  let k = 0;
  for (const x of xs) for (const { z, s } of rows) {
    const y = profile(x) + 0.25;
    q.setFromAxisAngle(UP, s > 0 ? 0 : Math.PI);
    poles.setMatrixAt(k, m.compose(v.set(x, y, z), q, sc));
    bulbs.setMatrixAt(k, m.makeTranslation(x, y + 9.75, z - s * 1.85)); k++;
  }
  poles.castShadow = true;
  bridge.details.add(poles, bulbs);
}
export function addJoints(bridge: BridgeParts, { xs, profile, width, mat }: { xs: number[]; profile: Profile; width: number; mat: THREE.Material }) {
  const jm = new THREE.InstancedMesh(new THREE.BoxGeometry(0.6, 0.06, width), mat, xs.length), m = new THREE.Matrix4();
  xs.forEach((x, i) => jm.setMatrixAt(i, m.makeTranslation(x, profile(x) + 0.05, 0)));
  bridge.details.add(jm);
}

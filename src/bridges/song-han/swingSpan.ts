import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { CONFIG } from '../../config';
import { lerp } from '../../common/math';
import { prepColored, extrudeAlongX, bentBox, beamBetween, roadStrip, segmentMatrix, UP } from '../../common/geometry';
import { addDeckEdges, addLampPosts } from '../../common/deck';
import type { BridgeParts } from '../../common/BridgeBase';
import { SH, shFlat } from './profile';
import type { SongHanBridge } from './SongHanBridge';

/* [swingSpan] Mọi thứ trên nhịp quay nằm trong một group có gốc tại tâm trụ: chỉ cần xoay group này.
   Dầm thép, mặt cầu, tháp chữ A, dây văng, lan can, đèn, chốt khóa, đèn hàng hải đầu cánh */
const stripUv = (g: THREE.BufferGeometry) => { if (g.attributes.uv) g.deleteAttribute('uv'); return g.index ? g.toNonIndexed() : g; };

export function shBuildSwingSpan(bridge: SongHanBridge) {
  const M = bridge.mats, hw = SH.hw, L = SH.swingHalf, S = SH.deckY;
  const swing = new THREE.Group(); swing.name = 'sh-swing-span';
  const details = new THREE.Group(); details.name = 'sh-swing-details'; swing.add(details);
  const sw: BridgeParts = { group: swing, details, concreteParts: [], noReflect: [] };
  // dầm thép hộp sơn xanh + bản mặt cầu BTCT
  const sec = [[-hw, -0.35], [hw, -0.35], [hw, -0.8], [5.0, -SH.swingDepth], [-5.0, -SH.swingDepth], [-hw, -0.8]];
  const girder = new THREE.Mesh(extrudeAlongX(sec, -L, L, 40, shFlat), M.girder); girder.castShadow = girder.receiveShadow = true; swing.add(girder);
  sw.concreteParts.push(prepColored(bentBox(2 * L, 0.35, SH.deckWidth, 0, -0.175, 0, 8, shFlat)));
  sw.concreteParts.push(prepColored(bentBox(2 * L, 0.3, SH.median, 0, 0.15, 0, 8, shFlat), () => 0.9));
  // khung giàn thép dưới dầm, tựa lên vành quay
  const frame: THREE.BufferGeometry[] = [new THREE.TorusGeometry(SH.railR, 0.32, 8, 72).rotateX(Math.PI / 2).translate(0, SH.rimTop - 0.25, 0)];
  for (let i = 0; i < 12; i++) {
    const a = i / 12 * Math.PI * 2, p = new THREE.Vector3(Math.cos(a) * SH.railR, SH.rimTop - 0.2, Math.sin(a) * SH.railR);
    frame.push(beamBetween(p, new THREE.Vector3(Math.cos(a) * 3.5, S - SH.swingDepth, Math.sin(a) * 3.5), 0.35, 0.35));
    frame.push(beamBetween(p, new THREE.Vector3(Math.cos(a + Math.PI / 6) * SH.railR, SH.rimTop - 0.2, Math.sin(a + Math.PI / 6) * SH.railR), 0.3, 0.3));
  }
  frame.push(new THREE.CylinderGeometry(1.6, 1.6, S - SH.swingDepth - SH.drumTop - 1.2, 20).translate(0, (S - SH.swingDepth + SH.drumTop + 1.2) / 2, 0));
  const fm = new THREE.Mesh(mergeGeometries(frame.map(stripUv)), M.mech);
  fm.castShadow = true; details.add(fm);
  // mặt đường, lề, lan can, cột đèn trên nhịp quay
  const road = new THREE.Mesh(mergeGeometries([roadStrip(-L, L, SH.laneWidth, SH.lane, 0.03, 8, shFlat), roadStrip(-L, L, SH.laneWidth, -SH.lane, 0.03, 8, shFlat, true)]), M.road);
  road.receiveShadow = true; swing.add(road); sw.noReflect.push(road); bridge.farHide.push(road);
  addDeckEdges(sw, { x0: -L, x1: L, segs: 8, profile: shFlat, hw, sidewalk: SH.sidewalk });
  const zl = hw - SH.sidewalk + 0.45, xs = [-55, -35, 35, 55];
  addLampPosts(sw, { xs, profile: shFlat, rows: [{ z: -zl, s: -1 }, { z: zl, s: 1 }] });
  const strips = [bentBox(2 * L, 0.16, 0.08, 0, -0.5, hw + 0.04, 8, shFlat), bentBox(2 * L, 0.16, 0.08, 0, -0.5, -hw - 0.04, 8, shFlat)];
  const sls = new THREE.Mesh(mergeGeometries(strips), M.ledStrip); swing.add(sls); bridge.farHide.push(sls);
  // tháp thép xanh: cột đôi ở tim + chân chữ A dọc cầu, mũ trang trí trên đỉnh
  const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z), top = S + SH.mastHeight, tower = [];
  for (const z of [-0.55, 0.55]) tower.push(beamBetween(V(0, S - 0.2, z), V(0, top, z), 0.9, 0.8));
  for (const s of [-1, 1]) tower.push(beamBetween(V(s * SH.aFoot, S + 0.2, 0), V(0, S + SH.aApex, 0), 1.0, 1.4));
  tower.push(beamBetween(V(0, S + SH.aApex, -0.9), V(0, S + SH.aApex, 0.9), 1.6, 1.6));
  const tm = new THREE.Mesh(mergeGeometries(tower.map((g) => g.toNonIndexed())), M.blueSteel); tm.name = 'sh-tower'; tm.castShadow = true; swing.add(tm);
  const crown: THREE.BufferGeometry[] = [new THREE.SphereGeometry(0.9, 16, 10).translate(0, top + 0.6, 0)];
  for (let i = 0; i < 14; i++) {
    const a = i / 14 * Math.PI * 2, dir = V(Math.cos(a) * 0.8, 1, Math.sin(a) * 0.8).normalize();
    const g = new THREE.ConeGeometry(0.22, 3.2, 6).translate(0, 1.6, 0);
    g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(UP, dir)); g.translate(0, top + 0.6, 0); crown.push(g);
  }
  crown.push(new THREE.CylinderGeometry(0.15, 0.15, 4.5, 6).translate(0, top + 2.6, 0));
  details.add(new THREE.Mesh(mergeGeometries(crown.map(stripUv)), M.crown));
  // dây văng: một mặt phẳng ở tim cầu, rẻ quạt đối xứng — neo cao nhất ↔ neo dầm xa nhất
  const n = SH.stays, list: [THREE.Vector3, THREE.Vector3][] = [];
  for (const s of [-1, 1]) for (let i = 0; i < n; i++) {
    const k = i / (n - 1);
    list.push([V(s * 0.5, S + lerp(SH.stayTop[1], SH.stayTop[0], k), 0), V(s * lerp(SH.stayDeck[1], SH.stayDeck[0], k), S + 0.35, 0)]);
  }
  const stays = new THREE.InstancedMesh(new THREE.CylinderGeometry(1, 1, 1, 6, CONFIG.weather.wind.cableSegs), M.stay, list.length), m = new THREE.Matrix4();
  list.forEach(([a, b], i) => stays.setMatrixAt(i, segmentMatrix(a, b, SH.stayR, m)));
  stays.castShadow = true; swing.add(stays);
  // chốt khóa đầu cánh (trượt ra/vào) + đèn hàng hải đầu cánh
  const pins = new THREE.InstancedMesh(new THREE.BoxGeometry(1.4, 0.45, 0.6), M.steel, 4); pins.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  details.add(pins);
  const nav = new THREE.InstancedMesh(new THREE.SphereGeometry(0.3, 10, 8), M.lamp, 4);
  [[-L + 0.5, hw + 0.2], [-L + 0.5, -hw - 0.2], [L - 0.5, hw + 0.2], [L - 0.5, -hw - 0.2]].forEach(([x, z], i) => nav.setMatrixAt(i, m.makeTranslation(x, S - 1.2, z)));
  nav.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(12), 3);
  details.add(nav);
  // gộp phần bê tông của nhịp quay riêng (không trộn với phần cố định)
  const cm = new THREE.Mesh(mergeGeometries(sw.concreteParts), M.deckSlab); cm.receiveShadow = true; swing.add(cm);
  for (const o of [details, ...sw.noReflect]) o.traverse((c) => c.layers.set(1));
  bridge.farHide.push(...sw.noReflect.filter((o) => !bridge.farHide.includes(o)));
  bridge.group.add(swing);
  Object.assign(bridge, { swing, swingDetails: details, pins, nav });
}

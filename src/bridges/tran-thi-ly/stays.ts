import * as THREE from 'three';
import { CONFIG } from '../../config';
import { lerp } from '../../common/math';
import { prepColored, segmentMatrix } from '../../common/geometry';
import { TTL, ttlRoadY, ttlPylonSection, ttlPylonPoint } from './profile';
import type { TranThiLyBridge } from './TranThiLyBridge';

/* [stayCables] mặt trước rẻ quạt + 2 mặt sau rẻ quạt xoắn, ống HDPE
   Trả về danh sách dây: { a: điểm neo tháp, b: điểm neo dầm, plane: 0 trước / −1, +1 sau } */
export function ttlStayList() {
  const out: { a: THREE.Vector3; b: THREE.Vector3; plane: number; k: number }[] = [], [tLo, tHi] = TTL.anchorT;
  // Mặt trước: một mặt phẳng ở tim cầu, nửa rẻ quạt — neo cao nhất trên tháp ↔ neo xa nhất trên dầm
  for (let i = 0; i < TTL.staysFront; i++) {
    const k = i / (TTL.staysFront - 1), t = lerp(tHi, tLo, k), s = ttlPylonSection(t);
    const x = TTL.pylonX + lerp(TTL.frontDeck[1], TTL.frontDeck[0], k);
    out.push({ a: ttlPylonPoint(t, s.front - 0.3, 0), b: new THREE.Vector3(x, ttlRoadY(x) + 0.9, 0), plane: 0, k });
  }
  // Hai mặt sau: rẻ quạt xoắn — neo cao nhất trên tháp ↔ neo GẦN tháp nhất ở mép ngoài dầm,
  // neo thấp nhất ↔ xa nhất; các dây giao chéo nhau, bề mặt gần một paraboloid hyperbolic
  for (const sz of [-1, 1]) for (let i = 0; i < TTL.staysBack; i++) {
    const k = i / (TTL.staysBack - 1), t = lerp(tHi, tLo, k), s = ttlPylonSection(t);
    const x = TTL.pylonX - lerp(TTL.backDeck[0], TTL.backDeck[1], k);
    out.push({ a: ttlPylonPoint(t, s.back + 0.3, sz * (s.Wz / 2 - 0.35)), b: new THREE.Vector3(x, ttlRoadY(x) - 0.3, sz * TTL.backDeckZ), plane: sz, k });
  }
  return out;
}
export function ttlBuildStays(bridge: TranThiLyBridge) {
  const M = bridge.mats, list = ttlStayList(), m = new THREE.Matrix4(), cyl = new THREE.CylinderGeometry(1, 1, 1, 8);
  const stays = new THREE.InstancedMesh(new THREE.CylinderGeometry(1, 1, 1, 8, CONFIG.weather.wind.cableSegs), M.stay, list.length);   // nhiều đoạn dọc để shader lắc uốn cong được dây
  const hdpe = new THREE.InstancedMesh(cyl, M.hdpe, list.length);
  const towerBox = new THREE.InstancedMesh(new THREE.BoxGeometry(1.3, 0.9, 1.3), M.pylon, list.length);
  const deckBox = new THREE.InstancedMesh(prepColored(new THREE.BoxGeometry(1.1, 0.9, 1.1)), M.concrete, list.length);
  const dir = new THREE.Vector3();
  list.forEach(({ a, b }, i) => {
    stays.setMatrixAt(i, segmentMatrix(a, b, TTL.stayR, m));
    dir.subVectors(a, b).normalize();
    hdpe.setMatrixAt(i, segmentMatrix(b, b.clone().addScaledVector(dir, TTL.hdpeLen), TTL.hdpeR, m));
    towerBox.setMatrixAt(i, m.makeTranslation(a.x, a.y, a.z));
    deckBox.setMatrixAt(i, m.makeTranslation(b.x, b.y - 0.3, b.z));
  });
  stays.castShadow = true;
  bridge.group.add(stays);
  bridge.details.add(hdpe, towerBox, deckBox);
  bridge.stats.stays = list.length;
}

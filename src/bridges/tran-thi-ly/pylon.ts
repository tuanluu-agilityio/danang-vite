import * as THREE from 'three';
import { prepColored, loftRings, loftOct, boxAt, type LoftRing } from '../../common/geometry';
import { TTL, ttlPylonSection, ttlPylonMatrix, ttlPylonPoint } from './profile';
import type { TranThiLyBridge } from './TranThiLyBridge';

/* [pylon] tháp nghiêng 12° về Tây, khối đế, 2 gối cầu, đèn báo */
export function ttlBuildPylon(bridge: TranThiLyBridge) {
  const M = bridge.mats, rings: LoftRing[] = [];
  for (let i = 0; i < TTL.pylonRings; i++) {
    const t = 0.03 + (1 - 0.03) * i / (TTL.pylonRings - 1);     // bắt đầu hơi cao để phần chân chìm trong khối đế
    const s = ttlPylonSection(t);
    rings.push({ sx: s.Lx, sz: s.Wz, cx: s.back + s.Lx / 2, cz: 0, y: t * TTL.axisLen, ch: Math.min(0.7, 0.14 * Math.min(s.Lx, s.Wz)) });
  }
  const g = loftRings(rings); g.applyMatrix4(ttlPylonMatrix); g.computeVertexNormals();
  const pylon = new THREE.Mesh(g, M.pylon); pylon.name = 'ttl-pylon'; pylon.castShadow = pylon.receiveShadow = true;
  bridge.group.add(pylon);
  // khối đế nằm ngang trên 2 gối cầu, bệ móng trong sông
  const X = TTL.pylonX;
  bridge.concreteParts.push(prepColored(loftOct([16, 7], [14.5, 6.4], TTL.pylonBaseY, 6.6, [X + 2, 0], [X + 1.4, 0], 0.6)));
  bridge.concreteParts.push(prepColored(boxAt(30, 6.5, 28, X + 2, -2.75, 0, 8)));
  // 2 gối cầu cầu khổng lồ (~250.000 kN mỗi gối): đế thép + chỏm cầu
  for (const bx of [X - 1.5, X + 5.5]) {
    bridge.steelParts.push(new THREE.CylinderGeometry(TTL.bearingR, TTL.bearingR + 0.25, 0.5, 24).translate(bx, 0.75, 0).toNonIndexed());
    bridge.steelParts.push(new THREE.SphereGeometry(TTL.bearingR * 0.9, 20, 8, 0, Math.PI * 2, 0, Math.PI / 2).scale(1, 0.38, 1).translate(bx, 1.0, 0).toNonIndexed());
  }
  // đèn báo hàng không trên đỉnh
  const top = ttlPylonSection(1), beacons = new THREE.InstancedMesh(new THREE.SphereGeometry(0.55, 10, 8), M.beacon, 2), m = new THREE.Matrix4(), p = new THREE.Vector3();
  [-1, 1].forEach((sz, i) => { ttlPylonPoint(1, top.back + top.Lx / 2, sz * 0.9, p); beacons.setMatrixAt(i, m.makeTranslation(p.x, p.y + 0.8, p.z)); });
  bridge.group.add(beacons);
}

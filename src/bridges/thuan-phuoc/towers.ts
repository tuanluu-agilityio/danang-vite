import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { lerp } from '../../common/math';
import { prepColored, wetLineColor, loftOct, boxAt } from '../../common/geometry';
import { TP, tpRoadY } from './profile';
import type { ThuanPhuocBridge } from './ThuanPhuocBridge';

/* [towers] tháp BTCT chữ H, yên ngựa, gối cầu, đèn báo hàng không */
export function tpBuildTowers(bridge: ThuanPhuocBridge) {
  const M = bridge.mats, towerParts = [], concrete = [], steel = [];
  const [b0x, b0z] = TP.legBase, [b1x, b1z] = TP.legTop;
  for (const sx of [-1, 1]) {
    const X = sx * TP.towerX;
    concrete.push(prepColored(boxAt(26, TP.pileCapTop + 6, 40, X, (TP.pileCapTop - 6) / 2, 0, 12), wetLineColor)); // bệ cọc
    for (const sz of [-1, 1]) {
      // bệ trụ dưới mỗi cột
      towerParts.push(prepColored(loftOct([b0x + 3.2, b0z + 3.0], [b0x + 2.2, b0z + 2.2], TP.pileCapTop, TP.plinthTop,
        [X, sz * (TP.legZBase + 0.2)], [X, sz * TP.legZBase], TP.chamfer * 1.6), wetLineColor));
      // cột tháp thon dần, nghiêng nhẹ vào trong
      towerParts.push(prepColored(loftOct([b0x, b0z], [b1x, b1z], TP.plinthTop, TP.towerTop,
        [X, sz * TP.legZBase], [X, sz * TP.legZTop], TP.chamfer)));
      // yên ngựa: hộp đế + nắp cong che cáp
      steel.push(boxAt(4.4, 0.8, 2.8, X, TP.towerTop + 0.4, sz * TP.cablePlaneZ));
      const cap = new THREE.CylinderGeometry(1.4, 1.4, 4.4, 16, 1, false, -Math.PI / 2, Math.PI); // nửa trụ, vòm hướng lên
      cap.rotateX(-Math.PI / 2); cap.rotateY(Math.PI / 2);
      cap.translate(X, TP.towerTop + 0.8, sz * TP.cablePlaneZ); steel.push(cap);
    }
    // dầm ngang trên và dưới (z tính tới tim cột ở cao độ tương ứng)
    const zAt = (y: number) => lerp(TP.legZBase, TP.legZTop, (y - TP.plinthTop) / TP.towerHeight);
    const [t0, t1] = TP.topBeam, [l0, l1] = TP.lowBeam;
    towerParts.push(prepColored(loftOct([3.4, 2 * zAt(t0)], [3.4, 2 * zAt(t1)], t0, t1, [X, 0], [X, 0], 0.35)));
    towerParts.push(prepColored(loftOct([4.6, 2 * zAt(l0)], [4.6, 2 * zAt(l1)], l0, l1, [X, 0], [X, 0], 0.35)));
    // gối cầu trên dầm ngang dưới
    for (const z of [-6, 6]) steel.push(boxAt(1.4, tpRoadY(X) - TP.girderDepth - l1, 1.4, X, (l1 + tpRoadY(X) - TP.girderDepth) / 2, z));
  }
  const towers = new THREE.Mesh(mergeGeometries(towerParts), M.tower);
  towers.name = 'tp-towers'; towers.castShadow = towers.receiveShadow = true;
  bridge.group.add(towers);
  bridge.concreteParts.push(...concrete);
  bridge.steelParts.push(...steel.map((g) => (g.index ? g.toNonIndexed() : g)));
  // đèn báo hàng không trên đỉnh 4 cột
  const beacons = new THREE.InstancedMesh(new THREE.SphereGeometry(0.55, 10, 8), M.beacon, 4);
  const m = new THREE.Matrix4(); let k = 0;
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) beacons.setMatrixAt(k++, m.makeTranslation(sx * TP.towerX, TP.towerTop + 2.5, sz * TP.cablePlaneZ));
  bridge.group.add(beacons);
}

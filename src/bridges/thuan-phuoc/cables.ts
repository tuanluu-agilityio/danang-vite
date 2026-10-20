import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { lerp } from '../../common/math';
import { segmentMatrix, UP } from '../../common/geometry';
import { TP, tpRoadY, tpCableY, tpHangerStations } from './profile';
import type { ThuanPhuocBridge } from './ThuanPhuocBridge';

/* [cables] cáp chủ, 114 hanger và kẹp cáp */
export function tpBuildCables(bridge: ThuanPhuocBridge) {
  const M = bridge.mats, tubes = [], Zc = TP.cablePlaneZ;
  // 3 đoạn mỗi mặt phẳng: nhịp biên Tây, nhịp chính, nhịp biên Đông (gãy góc tại yên ngựa)
  const spans = [[-TP.cableAnchorX, -TP.towerX], [-TP.towerX, TP.towerX], [TP.towerX, TP.cableAnchorX]];
  for (const sz of [-1, 1]) for (const [a, b] of spans) {
    const n = Math.max(12, Math.round((b - a) / 2)), pts = [];
    for (let i = 0; i <= n; i++) { const x = lerp(a, b, i / n); pts.push(new THREE.Vector3(x, tpCableY(x), sz * Zc)); }
    tubes.push(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), n * 2, TP.cableRadius, 10, false));
  }
  const cables = new THREE.Mesh(mergeGeometries(tubes), M.cable); cables.name = 'tp-main-cables'; cables.castShadow = true;
  bridge.group.add(cables);

  // Hanger (114) và kẹp cáp tại mỗi hanger
  const st = tpHangerStations(), hangers = new THREE.InstancedMesh(new THREE.CylinderGeometry(1, 1, 1, 6), M.hanger, st.length * 2);
  const bands = new THREE.InstancedMesh(new THREE.CylinderGeometry(1, 1, 1, 12), M.steel, st.length * 2);
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), tng = new THREE.Vector3(), sc = new THREE.Vector3();
  let k = 0;
  for (const { x, special } of st) for (const sz of [-1, 1]) {
    const top = new THREE.Vector3(x, tpCableY(x) - TP.cableRadius, sz * Zc);
    const bot = new THREE.Vector3(x, tpRoadY(x) - 0.9, sz * (TP.girderTip + 0.05));
    hangers.setMatrixAt(k, segmentMatrix(top, bot, special ? TP.hangerRSpecial : TP.hangerR, m));
    tng.set(1, tpCableY(x + 0.5) - tpCableY(x - 0.5), 0).normalize();
    q.setFromUnitVectors(UP, tng);
    bands.setMatrixAt(k, m.compose(new THREE.Vector3(x, tpCableY(x), sz * Zc), q, sc.set(TP.bandRadius, 1.2, TP.bandRadius)));
    k++;
  }
  bridge.group.add(hangers);
  bridge.details.add(bands);
  bridge.stats.hangers = k;
}

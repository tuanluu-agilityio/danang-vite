import * as THREE from 'three';
import { CONFIG } from '../../config';
import { prepColored, extrudeAlongX, boxAt, loftOct, fillBlock } from '../../common/geometry';
import { TP, tpRoadY } from './profile';
import type { ThuanPhuocBridge } from './ThuanPhuocBridge';

/* [approaches] cầu dẫn BTCT, khối neo cáp, mố, đường đắp, trụ cầu dẫn */
export function tpBuildApproaches(bridge: ThuanPhuocBridge) {
  const A = TP.anchorX, E = TP.endX, R = TP.embankment, hw = TP.deckWidth / 2, dd = TP.approachDepth;
  // Dầm hộp BTCT dự ứng lực liên tục: bản cánh rộng, sườn vát
  const sec = [[-hw, 0], [hw, 0], [hw, -0.3], [5.2, -0.6], [4.4, -dd], [-4.4, -dd], [-5.2, -0.6], [-hw, -0.3]];
  for (const s of [-1, 1]) {
    const [a, b] = s > 0 ? [A, E] : [-E, -A];
    bridge.concreteParts.push(prepColored(extrudeAlongX(sec, a, b, 160, tpRoadY)));
    // khối neo cáp: thân neo dưới mặt cầu + buồng neo hai bên
    const top = TP.roadAnchorY - TP.girderDepth - 0.5;
    bridge.concreteParts.push(prepColored(boxAt(48, top + 1, 32, s * (A + 16), (top - 1) / 2, 0, 4)));
    for (const sz of [-1, 1]) bridge.concreteParts.push(prepColored(loftOct([24, 5], [22, 4.4], top, TP.anchorCableY + 1.6,
      [s * (A + 14), sz * 12], [s * (A + 14), sz * 12], 0.4)));
    // mố cầu + tường chắn đường đắp
    bridge.concreteParts.push(prepColored(boxAt(6, tpRoadY(E) - CONFIG.landY + 1, TP.deckWidth + 2, s * E, (tpRoadY(E) + CONFIG.landY - 1) / 2 - 0.3, 0)));
    const [f0, f1] = s > 0 ? [E, E + R] : [-E - R, -E];
    bridge.concreteParts.push(prepColored(fillBlock(f0, f1, TP.deckWidth, 0, CONFIG.landY - 0.5, (x) => tpRoadY(x) - 0.05, 40), () => 0.82));
  }
  // Trụ cầu dẫn (InstancedMesh): thân trụ ô-van + xà mũ
  const xs = [];
  for (const s of [-1, 1]) for (let i = 1; i < TP.approachSpans; i++) xs.push(s * (A + i * TP.approachSpanLen));
  const colGeo = prepColored(new THREE.CylinderGeometry(1, 1, 1, 20).translate(0, 0.5, 0));
  const capGeo = prepColored(new THREE.BoxGeometry(1, 1, 1));
  const cols = new THREE.InstancedMesh(colGeo, bridge.mats.concrete, xs.length);
  const caps = new THREE.InstancedMesh(capGeo, bridge.mats.concrete, xs.length);
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), v = new THREE.Vector3(), sc = new THREE.Vector3();
  xs.forEach((x, i) => {
    const capTop = tpRoadY(x) - dd, capH = 1.6, h = capTop - capH - (CONFIG.landY - 1);
    cols.setMatrixAt(i, m.compose(v.set(x, CONFIG.landY - 1, 0), q, sc.set(1.4, h, 2.6)));
    caps.setMatrixAt(i, m.compose(v.set(x, capTop - capH / 2, 0), q, sc.set(3.0, capH, 11)));
  });
  cols.castShadow = caps.castShadow = true; cols.receiveShadow = caps.receiveShadow = true;
  bridge.group.add(cols, caps);
}

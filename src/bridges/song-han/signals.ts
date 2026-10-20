import * as THREE from 'three';
import { MAT } from '../../core/materials';
import { UP } from '../../common/geometry';
import { SH, shRoadY } from './profile';
import type { SwingController } from './SwingController';
import type { SongHanBridge } from './SongHanBridge';

/* [lighting] barie + đèn tín hiệu + đèn hàng hải */
export function shBuildSignals(bridge: SongHanBridge) {
  const M = bridge.mats, bx = SH.barrierX, curb = SH.hw - SH.sidewalk + 0.15;
  // 4 barie: mỗi đầu nhịp quay chặn cả hai làn; tay barie quay quanh trụ ở mép lề
  bridge.barrierSpec = [];
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) bridge.barrierSpec.push({ x: sx * bx, z: sz * curb, sz });
  const arm = new THREE.BoxGeometry(0.14, 0.14, curb - SH.median / 2 + 0.1).translate(0, 0, -(curb - SH.median / 2 + 0.1) / 2);
  bridge.arms = new THREE.InstancedMesh(arm, M.barrier, 4); bridge.arms.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  const housing = new THREE.InstancedMesh(new THREE.BoxGeometry(0.45, 1.0, 0.45).translate(0, 0.5, 0), M.housing, 4), m = new THREE.Matrix4();
  bridge.barrierSpec.forEach((b, i) => housing.setMatrixAt(i, m.makeTranslation(b.x, shRoadY(b.x) + 0.25, b.z)));
  bridge.details.add(bridge.arms, housing);
  // 4 cột đèn tín hiệu (đỏ / vàng / xanh) đặt trên lề, trước barie theo hướng xe tới
  const poles = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.08, 0.1, 4.2, 6).translate(0, 2.1, 0), MAT.lampPole, 4);
  const heads = new THREE.InstancedMesh(new THREE.BoxGeometry(0.4, 1.3, 0.4), M.mech, 4);
  bridge.signalLamps = new THREE.InstancedMesh(new THREE.SphereGeometry(0.13, 10, 8), M.lamp, 12);
  bridge.signalLamps.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(36), 3);
  bridge.barrierSpec.forEach((b, i) => {
    const x = b.x - Math.sign(b.x) * 3, z = b.z + b.sz * 1.3, y = shRoadY(x) + 0.25;
    poles.setMatrixAt(i, m.makeTranslation(x, y, z)); heads.setMatrixAt(i, m.makeTranslation(x, y + 3.9, z));
    for (let j = 0; j < 3; j++) bridge.signalLamps.setMatrixAt(i * 3 + j, m.makeTranslation(x - Math.sign(b.x) * 0.22, y + 4.3 - j * 0.4, z));
  });
  bridge.details.add(poles, heads, bridge.signalLamps);
  // đèn hàng hải trên trụ quay
  bridge.pierNav = new THREE.InstancedMesh(new THREE.SphereGeometry(0.35, 10, 8), M.lamp, 2);
  bridge.pierNav.setMatrixAt(0, m.makeTranslation(0, SH.drumTop + 0.4, SH.drumR - 0.4));
  bridge.pierNav.setMatrixAt(1, m.makeTranslation(0, SH.drumTop + 0.4, -SH.drumR + 0.4));
  bridge.pierNav.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(6), 3);
  bridge.details.add(bridge.pierNav);
}
export function shUpdateSignals(bridge: SongHanBridge, ctrl: SwingController, elapsed: number) {
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), qy = new THREE.Quaternion(), v = new THREE.Vector3(), one = new THREE.Vector3(1, 1, 1);
  const raise = (1 - ctrl.barrier) * THREE.MathUtils.degToRad(84);
  bridge.barrierSpec.forEach((b, i) => {
    qy.setFromAxisAngle(UP, b.sz > 0 ? 0 : Math.PI);
    q.setFromAxisAngle(new THREE.Vector3(1, 0, 0), raise);
    bridge.arms.setMatrixAt(i, m.compose(v.set(b.x, shRoadY(b.x) + 1.15, b.z), qy.clone().multiply(q), one));
  });
  bridge.arms.instanceMatrix.needsUpdate = true;
  const blink = (elapsed % 1) < 0.5, c = bridge.signalLamps.instanceColor.array as Float32Array;
  for (let i = 0; i < 4; i++) {
    const red = ctrl.signal === 'red' ? (ctrl.state === 'REOPEN_TRAFFIC' || blink ? 3 : 0.3) : 0.12;
    const amb = ctrl.signal === 'amber' ? 3 : 0.12, grn = ctrl.signal === 'green' ? 2.2 : 0.1;
    c.set([red, red * 0.08, red * 0.05, amb, amb * 0.6, 0, grn * 0.1, grn, grn * 0.35], i * 9);
  }
  bridge.signalLamps.instanceColor.needsUpdate = true;
  // đèn hàng hải: đỏ/xanh cố định khi đóng, vàng nhấp nháy khi đang quay hoặc mở
  const moving = ctrl.state !== 'CLOSED', nc = bridge.nav.instanceColor.array as Float32Array, pc = bridge.pierNav.instanceColor.array as Float32Array;
  for (let i = 0; i < 4; i++) {
    const col = moving ? (blink ? [3, 1.6, 0.1] : [0.2, 0.1, 0]) : (i % 2 ? [0.1, 1.8, 0.4] : [1.8, 0.1, 0.1]);
    nc.set(col, i * 3);
  }
  for (let i = 0; i < 2; i++) pc.set(moving ? (blink ? [3, 1.6, 0.1] : [0.2, 0.1, 0]) : [1.6, 1.6, 1.4], i * 3);
  bridge.nav.instanceColor.needsUpdate = bridge.pierNav.instanceColor.needsUpdate = true;
  // chốt khóa đầu cánh: 1 = đã đẩy vào trụ đón
  const L = SH.swingHalf;
  [[-1, -2.4], [-1, 2.4], [1, -2.4], [1, 2.4]].forEach(([s, z], i) => {
    bridge.pins.setMatrixAt(i, m.makeTranslation(s * (L - 0.9 + ctrl.pin * 1.6), SH.deckY - SH.swingDepth + 0.6, z));
  });
  bridge.pins.instanceMatrix.needsUpdate = true;
}

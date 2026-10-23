import * as THREE from 'three';
import { prepColored } from '../../common/geometry';
import { SW, swCabinPos } from './profile';

/* ===== 64 cabin: một InstancedMesh, viên nang đứng vỏ đỏ, dải kính quanh giữa =====
   Cabin treo ngoài vành ở bán kính cabinR, luôn đứng thẳng khi lặng gió (ma trận chỉ có phép tịnh tiến). Giai đoạn 3 cập nhật theo góc quay.
   Giai đoạn 6: có gió thì cabin nghiêng quanh điểm treo (con lắc), xem swCabinPose. */
export function swCabinGeometry() {
  const C = SW.cabin;
  const g = new THREE.CapsuleGeometry(C.r, C.len, 4, 12);
  return prepColored(g, (_x, y) => (Math.abs(y) < C.glass ? [0.2, 0.28, 0.36] : [0.8, 0.1, 0.07]));
}

/* Gió lên cabin (hệ cục bộ): amp = góc nghiêng tối đa (rad, 0 = lặng gió), t = đồng hồ lắc (s), (dx, dz) = hướng gió thổi tới, đơn vị */
export interface SwSway { amp: number; t: number; dx: number; dz: number }

const _v = new THREE.Vector3(), _a = new THREE.Vector3();

/* Tư thế cabin i: vị trí tâm (cục bộ) và phép quay. Không gió: chỉ tịnh tiến, quay = đơn vị.
   Có gió: cabin treo từ điểm cao hơn tâm pivotUp, nghiêng góc a = amp·(mean + (1 − mean)·sin(ω·t + i·phase)) về phía khuất gió (đáy lệch xuôi gió) */
export function swCabinPose(i: number, theta: number, sway: SwSway | null, outPos: THREE.Vector3, outQuat: THREE.Quaternion) {
  swCabinPos(i, theta, outPos);
  outQuat.identity();
  if (!sway || !(sway.amp > 0)) return;
  const S = SW.storm.sway, a = sway.amp * (S.mean + (1 - S.mean) * Math.sin(S.omega * sway.t + i * S.phase));
  outQuat.setFromAxisAngle(_a.set(sway.dz, 0, -sway.dx), -a);
  _v.set(0, -S.pivotUp, 0).applyQuaternion(outQuat);
  outPos.y += S.pivotUp; outPos.add(_v);
}

/* đặt cabin theo góc vòng quay theta (rad) và gió */
export function swPlaceCabins(mesh: THREE.InstancedMesh, theta: number, sway: SwSway | null = null) {
  const m = new THREE.Matrix4(), p = new THREE.Vector3(), q = new THREE.Quaternion(), one = new THREE.Vector3(1, 1, 1);
  for (let i = 0; i < SW.cabins; i++) { swCabinPose(i, theta, sway, p, q); mesh.setMatrixAt(i, m.compose(p, q, one)); }
  mesh.instanceMatrix.needsUpdate = true;
  mesh.computeBoundingSphere();
}

export function swBuildCabins(mat: THREE.Material) {
  const mesh = new THREE.InstancedMesh(swCabinGeometry(), mat, SW.cabins);
  mesh.name = 'sw-cabins';
  swPlaceCabins(mesh, 0);
  return mesh;
}

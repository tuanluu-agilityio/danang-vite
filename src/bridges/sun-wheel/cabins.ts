import * as THREE from 'three';
import { prepColored } from '../../common/geometry';
import { SW, swCabinPos } from './profile';

/* ===== 64 cabin: một InstancedMesh, viên nang đứng vỏ đỏ, dải kính quanh giữa =====
   Cabin treo ngoài vành ở bán kính cabinR, luôn đứng thẳng (ma trận chỉ có phép tịnh tiến). Giai đoạn 3 cập nhật theo góc quay. */
export function swCabinGeometry() {
  const C = SW.cabin;
  const g = new THREE.CapsuleGeometry(C.r, C.len, 4, 12);
  return prepColored(g, (_x, y) => (Math.abs(y) < C.glass ? [0.2, 0.28, 0.36] : [0.8, 0.1, 0.07]));
}

/* đặt cabin theo góc vòng quay theta (rad) */
export function swPlaceCabins(mesh: THREE.InstancedMesh, theta: number) {
  const m = new THREE.Matrix4(), p = new THREE.Vector3();
  for (let i = 0; i < SW.cabins; i++) mesh.setMatrixAt(i, m.makeTranslation(swCabinPos(i, theta, p)));
  mesh.instanceMatrix.needsUpdate = true;
  mesh.computeBoundingSphere();
}

export function swBuildCabins(mat: THREE.Material) {
  const mesh = new THREE.InstancedMesh(swCabinGeometry(), mat, SW.cabins);
  mesh.name = 'sw-cabins';
  swPlaceCabins(mesh, 0);
  return mesh;
}

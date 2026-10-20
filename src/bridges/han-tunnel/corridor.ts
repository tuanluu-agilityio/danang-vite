import * as THREE from 'three';
import { scene } from '../../core/renderer';
import { MAT } from '../../core/materials';
import { HR } from './profile';

/* [corridor] Dọn nhà, cây, cột đèn nằm trên hành lang tuyến hầm (từ kè ra tới hai đầu đường dẫn).
   KHÔNG đụng tới chuỗi rand() của khu phố: chỉ thu nhỏ các instance về 0 sau khi cảnh đã dựng, giống hideBankTrees() của Cầu sông Hàn. */
export function hrClearCorridor() {
  scene.updateMatrixWorld(true);
  const plants = new Set<THREE.Material>([MAT.trunk, MAT.leaf, MAT.palm, MAT.lampPole, MAT.bulb]);
  const zero = new THREE.Matrix4().makeScale(0, 0, 0), m = new THREE.Matrix4(), p = new THREE.Vector3(), q = new THREE.Quaternion(), s = new THREE.Vector3();
  const half = HR.halfWidth + 3.5;    // lòng đường + vỉa hè
  let removed = 0;
  scene.traverse((obj) => {
    const o = obj as THREE.InstancedMesh;
    if (!o.isInstancedMesh) return;
    const building = !!o.parent && (o.parent as THREE.LOD).isLOD;
    if (!building && !plants.has(o.material as THREE.Material)) return;
    let changed = false;
    for (let i = 0; i < o.count; i++) {
      o.getMatrixAt(i, m); m.decompose(p, q, s); p.applyMatrix4(o.matrixWorld);
      if (Math.abs(p.x) < 262) continue;                                    // trên sông chỉ có thuyền
      const reach = half + (building ? s.z / 2 : 1);
      if (Math.abs(p.z - HR.z) < reach) { o.setMatrixAt(i, zero); changed = true; removed++; }
    }
    if (changed) o.instanceMatrix.needsUpdate = true;
  });
  return removed;
}

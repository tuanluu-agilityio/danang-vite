import * as THREE from 'three';
import { MAT } from '../core/materials';
import { _e } from './traffic';

export interface BridgeBoat { x: number; z: number; dir: number; speed: number; len: number; w: number; h: number; cab: number }
export interface Boats { list: BridgeBoat[]; hull: THREE.InstancedMesh; cabin: THREE.InstancedMesh; roof: THREE.InstancedMesh }

/* list: [{ x, z, dir, speed, len, w, h, cab }] — thuyền chạy dọc sông (trục Z cục bộ) */
export function createBoats(bridge: { life: THREE.Group }, list: BridgeBoat[]): Boats {
  const box = new THREE.BoxGeometry(1, 1, 1);
  const B: Boats = {
    list,
    hull: new THREE.InstancedMesh(box, MAT.hull, list.length),
    cabin: new THREE.InstancedMesh(box, MAT.boatCabin, list.length),
    roof: new THREE.InstancedMesh(box, MAT.boatRoof, list.length)
  };
  for (const mm of [B.hull, B.cabin, B.roof]) { mm.frustumCulled = false; mm.castShadow = true; bridge.life.add(mm); }
  return B;
}
export function stepBoats(B: Boats, dt: number, elapsed: number, zMin: number, zMax: number) {
  const q = new THREE.Quaternion(), m = new THREE.Matrix4(), s = new THREE.Vector3(), o = new THREE.Vector3(), base = new THREE.Vector3();
  B.list.forEach((b, i) => {
    b.z += b.dir * b.speed * dt; if (b.z > zMax) b.z = zMin; if (b.z < zMin) b.z = zMax;
    q.setFromEuler(_e.set(Math.sin(elapsed * 0.8 + i) * 0.012, 0, Math.sin(elapsed + i * 2) * 0.018));
    base.set(b.x, 0, b.z);
    B.hull.setMatrixAt(i, m.compose(o.set(0, 0.5, 0).applyQuaternion(q).add(base), q, s.set(b.w, b.h, b.len)));
    B.cabin.setMatrixAt(i, m.compose(o.set(0, b.h - 0.2 + b.cab / 2, -b.len * 0.12).applyQuaternion(q).add(base), q, s.set(b.w * 0.8, b.cab, b.len * 0.45)));
    B.roof.setMatrixAt(i, m.compose(o.set(0, b.h - 0.2 + b.cab + 0.2, -b.len * 0.12).applyQuaternion(q).add(base), q, s.set(b.w * 0.9, 0.35, b.len * 0.5)));
  });
  B.hull.instanceMatrix.needsUpdate = B.cabin.instanceMatrix.needsUpdate = B.roof.instanceMatrix.needsUpdate = true;
}

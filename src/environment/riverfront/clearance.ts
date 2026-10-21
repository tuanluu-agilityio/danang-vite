import * as THREE from 'three';
import { scene } from '../../core/renderer';
import { MAT } from '../../core/materials';

/* [clearance] Dọn nhà, cây, cột đèn ngẫu nhiên đè lên công trình mới mà KHÔNG đụng tới chuỗi rand() của khu phố:
   sau khi cảnh đã dựng, gán ma trận scale 0 cho instance bị đè (cả level near lẫn far của LOD nhà), giống corridor.ts của hầm. */
export interface Rect { x0: number; x1: number; z0: number; z1: number }
export interface Building { mesh: THREE.InstancedMesh; i: number; x: number; z: number; w: number; d: number; h: number }

const plants = () => new Set<THREE.Material>([MAT.trunk, MAT.leaf, MAT.palm, MAT.lampPole, MAT.bulb]);
const _m = new THREE.Matrix4(), _p = new THREE.Vector3(), _q = new THREE.Quaternion(), _s = new THREE.Vector3(), _zero = new THREE.Matrix4().makeScale(0, 0, 0);

/* Các InstancedMesh nhà (con của THREE.LOD do buildCity dựng); level 0 là bản gần có cửa sổ */
function buildingMeshes() {
  const out: { mesh: THREE.InstancedMesh; near: boolean }[] = [];
  scene.traverse((o) => {
    const m = o as THREE.InstancedMesh;
    if (m.isInstancedMesh && m.parent && (m.parent as THREE.LOD).isLOD) out.push({ mesh: m, near: (m.parent as THREE.LOD).levels[0]?.object === m });
  });
  return out;
}
/* Nhà đang hiện (scale > 0) ở level near, tọa độ thế giới */
export function collectBuildings(): Building[] {
  scene.updateMatrixWorld(true);
  const list: Building[] = [];
  for (const { mesh, near } of buildingMeshes()) {
    if (!near) continue;
    for (let i = 0; i < mesh.count; i++) {
      mesh.getMatrixAt(i, _m); _m.decompose(_p, _q, _s);
      if (_s.x < 1e-6) continue;
      _p.applyMatrix4(mesh.matrixWorld);
      list.push({ mesh, i, x: _p.x, z: _p.z, w: _s.x, d: _s.z, h: _s.y });
    }
  }
  return list;
}
/* Ảnh chụp ma trận nhà ngay trước khi dọn, để kiểm tra "nhà không bị dọn giữ nguyên ma trận" */
export const snapshot = new Map<THREE.InstancedMesh, Float32Array>();

export function clearRects(rects: Rect[], margin: number) {
  scene.updateMatrixWorld(true);
  const pl = plants(); let nb = 0, np = 0;
  const hit = (x: number, z: number, hw: number, hd: number) => rects.some((r) => x + hw > r.x0 - margin && x - hw < r.x1 + margin && z + hd > r.z0 - margin && z - hd < r.z1 + margin);
  scene.traverse((obj) => {
    const o = obj as THREE.InstancedMesh;
    if (!o.isInstancedMesh) return;
    const building = !!o.parent && (o.parent as THREE.LOD).isLOD;
    if (!building && !pl.has(o.material as THREE.Material)) return;
    if (building && !snapshot.has(o)) snapshot.set(o, (o.instanceMatrix.array as Float32Array).slice());
    let changed = false;
    for (let i = 0; i < o.count; i++) {
      o.getMatrixAt(i, _m); _m.decompose(_p, _q, _s);
      if (_s.x < 1e-6) continue;
      _p.applyMatrix4(o.matrixWorld);
      if (hit(_p.x, _p.z, building ? _s.x / 2 : 1.5, building ? _s.z / 2 : 1.5)) { o.setMatrixAt(i, _zero); changed = true; building ? nb++ : np++; }
    }
    if (changed) o.instanceMatrix.needsUpdate = true;
  });
  return { buildings: nb, plants: np };
}

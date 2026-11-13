/* ===== Nhà ven sông (D-038, M3): hạ chiều cao nhà trong dải sát sông, gán họ + màu tường =====
   Gọi NGAY sau buildCity() trong main.ts, trước mọi nơi đọc ma trận nhà (hành lang Hầm, riverfront, dọn đường lái xe, Vòng quay, kit).
   - Duyệt các THREE.LOD của buildCity (level 0 near có cửa sổ, level 1 far khối trơn: cùng thứ tự instance, city.ts). Nhà có 0 ≤ |x| − bankX ≤ band
     và x ≤ beachX: chỉ đổi scale Y của ma trận instance (cả near lẫn far, giữ y hệt nhau); vị trí, w, d giữ nguyên.
   - Cùng lúc gán họ (thuộc tính aFam của near: mặt đứng theo họ trong patchWindows) và màu tường (màu instance near, far × 0,92 như city.ts)
     ⇒ mặt đứng theo họ KHÔNG phụ thuộc kit.glb: kit lỗi / ?buildings=off thì nhà vẫn thấp, có màu, có mặt đứng; chỉ thiếu phụ kiện.
   - Chiều cao, họ, màu: families.ts (băm vị trí, không rand()). */
import * as THREE from 'three';
import { CONFIG } from '../../config';
import { scene } from '../../core/renderer';
import { bkReshapeH, bkFamily, bkWall } from './families';

export interface BkShaped { x: number; z: number; h0: number; h: number; fam: number }
let shaped: BkShaped[] = [];
export const bkShaped = () => shaped;

/* t = khoảng cách tới kè / bề rộng dải (0..1); âm hoặc > 1 = ngoài dải */
export const bkBandT = (x: number) => (Math.abs(x) - CONFIG.bankX) / CONFIG.buildings.band;
export const bkInBand = (x: number) => { const t = bkBandT(x); return t >= 0 && t <= 1 && x <= CONFIG.buildings.beachX; };

export function bkReshape(): BkShaped[] {
  const B = CONFIG.buildings, out: BkShaped[] = [];
  const m = new THREE.Matrix4(), p = new THREE.Vector3(), q = new THREE.Quaternion(), s = new THREE.Vector3(), c = new THREE.Color();
  const lods: THREE.LOD[] = [];
  scene.traverse((o) => { const l = o as THREE.LOD; if (l.isLOD && (l.levels[0]?.object as THREE.InstancedMesh)?.isInstancedMesh && (l.levels[0].object as THREE.InstancedMesh).geometry.getAttribute('aFam')) lods.push(l); });
  for (const lod of lods) {
    const near = lod.levels[0].object as THREE.InstancedMesh, far = lod.levels[1]?.object as THREE.InstancedMesh | undefined;
    const af = near.geometry.getAttribute('aFam') as THREE.BufferAttribute;
    let touched = false;
    for (let i = 0; i < near.count; i++) {
      near.getMatrixAt(i, m); m.decompose(p, q, s);
      if (s.x < 1e-6) continue;
      const x = lod.position.x + p.x, z = lod.position.z + p.z;
      if (!bkInBand(x)) continue;
      const h0 = s.y, t = bkBandT(x), h = bkReshapeH(h0, x, z, t, B.reshape), fam = bkFamily(h, x, z, B.bands, t);
      s.y = h; m.compose(p, q, s);
      near.setMatrixAt(i, m); if (far?.isInstancedMesh) far.setMatrixAt(i, m);
      af.setX(i, fam);
      c.setHex(bkWall(fam, x, z, B.facade[fam]?.walls ?? [], B.bayPalette));
      if (near.instanceColor) near.setColorAt(i, c);
      if (far?.instanceColor) far.setColorAt(i, c.multiplyScalar(0.92));
      out.push({ x, z, h0, h, fam });
      touched = true;
    }
    if (!touched) continue;
    for (const im of [near, far]) {
      if (!im?.isInstancedMesh) continue;
      im.instanceMatrix.needsUpdate = true; if (im.instanceColor) im.instanceColor.needsUpdate = true;
      im.boundingSphere = null; im.boundingBox = null;            // khung bao tính lại lần vẽ đầu (cắt khung nhìn theo chiều cao mới)
    }
    af.needsUpdate = true;
  }
  shaped = out;
  return out;
}

import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { CONFIG } from '../config';
import { scene } from '../core/renderer';
import { MAT } from '../core/materials';
import { shadowed } from '../common/geometry';
import { HR_HOLES } from '../bridges/han-tunnel/profile';

/* ============================ Bờ sông Hàn & mặt đất ============================ */
export function buildRiverBanks() {
  const B = CONFIG.bankX, Y = CONFIG.landY;
  // Bờ Tây (trung tâm) và bờ Đông (Sơn Trà / Mỹ Khê); phía Bắc là vịnh Đà Nẵng
  const landGeos = [];
  const box = (x0: number, x1: number, z0: number, z1: number, y0: number, y1: number) => { const b = new THREE.BoxGeometry(x1 - x0, y1 - y0, z1 - z0); b.translate((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2); return b; };
  // khoét hai hố cho máng hầm hở của Hầm vượt sông Hàn (không dùng rand nên không ảnh hưởng chuỗi ngẫu nhiên)
  const carved = (x0: number, x1: number, z0: number, z1: number) => {
    let cur = x0;
    for (const h of HR_HOLES.filter((q) => q.x0 >= x0 && q.x1 <= x1).sort((a, b) => a.x0 - b.x0)) {
      landGeos.push(box(cur, h.x0, z0, z1, -6, Y), box(h.x0, h.x1, z0, h.z0, -6, Y), box(h.x0, h.x1, h.z1, z1, -6, Y)); cur = h.x1;
    }
    landGeos.push(box(cur, x1, z0, z1, -6, Y));
  };
  carved(-14000, -B, -2600, 14000);
  carved(B, 1480, -2300, 14000);
  scene.add(shadowed(new THREE.Mesh(mergeGeometries(landGeos), MAT.land), false, true));
  // Bãi biển Mỹ Khê
  const sand = new THREE.Mesh(box(1480, 1600, -2300, 14000, -6, 1.2), MAT.sand); sand.receiveShadow = true; scene.add(sand);
  // Kè đá hai bờ (tường đứng) + lan can thấp
  const walls = [box(-B - 2, -B, -2600, 14000, -3, Y + 0.5), box(B, B + 2, -2300, 14000, -3, Y + 0.5)];
  const wallGeo = mergeGeometries(walls);
  // UV lặp theo chiều dài kè
  scene.add(shadowed(new THREE.Mesh(wallGeo, MAT.stone), false, true));
  // Dải đi bộ ven sông
  const prom = [box(-B - 26, -B - 2, -2600, 14000, Y, Y + 0.05), box(B + 2, B + 26, -2300, 14000, Y, Y + 0.05)];
  scene.add(shadowed(new THREE.Mesh(mergeGeometries(prom), MAT.paver), false, true));
}

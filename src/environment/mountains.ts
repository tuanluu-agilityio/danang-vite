import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { scene } from '../core/renderer';
import { MAT } from '../core/materials';

/* Núi Sơn Trà (đông bắc) và dãy Hải Vân (tây bắc) làm đường chân trời */
export function buildMountains() {
  const geos = [];
  const peak = (x: number, z: number, r: number, h: number, seed: number) => {
    const g = new THREE.ConeGeometry(r, h, 28, 7); const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const y = p.getY(i); if (y > h / 2 - 1) continue;
      const a = Math.atan2(p.getZ(i), p.getX(i)), ph = seed * 1.7;
      const k = 1 + 0.16 * Math.sin(a * 5 + ph + y * 0.004) + 0.08 * Math.sin(a * 11 - ph * 2 + y * 0.01);
      p.setX(i, p.getX(i) * k); p.setZ(i, p.getZ(i) * k); p.setY(i, y + h * 0.04 * Math.sin(a * 7 + ph));
    }
    g.translate(x, h / 2 - 8, z); g.computeVertexNormals(); geos.push(g.toNonIndexed());
  };
  // Sơn Trà: hai khối (1) và (3) dời lên phía Bắc để không đè lên đầu cầu dẫn phía Đông của Cầu Thuận Phước
  peak(2600, -4700, 1700, 690, 1); peak(3300, -3100, 1200, 520, 2); peak(1750, -4350, 1100, 430, 3); peak(2800, -4300, 1300, 560, 4);
  peak(-4200, -6500, 2600, 1100, 5); peak(-6200, -5600, 2400, 900, 6); peak(-2600, -7200, 2000, 760, 7);
  scene.add(new THREE.Mesh(mergeGeometries(geos), MAT.mountain));
}

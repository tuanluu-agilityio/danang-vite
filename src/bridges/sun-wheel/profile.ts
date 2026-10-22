import * as THREE from 'three';
import { CONFIG } from '../../config';

/* [config] Vòng quay Mặt Trời: hình học thuần, dùng được trong views/presets.ts và test. Thông số ở CONFIG.sunWheel */
export const SW = CONFIG.sunWheel;

/* Hệ cục bộ của công trình: X dọc mặt vòng quay (phương vị 83°), Y lên, Z theo trục quay (+Z về mặt Nam Đông Nam, có biển và quảng trường).
   group đặt ở (SW.x, 0, SW.z) và xoay SW.yaw quanh Y; cao độ cục bộ dùng cao độ thế giới (mặt đất = landY). */

/* Góc cabin i khi vòng quay ở góc theta (rad, 0 = cabin 0 ở giờ 3, ngược chiều kim đồng hồ nhìn từ mặt Nam) */
export const swCabinAngle = (i: number, theta: number) => theta + i * SW.cabinStep;

/* Vị trí tâm cabin trong hệ cục bộ: trục ở (0, hubY), cabin treo ngoài vành ở bán kính cabinR */
export function swCabinPos(i: number, theta: number, out = new THREE.Vector3()) {
  const a = swCabinAngle(i, theta);
  return out.set(Math.cos(a) * SW.cabinR, SW.hubY + Math.sin(a) * SW.cabinR, 0);
}

/* Đổi điểm cục bộ sang thế giới (không cần scene.updateMatrixWorld: dùng trong test và dọn nền) */
export function swToWorld(lx: number, ly: number, lz: number, out = new THREE.Vector3()) {
  const c = Math.cos(SW.yaw), s = Math.sin(SW.yaw);
  return out.set(SW.x + lx * c + lz * s, ly, SW.z - lx * s + lz * c);
}

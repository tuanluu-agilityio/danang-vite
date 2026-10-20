import { CONFIG } from '../../config';

/* [config] Hầm vượt sông Hàn: thông số ở CONFIG.hanTunnel.
   Tọa độ cục bộ: tim sông là x = 0, group dời tới z = −1700; trục Tây (−x) → Đông (+x). Mét. */
export const HR = CONFIG.hanTunnel;
export const hrRoadY = HR.roadY;
export const hrBedY = HR.bedY;
export const hrFlat = () => CONFIG.roadY;
/* Nóc ống và đáy bản đáy tại x */
export const hrRoofY = (x: number) => HR.roadY(x) + HR.roofTop;
export const hrFloorY = (x: number) => HR.roadY(x) - HR.slabBelow;

export type HrZone = 'immersed' | 'cover' | 'ramp' | 'approach' | 'street';
export function hrZone(x: number): HrZone {
  const a = Math.abs(x);
  return a <= HR.immersedHalf ? 'immersed' : a <= HR.coverHalf ? 'cover' : a <= HR.rampHalf ? 'ramp' : a <= HR.approachHalf ? 'approach' : 'street';
}
/* Hố khoét trên mặt đất cho hai máng hầm hở (tọa độ thế giới) — đọc bởi environment/river.ts và shader nước */
export interface Hole { x0: number; x1: number; z0: number; z1: number }
export const HR_HOLES: Hole[] = [[-HR.rampHalf, -HR.coverHalf], [HR.coverHalf, HR.rampHalf]]
  .map(([x0, x1]) => ({ x0, x1, z0: HR.z - HR.halfWidth + 0.3, z1: HR.z + HR.halfWidth - 0.3 }));

/* Cao độ đáy hào nạo vét của hầm dìm (dưới bản đáy 0,6 m lớp đá dăm đệm) và nửa bề rộng miệng hào */
export const hrTrenchY = (x: number) => HR.roadY(x) - HR.slabBelow - 0.6;
export const hrTrenchTop = (x: number) => HR.trenchBottomHalf + HR.trenchSlope * Math.max(0, HR.bedY(x) - hrTrenchY(x));

/* Vị trí ống xe: dir = +1 là ống phía Nam (xe chạy hướng Đông, bên phải), −1 là ống phía Bắc */
export const hrTubeZ = (dir: number) => dir * HR.tubeCenter;
/* Có nên coi camera ở trong lòng hầm (để bật nội thất, chỉnh mắt thích nghi) */
export function hrInside(x: number, y: number, z: number) {
  return Math.abs(z - HR.z) < HR.halfWidth && Math.abs(x) < HR.rampHalf && y < CONFIG.landY - 0.2;
}

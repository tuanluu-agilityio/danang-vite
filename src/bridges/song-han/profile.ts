import * as THREE from 'three';
import { CONFIG } from '../../config';
import { lerp } from '../../common/math';

/* [config] Cầu sông Hàn: thông số ở CONFIG.songHan.
   Tọa độ cục bộ: tâm trụ quay là gốc (x = 0 ở tim sông), group dời tới z = −1.080. Mét. */
export const SH = CONFIG.songHan;

let shLut: number[][] = null;
export function shRoadY(x: number) {
  if (Math.abs(x) <= SH.fixedStart) return SH.deckY;                   // nhịp quay phẳng tuyệt đối
  const P = SH.roadProfile;
  if (x <= P[0][0] || x >= P[P.length - 1][0]) return CONFIG.roadY;
  if (!shLut) {
    const c = new THREE.CatmullRomCurve3(P.map(([a, b]) => new THREE.Vector3(a, b, 0)), false, 'centripetal');
    shLut = c.getPoints(3000).map((v) => [v.x, v.y]).sort((a, b) => a[0] - b[0]);
  }
  let lo = 0, hi = shLut.length - 1;
  while (hi - lo > 1) { const mid = (lo + hi) >> 1; if (shLut[mid][0] < x) lo = mid; else hi = mid; }
  const [x0, y0] = shLut[lo], [x1, y1] = shLut[hi];
  return Math.max(CONFIG.roadY, lerp(y0, y1, (x - x0) / Math.max(1e-6, x1 - x0)));
}
export const shFlat = () => SH.deckY;

import { CONFIG } from '../../config';
import { lerp, clamp } from '../../common/math';

/* [config] Cầu Thuận Phước: thông số ở CONFIG.thuanPhuoc; mọi kích thước tính bằng mét.
   Gốc tọa độ cục bộ: tim cầu; group dời tới z = CONFIG.thuanPhuoc.z. */
export const TP = CONFIG.thuanPhuoc;

/* Cao độ mặt đường theo x: vồng parabol trên phần cầu treo, hạ dần qua 12 nhịp dẫn
   (đường cong Hermite liền dốc, dốc ≤ ~4%), rồi đường đắp về mặt đất. */
export function tpRoadY(x: number) {
  const ax = Math.abs(x), A = TP.anchorX, E = TP.endX, R = TP.embankment;
  const pE = CONFIG.roadY + TP.abutmentRise, gE = -TP.abutmentRise / R; // dốc tại mố
  const herm = (t: number, p0: number, m0: number, p1: number, m1: number) => {
    const t2 = t * t, t3 = t2 * t;
    return (2 * t3 - 3 * t2 + 1) * p0 + (t3 - 2 * t2 + t) * m0 + (-2 * t3 + 3 * t2) * p1 + (t3 - t2) * m1;
  };
  if (ax <= A) return TP.roadCenterY - (TP.roadCenterY - TP.roadAnchorY) * (ax / A) ** 2;
  if (ax <= E) {
    const L = E - A, m0 = -2 * (TP.roadCenterY - TP.roadAnchorY) / A * L;
    return herm((ax - A) / L, TP.roadAnchorY, m0, pE, gE * L);
  }
  if (ax <= E + R) return herm((ax - E) / R, pE, gE * R, CONFIG.roadY, 0);
  return CONFIG.roadY;
}
/* Cao độ tim cáp chủ: parabol y = y_top − 4f·u(1 − u) */
export function tpCableY(x: number) {
  const ax = Math.abs(x);
  if (ax <= TP.towerX) { const u = (x + TP.towerX) / TP.mainSpan; return TP.saddleY - 4 * TP.sag * u * (1 - u); }
  const t = clamp((ax - TP.towerX) / (TP.cableAnchorX - TP.towerX), 0, 1);
  return lerp(TP.saddleY, TP.anchorCableY, t) - 4 * TP.sideSag * t * (1 - t);
}
/* Vị trí hanger theo x (một mặt phẳng cáp) */
export function tpHangerStations() {
  const out: { x: number; special: boolean }[] = [], nM = TP.hangersMain, dM = TP.mainSpan / (nM + 1), dS = TP.sideSpan / (TP.hangersSide + 1);
  for (let i = 0; i < nM; i++) out.push({ x: -TP.towerX + (i + 1) * dM, special: i < 2 || i >= nM - 2 || i === (nM - 1) / 2 });
  for (const s of [-1, 1]) for (let i = 0; i < TP.hangersSide; i++) {
    out.push({ x: s * (TP.towerX + (i + 1) * dS), special: i === 0 || i === TP.hangersSide - 1 });
  }
  return out;
}

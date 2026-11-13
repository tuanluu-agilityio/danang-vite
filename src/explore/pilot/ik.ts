/* ===== Người treo dù: IK hai khớp giải tích (src/explore/pilot/ik.ts) =====
   Thuần số học, không import three, không cấp phát: vectơ là mảng số (ArrayLike / number[]) dùng lại.
   Dùng cho cánh tay (vai → khuỷu → cổ tay) tới quai phanh; đích ngoài tầm được kẹp về tầm với để khớp không gãy. */

/* Hai khớp: gốc a, dài l1 (a → khuỷu), l2 (khuỷu → đầu mút), đích t, cực p là ĐIỂM trong cùng hệ tọa độ (khuỷu nằm lệch về phía p so với đường a → đích).
   Ghi vị trí khuỷu vào outElbow, đầu mút (đã kẹp vào tầm với) vào outEnd; trả true nếu đích nằm trong tầm [|l1 − l2|, (l1 + l2) × 0.999] */
export function plTwoBone(a: ArrayLike<number>, l1: number, l2: number, t: ArrayLike<number>, p: ArrayLike<number>, outElbow: number[], outEnd: number[]): boolean {
  const ax = a[0], ay = a[1], az = a[2];
  let dx = t[0] - ax, dy = t[1] - ay, dz = t[2] - az;
  let dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
  const maxR = (l1 + l2) * 0.999, minR = Math.abs(l1 - l2) * 1.001 + 1e-6;
  const inReach = dist >= minR && dist <= maxR;
  let ux: number, uy: number, uz: number;
  if (dist > 1e-9) { ux = dx / dist; uy = dy / dist; uz = dz / dist; }
  else { ux = 1; uy = 0; uz = 0; dist = 0; }   // đích trùng gốc: chọn hướng tùy ý, vẫn không NaN
  const c = dist > maxR ? maxR : dist < minR ? minR : dist;
  /* Khuỷu: x dọc trục a → đích, h vuông góc theo hướng cực */
  const x = (l1 * l1 - l2 * l2 + c * c) / (2 * c);
  const h = Math.sqrt(Math.max(0, l1 * l1 - x * x));
  let px = p[0] - ax, py = p[1] - ay, pz = p[2] - az;
  const along = px * ux + py * uy + pz * uz;
  px -= along * ux; py -= along * uy; pz -= along * uz;   // phần cực vuông góc với trục
  let pl = Math.sqrt(px * px + py * py + pz * pz);
  if (pl < 1e-6) {   // cực song song trục: lấy trục tọa độ ít song song nhất
    const bx = Math.abs(ux) < 0.9 ? 1 : 0, by = bx ? 0 : 1;
    px = by * uz - 0 * uy; py = 0 * ux - bx * uz; pz = bx * uy - by * ux;   // b × u với b = (bx, by, 0)
    pl = Math.sqrt(px * px + py * py + pz * pz) || 1;
  }
  px /= pl; py /= pl; pz /= pl;
  outElbow[0] = ax + ux * x + px * h; outElbow[1] = ay + uy * x + py * h; outElbow[2] = az + uz * x + pz * h;
  outEnd[0] = ax + ux * c; outEnd[1] = ay + uy * c; outEnd[2] = az + uz * c;
  return inReach;
}

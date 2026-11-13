/* ===== Nhà ven sông (D-037 bản 2): chọn họ nhà cho từng tòa =====
   Thuần (không three, không DOM): chạy được trong node (tests/buildings-unit/families.test.ts).
   Họ chọn theo chiều cao sẵn có của tòa (dải [h0, h1) của CONFIG.buildings.bands, spec §6.1) và băm số nguyên của vị trí:
   tất định, KHÔNG gọi rand() / rng() nên chuỗi ngẫu nhiên của khu phố giữ nguyên. */

export interface BkBand { id: number; h0: number; h1: number; w: number }

/* Băm vị trí (m) ra số 0..1: làm tròn tới 0,25 m rồi trộn bit kiểu murmur (Math.imul, 32 bit) */
export function bkHash(x: number, z: number): number {
  let h = Math.imul(Math.round(x * 4) | 0, 0x27d4eb2d) ^ Math.imul(Math.round(z * 4) | 0, 0x165667b1);
  h ^= h >>> 15; h = Math.imul(h, 0x2c1b3c6d); h ^= h >>> 12; h = Math.imul(h, 0x297a2d39); h ^= h >>> 15;
  return (h >>> 0) / 4294967296;
}

/* Họ 1..5 cho tòa cao h (m) ở (x, z); 0 nếu không dải nào nhận chiều cao đó */
export function bkFamily(h: number, x: number, z: number, bands: readonly BkBand[]): number {
  const cand = bands.filter((b) => h >= b.h0 && h < b.h1 && b.w > 0);
  if (!cand.length) return 0;
  const total = cand.reduce((a, b) => a + b.w, 0);
  let t = bkHash(x, z) * total;
  for (const b of cand) { if (t < b.w) return b.id; t -= b.w; }
  return cand[cand.length - 1].id;
}

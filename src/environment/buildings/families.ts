/* ===== Nhà ven sông (D-037 bản 2, D-038): chiều cao mới, họ nhà, màu tường cho từng tòa trong dải sát sông =====
   Thuần (không three, không DOM): chạy được trong node (tests/buildings-unit/families.test.ts).
   Mọi lựa chọn là băm số nguyên của vị trí: tất định, KHÔNG gọi rand() / rng() nên chuỗi ngẫu nhiên của khu phố giữ nguyên.
   - bkReshapeH: chiều cao mới (D-038) theo "tính cách" của đoạn phố (một hàng nhà × một khối giữa hai đường) + lệch từng nhà.
   - bkFamily: họ 1..5 theo dải chiều cao [h0, h1) của CONFIG.buildings.bands, trọng số nội suy theo khoảng cách tới kè (t).
   - bkWall: màu tường (sRGB) theo họ. */

export interface BkBand { id: number; h0: number; h1: number; w: number | readonly number[] }
export interface BkReshapeCfg { near: readonly number[]; far: readonly number[]; stay: number; tube: readonly number[]; mid: readonly number[]; tower: readonly number[]; cap: number; keepTower: number; minH: number }

/* Băm vị trí (m) ra số 0..1: làm tròn tới 0,25 m rồi trộn bit kiểu murmur (Math.imul, 32 bit) */
export function bkHash(x: number, z: number): number {
  let h = Math.imul(Math.round(x * 4) | 0, 0x27d4eb2d) ^ Math.imul(Math.round(z * 4) | 0, 0x165667b1);
  h ^= h >>> 15; h = Math.imul(h, 0x2c1b3c6d); h ^= h >>> 12; h = Math.imul(h, 0x297a2d39); h ^= h >>> 15;
  return (h >>> 0) / 4294967296;
}

const STEP = 36;                                  // m — bước lưới nhà của buildCity (city.ts)
const BLOCK = 5;                                  // ô lưới mỗi khối phố (city.ts chừa đường ở ix % 5 = 0, iz % 5 = 0)
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const clamp01 = (t: number) => Math.min(1, Math.max(0, t));
/* Chiều cao (m) của nhà n tầng: tầng trệt tới y = 6,8 (cao 4,3 m), mỗi tầng trên 3,4 m, chân nhà y = 2,5; cộng tường chắn mái */
export const bkFloorsH = (n: number, cap: number) => 3.4 * (n + 1) - 2.5 + cap;

/* Tính cách đoạn phố của nhà ở (x, z): 0 nhà ống, 1 vừa, 2 tháp. Hàng nhà = ô lưới theo X, đoạn = khối phố theo Z (cùng khối, cùng hàng ⇒ cùng tính cách) */
export function bkBlockKind(x: number, z: number, t: number, R: BkReshapeCfg): number {
  const ix = Math.round(x / STEP), bz = Math.floor(Math.round(z / STEP) / BLOCK);
  const p = [0, 1, 2].map((k) => lerp(R.near[k], R.far[k], clamp01(t)));
  let u = bkHash(ix * 101.3 + 7.1, bz * 57.7 - 3.3) * (p[0] + p[1] + p[2]);
  for (let k = 0; k < 2; k++) { if (u < p[k]) return k; u -= p[k]; }
  return 2;
}

/* Chiều cao mới (m) cho nhà gốc cao h0 ở (x, z), t = khoảng cách tới kè / bề rộng dải (0..1).
   Không cao hơn h0 (trừ khi h0 < minH, không xảy ra với buildCity: h ≥ 9); tháp gốc ≥ 45 m có thể giữ nguyên. */
export function bkReshapeH(h0: number, x: number, z: number, t: number, R: BkReshapeCfg): number {
  let kind = bkBlockKind(x, z, t, R);
  const u = bkHash(x + 3.1, z - 11.7), v = bkHash(x - 17.9, z + 5.3), w = bkHash(x + 29.3, z + 41.1);
  if (u >= R.stay) kind = kind === 1 ? (v < 0.5 ? 0 : 2) : 1;             // lệch một bậc: đoạn nhà ống có khách sạn vừa chen vào, đoạn tháp có nhà vừa…
  const wl = w ** (1.6 - 0.6 * clamp01(t));                              // càng sát kè càng nghiêng về số tầng thấp của bậc
  const pick = (r: readonly number[]) => bkFloorsH(r[0] + Math.min(r[1] - r[0], Math.floor(wl * (r[1] - r[0] + 1))), R.cap);
  let h: number;
  if (kind === 2) h = h0 >= bkFloorsH(R.tower[0], R.cap) && v < R.keepTower ? h0 : pick(R.tower);
  else h = pick(kind === 0 ? R.tube : R.mid);
  h = Math.min(h, h0);
  return Math.max(h, Math.min(h0, R.minH));
}

const wOf = (b: BkBand, t: number) => (typeof b.w === 'number' ? b.w : lerp(b.w[0], b.w[1], clamp01(t)));
/* Họ 1..5 cho tòa cao h (m) ở (x, z), t = khoảng cách tới kè / bề rộng dải (mặc định 0,5); 0 nếu không dải nào nhận chiều cao đó */
export function bkFamily(h: number, x: number, z: number, bands: readonly BkBand[], t = 0.5): number {
  const cand = bands.filter((b) => h >= b.h0 && h < b.h1 && wOf(b, t) > 0);
  if (!cand.length) return 0;
  const total = cand.reduce((a, b) => a + wOf(b, t), 0);
  let r = bkHash(x, z) * total;
  for (const b of cand) { const w = wOf(b, t); if (r < w) return b.id; r -= w; }
  return cand[cand.length - 1].id;
}

/* Màu tường (sRGB hex) của tòa họ fam: chọn trong danh sách của họ (rỗng → dùng fallback, vd. bảng màu khoang nhà ống) */
export function bkWall(fam: number, x: number, z: number, walls: readonly number[], fallback: readonly number[]): number {
  const list = walls.length ? walls : fallback;
  return list[Math.min(list.length - 1, Math.floor(bkHash(x * 1.7 + fam * 13.1, z * 0.9 - fam * 7.7) * list.length))];
}

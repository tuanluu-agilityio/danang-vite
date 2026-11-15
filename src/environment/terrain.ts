import { CONFIG } from '../config';

/* ============================ Địa hình núi: hàm độ cao (D-047) ============================
   Thuần số học, không three, không rand(): nhiễu băm số nguyên nên tất định và không đụng chuỗi seed chung.
   Mỗi khối núi là vài "sống núi" (đường gấp khúc có độ cao + bề rộng sườn tại từng điểm); sườn có dông phụ / khe
   nhờ bề rộng đổi dọc sống và nhiễu sống đã vặn miền. Bán đảo Sơn Trà giữ vị trí các hình nón cũ:
   đỉnh chính (2600, −4700) ≈ 690 m (thật 696 m), nhánh Đông Nam quanh (3300, −3100), đồi thấp phía Tây quanh (1750, −4350). */

const T = CONFIG.sonTra;
export interface Box { x0: number; x1: number; z0: number; z1: number }
export const ST_BOX: Box = { x0: 560, x1: 6500, z0: -6700, z1: -1750 };     // m — khung lấy mẫu Sơn Trà
export const HV_BOX: Box = { x0: -11200, x1: 1700, z0: -10800, z1: -3300 }; // m — khung lấy mẫu dãy Hải Vân

/* ---- nhiễu ---- */
const hash = (ix: number, iz: number) => { let h = Math.imul(ix, 374761393) ^ Math.imul(iz, 668265263); h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
/** Nhiễu giá trị 2D mượt, 0..1, chu kỳ ô = 1 đơn vị. */
export function stNoise(x: number, z: number) {
  const ix = Math.floor(x), iz = Math.floor(z), fx = x - ix, fz = z - iz, u = fx * fx * (3 - 2 * fx), v = fz * fz * (3 - 2 * fz);
  const a = hash(ix, iz), b = hash(ix + 1, iz), c = hash(ix, iz + 1), d = hash(ix + 1, iz + 1);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
export function stFbm(x: number, z: number, oct = 4) { let s = 0, a = 0.5, n = 0; for (let i = 0; i < oct; i++) { s += a * stNoise(x, z); n += a; a *= 0.5; x = x * 2.03 + 17.3; z = z * 2.03 - 9.1; } return s / n; }
/** Nhiễu sống: 1 ở "sống", 0 ở "khe". */
function ridged(x: number, z: number, oct = 3) { let s = 0, a = 0.5, n = 0; for (let i = 0; i < oct; i++) { const r = 1 - Math.abs(2 * stNoise(x, z) - 1); s += a * r * r; n += a; a *= 0.5; x = x * 2.1 + 5.7; z = z * 2.1 + 13.9; } return s / n; }
const sat = (t: number) => (t < 0 ? 0 : t > 1 ? 1 : t), sstep = (a: number, b: number, t: number) => { t = sat((t - a) / (b - a)); return t * t * (3 - 2 * t); };
const smax = (a: number, b: number, k: number) => { const h = Math.max(k - Math.abs(a - b), 0) / k; return Math.max(a, b) + h * h * k * 0.25; };

/* ---- sống núi: [x, z, cao (m), bề rộng sườn (m)] ---- */
type Pt = [number, number, number, number];
const ST_SPINES: Pt[][] = [
  // sống chính Tây → Đông: đồi thấp phía Tiên Sa, vai Tây, đỉnh ra-đa rộng, yên ngựa, hai đỉnh phía Đông rồi hạ xuống mũi
  [[1230, -4260, 130, 500], [1640, -4420, 330, 740], [2060, -4630, 520, 940], [2370, -4700, 650, 1150], [2600, -4700, 696, 1240], [2840, -4680, 664, 1200], [3110, -4640, 585, 1120], [3520, -4540, 640, 1160], [4010, -4370, 500, 1040], [4520, -4160, 556, 1020], [5020, -3910, 380, 880], [5500, -3660, 240, 680], [5880, -3470, 70, 420]],
  // dông phía Bắc xuống biển
  [[2600, -4700, 696, 1240], [2520, -5330, 390, 760], [2380, -5850, 170, 520]],
  [[3520, -4540, 640, 1160], [3720, -5180, 330, 700], [3830, -5650, 130, 460]],
  // nhánh Đông Nam (chỗ hình nón thứ hai cũ), hạ dần về phía Mỹ Khê
  [[3520, -4540, 600, 900], [3420, -3900, 385, 800], [3300, -3220, 468, 860], [3250, -2640, 250, 640], [3210, -2230, 60, 360]],
  // dông Tây Nam từ đỉnh chính xuống phía thành phố
  [[2600, -4700, 696, 1240], [2330, -4160, 380, 700], [2120, -3760, 150, 480]]
];
const HV_SPINES: Pt[][] = [
  [[-10400, -5300, 380, 1500], [-8600, -5350, 640, 1900], [-7000, -5650, 930, 2150], [-5600, -6150, 760, 1900], [-4200, -6600, 1100, 2400], [-3200, -7050, 800, 1950], [-2300, -7500, 705, 1750], [-1100, -8000, 420, 1350], [100, -8500, 190, 900]],
  [[-4200, -6600, 1100, 2400], [-4500, -8100, 720, 1800], [-5200, -9500, 420, 1300]],
  [[-7000, -5650, 930, 2150], [-7600, -7400, 640, 1700]]
];

/* Độ cao thô của một sống tại (x, z): mặt cắt sườn lõm, đỉnh sống bo nhẹ. Bề rộng sườn đổi theo "tọa độ vòng quanh sống"
   (đi dọc sườn bên này, vòng qua mũi, về theo sườn bên kia, vòng qua gốc: liền mạch, nhiễu lấy trên đường tròn nên khép kín)
   ⇒ dông phụ và khe chạy từ sống xuống chân như núi bị xói, không phải gò tròn. */
const ridge1 = (n: number) => { const r = 1 - Math.abs(2 * n - 1); return r * r; };
const sD = new Float64Array(16), sH = new Float64Array(16), sW = new Float64Array(16), sS = new Float64Array(16);   // vùng nhớ tạm theo đoạn sống (≤ 16 đoạn)
function spineH(pts: Pt[], x: number, z: number, seed: number) {
  let best = 1e18, side = 1, acc = 0, seg = 0, tt = 0;
  const m = pts.length - 1;
  for (let i = 0; i < m; i++) {
    const a = pts[i], b = pts[i + 1], dx = b[0] - a[0], dz = b[1] - a[1], L2 = dx * dx + dz * dz, L = Math.sqrt(L2);
    const t = sat(((x - a[0]) * dx + (z - a[1]) * dz) / L2), px = a[0] + dx * t, pz = a[1] + dz * t, d2 = (x - px) * (x - px) + (z - pz) * (z - pz), s = t * t * (3 - 2 * t);
    sD[i] = Math.sqrt(d2); sH[i] = a[2] + (b[2] - a[2]) * s; sW[i] = a[3] + (b[3] - a[3]) * s; sS[i] = acc + t * L;
    if (d2 < best) { best = d2; side = dx * (z - a[1]) - dz * (x - a[0]) > 0 ? 1 : -1; seg = i; tt = t; }
    acc += L;
  }
  // H, W, S trộn mượt giữa các đoạn gần ngang nhau: ở phía lõm của chỗ sống đổi hướng, điểm gần nhất nhảy từ đoạn này sang đoạn kia, không trộn thì thành vách thẳng
  const d = Math.sqrt(best), tau = 30 + 0.22 * d; let H = 0, W = 0, S = 0, ws = 0;
  for (let i = 0; i < m; i++) { const w = Math.exp(-(sD[i] - d) / tau); if (w < 1e-4) continue; H += w * sH[i]; W += w * sW[i]; S += w * sS[i]; ws += w; }
  H /= ws; W /= ws; S /= ws;
  if (d >= W * (1 + T.spurAmp)) return 0;
  // tọa độ vòng quanh sống c ∈ [0, C)
  const n = pts.length, Re = pts[n - 1][3] * 0.55, Rs = pts[0][3] * 0.55, C = 2 * acc + Math.PI * (Re + Rs);
  let c: number;
  if (seg === n - 2 && tt >= 1) { const a = pts[n - 2], b = pts[n - 1], dx = b[0] - a[0], dz = b[1] - a[1]; const k = (Math.PI / 2 - Math.atan2(dx * (z - b[1]) - dz * (x - b[0]), dx * (x - b[0]) + dz * (z - b[1]))) / Math.PI; c = S + k * (2 * acc + Math.PI * Re - 2 * S); }   // nội suy giữa giá trị hai mép mũi (tính từ S đã trộn) ⇒ liền với hai sườn
  else if (seg === 0 && tt <= 0) { const a = pts[0], b = pts[1], dx = a[0] - b[0], dz = a[1] - b[1]; const k = (Math.PI / 2 - Math.atan2(dx * (z - a[1]) - dz * (x - a[0]), dx * (x - a[0]) + dz * (z - a[1]))) / Math.PI, c0 = 2 * acc + Math.PI * Re - S; c = c0 + k * (C + S - c0); }
  else c = side > 0 ? S : 2 * acc + Math.PI * Re - S;
  const ang = c / C * Math.PI * 2, ca = Math.cos(ang), sa = Math.sin(ang), per = (len: number, o: number) => { const r = C / (Math.PI * 2 * len); return stNoise(o + r * ca, o * 1.7 + 3.3 + r * sa); };
  const o = seed * 9.1 + 20;
  const fine = 1 - 0.8 * sat(d / W);   // khe mịn nhạt dần về chân: độ lệch tỉ lệ với khoảng cách tới sống, để nguyên thì chân núi thành nếp gấp dốc đứng
  const lobe = per(T.spurLen, o) * 0.52 + (ridge1(per(T.spurLen * 0.42, o + 40)) * 0.34 + ridge1(per(T.spurLen * 0.23, o + 80)) * 0.14) * fine + 0.16 * (1 - fine);
  const w = W * (1 - T.spurAmp + 2 * T.spurAmp * lobe), r0 = T.crestRound * W;
  const u = (Math.sqrt(d * d + r0 * r0) - r0) / w;
  if (u >= 1) return 0;
  const crest = 1 - T.crestVar * (1 - stNoise(S / T.crestLen + seed * 3.7, seed + 7.7));   // đường sống nhấp nhô
  return H * crest * Math.pow(1 - u, T.slopePow) * (1 - T.footEase * u * u);
}
function massif(spines: Pt[][], x: number, z: number, seed: number) {
  // vặn miền để dông / đường bờ không thẳng
  let wx = x + (stFbm(x / T.warpLen + seed, z / T.warpLen - seed, 3) - 0.5) * 2 * T.warpAmp, wz = z + (stFbm(x / T.warpLen - 31.7, z / T.warpLen + 12.9 + seed, 3) - 0.5) * 2 * T.warpAmp;
  wx += (stNoise(x / T.warp2Len + 91.3, z / T.warp2Len + seed) - 0.5) * 2 * T.warp2Amp; wz += (stNoise(x / T.warp2Len - 44.1, z / T.warp2Len - 3 * seed) - 0.5) * 2 * T.warp2Amp;   // vặn nhỏ: khe không song song đều nhau
  let h = 0;
  for (let i = 0; i < spines.length; i++) { const s = spineH(spines[i], wx, wz, seed + i * 11), k = Math.min(T.blend, Math.min(h, s) * 1.5); h = k > 1e-3 ? smax(h, s, k) : Math.max(h, s); }   // độ mượt co về 0 ở chân để không đội nền lên
  if (h <= 0) return -T.seaDrop;
  // khe xói: nhiễu sống khoét lưng chừng sườn (không khoét đỉnh sống, không khoét chân)
  const mid = sat(h / 140) * (1 - T.gullyCrest * sat(h / 700));
  const g = ridged(wx / T.gullyLen + seed * 1.7, wz / T.gullyLen - seed * 2.3, 3);
  h *= 1 - T.gullyAmp * (1 - g) * mid;
  // gồ ghề nhỏ + đường bờ lệch
  h += (stFbm(x / T.bumpLen + seed, z / T.bumpLen, 3) - 0.5) * 2 * T.bumpAmp * sat(h / 90);
  return h - T.seaDrop * (1 - sat(h / 110)) - (stFbm(x / 620 - seed, z / 620 + seed, 2) - 0.35) * T.coastAmp * (1 - sat(h / 70));
}

/** 0 trong vùng đất liền bờ Đông (đất, đường, nhà quanh đầu Đông Cầu Thuận Phước), tăng tới 1 khi ra xa `keepRamp` m. */
export function stLandMask(x: number, z: number) { const dx = Math.max(0, x - T.keepX), dz = Math.max(0, T.keepZ - z); return sstep(0, T.keepRamp, Math.hypot(dx, dz)); }

/** Độ cao Sơn Trà (m, so với mặt nước y = 0; âm = chìm). Trong vùng đất liền núi bị ép dưới mặt đất. */
export function stHeight(x: number, z: number) {
  const raw = massif(ST_SPINES, x, z, 1), m = stLandMask(x, z);
  return m >= 1 ? raw : m * raw + (1 - m) * Math.min(T.keepY, raw);
}
/** Độ cao dãy Hải Vân (m). Hạ về 0 trước mép đất bờ Tây (z > −3900). */
export function hvHeight(x: number, z: number) { const raw = massif(HV_SPINES, x, z, 5); return raw <= 0 ? raw : raw * sstep(-3450, -4300, z) - (1 - sstep(-3450, -4300, z)) * T.seaDrop; }

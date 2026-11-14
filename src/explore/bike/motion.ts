/* ============================ Lái xe máy: chuyển động xe tay ga có nghiêng ============================
   Spec D-040 §5.3 (+ §17.8, §17.9). Giữ khung của drStep (explore/drive/motion.ts): bước con ≤ CONFIG.drive.sim.dt (tối đa sim.steps, phần dư bỏ),
   dời thân bằng drMove, mất phần tốc độ hướng vào vật cản một lần mỗi lần chạm, cọ thì hãm thêm perf.scrape; kết quả không phụ thuộc tần số khung.
   Khác ô tô: người chơi điều khiển độ nghiêng, không phải góc lái.
   - Ga / phanh: throttle, brakeK là lọc bậc một (chính xác theo hàm mũ) của đầu vào; gia tốc dùng trung bình đầu / cuối bước (bậc hai theo h).
     Đường cong tăng tốc khớp như drAccel: a0 = 50 km/h / t50 tới 50 km/h, sau đó a0 · v50 / v · (1 − u^k), k giải sao cho 0 → 80 km/h đúng t80.
     Phanh / phanh gấp nội suy khô ↔ ướt theo grip. Nhả ga hãm coast. Không có số lùi: đứng yên giữ phanh (không ga) thì dắt lùi ≤ walkBack.
   - Tốc độ ≥ vBlend: độ nghiêng đích steer · bkLeanMax(v, grip); lean theo lò xo giảm chấn tới hạn, giải đúng dạng đóng mỗi bước
     (ổn định với mọi h, kể cả 0,1 s); tần số nội suy leanHz → leanHzFast theo v / vMax (nặng tay khi nhanh); độ cong quỹ đạo g · tan(lean) / v².
   - Dưới vBlend: trộn tuyến tính theo v / vBlend với lái động học kiểu xe đạp (góc lái steer tiến về đích theo steerRate, trả theo steerReturn,
     bán kính trục sau nhỏ nhất turnRadius); độ nghiêng đích phần động học atan(v²κ / g). Độ cong từ độ nghiêng kẹp ≤ 1 / turnRadius nên đứng yên
     mà còn nghiêng cũng không xoay tại chỗ. bkLeanMax kẹp tan(lean) ≤ v² / (g · turnRadius): bán kính rẽ không nhỏ hơn bán kính hình học.
   - Giảm xóc trước / sau (chỉ hình + camera): lò xo giảm chấn, Euler ẩn; đích theo gia tốc dọc (phanh chúi đầu, ga nhún đuôi) + nhiễu mặt đường
     rng(sus.seed) theo tốc độ; độ dốc đổi (mối nối ô) hích vận tốc. Vòng tua theo bkRpm, trễ tauUp / tauDown.
   - Xi nhan tự tắt khi đã rẽ quá cancelYaw theo hướng xi nhan rồi trả thẳng, hoặc đi thẳng quá cancelS. stuck: s bị chặn mà vẫn vặn ga.
   - Thân va chạm: người gọi đặt drUseBody(BK_BODY) trước; bkStep không đổi thân. Sơ tán nhịp quay Cầu sông Hàn: drEvacStep rồi lean = 0.
   Quy ước hướng như ô tô: yaw = 0 mũi +X, vectơ tiến (cos yaw, −sin yaw); steer > 0 / lean > 0 = rẽ / nghiêng trái.
   Không cấp phát mỗi khung (D-018). Không import three. */
import { CONFIG } from '../../config';
import { rng } from '../../common/math';
import { drGround, type DrNet } from '../drive/net';
import { drMove, type DrBody, type DrPose, type DrBox } from '../drive/collide';
import { drCreate, drEvacStep, type DrState } from '../drive/motion';

export interface BkInput { gas: number; brake: number; steer: number; hard: boolean; grip: number }   // gas, brake 0..1; steer −1..1 (trái +); hard: phanh gấp; grip 0 (ướt hẳn)..1 (khô)
export interface BkState extends DrState { lean: number; leanV: number; susF: number; susFV: number; susR: number; susRV: number; rpm: number; throttle: number; brakeK: number; acc: number; sig: -1 | 0 | 1; sigYaw: number; sigT: number; stuck: number }   // lean: rad (trái +), leanV: rad/s; susF / susR: m lún giảm xóc (+ = nén), susFV / susRV: m/s; rpm: vòng/phút; throttle, brakeK: 0..1 đã làm mượt; acc: m/s² gia tốc dọc; sig: xi nhan −1 phải / 0 / 1 trái; sigYaw: rad đã rẽ theo hướng xi nhan; sigT: s đi thẳng kể từ lúc bật / lần rẽ cuối; stuck: s bị chặn mà vẫn vặn ga

const B = CONFIG.bike.body, P = CONFIG.bike.perf, CVT = CONFIG.bike.cvt, SUS = CONFIG.bike.sus, SG = CONFIG.bike.signal, SIM = CONFIG.drive.sim;
const L = B.wheelbase, G = P.latG;
export const BK_BODY: DrBody = { hl: B.length / 2, hw: B.width / 2, ax: B.wheelbase / 2, height: B.height };
const V50 = 50 / 3.6, V80 = 80 / 3.6;                                // m/s — mốc t50, t80
const STEER_MAX = Math.atan(L / P.turnRadius);                       // rad — góc lái lớn nhất: bán kính trục sau = turnRadius
const KAPPA_MAX = 1 / P.turnRadius;                                  // 1/m — độ cong lớn nhất
const SUS_W = 2 * Math.PI * SUS.hz;
const NOISE = rng(SUS.seed);                                         // nhiễu mặt đường, chuỗi riêng (không dùng rand())

/* ===== Đường cong tăng tốc ===== */
let A0 = NaN, KEXP = NaN;                                            // a0 (m/s²) và số mũ k, giải lười ở lần gọi đầu
function bkAccelK(v: number, k: number): number {
  if (v <= V50) return A0;
  if (v >= P.vMax) return 0;
  const u = (v - V50) / (P.vMax - V50);
  return A0 * V50 / v * (1 - Math.pow(u, k));
}
/* Thời gian 0 → 80 km/h với số mũ k (tích phân dv / a, điểm giữa) */
function bkT80(k: number): number {
  const N = 2000, h = (V80 - V50) / N;
  let t = V50 / A0;
  for (let i = 0; i < N; i++) t += h / bkAccelK(V50 + (i + 0.5) * h, k);
  return t;
}
function bkFitAccel(): void {
  A0 = V50 / P.t50;
  let lo = 0.2, hi = 50;                                             // k nhỏ ⇒ hãm sớm ⇒ chậm hơn: bkT80 giảm theo k
  for (let i = 0; i < 60; i++) { const m = (lo + hi) / 2; if (bkT80(m) > P.t80) lo = m; else hi = m; }
  KEXP = (lo + hi) / 2;
}
/* m/s² khi vặn hết ga ở tốc độ v ≥ 0 */
export function bkAccel(v: number): number {
  if (Number.isNaN(KEXP)) bkFitAccel();
  return bkAccelK(v, KEXP);
}

/* rad — độ nghiêng lớn nhất ở tốc độ v với độ bám grip: khô ↔ ướt, kẹp để bán kính rẽ không nhỏ hơn turnRadius */
export function bkLeanMax(v: number, grip: number): number {
  const g = grip > 1 ? 1 : grip < 0 ? 0 : grip, m = P.leanMaxWet + (P.leanMax - P.leanMaxWet) * g;
  const geom = Math.atan(v * v / (G * P.turnRadius));
  return geom < m ? geom : m;
}

/* vòng/phút — vòng tua đích của hộp số vô cấp ở tốc độ v (m/s, dấu bỏ qua) và tay ga throttle (0..1).
   Nhả ga: theo tỉ số truyền (idle → engage tới engageV, rồi engage → max tới vMax). Vặn ga: ly tâm trượt ở engage lúc đứng,
   tua lên vùng công suất power khi xe nhích tới engageV, rồi giữ power cho tới khi đường tỉ số vượt lên. */
export function bkRpm(v: number, throttle: number): number {
  const a = Math.abs(v), t = throttle > 1 ? 1 : throttle < 0 ? 0 : throttle;
  const line = a <= CVT.engageV ? CVT.idle + (CVT.engage - CVT.idle) * a / CVT.engageV
    : Math.min(CVT.max, CVT.engage + (CVT.max - CVT.engage) * (a - CVT.engageV) / (P.vMax - CVT.engageV));
  const full = Math.max(line, CVT.engage + (CVT.power - CVT.engage) * Math.min(1, a / CVT.engageV));
  return line + t * (full - line);
}

/* Bật xi nhan hướng dir (1 trái, −1 phải, 0 tắt); bấm lại cùng hướng thì tắt */
export function bkSignal(s: BkState, dir: -1 | 0 | 1): void {
  s.sig = dir !== 0 && s.sig === dir ? 0 : dir;
  s.sigYaw = 0; s.sigT = 0;
}

const bkToward0 = (v: number, d: number): number => v > 0 ? (v > d ? v - d : 0) : (v < -d ? v + d : 0);

/* Dốc dọc từ cao độ mặt đường tại trục trước / sau (dương = mũi cao hơn đuôi, như ô tô); giữ giá trị cũ nếu một trục không có mặt đường cùng tầng */
export function bkPitch(s: BkState, net: DrNet): void {
  const fx = Math.cos(s.yaw) * L / 2, fz = -Math.sin(s.yaw) * L / 2;
  const yf = drGround(net, s.x + fx, s.z + fz, s.y), yr = drGround(net, s.x - fx, s.z - fz, s.y);
  if (!Number.isNaN(yf) && !Number.isNaN(yr)) s.pitch = Math.atan2(yf - yr, L);
}

/* Xe mới ở chỗ xuất phát của slot (như ô tô), đứng yên, thẳng đứng */
export function bkCreate(net: DrNet, slot: number): BkState {
  const c = drCreate(net, slot);
  const s: BkState = { ...c, lean: 0, leanV: 0, susF: 0, susFV: 0, susR: 0, susRV: 0, rpm: CVT.idle, throttle: 0, brakeK: 0, acc: 0, sig: 0, sigYaw: 0, sigT: 0, stuck: 0 };
  bkPitch(s, net);
  return s;
}

/* Về tim làn bên phải của ô mặt đường gần nhất (khoảng cách mặt bằng + chênh cao độ), đứng yên, thẳng đứng.
   Chiều đi theo hậu tố id ô (roadData.ts: .S đi Đông, .N đi Tây, .W đi Nam, .E đi Bắc; đi bên phải); ô không có hậu tố (nút giao)
   thì dọc cạnh dài, chiều gần hướng xe nhất. Tim làn bên phải = tim ô lệch về bên phải một phần tư bề rộng ô. Không có ô nào thì false */
export function bkRecover(s: BkState, net: DrNet): boolean {
  const pads = net.pads;
  let best = -1, bestD = Infinity;
  for (let i = 0; i < pads.length; i++) {
    const p = pads[i];
    if (p.gate !== undefined && net.closed.has(p.gate)) continue;
    const cx = s.x < p.x0 ? p.x0 : s.x > p.x1 ? p.x1 : s.x, cz = s.z < p.z0 ? p.z0 : s.z > p.z1 ? p.z1 : s.z;
    const d = Math.hypot(cx - s.x, cz - s.z) + Math.abs(p.y(cx, cz) - s.y);
    if (d < bestD) { bestD = d; best = i; }
  }
  if (best < 0) return false;
  const p = pads[best], tag = p.id.slice(p.id.lastIndexOf('.') + 1);
  let yaw: number;
  if (tag === 'S') yaw = 0; else if (tag === 'N') yaw = Math.PI; else if (tag === 'W') yaw = -Math.PI / 2; else if (tag === 'E') yaw = Math.PI / 2;
  else if (p.x1 - p.x0 >= p.z1 - p.z0) yaw = Math.cos(s.yaw) >= 0 ? 0 : Math.PI;
  else yaw = Math.sin(s.yaw) >= 0 ? Math.PI / 2 : -Math.PI / 2;
  const alongX = Math.abs(Math.cos(yaw)) > 0.5, hl = BK_BODY.hl;
  const rx = Math.sin(yaw), rz = Math.cos(yaw);                     // vectơ sang phải
  const mx = (p.x0 + p.x1) / 2, mz = (p.z0 + p.z1) / 2;
  const clampIn = (a: number, a0: number, a1: number) => a1 - a0 <= 2 * hl ? (a0 + a1) / 2 : a < a0 + hl ? a0 + hl : a > a1 - hl ? a1 - hl : a;
  s.x = alongX ? clampIn(s.x, p.x0, p.x1) : mx + rx * (p.x1 - p.x0) / 4;
  s.z = alongX ? mz + rz * (p.z1 - p.z0) / 4 : clampIn(s.z, p.z0, p.z1);
  s.y = p.y(s.x, s.z); s.yaw = yaw;
  s.v = 0; s.steer = 0; s.lean = 0; s.leanV = 0; s.throttle = 0; s.brakeK = 0; s.acc = 0; s.braking = false;
  s.slide = 1; s.touch = 0; s.stuck = 0;
  bkPitch(s, net);
  return true;
}

const MOVED: DrPose = { x: 0, y: 0, z: 0, yaw: 0 };

/* Một bước h ≤ sim.dt */
function bkStep1(s: BkState, inp: BkInput, net: DrNet, boxes: DrBox[], nBoxes: number, h: number): void {
  const gas = inp.gas > 0 ? (inp.gas < 1 ? inp.gas : 1) : 0, bIn = inp.hard ? 1 : inp.brake > 0 ? (inp.brake < 1 ? inp.brake : 1) : 0;
  const grip = inp.grip > 1 ? 1 : inp.grip < 0 ? 0 : inp.grip === inp.grip ? inp.grip : 1;   // NaN ⇒ khô
  /* ga, phanh làm mượt; trung bình trong bước */
  const t0 = s.throttle, b0 = s.brakeK;
  s.throttle = gas + (t0 - gas) * Math.exp(-h / P.throttleTau);
  s.brakeK = bIn + (b0 - bIn) * Math.exp(-h / P.brakeTau);
  const thr = (t0 + s.throttle) / 2, bk = (b0 + s.brakeK) / 2;
  const rate = inp.hard ? P.hardBrakeWet + (P.hardBrake - P.hardBrakeWet) * grip : P.brakeWet + (P.brake - P.brakeWet) * grip;
  /* tốc độ */
  const v0 = s.v;
  let v = v0;
  if (v < 0 || (v <= SIM.revV && bIn > 0 && gas === 0)) {
    if (bIn > 0 && gas === 0) {
      if (v > 0) v = Math.max(0, v - bk * rate * h);                  // phanh nốt rồi mới dắt lùi
      else { const tgt = -P.walkBack * bk; v = v > tgt ? Math.max(tgt, v - P.walkBack * h) : Math.min(tgt, v + P.walkBack * h); }
    } else v = bkToward0(v, (P.coast + thr * P.walkBack) * h);        // nhả / vặn ga khi đang dắt lùi: về 0
  } else {
    const a = thr * bkAccel(v) - bk * rate - (v > 0 ? (1 - thr) * P.coast : 0);   // hãm nhả ga chỉ khi đang chạy: đứng yên vặn ga thì nhích ngay
    v = v + a * h;
    v = v < 0 ? 0 : v > P.vMax ? P.vMax : v;
  }
  s.acc = (v - v0) / h;
  const vm = (v0 + v) / 2, av = vm > 0 ? vm : 0, w = av < P.vBlend ? av / P.vBlend : 1;
  /* ghi đông (lái động học khi chậm) */
  const want = inp.steer > 1 ? 1 : inp.steer < -1 ? -1 : inp.steer === inp.steer ? inp.steer : 0;   // NaN ⇒ thẳng
  let st = s.steer;
  if (want === 0) st = bkToward0(st, P.steerReturn * STEER_MAX * h);
  else {
    const tgt = want * STEER_MAX, back = Math.abs(tgt) < Math.abs(st) || tgt * st < 0;
    const d = (back ? Math.max(P.steerRate, P.steerReturn) : P.steerRate) * STEER_MAX * h;
    st = st < tgt ? Math.min(tgt, st + d) : Math.max(tgt, st - d);
  }
  const kKin = Math.tan(st) / L;
  /* độ nghiêng: lò xo giảm chấn tới hạn, nghiệm đúng trên bước h với đích giữ nguyên */
  const tgtLean = w * want * bkLeanMax(av, grip) + (1 - w) * Math.atan(av * av * kKin / G);
  const om = 2 * Math.PI * (P.leanHz + (P.leanHzFast - P.leanHz) * Math.min(1, av / P.vMax));
  const l0 = s.lean, A = l0 - tgtLean, Bc = s.leanV + om * A, e = Math.exp(-om * h);
  let lean = tgtLean + (A + Bc * h) * e, leanV = (Bc - om * (A + Bc * h)) * e;
  if (lean > P.leanMax) { lean = P.leanMax; leanV = 0; } else if (lean < -P.leanMax) { lean = -P.leanMax; leanV = 0; }
  /* độ cong: trộn độ cong từ độ nghiêng (kẹp ≤ 1 / turnRadius) với độ cong động học; xoay = độ cong × quãng */
  const tl = Math.tan((l0 + lean) / 2);
  let kLean = av > 1e-6 ? G * tl / (av * av) : 0;
  if (kLean > KAPPA_MAX) kLean = KAPPA_MAX; else if (kLean < -KAPPA_MAX) kLean = -KAPPA_MAX;
  const kappa = vm >= 0 ? w * kLean + (1 - w) * kKin : kKin;        // dắt lùi: chỉ động học
  /* dời thân xe */
  const dist = vm * h, f = drMove(net, s, dist, dist * kappa, boxes, nBoxes, MOVED);
  const dyaw = MOVED.yaw - s.yaw;
  s.x = MOVED.x; s.y = MOVED.y; s.z = MOVED.z; s.yaw = MOVED.yaw;
  /* va chạm: như drStep1 của ô tô */
  let slide = s.slide ?? 1, touch = s.touch ?? 0;
  if (f < 1) {
    if (touch > 0) v = bkToward0(v, P.scrape * h);
    const q = f > 0 ? Math.sqrt(f) : 0;
    if (q === 0) v = 0;
    else if (q < slide) v *= q / slide;
    if (q < slide) slide = q;
    touch = SIM.touch;
  } else if (touch > 0) { touch -= h; if (touch <= 0) { touch = 0; slide = 1; } }
  s.slide = slide; s.touch = touch;
  s.v = v; s.steer = st; s.lean = lean; s.leanV = leanV; s.braking = bIn > 0;
  s.wheel += dist * f / (B.wheelDia / 2);
  /* bị chặn mà vẫn vặn ga */
  s.stuck = gas > 0 && touch > 0 && Math.abs(v) < 1 ? s.stuck + h : 0;
  /* độ dốc, giảm xóc */
  const p0 = s.pitch;
  bkPitch(s, net);
  const kick = SUS.bumpK * (s.pitch - p0) * Math.abs(vm), n = SUS.noise * Math.min(1, Math.abs(v) / P.vMax);
  const den = 1 + 2 * SUS.damp * SUS_W * h + SUS_W * SUS_W * h * h;
  const tF = -s.acc * SUS.diveK + (NOISE() * 2 - 1) * n, tR = s.acc * SUS.diveK + (NOISE() * 2 - 1) * n;
  s.susFV = (s.susFV + kick + h * SUS_W * SUS_W * (tF - s.susF)) / den; s.susF += h * s.susFV;
  s.susRV = (s.susRV + kick + h * SUS_W * SUS_W * (tR - s.susR)) / den; s.susR += h * s.susRV;
  if (s.susF > SUS.travel) { s.susF = SUS.travel; s.susFV = 0; } else if (s.susF < -SUS.travel) { s.susF = -SUS.travel; s.susFV = 0; }
  if (s.susR > SUS.travel) { s.susR = SUS.travel; s.susRV = 0; } else if (s.susR < -SUS.travel) { s.susR = -SUS.travel; s.susRV = 0; }
  /* vòng tua */
  const rt = bkRpm(v, s.throttle);
  s.rpm = rt + (s.rpm - rt) * Math.exp(-h / (rt > s.rpm ? CVT.tauUp : CVT.tauDown));
  /* xi nhan */
  if (s.sig !== 0) {
    s.sigYaw += dyaw * s.sig;
    if (s.sigYaw >= SG.cancelYaw && want * s.sig <= 0) { s.sig = 0; s.sigYaw = 0; s.sigT = 0; }
    else if (dyaw * s.sig > 0.05 * h) s.sigT = 0;                   // đang rẽ theo hướng xi nhan (> 0,05 rad/s)
    else if ((s.sigT += h) > SG.cancelS) { s.sig = 0; s.sigYaw = 0; s.sigT = 0; }
  }
}

/* Bước mô phỏng cho khung dài dt (s). Đang / cần sơ tán khỏi nhịp quay thì khung dành cho sơ tán (đầu vào bỏ qua), xe thẳng đứng */
export function bkStep(s: BkState, inp: BkInput, net: DrNet, boxes: DrBox[], nBoxes: number, dt: number): void {
  if (drEvacStep(s, net, dt)) { s.lean = 0; s.leanV = 0; s.throttle = 0; s.brakeK = 0; s.acc = 0; s.stuck = 0; return; }
  let rem = dt;
  for (let k = 0; k < SIM.steps && rem > 1e-6; k++) {
    const h = rem < SIM.dt ? rem : SIM.dt;
    bkStep1(s, inp, net, boxes, nBoxes, h);
    rem -= h;
  }
}

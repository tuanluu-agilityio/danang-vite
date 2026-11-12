/* ===== Người treo dù: phản ứng tư thế theo chuyển động (src/explore/pilot/react.ts) =====
   Thuần số học, không import three, không chạm DOM, không cấp phát trong step(). Biến trạng thái bay (rẽ, tăng/giảm tốc, lên/xuống, gió)
   thành các góc tư thế; bước sau (bones.ts) mới áp góc lên xương. Thiết kế: docs/superpowers/specs/2026-11-12-nguoi-du-luon-that-design.md §5.

   Hệ cục bộ của dù: +X hướng bay, +Y lên, +Z phải; yaw tăng = quay trái; `bank > 0` = nghiêng trái. Người treo dưới điểm móc.
   Dấu của từng trường PlPose (dương nghĩa là gì, nhìn từ người bay, quay mặt về hướng bay):
     swingRoll  > 0  quay cả người quanh +X (quy tắc bàn tay phải): thân dưới điểm móc văng sang TRÁI (−Z)       ; rẽ trái → âm (văng ra ngoài)
     swingPitch > 0  quay cả người quanh +Z: thân văng RA TRƯỚC (+X)                                              ; tăng tốc → âm (tụt ra sau), hãm → dương
     swingYaw   > 0  quay cả người quanh +Y: xoay sang TRÁI                                                       ; chỉ do gió
     spineRoll  > 0  thân trên nghiêng sang TRÁI (−Z)                                                             ; rẽ trái → dương (nghiêng vào lượt rẽ)
     spinePitch > 0  thân trên chúi RA TRƯỚC                                                                      ; tăng tốc → dương, lên cao → âm (ngả)
     spineTwist > 0  vai xoay sang TRÁI                                                                           ; rẽ trái → dương
     headYaw    > 0  đầu quay sang TRÁI                                                                           ; rẽ trái → dương
     headRoll   > 0  đầu nghiêng sang TRÁI so với thân (bù một phần góc nghiêng của thân + lắc, giữ đầu gần thẳng)
     legSide    > 0  hai chân đưa sang TRÁI                                                                       ; rẽ trái → âm (quán tính)
     legFore    > 0  hai chân đưa RA TRƯỚC                                                                        ; tăng tốc → âm, hãm → dương
     kneeL/kneeR     độ gập thêm của gối, ≥ 0 (không gập ngược), cộng lên `base.knee`; hãm thì gập
     legSplit   > 0  hai chân dạng ra thêm
     brakeL/brakeR   0..1 mức kéo quai phanh (0 = thả, 1 = kéo hết `toggle.travel`)
     packRoll   > 0  ba lô nghiêng sang TRÁI; packPitch > 0 ba lô chúi ra trước; strap: góc phất đuôi đai (rad, hai chiều)
   Tất cả là góc CỘNG THÊM lên tư thế nền (0 = tư thế nền). */
import { CONFIG } from '../../config';

export interface PlSignals { turn: number; acc: number; vy: number; wind: number }   // turn, acc, vy đã kẹp [-1, 1] (turn > 0 = rẽ trái); wind 0..1 mức gió thời tiết
export interface PlPose {
  swingRoll: number; swingPitch: number; swingYaw: number;   // rad, cả người quanh điểm treo
  spineRoll: number; spinePitch: number; spineTwist: number; // rad, tổng cho 3 đốt
  headYaw: number; headRoll: number;                         // rad
  legSide: number; legFore: number; kneeL: number; kneeR: number; legSplit: number;   // rad
  brakeL: number; brakeR: number;                            // 0..1
  packRoll: number; packPitch: number; strap: number;        // rad, chuyển động phụ
}

/* Chỉ số kênh lò xo (thứ tự trùng PlPose) */
const C_SWR = 0, C_SWP = 1, C_SWY = 2, C_SPR = 3, C_SPP = 4, C_SPT = 5, C_HDY = 6, C_HDR = 7, C_LGS = 8, C_LGF = 9, C_KNL = 10, C_KNR = 11, C_LSP = 12, C_BRL = 13, C_BRR = 14, C_PKR = 15, C_PKP = 16, C_STR = 17, NCH = 18;

const TAU = Math.PI * 2;
const fin = (v: number): number => (Number.isFinite(v) ? v : 0);
const clamp = (v: number, lo: number, hi: number): number => (v < lo ? lo : v > hi ? hi : v);
const clampSym = (v: number): number => clamp(fin(v), -1, 1);

/* Bộ sinh số ngẫu nhiên riêng theo seed (mulberry32): không đụng chuỗi rand() có seed dùng chung của cảnh */
function plRng(seed: number): () => number {
  let s = (Math.floor(fin(seed)) ^ 0x9e3779b9) >>> 0;
  return () => { s = (s + 0x6d2b79f5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

export class PlReact {
  readonly pose: PlPose = { swingRoll: 0, swingPitch: 0, swingYaw: 0, spineRoll: 0, spinePitch: 0, spineTwist: 0, headYaw: 0, headRoll: 0, legSide: 0, legFore: 0, kneeL: 0, kneeR: 0, legSplit: 0, brakeL: 0, brakeR: 0, packRoll: 0, packPitch: 0, strap: 0 };
  private x = new Float64Array(NCH);        // giá trị kênh
  private v = new Float64Array(NCH);        // vận tốc kênh
  private w = new Float64Array(NCH);        // tần số góc rad/s của lò xo từng kênh
  private z = new Float64Array(NCH);        // hệ số tắt từng kênh
  private tg = new Float64Array(NCH);       // đích tạm của bước hiện tại
  private ph = new Float64Array(8);         // pha nhiễu gió theo seed
  private gustAmp: number;
  private t = 0;                            // s thời gian nhiễu gió

  /* opts.gust: ghi đè CONFIG.explore.pilot.gust.amp (rad), 0 = không nhiễu (dùng trong test) */
  constructor(seed: number, opts?: { gust?: number }) {
    const P = CONFIG.explore.pilot, S = P.spring, rnd = plRng(seed);
    this.gustAmp = opts && opts.gust !== undefined ? opts.gust : P.gust.amp;
    for (let i = 0; i < this.ph.length; i++) this.ph[i] = rnd() * TAU;
    const grp: number[][] = [];
    grp[C_SWR] = grp[C_SWP] = grp[C_SWY] = S.swing;
    grp[C_SPR] = grp[C_SPP] = grp[C_SPT] = S.spine;
    grp[C_HDY] = grp[C_HDR] = S.head;
    grp[C_LGS] = grp[C_LGF] = grp[C_KNL] = grp[C_KNR] = grp[C_LSP] = S.legs;
    grp[C_BRL] = grp[C_BRR] = S.brake;
    grp[C_PKR] = grp[C_PKP] = grp[C_STR] = S.pack;
    for (let i = 0; i < NCH; i++) { this.w[i] = TAU * grp[i][0]; this.z[i] = grp[i][1]; }
    this.reset();
  }

  /* Về tư thế nghỉ: mọi góc 0, hai phanh ở mức nền, nhiễu gió về pha đầu */
  reset(): void {
    this.x.fill(0); this.v.fill(0); this.t = 0;
    this.x[C_BRL] = this.x[C_BRR] = CONFIG.explore.pilot.brake.base;
    this.write();
  }

  /* Tiến một khung. dt không hợp lệ (≤ 0, NaN) thì bỏ qua; dt > dtMax bị kẹp (cố ý: khung dài thì chuyển động chậm lại chứ không nhảy vọt, tránh lò xo nổ). Chia bước ≤ min(dtMax/4, 1/60) cho lò xo bán ẩn ổn định */
  step(sig: PlSignals, dt: number): void {
    if (!(dt > 0)) return;
    const P = CONFIG.explore.pilot;
    if (dt > P.dtMax) dt = P.dtMax;
    const turn = clampSym(sig.turn), acc = clampSym(sig.acc), vy = clampSym(sig.vy), wind = clamp(fin(sig.wind), 0, 1);
    const hMax = Math.min(P.dtMax / 4, 1 / 60), n = Math.max(1, Math.ceil(dt / hMax - 1e-9)), h = dt / n;
    for (let s = 0; s < n; s++) {
      this.t += h;
      this.targets(turn, acc, vy, wind);
      const x = this.x, v = this.v, w = this.w, z = this.z, tg = this.tg;
      for (let i = 0; i < NCH; i++) {
        /* x'' = −ω²(x − đích) − 2ζω x'; vận tốc cập nhật trước, vị trí dùng vận tốc mới (bán ẩn) */
        v[i] += (-w[i] * w[i] * (x[i] - tg[i]) - 2 * z[i] * w[i] * v[i]) * h;
        x[i] += v[i] * h;
      }
    }
    this.write();
  }

  /* Đích của từng kênh từ tín hiệu và nhiễu gió */
  private targets(turn: number, acc: number, vy: number, wind: number): void {
    const P = CONFIG.explore.pilot, A = P.amp, B = P.brake, G = P.gust, tg = this.tg, x = this.x, ph = this.ph, t = this.t;
    const ga = this.gustAmp * (1 + G.windGain * wind);
    /* ba kênh nhiễu mượt: mỗi kênh là trung bình hai sin tần số khác nhau, pha theo seed; g[k] ∈ [−1, 1] */
    const f = G.freq, m = G.freqMul;
    const g0 = 0.5 * (Math.sin(TAU * f[0] * t + ph[0]) + Math.sin(TAU * f[1] * m[0] * t + ph[1]));
    const g1 = 0.5 * (Math.sin(TAU * f[1] * t + ph[2]) + Math.sin(TAU * f[2] * m[1] * t + ph[3]));
    const g2 = 0.5 * (Math.sin(TAU * f[2] * t + ph[4]) + Math.sin(TAU * f[0] * m[2] * t + ph[5]));
    const g3 = Math.sin(TAU * f[1] * m[3] * t + ph[6]), g4 = Math.sin(TAU * f[2] * m[4] * t + ph[7]);   // phụ: hai chân lệch pha
    tg[C_SWR] = -turn * A.swingRoll + ga * g0;
    tg[C_SWP] = -acc * A.swingPitch + ga * g1;
    tg[C_SWY] = ga * g2 * G.yawMul;
    tg[C_SPR] = turn * A.leanRoll;
    tg[C_SPP] = acc * A.leanPitch - vy * A.leanPitch * A.climbLean;
    tg[C_SPT] = turn * A.twist;
    tg[C_HDY] = turn * A.headYaw;
    /* đầu giữ thẳng: bù phần nghiêng thực của đầu (thân nghiêng trái dương, quay quanh điểm treo làm đầu nghiêng phải khi swingRoll > 0) */
    tg[C_HDR] = -A.headLevel * (x[C_SPR] - x[C_SWR]);
    tg[C_LGS] = -turn * A.legSide + ga * g3 * G.legMul;
    tg[C_LGF] = -acc * A.legFore + ga * g4 * G.legMul;
    tg[C_KNL] = Math.max(0, -acc) * A.knee + ga * G.kneeMul * Math.max(0, g3);
    tg[C_KNR] = Math.max(0, -acc) * A.knee + ga * G.kneeMul * Math.max(0, g4);
    tg[C_LSP] = Math.abs(turn) * A.legSide * A.legSplitTurn + ga * Math.abs(g3);
    tg[C_BRL] = B.base + Math.max(turn, 0) * B.turn + Math.max(-acc, 0) * B.slow - Math.max(acc, 0) * B.fast;
    tg[C_BRR] = B.base + Math.max(-turn, 0) * B.turn + Math.max(-acc, 0) * B.slow - Math.max(acc, 0) * B.fast;
    tg[C_PKR] = -turn * A.pack * A.packMul + ga * g0;
    tg[C_PKP] = -acc * A.pack * A.packMul + ga * g1;
    tg[C_STR] = A.strap * wind * g4;
  }

  /* Ghi pose đã kẹp theo `limits` */
  private write(): void {
    const L = CONFIG.explore.pilot.limits, x = this.x, p = this.pose;
    p.swingRoll = clamp(x[C_SWR], -L.swing, L.swing); p.swingPitch = clamp(x[C_SWP], -L.swing, L.swing); p.swingYaw = clamp(x[C_SWY], -L.swing, L.swing);
    p.spineRoll = clamp(x[C_SPR], -L.spine, L.spine); p.spinePitch = clamp(x[C_SPP], -L.spine, L.spine); p.spineTwist = clamp(x[C_SPT], -L.spine, L.spine);
    p.headYaw = clamp(x[C_HDY], -L.head, L.head); p.headRoll = clamp(x[C_HDR], -L.head, L.head);
    p.legSide = clamp(x[C_LGS], -L.leg, L.leg); p.legFore = clamp(x[C_LGF], -L.leg, L.leg); p.legSplit = clamp(x[C_LSP], -L.leg, L.leg);
    p.kneeL = clamp(x[C_KNL], L.knee[0], L.knee[1]); p.kneeR = clamp(x[C_KNR], L.knee[0], L.knee[1]);
    p.brakeL = clamp(x[C_BRL], 0, 1); p.brakeR = clamp(x[C_BRR], 0, 1);
    p.packRoll = clamp(x[C_PKR], -L.pack, L.pack); p.packPitch = clamp(x[C_PKP], -L.pack, L.pack); p.strap = clamp(x[C_STR], -L.strap, L.strap);
  }
}

/* ------------------------- Tín hiệu từ hai trạng thái liên tiếp ------------------------- */
/* Trạng thái lấy mẫu của một dù. Ba trường cuối tùy chọn (thiếu thì coi là 0 / false): bộ lọc acc, vy và cờ đã có tốc độ hợp lệ */
export interface PlTrack { x: number; y: number; z: number; speed: number; has: boolean; acc?: number; vy?: number; hasSpeed?: boolean }

/* Tính tín hiệu cho mọi dù (của mình lẫn người khác, đều từ vị trí + bank). Không cấp phát; prev được cập nhật tại chỗ.
   turnInput (tùy chọn, dù của mình): −1/0/1 như GliderInput.turn (+1 = trái); trộn nửa đường để tay đi trước thân */
export function plSignals(out: PlSignals, prev: PlTrack, x: number, y: number, z: number, bank: number, dt: number, wind: number, turnInput?: number): void {
  const E = CONFIG.explore, SG = E.pilot.signal;   // SG.smooth: hằng số thời gian lọc acc / vy (s); SG.teleport: m/s, nhanh hơn coi là nhảy vị trí (vào phòng, sửa lỗi mạng), bỏ mẫu
  out.wind = clamp(fin(wind), 0, 1);
  let turn = clampSym(bank / E.bankMax);
  if (turnInput !== undefined && Number.isFinite(turnInput)) turn += (clampSym(turnInput) - turn) * SG.turnMix;
  out.turn = turn;
  if (!Number.isFinite(x + y + z) || !(dt > 0) || !Number.isFinite(dt)) { out.acc = clampSym(prev.acc || 0); out.vy = clampSym(prev.vy || 0); return; }   // mẫu xấu: giữ giá trị lọc cũ
  if (!prev.has) { prev.x = x; prev.y = y; prev.z = z; prev.speed = 0; prev.has = true; prev.hasSpeed = false; prev.acc = 0; prev.vy = 0; out.acc = 0; out.vy = 0; return; }
  const dx = x - prev.x, dz = z - prev.z, sp = Math.sqrt(dx * dx + dz * dz) / dt, vyRaw = (y - prev.y) / dt;
  let accRaw = 0, vyN = 0;
  if (Math.abs(sp) > SG.teleport || Math.abs(vyRaw) > SG.teleport) { prev.hasSpeed = false; }   // nhảy vị trí: bỏ mẫu, bộ lọc giữ nguyên
  else {
    if (prev.hasSpeed) accRaw = clampSym((sp - prev.speed) / dt / E.speedAccel);
    vyN = clampSym(vyRaw / E.climbRate);
    prev.speed = sp; prev.hasSpeed = true;
    const a = 1 - Math.exp(-dt / SG.smooth);
    prev.acc = (prev.acc || 0) + (accRaw - (prev.acc || 0)) * a;
    prev.vy = (prev.vy || 0) + (vyN - (prev.vy || 0)) * a;
  }
  prev.x = x; prev.y = y; prev.z = z;
  out.acc = clampSym(prev.acc || 0); out.vy = clampSym(prev.vy || 0);
}

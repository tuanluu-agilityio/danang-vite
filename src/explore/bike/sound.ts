/* ============================ Lái xe máy: âm thanh nhiều lớp tổng hợp ============================
   Spec D-040 §8 + §17.11. Tổng hợp hết bằng Web Audio, không tệp âm thanh (đường nạp đoạn thu để làm sau). Đường ra như ô tô (drive/sound.ts):
   dùng lại nguyên drSoundWanted / drSoundRoute — âm thanh chung đang bật ⇒ audio.sfxPort (qua master); chưa bật ⇒ im tới khi người xem bấm 🔊 (#drSoundBtn),
   lần bấm đó mở audio.extPort (cổng riêng, không phát nhạc nền). Không tự tạo AudioContext ngoài thao tác của người xem.
   Các lớp (mọi gain lớp ≤ CONFIG.bike.sound.maxGain), tất cả qua MỘT DynamicsCompressorNode → gain tắt dần (fade) → cổng:
   - máy: PeriodicWave 12 hài ở tần số nổ (bkEngineHz) × 2 dao động lệch vài cent + nhiễu trắng qua dải thông, điều biên bằng sin ở tần số nổ
     → thông thấp mở theo ga / tua → gain theo ga / tua. Đề máy ở lần dựng (rpm giả crank), tắt máy ở stop() (nhỏ dần off.s rồi mới dừng nút);
   - dây đai (sin cao theo v), lốp (nhiễu nâu ∝ |v|), gió (dải thông, tâm và gain ∝ v², to hơn ở góc thứ nhất), phanh rít (dải hẹp 2–4 kHz),
     giảm xóc (xung "cụp"), xi nhan (tích 2 kHz theo nhịp đèn), còi (hai vuông), mưa trên mũ (thông cao), 3 giọng xe gần (răng cưa + StereoPanner),
     nền thành phố / sông theo độ gần mép kè, vọng trong hầm (DelayNode hồi tiếp qua thông thấp, gain gửi chuyển mượt).
   - Hai bộ đệm nhiễu (trắng, nâu) tạo một lần bằng rng(seed) (không dùng rand()), dùng chung cho mọi lớp nhiễu; mỗi loại một nguồn phát lặp.
   - Nhịp (tiếng tích, tiếng cụp) không dùng setInterval / setTimeout: lên lịch bằng thời gian ngữ cảnh ở lần update.
   - update ghi tham số tối đa mỗi updateMs (D-018), không cấp phát. stop(): bản đang kêu nhỏ dần rồi dừng (nguồn hẹn stop theo giờ ngữ cảnh,
     không chờ JS); ngắt nút ở onended, ở lần dựng kế tiếp (start() lúc đang tắt dần không để hai máy) hoặc khi update thấy đã quá giờ.
     Tải lại trang ngay sau stop() (đường thoát thường) không phụ thuộc gì vào lúc tắt dần xong.
   Chưa ai nghe thử: chỉ có test với ngữ cảnh giả và kiểm nút trong trình duyệt không đầu. */
import { CONFIG } from '../../config';
import { audio } from '../../audio';
import { rng } from '../../common/math';
import { drSoundWanted, drSoundRoute } from '../drive/sound';
import type { DrBox } from '../drive/collide';

/* Đầu vào mỗi khung (index.ts dựng một đối tượng, tái dùng). t: s, đồng hồ shared.uTime (nhịp đèn xi nhan) để tiếng tích khớp đèn */
export interface BkSoundIn { v: number; rpm: number; throttle: number; brakeK: number; sus: number; sig: -1 | 0 | 1; rain: number; tunnel: boolean; river: number; view: 1 | 3; near: DrBox[]; nNear: number; x: number; z: number; yaw: number; t: number }

/* Chuỗi nút đang sống. layers: các gain lớp nối vào bộ nén (trần maxGain); pans: 3 giọng xe gần; all / srcs: để ngắt */
export interface BkGraph {
  ctx: BaseAudioContext; ext: boolean; all: AudioNode[]; srcs: AudioScheduledSourceNode[]; layers: GainNode[]; dieAt: number; crankEnd: number;
  fade: GainNode; o1: OscillatorNode; o2: OscillatorNode; fo: OscillatorNode; eLp: BiquadFilterNode; eng: GainNode;
  belt: OscillatorNode; beltG: GainNode; tyre: GainNode; windBp: BiquadFilterNode; wind: GainNode; brakeBp: BiquadFilterNode; brake: GainNode;
  thump: GainNode; tick: GainNode; horn: GainNode; rain: GainNode; nO: OscillatorNode[]; nG: GainNode[]; pans: StereoPannerNode[];
  city: GainNode; river: GainNode; verb: GainNode;
}

const S = CONFIG.bike.sound, E = S.engine, CVT = CONFIG.bike.cvt, VMAX = CONFIG.bike.perf.vMax;
const HALF = 1 / (2 * CONFIG.bike.model.sigHz);   // s — nửa chu kỳ đèn xi nhan: tiếng tích lúc sáng, tiếng tắc lúc tắt

/* Tần số nổ của máy một xi lanh bốn kỳ: một lần nổ mỗi hai vòng ⇒ rpm / 60 / 2 */
export function bkEngineHz(rpm: number): number { return Math.max(0, rpm) / 120; }
/* Độ gần sông 0..1: trên mặt sông (|x| ≤ mép kè) = 1, giảm tuyến tính vào bờ, 0 ở amb.riverR m sau mép kè */
export function bkRiverK(x: number): number { return Math.max(0, Math.min(1, 1 - (Math.abs(x) - CONFIG.bankX) / S.amb.riverR)); }

const cl01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x);
const cg = (x: number) => (x > S.maxGain ? S.maxGain : x > 0 ? x : 0);   // kẹp gain lớp về [0, maxGain]

let snd: BkGraph | null = null;      // chuỗi đang kêu
let dying: BkGraph | null = null;    // chuỗi đang tắt dần sau stop() / tắt bằng nút
let want = false, hornOn = false, lastAt = -1e9;
let pick: boolean | null = null;     // lựa chọn của người xem bằng nút 🔊 (giữ trong trang); null = chưa bấm
let btn: HTMLElement | null = null, shown: boolean | null = null;
let susHi = false, thumpAt = -1e9, tickNext = -Infinity;   // giảm xóc đang vượt ngưỡng; giờ ngữ cảnh lần cụp trước; giờ shared.uTime của tiếng tích kế tiếp chưa lên lịch
const nIdx = new Int32Array(3), nD = new Float64Array(3);   // 3 hộp gần nhất: chỉ số, khoảng cách²

/* Bộ đệm nhiễu + dạng sóng máy: tạo một lần cho mỗi ngữ cảnh (trang chỉ có một) */
let bufCtx: BaseAudioContext | null = null, white: AudioBuffer | null = null, brown: AudioBuffer | null = null, wave: PeriodicWave | null = null;
function bkSndBufs(ctx: BaseAudioContext): void {
  if (bufCtx === ctx) return;
  bufCtx = ctx;
  const n = Math.round(S.noiseS * ctx.sampleRate), r = rng(S.seed);
  white = ctx.createBuffer(1, n, ctx.sampleRate); brown = ctx.createBuffer(1, n, ctx.sampleRate);
  const w = white.getChannelData(0), b = brown.getChannelData(0);
  let acc = 0;
  for (let i = 0; i < n; i++) { const x = r() * 2 - 1; w[i] = x; acc = (acc + 0.02 * x) / 1.02; b[i] = acc * 3.5; }   // nâu: tích phân rò của trắng
  const re = new Float32Array(E.harm + 1), im = new Float32Array(E.harm + 1);
  for (let h = 1; h <= E.harm; h++) im[h] = (h % 2 === 0 ? E.evenK : 1) / Math.pow(h, E.rolloff);
  wave = ctx.createPeriodicWave(re, im);
}

const globalOn = (): boolean => { const p = audio.sfxPort(); return !!p && p.on; };

/* Đường bao một tiếng ngắn trên tham số gain: 0 → đỉnh trong ≤ 2 ms → 0 ở t0 + dur */
function bkEnv(p: AudioParam, t0: number, peak: number, dur: number): void {
  p.setValueAtTime(0, t0);
  p.linearRampToValueAtTime(peak, t0 + Math.min(0.002, dur / 4));
  p.linearRampToValueAtTime(0, t0 + dur);
}

/* Dựng chuỗi nút nếu có đường ra; trả có dựng được không. Bản đang tắt dần (nếu có) bị ngắt ngay trước khi lấy cổng */
function bkSndBuild(): boolean {
  const route = drSoundRoute(pick, globalOn());
  if (!route) return false;
  bkSndKill();
  const port = route === 'sfx' ? audio.sfxPort() : audio.extPort();
  if (!port) return false;
  const { ctx, out } = port, t = ctx.currentTime;
  bkSndBufs(ctx);
  const all: AudioNode[] = [], srcs: AudioScheduledSourceNode[] = [], layers: GainNode[] = [];
  const add = <T extends AudioNode>(n: T): T => { all.push(n); return n; };
  const gain = (v: number): GainNode => { const g = add(ctx.createGain()); g.gain.value = v; return g; };
  const filt = (type: BiquadFilterType, f: number, q?: number): BiquadFilterNode => { const b = add(ctx.createBiquadFilter()); b.type = type; b.frequency.value = f; if (q !== undefined) b.Q.value = q; return b; };
  const osc = (type: OscillatorType, f: number): OscillatorNode => { const o = add(ctx.createOscillator()); o.type = type; o.frequency.value = f; srcs.push(o); return o; };
  const noise = (buf: AudioBuffer): AudioBufferSourceNode => { const s = add(ctx.createBufferSource()); s.buffer = buf; s.loop = true; srcs.push(s); return s; };
  /* đầu ra: nén → fade → cổng; vọng: gửi → trễ ⇄ (thông thấp → hồi tiếp) → nén */
  const C = S.comp, comp = add(ctx.createDynamicsCompressor());
  comp.threshold.value = C.threshold; comp.knee.value = C.knee; comp.ratio.value = C.ratio; comp.attack.value = C.attack; comp.release.value = C.release;
  const fade = gain(1); comp.connect(fade); fade.connect(out);
  const V = S.verb, verb = gain(0), dl = add(ctx.createDelay(1)), vLp = filt('lowpass', V.lp), fb = gain(V.fb);
  dl.delayTime.value = V.delay;
  verb.connect(dl); dl.connect(vLp); vLp.connect(fb); fb.connect(dl); vLp.connect(comp);
  const lay = (send = false, to: AudioNode = comp): GainNode => { const g = gain(0); g.connect(to); if (send) g.connect(verb); layers.push(g); return g; };
  const wh = noise(white!), br = noise(brown!);
  /* máy */
  const eng = lay(true), eLp = filt('lowpass', E.lpIdle); eLp.connect(eng);
  const hMix = gain(E.harmMix); hMix.connect(eLp);
  const o1 = osc('sine', 0), o2 = osc('sine', 0), fo = osc('sine', 0);
  o1.setPeriodicWave(wave!); o2.setPeriodicWave(wave!); o1.detune.value = E.cents; o2.detune.value = -E.cents;
  o1.connect(hMix); o2.connect(hMix);
  const nBp = filt('bandpass', E.noiseBand[0], E.noiseBand[1]), am = gain(E.amBase), amD = gain(E.amDepth);
  wh.connect(nBp); nBp.connect(am); am.connect(eLp); fo.connect(amD); amD.connect(am.gain);
  const K = S.crank;   // đề máy: rpm giả theo các mốc, gain lên trong mốc đầu
  for (const o of [o1, o2, fo]) { o.frequency.setValueAtTime(bkEngineHz(K.rpm[0]), t); for (let k = 1; k < K.rpm.length; k++) o.frequency.linearRampToValueAtTime(bkEngineHz(K.rpm[k]), t + K.at[k]); }
  eng.gain.setValueAtTime(0, t); eng.gain.linearRampToValueAtTime(cg(E.gIdle), t + K.at[1]);
  /* dây đai, lốp, gió, phanh, giảm xóc, xi nhan, còi, mưa */
  const beltG = lay(), belt = osc('sine', S.belt.base); belt.connect(beltG);
  const tyre = lay(true), tLp = filt('lowpass', S.tyre.lp); br.connect(tLp); tLp.connect(tyre);
  const wind = lay(), windBp = filt('bandpass', S.wind.f0, S.wind.q); wh.connect(windBp); windBp.connect(wind);
  const brake = lay(), brakeBp = filt('bandpass', S.brake.band[0], S.brake.q); wh.connect(brakeBp); brakeBp.connect(brake);
  const thump = lay(true), thLp = filt('lowpass', S.thump.lp); br.connect(thLp); thLp.connect(thump);
  const tick = lay(true), tk = osc('sine', S.tick.hz); tk.connect(tick);
  const horn = lay(true); horn.gain.value = hornOn ? cg(S.horn.gain) : 0;
  for (const f of S.horn.hz) osc('square', f).connect(horn);
  const rain = lay(), rHp = filt('highpass', S.rain.hp); wh.connect(rHp); rHp.connect(rain);
  /* 3 giọng xe gần: răng cưa → thông thấp → gain → pan → nén (và gửi vọng) */
  const nO: OscillatorNode[] = [], nG: GainNode[] = [], pans: StereoPannerNode[] = [];
  for (const f of S.near.hz) {
    const p = add(ctx.createStereoPanner()); p.connect(comp); p.connect(verb);
    const g = lay(false, p), lp = filt('lowpass', S.near.lp), o = osc('sawtooth', f);
    o.connect(lp); lp.connect(g); nO.push(o); nG.push(g); pans.push(p);
  }
  /* nền */
  const A = S.amb, city = lay(), cLp = filt('lowpass', A.cityLp); br.connect(cLp); cLp.connect(city);
  const river = lay(), rBp = filt('bandpass', A.riverBand[0], A.riverBand[1]); wh.connect(rBp); rBp.connect(river);
  /* chạy: hai nguồn nhiễu lệch điểm đầu cho đỡ tương quan */
  wh.start(t, 0); br.start(t, S.noiseS / 2);
  for (const s of srcs) if (s !== wh && s !== br) s.start(t);
  snd = { ctx, ext: route === 'ext', all, srcs, layers, dieAt: Infinity, crankEnd: t + K.at[K.at.length - 1], fade, o1, o2, fo, eLp, eng, belt, beltG, tyre, windBp, wind, brakeBp, brake,
    thump, tick, horn, rain, nO, nG, pans, city, river, verb };
  susHi = false; thumpAt = -1e9; tickNext = -Infinity;
  return true;
}

/* Tắt máy: nhỏ dần off.s (tua tụt, còi tắt), mọi nguồn hẹn dừng theo giờ ngữ cảnh; chuỗi chuyển sang dying, ngắt sau */
function bkSndRelease(): void {
  const g = snd;
  if (!g) return;
  snd = null;
  bkSndKill();
  const t = g.ctx.currentTime, end = t + S.off.s, f = g.fade.gain;
  f.cancelScheduledValues(t); f.setValueAtTime(f.value, t); f.linearRampToValueAtTime(0, end);
  for (const o of [g.o1, g.o2, g.fo]) { o.frequency.cancelScheduledValues(t); o.frequency.setTargetAtTime(bkEngineHz(S.off.rpm), t, S.off.s / 3); }
  g.horn.gain.cancelScheduledValues(t); g.horn.gain.setTargetAtTime(0, t, 0.02);
  for (const s of g.srcs) { try { s.stop(end + 0.02); } catch { /* đã dừng */ } }
  g.dieAt = end + 0.02;
  g.srcs[0].onended = () => { if (dying === g) bkSndKill(); };
  dying = g;
}
/* Ngắt ngay chuỗi đang tắt dần (nếu có); thả cổng riêng nếu không còn chuỗi nào dùng nó */
function bkSndKill(): void {
  const g = dying;
  if (!g) return;
  dying = null;
  for (const s of g.srcs) { s.onended = null; try { s.stop(); } catch { /* đã dừng */ } }
  for (const n of g.all) n.disconnect();
  if (g.ext && !(snd && snd.ext)) audio.extPort(false);
}
/* Nút 🔊 / 🔇: biểu tượng + aria-pressed theo trạng thái (chỉ ghi DOM khi đổi) */
function bkSndSync(force = false): void {
  if (!btn) return;
  const on = want && drSoundWanted(pick, globalOn());
  if (!force && on === shown) return;
  shown = on;
  btn.textContent = on ? '🔊' : '🔇';
  btn.setAttribute('aria-pressed', String(on));
}

export const bkSound = {
  /* Gắn nút #drSoundBtn (chung với ô tô): chỉ bật / tắt khi đang ở chế độ xe máy (want), ô tô tự chặn bằng điều kiện của nó */
  bind(el: HTMLElement | null): void {
    btn = el;
    if (el) el.addEventListener('click', () => { if (want) bkSound.toggle(); });
    if (want) bkSndSync(true);
  },
  /* Vào chế độ: đề máy nếu có đường ra (chưa có thì update thử lại khi âm thanh chung bật sau). Gọi lại khi đang kêu không dựng thêm */
  start(): void { want = true; lastAt = -1e9; if (!snd) bkSndBuild(); bkSndSync(true); },
  /* Bật / tắt theo lựa chọn của người xem; trả trạng thái mới */
  toggle(): boolean {
    pick = !drSoundWanted(pick, globalOn());
    if (pick) { lastAt = -1e9; if (!snd && want) bkSndBuild(); } else bkSndRelease();
    bkSndSync();
    return pick;
  },
  get on(): boolean { return want && drSoundWanted(pick, globalOn()); },
  /* Mỗi khung: ghi tham số tối đa mỗi updateMs, không cấp phát */
  update(i: BkSoundIn): void {
    if (!want) return;
    const now = performance.now();
    if (now - lastAt < S.updateMs) return;
    lastAt = now;
    bkSndSync();
    if (!drSoundWanted(pick, globalOn())) return;
    if (!snd && !bkSndBuild()) return;
    const g = snd!, t = g.ctx.currentTime, k = S.smooth;
    if (dying && t > dying.dieAt) bkSndKill();
    /* máy (đang đề thì để đường đề chạy hết) */
    const th = cl01(i.throttle), rk = cl01((i.rpm - CVT.idle) / (CVT.max - CVT.idle));
    if (t >= g.crankEnd) {
      const hz = bkEngineHz(i.rpm);
      g.o1.frequency.setTargetAtTime(hz, t, k); g.o2.frequency.setTargetAtTime(hz, t, k); g.fo.frequency.setTargetAtTime(hz, t, k);
      g.eLp.frequency.setTargetAtTime(E.lpIdle + E.lpOpen * th + E.lpRpm * rk, t, k);
      g.eng.gain.setTargetAtTime(cg(E.gIdle + E.gThrottle * th + E.gRpm * rk), t, k);
    }
    /* dây đai, lốp, gió */
    const a = Math.abs(i.v), vk = cl01(a / VMAX), v2 = vk * vk;
    g.belt.frequency.setTargetAtTime(S.belt.base + S.belt.perMs * a, t, k);
    g.beltG.gain.setTargetAtTime(cg(S.belt.gain * vk), t, k);
    g.tyre.gain.setTargetAtTime(cg(S.tyre.gain * vk), t, k);
    g.windBp.frequency.setTargetAtTime(S.wind.f0 + S.wind.f1 * v2, t, k);
    g.wind.gain.setTargetAtTime(cg(S.wind.gain * v2 * (i.view === 1 ? S.wind.view1 : 1)), t, k);
    /* phanh rít: phanh mạnh ở tốc độ cao */
    const B = S.brake, sq = i.brakeK > B.k && a > B.v;
    g.brakeBp.frequency.setTargetAtTime(B.band[0] + (B.band[1] - B.band[0]) * vk, t, k);
    g.brake.gain.setTargetAtTime(sq ? cg(B.gain) : 0, t, B.tau);
    /* giảm xóc: một tiếng cụp mỗi lần vượt ngưỡng, cách nhau ≥ 1 / maxHz (giờ ngữ cảnh) */
    const T = S.thump, hi = Math.abs(i.sus) > T.k * CONFIG.bike.sus.travel;
    if (hi && !susHi && t - thumpAt >= 1 / T.maxHz) { thumpAt = t; bkEnv(g.thump.gain, t,cg(T.gain), T.s); }
    susHi = hi;
    /* xi nhan: tiếng tích ở mỗi nửa chu kỳ đèn (theo shared.uTime như đèn), lên lịch trước tick.ahead s bằng giờ ngữ cảnh */
    if (i.sig !== 0) {
      if (tickNext < i.t) tickNext = Math.ceil(i.t / HALF) * HALF;
      while (tickNext < i.t + S.tick.ahead) {
        const on = Math.round(tickNext / HALF) % 2 === 0;
        bkEnv(g.tick.gain, t + (tickNext - i.t), cg(S.tick.gain * (on ? 1 : S.tick.offK)), S.tick.s);
        tickNext += HALF;
      }
    } else tickNext = -Infinity;
    /* mưa trên mũ */
    g.rain.gain.setTargetAtTime(cg(S.rain.gain * cl01(i.rain)), t, k);
    /* xe gần: 3 hộp gần nhất (chèn vào mảng cố định), gain ∝ ref / khoảng cách, pan theo góc so với hướng xe */
    nD[0] = nD[1] = nD[2] = Infinity; nIdx[0] = nIdx[1] = nIdx[2] = -1;
    const nn = Math.min(i.nNear, i.near.length);
    for (let j = 0; j < nn; j++) {
      const b = i.near[j], dx = b.x - i.x, dz = b.z - i.z, d2 = dx * dx + dz * dz;
      if (d2 >= nD[2]) continue;
      let p = 2;
      while (p > 0 && d2 < nD[p - 1]) { nD[p] = nD[p - 1]; nIdx[p] = nIdx[p - 1]; p--; }
      nD[p] = d2; nIdx[p] = j;
    }
    const N = S.near, ls = -Math.sin(i.yaw), lc = -Math.cos(i.yaw);   // vectơ bên trái (mũi +X ở yaw = 0 ⇒ trái là −Z)
    for (let v = 0; v < 3; v++) {
      const j = nIdx[v];
      if (j < 0) { g.nG[v].gain.setTargetAtTime(0, t, k); continue; }
      const b = i.near[j], dx = b.x - i.x, dz = b.z - i.z, d = Math.sqrt(nD[v]);
      g.nG[v].gain.setTargetAtTime(cg(N.gain * N.ref / Math.max(d, N.ref) * cl01(1 - d / N.far)), t, k);
      const left = d > 1e-3 ? (dx * ls + dz * lc) / d : 0;
      g.pans[v].pan.setTargetAtTime(-left, t, k);
    }
    /* nền thành phố / sông; trong hầm nhỏ đi; vọng hầm chuyển trong verb.s */
    const rv = cl01(i.river), ak = i.tunnel ? S.amb.tunnelK : 1;
    g.city.gain.setTargetAtTime(cg(S.amb.cityGain * (1 - rv) * ak), t, k);
    g.river.gain.setTargetAtTime(cg(S.amb.riverGain * rv * ak), t, k);
    g.verb.gain.setTargetAtTime(i.tunnel ? S.verb.gain : 0, t, S.verb.s / 3);
  },
  /* Còi (giữ H): đổi trạng thái mới ghi tham số */
  horn(on: boolean): void {
    if (on === hornOn) return;
    hornOn = on;
    if (snd) snd.horn.gain.setTargetAtTime(on ? cg(S.horn.gain) : 0, snd.ctx.currentTime, 0.02);
  },
  /* Rời chế độ: tắt máy (nhỏ dần rồi dừng), còi tắt; lựa chọn của nút giữ lại trong trang */
  stop(): void {
    want = false; hornOn = false;
    bkSndRelease();
    bkSndSync();
  },
  /* Số nút đang sống của chuỗi đang kêu (0 khi im / đang tắt dần) — test */
  nodes(): number { return snd ? snd.all.length : 0; },
  /* Chuỗi đang kêu — test */
  get graph(): BkGraph | null { return snd; }
};

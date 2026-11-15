/* ============================ Nhạc chủ đề "The Spirit of Da Nang": bộ phát ============================
   Phát bản tổng phổ ở score.ts bằng Web Audio, không tệp âm thanh: dây (răng cưa lệch pha qua lọc), rải synth, bass, trống, giai điệu synth,
   dây gảy Karplus–Strong, chuông, lớp không khí. Một bài 80 ô nối liền về đầu (không có điểm nối vì nốt được lên lịch liên tục, không phải tệp lặp).
   Mỗi lớp có một nút âm lượng riêng: đổi chế độ / ngày đêm / thời tiết chỉ là trượt các nút đó (setMix), nhạc không dừng, không phát lại từ đầu,
   không có hai bản chồng nhau. Bộ lập lịch đọc bản phối hiện tại nên hoa văn trống / bass đổi theo chế độ ở phách kế tiếp.
   Dùng được với AudioContext lẫn OfflineAudioContext (renderMusic: kết xuất ngoại tuyến để đo biên độ, tests/music-render.mjs). */
import { CONFIG } from '../config';
import { rng } from '../common/math';
import { LAYERS, PROG, SECTIONS, THEME, BRIDGE, COUNTER, melodyIndex, midiHz, chordNotes, nearestTone, type Layer, type MusicMode, type Chord, type Section, type ProgName } from './score';

export interface MusicMix { mode: MusicMode; night: number; rain: number; storm: number }
export interface MusicDeps { verb: AudioNode; brown: AudioBuffer; white: AudioBuffer; tone?: BiquadFilterNode }
export interface Music {
  schedule(until: number): void;                 // lên lịch mọi nốt bắt đầu trước `until` (giây theo đồng hồ ngữ cảnh)
  restart(t: number, section?: number): void;    // phát lại tại t từ đoạn mở đầu (hoặc đoạn thứ `section`, cho công cụ đo)
  setMix(m: MusicMix, now: number, snap?: boolean): void;
  sting(t: number): void;                        // tiếng "mở màn" khi vào một chế độ
  readonly pos: { section: string; bar: number; cycle: number };
}

const ACCENT = [1, 0, 0, 1, 0, 0, 1, 0, 1, 0, 0, 1, 0, 0, 1, 0];      // nhấn 3-3-2: cảm giác đang đi tới
const ARP = [[0, 1, 2, 3, 2, 1, 2, 3, 0, 1, 2, 3, 4, 3, 2, 1], [0, 2, 1, 3, 2, 4, 3, 5, 4, 2, 3, 1, 2, 0, 1, 2], [0, 1, 2, 4, 2, 1, 2, 4, 0, 1, 3, 5, 3, 1, 3, 5]];
const THEME_AT = melodyIndex(THEME), BRIDGE_AT = melodyIndex(BRIDGE);

/* Nhiễu dùng chung: nâu (gió, sấm, tiếng dâng trầm) và trắng (hi-hat, trống lẫy). rnd: Math.random hoặc rng(seed) */
export function makeNoise(ctx: BaseAudioContext, rnd: () => number): { brown: AudioBuffer; white: AudioBuffer } {
  const nl = ctx.sampleRate * 4, brown = ctx.createBuffer(1, nl, ctx.sampleRate), nd = brown.getChannelData(0);
  let last = 0; for (let i = 0; i < nl; i++) { last = (last + 0.02 * (rnd() * 2 - 1)) / 1.02; nd[i] = last * 3.5; }
  const wl = ctx.sampleRate * 2, white = ctx.createBuffer(1, wl, ctx.sampleRate), wd = white.getChannelData(0);
  for (let i = 0; i < wl; i++) wd[i] = rnd() * 2 - 1;
  return { brown, white };
}
/* Đáp ứng xung hồi âm tự sinh: nhiễu tắt dần, stereo */
export function makeIR(ctx: BaseAudioContext, rnd: () => number, sec = 3.2): AudioBuffer {
  const len = Math.floor(ctx.sampleRate * sec), ir = ctx.createBuffer(2, len, ctx.sampleRate);
  for (let c = 0; c < 2; c++) { const d = ir.getChannelData(c); for (let i = 0; i < len; i++) d[i] = (rnd() * 2 - 1) * Math.pow(1 - i / len, 2.6); }
  return ir;
}

export function createMusic(ctx: BaseAudioContext, out: AudioNode, deps: MusicDeps): Music {
  const M = CONFIG.music, rnd = rng(M.seed), STEP = 60 / M.bpm / 4, BAR = STEP * 16;
  let mix: MusicMix = { mode: 'overview', night: 0, rain: 0, storm: 0 };
  let prof = M.modes.overview;

  /* ---------- Đường tín hiệu: mỗi lớp một nút → (lớp "thở" theo trống cái) → ra; nhánh gửi hồi âm và vọng ---------- */
  const pump = ctx.createGain(); pump.connect(out);
  const delayIn = ctx.createGain(), delay = ctx.createDelay(1), fb = ctx.createGain(), dLp = ctx.createBiquadFilter(), wet = ctx.createGain();
  delay.delayTime.value = STEP * M.delay.steps; fb.gain.value = M.delay.feedback; dLp.type = 'lowpass'; dLp.frequency.value = 3200; wet.gain.value = M.delay.wet;
  delayIn.connect(delay); delay.connect(dLp); dLp.connect(fb); fb.connect(delay); dLp.connect(wet); wet.connect(out); wet.connect(deps.verb);
  const bus = {} as Record<Layer, GainNode>;
  for (const L of LAYERS) {
    const g = bus[L] = ctx.createGain(); g.gain.value = 0;
    g.connect(L === 'pad' || L === 'stab' || L === 'bass' || L === 'arp' ? pump : out);
    const v = M.verb[L]; if (v > 0) { const s = ctx.createGain(); s.gain.value = v; g.connect(s); s.connect(deps.verb); }
    const d = (M.delay as Record<string, number>)[L]; if (d > 0) { const s = ctx.createGain(); s.gain.value = d; g.connect(s); s.connect(delayIn); }
  }
  const panL = ctx.createStereoPanner(), panR = ctx.createStereoPanner(); panL.pan.value = -0.45; panR.pan.value = 0.45;
  const arpF = ctx.createBiquadFilter(); arpF.type = 'lowpass'; arpF.Q.value = 2.5; arpF.frequency.value = prof.arpCut;
  panL.connect(arpF); panR.connect(arpF); arpF.connect(bus.arp);
  const stabF = ctx.createBiquadFilter(); stabF.type = 'lowpass'; stabF.frequency.value = 2600; stabF.Q.value = 1; stabF.connect(bus.stab);
  const leadF = ctx.createBiquadFilter(); leadF.type = 'lowpass'; leadF.frequency.value = 3400; leadF.Q.value = 0.8; leadF.connect(bus.lead);

  /* Dây nền: 4 bè × 2 răng cưa lệch pha, chạy suốt; đổi hợp âm = trượt tần số, không tạo nút mới */
  const padF = ctx.createBiquadFilter(); padF.type = 'lowpass'; padF.frequency.value = M.night.padCutDay; padF.Q.value = 0.6;
  const padEnv = ctx.createGain(); padEnv.gain.value = 0; padF.connect(padEnv); padEnv.connect(bus.pad);
  const padOsc: OscillatorNode[][] = [];
  for (let v = 0; v < 4; v++) {
    const pan = ctx.createStereoPanner(); pan.pan.value = [-0.6, 0.3, -0.25, 0.6][v]; pan.connect(padF);
    const pair: OscillatorNode[] = [];
    for (const det of [-9, 8]) { const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = 220; o.detune.value = det + (rnd() - 0.5) * 4; const g = ctx.createGain(); g.gain.value = 0.25; o.connect(g); g.connect(pan); o.start(); pair.push(o); }
    padOsc.push(pair);
  }
  const padLfo = ctx.createOscillator(), padLfoG = ctx.createGain(); padLfo.frequency.value = 0.07; padLfoG.gain.value = 260; padLfo.connect(padLfoG); padLfoG.connect(padF.frequency); padLfo.start();
  /* Không khí: nhiễu nâu qua bandpass trôi chậm (gió biển, bầu trời rộng) */
  const airSrc = ctx.createBufferSource(); airSrc.buffer = deps.brown; airSrc.loop = true;
  const airBp = ctx.createBiquadFilter(); airBp.type = 'bandpass'; airBp.frequency.value = 1100; airBp.Q.value = 0.5;
  const airLfo = ctx.createOscillator(), airLfoG = ctx.createGain(); airLfo.frequency.value = 0.045; airLfoG.gain.value = 500; airLfo.connect(airLfoG); airLfoG.connect(airBp.frequency); airLfo.start();
  airSrc.connect(airBp); airBp.connect(bus.air); airSrc.start();
  /* Nền trầm của bão: Rê 2 qua lọc thấp, mặc định tắt */
  const droneG = ctx.createGain(); droneG.gain.value = 0; droneG.connect(out);
  const droneF = ctx.createBiquadFilter(); droneF.type = 'lowpass'; droneF.frequency.value = 260; droneF.connect(droneG);
  for (const det of [-6, 7]) { const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = midiHz(38); o.detune.value = det; o.connect(droneF); o.start(); }
  const stormBus = ctx.createGain(); stormBus.gain.value = M.level.kick; stormBus.connect(out);

  /* ---------- Nhạc cụ từng nốt ---------- */
  const env = (g: GainNode, t: number, peak: number, attack: number, hold: number, release: number) => {
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), t + attack);
    g.gain.setValueAtTime(Math.max(0.0002, peak), t + attack + hold); g.gain.exponentialRampToValueAtTime(0.0001, t + attack + hold + release);
  };
  const noise = (buf: AudioBuffer, t: number, dur: number) => { const s = ctx.createBufferSource(); s.buffer = buf; s.start(t, rnd() * 1.5); s.stop(t + dur); return s; };
  let arpSide = 0;
  function arpNote(t: number, midi: number, v: number) {
    const o = ctx.createOscillator(), g = ctx.createGain(); o.type = 'sawtooth'; o.frequency.value = midiHz(midi);
    env(g, t, v, 0.004, 0.02, 0.2); o.connect(g); g.connect((arpSide ^= 1) ? panL : panR); o.start(t); o.stop(t + 0.25);
  }
  function bassNote(t: number, midi: number, dur: number, v: number) {
    const f = midiHz(midi), o = ctx.createOscillator(), s = ctx.createOscillator(), lp = ctx.createBiquadFilter(), g = ctx.createGain(), sg = ctx.createGain();
    o.type = 'sawtooth'; o.frequency.value = f; s.type = 'sine'; s.frequency.value = f; sg.gain.value = 0.9;
    lp.type = 'lowpass'; lp.Q.value = 2; lp.frequency.setValueAtTime(900, t); lp.frequency.exponentialRampToValueAtTime(240, t + Math.min(dur, 0.3));
    env(g, t, v, 0.006, Math.max(0.01, dur - 0.07), 0.06);
    o.connect(lp); lp.connect(g); s.connect(sg); sg.connect(g); g.connect(bus.bass); o.start(t); s.start(t); o.stop(t + dur + 0.05); s.stop(t + dur + 0.05);
  }
  function kick(t: number, v: number, dest: AudioNode = bus.kick) {
    const o = ctx.createOscillator(), g = ctx.createGain(); o.frequency.setValueAtTime(155, t); o.frequency.exponentialRampToValueAtTime(46, t + 0.11);
    env(g, t, v, 0.003, 0.03, 0.22); o.connect(g); g.connect(dest); o.start(t); o.stop(t + 0.3);
    const d = prof.pump * Math.min(1, v); if (d > 0.01) { pump.gain.setTargetAtTime(1 - d, t, 0.006); pump.gain.setTargetAtTime(1, t + 0.05, 0.085); }   // "thở" theo trống cái
  }
  function tom(t: number, v: number, f: number, dest: AudioNode) {
    const o = ctx.createOscillator(), g = ctx.createGain(); o.frequency.setValueAtTime(f * 1.5, t); o.frequency.exponentialRampToValueAtTime(f, t + 0.18);
    env(g, t, v, 0.004, 0.05, 0.45); o.connect(g); g.connect(dest); o.start(t); o.stop(t + 0.55);
  }
  function snare(t: number, v: number) {
    const n = noise(deps.white, t, 0.22), bp = ctx.createBiquadFilter(), g = ctx.createGain(); bp.type = 'bandpass'; bp.frequency.value = prof.hat16 ? 2600 : 1900; bp.Q.value = 0.7;
    env(g, t, v, 0.002, 0.01, 0.17); n.connect(bp); bp.connect(g); g.connect(bus.snare);
    const o = ctx.createOscillator(), og = ctx.createGain(); o.frequency.setValueAtTime(230, t); o.frequency.exponentialRampToValueAtTime(160, t + 0.08);
    env(og, t, v * 0.5, 0.002, 0.01, 0.09); o.connect(og); og.connect(bus.snare); o.start(t); o.stop(t + 0.12);
  }
  function hat(t: number, v: number, open = false) {
    const dur = open ? 0.22 : 0.045, n = noise(deps.white, t, dur + 0.03), hp = ctx.createBiquadFilter(), g = ctx.createGain(); hp.type = 'highpass'; hp.frequency.value = 7500;
    env(g, t, v, 0.002, 0.004, dur); n.connect(hp); hp.connect(g); g.connect(bus.hat);
  }
  function shaker(t: number, v: number) {
    const n = noise(deps.white, t, 0.09), bp = ctx.createBiquadFilter(), g = ctx.createGain(); bp.type = 'bandpass'; bp.frequency.value = 5200; bp.Q.value = 1.2;
    env(g, t, v, 0.012, 0.005, 0.06); n.connect(bp); bp.connect(g); g.connect(bus.perc);
  }
  function rim(t: number, v: number) {
    const o = ctx.createOscillator(), g = ctx.createGain(); o.type = 'triangle'; o.frequency.setValueAtTime(1150, t); o.frequency.exponentialRampToValueAtTime(820, t + 0.03);
    env(g, t, v, 0.001, 0.004, 0.05); o.connect(g); g.connect(bus.perc); o.start(t); o.stop(t + 0.08);
  }
  function crash(t: number, v: number) {
    const n = noise(deps.white, t, 2.2), hp = ctx.createBiquadFilter(), g = ctx.createGain(); hp.type = 'highpass'; hp.frequency.value = 4800;
    env(g, t, v, 0.004, 0.03, 2); n.connect(hp); hp.connect(g); g.connect(bus.hat);
  }
  /* Tiếng dâng: nhiễu qua bandpass mở dần, to dần rồi cắt đúng đầu ô kế */
  function riser(t: number, dur: number, v: number, dest: AudioNode = bus.hat) {
    const n = ctx.createBufferSource(); n.buffer = deps.white; n.loop = true; const bp = ctx.createBiquadFilter(), g = ctx.createGain(); bp.type = 'bandpass'; bp.Q.value = 0.9;
    bp.frequency.setValueAtTime(500, t); bp.frequency.exponentialRampToValueAtTime(7000, t + dur);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(Math.max(0.0002, v), t + dur); g.gain.setTargetAtTime(0.0001, t + dur, 0.03);
    n.connect(bp); bp.connect(g); g.connect(dest); n.start(t); n.stop(t + dur + 0.2);
  }
  function stab(t: number, midis: number[], v: number) {
    const g = ctx.createGain(); env(g, t, v, 0.005, 0.03, 0.11); g.connect(stabF);
    for (const m of midis) { const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = midiHz(m); o.detune.value = (rnd() - 0.5) * 14; o.connect(g); o.start(t); o.stop(t + 0.18); }
  }
  function leadNote(t: number, midi: number, dur: number, v: number) {
    const f = midiHz(midi), g = ctx.createGain(), hold = Math.max(0.02, dur - 0.06);
    env(g, t, v, 0.025, hold, 0.14); g.connect(leadF);
    const end = t + dur + 0.2, oscs: OscillatorNode[] = [];
    for (const det of [-7, 7]) { const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = f; o.detune.value = det; o.connect(g); o.start(t); o.stop(end); oscs.push(o); }
    const sq = ctx.createOscillator(), sqg = ctx.createGain(); sq.type = 'triangle'; sq.frequency.value = f; sqg.gain.value = 0.8; sq.connect(sqg); sqg.connect(g); sq.start(t); sq.stop(end); oscs.push(sq);
    if (dur > 0.5) {   // nốt dài: rung dần
      const l = ctx.createOscillator(), lg = ctx.createGain(); l.frequency.value = 5.4; lg.gain.setValueAtTime(0, t + 0.25); lg.gain.linearRampToValueAtTime(f * 0.006, t + 0.6);
      l.connect(lg); for (const o of oscs) lg.connect(o.frequency); l.start(t); l.stop(end);
    }
  }
  /* Dây gảy Karplus–Strong, dựng sẵn mỗi nốt một lần; thêm một thân âm tam giác tắt nhanh cho tròn tiếng */
  const pluckBufs = new Map<number, AudioBuffer>();
  function pluckBuf(midi: number): AudioBuffer {
    const hit = pluckBufs.get(midi); if (hit) return hit;
    const f = midiHz(midi), sr = ctx.sampleRate, len = Math.floor(sr * 2.2), N = Math.max(2, Math.round(sr / f));
    const buf = ctx.createBuffer(1, len, sr), o = buf.getChannelData(0), ring = new Float32Array(N);
    let prev = 0; for (let i = 0; i < N; i++) { const n = rnd() * 2 - 1; ring[i] = 0.6 * n + 0.4 * prev; prev = n; }
    const decay = 0.9968 + Math.min(0.0025, 60 / f * 0.0008); let peak = 0;
    for (let i = 0; i < len; i++) { const j = i % N, k = (i + 1) % N, y = ring[j]; o[i] = y; ring[j] = decay * 0.5 * (y + ring[k]); if (Math.abs(y) > peak) peak = Math.abs(y); }
    for (let i = 0; i < len; i++) o[i] /= peak || 1;
    pluckBufs.set(midi, buf); return buf;
  }
  function pluckNote(t: number, midi: number, v: number) {
    const s = ctx.createBufferSource(), g = ctx.createGain(); s.buffer = pluckBuf(midi); g.gain.value = v * 0.7;
    s.connect(g); g.connect(bus.pluck); s.start(t); s.stop(t + 2.2);
    const o = ctx.createOscillator(), og = ctx.createGain(); o.type = 'triangle'; o.frequency.value = midiHz(midi); env(og, t, v * 0.5, 0.004, 0.02, 0.7);
    o.connect(og); og.connect(bus.pluck); o.start(t); o.stop(t + 0.8);
  }
  function bellNote(t: number, midi: number, v: number) {
    const f = midiHz(midi), g = ctx.createGain(); env(g, t, v, 0.003, 0.01, 1.5); g.connect(bus.bell);
    for (const [r, a] of [[1, 1], [2.76, 0.22], [5.4, 0.06]]) { const o = ctx.createOscillator(), og = ctx.createGain(); o.frequency.value = f * r; og.gain.value = a; o.connect(og); og.connect(g); o.start(t); o.stop(t + 1.6); }
  }
  function counterNote(t: number, midi: number, dur: number, v: number) {   // bè dây đối đáp: vào chậm, đi chung lọc với dây nền
    const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(v, t + 0.35); g.gain.setValueAtTime(v, t + dur - 0.2); g.gain.linearRampToValueAtTime(0.0001, t + dur + 0.15); g.connect(padF);
    for (const det of [-8, 8]) { const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = midiHz(midi); o.detune.value = det; o.connect(g); o.start(t); o.stop(t + dur + 0.2); }
  }

  /* ---------- Bộ lập lịch ---------- */
  let next = 0, sec = 0, bar = 0, step = 0, cycle = 0, chords: Chord[] = PROG.day, chord: Chord = PROG.day[0], arpPat = ARP[0], started = false;
  function enterSection(S: Section) {
    const night = mix.night > M.night.minor;
    const name: ProgName = S.prog === 'main' ? (night ? 'night' : 'day') : S.prog === 'alt' ? (night ? 'day' : 'night') : S.prog;
    chords = PROG[name]; arpPat = ARP[(cycle + sec) % ARP.length];
  }
  function scheduleStep(t: number) {
    const S = SECTIONS[sec], last = bar === S.bars - 1, hum = () => 0.9 + rnd() * 0.2;
    if (step === 0) {
      if (bar === 0) { enterSection(S); if (S.crash) crash(t, 0.7); }
      chord = chords[(bar + (S.progAt ?? 0)) % chords.length];
      const pad = chordNotes(chord, 54, 4);   // bốn bè quanh Fa♯ 3 – Mi 4: hợp âm kế cận nhau, bè đi gần
      for (let v = 0; v < 4; v++) for (const o of padOsc[v]) o.frequency.setTargetAtTime(midiHz(pad[v] + (v === 3 ? 12 : 0)), t, started ? 0.035 : 0.001);
      padEnv.gain.setTargetAtTime(S.pad, t, started ? 0.5 : 0.25); started = true;
      if (S.counter !== undefined && bar >= S.counter) counterNote(t, nearestTone(chord, COUNTER[bar % 8]), BAR, 0.16);
      if (last && S.riser) riser(t, BAR, 0.5);
      if (mix.storm > M.storm.tomAt) { tom(t, M.storm.tom * mix.storm, 62, stormBus); if (bar % 2) tom(t + STEP * 10, M.storm.tom * mix.storm * 0.7, 55, stormBus); }
    }
    const acc = ACCENT[step];
    // Bass
    const root = mix.storm > M.storm.pedalAt ? 38 : chord.bass;
    if (S.bass === 'long') { if (step === 0) bassNote(t, root, BAR * 0.96, 0.8); }
    else if (prof.bassSync ? acc : step % 2 === 0) bassNote(t, root + ((prof.bassSync ? step === 11 : step === 14) ? 12 : 0), STEP * (prof.bassSync ? 2.4 : 1.7), (step === 0 ? 1 : 0.82) * hum());
    // Rải + đệm
    if (S.arp > 0) { const tones = chordNotes(chord, 62, 6); arpNote(t, tones[arpPat[step] % tones.length], S.arp * (acc ? 1 : 0.5) * hum()); }
    if (S.stab > 0 && acc) stab(t, chordNotes(chord, 57, 3), S.stab * (step === 0 ? 1 : 0.75));
    // Trống
    const D = S.drums, fill = last && S.fill && step >= 8;
    if (D === 'pulse') { if (step % 4 === 0) kick(t, 0.75); if (step % 4 === 2) hat(t, 0.6 * hum()); }
    else if (D === 'half') { if (step === 0 || step === 10) kick(t, step ? 0.8 : 1); if (step === 8) snare(t, 1); if (step % 2 === 0) hat(t, (step % 4 === 2 ? 0.8 : 0.5) * hum()); }
    else if (D === 'drive') {
      if (step % 4 === 0) kick(t, 1); if (!fill && (step === 4 || step === 12)) snare(t, 1);
      if (step % 4 === 2) hat(t, 0.9 * hum(), step === 14); else if (step % 4 === 0) hat(t, 0.45 * hum());
    }
    if (D !== 'none' && prof.hat16 && step % 2 === 1) hat(t, 0.35 * hum());
    if (D !== 'none' && prof.hat16 && (step === 3 || step === 6 || step === 11)) rim(t, 0.8);
    if (step % 2 === 0) shaker(t, (step % 4 === 2 ? 1 : 0.5) * hum());                      // lắc nhẹ: nghe được ở đi dạo / đoạn lặng (âm lượng theo lớp perc)
    if (fill) { snare(t, 0.35 + 0.08 * (step - 8)); if (D === 'drive' && step >= 12 && step % 2 === 0) tom(t, 0.5, step === 12 ? 110 : 82, bus.snare); }
    // Giai điệu
    if (S.mel) {
      const b8 = bar % 8, r = S.melBars;
      if (!r || (b8 >= r[0] && b8 < r[1])) {
        const notes = (S.mel === 'theme' ? THEME_AT : BRIDGE_AT).get(b8 * 16 + step);
        if (notes) for (const [, m, l] of notes) {
          const dur = l * STEP;
          if (S.lead > 0) { leadNote(t, m, dur, S.lead); if (S.double || (cycle % 2 === 1 && S.name === 'return')) leadNote(t, m + 12, dur, S.lead * 0.3); }
          if (S.pluck > 0) pluckNote(t, m, S.pluck * hum());
          if (S.bell > 0) bellNote(t, m + 12, S.bell);
        }
      }
    }
  }
  function advance() {
    if (++step < 16) return; step = 0;
    if (++bar < SECTIONS[sec].bars) return; bar = 0;
    if (++sec < SECTIONS.length) return; sec = 0; cycle++;
  }

  /* ---------- Bản phối ---------- */
  function setMix(m: MusicMix, now: number, snap = false) {
    mix = { ...m }; prof = M.modes[m.mode];
    const N = M.night, R = M.rain, S = M.storm, n = m.night, r = m.rain, s = m.storm, tau = snap ? 0.001 : M.xfade;
    const k: Record<Layer, number> = { pad: 1, stab: 1, arp: 1, bass: 1, kick: 1 + N.drums * n, snare: (1 + N.drums * n) * (1 + S.snare * s), hat: 1 + R.hat * r, perc: 1,
      lead: (1 + N.lead * n) * (1 + R.lead * r), pluck: 1 + R.pluck * r, bell: 1 + N.bell * n, air: 1 + N.air * n + R.air * r };
    for (const L of LAYERS) bus[L].gain.setTargetAtTime(M.level[L] * prof[L] * k[L] * prof.trim, now, tau);
    arpF.frequency.setTargetAtTime(prof.arpCut * (1 - 0.2 * n), now, tau);
    padF.frequency.setTargetAtTime((N.padCutDay + (N.padCutNight - N.padCutDay) * n) * (1 + R.padCut * r), now, tau);
    droneG.gain.setTargetAtTime(S.drone * s * prof.trim, now, tau);
    if (deps.tone) deps.tone.frequency.setTargetAtTime(N.toneDay + (N.toneNight - N.toneDay) * n, now, tau);
  }
  setMix(mix, 0, true);

  return {
    schedule(until) { while (next < until) { scheduleStep(next); advance(); next += STEP; } },
    restart(t, section = 0) { next = t; sec = section % SECTIONS.length; bar = 0; step = 0; started = false; },
    setMix,
    sting(t) { if (M.sting <= 0) return; riser(t, 0.9, 0.35 * M.sting, bus.bell); for (const [i, m] of [81, 86, 90].entries()) bellNote(t + 0.9 + i * 0.09, m, 0.9 * M.sting); },
    get pos() { return { section: SECTIONS[sec].name, bar, cycle }; }
  };
}

/* Kết xuất ngoại tuyến `seconds` giây nhạc với một bản phối cố định, qua đúng chuỗi lọc tổng + hồi âm + nén của trang (audio/index.ts):
   để đo biên độ / nghe thử mà không cần loa. Chỉ gọi trong công cụ kiểm (tests/music-render.mjs) */
export async function renderMusic(seconds: number, m: MusicMix, sampleRate = 44100, section = 0, volume = 0.63): Promise<AudioBuffer> {
  const ctx = new OfflineAudioContext(2, Math.ceil(seconds * sampleRate), sampleRate), rnd = rng(CONFIG.music.seed + 1);
  const master = ctx.createGain(); master.gain.value = volume;
  const comp = ctx.createDynamicsCompressor(); comp.threshold.value = -18; comp.ratio.value = 3; master.connect(comp); comp.connect(ctx.destination);
  const tone = ctx.createBiquadFilter(); tone.type = 'lowpass'; tone.frequency.value = 12000; tone.connect(master);
  const bus = ctx.createGain(); bus.gain.value = CONFIG.music.gain; bus.connect(tone);
  const verb = ctx.createConvolver(); verb.buffer = makeIR(ctx, rnd); const send = ctx.createGain(); send.gain.value = 0.3 + CONFIG.music.night.verb * m.night; send.connect(verb); verb.connect(tone);
  const mu = createMusic(ctx, bus, { verb: send, tone, ...makeNoise(ctx, rnd) });
  mu.setMix(m, 0, true); mu.restart(0.05, section); mu.schedule(seconds);
  return ctx.startRendering();
}

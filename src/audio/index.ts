/* ============================ Nhạc nền & âm thanh ============================
   Toàn bộ âm thanh được tổng hợp bằng Web Audio, không dùng file ngoài.
   - Nhạc chủ đề "The Spirit of Da Nang" (D-046): bản tổng phổ ở score.ts, bộ phát nhiều lớp ở music.ts. File này giữ chuỗi tổng (âm lượng, lọc, hồi âm, nén),
     bật / tắt, hạ nhạc khi có giọng thuyết minh và chọn bản phối theo chế độ (setMode), ngày / đêm (update), mưa / bão (setWeather).
   - Tiếng sông Hàn, tiếng dế về đêm, mưa / gió / sấm.
   - Trình diễn: tiếng lửa phụt + trống, tiếng phun nước, to nhỏ theo khoảng cách camera.
   - Cầu sông Hàn: còi báo khi quay, tiếng động cơ mâm xoay.
   Một AudioContext, một bộ phát nhạc cho cả trang: đổi chế độ / góc nhìn không tạo bản nhạc thứ hai, không phát lại từ đầu. */

import { CONFIG } from '../config';
import { createMusic, makeIR, makeNoise, type Music } from './music';
import type { MusicMode } from './score';

interface AudioState {
  ctx: AudioContext | null; on: boolean; volume: number; night: number; timer: number;
  noise: AudioBuffer | null; white?: AudioBuffer;
  player?: Music; mode: MusicMode; mixKey: string; wxStorm: number;   // bộ phát nhạc, bản phối đang chọn, khóa bản phối đã áp, mức bão cho nhạc
  waterSrc: AudioBufferSourceNode | null; waterGain: GainNode | null; lastFire: boolean; lastWater: boolean; distGain: number;
  master?: GainNode; tone?: BiquadFilterNode; music?: GainNode; sfx?: GainNode; verb?: ConvolverNode; verbSend?: GainNode;
  riverGain?: GainNode; motorGain?: GainNode; swingGain?: number; ducked?: boolean;
  ext?: GainNode; extOn?: boolean;   // cổng riêng của tiếng xe khi chưa bật âm thanh chung (extPort)
  wxDuck: number; rainGain?: GainNode; windGain?: GainNode; windBp?: BiquadFilterNode; wxRain: number; wxWind: number; wxIndoors: number; patterAt: number;   // thời tiết (GĐ7)
}
type AudioCtor = typeof AudioContext;

const EXPLORE: MusicMode[] = ['glider', 'car', 'bike', 'stroll'];   // vào các chế độ này thì có tiếng "mở màn"

export function createAudio() {
  const A: AudioState = { ctx: null, on: false, volume: 0.7, night: 0, timer: 0, mode: 'overview', mixKey: '', wxStorm: 0,
    noise: null, waterSrc: null, waterGain: null, lastFire: false, lastWater: false, distGain: 1, wxDuck: 1, wxRain: 0, wxWind: 0, wxIndoors: 0, patterAt: 0 };
  const R = Math.random;

  function build() {
    const ctx = A.ctx = new ((window.AudioContext || (window as unknown as { webkitAudioContext: AudioCtor }).webkitAudioContext))();
    // Chuỗi tổng: nén nhẹ → loa
    A.master = ctx.createGain(); A.master.gain.value = 0;
    const comp = ctx.createDynamicsCompressor(); comp.threshold.value = -18; comp.ratio.value = 3;
    A.master.connect(comp).connect(ctx.destination);
    A.tone = ctx.createBiquadFilter(); A.tone.type = 'lowpass'; A.tone.frequency.value = CONFIG.music.night.toneDay;
    A.tone.connect(A.master);
    A.music = ctx.createGain(); A.music.gain.value = musicLevel(); A.music.connect(A.tone);
    A.sfx = ctx.createGain(); A.sfx.gain.value = 1; A.sfx.connect(A.master);
    // Hồi âm: đáp ứng xung tự sinh (nhiễu tắt dần, stereo)
    A.verb = ctx.createConvolver(); A.verb.buffer = makeIR(ctx, R);
    A.verbSend = ctx.createGain(); A.verbSend.gain.value = 0.3;
    A.verbSend.connect(A.verb).connect(A.tone);
    // Nhiễu nâu / trắng dùng chung (sông, lửa, nước, mưa, trống của nhạc)
    const nz = makeNoise(ctx, R); A.noise = nz.brown; A.white = nz.white;
    A.player = createMusic(ctx, A.music, { verb: A.verbSend, brown: nz.brown, white: nz.white, tone: A.tone }); A.mixKey = '';
    buildRiver(); buildWater(); buildWeatherSound();
  }
  const DUCK = Math.pow(10, CONFIG.music.duckDb / 20);
  const musicLevel = () => CONFIG.music.gain * (A.ducked ? DUCK : 1) * A.wxDuck;   // nhạc nền: giọng thuyết minh và bão cùng hạ


  function drum(t, vel = 1) { // trống lớn khi rồng phun lửa
    const ctx = A.ctx, o = ctx.createOscillator(), g = ctx.createGain();
    o.frequency.setValueAtTime(92, t); o.frequency.exponentialRampToValueAtTime(42, t + 0.45);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.55 * vel, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.9);
    o.connect(g); g.connect(A.sfx); g.connect(A.verbSend); o.start(t); o.stop(t + 1);
  }
  function buildRiver() {
    const ctx = A.ctx, src = ctx.createBufferSource(); src.buffer = A.noise; src.loop = true;
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 650;
    A.riverGain = ctx.createGain(); A.riverGain.gain.value = 0.05;
    const lfo = ctx.createOscillator(), lfoG = ctx.createGain(); lfo.frequency.value = 0.09; lfoG.gain.value = 0.02;
    lfo.connect(lfoG).connect(A.riverGain.gain); lfo.start();
    src.connect(lp).connect(A.riverGain).connect(A.sfx); src.start();
  }
  function buildWater() {
    const ctx = A.ctx, src = ctx.createBufferSource(); src.buffer = A.white; src.loop = true;
    const hp = ctx.createBiquadFilter(); hp.type = 'bandpass'; hp.frequency.value = 3200; hp.Q.value = 0.5;
    A.waterGain = ctx.createGain(); A.waterGain.gain.value = 0;
    src.connect(hp).connect(A.waterGain).connect(A.sfx); src.start();
  }
  /* Thời tiết (GĐ7, mục 7): mưa = nhiễu trắng qua bandpass + lowpass; gió = nhiễu nâu qua bandpass trượt tần số; sấm gọi riêng. Mọi gain ban đầu 0. */
  function buildWeatherSound() {
    const ctx = A.ctx, W = CONFIG.weather.sound;
    const rs = ctx.createBufferSource(); rs.buffer = A.white; rs.loop = true;
    const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = W.rainBand[0]; bp.Q.value = W.rainBand[1];
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = W.rainLow;
    A.rainGain = ctx.createGain(); A.rainGain.gain.value = 0; rs.connect(bp).connect(lp).connect(A.rainGain).connect(A.sfx); rs.start();
    const ws = ctx.createBufferSource(); ws.buffer = A.noise; ws.loop = true;
    A.windBp = ctx.createBiquadFilter(); A.windBp.type = 'bandpass'; A.windBp.frequency.value = W.windBase; A.windBp.Q.value = W.windQ;
    A.windGain = ctx.createGain(); A.windGain.gain.value = 0; ws.connect(A.windBp).connect(A.windGain).connect(A.sfx); ws.start();
  }
  /* "Tí tách": một hạt mưa ngắn, ngẫu nhiên (Math.random như phần nhạc, KHÔNG dùng rand() của cảnh) */
  function patter(t, v) {
    const ctx = A.ctx, o = ctx.createOscillator(), g = ctx.createGain(), pan = ctx.createStereoPanner();
    o.frequency.value = 1800 + R() * 2600; pan.pan.value = R() * 1.6 - 0.8;
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(v, t + 0.004); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.03);
    o.connect(g).connect(pan).connect(A.sfx); o.start(t); o.stop(t + 0.04);
  }
  function cricket(t) {
    const ctx = A.ctx, o = ctx.createOscillator(), am = ctx.createOscillator(), amG = ctx.createGain(), g = ctx.createGain(), pan = ctx.createStereoPanner();
    o.frequency.value = 4300 + R() * 600; am.frequency.value = 28 + R() * 10; amG.gain.value = 0.5;
    g.gain.value = 0; pan.pan.value = R() * 1.6 - 0.8;
    const n = 2 + Math.floor(R() * 3);
    for (let i = 0; i < n; i++) { const s = t + i * 0.32; g.gain.setValueAtTime(0, s); g.gain.linearRampToValueAtTime(0.012, s + 0.03); g.gain.linearRampToValueAtTime(0, s + 0.18); }
    am.connect(amG).connect(g.gain);
    o.connect(g).connect(pan).connect(A.sfx); o.start(t); am.start(t); o.stop(t + n * 0.32 + 0.2); am.stop(t + n * 0.32 + 0.2);
  }
  function fireWhoosh(t) {
    const ctx = A.ctx, src = ctx.createBufferSource(); src.buffer = A.noise;
    const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.Q.value = 0.7;
    bp.frequency.setValueAtTime(260, t); bp.frequency.exponentialRampToValueAtTime(1100, t + 0.25); bp.frequency.exponentialRampToValueAtTime(380, t + 1.6);
    const g = ctx.createGain(), v = 1.6 * A.distGain;
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(v, t + 0.07); g.gain.exponentialRampToValueAtTime(0.0001, t + 1.7);
    src.connect(bp).connect(g).connect(A.sfx);
    src.start(t, R() * 2); src.stop(t + 1.8);
    drum(t, 0.6 + 0.4 * A.distGain);
  }

  /* Nhịp lập lịch: nhạc nhìn trước lookahead giây; tiếng dế thưa về đêm (Math.random, không dùng rand() của cảnh) */
  function tick() {
    const now = A.ctx.currentTime;
    A.player.schedule(now + CONFIG.music.lookahead);
    if (A.night > 0.6 && R() < 0.013) cricket(now + R() * 0.3);
  }
  /* Bản phối = chế độ + đêm + mưa + bão, làm tròn để chỉ ghi tham số khi thật sự đổi (mỗi lần ghi là một loạt sự kiện tự động hoá, D-018) */
  function applyMix(now: number, snap = false) {
    const night = Math.round(A.night * 20) / 20, rain = Math.round(A.wxRain * 10) / 10, storm = Math.round(A.wxStorm * 10) / 10, key = `${A.mode}|${night}|${rain}|${storm}`;
    if (key === A.mixKey) return;
    A.mixKey = key; A.player.setMix({ mode: A.mode, night, rain, storm }, now, snap);
    A.verbSend.gain.setTargetAtTime(0.3 + CONFIG.music.night.verb * night, now, 0.5);
  }

  return {
    get on() { return A.on; },
    start() {
      if (!A.ctx) build();
      A.ctx.resume();
      if (A.on) return;                                   // đang phát: không lên lịch lại, không phát chồng
      A.on = true;
      const now = A.ctx.currentTime;
      A.mixKey = ''; applyMix(now, true);                 // bản phối đúng chế độ ngay từ nốt đầu
      A.player.restart(now + 0.12);                       // mỗi lần bật: vào từ đoạn mở đầu "lời mời"
      A.master.gain.cancelScheduledValues(now);
      A.master.gain.setTargetAtTime(A.volume, now, CONFIG.music.fadeIn);   // vào êm
      clearInterval(A.timer); A.timer = window.setInterval(tick, CONFIG.music.tickMs); tick();
    },
    stop() {
      if (!A.ctx) return;
      A.on = false; clearInterval(A.timer);
      A.master.gain.cancelScheduledValues(A.ctx.currentTime); A.master.gain.setTargetAtTime(0, A.ctx.currentTime, CONFIG.music.fadeOut);
      setTimeout(() => { if (!A.on && !A.extOn) A.ctx.suspend(); }, 1200);
    },
    setVolume(v) { A.volume = v; if (A.ctx && A.on) A.master.gain.setTargetAtTime(v, A.ctx.currentTime, 0.08); },
    /* Giọng thuyết minh cất lên: hạ nhạc duckDb nhanh; giọng dứt: trả nhạc từ từ */
    duck(on) { A.ducked = on; if (A.music) A.music.gain.setTargetAtTime(musicLevel(), A.ctx.currentTime, on ? CONFIG.music.duckAttack : CONFIG.music.duckRelease); },
    /* Bản phối theo chế độ (score.ts musicModeOf), gọi mỗi khung; chỉ ghi khi đổi. Vào một chế độ khám phá thì thêm tiếng "mở màn". Chưa bật âm thanh thì chỉ nhớ */
    setMode(mode: MusicMode) {
      if (mode === A.mode) return;
      A.mode = mode;
      if (A.ctx && A.on && EXPLORE.includes(mode)) A.player.sting(A.ctx.currentTime + 0.05);
    },
    get mode() { return A.mode; },
    /* Vị trí trong bài (đoạn, ô, vòng) cho test / gỡ lỗi; null khi chưa có ngữ cảnh */
    get musicPos() { return A.player ? A.player.pos : null; },
    /* Mỗi khung (hoặc ~10 lần/giây): rain, wind (m/s tức thời), wxStorm (0–1, hạ nhạc), indoors (camera trong hầm / dưới nước: nhỏ đi). Chưa bật âm thanh thì chỉ nhớ giá trị. */
    setWeather(rain, wind, storm, indoors) {
      const W = CONFIG.weather.sound; A.wxRain = rain; A.wxWind = wind; A.wxIndoors = indoors ? W.indoors : 1;
      A.wxDuck = 1 - (1 - W.musicDuck) * Math.min(1, storm); A.wxStorm = Math.min(1, storm);
      if (!A.ctx || !A.on) return;
      const now = A.ctx.currentTime, k = A.wxIndoors;
      A.rainGain.gain.setTargetAtTime(W.rainGain * rain * k, now, 0.4);
      A.windGain.gain.setTargetAtTime(W.windGain * Math.min(1.3, (wind / 28) ** 2) * k, now, 0.3);
      A.windBp.frequency.setTargetAtTime(W.windBase + W.windPerMs * wind, now, 0.3);
      A.music.gain.setTargetAtTime(musicLevel(), now, 0.5);
      if (rain > 0.05 && now > A.patterAt) { patter(now + R() * 0.1, 0.02 * rain * k); A.patterAt = now + 0.1 / Math.max(0.05, rain * W.patter * 0.1); }
    },
    /* Sấm: nhiễu nâu lowpass 120–300 Hz, rền 2–4 s, trễ delay giây (khoảng cách / 343 m/s), to ∝ loud (1 = ở 800 m) */
    thunder(delay, loud) {
      if (!A.ctx || !A.on) return;
      const ctx = A.ctx, W = CONFIG.weather.sound, t = ctx.currentTime + delay, dur = W.thunderSec[0] + R() * (W.thunderSec[1] - W.thunderSec[0]);
      const src = ctx.createBufferSource(); src.buffer = A.noise;
      const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = W.thunderLow[0] + R() * (W.thunderLow[1] - W.thunderLow[0]);
      const g = ctx.createGain(), v = W.thunderGain * Math.min(1.5, loud) * A.wxIndoors;
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(v, t + 0.12); g.gain.setTargetAtTime(0.0001, t + 0.3, dur / 4);
      src.connect(lp).connect(g).connect(A.sfx); src.start(t, R() * 2); src.stop(t + dur + 0.5);
    },
    /* Cổng cho hiệu ứng ngoài (tiếng xe của chế độ lái): ngữ cảnh + nút hiệu ứng, chỉ khi người xem đã bấm phát ít nhất một lần (chưa có ngữ cảnh thì null: không tạo ở đây).
       Nút tắt tiếng chung (master) vẫn chặn mọi thứ nối vào đây; `on` cho biết tiếng đang bật */
    sfxPort() { return A.ctx && A.sfx ? { ctx: A.ctx, out: A.sfx as AudioNode, on: A.on } : null; },
    /* Cổng riêng cho tiếng xe khi người xem bật bằng nút 🔊 của chế độ lái mà CHƯA bật âm thanh chung (nút nhạc ẩn trong chế độ khám phá).
       Gọi trong thao tác của người xem (bấm): tạo ngữ cảnh nếu chưa có (master vẫn 0, không lên lịch nhạc ⇒ không phát nhạc / tiếng nền), resume,
       trả nút ra riêng nối thẳng loa với âm lượng chung. on = false: thả cổng, âm thanh chung đang tắt thì ngưng ngữ cảnh. Chưa ai gọi thì không đổi gì */
    extPort(on = true) {
      A.extOn = on;
      if (!on) { if (A.ctx && !A.on) A.ctx.suspend(); return null; }
      if (!A.ctx) build();
      A.ctx.resume();
      if (!A.ext) { A.ext = A.ctx.createGain(); A.ext.connect(A.ctx.destination); }
      A.ext.gain.value = A.volume;
      return { ctx: A.ctx, out: A.ext as AudioNode };
    },
    pause() { if (A.ctx && A.on) { clearInterval(A.timer); A.ctx.suspend(); } else if (A.ctx && A.extOn) A.ctx.suspend(); },
    resume() { if (A.ctx && A.on) { A.ctx.resume(); clearInterval(A.timer); A.timer = window.setInterval(tick, CONFIG.music.tickMs); } else if (A.ctx && A.extOn) A.ctx.resume(); },
    /* Gọi mỗi khung hình: ngày/đêm, trạng thái trình diễn, khoảng cách camera tới đầu rồng */
    /* Cầu sông Hàn: còi báo khi quay, tiếng động cơ mâm xoay; to nhỏ theo khoảng cách camera */
    setSwingDistance(d) { A.swingGain = Math.max(0.08, Math.min(1, 160 / Math.max(d, 1))); },
    horn() {
      if (!A.ctx || !A.on) return;
      const ctx = A.ctx, t = ctx.currentTime, g = ctx.createGain(), lp = ctx.createBiquadFilter(), v = 0.32 * (A.swingGain ?? 0.3);
      lp.type = 'lowpass'; lp.frequency.value = 1500;
      g.gain.setValueAtTime(0.0001, t);
      for (const [a, b] of [[0, 1.3], [1.7, 3.0]]) { g.gain.exponentialRampToValueAtTime(v, t + a + 0.06); g.gain.setValueAtTime(v, t + b - 0.1); g.gain.exponentialRampToValueAtTime(0.0001, t + b); }
      for (const f of [311, 370]) { const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = f; o.connect(lp); o.start(t); o.stop(t + 3.1); }
      lp.connect(g).connect(A.sfx);
    },
    motor(on) {
      if (!A.ctx) return;
      const ctx = A.ctx;
      if (!A.motorGain) {
        A.motorGain = ctx.createGain(); A.motorGain.gain.value = 0;
        const src = ctx.createBufferSource(); src.buffer = A.noise; src.loop = true;
        const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 220;
        const o = ctx.createOscillator(); o.type = 'triangle'; o.frequency.value = 52; const og = ctx.createGain(); og.gain.value = 0.25;
        src.connect(lp).connect(A.motorGain); o.connect(og).connect(A.motorGain); A.motorGain.connect(A.sfx); src.start(); o.start();
      }
      A.motorGain.gain.setTargetAtTime(on && A.on ? 0.5 * (A.swingGain ?? 0.3) : 0, ctx.currentTime, 0.6);
    },
    update(night, fireOn, waterOn, distToHead) {
      if (!A.ctx || !A.on) return;
      const now = A.ctx.currentTime;
      A.night = night;
      A.distGain = Math.max(0.12, Math.min(1, 90 / Math.max(distToHead, 1)));
      applyMix(now);                                      // đêm / mưa / bão / chế độ đổi thì trượt bản phối
      if (fireOn && !A.lastFire) fireWhoosh(now + 0.02);
      if (waterOn !== A.lastWater) A.waterGain.gain.setTargetAtTime(waterOn ? 0.22 * A.distGain : 0, now, waterOn ? 0.15 : 0.6);
      A.lastFire = fireOn; A.lastWater = waterOn;
    }
  };
}

/* Một bộ âm thanh cho cả trang; chỉ tạo AudioContext khi người xem bấm phát (chính sách autoplay của trình duyệt) */
export const audio = createAudio();

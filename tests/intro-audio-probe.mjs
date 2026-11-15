// Âm thanh trong đoạn giới thiệu (D-045 + nhạc D-046): đo trong TRANG THẬT (dist/, GPU thật) — không phải bộ test nặng.
//   npm run build && node tests/intro-audio-probe.mjs [--wav] [--lang=en] [--label=before]
// Chèn một AudioWorklet "nghe trộm" ngay trước loa (mọi kết nối tới ctx.destination đi qua một bus), mở intro (?test&intro&lightsets=bg),
// bấm nút nhạc #inSound, để intro chạy hết. In theo từng nhịp: đỉnh / RMS (dBFS), số mẫu vượt 0 dBFS (sẽ bị cắt ở loa), số "bước nhảy" mẫu
// lớn bất thường (tiếng tách), số nguồn âm thanh đang chạy, khung dài nhất, bước nhạc bị bỏ. --wav ghi tests/screens/intro-audio/<label>.wav để nghe.
import { serveDir } from './lib.mjs';
import { chromium } from 'playwright';
import { fileURLToPath } from 'node:url';
import { mkdirSync, writeFileSync } from 'node:fs';

const arg = (k, d) => { const a = process.argv.find((x) => x.startsWith(`--${k}=`)); return a ? a.slice(k.length + 3) : d; };
const WAV = process.argv.includes('--wav'), LANG = arg('lang', ''), LABEL = arg('label', 'run');
const srv = await serveDir(fileURLToPath(new URL('../dist/', import.meta.url)));
const args = ['--enable-blink-features=AudioContextPlayoutStats', '--ignore-gpu-blocklist', '--enable-gpu', '--autoplay-policy=no-user-gesture-required']; if (process.platform === 'win32') args.unshift('--use-angle=d3d11');
const browser = await chromium.launch({ headless: !process.argv.includes('--headed'), args });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } }); page.setDefaultTimeout(240000);
const errors = [], warns = [];
page.on('pageerror', (e) => errors.push(String(e)));
page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') warns.push(m.text()); });
await page.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.abort());

/* ---------- chèn trước mọi script của trang ---------- */
if (process.argv.includes('--notap')) await page.addInitScript(() => { window.__noTap = true; });
await page.addInitScript(() => {
  const P = window.__ap = { blocks: [], pcm: [], live: 0, made: 0, maxLive: 0, ctx: null, ready: false, frames: [], longTasks: [] };
  const WORKLET = `class Tap extends AudioWorkletProcessor {
    constructor() { super(); this.n = 0; this.pk = 0; this.ss = 0; this.over = 0; this.jump = 0; this.last = [0, 0]; this.t0 = -1; this.buf = []; }
    process(inp) {
      const ch = inp[0]; if (!ch || !ch.length) return true;
      if (this.t0 < 0) this.t0 = currentTime;
      const L = ch[0], R = ch[1] || ch[0], m = new Float32Array(L.length);
      for (let i = 0; i < L.length; i++) {
        for (const [c, x] of [[0, L[i]], [1, R[i]]]) {
          const a = Math.abs(x); if (a > this.pk) this.pk = a; this.ss += x * x; if (a > 1) this.over++;
          if (Math.abs(x - this.last[c]) > 0.5) this.jump++; this.last[c] = x;
        }
        m[i] = (L[i] + R[i]) * 0.5;
      }
      this.n += L.length; this.buf.push(m);
      if (this.n >= 12000) {   // 0,25 s ở 48 kHz
        this.port.postMessage({ t: currentTime, pk: this.pk, rms: Math.sqrt(this.ss / (2 * this.n)), over: this.over, jump: this.jump, pcm: this.buf });
        this.n = 0; this.pk = 0; this.ss = 0; this.over = 0; this.jump = 0; this.buf = [];
      }
      return true;
    }
  }
  registerProcessor('tap', Tap);`;
  const Orig = window.AudioContext;
  const conn = AudioNode.prototype.connect;
  class Wrapped extends Orig {
    constructor(...a) {
      super(...a);
      P.ctx = this;
      const bus = this.createGain(); conn.call(bus, this.destination); this.__bus = bus;
      const url = URL.createObjectURL(new Blob([WORKLET], { type: 'application/javascript' }));
      if (window.__noTap) { P.ready = true; return; }
      this.audioWorklet.addModule(url).then(() => {
        const tap = new AudioWorkletNode(this, 'tap', { numberOfInputs: 1, numberOfOutputs: 0, channelCount: 2, channelCountMode: 'explicit' });
        tap.port.onmessage = (e) => { const d = e.data; P.blocks.push({ t: d.t, pk: d.pk, rms: d.rms, over: d.over, jump: d.jump, live: P.live, scene: P.scene }); if (P.rec) P.pcm.push(...d.pcm); };
        conn.call(bus, tap); P.ready = true;
      });
    }
  }
  window.AudioContext = Wrapped;
  AudioNode.prototype.connect = function (dst, ...r) { if (dst && this.context && dst === this.context.destination && this.context.__bus && this !== this.context.__bus) dst = this.context.__bus; return conn.call(this, dst, ...r); };
  for (const k of ['createOscillator', 'createBufferSource', 'createConstantSource']) {
    const f = BaseAudioContext.prototype[k];
    BaseAudioContext.prototype[k] = function (...a) {
      const n = f.apply(this, a); P.made++;
      const st = n.start.bind(n); let on = false; const who = (new Error().stack || '').split('\n').slice(2, 5).map((l) => l.trim().replace(/\(?https?:\/\/[^/]+\//, '').replace(/\)$/, '')).join(' < ');
      n.start = (...b) => { if (!on) { on = true; (P.who ||= new Map()).set(n, who); P.live++; if (P.live > P.maxLive) P.maxLive = P.live; } return st(...b); };
      n.addEventListener('ended', () => { if (on) { on = false; P.live--; P.who.delete(n); } });
      return n;
    };
  }
  let last = performance.now();
  const f = () => { const n = performance.now(); P.frames.push([n, n - last, P.scene]); last = n; requestAnimationFrame(f); }; requestAnimationFrame(f);
  try { new PerformanceObserver((l) => { for (const e of l.getEntries()) P.longTasks.push([e.startTime, e.duration, P.scene]); }).observe({ type: 'longtask', buffered: true }); } catch { /* không hỗ trợ */ }
});

const CPU = Number(arg('cpu', '1'));
if (CPU > 1) { const cdp = await page.context().newCDPSession(page); await cdp.send('Emulation.setCPUThrottlingRate', { rate: CPU }); }
const PROD = process.argv.includes('--prod');   // như người xem thật: không ?test (chất lượng Tự động, bộ đèn mặc định), intro tự phát, bấm vào cảnh để mở âm thanh
const q = (PROD ? (arg('extra', '') ? '?' + arg('extra', '') : '') : '?test&intro&lightsets=' + arg('lightsets', 'bg')) + (LANG ? `${PROD ? '?' : '&'}lang=${LANG}` : '');
await page.goto((arg('url', '') || srv.url) + q, { waitUntil: 'load' });
await page.waitForFunction(() => document.getElementById('loading')?.classList.contains('done') && !document.getElementById('intro').hidden, null, { timeout: 240000 });
if (PROD) await page.mouse.click(640, 360); else await page.click('#inSound');   // thao tác đầu tiên của người xem: bật âm thanh chung + nhạc
await page.waitForFunction(() => window.__ap.ctx && window.__ap.ctx.state === 'running' && window.__ap.ready);
const VOL = arg('vol', '');   // thanh âm lượng 0–100 như người xem kéo (mặc định của trang 70)
if (VOL) await page.evaluate((v) => { const s = document.getElementById('volSlider'); s.value = v; s.dispatchEvent(new Event('input')); }, VOL);
await page.evaluate((rec) => { const P = window.__ap; P.rec = rec; P.blocks.length = 0; P.frames.length = 0; P.longTasks.length = 0; P.maxLive = P.live;
  const root = document.getElementById('intro'), scene = () => (root.hidden ? 'done' : root.dataset.scene || 'done');
  P.fb = {}; P.fbd = {}; const ps = P.ctx.playoutStats; let lf = ps ? ps.fallbackFramesEvents : 0, ld = ps ? ps.fallbackFramesDuration : 0;
  const A = window.__app && window.__app.audio; P.sk = {}; let lsk = A ? A.musicStat.skipped : 0;
  const s = () => { P.scene = scene(); if (A) { const k = A.musicStat.skipped; if (k !== lsk) { P.sk[P.scene] = (P.sk[P.scene] || 0) + k - lsk; lsk = k; } } if (ps) { const f = ps.fallbackFramesEvents, d = ps.fallbackFramesDuration; if (f !== lf) { (P.fbAt ||= []).push([Math.round(P.ctx.currentTime * 10) / 10, P.scene, f - lf, Math.round(d - ld)]); P.fb[P.scene] = (P.fb[P.scene] || 0) + f - lf; P.fbd[P.scene] = (P.fbd[P.scene] || 0) + d - ld; lf = f; ld = d; } } requestAnimationFrame(s); }; s(); }, WAV);
const t0 = Date.now();
await page.waitForFunction(() => { const r = document.getElementById('intro'); return r.hidden || r.dataset.scene === 'finale'; }, null, { timeout: 240000, polling: 500 });
await page.waitForTimeout(9000);                                     // nhịp kết 6 s + đuôi                                     // đuôi nhịp kết
const R = await page.evaluate(() => { const P = window.__ap, a = window.__app ? window.__app.audio : null; return { blocks: P.blocks, frames: P.frames, longTasks: P.longTasks, maxLive: P.maxLive, live: P.live, made: P.made, stat: a ? a.musicStat : null, sr: P.ctx.sampleRate, base: P.ctx.baseLatency, out: P.ctx.outputLatency,
  sk: P.sk, fb: P.fb, fbd: P.fbd, fbAt: P.fbAt || [], whoLive: (() => { const m = {}; for (const w of (P.who || new Map()).values()) m[w] = (m[w] || 0) + 1; return Object.entries(m).sort((a, b) => b[1] - a[1]).slice(0, 12); })(), playout: P.ctx.playoutStats ? JSON.parse(JSON.stringify(P.ctx.playoutStats)) : null }; });
console.log(`intro chạy ${((Date.now() - t0) / 1000).toFixed(1)} s thật, ${R.sr} Hz; nguồn đang chạy cuối ${R.live}, nhiều nhất ${R.maxLive}, tổng nguồn tạo ${R.made}; nhạc: ${JSON.stringify(R.stat)}`);
console.log('nguồn còn sống theo chỗ tạo:'); for (const [w, n] of R.whoLive) console.log(String(n).padStart(4), w);
console.log('hụt loa (giây ngữ cảnh, nhịp, lần, ms):', R.fbAt.map((x) => x.join(' ')).join(' · '));
if (R.playout) console.log('playoutStats', JSON.stringify(R.playout));
const db = (x) => (x > 0 ? (20 * Math.log10(x)).toFixed(1) : '-inf');
const order = []; const by = {};
for (const b of R.blocks) { const k = b.scene || '?'; if (!by[k]) { by[k] = { pk: 0, ss: 0, n: 0, over: 0, jump: 0, live: 0 }; order.push(k); } const s = by[k]; s.pk = Math.max(s.pk, b.pk); s.ss += b.rms * b.rms; s.n++; s.over += b.over; s.jump += b.jump; s.live = Math.max(s.live, b.live); }
const fr = {}; for (const [, d, sc] of R.frames) { const k = sc || '?'; if (!fr[k]) { fr[k] = { max: 0, n: 0, sum: 0, long: 0 }; if (!by[k]) { by[k] = { pk: 0, ss: 0, n: 1, over: 0, jump: 0, live: 0 }; order.push(k); } } const f = fr[k]; f.max = Math.max(f.max, d); f.n++; f.sum += d; if (d > 100) f.long++; }
const lt = {}; for (const [, d, sc] of R.longTasks) { const k = sc || '?'; lt[k] = (lt[k] || 0) + d; }
console.log('nhịp       đỉnh dBFS  RMS dBFS  mẫu>0dBFS  tách  nguồn  khung TB/max ms  khung>100ms  longtask ms  hụt-loa lần/ms  nhạc bỏ bước');
for (const k of order) { const s = by[k], f = fr[k] || { max: 0, n: 1, sum: 0, long: 0 };
  console.log(`${k.padEnd(10)} ${db(s.pk).padStart(9)} ${db(Math.sqrt(s.ss / s.n)).padStart(9)} ${String(s.over).padStart(10)} ${String(s.jump).padStart(5)} ${String(s.live).padStart(6)}  ${(f.sum / f.n).toFixed(1).padStart(6)}/${f.max.toFixed(0).padStart(5)}  ${String(f.long).padStart(11)}  ${String(Math.round(lt[k] || 0)).padStart(10)}  ${String(R.fb[k] || 0).padStart(6)}/${Math.round(R.fbd[k] || 0)}  ${String(R.sk[k] || 0).padStart(5)}`); }
// khối 0,25 s tệ nhất
const worst = [...R.blocks].sort((a, b) => b.pk - a.pk).slice(0, 8);
console.log('8 khối 0,25 s to nhất:', worst.map((b) => `${b.scene}@${b.t.toFixed(1)}s ${db(b.pk)} dB over ${b.over}`).join(' · '));
if (WAV) {
  const pcm = await page.evaluate(() => { const P = window.__ap; let n = 0; for (const a of P.pcm) n += a.length; const o = new Int16Array(n); let i = 0; for (const a of P.pcm) for (let k = 0; k < a.length; k++) { const x = Math.max(-1, Math.min(1, a[k])); o[i++] = x * 32767; } let s = ''; const u = new Uint8Array(o.buffer); for (let k = 0; k < u.length; k += 32768) s += String.fromCharCode.apply(null, u.subarray(k, k + 32768)); return btoa(s); });
  const data = Buffer.from(pcm, 'base64'), h = Buffer.alloc(44);
  h.write('RIFF', 0); h.writeUInt32LE(36 + data.length, 4); h.write('WAVE', 8); h.write('fmt ', 12); h.writeUInt32LE(16, 16); h.writeUInt16LE(1, 20); h.writeUInt16LE(1, 22); h.writeUInt32LE(R.sr, 24); h.writeUInt32LE(R.sr * 2, 28); h.writeUInt16LE(2, 32); h.writeUInt16LE(16, 34); h.write('data', 36); h.writeUInt32LE(data.length, 40);
  const dir = fileURLToPath(new URL('./screens/intro-audio/', import.meta.url)); mkdirSync(dir, { recursive: true });
  writeFileSync(dir + LABEL + '.wav', Buffer.concat([h, data])); console.log('ghi', dir + LABEL + '.wav');
}
if (errors.length) console.log('Lỗi trang:', errors.join(' | '));
if (warns.length) console.log('Console cảnh báo/lỗi:', [...new Set(warns)].slice(0, 10).join(' | '));
await browser.close(); srv.close();

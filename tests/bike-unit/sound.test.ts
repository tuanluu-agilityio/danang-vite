/* ===== Xe máy: âm thanh nhiều lớp tổng hợp (src/explore/bike/sound.ts bkSound, bkEngineHz, bkRiverK) =====
   Node, không Web Audio thật: ngữ cảnh âm thanh giả đếm nút, ghi mọi lần đặt tham số (value =, setTargetAtTime, setValueAtTime, ramp)
   và mọi lần start / stop / disconnect. Cổng ra giả thay audio.sfxPort / extPort. Tiếng thật chưa ai nghe trong test. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { audio } from '../../src/audio/index.ts';
import { CONFIG } from '../../src/config.ts';
import { bkSound, bkEngineHz, bkRiverK, type BkSoundIn } from '../../src/explore/bike/sound.ts';

const S = CONFIG.bike.sound;

/* ---------- ngữ cảnh giả ---------- */
interface Ev { kind: 'value' | 'target' | 'set' | 'ramp' | 'cancel'; v: number; t: number }
class FParam {
  ev: Ev[] = []; private _v: number;
  constructor(v = 0) { this._v = v; }
  get value(): number { return this._v; }
  set value(v: number) { this._v = v; this.ev.push({ kind: 'value', v, t: -1 }); }
  setTargetAtTime(v: number, t: number) { this.ev.push({ kind: 'target', v, t }); return this; }
  setValueAtTime(v: number, t: number) { this.ev.push({ kind: 'set', v, t }); return this; }
  linearRampToValueAtTime(v: number, t: number) { this.ev.push({ kind: 'ramp', v, t }); return this; }
  exponentialRampToValueAtTime(v: number, t: number) { this.ev.push({ kind: 'ramp', v, t }); return this; }
  cancelScheduledValues(t: number) { this.ev.push({ kind: 'cancel', v: NaN, t }); return this; }
}
let writes = 0;   // tổng số lần đặt tham số (mọi FParam), để kiểm updateMs
class FNode {
  kind: string; ctx: FCtx; outs: unknown[] = []; disconnected = false;
  constructor(kind: string, ctx: FCtx) { this.kind = kind; this.ctx = ctx; ctx.made.push(this); }
  connect<T>(d: T): T { this.outs.push(d); return d; }
  disconnect() { this.disconnected = true; this.outs.length = 0; }
}
class FSrc extends FNode { started = false; stopped = false; stopAt = -1; onended: (() => void) | null = null; frequency = new FParam(); detune = new FParam(); type = ''; buffer: unknown = null; loop = false;
  start() { this.started = true; } stop(t = 0) { this.stopped = true; this.stopAt = t; } setPeriodicWave() {} }
class FCtx {
  currentTime = 10; sampleRate = 8000; made: FNode[] = [];
  private p<T extends FNode>(n: T, params: Record<string, number>): T { for (const k in params) (n as unknown as Record<string, FParam>)[k] = new FParam(params[k]); return n; }
  createGain() { return this.p(new FNode('gain', this), { gain: 1 }); }
  createBiquadFilter() { const n = this.p(new FNode('biquad', this), { frequency: 350, Q: 1, gain: 0 }); (n as unknown as { type: string }).type = 'lowpass'; return n; }
  createOscillator() { return new FSrc('osc', this); }
  createBufferSource() { const s = new FSrc('buffer', this); (s as unknown as { playbackRate: FParam }).playbackRate = new FParam(1); return s; }
  createStereoPanner() { return this.p(new FNode('pan', this), { pan: 0 }); }
  createDelay() { return this.p(new FNode('delay', this), { delayTime: 0 }); }
  createDynamicsCompressor() { return this.p(new FNode('comp', this), { threshold: -24, knee: 30, ratio: 12, attack: 0.003, release: 0.25 }); }
  createPeriodicWave(re: Float32Array, im: Float32Array) { return { re, im }; }
  createBuffer(ch: number, len: number, rate: number) { const d = new Float32Array(len); return { length: len, sampleRate: rate, numberOfChannels: ch, getChannelData: () => d }; }
}
/* đếm mọi lần đặt tham số: bọc các hàm của FParam */
for (const k of ['setTargetAtTime', 'setValueAtTime', 'linearRampToValueAtTime', 'exponentialRampToValueAtTime'] as const) {
  const f = FParam.prototype[k]; (FParam.prototype as unknown as Record<string, unknown>)[k] = function (this: FParam, v: number, t: number) { writes++; return f.call(this, v, t); };
}

/* cổng ra giả: route 'sfx' khi globalOn; extPort luôn có */
let ctx = new FCtx(), globalOn = false, extCalls: boolean[] = [];
const out = new FNode('out', ctx);
(audio as unknown as Record<string, unknown>).sfxPort = () => (globalOn ? { ctx, out, on: true } : null);
(audio as unknown as Record<string, unknown>).extPort = (on = true) => { extCalls.push(on); return on ? { ctx, out } : null; };
let now = 1000;
(performance as unknown as { now: () => number }).now = () => now;
function fresh(on = true): FCtx { bkSound.stop(); ctx = new FCtx(); globalOn = on; extCalls = []; now += 10_000; return ctx; }

const IN = (o: Partial<BkSoundIn> = {}): BkSoundIn => ({ v: 10, rpm: 5000, throttle: 0.5, brakeK: 0, sus: 0, sig: 0, rain: 0, tunnel: false, river: 0, view: 1, near: [], nNear: 0, x: 0, z: 0, yaw: 0, t: 0, ...o });
const srcs = (c: FCtx) => c.made.filter((n): n is FSrc => n instanceof FSrc);

test('bkEngineHz: tần số nổ một xi lanh bốn kỳ = rpm / 120', () => {
  assert.ok(Math.abs(bkEngineHz(1700) - 14.17) < 0.01, String(bkEngineHz(1700)));
  assert.equal(bkEngineHz(0), 0);
});

test('bkRiverK: 1 trên sông (|x| ≤ 262), giảm dần vào bờ, 0 xa bờ', () => {
  assert.equal(bkRiverK(0), 1); assert.equal(bkRiverK(-262), 1);
  const a = bkRiverK(280), b = bkRiverK(-300);
  assert.ok(a < 1 && a > b && b >= 0, `${a} ${b}`);
  assert.equal(bkRiverK(5000), 0);
});

test('trần âm lượng: maxGain không quá mô tơ ô tô + 6 dB', () => {
  assert.ok(S.maxGain <= 2 * CONFIG.drive.sound.gainMax + 1e-9, `${S.maxGain} > 2 × ${CONFIG.drive.sound.gainMax}`);
  assert.ok(S.updateMs > 0);
});

test('start() khi không có đường ra: không dựng nút, không ném', () => {
  const c = fresh(false);
  assert.doesNotThrow(() => bkSound.start());
  assert.equal(bkSound.nodes(), 0); assert.equal(c.made.length, 0);
  assert.doesNotThrow(() => bkSound.update(IN()));
  assert.equal(bkSound.nodes(), 0, 'update cũng không tự tạo ngữ cảnh');
  assert.equal(extCalls.length, 0, 'không đụng cổng riêng khi người xem chưa bấm 🔊');
});

test('start(); stop() ⇒ 0 nút sống, mọi nguồn đã stop(); máy tắt dần ≈ off.s rồi mới dừng', () => {
  const c = fresh();
  bkSound.start();
  assert.ok(bkSound.nodes() > 20, `số nút ${bkSound.nodes()}`);
  const fade = bkSound.graph!.fade;
  bkSound.stop();
  assert.equal(bkSound.nodes(), 0);
  for (const s of srcs(c)) { assert.ok(s.started, `${s.kind} chưa start`); assert.ok(s.stopped, `${s.kind} chưa stop`); assert.ok(s.stopAt >= c.currentTime + S.off.s - 1e-9, 'dừng sau khi tắt dần'); }
  const r = (fade.gain as unknown as FParam).ev.filter((e) => e.kind === 'ramp');
  assert.ok(r.length > 0 && r[r.length - 1].v === 0 && Math.abs(r[r.length - 1].t - (c.currentTime + S.off.s)) < 1e-9, 'gain tổng giảm về 0 trong off.s');
});

test('start(); start() ⇒ số nút như một lần; start() lúc đang tắt dần ⇒ bản cũ ngắt ngay, không hai máy', () => {
  const c = fresh();
  bkSound.start(); const n1 = bkSound.nodes(), made1 = c.made.length;
  bkSound.start();
  assert.equal(bkSound.nodes(), n1); assert.equal(c.made.length, made1, 'không dựng thêm nút');
  bkSound.stop();
  const old = c.made.slice();
  bkSound.start();
  assert.equal(bkSound.nodes(), n1);
  for (const n of old) assert.ok(n.disconnected, `${n.kind} của lần trước chưa ngắt`);
  const live = c.made.filter((n) => !n.disconnected && n !== out);
  assert.equal(live.length, n1, 'chỉ một bộ nút còn nối');
  bkSound.stop();
});

test('đề máy: tần số máy 0 → 2500 → 1700 vòng/phút trong 0,8 s; update không ghi đè lúc đang đề', () => {
  const c = fresh();
  bkSound.start();
  const f = (bkSound.graph!.o1.frequency as unknown as FParam).ev;
  const ramps = f.filter((e) => e.kind === 'ramp');
  assert.deepEqual(ramps.map((e) => Math.round(e.v * 120)), [2500, 1700]);
  assert.ok(Math.abs(ramps[1].t - c.currentTime - 0.8) < 1e-9);
  const n = f.length; now += 1000;
  bkSound.update(IN());
  assert.equal(f.length, n, 'đang đề: không đặt tần số theo rpm');
  c.currentTime += 1; now += 1000;
  bkSound.update(IN({ rpm: 6000 }));
  assert.ok(f.length > n && Math.abs(f[f.length - 1].v - bkEngineHz(6000)) < 1e-9, 'đề xong: theo rpm');
  bkSound.stop();
});

test('update gọi 100 lần trong cùng mili giây ⇒ ghi tham số một lần (updateMs)', () => {
  const c = fresh();
  bkSound.start(); c.currentTime += 1; now += 1000;
  const w0 = writes;
  bkSound.update(IN());
  const one = writes - w0;
  assert.ok(one > 0);
  for (let i = 0; i < 99; i++) bkSound.update(IN({ v: i }));
  assert.equal(writes - w0, one);
  now += S.updateMs;
  bkSound.update(IN());
  assert.ok(writes - w0 > one, 'sau updateMs lại ghi');
  bkSound.stop();
});

test('còi: horn(true) hai lần ⇒ một lần ghi; tắt khi stop()', () => {
  fresh();
  bkSound.start();
  const h = bkSound.graph!.horn.gain as unknown as FParam;
  const n = h.ev.length;
  bkSound.horn(true); bkSound.horn(true);
  assert.equal(h.ev.length, n + 1);
  assert.ok(h.ev[h.ev.length - 1].v > 0);
  bkSound.stop();
  const last = h.ev[h.ev.length - 1];
  assert.equal(last.v, 0, 'còi về 0 khi stop');
  bkSound.start();
  assert.equal((bkSound.graph!.horn.gain as unknown as FParam).value, 0, 'vào lại: còi không tự kêu');
  bkSound.stop();
});

test('hầm: đổi tunnel ⇒ gain nhánh vọng dùng setTargetAtTime, không nhảy giá trị', () => {
  const c = fresh();
  bkSound.start(); c.currentTime += 1;
  const vg = bkSound.graph!.verb.gain as unknown as FParam;
  const n = vg.ev.length;
  now += 1000; bkSound.update(IN({ tunnel: true }));
  now += 1000; c.currentTime += 1; bkSound.update(IN({ tunnel: false }));
  const ev = vg.ev.slice(n);
  assert.ok(ev.length >= 2 && ev.every((e) => e.kind === 'target'), JSON.stringify(ev));
  assert.ok(Math.abs(ev[0].v - S.verb.gain) < 1e-9 && ev[ev.length - 1].v === 0);
  bkSound.stop();
});

test('không gain đích nào của các lớp vượt maxGain, kể cả đầu vào cực đại; xe gần: 3 giọng, pan theo phía', () => {
  const c = fresh();
  bkSound.start(); c.currentTime += 1;
  const near = [{ x: 0, y: 0, z: -5, yaw: 0, hl: 2, hw: 1 }, { x: 0, y: 0, z: 5, yaw: 0, hl: 2, hw: 1 }, { x: 0.1, y: 0, z: 0, yaw: 0, hl: 2, hw: 1 }, { x: 30, y: 0, z: 0, yaw: 0, hl: 2, hw: 1 }];
  bkSound.horn(true);
  for (let k = 0; k < 20; k++) {
    now += 1000; c.currentTime += 0.1;
    bkSound.update(IN({ v: 60, rpm: 12000, throttle: 1, brakeK: 1, sus: k % 2 ? 1 : 0, sig: 1, rain: 1, river: 1, view: 1, near, nNear: 4, t: k * 0.1 }));
  }
  const g = bkSound.graph!;
  assert.ok(g.layers.length >= 14, `số lớp ${g.layers.length}`);
  for (const l of g.layers) for (const e of (l.gain as unknown as FParam).ev) if (e.kind !== 'cancel') assert.ok(e.v <= S.maxGain + 1e-9, `gain ${e.v} > ${S.maxGain}`);
  assert.equal(g.pans.length, 3);
  /* yaw = 0 mũi +X: −Z là bên trái ⇒ pan âm; +Z bên phải ⇒ pan dương */
  const pans = g.pans.map((p) => { const ev = (p.pan as unknown as FParam).ev; return ev[ev.length - 1].v; }).sort((a, b) => a - b);
  assert.ok(pans[0] < -0.5 && pans[2] > 0.5, String(pans));
  bkSound.horn(false); bkSound.stop();
});

test('xi nhan: tiếng tích theo nhịp sigHz (cả lúc sáng lẫn lúc tắt), lên lịch trước bằng thời gian ngữ cảnh; tắt xi nhan thì thôi', () => {
  const c = fresh();
  bkSound.start(); c.currentTime += 1;
  const tk = bkSound.graph!.tick.gain as unknown as FParam;
  const n0 = tk.ev.length, half = 1 / (2 * CONFIG.bike.model.sigHz);
  for (let k = 0; k < 40; k++) { now += S.updateMs; c.currentTime += S.updateMs / 1000; bkSound.update(IN({ sig: -1, t: 5 + k * S.updateMs / 1000 })); }
  const starts = tk.ev.slice(n0).filter((e) => e.kind === 'set').map((e) => e.t);
  const span = 40 * S.updateMs / 1000;
  assert.ok(Math.abs(starts.length - Math.round(span / half)) <= 2, `${starts.length} tiếng tích trong ${span} s`);
  for (let i = 1; i < starts.length; i++) assert.ok(Math.abs(starts[i] - starts[i - 1] - half) < 1e-6, 'cách đều nửa chu kỳ');
  const n1 = tk.ev.length;
  for (let k = 0; k < 10; k++) { now += S.updateMs; c.currentTime += 0.06; bkSound.update(IN({ sig: 0, t: 8 + k * 0.06 })); }
  assert.equal(tk.ev.length, n1, 'tắt xi nhan: không thêm tiếng tích');
  bkSound.stop();
});

test('giảm xóc: tiếng cụp khi vượt 70 % hành trình, tối đa thump.maxHz lần mỗi giây', () => {
  const c = fresh();
  bkSound.start(); c.currentTime += 1;
  const th = bkSound.graph!.thump.gain as unknown as FParam;
  const n0 = th.ev.length, hi = 0.8 * CONFIG.bike.sus.travel, lo = 0.2 * CONFIG.bike.sus.travel;
  for (let k = 0; k < 40; k++) { now += S.updateMs; c.currentTime += 0.05; bkSound.update(IN({ sus: k % 2 ? hi : -lo })); }   // 20 lần vượt trong 2 s
  const hits = th.ev.slice(n0).filter((e) => e.kind === 'set').length;
  assert.ok(hits >= 1 && hits <= Math.ceil(2 * S.thump.maxHz) + 1, `${hits} tiếng cụp trong 2 s`);
  bkSound.stop();
});

test('đi cổng riêng khi bật bằng nút (toggle) mà chưa bật âm thanh chung; thả cổng khi ngắt', () => {
  const c = fresh(false);
  bkSound.start();
  assert.equal(bkSound.nodes(), 0);
  assert.equal(bkSound.toggle(), true);
  assert.ok(bkSound.nodes() > 0 && extCalls[0] === true, 'bấm 🔊 ⇒ dựng qua extPort');
  bkSound.stop();
  bkSound.start();   // ngắt bản đang tắt dần, dựng lại qua cổng riêng (lựa chọn giữ trong trang)
  assert.ok(bkSound.nodes() > 0);
  assert.equal(bkSound.toggle(), false);
  assert.equal(bkSound.nodes(), 0);
  void c;
  bkSound.stop();
});

test('bộ đệm nhiễu tạo một lần (tất định), dùng lại ở lần dựng sau', () => {
  const c = fresh();
  bkSound.start();
  if (!bkSound.on) bkSound.toggle();   // lần trước đã tắt bằng nút: lựa chọn giữ trong trang
  bkSound.stop(); bkSound.start();
  assert.ok(srcs(c).length > 0);
  const bufs = new Set(srcs(c).filter((s) => s.kind === 'buffer').map((s) => s.buffer));
  assert.equal(bufs.size, 2, 'hai bộ đệm (trắng, nâu) cho mọi lần dựng trong cùng ngữ cảnh');
  bkSound.stop();
});

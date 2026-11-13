/* ===== Người treo dù: phản ứng tư thế (src/explore/pilot/react.ts) ===== */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CONFIG } from '../../src/config.ts';
import { PlReact, plSignals, type PlPose, type PlSignals, type PlTrack } from '../../src/explore/pilot/react.ts';

const P = CONFIG.explore.pilot, FIELDS = ['swingRoll', 'swingPitch', 'swingYaw', 'spineRoll', 'spinePitch', 'spineTwist', 'headYaw', 'headRoll', 'legSide', 'legFore', 'kneeL', 'kneeR', 'legSplit', 'brakeL', 'brakeR', 'packRoll', 'packPitch', 'strap'] as const;
const sig = (turn = 0, acc = 0, vy = 0, wind = 0): PlSignals => ({ turn, acc, vy, wind });
const run = (r: PlReact, s: PlSignals, sec: number, dt = 1 / 60) => { for (let i = 0; i < Math.round(sec / dt); i++) r.step(s, dt); };
const near = (a: number, b: number, e: number) => assert.ok(Math.abs(a - b) <= e, `${a} ≠ ${b}`);

test('đứng yên 20 s, không gió, không nhiễu: mọi góc ≈ 0, phanh = base', () => {
  const r = new PlReact(1, { gust: 0 }); run(r, sig(), 20);
  for (const k of ['swingRoll', 'swingPitch', 'swingYaw', 'spineRoll', 'spinePitch', 'spineTwist', 'headYaw', 'headRoll', 'legSide', 'legFore', 'kneeL', 'kneeR', 'legSplit'] as const) assert.ok(Math.abs(r.pose[k]) < 1e-3, k);
  near(r.pose.brakeL, P.brake.base, 0.01); near(r.pose.brakeR, P.brake.base, 0.01);
});

test('rẽ trái (turn = +1) giữ 6 s: thân văng ra ngoài, cột sống nghiêng vào, đầu và phanh trái theo; đổi dấu thì đảo', () => {
  const r = new PlReact(1, { gust: 0 }); run(r, sig(1), 6);
  const p = r.pose;
  assert.ok(p.swingRoll * p.spineRoll < 0, 'swingRoll và spineRoll trái dấu');
  assert.ok(p.spineRoll > 0 && p.swingRoll < 0);
  assert.ok(p.brakeL > p.brakeR + 0.4);
  assert.ok(p.headYaw > 0.1);
  assert.ok(p.spineTwist > 0);
  const q = new PlReact(1, { gust: 0 }); run(q, sig(-1), 6);
  for (const k of ['swingRoll', 'spineRoll', 'headYaw', 'spineTwist', 'legSide'] as const) near(q.pose[k], -p[k], 1e-9);
  assert.ok(q.pose.brakeR > q.pose.brakeL + 0.4);
  near(q.pose.brakeR, p.brakeL, 1e-9);
});

test('giảm tốc (acc = −1) kéo cả hai phanh và gập gối; tăng tốc thì nhả', () => {
  const r = new PlReact(1, { gust: 0 }); run(r, sig(0, -1), 3);
  assert.ok(r.pose.brakeL > P.brake.base + 0.3 && r.pose.brakeR > P.brake.base + 0.3);
  assert.ok(r.pose.kneeL > 0 && r.pose.kneeR > 0);
  assert.ok(r.pose.swingPitch > 0, 'hãm: người đưa ra trước');
  const q = new PlReact(1, { gust: 0 }); run(q, sig(0, 1), 3);
  assert.ok(q.pose.brakeL < P.brake.base && q.pose.brakeR < P.brake.base);
  assert.ok(q.pose.swingPitch < 0, 'tăng tốc: người tụt ra sau');
});

test('bước nhảy turn 0 → 1: swingRoll vọt lố, spineRoll không quá 10 %', () => {
  const r = new PlReact(1, { gust: 0 }); let sw = 0, sp = 0;
  for (let i = 0; i < 60 * 12; i++) { r.step(sig(1), 1 / 60); sw = Math.max(sw, Math.abs(r.pose.swingRoll)); sp = Math.max(sp, Math.abs(r.pose.spineRoll)); }
  assert.ok(sw > Math.abs(r.pose.swingRoll) * 1.05, `đỉnh ${sw} so với ổn định ${r.pose.swingRoll}`);
  assert.ok(sp <= Math.abs(r.pose.spineRoll) * 1.1, `đỉnh ${sp} so với ổn định ${r.pose.spineRoll}`);
});

test('độc lập tốc độ khung: 600 × 1/60 so với 200 × 1/20', () => {
  const f = (t: number) => sig(Math.sin(t * 0.9), Math.cos(t * 1.3), Math.sin(t * 0.5), 0.5);
  const a = new PlReact(3), b = new PlReact(3);
  for (let i = 0; i < 600; i++) a.step(f(i / 60), 1 / 60);
  for (let i = 0; i < 200; i++) b.step(f(i / 20), 1 / 20);
  for (const k of FIELDS) assert.ok(Math.abs(a.pose[k] - b.pose[k]) < 0.02, `${k}: ${a.pose[k]} so với ${b.pose[k]}`);
});

test('đầu vào xấu: mọi trường hữu hạn, trong giới hạn, phanh ∈ [0, 1]', () => {
  const L = P.limits, bad = [0, -1, NaN, 30, Infinity], big = [1e6, -1e6, NaN, Infinity];
  const r = new PlReact(2);
  for (const dt of bad) for (const v of big) { r.step(sig(v, -v, v, v), dt); r.step(sig(v, v, -v, 1e6), 1 / 60); }
  const p = r.pose;
  for (const k of FIELDS) assert.ok(Number.isFinite(p[k]), k);
  for (const k of ['swingRoll', 'swingPitch', 'swingYaw'] as const) assert.ok(Math.abs(p[k]) <= L.swing + 1e-9, k);
  for (const k of ['spineRoll', 'spinePitch', 'spineTwist'] as const) assert.ok(Math.abs(p[k]) <= L.spine + 1e-9, k);
  for (const k of ['headYaw', 'headRoll'] as const) assert.ok(Math.abs(p[k]) <= L.head + 1e-9, k);
  for (const k of ['legSide', 'legFore', 'legSplit'] as const) assert.ok(Math.abs(p[k]) <= L.leg + 1e-9, k);
  for (const k of ['kneeL', 'kneeR'] as const) assert.ok(p[k] >= L.knee[0] && p[k] <= L.knee[1], k);
  for (const k of ['brakeL', 'brakeR'] as const) assert.ok(p[k] >= 0 && p[k] <= 1, k);
  for (const k of ['packRoll', 'packPitch'] as const) assert.ok(Math.abs(p[k]) <= L.pack + 1e-9, k);
  assert.ok(Math.abs(p.strap) <= L.strap + 1e-9, 'strap');
});

test('plSignals: khung đầu bằng 0; tăng tốc 30 m/s² cho acc ≈ 1; nhảy 500 m vẫn trong [−1, 1]; turnInput trộn về phía nó', () => {
  const o = sig(), tr: PlTrack = { x: 0, y: 0, z: 0, speed: 0, has: false };
  plSignals(o, tr, 100, 50, 0, 0, 1 / 60, 0);
  assert.equal(o.acc, 0); assert.equal(o.vy, 0); assert.equal(tr.has, true);
  let x = 100, v = 20;
  for (let i = 0; i < 120; i++) { v += CONFIG.explore.speedAccel / 60; x += v / 60; plSignals(o, tr, x, 50, 0, 0, 1 / 60, 0); }
  near(o.acc, 1, 0.05);
  plSignals(o, tr, x + 500, 50 + 500, 0, 0, 1 / 60, 0);
  for (const k of ['acc', 'vy', 'turn'] as const) assert.ok(o[k] >= -1 && o[k] <= 1, k);
  plSignals(o, tr, x + 500, 50 + 500, 0, 0, 1 / 60, 0);
  assert.ok(Math.abs(o.acc) <= 1);
  /* lên: vy = climbRate / climbRate */
  const t2: PlTrack = { x: 0, y: 0, z: 0, speed: 0, has: false };
  for (let i = 0; i < 120; i++) plSignals(o, t2, i * 0.3, i * CONFIG.explore.climbRate / 60, 0, 0, 1 / 60, 0);
  near(o.vy, 1, 0.05);
  /* turn = bank / bankMax, trộn nửa đường tới turnInput */
  const t3: PlTrack = { x: 0, y: 0, z: 0, speed: 0, has: false };
  plSignals(o, t3, 0, 0, 0, CONFIG.explore.bankMax, 1 / 60, 0); near(o.turn, 1, 1e-9);
  plSignals(o, t3, 0, 0, 0, 0, 1 / 60, 0); near(o.turn, 0, 1e-9);
  plSignals(o, t3, 0, 0, 0, 0, 1 / 60, 0, 1); near(o.turn, 0.5, 1e-9);
  plSignals(o, t3, 0, 0, 0, CONFIG.explore.bankMax, 1 / 60, 2, -1); near(o.turn, 0, 1e-9); assert.equal(o.wind, 1);
  plSignals(o, t3, NaN, 0, 0, NaN, 1 / 60, NaN); assert.ok(Object.values(o).every(Number.isFinite));
});

test('gió: wind = 1 làm phương sai swingRoll ≥ 2 lần wind = 0; hai seed cho chuỗi khác nhau', () => {
  const vari = (wind: number, seed = 1) => { const r = new PlReact(seed), xs: number[] = []; for (let i = 0; i < 60 * 60; i++) { r.step(sig(0, 0, 0, wind), 1 / 60); if (i > 600) xs.push(r.pose.swingRoll); } const m = xs.reduce((s, v) => s + v, 0) / xs.length; return xs.reduce((s, v) => s + (v - m) ** 2, 0) / xs.length; };
  assert.ok(vari(1) >= 2 * vari(0), `${vari(1)} so với ${vari(0)}`);
  const a = new PlReact(1), b = new PlReact(2); run(a, sig(0, 0, 0, 1), 10); run(b, sig(0, 0, 0, 1), 10);
  assert.ok(Math.abs(a.pose.swingRoll - b.pose.swingRoll) + Math.abs(a.pose.swingPitch - b.pose.swingPitch) > 1e-4);
});

test('reset đưa về tư thế nghỉ', () => {
  const r = new PlReact(1, { gust: 0 }); run(r, sig(1, -1), 2); r.reset();
  const p: PlPose = r.pose; assert.equal(p.swingRoll, 0); near(p.brakeL, P.brake.base, 1e-12);
});

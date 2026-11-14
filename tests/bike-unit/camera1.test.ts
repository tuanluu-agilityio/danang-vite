/* ===== Xe máy: camera góc thứ nhất + trộn thứ nhất ↔ thứ ba (src/explore/bike/camera.ts) =====
   Mắt cao hơn mặt đường đúng tầm người ngồi trên yên mô hình này, cuộn theo 60 % độ nghiêng có lò xo, nhún / dồn tắt hẳn khi motion = 0,
   dồn ≤ surgeMax khi phanh gấp, khung dài không văng, đổi góc nhìn trộn đơn điệu trong mixS, kéo nhìn quanh bị kẹp và tự về, fov / near theo trộn. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { CONFIG } from '../../src/config.ts';
import { drMakeNet, type DrPad } from '../../src/explore/drive/net.ts';
import { bkCamCreate, bkCamEye, bkCamStep, bkCamPlace, bkCamDrag, bkCamSetEye, bkCamHideHead } from '../../src/explore/bike/camera.ts';
import type { BkState } from '../../src/explore/bike/motion.ts';

const C1 = CONFIG.bike.cam1, K3 = CONFIG.bike.cam3, CVT = CONFIG.bike.cvt, DT = 1 / 60;
const flatPad = (x0: number, x1: number, z0: number, z1: number, y = 2.6): DrPad => ({ id: 'a', kind: 'road', x0, x1, z0, z1, y: () => y });
const state = (o: Partial<BkState> = {}): BkState => ({ x: 5, y: 2.6, z: -3, yaw: 0.7, pitch: 0, v: 0, steer: 0, wheel: 0, braking: false, evac: 0, slide: 1, touch: 0,
  lean: 0, leanV: 0, susF: 0, susFV: 0, susR: 0, susRV: 0, rpm: CVT.idle, throttle: 0, brakeK: 0, acc: 0, sig: 0, sigYaw: 0, sigT: 0, stuck: 0, ...o });
const eye = () => ({ x: 0, y: 0, z: 0, yaw: 0, pitch: 0, roll: 0 });
const net = () => drMakeNet([flatPad(-100, 100, -100, 100)], []);

test('xe thẳng đứng: mắt cao hơn mặt đường 1,55–1,80 m (yên 0,85 m của mô hình), ở trên xe, hướng theo xe', () => {
  bkCamSetEye(null);
  const s = state(), c = bkCamCreate(), o = eye();
  bkCamEye(s, c, o);
  assert.ok(o.y - s.y >= 1.55 && o.y - s.y <= 1.8, `cao ${o.y - s.y}`);
  assert.ok(Math.hypot(o.x - s.x, o.z - s.z) < CONFIG.bike.body.length / 2, 'trên thân xe (điểm nhìn lùi sau mắt cam1.back)');
  assert.ok(Math.abs(o.yaw - s.yaw) < 1e-9 && Math.abs(o.roll) < 1e-9);
  /* mắt đặt theo người lái (bkCamSetEye) thì dùng số đó (điểm nhìn lùi thêm cam1.back) */
  bkCamSetEye({ fore: -0.3, up: 1.65 });
  bkCamEye(state({ yaw: 0 }), c, o);
  assert.ok(Math.abs(o.x - 5 + 0.3 + C1.back) < 1e-9 && Math.abs(o.y - 2.6 - 1.65) < 1e-9 && Math.abs(o.z + 3) < 1e-9, `${o.x}, ${o.y}, ${o.z}`);
  bkCamSetEye(null);
});

test('lean = 0,5 giữ 2 s ⇒ roll ≈ 0,3 (60 %); mắt dời sang trái khi nghiêng trái', () => {
  const s = state({ lean: 0.5, v: 10 }), c = bkCamCreate();
  for (let i = 0; i < 120; i++) bkCamStep(c, s, DT, 1);
  assert.ok(Math.abs(c.roll - 0.5 * C1.rollK) <= 0.03, `roll ${c.roll}`);
  const o = eye(), up = eye();
  bkCamEye(s, c, o); bkCamEye(state({ v: 10 }), c, up);
  const left = { x: -Math.sin(s.yaw), z: -Math.cos(s.yaw) };   // −Z cục bộ của xe
  assert.ok((o.x - up.x) * left.x + (o.z - up.z) * left.z > 0.5, 'mắt sang trái');
  assert.ok(o.y < up.y, 'mắt thấp xuống');
});

test('motion = 0 ⇒ bob = surge = 0, roll vẫn có', () => {
  const s = state({ lean: 0.3, v: 20, acc: -6, susF: 0.03, susR: -0.01 }), c = bkCamCreate();
  for (let i = 0; i < 120; i++) { s.susF = 0.02 * Math.sin(i * 0.7); s.susR = 0.02 * Math.cos(i * 0.9); bkCamStep(c, s, DT, 0); }
  assert.equal(c.bob, 0); assert.equal(c.surge, 0);
  assert.ok(c.roll > 0.1, `roll ${c.roll}`);
});

test('phanh gấp ⇒ dồn trước, |surge| ≤ surgeMax; tăng tốc ⇒ lùi; nhún ≤ bobMax', () => {
  const s = state({ v: 20, acc: -CONFIG.bike.perf.hardBrake * 1.5 }), c = bkCamCreate();
  let mx = 0;
  for (let i = 0; i < 180; i++) { bkCamStep(c, s, DT, 1); mx = Math.max(mx, Math.abs(c.surge)); }
  assert.ok(mx <= C1.surgeMax + 1e-12, `surge ${mx}`);
  assert.ok(c.surge > 0.02, `dồn trước ${c.surge}`);
  s.acc = 3;
  for (let i = 0; i < 180; i++) bkCamStep(c, s, DT, 1);
  assert.ok(c.surge < 0, `lùi ${c.surge}`);
  for (let i = 0; i < 300; i++) { s.susF = (i % 2 ? 1 : -1) * 0.06; s.susR = -s.susF; bkCamStep(c, s, DT, 1); assert.ok(Math.abs(c.bob) <= C1.bobMax + 1e-12, `bob ${c.bob}`); }
  s.susF = 0.06; s.susR = 0.06;
  for (let i = 0; i < 60; i++) { bkCamStep(c, s, DT, 1); assert.ok(Math.abs(c.bob) <= C1.bobMax + 1e-12, `bob ${c.bob}`); }
});

test('dt = 5, NaN ⇒ hữu hạn, trong biên', () => {
  const s = state({ lean: 0.6, v: 25, acc: -12, susF: 0.06, susR: 0.06 }), c = bkCamCreate();
  bkCamStep(c, s, 5, 1);
  bkCamStep(c, s, NaN, 1);
  s.lean = NaN; s.acc = NaN; s.susF = NaN;
  bkCamStep(c, s, 5, 1);
  for (const k of ['roll', 'rollV', 'bob', 'bobV', 'surge', 'surgeV', 'mix', 'yaw', 'pitch'] as const) assert.ok(Number.isFinite(c[k]), `${k} ${c[k]}`);
  assert.ok(Math.abs(c.roll) <= CONFIG.bike.perf.leanMax && Math.abs(c.bob) <= C1.bobMax && Math.abs(c.surge) <= C1.surgeMax);
  const o = eye(); bkCamEye(state(), c, o);
  for (const v of Object.values(o)) assert.ok(Number.isFinite(v));
});

test('đổi view ⇒ mix 0 → 1 trong mixS ± 1 khung, đơn điệu; về lại 1 → 0', () => {
  const s = state(), c = bkCamCreate();
  assert.equal(c.view, 1); assert.equal(c.mix, 0);
  c.view = 3;
  let prev = 0, n = 0;
  while (c.mix < 1 && n < 200) { bkCamStep(c, s, DT, 1); assert.ok(c.mix >= prev, 'đơn điệu'); prev = c.mix; n++; }
  assert.ok(Math.abs(n - C1.mixS / DT) <= 1, `${n} khung`);
  c.view = 1; n = 0;
  while (c.mix > 0 && n < 200) { bkCamStep(c, s, DT, 1); assert.ok(c.mix <= prev, 'đơn điệu'); prev = c.mix; n++; }
  assert.ok(Math.abs(n - C1.mixS / DT) <= 1, `${n} khung`);
});

test('kéo nhìn quanh: kẹp yawMax / pitchMin..pitchMax; thôi kéo returnAfter thì về 0', () => {
  const s = state(), c = bkCamCreate();
  bkCamDrag(c, -1e6, 0); assert.equal(c.yaw, C1.yawMax);
  bkCamDrag(c, 2e6, 0); assert.equal(c.yaw, -C1.yawMax);
  bkCamDrag(c, 0, 1e6); assert.equal(c.pitch, C1.pitchMin);
  bkCamDrag(c, 0, -1e6); assert.equal(c.pitch, C1.pitchMax);
  bkCamDrag(c, 300, 0);
  const y0 = c.yaw;
  assert.ok(y0 < 0, 'kéo sang phải ⇒ nhìn sang phải (yaw giảm)');
  for (let t = 0; t < C1.returnAfter - 0.05; t += DT) bkCamStep(c, s, DT, 1);
  assert.equal(c.yaw, y0, 'chưa tới returnAfter thì giữ');
  for (let t = 0; t < 2; t += DT) bkCamStep(c, s, DT, 1);
  assert.ok(Math.abs(c.yaw) < 0.01 * Math.abs(y0) + 1e-3 && Math.abs(c.pitch) < 0.01, `yaw ${c.yaw}, pitch ${c.pitch}`);
  /* góc thứ ba: kéo không đổi góc nhìn quanh của góc thứ nhất */
  const yb = c.yaw, pb = c.pitch;
  c.view = 3; bkCamDrag(c, 500, 200); assert.equal(c.yaw, yb); assert.equal(c.pitch, pb);
});

test('bkCamPlace: góc thứ nhất đặt camera ở mắt, fov / near của cam1; góc thứ ba fov / near của cam3; báo đổi một lần', () => {
  bkCamSetEye(null);
  const cam = new THREE.PerspectiveCamera(50, 1.6, 0.5, 30000), n = net(), s = state({ yaw: 0 }), c = bkCamCreate(), o = eye();
  assert.equal(bkCamPlace(cam, s, c, n, 0, true), true);
  assert.equal(cam.fov, C1.fov); assert.equal(cam.near, C1.near);
  assert.equal(bkCamPlace(cam, s, c, n, DT), false, 'không đổi thì không báo');
  bkCamEye(s, c, o);
  assert.ok(cam.position.distanceTo(new THREE.Vector3(o.x, o.y, o.z)) < 1e-9);
  const d = new THREE.Vector3(); cam.getWorldDirection(d);
  assert.ok(d.x > 0.8 && d.y < 0, `nhìn về mũi xe, cúi xuống (cam1.tilt) ${d.x}, ${d.y}`);
  c.view = 3;
  let changed = 0;
  for (let i = 0; i < 40; i++) { bkCamStep(c, s, DT, 1); if (bkCamPlace(cam, s, c, n, DT)) changed++; }
  assert.ok(changed >= 20, 'fov / near đổi trong lúc trộn');
  assert.equal(cam.fov, K3.fov); assert.equal(cam.near, K3.near);
  assert.ok(Math.abs(Math.hypot(cam.position.x - s.x, cam.position.z - s.z) - K3.dist) < 0.05, 'sau xe cam3.dist');
  assert.equal(bkCamPlace(cam, s, c, n, DT), false);
});

test('ẩn đầu theo mix đã làm mượt (smoothstep), không theo mix tuyến tính', () => {
  const c = bkCamCreate();
  c.mix = 0; assert.equal(bkCamHideHead(c), true);
  /* mix tuyến tính đã quá headMix nhưng vị trí camera (smoothstep) còn sát mắt ⇒ vẫn ẩn */
  const lin = C1.headMix * 1.3, sm = lin * lin * (3 - 2 * lin);
  assert.ok(sm < C1.headMix, 'giả thiết của ca thử');
  c.mix = lin; assert.equal(bkCamHideHead(c), true);
  c.mix = 0.5; assert.equal(bkCamHideHead(c), false);
  c.mix = 1; assert.equal(bkCamHideHead(c), false);
});

test('motion nhân cả chúi φ (vị trí + hướng nhìn) do giảm xóc; motion = 0 ⇒ mắt không theo giảm xóc', () => {
  bkCamSetEye(null);
  const flat = state({ yaw: 0, v: 10 }), dive = state({ yaw: 0, v: 10, susF: 0.05, susR: -0.02 });
  const look = (motion: number, s: BkState) => { const c = bkCamCreate(), o = eye(); bkCamStep(c, flat, DT, motion); bkCamEye(s, c, o); return o; };
  const a0 = look(0, flat), b0 = look(0, dive);
  for (const k of ['x', 'y', 'z', 'pitch'] as const) assert.ok(Math.abs(a0[k] - b0[k]) < 1e-12, `motion 0: ${k} ${a0[k]} / ${b0[k]}`);
  const a1 = look(1, flat), b1 = look(1, dive), a3 = look(0.3, flat), b3 = look(0.3, dive);
  const d1 = b1.pitch - a1.pitch, d3 = b3.pitch - a3.pitch;
  assert.ok(d1 < -1e-3, `chúi đầu khi phanh: ${d1}`);
  assert.ok(Math.abs(d3 - 0.3 * d1) < 1e-4 * Math.abs(d1) + 1e-9, `motion 0,3 ⇒ 30 %: ${d3} / ${d1}`);
});

test('độ lún giảm xóc chỉ vào mắt qua một đường (nhún bob, ≤ bobMax), không cộng thêm lún trực tiếp', () => {
  bkCamSetEye(null);
  const rest = state({ yaw: 0 }), sunk = state({ yaw: 0, susF: 0.05, susR: 0.05 }), c = bkCamCreate();
  for (let i = 0; i < 240; i++) bkCamStep(c, sunk, DT, 1);
  const o = eye(), r = eye(), c0 = bkCamCreate();
  bkCamEye(sunk, c, o); bkCamEye(rest, c0, r);
  assert.ok(Math.abs(o.y - r.y - c.bob) < 1e-9, `chỉ bob: ${o.y - r.y} so với bob ${c.bob}`);
  assert.ok(o.y - r.y < 0 && o.y - r.y >= -C1.bobMax - 1e-12, `lún ${o.y - r.y}`);
});

/* ===== Xe máy: đêm + mưa (src/explore/bike/fx.ts) =====
   Bám đường theo độ ướt (khô trong hầm kín), gió giật cộng vào steer (≤ gust.steer, chỉ khi v > vBlend), vệt đèn pha chỉ khi đêm và bám mặt đường dốc,
   bụi nước chỉ khi mưa và v > vMin, ≤ max hạt, tất định (rng), stop() gỡ nhóm khỏi cảnh. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { CONFIG } from '../../src/config.ts';
import { drMakeNet, type DrPad } from '../../src/explore/drive/net.ts';
import { bkGrip, bkGustSteer, bkFx } from '../../src/explore/bike/fx.ts';
import type { BkState } from '../../src/explore/bike/motion.ts';

const FX = CONFIG.bike.fx, CVT = CONFIG.bike.cvt, DT = 1 / 60;
const state = (o: Partial<BkState> = {}): BkState => ({ x: 0, y: 2.6, z: 0, yaw: 0, pitch: 0, v: 0, steer: 0, wheel: 0, braking: false, evac: 0, slide: 1, touch: 0,
  lean: 0, leanV: 0, susF: 0, susFV: 0, susR: 0, susRV: 0, rpm: CVT.idle, throttle: 0, brakeK: 0, acc: 0, sig: 0, sigYaw: 0, sigT: 0, stuck: 0, ...o });
const beamMesh = () => bkFx.group.getObjectByName('bike-beam') as THREE.Mesh;
const sprayPts = () => bkFx.group.getObjectByName('bike-spray') as THREE.Points;

test('bkGrip: khô 1, ướt hẳn 0, trong hầm kín luôn 1; kẹp và NaN', () => {
  assert.equal(bkGrip(0, false), 1);
  assert.equal(bkGrip(1, false), 0);
  assert.equal(bkGrip(1, true), 1);
  assert.ok(Math.abs(bkGrip(0.4, false) - 0.6) < 1e-12);
  assert.equal(bkGrip(2, false), 0); assert.equal(bkGrip(-1, false), 1); assert.equal(bkGrip(NaN, false), 1);
});

test('bkGustSteer: 0 khi lặng / chậm; ≤ gust.steer; dấu theo phía gió đẩy', () => {
  const P = CONFIG.bike.perf;
  /* yaw 0: mũi +X, bên trái −Z. Gió thổi về −Z (uWindDir = (0, −1)) ⇒ đẩy sang trái ⇒ steer > 0 */
  assert.equal(bkGustSteer(20, 0, 0, -1, 0), 0, 'không giật');
  assert.equal(bkGustSteer(P.vBlend, 10, 0, -1, 0), 0, 'không quá vBlend');
  assert.equal(bkGustSteer(2, 10, 0, -1, 0), 0, 'chậm');
  const left = bkGustSteer(20, 10, 0, -1, 0), right = bkGustSteer(20, 10, 0, 1, 0), head = bkGustSteer(20, 10, 1, 0, 0);
  assert.ok(left > 0 && Math.abs(left - FX.gust.steer) < 1e-9, `trái ${left}`);
  assert.ok(right < 0 && Math.abs(right + FX.gust.steer) < 1e-9, `phải ${right}`);
  assert.ok(Math.abs(head) < 1e-9, 'gió dọc thân không đẩy ngang');
  for (const g of [0, 3, 10, 50, NaN]) for (const a of [0, 1, 2, 3, 4, 5, 6]) {
    const k = bkGustSteer(25, g, Math.cos(a), Math.sin(a), 0.3);
    assert.ok(Number.isFinite(k) && Math.abs(k) <= FX.gust.steer + 1e-12, `${g} ${a} ${k}`);
  }
});

test('vệt pha: night = 0 ⇒ không vẽ; night = 1 ⇒ vẽ, lớp 1, không ghi depth, polygonOffset; ướt thì sáng + dài hơn', () => {
  bkFx.start();
  const s = state({ v: 10 });
  bkFx.update(s, 0, 0, DT, 0);
  assert.equal(bkFx.drawn().beam, false);
  bkFx.update(s, FX.beam.nightMin, 0, DT, 0);
  assert.equal(bkFx.drawn().beam, false, 'đúng ngưỡng thì chưa vẽ');
  bkFx.update(s, 1, 0, DT, 0);
  assert.equal(bkFx.drawn().beam, true);
  const m = beamMesh(), mat = m.material as THREE.MeshBasicMaterial;
  assert.ok(m.visible && m.layers.mask === 2, 'lớp 1 duy nhất');
  assert.equal(mat.depthWrite, false); assert.equal(mat.polygonOffset, true); assert.equal(mat.blending, THREE.AdditiveBlending); assert.equal(mat.fog, false);
  const dry = mat.opacity, pos = m.geometry.getAttribute('position') as THREE.BufferAttribute;
  const far = () => { let mx = 0; for (let i = 0; i < pos.count; i++) mx = Math.max(mx, pos.getX(i)); return mx; };
  const dryFar = far();
  assert.ok(Math.abs(dryFar - (FX.beam.ahead + FX.beam.len)) < 1e-6, `đầu xa ${dryFar}`);
  bkFx.update(s, 1, 0, DT, 0, 1);
  assert.ok(mat.opacity > dry * 1.2, `ướt sáng hơn ${mat.opacity} / ${dry}`);
  assert.ok(far() > dryFar * 1.2, 'ướt dài hơn');
  bkFx.stop();
});

test('vệt pha bám mặt đường dốc (drGround), cao hơn mặt đường lift; không net thì theo pitch', () => {
  const slope = 0.06;
  const pad: DrPad = { id: 'r', kind: 'road', x0: -50, x1: 100, z0: -20, z1: 20, y: (x) => 2.6 + slope * x };
  const net = drMakeNet([pad], []);
  bkFx.start(net);
  bkFx.update(state({ v: 8 }), 1, 0, DT, 0);   // pitch 0 cố ý: cao độ phải lấy từ mặt đường, không từ pitch
  const pos = beamMesh().geometry.getAttribute('position') as THREE.BufferAttribute;
  for (let i = 0; i < pos.count; i++) {
    const g = 2.6 + slope * pos.getX(i);
    assert.ok(Math.abs(pos.getY(i) - g - FX.beam.lift) < 1e-6, `đỉnh ${i}: ${pos.getY(i)} so với ${g}`);
  }
  bkFx.stop();
  bkFx.start(null);
  bkFx.update(state({ v: 8, pitch: Math.atan(slope) }), 1, 0, DT, Math.atan(slope));
  for (let i = 0; i < pos.count; i++) assert.ok(Math.abs(pos.getY(i) - (2.6 + slope * pos.getX(i)) - FX.beam.lift) < 1e-6, 'theo pitch');
  bkFx.stop();
});

test('bụi nước: rain = 0 ⇒ 0; rain = 1, v = 15 ⇒ 0 < n ≤ max; v = 2 ⇒ 0; hạt hữu hạn, sau bánh', () => {
  bkFx.start();
  const s = state({ v: 15 });
  for (let i = 0; i < 60; i++) { s.x += s.v * DT; bkFx.update(s, 0, 0, DT, 0); }
  assert.equal(bkFx.drawn().spray, 0);
  assert.equal(sprayPts().visible, false, 'không hạt thì không vẽ');
  let mx = 0;
  for (let i = 0; i < 120; i++) { s.x += s.v * DT; bkFx.update(s, 0, 1, DT, 0); mx = Math.max(mx, bkFx.drawn().spray); assert.ok(bkFx.drawn().spray <= FX.spray.max); }
  const n = bkFx.drawn().spray;
  assert.ok(n > 0 && n <= FX.spray.max && mx <= FX.spray.max, `n ${n}`);
  const p = sprayPts(), pos = p.geometry.getAttribute('position') as THREE.BufferAttribute;
  assert.ok(p.visible && p.layers.mask === 2 && p.geometry.drawRange.count === n);
  const pm = p.material as THREE.PointsMaterial;   // sương mù đặt có chủ ý (hạt xa nhạt theo cảnh như mọi vật khác), không ghi độ sâu, trong suốt
  assert.equal(pm.fog, true); assert.equal(pm.depthWrite, false); assert.equal(pm.transparent, true); assert.ok(pm.opacity >= 0.6 && pm.size >= 0.25, 'đủ thấy (Task 9)');
  for (let i = 0; i < n; i++) {
    assert.ok(Number.isFinite(pos.getX(i)) && Number.isFinite(pos.getY(i)) && Number.isFinite(pos.getZ(i)));
    assert.ok(pos.getX(i) < s.x + CONFIG.bike.body.wheelbase / 2, `hạt ${i} sau trục trước: ${pos.getX(i)} / ${s.x}`);
    assert.ok(pos.getY(i) >= s.y - 1e-5, 'không dưới mặt đường');
  }
  /* chậm: hạt cũ hết đời, không sinh thêm */
  s.v = 2;
  for (let i = 0; i < 60; i++) bkFx.update(s, 0, 1, DT, 0);
  assert.equal(bkFx.drawn().spray, 0);
  bkFx.stop();
});

test('bụi nước tất định: hai lần chạy cùng đầu vào cho cùng vị trí hạt', () => {
  const run = (): number[] => {
    bkFx.start();
    const s = state({ v: 18, yaw: 0.4 });
    for (let i = 0; i < 50; i++) { s.x += Math.cos(s.yaw) * s.v * DT; s.z -= Math.sin(s.yaw) * s.v * DT; bkFx.update(s, 0.5, 0.8, DT, 0); }
    const pos = sprayPts().geometry.getAttribute('position') as THREE.BufferAttribute, out: number[] = [];
    for (let i = 0; i < bkFx.drawn().spray * 3; i++) out.push(pos.array[i]);
    bkFx.stop();
    return out;
  };
  const a = run(), b = run();
  assert.ok(a.length > 0);
  assert.deepEqual(a, b);
});

test('dt xấu (0, NaN, 5) không văng; stop() ⇒ nhóm không còn cha, không vẽ gì', () => {
  const scene = new THREE.Scene();
  scene.add(bkFx.group);
  bkFx.start();
  const s = state({ v: 15 });
  bkFx.update(s, 1, 1, 0, 0); bkFx.update(s, 1, 1, NaN, 0); bkFx.update(s, 1, 1, 5, 0);
  assert.ok(bkFx.drawn().spray <= FX.spray.max);
  const pos = sprayPts().geometry.getAttribute('position') as THREE.BufferAttribute;
  for (let i = 0; i < bkFx.drawn().spray * 3; i++) assert.ok(Number.isFinite(pos.array[i]));
  bkFx.stop();
  assert.equal(bkFx.group.parent, null);
  assert.deepEqual(bkFx.drawn(), { beam: false, spray: 0 });
});

/* ===== Xe máy: test chuyển động (src/explore/bike/motion.ts) =====
   Tăng tốc, vMax, ga làm mượt, nghiêng ổn định + tốc độ đổi hướng g · tan(lean) / v, nặng tay khi nhanh, mưa, đứng yên, chạy chậm,
   dắt lùi, phanh gấp, không phụ thuộc tần số khung, khung dài, vòng tua, giảm xóc, xi nhan, về làn, kẹt, thân va chạm.
   Net thử phẳng tự dựng, không cần cảnh; thân va chạm đặt BK_BODY suốt file. */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { CONFIG } from '../../src/config.ts';
import { drMakeNet, drGround, type DrPad, type DrSolid } from '../../src/explore/drive/net.ts';
import { drFits, drUseBody, DR_CAR_BODY } from '../../src/explore/drive/collide.ts';
import { bkStep, bkAccel, bkLeanMax, bkRpm, bkSignal, bkRecover, BK_BODY, type BkState, type BkInput } from '../../src/explore/bike/motion.ts';

const P = CONFIG.bike.perf, CVT = CONFIG.bike.cvt, SUS = CONFIG.bike.sus, HL = CONFIG.bike.body.length / 2;
const flatPad = (x0: number, x1: number, z0: number, z1: number, y = 2.6, id = 'a'): DrPad => ({ id, kind: 'road', x0, x1, z0, z1, y: () => y });
const state = (x: number, z: number, yaw = 0, v = 0, y = 2.6): BkState => ({ x, y, z, yaw, pitch: 0, v, steer: 0, wheel: 0, braking: false, evac: 0, slide: 1, touch: 0,
  lean: 0, leanV: 0, susF: 0, susFV: 0, susR: 0, susRV: 0, rpm: CVT.idle, throttle: 0, brakeK: 0, acc: 0, sig: 0, sigYaw: 0, sigT: 0, stuck: 0 });
const inp = (gas = 0, brake = 0, steer = 0, hard = false, grip = 1): BkInput => ({ gas, brake, steer, hard, grip });
const DT = 1 / 60;
const square = () => drMakeNet([flatPad(-200, 200, -200, 200)], []);   // net thử phẳng 400 × 400 m
const longNet = () => drMakeNet([flatPad(-100, 3000, -20, 20)], []);   // đường thẳng dài cho các ca chạy lâu

before(() => drUseBody(BK_BODY));
after(() => drUseBody(DR_CAR_BODY));

/* Thời điểm đầu tiên v ≥ target khi giữ ga hết cỡ từ đứng yên */
function timeTo(target: number, maxT: number): number {
  const net = longNet(), s = state(0, 0), g = inp(1);
  for (let t = 0; t < maxT;) { bkStep(s, g, net, [], 0, DT); t += DT; if (s.v >= target) return t; }
  return NaN;
}
/* Quãng dừng từ v0 với đầu vào g (tới lúc v ≤ 0 lần đầu) */
function stopDist(v0: number, g: BkInput): number {
  const net = longNet(), s = state(0, 0, 0, v0);
  for (let i = 0; i < 60 * 20 && s.v > 0; i++) bkStep(s, g, net, [], 0, DT);
  assert.ok(s.v <= 0, 'đã dừng');
  return s.x;
}

test('0–50 km/h trong 4,6–5,6 s (gồm trễ ga)', () => {
  const t = timeTo(13.89, 10);
  assert.ok(t >= 4.6 && t <= 5.6, `t = ${t}`);
});

test('vMax: sau 60 s ga trong [24, 25] m/s', () => {
  const net = longNet(), s = state(0, 0);
  for (let i = 0; i < 60 * 60; i++) bkStep(s, inp(1), net, [], 0, DT);
  assert.ok(s.v <= 25 && s.v >= 24, `v = ${s.v}`);
  assert.ok(bkAccel(P.vMax) <= 1e-9 && bkAccel(0) > 0);
});

test('không đổi tốc độ tức thời', () => {
  const net = longNet(), s = state(0, 0);
  bkStep(s, inp(1), net, [], 0, DT);
  assert.ok(s.v > 0 && s.v < 0.1, `v = ${s.v}`);
});

test('nghiêng ổn định ở 15 m/s và đổi hướng g · tan(lean) / v', () => {
  const net = square(), s = state(0, 0, 0, 15);
  for (let i = 0; i < 4 * 60; i++) { s.v = 15; bkStep(s, inp(0, 0, 1), net, [], 0, DT); }
  assert.ok(Math.abs(s.lean - bkLeanMax(15, 1)) < 0.02, `lean = ${s.lean}, đích ${bkLeanMax(15, 1)}`);
  assert.ok(s.lean > 0, 'steer > 0 nghiêng trái');
  s.v = 15;
  const y0 = s.yaw, l0 = s.lean;
  bkStep(s, inp(0, 0, 1), net, [], 0, DT);
  const rate = (s.yaw - y0) / DT, vm = (15 + s.v) / 2, want = CONFIG.bike.perf.latG * Math.tan((l0 + s.lean) / 2) / vm;
  assert.ok(Math.abs(rate - want) / want < 0.05, `đo ${rate}, lý thuyết ${want}`);
  assert.ok(rate > 0, 'rẽ trái: yaw tăng');
});

test('nặng tay khi nhanh: tới 63 % độ nghiêng đích chậm hơn ở 22 m/s so với 6 m/s', () => {
  const t63 = (v: number) => {
    const net = square(), s = state(0, 0, 0, v), goal = 0.63 * bkLeanMax(v, 1);
    let t = 0;
    while (s.lean < goal && t < 5) { s.v = v; bkStep(s, inp(0, 0, 1), net, [], 0, DT); t += DT; }
    return t;
  };
  const fast = t63(22), slow = t63(6);
  assert.ok(fast > slow, `22 m/s: ${fast} s, 6 m/s: ${slow} s`);
  assert.ok(fast < 5 && slow < 5);
});

test('mưa: nghiêng tối đa 27°, quãng phanh dài hơn ≥ 20 %', () => {
  assert.ok(Math.abs(bkLeanMax(15, 0) - 0.471) < 1e-3, `${bkLeanMax(15, 0)}`);
  const dry = stopDist(15, inp(0, 1, 0, false, 1)), wet = stopDist(15, inp(0, 1, 0, false, 0));
  assert.ok(wet >= 1.2 * dry, `khô ${dry} m, ướt ${wet} m`);
});

test('đứng yên: bẻ lái không xoay, không nghiêng', () => {
  const net = square(), s = state(10, 20, 0.7);
  for (let i = 0; i < 2 * 60; i++) bkStep(s, inp(0, 0, 1), net, [], 0, DT);
  assert.ok(Math.abs(s.x - 10) < 1e-6 && Math.abs(s.z - 20) < 1e-6 && Math.abs(s.yaw - 0.7) < 1e-6, `${s.x}, ${s.z}, ${s.yaw}`);
  assert.equal(s.lean, 0);
  assert.equal(s.v, 0);
});

test('tốc độ thấp 2 m/s: bán kính 2–3 m, nghiêng nhỏ', () => {
  const net = square(), s = state(0, 0);
  for (let i = 0; i < 3 * 60; i++) { s.v = 2; bkStep(s, inp(0, 0, 1), net, [], 0, DT); }
  const xs: number[] = [], zs: number[] = [], yaw0 = s.yaw;
  let leanMax = 0;
  while (s.yaw - yaw0 < 2 * Math.PI) {
    s.v = 2; bkStep(s, inp(0, 0, 1), net, [], 0, DT);
    xs.push(s.x); zs.push(s.z); leanMax = Math.max(leanMax, Math.abs(s.lean));
    assert.ok(xs.length < 60 * 30, 'quay hết vòng');
  }
  const mx = xs.reduce((a, b) => a + b) / xs.length, mz = zs.reduce((a, b) => a + b) / zs.length;
  const r = xs.reduce((a, x, i) => a + Math.hypot(x - mx, zs[i] - mz), 0) / xs.length;
  assert.ok(r >= 2.0 && r <= 3.0, `r = ${r}`);
  assert.ok(leanMax < 0.25, `lean = ${leanMax}`);
});

test('dắt lùi: giữ phanh lúc đứng thì lùi ≤ 1 m/s, nhả thì về 0', () => {
  const net = square(), s = state(0, 0);
  for (let i = 0; i < 3 * 60; i++) bkStep(s, inp(0, 1), net, [], 0, DT);
  assert.ok(s.v >= -1.0 && s.v <= -0.9, `v = ${s.v}`);
  assert.ok(s.x < 0, 'lùi về phía sau');
  for (let i = 0; i < 2 * 60; i++) bkStep(s, inp(), net, [], 0, DT);
  assert.equal(s.v, 0);
});

test('phanh gấp từ 20 m/s dừng trong < 25 m (khô)', () => {
  const d = stopDist(20, inp(0, 0, 0, true));
  assert.ok(d < 25, `d = ${d}`);
  assert.ok(d < stopDist(20, inp(0, 1)), 'ngắn hơn phanh thường');
});

test('không phụ thuộc tần số khung (30 Hz / 144 Hz)', () => {
  const run = (dt: number) => {
    const net = square(), s = state(0, 0, 0, 10), n = Math.round(5 / dt), nTurn = Math.round(2 / dt);
    for (let i = 0; i < n; i++) bkStep(s, i < nTurn ? inp(1, 0, 1) : inp(1, 0, -0.5), net, [], 0, dt);
    return s;
  };
  const a = run(1 / 30), b = run(1 / 144);
  assert.ok(Math.hypot(a.x - b.x, a.z - b.z) < 0.3, `lệch ${Math.hypot(a.x - b.x, a.z - b.z)} m`);
  assert.ok(Math.abs(a.lean - b.lean) < 0.02, `lean ${a.lean} / ${b.lean}`);
});

test('khung dài 5 s khi đang nghiêng ở 20 m/s', () => {
  const net = square(), s = state(0, 0, 0, 20);
  s.lean = 0.4; s.leanV = 0.5; s.throttle = 1;
  bkStep(s, inp(1, 0, 1), net, [], 0, 5);
  for (const [k, v] of Object.entries(s)) if (typeof v === 'number') assert.ok(Number.isFinite(v), `${k} = ${v}`);
  assert.ok(Math.abs(s.lean) <= P.leanMax, `lean = ${s.lean}`);
  assert.ok(Math.abs(s.susF) <= SUS.travel && Math.abs(s.susR) <= SUS.travel, `sus ${s.susF} / ${s.susR}`);
});

test('vòng tua hộp số vô cấp', () => {
  assert.equal(bkRpm(0, 0), CVT.idle);
  assert.equal(bkRpm(0, 0), 1700);
  const a = bkRpm(1, 1), b = bkRpm(10, 1);
  assert.ok(a >= 3000 && a <= 4500, `bkRpm(1, 1) = ${a}`);
  assert.ok(b >= 6000 && b <= 7000, `bkRpm(10, 1) = ${b}`);
  assert.ok(bkRpm(10, 0) < b);
  for (let v = CVT.engageV + 0.1; v + 0.5 <= P.vMax; v += 0.5) assert.ok(bkRpm(v + 0.5, 0) > bkRpm(v, 0), `v = ${v}`);
  /* trạng thái bám về đích */
  const net = longNet(), s = state(0, 0);
  for (let i = 0; i < 3 * 60; i++) bkStep(s, inp(1), net, [], 0, DT);
  assert.ok(Math.abs(s.rpm - bkRpm(s.v, s.throttle)) < 300, `rpm ${s.rpm}, đích ${bkRpm(s.v, s.throttle)}`);
});

test('giảm xóc: phanh mạnh chúi đầu, dừng rồi về 0 trong < 2 s', () => {
  const net = longNet(), s = state(0, 0, 0, 10);
  let peak = 0;
  for (let i = 0; i < 60 * 5 && s.v > 0; i++) { bkStep(s, inp(0, 1), net, [], 0, DT); peak = Math.max(peak, s.susF); }
  assert.equal(s.v, 0);
  assert.ok(peak > 0.01, `susF lớn nhất ${peak}`);
  for (let i = 0; i < 2 * 60; i++) bkStep(s, inp(), net, [], 0, DT);
  assert.ok(Math.abs(s.susF) < 0.002 && Math.abs(s.susR) < 0.002, `susF ${s.susF}, susR ${s.susR}`);
});

test('xi nhan tự tắt', () => {
  const net = square(), s = state(0, 0, 0, 8);
  bkSignal(s, 1);
  assert.equal(s.sig, 1);
  const yaw0 = s.yaw;
  for (let i = 0; i < 60 * 10 && s.yaw - yaw0 <= 0.6; i++) { s.v = 8; bkStep(s, inp(0, 0, 1), net, [], 0, DT); }
  assert.ok(s.yaw - yaw0 > 0.6);
  assert.equal(s.sig, 1, 'còn bẻ lái thì chưa tắt');
  for (let i = 0; i < 60; i++) { s.v = 8; bkStep(s, inp(0, 0, 0), net, [], 0, DT); }
  assert.equal(s.sig, 0, 'rẽ trái quá 0,6 rad rồi trả thẳng: tắt');
  bkSignal(s, 1); assert.equal(s.sig, 1);
  bkSignal(s, 1); assert.equal(s.sig, 0, 'bấm lại cùng hướng: tắt');
  const t = state(-150, 0, 0, 8), lnet = longNet();
  bkSignal(t, -1);
  for (let i = 0; i < 11 * 60; i++) { t.v = 8; bkStep(t, inp(), lnet, [], 0, DT); }
  assert.equal(t.sig, -1, 'chưa tới 12 s');
  for (let i = 0; i < 1.5 * 60; i++) { t.v = 8; bkStep(t, inp(), lnet, [], 0, DT); }
  assert.equal(t.sig, 0, 'đi thẳng quá 12 s: tắt');
});

test('về làn: tim làn bên phải, đứng yên, trên mặt đường', () => {
  /* đường dọc X: ô .S (z 1,5..10,5) đi Đông, ô .N (z −10,5..−1,5) đi Tây */
  const net = drMakeNet([flatPad(-200, 200, 1.5, 10.5, 2.6, 'r.0.S'), flatPad(-200, 200, -10.5, -1.5, 2.6, 'r.0.N')], []);
  const s = state(20, 8.25 - 3, Math.PI, 7);
  s.lean = 0.3; s.leanV = 1;
  assert.ok(bkRecover(s, net));
  assert.equal(s.v, 0); assert.equal(s.lean, 0);
  assert.ok(Number.isFinite(drGround(net, s.x, s.z, s.y)), 'trên mặt đường');
  assert.ok(Math.abs(s.z - 8.25) < 1e-9 && Math.abs(s.yaw) < 1e-9, `z = ${s.z}, yaw = ${s.yaw}`);
  assert.ok(drFits(net, s, [], 0, new Uint8Array(1)));
  /* nửa bên kia: đi Tây, làn ngoài */
  const n = state(-30, -4, 0, 3);
  assert.ok(bkRecover(n, net));
  assert.ok(Math.abs(n.z + 8.25) < 1e-9 && Math.abs(n.yaw - Math.PI) < 1e-9, `z = ${n.z}, yaw = ${n.yaw}`);
  /* không có ô nào */
  assert.equal(bkRecover(state(0, 0), drMakeNet([], [])), false);
});

test('kẹt: đâm tường giữ ga thì stuck tăng, rời tường thì về 0', () => {
  const wallS: DrSolid = { kind: 'rect', x0: 10, x1: 11, z0: -50, z1: 50, y0: 2.6, y1: 5 };
  const net = drMakeNet([flatPad(-100, 100, -50, 50)], [wallS]), s = state(10 - HL - 0.01, 0);
  for (let i = 0; i < 3.5 * 60; i++) bkStep(s, inp(1), net, [], 0, DT);
  assert.ok(s.stuck >= CONFIG.bike.stuckS, `stuck = ${s.stuck}`);
  assert.ok(s.x + HL <= 10 + 1e-6, 'không xuyên tường');
  for (let i = 0; i < 1.5 * 60; i++) bkStep(s, inp(0, 1), net, [], 0, DT);
  assert.ok(s.x + HL < 10 - 0.3, 'đã dắt lùi khỏi tường');
  assert.equal(s.stuck, 0);
});

test('thân va chạm: bkStep không tự đổi thân đang dùng', () => {
  const net = drMakeNet([flatPad(-50, 50, -20, 20)], [{ kind: 'rect', x0: 10, x1: 12, z0: -10, z1: -0.6, y0: 2.6, y1: 4 }, { kind: 'rect', x0: 10, x1: 12, z0: 0.6, z1: 10, y0: 2.6, y1: 4 }]);
  const s = state(0, 0, 0, 5);
  for (let i = 0; i < 2 * 60; i++) bkStep(s, inp(1), net, [], 0, DT);
  assert.ok(drFits(net, { x: 11, y: 2.6, z: 0, yaw: 0 }, [], 0, new Uint8Array(1)), 'vẫn là BK_BODY: lọt khe 1,2 m');
  assert.ok(s.x > 11, `xe máy chạy qua khe (x = ${s.x})`);
});

/* ===== Đi dạo: chọn và trộn đoạn chuyển động (src/explore/stroll/anim.ts) ===== */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CONFIG } from '../../src/config.ts';
import { stClipMix, stCharModel, ST_CLIPS, type StClipMix } from '../../src/explore/stroll/anim.ts';

const NAT = [0, 1.05, 3.0, 5.84, 0];
const [IDLE, WALK, JOG, SPRINT, PHOTO] = [0, 1, 2, 3, 4];
const out = (): StClipMix => ({ w: new Float32Array(5), rate: 0, loco: false });
const mix = (pose: number, v: number) => { const o = out(); stClipMix(pose, v, NAT, o); return o; };
const near = (a: number, b: number, e = 1e-3) => assert.ok(Math.abs(a - b) <= e, `${a} ≠ ${b}`);

test('thứ tự đoạn khớp tên trong file glb', () => {
  assert.deepEqual([...ST_CLIPS], ['idle', 'walk', 'jog', 'sprint', 'photo']);
});

test('đứng: idle = 1, không di chuyển', () => {
  const o = mix(0, 0); assert.equal(o.w[IDLE], 1); assert.equal(o.loco, false);
});

test('đi 1,0 m/s: walk, rate ≈ 0,952', () => {
  const o = mix(1, 1.0); assert.equal(o.w[WALK], 1); assert.equal(o.loco, true); near(o.rate, 1 / 1.05);
});

test('đi 3,5 m/s: jog, rate ≈ 1,167', () => {
  const o = mix(1, 3.5); assert.equal(o.w[JOG], 1); near(o.rate, 3.5 / 3.0);
});

test('chạy 10 m/s: sprint, rate kẹp 1,6', () => {
  const o = mix(2, 10); assert.equal(o.w[SPRINT], 1); assert.equal(o.rate, CONFIG.stroll.anim.rateMax); assert.equal(o.rate, 1.6);
});

test('chạy 5,25 m/s: jog 0,5 + sprint 0,5, rate ≈ 1,188', () => {
  const o = mix(2, 5.25); near(o.w[JOG], 0.5); near(o.w[SPRINT], 0.5); near(o.rate, 5.25 / 4.42);
});

test('đi 2,65 m/s: walk 0,5 + jog 0,5', () => {
  const o = mix(1, 2.65); near(o.w[WALK], 0.5); near(o.w[JOG], 0.5);
});

test('đi 0,05 m/s: walk, rate kẹp dưới 0,6', () => {
  const o = mix(1, 0.05); assert.equal(o.w[WALK], 1); assert.equal(o.rate, CONFIG.stroll.anim.rateMin); assert.equal(o.rate, 0.6);
});

test('chụp ảnh: photo = 1, không di chuyển', () => {
  const o = mix(4, 0); assert.equal(o.w[PHOTO], 1); assert.equal(o.loco, false);
});

test('rơi (dáng 3): không tốc độ ngang thì đứng; có tốc độ thì như chạy cùng tốc độ', () => {
  assert.equal(mix(3, 0).w[IDLE], 1);
  const a = mix(3, 6), b = mix(2, 6);
  assert.deepEqual([...a.w], [...b.w]); assert.equal(a.rate, b.rate); assert.equal(a.loco, true);
});

test('dáng lạ (khách bản cũ, số ngoài khoảng, NaN): đứng yên, không lỗi', () => {
  for (const pose of [7, -1, 5, NaN, Infinity, 2.5]) for (const v of [0, 3.5, NaN]) {
    const o = mix(pose, v); assert.equal(o.w[IDLE], 1, `pose ${pose} v ${v}`); assert.equal(o.loco, false);
  }
});

test('tốc độ NaN hoặc âm ở dáng đi: coi như 0, trọng số vẫn hợp lệ', () => {
  for (const v of [NaN, -5]) { const o = mix(1, v); assert.equal(o.w[WALK], 1); assert.ok(Number.isFinite(o.rate)); }
});

test('mọi trường hợp: tổng trọng số = 1 ± 1e-6, không âm, rate trong [rateMin, rateMax]', () => {
  const A = CONFIG.stroll.anim;
  for (const pose of [0, 1, 2, 3, 4, 7, NaN]) for (let v = -1; v <= 14; v += 0.05) {
    const o = mix(pose, v); let s = 0;
    for (const x of o.w) { assert.ok(x >= 0, `âm: pose ${pose} v ${v}`); s += x; }
    assert.ok(Math.abs(s - 1) <= 1e-6, `tổng ${s}: pose ${pose} v ${v}`);
    assert.ok(o.rate >= A.rateMin - 1e-9 && o.rate <= A.rateMax + 1e-9 || !o.loco, `rate ${o.rate}`);
  }
});

test('stCharModel: 0 nam → p0, 1 nữ → p3; không có / giá trị lạ → nam; hai nhân vật là hai mô hình khác nhau và có thật', () => {
  const C = CONFIG.stroll.anim.chars;
  assert.deepEqual(C, [0, 3]);
  assert.equal(stCharModel(0), C[0]); assert.equal(stCharModel(1), C[1]);
  for (const v of [undefined, null, 2, -1, '1', 1.5, NaN, {}]) assert.equal(stCharModel(v), C[0], `ch ${String(v)}`);
  assert.notEqual(C[0], C[1]);
  for (const k of C) assert.ok(CONFIG.stroll.anim.models[k], `mô hình ${k}`);
  assert.equal(CONFIG.stroll.anim.models.length, 5);
});

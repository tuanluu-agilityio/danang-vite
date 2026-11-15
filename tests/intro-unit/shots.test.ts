// Tư thế camera đoạn giới thiệu (D-045 Task 1)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { inEase, inPose, inOrbit, type InShot, type InVec } from '../../src/intro/shots.ts';

const near = (a: number, b: number) => assert.ok(Math.abs(a - b) < 1e-9, `${a} != ${b}`);
test('inEase', () => {
  assert.equal(inEase(0), 0); assert.equal(inEase(1), 1); near(inEase(0.5), 0.5);
  let p = -1;
  for (let i = 0; i <= 20; i++) { const v = inEase(i / 20); assert.ok(v >= p); p = v; }
  assert.equal(inEase(-1), 0); assert.equal(inEase(2), 1);
});
test('inPose tại 0 và 1', () => {
  const shot: InShot = { from: { pos: [1, 2, 3], target: [4, 5, 6] }, to: { pos: [10, 20, 30], target: [40, 50, 60] } };
  const p: InVec = [0, 0, 0], t: InVec = [0, 0, 0];
  inPose(shot, 0, p, t); assert.deepEqual(p, [1, 2, 3]); assert.deepEqual(t, [4, 5, 6]);
  inPose(shot, 1, p, t); assert.deepEqual(p, [10, 20, 30]); assert.deepEqual(t, [40, 50, 60]);
});
test('inOrbit', () => {
  const p: InVec = [30, 7, 40], t: InVec = [10, 0, 20];
  const d0 = Math.hypot(p[0] - t[0], p[2] - t[2]);
  inOrbit(p, t, 0.7);
  near(Math.hypot(p[0] - t[0], p[2] - t[2]), d0); assert.equal(p[1], 7);
  const q: InVec = [30, 7, 40];
  inOrbit(q, t, Math.PI);
  near(q[0], -10); near(q[2], 0);
});

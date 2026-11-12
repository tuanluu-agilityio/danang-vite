/* ===== Người treo dù: IK hai khớp (src/explore/pilot/ik.ts) ===== */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { plTwoBone } from '../../src/explore/pilot/ik.ts';

const d = (u: ArrayLike<number>, v: ArrayLike<number>) => Math.hypot(u[0] - v[0], u[1] - v[1], u[2] - v[2]);
const near = (a: number, b: number, e: number) => assert.ok(Math.abs(a - b) <= e, `${a} ≠ ${b}`);

test('đích trong tầm: đạt đích, độ dài xương giữ nguyên, khuỷu về phía cực', () => {
  const a = [0.1, 1.2, -0.3], t = [0.3, 0.9, -0.1], p = [0.1, 1.0, 2.0];
  const el: number[] = [0, 0, 0], en: number[] = [0, 0, 0];
  assert.equal(plTwoBone(a, 0.3, 0.3, t, p, el, en), true);
  assert.ok(d(en, t) < 1e-3);
  near(d(el, a), 0.3, 1e-4); near(d(en, el), 0.3, 1e-4);
  assert.ok(d(el, p) < d(a, p), 'khuỷu phải nằm phía cực');
  /* đổi cực sang phía đối diện thì khuỷu đổi phía */
  const el2: number[] = [0, 0, 0];
  plTwoBone(a, 0.3, 0.3, t, [0.1, 1.0, -2.0], el2, en);
  assert.ok(d(el2, [0.1, 1.0, -2.0]) < d(a, [0.1, 1.0, -2.0]));
});

test('đích xa gấp 3 tầm: false, đầu mút kẹp (l1 + l2) × 0.999 và thẳng hàng với đích', () => {
  const a = [0, 0, 0], t = [1.8, 0, 0], el: number[] = [9, 9, 9], en: number[] = [9, 9, 9];
  assert.equal(plTwoBone(a, 0.3, 0.3, t, [0, 1, 0], el, en), false);
  near(d(en, a), 0.6 * 0.999, 1e-6);
  near(en[0], 0.6 * 0.999, 1e-6); near(en[1], 0, 1e-9); near(en[2], 0, 1e-9);
  near(d(el, a), 0.3, 1e-4); near(d(en, el), 0.3, 1e-4);
});

test('đích trùng gốc, cực song song hướng đích: không NaN', () => {
  const el: number[] = [0, 0, 0], en: number[] = [0, 0, 0];
  for (const p of [[1, 0, 0], [0, 0, 0], [0, 5, 0]]) {
    plTwoBone([0, 0, 0], 0.3, 0.3, [0, 0, 0], p, el, en);
    assert.ok([...el, ...en].every(Number.isFinite), 'giá trị hữu hạn');
  }
  /* đích trên trục, cực cũng trên trục */
  plTwoBone([0, 0, 0], 0.3, 0.3, [0.4, 0, 0], [1, 0, 0], el, en);
  assert.ok([...el, ...en].every(Number.isFinite));
  near(d(el, [0, 0, 0]), 0.3, 1e-4);
});

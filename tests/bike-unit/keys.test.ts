/* ===== Xe máy: bàn phím → BkInput (src/explore/bike/keys.ts) =====
   W ga, A nghiêng trái, A + D triệt nhau, Space phanh gấp, grip không bị ghi (index.ts đặt theo thời tiết). */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { bkInputFromKeys, BK_KEYS } from '../../src/explore/bike/keys.ts';
import type { BkInput } from '../../src/explore/bike/motion.ts';

const out = (): BkInput => ({ gas: 0.5, brake: 0.5, steer: 0.5, hard: true, grip: 0.37 });   // giá trị rác; grip phải giữ nguyên
const read = (...codes: string[]): BkInput => bkInputFromKeys(new Set(codes), out());

test('từng phím cho đúng trường, grip không bị ghi', () => {
  assert.deepEqual(read(), { gas: 0, brake: 0, steer: 0, hard: false, grip: 0.37 });
  assert.deepEqual(read('KeyW'), { gas: 1, brake: 0, steer: 0, hard: false, grip: 0.37 });
  assert.deepEqual(read('ArrowUp'), { gas: 1, brake: 0, steer: 0, hard: false, grip: 0.37 });
  assert.deepEqual(read('KeyS'), { gas: 0, brake: 1, steer: 0, hard: false, grip: 0.37 });
  assert.deepEqual(read('ArrowDown'), { gas: 0, brake: 1, steer: 0, hard: false, grip: 0.37 });
  assert.deepEqual(read('KeyA'), { gas: 0, brake: 0, steer: 1, hard: false, grip: 0.37 });
  assert.deepEqual(read('ArrowLeft'), { gas: 0, brake: 0, steer: 1, hard: false, grip: 0.37 });
  assert.deepEqual(read('KeyD'), { gas: 0, brake: 0, steer: -1, hard: false, grip: 0.37 });
  assert.deepEqual(read('ArrowRight'), { gas: 0, brake: 0, steer: -1, hard: false, grip: 0.37 });
  assert.deepEqual(read('Space'), { gas: 0, brake: 0, steer: 0, hard: true, grip: 0.37 });
});

test('hai phím trái phải cùng lúc thì steer = 0', () => {
  assert.equal(read('KeyA', 'KeyD').steer, 0);
  assert.equal(read('ArrowLeft', 'KeyD').steer, 0);
});

test('tập phím chế độ xe máy', () => {
  for (const k of ['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space', 'KeyH', 'KeyV', 'KeyQ', 'KeyE', 'KeyR']) assert.ok(BK_KEYS.has(k), k);
  assert.equal(BK_KEYS.has('Escape'), false);
});

/* ===== Xe máy nhiều người: trường veh và độ nghiêng qua mạng (src/explore/multi/protocol.ts) =====
   Máy chủ kẹp st ở ±steerMax (0,56 rad) nên xe máy gửi lean × BK_WIRE, bên nhận chia lại (spec §17.4). */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { exVehNorm, BK_WIRE, bkLeanToWire, bkLeanFromWire } from '../../src/explore/multi/protocol.ts';
import { multiParams as P } from '../../src/explore/multi/params.ts';
import { CONFIG } from '../../src/config.ts';

test('exVehNorm: 1 → 1, mọi giá trị khác → 0 (ô tô)', () => {
  assert.equal(exVehNorm(1), 1);
  for (const v of [0, undefined, null, 2, 7, -1, '1', 1.5, NaN, true, {}, [1]]) assert.equal(exVehNorm(v), 0, String(v));
});

test('độ nghiêng qua mạng: khứ hồi giữ nguyên; nghiêng hết cỡ vẫn trong khoảng kẹp của máy chủ', () => {
  assert.equal(BK_WIRE, 0.8);
  assert.ok(Math.abs(bkLeanFromWire(bkLeanToWire(0.611)) - 0.611) < 1e-9);
  assert.ok(Math.abs(bkLeanFromWire(bkLeanToWire(-0.3)) + 0.3) < 1e-9);
  assert.ok(Math.abs(bkLeanToWire(0.7)) <= 0.56 + 1e-12);
  assert.ok(Math.abs(bkLeanToWire(CONFIG.bike.perf.leanMax)) <= P.drive.steerMax, 'leanMax qua được máy chủ không bị kẹp');
  assert.ok(Math.abs(bkLeanToWire(5)) <= P.drive.steerMax && Math.abs(bkLeanToWire(-5)) <= P.drive.steerMax, 'giá trị lạ bị kẹp');
  assert.equal(bkLeanToWire(NaN), 0); assert.equal(bkLeanFromWire(NaN), 0);
});

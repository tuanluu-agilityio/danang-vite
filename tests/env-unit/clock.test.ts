// Đồng hồ theo múi giờ Đà Nẵng + pha trong ngày (D-042 Task 1)
process.env.TZ = 'America/Los_Angeles';   // máy khách ở múi giờ khác: kết quả không được đổi
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { envClockParts, envHHMM, envPhase } from '../../src/realtime/clock.ts';

const TZ = 'Asia/Ho_Chi_Minh';
test('envClockParts theo múi giờ chỉ định', () => {
  const d = new Date('2026-11-14T15:15:07Z');
  assert.deepEqual(envClockParts(d, TZ), { h: 22, m: 15, s: 7, min: 1335 });
  process.env.TZ = 'Pacific/Apia';
  assert.deepEqual(envClockParts(new Date('2026-11-14T15:15:07Z'), TZ), { h: 22, m: 15, s: 7, min: 1335 });
});
test('nửa đêm là giờ 0, không phải 24', () => {
  assert.equal(envClockParts(new Date('2026-11-14T17:00:00Z'), TZ).h, 0);
});
test('envHHMM', () => {
  assert.equal(envHHMM(348), '05:48');
  assert.equal(envHHMM(0), '00:00');
});
test('envPhase', () => {
  const f = (m: number) => envPhase(m, 349, 1033, [-30, 75], [-75, 35]);
  const exp: Array<[number, string]> = [[318, 'night'], [319, 'dawn'], [423, 'dawn'], [424, 'day'], [957, 'day'], [958, 'dusk'], [1067, 'dusk'], [1068, 'night'], [0, 'night']];
  for (const [m, p] of exp) assert.equal(f(m), p, `phút ${m}`);
});

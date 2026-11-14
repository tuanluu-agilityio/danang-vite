/* ===== Xe máy: HUD riêng (src/explore/bike/hudBike.ts) với DOM giả =====
   bkHudUpdate chỉ ghi DOM khi xi nhan / pha nhấp nháy / trạng thái kẹt đổi; nhịp nháy cùng model.ts; ngưỡng kẹt; bộ chuyển cảm ứng DrInput → BkInput. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { bkHudBind, bkHudUpdate, bkHudReset, bkBlinkOn, bkStuckOn, bkTouchMerge, type BkHudNode } from '../../src/explore/bike/hudBike.ts';
import type { BkInput } from '../../src/explore/bike/motion.ts';
import type { DrInput } from '../../src/explore/drive/motion.ts';
import { CONFIG } from '../../src/config.ts';

/* Phần tử giả: đếm số lần ghi lớp, nhớ lớp đang bật */
function fake(): BkHudNode & { writes: number; on: Set<string> } {
  const on = new Set<string>();
  const n = { writes: 0, on, classList: { toggle(c: string, v: boolean) { n.writes++; if (v) on.add(c); else on.delete(c); return v; } } };
  return n;
}
function setup() {
  const e = { sigL: fake(), sigR: fake(), stuck: fake(), reset: fake() };
  bkHudBind(e); bkHudReset();
  const total = () => e.sigL.writes + e.sigR.writes + e.stuck.writes + e.reset.writes;
  return { e, total };
}

test('lần cập nhật đầu ghi trạng thái; lặp lại cùng giá trị không ghi DOM', () => {
  const { e, total } = setup();
  bkHudUpdate(0, false, false);
  assert.ok(total() > 0, 'lần đầu phải ghi');
  const w = total();
  for (let i = 0; i < 50; i++) bkHudUpdate(0, i % 2 === 0, false);   // không xi nhan: pha nhấp nháy đổi cũng không ghi
  assert.equal(total(), w);
  assert.equal(e.sigL.on.size + e.sigR.on.size + e.stuck.on.size + e.reset.on.size, 0);
});

test('xi nhan trái: bật on, lit theo pha; chỉ ghi khi pha đổi', () => {
  const { e, total } = setup();
  bkHudUpdate(0, false, false);
  let w = total();
  bkHudUpdate(1, true, false);
  assert.ok(total() > w); assert.ok(e.sigL.on.has('on') && e.sigL.on.has('lit')); assert.ok(!e.sigR.on.has('on') && !e.sigR.on.has('lit'));
  w = total();
  bkHudUpdate(1, true, false); bkHudUpdate(1, true, false);
  assert.equal(total(), w, 'cùng pha: không ghi');
  bkHudUpdate(1, false, false);
  assert.ok(total() > w); assert.ok(e.sigL.on.has('on') && !e.sigL.on.has('lit'));
  w = total();
  bkHudUpdate(1, false, false);
  assert.equal(total(), w);
});

test('đổi sang xi nhan phải rồi tắt', () => {
  const { e } = setup();
  bkHudUpdate(1, true, false);
  bkHudUpdate(-1, true, false);
  assert.ok(!e.sigL.on.has('on') && !e.sigL.on.has('lit'));
  assert.ok(e.sigR.on.has('on') && e.sigR.on.has('lit'));
  bkHudUpdate(0, true, false);
  assert.equal(e.sigL.on.size + e.sigR.on.size, 0);
});

test('kẹt: ghi khi đổi, không ghi khi giữ nguyên; nút về làn sáng theo', () => {
  const { e, total } = setup();
  bkHudUpdate(0, false, false);
  let w = total();
  bkHudUpdate(0, false, true);
  assert.ok(total() > w); assert.ok(e.stuck.on.has('show') && e.reset.on.has('hot'));
  w = total();
  for (let i = 0; i < 20; i++) bkHudUpdate(0, false, true);
  assert.equal(total(), w);
  bkHudUpdate(0, false, false);
  assert.ok(!e.stuck.on.has('show') && !e.reset.on.has('hot'));
});

test('bkHudReset buộc lần sau ghi lại (vào chế độ lần nữa); thiếu phần tử không lỗi', () => {
  const { total } = setup();
  bkHudUpdate(0, false, false);
  const w = total();
  bkHudReset();
  bkHudUpdate(0, false, false);
  assert.ok(total() > w);
  bkHudBind({ sigL: null, sigR: null, stuck: null, reset: null }); bkHudReset();
  bkHudUpdate(1, true, true);
});

test('nhịp nháy cùng CONFIG.bike.model.sigHz: nửa đầu chu kỳ sáng', () => {
  const T = 1 / CONFIG.bike.model.sigHz;
  assert.equal(bkBlinkOn(0), true);
  assert.equal(bkBlinkOn(T * 0.25), true);
  assert.equal(bkBlinkOn(T * 0.75), false);
  assert.equal(bkBlinkOn(T * 1.25), true);
});

test('ngưỡng kẹt CONFIG.bike.hud.stuckS', () => {
  const S = CONFIG.bike.hud.stuckS;
  assert.ok(S >= 2 && S <= 5);
  assert.equal(bkStuckOn(0), false);
  assert.equal(bkStuckOn(S - 0.01), false);
  assert.equal(bkStuckOn(S), true);
  assert.equal(bkStuckOn(NaN), false);
});

test('bộ chuyển cảm ứng: gộp với phím (lớn hơn thắng), hand → hard, grip giữ nguyên', () => {
  const bk: BkInput = { gas: 0, brake: 0, steer: 0.4, hard: false, grip: 0.6 };
  const dr: DrInput = { gas: 9, brake: 9, steer: 9, hand: true };   // rác: bị ghi đè từ bk trước khi đọc cảm ứng
  bkTouchMerge(bk, dr, (o) => { assert.deepEqual(o, { gas: 0, brake: 0, steer: 0.4, hand: false }); o.gas = 1; if (Math.abs(-0.8) > Math.abs(o.steer)) o.steer = -0.8; });
  assert.deepEqual(bk, { gas: 1, brake: 0, steer: -0.8, hard: false, grip: 0.6 });
  bkTouchMerge(bk, dr, (o) => { o.hand = true; o.brake = 1; });
  assert.equal(bk.hard, true); assert.equal(bk.brake, 1); assert.equal(bk.grip, 0.6);
  const k: BkInput = { gas: 1, brake: 0, steer: 1, hard: true, grip: 1 };   // không chạm gì: phím giữ nguyên
  bkTouchMerge(k, dr, () => {});
  assert.deepEqual(k, { gas: 1, brake: 0, steer: 1, hard: true, grip: 1 });
});

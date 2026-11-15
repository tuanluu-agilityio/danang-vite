// Mặt trời Đà Nẵng (D-043 Task 3, spec §4.3): độ cao, phương vị, mọc / lặn, night theo độ cao, sắc ấm
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CONFIG } from '../../src/config.ts';
import { sunPosition, liveNight, sunWarm } from '../../src/realtime/solar.ts';

const LAT = 16.061, LON = 108.227;
const at = (y: number, mo: number, d: number, h: number, mi: number) => Date.UTC(y, mo - 1, d, h, mi);

/* Dò từng phút trong [from, from + phút) thời điểm độ cao vượt ngưỡng (lên: mọc, xuống: lặn) */
function cross(from: number, minutes: number, up: boolean, thr = -0.833): number {
  let prev = sunPosition(from, LAT, LON).elev;
  for (let i = 1; i <= minutes; i++) {
    const t = from + i * 60000, e = sunPosition(t, LAT, LON).elev;
    if (up ? prev < thr && e >= thr : prev > thr && e <= thr) return t;
    prev = e;
  }
  return NaN;
}

test('độ cao trưa hạ chí / đông chí (= 90 − |vĩ độ − xích vĩ|, sai ≤ 1°)', () => {
  const s = sunPosition(at(2026, 6, 21, 4, 47), LAT, LON).elev;
  assert.ok(s >= 82 && s <= 83, 'hạ chí ' + s);
  const w = sunPosition(at(2026, 12, 21, 4, 45), LAT, LON).elev;
  assert.ok(w >= 50 && w <= 51, 'đông chí ' + w);
});
test('phương vị: trưa xuân phân ≈ Nam, sáng ≈ Đông', () => {
  const noon = sunPosition(at(2026, 3, 20, 4, 54), LAT, LON).azim;
  assert.ok(Math.abs(noon - 180) <= 10, 'trưa ' + noon);
  const morn = sunPosition(at(2026, 3, 20, 1, 0), LAT, LON).azim;
  assert.ok(morn >= 85 && morn <= 100, 'sáng ' + morn);
  const eve = sunPosition(at(2026, 3, 20, 9, 0), LAT, LON).azim;
  assert.ok(eve >= 260 && eve <= 275, 'chiều ' + eve);
  const juneNoon = sunPosition(at(2026, 6, 21, 4, 47), LAT, LON).azim;
  assert.ok(juneNoon < 10 || juneNoon > 350, 'trưa hạ chí ở phía Bắc thiên đỉnh ' + juneNoon);
});
test('mọc / lặn 2026-11-15 (giờ UTC)', () => {
  const rise = cross(at(2026, 11, 14, 21, 0), 180, true);
  assert.ok(rise >= at(2026, 11, 14, 22, 45) && rise <= at(2026, 11, 14, 23, 15), 'mọc ' + new Date(rise).toISOString());
  const set = cross(at(2026, 11, 15, 9, 0), 180, false);
  assert.ok(set >= at(2026, 11, 15, 10, 5) && set <= at(2026, 11, 15, 10, 25), 'lặn ' + new Date(set).toISOString());
});
test('mọc / lặn 2026-11-14 lệch ≤ 3 phút so với Open-Meteo (fixture: 05:49 / 17:13 ICT)', () => {
  const rise = cross(at(2026, 11, 13, 21, 0), 180, true), set = cross(at(2026, 11, 14, 9, 0), 180, false);
  assert.ok(Math.abs(rise - at(2026, 11, 13, 22, 49)) <= 3 * 60000, 'mọc ' + new Date(rise).toISOString());
  assert.ok(Math.abs(set - at(2026, 11, 14, 10, 13)) <= 3 * 60000, 'lặn ' + new Date(set).toISOString());
});
test('chỉ phụ thuộc epoch: cùng thời điểm cho cùng kết quả, số hữu hạn', () => {
  const t = at(2026, 11, 15, 3, 30), a = sunPosition(t, LAT, LON), b = sunPosition(t, LAT, LON);
  assert.deepEqual(a, b);
  assert.ok(isFinite(a.elev) && isFinite(a.azim) && a.azim >= 0 && a.azim < 360);
});
test('liveNight theo độ cao', () => {
  const C = CONFIG.live;
  assert.equal(liveNight(6, C), 0);
  assert.equal(liveNight(30, C), 0);
  assert.equal(liveNight(-6, C), 1);
  assert.equal(liveNight(-40, C), 1);
  assert.equal(liveNight(0, C), 0.5);
  let prev = 2;
  for (let e = -10; e <= 10; e += 0.25) { const n = liveNight(e, C); assert.ok(n <= prev && n >= 0 && n <= 1, 'đơn điệu ở ' + e); prev = n; }
});
test('sunWarm', () => {
  assert.equal(sunWarm(1), 1);
  assert.equal(sunWarm(2), 1);
  assert.equal(sunWarm(20), 0);
  assert.equal(sunWarm(15), 0);
  assert.equal(sunWarm(-10), 0);
  const m = sunWarm(8); assert.ok(m > 0 && m < 1);
  assert.ok(sunWarm(5) > sunWarm(10));
});

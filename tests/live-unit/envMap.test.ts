// Ánh xạ số liệu Open-Meteo → tham số cảnh (D-043 Task 2, spec §4.2, §4.7)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CONFIG } from '../../src/config.ts';
import { envToParams, envWindDir } from '../../src/realtime/envMap.ts';
import type { EnvWeather } from '../../src/realtime/weatherApi.ts';

const L = CONFIG.live;
/* Số liệu cơ sở: trời quang, gió nhẹ hướng Đông Bắc */
const W = (o: Partial<EnvWeather> = {}): EnvWeather => ({
  obs: Date.UTC(2026, 10, 15, 3, 0), obsMin: 600, temp: 27, feels: 29, hum: 70, wind: 10, dir: 45, rain: 0, cloud: 5, uv: 5, code: 0, isDay: true,
  sunrise: 355, sunset: 1035, gust: 18, vis: 24000, rate: 0, ...o
});
const near = (a: number, b: number, e = 1e-9) => Math.abs(a - b) <= e;
const finiteAll = (p: any) => Object.entries(p).every(([k, v]) => k === 'closed' ? typeof v === 'boolean' : typeof v === 'number' && isFinite(v as number));

/* Tám trạng thái của spec §4.7 */
const STATES: Record<string, EnvWeather> = {
  quang: W(),
  itMay: W({ code: 1, cloud: 25 }),
  uAm: W({ code: 3, cloud: 100, hum: 85 }),
  muaNho: W({ code: 61, cloud: 95, hum: 92, rate: 0.5, rain: 0.125 }),
  muaTo: W({ code: 65, cloud: 100, hum: 98, rate: 30, rain: 7.5, vis: 3000 }),
  suong: W({ code: 45, cloud: 100, hum: 99, vis: 300 }),
  gioManh: W({ code: 3, cloud: 80, wind: 72, gust: 100 }),
  dong: W({ code: 95, cloud: 100, hum: 95, rate: 12, rain: 3, wind: 40, gust: 80 })
};

test('tám trạng thái: level 0, không đóng cầu, mọi số hữu hạn, trong khoảng', () => {
  for (const [name, w] of Object.entries(STATES)) for (const sunUp of [true, false]) {
    const p = envToParams(w, sunUp, L);
    assert.equal(p.level, 0, name);
    assert.equal(p.closed, false, name);
    assert.ok(finiteAll(p), name + ' ' + JSON.stringify(p));
    for (const k of ['rain', 'cloud', 'haze', 'lightning', 'fog'] as const) assert.ok(p[k] >= 0 && p[k] <= 1, name + ' ' + k + ' = ' + p[k]);
    assert.ok(p.wind >= 0 && p.wind <= L.windMax && p.gust >= 0, name);
  }
});
test('quang: không mưa, không sương, không chớp, mây ≈ 0,05', () => {
  const p = envToParams(STATES.quang, true, L);
  assert.equal(p.rain, 0); assert.equal(p.fog, 0); assert.equal(p.lightning, 0);
  assert.ok(near(p.cloud, 0.05));
});
test('mưa theo lượng đo mm/h', () => {
  const r1 = envToParams(W({ code: 61, rate: 0.5 }), true, L).rain;
  assert.ok(r1 > 0.06 && r1 < 0.2, 'rate 0,5: ' + r1);
  const r2 = envToParams(W({ code: 65, rate: 30 }), true, L).rain;
  assert.ok(r2 > 0.85 && r2 <= 1, 'rate 30: ' + r2);
  assert.equal(envToParams(W({ code: 65, rate: 500 }), true, L).rain, 1);
  // mốc đúng spec §4.2
  for (const [mm, v] of [[0.1, 0.06], [1, 0.2], [2.5, 0.35], [7.6, 0.6], [20, 0.85], [50, 1]]) assert.ok(near(envToParams(W({ code: 61, rate: mm }), true, L).rain, v), mm + ' mm/h');
});
test('mã mưa mà lượng 0 ⇒ sàn mưa phùn; mã quang mà lượng 0 ⇒ 0; mã quang mà có lượng ⇒ theo lượng', () => {
  assert.equal(envToParams(W({ code: 53, rate: 0 }), true, L).rain, 0.05);
  assert.equal(envToParams(W({ code: 3, rate: 0 }), true, L).rain, 0);
  assert.equal(envToParams(W({ code: 3, rate: 0.03 }), true, L).rain, 0);
  assert.ok(envToParams(W({ code: 3, rate: 7.6 }), true, L).rain > 0.5);
});
test('sương: ẩm cao không thành sương dày; mã sương + tầm nhìn ngắn ⇒ dày; thiếu tầm nhìn ⇒ sàn mã', () => {
  assert.ok(envToParams(W({ hum: 98, vis: 20000, code: 1 }), true, L).fog <= 0.1);
  assert.ok(envToParams(W({ code: 45, vis: 300 }), true, L).fog >= 0.9);
  assert.equal(envToParams(W({ code: 45, vis: null }), true, L).fog, 0.6);
  assert.equal(envToParams(W({ code: 48, vis: null, hum: 99 }), true, L).fog, 0.6);
  assert.ok(near(envToParams(W({ hum: 50, vis: 4000 }), true, L).fog, 0.25));
  assert.ok(near(envToParams(W({ hum: 50, vis: 1000 }), true, L).fog, 0.7));
  assert.equal(envToParams(W({ hum: 50, vis: 150 }), true, L).fog, 1);
});
test('gió km/h → m/s, trần; gió giật', () => {
  assert.ok(near(envToParams(W({ wind: 72, gust: null }), true, L).wind, 20));
  assert.equal(envToParams(W({ wind: 300 }), true, L).wind, 40);
  const p = envToParams(W({ wind: 36, gust: null }), true, L);
  assert.ok(near(p.gust, 0.35 * p.wind));
  assert.ok(near(envToParams(W({ wind: 36, gust: 72 }), true, L).gust, 10));
  assert.equal(envToParams(W({ wind: 36, gust: 20 }), true, L).gust, 0);
});
test('chớp chỉ khi dông', () => {
  assert.equal(envToParams(W({ code: 95 }), true, L).lightning, 0.5);
  assert.equal(envToParams(W({ code: 96 }), true, L).lightning, 0.8);
  assert.equal(envToParams(W({ code: 99 }), true, L).lightning, 0.8);
  assert.equal(envToParams(W({ code: 63, rate: 5 }), true, L).lightning, 0);
});
test('mù nóng chỉ ban ngày, theo nhiệt và mây', () => {
  assert.ok(envToParams(W({ temp: 38, cloud: 0 }), true, L).haze > 0.5);
  assert.equal(envToParams(W({ temp: 38, cloud: 0 }), false, L).haze, 0);
  assert.equal(envToParams(W({ temp: 30, cloud: 0 }), true, L).haze, 0);
  assert.equal(envToParams(W({ temp: 38, cloud: 100 }), true, L).haze, 0);
  assert.equal(envToParams(W({ temp: 31.5 }), true, L).temp, 31.5);
});
test('envWindDir: độ khí tượng (thổi TỪ) → rad hướng thổi TỚI theo (cos, sin) trên (X, Z), +X Đông, −Z Bắc', () => {
  const v = (deg: number) => { const a = envWindDir(deg); return [Math.cos(a), Math.sin(a)]; };
  const ne = v(45); assert.ok(ne[0] < 0 && ne[1] > 0, 'Đông Bắc thổi về Tây Nam');
  const n = v(0); assert.ok(near(n[0], 0, 1e-9) && near(n[1], 1, 1e-9), 'gió Bắc thổi về +Z (Nam)');
  const w = v(270); assert.ok(near(w[0], 1, 1e-9) && near(w[1], 0, 1e-9), 'gió Tây thổi về +X (Đông)');
  const s = v(180); assert.ok(near(s[1], -1, 1e-9), 'gió Nam thổi về −Z (Bắc)');
  assert.ok(near(envToParams(W({ dir: 45 }), true, L).windDir, envWindDir(45)));
});

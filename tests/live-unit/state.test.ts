// stepWeather: tham số sương mới, hệ số thời gian tauScale, quay hướng gió theo cung ngắn (D-043 Task 2)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CONFIG } from '../../src/config.ts';
import { createWeatherState, neutralParams, presetTarget, stepWeather, type WeatherState } from '../../src/environment/weather/state.ts';

const approach = (a: number, b: number, tau: number, dt: number) => b + (a - b) * Math.exp(-dt / Math.max(1e-3, tau));
const D = Math.PI / 180;

const stormy = (s: WeatherState) => {
  s.target = { ...presetTarget('storm'), temp: 35, windDir: 2.5, fog: 0.8 };
  s.current = { ...neutralParams(), windDir: 0.3 };
};

test('trạng thái mới có fog 0, tauScale 1; preset mô phỏng có fog 0', () => {
  const s = createWeatherState();
  assert.equal(s.tauScale, 1);
  assert.equal(s.current.fog, 0);
  assert.equal(neutralParams().fog, 0);
  for (const n of ['now', 'summer', 'rain', 'monsoon', 'storm'] as const) assert.equal(presetTarget(n).fog, 0, n);
});
test('tauScale 1: đúng công thức cũ, windDir gán thẳng', () => {
  const s = createWeatherState(); stormy(s);
  const c0 = { ...s.current }, T = CONFIG.weather.tau, t = s.target, wet0 = s.wet;
  stepWeather(s, 1);
  const c = s.current;
  assert.equal(c.temp, approach(c0.temp, t.temp, T.temp, 1));
  assert.equal(c.rain, approach(c0.rain, t.rain, T.rain, 1));
  assert.equal(c.wind, approach(c0.wind, t.wind, T.wind, 1));
  assert.equal(c.gust, approach(c0.gust, t.gust, T.wind, 1));
  assert.equal(c.windDir, 2.5);
  assert.equal(c.cloud, approach(c0.cloud, t.cloud, T.cloud, 1));
  assert.equal(c.haze, approach(c0.haze, t.haze, T.haze, 1));
  assert.equal(c.level, approach(c0.level, t.level, T.level, 1));
  assert.equal(c.lightning, approach(c0.lightning, t.lightning, T.lightning, 1));
  assert.equal(c.closed, true);
  assert.equal(s.wet, approach(wet0, c.rain, c.rain > wet0 ? T.rain : T.wet, 1));
});
test('tauScale 3 chậm hơn', () => {
  const a = createWeatherState(), b = createWeatherState(); stormy(a); stormy(b); b.tauScale = 3;
  stepWeather(a, 1); stepWeather(b, 1);
  for (const k of ['temp', 'rain', 'wind', 'cloud', 'level', 'lightning', 'fog'] as const) {
    const da = Math.abs(a.current[k] - neutralParams()[k]), db = Math.abs(b.current[k] - neutralParams()[k]);
    assert.ok(db < da && db > 0, k);
  }
  assert.ok(Math.abs(b.current.windDir - 0.3) < Math.abs(2.5 - 0.3), 'windDir quay dần');
  assert.notEqual(b.current.windDir, 2.5);
});
test('windDir 350° → 10° với tauScale 3 đi qua 0°, không qua 180°', () => {
  const s = createWeatherState(); s.tauScale = 3;
  s.current.windDir = 350 * D; s.target.windDir = 10 * D;
  let crossed = false, before = false, prev = Math.cos(s.current.windDir);
  for (let i = 0; i < 600; i++) {
    stepWeather(s, 0.5);
    const a = s.current.windDir, cx = Math.cos(a);
    assert.ok(cx > Math.cos(25 * D), 'lệch khỏi cung ngắn ở bước ' + i + ': ' + a / D);
    if (Math.sin(a) < 0) before = true; else if (before) crossed = true;
    prev = cx;
  }
  assert.ok(before && crossed, 'quay dần qua 0°');
  const end = s.current.windDir;
  assert.ok(Math.abs(Math.atan2(Math.sin(end - 10 * D), Math.cos(end - 10 * D))) < 1e-3, 'tới đích: ' + end / D);
  assert.ok(prev > 0);
});
test('fog tiến về đích', () => {
  const s = createWeatherState(); s.target.fog = 1;
  let last = 0;
  for (let i = 0; i < 20; i++) { stepWeather(s, 1); assert.ok(s.current.fog > last); last = s.current.fog; }
  stepWeather(s, 1000);
  assert.ok(Math.abs(s.current.fog - 1) < 1e-6);
});

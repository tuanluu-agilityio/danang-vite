// Đọc phản hồi Open-Meteo + bảng mã WMO (D-042 Task 1)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { CONFIG } from '../../src/config.ts';
import { envUrl, envParse, envIsWeather, envWx, envCompass, envUvLevel } from '../../src/realtime/weatherApi.ts';

const fx = () => JSON.parse(readFileSync(new URL('./fixture.json', import.meta.url), 'utf8'));

test('envParse đọc phản hồi thật', () => {
  const w = envParse(fx())!;
  assert.equal(w.obs, Date.UTC(2026, 10, 14, 15, 15));
  assert.equal(w.obsMin, 1335);
  assert.equal(w.temp, 25.2);
  assert.equal(w.feels, 30.8);
  assert.equal(w.hum, 93);
  assert.equal(w.isDay, false);
  assert.equal(w.sunrise, 349);
  assert.equal(w.sunset, 1033);
  assert.equal(w.uv, 0);
  assert.equal(w.vis, 24140);
  assert.equal(w.gust, 7.6);
  assert.equal(w.rate, 0);
});
test('thiếu daily thì mọc / lặn null', () => {
  const j = fx(); delete j.daily;
  const w = envParse(j)!;
  assert.notEqual(w, null);
  assert.equal(w.sunrise, null);
  assert.equal(w.sunset, null);
});
test('số bắt buộc hỏng thì null', () => {
  const j = fx(); j.current.temperature_2m = null;
  assert.equal(envParse(j), null);
  assert.equal(envParse(null), null);
  assert.equal(envParse('x'), null);
  assert.equal(envParse({}), null);
});
test('envUrl', () => {
  const u = envUrl(CONFIG.env);
  for (const s of ['latitude=16.061', 'longitude=108.227', 'timezone=Asia%2FHo_Chi_Minh', 'wind_speed_unit=kmh', 'daily=sunrise,sunset'])
    assert.ok(u.includes(s), s);
  for (const v of ['temperature_2m', 'apparent_temperature', 'relative_humidity_2m', 'is_day', 'precipitation', 'weather_code', 'cloud_cover', 'wind_speed_10m', 'wind_direction_10m', 'uv_index'])
    assert.ok(u.includes(v), v);
});
test('envWx', () => {
  const rows: Array<[number, boolean, string, string]> = [
    [0, true, 'envWxClearD', 'clear-d'], [0, false, 'envWxClearN', 'clear-n'],
    [1, true, 'envWxFewD', 'cloudy-d'], [1, false, 'envWxFewN', 'cloudy-n'],
    [2, true, 'envWxPartly', 'cloudy-d'], [2, false, 'envWxPartly', 'cloudy-n'],
    [3, true, 'envWxOvercast', 'cloud'], [45, true, 'envWxFog', 'fog'], [48, false, 'envWxFog', 'fog'],
    [51, true, 'envWxDrizzle', 'rain'], [57, true, 'envWxDrizzle', 'rain'],
    [61, true, 'envWxRainL', 'rain'], [66, true, 'envWxRainL', 'rain'], [80, true, 'envWxRainL', 'rain'],
    [63, true, 'envWxRainM', 'rain'], [81, true, 'envWxRainM', 'rain'],
    [65, true, 'envWxRainH', 'rain'], [67, true, 'envWxRainH', 'rain'], [82, true, 'envWxRainH', 'rain'],
    [71, true, 'envWxSnow', 'snow'], [77, true, 'envWxSnow', 'snow'], [85, true, 'envWxSnow', 'snow'], [86, true, 'envWxSnow', 'snow'],
    [95, true, 'envWxStorm', 'storm'], [99, true, 'envWxStorm', 'storm'],
    [999, true, 'envWxPartly', 'cloudy-d'], [999, false, 'envWxPartly', 'cloudy-n']
  ];
  for (const [c, d, key, icon] of rows) assert.deepEqual(envWx(c, d), { key, icon }, `mã ${c} ${d}`);
});
test('envCompass', () => {
  const rows: Array<[number, string]> = [[0, 'N'], [22, 'N'], [23, 'NE'], [238, 'SW'], [359, 'N'], [-10, 'N'], [370, 'N']];
  for (const [d, k] of rows) assert.equal(envCompass(d), k, `${d}`);
});
test('envUvLevel', () => {
  const rows: Array<[number, string]> = [[0, ''], [2.9, 'Low'], [3, 'Mod'], [6, 'High'], [8, 'VHigh'], [11, 'Ext']];
  for (const [u, k] of rows) assert.equal(envUvLevel(u), k, `${u}`);
});
/* ===== D-043 Task 1: trường mới (gust, vis, rate), kiểm khoảng, bộ nhớ đệm bản cũ ===== */
test('rate từ precipitation + interval, gust / vis', () => {
  const j = fx(); j.current.interval = 900; j.current.precipitation = 0.5; j.current.visibility = 24140; j.current.wind_gusts_10m = 7.2;
  const w = envParse(j)!;
  assert.equal(w.rate, 2);
  assert.equal(w.vis, 24140);
  assert.equal(w.gust, 7.2);
});
test('thiếu interval thì coi 900 s; thiếu gust / vis thì null', () => {
  const j = fx(); delete j.current.interval; delete j.current.visibility; delete j.current.wind_gusts_10m; j.current.precipitation = 0.25;
  const w = envParse(j)!;
  assert.equal(w.rate, 1);
  assert.equal(w.gust, null);
  assert.equal(w.vis, null);
});
test('số bắt buộc ngoài khoảng thì bỏ cả phản hồi', () => {
  for (const [k, v] of [['temperature_2m', 99], ['temperature_2m', -30], ['relative_humidity_2m', 120], ['cloud_cover', -1], ['wind_speed_10m', 300], ['precipitation', -0.1]] as Array<[string, number]>) {
    const j = fx(); j.current[k] = v;
    assert.equal(envParse(j), null, k + ' = ' + v);
  }
});
test('số tùy chọn ngoài khoảng thì null, phần còn lại hợp lệ', () => {
  const j = fx(); j.current.visibility = -5; j.current.wind_gusts_10m = 999;
  const w = envParse(j)!;
  assert.notEqual(w, null);
  assert.equal(w.vis, null);
  assert.equal(w.gust, null);
  assert.equal(w.temp, 25.2);
});
test('hướng gió chuẩn hóa về [0, 360)', () => {
  const j = fx(); j.current.wind_direction_10m = 370;
  assert.equal(envParse(j)!.dir, 10);
  const k = fx(); k.current.wind_direction_10m = 360;
  assert.equal(envParse(k)!.dir, 0);
  const m = fx(); m.current.wind_direction_10m = -90;
  assert.equal(envParse(m)!.dir, 270);
});
test('bộ nhớ đệm kiểu cũ (D-042, thiếu gust / vis / rate) đọc được và được bổ sung', () => {
  const old: any = { obs: 1, obsMin: 1335, temp: 25.2, feels: 30.8, hum: 93, wind: 3.4, dir: 238, rain: 0.3, cloud: 10, uv: 0, code: 61, isDay: false, sunrise: 349, sunset: 1033 };
  assert.equal(envIsWeather(old), true);
  assert.equal(old.gust, null);
  assert.equal(old.vis, null);
  assert.ok(Math.abs(old.rate - 1.2) < 1e-9);
  const bad: any = { ...old, rate: 'x' };
  assert.equal(envIsWeather(bad), false);
});
test('envUrl có visibility và wind_gusts_10m', () => {
  const u = envUrl(CONFIG.env);
  assert.ok(u.includes('visibility'));
  assert.ok(u.includes('wind_gusts_10m'));
});

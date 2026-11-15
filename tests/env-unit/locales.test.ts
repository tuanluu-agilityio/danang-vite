// Khóa env* có đủ ở 9 ngôn ngữ, giữ đúng tham số {t} / {n} (D-042 Task 1)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const LANGS = ['vi', 'en', 'ko', 'ja', 'zh', 'th', 'ar', 'hi', 'ru'];
const KEYS = ['envAria', 'envPlace', 'envFeels', 'envHum', 'envWind', 'envRain', 'envDir', 'envCloud', 'envUv',
  'envWxClearD', 'envWxClearN', 'envWxFewD', 'envWxFewN', 'envWxPartly', 'envWxOvercast', 'envWxFog', 'envWxDrizzle', 'envWxRainL', 'envWxRainM', 'envWxRainH', 'envWxSnow', 'envWxStorm',
  'envDirN', 'envDirNE', 'envDirE', 'envDirSE', 'envDirS', 'envDirSW', 'envDirW', 'envDirNW',
  'envUvLow', 'envUvMod', 'envUvHigh', 'envUvVHigh', 'envUvExt',
  'envSunrise', 'envSunset', 'envSunLeft', 'envSunIn', 'envObs', 'envStale', 'envLoading', 'envOffline', 'envNoData', 'envClockOk'];
const load = (l: string) => JSON.parse(readFileSync(new URL(`../../src/i18n/locales/${l}.json`, import.meta.url), 'utf8'));
const params = (s: string) => (s.match(/\{[a-z]+\}/g) || []).sort().join(',');

test('45 khóa env* (brief ghi 46 nhưng liệt kê 45)', () => assert.equal(KEYS.length, 45));
for (const l of LANGS) test(`locale ${l}`, () => {
  const j = load(l), vi = load('vi');
  for (const k of KEYS) {
    assert.equal(typeof j[k], 'string', `${l}.${k}`);
    assert.ok(j[k].trim().length > 0, `${l}.${k} rỗng`);
    assert.equal(params(j[k]), params(vi[k]), `${l}.${k} tham số`);
  }
});

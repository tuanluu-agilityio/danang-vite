/* ===== Xe máy: khóa i18n (spec D-040 §10, Task 9) =====
   Mọi khóa bk* + exBikeDesc có ở 9 tệp, không rỗng; ar khác en (đã dịch, không chép); exSoon đã gỡ khỏi locale và index.html. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const LANGS = ['vi', 'en', 'ko', 'ja', 'zh', 'th', 'ar', 'hi', 'ru'];
const KEYS = ['bkHint', 'bkView', 'bkHorn', 'bkReset', 'bkStuck', 'bkSigL', 'bkSigR', 'exBikeDesc', 'bkLost', 'bkLostChooser'];
const root = new URL('../../', import.meta.url);
const L: Record<string, Record<string, string>> = {};
for (const l of LANGS) L[l] = JSON.parse(readFileSync(new URL(`src/i18n/locales/${l}.json`, root), 'utf8'));
const html = readFileSync(new URL('index.html', root), 'utf8');

test('mọi khóa bk* + exBikeDesc có ở 9 ngôn ngữ, không rỗng', () => {
  for (const l of LANGS) for (const k of KEYS) assert.ok(typeof L[l][k] === 'string' && L[l][k].trim().length > 0, `${l}.${k}`);
});

test('mọi khóa bk* của vi có đủ ở 8 ngôn ngữ còn lại (không sót khóa mới)', () => {
  const bk = Object.keys(L.vi).filter((k) => k.startsWith('bk'));
  for (const k of KEYS.filter((k) => k.startsWith('bk'))) assert.ok(bk.includes(k), k);
  for (const l of LANGS) for (const k of bk) assert.ok(typeof L[l][k] === 'string' && L[l][k].trim().length > 0, `${l}.${k}`);
});

test('ar đã dịch: khác en ở từng khóa; vi khác en', () => {
  for (const k of KEYS) { assert.notEqual(L.ar[k], L.en[k], `ar.${k}`); assert.notEqual(L.vi[k], L.en[k], `vi.${k}`); }
});

test('gợi ý phím nhắc đủ các phím của chế độ ở mọi ngôn ngữ', () => {
  for (const l of LANGS) for (const key of ['W A S D', 'Space', 'V', 'Q / E', 'H', 'R', 'Esc']) assert.ok(L[l].bkHint.includes(key), `${l}.bkHint thiếu ${key}`);
  for (const l of LANGS) assert.ok(L[l].bkStuck.includes('R'), `${l}.bkStuck nhắc phím R`);
});

test('exSoon đã gỡ: không còn trong locale lẫn index.html', () => {
  for (const l of LANGS) assert.equal(L[l].exSoon, undefined, l);
  assert.ok(!html.includes('exSoon'));
});

test('index.html có các phần tử HUD xe máy và gắn khóa', () => {
  for (const id of ['bkSigL', 'bkSigR', 'bkView', 'bkHorn', 'bkReset', 'bkHint', 'bkStuck']) assert.ok(html.includes(`id="${id}"`), id);
  for (const k of ['bkHint', 'bkStuck']) assert.ok(html.includes(`data-i18n="${k}"`), k);
  for (const k of ['bkSigL', 'bkSigR', 'bkView', 'bkHorn', 'bkReset']) assert.ok(html.includes(`data-i18n-aria="${k}"`), k);
  assert.ok(html.includes('data-i18n="exBikeDesc"'));
});

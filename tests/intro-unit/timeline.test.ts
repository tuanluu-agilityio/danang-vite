// Dòng thời gian đoạn giới thiệu điện ảnh (D-045 Task 1)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { CONFIG } from '../../src/config.ts';
import { inCreate, inAdvance, inSeek, inFade, inFill, inShould } from '../../src/intro/timeline.ts';

const S = CONFIG.intro.scenes;
const base = { explore: false, test: false, introParam: null as string | null, stored: null as string | null, seen: false, forced: false, reducedMotion: false, saveData: false };

test('inAdvance: sang từng nhịp đúng một lần, tổng thời lượng, kẹp ở nhịp cuối', () => {
  const c = inCreate();
  const got: number[] = [];
  let total = 0;
  for (let n = 0; n < 5000 && !c.done; n++) { const r = inAdvance(c, S, 0.05); total += 0.05; if (r >= 0) got.push(r); }
  assert.deepEqual(got, [1, 2, 3, 4, 5, 6, 7, 8]);
  assert.ok(Math.abs(total - 57) <= 0.05 + 1e-9, `tổng ${total}`);
  assert.equal(inAdvance(c, S, 1), -1);
  assert.equal(c.i, 8); assert.equal(c.t, 6); assert.equal(c.done, true);
});
test('paused: không đổi gì', () => {
  const c = inCreate(); c.paused = true;
  assert.equal(inAdvance(c, S, 1), -1); assert.equal(c.t, 0);
});
test('inSeek kẹp chỉ số', () => {
  const c = inCreate(); c.t = 3; c.done = true;
  assert.equal(inSeek(c, S, 99), 8); assert.equal(c.t, 0); assert.equal(c.done, false);
  assert.equal(inSeek(c, S, -3), 0);
});
test('inFade', () => {
  assert.equal(inFade(0, 7, 0.45, true, false), 0);
  assert.equal(inFade(0, 4.5, 0.45, false, false), 1);
  assert.equal(inFade(2, 4.5, 0.45, false, false), 0);
  assert.equal(inFade(4.5, 4.5, 0.45, false, false), 1);
  assert.equal(inFade(6, 6, 0.45, false, true), 0);
});
test('inFill', () => {
  const c = inCreate(); c.i = 3; c.t = 2.25;
  assert.equal(inFill(c, S, 2), 1); assert.equal(inFill(c, S, 3), 0.5); assert.equal(inFill(c, S, 4), 0);
});
test('inShould: bảng chân trị', () => {
  assert.equal(inShould({ ...base, explore: true }), false);
  assert.equal(inShould({ ...base, test: true }), false);
  assert.equal(inShould({ ...base, test: true, introParam: '', seen: true }), true);
  assert.equal(inShould({ ...base, introParam: 'off' }), false);
  assert.equal(inShould({ ...base, stored: 'off' }), false);
  assert.equal(inShould({ ...base, seen: true }), false);
  assert.equal(inShould({ ...base, forced: true, seen: true }), true);
  assert.equal(inShould({ ...base, reducedMotion: true }), false);
  assert.equal(inShould({ ...base, saveData: true }), false);
  assert.equal(inShould(base), true);
});
test('CONFIG.intro.scenes', () => {
  assert.deepEqual(S.map(s => s.id), ['welcome', 'glider', 'car', 'bike', 'walk', 'daynight', 'dragon', 'swing', 'finale']);
  for (let k = 1; k < S.length; k++) assert.ok(S[k].chapter >= S[k - 1].chapter);
  assert.equal(S[0].chapter, 1); assert.equal(S[S.length - 1].chapter, 6);
  for (const id of ['welcome', 'daynight', 'dragon', 'swing', 'finale']) assert.ok((CONFIG.intro.shots as any)[id], id);
});
test('đủ khóa i18n in*', () => {
  const LANGS = ['vi', 'en', 'ko', 'ja', 'zh', 'th', 'ar', 'hi', 'ru'];
  const load = (l: string) => JSON.parse(readFileSync(new URL(`../../src/i18n/locales/${l}.json`, import.meta.url), 'utf8'));
  const keys = Object.keys(load('vi')).filter(k => /^in[A-Z]/.test(k)).sort();
  assert.ok(keys.length > 0);
  for (const l of LANGS) assert.deepEqual(Object.keys(load(l)).filter(k => /^in[A-Z]/.test(k)).sort(), keys, l);
});

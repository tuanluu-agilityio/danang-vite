/* ===== Nhạc chủ đề (D-046): bản tổng phổ src/audio/score.ts + thông số CONFIG.music =====
   Node, không Web Audio: chỉ canh dữ liệu (độ dài bài, giai điệu trong thang âm, nốt không tràn câu, đủ bản phối cho mọi chế độ, ánh xạ cam.mode).
   Nhạc nghe ra sao thì không test nào chấm được; mức âm lượng đo bằng `npm run test:music` (kết xuất ngoại tuyến). */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CONFIG } from '../../src/config.ts';
import { SECTIONS, TOTAL_BARS, THEME, BRIDGE, PROG, COUNTER, LAYERS, MUSIC_MODES, musicModeOf, chordNotes, nearestTone, midiHz, melodyIndex } from '../../src/audio/score.ts';

const M = CONFIG.music;
const PENTA = [2, 4, 6, 9, 11];           // Rê – Mi – Fa♯ – La – Si
const D_MAJOR = [2, 4, 6, 7, 9, 11, 1];

test('một vòng bài dài 2–4 phút và chia hết thành các đoạn', () => {
  const sec = TOTAL_BARS * 4 * 60 / M.bpm;
  assert.equal(TOTAL_BARS, 80);
  assert.ok(sec >= 120 && sec <= 240, `dài ${sec} s`);
  for (const S of SECTIONS) assert.ok(S.bars > 0 && S.bars % 4 === 0, S.name);
});

test('mở đầu có giai điệu ngay ô đầu, không phải vài giây chỉ có nền', () => {
  const S = SECTIONS[0];
  assert.equal(S.mel, 'theme');
  assert.ok(S.pluck > 0 && S.arp > 0);
  assert.ok(melodyIndex(THEME).has(0), 'chủ đề bắt đầu ở bước 0');
});

test('giai điệu chủ đề: ngũ cung Rê, nốt nằm trong câu 8 ô, không chồng nhau', () => {
  for (const [name, notes, scale] of [['THEME', THEME, [...PENTA, 1]], ['BRIDGE', BRIDGE, [...PENTA, 1]]] as const) {
    let end = 0;
    for (const [s, m, l] of notes) {
      assert.ok(scale.includes(m % 12), `${name}: MIDI ${m} ngoài thang âm`);
      assert.ok(m >= 62 && m <= 88, `${name}: MIDI ${m} ngoài tầm`);
      assert.ok(s >= end, `${name}: nốt ở bước ${s} chồng nốt trước`);
      end = s + l; assert.ok(end <= 128, `${name}: tràn câu`);
    }
  }
  assert.ok(THEME.filter(([, m]) => !PENTA.includes(m % 12)).length <= 1, 'chủ đề chỉ có một nốt dẫn Đô♯');
});

test('hợp âm thuộc Rê trưởng; các vòng hợp âm đủ dài cho đoạn dùng nó', () => {
  for (const [name, prog] of Object.entries(PROG)) for (const c of prog) {
    for (const t of c.tones) assert.ok(D_MAJOR.includes(t), `${name}: lớp cao độ ${t}`);
    assert.ok(c.tones.includes(c.bass % 12), `${name}: nốt trầm ${c.bass} không thuộc hợp âm`);
    assert.ok(c.bass >= 33 && c.bass <= 47);
  }
  assert.equal(PROG.day.length, 8); assert.equal(PROG.night.length, 8); assert.equal(COUNTER.length, 8);
});

test('chordNotes / nearestTone / midiHz', () => {
  assert.deepEqual(chordNotes(PROG.day[0], 62, 4), [62, 64, 66, 69]);
  assert.equal(nearestTone(PROG.day[1], 66) % 12, 4);   // La/Đô♯: quanh Fa♯ gần nhất là Mi
  assert.ok(Math.abs(midiHz(69) - 440) < 1e-9); assert.ok(Math.abs(midiHz(57) - 220) < 1e-9);
});

test('cam.mode → bản phối', () => {
  assert.equal(musicModeOf('orbit'), 'overview'); assert.equal(musicModeOf('fly'), 'overview'); assert.equal(musicModeOf('walk'), 'overview');
  assert.equal(musicModeOf('glider'), 'glider'); assert.equal(musicModeOf('car'), 'car'); assert.equal(musicModeOf('bike'), 'bike');
  assert.equal(musicModeOf('stroll'), 'stroll'); assert.equal(musicModeOf('swRide'), 'stroll');
  assert.equal(musicModeOf('tour'), 'tour'); assert.equal(musicModeOf('storm'), 'tour'); assert.equal(musicModeOf('fly', 'tour'), 'tour');
});

test('CONFIG.music: đủ lớp cho mọi chế độ, đúng tính cách từng chế độ', () => {
  for (const mode of MUSIC_MODES) for (const L of LAYERS) assert.equal(typeof M.modes[mode][L], 'number', `${mode}.${L}`);
  for (const L of LAYERS) { assert.ok(M.level[L] > 0, L); assert.ok(M.verb[L] >= 0, L); }
  const { glider, car, bike, stroll, tour, overview } = M.modes;
  assert.equal(glider.snare, 0); assert.ok(glider.kick < 0.5 && glider.pad > overview.pad && glider.air > overview.air, 'dù lượn: rộng, trống nhẹ');
  assert.ok(car.bass > overview.bass && car.kick >= overview.kick && car.pump > overview.pump, 'ô tô: bass + trống rõ');
  assert.ok(bike.hat16 && bike.bassSync && bike.hat > car.hat && bike.perc > car.perc, 'xe máy: gõ sắc hơn ô tô');
  assert.ok(stroll.pluck > overview.pluck && stroll.kick < 0.5 && stroll.bass < overview.bass && stroll.snare === 0, 'đi dạo: dây gảy, ít trống');
  assert.ok(tour.lead === 0 && tour.trim < 1 && tour.snare === 0, 'Tour: lùi sau giọng đọc');
  assert.ok(M.duckDb <= -8 && M.duckDb >= -12, 'hạ nhạc 8–12 dB khi có thuyết minh');
  assert.ok(M.duckRelease > M.duckAttack, 'trả nhạc chậm hơn lúc hạ');
});

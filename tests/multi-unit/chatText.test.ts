/* ===== Trò chuyện theo khoảng cách (D-041): làm sạch chữ tin nhắn và lọc từ tục theo từ ===== */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { exSanitizeChat } from '../../src/explore/multi/protocol.ts';
import { exIsBadText } from '../../server/multi/src/badwords.ts';

test('exSanitizeChat: giữ chữ thường, cắt khoảng trắng', () => { assert.equal(exSanitizeChat('  xin chào  '), 'xin chào'); });

test('exSanitizeChat: rỗng / chỉ trắng / chỉ ký tự ẩn / không phải chuỗi → null', () => {
  for (const v of ['', '   ', '\n\n', '​‎', 'ㅤ', 5, null, undefined, {}]) assert.equal(exSanitizeChat(v as any), null);
});

test('exSanitizeChat: bỏ điều khiển và bidi, giữ xuống dòng và ZWJ', () => {
  assert.equal(exSanitizeChat('a\u0000b‮c\r\nd'), 'abc\nd');
  assert.equal(exSanitizeChat('👨‍👩‍👧'), '👨‍👩‍👧');
});

test('exSanitizeChat: giữ ZWNJ (hi / fa), bỏ surrogate lẻ', () => {
  assert.equal(exSanitizeChat('a‌b'), 'a‌b');
  assert.equal(exSanitizeChat('a\uD83Db'), 'ab');
  assert.ok(JSON.stringify({ t: 'chat', id: 1, text: exSanitizeChat('\uD83D'.repeat(300) + 'x') }).length < 1024);
});

test('exSanitizeChat: tối đa 4 dòng, phần sau nối bằng khoảng trắng', () => { assert.equal(exSanitizeChat('1\n2\n3\n4\n5\n6'), '1\n2\n3\n4 5 6'); });

test('exSanitizeChat: cắt 200 code point (emoji tính 1)', () => {
  assert.equal([...exSanitizeChat('x'.repeat(500))!].length, 200);
  assert.equal([...exSanitizeChat('😀'.repeat(300))!].length, 200);
});

test('exSanitizeChat: dấu chồng quá 4 liên tiếp bị dồn còn 4', () => { assert.equal(exSanitizeChat('a' + '́'.repeat(50) + 'b'), 'a' + '́'.repeat(4) + 'b'); });

test('exSanitizeChat: HTML giữ nguyên là chữ', () => { assert.equal(exSanitizeChat('<img src=x onerror=alert(1)>'), '<img src=x onerror=alert(1)>'); });

test('exIsBadText: chặn theo từ, không chặn chuỗi con', () => {
  for (const s of ['fuck you', 'đồ lồn', 'du ma may', 'what a BITCH']) assert.equal(exIsBadText(s), true, s);
  for (const s of ['cut the rope', 'mishit', 'Dickson ơi', 'lớn quá', 'buổi sáng đẹp', 'các bạn', 'cac ban oi', 'lon nuoc', 'hello <b>']) assert.equal(exIsBadText(s), false, s);
});

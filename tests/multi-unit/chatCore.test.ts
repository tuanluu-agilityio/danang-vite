/* ===== Trò chuyện theo khoảng cách (D-041): sổ tin + danh sách người ở gần phía khách (không DOM) ===== */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ChLog, chKey, chNear, type ChPeer } from '../../src/explore/multi/chatCore.ts';
import { multiParams } from '../../src/explore/multi/params.ts';

const C = multiParams.chat;
const me = { x: 0, y: 0, z: 0 };
const P = (slot: number, x: number, y = 0, k: ChPeer['k'] = 'walk'): ChPeer => ({ k, slot, name: 'P' + slot, x, y, z: 0 });
const keys = (l: ChPeer[]) => l.map(p => chKey(p.k, p.slot));
const log = () => new ChLog(C.historyMax, C.ackMs, C.ratePerWin, C.rateWinMs);

/* ----- chNear: trễ hai ngưỡng ----- */
test('chNear: 139 m vào; 145 m không vào khi prev rỗng, ở lại khi có trong prev', () => {
  assert.deepEqual(keys(chNear(me, [P(0, 139)], new Set(), C.nearIn, C.radius)), ['walk:0']);
  assert.deepEqual(chNear(me, [P(1, 145)], new Set(), C.nearIn, C.radius), []);
  assert.deepEqual(keys(chNear(me, [P(1, 145)], new Set(['walk:1']), C.nearIn, C.radius)), ['walk:1']);
});

test('chNear: 150 m còn (có trong prev), 150,1 m ra', () => {
  const prev = new Set(['walk:0', 'walk:1']);
  assert.deepEqual(keys(chNear(me, [P(0, 150), P(1, 150.1)], prev, C.nearIn, C.radius)), ['walk:0']);
});

test('chNear: khoảng cách 3D (cao 200 m không vào); self null → rỗng; giữ thứ tự peers', () => {
  assert.deepEqual(chNear(me, [P(0, 0, 200, 'fly')], new Set(), C.nearIn, C.radius), []);
  assert.deepEqual(chNear(null, [P(0, 1)], new Set(['walk:0']), C.nearIn, C.radius), []);
  assert.deepEqual(keys(chNear(me, [P(3, 50), P(1, 10), P(2, 300)], new Set(), C.nearIn, C.radius)), ['walk:3', 'walk:1']);
});

test('chKey: cùng slot khác loại là hai khóa khác nhau', () => {
  assert.equal(chKey('walk', 2), 'walk:2');
  assert.notEqual(chKey('walk', 1), chKey('drive', 1));
  const l = chNear(me, [P(1, 10, 0, 'walk'), P(1, 145, 0, 'drive')], new Set(['walk:1']), C.nearIn, C.radius);
  assert.deepEqual(keys(l), ['walk:1'], 'drive:1 không thừa hưởng prev của walk:1');
});

/* ----- ChLog ----- */
test('ChLog: addMine id 1, 2, 3 và pending; ack đổi trạng thái theo n / why', () => {
  const g = log();
  const [a, b, c, d, e, f] = ['a', 'b', 'c', 'd', 'e', 'f'].map(t => g.addMine(t, 0));
  assert.deepEqual([a.id, b.id, c.id], [1, 2, 3]);
  assert.ok([a, b, c].every(m => m.state === 'pending' && m.mine));
  assert.equal(g.ack(1, 2, undefined), a); assert.equal(a.state, 'ok'); assert.equal(a.n, 2);
  g.ack(2, 0, undefined); assert.equal(b.state, 'alone');
  g.ack(3, undefined, 'rate'); assert.equal(c.state, 'rate');
  g.ack(4, undefined, 'bad'); assert.equal(d.state, 'bad');
  g.ack(5, undefined, 'slot'); assert.equal(e.state, 'fail');
  g.ack(6, undefined, 'empty'); assert.equal(f.state, 'fail');
});

test('ChLog: ack id lạ → null; ack lần hai cho tin đã ok không đổi', () => {
  const g = log();
  const a = g.addMine('a', 0);
  assert.equal(g.ack(99, 1, undefined), null);
  g.ack(1, 3, undefined);
  assert.equal(g.ack(1, 0, undefined), null); assert.equal(a.state, 'ok'); assert.equal(a.n, 3);
});

test('ChLog: expire sau ackMs → fail, chỉ trả tin vừa đổi; hồi âm tới sau khi fail không đổi lại', () => {
  const g = log();
  const a = g.addMine('a', 0), b = g.addMine('b', 1000);
  assert.deepEqual(g.expire(C.ackMs - 1), []);
  assert.deepEqual(g.expire(C.ackMs), [a]); assert.equal(a.state, 'fail'); assert.equal(b.state, 'pending');
  assert.deepEqual(g.expire(C.ackMs + 10), []);
  assert.equal(g.ack(1, 2, undefined), null); assert.equal(a.state, 'fail');
});

test('ChLog: failAll đổi mọi pending thành fail, trả các tin đó', () => {
  const g = log();
  const a = g.addMine('a', 0), b = g.addMine('b', 0); g.ack(2, 1, undefined);
  assert.deepEqual(g.failAll(), [a]); assert.equal(a.state, 'fail'); assert.equal(b.state, 'ok');
});

test('ChLog: addTheirs bảng đóng tăng unread, bảng mở không; read() về 0', () => {
  const g = log();
  const m = g.addTheirs('drive', 2, 'B', 'yo', 5, false);
  assert.equal(m.mine, false); assert.equal(m.k, 'drive'); assert.equal(m.slot, 2); assert.equal(m.name, 'B'); assert.equal(m.text, 'yo'); assert.equal(m.at, 5);
  assert.equal(g.unread, 1);
  g.addTheirs('walk', 1, 'C', 'hi', 6, true); assert.equal(g.unread, 1);
  g.addTheirs('walk', 1, 'C', 'hi', 7, false); assert.equal(g.unread, 2);
  g.read(); assert.equal(g.unread, 0);
});

test('ChLog: canSend sai sau 5 addMine trong 10 s, đúng lại sau 10 s', () => {
  const g = log();
  for (let i = 0; i < C.ratePerWin; i++) { assert.ok(g.canSend(i * 100)); g.addMine('x' + i, i * 100); }
  assert.equal(g.canSend(C.rateWinMs - 1), false);
  assert.equal(g.canSend(C.rateWinMs), true);
});

test('ChLog: addMine(…, true) ghi tin trạng thái rate, không tính vào hạn mức (như máy chủ: tin bị từ chối vì quá nhanh không ghi giờ)', () => {
  const g = log();
  for (let i = 0; i < C.ratePerWin; i++) g.addMine('x' + i, 0);
  const r = g.addMine('dồn', 5000, true);
  assert.equal(r.state, 'rate');
  assert.equal(g.list.length, C.ratePerWin + 1);
  assert.equal(g.canSend(C.rateWinMs), true, 'tin rate lúc 5 s không kéo dài thời gian khóa');
  assert.equal(g.ack(r.id, 1, undefined), null, 'tin rate không chờ hồi âm');
});

test('ChLog: quá historyMax thì trim() trả tin cũ nhất, list.length === historyMax', () => {
  const g = log();
  const first = g.addMine('0', 0);
  for (let i = 1; i <= C.historyMax; i++) g.addTheirs('fly', 0, 'A', String(i), i, true);
  assert.equal(g.list.length, C.historyMax + 1);
  assert.deepEqual(g.trim(), [first]); assert.equal(g.list.length, C.historyMax);
  assert.deepEqual(g.trim(), []);
});

test('ChLog: key duy nhất tăng dần cho cả tin mình lẫn tin người khác; clear()', () => {
  const g = log();
  const l = [g.addMine('a', 0), g.addTheirs('walk', 0, 'B', 'b', 0, false), g.addMine('c', 0), g.addTheirs('fly', 1, 'D', 'd', 0, false)];
  for (let i = 1; i < l.length; i++) assert.ok(l[i].key > l[i - 1].key);
  g.clear();
  assert.equal(g.list.length, 0); assert.equal(g.unread, 0);
  assert.equal(g.addMine('e', 0).key > l[3].key, true, 'key không lặp lại sau clear');
});

/* ----- i18n: khóa chat đủ 9 ngôn ngữ ----- */
test('i18n: 9 ngôn ngữ có đủ khóa chat*, chuỗi không rỗng, có {name} / {n}', () => {
  const dir = join(dirname(fileURLToPath(import.meta.url)), '../../src/i18n/locales');
  const need = ['chatBtn', 'chatNone', 'chatOne', 'chatMany', 'chatLost', 'chatWatch', 'chatPlaceholder', 'chatSend', 'chatSending', 'chatSent', 'chatAlone', 'chatFail', 'chatRate', 'chatBad'];
  for (const lang of ['vi', 'en', 'ko', 'ja', 'zh', 'th', 'ar', 'hi', 'ru']) {
    const j = JSON.parse(readFileSync(join(dir, lang + '.json'), 'utf8'));
    for (const k of need) assert.ok(typeof j[k] === 'string' && j[k].trim() !== '', lang + ': thiếu ' + k);
    assert.ok(j.chatOne.includes('{name}'), lang + ': chatOne thiếu {name}');
    assert.ok(j.chatMany.includes('{n}'), lang + ': chatMany thiếu {n}');
    assert.ok(j.chatSent.includes('{n}'), lang + ': chatSent thiếu {n}');
  }
});

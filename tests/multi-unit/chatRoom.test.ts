/* ===== Trò chuyện theo khoảng cách (D-041): máy chủ chỉ giao tin tới người giữ chỗ trong bán kính chat.radius ===== */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SkyRoom } from '../../server/multi/src/room.ts';
import { multiParams as P } from '../../src/explore/multi/params.ts';

const J = (o: any) => JSON.stringify(o);
type K = 'fly' | 'walk' | 'drive';
// Kết nối + vào chỗ loại kind + một gói pos hợp lệ theo loại (bay: bank; đi dạo: pose; lái: v + st)
const mk = (r: SkyRoom, id: string, kind: K, name: string, x: number, y: number, z: number, now: number, extra: any = {}) => {
  r.connect(id, now);
  r.message(id, J({ t: 'join', name, ...(kind === 'fly' ? {} : { kind }), ...extra }), now);
  move(r, id, kind, x, y, z, now);
};
const move = (r: SkyRoom, id: string, kind: K, x: number, y: number, z: number, now: number) =>
  r.message(id, J({ t: 'pos', x, y, z, yaw: 0, ...(kind === 'fly' ? { bank: 0 } : kind === 'walk' ? { pose: 1 } : { v: 0, st: 0 }) }), now);
const chat = (r: SkyRoom, id: string, text: any, now: number, cid: any = 1) => r.message(id, J({ t: 'chat', text, id: cid }), now);
const to = (outs: any[], id: string) => outs.filter(o => o.to === id).map(o => o.msg);
const ack = (outs: any[], id: string) => to(outs, id).find(m => m.t === 'chatAck');
const got = (outs: any[], id: string) => to(outs, id).filter(m => m.t === 'chat');

test('chat trong tầm: người cách 100 m nhận đúng một tin, người gửi nhận hồi âm n 1, không phát all', () => {
  const r = new SkyRoom();
  mk(r, 'a', 'walk', 'A', 0, 10, 0, 0); mk(r, 'b', 'walk', 'B', 100, 10, 0, 0);
  const o = chat(r, 'a', 'chào', 500);
  assert.deepEqual(got(o, 'b'), [{ t: 'chat', k: 'walk', slot: 0, name: 'A', text: 'chào' }]);
  assert.deepEqual(ack(o, 'a'), { t: 'chatAck', id: 1, n: 1 });
  assert.equal(got(o, 'a').length, 0, 'người gửi không nhận lại tin của mình');
  assert.equal(o.filter(x => x.to === 'all').length, 0);
});

test('chat ngoài tầm: người cách 150,5 m không nhận; n chỉ đếm người trong tầm', () => {
  const r = new SkyRoom();
  mk(r, 'a', 'walk', 'A', 0, 10, 0, 0); mk(r, 'b', 'walk', 'B', 100, 10, 0, 0); mk(r, 'c', 'walk', 'C', 150.5, 10, 0, 0);
  const o = chat(r, 'a', 'chào', 500);
  assert.equal(got(o, 'c').length, 0);
  assert.equal(got(o, 'b').length, 1);
  assert.equal(ack(o, 'a').n, 1);
});

test('chat đúng biên: người cách đúng radius vẫn nhận', () => {
  const r = new SkyRoom();
  mk(r, 'a', 'walk', 'A', 0, 10, 0, 0); mk(r, 'b', 'walk', 'B', P.chat.radius, 10, 0, 0);
  const o = chat(r, 'a', 'biên', 500);
  assert.equal(got(o, 'b').length, 1); assert.equal(ack(o, 'a').n, 1);
});

test('chat theo khoảng cách 3D: người bay cao hơn 200 m không nhận, cao hơn 100 m nhận', () => {
  const r = new SkyRoom();
  mk(r, 'a', 'walk', 'A', 0, 10, 0, 0); mk(r, 'f1', 'fly', 'Cao', 0, 210, 0, 0); mk(r, 'f2', 'fly', 'Thap', 0, 110, 0, 0);
  const o = chat(r, 'a', 'trên đó', 500);
  assert.equal(got(o, 'f1').length, 0); assert.equal(got(o, 'f2').length, 1); assert.equal(ack(o, 'a').n, 1);
});

test('chat khác loại: người đi dạo gửi, xe máy cách 60 m và dù cách 90 m đều nhận, k là walk', () => {
  const r = new SkyRoom();
  mk(r, 'a', 'walk', 'A', 0, 10, 0, 0); mk(r, 'd', 'drive', 'Xe', 60, 10, 0, 0, { veh: 1 }); mk(r, 'f', 'fly', 'Du', 0, 10, 90, 0);
  const o = chat(r, 'a', 'chào cả nhà', 500);
  for (const id of ['d', 'f']) assert.deepEqual(got(o, id), [{ t: 'chat', k: 'walk', slot: 0, name: 'A', text: 'chào cả nhà' }], id);
  assert.equal(ack(o, 'a').n, 2);
});

test('chat ba người một vùng: mỗi tin tới hai người còn lại, k / slot / name đúng người gửi', () => {
  const r = new SkyRoom();
  mk(r, 'a', 'walk', 'A', 0, 10, 0, 0); mk(r, 'b', 'walk', 'B', 20, 10, 0, 0); mk(r, 'c', 'fly', 'C', 0, 30, 20, 0);
  const o1 = chat(r, 'a', 'một', 500);
  assert.equal(got(o1, 'b').length, 1); assert.equal(got(o1, 'c').length, 1); assert.equal(got(o1, 'a').length, 0);
  const o2 = chat(r, 'b', 'hai', 600);
  assert.deepEqual(got(o2, 'a'), [{ t: 'chat', k: 'walk', slot: 1, name: 'B', text: 'hai' }]);
  assert.deepEqual(got(o2, 'c'), [{ t: 'chat', k: 'walk', slot: 1, name: 'B', text: 'hai' }]);
  assert.equal(got(o2, 'b').length, 0); assert.equal(ack(o2, 'b').n, 2);
});

test('chat ra khỏi tầm rồi quay lại: máy chủ tính lại khoảng cách mỗi tin', () => {
  const r = new SkyRoom();
  mk(r, 'a', 'walk', 'A', 0, 10, 0, 0); mk(r, 'b', 'walk', 'B', 50, 10, 0, 0);
  move(r, 'b', 'walk', 400, 10, 0, 1000);
  const o1 = chat(r, 'a', 'đâu rồi', 1100);
  assert.equal(ack(o1, 'a').n, 0); assert.equal(got(o1, 'b').length, 0);
  move(r, 'b', 'walk', 50, 10, 0, 2000);
  const o2 = chat(r, 'a', 'đây rồi', 2100);
  assert.equal(ack(o2, 'a').n, 1); assert.equal(got(o2, 'b').length, 1);
});

test('chat không giữ chỗ: hồi âm why slot, không ai nhận', () => {
  const r = new SkyRoom();
  mk(r, 'b', 'walk', 'B', 0, 10, 0, 0);
  r.connect('x', 0);
  const o = chat(r, 'x', 'xin chào', 500);
  assert.deepEqual(ack(o, 'x'), { t: 'chatAck', id: 1, why: 'slot' });
  assert.equal(got(o, 'b').length, 0);
  assert.equal(o.length, 1);
});

test('chat khi chưa có pos: người gửi chưa có pos thì n 0; người nhận chưa có pos thì không nhận', () => {
  const r = new SkyRoom();
  mk(r, 'b', 'walk', 'B', 0, 10, 0, 0);
  r.connect('a', 0); r.message('a', J({ t: 'join', name: 'A', kind: 'walk' }), 0);
  const o1 = chat(r, 'a', 'mới vào', 500);
  assert.deepEqual(ack(o1, 'a'), { t: 'chatAck', id: 1, n: 0 }); assert.equal(got(o1, 'b').length, 0);
  const o2 = chat(r, 'b', 'chào A', 600);
  assert.equal(ack(o2, 'b').n, 0); assert.equal(got(o2, 'a').length, 0);
});

test('chat: người nhận im lặng quá slotTimeoutMs (chưa quét) không nhận', () => {
  const r = new SkyRoom();
  mk(r, 'a', 'walk', 'A', 0, 10, 0, 0); mk(r, 'b', 'walk', 'B', 10, 10, 0, 0);
  const now = P.slotTimeoutMs + 1;
  const o = chat(r, 'a', 'còn đó không', now);
  assert.equal(got(o, 'b').length, 0); assert.equal(ack(o, 'a').n, 0);
});

test('chat rỗng hoặc text không phải chuỗi: why empty', () => {
  const r = new SkyRoom();
  mk(r, 'a', 'walk', 'A', 0, 10, 0, 0); mk(r, 'b', 'walk', 'B', 10, 10, 0, 0);
  assert.deepEqual(ack(chat(r, 'a', '   ', 500), 'a'), { t: 'chatAck', id: 1, why: 'empty' });
  for (const [i, v] of [5, ['a'], undefined].entries()) {
    const o = chat(r, 'a', v, 600 + i);
    assert.deepEqual(ack(o, 'a'), { t: 'chatAck', id: 1, why: 'empty' }, String(v)); assert.equal(got(o, 'b').length, 0);
  }
});

test('chat dài: chữ cắt còn textMax ký tự; gói JSON dài hơn msgBytes bị bỏ', () => {
  const r = new SkyRoom();
  mk(r, 'a', 'walk', 'A', 0, 10, 0, 0); mk(r, 'b', 'walk', 'B', 10, 10, 0, 0);
  assert.equal(got(chat(r, 'a', 'x'.repeat(500), 500), 'b')[0].text, 'x'.repeat(P.chat.textMax));
  const raw = J({ t: 'chat', text: 'y'.repeat(P.chat.msgBytes), id: 2 });
  assert.ok(raw.length > P.chat.msgBytes);
  assert.deepEqual(r.message('a', raw, 600), []);
});

test('tin không phải chat dài hơn maxMsgBytes vẫn bị bỏ như cũ', () => {
  const r = new SkyRoom();
  mk(r, 'a', 'walk', 'A', 0, 10, 0, 0); mk(r, 'b', 'walk', 'B', 10, 10, 0, 0);
  const raw = J({ t: 'pos', x: 1, y: 10, z: 0, yaw: 0, pose: 1, rac: 'z'.repeat(300) });
  assert.ok(raw.length > P.maxMsgBytes && raw.length <= P.chat.msgBytes);
  assert.deepEqual(r.message('a', raw, 1000), []);
});

test('chat không giả danh được: tên / slot / loại lấy từ kết nối, trường khách gửi bị bỏ qua', () => {
  const r = new SkyRoom();
  mk(r, 'a', 'walk', 'A', 0, 10, 0, 0); mk(r, 'b', 'walk', 'B', 10, 10, 0, 0);
  const o = r.message('a', J({ t: 'chat', text: 'hi', id: 1, name: 'Admin', slot: 3, k: 'fly', to: 'c9' }), 500);
  assert.deepEqual(got(o, 'b'), [{ t: 'chat', k: 'walk', slot: 0, name: 'A', text: 'hi' }]);
  assert.equal(to(o, 'c9').length, 0);
});

test('chat HTML tới nơi nguyên văn (khách hiện bằng textContent)', () => {
  const r = new SkyRoom();
  mk(r, 'a', 'walk', 'A', 0, 10, 0, 0); mk(r, 'b', 'walk', 'B', 10, 10, 0, 0);
  assert.equal(got(chat(r, 'a', '<script>alert(1)</script>', 500), 'b')[0].text, '<script>alert(1)</script>');
});

test('chat từ tục: why bad, không ai nhận', () => {
  const r = new SkyRoom();
  mk(r, 'a', 'walk', 'A', 0, 10, 0, 0); mk(r, 'b', 'walk', 'B', 10, 10, 0, 0);
  const o = chat(r, 'a', 'fuck', 500);
  assert.deepEqual(ack(o, 'a'), { t: 'chatAck', id: 1, why: 'bad' }); assert.equal(got(o, 'b').length, 0);
});

test('chat tần suất: ratePerWin tin trong rateWinMs; tin bị từ chối vì rate không kéo dài khóa', () => {
  const r = new SkyRoom();
  mk(r, 'a', 'walk', 'A', 0, 10, 0, 0); mk(r, 'b', 'walk', 'B', 10, 10, 0, 0);
  const t0 = 1000;
  for (let i = 0; i < P.chat.ratePerWin; i++) {
    const a = ack(chat(r, 'a', 'tin ' + i, t0 + i), 'a');
    assert.equal(a.n, 1, 'tin ' + i); assert.equal(a.why, undefined);
  }
  assert.deepEqual(ack(chat(r, 'a', 'thừa', t0 + 10), 'a'), { t: 'chatAck', id: 1, why: 'rate' });
  for (const dt of [3000, 6000, 9000]) assert.equal(ack(chat(r, 'a', 'vẫn thừa', t0 + dt), 'a').why, 'rate', String(dt));
  move(r, 'b', 'walk', 10, 10, 0, t0 + P.chat.rateWinMs);   // người nhận vẫn còn sống (seen mới)
  const a = ack(chat(r, 'a', 'lại được', t0 + P.chat.rateWinMs), 'a');
  assert.equal(a.why, undefined); assert.equal(a.n, 1);
});

test('chat id lạ (chuỗi, số lẻ, quá 2^53, thiếu) thì hồi âm id 0', () => {
  const r = new SkyRoom();
  mk(r, 'a', 'walk', 'A', 0, 10, 0, 0);
  for (const [i, v] of (['x', 1.5, 2 ** 60] as any[]).entries()) assert.equal(ack(chat(r, 'a', 'hi', 500 + i, v), 'a').id, 0, String(v));
  assert.equal(ack(r.message('a', J({ t: 'chat', text: 'hi' }), 600), 'a').id, 0, 'thiếu');
  assert.equal(ack(chat(r, 'a', 'hi', 700, 42), 'a').id, 42);
});

test('chat đủ 15 chỗ trong 50 m: một tin tới 14 người, n 14', () => {
  const r = new SkyRoom();
  const kinds: K[] = ['fly', 'walk', 'drive'];
  const ids: string[] = [];
  kinds.forEach((k, g) => { for (let i = 0; i < 5; i++) { const id = k + i; ids.push(id); mk(r, id, k, k.toUpperCase() + i, i * 5, 10 + g * 3, g * 5, 0); } });
  const o = chat(r, 'walk0', 'đông quá', 500);
  assert.equal(ack(o, 'walk0').n, 14);
  for (const id of ids) assert.equal(got(o, id).length, id === 'walk0' ? 0 : 1, id);
});

test('lobby luôn có chat 1 (connect, join, sweep)', () => {
  const r = new SkyRoom();
  assert.equal((r.connect('a', 0)![0].msg as any).chat, 1);
  const j = r.message('a', J({ t: 'join', name: 'A' }), 0).find(o => o.msg.t === 'lobby');
  assert.equal((j!.msg as any).chat, 1);
  const s = r.sweep(P.slotTimeoutMs + 1).find(o => o.msg.t === 'lobby');
  assert.equal((s!.msg as any).chat, 1);
});

test('chat tính là còn sống: seenOf người gửi bằng giờ gửi', () => {
  const r = new SkyRoom();
  mk(r, 'a', 'walk', 'A', 0, 10, 0, 0);
  const now = P.slotTimeoutMs - 1;
  chat(r, 'a', 'vẫn ở đây', now);
  assert.equal(r.seenOf('a'), now);
  assert.deepEqual(r.sweep(now + 2), [], 'chưa hết hạn');
});

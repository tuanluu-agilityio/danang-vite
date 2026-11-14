/* ===== Worker (server/multi/src/worker.ts): attachment của socket mang veh + ch của người lái xe máy, dựng lại phòng sau hibernation =====
   Node, không Cloudflare: DurableObjectState giả chỉ có getWebSockets / storage; socket giả giữ attachment như serializeAttachment thật (bản sao JSON). */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SkyObject } from '../../server/multi/src/worker.ts';

class FakeWs {
  att: any = null; sent: any[] = [];
  serializeAttachment(a: any) { this.att = JSON.parse(JSON.stringify(a)); }
  deserializeAttachment() { return this.att === null ? null : JSON.parse(JSON.stringify(this.att)); }
  send(t: string) { this.sent.push(JSON.parse(t)); }
}
function fakeState(socks: FakeWs[]) {
  return { getWebSockets: () => socks, storage: { getAlarm: async () => null, setAlarm: async () => {} } } as any;
}

test('xe máy: attachment ghi veh 1 + ch; ô tô không ghi veh; thức dậy sau hibernation giữ veh + ch trong lobby.drivers', async () => {
  const b = new FakeWs(), c = new FakeWs();
  b.serializeAttachment({ id: 'b', slot: -1, name: '' }); c.serializeAttachment({ id: 'c', slot: -1, name: '' });
  const socks = [b, c];
  const o = new SkyObject(fakeState(socks), {} as any);
  await o.webSocketMessage(b as any, JSON.stringify({ t: 'join', name: 'Xe', kind: 'drive', veh: 1, ch: 1 }));
  await o.webSocketMessage(c as any, JSON.stringify({ t: 'join', name: 'Oto', kind: 'drive' }));
  assert.equal(b.att.kind, 'drive'); assert.equal(b.att.veh, 1); assert.equal(b.att.ch, 1); assert.equal(b.att.slot, 0);
  assert.equal(c.att.kind, 'drive'); assert.equal('veh' in c.att, false, 'ô tô: attachment như bản cũ'); assert.equal('ch' in c.att, false);
  assert.deepEqual(b.sent.find((m) => m.t === 'joined'), { t: 'joined', slot: 0, kind: 'drive', veh: 1 });
  /* hibernation: đối tượng mới dựng từ attachment của các socket còn mở */
  const z = new FakeWs(); z.serializeAttachment({ id: 'z', slot: -1, name: '' }); socks.push(z);
  const o2 = new SkyObject(fakeState(socks), {} as any);
  await o2.webSocketMessage(z as any, JSON.stringify({ t: 'join', name: 'Bay' }));
  const lobby = [...z.sent].reverse().find((m) => m.t === 'lobby');
  assert.deepEqual(lobby.drivers, [{ slot: 0, name: 'Xe', ch: 1, veh: 1 }, { slot: 1, name: 'Oto', ch: 0, veh: 0 }]);
});

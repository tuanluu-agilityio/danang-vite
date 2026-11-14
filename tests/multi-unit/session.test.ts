import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MultiSession } from '../../src/explore/multi/session.ts';
import type { Transport } from '../../src/explore/multi/client.ts';
import type { Kind } from '../../src/explore/multi/protocol.ts';
import { SkyRoom } from '../../server/multi/src/room.ts';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join as pjoin, dirname } from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { after } from 'node:test';

class Fake implements Transport {
  sent: any[] = []; closed = false;
  onMessage: (m: any) => void = () => {}; onClose: () => void = () => {};
  send(m: any) { this.sent.push(m); }
  close() { this.closed = true; }
}
const fl = (...slots: number[]) => slots.map(s => ({ slot: s, name: 'P' + s }));
async function make(pick = (n: number) => 0) {
  const t = new Fake();
  const s = new MultiSession(() => Promise.resolve(t), pick);
  let changes = 0; s.onChange = () => { changes++; };
  s.open();
  await Promise.resolve(); await Promise.resolve();
  return { t, s, changes: () => changes };
}
const lobby = (t: Fake, ...slots: number[]) => t.onMessage({ t: 'lobby', flyers: fl(...slots) });

test('kết nối lỗi: phase solo, notice offline', async () => {
  const s = new MultiSession(() => Promise.reject(new Error('x')));
  s.open(); assert.equal(s.phase, 'connecting');
  await new Promise(r => setTimeout(r, 0));
  assert.equal(s.phase, 'solo'); assert.equal(s.notice, 'offline');
});

test('lobby đầu có 5 flyers: watching, watched thuộc 5 slot đó', async () => {
  const { t, s } = await make(n => n - 1);
  lobby(t, 0, 1, 2, 3, 4);
  assert.equal(s.phase, 'watching'); assert.equal(s.watched, 4); assert.equal(s.invite, false);
});

test('lobby đầu < 5: phase lobby', async () => {
  const { t, s } = await make(); lobby(t, 1, 2);
  assert.equal(s.phase, 'lobby'); assert.equal(s.flyers.length, 2);
});

test('join → joined: flying, mySlot đúng', async () => {
  const { t, s } = await make(); lobby(t, 1);
  s.join('An'); assert.deepEqual(t.sent.at(-1), { t: 'join', name: 'An' }); assert.equal(s.name, 'An');
  t.onMessage({ t: 'joined', slot: 3 });
  assert.equal(s.phase, 'flying'); assert.equal(s.mySlot, 3);
});

test('rejected full ở lobby: watching, giữ name', async () => {
  const { t, s } = await make(); lobby(t, 0, 1, 2, 3);
  s.join('An'); lobby(t, 0, 1, 2, 3, 4); t.onMessage({ t: 'rejected', why: 'full' });
  assert.equal(s.phase, 'watching'); assert.equal(s.name, 'An');
});

test('rejected name: phase giữ nguyên, notice nameBad', async () => {
  const { t, s } = await make(); lobby(t);
  s.join('x'); t.onMessage({ t: 'rejected', why: 'name' });
  assert.equal(s.phase, 'lobby'); assert.equal(s.notice, 'nameBad');
});

test('watching, flyers < 5: invite true; join rồi rejected full: notice late', async () => {
  const { t, s } = await make(); lobby(t, 0, 1, 2, 3, 4);
  lobby(t, 0, 1, 2, 3); assert.equal(s.invite, true);
  s.join('An'); t.onMessage({ t: 'rejected', why: 'full' });
  assert.equal(s.notice, 'late'); assert.equal(s.phase, 'watching');
});

test('người đang xem rời đi: watched đổi; không còn ai: -1, invite true', async () => {
  const { t, s } = await make(); lobby(t, 0, 1, 2, 3, 4);
  assert.equal(s.watched, 0);
  lobby(t, 1, 2, 3, 4); assert.notEqual(s.watched, 0); assert.ok([1, 2, 3, 4].includes(s.watched));
  lobby(t); assert.equal(s.watched, -1); assert.equal(s.invite, true);
});

test('flyers đổi nhưng người đang xem còn: watched không đổi', async () => {
  const { t, s } = await make(n => n - 1); lobby(t, 0, 1, 2, 3, 4);
  assert.equal(s.watched, 4); lobby(t, 1, 4); assert.equal(s.watched, 4);
});

test('đóng kết nối khi flying: solo, lost, flyers rỗng, mySlot -1', async () => {
  const { t, s } = await make(); lobby(t, 1); s.join('An'); t.onMessage({ t: 'joined', slot: 2 });
  t.onClose();
  assert.equal(s.phase, 'solo'); assert.equal(s.notice, 'lost'); assert.equal(s.flyers.length, 0); assert.equal(s.mySlot, -1);
});

test('đóng kết nối khi watching: notice lost, phase solo', async () => {
  const { t, s } = await make(); lobby(t, 0, 1, 2, 3, 4); t.onClose();
  assert.equal(s.phase, 'solo'); assert.equal(s.notice, 'lost');
});

test('released khi flying: watching, notice released', async () => {
  const { t, s } = await make(); lobby(t, 1); s.join('An'); t.onMessage({ t: 'joined', slot: 2 });
  t.onMessage({ t: 'released' });
  assert.equal(s.phase, 'watching'); assert.equal(s.notice, 'released'); assert.equal(s.mySlot, -1);
});

test('leave khi flying: gửi leave, chuyển watching, không chọn xem chính mình', async () => {
  const { t, s } = await make(); lobby(t, 1); s.join('An'); t.onMessage({ t: 'joined', slot: 2 });
  lobby(t, 1, 2); s.leave();
  assert.deepEqual(t.sent.at(-1), { t: 'leave' });
  assert.equal(s.phase, 'watching'); assert.equal(s.mySlot, -1); assert.equal(s.watched, 1);
  assert.equal(s.notice, 'released');   // rời máy: cùng thông báo với khi máy chủ thu hồi chỗ
});

test('sendPos ngoài flying không gửi; heartbeat chỉ khi flying', async () => {
  const { t, s } = await make(); lobby(t, 1);
  s.sendPos(1, 2, 3, 0, 0); s.heartbeat(); assert.equal(t.sent.length, 0);
  s.join('An'); t.onMessage({ t: 'joined', slot: 2 }); t.sent.length = 0;
  s.sendPos(1, 2, 3, 0.5, 0.1, 1234); s.heartbeat();
  assert.deepEqual(t.sent, [{ t: 'pos', x: 1, y: 2, z: 3, yaw: 0.5, bank: 0.1, ts: 1234 }, { t: 'hb' }]);   // ts: giờ gửi để người xem nội suy theo trục giờ người gửi
});

test('pos chuyển cho onPos; dispose đóng và bỏ qua tin sau đó', async () => {
  const { t, s } = await make(); let got: any = null; s.onPos = f => { got = f; };
  t.onMessage({ t: 'pos', f: [[1, 0, 0, 0, 0, 0]] }); assert.deepEqual(got, [[1, 0, 0, 0, 0, 0]]);
  s.dispose(); assert.equal(t.closed, true); t.onClose(); assert.notEqual(s.notice, 'lost');
});

test('bị giành chỗ ngay ở sảnh (rejected full khi đang lobby): sang xem và báo late', async () => {
  const { t, s } = await make(); lobby(t, 0, 1, 2, 3);
  s.join('An'); t.onMessage({ t: 'rejected', why: 'full' });
  assert.equal(s.phase, 'watching'); assert.equal(s.notice, 'late');
});

/* ===== Đi dạo (Task 7): nhóm slot riêng, cùng máy trạng thái ===== */
async function makeKind(kind: Kind, pick = (n: number) => 0) {
  const t = new Fake();
  const s = new MultiSession(() => Promise.resolve(t), pick, kind);
  s.open();
  await Promise.resolve(); await Promise.resolve();
  return { t, s };
}
const lobby2 = (t: Fake, flyers: number[], walkers?: number[]) => t.onMessage(walkers ? { t: 'lobby', flyers: fl(...flyers), walkers: fl(...walkers) } : { t: 'lobby', flyers: fl(...flyers) });

test("kind 'walk': join gửi kind; lobby có 5 walkers và 0 flyers → watching, invite false; lobby có 5 flyers và 2 walkers → lobby", async () => {
  const a = await makeKind('walk');
  assert.equal(a.s.kind, 'walk');
  lobby2(a.t, [], [0, 1, 2, 3, 4]);
  assert.equal(a.s.phase, 'watching'); assert.equal(a.s.invite, false); assert.equal(a.s.walkers.length, 5);
  const b = await makeKind('walk');
  lobby2(b.t, [0, 1, 2, 3, 4], [1, 3]);
  assert.equal(b.s.phase, 'lobby'); assert.equal(b.s.peers.length, 2);
  b.s.join('An'); assert.deepEqual(b.t.sent.at(-1), { t: 'join', name: 'An', kind: 'walk', ch: 0 });   // chưa chọn: nam
  b.t.onMessage({ t: 'joined', slot: 0, kind: 'walk' });
  assert.equal(b.s.phase, 'flying'); assert.equal(b.s.mySlot, 0);   // 'flying' = đang giữ chỗ, cả khi đi dạo
});

test("kind 'walk' gặp lobby không có trường walkers (máy chủ cũ) → solo, notice offline, transport bị đóng", async () => {
  const { t, s } = await makeKind('walk');
  let changes = 0; s.onChange = () => { changes++; };
  lobby2(t, [0, 1]);
  assert.equal(s.phase, 'solo'); assert.equal(s.notice, 'offline'); assert.equal(t.closed, true); assert.equal(changes, 1);
  t.onClose(); assert.equal(s.notice, 'offline');   // đóng do mình: không thành 'lost'
  s.join('An'); assert.equal(t.sent.length, 0);
});

test("kind 'fly' gặp lobby có walkers: flyers / phase / watched như trước; walkers được lưu; pos có w gọi onWalkPos, f gọi onPos", async () => {
  const { t, s } = await makeKind('fly', n => n - 1);
  assert.equal(s.kind, 'fly');
  lobby2(t, [0, 1, 2, 3, 4], [0, 1]);
  assert.equal(s.phase, 'watching'); assert.equal(s.watched, 4); assert.equal(s.flyers.length, 5); assert.equal(s.walkers.length, 2);
  assert.deepEqual(s.peers.map(f => f.slot), [0, 1, 2, 3, 4]);
  let f: any = null, w: any = null; s.onPos = x => { f = x; }; s.onWalkPos = x => { w = x; };
  t.onMessage({ t: 'pos', f: [[1, 0, 0, 0, 0, 0, 5]], w: [[0, 1, 2, 3, 0, 1, 5]] });
  assert.deepEqual(f, [[1, 0, 0, 0, 0, 0, 5]]); assert.deepEqual(w, [[0, 1, 2, 3, 0, 1, 5]]);
  w = null; t.onMessage({ t: 'pos', f: [] }); assert.equal(w, null);
  s.join('An'); assert.deepEqual(t.sent.at(-1), { t: 'join', name: 'An' });   // bay: không gửi kind (máy chủ cũ hiểu được)
});

test("kind 'walk': watched chỉ chọn trong walkers; người được xem rời đi thì chuyển người khác", async () => {
  const { t, s } = await makeKind('walk', n => n - 1);
  lobby2(t, [0, 1, 2, 3, 4], [0, 1, 2, 3, 4]);
  assert.equal(s.phase, 'watching'); assert.equal(s.watched, 4);
  lobby2(t, [0, 1, 2, 3, 4], [0, 2, 3]);
  assert.ok([0, 2, 3].includes(s.watched)); assert.equal(s.invite, true);
  lobby2(t, [0, 1, 2, 3, 4], []);
  assert.equal(s.watched, -1);   // không còn người đi dạo: không xem người bay
});

test('sendWalk chỉ gửi khi đang giữ chỗ; gói có pose, không có bank', async () => {
  const { t, s } = await makeKind('walk');
  lobby2(t, [], [1]);
  s.sendWalk(1, 2, 3, 0.5, 1, 99); assert.equal(t.sent.length, 0);
  s.join('An'); t.onMessage({ t: 'joined', slot: 0, kind: 'walk' }); t.sent.length = 0;
  s.sendWalk(-230, 3.1, 17.4, 0.5, 2, 1234);
  assert.deepEqual(t.sent, [{ t: 'pos', x: -230, y: 3.1, z: 17.4, yaw: 0.5, pose: 2, ts: 1234 }]);
  assert.equal('bank' in t.sent[0], false);
});

/* ===== Lái xe (D-034 Task 10): nhóm slot thứ ba; tương thích hai chiều với máy chủ / khách đang chạy ở main ===== */
const lobby3 = (t: Fake, flyers: number[], walkers: number[], drivers?: number[]) =>
  t.onMessage(drivers ? { t: 'lobby', flyers: fl(...flyers), walkers: fl(...walkers), drivers: fl(...drivers) } : { t: 'lobby', flyers: fl(...flyers), walkers: fl(...walkers) });

test("kind 'drive': join gửi kind drive; peers là drivers; đủ 5 người lái → watching; joined kind drive → giữ chỗ", async () => {
  const a = await makeKind('drive', n => n - 1);
  lobby3(a.t, [0, 1, 2, 3, 4], [0, 1, 2, 3, 4], [0, 1, 2, 3, 4]);
  assert.equal(a.s.phase, 'watching'); assert.equal(a.s.watched, 4); assert.equal(a.s.invite, false);
  lobby3(a.t, [0, 1, 2, 3, 4], [0, 1, 2, 3, 4], [1, 4]);
  assert.equal(a.s.watched, 4); assert.equal(a.s.invite, true);
  const b = await makeKind('drive');
  lobby3(b.t, [0, 1, 2, 3, 4], [0, 1, 2, 3, 4], [2]);
  assert.equal(b.s.phase, 'lobby'); assert.deepEqual(b.s.peers.map(f => f.slot), [2]);
  assert.equal(b.s.flyers.length, 5); assert.equal(b.s.walkers.length, 5); assert.equal(b.s.drivers.length, 1);
  b.s.join('An'); assert.deepEqual(b.t.sent.at(-1), { t: 'join', name: 'An', kind: 'drive' });
  b.t.onMessage({ t: 'joined', slot: 0, kind: 'drive' });
  assert.equal(b.s.phase, 'flying'); assert.equal(b.s.mySlot, 0);
  lobby3(b.t, [], [], [0, 2]); b.s.leave();
  assert.equal(b.s.phase, 'watching'); assert.equal(b.s.watched, 2, 'rời chỗ: không xem chính mình');
});

test('sendDrive chỉ gửi khi đang giữ chỗ; gói có v, st, ts, không có bank / pose', async () => {
  const { t, s } = await makeKind('drive');
  lobby3(t, [], [], []);
  s.sendDrive({ x: 1, y: 2.6, z: 3, yaw: 0.5, v: 10, st: 0.1 }); assert.equal(t.sent.length, 0);
  s.join('An'); t.onMessage({ t: 'joined', slot: 1, kind: 'drive' }); t.sent.length = 0;
  s.sendDrive({ x: -230, y: 2.6, z: 17.4, yaw: 0.5, v: -3, st: -0.2, ts: 1234 });
  assert.deepEqual(t.sent, [{ t: 'pos', x: -230, y: 2.6, z: 17.4, yaw: 0.5, v: -3, st: -0.2, ts: 1234 }]);
  s.sendDrive({ x: 0, y: 2.6, z: 0, yaw: 0, v: 0, st: 0 });
  const m = t.sent.at(-1);
  assert.equal(typeof m.ts, 'number'); assert.ok(Number.isFinite(m.ts), 'không truyền ts: tự đóng dấu giờ gửi');
  assert.equal('bank' in m, false); assert.equal('pose' in m, false);
});

test('nhận nhóm d thì cập nhật peersDrive; gói không có d không gọi; f / w như trước', async () => {
  const { t, s } = await makeKind('fly');
  lobby3(t, [0], [], [3]);
  assert.deepEqual(s.drivers, [{ slot: 3, name: 'P3' }]);
  let f: any = null, w: any = null, d: any = null;
  s.onPos = x => { f = x; }; s.onWalkPos = x => { w = x; }; s.peersDrive = x => { d = x; };
  const e = [3, 10, 2.6, 0, 1, 5, -0.2, 777];
  t.onMessage({ t: 'pos', f: [], d: [e] });
  assert.deepEqual(d, [e]); assert.deepEqual(f, []); assert.equal(w, null);
  d = null; t.onMessage({ t: 'pos', f: [[0, 0, 50, 0, 0, 0, 5]], w: [[0, 1, 3, 0, 0, 1, 5]] });
  assert.equal(d, null); assert.equal(w.length, 1);
  t.onMessage({ t: 'pos', f: [], d: 'rác' }); assert.equal(d, null, 'd không phải mảng: bỏ qua');
  t.onClose(); assert.deepEqual(s.drivers, [], 'mất kết nối: xóa danh sách người lái');
});

test("kind 'drive' gặp lobby không có drivers (máy chủ main có walkers, hoặc bản cũ hơn) → solo, offline, transport đóng, không gửi join", async () => {
  for (const msg of [{ t: 'lobby', flyers: fl(0), walkers: fl(1) }, { t: 'lobby', flyers: fl(0) }]) {
    const { t, s } = await makeKind('drive');
    let changes = 0; s.onChange = () => { changes++; };
    t.onMessage(msg);
    assert.equal(s.phase, 'solo'); assert.equal(s.notice, 'offline'); assert.equal(t.closed, true); assert.equal(changes, 1);
    t.onClose(); assert.equal(s.notice, 'offline');
    s.join('An'); s.sendDrive({ x: 0, y: 2.6, z: 0, yaw: 0, v: 0, st: 0 }); s.heartbeat();
    assert.equal(t.sent.length, 0);
  }
});

test("kind 'drive': join trước khi nhận lobby đầu không gửi gì (chưa biết máy chủ có hiểu drive không)", async () => {
  const { t, s } = await makeKind('drive');
  s.join('An'); assert.equal(t.sent.length, 0);
  lobby3(t, [], [], []); s.join('An');
  assert.deepEqual(t.sent, [{ t: 'join', name: 'An', kind: 'drive' }]);
});

/* ===== Tương thích hai chiều bằng mã THẬT của nhánh main (Review Focus 4) =====
   Chép session / protocol / params / client của khách và room / badwords của máy chủ từ `git show main:…` ra thư mục tạm ngoài repo,
   nạp động, nối thẳng với mã mới qua transport giả (không mạng). Thư mục tạm bị xóa khi xong. */

const repo = pjoin(dirname(fileURLToPath(import.meta.url)), '..', '..');
const MAIN_FILES = ['src/explore/multi/session.ts', 'src/explore/multi/protocol.ts', 'src/explore/multi/params.ts', 'src/explore/multi/client.ts',
  'server/multi/src/room.ts', 'server/multi/src/badwords.ts'];
/* PRE_DRIVE: main trước D-034 (máy chủ / khách chưa biết lái xe). Từ khi D-034 đã merge, `main` biết lái xe nên hai test "máy chủ / khách trước lái xe" ghim commit này
   (D-040 Task 10: test vốn đọc `main` và trượt sau khi main có D-034; kỳ vọng giữ nguyên). `main` hiện là máy chủ / khách trước xe máy (biết drive, chưa biết veh) */
const PRE_DRIVE = '854db54';
const mainDirs = new Map<string, string>();
function mainCode(ref = 'main'): string {
  const hit = mainDirs.get(ref);
  if (hit) return hit;
  const dir = mkdtempSync(pjoin(tmpdir(), 'danang-main-'));
  for (const f of MAIN_FILES) {
    const src = execFileSync('git', ['show', ref + ':' + f], { cwd: repo, encoding: 'utf8' });
    mkdirSync(dirname(pjoin(dir, f)), { recursive: true });
    writeFileSync(pjoin(dir, f), src);
  }
  mainDirs.set(ref, dir);
  return dir;
}
after(() => { for (const d of mainDirs.values()) rmSync(d, { recursive: true, force: true }); });
const mainImport = (f: string, ref = 'main') => import(pathToFileURL(pjoin(mainCode(ref), f)).href);

/* Nối một phiên (khách) với một SkyRoom (máy chủ) trong cùng tiến trình: tin đi qua JSON như thật; 'all' tới mọi khách đang nối */
function wire(room: any) {
  const peers = new Map<string, Fake>();
  let n = 0;
  const deliver = (outs: any[]) => { for (const o of outs) for (const [id, t] of peers) if (o.to === 'all' || o.to === id) t.onMessage(JSON.parse(JSON.stringify(o.msg))); };
  const clock = { now: 1000 };
  return {
    clock,
    connect: (): Promise<Transport> => {
      const id = 'c' + n++;
      const t = new Fake();
      t.send = (m: any) => { t.sent.push(m); deliver(room.message(id, JSON.stringify(m), clock.now)); };
      t.close = () => { t.closed = true; peers.delete(id); deliver(room.disconnect(id)); };
      peers.set(id, t);
      setTimeout(() => deliver(room.connect(id, clock.now) ?? []), 0);   // sau khi phiên gắn onMessage (như WebSocket thật)
      return Promise.resolve(t);
    },
    raw: (id: string, m: any) => room.message(id, JSON.stringify(m), clock.now)
  };
}
const tick = () => new Promise(r => setTimeout(r, 0));

test('máy chủ cũ thì lái một mình: phiên drive mới gặp room.ts của main → solo / offline, không chiếm slot bay nào', async () => {
  const { SkyRoom: OldRoom } = await mainImport('server/multi/src/room.ts', PRE_DRIVE);
  // Bằng chứng mối nguy: room.ts của main coi join kind 'drive' là join BAY (chỉ so m.kind === 'walk') → chiếm một chỗ bay
  const probe = new OldRoom(); probe.connect('x', 0);
  const pj = probe.message('x', JSON.stringify({ t: 'join', name: 'Lai', kind: 'drive' }), 0);
  assert.deepEqual(pj[0].msg, { t: 'joined', slot: 0 }, 'main nhận người lái vào nhóm bay (vì vậy khách mới không được gửi join drive cho nó)');
  assert.equal(probe.slotOf('x'), 0);
  // Phiên drive mới với máy chủ main: lobby đầu không có drivers → đi một mình, không gửi join
  const room = new OldRoom();
  const w = wire(room);
  const flyer = new MultiSession(w.connect, () => 0, 'fly');
  flyer.open(); await tick();
  const s = new MultiSession(w.connect, () => 0, 'drive');
  let changes = 0; s.onChange = () => { changes++; };
  s.open(); await tick();
  assert.equal(s.phase, 'solo'); assert.equal(s.notice, 'offline'); assert.ok(changes >= 1);
  s.join('Lai'); s.sendDrive({ x: 0, y: 2.6, z: 0, yaw: 0, v: 5, st: 0 }); s.heartbeat();
  assert.equal(room.slotOf('c1'), -1, 'người lái không chiếm chỗ bay của main');
  assert.equal(room.hasFlyers(), false);
  // người bay mới với máy chủ main vẫn bay bình thường
  assert.equal(flyer.phase, 'lobby'); flyer.join('Bay'); await tick();
  assert.equal(flyer.phase, 'flying'); assert.deepEqual(flyer.flyers, [{ slot: 0, name: 'Bay' }]);
});

test('khách cũ bỏ qua nhóm d: session.ts của main (bay và đi dạo) nhận lobby có drivers và pos có d từ máy chủ mới', async () => {
  const { MultiSession: OldSession } = await mainImport('src/explore/multi/session.ts', PRE_DRIVE);
  const room = new SkyRoom();
  const w = wire(room);
  const oldFly = new OldSession(w.connect, () => 0, 'fly');
  const oldWalk = new OldSession(w.connect, () => 0, 'walk');
  const fGot: any[] = [], wGot: any[] = [];
  oldFly.onPos = (f: any) => fGot.push(f); oldWalk.onWalkPos = (x: any) => wGot.push(x);
  oldFly.open(); oldWalk.open(); await tick();
  const drv = new MultiSession(w.connect, () => 0, 'drive');
  drv.open(); await tick();
  assert.equal(drv.phase, 'lobby', 'phiên drive mới với máy chủ mới: vào sảnh');
  oldFly.join('Bay'); oldWalk.join('Di'); drv.join('Lai'); await tick();
  assert.equal(oldFly.phase, 'flying'); assert.equal(oldWalk.phase, 'flying'); assert.equal(drv.phase, 'flying');
  assert.deepEqual(oldFly.flyers, [{ slot: 0, name: 'Bay' }]); assert.deepEqual(oldFly.walkers, [{ slot: 0, name: 'Di', ch: 0 }]);
  assert.deepEqual(oldWalk.walkers, [{ slot: 0, name: 'Di', ch: 0 }]); assert.deepEqual(oldWalk.peers, [{ slot: 0, name: 'Di', ch: 0 }]);
  assert.deepEqual(drv.drivers, [{ slot: 0, name: 'Lai', ch: 0, veh: 0 }]); assert.deepEqual(drv.flyers, [{ slot: 0, name: 'Bay' }]);   // D-040: drivers kèm ch + veh
  // chỉ người lái cử động: khách cũ nhận gói có d (bỏ qua), f rỗng
  w.clock.now = 2000; drv.sendDrive({ x: 5, y: 2.6, z: 0, yaw: 0, v: 5, st: 0.1, ts: 42 });
  assert.deepEqual(fGot.at(-1), [], 'khách cũ bay: onPos nhận f rỗng như khi chỉ có người đi dạo');
  assert.equal(wGot.length, 0);
  // cả ba cùng cử động
  w.clock.now = 3000; oldFly.sendPos(1, 50, 0, 0, 0, 7);
  assert.equal(fGot.at(-1)[0][1], 1);
  oldWalk.sendWalk(2, 3, 0, 0, 1, 8);   // hãm trong cửa sổ broadcastMs, đi cùng gói sau
  w.clock.now = 3200; drv.sendDrive({ x: 6, y: 2.6, z: 0, yaw: 0, v: 5, st: 0, ts: 9 });
  assert.deepEqual(fGot.at(-1), []); assert.equal(wGot.at(-1)[0][1], 2, 'gói có cả w và d: khách cũ đi dạo đọc w');
  assert.equal(oldFly.phase, 'flying'); assert.equal(oldWalk.phase, 'flying'); assert.equal(oldFly.mySlot, 0);
  // người lái rời đi: lobby mới (có drivers rỗng) khách cũ vẫn đọc đúng
  drv.dispose(); await tick();
  assert.deepEqual(oldFly.flyers, [{ slot: 0, name: 'Bay' }]); assert.deepEqual(oldWalk.walkers, [{ slot: 0, name: 'Di', ch: 0 }]);
});

/* ===== Chọn nhân vật đi dạo (nam / nữ): join kind 'walk' gửi ch; bay và lái không gửi ===== */
test("nhân vật: phiên walk gửi ch đã chọn trong join (cả lần join lại sau khi bị thu chỗ); phiên bay / lái không có ch", async () => {
  const w = await makeKind('walk');
  lobby2(w.t, [], []);
  w.s.ch = 1; w.s.join('Lan');
  assert.deepEqual(w.t.sent.at(-1), { t: 'join', name: 'Lan', kind: 'walk', ch: 1 });
  w.t.onMessage({ t: 'joined', slot: 0, kind: 'walk' }); w.t.onMessage({ t: 'released' });
  assert.equal(w.s.phase, 'watching');
  w.s.join('Lan');   // lời mời: vào lại vẫn đúng nhân vật
  assert.deepEqual(w.t.sent.at(-1), { t: 'join', name: 'Lan', kind: 'walk', ch: 1 });
  const f = await makeKind('fly');
  lobby2(f.t, [], []); f.s.ch = 1; f.s.join('Bay');
  assert.deepEqual(f.t.sent.at(-1), { t: 'join', name: 'Bay' });
});

test('nhân vật: walkers của lobby giữ nguyên ch từ máy chủ; máy chủ cũ không gửi ch thì trường không có (bên vẽ coi là nam)', async () => {
  const w = await makeKind('walk');
  w.t.onMessage({ t: 'lobby', flyers: [], walkers: [{ slot: 0, name: 'A', ch: 0 }, { slot: 1, name: 'B', ch: 1 }, { slot: 2, name: 'Cu' }], drivers: [] });
  assert.deepEqual(w.s.walkers.map(x => x.ch), [0, 1, undefined]);
});

/* ===== Xe máy (D-040 Task 10): phiên drive xin chỗ với veh 1 + ch; máy chủ cũ không vọng veh ⇒ rời chỗ, lái một mình ===== */
test('xe máy: join gửi kind drive, veh 1, ch; ô tô giữ nguyên gói cũ; joined có veh 1 ⇒ giữ chỗ', async () => {
  const b = await makeKind('drive');
  lobby3(b.t, [], [], []);
  b.s.veh = 1; b.s.ch = 1; b.s.join('Xe');
  assert.deepEqual(b.t.sent.at(-1), { t: 'join', name: 'Xe', kind: 'drive', ch: 1, veh: 1 });
  b.t.onMessage({ t: 'joined', slot: 2, kind: 'drive', veh: 1 });
  assert.equal(b.s.phase, 'flying'); assert.equal(b.s.mySlot, 2); assert.equal(b.t.closed, false);
  const c = await makeKind('drive');
  lobby3(c.t, [], [], []); c.s.ch = 1; c.s.join('Oto');
  assert.deepEqual(c.t.sent.at(-1), { t: 'join', name: 'Oto', kind: 'drive' }, 'ô tô: gói như khách cũ');
  c.t.onMessage({ t: 'joined', slot: 0, kind: 'drive' });
  assert.equal(c.s.phase, 'flying', 'ô tô không cần máy chủ vọng veh');
});

test('xe máy: joined kind drive KHÔNG có veh (máy chủ cũ) ⇒ gửi leave, solo / offline, đóng kết nối; ô tô thì không', async () => {
  const { t, s } = await makeKind('drive');
  let changes = 0; s.onChange = () => { changes++; };
  lobby3(t, [], [], []);
  s.veh = 1; s.join('Xe');
  t.onMessage({ t: 'joined', slot: 0, kind: 'drive' });
  assert.deepEqual(t.sent.at(-1), { t: 'leave' }, 'trả chỗ máy chủ cũ vừa cấp (nó coi là ô tô)');
  assert.equal(s.phase, 'solo'); assert.equal(s.notice, 'offline'); assert.equal(s.mySlot, -1); assert.equal(t.closed, true);
  assert.ok(changes >= 1);
  const n = t.sent.length; s.sendDrive({ x: 0, y: 2.6, z: 0, yaw: 0, v: 1, st: 0 }); s.heartbeat();
  assert.equal(t.sent.length, n, 'không gửi gì sau đó');
});

test('xe máy với máy chủ cũ THẬT (room.ts của main, có drivers nhưng không biết veh): lái một mình, chỗ lái được trả', async () => {
  const { SkyRoom: OldRoom } = await mainImport('server/multi/src/room.ts');
  const room = new OldRoom();
  const w = wire(room);
  const s = new MultiSession(w.connect, () => 0, 'drive');
  s.veh = 1; s.ch = 1;
  s.open(); await tick();
  assert.equal(s.phase, 'lobby');
  s.join('Xe'); await tick();
  assert.equal(s.phase, 'solo'); assert.equal(s.notice, 'offline');
  assert.equal(room.hasFlyers(), false, 'máy chủ cũ không còn giữ chỗ lái nào');
});

test('khách cũ THẬT (session.ts của main) lái ô tô với máy chủ mới: vào chỗ như cũ; người đi xe máy hiện trong drivers với veh 1', async () => {
  const { MultiSession: OldSession } = await mainImport('src/explore/multi/session.ts');
  const room = new SkyRoom();
  const w = wire(room);
  const car = new OldSession(w.connect, () => 0, 'drive');
  car.open(); await tick();
  const bike = new MultiSession(w.connect, () => 0, 'drive');
  bike.veh = 1; bike.ch = 1;
  bike.open(); await tick();
  car.join('Oto'); await tick();
  bike.join('Xe'); await tick();
  assert.equal(car.phase, 'flying'); assert.equal(bike.phase, 'flying');
  assert.deepEqual(car.drivers, [{ slot: 0, name: 'Oto', ch: 0, veh: 0 }, { slot: 1, name: 'Xe', ch: 1, veh: 1 }]);
  assert.deepEqual(bike.drivers, car.drivers);
  w.clock.now = 2000; bike.sendDrive({ x: 5, y: 2.6, z: 0, yaw: 0, v: 5, st: 0.4, ts: 1 });
  assert.equal(room.vehOf('c1'), 1);
});

/* ===== Xe máy nhiều người: hình xe người khác theo veh (src/explore/multi/remoteDrive.ts) =====
   Node, không GPU. drivers có veh 1 ⇒ xe máy (BkBike trong exDrivers.bikes) thay vì DrCar (drCars); đổi veh của một slot ⇒ gỡ hình cũ.
   Xe máy người khác (D-040, sửa theo yêu cầu người dùng 2026-11-14): hình tạm (xe + người khối) tới khi scooter.glb và nhân vật người đó chọn (ch) nạp xong,
   rồi đổi sang xe thật + người lái có xương. Bộ nạp giả: bkModelSetLoader (cảnh giả cùng cấu trúc scooter.glb), exDrivers.__setRiderLoader (nhân vật giả theo ch). */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { drCarSetLoader } from '../../src/explore/drive/car.ts';
import { drCars } from '../../src/explore/drive/cars.ts';
import { exDrivers } from '../../src/explore/multi/remoteDrive.ts';
import { bkLeanToWire } from '../../src/explore/multi/protocol.ts';
import { multiParams as P } from '../../src/explore/multi/params.ts';
import { bkModelSetLoader } from '../../src/explore/bike/model.ts';
import type { StRigSource } from '../../src/explore/stroll/rig.ts';
import { fakeBike, fakeSource } from '../bike-unit/fakes.ts';

const carNodes = () => drCars.group.children.filter((c) => c.name === 'drive-car');
const bikeNodes = () => exDrivers.bikes.children.filter((c) => c.name === 'bike');
function fresh(): void { exDrivers.clear(); drCars.clear(); drCarSetLoader(async () => new THREE.Group()); exDrivers.onCars = () => {}; }

test('drivers có veh 1 ⇒ dựng xe máy (không DrCar); onCars báo số ô tô và số xe máy', () => {
  fresh();
  const seen: [number, number][] = []; exDrivers.onCars = (n, b) => seen.push([n, b ?? 0]);
  exDrivers.sync([{ slot: 1, name: 'Xe', veh: 1, ch: 1 }, { slot: 2, name: 'Oto', veh: 0 }, { slot: 3, name: 'Cu' }], -1);
  assert.equal(carNodes().length, 2, 'ô tô: slot 2 và khách cũ (không veh) ở slot 3');
  assert.equal(bikeNodes().length, 1);
  assert.deepEqual(seen.at(-1), [2, 1]);
  assert.equal(exDrivers.vehOf(1), 1); assert.equal(exDrivers.vehOf(2), 0); assert.equal(exDrivers.vehOf(3), 0);
  exDrivers.sync([], -1);
  assert.equal(bikeNodes().length, 0); assert.deepEqual(seen.at(-1), [0, 0]);
});

test('đổi veh của một slot ⇒ gỡ hình cũ, dựng hình mới; slot của mình không có xe máy', () => {
  fresh();
  exDrivers.sync([{ slot: 1, name: 'An', veh: 0 }], -1);
  assert.equal(carNodes().length, 1); assert.equal(bikeNodes().length, 0);
  exDrivers.sync([{ slot: 1, name: 'An', veh: 1 }], -1);
  assert.equal(carNodes().length, 0, 'ô tô cũ đã gỡ'); assert.equal(bikeNodes().length, 1);
  const first = bikeNodes()[0];
  exDrivers.sync([{ slot: 1, name: 'An', veh: 0 }], -1);
  assert.equal(carNodes().length, 1); assert.equal(bikeNodes().length, 0, 'xe máy cũ đã gỡ');
  assert.equal(first.parent, null);
  exDrivers.sync([{ slot: 0, name: 'Toi', veh: 1 }, { slot: 1, name: 'An', veh: 1 }], 0);
  assert.equal(bikeNodes().length, 1, 'slot của mình (0) không dựng hình người khác');
  exDrivers.clear();
  assert.equal(bikeNodes().length, 0); assert.equal(carNodes().length, 0);
});

const tick = () => new Promise((r) => setTimeout(r, 0));
const ticks = async (n = 4) => { for (let i = 0; i < n; i++) await tick(); };
interface Defer<T> { p: Promise<T>; done: (v: T) => void }
function defer<T>(): Defer<T> { let done!: (v: T) => void; const p = new Promise<T>((r) => { done = r; }); return { p, done }; }
/* Nạp giả: xe chờ tới khi gọi bike.done, nhân vật theo ch chờ tới khi gọi char(ch).done; asked ghi các ch đã xin */
function loaders(): { bike: Defer<THREE.Object3D>; char: (ch: number) => Defer<StRigSource | null>; asked: number[] } {
  const bike = defer<THREE.Object3D>(), chars = new Map<number, Defer<StRigSource | null>>(), asked: number[] = [];
  const char = (ch: number): Defer<StRigSource | null> => { let d = chars.get(ch); if (!d) { d = defer<StRigSource | null>(); chars.set(ch, d); } return d; };
  bkModelSetLoader(() => bike.p);
  exDrivers.__setRiderLoader((ch: number) => { asked.push(ch); return char(ch).p; });
  return { bike, char, asked };
}
function unload(): void { exDrivers.clear(); bkModelSetLoader(null); exDrivers.__setRiderLoader(null); }
const charSrc = (ch: number): StRigSource => { const s = fakeSource(); s.scene.userData.ch = ch; return s; };
/* Gửi mẫu vị trí cho slot rồi chạy khung tới khi có mẫu nội suy */
let clock = 0;
function drive(slot: number, lean = 0): void {
  const st = bkLeanToWire(lean);
  for (let k = 0; k < 12; k++) { const ts = clock + k * 1000 / P.sendHz; exDrivers.onPos([[slot, 100 + k, 2.6, 5, 0, 10, st, ts]], ts); }
  for (let t = clock + 600; t <= clock + 2400; t += 20) exDrivers.update(t, 0.02);
  clock += 3000;
}
const riderCh = (g: THREE.Object3D): number | null => { const r = g.getObjectByName('bike-rider-body'); return r ? (r.userData.ch as number) : null; };

test('xe máy người khác: hình tạm khi chưa nạp, ẩn tới khi có mẫu, nghiêng theo st / BK_WIRE', async () => {
  fresh(); const L = loaders();
  exDrivers.sync([{ slot: 4, name: 'Xe', veh: 1, ch: 0 }], -1);
  const g = bikeNodes()[0];
  assert.equal(g.visible, false, 'chưa có mẫu thì chưa hiện');
  const lean = 0.4;
  drive(4, lean);
  assert.equal(g.visible, true);
  const s = exDrivers.slotState(4)!;
  assert.ok(s && Math.abs(s.v - 10) < 1e-6);
  const roll = g.children.find((c) => c.type === 'Group')!;   // nút cuộn lean của BkBike
  assert.ok(Math.abs(roll.rotation.x + lean) < 1e-6, 'cuộn = −lean ' + roll.rotation.x);
  assert.equal(exDrivers.debug(4)!.real, false, 'chưa nạp: hình tạm');
  assert.ok(g.getObjectByName('bike-temp'), 'hình tạm (xe + người khối)');
  assert.ok(Math.abs(g.position.y - 2.6) < 1e-6);
  L.bike.done(fakeBike()); await ticks();   // xong lượt nạp (bộ đếm giờ quá hạn của bkModelLoad được hủy)
  unload();
});

test('veh 1, ch 1: nạp xong ⇒ xe thật + người lái nhân vật 1 ở đúng chỗ (không về gốc, không khung trống); người lái nạp lỗi ⇒ giữ hình tạm', async () => {
  fresh(); const L = loaders();
  exDrivers.sync([{ slot: 1, name: 'Nu', veh: 1, ch: 1 }], -1);
  drive(1, 0.2);
  assert.deepEqual(L.asked, [1], 'xin đúng nhân vật người đó chọn');
  const before = bikeNodes()[0], pos = before.position.clone();
  L.bike.done(fakeBike()); await ticks();
  exDrivers.update(clock, 0.02);
  assert.equal(exDrivers.debug(1)!.real, false, 'xe xong nhưng người chưa: vẫn hình tạm');
  assert.equal(bikeNodes().length, 1);
  L.char(1).done(charSrc(1)); await ticks();
  exDrivers.update(clock, 0.02);
  const d = exDrivers.debug(1)!;
  assert.equal(d.real, true, 'đổi sang xe thật');
  assert.equal(d.ch, 1);
  assert.equal(bikeNodes().length, 1, 'đúng một hình mỗi slot');
  const g = bikeNodes()[0];
  assert.notEqual(g, before, 'hình mới'); assert.equal(before.parent, null, 'hình tạm đã gỡ');
  assert.equal(g.visible, true);
  const st = exDrivers.slotState(1)!;
  assert.ok(g.position.distanceTo(new THREE.Vector3(st.x, st.y, st.z)) < 1e-6 && g.position.distanceTo(pos) < 20, 'ở đúng chỗ của mẫu khung đổi (không về gốc): ' + g.position.toArray());
  assert.equal(g.getObjectByName('bike-temp'), undefined, 'không còn người khối');
  assert.equal(riderCh(g), 1, 'người lái là nhân vật 1');
  const rider = g.getObjectByName('bike-rider')!;
  assert.equal(rider.visible, true);
  assert.equal(rider.getObjectByName('Bip01_Head')!.scale.x, 1, 'người khác không ẩn đầu (không phải góc nhìn thứ nhất)');
  /* xe máy thứ hai (ch 0) nạp người lái lỗi ⇒ hình tạm, không ném */
  exDrivers.sync([{ slot: 1, name: 'Nu', veh: 1, ch: 1 }, { slot: 2, name: 'Nam', veh: 1, ch: 0 }], -1);
  drive(2);
  L.char(0).done(null); await ticks();
  exDrivers.update(clock, 0.02);
  assert.equal(exDrivers.debug(2)!.real, false, 'nhân vật lỗi: giữ hình tạm');
  assert.equal(exDrivers.debug(1)!.real, true);
  unload();
});

test('đổi ch dựng lại người lái; đổi chủ / clear gỡ hết, không để xe trong nhóm; tay người lái trên tay nắm', async () => {
  fresh(); const L = loaders();
  L.bike.done(fakeBike());
  exDrivers.sync([{ slot: 3, name: 'An', veh: 1, ch: 0 }], -1);
  drive(3);
  L.char(0).done(charSrc(0)); await ticks();
  exDrivers.update(clock, 0.02);
  assert.equal(riderCh(bikeNodes()[0]), 0);
  exDrivers.sync([{ slot: 3, name: 'An', veh: 1, ch: 1 }], -1);
  assert.equal(riderCh(bikeNodes()[0]), null, 'đổi ch: người cũ gỡ ngay');
  drive(3);
  L.char(1).done(charSrc(1)); await ticks();
  exDrivers.update(clock, 0.02);
  const g = bikeNodes()[0];
  assert.equal(bikeNodes().length, 1);
  assert.equal(riderCh(g), 1, 'người lái theo ch mới');
  assert.deepEqual(L.asked, [0, 1]);
  /* tay trên tay nắm (IK chung với xe của mình) */
  g.updateMatrixWorld(true);
  const pa = g.getObjectByName('grip_l')!.getWorldPosition(new THREE.Vector3()), ph = g.getObjectByName('Bip01_L_Hand')!.getWorldPosition(new THREE.Vector3());
  assert.ok(pa.distanceTo(ph) < 0.2, 'tay trái gần tay nắm: ' + pa.distanceTo(ph).toFixed(3));
  exDrivers.sync([{ slot: 3, name: 'Khac', veh: 1, ch: 1 }], -1);
  assert.equal(bikeNodes().length, 1); assert.equal(g.parent, null, 'đổi chủ: hình cũ gỡ');
  exDrivers.clear();
  assert.equal(bikeNodes().length, 0, 'clear: không còn xe máy trong nhóm');
  assert.equal(exDrivers.bikes.children.length, 0);
  unload();
});

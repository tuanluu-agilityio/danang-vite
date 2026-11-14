/* ===== Xe máy nhiều người: hình xe người khác theo veh (src/explore/multi/remoteDrive.ts) =====
   Node, không GPU. drivers có veh 1 ⇒ xe máy (BkBike hình tạm rẻ, trong exDrivers.bikes) thay vì DrCar (drCars); đổi veh của một slot ⇒ gỡ hình cũ. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { CONFIG } from '../../src/config.ts';
import { drCarSetLoader } from '../../src/explore/drive/car.ts';
import { drCars } from '../../src/explore/drive/cars.ts';
import { exDrivers } from '../../src/explore/multi/remoteDrive.ts';
import { bkLeanToWire } from '../../src/explore/multi/protocol.ts';
import { multiParams as P } from '../../src/explore/multi/params.ts';

const carNodes = () => drCars.group.children.filter((c) => c.name === 'drive-car');
const bikeNodes = () => exDrivers.bikes.children.filter((c) => c.name === 'bike');
const meshCount = (o: THREE.Object3D) => { let n = 0; o.traverse((c) => { if ((c as THREE.Mesh).isMesh && c.visible) n++; }); return n; };
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

test('xe máy người khác: ẩn tới khi có mẫu, nghiêng theo st / BK_WIRE, rẻ (≤ 4 lưới hiện = ≤ 4 lệnh vẽ, cả người lái)', () => {
  fresh();
  exDrivers.sync([{ slot: 4, name: 'Xe', veh: 1, ch: 0 }], -1);
  const g = bikeNodes()[0];
  assert.equal(g.visible, false, 'chưa có mẫu thì chưa hiện');
  const lean = 0.4, st = bkLeanToWire(lean);
  for (let k = 0; k < 12; k++) { const ts = k * 1000 / P.sendHz; exDrivers.onPos([[4, 100 + ts / 100, 2.6, 5, 0, 10, st, ts]], ts); }
  for (let t = 600; t <= 2400; t += 20) exDrivers.update(t, 0.02);
  assert.equal(g.visible, true);
  const s = exDrivers.slotState(4)!;
  assert.ok(s && Math.abs(s.v - 10) < 1e-6);
  const roll = g.children.find((c) => c.type === 'Group')!;   // nút cuộn lean của BkBike
  assert.ok(Math.abs(roll.rotation.x + lean) < 1e-6, 'cuộn = −lean ' + roll.rotation.x);
  assert.ok(meshCount(g) <= 4, 'lưới hiện của một xe máy người khác: ' + meshCount(g));
  assert.ok(Math.abs(g.position.y - 2.6) < 1e-6);
  void CONFIG;
});

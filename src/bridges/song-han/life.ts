import * as THREE from 'three';
import { CONFIG } from '../../config';
import { MAT } from '../../core/materials';
import { rng, lerp } from '../../common/math';
import { createTraffic, stepTraffic, type Traffic, type BridgeVehicle } from '../../common/traffic';
import { createBoats } from '../../common/boats';
import { createPeople, type Walker } from '../../common/people';
import { SH, shRoadY } from './profile';
import type { SwingController } from './SwingController';
import type { SongHanBridge } from './SongHanBridge';

/* [life] xe dừng trước barie, người đi bộ, thuyền du lịch, tàu buồm cao chờ mở luồng */
export function shBuildLife(bridge: SongHanBridge) {
  bridge.traffic = createTraffic(bridge, { seed: 2000, x0: -1500, x1: 1480, busColor: 0x2f7fc1,
    lanes: [{ off: SH.lane, n: 26, speed: 11, bike: 0.6, bus: 0.04 }] });
  // thuyền du lịch nối lộ trình Cầu Rồng – Cầu sông Hàn – Cầu Thuận Phước (giữa các làn thuyền chung)
  bridge.boats = createBoats(bridge, [
    { x: 31, z: 700, dir: -1, speed: 3.4, len: 22, w: 7, h: 2.6, cab: 2.9 },
    { x: 41, z: -900, dir: 1, speed: 3.0, len: 18, w: 6.5, h: 2.5, cab: 2.7 }
  ]);
  // người đi bộ: lề cầu (phần cố định) và lề ven sông Bạch Đằng
  const rnd = rng(2903), list: Walker[] = [], zs = SH.hw - SH.sidewalk / 2 - 0.15;
  for (let i = 0; i < 36; i++) {
    const west = i % 2 === 0, lo = west ? -285 : SH.fixedStart + 8, hi = west ? -SH.fixedStart - 8 : 285;
    list.push({ x: lerp(lo, hi, rnd()), z: (rnd() < 0.5 ? -1 : 1) * zs, lo, hi, dir: rnd() < 0.5 ? -1 : 1, speed: 1 + rnd() * 0.5, profile: (x) => shRoadY(x) + 0.25 });
  }
  for (let i = 0; i < 40; i++) list.push({ x: -276 + (rnd() - 0.5) * 18, z: lerp(-420, 420, rnd()), lo: -420, hi: 420, dir: rnd() < 0.5 ? -1 : 1,
    speed: 0.9 + rnd() * 0.5, axis: 'z', profile: () => CONFIG.landY + 0.05 });
  bridge.people = createPeople(bridge, list, bridge.mats.person, 'sh-people', rnd);
  // tàu buồm cao: cột buồm cao hơn tĩnh không, chỉ qua được khi cầu mở (luồng phía Tây)
  const ship = new THREE.Group(); ship.name = 'sh-tall-ship';
  const hull = new THREE.Mesh(new THREE.BoxGeometry(7, 3, 30).translate(0, 1.0, 0), MAT.hull);
  const house = new THREE.Mesh(new THREE.BoxGeometry(5, 2.4, 9).translate(0, 3.7, -6), MAT.boatCabin);
  const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.3, 19, 8).translate(0, 11.5, 2), MAT.lampPole);
  const sailShape = new THREE.Shape([new THREE.Vector2(0, 0), new THREE.Vector2(0, 16), new THREE.Vector2(-9, 0)]);
  const sail = new THREE.Mesh(new THREE.ShapeGeometry(sailShape).rotateY(Math.PI / 2).translate(0, 4, 2.6), bridge.mats.sail);
  ship.add(hull, house, mast, sail);
  for (const o of [hull, house, mast, sail]) o.castShadow = true;
  ship.position.set(-36, 0, -260);
  bridge.life.add(ship);
  bridge.ship = { obj: ship, z: -260, target: -260, dir: 1, speed: 4.5 };
}

/* Xe: như hệ chung, nhưng khi không cho vào nhịp quay thì xếp hàng trước barie */
const before: BridgeVehicle[] = [];          // mảng tạm dùng lại (D-018)
let saved = new Float64Array(0);           // tốc độ gốc (double: trả lại đúng từng bit)
const byDist = (a: BridgeVehicle, b: BridgeVehicle) => Math.abs(a.s) - Math.abs(b.s);
export function shStepTraffic(T: Traffic, dt: number, ctrl: SwingController) {
  const bx = SH.barrierX;
  if (!ctrl.allowEntry) {
    for (const dir of [1, -1]) {
      before.length = 0;
      for (const v of T.list) if (v.dir === dir && (dir > 0 ? v.s < -bx : v.s > bx)) before.push(v);
      before.sort(byDist);
      before.forEach((v, r) => { v.hold = bx + 3 + r * 7.5; });
    }
  }
  if (saved.length !== T.list.length) saved = new Float64Array(T.list.length);
  for (let i = 0; i < T.list.length; i++) saved[i] = T.list[i].speed;
  T.list.forEach((v) => {
    if (ctrl.allowEntry || v.hold === undefined) return;
    const stopAt = -v.dir * v.hold, dist = (stopAt - v.s) * v.dir;          // khoảng còn lại tới vị trí dừng
    if (dist <= 0 || (v.dir > 0 ? v.s >= -bx : v.s <= bx)) return;          // đã qua barie thì chạy tiếp
    v.speed = Math.min(v.speed, Math.max(0, dist / Math.max(dt, 1e-3)));
  });
  stepTraffic(T, dt, shRoadY);
  T.list.forEach((v, i) => { v.speed = saved[i]; if (ctrl.allowEntry) delete v.hold; });
}

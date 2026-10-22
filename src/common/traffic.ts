import * as THREE from 'three';
import { MAT } from '../core/materials';
import { shared, weatherFx, vanished } from '../core/shared';
import { rng } from './math';
import type { Profile } from './geometry';

/* ---------- xe cộ dùng chung: kiểu xe, màu, đặt từng phần của xe ---------- */
export type VehicleType = 'car' | 'bus' | 'bike';
export const TYPES: Record<VehicleType, { len: number; h: number; w: number; cl: number; ch: number; cw: number; co: number }> = {
  car: { len: 4.4, h: 0.8, w: 1.8, cl: 2.3, ch: 0.62, cw: 1.6, co: -0.25 },
  bus: { len: 11, h: 2.6, w: 2.5, cl: 10.4, ch: 0.25, cw: 2.3, co: 0 },
  bike: { len: 1.9, h: 0.65, w: 0.6, cl: 0.55, ch: 1.0, cw: 0.45, co: -0.2 }
};
export const CAR_COLORS = [0xf2f2f0, 0xc9cdd1, 0x1d2126, 0xb3262a, 0x2b4f8f, 0x777d83, 0xe8e4d8];
export const BIKE_COLORS = [0xc0272d, 0x1f2a44, 0xe9e9e6, 0x2f7d4f, 0x2a2a2a];

export const _e = new THREE.Euler(), _q = new THREE.Quaternion();
const _o = new THREE.Vector3(), _s = new THREE.Vector3(), _m = new THREE.Matrix4();
export function placePart(mesh: THREE.InstancedMesh, i: number, base: THREE.Vector3, q: THREE.Quaternion, ox: number, oy: number, sx: number, sy: number, sz: number) {
  _o.set(ox, oy, 0).applyQuaternion(q).add(base);
  mesh.setMatrixAt(i, _m.compose(_o, q, _s.set(sx, sy, sz)));
}

/* ---------- hệ xe của từng cầu ---------- */
export interface LaneSpec { off: number; n: number; speed: number; bike?: number; bus?: number }
export interface BridgeVehicle { lane: number; dir: number; type: VehicleType; s: number; speed: number; color: number; hold?: number }
export interface Traffic {
  list: BridgeVehicle[]; x0: number; x1: number;
  body: THREE.InstancedMesh; cabin: THREE.InstancedMesh; head: THREE.InstancedMesh; tail: THREE.InstancedMesh;
}
/* lanes: [{ off (m từ tim cầu), n, speed, bike (tỉ lệ xe máy), bus (tỉ lệ xe buýt) }] — mỗi làn chạy cả hai chiều */
export function createTraffic(bridge: { life: THREE.Group }, { seed, x0, x1, lanes, busColor }: { seed: number; x0: number; x1: number; lanes: LaneSpec[]; busColor: number }): Traffic {
  const rnd = rng(seed), list: BridgeVehicle[] = [];
  for (const dir of [1, -1]) lanes.forEach(({ off, n, speed, bike = 0, bus = 0.08 }) => {
    for (let k = 0; k < n; k++) {
      const r = rnd(), type: VehicleType = r < bike ? 'bike' : r < bus ? 'bus' : 'car';
      list.push({ lane: off, dir, type, s: x0 + (k + rnd() * 0.6) * (x1 - x0) / n, speed: speed * (0.85 + rnd() * 0.3),
        color: type === 'bike' ? BIKE_COLORS[k % BIKE_COLORS.length] : type === 'bus' ? busColor : CAR_COLORS[Math.floor(rnd() * CAR_COLORS.length)] });
    }
  });
  const box = new THREE.BoxGeometry(1, 1, 1);
  const T: Traffic = {
    list, x0, x1,
    body: new THREE.InstancedMesh(box, MAT.vehicle, list.length),
    cabin: new THREE.InstancedMesh(box, MAT.glass, list.length),
    head: new THREE.InstancedMesh(box, MAT.headLamp, list.length),
    tail: new THREE.InstancedMesh(box, MAT.tailLamp, list.length)
  };
  const col = new THREE.Color();
  list.forEach((v, i) => T.body.setColorAt(i, col.setHex(v.color)));
  for (const mm of [T.body, T.cabin, T.head, T.tail]) { mm.frustumCulled = false; mm.instanceMatrix.setUsage(THREE.DynamicDrawUsage); bridge.life.add(mm); }
  T.body.castShadow = true;
  return T;
}
/* closable: có theo lệnh đóng cầu của thời tiết (bão) không; Hầm vượt sông Hàn truyền false (hầm vẫn lưu thông) */
const HIDDEN_M = new THREE.Matrix4().makeScale(0, 0, 0);
export function stepTraffic(T: Traffic, dt: number, profile: Profile, closable = true) {
  const range = T.x1 - T.x0, base = new THREE.Vector3();
  T.list.forEach((v, i) => {
    const ty = TYPES[v.type];
    v.s += v.dir * v.speed * dt; if (v.s > T.x1) v.s -= range; if (v.s < T.x0) v.s += range;
    if (closable && vanished(i, weatherFx.clear)) { for (const mm of [T.body, T.cabin, T.head, T.tail]) mm.setMatrixAt(i, HIDDEN_M); return; }   // đóng cầu (bão): dọn dần xe
    const y = profile(v.s), slope = (profile(v.s + 1) - profile(v.s - 1)) / 2;
    _q.setFromEuler(_e.set(0, v.dir > 0 ? 0 : Math.PI, Math.atan(slope * v.dir), 'YZX'));
    base.set(v.s, y + 0.03, v.dir * v.lane);                 // tọa độ cục bộ của group cầu
    placePart(T.body, i, base, _q, 0, 0.3 + ty.h / 2, ty.len, ty.h, ty.w);
    placePart(T.cabin, i, base, _q, ty.co * ty.len, 0.3 + ty.h + ty.ch / 2, ty.cl, ty.ch, ty.cw);
    placePart(T.head, i, base, _q, ty.len / 2 + 0.04, 0.3 + ty.h * 0.6, 0.1, 0.22, ty.w * 0.8);
    placePart(T.tail, i, base, _q, -ty.len / 2 - 0.04, 0.3 + ty.h * 0.6, 0.1, 0.22, ty.w * 0.8);
  });
  for (const mm of [T.body, T.cabin, T.head, T.tail]) mm.instanceMatrix.needsUpdate = true;
  T.head.visible = T.tail.visible = shared.uNight.value > 0.3;
}

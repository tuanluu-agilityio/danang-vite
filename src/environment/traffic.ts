import * as THREE from 'three';
import { CONFIG } from '../config';
import { scene } from '../core/renderer';
import { MAT } from '../core/materials';
import { windFx, weatherFx, vanished } from '../core/shared';
import { rand } from '../common/math';
import { TYPES, CAR_COLORS, BIKE_COLORS, placePart, _e, _q, type VehicleType } from '../common/traffic';
import { deckY } from '../bridges/dragon/profile';
import { ttlRoadY } from '../bridges/tran-thi-ly/profile';

/* ============================ Xe cộ & thuyền của khu phố quanh Cầu Rồng ============================ */
interface Path { axis: 'x' | 'z'; min: number; max: number; fixed: number; profile?: (x: number) => number; hidden?: boolean }
interface CityVehicle { path: Path; lane: number; dir: number; type: VehicleType; s: number; speed: number; color: number }

export const PATHS: Record<'axis' | 'ttl' | 'bachDang' | 'tranHungDao', Path> = {
  axis: { axis: 'x', min: -1900, max: 1480, fixed: 0, profile: deckY },
  ttl: { axis: 'x', min: -1900, max: 1480, fixed: CONFIG.ttl.z, profile: ttlRoadY, hidden: false }, // 2 làn trong mỗi chiều của Cầu Trần Thị Lý
  bachDang: { axis: 'z', min: -2400, max: 2400, fixed: -299 },
  tranHungDao: { axis: 'z', min: -2200, max: 2400, fixed: 299 }
};
const vehicles: CityVehicle[] = [];
export let vBody: THREE.InstancedMesh, vCabin: THREE.InstancedMesh, vHead: THREE.InstancedMesh, vTail: THREE.InstancedMesh;

export function buildTraffic() {
  const addLane = (path: Path, lane: number, dir: number, count: number, speed: number, mix: { bike: number; bus: number }) => {
    const range = path.max - path.min;
    for (let k = 0; k < count; k++) {
      const r = rand(); const type: VehicleType = r < mix.bike ? 'bike' : r < mix.bike + mix.bus ? 'bus' : 'car';
      vehicles.push({ path, lane, dir, type, s: path.min + (k + rand() * 0.5) * range / count, speed,
        color: type === 'bike' ? BIKE_COLORS[k % BIKE_COLORS.length] : type === 'bus' ? 0xe8b923 : CAR_COLORS[Math.floor(rand() * CAR_COLORS.length)] });
    }
  };
  const lanes = [4.875, 8.625, 12.375];
  for (const dir of [1, -1]) {
    addLane(PATHS.axis, lanes[0], dir, 26, 15, { bike: 0.05, bus: 0.08 });
    addLane(PATHS.axis, lanes[1], dir, 30, 12.5, { bike: 0.3, bus: 0.06 });
    addLane(PATHS.axis, lanes[2], dir, 44, 9.5, { bike: 0.85, bus: 0 });
    for (const [p, n] of [[PATHS.bachDang, 26], [PATHS.tranHungDao, 22]] as [Path, number][]) {
      addLane(p, 3.5, dir, n, 11, { bike: 0.3, bus: 0.05 }); addLane(p, 7.5, dir, n + 10, 8.5, { bike: 0.8, bus: 0 });
    }
    addLane(PATHS.ttl, 4.625, dir, 22, 13, { bike: 0.2, bus: 0.05 }); addLane(PATHS.ttl, 8.375, dir, 30, 9, { bike: 0.8, bus: 0 });
  }
  const n = vehicles.length, box = new THREE.BoxGeometry(1, 1, 1);
  vBody = new THREE.InstancedMesh(box, MAT.vehicle, n);
  vCabin = new THREE.InstancedMesh(box, MAT.glass, n);
  vHead = new THREE.InstancedMesh(box, MAT.headLamp, n);
  vTail = new THREE.InstancedMesh(box, MAT.tailLamp, n);
  const col = new THREE.Color();
  vehicles.forEach((v, i) => { col.setHex(v.color); vBody.setColorAt(i, col); });
  for (const mm of [vBody, vCabin, vHead, vTail]) { mm.frustumCulled = false; mm.instanceMatrix.setUsage(THREE.DynamicDrawUsage); scene.add(mm); }
  vBody.castShadow = true;
}
const HIDDEN_M = new THREE.Matrix4().makeScale(0, 0, 0);
const _p = new THREE.Vector3();
export function updateTraffic(dt: number) {
  vehicles.forEach((v, i) => {
    const P = v.path, range = P.max - P.min, T = TYPES[v.type];
    if (P.hidden) { for (const mm of [vBody, vCabin, vHead, vTail]) mm.setMatrixAt(i, HIDDEN_M); return; } // làn tắt bằng nút bật/tắt
    v.s += v.dir * v.speed * dt;
    if (v.s > P.max) v.s -= range; if (v.s < P.min) v.s += range;
    if ((P === PATHS.axis || P === PATHS.ttl) && vanished(i, weatherFx.clear)) { for (const mm of [vBody, vCabin, vHead, vTail]) mm.setMatrixAt(i, HIDDEN_M); return; }   // đóng cầu (bão): dọn dần xe trên Cầu Rồng, Trần Thị Lý
    let yaw: number, pitch = 0;
    if (P.axis === 'x') {
      const y = P.profile(v.s), slope = (P.profile(v.s + 1) - P.profile(v.s - 1)) / 2;
      _p.set(v.s, y + 0.02, P.fixed + v.dir * v.lane); yaw = v.dir > 0 ? 0 : Math.PI; pitch = Math.atan(slope * v.dir);
    } else {
      _p.set(P.fixed - v.dir * v.lane, CONFIG.roadY + 0.03, v.s); yaw = v.dir > 0 ? -Math.PI / 2 : Math.PI / 2;
    }
    _q.setFromEuler(_e.set(0, yaw, pitch, 'YZX'));
    const base = _p.clone();
    placePart(vBody, i, base, _q, 0, 0.3 + T.h / 2, T.len, T.h, T.w);
    placePart(vCabin, i, base, _q, T.co * T.len, 0.3 + T.h + T.ch / 2, T.cl, T.ch, T.cw);
    placePart(vHead, i, base, _q, T.len / 2 + 0.04, 0.3 + T.h * 0.6, 0.1, 0.22, T.w * 0.8);
    placePart(vTail, i, base, _q, -T.len / 2 - 0.04, 0.3 + T.h * 0.6, 0.1, 0.22, T.w * 0.8);
  });
  for (const mm of [vBody, vCabin, vHead, vTail]) mm.instanceMatrix.needsUpdate = true;
}

/* Vùng cấm thuyền quanh công trường dìm đốt hầm (Hầm vượt sông Hàn, z ≈ −1700): chỉ có hiệu lực khi on */
export const boatKeepOut = { on: false, z0: -1760, z1: -1640 };

/* Thuyền du lịch dọc sông Hàn */
const boats: { x: number; z: number; dir: number; speed: number; len: number }[] = [];
let bHull: THREE.InstancedMesh, bCabin: THREE.InstancedMesh, bRoof: THREE.InstancedMesh;
export function buildBoats() {
  const lanesX = [-48, -22, 22, 48];
  for (let i = 0; i < 7; i++) boats.push({ x: lanesX[i % 4], z: -2200 + i * 650, dir: lanesX[i % 4] > 0 ? 1 : -1, speed: 3 + rand() * 2, len: 18 + rand() * 10 });
  const box = new THREE.BoxGeometry(1, 1, 1);
  bHull = new THREE.InstancedMesh(box, MAT.hull, boats.length);
  bCabin = new THREE.InstancedMesh(box, MAT.boatCabin, boats.length);
  bRoof = new THREE.InstancedMesh(box, MAT.boatRoof, boats.length);
  for (const mm of [bHull, bCabin, bRoof]) { mm.frustumCulled = false; mm.castShadow = true; scene.add(mm); }
}
export function updateBoats(dt: number, t: number) {
  const q = new THREE.Quaternion(), base = new THREE.Vector3();
  boats.forEach((b, i) => {
    b.z += b.dir * b.speed * dt * (1 - weatherFx.boatAway); if (b.z > 2500) b.z = -2500; if (b.z < -2500) b.z = 2500;   // bão: thuyền chậm dần rồi dừng
    if (boatKeepOut.on && b.z > boatKeepOut.z0 && b.z < boatKeepOut.z1) b.z = b.dir > 0 ? boatKeepOut.z0 : boatKeepOut.z1;
    if (vanished(i, weatherFx.boatAway)) { bHull.setMatrixAt(i, HIDDEN_M); bCabin.setMatrixAt(i, HIDDEN_M); bRoof.setMatrixAt(i, HIDDEN_M); return; }   // về bến: ẩn dần
    q.setFromEuler(_e.set(Math.sin(t * 0.9 + i) * 0.015 * windFx.boatRock, 0, Math.sin(t * 1.1 + i * 2) * 0.02 * windFx.boatRock));   // tròng trành tăng theo gió (mặc định ×1)
    base.set(b.x, 0, b.z);
    const m = new THREE.Matrix4(), s = new THREE.Vector3(), o = new THREE.Vector3();
    bHull.setMatrixAt(i, m.compose(o.set(0, 0.6, 0).applyQuaternion(q).add(base), q, s.set(6.5, 2.6, b.len)));
    bCabin.setMatrixAt(i, m.compose(o.set(0, 3.2, -b.len * 0.05).applyQuaternion(q).add(base), q, s.set(5.4, 2.6, b.len * 0.62)));
    bRoof.setMatrixAt(i, m.compose(o.set(0, 4.7, -b.len * 0.05).applyQuaternion(q).add(base), q, s.set(6.2, 0.35, b.len * 0.7)));
  });
  bHull.instanceMatrix.needsUpdate = bCabin.instanceMatrix.needsUpdate = bRoof.instanceMatrix.needsUpdate = true;
}

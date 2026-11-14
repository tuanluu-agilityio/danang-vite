/* ============================ Lái xe máy: camera góc thứ nhất + trộn với góc thứ ba ============================
   Spec D-040 §7, §17.5.
   - Mắt: một điểm cố định trong hệ thân xe (tâm giữa hai vệt bánh trên mặt đường, mũi +X), không lấy từ xương đầu mỗi khung (tránh rung theo hoạt ảnh).
     index.ts đo một lần khi người lái gắn vào xe (xương đầu ở tư thế ngồi nền + cam1.headEye) rồi gọi bkCamSetEye; chưa có người lái thật thì cam1.eye.
   - Vị trí mắt theo đủ chuyển động thân xe: góc chúi + nhún do giảm xóc, cuộn lean quanh đường chạm đất, dốc pitch, yaw (như model.ts place()),
     cộng dồn (surge, dọc xe) và nhún (bob, đứng). Hướng nhìn thì đầu người giữ thăng bằng: cuộn = lò xo tới rollK · lean, chúi = pitchK · góc chúi giảm xóc,
     cộng dốc, cúi sẵn cam1.tilt và góc nhìn quanh do kéo chuột (yaw / pitch, kẹp, thôi kéo returnAfter giây thì tự về).
   - Lò xo cuộn / nhún / dồn: bậc hai, Euler ẩn, bước con ≤ 1/120 s, dt kẹp cam1.dtMax; nhún và dồn nhân `motion` (prefers-reduced-motion ⇒ motionReduced,
     index.ts chọn), motion = 0 thì tắt hẳn; cuộn giữ (đường chân trời nghiêng là thông tin lái, không phải rung).
   - Đổi góc nhìn: c.view là đích, c.mix đi tuyến tính 0 (thứ nhất) ↔ 1 (thứ ba) trong mixS giây; vị trí + hướng trộn theo smoothstep(mix).
     Góc thứ ba = drCamPlace với CONFIG.bike.cam3, gọi mỗi khung cả khi đang ở góc thứ nhất (trạng thái trễ của nó luôn sẵn: bấm V không giật),
     cuộn thêm c.roll (đích roll3K · lean khi mix = 1). Góc thứ ba có DrCam riêng (c3) cho kéo chuột quay quanh xe; một lúc chỉ một xe máy của mình.
   - fov / near nội suy theo mix (cam1 ↔ cam3); bkCamPlace trả true khi một trong hai đổi để người gọi chạy onResize() (ma trận chiếu).
   Không cấp phát mỗi khung (D-018). */
import * as THREE from 'three';
import { CONFIG } from '../../config';
import { drCamPlace, drCamDrag, type DrCam } from '../drive/camera';
import type { DrNet } from '../drive/net';
import type { BkState } from './motion';

export interface BkCam { view: 1 | 3; mix: number; yaw: number; pitch: number; idle: number; roll: number; rollV: number; bob: number; bobV: number; surge: number; surgeV: number }   // view đích; mix 0 thứ nhất .. 1 thứ ba; yaw / pitch rad nhìn quanh (trái + / lên +); idle s từ lần kéo cuối; roll rad (trái +), bob m (lên +), surge m (trước +) và vận tốc của chúng
export interface BkEye { x: number; y: number; z: number; yaw: number; pitch: number; roll: number }   // m thế giới; yaw rad (quy ước xe: 0 mũi +X); pitch rad (lên +); roll rad (nghiêng trái +)

const C1 = CONFIG.bike.cam1, K3 = CONFIG.bike.cam3, L = CONFIG.bike.body.wheelbase, LEAN_MAX = CONFIG.bike.perf.leanMax, HARD = CONFIG.bike.perf.hardBrake;
const W = 2 * Math.PI * C1.hz;
const fin = (v: number): number => (Number.isFinite(v) ? v : 0);
const clamp = (v: number, a: number, b: number): number => (v < a ? a : v > b ? b : v);

/* Mắt trong hệ thân xe: đo từ người lái (bkCamSetEye) hoặc cam1.eye */
const eyeAt = { fore: C1.eye.fore, up: C1.eye.up };
export function bkCamSetEye(e: { fore: number; up: number } | null): void {
  eyeAt.fore = e ? e.fore : C1.eye.fore; eyeAt.up = e ? e.up : C1.eye.up;
}

const c3: DrCam = { yaw: 0, pitch: 0, idle: 0 };   // góc nhìn quanh của góc thứ ba (drCamDrag)

export function bkCamCreate(): BkCam {
  c3.yaw = 0; c3.pitch = 0; c3.idle = 0;
  return { view: 1, mix: 0, yaw: 0, pitch: 0, idle: 0, roll: 0, rollV: 0, bob: 0, bobV: 0, surge: 0, surgeV: 0 };
}

/* Thuần: tư thế mắt góc thứ nhất từ trạng thái xe + trạng thái camera (lò xo, nhìn quanh) */
export function bkCamEye(s: BkState, c: BkCam, out: BkEye): void {
  const susF = fin(s.susF), susR = fin(s.susR), lean = fin(s.lean), p = fin(s.pitch), yaw = fin(s.yaw);
  const ex = eyeAt.fore - C1.back + fin(c.surge), ey = eyeAt.up;
  /* phần trên lò xo: chúi φ (đầu xuống khi giảm xóc trước nén hơn sau), nhún xuống theo độ lún trung bình */
  const phi = (susR - susF) / L, cp = Math.cos(phi), sp = Math.sin(phi);
  const x0 = ex * cp - ey * sp, y0 = ex * sp + ey * cp - (susF + susR) / 2;
  /* cuộn quanh đường chạm đất (trục X cục bộ): lean > 0 sang trái (−Z cục bộ) */
  const y1 = y0 * Math.cos(lean), z1 = -y0 * Math.sin(lean);
  /* dốc quanh Z, rồi yaw quanh Y */
  const cq = Math.cos(p), sq = Math.sin(p), x2 = x0 * cq - y1 * sq, y2 = x0 * sq + y1 * cq;
  const cy = Math.cos(yaw), sy = Math.sin(yaw);
  out.x = fin(s.x) + x2 * cy + z1 * sy;
  out.y = fin(s.y) + y2 + fin(c.bob);
  out.z = fin(s.z) - x2 * sy + z1 * cy;
  out.yaw = yaw + fin(c.yaw);
  out.pitch = p + C1.pitchK * phi + C1.tilt + fin(c.pitch);
  out.roll = fin(c.roll);
}

/* Lò xo bậc hai một kênh, Euler ẩn (ổn định với mọi h): trả vận tốc mới, người gọi cộng vị trí */
const spr = (x: number, v: number, t: number, h: number): number => (v + h * W * W * (t - x)) / (1 + 2 * C1.damp * W * h + W * W * h * h);

/* Một khung: trộn góc nhìn, góc nhìn quanh tự về, lò xo cuộn / nhún / dồn. motion 0..1 nhân nhún và dồn */
export function bkCamStep(c: BkCam, s: BkState, dt: number, motion: number): void {
  const d = dt > 0 && Number.isFinite(dt) ? dt : 0;
  if (!(d > 0)) return;
  const tgt = c.view === 3 ? 1 : 0;
  c.mix = c.mix < tgt ? Math.min(tgt, c.mix + d / C1.mixS) : Math.max(tgt, c.mix - d / C1.mixS);
  c.idle += d;
  if (c.idle > C1.returnAfter) { const k = Math.exp(-C1.returnRate * d); c.yaw *= k; c.pitch *= k; }
  const m = clamp(fin(motion), 0, 1);
  const tRoll = (C1.rollK + (C1.roll3K - C1.rollK) * c.mix) * clamp(fin(s.lean), -LEAN_MAX, LEAN_MAX);
  const tBob = m * clamp(-C1.bobK * (fin(s.susF) + fin(s.susR)) / 2, -C1.bobMax, C1.bobMax);
  const tSurge = m * C1.surgeMax * clamp(-fin(s.acc) / HARD, -1, 1);   // phanh (acc < 0) ⇒ dồn trước; tăng tốc ⇒ lùi
  const hT = Math.min(d, C1.dtMax), n = Math.ceil(hT * 120), h = hT / n;
  for (let i = 0; i < n; i++) {
    c.rollV = spr(c.roll, c.rollV, tRoll, h); c.roll += h * c.rollV;
    c.bobV = spr(c.bob, c.bobV, tBob, h); c.bob += h * c.bobV;
    c.surgeV = spr(c.surge, c.surgeV, tSurge, h); c.surge += h * c.surgeV;
  }
  c.roll = clamp(c.roll, -LEAN_MAX, LEAN_MAX);
  if (m === 0) { c.bob = 0; c.bobV = 0; c.surge = 0; c.surgeV = 0; }
  else { c.bob = clamp(c.bob, -C1.bobMax, C1.bobMax); c.surge = clamp(c.surge, -C1.surgeMax, C1.surgeMax); }
}

const _eye: BkEye = { x: 0, y: 0, z: 0, yaw: 0, pitch: 0, roll: 0 };
const _e = new THREE.Euler(0, 0, 0, 'YXZ'), _q1 = new THREE.Quaternion(), _q3 = new THREE.Quaternion(), _qr = new THREE.Quaternion(), _p1 = new THREE.Vector3();
const AZ = new THREE.Vector3(0, 0, 1);

/* Đặt camera: trộn thứ nhất ↔ thứ ba theo smoothstep(c.mix); đặt fov + near; trả true khi fov / near đổi (người gọi onResize) */
export function bkCamPlace(camera: THREE.PerspectiveCamera, s: BkState, c: BkCam, net: DrNet, dt: number, snap?: boolean): boolean {
  const t = clamp(fin(c.mix), 0, 1), m = t * t * (3 - 2 * t);
  /* góc thứ ba (luôn chạy để trạng thái trễ sẵn), cuộn thêm quanh trục nhìn */
  drCamPlace(camera, s, c3, net, dt, snap, K3);
  _q3.copy(camera.quaternion).multiply(_qr.setFromAxisAngle(AZ, fin(c.roll)));
  /* góc thứ nhất: camera nhìn −Z cục bộ; yaw xe 0 = mũi +X ⇒ quay quanh Y thêm −π/2 */
  bkCamEye(s, c, _eye);
  _e.set(_eye.pitch, _eye.yaw - Math.PI / 2, _eye.roll, 'YXZ');
  _q1.setFromEuler(_e);
  _p1.set(_eye.x, _eye.y, _eye.z);
  if (m >= 1) camera.quaternion.copy(_q3);
  else if (m <= 0) { camera.position.copy(_p1); camera.quaternion.copy(_q1); }
  else { camera.position.lerpVectors(_p1, camera.position, m); camera.quaternion.slerpQuaternions(_q1, _q3, m); }
  const fov = C1.fov + (K3.fov - C1.fov) * m, near = C1.near + (K3.near - C1.near) * m;
  if (camera.fov === fov && camera.near === near) return false;
  camera.fov = fov; camera.near = near;
  return true;
}

/* Kéo chuột / vuốt: góc thứ nhất nhìn quanh (sang phải ⇒ nhìn phải, xuống ⇒ nhìn xuống, kẹp), góc thứ ba quay quanh xe như ô tô */
export function bkCamDrag(c: BkCam, dx: number, dy: number): void {
  if (c.view === 3) { drCamDrag(c3, dx, dy, K3); return; }
  c.yaw = clamp(c.yaw - fin(dx) * C1.mouse, -C1.yawMax, C1.yawMax);
  c.pitch = clamp(c.pitch - fin(dy) * C1.mouse, C1.pitchMin, C1.pitchMax);
  c.idle = 0;
}

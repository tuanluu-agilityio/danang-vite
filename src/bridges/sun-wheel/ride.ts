import * as THREE from 'three';
import { camera, controls, canvas } from '../../core/renderer';
import { clamp, smooth } from '../../common/math';
import { cam } from '../../views/state';
import { weatherFx } from '../../core/shared';
import { SW, swToWorld } from './profile';
import type { SunWheel } from './SunWheel';

/* ======================================================================
   NGỒI CABIN — camera gắn tâm một cabin, kéo chuột để nhìn quanh (mẫu: lái xe trong hầm).
   Tư thế camera đặt trong SunWheel.update() ngay sau khi vòng quay quay, nên camera và cabin cùng một khung hình (không giật).
   Chuyển chế độ (cam.mode = 'swRide', tắt OrbitControls, thoát) nằm ở views/camera.ts; file này giữ trạng thái và tính tư thế.
   Tour (GĐ7): điểm 4–5 của Tour Vòng quay giữ cam.mode = 'tour' nhưng ride.update() ghi đè tư thế camera sau updateTour() (cùng khung hình), nên đường bay của Tour
   chỉ còn tác dụng lúc vào/ra cabin (trộn mượt hai chiều). `tour` giữ trạng thái; thoát Tour (hoặc đổi góc nhìn giữa chừng) thì trả tốc độ quay cũ.
   Cabin là viên nang một mặt (FrontSide): nhìn từ trong ra thì vỏ bị bỏ, thấy rõ cảnh ngoài. Không thêm mesh, không thêm đèn.
   ====================================================================== */
const R = SW.ride, TR = SW.tour, TAU = Math.PI * 2;
const E = new THREE.Euler(0, 0, 0, 'YXZ'), Q = new THREE.Quaternion(), L = new THREE.Vector3(), P = new THREE.Vector3(), F = new THREE.Vector3();
const T = new THREE.Quaternion(), YQ = new THREE.Quaternion(), U = new THREE.Vector3(), Y_AXIS = new THREE.Vector3(0, 1, 0);
let noteEl: HTMLElement | null = null;

export const swRide = {
  wheel: null as SunWheel | null,
  cabin: 0,            // chỉ số cabin đang ngồi
  yaw: 0,              // rad — xoay thêm quanh trục đứng; 0 = nhìn về Bắc (−Z cục bộ), phía có 4 cầu
  pitch: R.pitch0,     // rad — ngẩng (+) / cúi (−)
  blend: 1,            // 0 → 1: bay từ góc nhìn cũ vào cabin (test đặt 1 để bỏ qua)
  from: { pos: new THREE.Vector3(), quat: new THREE.Quaternion() },
  saved: { pos: new THREE.Vector3(), target: new THREE.Vector3(), maxPolar: Math.PI * 0.495 },   // camera trước khi lên cabin, để trả lại như cũ khi xuống
  active() { return cam.mode === 'swRide' || (cam.mode === 'tour' && this.tour.on); },
  /* Tour Vòng quay: on = camera đang ở cabin; climbing = đang tua nhanh lên đỉnh; out = tiến độ trộn từ cabin về đường bay (−1 = không trộn);
     touched = Tour đã đổi tốc độ quay / kiểu show (cần trả lại khi thoát); prev = tốc độ người dùng chọn trước Tour; onEnd = UI trả kiểu show, ngày/đêm */
  tour: { on: false, climbing: false, out: -1, touched: false, prev: 1, onEnd: null as (() => void) | null },

  /* Gắn công trình và sự kiện kéo chuột (một lần) */
  attach(w: SunWheel) {
    this.wheel = w;
    if (bound) return; bound = true;
    let drag = false, lx = 0, ly = 0;
    canvas.addEventListener('pointerdown', (e) => { if (!this.active()) return; drag = true; lx = e.clientX; ly = e.clientY; canvas.setPointerCapture?.(e.pointerId); });
    canvas.addEventListener('pointermove', (e) => {
      if (!drag || !this.active()) return;
      this.yaw += (e.clientX - lx) * R.lookSpeed; this.pitch = clamp(this.pitch + (e.clientY - ly) * R.lookSpeed, -R.pitchMax, R.pitchMax);   // kéo như "nắm cảnh": kéo phải → quay sang trái
      this.yaw %= TAU; lx = e.clientX; ly = e.clientY;
    });
    const up = (e: PointerEvent) => { drag = false; if (canvas.hasPointerCapture?.(e.pointerId)) canvas.releasePointerCapture(e.pointerId); };
    canvas.addEventListener('pointerup', up); canvas.addEventListener('pointercancel', up);
  },

  /* Cabin gần sàn lên nhất (đáy vòng quay) tại góc hiện tại */
  boardingCabin() {
    const th = this.wheel.angle(); let best = 0, bd = Infinity;
    for (let i = 0; i < SW.cabins; i++) {
      const a = th + i * SW.cabinStep + Math.PI / 2, d = Math.abs(Math.atan2(Math.sin(a), Math.cos(a)));   // lệch so với −π/2 (đáy)
      if (d < bd) { bd = d; best = i; }
    }
    return best;
  },

  /* Vị trí mắt trong thế giới (tâm cabin + eyeUp) */
  eye(out = new THREE.Vector3()) {
    this.wheel.cabinPose(this.cabin, L, T);   // có gió thì cabin nghiêng: mắt đi theo tâm cabin và trục lên của nó
    U.set(0, R.eyeUp, 0).applyQuaternion(T);
    return swToWorld(L.x + U.x, L.y + U.y, L.z + U.z, out);
  },

  /* Hướng nhìn thế giới (cabin nghiêng theo gió thì cả tầm nhìn nghiêng theo) */
  look(out = new THREE.Quaternion()) {
    out.setFromEuler(E.set(this.pitch, SW.yaw + this.yaw, 0));
    this.wheel.cabinPose(this.cabin, L, T);
    if (T.w < 1) { YQ.setFromAxisAngle(Y_AXIS, SW.yaw); out.premultiply(T.premultiply(YQ).multiply(YQ.invert())); }   // phép nghiêng cục bộ → thế giới: Yq · T · Yq⁻¹
    return out;
  },

  /* Dòng "vòng quay dừng do bão" chỉ hiện khi đang ngồi cabin và thời tiết đã dừng vòng quay (đổi DOM khi trạng thái đổi) */
  updateNotice() {
    noteEl ||= document.getElementById('swStormNote');
    if (!noteEl) return;
    const show = this.active() && weatherFx.wheelStopped;
    if (noteEl.hidden === show) noteEl.hidden = !show;
  },

  /* Lên cabin: nhớ camera cũ, chọn cabin ở đáy, bay vào */
  begin() {
    // Chốt tư thế mà OrbitControls sẽ hiển thị (kẹp góc cực / khoảng cách, xả quán tính damping) rồi mới nhớ: preset như swFront đặt camera ngoài giới hạn
    // nên khung đầu sau chuyến bay camera bị đẩy lên; nhớ trước khung đó thì khi xuống bay về một chỗ mà OrbitControls lại dời đi.
    const damp = controls.enableDamping; controls.enableDamping = false; controls.update(); controls.enableDamping = damp;
    this.saved.pos.copy(camera.position); this.saved.target.copy(controls.target); this.saved.maxPolar = controls.maxPolarAngle;
    this.from.pos.copy(camera.position); this.from.quat.copy(camera.quaternion);
    this.cabin = this.boardingCabin(); this.yaw = 0; this.pitch = R.pitch0; this.blend = 0;
  },

  /* Tour tới điểm có cờ `sw` (hoặc điểm thường: null). 'ride' lên cabin và tua nhanh; 'top' đã tới đỉnh, quay chậm để ngắm; 'night'/null rời cabin */
  tourPhase(p: 'ride' | 'top' | 'night' | null) {
    const tr = this.tour;
    if (!this.wheel) return;
    if (p && !tr.touched) { tr.touched = true; tr.prev = this.wheel.speedTarget(); }
    if (p === 'ride') { this.tourBoard(); this.wheel.setSpeed(TR.climbSpeed); tr.climbing = true; }
    else if (p === 'top') { if (!tr.on) this.tourBoard(); tr.climbing = false; this.wheel.setSpeed(TR.topSpeed); }
    else if (tr.on) { tr.on = false; tr.climbing = false; tr.out = 0; }   // rời cabin: trộn camera về đường bay
  },
  /* Vào cabin ngay từ tư thế camera hiện tại (do Tour đặt). Không gọi controls.update(): OrbitControls đang tắt, camera thuộc Tour */
  tourBoard() {
    this.from.pos.copy(camera.position); this.from.quat.copy(camera.quaternion);
    this.cabin = this.boardingCabin(); this.yaw = 0; this.pitch = R.pitch0; this.blend = 0;
    this.tour.on = true; this.tour.out = -1;
  },
  /* Thoát Tour (nút Esc, kéo chuột, hết hành trình) hoặc Tour bị bỏ ngang: trả tốc độ quay người dùng chọn và gọi UI trả show/ngày-đêm */
  tourEnd() {
    const tr = this.tour;
    tr.on = false; tr.climbing = false; tr.out = -1;
    if (!tr.touched) return;
    tr.touched = false; this.wheel?.setSpeed(tr.prev); tr.onEnd?.();
  },
  /* Lên đỉnh: bắt đầu giảm tốc khi quãng còn lại bằng quãng phanh (từ tốc độ hiện tại về topSpeed với gia tốc speedAccel) */
  tourClimb() {
    const w = this.wheel, k = w.speedNow(), a = SW.speedAccel;
    const phi = w.angle() + this.cabin * SW.cabinStep, rem = ((Math.PI / 2 - phi) % TAU + TAU) % TAU;   // góc còn lại tới đỉnh (cabin leo ngược chiều kim đồng hồ)
    if (rem <= SW.omega * Math.max(0, k * k - TR.topSpeed ** 2) / (2 * a)) { this.tour.climbing = false; w.setSpeed(TR.topSpeed); }
  },

  /* Mỗi khung (gọi từ SunWheel.update sau advance): đặt camera theo cabin */
  update(dt: number) {
    const tr = this.tour;
    if (!this.wheel) return;
    if (tr.touched && cam.mode !== 'tour') this.tourEnd();   // người xem đổi góc nhìn giữa Tour (setView không gọi exitTour)
    if (tr.on && tr.climbing) this.tourClimb();
    if (tr.out >= 0) {   // vừa rời cabin trong Tour: camera đang là điểm trên đường bay (updateTour vừa đặt), trộn từ cabin về đó
      tr.out += dt / R.enterTime;
      if (tr.out >= 1) tr.out = -1;
      else { this.eye(P); this.look(Q); const k = smooth(tr.out); camera.position.lerpVectors(P, camera.position, k); camera.quaternion.copy(Q).slerp(camera.quaternion, k); }
    }
    if (!this.active()) return;
    this.blend = Math.min(1, this.blend + dt / R.enterTime);
    this.eye(P); this.look(Q);
    if (this.blend < 1) { const k = smooth(this.blend); camera.position.lerpVectors(this.from.pos, P, k); camera.quaternion.copy(this.from.quat).slerp(Q, k); }
    else { camera.position.copy(P); camera.quaternion.copy(Q); }
    // controls.target = điểm phía trước mắt: bóng đổ bám theo và chuyến bay khi xuống xuất phát từ hướng đang nhìn
    controls.target.copy(camera.position).addScaledVector(F.set(0, 0, -1).applyQuaternion(camera.quaternion), 50);
  }
};
let bound = false;

/* ===== Đoạn giới thiệu điện ảnh: chín nhịp trên cảnh thật (D-045) =====
   Mỗi nhịp { enter, update(t, dt), leave }. Nhịp toàn cảnh (welcome, daynight, dragon, swing, finale) đặt camera theo CONFIG.intro.shots dưới cam.mode = 'intro';
   nhịp chế độ (glider, car, bike, walk) gọi start() của chế độ thật và gán `auto` (tự lái), leave gán auto = null rồi stop() (stop() không trả camera: nhịp sau tự đặt).
   Trạng thái nền theo nhịp (ngày / đêm, show.on) do index.ts đặt trước enter(). Cầu sông Hàn: leave của nhịp swing bật cờ "tiễn cầu" (inSee.off), index.ts tiễn tới CLOSED.
   Hàm auto và update không cấp phát (D-018): đầu vào ghi vào đối tượng của chế độ, tư thế camera ghi vào hai mảng dùng lại. */
import { camera, controls } from '../core/renderer';
import { dayNight } from '../core/dayNight';
import { show } from '../bridges/dragon/effects';
import { cam } from '../views/state';
import { explore } from '../explore';
import { stroll } from '../explore/stroll';
import { drive } from '../explore/drive';
import { bike } from '../explore/bike';
import { CONFIG } from '../config';
import { inEase, inPose, inOrbit, type InVec, type InShot } from './shots';
import type { InSceneId } from './timeline';
import type { GliderInput } from '../explore/flight';
import type { DrInput } from '../explore/drive/motion';
import type { BkInput } from '../explore/bike/motion';
import type { StInput } from '../explore/stroll/motion';
import type { SwingController } from '../bridges/song-han/SwingController';

export interface InSceneRun { enter(): void; update(t: number, dt: number): void; leave(): void }

const I = CONFIG.intro, D = I.demo;
const durOf = (id: InSceneId): number => { for (const s of I.scenes) if (s.id === id) return s.dur; return 1; };
const _p: InVec = [0, 0, 0], _t: InVec = [0, 0, 0];   // tư thế camera dùng lại mỗi khung
let ctrl: SwingController | null = null;
let st = 0;                                            // giây trong nhịp hiện tại (hàm auto đọc; update ghi trước khi chế độ chạy)

/* Cờ tiễn Cầu sông Hàn: index.ts chạy mỗi khung (cả sau cleanup) tới khi cầu CLOSED */
export const inSee = { off: false };

export function inScenesInit(c: SwingController): void { ctrl = c; }

/* Camera nhịp toàn cảnh: nội suy shot theo t / dur; cam.mode 'intro' (stop() của chế độ trước đưa về 'orbit') */
function wide(shot: InShot, t: number, dur: number): void {
  inPose(shot, t / dur, _p, _t);
  place();
}
function place(): void {
  camera.position.set(_p[0], _p[1], _p[2]);
  controls.target.set(_t[0], _t[1], _t[2]);
  camera.lookAt(controls.target);
}
function introCam(): void { cam.flight.then = null; cam.mode = 'intro'; controls.enabled = false; }

/* ---------- tự lái (một hàm cho mỗi chế độ, tạo một lần) ---------- */
const gAuto = (inp: GliderInput): void => {
  inp.turn = (st >= D.glider.turnFrom && st <= D.glider.turnTo ? D.glider.turn : 0) as -1 | 0 | 1;
  inp.climb = D.glider.climb as -1 | 0 | 1; inp.throttle = 0;
};
const cAuto = (inp: DrInput): void => { inp.gas = D.car.gas; inp.brake = 0; inp.steer = 0; inp.hand = false; };
const bAuto = (inp: BkInput): void => { inp.gas = D.bike.gas; inp.brake = 0; inp.steer = 0; inp.hard = false; };
let walkYaw = 0;                                       // hướng xuất phát của người đi dạo (đi thẳng theo hướng này, không theo camera)
const wAuto = (inp: StInput): void => { inp.mz = 1; inp.mx = 0; inp.run = D.walk.run; inp.camYaw = walkYaw; };

let fired = false, watered = false, viewed = false, finAng = 0;

export const inScenes: Record<InSceneId, InSceneRun> = {
  welcome: {
    enter() { introCam(); },
    update(t) { wide(I.shots.welcome, t, durOf('welcome')); },
    leave() { /* chỉ camera */ }
  },
  glider: {
    enter() { st = 0; explore.start({ pos: D.glider.pos as InVec, yaw: D.glider.yaw }); explore.auto = gAuto; },
    update(t) { st = t; },
    leave() { explore.auto = null; explore.stop(); }
  },
  car: {
    enter() { st = 0; drive.start(); drive.auto = cAuto; },
    update(t) {
      st = t;
      const c = drive.cam, e = inEase(t / D.car.camYawS);   // như kéo chuột (drCamDrag): lệch yaw / pitch + idle = 0 để camera không tự trả về giữa chừng
      c.yaw = D.car.camYawFrom + (D.car.camYawTo - D.car.camYawFrom) * e; c.pitch = D.car.camPitchFrom * (1 - e); c.idle = 0;
    },
    leave() { drive.auto = null; drive.stop(); }
  },
  bike: {
    enter() {
      st = 0; viewed = false; bike.start();
      const p = D.bike.place; if (p) bike.placeAt(p[0], p[1], p[2]);   // chỗ riêng (cầu Trần Thị Lý) để nhịp xe máy khác nhịp ô tô
      bike.auto = bAuto;
    },
    update(t) { st = t; if (!viewed && t >= D.bike.viewAt) { viewed = true; bike.setView(3); } },
    leave() { bike.auto = null; bike.stop(); }
  },
  walk: {
    enter() { st = 0; stroll.start(); walkYaw = stroll.state ? stroll.state.yaw : 0; stroll.auto = wAuto; stroll.cam.yaw = walkYaw + D.walk.camYawFrom; },
    update(t) { st = t; stroll.cam.yaw = walkYaw + D.walk.camYawFrom * (1 - inEase(t / D.walk.camYawS)); },
    leave() { stroll.auto = null; stroll.stop(); }
  },
  daynight: {
    enter() { introCam(); },
    update(t) {
      const r = I.nightRamp, k = (t - r[0]) / (r[1] - r[0]);
      dayNight.target = k < 0 ? 0 : k > 1 ? 1 : k;
      wide(I.shots.daynight, t, durOf('daynight'));
    },
    leave() { /* đêm giữ nguyên cho nhịp sau */ }
  },
  dragon: {
    enter() { introCam(); fired = false; watered = false; if (show.on) { show.on = false; show.t = 0; } },
    update(t) {
      if (!fired && t >= I.dragon.fireAt) { fired = true; show.on = true; show.t = 0; }      // lửa: chu kỳ thật bắt đầu từ lượt phun đầu
      if (!watered && t >= I.dragon.waterAt) { watered = true; show.on = true; show.t = 27; }   // rút gọn: nhảy sang đoạn phun nước (27–42 s của chu kỳ 48 s)
      wide(I.shots.dragon, t, durOf('dragon'));
    },
    leave() { show.on = false; show.t = 0; }
  },
  swing: {
    enter() {
      introCam();
      const c = ctrl; if (!c) return;
      if (c.state === 'CLOSED') { if (c.canStart()) c.start(I.swingSpeed); }   // bão: canStart sai thì thôi, nhịp vẫn chạy camera
      else { inSee.off = false; c.speed = I.swingSpeed; }                       // cầu chưa về CLOSED (vào lại nhịp): để cầu đi tiếp, OPEN thì giữ mở tới leave
    },
    update(t) { wide(I.shots.swing, t, durOf('swing')); },
    leave() { if (ctrl && ctrl.state !== 'CLOSED') inSee.off = true; }
  },
  finale: {
    enter() { introCam(); finAng = 0; },
    update(t, dt) {
      const dur = durOf('finale');
      inPose(I.shots.finale, t / dur, _p, _t);
      if (t >= dur) { finAng += I.drift * dt; inOrbit(_p, _t, finAng); }   // hết thời lượng: trôi chậm quanh điểm nhìn, chờ người xem bấm
      place();
    },
    leave() { /* chỉ camera */ }
  }
};

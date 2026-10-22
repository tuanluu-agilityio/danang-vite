import * as THREE from 'three';
import { CONFIG } from '../../config';
import { narration } from '../../audio/narration';
import { onChange } from '../../i18n';
import { STORM_TOUR } from '../../views/tourStops';
import { neutralParams, setPreset, type PresetName, type WeatherParams, type WeatherState } from './state';

/* ===== [weather] Kịch bản bão (mục 6): hành trình camera + dòng thời gian, mặc định CONFIG.weather.scenario.duration giây =====
   Mỗi mốc đặt target cộng dồn (từ trạng thái trung tính) rồi để stepWeather tiến dần, đổi chú thích (wxS1…wxS8) và giọng đọc (wxStorm-<mốc>).
   Camera bay liên tục qua STORM_TOUR (views/tourStops.ts) theo đường cong Catmull-Rom mở như Tour (D-013): tới điểm của mốc k ở T_k + arrive·W_k,
   nên chú thích đổi khi camera đang bay tới. Có giọng đọc thì cửa sổ W_k kéo dài cho đọc xong (clip + pad), các mốc sau dời theo.
   Cấm lưu thông / khoá quay / tắt quảng cáo theo `closed` (mốc 60 s), không theo ngưỡng gió ("theo thông báo của thành phố").
   Module không đụng DOM, camera: pose(t) là hàm thuần, views/camera.ts (chế độ 'storm') đọc nó mỗi khung khi `cameraOwned` còn true.
   Người xem kéo chuột / cuộn / Esc / chọn góc nhìn thì UI gọi releaseCamera() — thời tiết vẫn chạy hết (giống exitTour).
   Hết giờ hoặc stop(true): trả preset + thanh cường độ như trước kịch bản (ngày/đêm không bị kịch bản đổi nên giữ nguyên). */
export interface Scenario {
  running: boolean; t: number; speed: number; step: number;               // step: chỉ số mốc đã chạy (−1 = chưa)
  readonly times: number[]; readonly duration: number;                     // thời điểm các mốc, độ dài kịch bản (s), đã kéo dài theo giọng đọc — test giọng đọc kiểm clip đọc xong trước mốc kế
  cameraOwned: boolean;
  on: { caption: (key: string | null, step: number) => void; end: () => void };
  start: (opts?: { speed?: number; from?: { pos: THREE.Vector3; target: THREE.Vector3 } }) => void;   // from: vị trí camera lúc bấm chạy (bay từ đó tới điểm đầu)
  stop: (restore?: boolean) => void;                                       // restore = true (mặc định): trả preset trước kịch bản
  releaseCamera: () => void;
  update: (dt: number) => void;
  pose: (t: number, pos: THREE.Vector3, target: THREE.Vector3) => void;    // vị trí + điểm nhìn camera ở thời điểm t (hàm thuần theo t)
  focus: () => THREE.Vector3;                                              // điểm nhìn của mốc đang chạy (cây đổ quanh đây)
}

/* Đường bay: mọi điểm (kể cả via); knot[k] = chỉ số điểm của mốc k trên đường cong */
const P = STORM_TOUR.map((s) => new THREE.Vector3(...s.pos)), Q = STORM_TOUR.map((s) => new THREE.Vector3(...s.target));
const posCurve = new THREE.CatmullRomCurve3(P, false, 'centripetal'), tgtCurve = new THREE.CatmullRomCurve3(Q, false, 'centripetal');
const knot = STORM_TOUR.map((s, i) => (s.via ? -1 : i)).filter((i) => i >= 0);
const lastU = P.length - 1;

export function createScenario(state: WeatherState, setEnabled: (on: boolean) => void, onEnd: () => void): Scenario {
  const S = CONFIG.weather.scenario, n = S.steps.length;
  if (knot.length !== n) console.warn(`STORM_TOUR có ${knot.length} điểm mốc, kịch bản có ${n} mốc`);
  const base = S.steps.map((s, k) => (k + 1 < n ? S.steps[k + 1].t : S.duration) - s.t);   // cửa sổ gốc mỗi mốc (s)
  const win = [...base], times = S.steps.map((s) => s.t);
  let total = S.duration;
  const from = { pos: P[0].clone(), target: Q[0].clone() };
  /* Kéo dài cửa sổ theo giọng đọc (ngôn ngữ hiện tại), như fitDurations() của Tour */
  const fit = () => {
    for (let k = 0; k < n; k++) { const d = narration.duration('wxStorm', k); win[k] = d === null ? base[k] : Math.max(base[k], d + S.pad); }
    for (let k = 1; k < n; k++) times[k] = times[k - 1] + win[k - 1];
    total = times[n - 1] + win[n - 1];
  };
  /* Mốc + tỉ lệ trong cửa sổ ở thời điểm t */
  const locate = (t: number) => { let k = 0; while (k + 1 < n && t >= times[k + 1]) k++; return { k, f: (t - times[k]) / win[k] }; };
  const arriveAt = (k: number) => times[k] + S.arrive * win[k];
  let saved: { preset: PresetName; intensity: number } | null = null, acc: WeatherParams = neutralParams();
  const sc: Scenario = {
    running: false, t: 0, speed: 1, step: -1, cameraOwned: false,
    get times() { return times; }, get duration() { return total; },
    on: { caption: () => {}, end: () => {} },
    start(opts = {}) {
      if (sc.running) sc.stop(true);
      saved = { preset: state.preset, intensity: state.intensity };
      if (opts.from) { from.pos.copy(opts.from.pos); from.target.copy(opts.from.target); } else { from.pos.copy(P[0]); from.target.copy(Q[0]); }
      acc = neutralParams(); sc.running = true; sc.t = 0; sc.step = -1; sc.speed = opts.speed ?? 1; sc.cameraOwned = true;
      setEnabled(true);
    },
    stop(restore = true) {
      if (!sc.running) return;
      sc.running = false; sc.cameraOwned = false; sc.on.caption(null, -1);
      if (restore && saved) { onEnd(); setPreset(state, saved.preset, saved.intensity); setEnabled(saved.preset !== 'now'); }
      saved = null; sc.on.end();
    },
    releaseCamera() { sc.cameraOwned = false; },
    update(dt) {
      if (!sc.running) return;
      sc.t += dt * sc.speed;
      while (sc.step + 1 < n && sc.t >= times[sc.step + 1]) {
        const st = S.steps[++sc.step];
        Object.assign(acc, st.p);
        Object.assign(state.target, acc, { windDir: state.target.windDir });
        sc.on.caption(st.cap, sc.step);
      }
      if (sc.t >= total) sc.stop(true);
    },
    pose(t, pos, target) {
      const a0 = arriveAt(0);
      if (t < a0) {                                        // bay từ vị trí lúc bấm chạy tới điểm đầu theo vòng cung (đường thẳng có thể xuyên tháp cầu)
        const f = Math.max(0, t) / a0, e = 0.5 - 0.5 * Math.cos(Math.PI * f);
        pos.lerpVectors(from.pos, P[0], e); target.lerpVectors(from.target, Q[0], e);
        pos.y += Math.min(S.entryArc * from.pos.distanceTo(P[0]), S.entryArcMax) * Math.sin(Math.PI * e);
      } else {
        let k = 0; while (k + 1 < n && t >= arriveAt(k + 1)) k++;
        let u = knot[k];
        if (k + 1 < n) {                                   // giữa điểm mốc k và k+1 (đi qua các điểm via giữa chúng), chậm lại ở hai đầu như Tour
          const f = (t - arriveAt(k)) / (arriveAt(k + 1) - arriveAt(k)), e = 0.5 - 0.5 * Math.cos(Math.PI * f);
          u = knot[k] + e * (knot[k + 1] - knot[k]);
        }
        posCurve.getPoint(u / lastU, pos); tgtCurve.getPoint(u / lastU, target);
      }
      pos.y = Math.max(pos.y, 3);                          // đường cong có thể võng xuống: giữ camera trên mặt nước
    },
    focus: () => Q[knot[Math.max(0, sc.step)]]
  };
  /* Giọng bật/tắt, tải xong manifest hoặc đổi ngôn ngữ: tính lại cửa sổ, giữ nguyên vị trí (mốc + tỉ lệ) như syncNarration() của Tour */
  const resync = () => { const { k, f } = locate(sc.t); fit(); if (sc.running) sc.t = times[k] + Math.min(f, 1) * win[k]; };
  narration.onChange(resync); onChange(resync);
  fit();
  return sc;
}

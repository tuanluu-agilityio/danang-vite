import { CONFIG } from '../../config';
import { neutralParams, setPreset, type PresetName, type WeatherParams, type WeatherState } from './state';

/* ===== [weather] Kịch bản bão (mục 6): dòng thời gian CONFIG.weather.scenario.duration giây =====
   Mỗi mốc đặt target cộng dồn (từ trạng thái trung tính) rồi để stepWeather tiến dần; có thể bay camera tới góc nhìn và đổi chú thích (wxS1…wxS8).
   Cấm lưu thông / khoá quay / tắt quảng cáo theo `closed` (mốc 60 s), không theo ngưỡng gió ("theo thông báo của thành phố").
   Module không biết DOM, camera: UI gắn `on.camera` / `on.caption` (ui/weatherUI.ts). Camera chỉ bay khi `cameraOwned` còn true:
   người xem kéo chuột / cuộn / Esc / chọn góc nhìn thì UI gọi releaseCamera() — thời tiết vẫn chạy hết (giống exitTour).
   Hết giờ hoặc stop(true): trả preset + thanh cường độ như trước kịch bản (ngày/đêm không bị kịch bản đổi nên giữ nguyên). */
export interface Scenario {
  running: boolean; t: number; speed: number; step: number;               // step: chỉ số mốc đã chạy (−1 = chưa)
  cameraOwned: boolean;
  on: { camera: (view: string) => void; caption: (key: string | null, step: number) => void; end: () => void };
  start: (opts?: { speed?: number }) => void;
  stop: (restore?: boolean) => void;                                       // restore = true (mặc định): trả preset trước kịch bản
  releaseCamera: () => void;
  update: (dt: number) => void;
}

export function createScenario(state: WeatherState, setEnabled: (on: boolean) => void, onEnd: () => void): Scenario {
  const S = CONFIG.weather.scenario;
  let saved: { preset: PresetName; intensity: number } | null = null, acc: WeatherParams = neutralParams();
  const sc: Scenario = {
    running: false, t: 0, speed: 1, step: -1, cameraOwned: false,
    on: { camera: () => {}, caption: () => {}, end: () => {} },
    start(opts = {}) {
      if (sc.running) sc.stop(true);
      saved = { preset: state.preset, intensity: state.intensity };
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
      while (sc.step + 1 < S.steps.length && sc.t >= S.steps[sc.step + 1].t) {
        const st = S.steps[++sc.step];
        Object.assign(acc, st.p);
        Object.assign(state.target, acc, { windDir: state.target.windDir });
        sc.on.caption(st.cap, sc.step);
        if (st.cam && sc.cameraOwned) sc.on.camera(st.cam);
      }
      if (sc.t >= S.duration) sc.stop(true);
    }
  };
  return sc;
}

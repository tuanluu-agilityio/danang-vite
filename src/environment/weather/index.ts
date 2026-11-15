import type * as THREE from 'three';
import { CONFIG } from '../../config';
import { weatherU, weatherFx } from '../../core/shared';
import { water } from '../../core/water';
import { hrInside } from '../../bridges/han-tunnel/profile';
import { bridgeImpacts, windAt, beaufort } from './impact';
import { applyAtmosphere, buildAtmosphere } from './atmosphere';
import { buildRain, updateRain, type Rain } from './rain';
import { applyWetness, buildWetness, wetMaterials } from './wetness';
import { buildWind, updateWind, swayNow } from './wind';
import { buildLightning, updateLightning, type Lightning } from './lightning';
import { attachSwing, updateHooks } from './effectsHooks';
import { buildSummer, updateSummer } from './summer';
import { buildFallen, fellTrees, standTrees, updateFallen, fallenState, fallenSnapshot } from './fallen';
import { createScenario, type Scenario } from './scenario';
import { updateWeatherSound } from './sound';
import { controls } from '../../core/renderer';
import { createWeatherState, setPreset, presetTarget, stepWeather, windNow, type PresetName, type WeatherParams, type WeatherState } from './state';

/* ===== [weather] Thời tiết — Giai đoạn 7: khí quyển + mưa + mặt ướt + gió + bão (chớp, đóng cầu, khoá quay, dừng trình diễn) + kịch bản bão + nắng hè (ảo ảnh, võng cáp) + cây đổ sau bão + âm thanh =====
   Giữ trạng thái (current/target/wet), nhận preset, ghi weatherU, điều biến khí quyển (atmosphere.ts), mưa (rain.ts, +1 draw call khi mưa),
   mặt ướt (wetness.ts + option `weather` của bridgePatch), gió (wind.ts + option `sway` của bridgePatch, 0 draw call),
   chớp (lightning.ts, +1 draw call lúc nháy), vận hành (effectsHooks.ts: weatherFx cho xe, thuyền, trình diễn, cầu quay, quảng cáo). Preset `now` là no-op, 0 draw call mới.
   Gọi buildWeather() SAU buildRiverfront() (sau mọi rand()); updateWeather() ngay sau applyNight() trong animate(). */
export interface Weather {
  state: WeatherState; enabled: boolean; rain: Rain; lightning: Lightning;
  scenario: Scenario;                                                  // kịch bản bão (UI gắn on.caption; camera chế độ 'storm' đọc pose())
  fallen: { state: typeof fallenState; fell: () => void; stand: () => void; snapshot: typeof fallenSnapshot };   // cây đổ sau bão (API test): fell() đổ ngay quanh điểm nhìn, stand() dựng lại, snapshot() = ma trận thân/tán
  attachSwing: typeof attachSwing;                                     // gán predicate khoá quay cho SwingController (main.ts)
  fx: () => typeof weatherFx;                                          // hệ số vận hành đang áp (xe, thuyền, trình diễn, cầu quay) — cho test
  setPreset: (name: PresetName) => void; setIntensity: (k: number) => void;
  setRainCount: (n: number) => void; wetMaterials: () => THREE.MeshStandardMaterial[];
  impact: () => ReturnType<typeof bridgeImpacts>;
  windAt: (z: number) => number; beaufort: (v?: number) => number;
  setParams: (p: Partial<WeatherParams>, instant?: boolean) => void;   // ghi đè target (test / kịch bản); instant: gán luôn current
  sway: () => ReturnType<typeof swayNow>;                              // biên độ lắc đang hiển thị (m, đã phóng đại)
  /* Chế độ Trực tiếp (D-043, realtime/liveEnv.ts). p: đích từ số liệu thật (envMap.ts), tiến dần theo tau × CONFIG.live.tauScale; không đụng state.preset / intensity
     (lựa chọn mô phỏng được giữ nguyên để trả lại). instant: gán luôn current + mặt ướt (ảnh chụp đầu tiên của phiên).
     null: rời Trực tiếp — tauScale 1, đích về preset mô phỏng đã nhớ, enabled như setPreset (preset `now` ⇒ tắt, no-op). */
  setLive: (p: WeatherParams | null, instant?: boolean) => void;
  readonly live: boolean;
  stopScenario: () => void;                                            // dừng kịch bản bão, không trả preset cũ (như người xem tự chọn preset)
  standTrees: () => void;                                              // dựng lại cây đổ sau bão
}
let current: Weather | null = null;
let live = false;   // chế độ Trực tiếp đang lái thời tiết (setLive)
export const getWeather = () => current;

export function buildWeather(): Weather {
  const state = createWeatherState();
  buildAtmosphere();                       // chụp giá trị gốc (sương, Sky, nước, mây) trước khi áp thời tiết
  buildWetness();                          // đăng ký đường chung; đường các cầu đã registerWet() trong materials.ts của cầu
  const rain = buildRain();                // mesh mưa ẩn, program biên dịch sẵn
  buildSummer();                           // vá shader đường (ảo ảnh); võng cáp qua option `sag` của bridgePatch
  buildFallen();                           // quét cặp thân–tán cây (sau mọi lệnh dựng và dọn cây)
  buildWind();                            // vá shader tán cây; dây đã có option `sway` trong materials.ts của cầu
  const lightning = buildLightning();      // mesh tia chớp ẩn, program biên dịch sẵn
  current = {
    state, enabled: CONFIG.weather.enabled, rain, lightning, attachSwing, fx: () => weatherFx,
    scenario: createScenario(state, (on) => { current.enabled = on; }, standTrees),
    fallen: { state: fallenState, fell: () => fellTrees(controls.target, state.current.windDir), stand: standTrees, snapshot: fallenSnapshot },
    setPreset(name) { setWeatherPreset(name); },
    setIntensity(k) { setWeatherIntensity(k); },
    setRainCount: (n: number) => rain.setCount(n),
    wetMaterials,
    impact: () => bridgeImpacts(state.current),
    windAt: (z: number) => windAt(z, state.current.wind),
    beaufort: (v?: number) => beaufort(v ?? state.current.wind),
    setParams(p, instant = false) { Object.assign(state.target, p); if (instant) Object.assign(state.current, p); current.enabled = true; },
    sway: swayNow,
    setLive(p, instant = false) {
      if (p) {
        live = true; state.tauScale = CONFIG.live.tauScale;
        state.target = { ...p };
        if (instant) { Object.assign(state.current, p); state.wet = p.rain; }
        current.enabled = true;
      } else {
        if (!live) return;
        live = false; state.tauScale = 1;
        state.target = presetTarget(state.preset, state.intensity);
        current.enabled = state.preset !== 'now';
      }
    },
    get live() { return live; },
    stopScenario: () => current.scenario.stop(false),
    standTrees
  };
  return current;
}

export function setWeatherPreset(name: PresetName) {
  if (!current) return;
  current.scenario.stop(false);            // người xem tự chọn: kịch bản dừng, không trả preset cũ
  if (name !== 'now') standTrees();         // rời trạng thái "sau bão"
  setPreset(current.state, name);
  current.enabled = name !== 'now';
}
export function setWeatherIntensity(k: number) {
  if (!current) return;
  current.scenario.stop(false);
  setPreset(current.state, current.state.preset, k);
}

export function updateWeather(dt: number, time: number, night: number, cam: THREE.Camera) {
  if (!current) return;
  const s = current.state;
  current.scenario.update(dt);
  stepWeather(s, dt);
  applyAtmosphere(s, night, dt, live);
  const c = s.current, w = windNow(c, time), wet = s.wet < 1e-3 ? 0 : s.wet;   // dưới ngưỡng: 0 chính xác để nhánh shader ướt không chạy
  applyWetness(wet);
  updateWind(c, w, current.enabled);       // lắc dây/cây, thuyền, lửa, sóng (0 draw call)
  const p = cam.position, blocked = hrInside(p.x, p.y, p.z) || p.y < water.position.y;   // camera trong hầm / dưới mặt nước
  updateRain(dt, c.rain < 1e-3 ? 0 : c.rain, w, c.windDir, blocked);   // tắt mưa trong hầm / dưới mặt nước
  updateLightning(dt, c.lightning, blocked);                          // sau applyAtmosphere: cộng xung hemi / exposure
  updateSummer(c, current.enabled);                                   // võng cáp phóng đại khi nóng
  aftermath(s, dt);                                                   // bão qua đỉnh rồi lặng: cây đổ
  updateFallen(dt);
  updateWeatherSound(dt, c, w, blocked, current.lightning);           // mưa, gió, sấm (Web Audio, chỉ khi người xem bật âm thanh)
  updateHooks(c, dt);                                                // đóng cầu, khoá quay, dừng trình diễn, thuyền về bến, quảng cáo
  weatherU.uWet.value = wet; weatherU.uRain.value = c.rain; weatherU.uWind.value = c.wind; weatherU.uGust.value = Math.max(0, w - c.wind);
  weatherU.uHaze.value = c.haze; weatherU.uSwayK.value = current.enabled ? CONFIG.weather.swayExaggeration : 0;
}

/* Sau bão (mục 4.8): gió hiện tại từng đạt armWind rồi gió đích xuống dưới calmWind (và hết cấm) → cây đổ quanh điểm nhìn.
   Đang chạy kịch bản: đổ quanh điểm nhìn của mốc đang chạy (camera lúc đó còn đang bay tới). Rời trạng thái: hết `hold` giây, gió đích lại tăng, chọn preset khác 'now', hoặc kịch bản kết thúc/dừng. Chưa từng có bão thì không đụng cây. */
let armed = false, afterT = -1;
function aftermath(s: WeatherState, dt: number) {
  const F = CONFIG.weather.fallen, sc = current.scenario;
  if (s.current.wind >= F.armWind) armed = true;
  if (live) { armed = false; if (afterT >= 0) { standTrees(); afterT = -1; } return; }   // Trực tiếp: không hư hại theo số liệu thật (spec §1), không mang "đã có bão" sang Mô phỏng
  if (armed && s.target.wind <= F.calmWind && !s.target.closed) { armed = false; fellTrees(sc.running ? sc.focus() : controls.target, s.current.windDir); afterT = 0; }
  if (afterT >= 0) {
    afterT += dt;
    if (afterT > F.hold || s.target.wind > F.calmWind) { standTrees(); afterT = -1; }
  }
}

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
import { createWeatherState, setPreset, stepWeather, windNow, type PresetName, type WeatherParams, type WeatherState } from './state';

/* ===== [weather] Thời tiết — Giai đoạn 5: khí quyển + mưa + mặt ướt + gió + bão (chớp, đóng cầu, khoá quay, dừng trình diễn) =====
   Giữ trạng thái (current/target/wet), nhận preset, ghi weatherU, điều biến khí quyển (atmosphere.ts), mưa (rain.ts, +1 draw call khi mưa),
   mặt ướt (wetness.ts + option `weather` của bridgePatch), gió (wind.ts + option `sway` của bridgePatch, 0 draw call),
   chớp (lightning.ts, +1 draw call lúc nháy), vận hành (effectsHooks.ts: weatherFx cho xe, thuyền, trình diễn, cầu quay, quảng cáo). Preset `now` là no-op, 0 draw call mới.
   Gọi buildWeather() SAU buildRiverfront() (sau mọi rand()); updateWeather() ngay sau applyNight() trong animate(). */
export interface Weather {
  state: WeatherState; enabled: boolean; rain: Rain; lightning: Lightning;
  attachSwing: typeof attachSwing;                                     // gán predicate khoá quay cho SwingController (main.ts)
  fx: () => typeof weatherFx;                                          // hệ số vận hành đang áp (xe, thuyền, trình diễn, cầu quay) — cho test
  setPreset: (name: PresetName) => void; setIntensity: (k: number) => void;
  setRainCount: (n: number) => void; wetMaterials: () => THREE.MeshStandardMaterial[];
  impact: () => ReturnType<typeof bridgeImpacts>;
  windAt: (z: number) => number; beaufort: (v?: number) => number;
  setParams: (p: Partial<WeatherParams>, instant?: boolean) => void;   // ghi đè target (test / kịch bản); instant: gán luôn current
  sway: () => ReturnType<typeof swayNow>;                              // biên độ lắc đang hiển thị (m, đã phóng đại)
}
let current: Weather | null = null;
export const getWeather = () => current;

export function buildWeather(): Weather {
  const state = createWeatherState();
  buildAtmosphere();                       // chụp giá trị gốc (sương, Sky, nước, mây) trước khi áp thời tiết
  buildWetness();                          // đăng ký đường chung; đường các cầu đã registerWet() trong materials.ts của cầu
  const rain = buildRain();                // mesh mưa ẩn, program biên dịch sẵn
  buildWind();                             // vá shader tán cây; dây đã có option `sway` trong materials.ts của cầu
  const lightning = buildLightning();      // mesh tia chớp ẩn, program biên dịch sẵn
  current = {
    state, enabled: CONFIG.weather.enabled, rain, lightning, attachSwing, fx: () => weatherFx,
    setPreset(name) { setWeatherPreset(name); },
    setIntensity(k) { setWeatherIntensity(k); },
    setRainCount: (n: number) => rain.setCount(n),
    wetMaterials,
    impact: () => bridgeImpacts(state.current),
    windAt: (z: number) => windAt(z, state.current.wind),
    beaufort: (v?: number) => beaufort(v ?? state.current.wind),
    setParams(p, instant = false) { Object.assign(state.target, p); if (instant) Object.assign(state.current, p); current.enabled = true; },
    sway: swayNow
  };
  return current;
}

export function setWeatherPreset(name: PresetName) {
  if (!current) return;
  setPreset(current.state, name);
  current.enabled = name !== 'now';
}
export function setWeatherIntensity(k: number) {
  if (!current) return;
  setPreset(current.state, current.state.preset, k);
}

export function updateWeather(dt: number, time: number, night: number, cam: THREE.Camera) {
  if (!current) return;
  const s = current.state;
  stepWeather(s, dt);
  applyAtmosphere(s, night, dt);
  const c = s.current, w = windNow(c, time), wet = s.wet < 1e-3 ? 0 : s.wet;   // dưới ngưỡng: 0 chính xác để nhánh shader ướt không chạy
  applyWetness(wet);
  updateWind(c, w, current.enabled);       // lắc dây/cây, thuyền, lửa, sóng (0 draw call)
  const p = cam.position, blocked = hrInside(p.x, p.y, p.z) || p.y < water.position.y;   // camera trong hầm / dưới mặt nước
  updateRain(dt, c.rain < 1e-3 ? 0 : c.rain, w, c.windDir, blocked);   // tắt mưa trong hầm / dưới mặt nước
  updateLightning(dt, c.lightning, blocked);                          // sau applyAtmosphere: cộng xung hemi / exposure
  updateHooks(c, dt);                                                 // đóng cầu, khoá quay, dừng trình diễn, thuyền về bến, quảng cáo
  weatherU.uWet.value = wet; weatherU.uRain.value = c.rain; weatherU.uWind.value = c.wind; weatherU.uGust.value = Math.max(0, w - c.wind);
  weatherU.uHaze.value = c.haze; weatherU.uSwayK.value = current.enabled ? CONFIG.weather.swayExaggeration : 0;
}

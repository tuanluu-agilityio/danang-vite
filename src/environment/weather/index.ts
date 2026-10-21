import type * as THREE from 'three';
import { CONFIG } from '../../config';
import { weatherU } from '../../core/shared';
import { water } from '../../core/water';
import { hrInside } from '../../bridges/han-tunnel/profile';
import { bridgeImpacts, windAt, beaufort } from './impact';
import { applyAtmosphere, buildAtmosphere } from './atmosphere';
import { buildRain, updateRain, type Rain } from './rain';
import { applyWetness, buildWetness, wetMaterials } from './wetness';
import { createWeatherState, setPreset, stepWeather, windNow, type PresetName, type WeatherState } from './state';

/* ===== [weather] Thời tiết — Giai đoạn 3: khí quyển + mưa + mặt ướt =====
   Giữ trạng thái (current/target/wet), nhận preset, ghi weatherU, điều biến khí quyển (atmosphere.ts), mưa (rain.ts, +1 draw call khi mưa),
   mặt ướt (wetness.ts + option `weather` của bridgePatch). Chưa có gió/chớp (GĐ4+). Preset `now` là no-op, 0 draw call mới.
   Gọi buildWeather() SAU buildRiverfront() (sau mọi rand()); updateWeather() ngay sau applyNight() trong animate(). */
export interface Weather {
  state: WeatherState; enabled: boolean; rain: Rain;
  setPreset: (name: PresetName) => void; setIntensity: (k: number) => void;
  setRainCount: (n: number) => void; wetMaterials: () => THREE.MeshStandardMaterial[];
  impact: () => ReturnType<typeof bridgeImpacts>;
  windAt: (z: number) => number; beaufort: (v?: number) => number;
}
let current: Weather | null = null;
export const getWeather = () => current;

export function buildWeather(): Weather {
  const state = createWeatherState();
  buildAtmosphere();                       // chụp giá trị gốc (sương, Sky, nước, mây) trước khi áp thời tiết
  buildWetness();                          // đăng ký đường chung; đường các cầu đã registerWet() trong materials.ts của cầu
  const rain = buildRain();                // mesh mưa ẩn, program biên dịch sẵn
  current = {
    state, enabled: CONFIG.weather.enabled, rain,
    setPreset(name) { setWeatherPreset(name); },
    setIntensity(k) { setWeatherIntensity(k); },
    setRainCount: (n: number) => rain.setCount(n),
    wetMaterials,
    impact: () => bridgeImpacts(state.current),
    windAt: (z: number) => windAt(z, state.current.wind),
    beaufort: (v?: number) => beaufort(v ?? state.current.wind)
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
  const p = cam.position;
  updateRain(dt, c.rain < 1e-3 ? 0 : c.rain, w, c.windDir, hrInside(p.x, p.y, p.z) || p.y < water.position.y);   // tắt mưa trong hầm / dưới mặt nước
  weatherU.uWet.value = wet; weatherU.uRain.value = c.rain; weatherU.uWind.value = c.wind; weatherU.uGust.value = Math.max(0, w - c.wind);
  weatherU.uHaze.value = c.haze; weatherU.uSwayK.value = current.enabled ? CONFIG.weather.swayExaggeration : 0;
}

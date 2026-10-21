import { CONFIG } from '../../config';
import { weatherU } from '../../core/shared';
import { bridgeImpacts, windAt, beaufort } from './impact';
import { applyAtmosphere, buildAtmosphere } from './atmosphere';
import { createWeatherState, setPreset, stepWeather, windNow, type PresetName, type WeatherState } from './state';

/* ===== [weather] Thời tiết — Giai đoạn 2: khí quyển =====
   Giữ trạng thái (current/target/wet), nhận preset, ghi weatherU, điều biến khí quyển (atmosphere.ts). Chưa có mưa/gió/chớp (GĐ3+). Preset `now` là no-op, 0 draw call mới.
   Gọi buildWeather() SAU buildRiverfront() (sau mọi rand()); updateWeather() ngay sau applyNight() trong animate(). */
export interface Weather {
  state: WeatherState; enabled: boolean;
  setPreset: (name: PresetName) => void; setIntensity: (k: number) => void;
  impact: () => ReturnType<typeof bridgeImpacts>;
  windAt: (z: number) => number; beaufort: (v?: number) => number;
}
let current: Weather | null = null;
export const getWeather = () => current;

export function buildWeather(): Weather {
  const state = createWeatherState();
  buildAtmosphere();                       // chụp giá trị gốc (sương, Sky, nước, mây) trước khi áp thời tiết
  current = {
    state, enabled: CONFIG.weather.enabled,
    setPreset(name) { setWeatherPreset(name); },
    setIntensity(k) { setWeatherIntensity(k); },
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

export function updateWeather(dt: number, time: number, night = 0) {
  if (!current) return;
  const s = current.state;
  stepWeather(s, dt);
  applyAtmosphere(s, night, dt);
  const c = s.current, w = windNow(c, time);
  weatherU.uWet.value = s.wet; weatherU.uRain.value = c.rain; weatherU.uWind.value = c.wind; weatherU.uGust.value = Math.max(0, w - c.wind);
  weatherU.uHaze.value = c.haze; weatherU.uSwayK.value = current.enabled ? CONFIG.weather.swayExaggeration : 0;
}

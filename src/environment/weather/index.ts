import { CONFIG } from '../../config';
import { weatherU } from '../../core/shared';
import { bridgeImpacts, windAt, beaufort } from './impact';
import { createWeatherState, setPreset, stepWeather, windNow, type PresetName, type WeatherState } from './state';

/* ===== [weather] Thời tiết — Giai đoạn 1: khung rỗng =====
   Giữ trạng thái (current/target/wet), nhận preset, ghi weatherU. CHƯA áp gì lên cảnh: preset `now` và mọi preset đều không đổi ảnh/draw call.
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

export function updateWeather(dt: number, time: number) {
  if (!current) return;
  const s = current.state;
  stepWeather(s, dt);
  const c = s.current, w = windNow(c, time);
  weatherU.uWet.value = s.wet; weatherU.uRain.value = c.rain; weatherU.uWind.value = c.wind; weatherU.uGust.value = Math.max(0, w - c.wind);
  weatherU.uHaze.value = c.haze; weatherU.uSwayK.value = current.enabled ? CONFIG.weather.swayExaggeration : 0;
}

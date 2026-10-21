import { getWeather } from '../environment/weather';
import type { PresetName } from '../environment/weather/state';

/* Thời tiết: chọn preset (Hiện trạng / Nắng hè / Mưa / Gió mùa / Bão) và thanh cường độ 0–100 % */
export function setupWeatherUI() {
  const sel = document.getElementById('weatherSel') as HTMLSelectElement, k = document.getElementById('weatherK') as HTMLInputElement, val = document.getElementById('weatherKVal');
  const showK = () => { val.textContent = `${k.value}%`; };
  sel.addEventListener('change', () => getWeather()?.setPreset(sel.value as PresetName));
  k.addEventListener('input', () => { showK(); getWeather()?.setIntensity(Number(k.value) / 100); });
  showK();
}

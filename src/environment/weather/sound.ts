import { CONFIG } from '../../config';
import { audio } from '../../audio';
import type { Lightning } from './lightning';
import type { WeatherParams } from './state';

/* ===== [weather] Cầu nối âm thanh (mục 7): đẩy mưa/gió/sấm sang audio (Web Audio tổng hợp, không file ngoài) =====
   Chỉ gọi audio.setWeather ~10 lần/giây; tiếng sấm phát khi lightning.stats.count tăng, trễ thunderDelay giây (khoảng cách / 343 m/s), to ∝ 800 m / khoảng cách.
   Audio chưa bật (người xem chưa bấm phát) thì audio bỏ qua; không tạo AudioContext ở đây. */
let acc = 0, lastStrike = 0;

export function updateWeatherSound(dt: number, c: WeatherParams, wind: number, indoors: boolean, lightning: Lightning) {
  const n = lightning.stats.count;
  if (n !== lastStrike) {
    lastStrike = n;
    if (n > 0 && !indoors) audio.thunder(lightning.stats.thunderDelay, Math.min(1.5, CONFIG.weather.lightning.distMin / Math.max(1, lightning.stats.lastDist)));
  }
  acc += dt;
  if (acc < 0.1) return;
  acc = 0;
  const storm = Math.min(c.rain, c.wind / CONFIG.weather.atmosphere.stormWind);
  audio.setWeather(c.rain < 1e-3 ? 0 : c.rain, wind, storm, indoors);
}

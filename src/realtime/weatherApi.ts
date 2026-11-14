/* ===== Đọc số liệu Open-Meteo (D-042) =====
   Thuần hàm, không đụng DOM / mạng. Giờ trong JSON là giờ địa phương Đà Nẵng (timezone=...), trừ utc_offset_seconds ra epoch. */

export type EnvIcon = 'clear-d' | 'clear-n' | 'cloudy-d' | 'cloudy-n' | 'cloud' | 'rain' | 'fog' | 'storm' | 'snow';
export type EnvWeather = { obs: number; obsMin: number; temp: number; feels: number; hum: number; wind: number; dir: number; rain: number; cloud: number; uv: number | null; code: number; isDay: boolean; sunrise: number | null; sunset: number | null };

const ICT_OFFSET_S = 25200;   // s — UTC+7, dùng khi phản hồi không có utc_offset_seconds
const CURRENT = 'temperature_2m,apparent_temperature,relative_humidity_2m,is_day,precipitation,weather_code,cloud_cover,wind_speed_10m,wind_direction_10m,uv_index';

/** Địa chỉ yêu cầu (giữ dấu phẩy trong danh sách biến, mã hóa `/` của múi giờ). */
export function envUrl(cfg: { api: string; lat: number; lon: number; tz: string }): string {
  return cfg.api + '?latitude=' + cfg.lat + '&longitude=' + cfg.lon
    + '&current=' + CURRENT + '&daily=sunrise,sunset'
    + '&timezone=' + encodeURIComponent(cfg.tz) + '&wind_speed_unit=kmh&forecast_days=1';
}

const num = (v: unknown): v is number => typeof v === 'number' && isFinite(v);
const TIME_RE = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/;

/** "2026-11-14T22:15" → { utc: epoch ms nếu coi chuỗi là UTC, min: phút trong ngày } */
function envLocalTime(s: unknown): { utc: number; min: number } | null {
  if (typeof s !== 'string') return null;
  const m = TIME_RE.exec(s);
  if (!m) return null;
  const h = +m[4], mi = +m[5];
  return { utc: Date.UTC(+m[1], +m[2] - 1, +m[3], h, mi), min: h * 60 + mi };
}

/** Phản hồi → số liệu; null khi thiếu giờ quan trắc hoặc số bắt buộc không hữu hạn. UV / mọc / lặn thiếu thì null. */
export function envParse(json: unknown): EnvWeather | null {
  const j: any = json;
  if (!j || typeof j !== 'object') return null;
  const c = j.current;
  if (!c || typeof c !== 'object') return null;
  const t = envLocalTime(c.time);
  if (!t) return null;
  const need = [c.temperature_2m, c.apparent_temperature, c.relative_humidity_2m, c.wind_speed_10m, c.wind_direction_10m, c.precipitation, c.cloud_cover, c.weather_code];
  if (!need.every(num)) return null;
  const off = (num(j.utc_offset_seconds) ? j.utc_offset_seconds : ICT_OFFSET_S) * 1000;
  const sr = envLocalTime(j.daily && j.daily.sunrise && j.daily.sunrise[0]);
  const ss = envLocalTime(j.daily && j.daily.sunset && j.daily.sunset[0]);
  return {
    obs: t.utc - off, obsMin: t.min,
    temp: c.temperature_2m, feels: c.apparent_temperature, hum: c.relative_humidity_2m,
    wind: c.wind_speed_10m, dir: c.wind_direction_10m, rain: c.precipitation, cloud: c.cloud_cover,
    uv: num(c.uv_index) ? c.uv_index : null, code: c.weather_code, isDay: c.is_day === 1 || c.is_day === true,
    sunrise: sr ? sr.min : null, sunset: ss ? ss.min : null
  };
}

/** Kiểm đối tượng (từ bộ nhớ đệm) đúng kiểu EnvWeather: cùng phép kiểm số như envParse. */
export function envIsWeather(x: unknown): x is EnvWeather {
  const o: any = x;
  if (!o || typeof o !== 'object') return false;
  const nn = (v: unknown) => v === null || num(v);
  return [o.obs, o.obsMin, o.temp, o.feels, o.hum, o.wind, o.dir, o.rain, o.cloud, o.code].every(num)
    && nn(o.uv) && nn(o.sunrise) && nn(o.sunset) && typeof o.isDay === 'boolean';
}

/** Mã WMO → khóa i18n + biểu tượng; mã lạ như mã 2 (có mây). */
export function envWx(code: number, isDay: boolean): { key: string; icon: EnvIcon } {
  const dn = isDay ? 'd' : 'n';
  if (code === 0) return { key: isDay ? 'envWxClearD' : 'envWxClearN', icon: ('clear-' + dn) as EnvIcon };
  if (code === 1) return { key: isDay ? 'envWxFewD' : 'envWxFewN', icon: ('cloudy-' + dn) as EnvIcon };
  if (code === 3) return { key: 'envWxOvercast', icon: 'cloud' };
  if (code === 45 || code === 48) return { key: 'envWxFog', icon: 'fog' };
  if (code >= 51 && code <= 57) return { key: 'envWxDrizzle', icon: 'rain' };
  if (code === 61 || code === 66 || code === 80) return { key: 'envWxRainL', icon: 'rain' };
  if (code === 63 || code === 81) return { key: 'envWxRainM', icon: 'rain' };
  if (code === 65 || code === 67 || code === 82) return { key: 'envWxRainH', icon: 'rain' };
  if ((code >= 71 && code <= 77) || code === 85 || code === 86) return { key: 'envWxSnow', icon: 'snow' };
  if (code >= 95 && code <= 99) return { key: 'envWxStorm', icon: 'storm' };
  return { key: 'envWxPartly', icon: ('cloudy-' + dn) as EnvIcon };
}

const COMPASS = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'] as const;

/** Hướng gió (độ, hướng gió thổi TỪ đó tới) → 8 hướng; nhận cả số âm / quá 360. */
export function envCompass(deg: number): 'N' | 'NE' | 'E' | 'SE' | 'S' | 'SW' | 'W' | 'NW' {
  const d = ((deg % 360) + 360) % 360;
  return COMPASS[Math.floor((d + 22.5) / 45) % 8];
}

/** Chỉ số UV → mức; ≤ 0 là '' (không hiện mức). */
export function envUvLevel(uv: number): '' | 'Low' | 'Mod' | 'High' | 'VHigh' | 'Ext' {
  if (!(uv > 0)) return '';
  if (uv < 3) return 'Low';
  if (uv < 6) return 'Mod';
  if (uv < 8) return 'High';
  if (uv < 11) return 'VHigh';
  return 'Ext';
}

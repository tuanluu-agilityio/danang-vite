import { CONFIG } from '../../config';
import { rng } from '../../common/math';

/* ===== [weather] Trạng thái thời tiết: tham số liên tục, preset, tiến dần về target, nhiễu gió =====
   Module THUẦN: không import three/scene. Ngẫu nhiên dùng rng(CONFIG.weather.seed + k), KHÔNG dùng rand(). */
export interface WeatherParams {
  temp: number;      // °C — nhiệt độ không khí
  rain: number;      // 0 → 1 — cường độ mưa
  wind: number;      // m/s ở 10 m — gió trung bình
  gust: number;      // m/s — biên độ gió giật cộng thêm
  windDir: number;   // rad — hướng gió THỔI TỚI (0 = sang +X)
  cloud: number;     // 0 → 1 — độ phủ mây
  haze: number;      // 0 → 1 — mù nóng
  level: number;     // m — mực nước sông dâng thêm
  lightning: number; // 0 → 1 — tần suất chớp
  closed: boolean;   // cấm lưu thông qua cầu (theo trạng thái preset / kịch bản, không theo ngưỡng gió)
}
export type PresetName = 'now' | 'summer' | 'rain' | 'monsoon' | 'storm';
export const PRESET_NAMES: PresetName[] = ['now', 'summer', 'rain', 'monsoon', 'storm'];

export interface WeatherState {
  current: WeatherParams; target: WeatherParams;
  wet: number;            // 0 → 1 — mặt ướt (dẫn xuất: lên nhanh theo mưa, khô chậm)
  preset: PresetName; intensity: number;   // 0 → 1 — thanh cường độ nhân lên rain/wind/gust/level
}

/* Giá trị trung tính (không mưa, không gió): đích của preset `now`. */
export const neutralParams = (): WeatherParams => ({ temp: CONFIG.weather.thermal.refTemp, rain: 0, wind: 0, gust: 0, windDir: CONFIG.weather.windDir, cloud: 0, haze: 0, level: 0, lightning: 0, closed: false });

export const createWeatherState = (): WeatherState => ({ current: neutralParams(), target: neutralParams(), wet: 0, preset: 'now', intensity: 1 });

/* Đích của một preset sau khi nhân thanh cường độ k (0–1). `now` -> trung tính. */
export function presetTarget(name: PresetName, k = 1): WeatherParams {
  const p = CONFIG.weather.presets[name], n = neutralParams();
  if (!p) return n;
  const kk = Math.max(0, Math.min(1, k));
  return { ...n, ...p, rain: p.rain * kk, wind: p.wind * kk, gust: p.gust * kk, level: p.level * kk };
}

export function setPreset(s: WeatherState, name: PresetName, k = s.intensity) {
  s.preset = name; s.intensity = Math.max(0, Math.min(1, k));
  s.target = presetTarget(name, s.intensity);
}

const approach = (a: number, b: number, tau: number, dt: number) => b + (a - b) * Math.exp(-dt / Math.max(1e-3, tau));

/* Tiến current về target theo hằng số thời gian riêng từng tham số (giống stepNight). */
export function stepWeather(s: WeatherState, dt: number) {
  const T = CONFIG.weather.tau, c = s.current, t = s.target;
  c.temp = approach(c.temp, t.temp, T.temp, dt);
  c.rain = approach(c.rain, t.rain, T.rain, dt);
  c.wind = approach(c.wind, t.wind, T.wind, dt);
  c.gust = approach(c.gust, t.gust, T.wind, dt);
  c.windDir = t.windDir;
  c.cloud = approach(c.cloud, t.cloud, T.cloud, dt);
  c.haze = approach(c.haze, t.haze, T.haze, dt);
  c.level = approach(c.level, t.level, T.level, dt);
  c.lightning = approach(c.lightning, t.lightning, T.lightning, dt);
  c.closed = t.closed;
  s.wet = approach(s.wet, c.rain, c.rain > s.wet ? T.rain : T.wet, dt);   // ướt nhanh, khô chậm
}

/* Nhiễu gió giật g(t) ∈ [0, 1]: tổng vài tầng nội suy cosin trên bảng ngẫu nhiên có seed (lặp tuần hoàn, không dùng rand()). */
let gustTable: number[][] | null = null;
function gustTables() {
  if (gustTable) return gustTable;
  const G = CONFIG.weather.gust, rnd = rng(CONFIG.weather.seed + 1);
  gustTable = Array.from({ length: G.octaves }, () => Array.from({ length: G.steps }, () => rnd()));
  return gustTable;
}
export function gustNoise(t: number): number {
  const G = CONFIG.weather.gust, tabs = gustTables();
  let sum = 0, amp = 1, norm = 0;
  for (let o = 0; o < G.octaves; o++) {
    const x = Math.abs(t) / (G.period / (1 << o)), i = Math.floor(x), f = x - i, a = tabs[o][i % G.steps], b = tabs[o][(i + 1) % G.steps], u = (1 - Math.cos(f * Math.PI)) / 2;
    sum += (a + (b - a) * u) * amp; norm += amp; amp *= 0.5;
  }
  return sum / norm;
}
/* Gió tức thời ở 10 m: trung bình + giật. */
export const windNow = (c: WeatherParams, t: number) => c.wind + c.gust * gustNoise(t);

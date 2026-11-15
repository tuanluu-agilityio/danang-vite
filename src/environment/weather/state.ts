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
  fog: number;       // 0 → 1 — sương / giảm tầm nhìn (D-043, chỉ chế độ Trực tiếp đặt khác 0; preset mô phỏng: 0)
}
export type PresetName = 'now' | 'summer' | 'rain' | 'monsoon' | 'storm';
export const PRESET_NAMES: PresetName[] = ['now', 'summer', 'rain', 'monsoon', 'storm'];

export interface WeatherState {
  current: WeatherParams; target: WeatherParams;
  wet: number;            // 0 → 1 — mặt ướt (dẫn xuất: lên nhanh theo mưa, khô chậm)
  preset: PresetName; intensity: number;   // 0 → 1 — thanh cường độ nhân lên rain/wind/gust/level
  tauScale: number;       // hệ số nhân hằng số thời gian (D-043): 1 = mô phỏng (y như cũ); Trực tiếp đặt CONFIG.live.tauScale, khác 1 thì windDir quay dần theo cung ngắn
}

/* Giá trị trung tính (không mưa, không gió): đích của preset `now`. */
export const neutralParams = (): WeatherParams => ({ temp: CONFIG.weather.thermal.refTemp, rain: 0, wind: 0, gust: 0, windDir: CONFIG.weather.windDir, cloud: 0, haze: 0, level: 0, lightning: 0, closed: false, fog: 0 });

export const createWeatherState = (): WeatherState => ({ current: neutralParams(), target: neutralParams(), wet: 0, preset: 'now', intensity: 1, tauScale: 1 });

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

const TWO_PI = Math.PI * 2;

/* Tiến current về target theo hằng số thời gian riêng từng tham số (giống stepNight).
   tauScale ≠ 1 (Trực tiếp, D-043): mọi hằng số (trừ mặt ướt) nhân k; windDir quay dần theo cung ngắn (350° → 10° đi qua 0°). tauScale = 1: y như cũ. */
export function stepWeather(s: WeatherState, dt: number) {
  const T = CONFIG.weather.tau, c = s.current, t = s.target, k = s.tauScale > 0 ? s.tauScale : 1;
  c.temp = approach(c.temp, t.temp, T.temp * k, dt);
  c.rain = approach(c.rain, t.rain, T.rain * k, dt);
  c.wind = approach(c.wind, t.wind, T.wind * k, dt);
  c.gust = approach(c.gust, t.gust, T.wind * k, dt);
  if (k === 1) c.windDir = t.windDir;
  else {
    const d = Math.atan2(Math.sin(t.windDir - c.windDir), Math.cos(t.windDir - c.windDir));   // lệch theo cung ngắn, (−π, π]
    const a = c.windDir + d * (1 - Math.exp(-dt / Math.max(1e-3, T.wind * k)));
    c.windDir = ((a % TWO_PI) + TWO_PI) % TWO_PI;
  }
  c.cloud = approach(c.cloud, t.cloud, T.cloud * k, dt);
  c.haze = approach(c.haze, t.haze, T.haze * k, dt);
  c.level = approach(c.level, t.level, T.level * k, dt);
  c.lightning = approach(c.lightning, t.lightning, T.lightning * k, dt);
  c.fog = approach(c.fog, t.fog, T.fog * k, dt);
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

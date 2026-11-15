/* ===== Số liệu Open-Meteo → tham số thời tiết của cảnh (D-043, spec §4.2) =====
   Thuần hàm: không import three / DOM. Mọi ngưỡng ở CONFIG.live (truyền vào `cfg`). Không bịa số liệu: chỉ ánh xạ cái đã đo.
   level luôn 0 và closed luôn false (nước dâng / cấm cầu chỉ có ở mô phỏng và kịch bản bão). */
import type { CONFIG } from '../config';
import type { WeatherParams } from '../environment/weather/state';
import type { EnvWeather } from './weatherApi';

type LiveCfg = typeof CONFIG.live;

const clamp01 = (v: number) => v < 0 ? 0 : v > 1 ? 1 : v;
const fin = (v: unknown, d: number): number => typeof v === 'number' && isFinite(v) ? v : d;   // số liệu đệm hỏng không thành NaN trong cảnh

/* Nội suy tuyến tính trên bảng mốc [x, y] tăng dần theo x; ngoài hai đầu giữ giá trị mốc đầu / cuối */
function curve(pts: [number, number][], x: number): number {
  if (x <= pts[0][0]) return pts[0][1];
  for (let i = 1; i < pts.length; i++) {
    const [x1, y1] = pts[i];
    if (x <= x1) { const [x0, y0] = pts[i - 1]; return y0 + (y1 - y0) * (x - x0) / (x1 - x0); }
  }
  return pts[pts.length - 1][1];
}

/* Mã WMO có mưa: mưa phùn / mưa (51–67), mưa rào (80–82), dông (95–99) */
const isRainCode = (c: number) => (c >= 51 && c <= 67) || (c >= 80 && c <= 82) || (c >= 95 && c <= 99);

/** Hướng gió khí tượng (độ, gió thổi TỪ hướng đó, 0 = Bắc, thuận kim đồng hồ) → `WeatherParams.windDir` (rad).
    Quy ước cảnh (đọc từ mã): `rain.ts` cho vệt mưa trôi theo (cos θ, sin θ) × gió trên trục (X, Z); `wind.ts` đặt `uWindDir = (cos θ, sin θ)`
    rồi shader cây / dây dùng `vec3(uWindDir.x, 0, uWindDir.y)` — tức θ là hướng gió thổi TỚI, đo từ +X về phía +Z.
    Thế giới: +X = Đông, −Z = Bắc (+Z = Nam). Gió từ D thổi tới D + 180°, vector la bàn (sin, −cos)(D + 180°) = (−sin D, cos D) = (cos, sin)(D + 90°).
    Vậy θ = D + 90° (đổi rad, đưa về [0, 2π)). Kiểm: gió Đông Bắc 45° ⇒ θ = 135° ⇒ x < 0 (về Tây), z > 0 (về Nam). */
export function envWindDir(fromDeg: number): number {
  const d = (((fromDeg + 90) % 360) + 360) % 360;
  return d * Math.PI / 180;
}

/** Số liệu → đích thời tiết của cảnh. `sunUp`: mặt trời trên chân trời (mù nóng chỉ ban ngày). */
export function envToParams(w: EnvWeather, sunUp: boolean, cfg: LiveCfg): WeatherParams {
  const code = fin(w.code, 0), rate = Math.max(0, fin(w.rate, fin(w.rain, 0) * 4)), cloud = clamp01(fin(w.cloud, 0) / 100);
  // Mưa: theo lượng đo mm/h; mã mưa mà lượng ≈ 0 thì sàn mưa phùn; mã quang thì dưới rainMin coi như khô
  const rainCode = isRainCode(code);
  let rain = rate < cfg.rainMin && !rainCode ? 0 : clamp01(curve(cfg.rainCurve, rate));
  if (rainCode) rain = Math.max(rain, cfg.drizzleFloor);
  // Gió: km/h → m/s, trần windMax; giật = phần vượt trung bình, thiếu thì theo tỉ lệ
  const wind = Math.min(cfg.windMax, Math.max(0, fin(w.wind, 0)) / 3.6);
  const gust = typeof w.gust === 'number' && isFinite(w.gust) ? Math.max(0, (w.gust - fin(w.wind, 0)) / 3.6) : cfg.gustFallback * wind;
  // Sương: tầm nhìn + chút mù do ẩm cao; mã sương mù là sàn
  const vis = typeof w.vis === 'number' && isFinite(w.vis) ? curve(cfg.visCurve, w.vis) : 0;
  const hum = fin(w.hum, 0), H = cfg.humHaze;
  const humAdd = hum > H.from ? H.max * clamp01((hum - H.from) / (100 - H.from)) : 0;
  let fog = clamp01(vis + humAdd);
  if (code === 45 || code === 48) fog = Math.max(fog, cfg.fogCodeFloor);
  // Mù nóng: chỉ ban ngày, giảm theo mây
  const temp = fin(w.temp, 25);
  const haze = sunUp ? clamp01((temp - cfg.heat.from) / cfg.heat.span) * (1 - cloud) : 0;
  const lightning = code === 95 ? cfg.lightning.storm : code >= 96 && code <= 99 ? cfg.lightning.hail : 0;
  return { temp, rain, wind, gust, windDir: envWindDir(fin(w.dir, 0)), cloud, haze, level: 0, lightning, closed: false, fog };
}

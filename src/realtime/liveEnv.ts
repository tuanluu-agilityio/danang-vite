/* ===== Bộ điều khiển chế độ Trực tiếp / Mô phỏng (D-043, spec §4.4) =====
   Một chỗ duy nhất ghi số liệu thật vào cảnh. Trực tiếp: mỗi khung đặt dayNight.target theo độ cao mặt trời thật (solar.ts) và giữ `sun` cho applyNight;
   kho số liệu (store.ts) báo đổi thì tính đích thời tiết (envMap.ts) rồi weather.setLive(). Mô phỏng: không ghi gì (preset / cường độ / đêm của người xem giữ nguyên).
   Không import three / DOM: mọi phụ thuộc tiêm vào để chạy dưới Node (tests/live-unit/liveEnv.test.ts). Không cấp phát mỗi khung. */
import type { CONFIG } from '../config';
import type { WeatherParams } from '../environment/weather/state';
import type { EnvStore } from './store';
import { envToParams } from './envMap';
import { sunPosition, liveNight, sunWarm } from './solar';

export type EnvMode = 'live' | 'manual';
export type LiveSun = { elev: number; azim: number; warm: number };   // cùng dạng SunOverride của core/dayNight.ts (không import để giữ module thuần)
export type LiveDeps = {
  cfg: typeof CONFIG.live; lat: number; lon: number;
  refreshMs: number;                                              // CONFIG.env.refreshMs: số liệu cũ hơn mức này thì làm mới khi vào Trực tiếp
  now: () => number;                                              // epoch ms (đã hiệu chỉnh: giờ máy + store.skew())
  store: Pick<EnvStore, 'data' | 'status' | 'onChange' | 'refresh'>;
  weather: { setLive(p: WeatherParams | null, instant?: boolean): void; stopScenario(): void; standTrees(): void };
  dayNight: { night: number; target: number };
  initial: EnvMode;
};
export type LiveEnv = {
  readonly mode: EnvMode; readonly sun: LiveSun | null;          // sun: null ở Mô phỏng ⇒ main.ts gọi applyNight như cũ
  setMode(m: EnvMode, why?: 'user' | 'feature'): void;            // 'feature': tính năng cần đêm tự chuyển sang Mô phỏng (giao diện hiện thông báo)
  update(dt: number): void;                                       // gọi mỗi khung TRƯỚC stepNight
  onChange(fn: (why: 'user' | 'feature' | 'data') => void): void;
};

/** Thời gian chờ tới lần lấy số liệu kế tiếp ở Trực tiếp: mốc quan trắc obsStepMs kế tiếp (theo UTC) + obsDelayMs + nhiễu 0–jitterMs, không dưới minDelayMs.
    Mọi máy căn cùng mốc nên đổi số liệu gần như cùng lúc (spec §4.5). rnd: bộ sinh riêng rng(seed), không dùng rand(). */
export function liveNextDelay(now: number, cfg: { obsStepMs: number; obsDelayMs: number; jitterMs: number; minDelayMs: number }, rnd: () => number): number {
  const S = cfg.obsStepMs, at = (Math.floor((now - cfg.obsDelayMs) / S) + 1) * S + cfg.obsDelayMs;
  return Math.max(cfg.minDelayMs, at - now + rnd() * cfg.jitterMs);
}

export function createLiveEnv(d: LiveDeps): LiveEnv {
  const cfg = d.cfg;
  let mode: EnvMode = d.initial;
  const sunObj: LiveSun = { elev: 0, azim: 180, warm: 0 };       // một đối tượng dùng lại (không cấp phát mỗi khung)
  let sun: LiveSun | null = null;
  let sunAt = -Infinity;                    // giờ (ms) của lần tính mặt trời gần nhất: tính lại khi lệch > 1 s (mặt trời đi 0,004°/s)
  let firstNight = mode === 'live';         // lần update đầu ở Trực tiếp lúc mở trang: gán luôn night = target (không chuyển cảnh)
  let applied = false;                      // đã áp số liệu lần nào chưa: lần đầu ở Trực tiếp lúc mở trang áp tức thì
  let lastData: unknown = null, lastUp: boolean | null = null;   // số liệu / ngày–đêm của lần setLive gần nhất (kho báo lỗi mà data giữ nguyên ⇒ không gọi lại)
  let manualTarget = d.dayNight.target;     // đêm đích của Mô phỏng, nhớ lúc rời Mô phỏng
  const subs: Array<(why: 'user' | 'feature' | 'data') => void> = [];
  const emit = (why: 'user' | 'feature' | 'data') => { for (const f of subs) { try { f(why); } catch (e) { console.error(e); } } };

  const calcSun = (force: boolean) => {
    const t = d.now();
    if (!force && Math.abs(t - sunAt) <= 1000) return;
    sunAt = t;
    const p = sunPosition(t, d.lat, d.lon);
    sunObj.elev = p.elev; sunObj.azim = p.azim; sunObj.warm = sunWarm(p.elev, cfg.warm);
    sun = sunObj;
  };
  /* Số liệu → đích thời tiết. Chỉ ở Trực tiếp; data null (đang tải / mất mạng không đệm) ⇒ không gọi gì, giữ trạng thái cuối */
  const applyData = (instant: boolean) => {
    const data = d.store.data;
    if (mode !== 'live' || !data) return;
    const up = sunObj.elev > 0;
    if (data === lastData && up === lastUp) return;
    lastData = data; lastUp = up;
    d.weather.setLive(envToParams(data, up, cfg), instant);
    applied = true;
    emit('data');
  };

  d.store.onChange(() => { if (mode === 'live') applyData(!applied); });
  if (mode === 'live') { calcSun(true); applyData(true); }       // kho có thể đã có số liệu (bộ nhớ đệm) trước khi bộ điều khiển được tạo

  return {
    get mode() { return mode; },
    get sun() { return mode === 'live' ? sun : null; },
    setMode(m: EnvMode, why: 'user' | 'feature' = 'user') {
      if (m === mode) return;
      if (m === 'manual') {
        mode = 'manual'; firstNight = false;
        d.weather.setLive(null);
        d.dayNight.target = manualTarget;
        sun = null;
      } else {
        manualTarget = d.dayNight.target;
        mode = 'live'; firstNight = false; applied = true;   // từ Mô phỏng: cảnh tiến dần tới trạng thái thật (không tức thì)
        d.weather.stopScenario(); d.weather.standTrees();
        const data = d.store.data;
        if (!data || d.now() - data.obs > d.refreshMs) void d.store.refresh();
        calcSun(true);
        d.dayNight.target = liveNight(sunObj.elev, cfg);
        lastData = null; lastUp = null;
        applyData(false);
      }
      emit(why);
    },
    update(_dt: number) {
      // Không dùng dt: đêm tiến dần bằng stepNight, thời tiết bằng stepWeather (cả hai nhận dt đã kẹp trong animate); sau tab ẩn lâu đích đổi một lần rồi cảnh tiến dần
      if (mode !== 'live') return;
      calcSun(false);
      d.dayNight.target = liveNight(sunObj.elev, cfg);
      if (firstNight) { d.dayNight.night = d.dayNight.target; firstNight = false; }
      if (lastData && (sunObj.elev > 0) !== lastUp) applyData(false);   // qua chân trời: mù nóng chỉ ban ngày (envToParams sunUp)
    },
    onChange(fn) { subs.push(fn); }
  };
}

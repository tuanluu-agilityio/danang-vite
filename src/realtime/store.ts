/* ===== Kho trạng thái số liệu thực tế (D-042) =====
   Lấy Open-Meteo theo nhịp, thử lại lùi mũ, bộ nhớ đệm localStorage. Mọi thứ ngoài (fetch, giờ, hẹn giờ, storage) được tiêm vào để chạy dưới Node. */
import type { CONFIG } from '../config';
import { envUrl, envParse, envIsWeather, type EnvWeather } from './weatherApi';

export type EnvStatus = 'loading' | 'ok' | 'stale' | 'offline';
export type EnvDeps = {
  cfg: typeof CONFIG.env; live: boolean;                         // live=false: không bao giờ gọi fetch
  fetch: (url: string, init?: { signal?: AbortSignal }) => Promise<{ ok: boolean; json(): Promise<unknown> }>;
  now: () => number; storage: { getItem(k: string): string | null; setItem(k: string, v: string): void } | null;
  setTimer: (fn: () => void, ms: number) => unknown; clearTimer: (id: unknown) => void;
  nextDelay?: (now: number) => number;                           // D-043: có thì thay cfg.refreshMs sau lần lấy thành công (now đã cộng skew; căn theo mốc quan trắc, realtime/liveEnv.ts liveNextDelay)
  skew?: { maxMs: number; stepMs: number };                      // D-043: hiệu chỉnh giờ máy lệch theo giờ quan trắc (CONFIG.live.skewMaxMs / obsStepMs); thiếu thì skew() luôn 0
};
export type EnvStore = {
  readonly data: EnvWeather | null; status(): EnvStatus;
  start(): void; stop(): void; refresh(): Promise<void>; setVisible(v: boolean): void;
  onChange(fn: () => void): void;
  inject(data: EnvWeather | null, failed?: boolean): void;       // cho test trình duyệt: đặt thẳng số liệu / trạng thái lỗi rồi báo onChange; không ghi bộ nhớ đệm
  skew(): number;                                                // ms cần cộng vào giờ máy (0 khi giờ máy khớp giờ quan trắc trong skew.maxMs)
};

export function createEnvStore(d: EnvDeps): EnvStore {
  const cfg = d.cfg;
  let data: EnvWeather | null = null;
  let failed = false;                      // có ít nhất một lần lấy lỗi kể từ lần thành công gần nhất
  let nFail = 0;                           // số lần lỗi liên tiếp (mũ của thời gian chờ)
  let started = false, visible = true;
  let inflight: Promise<void> | null = null;
  let timer: unknown = null, nextAt = 0;   // hẹn lấy kế tiếp; nextAt = 0: chưa từng hẹn
  let skew = 0;                            // ms cộng vào giờ máy (D-043), chỉ tính lại sau lần lấy thành công
  const subs: Array<() => void> = [];

  const emit = () => { for (const f of subs) { try { f(); } catch (e) { console.error(e); } } };   // một listener ném không chặn listener khác, không thành lời hứa bị từ chối chưa xử lý
  const clear = () => { if (timer !== null) { d.clearTimer(timer); timer = null; } };
  const arm = (ms: number) => {
    clear();
    nextAt = d.now() + ms;
    if (visible && started) timer = d.setTimer(() => { timer = null; void refresh(); }, ms);
  };

  /* Đọc bộ nhớ đệm: hỏng / sai kiểu thì bỏ, không ném */
  const loadCache = () => {
    if (!d.storage) return;
    try {
      const raw = d.storage.getItem(cfg.storeKey);
      if (!raw) return;
      const o = JSON.parse(raw);
      if (envIsWeather(o)) data = o;
    } catch { /* bỏ qua */ }
  };
  const saveCache = () => {
    if (!d.storage || !data) return;
    try { d.storage.setItem(cfg.storeKey, JSON.stringify(data)); } catch { /* đầy / bị chặn: bỏ qua */ }
  };

  /* Một lần lấy: ném / ok=false / JSON hỏng / quá timeoutMs đều là lỗi */
  const fetchOnce = async (): Promise<EnvWeather | null> => {
    const ac = typeof AbortController !== 'undefined' ? new AbortController() : null;
    let tid: unknown = null;
    const timeout = new Promise<never>((_, rej) => {
      tid = d.setTimer(() => { try { ac && ac.abort(); } catch { /* bỏ qua */ } rej(new Error('timeout')); }, cfg.timeoutMs);
    });
    try {
      const work = (async () => {
        const res = await d.fetch(envUrl(cfg), ac ? { signal: ac.signal } : undefined);
        if (!res || !res.ok) return null;
        return envParse(await res.json());
      })();
      work.catch(() => { /* tránh báo lỗi chưa xử lý khi timeout thắng cuộc đua */ });
      return await Promise.race([work, timeout]);
    } catch {
      return null;
    } finally {
      d.clearTimer(tid);
    }
  };

  const run = async (): Promise<void> => {
    const w = await fetchOnce();
    if (w) {
      data = w; failed = false; nFail = 0;
      // Giờ máy lệch quá skew.maxMs so với giờ quan trắc (tính cả độ trễ một kỳ) ⇒ lấy giữa kỳ quan trắc làm giờ thật (sai ≤ nửa kỳ)
      if (d.skew) {
        const dd = d.now() - w.obs, S = d.skew;
        skew = dd < -S.maxMs || dd > S.maxMs + S.stepMs ? -(dd - S.stepMs / 2) : 0;
      }
      saveCache();
      arm(d.nextDelay ? d.nextDelay(d.now() + skew) : cfg.refreshMs);
    } else {
      failed = true;
      arm(Math.min(cfg.retryMs * Math.pow(2, nFail), cfg.retryMaxMs));
      nFail++;
    }
    emit();
  };

  function refresh(): Promise<void> {
    if (!d.live) return Promise.resolve();
    if (inflight) return inflight;
    clear();
    inflight = run().finally(() => { inflight = null; });
    return inflight;
  }

  return {
    get data() { return data; },
    status(): EnvStatus {
      if (!data) return failed ? 'offline' : 'loading';
      return d.now() + skew - data.obs <= cfg.staleMs ? 'ok' : 'stale';
    },
    start() {
      if (started) return;
      started = true;
      if (d.live) loadCache();   // ?test: không đọc bộ nhớ đệm, luôn 'loading' (số liệu cũ làm lệch test)
      if (data) emit();
      if (d.live && visible) void refresh();
    },
    stop() { started = false; clear(); },
    refresh,
    setVisible(v: boolean) {
      if (v === visible) return;
      visible = v;
      if (!started || !d.live) return;
      if (!v) { clear(); return; }
      if (inflight) return;                                    // đang lấy: xong sẽ tự hẹn
      if (nextAt === 0 || d.now() >= nextAt) void refresh();   // đã quá hạn (hoặc chưa từng lấy): lấy ngay
      else arm(nextAt - d.now());                              // chưa tới hạn: hẹn phần còn lại
    },
    onChange(fn: () => void) { subs.push(fn); },
    inject(v: EnvWeather | null, f?: boolean) {
      if (v) envIsWeather(v);   // chỉ để bổ sung tại chỗ gust / vis / rate thiếu (đối tượng kiểu D-042 của test cũ); vẫn nhận như trước kể cả khi sai kiểu (envToParams tự lùi về số mặc định, không NaN)
      data = v; failed = !!f; emit();
    },
    skew: () => skew
  };
}

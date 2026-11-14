/* ===== Đồng hồ theo múi giờ chỉ định (D-042) =====
   Chỉ dùng Intl, không đụng DOM: chạy được dưới Node. Giờ tính theo `tz` (Đà Nẵng), không theo múi giờ máy khách. */

export type EnvPhase = 'dawn' | 'day' | 'dusk' | 'night';

const fmtCache = new Map<string, Intl.DateTimeFormat>();   // một bộ định dạng cho mỗi múi giờ (tạo Intl khá tốn)

function envFmt(tz: string): Intl.DateTimeFormat {
  let f = fmtCache.get(tz);
  if (!f) {
    f = new Intl.DateTimeFormat('en-GB', { timeZone: tz, hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' });
    fmtCache.set(tz, f);
  }
  return f;
}

/** Giờ / phút / giây tại múi giờ `tz`; min = h*60+m. Chữ số Latin, 0–23 (nửa đêm là 0, không phải 24). */
export function envClockParts(d: Date, tz: string): { h: number; m: number; s: number; min: number } {
  let h = 0, m = 0, s = 0;
  for (const p of envFmt(tz).formatToParts(d)) {
    if (p.type === 'hour') h = parseInt(p.value, 10) % 24;
    else if (p.type === 'minute') m = parseInt(p.value, 10);
    else if (p.type === 'second') s = parseInt(p.value, 10);
  }
  return { h, m, s, min: h * 60 + m };
}

/** 348 → "05:48" */
export function envHHMM(min: number): string {
  const p = (n: number) => (n < 10 ? '0' : '') + n;
  return p(Math.floor(min / 60) % 24) + ':' + p(Math.floor(min % 60));
}

/** Pha trong ngày theo phút; bình minh / hoàng hôn xét trước, rồi ngày, còn lại là đêm. */
export function envPhase(min: number, sunrise: number, sunset: number, dawn: readonly [number, number], dusk: readonly [number, number]): EnvPhase {
  if (min >= sunrise + dawn[0] && min < sunrise + dawn[1]) return 'dawn';
  if (min >= sunset + dusk[0] && min < sunset + dusk[1]) return 'dusk';
  if (min >= sunrise && min < sunset) return 'day';
  return 'night';
}

/* ===== Đoạn giới thiệu điện ảnh: đồng hồ nhịp (thuần, không import three / DOM) — D-045 ===== */
export type InSceneId = 'welcome' | 'glider' | 'car' | 'bike' | 'walk' | 'daynight' | 'dragon' | 'swing' | 'finale';
export interface InScene { id: InSceneId; chapter: number; dur: number }
export interface InClock { i: number; t: number; paused: boolean; done: boolean }   // i: nhịp đang chạy; t: giây trong nhịp; done: nhịp cuối đã hết thời lượng

export function inCreate(): InClock { return { i: 0, t: 0, paused: false, done: false }; }

/* Trả chỉ số nhịp mới nếu vừa sang nhịp, không thì −1. Tạm dừng thì không đổi gì; nhịp cuối kẹp t ở dur, done = true */
export function inAdvance(c: InClock, scenes: readonly InScene[], dt: number): number {
  if (c.paused) return -1;
  const last = scenes.length - 1;
  if (c.i >= last) { c.t = Math.min(c.t + dt, scenes[last].dur); if (c.t >= scenes[last].dur) c.done = true; return -1; }
  c.t += dt;
  if (c.t < scenes[c.i].dur) return -1;
  c.t -= scenes[c.i].dur; c.i++;
  if (c.i >= last && c.t >= scenes[last].dur) { c.t = scenes[last].dur; c.done = true; }
  return c.i;
}

export function inSeek(c: InClock, scenes: readonly InScene[], i: number): number {
  c.i = Math.max(0, Math.min(scenes.length - 1, i | 0)); c.t = 0; c.done = false; return c.i;
}

/* Độ đục màn tối 0–1: đầu nhịp 1 → 0 trong fade (first: không), cuối nhịp 0 → 1 trong fade (last: không) */
export function inFade(t: number, dur: number, fade: number, first: boolean, last: boolean): number {
  let a = 0;
  if (!first && t < fade) a = Math.max(a, 1 - t / fade);
  if (!last && t > dur - fade) a = Math.max(a, 1 - (dur - t) / fade);
  return Math.max(0, Math.min(1, a));
}

/* Mức đầy 0–1 của đoạn tiến trình thứ k: trước i là 1, sau i là 0, tại i là t / dur */
export function inFill(c: InClock, scenes: readonly InScene[], k: number): number {
  if (k < c.i) return 1;
  if (k > c.i) return 0;
  return Math.max(0, Math.min(1, c.t / scenes[k].dur));
}

export function inShould(a: { explore: boolean; test: boolean; introParam: string | null; stored: string | null; seen: boolean; forced: boolean; reducedMotion: boolean; saveData: boolean }): boolean {
  if (a.explore) return false;
  if (a.introParam === 'off') return false;
  if (a.test) return a.introParam !== null;
  if (a.forced) return true;
  return a.stored !== 'off' && !a.seen && !a.reducedMotion && !a.saveData;
}

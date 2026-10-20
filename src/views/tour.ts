import * as THREE from 'three';
import { camera, controls } from '../core/renderer';
import { clamp } from '../common/math';
import { t, stops, onChange } from '../i18n';
import { narration } from '../audio/narration';
import { TOUR_DEFS, type TourStop } from './tourStops';
import { cam } from './state';

/* ============================ Tour tự động: đường bay + chú thích ============================ */
interface Tour {
  view: string; key: string; stops: TourStop[]; minY?: number;
  posCurve: THREE.CatmullRomCurve3; tgtCurve: THREE.CatmullRomCurve3; base: number[]; durs: number[]; total: number;
}
export type TourKey = keyof typeof TOUR_DEFS;
export const TOURS = {} as Record<TourKey, Tour>;
for (const [k, T] of Object.entries(TOUR_DEFS) as [TourKey, typeof TOUR_DEFS[TourKey]][]) {
  const P = T.stops.map((s) => new THREE.Vector3(...s.pos)), Q = T.stops.map((s) => new THREE.Vector3(...s.target));
  const durs = P.map((p, i) => clamp(4 + p.distanceTo(P[(i + 1) % P.length]) / 45, 8, 16)); // đoạn dài bay lâu hơn để tốc độ đều
  TOURS[k] = {
    ...T,
    posCurve: new THREE.CatmullRomCurve3(P, true, 'centripetal'),
    tgtCurve: new THREE.CatmullRomCurve3(Q, true, 'centripetal'),
    base: durs, durs: [...durs], total: durs.reduce((a, b) => a + b, 0)
  };
}

/* Chú thích (và giọng đọc) chuyển sang điểm kế khi đi qua tỉ lệ này của đoạn bay */
const SWITCH = 0.55, PAD = 1.2;

/* Có giọng thuyết trình thì kéo dài từng đoạn bay để đọc xong trước khi sang điểm dừng kế.
   Điểm dừng k hiện từ lúc 55% đoạn k-1 tới 55% đoạn k; chỉ đoạn k được kéo dài nên các điểm đã đủ chỗ vẫn đủ. */
function fitDurations(T: Tour) {
  const n = T.stops.length;
  T.durs.splice(0, n, ...T.base);
  for (let k = 0; k < n; k++) {
    const clip = narration.duration(T.key, k);
    if (clip === null) continue;
    const prev = (k + n - 1) % n;
    T.durs[k] = Math.max(T.durs[k], (clip + PAD - (1 - SWITCH) * T.durs[prev]) / SWITCH);
  }
  T.total = T.durs.reduce((a, b) => a + b, 0);
}
function locate(T: Tour, t: number) {
  let i = 0, acc = 0;
  while (acc + T.durs[i] < t) { acc += T.durs[i]; i++; }
  return { i, acc, f: (t - acc) / T.durs[i] };
}
for (const T of Object.values(TOURS)) fitDurations(T);
/* Tên nút góc nhìn → cầu có Tour đó */
export const TOUR_VIEWS: Record<string, TourKey> = Object.fromEntries(Object.entries(TOURS).map(([k, v]) => [v.view, k as TourKey]));

export let activeTour: Tour = TOURS.dragon;
export const tour = { t: 0, shown: -1 };
let onTourSwingStop: (() => void) | null = null;   // Cầu sông Hàn gắn hàm quay cầu vào đây
export const setTourSwingHook = (fn: () => void) => { onTourSwingStop = fn; };
export const setActiveTour = (k: TourKey) => { activeTour = TOURS[k]; };
/* Móc cho công trình có hành vi riêng ở từng điểm dừng (Hầm sông Hàn: mặt cắt, mô phỏng dìm) và khi thoát Tour */
export const tourHooks: { stop: ((s: TourStop) => void) | null; exit: (() => void) | null } = { stop: null, exit: null };

/* Giọng bật/tắt hoặc đổi ngôn ngữ: tính lại thời lượng (giữ nguyên vị trí trên đường bay) rồi đọc lại điểm dừng hiện tại */
function syncNarration() {
  const { i, f } = locate(activeTour, tour.t);
  for (const T of Object.values(TOURS)) fitDurations(T);
  tour.t = activeTour.durs.slice(0, i).reduce((a, b) => a + b, 0) + f * activeTour.durs[i];
  if (cam.mode === 'tour' && tour.shown >= 0) narration.play(activeTour.key, tour.shown); else narration.stop();
}
narration.onChange(syncNarration);
onChange(syncNarration);

const els = {} as { box: HTMLElement; step: HTMLElement; title: HTMLElement; text: HTMLElement; bar: HTMLElement };
export const tourBox = () => els.box;
export function initTourCaption() {
  els.box = document.getElementById('tourCaption'); els.step = document.getElementById('tourStep');
  els.title = document.getElementById('tourTitle'); els.text = document.getElementById('tourText'); els.bar = document.getElementById('tourBar');
}
export function renderTourCaption(i: number) {
  const stop = stops(activeTour.key)[i];
  els.step.textContent = t('step', { i: i + 1, n: activeTour.stops.length });
  els.title.textContent = stop[0]; els.text.textContent = stop[1];
}
export function showTourCaption(i: number) {
  const box = els.box;
  box.classList.add('fade');
  setTimeout(() => {
    renderTourCaption(i);
    box.classList.remove('fade');
  }, 300);
}
export function startTour() { cam.mode = 'tour'; controls.enabled = false; tour.t = 0; tour.shown = -1; }
export function exitTour() {
  if (cam.mode !== 'tour' && !(cam.mode === 'fly' && cam.flight.then === 'tour')) return;
  narration.stop(); tourHooks.exit?.();
  cam.flight.then = null; cam.mode = 'orbit'; controls.enabled = true;
  els.box.hidden = true; document.body.classList.remove('touring');
  document.querySelectorAll('[data-view]').forEach((b) => b.setAttribute('aria-pressed', 'false'));
}
export function updateTour(dt: number) {
  const T = activeTour;
  tour.t = (tour.t + dt) % T.total;
  const { i, f } = locate(T, tour.t);
  const e = 0.5 - 0.5 * Math.cos(Math.PI * f);       // chậm lại ở mỗi điểm dừng
  const u = (i + e) / T.stops.length;
  T.posCurve.getPoint(u, camera.position);
  camera.position.y = Math.max(camera.position.y, T.minY ?? 3);   // đường cong có thể võng xuống: giữ camera trên mặt nước (trừ Tour Hầm sông Hàn)
  T.tgtCurve.getPoint(u, controls.target);
  camera.lookAt(controls.target);
  const near = f < SWITCH ? i : (i + 1) % T.stops.length;
  if (near !== tour.shown) { tour.shown = near; showTourCaption(near); narration.play(T.key, near); if (T.stops[near].swing && onTourSwingStop) onTourSwingStop(); tourHooks.stop?.(T.stops[near]); }
  els.bar.style.width = `${(tour.t / T.total * 100).toFixed(1)}%`;
}

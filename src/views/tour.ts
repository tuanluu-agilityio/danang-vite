import * as THREE from 'three';
import { camera, controls } from '../core/renderer';
import { clamp } from '../common/math';
import { t, stops } from '../i18n';
import { TOUR_DEFS, type TourStop } from './tourStops';
import { cam } from './state';

/* ============================ Tour tự động: đường bay + chú thích ============================ */
interface Tour {
  view: string; key: string; stops: TourStop[];
  posCurve: THREE.CatmullRomCurve3; tgtCurve: THREE.CatmullRomCurve3; durs: number[]; total: number;
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
    durs, total: durs.reduce((a, b) => a + b, 0)
  };
}
/* Tên nút góc nhìn → cầu có Tour đó */
export const TOUR_VIEWS: Record<string, TourKey> = Object.fromEntries(Object.entries(TOURS).map(([k, v]) => [v.view, k as TourKey]));

export let activeTour: Tour = TOURS.dragon;
export const tour = { t: 0, shown: -1 };
let onTourSwingStop: (() => void) | null = null;   // Cầu sông Hàn gắn hàm quay cầu vào đây
export const setTourSwingHook = (fn: () => void) => { onTourSwingStop = fn; };
export const setActiveTour = (k: TourKey) => { activeTour = TOURS[k]; };

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
  cam.flight.then = null; cam.mode = 'orbit'; controls.enabled = true;
  els.box.hidden = true; document.body.classList.remove('touring');
  document.querySelectorAll('[data-view]').forEach((b) => b.setAttribute('aria-pressed', 'false'));
}
export function updateTour(dt: number) {
  const T = activeTour;
  tour.t = (tour.t + dt) % T.total;
  let i = 0, acc = 0;
  while (acc + T.durs[i] < tour.t) { acc += T.durs[i]; i++; }
  const f = (tour.t - acc) / T.durs[i];
  const e = 0.5 - 0.5 * Math.cos(Math.PI * f);       // chậm lại ở mỗi điểm dừng
  const u = (i + e) / T.stops.length;
  T.posCurve.getPoint(u, camera.position);
  camera.position.y = Math.max(camera.position.y, 3);   // đường cong có thể võng xuống: giữ camera trên mặt nước
  T.tgtCurve.getPoint(u, controls.target);
  camera.lookAt(controls.target);
  const near = f < 0.55 ? i : (i + 1) % T.stops.length;
  if (near !== tour.shown) { tour.shown = near; showTourCaption(near); if (T.stops[near].swing && onTourSwingStop) onTourSwingStop(); }
  els.bar.style.width = `${(tour.t / T.total * 100).toFixed(1)}%`;
}

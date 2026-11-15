/* ===== Đoạn giới thiệu điện ảnh: bộ điều khiển (D-045) =====
   Phát ≈ 57 s trên chính cảnh 3D đang chạy (spec docs/superpowers/specs/2026-11-15-intro-dien-anh-design.md): dòng thời gian thuần (timeline.ts),
   chín nhịp (scenes.ts), lớp DOM (ui.ts). main.ts gọi intro.update(dt) ngay sau updateCamera(dt) và bỏ bước của bốn chế độ khi intro.hold.
   play() chụp trạng thái (camera, fov, near, controls, dayNight.target, chế độ Trực tiếp, show.on); cleanup() trả lại hết, gọi được nhiều lần
   (xong, Bỏ qua, nút hành động, lỗi). Cầu sông Hàn chưa về CLOSED thì "tiễn" trong update() tới khi đóng, cả sau khi intro đã kết thúc.
   Phím (pha capture trên window) chặn mọi phím khi intro chạy để không lọt xuống phím lái / Esc thoát (explore.exit tải lại trang).
   Không thêm gì vào cảnh; mỗi khung không cấp phát. */
import * as THREE from 'three';
import { camera, controls } from '../core/renderer';
import { onResize } from '../core/postprocessing';
import { dayNight } from '../core/dayNight';
import { show } from '../bridges/dragon/effects';
import { cam } from '../views/state';
import { drive } from '../explore/drive';
import { bike } from '../explore/bike';
import { stAvatars } from '../explore/stroll/avatars';
import { plPreload } from '../explore/pilot';
import { exRevealChooser, exHideChooser } from '../explore/chooser';
import { CONFIG } from '../config';
import { inCreate, inAdvance, inSeek, inFade, inFill, inShould, type InClock, type InSceneId } from './timeline';
import { inScenes, inScenesInit, inSee } from './scenes';
import { inUiSetup, inUiShow, inUiRender, inUiFill, inUiVeil, inUiPaused, inUiNoMore, type InActKind } from './ui';
import type { SwingController } from '../bridges/song-han/SwingController';
import type { LiveEnv } from '../realtime/liveEnv';

export interface IntroDeps { ctrl: SwingController; live: LiveEnv | null }

const I = CONFIG.intro, S = I.scenes, LAST = S.length - 1;
const clock: InClock = inCreate();
let deps: IntroDeps | null = null;
let active = false;
let cur = -1;                                  // nhịp đã enter() (−1: chưa / đã leave)
let waitMo: MutationObserver | null = null;    // play() khi #loading chưa done: chờ khung đầu
/* Trạng thái chụp lúc play(), trả ở cleanup() */
const snap = { pos: new THREE.Vector3(), target: new THREE.Vector3(), fov: 50, near: 0.5, enabled: true, maxPolar: Math.PI * 0.495, night: 0, wasLive: false, showOn: false };

/* Bộ nhớ trình duyệt có thể bị chặn: mọi lần đọc / ghi bọc try */
const sget = (s: () => Storage, k: string): string | null => { try { return s().getItem(k); } catch { return null; } };
const sset = (s: () => Storage, k: string, v: string | null): void => { try { if (v === null) s().removeItem(k); else s().setItem(k, v); } catch { /* bộ nhớ bị chặn */ } };
const LS = () => localStorage, SS = () => sessionStorage;

/* Đổi nhịp: leave() nhịp cũ → trạng thái nền của nhịp mới → enter(). jump: nhảy (nút, phím, bắt đầu) chứ không chạy tự nhiên từ nhịp trước ⇒ đặt luôn dayNight.night */
function enterScene(i: number, jump: boolean): void {
  if (cur >= 0) { const old = inScenes[S[cur].id]; cur = -1; old.leave(); }
  const id: InSceneId = S[i].id;
  const night = id === 'dragon' || id === 'swing' || id === 'finale' ? 1 : 0;   // welcome … daynight: ngày (daynight tự tăng trong update); ba nhịp cuối: đêm
  dayNight.target = night; if (jump) dayNight.night = night;
  if (show.on) { show.on = false; show.t = 0; }                                    // chỉ nhịp dragon bật trình diễn
  cam.flight.then = null; cam.mode = 'intro'; controls.enabled = false;            // nhịp chế độ đổi tiếp trong enter() (start())
  cur = i;
  inScenes[id].enter();
  inScenes[id].update(clock.t, 0);                                                 // đặt camera ngay (kể cả khi đang tạm dừng)
  inUiRender(i);
  if (id === 'finale') (document.getElementById('inStart') as HTMLButtonElement | null)?.focus({ preventScroll: true });
}

/* Lỗi trong một nhịp: ghi lại, dọn, hiện màn chọn. Trang không được kẹt ở intro */
function fail(e: unknown): void { console.warn('[intro] lỗi trong nhịp, dừng giới thiệu', e); intro.skip(); }

/* Trả mọi thứ đã đổi; gọi nhiều lần an toàn */
function cleanup(): void {
  if (waitMo) { waitMo.disconnect(); waitMo = null; }
  if (!active) return;
  active = false;
  if (cur >= 0) { const old = inScenes[S[cur].id]; cur = -1; try { old.leave(); } catch (e) { console.warn('[intro] lỗi khi rời nhịp', e); } }
  const c = deps?.ctrl; if (c && c.state !== 'CLOSED') inSee.off = true;        // cầu còn mở / đang quay: tiễn về CLOSED trong update()
  if (show.on !== snap.showOn) { show.on = snap.showOn; show.t = 0; }
  const live = deps?.live;
  if (snap.wasLive && live) live.setMode('live', 'user');                         // Trực tiếp tự tính lại dayNight.target theo mặt trời thật
  else dayNight.target = snap.night;                                              // trời chuyển mượt bằng stepNight
  camera.position.copy(snap.pos); controls.target.copy(snap.target);
  if (camera.fov !== snap.fov || camera.near !== snap.near) { camera.fov = snap.fov; camera.near = snap.near; onResize(); }
  controls.maxPolarAngle = snap.maxPolar;
  cam.flight.then = null; cam.mode = 'orbit'; controls.enabled = snap.enabled;
  controls.update();
  clock.paused = false; inUiPaused(false);
  document.body.classList.remove('intro');
  inUiShow(false);
}

/* Bắt đầu thật (sau khung đầu): chụp trạng thái, Mô phỏng, camera intro, lớp phủ, nhịp 0 */
function begin(): void {
  waitMo = null;
  if (active) return;
  /* mô hình nạp trước (chưa về thì chế độ dùng hình tạm có sẵn). Sau khung đầu, không sớm hơn: nạp trong lúc prewarm() (main.ts) chạy thì phần làm nóng
     shader của mô hình (compileAsync) chồng lên prewarm và three ném "reading 'isReady'" (thấy trên GPU thật, ?test&intro) */
  plPreload(); drive.preload(); bike.preload(); stAvatars.preload();
  snap.pos.copy(camera.position); snap.target.copy(controls.target);
  snap.fov = camera.fov; snap.near = camera.near; snap.enabled = controls.enabled; snap.maxPolar = controls.maxPolarAngle;
  snap.night = dayNight.target; snap.showOn = show.on;
  const live = deps?.live;
  snap.wasLive = !!live && live.mode === 'live';
  if (snap.wasLive) live!.setMode('manual', 'user');                              // trước: setMode ghi dayNight.target của Mô phỏng; intro ghi đè ngay sau
  dayNight.target = 0;
  cam.mode = 'intro'; controls.enabled = false; cam.flight.then = null;
  exHideChooser();
  document.body.classList.add('intro');
  active = true;
  inSeek(clock, S, 0); clock.paused = false; inUiPaused(false);
  inUiNoMore(sget(LS, I.storeKey) === 'off');
  inUiShow(true);
  try { enterScene(0, true); } catch (e) { fail(e); }
}

function go(i: number): void {
  if (!active) return;
  const n = inSeek(clock, S, i);
  if (clock.paused) { clock.paused = false; inUiPaused(false); }                  // nhảy nhịp là muốn xem: chạy tiếp (đang tạm dừng thì màn tối đầu nhịp sẽ đứng yên)
  try { enterScene(n, true); } catch (e) { fail(e); }
}

/* Phím khi intro chạy (pha capture, trước mọi trình nghe khác trên window) */
function onKeyDown(e: KeyboardEvent): void {
  if (!active) return;
  if (e.ctrlKey || e.metaKey || e.altKey || e.key === 'Tab') return;
  const tg = e.target as HTMLElement | null;
  const inSel = !!tg && tg.id === 'inLang';
  if (inSel && (e.key.startsWith('Arrow') || e.key === 'Home' || e.key === 'End')) return;   // ô ngôn ngữ: mũi tên đổi lựa chọn như thường
  e.stopImmediatePropagation();
  const rtl = document.documentElement.dir === 'rtl';
  if (e.key === 'Escape') { e.preventDefault(); intro.skip(); }
  else if (e.key === ' ') { e.preventDefault(); if (!e.repeat) intro.pause(); }
  else if (e.key === 'ArrowRight') { e.preventDefault(); if (rtl) intro.prev(); else intro.next(); }
  else if (e.key === 'ArrowLeft') { e.preventDefault(); if (rtl) intro.next(); else intro.prev(); }
  else if (e.key === 'Enter' && S[clock.i].id === 'finale' && !(tg && /^(BUTTON|SELECT|INPUT)$/.test(tg.tagName))) { e.preventDefault(); intro.skip(); }
}
function onKeyUp(e: KeyboardEvent): void {
  if (!active) return;
  if (e.ctrlKey || e.metaKey || e.altKey || e.key === 'Tab') return;
  e.stopImmediatePropagation();
  if (e.key === ' ') e.preventDefault();                                          // Space không bấm nút đang focus (đã dùng để tạm dừng)
}

export const intro = {
  get active(): boolean { return active; },
  get hold(): boolean { return active && clock.paused; },
  get clock(): Readonly<InClock> { return clock; },
  get sceneId(): InSceneId | null { return active ? S[clock.i].id : null; },
  /* Gắn DOM, phím, nút #exIntroBtn / #btnIntro; gọi một lần */
  setup(d: IntroDeps): void {
    deps = d;
    inScenesInit(d.ctrl);
    inUiSetup({
      seek: (i) => go(i), prev: () => intro.prev(), next: () => intro.next(), pause: () => intro.pause(), skip: () => intro.skip(),
      act: (k) => intro.act(k), replay: () => go(0),
      noMore: (on) => sset(LS, I.storeKey, on ? 'off' : null)
    });
    window.addEventListener('keydown', onKeyDown, true);
    window.addEventListener('keyup', onKeyUp, true);
    document.getElementById('exIntroBtn')?.addEventListener('click', () => intro.play());
    document.getElementById('btnIntro')?.addEventListener('click', () => {
      sset(SS, I.playKey, '1');                                                    // trang mới đọc cờ này (wants) rồi phát; chép cách tải lại của explore.exit()
      const u = new URL(location.href);
      u.searchParams.delete('explore'); u.searchParams.delete('chooser');
      if (u.href === location.href) location.reload(); else location.replace(u.toString());
    });
  },
  /* Có tự phát không (spec §5.1); đọc + xóa cờ playKey (nút "Xem giới thiệu" trong bảng Cài đặt) */
  wants(q: URLSearchParams): boolean {
    const forced = sget(SS, I.playKey) === '1';
    if (forced) sset(SS, I.playKey, null);
    let reduced = false;
    try { reduced = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches; } catch { /* không có matchMedia */ }
    const conn = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection;
    return inShould({ explore: q.has('explore'), test: q.has('test'), introParam: q.get('intro'), stored: sget(LS, I.storeKey), seen: sget(SS, I.seenKey) === '1', forced, reducedMotion: reduced, saveData: !!(conn && conn.saveData) });
  },
  /* Phát từ nhịp 0; chờ #loading.done nếu chưa có (như exRevealChooser); đang phát / đang chờ thì bỏ qua */
  play(): void {
    if (active || waitMo || !deps) return;
    sset(SS, I.seenKey, '1');
    const loading = document.getElementById('loading');
    if (!loading || loading.classList.contains('done')) { begin(); return; }
    const mo = new MutationObserver(() => { if (loading.classList.contains('done')) { mo.disconnect(); if (waitMo === mo) begin(); } });
    waitMo = mo;
    mo.observe(loading, { attributes: true, attributeFilter: ['class'] });
  },
  /* Mỗi khung, ngay sau updateCamera(dt): tiễn cầu, dòng thời gian, nhịp, màn tối, tiến trình */
  update(dt: number): void {
    if (inSee.off) {
      const c = deps?.ctrl;
      if (!c || c.state === 'CLOSED') inSee.off = false;
      else { c.speed = I.swingSpeed; if (c.state === 'OPEN') c.requestClose(); }
    }
    if (!active || clock.paused) return;
    try {
      const n = inAdvance(clock, S, dt);
      if (n >= 0) enterScene(n, false);
      if (cur >= 0) inScenes[S[cur].id].update(clock.t, dt);
    } catch (e) { fail(e); return; }
    if (!active) return;
    const i = clock.i;
    inUiVeil(inFade(clock.t, S[i].dur, I.fade, i === 0, i === LAST));
    inUiFill(i, inFill(clock, S, i));
  },
  seek(i: number): void { go(i); },
  next(): void { if (active) go(Math.min(LAST, clock.i + 1)); },
  prev(): void { if (active) go(Math.max(0, clock.i - 1)); },
  pause(on?: boolean): void {
    if (!active) return;
    clock.paused = on === undefined ? !clock.paused : on;
    inUiPaused(clock.paused);
  },
  /* Kết thúc intro, hiện màn chọn */
  skip(): void { cleanup(); exRevealChooser(); },
  /* Nút hành động (spec §5.2): kết thúc, hiện màn chọn rồi bấm hộ đúng phần tử có sẵn */
  act(kind: InActKind): void {
    const c = deps?.ctrl;
    const busy = kind === 'swing' && !!c && c.state !== 'CLOSED';
    cleanup();
    if (busy) inSee.off = false;                                                   // "Xem cầu quay" khi cầu đang quay: để cầu quay tiếp, không tiễn
    exRevealChooser();
    const click = (sel: string) => (document.querySelector(sel) as HTMLElement | null)?.click();
    if (kind === 'glider' || kind === 'car' || kind === 'bike' || kind === 'walk') { click(`button[data-pick="${kind}"]`); return; }
    click('button[data-pick="guided"]');
    if (kind === 'tour') click('[data-view="allTour"]');
    else if (kind === 'dragon') {
      click('[data-bridge="dragon"]'); click('[data-view="head"]');
      const b = document.getElementById('btnShow'); if (b && b.getAttribute('aria-pressed') !== 'true') b.click();
    } else if (kind === 'swing') {
      click('[data-bridge="sh"]');
      if (!busy) document.getElementById('btnSwing')?.click();
    }
  }
};

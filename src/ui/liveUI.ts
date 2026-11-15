import { t, onChange as onLangChange } from '../i18n';
import type { LiveEnv, EnvMode } from '../realtime/liveEnv';
import type { EnvStore } from '../realtime/store';

/* ===== Giao diện hai chế độ Trực tiếp / Mô phỏng (D-043, spec §4.4) =====
   Chữ chế độ + chấm trong chỉ báo #envPill (#envMode), công tắc #envModeSw trong thẻ #envCard, dòng khóa #liveLock trong bảng Cài đặt, thông báo #liveNotice.
   Trực tiếp: thanh / nút Ngày–Đêm, ô chọn + thanh cường độ thời tiết, nút Kịch bản bão bị vô hiệu, và handler của chúng (setupUI.ts / weatherUI.ts) tự bỏ qua qua liveLocked().
   Tính năng cần ban đêm gọi liveYieldForNight() TRƯỚC khi ghi dayNight.target: đang Trực tiếp thì chuyển sang Mô phỏng ('feature') và hiện #liveNotice.
   Không có bộ điều khiển (liveEnv null, dựng lỗi): không gọi bindLiveMode ⇒ mọi phần tử trên giữ `hidden`, không khóa gì, như trước D-043. */

let live: LiveEnv | null = null;
const LOCKED = ['timeSlider', 'btnNight', 'weatherSel', 'weatherK', 'btnWxStorm'];   // điều khiển mô phỏng thuần: vô hiệu ở Trực tiếp

/** Đang Trực tiếp: điều khiển mô phỏng không được ghi gì */
export const liveLocked = (): boolean => !!live && live.mode === 'live';
/** Tính năng cần ban đêm (trình diễn Cầu Rồng, góc rfHearts / swNight, tour Vòng quay): đang Trực tiếp thì chuyển Mô phỏng trước khi ghi dayNight.target */
export function liveYieldForNight(): void { if (live && live.mode === 'live') live.setMode('manual', 'feature'); }

export function bindLiveMode(le: LiveEnv, opts: { store: Pick<EnvStore, 'data' | 'onChange'>; syncSim: () => void; renderEnv: () => void }): void {
  live = le;
  const $ = (id: string) => document.getElementById(id);
  const env = $('env'), badge = $('envMode'), badgeTxt = badge?.querySelector<HTMLElement>('[data-mode-text]');
  const modes = $('envModes'), sw = $('envModeSw'), note = $('envModeNote');
  const btnL = $('envModeLive') as HTMLButtonElement | null, btnM = $('envModeManual') as HTMLButtonElement | null;
  const lock = $('liveLock'), lockTxt = lock?.querySelector<HTMLElement>('.live-lock-txt'), toManual = $('btnToManual'), toLive = $('btnToLive');
  const notice = $('liveNotice'), noticeLive = $('btnNoticeLive');
  for (const e of [badge, modes, lock]) if (e) e.hidden = false;
  const setText = (e: Element | null | undefined, s: string) => { if (e && e.textContent !== s) e.textContent = s; };
  /* Khám phá: Space / mũi tên là phím lái ⇒ bấm chuột xong thì bỏ focus khỏi #env / #liveLock (như blurInExplore của envUI.ts) */
  const blurInExplore = () => {
    const a = document.activeElement as HTMLElement | null;
    if (a && document.body.classList.contains('explore') && (env?.contains(a) || lock?.contains(a) || notice?.contains(a))) a.blur();
  };

  const render = () => {
    const m: EnvMode = le.mode, on = m === 'live';
    if (env && env.dataset.mode !== m) env.dataset.mode = m;
    setText(badgeTxt, t(on ? 'liveBadge' : 'simBadge'));
    for (const [b, bm] of [[btnL, 'live'], [btnM, 'manual']] as const) {
      if (!b) continue;
      b.setAttribute('aria-checked', String(m === bm));
      b.tabIndex = m === bm ? 0 : -1;   // nhóm radio: Tab vào nút đang chọn, mũi tên đổi
    }
    setText(note, t(on ? (opts.store.data ? 'liveNoteLive' : 'liveNoData') : 'liveNoteManual'));
    if (lock) { lock.dataset.mode = m; if (lockTxt) lockTxt.hidden = !on; }
    if (toManual) toManual.hidden = !on;
    if (toLive) toLive.hidden = on;
    for (const id of LOCKED) { const c = $(id) as HTMLButtonElement | HTMLInputElement | HTMLSelectElement | null; if (c && c.disabled !== on) c.disabled = on; }
    opts.renderEnv();   // nhãn đọc màn hình của chỉ báo kèm chế độ (envUI.ts đọc #env[data-mode])
  };

  /* Thông báo: tự ẩn sau 8 s; có nút "Về Trực tiếp" */
  let noticeTimer = 0;
  const hideNotice = () => { window.clearTimeout(noticeTimer); if (notice) notice.hidden = true; };
  const showNotice = () => { if (!notice) return; notice.hidden = false; window.clearTimeout(noticeTimer); noticeTimer = window.setTimeout(hideNotice, 8000); };

  const go = (m: EnvMode) => { if (le.mode !== m) le.setMode(m, 'user'); };
  le.onChange((why) => {
    if (why === 'data') { setText(note, t(le.mode === 'live' ? (opts.store.data ? 'liveNoteLive' : 'liveNoData') : 'liveNoteManual')); return; }
    render();
    if (le.mode === 'manual') opts.syncSim();   // về Mô phỏng: thanh / ô chọn hiện lại đúng trạng thái mô phỏng đã nhớ
    if (why === 'feature') showNotice(); else if (le.mode === 'live') hideNotice();
  });
  opts.store.onChange(() => { if (le.mode === 'live') setText(note, t(opts.store.data ? 'liveNoteLive' : 'liveNoData')); });
  onLangChange(render);

  btnL?.addEventListener('click', () => { go('live'); blurInExplore(); });
  btnM?.addEventListener('click', () => { go('manual'); blurInExplore(); });
  /* Bàn phím trong nhóm radio: mũi tên (cả hai chiều, chỉ hai lựa chọn nên RTL không đổi nghĩa) chọn + chuyển focus; Space / Enter chọn nút đang focus.
     stopPropagation: phím lái của khám phá (listener trên window) không nhận phím này; preventDefault: Space không cuộn trang */
  sw?.addEventListener('keydown', (e) => {
    const k = e.key;
    if (k === 'ArrowLeft' || k === 'ArrowRight' || k === 'ArrowUp' || k === 'ArrowDown') {
      const m: EnvMode = le.mode === 'live' ? 'manual' : 'live';
      go(m); (m === 'live' ? btnL : btnM)?.focus();
    } else if (k === ' ' || k === 'Enter') {
      const b = (e.target as HTMLElement | null)?.closest<HTMLElement>('[data-mode-btn]');
      if (b) go(b.dataset.modeBtn as EnvMode);
    } else return;
    e.preventDefault(); e.stopPropagation();
  });
  // Nút vừa bấm bị ẩn (đổi chỗ với nút kia): đưa focus sang nút kia để bàn phím không rơi về <body>
  const swap = (m: EnvMode, next: HTMLElement | null) => () => { go(m); if (document.body.classList.contains('explore')) blurInExplore(); else next?.focus({ preventScroll: true }); };
  toManual?.addEventListener('click', swap('manual', toLive));
  toLive?.addEventListener('click', swap('live', toManual));
  noticeLive?.addEventListener('click', () => { go('live'); hideNotice(); blurInExplore(); });
  render();
}

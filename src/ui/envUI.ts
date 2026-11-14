import { CONFIG } from '../config';
import { t, onChange as onLangChange, getLang } from '../i18n';
import { openSheet, ui } from './compactUI';
import { envClockParts, envHHMM, envPhase } from '../realtime/clock';
import { envWx, envCompass, envUvLevel, type EnvIcon } from '../realtime/weatherApi';
import { createEnvStore, type EnvStore } from '../realtime/store';

/* ===== Giờ + thời tiết thực tế tại Đà Nẵng (D-042) =====
   Chỉ báo #envPill luôn hiện + thẻ #envCard (tờ 'env' của compactUI.ts). Đồng hồ chạy mỗi giây theo CONFIG.env.tz, số liệu từ realtime/store.ts.
   Chỉ hiển thị: không đọc / ghi thời tiết mô phỏng, thanh Ngày / Đêm hay đèn. Chỉ ghi DOM khi chuỗi đổi (đồng hồ mỗi giây không gây bố trí lại thừa). */

export type EnvUI = { store: EnvStore; render(): void; setNow(fn: (() => number) | null): void };

/* Biểu tượng nét 24×24 (chép từ prototype; 'cloud', 'fog', 'storm', 'snow' vẽ thêm cùng nét); 'off' = mất kết nối */
const RAIN_CLOUD = '<path d="M7 15.5h10a3.8 3.8 0 0 0 .5-7.56A5.2 5.2 0 0 0 7.6 7.3 4.2 4.2 0 0 0 7 15.5z"/>';
const ICO: Record<EnvIcon | 'off', string> = {
  'clear-d': '<circle cx="12" cy="12" r="4"/><path d="M12 2.8v2.4M12 18.8v2.4M2.8 12h2.4M18.8 12h2.4M5.5 5.5l1.7 1.7M16.8 16.8l1.7 1.7M5.5 18.5l1.7-1.7M16.8 7.2l1.7-1.7"/>',
  'clear-n': '<path d="M19.5 14.2A8 8 0 0 1 9.8 4.5a8 8 0 1 0 9.7 9.7z"/><path d="M17 4.2v2.6M15.7 5.5h2.6"/>',
  'cloudy-d': '<path d="M8.2 6.2l-.9-1.5M12.5 5V3.2M16 6.5l1.2-1.3M9 10.2a4 4 0 0 1 7.3-.6"/><path d="M7 19.5h10a3.6 3.6 0 0 0 .5-7.16A5 5 0 0 0 7.9 11.6 4 4 0 0 0 7 19.5z"/>',
  'cloudy-n': '<path d="M18.8 8.4a4.6 4.6 0 0 1-5.4-5.6 4.6 4.6 0 0 0-2.2 6.3"/><path d="M7 19.5h10a3.6 3.6 0 0 0 .5-7.16A5 5 0 0 0 7.9 11.6 4 4 0 0 0 7 19.5z"/>',
  cloud: '<path d="M7 18h10a3.8 3.8 0 0 0 .5-7.56A5.2 5.2 0 0 0 7.6 9.8 4.2 4.2 0 0 0 7 18z"/>',
  rain: RAIN_CLOUD + '<path d="M8.5 18.2l-.9 2.4M12.4 18.2l-.9 2.4M16.3 18.2l-.9 2.4"/>',
  fog: '<path d="M7 12.5h10a3.8 3.8 0 0 0 .5-7.56A5.2 5.2 0 0 0 7.6 4.3 4.2 4.2 0 0 0 7 12.5z"/><path d="M4 16h16M6 19.5h12"/>',
  storm: RAIN_CLOUD + '<path d="M12.6 16.6l-2 3h3l-2 3"/>',
  snow: RAIN_CLOUD + '<path d="M8.5 18.6v.01M12.5 18.6v.01M16.5 18.6v.01M10.5 21.2v.01M14.5 21.2v.01"/>',
  off: '<path d="M7 18h10a4 4 0 0 0 .6-7.96A5.5 5.5 0 0 0 7.1 9.2 4.4 4.4 0 0 0 7 18z" opacity=".5"/><path d="M5 4l14 16"/>'
};

const pad2 = (n: number): string => (n < 10 ? '0' : '') + n;

export function setupEnvUI(opts: { live: boolean }): EnvUI {
  const cfg = CONFIG.env;
  let nowFn: () => number = () => Date.now();   // nguồn giờ của đồng hồ / buổi / trạng thái; test ép bằng setNow
  let storage: Storage | null = null;
  try { storage = window.localStorage; } catch { /* bộ nhớ trình duyệt bị chặn */ }
  const store = createEnvStore({
    cfg, live: opts.live,
    fetch: (u, i) => fetch(u, i),
    now: () => nowFn(),   // cùng nguồn giờ với đồng hồ để trạng thái 'stale' khớp giờ đang hiện
    storage,
    setTimer: (fn, ms) => window.setTimeout(fn, ms),
    clearTimer: (id) => window.clearTimeout(id as number)
  });

  const root = document.getElementById('env');
  if (!root) { store.start(); return { store, render() {}, setNow(fn) { nowFn = fn || (() => Date.now()); } }; }
  const q = <T extends Element = HTMLElement>(sel: string): T => root.querySelector<T>(sel);
  const qa = (sel: string): HTMLElement[] => Array.from(root.querySelectorAll<HTMLElement>(sel));
  const pill = q<HTMLButtonElement>('#envPill'), btnX = q<HTMLButtonElement>('#envX'), scrim = q('#envScrim');
  const hmEls = qa('[data-hm]'), ssEls = qa('[data-ss]'), icoEls = qa('[data-ico]'), swaps = qa('.env-swap');
  const el = {
    temp: q('[data-temp]'), tempN: q('[data-temp-n]'), descShort: q('[data-desc-short]'), desc: q('[data-desc]'), feels: q('[data-feels]'),
    date: q('[data-date]'), sunDot: q('[data-sundot]'), sunrise: q('[data-sunrise]'), sunset: q('[data-sunset]'), sunNote: q('[data-sunnote]'),
    hum: q('[data-hum]'), wind: q('[data-wind]'), rain: q('[data-rain]'), dir: q('[data-dir]'), cloud: q('[data-cloud]'), uv: q('[data-uv]'), foot: q('[data-foot]')
  };
  const dirArrow = el.dir.querySelector<SVGElement>('.arrow'), dirText = el.dir.querySelector<HTMLElement>('span');

  /* Ghi chỉ khi đổi: đọc textContent / thuộc tính không buộc bố trí lại, ghi thừa thì có */
  const setText = (e: Element | null, s: string) => { if (e && e.textContent !== s) e.textContent = s; };
  const setData = (e: HTMLElement, k: string, v: string) => { if (e.dataset[k] !== v) e.dataset[k] = v; };
  const setStyle = (e: HTMLElement | SVGElement, k: string, v: string) => { if (e.style.getPropertyValue(k) !== v) e.style.setProperty(k, v); };
  const valKey = new Map<HTMLElement, string>();
  /* Ô số liệu: số + đơn vị nhỏ (<small>) */
  const setVal = (e: HTMLElement, main: string, small: string) => {
    const k = main + '\u0001' + small;
    if (valKey.get(e) === k) return;
    valKey.set(e, k);
    const nodes: (Node | string)[] = [main];
    if (small) { const s = document.createElement('small'); s.textContent = small; nodes.push(s); }
    e.replaceChildren(...nodes);
  };
  let icoKey = '';
  const setIcon = (k: EnvIcon | 'off') => { if (k === icoKey) return; icoKey = k; for (const e of icoEls) e.innerHTML = ICO[k]; };

  /* Bộ định dạng theo ngôn ngữ (chữ số Latin ở mọi ngôn ngữ), tạo lại khi đổi ngôn ngữ */
  let fmtLang = '', fmtDate: Intl.DateTimeFormat, fmtH: (n: number) => string, fmtM: (n: number) => string;
  /* style:'unit' ném RangeError ở trình duyệt cũ (Safari < 14.1): lùi về số + 'h' / 'min' */
  const unitFmt = (loc: string, unit: string, fb: string) => {
    try { const f = new Intl.NumberFormat(loc, { style: 'unit', unit, unitDisplay: 'short' }); return (n: number) => f.format(n); }
    catch { return (n: number) => n + ' ' + fb; }
  };
  const fmts = () => {
    const lang = getLang();
    if (lang === fmtLang) return;
    fmtLang = lang;
    const loc = lang + '-u-nu-latn';
    fmtDate = new Intl.DateTimeFormat(loc, { timeZone: cfg.tz, weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
    fmtH = unitFmt(loc, 'hour', 'h');
    fmtM = unitFmt(loc, 'minute', 'min');
  };
  const dur = (min: number): string => { const h = Math.floor(min / 60), m = min % 60; return (h ? fmtH(h) + ' ' : '') + fmtM(m); };
  const setAria = (e: HTMLElement, s: string) => { if (e.getAttribute('aria-label') !== s) e.setAttribute('aria-label', s); };

  /* ----- Vẽ mọi thứ trừ chữ số đồng hồ (gọi khi phút đổi, số liệu / trạng thái đổi, đổi ngôn ngữ) ----- */
  const paint = () => {
    fmts();
    const now = nowFn(), c = envClockParts(new Date(now), cfg.tz), min = c.min;
    const data = store.data, st = store.status();
    const sr = data && data.sunrise != null ? data.sunrise : cfg.sunFallback[0];
    const ss = data && data.sunset != null ? data.sunset : cfg.sunFallback[1];
    const day = min >= sr && min < ss;   // ngày / đêm theo đồng hồ, không theo is_day của số liệu (số liệu có thể cũ)
    setData(root, 'phase', envPhase(min, sr, ss, cfg.dawnMin, cfg.duskMin));
    setData(root, 'state', st);
    setText(el.date, fmtDate.format(new Date(now)));
    // Vạch mặt trời: chấm ẩn khi ngoài khoảng mọc → lặn
    setStyle(el.sunDot, 'inset-inline-start', (Math.max(0, Math.min(1, (min - sr) / (ss - sr))) * 100).toFixed(2) + '%');
    setStyle(el.sunDot, 'opacity', day ? '1' : '0');
    setText(el.sunrise, t('envSunrise', { t: envHHMM(sr) }));
    setText(el.sunset, t('envSunset', { t: envHHMM(ss) }));
    setText(el.sunNote, day ? t('envSunLeft', { t: dur(ss - min) }) : t('envSunIn', { t: dur((sr - min + 1440) % 1440) }));
    // Chân thẻ
    setText(el.foot, st === 'loading' ? t('envLoading')
      : st === 'offline' ? t('envOffline')
      : st === 'stale' ? t('envStale', { t: envHHMM(data.obsMin) })
      : t('envObs', { t: envHHMM(data.obsMin), n: Math.round(cfg.refreshMs / 60000) }));
    el.foot.classList.toggle('warn', st === 'stale' || st === 'offline');
    // Nhãn đọc màn hình của chỉ báo: kèm nhiệt độ + giờ (vẽ lại mỗi phút; đổi ngôn ngữ: i18n ghi data-i18n-aria trước rồi mới gọi listener nên nhãn này thắng)
    setAria(pill, t('envAria') + ': ' + (data ? Math.round(data.temp) + '°, ' : st === 'offline' ? t('envOffline') + ', ' : '') + envHHMM(min));
    const dash = '—';
    if (!data) {
      if (st === 'offline') {
        setIcon('off');
        setText(el.temp, '– –'); setText(el.tempN, '– –');
        setText(el.desc, t('envNoData')); setText(el.descShort, t('envOffline')); setText(el.feels, t('envClockOk'));
        for (const e of [el.hum, el.wind, el.rain, el.cloud, el.uv]) setVal(e, dash, '');
        setStyle(dirArrow, 'display', 'none'); setText(dirText, dash);
      } else {
        // Đang tải: chữ giữ chỗ cho khối xám (.v trong suốt), không phải số liệu
        setIcon(day ? 'clear-d' : 'clear-n');
        setText(el.temp, '00°'); setText(el.tempN, '00');
        setText(el.desc, t('envWxPartly')); setText(el.descShort, t('envLoading')); setText(el.feels, t('envFeels', { t: '00' }));
        for (const e of [el.hum, el.cloud]) setVal(e, '00', '%');
        setVal(el.wind, '00', t('drSpeedUnit')); setVal(el.rain, '0,0', 'mm'); setVal(el.uv, '0', '');
        setStyle(dirArrow, 'display', ''); setText(dirText, t('envDirN'));
      }
      return;
    }
    const wx = envWx(data.code, day);
    setIcon(wx.icon);
    const temp = String(Math.round(data.temp));
    setText(el.temp, temp + '°'); setText(el.tempN, temp);
    setText(el.desc, t(wx.key)); setText(el.descShort, t(wx.key));
    setText(el.feels, t('envFeels', { t: Math.round(data.feels) }));
    setVal(el.hum, String(Math.round(data.hum)), '%');
    setVal(el.wind, String(Math.round(data.wind)), t('drSpeedUnit'));
    setVal(el.rain, data.rain.toLocaleString(fmtLang + '-u-nu-latn', { minimumFractionDigits: 1, maximumFractionDigits: 1 }), 'mm');
    setStyle(dirArrow, 'display', '');
    setStyle(dirArrow, 'transform', 'rotate(' + Math.round(data.dir + 180) + 'deg)');   // mũi tên chỉ hướng gió thổi tới
    setText(dirText, t('envDir' + envCompass(data.dir)));
    setVal(el.cloud, String(Math.round(data.cloud)), '%');
    if (data.uv == null) setVal(el.uv, dash, '');
    else {
      const uv = day ? Math.round(data.uv) : 0;   // đêm theo đồng hồ: 0, không mức
      const lv = envUvLevel(uv);
      setVal(el.uv, String(uv), lv ? t('envUv' + lv) : '');
    }
  };

  /* ----- Đồng hồ: căn mép giây kế tiếp; phút đổi thì vẽ lại phần còn lại ----- */
  let lastMin = -1, clockTimer = 0;
  const tick = (force: boolean) => {
    const c = envClockParts(new Date(nowFn()), cfg.tz);
    const hm = envHHMM(c.min), s = pad2(c.s);
    for (const e of hmEls) setText(e, hm);
    for (const e of ssEls) setText(e, s);
    if (force || c.min !== lastMin) { lastMin = c.min; if (!swapTimer) paint(); }
  };
  const schedule = () => {
    window.clearTimeout(clockTimer);
    clockTimer = window.setTimeout(() => { tick(false); schedule(); }, 1000 - (Date.now() % 1000) + 5);   // +5 ms: chắc chắn đã qua mép giây
  };

  /* ----- Số liệu đổi: nhiệt độ và lưới số mờ ra / vào 180 ms (bỏ khi giảm chuyển động) ----- */
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
  let swapTimer = 0, shownData = store.data;
  const onStore = () => {
    const changed = store.data !== shownData;
    shownData = store.data;
    if (!changed || reduced.matches) { if (!swapTimer) paint(); return; }
    if (swapTimer) return;   // đang mờ ra: lúc hiện lại vẽ số liệu mới nhất
    for (const e of swaps) e.classList.add('out');
    swapTimer = window.setTimeout(() => { swapTimer = 0; paint(); for (const e of swaps) e.classList.remove('out'); }, 180);
  };
  store.onChange(onStore);
  onLangChange(() => tick(true));

  /* ----- Mở / đóng (tờ 'env'); khám phá: bỏ focus để Space / mũi tên không bấm lại nút ----- */
  const blurInExplore = () => { if (document.body.classList.contains('explore')) (document.activeElement as HTMLElement | null)?.blur(); };
  pill.addEventListener('click', () => { openSheet(ui.sheet === 'env' ? 'none' : 'env'); blurInExplore(); });
  btnX.addEventListener('click', () => { openSheet('none'); blurInExplore(); });
  scrim.addEventListener('pointerdown', (e) => { e.preventDefault(); openSheet('none'); });

  /* ----- Ô tô / xe máy trên cảm ứng: chỉ báo đứng dưới chú thích bản đồ nhỏ (#drMapNote). Chiều cao bản đồ (--dr-map-h) chỉ đặt trên #drHud, chú thích
     xuống dòng theo ngôn ngữ, nên đo đáy chú thích khi nó đổi cỡ (hiện ra, đổi ngôn ngữ, xoay máy) hoặc bản đồ đổi cỡ, ghi --env-dr-top cho CSS ----- */
  const note = document.getElementById('drMapNote'), drHud = document.getElementById('drHud');
  if (note && drHud && typeof ResizeObserver !== 'undefined') {
    const syncDr = () => {
      const b = note.getBoundingClientRect();
      if (b.height > 0) setStyle(root, '--env-dr-top', Math.round(b.bottom + cfg.driveGap) + 'px');
    };
    new ResizeObserver(syncDr).observe(note);
    new MutationObserver(syncDr).observe(drHud, { attributes: true, attributeFilter: ['style'] });
  }

  /* ----- Tab ẩn: dừng đồng hồ và nhịp lấy số liệu; hiện lại: chạy tiếp (store tự lấy nếu đã quá hạn) ----- */
  document.addEventListener('visibilitychange', () => {
    const vis = !document.hidden;
    store.setVisible(vis);
    if (vis) { tick(true); schedule(); } else window.clearTimeout(clockTimer);
  });
  window.addEventListener('online', () => { void store.refresh(); });

  if (document.hidden) store.setVisible(false);
  tick(true);
  store.start();
  if (!document.hidden) schedule();

  return {
    store,
    render: () => tick(true),
    setNow(fn: (() => number) | null) { nowFn = fn || (() => Date.now()); tick(true); }
  };
}

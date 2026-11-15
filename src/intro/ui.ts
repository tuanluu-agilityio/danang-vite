/* ===== Đoạn giới thiệu điện ảnh: lớp DOM #intro (D-045) =====
   Chữ theo nhịp (số chương, tiêu đề, dòng phụ, ghi chú, hàng phím / dòng cảm ứng, nút hành động), thanh tiến trình 9 đoạn, ◀ ❚❚ ▶, "Không hiện lại", ô ngôn ngữ, khối lối vào ở nhịp cuối.
   Khung DOM + CSS có sẵn trong index.html / main.css (mục "Đoạn giới thiệu (D-045)"); ở đây chỉ ghi chữ và móc nút. Mỗi khung chỉ ghi --f của đoạn đang chạy và độ đục màn tối, chỉ khi đổi đủ lớn. */
import { t, onChange, getLang } from '../i18n';
import { CONFIG } from '../config';
import type { InSceneId } from './timeline';

export type InActKind = 'glider' | 'car' | 'bike' | 'walk' | 'dragon' | 'swing' | 'tour';
export interface InUiHandlers {
  seek(i: number): void; prev(): void; next(): void; pause(): void; skip(): void;
  act(kind: InActKind): void; replay(): void; noMore(on: boolean): void;
}

const S = CONFIG.intro.scenes;
const ACT: Partial<Record<InSceneId, InActKind>> = { glider: 'glider', car: 'car', bike: 'bike', walk: 'walk', dragon: 'dragon', swing: 'swing' };   // nhịp có nút hành động
const KEYS: Partial<Record<InSceneId, string>> = { glider: 'inK_glider', car: 'inK_car', bike: 'inK_bike', walk: 'inK_walk' };                   // nhịp có hàng phím
const TOUCH: Partial<Record<InSceneId, string>> = { car: 'inTouch_car', bike: 'inTouch_bike', walk: 'inTouch_walk', glider: 'exDesktopOnly' };   // máy cảm ứng: một dòng thay hàng phím

const $ = (id: string) => document.getElementById(id);
let root: HTMLElement | null = null;
const segs: HTMLButtonElement[] = [];
const fills: number[] = [];      // --f đã ghi của từng đoạn
let veilEl: HTMLElement | null = null, veilA = -1;   // độ đục màn tối đã ghi
let curI = -1;
const touchDev = (): boolean => typeof matchMedia === 'function' && matchMedia('(hover: none)').matches;

/* Gắn DOM một lần: dựng 9 đoạn tiến trình, móc nút, ô ngôn ngữ (như wireLang của chooser.ts) */
export function inUiSetup(h: InUiHandlers): void {
  root = $('intro'); if (!root) return;
  veilEl = $('inVeil');
  const prog = $('inProg');
  if (prog && !segs.length) {
    let ch = -1;
    S.forEach((s, i) => {
      const b = document.createElement('button');
      b.type = 'button'; b.className = 'in-seg' + (s.chapter !== ch ? ' in-ch' : ''); ch = s.chapter;
      b.appendChild(document.createElement('i'));
      b.addEventListener('click', () => h.seek(i));
      prog.appendChild(b); segs.push(b); fills.push(-1);
    });
  }
  const on = (id: string, f: () => void) => $(id)?.addEventListener('click', f);
  on('inSkip', () => h.skip()); on('inPrev', () => h.prev()); on('inNext', () => h.next()); on('inPause', () => h.pause());
  on('inStart', () => h.skip()); on('inReplay', () => h.replay()); on('inTour', () => h.act('tour'));
  on('inAct', () => { const k = $('inAct')?.dataset.kind as InActKind | undefined; if (k) h.act(k); });
  root.querySelectorAll<HTMLButtonElement>('button[data-in-pick]').forEach((b) => b.addEventListener('click', () => h.act(b.dataset.inPick as InActKind)));
  const nm = $('inNoMore') as HTMLInputElement | null;
  nm?.addEventListener('change', () => h.noMore(nm.checked));
  const mine = $('inLang') as HTMLSelectElement | null, main = $('langSelect') as HTMLSelectElement | null;
  if (mine && main) {
    mine.innerHTML = main.innerHTML; mine.value = getLang();
    mine.addEventListener('change', () => { main.value = mine.value; main.dispatchEvent(new Event('change')); });
  }
  onChange((code) => { if (mine) mine.value = code; if (curI >= 0) inUiRender(curI); });
}

/* Hiện / ẩn lớp phủ; lúc hiện: ô dù lượn khóa trên cảm ứng, đặt lại bộ nhớ ghi */
export function inUiShow(on: boolean): void {
  if (!root) return;
  root.hidden = !on;
  if (!on) { curI = -1; delete root.dataset.scene; return; }
  const g = root.querySelector<HTMLButtonElement>('button[data-in-pick="glider"]'); if (g) g.disabled = touchDev();
  const mine = $('inLang') as HTMLSelectElement | null; if (mine) mine.value = getLang();
  veilA = -1; for (let k = 0; k < fills.length; k++) fills[k] = -1;
}

export function inUiNoMore(on: boolean): void { const nm = $('inNoMore') as HTMLInputElement | null; if (nm) nm.checked = on; }

/* Ghi chữ của nhịp i (đổi nhịp, đổi ngôn ngữ) */
export function inUiRender(i: number): void {
  if (!root) return;
  const s = S[i], id = s.id, touch = touchDev();
  curI = i;
  root.dataset.scene = id;
  const set = (eid: string, v: string) => { const e = $(eid); if (e && e.textContent !== v) e.textContent = v; };
  set('inEyebrow', '0' + s.chapter + ' — ' + t('inCh' + s.chapter));
  set('inTitle', t('inT_' + id)); set('inSub', t('inS_' + id));
  const note = id === 'daynight' ? t('inWx') : id === 'dragon' ? t('inDragonNote') : id === 'swing' ? t('inFast', { n: CONFIG.intro.swingSpeed }) + ' · ' + t('inSwingNote') : '';
  const ne = $('inNote'); if (ne) { ne.textContent = note; ne.hidden = !note; }
  /* hàng phím: "phím|nghĩa;phím|nghĩa", phím cách nhau dấu cách → mỗi phím một <kbd>; cảm ứng: một dòng .in-touch */
  const ke = $('inKeys');
  if (ke) {
    ke.textContent = '';
    const tk = touch ? TOUCH[id] : undefined, kk = KEYS[id];
    if (tk) { const sp = document.createElement('span'); sp.className = 'in-touch'; sp.textContent = t(tk); ke.appendChild(sp); }
    else if (kk && !touch) {
      for (const item of t(kk).split(';')) {
        const [keys, mean] = item.split('|'); if (!mean) continue;
        const sp = document.createElement('span'); sp.className = 'in-k';
        for (const k of keys.trim().split(/\s+/)) { const kb = document.createElement('kbd'); kb.textContent = k; sp.appendChild(kb); }
        const m = document.createElement('i'); m.textContent = mean; sp.appendChild(m);
        ke.appendChild(sp);
      }
    }
    ke.hidden = !ke.firstChild;
  }
  const act = $('inAct') as HTMLButtonElement | null, kind = ACT[id];
  if (act) {
    const show = !!kind && !(touch && kind === 'glider');   // dù lượn trên cảm ứng: không nút (dòng "Chỉ dùng trên máy tính")
    act.hidden = !show;
    if (show) { act.dataset.kind = kind; act.textContent = t('inTry_' + id); } else delete act.dataset.kind;
  }
  const end = $('inEnd'); if (end) end.hidden = id !== 'finale';
  for (let k = 0; k < segs.length; k++) {
    const f = k < i ? 1 : k > i ? 0 : fills[k] < 0 ? 0 : fills[k];
    if (fills[k] !== f) { segs[k].style.setProperty('--f', String(f)); fills[k] = f; }
    if (k === i) segs[k].setAttribute('aria-current', 'true'); else segs[k].removeAttribute('aria-current');
    segs[k].setAttribute('aria-label', '0' + S[k].chapter + ' — ' + t('inT_' + S[k].id));
  }
  /* gắn lại .in-in để chạy lại hiệu ứng vào của khối chữ */
  const cap = $('inCap');
  if (cap) { cap.classList.remove('in-in'); void cap.offsetWidth; cap.classList.add('in-in'); }
}

/* Mỗi khung: mức đầy của đoạn đang chạy (chỉ ghi khi đổi ≥ 0,005) */
export function inUiFill(i: number, f: number): void {
  if (i < 0 || i >= segs.length) return;
  if (Math.abs(f - fills[i]) < 0.005 && !(f === 1 && fills[i] !== 1)) return;
  fills[i] = f; segs[i].style.setProperty('--f', f.toFixed(3));
}

/* Mỗi khung: độ đục màn tối (chỉ ghi khi đổi quá 0,01, hoặc chạm đúng 0 / 1) */
export function inUiVeil(a: number): void {
  if (!veilEl) return;
  if (Math.abs(a - veilA) <= 0.01 && !((a === 0 || a === 1) && a !== veilA)) return;
  veilA = a; veilEl.style.opacity = a.toFixed(3);
}

/* Nút ❚❚ / ▶: chữ, aria-pressed, khóa aria (i18n.apply đọc data-i18n-aria nên đổi khóa chứ không chỉ đổi nhãn) */
export function inUiPaused(on: boolean): void {
  const b = $('inPause'); if (!b) return;
  b.textContent = on ? '▶' : '❚❚';
  b.setAttribute('aria-pressed', String(on));
  b.dataset.i18nAria = on ? 'inPlay' : 'inPause';
  b.setAttribute('aria-label', t(on ? 'inPlay' : 'inPause'));
}

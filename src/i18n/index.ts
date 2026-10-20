/* =====================================================================
   ĐA NGÔN NGỮ — bảng dịch giao diện, mặc định Tiếng Việt.
   Mỗi ngôn ngữ một file JSON trong locales/. Thêm ngôn ngữ: tạo file mới rồi khai báo trong LOCALES bên dưới.
   Chọn ngôn ngữ qua menu, hoặc link có #en, #ko, #ja, #zh, #th, #ar, #hi, #ru.
   ===================================================================== */
import vi from './locales/vi.json';
import en from './locales/en.json';
import ko from './locales/ko.json';
import ja from './locales/ja.json';
import zh from './locales/zh.json';
import th from './locales/th.json';
import ar from './locales/ar.json';
import hi from './locales/hi.json';
import ru from './locales/ru.json';

export type Locale = Record<string, unknown> & { _name: string; _dir?: 'rtl' | 'ltr' };
export type Stop = [title: string, text: string];

/* Thứ tự ở đây là thứ tự trong menu chọn ngôn ngữ */
const LOCALES: Record<string, Locale> = { vi, en, ko, ja, zh, th, ar, hi, ru } as Record<string, Locale>;

/* Font theo chữ viết — chỉ tải khi chọn ngôn ngữ đó */
const FONTS: Record<string, string> = {
  ko: 'Noto+Serif+KR:wght@600&family=Noto+Sans+KR:wght@400;500;600',
  ja: 'Noto+Serif+JP:wght@600&family=Noto+Sans+JP:wght@400;500;600',
  zh: 'Noto+Serif+SC:wght@600&family=Noto+Sans+SC:wght@400;500;600',
  th: 'Noto+Serif+Thai:wght@600&family=Noto+Sans+Thai:wght@400;500;600',
  ar: 'Noto+Naskh+Arabic:wght@600&family=Noto+Sans+Arabic:wght@400;500;600',
  hi: 'Noto+Serif+Devanagari:wght@600&family=Noto+Sans+Devanagari:wght@400;500;600',
  ru: 'Noto+Serif:wght@600&family=Noto+Sans:wght@400;500;600'
};
const STORE_KEY = 'cauRong.lang';
const listeners: ((code: string) => void)[] = [];
let lang = 'vi';

/* Chuỗi đã dịch; {tham_số} được thay bằng params. Khóa thiếu thì lấy Tiếng Việt, rồi chính khóa */
export function t(key: string, params?: Record<string, string | number> | null): string {
  let s = (LOCALES[lang] && LOCALES[lang][key]) ?? LOCALES.vi[key] ?? key;
  if (params && typeof s === 'string') s = s.replace(/\{(\w+)\}/g, (_, k) => String(params[k] ?? ''));
  return s as string;
}
/* Danh sách điểm dừng Tour (mảng [tiêu đề, lời giới thiệu]) */
export function stops(key: string): Stop[] {
  return ((LOCALES[lang] && LOCALES[lang][key]) ?? LOCALES.vi[key]) as Stop[];
}
export const getLang = () => lang;
export const onChange = (fn: (code: string) => void) => { listeners.push(fn); };

function loadFont(code: string) {
  if (!FONTS[code] || document.getElementById('font-' + code)) return;
  const l = document.createElement('link');
  l.id = 'font-' + code; l.rel = 'stylesheet';
  l.href = 'https://fonts.googleapis.com/css2?family=' + FONTS[code] + '&display=swap';
  document.head.appendChild(l);
}
export function apply(code: string) {
  if (!LOCALES[code]) code = 'vi';
  lang = code;
  const root = document.documentElement;
  root.lang = code; root.dir = LOCALES[code]._dir || 'ltr';
  loadFont(code);
  document.title = t('title');
  document.querySelectorAll<HTMLElement>('[data-i18n]').forEach((el) => { el.textContent = t(el.dataset.i18n); });
  document.querySelectorAll<HTMLElement>('[data-i18n-aria]').forEach((el) => { el.setAttribute('aria-label', t(el.dataset.i18nAria)); });
  const sel = document.getElementById('langSelect') as HTMLSelectElement;
  if (sel && sel.value !== code) sel.value = code;
  try { localStorage.setItem(STORE_KEY, code); } catch { /* bộ nhớ trình duyệt bị chặn */ }
  listeners.forEach((fn) => fn(code));
}

/* Dựng menu chọn ngôn ngữ và áp ngôn ngữ ban đầu: #mã trên link → lựa chọn đã lưu → Tiếng Việt */
export function initI18n() {
  const sel = document.getElementById('langSelect') as HTMLSelectElement;
  Object.entries(LOCALES).forEach(([code, d]) => {
    const o = document.createElement('option'); o.value = code; o.textContent = d._name; o.lang = code;
    sel.appendChild(o);
  });
  sel.addEventListener('change', () => apply(sel.value));
  let initial = 'vi';
  try { initial = localStorage.getItem(STORE_KEY) || 'vi'; } catch { /* bỏ qua */ }
  const hash = location.hash.replace('#', '');
  if (LOCALES[hash]) initial = hash;
  window.addEventListener('hashchange', () => { const h = location.hash.replace('#', ''); if (LOCALES[h]) apply(h); });
  apply(initial);
}

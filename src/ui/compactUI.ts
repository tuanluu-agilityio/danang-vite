import { CONFIG } from '../config';

/* ===== Chế độ gọn (điện thoại): body.compact + hai tờ Cài đặt / Góc nhìn (body.sheet-*) ===== */
export type Sheet = 'none' | 'settings' | 'views';

export const ui: { compact: boolean; sheet: Sheet } = { compact: false, sheet: 'none' };

/* Mỗi lúc chỉ một tờ mở; 'none' = đóng hết. aria-expanded của hai nút mở tờ theo trạng thái */
export function openSheet(s: Sheet) {
  ui.sheet = s;
  document.body.classList.toggle('sheet-settings', s === 'settings');
  document.body.classList.toggle('sheet-views', s === 'views');
  document.getElementById('btnSettings')?.setAttribute('aria-expanded', String(s === 'settings'));
  document.getElementById('btnViewsSheet')?.setAttribute('aria-expanded', String(s === 'views'));
}

export function closeSheets() { openSheet('none'); }

/* Đưa phần tử vào tầm nhìn: mở đúng tờ chứa nó (test và phím tắt dùng); phần tử ngoài hai tờ (chip .seg, nút Tour...) thì đóng hết */
export function reveal(el: Element | null) {
  if (!ui.compact || !el) return;
  if (el.closest('.brand')) openSheet('settings');
  else if (el.closest('.view-list')) openSheet('views');
  else closeSheets();
}

/* Nút mở/đóng tờ; chạm khung 3D, chọn góc nhìn, Esc thì đóng; ghi --bar-h (cao thanh dưới) cho khung chú thích Tour / Kịch bản bão */
function wireSheets() {
  const toggle = (s: Sheet) => () => openSheet(ui.sheet === s ? 'none' : s);   // bấm lại thì đóng
  document.getElementById('btnSettings')?.addEventListener('click', toggle('settings'));
  document.getElementById('btnViewsSheet')?.addEventListener('click', toggle('views'));
  document.querySelectorAll('.sheet-close').forEach((b) => b.addEventListener('click', () => closeSheets()));
  document.getElementById('scene')?.addEventListener('pointerdown', () => { if (ui.sheet !== 'none') closeSheets(); });   // thêm cạnh listener exitTour sẵn có (setupUI.ts)
  document.querySelectorAll('[data-view]').forEach((b) => b.addEventListener('click', () => { if (ui.sheet !== 'none') closeSheets(); }));
  // Esc khi có tờ mở: đóng tờ; KHÔNG chặn các listener Esc sẵn có (thoát Tour, xuống cabin vẫn chạy như trước)
  window.addEventListener('keydown', (e) => { if (e.key === 'Escape' && ui.sheet !== 'none') closeSheets(); });
  const bar = document.querySelector<HTMLElement>('.views');
  if (!bar || typeof ResizeObserver === 'undefined') return;
  // chỉ đo lúc thanh đóng: tờ Góc nhìn làm .views cao lên, tờ Cài đặt ẩn .views
  new ResizeObserver(() => { if (ui.compact && ui.sheet === 'none') document.documentElement.style.setProperty('--bar-h', bar.offsetHeight + 'px'); }).observe(bar);
}

export function setupCompactUI() {
  wireSheets();
  const mq = window.matchMedia(CONFIG.ui.compactQuery);
  const apply = () => {
    const was = ui.compact;
    ui.compact = mq.matches;
    document.body.classList.toggle('compact', ui.compact);
    if (was && !ui.compact) closeSheets();   // ra khỏi chế độ gọn: không để tờ mở dở
  };
  mq.addEventListener('change', apply);
  apply();
}

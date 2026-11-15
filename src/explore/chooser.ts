/* ============================ Tự khám phá: màn chọn phương tiện ============================
   Lớp phủ HTML (#chooser trong index.html), không thêm gì vào cảnh. Hiện sau khung đầu tiên (cảnh đã dựng phía sau)
   và chặn chuột vào canvas tới khi chọn. Chữ do data-i18n lo; ở đây chỉ khóa thẻ và gọi onPick. */

import { getLang, onChange, t } from '../i18n';
import { exMulti } from './multi';
import { exShowLobby } from './multi/lobby';

export type ExChoice = 'glider' | 'guided' | 'walk' | 'car' | 'bike';   // car: lái xe (có máy chủ thì qua sảnh 5 chỗ lái, không thì lái một mình); bike: xe máy (chung sảnh 5 chỗ lái với ô tô, phiên 'drive' veh 1)

const el = () => document.getElementById('chooser');

/* Dù lượn cần bàn phím: thiết bị cảm ứng (không có hover) thì khóa thẻ và hiện nhãn "Chỉ dùng trên máy tính". Thẻ Đi dạo không khóa (có điều khiển cảm ứng) */
function lockGliderOnTouch(root: HTMLElement): void {
  if (!window.matchMedia('(hover: none)').matches) return;
  const card = root.querySelector<HTMLButtonElement>('[data-pick="glider"]');
  if (!card) return;
  card.disabled = true;
  card.querySelector<HTMLElement>('.ex-note')?.removeAttribute('hidden');
}

/* Ô ngôn ngữ riêng của màn chọn (lớp phủ che #langSelect): chép danh sách từ #langSelect, đổi thì chuyển cho #langSelect xử lý */
function wireLang(root: HTMLElement): void {
  const mine = root.querySelector<HTMLSelectElement>('#exLang');
  const main = document.getElementById('langSelect') as HTMLSelectElement | null;
  if (!mine || !main) return;
  mine.innerHTML = main.innerHTML; mine.value = getLang();
  mine.addEventListener('change', () => { main.value = mine.value; main.dispatchEvent(new Event('change')); });
  onChange((code) => { mine.value = code; });
}

/* Màn chọn là hộp thoại modal: các khối giao diện cũ (header, panel, canvas...) đặt inert để Tab/Enter không lọt xuống dưới */
const inerted: HTMLElement[] = [];
function setUnderInert(root: HTMLElement, on: boolean): void {
  if (on) {
    for (const c of Array.from(document.body.children) as HTMLElement[]) {
      if (c === root || c.tagName === 'SCRIPT' || c.id === 'loading' || c.inert) continue;
      c.inert = true; inerted.push(c);
    }
  } else { for (const c of inerted) c.inert = false; inerted.length = 0; }
}

/* opts.defer: gắn mọi thứ như cũ nhưng chưa hiện (intro, D-045, hiện sau bằng exRevealChooser); bỏ trống thì hiện ngay như cũ */
export function exShowChooser(onPick: (choice: ExChoice) => void, onWatch: (choice: ExChoice) => void = () => {}, opts?: { defer?: boolean }): void {
  const root = el();
  if (!root) return;
  lockGliderOnTouch(root);
  /* Lần trước mất kết nối khi đang xem (explore.exit tải lại trang): đọc cờ một lần rồi xóa, hiện exMpLostChooser */
  try {
    const lost = sessionStorage.getItem('exMpNotice');   // 'lost' (xem bầu trời dù lượn) | 'lostWalk' (xem người đi dạo: câu nhắc chọn Đi dạo, vì thẻ Dù lượn bị khóa trên điện thoại) | 'lostDrive' (xem xe: nhắc chọn Ô tô) | 'lostBike' (xem xe từ thẻ Xe máy: nhắc chọn Xe máy)
    if (lost === 'lost' || lost === 'lostWalk' || lost === 'lostDrive' || lost === 'lostBike') {
      sessionStorage.removeItem('exMpNotice');
      const n = document.getElementById('exMpLostNote');
      if (n) { const k = lost === 'lostWalk' ? 'stLostChooser' : lost === 'lostDrive' ? 'drLostChooser' : lost === 'lostBike' ? 'bkLostChooser' : ''; if (k) { n.dataset.i18n = k; n.textContent = t(k); } n.hidden = false; }
    }
  } catch { /* bộ nhớ bị chặn */ }
  wireLang(root);
  /* Ảnh thẻ nạp lười (màn chọn ẩn thì chưa tải; vào thẳng `?explore=…` không tải gì): chưa xong thì trong suốt (.ld) rồi hiện dần; ảnh lỗi thì thẻ còn nền tối + chữ */
  root.querySelectorAll<HTMLImageElement>('img.ex-img').forEach((im) => {
    if (im.complete && im.naturalWidth) return;
    im.classList.add('ld');
    im.addEventListener('load', () => im.classList.remove('ld'), { once: true });
  });
  /* Không dùng { once: true }: từ sảnh bấm Quay lại / Esc thì các thẻ phải chọn lại được. Hộp đã đóng (đã chọn xong) thì bỏ qua */
  root.querySelectorAll<HTMLButtonElement>('button[data-pick]').forEach((b) => {
    if (b.disabled) return;
    b.addEventListener('click', () => {
      if (root.hidden) return;
      const choice = b.dataset.pick as ExChoice;
      /* Đánh dấu thẻ đang chọn (viền vàng, aria-pressed) và đưa ảnh của nó lên đầu sảnh; chỉ là hiển thị, luồng chọn bên dưới giữ nguyên */
      root.querySelectorAll<HTMLButtonElement>('button[data-pick]').forEach((o) => { const on = o === b; o.classList.toggle('sel', on); o.setAttribute('aria-pressed', String(on)); });
      const im = b.querySelector<HTMLImageElement>('img.ex-img');
      root.dataset.mode = choice;
      if (im && im.naturalWidth) root.style.setProperty('--ex-hero', `url("${im.currentSrc || im.src}")`); else root.style.removeProperty('--ex-hero');
      /* Dù lượn / Đi dạo / Ô tô / Xe máy có máy chủ: sang bước chọn slot + nhập tên (mở kết nối ở đây, không sớm hơn); không có máy chủ: bay / đi / lái một mình ngay như trước.
         Ô tô và Xe máy chung 5 chỗ lái (phiên 'drive'); xe máy xin chỗ với veh 1. Thẻ đã chọn đi theo onWatch: người xem chạy module của thẻ đó, nhận lời mời thì lên đúng loại xe */
      const kind = choice === 'walk' ? 'walk' : choice === 'car' || choice === 'bike' ? 'drive' : 'fly';
      if ((choice === 'glider' || choice === 'walk' || choice === 'car' || choice === 'bike') && exMulti.begin(() => {}, kind, choice === 'bike' ? 1 : 0)) {
        const solo = () => { exHideChooser(); onPick(choice); };
        exShowLobby(exMulti.session!, { onFly: solo, onWatch: () => { exHideChooser(); onWatch(choice); }, onSolo: solo, onBack: () => b.focus({ preventScroll: true }) });
        return;
      }
      exHideChooser(); onPick(choice);
    });
  });
  if (!opts?.defer) exRevealChooser();
}

/* Hiện màn chọn (đã gắn bằng exShowChooser): bỏ ẩn, inert phần dưới, focus thẻ đầu; chờ #loading.done (đặt sau khung đầu) nếu chưa có.
   Gọi nhiều lần an toàn: đang chờ hoặc đang hiện thì bỏ qua */
let revealMo: MutationObserver | null = null;
export function exRevealChooser(): void {
  const root = el();
  if (!root || revealMo || !root.hidden) return;
  const show = () => { root.hidden = false; setUnderInert(root, true); root.querySelector<HTMLButtonElement>('button[data-pick]:not(:disabled)')?.focus({ preventScroll: true }); };
  const loading = document.getElementById('loading');
  if (!loading || loading.classList.contains('done')) { show(); return; }
  const mo = new MutationObserver(() => { if (loading.classList.contains('done')) { mo.disconnect(); revealMo = null; show(); } });   // #loading.done được đặt sau khung đầu
  revealMo = mo;
  mo.observe(loading, { attributes: true, attributeFilter: ['class'] });
}

export function exHideChooser(): void {
  const root = el();
  if (root) { root.hidden = true; setUnderInert(root, false); }
}

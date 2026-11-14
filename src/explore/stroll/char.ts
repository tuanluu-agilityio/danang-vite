/* ===== Đi dạo: nhân vật người chơi chọn ở sảnh (0 nam, 1 nữ) =====
   Lựa chọn nhớ ở localStorage (như tên, multi/lobby.ts) nên giữ qua xuất phát lại, kết nối lại và tải lại trang; bộ nhớ bị chặn thì chỉ giữ trong phiên trang.
   Giá trị lạ / chưa chọn: nam (exCharNorm). Mô hình ứng với nhân vật: stCharModel (anim.ts). Lựa chọn tới máy khác qua tin join (multi/session.ts) và walkers của lobby. */
import { exCharNorm } from '../multi/protocol';

const KEY = 'stChar';
let cur = -1;   // -1: chưa đọc bộ nhớ

export const stChar = {
  get(): number {
    if (cur < 0) { try { cur = exCharNorm(Number(localStorage.getItem(KEY))); } catch { cur = 0; } }
    return cur;
  },
  set(ch: number): void {
    cur = exCharNorm(ch);
    try { localStorage.setItem(KEY, String(cur)); } catch { /* bộ nhớ trình duyệt bị chặn (hoặc không có, trong test đơn vị) */ }
  }
};

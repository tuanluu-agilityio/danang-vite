/* ============================ Lái xe máy: phần HUD riêng (xi nhan, góc nhìn, còi, về làn, gợi ý phím, nhắc khi kẹt) + bộ chuyển cảm ứng ============================
   Spec D-040 §10. Đồng hồ số km/h và bản đồ nhỏ là của ô tô (drive/hud.ts) dùng nguyên; phần này chỉ thêm các phần tử bk* trong #drHud (index.html).
   - #bkSigL / #bkSigR: đèn xi nhan (lớp 'on' khi đang bật, 'lit' ở nửa chu kỳ sáng, cùng nhịp đèn trên xe: CONFIG.bike.model.sigHz); bấm được (cảm ứng và chuột).
   - #bkStuck: "Bị kẹt? Bấm R" khi s.stuck ≥ hud.stuckS (lớp 'show'); cùng lúc #bkReset sáng lên (lớp 'hot'), trên cảm ứng chỉ có nút sáng (chữ nói phím R).
   - #bkHint: gợi ý phím (thay #drHint của ô tô, CSS ẩn #drHint khi body.bike), tự ẩn sau hud.hintMs.
   - bkHudUpdate mỗi khung chỉ ghi DOM khi xi nhan / pha nhấp nháy (khi đang bật) / trạng thái kẹt đổi (D-018: không ghi lớp thừa, không cấp phát).
   - bkTouchMerge: cảm ứng dùng nguyên drive/touch.ts (đọc vào DrInput); chép đầu vào phím BkInput sang DrInput, cho touch đọc gộp, chép lại; ô hand ⇒ hard.
   Module không đụng DOM lúc import (test đơn vị chạy trong Node, phần tử giả qua bkHudBind). */
import { CONFIG } from '../../config';
import type { BkInput } from './motion';
import type { DrInput } from '../drive/motion';

export interface BkHudNode { classList: { toggle(c: string, on: boolean): unknown } }
export interface BkHudEls { sigL: BkHudNode | null; sigR: BkHudNode | null; stuck: BkHudNode | null; reset: BkHudNode | null }

const H = CONFIG.bike.hud;
let els: BkHudEls = { sigL: null, sigR: null, stuck: null, reset: null };
let lastSig = 2, lastLit = false, lastStuck = -1;   // 2 / −1: chưa ghi lần nào (lần cập nhật sau bkHudReset luôn ghi)
let hint: HTMLElement | null = null, hintTimer = 0;

/* Pha nhấp nháy tại thời điểm t (s, shared.uTime): nửa đầu chu kỳ sáng, như model.ts / dash.ts */
export function bkBlinkOn(t: number): boolean { const ph = t * CONFIG.bike.model.sigHz; return ph - Math.floor(ph) < 0.5; }
/* Đã kẹt đủ lâu để nhắc chưa (stuck: s bị chặn mà vẫn vặn ga, motion.ts) */
export function bkStuckOn(stuck: number): boolean { return stuck >= H.stuckS; }

/* Gắn phần tử (index.ts: từ document; test: phần tử giả) */
export function bkHudBind(e: BkHudEls): void { els = e; }
/* Quên giá trị đã ghi: lần cập nhật sau ghi lại toàn bộ */
export function bkHudReset(): void { lastSig = 2; lastLit = false; lastStuck = -1; }

const tg = (n: BkHudNode | null, c: string, on: boolean): void => { if (n) n.classList.toggle(c, on); };

/* Mỗi khung: sig xi nhan (−1 phải / 0 / 1 trái), blink pha sáng (bkBlinkOn), stuck đã kẹt đủ lâu (bkStuckOn) */
export function bkHudUpdate(sig: -1 | 0 | 1, blink: boolean, stuck: boolean): void {
  const lit = sig !== 0 && blink;
  if (sig !== lastSig || lit !== lastLit) {
    lastSig = sig; lastLit = lit;
    tg(els.sigL, 'on', sig === 1); tg(els.sigL, 'lit', sig === 1 && lit);
    tg(els.sigR, 'on', sig === -1); tg(els.sigR, 'lit', sig === -1 && lit);
  }
  const k = stuck ? 1 : 0;
  if (k !== lastStuck) { lastStuck = k; tg(els.stuck, 'show', stuck); tg(els.reset, 'hot', stuck); }
}

/* Vào chế độ: ghi lại toàn bộ ở khung đầu, hiện gợi ý phím rồi hẹn giờ ẩn */
export function bkHudShow(): void {
  bkHudReset();
  if (!hint) hint = document.getElementById('bkHint');
  if (hint) hint.classList.remove('off');
  window.clearTimeout(hintTimer);
  hintTimer = window.setTimeout(() => { if (hint) hint.classList.add('off'); }, H.hintMs);
}
export function bkHudHide(): void {
  window.clearTimeout(hintTimer);
  bkHudUpdate(0, false, false);   // tắt đèn xi nhan / nhắc kẹt để lần vào sau không thấy trạng thái cũ trong khung đầu
}

/* Cảm ứng → BkInput: dr là DrInput tái dùng; read = touch.read của drive/touch.ts (gộp: giá trị có độ lớn lớn hơn thắng, không xóa phím) */
export function bkTouchMerge(bk: BkInput, dr: DrInput, read: (o: DrInput) => void): void {
  dr.gas = bk.gas; dr.brake = bk.brake; dr.steer = bk.steer; dr.hand = bk.hard;
  read(dr);
  bk.gas = dr.gas; bk.brake = dr.brake; bk.steer = dr.steer; bk.hard = dr.hand;
}

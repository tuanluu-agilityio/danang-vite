import { CONFIG } from '../../config';
import { smooth } from '../../common/math';

/* Cao độ mặt Cầu Rồng theo x: vồng nhẹ giữa sông, hạ dần xuống đường hai bờ */
export function deckY(x: number) {
  const ax = Math.abs(x), L = CONFIG.length / 2, B = CONFIG.bankX;
  if (ax >= L) return CONFIG.roadY;
  if (ax <= B) return 8.2 + (CONFIG.deckMidY - 8.2) * (1 - (ax / B) ** 2);
  return 8.2 - (8.2 - CONFIG.roadY) * smooth((ax - B) / (L - B));
}
export const flatY = () => CONFIG.roadY;

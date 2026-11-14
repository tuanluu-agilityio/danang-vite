/* ============================ Lái xe máy: đầu vào từ bàn phím (thuần) ============================
   Theo vị trí vật lý (e.code), như drive/keys.ts: bố cục không Latin vẫn dùng WASD.
   W/↑ ga, S/↓ phanh (đứng yên: dắt lùi, motion.ts lo), A/← nghiêng trái (steer +1), D/→ nghiêng phải (steer −1), hai phím trái phải triệt nhau; Space phanh gấp.
   H còi, V đổi góc nhìn, Q / E xi nhan trái / phải, R về làn: không thuộc BkInput, index.ts đọc tập phím. grip không ghi ở đây (index.ts đặt theo thời tiết).
   Không cấp phát (gọi mỗi khung). */
import type { BkInput } from './motion';

/* Các e.code chế độ xe máy ghi vào tập phím (index.ts chặn hành vi mặc định của mũi tên và Space) */
export const BK_KEYS = new Set(['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space', 'KeyH', 'KeyV', 'KeyQ', 'KeyE', 'KeyR']);

export function bkInputFromKeys(keys: Set<string>, out: BkInput): BkInput {
  out.gas = keys.has('KeyW') || keys.has('ArrowUp') ? 1 : 0;
  out.brake = keys.has('KeyS') || keys.has('ArrowDown') ? 1 : 0;
  out.steer = (keys.has('KeyA') || keys.has('ArrowLeft') ? 1 : 0) - (keys.has('KeyD') || keys.has('ArrowRight') ? 1 : 0);
  out.hard = keys.has('Space');
  return out;
}

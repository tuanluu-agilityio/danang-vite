/* ===== Dù lượn nhiều người: định dạng tin khách ⇄ máy chủ (JSON) ===== */
import { multiParams } from './params';

export type ClientMsg =
  | { t: 'join'; name: string; kind?: 'walk' | 'drive'; ch?: number; veh?: number }   // kind: 'walk' = xin chỗ đi dạo, 'drive' = chỗ lái xe; không có = chỗ bay (khách cũ). ch: nhân vật (0 nam, 1 nữ) của người đi dạo hoặc người đi xe máy; khách cũ không gửi = nam. veh: 1 = xe máy, chỉ kèm kind 'drive'; không có = ô tô (khách cũ)
  | { t: 'pos'; x: number; y: number; z: number; yaw: number; bank: number; ts?: number }   // ts: giờ gửi theo đồng hồ của khách (ms); máy chủ cũ bỏ qua
  | { t: 'pos'; x: number; y: number; z: number; yaw: number; pose: number; ts?: number }   // người đi dạo: pose (0 đứng, 1 đi, 2 chạy, 3 rơi (bản cũ: nhảy), 4 chụp ảnh), không có bank
  | { t: 'pos'; x: number; y: number; z: number; yaw: number; v: number; st: number; ts?: number }   // người lái: v tốc độ có dấu (m/s), st góc lái (rad; xe máy: bkLeanToWire(độ nghiêng)); không có bank / pose
  | { t: 'hb' }
  | { t: 'leave' };

export interface Flyer { slot: number; name: string; ch?: number; veh?: number }   // ch: nhân vật của người đi dạo / người đi xe máy (walkers, drivers; máy chủ cũ không gửi = nam); veh: loại xe (chỉ drivers; 1 xe máy, máy chủ cũ không gửi = ô tô)

/* Nhân vật đi dạo hợp lệ: 1 = nữ, mọi giá trị khác (không có, khách / máy chủ cũ, số lạ) = 0 nam */
export function exCharNorm(v: unknown): number { return v === 1 ? 1 : 0; }

/* Loại xe hợp lệ của chỗ lái: 1 = xe máy, mọi giá trị khác (không có, khách / máy chủ cũ, số lạ) = 0 ô tô */
export function exVehNorm(v: unknown): number { return v === 1 ? 1 : 0; }

/* Độ nghiêng xe máy qua trường st: máy chủ kẹp st ở ±drive.steerMax (0,56 rad, góc lái ô tô) nên gửi lean × BK_WIRE (độ nghiêng 0,7 rad vẫn lọt), bên nhận chia lại.
   Khách cũ thấy xe máy thành ô tô bẻ lái theo st (chấp nhận, spec §17.4). Số lạ (NaN) → 0 */
export const BK_WIRE = 0.8;
export function bkLeanToWire(lean: number): number {
  const w = lean * BK_WIRE, m = multiParams.drive.steerMax;
  return w > m ? m : w < -m ? -m : w === w ? w : 0;
}
export function bkLeanFromWire(st: number): number { return st === st ? st / BK_WIRE : 0; }

export type Kind = 'fly' | 'walk' | 'drive';

// f: mỗi phần tử [slot, x, y, z, yaw, bank, giờ gửi (ms)]; chỉ gồm slot có vị trí mới. Giờ gửi = ts của khách, khách cũ không gửi ts thì là giờ máy chủ nhận;
// mỗi slot một trục giờ riêng, khách nhận tự quy đổi. Máy chủ cũ (trước bản sửa giật) gửi 6 phần tử và phát lại vị trí cũ của mọi slot: khách mới nhận được cả hai dạng.
// Đi dạo: lobby thêm walkers (flyers chỉ có người bay; mỗi người đi dạo kèm ch = nhân vật họ chọn, nên máy vào sau cũng biết ngay từ lobby đầu), pos thêm w (mỗi phần tử [slot, x, y, z, yaw, pose, giờ gửi]; f luôn có, có thể rỗng); khách cũ bỏ qua trường lạ
// Lái xe: lobby thêm drivers, pos thêm d (mỗi phần tử [slot, x, y, z, yaw, v, st, giờ gửi]); máy chủ cũ không gửi drivers, khách mới thấy vậy thì lái một mình
// Xe máy (D-040): drivers kèm veh + ch, joined kind 'drive' luôn vọng veh; máy chủ cũ không vọng veh thì khách xe máy trả chỗ và lái một mình
export type ServerMsg =
  | { t: 'lobby'; flyers: Flyer[]; walkers?: Flyer[]; drivers?: Flyer[] }
  | { t: 'joined'; slot: number; kind?: 'walk' | 'drive'; veh?: number }
  | { t: 'rejected'; why: 'full' | 'name'; kind?: 'walk' | 'drive' }
  | { t: 'pos'; f: number[][]; w?: number[][]; d?: number[][] }   // d: [slot, x, y, z, yaw, v, st, giờ gửi]
  | { t: 'released' };

// Ký tự trông như khoảng trống dù thuộc nhóm chữ/ký hiệu (chữ đệm Hangul, chữ nổi trống, nguyên âm ẩn Khmer): không tính là chữ thấy được
const BLANK = /[\u115F\u1160\u3164\uFFA0\u2800\u17B4\u17B5]/gu;
const VISIBLE = /[\p{L}\p{N}\p{S}\p{P}]/u;

/* Bỏ ký tự điều khiển và bidi/định dạng (giữ U+200D để ghép emoji), cắt khoảng trắng.
   null nếu: rỗng; không có chữ/số/ký hiệu/dấu câu nào thấy được; quá nameMax grapheme; một grapheme quá graphemeCpMax code point (chồng dấu); tổng quá nameCpMax code point */
export function exSanitizeName(raw: string): string | null {
  if (typeof raw !== 'string') return null;
  const s = raw.replace(/[\p{Cc}\p{Cf}]/gu, c => (c === '\u200D' ? c : '')).trim();
  if (!s || !VISIBLE.test(s.replace(BLANK, ''))) return null;
  const seg = new Intl.Segmenter(undefined, { granularity: 'grapheme' });
  let n = 0, cps = 0;
  for (const g of seg.segment(s)) {
    let k = 0;
    for (const _ of g.segment) k++;
    cps += k;
    if (++n > multiParams.nameMax || k > multiParams.graphemeCpMax || cps > multiParams.nameCpMax) return null;
  }
  return s;
}

/* ===== Trò chuyện theo khoảng cách (D-041): lõi phía khách (không DOM, không three) =====
   Sổ tin của phiên (tin mình chờ hồi âm, tin người khác, chưa đọc, giới hạn tần suất) và danh sách người ở gần có trễ hai ngưỡng.
   Mọi con số truyền vào từ multiParams.chat; phần DOM (chat.ts) chỉ vẽ theo những gì ở đây trả ra. */
import type { ChatWhy, Kind } from './protocol';

/* pending: chờ chatAck; ok: đã tới n ≥ 1 người; alone: không ai ở gần (n = 0); fail: quá hạn / mất kết nối / không giữ chỗ / rỗng; rate: gửi quá nhanh; bad: có từ tục */
export type ChState = 'pending' | 'ok' | 'alone' | 'fail' | 'rate' | 'bad';
// key: số thứ tự duy nhất trong phiên (khóa DOM); id: số ghép chatAck (chỉ tin mình, tin người khác 0); tin mình: k 'fly', slot −1, name '' (bên vẽ dựa vào mine); at: giờ thêm (ms)
export interface ChMsg { key: number; id: number; mine: boolean; k: Kind; slot: number; name: string; text: string; at: number; state: ChState; n: number }
// Người khác cùng phòng: vị trí nội suy (m)
export interface ChPeer { k: Kind; slot: number; name: string; x: number; y: number; z: number }

/* Khóa một người: loại + slot (ba nhóm slot riêng nên cùng slot khác loại là hai người) */
export const chKey = (k: Kind, slot: number): string => k + ':' + slot;

/* Người ở gần (trễ hai ngưỡng): vào khi d ≤ nearIn, đã có trong prev thì ở lại tới d ≤ radius; khoảng cách 3D từ vị trí mình vừa gửi; giữ thứ tự peers */
export function chNear(self: { x: number; y: number; z: number } | null, peers: ChPeer[], prev: ReadonlySet<string>, nearIn: number, radius: number): ChPeer[] {
  if (!self) return [];
  const out: ChPeer[] = [];
  for (const p of peers) {
    const dx = p.x - self.x, dy = p.y - self.y, dz = p.z - self.z;
    const d = Math.sqrt(dx * dx + dy * dy + dz * dz);
    if (d <= nearIn || (d <= radius && prev.has(chKey(p.k, p.slot)))) out.push(p);
  }
  return out;
}

/* ===== Sổ tin của một phiên (chỉ trong bộ nhớ; phiên mới thì clear) ===== */
export class ChLog {
  readonly list: ChMsg[] = [];
  unread = 0;
  private nextKey = 1;    // không đặt lại khi clear: khóa DOM không lặp
  private nextId = 1;
  private sent: number[] = [];   // giờ các tin mình đã gửi trong rateWinMs gần nhất (cùng cách tính với máy chủ)

  constructor(private historyMax: number, private ackMs: number, private ratePerWin: number, private rateWinMs: number) {}

  /* Hạn mức phía khách: < ratePerWin tin trong cửa sổ trượt rateWinMs (máy chủ cũng chặn, đây chỉ để khỏi gửi tin chắc chắn bị từ chối) */
  canSend(now: number): boolean {
    this.sent = this.sent.filter(t => now - t < this.rateWinMs);
    return this.sent.length < this.ratePerWin;
  }

  addMine(text: string, now: number): ChMsg {
    const m: ChMsg = { key: this.nextKey++, id: this.nextId++, mine: true, k: 'fly', slot: -1, name: '', text, at: now, state: 'pending', n: 0 };
    this.list.push(m); this.sent.push(now);
    return m;
  }

  addTheirs(k: Kind, slot: number, name: string, text: string, now: number, panelOpen: boolean): ChMsg {
    const m: ChMsg = { key: this.nextKey++, id: 0, mine: false, k, slot, name, text, at: now, state: 'ok', n: 0 };
    this.list.push(m);
    if (!panelOpen) this.unread++;
    return m;
  }

  /* Hồi âm: chỉ đổi tin mình đang pending (hồi âm trễ sau khi đã fail không đổi lại); trả tin vừa đổi, null nếu không có */
  ack(id: number, n: number | undefined, why: ChatWhy | undefined): ChMsg | null {
    const m = this.list.find(x => x.mine && x.id === id && x.state === 'pending');
    if (!m) return null;
    if (typeof n === 'number' && n >= 1) { m.state = 'ok'; m.n = n; }
    else if (n === 0) m.state = 'alone';
    else m.state = why === 'rate' ? 'rate' : why === 'bad' ? 'bad' : 'fail';
    return m;
  }

  /* Tin pending đã chờ ≥ ackMs thành fail; trả các tin vừa đổi */
  expire(now: number): ChMsg[] {
    const out: ChMsg[] = [];
    for (const m of this.list) if (m.state === 'pending' && now - m.at >= this.ackMs) { m.state = 'fail'; out.push(m); }
    return out;
  }

  /* Mất kết nối: mọi tin pending thành fail */
  failAll(): ChMsg[] {
    const out: ChMsg[] = [];
    for (const m of this.list) if (m.state === 'pending') { m.state = 'fail'; out.push(m); }
    return out;
  }

  /* Gỡ tin cũ nhất tới khi còn ≤ historyMax; trả tin bị gỡ (bên vẽ xóa phần tử DOM tương ứng) */
  trim(): ChMsg[] {
    return this.list.length > this.historyMax ? this.list.splice(0, this.list.length - this.historyMax) : [];
  }

  read(): void { this.unread = 0; }

  clear(): void { this.list.length = 0; this.unread = 0; this.sent = []; }
}

/* ===== Trò chuyện theo khoảng cách (D-041): nút 💬, bảng tin, phím, đồng hồ danh sách gần =====
   Phần DOM của chat; sổ tin và quy tắc gần ở chatCore.ts, bong bóng trên đầu ở labels.ts (exLabelsSay). index.ts gọi attach / sync / detach / setSelf.
   - body.ex-chat: phiên từng có chatOk (máy chủ biết chat) và đang giữ chỗ / đang xem / vừa mất kết nối; CSS chỉ hiện nút khi body.explore.ex-chat.
   - Danh sách gần: setInterval(nearTickMs) từ attach tới detach, ngoài vòng vẽ; chỉ ghi DOM khi khóa danh sách đổi. Vòng vẽ chỉ gọi setSelf (5 lần/s, không cấp phát).
   - Mỗi tin một nút DOM, không dựng lại cả danh sách; quá historyMax thì gỡ nút cũ nhất. Mọi chữ từ mạng ghi bằng textContent.
   - Trình nghe gắn một lần lúc nạp module trên phần tử cố định (index.html), không gắn / gỡ theo lần mở bảng. */
import { CONFIG } from '../../config';
import { t, onChange as onLang } from '../../i18n';
import { exSanitizeChat } from './protocol';
import { ChLog, chKey, chNear, type ChMsg, type ChPeer } from './chatCore';
import { exRemotes } from './remote';
import { stAvatars } from '../stroll/avatars';
import { exDrivers } from './remoteDrive';
import { exLabelsSay } from './labels';
import type { MultiSession } from './session';

const M = CONFIG.explore.multi, C = M.chat, NW = M.stroll.slots, ND = M.drive.slots;
const log = new ChLog(C.historyMax, C.ackMs, C.ratePerWin, C.rateWinMs);   // giờ trong sổ là Date.now() (cùng đồng hồ cho hạn hồi âm, hạn mức và giờ HH:MM)
interface Els { btn: HTMLButtonElement; near: HTMLElement; dot: HTMLElement; panel: HTMLElement; status: HTMLElement; list: HTMLElement; form: HTMLFormElement; input: HTMLTextAreaElement; send: HTMLButtonElement }
let el: Els | null = null;
const rows = new Map<number, { row: HTMLElement; st: HTMLElement | null }>();   // khóa tin → nút DOM của tin + dòng trạng thái (chỉ tin mình)
let session: MultiSession | null = null;
let had = false;          // phiên này từng có chatOk (mất kết nối thì chatOk về false nhưng vẫn hiện để thấy trạng thái)
let avail = false;        // body.ex-chat đang bật
let opened = false;       // bảng đang mở
let locked = true;        // khóa gửi (không ai ở gần / đang xem / mất kết nối)
let timer = 0;            // setInterval nearTickMs
let self: { x: number; y: number; z: number } | null = null;   // vị trí mình vừa gửi lên máy chủ (đúng cái máy chủ biết)
let prev: Set<string> = new Set();   // khóa người ở gần lần trước (trễ hai ngưỡng)
let near: ChPeer[] = [];
let nearKey = '';         // khóa + tên danh sách gần đang vẽ ('' = rỗng)

const ERR = new Set(['fail', 'rate', 'bad']);
const two = (v: number) => (v < 10 ? '0' : '') + v;
const hhmm = (ms: number) => { const d = new Date(ms); return two(d.getHours()) + ':' + two(d.getMinutes()); };

/* Chữ dòng trạng thái của tin mình */
function stText(m: ChMsg): string {
  switch (m.state) {
    case 'pending': return t('chatSending');
    case 'ok': return '✓';
    case 'alone': return t('chatAlone');
    case 'rate': return t('chatRate');
    case 'bad': return t('chatBad');
    default: return t('chatFail');
  }
}

/* Ghi lại đúng dòng trạng thái của một tin mình */
function paintState(m: ChMsg): void {
  const r = rows.get(m.key);
  if (!r || !r.st) return;
  r.st.textContent = stText(m);
  r.st.title = m.state === 'ok' ? t('chatSent', { n: m.n }) : '';
  r.st.className = 'ex-chat-st' + (ERR.has(m.state) ? ' err' : '');
}

/* Thêm một tin vào cuối bảng: dòng đầu (chấm màu slot, tên, giờ), thân chữ, và dòng trạng thái với tin mình. Đang ở gần cuối hoặc tin mình thì cuộn xuống cuối */
function addRow(m: ChMsg): void {
  if (!el) return;
  const L = el.list, stick = m.mine || L.scrollHeight - L.scrollTop - L.clientHeight < 40;
  const slot = m.mine ? (session ? session.mySlot : -1) : m.slot, name = m.mine ? (session ? session.name : '') : m.name;
  const row = document.createElement('div'); row.className = 'ex-chat-msg' + (m.mine ? ' me' : '');
  const head = document.createElement('div'); head.className = 'ex-chat-head';
  const dot = document.createElement('i'); dot.style.background = slot >= 0 ? M.colors[slot % M.colors.length] : 'var(--gold)';
  const nm = document.createElement('b'); nm.dir = 'auto'; nm.textContent = name;
  const tm = document.createElement('span'); tm.textContent = hhmm(m.at);
  head.append(dot, nm, tm);
  const body = document.createElement('div'); body.className = 'ex-chat-body'; body.dir = 'auto'; body.textContent = m.text;
  row.append(head, body);
  let st: HTMLElement | null = null;
  if (m.mine) { st = document.createElement('div'); row.appendChild(st); }
  rows.set(m.key, { row, st });
  L.appendChild(row);
  if (m.mine) paintState(m);
  for (const g of log.trim()) { const r = rows.get(g.key); if (r) { r.row.remove(); rows.delete(g.key); } }
  if (stick) L.scrollTop = L.scrollHeight;
}

/* Chấm đỏ chưa đọc: chỉ khi bảng đóng */
function paintDot(): void { if (el) el.dot.hidden = opened || log.unread === 0; }

/* Nút gửi khóa khi khóa gửi hoặc ô rỗng */
function paintSend(): void { if (el) el.send.disabled = locked || el.input.value.trim() === ''; }

/* Dòng trạng thái + khóa gửi theo pha và danh sách gần */
function paintStatus(): void {
  if (!el) return;
  const ph = session ? session.phase : 'solo';
  let txt: string, lock = true;
  if (ph === 'flying') {
    if (near.length === 0) txt = t('chatNone');
    else { lock = false; txt = near.length === 1 ? t('chatOne', { name: '\u2068' + near[0].name + '\u2069' }) : t('chatMany', { n: near.length }); }   // tên bọc cô lập hướng chữ
  } else txt = t(ph === 'watching' ? 'chatWatch' : 'chatLost');
  if (el.status.textContent !== txt) el.status.textContent = txt;
  if (lock !== locked) { locked = lock; el.input.disabled = lock; }
  paintSend();
}

/* Huy hiệu số người ở gần + dòng trạng thái */
function paintNear(): void {
  if (!el) return;
  el.near.hidden = near.length === 0;
  el.near.textContent = near.length ? String(near.length) : '';
  paintStatus();
}

/* Nút nháy một lần khi có người mới vào tầm (gỡ lớp ở animationend; đang nháy thì chạy lại từ đầu) */
function pulse(): void {
  if (!el) return;
  const b = el.btn;
  if (b.classList.contains('pulse')) { b.classList.remove('pulse'); void b.offsetWidth; }
  b.classList.add('pulse');
}

/* Người khác cùng phòng có trạng thái (bỏ mình và người chưa có mẫu) */
function peers(s: MultiSession): ChPeer[] {
  const out: ChPeer[] = [];
  for (let i = 0; i < M.slots; i++) {
    if (s.kind === 'fly' && i === s.mySlot) continue;
    const st = exRemotes.slotState(i), nm = exRemotes.name(i);
    if (st && nm !== null) out.push({ k: 'fly', slot: i, name: nm, x: st.pos.x, y: st.pos.y, z: st.pos.z });
  }
  for (let i = 0; i < NW; i++) {
    if (i === stAvatars.self || (s.kind === 'walk' && i === s.mySlot)) continue;
    const st = stAvatars.slotState(i), nm = stAvatars.name(i);
    if (st && nm !== null) out.push({ k: 'walk', slot: i, name: nm, x: st.x, y: st.y, z: st.z });
  }
  for (let i = 0; i < ND; i++) {
    if (s.kind === 'drive' && i === s.mySlot) continue;
    const st = exDrivers.slotState(i), nm = exDrivers.name(i);
    if (st && nm !== null) out.push({ k: 'drive', slot: i, name: nm, x: st.x, y: st.y, z: st.z });
  }
  return out;
}

/* Đồng hồ nearTickMs: tin chờ quá hạn thành "Chưa gửi được"; tính lại danh sách gần (chỉ khi đang giữ chỗ), ghi DOM khi khóa đổi */
function tick(): void {
  const s = session;
  if (!s || !avail) return;
  for (const m of log.expire(Date.now())) paintState(m);
  if (s.phase !== 'flying') return;
  near = chNear(self, peers(s), prev, C.nearIn, C.radius);
  const key = near.map(p => chKey(p.k, p.slot) + '=' + p.name).join('|');
  if (key === nearKey) return;
  nearKey = key;
  const next = new Set<string>();
  let fresh = false;
  for (const p of near) { const k = chKey(p.k, p.slot); next.add(k); if (!prev.has(k)) fresh = true; }
  prev = next;
  if (fresh) pulse();
  paintNear();
}

/* Quên danh sách gần (không giữ chỗ / rời phiên) */
function dropNear(): void { self = null; prev = new Set(); near = []; nearKey = ''; paintNear(); }

/* Gửi chữ trong ô: rỗng sau khi làm sạch thì thôi; quá hạn mức thì hiện tin "gửi nhanh quá" mà không gửi; transport không nhận thì "Chưa gửi được" ngay */
function send(): void {
  if (!el || !session || locked) return;
  const text = exSanitizeChat(el.input.value);
  if (text === null) return;
  const now = Date.now();
  const m = log.canSend(now) ? log.addMine(text, now) : log.addMine(text, now, true);
  if (m.state === 'pending' && !session.sendChat(text, m.id)) m.state = 'fail';
  addRow(m);
  el.input.value = ''; fit(); paintSend();
  el.input.focus();
}

/* Ô nhập tự cao theo nội dung (CSS max-height giữ ≤ 4 dòng) */
function fit(): void {
  if (!el) return;
  const i = el.input;
  i.style.height = 'auto';
  i.style.height = (i.scrollHeight + 2) + 'px';   // + viền trên dưới (box-sizing border-box)
}

export const exChat = {
  onActivity: (() => {}) as () => void,   // index.ts gán = () => exMulti.activity(): gõ trong ô chat tính là còn đó

  /* Gắn phiên mới: móc onChat / onChatAck, bật đồng hồ nearTickMs */
  attach(s: MultiSession): void {
    exChat.detach();
    session = s;
    s.onChat = (c) => {
      if (s !== session) return;
      const text = exSanitizeChat(c.text);   // máy chủ đã làm sạch; làm lại để máy chủ lạ không chèn ký tự điều khiển / bidi
      if (text === null) return;
      addRow(log.addTheirs(c.k, c.slot, c.name, text, Date.now(), opened));
      exLabelsSay(c.k, c.slot, text, performance.now());
      paintDot();
    };
    s.onChatAck = (a) => { if (s !== session) return; const m = log.ack(a.id, a.n, a.why); if (m) paintState(m); };
    timer = window.setInterval(tick, C.nearTickMs);
  },

  /* Gọi trong s.onChange: hiện / ẩn, dòng trạng thái; mất kết nối thì mọi tin đang chờ thành "Chưa gửi được" */
  sync(s: MultiSession): void {
    if (s !== session) return;
    if (s.chatOk) had = true;
    const on = had && (s.phase === 'flying' || s.phase === 'watching' || (s.phase === 'solo' && s.notice === 'lost'));
    if (on !== avail) { avail = on; document.body.classList.toggle('ex-chat', on); if (!on) exChat.close(); }
    if (s.phase === 'solo') for (const m of log.failAll()) paintState(m);
    if (s.phase !== 'flying') dropNear(); else paintStatus();
  },

  /* exMulti.end(): dừng đồng hồ, xóa sổ + DOM, đóng bảng, bỏ lớp body */
  detach(): void {
    clearInterval(timer); timer = 0;
    if (session) { session.onChat = () => {}; session.onChatAck = () => {}; }
    session = null; had = false;
    log.clear(); rows.clear();
    if (el) el.list.textContent = '';
    exChat.close();
    avail = false; document.body.classList.remove('ex-chat');
    dropNear(); paintDot();
  },

  /* Vị trí mình vừa gửi lên máy chủ (index.ts, ≤ sendHz lần/s); không cấp phát */
  setSelf(x: number, y: number, z: number): void {
    if (self) { self.x = x; self.y = y; self.z = z; } else self = { x, y, z };
  },

  open(): void {
    if (!el || !avail) return;
    if (!opened) { opened = true; el.panel.hidden = false; el.btn.setAttribute('aria-expanded', 'true'); }
    log.read(); paintDot();
    el.list.scrollTop = el.list.scrollHeight;
  },

  /* Đóng bảng; luôn bỏ focus ô nhập (không thì WASD vẫn bị isField nuốt) */
  close(): void {
    if (!el) return;
    if (document.activeElement === el.input) el.input.blur();
    if (!opened) return;
    opened = false; el.panel.hidden = true; el.btn.setAttribute('aria-expanded', 'false');
    paintDot();
  },

  get isOpen(): boolean { return opened; },

  /* Cho test (?test): trạng thái giao diện chat */
  debug(): { available: boolean; open: boolean; near: string[]; unread: number; count: number; status: string; canSend: boolean; self: { x: number; y: number; z: number } | null } {
    return { available: avail, open: opened, near: near.map(p => p.name), unread: log.unread, count: log.list.length, status: el ? el.status.textContent : '', canSend: !locked, self: self ? { ...self } : null };
  }
};

/* ===== Gắn trình nghe một lần (phần tử cố định trong index.html) ===== */
function bind(): void {
  const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T | null;
  const btn = $<HTMLButtonElement>('exChatBtn'), panel = $('exChat'), input = $<HTMLTextAreaElement>('exChatIn'), form = $<HTMLFormElement>('exChatForm');
  if (!btn || !panel || !input || !form) return;
  el = { btn, near: $('exChatNear')!, dot: $('exChatDot')!, panel, status: $('exChatStatus')!, list: $('exChatList')!, form, input, send: $<HTMLButtonElement>('exChatSend')! };
  input.placeholder = t('chatPlaceholder');
  input.disabled = true;
  btn.addEventListener('click', () => {
    if (opened) { exChat.close(); return; }
    exChat.open();
    if (!locked && window.matchMedia?.('(hover: hover)').matches) input.focus();   // máy cảm ứng: không tự bật bàn phím ảo che màn hình
  });
  btn.addEventListener('animationend', () => btn.classList.remove('pulse'));
  form.addEventListener('submit', (e) => { e.preventDefault(); send(); });
  input.addEventListener('input', () => { fit(); paintSend(); });
  input.addEventListener('keydown', (e) => {
    exChat.onActivity();
    if (e.key === 'Escape') {
      e.stopPropagation();   // không nổi bọt tới window (explore/index.ts thoát chế độ)
      if (e.isComposing || e.keyCode === 229) return;   // đang gõ bộ gõ (IME): để IME hủy phần đang soạn, không đóng bảng
      e.preventDefault(); exChat.close(); return;   // chỉ đóng bảng
    }
    if (e.key === 'Enter' && !e.shiftKey && !e.isComposing && e.keyCode !== 229) { e.preventDefault(); send(); }   // Shift + Enter xuống dòng; đang gõ bộ gõ (IME) thì không gửi
  });
  /* Enter ngoài ô nhập / nút: mở bảng và đưa focus vào ô */
  window.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter' || e.shiftKey || e.ctrlKey || e.metaKey || e.altKey || e.isComposing) return;
    const tg = e.target as HTMLElement | null;
    if (tg && /^(INPUT|TEXTAREA|SELECT|BUTTON)$/.test(tg.tagName)) return;
    const b = document.body.classList;
    if (!b.contains('explore') || !b.contains('ex-chat')) return;
    e.preventDefault();
    exChat.open();
    if (!locked) input.focus();
  });
  onLang(() => {
    input.placeholder = t('chatPlaceholder');
    paintStatus();
    for (const m of log.list) if (m.mine) paintState(m);
  });
}
if (typeof document !== 'undefined') bind();

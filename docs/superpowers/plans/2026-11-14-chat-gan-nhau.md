# Trò chuyện theo khoảng cách (D-041) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Người đang giữ chỗ (dù lượn, đi dạo, ô tô, xe máy) gõ chữ nói chuyện được với những người cách mình ≤ 150 m; máy chủ quyết ai nhận.

**Architecture:** Thêm tin `chat` / `chatAck` vào phòng `SkyRoom` sẵn có (Durable Object `sky`): máy chủ lấy danh tính từ kết nối, tính khoảng cách 3D giữa các `Slot.pos` nó đang giữ và gửi riêng cho từng người trong bán kính. Phía khách: `MultiSession` thêm gửi / nhận chat, `chatCore.ts` (thuần) giữ sổ tin + danh sách gần, `chat.ts` (DOM) vẽ nút + bảng, `labels.ts` thêm bong bóng DOM.

**Tech Stack:** Vite 6, TypeScript 5.9 (`strict: false`), three@0.165 (không dùng cho chat), Cloudflare Worker + Durable Object (`server/multi`), `tsx --test` cho test đơn vị, Playwright Chromium (SwiftShader) + bot WebSocket Node cho test trình duyệt.

**Spec:** `docs/superpowers/specs/2026-11-14-chat-gan-nhau-design.md` (đọc trước; mọi số và câu chữ lấy từ đó).

**Thư mục làm việc:** worktree `D:\2026 - Tuan\danang-vite\.worktrees\chat-gan-nhau`, nhánh `feature/chat-gan-nhau` (từ `feature/xe-may` `870f27b`). Không có `node_modules` riêng ở gốc: Node tự tìm lên `D:\2026 - Tuan\danang-vite\node_modules` (đã kiểm: `typecheck` sạch, `test:multi:unit` 98/98). **Không `npm ci` / `npm install` ở gốc worktree, không tạo junction.** Riêng `server/multi` cần `npm --prefix server/multi ci` (Task 1) để có `wrangler`.

## Global Constraints

- Đọc `.github/copilot-instructions.md` §3, §6 và `.github/instructions/*.instructions.md` có `applyTo` khớp vùng sửa trước khi sửa.
- Không thư viện runtime mới. Không biến môi trường mới. Không đổi `wrangler.toml`. **Không deploy** (`npm --prefix server/multi run deploy` bị cấm trong plan này). Không bao giờ nối Worker thật `danang-sky` trong test.
- Mọi số ở `src/explore/multi/params.ts` khối `chat` (đi vào `CONFIG.explore.multi.chat`); mỗi dòng chú thích tiếng Việt, đơn vị, `(ước lượng)`.
- Khóa i18n mới tiền tố `chat` có đủ ở `src/i18n/locales/{vi,en,ko,ja,zh,th,ar,hi,ru}.json`.
- Chữ từ mạng chỉ hiện bằng `textContent`. Không `innerHTML` / `insertAdjacentHTML` trong `chat.ts`, `labels.ts`.
- Không cấp phát mỗi khung trong vòng vẽ (D-018). 0 lệnh vẽ, 0 program thêm.
- Tương thích hai chiều: khách cũ + máy chủ mới và khách mới + máy chủ cũ đều không lỗi (spec §6, §10).
- Comment tiếng Việt, khối tiêu đề `/* ===== ... ===== */`, dòng dài "một dòng một ý" như file xung quanh; không format lại file sẵn có.
- `npm run typecheck` sau mọi thay đổi `.ts`. Số kiểm đang đạt của `test:multi:unit` (98), `test:stroll:unit`, `test:drive:unit`, `test:bike:unit` không được giảm; không sửa kỳ vọng test cũ, trừ ca so nguyên `lobby` (thêm `chat: 1`).
- Test trình duyệt nặng (`test:chat`) chỉ chạy ở Task 4; trước khi chạy kiểm không còn tiến trình `*-check.mjs` / `wrangler` mồ côi. `wrangler dev` của test chat dùng cổng **8797** (8799 / 8798 là của test khác).
- Commit sau mỗi task, thông điệp tiếng Việt kiểu `feat(chat): …`, kết bằng dòng `Co-Authored-By: Claude Fable 5.2 <noreply@anthropic.com>`.

## Review Focus

1. Đang gõ bộ gõ (IME: tiếng Việt Telex, Nhật, Hàn, Trung) bấm Enter để chốt chữ: không được gửi tin dở. → Task 3 (xử lý `isComposing`), Task 4 mục 6.
2. Esc trong ô chat chỉ đóng bảng; không thoát chế độ (thoát là tải lại trang, mất chỗ). → Task 3, Task 4 mục 6.
3. Trang mới gặp máy chủ cũ (không có `lobby.chat`) và khách cũ gặp tin `chat`: không lỗi, không hiện nút vô dụng. → Task 2 (test phiên), Task 1 (test phòng với khách không hiểu chat).
4. Nút chat nằm trên lớp vuốt cảm ứng `#stLook` / `#drLook` và không bị HUD che ở cả bốn chế độ, khung điện thoại 390 × 844 lẫn `dir=rtl`. → Task 4 mục 10 (`elementFromPoint`).
5. Chuỗi dài không khoảng trắng / chồng dấu không làm vỡ bảng hay bong bóng. → Task 1 (`marksMax`), Task 3 (CSS `overflow-wrap:anywhere`), Task 4 mục 4.

---

### Task 1: Giao thức dùng chung + máy chủ

**Files:**
- Modify: `src/explore/multi/params.ts` (thêm khối `chat` trước `clockSlewMs`)
- Modify: `src/explore/multi/protocol.ts`
- Modify: `server/multi/src/badwords.ts`, `server/multi/src/room.ts`
- Test: `tests/multi-unit/chatRoom.test.ts` (mới), `tests/multi-unit/chatText.test.ts` (mới); sửa ca so nguyên `lobby` trong `tests/multi-unit/room.test.ts`; thêm mục vào `tests/multi-unit/worker.integration.mjs`

**Interfaces — Produces:**

```ts
// params.ts
chat: { radius: 150, nearIn: 140, textMax: 200, linesMax: 4, marksMax: 4, msgBytes: 1024, ratePerWin: 5, rateWinMs: 10000,
        ackMs: 4000, nearTickMs: 500, bubbleMs: 5000, bubbleChars: 60, historyMax: 60 }
// protocol.ts
export type ChatWhy = 'slot' | 'rate' | 'empty' | 'bad';
ClientMsg  |= { t: 'chat'; text: string; id: number }
ServerMsg  lobby thêm  chat?: 1
ServerMsg  |= { t: 'chat'; k: Kind; slot: number; name: string; text: string }
           |  { t: 'chatAck'; id: number; n?: number; why?: ChatWhy }
export function exSanitizeChat(raw: unknown): string | null;   // spec §7
// badwords.ts
export function exIsBadText(text: string): boolean;            // so theo từ, spec §7
```

`SkyRoom.message` nhận `{t:'chat'}` theo thứ tự kiểm: (1) không giữ slot → `chatAck why 'slot'`; (2) kết nối đã có `ratePerWin` tin trong `rateWinMs` → `why 'rate'` (tin bị từ chối không tính vào hạn mức); (3) `exSanitizeChat` trả `null` → `'empty'`; (4) `exIsBadText` → `'bad'`; (5) đặt `seen = now` cho người gửi, gửi `{t:'chat', k, slot, name, text}` riêng tới từng slot đủ điều kiện (spec §5: mọi nhóm, khác người gửi, `pos` khác `null`, `now − seen ≤ slotTimeoutMs`, khoảng cách 3D `≤ radius`; người gửi chưa có `pos` thì không ai nhận), rồi `chatAck { id, n }` tới người gửi. `id` không phải số nguyên an toàn thì coi là 0. Giới hạn kích thước: gói dài hơn `chat.msgBytes` bỏ; gói không phải `chat` dài hơn `maxMsgBytes` bỏ như cũ. `lobby()` luôn kèm `chat: 1`.

- [ ] **Step 1:** `npm --prefix server/multi ci` (chỉ trong `server/multi`). Kiểm: `ls server/multi/node_modules/.bin/wrangler*` có.

- [ ] **Step 2: Viết test thất bại `tests/multi-unit/chatText.test.ts`** (`node:test`, mẫu import như `room.test.ts`):

```ts
test('exSanitizeChat: giữ chữ thường, cắt khoảng trắng', () => { assert.equal(exSanitizeChat('  xin chào  '), 'xin chào'); });
test('exSanitizeChat: rỗng / chỉ trắng / chỉ ký tự ẩn / không phải chuỗi → null', () => {
  for (const v of ['', '   ', '\n\n', '\u200B\u200E', '\u3164', 5, null, undefined, {}]) assert.equal(exSanitizeChat(v as any), null);
});
test('exSanitizeChat: bỏ điều khiển và bidi, giữ xuống dòng và ZWJ', () => {
  assert.equal(exSanitizeChat('a\u0000b\u202Ec\r\nd'), 'abc\nd');
  assert.equal(exSanitizeChat('👨\u200D👩\u200D👧'), '👨\u200D👩\u200D👧');
});
test('exSanitizeChat: giữ ZWNJ (hi / fa), bỏ surrogate lẻ', () => {
  assert.equal(exSanitizeChat('a‌b'), 'a‌b');
  assert.equal(exSanitizeChat('a\uD83Db'), 'ab');
  assert.ok(JSON.stringify({ t: 'chat', id: 1, text: exSanitizeChat('\uD83D'.repeat(300) + 'x') }).length < 1024);
});
test('exSanitizeChat: tối đa 4 dòng, phần sau nối bằng khoảng trắng', () => { assert.equal(exSanitizeChat('1\n2\n3\n4\n5\n6'), '1\n2\n3\n4 5 6'); });
test('exSanitizeChat: cắt 200 code point (emoji tính 1)', () => {
  assert.equal([...exSanitizeChat('x'.repeat(500))!].length, 200);
  assert.equal([...exSanitizeChat('😀'.repeat(300))!].length, 200);
});
test('exSanitizeChat: dấu chồng quá 4 liên tiếp bị dồn còn 4', () => { assert.equal(exSanitizeChat('a' + '\u0301'.repeat(50) + 'b'), 'a' + '\u0301'.repeat(4) + 'b'); });
test('exSanitizeChat: HTML giữ nguyên là chữ', () => { assert.equal(exSanitizeChat('<img src=x onerror=alert(1)>'), '<img src=x onerror=alert(1)>'); });
test('exIsBadText: chặn theo từ, không chặn chuỗi con', () => {
  for (const s of ['fuck you', 'đồ lồn', 'du ma may', 'what a BITCH']) assert.equal(exIsBadText(s), true, s);
  for (const s of ['cut the rope', 'mishit', 'Dickson ơi', 'lớn quá', 'buổi sáng đẹp', 'các bạn', 'cac ban oi', 'lon nuoc', 'hello <b>']) assert.equal(exIsBadText(s), false, s);
});
```

- [ ] **Step 3: Viết test thất bại `tests/multi-unit/chatRoom.test.ts`.** Hàm phụ: `J`, `mk(r, id, kind, name, x, y, z, now)` (connect + join kind + một `pos` hợp lệ theo loại: `bank` / `pose` / `v`+`st`), `chat(r, id, text, now, id = 1)`, `to(outs, id)` = các `msg` gửi riêng tới `id`. Tọa độ gốc dùng `(0, 10, 0)` (nằm trong khung cả ba loại; người bay `y` ≥ 7). Các ca (mỗi ca một `test`, tên tiếng Việt):
  1. trong tầm: A (walk) tại 0, B (walk) cách 100 m theo x → B nhận đúng một `{t:'chat', k:'walk', slot:0, name:'A', text:'chào'}`; A nhận `{t:'chatAck', id:1, n:1}`; không có `Out` nào `to: 'all'`.
  2. ngoài tầm: C cách 150,5 m không nhận; `n` chỉ đếm người trong tầm.
  3. đúng biên: người cách đúng 150 m (x = 150, cùng y, z) nhận.
  4. khoảng cách 3D: người bay cùng x, z nhưng cao hơn 200 m không nhận; cao hơn 100 m nhận.
  5. khác loại: walk gửi, drive (xe máy `veh: 1`) cách 60 m và fly cách 90 m đều nhận; `k` trong tin là `'walk'`.
  6. ba người một vùng: A gửi → B, C nhận; B gửi → A, C nhận (`k`, `slot`, `name` đúng B).
  7. ra khỏi tầm: B gửi `pos` mới cách 400 m → tin kế của A có `n: 0`, B không nhận; B quay lại 50 m → nhận tin sau đó.
  8. không giữ slot (mới `connect`): `chatAck why 'slot'`, không ai nhận.
  9. người gửi chưa có `pos` (join xong chưa gửi vị trí): `n: 0`. Người nhận chưa có `pos`: không nhận.
  10. người nhận `seen` quá hạn (`now` = lúc gửi cuối + `slotTimeoutMs` + 1, chưa `sweep`): không nhận.
  11. rỗng: `'   '` → `why 'empty'`. `text` không phải chuỗi (số, mảng, thiếu) → `why 'empty'`.
  12. dài: `'x'.repeat(500)` → người nhận thấy đúng 200 ký tự. Gói JSON dài hơn 1024 → `message()` trả `[]`.
  13. tin `pos` dài hơn 256 (thêm trường rác) vẫn bị bỏ như cũ (`[]`).
  14. giả danh: gửi `{t:'chat', text:'hi', id:1, name:'Admin', slot:3, k:'fly', to:'c9'}` → tin tới người nhận mang tên / slot / loại thật của người gửi.
  15. HTML: `'<script>alert(1)</script>'` tới nơi nguyên văn (là chữ; khách hiện bằng `textContent`).
  16. từ tục: `'fuck'` → `why 'bad'`, không ai nhận.
  17. tần suất: 5 tin trong 10 s đều `n`; tin thứ 6 `why 'rate'`; sau `rateWinMs` gửi lại được; 3 tin `'rate'` liên tiếp không kéo dài thời gian khóa.
  18. `id` lạ (`'x'`, `1.5`, `2 ** 60`, thiếu) → `chatAck.id === 0`.
  19. 15 chỗ đầy (5 bay + 5 đi + 5 lái) cùng trong 50 m: một tin → 14 người nhận, `n: 14`.
  20. `lobby` có `chat: 1` (ở `connect`, sau `join`, sau `sweep`).
  21. người gửi đang ở gần hết hạn im lặng gửi chat thì `seenOf` của họ = `now` (chat tính là còn sống).

- [ ] **Step 4:** Chạy `npm run test:multi:unit`. Mong đợi: các ca mới FAIL (hàm chưa có), 98 ca cũ đạt.

- [ ] **Step 5:** Hiện thực `params.chat`, kiểu + `exSanitizeChat` (`protocol.ts`), `exIsBadText` (`badwords.ts`, dùng `TONED`, `WORD`, `SUB`, **không** dùng `PLAIN`; `SUB` so theo từ / dãy từ nguyên vẹn trong chuỗi đã tách từ, không bỏ khoảng trắng), `onChat` + giới hạn kích thước + `lobby.chat` + `Conn.chat: number[]` (`room.ts`; `connect` và `restore` tạo `Conn` có cả hai mảng). Sửa ca `connect nhận lobby…` trong `room.test.ts` thành kỳ vọng có `chat: 1`; tìm và sửa mọi ca khác so nguyên `lobby` (`session.test.ts`, `workerAtt.test.ts` nếu có).

- [ ] **Step 6:** `npm run typecheck && npm --prefix server/multi run typecheck && npm run test:multi:unit`. Mong đợi: sạch; mọi ca đạt (98 cũ + mới).

- [ ] **Step 7: Thêm mục chat vào `tests/multi-unit/worker.integration.mjs`** (sau các mục sẵn có, dọn phòng trước): ba kết nối thật join `kind: 'walk'` tên `Gan1`, `Gan2`, `Xa`; gửi `pos` (`pose: 0`) tại x = 0 / 40 / 380, z = −100, y = 3; `Gan1` gửi `{t:'chat', text:'xin chào', id:7}`; chờ 1 s. Kiểm: `Gan2` nhận `chat` có `name: 'Gan1'`, `k: 'walk'`, `text: 'xin chào'`; `Xa` không nhận tin `chat` nào; `Gan1` nhận `chatAck` `id: 7, n: 1` và không nhận `chat`; lobby đầu của mỗi kết nối có `chat === 1`; kết nối chưa join gửi chat nhận `why: 'slot'`.

- [ ] **Step 8:** Kiểm không còn `wrangler` mồ côi giữ cổng 8799 (PowerShell `Get-CimInstance Win32_Process | ? CommandLine -match 'wrangler'`; nếu là của phiên khác thì **đừng kill**, báo lại và bỏ qua bước chạy). `npm run test:multi:worker`. Mong đợi: mọi dòng `ĐẠT`, exit 0.

- [ ] **Step 9:** Commit: `feat(chat): máy chủ giao tin theo khoảng cách, giao thức chat / chatAck (D-041 Task 1)`.

---

### Task 2: Phiên + lõi chat phía khách (không DOM)

**Files:**
- Modify: `src/explore/multi/session.ts`
- Create: `src/explore/multi/chatCore.ts`
- Test: `tests/multi-unit/chatCore.test.ts` (mới); thêm ca vào `tests/multi-unit/session.test.ts`

**Interfaces — Consumes:** Task 1 (`ChatWhy`, kiểu tin, `multiParams.chat`, `exSanitizeChat`).

**Interfaces — Produces:**

```ts
// session.ts (MultiSession)
chatOk = false;                                   // lobby gần nhất có chat === 1
onChat: (m: { k: Kind; slot: number; name: string; text: string }) => void = () => {};
onChatAck: (m: { id: number; n?: number; why?: ChatWhy }) => void = () => {};
sendChat(text: string, id: number): boolean;      // true nếu đã đưa cho transport (phase 'flying', có kết nối, chatOk)

// chatCore.ts
export type ChState = 'pending' | 'ok' | 'alone' | 'fail' | 'rate' | 'bad';
export interface ChMsg { key: number; id: number; mine: boolean; k: Kind; slot: number; name: string; text: string; at: number; state: ChState; n: number }
export interface ChPeer { k: Kind; slot: number; name: string; x: number; y: number; z: number }
export const chKey: (k: Kind, slot: number) => string;                       // 'walk:2'
export function chNear(self: { x: number; y: number; z: number } | null, peers: ChPeer[], prev: ReadonlySet<string>, nearIn: number, radius: number): ChPeer[];
export class ChLog {
  readonly list: ChMsg[]; unread: number;
  constructor(historyMax: number, ackMs: number, ratePerWin: number, rateWinMs: number);
  canSend(now: number): boolean;                                             // hạn mức phía khách
  addMine(text: string, now: number): ChMsg;                                 // id tăng từ 1, state 'pending', ghi dấu hạn mức
  addTheirs(k: Kind, slot: number, name: string, text: string, now: number, panelOpen: boolean): ChMsg;   // unread++ khi bảng đóng
  ack(id: number, n: number | undefined, why: ChatWhy | undefined): ChMsg | null;   // n ≥ 1 'ok', n = 0 'alone', why 'rate' / 'bad' giữ nguyên, why khác 'fail'; chỉ đổi tin đang 'pending'
  expire(now: number): ChMsg[];                                              // 'pending' quá ackMs → 'fail'; trả các tin vừa đổi
  failAll(): ChMsg[];                                                        // mất kết nối: mọi 'pending' → 'fail'
  trim(): ChMsg[];                                                           // gỡ tin cũ nhất tới khi ≤ historyMax; trả tin bị gỡ
  read(): void;                                                              // unread = 0
  clear(): void;
}
```

`chNear`: một người vào kết quả khi `d ≤ nearIn`, hoặc khi khóa của họ có trong `prev` và `d ≤ radius`; `self` là `null` → `[]`; thứ tự kết quả theo thứ tự `peers`. `MultiSession.recv`: nhánh `'chat'` / `'chatAck'` kiểm kiểu trường (chuỗi / số hữu hạn, `k` thuộc ba loại) rồi gọi móc và `return` (không gọi `onChange`); gói sai kiểu bỏ. `lost()` và `offline()` đặt `chatOk = false`.

- [ ] **Step 1: Viết test thất bại `tests/multi-unit/chatCore.test.ts`:**
  - `chNear`: người ở 139 m vào; 145 m không vào khi `prev` rỗng, vẫn ở lại khi có trong `prev`; 150 m còn (có trong `prev`), 150,1 m ra; khoảng cách 3D (cao 200 m không vào); `self` `null` → rỗng; hai người cùng slot khác loại là hai khóa khác nhau.
  - `ChLog`: `addMine` id 1, 2, 3 và `pending`; `ack(1, 2, undefined)` → `ok`, `n = 2`; `ack(2, 0, undefined)` → `alone`; `ack(3, undefined, 'rate')` → `rate`; `'bad'` → `bad`; `'slot'` / `'empty'` → `fail`; `ack` id lạ → `null`; `ack` lần hai cho tin đã `ok` không đổi; `expire` sau `ackMs` → `fail` và chỉ trả tin vừa đổi; hồi âm tới sau khi đã `fail` không đổi lại; `failAll`; `addTheirs` bảng đóng tăng `unread`, bảng mở không; `read()` về 0; `canSend` sai sau 5 `addMine` trong 10 s, đúng lại sau 10 s; quá `historyMax` thì `trim()` trả tin cũ nhất và `list.length === historyMax`; `key` duy nhất tăng dần cho cả tin mình lẫn tin người khác; `clear()`.
  - i18n: 9 file `locales/*.json` đều có đủ các khóa `chatBtn, chatNone, chatOne, chatMany, chatLost, chatWatch, chatPlaceholder, chatSend, chatSending, chatSent, chatAlone, chatFail, chatRate, chatBad`, chuỗi không rỗng; `chatOne` chứa `{name}`, `chatMany` và `chatSent` chứa `{n}` ở mọi ngôn ngữ. (Ca này FAIL tới Task 3; ghi `{ todo: 'Task 3' }` bằng tùy chọn `todo` của `node:test` rồi gỡ ở Task 3.)

- [ ] **Step 2: Thêm ca vào `tests/multi-unit/session.test.ts`** (dùng `Fake`, `make` sẵn có):
  - lobby có `chat: 1` → `chatOk` đúng; lobby không có → sai (máy chủ cũ); sau `onClose` → sai.
  - `sendChat('hi', 1)` trước `joined` → `false`, không gửi gì; sau `joined` + `chatOk` → `true`, `t.sent` có `{t:'chat', text:'hi', id:1}`; `chatOk` sai → `false`.
  - nhận `{t:'chat', k:'walk', slot:1, name:'B', text:'yo'}` → `onChat` được gọi đúng một lần, `onChange` **không** tăng; nhận `chatAck` → `onChatAck`.
  - gói sai kiểu (`text: 5`, `k: 'x'`, `slot: 'a'`, thiếu `name`, `chatAck` `id: 'q'`) → không gọi móc, không ném lỗi.
  - phiên đã `dispose()` nhận chat → không gọi móc.

- [ ] **Step 3:** `npm run test:multi:unit` → ca mới FAIL.
- [ ] **Step 4:** Hiện thực `session.ts` và `chatCore.ts` theo Interfaces.
- [ ] **Step 5:** `npm run typecheck && npm run test:multi:unit` → sạch, mọi ca đạt (trừ ca i18n `todo`).
- [ ] **Step 6:** Commit: `feat(chat): phiên gửi / nhận chat, lõi sổ tin + danh sách gần (D-041 Task 2)`.

---

### Task 3: Giao diện, bong bóng, nối vào bốn chế độ

**Files:**
- Create: `src/explore/multi/chat.ts`
- Modify: `src/explore/multi/index.ts`, `src/explore/multi/labels.ts`, `index.html` (sau `#exMpInvite`), `src/styles/main.css` (sau khối `#exMpIdle`), 9 file `src/i18n/locales/*.json`, `src/main.ts` (thêm `chat: exChat` vào `multiTest` cho test)
- Test: `tests/multi-unit/labels.test.ts` (thêm ca bong bóng theo mẫu DOM giả sẵn có trong file đó), gỡ `todo` của ca i18n ở `chatCore.test.ts`

**Interfaces — Consumes:** Task 1, Task 2; `exRemotes.slotState(i)` (`.pos.x/y/z`) + `.name(i)`, `stAvatars.slotState(i)` (`.x/y/z`) + `.name(i)` + `.self`, `exDrivers.slotState(i)` + `.name(i)`; `t()` và `onChange` của `src/i18n`.

**Interfaces — Produces:**

```ts
// chat.ts
export const exChat = {
  onActivity: (() => {}) as () => void,            // index.ts gán = () => exMulti.activity()
  attach(s: MultiSession): void,                   // gắn s.onChat / s.onChatAck, bật đồng hồ nearTickMs + expire
  sync(s: MultiSession): void,                     // gọi trong s.onChange: hiện / ẩn, dòng trạng thái, failAll khi phase 'solo'
  detach(): void,                                  // exMulti.end(): dừng đồng hồ, xóa sổ + DOM, ẩn, bỏ lớp body
  setSelf(x: number, y: number, z: number): void,  // vị trí mình vừa gửi lên máy chủ
  open(): void, close(): void, readonly isOpen: boolean,
  debug(): { available: boolean; open: boolean; near: string[]; unread: number; count: number; status: string; canSend: boolean; self: { x: number; y: number; z: number } | null }
};
// labels.ts
export function exLabelsSay(k: Kind, slot: number, text: string, nowMs: number): void;   // bong bóng trên nhãn của slot đó trong chat.bubbleMs
```

**DOM (`index.html`):**

```html
<button id="exChatBtn" class="panel" type="button" data-i18n-aria="chatBtn" aria-label="Trò chuyện" aria-expanded="false" aria-controls="exChat"><span aria-hidden="true">💬</span><b id="exChatNear" hidden></b><i id="exChatDot" hidden></i></button>
<section id="exChat" class="panel" hidden>
  <div id="exChatStatus" role="status" dir="auto"></div>
  <div id="exChatList" role="log" aria-live="polite"></div>
  <form id="exChatForm"><textarea id="exChatIn" rows="1" maxlength="200" dir="auto" autocomplete="off" data-i18n-ph="chatPlaceholder"></textarea><button id="exChatSend" type="submit" data-i18n-aria="chatSend" aria-label="Gửi" disabled>➤</button></form>
</section>
```

Thuộc tính placeholder: xem `src/i18n` hỗ trợ `data-i18n-ph` chưa; chưa thì `chat.ts` tự đặt `placeholder = t('chatPlaceholder')` và đặt lại khi đổi ngôn ngữ (không sửa hệ i18n).

**Câu chữ tiếng Việt (8 ngôn ngữ còn lại dịch tương đương, giữ `{name}` / `{n}`):** `chatBtn` "Trò chuyện (Enter)" · `chatNone` "Chưa có ai ở gần để trò chuyện." · `chatOne` "Bạn đang ở gần {name}." · `chatMany` "{n} người ở gần." · `chatLost` "Mất kết nối. Không gửi được tin nhắn." · `chatWatch` "Vào chỗ để trò chuyện." · `chatPlaceholder` "Nhập tin nhắn…" · `chatSend` "Gửi" · `chatSending` "Đang gửi…" · `chatSent` "Đã tới {n} người" · `chatAlone` "Không ai ở gần nhận được" · `chatFail` "Chưa gửi được" · `chatRate` "Bạn gửi nhanh quá, chờ chút nhé" · `chatBad` "Tin nhắn không phù hợp". Tiếng Anh: "Chat (Enter)", "No one nearby to chat with.", "You are near {name}.", "{n} people nearby.", "Disconnected. Messages can't be sent.", "Take a seat to chat.", "Type a message…", "Send", "Sending…", "Delivered to {n}", "No one nearby received it", "Not sent", "You're sending too fast, wait a moment", "Message not allowed".

**Hành vi (mọi điểm lấy từ spec §8, §11):**
- Hiện: `body` có lớp `ex-chat` khi phiên có `chatOk` từng đúng và phase là `flying` / `watching`, hoặc `solo` với `notice === 'lost'`; CSS chỉ hiện nút khi `body.explore.ex-chat`. Bảng hiện khi `#exChat` không `hidden`.
- Trạng thái + khóa gửi: `flying` và danh sách gần rỗng → `chatNone`, khóa; một người → `chatOne`; nhiều → `chatMany`; `watching` → `chatWatch`, khóa; `solo` → `chatLost`, khóa, `failAll()`. Khóa = `#exChatSend.disabled` và `#exChatIn.disabled`. Nút gửi cũng khóa khi ô rỗng.
- Đồng hồ `setInterval(nearTickMs)` (một cái, chạy từ `attach` tới `detach`): gom `ChPeer[]` từ ba nguồn (bỏ `stAvatars.self`; người chưa có trạng thái thì bỏ), `chNear(self, peers, prev, nearIn, radius)`, `log.expire(now)`; chỉ ghi DOM khi chuỗi khóa danh sách (khóa + tên) đổi. Có khóa mới so với lần trước → thêm lớp `pulse` cho nút (CSS animation 0,6 s một lần; gỡ ở `animationend`).
- Gửi: `exSanitizeChat(ô nhập)`; `null` → không làm gì; `!log.canSend(now)` → thêm tin của mình với trạng thái `rate` mà không gửi; ngược lại `addMine` + `session.sendChat(text, id)`; `sendChat` trả `false` → `fail` ngay. Xóa ô, cuộn cuối, giữ focus.
- Nhận: `addTheirs(…, isOpen)`; vẽ một nút DOM; `exLabelsSay(k, slot, text, performance.now())`; cập nhật chấm chưa đọc.
- Một tin = `div.ex-chat-msg` (`.me` cho tin mình) gồm dòng đầu (`i` chấm màu `M.colors[slot % 5]`, tên, giờ `HH:MM` theo giờ máy), thân chữ `white-space:pre-wrap; overflow-wrap:anywhere`, và với tin mình một dòng trạng thái nhỏ (`chatSending` / "✓" có `title = t('chatSent', {n})` / `chatAlone` / `chatFail` / `chatRate` / `chatBad`). Cập nhật trạng thái chỉ ghi lại đúng dòng đó. Giữ `Map<key, HTMLElement>`; `log.trim()` thì gỡ nút tương ứng.
- Cuộn: trước khi thêm, nếu `scrollHeight − scrollTop − clientHeight < 40` hoặc là tin mình thì sau khi thêm cuộn xuống cuối.
- Phím trong `#exChatIn`: `Enter` không Shift và `!e.isComposing && e.keyCode !== 229` → `preventDefault` + gửi; `Shift+Enter` để mặc định; `Escape` → `stopPropagation()` + `close()` + `blur()`; mọi `keydown` gọi `exChat.onActivity()`. Ô tự cao theo nội dung tới 4 dòng.
- Phím toàn cục (một trình nghe `window` `keydown` gắn lúc nạp module): `Enter`, không phím bổ trợ, đích không phải `INPUT|TEXTAREA|SELECT|BUTTON`, `body` có `explore` và `ex-chat` → `preventDefault`, `open()`, focus ô nhập (nếu ô không khóa).
- `close()` luôn `blur()` ô nhập nếu đang focus (không thì WASD vẫn bị `isField` nuốt). Thân tin và bong bóng đặt `dir="auto"`.
- `open()`: bỏ `hidden`, `aria-expanded="true"`, `log.read()`, ẩn chấm, cuộn cuối. `close()`: ngược lại. Bấm `#exChatBtn` đổi qua lại. Trình nghe gắn **một lần** lúc nạp module trên phần tử cố định.
- Đổi ngôn ngữ (`onChange` của i18n): vẽ lại dòng trạng thái, placeholder, các dòng trạng thái tin của mình.
- `detach()`: `clearInterval`, `log.clear()`, xóa con của `#exChatList`, `close()`, bỏ lớp `ex-chat`, quên `self` và `prev`.

**`index.ts`:** trong `begin`: sau khi tạo `s` gọi `exChat.attach(s)`; trong `s.onChange` gọi `exChat.sync(s)` trước `exMulti.onChange()`. Trong `end`: `exChat.detach()`. Trong `update` / `updateWalk` / `updateDrive`: ngay chỗ gửi vị trí (sau `sentAt = nowMs`) gọi `exChat.setSelf(x, y, z)` với đúng số đã làm tròn gửi đi. Đầu file: `exChat.onActivity = () => exMulti.activity();` (sau khi khai báo `exMulti`).

**`labels.ts`:** `Lab` thêm `bub: HTMLElement | null; bTxt: string; bUntil: number; bShown: boolean`. `exLabelsSay` tìm nhãn theo chỉ số (`fly` → `i`, `walk` → `M.slots + i`, `drive` → `M.slots + NW + i`; ngoài khoảng thì bỏ), tạo lười `div.ex-mp-bubble` (con của `#exMpLabels`), đặt `textContent` = chữ cắt `bubbleChars` code point (dài hơn thêm "…"), `bUntil = nowMs + bubbleMs`. Trong `exLabelsUpdate`, cho mỗi nhãn có `bUntil > 0`: hiện bong bóng khi nhãn đang hiện và `nowMs < bUntil`, đặt `transform` của bong bóng cùng lúc nhãn đổi vị trí (`translate(px, py) translate(-50%, -100%)`, nhích lên 4 px); hết hạn thì ẩn và đặt `bUntil = 0`. `exLabelsClear` ẩn mọi bong bóng. Không cấp phát mỗi khung khi không có bong bóng (chỉ một phép so số).

**CSS (`main.css`, biến và kiểu `.panel` sẵn có):**
- `#exChatBtn, #exChat{display:none;}`; `body.explore.ex-chat #exChatBtn{display:flex;…position:fixed;left:calc(14px + env(safe-area-inset-left,0px));top:calc(50% - 22px);width:44px;height:44px;z-index:6;pointer-events:auto;cursor:pointer;touch-action:manipulation;}` (dùng `left`, không `inset-inline-start`: ar không lật, như `#stHud` / `#drHud`).
- `body.explore.ex-chat #exChat:not([hidden]){display:flex;flex-direction:column;position:fixed;left:calc(66px + env(safe-area-inset-left,0px));top:50%;transform:translateY(-50%);width:min(300px,calc(100vw - 80px));max-height:min(46vh,360px);z-index:6;pointer-events:auto;}`; `body.compact.ex-chat #exChat:not([hidden])`: `top:calc(56px + env(safe-area-inset-top,0px));transform:none;max-height:40vh` (chừa bàn phím ảo).
- Máy cảm ứng khi lái (`@media (hover:none) and (orientation:landscape)` + `body.drive`, gồm xe máy): bản đồ nhỏ ở trên trái nên đặt nút cạnh phải bản đồ, ngang đáy bản đồ (`left` = mép phải bản đồ + 8 px, `top` = `56px + var(--dr-map-h,128px) − 44px`; đọc kích thước / biến thật của `#drMap` trong `main.css` và `drive/hud.ts`). Task 4 mục 10 đo chồng lấn; chồng thì chỉnh ở đây.
- `#exChatList{flex:1;min-height:60px;overflow-y:auto;overscroll-behavior:contain;}`; tin mình căn phải (`align-self:flex-end`), tin người khác căn trái; thân tin `max-width:85%`.
- `#exChatNear` huy hiệu số góc dưới phải của nút (nền `var(--gold)`, chữ tối); `#exChatDot` chấm đỏ 9 px góc trên phải; `#exChatBtn.pulse{animation:exChatPulse .6s 1;}`; `@media (prefers-reduced-motion:reduce)` tắt animation.
- `.ex-mp-bubble{position:absolute;left:0;top:0;max-width:200px;padding:4px 8px;font:500 12px/1.3 var(--font-body);color:#10181c;background:rgba(255,255,255,.92);border-radius:10px;white-space:pre-wrap;overflow-wrap:anywhere;overflow:hidden;max-height:4.2em;will-change:transform;}` + `[hidden]{display:none}`.
- `body.ex-chat` thêm cho `#exChat`, `#exChatBtn`: `user-select` bình thường trong `#exChatList` (đè `body.compact .panel{user-select:none}`) để chép được chữ.

- [ ] **Step 1:** Thêm ca bong bóng vào `tests/multi-unit/labels.test.ts` (DOM giả của file đó): `exLabelsSay('walk', 1, 'chào', 1000)` rồi `exLabelsUpdate` tại 1000 với người đi dạo slot 1 trước camera → có đúng một phần tử lớp `ex-mp-bubble` không `hidden`, `textContent === 'chào'`; tại `1000 + bubbleMs + 1` → `hidden`; chữ 100 ký tự → dài `bubbleChars + 1` và kết thúc bằng "…"; slot ngoài khoảng (`'drive', 9`) không ném lỗi; nhãn đang ẩn (sau camera) thì bong bóng ẩn; `exLabelsClear()` ẩn bong bóng. Chạy → FAIL.
- [ ] **Step 2:** Hiện thực `labels.ts` → ca đạt; ca cũ của `labels.test.ts` vẫn đạt.
- [ ] **Step 3:** Thêm 14 khóa vào 9 file locale (đặt sau khóa `exMp*` cuối), gỡ `todo` của ca i18n → đạt.
- [ ] **Step 4:** `index.html`, `main.css`, `chat.ts`, nối `index.ts`, `main.ts` (`multiTest.chat = exChat`).
- [ ] **Step 5:** `npm run typecheck && npm run test:multi:unit && npm run test:stroll:unit && npm run test:drive:unit && npm run test:bike:unit && npm run build`. Mong đợi: sạch, không ca nào giảm, build đạt. Ghi kích thước chunk `index` / css trước và sau vào báo cáo.
- [ ] **Step 6:** `grep -n "innerHTML\|insertAdjacentHTML\|outerHTML" src/explore/multi/chat.ts src/explore/multi/labels.ts` → không có dòng nào.
- [ ] **Step 7: Thử tay nhanh** (không SwiftShader): một cửa sổ PowerShell `npm --prefix server/multi run dev -- --port 8797`, một cửa sổ `npm run dev -- --port 5197`; mở hai tab `http://localhost:5197/?test&chooser&multi=ws%3A%2F%2F127.0.0.1%3A8797%2Fsky`, cả hai vào Đi dạo. Kiểm bằng mắt hoặc Playwright có GPU: nút hiện, hai người đứng gần nhau (điểm xuất phát cách nhau < 140 m) thấy `chatOne`, gửi qua lại, bong bóng hiện trên đầu, Esc trong ô chỉ đóng bảng. Tắt hai tiến trình khi xong (kill theo PID của chính mình). Không làm được thì ghi rõ trong báo cáo, không coi là đã kiểm.
- [ ] **Step 8:** Commit: `feat(chat): nút + bảng trò chuyện, bong bóng trên nhãn tên, 9 ngôn ngữ (D-041 Task 3)`.

---

### Task 4: Test trình duyệt `test:chat` + tài liệu

**Files:**
- Create: `tests/chat-check.mjs`
- Modify: `package.json` (`"test:chat": "node tests/chat-check.mjs"`), `.github/copilot-instructions.md` §5, `.github/instructions/tests.instructions.md`, `.github/instructions/ui-views.instructions.md`, `.github/memory-bank/{activeContext,progress,decisions,systemPatterns}.md`, `tests/KET-QUA.md`, spec (dòng trạng thái), plan này (đánh dấu ô)

**Interfaces — Consumes:** `window.__app.multi.chat.debug()`, `window.__app.multi.session`, `openApp` / `frames` của `tests/lib.mjs`; mẫu spawn `wrangler dev` + vào chế độ qua màn chọn ở `tests/bike-multi.mjs`, mẫu bot ở `tests/multi-check.mjs` (Mục 6, 7).

`tests/chat-check.mjs`: đọc `dist/`; tự spawn `wrangler dev --port 8797` trong `server/multi`, luôn kill cây tiến trình của chính nó khi xong / lỗi; URL trang `?chooser&multi=ws://127.0.0.1:8797/sky&idleMs=600000` (kèm `test`); bot là WebSocket Node (header `Origin: http://localhost`) gửi `join` theo loại rồi `pos` 5 lần/s tại vị trí cho trước và ghi mọi tin nhận. Vị trí của trang lấy từ `chat.debug().self`. Khung nhìn 480 × 270 để nhẹ. In `ĐẠT` / `LỖI` từng kiểm, dòng cuối `chat-check: đạt` hoặc `chat-check: LỖI (n)`, exit code theo đó.

Mục (trang chính vào **Đi dạo**):
1. Không bot: nút `#exChatBtn` thấy được; mở bảng; trạng thái = `chatNone` (vi); `#exChatSend` và `#exChatIn` khóa; `debug().near` rỗng.
2. Bot đi dạo `Minh` cách 20 m, bot bay `Xa` cách 600 m: trong 5 s trạng thái = "Bạn đang ở gần Minh."; huy hiệu `#exChatNear` = "1". Thêm bot xe máy (`kind 'drive', veh 1`) `Lan` cách 50 m: "2 người ở gần.".
3. Trang gõ "xin chào" + Enter: `Minh` và `Lan` nhận `chat` có `k 'walk'`, `name` = tên trang, `slot` = `session.mySlot`; `Xa` không nhận tin `chat` nào sau 2 s; tin nằm bên phải (`.me`), dòng trạng thái thành "✓".
4. `Minh` gửi `<img src=x onerror="window.__xss=1">`: `#exChatList` có tin bên trái chứa đúng chuỗi đó, không có phần tử `img` trong `#exChatList` và `#exMpLabels`, `window.__xss` là `undefined`; có `.ex-mp-bubble` không ẩn (bỏ qua kiểm bong bóng và ghi chú nếu `Minh` ngoài khung nhìn: xoay camera về phía bot trước). `Minh` gửi 200 ký tự `W` liền: `#exChatList.scrollWidth <= clientWidth`. Đóng bảng, `Minh` gửi thêm: `#exChatDot` hiện; mở lại: ẩn.
5. `Xa` gửi "alo": trang không có tin đó sau 2 s. `Lan` chuyển ra 400 m: trạng thái về "Bạn đang ở gần Minh."; trang gửi tiếp: `Lan` không nhận.
6. Phím: focus `#exChatIn`, gõ `wasd` giữ 0,5 s → vị trí nhân vật (`debug().self` sau 1 s) không đổi; `Shift+Enter` tạo xuống dòng, không gửi; sự kiện `keydown` Enter có `isComposing: true` (dispatch tay) không gửi; `Escape` trong ô → bảng đóng, `__app.stroll.active()` vẫn đúng (`inMode`), URL không đổi; `Enter` khi không focus ô → bảng mở và ô được focus.
7. Tần suất: gửi 6 tin liền → tin thứ sáu có chữ `chatRate`; `Minh` nhận đúng 5.
8. Rò rỉ: đếm `document.querySelectorAll('#exChat *').length` và `renderer.info.render.calls` (một khung) trước; mở / đóng 50 lần; sau: số nút DOM bằng trước, lệnh vẽ bằng trước (±0).
9. Ra khỏi tầm thật: `Minh` rời (đóng socket) → trạng thái về `chatNone` trong 5 s, ô khóa.
10. Ba chế độ còn lại, mỗi chế độ một trang mới (đóng trang trước): **Dù lượn** (`data-pick="glider"`), **Ô tô** (`"drive"`), **Xe máy** (`"bike"`): vào bằng màn chọn như `bike-multi.mjs`; đặt bot đi dạo `Gan` cách `debug().self` 30 m (cập nhật theo `self` mỗi 0,5 s vì dù và xe tự trôi) → trạng thái "Bạn đang ở gần Gan."; trang gửi "hi" → `Gan` nhận với `k` = `'fly'` / `'drive'` / `'drive'`; `Gan` gửi → trang hiện; `document.elementFromPoint` tại tâm `#exChatBtn` là chính nút (hoặc con của nó). Ở mỗi chế độ (kể cả Đi dạo, làm ở mục 1): khung bao của `#exChatBtn` không giao khung bao của phần tử HUD đang hiện nào (`#drMap`, `#drMapNote`, `#drSteer`, `#drGas`, `#drBrake`, `#drSpeed`, `#drSoundBtn`, `.bk-btn`, `#stPad`, `#stPhoto`, `#btnExExit`, `#exMpRoster`, `#exHint`, `#stHint`, `#drHint`, `#bkHint`, `#exSpeed`). Riêng xe máy và đi dạo: lặp `elementFromPoint` + chồng lấn ở ngữ cảnh cảm ứng (`hasTouch`, `isMobile`) 390 × 844 và 844 × 390, và với tiếng Ả Rập (dir rtl).
11. Mất máy chủ (cuối cùng): kill `wrangler` → trong 10 s trạng thái = `chatLost`, ô khóa; tin đang gửi dở (gửi ngay trước khi kill) thành `chatFail`.
12. Không có lỗi console / pageerror nào trong cả lượt (trừ lỗi WebSocket đóng do mục 11).

- [ ] **Step 1:** Viết `tests/chat-check.mjs` + script `test:chat`.
- [ ] **Step 2:** `npm run build`. Kiểm tiến trình mồ côi (`*-check.mjs`, `drawcalls.mjs`, `wrangler`): của phiên khác thì không kill; nếu có test trình duyệt khác đang chạy thì báo lại rồi vẫn chạy (ghi chú CPU bị tranh).
- [ ] **Step 3:** `npm run test:chat` (ước 20 – 40 phút trên SwiftShader; giới hạn 60 phút). Lỗi do test thì sửa test; lỗi sản phẩm thì sửa mã + thêm ca đơn vị tương ứng, chạy lại riêng mục đó (cho phép cờ `-- --only=N`). Ghi đúng kết quả cuối: số kiểm đạt / lỗi, mục nào không chạy được và vì sao.
- [ ] **Step 4:** Tài liệu (chỉ ghi điều có thật; test nào chưa chạy thì ghi "chưa chạy"):
  - `copilot-instructions.md` §1 (một cụm về chat), §5 thêm dòng `npm run test:chat`.
  - `tests.instructions.md`: cổng 8797, bot + `chat.debug()`, không nối Worker thật.
  - `ui-views.instructions.md`: vị trí nút chat (mép trái giữa), `z-index` 6, Enter / Esc, lớp `body.ex-chat`.
  - `decisions.md`: mục **D-041** (bối cảnh, quyết định: máy chủ lọc theo `Slot.pos`, bán kính 150 m 3D tính cả biên, trễ 140 / 150 phía khách, không lưu tin, cờ `lobby.chat`; phương án loại; hệ quả).
  - `systemPatterns.md`: mẫu "tin gửi riêng theo `Out.to`", `exMulti.onChange` là móc đơn nên tính năng mới nối thẳng trong `begin` (như `exChat.sync`), giới hạn kích thước theo loại tin.
  - `activeContext.md` (đầu mục Trạng thái + Bước tiếp theo: Worker **chưa deploy** bản có chat ⇒ trên mạng nút chat chưa hiện; deploy phải hỏi riêng; nhánh xếp trên `feature/xe-may`), `progress.md`.
  - `tests/KET-QUA.md`: kết quả `test:chat`, `test:multi:unit`, `test:multi:worker`, kích thước chunk.
  - Spec: dòng trạng thái đầu file. Plan: đánh dấu ô, thêm mục "Trạng thái thực hiện" ở cuối (xong / còn / lệnh tiếp tục).
- [ ] **Step 5:** Commit: `test(chat): chat-check trình duyệt + bot; tài liệu agent (D-041 Task 4)`.

---

## Trạng thái thực hiện

_(cập nhật sau mỗi task: commit, test đã chạy và kết quả, việc còn lại)_

- Task 1: chưa làm
- Task 2: chưa làm
- Task 3: chưa làm
- Task 4: chưa làm

**Tiếp tục ở phiên khác:** `cd "D:\2026 - Tuan\danang-vite\.worktrees\chat-gan-nhau"`, `git log --oneline -8`, đọc mục này rồi làm task đầu tiên còn "chưa làm". Kiểm nhanh: `npm run typecheck && npm run test:multi:unit`.

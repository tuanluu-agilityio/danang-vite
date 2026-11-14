# Trò chuyện theo khoảng cách (proximity chat) — thiết kế

_Ngày: 2026-11-14 · Quyết định: D-041 · Nhánh: `feature/chat-gan-nhau` (từ `feature/xe-may` `870f27b`, vì xe máy D-040 chưa vào `main`) · Trạng thái: người dùng giao bản yêu cầu "Proximity-based real-time chat" (2026-11-14) và bảo tự quyết kỹ thuật, làm liền spec → plan → mã; chưa duyệt riêng từng mục. **Đã triển khai Task 1–3 trên nhánh (gộp `origin/main` ở `50e842e` và `bb5ab71`, mã `0905fef`), PR #36, Worker `danang-sky` đã deploy 2026-11-14; test trình duyệt (`test:chat`, Task 4) không làm theo lời người dùng (2026-11-14).**_

Ghi chú nguồn gốc: **(ND)** = có trong bản yêu cầu của người dùng; **(Claude)** = lựa chọn của Claude, người dùng chưa duyệt riêng; không ghi gì = suy ra từ mã hiện có.

## 1. Ý định

Hai người đang tự khám phá sông Hàn (một người đi dạo, một người chạy xe máy qua Cầu Rồng) lại gần nhau thì thấy "có người ở gần" và gõ chữ nói chuyện được; đi xa nhau thì cuộc trò chuyện tự tắt. Đây là trải nghiệm xã hội trong cảnh 3D, không phải khung chat của trang web. **(ND)**

## 2. Mục tiêu / không làm / thất bại

**Mục tiêu**
1. Tin nhắn chữ thời gian thực chỉ tới người đang giữ chỗ nằm trong bán kính cấu hình quanh người gửi, tính theo vị trí máy chủ đang giữ. **(ND)**
2. Một hệ dùng chung cho dù lượn, đi dạo, ô tô, xe máy; khác loại vẫn nói chuyện được với nhau (người đi dạo với người chạy xe ngang qua). **(ND)**
3. Giao diện nhỏ: nút nổi, số người ở gần, chấm tin chưa đọc, bảng gập, lịch sử trong phiên, tên + giờ, ô nhập, nút gửi; 9 ngôn ngữ; máy tính và điện thoại. **(ND)**
4. Bong bóng chữ ngắn hạn trên đầu người gửi (bằng DOM, cạnh nhãn tên). **(ND, mức "nếu khả thi")**
5. Máy chủ chặn: giả danh, tin rỗng / quá dài, gửi dồn dập, gửi ra ngoài bán kính, gói hỏng. **(ND)**
6. Mất mạng thì nói rõ, không giả vờ đã gửi. **(ND)**

**Không làm**
- Không chat toàn phòng, không chat thoại, không lưu tin (không cơ sở dữ liệu, không Durable Object storage). **(ND)**
- Không hệ đăng nhập; danh tính là chỗ + tên sẵn có. **(ND)**
- Không tự kết nối lại: phiên hiện nay mất kết nối thì thành `solo` và phải vào lại chế độ; chat theo đúng hành vi đó. **(Claude)**
- Người đang xem (hết chỗ, không giữ slot) không chat: họ không có vị trí trên máy chủ. **(Claude)**
- Không dòng hệ thống "X vừa lại gần" trong lịch sử; chỉ đổi dòng trạng thái và nháy nút. **(Claude)**

**Thất bại (dù chạy được)**
- Tin phát cho cả phòng rồi máy khách tự lọc.
- Giao diện chat che cảnh, cướp phím lái, hoặc làm tụt khung hình.
- Làm hỏng dù lượn / đi dạo / lái xe nhiều người đang có, hoặc khách cũ (bản đang chạy trên mạng) lỗi khi gặp máy chủ mới.

## 3. Hiện trạng (đọc từ mã, `870f27b`)

- Máy chủ: Cloudflare Worker `danang-sky` (`server/multi/src/worker.ts`) bọc lớp thuần `SkyRoom` (`room.ts`) trong một Durable Object duy nhất `sky`, WebSocket hibernation. Không lưu gì ngoài attachment của socket.
- **Ba nhóm 5 chỗ riêng**: bay (`slots`), đi dạo (`walkSlots`), lái (`driveSlots`; xe máy là chỗ lái có `veh = 1`). Tức tối đa 15 người giữ chỗ, không phải 5; người thứ 6 của mỗi nhóm xem.
- Danh tính: máy chủ gán mỗi kết nối một `id` (UUID trong attachment); slot và loại suy từ `id`, không từ trường trong gói. Tên qua `exSanitizeName` + `exIsBad`.
- Vị trí: khách gửi `pos` 5 lần/s (`sendHz`), máy chủ kẹp vào khung của từng loại và giữ ở `Slot.pos = [slot, x, y, z, …]`, phát gộp mỗi ≥ 100 ms. Ba loại chung một hệ tọa độ thế giới, **1 đơn vị = 1 m** (kiểm bằng số thật trong `CONFIG`: xe VF 3 rộng 1,679 m, đi bộ 3,5 m/s, xe 27,78 m/s = 100 km/h).
- Tab ẩn: rAF dừng nên không gửi `pos`, chỉ còn `hb` mỗi 3 s; nhân vật đứng yên tại vị trí cuối, vị trí đó vẫn đúng. Slot hết hạn sau `slotTimeoutMs` 10 s không có tin, quét mỗi 10 s.
- Khách: `MultiSession` (`session.ts`, máy trạng thái không DOM), `exMulti` (`index.ts`) nối phiên với `exRemotes` / `stAvatars` / `exDrivers` (vị trí người khác đã nội suy, trễ ≈ 0,5 s), nhãn tên DOM (`labels.ts`, một `div` mỗi slot trong `#exMpLabels`), danh sách `#exMpRoster`. `exMulti.onChange` là **một** móc bị từng chế độ gán lại, không dùng chung được.
- Phím: cả bốn chế độ bỏ qua phím khi đích là `INPUT` / `TEXTAREA` / `SELECT` và nhả hết phím khi ô nhập được focus. Esc luôn thoát chế độ (nghe ở `window`, pha nổi bọt). Enter chưa chế độ nào dùng.
- Giới hạn gói: `maxMsgBytes` 256 đơn vị UTF-16 cho mọi tin từ khách.
- Khách cũ nhận tin lạ: `MultiSession.recv` không có nhánh thì chỉ gọi `onChange()` (vô hại).

## 4. Các cách đã cân nhắc

1. **Máy chủ lọc người nhận theo vị trí nó đang giữ (chọn).** Thêm tin `chat` vào `SkyRoom`; khi nhận, máy chủ tính khoảng cách 3D từ `pos` của người gửi tới `pos` của từng slot khác (tối đa 14 phép tính, chỉ khi có tin) và gửi riêng cho từng người trong bán kính. Dùng đúng kết nối, phòng, vị trí, danh tính sẵn có; không thêm hạ tầng. Vị trí do khách tự báo (như mọi thứ khác trong phòng) nhưng đã bị kẹp khung và là dữ liệu thẩm quyền nhất hệ thống có.
2. Phát cho cả phòng, khách tự lọc theo khoảng cách. Loại: khách sửa mã đọc được mọi tin; trái yêu cầu.
3. Máy chủ duy trì "nhóm lân cận" và đẩy sự kiện vào / ra tầm cho khách. Loại: thêm lưu lượng và trạng thái trong khi khách đã có vị trí nội suy của mọi người để tự vẽ chỉ báo; quyền quyết định vẫn nằm ở máy chủ lúc giao tin (cách 1).
4. Kênh riêng (WebRTC, dịch vụ pub/sub ngoài). Loại: hệ nhiều người thứ hai, thêm phụ thuộc.

Hệ quả của cách 1: chỉ báo "ai ở gần" trên máy khách là **gợi ý giao diện**; ai thật sự nhận do máy chủ quyết và báo lại cho người gửi qua `chatAck.n`.

## 5. Bán kính và quy tắc gần

- `chat.radius = 150` m, khoảng cách 3D giữa hai `pos`, **tính cả biên** (`d ≤ radius`). **(Claude, ước lượng)** Lý do: nhãn tên đã ghi khoảng cách tới từng người nên 150 m là tầm còn "thấy nhau"; hai xe ngược chiều 100 km/h ở trong tầm nhau ≈ 5 s (đủ nhận một câu), người đi dạo gặp người đi dạo có hàng phút; dù bay thấp (sàn 7 m) nói được với người dưới đất, bay cao 200 m thì không. Một số duy nhất cho mọi loại để quy tắc dễ hiểu ("ai cách tôi ≤ 150 m"); đổi ở `multiParams.chat.radius`.
- Chỉ báo phía khách dùng trễ hai ngưỡng để không nhấp nháy ở biên: vào danh sách gần khi `d ≤ nearIn` (140 m), ra khi `d > radius` (150 m). Khách vì vậy thận trọng hơn máy chủ: đã báo "gần" thì gần như chắc máy chủ giao.
- Khoảng cách phía khách: từ **vị trí mình vừa gửi lên** (đúng cái máy chủ biết) tới vị trí nội suy của người khác. Không dùng camera hay tọa độ màn hình.
- Tính mỗi `nearTickMs` 500 ms bằng `setInterval`, ngoài vòng vẽ; chỉ ghi DOM khi danh sách đổi.
- Người gửi chưa có `pos` trên máy chủ (vừa vào chỗ, hoặc Durable Object vừa thức sau hibernation mà tab đang ẩn nên chỉ gửi `hb`): tin không tới ai, hồi âm `n: 0`.
- Đủ điều kiện nhận (máy chủ): đang giữ slot bất kỳ loại nào, đã có `pos`, `now − seen ≤ slotTimeoutMs`, không phải người gửi, `d ≤ radius`. Slot vừa dựng lại sau hibernation (`pos = null`) chưa đủ điều kiện tới khi gửi `pos` kế tiếp (≤ 0,2 s với khách đang vẽ).
- Đổi chế độ (đi dạo → xe máy) là đóng phiên cũ, mở phiên mới: slot cũ được trả ngay khi socket đóng, lịch sử chat của phiên cũ xóa. Không có trạng thái "còn ở gần" sót lại.

## 6. Giao thức

Khách → máy chủ: `{ t: 'chat', text: string, id: number }` (`id`: số nguyên do khách đếm để ghép với hồi âm).

Máy chủ → từng người nhận: `{ t: 'chat', k: 'fly' | 'walk' | 'drive', slot: number, name: string, text: string }`. `k`, `slot`, `name` do máy chủ điền từ slot của kết nối gửi; trường cùng tên khách tự gửi bị bỏ qua.

Máy chủ → người gửi: `{ t: 'chatAck', id, n }` (`n` = số người đã nhận, có thể 0) hoặc `{ t: 'chatAck', id, why }` với `why`: `'slot'` (không giữ chỗ), `'rate'`, `'empty'`, `'bad'`. Người gửi không nhận lại tin của mình; khách tự hiện ngay và cập nhật theo hồi âm.

`lobby` thêm `chat: 1`: khách chỉ bật chat khi thấy cờ này (máy chủ cũ không có ⇒ ẩn nút chat). Khách cũ bỏ qua trường lạ và tin lạ.

Giới hạn kích thước: tin `chat` được dài tới `chat.msgBytes` 1024 đơn vị UTF-16; mọi tin khác giữ `maxMsgBytes` 256.

## 7. Làm sạch và chống lạm dụng

`exSanitizeChat(raw)` trong `protocol.ts` (khách và máy chủ dùng chung): chỉ nhận chuỗi; `\r\n` → `\n`; bỏ ký tự điều khiển (giữ `\n`), surrogate lẻ (để `JSON.stringify` không nở mỗi ký tự thành 6) và ký tự định dạng / bidi (giữ U+200D và U+200C: tiếng Hindi, Ba Tư cần ZWNJ); dồn dấu chồng quá `chat.marksMax` 4 liên tiếp; giữ tối đa `chat.linesMax` 4 dòng (phần sau nối bằng khoảng trắng); cắt còn `chat.textMax` 200 code point; cắt khoảng trắng; `null` nếu không còn ký tự thấy được.

Máy chủ:
- Danh tính theo kết nối (mục 6) ⇒ không giả danh được.
- Giới hạn tần suất: `chat.ratePerWin` 5 tin mỗi `chat.rateWinMs` 10 s cho một kết nối; quá thì `why: 'rate'`, không giao.
- Lọc từ tục: `exIsBadText` mới ở `badwords.ts`, chỉ tiếng Việt + Anh, so **theo từ**: danh sách `TONED`, `WORD` và `SUB` (so cả cụm như từ / dãy từ nguyên vẹn, không so chuỗi con dính liền như lọc tên, tránh chặn nhầm "cut the", "mishit"); **không** dùng `PLAIN` (`cac`, `buoi`, `lon` gõ không dấu trùng "các", "buổi", "lớn"). Trúng thì `why: 'bad'`.
- Gói hỏng (không phải JSON, sai kiểu, quá dài) bị bỏ như các tin khác.

Khách: mọi chữ nhận được hiện bằng `textContent` (không `innerHTML`); `<script>` hiện thành chữ. Ô nhập `maxlength`, tự chặn gửi rỗng và gửi quá `ratePerWin` (hiện lý do), nhưng máy chủ mới là nơi quyết.

Không lộ bí mật: khách chỉ biết địa chỉ WebSocket công khai sẵn có; Worker không có khóa nào.

## 8. Giao diện

```
┌──┐  ┌─────────────────────────────┐
│💬│  │ Bạn đang ở gần Minh.        │  ← dòng trạng thái
│ 2│  ├─────────────────────────────┤
└──┘  │ Minh 14:02                  │
 ↑    │ ┌───────────────┐           │
số    │ │ Chào bạn!     │           │
người │ └───────────────┘           │
gần / │                 14:02 ✓     │
chấm  │           ┌───────────────┐ │
chưa  │           │ Chào Minh     │ │
đọc   │           └───────────────┘ │
      ├─────────────────────────────┤
      │ [Nhập tin nhắn…      ] [➤]  │
      └─────────────────────────────┘
```

- Nút `#exChatBtn` (💬, 44 × 44 px) ở mép trái vật lý (`left`, không lật theo RTL, như `#stHud` / `#drHud`), giữa chiều cao màn hình: trống ở cả bốn chế độ trên máy tính và điện thoại dọc (đáy trái là bản đồ nhỏ / cần gạt, đáy phải là danh sách / bàn đạp, trên là gợi ý phím và nút Thoát). Ngoại lệ: lái ô tô / xe máy trên máy cảm ứng, bản đồ nhỏ nằm trên trái (56 → ≈ 184 px) nên ở điện thoại ngang (cao ≈ 390 px) nút dời sang cạnh phải bản đồ, ngang đáy bản đồ. `z-index` 6, trên lớp vuốt `#stLook` / `#drLook` (4) và danh sách (5). Test đo chồng lấn khung bao ở 4 chế độ × (máy tính, điện thoại dọc, điện thoại ngang). Bảng đang mở được phép che bản đồ nhỏ. Thân tin và bong bóng đặt `dir="auto"`; tin của mình nằm cuối dòng (`flex-end`, tiếng Ả Rập tự đảo). **(Claude)** Số người ở gần hiện thành huy hiệu; chấm đỏ khi có tin chưa đọc lúc bảng đóng; nút nháy một lần khi có người mới vào tầm.
- Bảng `#exChat` mở cạnh nút, rộng ≤ 300 px, cao ≤ 46 % màn hình, kiểu `.panel` sẵn có. Mở / đóng: bấm nút, phím **Enter** (khi không ở trong ô nhập), **Esc** trong ô nhập chỉ đóng bảng (không thoát chế độ): trình nghe `keydown` trên chính ô nhập gọi `stopPropagation()` trước khi sự kiện nổi bọt tới `window`, nơi `explore/index.ts` thoát chế độ. Đóng bảng bằng cách nào cũng `blur()` ô nhập, nếu không WASD tiếp tục bị `isField` nuốt. Enter toàn cục bỏ qua khi đích là nút / ô nhập.
- Dòng trạng thái: không ai ở gần ("Chưa có ai ở gần để trò chuyện.", khóa gửi) · một người ("Bạn đang ở gần Minh.") · nhiều người ("3 người ở gần.") · mất kết nối ("Mất kết nối. Không gửi được tin nhắn.", khóa gửi) · đang xem ("Vào chỗ để trò chuyện.", khóa gửi).
- Tin của mình bên phải, của người khác bên trái có tên (chấm màu theo slot như danh sách) và giờ `HH:MM`. Tin của mình có trạng thái: đang gửi → ✓ (đã tới `n` người) / "Không ai ở gần nhận được" (`n = 0`) / "Chưa gửi được" (quá `ackMs` 4 s không hồi âm, hoặc mất kết nối) / "Bạn gửi nhanh quá" / "Tin nhắn không phù hợp".
- Tự cuộn xuống cuối khi mình gửi hoặc khi đang ở gần cuối; đang đọc lại phía trên thì không giật.
- Enter gửi, Shift + Enter xuống dòng; đang gõ bộ gõ (IME, `isComposing`) thì Enter không gửi.
- Lịch sử chỉ trong bộ nhớ, tối đa `chat.historyMax` 60 tin, xóa khi đóng phiên.
- Gõ trong ô chat tính là "còn đó" (`exMulti.activity()`), không lái nhân vật / xe (cơ chế `isField` sẵn có).
- Nút và bảng chỉ hiện khi đang trong chế độ khám phá, phiên có máy chủ hỗ trợ chat; ẩn khi chơi một mình từ đầu.

**Bong bóng trên đầu:** `labels.ts` thêm một `div.ex-mp-bubble` cho mỗi nhãn, đặt ngay trên nhãn tên bằng cùng phép chiếu sẵn có; hiện chữ (cắt `chat.bubbleChars` 60) trong `chat.bubbleMs` 5 s rồi ẩn. Không thêm hình học, không lệnh vẽ. Mình không có nhãn nên không có bong bóng của mình.

## 9. Kiến trúc mã

| File | Việc |
|---|---|
| `src/explore/multi/params.ts` | khối `chat` (mọi số ở trên; `CONFIG.explore.multi.chat`) |
| `src/explore/multi/protocol.ts` | kiểu tin `chat` / `chatAck`, `lobby.chat`, `exSanitizeChat` |
| `server/multi/src/badwords.ts` | `exIsBadText` |
| `server/multi/src/room.ts` | `onChat`, giới hạn kích thước theo loại tin, `lobby.chat`, `Conn.chat` (dấu giờ để giới hạn tần suất) |
| `src/explore/multi/session.ts` | `chatOk`, `sendChat`, `onChat`, `onChatAck` |
| `src/explore/multi/chatCore.ts` (mới, không DOM) | sổ tin (thêm, hồi âm, quá hạn, cắt lịch sử, chưa đọc), tính danh sách gần có trễ hai ngưỡng, giới hạn tần suất phía khách |
| `src/explore/multi/chat.ts` (mới, DOM) | `exChat`: nút, bảng, vẽ tin, phím, đồng hồ 500 ms, nối phiên |
| `src/explore/multi/labels.ts` | bong bóng `exLabelsSay` |
| `src/explore/multi/index.ts` | gọi `exChat` trong `begin` / `end` / `onChange`, ghi vị trí mình lúc gửi `pos` |
| `index.html`, `src/styles/main.css`, 9 file `locales/*.json` | khung DOM, kiểu, khóa `chat*` |
| `server/multi/src/worker.ts` | không đổi (đã gửi được tin tới một `id`) |

Không thư viện mới, không biến môi trường mới, không đổi `wrangler.toml`.

## 10. Trường hợp biên

| Tình huống | Hành vi |
|---|---|
| Hai người cùng lại gần | mỗi tin tính lại khoảng cách lúc nhận; ai tới trước tầm thì nhận trước |
| Đúng biên 150 m | được giao (tính cả biên) |
| Ra vào tầm liên tục | máy chủ quyết theo từng tin; chỉ báo có trễ 140 / 150 m |
| Người nhận rớt mạng | socket đóng ⇒ slot trả ngay; chết lặng ⇒ `seen` quá 10 s thì không còn nhận |
| Mình rớt mạng | phiên thành `solo`, dòng trạng thái báo, tin đang chờ thành "Chưa gửi được" |
| Vào lại | phiên mới, slot mới, lịch sử trống |
| Đổi đi dạo → xe máy | như trên |
| Đủ 15 chỗ | vẫn chỉ ≤ 14 phép tính mỗi tin |
| Vào vùng đang có người chat | nhận các tin **sau** khi vào tầm; không có lịch sử cũ |
| Hai tin gần như cùng lúc | Durable Object xử lý tuần tự; mỗi người thấy theo thứ tự máy chủ giao |
| Tin rỗng / chỉ khoảng trắng | khách không gửi; máy chủ `why: 'empty'` |
| Tin quá dài | cắt 200 code point; gói > 1024 đơn vị bị bỏ, khách báo "Chưa gửi được" sau `ackMs` |
| Giả danh | không thể: tên / slot lấy từ kết nối |
| Gửi cho người ngoài tầm | không có trường "gửi cho ai"; người nhận do máy chủ tính |
| Máy chủ cũ + khách mới | không có `lobby.chat` ⇒ ẩn chat |
| Máy chủ mới + khách cũ | khách cũ bỏ qua tin `chat` |

## 11. Hiệu năng

- Vòng vẽ chỉ thêm: một phép gán vị trí lúc gửi `pos` (5 lần/s) và, trong `exLabelsUpdate`, một phép so giờ cho mỗi bong bóng đang hiện + ghi `transform` cùng lúc với nhãn (đã có ngưỡng 1 px). Không cấp phát mỗi khung (D-018).
- Danh sách gần: `setInterval` 500 ms, ≤ 14 phép `hypot`, ghi DOM khi khóa danh sách đổi. Đồng hồ chỉ chạy khi phiên có chat; dừng ở `exMulti.end()`.
- Vẽ tin: thêm một nút DOM mỗi tin, không dựng lại cả danh sách; quá `historyMax` thì gỡ nút cũ nhất.
- Trình nghe gắn một lần lúc khởi tạo trên phần tử cố định (như `lobby.ts`), không gắn / gỡ theo lần mở bảng ⇒ mở đóng nhiều lần không rò.
- 0 lệnh vẽ, 0 program, 0 đèn thêm.

## 12. Kiểm thử

- `test:multi:unit` (thêm): phòng (trong / ngoài tầm, đúng biên, khác loại, ba người một vùng, ra khỏi tầm thì thôi nhận, vào tầm thì nhận, không slot, chưa có `pos`, `seen` quá hạn, rỗng, dài, HTML giữ nguyên là chữ, trường giả danh bị bỏ, giới hạn tần suất, gói hỏng, 15 chỗ, `lobby.chat`), `exSanitizeChat`, `exIsBadText`, phiên (`chatOk`, gọi lại, không gửi khi không giữ chỗ), `chatCore` (trễ hai ngưỡng, hồi âm, quá hạn, chưa đọc, cắt lịch sử).
- `test:multi:worker` (thêm): ba WebSocket thật qua `wrangler dev`: hai gần, một xa.
- `test:chat` (mới, `tests/chat-check.mjs`, trình duyệt + bot) **chưa viết** (theo lời người dùng 2026-11-14; hiện chỉ có `window.__app.multi.chat.debug()` sẵn cho test sau này), dự kiến: bốn chế độ; chỉ báo A / B / C; gửi tới bot gần mà bot xa không nhận; nhận tin + bong bóng; `<img onerror>` hiện thành chữ; Enter / Shift + Enter / Esc; gõ WASD trong ô không di chuyển; tắt máy chủ ⇒ trạng thái mất kết nối; mở đóng 50 lần không tăng số trình nghe / nút DOM; lệnh vẽ không đổi khi mở bảng.
- `typecheck`, `build`; `test:mobile` nếu chạm bố cục điện thoại. Test nặng khác chạy một lần cuối nhánh theo lệ của dự án.

## 13. Triển khai

Chat chỉ hoạt động trên mạng sau khi Worker `danang-sky` được deploy bản mới (`npm --prefix server/multi run deploy`). **Đã deploy 2026-11-14** theo lời người dùng, từ mã nhánh tại `bb5ab71`, version `c5f0ac75-cb7f-4739-92c8-ee2b74564a10`; kiểm trực tiếp: `lobby.chat: 1`, `chatAck why 'slot'` khi chưa giữ chỗ (chưa thử hai người thật). Lần deploy sau vẫn phải hỏi người dùng riêng. Trang Netlify có chat sau khi PR #36 merge; trước đó hoặc với máy chủ cũ trang mới gặp máy chủ cũ sẽ ẩn chat, mọi thứ khác như cũ. Thứ tự deploy trang / Worker nào trước cũng an toàn (mục 10).

## 14. Hạn chế đã biết

- Vị trí do khách tự báo: khách sửa mã có thể báo vị trí giả (trong khung kẹp) để nghe vùng khác. Muốn chặn phải có mô phỏng phía máy chủ; ngoài phạm vi.
- Một người mở nhiều tab chiếm nhiều chỗ thì mỗi tab có hạn mức chat riêng (như hạn chế sẵn có của phòng).
- Lọc từ tục ngắn (vi + en), không phải kiểm duyệt.
- Bản dịch 8 ngôn ngữ của khóa `chat*` cần người bản ngữ duyệt.
- Tin rỗng / tục vẫn tính vào hạn mức 5 tin / 10 s của máy chủ; lọc từ tục so nguyên từ nên dạng biến thể ("fucking") lọt.
- Không tự kết nối lại: mất kết nối thành `solo`, phải vào lại chế độ, lịch sử xóa. Người đang xem (không giữ chỗ) không chat.
- Người gửi chưa có `pos` trên máy chủ (tab ẩn sau hibernation) thì `n: 0`.
- U+2028 / U+2029 không bị bỏ; `\p{Cf}` xóa cả ký tự tag của cờ emoji vùng.
- Đồng hồ 500 ms chạy cả khi máy chủ không hỗ trợ chat (thoát sớm ở vòng đầu).
- Chưa kiểm trong trình duyệt: dù lượn, ô tô, xe máy, điện thoại, RTL, mất kết nối, ba người trở lên, chồng lấn nút chat với HUD (xem `tests/KET-QUA.md`).

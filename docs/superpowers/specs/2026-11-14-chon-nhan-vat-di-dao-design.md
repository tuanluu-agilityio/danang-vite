# Chọn nhân vật nam / nữ ở chế độ Đi dạo, đồng bộ giữa các máy (D-039)

_2026-11-14 · nhánh `feature/chon-nhan-vat-di-dao` (từ `main`) · trạng thái: đã triển khai, chờ deploy Worker `danang-sky`_

Bản yêu cầu của người dùng ("Implement Male / Female Character Selection & Multiplayer Synchronization", 2026-11-14) bảo làm tự chủ, không hỏi lại thiết kế; các lựa chọn dưới đây là của agent.

## 1. Vấn đề và nguyên nhân gốc

Hai máy thấy cùng một người bằng hai nhân vật khác nhau (A thấy B là nữ, B tự thấy mình là nam).

Nguyên nhân: mô hình không phải là dữ liệu của người chơi mà là quy tắc tính tại từng máy. `stModelFor(slot, isSelf)` (`src/explore/stroll/anim.ts`, D-030) trả mô hình 0 (`p0`, nam) cho chính mình và `1 + slot mod 4` (`p1` nữ, `p2` nam, `p3` nữ, `p4` nam) cho người khác; `stPlace()` trong `avatars.ts` gọi nó với `who === 1`. Giao thức (`multi/protocol.ts`), phiên (`session.ts`) và phòng (`server/multi/src/room.ts`) không chở thông tin nhân vật nào: `join` chỉ có tên + loại, `lobby.walkers` chỉ có `{ slot, name }`. Vì vậy ai cũng tự thấy mình là nam áo đỏ, còn người khác thấy họ theo số slot. Đã ghi là hạn chế đã biết của D-030.

## 2. Mục tiêu / không làm

- Chọn Nam hoặc Nữ ở sảnh Đi dạo (có ảnh xem trước, ô đang chọn nổi bật, mặc định Nam), giữ luồng nhập tên + nút vào như cũ.
- Mọi máy vẽ một người bằng nhân vật do chính người đó chọn: không phụ thuộc slot, thứ tự vào, hay máy nào đang nhìn.
- Người vào sau thấy đúng ngay; kết nối lại / tải lại trang giữ lựa chọn; khách và máy chủ bản cũ không lỗi.
- Không làm: thêm nhân vật mới, đổi nhân vật khi đang đi, sửa chế độ dù lượn / lái xe, dựng kiến trúc mạng mới.

## 3. Cách làm đã cân nhắc

1. **Chở lựa chọn trong `join`, máy chủ giữ theo slot và phát trong `lobby.walkers` (chọn).** Đi đúng đường của tên người chơi: tới mọi máy cùng lúc với tên, trước mẫu vị trí đầu; người vào sau nhận ở `lobby` đầu; sống qua hibernation nhờ attachment. Đổi 3 dòng dữ liệu ở máy chủ.
2. Chở trong từng gói `pos`: không cần đổi `lobby`, nhưng tốn băng thông 10 lần/s, và nhân vật chỉ biết sau mẫu đầu (dễ dựng nhầm rồi đổi).
3. Chỉ sửa phía khách cho mọi máy cùng dùng `f(slot)`: hết lệch nhưng không cho chọn, và nhân vật đổi khi đổi slot lúc kết nối lại.

## 4. Thiết kế

- **Nhân vật:** `ch` = 0 nam, 1 nữ. `exCharNorm(v)` (`protocol.ts`): chỉ `1` là nữ, mọi giá trị khác (không có, số lạ) là nam. `CONFIG.stroll.anim.chars = [0, 3]`: nam = `p0` (Male_Adult_10), nữ = `p3` (Female_Adult_03), hai mô hình đã có, cùng bộ đoạn chuyển động, cùng tỉ lệ. `stCharModel(ch)` thay `stModelFor`. `p1`, `p2`, `p4` còn trong `public/people/` (`gen:people`, test glb) nhưng không còn được nạp khi chạy.
- **Lựa chọn của mình:** `src/explore/stroll/char.ts` (`stChar.get / set`), nhớ ở `localStorage['stChar']` như tên. Đi một mình, `?explore=stroll`, mất kết nối đều dùng lựa chọn này.
- **Giao thức:** `join` kind `walk` thêm `ch`; `Flyer` thêm `ch?` (chỉ có trong `walkers`). Máy chủ: `Slot.ch`, `onJoin` chuẩn hóa, `lobby()` phát, `restore()` + attachment của Worker giữ `ch`. `pos` không đổi.
- **Phía khách:** `MultiSession.ch` (gửi ở `join()`, dùng cho cả sảnh lẫn lời mời khi đang xem); `exMulti.begin` nạp từ `stChar`; `stAvatars.sync` ghi `ch` từng slot, coi đổi `ch` là đổi chủ (gỡ bản sao cũ); `stPlace` chọn mô hình: mình theo `stChar`, người khác theo `ch` của họ.
- **Giao diện:** `#stCharPick` trong `#exMpLobby` (nhóm radio hai nút, ảnh `public/people/thumb-m.webp` / `thumb-f.webp` do `npm run gen:thumbs` vẽ từ chính hai mô hình), chỉ hiện ở sảnh đi dạo, cả khi ngoại tuyến. Khóa i18n `stChar`, `stCharM`, `stCharF` (9 ngôn ngữ).
- **Tương thích:** khách cũ + máy chủ mới: không gửi `ch` → nam, đúng nhân vật khách cũ tự thấy. Khách mới + máy chủ cũ: `walkers` không có `ch` → mọi người khác là nam; người chọn nữ tự thấy nữ nhưng người khác thấy nam cho tới khi deploy Worker. Thứ tự deploy nào cũng không lỗi.
- **Trần tài nguyên:** hai ảnh xem trước ≤ 20 kB mỗi ảnh (`tests/stroll-unit/glb.test.ts`); không thêm mô hình, không thêm thư viện; tối đa hai mô hình được nạp thay vì năm.

## 5. Kiểm

- Đơn vị: `test:stroll:unit` (`stCharModel`, hai máy giả lập thấy như nhau ở cả bốn tổ hợp, không dựng mặc định rồi đổi, đổi chủ slot, khách cũ), `test:multi:unit` (phòng: thứ tự vào, vào sau, giá trị lạ, restore; phiên: `join` gửi `ch`).
- Trình duyệt: `npm run test:char` (`tests/char-check.mjs`): ba trình duyệt độc lập + bot qua `wrangler dev`, kịch bản A–G của bản yêu cầu.

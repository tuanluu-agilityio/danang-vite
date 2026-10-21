# PROMPT — Thêm giọng thuyết minh tiếng Nga (ru) cho Tour

> Dán toàn bộ file này cho agent lập trình (Claude Code) đang mở thư mục `danang-vite`.

---

## 0. Vai trò và mục tiêu

Bạn là kỹ sư front-end kiêm biên tập viên lời thoại tiếng Nga. Dự án `danang-vite` đã có giọng thuyết minh cho Tour bằng **tiếng Việt (vi)** và **English (en)**. Giao diện tiếng Nga đã có (`src/i18n/locales/ru.json`, commit "Add Russian language support"), nhưng **chưa có giọng đọc**, nên khi chọn Русский thì Tour chạy lặng và nút **Озвучка** bị khóa.

Đọc trước:
- [README.md](../README.md), mục "Giọng thuyết trình của Tour (vi, en)".
- [scripts/gen-narration.mjs](../scripts/gen-narration.mjs): sinh mp3 bằng `msedge-tts`, ghi `public/voice/manifest.json`.
- [scripts/narration/vi.json](../scripts/narration/vi.json) và [scripts/narration/en.json](../scripts/narration/en.json): lời thoại hiện có.
- [src/i18n/locales/ru.json](../src/i18n/locales/ru.json): chú thích Tour tiếng Nga (khóa `stops`, `ttlStops`, `tpStops`, `shStops`).
- [src/audio/narration.ts](../src/audio/narration.ts) và [tests/voice-check.mjs](../tests/voice-check.mjs).

**Nhiệm vụ:** thêm giọng thuyết minh tiếng Nga cho cả 4 Tour (Cầu Rồng, Trần Thị Lý, Thuận Phước, Sông Hàn), **28 điểm dừng**, để khi chọn Русский thì nút Озвучка mở và Tour đọc bằng giọng Nga.

**Không làm:**
- Không đổi `narration.ts`, `tour.ts` hay logic phát giọng. Hệ thống tự nhận ngôn ngữ mới qua `manifest.json`.
- Không sửa, không tạo lại clip `vi`/`en` đang có (không chạy `--force`). Hash trong manifest phải giữ nguyên với vi/en.
- Không đụng các file Hầm vượt sông Hàn đang làm dở (`src/bridges/han-tunnel/`, `src/ui/hrUI.ts`, khóa `hrStops`). Tour Hầm chưa có lời thoại vi/en nên chưa làm bản Nga (xem mục 6).

---

## 1. Viết `scripts/narration/ru.json`

### 1.1 Cấu trúc
- Đúng 4 khóa, đúng thứ tự và số phần tử như `vi.json`: `stops` (8), `ttlStops` (7), `tpStops` (7), `shStops` (6).
- Mỗi phần tử là **một chuỗi** lời thoại cho điểm dừng cùng chỉ số. Thứ tự điểm dừng phải khớp `ru.json` trong `i18n/locales` (cặp `[tiêu đề, chú thích]`).
- JSON UTF-8, thụt lề 2 dấu cách, giống `en.json`.

### 1.2 Nội dung
- **Bản gốc là `vi.json`**, dùng `en.json` để đối chiếu cách diễn đạt. Dịch ý, không dịch từng chữ: câu văn phải là tiếng Nga tự nhiên của một hướng dẫn viên du lịch, giọng thân thiện, ngắn gọn.
- **Số liệu và sự kiện phải khớp đúng** bản vi/en (chiều dài, chiều cao, góc nghiêng, số làn, giờ phun lửa, ngày khánh thành...). Không thêm thông tin mới, không bớt số liệu.
- **Tên riêng thống nhất với `src/i18n/locales/ru.json`** (ví dụ: Хан, Хайтяу, Шонча, Ми Кхе, Мост Дракона, Чан Тхи Ли, Тхуан Фуок, Хайван...). Mở `ru.json`, lập danh sách tên riêng đang dùng và theo đúng danh sách đó. Nếu một tên chưa có trong `ru.json`, phiên âm theo quy ước Концевич (hệ phiên âm tiếng Việt sang tiếng Nga thông dụng) và giữ nhất quán ở mọi chỗ.
- Độ dài: mỗi câu Nga thường dài hơn bản Anh khoảng 10–20%. Cố giữ mỗi clip **không dài quá bản en cùng điểm dừng 3 giây**; nếu dài hơn thì rút gọn câu chữ, không bỏ số liệu.

### 1.3 Viết để máy đọc không vấp (quan trọng nhất với tiếng Nga)
Giọng TTS tiếng Nga hay đọc sai số vì phải chia cách theo giới, số, cách. Vì vậy:
- **Viết mọi con số bằng chữ, đã chia cách đúng ngữ pháp**: «шестьсот шестьдесят шесть метров», «длиной семьсот тридцать один метр», «на высоте ста сорока пяти метров», «двадцать девятого марта двухтысячного года». Tuyệt đối không để chữ số Ả Rập.
- Số thập phân viết bằng chữ: «тридцать семь с половиной метров», «девять и девять десятых метра», «четыреста восемьдесят семь и семь десятых метра».
- **Không viết tắt đơn vị**: «метров» (không «м»), «миллиметров», «килоньютонов», «градусов», «километров в час».
- Giờ: «в девять часов вечера», «в одиннадцать часов вечера» (không «21:00», không «9 p.m.»).
- Dùng chữ «ё» ở nơi cần (ещё, всё, её) để máy đọc đúng âm.
- Từ có thể đọc sai trọng âm, hoặc tên riêng Việt máy đọc lạ: có thể đặt dấu trọng âm bằng ký tự kết hợp U+0301 sau nguyên âm (ví dụ «Шонча́»). Chỉ dùng khi nghe thử thấy sai, đừng rải khắp nơi.
- Không dùng ký tự `&`, `<`, `>` (gói `msedge-tts` bọc văn bản vào SSML). Dấu ngoặc kép dùng «».
- Không viết tắt kiểu «т. е.», «и т. д.», «ок.»; viết đầy đủ «то есть», «около».

---

## 2. Thêm giọng vào `scripts/gen-narration.mjs`

- Thêm vào `VOICES`: `ru: 'ru-RU-SvetlanaNeural'` (giọng nữ, đồng bộ với `vi-VN-HoaiMyNeural` và `en-US-AriaNeural`). Nếu Svetlana không dùng được thì thử `ru-RU-DariyaNeural`, rồi mới tới `ru-RU-DmitryNeural`.
- Giữ nguyên thứ tự `vi`, `en` rồi mới tới `ru`, để manifest chỉ thêm khóa `ru`.
- Chạy `npm run gen:voice` (**không** `--force`). Kết quả mong đợi: "tạo mới 28, giữ nguyên 56". Nếu số "giữ nguyên" khác 56 nghĩa là clip vi/en bị tạo lại: dừng lại và kiểm tra.
- Kết quả: 28 file `public/voice/ru/<khóa>-<i>.mp3` và khóa `ru` trong `public/voice/manifest.json`.

---

## 3. Nghe thử và sửa lời

- Mở vài clip (ít nhất mỗi Tour 2 clip, ưu tiên clip nhiều số liệu: `stops-2`, `stops-6`, `ttlStops-1`, `ttlStops-2`, `tpStops-1`, `shStops-0`, `shStops-1`) để kiểm tra số đọc đúng, tên riêng nghe ổn, không bị cắt cụt.
- Không nghe được bằng tai thì ít nhất kiểm tra thời lượng trong manifest: clip ru phải dài hơn hoặc gần bằng clip en; clip ngắn bất thường (dưới 4 s) là dấu hiệu lỗi.
- Sửa câu trong `ru.json` rồi chạy lại `npm run gen:voice`, script chỉ tạo lại clip đã đổi.

---

## 4. Cập nhật test `tests/voice-check.mjs`

- Ở bước 1 và bước 2, đổi danh sách ngôn ngữ `['vi', 'en']` thành `['vi', 'en', 'ru']`.
- Ở bước 3, sau khi kiểm tra đổi sang `en`, thêm kiểm tra đổi sang `ru` phát `voice/ru/<khóa>-1.mp3`.
- Giữ bước 4 dùng `ja` làm ngôn ngữ chưa có giọng (không đổi sang `ru`).
- Sửa chú thích đầu file và dòng `console.log` cuối: "vi + en + ru, 4 tour, 28 điểm dừng mỗi ngôn ngữ".

Nếu bước 2 báo "chỗ trống ... < clip" cho tiếng Nga: **ưu tiên rút gọn lời thoại**. Chỉ khi rút không được nữa mới xem lại cách `tour.ts` kéo dài đoạn bay theo giọng (vi/en đang đạt nên logic đó đúng; thường lỗi nằm ở clip quá dài).

---

## 5. Cập nhật README

Trong mục "Giọng thuyết trình của Tour":
- Tiêu đề thành "(vi, en, ru)".
- Đường dẫn lời thoại thành `scripts/narration/{vi,en,ru}.json`.
- Danh sách giọng thêm `ru-RU-SvetlanaNeural`.
- Thêm một dòng ghi chú: lời thoại tiếng Nga viết số bằng chữ và chia cách đúng ngữ pháp; có thể đặt trọng âm bằng U+0301.

---

## 6. Ngoài phạm vi (ghi lại, không làm)

Tour Hầm vượt sông Hàn (`hrStops`) đang được xây và chưa có lời thoại vi/en. Khi `scripts/narration/vi.json` có khóa `hrStops`, làm thêm bản Nga theo đúng mục 1–4 và nhớ câu "đây là mô hình phương án đề xuất, chưa xây" (по-русски: «это модель предлагаемого проекта, тоннель ещё не построен»).

---

## 7. Kiểm tra hoàn thành

Chạy và dán kết quả thật:

```
npm run typecheck
npm run build && npm run test:voice
npm run test:tour
```

Đạt khi:
1. `test:voice` in "Giọng thuyết trình: đạt (vi + en + ru, ...)" và không có lỗi console.
2. `git diff --stat public/voice/vi public/voice/en` rỗng (clip vi/en không đổi).
3. Mở `npm run dev`, chọn Русский: nút Озвучка mở được, chạy Tour Cầu Rồng thì nghe giọng Nga ở từng điểm dừng, chú thích trên màn hình khớp nội dung đang đọc.

Báo cáo cuối: số clip đã tạo, tổng thời lượng ru so với en của từng Tour, các câu đã phải rút gọn, các tên riêng đã thêm dấu trọng âm.

Commit gồm: `scripts/narration/ru.json`, `scripts/gen-narration.mjs`, `public/voice/ru/`, `public/voice/manifest.json`, `tests/voice-check.mjs`, `README.md`. Không commit các file Hầm vượt sông Hàn đang làm dở.

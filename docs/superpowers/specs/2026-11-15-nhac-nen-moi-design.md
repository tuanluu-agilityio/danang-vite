# Nhạc chủ đề "The Spirit of Da Nang" (D-046)

_2026-11-15 · nhánh `feature/nhac-nen-moi` (từ `main` `51e5518`) · trạng thái: đã triển khai (PR #42)_

Bản yêu cầu của người dùng ("Redesign the entire background music experience", 2026-11-15) bảo xem mã thật rồi làm tới cùng, không dừng ở kế hoạch; các lựa chọn dưới đây là của agent, người dùng chưa duyệt từng mục; họ tự review demo rồi bảo merge (2026-11-15). Agent không nghe được bản nhạc, chỉ đo biên độ.

## 1. Vì sao nhạc cũ không hợp

- Đàn tranh + đàn bầu ngũ cung, 74 → 60 nhịp / phút, giai điệu là bước ngẫu nhiên: nghe như nhạc thiền, không có chủ đề để nhớ, không tạo cảm giác lên đường.
- Không biết chế độ: bay dù, lái xe, đi dạo, Tour đều một kiểu.
- Tắt mặc định, và hàng nút âm thanh bị ẩn trong mọi chế độ khám phá (`body.explore .audio-row`), nên phần lớn người xem chưa từng nghe.

## 2. Quyết định

1. **Nhạc do chính trang tổng hợp bằng Web Audio theo một bản tổng phổ viết tay**, không dùng tệp âm thanh. Lý do: môi trường làm việc không có công cụ tạo nhạc; nhạc kho có giấy phép thì không có stem cùng nhịp / tông để phối theo chế độ; kiến trúc sẵn có đã là "tổng hợp, không file ngoài" (không thêm dung lượng tải, không thư viện). Đổi lại: tiếng là synth, **không phải dàn nhạc thu thật**.
2. **Một bài, nhiều bản phối.** 12 lớp (dây nền, đệm, rải, bass, trống cái, trống lẫy, hi-hat, gõ, giai điệu synth, dây gảy, chuông, không khí), mỗi lớp một nút âm lượng. Đổi chế độ / ngày đêm / thời tiết = trượt các nút đó trong ≈ 2 s; nhạc không dừng, không phát lại, không có hai bản chồng nhau.
3. **Nhạc tự bật ở thao tác đầu tiên của người xem** khi họ chưa từng chọn (`CONFIG.music.autoStart`); ai đã tắt thì giữ tắt; `?test` chỉ theo lựa chọn đã lưu. Trình duyệt không cho phát trước thao tác đầu nên không có lỗi autoplay.
4. **Hàng nút nhạc + âm lượng hiện cả trong chế độ khám phá** (bảng ⚙), chỉ ẩn nút Thuyết minh ở đó. Không thêm nút mới.

## 3. Bản nhạc (`src/audio/score.ts`)

Rê trưởng, 112 nhịp / phút, 80 ô ≈ 2 phút 51 giây, nối liền về đầu (nốt được lên lịch liên tục nên không có điểm nối của tệp lặp). Giai điệu chỉ dùng ngũ cung Rê – Mi – Fa♯ – La – Si và tiếng dây gảy Karplus–Strong: nét miền biển Việt Nam nằm ở thang âm và âm sắc, không dùng nhạc cụ dân tộc làm màu.

| Đoạn | Ô | Nội dung |
|---|---|---|
| invitation | 4 | mô-típ La – Rê – Mi – Fa♯ đi lên ngay ô đầu (dây gảy + chuông), rải synth, tiếng dâng |
| journey | 8 | trống cái bốn phách, bass, đệm 3-3-2 vào dần; nửa sau của chủ đề |
| theme | 16 | chủ đề đầy đủ bằng synth, đủ trống; lượt hai thêm bè dây đối đáp |
| breath | 8 | lặng trống, dây gảy chơi chủ đề trên hoà âm đổi màu |
| lift | 4 | đẩy vào cao trào |
| summit | 16 | chủ đề thêm quãng tám, bè dây suốt đoạn |
| discover | 8 | đoạn nối hỏi – đáp, trống nửa nhịp |
| return | 8 | chủ đề trở lại |
| horizon + turn | 4 + 4 | thưa dần, tiếng dâng dẫn về đầu bài |

Mỗi vòng đổi kiểu rải và thêm bè quãng tám ở vòng lẻ để không nghe như một tệp lặp.

## 4. Bản phối (`CONFIG.music.modes`, chọn bằng `musicModeOf(cam.mode)`)

| Chế độ | `cam.mode` | Tính cách |
|---|---|---|
| overview | orbit, fly, góc nhìn cũ, màn chọn | đủ bản phối |
| glider | glider | dây + không khí + chuông tăng, trống cái nhẹ, không trống lẫy |
| car | car | bass + trống rõ, cả bản "thở" theo trống cái |
| bike | bike | hi-hat móc kép, gõ viền, bass đảo phách 3-3-2, trống lẫy sắc hơn |
| stroll | stroll, swRide | dây gảy + chuông mang giai điệu, trống gần như lặng |
| tour | tour, storm, đang bay tới Tour | không giai điệu synth, nhỏ hơn 20 %; có giọng đọc thì hạ thêm 10 dB |

- **Đêm** (`night`): lọc tối hơn, chuông + không khí + hồi âm tăng, trống / giai điệu dịu; `night > 0,5` lúc vào đoạn thì hoà âm theo Si thứ (cùng giai điệu).
- **Mưa**: giai điệu synth lùi, dây gảy + không khí tăng, dây tối hơn. **Bão**: thêm nền trầm, trống trầm thưa, bass giữ nốt Rê; nhạc hạ 30 % như cũ (`weather.sound.musicDuck`).
- **Giọng thuyết minh**: hạ 10 dB (hằng số 0,12 s), trả lại chậm (0,9 s).
- Vào một chế độ khám phá có tiếng "mở màn" ngắn (`CONFIG.music.sting`, 0 = tắt).

## 5. Mã

- `src/audio/score.ts` (dữ liệu thuần), `src/audio/music.ts` (bộ phát + `renderMusic` kết xuất ngoại tuyến), `src/audio/index.ts` (chuỗi tổng, bật / tắt, `setMode`, `duck`, `musicPos`), `src/main.ts` (một dòng `audio.setMode`), `src/ui/audioUI.ts` (tự bật, bỏ focus thanh âm lượng khi đang khám phá), `main.css` (hiện hàng âm thanh khi khám phá), `CONFIG.music`.
- Không đổi: tiếng sông / mưa / gió / sấm / còi / mô tơ cầu, `sfxPort` / `extPort` của tiếng xe, `narration.ts`. Trống của màn phun lửa chuyển từ nhánh nhạc sang nhánh hiệu ứng.
- Không thêm khóa i18n, không thêm gì vào cảnh 3D, không đổi `server/`.

## 6. Kiểm

- `npm run test:music:unit`: độ dài bài, giai điệu trong thang âm, hợp âm, ánh xạ `cam.mode`, tính cách từng bản phối.
- `npm run test:music`: kết xuất ngoại tuyến từng đoạn bằng `OfflineAudioContext` trong Chromium (không mở cảnh 3D), chấm đỉnh / RMS / giây lặng / thứ tự to nhỏ giữa các bản phối; `--wav` ghi tệp để nghe, `--solo` đo từng lớp, `--full` cả bài (rất chậm).

## 7. Hạn chế

- Nhạc tách khỏi hiệu ứng (sửa sau merge): nút Nhạc nền chỉ tắt nhánh nhạc (`audio.setMusic`); tiếng xe, phun lửa / nước, sông, mưa gió, còi chạy theo âm thanh chung, mở ở thao tác đầu tiên của người xem; thanh trượt là âm lượng chung. Không có nút tắt riêng hiệu ứng (kéo âm lượng về 0; tiếng xe có nút 🔊).

- Bộ lập lịch chạy trên luồng chính: nhìn trước 2 s (`CONFIG.music.lookahead`) để qua được các lần vòng vẽ khựng; khựng lâu hơn 2 s (lần đầu vào một chế độ, đo được 3,7–5,7 s trên máy đo) thì các bước lỡ giờ bị bỏ, dây nền vẫn ngân, nhịp vào lại đúng lưới. Hoa văn trống / bass theo chế độ vì vậy vào chậm tối đa 2 s.

- Sau merge (PR #46): bỏ tiếng dế về đêm theo phản hồi "tiếng rít" của người dùng; chưa xác nhận đó đúng là tiếng họ nghe.

- Agent không nghe được: hay / dở, có "muốn khám phá" không là việc của tai người. Mức từng lớp cân theo số đo RMS, không theo tai.
- Tiếng synth, không có dây / kèn thật; muốn chất dàn nhạc thật thì phải thay bằng bản thu (stem cùng 112 nhịp / phút, Rê trưởng thì giữ được cách phối theo lớp).
- Mỗi lần bật lại nhạc là vào từ đầu bài. Tải lại trang cũng vậy.
- Người xem cũ chưa từng bấm nút nhạc nay sẽ có nhạc ở thao tác đầu tiên.
- Trên điện thoại chưa đo tải CPU của bộ phát (khoảng 10–20 nút ngắn mỗi phách, 12 dao động chạy suốt).

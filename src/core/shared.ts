/* Uniform dùng chung cho mọi hiệu ứng LED / cửa sổ đêm */
export const shared = { uTime: { value: 0 }, uNight: { value: 0 } };
/* Hệ số cỡ hạt lửa / nước theo chiều cao khung hình (cập nhật khi đổi kích thước) */
export const pScale = { value: 1 };
/* Uniform thời tiết (mặt ướt, mưa, gió, mù nóng, hệ số lắc). TÁCH khỏi `shared` vì MAT.ledRail dùng nguyên object `shared` làm uniforms.
   Mặc định 0 = không đổi gì; chỉ weather/index.ts ghi vào.
   Gió (GĐ4): uWindDir = hướng gió thổi tới (cos, sin) trên mặt XZ; biên độ lắc ĐÃ nhân hệ số phóng đại (m): uSwayTp (hanger TP),
   uSwayTtl (dây văng TTL, đường cong mưa–gió), uSwaySh (dây văng Cầu sông Hàn); uTreeLean / uTreeSway: độ nghiêng tĩnh / dao động tán cây (m dịch trên mỗi m cao). */
export const weatherU = {
  uWet: { value: 0 }, uRain: { value: 0 }, uWind: { value: 0 }, uGust: { value: 0 }, uHaze: { value: 0 }, uSwayK: { value: 0 },
  uWindDir: { value: [1, 0] }, uSwayTp: { value: 0 }, uSwayTtl: { value: 0 }, uSwaySh: { value: 0 }, uTreeLean: { value: 0 }, uTreeSway: { value: 0 },
  uSagTp: { value: 0 }   // GĐ7: võng thêm của cáp chủ Thuận Phước khi nóng (m, ĐÃ nhân phóng đại); 0 = không đổi gì
};
/* Hệ số gió cho code CPU (thuyền, lửa/nước Cầu Rồng, râu rồng, sóng). Mặc định trung tính: x = z = 0, nhân 1 → không đổi hành vi. */
export const windFx = { x: 0, z: 0, boatRock: 1, whisker: 1, waveSpeed: 1 };
/* Vận hành theo thời tiết (GĐ5), mặc định trung tính: clear = tiến độ dọn xe khi đóng cầu (0–1); boatAway = tiến độ thuyền về bến (0–1);
   showAllowed = trình diễn Cầu Rồng được chạy; swingBlocked = khoá quay Cầu sông Hàn; wheelStopped = Vòng quay Mặt Trời dừng (GĐ6). KHÔNG đụng nút người dùng (lifeOn, show.on, quảng cáo). */
export const weatherFx = { clear: 0, boatAway: 0, showAllowed: true, swingBlocked: false, wheelStopped: false };
/* Phương tiện thứ i đã biến mất chưa khi tiến độ k (thứ tự cố định theo i, không dùng rand()): k = 0 → không ai, k = 1 → tất cả */
export const vanished = (i: number, k: number) => k > 0 && (i * 0.6180339887) % 1 < k;

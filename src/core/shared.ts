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
  uWindDir: { value: [1, 0] }, uSwayTp: { value: 0 }, uSwayTtl: { value: 0 }, uSwaySh: { value: 0 }, uTreeLean: { value: 0 }, uTreeSway: { value: 0 }
};
/* Hệ số gió cho code CPU (thuyền, lửa/nước Cầu Rồng, râu rồng, sóng). Mặc định trung tính: x = z = 0, nhân 1 → không đổi hành vi. */
export const windFx = { x: 0, z: 0, boatRock: 1, whisker: 1, waveSpeed: 1 };

/* Uniform dùng chung cho mọi hiệu ứng LED / cửa sổ đêm */
export const shared = { uTime: { value: 0 }, uNight: { value: 0 } };
/* Hệ số cỡ hạt lửa / nước theo chiều cao khung hình (cập nhật khi đổi kích thước) */
export const pScale = { value: 1 };
/* Uniform thời tiết (mặt ướt, mưa, gió, mù nóng, hệ số lắc). TÁCH khỏi `shared` vì MAT.ledRail dùng nguyên object `shared` làm uniforms.
   Mặc định 0 = không đổi gì; chỉ weather/index.ts ghi vào. */
export const weatherU = { uWet: { value: 0 }, uRain: { value: 0 }, uWind: { value: 0 }, uGust: { value: 0 }, uHaze: { value: 0 }, uSwayK: { value: 0 } };

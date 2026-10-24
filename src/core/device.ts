/* =====================================================================
   THIẾT BỊ (D-018) — đoán một lần lúc tải, trước khi tạo renderer: có phải điện thoại / máy yếu không.
   Dùng cho những thứ chỉ đặt được lúc khởi động (antialias của WebGL context, bóng đổ có tính trong shader không)
   và bậc khởi đầu của chế độ chất lượng Tự động. ?test luôn coi là máy tính mạnh để bảng draw call chuẩn giữ nguyên.
   ===================================================================== */
const q = new URLSearchParams(location.search);
const nav = navigator as Navigator & { deviceMemory?: number };
const coarse = typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches;
const small = Math.min(screen.width, screen.height) < 900;

export const device = {
  test: q.has('test'),
  phone: !q.has('test') && coarse && small,                                                     // màn cảm ứng nhỏ: điện thoại / máy tính bảng nhỏ
  weak: !q.has('test') && ((nav.deviceMemory ?? 8) <= 4 || (navigator.hardwareConcurrency ?? 8) <= 4)
};

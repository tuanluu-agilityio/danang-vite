/* ===== Mặt trời theo giờ thật (D-043, spec §4.3) =====
   Thuần hàm, không import three / DOM. Chỉ dùng epoch UTC (không Date#getHours, không phụ thuộc múi giờ máy khách).
   Công thức NOAA (bảng tính "NOAA Solar Calculations", theo Meeus, Astronomical Algorithms): xích vĩ + phương trình thời gian
   từ thế kỷ Julius; sai số độ cao / phương vị < 0,5° trong khoảng năm 1800–2100. Độ cao trả về là hình học (chưa cộng khúc xạ):
   mọc / lặn chuẩn là lúc độ cao hình học = −0,833° (bán kính đĩa + khúc xạ ở chân trời). Các hệ số dưới là hằng số thiên văn, không phải thông số chỉnh. */
import { CONFIG } from '../config';

const RAD = Math.PI / 180;
const clamp01 = (v: number) => v < 0 ? 0 : v > 1 ? 1 : v;
const smooth = (a: number, b: number, x: number) => { const t = clamp01((x - a) / (b - a)); return t * t * (3 - 2 * t); };

/** Độ cao (°, trên chân trời dương) và phương vị la bàn (°, 0 = Bắc, 90 = Đông, [0, 360)) của tâm mặt trời. */
export function sunPosition(epochMs: number, latDeg: number, lonDeg: number): { elev: number; azim: number } {
  const jd = epochMs / 86400000 + 2440587.5, T = (jd - 2451545) / 36525;   // ngày Julius, thế kỷ Julius từ J2000
  const L0 = (280.46646 + T * (36000.76983 + T * 0.0003032)) % 360;        // kinh độ trung bình (°)
  const M = 357.52911 + T * (35999.05029 - 0.0001537 * T);                 // dị thường trung bình (°)
  const e = 0.016708634 - T * (0.000042037 + 0.0000001267 * T);            // tâm sai quỹ đạo Trái Đất
  const C = Math.sin(M * RAD) * (1.914602 - T * (0.004817 + 0.000014 * T)) + Math.sin(2 * M * RAD) * (0.019993 - 0.000101 * T) + Math.sin(3 * M * RAD) * 0.000289;
  const om = 125.04 - 1934.136 * T;
  const lam = L0 + C - 0.00569 - 0.00478 * Math.sin(om * RAD);             // kinh độ biểu kiến (°)
  const eps0 = 23 + (26 + (21.448 - T * (46.815 + T * (0.00059 - T * 0.001813))) / 60) / 60;
  const eps = eps0 + 0.00256 * Math.cos(om * RAD);                         // độ nghiêng hoàng đạo đã hiệu chỉnh (°)
  const dec = Math.asin(Math.sin(eps * RAD) * Math.sin(lam * RAD));        // xích vĩ (rad)
  const y = Math.tan(eps * RAD / 2) ** 2, l2 = 2 * L0 * RAD, m1 = M * RAD;
  const eot = 4 / RAD * (y * Math.sin(l2) - 2 * e * Math.sin(m1) + 4 * e * y * Math.sin(m1) * Math.cos(l2) - 0.5 * y * y * Math.sin(2 * l2) - 1.25 * e * e * Math.sin(2 * m1));   // phút
  const dayMin = ((epochMs % 86400000) + 86400000) % 86400000 / 60000;   // phút UTC trong ngày
  const tst = (((dayMin + eot + 4 * lonDeg) % 1440) + 1440) % 1440;      // giờ mặt trời thật (phút)
  const H = (tst / 4 - 180) * RAD, phi = latDeg * RAD;                    // góc giờ (âm buổi sáng)
  const cosZ = Math.max(-1, Math.min(1, Math.sin(phi) * Math.sin(dec) + Math.cos(phi) * Math.cos(dec) * Math.cos(H)));
  const elev = 90 - Math.acos(cosZ) / RAD;
  // Phương vị đo từ Nam sang Tây (atan2), cộng 180° ⇒ la bàn từ Bắc thuận kim
  const az = Math.atan2(Math.sin(H), Math.cos(H) * Math.sin(phi) - Math.tan(dec) * Math.cos(phi)) / RAD + 180;
  return { elev, azim: ((az % 360) + 360) % 360 };
}

/** Đêm đích theo độ cao: 0 khi ≥ elevDay, 1 khi ≤ elevNight, smoothstep ở giữa (chạng vạng dân dụng). */
export function liveNight(elevDeg: number, cfg: { elevDay: number; elevNight: number }): number {
  return 1 - smooth(cfg.elevNight, cfg.elevDay, elevDeg);
}

/** Sắc ấm của nắng / sương theo độ cao: 1 khi full° ≥ độ cao ≥ 0°, giảm mượt về 0 ở none° (trưa); dưới 0° giảm mượt về 0 ở below° (đêm hẳn).
    Hai đầu đều liên tục: không có bước nhảy ở below° (màu sương ấm không bật / tắt thấy được lúc chạng vạng). */
export function sunWarm(elevDeg: number, cfg: { full: number; none: number; below: number } = CONFIG.live.warm): number {
  if (elevDeg <= cfg.below) return 0;
  return (1 - smooth(cfg.full, cfg.none, elevDeg)) * smooth(cfg.below, Math.min(0, cfg.full), elevDeg);
}

/** Hệ số cường độ nắng theo độ cao: lowK ở chân trời (≤ 0°), 1 khi ≥ fullElev°, smoothstep ở giữa. Luôn > 0 khi lowK > 0
    (bộ đèn D-031 chỉ chuyển sang 'night' khi applyNight đã đưa sun.intensity về 0 theo `night`, hệ số này không được làm việc đó). */
export function sunElevK(elevDeg: number, cfg: { sunLowK: number; sunFullElev: number } = CONFIG.live): number {
  return cfg.sunLowK + (1 - cfg.sunLowK) * smooth(0, cfg.sunFullElev, elevDeg);
}

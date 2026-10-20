import type { Vec3 } from './presets';
import { CONFIG } from '../config';
import { hrRoadY } from '../bridges/han-tunnel/profile';

/* ============================ Điểm dừng Tour tự động ============================
   Dữ liệu thuần (tọa độ thế giới, mét): chỉnh điểm dừng ở đây, không cần đụng tới code camera.
   Camera bay qua các điểm theo đường cong Catmull-Rom khép kín. Tên và lời giới thiệu từng điểm
   nằm trong bảng dịch (i18n/locales/*.json, khóa ở TOURS[...].key), đúng thứ tự các điểm dưới đây.
   swing: true — tới điểm này thì tự quay Cầu sông Hàn.
   Hầm sông Hàn: immerse — chạy mô phỏng dìm đốt hầm; cutaway — bật mặt cắt địa chất; interior — luôn hiện nội thất hầm. */
export interface TourStop { pos: Vec3; target: Vec3; swing?: boolean; immerse?: boolean; cutaway?: boolean; interior?: boolean }

/* Cầu Rồng */
export const DRAGON_TOUR: TourStop[] = [
  { pos: [-430, 330, 560], target: [0, 12, 0] },
  { pos: [-410, 22, -48], target: [-345, 11, 0] },
  { pos: [-228, 11.4, 11.5], target: [-60, 15, 2] },
  { pos: [-45, 22, -80], target: [0, 30, 0] },
  { pos: [60, 3.5, -145], target: [10, 16, 0] },
  { pos: [392, 26, 40], target: [328, 16, 0] },
  { pos: [260, 95, 1700], target: [-110, 70, 1300] },
  { pos: [-150, 70, -430], target: [20, 14, 0] }
];
/* Cầu Trần Thị Lý: toàn cảnh → tháp nghiêng → gối cầu → bờ Đông → mặt phẳng dây trước → dây xoắn → cầu Nguyễn Văn Trỗi,
   sắp sao cho đường bay không xuyên qua mặt cầu hay thân tháp */
export const TTL_TOUR: TourStop[] = [
  { pos: [330, 120, 1740], target: [-70, 55, 1300] },
  { pos: [-40, 26, 1640], target: [-145, 72, 1300] },
  { pos: [-104, 4.2, 1327], target: [-127, 2.5, 1300] },
  { pos: [232, 9, 1440], target: [-80, 50, 1300] },        // trên mặt nước sát bờ Đông, tránh hàng cây ven kè
  { pos: [70, 17.5, 1309], target: [-140, 60, 1300] },     // cao hơn nóc xe buýt
  { pos: [-176, 17.0, 1306], target: [-150, 95, 1301] },   // lệch tim cầu 6 m để đường bay không xuyên thân tháp
  { pos: [60, 18, 1180], target: [-40, 8, 1235] }
];
/* Cầu Thuận Phước: vịnh → dưới nhịp chính → tháp chữ H → yên ngựa đỉnh tháp → cầu dẫn Tây → hướng Sơn Trà → trên cao phía Nam.
   Đi hết các điểm phía Bắc rồi mới vượt qua cầu ở độ cao an toàn (trên cáp chủ / trên đỉnh tháp). */
export const TP_TOUR: TourStop[] = [
  { pos: [300, 78, -3370], target: [-40, 40, -2900] },
  { pos: [150, 3, -2924], target: [-160, 1.5, -2882] },
  { pos: [-140, 55, -2985], target: [-202.5, 55, -2900] },
  { pos: [-185, 100, -2930], target: [-202.5, 92, -2900] },
  { pos: [-420, 31, -2893], target: [-150, 50, -2900] },
  { pos: [520, 60, -2700], target: [0, 30, -2900] },
  { pos: [0, 140, -2500], target: [0, 40, -2900] }
];
/* Cầu sông Hàn: toàn cảnh → trên trụ quay (tự quay cầu 30×) → mâm xoay → bờ Bạch Đằng → mặt cầu → tàu buồm chờ luồng */
export const SH_TOUR: TourStop[] = [
  { pos: [250, 92, -1410], target: [-20, 14, -1080] },
  { pos: [-70, 210, -1010], target: [0, 8, -1080], swing: true },
  { pos: [30, 10.5, -1052], target: [0, 10, -1080] },
  { pos: [-262, 8, -995], target: [-40, 10, -1085] },       // nâng nhẹ để đường bay không chạm mặt nước
  { pos: [-130, 16.5, -1074.7], target: [0, 26, -1080] },
  { pos: [-80, 25, -1420], target: [-20, 12, -1200] }
];

/* Hầm vượt sông Hàn: toàn tuyến → cửa Tây (mái lam) → gờ chắn ngập → mặt cắt dọc → dìm đốt hầm → trong ống xe → hành lang thoát nạn → cửa Đông.
   Các điểm dưới đất bay trong lòng hầm; đường bay đi xuyên mặt đất/nước nên Tour này không kiểm tra va chạm mô hình. */
const HRZ = CONFIG.hanTunnel.z, HRC = HRZ + CONFIG.hanTunnel.cutZ, HRT = CONFIG.hanTunnel.tubeCenter;
export const HR_TOUR: TourStop[] = [
  { pos: [-560, 230, HRZ - 520], target: [0, -4, HRZ] },
  { pos: [-640, 14, HRZ + 32], target: [-560, 3.5, HRZ - 2] },
  { pos: [-742, 9, HRZ + 30], target: [-700, 3.4, HRZ] },
  { pos: [-95, 30, HRC - 110], target: [0, -10, HRC], cutaway: true },
  { pos: [-110, 70, HRZ - 95], target: [0, -4, HRZ], immerse: true },
  { pos: [-230, hrRoadY(-230) + 1.5, HRZ + HRT], target: [-60, hrRoadY(-60) + 1.8, HRZ + HRT], interior: true },
  { pos: [-130, hrRoadY(-130) + 1.6, HRZ], target: [60, hrRoadY(60) + 1.5, HRZ], interior: true },
  { pos: [800, 11, HRZ + 8], target: [585, 2.5, HRZ] }
];

/* Mỗi cầu một hành trình: view = tên nút góc nhìn, key = khóa danh sách điểm dừng trong bảng dịch */
export const TOUR_DEFS = {
  dragon: { view: 'tour', key: 'stops', stops: DRAGON_TOUR },
  ttl: { view: 'ttlTour', key: 'ttlStops', stops: TTL_TOUR },
  tp: { view: 'tpTour', key: 'tpStops', stops: TP_TOUR },
  sh: { view: 'shTour', key: 'shStops', stops: SH_TOUR },
  hr: { view: 'hrTour', key: 'hrStops', stops: HR_TOUR, minY: -30 }   // minY: đường bay được phép xuống dưới mặt nước (mặc định 3 m)
};

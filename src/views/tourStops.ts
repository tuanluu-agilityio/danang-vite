import type { BridgeKey, Vec3 } from './presets';
import { CONFIG } from '../config';
import { hrRoadY } from '../bridges/han-tunnel/profile';
import { swToWorld } from '../bridges/sun-wheel/profile';

/* ============================ Điểm dừng Tour tự động ============================
   Dữ liệu thuần (tọa độ thế giới, mét): chỉnh điểm dừng ở đây, không cần đụng tới code camera.
   Camera bay qua các điểm theo đường cong Catmull-Rom khép kín. Tên và lời giới thiệu từng điểm
   nằm trong bảng dịch (i18n/locales/*.json, khóa ở TOURS[...].key), đúng thứ tự các điểm dưới đây.
   swing: true — tới điểm này thì tự quay Cầu sông Hàn.
   Hầm sông Hàn: immerse — chạy mô phỏng dìm đốt hầm; cutaway — bật mặt cắt địa chất; interior — luôn hiện nội thất hầm.
   bridge — tới điểm này thì bảng Thông số / danh sách góc nhìn chuyển sang cầu đó (Tour 4 cầu). */
/* Vòng quay Mặt Trời: sw — 'ride' lên cabin và tua nhanh tới đỉnh, 'top' ngắm từ đỉnh, 'night' xuống cabin rồi bật đêm + show LED; minSec — điểm này hiện ít nhất chừng đó giây (kể cả khi tắt giọng) */
export interface TourStop { pos: Vec3; target: Vec3; swing?: boolean; immerse?: boolean; cutaway?: boolean; interior?: boolean; bridge?: BridgeKey; sw?: 'ride' | 'top' | 'night'; minSec?: number }
/* minY: đường bay được phép xuống dưới mặt nước (mặc định 3 m); loop: false — đường bay mở, đi một lần rồi trả điều khiển (mặc định khép kín, lặp);
   segMax: trần thời lượng một đoạn bay, s (mặc định 16) */
export interface TourDef { view: string; key: string; stops: TourStop[]; minY?: number; loop?: boolean; segMax?: number }

/* Cầu Rồng. Điểm "Trên mặt cầu" đặt ở làn phía Bắc (z < 0) như điểm "Đuôi rồng" trước nó: bản gốc đặt z = +11,5 nên đoạn bay
   cắt ngang dải phân cách ở x ≈ −282, y ≈ 9,9 — xuyên thân rồng (đỉnh thân ở đó ≈ 12,4 m), `test:tour` báo chạm mô hình */
export const DRAGON_TOUR: TourStop[] = [
  { pos: [-430, 330, 560], target: [0, 12, 0] },
  { pos: [-410, 22, -48], target: [-345, 11, 0] },
  { pos: [-228, 11.4, -11.5], target: [-60, 15, -2] },
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
  { pos: [-742, 15, HRZ + 30], target: [-700, 3.4, HRZ] },
  { pos: [-95, 30, HRC - 110], target: [0, -10, HRC], cutaway: true },
  { pos: [-110, 70, HRZ - 95], target: [0, -4, HRZ], immerse: true },
  { pos: [-230, hrRoadY(-230) + 1.5, HRZ + HRT], target: [-60, hrRoadY(-60) + 1.8, HRZ + HRT], interior: true },
  { pos: [-130, hrRoadY(-130) + 1.6, HRZ], target: [60, hrRoadY(60) + 1.5, HRZ], interior: true },
  { pos: [800, 11, HRZ + 8], target: [585, 2.5, HRZ] }
];

/* Kịch bản bão (environment/weather/scenario.ts): mỗi điểm thường ứng với một mốc CONFIG.weather.scenario.steps, đúng thứ tự; via: true = điểm
   trung gian chỉ để đường bay tránh mô hình (không có mốc). Cửa sông → sông Hàn (thuyền về bến) → đầu rồng → dây văng Trần Thị Lý (phía Bắc cầu)
   → Cầu sông Hàn → vịnh Thuận Phước → trên cao nhìn về thành phố → phố bờ Tây Cầu Rồng (cây đổ). Không đặt điểm trên hành lang hầm |z + 1700| < 30 */
const TPZ = CONFIG.thuanPhuoc.z, SHZ = CONFIG.songHan.z;
export const STORM_TOUR: (TourStop & { via?: boolean })[] = [
  { pos: [260, 36, TPZ - 330], target: [0, 30, TPZ] },            // wxS1 — cửa sông (như wxRiverMouth)
  { pos: [160, 30, SHZ - 260], target: [-60, 4, SHZ + 80] },      // wxS2 — trên sông, thuyền về bến quanh Cầu sông Hàn
  { pos: [200, 28, -170], target: [325, 18, 0] },                 // wxS3 — đầu rồng nhìn từ mặt sông phía Bắc
  { pos: [160, 70, 20], target: [60, 20, 700], via: true },       // vượt Cầu Rồng trên cao
  { pos: [-25, 48, 1222], target: [-55, 70, 1300] },              // wxS4 — dây văng Trần Thị Lý, phía Bắc cầu, sát giữa chùm dây dài (chỗ dao động lớn nhất, ~80 m) để thấy rõ dây rung
  { pos: [250, 92, SHZ - 330], target: [-20, 14, SHZ] },          // wxS5 — Cầu sông Hàn (như shOverview)
  { pos: [320, 150, TPZ], target: [0, 40, TPZ - 400], via: true },   // vượt Thuận Phước trên đỉnh tháp
  { pos: [300, 78, TPZ - 470], target: [-40, 40, TPZ] },          // wxS6 — vịnh Thuận Phước (như tpBay)
  { pos: [-600, 420, -3700], target: [60, 0, -1450] },            // wxS7 — trên vịnh nhìn về thành phố (gần tpBoth)
  { pos: [-200, 24, 220], target: [-300, 4, 60] }                 // wxS8 — phố bờ Tây Cầu Rồng (cây đổ quanh target)
];

/* Tour 4 cầu (D-015): Trần Thị Lý → Cầu Rồng → Cầu sông Hàn → Thuận Phước, đường bay mở, xuôi dòng Nam → Bắc.
   Vượt Trần Thị Lý ở x ≈ 140 (phía Đông neo dây trước xa nhất x = 96, y ≈ 57); vượt Cầu Rồng phía Đông đầu rồng (x ≈ 375);
   vượt Cầu sông Hàn trên cao (~190 m); vượt Thuận Phước trên đỉnh tháp Tây như TP_TOUR. Điểm 10 nhìn dọc tuyến hầm (phương án đề xuất) ở trên cao, không đặt gì lên hành lang */
export const ALL_TOUR: TourStop[] = [
  { pos: [330, 120, 1740], target: [-70, 55, 1300], bridge: 'ttl' },     // toàn cảnh Trần Thị Lý, mở đầu hành trình
  { pos: [-40, 26, 1640], target: [-145, 72, 1300] },                   // tháp nghiêng
  { pos: [220, 75, 1150], target: [-120, 70, 1300] },                   // nhìn lại từ phía Bắc, cầu Nguyễn Văn Trỗi cũ
  { pos: [100, 80, 650], target: [0, 20, 0] },                          // xuôi dòng về Cầu Rồng
  { pos: [220, 70, 300], target: [0, 20, 0], bridge: 'dragon' },        // Cầu Rồng từ phía Nam
  { pos: [392, 26, 40], target: [328, 16, 0] },                         // đầu rồng (như góc nhìn head)
  { pos: [250, 80, -300], target: [-20, 20, 0] },                       // nhìn lại Cầu Rồng, tiếp tục về phía Bắc
  { pos: [-70, 210, -1010], target: [0, 8, -1080], bridge: 'sh', swing: true },   // trên trụ quay: tự quay cầu 30×
  { pos: [250, 92, -1410], target: [-20, 14, -1080] },                  // nhịp quay mở luồng, từ phía Bắc
  { pos: [150, 110, HRZ + 60], target: [-400, 0, HRZ] },                // nhìn dọc tuyến hầm về cửa Tây (phương án đề xuất)
  { pos: [0, 140, -2500], target: [0, 40, -2900], bridge: 'tp' },       // Thuận Phước trên cao phía Nam
  { pos: [-185, 100, -2930], target: [-202.5, 92, -2900] },             // yên ngựa đỉnh tháp Tây
  { pos: [300, 78, -3370], target: [-40, 40, -2900] }                   // từ vịnh: cửa sông, kết thúc
];

/* Vòng quay Mặt Trời (tọa độ cục bộ qua swToWorld, ước lượng): toàn cảnh từ sông → chân vòng quay và nhà ga → chính diện (lịch sử) → lên cabin → đỉnh nhìn 4 cầu → ban đêm.
   Điểm 4–5: đường bay đứng trên không phía Nam vòng quay (z ≥ 60 m, ngoài giàn tháp), chỉ để vào/ra cabin; trong cabin camera do ride.ts đặt. Điểm 6 chếch từ Tây Nam như swNight */
const sw = (p: Vec3, t: Vec3): Pick<TourStop, 'pos' | 'target'> => ({ pos: swToWorld(...p).toArray() as Vec3, target: swToWorld(...t).toArray() as Vec3 });
export const SW_TOUR: TourStop[] = [
  { ...sw([520, 70, 380], [0, 55, 0]), bridge: 'sw' },
  sw([-20, 5, 75], [0, 40, 0]),
  sw([0, 8, 230], [0, 55, 0]),
  { ...sw([40, 118, 90], [0, 70, 0]), sw: 'ride', minSec: CONFIG.sunWheel.tour.climbSec },
  { ...sw([20, 120, 60], [0, 70, 0]), sw: 'top', minSec: CONFIG.sunWheel.tour.topSec },
  { ...sw([-120, 25, 200], [0, 60, 0]), sw: 'night' }
];

/* Mỗi cầu một hành trình: view = tên nút góc nhìn, key = khóa danh sách điểm dừng trong bảng dịch */
export const TOUR_DEFS = {
  dragon: { view: 'tour', key: 'stops', stops: DRAGON_TOUR },
  ttl: { view: 'ttlTour', key: 'ttlStops', stops: TTL_TOUR },
  tp: { view: 'tpTour', key: 'tpStops', stops: TP_TOUR },
  sh: { view: 'shTour', key: 'shStops', stops: SH_TOUR },
  hr: { view: 'hrTour', key: 'hrStops', stops: HR_TOUR, minY: -30 },  // minY: đường bay được phép xuống dưới mặt nước (mặc định 3 m)
  all: { view: 'allTour', key: 'allStops', stops: ALL_TOUR, loop: false, segMax: CONFIG.tourAll.segMax },   // Tour 4 cầu: một chiều
  sw: { view: 'swTour', key: 'swStops', stops: SW_TOUR, loop: false, segMax: CONFIG.tourAll.segMax }   // Vòng quay Mặt Trời: một chiều (D-017)
} satisfies Record<string, TourDef>;

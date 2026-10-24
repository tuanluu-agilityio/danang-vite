import { CONFIG } from '../config';
import { shRoadY } from '../bridges/song-han/profile';
import { hrRoadY } from '../bridges/han-tunnel/profile';
import { swToWorld } from '../bridges/sun-wheel/profile';

/* ============================ Góc nhìn có sẵn ============================
   Dữ liệu thuần (tọa độ thế giới, mét). pos: vị trí camera, target: điểm nhìn,
   maxPolar: cho phép camera thấp hơn điểm nhìn để ngước lên (mặc định π·0,495). */
export type Vec3 = [number, number, number];
export interface ViewPreset { pos: Vec3; target: Vec3; maxPolar?: number }

const TPZ = CONFIG.thuanPhuoc.z, SHZ = CONFIG.songHan.z, HRZ = CONFIG.hanTunnel.z, HRC = HRZ + CONFIG.hanTunnel.cutZ, TTLZ = CONFIG.tranThiLy.z;
/* Góc nhìn đặt theo hệ cục bộ của Vòng quay Mặt Trời (X dọc mặt vòng quay, Z về mặt Nam) */
const sw = (p: Vec3, t: Vec3, maxPolar?: number): ViewPreset => ({ pos: swToWorld(...p).toArray() as Vec3, target: swToWorld(...t).toArray() as Vec3, ...(maxPolar ? { maxPolar } : {}) });

export const VIEWS: Record<string, ViewPreset> = {
  overview: { pos: [-430, 330, 560], target: [0, 12, 0] },
  head: { pos: [392, 26, 40], target: [328, 16, 0] },
  tail: { pos: [-412, 20, -44], target: [-345, 11, 0] },
  bird: { pos: [-150, 70, -430], target: [20, 14, 0] },
  // Cầu Thuận Phước
  tpBay: { pos: [300, 78, TPZ - 470], target: [-40, 40, TPZ] },
  // OrbitControls không cho camera thấp hơn điểm nhìn → điểm nhìn đặt sát mặt nước, mặt cầu vẫn lọt khung trên
  tpWater: { pos: [-150, 3.0, TPZ + 24], target: [160, 1.5, TPZ - 18] },
  tpBoth: { pos: [-760, 540, -3800], target: [60, 0, -1450] },   // từ trên vịnh nhìn về Nam: Thuận Phước gần, Cầu Rồng xa
  // Cầu Trần Thị Lý
  ttlOverview: { pos: [330, 120, 1740], target: [-70, 55, 1300] },
  ttlBase: { pos: [-176, 15.2, 1300.5], target: [-150, 95, 1301], maxPolar: Math.PI * 0.97 },
  ttlDeck: { pos: [70, 14.6, 1300 + 9], target: [-140, 60, 1300] },
  ttlBoth: { pos: [540, 300, -380], target: [-60, 20, 820] },
  // Cầu sông Hàn
  shOverview: { pos: [250, 92, SHZ - 330], target: [-20, 14, SHZ] },
  shTop: { pos: [-70, 210, SHZ + 70], target: [0, 8, SHZ] },
  shBank: { pos: [-266, 4.6, SHZ - 85], target: [-40, 9, SHZ + 5], maxPolar: Math.PI * 0.97 },
  shDeck: { pos: [-130, shRoadY(-130) + 1.9, SHZ + 5.3], target: [0, 26, SHZ], maxPolar: Math.PI * 0.97 },   // đứng trên lề bộ hành
  shSwingCam: { pos: [150, 125, SHZ + 170], target: [0, 8, SHZ] },
  // Hai bờ sông Hàn: trái tim hai tòa nhìn từ giữa sông (ban đêm); dạo dải ven sông Bạch Đằng nhìn về Novotel
  rfHearts: { pos: [0, 45, -640], target: [0, 80, -1150] },
  rfBank: { pos: [-268, 4.3, -935], target: [-352, 50, -1150], maxPolar: Math.PI * 0.97 },
  // Thời tiết (vị trí ước lượng, chỉnh khi xem ảnh): từ cửa sông nhìn vào Thuận Phước; đứng trên lề Trần Thị Lý nhìn dọc dây văng; ngang tầm xe trên Bạch Đằng, Cầu Rồng phía sau
  wxRiverMouth: { pos: [260, 36, TPZ - 330], target: [0, 30, TPZ] },
  wxTtlStays: { pos: [70, 14.6, 1300 + 9], target: [-140, 60, 1300], maxPolar: Math.PI * 0.97 },
  wxStreet: { pos: [-299, 1.8, 120], target: [-200, 8, 0], maxPolar: Math.PI * 0.97 },
  // Vòng quay Mặt Trời (tọa độ cục bộ của công trình → thế giới bằng swToWorld; tất cả là ước lượng, chỉnh khi xem ảnh)
  swOverview: sw([180, 80, 260], [0, 55, 0]),                          // toàn cảnh chếch từ phía bờ sông (Đông, Nam)
  swFront: sw([0, 8, 230], [0, 55, 0]),                                // chính diện mặt Nam, thấp
  swBase: sw([-20, 4.3, 70], [0, 40, 0], Math.PI * 0.97),              // đứng trên quảng trường nhìn lên
  swFromTTL: { pos: [-215, 20, TTLZ + 10], target: swToWorld(0, 60, 0).toArray() as Vec3 },   // từ Cầu Trần Thị Lý nhìn xuống phía Nam (~1 km)
  swNight: sw([-120, 25, 200], [0, 60, 0]),                            // chếch từ phía Tây Nam, dùng ban đêm
  swTop: sw([0, 190, 120], [0, 60, 0]),                                // trên cao nhìn xuống
  // Hầm vượt sông Hàn
  hrOverview: { pos: [-560, 230, HRZ - 520], target: [0, -4, HRZ] },
  hrCutaway: { pos: [-95, 30, HRC - 110], target: [0, -10, HRC], maxPolar: Math.PI * 0.97 },
  hrPortalW: { pos: [-640, 14, HRZ + 32], target: [-560, 3.5, HRZ - 2] },
  hrPortalE: { pos: [800, 11, HRZ + 8], target: [585, 2.5, HRZ] },
  hrGallery: { pos: [-130, hrRoadY(-130) + 1.6, HRZ], target: [60, hrRoadY(60) + 1.5, HRZ], maxPolar: Math.PI * 0.97 },
  hrSimCam: { pos: [-110, 70, HRZ - 95], target: [0, -4, HRZ] }
};
/* Góc nhìn mặc định khi chọn từng cầu */
export const BRIDGE_HOME = { dragon: 'overview', tp: 'tpBay', ttl: 'ttlOverview', sh: 'shOverview', hr: 'hrOverview', sw: 'swOverview' } as const;
export type BridgeKey = keyof typeof BRIDGE_HOME;

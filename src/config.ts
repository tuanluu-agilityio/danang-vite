import * as THREE from 'three';

/* =====================================================================
   CONFIG — toàn bộ thông số (1 đơn vị = 1 mét)
   Trục X: dọc cầu, Tây (trung tâm, đuôi rồng) → Đông (biển, đầu rồng)
   Trục Z: dọc sông Hàn, -Z là hướng Bắc (cửa sông, bán đảo Sơn Trà)
   Mỗi cầu một khối riêng bên dưới; thêm cầu mới = thêm một khối + một thư mục trong src/bridges/.
   ===================================================================== */
const sum = (a: number[]) => a.reduce((p, q) => p + q, 0);

/* ------------------------- Chung + Cầu Rồng ------------------------- */
const base = {
  length: 666,                       // tổng chiều dài
  mainSpans: [70, 85, 200, 85, 70],  // 5 nhịp chính — nhịp phụ là ƯỚC LƯỢNG, nhịp giữa 200 m
  approachPiers: [-294],             // trụ nhịp dẫn (3 nhịp dẫn: 2 bờ Tây, 1 bờ Đông) — ước lượng
  spanRise: { 70: 13, 85: 19, 200: 37 } as Record<number, number>, // độ vồng thân rồng trên mặt cầu — ước lượng
  width: 37.5, laneWidth: 3.75, lanesPerDir: 3, median: 6, sidewalk: 2.5, shoulder: 2.0,
  deckMidY: 10.0,                    // cao độ mặt cầu giữa sông — ước lượng
  roadY: 2.6,                        // cao độ đường trên bờ
  landY: 2.5,
  bankX: 262,                        // mép kè hai bờ (sông rộng ~524 m tại cầu) — ước lượng
  bodyRadius: 2.2, headRadius: 3.4,  // bán kính thân rồng — ước lượng
  scaleStep: 1.5, scalesPerRing: 9,
  hangerStep: 5,
  ttl: { z: 1300 },                 // vị trí Cầu Trần Thị Lý; thông số chi tiết ở CONFIG.tranThiLy
  shadowMapSize: 2048,
  fireCount: 420, waterCount: 520,
  showCycle: 48                      // giây — 9 lần phun lửa rồi phun nước
};

/* ---------------------------- Cầu Thuận Phước ----------------------------
   Cầu treo dây võng 3 nhịp ở cửa sông Hàn, phía Bắc (−Z) Cầu Rồng ~2,9 km. */
const thuanPhuocBase = {
  z: -2900,                 // m — vị trí Bắc–Nam (−Z là Bắc), cách Cầu Rồng ~2,9 km
  totalLength: 1856,        // m — tổng chiều dài (tham khảo; hình học tính từ các nhịp bên dưới)
  mainSpan: 405,            // m — nhịp chính
  sideSpan: 125,            // m — mỗi nhịp biên
  approachSpans: 12,        // số nhịp cầu dẫn mỗi bên
  approachSpanLen: 50,      // m — mỗi nhịp dẫn (dầm hộp BTCT dự ứng lực)
  embankment: 120,          // m — đoạn đường đắp sau mố, hạ về mặt đất (ước lượng)
  abutmentRise: 4.8,        // m — mặt đường tại mố cao hơn mặt đất (ước lượng)
  deckWidth: 18,            // m — bề rộng mặt cầu
  laneWidth: 3.5,           // m — mỗi làn, 2 làn mỗi chiều
  median: 1.0,              // m — dải phân cách giữa (ước lượng)
  sidewalk: 1.5,            // m — lề + lan can mỗi bên (ước lượng)
  girderDepth: 2.9,         // m — chiều cao dầm hộp thép khí động (ước lượng)
  girderTip: 10.5,          // m — nửa bề rộng tới mũi dầm (ước lượng); hanger neo tại đây
  girderSegments: 69,       // đốt dầm thép hàn nối
  approachDepth: 2.8,       // m — chiều cao dầm hộp BTCT cầu dẫn (ước lượng)
  roadCenterY: 31.6,        // m — mặt đường giữa nhịp: 27 m tĩnh không + 2,9 m dầm + vồng (ước lượng)
  roadAnchorY: 28.6,        // m — mặt đường tại khối neo (ước lượng)
  pileCapTop: 2.5,          // m — đỉnh bệ cọc trên mặt nước (ước lượng)
  plinthTop: 11.5,          // m — đỉnh bệ trụ; tháp cao 80 m tính từ đây → đỉnh ~91,5 m trên mặt nước
  towerHeight: 80,          // m — chiều cao tháp từ bệ
  legBase: [5.2, 3.6] as [number, number],      // m — tiết diện cột tại chân (dọc cầu × ngang cầu), ước lượng
  legTop: [3.8, 2.6] as [number, number],       // m — tiết diện cột tại đỉnh, ước lượng
  legZBase: 13.2,           // m — tâm cột theo phương ngang tại chân (ước lượng)
  legZTop: 10.8,            // m — tâm cột tại đỉnh = mặt phẳng cáp chủ
  chamfer: 0.45,            // m — vát cạnh cột
  topBeam: [84, 89.5] as [number, number],      // m — cao độ đáy/đỉnh dầm ngang trên (ước lượng)
  lowBeam: [22, 26.2] as [number, number],      // m — dầm ngang dưới, đỡ dầm cầu (ước lượng)
  cablePlaneZ: 10.8,        // m — mặt phẳng cáp chủ (mỗi bên)
  cableRadius: 0.18,        // m — cáp chủ Ø360 mm
  sagRatio: 1 / 9.5,        // độ võng nhịp chính f/L (ước lượng, trong khoảng 1/9 – 1/10)
  saddleY: 92.2,            // m — tim cáp tại yên ngựa đỉnh tháp (ước lượng)
  anchorCableY: 33,         // m — điểm cáp đi vào buồng neo (ước lượng)
  hangersMain: 39,          // hanger mỗi mặt phẳng ở nhịp chính
  hangersSide: 9,           // hanger mỗi mặt phẳng ở mỗi nhịp biên → (39 + 2×9) × 2 = 114
  hangerR: 0.0325,          // m — hanger thường Ø65 mm
  hangerRSpecial: 0.0505,   // m — hanger đặc biệt Ø101 mm (gần tháp, giữa nhịp, đầu nhịp biên)
  bandRadius: 0.32,         // m — kẹp cáp (ước lượng)
  lampSpacing: 30,          // m — cột đèn trên cầu (ước lượng)
  lodDistance: 1700         // m — xa hơn thì ẩn chi tiết nhỏ (lan can, cột đèn, kẹp cáp, xe)
};
function deriveTp(C: typeof thuanPhuocBase) {
  const towerX = C.mainSpan / 2;                                   // 202,5 m — tim tháp
  const anchorX = towerX + C.sideSpan;                             // 327,5 m — đầu phần cầu treo
  const endX = anchorX + C.approachSpans * C.approachSpanLen;      // 927,5 m — mố cầu dẫn
  const cableAnchorX = anchorX + 8.5;                              // m — cáp vào buồng neo (ước lượng)
  const sag = C.mainSpan * C.sagRatio;                             // ≈ 42,6 m
  const sideSag = sag * ((cableAnchorX - towerX) / C.mainSpan) ** 2; // cùng lực ngang → f tỉ lệ L²
  const towerTop = C.plinthTop + C.towerHeight;                    // 91,5 m
  return { ...C, towerX, anchorX, endX, cableAnchorX, sag, sideSag, towerTop };
}

/* ---------------------------- Cầu Trần Thị Lý ----------------------------
   Cầu dây văng BTCT một tháp nghiêng, hệ dây 3 mặt phẳng ("cánh buồm căng gió"),
   phía Nam (thượng lưu, +Z) Cầu Rồng ~1,3 km. */
const tranThiLyBase = {
  z: base.ttl.z,              // m — 1300, phía Nam Cầu Rồng
  totalLength: 731,           // m — 12 nhịp
  pylonX: -130,               // m — tim chân tháp; tháp gần bờ Tây, nhịp chính vượt sông về phía Đông (ước lượng)
  mainSpan: 230,              // m — nhịp dây văng chính, phía Đông tháp
  backSpans: [40, 40, 40],    // m — nhịp sau tháp, nơi neo dây xoắn (ước lượng)
  westSpans: [49, 38.5, 38.5],// m — nhịp dẫn bờ Tây; trụ giữa đặt trên dải phân cách đường Bạch Đằng (ước lượng)
  eastSpans: [51, 51, 51, 46, 56], // m — nhịp dẫn bờ Đông; một trụ trên dải phân cách Trần Hưng Đạo (ước lượng)
  deckWidth: 34.5,            // m — bề rộng mặt cầu
  median: 5.5,                // m — dải phân cách giữa, mang tháp và neo dây nhịp chính
  laneWidth: 3.75,            // m
  lanesPerDir: 3,             // 6 làn xe
  sidewalk: 3.25,             // m — lề bộ hành mỗi bên gồm lan can: (34,5 − 5,5 − 6×3,75) / 2
  girderDepth: 2.6,           // m — dầm hộp BTCT (ước lượng)
  // m — cao độ mặt đường (ước lượng): đổ xuống nút giao phía Tây, vồng nhẹ giữa sông, hạ về bờ Đông
  roadProfile: [[-530, 2.6], [-470, 2.6], [-376, 6.4], [-250, 10.8], [-130, 12.6], [-15, 13.2], [100, 12.2], [253, 8.6], [355, 5.8], [450, 2.6], [510, 2.6]] as [number, number][],
  pylonHeight: 145,           // m — chiều cao thẳng đứng tính từ chân tháp
  pylonAboveDeck: 134,        // m — phần nhô trên mặt cầu (chân tháp thấp hơn mặt cầu ~11 m)
  leanDeg: 12,                // độ — nghiêng về phía Tây, ra xa nhịp chính
  pylonBaseY: 1.5,            // m — cao độ chân tháp, đặt trên 2 gối cầu (ước lượng)
  pylonLen: [12, 3.0] as [number, number],        // m — kích thước dọc cầu tại chân / đỉnh (ước lượng, dáng cánh buồm)
  pylonWid: [5.0, 2.8] as [number, number],       // m — kích thước ngang cầu tại chân / đỉnh, lọt dải phân cách 5,5 m (ước lượng)
  pylonRings: 64,             // số vòng tiết diện dựng tháp
  bearingR: 1.7,              // m — bán kính gối cầu (ước lượng)
  staysFront: 18,             // dây mặt trước (ước lượng trong khoảng 15–25)
  staysBack: 18,              // dây mỗi mặt sau
  anchorT: [0.5, 0.96] as [number, number],       // đoạn thân tháp có neo dây, tính theo tỉ lệ chiều dài trục tháp (ước lượng)
  frontDeck: [24, 226] as [number, number],       // m — từ tim tháp tới neo dầm của dây trước: gần → xa
  backDeck: [14, 116] as [number, number],        // m — dây sau: neo dầm gần tháp nhất (dây cao nhất) → xa nhất (dây thấp nhất)
  backDeckZ: 17.7,            // m — neo dây sau ở mép ngoài dầm
  stayR: 0.1,                 // m — dây văng gồm vỏ bọc (ước lượng)
  hdpeR: 0.17,                // m — ống bảo vệ HDPE gần neo dầm (ước lượng)
  hdpeLen: 4.0,               // m
  lampSpacing: 30,            // m
  nvtZ: -65,                  // m — cầu Nguyễn Văn Trỗi cũ, sát phía Bắc (cục bộ)
  nvtDeckY: 7.0,              // m — mặt cầu đi bộ (ước lượng)
  nvtWidth: 9,                // m (ước lượng)
  nvtTruss: 6,                // m — chiều cao dàn thép (ước lượng)
  nvtSpans: 8,                // nhịp dàn thép qua sông (ước lượng)
  lodDistance: 1500           // m
};
function deriveTtl(C: typeof tranThiLyBase) {
  const westEnd = C.pylonX - sum(C.backSpans) - sum(C.westSpans);  // −376 m — mố Tây
  const mainEnd = C.pylonX + C.mainSpan;                           // 100 m — cuối nhịp dây văng
  const eastEnd = mainEnd + sum(C.eastSpans);                      // 355 m — mố Đông
  const spanCount = C.backSpans.length + C.westSpans.length + 1 + C.eastSpans.length; // 12
  const piers: number[] = []; let x = C.pylonX;
  for (const s of [...C.backSpans, ...C.westSpans]) { x -= s; piers.push(x); }
  piers.pop();                                                     // điểm cuối là mố
  x = mainEnd; piers.push(x);
  for (const s of C.eastSpans) { x += s; piers.push(x); }
  piers.pop();
  const lean = THREE.MathUtils.degToRad(C.leanDeg);
  const axisLen = C.pylonHeight / Math.cos(lean);                  // ≈ 148,2 m dọc trục tháp
  const hw = C.deckWidth / 2;
  const laneOffsets = Array.from({ length: C.lanesPerDir }, (_, i) => C.median / 2 + C.laneWidth * (i + 0.5)); // 4,625 / 8,375 / 12,125
  return { ...C, westEnd, mainEnd, eastEnd, spanCount, piers, lean, axisLen, hw, laneOffsets };
}

/* ---------------------------- Cầu sông Hàn ----------------------------
   Cầu quay dây văng (khánh thành 29/3/2000), giữa Cầu Rồng (Nam) và Cầu Thuận Phước (Bắc). */
const songHanBase = {
  z: -1080,                   // m — dải đường trống trong khu phố, cách Cầu Rồng ~1,1 km về phía Bắc
  totalLength: 487.7,         // m
  deckWidth: 12.9,            // m
  swingSpan: 122.7,           // m — nhịp quay, dây văng đối xứng
  gap: 1.0,                   // m — khe hở mỗi đầu cánh với nhịp cố định (11×33 + 122,7 + 2×1,0 = 487,7)
  fixedSpan: 33,              // m — nhịp BTCT dự ứng lực
  westSpans: 6,               // nhịp cố định phía Tây (ước lượng theo ảnh)
  eastSpans: 5,               // nhịp cố định phía Đông (ước lượng)
  laneWidth: 3.35,            // m — 1 làn mỗi chiều (ước lượng)
  median: 2.2,                // m — dải giữa mang tháp và neo dây (ước lượng)
  sidewalk: 2.0,              // m — lề bộ hành gồm lan can (ước lượng): 2×3,35 + 2,2 + 2×2,0 = 12,9
  deckY: 13.8,                // m — mặt đường nhịp quay; đáy dầm ~11,5 m → tĩnh không ~11 m theo ảnh (ước lượng)
  swingDepth: 2.3,            // m — dầm thép nhịp quay (ước lượng)
  fixedDepth: 1.9,            // m — dầm BTCT nhịp cố định (ước lượng)
  roadProfile: [[-340, 2.6], [-290, 2.6], [-260.35, 4.4], [-200, 8.4], [-130, 12.4], [-80, 13.75], [-62.35, 13.8], [-30, 13.8],
    [30, 13.8], [62.35, 13.8], [80, 13.75], [130, 12.2], [190, 8.0], [227.35, 5.0], [262, 3.4], [290, 2.6], [340, 2.6]] as [number, number][], // m (ước lượng)
  // trụ quay (rim-bearing turntable), ước lượng theo ảnh
  drumR: 10,                  // m — bán kính trống trụ
  drumTop: 9.4,               // m — mặt trên phần cố định
  railR: 7.5,                 // m — bán kính vành ray
  rollers: 40,                // số con lăn quanh vành
  rimTop: 10.8,               // m — vành quay (thuộc phần quay)
  // tháp thép xanh chữ A dọc cầu + cột đôi ở tim (ước lượng theo ảnh)
  mastHeight: 38,             // m trên mặt cầu
  aFoot: 15,                  // m — chân chữ A cách tâm theo phương dọc cầu
  aApex: 19,                  // m — đỉnh chữ A trên mặt cầu
  stays: 9,                   // dây mỗi phía, một mặt phẳng ở tim cầu
  stayTop: [25, 36.5] as [number, number],        // m trên mặt cầu — đoạn neo dây trên cột
  stayDeck: [20, 59.2] as [number, number],       // m từ tâm — đoạn neo dây trên dầm
  stayR: 0.07,                // m (ước lượng)
  lift: 0.05,                 // m — nâng nhịp quay khỏi gối đầu cánh khi mở khóa
  rotateDir: 1,               // +1: ngược chiều kim đồng hồ nhìn từ trên xuống; −1: cùng chiều
  timing: {                   // giây thời gian thật (chia cho hệ số tăng tốc)
    amber: 4, barrier: 8, stopMax: 60, unlock: 20, rotate: 150, openHold: 1800, lock: 20
  },
  barrierX: 68.35,            // m — barie hai đầu nhịp quay
  autoSchedule: { days: [6, 0], hour: 23, utcOffset: 7 }, // 23:00 thứ Bảy, Chủ nhật giờ Việt Nam
  lodDistance: 1200,          // m — xa hơn: ẩn chi tiết nhỏ (barie, đèn tín hiệu, cơ cấu mâm xoay, fender…)
  farDistance: 1500           // m — xa hơn nữa: ẩn mặt đường, dải LED, lề
};
function deriveSh(C: typeof songHanBase) {
  const swingHalf = C.swingSpan / 2;                                   // 61,35 m
  const fixedStart = swingHalf + C.gap;                                // 62,35 m
  const westEnd = -(fixedStart + C.westSpans * C.fixedSpan);           // −260,35 m
  const eastEnd = fixedStart + C.eastSpans * C.fixedSpan;              // 227,35 m
  const hw = C.deckWidth / 2;
  const lane = C.median / 2 + C.laneWidth / 2;                         // 2,775 m
  const piers: number[] = [];
  for (let k = 1; k < C.westSpans; k++) piers.push(-(fixedStart + k * C.fixedSpan));
  for (let k = 1; k < C.eastSpans; k++) piers.push(fixedStart + k * C.fixedSpan);
  const restX = fixedStart + 0.05;                                     // tâm trụ đón (ước lượng)
  return { ...C, swingHalf, fixedStart, westEnd, eastEnd, hw, lane, piers, restX };
}

export const CONFIG = {
  ...base,
  mainTotal: sum(base.mainSpans),
  thuanPhuoc: deriveTp(thuanPhuocBase),
  tranThiLy: deriveTtl(tranThiLyBase),
  songHan: deriveSh(songHanBase)
};
export type SongHanConfig = typeof CONFIG.songHan;

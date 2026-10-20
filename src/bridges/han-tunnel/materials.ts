import * as THREE from 'three';
import { scene } from '../../core/renderer';
import { canvasTex } from '../../core/textures';
import { lerp } from '../../common/math';
import { HR } from './profile';

/* [materials] Vật liệu hầm. Trong hầm không có nắng: vật liệu nội thất giảm phản xạ môi trường (scene.environment = RoomEnvironment
   sáng giả tạo) và bù bằng một chút tự phát sáng; độ sáng đèn vùng ngưỡng giảm khi trời tối (xem hrUpdateLamps). */

/* Mặt đường: chu kỳ 12 m theo chiều dài, 12,5 m theo chiều ngang (mép trên canvas là phía dải phân cách).
   Vạch trắng liền ở lề, vạch đứt giữa hai làn ô tô, vạch liền tách làn xe máy; làn xe máy (sát lề phải) sơn đất nung. */
export function makeTunnelRoadTexture() {
  const t = canvasTex(256, 256, (g, w, h) => {
    const m = h / (HR.shoulder * 2 + HR.laneWidth * HR.lanesPerDir);                  // px / m
    g.fillStyle = '#3d4043'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 2600; i++) { const v = 55 + Math.random() * 30; g.fillStyle = `rgba(${v},${v},${v + 4},0.4)`; g.fillRect(Math.random() * w, Math.random() * h, 2, 2); }
    const y1 = HR.shoulder * m, y2 = y1 + HR.laneWidth * m, y3 = y2 + HR.laneWidth * m, y4 = y3 + HR.laneWidth * m;
    g.fillStyle = '#7d4a3c'; g.fillRect(0, y3, w, y4 - y3);                             // làn xe máy
    g.fillStyle = 'rgba(0,0,0,0.12)'; g.fillRect(0, y3, w, y4 - y3);
    g.fillStyle = '#f2f2ee';
    g.fillRect(0, y1 - 3, w, 6); g.fillRect(0, y4 - 3, w, 6);                           // vạch lề
    g.fillRect(0, y3 - 3, w, 6);                                                        // vạch liền tách làn xe máy
    for (let x = 0; x < w; x += w / 2) g.fillRect(x, y2 - 3, w / 4, 6);                 // vạch đứt 3 m, cách 3 m
    g.fillStyle = '#e8b52c';
    for (let x = 0; x < w; x += w / 8) g.fillRect(x, y3 - 1, 3, 2);                     // đinh phản quang
  });
  t.wrapS = THREE.RepeatWrapping; t.wrapT = THREE.ClampToEdgeWrapping;
  return t;
}
function rockTexture() {
  const t = canvasTex(128, 128, (g, w, h) => {
    g.fillStyle = '#74716a'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 380; i++) { const v = 85 + Math.random() * 70, r = 3 + Math.random() * 7; g.fillStyle = `rgb(${v},${v - 3},${v - 10})`; g.beginPath(); g.ellipse(Math.random() * w, Math.random() * h, r, r * 0.7, Math.random() * 3, 0, 7); g.fill(); }
  });
  t.wrapS = t.wrapT = THREE.RepeatWrapping; return t;
}
/* Môi trường rất yếu cho nội thất: envMap gán trực tiếp thì mới có envMapIntensity riêng (scene.environment bỏ qua giá trị này) */
const indoor = <T extends THREE.MeshStandardMaterial>(m: T, k = 0.12) => { m.envMap = scene.environment; m.envMapIntensity = k; return m; };
/* Nhân tự phát sáng với màu đỉnh: hầm không có nắng, ánh sáng bán cầu quá yếu so với độ sáng đèn trần */
const glowByVertex = (m: THREE.MeshStandardMaterial) => {
  m.onBeforeCompile = (sh) => { sh.fragmentShader = sh.fragmentShader.replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\n  totalEmissiveRadiance *= vColor.rgb;'); };
  return m;
};

export function hrMaterials() {
  const road = makeTunnelRoadTexture(), rock = rockTexture();
  const M = {
    concrete: new THREE.MeshStandardMaterial({ color: 0xe4e1da, roughness: 0.9, vertexColors: true }),   // ngoài trời: máng hầm hở, cửa hầm
    steel: new THREE.MeshStandardMaterial({ color: 0x8d949a, roughness: 0.4, metalness: 0.8 }),
    bore: glowByVertex(indoor(new THREE.MeshStandardMaterial({ color: 0xb8b6ae, roughness: 0.85, vertexColors: true, side: THREE.DoubleSide, emissive: new THREE.Color(0.34, 0.33, 0.31) }))),
    roadOut: new THREE.MeshStandardMaterial({ map: road, roughness: 0.9 }),
    roadIn: indoor(new THREE.MeshStandardMaterial({ map: road, roughness: 0.8, color: 0xbdbdbd, emissive: new THREE.Color(0.55, 0.55, 0.52), emissiveMap: road })),
    lampThr: new THREE.MeshBasicMaterial({ color: new THREE.Color(1, 0.96, 0.86) }),   // đèn vùng ngưỡng (đầu hầm)
    lampIn: new THREE.MeshBasicMaterial({ color: new THREE.Color(1, 0.94, 0.82) }),    // đèn vùng trong
    lampCorr: new THREE.MeshBasicMaterial({ color: new THREE.Color(0.9, 1, 0.9) }),    // hành lang thoát nạn
    fan: indoor(new THREE.MeshStandardMaterial({ color: 0x6d737a, roughness: 0.5, metalness: 0.7 })),
    sos: indoor(new THREE.MeshStandardMaterial({ color: 0xe6501e, roughness: 0.6, emissive: 0x401408 })),
    extinguisher: indoor(new THREE.MeshStandardMaterial({ color: 0xc4231a, roughness: 0.5 })),
    door: indoor(new THREE.MeshStandardMaterial({ color: 0x1e8a4a, roughness: 0.6, emissive: 0x062a14 })),
    exit: new THREE.MeshBasicMaterial({ color: new THREE.Color(0.2, 2.0, 0.55) }),
    guide: new THREE.MeshBasicMaterial({ color: new THREE.Color(0.1, 0.8, 0.3) }),     // vạch dẫn thoát nạn dưới sàn hành lang
    laneGreen: new THREE.MeshBasicMaterial({ color: new THREE.Color(0.2, 2.0, 0.55) }),
    equip: indoor(new THREE.MeshStandardMaterial({ color: 0x3f6f9f, roughness: 0.5, metalness: 0.4 })),
    grate: indoor(new THREE.MeshStandardMaterial({ color: 0x1b1d20, roughness: 0.6, metalness: 0.5 })),
    louver: new THREE.MeshStandardMaterial({ color: 0xe9e5da, roughness: 0.7 }),
    brick: new THREE.MeshStandardMaterial({ color: 0xa86f4b, roughness: 0.9 }),
    wave: new THREE.MeshStandardMaterial({ color: 0xc3dbe6, roughness: 0.55, metalness: 0.1 }),
    basket: new THREE.MeshStandardMaterial({ color: 0x7a5530, roughness: 0.95, side: THREE.DoubleSide }),
    led: new THREE.MeshBasicMaterial({ color: new THREE.Color(1, 0.82, 0.5) }),       // dải LED mép mái lam (đêm), màu đổi theo hrUpdateLamps
    // thi công / mô phỏng dìm đốt hầm
    bulk: new THREE.MeshStandardMaterial({ color: 0xd2561e, roughness: 0.55, metalness: 0.4 }),
    pontoon: new THREE.MeshStandardMaterial({ color: 0xe8b923, roughness: 0.55 }),
    tug: new THREE.MeshStandardMaterial({ color: 0xc23b2a, roughness: 0.6 }),
    buoy: new THREE.MeshBasicMaterial({ color: new THREE.Color(1.8, 1.4, 0.1) }),
    bed: new THREE.MeshStandardMaterial({ color: 0x7a7560, roughness: 1 }),
    rubble: new THREE.MeshStandardMaterial({ map: rock, roughness: 1 }),
    textures: [] as THREE.Texture[]
  };
  M.textures = [road, rock];
  return M;
}
export type HrMaterials = ReturnType<typeof hrMaterials>;

/* Độ sáng đèn theo ngày đêm: ban ngày đèn vùng ngưỡng rất sáng để mắt kịp thích nghi, ban đêm giảm cùng độ chói bên ngoài */
export function hrUpdateLamps(M: HrMaterials, night: number) {
  const k = lerp(2.6, 1.1, night);
  M.lampThr.color.setRGB(k, k * 0.96, k * 0.86); M.lampIn.color.setRGB(1, 0.94, 0.82); M.lampCorr.color.setRGB(0.9, 1, 0.9);
  M.led.color.setRGB(lerp(0.35, 1.4, night), lerp(0.33, 1.1, night), lerp(0.3, 0.9, night));
}

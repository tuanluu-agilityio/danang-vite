import * as THREE from 'three';
import { Water } from 'three/addons/objects/Water.js';
import { scene } from './renderer';
import { rng } from '../common/math';

/* ============================ Mặt nước sông Hàn ============================ */
export let water: Water;

function makeWaterNormals() {
  const S = 256, d = new Uint8Array(S * S * 4);
  // Tổng nhiều sóng tần số nguyên, pha ngẫu nhiên → lát gạch liền mạch, không lộ hoa văn
  const waves: [number, number, number, number][] = []; const wr = rng(77);
  for (let i = 0; i < 28; i++) {
    const fx = Math.round((wr() - 0.5) * 2 * (3 + i)), fy = Math.round((wr() - 0.5) * 2 * (3 + i));
    if (fx === 0 && fy === 0) continue;
    waves.push([fx, fy, wr() * Math.PI * 2, 1 / Math.hypot(fx, fy)]);
  }
  const hgt = (x: number, y: number) => {
    const u = x / S * Math.PI * 2, v = y / S * Math.PI * 2; let h = 0;
    for (const [fx, fy, ph, a] of waves) h += Math.sin(u * fx + v * fy + ph) * a;
    return h;
  };
  // Lưới độ cao tính một lần, rộng thêm 1 điểm ảnh mỗi bên (cùng công thức nên trùng từng byte với cách gọi hgt 4 lần/điểm ảnh, nhanh ≈ 3,5×; D-018)
  const N = S + 2, H = new Float64Array(N * N);
  for (let y = -1; y <= S; y++) for (let x = -1; x <= S; x++) if (!((x < 0 || x === S) && (y < 0 || y === S))) H[(y + 1) * N + x + 1] = hgt(x, y);
  const at = (x: number, y: number) => H[(y + 1) * N + x + 1];
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    const dx = (at(x + 1, y) - at(x - 1, y)) * 6, dy = (at(x, y + 1) - at(x, y - 1)) * 6;
    const l = Math.hypot(dx, dy, 1), i = (y * S + x) * 4;
    d[i] = (-dx / l * 0.5 + 0.5) * 255; d[i + 1] = (-dy / l * 0.5 + 0.5) * 255; d[i + 2] = (1 / l * 0.5 + 0.5) * 255; d[i + 3] = 255;
  }
  const t = new THREE.DataTexture(d, S, S, THREE.RGBAFormat);
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.needsUpdate = true;
  return t;
}
export function buildWater() {
  const g = new THREE.PlaneGeometry(40000, 40000);
  water = new Water(g, {
    textureWidth: 512, textureHeight: 512, waterNormals: makeWaterNormals(),
    sunDirection: new THREE.Vector3(0, 1, 0), sunColor: 0xffffff, waterColor: 0x2c5a4f,
    distortionScale: 2.4, fog: true
  });
  water.rotation.x = -Math.PI / 2;
  water.material.uniforms.size.value = 0.6;
  scene.add(water);
  // Phản chiếu theo bậc chất lượng (D-018): every = 1 như gốc (vẽ lại cả cảnh vào target 512² mỗi khung), n > 1 vẽ mỗi n khung (giữ ảnh cũ ở giữa),
  // 0 = tắt: đổi sampler sang texture 1×1 màu sương (màu trời gần chân trời) — chỉ đổi giá trị uniform, không biên dịch lại
  const draw = water.onBeforeRender, mirror = water.material.uniforms.mirrorSampler;
  const mirrorTex = mirror.value as THREE.Texture, flatTex = new THREE.DataTexture(new Uint8Array(4), 1, 1);
  let n = 0;
  water.onBeforeRender = function (...args: Parameters<typeof draw>) {
    const every = reflectState.every;
    if (every > 0) {
      if (mirror.value !== mirrorTex) mirror.value = mirrorTex;
      if (every === 1 || n++ % every === 0) draw.apply(this, args);
      return;
    }
    if (mirror.value !== flatTex) mirror.value = flatTex;
    const c = (scene.fog as THREE.FogExp2).color, d = flatTex.image.data as Uint8Array;
    const r = Math.round(c.r * 255), g = Math.round(c.g * 255), b = Math.round(c.b * 255);
    if (d[0] !== r || d[1] !== g || d[2] !== b) { d[0] = r; d[1] = g; d[2] = b; d[3] = 255; flatTex.needsUpdate = true; }
  };
}
export const reflectState = { every: 1 };

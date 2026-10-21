import * as THREE from 'three';
import { CONFIG } from '../../config';
import { MAT } from '../../core/materials';

/* ===== [weather] Mặt ướt (mục 4.4): 0 draw call, chỉ đổi thuộc tính vật liệu =====
   Vật liệu "đường" đăng ký TƯỜNG MINH bằng registerWet() (không dò theo tên). Theo `wet`: roughness lerp từ gốc về wetness.roughness,
   màu nhân wetness.darken (đường ướt sẫm, phản chiếu đèn rõ hơn). Giá trị gốc chụp lúc đăng ký; wet ≈ 0 thì trả ĐÚNG gốc một lần rồi không đụng.
   Bê tông/thép cầu: option `weather` của bridgePatch đọc weatherU.uWet trong shader (common/shaders.ts). */
export type WetKind = 'road';
interface WetEntry { mat: THREE.MeshStandardMaterial; kind: WetKind; roughness: number; color: THREE.Color }
const list: WetEntry[] = [];
let active = false;

export function registerWet(mat: THREE.MeshStandardMaterial, kind: WetKind = 'road') {
  if (list.some((e) => e.mat === mat)) return mat;
  list.push({ mat, kind, roughness: mat.roughness, color: mat.color.clone() });
  return mat;
}
export const wetMaterials = () => list.map((e) => e.mat);

/* Đường chung của cảnh (phố, vỉa hè, kè đá). Đường của từng cầu tự đăng ký trong materials.ts của cầu đó */
export function buildWetness() {
  for (const m of [MAT.road, MAT.road2, MAT.paver, MAT.stone]) registerWet(m);
}

export function applyWetness(wet: number) {
  if (wet < 1e-3) {
    if (active) { for (const e of list) { e.mat.roughness = e.roughness; e.mat.color.copy(e.color); } active = false; }
    return;
  }
  active = true;
  const W = CONFIG.weather.wetness, k = Math.min(1, wet), dark = 1 - (1 - W.darken) * k;
  for (const e of list) { e.mat.roughness = e.roughness + (W.roughness - e.roughness) * k; e.mat.color.copy(e.color).multiplyScalar(dark); }
}

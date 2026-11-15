import * as THREE from 'three';
import { scene, renderer } from './renderer';
import { shared } from './shared';
import { MAT } from './materials';
import { sun, hemi, moon, bridgeLights } from './lights';
import { setSun, stars, clouds } from './sky';
import { water } from './water';
import { lerp, clamp } from '../common/math';
import { CONFIG } from '../config';
import { sunElevK } from '../realtime/solar';

/* ============================ Ngày / đêm ============================ */
/* night: giá trị hiện tại (0 ngày → 1 đêm), target: giá trị người xem chọn; night tiến dần về target */
export const dayNight = { night: 0, target: 0 };

const C_FOG_DAY = new THREE.Color(0xcfdde6), C_FOG_NIGHT = new THREE.Color(0x0b1424);
const C_HEMI_DAY = new THREE.Color(0xcfe6ff), C_HEMI_NIGHT = new THREE.Color(0x2a3a66);
const C_WATER_DAY = new THREE.Color(0x2c5a4f), C_WATER_NIGHT = new THREE.Color(0x08181b);
const C_BULB_DAY = new THREE.Color(0x9a9890), C_BULB_NIGHT = new THREE.Color(2.4, 1.9, 1.1);

/* Mặt trời thật của chế độ Trực tiếp (D-043, realtime/liveEnv.ts): elev / azim độ (azim la bàn, 0 = Bắc, 90 = Đông), warm 0–1 (solar.ts sunWarm) */
export type SunOverride = { elev: number; azim: number; warm: number };
const C_SUN = sun.color.clone(), C_SUN_WARM = new THREE.Color(CONFIG.live.warmSun), C_FOG_WARM = new THREE.Color(CONFIG.live.warmFog);
const C_HEMI_WARM = new THREE.Color(CONFIG.live.warmHemi), C_WATER_WARM = new THREE.Color(CONFIG.live.warmWater);
/* Sắc ấm đang áp (sunWarm × (1 − night)), 0 ở Mô phỏng: weather/atmosphere.ts đọc để chỉnh Sky (đỏ cam quanh mặt trời thấp) sau khi nó đặt turbidity / rayleigh */
export const liveSunWarm = { value: 0 };
let sunTinted = false;   // sun.color đang khác gốc (đã ở Trực tiếp): rời Trực tiếp thì trả lại một lần

/* m: đêm 0–1. sun: bỏ trống / null = Mô phỏng, chạy y như trước D-043 (mặt trời cố định 205°, 40° → −7°) */
export function applyNight(m: number, time: number, so?: SunOverride | null) {
  shared.uNight.value = m;
  liveSunWarm.value = so ? so.warm * (1 - m) : 0;
  if (so) {
    // Đèn định hướng kẹp độ cao ≥ sunMinElev (bóng không dài vô hạn); bầu trời + phản chiếu nước nhận độ cao thật. Phương vị la bàn A ⇒ góc cảnh 180° − A (+X Đông, −Z Bắc)
    setSun(Math.max(so.elev, CONFIG.live.sunMinElev), 180 - so.azim, so.elev);
    // Hệ số theo độ cao luôn > 0: sun.intensity chỉ về 0 do `night` (≥ 0,87) như cũ, bộ đèn D-031 không đổi cách quyết
    sun.intensity = 3.0 * clamp(1 - m * 1.15, 0, 1) * sunElevK(so.elev) * (1 + CONFIG.live.warmSunBoost * so.warm);   // lúc thấp: nắng vàng cam đậm hơn (warm = 0 khi trưa ⇒ không đổi)
    sun.color.copy(C_SUN).lerp(C_SUN_WARM, so.warm); sunTinted = true;
  } else {
    if (sunTinted) { sun.color.copy(C_SUN); sunTinted = false; }
    setSun(lerp(40, -7, m), 205);
    sun.intensity = 3.0 * clamp(1 - m * 1.15, 0, 1);
  }
  moon.intensity = 0.35 * m;
  hemi.intensity = lerp(0.9, 0.22, m);
  hemi.color.copy(C_HEMI_DAY).lerp(C_HEMI_NIGHT, m);
  (scene.fog as THREE.FogExp2).color.copy(C_FOG_DAY).lerp(C_FOG_NIGHT, m);
  if (so && so.warm > 0) {   // hoàng hôn / bình minh (Trực tiếp): sương, ánh sáng trời ấm theo sunWarm × (1 − night); sunWarm liên tục nên không nhảy
    (scene.fog as THREE.FogExp2).color.lerp(C_FOG_WARM, so.warm * CONFIG.live.warmFogK * (1 - m));
    hemi.color.lerp(C_HEMI_WARM, so.warm * CONFIG.live.warmHemiK * (1 - m));
    hemi.intensity *= 1 - CONFIG.live.warmAmbientK * so.warm * (1 - m);   // ánh sáng trời yếu đi để nắng vàng cam nổi lên (tỉ lệ nắng / bóng như chiều muộn)
  }
  scene.environmentIntensity = lerp(1, 0.14, m);
  if (so && so.warm > 0) scene.environmentIntensity *= 1 - CONFIG.live.warmAmbientK * so.warm * (1 - m);
  renderer.toneMappingExposure = lerp(0.55, 0.8, m);
  water.material.uniforms.waterColor.value.copy(C_WATER_DAY).lerp(C_WATER_NIGHT, m);
  water.material.uniforms.sunColor.value.setRGB(lerp(1, 0.25, m), lerp(1, 0.3, m), lerp(1, 0.45, m));
  if (so && so.warm > 0) water.material.uniforms.sunColor.value.lerp(C_WATER_WARM, so.warm);   // vệt nắng trên sông ấm lúc mặt trời thấp (Trực tiếp)
  stars.material.opacity = clamp((m - 0.4) / 0.6, 0, 1);
  clouds.material.opacity = lerp(0.85, 0.12, m);
  MAT.bulb.color.copy(C_BULB_DAY).lerp(C_BULB_NIGHT, m);
  MAT.pupil.emissiveIntensity = m * 2.5;
  MAT.eye.emissiveIntensity = 0.05 + m * 0.4;
  // Đèn dọc cầu nhấp nháy nhẹ theo sin(time)
  bridgeLights.forEach((l) => { l.intensity = l.userData.base * m * (0.82 + 0.18 * Math.sin(time * 2.2 + l.userData.phase)); });
}
/* Một bước chuyển ngày ↔ đêm mỗi khung hình */
export function stepNight(dt: number) {
  dayNight.night += (dayNight.target - dayNight.night) * Math.min(1, dt * 1.6);
  if (Math.abs(dayNight.target - dayNight.night) < 0.001) dayNight.night = dayNight.target;
}

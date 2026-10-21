import * as THREE from 'three';
import { CONFIG } from '../../config';
import { scene, renderer } from '../../core/renderer';
import { sun, hemi } from '../../core/lights';
import { sky, clouds } from '../../core/sky';
import { water } from '../../core/water';
import type { WeatherState } from './state';

/* ===== [weather] Khí quyển (mục 4.2): sương, trời, ánh sáng, mây, nước — 0 draw call mới =====
   applyNight() ghi đè mỗi khung: màu sương, hemi, sun, exposure, màu nước, độ mờ mây. Ở đây chỉ ĐIỀU BIẾN sau đó (nhân/lerp).
   Giá trị applyNight KHÔNG đặt lại (mật độ sương, Sky turbidity/rayleigh, distortionScale, size, water.y, màu mây, xoay mây) được chụp lúc buildAtmosphere()
   và trả ĐÚNG khi mọi trọng số về 0 (preset `now` = no-op). */
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x);
const fogCol = new THREE.Color(), tmp = new THREE.Color();
const C = {
  haze: new THREE.Color(0xe8dcc4), gray: new THREE.Color(0x8c9aa3), storm: new THREE.Color(0x5d6870),     // màu sương: be nóng, xám xanh, bão
  hemiGray: new THREE.Color(0x8a949c),                                                                       // màu hemi khi trời xám
  waterSun: new THREE.Color(0x2f6f6a), waterRain: new THREE.Color(0x5a5a3e), waterStorm: new THREE.Color(0x4a4433),   // nước: xanh trong, nâu, nâu đục
  cloudGray: new THREE.Color(0x7d868c), cloudStorm: new THREE.Color(0x2a2f33)                                 // mây: xám đậm, gần đen
};
interface Base { fogDensity: number; turbidity: number; rayleigh: number; distortion: number; size: number; waterY: number; cloudColor: THREE.Color; cloudRotY: number }
let base: Base | null = null, active = false, spin = 0;

/* Chụp giá trị gốc (gọi sau buildSky/buildWater, trước khi áp thời tiết). */
export function buildAtmosphere() {
  const u = sky.material.uniforms, wu = water.material.uniforms;
  base = {
    fogDensity: (scene.fog as THREE.FogExp2).density, turbidity: u.turbidity.value, rayleigh: u.rayleigh.value,
    distortion: wu.distortionScale.value, size: wu.size.value, waterY: water.position.y, cloudColor: clouds.material.color.clone(), cloudRotY: clouds.rotation.y
  };
}

function restore() {
  if (!base) return;
  (scene.fog as THREE.FogExp2).density = base.fogDensity;
  const u = sky.material.uniforms, wu = water.material.uniforms;
  u.turbidity.value = base.turbidity; u.rayleigh.value = base.rayleigh;
  wu.distortionScale.value = base.distortion; wu.size.value = base.size; water.position.y = base.waterY;
  clouds.material.color.copy(base.cloudColor); clouds.rotation.y = base.cloudRotY; spin = 0;
}

/* Gọi NGAY SAU applyNight(m): điều biến theo thời tiết hiện tại (state.current). */
export function applyAtmosphere(s: WeatherState, m: number, dt: number) {
  if (!base) return;
  const A = CONFIG.weather.atmosphere, c = s.current, night = clamp01(m);
  const sunny = clamp01(c.haze);                                     // nắng hè: trời gắt, mù nóng
  const stormK = clamp01(Math.min(c.rain, c.wind / A.stormWind));    // bão: mưa lớn VÀ gió mạnh (liên tục theo thanh cường độ)
  const gray = clamp01(Math.max(c.rain, (c.cloud - A.grayCloud) * A.grayGain));   // trời xám: mưa hoặc mây dày
  const lvl = c.level;
  if (sunny < 1e-3 && gray < 1e-3 && stormK < 1e-3 && Math.abs(lvl) < 1e-3) {
    if (active) { restore(); active = false; }                      // về `now`: trả đúng giá trị gốc, rồi không đụng gì nữa
    return;
  }
  active = true;
  const dark = 1 - A.nightDim * night;                               // màu thời tiết là màu ban ngày: ban đêm tối đi cùng cảnh
  const fog = scene.fog as THREE.FogExp2;
  // Sương: dày theo mưa/bão, hơi dày khi nóng; màu be nóng → xám xanh → bão
  fog.density = base.fogDensity * (1 + A.hazeFog * sunny + (A.rainFog - 1) * clamp01(c.rain) + (A.stormFog - A.rainFog) * stormK);
  tmp.copy(C.gray).lerp(C.storm, stormK).multiplyScalar(dark);
  fog.color.lerp(fogCol.copy(C.haze).multiplyScalar(dark), sunny * A.hazeTint).lerp(tmp, gray);
  // Trời
  const u = sky.material.uniforms;
  u.turbidity.value = lerp(lerp(lerp(base.turbidity, A.sunSky[0], sunny), A.graySky[0], gray), A.stormSky[0], stormK);
  u.rayleigh.value = lerp(lerp(lerp(base.rayleigh, A.sunSky[1], sunny), A.graySky[1], gray), A.stormSky[1], stormK);
  // Ánh sáng: nắng gắt khi hè; mây dày hạ nắng; bão gần như tắt nắng. Không đụng castShadow (nút "Bóng đổ" là của người dùng)
  sun.intensity *= (1 + A.sunBoost * sunny) * (1 - A.sunCloud * clamp01(c.cloud)) * lerp(1, A.stormSun, stormK);
  hemi.intensity *= (1 + A.hemiBoost * sunny) * lerp(1, A.hemiGray, gray) * lerp(1, A.hemiStorm / A.hemiGray, stormK);
  hemi.color.lerp(tmp.copy(C.hemiGray).multiplyScalar(dark), gray);
  renderer.toneMappingExposure *= (1 + A.expBoost * sunny) * lerp(1, A.expGray, gray) * lerp(1, A.expStorm / A.expGray, stormK);
  // Mây: mỏng khi nắng; dày, xám đậm rồi gần đen khi mưa/bão; bão xoay chậm theo gió
  const cm = clouds.material;
  cm.opacity *= 1 - A.cloudThin * sunny;
  cm.opacity = lerp(cm.opacity, 1 - A.cloudNightOpacity * night, gray);
  cm.color.copy(base.cloudColor).lerp(tmp.copy(C.cloudGray).lerp(C.cloudStorm, stormK), gray).multiplyScalar(lerp(1, A.cloudNightDim, night));
  spin += dt * A.cloudSpin * stormK; clouds.rotation.y = base.cloudRotY + spin;
  // Nước: xanh trong khi nắng, nâu khi mưa, nâu đục khi bão; sóng tăng; sông dâng
  const wu = water.material.uniforms, wc = wu.waterColor.value as THREE.Color;
  wc.lerp(tmp.copy(C.waterSun).multiplyScalar(dark), sunny).lerp(tmp.copy(C.waterRain).lerp(C.waterStorm, stormK).multiplyScalar(dark), gray);
  wu.distortionScale.value = lerp(lerp(lerp(base.distortion, A.sunWave, sunny), A.grayWave, gray), A.stormWave, stormK);
  wu.size.value = lerp(base.size, A.stormSize, stormK);
  water.position.y = base.waterY + lvl;
}

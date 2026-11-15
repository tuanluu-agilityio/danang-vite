import * as THREE from 'three';
import { CONFIG } from '../../config';
import { scene, renderer } from '../../core/renderer';
import { sun, hemi } from '../../core/lights';
import { sky, clouds, stars } from '../../core/sky';
import { water } from '../../core/water';
import { quality } from '../../core/quality';
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
  cloudGray: new THREE.Color(0x7d868c), cloudStorm: new THREE.Color(0x2a2f33),                                // mây: xám đậm, gần đen
  fog: new THREE.Color(CONFIG.live.fogColor)                                                                 // sương mù (D-043, chỉ Trực tiếp đặt fog > 0)
};
interface Base { fogDensity: number; turbidity: number; rayleigh: number; distortion: number; size: number; waterY: number; cloudColor: THREE.Color; cloudRotY: number }
let base: Base | null = null, active = false, spin = 0;
let liveClouds = false;   // clouds.count đang do Trực tiếp đặt theo độ phủ mây (D-043); rời Trực tiếp thì trả về số của bậc chất lượng

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

/* Gọi NGAY SAU applyNight(m): điều biến theo thời tiết hiện tại (state.current).
   live (D-043, chế độ Trực tiếp): số tấm mây theo độ phủ mây; Mô phỏng (false) không đụng clouds.count (bậc chất lượng quyết như cũ). */
export function applyAtmosphere(s: WeatherState, m: number, dt: number, live = false) {
  if (!base) return;
  const A = CONFIG.weather.atmosphere, c = s.current, night = clamp01(m);
  // Mật độ mây (0 lệnh vẽ thêm: InstancedMesh.count): cloudMin tấm khi quang → đủ số tấm của bậc chất lượng khi u ám
  const qMax = Math.min(quality.current().clouds, clouds.instanceMatrix.count);
  if (live) {
    clouds.count = Math.min(qMax, Math.round(lerp(CONFIG.live.cloudMin, qMax, clamp01(c.cloud)))); liveClouds = true;
    stars.material.opacity *= 1 - clamp01(c.cloud);   // trời u ám thật không thấy sao (applyNight đặt lại opacity mỗi khung; Mô phỏng không đổi)
  }
  else if (liveClouds) { clouds.count = qMax; liveClouds = false; }
  const sunny = clamp01(c.haze);                                     // nắng hè: trời gắt, mù nóng
  const stormK = clamp01(Math.min(c.rain, c.wind / A.stormWind));    // bão: mưa lớn VÀ gió mạnh (liên tục theo thanh cường độ)
  const gray = clamp01(Math.max(c.rain, (c.cloud - A.grayCloud) * A.grayGain));   // trời xám: mưa hoặc mây dày
  const lvl = c.level;
  const windK = Math.min(1.5, c.wind / A.stormWind);               // gió (GĐ4): mây xoay, sóng tăng — kể cả khi không mưa
  const fogK = clamp01(c.fog || 0);                                  // sương / tầm nhìn kém (D-043): preset mô phỏng luôn 0
  if (sunny < 1e-3 && gray < 1e-3 && stormK < 1e-3 && Math.abs(lvl) < 1e-3 && windK < 1e-4 && fogK < 1e-3) {
    if (active) { restore(); active = false; }                      // về `now`: trả đúng giá trị gốc, rồi không đụng gì nữa
    return;
  }
  active = true;
  const dark = 1 - A.nightDim * night;                               // màu thời tiết là màu ban ngày: ban đêm tối đi cùng cảnh
  const fog = scene.fog as THREE.FogExp2;
  // Sương: dày theo mưa/bão, hơi dày khi nóng; màu be nóng → xám xanh → bão
  // Sương mù D-043 (fogK, từ tầm nhìn đo được) và sương do mưa / bão cùng mô tả tầm nhìn kém: lấy mức dày hơn, không nhân chồng (mưa to + tầm nhìn 3 km không thành ×50)
  fog.density = base.fogDensity * Math.max(1 + A.hazeFog * sunny + (A.rainFog - 1) * clamp01(c.rain) + (A.stormFog - A.rainFog) * stormK, 1 + (CONFIG.live.fogMax - 1) * fogK);
  tmp.copy(C.gray).lerp(C.storm, stormK).multiplyScalar(dark);
  fog.color.lerp(fogCol.copy(C.haze).multiplyScalar(dark), sunny * A.hazeTint).lerp(tmp, gray);
  if (fogK > 0) fog.color.lerp(fogCol.copy(C.fog).multiplyScalar(dark), fogK);   // sương mù (D-043): màu về xám trắng (tối theo đêm); fogK = 0 thì không chạy (hình mô phỏng không đổi)
  // Trời
  const u = sky.material.uniforms;
  u.turbidity.value = lerp(lerp(lerp(base.turbidity, A.sunSky[0], sunny), A.graySky[0], gray), A.stormSky[0], stormK);
  u.rayleigh.value = lerp(lerp(lerp(base.rayleigh, A.sunSky[1], sunny), A.graySky[1], gray), A.stormSky[1], stormK);
  if (fogK > 0) { const k = CONFIG.live.fogSky * fogK; u.turbidity.value = lerp(u.turbidity.value, A.graySky[0], k); u.rayleigh.value = lerp(u.rayleigh.value, A.graySky[1], k); }
  // Ánh sáng: nắng gắt khi hè; mây dày hạ nắng; bão gần như tắt nắng. Không đụng castShadow (nút "Bóng đổ" là của người dùng)
  sun.intensity *= (1 + A.sunBoost * sunny) * (1 - A.sunCloud * clamp01(c.cloud)) * lerp(1, A.stormSun, stormK) * (1 - CONFIG.live.fogSun * fogK);   // mọi hệ số > 0: không đưa nắng về 0 giữa ban ngày (bộ đèn D-031)
  hemi.intensity *= (1 + A.hemiBoost * sunny) * lerp(1, A.hemiGray, gray) * lerp(1, A.hemiStorm / A.hemiGray, stormK);
  hemi.color.lerp(tmp.copy(C.hemiGray).multiplyScalar(dark), gray);
  renderer.toneMappingExposure *= (1 + A.expBoost * sunny) * lerp(1, A.expGray, gray) * lerp(1, A.expStorm / A.expGray, stormK);
  // Mây: mỏng khi nắng; dày, xám đậm rồi gần đen khi mưa/bão; cả cụm xoay chậm theo gió (mục 4.5)
  const cm = clouds.material;
  cm.opacity *= 1 - A.cloudThin * sunny;
  cm.opacity = lerp(cm.opacity, 1 - A.cloudNightOpacity * night, gray);
  cm.color.copy(base.cloudColor).lerp(tmp.copy(C.cloudGray).lerp(C.cloudStorm, stormK), gray).multiplyScalar(lerp(1, A.cloudNightDim, night));
  spin += dt * A.cloudSpin * windK; clouds.rotation.y = base.cloudRotY + spin;
  // Nước: xanh trong khi nắng, nâu khi mưa, nâu đục khi bão; sóng tăng; sông dâng
  const wu = water.material.uniforms, wc = wu.waterColor.value as THREE.Color;
  wc.lerp(tmp.copy(C.waterSun).multiplyScalar(dark), sunny).lerp(tmp.copy(C.waterRain).lerp(C.waterStorm, stormK).multiplyScalar(dark), gray);
  wu.distortionScale.value = lerp(lerp(lerp(base.distortion, A.sunWave, sunny), A.grayWave, gray), A.stormWave, stormK) + CONFIG.weather.wind.windWave * Math.min(1, windK) * (1 - stormK);   // gió không mưa (gió mùa) cũng nổi sóng
  wu.size.value = lerp(base.size, A.stormSize, stormK);
  water.position.y = base.waterY + lvl;
}

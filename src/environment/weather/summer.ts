import * as THREE from 'three';
import { CONFIG } from '../../config';
import { MAT } from '../../core/materials';
import { shared, weatherU } from '../../core/shared';
import { cableSag } from './impact';
import type { WeatherParams } from './state';
import { bkRoadPatch, bkRoadKey } from '../../explore/bike/roadFx';

/* ===== [weather] Nắng hè (mục 4.7): 0 draw call, chỉ shader + uniform =====
   - Ảo ảnh mặt đường: vá MAT.road, MAT.road2 (đường phố) — nhìn sát mặt (|cos| tia nhìn–pháp tuyến nhỏ) và xa hơn mirageNear thì trộn màu sương (fogColor)
     và dao động nhẹ UV theo uTime. Cường độ = uHaze × (1 − đêm). Không dùng pass hậu kỳ. uHaze = 0 → nhánh không chạy (ảnh preset `now` không đổi).
     Mặt cầu có vật liệu riêng (bridgePatch) nên chưa có ảo ảnh — chỉ đường phố.
   - Võng cáp phóng đại: uSagTp = Δf (cableSag, m) × swayExaggeration, đọc bởi option `sag` của bridgePatch (cáp chủ + đầu trên hanger Thuận Phước).
   Grade màu hè (hemi ấm, sương be, nước xanh ngọc) nằm ở atmosphere.ts (GĐ2).
   - D-040 Task 8: hook này cũng gọi bkRoadPatch (hạt nhựa + vệt ướt khi lái xe máy, explore/bike/roadFx.ts) vì một vật liệu chỉ có một onBeforeCompile;
     khóa program thêm hậu tố bkRoadKey() (rỗng khi CONFIG.bike.road.detail = false). uRoadNear = 0 ngoài chế độ xe máy ⇒ ảnh cũ không đổi.
     Mặt đường ba cầu + dốc hở hầm (roadSharePatch): dùng CHUNG hook + khóa của MAT.road2 nên dùng chung program của nó (vật liệu mặc định của chúng vốn chung
     program với mọi MeshStandardMaterial có map khác; khóa riêng sẽ thêm 3 program: ngày, có bóng, gương nước). uHaze của chúng trỏ vào hằng 0 riêng
     (NO_HAZE) ⇒ mặt cầu vẫn không có ảo ảnh như cũ; uniform là của từng vật liệu dù chung program. */
const f = (x: number) => x.toFixed(4);

function patchMirage(mat: THREE.MeshStandardMaterial, key: string, haze: { value: number } = weatherU.uHaze) {
  const S = CONFIG.weather.summer;
  const fullKey = key + bkRoadKey();
  mat.customProgramCacheKey = () => fullKey;
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.uTime = shared.uTime; sh.uniforms.uNight = shared.uNight; sh.uniforms.uHaze = haze;
    const mapChunk = THREE.ShaderChunk.map_fragment.replace('texture2D( map, vMapUv )', 'texture2D( map, vMapUv + mgOff )');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform float uTime; uniform float uNight; uniform float uHaze;')
      .replace('#include <map_fragment>', `
        vec2 mgOff = vec2(0.0); float mgK = 0.0;
        if (uHaze > 0.0) {
          vec3 mgV = normalize(vViewPosition), mgUp = normalize((viewMatrix * vec4(0.0, 1.0, 0.0, 0.0)).xyz);
          float mgD = length(vViewPosition);
          mgK = uHaze * (1.0 - uNight) * (1.0 - smoothstep(0.0, ${f(S.mirageGraze)}, abs(dot(mgV, mgUp)))) * smoothstep(${f(S.mirageNear)}, ${f(S.mirageFar)}, mgD);
          mgOff = vec2(sin(uTime * ${f(S.mirageFreq)} + vViewPosition.x * 0.31), cos(uTime * ${f(S.mirageFreq * 1.3)} + vViewPosition.z * 0.27)) * ${f(S.mirageWobble)} * mgK;
        }
        ${mapChunk}
        if (mgK > 0.0) diffuseColor.rgb = mix(diffuseColor.rgb, fogColor + vec3(${f(S.mirageLift)}), mgK * ${f(S.mirageMix)});`);
    if (CONFIG.bike.road.detail) bkRoadPatch(sh);
  };
  mat.needsUpdate = true;
}

/* D-040 Task 8: vật liệu đường của cầu / dốc hầm dùng chung program với MAT.road2 (xem đầu file); tắt mốc (detail = false) ⇒ không đụng vật liệu */
const NO_HAZE = { value: 0 };
export function roadSharePatch<M extends THREE.MeshStandardMaterial>(mat: M): M {
  if (CONFIG.bike.road.detail) patchMirage(mat, 'road2-mirage', NO_HAZE);
  return mat;
}

/* Gọi trong buildWeather, trước khung hình đầu (vật liệu chưa biên dịch) */
export function buildSummer() {
  patchMirage(MAT.road, 'road-mirage');
  patchMirage(MAT.road2, 'road2-mirage');
}

/* Mỗi khung: võng cáp phóng đại. on = weather đang bật; nhiệt độ chuẩn → đúng 0 */
export function updateSummer(c: WeatherParams, on: boolean) {
  const sag = on ? cableSag(c.temp) * CONFIG.weather.swayExaggeration : 0;
  weatherU.uSagTp.value = Math.abs(sag) < 1e-4 ? 0 : sag;
}

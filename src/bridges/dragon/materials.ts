import * as THREE from 'three';
import { MAT } from '../../core/materials';
import { shared } from '../../core/shared';

/* Đèn LED trên thân rồng: sóng sáng chạy dọc thân, đổi màu vàng ấm ↔ xanh lam */
function patchDragonGlow(mat: THREE.Material, strength: number) {
  mat.customProgramCacheKey = () => 'glow' + strength;
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.uTime = shared.uTime; sh.uniforms.uNight = shared.uNight;
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying float vGX;')
      .replace('#include <fog_vertex>', `#include <fog_vertex>
        { vec4 gp = vec4(transformed, 1.0);
        #ifdef USE_INSTANCING
          gp = instanceMatrix * gp;
        #endif
          vGX = (modelMatrix * gp).x; }`);
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying float vGX; uniform float uTime; uniform float uNight;')
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
        { float k = 0.5 + 0.5 * sin(uTime * 0.6 + vGX * 0.012);
          float w = 0.5 + 0.5 * sin(vGX * 0.07 - uTime * 2.6);
          float pulse = 0.35 + 0.65 * w * w;
          vec3 c = mix(vec3(1.0, 0.64, 0.2), vec3(0.22, 0.48, 1.0), k);
          totalEmissiveRadiance += c * pulse * uNight * ${strength.toFixed(2)}; }`);
  };
}
patchDragonGlow(MAT.gold, 0.7);
patchDragonGlow(MAT.scale, 0.9);

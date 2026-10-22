import * as THREE from 'three';
import { shared, weatherU } from '../core/shared';
import { CONFIG } from '../config';

type Mat = THREE.Material;

/* Cửa sổ nhà cao tầng sinh bằng shader theo tọa độ thế giới (không kéo giãn khi đổi chiều cao) */
export function patchWindows(mat: Mat) {
  mat.customProgramCacheKey = () => 'windows';
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.uNight = shared.uNight;
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vBPos; varying vec3 vBNrm;')
      .replace('#include <fog_vertex>', `#include <fog_vertex>
        { vec4 bp = vec4(transformed, 1.0); vec3 bn = objectNormal;
        #ifdef USE_INSTANCING
          bp = instanceMatrix * bp; bn = mat3(instanceMatrix) * bn;
        #endif
          vBPos = (modelMatrix * bp).xyz; vBNrm = normalize(mat3(modelMatrix) * bn); }`);
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>
        varying vec3 vBPos; varying vec3 vBNrm; uniform float uNight;
        float bHash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
        float winMask(out vec2 cell){
          float side = 1.0 - step(0.6, abs(vBNrm.y));
          float along = abs(vBNrm.x) > 0.5 ? vBPos.z : vBPos.x;
          vec2 g = vec2(along / 3.2, vBPos.y / 3.4);
          cell = floor(g); vec2 f = fract(g);
          return side * step(0.16, f.x) * step(f.x, 0.84) * step(0.22, f.y) * step(f.y, 0.82) * step(5.5, vBPos.y);
        }`)
      .replace('#include <map_fragment>', `#include <map_fragment>
        { vec2 cl; float wm = winMask(cl);
          diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.20, 0.29, 0.36), wm * 0.82); }`)
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
        { vec2 cl; float wm = winMask(cl);
          float h = bHash(cl + floor(vBPos.xz * 0.02) * 7.13);
          vec3 lit = mix(vec3(1.0, 0.78, 0.46), vec3(0.75, 0.88, 1.0), step(0.8, h));
          totalEmissiveRadiance += wm * step(0.42, h) * lit * uNight * 1.3; }`);
  };
}

/* ======================================================================
   Shader bổ sung cho các cầu: vân bê tông, vệt nước bám, LED đổi màu theo bảng màu / pattern
   ====================================================================== */
export const LED_PALETTES = {
  sea: [[0.10, 0.35, 1.00], [0.55, 0.18, 1.00], [1.00, 0.22, 0.62], [0.12, 1.00, 0.55]],  // xanh dương → tím → hồng → xanh lá
  sail: [[1.00, 0.08, 0.10], [1.00, 0.20, 0.50], [0.60, 0.16, 1.00], [0.12, 0.38, 1.00]], // đỏ → hồng → tím → xanh ("cánh buồm đỏ")
  rainbow: [[1.00, 0.12, 0.10], [1.00, 0.78, 0.10], [0.10, 1.00, 0.35], [0.15, 0.40, 1.00]] // cầu vồng (Cầu sông Hàn)
};
export type PaletteName = keyof typeof LED_PALETTES;
const glslVec3 = (c: number[]) => `vec3(${c.map((v) => v.toFixed(2)).join(', ')})`;

export interface BridgePatchOptions {
  noise?: boolean;
  wet?: boolean;
  led?: number;                  // cường độ
  mode?: 0 | 1;                  // 0: theo trục cầu, 1: đèn hắt tháp
  palette?: PaletteName;
  pattern?: { value: number };   // uniform chọn pattern
  originX?: number;              // sóng chạy ra xa điểm này
  originZ?: number;
  floodTop?: number;             // m, cho mode 1
  floodBase?: number;
  weather?: boolean;             // mặt ướt khi mưa: đọc weatherU.uWet (0 = không đổi gì)
  sag?: 'cable' | 'hanger';      // võng cáp chủ Thuận Phước khi nóng (weather/summer.ts): đọc weatherU.uSagTp (0 = không đổi gì); hanger chỉ dịch đầu trên
  sway?: SwayKind;               // dây lắc theo gió (chỉ InstancedMesh dựng bằng segmentMatrix): đọc weatherU.uSwayTp/Ttl/Sh (0 = không đổi gì)
}
export type SwayKind = 'tp' | 'ttl' | 'sh';
const SWAY_U = { tp: weatherU.uSwayTp, ttl: weatherU.uSwayTtl, sh: weatherU.uSwaySh };

/* Dây lắc theo gió (mục 4.5): dịch SAU khi nhân instanceMatrix/modelMatrix (không gian thế giới — segmentMatrix co bán kính nên dịch cục bộ bị thu nhỏ).
   Dạng sin(π·t), t = position.y + 0.5 của CylinderGeometry (hai đầu cố định). Hướng chính: thành phần gió vuông góc với dây, thêm 35 % vuông góc thứ hai (quỹ đạo elip).
   Biên độ (m, đã phóng đại) do weather/wind.ts tính; = 0 thì nhánh không chạy (ảnh preset `now` trùng từng điểm ảnh). */
const swayVertex = (omega: number) => `#include <project_vertex>
  #ifdef USE_INSTANCING
  if (uSway > 0.0) {
    vec3 swAx = mat3(modelMatrix) * instanceMatrix[1].xyz; float swLen = length(swAx); swAx /= swLen;
    vec3 swW = vec3(uWindDir.x, 0.0, uWindDir.y), swD = swW - swAx * dot(swW, swAx); float swL = length(swD);
    swD = swL > 1e-3 ? swD / swL : vec3(0.0, 1.0, 0.0);
    vec3 swE = cross(swAx, swD), swC = (modelMatrix * vec4(instanceMatrix[3].xyz, 1.0)).xyz;
    float swPh = dot(swC, vec3(0.071, 0.023, 0.113)), swT = clamp(position.y + 0.5, 0.0, 1.0);
    float swA = sin(3.14159265 * swT) * uSway * min(1.0, swLen / ${CONFIG.weather.wind.refLen.toFixed(1)});
    vec3 swDisp = swA * (swD * sin(uTime * ${omega.toFixed(2)} + swPh) + swE * 0.35 * sin(uTime * ${(omega * 1.37).toFixed(2)} + swPh * 1.7));
    mvPosition.xyz += mat3(viewMatrix) * swDisp; gl_Position = projectionMatrix * mvPosition;
  }
  #endif`;
/* Võng cáp chủ khi nóng (mục 4.7): dịch y theo Δf·sin(π·u), u = vị trí dọc nhịp chính (ngoài nhịp chính = 0). Hanger: chỉ đầu trên (position.y = −0,5, xem segmentMatrix(top, bot)) đi xuống. */
const sagVertex = (kind: 'cable' | 'hanger') => `
  if (uSagTp != 0.0) {
    vec4 sgL = vec4(transformed, 1.0);
    #ifdef USE_INSTANCING
      sgL = instanceMatrix * sgL;
    #endif
    float sgX = (modelMatrix * sgL).x, sgU = clamp((sgX + ${(CONFIG.thuanPhuoc.mainSpan / 2).toFixed(2)}) / ${CONFIG.thuanPhuoc.mainSpan.toFixed(2)}, 0.0, 1.0);
    float sgW = ${kind === 'hanger' ? 'clamp(0.5 - position.y, 0.0, 1.0)' : '1.0'};
    mvPosition.xyz += mat3(viewMatrix) * vec3(0.0, -uSagTp * sin(3.14159265 * sgU) * sgW, 0.0); gl_Position = projectionMatrix * mvPosition;
  }`;
export function bridgePatch<M extends Mat>(mat: M, opt: BridgePatchOptions): M {
  const pal = LED_PALETTES[opt.palette || 'sea'];
  const key = ['bp', opt.noise ? 1 : 0, opt.wet ? 1 : 0, opt.led || 0, opt.mode || 0, opt.palette || 'sea',
    opt.pattern ? 1 : 0, opt.originX ?? 'n', opt.originZ ?? 'n', opt.floodTop ?? 95, opt.floodBase ?? 12].join('-') + (opt.weather ? '-w' : '') + (opt.sway ? '-s' + opt.sway : '') + (opt.sag ? '-g' + opt.sag : '');   // tắt weather/sway: key cũ giữ nguyên
  mat.customProgramCacheKey = () => key;
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.uTime = shared.uTime; sh.uniforms.uNight = shared.uNight;
    if (opt.pattern) sh.uniforms.uPattern = opt.pattern;
    if (opt.weather) sh.uniforms.uWet = weatherU.uWet;
    if (opt.sag) sh.uniforms.uSagTp = weatherU.uSagTp;
    if (opt.sway) { sh.uniforms.uSway = SWAY_U[opt.sway]; sh.uniforms.uWindDir = weatherU.uWindDir; }
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vBW;' + (opt.sway ? '\nuniform float uTime; uniform float uSway; uniform vec2 uWindDir;' : '') + (opt.sag ? '\nuniform float uSagTp;' : ''))
      .replace('#include <project_vertex>', (opt.sway ? swayVertex(CONFIG.weather.wind[opt.sway].omega) : '#include <project_vertex>') + (opt.sag ? sagVertex(opt.sag) : ''))
      .replace('#include <fog_vertex>', `#include <fog_vertex>
        { vec4 bw = vec4(transformed, 1.0);
        #ifdef USE_INSTANCING
          bw = instanceMatrix * bw;
        #endif
          vBW = (modelMatrix * bw).xyz; }`);
    let frag = sh.fragmentShader.replace('#include <common>', `#include <common>
      varying vec3 vBW; uniform float uTime; uniform float uNight; ${opt.pattern ? 'uniform float uPattern;' : ''} ${opt.weather ? 'uniform float uWet;' : ''}
      float bpHash(vec3 p){ p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
      float bpNoise(vec3 x){ vec3 i = floor(x), f = fract(x); f = f * f * (3.0 - 2.0 * f);
        return mix(mix(mix(bpHash(i), bpHash(i + vec3(1,0,0)), f.x), mix(bpHash(i + vec3(0,1,0)), bpHash(i + vec3(1,1,0)), f.x), f.y),
                   mix(mix(bpHash(i + vec3(0,0,1)), bpHash(i + vec3(1,0,1)), f.x), mix(bpHash(i + vec3(0,1,1)), bpHash(i + vec3(1,1,1)), f.x), f.y), f.z); }
      vec3 bpPal(float s){ s = fract(s) * 4.0; float i = floor(s), f = smoothstep(0.0, 1.0, fract(s));
        vec3 c0 = ${glslVec3(pal[0])}, c1 = ${glslVec3(pal[1])}, c2 = ${glslVec3(pal[2])}, c3 = ${glslVec3(pal[3])};
        vec3 a = i < 1.0 ? c0 : i < 2.0 ? c1 : i < 3.0 ? c2 : c3;
        vec3 b = i < 1.0 ? c1 : i < 2.0 ? c2 : i < 3.0 ? c3 : c0;
        return mix(a, b, f); }`);
    let after = '';
    if (opt.noise) after += `
        float bpN = bpNoise(vBW * 0.16) * 0.6 + bpNoise(vBW * 0.85) * 0.4;
        diffuseColor.rgb *= 0.86 + 0.22 * bpN;`;
    if (opt.wet) after += `
        { vec3 wetC = vBW.y < -0.4 ? vec3(0.42, 0.44, 0.40) : vec3(0.56, 0.60, 0.52);
          diffuseColor.rgb *= mix(wetC, vec3(1.0), smoothstep(1.7, 2.4, vBW.y)); }`;
    // Mặt ướt: uWet = 0 thì nhánh không chạy (ảnh preset `now` trùng từng điểm ảnh); mặt hướng lên ướt hơn mặt đứng
    if (opt.weather) after += `
        float bpWet = 0.0;
        if (uWet > 0.0) { bpWet = uWet * mix(0.6, 1.0, step(0.0, vBW.y)); diffuseColor.rgb *= 1.0 - ${(1 - CONFIG.weather.wetness.bridgeDarken).toFixed(3)} * bpWet; }`;
    if (after) frag = frag.replace('#include <map_fragment>', `#include <map_fragment>${after}`);
    if (opt.noise) frag = frag.replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>
        roughnessFactor = clamp(roughnessFactor + (bpN - 0.5) * 0.18, 0.0, 1.0);`);
    if (opt.weather) frag = frag.replace('#include <lights_physical_fragment>', `if (uWet > 0.0) roughnessFactor = mix(roughnessFactor, min(roughnessFactor, ${CONFIG.weather.wetness.bridgeRough.toFixed(3)}), bpWet);
        #include <lights_physical_fragment>`);
    if (opt.led) {
      const L = opt.led.toFixed(2), fTop = (opt.floodTop ?? 95).toFixed(1), fBase = (opt.floodBase ?? 12).toFixed(1);
      // originX: sóng chạy ra xa điểm này theo trục X; thêm originZ: theo khoảng cách ngang (dùng cho nhịp quay)
      const coord = opt.originZ !== undefined ? `length(vec2(vBW.x - (${opt.originX.toFixed(1)}), vBW.z - (${opt.originZ.toFixed(1)})))`
        : opt.originX !== undefined ? `abs(vBW.x - (${opt.originX.toFixed(1)}))` : 'vBW.x';
      let body: string;
      if (opt.mode === 1 && !opt.pattern) {          // tháp: đèn hắt từ chân lên, dải màu chạy lên đỉnh
        body = `float s = vBW.y * 0.006 + vBW.x * 0.0025 - uTime * 0.07;
           float flood = 0.35 + 0.65 * smoothstep(${fTop}, ${fBase}, vBW.y);
           float band = 0.75 + 0.25 * sin(vBW.y * 0.25 - uTime * 2.0);
           totalEmissiveRadiance += bpPal(s) * flood * band * uNight * ${L};`;
      } else if (!opt.pattern) {                     // cáp / dải đèn: màu trượt dọc cầu, xung sáng chạy
        body = `float s = ${coord} * 0.0025 - uTime * 0.07;
           float pulse = 0.55 + 0.45 * sin(${coord} * 0.045 - uTime * 2.2);
           totalEmissiveRadiance += bpPal(s) * pulse * uNight * ${L};`;
      } else {                                       // có chọn pattern: 0 tĩnh, 1 chuyển màu chậm, 2 sóng màu chạy dọc dây
        const c = opt.mode === 1 ? 'vBW.y' : coord;
        const flood = opt.mode === 1 ? `0.35 + 0.65 * smoothstep(${fTop}, ${fBase}, vBW.y)` : '1.0';
        body = `float s; float pulse;
           if (uPattern < 0.5) { s = 0.06; pulse = 1.0; }
           else if (uPattern < 1.5) { s = uTime * 0.025; pulse = 1.0; }
           else { s = ${c} * 0.004 - uTime * 0.09; pulse = 0.5 + 0.5 * sin(${c} * 0.06 - uTime * 2.6); }
           totalEmissiveRadiance += bpPal(s) * pulse * (${flood}) * uNight * ${L};`;
      }
      frag = frag.replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>\n{ ${body} }`);
    }
    sh.fragmentShader = frag;
  };
  return mat;
}

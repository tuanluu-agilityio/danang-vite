import * as THREE from 'three';
import { CONFIG } from '../../config';
import { SW } from './profile';
import { SW_PART } from './wheel';
import { SW_LIT } from './structure';
import { HEART_BEAT_PERIOD, HEART_BEAT_GLSL, HEART_STAGE_GLSL, HEART_CYCLE } from '../../environment/riverfront/heartFacade';

/* ===== LED ban đêm của Vòng quay Mặt Trời (giai đoạn 4) =====
   Không thêm mesh, không thêm đèn: vá shader của ba vật liệu sẵn có (chạy SAU bridgePatch, dùng uTime/uNight/vBW của nó),
   cộng vào totalEmissiveRadiance, nhân shared.uNight → ban ngày đóng góp 0, số draw call ngày = đêm.
   - wheel: vành + nan + moay-ơ, đọc aSpoke (0–31 thanh chính, mã âm SW_PART) và aR (0 moay-ơ → 1 vành)
   - cabin: viền LED đỏ hai vòng sát mép dải kính + ánh đỏ vỏ, theo y cục bộ của cabin (trước instanceMatrix)
   - static: aLit — giàn tháp + trục chiếu trắng (mạnh dần về chân), đèn cột quảng trường vàng ấm
   Kiểu show chung một uniform uShow (thứ tự SW.led.shows): 0 trắng, 1 hồng tím, 2 tia chạy, 3 nhịp tim, 4 tắt.
   Nhịp tim đồng bộ LED trái tim riverfront: cùng công thức + cùng shared.uTime (heartFacade.ts, tấm pha 0). */
export const swLedU = { uShow: { value: SW.led.show } };
type Kind = 'wheel' | 'cabin' | 'static';

const L = SW.led, f = (v: number) => v.toFixed(4);
const eq = (code: number) => `(1.0 - step(0.5, abs(vSpoke - (${f(code)}))))`;
const PARS = `
  uniform float uShow;
  float swHeart(){ float t = mod(uTime, ${f(HEART_CYCLE)}), stg = floor(t / 6.0), tb = mod(t, ${f(HEART_BEAT_PERIOD)}); return (${HEART_BEAT_GLSL}) * ${HEART_STAGE_GLSL}; }`;
const VARY: Record<Kind, [string, string, string]> = {   // [khai báo vertex, gán trong vertex, khai báo fragment]
  wheel: ['attribute float aSpoke; attribute float aR; varying float vSpoke; varying float vR;', 'vSpoke = aSpoke; vR = aR;', 'varying float vSpoke; varying float vR;'],
  cabin: ['varying float vCy;', 'vCy = position.y;', 'varying float vCy;'],
  static: ['attribute float aLit; varying float vLit;', 'vLit = aLit;', 'varying float vLit;']
};
const BODY: Record<Kind, string> = {
  wheel: `{
    float isSp = step(-0.5, vSpoke), isRim = ${eq(SW_PART.rim)}, isRing = ${eq(SW_PART.ring)}, isCab = ${eq(SW_PART.cable)}, isHub = ${eq(SW_PART.hub)};
    float lvl = isSp * ${f(L.spoke)} + isRim * ${f(L.rim)} + isRing * ${f(L.ring)} + isCab * ${f(L.cable)} + isHub * ${f(L.hub)};
    vec3 c = vec3(0.0);
    if (uShow < 0.5) c = mix(vec3(1.0, 0.96, 0.9), vec3(1.0, 0.07, 0.05), isRim);                           // trắng, viền vành đỏ
    else if (uShow < 1.5) c = mix(vec3(1.0, 0.22, 0.72), vec3(0.55, 0.22, 1.0), 0.5 + 0.5 * sin(vR * 6.2832 - uTime * ${f(L.pinkWave)}));   // hồng ↔ tím trượt dọc nan
    else if (uShow < 2.5) {                                                                                  // tia chạy từ moay-ơ ra vành, màu đổi theo nan
      float w = fract(vR * ${f(L.rayCount)} - uTime * ${f(L.rayRate)});
      float pulse = smoothstep(0.55, 0.97, w) * (1.0 - smoothstep(0.97, 1.0, w));
      vec3 hue = 0.5 + 0.5 * cos(6.2832 * (max(vSpoke, 0.0) / ${f(SW.spokes)} + uTime * 0.05 + vec3(0.0, 0.33, 0.67)));
      c = mix(vec3(0.55, 0.22, 1.0), hue, isSp) * (0.12 + pulse);
    }
    else if (uShow < 3.5) c = vec3(1.0, 0.165, 0.333) * (${f(L.heartBase)} + swHeart());                    // hồng trái tim, đập cùng nhịp
    totalEmissiveRadiance += c * lvl * uNight;
  }`,
  cabin: `{
    float d = abs(abs(vCy) - ${f(SW.cabin.glass + L.cabinRingW / 2)});
    float ring = 1.0 - smoothstep(${f(L.cabinRingW / 2 - 0.03)}, ${f(L.cabinRingW / 2 + 0.03)}, d);
    float k = uShow < 2.5 ? 1.0 : uShow < 3.5 ? ${f(L.heartBase)} + swHeart() : 0.0;
    totalEmissiveRadiance += vec3(1.0, 0.06, 0.04) * (ring * ${f(L.cabinRing)} + ${f(L.cabinShell)}) * k * uNight;
  }`,
  static: `{
    float fl = uShow < 0.5 ? 1.0 : uShow < 3.5 ? 0.5 : 0.0;
    float up = 0.6 + 0.4 * smoothstep(${f(SW.hubY)}, ${f(CONFIG.landY + SW.baseH)}, vBW.y);                         // đèn hắt từ chân giàn
    vec3 e = vLit > ${f(SW_LIT.lamp - 0.5)} ? vec3(1.0, 0.78, 0.45) * ${f(L.lamp)} : vLit > ${f(SW_LIT.flood - 0.5)} ? vec3(0.9, 0.93, 1.0) * ${f(L.flood)} * fl * up : vec3(0.0);
    totalEmissiveRadiance += e * uNight;
  }`
};

/* Vá LED lên vật liệu đã qua bridgePatch (giữ onBeforeCompile + khóa chương trình cũ, nối thêm) */
export function swLedPatch<M extends THREE.MeshStandardMaterial>(mat: M, kind: Kind): M {
  const prev = mat.onBeforeCompile, key = mat.customProgramCacheKey() + '-swled-' + kind;
  const [vDecl, vSet, fDecl] = VARY[kind];
  mat.customProgramCacheKey = () => key;
  mat.onBeforeCompile = (sh, r) => {
    prev.call(mat, sh, r);
    sh.uniforms.uShow = swLedU.uShow;
    sh.vertexShader = sh.vertexShader.replace('#include <common>', `#include <common>\n${vDecl}`).replace('#include <begin_vertex>', `#include <begin_vertex>\n${vSet}`);
    // khai báo đặt sau mọi phần pars (sau uTime/uNight của bridgePatch), thân cộng sau emissivemap
    sh.fragmentShader = sh.fragmentShader.replace('#include <clipping_planes_pars_fragment>', `#include <clipping_planes_pars_fragment>\n${fDecl}${PARS}`)
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>\n${BODY[kind]}`);
  };
  return mat;
}

/* chỉ số kiểu show từ tên hoặc số; ngoài phạm vi → giữ nguyên */
export function swShowIndex(k: number | string) {
  const i = typeof k === 'number' ? Math.round(k) : (L.shows as readonly string[]).indexOf(k);
  return i >= 0 && i < L.shows.length ? i : -1;
}

import { CONFIG } from '../config';

/* ============================ Shader mặt nước sông Hàn (D-036) ============================
   Thay phần fragment của three/addons Water.js, GIỮ gương phẳng (mirrorSampler, textureMatrix) và mọi uniform cũ
   (waterColor, sunColor, sunDirection, distortionScale, size, time, alpha) vì dayNight.ts, sky.ts, weather/atmosphere.ts, cutaway.ts đang ghi vào chúng.
   Thêm: uNight (vệt đèn đêm, D-023), uRain (gợn mưa, mặt nhám), uStorm (sóng bạc đầu, nước tối).
   - Sóng: 4 lớp pháp tuyến khác tần số, trôi khác hướng; "luồng gió" tần số thấp làm chỗ lặng chỗ gợn.
   - Fresnel thật của nước (F0 = 0,02): nhìn xiên thấy ảnh phản chiếu, nhìn thẳng xuống thấy màu nước.
   - Màu theo độ sâu, tính từ khoảng cách tới kè (sông là kênh thẳng |x| < bankX) và tới bãi biển Mỹ Khê: không cần lượt vẽ độ sâu.
   - Ảnh phản chiếu kéo dài theo chiều đứng như nước gợn thật; độ lệch có trần nên sát camera không còn vỡ ô vuông.
   cutaway.ts chèn mã vào sau chuỗi 'void main() {' và đọc worldPosition: giữ đúng một chuỗi đó và tên varying. */
const W = CONFIG.water, S = CONFIG.cityNight.streak;
const TOE = Math.max(...CONFIG.riverfront.embankment.toe.map((t) => t[0]));   // m — bề rộng chân kè nhô ra sông
const f = (n: number, d = 4) => n.toFixed(d);

export const WATER_FRAGMENT = /* glsl */`
uniform sampler2D mirrorSampler;
uniform float alpha;
uniform float time;
uniform float size;
uniform float distortionScale;
uniform sampler2D normalSampler;
uniform vec3 sunColor;
uniform vec3 sunDirection;
uniform vec3 waterColor;
uniform float uNight;
uniform float uRain;
uniform float uStorm;

varying vec4 mirrorCoord;
varying vec4 worldPosition;

#include <common>
#include <packing>
#include <bsdfs>
#include <fog_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <lights_pars_begin>
#include <shadowmap_pars_fragment>
#include <shadowmask_pars_fragment>

vec2 wvSample( vec2 uv ) { return texture2D( normalSampler, uv ).xy * 2.0 - 1.0; }
float wvHash( vec2 p ) { return fract( sin( dot( p, vec2( 127.1, 311.7 ) ) ) * 43758.5453 ); }
/* Gợn mưa: mỗi ô lưới một vòng tròn lan ra rồi tắt; trả độ dốc mặt nước (xz) */
vec2 wvRipple( vec2 p, float cell, float t ) {
  vec2 id = floor( p / cell ), q = fract( p / cell ) - 0.5;
  float h = wvHash( id ), ph = fract( t * ( 0.9 + h * 0.5 ) + h * 7.0 );
  vec2 c = ( vec2( wvHash( id + 3.1 ), wvHash( id + 7.7 ) ) - 0.5 ) * 0.5;
  vec2 d = q - c; float r = length( d ) + 1e-4, ring = ( r - ph * 0.42 ) * 34.0;
  float w = exp( - ring * ring ) * ( 1.0 - ph ) * step( 0.25, h + uRain );
  return d / r * w * sin( ring * 1.6 );
}

void main() {

  #include <logdepthbuf_fragment>
  vec2 p = worldPosition.xz * ( size / 0.6 );
  vec3 toEye = cameraPosition - worldPosition.xyz;
  float dist = length( toEye );
  vec3 V = toEye / dist;

  // ---- sóng nhiều lớp ----
  vec4 laneT = texture2D( normalSampler, p / 377.0 - time * vec2( 0.0016, -0.0009 ) );                          // luồng gió: chỗ lặng, chỗ gợn (một mẫu, hai kênh)
  float lane = mix( 1.0, smoothstep( ${f(W.lane[0], 3)}, ${f(W.lane[1], 3)}, laneT.r * 0.5 + laneT.g * 0.5 ) * 1.5 + 0.25, ${f(W.laneMix, 2)} * ( 1.0 - uStorm ) );
  float nearK = 1.0 / ( 1.0 + dist / ${f(W.detailFade, 1)} ), midK = 1.0 / ( 1.0 + dist / ${f(W.midFade, 1)} );
  vec2 slopeLo = wvSample( p / ${f(W.scale[0], 1)} + time * vec2( 0.0052, 0.0034 ) ) * ${f(W.amp[0], 3)}
               + wvSample( p / ${f(W.scale[1], 1)} - time * vec2( 0.0095, -0.0061 ) ) * ${f(W.amp[1], 3)};
  vec2 slopeHi = wvSample( p / ${f(W.scale[2], 1)} + time * vec2( -0.021, 0.027 ) ) * ${f(W.amp[2], 3)} * midK
               + wvSample( p / ${f(W.scale[3], 1)} + time * vec2( 0.047, -0.039 ) ) * ${f(W.amp[3], 3)} * nearK;
  float waveK = distortionScale / 2.4;                                                                    // thời tiết ghi distortionScale: nắng 2, mưa 4, bão 7
  slopeLo *= waveK * lane; slopeHi *= waveK * lane;
  vec2 slope = slopeLo + slopeHi;
  if ( uRain > 0.01 ) {
    float rk = uRain * ${f(W.rippleAmp, 3)} / ( 1.0 + dist / ${f(W.rippleFade, 1)} );
    slope += ( wvRipple( worldPosition.xz, ${f(W.rippleCell[0], 2)}, time * 1.7 ) + wvRipple( worldPosition.xz + 13.7, ${f(W.rippleCell[1], 2)}, time * 1.7 + 0.37 ) ) * rk;
    slope += wvSample( worldPosition.xz / 2.3 + time * vec2( 0.11, -0.09 ) ) * uRain * ${f(W.rainRough, 3)} * nearK;   // mặt nhám vì hạt mưa
  }
  vec3 N = normalize( vec3( - slope.x, 1.0, - slope.y ) );

  // ---- ảnh phản chiếu (gương phẳng), kéo dài theo chiều đứng ----
  float dk = ${f(W.distort[0])} + ${f(W.distort[1], 3)} / ( dist + ${f(W.distort[2], 1)} );
  vec2 distortion = ( slopeLo + ( slope - slopeLo ) * ${f(W.distortHi, 2)} ) * vec2( 1.0, ${f(W.stretch, 2)} ) * dk;   // gợn nhỏ chỉ góp một phần: tránh ảnh phản chiếu lấm tấm
  vec3 reflectionSample = vec3( texture2D( mirrorSampler, mirrorCoord.xy / mirrorCoord.w + distortion ) );
  vec3 streakAdd = vec3( 0.0 );
  if ( uNight > 0.85 ) {                                                                                   // vệt đèn dài về đêm (D-023)
    vec3 streak = vec3( 0.0 ); float weight = 0.0;
    for ( int i = 1; i <= ${S.taps}; i ++ ) {
      float t = float( i ) / ${S.taps.toFixed(1)}, w = 1.0 - t * 0.7;
      vec3 c = vec3( texture2D( mirrorSampler, mirrorCoord.xy / mirrorCoord.w + distortion * ( 1.0 + t ) + vec2( 0.0, t * ${f(S.reach)} ) ) );
      streak += max( c - ${f(S.threshold, 3)}, 0.0 ) * w; weight += w;
    }
    streakAdd = streak / weight * ${f(S.gain, 3)} * smoothstep( 0.85, 1.0, uNight );
    reflectionSample += streakAdd;
  }

  // ---- Fresnel ----
  vec3 Nf = normalize( mix( vec3( 0.0, 1.0, 0.0 ), N, ${f(W.fresnelBump, 2)} ) );
  float cosT = max( dot( V, Nf ), 0.0 );
  float fres = ${f(W.f0, 3)} + ( 1.0 - ${f(W.f0, 3)} ) * pow( 1.0 - cosT, 5.0 );
  fres = mix( fres, fres * ${f(W.rainReflect, 2)}, uRain );                                                 // mưa: mặt vỡ, ảnh phản chiếu nhạt đi

  // ---- màu nước theo độ sâu (khoảng cách tới kè / bãi biển) ----
  float ax = abs( worldPosition.x );
  float shore = ax < ${f(CONFIG.bankX, 1)} ? ${f(CONFIG.bankX, 1)} - ax : ( worldPosition.x > 1600.0 ? ( worldPosition.x - 1600.0 ) * ${f(W.beachK, 2)} : 1.0e4 );
  float deepK = smoothstep( 0.0, ${f(W.shoreWidth, 1)}, shore + ( lane - 1.0 ) * 6.0 );
  vec3 shallowCol = waterColor * vec3( ${W.shallow.map((v) => f(v, 2)).join(', ')} ), deepCol = waterColor * vec3( ${W.deep.map((v) => f(v, 2)).join(', ')} );
  vec3 body = mix( shallowCol, deepCol, deepK ) * ( 1.0 + ( lane - 1.0 ) * ${f(W.laneTint, 2)} );
  body = mix( body, vec3( dot( body, vec3( 0.3, 0.55, 0.15 ) ) ), ${f(W.desat, 2)} );                             // sông đô thị: xanh rêu ngả xám, không xanh ngọc bể bơi
  float shadow = getShadowMask();
  float ndl = max( dot( N, sunDirection ), 0.0 );
  vec3 light = sunColor * ( ${f(W.ambient, 2)} + ${f(W.diffuse, 2)} * ndl * shadow );
  body *= light;
  body += waterColor * sunColor * pow( max( dot( V, - reflect( sunDirection, N ) ), 0.0 ), 3.0 ) * ${f(W.scatter, 2)} * shadow;   // ánh xuyên qua lưng sóng
  body = mix( body, body * vec3( ${W.stormTint.map((v) => f(v, 2)).join(', ')} ), uStorm );

  // ---- nắng lấp lánh ----
  vec3 R = reflect( - sunDirection, N );
  float sd = max( dot( V, R ), 0.0 );
  vec3 spec = sunColor * ( pow( sd, ${f(W.glint[0], 1)} ) * ${f(W.glint[1], 2)} + pow( sd, ${f(W.glint[2], 1)} ) * ${f(W.glint[3], 2)} ) * shadow * ( 1.0 - uNight ) * ( 1.0 - 0.8 * uRain );

  vec3 col = mix( body, reflectionSample, clamp( fres, 0.0, 1.0 ) ) + spec * reflectionSample;
  col += streakAdd * max( ${f(S.floor, 2)} - fres, 0.0 );                                                    // vệt đèn có sàn phản xạ riêng: nước gần camera (Fresnel thấp) vẫn thấy vệt như Water.js cũ

  // ---- bọt: mép kè và sóng bạc đầu khi bão ----
  // chỉ lấy mẫu bọt ở nơi có bọt (dải sát kè, hoặc khi bão): textureLod vì lấy mẫu trong nhánh không có đạo hàm ổn định
  float foam = 0.0;
  float shoreF = max( shore - ${f(TOE, 2)}, 0.0 );                                                          // bọt bám mép ngoài chân kè (riverfront/embankment.ts), không nằm dưới bậc đá
  if ( shoreF < ${f(W.foamEdge, 2)} || uStorm > 0.3 ) {
    float lod = clamp( log2( dist * 0.03 ), 0.0, 6.0 );
    float fn = textureLod( normalSampler, worldPosition.xz / 19.0 + time * vec2( 0.012, 0.02 ), lod ).r;
    float edge = ( 1.0 - smoothstep( 0.0, ${f(W.foamEdge, 2)}, shoreF ) ) * smoothstep( 0.35, 0.75, fn + 0.25 * sin( time * 0.9 + worldPosition.z * 0.21 ) );
    float cap = 0.0;
    if ( uStorm > 0.3 ) {
      float fc = textureLod( normalSampler, p * vec2( 1.0, 0.4 ) / 83.0 + time * vec2( 0.017, 0.009 ), lod ).r;
      cap = smoothstep( 0.3, 1.0, uStorm ) * smoothstep( ${f(W.cap[0], 2)}, ${f(W.cap[1], 2)}, fc * 0.75 + textureLod( normalSampler, p / 211.0 - time * vec2( 0.006, 0.003 ), lod ).g * 0.5 ) / ( 1.0 + dist / 900.0 );
    }
    foam = clamp( edge * ${f(W.foamEdgeK, 2)} + cap * ${f(W.capK, 2)}, 0.0, 1.0 );
  }
  col = mix( col, light * vec3( 0.82, 0.86, 0.86 ), foam );

  gl_FragColor = vec4( col, alpha );

  #include <tonemapping_fragment>
  #include <colorspace_fragment>
  #include <fog_fragment>
}`;

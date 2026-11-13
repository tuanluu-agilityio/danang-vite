/* ===== Mặt đất khu phố (D-038, M3): sân, lối lát, bãi cỏ quanh nhà vẽ trong shader của MAT.land =====
   Lưới nhà của buildCity (city.ts) thưa: ô 36 m, nhà 14–29 m, ô đường để trống ⇒ nhìn từ trên là bãi đất phẳng một màu.
   Ở đây vá fragment shader của MAT.land (một lưới đất cho cả hai bờ, river.ts): theo đúng lưới đó vẽ sân quanh từng ô nhà (bê tông / gạch / cỏ / bãi xe,
   chọn bằng băm chỉ số ô) và lối lát ở các ô đường. +0 lệnh vẽ, +0 tam giác, +0 program (chỉ đổi mã của program đã có), không rand().
   Chỉ là màu mặt đất: không phải đường xe (Lái xe không chạy được ở đây nên lối lát không có vạch), không đổi va chạm.
   Gọi một lần trước khung đầu (main.ts, cạnh bkReshape). Thông số: CONFIG.buildings.ground. */
import * as THREE from 'three';
import { CONFIG } from '../../config';
import { MAT } from '../../core/materials';

const v3 = (hex: number) => { const c = new THREE.Color(hex); return `vec3(${c.r.toFixed(4)}, ${c.g.toFixed(4)}, ${c.b.toFixed(4)})`; };   // sRGB → tuyến tính như màu vật liệu
const f = (n: number) => n.toFixed(2);

export function bkPatchGround() {
  if (new URLSearchParams(location.search).get('ground') === 'off') return;   // ?ground=off: mặt đất một màu như cũ (để đo A/B)
  const G = CONFIG.buildings.ground, B = CONFIG.bankX, mat = MAT.land;
  mat.customProgramCacheKey = () => 'land-lots';
  mat.onBeforeCompile = (sh) => {
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec2 vGW;')
      .replace('#include <fog_vertex>', '#include <fog_vertex>\n  vGW = (modelMatrix * vec4(transformed, 1.0)).xz;');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>
      varying vec2 vGW;
      float bgHash(vec2 p){ p = fract(p * vec2(0.1031, 0.1030)); p += dot(p, p.yx + 33.33); return fract((p.x + p.y) * p.y); }
      float bgBox(vec2 p, vec2 hs, float w){ vec2 d = smoothstep(hs + w, hs - w, abs(p)); return d.x * d.y; }   // 1 trong hình chữ nhật, mép mềm w`)
      .replace('#include <color_fragment>', `#include <color_fragment>
      if (vGW.y > -1818.0 && vGW.y < 1782.0) {                                   // dải Z của buildCity (gz −1800 … 1764, ô ±18)
        float gx = vGW.x, west = step(-2018.0, gx) * step(gx, -326.0), east = step(322.0, gx) * step(gx, 1438.0);
        float pw = max(fwidth(vGW.x), fwidth(vGW.y)), amp = 1.0 - smoothstep(${f(G.fade[0])}, ${f(G.fade[1])}, pw), w = pw * 0.75 + 0.05;
        if (west + east > 0.5 && amp > 0.0) {
          float ox = west > 0.5 ? 2000.0 : -340.0, oi = west > 0.5 ? -56.0 : 9.0;   // city.ts: gx = −2000 + 36k (ix = k − 56) và 340 + 36k (ix = k + 9)
          vec2 k = floor(vec2(gx + ox, vGW.y) / 36.0 + 0.5), p = vec2(gx + ox, vGW.y) - k * 36.0, id = k + vec2(oi, 0.0);
          bool sx = abs(mod(id.x + 0.5, 5.0) - 0.5) < 0.25, sz = abs(mod(id.y + 0.5, 5.0) - 0.5) < 0.25;
          vec3 col = diffuseColor.rgb;
          if (sx || sz) {                                                         // ô đường: lối lát chạy giữa ô, bó vỉa hai mép
            float dl = min(sx ? abs(p.x) : 99.0, sz ? abs(p.y) : 99.0), hl = ${f(G.lane / 2)};
            col = mix(col, ${v3(G.kerb)}, smoothstep(hl + 0.7 + w, hl + 0.7 - w, dl));
            col = mix(col, ${v3(G.laneCol)}, smoothstep(hl + w, hl - w, dl));
          } else {                                                                // ô nhà: sân quanh nhà, loại theo băm ô
            float h = bgHash(id + 71.0), m = bgBox(p, vec2(${f(G.lot / 2)}), w);
            vec3 c = h < ${f(G.mix[0])} ? ${v3(G.yard)} : h < ${f(G.mix[1])} ? ${v3(G.tile)} : h < ${f(G.mix[2])} ? ${v3(G.grass)} : ${v3(G.park)};
            if (h >= ${f(G.mix[0])} && h < ${f(G.mix[1])}) { vec2 t = abs(fract(p / 3.0) - 0.5); c *= 1.0 - 0.10 * amp * smoothstep(0.47 - w / 3.0, 0.5, max(t.x, t.y)); }   // mạch gạch 3 m
            if (h >= ${f(G.mix[2])}) { float s = abs(fract(p.x / 2.6) - 0.5); c = mix(c, vec3(0.75), 0.6 * amp * smoothstep(0.47 - w / 2.6, 0.5, s) * step(4.0, abs(p.y)) * step(abs(p.y), 9.5)); }   // vạch ô đỗ
            col = mix(col, c, m);
          }
          diffuseColor.rgb = mix(diffuseColor.rgb, col, amp);
        }
        float dq = abs(gx) - ${f(B)};                                             // dải giữa kè và hàng nhà đầu: vỉa hè (đường ven sông và dải đi bộ nằm đè lên trên)
        if (dq > 0.0 && dq < (gx < 0.0 ? ${f(326 - B)} : ${f(322 - B)})) diffuseColor.rgb = mix(diffuseColor.rgb, ${v3(G.walk)}, 0.85);
      }`);
  };
}

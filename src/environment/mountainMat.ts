import * as THREE from 'three';
import { CONFIG } from '../config';
import { rng } from '../common/math';
import { canvasTex } from '../core/textures';

/* ============================ Vật liệu núi rừng (D-047) ============================
   Màu nền + độ khuất nằm trong màu đỉnh (mountainGeo.ts). Shader thêm vân tán rừng lấy theo tọa độ thế giới xz
   ở ba tỉ lệ (tán cây, cụm tán, mảng sắc độ) từ một texture canvas lát được, và nghiêng pháp tuyến theo vân
   để tán bắt nắng. Mipmap lo phần răng cưa khi nhìn xa. Đá (aRock) thì giảm vân. Sương: scene.fog sẵn có. */

/* R: độ cao tán (đốm tròn chồng nhau, sáng ở đỉnh tán); G: nhiễu mảng lớn. Vẽ lặp qua mép để lát liền. */
function stCanopyTexture() {
  const S = 512, rnd = rng(47047);
  const t = canvasTex(S, S, (g) => {
    g.fillStyle = '#000'; g.fillRect(0, 0, S, S); g.globalCompositeOperation = 'lighter';
    const blob = (x: number, y: number, r: number, css: string) => {
      for (const ox of [-S, 0, S]) for (const oy of [-S, 0, S]) {
        if (x + ox + r < 0 || x + ox - r > S || y + oy + r < 0 || y + oy - r > S) continue;
        const gr = g.createRadialGradient(x + ox - r * 0.2, y + oy - r * 0.2, 0, x + ox, y + oy, r);
        gr.addColorStop(0, css); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gr; g.fillRect(x + ox - r, y + oy - r, 2 * r, 2 * r);
      }
    };
    for (let i = 0; i < 1500; i++) blob(rnd() * S, rnd() * S, 7 + rnd() * 13, `rgba(${Math.round(70 + rnd() * 110)},0,0,1)`);   // tán cây
    for (let i = 0; i < 46; i++) blob(rnd() * S, rnd() * S, 40 + rnd() * 90, `rgba(0,${Math.round(40 + rnd() * 70)},0,1)`);      // mảng sắc độ
  });
  t.colorSpace = THREE.NoColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

export function mtMaterial() {
  const T = CONFIG.sonTra, f = (n: number) => n.toFixed(4);
  const m = new THREE.MeshStandardMaterial({ color: 0xffffff, vertexColors: true, roughness: 1, metalness: 0 });
  const uTex = { value: stCanopyTexture() };
  m.customProgramCacheKey = () => 'mountainForest';
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uMtTex = uTex;
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nattribute float aRock;\nvarying vec3 vMtPos;\nvarying float vMtRock;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\n  vMtPos = (modelMatrix * vec4(transformed, 1.0)).xyz; vMtRock = aRock;');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform sampler2D uMtTex;\nvarying vec3 vMtPos;\nvarying float vMtRock;')
      .replace('#include <color_fragment>', `#include <color_fragment>
  vec2 mtQ = vMtPos.xz; float mtVeg = 1.0 - vMtRock;
  vec2 mtU1 = mtQ / ${f(T.tile[0])}, mtU2 = mtQ.yx / ${f(T.tile[1])} + 0.37;
  float mtC1 = texture2D(uMtTex, mtU1).r, mtC2 = texture2D(uMtTex, mtU2).r, mtC3 = texture2D(uMtTex, mtQ / ${f(T.tile[2])} + 0.11).g;
  float mtCan = mtC2 * 0.62 + mtC1 * 0.38;
  diffuseColor.rgb *= mix(1.0, mix(${f(T.canopyTone[0])}, ${f(T.canopyTone[1])}, smoothstep(0.08, 0.95, mtCan)), mtVeg * 0.9 + 0.1);
  diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * vec3(1.45, 1.2, 0.62), clamp((mtC3 - 0.42) * 2.2, 0.0, 1.0) * ${f(T.hueAmp)} * mtVeg);`)
      .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
  {
    float e2 = 6.0 / ${f(T.tile[1])}, e1 = 1.6 / ${f(T.tile[0])};
    vec2 mtG = vec2(texture2D(uMtTex, mtU2 + vec2(e2, 0.0)).r - mtC2, texture2D(uMtTex, mtU2 + vec2(0.0, e2)).r - mtC2) * 0.62
             + vec2(texture2D(uMtTex, mtU1 + vec2(e1, 0.0)).r - mtC1, texture2D(uMtTex, mtU1 + vec2(0.0, e1)).r - mtC1) * 0.38;
    // mtU2 lấy theo (z, x) nên đổi chỗ gradient của lớp cụm tán: gần đúng là đủ cho vân rừng
    normal = normalize(normal - (viewMatrix * vec4(mtG.x, 0.0, mtG.y, 0.0)).xyz * ${f(T.canopyBump)} * mtVeg);
  }`);
  };
  return m;
}

import * as THREE from 'three';
import { CONFIG } from '../../config';
import { shared } from '../../core/shared';
import { clamp, lerp } from '../../common/math';
import type { Tower } from './landmarks';

/* [heartFacade] Mặt dựng LED hình trái tim + chữ "DN" trên hai tòa nhìn ra sông.
   Một canvas mặt nạ (R: trái tim đặc, G: chữ DN, B: viền tim) + fragment shader: lưới chấm LED 0,8 m, hoạt cảnh chu kỳ 24 s
   (tim đập → DN hiện dần → tim bọc DN, viền chạy sáng → lấp lánh). Cả hai tấm gộp một mesh/một material; pha từng tấm là attribute. */
const H = CONFIG.riverfront, HC = H.heart;
const HEART_C = new THREE.Vector2(0.5, 0.8);        // tâm trái tim trong tọa độ UV của tấm

/* Mặt nạ: tấm cao hơn rộng nên vẽ theo mét (px/m đều hai trục) để trái tim không méo */
function maskTexture(panelW: number, panelH: number) {
  const pxm = 8, W = Math.round(panelW * pxm), Hh = Math.round(panelH * pxm);
  const c = document.createElement('canvas'); c.width = W; c.height = Hh;
  const g = c.getContext('2d');
  g.fillStyle = '#000'; g.fillRect(0, 0, W, Hh);
  g.globalCompositeOperation = 'lighter';
  const cx = HEART_C.x * W, cy = (1 - HEART_C.y) * Hh, s = 15.6 * pxm;
  const heart = () => {
    g.beginPath(); g.moveTo(cx, cy + 0.95 * s);
    g.bezierCurveTo(cx - 1.3 * s, cy + 0.1 * s, cx - 1.05 * s, cy - 1.0 * s, cx, cy - 0.42 * s);
    g.bezierCurveTo(cx + 1.05 * s, cy - 1.0 * s, cx + 1.3 * s, cy + 0.1 * s, cx, cy + 0.95 * s); g.closePath();
  };
  g.fillStyle = '#ff0000'; heart(); g.fill();
  g.strokeStyle = '#0000ff'; g.lineWidth = 1.6 * pxm; heart(); g.stroke();
  g.fillStyle = '#00ff00'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.font = `900 ${Math.round(9.5 * pxm)}px "Arial Black", "Be Vietnam Pro", Arial, sans-serif`;
  g.fillText('DN', cx, cy - 0.06 * s);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.NoColorSpace; t.minFilter = THREE.LinearFilter; t.generateMipmaps = false;
  return t;
}
const frag = `
  uniform sampler2D uMask; uniform float uNight, uTime, uOn, uLevel; uniform vec2 uGrid, uSize, uHc;
  varying vec2 vUv; varying float vPhase;
  float h21(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  void main(){
    vec2 g = vUv * uGrid, id = floor(g), f = fract(g) - 0.5, cuv = (id + 0.5) / uGrid;
    float t = mod(uTime + vPhase, ${HC.cycle.toFixed(1)}), stg = floor(t / 6.0), k = fract(t / 6.0);
    float tb = mod(t, 1.5);                                                   // nhịp thình thịch: hai nhịp gần nhau rồi nghỉ
    float beat = exp(-pow((tb - 0.12) / 0.09, 2.0)) + 0.8 * exp(-pow((tb - 0.42) / 0.09, 2.0));
    float s = 1.0 + ${HC.beat.toFixed(3)} * beat * (stg < 0.5 ? 1.0 : stg < 2.5 ? 0.4 : 0.0);
    vec2 p = (cuv - uHc) / s + uHc;
    vec3 m = texture2D(uMask, p).rgb;
    float fill = m.r, dn = m.g, edge = m.b;
    float fa = 0.0, da = 0.0, ea = 0.0, spark = 0.0;
    if (stg < 0.5) { fa = fill; ea = edge * 0.6; }
    else if (stg < 1.5) { fa = fill * 0.22; ea = edge * 0.5; da = dn * smoothstep(0.0, 0.04, (k * 1.15 - 0.08) - (p.x - 0.28) / 0.44); }   // DN quét từ trái sang phải
    else if (stg < 2.5) {
      vec2 dv = (p - uHc) * uSize; float ang = atan(dv.y, dv.x) / 6.2832 + 0.5;
      float head = smoothstep(0.3, 0.0, fract(ang - k * 2.0));
      fa = fill * 0.9; da = dn; ea = edge * (0.45 + 0.9 * head);
    } else {
      fa = fill * (1.0 - k); da = dn * (1.0 - k); ea = edge * (1.0 - k) * 0.6;
      spark = step(0.9 - 0.1 * (1.0 - k), h21(id + floor(t * 9.0))) * (1.0 - 0.7 * k);
    }
    vec3 pink = mix(vec3(1.0, 0.165, 0.333), vec3(1.0, 0.478, 0.659), smoothstep(HC_LO, HC_HI, cuv.y));
    vec3 col = pink * (fa + ea) + vec3(1.0, 0.93, 0.88) * da * 1.1 + pink * spark * 0.85;
    float d = length(f), aa = fwidth(d) * 1.2;
    float dotM = 1.0 - smoothstep(0.36 - aa, 0.36 + aa, d);                    // chấm tròn; ở xa tự hòa thành hình liền
    float day = mix(${HC.dayLevel.toFixed(3)}, 1.0, uNight);                    // ban ngày ≤ 5% so với ban đêm
    vec3 outC = vec3(0.018, 0.022, 0.03) + col * dotM * day * uLevel * uOn;
    gl_FragColor = vec4(outC, 1.0);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }`.replace('HC_LO', (HEART_C.y - 0.15).toFixed(3)).replace('HC_HI', (HEART_C.y + 0.15).toFixed(3));
const vert = `
  attribute float aPhase; varying vec2 vUv; varying float vPhase;
  void main(){ vUv = uv; vPhase = aPhase; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;

export interface Hearts {
  mesh: THREE.Mesh; material: THREE.ShaderMaterial;
  enabled: boolean; mode: 'duet' | 'sync';
  panels: { name: string; center: THREE.Vector3; normal: THREE.Vector3; uAxis: THREE.Vector3 }[];
  brightness(night: number): number; update(dt: number): void; setEnabled(on: boolean): void; setMode(m: 'duet' | 'sync'): void; dispose(): void;
}
export function buildHearts(towers: Tower[]): Hearts {
  const geos: THREE.BufferGeometry[] = [], panels: Hearts['panels'] = [];
  const Hh = Math.min(...towers.map((t) => t.h)) * HC.panelFrac, pw = HC.panelW;
  const phases: number[] = [];
  towers.forEach((t) => {
    const g = new THREE.PlaneGeometry(pw, Hh);                       // mặt trước hướng +z, trục U chạy sang phải khi nhìn trực diện
    g.rotateY(t.face > 0 ? Math.PI / 2 : -Math.PI / 2);                // quay về +X (Novotel) hoặc −X (Vinpearl): nhìn từ sông, U luôn sang phải
    const cx = t.x + t.face * (t.w / 2 + HC.gap), cy = CONFIG.landY + t.h - Hh / 2 - 3;
    g.translate(cx, cy, t.z);
    geos.push(g); phases.push(t.name === 'vinpearl' ? HC.duetOffset : 0);
    panels.push({ name: t.name, center: new THREE.Vector3(cx, cy, t.z), normal: new THREE.Vector3(t.face, 0, 0), uAxis: new THREE.Vector3(0, 0, -t.face) });
  });
  const pos: number[] = [], uv: number[] = [], idx: number[] = [], ph: number[] = [];
  geos.forEach((g, i) => { const base = pos.length / 3; pos.push(...(g.attributes.position.array as Float32Array)); uv.push(...(g.attributes.uv.array as Float32Array)); const ix = g.index.array; for (let k = 0; k < ix.length; k++) idx.push(ix[k] + base); for (let k = 0; k < g.attributes.position.count; k++) ph.push(phases[i]); });
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); geo.setAttribute('aPhase', new THREE.Float32BufferAttribute(ph, 1)); geo.setIndex(idx);
  const mask = maskTexture(pw, Hh);
  const material = new THREE.ShaderMaterial({
    uniforms: { uMask: { value: mask }, uNight: shared.uNight, uTime: shared.uTime, uOn: { value: 1 }, uLevel: { value: HC.intensity },
      uGrid: { value: new THREE.Vector2(Math.round(pw / HC.cell), Math.round(Hh / HC.cell)) }, uSize: { value: new THREE.Vector2(pw, Hh) }, uHc: { value: HEART_C } },
    vertexShader: vert, fragmentShader: frag, fog: false
  });
  const mesh = new THREE.Mesh(geo, material); mesh.name = 'rf-hearts'; mesh.frustumCulled = false;
  const api: Hearts = {
    mesh, material, enabled: true, mode: 'duet', panels,
    /* độ sáng LED (0..1, chưa nhân cường độ) theo độ tối của trời và công tắc: ban ngày ≤ dayLevel */
    brightness(night) { return lerp(HC.dayLevel, 1, night) * material.uniforms.uOn.value; },
    update(dt) { const u = material.uniforms.uOn; u.value = lerp(u.value, api.enabled ? 1 : 0, clamp(dt * 4, 0, 1)); if (!api.enabled && u.value < 0.002) u.value = 0; },
    setEnabled(on) { api.enabled = on; },
    setMode(m) {
      api.mode = m; const a = geo.attributes.aPhase as THREE.BufferAttribute; let k = 0;
      towers.forEach((t) => { const v = m === 'duet' && t.name === 'vinpearl' ? HC.duetOffset : 0; for (let q = 0; q < 4; q++) a.setX(k++, v); });
      a.needsUpdate = true;
    },
    dispose() { geo.dispose(); material.dispose(); mask.dispose(); mesh.removeFromParent(); }
  };
  return api;
}

import * as THREE from 'three';
import { CONFIG } from '../../config';
import { scene } from '../../core/renderer';
import { pScale, windFx, weatherFx } from '../../core/shared';
import { fireLight } from '../../core/lights';
import { rand, lerp } from '../../common/math';
import { t as tr } from '../../i18n';
import { headGroup, whiskerGroup, MOUTH_LOCAL } from './head';

/* ============================ Lửa & nước ============================ */
const particleVert = `attribute float aSize; attribute float aAlpha; attribute vec3 aColor; uniform float uScale;
  varying float vA; varying vec3 vC;
  void main(){ vC = aColor; vA = aAlpha; vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_PointSize = aSize * uScale / max(-mv.z, 0.5); gl_Position = projectionMatrix * mv; }`;
const particleFrag = `varying float vA; varying vec3 vC;
  void main(){ float r = length(gl_PointCoord - 0.5); float a = smoothstep(0.5, 0.0, r); a *= a;
    gl_FragColor = vec4(vC, a * vA);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }`;

interface Particles {
  n: number; pos: Float32Array; vel: Float32Array; col: Float32Array; size: Float32Array; alpha: Float32Array;
  life: Float32Array; max: Float32Array; kind: Uint8Array; next: number; acc: number; points?: THREE.Points;
}
function makeParticles(n: number, blending: THREE.Blending): Particles {
  const g = new THREE.BufferGeometry();
  const sys: Particles = { n, pos: new Float32Array(n * 3), vel: new Float32Array(n * 3), col: new Float32Array(n * 3), size: new Float32Array(n), alpha: new Float32Array(n), life: new Float32Array(n), max: new Float32Array(n), kind: new Uint8Array(n), next: 0, acc: 0 };
  g.setAttribute('position', new THREE.BufferAttribute(sys.pos, 3).setUsage(THREE.DynamicDrawUsage));
  g.setAttribute('aColor', new THREE.BufferAttribute(sys.col, 3).setUsage(THREE.DynamicDrawUsage));
  g.setAttribute('aSize', new THREE.BufferAttribute(sys.size, 1).setUsage(THREE.DynamicDrawUsage));
  g.setAttribute('aAlpha', new THREE.BufferAttribute(sys.alpha, 1).setUsage(THREE.DynamicDrawUsage));
  const mat = new THREE.ShaderMaterial({ uniforms: { uScale: pScale }, vertexShader: particleVert, fragmentShader: particleFrag, transparent: true, depthWrite: false, blending, toneMapped: blending !== THREE.AdditiveBlending });
  sys.points = new THREE.Points(g, mat); sys.points.frustumCulled = false;
  scene.add(sys.points);
  return sys;
}
let fire: Particles, waterJet: Particles;
export function createFire() { fire = makeParticles(CONFIG.fireCount, THREE.AdditiveBlending); }
export function createWaterJet() { waterJet = makeParticles(CONFIG.waterCount, THREE.NormalBlending); }

/* vị trí miệng rồng (thế giới) — âm thanh trình diễn to nhỏ theo khoảng cách camera tới đây */
export const mouthW = new THREE.Vector3();
const fwd = new THREE.Vector3();
function emit(sys: Particles, count: number, init: (s: Particles, i: number) => void) {
  for (let c = 0; c < count; c++) { const i = sys.next; sys.next = (sys.next + 1) % sys.n; init(sys, i); }
}

/* Trình diễn phun lửa (9 lần) rồi phun nước, lặp theo CONFIG.showCycle */
export const show = { on: false, t: 0, fireOn: false, waterOn: false, key: 'sOff', args: null as Record<string, number> | null };
export const showLabel = () => tr(show.key, show.args);
export function updateShow(dt: number) {
  if (!show.on) { show.fireOn = show.waterOn = false; show.key = 'sOff'; show.args = null; return; }
  if (!weatherFx.showAllowed) { show.fireOn = show.waterOn = false; show.key = 'sWeather'; show.args = null; return; }   // mưa to / gió mạnh / bão: tạm dừng, show.on (nút người dùng) giữ nguyên
  show.t = (show.t + dt) % CONFIG.showCycle;
  const t = show.t;
  show.fireOn = t < 27 && (t % 3) < 1.6;
  show.waterOn = t >= 27 && t < 42;
  if (t < 27) { show.key = 'sFire'; show.args = { n: Math.floor(t / 3) + 1 }; }
  else if (t < 42) { show.key = 'sWater'; show.args = null; }
  else { show.key = 'sRest'; show.args = { s: Math.ceil(CONFIG.showCycle - t) }; }
}
export function updateEffects(dt: number, time: number) {
  headGroup.updateMatrixWorld();
  mouthW.copy(MOUTH_LOCAL).applyMatrix4(headGroup.matrixWorld);
  fwd.set(1, 0, 0).applyQuaternion(headGroup.quaternion);
  const W = CONFIG.weather.wind, windOn = windFx.x !== 0 || windFx.z !== 0;   // gió thời tiết (mặc định 0: không đổi gì, không thêm rand())
  // Lửa
  if (show.fireOn) {
    fire.acc += dt * 520; const n = Math.floor(fire.acc); fire.acc -= n;
    emit(fire, n, (s, i) => {
      const sp = 18 + rand() * 9;
      s.pos[i * 3] = mouthW.x + rand() - 0.5; s.pos[i * 3 + 1] = mouthW.y + rand() - 0.5; s.pos[i * 3 + 2] = mouthW.z + rand() - 0.5;
      s.vel[i * 3] = fwd.x * sp + (rand() - 0.5) * 4; s.vel[i * 3 + 1] = fwd.y * sp + 1.5 + (rand() - 0.5) * 4; s.vel[i * 3 + 2] = (rand() - 0.5) * 4;
      s.life[i] = 0; s.max[i] = 0.45 + rand() * 0.55;
    });
  }
  for (let i = 0; i < fire.n; i++) {
    if (fire.life[i] >= fire.max[i]) { fire.alpha[i] = 0; fire.size[i] = 0; continue; }
    fire.life[i] += dt; const t = Math.min(fire.life[i] / fire.max[i], 1), drag = 1 - 1.4 * dt;
    fire.vel[i * 3] *= drag; fire.vel[i * 3 + 2] *= drag; fire.vel[i * 3 + 1] = fire.vel[i * 3 + 1] * drag + 9 * dt;
    if (windOn) { fire.vel[i * 3] += windFx.x * W.fire * dt; fire.vel[i * 3 + 2] += windFx.z * W.fire * dt; }   // lửa bị gió đánh dạt
    for (let a = 0; a < 3; a++) fire.pos[i * 3 + a] += fire.vel[i * 3 + a] * dt;
    let r: number, g: number, b: number;
    if (t < 0.25) { const k = t / 0.25; r = 1; g = lerp(0.95, 0.55, k); b = lerp(0.6, 0.12, k); }
    else { const k = (t - 0.25) / 0.75; r = lerp(1, 0.7, k); g = lerp(0.55, 0.1, k); b = lerp(0.12, 0.03, k); }
    fire.col[i * 3] = r * 0.9; fire.col[i * 3 + 1] = g * 0.75; fire.col[i * 3 + 2] = b * 0.6;
    fire.alpha[i] = 0.55 * Math.pow(1 - t, 1.3); fire.size[i] = 1.6 + 7.5 * t;
  }
  // Nước + sương
  if (show.waterOn) {
    waterJet.acc += dt * 300; const n = Math.floor(waterJet.acc); waterJet.acc -= n;
    emit(waterJet, n, (s, i) => {
      const mist = rand() < 0.25; s.kind[i] = mist ? 1 : 0;
      const sp = mist ? 8 + rand() * 5 : 26 + rand() * 6;
      s.pos[i * 3] = mouthW.x; s.pos[i * 3 + 1] = mouthW.y; s.pos[i * 3 + 2] = mouthW.z;
      s.vel[i * 3] = fwd.x * sp + (rand() - 0.5) * 2.5; s.vel[i * 3 + 1] = sp * 0.42 + (rand() - 0.5) * 2.5; s.vel[i * 3 + 2] = (rand() - 0.5) * (mist ? 6 : 2.5);
      s.life[i] = 0; s.max[i] = mist ? 2.2 + rand() : 2.6 + rand() * 0.8;
    });
  }
  const ground = CONFIG.roadY + 0.2;
  for (let i = 0; i < waterJet.n; i++) {
    if (waterJet.life[i] >= waterJet.max[i] || waterJet.pos[i * 3 + 1] < ground) { waterJet.alpha[i] = 0; waterJet.size[i] = 0; waterJet.life[i] = waterJet.max[i]; continue; }
    waterJet.life[i] += dt; const t = waterJet.life[i] / waterJet.max[i], mist = waterJet.kind[i] === 1;
    const drag = 1 - (mist ? 1.2 : 0.08) * dt;
    waterJet.vel[i * 3] *= drag; waterJet.vel[i * 3 + 2] *= drag;
    waterJet.vel[i * 3 + 1] = waterJet.vel[i * 3 + 1] * drag - (mist ? 1.5 : 9.8) * dt;
    if (windOn) { const k = (mist ? W.mist : W.water) * dt; waterJet.vel[i * 3] += windFx.x * k; waterJet.vel[i * 3 + 2] += windFx.z * k; }   // tia nước lệch, sương bay xa theo gió
    for (let a = 0; a < 3; a++) waterJet.pos[i * 3 + a] += waterJet.vel[i * 3 + a] * dt;
    waterJet.col[i * 3] = mist ? 0.9 : 0.62; waterJet.col[i * 3 + 1] = mist ? 0.95 : 0.84; waterJet.col[i * 3 + 2] = 1.0;
    waterJet.alpha[i] = mist ? 0.22 * (1 - t) : 0.75 * (1 - t * 0.6); waterJet.size[i] = mist ? 4 + 6 * t : 0.9 + 0.6 * t;
  }
  for (const s of [fire, waterJet]) {
    const a = s.points.geometry.attributes;
    a.position.needsUpdate = a.aColor.needsUpdate = a.aSize.needsUpdate = a.aAlpha.needsUpdate = true;
  }
  // Ánh lửa hắt sáng xung quanh
  fireLight.position.copy(mouthW).addScaledVector(fwd, 7);
  fireLight.intensity = show.fireOn ? 380 * (0.75 + 0.25 * Math.sin(time * 37) * Math.sin(time * 23)) : Math.max(0, fireLight.intensity - dt * 1500);
  // Râu rồng đung đưa (mạnh hơn theo gió; windFx.whisker mặc định 1)
  whiskerGroup.rotation.x = Math.sin(time * 1.3) * 0.06 * windFx.whisker;
  whiskerGroup.rotation.y = Math.sin(time * 0.9) * 0.05 * windFx.whisker;
}

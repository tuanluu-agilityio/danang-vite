import * as THREE from 'three';
import { CONFIG } from '../../config';
import { rng } from '../../common/math';
import { scene, renderer, camera } from '../../core/renderer';
import { composer } from '../../core/postprocessing';
import { shared } from '../../core/shared';

/* ===== [weather] Mưa (mục 4.3): MỘT InstancedMesh vệt mưa — +1 draw call khi mưa, 0 khi tạnh =====
   Vị trí gốc sinh một lần bằng rng(seed + 2) trong hộp quanh camera; vertex shader tự rơi/xiên theo gió và gói vòng quanh camera
   (không cập nhật buffer mỗi khung, CPU chỉ cộng dồn độ dời uOffset). Số vệt hiện = mesh.count = round(N · mưa · bậc chất lượng).
   Chống overdraw (D-010): bỏ vệt gần hơn perf.rainNear ngay trong vertex shader, mờ dần tới perf.rainFadeFar, giới hạn pixelRatio khi mưa,
   tự hạ chất lượng khi FPS thấp (tắt với ?test). Layer 1 (không vào phản chiếu), không đổ bóng. Tắt khi camera trong hầm / dưới nước. */
const isTest = new URLSearchParams(location.search).has('test');
const VERT = /* glsl */ `
  attribute vec4 aP0;
  uniform vec3 uOffset; uniform vec3 uBox; uniform vec3 uDir; uniform float uLen; uniform float uWidth; uniform float uNear; uniform float uFar; uniform float uAlpha;
  varying float vA;
  void main() {
    vec3 c = cameraPosition;
    vec3 p = mod(aP0.xyz + uOffset - c, uBox) - uBox * 0.5 + c;      // gói vòng quanh camera: hạt cố định theo thế giới, không nhảy khi camera đi
    vec3 v = p - c; float d = length(v);
    if (d < uNear) { gl_Position = vec4(2.0, 2.0, 2.0, 1.0); vA = 0.0; return; }   // vệt sát mắt: ra ngoài clip space, không tô pixel nào
    vec3 side = normalize(cross(uDir, v)); float len = uLen * (0.55 + 0.45 * aP0.w);
    vec3 w = p + uDir * position.y * len + side * position.x * uWidth;
    vA = uAlpha * (1.0 - smoothstep(uFar * 0.35, uFar, d)) * (0.6 + 0.4 * aP0.w) * (position.y + 0.5);   // mờ theo xa; đầu vệt nhạt
    gl_Position = projectionMatrix * viewMatrix * vec4(w, 1.0);
  }`;
const FRAG = /* glsl */ `
  uniform vec3 uColor; uniform float uNight;
  varying float vA;
  void main() {
    gl_FragColor = vec4(uColor * (1.0 - 0.7 * uNight) + vec3(0.06, 0.05, 0.03) * uNight, vA);   // đêm: tối theo cảnh, cộng nhẹ ánh đèn vàng
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }`;

export interface Rain { mesh: THREE.InstancedMesh; setCount: (n: number) => void; quality: () => number }
let rain: (Rain & { u: Record<string, THREE.IUniform>; n: number; offset: THREE.Vector3; step: number; fpsT: number; fpsN: number }) | null = null;

export function buildRain(): Rain {
  const R = CONFIG.weather.rain, L = CONFIG.weather.rainLook, P = CONFIG.weather.perf, rnd = rng(CONFIG.weather.seed + 2);
  const quad = new THREE.PlaneGeometry(1, 1);
  const p0 = new Float32Array(R.count * 4);
  for (let i = 0; i < R.count; i++) { p0[i * 4] = rnd() * R.box[0]; p0[i * 4 + 1] = rnd() * R.box[1]; p0[i * 4 + 2] = rnd() * R.box[2]; p0[i * 4 + 3] = rnd(); }
  quad.setAttribute('aP0', new THREE.InstancedBufferAttribute(p0, 4));
  const u = {
    uOffset: { value: new THREE.Vector3() }, uBox: { value: new THREE.Vector3(...R.box) }, uDir: { value: new THREE.Vector3(0, -1, 0) },
    uLen: { value: R.len }, uWidth: { value: L.width }, uNear: { value: P.rainNear }, uFar: { value: P.rainFadeFar }, uAlpha: { value: L.alpha },
    uColor: { value: new THREE.Color(L.color) }, uNight: shared.uNight
  };
  const mat = new THREE.ShaderMaterial({ uniforms: u, vertexShader: VERT, fragmentShader: FRAG, transparent: true, depthWrite: false, fog: false });
  const mesh = new THREE.InstancedMesh(quad, mat, R.count);    // instanceMatrix không dùng (vị trí ở aP0), để nguyên đơn vị
  mesh.name = 'wx-rain'; mesh.frustumCulled = false; mesh.castShadow = false; mesh.receiveShadow = false; mesh.layers.set(1); mesh.renderOrder = 2;
  mesh.count = 0; mesh.visible = false; scene.add(mesh);
  // Biên dịch sẵn program (tránh khựng lần đầu mưa): tạm hiện rồi ẩn lại. Hai biến thể: vẽ thẳng ra canvas (ban ngày) và vào render target của composer (bloom ban đêm)
  const rt = renderer.getRenderTarget();
  mesh.visible = true; mesh.count = 1;
  renderer.setRenderTarget(null); renderer.compile(mesh, camera, scene);
  renderer.setRenderTarget(composer.readBuffer); renderer.compile(mesh, camera, scene);
  renderer.setRenderTarget(rt); mesh.visible = false; mesh.count = 0;
  rain = {
    mesh, u, n: R.count, offset: u.uOffset.value, step: 0, fpsT: 0, fpsN: 0,
    setCount(n: number) { rain.n = Math.max(0, Math.min(R.count, Math.round(n))); },
    quality: () => rain.step
  };
  return rain;
}

/* Mưa đang hiện (bộ quản lý chất lượng giới hạn pixelRatio ở CONFIG.perf.rainMaxRatio khi mưa, D-018) */
export const rainShowing = () => !!rain?.mesh.visible;

/* Mỗi khung: `amount` = cường độ mưa (0–1), `wind` = gió tức thời (m/s), `dir` = hướng gió thổi tới (rad), `blocked` = camera trong hầm / dưới nước */
export function updateRain(dt: number, amount: number, wind: number, dir: number, blocked: boolean) {
  if (!rain) return;
  const R = CONFIG.weather.rain, P = CONFIG.weather.perf;
  const count = Math.round(rain.n * amount * P.adaptiveSteps[rain.step]);
  const on = !blocked && count > 0;
  rain.mesh.visible = on; rain.mesh.count = on ? count : 0;
  if (!on) { rain.fpsN = 0; return; }
  // Rơi xiên theo gió: vận tốc (wx, −fall, wz), góc nghiêng atan(gió / fall). Cộng dồn trên CPU (double) rồi gói theo hộp
  const wx = Math.cos(dir) * wind, wz = Math.sin(dir) * wind, o = rain.offset;
  o.set((o.x + wx * dt) % R.box[0], (o.y - R.fall * dt) % R.box[1], (o.z + wz * dt) % R.box[2]);
  rain.u.uDir.value.set(wx, -R.fall, wz).normalize();
  // Tự hạ chất lượng: FPS trung bình trong adaptiveWindow giây dưới adaptiveMinFps thì lùi một bậc; không tự nâng lại trong phiên
  if (isTest || rain.step >= P.adaptiveSteps.length - 1) return;
  const now = performance.now() / 1000;      // đồng hồ thật: dt trong animate() bị chặn 0,05 s nên không đo được FPS thấp
  if (!rain.fpsN) rain.fpsT = now;
  rain.fpsN++;
  if (now - rain.fpsT >= P.adaptiveWindow) { if ((rain.fpsN - 1) / (now - rain.fpsT) < P.adaptiveMinFps) rain.step++; rain.fpsN = 0; }
}

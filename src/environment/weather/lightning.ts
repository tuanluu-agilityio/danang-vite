import * as THREE from 'three';
import { CONFIG } from '../../config';
import { rng } from '../../common/math';
import { scene, renderer, camera } from '../../core/renderer';
import { composer } from '../../core/postprocessing';
import { hemi } from '../../core/lights';

/* ===== [weather] Chớp và sấm (mục 4.6): MỘT mesh ribbon dựng sẵn — +1 draw call chỉ lúc tia chớp hiện (~0,2 s), 0 khi không =====
   Buffer vị trí cấp phát một lần (tia chính + nhánh); mỗi lần chớp chỉ ghi lại toạ độ, không tạo geometry/material mới.
   Lịch chớp và hình dạng sinh bằng rng(seed + 3), KHÔNG dùng rand(). Chỉ đổi CƯỜNG ĐỘ đèn sẵn có (hemi, exposure): không thêm/bật tắt đèn.
   Tia chớp chọn hướng trong ±yawSpread quanh hướng nhìn của camera, cách distMin–distMax. Sấm tới sau khoảng cách / 343 m/s (âm thanh: GĐ7, ở đây chỉ ghi thời gian trễ).
   Tắt khi camera trong hầm / dưới nước (blocked) và khi lightning ≈ 0 (preset `now`: không làm gì). */
const SOUND = 343;   // m/s — vận tốc âm thanh
export interface Lightning {
  mesh: THREE.Mesh;
  strike: () => void;                                   // ép một lần chớp ngay (test / kịch bản)
  stats: { count: number; lastDist: number; thunderDelay: number };   // số lần chớp; khoảng cách (m) và độ trễ sấm (s) của lần gần nhất
  flashing: () => boolean;                              // tia chớp đang hiện
}
let L: (Lightning & { geo: THREE.BufferGeometry; pos: Float32Array; wait: number; t: number; wins: [number, number][]; pulse: number; rnd: () => number; armed: boolean }) | null = null;

const MAXSEG = () => { const C = CONFIG.weather.lightning; return C.segs + C.branches * C.branchSegs; };

export function buildLightning(): Lightning {
  const C = CONFIG.weather.lightning, n = MAXSEG();
  const pos = new Float32Array(n * 4 * 3), idx: number[] = [];
  for (let s = 0; s < n; s++) { const v = s * 4; idx.push(v, v + 1, v + 2, v + 2, v + 1, v + 3); }
  const geo = new THREE.BufferGeometry();
  const pa = new THREE.BufferAttribute(pos, 3); pa.setUsage(THREE.DynamicDrawUsage);
  geo.setAttribute('position', pa); geo.setIndex(idx); geo.setDrawRange(0, 0);
  const mat = new THREE.MeshBasicMaterial({ color: new THREE.Color(...C.color), side: THREE.DoubleSide, fog: false, depthWrite: false });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.name = 'wx-lightning'; mesh.frustumCulled = false; mesh.castShadow = false; mesh.receiveShadow = false; mesh.layers.set(1); mesh.renderOrder = 3;
  mesh.visible = false; scene.add(mesh);
  // Biên dịch sẵn program (hai biến thể: canvas và render target của composer cho bloom ban đêm) để lần chớp đầu không khựng
  const rt = renderer.getRenderTarget();
  mesh.visible = true; geo.setDrawRange(0, 6);
  renderer.setRenderTarget(null); renderer.compile(mesh, camera, scene);
  renderer.setRenderTarget(composer.readBuffer); renderer.compile(mesh, camera, scene);
  renderer.setRenderTarget(rt); mesh.visible = false; geo.setDrawRange(0, 0);
  L = {
    mesh, geo, pos, wait: -1, t: 1e9, wins: [], pulse: 0, rnd: rng(CONFIG.weather.seed + 3), armed: false,
    stats: { count: 0, lastDist: 0, thunderDelay: 0 },
    strike: () => strike(),
    flashing: () => mesh.visible
  };
  return L;
}

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const between = (r: [number, number], u: number) => lerp(r[0], r[1], u);
const _a = new THREE.Vector3(), _b = new THREE.Vector3(), _d = new THREE.Vector3(), _v = new THREE.Vector3(), _s = new THREE.Vector3();

/* Một đoạn ribbon từ a tới b, bề rộng w, vuông góc hướng nhìn từ camera */
function quad(k: number, a: THREE.Vector3, b: THREE.Vector3, w: number) {
  _d.subVectors(b, a); _v.subVectors(a, camera.position);
  _s.crossVectors(_d, _v); if (_s.lengthSq() < 1e-9) _s.set(1, 0, 0); _s.normalize().multiplyScalar(w / 2);
  const p = L.pos, o = k * 12;
  p[o] = a.x - _s.x; p[o + 1] = a.y - _s.y; p[o + 2] = a.z - _s.z;
  p[o + 3] = a.x + _s.x; p[o + 4] = a.y + _s.y; p[o + 5] = a.z + _s.z;
  p[o + 6] = b.x - _s.x; p[o + 7] = b.y - _s.y; p[o + 8] = b.z - _s.z;
  p[o + 9] = b.x + _s.x; p[o + 10] = b.y + _s.y; p[o + 11] = b.z + _s.z;
}

/* Dựng tia chớp mới (đường gấp khúc có nhánh) và lịch nháy */
function strike() {
  if (!L) return;
  const C = CONFIG.weather.lightning, r = L.rnd;
  const dist = between([C.distMin, C.distMax], r());
  const fwd = camera.getWorldDirection(_v), yaw = Math.atan2(fwd.z, fwd.x) + (r() - 0.5) * 2 * C.yawSpread;
  const top = new THREE.Vector3(camera.position.x + Math.cos(yaw) * dist, C.height, camera.position.z + Math.sin(yaw) * dist);
  const foot = new THREE.Vector3(top.x + (r() - 0.5) * dist * 0.1, 0, top.z + (r() - 0.5) * dist * 0.1);
  const w = C.widthK * dist;
  // Tia chính: chia đều từ chân mây tới mặt đất, lệch ngang ngẫu nhiên (đầu/cuối cố định)
  const pts: THREE.Vector3[] = [];
  for (let i = 0; i <= C.segs; i++) {
    const p = new THREE.Vector3().lerpVectors(top, foot, i / C.segs), edge = i === 0 || i === C.segs ? 0 : 1, j = C.jitter * (C.height / C.segs);
    p.x += (r() - 0.5) * 2 * j * edge * (dist / 200); p.z += (r() - 0.5) * 2 * j * edge * (dist / 200);
    pts.push(p);
  }
  let k = 0;
  for (let i = 0; i < C.segs; i++) quad(k++, pts[i], pts[i + 1], w);
  // Nhánh: rẽ từ điểm giữa tia chính, đi xuống và lệch ra một bên
  for (let b = 0; b < C.branches; b++) {
    const from = pts[2 + Math.floor(r() * (C.segs - 5))], side = (r() < 0.5 ? -1 : 1) * (0.5 + r()) * (C.height / C.segs) * (dist / 400);
    _a.copy(from);
    for (let i = 0; i < C.branchSegs; i++) {
      _b.set(_a.x + side * (0.6 + r() * 0.8), Math.max(0, _a.y - (C.height / C.segs) * (0.6 + r() * 0.6)), _a.z + (r() - 0.5) * Math.abs(side));
      quad(k++, _a, _b, w * 0.5); _a.copy(_b);
    }
  }
  L.geo.setDrawRange(0, k * 6); (L.geo.attributes.position as THREE.BufferAttribute).needsUpdate = true;
  // Lịch nháy: 2–3 nháy, mỗi nháy 60–90 ms, nghỉ 40–70 ms giữa các nháy
  const nf = Math.round(between(C.flickers, r())); L.wins = []; let t0 = 0;
  for (let i = 0; i < nf; i++) { const d = between(C.flickMs, r()) / 1000; L.wins.push([t0, t0 + d]); t0 += d + between(C.gapMs, r()) / 1000; }
  L.t = 0; L.stats.count++; L.stats.lastDist = dist; L.stats.thunderDelay = dist / SOUND;
}

/* Gọi mỗi khung SAU applyAtmosphere (applyNight đặt lại hemi/exposure mỗi khung nên cộng xung một lần ở đây là đủ).
   level = CONFIG lightning hiện tại (0–1); blocked = camera trong hầm / dưới nước */
export function updateLightning(dt: number, level: number, blocked: boolean) {
  if (!L) return;
  const C = CONFIG.weather.lightning;
  if (level < 1e-3 || blocked) {
    L.mesh.visible = false; L.t = 1e9; L.armed = false; return;
  }
  if (!L.armed) { L.armed = true; L.wait = lerp(C.maxGap, C.minGap, Math.min(1, level)) * between([0.6, 1.4], L.rnd()); }   // lịch đầu tiên khi bắt đầu có chớp
  L.t += dt;
  const dur = L.wins.length ? L.wins[L.wins.length - 1][1] : 0;
  if (L.t > dur + C.pulseSec) {                           // không còn nháy/xung: đếm ngược tới lần chớp kế
    L.wait -= dt;
    if (L.wait <= 0) { strike(); L.wait = lerp(C.maxGap, C.minGap, Math.min(1, level)) * between([0.6, 1.4], L.rnd()); }
  }
  // Tia chớp hiện trong các cửa sổ nháy; xung sáng của mỗi nháy tắt dần trong pulseSec
  let on = false, pulse = 0;
  for (const [a, b] of L.wins) {
    if (L.t >= a && L.t < b) on = true;
    if (L.t >= a) { const u = Math.max(0, 1 - (L.t - a) / C.pulseSec); pulse = Math.max(pulse, u * u); }
  }
  L.mesh.visible = on; L.pulse = pulse * Math.min(1, 0.4 + level);
  if (L.pulse > 1e-3) {
    hemi.intensity += C.hemiPulse * L.pulse;
    renderer.toneMappingExposure *= 1 + (C.expPulse - 1) * L.pulse;
  }
}

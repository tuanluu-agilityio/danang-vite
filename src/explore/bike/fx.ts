/* ============================ Lái xe máy: đêm + mưa (vệt đèn pha, bụi nước, bám đường, gió giật) ============================
   Spec D-040 §9, §17.3, §17.9. Không PointLight / SpotLight, không đụng vật liệu mặt đường (mặt ướt đã có ở weather/wetness.ts).
   - bkGrip(wet, inTunnel): độ bám cho BkInput.grip = 1 − wet (kẹp), = 1 khi xe trong ô hầm kín (mặt đường hầm không ướt). Thuần.
   - bkGustSteer(v, gust, wdx, wdz, yaw): phần steer cộng thêm do gió giật (weatherU.uGust, uWindDir), ≤ fx.gust.steer, chỉ khi v > perf.vBlend;
     dấu theo phía gió đẩy (gió thổi sang trái thân xe ⇒ steer > 0 = nghiêng / rẽ trái). Thuần; BkInput giữ nguyên, index.ts cộng vào steer.
   - bkFx.group (index.ts thêm vào cảnh ở start(), stop() gỡ ra), hai con, đều lớp 1 (không vào phản chiếu mặt nước), không bóng, frustumCulled = false
     (đỉnh ghi thẳng tọa độ thế giới mỗi khung):
     · 'bike-beam': vệt đèn pha. Một lưới 2 × (rows + 1) đỉnh, mỗi hàng ở khoảng cách ahead + len·j/rows trước tâm xe theo hướng cổ lái (yaw + steer kẹp),
       cao độ mỗi đỉnh = drGround(net, x, z, yRef) + lift, yRef dò dần từ hàng trước theo `pitch` (bám dốc cầu / dốc hầm); không có net / ra ngoài ô thì yRef.
       MeshBasicMaterial cộng màu (AdditiveBlending) + DataTexture hình quạt dựng bằng code, depthWrite false, polygonOffset, fog false.
       Chỉ vẽ khi night > nightMin; độ sáng opacity · smoothstep theo đêm · (1 + (wetGain − 1)·wet), dài len · (1 + (wetGain − 1)·wet).
     · 'bike-spray': bụi nước. Một THREE.Points ≤ spray.max hạt (mảng cấp sẵn), hạt sống dồn về đầu mảng, drawRange = số hạt sống; màu đỉnh RGBA (alpha mờ theo đời).
       Sinh ở hai bánh (rearK phần ở bánh sau) với tốc độ max / life · rain · k(v), k(v) = 0 dưới vMin, 1 từ vFull; bay theo trọng trường, không xuống dưới mặt đường lúc sinh.
       Ngẫu nhiên từ rng(spray.seed) riêng, tạo lại ở start() ⇒ cùng đầu vào cho cùng hạt (không dùng rand() / Math.random()).
   - Làm nóng shader (D-018): bkFxWarmObject() trả nhóm tạm dùng chung hình học + vật liệu thật; model.ts bkModelWarmAll thêm vào nhóm làm nóng (bkModelWarmAlso).
   Mỗi khung không cấp phát (D-018). */
import * as THREE from 'three';
import { CONFIG } from '../../config';
import { rng } from '../../common/math';
import { drGround, type DrNet } from '../drive/net';
import type { BkState } from './motion';

const FB = CONFIG.bike.fx.beam, FS = CONFIG.bike.fx.spray, FG = CONFIG.bike.fx.gust, P = CONFIG.bike.perf, L = CONFIG.bike.body.wheelbase, LOCK = CONFIG.bike.model.steerLock;
const fin = (v: number, d = 0): number => (Number.isFinite(v) ? v : d);
const clamp01 = (v: number): number => (v < 0 ? 0 : v > 1 ? 1 : v);

/* ===== Hàm thuần ===== */
export function bkGrip(wet: number, inTunnel: boolean): number {
  if (inTunnel) return 1;
  return 1 - clamp01(fin(wet));
}

export function bkGustSteer(v: number, gust: number, wdx: number, wdz: number, yaw: number): number {
  if (!(fin(v) > P.vBlend)) return 0;
  const g = clamp01(fin(gust) / FG.ref);
  if (g === 0) return 0;
  /* bên trái thân xe: (−sin yaw, −cos yaw) (mũi (cos yaw, −sin yaw), trục Y lên) */
  const side = -fin(wdx) * Math.sin(yaw) - fin(wdz) * Math.cos(yaw);
  return FG.steer * g * (side > 1 ? 1 : side < -1 ? -1 : side);
}

/* ===== Vệt đèn pha ===== */
const ROWS = FB.rows, NB = 2 * (ROWS + 1);

/* Texture quạt: u ngang (0..1), v dọc (0 gần xe .. 1 xa); độ sáng ghi vào RGB (cộng màu nhân alpha = 1), hẹp ở gần, mở theo căn bậc hai, tắt dần ở xa, đốm sáng ở ≈ 0,3 */
function beamTexture(): THREE.DataTexture {
  const n = FB.px, d = new Uint8Array(n * n * 4);
  let mx = 0;
  const f = new Float32Array(n * n);
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
    const u = (x + 0.5) / n, v = (y + 0.5) / n;
    const half = 0.22 + 0.78 * Math.sqrt(v), e = Math.abs(u - 0.5) * 2 / half, across = e >= 1 ? 0 : 1 - e * e;   // quạt mở nhanh ở gần xe
    const rise = Math.min(1, v / 0.06), along = rise * rise * (3 - 2 * rise) * Math.pow(1 - v, 1.1) * (0.7 + 0.3 * Math.exp(-(((v - 0.3) / 0.2) ** 2)));
    f[y * n + x] = across * along; mx = Math.max(mx, across * along);
  }
  for (let i = 0; i < n * n; i++) { const c = Math.round(255 * f[i] / mx); d[i * 4] = c; d[i * 4 + 1] = c; d[i * 4 + 2] = c; d[i * 4 + 3] = 255; }
  const t = new THREE.DataTexture(d, n, n, THREE.RGBAFormat);
  t.magFilter = THREE.LinearFilter; t.minFilter = THREE.LinearFilter; t.needsUpdate = true;
  return t;
}

function beamGeometry(): THREE.BufferGeometry {
  const g = new THREE.BufferGeometry(), uv = new Float32Array(NB * 2), idx: number[] = [];
  for (let j = 0; j <= ROWS; j++) {
    uv[j * 4] = 0; uv[j * 4 + 1] = j / ROWS; uv[j * 4 + 2] = 1; uv[j * 4 + 3] = j / ROWS;
    if (j < ROWS) { const a = 2 * j, b = a + 1, c = a + 2, e = a + 3; idx.push(a, b, c, b, e, c); }   // mặt nhìn từ trên (pháp tuyến +Y; u = 0 là bên trái xe)
  }
  g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(NB * 3), 3).setUsage(THREE.DynamicDrawUsage));
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  g.setIndex(idx);
  return g;
}

const beamMat = new THREE.MeshBasicMaterial({ color: FB.color, map: beamTexture(), transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false,
  polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -4, fog: false });
beamMat.name = 'bikeBeam';
const beam = new THREE.Mesh(beamGeometry(), beamMat);
beam.name = 'bike-beam';

/* ===== Bụi nước ===== */
const MAX = FS.max;
function dotTexture(): THREE.DataTexture {
  const n = 32, d = new Uint8Array(n * n * 4);
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
    const u = (x + 0.5) / n * 2 - 1, v = (y + 0.5) / n * 2 - 1, r = Math.hypot(u, v), a = r >= 1 ? 0 : (1 - r * r) ** FS.soft;
    const i = (y * n + x) * 4; d[i] = 255; d[i + 1] = 255; d[i + 2] = 255; d[i + 3] = Math.round(255 * a);
  }
  const t = new THREE.DataTexture(d, n, n, THREE.RGBAFormat);
  t.magFilter = THREE.LinearFilter; t.minFilter = THREE.LinearFilter; t.needsUpdate = true;
  return t;
}
const sPos = new Float32Array(MAX * 3), sCol = new Float32Array(MAX * 4), sVel = new Float32Array(MAX * 3), sAge = new Float32Array(MAX), sGround = new Float32Array(MAX);
const sprayGeo = new THREE.BufferGeometry();
sprayGeo.setAttribute('position', new THREE.BufferAttribute(sPos, 3).setUsage(THREE.DynamicDrawUsage));
sprayGeo.setAttribute('color', new THREE.BufferAttribute(sCol, 4).setUsage(THREE.DynamicDrawUsage));
sprayGeo.setDrawRange(0, 0);
/* fog: true có chủ ý (Task 9): hạt ở xa (góc thứ ba, xe người khác) nhạt theo sương như mặt đường quanh nó; hạt sát camera gần như không đổi */
const sprayMat = new THREE.PointsMaterial({ size: FS.size, sizeAttenuation: true, map: dotTexture(), vertexColors: true, transparent: true, opacity: FS.opacity, depthWrite: false, fog: true });
sprayMat.name = 'bikeSpray';
const spray = new THREE.Points(sprayGeo, sprayMat);
spray.name = 'bike-spray';
const sprayBase = new THREE.Color(FS.color);

for (const o of [beam, spray] as THREE.Object3D[]) { o.layers.set(1); o.castShadow = false; o.receiveShadow = false; o.frustumCulled = false; o.visible = false; o.renderOrder = 1; }

const group = new THREE.Group();
group.name = 'bike-fx';
group.add(beam, spray);

let net: DrNet | null = null;
let rnd: () => number = rng(FS.seed);
let nAlive = 0, emit = 0;

/* Vệt pha: đặt đỉnh theo xe + mặt đường; ẩn khi chưa đủ tối */
function beamStep(s: BkState, night: number, pitch: number, wet: number): void {
  const nt = fin(night);
  if (!(nt > FB.nightMin)) { beam.visible = false; return; }
  const w = clamp01(fin(wet)), gain = 1 + (FB.wetGain - 1) * w;
  const k = clamp01((nt - FB.nightMin) / (1 - FB.nightMin)), kk = k * k * (3 - 2 * k);
  beamMat.opacity = Math.min(1, FB.opacity * kk * gain);
  const st = fin(s.steer), h = fin(s.yaw) + (st > LOCK ? LOCK : st < -LOCK ? -LOCK : st);
  const fx = Math.cos(h), fz = -Math.sin(h), lx = -Math.sin(h), lz = -Math.cos(h), hw = FB.width / 2, len = FB.len * gain, tp = Math.tan(fin(pitch));
  const x0 = fin(s.x), y0 = fin(s.y), z0 = fin(s.z);
  const a = beam.geometry.getAttribute('position') as THREE.BufferAttribute, p = a.array as Float32Array;
  /* mỗi mép dò dần theo hàng: tầng mặt đường tìm quanh cao độ hàng trước + dốc (dốc cong lên / xuống vẫn bám, không nhảy sang tầng khác) */
  for (let c = 0; c < 2; c++) {
    const sd = c === 0 ? hw : -hw;
    let yPrev = y0, dPrev = 0;
    for (let j = 0; j <= ROWS; j++) {
      const d = FB.ahead + len * j / ROWS, x = x0 + fx * d + lx * sd, z = z0 + fz * d + lz * sd, yRef = yPrev + tp * (d - dPrev);
      const g = net ? drGround(net, x, z, yRef) : NaN, y = Number.isFinite(g) ? g : yRef, i = (2 * j + c) * 3;
      p[i] = x; p[i + 1] = y + FB.lift; p[i + 2] = z;
      yPrev = y; dPrev = d;
    }
  }
  a.needsUpdate = true;
  beam.visible = true;
}

/* Bụi nước: hạt cũ bay + hết đời (dồn về đầu mảng), sinh hạt mới ở hai bánh */
function sprayStep(s: BkState, night: number, rain: number, dt: number): void {
  const v = fin(s.v), r = clamp01(fin(rain));
  /* hạt cũ */
  for (let i = 0; i < nAlive;) {
    sAge[i] += dt;
    if (sAge[i] >= FS.life) {
      const j = --nAlive;
      if (i !== j) { sPos[i * 3] = sPos[j * 3]; sPos[i * 3 + 1] = sPos[j * 3 + 1]; sPos[i * 3 + 2] = sPos[j * 3 + 2]; sVel[i * 3] = sVel[j * 3]; sVel[i * 3 + 1] = sVel[j * 3 + 1]; sVel[i * 3 + 2] = sVel[j * 3 + 2]; sAge[i] = sAge[j]; sGround[i] = sGround[j]; }
      continue;
    }
    sVel[i * 3 + 1] -= FS.gravity * dt;
    sPos[i * 3] += sVel[i * 3] * dt; sPos[i * 3 + 1] += sVel[i * 3 + 1] * dt; sPos[i * 3 + 2] += sVel[i * 3 + 2] * dt;
    if (sPos[i * 3 + 1] < sGround[i]) { sPos[i * 3 + 1] = sGround[i]; sVel[i * 3 + 1] = 0; sVel[i * 3] *= 0.5; sVel[i * 3 + 2] *= 0.5; }
    i++;
  }
  /* hạt mới */
  const kv = clamp01((Math.abs(v) - FS.vMin) / (FS.vFull - FS.vMin)), rate = MAX / FS.life * r * kv;
  if (rate > 0 && Math.abs(v) > FS.vMin) {
    emit += rate * dt;
    const yaw = fin(s.yaw), fx = Math.cos(yaw), fz = -Math.sin(yaw), lx = -Math.sin(yaw), lz = -Math.cos(yaw), sg = v < 0 ? -1 : 1;
    const x0 = fin(s.x), y0 = fin(s.y), z0 = fin(s.z);
    while (emit >= 1 && nAlive < MAX) {
      emit -= 1;
      const i = nAlive++, rear = rnd() < FS.rearK, ax = (rear ? -L / 2 : L / 2) - 0.25 * sg, lat = (rnd() * 2 - 1) * 0.08;
      sPos[i * 3] = x0 + fx * ax + lx * lat; sPos[i * 3 + 1] = y0 + 0.05; sPos[i * 3 + 2] = z0 + fz * ax + lz * lat;
      const fwd = v * FS.carry * (0.8 + 0.4 * rnd()), up = FS.up[0] + (FS.up[1] - FS.up[0]) * rnd(), side = (rnd() * 2 - 1) * FS.side;
      sVel[i * 3] = fx * fwd + lx * side; sVel[i * 3 + 1] = up; sVel[i * 3 + 2] = fz * fwd + lz * side;
      const age = rnd() * dt;   // sinh rải trong khung: không thành từng lớp
      sAge[i] = age; sGround[i] = y0;
      sPos[i * 3] += sVel[i * 3] * age; sPos[i * 3 + 1] += sVel[i * 3 + 1] * age; sPos[i * 3 + 2] += sVel[i * 3 + 2] * age;
    }
    if (nAlive >= MAX) emit = 0;
  } else emit = 0;
  /* màu: tối về đêm, mờ dần theo đời */
  const dim = 1 - (1 - FS.nightDim) * clamp01(fin(night)), cr = sprayBase.r * dim, cg = sprayBase.g * dim, cb = sprayBase.b * dim;
  for (let i = 0; i < nAlive; i++) { const t = 1 - sAge[i] / FS.life; sCol[i * 4] = cr; sCol[i * 4 + 1] = cg; sCol[i * 4 + 2] = cb; sCol[i * 4 + 3] = t > 0 ? t : 0; }
  sprayGeo.setDrawRange(0, nAlive);
  if (nAlive > 0) { (sprayGeo.getAttribute('position') as THREE.BufferAttribute).needsUpdate = true; (sprayGeo.getAttribute('color') as THREE.BufferAttribute).needsUpdate = true; }
  spray.visible = nAlive > 0;
}

function reset(): void {
  nAlive = 0; emit = 0; rnd = rng(FS.seed);
  sprayGeo.setDrawRange(0, 0);
  beam.visible = false; spray.visible = false;
}

export const bkFx = {
  group,
  /* Vào chế độ: hạt về 0, rng tạo lại (tất định); net cho cao độ mặt đường của vệt pha (không có thì theo pitch) */
  start(n?: DrNet | null): void { net = n ?? null; reset(); },
  /* Rời chế độ: gỡ nhóm khỏi cảnh, ẩn hết */
  stop(): void { group.removeFromParent(); reset(); net = null; },
  /* Một khung, sau model.place: night = shared.uNight; rain 0..1 (0 trong hầm); pitch rad dốc xe (mặt phẳng dự phòng); wet 0..1 mặt ướt (0 trong hầm) */
  update(s: BkState, night: number, rain: number, dt: number, pitch: number, wet = 0): void {
    const d = Number.isFinite(dt) && dt > 0 ? Math.min(dt, 0.1) : 0;
    beamStep(s, night, pitch, wet);
    if (d > 0) sprayStep(s, night, rain, d);
  },
  drawn(): { beam: boolean; spray: number } { return { beam: beam.visible, spray: spray.visible ? nAlive : 0 }; }
};

/* Nhóm tạm để làm nóng shader (model.ts): lưới mới dùng chung hình học + vật liệu thật, luôn hiện */
export function bkFxWarmObject(): THREE.Object3D {
  const g = new THREE.Group();
  g.add(new THREE.Mesh(beam.geometry, beamMat), new THREE.Points(sprayGeo, sprayMat));
  return g;
}

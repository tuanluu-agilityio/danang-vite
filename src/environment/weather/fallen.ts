import * as THREE from 'three';
import { CONFIG } from '../../config';
import { rng } from '../../common/math';
import { scene } from '../../core/renderer';
import { MAT } from '../../core/materials';

/* ===== [weather] Cây đổ sau bão (mục 4.8): 0 draw call, chỉ ghi lại ma trận instance =====
   Cây = cặp InstancedMesh (thân MAT.trunk + tán MAT.leaf / MAT.palm, cùng chỉ số, anh em liền kề trong cùng cha — xem environment/trees.ts).
   Chọn 6–10 cây trong `radius` quanh điểm nhìn (bộ sinh riêng rng(seed + 7), KHÔNG dùng rand()), nghiêng quanh gốc theo hướng gió tới 80° trong fallSec giây.
   LƯU ma trận gốc của đúng những instance đã chọn và ghi lại đúng bản gốc khi dựng cây lại. Instance đã bị dọn scale 0 (hầm, riverfront) bị bỏ qua.
   Chưa đổ → không đụng gì (preset `now` không đổi). */
interface Pair { trunk: THREE.InstancedMesh; crown: THREE.InstancedMesh }
interface Hit { pair: Pair; i: number; trunk0: THREE.Matrix4; crown0: THREE.Matrix4; base: THREE.Vector3; yaw: number }
let pairs: Pair[] = [];
let hits: Hit[] = [], angle = 0, goal = 0, axis = new THREE.Vector3(), rnd = rng(CONFIG.weather.seed + 7);
const m = new THREE.Matrix4(), q = new THREE.Quaternion(), v = new THREE.Vector3(), s = new THREE.Vector3(), r = new THREE.Matrix4(), t1 = new THREE.Matrix4();

/* Quét cảnh sau khi mọi cây đã dựng và đã dọn (gọi trong buildWeather) */
export function buildFallen() {
  pairs = [];
  scene.traverse((o) => {
    const crown = o as THREE.InstancedMesh;
    if (!crown.isInstancedMesh || (crown.material !== MAT.leaf && crown.material !== MAT.palm) || !crown.parent) return;
    const sib = crown.parent.children, trunk = sib[sib.indexOf(crown) - 1] as THREE.InstancedMesh | undefined;
    if (trunk && trunk.isInstancedMesh && trunk.material === MAT.trunk && trunk.count === crown.count) pairs.push({ trunk, crown });
  });
}

/* Bản chụp ma trận instance của mọi thân/tán cây (cho test so sánh trước/sau khi dựng lại) */
export const fallenSnapshot = () => pairs.flatMap((p) => [Array.from(p.trunk.instanceMatrix.array), Array.from(p.crown.instanceMatrix.array)]);
export const fallenState = () => ({ pairs: pairs.length, down: hits.length, angle });

/* Ghi ma trận nghiêng quanh gốc: M' = T(gốc)·R(trục, góc)·Ry(lệch · tiến độ)·T(−gốc)·M */
function pose(h: Hit, a: number) {
  const R = new THREE.Matrix4().makeTranslation(h.base.x, h.base.y, h.base.z)
    .multiply(r.makeRotationAxis(axis, a)).multiply(m.makeRotationY(h.yaw * a / goal)).multiply(t1.makeTranslation(-h.base.x, -h.base.y, -h.base.z));
  h.pair.trunk.setMatrixAt(h.i, new THREE.Matrix4().multiplyMatrices(R, h.trunk0));
  h.pair.crown.setMatrixAt(h.i, new THREE.Matrix4().multiplyMatrices(R, h.crown0));
  h.pair.trunk.instanceMatrix.needsUpdate = true; h.pair.crown.instanceMatrix.needsUpdate = true;
}

/* Chọn cây gần `near` và bắt đầu đổ theo hướng gió dir (rad, 0 = +X). Gọi lại khi đang đổ thì bỏ qua. */
export function fellTrees(near: THREE.Vector3, dir: number) {
  if (hits.length || !pairs.length) return;
  const F = CONFIG.weather.fallen, cand: { pair: Pair; i: number; d: number }[] = [];
  for (const p of pairs) for (let i = 0; i < p.crown.count; i++) {
    p.crown.getMatrixAt(i, m); m.decompose(v, q, s);
    if (s.x < 0.01 || s.y < 0.01) continue;                       // đã dọn scale 0
    const d = Math.hypot(v.x - near.x, v.z - near.z);
    if (d < F.radius) cand.push({ pair: p, i, d });
  }
  cand.sort((a, b) => a.d - b.d);
  const pool = cand.slice(0, F.pool), n = Math.min(pool.length, F.count[0] + Math.floor(rnd() * (F.count[1] - F.count[0] + 1)));
  for (let k = 0; k < n; k++) {
    const c = pool.splice(Math.floor(rnd() * pool.length), 1)[0];
    const trunk0 = new THREE.Matrix4(), crown0 = new THREE.Matrix4();
    c.pair.trunk.getMatrixAt(c.i, trunk0); c.pair.crown.getMatrixAt(c.i, crown0);
    hits.push({ pair: c.pair, i: c.i, trunk0, crown0, base: new THREE.Vector3().setFromMatrixPosition(trunk0), yaw: (rnd() - 0.5) * 2 * F.jitter });
  }
  axis.set(0, 1, 0).cross(v.set(Math.cos(dir), 0, Math.sin(dir))).normalize();   // quay quanh trục này một góc dương thì ngọn nghiêng về hướng gió
  angle = 0; goal = F.angleDeg * Math.PI / 180;
}

/* Dựng cây lại: ghi lại ĐÚNG ma trận gốc (so sánh được bằng ===) rồi quên */
export function standTrees() {
  for (const h of hits) {
    h.pair.trunk.setMatrixAt(h.i, h.trunk0); h.pair.crown.setMatrixAt(h.i, h.crown0);
    h.pair.trunk.instanceMatrix.needsUpdate = true; h.pair.crown.instanceMatrix.needsUpdate = true;
  }
  hits = []; angle = 0; goal = 0;
}

/* Mỗi khung: đang đổ thì tăng tiến độ tới 1; góc ∝ tiến độ² (cây đổ nhanh dần). Chưa chọn cây nào thì không làm gì. */
export function updateFallen(dt: number) {
  if (!hits.length || angle >= goal) return;
  angle = Math.min(goal, angle + goal * dt / CONFIG.weather.fallen.fallSec);
  const k = angle / goal;
  for (const h of hits) pose(h, goal * k * k);
}

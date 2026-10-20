import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { roadStrip, bentBox, boxAt } from '../../common/geometry';
import { HR, hrRoadY } from './profile';
import { boreShell, jointRing } from './shell';
import type { HrMaterials } from './materials';

/* [bore] Một đoạn hầm kín [x0, x1] gồm vỏ + nội thất: mặt đường, đèn, quạt phản lực, hộp SOS, bình chữa cháy,
   cửa thoát nạn sang hành lang (mỗi 100 m), đèn tín hiệu làn. Dựng theo từng đoạn để đốt hầm số 3 tách riêng cho phần mô phỏng dìm. */
export interface Bore {
  group: THREE.Group;
  shell: THREE.Group;       // vỏ bê tông + gioăng (giữ lại khi mô phỏng dìm)
  fit: THREE.Group;         // nội thất (ẩn khi đốt hầm còn nổi)
  fans: { mesh: THREE.InstancedMesh; base: THREE.Matrix4[] } | null;
}
const up = (t: number, step: number, off = 0) => Math.ceil((t - off) / step) * step + off;
const marks = (x0: number, x1: number, step: number, off = 0) => { const r: number[] = []; for (let x = up(x0, step, off); x < x1 - 1e-6; x += step) r.push(x); return r; };

function instanced(geo: THREE.BufferGeometry, mat: THREE.Material, list: THREE.Matrix4[]) {
  if (!list.length) return null;
  const m = new THREE.InstancedMesh(geo, mat, list.length);
  list.forEach((mx, i) => m.setMatrixAt(i, mx));
  m.frustumCulled = false;
  return m;
}
const T = (x: number, y: number, z: number, ry = 0) => new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), ry), new THREE.Vector3(1, 1, 1));

export function buildBore(x0: number, x1: number, M: HrMaterials, name: string): Bore {
  const group = new THREE.Group(), shell = new THREE.Group(), fit = new THREE.Group();
  group.name = name; group.add(shell, fit);
  // vỏ + gioăng: khe nối ở biên các đốt dìm (±60 thuộc đốt giữa)
  const sm = new THREE.Mesh(boreShell(x0, x1), M.bore);
  sm.castShadow = true; sm.name = `${name}-shell`; shell.add(sm);
  const joints = HR.elementEdges.filter((x) => x >= x0 - 1e-6 && x <= x1 + 1e-6 && (Math.abs(x) === 60 ? x0 === -60 : x > x0 + 1e-6 && x < x1 - 1e-6));
  if (joints.length) { const jm = new THREE.Mesh(mergeGeometries(joints.map(jointRing)), M.bore); jm.name = `${name}-gina`; shell.add(jm); }

  // mặt đường hai ống (ống Bắc lật để vạch vàng/đinh luôn nằm phía dải phân cách)
  const segs = Math.max(2, Math.ceil((x1 - x0) / 6)), W = HR.shoulder * 2 + HR.laneWidth * HR.lanesPerDir;
  const road = new THREE.Mesh(mergeGeometries([
    roadStrip(x0, x1, W, HR.tubeCenter, 0.03, segs, hrRoadY), roadStrip(x0, x1, W, -HR.tubeCenter, 0.03, segs, hrRoadY, true)
  ]), M.roadIn);
  road.receiveShadow = false; road.name = `${name}-road`; fit.add(road);

  // đèn trần: hai hàng trên mỗi ống, dải 2,6 m cách 6 m; 80 m cuối mỗi đầu là vùng ngưỡng (sáng mạnh ban ngày)
  const thr: THREE.BufferGeometry[] = [], inner: THREE.BufferGeometry[] = [];
  for (const x of marks(x0, x1, 6, 3)) for (const d of [-1, 1]) for (const r of [-1.75, 1.75]) {
    (Math.abs(x) >= HR.coverHalf - 80 ? thr : inner).push(boxAt(2.6, 0.08, 0.3, x, hrRoadY(x) + HR.clear - 0.08, d * HR.tubeCenter + r));
  }
  for (const [list, mat] of [[thr, M.lampThr], [inner, M.lampIn]] as [THREE.BufferGeometry[], THREE.Material][]) {
    if (!list.length) continue;
    list.forEach((g) => { g.deleteAttribute('uv'); g.deleteAttribute('normal'); });
    fit.add(new THREE.Mesh(mergeGeometries(list.map((g) => g.toNonIndexed())), mat));
  }
  fit.add(new THREE.Mesh(bentBox(x1 - x0, 0.08, 0.3, (x0 + x1) / 2, HR.corridorClear - 0.1, 0, segs, hrRoadY), M.lampCorr));   // đèn hành lang

  // quạt phản lực: từng cặp treo trần mỗi 100 m (lệch 50 m so với cửa ngang), cánh quạt quay
  const fanBody = new THREE.CylinderGeometry(0.45, 0.45, 2.4, 14).rotateZ(Math.PI / 2);
  const fanList: THREE.Matrix4[] = [], bladeBase: THREE.Matrix4[] = [];
  for (const x of marks(x0, x1, HR.fanStep, 50)) for (const d of [-1, 1]) for (const r of [-2.9, 2.9]) {
    const z = d * HR.tubeCenter + r, y = hrRoadY(x) + 4.55;
    fanList.push(T(x, y, z)); bladeBase.push(T(x + 1.24, y, z));
  }
  const fm = instanced(fanBody, M.fan, fanList); if (fm) fit.add(fm);
  const bladeGeo = mergeGeometries([new THREE.BoxGeometry(0.05, 0.84, 0.1), new THREE.BoxGeometry(0.05, 0.1, 0.84)]);
  const bm = instanced(bladeGeo, M.fan, bladeBase.map((m) => m.clone()));
  if (bm) { bm.instanceMatrix.setUsage(THREE.DynamicDrawUsage); fit.add(bm); }

  // hộp SOS (mỗi 50 m) và bình chữa cháy (lệch 25 m) trên tường ngoài hai ống
  const sos: THREE.Matrix4[] = [], ext: THREE.Matrix4[] = [];
  for (const x of marks(x0, x1, HR.sosStep)) for (const d of [-1, 1]) sos.push(T(x, hrRoadY(x) + 1.3, d * (HR.tubeFar - 0.11)));
  for (const x of marks(x0, x1, HR.sosStep, HR.sosStep / 2)) for (const d of [-1, 1]) ext.push(T(x, hrRoadY(x) + 1.15, d * (HR.tubeFar - 0.13)));
  for (const [geo, mat, list] of [[new THREE.BoxGeometry(0.5, 0.6, 0.22), M.sos, sos], [new THREE.BoxGeometry(0.34, 0.6, 0.26), M.extinguisher, ext]] as [THREE.BufferGeometry, THREE.Material, THREE.Matrix4[]][]) {
    const m = instanced(geo, mat, list); if (m) fit.add(m);
  }

  // cửa ngang sang hành lang thoát nạn mỗi 100 m: cánh cửa xanh + biển EXIT phát sáng
  const doors: THREE.Matrix4[] = [], exits: THREE.Matrix4[] = [];
  for (const x of marks(x0, x1, HR.crossStep)) for (const d of [-1, 1]) {
    const z = d * (HR.tubeNear + 0.05), y = hrRoadY(x);
    doors.push(T(x, y + 1.1, z)); exits.push(T(x, y + 2.6, z));
  }
  for (const [geo, mat, list] of [[new THREE.BoxGeometry(1.3, 2.2, 0.1), M.door, doors], [new THREE.BoxGeometry(0.7, 0.22, 0.1), M.exit, exits]] as [THREE.BufferGeometry, THREE.Material, THREE.Matrix4[]][]) {
    const m = instanced(geo, mat, list); if (m) fit.add(m);
  }

  // phía hành lang: cánh cửa + biển EXIT ở hai tường, vạch xanh dẫn đường dưới sàn
  const cDoors: THREE.Matrix4[] = [], cExits: THREE.Matrix4[] = [];
  for (const x of marks(x0, x1, HR.crossStep)) for (const d of [-1, 1]) {
    const z = d * (HR.corridorHalf - 0.05), y = hrRoadY(x);
    cDoors.push(T(x, y + 1.05, z)); cExits.push(T(x, y + 2.3, z));
  }
  for (const [geo, mat, list] of [[new THREE.BoxGeometry(1.3, 2.1, 0.1), M.door, cDoors], [new THREE.BoxGeometry(0.7, 0.2, 0.1), M.exit, cExits]] as [THREE.BufferGeometry, THREE.Material, THREE.Matrix4[]][]) {
    const m = instanced(geo, mat, list); if (m) fit.add(m);
  }
  fit.add(new THREE.Mesh(bentBox(x1 - x0, 0.03, 0.5, (x0 + x1) / 2, 0.05, 0, segs, hrRoadY), M.guide));

  // đèn tín hiệu làn (mũi tên xanh) mỗi 150 m trên từng làn
  const sig: THREE.Matrix4[] = [];
  for (const x of marks(x0, x1, HR.signalStep, 75)) for (const d of [-1, 1]) for (const off of HR.laneOffsets) sig.push(T(x, hrRoadY(x) + HR.clear - 0.5, d * off));
  const sm2 = instanced(new THREE.BoxGeometry(0.55, 0.06, 0.55), M.laneGreen, sig); if (sm2) fit.add(sm2);

  // trạm bơm ở điểm trũng giữa sông: khe thu nước ngang đường + tủ bơm sát tường
  if (x0 <= 0 && x1 >= 0) {
    const grates = [-1, 1].map((d) => boxAt(1.2, 0.05, W - 0.4, 0, hrRoadY(0) + 0.06, d * HR.tubeCenter));
    fit.add(new THREE.Mesh(mergeGeometries(grates), M.grate));
    fit.add(new THREE.Mesh(boxAt(3, 2.2, 1.0, -9, hrRoadY(-9) + 1.1, HR.tubeFar - 0.7), M.equip));
    fit.add(new THREE.Mesh(boxAt(3, 2.2, 1.0, -9, hrRoadY(-9) + 1.1, -HR.tubeFar + 0.7), M.equip));
  }
  group.traverse((o) => { if ((o as THREE.Mesh).isMesh && o !== sm) o.castShadow = false; });
  return { group, shell, fit, fans: bm ? { mesh: bm, base: bladeBase } : null };
}

const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _p = new THREE.Vector3(), _s = new THREE.Vector3(), _r = new THREE.Quaternion(), _ax = new THREE.Vector3(1, 0, 0);
/* Quay cánh quạt phản lực */
export function spinFans(b: Bore, angle: number) {
  if (!b.fans) return;
  _r.setFromAxisAngle(_ax, angle);
  b.fans.base.forEach((m, i) => { m.decompose(_p, _q, _s); b.fans.mesh.setMatrixAt(i, _m.compose(_p, _r, _s)); });
  b.fans.mesh.instanceMatrix.needsUpdate = true;
}

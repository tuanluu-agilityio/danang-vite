/* ===== Xe máy: bộ giả dùng chung cho test đơn vị (không phải file test) =====
   fakeBike: cảnh giả cùng cấu trúc scooter.glb (neo: số của glb thật); fakeSource: nhân vật giả = cây xương Bip01_* tư thế đứng chữ A (vị trí như public/people/p0.glb)
   + một SkinnedMesh nhỏ, nguồn qua stRigSource (5 đoạn rỗng). Dùng ở tests/bike-unit/rider.test.ts và tests/multi-unit/remoteBike.test.ts. */
import * as THREE from 'three';
import { CONFIG } from '../../src/config.ts';
import { stRigSource, type StRigSource } from '../../src/explore/stroll/rig.ts';
import { ST_CLIPS } from '../../src/explore/stroll/anim.ts';

const R = CONFIG.bike.body.wheelDia / 2, HALF = CONFIG.bike.body.wheelbase / 2;
const AXIS = new THREE.Vector3(-0.375, 0.927, 0).normalize();
const mat = (name: string): THREE.MeshStandardMaterial => { const m = new THREE.MeshStandardMaterial(); m.name = name; return m; };
const empty = (name: string, x: number, y: number, z: number): THREE.Object3D => { const o = new THREE.Object3D(); o.name = name; o.position.set(x, y, z); return o; };

/* Xe giả giống scooter.glb (neo: số của glb thật) */
export function fakeBike(): THREE.Object3D {
  const root = new THREE.Group(); root.name = 'scooter';
  const body = new THREE.Group(); body.name = 'body';
  for (const n of ['body', 'lamp_tail', 'lamp_sig_l', 'lamp_sig_r']) body.add(new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.1, 0.1), mat(n)));
  body.add(empty('foot_l', 0.1008, 0.2789, -0.12), empty('foot_r', 0.1008, 0.2789, 0.12), empty('seat', -0.4192, 0.8496, 0), empty('eye', -0.4692, 1.5296, 0));
  const front = new THREE.Group(); front.name = 'front'; front.position.set(0.2024, 0.6, 0); front.userData.axis = [AXIS.x, AXIS.y, AXIS.z];
  for (const n of ['trim', 'lamp_head', 'mirror', 'dash']) front.add(new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.1, 0.1), mat(n)));
  front.add(empty('grip_l', -0.2744, 0.4852, -0.301), empty('grip_r', -0.2744, 0.4852, 0.301));
  const wg = new THREE.CylinderGeometry(R, R, 0.1, 16).rotateX(Math.PI / 2);
  const wf = new THREE.Mesh(wg, mat('trim')); wf.name = 'wheel_f'; wf.position.set(HALF - 0.2024, R - 0.6, 0); front.add(wf);
  const wr = new THREE.Mesh(wg, mat('trim')); wr.name = 'wheel_r'; wr.position.set(-HALF, R, 0);
  root.add(body, front, wr);
  return root;
}

/* Nhân vật giả: vị trí thế giới các xương (m, chữ A, mặt +X) như p0.glb; ngón tay suy từ bàn tay */
const W: Record<string, [number, number, number]> = {
  Pelvis: [0, 0.895, 0], Spine: [-0.002, 1.015, 0], Spine1: [-0.009, 1.168, 0], Spine2: [-0.02, 1.321, 0], Neck: [-0.012, 1.521, 0], Head: [0.008, 1.587, 0]
};
const PARENT: Record<string, string> = { Pelvis: 'Bip01', Spine: 'Pelvis', Spine1: 'Spine', Spine2: 'Spine1', Neck: 'Spine2', Head: 'Neck' };
for (const [s, z] of [['L', -1], ['R', 1]] as const) {
  W[`${s}_Clavicle`] = [-0.024, 1.459, z * 0.073]; W[`${s}_UpperArm`] = [-0.025, 1.428, z * 0.21]; W[`${s}_Forearm`] = [-0.019, 1.23, z * 0.416]; W[`${s}_Hand`] = [0.081, 1.046, z * 0.588];
  W[`${s}_Thigh`] = [0, 0.895, z * 0.088]; W[`${s}_Calf`] = [0.016, 0.497, z * 0.109]; W[`${s}_Foot`] = [-0.015, 0.102, z * 0.117]; W[`${s}_Toe0`] = [0.119, 0.002, z * 0.151];
  Object.assign(PARENT, { [`${s}_Clavicle`]: 'Neck', [`${s}_UpperArm`]: `${s}_Clavicle`, [`${s}_Forearm`]: `${s}_UpperArm`, [`${s}_Hand`]: `${s}_Forearm`,
    [`${s}_Thigh`]: 'Spine', [`${s}_Calf`]: `${s}_Thigh`, [`${s}_Foot`]: `${s}_Calf`, [`${s}_Toe0`]: `${s}_Foot` });
  const h = new THREE.Vector3(...W[`${s}_Hand`]), fd = h.clone().sub(new THREE.Vector3(...W[`${s}_Forearm`])).normalize();
  for (let f = 0; f < 5; f++) {
    let par = `${s}_Hand`;
    for (let j = 0; j < 3; j++) {
      const nm = `${s}_Finger${f}${['', '1', '2'][j]}`;
      const p = h.clone().addScaledVector(fd, f === 0 ? 0.03 + 0.025 * j : 0.08 + 0.03 * j).add(new THREE.Vector3((2 - f) * 0.015 + (f === 0 ? 0.02 : 0), 0, 0));
      W[nm] = [p.x, p.y, p.z]; PARENT[nm] = par; par = nm;
    }
  }
}
function fakeChar(): THREE.Group {
  const scene = new THREE.Group(), bip = new THREE.Bone(); bip.name = 'Bip01'; bip.position.set(0, 0.895, 0); bip.scale.setScalar(0.01); scene.add(bip);   // như p0.glb: Bip01 thu 0,01, xương con tính cm
  const made: Record<string, THREE.Object3D> = { Bip01: bip }, bones: THREE.Bone[] = [bip];
  const mk = (n: string): THREE.Object3D => {
    if (made[n]) return made[n];
    const par = mk(PARENT[n]), b = new THREE.Bone(); b.name = 'Bip01_' + n;
    const pw = n === 'Pelvis' ? [0, 0.895, 0] : W[PARENT[n]];
    b.position.set(W[n][0] - pw[0], W[n][1] - pw[1], W[n][2] - pw[2]).multiplyScalar(100);
    par.add(b); bones.push(b); made[n] = b; return b;
  };
  for (const n of Object.keys(W)) mk(n);
  scene.updateMatrixWorld(true);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0, 0.1, 0, 0, 0, 0.1, 0], 3));
  g.setAttribute('skinIndex', new THREE.Uint16BufferAttribute([0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], 4));
  g.setAttribute('skinWeight', new THREE.Float32BufferAttribute([1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0], 4));
  const m = new THREE.SkinnedMesh(g, new THREE.MeshStandardMaterial()); m.name = 'char';
  scene.add(m); m.bind(new THREE.Skeleton(bones));
  return scene;
}
/* Bản sao giả của SkeletonUtils.clone (như tests/pilot-unit/index.test.ts) */
function cloneSk(o: THREE.Object3D): THREE.Object3D {
  const c = o.clone(true);
  c.traverse((x) => {
    const m = x as THREE.SkinnedMesh;
    if (!m.isSkinnedMesh) return;
    const bones = m.skeleton.bones.map((b) => c.getObjectByName(b.name) as THREE.Bone);
    m.bind(new THREE.Skeleton(bones, m.skeleton.boneInverses), m.bindMatrix);
  });
  return c;
}
export const fakeSource = (): StRigSource => stRigSource(fakeChar(), ST_CLIPS.map((n) => new THREE.AnimationClip(n, 1, [])), {}, 1.83, cloneSk);

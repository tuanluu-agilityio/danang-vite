/* ===== Xe máy: người lái có xương (src/explore/bike/rider.ts) =====
   Node, không GPU: nhân vật giả = cây xương Bip01_* tư thế đứng chữ A (vị trí lấy từ public/people/p0.glb, quay cục bộ đơn vị) + một SkinnedMesh nhỏ,
   nguồn qua stRigSource (5 đoạn rỗng); xe = BkBike với cảnh giả cùng cấu trúc scooter.glb (neo đúng số của glb thật). */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { CONFIG } from '../../src/config.ts';
import { stRigSource, type StRigSource } from '../../src/explore/stroll/rig.ts';
import { ST_CLIPS } from '../../src/explore/stroll/anim.ts';
import { BkBike, bkModelSetLoader, type BkPlace } from '../../src/explore/bike/model.ts';
import { BkRider, bkRiderPose, BK_POSE_N, type BkRiderSig } from '../../src/explore/bike/rider.ts';

const RC = CONFIG.bike.rider;
const R = CONFIG.bike.body.wheelDia / 2, HALF = CONFIG.bike.body.wheelbase / 2;
const AXIS = new THREE.Vector3(-0.375, 0.927, 0).normalize();
const mat = (name: string): THREE.MeshStandardMaterial => { const m = new THREE.MeshStandardMaterial(); m.name = name; return m; };
const empty = (name: string, x: number, y: number, z: number): THREE.Object3D => { const o = new THREE.Object3D(); o.name = name; o.position.set(x, y, z); return o; };

/* Xe giả giống scooter.glb (neo: số của glb thật) */
function fakeBike(): THREE.Object3D {
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
const fakeSource = (): StRigSource => stRigSource(fakeChar(), ST_CLIPS.map((n) => new THREE.AnimationClip(n, 1, [])), {}, 1.83, cloneSk);

const tick = () => new Promise((r) => setTimeout(r, 0));
const place = (o: Partial<BkPlace> = {}): BkPlace => ({ x: 10, y: 2.6, z: 3, yaw: 0.4, pitch: 0, lean: 0, steer: 0, wheel: 0, susF: 0, susR: 0, braking: false, sig: 0, ...o });
const sig = (o: Partial<BkRiderSig> = {}): BkRiderSig => ({ lean: 0, acc: 0, susF: 0, susR: 0, steer: 0, ...o });
async function realBike(): Promise<BkBike> {
  bkModelSetLoader(async () => fakeBike());
  const b = new BkBike();
  await tick(); await tick(); await tick();
  assert.equal(b.real, true);
  return b;
}
const quats = (r: BkRider): THREE.Quaternion[] => { const a: THREE.Quaternion[] = []; r.group.traverse((o) => a.push(o.quaternion)); return a; };

test('bkRiderPose: bảng góc khớp thuần, đủ BK_POSE_N số hữu hạn, gối / hông gập dương, gọi lại cùng kết quả', () => {
  const a = new Float32Array(BK_POSE_N), b = new Float32Array(BK_POSE_N).fill(9);
  bkRiderPose(a); bkRiderPose(b);
  assert.deepEqual(Array.from(a), Array.from(b));
  for (const v of a) assert.ok(Number.isFinite(v));
  assert.ok(a.some((v) => v > 0.8), 'có khớp gập lớn (hông / gối)');
});

test('IK tay ≤ handTol ở steer 0 và ±khóa lái; chân ≤ footTol; người chỉ hiện trên mô hình thật', async () => {
  const b = await realBike(), r = new BkRider(fakeSource());
  for (const steer of [0, CONFIG.bike.model.steerLock, -CONFIG.bike.model.steerLock]) {
    b.place(place({ steer }));
    for (let i = 0; i < 3; i++) r.update(b, sig({ steer }), 1 / 60);
    const d = r.debug();
    assert.ok(d.handL <= RC.handTol && d.handR <= RC.handTol, `steer ${steer}: tay ${d.handL.toFixed(4)} / ${d.handR.toFixed(4)}`);
    assert.ok(d.footL <= RC.footTol && d.footR <= RC.footTol, `steer ${steer}: chân ${d.footL.toFixed(4)} / ${d.footR.toFixed(4)}`);
  }
  assert.equal(r.group.parent, b.anchors.seat, 'gắn vào neo yên');
  assert.equal(r.group.visible, true);
  let meshes = 0; r.group.traverse((o) => { if ((o as THREE.Mesh).isMesh) { meshes++; assert.equal(o.layers.mask, 2, 'lớp 1'); assert.equal((o as THREE.Mesh).castShadow, false); } });
  assert.equal(meshes, 2, 'thân có xương (giả: 1 lưới) + mũ 1 lưới');
  /* mũ: cỡ thật theo mét và nằm trên đầu dù xương đầu tính cm */
  const hm = r.group.getObjectByName('bike-helmet') as THREE.Mesh, hb = new THREE.Box3().setFromObject(hm), hd = new THREE.Vector3();
  r.group.getObjectByName('Bip01_Head')!.getWorldPosition(hd);
  const sz = hb.getSize(new THREE.Vector3());
  assert.ok(sz.x > 0.2 && sz.x < 0.45 && sz.y > 0.08 && sz.y < 0.3, `mũ cỡ ${sz.toArray().map((v) => v.toFixed(3))}`);
  assert.ok(hb.getCenter(new THREE.Vector3()).distanceTo(hd) < 0.25, 'mũ ở quanh xương đầu');
  r.dispose(); b.dispose();
  /* xe còn hình tạm: người ẩn (hình tạm đã có người khối) */
  bkModelSetLoader(() => new Promise(() => {}));
  const t = new BkBike(), r2 = new BkRider(fakeSource());
  t.place(place()); r2.update(t, sig(), 1 / 60);
  assert.equal(r2.group.visible, false);
  r2.dispose(); t.dispose();
});

test('đích ngoài tầm: tay duỗi về phía đích, không NaN', async () => {
  const b = await realBike(), r = new BkRider(fakeSource());
  b.place(place());
  b.anchors.gripL.position.set(1.5, 0.8, -1.2);     // xa ngoài tầm với
  r.update(b, sig(), 1 / 60);
  for (const q of quats(r)) assert.ok(Number.isFinite(q.x + q.y + q.z + q.w));
  const sh = new THREE.Vector3(), hd = new THREE.Vector3(), tg = new THREE.Vector3();
  r.group.getObjectByName('Bip01_L_UpperArm')!.getWorldPosition(sh);
  r.group.getObjectByName('Bip01_L_Hand')!.getWorldPosition(hd);
  b.anchors.gripL.getWorldPosition(tg);
  const cos = hd.sub(sh).normalize().dot(tg.sub(sh).normalize());
  assert.ok(cos > 0.97, `tay hướng về đích: cos ${cos.toFixed(3)}`);
  r.dispose(); b.dispose();
});

test('setFirstPerson: xương đầu scale ≈ 0, tắt thì về 1', async () => {
  const b = await realBike(), r = new BkRider(fakeSource());
  b.place(place()); r.update(b, sig(), 1 / 60);
  const head = r.group.getObjectByName('Bip01_Head')!;
  r.setFirstPerson(true); r.update(b, sig(), 1 / 60);
  assert.ok(head.scale.x < 1e-3 && head.scale.y < 1e-3 && head.scale.z < 1e-3);
  r.setFirstPerson(false); r.update(b, sig(), 1 / 60);
  assert.deepEqual(head.scale.toArray(), [1, 1, 1]);
  r.dispose(); b.dispose();
});

test('dt = 5 (tab ẩn lâu): mọi quaternion hữu hạn, chuẩn hóa', async () => {
  const b = await realBike(), r = new BkRider(fakeSource());
  b.place(place({ lean: 0.4, steer: 0.2 }));
  r.update(b, sig({ lean: 0.4, acc: -9, steer: 0.2, susF: 0.05 }), 5);
  r.update(b, sig({ lean: -0.4, acc: 3 }), 5);
  for (const q of quats(r)) { assert.ok(Number.isFinite(q.x + q.y + q.z + q.w)); assert.ok(Math.abs(q.length() - 1) < 1e-4); }
  r.update(b, sig(), NaN); r.update(b, sig(), -1);
  for (const q of quats(r)) assert.ok(Number.isFinite(q.x + q.y + q.z + q.w));
  r.dispose(); b.dispose();
});

test('lean 0.5: đầu nghiêng so với phương đứng ≈ 0.5 · headLean (± 0,05); tăng tốc ngả, phanh chúi', async () => {
  const b = await realBike(), r = new BkRider(fakeSource());
  const helmet = r.group.getObjectByName('bike-helmet')!;
  const rollOf = (): number => {   // góc cuộn của trục "lên" của mũ (gắn theo hướng đầu lúc đứng thẳng) trong hệ hướng xe (yaw), dương = nghiêng trái
    const u = new THREE.Vector3(0, 1, 0).applyQuaternion(helmet.getWorldQuaternion(new THREE.Quaternion()));
    u.applyAxisAngle(new THREE.Vector3(0, 1, 0), -0.4);   // bỏ yaw của xe (place yaw 0.4)
    return Math.atan2(-u.z, u.y);
  };
  for (const lean of [0.5, -0.5]) {
    b.place(place({ lean }));
    for (let i = 0; i < 300; i++) r.update(b, sig({ lean }), 1 / 60);
    const roll = rollOf();
    assert.ok(Math.abs(roll - lean * RC.headLean) <= 0.05, `lean ${lean}: đầu ${roll.toFixed(3)}, mong ${(lean * RC.headLean).toFixed(3)}`);
  }
  /* lưng: góc chúi của Spine2 so với khi đứng yên */
  b.place(place());
  const sp = r.group.getObjectByName('Bip01_Spine2')!, neck = r.group.getObjectByName('Bip01_Neck')!;
  const fore = (): number => { r.group.updateMatrixWorld(true); const a = sp.getWorldPosition(new THREE.Vector3()), c = neck.getWorldPosition(new THREE.Vector3()); return c.sub(a).applyAxisAngle(new THREE.Vector3(0, 1, 0), -0.4).x; };
  for (let i = 0; i < 300; i++) r.update(b, sig(), 1 / 60);
  const f0 = fore();
  for (let i = 0; i < 300; i++) r.update(b, sig({ acc: 3 }), 1 / 60);
  const fAcc = fore();
  for (let i = 0; i < 300; i++) r.update(b, sig({ acc: -9 }), 1 / 60);
  const fBrk = fore();
  assert.ok(fAcc < f0 - 0.005, `tăng tốc ngả sau: ${fAcc.toFixed(4)} < ${f0.toFixed(4)}`);
  assert.ok(fBrk > f0 + 0.005, `phanh chúi trước: ${fBrk.toFixed(4)} > ${f0.toFixed(4)}`);
  r.dispose(); b.dispose();
});

test('dispose: gỡ khỏi xe, giải phóng skeleton của bản sao', async () => {
  const b = await realBike(), r = new BkRider(fakeSource());
  b.place(place()); r.update(b, sig(), 1 / 60);
  let sk: THREE.Skeleton | null = null;
  r.group.traverse((o) => { if ((o as THREE.SkinnedMesh).isSkinnedMesh) sk = (o as THREE.SkinnedMesh).skeleton; });
  let disposed = 0; sk!.dispose = () => { disposed++; };
  r.dispose();
  assert.equal(r.group.parent, null);
  assert.equal(disposed, 1);
  b.dispose();
});

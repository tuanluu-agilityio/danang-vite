/* ===== Xe máy: người lái có xương (src/explore/bike/rider.ts) =====
   Node, không GPU: nhân vật giả = cây xương Bip01_* tư thế đứng chữ A (vị trí lấy từ public/people/p0.glb, quay cục bộ đơn vị) + một SkinnedMesh nhỏ,
   nguồn qua stRigSource (5 đoạn rỗng); xe = BkBike với cảnh giả cùng cấu trúc scooter.glb (neo đúng số của glb thật). */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { CONFIG } from '../../src/config.ts';
import { BkBike, bkModelSetLoader, type BkPlace } from '../../src/explore/bike/model.ts';
import { BkRider, bkRiderPose, BK_POSE_N, type BkRiderSig } from '../../src/explore/bike/rider.ts';
import { fakeBike, fakeSource } from './fakes.ts';

const RC = CONFIG.bike.rider;

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

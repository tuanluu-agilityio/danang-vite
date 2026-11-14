/* ===== Xe máy: test hình xe (src/explore/bike/model.ts) với bộ nạp giả =====
   Node, không GPU: bkModelSetLoader trả cảnh dựng tay cùng cấu trúc scooter.glb (scooter → body 4 lưới + neo chân / yên / mắt, front 4 lưới + tay nắm + wheel_f,
   wheel_r; extras.axis của front nằm ở userData như GLTFLoader). Dữ liệu glb thật: tests/bike-unit/glb.test.ts. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { CONFIG } from '../../src/config.ts';
import { shared } from '../../src/core/shared.ts';
import { BkBike, bkModelLoad, bkModelSetLoader, bkModelSetWarm, type BkPlace } from '../../src/explore/bike/model.ts';

const R = CONFIG.bike.body.wheelDia / 2, HALF = CONFIG.bike.body.wheelbase / 2;
const AXIS = new THREE.Vector3(-0.375, 0.927, 0).normalize();
const mat = (name: string): THREE.MeshStandardMaterial => { const m = new THREE.MeshStandardMaterial(); m.name = name; return m; };
const empty = (name: string, x: number, y: number, z: number): THREE.Object3D => { const o = new THREE.Object3D(); o.name = name; o.position.set(x, y, z); return o; };

/* Cảnh giả giống scooter.glb */
function fakeScene(): THREE.Object3D {
  const root = new THREE.Group(); root.name = 'scooter';
  const body = new THREE.Group(); body.name = 'body';
  for (const n of ['body', 'lamp_tail', 'lamp_sig_l', 'lamp_sig_r']) body.add(new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.1, 0.1), mat(n)));
  body.add(empty('foot_l', 0.1, 0.28, -0.13), empty('foot_r', 0.1, 0.28, 0.13), empty('seat', -0.38, 0.85, 0), empty('eye', -0.43, 1.53, 0));
  const front = new THREE.Group(); front.name = 'front'; front.position.set(0.2, 0.6, 0); front.userData.axis = [AXIS.x, AXIS.y, AXIS.z];
  for (const n of ['trim', 'lamp_head', 'mirror', 'dash']) front.add(new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.1, 0.1), mat(n)));
  front.add(empty('grip_l', -0.27, 0.48, -0.3), empty('grip_r', -0.27, 0.48, 0.3));
  const wg = new THREE.CylinderGeometry(R, R, 0.1, 16).rotateX(Math.PI / 2);
  const wf = new THREE.Mesh(wg, mat('trim')); wf.name = 'wheel_f'; wf.position.set(HALF - 0.2, R - 0.6, 0); front.add(wf);
  const wr = new THREE.Mesh(wg, mat('trim')); wr.name = 'wheel_r'; wr.position.set(-HALF, R, 0);
  root.add(body, front, wr);
  return root;
}
const tick = () => new Promise((r) => setTimeout(r, 0));
const place = (o: Partial<BkPlace> = {}): BkPlace => ({ x: 10, y: 2.6, z: 3, yaw: 0, pitch: 0, lean: 0, steer: 0, wheel: 0, susF: 0, susR: 0, braking: false, sig: 0, ...o });
const meshes = (o: THREE.Object3D): THREE.Mesh[] => { const a: THREE.Mesh[] = []; o.traverse((c) => { if ((c as THREE.Mesh).isMesh) a.push(c as THREE.Mesh); }); return a; };
const byName = (b: BkBike, n: string): THREE.Object3D => { const o = b.group.getObjectByName(n); assert.ok(o, `thiếu ${n}`); return o!; };
const wpos = (o: THREE.Object3D, local = new THREE.Vector3()): THREE.Vector3 => { o.updateWorldMatrix(true, false); return local.clone().applyMatrix4(o.matrixWorld); };
async function realBike(): Promise<BkBike> {
  bkModelSetLoader(async () => fakeScene());
  const b = new BkBike();
  await tick(); await tick(); await tick();
  assert.equal(b.real, true, 'phải đổi sang mô hình thật');
  return b;
}

test('nạp lỗi ⇒ bkModelLoad null, BkBike giữ hình tạm, không ném', async () => {
  const warn = console.warn; let warned = 0; console.warn = () => { warned++; };
  try {
    bkModelSetLoader(() => Promise.reject(new Error('mạng')));
    const b = new BkBike();
    b.place(place());
    assert.equal(await bkModelLoad(), null);
    await tick(); await tick();
    assert.equal(b.real, false);
    assert.equal(meshes(b.group).length, 2, 'hình tạm 1 + bóng 1');
    assert.equal(b.dashMat, null);
    assert.equal(await bkModelLoad(), null, 'nhớ đệm, không nạp lại');
    assert.equal(warned, 1, 'warn đúng một lần');
    b.dispose();
    bkModelSetLoader(async () => new THREE.Group());     // thiếu nút
    assert.equal(await bkModelLoad(), null);
    const old = CONFIG.bike.model.timeoutMs; CONFIG.bike.model.timeoutMs = 20;
    try { bkModelSetLoader(() => new Promise(() => {})); assert.equal(await bkModelLoad(), null, 'quá giờ → null'); } finally { CONFIG.bike.model.timeoutMs = old; }
  } finally { console.warn = warn; }
});

test('nạp xong sau dispose() ⇒ không thêm con vào group', async () => {
  let done: (o: THREE.Object3D) => void = () => {};
  bkModelSetLoader(() => new Promise((r) => { done = r; }));
  const b = new BkBike();
  const before = b.group.children.length;
  b.dispose();
  done(fakeScene());
  await tick(); await tick(); await tick();
  assert.equal(b.real, false);
  assert.equal(b.group.children.length, before, 'không thêm con');
  assert.equal(meshes(b.group).filter((m) => (m.material as THREE.Material).name === 'body').length, 0);
});

test('tải xong thì đổi sang mô hình thật: lớp 1, không bóng, neo, dashMat, vị trí giữ nguyên; tải muộn hơn timeoutMs vẫn đổi', async () => {
  const warn = console.warn; console.warn = () => {};
  const old = CONFIG.bike.model.timeoutMs; CONFIG.bike.model.timeoutMs = 20;
  try {
    let done: (o: THREE.Object3D) => void = () => {};
    bkModelSetLoader(() => new Promise((r) => { done = r; }));
    const b = new BkBike();
    b.place(place({ x: 12, y: 3, z: -4, yaw: 0.7 }));
    assert.equal(await bkModelLoad(), null, 'quá giờ → null');
    done(fakeScene());
    await tick(); await tick(); await tick();
    assert.equal(b.real, true, 'tải xong muộn vẫn đổi');
    assert.ok(Math.abs(b.group.position.x - 12) < 1e-9 && Math.abs(b.group.position.z + 4) < 1e-9);
    const ms = meshes(b.group);
    assert.equal(ms.filter((m) => (m.material as THREE.Material).name === 'bikeTemp').length, 0, 'hết hình tạm');
    assert.equal(ms.length, 11, '8 lưới thân + 2 bánh + 1 bóng');
    assert.ok(ms.every((m) => m.layers.isEnabled(1) && !m.layers.isEnabled(0) && !m.castShadow), 'lớp 1, không đổ bóng');
    assert.ok(b.dashMat instanceof THREE.MeshBasicMaterial, 'dashMat là MeshBasicMaterial');
    assert.ok(ms.some((m) => m.material === b.dashMat), 'lưới đồng hồ dùng dashMat');
    for (const k of ['gripL', 'gripR', 'footL', 'footR', 'seat', 'eye'] as const) assert.ok(b.anchors[k].parent, `neo ${k} gắn vào mô hình`);
    assert.equal(b.anchors.gripL.parent!.name, 'front', 'tay nắm theo cổ lái');
    b.dispose();
  } finally { CONFIG.bike.model.timeoutMs = old; console.warn = warn; }
});

test('place(): steer = 0.3 xoay front quanh trục cổ lái đúng 0,3 rad; kẹp ở steerLock', async () => {
  const b = await realBike();
  const front = byName(b, 'front'), grip = b.anchors.gripL, wf = byName(b, 'wheel_f');
  b.place(place({ yaw: 0 }));
  const q0 = front.quaternion.clone(), g0 = wpos(grip), w0 = wpos(wf);
  b.place(place({ yaw: 0, steer: 0.3 }));
  const dq = q0.clone().invert().multiply(front.quaternion);
  const ang = 2 * Math.acos(Math.min(1, Math.abs(dq.w)));
  assert.ok(Math.abs(ang - 0.3) < 1e-6, `góc ${ang}`);
  const ax = new THREE.Vector3(dq.x, dq.y, dq.z).normalize().multiplyScalar(Math.sign(dq.w));
  assert.ok(ax.distanceTo(AXIS) < 1e-6, `trục ${ax.toArray()}`);
  assert.ok(wpos(grip).distanceTo(g0) > 0.05, 'tay nắm theo cổ lái');
  assert.ok(wpos(wf).z < w0.z - 0.01, 'steer > 0 (trái): bánh trước lệch về −Z');
  b.place(place({ steer: 2 }));
  const dq2 = q0.clone().invert().multiply(front.quaternion);
  assert.ok(Math.abs(2 * Math.acos(Math.min(1, Math.abs(dq2.w))) - CONFIG.bike.model.steerLock) < 1e-6, 'kẹp ở steerLock');
  b.dispose();
});

test('place(): lean = 0.4 ⇒ điểm chạm đất bánh sau giữ nguyên (± 1 mm), thân nghiêng về trái', async () => {
  const b = await realBike();
  const wr = byName(b, 'wheel_r'), seat = b.anchors.seat;
  const contact = new THREE.Vector3(0, -R, 0);
  b.place(place({ x: 5, y: 2, z: 1, yaw: 0.9, pitch: 0.03, wheel: 0 }));
  const c0 = wpos(wr, contact), s0 = wpos(seat);
  b.place(place({ x: 5, y: 2, z: 1, yaw: 0.9, pitch: 0.03, wheel: 0, lean: 0.4 }));
  const c1 = wpos(wr, contact);
  assert.ok(c1.distanceTo(c0) < 1e-3, `lệch ${c1.distanceTo(c0)} m`);
  const s1 = wpos(seat);
  const left = new THREE.Vector3(-Math.sin(0.9), 0, -Math.cos(0.9));   // trái của xe yaw 0,9 = −Z cục bộ
  assert.ok(s1.clone().sub(s0).dot(left) > 0.2, 'nghiêng trái: yên dời sang trái');
  assert.ok(s1.y < s0.y, 'nghiêng thì yên thấp xuống');
  b.dispose();
});

test('place(): bánh lăn theo wheel; giảm xóc giữ hai bánh chạm đất', async () => {
  const b = await realBike();
  const wr = byName(b, 'wheel_r'), wf = byName(b, 'wheel_f');
  const top = new THREE.Vector3(0, R, 0);
  b.place(place({ x: 0, y: 0, z: 0 }));
  const t0 = wpos(wr, top);
  b.place(place({ x: 0, y: 0, z: 0, wheel: 0.5 }));
  const t1 = wpos(wr, top);
  assert.ok(t1.x > t0.x + 0.05, 'xe tiến: đỉnh bánh lăn về trước (+X)');
  for (const s of [{ susF: 0.05, susR: 0 }, { susF: 0, susR: 0.05 }, { susF: 0.04, susR: -0.03 }]) {
    b.place(place({ x: 0, y: 0, z: 0, ...s }));
    assert.ok(Math.abs(wpos(wf).y - R) < 2e-3 && Math.abs(wpos(wr).y - R) < 2e-3, `tâm hai bánh cao R khi ${JSON.stringify(s)}: ${wpos(wf).y}, ${wpos(wr).y}`);
  }
  b.place(place({ x: 0, y: 0, z: 0 }));
  const s0 = wpos(b.anchors.gripL).y;
  b.place(place({ x: 0, y: 0, z: 0, susF: 0.05 }));
  assert.ok(wpos(b.anchors.gripL).y < s0 - 0.015, 'nén giảm xóc trước: đầu xe chúi xuống');
  b.dispose();
});

test('đèn: phanh đổi vật liệu đèn hậu, xi nhan nháy theo sigHz bằng shared.uTime, cùng khóa program', async () => {
  const b = await realBike();
  const lamp = (n: string) => meshes(b.group).find((m) => (m.material as THREE.Material).name === n)!;
  const tail = lamp('lamp_tail'), sl = lamp('lamp_sig_l'), sr = lamp('lamp_sig_r');
  const t0 = tail.material as THREE.Material, l0 = sl.material as THREE.Material, r0 = sr.material as THREE.Material;
  b.place(place({ braking: true }));
  assert.notEqual(tail.material, t0, 'phanh: đổi sang bản đèn phanh');
  assert.equal((tail.material as THREE.Material).customProgramCacheKey(), t0.customProgramCacheKey(), 'cùng program');
  b.place(place({ braking: false }));
  assert.equal(tail.material, t0);
  const hz = CONFIG.bike.model.sigHz, old = shared.uTime.value;
  try {
    shared.uTime.value = 0.1 / hz;                 // pha 0,1: sáng
    b.place(place({ sig: 1 }));
    assert.notEqual(sl.material, l0, 'xi nhan trái sáng'); assert.equal(sr.material, r0, 'xi nhan phải tắt');
    shared.uTime.value = 0.6 / hz;                 // pha 0,6: tắt
    b.place(place({ sig: 1 }));
    assert.equal(sl.material, l0, 'nửa chu kỳ sau tắt');
    shared.uTime.value = 1.1 / hz;
    b.place(place({ sig: -1 }));
    assert.notEqual(sr.material, r0, 'xi nhan phải sáng'); assert.equal(sl.material, l0);
    b.place(place({ sig: 0 }));
    assert.equal(sr.material, r0); assert.equal(sl.material, l0);
  } finally { shared.uTime.value = old; }
  b.dispose();
});

test('làm nóng shader phủ mô hình, đồng hồ, hình tạm và tấm bóng; cảnh nguồn trả về không còn cha', async () => {
  const seen: THREE.Object3D[] = [];
  bkModelSetWarm(async (o) => { o.traverse((c) => seen.push(c)); });
  try {
    bkModelSetLoader(async () => fakeScene());
    const src = await bkModelLoad();
    assert.ok(src, 'nạp được');
    const names = new Set(seen.filter((o) => (o as THREE.Mesh).isMesh).map((o) => ((o as THREE.Mesh).material as THREE.Material).name));
    for (const n of ['body', 'trim', 'lamp_head', 'lamp_tail', 'lamp_sig_l', 'mirror', 'bikeDash', 'bikeTemp', 'bikeShadow']) assert.ok(names.has(n), `có ${n}`);
    assert.equal(src!.scene.parent, null);
  } finally { bkModelSetWarm(null); bkModelSetLoader(null); }
});

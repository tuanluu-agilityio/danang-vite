/* ===== Người treo dù: điều phối (src/explore/pilot/index.ts, rig.ts, bones.ts, load.ts) =====
   Node, không GPU: bộ nạp giả qua __plSetLoader trả nguồn dựng tay (cây xương Bip01_* tư thế ngồi + một SkinnedMesh nhỏ + đoạn `sit` rỗng).
   Kiểm hình tạm trước khi nạp / khi nạp lỗi, dù ẩn lúc nguồn về (Review Focus 1), dt xấu, gỡ, nhiều dù dùng chung nguồn. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { exPlaceGlider, exGliderGeometry } from '../../src/explore/glider.ts';
import { exCreate } from '../../src/explore/flight.ts';
import { plUpdate, plReset, plDetach, plDebug, __plSetLoader } from '../../src/explore/pilot/index.ts';
import { plSource, type PlSource } from '../../src/explore/pilot/load.ts';

/* Cây xương ngồi (m, hệ +X trước mặt, +Y lên, +Z phải): vị trí cục bộ so với cha */
function fakeScene(): THREE.Group {
  const scene = new THREE.Group(), bip = new THREE.Object3D(); bip.name = 'Bip01'; scene.add(bip);
  const bones: THREE.Bone[] = [];
  const mk = (name: string, parent: THREE.Object3D, x: number, y: number, z: number): THREE.Bone => { const b = new THREE.Bone(); b.name = 'Bip01_' + name; b.position.set(x, y, z); parent.add(b); bones.push(b); return b; };
  const pel = mk('Pelvis', bip, 0, 0, 0), sp = mk('Spine', pel, 0, 0.1, 0), sp1 = mk('Spine1', sp, 0, 0.12, 0), sp2 = mk('Spine2', sp1, 0, 0.14, 0);
  const neck = mk('Neck', sp2, 0, 0.15, 0); mk('Head', neck, 0, 0.1, 0);
  for (const [s, z] of [['L', -1], ['R', 1]] as const) {
    const cl = mk(`${s}_Clavicle`, sp2, 0, 0.12, z * 0.03), ua = mk(`${s}_UpperArm`, cl, 0, 0, z * 0.15);
    const fa = mk(`${s}_Forearm`, ua, 0, -0.28, 0), h = mk(`${s}_Hand`, fa, 0.26, 0, 0);
    for (let f = 0; f < 5; f++) { let p: THREE.Object3D = h; for (const sfx of ['', '1', '2']) p = mk(`${s}_Finger${f}${sfx}`, p, f === 0 ? 0.03 : 0.08, -0.01, z * (f - 2) * 0.015); }
    const th = mk(`${s}_Thigh`, pel, 0, -0.05, z * 0.1), ca = mk(`${s}_Calf`, th, 0.42, 0, 0); mk(`${s}_Foot`, ca, 0, -0.42, 0);
  }
  scene.updateMatrixWorld(true);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0, 0.1, 0, 0, 0, 0.1, 0], 3));
  g.setAttribute('skinIndex', new THREE.Uint16BufferAttribute([0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], 4));
  g.setAttribute('skinWeight', new THREE.Float32BufferAttribute([1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0], 4));
  const m = new THREE.SkinnedMesh(g, new THREE.MeshStandardMaterial()); m.name = 'pilot'; m.castShadow = true;
  bip.add(m); m.bind(new THREE.Skeleton(bones));
  return scene;
}
/* Bản sao giả của SkeletonUtils.clone: clone() rồi gắn lại skeleton của SkinnedMesh sang xương mới theo tên */
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
const fakeSource = (): PlSource => plSource(fakeScene(), [new THREE.AnimationClip('sit', 1, [])], cloneSk);

function deferred() {
  let calls = 0, res: (v: PlSource | null) => void = () => {};
  const fn = () => { calls++; return new Promise<PlSource | null>((r) => { res = r; }); };
  return { fn, get calls() { return calls; }, resolve: (v: PlSource | null) => res(v) };
}
/* Dù giả như exBuildGlider (không cần canvas): Group + một Mesh hình 'full' */
function exBuildGlider(): THREE.Group { const g = new THREE.Group(); g.name = 'ex-glider'; g.add(new THREE.Mesh(exGliderGeometry('full'), new THREE.MeshStandardMaterial())); return g; }
const tick = () => new Promise((r) => setTimeout(r, 0));
const pilotOf = (g: THREE.Group) => g.children.find((c) => c.name === 'ex-pilot');
const wingGeo = (g: THREE.Group) => (g.children[0] as THREE.Mesh).geometry;

test('trước khi nạp xong: hình full, không có ex-pilot; nạp xong: canopy + ex-pilot, real', async () => {
  const L = deferred(); __plSetLoader(L.fn);
  const g = exBuildGlider(), s = exCreate();
  exPlaceGlider(g, s, 1 / 60);
  assert.equal(wingGeo(g), exGliderGeometry('full')); assert.equal(pilotOf(g), undefined);
  assert.equal(plDebug(g)!.real, false);
  L.resolve(fakeSource()); await tick();
  exPlaceGlider(g, s, 1 / 60);
  assert.equal(wingGeo(g), exGliderGeometry('canopy'));
  const p = pilotOf(g)!; assert.ok(p);
  const d = plDebug(g)!;
  assert.equal(d.real, true);
  assert.ok(d.calls <= 4, `lệnh vẽ ${d.calls}`);
  p.traverse((o) => {
    assert.equal(o.layers.mask, 2, `${o.name || o.type} ở lớp 1`);
    const m = o as THREE.Mesh;
    if (m.isMesh) { assert.equal(m.castShadow, false); assert.equal(m.frustumCulled, false); }
  });
  for (const e of d.handErr) assert.ok(Number.isFinite(e) && e >= 0 && e < 0.05, `handErr ${e}`);
  assert.equal(L.calls, 1);
  plDetach(g);
});

test('bộ nạp trả null: giữ full mãi, chỉ gọi bộ nạp một lần', async () => {
  const L = deferred(); __plSetLoader(L.fn);
  const g = exBuildGlider(), s = exCreate();
  exPlaceGlider(g, s, 1 / 60); L.resolve(null); await tick();
  for (let i = 0; i < 5; i++) exPlaceGlider(g, s, 1 / 60);
  assert.equal(wingGeo(g), exGliderGeometry('full')); assert.equal(pilotOf(g), undefined);
  assert.equal(L.calls, 1);
});

test('dù ẩn lúc nguồn về: không gắn; hiện lại thì gắn', async () => {
  const L = deferred(); __plSetLoader(L.fn);
  const g = exBuildGlider(), s = exCreate();
  exPlaceGlider(g, s, 1 / 60);
  g.visible = false; L.resolve(fakeSource()); await tick();
  exPlaceGlider(g, s, 1 / 60);
  assert.equal(pilotOf(g), undefined); assert.equal(wingGeo(g), exGliderGeometry('full'));
  g.visible = true; exPlaceGlider(g, s, 1 / 60);
  assert.ok(pilotOf(g));
  plDetach(g);
});

test('dt NaN / 30 / âm và trạng thái cực đoan: mọi quaternion xương hữu hạn; plReset, plDetach', async () => {
  __plSetLoader(() => Promise.resolve(fakeSource()));
  const g = exBuildGlider(), s = exCreate();
  exPlaceGlider(g, s, 1 / 60); await tick();
  for (const dt of [NaN, 30, -1, 1 / 60, Infinity, 0.5]) { s.bank = dt === 30 ? 9 : -9; s.pos.x += 500; s.pos.y += dt === 0.5 ? NaN : 3; exPlaceGlider(g, s, dt, { turn: 1, climb: 0, throttle: 0 }); }
  s.pos.y = 300;
  const p = pilotOf(g)!;
  const bad: string[] = [];
  p.traverse((o) => { const q = o.quaternion, v = o.position; if (![q.x, q.y, q.z, q.w, v.x, v.y, v.z].every(Number.isFinite)) bad.push(o.name); });
  assert.deepEqual(bad, []);
  plReset(g);
  const d = plDebug(g)!; assert.equal(d.pose.swingRoll, 0);
  plDetach(g);
  assert.equal(pilotOf(g), undefined); assert.equal(wingGeo(g), exGliderGeometry('full'));
  assert.equal(plDebug(g), null);
});

test('5 dù cùng lúc dùng chung nguồn, mỗi dù skeleton riêng, hình học trang bị dùng chung', async () => {
  let n = 0;
  __plSetLoader(() => { n++; return Promise.resolve(fakeSource()); });
  const gs = Array.from({ length: 5 }, () => exBuildGlider()), s = exCreate();
  for (const g of gs) exPlaceGlider(g, s, 1 / 60);
  await tick();
  for (const g of gs) exPlaceGlider(g, s, 1 / 60);
  assert.equal(n, 1);
  const sks = new Set<THREE.Skeleton>(), geos = new Set<THREE.BufferGeometry>(), bodyGeos = new Set<THREE.BufferGeometry>();
  for (const g of gs) {
    pilotOf(g)!.traverse((o) => {
      const m = o as THREE.SkinnedMesh;
      if (!m.isSkinnedMesh) return;
      sks.add(m.skeleton);
      if (m.name === 'pl-gear') geos.add(m.geometry); else bodyGeos.add(m.geometry);
    });
  }
  assert.equal(sks.size, 10, 'mỗi dù 2 skeleton riêng (nhân vật + trang bị)');
  assert.equal(geos.size, 1); assert.equal(bodyGeos.size, 1);
  for (const g of gs) plDetach(g);
});

test('userData.plOff (dù người khác trên điện thoại): không gắn', async () => {
  __plSetLoader(() => Promise.resolve(fakeSource()));
  const g = exBuildGlider(), s = exCreate(); g.userData.plOff = true;
  exPlaceGlider(g, s, 1 / 60); await tick(); exPlaceGlider(g, s, 1 / 60);
  assert.equal(pilotOf(g), undefined); assert.equal(plDebug(g), null);
});

test('dựng rig ném lỗi: một warn, giữ hình full, không thử lại ở khung sau lẫn dù khác, plUpdate không ném', async () => {
  const src = plSource(fakeScene(), [new THREE.AnimationClip('sit', 1, [])], () => { throw new Error('clone hỏng'); });
  let n = 0;
  __plSetLoader(() => { n++; return Promise.resolve(src); });
  const gs = [exBuildGlider(), exBuildGlider()], s = exCreate();
  const oldWarn = console.warn, warns: unknown[][] = [];
  console.warn = (...a: unknown[]) => { warns.push(a); };
  try {
    for (const g of gs) exPlaceGlider(g, s, 1 / 60);
    await tick();
    for (let i = 0; i < 4; i++) for (const g of gs) assert.doesNotThrow(() => exPlaceGlider(g, s, 1 / 60));
  } finally { console.warn = oldWarn; }
  assert.equal(warns.length, 1, 'đúng một warn');
  assert.equal(n, 1, 'bộ nạp một lần');
  for (const g of gs) { assert.equal(wingGeo(g), exGliderGeometry('full')); assert.equal(pilotOf(g), undefined); assert.equal(plDebug(g)!.real, false); plDetach(g); }
});

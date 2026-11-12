/* ===== Người treo dù: trang bị + hình học cánh (src/explore/pilot/gear.ts, src/explore/glider.ts) ===== */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { CONFIG } from '../../src/config.ts';
import { exGliderGeometry, exLineTops, exBrakeTops, exHangY } from '../../src/explore/glider.ts';
import { PL_GEAR_BONES, plGearGeometry, plGearMaterial, type PlGearRest } from '../../src/explore/pilot/gear.ts';

const P = CONFIG.explore.pilot, GL = CONFIG.explore.glider;
const BONE = (n: typeof PL_GEAR_BONES[number]) => PL_GEAR_BONES.indexOf(n);
const hy = exHangY;
/* Vị trí nghỉ mẫu theo cùng quy ước với nhân vật thật: hông thấp hơn điểm móc hang.up, lùi hang.fore; tay ở quai phanh thả */
const rest: PlGearRest = {
  hang: [0, hy, 0],
  pelvis: [-P.hang.fore, hy - P.hang.up, 0],
  spine: [-P.hang.fore - 0.04, hy - P.hang.up + 0.2, 0],
  handL: [P.toggle.fore, hy + P.toggle.up, -P.toggle.half],
  handR: [P.toggle.fore, hy + P.toggle.up, P.toggle.half],
  thighL: [-P.hang.fore, hy - P.hang.up, -0.1],
  thighR: [-P.hang.fore, hy - P.hang.up, 0.1]
};
const tris = (g: THREE.BufferGeometry) => (g.index ? g.index.count : g.getAttribute('position').count) / 3;
const bbox = (g: THREE.BufferGeometry) => { g.computeBoundingBox(); return g.boundingBox!; };

test('hình học trang bị: trần tam giác, thuộc tính, trọng số, không NaN', () => {
  const g = plGearGeometry(rest), n = g.getAttribute('position').count;
  assert.ok(tris(g) <= 6000, `tam giác ${tris(g)}`);
  assert.ok(tris(g) > 200);
  for (const k of ['position', 'normal', 'color', 'skinIndex', 'skinWeight']) assert.ok(g.getAttribute(k), k);
  const si = g.getAttribute('skinIndex'), sw = g.getAttribute('skinWeight');
  for (const name of ['position', 'normal', 'color']) for (const v of g.getAttribute(name).array) assert.ok(Number.isFinite(v), `NaN ở ${name}`);
  for (let i = 0; i < n; i++) {
    const idx = si.getX(i);
    assert.ok(Number.isInteger(idx) && idx >= 0 && idx < PL_GEAR_BONES.length, `skinIndex ${idx}`);
    const s = sw.getX(i) + sw.getY(i) + sw.getZ(i) + sw.getW(i);
    assert.ok(Math.abs(s - 1) < 1e-6, `tổng trọng số ${s}`);
  }
});

test('gắn xương: wing, hang, handL, handR, pack đều có đỉnh; dây hai đầu hai xương', () => {
  const g = plGearGeometry(rest), si = g.getAttribute('skinIndex'), n = g.getAttribute('position').count;
  const cnt = new Array(PL_GEAR_BONES.length).fill(0);
  for (let i = 0; i < n; i++) cnt[si.getX(i)]++;
  for (const b of ['wing', 'hang', 'handL', 'handR', 'pelvis', 'spine', 'pack', 'thighL', 'thighR'] as const) assert.ok(cnt[BONE(b)] > 0, `không có đỉnh ${b}`);
});

test('đầu dây trên cánh trùng điểm bám của exLineTops ∪ exBrakeTops', () => {
  const g = plGearGeometry(rest), si = g.getAttribute('skinIndex'), p = g.getAttribute('position'), n = p.count;
  const tops = [...exLineTops(), ...exBrakeTops()];
  const v = new THREE.Vector3();
  let hit = 0;
  const touched = new Set<number>();
  for (let i = 0; i < n; i++) {
    if (si.getX(i) !== BONE('wing')) continue;
    v.fromBufferAttribute(p, i);
    let best = -1;
    tops.forEach((t, k) => { if (Math.hypot(v.x - t.x, v.y - t.y, v.z - t.z) <= 0.05) best = k; });
    if (best >= 0) { hit++; touched.add(best); }
  }
  assert.ok(hit >= 2 * GL.lineCount, `đỉnh trùng ${hit}`);
  assert.equal(touched.size, tops.length, 'mỗi điểm bám phải có dây');
});

test('điểm bám: hai bên đối xứng, đúng số lượng, brake tops ở mép sau', () => {
  const lt = exLineTops(), bt = exBrakeTops();
  assert.equal(lt.length, 2 * GL.lineCount);
  assert.ok(bt.length >= 4 && bt.length <= 6 && bt.length % 2 === 0);
  for (const arr of [lt, bt]) {
    for (const s of [-1, 1]) assert.equal(arr.filter(t => t.side === s).length, arr.length / 2);
    for (const t of arr) assert.ok(Math.sign(t.z) === t.side, 'dấu z theo side');
  }
  for (const t of bt) assert.ok(t.x < -GL.chord / 2 + 0.2, 'quai phanh ở nửa sau cánh');
  assert.ok(Math.abs(exHangY + GL.lines * (1 - GL.originAt)) < 1e-9);
});

test('hộp bao theo Z đối xứng ±1 cm', () => {
  const b = bbox(plGearGeometry(rest));
  assert.ok(Math.abs(b.min.z + b.max.z) <= 0.01, `lệch ${b.min.z + b.max.z}`);
});

test('đai nổi cách thân: không đỉnh nào của tấm ngồi chui vào hông (pelvis cao hơn mặt ngồi)', () => {
  const g = plGearGeometry(rest), si = g.getAttribute('skinIndex'), p = g.getAttribute('position');
  let minY = Infinity;
  for (let i = 0; i < p.count; i++) if (si.getX(i) === BONE('pelvis')) minY = Math.min(minY, p.getY(i));
  assert.ok(minY < rest.pelvis[1], 'có tấm ngồi dưới hông');
});

test('vật liệu dùng chung, có vertexColors', () => {
  const m = plGearMaterial();
  assert.equal(m.vertexColors, true);
  assert.equal(plGearMaterial(), m);
});

test('exGliderGeometry: canopy không có gì thấp hơn exHangY + 1; full thấp tới dưới điểm treo', () => {
  const c = exGliderGeometry('canopy'), f = exGliderGeometry('full');
  assert.ok(bbox(c).min.y >= exHangY + 1, `canopy thấp nhất ${bbox(c).min.y}`);
  assert.ok(f.getAttribute('position').count > c.getAttribute('position').count);
  assert.ok(bbox(f).min.y < exHangY, `full thấp nhất ${bbox(f).min.y}`);
  assert.equal(exGliderGeometry('full'), f, 'dựng một lần');
  assert.equal(exGliderGeometry('canopy'), c);
  /* cánh của canopy giống hệt phần cánh đầu của full (cùng đỉnh, cùng thứ tự) */
  const cp = c.getAttribute('position'), fp = f.getAttribute('position');
  for (let i = 0; i < cp.count; i++) assert.ok(cp.getX(i) === fp.getX(i) && cp.getY(i) === fp.getY(i) && cp.getZ(i) === fp.getZ(i), `đỉnh ${i}`);
});

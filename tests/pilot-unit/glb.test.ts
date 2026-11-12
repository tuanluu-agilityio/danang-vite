/* ===== Dù lượn: nhân vật người treo public/people/pilot.glb (sinh bằng scripts/people/pilot.py) — đọc phần JSON của GLB, không cần three ===== */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join, dirname } from 'node:path';

const DIR = join(dirname(fileURLToPath(import.meta.url)), '../../public/people');
const FILE = join(DIR, 'pilot.glb');
const MB = 1024 * 1024;
// xương bắt buộc (bộ điều khiển xương của dù lượn dùng), tên gốc Rocketbox; three đổi dấu cách thành '_'
const BONES = ['Pelvis', 'Spine', 'Spine1', 'Spine2', 'Neck', 'Head', 'L Clavicle', 'L UpperArm', 'L Forearm', 'L Hand', 'L Thigh', 'L Calf', 'L Foot',
  'R Clavicle', 'R UpperArm', 'R Forearm', 'R Hand', 'R Thigh', 'R Calf', 'R Foot'].map(b => 'Bip01 ' + b);
const FINGERS = ['L', 'R'].flatMap(s => [0, 1, 2, 3, 4].flatMap(i => [`Bip01 ${s} Finger${i}`, `Bip01 ${s} Finger${i}1`, `Bip01 ${s} Finger${i}2`]));

/* Đọc khối JSON đầu tiên của file GLB (header 12 byte, rồi chunk JSON) */
function glbJson(file: string): any {
  const b = readFileSync(file);
  assert.equal(b.readUInt32LE(0), 0x46546c67, 'không phải GLB');            // 'glTF'
  const len = b.readUInt32LE(12), type = b.readUInt32LE(16);
  assert.equal(type, 0x4e4f534a, 'chunk đầu không phải JSON');              // 'JSON'
  return JSON.parse(b.subarray(20, 20 + len).toString('utf8'));
}

/* Số tam giác của một primitive (TRIANGLES, có hoặc không có chỉ mục) */
function tris(j: any, p: any): number {
  assert.ok(p.mode === undefined || p.mode === 4, 'primitive không phải TRIANGLES');
  const acc = j.accessors[p.indices ?? p.attributes.POSITION];
  return acc.count / 3;
}

test('pilot.glb tồn tại, ≤ 2,5 MB', () => {
  assert.ok(existsSync(FILE), 'thiếu pilot.glb');
  const n = statSync(FILE).size;
  assert.ok(n <= 2.5 * MB, `pilot.glb ${n} byte > 2,5 MB`);
});

test('pilot.glb: ≤ 25 000 tam giác, ≤ 80 khớp, ≤ 2 lưới / 2 vật liệu, không nén', () => {
  const j = glbJson(FILE);
  let t = 0;
  for (const m of j.meshes) for (const p of m.primitives) t += tris(j, p);
  assert.ok(t > 0 && t <= 25000, `${t} tam giác`);
  assert.equal(j.skins?.length, 1, 'phải có đúng 1 skin');
  const nj = j.skins[0].joints.length;
  assert.ok(nj >= 20 && nj <= 80, `${nj} khớp`);
  assert.ok(j.meshes.length <= 2, `${j.meshes.length} lưới`);
  assert.ok((j.materials ?? []).length <= 2, `${j.materials?.length} vật liệu`);
  const used: string[] = j.extensionsUsed ?? [];
  assert.ok(!used.includes('KHR_draco_mesh_compression') && !used.includes('EXT_meshopt_compression'), 'không dùng Draco / Meshopt');
});

test('pilot.glb: đoạn sit dài 3–7 s', () => {
  const j = glbJson(FILE);
  const a = (j.animations ?? []).find((x: any) => x.name === 'sit');
  assert.ok(a, 'thiếu đoạn sit');
  let dur = 0;
  for (const s of a.samplers) dur = Math.max(dur, j.accessors[s.input].max?.[0] ?? 0);
  assert.ok(dur >= 3 && dur <= 7, `sit dài ${dur} s`);
});

/* Đọc accessor float (không stride) từ chunk BIN của GLB */
function floats(file: string, j: any, i: number): { n: number; count: number; d: Float32Array } {
  const b = readFileSync(file), len = b.readUInt32LE(12), bin = 20 + len + 8;
  const a = j.accessors[i], v = j.bufferViews[a.bufferView];
  assert.equal(a.componentType, 5126, `accessor ${i} không phải float`);
  assert.ok(!v.byteStride, `accessor ${i} có byteStride`);
  const n = ({ SCALAR: 1, VEC3: 3, VEC4: 4 } as Record<string, number>)[a.type];
  const off = bin + (v.byteOffset ?? 0) + (a.byteOffset ?? 0);
  return { n, count: a.count, d: new Float32Array(b.buffer.slice(b.byteOffset + off, b.byteOffset + off + a.count * n * 4)) };
}

// Khép vòng sit: khung đầu và khung cuối mỗi kênh xoay lệch ≤ 0,1° (bản sinh ngày 2026-11-13 lệch tối đa ≈ 0,035°)
const LOOP_DEG = 0.1;

test('pilot.glb: sit không diễn ngón tay, hông đứng yên, khép vòng', () => {
  const j = glbJson(FILE);
  const a = j.animations.find((x: any) => x.name === 'sit');
  let rot = 0;
  for (const ch of a.channels) {
    const name: string = j.nodes[ch.target.node].name ?? '';
    assert.ok(!name.includes('Finger'), `kênh ${ch.target.path} của ngón ${name}`);
    const o = floats(FILE, j, a.samplers[ch.sampler].output);
    if (/Pelvis$/.test(name) && ch.target.path === 'translation')
      for (let k = 0; k < o.count; k++) for (let q = 0; q < 3; q++)
        assert.ok(Math.abs(o.d[k * 3 + q] - o.d[q]) <= 1e-4, `hông dời ở khung ${k}: ${o.d[k * 3 + q]} so với ${o.d[q]}`);
    if (ch.target.path === 'rotation') {
      rot++;
      const z = (o.count - 1) * 4;
      const dot = Math.abs(o.d[0] * o.d[z] + o.d[1] * o.d[z + 1] + o.d[2] * o.d[z + 2] + o.d[3] * o.d[z + 3]);
      const deg = 2 * Math.acos(Math.min(1, dot)) * 180 / Math.PI;
      assert.ok(deg <= LOOP_DEG, `${name}: khung đầu / cuối lệch ${deg.toFixed(3)}° > ${LOOP_DEG}°`);
    }
  }
  assert.ok(rot >= 20, `chỉ ${rot} kênh xoay`);
});

test('pilot.glb: không có vũ khí (dao, súng)', () => {
  const j = glbJson(FILE);
  const bad = /knife|pistol|weapon|gun/i;
  for (const k of ['nodes', 'meshes', 'materials', 'images', 'textures']) for (const x of j[k] ?? []) assert.ok(!bad.test(x.name ?? ''), `${k}: ${x.name}`);
});

test('pilot.glb: đủ xương bắt buộc (thân, tay, chân, ngón)', () => {
  const j = glbJson(FILE);
  const names = new Set(j.nodes.map((n: any) => n.name));
  for (const b of [...BONES, ...FINGERS]) assert.ok(names.has(b) || names.has(b.replace(/ /g, '_')), `thiếu xương ${b}`);
});

test('pilot.glb: extras height, hip (m)', () => {
  const j = glbJson(FILE);
  const e = j.scenes?.[0]?.extras ?? {};
  assert.equal(typeof e.height, 'number', 'thiếu height');
  assert.ok(e.height > 1.5 && e.height < 2.1, `height ${e.height}`);
  assert.equal(typeof e.hip, 'number', 'thiếu hip');
  assert.ok(e.hip > 0.8 && e.hip < e.height, `hip ${e.hip}`);
});

test('LICENSE-Rocketbox.txt ghi pilot.glb và Military_Male_01', () => {
  const t = readFileSync(join(DIR, 'LICENSE-Rocketbox.txt'), 'utf8');
  assert.match(t, /pilot\.glb/);
  assert.match(t, /Military_Male_01/);
  assert.match(t, /MIT/);
});

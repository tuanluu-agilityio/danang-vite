/* ===== Xe máy: public/bike/scooter.glb (sinh bằng scripts/bike/convert.py, npm run gen:bike) — đọc phần JSON của GLB, không cần three =====
   Kiểm: trần dung lượng / tam giác (CONFIG.bike.model), cây nút + nút neo, vật liệu đặt tên, số primitive (= lệnh vẽ), hướng / gốc / đáy lốp,
   trục cổ lái trong extras của `front`, UV mặt đồng hồ 0..1, giấy phép CC0 + README. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join, dirname } from 'node:path';
import { CONFIG } from '../../src/config.ts';

const DIR = join(dirname(fileURLToPath(import.meta.url)), '../../public/bike');
const FILE = join(DIR, 'scooter.glb');
const M = CONFIG.bike.model, B = CONFIG.bike.body;
/* Trần primitive: 8 vật liệu đặt tên phân bố trên hai nút thân (body: body, lamp_tail, lamp_sig_l, lamp_sig_r; front: trim, lamp_head, mirror, dash)
   cộng 2 bánh (mỗi bánh 1 primitive trim) = 10. Brief ghi "≤ 8" nhưng 8 vật liệu riêng + 2 bánh quay riêng không thể dưới 10 (xem báo cáo Task 3). */
const MAX_PRIMS = 10;
type Vec = [number, number, number];

function glbJson(file: string): any {
  const b = readFileSync(file);
  assert.equal(b.readUInt32LE(0), 0x46546c67, 'không phải GLB');            // 'glTF'
  const len = b.readUInt32LE(12);
  assert.equal(b.readUInt32LE(16), 0x4e4f534a, 'chunk đầu không phải JSON'); // 'JSON'
  return JSON.parse(b.subarray(20, 20 + len).toString('utf8'));
}

/* Ma trận 4x4 cột-chính của một nút (matrix hoặc TRS) */
function nodeMat(n: any): number[] {
  if (n.matrix) return n.matrix.slice();
  const [x, y, z, w] = n.rotation ?? [0, 0, 0, 1], [sx, sy, sz] = n.scale ?? [1, 1, 1], [tx, ty, tz] = n.translation ?? [0, 0, 0];
  return [
    (1 - 2 * (y * y + z * z)) * sx, (2 * (x * y + z * w)) * sx, (2 * (x * z - y * w)) * sx, 0,
    (2 * (x * y - z * w)) * sy, (1 - 2 * (x * x + z * z)) * sy, (2 * (y * z + x * w)) * sy, 0,
    (2 * (x * z + y * w)) * sz, (2 * (y * z - x * w)) * sz, (1 - 2 * (x * x + y * y)) * sz, 0,
    tx, ty, tz, 1];
}
const mul = (a: number[], b: number[]): number[] => { const o = new Array(16).fill(0); for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) for (let k = 0; k < 4; k++) o[c * 4 + r] += a[k * 4 + r] * b[c * 4 + k]; return o; };
const apply = (m: number[], p: Vec): Vec => [m[0] * p[0] + m[4] * p[1] + m[8] * p[2] + m[12], m[1] * p[0] + m[5] * p[1] + m[9] * p[2] + m[13], m[2] * p[0] + m[6] * p[1] + m[10] * p[2] + m[14]];
const parents = (j: any): Map<number, number> => { const p = new Map<number, number>(); j.nodes.forEach((n: any, i: number) => (n.children ?? []).forEach((c: number) => p.set(c, i))); return p; };
function worldOf(j: any): (i: number) => number[] {
  const par = parents(j);
  const world = (i: number): number[] => { const m = nodeMat(j.nodes[i]); return par.has(i) ? mul(world(par.get(i)!), m) : m; };
  return world;
}
const idx = (j: any, name: string): number => { const i = j.nodes.findIndex((n: any) => n.name === name); assert.ok(i >= 0, `thiếu nút ${name}`); return i; };
const at = (j: any, name: string): Vec => apply(worldOf(j)(idx(j, name)), [0, 0, 0]);

/* Mọi primitive của mọi nút có lưới: nút, vật liệu, tam giác, hộp bao thế giới */
function prims(j: any): { node: string; mat: string; tris: number; min: Vec; max: Vec; p: any }[] {
  const out: any[] = [], world = worldOf(j);
  j.nodes.forEach((n: any, i: number) => {
    if (n.mesh === undefined) return;
    const W = world(i);
    for (const p of j.meshes[n.mesh].primitives) {
      const a = j.accessors[p.attributes.POSITION];
      const mn = [Infinity, Infinity, Infinity], mx = [-Infinity, -Infinity, -Infinity];
      for (let c = 0; c < 8; c++) {
        const q = apply(W, [c & 1 ? a.max[0] : a.min[0], c & 2 ? a.max[1] : a.min[1], c & 4 ? a.max[2] : a.min[2]]);
        for (let d = 0; d < 3; d++) { mn[d] = Math.min(mn[d], q[d]); mx[d] = Math.max(mx[d], q[d]); }
      }
      out.push({ node: n.name, mat: j.materials[p.material]?.name, tris: j.accessors[p.indices].count / 3, min: mn, max: mx, p });
    }
  });
  return out;
}

test('scooter.glb tồn tại, ≤ model.maxBytes, ≤ model.maxTris tam giác, ≤ 10 primitive', () => {
  assert.ok(existsSync(FILE), 'thiếu public/bike/scooter.glb (chạy npm run gen:bike)');
  const n = statSync(FILE).size;
  assert.ok(n <= M.maxBytes, `${n} byte > ${M.maxBytes}`);
  const ps = prims(glbJson(FILE));
  const tris = ps.reduce((s, b) => s + b.tris, 0);
  assert.ok(tris <= M.maxTris, `${tris} tam giác > ${M.maxTris}`);
  assert.ok(ps.length <= MAX_PRIMS, `${ps.length} primitive > ${MAX_PRIMS}`);
  for (const im of glbJson(FILE).images ?? []) assert.equal(im.mimeType, 'image/jpeg', 'ảnh phải là JPEG');
});

test('cây nút: scooter → body, front (→ wheel_f, grip_l, grip_r), wheel_r; neo foot_l, foot_r, seat, eye thuộc body', () => {
  const j = glbJson(FILE), par = parents(j);
  const parentName = (n: string) => j.nodes[par.get(idx(j, n))!]?.name;
  assert.ok(!par.has(idx(j, 'scooter')), 'scooter phải là gốc');
  for (const n of ['body', 'front', 'wheel_r']) assert.equal(parentName(n), 'scooter', `${n} phải là con của scooter`);
  for (const n of ['wheel_f', 'grip_l', 'grip_r']) assert.equal(parentName(n), 'front', `${n} phải là con của front`);
  for (const n of ['foot_l', 'foot_r', 'seat', 'eye']) assert.equal(parentName(n), 'body', `${n} phải là con của body`);
  for (const n of ['grip_l', 'grip_r', 'foot_l', 'foot_r', 'seat', 'eye']) assert.equal(j.nodes[idx(j, n)].mesh, undefined, `${n} phải là nút rỗng`);
  for (const n of ['body', 'front', 'wheel_f', 'wheel_r']) assert.ok(j.nodes[idx(j, n)].mesh !== undefined, `${n} phải có lưới`);
});

test('vật liệu đặt tên đủ, đúng nút; mỗi bánh 1 primitive trim, hai bánh cùng lưới', () => {
  const j = glbJson(FILE), ps = prims(j);
  const names: string[] = j.materials.map((m: any) => m.name);
  for (const n of ['body', 'trim', 'lamp_head', 'lamp_tail', 'lamp_sig_l', 'lamp_sig_r', 'dash', 'mirror']) assert.ok(names.includes(n), `thiếu vật liệu ${n}: ${names}`);
  const on = (node: string) => ps.filter((p) => p.node === node).map((p) => p.mat).sort();
  assert.deepEqual(on('body'), ['body', 'lamp_sig_l', 'lamp_sig_r', 'lamp_tail']);
  assert.deepEqual(on('front'), ['dash', 'lamp_head', 'mirror', 'trim']);
  assert.deepEqual(on('wheel_f'), ['trim']); assert.deepEqual(on('wheel_r'), ['trim']);
  assert.equal(j.nodes[idx(j, 'wheel_f')].mesh, j.nodes[idx(j, 'wheel_r')].mesh, 'hai bánh trùng hình học thì dùng chung lưới');
  for (const p of ps.filter((p) => p.mat === 'trim')) assert.ok(p.p.attributes.COLOR_0 !== undefined, `${p.node}/trim thiếu màu đỉnh`);
  const body = j.materials.find((m: any) => m.name === 'body');
  assert.ok(body.pbrMetallicRoughness?.baseColorTexture, 'body phải có texture nướng');
});

test('hướng, gốc, bánh: mũi +X, trái −Z, đáy lốp y = 0, gốc giữa hai trục, cơ sở đúng', () => {
  const j = glbJson(FILE), ps = prims(j);
  const f = at(j, 'wheel_f'), r = at(j, 'wheel_r'), R = B.wheelDia / 2;
  assert.ok(Math.abs(f[0] - r[0] - B.wheelbase) < 0.01, `cơ sở ${f[0] - r[0]}`);
  assert.ok(Math.abs(f[0] + r[0]) < 0.01, `gốc lệch khỏi giữa hai trục: ${f[0] + r[0]}`);
  assert.ok(f[0] > 0, 'bánh trước phải ở +X');
  for (const w of [f, r]) { assert.ok(Math.abs(w[1] - R) < 0.01, `tâm bánh cao ${w[1]}`); assert.ok(Math.abs(w[2]) < 0.005, `tâm bánh lệch Z ${w[2]}`); }
  const mn = [0, 1, 2].map((d) => Math.min(...ps.map((b) => b.min[d]))), mx = [0, 1, 2].map((d) => Math.max(...ps.map((b) => b.max[d])));
  assert.ok(Math.abs(mn[1]) < 0.01, `đáy y = ${mn[1]}`);
  assert.ok(Math.abs(mx[0] - mn[0] - B.length) < 0.03, `dài ${mx[0] - mn[0]}`);
  assert.ok(mx[2] - mn[2] < B.width + 0.01, `rộng ${mx[2] - mn[2]}`);
  const box = (m: string) => ps.find((p) => p.mat === m)!;
  assert.ok(box('lamp_head').min[0] > 0.1 && box('lamp_head').min[1] > 0.9, 'đèn pha phải ở trước (+X), trên đầu cổ lái');
  assert.ok(box('lamp_tail').max[0] < -0.7, 'đèn hậu phải ở đuôi (−X)');
  assert.ok(box('lamp_sig_l').max[2] < 0 && box('lamp_sig_r').min[2] > 0, 'xi nhan trái ở −Z, phải ở +Z');
  assert.ok(box('lamp_sig_l').min[0] < -0.7 && box('lamp_sig_l').max[0] > 0, 'xi nhan trái gồm cả trước lẫn sau');
});

test('neo: tay nắm hai đầu ghi đông, chân trên sàn, yên, mắt', () => {
  const j = glbJson(FILE);
  const gl = at(j, 'grip_l'), gr = at(j, 'grip_r'), fl = at(j, 'foot_l'), fr = at(j, 'foot_r'), s = at(j, 'seat'), e = at(j, 'eye');
  assert.ok(gl[2] < -0.2 && gr[2] > 0.2 && Math.abs(gl[2] + gr[2]) < 0.01, `tay nắm: ${gl} / ${gr}`);
  assert.ok(gl[1] > 0.95 && gl[1] < 1.2 && Math.abs(gl[1] - gr[1]) < 0.005, `tay nắm cao ${gl[1]}`);
  assert.ok(fl[2] < 0 && fr[2] > 0 && Math.abs(fl[1] - fr[1]) < 0.005 && fl[1] > 0.2 && fl[1] < 0.35, `chân: ${fl} / ${fr}`);
  assert.ok(fl[0] > s[0] + 0.3 && fl[0] < 0.4, `chân ở sàn, trước yên: x ${fl[0]}`);
  assert.ok(gl[0] > s[0] + 0.2, 'tay nắm ở trước yên');
  assert.ok(s[1] > 0.75 && s[1] < 0.95 && Math.abs(s[2]) < 0.005 && s[0] < 0, `yên ${s}`);
  assert.ok(Math.abs(e[1] - s[1] - 0.68) < 0.005 && Math.abs(s[0] - e[0] - 0.05) < 0.005 && Math.abs(e[2]) < 0.005, `mắt ${e} so với yên ${s}`);
});

test('front: extras.axis = trục cổ lái (glTF, mũi +X) ≈ (−0,375; 0,927; 0); gốc trên trục', () => {
  const j = glbJson(FILE), n = j.nodes[idx(j, 'front')];
  const a = n.extras?.axis as number[];
  assert.ok(Array.isArray(a) && a.length === 3, 'thiếu extras.axis');
  assert.ok(Math.abs(Math.hypot(...a) - 1) < 1e-3, 'axis phải là vectơ đơn vị');
  assert.ok(Math.abs(a[0] + 0.375) < 0.01 && Math.abs(a[1] - 0.927) < 0.01 && Math.abs(a[2]) < 1e-3, `axis ${a}`);
  assert.ok(!n.rotation || Math.abs(Math.abs(n.rotation[3]) - 1) < 1e-6, 'front không được xoay nghỉ');
});

test('mặt đồng hồ có UV 0..1, nằm trên đầu cổ lái', () => {
  const j = glbJson(FILE), d = prims(j).find((p) => p.mat === 'dash')!;
  const acc = j.accessors[d.p.attributes.TEXCOORD_0];
  assert.ok(acc && acc.type === 'VEC2' && acc.componentType === 5126, 'dash thiếu UV float');
  /* min / max của TEXCOORD không bắt buộc trong glTF: đọc thẳng chunk BIN */
  const b = readFileSync(FILE), jl = b.readUInt32LE(12), bin = 20 + jl + 8, bv = j.bufferViews[acc.bufferView];
  const off = bin + (bv.byteOffset ?? 0) + (acc.byteOffset ?? 0), stride = bv.byteStride ?? 8;
  const uv = { min: [Infinity, Infinity], max: [-Infinity, -Infinity] };
  for (let i = 0; i < acc.count; i++) for (let c = 0; c < 2; c++) { const v = b.readFloatLE(off + i * stride + c * 4); uv.min[c] = Math.min(uv.min[c], v); uv.max[c] = Math.max(uv.max[c], v); }
  assert.ok(uv.min[0] >= -1e-4 && uv.min[1] >= -1e-4 && uv.max[0] <= 1 + 1e-4 && uv.max[1] <= 1 + 1e-4 && uv.max[0] - uv.min[0] > 0.9, `UV ${uv.min} .. ${uv.max}`);
  assert.ok(d.min[1] > 1.0 && Math.abs(d.min[2] + d.max[2]) < 0.01, `đồng hồ ${d.min} .. ${d.max}`);
});

test('LICENSE-Scooter.txt ghi CC0 + nguồn grab3d.com; README nhắc scooter.glb', () => {
  const f = join(DIR, 'LICENSE-Scooter.txt');
  assert.ok(existsSync(f), 'thiếu LICENSE-Scooter.txt');
  const t = readFileSync(f, 'utf8');
  for (const s of ['CC0', 'grab3d.com']) assert.ok(t.includes(s), `thiếu "${s}"`);
  assert.ok(readFileSync(join(DIR, '../../README.md'), 'utf8').includes('scooter.glb'), 'README chưa nhắc scooter.glb');
});

/* ===== Đi dạo: 5 file nhân vật public/people/p0..p4.glb (sinh bằng scripts/people/convert.py) — đọc phần JSON của GLB, không cần three ===== */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join, dirname } from 'node:path';

const DIR = join(dirname(fileURLToPath(import.meta.url)), '../../public/people');
const MB = 1024 * 1024;
const K = [0, 1, 2, 3, 4];

/* Đọc khối JSON đầu tiên của file GLB (header 12 byte, rồi chunk JSON) */
function glbJson(file: string): any {
  const b = readFileSync(file);
  assert.equal(b.readUInt32LE(0), 0x46546c67, 'không phải GLB');            // 'glTF'
  const len = b.readUInt32LE(12), type = b.readUInt32LE(16);
  assert.equal(type, 0x4e4f534a, 'chunk đầu không phải JSON');              // 'JSON'
  return JSON.parse(b.subarray(20, 20 + len).toString('utf8'));
}

test('5 file tồn tại, mỗi file ≤ 1,5 MB, tổng ≤ 6 MB', () => {
  let sum = 0;
  for (const k of K) {
    const f = join(DIR, `p${k}.glb`);
    assert.ok(existsSync(f), `thiếu p${k}.glb`);
    const n = statSync(f).size; sum += n;
    assert.ok(n <= 1.5 * MB, `p${k}.glb ${n} byte > 1,5 MB`);
  }
  assert.ok(sum <= 6 * MB, `tổng ${sum} byte > 6 MB`);
});

for (const k of K) {
  test(`p${k}.glb: 5 đoạn đúng tên, speed hợp lý, 1 skin, không nén, có height`, () => {
    const j = glbJson(join(DIR, `p${k}.glb`));
    const anims: any[] = j.animations ?? [];
    assert.deepEqual(anims.map(a => a.name).sort(), ['idle', 'jog', 'photo', 'sprint', 'walk']);
    const sp: Record<string, number> = {};
    for (const a of anims) { assert.equal(typeof a.extras?.speed, 'number', `${a.name} thiếu extras.speed`); sp[a.name] = a.extras.speed; }
    assert.equal(sp.idle, 0); assert.equal(sp.photo, 0);
    assert.ok(sp.walk > 0.5 && sp.walk < 2.5, `walk ${sp.walk}`);
    assert.ok(sp.jog > 2 && sp.jog < 5, `jog ${sp.jog}`);
    assert.ok(sp.sprint > 4 && sp.sprint < 8, `sprint ${sp.sprint}`);
    assert.ok(sp.walk < sp.jog && sp.jog < sp.sprint);
    assert.equal(j.skins?.length, 1, 'phải có đúng 1 skin');
    assert.ok(j.skins[0].joints.length >= 50, `skin chỉ ${j.skins[0].joints.length} khớp`);
    const used: string[] = j.extensionsUsed ?? [];
    assert.ok(!used.includes('KHR_draco_mesh_compression') && !used.includes('EXT_meshopt_compression'), 'không dùng Draco / Meshopt');
    const h = j.scenes?.[0]?.extras?.height ?? j.asset?.extras?.height;
    assert.equal(typeof h, 'number', 'thiếu height');
    assert.ok(h > 1.5 && h < 1.95, `height ${h}`);
    const names = new Set(j.nodes.map((n: any) => n.name));
    for (const b of ['Bip01 Pelvis', 'Bip01 L Foot', 'Bip01 R Foot', 'Bip01 Head']) assert.ok(names.has(b), `thiếu xương ${b}`);
  });
}

test('LICENSE-Rocketbox.txt có và ghi MIT', () => {
  const f = join(DIR, 'LICENSE-Rocketbox.txt');
  assert.ok(existsSync(f));
  assert.match(readFileSync(f, 'utf8'), /MIT/);
});

test('ảnh xem trước hai nhân vật ở sảnh (npm run gen:thumbs): có, là WebP, mỗi ảnh ≤ 20 kB; index.html trỏ đúng', () => {
  const html = readFileSync(join(DIR, '..', '..', 'index.html'), 'utf8');
  for (const f of ['thumb-m.webp', 'thumb-f.webp']) {
    const b = readFileSync(join(DIR, f));
    assert.equal(b.subarray(0, 4).toString('latin1'), 'RIFF'); assert.equal(b.subarray(8, 12).toString('latin1'), 'WEBP');
    assert.ok(b.length <= 20000, `${f}: ${b.length} byte`);
    assert.ok(html.includes('people/' + f), `index.html thiếu people/${f}`);
  }
});

/* ===== Hai siêu anh hùng (D-048): public/people/hero-m.glb, hero-f.glb, sinh bằng scripts/people/hero.py từ p0 / p3 ===== */
const HERO: [string, number][] = [['hero-m', 0], ['hero-f', 3]];   // [tệp, mô hình người gốc cùng chuyển động]
const speedsOf = (j: any): Record<string, number> => Object.fromEntries((j.animations ?? []).map((a: any) => [a.name, a.extras?.speed]));
for (const [f, src] of HERO) {
  test(`${f}.glb: anh hùng — 5 đoạn, speed như p${src}, 2 primitive, OPAQUE, xương đủ`, () => {
    const file = join(DIR, `${f}.glb`);
    assert.ok(existsSync(file), `thiếu ${f}.glb (npm run gen:hero)`);
    const n = statSync(file).size;
    assert.ok(n <= 1.5 * MB, `${f}.glb ${n} byte > 1,5 MB`);
    const j = glbJson(file), s = speedsOf(j), s0 = speedsOf(glbJson(join(DIR, `p${src}.glb`)));
    assert.deepEqual(Object.keys(s).sort(), ['idle', 'jog', 'photo', 'sprint', 'walk']);
    for (const k of Object.keys(s0)) assert.ok(Math.abs(s[k] - s0[k]) <= 0.01, `${k}: ${s[k]} so với p${src} ${s0[k]}`);
    const prims = j.meshes.reduce((a: number, m: any) => a + m.primitives.length, 0);
    assert.equal(prims, 2, 'phải còn đúng 2 primitive (thân, đầu)');
    for (const m of j.materials) assert.equal(m.alphaMode ?? 'OPAQUE', 'OPAQUE', `${m.name} không OPAQUE`);
    assert.equal(j.skins?.length, 1); assert.ok(j.skins[0].joints.length >= 50);
    const names = new Set(j.nodes.map((x: any) => String(x.name).replace(/_/g, ' ')));
    for (const b of ['Pelvis', 'L Foot', 'R Foot', 'Head', 'L Hand', 'R Hand', 'LEye', 'REye']) assert.ok(names.has('Bip01 ' + b), `thiếu xương Bip01 ${b}`);
    const h = j.scenes[0].extras?.height;
    assert.ok(h > 1.5 && h < 1.95, `height ${h}`);
    const glow = j.materials.some((m: any) => m.emissiveTexture);
    assert.equal(glow, f === 'hero-m', f === 'hero-m' ? 'anh hùng nam phải có texture phát sáng' : 'anh hùng nữ không phát sáng');
    const used: string[] = j.extensionsUsed ?? [];
    assert.ok(!used.includes('KHR_draco_mesh_compression') && !used.includes('EXT_meshopt_compression'));
    assert.match(String(j.scenes[0].extras?.source), /hero\.py/);
    const tri = (jj: any): number => jj.meshes.reduce((a: number, m: any) => a + m.primitives.reduce((b: number, p: any) => b + jj.accessors[p.indices].count / 3, 0), 0);
    assert.ok(tri(j) <= tri(glbJson(join(DIR, `p${src}.glb`))), 'tam giác vượt mô hình gốc');
  });
}

test('LICENSE-Rocketbox.txt ghi hero-m / hero-f là bản sửa đổi bằng hero.py', () => {
  assert.match(readFileSync(join(DIR, 'LICENSE-Rocketbox.txt'), 'utf8'), /hero-m\.glb, hero-f\.glb: .*hero\.py/);
});

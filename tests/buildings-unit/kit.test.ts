/* ===== Nhà ven sông (D-037 bản 2): bộ phụ kiện public/buildings/kit.glb (sinh bằng npm run gen:buildings) — đọc thẳng GLB, không cần three ===== */
// Hợp đồng: docs/superpowers/specs/2026-11-13-ven-song-chan-thuc-design.md §6.1, §6.2.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join, dirname } from 'node:path';

const FILE = join(dirname(fileURLToPath(import.meta.url)), '../../public/buildings/kit.glb');
const KB = 1000;
const MAX_TRIS = 1000;                       // trần tam giác mỗi họ
const MAX_BYTES = 300 * KB;                  // trần dung lượng kit.glb
// dải chiều cao của từng họ (m), spec §6.1; cận trên = chiều cao tối đa mà chi tiết theo tầng được sinh tới
const H: Record<string, [number, number]> = { fam1: [45, 100], fam2: [20, 45], fam3: [14, 30], fam4: [30, 100], fam5: [9, 20] };
const FAMS = Object.keys(H);

type Glb = { j: any; bin: Buffer };
function readGlb(file: string): Glb {
  const b = readFileSync(file);
  assert.equal(b.readUInt32LE(0), 0x46546c67, 'không phải GLB');            // 'glTF'
  const jl = b.readUInt32LE(12);
  assert.equal(b.readUInt32LE(16), 0x4e4f534a, 'chunk đầu không phải JSON');
  const j = JSON.parse(b.subarray(20, 20 + jl).toString('utf8'));
  const bl = b.readUInt32LE(20 + jl);
  assert.equal(b.readUInt32LE(24 + jl), 0x004e4942, 'chunk thứ hai không phải BIN');
  return { j, bin: b.subarray(28 + jl, 28 + jl + bl) };
}

const NCOMP: Record<string, number> = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4 };
const CSIZE: Record<number, number> = { 5120: 1, 5121: 1, 5122: 2, 5123: 2, 5125: 4, 5126: 4 };
const CMAX: Record<number, number> = { 5121: 255, 5123: 65535, 5120: 127, 5122: 32767 };
/* Đọc accessor ra mảng số (float, hoặc số nguyên chuẩn hóa đổi về 0..1), có xét byteStride */
function read(g: Glb, i: number): { n: number; count: number; d: Float64Array } {
  const a = g.j.accessors[i], v = g.j.bufferViews[a.bufferView];
  const n = NCOMP[a.type], cs = CSIZE[a.componentType];
  const stride = v.byteStride || n * cs, base = (v.byteOffset ?? 0) + (a.byteOffset ?? 0);
  const d = new Float64Array(a.count * n);
  for (let k = 0; k < a.count; k++) for (let c = 0; c < n; c++) {
    const o = base + k * stride + c * cs;
    let x: number;
    switch (a.componentType) {
      case 5126: x = g.bin.readFloatLE(o); break;
      case 5121: x = g.bin.readUInt8(o); break;
      case 5123: x = g.bin.readUInt16LE(o); break;
      case 5125: x = g.bin.readUInt32LE(o); break;
      case 5120: x = g.bin.readInt8(o); break;
      default: x = g.bin.readInt16LE(o);
    }
    if (a.normalized) x = Math.max(-1, x / CMAX[a.componentType]);
    d[k * n + c] = x;
  }
  return { n, count: a.count, d };
}

/* Lưới của một họ: tìm theo tên mesh (hoặc tên node trỏ tới mesh) */
function prim(g: Glb, name: string): any {
  let m = g.j.meshes.find((x: any) => x.name === name);
  if (!m) { const nd = g.j.nodes.find((x: any) => x.name === name && x.mesh !== undefined); if (nd) m = g.j.meshes[nd.mesh]; }
  assert.ok(m, `thiếu lưới ${name}`);
  assert.equal(m.primitives.length, 1, `${name}: ${m.primitives.length} primitive`);
  return m.primitives[0];
}
function tris(g: Glb, p: any): number {
  assert.ok(p.mode === undefined || p.mode === 4, 'primitive không phải TRIANGLES');
  return g.j.accessors[p.indices ?? p.attributes.POSITION].count / 3;
}

const g = existsSync(FILE) ? readGlb(FILE) : null;

test('kit.glb tồn tại, ≤ 300 kB', () => {
  assert.ok(existsSync(FILE), 'thiếu public/buildings/kit.glb (npm run gen:buildings)');
  const n = statSync(FILE).size;
  assert.ok(n <= MAX_BYTES, `kit.glb ${n} byte > ${MAX_BYTES}`);
});

test('kit.glb: đúng 5 lưới fam1..fam5, không texture, không nén', () => {
  assert.ok(g);
  const names = g.j.meshes.map((m: any) => m.name).sort();
  assert.deepEqual(names, FAMS, `lưới: ${names}`);
  assert.equal((g.j.images ?? []).length, 0, 'có ảnh');
  assert.equal((g.j.textures ?? []).length, 0, 'có texture');
  const used: string[] = g.j.extensionsUsed ?? [];
  assert.ok(!used.includes('KHR_draco_mesh_compression') && !used.includes('EXT_meshopt_compression') && !used.includes('KHR_mesh_quantization'), `phần mở rộng ${used}`);
});

for (const f of FAMS) {
  test(`${f}: đủ thuộc tính, ≤ ${MAX_TRIS} tam giác`, () => {
    assert.ok(g);
    const p = prim(g, f), at = p.attributes;
    const want: Record<string, string> = { POSITION: 'VEC3', NORMAL: 'VEC3', COLOR_0: 'VEC4', _OFF: 'VEC3', _RULE: 'SCALAR', _GLOW: 'SCALAR' };
    for (const [k, t] of Object.entries(want)) {
      assert.ok(at[k] !== undefined, `${f}: thiếu ${k}`);
      assert.equal(g.j.accessors[at[k]].type, t, `${f}: ${k} không phải ${t}`);
    }
    for (const k of ['POSITION', 'NORMAL', '_OFF', '_RULE', '_GLOW']) assert.equal(g.j.accessors[at[k]].componentType, 5126, `${f}: ${k} không phải float`);
    const ct = g.j.accessors[at.COLOR_0];
    assert.ok(ct.componentType === 5126 || ((ct.componentType === 5121 || ct.componentType === 5123) && ct.normalized), `${f}: COLOR_0 kiểu ${ct.componentType}`);
    const t = tris(g, p);
    assert.ok(t > 0 && t <= MAX_TRIS, `${f}: ${t} tam giác`);
  });

  test(`${f}: neo trong hộp đơn vị, |_OFF.x|, |_OFF.z| ≤ 30 m, pháp tuyến đơn vị, màu a ∈ {0, 1}, _GLOW ∈ [0, 1]`, () => {
    assert.ok(g);
    const at = prim(g, f).attributes;
    const pos = read(g, at.POSITION), off = read(g, at._OFF), nrm = read(g, at.NORMAL), col = read(g, at.COLOR_0), glow = read(g, at._GLOW);
    const E = 1e-4;
    for (let k = 0; k < pos.count; k++) {
      const x = pos.d[k * 3], y = pos.d[k * 3 + 1], z = pos.d[k * 3 + 2];
      assert.ok(x >= -0.5 - E && x <= 0.5 + E && z >= -0.5 - E && z <= 0.5 + E && y >= -E && y <= 1 + E, `${f}: neo ${k} = (${x}, ${y}, ${z}) ngoài hộp đơn vị`);
      // ngang ≤ 30 m; đứng thì chi tiết tầng neo y = 0 nên _OFF.y lên tới chiều cao tối đa của họ
      for (const c of [0, 2]) assert.ok(Math.abs(off.d[k * 3 + c]) <= 30, `${f}: _OFF ${k} = ${off.d[k * 3 + c]}`);
      assert.ok(off.d[k * 3 + 1] >= -30 && off.d[k * 3 + 1] <= H[f][1] + 20, `${f}: _OFF.y ${k} = ${off.d[k * 3 + 1]}`);
      const l = Math.hypot(nrm.d[k * 3], nrm.d[k * 3 + 1], nrm.d[k * 3 + 2]);
      assert.ok(Math.abs(l - 1) < 1e-3, `${f}: pháp tuyến ${k} dài ${l}`);
      const a = col.d[k * 4 + 3];
      assert.ok(Math.abs(a) < 0.01 || Math.abs(a - 1) < 0.01, `${f}: COLOR_0.a ${k} = ${a}`);
      assert.ok(glow.d[k] >= -E && glow.d[k] <= 1 + E, `${f}: _GLOW ${k} = ${glow.d[k]}`);
    }
  });

  test(`${f}: _RULE = 0 hoặc trong (0; ${H[f][1]}], có chi tiết theo tầng, chi tiết tầng neo y = 0 và đáy ≥ _RULE`, () => {
    assert.ok(g);
    const at = prim(g, f).attributes;
    const rule = read(g, at._RULE), pos = read(g, at.POSITION), off = read(g, at._OFF);
    let per = 0;
    for (let k = 0; k < rule.count; k++) {
      const r = rule.d[k];
      assert.ok(r === 0 || (r > 0 && r <= H[f][1] + 1e-3), `${f}: _RULE ${k} = ${r}`);
      if (r > 0) {
        per++;
        assert.ok(Math.abs(pos.d[k * 3 + 1]) < 1e-6, `${f}: đỉnh tầng ${k} có neo y = ${pos.d[k * 3 + 1]}`);
        assert.ok(off.d[k * 3 + 1] >= r - 1e-3, `${f}: đỉnh tầng ${k} thấp hơn _RULE (${off.d[k * 3 + 1]} < ${r})`);
        // đáy chi tiết khớp lưới tầng 3,4·k − 2,5 (k ≥ 2)
        const kk = (r + 2.5) / 3.4;
        assert.ok(Math.abs(kk - Math.round(kk)) < 1e-3 && Math.round(kk) >= 2, `${f}: _RULE ${r} không khớp lưới tầng 3,4 m`);
      }
    }
    assert.ok(per > 0, `${f}: không có đỉnh nào _RULE > 0`);
  });

  test(`${f}: hình đã giải ở kích thước mẫu nằm trong thân nhà nới 3 m ngang, −0,1 … h + 20 m đứng`, () => {
    assert.ok(g);
    const at = prim(g, f).attributes;
    const pos = read(g, at.POSITION), off = read(g, at._OFF), rule = read(g, at._RULE);
    for (const w of [14, 29]) for (const d of [14, 29]) for (const h of H[f]) {
      let top = -Infinity;
      for (let k = 0; k < pos.count; k++) {
        const r = rule.d[k];
        if (r > h - 3) continue;                                   // shader thu chi tiết tầng này về 0
        const x = pos.d[k * 3] * w + off.d[k * 3], y = pos.d[k * 3 + 1] * h + off.d[k * 3 + 1], z = pos.d[k * 3 + 2] * d + off.d[k * 3 + 2];
        assert.ok(Math.abs(x) <= w / 2 + 3 + 1e-3 && Math.abs(z) <= d / 2 + 3 + 1e-3, `${f} ${w}×${h}×${d}: đỉnh ${k} ngang (${x.toFixed(2)}, ${z.toFixed(2)})`);
        assert.ok(y >= -0.1 && y <= h + 20, `${f} ${w}×${h}×${d}: đỉnh ${k} cao ${y.toFixed(2)}`);
        if (r > 0) top = Math.max(top, y);
      }
      // chi tiết tầng cao nhất còn vẽ không chọc qua mái
      assert.ok(top <= h, `${f} ${w}×${h}×${d}: chi tiết tầng cao tới ${top.toFixed(2)} > mái ${h}`);
    }
  });
}

test('fam1, fam3 có phần sáng về đêm (_GLOW > 0)', () => {
  assert.ok(g);
  for (const f of ['fam1', 'fam3']) {
    const glow = read(g, prim(g, f).attributes._GLOW);
    assert.ok(glow.d.some(x => x > 0), `${f}: không có _GLOW > 0`);
  }
});

test('fam5 có bồn inox (màu tuyệt đối ≈ 0,78 / 0,80 / 0,82) và fam2 cũng vậy', () => {
  assert.ok(g);
  for (const f of ['fam2', 'fam5']) {
    const col = read(g, prim(g, f).attributes.COLOR_0);
    let n = 0;
    for (let k = 0; k < col.count; k++)
      if (col.d[k * 4 + 3] < 0.01 && Math.abs(col.d[k * 4] - 0.78) < 0.01 && Math.abs(col.d[k * 4 + 1] - 0.80) < 0.01 && Math.abs(col.d[k * 4 + 2] - 0.82) < 0.01) n++;
    assert.ok(n > 0, `${f}: không thấy đỉnh màu inox`);
  }
});

/* ===== Nhà ven sông (D-037 bản 2): chọn họ nhà (src/environment/buildings/families.ts) — thuần, không trình duyệt ===== */
// Hợp đồng: spec 2026-11-13-ven-song-chan-thuc-design.md §6.1 (dải chiều cao từng họ, băm vị trí, không rand()).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { bkFamily, bkHash } from '../../src/environment/buildings/families.ts';
import { CONFIG } from '../../src/config.ts';

const BANDS = CONFIG.buildings.bands;
// dải chiều cao của từng họ theo spec §6.1 (m)
const SPEC: Record<number, [number, number]> = { 1: [45, Infinity], 2: [20, 45], 3: [14, 30], 4: [30, Infinity], 5: [0, 20] };

/* Lưới nhà giả giống buildCity: bước 36 m, lệch ±3 m, h 9..155 m */
function sample(n: number) {
  const out: { x: number; z: number; h: number }[] = [];
  for (let i = 0; i < n; i++) out.push({ x: -700 + (i % 13) * 36 + ((i * 7) % 6) - 3, z: -500 + Math.floor(i / 13) * 36 + ((i * 5) % 6) - 3, h: 9 + ((i * 37) % 147) });
  return out;
}

test('bkHash: tất định, trong [0, 1), phân bố không lệch hẳn', () => {
  assert.equal(bkHash(-412.3, 118.9), bkHash(-412.3, 118.9));
  let lo = 0; const N = 4000;
  for (let i = 0; i < N; i++) { const v = bkHash(-700 + i * 0.37, (i % 97) * 11.3); assert.ok(v >= 0 && v < 1, `${v}`); if (v < 0.5) lo++; }
  assert.ok(Math.abs(lo / N - 0.5) < 0.05, `nửa dưới ${lo}/${N}`);
});

test('bkFamily: tất định (cùng nhà → cùng họ ở mọi lần gọi)', () => {
  for (const b of sample(300)) assert.equal(bkFamily(b.h, b.x, b.z, BANDS), bkFamily(b.h, b.x, b.z, BANDS));
});

test('bkFamily: tôn trọng dải chiều cao của spec §6.1', () => {
  for (const b of sample(2000)) {
    const f = bkFamily(b.h, b.x, b.z, BANDS);
    assert.ok(f >= 1 && f <= 5, `h ${b.h} → họ ${f}`);
    const [h0, h1] = SPEC[f];
    assert.ok(b.h >= h0 && b.h < h1, `h ${b.h} không thuộc dải họ ${f} [${h0}, ${h1})`);
  }
  // mốc biên
  assert.equal(bkFamily(9, 1, 1, BANDS), 5);
  assert.equal(bkFamily(13.9, 1, 1, BANDS), 5);
  for (const [x, z] of [[1, 2], [3, 4], [5, 6], [7, 8]]) assert.ok([1, 4].includes(bkFamily(150, x, z, BANDS)));
});

test('bkFamily: mọi họ đều chọn được, mỗi họ có tỉ lệ đáng kể trong dải của nó', () => {
  const seen: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  for (const b of sample(3000)) seen[bkFamily(b.h, b.x, b.z, BANDS)]++;
  for (const f of [1, 2, 3, 4, 5]) assert.ok(seen[f] > 30, `họ ${f}: ${seen[f]} nhà`);
});

test('bkFamily: mọi chiều cao của buildCity (9..155 m) đều có họ; dải trống → 0', () => {
  for (let h = 9; h <= 160; h += 0.5) assert.ok(bkFamily(h, h, -h, BANDS) > 0, `h ${h}`);
  assert.equal(bkFamily(50, 0, 0, [{ id: 5, h0: 0, h1: 20, w: 1 }]), 0);
});

test('bkFamily: không gọi Math.random', () => {
  const r = Math.random; let n = 0;
  Math.random = () => { n++; return r(); };
  try { for (const b of sample(200)) bkFamily(b.h, b.x, b.z, BANDS); } finally { Math.random = r; }
  assert.equal(n, 0);
});

/* ===== Nhà ven sông (D-037 bản 2, D-038): chiều cao mới, họ nhà, màu tường (src/environment/buildings/families.ts) — thuần, không trình duyệt ===== */
// Hợp đồng: spec 2026-11-13-ven-song-chan-thuc-design.md §6.1 (dải chiều cao từng họ, băm vị trí, không rand()); D-038 (hạ chiều cao dải sát sông).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { bkFamily, bkHash, bkReshapeH, bkBlockKind, bkWall, bkFloorsH } from '../../src/environment/buildings/families.ts';
import { CONFIG } from '../../src/config.ts';

const BANDS = CONFIG.buildings.bands;
const R = CONFIG.buildings.reshape;
// dải chiều cao của từng họ (m): spec §6.1, M3 nới khách sạn kính từ 22 m, thương mại từ 12 m (D-038)
const SPEC: Record<number, [number, number]> = { 1: [22, Infinity], 2: [20, 45], 3: [12, 30], 4: [30, Infinity], 5: [0, 20] };

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
  for (const [i, b] of sample(2000).entries()) {
    const f = bkFamily(b.h, b.x, b.z, BANDS, (i % 11) / 10);
    assert.ok(f >= 1 && f <= 5, `h ${b.h} → họ ${f}`);
    const [h0, h1] = SPEC[f];
    assert.ok(b.h >= h0 && b.h < h1, `h ${b.h} không thuộc dải họ ${f} [${h0}, ${h1})`);
  }
  // mốc biên
  assert.equal(bkFamily(9, 1, 1, BANDS), 5);
  assert.equal(bkFamily(11.9, 1, 1, BANDS), 5);
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

/* Lưới nhà giả trong dải sát sông bờ Tây: hàng x như buildCity (bước 36, chừa đường ix % 5 = 0), z −1800..1800, h gốc cao như hàng đầu ven sông */
function band() {
  const out: { x: number; z: number; h0: number; t: number }[] = [];
  for (let gx = -2000; gx < -330; gx += 36) for (let gz = -1800; gz < 1800; gz += 36) {
    const ix = Math.round(gx / 36), iz = Math.round(gz / 36);
    if (ix % 5 === 0 || iz % 5 === 0) continue;
    const t = (Math.abs(gx) - 262) / CONFIG.buildings.band;
    if (t < 0 || t > 1) continue;
    const x = gx + (Math.abs(iz * 7) % 6) - 3, z = gz + (Math.abs(ix * 5) % 6) - 3;
    out.push({ x, z, t, h0: 30 + (Math.abs(ix * 31 + iz * 17) % 120) });
  }
  return out;
}
const mean = (a: number[]) => a.reduce((p, q) => p + q, 0) / a.length;

test('bkReshapeH: tất định, không cao hơn gốc, không thấp hơn 9 m, không gọi Math.random', () => {
  const r = Math.random; let n = 0;
  Math.random = () => { n++; return r(); };
  try {
    for (const b of band()) {
      const h = bkReshapeH(b.h0, b.x, b.z, b.t, R);
      assert.equal(h, bkReshapeH(b.h0, b.x, b.z, b.t, R));
      assert.ok(h <= b.h0 + 1e-9, `h ${h} > gốc ${b.h0}`);
      assert.ok(h >= Math.min(b.h0, R.minH), `h ${h} < 9`);
    }
    assert.equal(bkReshapeH(9, -400, 10, 0.3, R), 9);   // nhà gốc thấp giữ nguyên
  } finally { Math.random = r; }
  assert.equal(n, 0);
});

test('bkReshapeH: dải sát sông chủ yếu thấp tầng, vẫn còn tháp; sát kè thấp hơn phía trong', () => {
  const all = band(), hs = all.map((b) => bkReshapeH(b.h0, b.x, b.z, b.t, R));
  const tube = hs.filter((h) => h < 20).length, mid = hs.filter((h) => h >= 20 && h < 45).length, tower = hs.filter((h) => h >= 45).length;
  assert.ok(tube / hs.length > 0.3 && tube / hs.length < 0.65, `nhà ống ${tube}/${hs.length}`);
  assert.ok(mid / hs.length > 0.25, `nhà vừa ${mid}/${hs.length}`);
  assert.ok(tower / hs.length > 0.04 && tower / hs.length < 0.25, `tháp ${tower}/${hs.length}`);
  // cùng chiều cao gốc 120 m ở mọi nơi: hàng sát kè (t < 0,45) nhiều nhà ống hơn và thấp hơn trung bình so với phía trong (t > 0,6), xét cả dải z dài
  const at = (t0: number, t1: number) => { const a: number[] = []; for (const b of all) if (b.t >= t0 && b.t < t1) for (let k = 0; k < 4; k++) a.push(bkReshapeH(120, b.x, b.z + k * 3600, b.t, R)); return a; };
  const front = at(0, 0.45), back = at(0.6, 1.01), share = (a: number[]) => a.filter((h) => h < 20).length / a.length;
  assert.ok(share(front) > share(back), `nhà ống sát kè ${share(front)}, phía trong ${share(back)}`);
  assert.ok(mean(front) < mean(back), `trung bình sát kè ${mean(front)}, phía trong ${mean(back)}`);
  // chiều cao nhà ống / vừa nằm trên lưới tầng (khớp cửa sổ shader và chi tiết tầng của kit)
  for (const n of [R.tube[0], R.tube[1], R.mid[0], R.mid[1]]) assert.ok(hs.some((h) => Math.abs(h - bkFloorsH(n, R.cap)) < 1e-9), `không nhà nào ${n} tầng`);
});

test('bkBlockKind: cùng hàng, cùng khối phố ⇒ cùng tính cách (nhà theo cụm, không lấm tấm)', () => {
  let same = 0, pairs = 0;
  for (let gz = -1800; gz < 1800; gz += 36 * 5) for (const gx of [-380, -452]) {
    const k0 = bkBlockKind(gx + 1, gz + 40, 0.4, R);
    for (let d = 72; d < 36 * 4; d += 36) { pairs++; if (bkBlockKind(gx - 2, gz + d + 2, 0.4, R) === k0) same++; }
  }
  assert.equal(same, pairs);
  const kinds = new Set<number>(); for (let gz = -1800; gz < 1800; gz += 180) kinds.add(bkBlockKind(-380, gz + 40, 0.4, R));
  assert.equal(kinds.size, 3, 'dọc một hàng phải có đủ ba tính cách');
});

test('bkFamily theo t: sát kè nhiều nhà ống / thương mại, văn phòng lùi vào trong', () => {
  const all = band(), fam = (t0: number, t1: number) => {
    const c: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    for (const b of all) if (b.t >= t0 && b.t < t1) c[bkFamily(bkReshapeH(b.h0, b.x, b.z, b.t, R), b.x, b.z, BANDS, b.t)]++;
    return c;
  };
  const f = fam(0, 0.45), k = fam(0.6, 1.01), n = (c: Record<number, number>) => Object.values(c).reduce((a, b) => a + b, 0);
  assert.ok((f[5] + f[3]) / n(f) > 0.35, `sát kè nhà ống + thương mại ${JSON.stringify(f)}`);
  assert.ok(f[4] / n(f) < k[4] / n(k), `văn phòng sát kè ${JSON.stringify(f)} so với phía trong ${JSON.stringify(k)}`);
  for (const id of [1, 2, 3, 4, 5]) assert.ok(f[id] + k[id] > 0, `họ ${id} không xuất hiện`);
});

test('bkWall: màu trong bảng của họ, tất định, hàng xóm không cùng một màu', () => {
  const F = CONFIG.buildings.facade, pal = CONFIG.buildings.bayPalette;
  const seen = new Set<number>();
  for (let i = 0; i < 40; i++) for (const fam of [1, 2, 3, 4, 5]) {
    const x = -380 + (i % 3), z = -700 + i * 36, c = bkWall(fam, x, z, F[fam].walls, pal);
    assert.ok((F[fam].walls.length ? F[fam].walls : pal).includes(c));
    assert.equal(c, bkWall(fam, x, z, F[fam].walls, pal));
    if (fam === 2) seen.add(c);
  }
  assert.ok(seen.size >= 4, `chung cư chỉ ${seen.size} màu`);
});

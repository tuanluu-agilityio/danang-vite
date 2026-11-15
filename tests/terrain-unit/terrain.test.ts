// Địa hình núi Sơn Trà + Hải Vân (D-047; spec 2026-11-15-son-tra-nui-rung-design.md §4, §6)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CONFIG } from '../../src/config.ts';
import { stHeight, hvHeight, ST_BOX, HV_BOX } from '../../src/environment/terrain.ts';
import { mtGeometry } from '../../src/environment/mountainGeo.ts';

const T = CONFIG.sonTra, TK = CONFIG.explore.takeoff;

test('tất định và hữu hạn', () => {
  for (let x = ST_BOX.x0; x <= ST_BOX.x1; x += 173) for (let z = ST_BOX.z0; z <= ST_BOX.z1; z += 191) { const a = stHeight(x, z); assert.ok(Number.isFinite(a)); assert.equal(a, stHeight(x, z)); }
  for (let x = HV_BOX.x0; x <= HV_BOX.x1; x += 410) for (let z = HV_BOX.z0; z <= HV_BOX.z1; z += 390) assert.ok(Number.isFinite(hvHeight(x, z)));
});

test('đỉnh chính 660–698 m quanh điểm cất cánh dù lượn, mặt đất dưới dù', () => {
  let max = 0;
  for (let x = TK[0] - 400; x <= TK[0] + 400; x += 20) for (let z = TK[2] - 400; z <= TK[2] + 400; z += 20) max = Math.max(max, stHeight(x, z));
  assert.ok(max >= 660 && max <= 698, `đỉnh ${max.toFixed(1)}`);
  assert.ok(stHeight(TK[0], TK[2]) <= TK[1] - 4, `mặt đất tại điểm cất cánh ${stHeight(TK[0], TK[2]).toFixed(1)} so với dù ${TK[1]}`);
  let all = 0; for (let x = ST_BOX.x0; x <= ST_BOX.x1; x += 26) for (let z = ST_BOX.z0; z <= ST_BOX.z1; z += 26) all = Math.max(all, stHeight(x, z));
  assert.ok(all <= 698, `điểm cao nhất ${all.toFixed(1)}`);
});

test('không phủ lên đất liền bờ Đông', () => {
  for (let x = 262; x <= T.keepX; x += 40) for (let z = T.keepZ; z <= -2300; z += 40) assert.ok(stHeight(x, z) <= 2.5, `(${x}, ${z}) cao ${stHeight(x, z).toFixed(1)}`);
});

test('không vách hình học: dốc giữa hai mẫu kề ≤ 62°', () => {
  const c = T.cell, lim = 1.9 * c; let worst = 0;
  for (let x = ST_BOX.x0; x < ST_BOX.x1; x += c) for (let z = ST_BOX.z0; z < ST_BOX.z1; z += c) { const h = stHeight(x, z); worst = Math.max(worst, Math.abs(stHeight(x + c, z) - h), Math.abs(stHeight(x, z + c) - h)); }
  assert.ok(worst <= lim, `chênh lớn nhất ${worst.toFixed(1)} m trên ${c} m`);
});

test('liền mạch: bước 1 m không nhảy quá 3 m (không vệt nối ở mũi sống)', () => {
  let worst = 0, at = '';
  const scan = (hf: (x: number, z: number) => number, x0: number, x1: number, z0: number, z1: number, n: number) => {
    for (let k = 0; k < n; k++) {
      const z = z0 + (z1 - z0) * (k + 0.37) / n; let p = hf(x0, z);
      for (let x = x0 + 1; x <= x1; x++) { const h = hf(x, z); if (Math.max(h, p) > 5 && Math.abs(h - p) > worst) { worst = Math.abs(h - p); at = `(${x}, ${z.toFixed(0)})`; } p = h; }
      const x = x0 + (x1 - x0) * (k + 0.61) / n; p = hf(x, z0);
      for (let zz = z0 + 1; zz <= z1; zz++) { const h = hf(x, zz); if (Math.max(h, p) > 5 && Math.abs(h - p) > worst) { worst = Math.abs(h - p); at = `(${x.toFixed(0)}, ${zz})`; } p = h; }
    }
  };
  scan(stHeight, ST_BOX.x0, ST_BOX.x1, ST_BOX.z0, ST_BOX.z1, 60); scan(hvHeight, HV_BOX.x0, HV_BOX.x1, HV_BOX.z0, HV_BOX.z1, 40);
  assert.ok(worst <= 3, `nhảy ${worst.toFixed(1)} m tại ${at}`);
});

test('đường chân trời từ Cầu Rồng có ≥ 3 đỉnh', () => {
  const eye = [40, 13, -17], N = 160, sky: number[] = [];
  for (let k = 0; k < N; k++) {
    const az = Math.atan2(-6100 - eye[2], 900 - eye[0]) + (Math.atan2(-2300 - eye[2], 6000 - eye[0]) - Math.atan2(-6100 - eye[2], 900 - eye[0])) * k / (N - 1);
    let best = -1; for (let d = 2500; d < 9000; d += 30) { const x = eye[0] + Math.cos(az) * d, z = eye[2] + Math.sin(az) * d; best = Math.max(best, (stHeight(x, z) - eye[1]) / d); }
    sky.push(best);
  }
  let peaks = 0, last = -99;
  for (let k = 3; k < N - 3; k++) if (sky[k] > 0.03 && sky[k] >= Math.max(...sky.slice(k - 3, k + 4)) && k - last >= 4) { peaks++; last = k; }
  assert.ok(peaks >= 3, `chỉ ${peaks} đỉnh`);
});

test('lưới: thuộc tính, trần tam giác, pháp tuyến, vùng đất liền', () => {
  const g = mtGeometry(), n = g.getAttribute('position').count, tris = g.index!.count / 3;
  assert.ok(tris <= T.maxTris && tris >= 30000, `${tris} tam giác`);
  for (const [a, size] of [['position', 3], ['normal', 3], ['color', 3], ['aRock', 1]] as [string, number][]) {
    const at = g.getAttribute(a); assert.ok(at, `thiếu ${a}`); assert.equal(at.itemSize, size); assert.equal(at.count, n);
    for (const v of at.array as ArrayLike<number>) assert.ok(Number.isFinite(v), `${a} có NaN`);
  }
  const p = g.getAttribute('position'), nr = g.getAttribute('normal'), c = g.getAttribute('color');
  for (let i = 0; i < n; i++) {
    assert.ok(Math.abs(Math.hypot(nr.getX(i), nr.getY(i), nr.getZ(i)) - 1) < 1e-3 && nr.getY(i) > 0);
    assert.ok(c.getX(i) >= 0 && c.getY(i) >= 0 && c.getZ(i) >= 0);
    if (p.getX(i) > 262 && p.getX(i) < T.keepX && p.getZ(i) > T.keepZ) assert.ok(p.getY(i) <= 2.5, `đỉnh trong đất liền cao ${p.getY(i)}`);
  }
  console.log(`  lưới núi: ${n} đỉnh, ${tris} tam giác`);
});

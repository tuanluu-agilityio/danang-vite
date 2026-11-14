/* ===== Xe máy: camera góc thứ ba = drCamPlace với bộ số CONFIG.bike.cam3 (src/explore/drive/camera.ts) =====
   Với K = CONFIG.bike.cam3 camera đứng sau xe đúng cam3.dist; gọi không có K vẫn cho kết quả cũ của ô tô (chép ca "đặt sau xe" của tests/drive-unit/camera.test.ts). */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { CONFIG } from '../../src/config.ts';
import { drMakeNet, type DrPad } from '../../src/explore/drive/net.ts';
import { drCamPlace, drCamDrag, type DrCam } from '../../src/explore/drive/camera.ts';
import type { DrState } from '../../src/explore/drive/motion.ts';

const K3 = CONFIG.bike.cam3, KC = CONFIG.drive.cam;
const flatPad = (x0: number, x1: number, z0: number, z1: number, y = 2.6): DrPad => ({ id: 'a', kind: 'road', x0, x1, z0, z1, y: () => y });
const state = (x: number, z: number, yaw = 0, y = 2.6): DrState => ({ x, y, z, yaw, pitch: 0, v: 0, steer: 0, wheel: 0, braking: false, evac: 0, slide: 1, touch: 0 });
const cam = (): DrCam => ({ yaw: 0, pitch: 0, idle: 0 });
const net = () => drMakeNet([flatPad(-100, 100, -100, 100)], []);

test('K = CONFIG.bike.cam3: camera sau xe ≈ cam3.dist, cao cam3.height', () => {
  const c = new THREE.PerspectiveCamera(), n = net();
  for (const yaw of [0, Math.PI / 2, 2.1]) {
    const s = state(5, -3, yaw);
    drCamPlace(c, s, cam(), n, 0, true, K3);
    const dx = c.position.x - s.x, dz = c.position.z - s.z;
    assert.ok(Math.abs(Math.hypot(dx, dz) - K3.dist) < 0.05, `yaw ${yaw}: cách ${Math.hypot(dx, dz)}`);
    assert.ok(dx * Math.cos(yaw) + dz * -Math.sin(yaw) < -K3.dist + 0.05, `yaw ${yaw}: phía sau xe`);
    assert.ok(Math.abs(c.position.y - (2.6 + K3.height)) < 1e-6, `y ${c.position.y}`);
  }
  /* chạy nhiều khung vẫn giữ khoảng cách */
  const s = state(0, 0, 0), cc = cam();
  drCamPlace(c, s, cc, n, 0, true, K3);
  for (let i = 0; i < 60; i++) { s.x += 0.1; drCamPlace(c, s, cc, n, 1 / 60, false, K3); }
  assert.ok(Math.abs(Math.hypot(c.position.x - s.x, c.position.z - s.z) - K3.dist) < 0.05);
  assert.ok(K3.dist < KC.dist && K3.height < KC.height, 'gần và thấp hơn ô tô');
});

test('không có K: như ô tô (chép ca "đặt sau xe đúng khoảng cách")', () => {
  const n = net(), c = new THREE.PerspectiveCamera();
  drCamPlace(c, state(0, 0, 0), cam(), n, 0, true, K3);   // đổi trạng thái module bằng xe máy trước, lần gọi sau vẫn phải đúng của ô tô
  const s = state(0, 0, 0);
  drCamPlace(c, s, cam(), n, 0, true);
  assert.ok(Math.abs(c.position.x + KC.dist) < 1e-6, `x ${c.position.x}`);
  assert.ok(Math.abs(c.position.z) < 1e-6);
  assert.ok(Math.abs(c.position.y - (2.6 + KC.height)) < 1e-6, `y ${c.position.y}`);
  const s2 = state(10, 5, Math.PI / 2);
  drCamPlace(c, s2, cam(), n, 0, true);
  assert.ok(Math.abs(c.position.x - 10) < 1e-6 && Math.abs(c.position.z - (5 + KC.dist)) < 1e-6, `${c.position.x}, ${c.position.z}`);
  const d = new THREE.Vector3(); c.getWorldDirection(d);
  assert.ok(d.z < -0.9, `hướng nhìn ${d.z}`);
});

test('drCamDrag theo K: kẹp pitch theo bộ số truyền vào', () => {
  const cc = cam();
  drCamDrag(cc, 0, 1e6, K3); assert.equal(cc.pitch, K3.pitchMax);
  drCamDrag(cc, 0, -1e6, K3); assert.equal(cc.pitch, K3.pitchMin);
  drCamDrag(cc, 0, 1e6); assert.equal(cc.pitch, KC.pitchMax);
});

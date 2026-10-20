import * as THREE from 'three';
import { Water } from 'three/addons/objects/Water.js';
import { scene } from './renderer';
import { rng } from '../common/math';

/* ============================ Mặt nước sông Hàn ============================ */
export let water: Water;

function makeWaterNormals() {
  const S = 256, d = new Uint8Array(S * S * 4);
  // Tổng nhiều sóng tần số nguyên, pha ngẫu nhiên → lát gạch liền mạch, không lộ hoa văn
  const waves: [number, number, number, number][] = []; const wr = rng(77);
  for (let i = 0; i < 28; i++) {
    const fx = Math.round((wr() - 0.5) * 2 * (3 + i)), fy = Math.round((wr() - 0.5) * 2 * (3 + i));
    if (fx === 0 && fy === 0) continue;
    waves.push([fx, fy, wr() * Math.PI * 2, 1 / Math.hypot(fx, fy)]);
  }
  const hgt = (x: number, y: number) => {
    const u = x / S * Math.PI * 2, v = y / S * Math.PI * 2; let h = 0;
    for (const [fx, fy, ph, a] of waves) h += Math.sin(u * fx + v * fy + ph) * a;
    return h;
  };
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    const dx = (hgt(x + 1, y) - hgt(x - 1, y)) * 6, dy = (hgt(x, y + 1) - hgt(x, y - 1)) * 6;
    const l = Math.hypot(dx, dy, 1), i = (y * S + x) * 4;
    d[i] = (-dx / l * 0.5 + 0.5) * 255; d[i + 1] = (-dy / l * 0.5 + 0.5) * 255; d[i + 2] = (1 / l * 0.5 + 0.5) * 255; d[i + 3] = 255;
  }
  const t = new THREE.DataTexture(d, S, S, THREE.RGBAFormat);
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.needsUpdate = true;
  return t;
}
export function buildWater() {
  const g = new THREE.PlaneGeometry(40000, 40000);
  water = new Water(g, {
    textureWidth: 512, textureHeight: 512, waterNormals: makeWaterNormals(),
    sunDirection: new THREE.Vector3(0, 1, 0), sunColor: 0xffffff, waterColor: 0x2c5a4f,
    distortionScale: 2.4, fog: true
  });
  water.rotation.x = -Math.PI / 2;
  water.material.uniforms.size.value = 0.6;
  scene.add(water);
}

import * as THREE from 'three';
import { CONFIG } from '../config';
import { scene } from './renderer';
import { deckY } from '../bridges/dragon/profile';

/* ============================ Ánh sáng ============================ */
export const sun = new THREE.DirectionalLight(0xfff1dc, 3.0);
export const hemi = new THREE.HemisphereLight(0xcfe6ff, 0x6b6a55, 0.9);
export const moon = new THREE.DirectionalLight(0x8fa8ff, 0);
export const bridgeLights: THREE.PointLight[] = [];
export let fireLight: THREE.PointLight;

export function buildLights() {
  sun.castShadow = true;
  sun.shadow.mapSize.set(CONFIG.shadowMapSize, CONFIG.shadowMapSize);
  const s = sun.shadow.camera; s.left = -470; s.right = 470; s.top = 470; s.bottom = -470; s.near = 10; s.far = 2200;
  sun.shadow.camera.layers.enable(1);
  sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.6;
  scene.add(sun, hemi, moon, sun.target);
  moon.position.set(-600, 900, -400);
  // Đèn chiếu dọc Cầu Rồng ban đêm: vàng ấm xen xanh lam
  const xs = [-215, -130, -45, 45, 130, 215];
  xs.forEach((x, i) => {
    const l = new THREE.PointLight(i % 2 ? 0x4a8cff : 0xffb556, 0, 90, 1.6);
    l.position.set(x, deckY(x) + 10, i % 2 ? 9 : -9);
    l.userData.base = 350; l.userData.phase = i * 1.3;
    scene.add(l); bridgeLights.push(l);
  });
  fireLight = new THREE.PointLight(0xff7a2a, 0, 160, 1.5);
  scene.add(fireLight);
}

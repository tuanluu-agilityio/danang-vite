import * as THREE from 'three';
import { Sky } from 'three/addons/objects/Sky.js';
import { scene } from './renderer';
import { canvasTex } from './textures';
import { sun } from './lights';
import { water } from './water';
import { rand } from '../common/math';
import { UP } from '../common/geometry';

/* ============================ Bầu trời, sao, mây, mặt trời ============================ */
export let sky: Sky;
export let stars: THREE.Points<THREE.BufferGeometry, THREE.PointsMaterial>;
export let clouds: THREE.InstancedMesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial>;
const sunDir = new THREE.Vector3();
/* vùng bóng đổ (±470 m) đi theo điểm camera đang nhìn; main.ts cập nhật mỗi khung hình */
export const shadowCenter = new THREE.Vector3();

export function buildSky() {
  sky = new Sky(); sky.scale.setScalar(20000); scene.add(sky);
  const u = sky.material.uniforms;
  u.turbidity.value = 4.5; u.rayleigh.value = 1.3; u.mieCoefficient.value = 0.005; u.mieDirectionalG.value = 0.8;
  // Sao
  const n = 1600, p = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    const th = rand() * Math.PI * 2, ph = Math.acos(rand() * 0.95);
    p[i * 3] = 9000 * Math.sin(ph) * Math.cos(th); p[i * 3 + 1] = 9000 * Math.cos(ph) + 200; p[i * 3 + 2] = 9000 * Math.sin(ph) * Math.sin(th);
  }
  const sg = new THREE.BufferGeometry(); sg.setAttribute('position', new THREE.BufferAttribute(p, 3));
  stars = new THREE.Points(sg, new THREE.PointsMaterial({ color: 0xffffff, size: 1.6, sizeAttenuation: false, transparent: true, opacity: 0, fog: false, depthWrite: false }));
  scene.add(stars);
  // Mây nhẹ: các tấm ngang mềm
  const tex = canvasTex(256, 256, (g, w, h) => {
    for (let i = 0; i < 14; i++) {
      const x = 50 + Math.random() * 156, y = 70 + Math.random() * 116, r = 30 + Math.random() * 50;
      const gr = g.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, 'rgba(255,255,255,0.55)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = gr; g.fillRect(0, 0, w, h);
    }
  });
  const cm = new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, opacity: 0.85, side: THREE.DoubleSide });
  const cg = new THREE.PlaneGeometry(1, 1).rotateX(Math.PI / 2);
  clouds = new THREE.InstancedMesh(cg, cm, 26);
  const m = new THREE.Matrix4(), q = new THREE.Quaternion();
  for (let i = 0; i < 26; i++) {
    const a = rand() * Math.PI * 2, d = 900 + rand() * 4500, sc = 400 + rand() * 900;
    q.setFromAxisAngle(UP, rand() * Math.PI);
    m.compose(new THREE.Vector3(Math.cos(a) * d, 900 + rand() * 500, Math.sin(a) * d), q, new THREE.Vector3(sc, 1, sc * 0.6));
    clouds.setMatrixAt(i, m);
  }
  scene.add(clouds);
}
export function setSun(elev: number, azim: number) {
  sunDir.setFromSphericalCoords(1, THREE.MathUtils.degToRad(90 - elev), THREE.MathUtils.degToRad(azim));
  sky.material.uniforms.sunPosition.value.copy(sunDir);
  if (water) water.material.uniforms.sunDirection.value.copy(sunDir).normalize();
  // vùng bóng đổ (±470 m) đi theo điểm camera đang nhìn; mặc định vẫn là gốc tọa độ như trước
  sun.position.copy(shadowCenter).addScaledVector(sunDir, 1000);
  sun.target.position.copy(shadowCenter);
}

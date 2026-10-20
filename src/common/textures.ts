import * as THREE from 'three';
import { canvasTex } from '../core/textures';

/* Mặt đường 1 chiều 3 làn: chu kỳ 12 m theo chiều dài (u), mặt cắt ngang theo v */
export function makeRoadTexture(lanes: number) {
  const t = canvasTex(256, 512, (g, w, h) => {
    g.fillStyle = '#54575a'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 2500; i++) { const v = 70 + Math.random() * 30; g.fillStyle = `rgba(${v},${v},${v + 3},0.35)`; g.fillRect(Math.random() * w, Math.random() * h, 2, 2); }
    g.fillStyle = '#f2f2ee';
    const edge = 0.06 * h; // mép
    g.fillRect(0, edge - 5, w, 7); g.fillRect(0, h - edge - 2, w, 7);
    for (let i = 1; i < lanes; i++) { const y = edge + (h - 2 * edge) * i / lanes; g.fillRect(0, y - 3, w * 0.33, 6); }
  });
  t.wrapS = THREE.RepeatWrapping; t.wrapT = THREE.ClampToEdgeWrapping;
  return t;
}
/* Vạch làn: vạch vàng đôi sát dải phân cách (mép trên canvas), vạch trắng liền mép ngoài, vạch đứt giữa các làn.
   Chu kỳ 12 m theo chiều dài; vạch đứt 3 m. */
export function makeLaneTexture(lanes: number) {
  const t = canvasTex(256, 512, (g, w, h) => {
    g.fillStyle = '#3f4245'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 2600; i++) { const v = 55 + Math.random() * 30; g.fillStyle = `rgba(${v},${v},${v + 4},0.4)`; g.fillRect(Math.random() * w, Math.random() * h, 2, 2); }
    g.fillStyle = '#e8b52c'; g.fillRect(0, 12, w, 9); g.fillRect(0, 26, w, 9);
    g.fillStyle = '#f2f2ee'; g.fillRect(0, h - 26, w, 10);
    for (let i = 1; i < lanes; i++) g.fillRect(0, h * i / lanes - 4, w * 0.25, 8);
  });
  t.wrapS = THREE.RepeatWrapping; t.wrapT = THREE.ClampToEdgeWrapping;
  return t;
}

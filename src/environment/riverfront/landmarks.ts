import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { CONFIG } from '../../config';
import { patchWindows } from '../../common/shaders';
import { boxAt, loftOct, prepColored, taperedTube } from '../../common/geometry';
import type { Rect } from './clearance';

/* [landmarks] Địa danh thật ven sông Hàn — khối gần đúng, KHÔNG có logo thật.
   Nguồn số tầng (tra 2026-10): Novotel Danang Premier Han River 37 tầng (duytan.edu.vn/conferences, banahillsgolf.com);
   Vinpearl Condotel Riverfront (nay Meliá Vinpearl Danang Riverfront, 341 Trần Hưng Đạo) 36 tầng nổi + sky bar (vinpearl.com, mia.vn);
   Trung tâm Hành chính Đà Nẵng (24 Trần Phú) 34 tầng nổi, 166,8 m, mô phỏng ngọn hải đăng (plo.vn, giaoduc.net.vn).
   TỌA ĐỘ trong cảnh là ước lượng (chưa có nguồn công khai): chi tiết ở CONFIG.riverfront. */
const R = CONFIG.riverfront, Y = CONFIG.landY;
type C3 = [number, number, number];
const GLASS: C3 = [0.62, 0.74, 0.82], GLASS2: C3 = [0.58, 0.68, 0.76], STONE: C3 = [0.86, 0.83, 0.77], BAND: C3 = [0.92, 0.92, 0.9], DARK: C3 = [0.35, 0.37, 0.4];
const box = (sx: number, sy: number, sz: number, cx: number, y0: number, cz: number, c: C3) => prepColored(boxAt(sx, sy, sz, cx, y0 + sy / 2, cz), () => c);

export interface Tower { name: string; x: number; z: number; w: number; d: number; h: number; face: 1 | -1 }
export interface Landmarks { mesh: THREE.Mesh; rects: Rect[]; towers: Tower[]; rooftops: { x: number; z: number; y: number; face: 1 | -1 }[] }

function tower(g: THREE.BufferGeometry[], x: number, z: number, w: number, d: number, floors: number, c: C3, podium: number) {
  const H = floors * R.floorH;
  g.push(box(w + podium, 10, d + podium, x, Y, z, STONE));                       // bệ thương mại
  g.push(box(w, H, d, x, Y, z, c));
  for (let f = 6; f < floors; f += 6) g.push(box(w + 0.6, 0.7, d + 0.6, x, Y + f * R.floorH, z, BAND));   // dải chia tầng
  g.push(box(w - 6, 6, d - 6, x, Y + H, z, GLASS2), box(1.2, 16, 1.2, x, Y + H + 6, z, DARK));          // vương miện, cột ăng-ten
  return Y + H + 6;
}

export function buildLandmarks(): Landmarks {
  const g: THREE.BufferGeometry[] = [], rects: Rect[] = [], towers: Tower[] = [], rooftops: Landmarks['rooftops'] = [];
  const rect = (x: number, z: number, w: number, d: number) => rects.push({ x0: x - w / 2, x1: x + w / 2, z0: z - d / 2, z1: z + d / 2 });
  // Novotel (bờ Tây) — tháp kính xanh xám, mặt chính nhìn ra sông (+X)
  const N = R.novotel; tower(g, N.x, N.z, N.w, N.d, N.floors, GLASS, 12); rect(N.x, N.z, N.w + 12, N.d + 12);
  towers.push({ name: 'novotel', x: N.x, z: N.z, w: N.w, d: N.d, h: N.floors * R.floorH, face: 1 });
  // Vinpearl Condotel Riverfront (bờ Đông) — tháp có bậc thụt, mặt chính nhìn ra sông (−X)
  const V = R.vinpearl, Hv = V.floors * R.floorH;
  g.push(box(V.w + 12, 10, V.d + 12, V.x, Y, V.z, STONE), box(V.w, Hv * 0.8, V.d, V.x, Y, V.z, GLASS), box(V.w - 8, Hv * 0.2, V.d - 8, V.x + 4, Y + Hv * 0.8, V.z, GLASS2));
  for (let f = 6; f < V.floors; f += 6) g.push(box(V.w + 0.6, 0.7, V.d + 0.6, V.x, Y + Math.min(f * R.floorH, Hv * 0.8 - 1), V.z, BAND));
  g.push(box(1.2, 14, 1.2, V.x + 4, Y + Hv, V.z, DARK)); rect(V.x, V.z, V.w + 12, V.d + 12);
  towers.push({ name: 'vinpearl', x: V.x, z: V.z, w: V.w, d: V.d, h: Hv * 0.8, face: -1 });
  // Trung tâm Hành chính: thân bát giác thuôn dần, các dải kính, đỉnh đèn hải đăng
  const A = R.admin, Ah = A.h;
  g.push(prepColored(loftOct([A.r0 * 2, A.r0 * 2], [A.r1 * 2, A.r1 * 2], Y, Y + Ah - 18, [A.x, A.z], [A.x, A.z], 4), () => GLASS2));
  for (let k = 1; k < 6; k++) { const t = k / 6, r = (A.r0 + (A.r1 - A.r0) * t) * 2; g.push(prepColored(loftOct([r + 1, r + 1], [r + 1, r + 1], Y + (Ah - 18) * t, Y + (Ah - 18) * t + 1.2, [A.x, A.z], [A.x, A.z], 3), () => BAND)); }
  g.push(prepColored(loftOct([A.r1 * 2 + 3, A.r1 * 2 + 3], [A.r1 * 2 - 3, A.r1 * 2 - 3], Y + Ah - 18, Y + Ah - 5, [A.x, A.z], [A.x, A.z], 2), () => [0.75, 0.85, 0.92]));   // đèn hải đăng
  g.push(box(A.r1, 4, A.r1, A.x, Y + Ah - 5, A.z, DARK), box(1, 8, 1, A.x, Y + Ah - 1, A.z, DARK));
  g.push(box(A.r0 * 2 + 14, 9, A.r0 * 2 + 14, A.x, Y, A.z, STONE)); rect(A.x, A.z, A.r0 * 2 + 18, A.r0 * 2 + 18);
  // Chợ Hàn: 3 tầng, mái phẳng, chân đế sáng màu
  const K = R.market;
  g.push(box(K.w, K.h, K.d, K.x, Y, K.z, [0.93, 0.86, 0.7]), box(K.w + 2, 0.8, K.d + 2, K.x, Y + K.h, K.z, [0.82, 0.4, 0.3]), box(K.w * 0.4, 3.5, K.d * 0.5, K.x, Y + K.h + 0.8, K.z, [0.93, 0.86, 0.7])); rect(K.x, K.z, K.w + 4, K.d + 4);
  // Bảo tàng Điêu khắc Chăm: tường vàng đất, mái ngói chóp
  const M = R.museum;
  g.push(box(M.w, M.h, M.d, M.x, Y, M.z, [0.86, 0.68, 0.42]));
  const roof = new THREE.ConeGeometry(0.7071, 1, 4).rotateY(Math.PI / 4).scale(M.w + 3, 5.5, M.d + 3).translate(M.x, Y + M.h + 2.75, M.z);
  g.push(prepColored(roof, () => [0.62, 0.3, 0.2]), box(8, 9, 8, M.x + M.w / 2 - 8, Y + M.h, M.z, [0.82, 0.62, 0.38])); rect(M.x, M.z, M.w + 6, M.d + 6);
  // Cụm khách sạn ven Trần Hưng Đạo (bờ Đông)
  const hc: C3[] = [[0.7, 0.78, 0.84], [0.82, 0.78, 0.7], [0.66, 0.74, 0.8]];
  R.hotels.forEach((h, i) => { const top = tower(g, h.x, h.z, h.w, h.d, h.floors, hc[i % 3], 8); rect(h.x, h.z, h.w + 8, h.d + 8); rooftops.push({ x: h.x, z: h.z, y: top - 22, face: -1 }); });
  // Cầu Tình Yêu: cầu tàu nhô ra từ kè Đông, cọc, lan can, khóa tình yêu, bệ + tượng cá chép hóa rồng ở đầu cầu
  const L = R.love, x1 = CONFIG.bankX, x0 = x1 - L.length, xm = (x0 + x1) / 2;
  g.push(box(L.length, 0.45, L.width, xm, 2.55, L.z, [0.8, 0.77, 0.72]));
  for (let x = x0 + 3; x < x1; x += 8) for (const s of [-1, 1]) g.push(box(0.7, 7.5, 0.7, x, -5, L.z + s * (L.width / 2 - 0.5), [0.5, 0.5, 0.5]));
  for (const s of [-1, 1]) { g.push(box(L.length, 0.1, 0.12, xm, 3.7, L.z + s * (L.width / 2 - 0.1), [0.8, 0.82, 0.85])); for (let x = x0 + 1; x < x1; x += 2.2) g.push(box(0.1, 1.1, 0.1, x, 3, L.z + s * (L.width / 2 - 0.1), [0.8, 0.82, 0.85])); }
  for (let x = x0 + 2; x < x1 - 1; x += 1.3) for (const s of [-1, 1]) g.push(box(0.2, 0.28, 0.06, x, 3.15 + ((x * 7) % 3) * 0.12, L.z + s * (L.width / 2 - 0.2), [0.9, 0.7, 0.2]));
  g.push(box(3.4, 1.2, 3.4, x0 + 1.8, 3, L.z, [0.86, 0.85, 0.82]));
  const carp = new THREE.CatmullRomCurve3([[0, 0, 0], [-0.3, 1.2, 0.3], [-0.9, 2.8, -0.2], [-1.7, 4.2, 0.2], [-2.9, 5.2, 0]].map(([x, y, z]) => new THREE.Vector3(x, y, z)));
  const body = taperedTube(carp, 26, 10, (u) => 0.95 - 0.6 * u + 0.28 * Math.sin(u * 3.1));
  body.translate(x0 + 1.8, 4.2, L.z);
  g.push(prepColored(body, () => [0.97, 0.97, 0.95]), prepColored(new THREE.SphereGeometry(0.85, 12, 10).translate(x0 + 1.8 - 3.1, 4.2 + 5.3, L.z), () => [0.97, 0.97, 0.95]));
  g.push(box(0.15, 2.4, 1.6, x0 + 1.8 - 0.4, 4.2 + 2.4, L.z, [0.95, 0.95, 0.92]));
  rects.push({ x0: x0 - 2, x1: x1 + 2, z0: L.z - L.width / 2 - 1, z1: L.z + L.width / 2 + 1 });
  // chuẩn hóa thuộc tính để gộp một mesh
  const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.55, metalness: 0.18 }); patchWindows(mat);
  const mesh = new THREE.Mesh(mergeGeometries(g.map((q) => { const n = q.index ? q.toNonIndexed() : q; if (n.attributes.uv) n.deleteAttribute('uv'); return n; })), mat);
  mesh.name = 'rf-landmarks'; mesh.castShadow = true; mesh.receiveShadow = true;
  return { mesh, rects, towers, rooftops };
}

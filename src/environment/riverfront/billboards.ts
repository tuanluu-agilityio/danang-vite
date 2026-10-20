import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { CONFIG } from '../../config';
import { MAT } from '../../core/materials';
import { shared } from '../../core/shared';
import { lerp, rng } from '../../common/math';
import { boxAt } from '../../common/geometry';
import type { Atlas, Slot } from './adAtlas';
import type { Building, Rect } from './clearance';
import type { Landmarks } from './landmarks';

/* [billboards] Bốn loại bảng: (a) pano trụ đơn, (b) bảng trên nóc nhà, (c) màn LED mặt tiền đổi quảng cáo, (d) băng rôn cột đèn.
   Mọi bảng tĩnh dùng MỘT vật liệu atlas (emissive = map × uNight); màn LED dùng shader riêng để chuyển mờ giữa hai ô atlas.
   Vị trí tránh: hành lang hầm, hai đầu cầu; không có bảng nào chắn tầm nhìn chính tới các cầu. */
const Y = CONFIG.landY, B = CONFIG.bankX, R = CONFIG.riverfront;

function slotPlane(atlas: Atlas, s: Slot, w: number, h: number, rotY: number, x: number, y: number, z: number) {
  const g = new THREE.PlaneGeometry(w, h), [u0, v0, u1, v1] = atlas.rect(s), uv = g.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, lerp(u0, u1, uv.getX(i)), lerp(v0, v1, uv.getY(i)));
  g.rotateY(rotY); g.translate(x, y, z); return g;
}
const faceRot = (nx: number, nz: number) => Math.atan2(nx, nz);   // góc quay Y đưa pháp tuyến +z về (nx, nz)

/* Vị trí pano (x, z, trục mặt bảng); dùng cả để dọn nhà ngẫu nhiên bị đè trước khi dựng */
export const PANOS: [number, number, 'x' | 'z'][] = [[-900, 27, 'x'], [-1250, -27, 'x'], [-620, 27, 'x'], [800, -27, 'x'], [1100, 27, 'x'], [316, -300, 'z'], [316, 520, 'z'], [-316, 640, 'z']];
export const panoRects = (): Rect[] => PANOS.map(([x, z]) => ({ x0: x - 7, x1: x + 7, z0: z - 7, z1: z + 7 }));

export interface Screen { cur: number; next: number; t: number; fade: number }
export interface Billboards {
  group: THREE.Group; adMat: THREE.MeshStandardMaterial; ledMat: THREE.ShaderMaterial; screens: Screen[]; rects: Rect[];
  counts: { panos: number; roofs: number; screens: number; banners: number };
  update(dt: number): void; setEnabled(on: boolean): void; dispose(): void;
}

export function buildBillboards(atlas: Atlas, lm: Landmarks, buildings: Building[]): Billboards {
  const group = new THREE.Group(); group.name = 'rf-billboards';
  const boards: THREE.BufferGeometry[] = [], steel: THREE.BufferGeometry[] = [], rects: Rect[] = [];
  const rnd = rng(8812);
  const panos = atlas.byKind('pano'), roofs = atlas.byKind('roof'), shops = atlas.byKind('landmark');
  // (a) pano trụ đơn 12 × 4 m, trụ thép 12 m, hai mặt
  PANOS.slice(0, R.ads.panos).forEach(([x, z, ax], i) => {
    const n = ax === 'x' ? [1, 0] : [0, 1], s = panos[i % panos.length];
    for (const sg of [1, -1]) boards.push(slotPlane(atlas, s, 12, 4, faceRot(n[0] * sg, n[1] * sg), x + n[0] * sg * 0.28, Y + 12, z + n[1] * sg * 0.28));
    steel.push(new THREE.CylinderGeometry(0.35, 0.45, 12, 8).translate(x, Y + 6, z));
    steel.push(boxAt(ax === 'x' ? 0.4 : 12.4, 4.4, ax === 'x' ? 12.4 : 0.4, x, Y + 12, z));
    rects.push({ x0: x - 7, x1: x + 7, z0: z - 7, z1: z + 7 });
  });
  // (b) bảng trên nóc: 3 khách sạn ven Trần Hưng Đạo + vài nhà ngẫu nhiên đang có (lấy mái thật), khung thép lộ ra, quay ra sông
  const used = new Set<Building>();
  const roofSpots: { x: number; z: number; y: number; face: 1 | -1 }[] = [...lm.rooftops];
  const pickRoof = (side: 1 | -1) => {
    const c = buildings.filter((b) => Math.sign(b.x) === side && Math.abs(b.x) > 320 && Math.abs(b.x) < 380 && b.h > 25 && b.h < 80 && b.w > 14 && Math.abs(b.z) < 1100 && Math.abs(b.z) > 120 && !used.has(b));
    const b = c[Math.floor(rnd() * c.length)]; if (!b) return; used.add(b);
    roofSpots.push({ x: b.x, z: b.z, y: Y + b.h, face: (side > 0 ? -1 : 1) as 1 | -1 });
  };
  pickRoof(-1); pickRoof(1); pickRoof(-1);
  roofSpots.slice(0, R.ads.roofs).forEach((p, i) => {
    const s = roofs[i % roofs.length], y = p.y + 4.5;
    boards.push(slotPlane(atlas, s, 10, 4, faceRot(p.face, 0), p.x + p.face * 0.3, y, p.z));
    for (const dz of [-4.2, 4.2]) steel.push(boxAt(0.4, 4.5, 0.4, p.x, p.y + 2.25, p.z + dz));
    steel.push(boxAt(0.4, 0.4, 10.6, p.x, y - 2.1, p.z), boxAt(0.4, 0.4, 10.6, p.x, y + 2.1, p.z));
  });
  // lan can/biển hiệu địa danh: Chợ Hàn, Bảo tàng Điêu khắc Chăm (mặt quay ra sông, +X)
  const K = CONFIG.riverfront.market, M = CONFIG.riverfront.museum;
  boards.push(slotPlane(atlas, shops[0], 22, 2.75, faceRot(1, 0), K.x + K.w / 2 + 0.12, Y + K.h - 2.4, K.z));
  boards.push(slotPlane(atlas, shops[1], 20, 2.5, faceRot(1, 0), M.x + M.w / 2 + 0.12, Y + 6.5, M.z));
  // (d) băng rôn treo cột đèn dọc Bạch Đằng / Trần Hưng Đạo: hai mặt, mỗi 3 cột một băng, tránh cầu/hầm
  const banners = atlas.byKind('banner'); let bi = 0, nb = 0;
  const skip = (z: number) => Math.abs(z) < 38 || Math.abs(z - CONFIG.songHan.z) < 22 || Math.abs(z - CONFIG.ttl.z) < 40 || Math.abs(z - (CONFIG.ttl.z - 65)) < 16 || Math.abs(z - CONFIG.hanTunnel.z) < 30;
  for (const sd of [-1, 1]) for (let k = 0, z = -2300; z < 2300; z += 30, k++) {
    if (k % 3 || skip(z)) continue;
    const x = sd * (B + 22) + sd * 0.9, s = banners[bi++ % Math.min(banners.length, R.ads.banners)];
    for (const sg of [1, -1]) boards.push(slotPlane(atlas, s, 1.1, 3.3, faceRot(0, sg), x, Y + 5, z + sg * 0.03));
    steel.push(boxAt(0.1, 0.1, 1.2, sd * (B + 22) + sd * 0.4, Y + 6.7, z));
    nb++;
  }
  const adMat = new THREE.MeshStandardMaterial({ map: atlas.texture, emissiveMap: atlas.texture, emissive: 0xffffff, emissiveIntensity: 0, roughness: 0.85 });
  const boardMesh = new THREE.Mesh(mergeGeometries(boards), adMat); boardMesh.name = 'rf-ad-boards';
  const steelMesh = new THREE.Mesh(mergeGeometries(steel.map((g) => { if (g.attributes.uv) g.deleteAttribute('uv'); return g; })), MAT.girder); steelMesh.castShadow = true; steelMesh.name = 'rf-ad-steel';
  group.add(boardMesh, steelMesh);

  // (c) màn LED mặt tiền: 3 tòa cao gần Cầu Rồng và Cầu sông Hàn, mặt hướng ra sông; quảng cáo đổi mỗi 8 s, chuyển mờ 0,6 s
  const screenSlots = atlas.byKind('screen'), screens: Screen[] = [];
  const near = (side: 1 | -1, zt: number) => buildings.filter((b) => Math.sign(b.x) === side && Math.abs(b.x) > 320 && Math.abs(b.x) < 380 && b.h >= 40 && !used.has(b)).sort((a, b) => Math.abs(a.z - zt) - Math.abs(b.z - zt))[0];
  const sPos: [Building | undefined, 1 | -1][] = [[near(-1, -140), 1], [near(1, -190), -1], [near(-1, -930), 1]];
  const pos: number[] = [], uvs: number[] = [], ix: number[] = [];
  sPos.slice(0, R.ads.screens).forEach(([b, face], i) => {
    if (!b) return; used.add(b);
    const w = 16, h = 9, cx = b.x + face * (b.w / 2 + 0.15), cy = Y + Math.min(b.h * 0.55, 32), g = new THREE.PlaneGeometry(w, h).rotateY(face > 0 ? Math.PI / 2 : -Math.PI / 2).translate(cx, cy, b.z);
    const base = pos.length / 3; pos.push(...(g.attributes.position.array as Float32Array)); uvs.push(...(g.attributes.uv.array as Float32Array));
    for (const k of g.index.array) ix.push(k + base);
    screens.push({ cur: i % screenSlots.length, next: (i + 1) % screenSlots.length, t: i * 2.5, fade: 0 });
  });
  const aA = new Float32Array(pos.length / 3 * 4), aB = new Float32Array(pos.length / 3 * 4), aM = new Float32Array(pos.length / 3);
  const ledGeo = new THREE.BufferGeometry();
  ledGeo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); ledGeo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2)); ledGeo.setIndex(ix);
  ledGeo.setAttribute('aA', new THREE.BufferAttribute(aA, 4)); ledGeo.setAttribute('aB', new THREE.BufferAttribute(aB, 4)); ledGeo.setAttribute('aM', new THREE.BufferAttribute(aM, 1));
  const ledMat = new THREE.ShaderMaterial({
    uniforms: { uAtlas: { value: atlas.texture }, uNight: shared.uNight },
    vertexShader: 'attribute vec4 aA; attribute vec4 aB; attribute float aM; varying vec2 vUv; varying vec4 vA; varying vec4 vB; varying float vM; void main(){ vUv = uv; vA = aA; vB = aB; vM = aM; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: `uniform sampler2D uAtlas; uniform float uNight; varying vec2 vUv; varying vec4 vA; varying vec4 vB; varying float vM;
      void main(){ vec3 a = texture2D(uAtlas, mix(vA.xy, vA.zw, vUv)).rgb, b = texture2D(uAtlas, mix(vB.xy, vB.zw, vUv)).rgb;
        vec2 f = fract(vUv * vec2(64.0, 36.0)); float dotM = 0.78 + 0.22 * smoothstep(0.0, 0.25, min(min(f.x, 1.0 - f.x), min(f.y, 1.0 - f.y)));
        gl_FragColor = vec4(mix(a, b, vM) * dotM * mix(0.55, 1.25, uNight), 1.0);
        #include <colorspace_fragment>
      }`
  });
  const ledMesh = new THREE.Mesh(ledGeo, ledMat); ledMesh.name = 'rf-led-screens'; ledMesh.frustumCulled = false; if (screens.length) group.add(ledMesh);
  const setRects = (): void => {
    screens.forEach((s, i) => {
      const A = atlas.rect(screenSlots[s.cur]), Bq = atlas.rect(screenSlots[s.next]);
      for (let v = 0; v < 4; v++) { const k = i * 4 + v; aA.set(A, k * 4); aB.set(Bq, k * 4); aM[k] = s.fade; }
    });
    (ledGeo.attributes.aA as THREE.BufferAttribute).needsUpdate = (ledGeo.attributes.aB as THREE.BufferAttribute).needsUpdate = (ledGeo.attributes.aM as THREE.BufferAttribute).needsUpdate = true;
  };
  setRects();
  for (const o of [boardMesh, steelMesh, ledMesh]) o.layers.set(1);     // bảng nhỏ không cần phản chiếu trên mặt nước

  const api: Billboards = {
    group, adMat, ledMat, screens, rects, counts: { panos: Math.min(PANOS.length, R.ads.panos), roofs: Math.min(roofSpots.length, R.ads.roofs), screens: screens.length, banners: nb },
    update(dt) {
      adMat.emissiveIntensity = shared.uNight.value * 1.15;
      let dirty = false;
      for (const s of screens) {
        s.t += dt;
        if (s.fade === 0 && s.t >= R.ads.switchEvery) { s.fade = 1e-4; s.t = 0; dirty = true; }
        if (s.fade > 0) { s.fade = Math.min(1, s.fade + dt / R.ads.fade); dirty = true; if (s.fade >= 1) { s.cur = s.next; s.next = (s.next + 1) % screenSlots.length; s.fade = 0; } }
      }
      if (dirty) setRects();
    },
    setEnabled(on) { group.visible = on; },
    dispose() { boardMesh.geometry.dispose(); steelMesh.geometry.dispose(); ledGeo.dispose(); adMat.dispose(); ledMat.dispose(); group.removeFromParent(); }
  };
  return api;
}

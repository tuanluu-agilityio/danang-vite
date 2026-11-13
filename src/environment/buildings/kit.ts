/* ===== Nhà ven sông (D-037 bản 2, D-038): bộ phụ kiện kiến trúc đặt chồng lên thân hộp của buildCity() =====
   Dải sát sông cả hai bờ (CONFIG.buildings.band, bkInBand). Spec docs/superpowers/specs/2026-11-13-ven-song-chan-thuc-design.md §6.
   - Gọi SAU mọi lệnh dọn nhà (buildRiverfront, drClearRoads, SunWheel) và trước buildWeather / prewarm: đọc collectBuildings() (nhà còn hiện, tọa độ thế giới),
     lấy họ từ aFam của thân (bkReshape đã gán, reshape.ts), mỗi họ MỘT InstancedMesh 'bk-fam<id>' cho cả hai bờ, đặt thẳng vào scene (không làm con của LOD:
     collectBuildings / clearRects / cutaway nhận lưới nhà theo cha LOD). Không đổi ma trận instance nào của nhà.
   - instanceMatrix của kit = dịch (x, landY, z) · co giãn (w, h, d) của nhà (luôn dương). Bờ Đông: thuộc tính instance aFlip = −1 xoay 180° quanh trục đứng
     trong shader (nhân x, z của neo, bkOff, pháp tuyến): mặt +X của mô hình (mặt nhìn ra sông) quay về −X. Xoay không đảo chiều tam giác (khác lật gương).
   - Shader: vị trí = neo × (w, h, d) + bkOff (m) ⇒ cộng bkOff / tỉ lệ instance trước khi nhân ma trận; chi tiết theo tầng (bkRule > h − 3) thu về một điểm;
     LOD theo khoảng cách camera → chân nhà: > kitNear thu chi tiết theo tầng (bkRule > 0), > kitFar thu cả tòa (không thêm lưới, không thêm lệnh vẽ);
     pháp tuyến KHÔNG qua phép co giãn không đều của instance (kit đã ghi pháp tuyến cho hình cuối); màu = color.rgb × (alpha 1: màu tường aWall, 0: tuyệt đối);
     phát sáng đêm = màu × màu biển hiệu của tòa (glowColors, băm vị trí) × bkGlow × uNight × glowGain.
   - Lớp 1 (không vào gương mặt nước), không đổ bóng, nhận bóng. Mặt phẳng cắt Hầm chép từ vật liệu nhà (cutaway.ts) để cùng kiểu cắt. */
import * as THREE from 'three';
import { CONFIG } from '../../config';
import { scene } from '../../core/renderer';
import { shared } from '../../core/shared';
import { collectBuildings, Building } from '../riverfront/clearance';
import { bkGet, BkKit } from './kitData';
import { bkInBand } from './reshape';

const f4 = (n: number) => n.toFixed(4);
const lin = (hex: number) => { const c = new THREE.Color().setHex(hex); return `vec3(${f4(c.r)}, ${f4(c.g)}, ${f4(c.b)})`; };

function bkMaterial(): THREE.MeshStandardMaterial {
  const B = CONFIG.buildings;
  const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: B.roughness, metalness: B.metalness });
  mat.name = 'bkKit';
  mat.customProgramCacheKey = () => 'bk-kit';
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.uNight = shared.uNight;
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nattribute vec3 aWall; attribute float aFlip; attribute vec3 bkOff; attribute float bkRule; attribute float bkGlow; varying float vGlow; varying vec3 vGlowC;')
      .replace('#include <color_vertex>', `#include <color_vertex>
        #ifdef USE_COLOR_ALPHA
          vColor = vec4(color.rgb * mix(vec3(1.0), aWall, color.a), 1.0);   // alpha 1: nhân màu tường; 0: màu tuyệt đối. Alpha ra 1: không trong suốt
        #endif`)
      .replace('#include <defaultnormal_vertex>', `
        vec3 transformedNormal = objectNormal;
        #ifdef USE_INSTANCING
          transformedNormal = normal; transformedNormal.xz *= aFlip;   // bỏ phép co giãn instance; bờ Đông xoay 180° quanh trục đứng
        #endif
        transformedNormal = normalMatrix * transformedNormal;`)
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        { vec3 isc = vec3(1.0), off = bkOff; float cd = 0.0;
        #ifdef USE_INSTANCING
          isc = max(vec3(length(instanceMatrix[0].xyz), length(instanceMatrix[1].xyz), length(instanceMatrix[2].xyz)), vec3(1e-4));
          cd = distance((modelMatrix * vec4(instanceMatrix[3].xyz, 1.0)).xyz, cameraPosition);   // camera → chân nhà (m)
        #endif
          transformed.xz *= aFlip; off.xz *= aFlip;
          transformed += off / isc;
          if (bkRule > isc.y - ${f4(3)} || cd > ${f4(B.kitFar)} || (bkRule > 0.0 && cd > ${f4(B.kitNear)})) transformed = vec3(0.0);   // chi tiết tầng cao hơn nhà / LOD xa: thu về một điểm
          vGlow = bkGlow; vGlowC = vec3(1.0);
        #ifdef USE_INSTANCING
          { int gi = int(fract(sin(dot(instanceMatrix[3].xz, vec2(12.9898, 78.233))) * 43758.5453) * ${f4(B.glowColors.length - 0.001)});   // màu biển hiệu theo tòa
            ${B.glowColors.map((c, i) => `if (gi == ${i}) vGlowC = ${lin(c)};`).join(' ')} }
        #endif
        }`);
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform float uNight; varying float vGlow; varying vec3 vGlowC;')
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
        #ifdef USE_COLOR_ALPHA
          totalEmissiveRadiance += vColor.rgb * vGlowC * vGlow * uNight * ${f4(B.glowGain)};
        #endif`);
  };
  return mat;
}

export interface BkState { meshes: THREE.InstancedMesh[]; counts: Record<number, number>; east: number; decorated: Building[] }
/* Dữ liệu đầy đủ của mỗi lưới để bkCull() nén lại mỗi khung: ma trận, màu tường, chiều xoay, tâm + bán kính bao của từng nhà */
interface BkFull { mesh: THREE.InstancedMesh; n: number; mat: Float32Array; wall: Float32Array; flip: Float32Array; ctr: Float32Array; sig: number }
let full: BkFull[] = [];
let state: BkState | null = null;
export const bkState = () => state;

/* Dựng kit cho dải sát sông hai bờ; kit chưa nạp được (null) thì không làm gì (nhà vẫn thấp, có mặt đứng theo họ của bkReshape). opts.east(b): nhà b ở bờ Đông (xoay 180°) */
export function buildBuildingKit(opts: { kit?: BkKit | null; east?: (b: Building) => boolean } = {}): BkState | null {
  const kit = opts.kit === undefined ? bkGet() : opts.kit;
  if (!kit) return null;
  const eastOf = opts.east ?? ((b: Building) => b.x > 0);
  const groups = new Map<number, Building[]>();
  const counts: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 }, decorated: Building[] = [];
  let east = 0;
  for (const b of collectBuildings()) {
    if (!bkInBand(b.x)) continue;
    const af = b.mesh.geometry.getAttribute('aFam') as THREE.BufferAttribute | undefined;
    const fam = af ? Math.round(af.getX(b.i)) : 0;
    if (!fam || !kit.has(fam)) continue;
    if (!groups.has(fam)) groups.set(fam, []);
    groups.get(fam)!.push(b); counts[fam]++; decorated.push(b); if (eastOf(b)) east++;
  }
  const mat = bkMaterial();
  const body = decorated[0]?.mesh.material as THREE.Material | undefined;   // cùng kiểu cắt với thân nhà (mặt cắt Hầm, cutaway.ts)
  if (body) { mat.clippingPlanes = body.clippingPlanes; mat.clipIntersection = body.clipIntersection; }
  const meshes: THREE.InstancedMesh[] = [];
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), p = new THREE.Vector3(), s = new THREE.Vector3(), c = new THREE.Color();
  for (const [fam, list] of [...groups].sort((a, b) => a[0] - b[0])) {
    const src = kit.get(fam)!, g = new THREE.BufferGeometry();
    for (const [k, a] of Object.entries(src.attributes)) g.setAttribute(k, a);
    if (src.index) g.setIndex(src.index);
    const wall = new Float32Array(list.length * 3), flip = new Float32Array(list.length);
    const mesh = new THREE.InstancedMesh(g, mat, list.length), ctr = new Float32Array(list.length * 4);
    list.forEach((b, i) => {
      ctr[i * 4] = b.x; ctr[i * 4 + 1] = CONFIG.landY + b.h / 2; ctr[i * 4 + 2] = b.z; ctr[i * 4 + 3] = Math.hypot(b.w, b.h, b.d) / 2;
      mesh.setMatrixAt(i, m.compose(p.set(b.x, CONFIG.landY, b.z), q, s.set(b.w, b.h, b.d)));
      if (b.mesh.instanceColor) b.mesh.getColorAt(b.i, c); else c.setRGB(1, 1, 1);
      wall[i * 3] = c.r; wall[i * 3 + 1] = c.g; wall[i * 3 + 2] = c.b;
      flip[i] = eastOf(b) ? -1 : 1;
    });
    g.setAttribute('aWall', new THREE.InstancedBufferAttribute(wall, 3));
    g.setAttribute('aFlip', new THREE.InstancedBufferAttribute(flip, 1));
    // khung bao: neo trong hộp đơn vị (đối xứng qua trục đứng: xoay 180° vẫn trong hộp) × ma trận instance = hộp nhà; cộng độ lệch bkOff lớn nhất (ban công, mái…).
    // Một lưới trải cả hai bờ nên khung bao rất lớn (gần như luôn trong khung nhìn); không sai, chỉ ít khi được cắt
    g.computeBoundingSphere(); mesh.computeBoundingSphere(); mesh.computeBoundingBox();
    const off = g.getAttribute('bkOff'); let r = 0;
    for (let k = 0; k < off.count; k++) r = Math.max(r, Math.hypot(off.getX(k), off.getY(k), off.getZ(k)));
    mesh.boundingSphere!.radius += r; mesh.boundingBox!.expandByScalar(r);
    mesh.name = `bk-fam${fam}`;
    mesh.layers.set(1); mesh.castShadow = false; mesh.receiveShadow = true;
    mesh.frustumCulled = false;   // bkCull() tự cắt từng nhà theo khung nhìn và khoảng cách
    for (let k = 0; k < list.length; k++) ctr[k * 4 + 3] += r;
    full.push({ mesh, n: list.length, mat: (mesh.instanceMatrix.array as Float32Array).slice(), wall: wall.slice(), flip: flip.slice(), ctr, sig: -1 });
    scene.add(mesh); meshes.push(mesh);
  }
  state = { meshes, counts, east, decorated };
  return state;
}

/* Mỗi khung, trước khi vẽ: chỉ giữ trong bộ đệm instance những nhà nằm trong khung nhìn VÀ trong tầm kitFar (shader đằng nào cũng thu nhà xa hơn về một điểm,
   nhưng vẫn phải chạy shader đỉnh cho mọi đỉnh của nó). Đo GPU thật: kit từ khoảng 0,6 ms xuống theo số nhà thật sự thấy. Chỉ tải lại bộ đệm khi tập nhà đổi. */
const _fr = new THREE.Frustum(), _pm = new THREE.Matrix4(), _sp = new THREE.Sphere();
export function bkCull(camera: THREE.Camera) {
  if (!full.length) return;
  camera.updateMatrixWorld();
  _fr.setFromProjectionMatrix(_pm.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse));
  const cp = camera.position, far = CONFIG.buildings.kitFar;
  for (const f of full) {
    const im = f.mesh.instanceMatrix.array as Float32Array, g = f.mesh.geometry;
    const wall = g.getAttribute('aWall') as THREE.InstancedBufferAttribute, flip = g.getAttribute('aFlip') as THREE.InstancedBufferAttribute;
    let k = 0, sig = 0;
    for (let i = 0; i < f.n; i++) {
      const x = f.ctr[i * 4], y = f.ctr[i * 4 + 1], z = f.ctr[i * 4 + 2], r = f.ctr[i * 4 + 3];
      const d = Math.hypot(x - cp.x, z - cp.z, cp.y - y) - r;
      if (d > far) continue;
      _sp.center.set(x, y, z); _sp.radius = r;
      if (!_fr.intersectsSphere(_sp)) continue;
      {   // nén: chép nhà i vào ô k
        im.set(f.mat.subarray(i * 16, i * 16 + 16), k * 16);
        (wall.array as Float32Array).set(f.wall.subarray(i * 3, i * 3 + 3), k * 3); (flip.array as Float32Array)[k] = f.flip[i];
      }
      sig = (sig * 31 + i + 1) | 0; k++;
    }
    sig = (sig * 31 + k) | 0;
    if (sig !== f.sig) { f.sig = sig; f.mesh.instanceMatrix.needsUpdate = true; wall.needsUpdate = true; flip.needsUpdate = true; }
    f.mesh.count = k; f.mesh.visible = k > 0;
  }
}

/* Gỡ kit khỏi cảnh. Thân nhà giữ chiều cao, họ (aFam) và màu của bkReshape: mặt đứng theo họ không phụ thuộc kit */
export function disposeBuildingKit() {
  if (!state) return;
  for (const mesh of state.meshes) { scene.remove(mesh); mesh.geometry.dispose(); mesh.dispose(); }
  full = [];
  (state.meshes[0]?.material as THREE.Material | undefined)?.dispose();
  state = null;
}

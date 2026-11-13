/* ===== Nhà ven sông (D-037 bản 2, M2): bộ phụ kiện kiến trúc đặt chồng lên thân hộp của buildCity() =====
   Vùng mẫu CONFIG.buildings.zone (bờ Tây quanh Cầu Rồng). Spec docs/superpowers/specs/2026-11-13-ven-song-chan-thuc-design.md §6.
   - Gọi SAU mọi lệnh dọn nhà (buildRiverfront, drClearRoads) và trước buildWeather / prewarm: đọc collectBuildings() (nhà còn hiện, tọa độ thế giới),
     chọn họ bằng bkFamily (băm vị trí, không rand()), mỗi họ (× mỗi bờ) một InstancedMesh 'bk-fam<id>' đặt thẳng vào scene (không làm con của LOD:
     collectBuildings / clearRects / cutaway nhận lưới nhà theo cha LOD). Không đổi ma trận instance nào của nhà.
   - instanceMatrix của kit = dịch (x, landY, z) · co giãn (±w, h, d) của nhà; w âm = lật X cho bờ Đông (mặt +X của mô hình là mặt nhìn ra sông).
     Lưới lật dùng vật liệu BackSide (lật X đảo chiều tam giác); pháp tuyến lấy thẳng từ kit, chỉ đổi dấu x.
   - Shader: vị trí = neo × (w, h, d) + bkOff (m) ⇒ cộng bkOff / tỉ lệ instance trước khi nhân ma trận; chi tiết theo tầng (bkRule > h − 3) thu về một điểm;
     pháp tuyến KHÔNG qua phép co giãn không đều của instance (kit đã ghi pháp tuyến cho hình cuối); màu = color.rgb × (alpha 1: màu tường aWall, 0: tuyệt đối);
     phát sáng đêm = màu × bkGlow × uNight × glowGain.
   - Lớp 1 (không vào gương mặt nước), không đổ bóng, nhận bóng. Mặt phẳng cắt Hầm chép từ vật liệu nhà (cutaway.ts) để cùng kiểu cắt.
   - Thân nhà được gắn kit nhận aFam = họ (mặt đứng theo họ trong patchWindows, common/shaders.ts). */
import * as THREE from 'three';
import { CONFIG } from '../../config';
import { scene } from '../../core/renderer';
import { shared } from '../../core/shared';
import { collectBuildings, Building } from '../riverfront/clearance';
import { bkGet, BkKit } from './kitData';
import { bkFamily } from './families';

const f4 = (n: number) => n.toFixed(4);

/* Vật liệu kit; flip = lưới bờ Đông (lật X) */
function bkMaterial(flip: boolean): THREE.MeshStandardMaterial {
  const B = CONFIG.buildings;
  const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: B.roughness, metalness: B.metalness, side: flip ? THREE.BackSide : THREE.FrontSide });
  mat.name = flip ? 'bkKitFlip' : 'bkKit';
  mat.customProgramCacheKey = () => 'bk-kit';
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.uNight = shared.uNight;
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nattribute vec3 aWall; attribute vec3 bkOff; attribute float bkRule; attribute float bkGlow; varying float vGlow;')
      .replace('#include <color_vertex>', `#include <color_vertex>
        #ifdef USE_COLOR_ALPHA
          vColor = vec4(color.rgb * mix(vec3(1.0), aWall, color.a), 1.0);   // alpha 1: nhân màu tường; 0: màu tuyệt đối. Alpha ra 1: không trong suốt
        #endif`)
      .replace('#include <defaultnormal_vertex>', `
        vec3 transformedNormal = objectNormal;
        #ifdef USE_INSTANCING
          transformedNormal = normal; if (instanceMatrix[0].x < 0.0) transformedNormal.x = -transformedNormal.x;   // bỏ phép co giãn instance; lật X cho bờ Đông
        #endif
        transformedNormal = normalMatrix * transformedNormal;`)
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        { vec3 isc = vec3(1.0);
        #ifdef USE_INSTANCING
          isc = max(vec3(length(instanceMatrix[0].xyz), length(instanceMatrix[1].xyz), length(instanceMatrix[2].xyz)), vec3(1e-4));
        #endif
          transformed += bkOff / isc;
          if (bkRule > isc.y - ${f4(3)}) transformed = vec3(0.0);   // chi tiết theo tầng cao hơn nhà: thu về một điểm
          vGlow = bkGlow; }`);
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform float uNight; varying float vGlow;')
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
        #ifdef USE_COLOR_ALPHA
          totalEmissiveRadiance += vColor.rgb * vGlow * uNight * ${f4(B.glowGain)};
        #endif`);
  };
  return mat;
}

export interface BkState { meshes: THREE.InstancedMesh[]; counts: Record<number, number>; decorated: Building[]; zone: typeof CONFIG.buildings.zone }
let state: BkState | null = null;
export const bkState = () => state;

/* Dựng kit cho vùng mẫu; kit chưa nạp được (null) thì không làm gì (nhà giữ nguyên như trước). opts.flip(b): lật X cho nhà b (mặc định: bờ Đông x > 0) */
export function buildBuildingKit(opts: { kit?: BkKit | null; flip?: (b: Building) => boolean } = {}): BkState | null {
  const kit = opts.kit === undefined ? bkGet() : opts.kit;
  if (!kit) return null;
  const B = CONFIG.buildings, Z = B.zone, flipOf = opts.flip ?? ((b: Building) => b.x > 0);
  const groups = new Map<string, { fam: number; flip: boolean; list: Building[] }>();
  const counts: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 }, decorated: Building[] = [];
  const touched = new Set<THREE.BufferAttribute>();
  for (const b of collectBuildings()) {
    if (b.x < Z.x0 || b.x > Z.x1 || b.z < Z.z0 || b.z > Z.z1) continue;
    const fam = bkFamily(b.h, b.x, b.z, B.bands);
    if (!fam || !kit.has(fam)) continue;
    const flip = flipOf(b), key = `${fam}${flip ? 'f' : ''}`;
    if (!groups.has(key)) groups.set(key, { fam, flip, list: [] });
    groups.get(key)!.list.push(b); counts[fam]++; decorated.push(b);
    const af = b.mesh.geometry.getAttribute('aFam') as THREE.BufferAttribute | undefined;   // thân: mặt đứng theo họ
    if (af) { af.setX(b.i, fam); touched.add(af); }
  }
  for (const a of touched) a.needsUpdate = true;
  const mats = new Map<boolean, THREE.MeshStandardMaterial>();
  const meshes: THREE.InstancedMesh[] = [];
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), p = new THREE.Vector3(), s = new THREE.Vector3(), c = new THREE.Color();
  for (const { fam, flip, list } of groups.values()) {
    const src = kit.get(fam)!, g = new THREE.BufferGeometry();
    for (const [k, a] of Object.entries(src.attributes)) g.setAttribute(k, a);
    if (src.index) g.setIndex(src.index);
    const wall = new Float32Array(list.length * 3);
    if (!mats.has(flip)) {
      const mat = bkMaterial(flip), body = list[0].mesh.material as THREE.Material;   // cùng kiểu cắt với thân nhà (mặt cắt Hầm, cutaway.ts)
      mat.clippingPlanes = body.clippingPlanes; mat.clipIntersection = body.clipIntersection;
      mats.set(flip, mat);
    }
    const mesh = new THREE.InstancedMesh(g, mats.get(flip)!, list.length);
    list.forEach((b, i) => {
      mesh.setMatrixAt(i, m.compose(p.set(b.x, CONFIG.landY, b.z), q, s.set(flip ? -b.w : b.w, b.h, b.d)));
      if (b.mesh.instanceColor) b.mesh.getColorAt(b.i, c); else c.setRGB(1, 1, 1);
      wall[i * 3] = c.r; wall[i * 3 + 1] = c.g; wall[i * 3 + 2] = c.b;
    });
    g.setAttribute('aWall', new THREE.InstancedBufferAttribute(wall, 3));
    // khung bao: neo trong hộp đơn vị × ma trận instance = hộp nhà; cộng độ lệch bkOff lớn nhất (ban công, mái…)
    g.computeBoundingSphere(); mesh.computeBoundingSphere(); mesh.computeBoundingBox();
    const off = g.getAttribute('bkOff'); let r = 0;
    for (let k = 0; k < off.count; k++) r = Math.max(r, Math.hypot(off.getX(k), off.getY(k), off.getZ(k)));
    mesh.boundingSphere!.radius += r; mesh.boundingBox!.expandByScalar(r);
    mesh.name = `bk-fam${fam}${flip ? '-flip' : ''}`;
    mesh.layers.set(1); mesh.castShadow = false; mesh.receiveShadow = true;
    scene.add(mesh); meshes.push(mesh);
  }
  state = { meshes, counts, decorated, zone: Z };
  return state;
}

/* Gỡ kit khỏi cảnh, trả thân nhà về mặt đứng cũ (aFam = 0) */
export function disposeBuildingKit() {
  if (!state) return;
  const mats = new Set<THREE.Material>();
  for (const mesh of state.meshes) { scene.remove(mesh); mesh.geometry.dispose(); mats.add(mesh.material as THREE.Material); mesh.dispose(); }
  for (const mat of mats) mat.dispose();
  const touched = new Set<THREE.BufferAttribute>();
  for (const b of state.decorated) { const af = b.mesh.geometry.getAttribute('aFam') as THREE.BufferAttribute | undefined; if (af) { af.setX(b.i, 0); touched.add(af); } }
  for (const a of touched) a.needsUpdate = true;
  state = null;
}

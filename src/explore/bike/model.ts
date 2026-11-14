/* ============================ Lái xe máy: hình xe (phần hình tạm) ============================
   BkBike: một nhóm đặt ở điểm giữa hai vệt bánh trên mặt đường (tâm thân xe, y = mặt đường), xoay yaw quanh Y rồi pitch quanh Z cục bộ (như DrCar);
   bên trong một nút cuộn `lean` quanh trục dọc X cục bộ đi qua mặt đường (đường chạm đất): lean > 0 nghiêng trái (−Z cục bộ khi mũi +X), nên
   cuộn là −lean quanh +X. Tấm bóng mờ ở nhóm ngoài (không cuộn theo xe).
   - Hình tạm: hình 'bike' của common/vehicles/shapes.ts (xe tay ga + người lái đội mũ, mũi +X, mặt đường y = 0) chép ra, tô màu các phần
     màu theo instance (sơn, áo, mũ) bằng CONFIG.bike.model.temp, giãn theo X cho đúng chiều dài thân va chạm (CONFIG.bike.body.length). Một Mesh.
   - Lớp 1 (không vào phản chiếu mặt nước), không đổ / nhận bóng; vật liệu cùng tham số với hình tạm / tấm bóng của ô tô (drive/car.ts) nên
     dùng chung program đã có, không biên dịch thêm.
   - Mô hình thật (public/bike/scooter.glb, bánh, cổ lái, giảm xóc, đèn): Task 3. place() đã nhận đủ trường cho phần đó.
   Không cấp phát mỗi khung (D-018). */
import * as THREE from 'three';
import { CONFIG } from '../../config';
import { vhBuildTypeGeometry, Role } from '../../common/vehicles/shapes';

export interface BkPlace { x: number; y: number; z: number; yaw: number; pitch: number; lean: number; steer: number; wheel: number; susF: number; susR: number; braking: boolean; sig: -1 | 0 | 1 }

const B = CONFIG.bike.body, M = CONFIG.bike.model;
const AXY = new THREE.Vector3(0, 1, 0), AXZ = new THREE.Vector3(0, 0, 1);
const _q = new THREE.Quaternion();

/* ===== Vật liệu, hình học dùng chung ===== */
let tempMat: THREE.MeshStandardMaterial | null = null, shadowMat: THREE.MeshBasicMaterial | null = null, shadowGeo: THREE.PlaneGeometry | null = null;

/* Hình tạm: chép hình 'bike' của đội xe, bỏ aRole, tô màu phần màu theo instance, giãn X về chiều dài thân */
function bkTempGeometry(): THREE.BufferGeometry {
  const g = vhBuildTypeGeometry('bike').clone();
  const role = g.getAttribute('aRole') as THREE.BufferAttribute, col = g.getAttribute('color') as THREE.BufferAttribute;
  const T = M.temp, paint = new THREE.Color(T.paint), shirt = new THREE.Color(T.shirt), helmet = new THREE.Color(T.helmet);
  for (let i = 0; i < role.count; i++) {
    const r = role.getX(i), c = r === Role.Paint ? paint : r === Role.Accent ? shirt : r === Role.Helmet ? helmet : null;
    if (c) col.setXYZ(i, c.r, c.g, c.b);
  }
  g.deleteAttribute('aRole');
  g.computeBoundingBox();
  const bb = g.boundingBox!, len = bb.max.x - bb.min.x;
  g.scale(B.length / len, 1, 1);                                     // mặt cắt giữ nguyên, chỉ dài theo thân va chạm
  g.computeBoundingBox(); g.computeBoundingSphere();
  return g;
}

/* Tấm bóng mờ: như drShadowShared của ô tô (mép mềm hình vuông bo), cùng tham số vật liệu ⇒ cùng program */
function bkShadowShared(): void {
  if (shadowMat) return;
  const n = 32, d = new Uint8Array(n * n * 4);
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
    const u = (x + 0.5) / n * 2 - 1, v = (y + 0.5) / n * 2 - 1;
    const e = Math.max(Math.abs(u), Math.abs(v)), a = e >= 1 ? 0 : 1 - e * e * e * e;
    d[(y * n + x) * 4 + 3] = Math.round(255 * a);
  }
  const tex = new THREE.DataTexture(d, n, n, THREE.RGBAFormat); tex.needsUpdate = true;
  tex.magFilter = tex.minFilter = THREE.LinearFilter;
  shadowMat = new THREE.MeshBasicMaterial({ color: 0x000000, map: tex, transparent: true, opacity: M.shadow.opacity, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2, fog: false });
  shadowMat.name = 'bikeShadow';
  shadowGeo = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2);
}
function bkTempMaterial(): THREE.MeshStandardMaterial {
  if (!tempMat) { tempMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.6, metalness: 0.1 }); tempMat.name = 'bikeTemp'; }
  return tempMat;
}

/* ===== Một xe máy ===== */
export class BkBike {
  readonly group = new THREE.Group();
  private readonly roll = new THREE.Group();                         // nút cuộn lean quanh đường chạm đất
  private temp: THREE.Mesh | null;
  private tempGeo: THREE.BufferGeometry | null;
  private disposed = false;

  constructor() {
    this.group.name = 'bike';
    this.group.add(this.roll);
    this.tempGeo = bkTempGeometry();
    this.temp = new THREE.Mesh(this.tempGeo, bkTempMaterial());
    this.temp.name = 'bike-temp';
    this.temp.layers.set(1); this.temp.castShadow = false; this.temp.receiveShadow = false;
    this.roll.add(this.temp);
    bkShadowShared();
    const sh = new THREE.Mesh(shadowGeo!, shadowMat!);
    sh.scale.set(B.length + 2 * M.shadow.pad, 1, B.width + 2 * M.shadow.pad);
    sh.position.y = M.shadow.lift;
    sh.layers.set(1); sh.castShadow = false; sh.receiveShadow = false; sh.renderOrder = 1;
    this.group.add(sh);
  }

  /* Có mô hình thật chưa (Task 3); hình tạm thì false */
  get real(): boolean { return false; }

  place(p: BkPlace): void {
    const g = this.group;
    g.position.set(p.x, p.y, p.z);
    g.quaternion.setFromAxisAngle(AXY, p.yaw).multiply(_q.setFromAxisAngle(AXZ, p.pitch));
    this.roll.rotation.x = -p.lean;                                  // lean > 0 nghiêng trái (−Z cục bộ)
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.group.removeFromParent();
    if (this.temp) { this.roll.remove(this.temp); this.temp = null; }
    this.tempGeo?.dispose(); this.tempGeo = null;
  }
}

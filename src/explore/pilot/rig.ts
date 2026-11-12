/* ===== Người treo dù: một bộ nhân vật + trang bị gắn dưới một cánh (src/explore/pilot/rig.ts) =====
   Cây nút (hệ group dù: +X bay, +Y lên, +Z phải):
     ex-pilot (Group, lớp 1)
     ├─ wing  (Object3D tĩnh tại gốc group dù: đầu trên của dây treo / dây phanh)
     ├─ swing (Group tại điểm tụ dây = đỉnh riser, (0, exHangY + riser, 0); lắc con lắc swingRoll / Pitch / Yaw; cũng là xương `hang` của trang bị)
     │  └─ bản sao nhân vật (gốc tại hông: (−hang.fore, −riser − hang.up, 0) so với swing), AnimationMixer phát `sit`
     └─ gear (SkinnedMesh trang bị, hình học dùng chung mọi dù, Skeleton riêng)
   Người treo quay quanh điểm tụ dây (cả riser, carabiner, người đi cùng nhau), dây treo trên đó đứng yên trong hệ dù.
   Quai phanh treo theo riser nên tính trong hệ lắc: điểm nắm = hông + (toggle.fore + hang.fore, toggle.up + hang.up − phanh·travel, ±toggle.half).
   Trang bị: Skeleton [wing, hang, Pelvis, Spine2, L Hand, R Hand, L Thigh, R Thigh, pack]; boneInverses = nghịch đảo ma trận từng xương trong hệ ex-pilot
   đo ở tư thế bay nền (pose 0, phanh nền, sau mixer.update(0)), bindMatrix đơn vị ⇒ dù ở đâu trong thế giới cũng đúng. Không cấp phát mỗi khung. */
import * as THREE from 'three';
import { CONFIG } from '../../config';
import { exHangY } from '../glider';
import { PlReact, type PlSignals } from './react';
import { PlBones } from './bones';
import { plGearGeometry, plGearMaterial, type PlGearRest } from './gear';
import type { PlSource } from './load';

const _tL = new THREE.Vector3(), _tR = new THREE.Vector3();

/* Hình học trang bị dùng chung theo nguồn (vị trí nghỉ giống nhau mọi dù: cùng mô hình, cùng tư thế nền) */
const gearGeo = new WeakMap<PlSource, THREE.BufferGeometry>();

export class PlRig {
  readonly group = new THREE.Group();
  readonly wing = new THREE.Object3D();
  readonly swing = new THREE.Group();
  readonly root: THREE.Object3D;
  readonly mixer: THREE.AnimationMixer;
  readonly react: PlReact;
  readonly bones: PlBones;
  readonly gear: THREE.SkinnedMesh;
  readonly pack = new THREE.Object3D();
  readonly rest: PlGearRest;

  constructor(src: PlSource, seed: number) {
    const P = CONFIG.explore.pilot;
    this.group.name = 'ex-pilot';
    this.wing.name = 'pl-wing'; this.swing.name = 'pl-swing'; this.pack.name = 'pl-pack';
    this.group.add(this.wing, this.swing);
    this.swing.position.set(0, exHangY + P.riser, 0);
    this.root = src.clone(src.scene);
    this.root.name = 'pl-body';
    this.root.position.set(-P.hang.fore, -P.riser - P.hang.up, 0);
    this.swing.add(this.root);
    this.mixer = new THREE.AnimationMixer(this.root);
    this.mixer.clipAction(src.clip).play();
    this.react = new PlReact(seed);
    this.bones = new PlBones(this.root);
    this.bones.spines[2].add(this.pack);
    this.bones.pack = this.pack;
    /* tư thế bay nền: số đo ở `sit`, rồi áp pose 0 (phanh nền) */
    this.mixer.update(0);
    this.bones.capture();
    this.bones.measure();
    this.pose(0);
    /* đo vị trí nghỉ + nghịch đảo xương trong hệ ex-pilot */
    this.group.updateMatrixWorld(true);
    const inv = this.group.matrixWorld.clone().invert();
    const b = this.bones, bl = [this.wing, this.swing, b.pelvis, b.spines[2], b.arms[0].hand, b.arms[1].hand, b.thigh[0], b.thigh[1], this.pack];
    const rel = bl.map((o) => inv.clone().multiply(o.matrixWorld));
    const pos = (m: THREE.Matrix4) => { const v = new THREE.Vector3().setFromMatrixPosition(m); return [v.x, v.y, v.z]; };
    const toG = (v: THREE.Vector3) => { const w = v.clone().applyMatrix4(this.root.matrixWorld).applyMatrix4(inv); return [w.x, w.y, w.z]; };
    const dirG = (v: THREE.Vector3) => { const w = v.clone().transformDirection(this.root.matrixWorld).transformDirection(inv); return [w.x, w.y, w.z]; };
    const grip = (i: number) => toG(b.arms[i].target);
    const bar = (i: number) => { const a = b.arms[i]; return dirG(a.fH.clone().applyQuaternion(a.D).cross(a.nH.clone().applyQuaternion(a.D)).normalize()); };
    const up = (i: number) => { const a = b.arms[i]; return dirG(a.fH.clone().applyQuaternion(a.D)); };
    b.updateMatrices();
    this.rest = {
      hang: [0, exHangY, 0], pelvis: pos(rel[2]), spine: pos(rel[3]), handL: pos(rel[4]), handR: pos(rel[5]), thighL: pos(rel[6]), thighR: pos(rel[7]),
      kneeL: toG(b.pC(b.calf[0], new THREE.Vector3())), kneeR: toG(b.pC(b.calf[1], new THREE.Vector3())),
      gripL: grip(0), gripR: grip(1), barL: bar(0), barR: bar(1), fingL: up(0), fingR: up(1)
    };
    let geo = gearGeo.get(src);
    if (!geo) gearGeo.set(src, geo = plGearGeometry(this.rest));
    const sk = new THREE.Skeleton(bl as THREE.Bone[], rel.map((m) => m.invert()));
    this.gear = new THREE.SkinnedMesh(geo, plGearMaterial());
    this.gear.name = 'pl-gear';
    this.gear.bind(sk, new THREE.Matrix4());
    this.gear.frustumCulled = false; this.gear.castShadow = false; this.gear.receiveShadow = false;
    this.group.add(this.gear);
    this.group.traverse((o) => o.layers.set(1));
  }

  /* Áp pose hiện tại của react lên lắc + xương (sau mixer) */
  private pose(dt: number): void {
    const P = CONFIG.explore.pilot, p = this.react.pose, T = P.toggle, H = P.hang;
    this.bones.restore();
    this.mixer.update(dt);
    this.bones.capture();
    this.swing.rotation.set(p.swingRoll, p.swingYaw, p.swingPitch, 'YZX');
    const x = T.fore + H.fore, y0 = T.up + H.up;
    _tL.set(x, y0 - p.brakeL * T.travel, -T.half);
    _tR.set(x, y0 - p.brakeR * T.travel, T.half);
    this.bones.apply(p, _tL, _tR);
  }

  /* Mỗi khung: tín hiệu → lò xo → xương. dt không hợp lệ / ≤ 0 → không tiến thời gian (vẫn áp tư thế) */
  update(sig: PlSignals, dt: number): void {
    const d = dt > 0 && Number.isFinite(dt) ? Math.min(dt, CONFIG.explore.pilot.dtMax) : 0;
    this.react.step(sig, d);
    this.pose(d);
  }

  /* Nhảy vị trí / đổi chủ: lò xo về nghỉ */
  reset(): void { this.react.reset(); }

  /* m — sai số điểm nắm ↔ quai phanh hai tay */
  handErr(): [number, number] { return [this.bones.handErr(0), this.bones.handErr(1)]; }

  /* Tâm thân trong hệ thế giới (cho test chụp ảnh / camera) */
  chest(out: THREE.Vector3): THREE.Vector3 {
    this.group.updateMatrixWorld(true);
    return out.setFromMatrixPosition(this.bones.spines[2].matrixWorld);
  }

  /* Gỡ khỏi dù, bỏ mixer, giải phóng skeleton riêng (bản sao nhân vật + trang bị). Hình học / texture / vật liệu của nguồn và hình học trang bị dùng chung giữ lại */
  dispose(): void {
    this.mixer.stopAllAction();
    this.mixer.uncacheRoot(this.root);
    this.group.removeFromParent();
    const seen = new Set<THREE.Skeleton>();
    this.group.traverse((o) => {
      const sk = (o as THREE.SkinnedMesh).isSkinnedMesh ? (o as THREE.SkinnedMesh).skeleton : null;
      if (sk && !seen.has(sk)) { seen.add(sk); sk.dispose(); }
    });
  }
}

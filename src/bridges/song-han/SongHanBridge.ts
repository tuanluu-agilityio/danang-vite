import * as THREE from 'three';
import { scene } from '../../core/renderer';
import { shared } from '../../core/shared';
import { MAT } from '../../core/materials';
import { BridgeBase } from '../../common/BridgeBase';
import { stepBoats, type Boats } from '../../common/boats';
import { stepPeople, type People } from '../../common/people';
import type { Traffic } from '../../common/traffic';
import { SH } from './profile';
import { shMaterials, type ShMaterials } from './materials';
import { shBuildFixedSpans } from './fixedSpans';
import { shBuildTurntable, shPlaceRollers } from './turntable';
import { shBuildSwingSpan } from './swingSpan';
import { SwingController, type SwingState } from './SwingController';
import { shBuildSignals, shUpdateSignals } from './signals';
import { shBuildLife, shStepTraffic } from './life';

/* ======================================================================
   CẦU SÔNG HÀN — cầu quay dây văng (khánh thành 29/3/2000), cầu quay duy nhất ở Việt Nam
   Giữa Cầu Rồng (Nam) và Cầu Thuận Phước (Bắc): z = −1.080, trục Tây – Đông
   (bờ Tây nối Lê Duẩn × Bạch Đằng, bờ Đông nối Phạm Văn Đồng).
   ====================================================================== */
export class SongHanBridge extends BridgeBase<ShMaterials> {
  declare traffic: Traffic;
  declare boats: Boats;
  declare people: People;
  declare ship: { obj: THREE.Group; z: number; target: number; dir: number; speed: number };
  declare rollers: THREE.InstancedMesh;
  declare rollerSpin: number;
  declare swing: THREE.Group;
  declare swingDetails: THREE.Group;
  declare pins: THREE.InstancedMesh;
  declare nav: THREE.InstancedMesh;
  declare pierNav: THREE.InstancedMesh;
  declare arms: THREE.InstancedMesh;
  declare signalLamps: THREE.InstancedMesh;
  declare barrierSpec: { x: number; z: number; sz: number }[];
  peopleOn = true;
  ctrl: SwingController;

  constructor() {
    super('SongHanBridge', 'sh', SH.z, new THREE.Vector3(0, 15, SH.z), SH.lodDistance);
    this.mats = shMaterials();
    this.farDistance = SH.farDistance;
    shBuildFixedSpans(this);
    shBuildTurntable(this);
    shBuildSwingSpan(this);
    shBuildSignals(this);
    shBuildLife(this);
    this.finalize();
    // lề bộ hành, người đi bộ… (lớp không phản chiếu) cũng ẩn khi camera ở rất xa
    for (const o of this.noReflect) if (!this.farHide.includes(o)) this.farHide.push(o);
    this.ctrl = new SwingController(SH);
    // nhịp quay chỉ mở khóa khi không còn xe trên đó; chỉ đóng khi tàu cao đã qua hết luồng
    this.ctrl.spanClear = () => !this.traffic.list.some((v) => Math.abs(v.s) < SH.barrierX);
    this.ctrl.canClose = () => Math.abs(this.ship.z - this.ship.target) < 0.5;
    this.ctrl.addEventListener('stateChange', (e) => {
      const s = (e as CustomEvent<SwingState>).detail;
      if (s === 'UNLOCK') for (const v of this.traffic.list) if (Math.abs(v.s) < SH.barrierX) v.s = v.dir > 0 ? SH.barrierX + 6 : -SH.barrierX - 6;
      if (s === 'OPEN') { this.ship.target = -this.ship.target; }       // tàu cao chạy qua luồng sang phía bên kia
    });
    this.hideBankTrees();
  }
  /* Ẩn vài cây ven kè nằm dưới đường dẫn hai đầu cầu (không đổi chuỗi ngẫu nhiên của khu cây) */
  hideBankTrees() {
    const mats = new Set<THREE.Material>([MAT.trunk, MAT.leaf, MAT.palm]), m = new THREE.Matrix4(), p = new THREE.Vector3(), zero = new THREE.Matrix4().makeScale(0, 0, 0);
    scene.traverse((obj) => {
      const o = obj as THREE.InstancedMesh;
      if (!o.isInstancedMesh || !mats.has(o.material as THREE.Material)) return;
      for (let i = 0; i < o.count; i++) {
        o.getMatrixAt(i, m); p.setFromMatrixPosition(m);
        if (Math.abs(p.z - SH.z) < SH.hw + 4 && Math.abs(p.x) > 250 && Math.abs(p.x) < 300) o.setMatrixAt(i, zero);
      }
      o.instanceMatrix.needsUpdate = true;
    });
  }
  setPeopleVisible(on: boolean) { this.peopleOn = on; }
  update(dt: number, elapsed: number, cam: THREE.Camera) {
    const near = this.updateLod(cam);
    const ctrl = this.ctrl;
    ctrl.update(dt);
    // xoay nhịp quay quanh tâm trụ (+ nâng nhẹ khi mở khóa); con lăn quay theo
    const prev = this.swing.rotation.y;
    this.swing.rotation.y = ctrl.angle; this.swing.position.y = ctrl.lift;
    if (prev !== ctrl.angle) { this.rollerSpin += (ctrl.angle - prev) * SH.railR / 0.33; if (this.details.visible) shPlaceRollers(this, this.rollerSpin); }
    this.swingDetails.visible = this.details.visible;
    if (this.details.visible) shUpdateSignals(this, ctrl, elapsed);   // barie, đèn tín hiệu, đèn hàng hải, chốt: đều trong details / swingDetails
    const n = shared.uNight.value;
    this.mats.crown.emissiveIntensity = n * 2.2; this.mats.drumLight.emissiveIntensity = n * 2.0; this.mats.porthole.emissiveIntensity = n * 0.8;
    this.people.group.visible = this.peopleOn && this.details.visible;
    if (this.people.group.visible) stepPeople(this.people, dt, elapsed);
    // tàu cao di chuyển theo hệ số tăng tốc của kịch bản quay
    const S = this.ship;
    if (S.z !== S.target) {
      const step = S.speed * dt * ctrl.speed * Math.sign(S.target - S.z);
      S.z = Math.abs(S.target - S.z) <= Math.abs(step) ? S.target : S.z + step;
      S.obj.position.z = S.z; S.obj.rotation.y = S.target > 0 ? 0 : Math.PI;
    }
    if (!near) return;
    shStepTraffic(this.traffic, dt, ctrl);
    stepBoats(this.boats, dt, elapsed, -1850, 1150);
  }
}

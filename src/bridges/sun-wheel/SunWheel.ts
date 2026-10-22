import * as THREE from 'three';
import { BridgeBase } from '../../common/BridgeBase';
import { clearRects } from '../../environment/riverfront/clearance';
import { SW } from './profile';
import { swMaterials, type SwMaterials } from './materials';

/* ======================================================================
   VÒNG QUAY MẶT TRỜI (Sun Wheel) — Asia Park, bờ Tây, phía Nam Cầu Trần Thị Lý, z ≈ +2 280
   Kế thừa BridgeBase dù không phải cầu: dùng sẵn LOD, life, panel, danh sách công trình (D-014).
   Gốc cục bộ: tâm bệ trên mặt đất; group xoay SW.yaw để mặt phẳng vòng quay theo phương vị 83°.
   Giai đoạn 1: khung rỗng + dọn nền. Hình học từ giai đoạn 2.
   ====================================================================== */
export class SunWheel extends BridgeBase<SwMaterials> {
  readonly cfg = SW;     // cho test (window.__app.sunWheel.cfg)
  constructor() {
    super('SunWheel', 'sw', SW.z, new THREE.Vector3(SW.x, SW.hubY, SW.z), SW.lodDistance);
    this.group.position.x = SW.x;
    this.group.rotation.y = SW.yaw;
    this.mats = swMaterials();
    /* Dựng SAU mọi lệnh dùng rand(): chỉ dọn nhà, cây trùng nền bằng scale 0 (cả near lẫn far của LOD), không đụng chuỗi ngẫu nhiên */
    const cleared = clearRects([SW.site], SW.clearMargin);
    this.stats.clearedBuildings = cleared.buildings; this.stats.clearedPlants = cleared.plants;
    this.finalize();
  }
  update(_dt: number, _elapsed: number, cam: THREE.Camera) {
    this.updateLod(cam);
  }
}

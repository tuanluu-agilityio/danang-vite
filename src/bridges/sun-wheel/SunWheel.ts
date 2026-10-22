import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { BridgeBase } from '../../common/BridgeBase';
import { clearRects } from '../../environment/riverfront/clearance';
import { shared } from '../../core/shared';
import { SW } from './profile';
import { swMaterials, type SwMaterials } from './materials';
import { swBuildBase, swBuildLegs, swSignGeometry } from './structure';
import { swBuildWheel } from './wheel';
import { swBuildCabins } from './cabins';

/* ======================================================================
   VÒNG QUAY MẶT TRỜI (Sun Wheel) — Asia Park, bờ Tây, phía Nam Cầu Trần Thị Lý, z ≈ +2 280
   Kế thừa BridgeBase dù không phải cầu: dùng sẵn LOD, life, panel, danh sách công trình (D-014).
   Gốc cục bộ: tâm bệ trên mặt đất; group xoay SW.yaw để mặt phẳng vòng quay theo phương vị 83°.
   Draw call: phần tĩnh gộp 1 mesh + phần quay 1 mesh luôn hiện (điểm mốc); cabin + biển hiệu trong details (ẩn khi xa hơn lodDistance).
   Không đổ bóng (tránh thêm lượt vẽ bóng ở góc nhìn cũ), không phản chiếu (lớp 1).
   Giai đoạn 2: hình học tĩnh, vành/nan, 64 cabin đứng yên ở góc 0. Quay từ giai đoạn 3.
   ====================================================================== */
export class SunWheel extends BridgeBase<SwMaterials> {
  readonly cfg = SW;     // cho test (window.__app.sunWheel.cfg)
  wheel = new THREE.Group();     // gốc tại tâm trục; giai đoạn 3 quay quanh Z cục bộ
  cabins: THREE.InstancedMesh;
  sign: THREE.Mesh;
  constructor() {
    super('SunWheel', 'sw', SW.z, new THREE.Vector3(SW.x, SW.hubY, SW.z), SW.lodDistance);
    this.group.position.x = SW.x;
    this.group.rotation.y = SW.yaw;
    this.mats = swMaterials();
    /* Dựng SAU mọi lệnh dùng rand(): chỉ dọn nhà, cây trùng nền bằng scale 0 (cả near lẫn far của LOD), không đụng chuỗi ngẫu nhiên */
    const cleared = clearRects([SW.site], SW.clearMargin);
    this.stats.clearedBuildings = cleared.buildings; this.stats.clearedPlants = cleared.plants;

    // phần tĩnh: bệ, nhà ga, quảng trường, giàn tháp, trục — một mesh tô màu theo đỉnh
    const parts: THREE.BufferGeometry[] = [];
    swBuildBase(parts); swBuildLegs(parts);
    const stat = new THREE.Mesh(mergeGeometries(parts), this.mats.concrete);
    parts.forEach((p) => p.dispose());
    stat.name = 'sw-static'; stat.receiveShadow = true;
    // phần quay: vành + nan + moay-ơ
    const wheel = new THREE.Mesh(swBuildWheel(), this.mats.steel);
    wheel.name = 'sw-wheel-mesh';
    this.wheel.name = 'sw-wheel'; this.wheel.position.y = SW.hubY; this.wheel.add(wheel);
    // chi tiết gần: 64 cabin, biển hiệu
    this.cabins = swBuildCabins(this.mats.cabin);
    this.sign = new THREE.Mesh(swSignGeometry(), this.mats.sign); this.sign.name = 'sw-sign';
    this.details.add(this.cabins, this.sign);
    this.group.add(stat, this.wheel);
    this.noReflect.push(stat, this.wheel);
    this.stats.staticTris = stat.geometry.index ? stat.geometry.index.count / 3 : stat.geometry.attributes.position.count / 3;
    this.stats.wheelTris = wheel.geometry.index ? wheel.geometry.index.count / 3 : wheel.geometry.attributes.position.count / 3;
    this.finalize();
  }
  update(_dt: number, _elapsed: number, cam: THREE.Camera) {
    this.updateLod(cam);
    if (this.details.visible) this.mats.sign.color.setScalar(0.85 + 1.6 * shared.uNight.value);   // chữ sáng hơn khi tối (không phải đèn)
  }
}

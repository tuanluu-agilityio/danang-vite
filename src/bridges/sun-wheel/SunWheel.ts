import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { BridgeBase } from '../../common/BridgeBase';
import { clearRects } from '../../environment/riverfront/clearance';
import { shared } from '../../core/shared';
import { SW } from './profile';
import { swMaterials, type SwMaterials } from './materials';
import { swBuildBase, swBuildLegs, swSignGeometry, swLit, SW_LIT } from './structure';
import { swBuildWheel } from './wheel';
import { swBuildCabins, swPlaceCabins } from './cabins';
import { swLedU, swShowIndex } from './ledShow';
import { swRide } from './ride';

/* ======================================================================
   VÒNG QUAY MẶT TRỜI (Sun Wheel) — Asia Park, bờ Tây, phía Nam Cầu Trần Thị Lý, z ≈ +2 280
   Kế thừa BridgeBase dù không phải cầu: dùng sẵn LOD, life, panel, danh sách công trình (D-014).
   Gốc cục bộ: tâm bệ trên mặt đất; group xoay SW.yaw để mặt phẳng vòng quay theo phương vị 83°.
   Draw call: phần tĩnh gộp 1 mesh + phần quay 1 mesh luôn hiện (điểm mốc); cabin + biển hiệu trong details (ẩn khi xa hơn lodDistance).
   Không đổ bóng (tránh thêm lượt vẽ bóng ở góc nhìn cũ), không phản chiếu (lớp 1).
   Giai đoạn 2: hình học tĩnh, vành/nan, 64 cabin. Giai đoạn 3: quay (wheel.rotation.z = θ), cabin chỉ tịnh tiến theo θ nên luôn đứng thẳng, tốc độ đổi mượt.
   Giai đoạn 4: LED đêm 5 kiểu show trong shader của chính các vật liệu (ledShow.ts), nhịp tim đồng bộ LED trái tim riverfront.
   Giai đoạn 5: ngồi cabin (ride.ts) — camera gắn cabin, tư thế đặt trong update() sau advance().
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
    parts.forEach((p) => p.attributes.aLit || swLit(p, SW_LIT.none));   // mergeGeometries cần cùng bộ thuộc tính
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
    swRide.attach(this);
  }

  /* ---- chuyển động (GĐ3) ---- */
  private theta = 0;          // rad, [0, 2π) — góc vòng quay; 0 = cabin 0 ở giờ 3
  private speed = 1;          // hệ số tốc độ hiện tại (đang tiến dần tới speedGoal)
  private speedGoal = 1;      // hệ số tốc độ người dùng chọn
  private placed = NaN;       // góc đã dựng ma trận cabin (NaN = chưa)
  private tmpM = new THREE.Matrix4();

  /* Đặt góc (rad) ngay, cho test và Tour; luôn dựng lại cabin */
  setAngle(rad: number) { this.theta = ((rad % TAU) + TAU) % TAU; this.apply(true); }
  angle() { return this.theta; }
  /* Đặt hệ số tốc độ đích; tốc độ thực đổi mượt theo SW.speedAccel */
  setSpeed(k: number) { this.speedGoal = Math.max(0, k); }
  speedNow() { return this.speed; }
  speedTarget() { return this.speedGoal; }
  /* Tích phân deterministic `sec` giây (test gọi trực tiếp; update() cũng đi qua đây) */
  advance(sec: number) {
    let left = sec;
    while (left > 1e-9) {
      const h = Math.min(left, SW.stepMax); left -= h;
      const step = SW.speedAccel * h;
      this.speed = this.speed < this.speedGoal ? Math.min(this.speedGoal, this.speed + step) : Math.max(this.speedGoal, this.speed - step);
      this.theta = (this.theta + SW.omega * this.speed * h) % TAU;
    }
    this.apply(false);
  }
  /* Vành quay (rẻ: chỉ một góc); cabin dựng lại khi nhìn thấy và góc đổi; cabin luôn chỉ tịnh tiến nên đứng thẳng */
  private apply(force: boolean) {
    this.wheel.rotation.z = this.theta;
    if (force || (this.details.visible && !(Math.abs(this.theta - this.placed) < SW.placeEps))) { swPlaceCabins(this.cabins, this.theta); this.placed = this.theta; }
  }
  /* Vị trí thế giới của tâm cabin i (đọc từ ma trận instance) */
  cabinWorld(i: number, out = new THREE.Vector3()) {
    this.apply(true); this.cabins.updateWorldMatrix(true, false);
    this.cabins.getMatrixAt(i, this.tmpM); this.tmpM.premultiply(this.cabins.matrixWorld);
    return out.setFromMatrixPosition(this.tmpM);
  }
  /* Trục "lên" của cabin i trong thế giới */
  cabinUp(i: number, out = new THREE.Vector3()) {
    this.apply(true); this.cabins.updateWorldMatrix(true, false);
    this.cabins.getMatrixAt(i, this.tmpM); this.tmpM.premultiply(this.cabins.matrixWorld);
    return out.set(this.tmpM.elements[4], this.tmpM.elements[5], this.tmpM.elements[6]).normalize();
  }

  /* ---- LED ban đêm (GĐ4): một uniform chung cho ba vật liệu, không đổi mesh/draw call ---- */
  /* đặt kiểu show theo tên ('white' | 'pink' | 'rays' | 'heart' | 'off') hoặc chỉ số 0–4; trả chỉ số đang dùng */
  setShow(k: number | string) { const i = swShowIndex(k); if (i >= 0) swLedU.uShow.value = i; return swLedU.uShow.value; }
  show() { return SW.led.shows[swLedU.uShow.value]; }

  update(dt: number, _elapsed: number, cam: THREE.Camera) {
    this.updateLod(cam);
    this.advance(dt);
    swRide.update(dt);   // đang ngồi cabin: camera theo cabin sau khi vòng quay vừa quay (cùng một khung hình)
    if (this.details.visible) this.mats.sign.color.setScalar(0.85 + 1.6 * shared.uNight.value);   // chữ sáng hơn khi tối (không phải đèn)
  }
}
const TAU = Math.PI * 2;

import * as THREE from 'three';
import { BridgeBase, blinkBeacon } from '../../common/BridgeBase';
import { stepTraffic, type Traffic } from '../../common/traffic';
import { stepBoats, type Boats } from '../../common/boats';
import { stepPeople, type People } from '../../common/people';
import { PATHS } from '../../environment/traffic';
import { TTL, ttlRoadY, ttlPattern } from './profile';
import { ttlMaterials, type TtlMaterials } from './materials';
import { ttlBuildPylon } from './pylon';
import { ttlBuildStays } from './stays';
import { ttlBuildDeck } from './deck';
import { ttlBuildApproaches } from './approaches';
import { ttlBuildNvt } from './nvt';
import { ttlBuildLife } from './life';

/* ======================================================================
   CẦU TRẦN THỊ LÝ — cầu dây văng BTCT một tháp nghiêng, hệ dây 3 mặt phẳng ("cánh buồm căng gió")
   Phía Nam (thượng lưu, +Z) Cầu Rồng ~1,3 km, chạy Tây – Đông.
   Gốc tọa độ cục bộ: tim cầu (x = 0 ở tim sông), group dời tới z = 1300.
   ====================================================================== */
export class TranThiLyBridge extends BridgeBase<TtlMaterials> {
  declare traffic: Traffic;
  declare boats: Boats;
  declare people: People;
  declare nvt: THREE.Group;
  peopleOn = true;

  constructor() {
    super('TranThiLyBridge', 'ttl', TTL.z, new THREE.Vector3(-60, 40, TTL.z), TTL.lodDistance);
    this.mats = ttlMaterials();
    this.farDistance = 2600;
    ttlBuildPylon(this);
    ttlBuildStays(this);
    ttlBuildDeck(this);
    ttlBuildApproaches(this);
    ttlBuildNvt(this);
    ttlBuildLife(this);
    this.finalize();
  }
  setPattern(v: number) { ttlPattern.value = v; }
  setNvtVisible(on: boolean) { this.nvt.userData.on = on; this.nvt.visible = on; }
  setPeopleVisible(on: boolean) { this.peopleOn = on; }
  update(dt: number, elapsed: number, cam: THREE.Camera) {
    const near = this.updateLod(cam);
    PATHS.ttl.hidden = !this.lifeOn;               // 2 làn trong thuộc hệ xe chung cũng ẩn theo nút bật/tắt
    blinkBeacon(this.mats.beacon, elapsed, 0.4);
    this.people.group.visible = this.peopleOn && this.details.visible;
    if (this.people.group.visible) stepPeople(this.people, dt, elapsed);
    if (!near) return;
    stepTraffic(this.traffic, dt, ttlRoadY);
    stepBoats(this.boats, dt, elapsed, -1450, 400);
  }
  dispose() { PATHS.ttl.hidden = true; super.dispose(); }
}

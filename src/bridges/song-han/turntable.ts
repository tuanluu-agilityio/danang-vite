import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { prepColored, UP } from '../../common/geometry';
import { SH } from './profile';
import type { SongHanBridge } from './SongHanBridge';

/* [turntablePier] trụ tròn, ray vành, con lăn, chốt tâm, fender, phao tiêu */
export function shBuildTurntable(bridge: SongHanBridge) {
  const M = bridge.mats, R = SH.drumR, conc = [];
  conc.push(new THREE.CylinderGeometry(R + 0.8, R + 1.2, 7, 48).translate(0, -2.5, 0));          // bệ móng
  conc.push(new THREE.CylinderGeometry(R, R - 1.6, 4, 48).translate(0, 3, 0));                   // phần thu nhỏ
  conc.push(new THREE.CylinderGeometry(R, R, 4.4, 48).translate(0, 7.2, 0));                     // trống trên có lỗ tròn
  bridge.concreteParts.push(...conc.map((g) => prepColored(g)));
  // dãy lỗ tròn quanh trống, sáng nhẹ ban đêm
  const n = 28, ph = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.55, 0.55, 0.2, 16).rotateZ(Math.PI / 2), M.porthole, n);
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), v = new THREE.Vector3(), one = new THREE.Vector3(1, 1, 1);
  for (let i = 0; i < n; i++) {
    const a = i / n * Math.PI * 2; q.setFromAxisAngle(UP, -a);
    ph.setMatrixAt(i, m.compose(v.set(Math.cos(a) * (R + 0.02), 7.6, Math.sin(a) * (R + 0.02)), q, one));
  }
  bridge.details.add(ph);
  // vòng đèn tím quanh trống
  const bands = mergeGeometries([new THREE.CylinderGeometry(R + 0.06, R + 0.06, 0.25, 48, 1, true).translate(0, 5.1, 0),
    new THREE.CylinderGeometry(R + 0.06, R + 0.06, 0.25, 48, 1, true).translate(0, 9.25, 0)]);
  bridge.group.add(new THREE.Mesh(bands, M.drumLight));
  // mâm xoay phần cố định: vành ray tròn, chốt tâm (king pin), con lăn
  const mech = [new THREE.TorusGeometry(SH.railR, 0.28, 8, 72).rotateX(Math.PI / 2).translate(0, SH.drumTop + 0.25, 0),
    new THREE.CylinderGeometry(1.3, 1.5, 1.4, 24).translate(0, SH.drumTop + 0.7, 0),
    new THREE.CylinderGeometry(R - 0.2, R - 0.2, 0.2, 48).translate(0, SH.drumTop + 0.02, 0)];
  const mm = new THREE.Mesh(mergeGeometries(mech.map((g: THREE.BufferGeometry) => { g.deleteAttribute('uv'); return g.toNonIndexed(); })), M.mech);
  mm.castShadow = true; bridge.details.add(mm);
  const rollers = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.33, 0.33, 1.1, 12), M.steel, SH.rollers);
  rollers.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  bridge.details.add(rollers); bridge.rollers = rollers; bridge.rollerSpin = 0;
  shPlaceRollers(bridge, 0);
  // hệ đệm chống va: tường đệm dọc hướng nhịp quay khi mở (theo trục Z) + trụ chống va hình bình + phao tiêu
  const fw = new THREE.InstancedMesh(new THREE.BoxGeometry(0.9, 3.2, 50), M.fender, 4); let k = 0;
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) fw.setMatrixAt(k++, m.makeTranslation(sx * 9.9, 1.0, sz * 40));
  fw.receiveShadow = true; bridge.details.add(fw);
  const vase = new THREE.LatheGeometry([[0, -4], [1.0, -4], [1.3, -1], [1.1, 1.5], [0.7, 3.5], [0.9, 4.6], [0.95, 5.2], [0, 5.3]].map(([r, y]) => new THREE.Vector2(r, y)), 20);
  const dol = [[-12, -66], [12, -66], [-12, 66], [12, 66]];
  const dm = new THREE.InstancedMesh(vase, M.white, dol.length);
  dol.forEach(([x, z], i) => dm.setMatrixAt(i, m.makeTranslation(x, 0, z)));
  dm.castShadow = true; bridge.details.add(dm);
  const mk = [[-56, -95, 0xd42a20], [56, -95, 0x2e9c4a], [-56, 95, 0x2e9c4a], [56, 95, 0xd42a20]];
  const mkm = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.25, 0.45, 6, 10).translate(0, 2.2, 0), M.marker, mk.length), c = new THREE.Color();
  mk.forEach(([x, z, h], i) => { mkm.setMatrixAt(i, m.makeTranslation(x, 0, z)); mkm.setColorAt(i, c.setHex(h)); });
  bridge.details.add(mkm);
}
const _rm = new THREE.Matrix4(), _rq = new THREE.Quaternion(), _rq2 = new THREE.Quaternion(), _rq3 = new THREE.Quaternion(), _rv = new THREE.Vector3(), _rone = new THREE.Vector3(1, 1, 1), Z_AXIS = new THREE.Vector3(0, 0, 1);   // tạm cấp sẵn (D-018)
export function shPlaceRollers(bridge: SongHanBridge, spin: number) {
  const m = _rm, q = _rq, q2 = _rq2, v = _rv, one = _rone;
  const n = SH.rollers;
  _rq3.setFromAxisAngle(UP, spin);
  for (let i = 0; i < n; i++) {
    const a = i / n * Math.PI * 2;
    // trục con lăn hướng tâm; con lăn quay quanh trục của nó khi mâm xoay
    q.setFromAxisAngle(UP, -a).multiply(q2.setFromAxisAngle(Z_AXIS, Math.PI / 2)).multiply(_rq3);
    bridge.rollers.setMatrixAt(i, m.compose(v.set(Math.cos(a) * SH.railR, SH.drumTop + 0.85, Math.sin(a) * SH.railR), q, one));
  }
  bridge.rollers.instanceMatrix.needsUpdate = true;
}

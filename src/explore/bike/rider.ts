/* ============================ Lái xe máy: người lái có xương (src/explore/bike/rider.ts) ============================
   Spec D-040 §6, §17.10 (tư thế ngồi = bảng góc khớp trong code + IK, không chạy lại gen:people).
   - Nhân vật: nguồn của Đi dạo (stroll/rig.ts stRigLoad, p0 nam / p3 nữ theo stCharModel), một bản sao (src.clone = SkeletonUtils.clone), KHÔNG AnimationMixer:
     mỗi khung xương về tư thế đứng chữ A của mô hình (PlBones.restore) rồi cộng góc. Hệ C = hệ gốc bản sao: +X trước mặt, +Y lên, +Z bên phải (trùng hệ thân xe).
   - Cây nút: neo `seat` của xe (đọc lại bike.anchors mỗi khung: neo đổi khi hình tạm đổi sang mô hình thật) → group 'bike-rider' → bản sao nhân vật
     (dời để xương Pelvis ở rider.seat so với đỉnh yên). Nhờ vậy người theo đủ yaw / pitch / nghiêng / giảm xóc của phần trên lò xo.
   - Mỗi khung: 1) bảng góc khớp (bkRiderPose): lưng cúi chia ba đốt, cổ, đầu, gập hông, gập gối, đùi xoay ra, xương đòn; cộng lò xo phản ứng:
     lưng ngả theo gia tốc dọc, đầu bù (1 − headLean) độ nghiêng, đầu quay theo góc lái; 2) IK chân: plTwoBone hông → gối → cổ chân tới neo foot_l / foot_r
     (+ rider.ankle), đùi và cẳng chân xoay cung ngắn nhất từ tư thế bảng (giữ độ xoắn của bảng), bàn chân về hướng lúc đứng (phẳng trên sàn);
     3) IK tay: PlBones.ik của người treo dù với bộ số rider.arm / rider.finger, điểm nắm tới neo grip_l / grip_r (con của cổ lái: bẻ lái thì tay theo).
   - Mũ bảo hiểm nửa đầu: nửa khối cầu (SphereGeometry cắt nửa) gắn xương đầu, vật liệu MeshStandardMaterial màu theo đỉnh = cùng chương trình với hình tạm
     của xe (model.ts bkTempMaterial, đã làm nóng) nên không thêm program. Lớp 1, không bóng như xe.
   - Lệnh vẽ: nhân vật Rocketbox là 1 SkinnedMesh 3 primitive (thân, đầu, mảnh alpha) = 3 lệnh, như nhân vật đi dạo; mũ 1 lệnh.
   - Góc nhìn thứ nhất: xương đầu thu về scale ≈ 0 (mũ là con của xương đầu nên ẩn theo); thân, tay giữ.
   - Chưa có mô hình xe thật (bike.real = false): người ẩn, không tính IK (hình tạm của xe đã có người khối; hai người chồng nhau thì sai).
   Không cấp phát mỗi khung (D-018). */
import * as THREE from 'three';
import { CONFIG } from '../../config';
import { plTwoBone } from '../pilot/ik';
import { PlBones } from '../pilot/bones';
import { stRigLoad, type StRigSource } from '../stroll/rig';
import { stCharModel } from '../stroll/anim';
import type { BkBike } from './model';

export interface BkRiderSig { lean: number; acc: number; susF: number; susR: number; steer: number }   // lean rad (trái +), acc m/s² gia tốc dọc, susF / susR m lún giảm xóc, steer rad (trái +)

const RC = CONFIG.bike.rider;
const TAU = Math.PI * 2;
const A_REF = (50 / 3.6) / CONFIG.bike.perf.t50;   // m/s² — gia tốc khi vặn hết ga dưới 50 km/h (motion.ts A0)

/* ===== Bảng góc khớp tư thế ngồi nền (rad), thứ tự cố định ===== */
export const BK_POSE = { spine: 0, neck: 1, head: 2, hip: 3, knee: 4, legSplit: 5, ankle: 6, clavicle: 7, clavicleFore: 8 } as const;
export const BK_POSE_N = 9;
export function bkRiderPose(out: Float32Array): void {
  const P = RC.pose;
  out[BK_POSE.spine] = P.spine; out[BK_POSE.neck] = P.neck; out[BK_POSE.head] = P.head;
  out[BK_POSE.hip] = P.hip; out[BK_POSE.knee] = P.knee; out[BK_POSE.legSplit] = P.legSplit; out[BK_POSE.ankle] = P.ankle;
  out[BK_POSE.clavicle] = P.clavicle; out[BK_POSE.clavicleFore] = P.clavicleFore;
}

/* Nạp nhân vật ch (0 nam / 1 nữ) — chung bộ nạp, bộ đệm và làm nóng với Đi dạo. Không bao giờ từ chối: lỗi → null */
export function bkRiderLoad(ch: number): Promise<StRigSource | null> { return stRigLoad(stCharModel(ch)); }

const AZ = new THREE.Vector3(0, 0, 1);
const _inv = new THREE.Matrix4(), _q = new THREE.Quaternion(), _q2 = new THREE.Quaternion(), _qa = new THREE.Quaternion(), _qb = new THREE.Quaternion(), _qc = new THREE.Quaternion();
const _h = new THREE.Vector3(), _k = new THREE.Vector3(), _a = new THREE.Vector3(), _d = new THREE.Vector3(), _d2 = new THREE.Vector3();
const _hip = [0, 0, 0], _tgt = [0, 0, 0], _pole = [0, 0, 0], _knee = [0, 0, 0], _end = [0, 0, 0];
const _tL = new THREE.Vector3(), _tR = new THREE.Vector3();

/* Hình học mũ: nửa khối cầu (vỏ trên), màu theo đỉnh */
function bkHelmetGeometry(): THREE.BufferGeometry {
  const H = RC.helmet, g = new THREE.SphereGeometry(H.r, 20, 8, 0, TAU, 0, Math.PI / 2);
  const c = new THREE.Color(H.color), n = g.getAttribute('position').count, col = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b; }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  return g;
}

export class BkRider {
  readonly group = new THREE.Group();
  readonly root: THREE.Object3D;
  readonly bones: PlBones;
  readonly helmet: THREE.Mesh;
  private readonly pose = new Float32Array(BK_POSE_N);
  private readonly feet: THREE.Object3D[];
  private readonly legL1 = [0, 0]; private readonly legL2 = [0, 0];   // m — đùi, cẳng chân
  private readonly footRest = [new THREE.Quaternion(), new THREE.Quaternion()];   // hướng bàn chân trong hệ C lúc đứng (phẳng)
  private readonly footT = [new THREE.Vector3(), new THREE.Vector3()];   // đích cổ chân, hệ C (cho debug)
  private readonly sx = new Float64Array(3); private readonly sv = new Float64Array(3);   // lò xo: lưng chúi, đầu bù nghiêng, đầu quay
  private disposed = false;

  constructor(src: StRigSource) {
    this.group.name = 'bike-rider';
    this.root = src.clone(src.scene);
    this.root.name = 'bike-rider-body';
    this.group.add(this.root);
    const b = this.bones = new PlBones(this.root);   // thiếu xương thì ném (index.ts bắt)
    if (!b.foot[0] || !b.foot[1]) throw new Error('thiếu xương bàn chân');
    this.feet = [b.foot[0], b.foot[1]];
    /* số đo ở tư thế đứng: tay (PlBones.measure với bộ số của xe máy), chân, hướng bàn chân, chỗ xương hông */
    b.measure(RC.arm);
    b.updateMatrices();
    for (let i = 0; i < 2; i++) {
      b.pC(b.thigh[i], _h); b.pC(b.calf[i], _k); b.pC(this.feet[i], _a);
      this.legL1[i] = Math.max(0.05, _h.distanceTo(_k)); this.legL2[i] = Math.max(0.05, _k.distanceTo(_a));
      b.qC(this.feet[i], this.footRest[i]);
    }
    b.pC(b.pelvis, _h);
    this.root.position.set(RC.seat.fore - _h.x, RC.seat.up - _h.y, -_h.z);
    /* mũ: trục theo hệ C lúc đứng thẳng, tâm trên xương đầu; con của xương đầu */
    const H = RC.helmet;
    this.helmet = new THREE.Mesh(bkHelmetGeometry(), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.45, metalness: 0.1 }));
    this.helmet.name = 'bike-helmet';
    b.qC(b.head, _q).invert();
    const hs = _h.setFromMatrixScale(_inv.copy(this.root.matrixWorld).invert().multiply(b.head.matrixWorld)).x || 1;   // tỉ lệ xương đầu so với hệ C (Rocketbox: Bip01 scale 0,01, đơn vị cm)
    this.helmet.quaternion.copy(_q).multiply(_qa.setFromAxisAngle(AZ, H.pitch));   // trục mũ = hệ C ngửa pitch quanh trục ngang
    this.helmet.position.set(H.fore, H.up, 0).applyQuaternion(_q).divideScalar(hs);
    this.helmet.scale.set(H.scale[0] / hs, H.scale[1] / hs, H.scale[2] / hs);
    b.head.add(this.helmet);
    this.group.traverse((o) => {
      o.layers.set(1);
      const m = o as THREE.Mesh;
      if (m.isMesh) { m.castShadow = false; m.receiveShadow = false; m.frustumCulled = false; }
    });
    bkRiderPose(this.pose);
    this.group.visible = false;
  }

  /* Lò xo bậc hai ba kênh tới đích, bước con ≤ 1/120 s (ổn định với mọi dt đã kẹp) */
  private spring(sig: BkRiderSig, d: number): void {
    const acc = Number.isFinite(sig.acc) ? sig.acc : 0, lean = Number.isFinite(sig.lean) ? sig.lean : 0, steer = Number.isFinite(sig.steer) ? sig.steer : 0;
    const t0 = acc >= 0 ? -RC.accLean * Math.min(1, acc / A_REF) : RC.brakeLean * Math.min(1, -acc / CONFIG.bike.perf.hardBrake);
    const t1 = lean * (1 - RC.headLean), t2 = steer * RC.steerLook;
    if (!(d > 0)) return;
    const w = TAU * RC.hz, z = RC.damp, n = Math.ceil(d * 120), h = d / n, x = this.sx, v = this.sv;
    for (let s = 0; s < n; s++) {
      v[0] += (w * w * (t0 - x[0]) - 2 * z * w * v[0]) * h; x[0] += v[0] * h;
      v[1] += (w * w * (t1 - x[1]) - 2 * z * w * v[1]) * h; x[1] += v[1] * h;
      v[2] += (w * w * (t2 - x[2]) - 2 * z * w * v[2]) * h; x[2] += v[2] * h;
    }
  }

  /* Xoay xương o thêm R (hệ C) quanh khớp của nó (như PlBones.rotC) */
  private rotC(o: THREE.Object3D, R: THREE.Quaternion): void {
    this.bones.qC(o.parent, _q2);
    o.quaternion.premultiply(_q.copy(_q2).invert().multiply(R).multiply(_q2));
  }

  /* Vị trí neo trong hệ C (ma trận thế giới đã cập nhật; _inv = nghịch đảo ma trận gốc bản sao) */
  private toC(o: THREE.Object3D, out: THREE.Vector3): THREE.Vector3 { return out.setFromMatrixPosition(o.matrixWorld).applyMatrix4(_inv); }

  update(bike: BkBike, sig: BkRiderSig, dt: number): void {
    if (this.disposed) return;
    if (!bike.real) { this.group.visible = false; return; }
    const an = bike.anchors, b = this.bones, P = this.pose, B = BK_POSE;
    if (this.group.parent !== an.seat) an.seat.add(this.group);
    this.group.visible = true;
    const d = dt > 0 && Number.isFinite(dt) ? Math.min(dt, RC.dtMax) : 0;
    this.spring(sig, d);
    const x = this.sx;
    /* 1) bảng góc khớp + phản ứng (rotE: Euler YZX trong hệ C; quay âm quanh +Z = cúi trước; quay dương quanh +X = nghiêng phải; quay dương quanh +Y = quay trái) */
    b.restore();
    const k = 1 / b.spines.length;
    for (const s of b.spines) b.rotE(s, 0, 0, -(P[B.spine] + x[0]) * k);
    b.rotE(b.neck, 0, 0, -P[B.neck]);
    b.rotE(b.head, x[1], x[2], -P[B.head]);
    for (let i = 0; i < 2; i++) {
      const side = i ? 1 : -1;
      b.rotE(b.thigh[i], 0, -side * P[B.legSplit], P[B.hip]);
      b.rotE(b.calf[i], 0, 0, -P[B.knee]);
    }
    for (const a of b.arms) b.rotE(a.clav, -a.side * P[B.clavicle], 0, P[B.clavicleFore]);
    /* 2) chân */
    bike.group.updateMatrixWorld(true);
    b.updateMatrices();
    _inv.copy(this.root.matrixWorld).invert();
    const LP = RC.legPole, AK = RC.ankle;
    for (let i = 0; i < 2; i++) {
      const side = i ? 1 : -1, th = b.thigh[i], ca = b.calf[i], ft = this.feet[i], T = this.footT[i];
      this.toC(i ? an.footR : an.footL, T);
      T.x -= AK.back; T.y += AK.up;
      b.pC(th, _h); b.pC(ca, _k); b.pC(ft, _a);
      _hip[0] = _h.x; _hip[1] = _h.y; _hip[2] = _h.z;
      _tgt[0] = T.x; _tgt[1] = T.y; _tgt[2] = T.z;
      _pole[0] = _h.x + LP[0]; _pole[1] = _h.y + LP[1]; _pole[2] = _h.z + side * LP[2];
      plTwoBone(_hip, this.legL1[i], this.legL2[i], _tgt, _pole, _knee, _end);
      /* đùi: cung ngắn nhất từ hướng hiện tại (bảng) tới hướng hông → gối mới */
      _d.copy(_k).sub(_h).normalize(); _d2.set(_knee[0] - _h.x, _knee[1] - _h.y, _knee[2] - _h.z).normalize();
      _qa.setFromUnitVectors(_d, _d2);
      this.rotC(th, _qa);
      /* cẳng chân: hướng cũ (đã quay theo đùi) → gối → cổ chân mới */
      _d.copy(_a).sub(_k).normalize().applyQuaternion(_qa);
      _d2.set(_end[0] - _knee[0], _end[1] - _knee[1], _end[2] - _knee[2]).normalize();
      _qb.setFromUnitVectors(_d, _d2);
      this.rotC(ca, _qb);
      /* bàn chân: hướng lúc đứng (phẳng) + góc bảng quanh trục ngang */
      b.qC(ca, _q2).invert();
      ft.quaternion.copy(_q2).multiply(_qc.setFromAxisAngle(AZ, -P[B.ankle]).multiply(this.footRest[i]));
    }
    /* 3) tay */
    b.updateMatrices();
    this.toC(an.gripL, _tL); this.toC(an.gripR, _tR);
    b.ik(b.arms[0], _tL, RC.arm, RC.finger);
    b.ik(b.arms[1], _tR, RC.arm, RC.finger);
  }

  /* Góc nhìn thứ nhất: thu xương đầu (và mũ) về ≈ 0 */
  setFirstPerson(on: boolean): void {
    this.bones.head.scale.setScalar(on ? 1e-4 : 1);
  }

  /* Mắt trong hệ của nút frame (camera góc thứ nhất đo một lần ở tư thế ngồi nền: index.ts riderEye): điểm giữa hai xương mắt Bip01_LEye / REye
     (Rocketbox có), trả true; thiếu thì vị trí xương đầu, trả false (người gọi cộng cam1.headEye) */
  eyeLocal(frame: THREE.Object3D, out: THREE.Vector3): boolean {
    frame.updateWorldMatrix(true, true);
    const l = this.root.getObjectByName('Bip01_LEye') ?? this.root.getObjectByName('Bip01 LEye'), r = this.root.getObjectByName('Bip01_REye') ?? this.root.getObjectByName('Bip01 REye');
    if (l && r) out.setFromMatrixPosition(l.matrixWorld).add(_a.setFromMatrixPosition(r.matrixWorld)).multiplyScalar(0.5);
    else out.setFromMatrixPosition(this.bones.head.matrixWorld);
    frame.worldToLocal(out);
    return !!(l && r);
  }

  /* m — khoảng cách điểm nắm – tay nắm (hai tay), cổ chân – đích cổ chân trên sàn (hai chân), sau update gần nhất */
  debug(): { handL: number; handR: number; footL: number; footR: number } {
    const b = this.bones;
    b.updateMatrices();
    _inv.copy(this.root.matrixWorld).invert();
    const f = (i: number): number => b.pC(this.feet[i], new THREE.Vector3()).distanceTo(this.footT[i]);
    return { handL: b.handErr(0), handR: b.handErr(1), footL: f(0), footR: f(1) };
  }

  /* Gỡ khỏi xe, giải phóng skeleton riêng của bản sao, hình học / vật liệu mũ. Hình học / texture / vật liệu nhân vật thuộc nguồn dùng chung nên giữ */
  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.group.removeFromParent();
    const seen = new Set<THREE.Skeleton>();
    this.root.traverse((o) => {
      const sk = (o as THREE.SkinnedMesh).isSkinnedMesh ? (o as THREE.SkinnedMesh).skeleton : null;
      if (sk && !seen.has(sk)) { seen.add(sk); sk.dispose(); }
    });
    this.helmet.geometry.dispose();
    (this.helmet.material as THREE.Material).dispose();
  }
}

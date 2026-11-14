/* ===== Người treo dù: áp tư thế lên xương Bip01_* (src/explore/pilot/bones.ts) =====
   Mọi góc tính trong hệ C = hệ gốc bản sao nhân vật (trùng trục nhóm lắc: +X trước mặt, +Y lên, +Z bên phải người), không phụ thuộc trục cục bộ kỳ quặc của Biped:
   xoay R trong hệ C quanh khớp của xương b ⇒ q_b = Q_cha⁻¹ · R · Q_cha · q_b, Q_cha = hướng của xương cha trong hệ C (tích quaternion cục bộ dọc chuỗi cha).
   Thứ tự mỗi khung (rig.ts gọi): restore() đưa các xương do đây điều khiển về tư thế gốc → mixer.update (đoạn `sit` ghi đè xương có kênh) → apply():
     1) hông ngả (base.recline), 2) ba đốt sống chia đều nghiêng / chúi / vặn, 3) đầu, 4) chân (đùi, gối, bàn chân), 5) xương đòn nâng, 6) ba lô,
     7) cập nhật ma trận một lần, IK hai khớp cho tay tới quai phanh (đích là điểm nắm giữa lòng bàn tay, không phải cổ tay), 8) ngón co thành nắm đấm.
   IK tay: plTwoBone trong hệ C cho vị trí khuỷu; hướng cánh tay / cẳng tay đặt bằng ánh xạ hai trục (trục xương + trục bản lề khuỷu đo ở tư thế `sit`)
   nên khuỷu luôn gập đúng chiều; một phần (arm.twist) độ xoay cổ tay chia sang cẳng tay để da cổ tay không xoắn. Không cấp phát mỗi khung. */
import * as THREE from 'three';
import { CONFIG } from '../../config';
import { plTwoBone } from './ik';
import type { PlPose } from './react';

/* Tên xương trong glb (three đổi dấu cách thành `_`; tra cả hai kiểu) */
const NM = (s: string): string[] => ['Bip01_' + s.replace(/ /g, '_'), 'Bip01 ' + s];
const REQ = ['Pelvis', 'Spine', 'Spine1', 'Spine2', 'Head', 'L UpperArm', 'L Forearm', 'L Hand', 'R UpperArm', 'R Forearm', 'R Hand', 'L Thigh', 'L Calf', 'R Thigh', 'R Calf'];

function find(root: THREE.Object3D, s: string): THREE.Object3D | null {
  for (const n of NM(s)) { const o = root.getObjectByName(n); if (o) return o; }
  return null;
}
/* Xương bắt buộc còn thiếu (load.ts kiểm lúc nạp) */
export function plBonesMissing(root: THREE.Object3D): string[] { return REQ.filter((s) => !find(root, s)); }

const _q = new THREE.Quaternion(), _q2 = new THREE.Quaternion(), _q3 = new THREE.Quaternion(), _qr = new THREE.Quaternion();
const _e = new THREE.Euler(), _m = new THREE.Matrix4(), _m2 = new THREE.Matrix4(), _inv = new THREE.Matrix4();
const _v = new THREE.Vector3(), _v2 = new THREE.Vector3(), _v3 = new THREE.Vector3();
const _A = new THREE.Vector3(), _W = new THREE.Vector3(), _E = new THREE.Vector3(), _g = new THREE.Vector3(), _d1 = new THREE.Vector3(), _d2 = new THREE.Vector3(), _nn = new THREE.Vector3(), _f = new THREE.Vector3(), _n = new THREE.Vector3(), _ax = new THREE.Vector3();
const _QU = new THREE.Quaternion(), _QF = new THREE.Quaternion(), _sh = [0, 0, 0], _wt = [0, 0, 0], _pole = [0, 0, 0];
const AX = new THREE.Vector3(1, 0, 0), AY = new THREE.Vector3(0, 1, 0), AZ = new THREE.Vector3(0, 0, 1);
/* Thông số tay / ngón cho IK (CONFIG.explore.pilot.arm / finger; người lái xe máy truyền bộ số riêng, bike/rider.ts) */
export type PlArmCfg = { pole: number[]; wrist: number[]; palm: number[]; twist: number; grip: number[] };
export type PlFingerCfg = { curl: number[]; thumb: number[]; thumbRoll: number };
const fin3 = (v: THREE.Vector3): boolean => Number.isFinite(v.x) && Number.isFinite(v.y) && Number.isFinite(v.z);

/* Hai trục (a, b) → cơ sở trực chuẩn [a, b⊥, a×b⊥] ghi vào ma trận m (cột) */
function basis(m: THREE.Matrix4, a: THREE.Vector3, b: THREE.Vector3): THREE.Matrix4 {
  _v.copy(a).normalize(); _v2.copy(b).addScaledVector(_v, -b.dot(_v));
  if (_v2.lengthSq() < 1e-10) _v2.set(-_v.y, _v.x, 0).lengthSq() < 1e-10 ? _v2.set(0, -_v.z, _v.y) : _v2;
  _v2.normalize(); _v3.crossVectors(_v, _v2);
  return m.makeBasis(_v, _v2, _v3);
}
/* Quaternion xoay cặp trục (a1, b1) thành (a2, b2): out = B2 · B1ᵀ */
function mapAxes(out: THREE.Quaternion, a1: THREE.Vector3, b1: THREE.Vector3, a2: THREE.Vector3, b2: THREE.Vector3): THREE.Quaternion {
  basis(_m2, a1, b1).transpose();
  basis(_m, a2, b2).multiply(_m2);
  return out.setFromRotationMatrix(_m);
}

/* Một cánh tay: xương, số đo ở tư thế `sit`, trạng thái IK */
export interface PlArm {
  side: -1 | 1;                       // −1 trái (−Z), +1 phải
  clav: THREE.Object3D | null; up: THREE.Object3D; fore: THREE.Object3D; hand: THREE.Object3D;
  l1: number; l2: number;             // m dài cánh tay, cẳng tay
  dU: THREE.Vector3; nU: THREE.Vector3;   // trục xương / trục bản lề trong hệ cục bộ cánh tay
  dF: THREE.Vector3; nF: THREE.Vector3;   // như trên cho cẳng tay
  fH: THREE.Vector3; nH: THREE.Vector3;   // hướng ngón / pháp tuyến lòng bàn tay trong hệ cục bộ bàn tay
  gH: THREE.Vector3;                  // m — điểm nắm (giữa nắm tay) so với xương bàn tay, hệ quay của bàn tay
  fingers: THREE.Object3D[][];        // [ngón 0..4][đốt 0..2]
  D: THREE.Quaternion;                // hướng bàn tay mong muốn trong hệ C (giữ khung trước làm điểm xuất phát)
  hasD: boolean;
  target: THREE.Vector3;              // điểm nắm mong muốn (quai phanh), hệ C
  elbow: number[]; end: number[];     // đệm IK
}

export class PlBones {
  readonly root: THREE.Object3D;
  readonly pelvis: THREE.Object3D; readonly spines: THREE.Object3D[]; readonly neck: THREE.Object3D | null; readonly head: THREE.Object3D;
  readonly thigh: THREE.Object3D[]; readonly calf: THREE.Object3D[]; readonly foot: (THREE.Object3D | null)[];
  readonly arms: PlArm[];
  pack: THREE.Object3D | null = null;     // xương phụ ba lô (con của Spine2, rig.ts gắn)
  private touched: THREE.Object3D[] = [];
  private base: THREE.Quaternion[] = [];

  constructor(root: THREE.Object3D) {
    this.root = root;
    const need = (s: string): THREE.Object3D => { const o = find(root, s); if (!o) throw new Error('thiếu xương ' + s); return o; };
    this.pelvis = need('Pelvis');
    this.spines = [need('Spine'), need('Spine1'), need('Spine2')];
    this.neck = find(root, 'Neck'); this.head = need('Head');
    this.thigh = [need('L Thigh'), need('R Thigh')]; this.calf = [need('L Calf'), need('R Calf')]; this.foot = [find(root, 'L Foot'), find(root, 'R Foot')];
    this.arms = (['L', 'R'] as const).map((s, i) => {
      const fingers: THREE.Object3D[][] = [];
      for (let f = 0; f < 5; f++) {
        const ch: THREE.Object3D[] = [];
        for (const sfx of ['', '1', '2']) { const o = find(root, `${s} Finger${f}${sfx}`); if (o) ch.push(o); else break; }
        fingers.push(ch);
      }
      return {
        side: (i ? 1 : -1) as -1 | 1, clav: find(root, `${s} Clavicle`), up: need(`${s} UpperArm`), fore: need(`${s} Forearm`), hand: need(`${s} Hand`),
        l1: 0.28, l2: 0.26, dU: new THREE.Vector3(1, 0, 0), nU: new THREE.Vector3(0, 0, 1), dF: new THREE.Vector3(1, 0, 0), nF: new THREE.Vector3(0, 0, 1),
        fH: new THREE.Vector3(1, 0, 0), nH: new THREE.Vector3(0, -1, 0), gH: new THREE.Vector3(0.08, 0, 0), fingers,
        D: new THREE.Quaternion(), hasD: false, target: new THREE.Vector3(), elbow: [0, 0, 0], end: [0, 0, 0]
      };
    });
    const add = (o: THREE.Object3D | null) => { if (o && !this.touched.includes(o)) { this.touched.push(o); this.base.push(o.quaternion.clone()); } };
    add(this.pelvis); this.spines.forEach(add); add(this.neck); add(this.head);
    this.thigh.forEach(add); this.calf.forEach(add); this.foot.forEach(add);
    for (const a of this.arms) { add(a.clav); add(a.up); add(a.fore); add(a.hand); for (const ch of a.fingers) ch.forEach(add); }
  }

  /* Trước mixer.update: xương do đây điều khiển về giá trị của đoạn `sit` khung trước (lần đầu: tư thế gốc). PropertyMixer của three chỉ ghi khi giá trị
     đoạn đổi, nên kênh hằng (gối phải, ngón tay không có kênh) không được ghi lại mỗi khung: phải tự trả về, nếu không góc cộng thêm bị cộng dồn */
  restore(): void { for (let i = 0; i < this.touched.length; i++) this.touched[i].quaternion.copy(this.base[i]); }
  /* Sau mixer.update: nhớ giá trị đoạn `sit` (trước khi cộng góc) cho restore() khung sau */
  capture(): void { for (let i = 0; i < this.touched.length; i++) this.base[i].copy(this.touched[i].quaternion); }

  /* Hướng của xương trong hệ C (tích quaternion cục bộ từ xương lên tới gốc, không tính gốc) */
  qC(o: THREE.Object3D | null, out: THREE.Quaternion): THREE.Quaternion {
    out.identity();
    while (o && o !== this.root) { out.premultiply(o.quaternion); o = o.parent; }
    return out;
  }
  /* Vị trí xương trong hệ C, m (cần updateMatrixWorld trước; _inv = nghịch đảo ma trận thế giới của gốc) */
  pC(o: THREE.Object3D, out: THREE.Vector3): THREE.Vector3 { return out.setFromMatrixPosition(o.matrixWorld).applyMatrix4(_inv); }
  updateMatrices(): void { this.root.updateMatrixWorld(true); _inv.copy(this.root.matrixWorld).invert(); }

  /* Xoay xương o thêm R (hệ C) quanh khớp của nó */
  private rotC(o: THREE.Object3D | null, R: THREE.Quaternion): void {
    if (!o) return;
    this.qC(o.parent, _q);                        // Q_cha
    _q2.copy(_q).invert().multiply(R).multiply(_q);   // Q_cha⁻¹ · R · Q_cha
    o.quaternion.premultiply(_q2);
  }
  /* Đặt hướng xương o trong hệ C bằng Q (tuyệt đối) */
  private setC(o: THREE.Object3D, Q: THREE.Quaternion): void {
    this.qC(o.parent, _q);
    o.quaternion.copy(_q.invert().multiply(Q));
  }
  rotE(o: THREE.Object3D | null, x: number, y: number, z: number): void {
    if (!o || (x === 0 && y === 0 && z === 0)) return;
    this.rotC(o, _qr.setFromEuler(_e.set(x, y, z, 'YZX')));
  }

  /* Số đo cố định từ tư thế `sit` (rig.ts gọi một lần sau mixer.update(0), trước apply): độ dài tay, trục bản lề khuỷu, trục bàn tay, điểm nắm */
  measure(A: PlArmCfg = CONFIG.explore.pilot.arm): void {
    this.updateMatrices();
    const pa = new THREE.Vector3(), pf = new THREE.Vector3(), ph = new THREE.Vector3(), n = new THREE.Vector3(), Q = new THREE.Quaternion();
    for (const a of this.arms) {
      this.pC(a.up, pa); this.pC(a.fore, pf); this.pC(a.hand, ph);
      a.l1 = Math.max(0.05, pa.distanceTo(pf)); a.l2 = Math.max(0.05, pf.distanceTo(ph));
      const du = pf.clone().sub(pa).normalize(), df = ph.clone().sub(pf).normalize();
      n.crossVectors(du, df);
      if (n.lengthSq() < 1e-6) n.set(0, a.side > 0 ? -1 : 1, 0).cross(du);   // tay duỗi thẳng ở `sit`: lấy bản lề nằm ngang (dự phòng, không NaN)
      n.normalize();
      this.qC(a.up, Q).invert(); a.dU.copy(du).applyQuaternion(Q); a.nU.copy(n).applyQuaternion(Q);
      this.qC(a.fore, Q).invert(); a.dF.copy(df).applyQuaternion(Q); a.nF.copy(n).applyQuaternion(Q);
      /* bàn tay: hướng ngón = cổ tay → gốc ngón giữa; pháp tuyến lòng bàn tay = side · (trỏ − út) × hướng ngón (đúng cho cả hai tay); thiếu ngón thì nối dài cẳng tay, lòng bàn tay úp */
      const mid = a.fingers[2][0], idx = a.fingers[1][0], pin = a.fingers[4][0];
      const fd = new THREE.Vector3(), palm = new THREE.Vector3(0, -1, 0);
      if (mid) fd.copy(this.pC(mid, new THREE.Vector3())).sub(ph); else fd.copy(df).multiplyScalar(0.09);
      const reach = Math.max(0.03, fd.length()); fd.normalize();
      if (idx && pin) { palm.copy(this.pC(idx, new THREE.Vector3())).sub(this.pC(pin, new THREE.Vector3())).cross(fd).multiplyScalar(a.side); if (palm.lengthSq() < 1e-10) palm.set(0, -1, 0); }
      palm.addScaledVector(fd, -palm.dot(fd)).normalize();
      if (!fin3(palm) || palm.lengthSq() < 0.5) palm.set(0, -1, 0);
      const g = fd.clone().multiplyScalar(reach * A.grip[0]).addScaledVector(palm, A.grip[1]);
      this.qC(a.hand, Q).invert();
      a.fH.copy(fd).applyQuaternion(Q); a.nH.copy(palm).applyQuaternion(Q); a.gH.copy(g).applyQuaternion(Q);
      a.hasD = false;
    }
  }

  /* Áp tư thế: pose (react.ts, góc cộng thêm) + đích hai quai phanh tL / tR (điểm nắm, hệ C) */
  apply(p: PlPose, tL: THREE.Vector3, tR: THREE.Vector3): void {
    const P = CONFIG.explore.pilot, B = P.base;
    /* 1) hông ngả ra sau: xoay quanh +Z dương đưa thân trên về −X, đùi nâng lên (bù ở bước 4) */
    this.rotE(this.pelvis, 0, 0, B.recline);
    /* 2) ba đốt sống: nghiêng trái = quay âm quanh +X, chúi trước = quay âm quanh +Z, vai xoay trái = quay dương quanh +Y */
    const k = 1 / this.spines.length;
    for (const s of this.spines) this.rotE(s, -p.spineRoll * k, p.spineTwist * k, -(p.spinePitch + B.spine) * k);
    /* 3) đầu: quay, nghiêng bù, cúi nhìn trước (bù độ ngả) */
    this.rotE(this.neck, 0, 0, -B.neck);
    this.rotE(this.head, -p.headRoll, p.headYaw, -B.head);
    /* 4) chân: đùi (dạng: trái quay dương quanh +Y; đưa ngang theo legSide; gập hông quanh +Z), gối (gập = quay âm quanh +Z), bàn chân */
    for (let i = 0; i < 2; i++) {
      const side = i ? 1 : -1, knee = i ? p.kneeR : p.kneeL;
      this.rotE(this.thigh[i], 0, p.legSide - side * (p.legSplit + B.legSplit), B.hip + p.legFore * B.legForeHip);
      this.rotE(this.calf[i], 0, 0, -(B.knee + knee) + p.legFore);
      this.rotE(this.foot[i], 0, 0, B.foot);
    }
    /* 5) xương đòn nâng vai khi tay lên quai: trái quay dương quanh +X */
    for (const a of this.arms) this.rotE(a.clav, -a.side * B.clavicle, 0, B.clavicleFore);
    /* 6) ba lô (xương phụ con của Spine2): nghiêng trái = âm quanh +X, chúi trước = âm quanh +Z */
    if (this.pack) {
      this.pack.quaternion.identity();
      this.rotE(this.pack, -p.packRoll, 0, -p.packPitch);
    }
    /* 7) tay */
    this.updateMatrices();
    this.ik(this.arms[0], tL); this.ik(this.arms[1], tR);
  }

  /* Hướng bàn tay mong muốn D (hệ C) khi cẳng tay theo hướng d2: ngón theo cẳng tay nghiêng về trước / lên / vào trong (arm.wrist), lòng bàn tay theo arm.palm */
  private handD(a: PlArm, d2: THREE.Vector3, W: PlArmCfg): void {
    _f.copy(d2).addScaledVector(AX, W.wrist[0]).addScaledVector(AY, W.wrist[1]).addScaledVector(AZ, -a.side * W.wrist[2]).normalize();
    _n.set(W.palm[0], W.palm[1], -a.side * W.palm[2]);
    mapAxes(a.D, a.fH, a.nH, _f, _n);
    a.hasD = true;
  }

  /* IK một tay tới điểm nắm t (hệ C; cần updateMatrices() trước). Ba lượt: đích cổ tay = t − D·gH với D của lượt trước. W / F: bộ số tay / ngón (mặc định của người treo dù) */
  ik(a: PlArm, t: THREE.Vector3, W: PlArmCfg = CONFIG.explore.pilot.arm, F: PlFingerCfg = CONFIG.explore.pilot.finger): void {
    a.target.copy(t);
    const A = this.pC(a.up, _A);
    _pole[0] = A.x + W.pole[0]; _pole[1] = A.y + W.pole[1]; _pole[2] = A.z + a.side * W.pole[2];
    _sh[0] = A.x; _sh[1] = A.y; _sh[2] = A.z;
    if (!a.hasD) this.handD(a, _d2.copy(t).sub(A).normalize(), W);
    for (let it = 0; it < 3; it++) {
      _g.copy(a.gH).applyQuaternion(a.D);
      _W.copy(t).sub(_g);
      _wt[0] = _W.x; _wt[1] = _W.y; _wt[2] = _W.z;
      plTwoBone(_sh, a.l1, a.l2, _wt, _pole, a.elbow, a.end);
      _E.fromArray(a.elbow); _W.fromArray(a.end);
      _d2.copy(_W).sub(_E).normalize();
      if (fin3(_d2)) this.handD(a, _d2, W);
    }
    _d1.copy(_E).sub(A).normalize();
    _nn.crossVectors(_d1, _d2);
    if (_nn.lengthSq() < 1e-8) _nn.set(W.pole[0], W.pole[1], a.side * W.pole[2]).cross(_d1);   // tay duỗi thẳng: bản lề vuông góc với mặt phẳng chứa cực
    _nn.normalize();
    if (!fin3(_d1) || !fin3(_d2) || !fin3(_nn)) return;
    this.setC(a.up, mapAxes(_QU, a.dU, a.nU, _d1, _nn));
    mapAxes(_QF, a.dF, a.nF, _d2, _nn);
    /* chia phần xoắn quanh trục cẳng tay giữa cẳng tay và cổ tay (arm.twist), da cổ tay không xoắn hết một chỗ */
    _q3.copy(_QF).invert().multiply(a.D);                        // bàn tay so với cẳng tay (hệ cục bộ cẳng tay)
    let tw = 2 * Math.atan2(_q3.x * a.dF.x + _q3.y * a.dF.y + _q3.z * a.dF.z, _q3.w);
    if (tw > Math.PI) tw -= 2 * Math.PI; else if (tw < -Math.PI) tw += 2 * Math.PI;
    _QF.premultiply(_qr.setFromAxisAngle(_d2, tw * W.twist));
    this.setC(a.fore, _QF);
    this.setC(a.hand, a.D);
    /* ngón co quanh trục ngang lòng bàn tay (hướng ngón × pháp tuyến lòng bàn tay: quay dương đưa ngón vào lòng bàn tay); ngón cái thêm xoay quanh hướng ngón để ôm quai */
    _f.copy(a.fH).applyQuaternion(a.D); _n.copy(a.nH).applyQuaternion(a.D);
    _ax.crossVectors(_f, _n).normalize();
    for (let f = 1; f < 5; f++) { const ch = a.fingers[f]; for (let j = 0; j < ch.length; j++) this.rotC(ch[j], _qr.setFromAxisAngle(_ax, F.curl[j])); }
    const th = a.fingers[0];
    if (th.length) {
      this.rotC(th[0], _qr.setFromAxisAngle(_f, -a.side * F.thumbRoll));
      for (let j = 0; j < th.length; j++) this.rotC(th[j], _qr.setFromAxisAngle(_ax, F.thumb[j]));
    }
  }

  /* m — khoảng cách điểm nắm thật (xương bàn tay + D·gH) tới quai phanh, sau khi đã cập nhật ma trận */
  handErr(i: number): number {
    const a = this.arms[i];
    this.updateMatrices();
    const h = this.pC(a.hand, new THREE.Vector3());
    const g = a.gH.clone().applyQuaternion(this.qC(a.hand, new THREE.Quaternion()));
    return h.add(g).distanceTo(a.target);
  }
}

/* ============================ Người treo dù: trang bị bằng code ============================
   Một BufferGeometry có xương (skinIndex / skinWeight) cho SkinnedMesh: ghế ngồi + hai má ghế, hộp dù dự phòng dưới ghế + quai kéo đỏ, ba lô / tấm bảo vệ lưng,
   đệm thắt lưng, đai vai (lưng → vai → ngực → carabiner), đai ngực có khóa, vòng đai đùi có khóa, carabiner (vòng bầu dục), riser (đai dẹt hai nhánh),
   quai phanh (thanh trong nắm tay), dây phanh, dây treo.
   Mỗi đỉnh gắn cứng một xương (trọng số 1). Đai và dây nối hai xương là dải có đầu này một xương, đầu kia một xương nên luôn bám người lẫn dù khi xương dịch chuyển.
   Hệ tọa độ: hệ group dù (+X bay, +Y lên, +Z phải); mọi bộ phận dựng theo vị trí nghỉ của xương truyền vào (PlGearRest, rig.ts đo ở tư thế bay nền), không có số tuyệt đối.
   Khối đệm là siêu elip (bo tròn, pháp tuyến mượt); đặt trong "hệ thân": trục a dọc thân (hông → Spine2), b ra trước vuông góc a, c = +Z.
   Thuần BufferGeometry, không cần DOM nên test node dùng được. Thông số: CONFIG.explore.pilot.gear. Trần 6 000 tam giác (test kiểm). */
import * as THREE from 'three';
import { CONFIG } from '../../config';
import { exLineTops, exBrakeTops } from '../glider';

/* Thứ tự xương = giá trị skinIndex. 'wing' là gốc cánh (đầu trên của dây), 'hang' là đỉnh riser (tâm lắc), 'pack' là ba lô lệch pha với thân */
export const PL_GEAR_BONES = ['wing', 'hang', 'pelvis', 'spine', 'handL', 'handR', 'thighL', 'thighR', 'pack'] as const;
/* Đoạn đỉnh của một dây trong geometry: kind 'line' (dây treo) hoặc 'brake' (dây phanh chính quai → điểm tụ); ba / bb = xương hai đầu; geometry.userData.spans */
export interface PlGearSpan { kind: 'line' | 'brake'; ba: number; bb: number; start: number; count: number }
export interface PlGearRest {
  hang: number[]; pelvis: number[]; spine: number[]; handL: number[]; handR: number[]; thighL: number[]; thighR: number[];   // vị trí nghỉ trong hệ group dù, m (hang: giữa hai carabiner ở exHangY, KHÁC xương `hang` của trang bị là đỉnh riser; spine: Spine2)
  kneeL?: number[]; kneeR?: number[];   // m — gối (đầu xương cẳng chân); thiếu thì đùi + CONFIG.explore.pilot.gear.thigh.kneeFb về trước
  gripL?: number[]; gripR?: number[];   // m — điểm nắm quai phanh (giữa nắm tay); thiếu thì lấy vị trí xương bàn tay
  barL?: number[]; barR?: number[];     // hướng đơn vị của thanh quai phanh (ngang lòng bàn tay); thiếu thì +Z
  fingL?: number[]; fingR?: number[];   // hướng đơn vị từ cổ tay ra ngón; thiếu thì +Y
}

const PG = CONFIG.explore.pilot, GC = PG.gear;
const BI = (n: typeof PL_GEAR_BONES[number]): number => PL_GEAR_BONES.indexOf(n);
const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);
const VA = (a: number[]) => new THREE.Vector3(a[0], a[1], a[2]);
const COL = (hex: string): number[] => { const c = new THREE.Color(hex); return [c.r, c.g, c.b]; };
/* Số đoạn chia hình học (độ mịn, không phải số đo thật): (vĩ, kinh) từng khối đệm, đoạn của carabiner và vòng đai đùi */
const SEG = { seat: [6, 12], side: [5, 10], reserve: [5, 10], handle: [3, 6], lumbar: [5, 10], back: [8, 14], buckle: [3, 6], carab: 12, thigh: 14 };
const spow = (v: number, e: number): number => Math.sign(v) * Math.pow(Math.abs(v), e);

/* Bộ gom đỉnh không chỉ số: mỗi tam giác có màu và xương theo đỉnh; pháp tuyến phẳng hoặc truyền vào */
class GearBuf {
  pos: number[] = []; nor: number[] = []; col: number[] = []; si: number[] = [];
  spans: PlGearSpan[] = [];   // đoạn đỉnh của từng dây (test dùng để kiểm hai đầu hai xương)
  span(kind: PlGearSpan['kind'], ba: number, bb: number, f: () => void): void {
    const start = this.si.length; f(); this.spans.push({ kind, ba, bb, start, count: this.si.length - start });
  }
  /* Một tam giác; ba xương theo ba đỉnh; ns: pháp tuyến từng đỉnh (bỏ trống = phẳng) */
  tri(a: THREE.Vector3, b: THREE.Vector3, c: THREE.Vector3, ba: number, bb: number, bc: number, rgb: number[], ns?: THREE.Vector3[]): void {
    const n = b.clone().sub(a).cross(c.clone().sub(a));
    if (n.lengthSq() < 1e-14) return;
    n.normalize();
    const pts: [THREE.Vector3, number][] = [[a, ba], [b, bb], [c, bc]];
    for (let i = 0; i < 3; i++) {
      const [p, bone] = pts[i], nn = ns ? ns[i] : n;
      this.pos.push(p.x, p.y, p.z); this.nor.push(nn.x, nn.y, nn.z); this.col.push(rgb[0], rgb[1], rgb[2]); this.si.push(bone);
    }
  }
  /* Mặt bốn đỉnh; ref nằm bên trong khối, mặt luôn quay ra xa ref */
  quad(p: THREE.Vector3[], bn: number[], rgb: number[], ref: THREE.Vector3): void {
    const ctr = p[0].clone().add(p[1]).add(p[2]).add(p[3]).multiplyScalar(0.25);
    const n = p[1].clone().sub(p[0]).cross(p[2].clone().sub(p[0]));
    const o = n.dot(ctr.sub(ref)) < 0 ? [0, 3, 2, 1] : [0, 1, 2, 3];
    this.tri(p[o[0]], p[o[1]], p[o[2]], bn[o[0]], bn[o[1]], bn[o[2]], rgb);
    this.tri(p[o[0]], p[o[2]], p[o[3]], bn[o[0]], bn[o[2]], bn[o[3]], rgb);
  }
  /* Khối đệm siêu elip: tâm c, ba trục đơn vị ax, nửa kích thước h, độ vuông e, chia nu (vĩ) × nv (kinh), một xương */
  blob(c: THREE.Vector3, ax: THREE.Vector3[], h: number[], e: number, nu: number, nv: number, bone: number, rgb: number[]): void {
    const P: THREE.Vector3[][] = [], N: THREE.Vector3[][] = [];
    for (let i = 0; i <= nu; i++) {
      const u = -Math.PI / 2 + Math.PI * i / nu, rp: THREE.Vector3[] = [], rn: THREE.Vector3[] = [];
      for (let j = 0; j <= nv; j++) {
        const v = -Math.PI + 2 * Math.PI * j / nv;
        const l = [h[0] * spow(Math.cos(u), e) * spow(Math.cos(v), e), h[1] * spow(Math.cos(u), e) * spow(Math.sin(v), e), h[2] * spow(Math.sin(u), e)];
        const n = [spow(Math.cos(u), 2 - e) * spow(Math.cos(v), 2 - e) / h[0], spow(Math.cos(u), 2 - e) * spow(Math.sin(v), 2 - e) / h[1], spow(Math.sin(u), 2 - e) / h[2]];
        rp.push(c.clone().addScaledVector(ax[0], l[0]).addScaledVector(ax[1], l[1]).addScaledVector(ax[2], l[2]));
        const nn = V(0, 0, 0).addScaledVector(ax[0], n[0]).addScaledVector(ax[1], n[1]).addScaledVector(ax[2], n[2]);
        rn.push(nn.lengthSq() > 1e-12 ? nn.normalize() : ax[2].clone().multiplyScalar(Math.sign(l[2]) || 1));
      }
      P.push(rp); N.push(rn);
    }
    for (let i = 0; i < nu; i++) for (let j = 0; j < nv; j++) {
      const q = [[i, j], [i + 1, j], [i + 1, j + 1], [i, j + 1]];
      const g = (k: number) => P[q[k][0]][q[k][1]], gn = (k: number) => N[q[k][0]][q[k][1]];
      /* chiều quay mặt theo pháp tuyến giải tích (mặt suy biến ở cực bị tri() bỏ) */
      const flip = g(1).clone().sub(g(0)).cross(g(2).clone().sub(g(0))).dot(gn(0).clone().add(gn(2))) < 0
        || (g(1).distanceToSquared(g(0)) < 1e-12 && g(2).clone().sub(g(0)).cross(g(3).clone().sub(g(0))).dot(gn(0).clone().add(gn(2))) < 0);
      const ts = flip ? [[0, 2, 1], [0, 3, 2]] : [[0, 1, 2], [0, 2, 3]];
      for (const t of ts) this.tri(g(t[0]), g(t[1]), g(t[2]), bone, bone, bone, rgb, [gn(t[0]), gn(t[1]), gn(t[2])]);
    }
  }
  /* Dải đai dẹt qua các điểm pts: bề rộng w nằm ngang, bề dày t theo outs (pháp tuyến bề mặt tại từng điểm); bones từng điểm; closed: khép vòng */
  band(pts: THREE.Vector3[], outs: THREE.Vector3[], bones: number[], w: number, t: number, rgb: number[], closed = false): void {
    const n = pts.length, rings: THREE.Vector3[][] = [];
    for (let i = 0; i < n; i++) {
      const prev = pts[closed ? (i - 1 + n) % n : Math.max(0, i - 1)], next = pts[closed ? (i + 1) % n : Math.min(n - 1, i + 1)];
      const tg = next.clone().sub(prev).normalize(), o = outs[i].clone().addScaledVector(tg, -outs[i].dot(tg));
      if (o.lengthSq() < 1e-8) o.copy(Math.abs(tg.y) < 0.9 ? V(0, 1, 0) : V(1, 0, 0)).addScaledVector(tg, -o.dot(tg));
      o.normalize();
      const sd = tg.clone().cross(o).normalize(), p = pts[i];
      rings.push([[1, 1], [-1, 1], [-1, -1], [1, -1]].map(([s, r]) => p.clone().addScaledVector(sd, s * w / 2).addScaledVector(o, r * t / 2)));
    }
    const segs = closed ? n : n - 1;
    for (let i = 0; i < segs; i++) {
      const j = (i + 1) % n, ra = rings[i], rb = rings[j], ref = pts[i].clone().add(pts[j]).multiplyScalar(0.5);
      for (let k = 0; k < 4; k++) this.quad([ra[k], ra[(k + 1) % 4], rb[(k + 1) % 4], rb[k]], [bones[i], bones[i], bones[j], bones[j]], rgb, ref);
    }
  }
  /* Lăng trụ bốn cạnh từ a tới b (dây): mặt cắt w × t; đáy a xương ba, đáy b xương bb */
  prism(a: THREE.Vector3, b: THREE.Vector3, ba: number, bb: number, rgb: number[], w: number, t: number, hint = V(0, 0, 1)): void {
    const d = b.clone().sub(a);
    if (d.length() < 1e-4) return;
    d.normalize();
    let u = hint.clone().sub(d.clone().multiplyScalar(hint.dot(d)));
    if (u.lengthSq() < 1e-6) u = Math.abs(d.y) < 0.9 ? V(0, 1, 0).sub(d.clone().multiplyScalar(d.y)) : V(1, 0, 0).sub(d.clone().multiplyScalar(d.x));
    u.normalize();
    const v = d.clone().cross(u).normalize();
    const ring = (o: THREE.Vector3) => [[1, 1], [-1, 1], [-1, -1], [1, -1]].map(([s, r]) => o.clone().addScaledVector(u, s * w / 2).addScaledVector(v, r * t / 2));
    const ra = ring(a), rb = ring(b), ref = a.clone().add(b).multiplyScalar(0.5);
    for (let k = 0; k < 4; k++) this.quad([ra[k], ra[(k + 1) % 4], rb[(k + 1) % 4], rb[k]], [ba, ba, bb, bb], rgb, ref);
  }
  /* Vòng bầu dục (carabiner) tâm c, mặt phẳng vuông góc nAx, trục dài lAx: nửa trục r1 (dọc lAx), r2; thanh vuông bề dày t, k đoạn */
  ring(c: THREE.Vector3, nAx: THREE.Vector3, lAx: THREE.Vector3, r1: number, r2: number, t: number, k: number, bone: number, rgb: number[]): void {
    const s = nAx.clone().cross(lAx).normalize(), pts: THREE.Vector3[] = [], outs: THREE.Vector3[] = [];
    for (let i = 0; i < k; i++) { const a = 2 * Math.PI * i / k; pts.push(c.clone().addScaledVector(lAx, r1 * Math.cos(a)).addScaledVector(s, r2 * Math.sin(a))); outs.push(nAx.clone()); }
    this.band(pts, outs, pts.map(() => bone), t, t, rgb, true);
  }
  geometry(): THREE.BufferGeometry {
    const g = new THREE.BufferGeometry(), n = this.si.length;
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.nor, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(this.col, 3));
    const idx = new Uint16Array(n * 4), wt = new Float32Array(n * 4);
    for (let i = 0; i < n; i++) { idx[i * 4] = this.si[i]; wt[i * 4] = 1; }
    g.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(idx, 4));
    g.setAttribute('skinWeight', new THREE.Float32BufferAttribute(wt, 4));
    g.userData.spans = this.spans;
    return g;
  }
}

/* Dựng toàn bộ trang bị quanh các vị trí nghỉ của xương */
export function plGearGeometry(rest: PlGearRest): THREE.BufferGeometry {
  const b = new GearBuf(), C = GC.colors, E = GC.round;
  const harness = COL(C.harness), strap = COL(C.strap), pack = COL(C.pack), toggle = COL(C.toggle), line = COL(C.line), metal = COL(C.metal), red = COL(C.reserve);
  const bone = { wing: BI('wing'), hang: BI('hang'), pel: BI('pelvis'), spine: BI('spine'), pack: BI('pack') };
  const X = V(1, 0, 0), Y = V(0, 1, 0), Z = V(0, 0, 1);
  const Pl = VA(rest.pelvis), S = VA(rest.spine), H = VA(rest.hang);
  /* hệ thân: a dọc thân (hông → Spine2), b ra trước vuông góc a trong mặt X-Y, c = +Z; tâm thân lấy z = 0 (đối xứng) */
  const ua = S.clone().sub(Pl); ua.z = 0; if (ua.lengthSq() < 1e-6) ua.set(0, 1, 0); ua.normalize();
  const fb = V(ua.y, -ua.x, 0);
  const T = (a: number, bb: number, c: number) => V(Pl.x, Pl.y, 0).addScaledVector(ua, a).addScaledVector(fb, bb).addScaledVector(Z, c);
  const G = (l: number[]) => V(Pl.x + l[0], Pl.y + l[1], l[2]);   // hệ dù so với xương hông (z tuyệt đối)
  const rot = (a: number) => [V(Math.cos(a), Math.sin(a), 0), V(-Math.sin(a), Math.cos(a), 0), Z.clone()];

  /* Ghế ngồi (nghiêng theo đùi), hai má ghế, hộp dù dự phòng dưới ghế: gắn hông */
  const st = GC.seat, sd = GC.side, rv = GC.reserve;
  b.blob(G(st.c), rot(st.tilt), st.h, E, SEG.seat[0], SEG.seat[1], bone.pel, harness);
  for (const s of [-1, 1]) b.blob(G([sd.c[0], sd.c[1], s * sd.c[2]]), rot(st.tilt), sd.h, E, SEG.side[0], SEG.side[1], bone.pel, harness);
  const rc = G(rv.c);
  b.blob(rc, rot(st.tilt), rv.h, E, SEG.reserve[0], SEG.reserve[1], bone.pel, pack);
  /* quai kéo dù dự phòng: tay nắm đỏ ở mép phải hộp, dải đỏ nối vào hộp */
  const hp = V(rc.x + rv.handle[0], rc.y, rv.handle[1]), hd = GC.handle;
  b.band([V(rc.x - rv.h[0] * hd.back, rc.y + rv.h[1] * hd.up, rv.h[2] + hd.z0), V(hp.x - hd.inX, hp.y, rv.h[2] + hd.z1), hp], [Z, Z, Z], [bone.pel, bone.pel, bone.pel], hd.w, hd.t, red);
  b.blob(hp, [X, Y, Z], rv.handleH, hd.round, SEG.handle[0], SEG.handle[1], bone.pel, red);

  /* Đệm thắt lưng (hông) và ba lô / tấm bảo vệ lưng (xương pack, lắc trễ nhẹ) theo hệ thân */
  const ax = [ua, fb, Z];
  b.blob(T(GC.lumbar.a, GC.lumbar.b, 0), ax, GC.lumbar.h, E, SEG.lumbar[0], SEG.lumbar[1], bone.pel, harness);
  b.blob(T(GC.back.a, GC.back.b, 0), ax, GC.back.h, E, SEG.back[0], SEG.back[1], bone.pack, pack);

  /* Đai vai: sau lưng → đỉnh vai → ngực → bụng (Spine2) → carabiner (hông); carabiner, riser, dây treo */
  const W = GC.strapW, Tk = GC.strapT, sp = GC.shoulder, ca = GC.carabAttach;
  for (const s of [-1, 1]) {
    const c = V(H.x, H.y, s * PG.hang.half);
    const pts = sp.map((q) => T(q[0], q[1], s * q[2]));
    const outs = sp.map((q, i) => (i === 1 ? ua.clone() : fb.clone().multiplyScalar(Math.sign(q[1]) || 1)));
    pts.push(c.clone().add(V(ca.x, GC.carab.h * ca.shoulder, 0))); outs.push(X.clone());
    b.band(pts, outs, pts.map((_, i) => (i < sp.length - 1 ? bone.spine : bone.pel)), W, Tk, strap);
    /* đai hông: từ đáy carabiner vòng ra má ghế */
    b.band([c.clone().add(V(ca.x, -GC.carab.h * ca.shoulder, 0)), G([sd.c[0] + GC.sideAnchor.belt[0], sd.c[1] + sd.h[1] * GC.sideAnchor.belt[1], s * (sd.c[2] + sd.h[2])])], [X, V(0, 0, s)], [bone.pel, bone.pel], W, Tk, strap);
    /* carabiner: vòng bầu dục đứng trong mặt phẳng X-Y */
    b.ring(c, Z, Y, GC.carab.h, GC.carab.w, GC.carab.bar, SEG.carab, bone.pel, metal);
    /* riser: hai nhánh đai dẹt (trước / sau) từ đỉnh carabiner lên đỉnh riser (xương hang, tâm lắc) */
    const top = V(c.x, c.y + PG.riser, c.z);
    for (const dx of [-1, 1]) b.band([c.clone().add(V(dx * ca.riserDx, GC.carab.h * ca.riser, 0)), top.clone().add(V(dx * GC.riserSplit, -ca.riserDrop, 0))], [Z, Z], [bone.pel, bone.hang], GC.riserStrap[0], GC.riserStrap[1], strap);
    /* dây treo: lineCount dây từ đỉnh riser lên cánh */
    for (const t of exLineTops()) if (t.side === s) b.span('line', bone.hang, bone.wing, () => b.prism(top, V(t.x, t.y, t.z), bone.hang, bone.wing, line, GC.lineR * 2, GC.lineR * 2));
  }
  /* đai ngực nối hai đai vai + khóa giữa */
  const cy = GC.chestY, cs = GC.chest, sc = sp[3][2], chestB = (sp[2][1] + sp[3][1]) / 2 + Tk;
  for (const s of [-1, 1]) b.band([T(cy, chestB, s * sc), T(cy, chestB + cs.inset, s * cs.midZ)], [fb, fb], [bone.spine, bone.spine], W * cs.wMul, Tk, strap);
  b.blob(T(cy, chestB + cs.buckleUp, 0), [fb, ua, Z], GC.buckle, GC.buckleRound, SEG.buckle[0], SEG.buckle[1], bone.spine, metal);

  /* Vòng đai đùi quanh từng đùi (vuông góc trục đùi) + khóa phía trên + đai nối lên má ghế */
  for (const s of [-1, 1]) {
    const Tg = VA(s < 0 ? rest.thighL : rest.thighR), kr = s < 0 ? rest.kneeL : rest.kneeR, Kn = kr ? VA(kr) : Tg.clone().add(V(GC.thigh.kneeFb, 0, 0));
    const bt = BI(s < 0 ? 'thighL' : 'thighR');
    const d = Kn.clone().sub(Tg).normalize(), cc = Tg.clone().lerp(Kn, GC.thigh.at);
    const e1 = Z.clone().cross(d).normalize(), e2 = d.clone().cross(e1).normalize();   // e1 ≈ lên, e2 ≈ ngang
    const pts: THREE.Vector3[] = [], outs: THREE.Vector3[] = [];
    for (let i = 0; i < SEG.thigh; i++) { const a = 2 * Math.PI * i / SEG.thigh, o = e1.clone().multiplyScalar(Math.cos(a)).addScaledVector(e2, Math.sin(a)); pts.push(cc.clone().addScaledVector(o, GC.thigh.r)); outs.push(o); }
    b.band(pts, outs, pts.map(() => bt), W, Tk, strap, true);
    b.blob(cc.clone().addScaledVector(e1, GC.thigh.r + GC.buckle[0]), [e1, d, e2], GC.buckle, GC.buckleRound, SEG.buckle[0], SEG.buckle[1], bt, metal);
    b.band([cc.clone().addScaledVector(e2, s * GC.thigh.r).addScaledVector(d, -GC.thigh.link), G([sd.c[0] + sd.h[0] * GC.sideAnchor.thigh[0], sd.c[1] + sd.h[1] * GC.sideAnchor.thigh[1], s * (sd.c[2] + sd.h[2])])], [e2.clone().multiplyScalar(s), V(0, 0, s)], [bt, bone.pel], W, Tk, strap);
  }

  /* Quai phanh ×2 gắn xương bàn tay (thanh ngang lòng bàn tay, trong nắm tay); dây phanh chính từ quai lên điểm tụ (gắn cánh) rồi chia ba nhánh lên mép sau cánh */
  for (const s of [-1, 1]) {
    const hd = s < 0 ? rest.handL : rest.handR, bh = BI(s < 0 ? 'handL' : 'handR');
    const gp = (s < 0 ? rest.gripL : rest.gripR) ?? hd, br = (s < 0 ? rest.barL : rest.barR) ?? [0, 0, 1], fg = (s < 0 ? rest.fingL : rest.fingR) ?? [0, 1, 0];
    const c = VA(gp), axb = VA(br).normalize(), fd = VA(fg).normalize();
    b.prism(c.clone().addScaledVector(axb, -GC.toggleLen), c.clone().addScaledVector(axb, GC.toggleLen), bh, bh, toggle, GC.toggleW, GC.toggleW, fd);
    const tops = exBrakeTops().filter((t) => t.side === s);
    const tx = tops.reduce((a, t) => a + t.x, 0) / tops.length, ty = tops.reduce((a, t) => a + t.y, 0) / tops.length, tz = tops.reduce((a, t) => a + t.z, 0) / tops.length;
    const join = V(c.x + (tx - c.x) * GC.brakeJoin, c.y + (ty - c.y) * GC.brakeJoin, c.z + (tz - c.z) * GC.brakeJoin);
    b.span('brake', bh, bone.wing, () => b.prism(c, join, bh, bone.wing, line, GC.lineR * GC.brakeMul, GC.lineR * GC.brakeMul));
    for (const t of tops) b.prism(join, V(t.x, t.y, t.z), bone.wing, bone.wing, line, GC.lineR * GC.brakeMul, GC.lineR * GC.brakeMul);
  }
  return b.geometry();
}

/* Vật liệu dùng chung: màu theo đỉnh, nhám, không kim loại để cả trang bị vẫn 1 lệnh vẽ. DoubleSide: dải đai mỏng nhìn được cả hai mặt */
let plGearMat: THREE.MeshStandardMaterial | null = null;
export function plGearMaterial(): THREE.MeshStandardMaterial {
  return plGearMat ??= new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.8, metalness: 0.1, side: THREE.DoubleSide });
}

/* Vật mẫu để làm nóng shader trang bị (load.ts): SkinnedMesh một tam giác, vertexColors + khung xương cùng số xương, dùng đúng plGearMaterial() nên chương trình biên dịch trùng chương trình thật.
   Gọi xong thì dispose geometry và skeleton (vật liệu dùng chung, không dispose). Lớp 1 như trang bị thật */
export function plGearWarmObject(): { object: THREE.Object3D; dispose: () => void } {
  const g = new THREE.BufferGeometry(), n = PL_GEAR_BONES.length;
  g.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0, 1, 0, 0, 0, 1, 0], 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute([0, 0, 1, 0, 0, 1, 0, 0, 1], 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute([1, 1, 1, 1, 1, 1, 1, 1, 1], 3));
  g.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(new Uint16Array(12), 4));
  g.setAttribute('skinWeight', new THREE.Float32BufferAttribute([1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0], 4));
  const m = new THREE.SkinnedMesh(g, plGearMaterial());
  const bones = Array.from({ length: n }, () => new THREE.Bone());
  for (const b of bones) m.add(b);
  const sk = new THREE.Skeleton(bones);
  m.bind(sk, new THREE.Matrix4());
  m.frustumCulled = false; m.castShadow = false; m.receiveShadow = false; m.layers.set(1);
  return { object: m, dispose: () => { g.dispose(); sk.dispose(); } };
}

/* ============================ Người treo dù: trang bị bằng code ============================
   Một BufferGeometry có xương (skinIndex / skinWeight) cho SkinnedMesh: đai ngồi, ba lô + hộp dù dự phòng, đai vai / ngực / đùi, khóa, carabiner, riser, quai phanh, dây phanh, dây treo.
   Mỗi đỉnh gắn cứng một xương (trọng số 1). Dây và đai nối hai xương là lăng trụ có đáy một xương, đỉnh một xương nên hai đầu luôn bám dù lẫn người khi xương dịch chuyển.
   Hệ tọa độ: hệ group dù (+X bay, +Y lên, +Z phải); mọi bộ phận dựng theo vị trí nghỉ của xương truyền vào (PlGearRest), không có số tuyệt đối.
   Thuần BufferGeometry, không cần DOM nên test node dùng được. Thông số: CONFIG.explore.pilot.gear. */
import * as THREE from 'three';
import { CONFIG } from '../../config';
import { exLineTops, exBrakeTops } from '../glider';

/* Thứ tự xương = giá trị skinIndex. 'wing' là gốc cánh (đầu trên của dây), 'pack' là ba lô lệch pha với thân */
export const PL_GEAR_BONES = ['wing', 'hang', 'pelvis', 'spine', 'handL', 'handR', 'thighL', 'thighR', 'pack'] as const;
/* Đoạn đỉnh của một dây trong geometry: kind 'line' (dây treo) hoặc 'brake' (nhánh dây phanh); ba / bb = xương hai đầu; geometry.userData.spans */
export interface PlGearSpan { kind: 'line' | 'brake'; ba: number; bb: number; start: number; count: number }
export interface PlGearRest { hang: number[]; pelvis: number[]; spine: number[]; handL: number[]; handR: number[]; thighL: number[]; thighR: number[] }   // vị trí nghỉ từng xương trong hệ group dù, m

const PG = CONFIG.explore.pilot, GC = PG.gear;
const BI = (n: typeof PL_GEAR_BONES[number]): number => PL_GEAR_BONES.indexOf(n);
const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);
const COL = (hex: string): number[] => { const c = new THREE.Color(hex); return [c.r, c.g, c.b]; };

/* Bộ gom đỉnh không chỉ số: mỗi tam giác có pháp tuyến phẳng, màu và xương theo đỉnh */
class GearBuf {
  pos: number[] = []; nor: number[] = []; col: number[] = []; si: number[] = [];
  spans: PlGearSpan[] = [];   // đoạn đỉnh của từng dây (test dùng để kiểm hai đầu hai xương)
  /* Chạy f rồi ghi lại đoạn đỉnh nó sinh ra: dây treo / nhánh dây phanh */
  span(kind: PlGearSpan['kind'], ba: number, bb: number, f: () => void): void {
    const start = this.si.length; f(); this.spans.push({ kind, ba, bb, start, count: this.si.length - start });
  }
  /* Một tam giác; ba xương theo ba đỉnh */
  tri(a: THREE.Vector3, b: THREE.Vector3, c: THREE.Vector3, ba: number, bb: number, bc: number, rgb: number[]): void {
    const n = b.clone().sub(a).cross(c.clone().sub(a));
    if (n.lengthSq() < 1e-14) return;
    n.normalize();
    for (const [p, bone] of [[a, ba], [b, bb], [c, bc]] as [THREE.Vector3, number][]) {
      this.pos.push(p.x, p.y, p.z); this.nor.push(n.x, n.y, n.z); this.col.push(rgb[0], rgb[1], rgb[2]); this.si.push(bone);
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
  /* Hộp theo trục tọa độ, tâm c, nửa kích thước h, một xương */
  box(c: THREE.Vector3, h: number[], bone: number, rgb: number[]): void {
    for (let ax = 0; ax < 3; ax++) {
      const u = (ax + 1) % 3, v = (ax + 2) % 3;
      for (const sg of [-1, 1]) {
        const q: THREE.Vector3[] = [];
        for (const [su, sv] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
          const o = [0, 0, 0]; o[ax] = sg * h[ax]; o[u] = su * h[u]; o[v] = sv * h[v];
          q.push(V(c.x + o[0], c.y + o[1], c.z + o[2]));
        }
        this.quad(q, [bone, bone, bone, bone], rgb, c);
      }
    }
  }
  /* Lăng trụ bốn cạnh từ a tới b: mặt cắt w × t, w dọc theo hint (đã chiếu vuông góc trục); đáy a gắn xương ba, đáy b gắn xương bb. Dây: w = t = 2·bán kính */
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
  const b = new GearBuf(), C = GC.colors, bd = GC.body, gap = GC.gap, sc = GC.seat, bk = GC.back, cs = GC.chest, rv = GC.reserve, tr = GC.thighRing;
  const harness = COL(C.harness), strap = COL(C.strap), pack = COL(C.pack), toggle = COL(C.toggle), line = COL(C.line), metal = COL(C.metal), red = COL(C.reserve);
  const H = rest.hang, Pl = rest.pelvis, S = rest.spine;
  const bone = { wing: BI('wing'), hang: BI('hang'), pel: BI('pelvis'), spine: BI('spine'), pack: BI('pack') };
  const tc = S[0], py = Pl[1];                              // tâm thân theo X, cao độ hông
  const backX = tc - bd.chestDepth / 2 - gap, frontX = tc + bd.chestDepth / 2 + gap;   // mặt lưng / mặt ngực cộng khe hở
  const sz = bd.shoulderHalf - cs.shoulderInset, W = GC.strapW, T = GC.strapT, X = V(1, 0, 0), Y = V(0, 1, 0), Z = V(0, 0, 1);

  /* Đai ngồi kiểu ghế: tấm ngồi, hai má hông, tấm lưng dưới (hông) và trên (cột sống) */
  b.box(V(Pl[0] + sc.x, py + sc.y, 0), [sc.hx, sc.hy, bd.hipWidth / 2 + sc.zExtra], bone.pel, harness);
  for (const s of [-1, 1]) b.box(V(Pl[0] + sc.cheekX, py + sc.cheekY, s * (bd.hipWidth / 2 + gap + sc.cheekZ)), sc.cheekH, bone.pel, harness);
  b.box(V(backX + bk.x, py + bk.lowY, 0), bk.lowH, bone.pel, harness);
  b.box(V(backX + bk.x, py + bk.upY, 0), bk.upH, bone.spine, harness);

  /* Ba lô sau lưng (xương pack lệch pha), hộp dù dự phòng dưới ghế, quai kéo dù dự phòng màu đỏ */
  const gp = GC.pack;
  b.box(V(backX - bk.packX - gp.depth / 2, py + bk.lowY + gp.height / 2, 0), [gp.depth / 2, gp.height / 2, gp.width / 2], bone.pack, pack);
  b.box(V(Pl[0] + rv.x, py + rv.y - gp.reserveH / 2, 0), [rv.hx, gp.reserveH / 2, rv.hz], bone.pack, pack);
  const ry = py + rv.y - gp.reserveH / 2;
  b.prism(V(Pl[0], ry, rv.hz), V(Pl[0] + rv.pull[0], ry, rv.pull[1]), bone.pack, bone.pack, red, rv.pullW, rv.pullT, Y);
  b.box(V(Pl[0] + rv.pull[2], ry, rv.pull[3]), rv.pullH, bone.pack, red);

  /* Đai vai: từ lưng qua vai, xuống ngực, tới mép trước ghế; đai nối từ vai tới carabiner */
  for (const s of [-1, 1]) {
    const back = V(backX, py + bd.shoulderUp - cs.backDrop, s * sz), top = V(tc, py + bd.shoulderUp + cs.topRise + gap, s * sz), front = V(frontX, py + cs.y, s * sz);
    const seatF = V(Pl[0] + sc.strapX, py + sc.strapY, s * (bd.hipWidth / 2 - sc.strapZ));
    b.prism(back, top, bone.spine, bone.spine, strap, W, T, Z);
    b.prism(top, front, bone.spine, bone.spine, strap, W, T, Z);
    b.prism(front, seatF, bone.spine, bone.pel, strap, W, T, Z);
    /* Carabiner: khung chữ nhật trong mặt phẳng X-Y ở điểm treo, gắn đai ngồi; riser từ móc lên điểm tụ dây (đầu trên gắn xương hang) */
    const c = V(H[0], H[1], s * PG.hang.half), cw = GC.carab.w / 2, ch = GC.carab.h / 2, cb = GC.carab.bar;
    const k = [V(c.x + cw, c.y + ch, c.z), V(c.x - cw, c.y + ch, c.z), V(c.x - cw, c.y - ch, c.z), V(c.x + cw, c.y - ch, c.z)];
    for (let i = 0; i < 4; i++) b.prism(k[i], k[(i + 1) % 4], bone.pel, bone.pel, metal, cb, cb);
    b.prism(top, V(c.x - cw, c.y + ch, c.z), bone.spine, bone.pel, strap, W, T, Z);
    const riserTop = V(c.x, c.y + PG.riser, c.z);
    b.prism(V(c.x, c.y + ch, c.z), riserTop, bone.pel, bone.hang, strap, W * 0.8, T, X);
    /* Dây treo: lineCount dây từ đầu riser lên cánh */
    for (const t of exLineTops()) if (t.side === s) b.span('line', bone.hang, bone.wing, () => b.prism(riserTop, V(t.x, t.y, t.z), bone.hang, bone.wing, line, GC.lineR * 2, GC.lineR * 2));
  }

  /* Đai ngực (hai nửa, chừa khe cho khóa) + khóa kim loại */
  for (const s of [-1, 1]) b.prism(V(frontX + cs.x, py + cs.y, s * sz), V(frontX + cs.x, py + cs.y, s * cs.gapHalf), bone.spine, bone.spine, strap, W * 0.8, T, Y);
  b.box(V(frontX + cs.buckleX, py + cs.y, 0), cs.buckleH, bone.spine, metal);

  /* Đai đùi: vòng tám cạnh quanh đùi (gắn xương đùi), đai nối tới mép ghế, khóa ở phía trên */
  for (const s of [-1, 1]) {
    const Tg = s < 0 ? rest.thighL : rest.thighR, bt = BI(s < 0 ? 'thighL' : 'thighR');
    const r = bd.thighR + gap + T, cx = Tg[0] + tr.x, cy = Tg[1] + tr.y, cz = Tg[2];
    const ring: THREE.Vector3[] = [];
    for (let i = 0; i < 8; i++) { const an = i * Math.PI / 4; ring.push(V(cx, cy + r * Math.cos(an), cz + r * Math.sin(an))); }
    for (let i = 0; i < 8; i++) b.prism(ring[i], ring[(i + 1) % 8], bt, bt, strap, W, T, X);
    b.prism(V(Pl[0] + tr.strapX, py + tr.strapY, s * (bd.hipWidth / 2 + tr.strapZ)), V(cx, cy + r * 0.7071, cz + s * r * 0.7071), bone.pel, bt, strap, W, T, Y);
    b.box(V(cx, cy + r + tr.buckleLift, cz), tr.buckleH, bt, metal);
  }

  /* Quai phanh ×2 gắn xương bàn tay; dây phanh tụ về một điểm trên quai rồi chia ba nhánh lên mép sau cánh */
  for (const s of [-1, 1]) {
    const hd = s < 0 ? rest.handL : rest.handR, bh = BI(s < 0 ? 'handL' : 'handR');
    const hp = V(hd[0], hd[1], hd[2]), join = V(hd[0], hd[1] + GC.brakeJoin, hd[2]);
    b.prism(V(hd[0], hd[1], hd[2] - GC.toggleLen), V(hd[0], hd[1], hd[2] + GC.toggleLen), bh, bh, toggle, GC.toggleW, GC.toggleW);
    b.prism(hp, join, bh, bh, line, GC.lineR * 2, GC.lineR * 2);
    for (const t of exBrakeTops()) if (t.side === s) b.span('brake', bh, bone.wing, () => b.prism(join, V(t.x, t.y, t.z), bh, bone.wing, line, GC.lineR * 2, GC.lineR * 2));
  }
  return b.geometry();
}

/* Vật liệu dùng chung: màu theo đỉnh, nhám, không kim loại để cả trang bị vẫn 1 lệnh vẽ. DoubleSide vì đai và dây là lăng trụ không nắp */
let plGearMat: THREE.MeshStandardMaterial | null = null;
export function plGearMaterial(): THREE.MeshStandardMaterial {
  return plGearMat ??= new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.75, metalness: 0.1, side: THREE.DoubleSide });
}

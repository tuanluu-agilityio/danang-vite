import * as THREE from 'three';
import { CONFIG } from '../../config';
import { boxAt, beamBetween, prepColored } from '../../common/geometry';
import { SW } from './profile';

type Color3 = [number, number, number];

/* ===== Phần tĩnh: quảng trường, bệ + nhà ga, hai tháp đầu bệ + lầu, giàn tháp đỡ, trục =====
   Mọi hình học trả về đã tô màu theo đỉnh (prepColored) để gộp MỘT mesh với vật liệu bê tông (một draw call cho cả phần tĩnh).
   Hệ cục bộ: X dọc mặt vòng quay, Z theo trục quay (+Z mặt Nam Đông Nam, có quảng trường), y là cao độ thế giới. */

const C_WALL: Color3 = [1, 1, 1], C_DARK: Color3 = [0.16, 0.16, 0.17], C_ROOF: Color3 = [0.72, 0.17, 0.12], C_GOLD: Color3 = [1.05, 0.76, 0.26];
const C_GREEN: Color3 = [0.3, 0.5, 0.24], C_PAVE: Color3 = [0.82, 0.8, 0.76], C_STEEL: Color3 = [1.08, 1.08, 1.1], C_POST: Color3 = [0.35, 0.35, 0.36];
const col = (g: THREE.BufferGeometry, c: Color3) => prepColored(g, () => c);
/* thuộc tính aLit cho shader LED (ledShow.ts): 0 không sáng, 1 giàn thép được chiếu trắng, 2 đèn cột quảng trường; phần nào thiếu thì gán 0 trước khi gộp */
export const SW_LIT = { none: 0, flood: 1, lamp: 2 };
export function swLit(g: THREE.BufferGeometry, v: number) {
  g.setAttribute('aLit', new THREE.BufferAttribute(new Float32Array(g.attributes.position.count).fill(v), 1));
  return g;
}
const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);

/* vòm cuốn tối trên mặt tường z = zf (hướng ra ngoài theo dấu s): ô chữ nhật + nửa đĩa trên đỉnh */
function swArch(x: number, y0: number, zf: number, s: number, w: number, h: number, out: THREE.BufferGeometry[]) {
  const rect = h - w / 2;
  out.push(col(boxAt(w, rect, 0.3, x, y0 + rect / 2, zf + s * 0.15), C_DARK));
  const top = new THREE.CylinderGeometry(w / 2, w / 2, 0.3, 16, 1, false, -Math.PI / 2, Math.PI).rotateX(-Math.PI / 2);
  out.push(col(top.translate(x, y0 + rect, zf + s * 0.15), C_DARK));
}

/* nón bốn mặt (mái lầu) cao h, cạnh đáy ≈ w, đáy ở y */
const swRoof = (w: number, h: number, x: number, y: number, z: number) =>
  col(new THREE.ConeGeometry(w * 0.72, h, 4, 1).rotateY(Math.PI / 4).translate(x, y + h / 2, z), C_ROOF);

/* bệ + nhà ga + hai tháp + lầu + quảng trường + cổng vòm vàng + cột đèn */
export function swBuildBase(out: THREE.BufferGeometry[]) {
  const y0 = CONFIG.landY, H = SW.baseH, L = SW.baseLen, D = SW.baseDepth, S = SW.station;
  const yTop = y0 + H;
  // khối bệ: tường trắng, ốp đá xám hai mặt dài giữa hai tháp, vòm cuốn tối, trụ ốp trắng giữa các vòm
  out.push(col(boxAt(L, H, D, 0, y0 + H / 2, 0), C_WALL));
  const inner = L - 2 * S.towerW;
  for (const s of [1, -1]) {
    const zf = s * D / 2;
    out.push(col(boxAt(inner, H - 2.5, 0.3, 0, y0 + 1 + (H - 2.5) / 2, zf + s * 0.15), [S.panel, S.panel, S.panel * 1.02]));
    for (const k of [-1, 0, 1]) swArch(k * S.archX, y0, zf + s * 0.3, s, S.archW, S.archH, out);
    for (const x of [-1.5, -0.5, 0.5, 1.5]) out.push(col(boxAt(1.4, H - 1.5, 0.8, x * S.archX, y0 + (H - 1.5) / 2, zf + s * 0.4), C_WALL));
    out.push(col(boxAt(L, 1.2, 1.2, 0, yTop - 0.4, zf + s * 0.2), C_WALL));   // gờ mái
  }
  // bồn cây trên sàn mái (nơi lên cabin), tránh dải giữa nơi vòng quay đi qua
  const nP = S.deckPlanters / 2;
  for (let i = 0; i < nP; i++) {
    const x = (i - (nP - 1) / 2) * (inner - 10) / Math.max(1, nP - 1);
    for (const s of [1, -1]) out.push(col(boxAt(5, 2.2, 2.4, x, yTop + 1.1, s * (D / 2 - 2.5)), C_GREEN));
  }
  // hai tháp vuông đầu bệ: ốp đá, ô tròn sáng, gờ đỉnh; lầu hai tầng mái đỏ
  const P = SW.pavilion;
  for (const sx of [-1, 1]) {
    const x = sx * (L / 2 - S.towerW / 2);
    out.push(col(boxAt(S.towerW, S.towerH, D + 1, x, y0 + S.towerH / 2, 0), C_WALL));
    for (const s of [1, -1]) {
      const zf = s * (D + 1) / 2;
      out.push(col(boxAt(S.towerW - 3, S.towerH - 4, 0.3, x, y0 + 1 + (S.towerH - 4) / 2, zf + s * 0.15), [S.panel, S.panel, S.panel * 1.02]));
      out.push(col(new THREE.CylinderGeometry(1.9, 1.9, 0.5, 20).rotateX(Math.PI / 2).translate(x, y0 + S.towerH * 0.6, zf + s * 0.35), C_WALL));
    }
    const yt = y0 + S.towerH;
    out.push(col(boxAt(S.towerW + 1, 0.8, D + 2, x, yt + 0.4, 0), C_WALL));
    out.push(col(boxAt(P.w, P.h1, P.w, x, yt + 0.8 + P.h1 / 2, 0), [0.9, 0.88, 0.84]));
    const yr1 = yt + 0.8 + P.h1;
    out.push(swRoof(P.w + 3, P.roof1, x, yr1, 0));
    out.push(col(boxAt(P.w * 0.6, P.h2, P.w * 0.6, x, yr1 + P.roof1 * 0.55 + P.h2 / 2, 0), [0.9, 0.88, 0.84]));
    out.push(swRoof(P.w * 0.6 + 2.5, P.roof2, x, yr1 + P.roof1 * 0.55 + P.h2, 0));
  }
  // quảng trường lát đá phía mặt Nam + cột đèn hai bên
  const Q = SW.plaza, zq = D / 2 + Q.depth / 2;
  out.push(col(boxAt(Q.len, 0.3, Q.depth, 0, y0 + 0.15, zq), C_PAVE));
  const nl = SW.lamps.n / 2;
  for (let i = 0; i < nl; i++) for (const sx of [-1, 1]) {
    const x = sx * (Q.len / 2 - 5), z = D / 2 + Q.depth * (i + 0.5) / nl;
    out.push(col(boxAt(0.35, SW.lamps.h, 0.35, x, y0 + SW.lamps.h / 2, z), C_POST));
    out.push(swLit(col(boxAt(1.2, 0.5, 0.6, x, y0 + SW.lamps.h, z), C_WALL), SW_LIT.lamp));
  }
  // cổng vòm vàng (sân khấu) giữa mặt Nam
  const G = SW.gate, zg = D / 2 + G.stageD / 2 + 0.3;
  out.push(col(boxAt(G.r * 2 + 4, 1.2, G.stageD, 0, y0 + 0.6, zg), [0.7, 0.68, 0.65]));
  out.push(col(new THREE.TorusGeometry(G.r, G.tube, 8, 32, Math.PI).translate(0, y0 + 1.2, D / 2 + 1.2), C_GOLD));
  out.push(col(new THREE.TorusGeometry(G.r - 1.6, G.tube * 0.6, 6, 32, Math.PI).translate(0, y0 + 1.2, D / 2 + 1.2), C_GOLD));
}

/* giàn tháp đỡ hình thang hai bên mặt vòng quay + trụ đứng giữa + gối trục + trục tĩnh */
export function swBuildLegs(out: THREE.BufferGeometry[]) {
  const G = SW.legs, yb = CONFIG.landY + SW.baseH, yt = SW.hubY - 1.5;
  const lerp = (a: THREE.Vector3, b: THREE.Vector3, t: number) => a.clone().lerp(b, t);
  const levels = [0]; for (let k = 1; k <= G.tiers; k++) levels.push(k / (G.tiers + 1));
  const n0 = out.length;
  for (const s of [1, -1]) {
    const L0 = V(-G.xBot, yb, s * G.zBot), L1 = V(-G.xTop, yt, s * G.zTop);
    const R0 = V(G.xBot, yb, s * G.zBot), R1 = V(G.xTop, yt, s * G.zTop);
    const C0 = V(0, yb, s * G.zBot), C1 = V(0, yt, s * G.zTop);
    const Lt = (t: number) => lerp(L0, L1, t), Rt = (t: number) => lerp(R0, R1, t), Ct = (t: number) => lerp(C0, C1, t);
    out.push(col(beamBetween(L0, L1, G.w, G.w), C_STEEL), col(beamBetween(R0, R1, G.w, G.w), C_STEEL), col(beamBetween(C0, C1, G.w * 0.8, G.w * 0.8), C_STEEL));
    levels.forEach((t, i) => {
      if (i > 0) out.push(col(beamBetween(Lt(t), Rt(t), G.brace, G.brace), C_STEEL));
      const t2 = levels[i + 1] ?? 1;
      for (const side of [Lt, Rt]) {
        out.push(col(beamBetween(side(t), Ct(t2), G.brace * 0.7, G.brace * 0.7), C_STEEL));
        out.push(col(beamBetween(Ct(t), side(t2), G.brace * 0.7, G.brace * 0.7), C_STEEL));
      }
    });
    out.push(col(boxAt(2 * G.xTop + 2.5, 3.2, 3.2, 0, SW.hubY, s * G.zTop), C_STEEL));   // gối trục
  }
  out.push(col(new THREE.CylinderGeometry(SW.axle.r, SW.axle.r, SW.axle.len, 16).rotateX(Math.PI / 2).translate(0, SW.hubY, 0), C_STEEL));
  for (let i = n0; i < out.length; i++) swLit(out[i], SW_LIT.flood);   // cả giàn, gối và trục được chiếu trắng ban đêm
}

/* biển "SUN WHEEL" dưới moay-ơ, mặt Nam (trước trụ giữa của giàn phía Nam) */
export function swSignGeometry() {
  const G = SW.legs, y = SW.hubY - SW.sign.below;
  const t = (y - CONFIG.landY - SW.baseH) / (SW.hubY - 1.5 - CONFIG.landY - SW.baseH);
  return new THREE.PlaneGeometry(SW.sign.w, SW.sign.h).translate(0, y, G.zBot + (G.zTop - G.zBot) * t + 1.2);
}

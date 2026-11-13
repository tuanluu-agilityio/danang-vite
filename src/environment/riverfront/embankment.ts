import * as THREE from 'three';
import { CONFIG } from '../../config';
import { RF_MARINA_Z, rfBlocked } from './promenade';

/* [embankment] Chi tiết kè đá hai bờ (M3 Task 3.4): mũ kè, chân kè hai bậc sát mép nước, trụ kè (gờ đứng), bậc thềm xuống nước, cọc neo.
   Trả về danh sách hình học để river.ts gộp vào lưới kè MAT.stone: +0 lệnh vẽ, không thêm vật liệu, không dùng rand() / rng().
   Chừa chân cầu, hành lang hầm (rfBlocked), bến du thuyền bờ Tây và Cầu Tình Yêu bờ Đông. Bọt mép kè của shader nước lùi ra theo bề rộng chân kè (waterShader.ts TOE). */
const B = CONFIG.bankX, Y = CONFIG.landY, R = CONFIG.riverfront, E = R.embankment;
const WALL_LEN = 16600, WALL_H = 6;   // m — chiều dài / cao của khối kè gốc trong river.ts: UV tính theo đó để vân đá cùng cỡ với tường kè (stoneMap lặp 1200 lần theo chiều dài)

/* Chỗ đặt được chi tiết kè ở bờ sd (−1 Tây, +1 Đông) tại z */
const rfBankFree = (sd: number, z: number, pad = E.pad) => !rfBlocked(z, pad)
  && !(sd < 0 && Math.abs(z - RF_MARINA_Z) < 30 + pad)
  && !(sd > 0 && Math.abs(z - R.love.z) < R.love.width / 2 + pad);

/* UV theo tọa độ thế giới và hướng mặt (hình hộp / trụ có UV 0..1 mỗi mặt, sẽ bị lặp 1200 lần nếu để nguyên) */
function rfStoneUV(g: THREE.BufferGeometry) {
  const p = g.attributes.position, n = g.attributes.normal, uv = g.attributes.uv;
  for (let i = 0; i < p.count; i++) {
    const zf = Math.abs(n.getZ(i)) > 0.7, top = Math.abs(n.getY(i)) > 0.7;
    uv.setXY(i, (zf ? p.getX(i) : p.getZ(i)) / WALL_LEN, top ? p.getX(i) / WALL_H : (p.getY(i) + 3) / WALL_H);
  }
  return g;
}

/* Các đoạn kè liên tục [z0, z1] của bờ sd giữa những chỗ phải chừa (bước dò 2 m), và tim các cụm bậc thềm nằm trọn trong từng đoạn */
type RfRun = { r0: number; r1: number; stairs: number[] };
const runCache: Record<number, RfRun[]> = {};
function rfRuns(sd: number): RfRun[] {
  if (runCache[sd]) return runCache[sd];
  const zA = sd < 0 ? E.z0 : Math.max(E.z0, -2300), runs: RfRun[] = []; let a: number | null = null;
  for (let z = zA; z <= E.z1 + 1e-6; z += 2) {
    const ok = z < E.z1 && rfBankFree(sd, z);
    if (ok && a === null) a = z;
    if (!ok && a !== null) { if (z - 2 - a >= 4) runs.push({ r0: a, r1: z - 2, stairs: [] }); a = null; }
  }
  for (const r of runs) for (let z = Math.ceil(r.r0 / E.stairStep) * E.stairStep + E.stairStep / 2 * (sd < 0 ? 0 : 1); z < r.r1; z += E.stairStep) {
    if (z - E.stairLen / 2 >= r.r0 + 2 && z + E.stairLen / 2 <= r.r1 - 2) r.stairs.push(z);
  }
  return runCache[sd] = runs;
}
/* Khoảng mở [z0, z1] của lan can kè trước từng cụm bậc thềm ở bờ sd: promenade.ts bỏ tay vịn ở đây để bậc thềm thông với dải đi bộ */
export function rfStairGaps(sd: number): [number, number][] {
  return rfRuns(sd).flatMap((r) => r.stairs.map((z): [number, number] => [z - E.stairLen / 2, z + E.stairLen / 2]));
}

export function rfEmbankmentGeos(): THREE.BufferGeometry[] {
  const out: THREE.BufferGeometry[] = [];
  /* hộp theo khoảng cách d tới mặt kè (d > 0 là ra phía sông, d < 0 là vào bờ) */
  const slab = (sd: number, d0: number, d1: number, z0: number, z1: number, y0: number, y1: number) => {
    const g = new THREE.BoxGeometry(d1 - d0, y1 - y0, z1 - z0); g.translate(sd * (B - (d0 + d1) / 2), (y0 + y1) / 2, (z0 + z1) / 2); out.push(rfStoneUV(g));
  };
  const [sRun, sRise, sN] = E.stair, top = Y + 0.5;
  for (const sd of [-1, 1]) {
    for (const { r0, r1, stairs } of rfRuns(sd)) {
      slab(sd, -2.12, E.cope[0], r0, r1, top, top + E.cope[1]);                                      // mũ kè
      for (const [w, h] of E.toe) slab(sd, 0, w, r0, r1, -3, h);                                     // chân kè hai bậc
      // bậc thềm xuống nước: mỗi stairStep một cụm, nằm trọn trong đoạn (rfRuns)
      for (const z of stairs) {
        for (let k = 0; k < sN; k++) slab(sd, k * sRun, (k + 1) * sRun, z - E.stairLen / 2, z + E.stairLen / 2, -3, Y - k * sRise);
        for (const e of [-1, 1]) slab(sd, 0, sN * sRun, z + e * (E.stairLen / 2 + 0.2) - 0.2, z + e * (E.stairLen / 2 + 0.2) + 0.2, -3, Y + 0.3);   // tường má hai bên bậc thềm
      }
      const nearStair = (z: number, pad: number) => stairs.some((s) => Math.abs(z - s) < E.stairLen / 2 + pad);
      // trụ kè: gờ đứng từ chân kè lên mũ
      for (let z = Math.ceil((r0 + 1) / E.pierStep) * E.pierStep; z < r1 - 1; z += E.pierStep) {
        if (!nearStair(z, 1.5)) slab(sd, 0, E.pier[1], z - E.pier[0] / 2, z + E.pier[0] / 2, E.toe[0][1], top);
      }
      // cọc neo trên mũ kè, phía sông của lan can
      for (let z = Math.ceil((r0 + 1) / E.bollardStep) * E.bollardStep + E.pierStep / 2; z < r1 - 1; z += E.bollardStep) {
        if (nearStair(z, 1)) continue;
        // cọc neo dạng nấm: thân thon (ống hở hai đầu) + mũ loe; cỡ cọc bích thật để còn thấy từ tầm đi bộ và từ thuyền
        const [br, bh, hr, hh] = E.bollard, y0 = top + E.cope[1];
        out.push(rfStoneUV(new THREE.CylinderGeometry(br * 0.8, br, bh, 6, 1, true).translate(sd * (B + 0.4), y0 + bh / 2, z)));
        out.push(rfStoneUV(new THREE.CylinderGeometry(hr, hr * 0.85, hh, 6).translate(sd * (B + 0.4), y0 + bh + hh / 2, z)));
      }
    }
  }
  return out;
}

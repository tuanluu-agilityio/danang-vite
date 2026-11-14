/* ===== Xe máy: test thân va chạm đổi được (drUseBody trong src/explore/drive/collide.ts) =====
   (a) thân ô tô cho đúng kết quả cũ (chép ca "trượt dọc tường" của tests/drive-unit/collide.test.ts), (b) khe 1,2 m: ô tô không lọt, xe máy lọt,
   (c) đổi sang xe máy rồi về ô tô vẫn cho kết quả cũ. Mỗi test trả thân về ô tô. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CONFIG } from '../../src/config.ts';
import { drMakeNet, type DrPad, type DrSolid } from '../../src/explore/drive/net.ts';
import { drFits, drMove, drUseBody, DR_CAR_BODY, type DrPose, type DrBox } from '../../src/explore/drive/collide.ts';
import { BK_BODY } from '../../src/explore/bike/motion.ts';

const HL = CONFIG.drive.car.length / 2, HW = CONFIG.drive.car.width / 2;
const pad = (id: string, x0: number, x1: number, z0: number, z1: number, y: number): DrPad => ({ id, kind: 'road', x0, x1, z0, z1, y: () => y });
const wall = (x0: number, x1: number, z0: number, z1: number, y0: number, y1: number): DrSolid => ({ kind: 'rect', x0, x1, z0, z1, y0, y1 });
const pose = (x: number, y: number, z: number, yaw: number): DrPose => ({ x, y, z, yaw });
const NONE: DrBox[] = [], IGN = new Uint8Array(8);

/* Chép nguyên ca "trượt dọc tường" của collide.test.ts */
function slideAlongWall(): void {
  const net = drMakeNet([pad('a', 0, 100, 0, 40, 2.6)], [wall(0, 100, 30, 31, 2.6, 4)]);
  const yaw = -20 * Math.PI / 180;
  const p = pose(20, 2.6, 27, yaw), out = pose(0, 0, 0, 0);
  assert.ok(drFits(net, p, NONE, 0, IGN));
  const f = drMove(net, p, 10, 0, NONE, 0, out);
  assert.ok(f < 1, 'phải chạm tường');
  assert.ok(f > 0.5, `trượt chứ không đứng hẳn (f = ${f})`);
  assert.ok(out.x > 20 + 5, `tọa độ dọc tường tăng (x = ${out.x})`);
  assert.ok(drFits(net, out, NONE, 0, IGN), 'không xuyên tường');
  const zMax = out.z + HL * Math.sin(-yaw) + HW * Math.cos(yaw);
  assert.ok(zMax <= 30 + 1e-6, `góc xe không lấn tường (zMax = ${zMax})`);
}

test('thân ô tô: kết quả như cũ', () => {
  try { drUseBody(DR_CAR_BODY); slideAlongWall(); } finally { drUseBody(DR_CAR_BODY); }
});

test('khe 1,2 m: ô tô không lọt, xe máy lọt', () => {
  try {
    const net = drMakeNet([pad('a', -50, 50, -20, 20, 2.6)], [wall(10, 12, -10, -0.6, 2.6, 4), wall(10, 12, 0.6, 10, 2.6, 4)]);
    const p = pose(11, 2.6, 0, 0);
    assert.equal(DR_CAR_BODY.hw * 2, CONFIG.drive.car.width);
    assert.equal(BK_BODY.hw * 2, CONFIG.bike.body.width);
    drUseBody(DR_CAR_BODY);
    assert.ok(!drFits(net, p, NONE, 0, IGN), 'ô tô rộng 1,679 m không lọt khe 1,2 m');
    drUseBody(BK_BODY);
    assert.ok(drFits(net, p, NONE, 0, IGN), 'xe máy rộng 0,74 m lọt khe 1,2 m');
    /* đi xuyên khe từ ngoài vào cũng được trọn quãng */
    const out = pose(0, 0, 0, 0);
    assert.equal(drMove(net, pose(0, 2.6, 0, 0), 20, 0, NONE, 0, out), 1);
  } finally { drUseBody(DR_CAR_BODY); }
});

test('đổi sang xe máy rồi về ô tô: kết quả như cũ', () => {
  try { drUseBody(BK_BODY); drUseBody(DR_CAR_BODY); slideAlongWall(); } finally { drUseBody(DR_CAR_BODY); }
});

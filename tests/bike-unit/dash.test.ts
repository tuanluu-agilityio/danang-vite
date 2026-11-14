/* ===== Xe máy: mặt đồng hồ (src/explore/bike/dash.ts bkDashDraw) =====
   Canvas giả ghi lệnh vẽ (đường đi, màu lúc fill / stroke, chữ): kim tốc độ ở 0 và 100 km/h khác góc; xi nhan trái sáng ⇒ mũi tên ở nửa trái, tắt ⇒ không có. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { bkDashDraw, BK_DASH_NEEDLE, BK_DASH_SIG } from '../../src/explore/bike/dash.ts';

interface Op { kind: 'fill' | 'stroke'; style: string; pts: [number, number][] }
function fakeCtx(): { g: CanvasRenderingContext2D; ops: Op[]; texts: string[] } {
  const ops: Op[] = [], texts: string[] = [];
  let pts: [number, number][] = [];
  const g = {
    fillStyle: '', strokeStyle: '', lineWidth: 1, font: '', textAlign: 'left', textBaseline: 'alphabetic', lineCap: 'butt', globalAlpha: 1,
    beginPath() { pts = []; }, closePath() {},
    moveTo(x: number, y: number) { pts.push([x, y]); }, lineTo(x: number, y: number) { pts.push([x, y]); },
    arc(x: number, y: number) { pts.push([x, y]); },
    fill() { ops.push({ kind: 'fill', style: String(g.fillStyle), pts: pts.slice() }); },
    stroke() { ops.push({ kind: 'stroke', style: String(g.strokeStyle), pts: pts.slice() }); },
    fillRect() {}, clearRect() {},
    fillText(t: string) { texts.push(t); }
  };
  return { g: g as unknown as CanvasRenderingContext2D, ops, texts };
}

const W = 256, H = 256;
function needleAngle(kmh: number): number {
  const { g, ops } = fakeCtx();
  bkDashDraw(g, W, H, kmh, 3000, 0, false, 0);
  const n = ops.filter((o) => o.kind === 'stroke' && o.style === BK_DASH_NEEDLE);
  assert.equal(n.length, 1, 'một kim');
  const [x, y] = n[0].pts[n[0].pts.length - 1];
  return Math.atan2(y - H / 2, x - W / 2);
}

test('kim ở 0 và 100 km/h khác góc; số tốc độ hiện ra chữ', () => {
  const a0 = needleAngle(0), a1 = needleAngle(100);
  let d = Math.abs(a1 - a0); if (d > Math.PI) d = 2 * Math.PI - d;
  assert.ok(d > 1, `lệch ${d}`);
  const { g, texts } = fakeCtx();
  bkDashDraw(g, W, H, 57, 4000, 0, false, 1);
  assert.ok(texts.includes('57'), `chữ ${texts.join(',')}`);
});

test('xi nhan trái + nháy sáng ⇒ mũi tên trái; nháy tắt ⇒ không; phải ⇒ nửa phải', () => {
  const arrows = (sig: -1 | 0 | 1, blink: boolean) => { const { g, ops } = fakeCtx(); bkDashDraw(g, W, H, 30, 3000, sig, blink, 0.5); return ops.filter((o) => o.kind === 'fill' && o.style === BK_DASH_SIG); };
  const l = arrows(1, true);
  assert.equal(l.length, 1);
  assert.ok(l[0].pts.every(([x]) => x < W / 2), 'nửa trái');
  assert.equal(arrows(1, false).length, 0);
  assert.equal(arrows(0, true).length, 0);
  const r = arrows(-1, true);
  assert.equal(r.length, 1);
  assert.ok(r[0].pts.every(([x]) => x > W / 2), 'nửa phải');
});

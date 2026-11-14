/* ============================ Lái xe máy: mặt đồng hồ (texture canvas) ============================
   Spec D-040 §9. bkDashDraw thuần (chỉ gọi lệnh canvas 2D, không đổi phép biến hình: test dùng canvas giả ghi lệnh):
   nền tròn, thang tốc độ 0..dash.vMax km/h trên cung 240° (0 ở dưới bên trái, kim theo chiều kim đồng hồ), số tốc độ lớn ở giữa, cung vòng tua ở dưới,
   hai mũi tên xi nhan hai bên (chỉ vẽ khi đang sáng). night 0..1 đổi bảng màu (đêm: nền tối, chữ sáng như đèn nền).
   Hệ canvas: đỉnh canvas = phía trước xe (model.ts: UV v = 0 phía trước, texture flipY = false), trái canvas = bên trái người lái.
   BkDash: canvas dash.px vuông + CanvasTexture; update() vẽ lại tối đa dash.hz lần/giây và chỉ khi số hiển thị đổi (km/h, vòng tua làm tròn 100, xi nhan, nháy, mức đêm);
   độ sáng của MeshBasicMaterial nhân theo uNight bằng màu vật liệu (không đổi program). Không cấp phát mỗi khung (chuỗi số tính sẵn). */
import * as THREE from 'three';
import { CONFIG } from '../../config';
import { shared } from '../../core/shared';

const D = CONFIG.bike.dash;
export const BK_DASH_NEEDLE = '#ff5a2a';   // màu kim tốc độ
export const BK_DASH_SIG = '#38f26a';      // màu mũi tên xi nhan khi sáng
const A0 = Math.PI * 0.75, SWEEP = Math.PI * 4 / 3;   // rad — góc canvas của vạch 0 (dưới trái) và độ dài cung (chiều kim đồng hồ trên màn: góc tăng)
const NUM: string[] = []; for (let i = 0; i <= 199; i++) NUM.push(String(i));
const TICKS: string[] = []; for (let v = 0; v <= D.vMax; v += 20) TICKS.push(String(v));
/* bảng màu ngày / đêm: nền, vành, chữ + vạch, chữ phụ, cung tua */
const PAL = [
  { bg: '#1b2128', rim: '#9aa3ab', fg: '#e8edf0', dim: '#7d8790', rpm: '#ffc83a' },
  { bg: '#05080c', rim: '#3a5566', fg: '#bff4ff', dim: '#4f7d8f', rpm: '#ffb21e' }
];

export function bkDashDraw(g: CanvasRenderingContext2D, w: number, h: number, kmh: number, rpm: number, sig: -1 | 0 | 1, blink: boolean, night: number): void {
  const P = PAL[night >= 0.5 ? 1 : 0], cx = w / 2, cy = h / 2, R = Math.min(w, h) / 2;
  /* nền + vành */
  g.fillStyle = P.bg; g.beginPath(); g.arc(cx, cy, R, 0, Math.PI * 2); g.fill();
  g.strokeStyle = P.rim; g.lineWidth = R * 0.05; g.beginPath(); g.arc(cx, cy, R * 0.95, 0, Math.PI * 2); g.stroke();
  /* vạch tốc độ mỗi 10 km/h, số mỗi 20 */
  g.strokeStyle = P.fg; g.fillStyle = P.fg; g.lineCap = 'round';
  g.font = `bold ${Math.round(R * 0.15)}px sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle';
  for (let v = 0, k = 0; v <= D.vMax; v += 10) {
    const a = A0 + SWEEP * v / D.vMax, ca = Math.cos(a), sa = Math.sin(a), big = v % 20 === 0;
    g.lineWidth = big ? R * 0.035 : R * 0.02;
    g.beginPath(); g.moveTo(cx + ca * R * 0.86, cy + sa * R * 0.86); g.lineTo(cx + ca * R * (big ? 0.72 : 0.78), cy + sa * R * (big ? 0.72 : 0.78)); g.stroke();
    if (big) g.fillText(TICKS[k++], cx + ca * R * 0.58, cy + sa * R * 0.58);
  }
  /* cung vòng tua (dưới), tỉ lệ rpm / rpmMax */
  const u = Math.max(0, Math.min(1, rpm / D.rpmMax));
  g.strokeStyle = P.dim; g.lineWidth = R * 0.06; g.beginPath(); g.arc(cx, cy, R * 0.82, Math.PI * 0.35, Math.PI * 0.65); g.stroke();
  if (u > 0) { g.strokeStyle = P.rpm; g.beginPath(); g.arc(cx, cy, R * 0.82, Math.PI * 0.65 - Math.PI * 0.3 * u, Math.PI * 0.65); g.stroke(); }
  /* số tốc độ lớn ở giữa + đơn vị */
  const k = Math.max(0, Math.min(NUM.length - 1, Math.round(kmh)));
  g.fillStyle = P.fg; g.font = `bold ${Math.round(R * 0.42)}px sans-serif`;
  g.fillText(NUM[k], cx, cy + R * 0.02);
  g.fillStyle = P.dim; g.font = `${Math.round(R * 0.12)}px sans-serif`;
  g.fillText('km/h', cx, cy + R * 0.3);
  /* kim tốc độ */
  const a = A0 + SWEEP * Math.min(1, Math.max(0, kmh) / D.vMax);
  g.strokeStyle = BK_DASH_NEEDLE; g.lineWidth = R * 0.04;
  g.beginPath(); g.moveTo(cx + Math.cos(a) * R * 0.5, cy + Math.sin(a) * R * 0.5); g.lineTo(cx + Math.cos(a) * R * 0.88, cy + Math.sin(a) * R * 0.88); g.stroke();
  /* xi nhan: mũi tên ở nửa trái / phải phía trên */
  if (blink && sig !== 0) {
    const sx = sig === 1 ? -1 : 1, x0 = cx + sx * R * 0.2, x1 = cx + sx * R * 0.42, y = cy - R * 0.4, hh = R * 0.1;
    g.fillStyle = BK_DASH_SIG; g.beginPath();
    g.moveTo(x1, y); g.lineTo(x0 + sx * hh, y - hh * 1.2); g.lineTo(x0 + sx * hh, y - hh * 0.45); g.lineTo(x0, y - hh * 0.45);
    g.lineTo(x0, y + hh * 0.45); g.lineTo(x0 + sx * hh, y + hh * 0.45); g.lineTo(x0 + sx * hh, y + hh * 1.2); g.closePath(); g.fill();
  }
}

export class BkDash {
  readonly canvas: HTMLCanvasElement;
  readonly tex: THREE.CanvasTexture;
  private readonly g: CanvasRenderingContext2D;
  private t = Infinity;                                   // s từ lần kiểm cuối (Infinity: vẽ ngay lần đầu)
  private kmh = -1; private rpm = -1; private sig = 2; private blink = false; private night = -1;

  constructor() {
    this.canvas = document.createElement('canvas');
    this.canvas.width = this.canvas.height = D.px;
    this.g = this.canvas.getContext('2d')!;
    this.tex = new THREE.CanvasTexture(this.canvas);
    this.tex.flipY = false;                               // UV glTF (model.ts): đỉnh canvas phía trước xe
    this.tex.colorSpace = THREE.SRGBColorSpace;
    this.tex.anisotropy = 4;
  }

  /* Gắn texture vào vật liệu mặt đồng hồ của xe (đổi map cùng loại: không biên dịch lại) và chỉnh độ sáng theo uNight */
  bind(mat: THREE.MeshBasicMaterial | null): void {
    if (!mat) return;
    if (mat.map !== this.tex) { mat.map = this.tex; }
    const n = shared.uNight.value, k = D.day + (D.night - D.day) * (n > 1 ? 1 : n < 0 ? 0 : n);
    mat.color.setScalar(k);
  }

  /* Vẽ lại khi tới nhịp hz và số hiển thị đổi */
  update(dt: number, v: number, rpm: number, sig: -1 | 0 | 1): void {
    this.t += dt > 0 ? dt : 0;
    if (this.t < 1 / D.hz) return;
    this.t = 0;
    const kmh = Math.round(Math.abs(v) * 3.6), r = Math.round(rpm / 100) * 100;
    const ph = shared.uTime.value * CONFIG.bike.model.sigHz, blink = ph - Math.floor(ph) < 0.5;   // cùng nhịp đèn xi nhan của model.ts
    const night = shared.uNight.value >= 0.5 ? 1 : 0;
    if (kmh === this.kmh && r === this.rpm && sig === this.sig && (sig === 0 || blink === this.blink) && night === this.night) return;
    this.kmh = kmh; this.rpm = r; this.sig = sig; this.blink = blink; this.night = night;
    bkDashDraw(this.g, D.px, D.px, kmh, r, sig, blink, night);
    this.tex.needsUpdate = true;
  }

  dispose(): void { this.tex.dispose(); }
}

import * as THREE from 'three';

/* [adAtlas] Atlas 2048 × 2048 vẽ lúc chạy cho mọi bảng quảng cáo (một texture, một vật liệu).
   Thương hiệu HƯ CẤU: không dùng tên/logo có thật. Quảng cáo không đổi theo i18n (ngoài đời bảng ở Đà Nẵng ghi tiếng Việt).
   Danh sách tên đã rà: Cà phê Hàn Giang, Bia Sóng Biển, Ngân hàng Sông Xanh, Hàng không Hải Âu, Nước mắm Cửa Biển,
   Nhà Bên Sông (bất động sản), Điện máy Mặt Trời Mới, Sữa Mây Trắng, Ốc Đảo Travel, Bánh kẹo Cồn Nổi. */
export type AdKind = 'pano' | 'screen' | 'roof' | 'banner' | 'shop' | 'landmark';
export interface Slot { kind: AdKind; x: number; y: number; w: number; h: number; label: string }
export const ATLAS = 2048;

interface Brand { name: string; tag: string; c0: string; c1: string }
const BRANDS: Brand[] = [
  { name: 'Cà phê Hàn Giang', tag: 'Một ly Hàn Giang, tỉnh giấc cùng Đà Nẵng', c0: '#5b3a22', c1: '#b9803f' },
  { name: 'Bia Sóng Biển', tag: 'Sảng khoái như sóng ngoài khơi', c0: '#0b4f8a', c1: '#2bb0d6' },
  { name: 'Ngân hàng Sông Xanh', tag: 'Dòng tiền êm như dòng sông', c0: '#0b6b4a', c1: '#59c28a' },
  { name: 'Hàng không Hải Âu', tag: 'Bay cùng Hải Âu, chạm tới bình minh', c0: '#13406e', c1: '#6fb7ee' },
  { name: 'Nước mắm Cửa Biển', tag: 'Đậm vị biển quê hương', c0: '#8a2f12', c1: '#e08b3a' },
  { name: 'Nhà Bên Sông', tag: 'Căn hộ ven sông — Sống đáng sống', c0: '#4a2a73', c1: '#b56ad6' },
  { name: 'Điện máy Mặt Trời Mới', tag: 'Thắp sáng mọi gian bếp', c0: '#a8590a', c1: '#f4c20d' },
  { name: 'Sữa Mây Trắng', tag: 'Tươi mát từ đồng cỏ cao nguyên', c0: '#2c6fb3', c1: '#cde8fb' },
  { name: 'Ốc Đảo Travel', tag: 'Tour Sơn Trà · Ngũ Hành Sơn · Bà Nà', c0: '#0e6f6a', c1: '#f2a33a' },
  { name: 'Bánh kẹo Cồn Nổi', tag: 'Ngọt như quà biển', c0: '#b3204f', c1: '#f58fb0' }
];
const CITY: [string, string][] = [
  ['LỄ HỘI PHÁO HOA QUỐC TẾ ĐÀ NẴNG – DIFF', '#6a1fa8'], ['ĐÀ NẴNG – THÀNH PHỐ ĐÁNG SỐNG', '#0b6d8f'], ['Khám phá Bán đảo Sơn Trà', '#1f7a3a'],
  ['Ngũ Hành Sơn – Danh thắng quốc gia', '#8a4a1a'], ['Xem Cầu Rồng phun lửa – 21h tối thứ Bảy, Chủ nhật', '#a3201f']
];
const BANNERS: [string, string, string][] = [
  ['DIFF', 'PHÁO HOA', '#6a1fa8'], ['CHÀO', 'NĂM MỚI', '#a3201f'], ['ĐÀ NẴNG', 'ĐÁNG SỐNG', '#0b6d8f'], ['SƠN TRÀ', 'XANH', '#1f7a3a'],
  ['LỄ HỘI', 'SÔNG HÀN', '#b34a10'], ['CẦU', 'RỒNG', '#8a1fa3'], ['BIỂN', 'MỸ KHÊ', '#0a6aa8'], ['TẾT', 'ĐOÀN VIÊN', '#b3201f'],
  ['DIFF', 'PHÁO HOA', '#0a6aa8'], ['CHÀO', 'NĂM MỚI', '#6a1fa8'], ['ĐÀ NẴNG', 'ĐÁNG SỐNG', '#a3201f'], ['SƠN TRÀ', 'XANH', '#0b6d8f'],
  ['LỄ HỘI', 'SÔNG HÀN', '#1f7a3a'], ['CẦU', 'RỒNG', '#b34a10'], ['BIỂN', 'MỸ KHÊ', '#8a1fa3'], ['TẾT', 'ĐOÀN VIÊN', '#0b6d8f']
];
const SHOPS = ['Cà phê Neo Bờ Sông', 'Hải sản Biển Xanh Quán', 'Lưu niệm Sao Biển', 'Mì Quảng Ngũ Hành', 'Trà chiều Hàn Giang', 'Kem dừa Cồn Nổi', 'Quán Nướng Mân Thái', 'Áo dài Phố Sông',
  'Bánh xèo Bà Nà', 'Cà phê Sóng Hàn', 'Nón lá Hội Xuân', 'Quà biển Nại Hiên', 'Nhà hàng Cá Chép Vàng', 'Sinh tố Mỹ Khê', 'Chè Cung Đình', 'Tiệm ảnh Cầu Rồng',
  'Bún chả cá Hải Châu', 'Cơm gà Sơn Trà', 'Đồ gỗ Non Nước', 'Hoa tươi Ven Sông', 'Cà phê Mây Trắng', 'Hải sản Sóng Vỗ', 'Lưu niệm Gió Biển', 'Bánh tráng Đà Thành'];
const LANDMARK = ['CHỢ HÀN', 'BẢO TÀNG ĐIÊU KHẮC CHĂM'];

/* Chia ô theo từng loại bảng (px): xem bố cục ở đầu file; tổng chiều cao dùng 1976 / 2048 */
export function layoutSlots(): Slot[] {
  const S: Slot[] = [];
  const grid = (kind: AdKind, n: number, w: number, h: number, y0: number, label: (i: number) => string) => {
    const cols = Math.floor(ATLAS / w);
    for (let i = 0; i < n; i++) S.push({ kind, x: (i % cols) * w, y: y0 + Math.floor(i / cols) * h, w, h, label: label(i) });
  };
  grid('pano', 8, 512, 171, 0, (i) => BRANDS[i % BRANDS.length].name);
  grid('screen', 6, 576, 324, 342, (i) => (i < 5 ? CITY[i][0] : BRANDS[8].name));
  grid('roof', 8, 512, 205, 990, (i) => BRANDS[(i + 2) % BRANDS.length].name);
  grid('banner', 16, 128, 384, 1400, (i) => String(i));
  grid('shop', 24, 256, 64, 1784, (i) => SHOPS[i % SHOPS.length]);
  grid('landmark', 2, 512, 64, 1976, (i) => LANDMARK[i]);
  return S;
}
function fit(g: CanvasRenderingContext2D, text: string, maxW: number, size: number, weight = 700) {
  let s = size; g.font = `${weight} ${s}px "Be Vietnam Pro","Segoe UI",Arial,sans-serif`;
  while (g.measureText(text).width > maxW && s > 8) { s -= 2; g.font = `${weight} ${s}px "Be Vietnam Pro","Segoe UI",Arial,sans-serif`; }
}
function wrap(g: CanvasRenderingContext2D, text: string, x: number, y: number, maxW: number, lh: number) {
  const words = text.split(' '); let line = '', yy = y;
  for (const w of words) { const t = line ? line + ' ' + w : w; if (g.measureText(t).width > maxW && line) { g.fillText(line, x, yy); line = w; yy += lh; } else line = t; }
  g.fillText(line, x, yy);
}
function drawSlot(g: CanvasRenderingContext2D, s: Slot, idx: number) {
  g.save(); g.beginPath(); g.rect(s.x, s.y, s.w, s.h); g.clip(); g.textAlign = 'center'; g.textBaseline = 'middle';
  const b = BRANDS.find((q) => q.name === s.label);
  if (s.kind === 'banner') {
    const [a, c, col] = BANNERS[idx % BANNERS.length], gr = g.createLinearGradient(s.x, s.y, s.x, s.y + s.h);
    gr.addColorStop(0, col); gr.addColorStop(1, '#101018'); g.fillStyle = gr; g.fillRect(s.x, s.y, s.w, s.h);
    g.strokeStyle = '#ffd66b'; g.lineWidth = 4; g.strokeRect(s.x + 6, s.y + 6, s.w - 12, s.h - 12);
    g.fillStyle = '#fff'; fit(g, a, s.w - 20, 30, 800); g.fillText(a, s.x + s.w / 2, s.y + s.h * 0.38);
    g.fillStyle = '#ffd66b'; fit(g, c, s.w - 20, 28, 800); g.fillText(c, s.x + s.w / 2, s.y + s.h * 0.58);
    g.fillStyle = 'rgba(255,255,255,0.8)'; g.beginPath(); g.arc(s.x + s.w / 2, s.y + s.h * 0.8, 18, 0, 7); g.fill();
  } else if (s.kind === 'shop') {
    g.fillStyle = idx % 3 === 0 ? '#7a2d1a' : idx % 3 === 1 ? '#17566e' : '#4a5d1f'; g.fillRect(s.x, s.y, s.w, s.h);
    g.strokeStyle = '#f4e3b8'; g.lineWidth = 3; g.strokeRect(s.x + 3, s.y + 3, s.w - 6, s.h - 6);
    g.fillStyle = '#fff6dc'; fit(g, s.label, s.w - 16, 26, 700); g.fillText(s.label, s.x + s.w / 2, s.y + s.h / 2 + 1);
  } else if (s.kind === 'landmark') {
    g.fillStyle = idx === 0 ? '#b3201f' : '#5a3a1a'; g.fillRect(s.x, s.y, s.w, s.h);
    g.strokeStyle = '#ffd66b'; g.lineWidth = 6; g.strokeRect(s.x + 5, s.y + 5, s.w - 10, s.h - 10);
    g.fillStyle = '#ffd66b'; fit(g, s.label, s.w - 30, 40, 800); g.fillText(s.label, s.x + s.w / 2, s.y + s.h / 2 + 2);
  } else if (s.kind === 'screen' && idx < 5) {
    const c = CITY[idx], gr = g.createLinearGradient(s.x, s.y, s.x + s.w, s.y + s.h);
    gr.addColorStop(0, c[1]); gr.addColorStop(1, '#10101a'); g.fillStyle = gr; g.fillRect(s.x, s.y, s.w, s.h);
    g.fillStyle = '#fff'; g.font = '800 50px "Be Vietnam Pro","Segoe UI",Arial,sans-serif'; wrap(g, c[0], s.x + s.w / 2, s.y + s.h * (c[0].length > 34 ? 0.3 : 0.42), s.w - 60, 62);
  } else {
    const br = b || BRANDS[idx % BRANDS.length], gr = g.createLinearGradient(s.x, s.y, s.x + s.w, s.y + s.h);
    gr.addColorStop(0, br.c0); gr.addColorStop(1, br.c1); g.fillStyle = gr; g.fillRect(s.x, s.y, s.w, s.h);
    g.fillStyle = 'rgba(255,255,255,0.14)'; g.beginPath(); g.arc(s.x + s.w * 0.88, s.y + s.h * 0.2, s.h * 0.5, 0, 7); g.fill();
    g.fillStyle = '#fff'; fit(g, br.name, s.w * 0.86, s.h * 0.3, 800); g.fillText(br.name, s.x + s.w / 2, s.y + s.h * 0.42);
    g.fillStyle = 'rgba(255,255,255,0.92)'; fit(g, br.tag, s.w * 0.88, s.h * 0.13, 500); g.fillText(br.tag, s.x + s.w / 2, s.y + s.h * 0.74);
  }
  g.restore();
}
export interface Atlas { texture: THREE.CanvasTexture; slots: Slot[]; byKind: (k: AdKind) => Slot[]; rect: (s: Slot) => [number, number, number, number]; redraw(): void; dispose(): void }
export function buildAtlas(): Atlas {
  const c = document.createElement('canvas'); c.width = c.height = ATLAS;
  const g = c.getContext('2d'), slots = layoutSlots();
  const texture = new THREE.CanvasTexture(c); texture.colorSpace = THREE.SRGBColorSpace; texture.anisotropy = 4;
  const counters: Partial<Record<AdKind, number>> = {};
  const redraw = () => {
    g.fillStyle = '#101018'; g.fillRect(0, 0, ATLAS, ATLAS);
    for (const k of Object.keys(counters)) delete counters[k as AdKind];
    for (const s of slots) { const i = counters[s.kind] ?? 0; counters[s.kind] = i + 1; drawSlot(g, s, i); }
    texture.needsUpdate = true;
  };
  redraw();
  // chữ Việt có dấu: vẽ lại khi font đã nạp xong
  if (document.fonts?.ready) document.fonts.ready.then(redraw).catch(() => undefined);
  return {
    texture, slots, byKind: (k) => slots.filter((s) => s.kind === k),
    /* [u0, v0, u1, v1] của ô, co vào 1 px để không rỉ màu sang ô bên */
    rect: (s) => [(s.x + 1) / ATLAS, 1 - (s.y + s.h - 1) / ATLAS, (s.x + s.w - 1) / ATLAS, 1 - (s.y + 1) / ATLAS],
    redraw, dispose: () => texture.dispose()
  };
}

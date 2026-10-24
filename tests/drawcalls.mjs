// So sánh draw call (renderer.info.render.calls, gồm cả bóng đổ, phản chiếu nước và bloom)
// giữa bản gốc (một file HTML) và bản build Vite, ở mọi góc nhìn, ban ngày và ban đêm.
//
//   npm run build && node tests/drawcalls.mjs [thư-mục-bản-gốc]
//
// Thư mục bản gốc (tùy chọn) phải chứa index.html có móc ?test (window.__app) và thư mục three/.
import { fileURLToPath } from 'node:url';
import { serveDir, launch, openApp, frames, pickView } from './lib.mjs';

const VIEWS = [
  ['dragon', 'overview'], ['dragon', 'head'], ['dragon', 'tail'], ['dragon', 'drive'], ['dragon', 'bird'], ['dragon', 'walk'],
  ['tp', 'tpBay'], ['tp', 'tpWater'], ['tp', 'tpDrive'], ['tp', 'tpBoth'],
  ['ttl', 'ttlOverview'], ['ttl', 'ttlBase'], ['ttl', 'ttlDeck'], ['ttl', 'ttlBoth'],
  ['sh', 'shOverview'], ['sh', 'shTop'], ['sh', 'shBank'], ['sh', 'shDeck'],
  // Hầm vượt sông Hàn (bản gốc không có: tự bỏ qua nếu thiếu nút)
  ['hr', 'hrOverview'], ['hr', 'hrCutaway'], ['hr', 'hrPortalW'], ['hr', 'hrPortalE'], ['hr', 'hrDrive'], ['hr', 'hrGallery'],
  // Hai bờ sông Hàn
  ['dragon', 'rfHearts'], ['dragon', 'rfBank'],
  // Thời tiết (GĐ6; bản gốc không có: tự bỏ qua nếu thiếu nút)
  ['tp', 'wxRiverMouth'], ['ttl', 'wxTtlStays'], ['dragon', 'wxStreet'],
  // Vòng quay Mặt Trời (GĐ3; bản gốc không có: tự bỏ qua nếu thiếu nút)
  ['sw', 'swOverview'], ['sw', 'swFront'], ['sw', 'swBase'], ['sw', 'swFromTTL'], ['sw', 'swNight'], ['sw', 'swTop'],
  // Ngồi cabin (GĐ5): camera gắn cabin, không thêm mesh
  ['sw', 'swRide'],
  // Tour Vòng quay (GĐ7): đo lúc Tour đang ở điểm 5 (trong cabin ở đỉnh, camera do cabin đặt), cùng ngân sách swRide
  ['sw', 'swTour']
];

async function setNight(page, v) {
  await page.evaluate((v) => { window.__app.dayNight.target = v; window.__app.dayNight.night = v; }, v);
  await page.waitForFunction((v) => Math.abs(window.__app.dayNight.night - v) < 1e-6, v, { timeout: 60000 });
  await frames(page, 3);
}

/** Trung vị của vài khung hình (xe cộ, thuyền chạy nên số có thể dao động nhẹ). */
async function sample(page) {
  const xs = [];
  for (let i = 0; i < 5; i++) { await frames(page, 1); xs.push(await page.evaluate(() => window.__app.renderer.info.render.calls)); }
  xs.sort((a, b) => a - b);
  return xs[2];
}

async function measure(browser, url) {
  const { page, errors } = await openApp(browser, url);
  const out = {};
  for (const night of [0, 1]) {
    await setNight(page, night);
    for (const [bridge, view] of VIEWS) {
      if (!(await page.$(`button[data-view="${view}"]`))) continue;
      await pickView(page, bridge, view);
      if (view === 'swNight') await setNight(page, night);   // góc này tự chuyển sang đêm khi bấm: trả về ngày/đêm đang đo (rfHearts giữ nguyên cách đo cũ để khớp bảng chuẩn)
      if (view === 'swRide') await page.evaluate(() => { window.__app.swRide.blend = 1; });   // bỏ chặng bay vào cabin: đo khi camera đã ở trong cabin
      if (view === 'swTour') await page.evaluate(() => { const d = window.__app.tours.sw.durs; window.__app.tour.t = d.slice(0, 3).reduce((a, x) => a + x, 0) + 0.6 * d[3]; window.__app.swRide.blend = 1; });   // tua tới điểm 5 (đỉnh), bỏ chặng bay vào cabin
      await frames(page, 4);
      out[`${view}|${night ? 'đêm' : 'ngày'}`] = await sample(page);
      if (view === 'swTour') { await page.keyboard.press('Escape'); await frames(page, 2); }   // thoát Tour: trả tốc độ quay, ngày/đêm, show như cũ
    }
  }
  await page.close();
  return { out, errors };
}

const origDir = process.argv[2];
const browser = await launch();
const results = {};
const servers = [];
try {
  if (origDir) { const s = await serveDir(origDir); servers.push(s); results.goc = await measure(browser, s.url); }
  const s = await serveDir(fileURLToPath(new URL('../dist/', import.meta.url))); servers.push(s);
  results.vite = await measure(browser, s.url);
} finally {
  await browser.close();
  servers.forEach((s) => s.close());
}

let diff = 0;
const rows = Object.keys(results.vite.out).map((k) => {
  const v = results.vite.out[k], g = results.goc?.out[k];
  if (g !== undefined && g !== v) diff++;
  return { 'góc nhìn': k, ...(g !== undefined ? { 'bản gốc': g } : {}), 'bản Vite': v, ...(g !== undefined ? { 'chênh': v - g } : {}) };
});
console.table(rows);
for (const [name, r] of Object.entries(results)) if (r.errors.length) console.log(`Lỗi console (${name}):`, r.errors);
if (origDir) console.log(diff ? `${diff} góc nhìn có draw call khác bản gốc.` : 'Draw call trùng khớp bản gốc ở mọi góc nhìn.');
process.exit(Object.values(results).some((r) => r.errors.length) ? 1 : 0);

// Ảnh tự xem Giai đoạn 3 của Vòng quay Mặt Trời (quay, cabin đứng thẳng, góc nhìn sw*, nhóm nút + ô tốc độ).
//
//   npm run build && node tests/sunwheel-gd3-shots.mjs      → tests/screens/sunwheel-gd3/*.png
import { fileURLToPath } from 'node:url';
import fs from 'node:fs';
import { serveDir, launch, openApp, frames, pickView } from './lib.mjs';

const OUT = fileURLToPath(new URL('./screens/sunwheel-gd3/', import.meta.url));
fs.mkdirSync(OUT, { recursive: true });
const srv = await serveDir(fileURLToPath(new URL('../dist/', import.meta.url)));
const browser = await launch();
const { page, errors } = await openApp(browser, srv.url, { width: 960, height: 600 });
const shot = async (name) => { await frames(page, 3); await page.screenshot({ path: `${OUT}${name}.png` }); };
async function setNight(v) {
  await page.evaluate((v) => { window.__app.dayNight.target = v; window.__app.dayNight.night = v; }, v);
  await page.waitForFunction((v) => Math.abs(window.__app.dayNight.night - v) < 1e-6, v, { timeout: 60000 });
  await frames(page, 3);
}
const hide = () => page.addStyleTag({ content: '.panel, #hud, .hud, #tourCaption { opacity: 0 !important; }'   /* opacity (không phải display) để Playwright vẫn bấm được nút góc nhìn */ });
const SWV = ['swOverview', 'swFront', 'swBase', 'swFromTTL', 'swNight', 'swTop'];
try {
  // 1. bảng điều khiển: nhóm sw + ô tốc độ (chưa ẩn bảng)
  await pickView(page, 'sw', 'swOverview'); await shot('ui-panel');
  await hide();
  // 2. sáu góc nhìn, ngày (swNight tự sang đêm → chụp riêng) rồi đêm
  for (const v of SWV) { await pickView(page, 'sw', v); await setNight(0); await shot(`${v}-ngay`); }
  for (const v of ['swNight', 'swFront']) { await pickView(page, 'sw', v); await setNight(1); await shot(`${v}-dem`); }
  // 3. chính diện ở ba góc quay: cabin dịch theo vành, vẫn đứng thẳng
  await pickView(page, 'sw', 'swFront'); await setNight(0);
  for (const th of [0, 1.2, 3.5]) { await page.evaluate((th) => { window.__app.sunWheel.setSpeed(0); window.__app.sunWheel.advance(15); window.__app.sunWheel.setAngle(th); }, th); await shot(`front-angle-${th}`); }
  // 4. ×60 trong 0,5 s thật rồi chụp: góc đã đổi
  const th0 = await page.evaluate(() => { const W = window.__app.sunWheel; W.setSpeed(60); return W.angle(); });
  await frames(page, 30);
  console.log('góc trước/sau ~30 khung ×60:', th0, await page.evaluate(() => window.__app.sunWheel.angle()));
  await shot('front-x60');
} finally { await browser.close(); srv.close(); }
console.log('lỗi console:', errors);

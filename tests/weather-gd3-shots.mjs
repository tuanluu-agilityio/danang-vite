// Chụp ảnh tự xem Giai đoạn 3 (mưa + mặt ướt): góc nhìn × ngày/đêm × preset -> tests/screens/weather-gd3/
// In kèm: draw call (HUD) từng ảnh, số program trước/sau đổi preset, mưa trong hầm (hrGallery), FPS thô ở overview now/rain.
//   npm run build && node tests/weather-gd3-shots.mjs [view1,view2] [preset1,preset2]
import { fileURLToPath } from 'node:url';
import fs from 'node:fs';
import { serveDir, launch, openApp, frames, pickView } from './lib.mjs';
import { setWx } from './weather-lib.mjs';

const OUT = fileURLToPath(new URL('./screens/weather-gd3/', import.meta.url));
fs.mkdirSync(OUT, { recursive: true });
const VIEWS = { overview: ['dragon', 'overview'], tpBay: ['tp', 'tpBay'], ttlDeck: ['ttl', 'ttlDeck'], shDeck: ['sh', 'shDeck'] };
const want = (process.argv[2] || Object.keys(VIEWS).join(',')).split(','), presets = (process.argv[3] || 'now,rain,storm').split(',');
const calls = (page) => page.evaluate(() => document.getElementById('calls')?.textContent);
const fps = (page, n = 30) => page.evaluate((n) => new Promise((ok) => { const t0 = performance.now(); let i = 0; const f = () => (++i >= n ? ok(Math.round(n / ((performance.now() - t0) / 1000) * 10) / 10) : requestAnimationFrame(f)); requestAnimationFrame(f); }), n);
const srv = await serveDir(fileURLToPath(new URL('../dist/', import.meta.url)));
const browser = await launch();
const { page, errors } = await openApp(browser, srv.url, { width: 960, height: 540 });
try {
  const progs0 = await page.evaluate(() => window.__app.renderer.info.programs.length);
  for (const v of want) {
    await pickView(page, ...VIEWS[v]);
    for (const night of [0, 1]) {
      await page.evaluate((n) => { const d = window.__app.dayNight; d.target = d.night = n; }, night);
      for (const p of presets) {
        await setWx(page, p); await frames(page, 2);
        const r = await page.evaluate(() => { const m = window.__app.weather.rain.mesh; return { vis: m.visible, count: m.count }; });
        await page.screenshot({ path: `${OUT}${v}-${night ? 'dem' : 'ngay'}-${p}.png` });
        console.log(v, night ? 'dem' : 'ngay', p, 'calls', await calls(page), 'mưa', JSON.stringify(r));
      }
    }
  }
  const progs1 = await page.evaluate(() => window.__app.renderer.info.programs.length);
  console.log('programs trước/sau:', progs0, progs1);
  // FPS thô (SwiftShader) ở overview, ban ngày
  await pickView(page, 'dragon', 'overview'); await page.evaluate(() => { const d = window.__app.dayNight; d.target = d.night = 0; });
  await setWx(page, 'now'); const fNow = await fps(page);
  await setWx(page, 'rain'); const fRain = await fps(page);
  console.log('FPS overview now / rain:', fNow, fRain);
  // Mưa trong hầm
  await pickView(page, 'hr', 'hrGallery'); await setWx(page, 'storm'); await frames(page, 3);
  console.log('hrGallery storm: mưa visible =', await page.evaluate(() => window.__app.weather.rain.mesh.visible));
  await page.screenshot({ path: `${OUT}hrGallery-ngay-storm.png` });
  // now sau storm: vật liệu ướt về đúng gốc
  await setWx(page, 'now'); await frames(page, 3);
  console.log('now sau storm: mưa visible =', await page.evaluate(() => window.__app.weather.rain.mesh.visible), 'pixelRatio', await page.evaluate(() => window.__app.renderer.getPixelRatio()));
  if (errors.length) console.log('Lỗi console:', errors.slice(0, 5)); else console.log('console sạch');
} finally { await browser.close(); srv.close(); }

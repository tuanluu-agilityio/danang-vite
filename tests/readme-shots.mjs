// Chụp ảnh cho README (GPU thật, 1280×720) vào docs/screenshots/.
//   npm run build && TEST_REAL_GPU=1 node tests/readme-shots.mjs
import { fileURLToPath } from 'node:url';
import fs from 'node:fs';
import { serveDir, launch, openApp, frames, pickView } from './lib.mjs';
import { setWx } from './weather-lib.mjs';

const OUT = fileURLToPath(new URL('../docs/screenshots/', import.meta.url));
fs.mkdirSync(OUT, { recursive: true });
const srv = await serveDir(fileURLToPath(new URL('../dist/', import.meta.url)));
const browser = await launch();
const night = (page, n) => page.evaluate((n) => { const d = window.__app.dayNight; d.target = d.night = n; }, n);
try {
  // Các chế độ tự khám phá
  for (const [mode, wait] of [['glider', 90], ['drive', 90], ['bike', 90], ['stroll', 90]]) {
    const { page, errors } = await openApp(browser, srv.url + '?explore=' + mode, { width: 1280, height: 720 });
    await night(page, 0); await frames(page, wait);
    await page.screenshot({ path: `${OUT}${mode}.jpg`, type: 'jpeg', quality: 85 });
    console.log(mode, errors.slice(0, 2));
    await page.close();
  }
  // Ngày / đêm và thời tiết ở Cầu Rồng
  const { page } = await openApp(browser, srv.url, { width: 1280, height: 720 });
  await pickView(page, 'dragon', 'overview');
  for (const [name, n, wx] of [['ngay', 0, 'now'], ['dem', 1, 'now'], ['mua', 0, 'rain'], ['bao', 1, 'storm']]) {
    await night(page, n); await setWx(page, wx); await frames(page, 60);
    await page.screenshot({ path: `${OUT}${name}.jpg`, type: 'jpeg', quality: 85 }); console.log(name);
  }
} finally { await browser.close(); srv.close(); }

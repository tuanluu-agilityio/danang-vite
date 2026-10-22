// Chụp ảnh tự xem Giai đoạn 2: overview, tpBay, shOverview x ngày/đêm x 5 preset -> tests/screens/weather-gd2/
//   npm run build && node tests/weather-gd2-shots.mjs [view1,view2] [preset1,preset2]
import { fileURLToPath } from 'node:url';
import fs from 'node:fs';
import { serveDir, launch, openApp, frames, waitFlight, pickView } from './lib.mjs';
import { setWx } from './weather-lib.mjs';

const OUT = fileURLToPath(new URL('./screens/weather-gd2/', import.meta.url));
fs.mkdirSync(OUT, { recursive: true });
const VIEWS = { overview: ['dragon', 'overview'], tpBay: ['tp', 'tpBay'], shOverview: ['sh', 'shOverview'] };
const want = (process.argv[2] || Object.keys(VIEWS).join(',')).split(','), presets = (process.argv[3] || 'now,summer,rain,monsoon,storm').split(',');
const srv = await serveDir(fileURLToPath(new URL('../dist/', import.meta.url)));
const browser = await launch();
const { page, errors } = await openApp(browser, srv.url, { width: 960, height: 540 });
try {
  for (const v of want) {
    await pickView(page, ...VIEWS[v]);
    for (const night of [0, 1]) {
      await page.evaluate((n) => { const d = window.__app.dayNight; d.target = d.night = n; }, night);
      for (const p of presets) {
        await setWx(page, p); await frames(page, 2);
        await page.screenshot({ path: `${OUT}${v}-${night ? 'dem' : 'ngay'}-${p}.png` });
        console.log(v, night ? 'dem' : 'ngay', p);
      }
    }
  }
  if (errors.length) console.log('Lỗi console:', errors.slice(0, 5));
} finally { await browser.close(); srv.close(); }

// Kiểm tra thời tiết (xem prompts/ke-hoach-thoi-tiet.md mục 11). Hiện có phần Giai đoạn 2; các giai đoạn sau thêm tiếp.
//  GĐ2.1 Preset `now`: mọi giá trị khí quyển bằng giá trị trước khi áp thời tiết (không nhúc nhích).
//  GĐ2.2 storm -> now (ngày và đêm): mọi giá trị khớp TUYỆT ĐỐI với chụp gốc (sương, Sky, nước, mây, ánh sáng, exposure).
//  GĐ2.3 Mỗi preset khác `now` thật sự đổi cảnh (sương dày hơn khi mưa/bão); không lỗi console.
//
//   npm run build && node tests/weather-check.mjs
import { fileURLToPath } from 'node:url';
import { serveDir, launch, openApp, frames } from './lib.mjs';
import { snapAtmosphere, setWx } from './weather-lib.mjs';

const problems = [];
const check = (ok, msg) => { if (!ok) problems.push(msg); return ok; };
const diff = (a, b) => Object.keys(a).filter((k) => JSON.stringify(a[k]) !== JSON.stringify(b[k]));

const srv = await serveDir(fileURLToPath(new URL('../dist/', import.meta.url)));
const browser = await launch();
const { page, errors } = await openApp(browser, srv.url, { width: 480, height: 270 });
try {
  for (const night of [0, 1]) {
    await page.evaluate((n) => { const d = window.__app.dayNight; d.target = d.night = n; }, night);
    await frames(page, 3);
    const base = await snapAtmosphere(page);
    await setWx(page, 'now');
    check(diff(base, await snapAtmosphere(page)).length === 0, `night=${night}: preset now đổi ${diff(base, await snapAtmosphere(page))}`);
    for (const p of ['summer', 'rain', 'monsoon', 'storm']) {
      await setWx(page, p);
      const s = await snapAtmosphere(page);
      check(diff(base, s).length > 0, `night=${night}: preset ${p} không đổi gì`);
      if (p === 'rain' || p === 'storm') check(s.fogDensity > base.fogDensity * 4, `night=${night}: ${p} sương chưa dày (${s.fogDensity})`);
    }
    await setWx(page, 'storm'); await setWx(page, 'now');
    const back = await snapAtmosphere(page), d = diff(base, back);
    check(d.length === 0, `night=${night}: storm -> now không về đúng giá trị gốc: ${d.map((k) => `${k} ${JSON.stringify(base[k])} != ${JSON.stringify(back[k])}`).join('; ')}`);
  }
  check(errors.length === 0, `lỗi console: ${errors.slice(0, 3).join(' | ')}`);
} finally { await browser.close(); srv.close(); }
if (problems.length) { console.log('THẤT BẠI:\n- ' + problems.join('\n- ')); process.exit(1); }
console.log('weather-check: đạt');

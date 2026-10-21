// Chụp ảnh tự xem Giai đoạn 4 (gió): dây TTL rung mưa–gió vs bão khô, hanger TP, dây SH, cây -> tests/screens/weather-gd4/
// In kèm: draw call (HUD), biên độ lắc đang hiển thị (__app.weather.sway(), m, đã phóng đại ×20), số program trước/sau.
//   npm run build && node tests/weather-gd4-shots.mjs
// wxTtlStays chưa có (GĐ6): dùng ttlDeck (đứng trên mặt cầu nhìn lên dây văng).
import { fileURLToPath } from 'node:url';
import fs from 'node:fs';
import { serveDir, launch, openApp, frames, pickView } from './lib.mjs';
import { setWx } from './weather-lib.mjs';

const OUT = fileURLToPath(new URL('./screens/weather-gd4/', import.meta.url));
fs.mkdirSync(OUT, { recursive: true });
const calls = (page) => page.evaluate(() => document.getElementById('calls')?.textContent);
const sway = (page) => page.evaluate(() => JSON.stringify(Object.fromEntries(Object.entries(window.__app.weather.sway()).map(([k, v]) => [k, Math.round(v * 1000) / 1000]))));
// Ghi đè tham số thời tiết tức thì (target = current), gió giật 0 để so sánh ổn định
const setParams = (page, p) => page.evaluate((p) => { const w = window.__app.weather; w.setParams(p, true); w.state.wet = w.state.current.rain; }, p);
const CASES = {
  now: async (page) => setWx(page, 'now'),
  rainWind: async (page) => { await setWx(page, 'rain'); await setParams(page, { rain: 0.6, wind: 12, gust: 0 }); },   // mưa 60 %, gió 12 m/s
  stormDry: async (page) => { await setWx(page, 'storm'); await setParams(page, { rain: 0, gust: 0 }); },              // bão không mưa
  storm: async (page) => setWx(page, 'storm'),
  monsoon: async (page) => setWx(page, 'monsoon')
};
const SHOTS = [
  ['ttl', 'ttlDeck', ['now', 'rainWind', 'stormDry']],
  ['tp', 'tpBay', ['now', 'storm']],
  ['sh', 'shDeck', ['now', 'storm']],
  ['dragon', 'overview', ['now', 'monsoon', 'storm']]
];
const srv = await serveDir(fileURLToPath(new URL('../dist/', import.meta.url)));
const browser = await launch();
const { page, errors } = await openApp(browser, srv.url, { width: 960, height: 540 });
try {
  const progs0 = await page.evaluate(() => window.__app.renderer.info.programs.length);
  await page.evaluate(() => { const d = window.__app.dayNight; d.target = d.night = 0; });
  for (const [b, v, cases] of SHOTS) {
    await pickView(page, b, v);
    for (const c of cases) {
      await CASES[c](page); await frames(page, 3);
      for (const k of [0, 1]) {          // hai thời điểm cách nhau ~0,5 s để thấy dây ở pha khác
        if (k) await page.waitForTimeout(500);
        await page.screenshot({ path: `${OUT}${v}-${c}-${k}.png` });
      }
      console.log(v, c, 'calls', await calls(page), 'sway', await sway(page));
    }
  }
  // Cận cảnh mặt dây trước TTL (nhìn ngang, mặt phẳng dây ⟂ hướng nhìn): dao động trong mặt phẳng dây thấy rõ
  await pickView(page, 'ttl', 'ttlDeck');
  await page.evaluate(() => { const { camera, controls } = window.__app; camera.position.set(-10, 45, 1385); controls.target.set(-10, 50, 1300); controls.update(); });
  for (const c of ['now', 'rainWind', 'stormDry']) {
    await CASES[c](page); await frames(page, 3);
    for (const k of [0, 1]) { if (k) await page.waitForTimeout(500); await page.screenshot({ path: `${OUT}ttlClose-${c}-${k}.png` }); }
    console.log('ttlClose', c, 'calls', await calls(page), 'sway', await sway(page));
  }
  await setWx(page, 'now'); await frames(page, 3);
  console.log('now cuối: sway', await sway(page), 'calls', await calls(page));
  console.log('programs trước/sau:', progs0, await page.evaluate(() => window.__app.renderer.info.programs.length));
  if (errors.length) console.log('Lỗi console:', errors.slice(0, 5)); else console.log('console sạch');
} finally { await browser.close(); srv.close(); }

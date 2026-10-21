// Chụp ảnh tự xem Giai đoạn 5 (bão): tia chớp ngày/đêm, xe được dọn khỏi cầu, thuyền về bến -> tests/screens/weather-gd5/
// In kèm: draw call lúc tia chớp hiện (renderer.info.render.calls) so với không chớp, trạng thái vận hành (weather.fx()), số xe còn hiển thị, ctrl.start() khi bão.
//   npm run build && node tests/weather-gd5-shots.mjs
import { fileURLToPath } from 'node:url';
import fs from 'node:fs';
import { serveDir, launch, openApp, frames, pickView } from './lib.mjs';
import { setWx } from './weather-lib.mjs';

const OUT = fileURLToPath(new URL('./screens/weather-gd5/', import.meta.url));
fs.mkdirSync(OUT, { recursive: true });

// Ép một lần chớp rồi chờ khung có tia chớp hiện; chụp canvas NGAY trong callback rAF (sau animate) để còn bộ đệm vẽ. Trả về { png, calls } hoặc null
const grabFlash = (page) => page.evaluate(() => new Promise((ok) => {
  const { weather, renderer } = window.__app;
  weather.lightning.strike(); let n = 0;
  const f = () => {
    if (weather.lightning.flashing()) return ok({ png: renderer.domElement.toDataURL('image/png'), calls: renderer.info.render.calls });
    if (++n > 120) return ok(null);
    requestAnimationFrame(f);
  };
  requestAnimationFrame(f);
}));
const calls = (page) => page.evaluate(() => window.__app.renderer.info.render.calls);
// Đếm xe còn hiển thị (ma trận khác scale 0) trong InstancedMesh lớn nhất nằm trực tiếp dưới scene (xe khu phố quanh Cầu Rồng)
const cityVehicles = (page) => page.evaluate(() => {
  const { scene } = window.__app;
  const ms = scene.children.filter((o) => o.isInstancedMesh && o.count === 536);   // 536 = tổng xe khu phố (4 tuyến × 2 chiều); mesh đầu tiên là thân xe
  const m = ms[0]; let vis = 0; for (let i = 0; i < m.count; i++) if (m.instanceMatrix.array[i * 16] !== 0) vis++;
  return { total: m.count, visible: vis };
});
// Chạy khung cho tới khi weatherFx.clear = 1 (đóng cầu xong) hoặc quá 400 khung
const settle = (page, pred) => page.evaluate((src) => new Promise((ok) => { const p = new Function('w', 'return ' + src); let n = 0; const f = () => (p(window.__app.weather) || ++n > 400 ? ok(n) : requestAnimationFrame(f)); requestAnimationFrame(f); }), pred);

const srv = await serveDir(fileURLToPath(new URL('../dist/', import.meta.url)));
const browser = await launch();
const { page, errors } = await openApp(browser, srv.url, { width: 960, height: 540 });
try {
  const progs0 = await page.evaluate(() => window.__app.renderer.info.programs.length);
  const SHOTS = [['dragon', 'overview'], ['tp', 'tpBay'], ['sh', 'shOverview']];
  for (const night of [0, 1]) {
    await page.evaluate((n) => { const d = window.__app.dayNight; d.target = d.night = n; }, night);
    const tag = night ? 'dem' : 'ngay';
    for (const [b, v] of SHOTS) {
      await pickView(page, b, v);
      await setWx(page, 'storm'); await frames(page, 6);
      const base = await calls(page);
      const g = await grabFlash(page);
      if (g) { fs.writeFileSync(`${OUT}${v}-${tag}-flash.png`, Buffer.from(g.png.split(',')[1], 'base64')); }
      console.log(v, tag, 'calls bão không chớp', base, 'lúc chớp', g ? g.calls : 'không bắt được', 'chênh', g ? g.calls - base : '-');
      await page.screenshot({ path: `${OUT}${v}-${tag}-storm.png` });
    }
  }
  // Đóng cầu: xe khu phố bị dọn dần, rồi trả lại khi về `now`
  await page.evaluate(() => { const d = window.__app.dayNight; d.target = d.night = 0; });
  await pickView(page, 'dragon', 'overview'); await setWx(page, 'now'); await frames(page, 4);
  console.log('xe khu phố (now):', JSON.stringify(await cityVehicles(page)), 'fx', JSON.stringify(await page.evaluate(() => ({ ...window.__app.weather.fx() }))));
  await page.screenshot({ path: `${OUT}overview-ngay-now.png` });
  await setWx(page, 'storm');
  const n = await settle(page, 'w.fx().clear >= 1');
  await frames(page, 3);
  console.log('storm: sau', n, 'khung; xe khu phố:', JSON.stringify(await cityVehicles(page)), 'fx', JSON.stringify(await page.evaluate(() => ({ ...window.__app.weather.fx() }))));
  console.log('songHan.ctrl.start() khi bão ->', await page.evaluate(() => window.__app.songHan.ctrl.start()), '| state', await page.evaluate(() => window.__app.songHan.ctrl.state));
  console.log('quảng cáo (adsEnabled) khi bão ->', await page.evaluate(() => window.__app.riverfront.adsEnabled));
  await pickView(page, 'dragon', 'overview'); await page.screenshot({ path: `${OUT}overview-ngay-storm-dondep.png` });
  await setWx(page, 'now');
  await settle(page, 'w.fx().clear <= 0 && w.fx().boatAway <= 0');
  console.log('now lại: xe', JSON.stringify(await cityVehicles(page)), 'fx', JSON.stringify(await page.evaluate(() => ({ ...window.__app.weather.fx() }))),
    '| quảng cáo', await page.evaluate(() => window.__app.riverfront.adsEnabled), '| exposure', await page.evaluate(() => window.__app.renderer.toneMappingExposure));
  console.log('programs trước/sau:', progs0, await page.evaluate(() => window.__app.renderer.info.programs.length));
  if (errors.length) console.log('Lỗi console:', errors.slice(0, 5)); else console.log('console sạch');
} finally { await browser.close(); srv.close(); }

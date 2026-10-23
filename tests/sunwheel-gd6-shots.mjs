// Ảnh tự xem Giai đoạn 6 của Vòng quay Mặt Trời (thời tiết): cabin lắc và vòng quay dừng khi bão, mặt ướt, dòng thông báo khi đang ngồi cabin.
// Kèm số đo (tốc độ sau khi dừng, góc nghiêng cabin, draw call).
//
//   npm run build && node tests/sunwheel-gd6-shots.mjs      → tests/screens/sunwheel-gd6/*.png
import { fileURLToPath } from 'node:url';
import fs from 'node:fs';
import { serveDir, launch, openApp, frames, pickView } from './lib.mjs';
import { setWx } from './weather-lib.mjs';

const OUT = fileURLToPath(new URL('./screens/sunwheel-gd6/', import.meta.url));
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
const camLocal = (p, t) => page.evaluate(([p, t]) => {
  const { camera, controls, sunWheel: W, THREE } = window.__app;
  controls.maxPolarAngle = Math.PI * 0.97;
  camera.position.copy(W.group.localToWorld(new THREE.Vector3(...p))); controls.target.copy(W.group.localToWorld(new THREE.Vector3(...t))); controls.update();
}, [p, t]);
const facts = (label) => page.evaluate((label) => {
  const { sunWheel: W, renderer, windFx, weather, THREE } = window.__app, up = new THREE.Vector3();
  let max = 0; for (let i = 0; i < 64; i++) { W.cabinUp(i, up); max = Math.max(max, Math.acos(Math.min(1, up.y))); }
  return { label, speed: +W.speedNow().toFixed(3), goal: W.speedTarget(), stopped: weather.fx().wheelStopped, wind: +Math.hypot(windFx.x, windFx.z).toFixed(2), swayAmp: +W.sway().amp.toFixed(3), maxTiltDeg: +(max * 180 / Math.PI).toFixed(2), calls: renderer.info.render.calls };
}, label);
try {
  await pickView(page, 'sw', 'swFront'); await setNight(0);
  await page.evaluate(() => { const W = window.__app.sunWheel; W.setSpeed(10); W.advance(15); });
  // ngoài trời: cabin ở nửa dưới vành, cùng một camera trước/sau
  await camLocal([40, 22, 110], [0, 34, 0]); await setWx(page, 'now'); await frames(page, 3);
  console.log(JSON.stringify(await facts('now')));
  await shot('cabins-now');
  await setWx(page, 'storm'); await page.evaluate(() => window.__app.sunWheel.advance(12)); await frames(page, 3);
  console.log(JSON.stringify(await facts('storm')));
  await shot('cabins-storm');
  await page.evaluate(() => window.__app.sunWheel.advance(0.8)); await shot('cabins-storm-b');
  await pickView(page, 'sw', 'swFront'); await frames(page, 3); await shot('swFront-storm');
  await setNight(1); await shot('swFront-storm-dem'); await setNight(0);
  // ngồi cabin khi bão: dòng thông báo + tầm nhìn nghiêng theo cabin
  await setWx(page, 'now');
  await page.evaluate(() => { const W = window.__app.sunWheel; W.setSpeed(10); W.advance(15); document.querySelector('button[data-view="swRide"]').click(); });
  await frames(page, 2); await page.evaluate(() => { window.__app.swRide.blend = 1; });
  await shot('ride-now');
  await setWx(page, 'storm'); await page.evaluate(() => window.__app.sunWheel.advance(12)); await frames(page, 3);
  console.log(JSON.stringify(await page.evaluate(() => { const e = document.getElementById('swStormNote'); return { noteHidden: e.hidden, text: e.textContent, mode: window.__app.cam.mode }; })));
  await shot('ride-storm');
  await page.evaluate(() => { window.__app.swRide.yaw = Math.PI * 0.6; }); await shot('ride-storm-yaw');
  console.log(JSON.stringify(await facts('ride-storm')));
  console.log('lỗi console:', errors.length ? errors.join(' | ') : 'không');
} finally { await browser.close(); srv.close(); }

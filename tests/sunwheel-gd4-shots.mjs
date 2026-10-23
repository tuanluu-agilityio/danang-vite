// Ảnh tự xem Giai đoạn 4 của Vòng quay Mặt Trời (LED đêm, 5 kiểu show, nhịp tim đồng bộ riverfront).
//
//   npm run build && node tests/sunwheel-gd4-shots.mjs      → tests/screens/sunwheel-gd4/*.png
import { fileURLToPath } from 'node:url';
import fs from 'node:fs';
import { serveDir, launch, openApp, frames, pickView } from './lib.mjs';

const OUT = fileURLToPath(new URL('./screens/sunwheel-gd4/', import.meta.url));
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
const hide = () => page.addStyleTag({ content: '.panel, #hud, .hud, #tourCaption { opacity: 0 !important; }' });
const SHOWS = ['white', 'pink', 'rays', 'heart', 'off'];
try {
  await pickView(page, 'sw', 'swNight'); await setNight(1); await shot('ui-panel');
  await hide();
  await page.evaluate(() => window.__app.sunWheel.setSpeed(0));
  for (const s of SHOWS) { await page.evaluate((s) => window.__app.sunWheel.setShow(s), s); await shot(`swNight-${s}`); }
  // giống ảnh tham chiếu: n1 chính diện đêm, n2 dưới chân nhìn lên, n3 nghiêng, a2 flycam chạng vạng, a1 flycam ngày
  const REF = { n1: [[0, 10, 260], [0, 58, 0]], n2: [[6, 18, 40], [0, 70, 0]], n3: [[-170, 20, 140], [0, 50, 0]], a12: [[60, 140, 420], [0, 40, -60]] };
  await page.evaluate(() => window.__app.sunWheel.setShow('white'));
  for (const k of ['n1', 'n2', 'n3']) { await camLocal(...REF[k]); await shot(`ref-${k}-white`); }
  await page.evaluate(() => window.__app.sunWheel.setShow('pink')); await camLocal(...REF.a12); await setNight(0.75); await shot('ref-a2-pink');
  await setNight(0); await shot('ref-a1-ngay');
  // nhịp tim: đỉnh nhịp và giữa hai nhịp, ban đêm, cùng khung hình (chỉ đổi uTime trong cùng một lần vẽ)
  await setNight(1); await pickView(page, 'sw', 'swFront'); await setNight(1);
  await page.evaluate(() => window.__app.sunWheel.setShow('heart'));
  await shot('swFront-heart'); await page.evaluate(() => window.__app.sunWheel.setShow('rays')); await shot('swFront-rays');
  // xa: bloom/sáng từ Cầu Trần Thị Lý ban đêm
  await page.evaluate(() => window.__app.sunWheel.setShow('white')); await pickView(page, 'sw', 'swFromTTL'); await setNight(1); await shot('swFromTTL-white');
} finally { await browser.close(); srv.close(); }
console.log('lỗi console:', errors);

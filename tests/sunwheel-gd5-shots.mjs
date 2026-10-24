// Ảnh tự xem Giai đoạn 5 của Vòng quay Mặt Trời (ngồi cabin): nút + dòng hướng dẫn, nhìn từ cabin ở đáy / lưng chừng / đỉnh, ngày và đêm, quay mặt về Nam, sau khi xuống.
// Kèm vài số đo để đối chiếu (camera so với tâm cabin, độ cao mắt, hướng nhìn).
//
//   npm run build && node tests/sunwheel-gd5-shots.mjs      → tests/screens/sunwheel-gd5/*.png
import { fileURLToPath } from 'node:url';
import fs from 'node:fs';
import { serveDir, launch, openApp, frames, pickView, waitFlight } from './lib.mjs';

const OUT = fileURLToPath(new URL('./screens/sunwheel-gd5/', import.meta.url));
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
const hidePanels = () => page.addStyleTag({ content: '.panel:not(#swRideHint), #hud, .hud, #tourCaption { opacity: 0 !important; }' });
/* đặt cabin đang ngồi ở góc phi (rad) trên vành rồi chờ vài khung để camera bám */
const cabinAt = async (phi, yaw = 0, pitch = null) => {
  await page.evaluate(([phi, yaw, pitch]) => {
    const { sunWheel: W, swRide: R } = window.__app; W.setAngle(phi - R.cabin * W.cfg.cabinStep); R.yaw = yaw; if (pitch !== null) R.pitch = pitch;
  }, [phi, yaw, pitch]);
  await frames(page, 3);
};
const facts = (label) => page.evaluate((label) => {
  const { camera, sunWheel: W, swRide: R, cam, controls, THREE } = window.__app;
  const p = W.cabinWorld(R.cabin).clone(); p.y += W.cfg.ride.eyeUp;
  return { label, mode: cam.mode, enabled: controls.enabled, err: +p.distanceTo(camera.position).toFixed(6), eye: camera.position.toArray().map((v) => +v.toFixed(2)), cabin: R.cabin, fwd: camera.getWorldDirection(new THREE.Vector3()).toArray().map((v) => +v.toFixed(3)) };
}, label);
try {
  await pickView(page, 'sw', 'swFront'); await setNight(0);
  await page.evaluate(() => { const W = window.__app.sunWheel; W.setSpeed(0); W.advance(2); W.setAngle(0); });
  await shot('ui-before');
  // lên cabin bằng nút
  await page.evaluate(() => document.querySelector('button[data-view="swRide"]').click());
  await frames(page, 2);
  console.log(JSON.stringify(await page.evaluate(() => ({ mode: window.__app.cam.mode, blend: window.__app.swRide.blend }))));
  await shot('ride-entering');               // giữa chặng bay vào
  await page.evaluate(() => { window.__app.swRide.blend = 1; });
  await shot('ride-ui-bottom');              // còn bảng điều khiển + dòng hướng dẫn, cabin ở đáy (sàn lên)
  await hidePanels();
  const F = [];
  await cabinAt(-Math.PI / 2); await shot('ride-bottom-north'); F.push(await facts('bottom'));
  await cabinAt(-Math.PI / 4); await shot('ride-low-north'); F.push(await facts('low'));
  await cabinAt(0); await shot('ride-mid-north'); F.push(await facts('mid'));
  await cabinAt(Math.PI / 4, 0, -0.2); await shot('ride-high-north'); F.push(await facts('high'));
  await cabinAt(Math.PI / 2, 0, -0.3); await shot('ride-top-north'); F.push(await facts('top'));
  await cabinAt(Math.PI / 2, 0, -0.9); await shot('ride-top-down'); F.push(await facts('top-down'));
  await cabinAt(Math.PI / 2, Math.PI, -0.3); await shot('ride-top-south'); F.push(await facts('top-south'));
  await cabinAt(Math.PI / 2, Math.PI / 2, -0.15); await shot('ride-top-west'); F.push(await facts('top-west'));
  await cabinAt(Math.PI / 2, -Math.PI / 2, -0.15); await shot('ride-top-east'); F.push(await facts('top-east'));
  // đêm
  await setNight(1);
  await cabinAt(Math.PI / 2, 0, -0.3); await shot('ride-top-north-dem'); F.push(await facts('top-dem'));
  await cabinAt(0, 0, -0.1); await shot('ride-mid-north-dem');
  await cabinAt(Math.PI / 2, Math.PI, -0.3); await shot('ride-top-south-dem');
  await setNight(0);
  // ×60 trong khoảng 0,5 s thật: camera vẫn bám cabin (err ≈ 0), không giật
  await page.evaluate(() => window.__app.sunWheel.setSpeed(60)); await frames(page, 20);
  F.push(await facts('x60'));
  await shot('ride-x60');
  await page.evaluate(() => { const W = window.__app.sunWheel; W.setSpeed(0); W.advance(2); });
  console.log(F.map((f) => JSON.stringify(f)).join('\n'));
  // xuống bằng Esc → bay về chỗ cũ
  await page.keyboard.press('Escape'); await waitFlight(page); await frames(page, 2);
  console.log('sau Esc:', JSON.stringify(await page.evaluate(() => ({ mode: window.__app.cam.mode, enabled: window.__app.controls.enabled, hint: !document.getElementById('swRideHint').hidden }))));
  await shot('after-exit');
} finally { await browser.close(); srv.close(); }
console.log('lỗi console:', errors);

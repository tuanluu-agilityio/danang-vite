// Ảnh tự xem Giai đoạn 7 của Vòng quay Mặt Trời (Tour 6 điểm): từng điểm dừng với khung chú thích, lúc lên cabin, lưng chừng, ở đỉnh nhìn về Bắc, xuống cabin ban đêm (show hồng tím),
// kèm vài số đo (thời gian lên đỉnh, sai lệch camera so với mắt cabin).
//
//   npm run build && node tests/sunwheel-gd7-shots.mjs      → tests/screens/sunwheel-gd7/*.png
import { fileURLToPath } from 'node:url';
import fs from 'node:fs';
import { serveDir, launch, openApp, frames, pickView } from './lib.mjs';

const OUT = fileURLToPath(new URL('./screens/sunwheel-gd7/', import.meta.url));
fs.mkdirSync(OUT, { recursive: true });
const srv = await serveDir(fileURLToPath(new URL('../dist/', import.meta.url)));
const browser = await launch();
const { page, errors } = await openApp(browser, srv.url, { width: 960, height: 600 });
const shot = async (name) => { await frames(page, 3); await page.screenshot({ path: `${OUT}${name}.png` }); };
const at = async (i) => {   // tới đúng điểm dừng i (camera đứng ở điểm đó, chú thích điểm i)
  await page.evaluate((i) => { const d = window.__app.tours.sw.durs; window.__app.tour.t = d.slice(0, i).reduce((a, x) => a + x, 0) + 0.01; }, i);
  await frames(page, 3);
};
try {
  await pickView(page, 'sw', 'swFront');
  await page.evaluate(() => { const W = window.__app.sunWheel; W.setSpeed(1); W.setShow('white'); W.setAngle(0.4); });
  await page.evaluate(() => { window.__app.dayNight.target = 0; window.__app.dayNight.night = 0; });
  await frames(page, 3);
  await pickView(page, 'sw', 'swTour'); await frames(page, 2);
  console.log(JSON.stringify(await page.evaluate(() => ({ mode: window.__app.cam.mode, durs: window.__app.tours.sw.durs.map((v) => +v.toFixed(1)), total: +window.__app.tours.sw.total.toFixed(1) }))));
  for (const i of [0, 1, 2]) { await at(i); await shot(`stop${i + 1}`); }

  // điểm 4: vừa lên cabin ở đáy
  await at(3);
  await page.evaluate(() => { window.__app.swRide.blend = 1; });
  await shot('stop4-board');
  // mô phỏng lên đỉnh, chụp lưng chừng rồi lúc tới đỉnh
  const climb = await page.evaluate(() => {
    const { sunWheel: W, swRide: R } = window.__app, out = { samples: [] };
    let t = 0;
    while (t < 90 && (R.tour.climbing || W.speedNow() > W.cfg.tour.topSpeed + 1e-6)) {
      W.advance(0.1); R.update(0.1); t += 0.1;
      if (Math.abs(t - 8) < 0.05) out.mid = W.cabinWorld(R.cabin).y;
    }
    out.t = +t.toFixed(1); out.y = +W.cabinWorld(R.cabin).y.toFixed(2); out.top = +(W.cfg.hubY + W.cfg.cabinR).toFixed(2); out.speed = W.speedNow();
    return out;
  });
  console.log('lên đỉnh:', JSON.stringify(climb));
  await shot('stop4-top-reached');
  await at(4);
  await page.evaluate(() => { window.__app.swRide.blend = 1; });
  await shot('stop5-north');
  console.log('stop5:', JSON.stringify(await page.evaluate(() => { const { camera, sunWheel: W, swRide: R } = window.__app, p = W.cabinWorld(R.cabin); p.y += W.cfg.ride.eyeUp; return { err: +p.distanceTo(camera.position).toFixed(6), y: +camera.position.y.toFixed(1), tour: R.tour.on }; })));
  // điểm 6: rời cabin, đêm + hồng tím
  await at(5);
  await page.evaluate(() => { const R = window.__app.swRide; for (let k = 0; k < 40 && R.tour.out >= 0; k++) R.update(0.1); window.__app.dayNight.night = 1; });   // khung rất chậm: kết thúc trộn camera và chuyển đêm bằng tay
  await shot('stop6-night');
  console.log('stop6:', JSON.stringify(await page.evaluate(() => ({ night: window.__app.dayNight.night, show: window.__app.sunWheel.show(), mode: window.__app.cam.mode }))));
  // hết hành trình: trả như cũ
  await page.evaluate(() => { window.__app.tour.t = window.__app.tours.sw.total; });
  await frames(page, 3);
  console.log('hết Tour:', JSON.stringify(await page.evaluate(() => ({ mode: window.__app.cam.mode, night: window.__app.dayNight.target, show: window.__app.sunWheel.show(), goal: window.__app.sunWheel.speedTarget() }))));
  console.log('console:', JSON.stringify(errors));
} finally { await browser.close(); srv.close(); }

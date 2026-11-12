// Ảnh chụp người treo dù có xương (D-035 Task 4) để xem bằng mắt — KHÔNG phải test chấm điểm.
//   npm run build && node tests/pilot-shots.mjs [--only=straight,left] [--set='{"base":{"recline":0.3}}'] [--measure] [--w=1280 --h=720]
// Mở dist/ với ?test, ghi đè CONFIG.explore.pilot (--set, trộn sâu) rồi cất cánh, chờ nhân vật thật gắn xong, đóng băng vòng bay (explore.update rỗng)
// và tự bước mô phỏng bằng explore.step. Mỗi trạng thái (thẳng; giữ rẽ trái 3 s; rẽ phải; E 2 s; Q 2 s) chụp vài góc quanh người treo trong hệ dù:
// sau 4 m, ngang trái 3 m, trước 3,5 m, camera bám mặc định, cận tay trái 1,2 m; thêm đêm và mưa bão cho góc sau.
// Ảnh: tests/screens/pilot-<trạng thái>-<góc>.png. In pilotDebug() mỗi trạng thái. --measure: in mặt cắt thân người (hệ dù) để chỉnh trang bị.
import { fileURLToPath } from 'node:url';
import { mkdirSync, writeFileSync } from 'node:fs';
import { serveDir, launch, openApp, frames } from './lib.mjs';
import { setWx } from './weather-lib.mjs';

const arg = (k, d) => { const a = process.argv.find((x) => x.startsWith(`--${k}=`)); return a ? a.slice(k.length + 3) : d; };
const only = arg('only', '') ? arg('only', '').split(',') : null;
const W = Number(arg('w', 1280)), H = Number(arg('h', 720));
const set = { loadMs: 180000, ...JSON.parse(arg('set', '{}')) };   // SwiftShader: khung đầu chặn luồng chính hàng chục giây, nới giờ tải
const OUT = fileURLToPath(new URL('./screens/', import.meta.url));
mkdirSync(OUT, { recursive: true });

const srv = await serveDir(fileURLToPath(new URL('../dist/', import.meta.url)));
const browser = await launch();
const t0 = Date.now();
const log = (...a) => console.log(`[${((Date.now() - t0) / 1000).toFixed(0)} s]`, ...a);
try {
  const { page, errors } = await openApp(browser, srv.url, { width: W, height: H });
  log('trang đã mở');
  await page.evaluate((set) => {
    const merge = (a, b) => { for (const k of Object.keys(b)) { if (b[k] && typeof b[k] === 'object' && !Array.isArray(b[k])) merge(a[k], b[k]); else a[k] = b[k]; } };
    merge(window.__app.exFlight.CONFIG_explore.pilot, set);
    window.__app.explore.start();
    window.__app.explore.update = () => {};   // đóng băng: chỉ explore.step trong script tiến mô phỏng
  }, set);
  await page.waitForFunction(() => { window.__app.explore.step(1 / 60, { turn: 0, climb: 0, throttle: 0 }); const d = window.__app.explore.pilotDebug(); return d && d.real; }, null, { timeout: 240000, polling: 1000 });
  log('nhân vật thật đã gắn');

  /* Bước mô phỏng sec giây với đầu vào inp (dt 1/60) */
  const run = (inp, sec) => page.evaluate(([inp, sec]) => { for (let i = 0; i < Math.round(sec * 60); i++) window.__app.explore.step(1 / 60, inp); }, [inp, sec]);
  /* Đặt camera: off = [x, y, z] m trong hệ dù so với ngực (null = camera bám mặc định), nhìn vào ngực (hoặc bàn tay trái khi hand) */
  const shot = async (name, off, hand = false) => {
    await page.evaluate(([off, hand]) => {
      const { explore, camera, THREE } = window.__app;
      if (!off) { camera.near = 0.5; camera.updateProjectionMatrix(); window.__app.exFlight.exChase(camera, window.__app.controls.target, explore.state, 0, true); return; }   // camera bám mặc định, đặt thẳng
      const g = explore.glider; g.updateMatrixWorld(true);
      const body = g.getObjectByName('pl-body');
      const tgt = new THREE.Vector3().setFromMatrixPosition((hand ? body.getObjectByName('Bip01_L_Hand') : body.getObjectByName('Bip01_Spine2')).matrixWorld);
      const loc = g.worldToLocal(tgt.clone()).add(new THREE.Vector3(...off));
      camera.position.copy(g.localToWorld(loc)); camera.up.set(0, 1, 0); camera.lookAt(tgt);
      camera.near = 0.05; camera.updateProjectionMatrix();
    }, [off, hand]);
    await frames(page, 2);
    await page.screenshot({ path: `${OUT}pilot-${name}.png` });
    log('ảnh', name);
  };
  const dbg = async (label) => {
    const d = await page.evaluate(() => { const d = window.__app.explore.pilotDebug(); const p = {}; for (const k in d.pose) p[k] = +d.pose[k].toFixed(3); return { real: d.real, handErr: d.handErr.map((v) => +v.toFixed(4)), calls: d.calls, pose: p }; });
    log(`pilotDebug ${label}:`, JSON.stringify(d));
    return d;
  };
  const restart = () => page.evaluate(() => { const ex = window.__app.explore, upd = ex.update; ex.start(); ex.update = upd; });

  const ANG = { back: [-4, 0.3, 0], left: [0, 0.2, -3], front: [3.5, 0.2, 0], right: [0, 0.2, 3], chase: null, hand: [0.7, 0.3, -0.9], top: [-1.5, 2.2, 1.2] };
  const states = [
    ['straight', { turn: 0, climb: 0, throttle: 0 }, 2.5, ['back', 'left', 'front', 'chase', 'hand', 'top']],
    ['turnL', { turn: 1, climb: 0, throttle: 0 }, 3, ['back', 'front', 'chase', 'hand']],
    ['turnR', { turn: -1, climb: 0, throttle: 0 }, 3, ['back', 'front']],
    ['fast', { turn: 0, climb: 0, throttle: 1 }, 2, ['left']],
    ['slow', { turn: 0, climb: 0, throttle: -1 }, 2, ['left']]
  ];
  const report = {};
  for (const [name, inp, sec, angs] of states) {
    if (only && !only.includes(name)) continue;
    await restart(); await run({ turn: 0, climb: 0, throttle: 0 }, 2); await run(inp, sec);
    report[name] = await dbg(name);
    for (const a of angs) {
      await page.evaluate((inp) => window.__app.explore.step(1 / 60, inp), inp);
      await shot(`${name}-${a}`, ANG[a], a === 'hand');
    }
  }
  if (process.argv.includes('--measure')) {
    await restart(); await run({ turn: 0, climb: 0, throttle: 0 }, 2);
    const m = await page.evaluate(() => {
      const { explore, THREE } = window.__app, g = explore.glider; g.updateMatrixWorld(true);
      const pil = g.getObjectByName('ex-pilot'), body = g.getObjectByName('pl-body');
      let mesh = null; body.traverse((o) => { if (o.isSkinnedMesh) mesh = o; });
      mesh.skeleton.update();
      const inv = pil.matrixWorld.clone().invert(), v = new THREE.Vector3(), pts = [];
      for (let i = 0; i < mesh.geometry.attributes.position.count; i += 1) { mesh.getVertexPosition(i, v); v.applyMatrix4(mesh.matrixWorld).applyMatrix4(inv); pts.push([+v.x.toFixed(3), +v.y.toFixed(3), +v.z.toFixed(3)]); }
      const bones = {};
      for (const n of ['Pelvis', 'Spine', 'Spine2', 'Neck', 'Head', 'L_Clavicle', 'L_UpperArm', 'L_Forearm', 'L_Hand', 'L_Thigh', 'L_Calf', 'L_Foot', 'R_Thigh', 'R_Hand']) {
        const b = body.getObjectByName('Bip01_' + n); v.setFromMatrixPosition(b.matrixWorld).applyMatrix4(inv); bones[n] = [+v.x.toFixed(3), +v.y.toFixed(3), +v.z.toFixed(3)];
      }
      return { bones, pts };
    });
    writeFileSync(`${OUT}pilot-measure.json`, JSON.stringify(m));
    log('bones', JSON.stringify(m.bones));
  }
  if (!only || only.includes('night')) {
    await restart(); await run({ turn: 0, climb: 0, throttle: 0 }, 2.5);
    await page.evaluate(() => { window.__app.dayNight.target = 1; window.__app.dayNight.night = 1; });
    await frames(page, 3);
    await shot('night-back', ANG.back); await shot('night-chase', null);
    await page.evaluate(() => { window.__app.dayNight.target = 0; window.__app.dayNight.night = 0; });
    await setWx(page, 'storm');
    await run({ turn: 0, climb: 0, throttle: 0 }, 1);
    report.storm = await dbg('storm');
    await shot('storm-back', ANG.back); await shot('storm-chase', null);
    await setWx(page, 'now');
  }
  writeFileSync(`${OUT}pilot-report.json`, JSON.stringify(report, null, 1));
  if (errors.length) log('lỗi console:', errors.slice(0, 5));
} finally {
  await browser.close(); srv.close();
}
log('xong');

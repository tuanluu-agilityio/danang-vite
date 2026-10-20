// Kiểm tra 4 Tour tự động (Cầu Rồng, Thuận Phước, Trần Thị Lý, sông Hàn):
//  1. Bấm nút Tour: bay tới điểm đầu rồi vào chế độ tour, khung chú thích hiện "1/N" đúng tiêu đề.
//  2. Tua tới từng điểm dừng: chú thích đổi đúng số thứ tự và tiêu đề.
//  3. Đường bay của camera: không xuống dưới 3 m, không xuyên qua mô hình (raycast từng đoạn).
//  4. Tour sông Hàn: tới điểm dừng có cờ swing thì cầu tự quay (trạng thái rời "Đóng").
//  5. Không có lỗi console.
// Nếu truyền thêm thư mục bản gốc, so sánh luôn đường bay giữa hai bản (phải trùng nhau).
//
//   npm run build && node tests/tour-check.mjs [thư-mục-bản-gốc]
import { fileURLToPath } from 'node:url';
import { serveDir, launch, openApp, frames, waitFlight } from './lib.mjs';

const TOURS = [['dragon', 'tour'], ['tp', 'tpTour'], ['ttl', 'ttlTour'], ['sh', 'shTour'], ['hr', 'hrTour']];
const SAMPLES = 600;

async function checkTours(browser, url) {
  const { page, errors } = await openApp(browser, url);
  const report = {};
  for (const [bridge, view] of TOURS) {
    if (!(await page.$(`button[data-bridge="${bridge}"]`))) continue;   // bản gốc không có Hầm sông Hàn
    const r = report[bridge] = { problems: [] };
    await page.click(`button[data-bridge="${bridge}"]`);
    await waitFlight(page);
    const swing0 = await page.textContent('#swingState');
    await page.click(`button[data-view="${view}"]`);
    await waitFlight(page);
    await frames(page, 2);
    if (await page.evaluate(() => window.__app.cam.mode) !== 'tour') r.problems.push('không vào chế độ tour');
    await page.waitForTimeout(400);
    const info = await page.evaluate((bridge) => {
      const T = window.__app.tours[bridge];
      return { n: T.stops.length, durs: T.durs, swingAt: T.stops.findIndex((s) => s.swing), flags: T.stops.map((s) => ({ cutaway: !!s.cutaway, immerse: !!s.immerse })), hidden: document.getElementById('tourCaption').hidden };
    }, bridge);
    r.stops = info.n;
    if (info.hidden) r.problems.push('khung chú thích bị ẩn');

    // Tua tới từng điểm dừng (giữa đoạn trước → f > 0.55 thì chú thích chuyển sang điểm kế).
    const titles = [];
    for (let i = 0; i < info.n; i++) {
      const acc = info.durs.slice(0, i).reduce((a, b) => a + b, 0);
      await page.evaluate((t) => { window.__app.tour.t = t; }, i === 0 ? 0.01 : acc - 0.2 * info.durs[i - 1]);
      await frames(page, 1);
      await page.waitForTimeout(450);   // chú thích đổi sau hiệu ứng mờ 300 ms
      const cap = await page.evaluate(() => [document.getElementById('tourStep').textContent, document.getElementById('tourTitle').textContent]);
      if (!cap[0].includes(`${i + 1}/${info.n}`)) r.problems.push(`điểm ${i + 1}: chú thích ghi "${cap[0]}"`);
      titles.push(cap[1]);
      if (bridge === 'hr') {   // mỗi điểm dừng đặt đúng chế độ mặt cắt; điểm có cờ immerse thì chạy mô phỏng dìm
        const f = info.flags[i], sec = await page.getAttribute('#btnHrSection', 'aria-pressed');
        if (sec !== String(f.cutaway)) r.problems.push(`điểm ${i + 1}: mặt cắt = ${sec}, mong ${f.cutaway}`);
        if (f.immerse) {
          await frames(page, 2);
          const st = await page.evaluate(() => window.__app.hr.ctrl.state);
          if (st === 'IDLE') r.problems.push('Tour hầm không kích hoạt mô phỏng dìm'); else r.immerse = `mô phỏng dìm chạy (“${st}”)`;
        }
      }
      if (bridge === 'sh' && i === info.swingAt) {
        await frames(page, 2);
        const s = await page.textContent('#swingState');
        r.swing = s !== swing0 ? `cầu tự quay (“${s}”)` : 'KHÔNG quay';
        if (s === swing0) r.problems.push('tour sông Hàn không kích hoạt quay cầu');
      }
    }
    r.titles = titles;
    if (new Set(titles).size !== titles.length) r.problems.push('có tiêu đề điểm dừng bị trùng');

    // Đường bay: lấy mẫu, kiểm tra độ cao và raycast từng đoạn vào các mesh của cảnh.
    const path = await page.evaluate(({ bridge, SAMPLES, HRZ }) => {
      const { THREE, scene, tours } = window.__app;
      const T = tours[bridge];
      const pts = [];
      for (let k = 0; k <= SAMPLES; k++) { const p = T.posCurve.getPoint(k / SAMPLES); p.y = Math.max(p.y, T.minY ?? 3); pts.push(p); }
      // Tour hầm bay xuyên mặt đất/nước ở sát tuyến hầm (|z − z hầm| ≤ 40 m): chỉ kiểm tra phần còn lại
      const zone = (p) => bridge === 'hr' && Math.abs(p.z - HRZ) <= 40 && Math.abs(p.x) <= 850;
      const meshes = [];
      scene.traverseVisible((o) => { if (o.isMesh && !o.isInstancedMesh && o.name !== 'water' && o.material && !o.material.transparent) meshes.push(o); });
      const ray = new THREE.Raycaster(), dir = new THREE.Vector3(), hits = [];
      for (let k = 0; k < SAMPLES; k++) {
        const a = pts[k], b = pts[k + 1], len = a.distanceTo(b);
        if (len < 1e-6 || zone(a) || zone(b)) continue;
        ray.set(a, dir.subVectors(b, a).normalize()); ray.far = len;
        const h = ray.intersectObjects(meshes, false)[0];
        if (h) hits.push({ u: +(k / SAMPLES).toFixed(3), obj: h.object.name || h.object.parent?.name || h.object.type, at: h.point.toArray().map((v) => +v.toFixed(1)) });
      }
      return { minY: Math.min(...pts.map((p) => p.y)), under: bridge === 'hr' ? pts.filter((p) => p.y < 3 && !zone(p)).length : 0, hits, sig: pts.filter((_, k) => k % 50 === 0).map((p) => p.toArray().map((v) => +v.toFixed(3))), meshes: meshes.length };
    }, { bridge, SAMPLES, HRZ: -1700 });
    r.minY = +path.minY.toFixed(2);
    r.hits = path.hits;
    r.sig = path.sig;
    if (bridge === 'hr' ? path.under : path.minY < 3) r.problems.push(bridge === 'hr' ? `camera lọt dưới mặt đất/nước ${path.under} mẫu khi ở ngoài vùng hầm` : `camera xuống ${path.minY} m`);
    if (path.hits.length) r.problems.push(`đường bay chạm mô hình ${path.hits.length} lần: ${JSON.stringify(path.hits.slice(0, 3))}`);

    // Thoát tour bằng Esc
    await page.keyboard.press('Escape');
    await frames(page, 1);
    if (await page.evaluate(() => window.__app.cam.mode) === 'tour') r.problems.push('Esc không thoát tour');
  }
  await page.close();
  return { report, errors };
}

const origDir = process.argv[2];
const browser = await launch();
const res = {}, servers = [];
try {
  if (origDir) { const s = await serveDir(origDir); servers.push(s); res.goc = await checkTours(browser, s.url); }
  const s = await serveDir(fileURLToPath(new URL('../dist/', import.meta.url))); servers.push(s);
  res.vite = await checkTours(browser, s.url);
} finally { await browser.close(); servers.forEach((s) => s.close()); }

let fail = 0;
for (const [name, { report, errors }] of Object.entries(res)) {
  console.log(`\n=== ${name === 'goc' ? 'Bản gốc' : 'Bản Vite'} ===`);
  for (const [b, r] of Object.entries(report)) {
    console.log(`${b.padEnd(6)} ${r.stops} điểm dừng, camera thấp nhất ${r.minY} m${r.swing ? ', ' + r.swing : ''}${r.immerse ? ', ' + r.immerse : ''} → ${r.problems.length ? 'LỖI' : 'đạt'}`);
    r.problems.forEach((p) => console.log('   - ' + p));
    fail += r.problems.length;
  }
  if (errors.length) { console.log('Lỗi console:', errors); fail++; }
}
if (res.goc) {
  for (const b of Object.keys(res.vite.report)) {
    const A = res.goc.report[b], B = res.vite.report[b];
    if (!A) continue;
    const same = JSON.stringify(A.sig) === JSON.stringify(B.sig) && JSON.stringify(A.titles) === JSON.stringify(B.titles);
    console.log(`${b}: đường bay và tiêu đề ${same ? 'trùng khớp' : 'KHÁC'} bản gốc`);
    if (!same) fail++;
  }
}
process.exit(fail ? 1 : 0);

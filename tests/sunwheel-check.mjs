// Kiểm tra Vòng quay Mặt Trời (xem prompts/vong-quay-mat-troi.md, mục 11). Mở rộng dần theo giai đoạn.
// Giai đoạn 1 (khung): vị trí, hướng mặt phẳng, kích thước dẫn xuất, dọn nền không đụng nhà/cây ngoài nền, không lỗi console.
//
//   npm run build && node tests/sunwheel-check.mjs
import { fileURLToPath } from 'node:url';
import { serveDir, launch, openApp, frames } from './lib.mjs';

const problems = [];
const check = (ok, msg) => { if (!ok) problems.push(msg); return ok; };
const near = (a, b, tol) => Math.abs(a - b) <= tol;

const srv = await serveDir(fileURLToPath(new URL('../dist/', import.meta.url)));
const browser = await launch();
const { page, errors } = await openApp(browser, srv.url, { width: 480, height: 270 });
try {
  await frames(page, 3);
  const R = await page.evaluate(() => {
    const { sunWheel: W, scene, THREE } = window.__app;
    scene.updateMatrixWorld(true);
    const o = W.group.localToWorld(new THREE.Vector3(0, 0, 0)), ex = W.group.localToWorld(new THREE.Vector3(1, 0, 0)).sub(o), ez = W.group.localToWorld(new THREE.Vector3(0, 0, 1)).sub(o);
    const SW = W.cfg;
    return {
      inScene: !!W.group.parent, o: o.toArray(), ex: ex.toArray(), ez: ez.toArray(), yaw: W.group.rotation.y,
      hubY: SW.hubY, topY: SW.topY, landY: 2.5,   // landY: mặt đất (copilot-instructions mục 4)
      site: SW.site, cabins: SW.cabins, center: W.center.toArray(),
      stats: W.stats, lodDistance: W.lodDistance, children: W.group.children.map((c) => c.name)
    };
  });
  console.log('sunWheel:', JSON.stringify(R));

  // 1. Có trong cảnh, đặt đúng chỗ
  check(R.inScene, 'SunWheel chưa nằm trong scene');
  check(near(R.o[0], -440, 0.01) && near(R.o[2], 2280, 0.01), `tâm bệ lệch: ${R.o}`);
  // 2. Hướng: phương vị 83° → trục X cục bộ = (sin83°, 0, −cos83°); mặt Nam Đông Nam (+Z cục bộ) = (sin7°, 0, cos7°)
  const az = 83 * Math.PI / 180;
  check(near(R.ex[0], Math.sin(az), 1e-6) && near(R.ex[2], -Math.cos(az), 1e-6), `mặt phẳng không theo phương vị 83°: ${R.ex}`);
  check(R.ez[2] > 0.99 && R.ez[0] > 0, `mặt chính không quay về Nam Đông Nam: ${R.ez}`);
  check(near(R.yaw, 7 * Math.PI / 180, 1e-6), `yaw = ${R.yaw}`);
  // 3. Kích thước: đỉnh cabin 115 m so với mặt đất, trục cao theo suy dẫn
  check(near(R.topY - R.landY, 115, 1e-6), `đỉnh cabin cao ${R.topY - R.landY} m, cần 115`);
  check(near(R.hubY - R.landY, 64, 1e-6), `trục cao ${R.hubY - R.landY} m so với mặt đất`);
  check(R.cabins === 64, `số cabin ${R.cabins}`);
  // 4. Nền không chạm hành lang Hầm |z + 1700| < 30 và nằm trên bờ Tây (x < −262)
  check(R.site.z0 > -1670 && R.site.x1 < -262, `nền ngoài bờ Tây hoặc chạm hầm: ${JSON.stringify(R.site)}`);
  // 5. Dọn nền: khu vực này vốn không có nhà (khu phố |z| < 1 800); cây/đèn kè chỉ tới z = 2 300
  check(R.stats.clearedBuildings === 0, `dọn ${R.stats.clearedBuildings} nhà ở nơi không có nhà`);
  console.log(`dọn nền: nhà ${R.stats.clearedBuildings}, cây/đèn ${R.stats.clearedPlants}`);
  // 6. Khung rỗng: chưa có mesh nào ngoài details/life
  check(R.children.every((n) => /details|life/.test(n)), `giai đoạn 1 chưa được có mesh: ${R.children}`);
  // 7. Console sạch
  check(errors.length === 0, `lỗi console: ${errors.join(' | ')}`);
} finally { await browser.close(); srv.close(); }

if (problems.length) { console.error('sunwheel-check: LỖI\n - ' + problems.join('\n - ')); process.exit(1); }
console.log('sunwheel-check: đạt');

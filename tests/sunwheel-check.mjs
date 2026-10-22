// Kiểm tra Vòng quay Mặt Trời (xem prompts/vong-quay-mat-troi.md, mục 11). Mở rộng dần theo giai đoạn.
// Giai đoạn 1 (khung): vị trí, hướng mặt phẳng, kích thước dẫn xuất, dọn nền không đụng nhà/cây ngoài nền, không lỗi console.
// Giai đoạn 2 (hình học): đủ mesh, 64 cabin đứng thẳng, đỉnh cabin 115 m, không chạm hành lang Hầm, lớp 1 + không đổ bóng, LOD,
// draw call do vòng quay thêm vào (góc cũ ≤ 2, gần ≤ 6, ngày = đêm; mục 9 của đặc tả).
//
//   npm run build && node tests/sunwheel-check.mjs
import { fileURLToPath } from 'node:url';
import { serveDir, launch, openApp, frames, pickView } from './lib.mjs';

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
  // 6. (GĐ1: khung rỗng → từ GĐ2) group chỉ có phần tĩnh + phần quay, ngoài details/life
  check(['sw-static', 'sw-wheel'].every((n) => R.children.includes(n)) && R.children.every((n) => /details|life|sw-static|sw-wheel/.test(n)), `mesh của vòng quay: ${R.children}`);

  // ---- Giai đoạn 2 ----
  const G = await page.evaluate(() => {
    const { sunWheel: W, scene, THREE } = window.__app;
    scene.updateMatrixWorld(true);
    const cab = W.cabins, m = new THREE.Matrix4(), up = new THREE.Vector3(), p = new THREE.Vector3(), q = new THREE.Quaternion(), s = new THREE.Vector3();
    cab.geometry.computeBoundingBox();
    let maxTilt = 0, top = -Infinity;
    for (let i = 0; i < cab.count; i++) {
      cab.getMatrixAt(i, m); m.premultiply(cab.matrixWorld); m.decompose(p, q, s);
      up.set(0, 1, 0).applyQuaternion(q); maxTilt = Math.max(maxTilt, up.angleTo(new THREE.Vector3(0, 1, 0)));
      top = Math.max(top, p.y + cab.geometry.boundingBox.max.y * s.y);
    }
    const box = new THREE.Box3().setFromObject(W.group);
    const meshes = []; W.group.traverse((o) => { if (o.isMesh) meshes.push({ name: o.name, layer0: o.layers.isEnabled(0), cast: o.castShadow }); });
    return { count: cab.count, maxTilt: maxTilt * 180 / Math.PI, top, z0: box.min.z, z1: box.max.z, meshes, inDetails: [cab.parent === W.details, W.sign.parent === W.details], landY: 2.5 };
  });
  console.log('GĐ2:', JSON.stringify(G));
  check(G.count === 64, `số cabin instance ${G.count}`);
  check(G.inDetails.every(Boolean), 'cabin / biển hiệu phải nằm trong details (LOD)');
  check(G.maxTilt <= 2, `cabin nghiêng ${G.maxTilt.toFixed(2)}° (≤ 2°)`);
  check(near(G.top - G.landY, 115, 1), `đỉnh cabin cao nhất ${(G.top - G.landY).toFixed(2)} m so với mặt đất, cần 115 ± 1`);
  check(G.z0 > -1670 || G.z1 < -1730, `vòng quay chạm hành lang Hầm: z ${G.z0}..${G.z1}`);
  check(G.meshes.length >= 4, `chỉ có ${G.meshes.length} mesh`);
  check(G.meshes.every((o) => !o.layer0 && !o.cast), `mesh phải ở lớp 1 (không phản chiếu) và không đổ bóng: ${JSON.stringify(G.meshes)}`);

  /* draw call do vòng quay thêm vào: bật/tắt group, trung vị 3 khung */
  const delta = () => page.evaluate(async () => {
    const { renderer, sunWheel: W } = window.__app;
    const f = () => new Promise((ok) => requestAnimationFrame(() => requestAnimationFrame(ok)));
    const med = async () => { const xs = []; for (let i = 0; i < 3; i++) { await f(); xs.push(renderer.info.render.calls); } return xs.sort((a, b) => a - b)[1]; };
    const on = await med(); W.group.visible = false; const off = await med(); W.group.visible = true; await f();
    return { d: on - off, details: W.details.visible };
  });
  const camLocal = (p, t) => page.evaluate(([p, t]) => {
    const { camera, controls, sunWheel: W, THREE } = window.__app;
    controls.maxPolarAngle = Math.PI * 0.97;
    camera.position.copy(W.group.localToWorld(new THREE.Vector3(...p))); controls.target.copy(W.group.localToWorld(new THREE.Vector3(...t))); controls.update();
  }, [p, t]);
  const setNight = async (v) => {
    await page.evaluate((v) => { window.__app.dayNight.target = v; window.__app.dayNight.night = v; }, v);
    await page.waitForFunction((v) => Math.abs(window.__app.dayNight.night - v) < 1e-6, v, { timeout: 60000 });
    await frames(page, 3);
  };
  // góc cũ có vòng quay trong khung hình (đều xa hơn lodDistance) và camera gần (chính diện, flycam, trên cao)
  const OLD = [['ttl', 'ttlBoth'], ['sh', 'shOverview'], ['dragon', 'bird'], ['tp', 'tpBay']];
  const NEAR = { front: [[0, 8, 230], [0, 55, 0]], fly: [[-150, 150, 320], [0, 45, 0]], top: [[0, 140, 160], [0, 60, 0]] };
  const D = {};
  for (const night of [0, 1]) {
    await setNight(night);
    for (const [b, v] of OLD) { await pickView(page, b, v); await frames(page, 4); D[`${v}|${night}`] = await delta(); }
    for (const [k, [p, t]] of Object.entries(NEAR)) { await camLocal(p, t); await frames(page, 3); D[`${k}|${night}`] = await delta(); }
  }
  console.log('draw call vòng quay:', JSON.stringify(D));
  for (const [, v] of OLD) for (const n of [0, 1]) {
    check(D[`${v}|${n}`].d <= 2, `${v} ${n ? 'đêm' : 'ngày'}: vòng quay thêm ${D[`${v}|${n}`].d} draw call (≤ 2)`);
    check(!D[`${v}|${n}`].details, `${v}: chi tiết (cabin) phải ẩn ở xa`);
  }
  for (const k of Object.keys(NEAR)) for (const n of [0, 1]) {
    check(D[`${k}|${n}`].d <= 6, `${k} ${n ? 'đêm' : 'ngày'}: vòng quay thêm ${D[`${k}|${n}`].d} draw call (≤ 6)`);
    check(D[`${k}|${n}`].details, `${k}: chi tiết phải hiện ở gần`);
  }
  for (const k of [...OLD.map(([, v]) => v), ...Object.keys(NEAR)]) check(D[`${k}|0`].d === D[`${k}|1`].d, `${k}: draw call vòng quay ngày ${D[`${k}|0`].d} ≠ đêm ${D[`${k}|1`].d}`);
  // 7. Console sạch
  check(errors.length === 0, `lỗi console: ${errors.join(' | ')}`);
} finally { await browser.close(); srv.close(); }

if (problems.length) { console.error('sunwheel-check: LỖI\n - ' + problems.join('\n - ')); process.exit(1); }
console.log('sunwheel-check: đạt');

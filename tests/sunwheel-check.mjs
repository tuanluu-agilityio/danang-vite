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
  // ---- Giai đoạn 3: quay, cabin đứng thẳng, tốc độ, góc nhìn sw* (mục 3, 9, 11) ----
  // 1. Chu kỳ: tích phân deterministic W.advance(giây); page.evaluate chạy đồng bộ nên vòng lặp thật không chen vào
  const M = await page.evaluate(() => {
    const { sunWheel: W } = window.__app, TAU = Math.PI * 2, out = {};
    const wrap = (d) => ((d % TAU) + TAU) % TAU;
    W.setSpeed(1); W.advance(30); out.speed1 = W.speedNow();                       // đã ở ×1 từ đầu
    W.setAngle(0); W.advance(90); out.a90 = W.angle();                              // ×1, 90 s → 2π/10
    W.setSpeed(60); W.advance(5); out.mid = W.speedNow(); W.advance(10); out.speed60 = W.speedNow();   // đổi tốc độ mượt: 1 → 60 mất ≈ 9,8 s
    W.setAngle(0); W.advance(10); out.a60 = W.angle();                              // ×60, 10 s → 2π·600/900 = 4π/3
    W.setSpeed(10); W.advance(10); W.setAngle(0); W.advance(30); out.a10 = W.angle();   // ×10, 30 s → 2π/3
    W.setSpeed(60); W.advance(12); W.setSpeed(0); W.advance(5); out.stopMid = W.speedNow(); W.advance(6); out.stopped = W.speedNow(); const a = W.angle(); W.advance(20); out.stopDrift = wrap(W.angle() - a);
    W.setSpeed(1); W.advance(1);
    out.omega = W.cfg.omega; out.accel = W.cfg.speedAccel;
    return out;
  });
  console.log('GĐ3 chu kỳ:', JSON.stringify(M));
  const TAU = 2 * Math.PI;
  check(near(M.speed1, 1, 1e-9), `tốc độ mặc định ${M.speed1}, cần 1`);
  check(near(M.a90 / (TAU / 10), 1, 0.01), `×1 sau 90 s góc ${M.a90} rad, cần ${TAU / 10} (sai ≤ 1 %)`);
  check(near(M.mid, 1 + 5 * M.accel, 1e-6) && M.speed60 === 60, `đổi tốc độ không mượt: sau 5 s ${M.mid}, sau 15 s ${M.speed60}`);
  check(near(M.a60 / (TAU * 600 / 900), 1, 0.01), `×60 sau 10 s góc ${M.a60}, cần ${TAU * 600 / 900} (60 lần ×1)`);
  check(near(M.a10 / (TAU * 30 * 10 / 900), 1, 0.01), `×10 sau 30 s góc ${M.a10}, cần ${TAU * 300 / 900}`);
  check(near(M.stopMid, 60 - 5 * M.accel, 1e-6) && M.stopped === 0 && M.stopDrift === 0, `dừng: giữa chừng ${M.stopMid}, cuối ${M.stopped}, trôi ${M.stopDrift}`);
  // 2–3. Cabin đứng thẳng, bám vành, đỉnh cabin 115 m ở mọi góc
  const C = await page.evaluate(() => {
    const { sunWheel: W, scene, THREE } = window.__app, SW = W.cfg;
    scene.updateMatrixWorld(true);
    const hub = W.group.localToWorld(new THREE.Vector3(0, SW.hubY, 0)), up = new THREE.Vector3(), p = new THREE.Vector3(), q = new THREE.Vector3();
    W.cabins.geometry.computeBoundingBox(); const halfH = W.cabins.geometry.boundingBox.max.y;
    let maxTilt = 0, ringErr = 0, lockErr = 0, top = -Infinity, topMin = Infinity, zMin = Infinity, zMax = -Infinity, stepErr = 0;
    for (const th of [0, 0.7, 2.1, 3.9, 5.5]) {
      W.setAngle(th);
      // điểm vành ở góc th trong khung của group quay → cabin 0 phải ở cùng hướng từ trục
      W.wheel.updateWorldMatrix(true, false);
      const rim = W.wheel.localToWorld(new THREE.Vector3(SW.rimR, 0, 0)).sub(hub).normalize();
      for (let i = 0; i < SW.cabins; i++) {
        W.cabinUp(i, up); maxTilt = Math.max(maxTilt, up.angleTo(new THREE.Vector3(0, 1, 0)));
        W.cabinWorld(i, p); const d = p.clone().sub(hub);
        ringErr = Math.max(ringErr, Math.abs(d.length() - SW.cabinR), Math.abs(d.dot(W.group.localToWorld(new THREE.Vector3(0, 0, 1)).sub(W.group.localToWorld(new THREE.Vector3())))));
        zMin = Math.min(zMin, p.z); zMax = Math.max(zMax, p.z);
        if (i === 0) lockErr = Math.max(lockErr, d.clone().normalize().angleTo(rim));
        if (i > 0) { W.cabinWorld(i - 1, q); stepErr = Math.max(stepErr, Math.abs(q.distanceTo(p) - 2 * SW.cabinR * Math.sin(SW.cabinStep / 2))); }
      }
    }
    for (let k = 0; k < 126; k++) {   // đỉnh cabin cao nhất theo từng góc (cabin ở giờ 12 khi θ + i·bước = π/2)
      W.setAngle(k * 0.05); let t = -Infinity; for (let i = 0; i < SW.cabins; i++) t = Math.max(t, W.cabinWorld(i, p).y + halfH);
      top = Math.max(top, t); topMin = Math.min(topMin, t);
    }
    W.setAngle(0);
    return { maxTilt: maxTilt * 180 / Math.PI, ringErr, lockErr: lockErr * 180 / Math.PI, stepErr, top, topMin, zMin, zMax, landY: 2.5 };
  });
  console.log('GĐ3 cabin:', JSON.stringify(C));
  check(C.maxTilt <= 2, `cabin nghiêng ${C.maxTilt.toFixed(3)}° khi quay (≤ 2°)`);
  check(C.ringErr < 1e-3, `cabin lệch khỏi vòng bán kính cabinR hoặc ra ngoài mặt phẳng: ${C.ringErr}`);
  check(C.stepErr < 1e-3, `khoảng cách giữa hai cabin liền kề không đều: ${C.stepErr}`);
  check(C.lockErr < 0.01, `cabin 0 không bám đúng điểm vành (lệch ${C.lockErr.toFixed(4)}°)`);
  check(near(C.top - C.landY, 115, 1) && near(C.topMin - C.landY, 115, 4.5), `đỉnh cabin cao nhất ${(C.top - C.landY).toFixed(2)} m (min theo góc ${(C.topMin - C.landY).toFixed(2)} m), cần 115 ± 1`);
  check(C.zMin > -1670 || C.zMax < -1730, `cabin vào hành lang Hầm: z ${C.zMin}..${C.zMax}`);
  // Ngưỡng 1e-4 m: ma trận instance là float32 (ulp ở y≈115 m ≈ 7,6e-6 m, đo được 1,8e-6 m); ma trận trễ một bước placeEps (1e-4 rad × cabinR ≈ 4,6e-3 m) vẫn bị bắt
  const SYNC_TOL = 1e-4;
  // Đường cập nhật theo khung: ma trận instance (đọc thô, không ép dựng lại) bám đúng góc khi nhìn gần; ở xa thì được phép trễ, quay lại gần thì đúng ngay
  const sync = (label) => page.evaluate((label) => {
    const { sunWheel: W, THREE } = window.__app, SW = W.cfg, m = new THREE.Matrix4(), p = new THREE.Vector3();
    W.cabins.getMatrixAt(0, m); p.setFromMatrixPosition(m);
    const th = W.angle(), ex = Math.cos(th) * SW.cabinR, ey = SW.hubY + Math.sin(th) * SW.cabinR;
    return { label, err: Math.hypot(p.x - ex, p.y - ey), details: W.details.visible, th };
  }, label);
  await camLocal(...NEAR.front); await page.evaluate(() => window.__app.sunWheel.setSpeed(60)); await frames(page, 6);
  const S1 = await sync('gần'); check(S1.details && S1.err < SYNC_TOL, `gần: cabin không bám góc vòng quay (lệch ${S1.err} m, details ${S1.details})`);
  await page.evaluate(() => { const { camera, controls } = window.__app; camera.position.set(0, 300, -3000); controls.target.set(0, 0, -2900); controls.update(); }); await frames(page, 4);
  const far0 = await page.evaluate(() => ({ th: window.__app.sunWheel.angle(), vis: window.__app.sunWheel.details.visible }));
  await frames(page, 6);
  const far1 = await page.evaluate(() => ({ th: window.__app.sunWheel.angle(), vis: window.__app.sunWheel.details.visible }));
  check(!far1.vis && Math.abs(far1.th - far0.th) > 1e-3, `ở xa vòng quay vẫn phải quay (góc ${far0.th} → ${far1.th}, details ${far1.vis})`);
  await camLocal(...NEAR.front); await frames(page, 4);
  const S2 = await sync('quay lại gần'); check(S2.details && S2.err < SYNC_TOL, `quay lại gần: cabin chưa bám góc (lệch ${S2.err} m)`);
  await page.evaluate(() => window.__app.sunWheel.setSpeed(1));

  // 6. Draw call ở các góc nhìn sw* (≤ 6, ngày = đêm, quay không đổi số draw call); chọn góc xong mới đặt ngày/đêm vì swNight tự chuyển sang đêm
  const SWV = ['swOverview', 'swFront', 'swBase', 'swFromTTL', 'swNight', 'swTop'];
  const DS = {};
  for (const speed of [0, 60]) for (const night of [0, 1]) for (const v of SWV) {
    await pickView(page, 'sw', v); await setNight(night); await page.evaluate((s) => window.__app.sunWheel.setSpeed(s), speed); await frames(page, 4);
    DS[`${v}|${night}|${speed}`] = await delta();
  }
  await page.evaluate(() => window.__app.sunWheel.setSpeed(1));
  console.log('draw call góc sw*:', JSON.stringify(DS));
  for (const v of SWV) {
    for (const n of [0, 1]) for (const s of [0, 60]) check(DS[`${v}|${n}|${s}`].d <= 6, `${v} ${n ? 'đêm' : 'ngày'} ×${s}: vòng quay thêm ${DS[`${v}|${n}|${s}`].d} draw call (≤ 6)`);
    check(DS[`${v}|0|0`].d === DS[`${v}|1|0`].d && DS[`${v}|0|60`].d === DS[`${v}|1|60`].d, `${v}: draw call ngày ≠ đêm (${DS[`${v}|0|0`].d}/${DS[`${v}|1|0`].d})`);
    check(DS[`${v}|0|0`].d === DS[`${v}|0|60`].d, `${v}: quay làm đổi draw call (${DS[`${v}|0|0`].d} → ${DS[`${v}|0|60`].d})`);
  }
  // Góc nhìn sw*: camera trên mặt đất, đích nhìn vào vòng quay, mọi góc đã có nút
  const V = await page.evaluate(async (list) => {
    const { camera, controls } = window.__app, out = {};
    for (const v of list) { document.querySelector(`button[data-view="${v}"]`).click(); await new Promise((ok) => setTimeout(ok, 50)); out[v] = { btn: !!document.querySelector(`[data-list="sw"] button[data-view="${v}"]`) }; }
    return out;
  }, SWV);
  for (const v of SWV) check(V[v].btn, `thiếu nút góc nhìn ${v} trong nhóm sw`);

  // UI: nút công trình, ô tốc độ, bảng thông số
  const U = await page.evaluate(async () => {
    const sel = document.getElementById('swSpeed'), out = {};
    const list = document.querySelector('[data-list="sw"]'), others = [...document.querySelectorAll('[data-list]')].filter((l) => l !== list);
    document.querySelector('button[data-bridge="sw"]').click();
    out.listShown = !list.hidden && others.every((l) => l.hidden);
    out.opts = [...sel.options].map((o) => o.value);
    for (const v of ['10', '0', '60', '1']) { sel.value = v; sel.dispatchEvent(new Event('change')); out['g' + v] = window.__app.sunWheel.speedTarget(); }
    out.note = document.getElementById('specNote').textContent; out.span = document.getElementById('specSpanVal').textContent;
    return out;
  });
  check(U.listShown, 'chọn Vòng quay phải hiện danh sách góc nhìn sw và ẩn nhóm khác');
  check(U.opts.join() === '0,1,10,60', `ô tốc độ: ${U.opts}`);
  check(U.g10 === 10 && U.g0 === 0 && U.g60 === 60 && U.g1 === 1, `ô tốc độ không đặt đúng tốc độ đích: ${JSON.stringify(U)}`);
  check(U.note.length > 40 && !/^sw[A-Z]/.test(U.note) && /2025/.test(U.note), `bảng thông số chưa có ghi chú hiện trạng: ${U.note}`);
  // 7. i18n: 14 khóa mới đủ ở cả 9 locale, không rỗng
  const { readFile } = await import('node:fs/promises');
  const KEYS = ['bridgeSw', 'vSwFront', 'vSwBase', 'vSwFromTTL', 'vSwNight', 'vSwTop', 'swWheelSpeed', 'swWheelStop', 'swWheelReal', 'swLengthVal', 'swWidthVal', 'swSpan', 'swSpanVal', 'swNote'];
  for (const code of ['vi', 'en', 'ko', 'ja', 'zh', 'th', 'ar', 'hi', 'ru']) {
    const j = JSON.parse(await readFile(new URL(`../src/i18n/locales/${code}.json`, import.meta.url), 'utf8'));
    const miss = KEYS.filter((k) => typeof j[k] !== 'string' || !j[k].trim());
    check(miss.length === 0, `locale ${code} thiếu khóa Vòng quay: ${miss}`);
    check(/2025/.test(j.swNote || ''), `locale ${code}: swNote thiếu ghi chú hiện trạng (9/2025)`);
  }
  // 7. Console sạch
  check(errors.length === 0, `lỗi console: ${errors.join(' | ')}`);
} finally { await browser.close(); srv.close(); }

if (problems.length) { console.error('sunwheel-check: LỖI\n - ' + problems.join('\n - ')); process.exit(1); }
console.log('sunwheel-check: đạt');

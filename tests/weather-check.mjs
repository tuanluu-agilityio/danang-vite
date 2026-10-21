// Kiểm tra thời tiết (xem prompts/ke-hoach-thoi-tiet.md mục 11). Hiện có phần Giai đoạn 2; các giai đoạn sau thêm tiếp.
//  GĐ2.1 Preset `now`: mọi giá trị khí quyển bằng giá trị trước khi áp thời tiết (không nhúc nhích).
//  GĐ2.2 storm -> now (ngày và đêm): mọi giá trị khớp TUYỆT ĐỐI với chụp gốc (sương, Sky, nước, mây, ánh sáng, exposure).
//  GĐ2.3 Mỗi preset khác `now` thật sự đổi cảnh (sương dày hơn khi mưa/bão); không lỗi console.
//  GĐ5 Bão: songHan.ctrl.start() -> false, trình diễn tạm dừng, không còn xe khu phố, quảng cáo tắt; draw call ≤ now + 2; hết bão trả lại xe, quảng cáo, nút người dùng.
//
//   npm run build && node tests/weather-check.mjs
import { fileURLToPath } from 'node:url';
import { serveDir, launch, openApp, frames } from './lib.mjs';
import { snapAtmosphere, setWx } from './weather-lib.mjs';

const problems = [];
const check = (ok, msg) => { if (!ok) problems.push(msg); return ok; };
const diff = (a, b) => Object.keys(a).filter((k) => JSON.stringify(a[k]) !== JSON.stringify(b[k]));

const srv = await serveDir(fileURLToPath(new URL('../dist/', import.meta.url)));
const browser = await launch();
const { page, errors } = await openApp(browser, srv.url, { width: 480, height: 270 });
try {
  for (const night of [0, 1]) {
    await page.evaluate((n) => { const d = window.__app.dayNight; d.target = d.night = n; }, night);
    await frames(page, 3);
    const base = await snapAtmosphere(page);
    await setWx(page, 'now');
    check(diff(base, await snapAtmosphere(page)).length === 0, `night=${night}: preset now đổi ${diff(base, await snapAtmosphere(page))}`);
    for (const p of ['summer', 'rain', 'monsoon', 'storm']) {
      await setWx(page, p);
      const s = await snapAtmosphere(page);
      check(diff(base, s).length > 0, `night=${night}: preset ${p} không đổi gì`);
      if (p === 'rain' || p === 'storm') check(s.fogDensity > base.fogDensity * 4, `night=${night}: ${p} sương chưa dày (${s.fogDensity})`);
    }
    await setWx(page, 'storm'); await setWx(page, 'now');
    const back = await snapAtmosphere(page), d = diff(base, back);
    check(d.length === 0, `night=${night}: storm -> now không về đúng giá trị gốc: ${d.map((k) => `${k} ${JSON.stringify(base[k])} != ${JSON.stringify(back[k])}`).join('; ')}`);
  }
  /* GĐ5: vận hành khi bão. Ban ngày, góc nhìn overview */
  await page.evaluate(() => { const d = window.__app.dayNight; d.target = d.night = 0; });
  const wait = (pred) => page.evaluate((src) => new Promise((ok) => { const p = new Function('w', 'return ' + src); let n = 0; const f = () => (p(window.__app.weather) || ++n > 600 ? ok(n) : requestAnimationFrame(f)); requestAnimationFrame(f); }), pred);
  // số draw call lớn nhất trong 10 khung; strike = ép một tia chớp ngay để bắt cả lúc chớp
  const maxCalls = (strike) => page.evaluate((strike) => new Promise((ok) => { const { weather, renderer } = window.__app; let n = 0, m = 0; if (strike) weather.lightning.strike(); const f = () => { m = Math.max(m, renderer.info.render.calls); (++n >= 10 ? ok(m) : requestAnimationFrame(f)); }; requestAnimationFrame(f); }), strike);
  const cityVis = () => page.evaluate(() => { const m = window.__app.scene.children.find((o) => o.isInstancedMesh && o.count === 536); let v = 0; for (let i = 0; i < m.count; i++) if (m.instanceMatrix.array[i * 16] !== 0) v++; return v; });
  const userState = () => page.evaluate(() => { const a = window.__app; return JSON.stringify({ ads: a.riverfront.adsEnabled, sh: a.songHan.lifeOn, hr: a.hr.lifeOn }); });
  await setWx(page, 'now'); await wait('w.fx().clear <= 0 && w.fx().boatAway <= 0'); await frames(page, 3);
  const user0 = await userState(), callsNow = await maxCalls(false), vis0 = await cityVis();
  check(vis0 === 536, `GĐ5: preset now phải còn đủ xe khu phố (${vis0}/536)`);
  check(await page.evaluate(() => window.__app.weather.fx().showAllowed && !window.__app.weather.fx().swingBlocked), 'GĐ5: preset now không được khoá trình diễn / cầu quay');
  await setWx(page, 'storm'); await wait('w.fx().clear >= 1'); await frames(page, 3);
  check(await page.evaluate(() => window.__app.songHan.ctrl.start() === false && window.__app.songHan.ctrl.state === 'CLOSED'), 'GĐ5: bão thì songHan.ctrl.start() phải trả false và cầu vẫn đóng');
  check(!(await page.evaluate(() => window.__app.weather.fx().showAllowed)), 'GĐ5: bão thì trình diễn Cầu Rồng phải tạm dừng (showAllowed = false)');
  // 536 xe = axis 200 + ttl 104 (hai cầu, bị dọn) + hai phố bờ sông 232 (Bạch Đằng, Trần Hưng Đạo: không phải cầu, vẫn chạy)
  check((await cityVis()) === 232, `GĐ5: bão thì không còn xe trên PATHS.axis / ttl, chỉ còn 232 xe phố bờ sông (còn ${await cityVis()}/536)`);
  check(await page.evaluate(() => window.__app.riverfront.adsEnabled === false), 'GĐ5: bão thì quảng cáo phải tắt tạm');
  const callsStorm = await maxCalls(true);
  check(callsStorm <= callsNow + 2, `GĐ5: draw call bão (tối đa 10 khung, có chớp) ${callsStorm} > now ${callsNow} + 2`);
  await setWx(page, 'now'); await wait('w.fx().clear <= 0 && w.fx().boatAway <= 0'); await frames(page, 3);
  check((await cityVis()) === 536, 'GĐ5: hết bão xe phải hiện lại đủ');
  check((await userState()) === user0, `GĐ5: hết bão nút người dùng phải giữ nguyên: ${user0} -> ${await userState()}`);
  check(await page.evaluate(() => window.__app.songHan.ctrl.canStart()), 'GĐ5: hết bão thì cầu quay lại được (canStart)');
  check(errors.length === 0, `lỗi console: ${errors.slice(0, 3).join(' | ')}`);
} finally { await browser.close(); srv.close(); }
if (problems.length) { console.log('THẤT BẠI:\n- ' + problems.join('\n- ')); process.exit(1); }
console.log('weather-check: đạt');

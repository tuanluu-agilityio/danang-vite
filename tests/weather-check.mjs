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
  /* GĐ7: kịch bản bão chạy hết (tua ×30), trả preset + ngày/đêm + khí quyển gốc; cây đổ dựng lại; không rò rỉ bộ nhớ GPU */
  const mem = () => page.evaluate(() => { const i = window.__app.renderer.info; return { g: i.memory.geometries, t: i.memory.textures, p: i.programs.length }; });
  const runScenario = () => page.evaluate(() => new Promise((ok) => {
    const sc = window.__app.weather.scenario; let n = 0; const caps = new Set();
    sc.start({ speed: 30 });
    const f = () => { caps.add(sc.step); (!sc.running || ++n > 6000) ? ok({ n, steps: caps.size, running: sc.running }) : requestAnimationFrame(f); };
    requestAnimationFrame(f);
  }));
  await setWx(page, 'now'); await wait('w.fx().clear <= 0 && w.fx().boatAway <= 0'); await frames(page, 3);
  await page.evaluate(() => { const d = window.__app.dayNight; d.target = d.night = 0; });
  await frames(page, 3);
  const base7 = await snapAtmosphere(page);
  // khởi động: lần đầu three mới đếm geometry của mesh chớp khi nó được vẽ (tải GPU lười, không phải rò rỉ) -> vẽ trước một lần, rồi đo mốc
  await setWx(page, 'storm'); await page.evaluate(() => window.__app.weather.lightning.strike()); await frames(page, 6);
  await setWx(page, 'now'); await wait('w.fx().clear <= 0 && w.fx().boatAway <= 0'); await frames(page, 3);
  const m0 = await mem();
  for (let run = 1; run <= 3; run++) {
    const r = await runScenario();
    check(!r.running, `GĐ7: kịch bản lần ${run} chưa hết sau ${r.n} khung`);
    check(r.steps >= 8, `GĐ7: kịch bản lần ${run} chỉ qua ${r.steps} mốc`);
    await frames(page, 4);
    const e = await page.evaluate(() => { const a = window.__app, s = a.weather.state; return { preset: s.preset, enabled: a.weather.enabled, night: a.dayNight.night, trees: a.weather.fallen.state().down }; });
    check(e.preset === 'now' && !e.enabled, `GĐ7: kịch bản lần ${run} xong phải trả preset now: ${JSON.stringify(e)}`);
    check(e.night === 0, `GĐ7: kịch bản lần ${run} làm đổi ngày/đêm (${e.night})`);
    check(e.trees === 0, `GĐ7: kịch bản lần ${run} xong còn ${e.trees} cây đổ`);
    const mk = await mem();
    check(mk.g === m0.g && mk.t === m0.t, `GĐ7: rò rỉ sau kịch bản lần ${run}: geometries/textures ${m0.g}/${m0.t} -> ${mk.g}/${mk.t}`);
  }
  for (let round = 0; round < 5; round++) for (const p of ['rain', 'storm', 'summer', 'monsoon', 'now']) await setWx(page, p);
  const m1 = await mem();
  check(m1.g === m0.g && m1.t === m0.t, `GĐ7: rò rỉ sau 5 vòng đổi preset: geometries/textures ${m0.g}/${m0.t} -> ${m1.g}/${m1.t}`);
  check(m1.p <= m0.p, `GĐ7: số program tăng sau kịch bản/đổi preset: ${m0.p} -> ${m1.p}`);
  const back7 = await snapAtmosphere(page), d7 = diff(base7, back7);
  check(d7.length === 0, `GĐ7: sau kịch bản khí quyển không về gốc: ${d7.join(', ')}`);
  check(errors.length === 0, `lỗi console: ${errors.slice(0, 3).join(' | ')}`);
} finally { await browser.close(); srv.close(); }
if (problems.length) { console.log('THẤT BẠI:\n- ' + problems.join('\n- ')); process.exit(1); }
console.log('weather-check: đạt');

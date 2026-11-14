// Mục 15 của tests/bike-check.mjs (chỉ chạy với `-- --multi`): hai trang xe máy cùng phòng qua `wrangler dev` CỤC BỘ (cổng 8799, mẫu tests/multi-check.mjs Mục 7).
//   Không bao giờ nối Worker thật danang-sky. Tự spawn wrangler dev và luôn kill khi xong hoặc lỗi.
//   15a: hai trang bấm thẻ Xe máy → sảnh → chọn nhân vật (A nam ch 0, B nữ ch 1) → tên → lái (phiên 'drive', đang lái xe máy, slot khác nhau).
//   15b: mỗi trang thấy người kia là XE MÁY (nhóm drive-bikes có 1 xe hiện, không có ô tô người khác trong drive-cars).
//   15c: xe máy người kia là xe thật + người lái có xương đúng nhân vật người đó chọn (__app.multi.drivers.debug, chờ nạp xong); lệnh vẽ của nó
//        (ẩn / hiện nhóm drive-bikes, hai lần render liền trong một evaluate) chỉ ghi lại, không còn trần 4 (yêu cầu người dùng 2026-11-14; mong 15 = xe 11 + người 4).
//   15d: trang 1 nghiêng trái (lái vòng trái 10 m/s) ⇒ trang 2 thấy xe đó nghiêng cùng dấu (lean = −roll.rotation.x của nút cuộn).
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
import { openApp, frames } from './lib.mjs';

const PORT = 8799, HOST = `127.0.0.1:${PORT}`;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export async function multiSection({ browser, srv, check, info, allErrors }) {
  const wr = spawn(process.platform === 'win32' ? 'npx.cmd' : 'npx', ['wrangler', 'dev', '--port', String(PORT)], { cwd: fileURLToPath(new URL('../server/multi/', import.meta.url)), shell: process.platform === 'win32', stdio: ['ignore', 'pipe', 'pipe'] });
  let log = ''; wr.stdout.on('data', (d) => { log += d; }); wr.stderr.on('data', (d) => { log += d; });
  const stop = () => { try { if (process.platform === 'win32') spawn('taskkill', ['/pid', String(wr.pid), '/T', '/F']); else wr.kill(); } catch { /* bỏ qua */ } };
  process.on('exit', stop);
  const pages = [];
  try {
    for (let i = 0; i < 120; i++) { if (/Ready on/.test(log)) break; await sleep(500); }
    if (!check('15 wrangler dev cục bộ sẵn sàng (cổng 8799)', /Ready on/.test(log))) { console.log(log.slice(-2000)); return; }
    const URL = srv.url + '?chooser&multi=' + encodeURIComponent(`ws://${HOST}/sky`) + '&idleMs=600000';
    const join = async (name, ch) => {
      const X = await openApp(browser, URL, { width: 480, height: 270 });
      X.page.setDefaultTimeout(300000);
      pages.push([name, X]);
      await X.page.waitForSelector('#chooser', { state: 'visible', timeout: 300000 });
      await X.page.click('#chooser [data-pick="bike"]');
      await X.page.waitForFunction(() => /\d/.test(document.getElementById('exMpSeats')?.innerText || ''), null, { timeout: 120000 }).catch(() => {});
      await X.page.click(`#stCharPick button[data-ch="${ch}"]`);
      await X.page.fill('#exMpNameIn', name);
      await X.page.click('#exMpFly');
      await X.page.waitForFunction(() => window.__app.bike.active() && window.__app.multi.session && window.__app.multi.session.phase === 'flying', null, { timeout: 180000, polling: 500 });
      return X;
    };
    const X1 = await join('XeA', 0);
    const X2 = await join('XeB', 1);
    const me = async (X) => X.page.evaluate(() => { const s = window.__app.multi.session; return { kind: s.kind, slot: s.mySlot, bike: window.__app.bike.active(), car: window.__app.drive.active() }; });
    const m1 = await me(X1), m2 = await me(X2);
    check(`15a hai trang vào lái xe máy: A kind ${m1.kind} slot ${m1.slot}, B kind ${m2.kind} slot ${m2.slot} (khác nhau), đang lái xe máy ${m1.bike} / ${m2.bike}, không lái ô tô`,
      m1.kind === 'drive' && m2.kind === 'drive' && m1.slot >= 0 && m2.slot >= 0 && m1.slot !== m2.slot && m1.bike && m2.bike && !m1.car && !m2.car);
    /* trang 1: thay bike.update bằng bước có đầu vào cố định (giữ 10 m/s, bẻ trái hết) ⇒ nghiêng trái, gửi st = lean · 0,8 như khi lái thật */
    await X1.page.evaluate(() => {
      const B = window.__app.bike, step = B.step.bind(B), inp = { gas: 0, brake: 0, steer: 1, hard: false, grip: 1 };
      for (const f of window.__app.traffic.fleets()) f.mesh.visible = false;
      B.update = (dt) => { const s = B.state; if (!s) return; inp.gas = s.v < 8 ? 1 : 0; step(dt, inp); };
      B.state.v = 8;
    });
    await X2.page.evaluate(() => { const B = window.__app.bike, step = B.step.bind(B), inp = { gas: 0, brake: 0, steer: 0, hard: false, grip: 1 }; B.update = (dt) => { if (B.state) step(dt, inp); }; });
    const seen = (X) => X.page.waitForFunction(() => { const g = window.__app.scene.getObjectByName('drive-bikes'); return !!g && !!g.parent && g.children.filter((o) => o.visible).length >= 1; }, null, { timeout: 180000, polling: 1000 }).catch(() => {});
    await Promise.all([seen(X1), seen(X2)]);
    const real = (X) => X.page.waitForFunction(() => { const D = window.__app.multi.drivers; return [0, 1, 2, 3, 4].some((i) => { const d = D.debug(i); return d && d.real; }); }, null, { timeout: 240000, polling: 1000 }).catch(() => {});
    await Promise.all([real(X1), real(X2)]);
    await frames(X1.page, 3); await frames(X2.page, 3);
    const view = (X) => X.page.evaluate(() => {
      const A = window.__app, g = A.scene.getObjectByName('drive-bikes'), cars = A.scene.getObjectByName('drive-cars');
      const vis = g && g.parent ? g.children.filter((o) => o.visible) : [];
      const carVis = cars && cars.parent ? cars.children.filter((o) => o.name === 'drive-car' && o.visible).length : 0;
      let meshes = 0, lean = NaN, dbg = null;
      if (vis[0]) { vis[0].traverse((o) => { if (o.isMesh && o.visible) meshes++; }); const roll = vis[0].children.find((o) => o.type === 'Group'); if (roll) lean = -roll.rotation.x; }
      for (let i = 0; i < 5; i++) { const d = A.multi.drivers.debug(i); if (d) dbg = d; }
      /* lệnh vẽ: hai lần render liền (không khung thật xen vào), có / không nhóm xe máy người khác */
      let withB = NaN, without = NaN;
      if (g && g.parent) {
        const { renderer, scene, camera } = A;
        const r = () => { renderer.info.reset(); renderer.render(scene, camera); return renderer.info.render.calls; };
        r(); withB = r(); g.visible = false; without = r(); g.visible = true;
      }
      return { bikes: vis.length, carVis, meshes, lean, withB, without, dbg, myLean: A.bike.state ? A.bike.state.lean : NaN };
    });
    const v1 = await view(X1), v2 = await view(X2);
    info(`15 trang A: ${JSON.stringify(v1)}; trang B: ${JSON.stringify(v2)}`);
    check(`15b A thấy B là xe máy: ${v1.bikes} xe máy, ${v1.carVis} ô tô người khác; B thấy A là xe máy: ${v2.bikes} xe máy, ${v2.carVis} ô tô`, v1.bikes === 1 && v1.carVis === 0 && v2.bikes === 1 && v2.carVis === 0);
    check(`15c xe máy người khác là xe thật + nhân vật đã chọn: A thấy ${JSON.stringify(v1.dbg)} (B chọn nữ, ch 1), B thấy ${JSON.stringify(v2.dbg)} (A chọn nam, ch 0)`,
      !!v1.dbg && v1.dbg.real && v1.dbg.ch === 1 && !!v2.dbg && v2.dbg.real && v2.dbg.ch === 0);
    info(`15c lệnh vẽ xe máy người khác (camera có thể không nhìn thấy xe): A ${v1.withB - v1.without} lệnh vẽ / ${v1.meshes} lưới, B ${v2.withB - v2.without} lệnh vẽ / ${v2.meshes} lưới (không còn trần)`);
    /* chờ trang B nhận vài mẫu sau khi A đã nghiêng */
    await sleep(4000); await frames(X2.page, 3);
    const a = await X1.page.evaluate(() => window.__app.bike.state.lean);
    const b = (await view(X2)).lean;
    check(`15d dấu nghiêng: A tự nghiêng ${a.toFixed(3)} rad (trái +), B thấy xe A nghiêng ${Number(b).toFixed(3)} rad, cùng dấu`, a > 0.05 && b > 0.02 && Math.sign(a) === Math.sign(b));
  } finally {
    for (const [name, X] of pages) { allErrors.push(['15 ' + name, X.errors]); try { await X.page.close(); } catch { /* bỏ qua */ } }
    stop();
    await sleep(1500);
  }
}

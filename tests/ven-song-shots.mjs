// Ảnh và số đo trước / sau cho việc nâng cấp sông Hàn + nhà hai bờ (docs/ai/PROJECT_STATE.md, spec 2026-11-13-ven-song-chan-thuc-design.md).
// GPU THẬT (không SwiftShader): cùng góc camera, cùng điều kiện (ngày, hoàng hôn, đêm, mưa, bão) để so trước / sau. Không chấm đạt / lỗi theo ms.
// Ghi tests/screens/ven-song/<nhãn>/<góc>-<điều kiện>.png và metrics.json (lệnh vẽ, tam giác, ms GPU mỗi khung, thời gian mở trang, số program).
//
//   npm run build && node tests/ven-song-shots.mjs --label=truoc [--w=1600] [--h=900] [--only=ngay,dem] [--noshots]
import { fileURLToPath } from 'node:url';
import fs from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'playwright';
import { serveDir, openApp, frames } from './lib.mjs';
import { setWx } from './weather-lib.mjs';

const arg = (k, d) => process.argv.find((a) => a.startsWith(`--${k}=`))?.slice(k.length + 3) ?? d;
const label = arg('label', 'last'), W = +arg('w', 1600), H = +arg('h', 900), only = arg('only', '').split(',').filter(Boolean), noShots = process.argv.includes('--noshots');

/* Góc camera cố định (m, hệ trục của cảnh). Không đổi giữa các lần chạy: ảnh trước / sau phải chồng khít. */
const CAMS = {
  'tren-cao': { pos: [-430, 330, 560], target: [0, 12, 0] },              // toàn cảnh Cầu Rồng (góc mặc định)
  'doc-song': { pos: [0, 45, -640], target: [0, 80, -1150] },             // giữa sông nhìn về Bắc, hai bờ hai bên
  'sat-nuoc': { pos: [-120, 5, -260], target: [60, 2, -700] },            // sát mặt nước, nhìn chéo sang bờ Đông và Cầu sông Hàn
  'bo-ke': { pos: [-266, 4.6, -1165], target: [-40, 9, -1075] },          // đứng trên kè Bạch Đằng nhìn Cầu sông Hàn
  'du-luon': { pos: [40, 140, 520], target: [-60, 0, -500] },             // tầm bay dù lượn dọc sông
  'mat-pho': { pos: [-299, 1.8, 120], target: [-200, 8, 0] },             // ngang tầm xe trên Bạch Đằng
  'nha-tay': { pos: [120, 60, -420], target: [-420, 30, -560] },          // từ giữa sông nhìn thẳng dãy nhà bờ Tây
  'nha-dong': { pos: [-120, 60, 420], target: [420, 30, 560] }            // từ giữa sông nhìn thẳng dãy nhà bờ Đông
};
/* Điều kiện: night 0..1 của dayNight, preset thời tiết */
const CONDS = {
  ngay: { night: 0, wx: 'now' }, 'hoang-hon': { night: 0.62, wx: 'now' }, dem: { night: 1, wx: 'now' },
  mua: { night: 0, wx: 'rain' }, bao: { night: 0, wx: 'storm' }, 'mua-dem': { night: 1, wx: 'rain' }
};
const GPU_AT = [['tren-cao', 'ngay'], ['tren-cao', 'dem'], ['sat-nuoc', 'ngay'], ['doc-song', 'dem'], ['du-luon', 'mua']];

const out = fileURLToPath(new URL(`./screens/ven-song/${label}/`, import.meta.url));
await fs.mkdir(out, { recursive: true });
const srv = await serveDir(arg('dist', '') ? path.resolve(arg('dist', '')) : fileURLToPath(new URL('../dist/', import.meta.url)));   // --dist=<thư mục>: đo một bản build khác (vd. worktree của main) để so A/B
const args = ['--ignore-gpu-blocklist', '--enable-gpu', '--disable-gpu-vsync', '--disable-frame-rate-limit'];
if (process.platform === 'win32') args.unshift('--use-angle=d3d11');
const browser = await chromium.launch({ headless: true, args });
const t0 = Date.now();
const { page, errors } = await openApp(browser, srv.url + '?perf', { width: W, height: H });
const openMs = Date.now() - t0;
const info = await page.evaluate(() => {
  const A = window.__app, gl = A.renderer.getContext(), d = gl.getExtension('WEBGL_debug_renderer_info');
  return { gpu: d ? gl.getParameter(d.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER), timer: !!gl.getExtension('EXT_disjoint_timer_query_webgl2'),
    firstFrameMs: Math.round(A.perf.firstFrameMs), programs: A.renderer.info.programs.length, textures: A.renderer.info.memory.textures, geometries: A.renderer.info.memory.geometries };
});
console.log(`GPU: ${info.gpu} · ${W}x${H} · mở trang ${(openMs / 1000).toFixed(1)} s · khung đầu ${info.firstFrameMs} ms · ${info.programs} program`);
const soft = /swiftshader|llvmpipe|software/i.test(info.gpu);

const setCam = (c) => page.evaluate((c) => {
  const A = window.__app; A.cam.mode = 'orbit'; A.controls.enabled = true; A.controls.maxPolarAngle = Math.PI * 0.97;
  A.camera.position.set(...c.pos); A.controls.target.set(...c.target); A.controls.update();
}, c);
const setNight = (n) => page.evaluate((n) => { const d = window.__app.dayNight; d.target = d.night = n; }, n);
const stats = () => page.evaluate(() => { const R = window.__app.renderer; R.info.reset(); R.render(window.__app.scene, window.__app.camera); return { calls: R.info.render.calls, tris: R.info.render.triangles }; });
const gpuMs = () => page.evaluate(async () => {
  const A = window.__app, R = A.renderer, gl = R.getContext(), ext = gl.getExtension('EXT_disjoint_timer_query_webgl2');
  const sleep = (ms) => new Promise((ok) => setTimeout(ok, ms)), draw = () => R.render(A.scene, A.camera);
  const one = async () => {
    draw(); draw();
    const q = gl.createQuery(); gl.beginQuery(ext.TIME_ELAPSED_EXT, q);
    for (let i = 0; i < 12; i++) draw();
    gl.endQuery(ext.TIME_ELAPSED_EXT); gl.flush();
    for (let k = 0; k < 400; k++) { await sleep(5); if (gl.getQueryParameter(q, gl.QUERY_RESULT_AVAILABLE)) break; }
    const bad = gl.getParameter(ext.GPU_DISJOINT_EXT), ns = gl.getQueryParameter(q, gl.QUERY_RESULT); gl.deleteQuery(q);
    return bad ? -1 : ns / 1e6 / 12;
  };
  const a = []; for (let i = 0; i < 7; i++) a.push(await one());
  const ok = a.filter((x) => x > 0).sort((x, y) => x - y);
  return ok.length ? { med: ok[ok.length >> 1], min: ok[0], max: ok[ok.length - 1] } : null;
});

const metrics = { label, when: new Date().toISOString(), gpu: info.gpu, size: [W, H], openMs, firstFrameMs: info.firstFrameMs, programs: info.programs, textures: info.textures, geometries: info.geometries, views: {}, gpuMs: {} };
for (const [cn, cond] of Object.entries(CONDS)) {
  if (only.length && !only.includes(cn)) continue;
  await setNight(cond.night); await setWx(page, cond.wx);
  for (const [vn, c] of Object.entries(CAMS)) {
    await setCam(c); await frames(page, 6);
    const key = `${vn}-${cn}`;
    metrics.views[key] = await stats();
    if (!soft && info.timer && GPU_AT.some(([v, k]) => v === vn && k === cn)) {
      const g = await gpuMs(); metrics.gpuMs[key] = g;
      console.log(`  GPU ${key}: ${g ? `${g.med.toFixed(2)} ms (min ${g.min.toFixed(2)}, max ${g.max.toFixed(2)})` : 'không đo được'} · ${metrics.views[key].calls} lệnh vẽ · ${metrics.views[key].tris} tam giác`);
    }
    if (!noShots) { await frames(page, 2); await page.screenshot({ path: path.join(out, `${key}.png`) }); }
  }
  console.log(`${cn}: xong ${Object.keys(CAMS).length} góc`);
}
metrics.programsEnd = await page.evaluate(() => window.__app.renderer.info.programs.length);
metrics.heapMB = await page.evaluate(() => (performance.memory ? Math.round(performance.memory.usedJSHeapSize / 1048576) : null));
metrics.errors = errors;
await fs.writeFile(path.join(out, 'metrics.json'), JSON.stringify(metrics, null, 1));
console.log(`\nProgram cuối: ${metrics.programsEnd} · heap JS ${metrics.heapMB} MB · lỗi console: ${errors.length}`);
for (const e of errors) console.log('  LỖI console: ' + e);
console.log(`Đã ghi ${out}`);
await browser.close(); srv.close();
process.exit(errors.length ? 1 : 0);

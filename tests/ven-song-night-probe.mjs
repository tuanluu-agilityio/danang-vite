// Dò phản hồi "nước sông ban đêm, chất lượng Cao hơi giật" (docs/ai/QA_LOG.md, M4). GPU THẬT, vòng animate thật của trang
// (composer + bloom, bộ đèn theo ?lightsets, pixelRatio theo màn hình), khác ven-song-shots.mjs vốn chỉ đo renderer.render ở pixelRatio 1.
// Không chấm đạt / lỗi: chỉ in số và ghi tests/screens/ven-song/<nhãn>/probe.json (+ ảnh cắt vùng nước khi --flicker).
// Cách đo: chặn requestAnimationFrame của trang để tự gọi animate() liền nhau (GPU luôn bận ⇒ truy vấn TIME_ELAPSED = thời gian GPU thật của một khung,
// không lẫn thời gian chờ vsync); đo nhấp nháy thì thay performance.now bằng đồng hồ ảo, mỗi khung tiến đúng 1/60 s.
//
//   node tests/ven-song-night-probe.mjs --label=dem-B [--dist=<thư mục>] [--dpr=2] [--w=1440] [--h=900] [--query=lightsets=sync]
//        [--cams=doc-song,sat-nuoc,tren-cao] [--night=1] [--parts] [--flicker] [--warm=90]
//   --eval=<js>: chạy một biểu thức trong trang sau khi mở (thử nghiệm: ẩn một vật, vá shader) trước mọi phép đo
//   --parts:   tách chi phí trên cùng một trang: pixelRatio 2 / 1,5 / 1, tắt bloom, tắt gương, tắt vệt đèn (vá shader lúc chạy)
//   --flicker: nhấp nháy vùng nước giữa các khung liên tiếp cách nhau đúng 1/60 s; lưu 3 ảnh cắt liên tiếp
//   --warm=N:  nhịp rAF tự nhiên (60 Hz) trong N giây đầu ở ban đêm: khung dài khi hâm nền bộ đèn (cần --query=lightsets=bg)
import { fileURLToPath } from 'node:url';
import fs from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'playwright';
import { serveDir } from './lib.mjs';

const arg = (k, d) => process.argv.find((a) => a.startsWith(`--${k}=`))?.slice(k.length + 3) ?? d;
const has = (k) => process.argv.includes(`--${k}`);
const label = arg('label', 'probe'), W = +arg('w', 1440), H = +arg('h', 900), DPR = +arg('dpr', 2), warmSecs = +arg('warm', 0), NIGHT = +arg('night', 1);
const camList = arg('cams', 'doc-song,sat-nuoc,tren-cao').split(',').filter(Boolean);
const CAMS = {
  'tren-cao': { pos: [-430, 330, 560], target: [0, 12, 0] },
  'doc-song': { pos: [0, 45, -640], target: [0, 80, -1150] },
  'sat-nuoc': { pos: [-120, 5, -260], target: [60, 2, -700] },
  'bo-ke': { pos: [-266, 4.6, -1165], target: [-40, 9, -1075] },
  'du-luon': { pos: [40, 140, 520], target: [-60, 0, -500] }
};
const out = fileURLToPath(new URL(`./screens/ven-song/${label}/`, import.meta.url));
await fs.mkdir(out, { recursive: true });
const srv = await serveDir(arg('dist', '') ? path.resolve(arg('dist', '')) : fileURLToPath(new URL('../dist/', import.meta.url)));
const args = ['--ignore-gpu-blocklist', '--enable-gpu'];
if (process.platform === 'win32') args.unshift('--use-angle=d3d11');
const headed = has('headed'), natural = +arg('natural', 0);   // --headed: cửa sổ thật trên màn hình (vsync + DWM thật, pixelRatio của màn hình); --natural=N: N giây nhịp rAF tự nhiên ở mỗi góc
if (headed) args.push('--start-maximized');
const browser = await chromium.launch({ headless: !headed, args });
const page = await browser.newPage(headed ? { viewport: null } : { viewport: { width: W, height: H }, deviceScaleFactor: DPR });
const errors = []; page.setDefaultTimeout(600000);
page.on('pageerror', (e) => errors.push(String(e)));
page.on('console', (m) => { if (m.type() === 'error' && !/fonts\.(googleapis|gstatic)|ERR_FAILED|net::/.test(m.text())) errors.push(m.text()); });
await page.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.abort());
/* Chặn rAF: khi __drv.hold, callback không tới trình duyệt mà nằm trong hàng đợi; __drv.step() chạy cả hàng đợi như một khung */
await page.addInitScript(() => {
  const real = window.requestAnimationFrame.bind(window), D = window.__drv = { hold: false, q: [], real,
    step() { const q = D.q; D.q = []; const t = performance.now(); for (const cb of q) cb(t); },
    release() { D.hold = false; const q = D.q; D.q = []; for (const cb of q) real(cb); } };
  window.requestAnimationFrame = (cb) => { if (D.hold) { D.q.push(cb); return 0; } return real(cb); };
});
const q = arg('query', '');
await page.goto(srv.url + '?test&perf' + (q ? '&' + q : ''), { waitUntil: 'load', timeout: 180000 });
await page.waitForFunction(() => window.__app && document.getElementById('loading')?.classList.contains('done'), null, { timeout: 180000 });

const state = () => page.evaluate(() => {
  const A = window.__app, R = A.renderer, gl = R.getContext(), d = gl.getExtension('WEBGL_debug_renderer_info');
  return { gpu: d ? gl.getParameter(d.UNMASKED_RENDERER_WEBGL) : '?', ratio: R.getPixelRatio(), buf: [gl.drawingBufferWidth, gl.drawingBufferHeight], dpr: devicePixelRatio,
    set: A.lights?.set, mode: A.lights?.mode, ready: A.lights ? { ...A.lights.ready } : null, programs: R.info.programs.length, step: A.quality.step };
});
const setCam = (c) => page.evaluate((c) => {
  const A = window.__app; A.cam.mode = 'orbit'; A.controls.enabled = true; A.controls.maxPolarAngle = Math.PI * 0.97;
  A.camera.position.set(...c.pos); A.controls.target.set(...c.target); A.controls.update();
}, c);
const setNight = (n) => page.evaluate((n) => { const d = window.__app.dayNight; d.target = d.night = n; }, n);
const hold = () => page.evaluate(async () => { const D = window.__drv; D.hold = true; for (let i = 0; i < 200 && !D.q.length; i++) await new Promise((ok) => setTimeout(ok, 10)); return D.q.length; });
const release = () => page.evaluate(() => window.__drv.release());

/* Thời gian GPU của một khung animate thật (ms): 7 lần, mỗi lần truy vấn bao 12 khung gọi liền nhau; trả trung vị. warm: số khung chạy trước (biên dịch, cấp framebuffer) */
const measure = (warm = 30) => page.evaluate(async (warm) => {
  const A = window.__app, D = window.__drv, gl = A.renderer.getContext(), ext = gl.getExtension('EXT_disjoint_timer_query_webgl2');
  const sleep = (ms) => new Promise((ok) => setTimeout(ok, ms));
  for (let i = 0; i < warm; i++) D.step();
  gl.finish();
  const g = [], c = [];
  for (let r = 0; r < 7; r++) {
    D.step(); D.step();
    const qq = gl.createQuery(), t0 = performance.now(); gl.beginQuery(ext.TIME_ELAPSED_EXT, qq);
    for (let i = 0; i < 12; i++) D.step();
    gl.endQuery(ext.TIME_ELAPSED_EXT); c.push((performance.now() - t0) / 12); gl.flush();
    for (let k = 0; k < 800; k++) { await sleep(5); if (gl.getQueryParameter(qq, gl.QUERY_RESULT_AVAILABLE)) break; }
    const bad = gl.getParameter(ext.GPU_DISJOINT_EXT), ns = gl.getQueryParameter(qq, gl.QUERY_RESULT); gl.deleteQuery(qq);
    if (!bad) g.push(ns / 1e6 / 12);
  }
  g.sort((a, b) => a - b); c.sort((a, b) => a - b);
  return { gpu: g.length ? g[g.length >> 1] : -1, min: g[0] ?? -1, max: g[g.length - 1] ?? -1, cpu: c[c.length >> 1], calls: A.renderer.info.render.calls, tris: A.renderer.info.render.triangles, set: A.lights?.set, programs: A.renderer.info.programs.length };
}, warm);
const fmt = (m) => `GPU ${m.gpu.toFixed(2)} ms (min ${m.min.toFixed(2)}, max ${m.max.toFixed(2)}) · CPU gửi lệnh ${m.cpu.toFixed(1)} ms · ${m.calls} lệnh vẽ · bộ đèn ${m.set} · ${m.programs} program`;

if (arg('eval', '')) console.log('  --eval →', await page.evaluate(arg('eval', '')));   // thử nghiệm một lần trong trang trước khi đo (vd. ẩn sao, vá shader)
const res = { label, when: new Date().toISOString(), query: q, night: NIGHT, open: await state(), views: {}, parts: {}, flicker: {}, warm: null, errors };
console.log(`${label}: ${res.open.gpu} · ${headed ? 'cửa sổ thật' : `${W}x${H}`} @${res.open.dpr} → pixelRatio ${res.open.ratio}, bộ đệm ${res.open.buf.join('x')} · ${res.open.programs} program · lightsets ${res.open.mode}`);

/* (2) Khung dài trong N giây đầu ở ban đêm, nhịp rAF tự nhiên: ghi mọi khung > 33 ms kèm thời điểm và lúc bộ đèn sẵn sàng */
if (warmSecs) {
  await setNight(NIGHT); await setCam(CAMS[camList[0]]);
  res.warm = await page.evaluate((secs) => new Promise((ok) => {
    const A = window.__app, t0 = performance.now(), long = [], ev = []; let last = 0, n = 0, sum = 0, rd = false, rn = false, set = A.lights.set;
    const f = (t) => {
      const el = (performance.now() - t0) / 1000;
      if (last) { const d = t - last; n++; sum += d; if (d > 33) long.push([+el.toFixed(1), Math.round(d)]); } last = t;
      if (!rd && A.lights.ready.day) { rd = true; ev.push(['day sẵn sàng', +el.toFixed(1)]); }
      if (!rn && A.lights.ready.night) { rn = true; ev.push(['night sẵn sàng', +el.toFixed(1)]); }
      if (A.lights.set !== set) { set = A.lights.set; ev.push(['chuyển sang ' + set, +el.toFixed(1)]); }
      if (el >= secs) ok({ frames: n, avg: sum / n, long, ev, programs: A.renderer.info.programs.length }); else requestAnimationFrame(f);
    };
    requestAnimationFrame(f);
  }), warmSecs);
  const w = res.warm, b = (lo, hi) => w.long.filter((x) => x[1] > lo && x[1] <= hi).length;
  console.log(`  ${warmSecs} s đầu ở đêm (rAF tự nhiên): ${w.frames} khung, trung bình ${w.avg.toFixed(1)} ms; khung 33–50 ms: ${b(33, 50)}, 50–100: ${b(50, 100)}, 100–250: ${b(100, 250)}, > 250: ${b(250, 1e9)}, dài nhất ${Math.max(0, ...w.long.map((x) => x[1]))} ms · ${w.ev.map((e) => `${e[0]} ${e[1]} s`).join(', ') || 'không có sự kiện bộ đèn'} · ${w.programs} program`);
}

/* Nhịp rAF tự nhiên ở trạng thái ổn định: khung nào lỡ vsync (> 20 ms ở màn 60 Hz) */
if (natural) {
  await setNight(NIGHT);
  for (const vn of camList) {
    await setCam(CAMS[vn]); await page.waitForTimeout(1500);
    const m = await page.evaluate((secs) => new Promise((ok) => {
      const A = window.__app, t0 = performance.now(), d = []; let last = 0;
      const f = (t) => { if (last) d.push(t - last); last = t; if (performance.now() - t0 >= secs * 1000) { d.sort((a, b) => a - b); const pc = (p) => d[Math.min(d.length - 1, Math.floor(d.length * p))];
        ok({ n: d.length, avg: d.reduce((s, x) => s + x, 0) / d.length, p50: pc(0.5), p95: pc(0.95), p99: pc(0.99), max: pc(1), over20: d.filter((x) => x > 20).length, over40: d.filter((x) => x > 40).length, set: A.lights?.set, ratio: A.renderer.getPixelRatio(), buf: [A.renderer.domElement.width, A.renderer.domElement.height] }); } else requestAnimationFrame(f); };
      requestAnimationFrame(f);
    }), natural);
    (res.natural ??= {})[vn] = m;
    console.log(`  nhịp tự nhiên ${vn} (${m.buf.join('x')}, bộ đèn ${m.set}): ${m.n} khung / ${natural} s = ${(m.n / natural).toFixed(1)} FPS · trung bình ${m.avg.toFixed(1)} ms, p50 ${m.p50.toFixed(1)}, p95 ${m.p95.toFixed(1)}, p99 ${m.p99.toFixed(1)}, max ${m.max.toFixed(0)} · lỡ nhịp (> 20 ms): ${m.over20} (${(100 * m.over20 / m.n).toFixed(1)} %), > 40 ms: ${m.over40}`);
  }
}

await setNight(NIGHT); await hold();
for (const vn of camList) {
  await setCam(CAMS[vn]);
  res.views[vn] = await measure();
  console.log(`  ${vn}: ${fmt(res.views[vn])}`);
}

/* (1) Tách chi phí ở góc đầu danh sách: sửa bậc 0 của CONFIG.perf.steps rồi quality.apply(true) (đổi pixelRatio / bloom / gương không biên dịch lại shader) */
if (has('parts')) {
  const vn = camList[0]; await setCam(CAMS[vn]);
  const tweak = (o) => page.evaluate((o) => { const A = window.__app, s = A.quality.current(); Object.assign(s, o); A.quality.apply(true); return A.renderer.getPixelRatio(); }, o);
  const base = await page.evaluate(() => ({ ...window.__app.quality.current() }));
  const run = async (name, o) => { const ratio = await tweak({ ...base, ...o }); const m = await measure(60); res.parts[name] = { ...m, ratio }; console.log(`  [${vn}] ${name} (pixelRatio ${ratio}): ${fmt(m)}`); };
  await run('gốc', {});
  await run('tắt bloom', { bloom: 0 });
  await run('bloom nửa độ phân giải', { bloom: 0.5 });
  await run('tắt gương', { reflectEvery: 0 });
  await run('tắt gương + tắt bloom', { reflectEvery: 0, bloom: 0 });
  await run('pixelRatio 1,5', { ratio: 1.5 });
  await run('pixelRatio 1', { ratio: 1 });
  await run('pixelRatio 1 + tắt bloom', { ratio: 1, bloom: 0 });
  await run('gốc (lặp lại)', {});
  const patched = await page.evaluate(() => {   // tắt vòng lấy mẫu vệt đèn: vá chuỗi điều kiện trong fragment shader nước rồi biên dịch lại (chỉ trong trang đo)
    let ok = false;
    window.__app.scene.traverse((o) => { const m = o.material; if (m?.uniforms?.mirrorSampler && m.fragmentShader.includes('uNight > 0.85')) { m.fragmentShader = m.fragmentShader.replace('uNight > 0.85', 'uNight > 8.5'); m.needsUpdate = true; ok = true; } });
    return ok;
  });
  if (patched) await run('tắt vệt đèn', {}); else console.log('  không vá được shader nước (không thấy chuỗi "uNight > 0.85")');
}

/* (3) Nhấp nháy: 24 khung liên tiếp cách nhau đúng 1/60 s (đồng hồ ảo), cắt vùng nước; đo |Δ độ chói| giữa hai khung kề nhau */
if (has('flicker')) {
  if (has('parts')) { await page.goto(srv.url + '?test&perf' + (q ? '&' + q : ''), { waitUntil: 'load' }); await page.waitForFunction(() => window.__app && document.getElementById('loading')?.classList.contains('done')); await setNight(NIGHT); await hold(); }
  for (const vn of camList) {
    await setCam(CAMS[vn]);
    const f = await page.evaluate(() => {
      const A = window.__app, D = window.__drv, src = A.renderer.domElement, cw = Math.round(src.width * 0.3), ch = Math.round(src.height * 0.22), sx = Math.round(src.width * 0.35), sy = Math.round(src.height * 0.66);
      const realNow = performance.now; let vt = realNow.call(performance);
      for (let i = 0; i < 20; i++) D.step();
      performance.now = () => vt;
      const cvs = [];
      try {
        for (let i = 0; i < 6; i++) { vt += 1000 / 60; D.step(); }   // vài khung đầu cho đồng hồ ảo vào nhịp
        for (let i = 0; i < 24; i++) {
          vt += 1000 / 60; D.step();
          const cv = document.createElement('canvas'); cv.width = cw; cv.height = ch; cv.getContext('2d', { willReadFrequently: true }).drawImage(src, sx, sy, cw, ch, 0, 0, cw, ch); cvs.push(cv);
        }
      } finally { performance.now = realNow; }
      const lum = [], pngs = [];
      for (const cv of cvs) {
        const d = cv.getContext('2d').getImageData(0, 0, cw, ch).data, L = new Float32Array(cw * ch);
        for (let i = 0, j = 0; j < L.length; i += 4, j++) L[j] = 0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2];
        lum.push(L); if (pngs.length < 3) pngs.push(cv.toDataURL('image/png'));
      }
      let sum = 0, pop = 0, pop2 = 0, bright = 0, n = 0, mean = 0;
      for (let k = 1; k < lum.length; k++) for (let j = 0; j < lum[k].length; j++) { const dd = Math.abs(lum[k][j] - lum[k - 1][j]); sum += dd; if (dd > 40) pop++; if (dd > 90) pop2++; if (lum[k][j] > 120) bright++; mean += lum[k][j]; n++; }
      return { meanAbs: sum / n, popPct: 100 * pop / n, pop90Pct: 100 * pop2 / n, brightPct: 100 * bright / n, meanLum: mean / n, size: [cw, ch], pngs };
    });
    for (let i = 0; i < f.pngs.length; i++) await fs.writeFile(path.join(out, `nhay-${vn}-${i}.png`), Buffer.from(f.pngs[i].split(',')[1], 'base64'));
    delete f.pngs; res.flicker[vn] = f;
    console.log(`  nhấp nháy ${vn}: |Δ độ chói| trung bình ${f.meanAbs.toFixed(2)} / 255 mỗi 1/60 s · điểm ảnh đổi > 40: ${f.popPct.toFixed(2)} %, > 90: ${f.pop90Pct.toFixed(3)} % · sáng > 120: ${f.brightPct.toFixed(2)} % · độ chói trung bình ${f.meanLum.toFixed(1)} · vùng ${f.size.join('x')}`);
  }
}

await release();
res.close = await state();
await fs.writeFile(path.join(out, 'probe.json'), JSON.stringify(res, null, 1));
console.log(`  cuối: ${res.close.programs} program, bộ đèn ${res.close.set} · lỗi console ${errors.length}`);
for (const e of errors) console.log('  LỖI console: ' + e);
await browser.close(); srv.close();
process.exit(0);

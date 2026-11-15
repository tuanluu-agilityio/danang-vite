// Chụp núi Sơn Trà từ bốn cầu (đứng trên mặt cầu, tầm mắt người) và vài góc rộng, ngày + hoàng hôn + đêm, để so trước / sau (D-047).
// Dùng GPU thật (như tests/gpu-time.mjs) cho nhanh; không chấm đạt / lỗi, chỉ ghi ảnh + lệnh vẽ + tam giác vào tests/screens/sontra/<nhãn>/.
//
//   npm run build && node tests/sontra-shots.mjs [--label=after] [--w=1600] [--h=900]
import { fileURLToPath } from 'node:url';
import fs from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'playwright';
import { serveDir, openApp, frames } from './lib.mjs';

const arg = (k, d) => process.argv.find((a) => a.startsWith(`--${k}=`))?.slice(k.length + 3) ?? d;
const label = arg('label', 'after'), W = +arg('w', 1600), H = +arg('h', 900);
const out = fileURLToPath(new URL(`./screens/sontra/${label}/`, import.meta.url));
await fs.mkdir(out, { recursive: true });

// [tên, vị trí camera, điểm nhìn, fov]; núi Sơn Trà quanh (2600, 300, −4500)
const ST = [2500, 260, -4400];
const SHOTS = [
  ['dragon', [40, 13, -17], ST, 50],            // lề Bắc Cầu Rồng
  ['dragon-tele', [40, 13, -17], ST, 22],       // như ống tele (ảnh tham chiếu chụp tele)
  ['songhan', [0, 15, -1088], ST, 50],          // lề Bắc Cầu sông Hàn
  ['songhan-tele', [0, 15, -1088], ST, 24],
  ['tranthily', [60, 17, 1290], ST, 50],        // lề Bắc Cầu Trần Thị Lý
  ['tranthily-tele', [60, 17, 1290], ST, 18],
  ['thuanphuoc', [0, 36, -2912], [2700, 330, -4500], 50],   // nhịp chính Cầu Thuận Phước
  ['thuanphuoc-wide', [300, 78, -3370], [2600, 250, -4300], 50],
  ['bay', [-760, 540, -3800], [2600, 100, -4300], 50],      // trên vịnh nhìn sang
  ['south-air', [900, 500, -1200], [2700, 150, -4400], 50], // trên cao phía Nam (dù lượn hay bay qua)
  ['glider', [1500, 420, -3200], [2700, 350, -4600], 50]    // dù lượn sát sườn núi
];

const srv = await serveDir(arg('dist', '') ? path.resolve(arg('dist', '')) : fileURLToPath(new URL('../dist/', import.meta.url)));   // --dist=<thư mục>: chụp bản build khác (vd. main) để có ảnh "trước"
const args = ['--ignore-gpu-blocklist', '--enable-gpu'];
if (process.platform === 'win32') args.unshift('--use-angle=d3d11');
const browser = await chromium.launch({ headless: true, args });
const stats = {};
try {
  const { page, errors } = await openApp(browser, srv.url, { width: W, height: H });
  const gpu = await page.evaluate(() => { const gl = window.__app.renderer.getContext(), d = gl.getExtension('WEBGL_debug_renderer_info'); return d ? gl.getParameter(d.UNMASKED_RENDERER_WEBGL) : 'unknown'; });
  console.log('GPU:', gpu);
  await page.addStyleTag({ content: 'body>*:not(canvas){visibility:hidden!important}' });
  for (const [mode, night] of [['day', 0], ['night', 1]]) {
    await page.evaluate((n) => { const d = window.__app.dayNight; d.target = d.night = n; }, night);
    for (const [name, pos, tgt, fov] of SHOTS) {
      if (night && !/^(dragon|thuanphuoc|bay)$/.test(name)) continue;
      const s = await page.evaluate(async ({ pos, tgt, fov }) => {
        const A = window.__app; A.camera.fov = fov; A.camera.updateProjectionMatrix();
        A.controls.maxPolarAngle = Math.PI * 0.99;   // điểm nhìn cao hơn camera (đứng trên cầu ngước lên núi)
        A.camera.position.set(...pos); A.controls.target.set(...tgt); A.controls.update();
        await new Promise((ok) => { let i = 0; const f = () => (++i >= 6 ? ok() : requestAnimationFrame(f)); requestAnimationFrame(f); });
        return { calls: A.renderer.info.render.calls, tris: A.renderer.info.render.triangles };
      }, { pos, tgt, fov });
      await frames(page, 2);
      await page.screenshot({ path: path.join(out, `${name}-${mode}.png`) });
      stats[`${name}-${mode}`] = s; console.log(`${name}-${mode}: ${s.calls} lệnh vẽ, ${s.tris} tam giác`);
    }
  }
  if (errors.length) console.log('Lỗi console:', errors);
  await fs.writeFile(path.join(out, 'stats.json'), JSON.stringify({ gpu, W, H, stats, errors }, null, 1));
} finally { await browser.close(); srv.close(); }

// Nhạc chủ đề (D-046): đo bộ lập lịch nhạc trong TRANG THẬT (dist/, GPU thật) — nốt có bị lên lịch trễ khi vòng vẽ 3D khựng không.
//   npm run build && node tests/music-live-probe.mjs [giây=80]
// Mở một trang (không phải bộ test nặng), bật nhạc, lần lượt vào các chế độ, in audio.musicStat + khung dài nhất + số liệu hụt tiếng của trình duyệt nếu có.
import { serveDir } from './lib.mjs';
import { chromium } from 'playwright';
import { fileURLToPath } from 'node:url';

const SEC = Number(process.argv[2]) || 80;
const srv = await serveDir(fileURLToPath(new URL('../dist/', import.meta.url)));
const args = ['--ignore-gpu-blocklist', '--enable-gpu', '--autoplay-policy=no-user-gesture-required']; if (process.platform === 'win32') args.unshift('--use-angle=d3d11');
const browser = await chromium.launch({ headless: true, args });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } }); page.setDefaultTimeout(180000);
const errors = []; page.on('pageerror', (e) => errors.push(String(e)));
await page.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.abort());
await page.goto(srv.url + '?test&lightsets=bg', { waitUntil: 'load' });
await page.waitForFunction(() => window.__app && document.getElementById('loading')?.classList.contains('done'));
await page.evaluate(() => {
  const a = window.__app.audio; a.start();
  window.__probe = { maxFrame: 0, long: 0 }; let last = performance.now();
  const f = () => { const n = performance.now(), d = n - last; last = n; if (d > window.__probe.maxFrame) window.__probe.maxFrame = d; if (d > 250) window.__probe.long++; requestAnimationFrame(f); }; requestAnimationFrame(f);
});
const read = () => page.evaluate(() => { const a = window.__app.audio, p = window.__probe, r = { stat: a.musicStat, pos: a.musicPos, mode: a.mode, maxFrame: Math.round(p.maxFrame), long: p.long }; p.maxFrame = 0; p.long = 0; return r; });
const t0 = Date.now(); let n = 0;
// thoát chế độ = tải lại trang (explore.exit), nên chỉ vào dù lượn một lần ở giây 20 rồi ở lại
while ((Date.now() - t0) / 1000 < SEC) {
  await page.waitForTimeout(10000);
  const r = await read();
  console.log(`${String(Math.round((Date.now() - t0) / 1000)).padStart(3)} s  ${r.mode.padEnd(8)} ${r.pos.section.padEnd(10)} ô ${String(r.pos.bar).padStart(2)}  bước bỏ ${r.stat.skipped}/${r.stat.steps}, trễ nhất ${(r.stat.worst * 1000).toFixed(0)} ms, hở lịch dài nhất ${(r.stat.gap * 1000).toFixed(0)} ms · khung dài nhất ${r.maxFrame} ms, ${r.long} khung > 250 ms`);
  if (++n === 2) await page.evaluate(() => { try { window.__app.explore.start(); } catch (e) { console.log('mode', String(e)); } });
}
if (errors.length) console.log('Lỗi trang:', errors.join(' | '));
await browser.close(); srv.close();

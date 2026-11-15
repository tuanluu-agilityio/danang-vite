// Âm thanh trong đoạn giới thiệu: đo CHI PHÍ LUỒNG WEB AUDIO theo từng nhịp bằng trace của Chrome (không chèn gì vào đồ thị âm thanh).
//   npm run build && node tests/intro-audio-trace.mjs [--headed] [--vol=100]
// Mỗi lần luồng âm thanh render một khối (thường 10 ms / 480 mẫu ở 48 kHz) là một sự kiện trace; khối render càng lâu thì máy yếu càng dễ hụt loa (tiếng lụp bụp).
// In theo nhịp: thời gian render trung bình / p99 / lớn nhất mỗi lần gọi, và tỉ lệ so với thời lượng khối (> 100 % = hụt loa chắc chắn).
import { serveDir } from './lib.mjs';
import { chromium } from 'playwright';
import { fileURLToPath } from 'node:url';

const arg = (k, d) => { const a = process.argv.find((x) => x.startsWith(`--${k}=`)); return a ? a.slice(k.length + 3) : d; };
const srv = await serveDir(fileURLToPath(new URL(arg('dist', '../dist/'), import.meta.url)));
const args = ['--enable-blink-features=AudioContextPlayoutStats', '--ignore-gpu-blocklist', '--enable-gpu', '--autoplay-policy=no-user-gesture-required']; if (process.platform === 'win32') args.unshift('--use-angle=d3d11');
const browser = await chromium.launch({ headless: !process.argv.includes('--headed'), args });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } }); page.setDefaultTimeout(240000);
await page.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.abort());
await page.goto(srv.url + '?test&intro&lightsets=bg' + (arg('q', '') ? '&' + arg('q', '') : ''), { waitUntil: 'load' });
await page.waitForFunction(() => window.__app && document.getElementById('loading')?.classList.contains('done') && window.__app.intro.active);
await page.click('#inSound');
await page.waitForFunction(() => window.__app.audio.on);
if (arg('vol', '')) await page.evaluate((v) => { const s = document.getElementById('volSlider'); s.value = v; s.dispatchEvent(new Event('input')); }, arg('vol', ''));
if (process.argv.includes('--nomusic')) await page.evaluate(() => window.__app.audio.setMusic(false));
await browser.startTracing(page, { categories: ['webaudio', 'audio', 'blink.user_timing', ...(process.argv.includes('--nodes') ? ['disabled-by-default-webaudio.audionode'] : [])] });
await page.evaluate(() => { let last = ''; const f = () => { const s = window.__app.intro.sceneId || 'done'; if (s !== last) { performance.mark('scene:' + s); last = s; } requestAnimationFrame(f); }; f(); });
if (process.argv.includes('--nodes')) await page.waitForTimeout(4000);   // trace từng nút rất lớn: chỉ 4 s
else { await page.waitForFunction(() => { const i = window.__app.intro; return !i.active || i.clock.done; }, null, { timeout: 240000, polling: 500 }); await page.waitForTimeout(4000); }
const stats = await page.evaluate(() => { const ps = window.__app.audio.sfxPort()?.ctx?.playoutStats; return ps ? { ev: ps.fallbackFramesEvents, ms: Math.round(ps.fallbackFramesDuration) } : null; });
const buf = await browser.stopTracing();
const ev = JSON.parse(buf.toString()).traceEvents;
const marks = ev.filter((e) => e.name && e.name.startsWith('scene:')).map((e) => [e.ts, e.name.slice(6)]).sort((a, b) => a[0] - b[0]);
const names = new Map(); for (const e of ev) if (e.dur && (e.cat || '').match(/webaudio|audio/)) names.set(e.name, (names.get(e.name) || 0) + 1);
// sự kiện render gốc của luồng âm thanh: chọn tên xuất hiện nhiều nhất có "Render" (khác nhau theo phiên bản Chrome)
const top = [...names.entries()].filter(([n]) => /Render/i.test(n)).sort((a, b) => b[1] - a[1]);
console.log('sự kiện trace âm thanh:', [...names.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8).map(([n, c]) => `${n}×${c}`).join(' · '));
const NAME = arg('event', top.length ? top[0][0] : '');
const sceneAt = (ts) => { let s = 'trước'; for (const [t, n] of marks) { if (t <= ts) s = n; else break; } return s; };
const by = {}, order = [];
for (const e of ev) { if (e.name !== NAME || !e.dur) continue; const s = sceneAt(e.ts); if (!by[s]) { by[s] = []; order.push(s); } by[s].push(e.dur / 1000); }
console.log(`sự kiện đo: ${NAME}; hụt loa (playoutStats): ${JSON.stringify(stats)}`);
console.log('nhịp       lần gọi   TB ms   p99 ms   max ms   khối >5 ms');
for (const s of order) { const a = by[s].sort((x, y) => x - y), n = a.length, avg = a.reduce((p, c) => p + c, 0) / n;
  console.log(`${s.padEnd(10)} ${String(n).padStart(7)} ${avg.toFixed(3).padStart(7)} ${a[Math.floor(n * 0.99)].toFixed(3).padStart(8)} ${a[n - 1].toFixed(2).padStart(8)} ${String(a.filter((x) => x > 5).length).padStart(11)}`); }
await browser.close(); srv.close();
// --nodes: tổng thời gian theo loại nút (tự thân, không gồm nút con) trên toàn intro
if (process.argv.includes('--nodes')) {
  const per = new Map(), cnt = new Map();
  for (const e of ev) { if (!e.dur || !(e.cat || '').includes('audionode')) continue; const k = (e.args && (e.args.data?.node_type || e.args.node_type || e.args.type)) || e.name; per.set(k, (per.get(k) || 0) + e.dur / 1000); cnt.set(k, (cnt.get(k) || 0) + 1); }
  console.log('thời gian theo nút (ms, gồm cả con nếu trace lồng):'); for (const [k, v] of [...per.entries()].sort((a, b) => b[1] - a[1]).slice(0, 15)) console.log(String(Math.round(v)).padStart(8), String(cnt.get(k)).padStart(9), k);
  const ex = ev.find((e) => (e.cat || '').includes('audionode') && e.dur); console.log('ví dụ sự kiện:', JSON.stringify(ex));
}

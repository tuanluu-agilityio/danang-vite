// Nhạc chủ đề (D-046): kết xuất ngoại tuyến từng bản phối bằng OfflineAudioContext trong Chromium rồi đo biên độ.
// Không mở cảnh 3D, không đọc dist/: đóng gói src/audio/music.ts bằng esbuild và chạy trong trang trống (nhanh, không cần GPU).
//   node tests/music-render.mjs           đo: đỉnh, RMS, số mẫu chạm trần, khoảng lặng, chỗ nối cuối bài → đầu bài
//   node tests/music-render.mjs --wav     thêm: ghi tests/screens/music/<tên>.wav để nghe thử (không commit)
// Máy không nghe được: test này chỉ canh mức âm lượng và sự liên tục, không chấm được nhạc hay / dở.
import { build } from 'esbuild';
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const WAV = process.argv.includes('--wav');
const SR = 44100;

const out = await build({
  stdin: { contents: `import { renderMusic } from './src/audio/music.ts'; import { CONFIG } from './src/config.ts'; import { TOTAL_BARS, SECTIONS } from './src/audio/score.ts'; globalThis.M = { renderMusic, bpm: CONFIG.music.bpm, bars: TOTAL_BARS, cfg: CONFIG.music, sections: SECTIONS.map((s) => ({ name: s.name, bars: s.bars })) };`, resolveDir: ROOT, loader: 'ts' },
  bundle: true, write: false, format: 'iife', platform: 'browser', define: { 'import.meta.env.BASE_URL': '"/"', 'import.meta.env': '{}' }, logLevel: 'silent'
});
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
const page = await browser.newPage(); page.setDefaultTimeout(600000);
const errors = []; page.on('pageerror', (e) => errors.push(String(e)));
await page.goto('about:blank');
await page.addScriptTag({ content: out.outputFiles[0].text });
const info = await page.evaluate(() => ({ bpm: M.bpm, bars: M.bars }));
const LOOP = info.bars * 4 * 60 / info.bpm;   // độ dài một vòng bài (s)

const db = (x) => (x > 0 ? 20 * Math.log10(x) : -Infinity).toFixed(1);
async function render(name, mix, seconds, section = 0) {
  const r = await page.evaluate(async ({ mix, seconds, SR, wav, section }) => {
    const t0 = performance.now(), buf = await M.renderMusic(seconds, mix, SR, section, null), L = buf.getChannelData(0), R = buf.getChannelData(1), n = L.length;
    let peak = 0, sum = 0, clip = 0; const win = [];
    for (let i = 0, w = 0, c = 0; i < n; i++) {
      const a = Math.max(Math.abs(L[i]), Math.abs(R[i])); if (a > peak) peak = a; if (a >= 0.999) clip++;
      const e = (L[i] * L[i] + R[i] * R[i]) / 2; sum += e; w += e; if (++c === SR) { win.push(Math.sqrt(w / SR)); w = 0; c = 0; }
    }
    let b64 = null;
    if (wav) { const pcm = new Int16Array(n * 2); for (let i = 0; i < n; i++) { pcm[2 * i] = Math.max(-1, Math.min(1, L[i])) * 32767; pcm[2 * i + 1] = Math.max(-1, Math.min(1, R[i])) * 32767; }
      const u8 = new Uint8Array(pcm.buffer); let s = ''; for (let i = 0; i < u8.length; i += 32768) s += String.fromCharCode.apply(null, u8.subarray(i, i + 32768)); b64 = btoa(s); }
    return { peak, rms: Math.sqrt(sum / n), clip, win, ms: performance.now() - t0, b64 };
  }, { mix, seconds, SR, wav: WAV, section });
  if (WAV) {
    const dir = path.join(ROOT, 'tests/screens/music'); fs.mkdirSync(dir, { recursive: true });
    const pcm = Buffer.from(r.b64, 'base64'), h = Buffer.alloc(44);
    h.write('RIFF', 0); h.writeUInt32LE(36 + pcm.length, 4); h.write('WAVEfmt ', 8); h.writeUInt32LE(16, 16); h.writeUInt16LE(1, 20); h.writeUInt16LE(2, 22);
    h.writeUInt32LE(SR, 24); h.writeUInt32LE(SR * 4, 28); h.writeUInt16LE(4, 32); h.writeUInt16LE(16, 34); h.write('data', 36); h.writeUInt32LE(pcm.length, 40);
    fs.writeFileSync(path.join(dir, name + '.wav'), Buffer.concat([h, pcm]));
  }
  return r;
}

let bad = 0;
const check = (ok, msg) => { console.log((ok ? '  đạt  ' : '  LỖI  ') + msg); if (!ok) bad++; };
const base = { night: 0, rain: 0, storm: 0 };
// --solo: đo riêng từng lớp ở đoạn cao trào (bản toàn cảnh) để cân bản phối; không chấm
if (process.argv.includes('--solo')) {
  const layers = await page.evaluate(() => Object.keys(M.cfg.level));
  for (const L of layers) {
    await page.evaluate((L) => { M.keep = M.keep || { ...M.cfg.level }; for (const k in M.cfg.level) M.cfg.level[k] = k === L ? M.keep[k] : 0; }, L);
    const r = await render('solo-' + L, { ...base, mode: 'overview' }, 9, 5);
    console.log(`  ${L.padEnd(6)} RMS ${db(r.rms)} dBFS, đỉnh ${db(r.peak)} dBFS`);
  }
  await browser.close(); process.exit(0);
}
// --load: lên lịch dần như trang thật rồi in tải luồng âm thanh theo từng ô nhịp (ms máy cho mỗi giây nhạc; ≥ 1000 = không kịp thời gian thực). --load=car chọn bản phối
const LOADARG = process.argv.find((a) => a.startsWith('--load'));
if (LOADARG) {
  const mode = LOADARG.split('=')[1] || 'overview', BARSEC = 4 * 60 / info.bpm;
  const r = await page.evaluate(async ({ mix, seconds, SR }) => { const load = []; await M.renderMusic(seconds, mix, SR, 0, load); return load; }, { mix: { ...base, mode }, seconds: LOOP + 2 * BARSEC, SR });
  const secs = await page.evaluate(() => M.sections);
  let bar = 0;
  for (const S of [...secs, secs[0]]) {
    const cells = [];
    for (let b = 0; b < (S === secs[0] && bar > 0 ? 2 : S.bars); b++, bar++) {
      const i0 = Math.round(bar * BARSEC / 0.25), i1 = Math.round((bar + 1) * BARSEC / 0.25), ms = r.slice(i0, i1).reduce((s, x) => s + x, 0) / ((i1 - i0) * 0.25);
      cells.push(ms.toFixed(0).padStart(4));
    }
    console.log(`  ${S.name.padEnd(10)} ${cells.join(' ')}`);
  }
  await browser.close(); process.exit(0);
}
const FULL = process.argv.includes('--full');
// [tên, bản phối, số giây, đoạn bắt đầu (score.ts SECTIONS)]. Mặc định: các đoạn ngắn (nhanh). --full: cả bài + chỗ nối (rất chậm: hàng chục nghìn nút lên lịch một lần)
const CASES = FULL ? [['full-day', { ...base, mode: 'overview' }, LOOP + 12, 0]] : [
  ['intro-overview', { ...base, mode: 'overview' }, 9, 0], ['theme-overview', { ...base, mode: 'overview' }, 17, 2], ['summit-car', { ...base, mode: 'car' }, 17, 5],
  ['summit-bike', { ...base, mode: 'bike' }, 12, 5], ['theme-glider', { ...base, mode: 'glider' }, 12, 2], ['theme-stroll', { ...base, mode: 'stroll' }, 12, 2],
  ['theme-tour', { ...base, mode: 'tour' }, 12, 2], ['theme-night', { ...base, mode: 'overview', night: 1 }, 12, 2], ['summit-car-storm', { mode: 'car', night: 1, rain: 1, storm: 1 }, 12, 5],
  ['turn-intro', { ...base, mode: 'overview' }, 17, 9]                 // 4 ô cuối bài rồi vào lại đoạn mở đầu: chỗ nối
];
console.log(`Nhạc chủ đề: ${info.bars} ô, ${info.bpm} BPM, một vòng ${LOOP.toFixed(1)} s`);
check(LOOP >= 120 && LOOP <= 240, `độ dài một vòng 2–4 phút (${LOOP.toFixed(1)} s)`);
const rmsOf = {};
for (const [name, mix, sec, section] of CASES) {
  const r = await render(name, mix, sec, section); rmsOf[name] = r.rms;
  const body = r.win.slice(1), quiet = Math.min(...body), first = Math.sqrt(r.win.slice(0, 4).reduce((s, x) => s + x * x, 0) / 4);
  console.log(`${name}: đỉnh ${db(r.peak)} dBFS, RMS ${db(r.rms)} dBFS, giây lặng nhất ${db(quiet)} dBFS, 4 s đầu ${db(first)} dBFS (kết xuất ${(r.ms / 1000).toFixed(1)} s)`);
  check(r.clip === 0 && r.peak < 0.98, `${name}: không chạm trần (${r.clip} mẫu ≥ 0,999)`);
  check(r.rms > 0.02 && r.rms < 0.25, `${name}: RMS trong khoảng −34 … −12 dBFS`);
  check(quiet > 0.004, `${name}: không có giây nào lặng (> −48 dBFS)`);
  check(first > 0.01, `${name}: 4 giây đầu đã có nhạc (> −40 dBFS)`);
  if (name === 'turn-intro' || name === 'full-day') console.log(`  RMS từng giây: ${r.win.map(db).join(' / ')}`);
}
if (!FULL) {
  check(rmsOf['theme-tour'] < rmsOf['theme-overview'] * 0.9, `bản Tour nhỏ hơn bản toàn cảnh (${db(rmsOf['theme-tour'])} so với ${db(rmsOf['theme-overview'])} dBFS)`);
  check(rmsOf['theme-stroll'] < rmsOf['summit-car'], `đi dạo nhẹ hơn ô tô (${db(rmsOf['theme-stroll'])} so với ${db(rmsOf['summit-car'])} dBFS)`);
}
check(errors.length === 0, `không lỗi trang${errors.length ? ': ' + errors.join(' | ') : ''}`);
await browser.close();
console.log(bad ? `music-render: ${bad} LỖI` : 'music-render: đạt');
if (WAV) console.log('Đã ghi WAV vào tests/screens/music/');
process.exit(bad ? 1 : 0);

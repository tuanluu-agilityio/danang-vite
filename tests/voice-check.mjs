// Kiểm tra giọng thuyết trình của Tour (Tiếng Việt, English và Русский):
//  1. Mỗi điểm dừng của 4 Tour có đúng một clip mp3 mỗi ngôn ngữ; thời lượng trong manifest khớp thời lượng thật (±0,3 s).
//  2. Có giọng thì mỗi đoạn bay đủ dài để đọc xong (clip + 1,2 s) trước khi sang điểm dừng kế.
//  3. Tour đổi điểm dừng thì phát đúng clip; đổi ngôn ngữ phát lại bằng giọng mới; Esc hoặc đổi góc nhìn thì dừng giọng.
//  4. Nút Thuyết minh: tắt thì Tour lặng và về thời lượng gốc; ngôn ngữ chưa có giọng (ja) thì nút bị khóa.
//  5. Kịch bản bão: mỗi mốc một clip (wxStorm), đọc xong trước mốc kế, phát đúng mốc, đổi ngôn ngữ đọc lại, Dừng kịch bản thì dừng giọng.
//  6. Không có lỗi console.
//
//   npm run build && node tests/voice-check.mjs
import { fileURLToPath } from 'node:url';
import fs from 'node:fs';
import { serveDir, launch, openApp, frames, waitFlight } from './lib.mjs';

const KEYS = { dragon: 'stops', ttl: 'ttlStops', tp: 'tpStops', sh: 'shStops' };
const VIEWS = { dragon: 'tour', ttl: 'ttlTour', tp: 'tpTour', sh: 'shTour' };
const problems = [];
const check = (ok, msg) => { if (!ok) problems.push(msg); };

const dist = fileURLToPath(new URL('../dist/', import.meta.url));
const server = await serveDir(dist);
const browser = await launch();
try {
  const { page, errors } = await openApp(browser, server.url);
  await page.waitForFunction(() => window.__app.narration.available, null, { timeout: 15000 });

  // 1. Số clip khớp số điểm dừng, thời lượng khớp thật
  const manifest = await page.evaluate(() => fetch('./voice/manifest.json').then((r) => r.json()));
  const stopCount = await page.evaluate(() => Object.fromEntries(Object.entries(window.__app.tours).map(([k, T]) => [k, T.stops.length])));
  for (const lang of ['vi', 'en', 'ru']) {
    for (const [bridge, key] of Object.entries(KEYS)) {
      const clips = manifest[lang]?.[key] || [];
      check(clips.length === stopCount[bridge], `${lang}/${key}: ${clips.length} clip, cần ${stopCount[bridge]}`);
      for (let i = 0; i < clips.length; i++) {
        check(fs.existsSync(new URL(`../public/voice/${lang}/${key}-${i}.mp3`, import.meta.url)), `thiếu file ${lang}/${key}-${i}.mp3`);
        // mp3 của Edge TTS không có header thời lượng nên <audio>.duration = Infinity: giải mã cả file để đo
        const real = await page.evaluate(async (u) => {
          const buf = await fetch(u).then((r) => r.arrayBuffer());
          return (await new OfflineAudioContext(1, 1, 24000).decodeAudioData(buf)).duration;
        }, `./voice/${lang}/${key}-${i}.mp3`);
        check(Math.abs(real - clips[i].d) <= 0.3, `${lang}/${key}-${i}: manifest ${clips[i].d}s, thật ${real}s`);
      }
    }
  }

  // Ghi lại các lần phát/dừng thay cho âm thanh thật
  await page.evaluate(() => {
    window.__plays = [];
    HTMLMediaElement.prototype.play = function () { window.__plays.push(this.dataset.url); this.dispatchEvent(new Event('playing')); return Promise.resolve(); };
    HTMLMediaElement.prototype.pause = function () { window.__plays.push('pause'); };
  });
  const lastPlay = () => page.evaluate(() => window.__plays.filter((u) => u !== 'pause').at(-1));
  const durs = (bridge) => page.evaluate((b) => [...window.__app.tours[b].durs], bridge);
  const setLang = async (code) => { await page.selectOption('#langSelect', code); await frames(page, 2); };
  const seek = async (bridge, i) => {   // tua tới lúc chú thích chuyển sang điểm i
    await page.evaluate(({ b, i }) => {
      const T = window.__app.tours[b], d = T.durs, n = d.length, p = (i + n - 1) % n;
      window.__app.tour.t = d.slice(0, p).reduce((a, x) => a + x, 0) + 0.6 * d[p];
    }, { b: bridge, i });
    await frames(page, 2);
  };

  for (const [bridge, key] of Object.entries(KEYS)) {
    await setLang('vi');
    await page.click(`button[data-bridge="${bridge}"]`); await waitFlight(page);
    await page.click(`button[data-view="${VIEWS[bridge]}"]`); await waitFlight(page);
    await frames(page, 2);

    // 2. Đoạn bay đủ dài cho giọng đọc
    for (const lang of ['vi', 'en', 'ru']) {
      await setLang(lang);
      const d = await durs(bridge), n = d.length;
      for (let k = 0; k < n; k++) {
        const window_ = 0.45 * d[(k + n - 1) % n] + 0.55 * d[k], clip = manifest[lang][key][k].d;
        check(window_ >= clip + 1.1, `${lang}/${key}-${k}: chỗ trống ${window_.toFixed(1)}s < clip ${clip}s`);
      }
    }

    // 3. Phát đúng clip, đổi ngôn ngữ, dừng giọng
    await setLang('vi');
    await seek(bridge, 1);
    check((await lastPlay())?.endsWith(`voice/vi/${key}-1.mp3`), `${bridge}: điểm 2 phát "${await lastPlay()}"`);
    await setLang('en');
    check((await lastPlay())?.endsWith(`voice/en/${key}-1.mp3`), `${bridge}: đổi sang English không phát lại bằng giọng en ("${await lastPlay()}")`);
    await setLang('ru');
    check((await lastPlay())?.endsWith(`voice/ru/${key}-1.mp3`), `${bridge}: đổi sang Русский không phát lại bằng giọng ru ("${await lastPlay()}")`);
    await page.keyboard.press('Escape'); await frames(page, 1);
    check((await page.evaluate(() => window.__plays.at(-1))) === 'pause', `${bridge}: Esc không dừng giọng`);
  }

  // 4. Nút tắt/bật giọng và ngôn ngữ chưa có giọng
  await setLang('vi');
  await page.click('button[data-bridge="ttl"]'); await waitFlight(page);
  await page.click('button[data-view="ttlTour"]'); await waitFlight(page); await frames(page, 2);
  const withVoice = await durs('ttl');
  await page.evaluate(() => document.getElementById('btnVoice').click()); await frames(page, 2);
  const mute = await durs('ttl');
  check(await page.getAttribute('#btnVoice', 'aria-pressed') === 'false', 'nút Thuyết minh không chuyển sang tắt');
  check(JSON.stringify(mute) === JSON.stringify(await page.evaluate(() => window.__app.tours.ttl.base)), 'tắt giọng nhưng thời lượng chưa về gốc');
  check(mute.reduce((a, b) => a + b) < withVoice.reduce((a, b) => a + b), 'tắt giọng nhưng Tour không ngắn lại');
  await page.evaluate(() => { window.__plays.length = 0; });
  await seek('ttl', 3);
  check((await page.evaluate(() => window.__plays.filter((u) => u !== 'pause').length)) === 0, 'đã tắt giọng mà vẫn phát');
  await page.evaluate(() => document.getElementById('btnVoice').click()); await frames(page, 2);
  check(JSON.stringify(await durs('ttl')) === JSON.stringify(withVoice), 'bật lại giọng nhưng thời lượng không trở về');
  await setLang('ja');
  check(await page.isDisabled('#btnVoice'), 'ngôn ngữ ja chưa có giọng nhưng nút không bị khóa');
  check(JSON.stringify(await durs('ttl')) === JSON.stringify(await page.evaluate(() => window.__app.tours.ttl.base)), 'ja: thời lượng phải là bản gốc');
  await setLang('vi');

  // 5. Kịch bản bão: mỗi mốc một clip wxStorm, đọc xong (clip + 1,2 s) trước mốc kế; nút chạy phát clip mốc 0 (sau khi bay camera), sang mốc kế
  //    phát clip kế, đổi ngôn ngữ đọc lại, dừng kịch bản thì dừng giọng. Dòng thời gian kéo dài theo giọng của từng ngôn ngữ (D-013): đọc lại sau setLang
  await page.keyboard.press('Escape'); await frames(page, 1);
  const timeline = () => page.evaluate(() => { const s = window.__app.weather.scenario; return { times: [...s.times], duration: s.duration }; });
  for (const lang of ['vi', 'en', 'ru']) {
    await setLang(lang);
    const sc = await timeline(), ends = [...sc.times.slice(1), sc.duration];
    const clips = manifest[lang]?.wxStorm || [];
    check(clips.length === sc.times.length, `${lang}/wxStorm: ${clips.length} clip, cần ${sc.times.length} (số mốc kịch bản)`);
    for (let i = 0; i < clips.length; i++) {
      check(fs.existsSync(new URL(`../public/voice/${lang}/wxStorm-${i}.mp3`, import.meta.url)), `thiếu file ${lang}/wxStorm-${i}.mp3`);
      const real = await page.evaluate(async (u) => {
        const buf = await fetch(u).then((r) => r.arrayBuffer());
        return (await new OfflineAudioContext(1, 1, 24000).decodeAudioData(buf)).duration;
      }, `./voice/${lang}/wxStorm-${i}.mp3`);
      check(Math.abs(real - clips[i].d) <= 0.3, `${lang}/wxStorm-${i}: manifest ${clips[i].d}s, thật ${real}s`);
      check(clips[i].d + 1.2 <= ends[i] - sc.times[i], `${lang}/wxStorm-${i}: clip ${clips[i].d}s không đọc xong trong ${ends[i] - sc.times[i]}s trước mốc kế`);
    }
  }
  await setLang('vi');
  const sc = await timeline();
  await page.evaluate(() => document.getElementById('btnWxStorm').click()); await frames(page, 2);
  check((await lastPlay())?.endsWith('voice/vi/wxStorm-0.mp3'), `kịch bản bão: mốc 1 phát "${await lastPlay()}"`);
  await page.evaluate((t) => { window.__app.weather.scenario.t = t - 0.01; }, sc.times[1]); await frames(page, 3);
  check((await lastPlay())?.endsWith('voice/vi/wxStorm-1.mp3'), `kịch bản bão: mốc 2 phát "${await lastPlay()}"`);
  await setLang('en');
  check((await lastPlay())?.endsWith('voice/en/wxStorm-1.mp3'), `kịch bản bão: đổi sang English không đọc lại mốc 2 ("${await lastPlay()}")`);
  await setLang('vi');
  await page.evaluate(() => document.getElementById('btnWxStorm').click()); await frames(page, 2);
  check(!(await page.evaluate(() => window.__app.weather.scenario.running)) && (await page.evaluate(() => window.__plays.at(-1))) === 'pause', 'kịch bản bão: nút Dừng không dừng giọng');

  if (errors.length) { console.log('Lỗi console:', errors); problems.push('có lỗi console'); }
  await page.close();
} finally { await browser.close(); server.close(); }

console.log(problems.length ? 'LỖI:\n - ' + problems.join('\n - ') : 'Giọng thuyết trình: đạt (vi + en + ru, 4 tour, 28 điểm dừng + 8 mốc kịch bản bão mỗi ngôn ngữ).');
process.exit(problems.length ? 1 : 0);

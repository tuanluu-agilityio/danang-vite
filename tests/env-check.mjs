// Kiểm tra trình duyệt: chỉ báo giờ + thời tiết thực tế Đà Nẵng (#env: #envPill + #envCard, D-042 Task 3).
// GHI CHÚ: tới nay test này CHỈ mới chạy với GPU thật (TEST_REAL_GPU=1 npm run test:env, xem launch() trong tests/lib.mjs); chưa từng chạy trên SwiftShader.
// Mọi trang chặn Open-Meteo bằng page.route (đếm yêu cầu, trả tests/env-unit/fixture.json hoặc 500). Tám lần mở trang, dùng chung một trình duyệt:
//   P  điện thoại 390×844 `?test`             : mục 1 (không gọi mạng, đang tải, đồng hồ = giờ Đà Nẵng), bố cục tham quan dọc / ngang / ar, 9 ngôn ngữ trên tờ đáy.
//   D  máy tính 1280×720 `?test&env=live`     : mục 2 (số liệu từ fixture), 3 (buổi), 4 (trạng thái, 500), 5 (độc lập với mô phỏng), 6 (mở / đóng), bố cục tham quan + ar, 9 ngôn ngữ.
//   DS / DD / DB máy tính `?explore=stroll|drive|bike` 1280×720, rồi thu cửa sổ (700×800, 900×460: chế độ gọn + chuột): bố cục khám phá; DD thêm mục 8 (Space / Esc).
//   PS / PD / PB điện thoại 390×844 `?explore=…`: bố cục khám phá (PS: hiện #stToast chữ dài nhất; PD: ar + ru, chỉ báo dưới chú thích bản đồ).
//   Mục 10: console sạch ở mọi trang. Dòng hướng dẫn phím giữa trên (#drHint, #bkHint, #exHint, #stHint) chỉ in "ghi chú" khi chạm chỉ báo (hạn chế đã biết), không chấm.
//
//   npm run build && TEST_REAL_GPU=1 npm run test:env
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { serveDir, launch, openApp, frames, pick } from './lib.mjs';

const problems = [];
const check = (name, ok) => { if (!ok) problems.push(name); console.log(`${ok ? 'đạt ' : 'LỖI '} ${name}`); return ok; };
const note = (s) => console.log(`ghi chú ${s}`);
const sleep = (ms) => new Promise((ok) => setTimeout(ok, ms));

/* Chép từ mobile-check.mjs: phần tử "đang hiện", hộp của các phần tử đang hiện, hai hộp chồng nhau (giao > 0,5 px mỗi chiều), phần tử trên cùng ở tâm */
const VISIBLE = (el) => (el.checkVisibility ? el.checkVisibility() : el.getClientRects().length > 0);
const rects = (page, sels) => page.evaluate(([sels, vis]) => {
  const visible = new Function('return ' + vis)();
  return sels.flatMap((s) => [...document.querySelectorAll(s)].filter(visible).map((el) => { const b = el.getBoundingClientRect(); return { sel: s, left: b.left, top: b.top, right: b.right, bottom: b.bottom, width: b.width, height: b.height }; }));
}, [sels, VISIBLE.toString()]);
const overlap = (a, b) => Math.min(a.right, b.right) - Math.max(a.left, b.left) > 0.5 && Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top) > 0.5;
const noOverlap = (r) => r.every((a, i) => r.every((b, j) => j <= i || !overlap(a, b)));
const topAtCenter = (page, sel) => page.evaluate((sel) => {
  const el = document.querySelector(sel); el.scrollIntoView({ block: 'nearest' });
  const b = el.getBoundingClientRect(), t = document.elementFromPoint(b.left + b.width / 2, b.top + b.height / 2);
  return !!t && (t === el || el.contains(t));
}, sel);
const inView = (b, w, h) => b.left >= 0 && b.top >= 0 && b.right <= w + 0.5 && b.bottom <= h + 0.5;
const fmtBox = (b) => b ? `${b.left.toFixed(0)},${b.top.toFixed(0)} ${b.width.toFixed(0)}×${b.height.toFixed(0)}` : 'không hiện';

const FIX = JSON.parse(fs.readFileSync(new URL('./env-unit/fixture.json', import.meta.url), 'utf8'));
const ICT = (h, m) => Date.UTC(2026, 10, 14, h - 7, m);   // ms — h:m giờ Đà Nẵng ngày 2026-11-14
const LANGS = ['vi', 'en', 'ko', 'ja', 'zh', 'th', 'ar', 'hi', 'ru'];
const HINTS = ['#drHint', '#bkHint', '#exHint', '#stHint'];

/* Chặn Open-Meteo: om.n đếm yêu cầu; om.mode 'ok' trả fixture, '500' trả lỗi máy chủ */
const routeOM = (om) => (page) => page.route('**/api.open-meteo.com/**', (r) => {
  om.n++;
  if (om.mode === '500') return r.fulfill({ status: 500, contentType: 'text/plain', headers: { 'access-control-allow-origin': '*' }, body: 'lỗi' });
  return r.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(FIX) });
});
const open = async (url, opts) => {
  const om = { n: 0, mode: 'ok' };
  const A = await openApp(browser, url, { ...opts, before: routeOM(om) });
  A.page.setDefaultTimeout(60000);
  return { ...A, om };
};
const envText = (page) => page.evaluate(() => document.getElementById('env').textContent);
const q = (page, sel) => page.evaluate((s) => document.querySelector(s)?.textContent ?? null, sel);
const setLang = async (page, l) => { await page.evaluate((l) => { location.hash = '#' + l; }, l); await page.waitForFunction((l) => document.documentElement.lang === l, l); await frames(page, 2); };
/* Chờ #env yên: không còn mờ số liệu (.out, 180 ms) và không còn chuyển tiếp CSS nào trong #env (thẻ .28 s, tờ đáy .34 s, nền .9 s). Không dùng giờ cố định: máy bận thì khung dài */
const settle = (page) => page.waitForFunction(() => {
  const env = document.getElementById('env');
  return !env.querySelector('.out') && !document.getAnimations().some((a) => a instanceof CSSTransition && a.effect && env.contains(a.effect.target));
}, null, { timeout: 15000 });
const sheetEnv = (page) => page.evaluate(() => document.body.classList.contains('sheet-env') && window.__app.ui.ui.sheet === 'env');

/* Chỉ báo hiện, trong khung, không chồng các điều khiển đang hiện; chạm dòng hướng dẫn phím chỉ ghi chú. Trả hộp chỉ báo */
async function pillLayout(page, label, others, w, h) {
  const [pill] = await rects(page, ['#envPill']);
  if (!check(`${label}: chỉ báo hiện`, !!pill)) return null;
  const r = await rects(page, others);
  const hit = r.filter((b) => overlap(pill, b)).map((b) => b.sel);
  check(`${label}: chỉ báo ${fmtBox(pill)} trong khung ${w}×${h}`, inView(pill, w, h));
  check(`${label}: chỉ báo không chồng ${[...new Set(r.map((b) => b.sel))].join(' ')}${hit.length ? ' (chồng: ' + hit.join(' ') + ')' : ''}`, hit.length === 0);
  check(`${label}: chỉ báo bấm được (không bị lớp khác che)`, await topAtCenter(page, '#envPill'));
  const hr = (await rects(page, HINTS)).filter((b) => overlap(pill, b));
  if (hr.length) note(`${label}: dòng hướng dẫn phím ${hr.map((b) => b.sel + ' ' + fmtBox(b)).join(', ')} chạm chỉ báo (hạn chế đã biết)`);
  return pill;
}

/* Số liệu như fixture (22:15, đêm, Tây Nam) và hai ca chữ dài để quét 9 ngôn ngữ: đêm hướng Tây Bắc; trưa hướng Đông Bắc, UV 11 (cực cao), dông, số lớn */
const WX = { obs: ICT(22, 15), obsMin: 1335, temp: 25.2, feels: 30.8, hum: 93, wind: 3.4, dir: 238, rain: 0, cloud: 10, uv: 0, code: 0, isDay: false, sunrise: 349, sunset: 1033 };
const SWEEP = [
  { at: ICT(22, 20), wx: { ...WX, dir: 315 } },
  { at: ICT(13, 0), wx: { ...WX, obs: ICT(12, 45), obsMin: 765, dir: 45, uv: 11.2, temp: 38.4, feels: 45.6, hum: 100, wind: 118, rain: 12.5, cloud: 100, code: 95, isDay: true } }
];
/* Thẻ mở theo 9 ngôn ngữ × hai bộ số liệu: không phần tử nào tràn ngang (scrollWidth > clientWidth + 1), thẻ trong khung; trả ngày của vi / en.
   Bỏ qua phần trang trí cố ý vượt hộp: chấm .live (vòng ::after inset −4 px), vạch mặt trời .env-sun / .track (chấm ở 0 % / 100 % lòi 3,5 px) — không phải chữ bị cắt */
async function langSweep(page, label, w, h) {
  const dates = {};
  const bad = [];
  for (const l of LANGS) {
    await setLang(page, l);
    await page.evaluate(() => window.__app.ui.openSheet('env'));
    for (const v of SWEEP) {
      await page.evaluate(([v]) => { window.__app.env.setNow(() => v.at); window.__app.env.store.inject(v.wx); }, [v]);
      await settle(page);   // số liệu đổi mờ 180 ms; thẻ máy tính .28 s, tờ đáy .34 s
      const res = await page.evaluate(() => {
        const card = document.getElementById('envCard'), b = card.getBoundingClientRect();
        const over = [...card.querySelectorAll('*')].filter((e) => e instanceof HTMLElement && !e.matches('.live, .env-sun, .track') && e.clientWidth > 0 && e.scrollWidth > e.clientWidth + 1)
          .map((e) => e.tagName.toLowerCase() + (e.className ? '.' + String(e.className).split(' ')[0] : '') + (Object.keys(e.dataset)[0] ? '[data-' + Object.keys(e.dataset)[0] + '] "' + e.textContent.trim() + '"' : ''));
        return { box: { left: b.left, top: b.top, right: b.right, bottom: b.bottom }, over, date: document.querySelector('[data-date]').textContent };
      });
      dates[l] = res.date;
      if (res.over.length || !inView(res.box, w, h)) bad.push(`${l}: ${res.over.join(' ')}${inView(res.box, w, h) ? '' : ' ngoài khung'}`);
    }
  }
  await page.evaluate(() => window.__app.ui.closeSheets());
  check(`${label}: thẻ 9 ngôn ngữ không tràn ngang, trong khung${bad.length ? ' (' + bad.join('; ') + ')' : ''}`, bad.length === 0);
  check(`${label}: ngày vi / en không rỗng, khác nhau ("${dates.vi}" / "${dates.en}")`, !!dates.vi && !!dates.en && dates.vi !== dates.en);
  await setLang(page, 'vi');
}

const srv = await serveDir(fileURLToPath(new URL('../dist/', import.meta.url)));
const browser = await launch();
const allErrors = [];
const t0 = Date.now();
try {
  /* ===== Trang P: điện thoại 390×844, ?test (không gọi Open-Meteo) ===== */
  const P = await open(srv.url, { width: 390, height: 844, mobile: true });
  // Mục 1
  await sleep(3000);
  check('1: ?test: 0 yêu cầu tới Open-Meteo sau 3 s', P.om.n === 0);
  const s1 = await P.page.evaluate(() => ({ state: document.getElementById('env').dataset.state, hm: document.querySelector('#envPill [data-hm]').textContent, ss: document.querySelector('#envCard [data-ss]').textContent, now: Date.now() }));
  check('1: #env hiện, data-state="loading"', s1.state === 'loading' && (await rects(P.page, ['#envPill'])).length === 1);
  const dn = new Date(s1.now + 7 * 3600e3), dnMin = dn.getUTCHours() * 60 + dn.getUTCMinutes();
  const [hh, mm] = s1.hm.split(':').map(Number), diff = Math.abs(((hh * 60 + mm) - dnMin + 1440 + 720) % 1440 - 720);
  check(`1: đồng hồ "${s1.hm}" dạng HH:mm, bằng giờ Đà Nẵng tính trong test (lệch ${diff} phút ≤ 1)`, /^\d\d:\d\d$/.test(s1.hm) && diff <= 1);
  await sleep(1200);
  check('1: giây đổi sau 1,2 s', (await q(P.page, '#envCard [data-ss]')) !== s1.ss);
  // Mục 7: tham quan điện thoại dọc / ngang, ar
  await pillLayout(P.page, '7: điện thoại dọc tham quan', ['.brand', '.views'], 390, 844);
  await setLang(P.page, 'ar');
  await pillLayout(P.page, '7: điện thoại dọc tham quan ar', ['.brand', '.views'], 390, 844);
  await P.page.setViewportSize({ width: 844, height: 390 }); await frames(P.page, 3);
  await pillLayout(P.page, '7: điện thoại ngang tham quan ar', ['.brand', '.views'], 844, 390);
  await setLang(P.page, 'vi');
  await pillLayout(P.page, '7: điện thoại ngang tham quan', ['.brand', '.views'], 844, 390);
  await P.page.setViewportSize({ width: 390, height: 844 }); await frames(P.page, 3);
  // Tờ đáy: bấm chỉ báo mở, × đóng
  await P.page.tap('#envPill'); await settle(P.page);
  const pc = (await rects(P.page, ['#envCard']))[0];
  check(`6: điện thoại: chạm chỉ báo mở tờ đáy ${fmtBox(pc)}, sát đáy, trong khung`, (await sheetEnv(P.page)) && !!pc && Math.abs(pc.bottom - 844) < 1 && inView(pc, 390, 844));
  await P.page.tap('#envX'); await frames(P.page, 2);
  check('6: điện thoại: × đóng tờ đáy', !(await sheetEnv(P.page)));
  // Mục 9 (điện thoại dọc)
  await langSweep(P.page, '9: điện thoại dọc', 390, 844);
  allErrors.push(...P.errors); await P.page.close();

  /* ===== Trang D: máy tính 1280×720, ?test&env=live, Open-Meteo trả fixture ===== */
  const D = await open(srv.url + '?env=live', { width: 1280, height: 720 });
  const Dp = D.page;
  // Mục 2
  await Dp.waitForFunction(() => window.__app.env.store.data !== null);
  await Dp.evaluate((t) => window.__app.env.setNow(() => t), ICT(22, 20));
  await settle(Dp);   // số liệu đổi: mờ ra / vào 180 ms
  check(`2: env=live: đúng 1 yêu cầu Open-Meteo (${D.om.n})`, D.om.n === 1);
  const s2 = await Dp.evaluate(() => {
    const g = (s) => document.querySelector(s).textContent.trim();
    return { state: document.getElementById('env').dataset.state, pillT: g('#envPill [data-temp]'), temp: g('[data-temp-n]'), desc: g('[data-desc]'), hum: g('[data-hum]'), wind: g('[data-wind]'),
      dir: g('[data-dir] span'), rain: g('[data-rain]'), cloud: g('[data-cloud]'), uv: g('[data-uv]'), foot: g('[data-foot]'), aria: document.getElementById('envPill').getAttribute('aria-label') };
  });
  check(`2: trạng thái ok (${s2.state})`, s2.state === 'ok');
  check(`2: nhiệt độ "25" (thẻ ${s2.temp}, chỉ báo ${s2.pillT})`, s2.temp === '25' && s2.pillT === '25°');
  check(`2: mô tả "Trời quang" lúc 22:15 (đêm) (${s2.desc})`, s2.desc === 'Trời quang');
  check(`2: độ ẩm 93 (${s2.hum})`, /^93\b/.test(s2.hum));
  check(`2: gió 3 (${s2.wind})`, /^3\D/.test(s2.wind));
  check(`2: hướng gió "Tây Nam" (${s2.dir})`, s2.dir === 'Tây Nam');
  check(`2: mưa "0,0" (${s2.rain})`, s2.rain.startsWith('0,0'));
  check(`2: mây 10 (${s2.cloud})`, /^10\b/.test(s2.cloud));
  check(`2: UV 0 (${s2.uv})`, /^0(\D|$)/.test(s2.uv));
  check(`2: chân thẻ có "22:15" (${s2.foot})`, s2.foot.includes('22:15'));
  check(`2: aria-label chỉ báo kèm nhiệt độ + giờ (${s2.aria})`, /25°, 22:20$/.test(s2.aria || ''));
  // Mục 3: buổi theo đồng hồ, không đụng mô phỏng ngày / đêm / thời tiết
  const sim = () => Dp.evaluate(() => [window.__app.dayNight.night, document.getElementById('timeSlider').value, document.getElementById('weatherSel').value, document.getElementById('weatherK').value].join('|'));
  const sim0 = await sim(), phases = [];
  for (const [h, m] of [[5, 50], [13, 0], [17, 0], [21, 0]]) {
    await Dp.evaluate((t) => window.__app.env.setNow(() => t), ICT(h, m));
    phases.push(await Dp.evaluate(() => document.getElementById('env').dataset.phase));
  }
  check(`3: buổi 05:50 / 13:00 / 17:00 / 21:00 = dawn / day / dusk / night (${phases.join(' / ')})`, phases.join() === 'dawn,day,dusk,night');
  check('3: night, #timeSlider, #weatherSel, #weatherK không đổi', (await sim()) === sim0);
  // Mục 4: offline, stale, 500
  const saved = await Dp.evaluate(() => window.__app.env.store.data);
  await Dp.evaluate((t) => { window.__app.env.setNow(() => t); window.__app.env.store.inject(null, true); }, ICT(22, 20));
  await settle(Dp);
  const s4 = await Dp.evaluate(() => [document.getElementById('env').dataset.state, document.querySelector('[data-temp-n]').textContent, document.querySelector('#envPill [data-temp]').textContent]);
  check(`4: inject(null, true): offline, nhiệt độ "– –" (${s4.join(' / ')})`, s4[0] === 'offline' && s4[1] === '– –' && s4[2] === '– –');
  await Dp.evaluate(([d, t]) => { window.__app.env.store.inject(d); window.__app.env.setNow(() => t); }, [saved, saved.obs + 3 * 3600e3]);
  await settle(Dp);
  const s4b = await Dp.evaluate(() => [document.getElementById('env').dataset.state, document.querySelector('[data-temp-n]').textContent, document.querySelector('[data-foot]').textContent]);
  check(`4: +3 giờ sau quan trắc: stale, số vẫn hiện (${s4b.join(' / ')})`, s4b[0] === 'stale' && s4b[1] === '25' && s4b[2].includes('22:15'));
  const nErr = D.errors.length;
  D.om.mode = '500';
  await Dp.evaluate(() => window.__app.env.store.refresh());
  await frames(Dp, 2);
  // Chrome tự ghi "Failed to load resource: … status of 500" vào console (thông báo của trình duyệt, không phải của mã): bỏ dòng đó, dòng khác là lỗi
  const after500 = D.errors.slice(nErr).filter((e) => !/status of 500/.test(e));
  D.errors.splice(nErr, D.errors.length - nErr, ...after500);
  check(`4: Open-Meteo trả 500: có gọi (${D.om.n}), không lỗi console, số cũ vẫn hiện`, D.om.n === 2 && after500.length === 0 && (await q(Dp, '[data-temp-n]')) === '25');
  D.om.mode = 'ok';
  // Mục 5: độc lập với mô phỏng
  await Dp.evaluate((t) => window.__app.env.setNow(() => t), ICT(22, 20)); await settle(Dp);
  const txt5 = await envText(Dp);
  await pick(Dp, '#weatherSel', 'storm');
  await Dp.evaluate(() => { const s = document.getElementById('timeSlider'); s.value = '100'; s.dispatchEvent(new Event('input', { bubbles: true })); s.dispatchEvent(new Event('change', { bubbles: true })); });
  await frames(Dp, 3);
  check('5: chọn bão + kéo Ngày / Đêm 100: chữ trong #env không đổi', (await envText(Dp)) === txt5);
  const wx0 = await Dp.evaluate(() => [window.__app.weather.state.preset, window.__app.weather.state.intensity].join('|'));
  await Dp.evaluate((d) => window.__app.env.store.inject({ ...d, temp: 31.4, code: 63, hum: 70 }), saved);
  await settle(Dp);
  const wx1 = await Dp.evaluate(() => [window.__app.weather.state.preset, window.__app.weather.state.intensity].join('|'));
  check(`5: inject số liệu khác (31°, mưa vừa): thời tiết mô phỏng không đổi (${wx0} → ${wx1}), chỉ báo đổi (${await q(Dp, '#envPill [data-temp]')})`, wx0 === wx1 && wx0.startsWith('storm') && (await q(Dp, '#envPill [data-temp]')) === '31°');
  await pick(Dp, '#weatherSel', 'now');
  await Dp.evaluate((d) => { const s = document.getElementById('timeSlider'); s.value = '0'; s.dispatchEvent(new Event('input', { bubbles: true })); window.__app.env.store.inject(d); window.__app.ui.closeSheets(); }, saved);
  await frames(Dp, 3);
  // Mục 6: mở / đóng
  await Dp.click('#envPill'); await settle(Dp);
  const c6 = (await rects(Dp, ['#envCard']))[0];
  check(`6: bấm chỉ báo: body.sheet-env, aria-expanded="true", thẻ ${fmtBox(c6)} hiện trong khung`, (await sheetEnv(Dp)) && (await Dp.getAttribute('#envPill', 'aria-expanded')) === 'true' && !!c6 && inView(c6, 1280, 720));
  // Đóng: ngay sau Esc thẻ còn hiện và đang chạy chuyển tiếp opacity + transform + visibility (trễ .28 s), không biến mất tức thì (lỗi review Task 2); sau đó ẩn hẳn
  const mid = await Dp.evaluate(() => {
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
    const card = document.getElementById('envCard');
    return [getComputedStyle(card).visibility, card.getAnimations().map((a) => a.transitionProperty).sort().join(' ')];
  });
  await Dp.waitForFunction(() => getComputedStyle(document.getElementById('envCard')).visibility === 'hidden', null, { timeout: 10000 });
  check(`6: Esc đóng thẻ; ngay sau đó thẻ còn ${mid[0]}, chuyển tiếp: ${mid[1]}; rồi ẩn hẳn`, !(await sheetEnv(Dp)) && mid[0] === 'visible' && /opacity/.test(mid[1]) && /transform/.test(mid[1]) && /visibility/.test(mid[1]));
  await Dp.click('#envPill'); await settle(Dp);
  const cam0 = await Dp.evaluate(() => window.__app.camera.position.toArray().concat(window.__app.controls.target.toArray()).map((v) => v.toFixed(3)).join());
  await Dp.mouse.click(900, 600); await frames(Dp, 4);
  const cam1 = await Dp.evaluate(() => window.__app.camera.position.toArray().concat(window.__app.controls.target.toArray()).map((v) => v.toFixed(3)).join());
  check('6: bấm cảnh đóng thẻ, camera không đổi', !(await sheetEnv(Dp)) && cam0 === cam1);
  await Dp.click('#envPill'); await settle(Dp);
  await Dp.click('#btnSettings'); await settle(Dp);
  await Dp.waitForFunction(() => getComputedStyle(document.getElementById('envPill')).visibility === 'hidden', null, { timeout: 10000 }).catch(() => {});
  const s6 = await Dp.evaluate(() => { const p = getComputedStyle(document.getElementById('envPill')); return [document.body.classList.contains('sheet-settings'), document.body.classList.contains('sheet-env'), p.visibility, p.pointerEvents]; });
  check(`6: bấm ⚙ khi thẻ mở: thẻ đóng, bảng Cài đặt mở; chỉ báo ẩn hẳn (visibility ${s6[2]}, pointer-events ${s6[3]})`, s6[0] && !s6[1] && s6[2] === 'hidden' && s6[3] === 'none');
  // Ngược lại: chỉ báo ẩn khi Cài đặt mở (spec 4.3) nên mở thẻ bằng openSheet: Cài đặt đóng
  await Dp.evaluate(() => window.__app.ui.openSheet('env')); await settle(Dp);
  check('6: mở thẻ khi Cài đặt đang mở: Cài đặt đóng', await Dp.evaluate(() => document.body.classList.contains('sheet-env') && !document.body.classList.contains('sheet-settings')));
  await Dp.click('#btnViewsSheet'); await settle(Dp);
  check('6: bấm ☰ khi thẻ mở: thẻ đóng, bảng Góc nhìn mở', await Dp.evaluate(() => document.body.classList.contains('sheet-views') && !document.body.classList.contains('sheet-env')));
  await Dp.click('#envPill'); await settle(Dp);
  check('6: bấm chỉ báo khi Góc nhìn mở: Góc nhìn đóng, thẻ mở', await Dp.evaluate(() => document.body.classList.contains('sheet-env') && !document.body.classList.contains('sheet-views')));
  await Dp.click('#envPill'); await settle(Dp);
  check('6: bấm lại chỉ báo: thẻ đóng', !(await sheetEnv(Dp)));
  // Mục 7: tham quan máy tính, ar
  await pillLayout(Dp, '7: máy tính tham quan', ['#btnSettings', '#btnViewsSheet', '.specs', '.stats'], 1280, 720);
  await setLang(Dp, 'ar');
  await pillLayout(Dp, '7: máy tính tham quan ar', ['#btnSettings', '#btnViewsSheet', '.specs', '.stats'], 1280, 720);
  await setLang(Dp, 'vi');
  // Mục 9 (máy tính)
  await langSweep(Dp, '9: máy tính', 1280, 720);
  allErrors.push(...D.errors); await Dp.close();

  /* ===== Khám phá: máy tính (DS / DD / DB) rồi điện thoại (PS / PD / PB) ===== */
  const EX = ['#btnSettings', '#btnExExit', '#stPhoto', '#drMap', '#drMapNote', '#drSpeed', '#drSoundBtn', '.bk-btn', '#drSteer', '#drGas', '#drBrake', '#stPad', '#stToast', '#exMpRoster'];
  const ready = { stroll: () => document.body.classList.contains('stroll'), drive: () => window.__app.drive.active(), bike: () => window.__app.bike.active() };
  for (const mode of ['stroll', 'drive', 'bike']) {
    const X = await open(srv.url + '?explore=' + mode, { width: 1280, height: 720 });
    const Xp = X.page;
    await Xp.waitForFunction(ready[mode]); await frames(Xp, 3);
    await pillLayout(Xp, `7: máy tính ${mode}`, EX, 1280, 720);
    if (mode === 'drive') {
      // Mục 8: bấm chỉ báo rồi Space: thẻ vẫn mở, nút không giữ focus; Esc đóng thẻ, không thoát chế độ (thoát = tải lại trang)
      await Xp.evaluate(() => { window.__envMark = 1; });
      await Xp.click('#envPill'); await settle(Xp);
      const foc = await Xp.evaluate(() => document.activeElement?.id || document.activeElement?.tagName);
      await Xp.keyboard.press('Space'); await frames(Xp, 2);
      check(`8: lái xe: bấm chỉ báo + Space: thẻ vẫn mở, focus không ở #envPill (${foc})`, (await sheetEnv(Xp)) && foc !== 'envPill');
      await Xp.keyboard.press('Escape'); await frames(Xp, 3);
      check('8: lái xe: Esc đóng thẻ, vẫn ở chế độ lái (không tải lại)', !(await sheetEnv(Xp)) && (await Xp.evaluate(() => window.__envMark === 1 && window.__app.drive.active())));
      // thẻ khám phá: dưới chỉ báo, trong khung
      await Xp.click('#envPill'); await settle(Xp);
      const xc = (await rects(Xp, ['#envCard']))[0];
      check(`7: máy tính drive: thẻ ${fmtBox(xc)} trong khung`, !!xc && inView(xc, 1280, 720));
      await Xp.keyboard.press('Escape'); await frames(Xp, 2);
      await setLang(Xp, 'ar');
      await pillLayout(Xp, `7: máy tính ${mode} ar`, EX, 1280, 720);
      await setLang(Xp, 'vi');
    }
    if (mode === 'bike') { await setLang(Xp, 'ar'); await pillLayout(Xp, `7: máy tính ${mode} ar`, EX, 1280, 720); await setLang(Xp, 'vi'); }
    // Cửa sổ máy tính 960×720 (chưa gọn: dải dòng hướng dẫn phím rộng, hạn chế đã biết) rồi cửa sổ hẹp (chế độ gọn + chuột): đứng và nằm
    for (const [w, h] of [[960, 720], [700, 800], [900, 460]]) {
      await Xp.setViewportSize({ width: w, height: h }); await frames(Xp, 3);
      const gon = w <= 760 || h <= 500;
      check(`7: cửa sổ ${w}×${h} ${mode}: ${gon ? '' : 'không '}body.compact`, (await Xp.evaluate(() => document.body.classList.contains('compact'))) === gon);
      await pillLayout(Xp, `7: cửa sổ ${gon ? 'hẹp ' : ''}${w}×${h} ${mode}`, EX, w, h);
    }
    if (mode === 'stroll') {
      await Xp.evaluate(() => { const t = document.getElementById('stToast'); t.textContent = 'Не удалось сохранить фото'; t.hidden = false; }); await frames(Xp, 2);
      await pillLayout(Xp, `7: cửa sổ hẹp 900×460 stroll, có #stToast`, EX, 900, 460);
    }
    allErrors.push(...X.errors); await Xp.close();
  }
  for (const mode of ['stroll', 'drive', 'bike']) {
    const X = await open(srv.url + '?explore=' + mode, { width: 390, height: 844, mobile: true });
    const Xp = X.page;
    await Xp.waitForFunction(ready[mode]); await frames(Xp, 3);
    if (mode === 'stroll') {
      // #stToast: chữ thật dài nhất (ru stPhotoFail) như khi chụp ảnh lỗi
      await Xp.evaluate(() => { const t = document.getElementById('stToast'); t.textContent = 'Не удалось сохранить фото'; t.hidden = false; }); await frames(Xp, 2);
    }
    await pillLayout(Xp, `7: điện thoại ${mode}`, EX, 390, 844);
    for (const l of mode === 'stroll' ? ['ar'] : ['ar', 'ru']) {
      await setLang(Xp, l); await frames(Xp, 3);
      const pill = await pillLayout(Xp, `7: điện thoại ${mode} ${l}`, EX, 390, 844);
      if (mode !== 'stroll' && pill) {
        const [nt] = await rects(Xp, ['#drMapNote']);
        check(`7: điện thoại ${mode} ${l}: chỉ báo dưới chú thích bản đồ (chú thích đáy ${nt ? nt.bottom.toFixed(0) : '?'}, chỉ báo đỉnh ${pill.top.toFixed(0)})`, !!nt && pill.top >= nt.bottom && pill.top - nt.bottom <= 16);
      }
    }
    await setLang(Xp, 'vi');
    if (mode === 'drive') {
      await Xp.tap('#envPill'); await settle(Xp);
      const pc = (await rects(Xp, ['#envCard']))[0];
      check(`6: điện thoại drive: chạm chỉ báo mở tờ đáy ${fmtBox(pc)} trong khung`, (await sheetEnv(Xp)) && !!pc && inView(pc, 390, 844));
      await Xp.tap('#envX'); await frames(Xp, 2);
      check('6: điện thoại drive: × đóng tờ đáy, vẫn lái', !(await sheetEnv(Xp)) && (await Xp.evaluate(() => window.__app.drive.active())));
    }
    allErrors.push(...X.errors); await Xp.close();
  }

  // Mục 10
  check('10: console sạch ở mọi trang', allErrors.length === 0);
  if (allErrors.length) console.log(allErrors.join('\n'));
} catch (e) {
  problems.push('ngoại lệ: ' + e); console.log(e);
} finally {
  await browser.close(); srv.close();
}
console.log(`thời gian: ${((Date.now() - t0) / 1000).toFixed(0)} s`);
console.log(problems.length ? `env-check: LỖI (${problems.length}): ${problems.join('; ')}` : 'env-check: đạt');
process.exit(problems.length ? 1 : 0);

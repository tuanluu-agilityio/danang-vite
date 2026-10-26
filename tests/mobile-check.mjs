// Kiểm tra giao diện điện thoại (kế hoạch feature/mobile-ui).
//   Mục 1: hạ tầng chế độ gọn (body.compact, sheet).
//   Mục 2: bố cục gọn — thanh trên, thanh dưới, hai sheet (Cài đặt, Góc nhìn).
//   Mục 3: chữ hướng dẫn cảm ứng, ẩn Đi bộ, sheet tự đóng khi Tour/bão, vệt mờ cuộn của hàng chip.
//
//   npm run build && npm run test:mobile
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { serveDir, launch, openApp, frames, waitFlight, pick } from './lib.mjs';

const problems = [];
const check = (name, ok) => { if (!ok) problems.push(name); console.log(`${ok ? 'đạt ' : 'LỖI '} ${name}`); return ok; };

/* Phần tử "đang hiện": có hộp hiển thị. Không dùng offsetParent vì .panel là position:fixed (offsetParent luôn null) */
const VISIBLE = (el) => (el.checkVisibility ? el.checkVisibility() : el.getClientRects().length > 0);
/* Hộp getBoundingClientRect() của các phần tử đang hiện (mọi phần tử khớp từng selector) */
const rects = (page, sels) => page.evaluate(([sels, vis]) => {
  const visible = new Function('return ' + vis)();
  return sels.flatMap((s) => [...document.querySelectorAll(s)].filter(visible).map((el) => { const b = el.getBoundingClientRect(); return { sel: s, left: b.left, top: b.top, right: b.right, bottom: b.bottom, width: b.width, height: b.height }; }));
}, [sels, VISIBLE.toString()]);
const allMatch = (page, sels, want) => page.evaluate(([sels, vis, want]) => {
  const visible = new Function('return ' + vis)();
  return sels.every((s) => { const els = [...document.querySelectorAll(s)]; return els.length > 0 && els.every((el) => visible(el) === want); });
}, [sels, VISIBLE.toString(), want]);
const hiddenAll = (page, sels) => allMatch(page, sels, false);
const visibleAll = (page, sels) => allMatch(page, sels, true);
/* Hai hộp chồng nhau khi phần giao có diện tích > 0,5 px mỗi chiều */
const noOverlap = (r) => r.every((a, i) => r.every((b, j) => j <= i || Math.min(a.right, b.right) - Math.max(a.left, b.left) <= 0.5 || Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top) <= 0.5));

const srv = await serveDir(fileURLToPath(new URL('../dist/', import.meta.url)));
const browser = await launch();
const allErrors = [];
try {
  // Mục 1 — hạ tầng
  const P = await openApp(browser, srv.url, { width: 390, height: 844, mobile: true });
  check('dọc 390×844: body.compact', await P.page.evaluate(() => document.body.classList.contains('compact') && window.__app.ui.ui.compact));
  await P.page.evaluate(() => window.__app.ui.openSheet('settings'));
  check('mở settings', await P.page.evaluate(() => document.body.classList.contains('sheet-settings') && !document.body.classList.contains('sheet-views')));
  await P.page.evaluate(() => window.__app.ui.openSheet('views'));
  check('chỉ một sheet', await P.page.evaluate(() => document.body.classList.contains('sheet-views') && !document.body.classList.contains('sheet-settings')));
  await P.page.evaluate(() => window.__app.ui.closeSheets());
  check('đóng hết', await P.page.evaluate(() => !/sheet-/.test(document.body.className)));

  // Mục 2 — bố cục gọn (trang dọc P)
  P.page.setDefaultTimeout(60000);   // một lần chạm không cần 4 phút; thiếu phần tử thì báo lỗi sớm
  await frames(P.page, 2);
  // đóng: các panel đang hiện chiếm ≤ 22 % diện tích, không chồng nhau, nằm trọn trong màn hình
  const r = await rects(P.page, ['.brand', '.views', '.specs', '.stats']);
  check('đóng: diện tích panel ≤ 22 %', r.reduce((s, b) => s + b.width * b.height, 0) <= 0.22 * 390 * 844);
  check('đóng: không chồng nhau', noOverlap(r));
  check('đóng: trong màn hình', r.every((b) => b.left >= 0 && b.top >= 0 && b.right <= 390 && b.bottom <= 844));
  check('đóng: #brandBody ẩn, .view-list ẩn', await hiddenAll(P.page, ['#brandBody', '.view-list']));
  const btns = await rects(P.page, ['#btnSettings', '#btnViewsSheet', '.tour-all']);
  check('nút thanh ≥ 40 px', btns.length === 3 && btns.every((b) => b.height >= 40));
  check('.views không tràn ngang', await P.page.evaluate(() => { const v = document.querySelector('.views'); return v.scrollWidth <= v.clientWidth; }));
  // settings
  await P.page.tap('#btnSettings');
  const s = (await rects(P.page, ['.brand']))[0];
  check('settings: cao ≤ 70 %, chạm đáy', s.height <= 0.7 * 844 + 1 && Math.abs(s.bottom - 844) < 2);
  check('settings: có #weatherSel, #qualitySel, #langSelect hiện', await visibleAll(P.page, ['#weatherSel', '#qualitySel', '#langSelect']));
  check('settings: .views ẩn', await hiddenAll(P.page, ['.views']));
  check('settings: aria-expanded', await P.page.evaluate(() => document.getElementById('btnSettings').getAttribute('aria-expanded') === 'true'));
  await P.page.tap('#scene', { position: { x: 200, y: 100 } });
  check('chạm canvas đóng sheet', await P.page.evaluate(() => !/sheet-/.test(document.body.className)));
  // nút đóng ✕ và Esc
  await P.page.tap('#btnSettings');
  await P.page.tap('.brand .sheet-close');
  check('nút ✕ đóng sheet cài đặt', await P.page.evaluate(() => !/sheet-/.test(document.body.className)));
  await P.page.tap('#btnSettings'); await P.page.tap('#btnSettings');
  check('bấm lại #btnSettings thì đóng', await P.page.evaluate(() => !/sheet-/.test(document.body.className)));
  await P.page.tap('#btnViewsSheet'); await P.page.keyboard.press('Escape');
  check('Esc đóng sheet góc nhìn', await P.page.evaluate(() => !/sheet-/.test(document.body.className)));
  // views
  await P.page.tap('#btnViewsSheet');
  check('views: lưới góc nhìn Cầu Rồng hiện', await visibleAll(P.page, ['[data-list="dragon"] [data-view="overview"]']));
  check('views: cao ≤ 55 % + thanh', (await rects(P.page, ['[data-list="dragon"]']))[0].height <= 0.55 * 844 + 1);
  check('views: lưới 2 cột', await P.page.evaluate(() => getComputedStyle(document.querySelector('[data-list="dragon"]')).gridTemplateColumns.split(' ').length === 2));
  check('views: .views không tràn ngang', await P.page.evaluate(() => { const v = document.querySelector('.views'); return v.scrollWidth <= v.clientWidth; }));
  await P.page.tap('[data-view="head"]');
  check('chọn góc nhìn: sheet đóng, camera bay', await P.page.evaluate(() => !/sheet-/.test(document.body.className) && ['fly', 'orbit'].includes(window.__app.cam.mode)));
  // chip cầu
  await P.page.tap('[data-bridge="sh"]'); await P.page.tap('#btnViewsSheet');
  check('chip sh: danh sách sh hiện, swing-box trọn hàng', await visibleAll(P.page, ['[data-list="sh"] #btnSwing']));
  check('chip sh: swing-box chiếm 2 cột', await P.page.evaluate(() => { const l = document.querySelector('[data-list="sh"]').getBoundingClientRect(), b = document.querySelector('[data-list="sh"] .swing-box').getBoundingClientRect(); return b.width > 0.8 * l.width; }));
  // xoay khi sheet mở
  await P.page.setViewportSize({ width: 844, height: 390 }); await frames(P.page, 3);
  const v = (await rects(P.page, ['[data-list="sh"]']))[0];
  check('xoay: sheet trong màn hình', !!v && v.top >= 0 && v.bottom <= 390);
  await P.page.setViewportSize({ width: 390, height: 844 });
  await P.page.evaluate(() => window.__app.ui.closeSheets());

  // Mục 3 — chữ cảm ứng, hover, sheet tự đóng, vệt mờ hàng chip
  await P.page.evaluate(() => { document.querySelector('.seg').scrollLeft = 0; });   // chạm chip ở mục 2 đã cuộn hàng chip
  await frames(P.page, 3);
  const fade = () => P.page.evaluate(() => { const c = document.querySelector('.seg').classList; return { start: c.contains('more-start'), end: c.contains('more-end') }; });
  const f0 = await fade();
  check('hàng chip: chưa cuộn thì mờ cuối, không mờ đầu', f0.end && !f0.start);
  await P.page.evaluate(() => { const s = document.querySelector('.seg'); s.scrollLeft = s.scrollWidth; });
  await frames(P.page, 3);
  const f1 = await fade();
  check('hàng chip: cuộn tới cuối thì hết mờ cuối, mờ đầu', !f1.end && f1.start);
  await P.page.screenshot({ path: 'tests/screens/mobile/t3-bar-fade-end.png' });
  await P.page.evaluate(() => { document.querySelector('.seg').scrollLeft = 0; });
  await frames(P.page, 3);
  await P.page.screenshot({ path: 'tests/screens/mobile/t3-bar-fade.png' });
  await P.page.evaluate(() => document.querySelector('[data-bridge="dragon"]').click());
  await P.page.evaluate(() => window.__app.ui.openSheet('views'));
  await frames(P.page, 2);
  check('cảm ứng: ẩn nút Đi bộ (tờ Góc nhìn đang mở)', await visibleAll(P.page, ['[data-list="dragon"] [data-view="overview"]']) && await hiddenAll(P.page, ['[data-view="walk"]']));
  await P.page.tap('[data-list="dragon"] [data-view="tour"]'); await waitFlight(P.page);
  check('Tour: sheet đóng, chú thích hiện', await P.page.evaluate(() => !/sheet-/.test(document.body.className) && !document.getElementById('tourCaption').hidden));
  const [cap, bar] = await rects(P.page, ['#tourCaption', '.views']);
  check('Tour: chú thích không bị thanh dưới che', cap.bottom <= bar.top + 1);
  check('cảm ứng: chữ thoát là bản touch', await visibleAll(P.page, ['#tourCaption .hint-touch']) && await hiddenAll(P.page, ['#tourCaption .hint-mouse']));
  check('cảm ứng: không hiện khóa i18n thô', await P.page.evaluate(() => !/Touch$/.test(document.querySelector('#tourCaption .hint-touch').textContent)));
  await P.page.screenshot({ path: 'tests/screens/mobile/t3-tour-touch.png' });
  await P.page.keyboard.press('Escape');
  await P.page.evaluate(() => window.__app.ui.openSheet('settings'));
  await P.page.evaluate(() => document.getElementById('btnWxStorm').click());
  check('kịch bản bão: sheet đóng', await P.page.evaluate(() => !/sheet-/.test(document.body.className)));
  check('kịch bản bão: chữ touch', await visibleAll(P.page, ['#wxScenario .hint-touch']) && await hiddenAll(P.page, ['#wxScenario .hint-mouse']));
  await P.page.evaluate(() => document.getElementById('btnWxStorm').click());

  // Mục 4 — i18n 9 ngôn ngữ cho khóa mới, không tràn chữ, RTL
  await P.page.evaluate(() => window.__app.ui.closeSheets());
  const KEYS = ['settings', 'close', 'tourExitTouch', 'wxStormHintTouch', 'swRideHintTouch'];
  for (const code of ['vi', 'en', 'ko', 'ja', 'zh', 'th', 'ar', 'hi', 'ru']) {
    const json = JSON.parse(fs.readFileSync(`src/i18n/locales/${code}.json`, 'utf8'));
    check(`${code}: đủ 5 khóa`, KEYS.every((k) => typeof json[k] === 'string' && json[k].length > 0));
    await pick(P.page, '#langSelect', code);
    for (const sh of ['settings', 'views']) {
      await P.page.evaluate((s) => window.__app.ui.openSheet(s), sh);
      const over = await P.page.evaluate(() => [...document.querySelectorAll('.brand, .views, .view-list:not([hidden])')].filter((e) => e.offsetParent && e.scrollWidth > e.clientWidth + 1).length);
      check(`${code} ${sh}: không tràn ngang`, over === 0);
    }
    if (code === 'ar') {
      await P.page.evaluate(() => window.__app.ui.openSheet('settings'));   // vòng trên mở 'views' cuối cùng nên .brand đang ẩn (rộng 0)
      await frames(P.page, 2);
      check('ar: dir=rtl, sheet trọn bề ngang', await P.page.evaluate(() => document.documentElement.dir === 'rtl' && Math.abs(document.querySelector('.brand').getBoundingClientRect().width - innerWidth) < 2));
      await P.page.evaluate(() => window.__app.ui.closeSheets());
      await P.page.evaluate(() => { document.querySelector('.seg').scrollLeft = 0; });
      await frames(P.page, 3);
      check('ar: hàng chip lúc nghỉ có mờ cuối', (await fade()).end);
      await P.page.evaluate(() => { const s = document.querySelector('.seg'); s.scrollLeft = -s.scrollWidth; });   // RTL: cuối dòng là scrollLeft âm
      await frames(P.page, 3);
      const fa = await fade();
      check('ar: cuộn tới cuối thì mờ đầu, hết mờ cuối', fa.start && !fa.end);
      await P.page.evaluate(() => { document.querySelector('.seg').scrollLeft = 0; });
    }
  }
  await pick(P.page, '#langSelect', 'vi');
  allErrors.push(...P.errors); await P.page.close();

  // cửa sổ máy tính hẹp (chuột): gọn nhưng giữ nút Đi bộ + chữ chuột
  const N = await openApp(browser, srv.url, { width: 700, height: 700 });
  check('máy tính hẹp: compact, Đi bộ hiện', await N.page.evaluate(() => document.body.classList.contains('compact')) && await N.page.evaluate(() => { window.__app.ui.openSheet('views'); return document.querySelector('[data-view="walk"]').offsetParent !== null; }));
  await N.page.evaluate(() => { document.getElementById('tourCaption').hidden = false; });
  check('chuột: chữ thoát là bản chuột', await visibleAll(N.page, ['#tourCaption .hint-mouse']) && await hiddenAll(N.page, ['#tourCaption .hint-touch']));
  allErrors.push(...N.errors); await N.page.close();

  // Mỗi lúc chỉ mở một trang: hai trang cùng chạy vòng vẽ làm SwiftShader quá tải (page.goto hết giờ)
  const L = await openApp(browser, srv.url, { width: 844, height: 390, mobile: true });
  check('ngang 844×390: body.compact', await L.page.evaluate(() => document.body.classList.contains('compact')));
  allErrors.push(...L.errors); await L.page.close();

  const D = await openApp(browser, srv.url, { width: 1280, height: 800 });
  check('máy tính 1280×800: không compact', await D.page.evaluate(() => !document.body.classList.contains('compact')));
  // máy tính không đổi
  const b = await rects(D.page, ['.brand']);
  check('máy tính: .brand neo trái 14 px, .views rộng 228 px', b.length === 1 && Math.abs(b[0].left - 14) < 1
    && await D.page.evaluate(() => getComputedStyle(document.querySelector('.views')).width === '228px'));
  check('máy tính: không có nút sheet', await hiddenAll(D.page, ['#btnSettings', '#btnViewsSheet', '.sheet-close']));
  allErrors.push(...D.errors); await D.page.close();

  check('console sạch', allErrors.length === 0);
  if (allErrors.length) console.log(allErrors.join('\n'));
} catch (e) {
  problems.push('ngoại lệ: ' + e); console.log(e);
} finally {
  await browser.close(); srv.close();
}
console.log(problems.length ? `mobile-check: LỖI (${problems.length}): ${problems.join('; ')}` : 'mobile-check: đạt');
process.exit(problems.length ? 1 : 0);

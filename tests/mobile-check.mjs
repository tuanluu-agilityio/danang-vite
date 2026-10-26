// Kiểm tra giao diện điện thoại (kế hoạch feature/mobile-ui). Mục 1: hạ tầng chế độ gọn (body.compact, sheet).
//
//   npm run build && npm run test:mobile
import { fileURLToPath } from 'node:url';
import { serveDir, launch, openApp } from './lib.mjs';

const problems = [];
const check = (name, ok) => { if (!ok) problems.push(name); console.log(`${ok ? 'đạt ' : 'LỖI '} ${name}`); return ok; };

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
  allErrors.push(...P.errors); await P.page.close();

  const L = await openApp(browser, srv.url, { width: 844, height: 390, mobile: true });
  check('ngang 844×390: body.compact', await L.page.evaluate(() => document.body.classList.contains('compact')));
  allErrors.push(...L.errors); await L.page.close();

  const D = await openApp(browser, srv.url, { width: 1280, height: 800 });
  check('máy tính 1280×800: không compact', await D.page.evaluate(() => !document.body.classList.contains('compact')));
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

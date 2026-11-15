// Chụp ảnh đại diện cho các thẻ ở màn chọn phương tiện (public/chooser/*.webp) từ chính cảnh 3D của dự án.
//   npm run build && npm run gen:chooser            (GPU thật; chỉ chạy lại khi cảnh / mô hình đổi nhiều)
//   npm run gen:chooser -- glider car               (chỉ chụp vài thẻ)
//   npm run gen:chooser -- --png                    (giữ thêm PNG gốc ở tests/screens/chooser/ để xem)
// Mỗi thẻ: mở đúng chế độ (`?explore=…`), đặt người / xe ở một chỗ đẹp, xoay camera của chính chế độ đó (kéo chuột), ẩn giao diện rồi chụp.
// Chụp ở 2× rồi thu về kích thước đích (khử răng cưa), nén WebP bằng canvas của Chromium (không thêm thư viện).
import { fileURLToPath } from 'node:url';
import { mkdirSync, writeFileSync, statSync } from 'node:fs';
import { serveDir, openApp, frames } from '../../tests/lib.mjs';
import { chromium } from 'playwright';

const OUT = fileURLToPath(new URL('../../public/chooser/', import.meta.url));
const PNG = fileURLToPath(new URL('../../tests/screens/chooser/', import.meta.url));
const argv = process.argv.slice(2), keepPng = argv.includes('--png'), only = argv.filter((a) => !a.startsWith('--'));
const W = 720, H = 900, GW = 1440, GH = 480;   // px — thẻ chế độ 4:5; thẻ Tham quan có hướng dẫn dải ngang 3:1
const QUALITY = 0.8;                            // chất lượng WebP
const MAX_BYTES = 150_000;                      // trần mỗi ảnh (cảnh báo khi vượt)

const night = (page, v) => page.evaluate((v) => { const A = window.__app; A.dayNight.target = v; A.dayNight.night = v; }, v);
const wait = (page, ms) => page.waitForTimeout(ms);
/* Kéo chuột trên cảnh để xoay camera của chế độ (lái xe / xe máy / đi dạo) */
async function drag(page, dx, dy) {
  const x = W / 2, y = H / 2;
  await page.mouse.move(x, y); await page.mouse.down();
  await page.mouse.move(x + dx, y + dy, { steps: 12 }); await page.mouse.up();
}

const SHOTS = {
  /* Dù lượn: trên sông phía Nam Cầu Rồng, bay về Bắc, thấy Cầu Rồng, Cầu sông Hàn và hai bờ */
  glider: { url: '?explore=glider', w: W, h: H, async pose(page) {
    await page.evaluate(() => { const s = window.__app.explore.state; s.pos.set(40, 150, 520); s.yaw = Math.PI / 2; s.bank = 0; });
    await wait(page, 1500);
  } },
  /* Ô tô: trên Cầu Rồng hướng Đông, thân rồng ở dải giữa */
  car: { url: '?explore=drive', w: W, h: H, async pose(page) {
    await page.evaluate(() => { const D = window.__app.drive; D.placeAt(-120, 8.625, 0); });
    await wait(page, 800);
    await drag(page, -70, -14);
    await wait(page, 500);
  } },
  /* Xe máy: góc nhìn thứ ba (thấy xe + người lái), trên Cầu Rồng hướng Tây về trung tâm */
  bike: { url: '?explore=bike', w: W, h: H, async pose(page) {
    await page.evaluate(() => { const B = window.__app.bike; B.setView(3); B.placeAt(60, -8.625, Math.PI); });
    await wait(page, 1200);
    await drag(page, -55, -8);
    await wait(page, 500);
  } },
  /* Đi dạo: lề Cầu Rồng, nhân vật siêu anh hùng (D-048) nhìn chéo phía trước; ẩn đám đông người đi bộ (mọi lưới '*-people' trừ 'stroll-people') để không ai che nhân vật */
  walk: { url: '?explore=stroll', w: W, h: H, async pose(page) {
    await wait(page, 2500);   // chờ nhân vật glb nạp xong
    await page.evaluate(() => window.__app.scene.traverse((o) => { if (/-people$/.test(o.name) && o.name !== 'stroll-people') o.visible = false; }));
    await drag(page, 450, -20);   // vòng ra trước mặt nhân vật: thấy tấm ngực + tia dây cầu
    await wait(page, 600);
  } },
  /* Tham quan có hướng dẫn: toàn cảnh Cầu Rồng (camera quỹ đạo của trang thường) */
  guided: { url: '', w: GW, h: GH, async pose(page) {
    await page.evaluate(() => { const { camera, controls } = window.__app; camera.position.set(-400, 85, 400); controls.target.set(40, 30, -20); controls.update(); });
    await wait(page, 600);
  } },
};

mkdirSync(OUT, { recursive: true }); if (keepPng) mkdirSync(PNG, { recursive: true });
const srv = await serveDir(fileURLToPath(new URL('../../dist/', import.meta.url)));
const args = ['--ignore-gpu-blocklist', '--enable-gpu']; if (process.platform === 'win32') args.unshift('--use-angle=d3d11');
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined, headless: true, args });
try {
  const conv = await browser.newPage();   // trang trống để nén WebP
  for (const [name, S] of Object.entries(SHOTS)) {
    if (only.length && !only.includes(name)) continue;
    const ctx = await browser.newContext({ viewport: { width: S.w, height: S.h }, deviceScaleFactor: 2 });   // openApp gọi ctx.newPage(): khung nhìn lấy từ ngữ cảnh
    const { page, errors } = await openApp(ctx, srv.url + S.url);
    await night(page, 0);
    await page.addStyleTag({ content: 'body > *:not(canvas){visibility:hidden !important;}' });   // ẩn giao diện để chỉ còn cảnh
    await frames(page, 30);
    await S.pose(page);
    await frames(page, 6);
    const png = await page.screenshot({ type: 'png' });
    await ctx.close();
    if (keepPng) writeFileSync(`${PNG}${name}.png`, png);
    const b64 = await conv.evaluate(async ({ src, w, h, q }) => {
      const img = new Image(); img.src = src; await img.decode();
      const c = document.createElement('canvas'); c.width = w; c.height = h;
      const g = c.getContext('2d'); g.imageSmoothingQuality = 'high'; g.drawImage(img, 0, 0, w, h);
      return c.toDataURL('image/webp', q).split(',')[1];
    }, { src: 'data:image/png;base64,' + png.toString('base64'), w: S.w, h: S.h, q: QUALITY });
    const file = `${OUT}${name}.webp`;
    writeFileSync(file, Buffer.from(b64, 'base64'));
    const n = statSync(file).size;
    console.log(`${name}.webp ${S.w}×${S.h} ${n} byte${n > MAX_BYTES ? '  (CẢNH BÁO: vượt trần ' + MAX_BYTES + ')' : ''}`);
    if (errors.length) console.log('  lỗi console:', errors.join(' | '));
  }
} finally { await browser.close(); srv.close(); }

// Kiểm tra chọn nhân vật nam / nữ ở chế độ Đi dạo nhiều người (npm run test:char; đọc dist/, cần build trước).
//   Ba trình duyệt độc lập (mỗi trang một context, localStorage riêng) + bot WebSocket qua `wrangler dev` cục bộ (cổng 8798, tự spawn, luôn kill).
//   A — A chọn Nam, B chọn Nữ: cả hai máy thấy A nam, B nữ; ô chọn mặc định Nam, có ảnh xem trước, ô đang chọn được đánh dấu.
//   F — A đi: máy B thấy A di chuyển, vẫn cùng một bản sao nhân vật (không dựng lại, không đổi mô hình).
//   C / D — C (Nữ) vào sau: C thấy đúng A, B ngay; A, B thấy đúng C.
//   G — bot khách cũ (join không có ch) và bot gửi ch lạ: hiện là Nam, không lỗi; bot gửi ch 1: Nữ. Chỉ nạp p0.glb và p3.glb.
//   E — B tải lại trang (kết nối lại): ô chọn nhớ Nữ, vào lại không chọn gì vẫn là Nữ ở mọi máy; nhân vật cũ của B được gỡ khi B rời.
//   B — đảo: A tải lại chọn Nữ, B tải lại chọn Nam: mọi máy thấy A nữ, B nam.
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { serveDir, launch, openApp } from './lib.mjs';

const PORT = 8798, HOST = `127.0.0.1:${PORT}`;
const MALE = 0, FEMALE = 3;   // số mô hình: CONFIG.stroll.anim.chars
const problems = [];
const check = (name, ok, extra = '') => { if (!ok) problems.push(name); console.log(`${ok ? 'đạt ' : 'LỖI '} ${name}${extra ? ' — ' + extra : ''}`); return ok; };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const wr = spawn(process.platform === 'win32' ? 'npx.cmd' : 'npx', ['wrangler', 'dev', '--port', String(PORT)], { cwd: fileURLToPath(new URL('../server/multi/', import.meta.url)), shell: process.platform === 'win32', stdio: ['ignore', 'pipe', 'pipe'] });
let log = ''; wr.stdout.on('data', (d) => { log += d; }); wr.stderr.on('data', (d) => { log += d; });
const stop = () => { try { if (process.platform === 'win32') spawn('taskkill', ['/pid', String(wr.pid), '/T', '/F']); else wr.kill(); } catch { /* bỏ qua */ } };
process.on('exit', stop);

let srv, browser;
const bots = [];
/* Bot đi dạo: join kind 'walk' với trường ch tùy ý (undefined = khách cũ, không gửi), đứng yên gửi vị trí 5 lần/s; ghi lại mọi lobby nhận được */
function walkBot(name, ch, x) {
  const ws = new WebSocket(`ws://${HOST}/sky`, { headers: { Origin: 'http://127.0.0.1' } });
  const b = { ws, timer: null, name, slot: -1, lobbies: [] };
  ws.onopen = () => ws.send(JSON.stringify(ch === undefined ? { t: 'join', name, kind: 'walk' } : { t: 'join', name, kind: 'walk', ch }));
  ws.onmessage = (e) => {
    const m = JSON.parse(e.data);
    if (m.t === 'lobby') b.lobbies.push(m);
    if (m.t === 'joined' && !b.timer) { b.slot = m.slot; b.timer = setInterval(() => ws.send(JSON.stringify({ t: 'pos', x, y: 8, z: 17.4, yaw: 0, pose: 0, ts: Date.now() })), 200); }
  };
  b.close = () => { clearInterval(b.timer); try { ws.close(); } catch { /* bỏ qua */ } };
  bots.push(b);
  return b;
}

try {
  for (let i = 0; i < 120; i++) { if (/Ready on/.test(log)) break; await sleep(500); }
  check('wrangler dev sẵn sàng', /Ready on/.test(log));
  srv = await serveDir(fileURLToPath(new URL('../dist/', import.meta.url)));
  browser = await launch();
  const URLC = srv.url + '?chooser&idleMs=600000&multi=' + encodeURIComponent(`ws://${HOST}/sky`);
  const glb = new Set();   // mô hình nhân vật đã được yêu cầu, gộp mọi trang
  const open = async () => {
    const o = await openApp(browser, URLC, { before: (pg) => pg.on('request', (r) => { const m = /people\/(p\d)\.glb/.exec(r.url()); if (m) glb.add(m[1]); }) });
    return o;
  };
  const ready = (pg) => pg.waitForFunction(() => window.__app && document.getElementById('loading')?.classList.contains('done'), null, { timeout: 180000 });
  /* Mở sảnh đi dạo; trả trạng thái ô chọn nhân vật lúc vừa mở */
  const lobby = async (pg) => {
    await pg.waitForSelector('#chooser', { state: 'visible', timeout: 240000 });
    await pg.click('#chooser [data-pick="walk"]');
    await pg.waitForFunction(() => /\d/.test(document.getElementById('exMpSeats')?.innerText || ''), null, { timeout: 60000 });
    return pg.evaluate(async () => {
      const box = document.getElementById('stCharPick'), bs = [...box.querySelectorAll('button[data-ch]')];
      await Promise.all(bs.map((b) => b.querySelector('img').decode().catch(() => {})));
      return {
        shown: box.getClientRects().length > 0, n: bs.length,
        checked: bs.filter((b) => b.getAttribute('aria-checked') === 'true').map((b) => Number(b.dataset.ch)),
        imgs: bs.map((b) => b.querySelector('img').naturalWidth), labels: bs.map((b) => b.innerText.trim()),
        marked: bs.map((b) => getComputedStyle(b).borderColor), name: document.getElementById('exMpNameIn').value
      };
    });
  };
  const pick = async (pg, ch) => {
    await pg.click(`#stCharPick button[data-ch="${ch}"]`);
    return pg.evaluate(() => [...document.querySelectorAll('#stCharPick button[data-ch]')].filter((b) => b.getAttribute('aria-checked') === 'true').map((b) => Number(b.dataset.ch)));
  };
  const go = async (pg, name) => {
    if (name !== null) await pg.fill('#exMpNameIn', name);
    await pg.click('#exMpFly');
    await pg.waitForFunction(() => window.__app.stroll.stroll.active() && window.__app.multi.session.phase === 'flying', null, { timeout: 120000 });
  };
  /* Chờ trang thấy đủ `names` bằng nhân vật có xương rồi trả { tên: mô hình }; kèm số bản sao đang gắn trong cảnh */
  const view = async (pg, names) => {
    await pg.waitForFunction((names) => {
      const A = window.__app, V = A.stroll.avatars, ws = A.multi.session.walkers;
      return names.every((n) => { const w = ws.find((x) => x.name === n); const d = w && V.debug(w.slot); return d && d.real; });
    }, names, { timeout: 240000 }).catch(() => {});
    return pg.evaluate(() => {
      const A = window.__app, V = A.stroll.avatars, out = { who: {}, real: {}, rigs: 0, self: V.self };
      for (const w of A.multi.session.walkers) { const d = V.debug(w.slot); out.who[w.name] = d ? d.model : null; out.real[w.name] = !!(d && d.real); }
      const g = A.scene.getObjectByName('stroll-people');
      if (g) out.rigs = g.children.filter((c) => c.name === 'stroll-rig').length;
      return out;
    });
  };
  const same = (v, want) => Object.keys(want).every((k) => v.who[k] === want[k] && v.real[k]) && Object.keys(v.who).length === Object.keys(want).length;
  const show = (v) => JSON.stringify(v.who);
  const all = async (pages, want, label) => {
    for (const [tag, pg] of pages) { const v = await view(pg, Object.keys(want)); check(`${label}: máy ${tag} thấy ${JSON.stringify(want)}, đủ ${Object.keys(want).length} bản sao`, same(v, want) && v.rigs === Object.keys(want).length, show(v) + ' rigs ' + v.rigs); }
  };

  // ===== Test A — A chọn Nam, B chọn Nữ =====
  const PA = await open(); console.log('máy A đã mở');
  const PB = await open(); console.log('máy B đã mở');
  const A = PA.page, B = PB.page;
  const la = await lobby(A);
  check('Sảnh đi dạo có ô chọn nhân vật: 2 lựa chọn, mặc định Nam, hai ảnh xem trước tải được', la.shown && la.n === 2 && la.checked.join() === '0' && la.imgs.every((w) => w > 0), JSON.stringify(la));
  check('Ô đang chọn được đánh dấu khác ô kia (màu viền)', la.marked[0] !== la.marked[1], la.marked.join(' | '));
  check('A bấm Nữ rồi bấm lại Nam: luôn đúng một ô được chọn', (await pick(A, 1)).join() === '1' && (await pick(A, 0)).join() === '0');
  await go(A, 'An');
  const lb = await lobby(B);
  check('Máy B (trình duyệt khác): mặc định Nam, không bị ảnh hưởng bởi máy A', lb.checked.join() === '0');
  check('B chọn Nữ: ô Nữ được chọn', (await pick(B, 1)).join() === '1');
  await go(B, 'Binh');
  await all([['A', A], ['B', B]], { An: MALE, Binh: FEMALE }, 'Test A');

  // ===== Test F — A đi, B nhìn: cùng bản sao, cùng mô hình =====
  {
    const before = await B.evaluate(() => { const A = window.__app, w = A.multi.session.walkers.find((x) => x.name === 'An'), s = A.stroll.avatars.slotState(w.slot), g = A.scene.getObjectByName('stroll-people'); return { x: s.x, z: s.z, ids: g.children.filter((c) => c.name === 'stroll-rig').map((c) => c.uuid).sort() }; });
    await A.keyboard.down('w');
    const moved = await B.waitForFunction((b) => { const A = window.__app, w = A.multi.session.walkers.find((x) => x.name === 'An'), s = w && A.stroll.avatars.slotState(w.slot); return s && Math.hypot(s.x - b.x, s.z - b.z) > 1.5; }, before, { timeout: 180000 }).then(() => true, () => false);
    await A.keyboard.up('w');
    const after = await B.evaluate(() => { const g = window.__app.scene.getObjectByName('stroll-people'); return g.children.filter((c) => c.name === 'stroll-rig').map((c) => c.uuid).sort(); });
    check('Test F: máy B thấy An di chuyển > 1,5 m', moved);
    check('Test F: sau khi đi, các bản sao nhân vật trên máy B vẫn là hai bản sao cũ (không dựng lại)', after.join() === before.ids.join() && after.length === 2);
    await all([['A', A], ['B', B]], { An: MALE, Binh: FEMALE }, 'Test F (sau khi đi)');
  }

  // ===== Test C / D — C (Nữ) vào sau =====
  const PC = await open(), C = PC.page; console.log('máy C đã mở');
  await lobby(C); await pick(C, 1); await go(C, 'Chi');
  await all([['C', C], ['A', A], ['B', B]], { An: MALE, Binh: FEMALE, Chi: FEMALE }, 'Test C/D (C vào sau)');

  // ===== Test G — khách cũ không có ch, ch lạ, ch 1 =====
  {
    const old = walkBot('Cu', undefined, -230), odd = walkBot('La', 7, -226);
    for (let i = 0; i < 40 && (old.slot < 0 || odd.slot < 0); i++) await sleep(250);
    check('Test G: bot khách cũ (không ch) và bot ch lạ đều được cấp chỗ', old.slot >= 0 && odd.slot >= 0);
    const last = old.lobbies.at(-1);
    const chOf = (n) => last.walkers.find((w) => w.name === n)?.ch;
    check('Test G: lobby từ máy chủ ghi An 0, Binh 1, Chi 1, Cu 0, La 0', chOf('An') === 0 && chOf('Binh') === 1 && chOf('Chi') === 1 && chOf('Cu') === 0 && chOf('La') === 0, JSON.stringify(last.walkers));
    await all([['A', A], ['B', B], ['C', C]], { An: MALE, Binh: FEMALE, Chi: FEMALE, Cu: MALE, La: MALE }, 'Test G');
    old.close(); odd.close();
    await A.waitForFunction(() => window.__app.multi.session.walkers.length === 3, null, { timeout: 60000 }).catch(() => {});
    const v = await view(A, ['An', 'Binh', 'Chi']);
    check('Test G: bot rời đi thì bản sao của chúng được gỡ (máy A còn 3)', v.rigs === 3, 'rigs ' + v.rigs);
  }

  // ===== Test E — B tải lại trang (kết nối lại) =====
  {
    await B.reload({ waitUntil: 'load', timeout: 180000 }); await ready(B);
    const gone = await A.waitForFunction(() => !window.__app.multi.session.walkers.some((w) => w.name === 'Binh'), null, { timeout: 60000 }).then(() => true, () => false);
    const va = await view(A, ['An', 'Chi']);
    check('Test E: B rời (tải lại) thì máy A hết thấy B, bản sao của B được gỡ', gone && va.rigs === 2 && same(va, { An: MALE, Chi: FEMALE }), show(va) + ' rigs ' + va.rigs);
    const l2 = await lobby(B);
    check('Test E: sau khi tải lại, ô chọn của B vẫn là Nữ và tên còn nhớ', l2.checked.join() === '1' && l2.name === 'Binh', JSON.stringify({ c: l2.checked, n: l2.name }));
    await go(B, null);   // không chọn lại, không gõ lại tên
    await all([['B', B], ['A', A], ['C', C]], { An: MALE, Binh: FEMALE, Chi: FEMALE }, 'Test E (B vào lại)');
  }

  // ===== Test B — đảo lựa chọn: A Nữ, B Nam =====
  {
    await A.reload({ waitUntil: 'load', timeout: 180000 }); await ready(A);
    await B.reload({ waitUntil: 'load', timeout: 180000 }); await ready(B);
    await C.waitForFunction(() => window.__app.multi.session.walkers.length === 1, null, { timeout: 60000 }).catch(() => {});
    await lobby(A); check('Test B: A đổi sang Nữ', (await pick(A, 1)).join() === '1'); await go(A, null);
    await lobby(B); check('Test B: B đổi sang Nam', (await pick(B, 0)).join() === '0'); await go(B, null);
    await all([['A', A], ['B', B], ['C', C]], { An: FEMALE, Binh: MALE, Chi: FEMALE }, 'Test B (đảo)');
  }

  check('Chỉ nạp mô hình của hai nhân vật (p0, p3), không nạp p1 / p2 / p4', [...glb].sort().join() === 'p0,p3', [...glb].sort().join());
  for (const [tag, o] of [['A', PA], ['B', PB], ['C', PC]]) check(`Máy ${tag}: không có lỗi console / pageerror`, o.errors.length === 0, o.errors.slice(0, 3).join(' | '));
} catch (e) {
  check('Không có ngoại lệ khi chạy', false, String(e && e.stack || e));
} finally {
  for (const b of bots) b.close();
  if (browser) await browser.close();
  if (srv) srv.close();
  stop();
}
console.log(problems.length ? `\nchar-check: LỖI ${problems.length} kiểm: \n- ` + problems.join('\n- ') : '\nchar-check: đạt');
process.exit(problems.length ? 1 : 0);

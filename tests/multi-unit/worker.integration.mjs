/* ===== Test tích hợp Worker dù lượn nhiều người: spawn `wrangler dev`, kiểm join/đầy/lobby/Origin ===== */
import { spawn } from 'node:child_process';
import http from 'node:http';

const PORT = 8799;
const HOST = `127.0.0.1:${PORT}`;
const ORIGIN = 'https://danangbridges.netlify.app';
const dir = new URL('../../server/multi/', import.meta.url);

const wr = spawn(process.platform === 'win32' ? 'npx.cmd' : 'npx', ['wrangler', 'dev', '--port', String(PORT)], { cwd: dir, shell: process.platform === 'win32', stdio: ['ignore', 'pipe', 'pipe'] });
let log = '';
wr.stdout.on('data', d => { log += d; }); wr.stderr.on('data', d => { log += d; });
const stop = () => { try { if (process.platform === 'win32') spawn('taskkill', ['/pid', String(wr.pid), '/T', '/F']); else wr.kill(); } catch {} };
process.on('exit', stop);

let fails = 0;
const ok = (c, m) => { console.log((c ? 'ĐẠT ' : 'LỖI ') + m); if (!c) fails++; };
const sleep = ms => new Promise(r => setTimeout(r, ms));

// Gửi yêu cầu nâng cấp WebSocket thô, trả mã HTTP
function upgradeStatus(origin) {
  return new Promise(res => {
    const headers = { Connection: 'Upgrade', Upgrade: 'websocket', 'Sec-WebSocket-Version': '13', 'Sec-WebSocket-Key': 'dGhlIHNhbXBsZSBub25jZQ==' };
    if (origin) headers.Origin = origin;
    const req = http.request({ host: '127.0.0.1', port: PORT, path: '/sky', headers });
    req.on('response', r => { res(r.statusCode); r.resume(); });
    req.on('upgrade', (r, sock) => { res(r.statusCode); sock.destroy(); });
    req.on('error', () => res(0));
    req.end();
  });
}

function client() {
  const ws = new WebSocket(`ws://${HOST}/sky`, { headers: { Origin: ORIGIN } });
  const msgs = [];
  ws.onmessage = e => msgs.push(JSON.parse(e.data));
  const opened = new Promise((r, j) => { ws.onopen = r; ws.onerror = () => j(new Error('ws error')); });
  return { ws, msgs, opened, send: o => ws.send(JSON.stringify(o)) };
}
const last = (c, t) => [...c.msgs].reverse().find(m => m.t === t);

try {
  for (let i = 0; i < 120; i++) { if (/Ready on/.test(log)) break; await sleep(500); }
  ok(/Ready on/.test(log), 'wrangler dev sẵn sàng');

  const cs = [];
  for (let i = 0; i < 6; i++) { const c = client(); await c.opened; cs.push(c); }
  await sleep(300);
  ok(cs.every(c => c.msgs[0] && c.msgs[0].t === 'lobby'), 'mỗi kết nối nhận lobby ngay khi vào');
  cs.forEach((c, i) => c.send({ t: 'join', name: 'P' + i }));
  await sleep(1000);
  const joined = cs.filter(c => last(c, 'joined')).length;
  const full = cs.filter(c => (last(c, 'rejected') || {}).why === 'full').length;
  ok(joined === 5 && full === 1, `6 kết nối join: ${joined} joined, ${full} rejected full`);

  const gone = cs.find(c => last(c, 'joined'));
  const stay = cs.find(c => c !== gone && last(c, 'joined'));
  gone.ws.close();
  await sleep(1000);
  const lob = last(stay, 'lobby');
  ok(lob && lob.flyers.length === 4, `đóng một kết nối: lobby còn ${lob ? lob.flyers.length : '?'} tên`);

  // Nhóm đi dạo: sau khi mọi người bay rời đi, một kết nối join kind 'walk' nhận joined kind walk, lobby có walkers 1 / flyers 0
  cs.forEach(c => { try { c.ws.close(); } catch {} });
  await sleep(1000);
  const wk = client(); await wk.opened;
  await sleep(300);
  wk.send({ t: 'join', name: 'Di', kind: 'walk' });
  await sleep(800);
  const wj = last(wk, 'joined'), wl = last(wk, 'lobby');
  ok(wj && wj.kind === 'walk' && wj.slot === 0, 'join kind walk nhận joined kind walk slot 0');
  ok(wl && wl.walkers && wl.walkers.length === 1 && wl.flyers.length === 0, `lobby sau đó: walkers ${wl && wl.walkers ? wl.walkers.length : '?'}, flyers ${wl ? wl.flyers.length : '?'}`);
  wk.send({ t: 'pos', x: 9999, y: 3, z: 0, yaw: 0, pose: 2, ts: 5 });
  await sleep(500);
  const wp = last(wk, 'pos');
  ok(wp && Array.isArray(wp.f) && wp.w && wp.w[0][1] === 400 && wp.w[0][5] === 2, 'pos đi dạo: f mảng, w kẹp x = 400, pose 2');

  // Nhóm lái xe (D-034): join kind 'drive' nhận joined kind drive; lobby có drivers; pos kẹp khung / v / st, phát nhóm d 8 phần tử
  const dv = client(); await dv.opened;
  await sleep(300);
  ok(dv.msgs[0] && Array.isArray(dv.msgs[0].drivers), 'lobby đầu có drivers (khách mới biết máy chủ hiểu lái xe)');
  dv.send({ t: 'join', name: 'Lai', kind: 'drive' });
  await sleep(800);
  const dj = last(dv, 'joined'), dl = last(dv, 'lobby');
  ok(dj && dj.kind === 'drive' && dj.slot === 0, 'join kind drive nhận joined kind drive slot 0');
  ok(dl && dl.drivers && dl.drivers.length === 1 && dl.walkers.length === 1 && dl.flyers.length === 0, `lobby sau đó: drivers ${dl && dl.drivers ? dl.drivers.length : '?'}, walkers ${dl && dl.walkers ? dl.walkers.length : '?'}, flyers ${dl ? dl.flyers.length : '?'}`);
  dv.send({ t: 'pos', x: 99999, y: 2.6, z: 0, yaw: 0, v: 99, st: -9, ts: 5 });
  await sleep(500);
  const dp = last(dv, 'pos'), wd = last(wk, 'pos');
  ok(dp && Array.isArray(dp.f) && dp.d && dp.d[0].length === 8 && dp.d[0][1] === 1530 && dp.d[0][5] === 30 && dp.d[0][6] === -0.56 && dp.d[0][7] === 5, 'pos lái xe: f mảng, d 8 phần tử, kẹp x = 1530, v = 30, st = −0,56, giữ ts');
  ok(wd && wd.d && wd.d[0][0] === 0, 'người khác (đi dạo) nhận nhóm d');
  ok(dj && dj.veh === 0 && dl.drivers[0].veh === 0, 'ô tô (join không veh): joined vọng veh 0, drivers veh 0');

  // Xe máy (D-040): join drive veh 1 + ch 1 nhận joined veh 1; drivers có veh 1, ch 1; st của xe máy kẹp như góc lái
  const bk = client(); await bk.opened;
  await sleep(300);
  bk.send({ t: 'join', name: 'Xe', kind: 'drive', veh: 1, ch: 1 });
  await sleep(800);
  const bj = last(bk, 'joined'), bl = last(bk, 'lobby');
  ok(bj && bj.kind === 'drive' && bj.slot === 1 && bj.veh === 1, 'join drive veh 1 nhận joined kind drive veh 1 slot 1');
  ok(bl && bl.drivers && bl.drivers.length === 2 && bl.drivers[1].veh === 1 && bl.drivers[1].ch === 1, `lobby: drivers ${bl && bl.drivers ? JSON.stringify(bl.drivers) : '?'}`);
  bk.send({ t: 'pos', x: 10, y: 2.6, z: 0, yaw: 0, v: 8, st: 0.48, ts: 7 });
  await sleep(500);
  const bp = last(dv, 'pos');
  ok(bp && bp.d && bp.d.some(e => e[0] === 1 && e[6] === 0.48), 'người lái ô tô nhận nhóm d của xe máy (st = độ nghiêng × 0,8)');
  bk.ws.close();
  dv.ws.close();
  wk.ws.close();

  // Chat theo khoảng cách (D-041): phòng đã dọn; ba người đi dạo ở x = 0 / 40 / 380 (z −100, y 3); Gan1 nói, chỉ Gan2 (cách 40 m) nhận; kết nối chưa join nhận why slot
  await sleep(1000);
  const cg = { Gan1: 0, Gan2: 40, Xa: 380 };
  const ch = {};
  for (const name of Object.keys(cg)) { const c = client(); await c.opened; ch[name] = c; }
  const ng = client(); await ng.opened;
  await sleep(300);
  ok(Object.values(ch).every(c => c.msgs[0] && c.msgs[0].t === 'lobby' && c.msgs[0].chat === 1), 'lobby đầu của mỗi kết nối có chat 1');
  for (const [name, c] of Object.entries(ch)) c.send({ t: 'join', name, kind: 'walk' });
  await sleep(800);
  for (const [name, c] of Object.entries(ch)) c.send({ t: 'pos', x: cg[name], y: 3, z: -100, yaw: 0, pose: 0, ts: 9 });
  await sleep(500);
  ch.Gan1.send({ t: 'chat', text: 'xin chào', id: 7 });
  ng.send({ t: 'chat', text: 'xin chào', id: 3 });
  await sleep(1000);
  const g2 = ch.Gan2.msgs.filter(m => m.t === 'chat');
  ok(g2.length === 1 && g2[0].name === 'Gan1' && g2[0].k === 'walk' && g2[0].text === 'xin chào', `Gan2 (cách 40 m) nhận chat của Gan1: ${JSON.stringify(g2)}`);
  ok(!ch.Xa.msgs.some(m => m.t === 'chat'), 'Xa (cách 380 m) không nhận chat');
  const a1 = last(ch.Gan1, 'chatAck');
  ok(a1 && a1.id === 7 && a1.n === 1 && !ch.Gan1.msgs.some(m => m.t === 'chat'), `Gan1 nhận chatAck id 7 n 1, không nhận lại tin mình: ${JSON.stringify(a1)}`);
  const an = last(ng, 'chatAck');
  ok(an && an.id === 3 && an.why === 'slot', `kết nối chưa join gửi chat: chatAck why slot: ${JSON.stringify(an)}`);
  for (const c of [...Object.values(ch), ng]) c.ws.close();

  ok(await upgradeStatus('https://evil.example') === 403, 'Origin lạ -> 403');
  ok(await upgradeStatus(null) === 403, 'không có Origin -> 403');
  ok(await upgradeStatus('http://localhost:5173') === 101, 'Origin http://localhost:5173 -> 101');
  ok(await upgradeStatus('https://deploy-preview-15--danangbridges.netlify.app') === 101, 'bản xem trước PR của site -> 101');
  ok(await upgradeStatus('https://deploy-preview-15--evil.netlify.app') === 403, 'bản xem trước của site khác -> 403');
  ok(await upgradeStatus('https://deploy-preview-x.y--danangbridges.netlify.app') === 403, 'dấu * không khớp dấu chấm -> 403');
  ok(await upgradeStatus('https://evil.com/deploy-preview-1--danangbridges.netlify.app') === 403, 'đường dẫn giả tên site -> 403');
  cs.forEach(c => { try { c.ws.close(); } catch {} });
} catch (e) {
  ok(false, 'ngoại lệ: ' + e.message + '\n' + log.slice(-1500));
}
stop();
await sleep(500);
console.log(fails ? `${fails} LỖI` : 'TẤT CẢ ĐẠT');
process.exit(fails ? 1 : 0);

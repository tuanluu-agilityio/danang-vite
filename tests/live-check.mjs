// Kiểm tra trình duyệt: môi trường 3D theo thời tiết + giờ thực tế (D-043, chế độ Trực tiếp / Mô phỏng). Kế hoạch: docs/superpowers/plans/2026-11-15-moi-truong-thuc.md Task 7.
// Số liệu bơm bằng __app.env.store.inject() + giờ ép bằng __app.env.setNow() (không gọi mạng: ?test không có env=live; Open-Meteo vẫn bị chặn + đếm bằng page.route).
// "Tua" tới đích: chép state.target vào state.current (+ mặt ướt, đêm) — tốc độ tiến dần đã có test Node (tests/live-unit/state.test.ts); riêng mục 4 đo tiến dần thật theo khung.
// Bảy lần mở trang, dùng chung một trình duyệt:
//   L  1280×720 `?test&envmode=live`   : mục 1–12 (18 kịch bản của spec §4.7 + Review Focus 4, 5 + tính năng cần đêm A.1)
//   T  1280×720 `?test`                : mục 13 (mặc định Mô phỏng, preset now, ban ngày, lệnh vẽ)
//   M  1280×720 `?test&envmode=manual` : mục 13 (lệnh vẽ đối chứng)
//   E× 1280×720 `?test&envmode=live&explore=glider|stroll|drive|bike` : mục 14 (khám phá không lỗi, chỉ báo chế độ); trang glider kiêm trang thứ hai của mục 15 (hai trang cùng số liệu)
//   Mục 16: console sạch, không ghi localStorage['cauRong.env'].
//
//   npm run build && TEST_REAL_GPU=1 npm run test:live      (SwiftShader: bỏ TEST_REAL_GPU, chậm hơn nhiều)
import { fileURLToPath } from 'node:url';
import { serveDir, launch, openApp, frames, tap, waitFlight, pickView } from './lib.mjs';

const problems = [];
const check = (name, ok) => { if (!ok) problems.push(name); console.log(`${ok ? 'đạt ' : 'LỖI '} ${name}`); return ok; };
const note = (s) => console.log(`ghi chú ${s}`);
const near = (a, b, e = 1e-6) => Math.abs(a - b) <= e;
const f3 = (v) => (typeof v === 'number' ? v.toFixed(3) : String(v));

const ICT = (h, m, d = 15) => Date.UTC(2026, 10, d, h - 7, m);   // ms — h:m giờ Đà Nẵng ngày d/11/2026
const W = (o = {}) => ({ obs: 0, obsMin: 600, temp: 27, feels: 29, hum: 70, wind: 12, dir: 45, rain: 0, cloud: 5, uv: 5, code: 0, isDay: true, sunrise: 355, sunset: 1035, gust: 20, vis: 24000, rate: 0, ...o });
const LOCKED = ['timeSlider', 'btnNight', 'weatherSel', 'weatherK', 'btnWxStorm'];
const STORE_KEY = 'cauRong.env';
const fogMax = 8;   // CONFIG.live.fogMax (không lộ qua __app; đổi số ở src/config.ts thì sửa ở đây)

/* Chặn Open-Meteo (đếm) */
const routeOM = (om) => (page) => page.route('**/api.open-meteo.com/**', (r) => { om.n++; return r.fulfill({ status: 500, contentType: 'text/plain', headers: { 'access-control-allow-origin': '*' }, body: 'chặn' }); });
const open = async (url, opts = {}) => {
  const om = { n: 0 };
  const A = await openApp(browser, url, { width: 1280, height: 720, ...opts, before: routeOM(om) });
  A.page.setDefaultTimeout(90000);
  return { ...A, om };
};

/* Đặt giờ + bơm số liệu (obs = giờ − 5 phút); tua: current = target, mặt ướt = mưa, đêm = đích. Trả ảnh chụp trạng thái sau vài khung */
async function put(page, at, wx, { tua = true, failed = false } = {}) {
  await page.evaluate(([at, wx, failed]) => { const a = window.__app; if (wx) wx.obs = at - 300000; a.env.setNow(() => at); a.env.store.inject(wx, failed); }, [at, wx, failed]);
  await frames(page, 3);
  if (tua) { await page.evaluate(() => { const a = window.__app, s = a.weather.state; Object.assign(s.current, s.target); s.wet = s.target.rain; a.dayNight.night = a.dayNight.target; }); await frames(page, 4); }
  return snap(page);
}
const snap = (page) => page.evaluate(() => {
  const a = window.__app, s = a.weather.state, r = a.weather.rain.mesh;
  return { mode: a.live.mode, target: { ...s.target }, current: { ...s.current }, preset: s.preset, intensity: s.intensity, tauScale: s.tauScale, wlive: a.weather.live,
    nightT: a.dayNight.target, night: a.dayNight.night, uNight: a.shared.uNight.value, rainVis: r.visible, rainCount: r.count, rainN: a.weather.rain.quality(),
    fogD: a.scene.fog.density, sun: a.live.sun && { ...a.live.sun }, envMode: document.getElementById('env').dataset.mode };
});
const finite = (p) => Object.values(p).every((v) => typeof v === 'boolean' || Number.isFinite(v));
const sameTarget = (a, b) => Object.keys(a).every((k) => (typeof a[k] === 'number' ? near(a[k], b[k], 1e-9) : a[k] === b[k]));

const srv = await serveDir(fileURLToPath(new URL('../dist/', import.meta.url)));
const browser = await launch();
const allErrors = [];
const t0 = Date.now();
let store0 = 'chưa đọc';
try {
  /* ===================== Trang L: ?test&envmode=live ===================== */
  const L = await open(srv.url + '?envmode=live');
  const Lp = L.page;
  store0 = await Lp.evaluate((k) => localStorage.getItem(k), STORE_KEY);

  // Mục 1: mặc định Trực tiếp, khóa điều khiển, chưa có số liệu ⇒ thời tiết trung tính (không bịa số liệu)
  const s1 = await snap(Lp);
  check('1: ?envmode=live: __app.live.mode = live, #env[data-mode=live]', s1.mode === 'live' && s1.envMode === 'live');
  const lock1 = await Lp.evaluate((ids) => ids.map((id) => document.getElementById(id).disabled), LOCKED);
  check(`1: Trực tiếp: ${LOCKED.join(' ')} disabled (${lock1.join(' ')})`, lock1.every(Boolean));
  check('1: chỉ báo hiện chữ chế độ (#envMode)', await Lp.evaluate(() => { const e = document.getElementById('envMode'); return !e.hidden && e.checkVisibility() && !!e.textContent.trim(); }));
  check(`1: chưa có số liệu: trung tính (mưa ${f3(s1.target.rain)}, chớp ${f3(s1.target.lightning)}, sương ${f3(s1.target.fog)})`, s1.target.rain === 0 && s1.target.lightning === 0 && !s1.target.fog);
  // Mục 2: lỗi API lúc đầu (inject(null, true)) ⇒ vẫn trung tính, không lỗi, trạng thái offline
  const s2 = await put(Lp, ICT(12, 0), null, { failed: true });
  check(`2: lỗi API lúc đầu: trung tính, data-state offline (${await Lp.evaluate(() => document.getElementById('env').dataset.state)})`, s2.target.rain === 0 && s2.target.lightning === 0 && (await Lp.evaluate(() => document.getElementById('env').dataset.state)) === 'offline');
  check(`2: trưa thật: dayNight.target 0, mặt trời cao (${f3(s2.sun?.elev)}°)`, s2.nightT === 0 && s2.sun && s2.sun.elev > 45);

  // Mục 3: tám trạng thái + ca biên (spec §4.7)
  const qc = await put(Lp, ICT(12, 0), W({ cloud: 5, code: 0 }));
  const fog0 = qc.fogD;
  check(`3 quang: mưa 0, sương 0, chớp 0, mây ${f3(qc.target.cloud)} ≈ 0,05, lưới mưa ẩn`, qc.target.rain === 0 && qc.target.fog === 0 && qc.target.lightning === 0 && near(qc.target.cloud, 0.05, 1e-6) && !qc.rainVis);
  check(`3 quang: level 0, closed false, số hữu hạn, tauScale ${qc.tauScale} > 1`, qc.target.level === 0 && qc.target.closed === false && finite(qc.target) && qc.tauScale > 1);
  const it = await put(Lp, ICT(7, 0), W({ code: 1, cloud: 25 }));
  check(`3 ít mây sáng sớm: mây ${f3(it.target.cloud)} = 0,25, mưa 0, ban ngày (đêm ${f3(it.nightT)})`, near(it.target.cloud, 0.25) && it.target.rain === 0 && it.nightT === 0);
  const ua = await put(Lp, ICT(11, 0), W({ code: 3, cloud: 100, hum: 88 }));
  check(`3 u ám: mây 1, mưa 0, sương ${f3(ua.target.fog)} ≤ 0,1`, ua.target.cloud === 1 && ua.target.rain === 0 && ua.target.fog <= 0.1);
  const mn = await put(Lp, ICT(14, 0), W({ code: 61, cloud: 95, hum: 92, rate: 0.8, rain: 0.2, vis: 12000 }));
  check(`3 mưa nhỏ 0,8 mm/h: 0,06 < mưa ${f3(mn.target.rain)} < 0,35, lưới mưa hiện (${mn.rainCount} vệt)`, mn.target.rain > 0.06 && mn.target.rain < 0.35 && mn.rainVis && mn.rainCount > 0);
  const mt = await put(Lp, ICT(20, 0), W({ code: 65, cloud: 100, hum: 98, rate: 30, rain: 7.5, vis: 3000, wind: 30, gust: 50, isDay: false }));
  check(`3 mưa to đêm 30 mm/h: mưa ${f3(mt.target.rain)} > 0,85, lưới mưa hiện (${mt.rainCount} vệt)`, mt.target.rain > 0.85 && mt.rainVis && mt.rainCount > 0);
  check(`3 mưa to đêm: dayNight.target 1, uNight ${f3(mt.uNight)} ≈ 1`, mt.nightT === 1 && near(mt.uNight, 1, 1e-3));
  const sg = await put(Lp, ICT(7, 30), W({ code: 45, cloud: 100, hum: 99, vis: 300, wind: 4, gust: 6 }));
  check(`3 sương 300 m: fog ${f3(sg.target.fog)} ≥ 0,9; mật độ ${sg.fogD.toExponential(2)} > gốc ${fog0.toExponential(2)} và < gốc × ${fogMax} × 1,01`, sg.target.fog >= 0.9 && sg.fogD > fog0 && sg.fogD < fog0 * fogMax * 1.01);
  const sgn = await put(Lp, ICT(7, 30), W({ code: 45, cloud: 100, hum: 99, vis: null, wind: 4, gust: 6 }));
  check(`3 sương không có tầm nhìn: fog ${f3(sgn.target.fog)} = sàn 0,6 (+ ẩm ≤ 0,1)`, sgn.target.fog >= 0.6 && sgn.target.fog <= 0.7 + 1e-9);
  const am = await put(Lp, ICT(9, 0), W({ code: 1, hum: 98, vis: 20000, cloud: 30 }));
  check(`3 ẩm 98 % trời trong: fog ${f3(am.target.fog)} ≤ 0,1 (không thành sương dày)`, am.target.fog <= 0.1);
  const gm = await put(Lp, ICT(13, 0), W({ code: 3, cloud: 80, wind: 72, gust: 108, dir: 30 }));
  check(`3 gió mạnh 72 km/h giật 108: gió ${f3(gm.target.wind)} = 20 m/s, giật ${f3(gm.target.gust)} = 10, mưa 0`, near(gm.target.wind, 20) && near(gm.target.gust, 10) && gm.target.rain === 0);
  const ng = await put(Lp, ICT(13, 0), W({ code: 3, cloud: 80, wind: 36, gust: null }));
  check(`3 thiếu gió giật: giật ${f3(ng.target.gust)} = 0,35 × gió ${f3(ng.target.wind)}`, near(ng.target.gust, 0.35 * ng.target.wind));
  const dg = await put(Lp, ICT(15, 0), W({ code: 95, cloud: 100, hum: 95, rate: 8, rain: 2, vis: 4000, wind: 35, gust: 70 }));
  check(`3 dông (95): chớp ${f3(dg.target.lightning)} = 0,5, mưa ${f3(dg.target.rain)} > 0,5`, near(dg.target.lightning, 0.5) && dg.target.rain > 0.5);
  const dh = await put(Lp, ICT(15, 0), W({ code: 96, cloud: 100, rate: 8, rain: 2 }));
  check(`3 dông mưa đá (96): chớp ${f3(dh.target.lightning)} = 0,8`, near(dh.target.lightning, 0.8));
  const mv = await put(Lp, ICT(15, 0), W({ code: 63, cloud: 100, rate: 8, rain: 2 }));
  check(`3 mưa vừa không dông (63): chớp ${mv.target.lightning} = 0`, mv.target.lightning === 0);
  const z1 = await put(Lp, ICT(12, 0), W({ code: 53, cloud: 90, rate: 0, rain: 0 }));
  check(`3 mã mưa phùn, 0 mm: mưa ${f3(z1.target.rain)} = sàn 0,05`, near(z1.target.rain, 0.05));
  const z2 = await put(Lp, ICT(12, 0), W({ code: 3, cloud: 90, rate: 0, rain: 0 }));
  check(`3 mã u ám, 0 mm: mưa ${z2.target.rain} = 0, lưới mưa ẩn`, z2.target.rain === 0 && !z2.rainVis);
  const z3 = await put(Lp, ICT(12, 0), W({ code: 1, cloud: 40, rate: 5, rain: 1.25 }));
  check(`3 mã quang nhưng đo 5 mm/h: mưa ${f3(z3.target.rain)} theo lượng đo (> 0,35)`, z3.target.rain > 0.35);
  const ht = await put(Lp, ICT(12, 0), W({ temp: 38, cloud: 0, code: 0 }));
  const hn = await put(Lp, ICT(0, 0, 16), W({ temp: 38, cloud: 0, code: 0, isDay: false }));
  check(`3 nóng 38 °C trời trong: mù nóng ${f3(ht.target.haze)} > 0,5 ban ngày, ${hn.target.haze} = 0 ban đêm`, ht.target.haze > 0.5 && hn.target.haze === 0);

  // Mục 4: đổi số liệu giữa hai lần làm mới — tiến dần, không khung nào nhảy (spec §4.2; lần áp đầu đã qua nên không tức thì)
  await put(Lp, ICT(12, 0), W({ code: 0, cloud: 5 }));
  await Lp.evaluate(() => { const a = window.__app; a.env.store.inject({ ...a.env.store.data, code: 65, rate: 30, rain: 7.5, cloud: 100 }); });
  const rs = await Lp.evaluate(() => new Promise((ok) => { const a = window.__app, xs = []; const f = () => { xs.push(a.weather.state.current.rain); if (xs.length >= 40) ok(xs); else requestAnimationFrame(f); }; requestAnimationFrame(f); }));
  const jump = Math.max(...rs.slice(1).map((v, i) => Math.abs(v - rs[i])));
  check(`4: ngay sau inject khung kế: mưa hiện tại ${f3(rs[1])} < 0,1; bước lớn nhất mỗi khung ${f3(jump)} < 0,02; vẫn tăng (${f3(rs.at(-1))} > ${f3(rs[0])})`, rs[1] < 0.1 && jump < 0.02 && rs.at(-1) > rs[0]);
  // Ngày → đêm (Review Focus 5): giờ nhảy trưa → nửa đêm (như tab ẩn nhiều giờ): đích đổi một lần, đêm tiến dần theo stepNight
  await put(Lp, ICT(12, 0), W({ code: 0, cloud: 5 }));
  await Lp.evaluate((at) => window.__app.env.setNow(() => at), ICT(0, 0, 16));
  const ns = await Lp.evaluate(() => new Promise((ok) => { const a = window.__app, xs = []; const f = () => { xs.push([a.dayNight.target, a.dayNight.night]); if (xs.length >= 30) ok(xs); else requestAnimationFrame(f); }; requestAnimationFrame(f); }));
  const nJump = Math.max(...ns.slice(1).map((v, i) => Math.abs(v[1] - ns[i][1])));
  check(`4: trưa → nửa đêm: đích 1 (${ns.at(-1)[0]}), đêm tiến dần (bước lớn nhất ${f3(nJump)} ≤ 0,081 = dt 0,05 × 1,6)`, ns.at(-1)[0] === 1 && nJump <= 0.081 && ns[1][1] < 0.2);
  // Hướng gió qua 0° (Review Focus 3): 350° → 10° quay cung ngắn
  await put(Lp, ICT(12, 0), W({ dir: 350 }));
  const wa = await Lp.evaluate(() => window.__app.weather.state.current.windDir);
  await Lp.evaluate(() => { const a = window.__app; a.env.store.inject({ ...a.env.store.data, dir: 10 }); });
  const wd = await Lp.evaluate(() => new Promise((ok) => { const a = window.__app, xs = []; const f = () => { xs.push(a.weather.state.current.windDir); if (xs.length >= 60) ok(xs); else requestAnimationFrame(f); }; requestAnimationFrame(f); }));
  const wb = await Lp.evaluate(() => window.__app.weather.state.target.windDir);
  const ang = (x, y) => { const d = Math.abs(((x - y) % (2 * Math.PI) + 3 * Math.PI) % (2 * Math.PI) - Math.PI); return d; };
  const arcBad = wd.filter((v) => ang(v, wa) + ang(v, wb) > ang(wa, wb) + 1e-3).length;
  check(`4: gió 350° → 10°: cung giữa hai hướng ${(ang(wa, wb) * 180 / Math.PI).toFixed(1)}° = 20°, ${arcBad} khung ra ngoài cung ngắn`, near(ang(wa, wb) * 180 / Math.PI, 20, 0.01) && arcBad === 0);

  // Mục 5: hoàng hôn 16:30 → 18:30 ICT từng 5 phút: dayNight.target đơn điệu 0 → 1
  const sweep = [];
  for (let m = 16 * 60 + 30; m <= 18 * 60 + 30; m += 5) { await Lp.evaluate((at) => window.__app.env.setNow(() => at), ICT(Math.floor(m / 60), m % 60)); await frames(Lp, 1); sweep.push(await Lp.evaluate(() => [window.__app.dayNight.target, window.__app.live.sun.elev])); }
  const mono = sweep.every((v, i) => i === 0 || v[0] >= sweep[i - 1][0]);
  check(`5: hoàng hôn: đích 16:30 = ${f3(sweep[0][0])}, 18:30 = ${f3(sweep.at(-1)[0])}, đơn điệu tăng (${sweep.length} mốc)`, sweep[0][0] === 0 && sweep.at(-1)[0] === 1 && mono);
  const k17 = sweep.findIndex((v) => v[0] > 0 && v[0] < 1);
  note(`5: chuyển ngày → đêm bắt đầu ở mốc ${k17} (${16 * 60 + 30 + k17 * 5} phút), độ cao ${f3(sweep[k17]?.[1])}°`);

  // Mục 6: lỗi API giữa phiên: số liệu cũ giữ nguyên, đích không đổi, chỉ báo stale
  const before6 = await put(Lp, ICT(12, 0), W({ code: 61, rate: 2, rain: 0.5, cloud: 90 }));
  const after6 = await Lp.evaluate(() => { const a = window.__app; a.env.store.inject(a.env.store.data, true); return { ...a.weather.state.target }; });
  check('6: inject(dataCũ, true): state.target giữ nguyên', sameTarget(before6.target, after6));

  // Mục 7: tính năng cần đêm (A.1). Trưa Trực tiếp ⇒ chuyển Mô phỏng + thông báo + đêm 1; về Trực tiếp bằng nút của thông báo
  await put(Lp, ICT(12, 0), W());
  await tap(Lp, '[data-view="rfHearts"]'); await waitFlight(Lp);
  const s7 = await Lp.evaluate(() => ({ mode: window.__app.live.mode, t: window.__app.dayNight.target, notice: !document.getElementById('liveNotice').hidden }));
  check(`7: trưa Trực tiếp, góc rfHearts: sang Mô phỏng (${s7.mode}), thông báo hiện, đêm đích ${s7.t}`, s7.mode === 'manual' && s7.notice && s7.t === 1);
  await Lp.click('#btnNoticeLive'); await frames(Lp, 2);
  check('7: nút "Về Trực tiếp" của thông báo: về Trực tiếp, thông báo ẩn', await Lp.evaluate(() => window.__app.live.mode === 'live' && document.getElementById('liveNotice').hidden));
  // Chạng vạng đã tối (đích > 0,5 nhưng < 1): ở lại Trực tiếp, không ghi đêm, không thông báo
  await put(Lp, ICT(17, 22), W());
  const tw = await Lp.evaluate(() => window.__app.dayNight.target);
  for (const v of ['rfHearts', 'swNight']) {
    if (v === 'swNight') await pickView(Lp, 'sw', v); else { await tap(Lp, `[data-view="${v}"]`); await waitFlight(Lp); }   // góc Vòng quay chỉ hiện khi chọn công trình đó
    const s = await Lp.evaluate(() => ({ mode: window.__app.live.mode, t: window.__app.dayNight.target, notice: !document.getElementById('liveNotice').hidden }));
    check(`7: chạng vạng (đích ${f3(tw)} ≥ 0,5), góc ${v}: ở lại Trực tiếp, đích ${f3(s.t)} không bị ghi 1, không thông báo`, tw > 0.5 && tw < 1 && s.mode === 'live' && near(s.t, tw, 1e-3) && !s.notice);
  }
  await tap(Lp, 'button[data-bridge="dragon"]'); await waitFlight(Lp);   // nút Trình diễn chỉ hiện ở Cầu Rồng
  await tap(Lp, '#btnShow');
  const s7s = await Lp.evaluate(() => ({ mode: window.__app.live.mode, t: window.__app.dayNight.target, on: document.getElementById('btnShow').getAttribute('aria-pressed') }));
  check(`7: chạng vạng, bật Trình diễn: bật (${s7s.on}), ở lại Trực tiếp, đích ${f3(s7s.t)} không đổi`, s7s.on === 'true' && s7s.mode === 'live' && near(s7s.t, tw, 1e-3));
  await tap(Lp, '#btnShow');   // tắt lại

  // Mục 8: chuyển Mô phỏng (nút trong Cài đặt): điều khiển mở, chọn bão; làm mới API 3 lần không đổi cảnh (Review Focus 4)
  await put(Lp, ICT(12, 0), W({ code: 61, rate: 2, rain: 0.5, cloud: 90 }));
  const liveT = (await snap(Lp)).target;
  await tap(Lp, '#btnToManual'); await frames(Lp, 2);
  const lock8 = await Lp.evaluate((ids) => ids.map((id) => document.getElementById(id).disabled), LOCKED);
  const s8 = await snap(Lp);
  check(`8: Mô phỏng: điều khiển hết disabled (${lock8.join(' ')}), #env[data-mode=manual], weather.live false, tauScale 1, sun null`, lock8.every((d) => !d) && s8.envMode === 'manual' && !s8.wlive && s8.tauScale === 1 && s8.sun === null);
  await Lp.evaluate(() => window.__app.ui.reveal(document.getElementById('weatherSel')));
  await Lp.selectOption('#weatherSel', 'storm'); await frames(Lp, 2);
  await Lp.evaluate(() => { document.getElementById('timeSlider').value = '30'; document.getElementById('timeSlider').dispatchEvent(new Event('input', { bubbles: true })); });
  const m0 = await snap(Lp);
  for (const [i, wx] of [W({ code: 0, cloud: 0 }), W({ code: 45, vis: 200 }), W({ code: 95, rate: 40, rain: 10 })].entries()) {
    await put(Lp, ICT(0, 0, 16) + i * 900000, wx, { tua: false });   // nửa đêm: nếu bộ điều khiển còn ghi thì đêm đích thành 1
  }
  const m1 = await snap(Lp);
  check(`8: Mô phỏng + 3 lần làm mới: preset ${m1.preset} = storm, đích thời tiết không đổi (mưa ${f3(m1.target.rain)}), đêm đích ${m1.nightT} = 0,3`, m1.preset === 'storm' && sameTarget(m0.target, m1.target) && near(m1.nightT, 0.3) && m1.mode === 'manual');
  // Kịch bản bão cũ chạy được ở Mô phỏng; làm mới API khi kịch bản đang chạy không ghi gì (so ngay trong cùng một lượt, kịch bản chỉ đổi đích ở khung)
  await tap(Lp, '#btnWxStorm'); await frames(Lp, 5);
  const sc = await Lp.evaluate(() => { const a = window.__app, b = { ...a.weather.state.target }; a.env.store.inject({ ...a.env.store.data, code: 0, rate: 0, rain: 0, cloud: 0 }); return { running: a.weather.scenario.running, same: JSON.stringify(b) === JSON.stringify(a.weather.state.target), live: a.weather.live }; });
  check(`8: kịch bản bão chạy ở Mô phỏng (${sc.running}); làm mới API lúc đó không đổi đích, weather.live ${sc.live}`, sc.running && sc.same && !sc.live);
  // Cây đổ rồi về Trực tiếp: dừng kịch bản, dựng cây, đích theo số liệu, đêm theo giờ
  await Lp.evaluate(() => window.__app.weather.fallen.fell()); await frames(Lp, 2);
  const down0 = await Lp.evaluate(() => window.__app.weather.fallen.state().down);
  await put(Lp, ICT(12, 0), W({ code: 61, rate: 2, rain: 0.5, cloud: 90 }), { tua: false });
  await tap(Lp, '#btnToLive'); await frames(Lp, 3);
  const s8b = await snap(Lp);
  const fb = await Lp.evaluate(() => ({ down: window.__app.weather.fallen.state().down, running: window.__app.weather.scenario.running }));
  check(`8: về Trực tiếp: kịch bản dừng, cây dựng lại (đổ ${down0} → ${fb.down}), đích khớp số liệu (mưa ${f3(s8b.target.rain)} = ${f3(liveT.rain)}), đêm đích 0, preset mô phỏng giữ (${s8b.preset})`,
    !fb.running && fb.down === 0 && sameTarget(s8b.target, liveT) && s8b.nightT === 0 && s8b.preset === 'storm' && s8b.mode === 'live');
  const lock8b = await Lp.evaluate((ids) => ids.map((id) => document.getElementById(id).disabled), LOCKED);
  check('8: Trực tiếp: nút Kịch bản bão (và các điều khiển mô phỏng) disabled lại', lock8b.every(Boolean));
  if (down0 === 0) note('8: fell() không đổ cây nào ở góc này, kiểm "dựng lại" không có ý nghĩa');
  // Về Mô phỏng lần nữa: trả đúng trạng thái mô phỏng đã nhớ (bão, đêm 0,3)
  await tap(Lp, '#btnToManual'); await frames(Lp, 2);
  const s8c = await snap(Lp);
  const ui8 = await Lp.evaluate(() => ({ sel: document.getElementById('weatherSel').value, slider: document.getElementById('timeSlider').value }));
  check(`8: lại Mô phỏng: preset ${s8c.preset}, đêm đích ${s8c.nightT}, ô chọn "${ui8.sel}", thanh ${ui8.slider}`, s8c.preset === 'storm' && near(s8c.nightT, 0.3) && ui8.sel === 'storm' && ui8.slider === '30');
  await Lp.evaluate(() => window.__app.ui.reveal(document.getElementById('weatherSel')));
  await Lp.selectOption('#weatherSel', 'now');
  await Lp.evaluate(() => { const s = document.getElementById('timeSlider'); s.value = '0'; s.dispatchEvent(new Event('input', { bubbles: true })); });
  await tap(Lp, '#btnToLive'); await frames(Lp, 2);

  // Mục 9: bậc chất lượng Thấp + mưa to: số vệt theo adaptiveSteps (bậc mưa ép 2 = 0,35; ?test không tự hạ)
  await Lp.evaluate(() => { window.__app.quality.set('low'); window.__app.weather.rain.step = 2; });
  const q9 = await put(Lp, ICT(14, 0), W({ code: 65, rate: 30, rain: 7.5, cloud: 100 }));
  const n9 = await Lp.evaluate(() => window.__app.weather.rain.n ?? 6000);
  const want9 = Math.round(n9 * q9.current.rain * 0.35);
  check(`9: bậc Thấp + mưa to: ${q9.rainCount} vệt = round(${n9} × ${f3(q9.current.rain)} × 0,35) = ${want9}`, q9.rainCount === want9 && q9.rainVis);
  await Lp.evaluate(() => { window.__app.quality.set('high'); window.__app.weather.rain.step = 0; });
  await frames(Lp, 3);

  // Mục 10: không gọi mạng, không ghi bộ nhớ đệm
  check(`10: ?test&envmode=live: ${L.om.n} yêu cầu tới Open-Meteo`, L.om.n === 0);

  /* ===================== Mục 15: hai trang cùng số liệu + cùng giờ ⇒ cùng tham số (trang thứ hai: E glider bên dưới) ===================== */
  const SAME = { at: ICT(16, 50), wx: W({ code: 63, rate: 3.3, rain: 0.83, cloud: 85, hum: 91, vis: 7000, wind: 22, gust: 41, dir: 120, temp: 26.4 }) };
  const one = await put(Lp, SAME.at, { ...SAME.wx }, { tua: false });
  allErrors.push(...L.errors.map((e) => 'L: ' + e));
  const lsL = await Lp.evaluate((k) => localStorage.getItem(k), STORE_KEY);
  check(`16: trang L: localStorage['${STORE_KEY}'] không bị ghi bởi inject (${lsL === store0 ? 'giữ nguyên' : 'ĐÃ ĐỔI'})`, lsL === store0);
  await Lp.close();

  /* ===================== Trang T (?test) và M (?test&envmode=manual): mặc định, lệnh vẽ ===================== */
  const calls = async (page) => { const xs = []; for (let i = 0; i < 7; i++) { await frames(page, 1); xs.push(await page.evaluate(() => window.__app.renderer.info.render.calls)); } xs.sort((a, b) => a - b); return xs[3]; };
  const T = await open(srv.url);
  await frames(T.page, 10);
  const sT = await snap(T.page);
  check(`13: ?test không envmode: mode ${sT.mode}, preset ${sT.preset}, đêm đích ${sT.nightT}, weather.live ${sT.wlive}, sun ${sT.sun}`, sT.mode === 'manual' && sT.preset === 'now' && sT.nightT === 0 && !sT.wlive && sT.sun === null);
  check('13: ?test: điều khiển mô phỏng không disabled', (await T.page.evaluate((ids) => ids.map((id) => document.getElementById(id).disabled), LOCKED)).every((d) => !d));
  const cT = await calls(T.page);
  allErrors.push(...T.errors.map((e) => 'T: ' + e)); await T.page.close();
  const M = await open(srv.url + '?envmode=manual');
  await frames(M.page, 10);
  const cM = await calls(M.page);
  check(`13: lệnh vẽ góc mặc định ?test ${cT} = ?test&envmode=manual ${cM}`, cT === cM);
  allErrors.push(...M.errors.map((e) => 'M: ' + e)); await M.page.close();

  /* ===================== Trang E: bốn chế độ khám phá ở Trực tiếp có mưa ===================== */
  for (const mode of ['glider', 'stroll', 'drive', 'bike']) {
    const E = await open(srv.url + '?envmode=live&explore=' + mode);
    const Ep = E.page;
    await frames(Ep, 5);
    const two = await put(Ep, SAME.at, { ...SAME.wx }, { tua: false });
    if (mode === 'glider') {
      const diff = Object.keys(one.target).filter((k) => one.target[k] !== two.target[k]);
      check(`15: hai trang cùng inject + setNow: state.target bằng nhau từng trường${diff.length ? ' (khác: ' + diff.join(' ') + ')' : ''}, dayNight.target ${f3(one.nightT)} = ${f3(two.nightT)}`, diff.length === 0 && one.nightT === two.nightT);
    }
    await put(Ep, ICT(14, 0), W({ code: 65, rate: 12, rain: 3, cloud: 100 }));
    await frames(Ep, 20);
    const ex = await Ep.evaluate(() => { const e = document.getElementById('envMode'); return { mode: window.__app.live.mode, badge: !e.hidden && e.checkVisibility() ? e.textContent.trim() : '', rain: window.__app.weather.rain.mesh.visible }; });
    check(`14: ?explore=${mode} + Trực tiếp + mưa: mode ${ex.mode}, chỉ báo chữ chế độ "${ex.badge}", không lỗi console (${E.errors.length})`, ex.mode === 'live' && !!ex.badge && E.errors.length === 0);
    if (!ex.rain) note(`14: ${mode}: lưới mưa không hiện (camera trong hầm / dưới nước?)`);
    allErrors.push(...E.errors.map((e) => mode + ': ' + e));
    await Ep.close();
  }

  check('16: console sạch ở mọi trang', allErrors.length === 0);
  if (allErrors.length) console.log(allErrors.join('\n'));
  console.log(`thời gian ${((Date.now() - t0) / 1000).toFixed(0)} s`);
} finally {
  await browser.close();
  srv.close();
}
console.log(problems.length ? `live-check: LỖI (${problems.length}): ${problems.join('; ')}` : 'live-check: đạt');
process.exit(problems.length ? 1 : 0);

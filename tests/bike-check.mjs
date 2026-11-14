// Kiểm tra chế độ lái xe máy trong trình duyệt (docs/superpowers/plans/2026-11-14-xe-may.md, Task 11; spec D-040 §13 + §17).
//   Đọc dist/ (npm run build trước). Mọi bước mô phỏng nhiều bước chạy trong MỘT lần evaluate bằng `__app.bike.step(dt, input)` (không có khung hình xen vào:
//   khung thật chạy bike.update, đọc phím, đổi đèn). `placeAt` tạo trạng thái MỚI: luôn đọc lại `__app.bike.state` sau mỗi lần đặt.
//   Trang A `?explore=bike` (640 × 360):
//   Mục 1: vào bằng ?explore=bike: body explore + drive + bike, cam.mode 'bike', xe đứng yên trên mặt đường (|y − mặt đường| ≤ 2 cm), hướng Đông.
//   Mục 2: lái theo kịch bản 300 m từ đầu mỗi công trình (Cầu Rồng, Cầu sông Hàn, Trần Thị Lý, Thuận Phước, hai ống hầm): mỗi 0,5 s mô phỏng mặt đường
//          tại tâm hữu hạn, |y − mặt đường| ≤ 5 cm, 9 điểm mẫu thân xe có mặt đường, tâm + góc không trong hộp bao nhà (oracle độc lập: ma trận instance của cảnh),
//          điểm chạm hai bánh của mô hình thật cách mặt đường ≤ 2 cm (cả trên dốc cầu / dốc hầm).
//   Mục 3: đâm 90 km/h vào lan can Cầu Rồng, tường hầm: dừng phía trong mép ô đường, không xuyên.
//   Mục 4: Cầu sông Hàn: cầu rời CLOSED (tốc độ quay 30×), xe trên nhịp quay được sơ tán ra ngoài barie trong ≤ 1 s mô phỏng; lái vào barie bị chặn.
//   Mục 5: đổi góc nhìn: setView(3) / phím V / nút #bkView, sau mixS fov / near đúng góc (thứ ba 62° / 0,5; thứ nhất 75° / 0,55). Phần "trả fov / near sau stop()" ở trang F.
//   Mục 6: người lái: rider.debug() hai tay – tay nắm ≤ 2 cm khi bẻ lái hết cỡ hai bên (cổ lái ±0,52) và khi thẳng; chân ≤ 3 cm.
//          Cảnh báo (không chấm): góc thứ nhất bẻ hết lái trái thì tay trái bị mặt cắt gần cắt (vấn đề đã biết, near 0,55).
//   Mục 7: đèn (đọc uniform uOn của vật liệu + uNight): ngày đèn pha sáng (headDay), đèn hậu tắt; đêm đèn pha / hậu sáng; phanh đèn hậu = tailBrake;
//          xi nhan trái sáng ở nửa chu kỳ đầu, tắt ở nửa sau, đèn HUD #bkSigL bật.
//   Mục 8: mưa: grip theo mặt ướt (khô 1, ướt hẳn 0, đoạn hầm kín 1), quãng phanh ướt dài hơn khô ≥ 20 %, bụi nước hiện khi chạy mưa và hết khi tạnh,
//          vệt đèn pha chỉ ban đêm.
//   Mục 10: HUD: km/h khớp |v| · 3,6; 9 ngôn ngữ đổi #bkHint, #bkStuck, nhãn aria nút ◄ ► 🎥 📢 ↺; ar: html rtl, #drHud ltr.
//   Trang B `?chooser`: Mục 1b: bấm thẻ Xe máy (data-pick="bike") vào được.
//   Trang C, D: Mục 9: chặn **/bike/scooter.glb: hình tạm, lái được, không lỗi console; làm chậm 12 s: hình tạm rồi đổi sang mô hình thật, không nhảy vị trí.
//          Âm thanh là máy tổng hợp (spec §17.11), không có tệp âm thanh để chặn.
//   Trang F `?test` thường (bọc addEventListener trước khi nạp trang để đếm bộ nghe):
//   Mục 11: lệnh vẽ góc mặc định trước khi vào chế độ (so mốc overview của tests/KET-QUA.md); khi lái ban ngày ở Cầu Rồng x = −150 (góc thứ nhất / thứ ba)
//          ≤ số đo Task 7; program trước / sau khi vào chế độ (ghi).
//   Mục 5b: fov / near của camera trả lại đúng như trước sau bike.stop().
//   Mục 12: stop() / start() × 3: số bộ nghe sự kiện, bkSound.nodes(), số lưới trong cảnh không tăng.
//   Mục 13: sau bike.stop(): drive.start() lái được, va chạm cỡ ô tô (đâm lan can, góc xe cỡ VF 3 không lấn); stroll.start() vào được; explore.start() (dù lượn) vào được.
//   Mục 14: console không có lỗi ở mọi trang.
//   Mục 15 (tùy chọn, `-- --multi`): hai trang xe máy cùng phòng qua `wrangler dev` cục bộ (cổng 8799, KHÔNG dùng Worker thật): thấy nhau là xe máy thật + nhân vật đã chọn (A nam, B nữ), dấu nghiêng khớp.
//
//   Mỗi mục bọc try / catch riêng, có giới hạn thời gian từng mục và tổng; luôn đóng trình duyệt ở finally.
//   npm run build && npm run test:bike [-- --no-shots] [-- --multi]
import { fileURLToPath } from 'node:url';
import { readFileSync, mkdirSync } from 'node:fs';
import { serveDir, launch, openApp, frames, pick, pickView } from './lib.mjs';

const SHOTS = !process.argv.includes('--no-shots');
const MULTI = process.argv.includes('--multi');
const SCREENS = fileURLToPath(new URL('./screens/', import.meta.url));
const T0 = Date.now(), TOTAL_MS = 120 * 60 * 1000;
const problems = [];
const sections = [];   // [tên mục, số kiểm, số lỗi]
let cur = null;
const check = (name, ok) => { if (cur) { cur[1]++; if (!ok) cur[2]++; } if (!ok) problems.push(name); console.log(`${ok ? 'đạt ' : 'LỖI '} ${name}`); return ok; };
const info = (msg) => console.log(`ghi  ${msg}`);
const warn = (msg) => console.log(`CẢNH BÁO ${msg}`);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const rd = (rel) => readFileSync(new URL(rel, import.meta.url), 'utf8');

/* Thông số lấy từ src/config.ts (đọc chữ, không import TS) */
const cfgSrc = rd('../src/config.ts');
const drv = cfgSrc.slice(cfgSrc.indexOf('const driveBase')), bk = cfgSrc.slice(cfgSrc.indexOf('const bikeBase'));
const num = (re, from) => { const m = from.match(re); if (!m) throw new Error('không đọc được thông số: ' + re); return Number(m[1]); };
const K = {
  bike: { length: num(/length:\s*([\d.]+)/, bk), width: num(/width:\s*([\d.]+)/, bk), height: num(/height:\s*([\d.]+)/, bk), wheelbase: num(/wheelbase:\s*([\d.]+)/, bk), wheelR: num(/wheelDia:\s*([\d.]+)/, bk) / 2 },
  car: { length: num(/length:\s*([\d.]+)/, drv), width: num(/width:\s*([\d.]+)/, drv), height: num(/height:\s*([\d.]+)/, drv) },
  stepMax: num(/stepMax:\s*([\d.]+)/, drv), axisX0: num(/axisX0:\s*(-?\d+)/, drv), axisX1: num(/axisX1:\s*(-?\d+)/, drv), tpX0: num(/tpX0:\s*(-?\d+)/, drv),
  spawnX: num(/spawn:\s*\{\s*x:\s*(-?[\d.]+)/, drv), spawnLane: num(/spawn:\s*\{[^}]*lane:\s*([\d.]+)/, drv)
};
/* Mốc lệnh vẽ khi lái (Task 7, 2026-11-14, dev 960 × 540, Cầu Rồng x = −150, ngày khô): thứ ba 239, thứ nhất 241. Ngưỡng của mục 11 ở dưới */
const TASK7 = { third: 239, first: 241 };
const LANGS = ['vi', 'en', 'ko', 'ja', 'zh', 'th', 'ar', 'hi', 'ru'];
const LOC = Object.fromEntries(LANGS.map((c) => [c, JSON.parse(rd(`../src/i18n/locales/${c}.json`))]));

/* Chạy một mục: lỗi hoặc quá giờ thì in LỖI rồi đi tiếp; ghi số kiểm / lỗi của mục cho dòng tổng kết */
async function section(name, fn, ms = 20 * 60 * 1000) {
  cur = [name, 0, 0]; sections.push(cur);
  const t = Date.now();
  if (Date.now() - T0 > TOTAL_MS) { check(`${name}: bỏ qua vì hết giờ tổng ${TOTAL_MS / 60000} phút`, false); cur = null; return; }
  let timer;
  try {
    await Promise.race([fn(), new Promise((_, rej) => { timer = setTimeout(() => rej(new Error(`quá giờ mục ${ms / 60000} phút`)), ms); })]);
  } catch (e) { check(`${name}: ngoại lệ ${String(e && e.message || e).split('\n')[0]}`, false); }
  finally { clearTimeout(timer); }
  console.log(`== mục ${name}: ${cur[2] ? 'LỖI' : 'ĐẠT'} (${cur[1] - cur[2]}/${cur[1]} kiểm, ${((Date.now() - t) / 60000).toFixed(1)} phút)`);
  cur = null;
}

/* ======================= Chạy trong trang: bộ công cụ lái theo kịch bản (xe máy hoặc ô tô) ======================= */
function installHelpers(K) {
  const a = window.__app, T = a.THREE;
  const veh = () => (window.__veh === 'drive' ? a.drive : a.bike);
  const dims = () => (window.__veh === 'drive' ? K.car : K.bike);
  const inp0 = () => (window.__veh === 'drive' ? { gas: 0, brake: 0, steer: 0, hand: false } : { gas: 0, brake: 0, steer: 0, hard: false, grip: 1 });
  const net = () => veh().net;
  const pad = (id) => net().pads.find((p) => p.id === id) || null;
  /* mặt đường tại (x, z) ở tầng gần yRef nhất trong ± stepMax; NaN nếu không có (cổng đang đóng thì bỏ ô) */
  const ground = (x, z, yRef) => {
    const n = net();
    let best = NaN, bd = Infinity;
    for (const p of n.pads) {
      if (x < p.x0 || x > p.x1 || z < p.z0 || z > p.z1) continue;
      if (p.gate !== undefined && n.closed.has(p.gate)) continue;
      const y = p.y(x, z), d = Math.abs(y - yRef);
      if (d <= K.stepMax && d < bd) { bd = d; best = y; }
    }
    return best;
  };
  const pts = (s, n) => {   // điểm mẫu thân xe: n = 9 (lưới 3 × 3) hoặc 5 (tâm + bốn góc)
    const D = dims(), HL = D.length / 2, HW = D.width / 2;
    const c = Math.cos(s.yaw), sn = Math.sin(s.yaw), out = [];
    for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) {
      if (n === 5 && !((i === 0 && j === 0) || (i !== 0 && j !== 0))) continue;
      const lf = i * HL, ln = j * HW;
      out.push([s.x + lf * c + ln * sn, s.z - lf * sn + ln * c]);
    }
    return out;
  };
  /* hộp bao nhà: level gần của THREE.LOD + nhà Thuận Phước, từ ma trận instance và hình học thật của cảnh */
  let boxes = null;
  const buildBoxes = () => {
    const out = [], mi = new T.Matrix4(), mw = new T.Matrix4(), bb = new T.Box3();
    a.scene.updateMatrixWorld(true);
    a.scene.traverse((o) => {
      if (!o.isInstancedMesh) return;
      const near = o.parent && o.parent.isLOD && o.parent.levels[0] && o.parent.levels[0].object === o;
      if (!near && o.name !== 'tp-houses') return;
      if (!o.geometry.boundingBox) o.geometry.computeBoundingBox();
      for (let i = 0; i < o.count; i++) {
        o.getMatrixAt(i, mi);
        const e = mi.elements; if (Math.hypot(e[0], e[1], e[2]) < 1e-6) continue;
        mw.multiplyMatrices(o.matrixWorld, mi);
        bb.copy(o.geometry.boundingBox).applyMatrix4(mw);
        out.push(bb.min.x, bb.max.x, bb.min.z, bb.max.z, bb.min.y, bb.max.y);
      }
    });
    boxes = new Float64Array(out);
    return boxes.length / 6;
  };
  const inBuilding = (s) => {
    const P = pts(s, 5), top = s.y + dims().height;
    for (let b = 0; b < boxes.length; b += 6) {
      if (!(top > boxes[b + 4] + 0.3 && s.y < boxes[b + 5] - 0.3)) continue;
      for (const [x, z] of P) if (x > boxes[b] + 0.05 && x < boxes[b + 1] - 0.05 && z > boxes[b + 2] + 0.05 && z < boxes[b + 3] - 0.05) return b / 6;
    }
    return -1;
  };
  /* Điểm chạm hai bánh của mô hình thật: tâm bánh (nút wheel_f / wheel_r) trừ bán kính theo trục "lên" của thân đã nghiêng; khoảng cách tới mặt đường tại đó.
     Không có mô hình thật thì null */
  const X = new T.Vector3(1, 0, 0), up = new T.Vector3(), c = new T.Vector3();
  const wheelGap = (s) => {
    const m = a.bike.model; if (!m || !m.real) return null;
    const g = m.group; g.updateWorldMatrix(true, true);
    up.set(0, 1, 0).applyAxisAngle(X, -s.lean).applyQuaternion(g.quaternion);
    const out = [];
    for (const n of ['wheel_f', 'wheel_r']) {
      const w = g.getObjectByName(n); if (!w) return null;
      c.setFromMatrixPosition(w.matrixWorld).addScaledVector(up, -K.bike.wheelR);
      const gy = ground(c.x, c.z, c.y);
      out.push(Number.isNaN(gy) ? NaN : c.y - gy);
    }
    return out;
  };
  const hidden = [];
  const hideTraffic = () => { let n = 0; for (const f of a.traffic.fleets()) { const m = f.mesh; if (m && m.visible) { m.visible = false; hidden.push(m); n++; } } return n; };
  const showTraffic = () => { for (const m of hidden.splice(0)) m.visible = true; };

  /* lái thẳng dist m: đặt xe ở (x, z, yaw), ga hết tới vWant, kiểm mỗi 0,5 s mô phỏng */
  const run = (o) => {
    const V = veh();
    V.placeAt(o.x, o.z, o.yaw);
    const s = V.state, inp = inp0(), dirx = Math.cos(o.yaw);
    const res = { tag: o.tag, steps: 0, t: 0, nViol: 0, viol: [], reached: false, vmax: 0, stuck: null, checks: 0, wheels: 0, wheelMax: 0, slopeMax: 0, x: s.x };
    const note = (k, msg) => { res.nViol++; if (res.viol.length < 6) res.viol.push(`${k}: ${msg}`); };
    let still = 0;
    for (let i = 0; i < Math.ceil(o.maxT / 0.1); i++) {
      inp.gas = s.v < (o.vWant || 100) ? 1 : 0;
      V.step(0.1, inp);
      res.steps++; res.t += 0.1; if (s.v > res.vmax) res.vmax = s.v;
      const prog = (s.x - o.x) * dirx;
      if (res.steps % 5 === 0) {
        res.checks++;
        const g = ground(s.x, s.z, s.y);
        if (!Number.isFinite(g)) note('không có mặt đường tại tâm', `(${s.x.toFixed(1)}, ${s.z.toFixed(1)}) y ${s.y.toFixed(2)}`);
        else if (Math.abs(g - s.y) > 0.05) note('y lệch mặt đường', `${s.y.toFixed(3)} so ${g.toFixed(3)} tại x ${s.x.toFixed(1)}`);
        const bad = pts(s, 9).filter(([x, z]) => Number.isNaN(ground(x, z, s.y))).length;
        if (bad) note('thân xe thiếu mặt đường', `${bad}/9 điểm tại (${s.x.toFixed(1)}, ${s.z.toFixed(1)})`);
        if (boxes) { const b = inBuilding(s); if (b >= 0) note('xe nằm trong nhà', `nhà #${b} tại (${s.x.toFixed(1)}, ${s.z.toFixed(1)})`); }
        if (o.wheels) {
          const wg = wheelGap(s);
          if (!wg) note('không có mô hình thật để đo bánh', '');
          else {
            res.wheels++;
            for (const d of wg) {
              if (!Number.isFinite(d)) note('điểm chạm bánh không có mặt đường', `x ${s.x.toFixed(1)}`);
              else { if (Math.abs(d) > res.wheelMax) res.wheelMax = Math.abs(d); if (Math.abs(d) > 0.02) note('bánh cách mặt đường > 2 cm', `${(d * 100).toFixed(1)} cm tại x ${s.x.toFixed(1)}, dốc ${(s.pitch * 180 / Math.PI).toFixed(1)}°`); }
            }
          }
        }
        if (Math.abs(s.pitch) > res.slopeMax) res.slopeMax = Math.abs(s.pitch);
      }
      if (prog >= o.dist) { res.reached = true; break; }
      still = res.t > 6 && Math.abs(s.v) < 0.3 ? still + 1 : 0;
      if (still > 30) { res.stuck = [+s.x.toFixed(1), +s.z.toFixed(1)]; break; }
    }
    res.x = +s.x.toFixed(1); res.v = +s.v.toFixed(2);
    return res;
  };

  /* đâm thẳng ở v0: o.pad (id ô), o.side ('z0' | 'z1' | 'x0' | 'x1'): độ lấn lớn nhất của tâm + bốn góc ra ngoài cạnh đó, số bước thân xe thiếu mặt đường */
  const crash = (o) => {
    const p = pad(o.pad); if (!p) return { err: 'không có ô ' + o.pad };
    const V = veh();
    V.placeAt(o.x, o.z, o.yaw);
    const s = V.state, inp = inp0(); inp.gas = 1;
    s.v = o.v0;
    let worst = -Infinity, invalid = 0, nanLean = 0;
    for (let i = 0; i < Math.ceil(o.T / 0.1); i++) {
      V.step(0.1, inp);
      for (const [x, z] of pts(s, 5)) {
        const over = o.side === 'z1' ? z - p.z1 : o.side === 'z0' ? p.z0 - z : o.side === 'x1' ? x - p.x1 : p.x0 - x;
        if (over > worst) worst = over;
      }
      if (pts(s, 9).some(([x, z]) => Number.isNaN(ground(x, z, s.y)))) invalid++;
      if (s.lean !== undefined && !Number.isFinite(s.lean)) nanLean++;
    }
    return { v: +s.v.toFixed(2), worst: +worst.toFixed(3), invalid, nanLean, x: +s.x.toFixed(2), z: +s.z.toFixed(2), pad: [p.x0, p.x1, p.z0, p.z1] };
  };

  window.__bk = { pad, ground, pts, buildBoxes, hideTraffic, showTraffic, run, crash, wheelGap, rect: (id) => { const p = pad(id); return p ? [p.x0, p.x1, p.z0, p.z1] : null; } };
}

/* Vật liệu đèn của xe máy của mình: hệ số phát sáng hiệu dụng = max(clamp(uNight) · night, uOn) như bkLampPatch (model.ts) */
const lampsFn = () => {
  const A = window.__app, m = A.bike.model, M = A.bike.cfg.model, u = Math.min(1, Math.max(0, A.shared.uNight.value)), out = {};
  if (!m) return out;
  const night = { lamp_head: M.headNight, lamp_tail: M.tailNight, lamp_sig_l: 0, lamp_sig_r: 0 };
  m.group.traverse((o) => {
    if (!o.isMesh || !o.material || !(o.material.name in night)) return;
    const k = o.material.name, on = o.material.userData.lampOn;
    (out[k] = out[k] || []).push(+Math.max(u * night[k], on === undefined ? NaN : on).toFixed(3));
  });
  return out;
};

/* ===================================== chạy ===================================== */
const srv = await serveDir(fileURLToPath(new URL('../dist/', import.meta.url)));
const browser = await launch();
const allErrors = [];   // [trang, lỗi console]
const rec = {};         // số đo cho báo cáo
try {
  if (SHOTS) mkdirSync(SCREENS, { recursive: true });
  let A = null;

  /* ---------------- Trang A: ?explore=bike ---------------- */
  await section('mở trang A', async () => {
    A = await openApp(browser, srv.url + '?explore=bike', { width: 640, height: 360 });
    A.page.setDefaultTimeout(300000);
  }, 15 * 60 * 1000);

  if (A) {
    const P = A.page;
    const shot = async (name) => { if (SHOTS) await P.screenshot({ path: `${SCREENS}bike-check-${name}.png` }); };
    const night = (v) => P.evaluate((v) => { const A = window.__app; A.dayNight.target = v; A.dayNight.night = v; }, v);

    await section('1 (?explore=bike)', async () => {
      await P.waitForFunction(() => window.__app.bike.active() && window.__app.cam.mode === 'bike', null, { polling: 500 });
      await P.evaluate(installHelpers, K);
      const r = await P.evaluate(() => {
        const A = window.__app, s = A.bike.state, cl = document.body.classList;
        return { cls: cl.contains('explore') && cl.contains('drive') && cl.contains('bike'), mode: A.cam.mode, x: s.x, z: s.z, y: s.y, yaw: s.yaw, v: s.v, g: window.__bk.ground(s.x, s.z, s.y), drive: A.drive.active() };
      });
      check(`1 ?explore=bike: body explore + drive + bike ${r.cls}, cam.mode '${r.mode}' = bike, ô tô không chạy (${r.drive})`, r.cls && r.mode === 'bike' && !r.drive);
      check(`1 xuất phát (${r.x}, ${r.z}) = chỗ lái một mình (${K.spawnX}, ${K.spawnLane}), hướng Đông (yaw ${r.yaw}), đứng yên (v ${r.v}), trên mặt đường: y ${r.y.toFixed(3)} so ${Number(r.g).toFixed(3)} (≤ 2 cm)`,
        Math.abs(r.x - K.spawnX) < 1e-6 && Math.abs(r.z - K.spawnLane) < 1e-6 && r.yaw === 0 && r.v === 0 && Number.isFinite(r.g) && Math.abs(r.y - r.g) <= 0.02);
      // mô hình thật + người lái cần cho mục 2 (bánh), 6, 7
      await P.waitForFunction(() => { const b = window.__app.bike; return b.model && b.model.real && b.rider; }, null, { polling: 2000, timeout: 300000 });
      check('1 mô hình thật scooter.glb và người lái có xương đã vào xe', true);
      await frames(P, 2);
      await shot('spawn');
    });

    await section('2 (lái kịch bản qua 4 cầu + 2 ống hầm)', async () => {
      const nBox = await P.evaluate(() => window.__bk.buildBoxes());
      const nHid = await P.evaluate(() => window.__bk.hideTraffic());
      check(`2 oracle nhà: ${nBox} hộp bao nhà, đã ẩn ${nHid} đội xe tự động`, nBox > 1000 && nHid >= 1);
      // đầu mỗi công trình: chân dốc lên cầu / đường dẫn xuống hầm (|x| ≈ 760 > approachHalf 697,5 của dốc hở), chạy 300 m qua dốc
      const RUNS = [['Cầu Rồng', 'dragon.bridge.S', 0, -480], ['Cầu sông Hàn', 'songHan.swing.S', 0, -480], ['Trần Thị Lý', 'ttl.bridge.S', 0, -480],
        ['Thuận Phước', 'thuanPhuoc.bridge.S', 0, -1100], ['hầm ống Nam (đi Đông)', 'tunnel.tube.S', 0, -760], ['hầm ống Bắc (đi Tây)', 'tunnel.tube.N', Math.PI, 760]];
      for (const [label, padId, yaw, start] of RUNS) {
        const rect = await P.evaluate((p) => window.__bk.rect(p), padId);
        if (!rect) { check(`2 ${label}: không có ô ${padId}`, false); continue; }
        const zc = (rect[2] + rect[3]) / 2;
        const r = await P.evaluate((o) => window.__bk.run(o), { tag: label, x: start, z: zc, yaw, dist: 300, maxT: 60, vWant: 100, wheels: true });
        rec['2 ' + label] = { wheelMaxCm: +(r.wheelMax * 100).toFixed(2), slopeDeg: +(r.slopeMax * 180 / Math.PI).toFixed(2) };
        check(`2 ${label} (x ${start} → 300 m, z ${zc.toFixed(2)}): tới ${r.reached} (x ${r.x}, ${r.t.toFixed(0)} s, vmax ${(r.vmax * 3.6).toFixed(0)} km/h), ${r.checks} lần kiểm, ${r.wheels} lần đo bánh (lệch lớn nhất ${(r.wheelMax * 100).toFixed(2)} cm, dốc lớn nhất ${(r.slopeMax * 180 / Math.PI).toFixed(1)}°), vi phạm ${r.nViol}${r.stuck ? ', kẹt tại ' + r.stuck : ''}${r.viol.length ? ' | ' + r.viol.join(' | ') : ''}`,
          r.reached && r.nViol === 0 && r.checks >= 20 && r.wheels === r.checks);
      }
      await P.evaluate(() => window.__bk.showTraffic());
    }, 25 * 60 * 1000);

    await section('3 (đâm 90 km/h)', async () => {
      await P.evaluate(() => window.__bk.hideTraffic());
      const cases = [['lan can Cầu Rồng', { pad: 'dragon.bridge.S', side: 'z1', yaw: -Math.PI / 2, xc: 0 }], ['tường hầm', { pad: 'tunnel.tube.S', side: 'z1', yaw: -Math.PI / 2, xc: 0 }]];
      for (const [label, c] of cases) {
        const rect = await P.evaluate((p) => window.__bk.rect(p), c.pad);
        if (!rect) { check(`3 ${label}: không có ô ${c.pad}`, false); continue; }
        const zc = (rect[2] + rect[3]) / 2;
        const r = await P.evaluate((o) => window.__bk.crash(o), { pad: c.pad, side: c.side, x: c.xc, z: zc, yaw: c.yaw, v0: 25, T: 6 });
        check(`3 ${label}: lấn ra ngoài mép ô ${r.worst} m (≤ 0,01), v cuối ${r.v} m/s (< 0,5), ${r.invalid} bước thân thiếu mặt đường, độ nghiêng NaN ${r.nanLean}, dừng tại (${r.x}, ${r.z})`,
          !r.err && r.worst <= 0.01 && Math.abs(r.v) < 0.5 && r.invalid === 0 && r.nanLean === 0);
      }
      await P.evaluate(() => window.__bk.showTraffic());
    });

    await section('4 (Cầu sông Hàn: sơ tán và barie)', async () => {
      const rect = await P.evaluate(() => window.__bk.rect('songHan.swing.S'));
      if (!rect) { check('4 không có ô songHan.swing.S', false); return; }
      const zc = (rect[2] + rect[3]) / 2;
      const r = await P.evaluate(({ zc, rect }) => {
        const A = window.__app, B = A.bike, ctrl = A.songHan.ctrl, bk = window.__bk;
        bk.hideTraffic();
        const out = {};
        B.placeAt(0, zc, 0);
        let s = B.state;   // placeAt tạo trạng thái mới
        const keep = { state: ctrl.state, t: ctrl.t, speed: ctrl.speed };
        ctrl.state = 'STOP_TRAFFIC'; ctrl.t = 0; ctrl.speed = 30;   // cổng nhịp quay đóng, tốc độ quay 30×
        const inp = { gas: 0, brake: 0, steer: 0, hard: false, grip: 1 };
        let steps = 0, started = false;
        for (; steps < 100; steps++) {
          B.step(0.1, inp);
          if (s.evac > 0) started = true;
          if (started && s.evac === 0) { steps++; break; }
        }
        out.started = started; out.simT = +(steps * 0.1).toFixed(1);
        out.x = +s.x.toFixed(2); out.z = +s.z.toFixed(2); out.evac = s.evac; out.lean = s.lean;
        out.outside = bk.pts(s, 9).every(([x]) => x < rect[0] || x > rect[1]);
        out.fits = bk.pts(s, 9).every(([x, z]) => !Number.isNaN(bk.ground(x, z, s.y)));
        B.placeAt(rect[1] + 30, zc, Math.PI); s = B.state; s.v = 25;
        let minX = Infinity, bad = 0;
        const inp2 = { gas: 1, brake: 0, steer: 0, hard: false, grip: 1 };
        for (let i = 0; i < 60; i++) {
          B.step(0.1, inp2);
          for (const [x, z] of bk.pts(s, 5)) { if (x < minX) minX = x; if (x < rect[1] - 0.01 && z > rect[2] && z < rect[3]) bad++; }
        }
        out.barrier = { minX: +minX.toFixed(2), v: +s.v.toFixed(2), bad, edge: rect[1] };
        ctrl.state = keep.state; ctrl.t = keep.t; ctrl.speed = keep.speed;
        bk.showTraffic();
        return out;
      }, { zc, rect });
      check(`4 cầu rời CLOSED, xe trên nhịp quay: sơ tán bắt đầu ${r.started}, xong sau ${r.simT} s mô phỏng (≤ 1 s ở quay 30×), ra tới (${r.x}, ${r.z}) ngoài nhịp ${r.outside}, đủ mặt đường ${r.fits}, nghiêng ${r.lean}`, r.started && r.simT <= 1.0 && r.evac === 0 && r.outside && r.fits && r.lean === 0);
      check(`4 lái 90 km/h vào barie (cổng đóng): mũi xe dừng ở x ${r.barrier.minX} (≥ mép nhịp ${r.barrier.edge}), v ${r.barrier.v}, ${r.barrier.bad} điểm lọt vào nhịp`, r.barrier.bad === 0 && r.barrier.minX >= r.barrier.edge - 0.01 && Math.abs(r.barrier.v) < 0.5);
    });

    await section('5 (đổi góc nhìn)', async () => {
      await P.evaluate(() => window.__app.bike.placeAt(-150, 8.625, 0));
      const view = (v) => P.evaluate((v) => {
        const B = window.__app.bike, cam = window.__app.camera;
        if (v) B.setView(v);
        for (let i = 0; i < 8; i++) B.step(0.1, { gas: 0, brake: 0, steer: 0, hard: false, grip: 1 });   // 0,8 s > mixS
        return { view: B.view, mix: B.cam.mix, fov: cam.fov, near: cam.near };
      }, v);
      const c3 = await P.evaluate(() => ({ f3: window.__app.bike.cfg.cam3.fov, n3: window.__app.bike.cfg.cam3.near, f1: window.__app.bike.cfg.cam1.fov, n1: window.__app.bike.cfg.cam1.near }));
      const a0 = await view(0);
      check(`5 vào chế độ: góc thứ nhất (view ${a0.view}), fov ${a0.fov} = ${c3.f1}, near ${a0.near} = ${c3.n1}`, a0.view === 1 && Math.abs(a0.fov - c3.f1) < 1e-6 && Math.abs(a0.near - c3.n1) < 1e-6);
      const a3 = await view(3);
      check(`5 setView(3): sau 0,8 s mix ${a3.mix}, fov ${a3.fov} = ${c3.f3}, near ${a3.near} = ${c3.n3}`, a3.view === 3 && a3.mix === 1 && Math.abs(a3.fov - c3.f3) < 1e-6 && Math.abs(a3.near - c3.n3) < 1e-6);
      await frames(P, 2); await shot('thu-ba');
      const a1 = await view(1);
      check(`5 setView(1): mix ${a1.mix}, fov ${a1.fov} = ${c3.f1}, near ${a1.near} = ${c3.n1}`, a1.view === 1 && a1.mix === 0 && Math.abs(a1.fov - c3.f1) < 1e-6 && Math.abs(a1.near - c3.n1) < 1e-6);
      await P.focus('canvas').catch(() => {});
      await P.keyboard.press('KeyV');
      const kv = await P.evaluate(() => window.__app.bike.view);
      check(`5 phím V: góc ${kv} (3)`, kv === 3);
      await P.click('#bkView');
      const kb = await P.evaluate(() => window.__app.bike.view);
      check(`5 nút #bkView: góc ${kb} (1)`, kb === 1);
      await view(0);
    });

    await section('6 (người lái: tay – tay nắm)', async () => {
      const r = await P.evaluate(() => {
        const A = window.__app, B = A.bike, out = {};
        B.placeAt(-150, 8.625, 0);
        B.setView(1);
        for (const [tag, st] of [['thẳng', 0], ['trái hết', 1], ['phải hết', -1]]) {
          const s = B.state;
          for (let i = 0; i < 15; i++) B.step(0.1, { gas: 0, brake: 0, steer: st, hard: false, grip: 1 });
          const d = B.rider.debug(), cam = A.camera;
          /* độ sâu tay nắm trái / phải trong hệ camera (âm z = trước mặt) */
          const T = A.THREE, v = new T.Vector3(), an = B.model.anchors;
          cam.updateMatrixWorld(true);
          const depth = (o) => { o.updateWorldMatrix(true, false); v.setFromMatrixPosition(o.matrixWorld).applyMatrix4(cam.matrixWorldInverse); return -v.z; };
          out[tag] = { steer: +s.steer.toFixed(3), handL: d.handL, handR: d.handR, footL: d.footL, footR: d.footR, gripL: +depth(an.gripL).toFixed(3), gripR: +depth(an.gripR).toFixed(3), near: cam.near };
        }
        for (let i = 0; i < 15; i++) B.step(0.1, { gas: 0, brake: 0, steer: 0, hard: false, grip: 1 });
        return out;
      });
      const lock = 0.52;
      rec['6'] = r;
      for (const [tag, d] of Object.entries(r)) {
        const atLock = tag === 'thẳng' ? Math.abs(d.steer) < 1e-3 : Math.abs(d.steer) >= lock;
        check(`6 ${tag} (steer ${d.steer} rad, hình kẹp ±${lock}): tay trái ${(d.handL * 100).toFixed(2)} cm, tay phải ${(d.handR * 100).toFixed(2)} cm (≤ 2 cm)`, atLock && d.handL <= 0.02 && d.handR <= 0.02);
        check(`6 ${tag}: chân trái ${(d.footL * 100).toFixed(2)} cm, chân phải ${(d.footR * 100).toFixed(2)} cm (≤ 3 cm)`, d.footL <= 0.03 && d.footR <= 0.03);
        info(`6 ${tag}: độ sâu tay nắm trước camera góc thứ nhất trái ${d.gripL} m, phải ${d.gripR} m (near ${d.near})`);
      }
      const L = r['trái hết'];
      if (L.gripL < L.near + 0.05) warn(`6 (vấn đề đã biết, không chấm) góc thứ nhất bẻ hết lái trái: tay nắm trái cách camera ${L.gripL} m, sát / sau mặt cắt gần ${L.near} m ⇒ tay trái bị cắt`);
      else info(`6 bẻ hết lái trái: tay nắm trái ${L.gripL} m trước camera, ngoài mặt cắt gần ${L.near} m (vấn đề cắt tay trái không tái hiện ở phép đo tay nắm)`);
      await P.evaluate(() => { const B = window.__app.bike; for (let i = 0; i < 5; i++) B.step(0.1, { gas: 0, brake: 0, steer: 1, hard: false, grip: 1 }); });
      await frames(P, 2); await shot('lai-het-trai');
      await P.evaluate(() => { const B = window.__app.bike; for (let i = 0; i < 15; i++) B.step(0.1, { gas: 0, brake: 0, steer: 0, hard: false, grip: 1 }); });
    });

    await section('7 (đèn ngày / đêm / phanh / xi nhan)', async () => {
      const cfg = await P.evaluate(() => { const M = window.__app.bike.cfg.model; return { headDay: M.headDay, headNight: M.headNight, tailNight: M.tailNight, tailBrake: M.tailBrake, sigOn: M.sigOn, sigHz: M.sigHz }; });
      await P.evaluate(() => window.__app.bike.placeAt(-150, 8.625, 0));
      const read = (brake) => P.evaluate(`(() => { const B = window.__app.bike; B.state.v = ${brake ? 10 : 0}; B.step(0.05, { gas: 0, brake: ${brake ? 1 : 0}, steer: 0, hard: false, grip: 1 }); return { u: window.__app.shared.uNight.value, braking: B.state.braking, l: (${lampsFn.toString()})() }; })()`);
      await night(0); await frames(P, 3);
      const d = await read(false);
      const all = (k, f) => (d.l[k] || []).length > 0 && d.l[k].every(f);
      check(`7 có đủ vật liệu đèn: pha ${(d.l.lamp_head || []).length}, hậu ${(d.l.lamp_tail || []).length}, xi nhan ${(d.l.lamp_sig_l || []).length} / ${(d.l.lamp_sig_r || []).length}`, ['lamp_head', 'lamp_tail', 'lamp_sig_l', 'lamp_sig_r'].every((k) => (d.l[k] || []).length >= 1));
      check(`7 ngày (uNight ${d.u.toFixed(2)}), không phanh: đèn pha ${d.l.lamp_head} = headDay ${cfg.headDay}, đèn hậu ${d.l.lamp_tail} = 0, xi nhan ${d.l.lamp_sig_l}/${d.l.lamp_sig_r} = 0`,
        d.u < 0.01 && all('lamp_head', (x) => Math.abs(x - cfg.headDay) < 1e-3) && all('lamp_tail', (x) => x === 0) && all('lamp_sig_l', (x) => x === 0) && all('lamp_sig_r', (x) => x === 0));
      await night(1); await frames(P, 3);
      const n = await read(false);
      const alln = (k, f) => (n.l[k] || []).length > 0 && n.l[k].every(f);
      check(`7 đêm (uNight ${n.u.toFixed(2)}): đèn pha ${n.l.lamp_head} = ${cfg.headNight}, đèn hậu ${n.l.lamp_tail} = ${cfg.tailNight}`, n.u > 0.99 && alln('lamp_head', (x) => Math.abs(x - cfg.headNight) < 1e-2) && alln('lamp_tail', (x) => Math.abs(x - cfg.tailNight) < 1e-2));
      await shot('dem');
      await night(0); await frames(P, 3);
      const b = await read(true);
      check(`7 phanh ban ngày (braking ${b.braking}): đèn hậu ${b.l.lamp_tail} = tailBrake ${cfg.tailBrake}`, b.braking === true && (b.l.lamp_tail || []).length > 0 && b.l.lamp_tail.every((x) => Math.abs(x - cfg.tailBrake) < 1e-3));
      const rl = await read(false);
      check(`7 nhả phanh: đèn hậu ${rl.l.lamp_tail} = 0`, rl.braking === false && rl.l.lamp_tail.every((x) => x === 0));
      // xi nhan trái: bấm nút ◄ (khung thật chạy giữa các lệnh), rồi đặt uTime ở hai nửa chu kỳ và đọc trong cùng một lần evaluate
      await P.click('#bkSigL');
      const sg = await P.evaluate(`(() => { const A = window.__app, B = A.bike, h = 0.5 / ${cfg.sigHz}, o = {}; const sig = B.state.sig;
        A.shared.uTime.value = 1000 * 2 * h + 0.25 * h; B.step(0.02, { gas: 0, brake: 0, steer: 0, hard: false, grip: 1 }); o.on = (${lampsFn.toString()})();
        A.shared.uTime.value = 1000 * 2 * h + 1.25 * h; B.step(0.02, { gas: 0, brake: 0, steer: 0, hard: false, grip: 1 }); o.off = (${lampsFn.toString()})();
        return { sig, hud: document.getElementById('bkSigL').classList.contains('on'), on: o.on, off: o.off }; })()`);
      check(`7 xi nhan trái (sig ${sg.sig}, HUD #bkSigL on ${sg.hud}): nửa sáng trái ${sg.on.lamp_sig_l} = sigOn ${cfg.sigOn}, phải ${sg.on.lamp_sig_r} = 0; nửa tắt trái ${sg.off.lamp_sig_l} = 0`,
        sg.sig === 1 && sg.hud && sg.on.lamp_sig_l.every((x) => Math.abs(x - cfg.sigOn) < 1e-3) && sg.on.lamp_sig_r.every((x) => x === 0) && sg.off.lamp_sig_l.every((x) => x === 0));
      await P.click('#bkSigL');
      const off = await P.evaluate(() => ({ sig: window.__app.bike.state.sig, hud: document.getElementById('bkSigL').classList.contains('on') }));
      check(`7 bấm ◄ lần nữa: xi nhan tắt (sig ${off.sig}, HUD on ${off.hud})`, off.sig === 0 && !off.hud);
    });

    await section('8 (mưa: bám đường, bụi nước, vệt pha)', async () => {
      const wet = (k) => P.evaluate((k) => { const W = window.__app.weather; W.setParams({ rain: k }, true); W.state.wet = k; }, k);
      await night(0);
      await P.evaluate(() => window.__app.bike.placeAt(-150, 8.625, 0));
      await frames(P, 3);
      const gDry = await P.evaluate(() => window.__app.bike.input.grip);
      await wet(1); await frames(P, 3);
      const gWet = await P.evaluate(() => ({ grip: window.__app.bike.input.grip, wet: window.__app.weather.state.wet }));
      check(`8 grip theo mặt ướt (Cầu Rồng): khô ${gDry} (1), ướt hẳn ${gWet.grip} (0, wet ${gWet.wet})`, gDry === 1 && gWet.grip === 0);
      // quãng phanh 50 km/h → 0: khô (grip 1) so với ướt (grip 0)
      const br = await P.evaluate(() => {
        const B = window.__app.bike, out = {};
        window.__bk.hideTraffic();
        for (const g of [1, 0]) {
          B.placeAt(-200, 8.625, 0); const s = B.state; s.v = 50 / 3.6; const x0 = s.x;
          for (let i = 0; i < 200 && s.v > 0; i++) B.step(0.05, { gas: 0, brake: 1, steer: 0, hard: false, grip: g });
          out[g] = s.x - x0;
        }
        window.__bk.showTraffic();
        return out;
      });
      rec['8 phanh'] = br;
      check(`8 quãng phanh 50 km/h → 0: khô ${br[1].toFixed(2)} m, ướt ${br[0].toFixed(2)} m (dài hơn ${((br[0] / br[1] - 1) * 100).toFixed(1)} %, ≥ 20 %)`, br[0] >= 1.2 * br[1]);
      const sp = await P.evaluate(() => {
        const B = window.__app.bike; window.__bk.hideTraffic();
        B.placeAt(-200, 8.625, 0); const s = B.state; s.v = 12; let mx = 0;
        for (let i = 0; i < 20; i++) { B.step(0.1, { gas: 1, brake: 0, steer: 0, hard: false, grip: 0 }); mx = Math.max(mx, B.fx.drawn().spray); }
        window.__bk.showTraffic();
        return { mx, now: B.fx.drawn() };
      });
      check(`8 mưa, chạy ${'≈'} 45 km/h: bụi nước ${sp.mx} hạt (> 0), vệt pha ban ngày ${sp.now.beam} (false)`, sp.mx > 0 && sp.now.beam === false);
      await frames(P, 1); await shot('mua');
      await night(1); await frames(P, 3);
      const bm = await P.evaluate(() => { const B = window.__app.bike; B.step(0.1, { gas: 1, brake: 0, steer: 0, hard: false, grip: 0 }); return B.fx.drawn(); });
      check(`8 đêm mưa: vệt pha ${bm.beam} (true), bụi nước ${bm.spray}`, bm.beam === true);
      await shot('mua-dem');
      // đoạn hầm kín: luôn khô dù trời mưa
      const tz = await P.evaluate(() => { const r = window.__bk.rect('tunnel.tube.S'); return (r[2] + r[3]) / 2; });
      await P.evaluate((z) => window.__app.bike.placeAt(-60, z, 0), tz);
      await frames(P, 3);
      const gT = await P.evaluate(() => ({ grip: window.__app.bike.input.grip, x: window.__app.bike.state.x }));
      check(`8 đoạn hầm kín (x ${gT.x.toFixed(1)}) khi mưa: grip ${gT.grip} (1)`, gT.grip === 1);
      await wet(0); await night(0);
      await P.evaluate(() => window.__app.bike.placeAt(-150, 8.625, 0));
      await frames(P, 3);
      const dr = await P.evaluate(() => {
        const B = window.__app.bike; window.__bk.hideTraffic();
        B.placeAt(-200, 8.625, 0); B.state.v = 12;
        for (let i = 0; i < 15; i++) B.step(0.1, { gas: 1, brake: 0, steer: 0, hard: false, grip: 1 });
        window.__bk.showTraffic();
        return { d: B.fx.drawn(), grip: B.input.grip };
      });
      check(`8 tạnh, khô: bụi nước ${dr.d.spray} hạt (0), vệt pha ngày ${dr.d.beam} (false), grip ${dr.grip} (1)`, dr.d.spray === 0 && dr.d.beam === false && dr.grip === 1);
    });

    await section('10 (HUD 9 ngôn ngữ)', async () => {
      await P.evaluate(() => window.__app.bike.placeAt(-150, 8.625, 0));
      const r = await P.evaluate(() => {
        const B = window.__app.bike, out = [];
        for (const v of [0, 7.3, 13.9, 25, -0.8]) {
          B.state.v = v; B.step(0.1, { gas: v > 0 ? 1 : 0, brake: v < 0 ? 1 : 0, steer: 0, hard: false, grip: 1 });
          out.push({ v: B.state.v, txt: document.getElementById('drKmh').textContent });
        }
        return out;
      });
      check(`10 km/h khớp |v| · 3,6 sau mỗi bước: ${r.map((o) => `${o.v.toFixed(2)} m/s → ${o.txt}`).join('; ')}`, r.every((o) => o.txt === String(Math.round(Math.abs(o.v) * 3.6))));
      const TXT = { bkHint: '#bkHint', bkStuck: '#bkStuck', drSpeedUnit: '#drSpeedUnit' }, ARIA = { bkSigL: '#bkSigL', bkSigR: '#bkSigR', bkView: '#bkView', bkHorn: '#bkHorn', bkReset: '#bkReset' };
      const seen = {}, bad = [];
      for (const lang of LANGS) {
        await pick(P, '#langSelect', lang); await frames(P, 1);
        seen[lang] = await P.evaluate(({ TXT, ARIA }) => ({ ...Object.fromEntries(Object.entries(TXT).map(([k, s]) => [k, document.querySelector(s).textContent.trim()])), ...Object.fromEntries(Object.entries(ARIA).map(([k, s]) => [k, document.querySelector(s).getAttribute('aria-label')])) }), { TXT, ARIA });
        for (const k of [...Object.keys(TXT), ...Object.keys(ARIA)]) if (seen[lang][k] !== String(LOC[lang][k]).trim()) bad.push(`${lang}.${k}`);
      }
      check(`10 9 ngôn ngữ: #bkHint, #bkStuck, đơn vị, aria ◄ ► 🎥 📢 ↺ khớp locale (lệch: ${bad.join(',') || '-'})`, bad.length === 0);
      const diff = new Set(LANGS.map((l) => seen[l].bkHint)).size;
      check(`10 gợi ý phím khác nhau giữa các ngôn ngữ (${diff}/9)`, diff >= 8);
      await pick(P, '#langSelect', 'ar'); await frames(P, 1);
      const ar = await P.evaluate(() => ({ dir: document.documentElement.dir, hud: getComputedStyle(document.getElementById('drHud')).direction, hint: document.getElementById('bkHint').textContent.trim() }));
      check(`10 ar: html dir ${ar.dir} (rtl), #drHud direction ${ar.hud} (ltr), gợi ý "${ar.hint.slice(0, 30)}…"`, ar.dir === 'rtl' && ar.hud === 'ltr' && ar.hint.length > 3);
      await pick(P, '#langSelect', 'vi'); await frames(P, 1);
    });

    allErrors.push(['A', A.errors]);
    await P.close();
  }

  /* ---------------- Trang B: ?chooser → thẻ Xe máy ---------------- */
  await section('1b (thẻ Xe máy, trang B)', async () => {
    const B = await openApp(browser, srv.url + '?chooser', { width: 640, height: 360 });
    B.page.setDefaultTimeout(300000);
    try {
      await B.page.waitForSelector('#chooser', { state: 'visible', timeout: 300000 });
      const card = await B.page.evaluate(() => { const b = document.querySelector('#chooser [data-pick="bike"]'); return b ? { disabled: b.disabled, txt: b.textContent } : null; });
      check(`1b thẻ Xe máy (data-pick="bike") có, không khóa, chứa "${LOC.vi.exBike}"`, !!card && !card.disabled && card.txt.includes(LOC.vi.exBike));
      await B.page.click('#chooser [data-pick="bike"]');
      await B.page.waitForFunction(() => document.body.classList.contains('bike') && window.__app.cam.mode === 'bike' && window.__app.bike.state, null, { polling: 500 });
      const r = await B.page.evaluate(() => { const A = window.__app, s = A.bike.state; return { explore: document.body.classList.contains('explore'), x: s.x, z: s.z, yaw: s.yaw, hid: document.getElementById('chooser').hidden }; });
      check(`1b bấm thẻ Xe máy: body.explore + body.bike, hộp chọn đóng ${r.hid}, xe ở (${r.x}, ${r.z}) hướng ${r.yaw}`, r.explore && r.hid && Math.abs(r.x - K.spawnX) < 1e-6 && Math.abs(r.z - K.spawnLane) < 1e-6 && r.yaw === 0);
    } finally { allErrors.push(['B', B.errors]); await B.page.close(); }
  }, 12 * 60 * 1000);

  /* ---------------- Trang C: chặn scooter.glb ---------------- */
  await section('9a (chặn scooter.glb)', async () => {
    const C9 = await openApp(browser, srv.url + '?explore=bike', { width: 480, height: 270, before: (pg) => pg.route('**/bike/scooter.glb', (r) => r.abort()) });
    C9.page.setDefaultTimeout(300000);
    try {
      await C9.page.waitForFunction(() => window.__app.bike.active(), null, { polling: 500 });
      await sleep(12000);   // quá model.timeoutMs (8 s)
      const r = await C9.page.evaluate(() => {
        const A = window.__app, B = A.bike, m = B.model, s0 = B.state;
        for (const f of A.traffic.fleets()) f.mesh.visible = false;
        const x0 = s0.x; for (let i = 0; i < 100; i++) B.step(0.1, { gas: 1, brake: 0, steer: 0, hard: false, grip: 1 });
        const s = B.state, temp = !!m.group.getObjectByName('bike-temp');
        return { real: m.real, temp, inScene: !!m.group.parent, moved: s.x - x0, v: s.v, gx: m.group.position.x, sx: s.x };
      });
      check(`9a scooter.glb bị chặn: hình tạm ${r.temp}, mô hình thật ${r.real}, trong cảnh ${r.inScene}, lái được (dời ${r.moved.toFixed(1)} m, v ${r.v.toFixed(1)}), hình theo trạng thái (${r.gx.toFixed(2)} so ${r.sx.toFixed(2)})`,
        r.temp && !r.real && r.inScene && r.moved > 30 && Math.abs(r.gx - r.sx) < 0.01);
      await frames(C9.page, 2);
      check(`9a không lỗi console khi chặn scooter.glb (${C9.errors.length})`, C9.errors.length === 0);
      if (C9.errors.length) console.log(C9.errors.join('\n'));
    } finally { await C9.page.close(); }
  }, 12 * 60 * 1000);

  /* ---------------- Trang D: scooter.glb chậm 12 s ---------------- */
  await section('9b (scooter.glb chậm 12 s)', async () => {
    let release; const gate = new Promise((r) => { release = r; });
    const D9 = await openApp(browser, srv.url + '?explore=bike', { width: 480, height: 270, before: (pg) => pg.route('**/bike/scooter.glb', async (r) => { await gate; try { await r.continue(); } catch { /* trang đã đóng */ } }) });
    D9.page.setDefaultTimeout(300000);
    try {
      await D9.page.waitForFunction(() => window.__app.bike.active(), null, { polling: 500 });
      const probe = () => D9.page.evaluate(() => { const B = window.__app.bike, m = B.model, s = B.state; return { real: m.real, temp: !!m.group.getObjectByName('bike-temp'), x: m.group.position.x, z: m.group.position.z, sx: s.x, sz: s.z }; });
      const t0 = Date.now();
      const early = await probe();
      await sleep(Math.max(0, 12000 - (Date.now() - t0)));
      const mid = await probe();
      check(`9b đang tải chậm (≈ 12 s): hình tạm (${early.temp} / ${mid.temp}), mô hình thật ${mid.real}, tại (${mid.x.toFixed(2)}, ${mid.z.toFixed(2)}) = trạng thái`, early.temp && !early.real && mid.temp && !mid.real && Math.abs(mid.x - mid.sx) < 0.01);
      release();
      await D9.page.waitForFunction(() => window.__app.bike.model.real, null, { polling: 2000, timeout: 240000 });
      const late = await probe();
      check(`9b tải xong: mô hình thật ${late.real}, hình tạm đã gỡ ${!late.temp}, vị trí không nhảy (${late.x.toFixed(2)}, ${late.z.toFixed(2)}) = (${late.sx.toFixed(2)}, ${late.sz.toFixed(2)})`, late.real && !late.temp && Math.abs(late.x - late.sx) < 0.01 && Math.abs(late.z - late.sz) < 0.01);
      check(`9b không lỗi console (${D9.errors.length})`, D9.errors.length === 0);
      if (D9.errors.length) console.log(D9.errors.join('\n'));
    } finally { release(); await D9.page.close(); }
  }, 12 * 60 * 1000);
  info('9 âm thanh xe máy là máy tổng hợp (spec §17.11), không có tệp âm thanh để chặn / làm chậm');

  /* ---------------- Trang F: ?test thường — lệnh vẽ, fov / near, stop / start × 3, chế độ khác ---------------- */
  let F = null;
  await section('mở trang F', async () => {
    F = await openApp(browser, srv.url, { width: 640, height: 360, before: (pg) => pg.addInitScript(() => {
      /* đếm bộ nghe đang sống: bọc add / removeEventListener trước khi mã ứng dụng chạy */
      const live = new Map(), key = (t, ty, l, o) => { const cap = typeof o === 'boolean' ? o : !!(o && o.capture); return [ty, cap]; };
      const ids = new WeakMap(); let nid = 0; const id = (x) => { if (!ids.has(x)) ids.set(x, ++nid); return ids.get(x); };
      const add = EventTarget.prototype.addEventListener, rem = EventTarget.prototype.removeEventListener;
      EventTarget.prototype.addEventListener = function (ty, l, o) { if (l) { const [t, c] = key(this, ty, l, o); live.set(`${id(this)}|${t}|${id(l)}|${c}`, this); } return add.call(this, ty, l, o); };
      EventTarget.prototype.removeEventListener = function (ty, l, o) { if (l) { const [t, c] = key(this, ty, l, o); live.delete(`${id(this)}|${t}|${id(l)}|${c}`); } return rem.call(this, ty, l, o); };
      window.__listeners = () => live.size;
    }) });
    F.page.setDefaultTimeout(300000);
  }, 15 * 60 * 1000);

  if (F) {
    const P = F.page;
    const calls = async () => { const xs = []; for (let i = 0; i < 5; i++) { await frames(P, 1); xs.push(await P.evaluate(() => window.__app.renderer.info.render.calls)); } xs.sort((a, b) => a - b); return xs[2]; };
    let fov0 = NaN, near0 = NaN;

    await section('11 (lệnh vẽ, program)', async () => {
      await P.evaluate(() => { const A = window.__app; A.dayNight.target = 0; A.dayNight.night = 0; });
      await frames(P, 3);
      await pickView(P, 'dragon', 'overview');
      await frames(P, 4);
      const base = await calls();
      const kq = rd('./KET-QUA.md').match(/\|\s*overview\s*\|\s*(\d+)\s*\|\s*(\d+)\s*\|/);
      const mainDay = kq ? Number(kq[1]) : NaN;
      const pre = await P.evaluate(() => ({ prog: window.__app.renderer.info.programs.length, bike: !!window.__app.scene.getObjectByName('bike'), fov: window.__app.camera.fov, near: window.__app.camera.near }));
      fov0 = pre.fov; near0 = pre.near;
      rec['11 overview'] = base;
      check(`11 trước khi vào chế độ: góc overview ban ngày ${base} lệnh vẽ, mốc main trong tests/KET-QUA.md ${mainDay}; không có xe máy trong cảnh (${!pre.bike})`, base === mainDay && !pre.bike);
      await P.evaluate(() => { window.__app.bike.start(); window.__app.bike.placeAt(-150, 8.625, 0); window.__app.bike.state.v = 10; });
      await P.waitForFunction(() => { const b = window.__app.bike; return b.model && b.model.real && b.rider; }, null, { polling: 2000, timeout: 300000 });
      const hold = () => P.evaluate(() => { const B = window.__app.bike; B.placeAt(-150, 8.625, 0); B.state.v = 10; });
      await hold(); await frames(P, 4); await hold();
      const first = await calls();
      await P.evaluate(() => window.__app.bike.setView(3));
      await frames(P, 4); await hold(); await P.waitForFunction(() => window.__app.bike.cam.mix === 1, null, { polling: 500 }); await hold();
      const third = await calls();
      const prog1 = await P.evaluate(() => window.__app.renderer.info.programs.length);
      rec['11 lái'] = { first, third, prog0: pre.prog, prog1 };
      info(`11 lệnh vẽ khi lái (640 × 360, dist, ?test, ban ngày, Cầu Rồng x = −150, xe tự động để nguyên, trung vị 5 khung, 2026-11-14): thứ nhất ${first}, thứ ba ${third}; Task 7 (dev 960 × 540): ${TASK7.first} / ${TASK7.third}`);
      info(`11 program: trước khi vào chế độ ${pre.prog}, sau khi lái (cả hai góc) ${prog1} (+${prog1 - pre.prog})`);
      check(`11 lái góc thứ nhất: ${first} lệnh vẽ ≤ mốc Task 7 ${TASK7.first}`, first <= TASK7.first);
      check(`11 lái góc thứ ba: ${third} lệnh vẽ ≤ mốc Task 7 ${TASK7.third}`, third <= TASK7.third);
      await P.evaluate(() => window.__app.bike.setView(1));
    }, 20 * 60 * 1000);

    await section('5b + 12 (stop / start × 3)', async () => {
      const snap = () => P.evaluate(() => {
        const A = window.__app; let meshes = 0; A.scene.traverse((o) => { if (o.isMesh || o.isPoints || o.isLine) meshes++; });
        return { listeners: window.__listeners(), nodes: A.bike.sound.nodes(), meshes, on: A.bike.sound.on, fov: A.camera.fov, near: A.camera.near, mode: A.cam.mode, cls: document.body.classList.contains('bike') };
      });
      const rows = [];
      for (let i = 1; i <= 3; i++) {
        await P.evaluate(() => window.__app.bike.stop());
        await frames(P, 3);
        const off = await snap();
        if (i === 1) check(`5b sau bike.stop(): fov ${off.fov} = ${fov0}, near ${off.near} = ${near0} (như trước khi vào), cam.mode '${off.mode}', body.bike ${off.cls}`, off.fov === fov0 && off.near === near0 && off.mode !== 'bike' && !off.cls);
        await P.evaluate(() => { const B = window.__app.bike; B.start(); if (!B.sound.on) B.sound.toggle(); });
        await frames(P, 3);
        const on = await snap();
        rows.push({ i, off, on });
        info(`12 vòng ${i}: sau stop: bộ nghe ${off.listeners}, nút âm thanh ${off.nodes}, lưới ${off.meshes}; sau start: bộ nghe ${on.listeners}, nút âm thanh ${on.nodes} (tiếng bật ${on.on}), lưới ${on.meshes}`);
      }
      rec['12'] = rows.map((r) => ({ i: r.i, off: [r.off.listeners, r.off.nodes, r.off.meshes], on: [r.on.listeners, r.on.nodes, r.on.meshes] }));
      const [a, , c] = rows;
      check(`12 sau stop(): bộ nghe vòng 3 ${c.off.listeners} ≤ vòng 1 ${a.off.listeners}, nút âm thanh ${rows.map((r) => r.off.nodes).join('/')} = 0, lưới vòng 3 ${c.off.meshes} ≤ vòng 1 ${a.off.meshes}`, c.off.listeners <= a.off.listeners && rows.every((r) => r.off.nodes === 0) && c.off.meshes <= a.off.meshes);
      check(`12 sau start(): bộ nghe vòng 3 ${c.on.listeners} ≤ vòng 1 ${a.on.listeners}, nút âm thanh ${rows.map((r) => r.on.nodes).join('/')} (> 0, không tăng), lưới vòng 3 ${c.on.meshes} ≤ vòng 1 ${a.on.meshes}`, c.on.listeners <= a.on.listeners && a.on.nodes > 0 && c.on.nodes <= a.on.nodes && c.on.meshes <= a.on.meshes);
    }, 20 * 60 * 1000);

    await section('13 (sau khi thoát: Ô tô, Đi dạo, Dù lượn)', async () => {
      await P.evaluate(() => window.__app.bike.stop());
      await frames(P, 2);
      await P.evaluate(() => window.__app.drive.start());
      await P.waitForFunction(() => window.__app.drive.active() && window.__app.cam.mode === 'car', null, { polling: 500 });
      await P.evaluate(installHelpers, K);
      await P.evaluate(() => { window.__veh = 'drive'; });
      const mv = await P.evaluate(() => {
        const D = window.__app.drive; window.__bk.hideTraffic();
        D.placeAt(-200, 8.625, 0); const s = D.state, x0 = s.x;
        for (let i = 0; i < 100; i++) D.step(0.1, { gas: 1, brake: 0, steer: 0, hand: false });
        return { moved: s.x - x0, v: s.v };
      });
      check(`13 ô tô sau xe máy: lái được (dời ${mv.moved.toFixed(1)} m trong 10 s, v ${mv.v.toFixed(1)})`, mv.moved > 50);
      const rect = await P.evaluate(() => window.__bk.rect('dragon.bridge.S'));
      const zc = (rect[2] + rect[3]) / 2;
      const cr = await P.evaluate((o) => window.__bk.crash(o), { pad: 'dragon.bridge.S', side: 'z1', x: 0, z: zc, yaw: -Math.PI / 2, v0: 27.78, T: 6 });
      check(`13 ô tô đâm lan can Cầu Rồng: góc xe cỡ VF 3 (dài ${K.car.length}, rộng ${K.car.width}) lấn ${cr.worst} m (≤ 0,01; thân xe máy còn sót thì lấn ≈ ${((K.car.length - K.bike.length) / 2).toFixed(2)} m), v ${cr.v}`, !cr.err && cr.worst <= 0.01 && Math.abs(cr.v) < 0.5);
      await P.evaluate(() => { window.__bk.showTraffic(); window.__veh = 'bike'; window.__app.drive.stop(); });
      await frames(P, 2);
      await P.evaluate(() => window.__app.stroll.stroll.start());
      await P.waitForFunction(() => window.__app.cam.mode === 'stroll' && window.__app.stroll.stroll.state, null, { polling: 500 });
      await frames(P, 3);
      const st = await P.evaluate(() => { const A = window.__app, S = A.stroll, s = S.stroll.state; return { stroll: document.body.classList.contains('stroll'), bike: document.body.classList.contains('bike'), valid: S.stValid(S.stroll.map, s.x, s.z, 0), bikeInScene: !!A.scene.getObjectByName('bike') }; });
      check(`13 Đi dạo vào được: body.stroll ${st.stroll}, body.bike ${st.bike} (false), vị trí hợp lệ ${st.valid}, xe máy không còn trong cảnh ${!st.bikeInScene}`, st.stroll && !st.bike && st.valid && !st.bikeInScene);
      await P.evaluate(() => window.__app.explore.start());
      await P.waitForFunction(() => window.__app.cam.mode === 'glider', null, { polling: 500 });
      await frames(P, 3);
      const gl = await P.evaluate(() => ({ act: window.__app.explore.active(), obj: !!window.__app.scene.getObjectByName('ex-glider'), mode: window.__app.cam.mode }));
      check(`13 Dù lượn vào được (khói): explore.active ${gl.act}, dù trong cảnh ${gl.obj}, cam.mode '${gl.mode}'`, gl.act && gl.obj && gl.mode === 'glider');
    }, 20 * 60 * 1000);

    allErrors.push(['F', F.errors]);
    await P.close();
  }

  /* ---------------- Mục 15 (tùy chọn): hai trang xe máy cùng phòng qua wrangler dev cục bộ ---------------- */
  if (MULTI) {
    const { multiSection } = await import('./bike-multi.mjs');
    await section('15 (nhiều người, wrangler dev cục bộ)', () => multiSection({ browser, srv, check, info, allErrors }), 45 * 60 * 1000);
  }

  await section('14 (console)', async () => {
    for (const [name, errs] of allErrors) {
      check(`14 console sạch (trang ${name}, ${errs.length} lỗi)`, errs.length === 0);
      if (errs.length) console.log(errs.join('\n'));
    }
  });
} catch (e) {
  check('ngoại lệ ngoài mục: ' + String(e && e.message || e), false);
} finally {
  try { await browser.close(); } catch { /* bỏ qua */ }
  srv.close();
}
console.log('---- tổng kết từng mục ----');
for (const [n, k, l] of sections) console.log(`${l ? 'LỖI' : 'ĐẠT'}  ${n}: ${k - l}/${k}`);
console.log('số đo: ' + JSON.stringify(rec));
const nAll = sections.reduce((a, s) => a + s[1], 0);
console.log(problems.length ? `bike-check: LỖI (${problems.length}/${nAll} kiểm trượt): ${problems.join('; ')}` : `bike-check: đạt (${nAll} kiểm, ${((Date.now() - T0) / 60000).toFixed(0)} phút)`);
process.exit(problems.length ? 1 : 0);

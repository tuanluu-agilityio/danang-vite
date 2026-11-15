// Bộ điều khiển Trực tiếp / Mô phỏng + nhịp làm mới (D-043 Task 5, spec §4.4, §4.5)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CONFIG } from '../../src/config.ts';
import { createLiveEnv, liveNextDelay, type EnvMode } from '../../src/realtime/liveEnv.ts';
import { envToParams } from '../../src/realtime/envMap.ts';
import type { EnvWeather } from '../../src/realtime/weatherApi.ts';
import type { WeatherParams } from '../../src/environment/weather/state.ts';

const L = CONFIG.live;
const NOON = Date.UTC(2026, 10, 15, 5, 0);       // 12:00 ICT — mặt trời cao
const MIDNIGHT = Date.UTC(2026, 10, 15, 17, 0);  // 00:00 ICT hôm sau
const W = (o: Partial<EnvWeather> = {}): EnvWeather => ({
  obs: NOON - 300000, obsMin: 715, temp: 27, feels: 29, hum: 70, wind: 10, dir: 45, rain: 0, cloud: 40, uv: 5, code: 2, isDay: true,
  sunrise: 355, sunset: 1035, gust: 18, vis: 24000, rate: 0, ...o
});

/* Kho / thời tiết / đồng hồ giả */
function rig(initial: EnvMode, data: EnvWeather | null = null) {
  let t = NOON, ck = 1000, d: EnvWeather | null = data;   // ck: đồng hồ đơn điệu (cửa sổ áp tức thì cfg.instantMs)
  const subs: Array<() => void> = [];
  const calls = { setLive: [] as Array<[WeatherParams | null, boolean | undefined]>, stop: 0, stand: 0, refresh: 0 };
  const dayNight = { night: 0.3, target: 0.4 };
  const store = {
    get data() { return d; }, status: () => (d ? 'ok' : 'loading') as any,
    onChange(fn: () => void) { subs.push(fn); },
    refresh() { calls.refresh++; return Promise.resolve(); }
  };
  const weather = {
    setLive(p: WeatherParams | null, instant?: boolean) { calls.setLive.push([p, instant]); },
    stopScenario() { calls.stop++; }, standTrees() { calls.stand++; }
  };
  const live = createLiveEnv({ cfg: L, lat: CONFIG.env.lat, lon: CONFIG.env.lon, refreshMs: CONFIG.env.refreshMs, now: () => t, clock: () => ck, store, weather, dayNight, initial });
  const push = (v: EnvWeather | null) => { d = v; for (const f of subs) f(); };
  return { live, calls, dayNight, push, setNow: (v: number) => { t = v; }, wait: (ms: number) => { ck += ms; } };
}

test('mặc định theo initial; Mô phỏng: sun null, không ghi gì', () => {
  const r = rig('manual');
  assert.equal(r.live.mode, 'manual');
  assert.equal(r.live.sun, null);
  r.live.update(0.016);
  assert.equal(r.dayNight.target, 0.4); assert.equal(r.dayNight.night, 0.3);
  assert.equal(rig('live').live.mode, 'live');
});

test('Trực tiếp: lần update đầu gán night = target; trưa ⇒ 0, nửa đêm ⇒ 1, sau đó không ghi night', () => {
  const r = rig('live');
  r.live.update(0.016);
  assert.equal(r.dayNight.target, 0); assert.equal(r.dayNight.night, 0);
  assert.ok(r.live.sun && r.live.sun.elev > 50, 'trưa: mặt trời cao');
  r.setNow(MIDNIGHT); r.live.update(3600);
  assert.equal(r.dayNight.target, 1);
  assert.equal(r.dayNight.night, 0, 'night do stepNight lo, bộ điều khiển không ghi sau lần đầu');
  assert.ok(r.live.sun!.elev < -6);
});

test('Trực tiếp + kho bơm số liệu: setLive đúng envToParams, lần đầu instant, lần hai không', () => {
  const r = rig('live');
  r.live.update(0.016);
  const a = W(), b = W({ code: 63, rate: 4, rain: 1, cloud: 100 });
  r.push(a);
  assert.equal(r.calls.setLive.length, 1);
  assert.deepEqual(r.calls.setLive[0][0], envToParams(a, true, L));
  assert.equal(r.calls.setLive[0][1], true);
  r.push(b);
  assert.equal(r.calls.setLive.length, 2);
  assert.deepEqual(r.calls.setLive[1][0], envToParams(b, true, L));
  assert.equal(r.calls.setLive[1][1], false);
});

test('số liệu đầu tới trong instantMs ⇒ tức thì; tới muộn hơn ⇒ tiến dần (cả khi skew đổi giờ)', () => {
  const a = rig('live');
  a.wait(L.instantMs);
  a.push(W());
  assert.equal(a.calls.setLive[0][1], true, 'đúng mốc instantMs vẫn tức thì');
  const b = rig('live');
  b.wait(L.instantMs + 1);
  b.setNow(NOON - 5 * 3600000);   // giờ hiệu chỉnh nhảy (skew) không ảnh hưởng: cửa sổ đo bằng clock đơn điệu
  b.push(W());
  assert.equal(b.calls.setLive.length, 1);
  assert.equal(b.calls.setLive[0][1], false, 'tới muộn ⇒ không tức thì');
  b.push(W({ temp: 31 }));
  assert.equal(b.calls.setLive[1][1], false);
  const c = rig('live');
  c.wait(L.instantMs + 1);
  c.push(null); c.wait(10); c.push(W());
  assert.equal(c.calls.setLive[0][1], false, 'kho báo loading trước rồi mới có số liệu muộn');
});

test('kho đã có số liệu (bộ nhớ đệm) lúc tạo: áp ngay, tức thì', () => {
  const r = rig('live', W());
  assert.equal(r.calls.setLive.length, 1);
  assert.equal(r.calls.setLive[0][1], true);
});

test('kho báo lỗi mà data giữ nguyên (stale) ⇒ không gọi setLive thêm; data null ⇒ không gọi', () => {
  const r = rig('live');
  const a = W();
  r.push(a); r.push(a); r.push(a);
  assert.equal(r.calls.setLive.length, 1);
  r.push(null);
  assert.equal(r.calls.setLive.length, 1);
});

test('Mô phỏng + kho đổi 3 lần ⇒ setLive không được gọi, dayNight không đổi', () => {
  const r = rig('manual');
  r.push(W()); r.push(W({ temp: 30 })); r.push(W({ code: 95, rate: 10 }));
  r.live.update(0.016);
  assert.equal(r.calls.setLive.length, 0);
  assert.equal(r.dayNight.target, 0.4);
});

test('setMode(live): dừng kịch bản, dựng cây, làm mới nếu số liệu cũ, áp đích không tức thì; setMode(manual): setLive(null), trả đêm đã nhớ', () => {
  const r = rig('manual', W({ obs: NOON - 3600000 }));
  const seen: string[] = [];
  r.live.onChange((w) => seen.push(w));
  r.live.setMode('live');
  assert.equal(r.calls.stop, 1); assert.equal(r.calls.stand, 1);
  assert.equal(r.calls.refresh, 1, 'số liệu cũ hơn refreshMs ⇒ refresh');
  assert.equal(r.dayNight.target, 0);
  assert.equal(r.dayNight.night, 0.3, 'từ Mô phỏng: đêm tiến dần, không gán');
  const last = r.calls.setLive[r.calls.setLive.length - 1];
  assert.ok(last[0]); assert.equal(last[1], false);
  r.live.update(0.016);
  assert.equal(r.dayNight.night, 0.3);
  r.live.setMode('manual', 'feature');
  assert.equal(r.live.mode, 'manual');
  assert.deepEqual(r.calls.setLive[r.calls.setLive.length - 1], [null, undefined]);
  assert.equal(r.dayNight.target, 0.4);
  assert.equal(r.live.sun, null);
  assert.deepEqual(seen.filter((w) => w !== 'data'), ['user', 'feature']);
});

test('setMode(live) với số liệu mới: không refresh', () => {
  const r = rig('manual', W({ obs: NOON - 60000 }));
  r.live.setMode('live');
  assert.equal(r.calls.refresh, 0);
});

test('qua chân trời: tính lại đích (mù nóng chỉ ban ngày) dù số liệu không đổi', () => {
  const r = rig('live');
  r.live.update(0.016);
  r.push(W({ temp: 38, cloud: 0 }));
  assert.ok(r.calls.setLive[0][0]!.haze > 0.5);
  r.setNow(MIDNIGHT); r.live.update(0.016);
  assert.equal(r.calls.setLive.length, 2);
  assert.equal(r.calls.setLive[1][0]!.haze, 0);
  r.live.update(0.016);
  assert.equal(r.calls.setLive.length, 2, 'không gọi lại mỗi khung');
});

test('đối tượng kiểu D-042 (thiếu gust / vis / rate) không sinh NaN', () => {
  const old: any = W(); delete old.gust; delete old.vis; delete old.rate; old.rain = 0.5; old.code = 61;
  const p = envToParams(old, true, L);
  for (const [k, v] of Object.entries(p)) if (k !== 'closed') assert.ok(Number.isFinite(v as number), k + ' = ' + v);
  assert.ok(p.rain > 0.2, 'rate suy từ rain × 4 = 2 mm/h');
});

test('liveNextDelay: căn mốc 15 phút + obsDelay, nhiễu ≤ jitter, không dưới minDelay', () => {
  const S = L.obsStepMs, base = Date.UTC(2026, 10, 15, 5, 0);
  assert.equal(liveNextDelay(base, L, () => 0), L.obsDelayMs);                 // đúng mốc ⇒ chờ obsDelay
  assert.equal(liveNextDelay(base + 30000, L, () => 0), L.obsDelayMs - 30000); // 30 s sau mốc ⇒ 60 s
  assert.equal(liveNextDelay(base + L.obsDelayMs + 1000, L, () => 0), S - 1000);   // vừa qua lần lấy ⇒ mốc kế
  assert.equal(liveNextDelay(base + L.obsDelayMs - 1000, L, () => 0), L.minDelayMs);   // sát lần lấy ⇒ sàn 60 s
  assert.equal(liveNextDelay(base, L, () => 0.999999), L.obsDelayMs + 0.999999 * L.jitterMs);
  for (let k = 0; k < 200; k++) {
    const now = base + k * 12345, dl = liveNextDelay(now, L, () => 0);
    assert.ok(dl >= L.minDelayMs && dl <= S + L.minDelayMs);
    assert.equal(((now + dl - L.obsDelayMs) % S + S) % S === 0 || dl === L.minDelayMs, true);
  }
});

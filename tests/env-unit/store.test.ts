// Kho trạng thái số liệu thực tế: nhịp, thử lại, bộ nhớ đệm, trạng thái (D-042 Task 1)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { CONFIG } from '../../src/config.ts';
import { createEnvStore, type EnvDeps } from '../../src/realtime/store.ts';

const FIX = JSON.parse(readFileSync(new URL('./fixture.json', import.meta.url), 'utf8'));
const OBS = Date.UTC(2026, 10, 14, 15, 15);
const okRes = () => Promise.resolve({ ok: true, json: () => Promise.resolve(FIX) });
const fail = () => Promise.reject(new Error('mạng hỏng'));

/* Môi trường giả: đồng hồ, hàng đợi hẹn giờ, fetch đếm lời gọi */
function rig(opt: { live?: boolean; storage?: any; fetchImpl?: (url: string, init: any, n: number) => Promise<any> } = {}) {
  let t = OBS + 60000, calls = 0, id = 0, inflight = 0, maxInflight = 0;
  const timers = new Map<number, { at: number; fn: () => void }>();
  const log: number[] = [];   // ms của mỗi lần hẹn lấy lại (bỏ hẹn hủy theo timeoutMs)
  const mem: Record<string, string> = {};
  const storage = opt.storage === undefined ? { getItem: (k: string) => (k in mem ? mem[k] : null), setItem: (k: string, v: string) => { mem[k] = v; } } : opt.storage;
  const d: EnvDeps = {
    cfg: CONFIG.env, live: opt.live !== false, storage,
    now: () => t,
    setTimer: (fn, ms) => { const k = ++id; if (ms !== CONFIG.env.timeoutMs) log.push(ms); timers.set(k, { at: t + ms, fn }); return k; },
    clearTimer: (k) => { timers.delete(k as number); },
    fetch: (url, init) => {
      calls++; inflight++; maxInflight = Math.max(maxInflight, inflight);
      const p = opt.fetchImpl ? opt.fetchImpl(url, init, calls) : okRes();
      return p.finally(() => { inflight--; });
    }
  };
  const store = createEnvStore(d);
  const flush = async () => { for (let i = 0; i < 20; i++) await Promise.resolve(); await new Promise((r) => setImmediate(r)); };
  /* Tua giờ: chạy các hẹn giờ đến hạn theo thứ tự */
  const advance = async (ms: number) => {
    const end = t + ms;
    for (;;) {
      let nk = -1, na = Infinity;
      for (const [k, v] of timers) if (v.at <= end && v.at < na) { na = v.at; nk = k; }
      if (nk < 0) break;
      const tm = timers.get(nk)!; timers.delete(nk); t = Math.max(t, tm.at); tm.fn(); await flush();
    }
    t = end;
  };
  return { store, mem, log, timers, advance, flush, get calls() { return calls; }, get maxInflight() { return maxInflight; }, setNow: (v: number) => { t = v; }, get now() { return t; } };
}

test('(a) thành công: ok, ghi đệm, hẹn refreshMs', async () => {
  const r = rig();
  r.store.start(); await r.flush();
  assert.equal(r.store.status(), 'ok');
  assert.equal(r.store.data!.temp, 25.2);
  assert.ok(r.mem[CONFIG.env.storeKey]);
  assert.equal(r.log[r.log.length - 1], 600000);
});
test('(b) lỗi: lùi mũ 60k..300k, thành công thì về 60k', async () => {
  let bad = true;
  const r = rig({ fetchImpl: () => (bad ? fail() : okRes()) });
  r.store.start(); await r.flush();
  assert.equal(r.store.status(), 'offline');
  await r.advance(60000); await r.advance(120000); await r.advance(240000); await r.advance(300000);
  assert.deepEqual(r.log, [60000, 120000, 240000, 300000, 300000]);
  bad = false; await r.advance(300000);
  assert.equal(r.store.status(), 'ok');
  bad = true; r.log.length = 0;
  await r.advance(600000);   // tới lần lấy kế tiếp, lỗi
  assert.equal(r.log[r.log.length - 1], 60000);
});
test('(c) có số liệu rồi lỗi mãi: ok tới khi quá staleMs thì stale, data giữ', async () => {
  let bad = false;
  const r = rig({ fetchImpl: () => (bad ? fail() : okRes()) });
  r.store.start(); await r.flush();
  bad = true;
  await r.advance(600000);
  assert.equal(r.store.status(), 'ok');
  r.setNow(OBS + CONFIG.env.staleMs);
  assert.equal(r.store.status(), 'ok');
  r.setNow(OBS + CONFIG.env.staleMs + 1);
  assert.equal(r.store.status(), 'stale');
  assert.equal(r.store.data!.temp, 25.2);
});
test('(d) HTTP 429 và JSON hỏng là lỗi, không ném', async () => {
  const r1 = rig({ fetchImpl: () => Promise.resolve({ ok: false, json: () => Promise.resolve(FIX) }) });
  r1.store.start(); await r1.flush();
  assert.equal(r1.store.status(), 'offline');
  const r2 = rig({ fetchImpl: () => Promise.resolve({ ok: true, json: () => Promise.reject(new SyntaxError('x')) }) });
  r2.store.start(); await r2.flush();
  assert.equal(r2.store.status(), 'offline');
  const r3 = rig({ fetchImpl: () => Promise.resolve({ ok: true, json: () => Promise.resolve({}) }) });
  r3.store.start(); await r3.flush();
  assert.equal(r3.store.status(), 'offline');
});
test('(e) fetch treo: sau timeoutMs bị hủy, tính là lỗi', async () => {
  let sig: AbortSignal | undefined;
  const r = rig({ fetchImpl: (u, init) => { sig = init?.signal; return new Promise((_, rej) => { sig?.addEventListener('abort', () => rej(new Error('abort'))); }); } });
  r.store.start(); await r.flush();
  assert.equal(r.store.status(), 'loading');
  await r.advance(CONFIG.env.timeoutMs);
  assert.equal(sig!.aborted, true);
  assert.equal(r.store.status(), 'offline');
});
test('(f) ẩn tab: không lấy; hiện lại: đúng 1 lời gọi', async () => {
  const r = rig();
  r.store.setVisible(false);
  r.store.start(); await r.flush();
  assert.equal(r.calls, 0);
  await r.advance(3600000);
  assert.equal(r.calls, 0);
  r.store.setVisible(true); await r.flush();
  assert.equal(r.calls, 1);
});
test('(g) hai refresh liền nhau chỉ một fetch', async () => {
  const r = rig();
  const a = r.store.refresh(), b = r.store.refresh();
  await Promise.all([a, b]);
  assert.equal(r.calls, 1);
  assert.equal(r.maxInflight, 1);
});
test('(h) bộ nhớ đệm', async () => {
  const seed = rig(); seed.store.start(); await seed.flush();
  const cached = seed.mem[CONFIG.env.storeKey];
  let release: () => void = () => {};
  const r = rig({ fetchImpl: () => new Promise((res) => { release = () => res({ ok: true, json: () => Promise.resolve(FIX) }); }) });
  r.mem[CONFIG.env.storeKey] = cached;
  r.store.start();
  assert.notEqual(r.store.data, null);
  release(); await r.flush();
  for (const bad of ['{', '{"temp":"x"}']) {
    const q = rig({ live: false }); q.mem[CONFIG.env.storeKey] = bad;
    assert.doesNotThrow(() => q.store.start());
    assert.equal(q.store.data, null);
  }
  const n = rig({ storage: null }); n.store.start(); await n.flush();
  assert.equal(n.store.status(), 'ok');
  const th = rig({ storage: { getItem: () => null, setItem: () => { throw new Error('đầy'); } } }); th.store.start(); await th.flush();
  assert.equal(th.store.status(), 'ok');
});
test('(i) live=false không bao giờ fetch', async () => {
  const r = rig({ live: false });
  r.store.start(); await r.store.refresh(); await r.advance(3600000);
  assert.equal(r.calls, 0);
  assert.equal(r.store.status(), 'loading');
});
test('(j) onChange và inject', async () => {
  const r = rig();
  let n = 0; r.store.onChange(() => { n++; });
  r.store.start(); await r.flush();
  assert.ok(n >= 1);
  const before = n, d0 = r.store.data!;
  r.store.inject(null, true);
  assert.equal(n, before + 1);
  assert.equal(r.store.status(), 'offline');
  r.store.inject({ ...d0, obs: r.now });
  assert.equal(r.store.status(), 'ok');
});

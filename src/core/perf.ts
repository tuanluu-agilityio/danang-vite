import { CONFIG } from '../config';

/* =====================================================================
   ĐO HIỆU NĂNG (D-018) — thời gian khung cho HUD và thời gian CPU từng hệ con cho test:perf.
   - tick(): mỗi khung một lần, ghi khoảng cách hai khung vào vòng mẫu (HUD: trung bình, p95, max).
   - start()/lap(): đo từng bước trong vòng animate; chỉ chạy khi `on` (URL có ?test&perf), tắt thì trả 0 ngay.
   Không cấp phát mỗi khung: vòng mẫu và mảng sắp xếp là Float32Array cấp sẵn.
   ===================================================================== */
const ring = new Float32Array(CONFIG.perf.hudSamples), sorted = new Float32Array(CONFIG.perf.hudSamples);
let ri = 0, win = 0, last = 0;
const out = { avg: 0, p95: 0, max: 0 };

export const perf = {
  on: false,                            // đo từng bước trong vòng animate
  sums: {} as Record<string, number>,   // ms cộng dồn theo tên bước
  maxs: {} as Record<string, number>,   // ms lớn nhất theo tên bước
  frames: 0,                            // số khung kể từ reset()
  maxFrame: 0,                          // ms — khoảng cách hai khung lớn nhất kể từ reset()
  firstFrameMs: 0,                      // ms — từ lúc điều hướng tới khung hình đầu
  start() { return this.on ? performance.now() : 0; },
  /* Cộng thời gian từ t0 vào bước `name`, trả mốc mới để đo bước kế tiếp */
  lap(name: string, t0: number) {
    if (!this.on) return 0;
    const t = performance.now(), d = t - t0;
    this.sums[name] = (this.sums[name] || 0) + d;
    if (d > (this.maxs[name] || 0)) this.maxs[name] = d;
    return t;
  },
  tick(now: number) {
    if (last) {
      const d = now - last;
      ring[ri] = d; ri = (ri + 1) % ring.length; win = Math.min(win + 1, ring.length);
      if (d > this.maxFrame) this.maxFrame = d;
    } else this.firstFrameMs = now;
    last = now; this.frames++;
  },
  /* Thống kê các khung từ lần gọi trước (tối đa cả vòng mẫu); dùng lại một object */
  stats() {
    const n = win; win = 0;
    if (!n) return out;
    let s = 0;
    for (let k = 0; k < n; k++) { const v = ring[(ri - 1 - k + ring.length) % ring.length]; sorted[k] = v; s += v; }
    const v = sorted.subarray(0, n).sort();
    out.avg = s / n; out.p95 = v[Math.min(n - 1, Math.floor(n * 0.95))]; out.max = v[n - 1];
    return out;
  },
  reset() { this.sums = {}; this.maxs = {}; this.frames = 0; this.maxFrame = 0; }
};

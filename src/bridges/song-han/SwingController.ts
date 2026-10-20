import { clamp, smooth } from '../../common/math';
import type { SongHanConfig } from '../../config';

/* [swingController] state machine quay cầu, phát event swingStart / swingOpen / swingClosed / stateChange */
export const SWING_STATES = ['CLOSED', 'STOP_TRAFFIC', 'UNLOCK', 'ROTATING_OPEN', 'OPEN', 'ROTATING_CLOSE', 'LOCK', 'REOPEN_TRAFFIC'] as const;
export type SwingState = typeof SWING_STATES[number];
export type Signal = 'green' | 'amber' | 'red';

/* Vận tốc góc hình thang: tăng dần – đều – giảm dần (a = phần thời gian tăng/giảm tốc) */
function trapezoidEase(u: number, a = 0.22) {
  u = clamp(u, 0, 1); const vmax = 1 / (1 - a);
  if (u < a) return vmax * u * u / (2 * a);
  if (u < 1 - a) return vmax * (u - a / 2);
  return 1 - vmax * (1 - u) * (1 - u) / (2 * a);
}
export class SwingController extends EventTarget {
  cfg: SongHanConfig;
  state: SwingState = 'CLOSED';
  t = 0;
  speed = 30;                     // hệ số tăng tốc so với thời gian thật
  angle = 0; lift = 0; pin = 1; barrier = 0;
  signal: Signal = 'green';
  closeAsked = false;
  fromTour = false;               // quay do Tour kích hoạt: đóng ngay khi tàu buồm qua hết luồng
  spanClear: () => boolean = () => true;
  canClose: () => boolean = () => true;

  constructor(cfg: SongHanConfig) {
    super();
    this.cfg = cfg;
  }
  get busy() { return this.state !== 'CLOSED'; }
  get allowEntry() { return this.state === 'CLOSED' || (this.state === 'REOPEN_TRAFFIC' && this.signal === 'green'); }
  start(speed?: number) {
    if (this.state !== 'CLOSED') return false;
    if (speed) this.speed = speed;
    this.go('STOP_TRAFFIC'); this.dispatchEvent(new Event('swingStart'));
    return true;
  }
  requestClose() { if (this.state === 'OPEN') this.closeAsked = true; }
  go(s: SwingState) {
    this.state = s; this.t = 0;
    if (s === 'OPEN') this.closeAsked = false;
    this.dispatchEvent(new CustomEvent<SwingState>('stateChange', { detail: s }));
    if (s === 'OPEN') this.dispatchEvent(new Event('swingOpen'));
    if (s === 'CLOSED') this.dispatchEvent(new Event('swingClosed'));
  }
  update(dt: number) {
    if (this.state === 'CLOSED') return;
    const T = this.cfg.timing, rot = Math.PI / 2 * this.cfg.rotateDir;
    this.t += dt * this.speed;
    const k = (d: number) => clamp(this.t / d, 0, 1);
    switch (this.state) {
      case 'STOP_TRAFFIC':
        this.signal = this.t < T.amber ? 'amber' : 'red';
        this.barrier = smooth(clamp((this.t - T.amber) / T.barrier, 0, 1));
        if (this.t > T.amber + T.barrier && (this.spanClear() || this.t > T.stopMax)) this.go('UNLOCK');
        break;
      case 'UNLOCK': {            // rút chốt rồi nâng nhẹ nhịp khỏi gối đầu cánh
        const u = k(T.unlock);
        this.pin = 1 - smooth(clamp(u * 2, 0, 1)); this.lift = smooth(clamp(u * 2 - 1, 0, 1)) * this.cfg.lift;
        if (u >= 1) this.go('ROTATING_OPEN');
        break;
      }
      case 'ROTATING_OPEN':
        this.angle = trapezoidEase(k(T.rotate)) * rot;
        if (k(T.rotate) >= 1) this.go('OPEN');
        break;
      case 'OPEN':
        if ((this.t > T.openHold || this.closeAsked) && this.canClose()) this.go('ROTATING_CLOSE');
        break;
      case 'ROTATING_CLOSE':
        this.angle = (1 - trapezoidEase(k(T.rotate))) * rot;
        if (k(T.rotate) >= 1) { this.angle = 0; this.go('LOCK'); }
        break;
      case 'LOCK': {              // hạ nhịp xuống gối rồi đẩy chốt khóa
        const u = k(T.lock);
        this.lift = (1 - smooth(clamp(u * 2, 0, 1))) * this.cfg.lift; this.pin = smooth(clamp(u * 2 - 1, 0, 1));
        if (u >= 1) this.go('REOPEN_TRAFFIC');
        break;
      }
      case 'REOPEN_TRAFFIC':
        this.barrier = 1 - smooth(k(T.barrier));
        this.signal = this.t >= T.barrier ? 'green' : 'red';
        if (this.t > T.barrier + 2) { this.barrier = 0; this.signal = 'green'; this.go('CLOSED'); }
        break;
    }
  }
}

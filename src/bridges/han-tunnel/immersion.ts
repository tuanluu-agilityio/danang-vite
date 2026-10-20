import { clamp, lerp, smooth } from '../../common/math';

/* [immersion] Mô phỏng dìm đốt hầm số 3 (đốt giữa, 120 m): state machine như SwingController của Cầu sông Hàn.
   IDLE → FLOAT_IN (tàu kéo dắt đốt nổi vào) → POSITION (neo định vị) → BALLAST (bơm nước dằn, chìm dần)
   → PULL_JOINT (kích kéo áp khít, gioăng GINA bị nén) → BACKFILL (lấp cát, phủ đá hộc) → DONE.
   Phát event immerseStart / immerseDone / stateChange. */
export const IM_STATES = ['IDLE', 'FLOAT_IN', 'POSITION', 'BALLAST', 'PULL_JOINT', 'BACKFILL', 'DONE'] as const;
export type ImState = typeof IM_STATES[number];

/* Thời gian thật từng giai đoạn (giây), chia cho hệ số tăng tốc */
const DUR: Record<Exclude<ImState, 'IDLE'>, number> = { FLOAT_IN: 70, POSITION: 45, BALLAST: 100, PULL_JOINT: 40, BACKFILL: 70, DONE: 15 };
/* Độ cao nâng của đốt khi nổi: nóc đốt cách mặt nước +0,8 m; đốt cao 8,5 m, nóc lúc hoàn thiện ở −7,6 m ⇒ nâng ≈ 8,4 m */
export const FLOAT_LIFT = 8.4, APPROACH = 230, STANDOFF = 26, GAP = 3.2;

export class ImmersionController extends EventTarget {
  state: ImState = 'IDLE';
  t = 0;
  speed = 10;
  /* đầu ra, vị trí đốt 3 so với vị trí hoàn thiện */
  zOff = 0; lift = 0; gap = 0;
  fill = 1;        // 0 → 1: mức lấp đá hộc phủ nóc
  tugs = 0;        // 0: đang kéo; 1: tàu kéo đã rút về
  jack = 0;        // 0 → 1: kích kéo đang co
  fromTour = false;
  get busy() { return this.state !== 'IDLE'; }
  start(speed?: number) {
    if (this.state !== 'IDLE') return false;
    if (speed) this.speed = speed;
    this.go('FLOAT_IN'); this.dispatchEvent(new Event('immerseStart'));
    return true;
  }
  go(s: ImState) {
    this.state = s; this.t = 0;
    this.dispatchEvent(new CustomEvent<ImState>('stateChange', { detail: s }));
    if (s === 'IDLE') this.dispatchEvent(new Event('immerseDone'));
  }
  /* Tư thế hoàn thiện (khi không mô phỏng) */
  private rest() { this.zOff = 0; this.lift = 0; this.gap = 0; this.fill = 1; this.tugs = 1; this.jack = 0; }
  update(dt: number) {
    if (this.state === 'IDLE') { this.rest(); return; }
    this.t += dt * this.speed;
    const k = clamp(this.t / DUR[this.state], 0, 1);
    switch (this.state) {
      case 'FLOAT_IN':
        this.zOff = lerp(-APPROACH, -STANDOFF, smooth(k)); this.lift = FLOAT_LIFT; this.gap = GAP; this.fill = 0; this.tugs = 0; this.jack = 0;
        if (k >= 1) this.go('POSITION');
        break;
      case 'POSITION':
        this.zOff = lerp(-STANDOFF, 0, smooth(k)); this.lift = FLOAT_LIFT + Math.sin(this.t * 0.7) * 0.05 * (1 - k);
        if (k >= 1) this.go('BALLAST');
        break;
      case 'BALLAST':
        this.zOff = 0; this.lift = lerp(FLOAT_LIFT, 0.5, smooth(k)); this.tugs = smooth(clamp(k * 2, 0, 1));
        if (k >= 1) this.go('PULL_JOINT');
        break;
      case 'PULL_JOINT':
        this.lift = lerp(0.5, 0, smooth(clamp(k * 2, 0, 1))); this.gap = lerp(GAP, 0, smooth(clamp((k - 0.2) / 0.8, 0, 1)));
        this.jack = Math.sin(Math.PI * clamp(k, 0, 1)); this.tugs = 1;
        if (k >= 1) this.go('BACKFILL');
        break;
      case 'BACKFILL':
        this.lift = 0; this.gap = 0; this.jack = 0; this.fill = smooth(k);
        if (k >= 1) this.go('DONE');
        break;
      case 'DONE':
        this.fill = 1;
        if (k >= 1) { this.rest(); this.go('IDLE'); }
        break;
    }
  }
}

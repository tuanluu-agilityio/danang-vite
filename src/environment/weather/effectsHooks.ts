import { CONFIG } from '../../config';
import { weatherFx } from '../../core/shared';
import { setAdsSuppressed } from '../riverfront';
import type { SwingController } from '../../bridges/song-han/SwingController';
import type { WeatherParams } from './state';

/* ===== [weather] Vận hành khi bão (mục 5.3): hệ số cho giao thông, thuyền, trình diễn, cầu quay, quảng cáo =====
   Chỉ ghi vào weatherFx (core/shared.ts) và gọi hook; KHÔNG đổi nút người dùng (lifeOn, show.on, nút quảng cáo): hết bão tự trả về lựa chọn cũ.
   Cấm lưu thông và khoá quay cầu theo TRẠNG THÁI `closed` (preset Bão / kịch bản), không theo ngưỡng gió — "theo thông báo của thành phố".
   Mặc định (closed = false, mưa = gió = 0) mọi giá trị trung tính: clear = boatAway = 0, showAllowed = true, swingBlocked = false. */
let swing: SwingController | null = null, adsOff = false;

/* Gán predicate khoá quay cho SwingController (gọi một lần ở main.ts) */
export function attachSwing(ctrl: SwingController) {
  swing = ctrl; ctrl.canStart = () => !weatherFx.swingBlocked;
}

const toward = (v: number, goal: number, step: number) => (v < goal ? Math.min(goal, v + step) : Math.max(goal, v - step));

export function updateHooks(c: WeatherParams, dt: number) {
  const O = CONFIG.weather.ops, closed = c.closed;
  weatherFx.clear = toward(weatherFx.clear, closed ? 1 : 0, dt / O.clearSec);          // xe dọn dần trong clearSec, mở lại thì hiện dần
  weatherFx.boatAway = toward(weatherFx.boatAway, closed ? 1 : 0, dt / O.boatAwaySec);   // thuyền về bến
  weatherFx.showAllowed = !closed && c.rain <= O.showMaxRain && c.wind <= O.showMaxWind;
  weatherFx.swingBlocked = closed;
  if (closed && swing && swing.state === 'OPEN') swing.requestClose();                // đang mở thì đóng sớm
  if (closed !== adsOff) { adsOff = closed; setAdsSuppressed(closed); }                // quảng cáo tắt tạm, hết bão trả lại lựa chọn người dùng
}

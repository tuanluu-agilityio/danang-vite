import { canvas, controls } from '../core/renderer';
import { sun } from '../core/lights';
import { dayNight } from '../core/dayNight';
import { t, onChange } from '../i18n';
import { show, showLabel } from '../bridges/dragon/effects';
import type { ThuanPhuocBridge } from '../bridges/thuan-phuoc';
import type { TranThiLyBridge } from '../bridges/tran-thi-ly';
import type { SongHanBridge } from '../bridges/song-han';
import type { HanTunnel } from '../bridges/han-tunnel';
import type { BridgeKey } from '../views/presets';
import { cam, keys } from '../views/state';
import { setView } from '../views/camera';
import { tour, tourBox, initTourCaption, renderTourCaption, exitTour } from '../views/tour';
import { selectBridge, syncShowLine, toggle } from './panel';
import { setupAudioUI } from './audioUI';
import { setupSwingUI, swingRender } from './swingUI';
import { setupHrUI, hrRender } from './hrUI';

/* Gắn mọi bảng điều khiển: ngày/đêm, bóng đổ, trình diễn, chọn cầu, góc nhìn, nút bật/tắt từng cầu, bàn phím */
export function setupUI({ thuanPhuoc, tranThiLy, songHan, hanTunnel }: { thuanPhuoc: ThuanPhuocBridge; tranThiLy: TranThiLyBridge; songHan: SongHanBridge; hanTunnel: HanTunnel }) {
  const btnNight = document.getElementById('btnNight'), slider = document.getElementById('timeSlider') as HTMLInputElement;
  const btnShow = document.getElementById('btnShow'), btnShadow = document.getElementById('btnShadow');
  const syncNight = () => {
    const isNight = dayNight.target > 0.5;
    btnNight.setAttribute('aria-pressed', String(isNight));
    btnNight.textContent = t(isNight ? 'toDay' : 'toNight');
  };
  btnNight.addEventListener('click', () => { dayNight.target = dayNight.target > 0.5 ? 0 : 1; slider.value = String(dayNight.target * 100); syncNight(); });
  slider.addEventListener('input', () => { dayNight.target = Number(slider.value) / 100; syncNight(); });
  syncNight();
  setupAudioUI();
  // Đổi ngôn ngữ: cập nhật các chữ do code sinh ra
  onChange(() => {
    syncNight();
    if (!tourBox().hidden && tour.shown >= 0) renderTourCaption(tour.shown);
    document.getElementById('showState').textContent = showLabel();
    swingRender(); hrRender();
  });
  btnShow.addEventListener('click', () => {
    show.on = !show.on; show.t = 0; btnShow.setAttribute('aria-pressed', String(show.on)); syncShowLine();
    if (show.on && dayNight.target < 0.5) { dayNight.target = 1; slider.value = '100'; syncNight(); } // trình diễn diễn ra lúc 21:00
  });
  btnShadow.addEventListener('click', () => {
    sun.castShadow = !sun.castShadow; btnShadow.setAttribute('aria-pressed', String(sun.castShadow));
  });
  document.querySelectorAll<HTMLElement>('[data-view]').forEach((b) => b.addEventListener('click', () => setView(b.dataset.view)));
  document.querySelectorAll<HTMLElement>('[data-bridge]').forEach((b) => b.addEventListener('click', () => selectBridge(b.dataset.bridge as BridgeKey, true)));
  // Cầu Thuận Phước
  toggle('btnTpLife', (on) => thuanPhuoc.setLifeVisible(on));
  // Cầu Trần Thị Lý: pattern LED và các phần bật/tắt
  toggle('btnTtlLife', (on) => tranThiLy.setLifeVisible(on));
  toggle('btnTtlPeople', (on) => tranThiLy.setPeopleVisible(on));
  toggle('btnTtlNvt', (on) => tranThiLy.setNvtVisible(on));
  document.getElementById('ttlPatternSel').addEventListener('change', (e) => tranThiLy.setPattern(Number((e.target as HTMLSelectElement).value)));
  // Cầu sông Hàn
  setupSwingUI(songHan, toggle);
  // Hầm vượt sông Hàn
  setupHrUI(hanTunnel, toggle);
  window.addEventListener('keydown', (e) => {
    if (cam.mode !== 'walk') return;
    const k = e.key.toLowerCase(); keys.add(k);
    if (k.startsWith('arrow')) e.preventDefault();
  });
  window.addEventListener('keyup', (e) => keys.delete(e.key.toLowerCase()));
  window.addEventListener('blur', () => keys.clear());
  controls.addEventListener('start', () => { if (cam.mode === 'fly' && !cam.flight.then) { cam.mode = 'orbit'; controls.enabled = true; } });
  // Tự điều khiển khi đang tour: kéo, cuộn hoặc nhấn Esc
  initTourCaption();
  canvas.addEventListener('pointerdown', exitTour);
  canvas.addEventListener('wheel', exitTour, { passive: true });
  window.addEventListener('keydown', (e) => { if (e.key === 'Escape') exitTour(); });
}

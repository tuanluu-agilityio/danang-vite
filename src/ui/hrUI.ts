import * as THREE from 'three';
import { camera, controls } from '../core/renderer';
import { t } from '../i18n';
import type { HanTunnel } from '../bridges/han-tunnel';
import type { ImState } from '../bridges/han-tunnel/immersion';
import { CUT_LABELS } from '../bridges/han-tunnel/cutaway';
import { VIEWS, type ViewPreset } from '../views/presets';
import { cam } from '../views/state';
import { flyTo } from '../views/camera';
import { activeTour, exitTour, tourHooks } from '../views/tour';
import type { Toggle } from './panel';

/* Hầm vượt sông Hàn: mặt cắt địa chất + nhãn 3D, mô phỏng dìm đốt hầm, camera theo dõi, móc điểm dừng của Tour */
export let hrRender = () => {};
const labels: { el: HTMLElement; pos: THREE.Vector3; key: string }[] = [];
let box: HTMLElement | null = null, section = false;
const _v = new THREE.Vector3();

export function setupHrUI(hr: HanTunnel, toggle: Toggle) {
  const ctrl = hr.ctrl;
  const secBtn = document.getElementById('btnHrSection'), imBtn = document.getElementById('btnHrImmerse') as HTMLButtonElement;
  const stateEl = document.getElementById('hrImState'), speedSel = document.getElementById('hrImSpeed') as HTMLSelectElement;
  let follow = true, saved: ViewPreset | null = null;
  box = document.getElementById('hrLabels');
  for (const L of CUT_LABELS) {
    const el = document.createElement('div'); el.className = 'hr-label'; box.appendChild(el);
    labels.push({ el, pos: new THREE.Vector3(...L.pos), key: L.key });
  }
  const setSection = (on: boolean) => {
    hr.cutaway.setSection(on); section = on; secBtn.setAttribute('aria-pressed', String(on)); box.hidden = !on; hrRender();
  };
  hrRender = () => {
    labels.forEach((l) => { l.el.textContent = t(l.key); });
    stateEl.textContent = t('im_' + ctrl.state);
    imBtn.textContent = t(ctrl.state === 'IDLE' ? 'hrImmerseBtn' : 'hrImBusy');
    imBtn.disabled = ctrl.state !== 'IDLE';
  };
  secBtn.addEventListener('click', () => setSection(!hr.cutaway.section));
  toggle('btnHrLife', (on) => hr.setLifeVisible(on));
  toggle('btnHrFollow', (on) => { follow = on; });
  speedSel.addEventListener('change', () => { ctrl.speed = Number(speedSel.value); });
  imBtn.addEventListener('click', () => ctrl.start(Number(speedSel.value)));
  // chọn góc nhìn "Mặt cắt dọc" thì tự bật mặt cắt; chọn công trình khác thì tắt
  document.querySelector('[data-view="hrCutaway"]').addEventListener('click', () => setSection(true));
  for (const v of ['hrOverview', 'hrPortalW', 'hrPortalE', 'hrDrive', 'hrGallery']) document.querySelector(`[data-view="${v}"]`).addEventListener('click', () => setSection(false));
  document.querySelectorAll<HTMLElement>('[data-bridge]').forEach((b) => b.addEventListener('click', () => { if (b.dataset.bridge !== 'hr') setSection(false); }));
  ctrl.addEventListener('stateChange', (e) => {
    const s = (e as CustomEvent<ImState>).detail;
    hrRender();
    if (s === 'IDLE') ctrl.fromTour = false;
  });
  ctrl.addEventListener('immerseStart', () => {
    if (follow && !ctrl.fromTour && cam.mode !== 'tour' && cam.flight.then !== 'tour') {
      saved = { pos: camera.position.toArray(), target: controls.target.toArray() }; exitTour(); flyTo(VIEWS.hrSimCam);
    }
  });
  ctrl.addEventListener('immerseDone', () => { if (follow && saved && cam.mode !== 'tour') flyTo(saved); saved = null; });
  // Tour Hầm sông Hàn: mỗi điểm dừng đặt lại mặt cắt/nội thất; điểm có cờ immerse thì chạy mô phỏng dìm ở 30×
  tourHooks.stop = (s) => {
    if (activeTour.key !== 'hrStops') return;
    setSection(!!s.cutaway); hr.setForceInterior(!!s.interior);
    if (s.immerse && ctrl.state === 'IDLE') { speedSel.value = '30'; ctrl.fromTour = true; ctrl.start(30); }
  };
  tourHooks.exit = () => {
    if (activeTour.key !== 'hrStops') return;
    setSection(false); hr.setForceInterior(false);
  };
  hrRender();
}
/* Đặt nhãn 3D lên màn hình mỗi khung hình khi mặt cắt đang bật */
export function updateHrUI(cm: THREE.Camera) {
  if (!section || !box) return;
  const w = window.innerWidth, h = window.innerHeight;
  for (const l of labels) {
    _v.copy(l.pos).project(cm);
    const vis = _v.z < 1 && Math.abs(_v.x) < 1.05 && Math.abs(_v.y) < 1.05;
    l.el.style.visibility = vis ? 'visible' : 'hidden';
    if (vis) l.el.style.transform = `translate(${((_v.x + 1) / 2 * w).toFixed(0)}px, ${((1 - _v.y) / 2 * h - 22).toFixed(0)}px) translateX(-50%)`;
  }
}

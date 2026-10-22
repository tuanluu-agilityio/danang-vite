import { CONFIG } from '../config';
import { t, onChange } from '../i18n';
import { getWeather } from '../environment/weather';
import type { BridgeKey as ImpactKey } from '../environment/weather/impact';
import type { PresetName } from '../environment/weather/state';
import type { Toggle } from './panel';
import { canvas, camera, controls } from '../core/renderer';
import { followScenario } from '../views/camera';
import { cam } from '../views/state';
import { exitTour } from '../views/tour';
import { narration } from '../audio/narration';

const NAME_KEY: Record<ImpactKey, string> = { dragon: 'bridgeDragon', thuanPhuoc: 'bridgeTp', tranThiLy: 'bridgeTtl', songHan: 'bridgeSh', hanTunnel: 'bridgeHr' };
const cm = (m: number) => (m * 100).toFixed(1);

/* Thời tiết: chọn preset (Hiện trạng / Nắng hè / Mưa / Gió mùa / Bão), thanh cường độ 0–100 %, thẻ "Ảnh hưởng tới cầu" (vẽ lại 2 lần/giây khi đang mở) */
export function setupWeatherUI(toggle: Toggle) {
  const sel = document.getElementById('weatherSel') as HTMLSelectElement, k = document.getElementById('weatherK') as HTMLInputElement, val = document.getElementById('weatherKVal');
  const card = document.getElementById('wxImpact');
  const showK = () => { val.textContent = `${k.value}%`; };
  sel.addEventListener('change', () => getWeather()?.setPreset(sel.value as PresetName));
  k.addEventListener('input', () => { showK(); getWeather()?.setIntensity(Number(k.value) / 100); });
  showK();

  let sig = '', timer = 0;
  const div = (cls: string, text?: string) => { const d = document.createElement('div'); d.className = cls; if (text !== undefined) d.textContent = text; return d; };
  /* Mỗi công trình một ô: tên + trạng thái lưu thông, gió tại mặt cầu (m/s, cấp), hiệu ứng chính. Chỉ dựng lại DOM khi nội dung đổi. */
  const render = () => {
    const w = getWeather(); if (!w) return;
    const rows = w.impact().map((r) => {
      const lines: string[] = [];
      if (r.key === 'hanTunnel') lines.push(t('wxTunnelOk'));
      else {
        let wind = t('wxWindDeck', { v: r.windDeck.toFixed(1), b: r.level });
        if (r.windTop > 0) wind += ' · ' + t('wxWindTop', { v: r.windTop.toFixed(1) });
        lines.push(wind);
        if (r.effects.includes('rainWindCable')) lines.push(t('wxRainWind'));
        if (r.effects.includes('thermal')) lines.push(t('wxThermal', { cm: cm(r.expand) }));
        if (r.sag > 0.005) lines.push(t('wxSag', { cm: cm(r.sag) }));
        if (r.effects.includes('swingLocked')) lines.push(t('wxSwingBlocked'));
        if (r.status === 'closed') lines.push(t('wxClosedNote'));
      }
      return { key: r.key, status: r.status, lines };
    });
    const next = JSON.stringify(rows);
    if (next === sig) return;
    sig = next;
    card.replaceChildren(...rows.map((r) => {
      const item = div('wx-item'), head = div('wx-head'), st = div('wx-st ' + r.status, t(r.status === 'closed' ? 'wxClosed' : 'wxOpen'));
      head.append(div('', t(NAME_KEY[r.key])), st);
      item.append(head, ...r.lines.map((l, i) => div(i === 0 && r.key !== 'hanTunnel' ? 'wx-wind' : '', l)));
      return item;
    }), div('wx-note', t('wxImpactNote', { k: CONFIG.weather.swayExaggeration })));
  };
  setupScenarioUI();
  toggle('btnWxImpact', (on) => {
    card.hidden = !on; clearInterval(timer);
    if (on) { sig = ''; render(); timer = window.setInterval(render, 500); }
  });
  onChange(() => { sig = ''; if (!card.hidden) render(); });
}

/* Kịch bản bão (mục 6): nút bật/dừng, khung chú thích wxS1…wxS8, thanh tiến độ. Camera bay theo hành trình kịch bản (chế độ 'storm') cho tới khi người xem kéo chuột, cuộn,
   nhấn Esc hoặc chọn góc nhìn — khi đó chỉ camera được trả lại, thời tiết vẫn chạy hết (giống exitTour). Nút "Dừng kịch bản" trả ngay preset cũ. */
function setupScenarioUI() {
  const btn = document.getElementById('btnWxStorm'), box = document.getElementById('wxScenario'), text = document.getElementById('wxScenarioText');
  const time = document.getElementById('wxScenarioTime'), bar = document.getElementById('wxScenarioBar');
  const sc = () => getWeather()?.scenario;
  let capKey: string | null = null, timer = 0;
  const label = () => { btn.textContent = t(sc()?.running ? 'wxStormStop' : 'wxStormRun'); };
  const showCap = () => { text.textContent = capKey ? t(capKey, { k: CONFIG.weather.swayExaggeration }) : ''; };
  /* Giọng đọc mốc hiện tại (clip wxStorm-<mốc>, `npm run gen:voice`). Đang xem Tour thì nhường giọng cho Tour. Lời đọc mốc 4 nói cố định "hai mươi lần" = swayExaggeration */
  const speak = () => { const s = sc(); if (s?.running && capKey && !document.body.classList.contains('touring')) narration.play('wxStorm', s.step); };
  const clock = () => {
    const s = sc(); if (!s) return;
    const mmss = (v: number) => `${Math.floor(v / 60)}:${String(Math.floor(v % 60)).padStart(2, '0')}`, tt = Math.min(s.t, s.duration);   // độ dài thật: kéo dài theo giọng đọc
    time.textContent = `${mmss(tt)} / ${mmss(s.duration)}`; bar.style.width = `${(tt / s.duration * 100).toFixed(1)}%`;
  };
  const wire = () => {
    const s = sc(); if (!s) return;
    s.on.caption = (key) => { capKey = key; showCap(); if (key) speak(); else narration.stop(); };
    s.on.end = () => { clearInterval(timer); box.hidden = true; document.body.classList.remove('wxrun'); btn.setAttribute('aria-pressed', 'false'); label(); };
  };
  btn.addEventListener('click', () => {
    const s = sc(); if (!s) return;
    wire();
    if (s.running) { s.stop(true); return; }
    exitTour(); narration.stop(); s.start({ from: { pos: camera.position, target: controls.target } }); followScenario();
    box.hidden = false; document.body.classList.add('wxrun'); btn.setAttribute('aria-pressed', 'true'); label(); clock();
    clearInterval(timer); timer = window.setInterval(clock, 250);
  });
  const release = () => { if (!sc()?.running) return; sc().releaseCamera(); if (cam.mode === 'storm') { cam.mode = 'orbit'; controls.enabled = true; } };   // trả ngay để thao tác kéo đầu tiên đã điều khiển được
  canvas.addEventListener('pointerdown', release);
  canvas.addEventListener('wheel', release, { passive: true });
  window.addEventListener('keydown', (e) => { if (e.key === 'Escape') release(); });
  document.querySelectorAll('[data-view]').forEach((b) => b.addEventListener('click', release));
  label();
  // Đổi ngôn ngữ / bật giọng: đọc lại mốc hiện tại (đăng ký sau Tour — syncNarration của Tour dừng giọng khi không ở chế độ Tour)
  onChange(() => { label(); showCap(); speak(); });
  narration.onChange(speak);
}

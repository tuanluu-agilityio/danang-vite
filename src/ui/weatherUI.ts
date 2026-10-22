import { CONFIG } from '../config';
import { t, onChange } from '../i18n';
import { getWeather } from '../environment/weather';
import type { BridgeKey as ImpactKey } from '../environment/weather/impact';
import type { PresetName } from '../environment/weather/state';
import type { Toggle } from './panel';

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
  toggle('btnWxImpact', (on) => {
    card.hidden = !on; clearInterval(timer);
    if (on) { sig = ''; render(); timer = window.setInterval(render, 500); }
  });
  onChange(() => { sig = ''; if (!card.hidden) render(); });
}

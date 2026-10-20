import { setHeartsEnabled, setHeartsMode, setAdsEnabled } from '../environment/riverfront';
import type { Toggle } from './panel';

/* Hai bờ sông Hàn: bật/tắt đèn trái tim, chọn Đối đáp / Đồng bộ, bật/tắt quảng cáo */
export function setupRiverfrontUI(toggle: Toggle) {
  toggle('btnRfHearts', (on) => setHeartsEnabled(on));
  toggle('btnRfAds', (on) => setAdsEnabled(on));
  document.getElementById('rfHeartsMode').addEventListener('change', (e) => setHeartsMode((e.target as HTMLSelectElement).value as 'duet' | 'sync'));
}

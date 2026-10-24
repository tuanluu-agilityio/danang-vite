import { t, onChange } from '../i18n';
import { quality, type QualityMode } from '../core/quality';

const TIER_KEY = { high: 'qHigh', medium: 'qMed', low: 'qLow' } as const;

/* Ô "Chất lượng hình" (D-018): Tự động / Cao / Trung bình / Thấp. Ở chế độ Tự động, chữ của lựa chọn ghi kèm mức đang dùng ("Tự động · Trung bình") */
export function setupQualityUI() {
  const sel = document.getElementById('qualitySel') as HTMLSelectElement, auto = sel.querySelector<HTMLOptionElement>('option[value="auto"]');
  sel.value = quality.mode;
  sel.addEventListener('change', () => quality.set(sel.value as QualityMode));
  let shown = '';
  const label = () => {
    const txt = quality.mode === 'auto' ? `${t('qAuto')} · ${t(TIER_KEY[quality.current().tier as keyof typeof TIER_KEY])}` : t('qAuto');
    if (txt !== shown) { auto.textContent = txt; shown = txt; }
  };
  onChange(() => { shown = ''; label(); });
  setInterval(label, 1000);   // bậc Tự động đổi tối đa mỗi vài giây: cập nhật chữ 1 lần/giây là đủ
  label();
}

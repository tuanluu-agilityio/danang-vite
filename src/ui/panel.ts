import { t } from '../i18n';
import { show } from '../bridges/dragon/effects';
import { BRIDGE_HOME, type BridgeKey } from '../views/presets';
import { setView } from '../views/camera';

/* Chọn cầu: đổi danh sách góc nhìn, bảng thông số, và bay tới cầu đó */
const SPEC_KEYS: Record<BridgeKey, Record<string, string>> = {
  dragon: { specLen: 'lengthVal', specWidth: 'widthVal', specSpanLabel: 'span', specSpanVal: 'spanVal', specNote: 'note', lanes: '6' },
  tp: { specLen: 'tpLengthVal', specWidth: 'tpWidthVal', specSpanLabel: 'tpSpan', specSpanVal: 'tpSpanVal', specNote: 'tpNote', lanes: '4' },
  ttl: { specLen: 'ttlLengthVal', specWidth: 'ttlWidthVal', specSpanLabel: 'ttlSpan', specSpanVal: 'ttlSpanVal', specNote: 'ttlNote', lanes: '6' },
  sh: { specLen: 'shLengthVal', specWidth: 'shWidthVal', specSpanLabel: 'shSpan', specSpanVal: 'shSpanVal', specNote: 'shNote', lanes: '2' },
  hr: { specLen: 'hrLengthVal', specWidth: 'hrWidthVal', specSpanLabel: 'hrSpan', specSpanVal: 'hrSpanVal', specNote: 'hrNote', lanes: '6' },
  sw: { specLen: 'swLengthVal', specWidth: 'swWidthVal', specSpanLabel: 'swSpan', specSpanVal: 'swSpanVal', specNote: 'swNote', lanes: '—' }   // bảng thông số riêng cho Vòng quay: giai đoạn 7
};
let currentBridge: BridgeKey = 'dragon';

/* Dòng trạng thái phun lửa/nước chỉ hiện khi đang chọn Cầu Rồng hoặc màn trình diễn đang chạy */
export function syncShowLine() { document.getElementById('showLine').hidden = !(currentBridge === 'dragon' || show.on); }
export function selectBridge(name: BridgeKey, fly: boolean) {
  document.querySelectorAll<HTMLElement>('[data-bridge]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.bridge === name)));
  document.querySelectorAll<HTMLElement>('[data-list]').forEach((l) => { l.hidden = l.dataset.list !== name; });
  currentBridge = name; syncShowLine();
  const keys = SPEC_KEYS[name];
  for (const [id, key] of Object.entries(keys)) {
    if (id === 'lanes') { document.getElementById('specLanes').textContent = key; continue; }
    const el = document.getElementById(id); el.dataset.i18n = key; el.textContent = t(key);
  }
  if (fly) setView(BRIDGE_HOME[name]);
}
/* Nút bật/tắt dạng aria-pressed */
export type Toggle = (id: string, fn: (on: boolean) => void) => void;
export const toggle: Toggle = (id, fn) => {
  const b = document.getElementById(id); b.addEventListener('click', () => {
    const on = b.getAttribute('aria-pressed') !== 'true'; b.setAttribute('aria-pressed', String(on)); fn(on);
  });
};

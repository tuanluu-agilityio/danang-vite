import { getLang } from '../i18n';
import { audio } from '.';

/* ============================ Giọng thuyết trình của Tour ============================
   Clip mp3 dựng sẵn bằng `npm run gen:voice` (public/voice/<ngôn ngữ>/<khóa>-<i>.mp3).
   manifest.json cho biết ngôn ngữ nào có giọng và mỗi clip dài bao lâu; Tour dựa vào đó để
   kéo dài đoạn bay cho tới khi đọc xong. Ngôn ngữ chưa có clip thì Tour chạy lặng như cũ. */
interface Clip { d: number; h: string }
type Manifest = Record<string, Record<string, Clip[]>>;

const BASE = import.meta.env.BASE_URL;
const KEY = 'cauRong.voice';
const load = () => { try { return localStorage.getItem(KEY); } catch { return null; } };

let manifest: Manifest = {};
let enabled = load() !== 'off';
let current: HTMLAudioElement | null = null;
let prefetched: HTMLAudioElement | null = null;
let wasPlaying = false;
const listeners: (() => void)[] = [];
const emit = () => listeners.forEach((fn) => fn());

const clipOf = (key: string, i: number): Clip | undefined => manifest[getLang()]?.[key]?.[i];
const urlOf = (key: string, i: number) => `${BASE}voice/${getLang()}/${key}-${i}.mp3`;

export const narration = {
  /* Ngôn ngữ hiện tại có giọng thuyết trình */
  get available() { return !!manifest[getLang()]; },
  get enabled() { return enabled; },
  /* Bật và có giọng: lúc đó Tour mới phải chờ giọng đọc */
  get active() { return enabled && !!manifest[getLang()]; },
  /* Thời lượng clip (giây); null nếu không có giọng cho điểm dừng này */
  duration(key: string, i: number): number | null { return this.active ? clipOf(key, i)?.d ?? null : null; },
  onChange(fn: () => void) { listeners.push(fn); },
  async init() {
    try {
      const res = await fetch(`${BASE}voice/manifest.json`);
      if (res.ok) manifest = await res.json();
    } catch { /* không có giọng: Tour vẫn chạy lặng */ }
    emit();
  },
  setEnabled(on: boolean) {
    enabled = on;
    try { localStorage.setItem(KEY, on ? 'on' : 'off'); } catch { /* bỏ qua */ }
    if (!on) this.stop();
    emit();
  },
  play(key: string, i: number) {
    this.stop();
    if (!this.active || !clipOf(key, i)) return;
    const url = urlOf(key, i);
    const el = prefetched && prefetched.dataset.url === url ? prefetched : new Audio(url);
    el.dataset.url = url; prefetched = null;
    current = el;
    audio.duck(true);
    el.addEventListener('ended', () => { if (current === el) { current = null; wasPlaying = false; audio.duck(false); } });
    el.play().then(() => { wasPlaying = true; }, () => { if (current === el) { current = null; audio.duck(false); } });   // autoplay bị chặn: bỏ qua
    // tải sẵn điểm dừng kế tiếp để khi chuyển không bị khựng
    if (clipOf(key, i + 1)) { prefetched = new Audio(urlOf(key, i + 1)); prefetched.dataset.url = urlOf(key, i + 1); prefetched.preload = 'auto'; }
  },
  stop() {
    if (current) { current.pause(); current = null; }
    wasPlaying = false; audio.duck(false);
  }
};

/* Tab bị ẩn thì Tour đứng yên: tạm dừng giọng và phát tiếp khi quay lại */
document.addEventListener('visibilitychange', () => {
  if (!current) return;
  if (document.hidden) { wasPlaying = !current.paused; current.pause(); } else if (wasPlaying) current.play().catch(() => {});
});

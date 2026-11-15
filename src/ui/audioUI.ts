import { audio } from '../audio';
import { narration } from '../audio/narration';
import { onChange } from '../i18n';
import { CONFIG } from '../config';

/* Nút nhạc nền: trình duyệt chỉ cho phát âm thanh sau khi người xem bấm */
export function setupAudioUI() {
  const btn = document.getElementById('btnMusic'), vol = document.getElementById('volSlider') as HTMLInputElement;
  const KEY = 'cauRong.music';
  const save = (k: string, v: string) => { try { localStorage.setItem(k, v); } catch { /* bỏ qua */ } };
  const load = (k: string) => { try { return localStorage.getItem(k); } catch { return null; } };
  const sync = () => { btn.setAttribute('aria-pressed', String(audio.on)); vol.disabled = !audio.on; };
  const savedVol = Number(load(KEY + '.vol'));
  if (savedVol >= 0 && load(KEY + '.vol') !== null) vol.value = String(savedVol);
  audio.setVolume(Number(vol.value) / 100 * 0.9);
  btn.addEventListener('click', () => {
    if (audio.on) audio.stop(); else audio.start();
    save(KEY, audio.on ? 'on' : 'off'); sync();
  });
  vol.addEventListener('change', () => { if (document.body.classList.contains('explore')) vol.blur(); });   // đang khám phá: trả phím mũi tên cho điều khiển
  vol.addEventListener('input', () => { audio.setVolume(Number(vol.value) / 100 * 0.9); save(KEY + '.vol', vol.value); });
  // Nhạc bật ở thao tác đầu tiên của người xem (trình duyệt không cho phát trước đó): lần trước đã bật, hoặc chưa từng chọn (D-046: nhạc là một phần trải nghiệm;
  // ai đã tắt thì giữ tắt). ?test chỉ theo lựa chọn đã lưu để các test cũ không tự có âm thanh
  const auto = CONFIG.music.autoStart && load(KEY) === null && !new URLSearchParams(location.search).has('test');
  if (load(KEY) === 'on' || auto) {
    const arm = (e: Event) => {
      const el = e.target as Element;
      if (el && el.closest && el.closest('#btnMusic')) return;
      window.removeEventListener('pointerdown', arm, true); window.removeEventListener('keydown', arm, true);
      if (!audio.on) { audio.start(); sync(); }
    };
    window.addEventListener('pointerdown', arm, true); window.addEventListener('keydown', arm, true);
  }
  // Thuyết minh Tour: chỉ bật được ở ngôn ngữ đã có giọng đọc
  const voice = document.getElementById('btnVoice') as HTMLButtonElement;
  const syncVoice = () => { voice.disabled = !narration.available; voice.setAttribute('aria-pressed', String(narration.active)); };
  voice.addEventListener('click', () => narration.setEnabled(!narration.enabled));
  narration.onChange(syncVoice); onChange(syncVoice); syncVoice();
  document.addEventListener('visibilitychange', () => { if (document.hidden) audio.pause(); else audio.resume(); });
  sync();
}

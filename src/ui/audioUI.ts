import { audio } from '../audio';
import { narration } from '../audio/narration';
import { onChange } from '../i18n';
import { CONFIG } from '../config';

/* Nút nhạc nền + âm lượng chung. Nút chỉ bật / tắt NHẠC (audio.setMusic); hiệu ứng (tiếng xe, phun lửa / nước, sông, mưa gió, còi) chạy theo âm thanh chung
   (audio.start) và không tắt theo nhạc; thanh trượt là âm lượng chung, kéo về 0 để tắt hết. Trình duyệt chỉ cho phát âm thanh sau thao tác đầu tiên của người xem */
export function setupAudioUI() {
  const btn = document.getElementById('btnMusic'), vol = document.getElementById('volSlider') as HTMLInputElement;
  const KEY = 'cauRong.music';
  const save = (k: string, v: string) => { try { localStorage.setItem(k, v); } catch { /* bỏ qua */ } };
  const load = (k: string) => { try { return localStorage.getItem(k); } catch { return null; } };
  const sync = () => { btn.setAttribute('aria-pressed', String(audio.on && audio.musicOn)); vol.disabled = !audio.on; };
  const test = new URLSearchParams(location.search).has('test');
  audio.setMusic(test || load(KEY) === null ? CONFIG.music.autoStart || test : load(KEY) === 'on');   // lựa chọn đã lưu; chưa từng chọn: theo autoStart
  const savedVol = Number(load(KEY + '.vol'));
  if (savedVol >= 0 && load(KEY + '.vol') !== null) vol.value = String(savedVol);
  audio.setVolume(Number(vol.value) / 100 * 0.9);
  btn.addEventListener('click', () => {
    if (!audio.on) { audio.setMusic(true); audio.start(); } else audio.setMusic(!audio.musicOn);   // lần bấm đầu cũng mở âm thanh chung
    save(KEY, audio.musicOn ? 'on' : 'off'); sync();
  });
  vol.addEventListener('change', () => { if (document.body.classList.contains('explore')) vol.blur(); });   // đang khám phá: trả phím mũi tên cho điều khiển
  vol.addEventListener('input', () => { audio.setVolume(Number(vol.value) / 100 * 0.9); save(KEY + '.vol', vol.value); });
  // Âm thanh chung mở ở thao tác đầu tiên của người xem (trình duyệt không cho phát trước đó); nhạc có kêu hay không theo lựa chọn ở trên (D-046: ai đã tắt nhạc thì
  // chỉ nghe hiệu ứng). ?test: chỉ khi lần trước đã bật, để các test cũ không tự có âm thanh
  if (test ? load(KEY) === 'on' : true) {
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

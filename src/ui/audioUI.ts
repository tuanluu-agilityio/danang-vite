import { audio } from '../audio';

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
  vol.addEventListener('input', () => { audio.setVolume(Number(vol.value) / 100 * 0.9); save(KEY + '.vol', vol.value); });
  // Lần trước đã bật nhạc: phát lại ngay khi người xem chạm vào trang lần đầu
  if (load(KEY) === 'on') {
    const arm = (e: Event) => {
      const el = e.target as Element;
      if (el && el.closest && el.closest('#btnMusic')) return;
      window.removeEventListener('pointerdown', arm, true); window.removeEventListener('keydown', arm, true);
      if (!audio.on) { audio.start(); sync(); }
    };
    window.addEventListener('pointerdown', arm, true); window.addEventListener('keydown', arm, true);
  }
  document.addEventListener('visibilitychange', () => { if (document.hidden) audio.pause(); else audio.resume(); });
  sync();
}

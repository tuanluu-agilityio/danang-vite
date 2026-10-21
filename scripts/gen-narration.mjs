/* Sinh giọng thuyết trình cho Tour: scripts/narration/<ngôn ngữ>.json → public/voice/<ngôn ngữ>/<khóa>-<i>.mp3
   Giọng đọc lấy từ dịch vụ đọc văn bản của Microsoft Edge (qua gói msedge-tts, không cần tài khoản).
   Chỉ tạo lại clip có lời thoại hoặc giọng thay đổi; manifest.json lưu thời lượng để Tour chờ giọng đọc xong.
   Chạy: npm run gen:voice  (thêm --force để tạo lại tất cả) */
import { MsEdgeTTS, OUTPUT_FORMAT } from 'msedge-tts';
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile, stat } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const VOICES = { vi: 'vi-VN-HoaiMyNeural', en: 'en-US-AriaNeural', ru: 'ru-RU-SvetlanaNeural' };
const BYTES_PER_SEC = 48000 / 8;     // định dạng audio-24khz-48kbitrate-mono-mp3 (CBR 48 kbps)
const force = process.argv.includes('--force');
const outDir = join(root, 'public', 'voice');
const manifestPath = join(outDir, 'manifest.json');

const exists = (p) => stat(p).then(() => true, () => false);
const prevManifest = JSON.parse(await readFile(manifestPath, 'utf8').catch(() => '{}'));

async function synth(voice, text) {
  for (let attempt = 1; ; attempt++) {
    try {
      const tts = new MsEdgeTTS();
      await tts.setMetadata(voice, OUTPUT_FORMAT.AUDIO_24KHZ_48KBITRATE_MONO_MP3);
      const { audioStream } = tts.toStream(text);
      const chunks = [];
      for await (const c of audioStream) chunks.push(c);
      tts.close?.();
      const buf = Buffer.concat(chunks);
      if (buf.length < 2000) throw new Error('âm thanh rỗng');
      return buf;
    } catch (e) {
      if (attempt >= 3) throw e;
      console.warn(`  thử lại (${attempt}): ${e.message}`);
    }
  }
}

const manifest = {};
let made = 0, kept = 0;
for (const [lang, voice] of Object.entries(VOICES)) {
  const script = JSON.parse(await readFile(join(root, 'scripts', 'narration', `${lang}.json`), 'utf8'));
  await mkdir(join(outDir, lang), { recursive: true });
  manifest[lang] = {};
  for (const [key, lines] of Object.entries(script)) {
    manifest[lang][key] = [];
    for (let i = 0; i < lines.length; i++) {
      const file = join(outDir, lang, `${key}-${i}.mp3`);
      const hash = createHash('sha1').update(voice + '\n' + lines[i]).digest('hex').slice(0, 10);
      const prev = prevManifest[lang]?.[key]?.[i];
      if (!force && prev && prev.h === hash && await exists(file)) { manifest[lang][key].push(prev); kept++; continue; }
      const buf = await synth(voice, lines[i]);
      await writeFile(file, buf);
      manifest[lang][key].push({ d: Math.round(buf.length / BYTES_PER_SEC * 10) / 10, h: hash });
      made++; console.log(`${lang}/${key}-${i}.mp3  ${manifest[lang][key][i].d}s`);
    }
  }
}
await writeFile(manifestPath, JSON.stringify(manifest) + '\n');
console.log(`Xong: tạo mới ${made}, giữ nguyên ${kept}.`);
process.exit(0);

/* Thêm khóa dịch của "Hai bờ sông Hàn" (đèn trái tim, quảng cáo, góc nhìn) vào cả 9 file src/i18n/locales/*.json.
   node scripts/add-riverfront-locales.mjs */
import { readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const dir = join(dirname(fileURLToPath(import.meta.url)), '..', 'src', 'i18n', 'locales');
const K = ['vRfHearts', 'vRfBank', 'rfHearts', 'rfHeartsMode', 'rfHeartsDuet', 'rfHeartsSync', 'rfAds'];
const T = {
  vi: ['Trái tim hai bờ (đêm)', 'Dạo bờ sông Bạch Đằng', 'Đèn trái tim', 'Hai tòa trái tim', 'Đối đáp', 'Đồng bộ', 'Quảng cáo'],
  en: ['Heart towers (night)', 'Stroll the Bach Dang riverside', 'Heart lights', 'Two heart towers', 'Call & response', 'Synchronised', 'Advertising'],
  ko: ['양안의 하트 (야간)', '박당 강변 산책', '하트 조명', '하트 두 건물', '주고받기', '동기화', '광고'],
  ja: ['両岸のハート（夜）', 'バックダン川岸を散策', 'ハートのライト', 'ハートの2棟', '掛け合い', '同期', '広告'],
  zh: ['两岸爱心（夜景）', '漫步白藤路滨江', '爱心灯光', '两座爱心大楼', '对唱', '同步', '广告'],
  th: ['หัวใจสองฝั่ง (กลางคืน)', 'เดินเล่นริมแม่น้ำถนนบั๊กดั่ง', 'ไฟหัวใจ', 'อาคารหัวใจสองหลัง', 'โต้ตอบ', 'พร้อมกัน', 'โฆษณา'],
  ar: ['قلبا الضفتين (ليلاً)', 'نزهة على كورنيش باخ دانغ', 'أضواء القلب', 'البرجان القلبيان', 'تبادلي', 'متزامن', 'الإعلانات'],
  hi: ['दोनों किनारों के दिल (रात)', 'बाख दांग नदी-किनारे की सैर', 'दिल की रोशनी', 'दो दिल वाली इमारतें', 'सवाल-जवाब', 'समकालिक', 'विज्ञापन'],
  ru: ['Сердца двух берегов (ночь)', 'Прогулка по набережной Бать Данг', 'Огни-сердца', 'Две башни-сердца', 'Перекличка', 'Синхронно', 'Реклама']
};
for (const [code, vals] of Object.entries(T)) {
  const file = join(dir, `${code}.json`);
  const json = JSON.parse(await readFile(file, 'utf8'));
  K.forEach((k, i) => { json[k] = vals[i]; });
  await writeFile(file, JSON.stringify(json, null, 2) + '\n');
  console.log(code, K.length, 'khóa');
}

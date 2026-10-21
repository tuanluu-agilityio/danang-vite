/* Thêm khóa dịch của "Thời tiết" (tên preset, cường độ) vào cả 9 file src/i18n/locales/*.json. Giai đoạn 2; các giai đoạn sau thêm khóa vào cùng mảng K/T.
   node scripts/add-weather-locales.mjs */
import { readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const dir = join(dirname(fileURLToPath(import.meta.url)), '..', 'src', 'i18n', 'locales');
const K = ['weather', 'wxNow', 'wxSummer', 'wxRain', 'wxMonsoon', 'wxStorm', 'wxIntensity'];
const T = {
  vi: ['Thời tiết', 'Hiện trạng', 'Nắng hè', 'Mưa', 'Gió mùa', 'Bão', 'Cường độ'],
  en: ['Weather', 'As is', 'Summer sun', 'Rain', 'Monsoon wind', 'Storm', 'Intensity'],
  ko: ['날씨', '현재 상태', '여름 햇볕', '비', '계절풍', '태풍', '강도'],
  ja: ['天気', '現状', '夏の日差し', '雨', '季節風', '台風', '強さ'],
  zh: ['天气', '现状', '夏日晴天', '下雨', '季风', '台风', '强度'],
  th: ['สภาพอากาศ', 'สภาพปัจจุบัน', 'แดดฤดูร้อน', 'ฝน', 'ลมมรสุม', 'พายุ', 'ความรุนแรง'],
  ar: ['الطقس', 'الوضع الحالي', 'شمس الصيف', 'مطر', 'رياح موسمية', 'عاصفة', 'الشدة'],
  hi: ['मौसम', 'वर्तमान स्थिति', 'गर्मी की धूप', 'बारिश', 'मानसूनी हवा', 'तूफ़ान', 'तीव्रता'],
  ru: ['Погода', 'Как сейчас', 'Летний зной', 'Дождь', 'Муссон', 'Шторм', 'Интенсивность']
};
for (const [code, vals] of Object.entries(T)) {
  const file = join(dir, `${code}.json`);
  const json = JSON.parse(await readFile(file, 'utf8'));
  K.forEach((k, i) => { json[k] = vals[i]; });
  await writeFile(file, JSON.stringify(json, null, 2) + '\n');
  console.log(code, K.length, 'khóa');
}

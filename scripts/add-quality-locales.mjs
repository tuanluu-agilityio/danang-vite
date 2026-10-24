/* Thêm khóa dịch của ô "Chất lượng hình" (tối ưu hiệu năng, D-018) vào cả 9 file src/i18n/locales/*.json.
   node scripts/add-quality-locales.mjs */
import { readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const dir = join(dirname(fileURLToPath(import.meta.url)), '..', 'src', 'i18n', 'locales');
const K = ['quality', 'qAuto', 'qHigh', 'qMed', 'qLow'];
const T = {
  vi: ['Chất lượng hình', 'Tự động', 'Cao', 'Trung bình', 'Thấp'],
  en: ['Graphics quality', 'Auto', 'High', 'Medium', 'Low'],
  ko: ['그래픽 품질', '자동', '높음', '중간', '낮음'],
  ja: ['画質', '自動', '高', '中', '低'],
  zh: ['画质', '自动', '高', '中', '低'],
  th: ['คุณภาพกราฟิก', 'อัตโนมัติ', 'สูง', 'ปานกลาง', 'ต่ำ'],
  ar: ['جودة الرسوم', 'تلقائي', 'عالية', 'متوسطة', 'منخفضة'],
  hi: ['ग्राफ़िक्स गुणवत्ता', 'स्वचालित', 'उच्च', 'मध्यम', 'निम्न'],
  ru: ['Качество графики', 'Авто', 'Высокое', 'Среднее', 'Низкое']
};
for (const [code, vals] of Object.entries(T)) {
  const file = join(dir, `${code}.json`);
  const json = JSON.parse(await readFile(file, 'utf8'));
  K.forEach((k, i) => { json[k] = vals[i]; });
  await writeFile(file, JSON.stringify(json, null, 2) + '\n');
  console.log(code, K.length, 'khóa');
}

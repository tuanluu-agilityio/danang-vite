/* Thêm khóa dịch của "Thời tiết" (tên preset, cường độ) vào cả 9 file src/i18n/locales/*.json. Giai đoạn 2; các giai đoạn sau thêm khóa vào cùng mảng K/T.
   node scripts/add-weather-locales.mjs */
import { readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const dir = join(dirname(fileURLToPath(import.meta.url)), '..', 'src', 'i18n', 'locales');
const K = ['weather', 'wxNow', 'wxSummer', 'wxRain', 'wxMonsoon', 'wxStorm', 'wxIntensity', 'sWeather', 'swingWeather'];   // GĐ5: sWeather = dòng trạng thái trình diễn Cầu Rồng; swingWeather = lý do không quay Cầu sông Hàn
const T = {
  vi: ['Thời tiết', 'Hiện trạng', 'Nắng hè', 'Mưa', 'Gió mùa', 'Bão', 'Cường độ', 'tạm dừng do thời tiết', 'Không quay cầu: thời tiết xấu, cấm theo thông báo của thành phố'],
  en: ['Weather', 'As is', 'Summer sun', 'Rain', 'Monsoon wind', 'Storm', 'Intensity', 'paused due to weather', 'Bridge will not swing: bad weather, closed per city notice'],
  ko: ['날씨', '현재 상태', '여름 햇볕', '비', '계절풍', '태풍', '강도', '날씨로 인해 일시 중단', '다리를 회전하지 않음: 악천후, 시 공지에 따라 통제'],
  ja: ['天気', '現状', '夏の日差し', '雨', '季節風', '台風', '強さ', '悪天候のため一時停止', '橋は旋回しません：悪天候のため市の通知により通行止め'],
  zh: ['天气', '现状', '夏日晴天', '下雨', '季风', '台风', '强度', '因天气暂停', '桥梁不旋转：天气恶劣，按市政通知禁止通行'],
  th: ['สภาพอากาศ', 'สภาพปัจจุบัน', 'แดดฤดูร้อน', 'ฝน', 'ลมมรสุม', 'พายุ', 'ความรุนแรง', 'หยุดชั่วคราวเนื่องจากสภาพอากาศ', 'ไม่หมุนสะพาน: สภาพอากาศเลวร้าย ปิดตามประกาศของเมือง'],
  ar: ['الطقس', 'الوضع الحالي', 'شمس الصيف', 'مطر', 'رياح موسمية', 'عاصفة', 'الشدة', 'متوقف مؤقتًا بسبب الطقس', 'لن يدور الجسر: طقس سيئ، الإغلاق وفق إشعار المدينة'],
  hi: ['मौसम', 'वर्तमान स्थिति', 'गर्मी की धूप', 'बारिश', 'मानसूनी हवा', 'तूफ़ान', 'तीव्रता', 'मौसम के कारण अस्थायी रूप से रुका', 'पुल नहीं घूमेगा: खराब मौसम, शहर की सूचना के अनुसार बंद'],
  ru: ['Погода', 'Как сейчас', 'Летний зной', 'Дождь', 'Муссон', 'Шторм', 'Интенсивность', 'приостановлено из-за погоды', 'Мост не разводится: непогода, закрыт по объявлению города']
};
for (const [code, vals] of Object.entries(T)) {
  const file = join(dir, `${code}.json`);
  const json = JSON.parse(await readFile(file, 'utf8'));
  K.forEach((k, i) => { json[k] = vals[i]; });
  await writeFile(file, JSON.stringify(json, null, 2) + '\n');
  console.log(code, K.length, 'khóa');
}

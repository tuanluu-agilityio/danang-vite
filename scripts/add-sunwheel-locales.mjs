/* Thêm khóa dịch của Vòng quay Mặt Trời vào cả 9 file src/i18n/locales/*.json. Giai đoạn 3: nút chọn công trình, góc nhìn sw*, ô tốc độ quay, bảng thông số. Giai đoạn 4: ô show LED.
   Các giai đoạn sau (ngồi cabin, show LED, Tour) thêm khóa vào cuối file này. Số liệu có nguồn: 115 m, 64 cabin × 6 khách, ~15 phút/vòng, khai trương 18/7/2014, trước là Igosu 108.
   Đường kính ≈ 93 m là ước lượng. Hiện trạng: theo một số nguồn đã ngừng hoạt động từ 9/2025.
   node scripts/add-sunwheel-locales.mjs */
import { readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const dir = join(dirname(fileURLToPath(import.meta.url)), '..', 'src', 'i18n', 'locales');
const K3 = ['bridgeSw', 'vSwFront', 'vSwBase', 'vSwFromTTL', 'vSwNight', 'vSwTop', 'swWheelSpeed', 'swWheelStop', 'swWheelReal', 'swLengthVal', 'swWidthVal', 'swSpan', 'swSpanVal', 'swNote'];
const T3 = {
  vi: ['Vòng quay Mặt Trời', 'Chính diện', 'Dưới chân nhìn lên', 'Từ Cầu Trần Thị Lý', 'Ban đêm', 'Trên cao nhìn xuống', 'Tốc độ quay', 'Dừng', 'Thật (1×)',
    'Cao 115 m', '≈ 93 m (đường kính)', 'Cabin', '64 cabin × 6 khách · 15 phút/vòng',
    'Asia Park, khai trương 18/7/2014 (trước là Igosu 108, Nhật Bản). Theo một số nguồn đã ngừng hoạt động từ 9/2025; mô hình thể hiện lúc còn vận hành. Đường kính, bệ và tháp đỡ là ước lượng.'],
  en: ['Sun Wheel', 'Front view', 'From the base, looking up', 'From Tran Thi Ly Bridge', 'At night', 'Aerial, looking down', 'Rotation speed', 'Stopped', 'Real (1×)',
    '115 m tall', '≈ 93 m (diameter)', 'Cabins', '64 cabins × 6 passengers · 15 min/turn',
    'Asia Park, opened 18 July 2014 (formerly Igosu 108, Japan). Some sources report it closed in September 2025; the model shows it in operation. Diameter, base and support towers are estimates.'],
  ko: ['선 휠(태양의 관람차)', '정면', '아래에서 올려다보기', '쩐티리 다리에서', '야경', '위에서 내려다보기', '회전 속도', '정지', '실제(1×)',
    '높이 115 m', '≈ 93 m(지름)', '캐빈', '캐빈 64개 × 6명 · 한 바퀴 15분',
    '아시아 파크, 2014년 7월 18일 개장(전신은 일본의 이고수 108). 일부 자료에 따르면 2025년 9월부터 운영이 중단되었으며, 모델은 운영 당시의 모습입니다. 지름, 기단, 지지탑은 추정치입니다.'],
  ja: ['サンホイール（太陽の観覧車）', '正面', '足元から見上げる', 'チャン・ティ・リー橋から', '夜', '上空から見下ろす', '回転速度', '停止', '実速度（1×）',
    '高さ115 m', '≈ 93 m（直径）', 'ゴンドラ', 'ゴンドラ64基 × 6人 · 1周15分',
    'アジアパーク、2014年7月18日開業（前身は日本のイゴスー108）。一部の資料では2025年9月に営業を停止したとされ、モデルは稼働していた時の姿です。直径、基壇、支持塔は推定値です。'],
  zh: ['太阳摩天轮', '正面', '从脚下仰望', '从陈氏理桥', '夜景', '高空俯瞰', '转速', '停止', '实际（1×）',
    '高115米', '≈ 93米（直径）', '轿厢', '64个轿厢 × 6人 · 每圈15分钟',
    '亚洲公园，2014年7月18日开业（前身为日本的Igosu 108）。据部分资料，自2025年9月起已停止运营；模型展示的是运营时的样子。直径、基座和支撑塔架为估算值。'],
  th: ['ชิงช้าสวรรค์ซันวีล', 'มุมตรง', 'จากฐานมองขึ้น', 'จากสะพานเจิ่นถิลี้', 'ยามค่ำคืน', 'มุมสูงมองลง', 'ความเร็วการหมุน', 'หยุด', 'จริง (1×)',
    'สูง 115 ม.', '≈ 93 ม. (เส้นผ่านศูนย์กลาง)', 'กระเช้า', '64 กระเช้า × 6 คน · 15 นาที/รอบ',
    'เอเชียพาร์ค เปิดเมื่อ 18 ก.ค. 2014 (เดิมคือ Igosu 108 ในญี่ปุ่น) บางแหล่งข้อมูลระบุว่าหยุดให้บริการตั้งแต่ ก.ย. 2025 โมเดลแสดงช่วงที่ยังเปิดให้บริการ เส้นผ่านศูนย์กลาง ฐาน และหอรับน้ำหนักเป็นค่าประมาณ'],
  ar: ['عجلة الشمس', 'من الأمام', 'من القاعدة إلى الأعلى', 'من جسر تران ثي لي', 'ليلًا', 'من الأعلى إلى الأسفل', 'سرعة الدوران', 'متوقفة', 'حقيقية (1×)',
    'ارتفاعها 115 م', '≈ 93 م (القطر)', 'المقصورات', '64 مقصورة × 6 ركاب · 15 دقيقة للدورة',
    'آسيا بارك، افتُتحت في 18 يوليو 2014 (كانت سابقًا إيغوسو 108 في اليابان). تفيد بعض المصادر بأنها توقفت عن العمل منذ سبتمبر 2025؛ ويعرضها النموذج وهي تعمل. القطر والقاعدة وأبراج الدعم تقديرية.'],
  hi: ['सन व्हील', 'सामने से', 'आधार से ऊपर की ओर', 'ट्रान थी ली ब्रिज से', 'रात में', 'ऊपर से नीचे की ओर', 'घूमने की गति', 'रुका हुआ', 'वास्तविक (1×)',
    '115 मी ऊँचा', '≈ 93 मी (व्यास)', 'केबिन', '64 केबिन × 6 यात्री · 15 मिनट/चक्कर',
    'एशिया पार्क, 18 जुलाई 2014 को खुला (पहले जापान का Igosu 108)। कुछ स्रोतों के अनुसार सितंबर 2025 से बंद है; मॉडल इसे चालू अवस्था में दिखाता है। व्यास, आधार और सहारा टावर अनुमानित हैं।'],
  ru: ['Колесо Солнца', 'Спереди', 'От основания вверх', 'С моста Чан Тхи Ли', 'Ночью', 'Сверху вниз', 'Скорость вращения', 'Стоп', 'Реально (1×)',
    'Высота 115 м', '≈ 93 м (диаметр)', 'Кабины', '64 кабины × 6 человек · 15 минут на оборот',
    'Азия-парк, открыт 18 июля 2014 года (ранее Igosu 108 в Японии). По некоторым данным, с сентября 2025 года не работает; модель показана в рабочем состоянии. Диаметр, основание и опорные башни — оценки.']
};
for (const [code, vals] of Object.entries(T3)) {
  if (vals.length !== K3.length) throw new Error(`${code}: ${vals.length} khóa, cần ${K3.length}`);
  const file = join(dir, `${code}.json`);
  const json = JSON.parse(await readFile(file, 'utf8'));
  K3.forEach((k, i) => { json[k] = vals[i]; });
  await writeFile(file, JSON.stringify(json, null, 2) + '\n');
  console.log(code, 'GĐ3', K3.length, 'khóa');
}
/* Giai đoạn 4: ô chọn kiểu show LED đêm */
const K4 = ['swShow', 'swShowWhite', 'swShowPink', 'swShowRays', 'swShowHeart', 'swShowOff'];
const T4 = {
  vi: ['Đèn LED', 'Trắng', 'Hồng tím', 'Tia chạy', 'Nhịp tim', 'Tắt'],
  en: ['LED lights', 'White', 'Pink-violet', 'Running rays', 'Heartbeat', 'Off'],
  ko: ['LED 조명', '흰색', '핑크·보라', '퍼지는 빛줄기', '심장 박동', '끄기'],
  ja: ['LED照明', '白', 'ピンク・紫', '走る光線', 'ハートビート', 'オフ'],
  zh: ['LED灯光', '白色', '粉紫', '流动光线', '心跳', '关闭'],
  th: ['ไฟ LED', 'ขาว', 'ชมพูม่วง', 'ลำแสงวิ่ง', 'จังหวะหัวใจ', 'ปิด'],
  ar: ['أضواء LED', 'أبيض', 'وردي بنفسجي', 'أشعة متحركة', 'نبض القلب', 'إيقاف'],
  hi: ['एलईडी रोशनी', 'सफ़ेद', 'गुलाबी-बैंगनी', 'दौड़ती किरणें', 'दिल की धड़कन', 'बंद'],
  ru: ['Подсветка LED', 'Белая', 'Розово-фиолетовая', 'Бегущие лучи', 'Сердцебиение', 'Выкл.']
};
for (const [code, vals] of Object.entries(T4)) {
  if (vals.length !== K4.length) throw new Error(`${code}: ${vals.length} khóa, cần ${K4.length}`);
  const file = join(dir, `${code}.json`);
  const json = JSON.parse(await readFile(file, 'utf8'));
  K4.forEach((k, i) => { json[k] = vals[i]; });
  await writeFile(file, JSON.stringify(json, null, 2) + '\n');
  console.log(code, 'GĐ4', K4.length, 'khóa');
}

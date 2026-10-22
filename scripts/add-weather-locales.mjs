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
/* GĐ6: thẻ "Ảnh hưởng tới cầu" + 3 góc nhìn. Tham số: {v} m/s, {b} cấp Beaufort, {cm} cm, {k} hệ số phóng đại. Chữ về hầm giữ "phương án đề xuất". Kịch bản bão (wxS1…wxS8, wxStormRun…) thuộc GĐ7. */
const K6 = ['wxImpact', 'wxImpactNote', 'wxWindDeck', 'wxWindTop', 'wxOpen', 'wxClosed', 'wxClosedNote', 'wxThermal', 'wxSag', 'wxRainWind', 'wxSwingBlocked', 'wxSwingTour', 'wxTunnelOk', 'vWxRiverMouth', 'vWxTtlStays', 'vWxStreet'];
const T6 = {
  vi: ['Ảnh hưởng tới cầu', 'Mô phỏng trực quan, phóng đại ×{k}, số liệu tính gần đúng — không phải phân tích kết cấu.', 'Gió tại mặt cầu: {v} m/s · cấp {b}', 'đỉnh tháp {v} m/s', 'Mở', 'Cấm', 'Cấm lưu thông theo thông báo của thành phố', 'Giãn nở nhiệt toàn cầu {cm} cm (tính gần đúng)', 'Cáp chủ võng thêm {cm} cm (tính gần đúng)', 'Rung dây do mưa–gió (biện pháp: gân xoắn trên ống bọc, giảm chấn)', 'Không quay cầu', 'Tạm hoãn quay cầu do thời tiết.', 'Hầm vẫn lưu thông, không chịu gió, bơm thoát nước làm việc (phương án đề xuất)', 'Từ cửa sông (thời tiết)', 'Dọc dây văng (thời tiết)', 'Ngang tầm xe, đường ướt'],
  en: ['Impact on bridges', 'Visual simulation, exaggerated ×{k}, approximate figures — not a structural analysis.', 'Wind at deck: {v} m/s · force {b}', 'tower top {v} m/s', 'Open', 'Closed', 'Closed to traffic per city notice', 'Overall thermal expansion {cm} cm (approx.)', 'Main cable sags {cm} cm more (approx.)', 'Rain–wind cable vibration (countermeasures: helical ribs on the sheath, dampers)', 'Bridge will not swing', 'Bridge swing postponed due to weather.', 'Tunnel stays open, unaffected by wind, drainage pumps working (proposed option)', 'From the river mouth (weather)', 'Along the stay cables (weather)', 'Car height, wet road'],
  ko: ['교량에 미치는 영향', '시각적 시뮬레이션, ×{k} 과장, 근사치 — 구조 해석이 아닙니다.', '교량 상판 풍속: {v} m/s · {b}등급', '주탑 상단 {v} m/s', '통행', '통제', '시 공지에 따라 통행 금지', '전체 열팽창 {cm} cm (근사)', '주케이블 추가 처짐 {cm} cm (근사)', '비–바람 케이블 진동 (대책: 피복관의 나선 리브, 감쇠기)', '교량 회전 안 함', '날씨로 인해 교량 회전이 연기되었습니다.', '터널은 계속 통행, 바람 영향 없음, 배수 펌프 가동 (제안안)', '강 하구에서 (날씨)', '사장 케이블을 따라 (날씨)', '차량 눈높이, 젖은 도로'],
  ja: ['橋への影響', '視覚的なシミュレーション（×{k}に誇張）、数値は概算で、構造解析ではありません。', '橋面の風速：{v} m/s・{b}級', '主塔上端 {v} m/s', '通行可', '通行止め', '市の通知により通行止め', '全体の熱膨張 {cm} cm（概算）', '主ケーブルの垂れ下がり増 {cm} cm（概算）', '雨風によるケーブル振動（対策：被覆管の螺旋リブ、制振装置）', '橋は旋回しません', '悪天候のため橋の旋回を延期します。', 'トンネルは通行可能で風の影響なし、排水ポンプ稼働（提案案）', '河口から（天気）', '斜張ケーブルに沿って（天気）', '車の目線・濡れた路面'],
  zh: ['对桥梁的影响', '直观模拟，放大×{k}，数据为近似值——并非结构分析。', '桥面风速：{v} m/s · {b}级', '塔顶 {v} m/s', '通行', '禁行', '按市政通知禁止通行', '整体热胀 {cm} cm（近似）', '主缆额外下垂 {cm} cm（近似）', '风雨激振拉索（措施：护套螺旋肋、阻尼器）', '桥梁不旋转', '因天气原因暂缓旋转桥梁。', '隧道照常通行，不受风影响，排水泵运行（建议方案）', '从河口望去（天气）', '沿斜拉索（天气）', '车辆视角，湿滑路面'],
  th: ['ผลกระทบต่อสะพาน', 'การจำลองเพื่อการมองเห็น ขยาย ×{k} ตัวเลขเป็นค่าโดยประมาณ ไม่ใช่การวิเคราะห์โครงสร้าง', 'ลมที่พื้นสะพาน: {v} ม./วินาที · ระดับ {b}', 'ยอดเสา {v} ม./วินาที', 'เปิด', 'ปิด', 'ห้ามสัญจรตามประกาศของเมือง', 'การขยายตัวจากความร้อนรวม {cm} ซม. (โดยประมาณ)', 'สายเคเบิลหลักหย่อนเพิ่ม {cm} ซม. (โดยประมาณ)', 'สายสั่นจากฝนและลม (มาตรการ: ลายเกลียวบนท่อหุ้ม ตัวหน่วงการสั่น)', 'ไม่หมุนสะพาน', 'เลื่อนการหมุนสะพานเนื่องจากสภาพอากาศ', 'อุโมงค์ยังเปิดใช้ ไม่ได้รับผลจากลม ปั๊มระบายน้ำทำงาน (แนวทางที่เสนอ)', 'จากปากแม่น้ำ (สภาพอากาศ)', 'ตามแนวสายเคเบิลขึงเอียง (สภาพอากาศ)', 'ระดับสายตาคนขับ ถนนเปียก'],
  ar: ['تأثير الطقس على الجسور', 'محاكاة بصرية مبالغ فيها ×{k} وأرقام تقريبية — وليست تحليلًا إنشائيًا.', 'الرياح عند سطح الجسر: {v} م/ث · الدرجة {b}', 'قمة البرج {v} م/ث', 'مفتوح', 'مغلق', 'ممنوع المرور وفق إشعار المدينة', 'التمدد الحراري الكلي {cm} سم (تقريبي)', 'ترهل إضافي للكابل الرئيسي {cm} سم (تقريبي)', 'اهتزاز الكابلات بفعل المطر والرياح (الحلول: أضلاع حلزونية على الغلاف، مخمّدات)', 'لن يدور الجسر', 'تأجيل دوران الجسر بسبب الطقس.', 'النفق يبقى مفتوحًا ولا تؤثر فيه الرياح ومضخات التصريف تعمل (مقترح)', 'من مصب النهر (الطقس)', 'على امتداد الكابلات المائلة (الطقس)', 'من مستوى السيارة، طريق مبتل'],
  hi: ['पुलों पर प्रभाव', 'दृश्य अनुकरण, ×{k} बढ़ा-चढ़ाकर, आँकड़े अनुमानित — संरचनात्मक विश्लेषण नहीं।', 'पुल की सतह पर हवा: {v} मी/से · स्तर {b}', 'टावर शीर्ष {v} मी/से', 'खुला', 'बंद', 'शहर की सूचना के अनुसार आवागमन बंद', 'कुल ऊष्मीय प्रसार {cm} सेमी (अनुमानित)', 'मुख्य केबल {cm} सेमी और झुकी (अनुमानित)', 'बारिश–हवा से केबल कंपन (उपाय: आवरण पर सर्पिल उभार, डैम्पर)', 'पुल नहीं घूमेगा', 'मौसम के कारण पुल का घूमना स्थगित।', 'सुरंग चालू रहती है, हवा का असर नहीं, जल-निकासी पंप चालू (प्रस्तावित विकल्प)', 'नदी मुहाने से (मौसम)', 'तिरछे केबलों के साथ (मौसम)', 'कार की ऊँचाई से, गीली सड़क'],
  ru: ['Влияние на мосты', 'Наглядная симуляция, преувеличение ×{k}, цифры приблизительные — это не расчёт конструкции.', 'Ветер на уровне проезжей части: {v} м/с · {b} балл.', 'верх пилона {v} м/с', 'Открыт', 'Закрыт', 'Проезд закрыт по объявлению города', 'Общее тепловое расширение {cm} см (приблизительно)', 'Главный кабель провисает ещё на {cm} см (приблизительно)', 'Вибрация вант от дождя и ветра (меры: спиральные рёбра на оболочке, демпферы)', 'Мост не разводится', 'Развод моста отложен из-за погоды.', 'Тоннель открыт, ветер не влияет, дренажные насосы работают (предлагаемый вариант)', 'От устья реки (погода)', 'Вдоль вант (погода)', 'На уровне машины, мокрая дорога']
};
for (const [code, vals] of Object.entries(T)) {
  const file = join(dir, `${code}.json`);
  const json = JSON.parse(await readFile(file, 'utf8'));
  K.forEach((k, i) => { json[k] = vals[i]; });
  K6.forEach((k, i) => { json[k] = T6[code][i]; });
  await writeFile(file, JSON.stringify(json, null, 2) + '\n');
  console.log(code, K.length, 'khóa');
}

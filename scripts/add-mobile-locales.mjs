/* Thêm khóa dịch của giao diện điện thoại (feature/mobile-ui) vào cả 9 file src/i18n/locales/*.json.
   node scripts/add-mobile-locales.mjs */
import { readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const dir = join(dirname(fileURLToPath(import.meta.url)), '..', 'src', 'i18n', 'locales');
const K = ['settings', 'close', 'tourExitTouch', 'wxStormHintTouch', 'swRideHintTouch'];
const T = {
  vi: ['Cài đặt', 'Đóng', 'Chạm vào cảnh để thoát', 'Kéo màn hình để tự điều khiển camera — thời tiết vẫn chạy', 'Kéo để nhìn quanh · bấm lại nút để xuống cabin'],
  en: ['Settings', 'Close', 'Tap the scene to exit', 'Drag the scene to take the camera — the weather keeps running', 'Drag to look around · tap the button again to leave the cabin'],
  ko: ['설정', '닫기', '장면을 터치하면 종료됩니다', '화면을 드래그하면 카메라를 직접 조작합니다 — 날씨는 계속 진행됩니다', '드래그하여 둘러보기 · 버튼을 다시 누르면 캐빈에서 내립니다'],
  ja: ['設定', '閉じる', 'シーンをタップして終了', '画面をドラッグしてカメラを操作 — 天気はそのまま進行します', 'ドラッグして見回す · もう一度ボタンを押すとゴンドラから降ります'],
  zh: ['设置', '关闭', '点按场景即可退出', '拖动屏幕可自行控制相机——天气继续进行', '拖动可环顾四周 · 再次点按按钮可离开轿厢'],
  th: ['การตั้งค่า', 'ปิด', 'แตะที่ฉากเพื่อออก', 'ลากหน้าจอเพื่อควบคุมกล้องเอง — สภาพอากาศยังคงดำเนินต่อไป', 'ลากเพื่อมองรอบ ๆ · แตะปุ่มอีกครั้งเพื่อลงจากกระเช้า'],
  ar: ['الإعدادات', 'إغلاق', 'المس المشهد للخروج', 'اسحب الشاشة لتتحكم بالكاميرا بنفسك — يستمر الطقس في العمل', 'اسحب للنظر حولك · المس الزر مرة أخرى للنزول من الكابينة'],
  hi: ['सेटिंग्स', 'बंद करें', 'बाहर निकलने के लिए दृश्य को छूएँ', 'कैमरा खुद चलाने के लिए स्क्रीन को खींचें — मौसम चलता रहेगा', 'आसपास देखने के लिए खींचें · केबिन से उतरने के लिए बटन फिर से दबाएँ'],
  ru: ['Настройки', 'Закрыть', 'Коснитесь сцены, чтобы выйти', 'Проведите по экрану, чтобы управлять камерой — погода продолжает идти', 'Проведите, чтобы осмотреться · нажмите кнопку ещё раз, чтобы выйти из кабины']
};
for (const [code, vals] of Object.entries(T)) {
  const file = join(dir, `${code}.json`);
  const json = JSON.parse(await readFile(file, 'utf8'));
  K.forEach((k, i) => { json[k] = vals[i]; });
  await writeFile(file, JSON.stringify(json, null, 2) + '\n');
  console.log(code, K.length, 'khóa');
}

/* Thêm lời thuyết minh Tour Hầm vượt sông Hàn (hrStops) vào scripts/narration/{vi,en}.json — số, đơn vị, viết tắt viết bằng chữ.
   Sau đó chạy: npm run gen:voice */
import { readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const dir = join(dirname(fileURLToPath(import.meta.url)), 'narration');
const S = {
  vi: [
    'Đây là mô hình phương án hầm vượt sông Hàn, được đề xuất năm hai nghìn không trăm hai mươi lăm, và sẽ là hầm vượt sông thứ hai của Việt Nam. Tuyến hầm dài khoảng một nghìn sáu trăm bảy mươi mét, nối đường Đống Đa ở quận Hải Châu với đường Vân Đồn ở quận Sơn Trà, gồm sáu trăm mét hầm dìm dưới sông, ba trăm tám mươi mét hầm kín trên bờ và bốn trăm mười lăm mét hầm hở.',
    'Cửa hầm phía Tây nằm gần Thành Điện Hải, nên được làm thấp và ốp màu gạch thành cổ. Mái lam dài tám mươi mét giúp giảm chói khi xe từ ngoài nắng gắt chạy vào, hắt bớt nước mưa và cho gió bão xuyên qua.',
    'Mùa mưa bão, Đà Nẵng thường ngập khi mưa lớn gặp triều cường. Vì vậy đỉnh dốc trước cửa hầm được nâng cao hơn mặt phố một mét, kèm cửa phai trượt để chắn nước khi cần.',
    'Đây là mặt cắt dọc tuyến. Năm đốt hầm dìm, mỗi đốt dài một trăm hai mươi mét, nằm dưới đáy sông khoảng sáu mét, nóc hầm cách đáy sông ít nhất một mét. Hai bên bờ là hầm đào hở có tường vây, rồi đến hầm hở có độ dốc không quá bốn phẩy năm phần trăm.',
    'Mỗi đốt hầm được đúc sẵn trong ụ khô, bịt kín hai đầu rồi lai dắt ra sông. Người ta bơm nước dằn cho đốt hầm chìm xuống hào đã nạo vét, dùng kích kéo cho áp khít vào đốt bên cạnh, và gioăng cao su ghi-na giữ cho mối nối không thấm nước.',
    'Bên trong mỗi ống có ba làn: hai làn ô tô chạy sáu mươi ki-lô-mét một giờ và một làn xe máy sát lề phải, vì xe máy chiếm phần lớn lưu lượng ở Đà Nẵng. Quạt phản lực thông gió dọc hầm, còn đèn ở vùng ngưỡng sáng hơn để mắt kịp thích nghi.',
    'Giữa hai ống là hành lang thoát nạn được tăng áp để khói không lọt vào. Cứ một trăm mét có một cửa ngang màu xanh dẫn sang hành lang, còn hộp S O S và bình chữa cháy được đặt cách nhau năm mươi mét.',
    'Cửa phía Đông hướng về Sơn Trà, gợi hình sóng biển và làng chài với những chiếc thuyền thúng. Tổng mức đầu tư dự kiến sáu nghìn tám trăm tám mươi tỷ đồng, trong giai đoạn từ năm hai nghìn không trăm ba mươi mốt, giúp giảm tải cho Cầu Rồng và Cầu sông Hàn.'
  ],
  en: [
    'This is a model of the proposed Han River tunnel, put forward in two thousand and twenty-five, and it would be Vietnam\'s second river tunnel. About one thousand six hundred and seventy metres long, it links Dong Da Street in Hai Chau district with Van Don Street in Son Tra district: six hundred metres of immersed tunnel under the river, three hundred and eighty metres of cut-and-cover on the banks, and four hundred and fifteen metres of open ramps.',
    'The west portal stands close to Dien Hai Citadel, so it is kept low and clad in old-brick tones. An eighty-metre louvre roof cuts the glare as cars come in from harsh sun, keeps out driving rain and lets typhoon wind pass through.',
    'In the rainy season Da Nang often floods when heavy rain meets a high tide. So the crest of the road before the portal is raised one metre above the street, with a sliding flood gate to hold the water back when needed.',
    'This is the longitudinal section. Five immersed elements, each one hundred and twenty metres long, lie about six metres below the riverbed, with at least one metre of cover above the roof. On the banks comes cut-and-cover with diaphragm walls, then open ramps no steeper than four point five percent.',
    'Each element is cast in a dry dock, sealed at both ends and towed out onto the river. Ballast water sinks it into the dredged trench, jacks pull it tight against its neighbour, and a rubber gasket called GINA keeps the joint watertight.',
    'Each tube has three lanes: two car lanes at sixty kilometres an hour and a motorbike lane on the right, because motorbikes make up most of the traffic in Da Nang. Jet fans ventilate along the tunnel, and the entrance zone is lit brighter so that drivers\' eyes can adapt.',
    'Between the two tubes runs an escape corridor, pressurised so that smoke cannot get in. Every one hundred metres a green cross-passage door leads into it, and S O S boxes and fire extinguishers are placed every fifty metres.',
    'The east portal faces Son Tra and recalls sea waves and fishing villages, with basket boats beside it. The planned investment of six thousand eight hundred and eighty billion dong, from two thousand and thirty-one, would take traffic off the Dragon Bridge and the Han River Bridge.'
  ]
};
for (const [lang, lines] of Object.entries(S)) {
  const file = join(dir, `${lang}.json`);
  const json = JSON.parse(await readFile(file, 'utf8'));
  json.hrStops = lines;
  await writeFile(file, JSON.stringify(json, null, 2) + '\n');
  console.log(lang, lines.length, 'dòng');
}

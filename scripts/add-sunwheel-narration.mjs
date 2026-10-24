/* Thêm lời thuyết minh Tour Vòng quay Mặt Trời (khóa swStops, 6 điểm dừng, đúng thứ tự SW_TOUR) vào scripts/narration/{vi,en,ru}.json.
   Sau đó: npm run gen:voice  (chỉ sinh clip mới/đổi lời). Số liệu có nguồn: 115 m, 64 cabin × 6 khách, ~15 phút/vòng, 13 000 LED trên 32 thanh,
   Igosu 108 (Biwako, Shiga, 1992), mở ở Đà Nẵng 18/7/2014. Điểm 3 nói rõ hiện trạng "theo một số nguồn đã ngừng từ 9/2025".
   node scripts/add-sunwheel-narration.mjs */
import { readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const dir = join(dirname(fileURLToPath(import.meta.url)), 'narration');
const N = {
  vi: [
    'Phía Nam sông Hàn, trong Công viên Châu Á, là Vòng quay Mặt Trời. Vòng quay nằm ở bờ Tây, cách Cầu Rồng hơn hai cây số về phía Nam, cao một trăm mười lăm mét và có sáu mươi bốn cabin.',
    'Dưới chân vòng quay là bệ nhà ga với ba vòm cuốn, nơi khách bước lên cabin. Mỗi cabin chở sáu người, tổng cộng ba trăm tám mươi bốn khách, và một vòng quay kéo dài khoảng mười lăm phút.',
    'Vòng quay vốn là Igosu một trăm linh tám ở tháp Biwako, tỉnh Shiga, Nhật Bản, khai trương năm một nghìn chín trăm chín mươi hai. Sau đó nó được dời về Đà Nẵng và mở cửa ngày mười tám tháng bảy năm hai nghìn không trăm mười bốn. Theo một số nguồn, vòng quay đã ngừng hoạt động từ tháng chín năm hai nghìn không trăm hai mươi lăm; mô hình thể hiện lúc còn vận hành.',
    'Bây giờ chúng ta bước lên cabin. Ngoài đời, từ sàn lên tới đỉnh mất khoảng bảy phút rưỡi, nên mô hình tua nhanh. Cabin treo ngoài vành nên luôn đứng thẳng, trong khi vành thép quay chậm quanh trục và tầm nhìn mở rộng dần theo từng mét độ cao.',
    'Ở độ cao khoảng một trăm mười lăm mét, nhìn về phía Bắc, gần nhất là Cầu Trần Thị Lý, cách chừng một cây số. Xa hơn là Cầu Rồng, rồi Cầu sông Hàn, và ở tận cuối tầm mắt là Cầu Thuận Phước.',
    'Khi màn đêm buông xuống, khoảng mười ba nghìn bóng đèn LED trên ba mươi hai thanh chính của vòng quay đổi màu theo từng kiểu trình diễn, còn các cabin được viền đỏ. Hành trình kết thúc tại đây.'
  ],
  en: [
    'South of the Han River, in Asia Park, stands the Sun Wheel. It rises on the west bank, more than two kilometres south of Dragon Bridge, one hundred and fifteen metres tall, with sixty-four cabins.',
    'At the foot of the wheel is the station base with three arches, where passengers step into the cabins. Each cabin carries six people, three hundred and eighty-four guests in all, and one turn takes about fifteen minutes.',
    'The wheel began life as Igosu 108 at Biwako Tower in Shiga, Japan, which opened in nineteen ninety-two. It was later moved to Da Nang and opened on the eighteenth of July, twenty fourteen. Some sources report that it stopped operating in September twenty twenty-five; the model shows it in operation.',
    'Now we step into a cabin. In real life the ride from the platform to the top takes about seven and a half minutes, so the model fast-forwards. The cabins hang outside the rim and stay upright, while the steel rim turns slowly around the hub and the view opens up with every metre of height.',
    'From about one hundred and fifteen metres up, looking north, the nearest is Tran Thi Ly Bridge, around one kilometre away. Further on lie Dragon Bridge, then Han River Bridge, and at the very edge of sight, Thuan Phuoc Bridge.',
    'As night falls, about thirteen thousand LEDs on the wheel\'s thirty-two main spokes change colour with each show style, and the cabins glow with red rims. The journey ends here.'
  ],
  ru: [
    'К югу от реки Хан, в Азия-парке, стоит Колесо Солнца. Оно находится на западном берегу, более чем в двух километрах к югу от Моста Дракона, высотой сто пятнадцать метров, с шестьюдесятью четырьмя кабинами.',
    'У основания колеса расположена станция с тремя арками, отсюда пассажиры входят в кабины. В каждой кабине шесть человек, всего триста восемьдесят четыре, а один оборот длится около пятнадцати минут.',
    'Колесо когда-то называлось Igosu 108 и стояло у башни Бива в префектуре Сига в Японии; оно открылось в тысяча девятьсот девяносто втором году. Затем его перевезли в Дананг и открыли восемнадцатого июля две тысячи четырнадцатого года. По некоторым данным, с сентября две тысячи двадцать пятого года оно не работает; модель показана в рабочем состоянии.',
    'Теперь мы садимся в кабину. В жизни подъём с платформы на вершину занимает около семи с половиной минут, поэтому в модели он ускорен. Кабины подвешены снаружи обода и всегда стоят вертикально, а стальной обод медленно вращается вокруг оси, и с каждым метром высоты вид становится шире.',
    'С высоты около ста пятнадцати метров, глядя на север, ближе всего виден мост Чан Тхи Ли, примерно в километре. Дальше Мост Дракона, затем мост через реку Хан, а на самом краю горизонта мост Тхуанфуок.',
    'С наступлением ночи около тринадцати тысяч светодиодов на тридцати двух главных спицах колеса меняют цвет в каждом режиме шоу, а кабины светятся красным ободком. На этом путешествие заканчивается.'
  ]
};
for (const [lang, lines] of Object.entries(N)) {
  const file = join(dir, `${lang}.json`);
  const json = JSON.parse(await readFile(file, 'utf8'));
  json.swStops = lines;
  await writeFile(file, JSON.stringify(json, null, 2) + '\n');
  console.log(lang, 'swStops', lines.length);
}

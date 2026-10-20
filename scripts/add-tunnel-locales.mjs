/* Thêm khóa dịch của Hầm vượt sông Hàn vào cả 9 file src/i18n/locales/*.json (chạy một lần; chạy lại sẽ ghi đè đúng các khóa này).
   node scripts/add-tunnel-locales.mjs */
import { readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const dir = join(dirname(fileURLToPath(import.meta.url)), '..', 'src', 'i18n', 'locales');

const T = {
  vi: {
    loadingSub: 'Cầu Rồng, Thuận Phước, Trần Thị Lý, cầu quay sông Hàn và hầm vượt sông Hàn',
    bridgeHr: 'Hầm sông Hàn', vHrCutaway: 'Mặt cắt dọc tuyến', vHrPortalW: 'Cửa Tây · Thành Điện Hải', vHrPortalE: 'Cửa Đông · Sơn Trà',
    vHrDrive: 'Lái xe xuyên hầm', vHrGallery: 'Hành lang thoát nạn', hrSection: 'Mặt cắt địa chất', hrTraffic: 'Xe cộ',
    hrImmerseBtn: 'Mô phỏng dìm đốt hầm', hrImBusy: 'Đang dìm đốt hầm…', hrImSpeed: 'Tốc độ mô phỏng',
    hrImNote: 'Đốt số 3 (120 m) được lai dắt, dằn nước, dìm xuống hào rồi lấp đá hộc. Đường tạm đóng trong lúc mô phỏng.',
    hrFollow: 'Camera theo dõi khi dìm',
    im_IDLE: 'Chờ — hầm hoàn chỉnh', im_FLOAT_IN: 'Tàu kéo lai dắt đốt hầm nổi vào', im_POSITION: 'Neo và định vị trên hào', im_BALLAST: 'Bơm nước dằn, đốt hầm chìm dần',
    im_PULL_JOINT: 'Kích kéo áp khít, nén gioăng GINA', im_BACKFILL: 'Lấp cát, phủ đá hộc bảo vệ', im_DONE: 'Hoàn tất — nối thông hai đốt',
    hrLengthVal: '≈ 1.670 m', hrWidthVal: '31,2 m', hrSpan: 'Hầm dìm qua sông', hrSpanVal: '600 m · 5 đốt',
    hrNote: 'Phương án đề xuất 2025, dự kiến đầu tư 2031–2045, tổng mức 6.880 tỷ đồng. Mặt cắt, độ sâu và kiến trúc cửa hầm là ước lượng.',
    hrLblElements: 'Hầm dìm 5 × 120 m', hrLblGina: 'Khe nối GINA', hrLblBed: 'Đáy sông −6 m', hrLblPump: 'Trạm bơm', hrLblCover: 'Hầm kín trên bờ 190 m', hrLblRamp: 'Hầm hở 207,5 m', hrLblFlood: 'Gờ chắn ngập +1,0 m',
    hrStops: [
      ['Hầm vượt sông thứ hai của Việt Nam', 'Phương án đề xuất 2025: tuyến hầm dài khoảng 1.670 m nối Đống Đa (Hải Châu) với Vân Đồn (Sơn Trà), gồm hầm kín qua sông 600 m, hầm kín trên bờ 380 m và hầm hở 415 m. Dự kiến đầu tư 2031–2045.'],
      ['Cửa Tây · mái lam', 'Gần Thành Điện Hải, cửa hầm làm thấp và ốp màu gạch thành cổ. Mái lam dài 80 m giảm chói khi xe từ nắng gắt chạy vào, hắt bớt mưa và cho gió bão xuyên qua.'],
      ['Gờ chắn ngập & cửa phai', 'Mùa mưa bão, Đà Nẵng hay ngập khi mưa lớn gặp triều cường. Đỉnh dốc trước cửa hầm được nâng cao hơn mặt phố 1 m, kèm cửa phai trượt để chắn nước.'],
      ['Mặt cắt dọc tuyến', 'Năm đốt hầm dìm, mỗi đốt 120 m, nằm dưới đáy sông sâu khoảng 6 m; nóc hầm cách đáy sông tối thiểu 1 m. Hai bờ là hầm đào hở có tường vây, rồi tới hầm hở dốc không quá 4,5%.'],
      ['Dìm đốt hầm', 'Mỗi đốt đúc sẵn trong ụ khô, bịt kín hai đầu rồi lai dắt ra sông, bơm nước dằn cho chìm xuống hào nạo vét. Kích kéo áp khít vào đốt kề, gioăng cao su GINA chống thấm.'],
      ['Trong ống xe', 'Mỗi chiều ba làn: hai làn ô tô chạy 60 km/h và một làn xe máy sát lề phải. Quạt phản lực thông gió dọc hầm, đèn vùng ngưỡng sáng hơn để mắt kịp thích nghi.'],
      ['Hành lang thoát nạn', 'Giữa hai ống là hành lang tăng áp chống khói. Cứ 100 m có một cửa ngang xanh dẫn sang hành lang; hộp SOS và bình chữa cháy cách nhau 50 m.'],
      ['Cửa Đông · Sơn Trà', 'Cửa phía Sơn Trà gợi sóng biển và làng chài với những chiếc thuyền thúng. Tổng mức đầu tư dự kiến 6.880 tỷ đồng, giúp giảm tải cho Cầu Rồng và Cầu sông Hàn.']
    ]
  },
  en: {
    loadingSub: 'Dragon, Thuan Phuoc, Tran Thi Ly, the Han River swing bridge and the Han River tunnel',
    bridgeHr: 'Han River Tunnel', vHrCutaway: 'Longitudinal section', vHrPortalW: 'West portal · Dien Hai Citadel', vHrPortalE: 'East portal · Son Tra',
    vHrDrive: 'Drive through the tunnel', vHrGallery: 'Escape corridor', hrSection: 'Geological section', hrTraffic: 'Traffic',
    hrImmerseBtn: 'Simulate element immersion', hrImBusy: 'Immersing element…', hrImSpeed: 'Simulation speed',
    hrImNote: 'Element no. 3 (120 m) is towed in, ballasted, lowered into the trench and covered with rock. The road is closed during the simulation.',
    hrFollow: 'Camera follows the immersion',
    im_IDLE: 'Idle — tunnel complete', im_FLOAT_IN: 'Tugs tow the floating element in', im_POSITION: 'Mooring and positioning over the trench', im_BALLAST: 'Ballast water pumped in, element sinks',
    im_PULL_JOINT: 'Jacks pull it tight, GINA gasket compresses', im_BACKFILL: 'Backfilling sand and rock armour', im_DONE: 'Done — two elements joined',
    hrLengthVal: '≈ 1,670 m', hrWidthVal: '31.2 m', hrSpan: 'Immersed tunnel', hrSpanVal: '600 m · 5 elements',
    hrNote: 'Proposal of 2025, investment planned 2031–2045, total 6,880 billion VND. Cross-section, depths and portal architecture are estimates.',
    hrLblElements: 'Immersed tunnel 5 × 120 m', hrLblGina: 'GINA joint', hrLblBed: 'Riverbed −6 m', hrLblPump: 'Pump station', hrLblCover: 'Cut-and-cover 190 m', hrLblRamp: 'Open ramp 207.5 m', hrLblFlood: 'Flood sill +1.0 m',
    hrStops: [
      ['Vietnam’s second river tunnel', 'The 2025 proposal is a tunnel of about 1,670 m linking Dong Da (Hai Chau) with Van Don (Son Tra): a 600 m immersed tunnel under the river, 380 m of cut-and-cover on the banks and 415 m of open ramps. Investment is planned for 2031–2045.'],
      ['West portal · louvre roof', 'Next to Dien Hai Citadel the portal is kept low and clad in old-brick tones. An 80 m louvre roof cuts glare as cars enter from harsh sun, keeps out driving rain and lets typhoon wind pass through.'],
      ['Flood sill and flood gate', 'Da Nang often floods when heavy rain meets high tide. The road crest before the portal is raised 1 m above the street, with a sliding flood gate to hold the water back.'],
      ['Longitudinal section', 'Five immersed elements of 120 m each lie about 6 m below the riverbed level, with at least 1 m of cover above the roof. On each bank comes cut-and-cover with diaphragm walls, then open ramps no steeper than 4.5%.'],
      ['Immersing an element', 'Each element is cast in a dry dock, sealed at both ends and towed out; ballast water sinks it into the dredged trench. Jacks pull it tight against its neighbour and a rubber GINA gasket seals the joint.'],
      ['Inside the tube', 'Three lanes each way: two car lanes at 60 km/h and a motorbike lane on the right. Jet fans ventilate along the tunnel, and the entrance zone is lit brighter so eyes can adapt.'],
      ['Escape corridor', 'Between the two tubes runs a pressurised, smoke-free corridor. A green cross-passage door every 100 m leads into it, with SOS boxes and extinguishers every 50 m.'],
      ['East portal · Son Tra', 'On the Son Tra side the portal recalls sea waves and fishing villages, with basket boats beside it. The planned investment of 6,880 billion VND would relieve the Dragon and Han River bridges.']
    ]
  },
  ko: {
    loadingSub: '용다리, 투언프억, 쩐티리, 쏭한 회전교, 쏭한 강 터널',
    bridgeHr: '쏭한 터널', vHrCutaway: '종단면', vHrPortalW: '서쪽 입구 · 디엔하이 성채', vHrPortalE: '동쪽 입구 · 선짜',
    vHrDrive: '터널 주행', vHrGallery: '피난 통로', hrSection: '지질 단면', hrTraffic: '차량',
    hrImmerseBtn: '터널 함체 침설 시뮬레이션', hrImBusy: '함체 침설 중…', hrImSpeed: '시뮬레이션 속도',
    hrImNote: '3번 함체(120 m)를 예인해 와 밸러스트로 가라앉히고 굴착 해저에 안착시킨 뒤 석재로 덮습니다. 시뮬레이션 중에는 도로가 통제됩니다.',
    hrFollow: '침설 중 카메라 추적',
    im_IDLE: '대기 — 터널 완성', im_FLOAT_IN: '예인선이 뜬 함체를 끌고 진입', im_POSITION: '계류 및 굴착부 위 위치 잡기', im_BALLAST: '밸러스트 주입, 함체 하강',
    im_PULL_JOINT: '잭으로 밀착, GINA 개스킷 압축', im_BACKFILL: '모래 되메우기와 피복석 투입', im_DONE: '완료 — 두 함체 연결',
    hrLengthVal: '≈ 1,670 m', hrWidthVal: '31.2 m', hrSpan: '침매터널 구간', hrSpanVal: '600 m · 함체 5개',
    hrNote: '2025년 제안안, 투자 예정 2031–2045년, 총사업비 6조 8,800억 동. 단면, 깊이, 입구 건축은 추정치입니다.',
    hrLblElements: '침매터널 5 × 120 m', hrLblGina: 'GINA 이음부', hrLblBed: '강바닥 −6 m', hrLblPump: '배수 펌프장', hrLblCover: '육상 개착 190 m', hrLblRamp: '개방 램프 207.5 m', hrLblFlood: '침수 방지 턱 +1.0 m',
    hrStops: [
      ['베트남 두 번째 하저터널', '2025년 제안안은 동다(하이쩌우)와 반돈(선짜)을 잇는 약 1,670 m 터널로, 강 아래 침매터널 600 m, 육상 개착 380 m, 개방 램프 415 m로 이루어집니다. 투자는 2031–2045년으로 예정되어 있습니다.'],
      ['서쪽 입구 · 루버 지붕', '디엔하이 성채 가까이에 있어 입구를 낮게 하고 옛 성벽 벽돌색으로 마감했습니다. 80 m 루버 지붕이 강한 햇빛에서 들어오는 차량의 눈부심을 줄이고, 비를 막고, 태풍 바람은 통과시킵니다.'],
      ['침수 방지 턱과 수문', '다낭은 폭우와 만조가 겹치면 자주 침수됩니다. 입구 앞 도로 정점을 거리보다 1 m 높이고 미닫이 수문으로 물을 막습니다.'],
      ['종단면', '길이 120 m 함체 다섯 개가 강바닥 아래 약 6 m에 놓이며 지붕 위 흙 덮개는 최소 1 m입니다. 양쪽 강변은 지하연속벽 개착 구간이고, 이어서 4.5% 이하 경사의 개방 램프가 나옵니다.'],
      ['함체 침설', '각 함체는 건식 도크에서 제작해 양 끝을 막고 예인합니다. 밸러스트 물로 굴착한 해저에 가라앉힌 뒤 잭으로 옆 함체에 밀착시키고 고무 GINA 개스킷으로 방수합니다.'],
      ['차로 내부', '방향별 3차로로, 승용차 2차로는 시속 60 km, 오른쪽 1차로는 오토바이 전용입니다. 제트팬이 터널을 환기하고, 입구 구간 조명은 눈이 적응하도록 더 밝게 합니다.'],
      ['피난 통로', '두 터널 사이에는 연기가 들어오지 않도록 가압한 통로가 있습니다. 100 m마다 초록색 연결문이 있고 SOS 함과 소화기는 50 m 간격입니다.'],
      ['동쪽 입구 · 선짜', '선짜 쪽 입구는 바다의 파도와 어촌, 바구니 배를 닮았습니다. 총사업비 6조 8,800억 동으로, 용다리와 쏭한 다리의 교통을 분담합니다.']
    ]
  },
  ja: {
    loadingSub: 'ドラゴン橋、トゥアンフォック橋、チャン・ティ・リー橋、ソンハン旋回橋、ソンハン川トンネル',
    bridgeHr: 'ソンハントンネル', vHrCutaway: '縦断面', vHrPortalW: '西坑口 · ディエンハイ城', vHrPortalE: '東坑口 · ソンチャ',
    vHrDrive: 'トンネル走行', vHrGallery: '避難通路', hrSection: '地質断面', hrTraffic: '車両',
    hrImmerseBtn: '函体沈設シミュレーション', hrImBusy: '函体を沈設中…', hrImSpeed: 'シミュレーション速度',
    hrImNote: '3番函体（120 m）を曳航し、バラスト水で沈めて浚渫した溝に据え、石で覆います。シミュレーション中は道路を閉鎖します。',
    hrFollow: '沈設中はカメラが追従',
    im_IDLE: '待機 — トンネル完成', im_FLOAT_IN: 'タグボートが浮いた函体を曳航', im_POSITION: '係留し溝の上で位置決め', im_BALLAST: 'バラスト水を注入、函体が沈む',
    im_PULL_JOINT: 'ジャッキで引き寄せ、GINAガスケットを圧縮', im_BACKFILL: '砂の埋戻しと被覆石の投入', im_DONE: '完了 — 2つの函体が接続',
    hrLengthVal: '≈ 1,670 m', hrWidthVal: '31.2 m', hrSpan: '沈埋トンネル区間', hrSpanVal: '600 m · 函体5つ',
    hrNote: '2025年の提案案。投資は2031〜2045年の予定で、総額6兆8,800億ドン。断面、水深、坑口の意匠は推定です。',
    hrLblElements: '沈埋トンネル 5 × 120 m', hrLblGina: 'GINA継手', hrLblBed: '河床 −6 m', hrLblPump: 'ポンプ場', hrLblCover: '陸上開削 190 m', hrLblRamp: '開放ランプ 207.5 m', hrLblFlood: '浸水防止の嵩上げ +1.0 m',
    hrStops: [
      ['ベトナム2本目の河底トンネル', '2025年の提案は、ドンダ（ハイチャウ）とヴァンドン（ソンチャ）を結ぶ全長約1,670 mのトンネルです。河下の沈埋部600 m、陸上の開削部380 m、開放ランプ415 mで構成され、投資は2031〜2045年の予定です。'],
      ['西坑口 · ルーバー屋根', 'ディエンハイ城の近くなので坑口は低く抑え、古い城壁のレンガ色にしています。80 mのルーバー屋根が強い日差しから入る車のまぶしさを和らげ、雨を防ぎ、台風の風は通します。'],
      ['浸水防止の嵩上げと止水門', 'ダナンは大雨と満潮が重なるとよく冠水します。坑口手前の道路頂部を街路より1 m高くし、スライド式の止水門で水を止めます。'],
      ['縦断面', '長さ120 mの函体5つが河床の約6 m下に並び、屋根上の土被りは最低1 mです。両岸は地中連続壁の開削区間で、その先に勾配4.5%以下の開放ランプが続きます。'],
      ['函体の沈設', '各函体はドライドックで製作し、両端を塞いで曳航します。バラスト水で浚渫した溝に沈め、ジャッキで隣の函体に密着させ、ゴム製GINAガスケットで止水します。'],
      ['車道内部', '片側3車線で、乗用車2車線は時速60 km、右側の1車線はバイク専用です。ジェットファンが換気し、入口付近は目が慣れるよう照明を明るくしています。'],
      ['避難通路', '2本の車道の間に、煙を入れない加圧通路があります。100 mごとに緑の連絡扉があり、SOSボックスと消火器は50 mおきです。'],
      ['東坑口 · ソンチャ', 'ソンチャ側の坑口は海の波と漁村、かご舟を思わせます。総事業費は6兆8,800億ドンで、ドラゴン橋とソンハン橋の交通を分担します。']
    ]
  },
  zh: {
    loadingSub: '龙桥、顺福桥、陈氏理桥、韩江平转桥与韩江隧道',
    bridgeHr: '韩江隧道', vHrCutaway: '纵剖面', vHrPortalW: '西洞口 · 奠海城', vHrPortalE: '东洞口 · 山茶',
    vHrDrive: '驾车穿越隧道', vHrGallery: '逃生通道', hrSection: '地质剖面', hrTraffic: '车辆',
    hrImmerseBtn: '沉管沉放模拟', hrImBusy: '正在沉放管节…', hrImSpeed: '模拟速度',
    hrImNote: '第 3 节管节（120 米）被拖运到位，注入压载水沉入基槽，再回填块石。模拟期间道路封闭。',
    hrFollow: '沉放时镜头跟随',
    im_IDLE: '待机 — 隧道完整', im_FLOAT_IN: '拖轮拖带浮运管节入位', im_POSITION: '系泊并在基槽上方定位', im_BALLAST: '注入压载水，管节下沉',
    im_PULL_JOINT: '千斤顶拉紧，GINA 止水带受压', im_BACKFILL: '回填砂并抛填护面块石', im_DONE: '完成 — 两节管节贯通',
    hrLengthVal: '≈ 1,670 米', hrWidthVal: '31.2 米', hrSpan: '江底沉管段', hrSpanVal: '600 米 · 5 节管节',
    hrNote: '2025 年建议方案，计划 2031–2045 年投资，总投资 68,800 亿越南盾。断面、深度与洞口建筑均为估算。',
    hrLblElements: '沉管 5 × 120 米', hrLblGina: 'GINA 接头', hrLblBed: '江底 −6 米', hrLblPump: '泵站', hrLblCover: '岸上暗埋段 190 米', hrLblRamp: '敞口段 207.5 米', hrLblFlood: '防淹门槛 +1.0 米',
    hrStops: [
      ['越南第二条过江隧道', '2025 年建议方案是连接栋多（海州）与云屯（山茶）的约 1,670 米隧道：江下沉管段 600 米、岸上暗埋段 380 米、敞口段 415 米。计划 2031–2045 年投资。'],
      ['西洞口 · 百叶顶棚', '靠近奠海城，洞口压低并采用古城砖色。80 米长的百叶顶棚可减轻车辆从强光驶入时的眩光，遮挡雨水，并让台风通过。'],
      ['防淹门槛与闸门', '岘港遇暴雨加天文大潮常会积水。洞口前的路面最高点比街道高 1 米，并设有滑动闸门挡水。'],
      ['纵剖面', '5 节各 120 米的管节位于江底以下约 6 米，顶部覆盖层至少 1 米。两岸为带地下连续墙的明挖暗埋段，接着是坡度不超过 4.5% 的敞口段。'],
      ['沉放管节', '每节管节在干坞中预制，两端封闭后拖运出江，注入压载水沉入疏浚基槽。千斤顶将其拉紧贴合相邻管节，橡胶 GINA 止水带防水。'],
      ['行车管内', '每个方向三车道：两条小汽车道时速 60 公里，右侧一条摩托车道。射流风机沿隧道通风，洞口区照明更亮以便眼睛适应。'],
      ['逃生通道', '两管之间是加压防烟的通道。每 100 米有一扇绿色横通道门，SOS 呼叫箱和灭火器每 50 米一处。'],
      ['东洞口 · 山茶', '山茶一侧的洞口呼应海浪与渔村，旁边是竹篮船。计划投资 68,800 亿越南盾，可为龙桥和韩江桥分流。']
    ]
  },
  th: {
    loadingSub: 'สะพานมังกร ถ่วนเฟื้อก เจิ่นถิลี้ สะพานหมุนซงฮาน และอุโมงค์ซงฮาน',
    bridgeHr: 'อุโมงค์ซงฮาน', vHrCutaway: 'หน้าตัดตามยาว', vHrPortalW: 'ปากอุโมงค์ตะวันตก · ป้อมเดียนไห่', vHrPortalE: 'ปากอุโมงค์ตะวันออก · เซินจ่า',
    vHrDrive: 'ขับผ่านอุโมงค์', vHrGallery: 'ทางเดินหนีภัย', hrSection: 'หน้าตัดทางธรณี', hrTraffic: 'ยานพาหนะ',
    hrImmerseBtn: 'จำลองการจมท่อนอุโมงค์', hrImBusy: 'กำลังจมท่อนอุโมงค์…', hrImSpeed: 'ความเร็วจำลอง',
    hrImNote: 'ท่อนที่ 3 (120 ม.) ถูกลากมา เติมน้ำถ่วงให้จมลงในร่องที่ขุดไว้ แล้วกลบด้วยหิน ถนนปิดระหว่างการจำลอง',
    hrFollow: 'กล้องติดตามขณะจม',
    im_IDLE: 'พัก — อุโมงค์สมบูรณ์', im_FLOAT_IN: 'เรือลากจูงท่อนที่ลอยเข้าที่', im_POSITION: 'ผูกยึดและจัดตำแหน่งเหนือร่อง', im_BALLAST: 'สูบน้ำถ่วง ท่อนค่อย ๆ จม',
    im_PULL_JOINT: 'แม่แรงดึงให้ชิด ซีล GINA ถูกอัด', im_BACKFILL: 'กลบทรายและวางหินป้องกัน', im_DONE: 'เสร็จ — เชื่อมสองท่อนเข้าด้วยกัน',
    hrLengthVal: '≈ 1,670 ม.', hrWidthVal: '31.2 ม.', hrSpan: 'อุโมงค์ลอดใต้แม่น้ำ', hrSpanVal: '600 ม. · 5 ท่อน',
    hrNote: 'แบบเสนอปี 2025 วางแผนลงทุนปี 2031–2045 วงเงินรวม 6.88 หมื่นล้านด่ง หน้าตัด ความลึก และสถาปัตยกรรมปากอุโมงค์เป็นค่าประมาณ',
    hrLblElements: 'อุโมงค์จมท่อน 5 × 120 ม.', hrLblGina: 'รอยต่อ GINA', hrLblBed: 'ท้องแม่น้ำ −6 ม.', hrLblPump: 'สถานีสูบน้ำ', hrLblCover: 'ขุดเปิดแล้วกลบ 190 ม.', hrLblRamp: 'ทางลาดเปิดโล่ง 207.5 ม.', hrLblFlood: 'สันกันน้ำท่วม +1.0 ม.',
    hrStops: [
      ['อุโมงค์ข้ามแม่น้ำแห่งที่สองของเวียดนาม', 'แบบเสนอปี 2025 เป็นอุโมงค์ยาวประมาณ 1,670 ม. เชื่อมถนนด่งดา (ไฮเจิว) กับวันดอน (เซินจ่า) ประกอบด้วยช่วงจมท่อนใต้น้ำ 600 ม. ช่วงขุดเปิดบนฝั่ง 380 ม. และทางลาดเปิดโล่ง 415 ม. วางแผนลงทุนปี 2031–2045'],
      ['ปากอุโมงค์ตะวันตก · หลังคาบานเกล็ด', 'ใกล้ป้อมเดียนไห่ จึงทำปากอุโมงค์ให้ต่ำและใช้โทนสีอิฐเก่า หลังคาบานเกล็ดยาว 80 ม. ลดแสงจ้าตอนรถวิ่งเข้ามาจากแดดแรง กันฝนสาด และให้ลมพายุผ่านได้'],
      ['สันกันน้ำท่วมและประตูกั้นน้ำ', 'ดานังมักน้ำท่วมเมื่อฝนหนักประจวบกับน้ำขึ้นสูง ยอดทางลาดหน้าปากอุโมงค์จึงยกสูงกว่าถนน 1 ม. พร้อมประตูเลื่อนกั้นน้ำ'],
      ['หน้าตัดตามยาว', 'ท่อนอุโมงค์ 5 ท่อน ท่อนละ 120 ม. อยู่ใต้ท้องแม่น้ำประมาณ 6 ม. หลังคามีดินปิดทับอย่างน้อย 1 ม. สองฝั่งเป็นช่วงขุดเปิดมีกำแพงดิน แล้วต่อด้วยทางลาดเปิดโล่งชันไม่เกิน 4.5%'],
      ['การจมท่อนอุโมงค์', 'แต่ละท่อนหล่อในอู่แห้ง ปิดหัวท้ายแล้วลากออกมา เติมน้ำถ่วงให้จมลงในร่องที่ขุดไว้ แม่แรงดึงให้ชิดท่อนข้างเคียง และซีลยาง GINA กันน้ำรั่ว'],
      ['ภายในช่องจราจร', 'ทิศละสามช่อง: ช่องรถยนต์สองช่องวิ่ง 60 กม./ชม. และช่องมอเตอร์ไซค์ชิดขวา พัดลมเจ็ตระบายอากาศตามแนวอุโมงค์ ส่วนปากทางเข้าติดไฟสว่างกว่าเพื่อให้สายตาปรับตัวทัน'],
      ['ทางเดินหนีภัย', 'ระหว่างสองช่องมีทางเดินที่เพิ่มแรงดันกันควัน ทุก 100 ม. มีประตูสีเขียวเชื่อมเข้าทางเดิน ส่วนกล่อง SOS และถังดับเพลิงห่างกัน 50 ม.'],
      ['ปากอุโมงค์ตะวันออก · เซินจ่า', 'ปากอุโมงค์ฝั่งเซินจ่าสื่อถึงคลื่นทะเลและหมู่บ้านชาวประมง มีเรือกระด้งตั้งอยู่ข้าง ๆ วงเงินลงทุน 6.88 หมื่นล้านด่งจะช่วยลดการจราจรบนสะพานมังกรและสะพานซงฮาน']
    ]
  },
  ar: {
    loadingSub: 'جسر التنين وثوان فوك وتران ثي لي وجسر سونغ هان الدوّار ونفق سونغ هان',
    bridgeHr: 'نفق سونغ هان', vHrCutaway: 'المقطع الطولي', vHrPortalW: 'المدخل الغربي · قلعة ديين هاي', vHrPortalE: 'المدخل الشرقي · سون ترا',
    vHrDrive: 'القيادة عبر النفق', vHrGallery: 'ممر الإخلاء', hrSection: 'المقطع الجيولوجي', hrTraffic: 'المركبات',
    hrImmerseBtn: 'محاكاة غمر قطعة النفق', hrImBusy: 'جارٍ غمر القطعة…', hrImSpeed: 'سرعة المحاكاة',
    hrImNote: 'تُسحب القطعة رقم 3 (120 م) وتُملأ بمياه الاتزان لتغطس في الخندق المحفور ثم تُغطّى بالحجارة. يُغلق الطريق أثناء المحاكاة.',
    hrFollow: 'الكاميرا تتبع الغمر',
    im_IDLE: 'استعداد — النفق مكتمل', im_FLOAT_IN: 'القاطرات تسحب القطعة الطافية', im_POSITION: 'التثبيت والتموضع فوق الخندق', im_BALLAST: 'ضخّ مياه الاتزان وغوص القطعة',
    im_PULL_JOINT: 'الرافعات تشدّها، وحشية GINA تنضغط', im_BACKFILL: 'ردم الرمل ووضع حجارة الحماية', im_DONE: 'اكتمل — اتصلت القطعتان',
    hrLengthVal: '≈ 1670 م', hrWidthVal: '31.2 م', hrSpan: 'النفق المغمور تحت النهر', hrSpanVal: '600 م · 5 قطع',
    hrNote: 'مقترح 2025، والاستثمار مخطط له بين 2031 و2045 بإجمالي 6880 مليار دونغ. المقطع والأعماق وعمارة المداخل تقديرية.',
    hrLblElements: 'النفق المغمور 5 × 120 م', hrLblGina: 'وصلة GINA', hrLblBed: 'قاع النهر −6 م', hrLblPump: 'محطة الضخ', hrLblCover: 'حفر وتغطية 190 م', hrLblRamp: 'منحدر مكشوف 207.5 م', hrLblFlood: 'عتبة منع الفيضان +1.0 م',
    hrStops: [
      ['ثاني نفق نهري في فيتنام', 'المقترح لعام 2025 نفق بطول نحو 1670 م يربط دونغ دا (هاي تشاو) بفان دون (سون ترا)، ويضم 600 م مغمورة تحت النهر و380 م حفر وتغطية على الضفتين و415 م منحدرات مكشوفة. الاستثمار مخطط له بين 2031 و2045.'],
      ['المدخل الغربي · سقف الشرائح', 'بالقرب من قلعة ديين هاي صُمّم المدخل منخفضًا بألوان الطوب القديم. يقلّل سقف الشرائح بطول 80 م الوهج عند دخول السيارات من الشمس القوية، ويحجب المطر ويسمح بمرور رياح العواصف.'],
      ['عتبة الفيضان وبوابته', 'كثيرًا ما تغمر المياه دا نانغ عند اجتماع المطر الغزير بالمدّ العالي. لذلك ترتفع قمة المنحدر أمام المدخل متراً عن الشارع، مع بوابة منزلقة لصدّ الماء.'],
      ['المقطع الطولي', 'خمس قطع مغمورة طول كل منها 120 م تقع نحو 6 م تحت قاع النهر وبغطاء لا يقل عن متر فوق السقف. على الضفتين حفر وتغطية بجدران حاجزة، ثم منحدرات مكشوفة لا تزيد على 4.5%.'],
      ['غمر قطعة النفق', 'تُصبّ كل قطعة في حوض جاف وتُسدّ نهايتاها وتُسحب إلى النهر، ثم يغطّسها ماء الاتزان في الخندق المحفور. تشدّها الرافعات إلى القطعة المجاورة وتحكم وحشية GINA المطاطية العزل.'],
      ['داخل الأنبوب', 'ثلاث حارات في كل اتجاه: حارتان للسيارات بسرعة 60 كم/س وحارة للدراجات النارية على اليمين. تهوّي المراوح النفاثة النفق، وتُضاء منطقة المدخل بشدة أكبر كي تتكيّف العين.'],
      ['ممر الإخلاء', 'بين الأنبوبين ممر مضغوط يمنع دخول الدخان. كل 100 م باب أخضر يؤدي إليه، وصناديق الاستغاثة وطفايات الحريق كل 50 م.'],
      ['المدخل الشرقي · سون ترا', 'يستحضر مدخل سون ترا أمواج البحر وقرى الصيد، وبجانبه قوارب السلال. ومن شأن الاستثمار المقدّر بـ 6880 مليار دونغ تخفيف الضغط عن جسري التنين وسونغ هان.']
    ]
  },
  hi: {
    loadingSub: 'ड्रैगन, थुआन फुओक, ट्रान थी ली, सोंग हान घूमने वाला पुल और सोंग हान सुरंग',
    bridgeHr: 'सोंग हान सुरंग', vHrCutaway: 'लंबवत काट', vHrPortalW: 'पश्चिमी द्वार · दिएन हाई किला', vHrPortalE: 'पूर्वी द्वार · सोन ट्रा',
    vHrDrive: 'सुरंग में ड्राइव', vHrGallery: 'निकासी गलियारा', hrSection: 'भूगर्भीय काट', hrTraffic: 'वाहन',
    hrImmerseBtn: 'सुरंग खंड डुबोने का अनुकरण', hrImBusy: 'खंड डुबोया जा रहा है…', hrImSpeed: 'अनुकरण गति',
    hrImNote: 'खंड संख्या 3 (120 मी) को खींचकर लाया जाता है, गिट्टी-पानी भरकर खोदी गई खाई में उतारा जाता है और पत्थरों से ढका जाता है। अनुकरण के दौरान सड़क बंद रहती है।',
    hrFollow: 'डुबोते समय कैमरा साथ चले',
    im_IDLE: 'प्रतीक्षा — सुरंग पूर्ण', im_FLOAT_IN: 'टगबोट तैरते खंड को खींचकर ला रही हैं', im_POSITION: 'खाई के ऊपर लंगर और स्थिति निर्धारण', im_BALLAST: 'गिट्टी-पानी भरा जा रहा है, खंड डूब रहा है',
    im_PULL_JOINT: 'जैक कसकर सटा रहे हैं, GINA गैस्केट दब रहा है', im_BACKFILL: 'रेत भराई और सुरक्षा पत्थर', im_DONE: 'पूर्ण — दोनों खंड जुड़ गए',
    hrLengthVal: '≈ 1,670 मी', hrWidthVal: '31.2 मी', hrSpan: 'नदी के नीचे डूबी सुरंग', hrSpanVal: '600 मी · 5 खंड',
    hrNote: '2025 का प्रस्ताव, निवेश 2031–2045 में प्रस्तावित, कुल लागत 6,880 अरब डोंग। काट, गहराई और द्वार की वास्तुकला अनुमानित हैं।',
    hrLblElements: 'डूबी सुरंग 5 × 120 मी', hrLblGina: 'GINA जोड़', hrLblBed: 'नदी तल −6 मी', hrLblPump: 'पंप स्टेशन', hrLblCover: 'तट पर खोदो-ढको 190 मी', hrLblRamp: 'खुला रैंप 207.5 मी', hrLblFlood: 'बाढ़-रोधी उभार +1.0 मी',
    hrStops: [
      ['वियतनाम की दूसरी नदी-पार सुरंग', '2025 का प्रस्ताव लगभग 1,670 मी लंबी सुरंग है जो दोंग दा (हाई चाऊ) को वान दोन (सोन ट्रा) से जोड़ती है: नदी के नीचे 600 मी डूबी सुरंग, तट पर 380 मी खोदो-ढको और 415 मी खुले रैंप। निवेश 2031–2045 में प्रस्तावित है।'],
      ['पश्चिमी द्वार · जालीदार छत', 'दिएन हाई किले के पास होने से द्वार नीचा रखा गया है और पुरानी ईंट के रंग में बनाया गया है। 80 मी की जालीदार छत तेज धूप से आने वाली गाड़ियों की चौंध घटाती है, बारिश रोकती है और तूफ़ानी हवा को निकल जाने देती है।'],
      ['बाढ़-रोधी उभार और फाटक', 'तेज बारिश और ऊँचे ज्वार के मेल से दा नांग में अक्सर जलभराव होता है। द्वार से पहले सड़क का शिखर गली से 1 मी ऊँचा रखा गया है, साथ में पानी रोकने वाला खिसकने वाला फाटक है।'],
      ['लंबवत काट', '120 मी के पाँच डूबे खंड नदी तल से लगभग 6 मी नीचे हैं, छत के ऊपर कम से कम 1 मी मिट्टी है। दोनों तटों पर दीवारों वाला खोदो-ढको खंड है, फिर 4.5% से अधिक ढलान न वाले खुले रैंप।'],
      ['खंड को डुबोना', 'हर खंड सूखे डॉक में ढाला जाता है, दोनों सिरे बंद करके खींचकर लाया जाता है और गिट्टी-पानी से खोदी गई खाई में उतारा जाता है। जैक उसे पड़ोसी खंड से सटाते हैं और रबर का GINA गैस्केट जल-रोधन करता है।'],
      ['यातायात नली के अंदर', 'हर दिशा में तीन लेन: दो लेन कारों के लिए 60 किमी/घंटा और दाईं ओर एक लेन मोटरसाइकिलों के लिए। जेट पंखे सुरंग में हवा चलाते हैं और प्रवेश क्षेत्र की रोशनी अधिक तेज रखी जाती है ताकि आँखें ढल सकें।'],
      ['निकासी गलियारा', 'दोनों नलियों के बीच धुआँ-रोधी, दबावयुक्त गलियारा है। हर 100 मी पर हरा आड़ा द्वार उसमें ले जाता है, और SOS बॉक्स व अग्निशामक हर 50 मी पर हैं।'],
      ['पूर्वी द्वार · सोन ट्रा', 'सोन ट्रा की ओर का द्वार समुद्री लहरों और मछुआरों के गाँव की याद दिलाता है, पास में टोकरी-नावें हैं। 6,880 अरब डोंग का प्रस्तावित निवेश ड्रैगन और सोंग हान पुलों का बोझ घटाएगा।']
    ]
  },
  ru: {
    loadingSub: 'Мост Дракона, Тхуанфуок, Чан Тхи Ли, разводной мост и тоннель под рекой Хан',
    bridgeHr: 'Тоннель реки Хан', vHrCutaway: 'Продольный разрез', vHrPortalW: 'Западный портал · цитадель Дьенхай', vHrPortalE: 'Восточный портал · Шонча',
    vHrDrive: 'Проезд по тоннелю', vHrGallery: 'Эвакуационный коридор', hrSection: 'Геологический разрез', hrTraffic: 'Транспорт',
    hrImmerseBtn: 'Симуляция погружения секции', hrImBusy: 'Секция погружается…', hrImSpeed: 'Скорость симуляции',
    hrImNote: 'Секцию № 3 (120 м) буксируют, заполняют балластом, опускают в траншею и засыпают камнем. На время симуляции дорога закрыта.',
    hrFollow: 'Камера следует за погружением',
    im_IDLE: 'Ожидание — тоннель готов', im_FLOAT_IN: 'Буксиры ведут плавучую секцию', im_POSITION: 'Швартовка и позиционирование над траншеей', im_BALLAST: 'Закачка балласта, секция тонет',
    im_PULL_JOINT: 'Домкраты подтягивают, прокладка GINA сжимается', im_BACKFILL: 'Засыпка песком и каменная пригрузка', im_DONE: 'Готово — две секции соединены',
    hrLengthVal: '≈ 1670 м', hrWidthVal: '31,2 м', hrSpan: 'Подводный тоннель', hrSpanVal: '600 м · 5 секций',
    hrNote: 'Предложение 2025 года, инвестиции планируются на 2031–2045 годы, общая стоимость 6880 млрд донгов. Сечение, глубины и архитектура порталов приблизительны.',
    hrLblElements: 'Погружной тоннель 5 × 120 м', hrLblGina: 'Стык GINA', hrLblBed: 'Дно реки −6 м', hrLblPump: 'Насосная станция', hrLblCover: 'Открытый способ 190 м', hrLblRamp: 'Открытая рампа 207,5 м', hrLblFlood: 'Противопаводковый порог +1,0 м',
    hrStops: [
      ['Второй речной тоннель Вьетнама', 'Предложение 2025 года — тоннель около 1670 м от улицы Донгда (Хайтяу) до Вандон (Шонча): 600 м погружного тоннеля под рекой, 380 м открытого способа на берегах и 415 м открытых рамп. Инвестиции планируются на 2031–2045 годы.'],
      ['Западный портал · жалюзийная крыша', 'Рядом с цитаделью Дьенхай портал сделан низким и облицован в тоне старого кирпича. Жалюзийная крыша длиной 80 м смягчает ослепление при въезде с яркого солнца, защищает от дождя и пропускает штормовой ветер.'],
      ['Противопаводковый порог и затвор', 'Дананг часто затапливает, когда сильный ливень совпадает с приливом. Гребень дороги перед порталом поднят на 1 м над улицей, а воду сдерживает раздвижной затвор.'],
      ['Продольный разрез', 'Пять погружных секций по 120 м лежат примерно на 6 м ниже дна реки, над кровлей — не менее 1 м грунта. На берегах — открытый способ со стеной в грунте, затем открытые рампы с уклоном не более 4,5%.'],
      ['Погружение секции', 'Каждую секцию отливают в сухом доке, закрывают с торцов и буксируют; балласт опускает её в выкопанную траншею. Домкраты прижимают её к соседней, а резиновая прокладка GINA герметизирует стык.'],
      ['Внутри тоннеля', 'По три полосы в каждую сторону: две для легковых со скоростью 60 км/ч и полоса мотоциклов справа. Струйные вентиляторы продувают тоннель, а зона у входа освещена ярче, чтобы глаза успели привыкнуть.'],
      ['Эвакуационный коридор', 'Между двумя трубами — коридор с подпором воздуха против дыма. Каждые 100 м зелёная дверь ведёт в него, а SOS-колонки и огнетушители стоят через 50 м.'],
      ['Восточный портал · Шонча', 'Портал со стороны Шончи напоминает морские волны и рыбацкие деревни, рядом стоят корзинные лодки. Планируемые 6880 млрд донгов разгрузят мосты Дракона и Хан.']
    ]
  }
};

for (const [code, add] of Object.entries(T)) {
  const file = join(dir, `${code}.json`);
  const json = JSON.parse(await readFile(file, 'utf8'));
  Object.assign(json, add);
  await writeFile(file, JSON.stringify(json, null, 2) + '\n');
  console.log(code, Object.keys(add).length, 'khóa');
}

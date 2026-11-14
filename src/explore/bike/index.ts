/* ============================ Lái xe máy: điều phối chế độ (lái một mình, máy tính) ============================
   Spec D-040. Cấu trúc theo explore/drive/index.ts; dùng lại các phần thuần của chế độ ô tô (mạng đường, va chạm, camera sau xe, HUD),
   drive/* không bao giờ import ngược từ bike/*.
   - Mạng đường DÙNG CHUNG với ô tô: drEnsureNet() của drive/index.ts (dựng một lần cho cả trang; drCollectRuntime chỉ push, dựng net thứ hai sẽ nhân đôi vật cản).
   - Thân va chạm: start() đặt drUseBody(BK_BODY), stop() trả DR_CAR_BODY (drive.start() cũng tự đặt lại thân ô tô).
   - Mỗi khung: phím → BkInput (keys.ts), grip + gió giật (fx.ts), bkStep với hộp xe tự động gần xe (trNearby), hình xe (model.ts),
     camera (camera.ts): mặc định góc thứ nhất trên yên, V trộn sang góc thứ ba (drCamPlace với CONFIG.bike.cam3) trong cam1.mixS; fov / near đổi thì onResize();
     mặt đồng hồ (dash.ts) vẽ lại ≤ dash.hz; controls.target theo xe (tâm vùng bóng đổ), HUD (đồng hồ + bản đồ nhỏ của ô tô), exNightStep(dt, false).
   - Mắt góc thứ nhất: đo MỘT lần khi người lái thật gắn vào mô hình thật (riderEye: giữa hai xương mắt ở tư thế ngồi nền, hệ thân xe), không theo xương mỗi khung;
     chưa có thì cam1.eye. Camera còn sát mắt (smoothstep(mix) < cam1.headMix, bkCamHideHead) thì ẩn đầu + mũ (rider.setFirstPerson). prefers-reduced-motion ⇒ cam1.motionReduced.
   - Phím (theo e.code, chỉ khi đang lái, bỏ ô nhập và tổ hợp Ctrl / Meta / Alt; blur / ẩn tab nhả hết): R về làn (bkRecover), Q / E xi nhan trái / phải (bkSignal),
     V đổi góc nhìn thứ nhất ↔ thứ ba, H còi (giữ; nhả khi blur / ẩn tab / focus vào ô nhập). Kéo chuột trái / vuốt trên canvas: nhìn quanh (thứ nhất) hoặc quay quanh xe (thứ ba).
   - Lớp body 'explore drive bike': khung HUD #drHud và các quy tắc CSS của body.drive áp nguyên; 'bike' cho phần riêng về sau.
   - Thoát: explore.exit() gọi bike.stop() rồi tải lại trang. Chưa có: nhiều người (Task 10), cảm ứng (Task 9). Mô hình thật: model.ts (làm nóng qua bkModelSetWarm bên dưới).
   - Người lái: rider.ts, nhân vật theo stChar (chung Đi dạo), nạp ở preload() / start() (làm nóng qua stRigSetWarm của stroll/index.ts); chưa về thì xe không người,
     về sau stop() thì bỏ. Người gắn vào neo yên của xe nên rời cảnh cùng model.group.
   - Âm thanh (sound.ts bkSound): đề máy ở start(), tắt máy ở stop(); mỗi khung một BkSoundIn tái dùng (hộp xe gần dùng lại mảng trNearby của bkStep,
     river từ |x| so với mép kè, tunnel từ ô mặt đường dưới xe, mưa = 0 trong đoạn hầm kín); nút 🔊 #drSoundBtn chung với ô tô, bkSound.bind chỉ toggle khi đang lái xe máy.
   - Đêm + mưa (fx.ts, Task 7): grip = bkGrip(weatherU.uWet, xe trong đoạn hầm kín) mỗi khung; gió giật cộng bkGustSteer vào steer (BkInput giữ nguyên, chỉ khi v > vBlend);
     bkFx (vệt pha ban đêm, bụi nước khi mưa) vào cảnh ở start(), ra ở stop(), cập nhật sau model.place. "Hầm kín" = ô kiểu 'tunnel' và |x| ≤ HR.coverHalf:
     ô 'tunnel.tube' gồm cả hai dốc hở (|x| ≤ rampHalf), nơi mặt đường roadOut ướt khi mưa (han-tunnel/materials.ts registerWet).
   - Mặt đường nhìn gần (roadFx.ts, Task 8, mốc bỏ được): start() bkRoadSet(true) ⇒ shared.uRoadNear = 1 (nếu CONFIG.bike.road.detail), stop() về 0.
   Mỗi khung không cấp phát (D-018). */
import * as THREE from 'three';
import { scene, camera, controls, canvas, renderer } from '../../core/renderer';
import { composer, onResize } from '../../core/postprocessing';
import { cam } from '../../views/state';
import { CONFIG } from '../../config';
import { driveView } from '../../environment/driveRoads';
import { drSetGate, type DrNet } from '../drive/net';
import { DR_GATE_SWING } from '../drive/roadData';
import { drUseBody, DR_CAR_BODY, type DrBox } from '../drive/collide';
import { drBindDrop } from '../drive/keys';
import { drHudShow, drHudHide, drHudUpdate, type DrMapDot } from '../drive/hud';
import { drEnsureNet } from '../drive';
import { trNearby } from '../../common/trafficQuery';
import { exNightStep } from '../nightShows';
import { weatherU, shared } from '../../core/shared';
import { bkCreate, bkStep, bkRecover, bkSignal, bkPitch, BK_BODY, type BkState, type BkInput } from './motion';
import { bkInputFromKeys, BK_KEYS } from './keys';
import { BkBike, bkModelLoad, bkModelSetWarm, bkModelWarmAlso, type BkPlace } from './model';
import { BkRider, bkRiderLoad, type BkRiderSig } from './rider';
import { bkCamCreate, bkCamStep, bkCamPlace, bkCamDrag, bkCamSetEye, bkCamHideHead, type BkCam } from './camera';
import { BkDash } from './dash';
import { bkSound, bkRiverK, type BkSoundIn } from './sound';
import { bkFx, bkFxWarmObject, bkGrip, bkGustSteer } from './fx';
import { bkRoadSet } from './roadFx';
import { HR } from '../../bridges/han-tunnel/profile';
import { stChar } from '../stroll/char';
import type { SwingController } from '../../bridges/song-han/SwingController';

/* Làm nóng shader của xe máy (D-018), như drive/index.ts drCarSetWarm: hai biến thể (vẽ thẳng ra canvas ban ngày, vào render target của composer ban đêm),
   đèn / sương / bóng lấy từ cảnh chính, camera chính. Nhóm làm nóng (mô hình, mặt đồng hồ, hình tạm, tấm bóng) do model.ts dựng, không thêm vào scene */
bkModelSetWarm(async (o: THREE.Object3D) => {
  const rt = renderer.getRenderTarget();
  renderer.setRenderTarget(null);
  const a = renderer.compileAsync(o, camera, scene);
  renderer.setRenderTarget(rt);
  await a;
  renderer.setRenderTarget(composer.readBuffer);
  const b = renderer.compileAsync(o, camera, scene);
  renderer.setRenderTarget(rt);
  await b;
});
bkModelWarmAlso(bkFxWarmObject);   // vệt pha + bụi nước làm nóng cùng lượt với mô hình

const BK_SOLO_SLOT = -1;   // bkCreate / drSpawnPose: lái một mình xuất phát ở giữa các chỗ của slot (trên Cầu Rồng, đi Đông, bên phải)
const C1 = CONFIG.bike.cam1;
const NO_DOTS: DrMapDot[] = [];   // lái một mình: bản đồ nhỏ không có xe người khác

let net: DrNet | null = null;
let state: BkState | null = null;
let ctrl: SwingController | null = null;
let model: BkBike | null = null;   // hình xe của mình, dựng lần đầu vào chế độ
let rider: BkRider | null = null;  // người lái có xương (rider.ts); null khi nhân vật chưa nạp / nạp lỗi: xe không người (không hình tạm cho người)
let riderCh = -1;                  // nhân vật của rider hiện có (stChar)
let riderGen = 0;                  // tăng ở mỗi start() / stop(): kết quả nạp về muộn của lần trước bị bỏ
const _sig: BkRiderSig = { lean: 0, acc: 0, susF: 0, susR: 0, steer: 0 };   // tín hiệu người lái tái dùng mỗi khung
const bkKeys = new Set<string>();   // e.code đang giữ
const camB: BkCam = bkCamCreate();  // camera thứ nhất / thứ ba (camera.ts); view mặc định 1
let dash: BkDash | null = null;     // mặt đồng hồ canvas, dựng lần đầu vào chế độ
let motionK = C1.motion;            // hệ số chuyển động phụ: prefers-reduced-motion ⇒ motionReduced (đọc ở start())
let eyeFor: BkRider | null = null;  // người lái đã đo mắt góc thứ nhất (riderEye)
const _eye = new THREE.Vector3();
const _rest: BkPlace = { x: 0, y: 0, z: 0, yaw: 0, pitch: 0, lean: 0, steer: 0, wheel: 0, susF: 0, susR: 0, braking: false, sig: 0 };
const _sig0: BkRiderSig = { lean: 0, acc: 0, susF: 0, susR: 0, steer: 0 };
const _inp: BkInput = { gas: 0, brake: 0, steer: 0, hard: false, grip: 1 };   // đầu vào tái dùng mỗi khung
const boxes: DrBox[] = [];          // hộp xe tự động gần xe, tái dùng mỗi khung
let saved: { fov: number; near: number; explore: boolean } | null = null;   // thứ start() đổi, stop() trả lại
const _snd: BkSoundIn = { v: 0, rpm: 0, throttle: 0, brakeK: 0, sus: 0, sig: 0, rain: 0, tunnel: false, river: 0, view: 1, near: boxes, nNear: 0, x: 0, z: 0, yaw: 0, t: 0 };   // đầu vào âm thanh tái dùng mỗi khung

const active = () => cam.mode === 'bike' && state !== null;
const inMode = () => active();     // chế độ xem (hết chỗ) ở Task 10
const isField = (t: EventTarget | null) => !!t && /^(SELECT|INPUT|TEXTAREA)$/.test((t as HTMLElement).tagName || '');

/* Một bước: cổng nhịp quay, chuyển động (sơ tán nằm trong bkStep), hình xe, camera, HUD, hiệu ứng đêm */
function advance(dt: number, inp: BkInput): void {
  const s = state!, n = net!;
  if (ctrl) drSetGate(n, DR_GATE_SWING, ctrl.state !== 'CLOSED');
  const nNear = trNearby(s.x, s.z, CONFIG.drive.ai.radius, boxes);
  bkStep(s, inp, n, boxes, nNear, dt);
  model!.place(s);
  const tunnel = bkInTunnel(n, s), dry = tunnel && bkCovered(s);
  bkFx.update(s, shared.uNight.value, dry ? 0 : weatherU.uRain.value, dt, s.pitch, dry ? 0 : weatherU.uWet.value);
  riderStep(s, dt);
  riderEye();
  bkCamStep(camB, s, dt, motionK);
  if (bkCamPlace(camera, s, camB, n, dt)) onResize();   // fov / near đổi trong lúc trộn góc nhìn
  rider?.setFirstPerson(bkCamHideHead(camB));   // cùng giá trị trộn đã làm mượt mà camera dùng
  if (dash) { dash.bind(model!.dashMat); dash.update(dt, s.v, s.rpm, s.sig); }
  controls.target.set(s.x, s.y, s.z);   // tâm vùng bóng đổ (main.ts shadowCenter) theo xe
  drHudUpdate(s, NO_DOTS);
  exNightStep(dt, false);
  soundStep(s, nNear, tunnel, dry);
}

/* Âm thanh: điền BkSoundIn từ trạng thái xe (không cấp phát); bkSound tự giới hạn số lần ghi tham số (updateMs) */
function soundStep(s: BkState, nNear: number, tunnel: boolean, dry: boolean): void {
  _snd.v = s.v; _snd.rpm = s.rpm; _snd.throttle = s.throttle; _snd.brakeK = s.brakeK; _snd.sig = s.sig;
  _snd.sus = Math.max(Math.abs(s.susF), Math.abs(s.susR));
  _snd.rain = dry ? 0 : weatherU.uRain.value; _snd.tunnel = tunnel; _snd.river = bkRiverK(s.x);
  _snd.view = camB.view; _snd.nNear = nNear; _snd.x = s.x; _snd.z = s.z; _snd.yaw = s.yaw; _snd.t = shared.uTime.value;
  bkSound.update(_snd);
}

/* Xe đang ở ô hầm không: ô chứa (x, z) có cao độ gần y nhất trong ± stepMax (như drive/net.ts drPadAt), kiểu 'tunnel'. Duyệt tuyến tính, không cấp phát */
function bkInTunnel(n: DrNet, s: BkState): boolean {
  const step = CONFIG.drive.stepMax;
  let best = -1, bestD = Infinity;
  for (let i = 0; i < n.pads.length; i++) {
    const p = n.pads[i];
    if (s.x < p.x0 || s.x > p.x1 || s.z < p.z0 || s.z > p.z1 || (p.gate !== undefined && n.closed.has(p.gate))) continue;
    const d = Math.abs(p.y(s.x, s.z) - s.y);
    if (d <= step && d < bestD) { best = i; bestD = d; }
  }
  return best >= 0 && n.pads[best].kind === 'tunnel';
}
/* Trong ô hầm thì đã ở đoạn có mái chưa (ngoài |x| > coverHalf là dốc hở: mưa, mặt ướt) */
const bkCovered = (s: BkState): boolean => Math.abs(s.x) <= HR.coverHalf;

/* Người lái theo xe (sau model.place): tín hiệu từ trạng thái chuyển động */
function riderStep(s: BkState, dt: number): void {
  if (!rider || !model) return;
  _sig.lean = s.lean; _sig.acc = s.acc; _sig.susF = s.susF; _sig.susR = s.susR; _sig.steer = s.steer;
  rider.update(model, _sig, dt);
}

/* Mắt góc thứ nhất theo người lái: đo một lần khi có người lái thật trên mô hình thật. Đặt xe về tư thế nghỉ (thẳng đứng, không lái, giảm xóc 0),
   người lái tư thế ngồi nền (lò xo phản ứng chưa chạy với người mới), giữa hai xương mắt (+ cam1.eyeFore; không có thì xương đầu + cam1.headEye)
   → hệ thân xe (nhóm ngoài: yaw · dốc, dốc = 0); rồi đặt lại như cũ */
function riderEye(): void {
  const s = state, r = rider, m = model;
  if (!r || !m || !m.real) { if (eyeFor) { eyeFor = null; bkCamSetEye(null); } return; }
  if (eyeFor === r || !s) return;
  eyeFor = r;
  _rest.x = s.x; _rest.y = s.y; _rest.z = s.z; _rest.yaw = s.yaw;
  m.place(_rest);
  r.update(m, _sig0, 0);
  r.setFirstPerson(false);
  const eyes = r.eyeLocal(m.group, _eye);
  bkCamSetEye(eyes ? { fore: _eye.x + C1.eyeFore, up: _eye.y } : { fore: _eye.x + C1.headEye.fore, up: _eye.y + C1.headEye.up });
  m.place(s);
  riderStep(s, 0);
}

/* Nạp người lái theo nhân vật đã chọn (stChar, chung với Đi dạo). Về sau stop() / start() khác thì bỏ; nhân vật đổi thì thay người cũ */
function riderNeed(): void {
  const ch = stChar.get(), gen = ++riderGen;
  if (rider && riderCh === ch) return;
  void bkRiderLoad(ch).then((src) => {
    if (gen !== riderGen || state === null || !src) return;
    try {
      const r = new BkRider(src);
      rider?.dispose(); rider = r; riderCh = ch;
      riderStep(state, 0);
    } catch (e) { console.warn('Lái xe máy: không dựng được người lái', e); }
  });
}

/* Xe đứng yên ở (x, z) hướng yaw, trạng thái mới; y bỏ trống thì lấy mặt đường cao nhất tại đó. Cho test (__app.bike) và đặt lại vị trí */
function bkPlaceAt(x: number, z: number, yaw: number, y?: number): void {
  if (!net || !model) return;
  const s = bkCreate(net, BK_SOLO_SLOT);
  let gy = -Infinity;
  for (const p of net.pads) {
    if (x < p.x0 || x > p.x1 || z < p.z0 || z > p.z1 || (p.gate !== undefined && net.closed.has(p.gate))) continue;
    gy = Math.max(gy, p.y(x, z));
  }
  s.x = x; s.z = z; s.yaw = yaw; s.y = y ?? (Number.isFinite(gy) ? gy : CONFIG.roadY);
  bkPitch(s, net);
  state = s;
  bkCamReset();
  model.place(s);
  riderStep(s, 0);
  riderEye();
  if (bkCamPlace(camera, s, camB, net, 0, true)) onResize();
  controls.target.set(s.x, s.y, s.z);
}

/* Trạng thái camera về đầu (giữ góc nhìn đang chọn, trộn xong ngay) */
function bkCamReset(): void {
  const v = camB.view;
  Object.assign(camB, bkCamCreate());
  camB.view = v; camB.mix = v === 3 ? 1 : 0;
}

export const bike = {
  active,
  inMode,
  get state(): BkState | null { return state; },
  get net(): DrNet | null { return net; },
  get model(): BkBike | null { return model; },   // hình xe của mình (test: real, anchors)
  get rider(): BkRider | null { return rider; },  // người lái (test: debug(), setFirstPerson)
  get view(): 1 | 3 { return camB.view; },
  get cam(): BkCam { return camB; },               // test: mix, roll, bob, surge, yaw / pitch nhìn quanh
  get dash(): BkDash | null { return dash; },
  get cfg(): typeof CONFIG.bike { return CONFIG.bike; },   // test / kiểm tay: chỉnh số camera lúc chạy
  get sound(): typeof bkSound { return bkSound; },        // test: nodes(), on, graph
  get fx(): typeof bkFx { return bkFx; },                 // test: drawn() (vệt pha, số hạt bụi nước), group
  /* Đổi góc nhìn: trộn vị trí + hướng + fov + near trong cam1.mixS, không dừng xe */
  setView(v: 1 | 3): void { camB.view = v === 3 ? 3 : 1; },
  /* Vào lái một mình */
  start(): void {
    drUseBody(BK_BODY);
    const n = drEnsureNet();
    net = n;
    state = bkCreate(n, BK_SOLO_SLOT);
    camB.view = 1; bkCamReset();
    motionK = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches ? C1.motionReduced : C1.motion;
    if (!model) model = new BkBike();
    if (!dash) dash = new BkDash();
    scene.add(model.group);
    model.place(state);
    scene.add(bkFx.group); bkFx.start(n);
    bkRoadSet(true);                          // hạt nhựa + vệt ướt trên vật liệu đường (roadFx.ts; uRoadNear = 1 nếu CONFIG.bike.road.detail)
    riderNeed();
    riderStep(state, 0);
    driveView.far = CONFIG.drive.tunnelFar;   // mặt đường hầm hiện ở nút giao với hai đường dọc mới, như ô tô
    bkKeys.clear();
    drHudShow(n); bkSound.start();
    if (!saved) saved = { fov: camera.fov, near: camera.near, explore: document.body.classList.contains('explore') };
    cam.flight.then = null; cam.mode = 'bike'; controls.enabled = false;
    riderEye();
    bkCamPlace(camera, state, camB, n, 0, true); onResize();   // fov / near góc thứ nhất; onResize cập nhật ma trận chiếu và hệ số cỡ điểm
    controls.target.set(state.x, state.y, state.z);
    document.body.classList.add('explore', 'drive', 'bike');
  },
  update(dt: number): void {
    if (!active()) return;
    bkInputFromKeys(bkKeys, _inp);
    bkSound.horn(bkKeys.has('KeyH'));
    const s = state!, tun = bkInTunnel(net!, s) && bkCovered(s), wd = weatherU.uWindDir.value;
    _inp.grip = bkGrip(weatherU.uWet.value, tun);                                       // mặt ướt (trễ theo mưa); đoạn hầm kín luôn khô
    _inp.steer += bkGustSteer(s.v, weatherU.uGust.value, wd[0], wd[1], s.yaw);        // gió giật đẩy nhẹ độ nghiêng (≤ fx.gust.steer)
    advance(dt, _inp);
  },
  /* Gọi ngay sau lệnh vẽ khung chính (main.ts); chỗ cho mặt đồng hồ / chụp ảnh của task sau */
  afterRender(): void { /* chưa có việc */ },
  /* Rời chế độ: trả mọi thứ đã đổi, kể cả khi cam.mode đã bị chỗ khác đổi khỏi 'bike' */
  stop(): void {
    if (state === null) return;
    state = null; bkKeys.clear(); riderGen++;
    bkSound.stop();
    rider?.setFirstPerson(false);
    drHudHide();
    model?.group.removeFromParent();
    bkFx.stop();
    bkRoadSet(false);                         // uRoadNear = 0: vật liệu đường về đúng ảnh cũ
    driveView.far = 1;
    drUseBody(DR_CAR_BODY);
    document.body.classList.remove('drive', 'bike');
    if (saved) {
      if (!saved.explore) document.body.classList.remove('explore');
      camera.fov = saved.fov; camera.near = saved.near; onResize();   // onResize tính lại ma trận chiếu theo fov / near cũ
      saved = null;
    }
    if (cam.mode === 'bike') { cam.mode = 'orbit'; controls.enabled = true; }
  },
  /* Cho test: như update nhưng nhận đầu vào trực tiếp; đặt xe tại chỗ */
  step(dt: number, inp: BkInput): void { if (active()) advance(dt, inp); },
  placeAt: bkPlaceAt,
  /* Nạp mô hình thật (scooter.glb) và nhân vật người lái sớm, khi chọn thẻ Xe máy */
  preload(): void { void bkModelLoad(); void bkRiderLoad(stChar.get()); }
};

/* onExit: thoát chung (explore.exit), dùng khi mất kết nối lúc đang xem (Task 10) */
export function setupBike(c: SwingController, onExit: () => void): void {
  ctrl = c; void onExit;
  window.addEventListener('keydown', (e) => {
    if (!active() || e.key === 'Escape') return;   // Esc do explore/index.ts xử lý (thoát chung)
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    if (isField(e.target)) return;
    if (!BK_KEYS.has(e.code)) return;
    if (e.code.startsWith('Arrow') || e.code === 'Space') e.preventDefault();   // không cuộn trang, Space không bấm nút đang focus
    bkKeys.add(e.code);
    if (e.repeat) return;
    /* phím một lần (không theo giữ): về làn, xi nhan, góc nhìn */
    if (e.code === 'KeyR') bkRecover(state!, net!);
    else if (e.code === 'KeyQ') bkSignal(state!, 1);
    else if (e.code === 'KeyE') bkSignal(state!, -1);
    else if (e.code === 'KeyV') bike.setView(camB.view === 3 ? 1 : 3);
  });
  window.addEventListener('keyup', (e) => {
    bkKeys.delete(e.code);
    if (e.code === 'Space' && active() && !isField(e.target)) e.preventDefault();
  });
  const drop = drBindDrop(window, document, bkKeys);
  window.addEventListener('focusin', (e) => { if (active() && isField(e.target)) { drop(); bkSound.horn(false); } });
  window.addEventListener('blur', () => bkSound.horn(false));
  document.addEventListener('visibilitychange', () => { if (document.hidden) bkSound.horn(false); });
  bkSound.bind(document.getElementById('drSoundBtn'));   // nút 🔊 / 🔇 chung với ô tô: chỉ toggle tiếng xe máy khi đang lái xe máy
  /* Kéo chuột trái / vuốt (một ngón) trên canvas: nhìn quanh (góc thứ nhất) hoặc quay quanh xe (góc thứ ba) */
  let dragId = -1, lx = 0, ly = 0;
  canvas.addEventListener('pointerdown', (e) => {
    if (!active() || e.button !== 0 || dragId !== -1) return;
    dragId = e.pointerId; lx = e.clientX; ly = e.clientY;
    canvas.setPointerCapture(e.pointerId);
  });
  canvas.addEventListener('pointermove', (e) => {
    if (e.pointerId !== dragId) return;
    bkCamDrag(camB, e.clientX - lx, e.clientY - ly);
    lx = e.clientX; ly = e.clientY;
  });
  const end = (e: PointerEvent) => { if (e.pointerId === dragId) dragId = -1; };
  canvas.addEventListener('pointerup', end);
  canvas.addEventListener('pointercancel', end);
  canvas.addEventListener('lostpointercapture', end);
}

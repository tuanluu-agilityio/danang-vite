/* ============================ Lái xe máy: điều phối chế độ (lái một mình, máy tính) ============================
   Spec D-040. Cấu trúc theo explore/drive/index.ts; dùng lại các phần thuần của chế độ ô tô (mạng đường, va chạm, camera sau xe, HUD),
   drive/* không bao giờ import ngược từ bike/*.
   - Mạng đường DÙNG CHUNG với ô tô: drEnsureNet() của drive/index.ts (dựng một lần cho cả trang; drCollectRuntime chỉ push, dựng net thứ hai sẽ nhân đôi vật cản).
   - Thân va chạm: start() đặt drUseBody(BK_BODY), stop() trả DR_CAR_BODY (drive.start() cũng tự đặt lại thân ô tô).
   - Mỗi khung: phím → BkInput (keys.ts), grip = 1 (Task 7 nối thời tiết), bkStep với hộp xe tự động gần xe (trNearby), hình xe (model.ts),
     camera góc thứ ba = drCamPlace với CONFIG.bike.cam3, controls.target theo xe (tâm vùng bóng đổ), HUD (đồng hồ + bản đồ nhỏ của ô tô), exNightStep(dt, false).
   - Phím (theo e.code, chỉ khi đang lái, bỏ ô nhập và tổ hợp Ctrl / Meta / Alt; blur / ẩn tab nhả hết): R về làn (bkRecover), Q / E xi nhan trái / phải (bkSignal),
     V đổi góc nhìn (góc thứ nhất ở Task 5, giờ chỉ có góc thứ ba). Còi H: âm thanh ở Task 8.
   - Lớp body 'explore drive bike': khung HUD #drHud và các quy tắc CSS của body.drive áp nguyên; 'bike' cho phần riêng về sau.
   - Thoát: explore.exit() gọi bike.stop() rồi tải lại trang. Chưa có: nhiều người (Task 10), cảm ứng (Task 9). Mô hình thật: model.ts (làm nóng qua bkModelSetWarm bên dưới).
   - Người lái: rider.ts, nhân vật theo stChar (chung Đi dạo), nạp ở preload() / start() (làm nóng qua stRigSetWarm của stroll/index.ts); chưa về thì xe không người,
     về sau stop() thì bỏ. Người gắn vào neo yên của xe nên rời cảnh cùng model.group.
   Mỗi khung không cấp phát (D-018). */
import type * as THREE from 'three';
import { scene, camera, controls, canvas, renderer } from '../../core/renderer';
import { composer, onResize } from '../../core/postprocessing';
import { cam } from '../../views/state';
import { CONFIG } from '../../config';
import { driveView } from '../../environment/driveRoads';
import { drSetGate, type DrNet } from '../drive/net';
import { DR_GATE_SWING } from '../drive/roadData';
import { drUseBody, DR_CAR_BODY, type DrBox } from '../drive/collide';
import { drCamPlace, drCamDrag, type DrCam } from '../drive/camera';
import { drBindDrop } from '../drive/keys';
import { drHudShow, drHudHide, drHudUpdate, type DrMapDot } from '../drive/hud';
import { drEnsureNet } from '../drive';
import { trNearby } from '../../common/trafficQuery';
import { exNightStep } from '../nightShows';
import { bkCreate, bkStep, bkRecover, bkSignal, bkPitch, BK_BODY, type BkState, type BkInput } from './motion';
import { bkInputFromKeys, BK_KEYS } from './keys';
import { BkBike, bkModelLoad, bkModelSetWarm } from './model';
import { BkRider, bkRiderLoad, type BkRiderSig } from './rider';
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

const BK_SOLO_SLOT = -1;   // bkCreate / drSpawnPose: lái một mình xuất phát ở giữa các chỗ của slot (trên Cầu Rồng, đi Đông, bên phải)
const K3 = CONFIG.bike.cam3;
const NO_DOTS: DrMapDot[] = [];   // lái một mình: bản đồ nhỏ không có xe người khác

let net: DrNet | null = null;
let state: BkState | null = null;
let ctrl: SwingController | null = null;
let model: BkBike | null = null;   // hình xe của mình, dựng lần đầu vào chế độ
let rider: BkRider | null = null;  // người lái có xương (rider.ts); null khi nhân vật chưa nạp / nạp lỗi: xe không người (không hình tạm cho người)
let riderCh = -1;                  // nhân vật của rider hiện có (stChar)
let riderGen = 0;                  // tăng ở mỗi start() / stop(): kết quả nạp về muộn của lần trước bị bỏ
const _sig: BkRiderSig = { lean: 0, acc: 0, susF: 0, susR: 0, steer: 0 };   // tín hiệu người lái tái dùng mỗi khung
let view: 1 | 3 = 3;
const bkKeys = new Set<string>();   // e.code đang giữ
const camS: DrCam = { yaw: 0, pitch: 0, idle: 0 };
const _inp: BkInput = { gas: 0, brake: 0, steer: 0, hard: false, grip: 1 };   // đầu vào tái dùng mỗi khung
const boxes: DrBox[] = [];          // hộp xe tự động gần xe, tái dùng mỗi khung
let saved: { fov: number; near: number; explore: boolean } | null = null;   // thứ start() đổi, stop() trả lại

const active = () => cam.mode === 'bike' && state !== null;
const inMode = () => active();     // chế độ xem (hết chỗ) ở Task 10
const isField = (t: EventTarget | null) => !!t && /^(SELECT|INPUT|TEXTAREA)$/.test((t as HTMLElement).tagName || '');

/* Một bước: cổng nhịp quay, chuyển động (sơ tán nằm trong bkStep), hình xe, camera, HUD, hiệu ứng đêm */
function advance(dt: number, inp: BkInput): void {
  const s = state!, n = net!;
  if (ctrl) drSetGate(n, DR_GATE_SWING, ctrl.state !== 'CLOSED');
  bkStep(s, inp, n, boxes, trNearby(s.x, s.z, CONFIG.drive.ai.radius, boxes), dt);
  model!.place(s);
  riderStep(s, dt);
  drCamPlace(camera, s, camS, n, dt, false, K3);
  controls.target.set(s.x, s.y, s.z);   // tâm vùng bóng đổ (main.ts shadowCenter) theo xe
  drHudUpdate(s, NO_DOTS);
  exNightStep(dt, false);
}

/* Người lái theo xe (sau model.place): tín hiệu từ trạng thái chuyển động */
function riderStep(s: BkState, dt: number): void {
  if (!rider || !model) return;
  _sig.lean = s.lean; _sig.acc = s.acc; _sig.susF = s.susF; _sig.susR = s.susR; _sig.steer = s.steer;
  rider.update(model, _sig, dt);
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
  camS.yaw = 0; camS.pitch = 0; camS.idle = 0;
  model.place(s);
  riderStep(s, 0);
  drCamPlace(camera, s, camS, net, 0, true, K3);
  controls.target.set(s.x, s.y, s.z);
}

export const bike = {
  active,
  inMode,
  get state(): BkState | null { return state; },
  get net(): DrNet | null { return net; },
  get model(): BkBike | null { return model; },   // hình xe của mình (test: real, anchors)
  get rider(): BkRider | null { return rider; },  // người lái (test: debug(), setFirstPerson)
  get view(): 1 | 3 { return view; },
  /* Đổi góc nhìn: góc thứ nhất làm ở Task 5, giờ luôn góc thứ ba */
  setView(v: 1 | 3): void { view = v === 1 ? 3 : v; },
  /* Vào lái một mình */
  start(): void {
    drUseBody(BK_BODY);
    const n = drEnsureNet();
    net = n;
    state = bkCreate(n, BK_SOLO_SLOT);
    camS.yaw = 0; camS.pitch = 0; camS.idle = 0;
    if (!model) model = new BkBike();
    scene.add(model.group);
    model.place(state);
    riderNeed();
    riderStep(state, 0);
    driveView.far = CONFIG.drive.tunnelFar;   // mặt đường hầm hiện ở nút giao với hai đường dọc mới, như ô tô
    bkKeys.clear();
    drHudShow(n);
    if (!saved) saved = { fov: camera.fov, near: camera.near, explore: document.body.classList.contains('explore') };
    cam.flight.then = null; cam.mode = 'bike'; controls.enabled = false;
    camera.fov = K3.fov; onResize();          // onResize cập nhật ma trận chiếu và hệ số cỡ điểm theo fov mới
    drCamPlace(camera, state, camS, n, 0, true, K3);
    controls.target.set(state.x, state.y, state.z);
    document.body.classList.add('explore', 'drive', 'bike');
  },
  update(dt: number): void {
    if (!active()) return;
    bkInputFromKeys(bkKeys, _inp);
    _inp.grip = 1;                            // Task 7: theo thời tiết (weatherU.uWet), khô trong hầm kín
    advance(dt, _inp);
  },
  /* Gọi ngay sau lệnh vẽ khung chính (main.ts); chỗ cho mặt đồng hồ / chụp ảnh của task sau */
  afterRender(): void { /* chưa có việc */ },
  /* Rời chế độ: trả mọi thứ đã đổi, kể cả khi cam.mode đã bị chỗ khác đổi khỏi 'bike' */
  stop(): void {
    if (state === null) return;
    state = null; bkKeys.clear(); riderGen++;
    drHudHide();
    model?.group.removeFromParent();
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
    else if (e.code === 'KeyV') bike.setView(view === 3 ? 1 : 3);
  });
  window.addEventListener('keyup', (e) => {
    bkKeys.delete(e.code);
    if (e.code === 'Space' && active() && !isField(e.target)) e.preventDefault();
  });
  const drop = drBindDrop(window, document, bkKeys);
  window.addEventListener('focusin', (e) => { if (active() && isField(e.target)) drop(); });
  /* Kéo chuột trái trên canvas: xoay camera quanh xe */
  let dragId = -1, lx = 0, ly = 0;
  canvas.addEventListener('pointerdown', (e) => {
    if (!active() || e.pointerType === 'touch' || e.button !== 0) return;
    dragId = e.pointerId; lx = e.clientX; ly = e.clientY;
    canvas.setPointerCapture(e.pointerId);
  });
  canvas.addEventListener('pointermove', (e) => {
    if (e.pointerId !== dragId) return;
    drCamDrag(camS, e.clientX - lx, e.clientY - ly, K3);
    lx = e.clientX; ly = e.clientY;
  });
  const end = (e: PointerEvent) => { if (e.pointerId === dragId) dragId = -1; };
  canvas.addEventListener('pointerup', end);
  canvas.addEventListener('pointercancel', end);
  canvas.addEventListener('lostpointercapture', end);
}

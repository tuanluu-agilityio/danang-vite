/* ============================ Lái xe máy: hình xe (hình tạm + mô hình thật public/bike/scooter.glb) ============================
   BkBike: một nhóm đặt ở điểm giữa hai vệt bánh trên mặt đường (tâm thân xe, y = mặt đường), xoay yaw quanh Y rồi pitch quanh Z cục bộ (như DrCar);
   bên trong một nút cuộn `lean` quanh trục dọc X cục bộ đi qua mặt đường (đường chạm đất): lean > 0 nghiêng trái (−Z cục bộ khi mũi +X), nên
   cuộn là −lean quanh +X. Tấm bóng mờ ở nhóm ngoài (không cuộn theo xe).
   - Hình tạm: hình 'bike' của common/vehicles/shapes.ts (xe tay ga + người lái đội mũ, mũi +X, mặt đường y = 0) chép ra, tô màu các phần
     màu theo instance (sơn, áo, mũ) bằng CONFIG.bike.model.temp, giãn theo X cho đúng chiều dài thân va chạm (CONFIG.bike.body.length). Một Mesh.
   - Mô hình thật (scripts/bike/convert.py, npm run gen:bike): bkModelLoad() import() động GLTFLoader, nạp một lần, nhớ đệm; lỗi / quá model.timeoutMs →
     console.warn một lần, null; promise không bao giờ bị từ chối; nạp xong muộn thì xe đang có vẫn đổi sang mô hình thật (`late`, như drive/car.ts).
     Cây nút: scooter → body (4 lưới: body, lamp_tail, lamp_sig_l, lamp_sig_r; neo foot_l / foot_r / seat / eye), front (gốc trên trục cổ lái, userData.axis;
     4 lưới: trim, lamp_head, mirror, dash; neo grip_l / grip_r; wheel_f), wheel_r. Mỗi xe một bản sao (dùng chung hình học / vật liệu nguồn), lớp 1, không bóng.
     Lệnh vẽ mô hình thật: 8 thân + 2 bánh + 1 bóng = 11 (hình tạm: 2). Xe máy người khác cũng dùng mô hình thật (+ người lái 4 lệnh) khi đã nạp (D-040, 2026-11-14).
   - Đèn: vá phát sáng bằng onBeforeCompile đọc shared.uNight (không PointLight): hệ số = max(uNight · night, uOn). Đèn pha luôn sáng (uOn = headDay);
     đèn hậu chỉ sáng đêm, phanh thì uOn = tailBrake; xi nhan uOn = sigOn ở nửa chu kỳ sáng. Bản "sáng" là vật liệu thứ hai cùng customProgramCacheKey,
     chỉ khác uniform: đổi tham chiếu vật liệu của lưới, không biên dịch lại. Xi nhan nháy theo shared.uTime (thời gian khung, main.ts), không setInterval.
   - Mặt đồng hồ: mỗi xe một MeshBasicMaterial (dashMat) thay vật liệu `dash` của nguồn; UV 0..1 kiểu glTF (v = 0 phía trước xe, u tăng sang phải người lái):
     texture canvas gắn sau phải đặt flipY = false để đỉnh canvas nằm phía trước.
   - place(): thân = vị trí · yaw · pitch · cuộn lean quanh đường chạm đất; `front` xoay `steer` (kẹp ±model.steerLock) quanh trục cổ lái; bánh lăn quanh Z cục bộ
     theo `wheel` (xe tiến: góc âm); susF trượt bánh trước dọc trục cổ lái (+ = nén), susR nâng bánh sau so với thân; phần trên lò xo (nút gốc scooter) xoay quanh Z
     và hạ / nâng cho đúng hai tâm bánh ở độ cao nghỉ (bánh luôn chạm đất, đầu / đuôi chúi theo giảm xóc).
   - anchors: neo cho người lái (Task 4). Trước khi có mô hình thật là nút rỗng ở gốc nút cuộn; đổi sang mô hình thì trỏ tới nút trong bản sao (đọc lại sau khi real).
   Không cấp phát mỗi khung (D-018). */
import * as THREE from 'three';
import { CONFIG } from '../../config';
import { shared } from '../../core/shared';
import { vhBuildTypeGeometry, Role } from '../../common/vehicles/shapes';

export interface BkPlace { x: number; y: number; z: number; yaw: number; pitch: number; lean: number; steer: number; wheel: number; susF: number; susR: number; braking: boolean; sig: -1 | 0 | 1 }
export interface BkAnchors { gripL: THREE.Object3D; gripR: THREE.Object3D; footL: THREE.Object3D; footR: THREE.Object3D; seat: THREE.Object3D; eye: THREE.Object3D }

const B = CONFIG.bike.body, M = CONFIG.bike.model;
const AXY = new THREE.Vector3(0, 1, 0), AXZ = new THREE.Vector3(0, 0, 1);
const ANCHORS: [keyof BkAnchors, string][] = [['gripL', 'grip_l'], ['gripR', 'grip_r'], ['footL', 'foot_l'], ['footR', 'foot_r'], ['seat', 'seat'], ['eye', 'eye']];
const _q = new THREE.Quaternion(), _v = new THREE.Vector3();

/* ===== Vật liệu, hình học dùng chung ===== */
let tempMat: THREE.MeshStandardMaterial | null = null, shadowMat: THREE.MeshBasicMaterial | null = null, shadowGeo: THREE.PlaneGeometry | null = null;

/* Hình tạm: chép hình 'bike' của đội xe, bỏ aRole, tô màu phần màu theo instance, giãn X về chiều dài thân. shirtColor: màu áo khác mặc định (xe người khác: màu slot) */
function bkTempGeometry(shirtColor?: THREE.ColorRepresentation): THREE.BufferGeometry {
  const g = vhBuildTypeGeometry('bike').clone();
  const role = g.getAttribute('aRole') as THREE.BufferAttribute, col = g.getAttribute('color') as THREE.BufferAttribute;
  const T = M.temp, paint = new THREE.Color(T.paint), shirt = new THREE.Color(shirtColor ?? T.shirt), helmet = new THREE.Color(T.helmet);
  for (let i = 0; i < role.count; i++) {
    const r = role.getX(i), c = r === Role.Paint ? paint : r === Role.Accent ? shirt : r === Role.Helmet ? helmet : null;
    if (c) col.setXYZ(i, c.r, c.g, c.b);
  }
  g.deleteAttribute('aRole');
  g.computeBoundingBox();
  const bb = g.boundingBox!, len = bb.max.x - bb.min.x;
  g.scale(B.length / len, 1, 1);                                     // mặt cắt giữ nguyên, chỉ dài theo thân va chạm
  g.computeBoundingBox(); g.computeBoundingSphere();
  return g;
}

/* Tấm bóng mờ: elip mép mềm alpha = (1 − r²)^shadow.soft (xe máy hẹp; tấm vuông bo của ô tô thành mảng chữ nhật tối dưới xe máy).
   Cùng tham số vật liệu với drShadowShared của ô tô (chỉ khác ảnh) ⇒ cùng program; ô tô không đổi */
function bkShadowShared(): void {
  if (shadowMat) return;
  const n = 32, d = new Uint8Array(n * n * 4);
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
    const u = (x + 0.5) / n * 2 - 1, v = (y + 0.5) / n * 2 - 1;
    const r2 = u * u + v * v, a = r2 >= 1 ? 0 : Math.pow(1 - r2, M.shadow.soft);
    d[(y * n + x) * 4 + 3] = Math.round(255 * a);
  }
  const tex = new THREE.DataTexture(d, n, n, THREE.RGBAFormat); tex.needsUpdate = true;
  tex.magFilter = tex.minFilter = THREE.LinearFilter;
  shadowMat = new THREE.MeshBasicMaterial({ color: 0x000000, map: tex, transparent: true, opacity: M.shadow.opacity, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2, fog: false });
  shadowMat.name = 'bikeShadow';
  shadowGeo = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2);
}
function bkTempMaterial(): THREE.MeshStandardMaterial {
  if (!tempMat) { tempMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.6, metalness: 0.1 }); tempMat.name = 'bikeTemp'; }
  return tempMat;
}
/* Vật liệu mặt đồng hồ: mỗi xe một bản, cùng tham số ⇒ cùng program. Có sẵn map (ảnh 1 × 1 trắng) để program đã làm nóng trùng với lúc
   dash.ts gắn texture canvas (đổi map cùng loại không biên dịch lại) */
let dashBlank: THREE.DataTexture | null = null;
function bkDashMaterial(): THREE.MeshBasicMaterial {
  if (!dashBlank) { dashBlank = new THREE.DataTexture(new Uint8Array([255, 255, 255, 255]), 1, 1, THREE.RGBAFormat); dashBlank.colorSpace = THREE.SRGBColorSpace; dashBlank.needsUpdate = true; }
  const m = new THREE.MeshBasicMaterial({ color: M.dashColor, map: dashBlank });
  m.name = 'bikeDash';
  return m;
}

/* ===== Vật liệu đèn: phát sáng × max(uNight · night, uOn); `night` nằm trong chuỗi shader nên khóa program theo `key` ===== */
function bkLampPatch(m: THREE.MeshStandardMaterial, key: string, night: number, on: number): void {
  const uOn = { value: on };
  m.onBeforeCompile = (s) => {
    s.uniforms.uNight = shared.uNight;
    s.uniforms.uOn = uOn;
    s.fragmentShader = 'uniform float uNight;\nuniform float uOn;\n' + s.fragmentShader.replace('#include <emissivemap_fragment>',
      `#include <emissivemap_fragment>\ntotalEmissiveRadiance *= max( clamp( uNight, 0.0, 1.0 ) * ${night.toFixed(3)}, uOn );`);
  };
  m.customProgramCacheKey = () => key;
  m.userData.lampOn = on;
}

export interface BkSource {
  scene: THREE.Object3D;                       // cảnh gốc (không thêm vào cảnh; chỉ để sao chép)
  axis: THREE.Vector3;                         // trục cổ lái (đơn vị) trong hệ nút cha của front, hướng lên
  tail: THREE.Material; tailBrake: THREE.Material;
  sigL: THREE.Material; sigLOn: THREE.Material; sigR: THREE.Material; sigROn: THREE.Material;
}

/* Chuẩn hóa cảnh đã nạp thành nguồn dùng chung. Thiếu nút / vật liệu / trục thì ném lỗi (bkModelLoad bắt, trả null) */
export function bkModelSource(scene: THREE.Object3D): BkSource {
  for (const n of ['body', 'front', 'wheel_f', 'wheel_r', ...ANCHORS.map((a) => a[1])]) if (!scene.getObjectByName(n)) throw new Error(`thiếu nút ${n}`);
  const a = scene.getObjectByName('front')!.userData.axis as number[] | undefined;
  if (!Array.isArray(a) || a.length !== 3) throw new Error('front thiếu userData.axis');
  const axis = new THREE.Vector3(a[0], a[1], a[2]).normalize();
  const mats = new Map<string, THREE.MeshStandardMaterial>();
  scene.traverse((o) => {
    o.layers.set(1);
    const me = o as THREE.Mesh;
    if (!me.isMesh) return;
    me.castShadow = false; me.receiveShadow = false;
    const mat = me.material as THREE.MeshStandardMaterial;
    if (!mats.has(mat.name)) mats.set(mat.name, mat);
  });
  for (const n of ['lamp_head', 'lamp_tail', 'lamp_sig_l', 'lamp_sig_r', 'dash']) if (!mats.has(n)) throw new Error(`thiếu vật liệu ${n}`);
  bkLampPatch(mats.get('lamp_head')!, 'bkLampHead', M.headNight, M.headDay);
  const tail = mats.get('lamp_tail')!; bkLampPatch(tail, 'bkLampTail', M.tailNight, 0);
  const tailBrake = tail.clone(); bkLampPatch(tailBrake, 'bkLampTail', M.tailNight, M.tailBrake);   // cùng khóa: chỉ khác uniform
  const sig = (m: THREE.MeshStandardMaterial): THREE.MeshStandardMaterial => { bkLampPatch(m, 'bkLampSig', 0, 0); const on = m.clone(); bkLampPatch(on, 'bkLampSig', 0, M.sigOn); return on; };
  const sigL = mats.get('lamp_sig_l')!, sigR = mats.get('lamp_sig_r')!;
  return { scene, axis, tail, tailBrake, sigL, sigLOn: sig(sigL), sigR, sigROn: sig(sigR) };
}

/* ===== Nạp (nhớ đệm), làm nóng ===== */
let warm: ((o: THREE.Object3D) => Promise<unknown>) | null = null;
export function bkModelSetWarm(fn: ((o: THREE.Object3D) => Promise<unknown>) | null): void { warm = fn; }
/* Vật thể khác của chế độ cần làm nóng cùng lượt (fx.ts: vệt pha, bụi nước): mỗi hàm trả một nhóm tạm, gỡ ra sau khi làm nóng */
const warmAlso: (() => THREE.Object3D)[] = [];
export function bkModelWarmAlso(fn: () => THREE.Object3D): void { if (!warmAlso.includes(fn)) warmAlso.push(fn); }

/* Làm nóng mọi thứ xe dùng: cảnh nguồn (thân, cổ lái, bánh, đèn), mặt đồng hồ (MeshBasicMaterial), hình tạm, tấm bóng, cùng các nhóm của bkModelWarmAlso
   (vệt pha, bụi nước: khung đêm / mưa đầu tiên không giật). Bản đèn sáng / phanh cùng program với bản thường nên không cần. Gỡ cảnh nguồn ra (về không cha)
   sau khi làm nóng; chờ tối đa model.warmMs */
async function bkModelWarmAll(src: BkSource): Promise<void> {
  if (!warm) return;
  const g = new THREE.Group(), tg = bkTempGeometry(), dm = bkDashMaterial();
  g.add(new THREE.Mesh(tg, bkTempMaterial()));
  bkShadowShared(); g.add(new THREE.Mesh(shadowGeo!, shadowMat!));
  g.add(new THREE.Mesh(shadowGeo!, dm));
  g.add(src.scene);
  for (const f of warmAlso) g.add(f());
  let timer = 0;
  try { await Promise.race([warm(g), new Promise<void>((r) => { timer = setTimeout(r, M.warmMs) as unknown as number; })]); }
  catch { /* biên dịch trước lỗi: lần vẽ đầu tự biên dịch */ }
  finally { clearTimeout(timer); g.remove(src.scene); tg.dispose(); dm.dispose(); }
}

async function bkModelDefaultLoader(): Promise<THREE.Object3D> {
  const { GLTFLoader } = await import('three/addons/loaders/GLTFLoader.js');
  const gltf = await new GLTFLoader().loadAsync(import.meta.env.BASE_URL + M.url);
  return gltf.scene;
}

let loader: () => Promise<THREE.Object3D> = bkModelDefaultLoader;
let cache: Promise<BkSource | null> | null = null;
let late: Promise<BkSource | null> | null = null;   // nạp không giới hạn giờ: BkBike đổi sang mô hình thật cả khi xong sau timeoutMs
let ready: BkSource | null = null;                   // nguồn đã nạp + làm nóng xong (kể cả xong sau timeoutMs); null: chưa xong hoặc lỗi
let loadGen = 0;                                     // tăng khi đổi bộ nạp (test): kết quả của bộ nạp cũ không ghi vào ready

/* Nạp mô hình xe máy. Không bao giờ ném / từ chối: lỗi hoặc quá model.timeoutMs → warn một lần, null.
   Quá giờ chỉ là câu trả lời của bkModelLoad: việc nạp vẫn chạy tiếp, xe đang có (BkBike) đổi sang mô hình thật khi nó xong (late) */
export function bkModelLoad(): Promise<BkSource | null> {
  if (cache) return cache;
  const work = (async () => {
    const src = bkModelSource(await loader());
    await bkModelWarmAll(src);
    return src;
  })();
  const LATE = {} as BkSource;   // dấu quá giờ
  let timer = 0;
  const p = Promise.race([work, new Promise<BkSource>((r) => { timer = setTimeout(() => r(LATE), M.timeoutMs) as unknown as number; })])
    .then((s) => { if (s !== LATE) return s; console.warn(`Lái xe máy: nạp mô hình xe quá ${M.timeoutMs} ms, dùng hình tạm`); return null; },
      (e) => { console.warn('Lái xe máy: không nạp được mô hình xe, dùng hình tạm', e); return null; })
    .finally(() => clearTimeout(timer));
  late = work.catch(() => null);   // lỗi đã báo ở nhánh race
  const g = loadGen;
  void late.then((s) => { if (g === loadGen) ready = s; });
  cache = p;
  return p;
}

/* Nguồn mô hình nếu đã nạp + làm nóng xong (kể cả xong muộn sau timeoutMs), không thì null; lần gọi đầu bắt đầu nạp. Không ném.
   Cho xe máy người khác (multi/remoteDrive.ts): hỏi mỗi khung, có nguồn thì dựng xe thật ngay (BkBike opts.src), không chờ promise */
export function bkModelReady(): BkSource | null {
  if (!cache) void bkModelLoad();
  return ready;
}

/* Cho test: thay bộ nạp (null: mặc định), xóa đệm */
export function bkModelSetLoader(fn: (() => Promise<THREE.Object3D>) | null): void {
  loader = fn || bkModelDefaultLoader; cache = null; late = null; ready = null; loadGen++;
}

/* ===== Một xe máy =====
   Xe của mình: mặc định (hình tạm rồi tự đổi sang mô hình thật khi nạp xong).
   opts.lite: chỉ hình tạm (xe + người khối đội mũ, 1 lưới) + tấm bóng = 2 lệnh vẽ, không tự đổi, không nạp glb; opts.shirt: màu áo người khối (màu slot).
   Xe máy người chơi khác (multi/remoteDrive.ts) dùng bản lite làm hình tạm tới khi có cả mô hình lẫn nhân vật, rồi dựng xe mới với opts.src.
   opts.src: nguồn đã nạp (bkModelReady): đổi sang mô hình thật ngay trong constructor (không hình tạm, không chờ promise) */
export interface BkBikeOpts { lite?: boolean; shirt?: THREE.ColorRepresentation; src?: BkSource }
export class BkBike {
  readonly group = new THREE.Group();
  private readonly roll = new THREE.Group();                         // nút cuộn lean quanh đường chạm đất
  anchors: BkAnchors;
  dashMat: THREE.MeshBasicMaterial | null = null;
  private temp: THREE.Mesh | null;
  private tempGeo: THREE.BufferGeometry | null;
  private disposed = false;
  private src: BkSource | null = null;
  private root: THREE.Object3D | null = null;                        // bản sao `scooter`: phần trên lò xo
  private front: THREE.Object3D | null = null;
  private wheelF: THREE.Object3D | null = null;
  private wheelR: THREE.Object3D | null = null;
  private readonly frontQ0 = new THREE.Quaternion(); private readonly wfQ0 = new THREE.Quaternion(); private readonly wrQ0 = new THREE.Quaternion();
  private readonly frontP0 = new THREE.Vector3(); private readonly wfP0 = new THREE.Vector3(); private readonly wrP0 = new THREE.Vector3();
  private readonly axisF = new THREE.Vector3();                      // trục cổ lái trong hệ cục bộ của front lúc nghỉ
  private tailMeshes: THREE.Mesh[] = []; private sigLMeshes: THREE.Mesh[] = []; private sigRMeshes: THREE.Mesh[] = [];
  private brakingNow = false; private sigLNow = false; private sigRNow = false;
  private readonly last: BkPlace = { x: 0, y: 0, z: 0, yaw: 0, pitch: 0, lean: 0, steer: 0, wheel: 0, susF: 0, susR: 0, braking: false, sig: 0 };
  private placed = false;

  constructor(opts: BkBikeOpts = {}) {
    this.group.name = 'bike';
    this.group.add(this.roll);
    this.tempGeo = bkTempGeometry(opts.shirt);
    this.temp = new THREE.Mesh(this.tempGeo, bkTempMaterial());
    this.temp.name = 'bike-temp';
    this.temp.layers.set(1); this.temp.castShadow = false; this.temp.receiveShadow = false;
    this.roll.add(this.temp);
    bkShadowShared();
    const sh = new THREE.Mesh(shadowGeo!, shadowMat!);
    sh.scale.set(M.shadow.len, 1, M.shadow.wid);
    sh.position.y = M.shadow.lift;
    sh.layers.set(1); sh.castShadow = false; sh.receiveShadow = false; sh.renderOrder = 1;
    this.group.add(sh);
    const a = {} as BkAnchors;
    for (const [k, n] of ANCHORS) { const o = new THREE.Object3D(); o.name = 'bike-temp-' + n; this.roll.add(o); a[k] = o; }
    this.anchors = a;
    if (opts.src) { this.swap(opts.src); return; }
    if (opts.lite) return;
    void bkModelLoad();
    late!.then((src) => { if (src && !this.disposed) this.swap(src); });   // không bao giờ từ chối
  }

  /* Có mô hình thật chưa */
  get real(): boolean { return this.root !== null; }

  /* Đổi hình tạm sang bản sao mô hình thật, giữ nguyên vị trí */
  private swap(src: BkSource): void {
    if (this.root || this.disposed) return;
    const root = src.scene.clone();
    this.src = src;
    this.front = root.getObjectByName('front')!; this.wheelF = root.getObjectByName('wheel_f')!; this.wheelR = root.getObjectByName('wheel_r')!;
    this.frontQ0.copy(this.front.quaternion); this.frontP0.copy(this.front.position);
    this.wfQ0.copy(this.wheelF.quaternion); this.wfP0.copy(this.wheelF.position);
    this.wrQ0.copy(this.wheelR.quaternion); this.wrP0.copy(this.wheelR.position);
    this.axisF.copy(src.axis).applyQuaternion(_q.copy(this.frontQ0).invert());
    this.dashMat = bkDashMaterial();
    root.traverse((o) => {
      const m = o as THREE.Mesh;
      if (!m.isMesh) return;
      const mat = m.material as THREE.Material;
      if (mat.name === 'dash') m.material = this.dashMat!;
      else if (mat === src.tail) this.tailMeshes.push(m);
      else if (mat === src.sigL) this.sigLMeshes.push(m);
      else if (mat === src.sigR) this.sigRMeshes.push(m);
    });
    for (const [k] of ANCHORS) this.anchors[k].removeFromParent();
    const a = {} as BkAnchors;
    for (const [k, n] of ANCHORS) a[k] = root.getObjectByName(n)!;
    this.anchors = a;
    this.root = root;
    this.roll.add(root);
    if (this.temp) { this.roll.remove(this.temp); this.temp = null; this.tempGeo!.dispose(); this.tempGeo = null; }
    this.brakingNow = false; this.sigLNow = false; this.sigRNow = false;
    if (this.placed) this.place(this.last);
  }

  place(p: BkPlace): void {
    const l = this.last;
    if (p !== l) { l.x = p.x; l.y = p.y; l.z = p.z; l.yaw = p.yaw; l.pitch = p.pitch; l.lean = p.lean; l.steer = p.steer; l.wheel = p.wheel; l.susF = p.susF; l.susR = p.susR; l.braking = p.braking; l.sig = p.sig; }
    this.placed = true;
    const g = this.group;
    g.position.set(p.x, p.y, p.z);
    g.quaternion.setFromAxisAngle(AXY, p.yaw).multiply(_q.setFromAxisAngle(AXZ, p.pitch));
    this.roll.rotation.x = -p.lean;                                  // lean > 0 nghiêng trái (−Z cục bộ)
    const root = this.root;
    if (!root) return;
    const front = this.front!, wf = this.wheelF!, wr = this.wheelR!;
    /* cổ lái: xoay quanh trục (kẹp góc khóa lái); bánh trước trượt dọc trục theo susF */
    const st = p.steer > M.steerLock ? M.steerLock : p.steer < -M.steerLock ? -M.steerLock : p.steer === p.steer ? p.steer : 0;
    front.quaternion.setFromAxisAngle(this.src!.axis, st).multiply(this.frontQ0);
    wf.position.copy(this.axisF).multiplyScalar(p.susF).add(this.wfP0);
    wr.position.set(this.wrP0.x, this.wrP0.y + p.susR, this.wrP0.z);
    /* bánh lăn quanh Z cục bộ: xe tiến thì góc âm */
    wf.quaternion.copy(this.wfQ0).multiply(_q.setFromAxisAngle(AXZ, -p.wheel));
    wr.quaternion.copy(this.wrQ0).multiply(_q.setFromAxisAngle(AXZ, -p.wheel));
    /* phần trên lò xo: xoay φ quanh Z, dời ty sao cho hai tâm bánh về độ cao nghỉ của bánh sau (bánh chạm đất) */
    _v.copy(wf.position).applyQuaternion(front.quaternion).add(this.frontP0);   // tâm bánh trước trong hệ root
    const xf = _v.x, yf = _v.y, xr = wr.position.x, yr = wr.position.y;
    const phi = Math.atan2(yr - yf, xf - xr), sn = Math.sin(phi), cs = Math.cos(phi);
    root.rotation.set(0, 0, phi);
    root.position.set(0, this.wrP0.y - (xr * sn + yr * cs), 0);
    /* đèn: phanh, xi nhan (nửa chu kỳ đầu sáng) */
    if (p.braking !== this.brakingNow) {
      this.brakingNow = p.braking;
      const mat = p.braking ? this.src!.tailBrake : this.src!.tail;
      for (const m of this.tailMeshes) m.material = mat;
    }
    const ph = shared.uTime.value * M.sigHz, blink = ph - Math.floor(ph) < 0.5;
    const onL = p.sig === 1 && blink, onR = p.sig === -1 && blink;
    if (onL !== this.sigLNow) { this.sigLNow = onL; const mat = onL ? this.src!.sigLOn : this.src!.sigL; for (const m of this.sigLMeshes) m.material = mat; }
    if (onR !== this.sigRNow) { this.sigRNow = onR; const mat = onR ? this.src!.sigROn : this.src!.sigR; for (const m of this.sigRMeshes) m.material = mat; }
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.group.removeFromParent();
    if (this.temp) { this.roll.remove(this.temp); this.temp = null; }
    this.tempGeo?.dispose(); this.tempGeo = null;
    this.dashMat?.dispose(); this.dashMat = null;
    if (this.root) { this.roll.remove(this.root); this.root = null; }
    this.tailMeshes.length = 0; this.sigLMeshes.length = 0; this.sigRMeshes.length = 0;
  }
}

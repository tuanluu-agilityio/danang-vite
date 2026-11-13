/* ===== Người treo dù: điều phối (src/explore/pilot/index.ts) =====
   Gắn / cập nhật / gỡ nhân vật có xương dưới mỗi dù (của mình lẫn người khác), spec §4, §7:
   - plPreload(): bắt đầu nạp pilot.glb (thẻ Dù lượn, explore.start / startWatching). Trang thường, Đi dạo, Lái xe không gọi nên không tải (dù người khác nhìn từ đó là người khối).
   - plUpdate(): gọi từ exPlaceGlider mỗi khung. Nguồn chưa về / lỗi → giữ hình 'full' (người khối). Nguồn đã về và dù đang hiện → gắn trong vòng khung:
     mesh cánh đổi sang hình 'canopy', thêm nhóm con ex-pilot (rig.ts). Dù đang ẩn lúc nguồn về thì chưa gắn (Review Focus 1).
   - Tín hiệu (react.ts plSignals) từ vị trí + bank của chính dù nên dùng chung cho dù của mình, dù người khác, chế độ xem; gió đọc weatherU (cùng nguồn cây / mưa).
   - `?pilot=off` ép hình khối; group.userData.plOff = true (remote.ts: dù người khác khi pilot.remote = false hoặc điện thoại) cũng giữ hình khối.
   Không cấp phát mỗi khung (trừ lần gắn). */
import * as THREE from 'three';
import { CONFIG } from '../../config';
import { weatherU } from '../../core/shared';
import { exGliderGeometry } from '../glider';
import type { GliderState } from '../flight';
import { plSignals, type PlPose, type PlSignals, type PlTrack } from './react';
import { PlRig } from './rig';
import { plLoad, plSetWarm as plSetWarmLoad, type PlSource } from './load';

interface PlEntry { rig: PlRig | null; track: PlTrack; sig: PlSignals; seed: number }

const entries = new Map<THREE.Group, PlEntry>();
const OFF = typeof location !== 'undefined' && new URLSearchParams(location.search).get('pilot') === 'off';
let loader: () => Promise<PlSource | null> = plLoad;
let src: PlSource | null | undefined;   // undefined = chưa có kết quả, null = lỗi (giữ hình khối suốt phiên)
let asked = false, gen = 0, seeds = 0;

/* Bắt đầu nạp (một lần). Chỉ plPreload gọi: plUpdate không tự nạp, nên Đi dạo / Lái xe thấy dù người khác không tải pilot.glb (giữ người khối). Không ném */
function ask(): void {
  if (asked || src !== undefined) return;
  asked = true;
  const g = gen, done = (r: PlSource | null) => { if (g === gen) src = r || null; };
  try { loader().then(done, () => done(null)); } catch { done(null); }
}

/* Mức gió thời tiết 0..1 cho người treo: gió trung bình + giật (m/s, weather/index.ts ghi vào weatherU) chia windRef */
function plWind(): number {
  const v = (weatherU.uWind.value + weatherU.uGust.value) / CONFIG.explore.pilot.windRef;
  return v > 0 ? (v < 1 ? v : 1) : 0;
}

/* Dựng rig lỗi (mô hình hỏng kiểu gì đó): warn một lần, coi nguồn không dùng được (mọi dù, mọi khung sau giữ hình khối, không thử lại), không ném */
function fail(e: unknown): void {
  if (src) { console.warn('Dù lượn: dựng người treo lỗi, dùng hình khối', e); src = null; }
}

function attach(glider: THREE.Group, e: PlEntry, s: PlSource): void {
  let rig: PlRig | null = null;
  try {
    rig = new PlRig(s, e.seed);
    glider.add(rig.group);
    (glider.children[0] as THREE.Mesh).geometry = exGliderGeometry('canopy');
  } catch (err) {
    if (rig) { glider.remove(rig.group); try { rig.dispose(); } catch { /* đã lỗi rồi */ } }
    (glider.children[0] as THREE.Mesh).geometry = exGliderGeometry('full');
    fail(err);
    return;
  }
  e.rig = rig;
  e.track.has = false;
}

export function plPreload(): void { if (!OFF) ask(); }

export function plUpdate(glider: THREE.Group, s: GliderState, dt: number, turnInput?: number): void {
  if (OFF) return;
  let e = entries.get(glider);
  if (!e) {
    if (glider.userData.plOff) return;
    e = { rig: null, track: { x: 0, y: 0, z: 0, speed: 0, has: false }, sig: { turn: 0, acc: 0, vy: 0, wind: 0 }, seed: ++seeds };
    entries.set(glider, e);
  }
  if (!e.rig) {
    const so = src;
    if (!so || !glider.visible) return;
    attach(glider, e, so);
    if (!e.rig) return;
  }
  try {
    plSignals(e.sig, e.track, s.pos.x, s.pos.y, s.pos.z, s.bank, dt, plWind(), turnInput);
    e.rig!.update(e.sig, dt);
  } catch (err) {
    /* lỗi lúc diễn: trả hình khối cho dù này, không ném về vòng vẽ */
    fail(err);
    plDetach(glider);
  }
}

/* Dù nhảy vị trí / đổi chủ: lò xo về nghỉ, quên mẫu vị trí (không sinh gia tốc giả) */
export function plReset(glider: THREE.Group): void {
  const e = entries.get(glider);
  if (!e) return;
  e.track.has = false; e.track.hasSpeed = false; e.track.acc = 0; e.track.vy = 0;
  if (e.rig) e.rig.reset();
}

/* Gỡ nhân vật: trả hình 'full', dispose rig */
export function plDetach(glider: THREE.Group): void {
  const e = entries.get(glider);
  if (!e) return;
  if (e.rig) { e.rig.dispose(); e.rig = null; (glider.children[0] as THREE.Mesh).geometry = exGliderGeometry('full'); }
  entries.delete(glider);
}

export function plSetWarm(fn: ((o: THREE.Object3D) => Promise<unknown>) | null): void { plSetWarmLoad(fn); }

const ZERO: PlPose = { swingRoll: 0, swingPitch: 0, swingYaw: 0, spineRoll: 0, spinePitch: 0, spineTwist: 0, headYaw: 0, headRoll: 0, legSide: 0, legFore: 0, kneeL: 0, kneeR: 0, legSplit: 0, brakeL: 0, brakeR: 0, packRoll: 0, packPitch: 0, strap: 0 };

/* Cho test: real = đang hiện bằng nhân vật có xương; handErr m (điểm nắm ↔ quai phanh, −1 khi chưa có rig); pose bản sao; calls = số lưới đang hiện của dù (mỗi lưới một lệnh vẽ) */
export function plDebug(glider: THREE.Group): { real: boolean; handErr: [number, number]; pose: PlPose; calls: number } | null {
  const e = entries.get(glider);
  let calls = 0;
  glider.traverseVisible((o) => { if ((o as THREE.Mesh).isMesh) calls++; });
  if (!e) return null;
  const r = e.rig;
  return { real: !!r && glider.visible, handErr: r ? r.handErr() : [-1, -1], pose: { ...(r ? r.react.pose : ZERO) }, calls };
}

/* Chỉ dùng trong unit test: thay bộ nạp (null = plLoad thật), quên nguồn và mọi dù đã gắn */
export function __plSetLoader(fn: (() => Promise<PlSource | null>) | null): void {
  loader = fn || plLoad; gen++;
  src = undefined; asked = false;
  for (const g of [...entries.keys()]) plDetach(g);
}

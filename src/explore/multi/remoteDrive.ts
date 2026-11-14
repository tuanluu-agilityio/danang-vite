/* ===== Lái xe nhiều người: xe của người lái cùng =====
   Mỗi slot một xe (drCars, màu multiParams.colors[slot]). Gói d = [slot, x, y, z, yaw, v, st, giờ gửi] nhận 5 lần/s; vị trí + góc lái (st) nội suy bằng một ExTrack,
   tốc độ v bằng ExTrack thứ hai (v đặt ở trường x; hai track nhận cùng giờ gửi nên cùng độ lệch giờ), lấy mẫu chậm interpSends chu kỳ như dù lượn.
   Từ mẫu nội suy: bánh quay theo tích phân v / bán kính bánh, đèn phanh khi |v| giảm nhanh hơn CONFIG.drive.remote.brakeDecel, độ nghiêng dọc suy từ cao độ
   giữa hai khung (làm mượt, kẹp) để xe bám dốc cầu / hầm. Xe người khác không tham gia va chạm.
   Slot đổi chủ thì gỡ xe cũ; xe mới ẩn tới khi có mẫu đầu. Xe của mình (selfSlot) cũng nằm trong drCars: setSelf đặt slot đó, người dùng drive/index.ts tự place.
   Xe máy (D-040, drivers có veh 1): cùng nội suy, nhưng hình là BkBike lite (hình tạm xe + người khối, áo màu slot, + tấm bóng = 2 lệnh vẽ; không glb, không người có xương:
   trần 4 lệnh vẽ mỗi xe máy người khác, mô hình thật 11 + người lái 4 chỉ dành cho xe của mình) trong nhóm exDrivers.bikes; st là bkLeanToWire(độ nghiêng) nên lean = bkLeanFromWire(st).
   Slot đổi veh (ô tô ↔ xe máy) thì gỡ hình cũ như đổi chủ. Xe máy của mình không nằm ở đây (bike/index.ts tự vẽ; slot của mình bị loại qua sync(…, mySlot)).
   Module không đụng cảnh: onCars(nCars, nBikes) báo số ô tô / xe máy để multi/index.ts gắn / gỡ drCars.group và exDrivers.bikes (không có xe thì nhóm không ở trong cảnh, 0 lệnh vẽ).
   Không cấp phát mỗi khung (D-018). */
import * as THREE from 'three';
import { CONFIG } from '../../config';
import { drCars } from '../drive/cars';
import type { DrPlace } from '../drive/car';
import type { DrMapDot } from '../drive/hud';
import { BkBike, type BkPlace } from '../bike/model';
import { ExTrack, type ExPose } from './interp';
import { exVehNorm, bkLeanFromWire, type Flyer } from './protocol';

const M = CONFIG.explore.multi, R = CONFIG.drive.remote, RW = CONFIG.drive.car.wheelDia / 2, RWB = CONFIG.bike.body.wheelDia / 2;

export interface ExDriverState { x: number; y: number; z: number; yaw: number; v: number }

interface DSlot {
  name: string | null;        // null = slot trống (hoặc của mình)
  veh: number;                // 0 ô tô (drCars), 1 xe máy (bike)
  bike: BkBike | null;        // hình xe máy người khác (veh 1), null nếu ô tô / trống
  bp: BkPlace;                // tư thế trả cho bike.place
  tr: ExTrack;                // x, y, z, yaw, bank = góc lái st
  tv: ExTrack;                // tốc độ có dấu v (đặt ở trường x)
  pose: ExPose;               // đệm lấy mẫu của tr
  vp: ExPose;                 // đệm lấy mẫu của tv
  place: DrPlace;             // tư thế trả cho drCars.place
  state: ExDriverState;       // trả cho nhãn tên, bản đồ nhỏ, camera xem
  dot: DrMapDot;              // chấm trên bản đồ nhỏ
  live: boolean;              // đã có mẫu và đang hiện
  px: number; py: number; pz: number;   // vị trí lúc đo độ nghiêng gần nhất
  absV: number;               // |v| khung trước (suy đèn phanh)
  lastMs: number;             // giờ khách nhận gói gần nhất (ms), để biết mẫu cuối đã cũ (gói ngừng tới thì v về 0, bánh thôi quay)
}

const slots: DSlot[] = Array.from({ length: M.drive.slots }, (_, i) => ({
  name: null, veh: 0, bike: null, tr: new ExTrack(), tv: new ExTrack(), pose: { x: 0, y: 0, z: 0, yaw: 0, bank: 0 }, vp: { x: 0, y: 0, z: 0, yaw: 0, bank: 0 },
  place: { x: 0, y: 0, z: 0, yaw: 0, pitch: 0, steer: 0, wheel: 0, braking: false },
  bp: { x: 0, y: 0, z: 0, yaw: 0, pitch: 0, lean: 0, steer: 0, wheel: 0, susF: 0, susR: 0, braking: false, sig: 0 },
  state: { x: 0, y: 0, z: 0, yaw: 0, v: 0 }, dot: { x: 0, z: 0, color: M.colors[i % M.colors.length] },
  live: false, px: 0, py: 0, pz: 0, absV: 0, lastMs: 0
}));
const _a: number[] = [0, 0, 0, 0, 0, 0, 0];   // [slot, x, y, z, yaw, st, giờ gửi] cho tr
const _b: number[] = [0, 0, 0, 0, 0, 0, 0];   // [slot, v, 0, 0, 0, 0, giờ gửi] cho tv
const _dots: DrMapDot[] = [];
let selfSlot = -1;          // slot xe của mình trong drCars (-1 = không có xe của mình)
let me = -1;                // slot của mình trong nhóm lái (không lấy xe người khác ở slot này)
const bikes = new THREE.Group();   // xe máy người khác; ở trong cảnh khi có xe máy (multi/index.ts theo onCars)
bikes.name = 'drive-bikes';

function hide(s: DSlot): void { s.tr.reset(); s.tv.reset(); s.live = false; s.absV = 0; }
function dropBike(s: DSlot): void { if (s.bike) { s.bike.dispose(); s.bike = null; } }

/* Dựng lại danh sách xe của drCars (xe của mình + ô tô người khác), xe máy người khác, rồi báo số xe */
function refresh(): void {
  const list: { slot: number }[] = [];
  let nb = 0;
  if (selfSlot >= 0) list.push({ slot: selfSlot });
  for (let i = 0; i < slots.length; i++) {
    const s = slots[i];
    if (s.name === null || i === selfSlot) { dropBike(s); continue; }
    if (s.veh === 1) {
      if (!s.bike) { s.bike = new BkBike({ lite: true, shirt: M.colors[i % M.colors.length] }); bikes.add(s.bike.group); }
      s.bike.group.visible = s.live; nb++;
    } else { dropBike(s); list.push({ slot: i }); }
  }
  drCars.sync(list);
  for (let i = 0; i < slots.length; i++) if (slots[i].name !== null && i !== selfSlot && slots[i].veh !== 1) drCars.show(i, slots[i].live);
  exDrivers.onCars(list.length, nb);
}

export const exDrivers = {
  onCars: (_n: number, _bikes?: number): void => {},   // multi/index.ts đặt: gắn / gỡ drCars.group theo số ô tô (cả xe của mình), exDrivers.bikes theo số xe máy người khác
  bikes,

  /* Danh sách người lái đổi (sảnh, vào, ra): dựng xe slot mới, gỡ xe slot đổi chủ hoặc trống. mySlot: slot của mình nếu mình đang lái, ngược lại -1 */
  sync(drivers: Flyer[], mySlot: number): void {
    me = mySlot;
    for (let i = 0; i < slots.length; i++) {
      const s = slots[i];
      let name: string | null = null, veh = 0;
      if (i !== mySlot) for (const f of drivers) if (f.slot === i) { name = f.name; veh = exVehNorm(f.veh); break; }
      if (name !== s.name || veh !== s.veh) {
        if (i !== selfSlot) drCars.remove(i);   // chủ cũ đi, đổi tên hoặc đổi loại xe: xe mới không trượt từ chỗ người cũ
        dropBike(s);
        s.name = name; s.veh = veh; hide(s);
      }
    }
    refresh();
  },

  /* Xe của mình nằm ở slot này trong drCars (-1: không có, ví dụ đang xem); xe của mình do drive/index.ts đặt tư thế */
  setSelf(slot: number): void {
    if (slot === selfSlot) return;
    if (selfSlot >= 0) drCars.remove(selfSlot);
    selfSlot = slot;
    if (slot >= 0 && slot < slots.length && slots[slot].name !== null) { slots[slot].name = null; dropBike(slots[slot]); hide(slots[slot]); }   // slot của mình không thể còn tên người khác
    refresh();
  },

  /* Gói d: mỗi phần tử [slot, x, y, z, yaw, v, st, giờ gửi]; chỉ nhận slot đã biết chủ và không phải của mình */
  onPos(d: number[][], nowMs: number): void {
    for (const e of d) {
      const i = e[0], s = slots[i];
      if (!s || i === me || i === selfSlot || s.name === null) continue;
      _a[0] = _b[0] = i;
      _a[1] = e[1]; _a[2] = e[2]; _a[3] = e[3]; _a[4] = e[4]; _a[5] = e[6]; _a[6] = e[7];
      _b[1] = e[5]; _b[6] = e[7];
      s.tr.feed(_a, nowMs, M); s.tv.feed(_b, nowMs, M); s.lastMs = nowMs;
    }
  },

  /* Mỗi khung: lấy mẫu, quay bánh, đèn phanh, độ nghiêng, đặt xe */
  update(nowMs: number, dt: number): void {
    const t = nowMs - M.interpSends * 1000 / M.sendHz;
    for (let i = 0; i < slots.length; i++) {
      const s = slots[i];
      if (s.name === null || i === selfSlot) continue;
      if (!s.tr.sample(t, s.pose) || !s.tv.sample(t, s.vp)) continue;
      const p = s.pose, v = nowMs - s.lastMs > R.staleMs ? 0 : s.vp.x, pl = s.place, av = Math.abs(v);
      if (!s.live) {
        s.live = true; s.px = p.x; s.py = p.y; s.pz = p.z; pl.pitch = 0; pl.wheel = 0; s.absV = av;
        if (s.bike) s.bike.group.visible = true; else drCars.show(i, true);
      } else if (dt > 0) {
        const dx = p.x - s.px, dz = p.z - s.pz, dxz = Math.hypot(dx, dz);
        if (dxz >= R.pitchMinMove) {   // dời đủ xa mới đo độ nghiêng; chưa đủ thì cộng dồn quãng
          const tgt = Math.max(-R.pitchMax, Math.min(R.pitchMax, Math.atan2((p.y - s.py) * (v < 0 ? -1 : 1), dxz)));
          pl.pitch += (tgt - pl.pitch) * (1 - Math.exp(-dt / R.pitchTau));
          s.px = p.x; s.py = p.y; s.pz = p.z;
        }
        pl.wheel += v * dt / (s.bike ? RWB : RW);
      }
      pl.braking = dt > 0 && (s.absV - av) / dt > R.brakeDecel;
      s.absV = av;
      pl.x = p.x; pl.y = p.y; pl.z = p.z; pl.yaw = p.yaw; pl.steer = p.bank;
      if (s.bike) {   // xe máy: st là độ nghiêng đã nhân BK_WIRE; hình tạm không có cổ lái / bánh rời nên chỉ vị trí, hướng, dốc, nghiêng có tác dụng
        const b = s.bp; b.x = p.x; b.y = p.y; b.z = p.z; b.yaw = p.yaw; b.pitch = pl.pitch; b.lean = bkLeanFromWire(p.bank); b.wheel = pl.wheel; b.braking = pl.braking;
        s.bike.place(b);
      } else drCars.place(i, pl);
      const st = s.state; st.x = p.x; st.y = p.y; st.z = p.z; st.yaw = p.yaw; st.v = v;
    }
  },

  /* Trạng thái đã nội suy của xe ở slot (cho nhãn tên, camera xem, bản đồ nhỏ); null nếu chưa có hoặc slot trống */
  slotState(slot: number): ExDriverState | null {
    const s = slots[slot];
    return s && s.name !== null && s.live ? s.state : null;
  },
  name(slot: number): string | null { const s = slots[slot]; return s ? s.name : null; },
  /* Loại xe của slot (0 ô tô, 1 xe máy) cho nhãn tên; slot trống: 0 */
  vehOf(slot: number): number { const s = slots[slot]; return s && s.name !== null ? s.veh : 0; },

  /* Chấm xe người khác cho bản đồ nhỏ (mảng và phần tử tái dùng, chỉ xe đã hiện); except: trạng thái xe đang được xem (đã có mũi tên của bản đồ nên bỏ chấm) */
  dots(except?: ExDriverState | null): DrMapDot[] {
    let n = 0;
    for (const s of slots) {
      if (s.name === null || !s.live || s.state === except) continue;
      const d = s.dot; d.x = s.state.x; d.z = s.state.z;
      _dots[n++] = d;
    }
    _dots.length = n;
    return _dots;
  },

  /* Rời phòng / thoát chế độ: ẩn hết, quên tên và xe của mình */
  clear(): void {
    me = -1;
    for (let i = 0; i < slots.length; i++) { const s = slots[i]; if (s.name !== null) { drCars.remove(i); s.name = null; } dropBike(s); s.veh = 0; hide(s); }
    if (selfSlot >= 0) drCars.remove(selfSlot);
    selfSlot = -1;
    refresh();
  }
};

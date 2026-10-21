import * as THREE from 'three';
import { scene } from '../../core/renderer';
import { CONFIG } from '../../config';
import { buildAtlas, type Atlas } from './adAtlas';
import { clearRects, collectBuildings, snapshot, type Rect } from './clearance';
import { buildLandmarks, type Landmarks } from './landmarks';
import { buildHearts, type Hearts } from './heartFacade';
import { buildBillboards, panoRects, type Billboards } from './billboards';
import { buildPromenade, type Promenade } from './promenade';

/* [riverfront] Hai bờ sông Hàn: địa danh thật, mặt dựng LED trái tim + "DN", bảng quảng cáo, chi tiết bờ.
   Gọi buildRiverfront() SAU mọi lệnh dựng có dùng rand() (sau HanTunnel trong main.ts): chỉ thu nhỏ instance nhà/cây bị đè về 0. */
export interface Riverfront {
  group: THREE.Group; atlas: Atlas; landmarks: Landmarks; hearts: Hearts; billboards: Billboards; promenade: Promenade;
  footprints: Rect[]; cleared: { buildings: number; plants: number }; snapshot: typeof snapshot;
  adsEnabled: boolean;
}
let current: Riverfront | null = null;
export const getRiverfront = () => current;

export function buildRiverfront(): Riverfront {
  const group = new THREE.Group(); group.name = 'riverfront';
  const atlas = buildAtlas(), landmarks = buildLandmarks();
  const footprints = [...landmarks.rects, ...panoRects()];
  const cleared = clearRects(footprints, CONFIG.riverfront.clearMargin);
  const buildings = collectBuildings();                    // nhà còn lại sau khi dọn: chọn mái, mặt tiền, cửa hàng từ đây
  const hearts = buildHearts(landmarks.towers);
  const billboards = buildBillboards(atlas, landmarks, buildings);
  const promenade = buildPromenade(atlas, billboards.adMat, buildings);
  group.add(landmarks.mesh, hearts.mesh, billboards.group, promenade.group);
  scene.add(group);
  current = { group, atlas, landmarks, hearts, billboards, promenade, footprints, cleared, snapshot, adsEnabled: true };
  return current;
}
export function updateRiverfront(dt: number, _time: number) {
  if (!current) return;
  current.hearts.update(dt);
  if (current.adsEnabled) { current.billboards.update(dt); current.promenade.update(); }
}
export function setHeartsEnabled(on: boolean) { current?.hearts.setEnabled(on); }
export function setHeartsMode(m: 'duet' | 'sync') { current?.hearts.setMode(m); }
/* "Quảng cáo": bảng quảng cáo + băng rôn + bảng hiệu; không tắt chi tiết bờ (lan can, ghế…) */
export function setAdsEnabled(on: boolean) { if (!current) return; current.adsEnabled = on; current.billboards.setEnabled(on); }
export function disposeRiverfront() {
  if (!current) return;
  const c = current; c.hearts.dispose(); c.billboards.dispose(); c.promenade.dispose(); c.atlas.dispose();
  c.landmarks.mesh.geometry.dispose(); (c.landmarks.mesh.material as THREE.Material).dispose(); c.group.removeFromParent(); current = null;
}

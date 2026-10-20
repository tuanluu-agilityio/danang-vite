import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { CONFIG } from '../../config';
import { MAT } from '../../core/materials';
import { canvasTex } from '../../core/textures';
import { rng } from '../../common/math';
import { prepColored, extrudeAlongX, fillBlock, bentBox, boxAt, roadStrip, shadowed } from '../../common/geometry';
import { addLampPosts } from '../../common/deck';
import { HR, hrRoadY } from './profile';
import type { HanTunnel } from './HanTunnel';

/* [outdoor] Phần nhìn thấy trên mặt đất: máng hầm hở (sàn, tường, dải giữa), đoạn gờ chắn ngập, mái lam che nắng mưa,
   kiến trúc hai cửa hầm (Tây: tường thành Điện Hải; Đông: sóng biển, thuyền thúng), cửa phai, khung giới hạn chiều cao,
   mặt đường + vỉa hè + đèn đường + cọ hai bên. Mọi hình học gộp vào concreteParts hoặc InstancedMesh. */
const W = HR.halfWidth, LAND = CONFIG.landY;
const BRICK: [number, number, number] = [0.86, 0.6, 0.45];
const _q = new THREE.Quaternion(), _s = new THREE.Vector3(), _p = new THREE.Vector3(), _e = new THREE.Euler(), _m = new THREE.Matrix4();
const wallTop = (x: number) => Math.max(hrRoadY(x) + 1.1, LAND + 0.6);   // tường máng: cao hơn mặt đường 1,1 m, tối thiểu nhô 0,6 m khỏi mặt phố

function signTexture(lines: [string, number][], bg: string, w: number, h: number) {
  return canvasTex(w, h, (g, cw, ch) => {
    g.fillStyle = bg; g.fillRect(0, 0, cw, ch);
    g.strokeStyle = '#f2f2ee'; g.lineWidth = 4; g.strokeRect(5, 5, cw - 10, ch - 10);
    g.fillStyle = '#f2f2ee'; g.textAlign = 'center'; g.textBaseline = 'middle';
    let y = 0; const tot = lines.reduce((a, [, k]) => a + k, 0);
    for (const [txt, k] of lines) { g.font = `600 ${Math.round(ch * k / tot * 0.72)}px "Be Vietnam Pro", sans-serif`; g.fillText(txt, cw / 2, y + ch * k / tot / 2); y += ch * k / tot; }
  });
}

export function hrBuildOutdoor(bridge: HanTunnel) {
  const a = HR.coverHalf, c = HR.rampHalf, cp = bridge.concreteParts, M = bridge.mats;
  const lintelY = (x: number) => hrRoadY(x) + HR.clear + 0.2;
  for (const s of [-1, 1]) {
    const x0 = s > 0 ? a : -c, x1 = s > 0 ? c : -a, west = s < 0;
    const tint = west ? BRICK : [0.8, 0.8, 0.8] as [number, number, number];
    // máng chữ U: sàn, hai tường ngoài, dải giữa (thay hành lang thoát nạn)
    cp.push(prepColored(extrudeAlongX([[-W, -HR.slabBelow], [W, -HR.slabBelow], [W, 0], [-W, 0]], x0, x1, 64, hrRoadY), () => 0.75));
    for (const z of [-1, 1]) cp.push(prepColored(fillBlock(x0, x1, HR.outerWall, z * (W - HR.outerWall / 2), -7.6, wallTop, 64), () => tint));
    cp.push(prepColored(fillBlock(x0, x1, HR.tubeNear * 2, 0, -7.6, (x) => hrRoadY(x) + 0.9, 64), () => 0.8));
    // mái lam: dầm biên + dầm giữa trên cột, lam nghiêng bước 2 m
    const lx0 = s > 0 ? a : -a - HR.louverLen, lc = (lx0 + lx0 + HR.louverLen) / 2;
    for (const z of [-W + 0.5, 0, W - 0.5]) cp.push(prepColored(bentBox(HR.louverLen, 0.5, 0.5, lc, HR.clear + 0.25, z, 40, hrRoadY), () => tint));
    for (let x = lx0 + 8; x < lx0 + HR.louverLen; x += 16) cp.push(prepColored(boxAt(0.6, HR.clear - 0.9, 0.6, x, hrRoadY(x) + (HR.clear + 0.9) / 2 - 0.0, 0), () => 0.8));
    const slats: THREE.Matrix4[] = [];
    for (let x = lx0 + 1; x < lx0 + HR.louverLen; x += HR.louverGap) { _q.setFromEuler(_e.set(0, 0, 0.5)); slats.push(new THREE.Matrix4().compose(_p.set(x, hrRoadY(x) + HR.clear + 0.45, 0), _q, _s.set(1, 1, 1))); }
    const sl = new THREE.InstancedMesh(new THREE.BoxGeometry(1.5, 0.12, W * 2 - 1.2), M.louver, slats.length);
    slats.forEach((m, i) => sl.setMatrixAt(i, m)); sl.castShadow = true; sl.receiveShadow = true; bridge.group.add(sl);
    // dải LED viền mái lam và cửa hầm (sáng về đêm)
    const px = s * (a + HR.louverLen);   // mặt cửa hầm ở đầu mái lam, phía ra mặt phố
    const led = [-W, W].map((z) => bentBox(HR.louverLen, 0.08, 0.08, lc, HR.clear + 0.55, z, 40, hrRoadY));
    led.push(boxAt(0.1, 0.1, W * 2, px, lintelY(px) + 0.1, 0));
    const lm = new THREE.Mesh(mergeGeometries(led.map((g) => { g.deleteAttribute('uv'); return g; })), M.led); bridge.group.add(lm);
    // khung cửa hầm: dầm ngang + hai trụ, biển VMS quay ra phía đường dẫn
    cp.push(prepColored(boxAt(1.4, 1.7, W * 2 + 0.4, px, lintelY(px) + 1.1, 0), () => tint));
    for (const z of [-1, 1]) cp.push(prepColored(boxAt(1.6, lintelY(px) + 1.1 - wallTop(px) + 0.4, 1.6, px, (lintelY(px) + 1.1 + wallTop(px)) / 2 - 0.2, z * (W - 0.8)), () => tint));
    const vms = new THREE.Mesh(new THREE.PlaneGeometry(15, 1.35), new THREE.MeshBasicMaterial({
      map: signTexture([['HẦM SÔNG HÀN', 1.15], ['60 km/h · XE MÁY ĐI LÀN PHẢI', 0.8]], '#0a3f78', 1024, 92), side: THREE.FrontSide }));
    vms.position.set(px + s * 0.72, lintelY(px) + 1.1, 0); vms.rotation.y = s * Math.PI / 2; bridge.details.add(vms);
    bridge.mats.textures.push((vms.material as THREE.MeshBasicMaterial).map);
    // trang trí đỉnh cửa hầm
    const topY = lintelY(px) + 1.95, n = Math.floor((W * 2 - 1) / 1.8), crest: THREE.Matrix4[] = [];
    for (let k = 0; k < n; k++) {
      const z = -W + 0.9 + k * 1.8 + 0.5;
      if (west) crest.push(new THREE.Matrix4().compose(_p.set(px, topY + 0.35, z), _q.identity(), _s.set(1, 1, 1)));            // lô cốt răng cưa, gợi tường thành Điện Hải
      else { const h = 0.5 + 1.0 * (0.5 + 0.5 * Math.sin(k * 0.55)); crest.push(new THREE.Matrix4().compose(_p.set(px, topY + h / 2 - 0.05, z), _q.identity(), _s.set(1, h / 0.7, 1))); } // đỉnh sóng
    }
    const cm = new THREE.InstancedMesh(new THREE.BoxGeometry(0.9, 0.7, west ? 1.0 : 1.4), west ? M.brick : M.wave, crest.length);
    crest.forEach((m, i) => cm.setMatrixAt(i, m)); cm.castShadow = true; bridge.group.add(cm);
    // gờ chắn ngập: đoạn nền đắp qua đỉnh dốc, kèm cửa phai (khe thép + cánh cửa kéo lên) ở đầu hầm hở
    const e0 = s > 0 ? c : -c - 62.5, e1 = s > 0 ? c + 62.5 : -c;
    cp.push(prepColored(fillBlock(e0, e1, 36, 0, 2.0, (x) => hrRoadY(x) - 0.04, 40), () => 0.74));
    const gx = s * (c + 2.5);
    for (const z of [-1, 1]) bridge.steelParts.push(boxAt(0.9, 6.4, 0.9, gx, hrRoadY(gx) + 3.2, z * (W + 0.5)).toNonIndexed());
    bridge.steelParts.push(boxAt(1.0, 0.7, W * 2 + 2.4, gx, hrRoadY(gx) + 6.55, 0).toNonIndexed());
    bridge.steelParts.push(boxAt(0.25, 2.4, W * 2 - 0.4, gx, hrRoadY(gx) + 4.7, 0).toNonIndexed());   // cánh cửa phai, đang kéo lên
    // khung giới hạn chiều cao 4,5 m, cách đầu hầm hở 50 m
    const hx = s * HR.gantryX;
    for (const z of [-1, 1]) bridge.steelParts.push(boxAt(0.5, HR.heightLimit + 1.2, 0.5, hx, hrRoadY(hx) + (HR.heightLimit + 1.2) / 2, z * (W + 1.4)).toNonIndexed());
    bridge.steelParts.push(boxAt(0.55, 0.55, (W + 1.4) * 2, hx, hrRoadY(hx) + HR.heightLimit + 0.3, 0).toNonIndexed());
    const lim = new THREE.MeshBasicMaterial({ map: signTexture([['4,5 m', 1]], '#c9201a', 128, 64), side: THREE.DoubleSide });
    bridge.mats.textures.push(lim.map);
    for (const z of [-HR.tubeCenter, HR.tubeCenter]) { const p = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 1.2), lim); p.position.set(hx, hrRoadY(hx) + HR.heightLimit + 1.0, z); p.rotation.y = Math.PI / 2; bridge.details.add(p); }
  }
  hrBuildSurface(bridge);
  hrBuildDecor(bridge);
}

/* Mặt đường nối (Đống Đa phía Tây, Vân Đồn phía Đông), dải giữa, vỉa hè, đèn đường */
function hrBuildSurface(bridge: HanTunnel) {
  const Wd = HR.shoulder * 2 + HR.laneWidth * HR.lanesPerDir, c = HR.rampHalf;
  const roads: THREE.BufferGeometry[] = [];
  for (const [x0, x1, segs] of [[-1900, -780, 1], [-780, -HR.coverHalf, 80], [HR.coverHalf, 780, 80], [780, 1480, 1]] as [number, number, number][]) {
    roads.push(roadStrip(x0, x1, Wd, HR.tubeCenter, 0.03, segs, hrRoadY), roadStrip(x0, x1, Wd, -HR.tubeCenter, 0.03, segs, hrRoadY, true));
  }
  const road = shadowed(new THREE.Mesh(mergeGeometries(roads), bridge.mats.roadOut), false, true);
  road.name = 'hr-road'; bridge.group.add(road); bridge.noReflect.push(road); bridge.farHide.push(road);
  // dải giữa cỏ (4,2 m) và vỉa hè gạch (3 m) hai bên đường mặt phố
  const med: THREE.BufferGeometry[] = [], paver: THREE.BufferGeometry[] = [];
  for (const [x0, x1] of [[-1900, -c], [c, 1480]]) {
    const len = x1 - x0, xc = (x0 + x1) / 2, segs = Math.ceil(len / 8);
    med.push(bentBox(len, 0.3, HR.tubeNear * 2, xc, 0.15, 0, segs, hrRoadY));
    for (const z of [-1, 1]) paver.push(bentBox(len, 0.2, 3, xc, 0.1, z * (HR.tubeFar + 1.5), segs, hrRoadY));
  }
  const mm = shadowed(new THREE.Mesh(mergeGeometries(med), MAT.grass), false, true), pv = shadowed(new THREE.Mesh(mergeGeometries(paver), MAT.paver), false, true);
  bridge.group.add(mm, pv); bridge.noReflect.push(mm, pv); bridge.farHide.push(mm, pv);
  const xs: number[] = []; for (let x = 760; x <= 1460; x += 40) xs.push(x, -x);
  addLampPosts(bridge, { xs, profile: hrRoadY, rows: [{ z: -HR.tubeFar - 1.8, s: -1 }, { z: HR.tubeFar + 1.8, s: 1 }] });
}

/* Cọ ven đường, thuyền thúng ở cửa Đông (gợi làng chài Mân Thái, Nại Hiên) */
function hrBuildDecor(bridge: HanTunnel) {
  const rnd = rng(7001), palms: [number, number][] = [];
  for (const s of [-1, 1]) {
    for (let x = HR.coverHalf + 10; x < HR.rampHalf; x += 14) for (const z of [-1, 1]) palms.push([s * x + (rnd() - 0.5) * 2, z * (W + 3.4 + rnd() * 1.5)]);
    for (let x = HR.rampHalf + 20; x < 1440; x += 18) for (const z of [-1, 1]) palms.push([s * x + (rnd() - 0.5) * 3, z * (HR.tubeFar + 5.2 + rnd() * 1.5)]);
  }
  const trunkGeo = new THREE.CylinderGeometry(0.22, 0.35, 1, 6).translate(0, 0.5, 0);
  const trunks = new THREE.InstancedMesh(trunkGeo, MAT.trunk, palms.length), crowns = new THREE.InstancedMesh(new THREE.ConeGeometry(1, 1, 9, 1, true), MAT.palm, palms.length);
  palms.forEach(([x, z], i) => {
    const h = 8 + rnd() * 4, y = hrRoadY(x) < LAND ? LAND : hrRoadY(x) - 0.1;
    trunks.setMatrixAt(i, _m.compose(_p.set(x, y, z), _q.identity(), _s.set(0.8, h, 0.8)));
    crowns.setMatrixAt(i, _m.compose(_p.set(x, y + h + 0.3, z), _q.identity(), _s.set(3.8, 1.6, 3.8)));
  });
  trunks.castShadow = crowns.castShadow = true; bridge.details.add(trunks, crowns);
  // thuyền thúng: bát úp nửa cầu + mái chèo, xếp thành cụm bên cạnh cửa hầm phía Đông
  const bowl = new THREE.SphereGeometry(1, 18, 8, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2).scale(1.7, 0.9, 1.7);
  const spots: [number, number, number][] = [[612, 25, 0.2], [624, 28, 1.2], [636, 24.5, 2.4], [618, -27, 0.7], [632, -25, 1.9]];
  const boats = new THREE.InstancedMesh(bowl, bridge.mats.basket, spots.length);
  spots.forEach(([x, z, ry], i) => boats.setMatrixAt(i, _m.compose(_p.set(x, LAND + 0.9, z), _q.setFromEuler(_e.set(0, ry, 0)), _s.set(1, 1, 1))));
  boats.castShadow = true; bridge.details.add(boats);
}

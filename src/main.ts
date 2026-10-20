/* =====================================================================
   Đà Nẵng 3D — điểm vào: khởi tạo theo thứ tự, rồi chạy vòng animate.
   Thứ tự dựng cảnh giữ nguyên như bản một file: chuỗi ngẫu nhiên có hạt giống (common/math.ts → rand)
   được dùng lần lượt, đổi thứ tự sẽ đổi vị trí nhà, cây, xe.
   ===================================================================== */
import * as THREE from 'three';
import { initI18n } from './i18n';
import { renderer, scene, camera, controls } from './core/renderer';
import { shared } from './core/shared';
import { buildLights } from './core/lights';
import { buildSky, shadowCenter } from './core/sky';
import { buildWater, water } from './core/water';
import { applyNight, stepNight, dayNight } from './core/dayNight';
import { renderFrame, onResize } from './core/postprocessing';
import { buildRiverBanks } from './environment/river';
import { buildMountains } from './environment/mountains';
import { buildStreets, finalizeRoads } from './environment/streets';
import { buildCity } from './environment/city';
import { buildTrees, buildStreetLamps } from './environment/trees';
import { buildTraffic, buildBoats, updateTraffic, updateBoats } from './environment/traffic';
import {
  buildBridgeDeck, buildPiers, buildDragonBody, buildScales, buildHangers, buildDragonHead,
  createFire, createWaterJet, updateShow, updateEffects, show, showLabel, mouthW
} from './bridges/dragon';
import { ThuanPhuocBridge } from './bridges/thuan-phuoc';
import { TranThiLyBridge } from './bridges/tran-thi-ly';
import { SongHanBridge } from './bridges/song-han';
import { HanTunnel } from './bridges/han-tunnel';
import { buildRiverfront, updateRiverfront } from './environment/riverfront';
import { updateCamera, hrDrive } from './views/camera';
import { cam } from './views/state';
import { TOURS, tour } from './views/tour';
import { audio } from './audio';
import { narration } from './audio/narration';
import { setupUI } from './ui/setupUI';
import { updateHrUI } from './ui/hrUI';

initI18n();
void narration.init();
window.addEventListener('resize', onResize);

/* ============================ Khởi tạo ============================ */
buildLights();
buildSky();
buildWater();
buildRiverBanks();
buildMountains();
buildBridgeDeck();
buildPiers();
buildDragonBody();
buildScales();
buildHangers();
buildDragonHead();
buildStreets();
finalizeRoads();
buildCity();
buildTrees();
buildStreetLamps();
buildTraffic();
buildBoats();
const thuanPhuoc = new ThuanPhuocBridge();
scene.add(thuanPhuoc.group);
const tranThiLy = new TranThiLyBridge();
scene.add(tranThiLy.group);
const songHan = new SongHanBridge();
scene.add(songHan.group);
const hanTunnel = new HanTunnel();     // sau mọi lệnh dựng có dùng rand(): chỉ dọn nhà, cây trên tuyến bằng cách thu nhỏ instance
scene.add(hanTunnel.group);
const riverfront = buildRiverfront();    // sau HanTunnel: dọn nhà bị đè bằng scale 0, không đụng chuỗi rand()
const bridges = [thuanPhuoc, tranThiLy, songHan, hanTunnel];
createFire();
createWaterJet();
setupUI({ thuanPhuoc, tranThiLy, songHan, hanTunnel });
onResize();
applyNight(0, 0);

/* Móc kiểm thử: chỉ bật khi URL có ?test (dùng cho tests/*.mjs đo draw call và chạy Tour) */
if (new URLSearchParams(location.search).has('test')) {
  (window as unknown as { __app: unknown }).__app = { renderer, scene, camera, controls, cam, songHan, hr: hanTunnel, riverfront, hrDrive, THREE, dayNight, tours: TOURS, tour, narration };
}

/* ============================ Vòng lặp ============================ */
const clock = new THREE.Clock();
const fpsEl = document.getElementById('fps'), callsEl = document.getElementById('calls'), showEl = document.getElementById('showState');
let frames = 0, fpsT = 0, fpsLast = performance.now(), firstFrame = true;
function animate() {
  requestAnimationFrame(animate);
  const dt = Math.min(clock.getDelta(), 0.05), time = clock.elapsedTime;
  shared.uTime.value = time;
  shadowCenter.set(Math.round(controls.target.x / 8) * 8, 0, Math.round(controls.target.z / 8) * 8);
  stepNight(dt);
  applyNight(dayNight.night, time);
  water.material.uniforms.time.value += dt * 0.6;
  updateShow(dt);
  updateEffects(dt, time);
  updateTraffic(dt);
  updateBoats(dt, time);
  updateCamera(dt);
  for (const b of bridges) b.update(dt, time, camera);
  hanTunnel.holdBoats(songHan.boats.list);
  updateHrUI(camera);
  updateRiverfront(dt, time);
  audio.setSwingDistance(camera.position.distanceTo(songHan.center));
  audio.update(dayNight.night, show.fireOn, show.waterOn, camera.position.distanceTo(mouthW));
  renderer.info.reset();
  renderFrame(dayNight.night, dt);
  frames++; const now = performance.now(); fpsT = (now - fpsLast) / 1000;
  if (fpsT >= 0.5) {
    fpsEl.textContent = String(Math.round(frames / fpsT)); fpsLast = now; callsEl.textContent = String(renderer.info.render.calls);
    showEl.textContent = showLabel(); frames = 0; fpsT = 0;
  }
  if (firstFrame) { firstFrame = false; document.getElementById('loading').classList.add('done'); }
}
animate();

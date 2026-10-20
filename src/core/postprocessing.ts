import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { renderer, scene, camera } from './renderer';
import { pScale } from './shared';
import { clamp, smooth } from '../common/math';

/* Bloom chỉ dùng khi trời tối: ban ngày vẫn vẽ thẳng như trước (không tốn thêm) */
export const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
export const bloomPass = new UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), 0, 0.4, 0.98);
composer.addPass(bloomPass);
composer.addPass(new OutputPass());

export function renderFrame(night: number, dt: number) {
  const bloomK = smooth(clamp((night - 0.05) / 0.6, 0, 1));
  if (bloomK > 0.001) { bloomPass.strength = 0.6 * bloomK; composer.render(dt); }
  else renderer.render(scene, camera);
}

export function onResize() {
  camera.aspect = window.innerWidth / window.innerHeight; camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  composer.setPixelRatio(renderer.getPixelRatio()); composer.setSize(window.innerWidth, window.innerHeight);
  const h = renderer.getDrawingBufferSize(new THREE.Vector2()).y;
  pScale.value = h / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2));
}

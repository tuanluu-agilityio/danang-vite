// Tiện ích dùng chung cho kiểm tra thời tiết: chụp giá trị khí quyển, đặt preset "tức thì" (bỏ qua thời gian tiến dần).
import { frames } from './lib.mjs';

/** Chụp mọi giá trị khí quyển mà thời tiết có thể đổi (số thật, so sánh tuyệt đối). */
export const snapAtmosphere = (page) => page.evaluate(() => {
  const { scene, renderer } = window.__app;
  let sun, hemi, water, sky, clouds;
  scene.traverse((o) => {
    if (o.isDirectionalLight && o.castShadow !== undefined && o.shadow && o.intensity >= 0 && !sun && o.shadow.camera.right === 470) sun = o;
    else if (o.isHemisphereLight) hemi = o;
    else if (o.isWater || o.material?.uniforms?.distortionScale) water = o;
    else if (o.material?.uniforms?.turbidity) sky = o;
    else if (o.isInstancedMesh && o.count === 26 && o.material?.isMeshBasicMaterial && o.material.transparent) clouds = o;
  });
  const wu = water.material.uniforms, su = sky.material.uniforms;
  return {
    fogDensity: scene.fog.density, fogColor: scene.fog.color.toArray(), sunI: sun.intensity, hemiI: hemi.intensity, hemiColor: hemi.color.toArray(),
    exposure: renderer.toneMappingExposure, turbidity: su.turbidity.value, rayleigh: su.rayleigh.value,
    waterColor: wu.waterColor.value.toArray(), distortion: wu.distortionScale.value, size: wu.size.value, waterY: water.position.y,
    cloudOpacity: clouds.material.opacity, cloudColor: clouds.material.color.toArray(), cloudRotY: clouds.rotation.y
  };
});

/** Đặt preset rồi cho trạng thái hiện tại bằng đích ngay (current = target, wet = rain), chờ vài khung để áp lên cảnh. */
export async function setWx(page, preset, k = 1) {
  await page.evaluate(([p, k]) => {
    const w = window.__app.weather; w.setPreset(p); w.setIntensity(k);
    Object.assign(w.state.current, w.state.target); w.state.wet = w.state.current.rain;
  }, [preset, k]);
  await frames(page, 3);
}

import * as THREE from 'three';
import { bridgePatch } from '../../common/shaders';
import { swLedPatch } from './ledShow';

/* [materials] Bê tông tô màu theo đỉnh (bệ, nhà ga, quảng trường và cả giàn tháp/trục tĩnh — gộp một draw call), thép (vành + nan + moay-ơ quay),
   cabin (vỏ đỏ, dải kính theo màu đỉnh), biển "SUN WHEEL" (chữ vẽ canvas). LED đêm (GĐ4) vá thêm vào ba vật liệu đầu bằng swLedPatch (ledShow.ts) */
export function swMaterials() {
  const textures: THREE.Texture[] = [];
  /* biển hiệu: chữ trắng trên nền trong suốt; sáng hơn khi tối (SunWheel.update đọc shared.uNight), không phải đèn */
  const cv = document.createElement('canvas'); cv.width = 512; cv.height = 96;
  const ctx = cv.getContext('2d');
  ctx.fillStyle = '#ffffff'; ctx.font = 'bold 76px Arial, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText('SUN WHEEL', 256, 50);
  const signTex = new THREE.CanvasTexture(cv); signTex.colorSpace = THREE.SRGBColorSpace; signTex.anisotropy = 4; textures.push(signTex);
  return {
    concrete: swLedPatch(bridgePatch(new THREE.MeshStandardMaterial({ color: 0xe6e3dc, roughness: 0.8, metalness: 0, vertexColors: true }), { noise: true, wet: true, weather: true }), 'static'),
    steel: swLedPatch(bridgePatch(new THREE.MeshStandardMaterial({ color: 0xf2f3f4, roughness: 0.45, metalness: 0.35 }), { weather: true }), 'wheel'),   // thép sơn trắng
    cabin: swLedPatch(bridgePatch(new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.35, metalness: 0.2, vertexColors: true }), { weather: true }), 'cabin'),
    sign: new THREE.MeshBasicMaterial({ map: signTex, alphaTest: 0.4, color: 0xdddddd }),
    textures
  };
}
export type SwMaterials = ReturnType<typeof swMaterials>;

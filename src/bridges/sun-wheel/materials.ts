import * as THREE from 'three';
import { bridgePatch } from '../../common/shaders';

/* [materials] Bê tông (bệ, nhà ga, quảng trường) và thép (tháp đỡ, vành, nan). Cabin, LED, biển hiệu thêm ở các giai đoạn sau */
export function swMaterials() {
  return {
    concrete: bridgePatch(new THREE.MeshStandardMaterial({ color: 0xe6e3dc, roughness: 0.8, metalness: 0, vertexColors: true }), { noise: true, wet: true, weather: true }),
    steel: bridgePatch(new THREE.MeshStandardMaterial({ color: 0xf2f3f4, roughness: 0.45, metalness: 0.35 }), { weather: true }),   // thép sơn trắng
    textures: [] as THREE.Texture[]
  };
}
export type SwMaterials = ReturnType<typeof swMaterials>;
